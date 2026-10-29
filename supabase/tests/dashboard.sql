-- Test della dashboard personale (grafici fissati), dopo grafici.sql.

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

-- A fissa il suo grafico
select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;
insert into public.dashboard (grafici) select array_agg(id) from public.grafici;
select pg_temp.verifica(
  (select cardinality(grafici) = 1 and user_id = 'aaaaaaaa-0000-0000-0000-000000000001' from public.dashboard),
  'A fissa un grafico nella sua dashboard');
update public.dashboard set grafici = '{}';
update public.dashboard set grafici = (select array_agg(id) from public.grafici);
select pg_temp.verifica((select cardinality(grafici) = 1 from public.dashboard), 'A cambia la sua dashboard');
reset role;

-- B non vede né cambia la dashboard di A, e non può crearne una a nome di A
select pg_temp.come('bbbbbbbb-0000-0000-0000-000000000002', 'b@esempio.it');
set role authenticated;
select pg_temp.verifica((select count(*) from public.dashboard) = 0, 'B non vede la dashboard di A');
with toccate as (update public.dashboard set grafici = '{}' returning 1)
select pg_temp.verifica((select count(*) from toccate) = 0, 'B non cambia la dashboard di A');
do $$ begin
  insert into public.dashboard (user_id, grafici) values ('aaaaaaaa-0000-0000-0000-000000000001', '{}');
  raise exception 'TEST FALLITO: B ha scritto una dashboard a nome di A';
exception when insufficient_privilege or unique_violation then raise notice 'ok: B non scrive a nome di A';
end $$;
reset role;

select pg_temp.verifica(
  (select cardinality(grafici) = 1 from public.dashboard where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'la dashboard di A è rimasta');

-- Al massimo 50 grafici
do $$ begin
  update public.dashboard set grafici = array(select gen_random_uuid() from generate_series(1, 51));
  raise exception 'TEST FALLITO: più di 50 grafici accettati';
exception when check_violation then raise notice 'ok: al massimo 50 grafici fissati';
end $$;

\echo 'Tutti i test della dashboard sono passati.'
