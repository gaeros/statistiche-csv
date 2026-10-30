import "server-only";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";

// Titolo della scheda del browser per le tre pagine del dataset: «nome · Dati – Datahue» (WCAG 2.4.2).
export async function titoloDataset(id: string, scheda: "dati" | "statistiche" | "grafici") {
  const supabase = await createClient();
  const [{ data }, t] = await Promise.all([
    supabase.from("dataset").select("nome").eq("id", id).maybeSingle(),
    getTranslations("meta"),
  ]);
  return { title: data ? t("titoloDataset", { nome: data.nome, scheda: t(`scheda_${scheda}`) }) : "Datahue" };
}
