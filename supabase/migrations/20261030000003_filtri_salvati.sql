-- Filtri salvati (SPEC §6.2): una combinazione di filtri di un dataset, con un nome, da riaprire
-- con un clic dalle schede Dati, Statistiche e Grafici.
--
-- "parametri" sono i filtri come compaiono nell'indirizzo della pagina (src/lib/filtri.ts), per esempio
--   {"f.data.p": ["30"], "f.momento.v": ["Mattina", "Sera"]}
-- Le scorciatoie di periodo restano relative: «ultimi 30 giorni» vale sempre per gli ultimi 30 giorni.
-- Filtri su colonne che non esistono più vengono ignorati all'apertura, come nell'indirizzo.
-- Se il dataset si elimina, i suoi filtri salvati spariscono con lui.

create table if not exists public.filtri_salvati (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  dataset_id uuid not null references public.dataset (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  parametri jsonb not null check (jsonb_typeof(parametri) = 'object' and pg_column_size(parametri) <= 20000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dataset_id, nome)
);

create index if not exists filtri_salvati_utente_idx on public.filtri_salvati (user_id);

alter table public.filtri_salvati enable row level security;

-- Ognuno vede e salva solo i propri filtri, e solo sui propri dataset.
drop policy if exists "filtri salvati: propri" on public.filtri_salvati;
create policy "filtri salvati: propri" on public.filtri_salvati
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.dataset d where d.id = dataset_id and d.user_id = (select auth.uid()))
  );

-- L'app sceglie solo dataset, nome e filtri; per cambiare si rinomina (nome) o si salva di nuovo.
revoke all on public.filtri_salvati from public, anon, authenticated;
grant select, delete on public.filtri_salvati to authenticated;
grant insert (dataset_id, nome, parametri) on public.filtri_salvati to authenticated;
grant update (nome, parametri, updated_at) on public.filtri_salvati to authenticated;

-- Al massimo 50 filtri salvati per dataset.
create or replace function public.limite_filtri_salvati()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select count(*) from public.filtri_salvati where dataset_id = new.dataset_id) >= 50 then
    raise exception 'Hai già 50 filtri salvati per questo dataset: eliminane qualcuno.' using errcode = '53400';
  end if;
  return new;
end;
$$;

drop trigger if exists limite_filtri_salvati on public.filtri_salvati;
create trigger limite_filtri_salvati before insert on public.filtri_salvati
  for each row execute function public.limite_filtri_salvati();

-- Utente di sola lettura (se esiste): solo le righe dell'utente scelto, come per i grafici.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'lettore') then
    grant select on public.filtri_salvati to lettore;
    drop policy if exists lettore on public.filtri_salvati;
    create policy lettore on public.filtri_salvati for select to lettore
      using (user_id = (select user_id from public.lettore_utente));
  end if;
end;
$$;
