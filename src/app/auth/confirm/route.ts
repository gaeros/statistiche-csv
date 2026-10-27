import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { erroreAuth } from "@/lib/errori-auth";
import { createClient } from "@/lib/supabase/server";
import { destinazioneSicura } from "@/lib/redirect";

// Link delle email di Supabase (invito, recupero password, conferma email).
// Usato dai modelli email personalizzati di supabase/templates (link con token_hash).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const next = destinazioneSicura(searchParams.get("next"));

  if (tokenHash && tipo) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) {
      const dopo = tipo === "invite" || tipo === "recovery" ? "/imposta-password" : next;
      return NextResponse.redirect(`${origin}${dopo}`);
    }
    return NextResponse.redirect(
      `${origin}/accedi?errore=${encodeURIComponent(erroreAuth(error.message))}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/accedi?errore=${encodeURIComponent("Link non valido.")}`,
  );
}
