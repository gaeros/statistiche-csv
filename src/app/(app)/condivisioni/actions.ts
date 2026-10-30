"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { DASHBOARD, dataScadenza, leggiScadenza } from "@/lib/condivisioni";
import { createClient } from "@/lib/supabase/server";

// Crea un link di sola lettura per un grafico salvato o per la dashboard. Il codice lo sceglie il database.
export async function creaLink(formData: FormData) {
  const t = await getTranslations("condivisioni");
  const cosa = String(formData.get("cosa") ?? "");
  if (cosa !== DASHBOARD && !z.uuid().safeParse(cosa).success) redirect("/condivisioni");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("condivisioni")
    .insert({ grafico_id: cosa === DASHBOARD ? null : cosa, scade_il: dataScadenza(leggiScadenza(formData.get("scadenza"))) })
    .select("id")
    .single();
  if (error) throw new Error(error.code === "53400" ? t("troppi") : t("nonCreato", { dettaglio: error.message }));
  revalidatePath("/condivisioni");
  redirect(`/condivisioni?nuovo=${data.id}#link-${data.id}`);
}

// Revoca un link: la riga si elimina e da subito il link non mostra più nulla.
export async function revocaLink(id: string) {
  if (!z.uuid().safeParse(id).success) redirect("/condivisioni");
  const t = await getTranslations("condivisioni");
  const supabase = await createClient();
  const { error } = await supabase.from("condivisioni").delete().eq("id", id);
  if (error) throw new Error(t("nonRevocato", { dettaglio: error.message }));
  revalidatePath("/condivisioni");
  redirect("/condivisioni");
}
