-- Test dei filtri (Fase 3): si esegue dopo statistiche.sql, sullo stesso dataset "pressione" dell'utente A.

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

select id as ds_id from public.dataset where nome = 'pressione' \gset

-- Solo mattina
select public.statistiche_colonne(:'ds_id', 4, '[{"colonna":"momento","tipo":"valori","valori":["Mattina"]}]') as stat \gset
select pg_temp.verifica((:'stat'::jsonb ->> 'totale')::int = 3 and (:'stat'::jsonb ->> 'complessivo')::int = 5,
  'filtro valori: 3 righe del mattino su 5');
select pg_temp.verifica((pg_temp.colonna(:'stat', 'sistolica') ->> 'media')::numeric = 150,
  'filtro valori: media sistolica del mattino 150');

-- Intervallo di date + mattina (criterio 9 della SPEC)
select pg_temp.verifica(
  (public.statistiche_colonne(:'ds_id', 4, '[
     {"colonna":"data","tipo":"intervallo","da":"2026-09-29","a":"2026-10-31"},
     {"colonna":"momento","tipo":"valori","valori":["Mattina"]}]') ->> 'totale')::int = 2,
  'filtri insieme: dal 29/09, solo mattina, 2 righe');

-- Intervallo numerico
select pg_temp.verifica(
  (public.statistiche_colonne(:'ds_id', 4, '[{"colonna":"sistolica","tipo":"intervallo","da":115}]') ->> 'totale')::int = 3,
  'filtro numerico: sistolica da 115 in su, 3 righe (le celle vuote escluse)');

-- Testo contenuto, senza maiuscole; i caratteri speciali di LIKE non fanno da jolly
select pg_temp.verifica(
  (public.statistiche_colonne(:'ds_id', 4, '[{"colonna":"contesto","tipo":"testo","testo":"CAFF"}]') ->> 'totale')::int = 1,
  'filtro testo: "CAFF" trova "Dopo il caffè"');
select pg_temp.verifica(
  (public.statistiche_colonne(:'ds_id', 4, '[{"colonna":"contesto","tipo":"testo","testo":"%"}]') ->> 'totale')::int = 0,
  'filtro testo: "%" è cercato come carattere, non come jolly');

-- Giorno della settimana: 28/09/2026 è lunedì
select pg_temp.verifica(
  (public.statistiche_colonne(:'ds_id', 4, '[{"colonna":"data","tipo":"giorni","valori":[1]}]') ->> 'totale')::int = 3,
  'filtro giorni: 3 righe di lunedì (28/09 e 12/10)');

-- I filtri valgono anche per le altre funzioni
select pg_temp.verifica(
  jsonb_array_length(public.raggruppa(:'ds_id', 'momento', null, 'conteggio', 'month', 50,
    '[{"colonna":"momento","tipo":"valori","valori":["Sera"]}]')) = 1,
  'raggruppa con filtro: solo il gruppo Sera');
select pg_temp.verifica(
  (public.andamento(:'ds_id', 'data', 'sistolica', 'week', 'media', 1,
    '[{"colonna":"momento","tipo":"valori","valori":["Sera"]}]') -> 0 ->> 'valore')::numeric = 110,
  'andamento con filtro: media della sera nella prima settimana 110');
select pg_temp.verifica(
  jsonb_array_length(public.conteggio_per_periodo(:'ds_id', 'data', 'day',
    '[{"colonna":"data","tipo":"intervallo","da":"2026-10-01"}]')) = 2,
  'conteggio per periodo con filtro: 12 e 13 ottobre');
select pg_temp.verifica(
  (public.leggi_righe(:'ds_id', 50, 0, 'id', false, '[{"colonna":"momento","tipo":"valori","valori":["Sera"]}]') ->> 'totale')::int = 2,
  'leggi_righe con filtro: 2 righe della sera');
select pg_temp.verifica(
  jsonb_array_length(public.valori_colonna(:'ds_id', 'momento')) = 2, 'valori_colonna: Mattina e Sera');

-- Niente iniezioni: colonne fuori catalogo, tipi di filtro sconosciuti, valori non validi
do $$ begin
  perform public.statistiche_colonne((select id from public.dataset where nome = 'pressione'), 4,
    '[{"colonna":"momento; drop table x","tipo":"valori","valori":["a"]}]');
  raise exception 'TEST FALLITO: colonna inesistente accettata';
exception when sqlstate '22023' then raise notice 'ok: filtro su colonna non nel catalogo respinto';
end $$;
do $$ begin
  perform public.statistiche_colonne((select id from public.dataset where nome = 'pressione'), 4,
    '[{"colonna":"momento","tipo":"sql","valori":["a"]}]');
  raise exception 'TEST FALLITO: tipo di filtro sconosciuto accettato';
exception when sqlstate '22023' then raise notice 'ok: tipo di filtro sconosciuto respinto';
end $$;
select pg_temp.verifica(
  (public.statistiche_colonne(:'ds_id', 4,
    '[{"colonna":"momento","tipo":"valori","valori":["x'') or true or (''"]}]') ->> 'totale')::int = 0,
  'filtro valori: un apice nel valore resta testo');
do $$ begin
  perform public.statistiche_colonne((select id from public.dataset where nome = 'pressione'), 4,
    '[{"colonna":"sistolica","tipo":"intervallo","da":"1; drop table x"}]');
  raise exception 'TEST FALLITO: numero non valido accettato';
exception when invalid_text_representation then raise notice 'ok: numero non valido respinto';
end $$;

reset role;

\echo 'Tutti i test dei filtri sono passati.'
