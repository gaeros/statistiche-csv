#!/usr/bin/env bash
# Applica le migrazioni a un PostgreSQL di prova e lancia i test di isolamento tra utenti.
# La connessione si imposta con le variabili standard PGHOST, PGPORT, PGUSER, PGPASSWORD.
# Esempio: PGHOST=localhost PGUSER=postgres scripts/test-db.sh
# ATTENZIONE: crea e cancella il database "statistiche_test". Non usarlo su Supabase.
set -euo pipefail
cd "$(dirname "$0")/.."

DB=statistiche_test
psql -d postgres -qAt -c "drop database if exists $DB" -c "create database $DB"

psql -d "$DB" -q -v ON_ERROR_STOP=1 -f supabase/tests/stub-supabase.sql
for migrazione in supabase/migrations/*.sql; do
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -f "$migrazione"
done
for test in supabase/tests/isolamento.sql supabase/tests/statistiche.sql supabase/tests/filtri.sql supabase/tests/grafici.sql supabase/tests/accoda.sql supabase/tests/ordine.sql supabase/tests/dashboard.sql supabase/tests/condivisioni.sql supabase/tests/filtri_salvati.sql; do
  psql -d "$DB" -q -v ON_ERROR_STOP=1 -o /dev/null -f "$test" 2>&1 | sed "s/^psql:[^ ]* //"
done
