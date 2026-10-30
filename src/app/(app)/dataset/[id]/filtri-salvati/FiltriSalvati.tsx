"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useActionState } from "react";
import { ConfermaElimina } from "@/components/ConfermaElimina";
import { Messaggio } from "@/components/Messaggio";
import { MAX_NOME } from "@/lib/filtri-salvati";
import { eliminaFiltri, rinominaFiltri, salvaFiltri } from "./actions";

export type Salvato = { id: string; nome: string; href: string; attivo: boolean };

function Riga({ id, salvato, ritorno }: { id: string; salvato: Salvato; ritorno: string }) {
  const t = useTranslations("filtriSalvati");
  const [stato, azione, inCorso] = useActionState(rinominaFiltri.bind(null, id, salvato.id), undefined);
  return (
    <li className="space-y-2 border-t border-slate-200 pt-3 first:border-t-0 first:pt-0">
      {/* Due moduli affiancati: quello di conferma dell'eliminazione non può stare dentro quello del nome. */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <form action={azione} className="flex min-w-0 flex-1 items-center gap-2">
          <label className="min-w-0 flex-1">
            <span className="sr-only">{t("nomeDi", { nome: salvato.nome })}</span>
            <input name="nome" defaultValue={salvato.nome} maxLength={MAX_NOME} required className="campo py-1.5 text-sm" />
          </label>
          <button type="submit" disabled={inCorso} className="bottone-secondario shrink-0 px-3 py-1 text-sm">
            {t("rinomina")}
          </button>
        </form>
        <div className="shrink-0 text-sm">
          <ConfermaElimina
            etichetta={t("elimina")}
            titolo={t("eliminaTitolo", { nome: salvato.nome })}
            avviso={t("eliminaAvviso")}
            conferma={t("eliminaConferma")}
            azione={eliminaFiltri.bind(null, id, salvato.id)}
          >
            <input type="hidden" name="ritorno" value={ritorno} />
          </ConfermaElimina>
        </div>
      </div>
      <Messaggio tipo="errore" testo={stato?.errore} />
      <Messaggio tipo="ok" testo={stato?.ok} />
    </li>
  );
}

// Filtri salvati del dataset: si riaprono con un clic; i filtri attivi si salvano con un nome.
export function FiltriSalvati({
  id,
  salvati,
  attivi,
  query,
  ritorno,
}: {
  id: string;
  salvati: Salvato[];
  // Ci sono filtri attivi; "query" è la parte "?..." dell'indirizzo con i soli filtri.
  attivi: boolean;
  query: string;
  ritorno: string;
}) {
  const t = useTranslations("filtriSalvati");
  const [stato, azione, inCorso] = useActionState(salvaFiltri.bind(null, id), undefined);
  const giaSalvato = salvati.find((s) => s.attivo);
  if (!attivi && salvati.length === 0) return null;

  return (
    <div className="space-y-2 text-sm">
      {salvati.length > 0 && (
        <nav aria-label={t("titolo")} className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500">{t("titolo")}:</span>
          {salvati.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              aria-current={s.attivo ? "true" : undefined}
              className={`rounded-full border px-3 py-1 ${
                s.attivo
                  ? "border-foreground bg-foreground text-white"
                  : "border-slate-300 text-slate-900 hover:bg-slate-100"
              }`}
            >
              {s.nome}
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-col gap-2">
        {attivi && !giaSalvato && (
          <details className="group">
            <summary className="link w-fit cursor-pointer list-none">{t("salvaQuesti")}</summary>
            <form action={azione} className="mt-2 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
              <input type="hidden" name="query" value={query} />
              <label className="block min-w-0 flex-1 space-y-1">
                <span className="text-xs text-slate-500">{t("nome")}</span>
                <input name="nome" maxLength={MAX_NOME} required placeholder={t("esempio")} className="campo py-1.5 text-sm" />
              </label>
              <button type="submit" disabled={inCorso} className="bottone shrink-0 px-3 py-1.5">
                {t("salva")}
              </button>
            </form>
          </details>
        )}
        <Messaggio tipo="errore" testo={stato?.errore} />
        <Messaggio tipo="ok" testo={stato?.ok} />

        {salvati.length > 0 && (
          <details>
            <summary className="link w-fit cursor-pointer list-none">{t("gestisci")}</summary>
            <ul className="mt-2 max-w-xl space-y-3 rounded-lg border border-slate-200 p-3">
              {salvati.map((s) => (
                <Riga key={s.id} id={id} salvato={s} ritorno={ritorno} />
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
