-- Fase 1: import dei file in tabelle vere, una per file (o per foglio Excel).
--
-- public.importazioni  un record per file caricato (tabella padre)
-- public.dataset       un record per ogni tabella creata, collegato al padre
-- dati.<nome_fisico>   le tabelle con i dati, una per dataset
--
-- Le tabelle in "dati" si creano solo con public.crea_dataset (security definer, nomi validati).
-- Su ogni tabella è attiva la RLS: si vedono solo le righe con user_id = utente collegato.

create schema if not exists dati;
revoke all on schema dati from public, anon;
grant usage on schema dati to authenticated;

-- ---------------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------------

create table public.importazioni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome_file text not null check (char_length(nome_file) between 1 and 255),
  tipo_file text not null,
  dimensione_byte bigint not null check (dimensione_byte >= 0),
  percorso_storage text,
  stato text not null default 'in_corso' check (stato in ('in_corso', 'completata', 'errore')),
  messaggio_errore text,
  created_at timestamptz not null default now(),
  completata_at timestamptz
);

create index importazioni_user_id_idx on public.importazioni (user_id, created_at desc);

create table public.dataset (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  importazione_id uuid not null references public.importazioni (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 100),
  nome_originale text not null,
  foglio text,
  nome_fisico text not null unique,
  -- [{ "nome": "quantita", "originale": "Quantità", "tipo": "intero" }, ...]
  colonne jsonb not null check (jsonb_typeof(colonne) = 'array'),
  righe bigint not null default 0,
  avvisi jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, nome)
);

create index dataset_importazione_id_idx on public.dataset (importazione_id);

alter table public.importazioni enable row level security;
alter table public.dataset enable row level security;

create policy "importazioni: proprie" on public.importazioni
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- I dataset si creano solo con crea_dataset; l'utente può leggerli, rinominarli ed eliminarli.
create policy "dataset: lettura propri" on public.dataset
  for select to authenticated using (user_id = (select auth.uid()));
create policy "dataset: modifica propri" on public.dataset
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "dataset: eliminazione propri" on public.dataset
  for delete to authenticated using (user_id = (select auth.uid()));

revoke insert, update on public.dataset from anon, authenticated;
grant select, delete on public.dataset to authenticated;
grant update (nome, updated_at) on public.dataset to authenticated;

-- ---------------------------------------------------------------------------
-- Funzioni di supporto
-- ---------------------------------------------------------------------------

-- Tipi ammessi: nome usato dall'app → tipo PostgreSQL.
create or replace function public.tipo_sql(tipo text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case tipo
    when 'intero' then 'bigint'
    when 'decimale' then 'numeric'
    when 'testo' then 'text'
    when 'data' then 'date'
    when 'data_ora' then 'timestamptz'
    when 'booleano' then 'boolean'
  end;
$$;

-- Spazio occupato dalle tabelle di un utente, in byte.
create or replace function public.spazio_usato(p_utente uuid default auth.uid())
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(pg_catalog.pg_total_relation_size(format('dati.%I', d.nome_fisico)::regclass)), 0)::bigint
  from public.dataset d
  where d.user_id = p_utente
    and p_utente = auth.uid();
$$;

-- Quota per utente (§7): 100 MB.
create or replace function public.quota_utente()
returns bigint
language sql
immutable
set search_path = ''
as $$ select 100::bigint * 1024 * 1024 $$;

-- ---------------------------------------------------------------------------
-- Creazione di una tabella dati
-- ---------------------------------------------------------------------------

create or replace function public.crea_dataset(
  p_importazione uuid,
  p_nome text,
  p_nome_originale text,
  p_foglio text,
  p_colonne jsonb,
  p_avvisi jsonb default '[]'::jsonb
)
returns public.dataset
language plpgsql
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  nome_finale text;
  fisico text;
  definizioni text;
  colonna jsonb;
  prog integer := 1;
  risultato public.dataset;
  nomi_visti text[] := '{}';
begin
  if utente is null then
    raise exception 'Devi essere collegato.' using errcode = '42501';
  end if;

  if not exists (select 1 from public.importazioni where id = p_importazione and user_id = utente) then
    raise exception 'Importazione non trovata.' using errcode = 'P0002';
  end if;

  if public.spazio_usato(utente) >= public.quota_utente() then
    raise exception 'Quota di spazio superata (100 MB).' using errcode = '53400';
  end if;

  -- Nome della tabella: già sanificato dall'app, qui solo validato.
  if p_nome !~ '^[a-z_][a-z0-9_]{0,52}$' then
    raise exception 'Nome tabella non valido: %', p_nome using errcode = '22023';
  end if;

  if jsonb_typeof(p_colonne) <> 'array'
     or jsonb_array_length(p_colonne) = 0
     or jsonb_array_length(p_colonne) > 1000 then
    raise exception 'Elenco colonne non valido.' using errcode = '22023';
  end if;

  definizioni := '';
  for colonna in select value from jsonb_array_elements(p_colonne) loop
    if coalesce(colonna ->> 'nome', '') !~ '^[a-z_][a-z0-9_]{0,62}$'
       or colonna ->> 'nome' in ('id', 'user_id', 'created_at') then
      raise exception 'Nome colonna non valido: %', colonna ->> 'nome' using errcode = '22023';
    end if;
    if colonna ->> 'nome' = any (nomi_visti) then
      raise exception 'Colonna ripetuta: %', colonna ->> 'nome' using errcode = '22023';
    end if;
    if public.tipo_sql(colonna ->> 'tipo') is null then
      raise exception 'Tipo non ammesso: %', colonna ->> 'tipo' using errcode = '22023';
    end if;
    nomi_visti := nomi_visti || (colonna ->> 'nome');
    definizioni := definizioni || format(', %I %s', colonna ->> 'nome', public.tipo_sql(colonna ->> 'tipo'));
  end loop;

  -- Se il nome è già usato dall'utente: suffisso progressivo (ordini, ordini_2, ...).
  nome_finale := p_nome;
  while exists (select 1 from public.dataset where user_id = utente and nome = nome_finale) loop
    prog := prog + 1;
    nome_finale := left(p_nome, 53 - length(prog::text) - 1) || '_' || prog;
  end loop;

  fisico := 'u' || left(replace(utente::text, '-', ''), 8) || '_' || nome_finale;

  execute format(
    'create table dati.%I (
       id bigint generated always as identity primary key,
       user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
       created_at timestamptz not null default now()%s
     )',
    fisico, definizioni
  );
  execute format('create index on dati.%I (user_id)', fisico);
  execute format('alter table dati.%I enable row level security', fisico);
  execute format('alter table dati.%I force row level security', fisico);
  execute format(
    'create policy proprietario on dati.%I for all to authenticated
       using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
    fisico
  );
  execute format('revoke all on dati.%I from public, anon', fisico);
  execute format('grant select, insert, delete on dati.%I to authenticated', fisico);

  insert into public.dataset (user_id, importazione_id, nome, nome_originale, foglio, nome_fisico, colonne, avvisi)
  values (utente, p_importazione, nome_finale, p_nome_originale, p_foglio, fisico, p_colonne, coalesce(p_avvisi, '[]'::jsonb))
  returning * into risultato;

  return risultato;
end;
$$;

-- ---------------------------------------------------------------------------
-- Inserimento di un blocco di righe
-- ---------------------------------------------------------------------------

-- p_righe: array JSON di oggetti { "<nome colonna>": valore, ... } già convertiti dall'app.
create or replace function public.inserisci_righe(p_dataset uuid, p_righe jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  d public.dataset;
  elenco text;
  definizioni text;
  inserite integer;
begin
  select * into d from public.dataset where id = p_dataset and user_id = utente;
  if not found then
    raise exception 'Dataset non trovato.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) > 10000 then
    raise exception 'Blocco di righe non valido (massimo 10.000 righe).' using errcode = '22023';
  end if;

  if public.spazio_usato(utente) >= public.quota_utente() then
    raise exception 'Quota di spazio superata (100 MB).' using errcode = '53400';
  end if;

  select string_agg(format('%I', c ->> 'nome'), ', ' order by n),
         string_agg(format('%I %s', c ->> 'nome', public.tipo_sql(c ->> 'tipo')), ', ' order by n)
    into elenco, definizioni
  from jsonb_array_elements(d.colonne) with ordinality as t(c, n);

  execute format(
    'insert into dati.%I (user_id, %s) select $1, %s from jsonb_to_recordset($2) as r(%s)',
    d.nome_fisico, elenco, elenco, definizioni
  ) using utente, p_righe;
  get diagnostics inserite = row_count;

  update public.dataset set righe = righe + inserite, updated_at = now() where id = p_dataset;
  return inserite;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lettura paginata (security invoker: valgono le regole RLS della tabella)
-- ---------------------------------------------------------------------------

create or replace function public.leggi_righe(
  p_dataset uuid,
  p_limite integer default 50,
  p_offset integer default 0,
  p_ordina text default 'id',
  p_discendente boolean default false
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

  execute format('select count(*) from dati.%I', d.nome_fisico) into totale;
  execute format(
    'select coalesce(jsonb_agg(to_jsonb(t) - ''user_id'' - ''created_at''), ''[]''::jsonb)
       from (select * from dati.%I order by %I %s nulls last, id limit $1 offset $2) t',
    d.nome_fisico, p_ordina, case when p_discendente then 'desc' else 'asc' end
  ) into righe using least(greatest(p_limite, 1), 500), greatest(p_offset, 0);

  return jsonb_build_object('totale', totale, 'righe', righe);
end;
$$;

-- ---------------------------------------------------------------------------
-- Eliminazione: togliendo un dataset si elimina anche la sua tabella
-- ---------------------------------------------------------------------------

create or replace function public.elimina_tabella_dataset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  execute format('drop table if exists dati.%I', old.nome_fisico);
  return old;
end;
$$;

create trigger dataset_elimina_tabella
  after delete on public.dataset
  for each row execute function public.elimina_tabella_dataset();

-- ---------------------------------------------------------------------------
-- Permessi sulle funzioni
-- ---------------------------------------------------------------------------

revoke execute on function public.spazio_usato(uuid) from public, anon;
revoke execute on function public.crea_dataset(uuid, text, text, text, jsonb, jsonb) from public, anon;
revoke execute on function public.inserisci_righe(uuid, jsonb) from public, anon;
revoke execute on function public.leggi_righe(uuid, integer, integer, text, boolean) from public, anon;
revoke execute on function public.elimina_tabella_dataset() from public, anon, authenticated;

grant execute on function public.spazio_usato(uuid) to authenticated;
grant execute on function public.crea_dataset(uuid, text, text, text, jsonb, jsonb) to authenticated;
grant execute on function public.inserisci_righe(uuid, jsonb) to authenticated;
grant execute on function public.leggi_righe(uuid, integer, integer, text, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: file originali nella cartella privata dell'utente (<user_id>/...)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit)
values ('originali', 'originali', false, 50 * 1024 * 1024)
on conflict (id) do nothing;

create policy "originali: lettura propria" on storage.objects
  for select to authenticated
  using (bucket_id = 'originali' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "originali: caricamento proprio" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'originali' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "originali: eliminazione propria" on storage.objects
  for delete to authenticated
  using (bucket_id = 'originali' and (storage.foldername(name))[1] = (select auth.uid())::text);
