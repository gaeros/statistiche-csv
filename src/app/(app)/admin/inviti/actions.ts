"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { erroreAuth } from "@/lib/errori-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { utenteCorrente } from "@/lib/utente";
import type { StatoForm } from "@/app/accedi/actions";

export async function invita(_prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const { utente, amministratore } = await utenteCorrente();
  if (!amministratore) return { errore: "Solo l'amministratore può invitare." };

  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { errore: "Inserisci un indirizzo email valido." };
  const email = parsed.data;
  const inviaEmail = formData.get("invia_email") === "on";

  // L'inserimento passa dalle regole RLS: riesce solo se chi invita è amministratore.
  const supabase = await createClient();
  const { error } = await supabase.from("inviti").insert({ email, invitato_da: utente.id });
  if (error) {
    return {
      errore: error.code === "23505" ? "Questo indirizzo è già stato invitato." : error.message,
    };
  }

  if (inviaEmail) {
    const { error: errInvito } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl()}/imposta-password`,
    });
    if (errInvito) {
      revalidatePath("/admin/inviti");
      return {
        errore: `Indirizzo autorizzato, ma l'email non è partita: ${erroreAuth(errInvito.message)}`,
      };
    }
  }

  revalidatePath("/admin/inviti");
  return {
    ok: inviaEmail
      ? `Invito inviato a ${email}.`
      : `${email} è autorizzato: può registrarsi entrando con Google.`,
  };
}

export async function revocaInvito(formData: FormData) {
  const { amministratore } = await utenteCorrente();
  if (!amministratore) return;
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  await supabase.from("inviti").delete().eq("email", email);
  revalidatePath("/admin/inviti");
}
