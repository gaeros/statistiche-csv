"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const ordine = z.array(z.string().min(1).max(200)).max(1000);

// Salva l'ordine delle schede «Colonna per colonna» (vuoto = ordine originale del file).
// Restituisce false se non è stato possibile salvarlo.
export async function salvaOrdineSchede(id: string, nomi: string[]): Promise<boolean> {
  const parsed = ordine.safeParse(nomi);
  if (!parsed.success || !z.uuid().safeParse(id).success) return false;
  const supabase = await createClient();
  const { error } = await supabase.from("dataset").update({ ordine_schede: parsed.data }).eq("id", id);
  return !error;
}
