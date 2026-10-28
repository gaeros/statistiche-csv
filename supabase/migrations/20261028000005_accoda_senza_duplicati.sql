-- Accoda saltando i duplicati (SPEC §4.8, punto 4).
-- Come inserisci_righe, ma una riga si inserisce solo se nel dataset non ce n'è già una con gli stessi
-- identici valori in tutte le colonne (i valori mancanti contano come uguali tra loro).
-- Anche le righe identiche dentro lo stesso blocco contano come una sola: così, se un'importazione
-- si interrompe e riparte dallo stesso blocco, non si crea nulla di doppio.
-- Restituisce { "inserite": n, "saltate": n }.

create or replace function public.inserisci_righe_nuove(p_dataset uuid, p_righe jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  utente uuid := auth.uid();
  d public.dataset;
  elenco text;
  definizioni text;
  elenco_nuove text;
  elenco_esistenti text;
  inserite integer;
  ricevute integer;
begin
  select * into d from public.dataset where id = p_dataset and user_id = utente;
  if not found then
    raise exception 'Dataset non trovato.' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_righe) <> 'array' or jsonb_array_length(p_righe) > 10000 then
    raise exception 'Blocco di righe non valido (massimo 10.000 righe).' using errcode = '22023';
  end if;
  ricevute := jsonb_array_length(p_righe);

  if public.spazio_usato(utente) >= public.quota_utente() then
    raise exception 'Quota di spazio superata (100 MB).' using errcode = '53400';
  end if;

  select string_agg(format('%I', c ->> 'nome'), ', ' order by n),
         string_agg(format('%I %s', c ->> 'nome', public.tipo_sql(c ->> 'tipo')), ', ' order by n),
         string_agg(format('n.%I', c ->> 'nome'), ', ' order by n),
         string_agg(format('e.%I', c ->> 'nome'), ', ' order by n)
    into elenco, definizioni, elenco_nuove, elenco_esistenti
  from jsonb_array_elements(d.colonne) with ordinality as t(c, n);

  -- Il confronto passa da un'impronta (md5 della riga): così il database usa un join a hash
  -- e resta veloce anche con molte righe. Distingue un valore mancante da un testo vuoto.
  execute format(
    'insert into dati.%1$I (user_id, %2$s)
     select $1, %2$s
     from (
       select distinct on (h) %3$s, h
       from (
         select %2$s, md5((row(%2$s))::text) as h
         from jsonb_to_recordset($2) as r(%4$s)
       ) n
     ) n
     where not exists (
       select 1 from dati.%1$I e
       where e.user_id = $1 and md5((row(%5$s))::text) = n.h
     )',
    d.nome_fisico, elenco, elenco_nuove, definizioni, elenco_esistenti
  ) using utente, p_righe;
  get diagnostics inserite = row_count;

  update public.dataset set righe = righe + inserite, updated_at = now() where id = p_dataset;
  return jsonb_build_object('inserite', inserite, 'saltate', ricevute - inserite);
end;
$$;

revoke execute on function public.inserisci_righe_nuove(uuid, jsonb) from public, anon;
