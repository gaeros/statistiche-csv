-- Test dei filtri salvati, dopo grafici.sql (usa il dataset "pressione" di A).

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

select id as ds_id from public.dataset where nome_fisico = 'uaaaaaaaa_pressione' \gset

-- A salva, rinomina e ritrova i suoi filtri
select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;
insert into public.filtri_salvati (dataset_id, nome, parametri)
  values (:'ds_id', 'Mattina', '{"f.momento.v": ["Mattina"], "f.data.p": ["30"]}');
select pg_temp.verifica(
  (select count(*) = 1 and bool_and(user_id = 'aaaaaaaa-0000-0000-0000-000000000001') from public.filtri_salvati),
  'A salva una combinazione di filtri');
update public.filtri_salvati set nome = 'Mattina, 30 giorni';
select pg_temp.verifica((select nome = 'Mattina, 30 giorni' from public.filtri_salvati), 'A rinomina i suoi filtri');
do $$ begin
  insert into public.filtri_salvati (dataset_id, nome, parametri)
    select dataset_id, nome, '{}' from public.filtri_salvati;
  raise exception 'TEST FALLITO: due filtri con lo stesso nome nello stesso dataset';
exception when unique_violation then raise notice 'ok: nomi unici nel dataset';
end $$;
do $$ begin
  update public.filtri_salvati set user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
  raise exception 'TEST FALLITO: A ha cambiato il proprietario';
exception when insufficient_privilege then raise notice 'ok: il proprietario non si cambia';
end $$;
reset role;

-- B non vede, non cambia e non elimina i filtri di A, e non ne salva sui dataset di A
select pg_temp.come('bbbbbbbb-0000-0000-0000-000000000002', 'b@esempio.it');
set role authenticated;
select pg_temp.verifica((select count(*) from public.filtri_salvati) = 0, 'B non vede i filtri di A');
with toccate as (update public.filtri_salvati set nome = 'preso' returning 1)
select pg_temp.verifica((select count(*) from toccate) = 0, 'B non rinomina i filtri di A');
with tolte as (delete from public.filtri_salvati returning 1)
select pg_temp.verifica((select count(*) from tolte) = 0, 'B non elimina i filtri di A');
do $$ begin
  insert into public.filtri_salvati (dataset_id, nome, parametri)
    values ((select id from public.dataset where nome_fisico = 'uaaaaaaaa_pressione'), 'x', '{}');
  raise exception 'TEST FALLITO: B ha salvato filtri sul dataset di A';
exception when insufficient_privilege then raise notice 'ok: B non salva filtri sui dataset di A';
end $$;
reset role;

select pg_temp.verifica((select count(*) = 1 from public.filtri_salvati), 'i filtri di A sono rimasti');

-- Al massimo 50 per dataset
do $$ begin
  insert into public.filtri_salvati (user_id, dataset_id, nome, parametri)
    select 'aaaaaaaa-0000-0000-0000-000000000001', d.id, 'f' || n, '{}'
    from public.dataset d, generate_series(1, 50) n where d.nome_fisico = 'uaaaaaaaa_pressione';
  raise exception 'TEST FALLITO: più di 50 filtri salvati accettati';
exception when sqlstate '53400' then raise notice 'ok: al massimo 50 filtri salvati per dataset';
end $$;

-- Parametri solo come oggetto
do $$ begin
  insert into public.filtri_salvati (user_id, dataset_id, nome, parametri)
    select 'aaaaaaaa-0000-0000-0000-000000000001', id, 'lista', '[]' from public.dataset where nome_fisico = 'uaaaaaaaa_pressione';
  raise exception 'TEST FALLITO: parametri non oggetto accettati';
exception when check_violation then raise notice 'ok: parametri solo come oggetto';
end $$;

\echo 'Tutti i test dei filtri salvati sono passati.'
