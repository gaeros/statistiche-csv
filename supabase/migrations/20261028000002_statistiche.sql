-- Fase 2: statistiche calcolate nel database (SPEC §5).
--
-- Tutte le funzioni sono security invoker: leggono le tabelle con i permessi dell'utente,
-- quindi valgono le regole RLS e ognuno può calcolare statistiche solo sui propri dati.
-- I nomi di colonna arrivano dall'app ma vengono accettati solo se sono nel catalogo.

-- ---------------------------------------------------------------------------
-- Supporto: dataset dell'utente e colonne valide
-- ---------------------------------------------------------------------------

create or replace function public.dataset_proprio(p_dataset uuid)
returns public.dataset
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset;
begin
  select * into d from public.dataset where id = p_dataset;
  if not found then
    raise exception 'Dataset non trovato.' using errcode = 'P0002';
  end if;
  return d;
end;
$$;

-- Tipo della colonna (intero, decimale, testo, data, data_ora, booleano) o errore se non esiste.
create or replace function public.tipo_colonna(d public.dataset, p_colonna text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  tipo text;
begin
  select c ->> 'tipo' into tipo
  from jsonb_array_elements(d.colonne) c
  where c ->> 'nome' = p_colonna;
  if tipo is null then
    raise exception 'Colonna non trovata: %', p_colonna using errcode = '22023';
  end if;
  return tipo;
end;
$$;

-- Espressione SQL che porta una colonna data/ora al periodo scelto, nell'ora di Roma.
create or replace function public.espressione_periodo(p_colonna text, p_tipo text, p_periodo text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_periodo not in ('day', 'week', 'month', 'year') then
    raise exception 'Periodo non valido: %', p_periodo using errcode = '22023';
  end if;
  if p_tipo = 'data' then
    return format('date_trunc(%L, %I::timestamp)::date', p_periodo, p_colonna);
  elsif p_tipo = 'data_ora' then
    return format('date_trunc(%L, %I at time zone %L)::date', p_periodo, p_colonna, 'Europe/Rome');
  end if;
  raise exception 'La colonna % non è una data.', p_colonna using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------
-- Riepilogo per colonna
-- ---------------------------------------------------------------------------

create or replace function public.statistiche_colonne(p_dataset uuid, p_barre integer default 10)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset := public.dataset_proprio(p_dataset);
  tabella text := format('dati.%I', d.nome_fisico);
  totale bigint;
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

  return jsonb_build_object('totale', totale, 'colonne', risultato);
end;
$$;

-- ---------------------------------------------------------------------------
-- Conteggio per periodo di una colonna data
-- ---------------------------------------------------------------------------

create or replace function public.conteggio_per_periodo(p_dataset uuid, p_colonna text, p_periodo text default 'month')
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
    'with c as (select %1$s as periodo, count(*) as conteggio from dati.%2$I where %3$I is not null group by 1),
          s as (select generate_series(min(periodo), max(periodo), (''1 '' || %4$L)::interval)::date as periodo from c)
     select coalesce(jsonb_agg(jsonb_build_object(''periodo'', s.periodo, ''conteggio'', coalesce(c.conteggio, 0))
                               order by s.periodo), ''[]''::jsonb)
     from s left join c using (periodo)',
    espr, d.nome_fisico, p_colonna, p_periodo
  ) into risultato;
  return risultato;
end;
$$;

-- ---------------------------------------------------------------------------
-- Correlazioni tra colonne numeriche
-- ---------------------------------------------------------------------------

create or replace function public.correlazioni(p_dataset uuid)
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

  execute format('select jsonb_build_array(%s) from dati.%I', array_to_string(espressioni, ', '), d.nome_fisico)
    into risultato;
  return risultato;
end;
$$;

-- ---------------------------------------------------------------------------
-- Raggruppamenti: somma/media/... di una colonna per i valori di un'altra
-- ---------------------------------------------------------------------------

create or replace function public.espressione_aggregazione(p_aggregazione text, p_valore text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
begin
  return case p_aggregazione
    when 'conteggio' then 'count(*)'
    when 'somma' then format('sum(%I)', p_valore)
    when 'media' then format('avg(%I)', p_valore)
    when 'mediana' then format('percentile_cont(0.5) within group (order by %I)', p_valore)
    when 'minimo' then format('min(%I)', p_valore)
    when 'massimo' then format('max(%I)', p_valore)
    else null
  end;
end;
$$;

create or replace function public.raggruppa(
  p_dataset uuid,
  p_gruppo text,
  p_valore text default null,
  p_aggregazione text default 'conteggio',
  p_periodo text default 'month',
  p_limite integer default 50
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
           from dati.%3$I group by 1 order by %4$s limit $1) t',
    espr_gruppo, espr_valore, d.nome_fisico, ordine
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
  p_finestra integer default 3
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
       from dati.%3$I where %4$I is not null group by 1
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
    espr_periodo, espr_valore, d.nome_fisico, p_data, p_periodo
  ) using least(greatest(p_finestra, 1), 52) into risultato;
  return risultato;
end;
$$;

-- ---------------------------------------------------------------------------
-- Permessi
-- ---------------------------------------------------------------------------

revoke execute on function public.dataset_proprio(uuid) from public, anon;
revoke execute on function public.statistiche_colonne(uuid, integer) from public, anon;
revoke execute on function public.conteggio_per_periodo(uuid, text, text) from public, anon;
revoke execute on function public.correlazioni(uuid) from public, anon;
revoke execute on function public.raggruppa(uuid, text, text, text, text, integer) from public, anon;
revoke execute on function public.andamento(uuid, text, text, text, text, integer) from public, anon;

grant execute on function public.dataset_proprio(uuid) to authenticated;
grant execute on function public.statistiche_colonne(uuid, integer) to authenticated;
grant execute on function public.conteggio_per_periodo(uuid, text, text) to authenticated;
grant execute on function public.correlazioni(uuid) to authenticated;
grant execute on function public.raggruppa(uuid, text, text, text, text, integer) to authenticated;
grant execute on function public.andamento(uuid, text, text, text, text, integer) to authenticated;
