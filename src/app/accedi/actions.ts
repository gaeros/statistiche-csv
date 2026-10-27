"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { erroreAuth } from "@/lib/errori-auth";
import { createClient } from "@/lib/supabase/server";

export type StatoForm = { errore?: string; ok?: string } | undefined;

const credenziali = z.object({
  email: z.email("Inserisci un indirizzo email valido."),
  password: z.string().min(1, "Inserisci la password."),
});

export async function accedi(_prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const dati = credenziali.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!dati.success) return { errore: dati.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(dati.data);
  if (error) return { errore: erroreAuth(error.message) };

  redirect("/dataset");
}

export async function accediConGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteUrl()}/auth/callback` },
  });
  if (error || !data.url) {
    redirect(`/accedi?errore=${encodeURIComponent(erroreAuth(error?.message))}`);
  }
  redirect(data.url);
}

export async function esci() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/accedi");
}
