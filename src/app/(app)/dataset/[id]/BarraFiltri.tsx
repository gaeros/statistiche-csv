import { getLocale, getTranslations } from "next-intl/server";
import Link from "next/link";
import { CampiNascosti } from "@/components/CampiNascosti";
import { FormPulito } from "@/components/FormPulito";
import { creaFormati } from "@/lib/formato";
import {
  chiave,
  conParametri,
  GIORNI,
  SCORCIATOIE,
  senzaFiltri,
  type Colonna,
  type Etichetta,
  type Parametri,
} from "@/lib/filtri";

type Valore = { valore: string; conteggio: number };

function primo(sp: Parametri, k: string): string {
  const v = sp[k];
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

function elenco(sp: Parametri, k: string): string[] {
  const v = sp[k];
  return Array.isArray(v) ? v : v === undefined ? [] : [v];
}

function Gruppo({ titolo, children }: { titolo: string; children: React.ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-800">
      <legend className="px-1 text-sm font-medium">{titolo}</legend>
      {children}
    </fieldset>
  );
}

function Casella({ nome, valore, etichetta, scelta }: { nome: string; valore: string; etichetta: string; scelta: boolean }) {
  return (
    <label className="inline-flex items-center gap-1.5 text-sm">
      <input type="checkbox" name={nome} value={valore} defaultChecked={scelta} />
      {etichetta}
    </label>
  );
}

// Barra dei filtri: vale per tutte le schede del dataset (dati, statistiche e grafici).
export async function BarraFiltri({
  colonne,
  sp,
  etichette,
  valori,
  totale,
  complessivo,
}: {
  colonne: Colonna[];
  sp: Parametri;
  etichette: Etichetta[];
  valori: Record<string, Valore[] | null>;
  totale?: number;
  complessivo?: number;
}) {
  const t = await getTranslations("barraFiltri");
  const tf = await getTranslations("filtri");
  const f = creaFormati(await getLocale());
  const attivi = etichette.length > 0;
  const campo = "campo py-1.5 text-sm";

  return (
    <section className="space-y-3">
      <details className="scheda p-0" open={false}>
        <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 select-none">
          <span className="font-medium">
            {t("titolo")}{" "}
            {attivi && (
              <span className="ml-1 rounded-full bg-blue-600 px-2 py-0.5 text-xs font-semibold text-white">{etichette.length}</span>
            )}
          </span>
          <span className="text-sm text-slate-500">
            {totale !== undefined && complessivo !== undefined && attivi
              ? t("righeSu", { totale: f.numero(totale), complessivo: f.numero(complessivo) })
              : t("suggerimento")}
          </span>
        </summary>

        <FormPulito className="space-y-4 border-t border-slate-200 p-4 dark:border-slate-800">
          <CampiNascosti sp={sp} tieni={(k) => !k.startsWith("f.") && k !== "pagina"} />
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {colonne.map((c) => {
              const k = (x: string) => chiave(c.nome, x);

              if (c.tipo === "data" || c.tipo === "data_ora") {
                const giorni = elenco(sp, k("g"));
                return (
                  <Gruppo key={c.nome} titolo={c.originale}>
                    <select name={k("p")} defaultValue={primo(sp, k("p"))} className={campo} aria-label={t("periodoDi", { colonna: c.originale })}>
                      <option value="">{t("tuttoPeriodo")}</option>
                      {SCORCIATOIE.map((v) => {
                        const e = tf(`scorciatoia_${v}`);
                        return (
                          <option key={v} value={v}>
                            {e.charAt(0).toUpperCase() + e.slice(1)}
                          </option>
                        );
                      })}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-xs text-slate-500">
                        <span>{t("dal")}</span>
                        <input type="date" name={k("da")} defaultValue={primo(sp, k("da"))} className={campo} />
                      </label>
                      <label className="space-y-1 text-xs text-slate-500">
                        <span>{t("al")}</span>
                        <input type="date" name={k("a")} defaultValue={primo(sp, k("a"))} className={campo} />
                      </label>
                    </div>
                    {c.tipo === "data_ora" && (
                      <div className="grid grid-cols-2 gap-2">
                        {(["dalle", "alle"] as const).map((x) => (
                          <label key={x} className="space-y-1 text-xs text-slate-500">
                            <span>{t(x === "dalle" ? "dalleOre" : "alleOre")}</span>
                            <select name={k(x)} defaultValue={primo(sp, k(x))} className={campo}>
                              <option value="">–</option>
                              {Array.from({ length: 25 }, (_, h) => (
                                <option key={h} value={h}>{h}</option>
                              ))}
                            </select>
                          </label>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {GIORNI.map((g) => (
                        <Casella key={g} nome={k("g")} valore={String(g)} etichetta={tf(`giorno_${g}`)} scelta={giorni.includes(String(g))} />
                      ))}
                    </div>
                  </Gruppo>
                );
              }

              if (c.tipo === "intero" || c.tipo === "decimale") {
                return (
                  <Gruppo key={c.nome} titolo={c.originale}>
                    <div className="grid grid-cols-2 gap-2">
                      <label className="space-y-1 text-xs text-slate-500">
                        <span>{t("da")}</span>
                        <input type="number" step="any" name={k("da")} defaultValue={primo(sp, k("da"))} className={campo} />
                      </label>
                      <label className="space-y-1 text-xs text-slate-500">
                        <span>{t("a")}</span>
                        <input type="number" step="any" name={k("a")} defaultValue={primo(sp, k("a"))} className={campo} />
                      </label>
                    </div>
                  </Gruppo>
                );
              }

              const scelti = elenco(sp, k("v"));
              const opzioni = valori[c.nome];
              return (
                <Gruppo key={c.nome} titolo={c.originale}>
                  {opzioni ? (
                    <div className="flex max-h-40 flex-wrap gap-x-4 gap-y-1 overflow-y-auto">
                      {opzioni.map((o) => (
                        <Casella
                          key={o.valore}
                          nome={k("v")}
                          valore={o.valore}
                          etichetta={c.tipo === "booleano" ? (o.valore === "true" ? f.si : f.no) : o.valore}
                          scelta={scelti.includes(o.valore)}
                        />
                      ))}
                    </div>
                  ) : (
                    <input type="search" name={k("t")} defaultValue={primo(sp, k("t"))} placeholder={t("contiene")} className={campo} />
                  )}
                </Gruppo>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" className="bottone">{t("applica")}</button>
            {attivi && (
              <Link href={conParametri(senzaFiltri(sp), { pagina: null })} className="link text-sm">
                {t("azzera")}
              </Link>
            )}
          </div>
        </FormPulito>
      </details>

      {attivi && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {etichette.map((e) => (
            <Link
              key={e.testo}
              href={conParametri(sp, Object.fromEntries([...e.chiavi, "pagina"].map((x) => [x, null])))}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-blue-800 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-200 dark:hover:bg-blue-900"
              title={t("togli")}
            >
              {e.testo}
              <span aria-hidden>✕</span>
              <span className="sr-only">{t("tolgoSr")}</span>
            </Link>
          ))}
          <Link href={conParametri(senzaFiltri(sp), { pagina: null })} className="link ml-1">
            {t("azzera")}
          </Link>
        </div>
      )}
    </section>
  );
}
