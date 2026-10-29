-- Dashboard personale: i grafici salvati che l'utente vi fissa, nell'ordine scelto da lui.
-- Una riga per utente; "grafici" contiene gli id dei grafici fissati, nell'ordine di visualizzazione.
-- Un grafico eliminato sparisce da solo (l'app mostra solo gli id che esistono ancora e li ripulisce
-- al primo salvataggio). Togliere un grafico dalla dashboard non lo elimina.

create table if not exists public.dashboard (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  grafici uuid[] not null default '{}' check (cardinality(grafici) <= 50),
  updated_at timestamptz not null default now()
);

alter table public.dashboard enable row level security;

-- Ognuno vede e cambia solo la propria dashboard.
drop policy if exists "dashboard: propria" on public.dashboard;
create policy "dashboard: propria" on public.dashboard
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.dashboard to authenticated;
