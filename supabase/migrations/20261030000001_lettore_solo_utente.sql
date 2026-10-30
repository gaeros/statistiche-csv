-- Utente di sola lettura «lettore» (per DBeaver), limitato ai dati di UN solo utente dell'app.
--
-- Prima «lettore» aveva BYPASSRLS e vedeva le righe di tutti gli utenti. Da qui in poi:
--   - niente BYPASSRLS: anche per lui vale la RLS;
--   - su ogni tabella con dati degli utenti c'è una regola «lettore» che mostra solo le righe
--     dell'utente scritto in public.lettore_utente (una sola riga, la sceglie l'amministratore
--     dal SQL Editor; vuota = non vede nulla);
--   - la tabella inviti (email di altre persone) non è più leggibile.
-- La regola non usa auth.uid(): «lettore» non può fingersi un altro utente cambiando le
-- impostazioni della sessione.
-- Una nuova tabella in public con RLS ma senza regola «lettore» resta vuota per lui.
--
-- Il ruolo si crea qui senza login, se non c'è ancora; login e password si danno a mano
-- (docs/AVVIO-LOCALE.md, punto 9), così la password non finisce mai nel repository.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'lettore') then
    create role lettore nologin;
  end if;
end;
$$;

alter role lettore nobypassrls;
alter role lettore set default_transaction_read_only = on;

-- ---------------------------------------------------------------------------
-- Di chi sono i dati che «lettore» può vedere
-- ---------------------------------------------------------------------------

create table if not exists public.lettore_utente (
  unica boolean primary key default true check (unica),
  user_id uuid not null references auth.users (id) on delete cascade
);

alter table public.lettore_utente enable row level security;

revoke all on public.lettore_utente from public, anon, authenticated;
grant select on public.lettore_utente to lettore;

drop policy if exists lettore on public.lettore_utente;
create policy lettore on public.lettore_utente for select to lettore using (true);

-- ---------------------------------------------------------------------------
-- Catalogo, grafici e dashboard: solo le righe di quell'utente
-- ---------------------------------------------------------------------------

grant usage on schema public to lettore;
grant select on public.importazioni, public.dataset, public.grafici, public.dashboard to lettore;
revoke all on public.inviti from lettore;

drop policy if exists lettore on public.importazioni;
create policy lettore on public.importazioni for select to lettore
  using (user_id = (select user_id from public.lettore_utente));

drop policy if exists lettore on public.dataset;
create policy lettore on public.dataset for select to lettore
  using (user_id = (select user_id from public.lettore_utente));

drop policy if exists lettore on public.grafici;
create policy lettore on public.grafici for select to lettore
  using (user_id = (select user_id from public.lettore_utente));

drop policy if exists lettore on public.dashboard;
create policy lettore on public.dashboard for select to lettore
  using (user_id = (select user_id from public.lettore_utente));

-- ---------------------------------------------------------------------------
-- Tabelle dei dati già create (schema dati)
-- ---------------------------------------------------------------------------

grant usage on schema dati to lettore;

do $$
declare
  fisico text;
begin
  for fisico in
    select d.nome_fisico from public.dataset d
    where to_regclass(format('dati.%I', d.nome_fisico)) is not null
  loop
    execute format('drop policy if exists lettore on dati.%I', fisico);
    execute format(
      'create policy lettore on dati.%I for select to lettore
         using (user_id = (select user_id from public.lettore_utente))',
      fisico
    );
    execute format('grant select on dati.%I to lettore', fisico);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tabelle dei dati future: crea_dataset aggiunge la stessa regola
-- (identica alla versione di 20261028000001, più le due righe per «lettore»)
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
  execute format(
    'create policy lettore on dati.%I for select to lettore
       using (user_id = (select user_id from public.lettore_utente))',
    fisico
  );
  execute format('grant select on dati.%I to lettore', fisico);

  insert into public.dataset (user_id, importazione_id, nome, nome_originale, foglio, nome_fisico, colonne, avvisi)
  values (utente, p_importazione, nome_finale, p_nome_originale, p_foglio, fisico, p_colonne, coalesce(p_avvisi, '[]'::jsonb))
  returning * into risultato;

  return risultato;
end;
$$;
