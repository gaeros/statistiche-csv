import "server-only";
import { getLocale, getTranslations } from "next-intl/server";
import { creaFormati } from "@/lib/formato";
import { conParametri, leggiFiltri, soloFiltri, type Colonna, type Parametri } from "@/lib/filtri";
import { leggiSalvati } from "@/lib/filtri-salvati";
import type { createClient } from "@/lib/supabase/server";

// Oltre questo numero di valori diversi una colonna di testo si filtra con la ricerca, non con le caselle.
const MAX_CASELLE = 30;

// Filtri attivi e valori tra cui scegliere, comuni a tutte le schede del dataset.
export async function filtriDataset(
  supabase: Awaited<ReturnType<typeof createClient>>,
  id: string,
  colonne: Colonna[],
  sp: Parametri,
) {
  const t = await getTranslations("filtri");
  const f = creaFormati(await getLocale());
  const { filtri, etichette } = leggiFiltri(sp, colonne, { t, f });
  const categorie = colonne.filter((c) => c.tipo === "testo" || c.tipo === "booleano");
  const [risposte, salvati] = await Promise.all([
    Promise.all(
      categorie.map((c) => supabase.rpc("valori_colonna", { p_dataset: id, p_colonna: c.nome, p_limite: MAX_CASELLE + 1 })),
    ),
    supabase.from("filtri_salvati").select("id, nome, parametri").eq("dataset_id", id).order("nome"),
  ]);
  const valori = Object.fromEntries(
    categorie.map((c, i) => {
      const v = (risposte[i].data ?? []) as { valore: string; conteggio: number }[];
      return [c.nome, v.length > MAX_CASELLE ? null : v];
    }),
  );
  // Parte dell'indirizzo con i soli filtri, per passare da una scheda all'altra senza perderli.
  const queryFiltri = etichette.length ? conParametri(soloFiltri(sp), {}) : "";
  // Filtri salvati del dataset; null se la tabella non c'è ancora (migrazione da applicare): la barra li nasconde.
  return { filtri, etichette, valori, queryFiltri, salvati: salvati.error ? null : leggiSalvati(salvati.data) };
}
