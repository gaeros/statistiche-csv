-- Test del costruttore di grafici e dei grafici salvati (Fase 3), dopo filtri.sql.

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
select id as ds_id from public.dataset where nome = 'pressione' \gset

select public.dati_grafico(:'ds_id', '{"tipo":"barre","x":"data","periodo":"month","y":["sistolica","battiti"],"aggregazione":"media"}') as g \gset
select pg_temp.verifica(jsonb_array_length(:'g'::jsonb -> 'righe') = 4, 'barre per mese: 2 mesi × 2 colonne');
select pg_temp.verifica(
  (select (r ->> 'v')::numeric from jsonb_array_elements(:'g'::jsonb -> 'righe') r
   where r ->> 'x' = '2026-09-01' and r ->> 's' = 'sistolica') = 120,
  'barre per mese: media sistolica di settembre 120');

select pg_temp.verifica(
  jsonb_array_length(public.dati_grafico(:'ds_id', '{"tipo":"barre_impilate","x":"data","periodo":"month","aggregazione":"conteggio","suddividi":"momento"}') -> 'righe') = 4,
  'barre impilate: conteggio per mese suddiviso per momento');
select pg_temp.verifica(
  (public.dati_grafico(:'ds_id', '{"tipo":"torta","x":"momento","aggregazione":"conteggio"}',
     '[{"colonna":"data","tipo":"intervallo","a":"2026-09-30"}]') -> 'righe' -> 0 ->> 'v')::int = 2,
  'torta con filtro: 2 righe del mattino a settembre');
select pg_temp.verifica(
  jsonb_array_length(public.dati_grafico(:'ds_id', '{"tipo":"dispersione","x":"sistolica","y":["battiti"]}') -> 'punti') = 4,
  'dispersione: 4 coppie complete');
select pg_temp.verifica(
  jsonb_array_length(public.dati_grafico(:'ds_id', '{"tipo":"istogramma","y":["sistolica"]}') -> 'barre') = 20,
  'istogramma: 20 intervalli');
select pg_temp.verifica(
  (select (s ->> 'mediana')::numeric from jsonb_array_elements(
     public.dati_grafico(:'ds_id', '{"tipo":"box","x":"momento","y":["sistolica"]}') -> 'scatole') s
   where s ->> 'x' = 'Mattina') = 130,
  'box plot: mediana sistolica del mattino 130');

do $$ begin
  perform public.dati_grafico((select id from public.dataset where nome = 'pressione'), '{"tipo":"barre","x":"momento","y":["momento"],"aggregazione":"somma"}');
  raise exception 'TEST FALLITO: somma di una colonna di testo accettata';
exception when sqlstate '22023' then raise notice 'ok: dati_grafico respinge colonne non numeriche';
end $$;
do $$ begin
  perform public.dati_grafico((select id from public.dataset where nome = 'pressione'), '{"tipo":"barre","x":"x\"; drop table y; --"}');
  raise exception 'TEST FALLITO: colonna inesistente accettata';
exception when sqlstate '22023' then raise notice 'ok: dati_grafico respinge colonne non nel catalogo';
end $$;

-- Grafici salvati
insert into public.grafici (dataset_id, titolo, configurazione)
values (:'ds_id', 'Sistolica per mese', '{"tipo":"barre","x":"data","y":["sistolica"],"aggregazione":"media"}');
select pg_temp.verifica((select count(*) from public.grafici) = 1, 'grafici: A salva un grafico');
reset role;

-- B non vede i grafici di A e non può salvarne sui dataset di A
select pg_temp.come('bbbbbbbb-0000-0000-0000-000000000002', 'b@esempio.it');
set role authenticated;
select pg_temp.verifica((select count(*) from public.grafici) = 0, 'grafici: B non vede i grafici di A');
do $$
declare id_a uuid;
begin
  reset role;
  select id into id_a from public.dataset where nome_fisico = 'uaaaaaaaa_pressione';
  set role authenticated;
  begin
    insert into public.grafici (dataset_id, titolo, configurazione) values (id_a, 'x', '{}');
    raise exception 'TEST FALLITO: B ha salvato un grafico sul dataset di A';
  exception when insufficient_privilege then raise notice 'ok: B non salva grafici sui dataset di A';
  end;
  begin
    perform public.dati_grafico(id_a, '{"tipo":"torta","x":"momento"}');
    raise exception 'TEST FALLITO: B ha letto i dati di A con dati_grafico';
  exception when sqlstate 'P0002' then raise notice 'ok: B non legge i dati di A con dati_grafico';
  end;
end $$;
reset role;

\echo 'Tutti i test dei grafici sono passati.'
