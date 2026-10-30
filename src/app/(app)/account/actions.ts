"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { StatoForm } from "@/app/accedi/actions";
import { confermaScritta } from "@/lib/conferma";
import { leggiPreferenze } from "@/lib/preferenze";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Elimina l'account e tutti i dati (SPEC §8.2). Le tabelle, i dataset, le importazioni e i grafici
// si cancellano a cascata con l'utente; i file originali vanno tolti dallo Storage prima.
export async function eliminaAccount(_prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const t = await getTranslations("account");
  if (!confermaScritta(formData)) return { errore: (await getTranslations("confermaElimina"))("errore") };

  const supabase = await createClient();
  const { data: sessione } = await supabase.auth.getUser();
  const utente = sessione.user;
  if (!utente) redirect("/accedi");

  const { data: importazioni } = await supabase.from("importazioni").select("percorso_storage");
  const percorsi = (importazioni ?? []).map((i) => i.percorso_storage).filter((p): p is string => !!p);
  if (percorsi.length) {
    const { error } = await supabase.storage.from("originali").remove(percorsi);
    if (error) return { errore: t("erroreFile", { dettaglio: error.message }) };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(utente.id);
  if (error) return { errore: t("erroreElimina", { dettaglio: error.message }) };
  // Toglie anche l'invito, così l'indirizzo non resta salvato e non può riregistrarsi senza un nuovo invito.
  if (utente.email) await admin.from("inviti").delete().eq("email", utente.email.toLowerCase());

  await supabase.auth.signOut();
  redirect("/accedi?eliminato=1");
}

// Salva i formati di data e decimali nei metadati dell'utente (SPEC §6.3); valgono subito in tutta l'app.
export async function salvaFormati(_prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const t = await getTranslations("account");
  const formati = leggiPreferenze({ formati: { data: formData.get("data"), decimali: formData.get("decimali") } });
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ data: { formati } });
  if (error) return { errore: t("erroreFormati", { dettaglio: error.message }) };
  revalidatePath("/", "layout");
  return { ok: t("formatiSalvati") };
}
