import "server-only";
import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { cache } from "react";
import { creaFormati } from "@/lib/formato";
import { leggiPreferenze } from "@/lib/preferenze";
import { createClient } from "@/lib/supabase/server";

// Utente collegato (verificato dal server di Supabase) e se è amministratore.
export const utenteCorrente = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/accedi");

  const { data: admin } = await supabase.rpc("is_admin");
  return { utente: data.user, amministratore: admin === true };
});

// Formati di numeri e date per la lingua e le preferenze dell'utente collegato (SPEC §6.3).
export const formatiUtente = cache(async () => {
  const { utente } = await utenteCorrente();
  return creaFormati(await getLocale(), leggiPreferenze(utente.user_metadata));
});
