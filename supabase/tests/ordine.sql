-- Test dell'ordine delle schede «Colonna per colonna», dopo filtri.sql.

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

select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;
select pg_temp.verifica(
  (select ordine_schede = '{}' from public.dataset where nome = 'pressione'),
  'ordine vuoto (originale) per i dataset esistenti');
update public.dataset set ordine_schede = '{battiti,data}' where nome = 'pressione';
select pg_temp.verifica(
  (select ordine_schede = '{battiti,data}' from public.dataset where nome = 'pressione'),
  'il proprietario salva il suo ordine');

-- Un altro utente non vede né cambia l'ordine altrui
reset role;
select pg_temp.come('bbbbbbbb-0000-0000-0000-000000000002', 'b@esempio.it');
set role authenticated;
with toccati as (update public.dataset set ordine_schede = '{momento}' where nome = 'pressione' returning 1)
select pg_temp.verifica((select count(*) from toccati) = 0, 'un altro utente non cambia l''ordine altrui');

reset role;
select pg_temp.verifica(
  (select ordine_schede = '{battiti,data}' from public.dataset where nome = 'pressione'
     and user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'l''ordine del proprietario è rimasto');

-- Con l'aggiornamento per colonna non si toccano altri campi (es. righe)
select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;
do $$
begin
  update public.dataset set righe = 0 where nome = 'pressione';
  raise exception 'TEST FALLITO: l''utente ha cambiato il numero di righe';
exception when insufficient_privilege then
  raise notice 'ok: l''utente cambia solo nome e ordine, non le righe';
end $$;
update public.dataset set ordine_schede = '{}' where nome = 'pressione';

reset role;
\echo Tutti i test di ordine delle schede sono passati.
