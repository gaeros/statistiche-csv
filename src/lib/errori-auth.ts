// Traduce in italiano i messaggi più comuni di Supabase Auth.
export function erroreAuth(messaggio: string | undefined | null): string {
  if (!messaggio) return "Si è verificato un errore. Riprova.";
  const m = messaggio.toLowerCase();
  if (m.includes("invalid login credentials")) return "Email o password non corretti.";
  if (m.includes("email not confirmed")) return "Devi prima confermare l'email: controlla la posta.";
  if (m.includes("invito") || m.includes("signups not allowed") || m.includes("not allowed"))
    return "Registrazione solo su invito: questo indirizzo email non è stato invitato.";
  if (m.includes("password should be") || m.includes("weak password"))
    return "La password è troppo debole: usa almeno 8 caratteri.";
  if (m.includes("same password") || m.includes("different from the old"))
    return "La nuova password deve essere diversa da quella attuale.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Troppi tentativi. Aspetta qualche minuto e riprova.";
  if (m.includes("expired") || m.includes("invalid") && m.includes("token"))
    return "Il link è scaduto o non è più valido. Richiedine uno nuovo.";
  return messaggio;
}
