# Avviare l'app sul tuo PC (Fase 0)

Questa guida si fa **una volta sola**. Alla fine avrai l'app su `http://localhost:3000`, collegata al
progetto Supabase di sviluppo, con il login solo su invito.

Tempo stimato: 30–40 minuti (Google login escluso, che è facoltativo e sta in fondo).

---

## 1. Programmi da installare sul PC

| Programma | Dove si scarica | Come verificare (nel terminale) |
|-----------|-----------------|---------------------------------|
| **Node.js LTS** (22 o più recente) | https://nodejs.org → pulsante "LTS" | `node -v` |
| **Git** | https://git-scm.com/downloads | `git --version` |
| **VS Code** (consigliato) | https://code.visualstudio.com | |

Su Windows usa il terminale **PowerShell** (o quello integrato in VS Code: menu *Terminale → Nuovo terminale*).

## 2. Scaricare il codice

```bash
git clone https://github.com/gaeros/statistiche-csv.git
cd statistiche-csv
npm install
```

`npm install` scarica le librerie: la prima volta ci mette un minuto o due.

## 3. Le chiavi di Supabase nel file `.env.local`

1. Nella cartella del progetto copia il file `.env.example` e chiama la copia **`.env.local`**
   (su Windows: `copy .env.example .env.local`, su Mac/Linux: `cp .env.example .env.local`).
2. Apri il pannello Supabase → il progetto **statistiche-csv-dev**.
3. Copia i valori in `.env.local`:

| Riga di `.env.local` | Dove la trovi nel pannello Supabase |
|----------------------|-------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | pulsante **Connect** in alto, oppure *Project Settings → Data API*: "Project URL" (`https://xxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *Project Settings → API Keys*: la **Publishable key** (`sb_publishable_…`). Se vedi solo la scheda "Legacy", va bene la chiave `anon` |
| `SUPABASE_SERVICE_ROLE_KEY` | *Project Settings → API Keys*: una **Secret key** (`sb_secret_…`, clicca l'occhio per vederla). In "Legacy" è la `service_role` |

> **La Secret key è come la password di amministratore del database.** Va solo in `.env.local`, che
> git ignora: non mandarla in chat, per email, né in nessun altro file.

## 4. Creare le tabelle nel database (migrazioni)

Le tabelle e le regole di sicurezza sono nei file della cartella `supabase/migrations/`. Due modi per
applicarle, scegline **uno**:

**Modo A, il più semplice (dal pannello):**
apri *SQL Editor → New query*, incolla il contenuto di ogni file di `supabase/migrations/` **in ordine
di nome** (uno alla volta, una query per file) e premi **Run**. Deve comparire "Success. No rows returned".
Quando arrivano nuove versioni dell'app con nuovi file di migrazione, si applicano allo stesso modo solo
i file nuovi; con il Modo B basta rilanciare `npx supabase db push`.

**Modo B, con la Supabase CLI (quello che useremo per la produzione):**

```bash
npx supabase login            # si apre il browser per autorizzare
npx supabase link             # scegli il progetto statistiche-csv-dev e inserisci la password del DB
npx supabase db push          # applica le migrazioni mancanti
```

## 5. Impostazioni di Authentication nel pannello Supabase

1. **Indirizzi dell'app** — *Authentication → URL Configuration*:
   - **Site URL**: `http://localhost:3000`
   - **Redirect URLs** → *Add URL*: `http://localhost:3000/**`
2. **Solo su invito** — *Authentication → Hooks* (in alcune versioni *Auth Hooks*) → **Add hook** →
   **Before User Created** → tipo **Postgres** → schema `public`, funzione `hook_solo_su_invito` →
   **Create**. Da questo momento nessuno può creare un account se la sua email non è nell'elenco inviti.
3. **Modelli email** — *Authentication → Emails → Templates*. Sostituisci il testo di due modelli con
   quello dei file nel repository:
   - **Invite user** → contenuto di `supabase/templates/invito.html`
   - **Reset password** → contenuto di `supabase/templates/recupero.html`

   Servono perché i link delle email portino alla pagina dell'app che completa l'accesso.

## 6. Diventare amministratore e creare il tuo account

1. In *SQL Editor* esegui (con la tua email):

   ```sql
   insert into public.inviti (email, amministratore)
   values ('tua.email@gmail.com', true);
   ```

2. *Authentication → Users → Add user → Create new user*: la tua email, una password, spunta
   **Auto Confirm User** → **Create user**.

## 7. Avviare l'app

```bash
npm run dev
```

Apri http://localhost:3000: compare la pagina **Accedi**. Entra con email e password. In alto vedrai
anche la voce **Inviti**, perché sei amministratore. Per fermare l'app: `Ctrl + C` nel terminale.

Le volte successive bastano `cd statistiche-csv` e `npm run dev`.

### Invitare altre persone

Da *Inviti* scrivi l'email e premi **Invita**. Attenzione a un limite del piano gratuito: il servizio
email integrato di Supabase spedisce solo pochissime email all'ora e **solo agli indirizzi dei membri
del tuo team Supabase**. Per invitare altre persone per email servirà un servizio SMTP (es. Resend,
gratuito fino a 3.000 email al mese), da configurare in *Authentication → Emails → SMTP Settings*.
In alternativa togli la spunta "Invia l'email di invito": la persona è autorizzata e può registrarsi
con **Accedi con Google**.

## 8. (Facoltativo, ma previsto) Accedi con Google

1. Vai su https://console.cloud.google.com, crea un progetto (es. "statistiche-csv").
2. *APIs & Services → OAuth consent screen* (o *Google Auth Platform*): tipo **External**, nome app,
   la tua email come contatto. In *Audience* lascialo in modalità **Testing** e aggiungi come *Test
   users* le email di chi vuoi far entrare.
3. *Clients → Create client* → tipo **Web application**:
   - *Authorized JavaScript origins*: `http://localhost:3000`
   - *Authorized redirect URIs*: l'indirizzo di callback che Supabase ti mostra al punto 4
     (è `https://<il-tuo-progetto>.supabase.co/auth/v1/callback`)
4. In Supabase: *Authentication → Sign In / Providers → Google* → attiva, incolla **Client ID** e
   **Client Secret** di Google → **Save**.

Prova: esci dall'app e premi **Accedi con Google**. Un'email non invitata riceve il messaggio
"Registrazione solo su invito".

---

## Problemi comuni

| Sintomo | Causa probabile |
|---------|-----------------|
| `Variabile d'ambiente mancante` all'avvio | `.env.local` non c'è o ha una riga vuota; dopo averlo modificato riavvia `npm run dev` |
| "Email o password non corretti" | password sbagliata, o utente non creato (punto 6) |
| Il link dell'email porta a "Link non valido" | i modelli email non sono stati aggiornati (punto 5.3) o il link è scaduto |
| Login Google: "redirect_uri_mismatch" | l'indirizzo di callback in Google non coincide con quello mostrato da Supabase |
| Il progetto Supabase non risponde | il progetto gratuito va in pausa dopo giorni di inattività: riattivalo dal pannello |
