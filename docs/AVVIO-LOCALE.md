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
3. **Modelli email**: non serve toccarli. L'app funziona con i modelli predefiniti di Supabase.
   (Sul piano gratuito si possono modificare solo dopo aver configurato un servizio SMTP proprio; in
   quel caso i testi in italiano sono pronti in `supabase/templates/`.)

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
   la tua email come contatto. In *Branding* metti home page e link alla privacy
   (`https://datahue.vercel.app/privacy`), **senza logo** (un logo richiede la verifica di Google).
   In *Audience* premi **Publish app**: con i soli permessi di base (email, nome) non serve verifica e
   non c'è limite di utenti; chi entra lo decide l'elenco inviti di Datahue.
3. *Clients → Create client* → tipo **Web application**:
   - *Authorized JavaScript origins*: `http://localhost:3000` (e l'indirizzo Vercel, vedi RILASCIO.md)
   - *Authorized redirect URIs*: l'indirizzo di callback che Supabase ti mostra al punto 4
     (è `https://<il-tuo-progetto>.supabase.co/auth/v1/callback`)
4. In Supabase: *Authentication → Sign In / Providers → Google* → attiva, incolla **Client ID** e
   **Client Secret** di Google → **Save**.

Prova: esci dall'app e premi **Accedi con Google**. Un'email non invitata riceve il messaggio
"Registrazione solo su invito".

## 9. (Facoltativo) Vedere i propri dati con DBeaver

L'utente database **`lettore`** serve a guardare le tabelle con DBeaver senza poter cambiare nulla.
Vede **solo i dati di un utente dell'app** (il tuo): le sue importazioni, i dataset, le tabelle dei
dati, i grafici salvati e la dashboard. Non vede i dati delle altre persone né la tabella `inviti`.
Le regole sono nella migrazione `20261030000001_lettore_solo_utente.sql`.

1. Applica la migrazione `20261030000001_lettore_solo_utente.sql` come al punto 4 (crea anche il
   ruolo `lettore`, ancora senza accesso).
2. In *SQL Editor → New query* scegli di chi sono i dati che `lettore` può vedere (la tua email
   dell'app) e premi **Run**:

   ```sql
   insert into public.lettore_utente (user_id)
   select id from auth.users where email = 'tua.email@gmail.com'
   on conflict (unica) do update set user_id = excluded.user_id;
   ```

   Deve comparire "Success. 1 row affected". Se dice 0 righe, l'email non è quella del tuo account.
3. **Solo la prima volta** (se `lettore` non ha ancora una password): in una nuova query scrivi una
   password tua, lunga e senza apici, al posto di `SCEGLI_UNA_PASSWORD`, premi **Run** e poi cancella
   la query. La password non va scritta altrove.

   ```sql
   alter role lettore with login password 'SCEGLI_UNA_PASSWORD';
   ```

4. In DBeaver: *Nuova connessione → PostgreSQL*. I dati si leggono in Supabase dal pulsante
   **Connect** → *Session pooler* → *Connection parameters*: host `aws-0-eu-north-1.pooler.supabase.com`,
   porta `5432`, database `postgres`, utente **`lettore.<riferimento-del-progetto>`** (con il punto),
   la password del punto 3. Le tabelle dei file caricati sono nello schema **`dati`**; il nome di
   ciascuna è nella colonna `nome_fisico` di `public.dataset`.

Per togliere del tutto l'accesso: `alter role lettore nologin;`.

---

## Problemi comuni

| Sintomo | Causa probabile |
|---------|-----------------|
| `Variabile d'ambiente mancante` all'avvio | `.env.local` non c'è o ha una riga vuota; dopo averlo modificato riavvia `npm run dev` |
| "Email o password non corretti" | password sbagliata, o utente non creato (punto 6) |
| Il link dell'email porta a "Link non valido" | il link è scaduto o è già stato usato: richiedine uno nuovo; controlla anche Site URL e Redirect URLs (punto 5.1) |
| Login Google: "redirect_uri_mismatch" | l'indirizzo di callback in Google non coincide con quello mostrato da Supabase |
| DBeaver con `lettore`: tabelle vuote | manca la riga in `public.lettore_utente` (punto 9.2), o l'email non era quella del tuo account |
| Il progetto Supabase non risponde | il progetto gratuito va in pausa dopo giorni di inattività: riattivalo dal pannello |
