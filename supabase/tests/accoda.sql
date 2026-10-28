-- Test di "accoda saltando i duplicati" (inserisci_righe_nuove). Si esegue dopo gli altri, con un utente tutto suo.

\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users values ('dddddddd-0000-0000-0000-000000000004', 'd@esempio.it');

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

set client_min_messages = notice;

select pg_temp.come('dddddddd-0000-0000-0000-000000000004', 'd@esempio.it');
set role authenticated;

insert into public.importazioni (id, nome_file, tipo_file, dimensione_byte)
values ('dddddddd-1111-0000-0000-000000000004', 'pressione.csv', 'text/csv', 100);

select (public.crea_dataset(
  'dddddddd-1111-0000-0000-000000000004', 'pressione_accoda', 'pressione.csv', null,
  '[{"nome":"data","originale":"Data","tipo":"data"},
    {"nome":"momento","originale":"Momento","tipo":"testo"},
    {"nome":"sistolica","originale":"Sistolica","tipo":"intero"}]'
)).id as ds \gset

select public.inserisci_righe(:'ds', '[{"data":"2026-10-01","momento":"Mattina","sistolica":140},
  {"data":"2026-10-01","momento":"Sera","sistolica":135}]') as iniziali \gset
select pg_temp.verifica(:iniziali = 2, 'accoda: due righe di partenza');

-- Una già presente, una identica nello stesso blocco, una con un valore diverso, una con valori mancanti
select public.inserisci_righe_nuove(:'ds', '[
  {"data":"2026-10-01","momento":"Mattina","sistolica":140},
  {"data":"2026-10-02","momento":"Mattina","sistolica":141},
  {"data":"2026-10-02","momento":"Mattina","sistolica":141},
  {"data":"2026-10-03","momento":null,"sistolica":null}]') as r1 \gset
select pg_temp.verifica(:'r1'::jsonb = '{"inserite": 2, "saltate": 2}'::jsonb, 'accoda: 2 nuove inserite, 2 saltate');

-- Ripetere lo stesso blocco (ripresa dopo un errore) non crea nulla di doppio
select public.inserisci_righe_nuove(:'ds', '[
  {"data":"2026-10-02","momento":"Mattina","sistolica":141},
  {"data":"2026-10-03","momento":null,"sistolica":null}]') as r2 \gset
select pg_temp.verifica(:'r2'::jsonb = '{"inserite": 0, "saltate": 2}'::jsonb, 'accoda: rimandare lo stesso blocco non duplica');

-- Un valore mancante non è un testo vuoto
select public.inserisci_righe_nuove(:'ds', '[{"data":"2026-10-03","momento":"","sistolica":null}]') as r3 \gset
select pg_temp.verifica(:'r3'::jsonb = '{"inserite": 1, "saltate": 0}'::jsonb, 'accoda: valore mancante diverso da testo vuoto');

select pg_temp.verifica((select righe from public.dataset where id = :'ds') = 5, 'accoda: conteggio righe aggiornato');
select pg_temp.verifica((select count(*) from dati.udddddddd_pressione_accoda) = 5, 'accoda: 5 righe nella tabella');

-- Un altro utente non può accodare righe ai dati altrui
reset role;
select pg_temp.come('cccccccc-0000-0000-0000-000000000003', 'admin@esempio.it');
set role authenticated;
do $$
begin
  perform public.inserisci_righe_nuove((select id from public.dataset where nome = 'pressione_accoda'),
    '[{"data":"2026-12-01","momento":"x","sistolica":1}]');
  raise exception 'TEST FALLITO: un altro utente ha accodato righe';
exception when sqlstate 'P0002' then
  raise notice 'ok: un altro utente non può accodare righe ai dati altrui';
end $$;

reset role;
\echo Tutti i test di accoda sono passati.
