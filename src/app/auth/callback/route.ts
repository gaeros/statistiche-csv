import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { erroreAuth } from "@/lib/errori-auth";
import { destinazioneSicura } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

// Ritorno dal login con Google (e dai link email del flusso PKCE).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const codice = searchParams.get("code");
  const next = destinazioneSicura(searchParams.get("next"));
  const erroreProvider = searchParams.get("error_description") ?? searchParams.get("error");

  if (codice) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(codice);
    if (error) return await redirectErrore(origin, error.message);

    // Seconda difesa oltre all'hook "Before User Created": chi non è in public.inviti
    // (es. un account Google qualsiasi, se l'hook non fosse attivo) viene disconnesso.
    const email = data.user.email?.toLowerCase() ?? "";
    const { data: invito, error: errInvito } = await supabase
      .from("inviti")
      .select("email")
      .eq("email", email)
      .maybeSingle();
    if (errInvito || !invito) {
      await supabase.auth.signOut();
      return await redirectErrore(origin, errInvito ? null : "invito");
    }
    return NextResponse.redirect(`${origin}${next}`);
  }

  return await redirectErrore(origin, erroreProvider);
}

async function redirectErrore(origin: string, messaggio: string | null) {
  const te = await getTranslations("erroriAuth");
  return NextResponse.redirect(
    `${origin}/accedi?errore=${encodeURIComponent(erroreAuth(te, messaggio))}`,
  );
}

