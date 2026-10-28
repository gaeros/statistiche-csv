-- Fase 3: costruttore di grafici e grafici salvati in una dashboard personale (SPEC §6.1).

-- ---------------------------------------------------------------------------
-- Grafici salvati
-- ---------------------------------------------------------------------------

create table public.grafici (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dataset_id uuid not null references public.dataset (id) on delete cascade,
  titolo text not null check (char_length(titolo) between 1 and 120),
  -- {"tipo": "barre", "x": "data", "periodo": "month", "y": ["prezzo"], "aggregazione": "somma", ...}
  configurazione jsonb not null check (jsonb_typeof(configurazione) = 'object'),
  created_at timestamptz not null default now()
);

create index grafici_dataset_idx on public.grafici (dataset_id, created_at);

alter table public.grafici enable row level security;

-- Ognuno vede e salva solo i propri grafici, e solo sui propri dataset.
create policy "grafici: propri" on public.grafici
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.dataset d where d.id = dataset_id and d.user_id = (select auth.uid()))
  );

grant select, insert, update, delete on public.grafici to authenticated;

-- ---------------------------------------------------------------------------
-- Dati di un grafico costruito dall'utente
-- ---------------------------------------------------------------------------
--
-- p_config:
--   tipo          barre | barre_impilate | linee | area | torta | dispersione | istogramma | box
--   x             colonna dell'asse X (categoria, data o numero per la dispersione); facoltativa per istogramma e box
--   periodo       day | week | month | year, se x è una data
--   y             elenco di colonne numeriche (vuoto con aggregazione "conteggio")
--   aggregazione  conteggio | somma | media | mediana | minimo | massimo
--   suddividi     colonna di categoria per avere una serie per valore (es. barre impilate per categoria)
--
-- Risultato, secondo il tipo:
--   {"righe": [{"x": ..., "s": serie, "v": valore}]}               barre, linee, area, torta
--   {"punti": [[x, y], ...]}                                      dispersione (al massimo 5000)
--   {"barre": [{"da": ..., "a": ..., "conteggio": ...}]}          istogramma
--   {"scatole": [{"x": ..., "minimo", "q1", "mediana", "q3", "massimo", "n"}]}   box plot

create or replace function public.dati_grafico(p_dataset uuid, p_config jsonb, p_filtri jsonb default '[]')
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  d public.dataset := public.dataset_proprio(p_dataset);
  sorgente text := public.sorgente_filtrata(d, p_filtri);
  tipo text := p_config ->> 'tipo';
  x text := nullif(p_config ->> 'x', '');
  periodo text := coalesce(nullif(p_config ->> 'periodo', ''), 'month');
  aggregazione text := coalesce(nullif(p_config ->> 'aggregazione', ''), 'conteggio');
  suddividi text := nullif(p_config ->> 'suddividi', '');
  ys text[];
  y text;
  tipo_x text;
  espr_x text;
  parti text[] := '{}';
  minimo numeric;
  massimo numeric;
  risultato jsonb;
begin
  if tipo is null or tipo not in ('barre', 'barre_impilate', 'linee', 'area', 'torta', 'dispersione', 'istogramma', 'box') then
    raise exception 'Tipo di grafico non valido: %', tipo using errcode = '22023';
  end if;

  select coalesce(array_agg(v), '{}') into ys
  from jsonb_array_elements_text(case when jsonb_typeof(p_config -> 'y') = 'array' then p_config -> 'y' else '[]' end) v
  where v <> '';
  if coalesce(array_length(ys, 1), 0) > 8 then
    raise exception 'Al massimo 8 colonne nello stesso grafico.' using errcode = '22023';
  end if;
  foreach y in array ys loop
    if public.tipo_colonna(d, y) not in ('intero', 'decimale') then
      raise exception 'La colonna % non è numerica.', y using errcode = '22023';
    end if;
  end loop;

  if x is not null then
    tipo_x := public.tipo_colonna(d, x);
    espr_x := case
      when tipo_x in ('data', 'data_ora') then public.espressione_periodo(x, tipo_x, periodo) || '::text'
      else format('%I::text', x)
    end;
  end if;

  -- Dispersione: coppie di valori così come sono
  if tipo = 'dispersione' then
    if x is null or tipo_x not in ('intero', 'decimale') or coalesce(array_length(ys, 1), 0) = 0 then
      raise exception 'La dispersione vuole due colonne numeriche.' using errcode = '22023';
    end if;
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_array(a, b)), ''[]''::jsonb)
       from (select %1$I as a, %2$I as b from %3$s where %1$I is not null and %2$I is not null limit 5000) t',
      x, ys[1], sorgente
    ) into risultato;
    return jsonb_build_object('punti', risultato);
  end if;

  -- Istogramma: 20 intervalli di uguale ampiezza
  if tipo = 'istogramma' then
    if coalesce(array_length(ys, 1), 0) = 0 then
      raise exception 'L''istogramma vuole una colonna numerica.' using errcode = '22023';
    end if;
    execute format('select min(%1$I), max(%1$I) from %2$s', ys[1], sorgente) into minimo, massimo;
    if minimo is null then
      return jsonb_build_object('barre', '[]'::jsonb);
    end if;
    if minimo = massimo then
      execute format('select jsonb_build_array(jsonb_build_object(''da'', $1, ''a'', $1, ''conteggio'', count(%1$I))) from %2$s',
        ys[1], sorgente) using minimo into risultato;
      return jsonb_build_object('barre', risultato);
    end if;
    execute format(
      'with b as (select least(width_bucket(%1$I, $1, $2, 20), 20) as n, count(*) as conteggio
                  from %2$s where %1$I is not null group by 1)
       select jsonb_agg(jsonb_build_object(''da'', $1 + (s.n - 1) * ($2 - $1) / 20, ''a'', $1 + s.n * ($2 - $1) / 20,
                                           ''conteggio'', coalesce(b.conteggio, 0)) order by s.n)
       from generate_series(1, 20) s(n) left join b on b.n = s.n',
      ys[1], sorgente
    ) using minimo, massimo into risultato;
    return jsonb_build_object('barre', risultato);
  end if;

  -- Box plot: quartili della prima colonna Y, per gruppo X se scelto
  if tipo = 'box' then
    if coalesce(array_length(ys, 1), 0) = 0 then
      raise exception 'Il box plot vuole una colonna numerica.' using errcode = '22023';
    end if;
    execute format(
      'select coalesce(jsonb_agg(jsonb_build_object(''x'', x, ''minimo'', mi, ''q1'', q1, ''mediana'', me, ''q3'', q3,
                                                    ''massimo'', ma, ''n'', n) order by x nulls last), ''[]''::jsonb)
       from (select %1$s as x, min(%2$I) as mi, max(%2$I) as ma, count(%2$I) as n,
                    percentile_cont(0.25) within group (order by %2$I) as q1,
                    percentile_cont(0.5) within group (order by %2$I) as me,
                    percentile_cont(0.75) within group (order by %2$I) as q3
             from %3$s where %2$I is not null group by 1 limit 100) t',
      coalesce(espr_x, 'null::text'), ys[1], sorgente
    ) into risultato;
    return jsonb_build_object('scatole', risultato);
  end if;

  -- Barre, linee, area, torta: valore aggregato per X (e per serie)
  if x is null then
    raise exception 'Scegli la colonna dell''asse X.' using errcode = '22023';
  end if;
  if public.espressione_aggregazione(aggregazione, 'v') is null then
    raise exception 'Aggregazione non valida: %', aggregazione using errcode = '22023';
  end if;
  if aggregazione <> 'conteggio' and coalesce(array_length(ys, 1), 0) = 0 then
    raise exception 'Scegli almeno una colonna numerica da calcolare.' using errcode = '22023';
  end if;

  if suddividi is not null then
    if public.tipo_colonna(d, suddividi) not in ('testo', 'booleano') then
      raise exception 'Si può suddividere solo per una colonna di testo o Sì/No.' using errcode = '22023';
    end if;
    parti := array[format(
      'select %1$s as x, %2$I::text as s, %3$s as v from %4$s group by 1, 2',
      espr_x, suddividi,
      public.espressione_aggregazione(aggregazione, case when aggregazione = 'conteggio' then null else ys[1] end),
      sorgente
    )];
  elsif aggregazione = 'conteggio' then
    parti := array[format('select %1$s as x, %2$L::text as s, count(*) as v from %3$s group by 1', espr_x, 'conteggio', sorgente)];
  else
    foreach y in array ys loop
      parti := parti || format(
        'select %1$s as x, %2$L::text as s, %3$s as v from %4$s group by 1',
        espr_x, y, public.espressione_aggregazione(aggregazione, y), sorgente
      );
    end loop;
  end if;

  execute format(
    'select coalesce(jsonb_agg(jsonb_build_object(''x'', x, ''s'', s, ''v'', v) order by x nulls last, s), ''[]''::jsonb)
     from (select * from (%s) u limit 5000) t',
    array_to_string(parti, ' union all ')
  ) into risultato;
  return jsonb_build_object('righe', risultato);
end;
$$;

revoke execute on function public.dati_grafico(uuid, jsonb, jsonb) from public, anon;
grant execute on function public.dati_grafico(uuid, jsonb, jsonb) to authenticated;
