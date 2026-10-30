"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { StatoForm } from "@/app/accedi/actions";
import { confermaScritta } from "@/lib/conferma";
import { daQuery, MAX_NOME } from "@/lib/filtri-salvati";
import { createClient } from "@/lib/supabase/server";

async function nomeValido(formData: FormData) {
  const t = await getTranslations("filtriSalvati");
  return z.string().trim().min(1, t("nomeVuoto")).max(MAX_NOME, t("nomeLungo", { n: MAX_NOME })).safeParse(formData.get("nome"));
}

async function errore(codice: string | undefined, dettaglio: string) {
  const t = await getTranslations("filtriSalvati");
  if (codice === "23505") return t("nomeDuplicato");
  if (codice === "53400") return t("troppi");
  return t("nonRiuscito", { dettaglio });
}

// Torna alla scheda da cui si è partiti (dati, statistiche o grafici), con i filtri attivi.
function ritorno(id: string, formData: FormData) {
  const r = String(formData.get("ritorno") ?? "");
  const base = `/dataset/${id}`;
  return r === base || r.startsWith(`${base}/`) || r.startsWith(`${base}?`) ? r : base;
}

// Salva i filtri attivi (la parte "?..." dell'indirizzo) con un nome.
export async function salvaFiltri(id: string, _prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const t = await getTranslations("filtriSalvati");
  const nome = await nomeValido(formData);
  if (!nome.success) return { errore: nome.error.issues[0].message };
  const parametri = daQuery(String(formData.get("query") ?? ""));
  if (Object.keys(parametri).length === 0) return { errore: t("nessunFiltro") };

  const supabase = await createClient();
  const { error } = await supabase.from("filtri_salvati").insert({ dataset_id: id, nome: nome.data, parametri });
  if (error) return { errore: await errore(error.code, error.message) };
  revalidatePath(`/dataset/${id}`, "layout");
  return { ok: t("salvato", { nome: nome.data }) };
}

export async function rinominaFiltri(id: string, filtro: string, _prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const t = await getTranslations("filtriSalvati");
  const nome = await nomeValido(formData);
  if (!nome.success) return { errore: nome.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase
    .from("filtri_salvati")
    .update({ nome: nome.data, updated_at: new Date().toISOString() })
    .eq("id", filtro)
    .eq("dataset_id", id);
  if (error) return { errore: await errore(error.code, error.message) };
  revalidatePath(`/dataset/${id}`, "layout");
  return { ok: t("rinominato") };
}

// Si procede solo se nella finestra è stata scritta la parola di conferma (ELIMINA o DELETE).
export async function eliminaFiltri(id: string, filtro: string, formData: FormData) {
  if (!confermaScritta(formData)) throw new Error((await getTranslations("confermaElimina"))("errore"));
  const supabase = await createClient();
  const { error } = await supabase.from("filtri_salvati").delete().eq("id", filtro).eq("dataset_id", id);
  if (error) throw new Error(await errore(error.code, error.message));
  revalidatePath(`/dataset/${id}`, "layout");
  redirect(ritorno(id, formData));
}
