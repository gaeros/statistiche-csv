import Link from "next/link";
import { notFound } from "next/navigation";
import { formattaValore } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { Azioni } from "./Azioni";
import { Intestazione } from "./Intestazione";

const PER_PAGINA = 50;

type Colonna = { nome: string; originale: string; tipo: string };

export default async function PaginaDettaglio({ params, searchParams }: PageProps<"/dataset/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const pagina = Math.max(1, Number(sp.pagina) || 1);
  const ordina = typeof sp.ordina === "string" ? sp.ordina : "id";
  const discendente = sp.dir === "desc";

  const supabase = await createClient();
  const { data: d } = await supabase
    .from("dataset")
    .select("id, nome, nome_originale, foglio, colonne, righe, avvisi, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();

  const colonne = d.colonne as Colonna[];
  const { data: risultato, error } = await supabase.rpc("leggi_righe", {
    p_dataset: id,
    p_limite: PER_PAGINA,
    p_offset: (pagina - 1) * PER_PAGINA,
    p_ordina: ordina,
    p_discendente: discendente,
  });
  const totale: number = risultato?.totale ?? 0;
  const righe: Record<string, unknown>[] = risultato?.righe ?? [];
  const pagine = Math.max(1, Math.ceil(totale / PER_PAGINA));
  const avvisi = (d.avvisi as string[]) ?? [];

  const link = (modifiche: Record<string, string | number>) => {
    const p = new URLSearchParams({ pagina: String(pagina), ordina, dir: discendente ? "desc" : "asc" });
    for (const [k, v] of Object.entries(modifiche)) p.set(k, String(v));
    return `/dataset/${id}?${p}`;
  };

  return (
    <div className="space-y-6">
      <Intestazione
        id={d.id}
        nome={d.nome}
        nomeOriginale={d.nome_originale}
        foglio={d.foglio}
        createdAt={d.created_at}
        righe={d.righe}
        colonne={colonne.length}
        attiva="dati"
      />

      {avvisi.length > 0 && (
        <details className="scheda text-sm">
          <summary className="cursor-pointer font-medium">Avvisi dell&apos;importazione ({avvisi.length})</summary>
          <ul className="mt-2 list-inside list-disc text-slate-600 dark:text-slate-300">
            {avvisi.map((a) => <li key={a}>{a}</li>)}
          </ul>
        </details>
      )}

      {error && <p className="text-red-600">Impossibile leggere le righe: {error.message}</p>}

      <div className="scheda overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
            <tr>
              {colonne.map((c) => {
                const attiva = ordina === c.nome;
                return (
                  <th
                    key={c.nome}
                    className={`whitespace-nowrap px-3 py-2 font-medium ${
                      c.tipo === "intero" || c.tipo === "decimale" ? "text-right" : ""
                    }`}
                  >
                    <Link
                      href={link({ ordina: c.nome, dir: attiva && !discendente ? "desc" : "asc", pagina: 1 })}
                      className="hover:underline"
                      title={`${c.nome} (${c.tipo})`}
                    >
                      {c.originale}
                      {attiva ? (discendente ? " ↓" : " ↑") : ""}
                    </Link>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {righe.map((r) => (
              <tr key={String(r.id)} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                {colonne.map((c) => (
                  <td
                    key={c.nome}
                    className={`max-w-xs truncate whitespace-nowrap px-3 py-1.5 ${
                      c.tipo === "intero" || c.tipo === "decimale" ? "text-right tabular-nums" : ""
                    }`}
                  >
                    {formattaValore(r[c.nome], c.tipo)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <nav className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          Pagina {pagina} di {pagine}
        </span>
        <div className="flex gap-2">
          {pagina > 1 && <Link href={link({ pagina: pagina - 1 })} className="bottone-secondario px-3 py-1">← Precedente</Link>}
          {pagina < pagine && <Link href={link({ pagina: pagina + 1 })} className="bottone-secondario px-3 py-1">Successiva →</Link>}
        </div>
      </nav>

      <Azioni id={d.id} nome={d.nome} />
    </div>
  );
}
