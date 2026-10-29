"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { StatoForm } from "@/app/accedi/actions";
import { confermaScritta } from "@/lib/conferma";
import { pulisciImportazione } from "@/lib/import/carica";
import { createClient } from "@/lib/supabase/server";

export async function rinomina(id: string, _prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const t = await getTranslations("dettaglio");
  const nome = z.string().trim().min(1, t("nomeVuoto")).max(100, t("nomeLungo"));
  const parsed = nome.safeParse(formData.get("nome"));
  if (!parsed.success) return { errore: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dataset")
    .update({ nome: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return { errore: error.code === "23505" ? t("nomeDuplicato") : error.message };
  }
  revalidatePath(`/dataset/${id}`);
  return { ok: t("nomeAggiornato") };
}

// Elimina tabella e voce di catalogo; se l'importazione resta vuota, anche il file originale.
// Si procede solo se nella finestra è stata scritta la parola di conferma (ELIMINA o DELETE).
export async function elimina(id: string, formData: FormData) {
  const t = await getTranslations("dettaglio");
  if (!confermaScritta(formData)) throw new Error((await getTranslations("confermaElimina"))("errore"));
  const supabase = await createClient();
  const { data: dataset } = await supabase.from("dataset").select("importazione_id").eq("id", id).single();
  if (!dataset) redirect("/dataset");

  const { error } = await supabase.from("dataset").delete().eq("id", id);
  if (error) throw new Error(t("eliminazioneFallita", { dettaglio: error.message }));
  await pulisciImportazione(supabase, dataset.importazione_id);

  revalidatePath("/dataset");
  redirect("/dataset");
}
