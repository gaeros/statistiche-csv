-- Test dei link di sola lettura (grafico o dashboard), dopo dashboard.sql.

\set ON_ERROR_STOP on

create function pg_temp.come(utente text, email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', utente, 'email', email, 'role', 'authenticated')::text, false);
$$;

create function pg_temp.verifica(condizione boolean, descrizione text) returns void language plpgsql as $$
begin
  if not coalesce(condizione, false) then
    raise exception 'TEST FALLITO: %', descrizione;
  end if;
  raise notice 'ok: %', descrizione;
end;
$$;

-- A condivide il suo grafico e la sua dashboard
select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;
select id as grafico_a from public.grafici limit 1 \gset
insert into public.condivisioni (grafico_id) values (:'grafico_a');
insert into public.condivisioni (grafico_id, scade_il) values (null, now() + interval '7 days');
select token as link_grafico from public.condivisioni where grafico_id is not null \gset
select token as link_dashboard from public.condivisioni where grafico_id is null \gset
select pg_temp.verifica(:'link_grafico' ~ '^[0-9a-f]{64}$' and :'link_grafico' <> :'link_dashboard', 'il codice è casuale, 64 caratteri');

do $$ begin
  insert into public.condivisioni (grafico_id, token) values (null, repeat('0', 64));
  raise exception 'TEST FALLITO: A ha scelto il codice del link';
exception when insufficient_privilege then raise notice 'ok: il codice lo sceglie solo il database';
end $$;
do $$ begin
  update public.condivisioni set scade_il = null;
  raise exception 'TEST FALLITO: A ha cambiato un link';
exception when insufficient_privilege then raise notice 'ok: un link non si cambia';
end $$;
do $$ begin
  perform public.leggi_condivisione(repeat('0', 64));
  raise exception 'TEST FALLITO: un utente collegato legge un link con la funzione riservata al server';
exception when insufficient_privilege then raise notice 'ok: leggi_condivisione è solo per il server';
end $$;
reset role;

-- B non vede i link di A, non li revoca e non condivide i grafici di A
select pg_temp.come('bbbbbbbb-0000-0000-0000-000000000002', 'b@esempio.it');
set role authenticated;
select pg_temp.verifica((select count(*) from public.condivisioni) = 0, 'B non vede i link di A');
with tolte as (delete from public.condivisioni returning 1)
select pg_temp.verifica((select count(*) from tolte) = 0, 'B non revoca i link di A');
select set_config('test.grafico_a', :'grafico_a', false);
do $$ begin
  insert into public.condivisioni (grafico_id) values (current_setting('test.grafico_a')::uuid);
  raise exception 'TEST FALLITO: B ha condiviso un grafico di A';
exception when insufficient_privilege then raise notice 'ok: B non condivide i grafici di A';
end $$;
reset role;

-- Il visitatore senza accesso (anon) non legge né la tabella né la funzione
set role anon;
do $$ begin
  perform 1 from public.condivisioni;
  raise exception 'TEST FALLITO: anon legge la tabella dei link';
exception when insufficient_privilege then raise notice 'ok: anon non legge i link';
end $$;
do $$ begin
  perform public.leggi_condivisione(repeat('0', 64));
  raise exception 'TEST FALLITO: anon chiama leggi_condivisione';
exception when insufficient_privilege then raise notice 'ok: anon non chiama leggi_condivisione';
end $$;
reset role;

-- Il server dell'app (service_role, senza utente) legge il link e calcola il grafico
select set_config('request.jwt.claims', '', false);
set role service_role;
select public.leggi_condivisione(:'link_grafico') as c \gset
select pg_temp.verifica((:'c'::jsonb ->> 'dashboard')::boolean = false and jsonb_array_length(:'c'::jsonb -> 'grafici') = 1,
  'link del grafico: un grafico');
select pg_temp.verifica(
  (select bool_or(jsonb_array_length(value) > 0)
   from jsonb_each(public.dati_grafico((:'c'::jsonb -> 'grafici' -> 0 ->> 'dataset_id')::uuid, :'c'::jsonb -> 'grafici' -> 0 -> 'configurazione'))),
  'il server calcola il grafico condiviso sulle righe di A');
select public.leggi_condivisione(:'link_dashboard') as c \gset
select pg_temp.verifica((:'c'::jsonb ->> 'dashboard')::boolean and jsonb_array_length(:'c'::jsonb -> 'grafici') = 1,
  'link della dashboard: i grafici fissati');
select pg_temp.verifica(public.leggi_condivisione(repeat('0', 64)) is null, 'un codice inventato non apre nulla');
select pg_temp.verifica(public.leggi_condivisione('x'' or true --') is null, 'un codice non valido non apre nulla');
reset role;
select pg_temp.verifica((select visite = 1 and ultima_visita is not null from public.condivisioni where token = :'link_grafico'),
  'la visita è contata');

-- Scaduto: non apre più nulla
update public.condivisioni set created_at = now() - interval '2 days', scade_il = now() - interval '1 day' where token = :'link_dashboard';
set role service_role;
select pg_temp.verifica(public.leggi_condivisione(:'link_dashboard') is null, 'un link scaduto non apre nulla');
reset role;

-- Revocato da A: non apre più nulla
select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;
delete from public.condivisioni where token = :'link_grafico';
reset role;
set role service_role;
select pg_temp.verifica(public.leggi_condivisione(:'link_grafico') is null, 'un link revocato non apre nulla');
reset role;

-- Al massimo 100 link per utente
select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;
insert into public.condivisioni (grafico_id) select null from generate_series(1, 99);
do $$ begin
  insert into public.condivisioni (grafico_id) values (null);
  raise exception 'TEST FALLITO: più di 100 link accettati';
exception when sqlstate '53400' then raise notice 'ok: al massimo 100 link';
end $$;
delete from public.condivisioni;
reset role;

-- Eliminando il grafico sparisce anche il suo link
select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;
insert into public.condivisioni (grafico_id) values (:'grafico_a');
delete from public.grafici where id = :'grafico_a';
select pg_temp.verifica((select count(*) from public.condivisioni) = 0, 'eliminato il grafico, il suo link sparisce');
reset role;

\echo 'Tutti i test dei link condivisi sono passati.'
