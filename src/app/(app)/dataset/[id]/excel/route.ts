import { getLocale, getTranslations } from "next-intl/server";
import { creaExcel } from "@/lib/excel";
import { creaFormati } from "@/lib/formato";
import { leggiFiltri, type Colonna } from "@/lib/filtri";
import { createClient } from "@/lib/supabase/server";

const BLOCCO = 500;

// Scarica il dataset in Excel (.xlsx), con i filtri dell'indirizzo se ci sono, come l'export CSV.
// Legge a blocchi con i permessi dell'utente (RLS): si scarica solo ciò che si vede.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("dettaglio");
  const f = creaFormati(await getLocale());
  const supabase = await createClient();
  const { data: d } = await supabase.from("dataset").select("nome, colonne").eq("id", id).maybeSingle();
  if (!d) return new Response(t("nonTrovato"), { status: 404 });

  const colonne = d.colonne as Colonna[];
  const url = new URL(request.url);
  const sp = Object.fromEntries([...url.searchParams.keys()].map((k) => [k, url.searchParams.getAll(k)]));
  const { filtri } = leggiFiltri(sp, colonne);

  const righe: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += BLOCCO) {
    const { data, error } = await supabase.rpc("leggi_righe", {
      p_dataset: id,
      p_limite: BLOCCO,
      p_offset: offset,
      p_ordina: "id",
      p_discendente: false,
      p_filtri: filtri,
    });
    if (error) return new Response(error.message, { status: 500 });
    const blocco = (data?.righe ?? []) as Record<string, unknown>[];
    righe.push(...blocco);
    if (blocco.length < BLOCCO) break;
  }

  const file = creaExcel(d.nome, colonne, righe, f.si, f.no);
  return new Response(file as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${d.nome}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
