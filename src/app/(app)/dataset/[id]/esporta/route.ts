import { getTranslations } from "next-intl/server";
import { BOM, cella, cellaTesto, riga } from "@/lib/csv";
import { leggiFiltri, type Colonna } from "@/lib/filtri";
import { createClient } from "@/lib/supabase/server";
import { formatiUtente } from "@/lib/utente";

const BLOCCO = 500;

// Scarica il dataset in CSV, con i filtri dell'indirizzo se ci sono. Legge a blocchi con i permessi
// dell'utente (RLS), così si può scaricare solo ciò che si vede.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = await getTranslations("dettaglio");
  const f = await formatiUtente();
  const supabase = await createClient();
  const { data: d } = await supabase.from("dataset").select("nome, colonne").eq("id", id).maybeSingle();
  if (!d) return new Response(t("nonTrovato"), { status: 404 });

  const colonne = d.colonne as Colonna[];
  const sp = Object.fromEntries(
    [...new URL(request.url).searchParams.keys()].map((k) => [k, new URL(request.url).searchParams.getAll(k)]),
  );
  const { filtri } = leggiFiltri(sp, colonne);
  const codifica = new TextEncoder();

  const flusso = new ReadableStream({
    async start(controller) {
      controller.enqueue(codifica.encode(BOM + riga(colonne.map((c) => cellaTesto(c.originale)), f.virgola)));
      for (let offset = 0; ; offset += BLOCCO) {
        const { data, error } = await supabase.rpc("leggi_righe", {
          p_dataset: id,
          p_limite: BLOCCO,
          p_offset: offset,
          p_ordina: "id",
          p_discendente: false,
          p_filtri: filtri,
        });
        if (error) {
          controller.error(new Error(error.message));
          return;
        }
        const righe = (data?.righe ?? []) as Record<string, unknown>[];
        if (righe.length) controller.enqueue(codifica.encode(righe.map((r) => riga(colonne.map((c) => cella(r[c.nome], c.tipo, f)), f.virgola)).join("")));
        if (righe.length < BLOCCO) break;
      }
      controller.close();
    },
  });

  return new Response(flusso, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${d.nome}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
