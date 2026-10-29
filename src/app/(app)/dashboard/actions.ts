"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { MAX_FISSATI, riordina, togli } from "@/lib/dashboard";
import { cambiaDashboard } from "@/lib/dashboard-db";

const elenco = z.array(z.uuid()).max(MAX_FISSATI);

// Salva l'ordine dei grafici della dashboard. Restituisce false se non è stato possibile.
export async function salvaOrdineDashboard(ids: string[]): Promise<boolean> {
  const parsed = elenco.safeParse(ids);
  if (!parsed.success) return false;
  const esito = await cambiaDashboard((salvati) => riordina(salvati, parsed.data));
  return esito.ok;
}

// Toglie un grafico dalla dashboard (il grafico resta salvato nel suo dataset).
export async function togliDallaDashboard(grafico: string) {
  if (!z.uuid().safeParse(grafico).success) redirect("/dashboard");
  const esito = await cambiaDashboard((salvati) => togli(salvati, grafico));
  if (!esito.ok) {
    const t = await getTranslations("dashboard");
    throw new Error(t("nonRiuscito", { dettaglio: esito.dettaglio ?? "" }));
  }
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
