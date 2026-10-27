# Statistiche da CSV

App web per caricare file CSV ed Excel, trasformarli in tabelle del database e vederli in grafici
con filtri. Ogni utente vede solo i propri dati. Registrazione solo su invito.

Stack: Next.js (App Router, TypeScript), Supabase (PostgreSQL, Auth, Storage), Tailwind CSS.

- **Avvio sul PC:** [docs/AVVIO-LOCALE.md](docs/AVVIO-LOCALE.md)
- **Specifica funzionale:** `SPEC.md` del progetto (v0.6)

## Comandi

| Comando | Cosa fa |
|---------|---------|
| `npm run dev` | avvia l'app su http://localhost:3000 |
| `npm run build` | compila la versione di produzione |
| `npm run lint` | controlla il codice |

## Struttura

| Percorso | Contenuto |
|----------|-----------|
| `src/app/accedi`, `password-dimenticata`, `imposta-password`, `auth/*` | login, recupero password, ritorno da email e Google |
| `src/app/(app)` | pagine riservate agli utenti collegati |
| `src/lib/supabase` | client Supabase (browser, server, proxy, admin solo lato server) |
| `src/proxy.ts` | rinnova la sessione e manda al login chi non è collegato |
| `supabase/migrations` | struttura del database, regole RLS e funzioni |
| `supabase/templates` | modelli delle email di invito e recupero password |

## Stato

- [x] Fase 0: base locale, login solo su invito, email/password e Google
- [ ] Fase 1: import CSV/Excel
- [ ] Fase 2: statistiche
- [ ] Fase 3: grafici e filtri
- [ ] Fase 4: rilascio su Vercel
