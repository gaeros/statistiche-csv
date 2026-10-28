# Mettere l'app in rete (Fase 4)

L'app gira su **Vercel** (piano gratuito, funzioni a Stoccolma `arn1`, vedi `vercel.json`) e usa il
progetto **Supabase** già creato per lo sviluppo (Stoccolma, UE): il piano gratuito non permette un
secondo progetto attivo, quindi app in rete e app sul PC condividono database, utenti e file.

> Le chiavi vanno solo nel pannello di Vercel e in `.env.local`. Mai in chat, email o file del repository.

## 1. Importare il repository in Vercel

1. Vai su https://vercel.com/new.
2. In **Import Git Repository**, se GitHub non è collegato premi **Continue with GitHub** (o
   **Install**) e dai accesso al repository `gaeros/statistiche-csv`.
3. Accanto a `statistiche-csv` premi **Import**.
4. In **Project Name** scrivi `datahue` (così l'indirizzo sarà `datahue.vercel.app`; se è già occupato Vercel te lo dice, scegli `datahue-app`). *Framework Preset* deve essere **Next.js** (lo riconosce da solo). Non cambiare i comandi.
5. Apri **Environment Variables** e aggiungi tre righe (*Key* a sinistra, *Value* a destra), copiando
   i valori dal tuo `.env.local`:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_SUPABASE_URL` | lo stesso di `.env.local` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | lo stesso di `.env.local` |
   | `SUPABASE_SERVICE_ROLE_KEY` | lo stesso di `.env.local` |

   `NEXT_PUBLIC_SITE_URL` **non** serve: in rete l'app usa da sola l'indirizzo di Vercel.
6. Premi **Deploy** e aspetta 1–2 minuti. Alla fine Vercel mostra l'indirizzo, del tipo
   `https://datahue.vercel.app` (in *Domains* della pagina del progetto).

Da qui in poi ogni modifica unita in `main` va in rete da sola; ogni pull request ha un'anteprima.

## 2. Dire a Supabase l'indirizzo dell'app

*Authentication → URL Configuration*:

- **Site URL**: l'indirizzo di Vercel, es. `https://datahue.vercel.app`
- **Redirect URLs** → *Add URL*: lo stesso indirizzo seguito da `/**`, es.
  `https://datahue.vercel.app/**`. Lascia anche `http://localhost:3000/**`, così l'app sul PC
  continua a funzionare.

## 3. Prova

1. Apri l'indirizzo di Vercel ed entra con la tua email e password.
2. Al primo accesso l'app chiede di leggere l'informativa e dare il consenso: è normale.
3. Controlla che i tuoi dataset, le statistiche e i grafici ci siano (sono gli stessi del PC).
4. **Invito vero:** da *Inviti* invita un'altra tua email. Con il servizio email integrato di Supabase
   le email arrivano solo agli indirizzi dei membri del tuo team Supabase (*Organization → Team*):
   per invitare altre persone serve un servizio SMTP, vedi sotto.

## 4. Facoltativo: email a chiunque (SMTP)

1. Crea un account gratuito su https://resend.com (3.000 email al mese) e verifica un dominio, oppure
   usa l'indirizzo di prova che Resend fornisce.
2. In Resend crea una *API key*.
3. In Supabase: *Authentication → Emails → SMTP Settings* → attiva **Enable custom SMTP**:
   host `smtp.resend.com`, porta `465`, utente `resend`, password = la API key, mittente a scelta.
4. Con lo SMTP attivo puoi anche usare i modelli email in italiano di `supabase/templates/`.

## 5. Facoltativo: accesso con Google

Segui il punto 8 di [AVVIO-LOCALE.md](AVVIO-LOCALE.md), aggiungendo in Google:
*Authorized JavaScript origins* → anche l'indirizzo di Vercel.

## Prima di aprire l'app ad altre persone

- Fai verificare l'informativa (`/privacy`) da un esperto privacy: è una bozza tecnica.
- Il piano gratuito di Supabase non fa backup: scarica ogni tanto i tuoi dati da *Il mio account*.
- Il progetto gratuito va in pausa dopo giorni senza uso: si riattiva dal pannello Supabase.
