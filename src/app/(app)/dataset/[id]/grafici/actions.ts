"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Colonna, Parametri } from "@/lib/filtri";
import { leggiConfigurazione, titoloAutomatico } from "@/lib/grafici";
import { createClient } from "@/lib/supabase/server";

function parametri(formData: FormData): Parametri {
  const sp: Record<string, string[]> = {};
  for (const [k, v] of formData.entries()) if (typeof v === "string") (sp[k] ??= []).push(v);
  return sp;
}

// Torna alla pagina dei grafici mantenendo i filtri attivi.
function ritorno(id: string, formData: FormData) {
  const q = String(formData.get("ritorno") ?? "");
  return `/dataset/${id}/grafici${q.startsWith("?") ? q : ""}#dashboard`;
}

export async function salvaGrafico(id: string, formData: FormData) {
  const supabase = await createClient();
  const { data: d } = await supabase.from("dataset").select("colonne").eq("id", id).maybeSingle();
  if (!d) redirect("/dataset");
  const colonne = d.colonne as Colonna[];
  const configurazione = leggiConfigurazione(parametri(formData), colonne);
  const titolo = String(formData.get("titolo") ?? "").trim().slice(0, 120) || titoloAutomatico(configurazione, colonne);

  const { error } = await supabase.from("grafici").insert({ dataset_id: id, titolo, configurazione });
  if (error) throw new Error(`Salvataggio non riuscito: ${error.message}`);
  revalidatePath(`/dataset/${id}/grafici`);
  redirect(ritorno(id, formData));
}

export async function eliminaGrafico(id: string, grafico: string, formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.from("grafici").delete().eq("id", grafico).eq("dataset_id", id);
  if (error) throw new Error(`Eliminazione non riuscita: ${error.message}`);
  revalidatePath(`/dataset/${id}/grafici`);
  redirect(ritorno(id, formData));
}
