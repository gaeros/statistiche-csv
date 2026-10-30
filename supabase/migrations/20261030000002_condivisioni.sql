-- Link di sola lettura per condividere un grafico salvato o la dashboard (SPEC §6.4).
--
-- Chi ha il link vede i grafici senza accedere e senza poterli cambiare. Il link contiene un
-- codice casuale di 64 caratteri (244 bit casuali, impossibile da indovinare) che crea il
-- database: l'app non può sceglierlo. Il proprietario può revocarlo (la riga si elimina) e
-- dargli una scadenza.
--
-- Chi apre il link non tocca mai il database: la pagina pubblica gira sul server dell'app, che
-- con la chiave di servizio chiama public.leggi_condivisione e poi public.dati_grafico con la
-- configurazione salvata. Al browser arrivano solo i valori già calcolati del grafico, mai le
-- righe del dataset, e il visitatore non può chiedere altri calcoli. Per questo la funzione e i
-- calcoli dei grafici sono concessi a service_role e non ad anon.

create table if not exists public.condivisioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  token text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
    check (token ~ '^[0-9a-f]{64}$'),
  -- Il grafico condiviso; vuoto = la dashboard (con i grafici fissati in quel momento).
  -- Se il grafico si elimina (anche con il suo dataset) il link sparisce con lui.
  grafico_id uuid references public.grafici (id) on delete cascade,
  scade_il timestamptz,
  visite integer not null default 0,
  ultima_visita timestamptz,
  created_at timestamptz not null default now(),
  check (scade_il is null or scade_il > created_at)
);

create index if not exists condivisioni_utente_idx on public.condivisioni (user_id, created_at);
create index if not exists condivisioni_grafico_idx on public.condivisioni (grafico_id);

alter table public.condivisioni enable row level security;

-- Ognuno vede, crea e revoca solo i propri link, e solo per i propri grafici.
drop policy if exists "condivisioni: proprie" on public.condivisioni;
create policy "condivisioni: proprie" on public.condivisioni
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (grafico_id is null
         or exists (select 1 from public.grafici g where g.id = grafico_id and g.user_id = (select auth.uid())))
  );

-- Il codice, le visite e le date li scrive solo il database: l'app sceglie solo cosa
-- condividere e la scadenza. Niente update: per cambiare la scadenza si crea un nuovo link.
revoke all on public.condivisioni from public, anon, authenticated;
grant select, delete on public.condivisioni to authenticated;
grant insert (grafico_id, scade_il) on public.condivisioni to authenticated;

-- Al massimo 100 link per utente.
create or replace function public.limite_condivisioni()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.condivisioni where user_id = new.user_id) >= 100 then
    raise exception 'Hai già 100 link condivisi: revocane qualcuno.' using errcode = '53400';
  end if;
  return new;
end;
$$;

drop trigger if exists limite_condivisioni on public.condivisioni;
create trigger limite_condivisioni before insert on public.condivisioni
  for each row execute function public.limite_condivisioni();

-- ---------------------------------------------------------------------------
-- Lettura di un link (solo per il server dell'app, con la chiave di servizio)
-- ---------------------------------------------------------------------------
--
-- Restituisce null se il link non esiste, è stato revocato o è scaduto. Altrimenti:
--   {"dashboard": true|false, "scade_il": ..., "grafici": [{"id", "titolo", "configurazione",
--    "dataset_id", "dataset_nome", "colonne"}, ...]}
-- con i grafici nell'ordine della dashboard. Conta la visita (numero e data, nient'altro).

create or replace function public.leggi_condivisione(p_token text)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
  c public.condivisioni;
  ids uuid[];
  grafici jsonb;
begin
  if coalesce(p_token, '') !~ '^[0-9a-f]{64}$' then
    return null;
  end if;

  update public.condivisioni
  set visite = visite + 1, ultima_visita = now()
  where token = p_token and (scade_il is null or scade_il > now())
  returning * into c;
  if not found then
    return null;
  end if;

  if c.grafico_id is not null then
    ids := array[c.grafico_id];
  else
    select coalesce(d.grafici, '{}') into ids from public.dashboard d where d.user_id = c.user_id;
  end if;

  -- Solo grafici e dataset del proprietario del link (la chiave di servizio non ha RLS).
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', g.id, 'titolo', g.titolo, 'configurazione', g.configurazione,
           'dataset_id', ds.id, 'dataset_nome', ds.nome, 'colonne', ds.colonne
         ) order by u.n), '[]'::jsonb)
  into grafici
  from unnest(coalesce(ids, '{}')) with ordinality as u(id, n)
  join public.grafici g on g.id = u.id and g.user_id = c.user_id
  join public.dataset ds on ds.id = g.dataset_id and ds.user_id = c.user_id;

  return jsonb_build_object('dashboard', c.grafico_id is null, 'scade_il', c.scade_il, 'grafici', grafici);
end;
$$;

revoke execute on function public.leggi_condivisione(text) from public, anon, authenticated;
revoke execute on function public.limite_condivisioni() from public, anon;
grant execute on function public.leggi_condivisione(text) to service_role;

-- La chiave di servizio deve poter calcolare i grafici condivisi: dati_grafico e le funzioni
-- che usa, più la lettura delle tabelle dei dati (anche di quelle che si creeranno).
grant execute on function public.dati_grafico(uuid, jsonb, jsonb) to service_role;
grant execute on function public.dataset_proprio(uuid) to service_role;
grant execute on function public.sorgente_filtrata(public.dataset, jsonb) to service_role;
grant execute on function public.condizione_filtri(public.dataset, jsonb) to service_role;
grant execute on function public.tipo_colonna(public.dataset, text) to service_role;
grant execute on function public.espressione_periodo(text, text, text) to service_role;
grant execute on function public.espressione_aggregazione(text, text) to service_role;
grant select on public.dataset, public.grafici, public.dashboard, public.condivisioni to service_role;
grant update (visite, ultima_visita) on public.condivisioni to service_role;

grant usage on schema dati to service_role;
grant select on all tables in schema dati to service_role;
alter default privileges in schema dati grant select on tables to service_role;
