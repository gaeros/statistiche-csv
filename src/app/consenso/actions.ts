"use server";

import { redirect } from "next/navigation";
import type { StatoForm } from "@/app/accedi/actions";
import { VERSIONE_INFORMATIVA } from "@/lib/privacy";
import { createClient } from "@/lib/supabase/server";

// Registra il consenso esplicito al trattamento dei dati sanitari nel profilo dell'utente.
export async function daiConsenso(_prev: StatoForm, formData: FormData): Promise<StatoForm> {
  if (formData.get("salute") !== "si" || formData.get("informativa") !== "si") {
    return { errore: "Per usare l'app servono entrambe le conferme." };
  }
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: { consenso_privacy: { versione: VERSIONE_INFORMATIVA, data: new Date().toISOString() } },
  });
  if (error) return { errore: "Non è stato possibile salvare il consenso. Riprova." };
  redirect("/dataset");
}
