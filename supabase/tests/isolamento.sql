-- Test di isolamento tra utenti (criterio di accettazione 8) e del flusso di import.
-- Si esegue con scripts/test-db.sh. Ogni controllo fallito interrompe lo script con un errore.

\set ON_ERROR_STOP on
set client_min_messages = warning;

insert into auth.users values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@esempio.it'),
  ('cccccccc-0000-0000-0000-000000000003', 'admin@esempio.it');
insert into public.inviti (email, amministratore) values
  ('admin@esempio.it', true), ('a@esempio.it', false), ('b@esempio.it', false);

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

-- Hook di invito -----------------------------------------------------------------
select pg_temp.verifica(public.hook_solo_su_invito('{"user":{"email":"A@Esempio.it"}}') = '{}'::jsonb,
  'hook: email invitata accettata (senza badare alle maiuscole)');
select pg_temp.verifica(public.hook_solo_su_invito('{"user":{"email":"x@esempio.it"}}') ? 'error',
  'hook: email non invitata respinta');

-- Utente A importa un file ----------------------------------------------------------
select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;

select pg_temp.verifica(not public.is_admin(), 'A non è amministratore');

insert into public.importazioni (id, nome_file, tipo_file, dimensione_byte)
values ('11111111-0000-0000-0000-000000000001', 'Vendite Q1 2024.csv', 'text/csv', 100);

select pg_temp.verifica(
  (public.crea_dataset(
    '11111111-0000-0000-0000-000000000001', 'vendite_q1_2024', 'Vendite Q1 2024.csv', null,
    '[{"nome":"data","originale":"Data","tipo":"data"},
      {"nome":"regione","originale":"Regione","tipo":"testo"},
      {"nome":"quantita","originale":"Quantità","tipo":"intero"},
      {"nome":"prezzo_eur","originale":"Prezzo (€)","tipo":"decimale"}]'
  )).nome = 'vendite_q1_2024', 'A crea vendite_q1_2024');

select pg_temp.verifica(
  public.inserisci_righe(
    (select id from public.dataset where nome = 'vendite_q1_2024'),
    '[{"data":"2024-01-15","regione":"Lazio","quantita":3,"prezzo_eur":1234.56},
      {"data":"2024-02-01","regione":"Puglia","quantita":1,"prezzo_eur":9.9}]'
  ) = 2, 'A inserisce 2 righe');

select pg_temp.verifica(
  (select righe from public.dataset where nome = 'vendite_q1_2024') = 2, 'il catalogo conta 2 righe');

select pg_temp.verifica(
  (public.leggi_righe((select id from public.dataset where nome = 'vendite_q1_2024'), 10, 0, 'quantita', true)
    -> 'righe' -> 0 ->> 'regione') = 'Lazio', 'leggi_righe ordina per colonna');

-- Stesso nome di file: suffisso _2
select pg_temp.verifica(
  (public.crea_dataset('11111111-0000-0000-0000-000000000001', 'vendite_q1_2024', 'Vendite Q1 2024.csv', null,
    '[{"nome":"x","originale":"x","tipo":"testo"}]')).nome = 'vendite_q1_2024_2', 'nome ripetuto → vendite_q1_2024_2');

-- Nomi pericolosi respinti
do $$ begin
  perform public.crea_dataset('11111111-0000-0000-0000-000000000001', 'x"; drop table public.inviti; --', 'x', null,
    '[{"nome":"a","originale":"a","tipo":"testo"}]');
  raise exception 'TEST FALLITO: nome tabella pericoloso accettato';
exception when sqlstate '22023' then raise notice 'ok: nome tabella pericoloso respinto';
end $$;
do $$ begin
  perform public.crea_dataset('11111111-0000-0000-0000-000000000001', 'ok', 'x', null,
    '[{"nome":"a","originale":"a","tipo":"text; drop table x"}]');
  raise exception 'TEST FALLITO: tipo non ammesso accettato';
exception when sqlstate '22023' then raise notice 'ok: tipo non ammesso respinto';
end $$;

-- A non può inserire inviti
do $$ begin
  insert into public.inviti (email) values ('intruso@esempio.it');
  raise exception 'TEST FALLITO: un non amministratore ha inserito un invito';
exception when insufficient_privilege then raise notice 'ok: A non può invitare';
end $$;

reset role;

-- Utente B: stesso file, nessun conflitto, nessun accesso ai dati di A ----------------
select pg_temp.come('bbbbbbbb-0000-0000-0000-000000000002', 'b@esempio.it');
set role authenticated;

insert into public.importazioni (id, nome_file, tipo_file, dimensione_byte)
values ('22222222-0000-0000-0000-000000000002', 'Vendite Q1 2024.csv', 'text/csv', 100);
select pg_temp.verifica(
  (public.crea_dataset('22222222-0000-0000-0000-000000000002', 'vendite_q1_2024', 'Vendite Q1 2024.csv', null,
    '[{"nome":"data","originale":"Data","tipo":"data"}]')).nome = 'vendite_q1_2024',
  'B crea anche lui vendite_q1_2024 senza conflitti');

select pg_temp.verifica((select count(*) from public.dataset) = 1, 'B vede solo il proprio dataset nel catalogo');
select pg_temp.verifica((select count(*) from public.importazioni) = 1, 'B vede solo la propria importazione');

-- B prova a leggere direttamente la tabella fisica di A
select pg_temp.verifica(
  (select count(*) from dati.uaaaaaaaa_vendite_q1_2024) = 0, 'B non legge le righe della tabella di A (RLS)');

do $$ begin
  insert into dati.uaaaaaaaa_vendite_q1_2024 (user_id, regione) values ('aaaaaaaa-0000-0000-0000-000000000001', 'falso');
  raise exception 'TEST FALLITO: B ha scritto nella tabella di A';
exception when insufficient_privilege then raise notice 'ok: B non scrive nella tabella di A';
end $$;

with x as (delete from dati.uaaaaaaaa_vendite_q1_2024 returning 1)
select pg_temp.verifica((select count(*) from x) = 0, 'B non cancella righe della tabella di A');

do $$
declare id_a uuid;
begin
  reset role;
  select id into id_a from public.dataset where nome_fisico = 'uaaaaaaaa_vendite_q1_2024';
  set role authenticated;
  begin
    perform public.inserisci_righe(id_a, '[{"regione":"intruso"}]');
    raise exception 'TEST FALLITO: B ha inserito righe nel dataset di A';
  exception when sqlstate 'P0002' then raise notice 'ok: B non inserisce nel dataset di A';
  end;
  begin
    perform public.leggi_righe(id_a);
    raise exception 'TEST FALLITO: B ha letto il dataset di A';
  exception when sqlstate 'P0002' then raise notice 'ok: B non legge il dataset di A con leggi_righe';
  end;
  begin
    perform public.crea_dataset('11111111-0000-0000-0000-000000000001', 'furto', 'x', null,
      '[{"nome":"a","originale":"a","tipo":"testo"}]');
    raise exception 'TEST FALLITO: B ha creato un dataset nell''importazione di A';
  exception when sqlstate 'P0002' then raise notice 'ok: B non usa l''importazione di A';
  end;
end $$;

with x as (delete from public.dataset where nome_fisico like 'uaaaaaaaa%' returning 1)
select pg_temp.verifica((select count(*) from x) = 0, 'B non elimina i dataset di A');

-- Nessun accesso senza login
reset role;
select set_config('request.jwt.claims', '', false);
set role anon;
do $$ begin
  perform count(*) from dati.uaaaaaaaa_vendite_q1_2024;
  raise exception 'TEST FALLITO: anon legge i dati';
exception when insufficient_privilege then raise notice 'ok: anon non legge i dati';
end $$;
reset role;

-- Eliminazione: togliere l'importazione elimina dataset e tabelle ----------------------
select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;
delete from public.importazioni where id = '11111111-0000-0000-0000-000000000001';
reset role;
select pg_temp.verifica(to_regclass('dati.uaaaaaaaa_vendite_q1_2024') is null, 'eliminando l''importazione la tabella sparisce');
select pg_temp.verifica(to_regclass('dati.ubbbbbbbb_vendite_q1_2024') is not null, 'la tabella di B resta');

\echo 'Tutti i test del database sono passati.'
