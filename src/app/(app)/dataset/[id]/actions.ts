"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { StatoForm } from "@/app/accedi/actions";
import { pulisciImportazione } from "@/lib/import/carica";
import { createClient } from "@/lib/supabase/server";

const nome = z
  .string()
  .trim()
  .min(1, "Il nome non può essere vuoto.")
  .max(100, "Il nome può avere al massimo 100 caratteri.");

export async function rinomina(id: string, _prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const parsed = nome.safeParse(formData.get("nome"));
  if (!parsed.success) return { errore: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("dataset")
    .update({ nome: parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return { errore: error.code === "23505" ? "Hai già un dataset con questo nome." : error.message };
  }
  revalidatePath(`/dataset/${id}`);
  return { ok: "Nome aggiornato." };
}

// Elimina tabella e voce di catalogo; se l'importazione resta vuota, anche il file originale.
export async function elimina(id: string) {
  const supabase = await createClient();
  const { data: dataset } = await supabase.from("dataset").select("importazione_id").eq("id", id).single();
  if (!dataset) redirect("/dataset");

  const { error } = await supabase.from("dataset").delete().eq("id", id);
  if (error) throw new Error(`Eliminazione non riuscita: ${error.message}`);
  await pulisciImportazione(supabase, dataset.importazione_id);

  revalidatePath("/dataset");
  redirect("/dataset");
}
