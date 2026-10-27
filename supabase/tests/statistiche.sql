-- Test delle statistiche (Fase 2): valori attesi su dati noti e isolamento tra utenti.
-- Si esegue dopo isolamento.sql (usa gli stessi utenti), con scripts/test-db.sh.

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

create function pg_temp.colonna(stat jsonb, nome text) returns jsonb language sql as $$
  select c from jsonb_array_elements(stat -> 'colonne') c where c ->> 'nome' = nome
$$;

select pg_temp.come('aaaaaaaa-0000-0000-0000-000000000001', 'a@esempio.it');
set role authenticated;

insert into public.importazioni (id, nome_file, tipo_file, dimensione_byte)
values ('44444444-0000-0000-0000-000000000004', 'pressione.csv', 'text/csv', 100);

select (public.crea_dataset('44444444-0000-0000-0000-000000000004', 'pressione', 'pressione.csv', null,
  '[{"nome":"data","originale":"Data","tipo":"data"},
    {"nome":"momento","originale":"Momento","tipo":"testo"},
    {"nome":"sistolica","originale":"Sistolica","tipo":"intero"},
    {"nome":"battiti","originale":"Battiti","tipo":"intero"},
    {"nome":"contesto","originale":"Contesto","tipo":"testo"}]')).id \gset ds_

select public.inserisci_righe(:'ds_id', '[
  {"data":"2026-09-28","momento":"Mattina","sistolica":120,"battiti":80,"contesto":null},
  {"data":"2026-09-28","momento":"Sera","sistolica":110,"battiti":70,"contesto":"Dopo il caffè"},
  {"data":"2026-09-29","momento":"Mattina","sistolica":130,"battiti":90,"contesto":null},
  {"data":"2026-10-12","momento":"Mattina","sistolica":200,"battiti":100,"contesto":null},
  {"data":"2026-10-13","momento":"Sera","sistolica":null,"battiti":60,"contesto":null}
]');

select public.statistiche_colonne(:'ds_id', 4) as stat \gset

select pg_temp.verifica((:'stat'::jsonb ->> 'totale')::int = 5, 'statistiche: 5 righe in totale');
select pg_temp.verifica(
  (pg_temp.colonna(:'stat', 'sistolica') ->> 'valori')::int = 4
  and (pg_temp.colonna(:'stat', 'sistolica') ->> 'mancanti')::int = 1,
  'statistiche: 4 valori e 1 mancante in sistolica');
select pg_temp.verifica(
  (pg_temp.colonna(:'stat', 'sistolica') ->> 'media')::numeric = 140
  and (pg_temp.colonna(:'stat', 'sistolica') ->> 'mediana')::numeric = 125
  and (pg_temp.colonna(:'stat', 'sistolica') ->> 'minimo')::numeric = 110
  and (pg_temp.colonna(:'stat', 'sistolica') ->> 'massimo')::numeric = 200
  and (pg_temp.colonna(:'stat', 'sistolica') ->> 'somma')::numeric = 560,
  'statistiche: media 140, mediana 125, min 110, max 200, somma 560');
select pg_temp.verifica(
  (pg_temp.colonna(:'stat', 'sistolica') ->> 'q1')::numeric = 117.5
  and (pg_temp.colonna(:'stat', 'sistolica') ->> 'q3')::numeric = 147.5,
  'statistiche: quartili 117,5 e 147,5');
select pg_temp.verifica((pg_temp.colonna(:'stat', 'sistolica') ->> 'anomali')::int = 1,
  'statistiche: 200 è un valore anomalo (regola IQR)');
select pg_temp.verifica(
  jsonb_array_length(pg_temp.colonna(:'stat', 'sistolica') -> 'istogramma') = 4
  and (select sum((b ->> 'conteggio')::int) from jsonb_array_elements(pg_temp.colonna(:'stat', 'sistolica') -> 'istogramma') b) = 4,
  'statistiche: istogramma a 4 barre con tutti i 4 valori');
select pg_temp.verifica(
  pg_temp.colonna(:'stat', 'momento') -> 'frequenti' -> 0 ->> 'valore' = 'Mattina'
  and (pg_temp.colonna(:'stat', 'momento') -> 'frequenti' -> 0 ->> 'conteggio')::int = 3,
  'statistiche: Mattina è il valore più frequente (3)');
select pg_temp.verifica(
  (pg_temp.colonna(:'stat', 'contesto') ->> 'mancanti')::int = 4, 'statistiche: contesto ha 4 mancanti');
select pg_temp.verifica(
  pg_temp.colonna(:'stat', 'data') ->> 'prima' = '2026-09-28'
  and pg_temp.colonna(:'stat', 'data') ->> 'ultima' = '2026-10-13'
  and (pg_temp.colonna(:'stat', 'data') ->> 'giorni')::int = 16,
  'statistiche: date dal 28/09 al 13/10, 16 giorni');

select pg_temp.verifica(
  jsonb_array_length(public.conteggio_per_periodo(:'ds_id', 'data', 'week')) = 3,
  'conteggio per settimana: 3 settimane, compresa quella senza misure');

select pg_temp.verifica(
  round((public.correlazioni(:'ds_id') -> 0 ->> 'r')::numeric, 3) = 0.885
  and (public.correlazioni(:'ds_id') -> 0 ->> 'n')::int = 4,
  'correlazione sistolica-battiti 0,885 su 4 coppie complete');

select pg_temp.verifica(
  (select (g ->> 'valore')::numeric from jsonb_array_elements(public.raggruppa(:'ds_id', 'momento', 'sistolica', 'media')) g
   where g ->> 'gruppo' = 'Mattina') = 150,
  'raggruppa: media sistolica del mattino 150');
select pg_temp.verifica(
  jsonb_array_length(public.raggruppa(:'ds_id', 'data', null, 'conteggio', 'month')) = 2,
  'raggruppa: conteggio per mese, 2 mesi');

select public.andamento(:'ds_id', 'data', 'sistolica', 'week', 'media', 2) as serie \gset
select pg_temp.verifica(jsonb_array_length(:'serie'::jsonb) = 3, 'andamento: 3 settimane');
select pg_temp.verifica((:'serie'::jsonb -> 1 ->> 'valore') is null, 'andamento: la settimana senza dati resta vuota');
select pg_temp.verifica((:'serie'::jsonb -> 0 ->> 'valore')::numeric = 120, 'andamento: media della prima settimana 120');
select pg_temp.verifica((:'serie'::jsonb -> 2 ->> 'media_mobile')::numeric = 200,
  'andamento: la media mobile non usa valori inventati per la settimana vuota');

do $$ begin
  perform public.raggruppa((select id from public.dataset where nome = 'pressione'), 'momento; drop table x', null, 'conteggio');
  raise exception 'TEST FALLITO: colonna inesistente accettata';
exception when sqlstate '22023' then raise notice 'ok: raggruppa respinge colonne non nel catalogo';
end $$;
do $$ begin
  perform public.raggruppa((select id from public.dataset where nome = 'pressione'), 'momento', 'sistolica', 'pg_sleep');
  raise exception 'TEST FALLITO: aggregazione non ammessa accettata';
exception when sqlstate '22023' then raise notice 'ok: raggruppa respinge aggregazioni non ammesse';
end $$;

reset role;

-- B non calcola statistiche sui dati di A
select pg_temp.come('bbbbbbbb-0000-0000-0000-000000000002', 'b@esempio.it');
set role authenticated;
do $$
declare id_a uuid;
begin
  reset role;
  select id into id_a from public.dataset where nome_fisico = 'uaaaaaaaa_pressione';
  set role authenticated;
  begin
    perform public.statistiche_colonne(id_a);
    raise exception 'TEST FALLITO: B ha calcolato statistiche sui dati di A';
  exception when sqlstate 'P0002' then raise notice 'ok: B non calcola statistiche sui dati di A';
  end;
  begin
    perform public.andamento(id_a, 'data', 'sistolica');
    raise exception 'TEST FALLITO: B ha letto l''andamento di A';
  exception when sqlstate 'P0002' then raise notice 'ok: B non legge l''andamento di A';
  end;
end $$;
reset role;

\echo 'Tutti i test delle statistiche sono passati.'
