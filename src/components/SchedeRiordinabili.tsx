"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent as PointerEventReact, type ReactNode } from "react";
import { applicaOrdine, sposta, stessoOrdine } from "@/lib/ordine";

type Voce = { chiave: string; nome: string; contenuto: ReactNode };

// Elementi che restano cliccabili: da lì il mouse non inizia il trascinamento.
const INTERATTIVI = "a, button, input, select, textarea, label, summary";
// Quanti pixel deve muoversi il mouse prima che il trascinamento parta (sotto è un clic).
const SOGLIA = 6;

// Schede che l'utente può riordinare (es. «Colonna per colonna», dashboard): col mouse trascinando
// la scheda, col dito dalla maniglia in alto, da tastiera con le frecce sulla maniglia; la lente
// apre la scheda ingrandita. L'ordine si salva con l'azione `salva` (per utente, grazie alla RLS).
// Con `ripristinabile` l'ordine originale (quello di `voci`) si salva come elenco vuoto e un
// pulsante permette di tornarci.
export function SchedeRiordinabili({
  voci,
  salvato,
  intestazione,
  salva: salvaSulServer,
  ripristinabile = true,
  griglia = "md:grid-cols-2 xl:grid-cols-3",
}: {
  voci: Voce[];
  salvato: string[];
  intestazione: ReactNode;
  salva: (chiavi: string[]) => Promise<boolean>;
  ripristinabile?: boolean;
  griglia?: string;
}) {
  const t = useTranslations("schede");
  const originale = voci.map((v) => v.chiave);
  const [ordine, setOrdine] = useState(() => applicaOrdine(originale, salvato));
  const [trascinata, setTrascinata] = useState<string | null>(null);
  // Scheda premuta col mouse: si ingrandisce un poco per far capire che è stata presa.
  const [premuta, setPremuta] = useState<string | null>(null);
  // Scheda mostrata in primo piano, ingrandita (pulsante con la lente).
  const [aperta, setAperta] = useState<string | null>(null);
  const finestra = useRef<HTMLDialogElement>(null);
  const [annuncio, setAnnuncio] = useState("");
  const [errore, setErrore] = useState(false);
  const maniglie = useRef(new Map<string, HTMLButtonElement>());
  const daRimettereFuoco = useRef<string | null>(null);
  const attesa = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const perChiave = new Map(voci.map((v) => [v.chiave, v]));
  // Colonne aggiunte o tolte dopo il salvataggio: si riallinea senza perdere l'ordine scelto.
  const visibili = applicaOrdine(originale, ordine);
  const modificato = ripristinabile && !stessoOrdine(visibili, originale);

  async function salva(nuovo: string[], subito = true) {
    clearTimeout(attesa.current);
    const esegui = async () => {
      const ok = await salvaSulServer(ripristinabile && stessoOrdine(nuovo, originale) ? [] : nuovo);
      setErrore(!ok);
      if (!ok) setAnnuncio(t("ordineNonSalvato"));
    };
    if (subito) await esegui();
    else attesa.current = setTimeout(esegui, 700);
  }

  useEffect(() => () => clearTimeout(attesa.current), []);

  // Dopo uno spostamento da tastiera la maniglia resta a fuoco.
  useEffect(() => {
    const chiave = daRimettereFuoco.current;
    if (chiave) {
      daRimettereFuoco.current = null;
      maniglie.current.get(chiave)?.focus();
    }
  }, [ordine]);

  function iniziaTrascinamento(e: PointerEventReact<HTMLDivElement>, chiave: string) {
    if (e.button !== 0) return;
    const bersaglio = e.target as HTMLElement;
    const daManiglia = !!bersaglio.closest("[data-maniglia]");
    // Col dito si trascina solo dalla maniglia, così la pagina continua a scorrere.
    if (!daManiglia && (e.pointerType !== "mouse" || bersaglio.closest(INTERATTIVI))) return;

    const inizio = { x: e.clientX, y: e.clientY };
    setPremuta(chiave);
    let attivo = false;
    let corrente = visibili;
    let ultimo: string | null = null;

    const muovi = (ev: PointerEvent) => {
      if (!attivo) {
        if (Math.hypot(ev.clientX - inizio.x, ev.clientY - inizio.y) < SOGLIA) return;
        attivo = true;
        setTrascinata(chiave);
        document.body.style.userSelect = "none";
      }
      ev.preventDefault();
      const sotto = document.elementFromPoint(ev.clientX, ev.clientY)?.closest<HTMLElement>("[data-scheda]");
      const su = sotto?.dataset.scheda ?? null;
      // Si scambia una volta sola per scheda attraversata: con schede di altezza diversa
      // il cambio di posto non deve rimbalzare avanti e indietro.
      if (!su || su === chiave) {
        ultimo = null;
        return;
      }
      if (su === ultimo) return;
      ultimo = su;
      corrente = sposta(corrente, corrente.indexOf(chiave), corrente.indexOf(su));
      setOrdine(corrente);
    };

    const fine = () => {
      window.removeEventListener("pointermove", muovi);
      window.removeEventListener("pointerup", fine);
      window.removeEventListener("pointercancel", fine);
      setPremuta(null);
      if (!attivo) return;
      document.body.style.userSelect = "";
      setTrascinata(null);
      // Il clic che segue il rilascio non deve aprire link o dettagli.
      const blocca = (c: MouseEvent) => {
        c.preventDefault();
        c.stopPropagation();
      };
      window.addEventListener("click", blocca, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", blocca, { capture: true }), 0);
      if (!stessoOrdine(corrente, visibili)) {
        const nome = perChiave.get(chiave)?.nome ?? chiave;
        setAnnuncio(t("schedaSpostata", { nome, pos: corrente.indexOf(chiave) + 1, tot: corrente.length }));
        void salva(corrente);
      }
    };

    window.addEventListener("pointermove", muovi, { passive: false });
    window.addEventListener("pointerup", fine);
    window.addEventListener("pointercancel", fine);
  }

  function tasto(e: KeyboardEvent<HTMLButtonElement>, chiave: string) {
    const da = visibili.indexOf(chiave);
    const a =
      e.key === "ArrowUp" || e.key === "ArrowLeft" ? da - 1
      : e.key === "ArrowDown" || e.key === "ArrowRight" ? da + 1
      : e.key === "Home" ? 0
      : e.key === "End" ? visibili.length - 1
      : null;
    if (a === null) return;
    e.preventDefault();
    if (a < 0 || a >= visibili.length || a === da) return;
    const nuovo = sposta(visibili, da, a);
    daRimettereFuoco.current = chiave;
    setOrdine(nuovo);
    setAnnuncio(t("schedaSpostata", { nome: perChiave.get(chiave)?.nome ?? chiave, pos: a + 1, tot: nuovo.length }));
    void salva(nuovo, false);
  }

  useEffect(() => {
    const d = finestra.current;
    if (aperta && d && !d.open) d.showModal();
  }, [aperta]);

  // Scheda ingrandita tolta nel frattempo (es. «Togli dalla dashboard» dalla finestra): si chiude.
  useEffect(() => {
    if (aperta && !voci.some((v) => v.chiave === aperta)) finestra.current?.close();
  }, [aperta, voci]);

  function chiudi() {
    finestra.current?.close();
  }

  function ripristina() {
    setOrdine(originale);
    setAnnuncio(t("ordineRipristinato"));
    void salva(originale);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        {intestazione}
        {modificato && (
          <button type="button" onClick={ripristina} className="bottone-secondario px-4 py-1.5 text-sm">
            {t("ripristinaOrdine")}
          </button>
        )}
      </div>
      <p id="istruzioni-schede" className="sr-only">{t("istruzioniSposta")}</p>
      <p aria-live="polite" className={errore ? "text-sm text-red-600" : "sr-only"}>{annuncio}</p>
      <div className={`grid gap-4 ${griglia}`}>
        {visibili.map((chiave) => {
          const v = perChiave.get(chiave)!;
          const presa = trascinata === chiave || premuta === chiave;
          return (
            <div
              key={chiave}
              data-scheda={chiave}
              onPointerDown={(e) => iniziaTrascinamento(e, chiave)}
              className={`relative min-w-0 rounded-3xl transition-[transform,box-shadow] duration-150 ${
                presa ? "z-10 scale-[1.03] cursor-grabbing shadow-2xl ring-2 ring-foreground" : "cursor-grab"
              }`}
            >
              <button
                type="button"
                data-maniglia
                ref={(el) => {
                  if (el) maniglie.current.set(chiave, el);
                  else maniglie.current.delete(chiave);
                }}
                onKeyDown={(e) => tasto(e, chiave)}
                aria-label={t("spostaScheda", { nome: v.nome })}
                aria-describedby="istruzioni-schede"
                title={t("trascinaPerSpostare")}
                className="absolute top-1.5 left-1/2 flex h-6 w-10 -translate-x-1/2 touch-none items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
              >
                <svg width="16" height="10" viewBox="0 0 16 10" aria-hidden="true" fill="currentColor">
                  {[2, 8, 14].flatMap((x) => [2, 8].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setAperta(chiave)}
                aria-label={t("ingrandisciScheda", { nome: v.nome })}
                title={t("ingrandisciScheda", { nome: v.nome })}
                className="absolute top-4 right-4 flex size-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="10.5" cy="10.5" r="6.5" />
                  <path d="m15.5 15.5 5 5M10.5 7.5v6M7.5 10.5h6" />
                </svg>
              </button>
              {v.contenuto}
            </div>
          );
        })}
      </div>
      {/* Fuori dalla griglia: i clic nella finestra non devono avviare il trascinamento. */}
      <dialog
        ref={finestra}
        onClose={() => setAperta(null)}
        onClick={(e) => e.target === e.currentTarget && chiudi()}
        aria-label={aperta ? perChiave.get(aperta)?.nome : undefined}
        className="m-auto w-[min(64rem,calc(100vw-2rem))] max-w-none overflow-visible bg-transparent p-0 backdrop:bg-slate-950/50"
      >
        {aperta && perChiave.has(aperta) && (
          <div className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl text-lg [--scala-grafici:1.6]">
            <button
              type="button"
              onClick={chiudi}
              aria-label={t("chiudi")}
              title={t("chiudi")}
              className="absolute top-4 right-4 z-10 flex size-9 items-center justify-center rounded-full bg-white text-slate-600 hover:bg-slate-100 hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground focus-visible:outline-none"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
            </button>
            {perChiave.get(aperta)!.contenuto}
          </div>
        )}
      </dialog>
    </>
  );
}
