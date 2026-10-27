"use server";

import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { erroreAuth } from "@/lib/errori-auth";
import { createClient } from "@/lib/supabase/server";
import type { StatoForm } from "../accedi/actions";

export async function inviaRecupero(_prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const email = z.email().safeParse(formData.get("email"));
  if (!email.success) return { errore: "Inserisci un indirizzo email valido." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${siteUrl()}/auth/callback?next=/imposta-password`,
  });
  if (error) return { errore: erroreAuth(error.message) };

  // Stesso messaggio anche se l'email non esiste, per non rivelare chi è registrato.
  return { ok: "Se l'indirizzo è registrato, riceverai un'email con il link per scegliere una nuova password." };
}
