-- Fase 3: filtri (SPEC §6.2). I filtri valgono per statistiche, grafici e tabella dei dati insieme
-- e vengono eseguiti nel database.
--
-- Un filtro è un oggetto JSON; p_filtri è un elenco di filtri, tutti da rispettare (AND):
--   {"colonna": "data",      "tipo": "intervallo", "da": "2026-10-01", "a": "2026-10-31"}  date e numeri
--   {"colonna": "momento",   "tipo": "valori",     "valori": ["Mattina"]}                  categorie, Sì/No
--   {"colonna": "nota",      "tipo": "testo",      "testo": "caffè"}                       contiene (senza maiuscole)
--   {"colonna": "misurata",  "tipo": "ore",        "da": 6, "a": 12}                       ora di Roma, da incluso, a escluso
--   {"colonna": "data",      "tipo": "giorni",     "valori": [1, 2, 3, 4, 5]}              giorno della settimana, 1 = lunedì
-- Colonne e tipi sono controllati sul catalogo; i valori entrano nella query solo come letterali (%L).

-- Le funzioni cambiano firma (nuovo parametro p_filtri): si tolgono le versioni precedenti.
drop function if exists public.statistiche_colonne(uuid, integer);
drop function if exists public.conteggio_per_periodo(uuid, text, text);
drop function if exists public.correlazioni(uuid);
drop function if exists public.raggruppa(uuid, text, text, text, text, integer);
drop function if exists public.andamento(uuid, text, text, text, text, integer);
drop function if exists public.leggi_righe(uuid, integer, integer, text, boolean);

-- ---------------------------------------------------------------------------
-- Condizione SQL dai filtri
-- ---------------------------------------------------------------------------

create or replace function public.condizione_filtri(d public.dataset, p_filtri jsonb)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  f jsonb;
  colonna text;
  tipo text;
  locale text;
  parti text[] := '{}';
  da text;
  a text;
  valori text[];
begin
  if p_filtri is null or jsonb_typeof(p_filtri) <> 'array' then
    return 'true';
  end if;
  if jsonb_array_length(p_filtri) > 50 then
    raise exception 'Troppi filtri.' using errcode = '22023';
  end if;

  for f in select value from jsonb_array_elements(p_filtri) loop
    colonna := f ->> 'colonna';
    tipo := public.tipo_colonna(d, colonna);
    -- Le date con ora si confrontano nel giorno e nell'ora di Roma.
    locale := case when tipo = 'data_ora' then format('(%I at time zone %L)', colonna, 'Europe/Rome') end;
    da := nullif(f ->> 'da', '');
    a := nullif(f ->> 'a', '');

    case f ->> 'tipo'
      when 'intervallo' then
        if tipo in ('intero', 'decimale') then
          if da is not null then parti := parti || format('%I >= %L::numeric', colonna, da); end if;
          if a is not null then parti := parti || format('%I <= %L::numeric', colonna, a); end if;
        elsif tipo = 'data' then
          if da is not null then parti := parti || format('%I >= %L::date', colonna, da); end if;
          if a is not null then parti := parti || format('%I <= %L::date', colonna, a); end if;
        elsif tipo = 'data_ora' then
          if da is not null then parti := parti || format('%s::date >= %L::date', locale, da); end if;
          if a is not null then parti := parti || format('%s::date <= %L::date', locale, a); end if;
        else
          raise exception 'Intervallo non valido sulla colonna %.', colonna using errcode = '22023';
        end if;

      when 'valori' then
        if tipo not in ('testo', 'booleano') then
          raise exception 'Scelta di valori non valida sulla colonna %.', colonna using errcode = '22023';
        end if;
        select coalesce(array_agg(v), '{}') into valori from jsonb_array_elements_text(f -> 'valori') v;
        parti := parti || format('%I::text = any(%L::text[])', colonna, valori);

      when 'testo' then
        if tipo <> 'testo' then
          raise exception 'Ricerca di testo non valida sulla colonna %.', colonna using errcode = '22023';
        end if;
        if nullif(f ->> 'testo', '') is not null then
          parti := parti || format(
            '%I ilike %L',
            colonna,
            '%' || replace(replace(replace(f ->> 'testo', '\', '\\'), '%', '\%'), '_', '\_') || '%'
          );
        end if;

      when 'ore' then
        if tipo <> 'data_ora' then
          raise exception 'La fascia oraria vale solo per data e ora (colonna %).', colonna using errcode = '22023';
        end if;
        if da is not null and a is not null then
          -- Da 22 a 6 vuol dire a cavallo della mezzanotte.
          parti := parti || format(
            case when da::int <= a::int then '(extract(hour from %1$s) >= %2$s and extract(hour from %1$s) < %3$s)'
                 else '(extract(hour from %1$s) >= %2$s or extract(hour from %1$s) < %3$s)' end,
            locale, da::int, a::int
          );
        end if;

      when 'giorni' then
        if tipo not in ('data', 'data_ora') then
          raise exception 'Il giorno della settimana vale solo per le date (colonna %).', colonna using errcode = '22023';
        end if;
        select coalesce(array_agg(v::int), '{}') into valori from jsonb_array_elements_text(f -> 'valori') v;
        parti := parti || format('extract(isodow from %s) = any(%L::int[])', coalesce(locale, quote_ident(colonna)), valori);

      else
        raise exception 'Tipo di filtro non valido: %', f ->> 'tipo' using errcode = '22023';
    end case;
  end loop;

  return coalesce(nullif(array_to_string(parti, ' and '), ''), 'true');
end;
$$;

-- Tabella dei dati con i filtri applicati, da usare nel FROM.
create or replace function public.sorgente_filtrata(d public.dataset, p_filtri jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select format('(select * from dati.%I where %s) as f', d.nome_fisico, public.condizione_filtri(d, p_filtri))
$$;

-- ---------------------------------------------------------------------------
-- Valori di una colonna (per scegliere le categorie nei filtri)
-- ---------------------------------------------------------------------------

create or replace function public.valori_colonna(p_dataset uuid, p_colonna text, p_limite integer default 100)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset := public.dataset_proprio(p_dataset);
  risultato jsonb;
begin
  if public.tipo_colonna(d, p_colonna) not in ('testo', 'booleano') then
    raise exception 'La colonna % non è di testo.', p_colonna using errcode = '22023';
  end if;
  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''valore'', v, ''conteggio'', n) order by v), ''[]''::jsonb)
     from (select %1$I::text as v, count(*) as n from dati.%2$I where %1$I is not null
           group by 1 order by 2 desc, 1 limit $1) t',
    p_colonna, d.nome_fisico
  ) using least(greatest(p_limite, 1), 500) into risultato;
  return risultato;
end;
$$;

-- ---------------------------------------------------------------------------
-- Riepilogo per colonna
-- ---------------------------------------------------------------------------

create or replace function public.statistiche_colonne(p_dataset uuid, p_barre integer default 10, p_filtri jsonb default '[]')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset := public.dataset_proprio(p_dataset);
  tabella text := public.sorgente_filtrata(d, p_filtri);
  totale bigint;
  complessivo bigint;
  colonna jsonb;
  nome text;
  tipo text;
  base jsonb;
  extra jsonb;
  parziale jsonb;
  risultato jsonb := '[]'::jsonb;
  q1 numeric;
  q3 numeric;
  minimo numeric;
  massimo numeric;
  barre integer := least(greatest(p_barre, 1), 50);
begin
  execute format('select count(*) from %s', tabella) into totale;
  execute format('select count(*) from dati.%I', d.nome_fisico) into complessivo;

  for colonna in select value from jsonb_array_elements(d.colonne) loop
    nome := colonna ->> 'nome';
    tipo := colonna ->> 'tipo';

    execute format(
      'select jsonb_build_object(''valori'', count(%1$I), ''mancanti'', count(*) - count(%1$I),
                                 ''distinti'', count(distinct %1$I))
       from %2$s', nome, tabella
    ) into base;

    extra := '{}'::jsonb;

    if tipo in ('intero', 'decimale') then
      execute format(
        'select jsonb_build_object(
           ''minimo'', min(%1$I), ''massimo'', max(%1$I), ''somma'', sum(%1$I),
           ''media'', avg(%1$I), ''dev_std'', stddev_samp(%1$I),
           ''q1'', percentile_cont(0.25) within group (order by %1$I),
           ''mediana'', percentile_cont(0.5) within group (order by %1$I),
           ''q3'', percentile_cont(0.75) within group (order by %1$I))
         from %2$s', nome, tabella
      ) into extra;

      q1 := (extra ->> 'q1')::numeric;
      q3 := (extra ->> 'q3')::numeric;
      minimo := (extra ->> 'minimo')::numeric;
      massimo := (extra ->> 'massimo')::numeric;

      if minimo is not null then
        -- Valori anomali con la regola IQR: fuori da [Q1 - 1,5·IQR, Q3 + 1,5·IQR].
        execute format(
          'select jsonb_build_object(
             ''anomali'', count(*) filter (where %1$I < $1 - 1.5 * ($2 - $1) or %1$I > $2 + 1.5 * ($2 - $1)),
             ''soglia_bassa'', $1 - 1.5 * ($2 - $1),
             ''soglia_alta'', $2 + 1.5 * ($2 - $1))
           from %2$s', nome, tabella
        ) using q1, q3 into parziale;
        extra := extra || parziale;

        -- Istogramma: intervalli di uguale ampiezza tra minimo e massimo.
        if minimo = massimo then
          parziale := jsonb_build_array(
            jsonb_build_object('da', minimo, 'a', massimo, 'conteggio', (base ->> 'valori')::bigint));
        elsif tipo = 'intero' then
          -- Interi: intervalli di numeri interi (es. 104–106), al massimo "barre" intervalli.
          execute format(
            'with p as (select ceil(($2 - $1 + 1) / $3::numeric)::bigint as passo),
                  b as (select (%1$I - $1) / p.passo + 1 as n, count(*) as conteggio
                        from %2$s, p where %1$I is not null group by 1)
             select jsonb_agg(jsonb_build_object(
                      ''da'', $1 + (s.n - 1) * p.passo,
                      ''a'', least($1 + s.n * p.passo - 1, $2),
                      ''conteggio'', coalesce(b.conteggio, 0)) order by s.n)
             from p, generate_series(1, ceil(($2 - $1 + 1) / p.passo::numeric)::int) as s(n)
             left join b on b.n = s.n',
            nome, tabella
          ) using minimo::bigint, massimo::bigint, barre into parziale;
        else
          execute format(
            'with b as (
               select least(width_bucket(%1$I, $1, $2, $3), $3) as n, count(*) as conteggio
               from %2$s where %1$I is not null group by 1
             )
             select jsonb_agg(jsonb_build_object(
                      ''da'', $1 + (s.n - 1) * ($2 - $1) / $3,
                      ''a'', $1 + s.n * ($2 - $1) / $3,
                      ''conteggio'', coalesce(b.conteggio, 0)) order by s.n)
             from generate_series(1, $3) as s(n) left join b on b.n = s.n',
            nome, tabella
          ) using minimo, massimo, barre into parziale;
        end if;
        extra := extra || jsonb_build_object('istogramma', parziale);
      end if;

    elsif tipo in ('testo', 'booleano') then
      execute format(
        'select coalesce(jsonb_agg(jsonb_build_object(''valore'', v, ''conteggio'', n) order by n desc, v), ''[]''::jsonb)
         from (select %1$I::text as v, count(*) as n from %2$s where %1$I is not null
               group by 1 order by 2 desc, 1 limit 10) t', nome, tabella
      ) into extra;
      extra := jsonb_build_object('frequenti', extra);

    elsif tipo in ('data', 'data_ora') then
      execute format(
        'select jsonb_build_object(''prima'', min(%1$I), ''ultima'', max(%1$I),
                ''giorni'', (max(%3$s) - min(%3$s)) + 1)
         from %2$s', nome, tabella,
        case when tipo = 'data' then format('%I', nome) else format('(%I at time zone %L)::date', nome, 'Europe/Rome') end
      ) into extra;
    end if;

    risultato := risultato || jsonb_build_array(
      jsonb_build_object('nome', nome, 'originale', colonna ->> 'originale', 'tipo', tipo) || base || extra
    );
  end loop;

  return jsonb_build_object('totale', totale, 'complessivo', complessivo, 'colonne', risultato);
end;
$$;

-- ---------------------------------------------------------------------------
-- Conteggio per periodo di una colonna data
-- ---------------------------------------------------------------------------

create or replace function public.conteggio_per_periodo(
  p_dataset uuid, p_colonna text, p_periodo text default 'month', p_filtri jsonb default '[]'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset := public.dataset_proprio(p_dataset);
  espr text := public.espressione_periodo(p_colonna, public.tipo_colonna(d, p_colonna), p_periodo);
  risultato jsonb;
begin
  execute format(
    'with c as (select %1$s as periodo, count(*) as conteggio from %2$s where %3$I is not null group by 1),
          s as (select generate_series(min(periodo), max(periodo), (''1 '' || %4$L)::interval)::date as periodo from c)
     select coalesce(jsonb_agg(jsonb_build_object(''periodo'', s.periodo, ''conteggio'', coalesce(c.conteggio, 0))
                               order by s.periodo), ''[]''::jsonb)
     from s left join c using (periodo)',
    espr, public.sorgente_filtrata(d, p_filtri), p_colonna, p_periodo
  ) into risultato;
  return risultato;
end;
$$;

-- ---------------------------------------------------------------------------
-- Correlazioni tra colonne numeriche
-- ---------------------------------------------------------------------------

create or replace function public.correlazioni(p_dataset uuid, p_filtri jsonb default '[]')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset := public.dataset_proprio(p_dataset);
  numeriche text[];
  espressioni text[] := '{}';
  i integer;
  j integer;
  risultato jsonb;
begin
  select array_agg(c ->> 'nome' order by n)
    into numeriche
  from jsonb_array_elements(d.colonne) with ordinality as t(c, n)
  where c ->> 'tipo' in ('intero', 'decimale');

  if coalesce(array_length(numeriche, 1), 0) < 2 then
    return '[]'::jsonb;
  end if;
  numeriche := numeriche[1:20];

  for i in 1 .. array_length(numeriche, 1) - 1 loop
    for j in i + 1 .. array_length(numeriche, 1) loop
      espressioni := espressioni || format(
        'jsonb_build_object(''a'', %L, ''b'', %L, ''r'', corr(%I::float8, %I::float8), ''n'', count(%I + %I))',
        numeriche[i], numeriche[j], numeriche[i], numeriche[j], numeriche[i], numeriche[j]
      );
    end loop;
  end loop;

  execute format('select jsonb_build_array(%s) from %s', array_to_string(espressioni, ', '), public.sorgente_filtrata(d, p_filtri))
    into risultato;
  return risultato;
end;
$$;

-- ---------------------------------------------------------------------------
-- Raggruppamenti: somma/media/... di una colonna per i valori di un'altra
-- ---------------------------------------------------------------------------

create or replace function public.raggruppa(
  p_dataset uuid,
  p_gruppo text,
  p_valore text default null,
  p_aggregazione text default 'conteggio',
  p_periodo text default 'month',
  p_limite integer default 50,
  p_filtri jsonb default '[]'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset := public.dataset_proprio(p_dataset);
  tipo_gruppo text := public.tipo_colonna(d, p_gruppo);
  espr_gruppo text;
  espr_valore text;
  ordine text;
  risultato jsonb;
begin
  if p_aggregazione <> 'conteggio' then
    if p_valore is null or public.tipo_colonna(d, p_valore) not in ('intero', 'decimale') then
      raise exception 'Per questa aggregazione serve una colonna numerica.' using errcode = '22023';
    end if;
  end if;
  espr_valore := public.espressione_aggregazione(p_aggregazione, p_valore);
  if espr_valore is null then
    raise exception 'Aggregazione non valida: %', p_aggregazione using errcode = '22023';
  end if;

  if tipo_gruppo in ('data', 'data_ora') then
    espr_gruppo := public.espressione_periodo(p_gruppo, tipo_gruppo, p_periodo);
    ordine := 'gruppo';
  else
    espr_gruppo := format('%I::text', p_gruppo);
    ordine := 'valore desc nulls last, gruppo';
  end if;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''gruppo'', gruppo, ''valore'', valore, ''righe'', righe)), ''[]''::jsonb)
     from (select %1$s as gruppo, %2$s as valore, count(*) as righe
           from %3$s group by 1 order by %4$s limit $1) t',
    espr_gruppo, espr_valore, public.sorgente_filtrata(d, p_filtri), ordine
  ) using least(greatest(p_limite, 1), 500) into risultato;
  return risultato;
end;
$$;

-- ---------------------------------------------------------------------------
-- Andamento nel tempo con media mobile
-- ---------------------------------------------------------------------------

-- I periodi senza dati restano nella serie con valore vuoto (non si inventano valori);
-- la media mobile usa solo i periodi con dati dentro la finestra.
create or replace function public.andamento(
  p_dataset uuid,
  p_data text,
  p_valore text,
  p_periodo text default 'week',
  p_aggregazione text default 'media',
  p_finestra integer default 3,
  p_filtri jsonb default '[]'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset := public.dataset_proprio(p_dataset);
  espr_periodo text := public.espressione_periodo(p_data, public.tipo_colonna(d, p_data), p_periodo);
  espr_valore text;
  risultato jsonb;
begin
  if p_aggregazione <> 'conteggio' and public.tipo_colonna(d, p_valore) not in ('intero', 'decimale') then
    raise exception 'Per l''andamento serve una colonna numerica.' using errcode = '22023';
  end if;
  espr_valore := public.espressione_aggregazione(p_aggregazione, p_valore);
  if espr_valore is null then
    raise exception 'Aggregazione non valida: %', p_aggregazione using errcode = '22023';
  end if;

  execute format(
    'with v as (
       select %1$s as periodo, %2$s as valore, count(*) as righe
       from %3$s where %4$I is not null group by 1
     ),
     s as (
       select generate_series(min(periodo), max(periodo), (''1 '' || %5$L)::interval)::date as periodo from v
     ),
     serie as (
       select s.periodo, v.valore, coalesce(v.righe, 0) as righe,
              avg(v.valore) over (order by s.periodo rows between $1 - 1 preceding and current row) as media_mobile
       from s left join v using (periodo)
     )
     select coalesce(jsonb_agg(jsonb_build_object(
              ''periodo'', periodo, ''valore'', valore, ''righe'', righe,
              ''media_mobile'', case when valore is null then null else media_mobile end)
            order by periodo), ''[]''::jsonb)
     from serie',
    espr_periodo, espr_valore, public.sorgente_filtrata(d, p_filtri), p_data, p_periodo
  ) using least(greatest(p_finestra, 1), 52) into risultato;
  return risultato;
end;
$$;

-- ---------------------------------------------------------------------------
-- Righe della tabella (scheda Dati), con i filtri
-- ---------------------------------------------------------------------------

create or replace function public.leggi_righe(
  p_dataset uuid,
  p_limite integer default 50,
  p_offset integer default 0,
  p_ordina text default 'id',
  p_discendente boolean default false,
  p_filtri jsonb default '[]'
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset;
  totale bigint;
  righe jsonb;
begin
  select * into d from public.dataset where id = p_dataset;
  if not found then
    raise exception 'Dataset non trovato.' using errcode = 'P0002';
  end if;

  if p_ordina <> 'id' and not exists (
    select 1 from jsonb_array_elements(d.colonne) c where c ->> 'nome' = p_ordina
  ) then
    p_ordina := 'id';
  end if;

  execute format('select count(*) from %s', public.sorgente_filtrata(d, p_filtri)) into totale;
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t) - ''user_id'' - ''created_at''), ''[]''::jsonb)
       from (select * from %s order by %I %s nulls last, id limit $1 offset $2) t',
    public.sorgente_filtrata(d, p_filtri), p_ordina, case when p_discendente then 'desc' else 'asc' end
  ) into righe using least(greatest(p_limite, 1), 500), greatest(p_offset, 0);

  return jsonb_build_object('totale', totale, 'righe', righe);
end;
$$;

-- ---------------------------------------------------------------------------
-- Permessi
-- ---------------------------------------------------------------------------

revoke execute on function public.condizione_filtri(public.dataset, jsonb) from public, anon;
revoke execute on function public.sorgente_filtrata(public.dataset, jsonb) from public, anon;
revoke execute on function public.valori_colonna(uuid, text, integer) from public, anon;
revoke execute on function public.statistiche_colonne(uuid, integer, jsonb) from public, anon;
revoke execute on function public.conteggio_per_periodo(uuid, text, text, jsonb) from public, anon;
revoke execute on function public.correlazioni(uuid, jsonb) from public, anon;
revoke execute on function public.raggruppa(uuid, text, text, text, text, integer, jsonb) from public, anon;
revoke execute on function public.andamento(uuid, text, text, text, text, integer, jsonb) from public, anon;
revoke execute on function public.leggi_righe(uuid, integer, integer, text, boolean, jsonb) from public, anon;

grant execute on function public.condizione_filtri(public.dataset, jsonb) to authenticated;
grant execute on function public.sorgente_filtrata(public.dataset, jsonb) to authenticated;
grant execute on function public.valori_colonna(uuid, text, integer) to authenticated;
grant execute on function public.statistiche_colonne(uuid, integer, jsonb) to authenticated;
grant execute on function public.conteggio_per_periodo(uuid, text, text, jsonb) to authenticated;
grant execute on function public.correlazioni(uuid, jsonb) to authenticated;
grant execute on function public.raggruppa(uuid, text, text, text, text, integer, jsonb) to authenticated;
grant execute on function public.andamento(uuid, text, text, text, text, integer, jsonb) to authenticated;
grant execute on function public.leggi_righe(uuid, integer, integer, text, boolean, jsonb) to authenticated;
