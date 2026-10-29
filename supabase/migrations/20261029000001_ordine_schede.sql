-- Ordine delle schede «Colonna per colonna» scelto dall'utente, separato per ogni dataset.
-- Contiene i nomi delle colonne nell'ordine voluto; vuoto = ordine originale del file.
-- Le colonne non elencate (es. aggiunte dopo) vanno in fondo, nell'ordine del file.

alter table public.dataset
  add column if not exists ordine_schede text[] not null default '{}'
  check (cardinality(ordine_schede) <= 1000);

-- Come per il nome: l'utente può cambiare solo l'ordine dei propri dataset (la regola RLS
-- "dataset: modifica propri" limita già l'aggiornamento al proprietario).
grant update (ordine_schede) on public.dataset to authenticated;
