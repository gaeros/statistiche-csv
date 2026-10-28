"use client";

// Apertura della pagina di benvenuto, guidata dallo scorrimento:
// 1) «Dai tuoi file di numeri» con numeri grigi e neri che si muovono a caso;
// 2) scorrendo, il testo lascia il posto a «a grafici che si capiscono», con sotto barre e torta colorate.
// Con «riduci movimento» si vede tutto fermo, senza scorrimento guidato.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const COLORI = ["#2563eb", "#f59e0b", "#10b981", "#ec4899", "#8b5cf6", "#06b6d4", "#ef4444", "#84cc16"];
const BARRE = [44, 60, 38, 78, 54, 70, 90, 64];
const FETTE = [38, 24, 17, 12, 9];
const SCARTO_INTESTAZIONE = 64; // altezza della barra in alto, in px
const CIRC = 2 * Math.PI * 44;
const RIDUCI = "(prefers-reduced-motion: reduce)";

function osservaRiduciMovimento(avvisa: () => void) {
  const mq = window.matchMedia(RIDUCI);
  mq.addEventListener("change", avvisa);
  return () => mq.removeEventListener("change", avvisa);
}

type Numero = { id: number; x: number; y: number; testo: string; scuro: boolean; dim: number; dur: number; ritardo: number; dx: number; dy: number };

const tra = (a: number, b: number) => a + Math.random() * (b - a);
const testoCasuale = () => {
  const r = Math.random();
  if (r < 0.4) return String(Math.floor(tra(10, 200)));
  if (r < 0.7) return tra(1, 99).toFixed(1).replace(".", ",");
  if (r < 0.85) return String(Math.floor(tra(1, 9))) + "%";
  return String(Math.floor(tra(1000, 9999)));
};
const creaNumeri = (n: number): Numero[] =>
  Array.from({ length: n }, (_, id) => ({
    id,
    x: tra(2, 92),
    y: tra(4, 88),
    testo: testoCasuale(),
    scuro: Math.random() < 0.4,
    dim: tra(14, 36),
    dur: tra(6, 14),
    ritardo: -tra(0, 10),
    dx: tra(-40, 40),
    dy: tra(-40, 40),
  }));

const liscia = (t: number) => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

function Barre({ attivo }: { attivo: boolean }) {
  return (
    <div className="flex h-28 items-end gap-2 sm:h-52 sm:gap-3">
      {BARRE.map((h, i) => (
        <div
          key={i}
          className="h-full w-6 origin-bottom sm:w-9"
          style={{
            transform: `scaleY(${attivo ? 1 : 0})`,
            transition: `transform 450ms cubic-bezier(.2,.8,.2,1) ${i * 45}ms`,
          }}
        >
          <div className="flex h-full items-end">
            <div
              className="anim-respira w-full origin-bottom rounded-t-lg"
              style={{ height: `${h}%`, background: COLORI[i % COLORI.length], animationDelay: `${i * -0.7}s` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function Torta({ attivo }: { attivo: boolean }) {
  const totale = FETTE.reduce((a, b) => a + b, 0);
  const inizi = FETTE.map((_, i) => (FETTE.slice(0, i).reduce((a, b) => a + b, 0) / totale) * CIRC);
  return (
    <svg
      viewBox="0 0 120 120"
      className="h-32 w-32 sm:h-52 sm:w-52"
      style={{
        opacity: attivo ? 1 : 0,
        transform: `scale(${attivo ? 1 : 0.6}) rotate(${attivo ? 0 : -120}deg)`,
        transition: "opacity 400ms ease, transform 600ms cubic-bezier(.2,.8,.2,1)",
      }}
    >
      <g className="anim-ruota" style={{ transformOrigin: "60px 60px" }}>
        {FETTE.map((v, i) => {
          const lunghezza = (v / totale) * CIRC;
          return (
            <circle
              key={i}
              className="anim-fetta"
              cx="60"
              cy="60"
              r="44"
              fill="none"
              stroke={COLORI[(i * 2 + 1) % COLORI.length]}
              strokeWidth="22"
              strokeDasharray={`${Math.max(0, lunghezza - 1.5)} ${CIRC - lunghezza + 1.5}`}
              strokeDashoffset={-inizi[i]}
              transform="rotate(-90 60 60)"
              style={{ animationDelay: `${i * -0.9}s` }}
            />
          );
        })}
      </g>
    </svg>
  );
}

export function HeroScorrimento({ a, b, descrizione, scorri }: { a: string; b: string; descrizione: string; scorri: string }) {
  const contenitore = useRef<HTMLDivElement>(null);
  const fisso = useRef<HTMLDivElement>(null);
  const [p, setP] = useState(0);
  const ridotto = useSyncExternalStore(osservaRiduciMovimento, () => window.matchMedia(RIDUCI).matches, () => false);
  const [numeri, setNumeri] = useState<Numero[]>([]);

  useEffect(() => {
    // I numeri sono casuali: si creano solo nel browser, dopo il primo disegno, per non sfasare il rendering del server.
    const avvio = setTimeout(() => setNumeri(creaNumeri(window.innerWidth < 640 ? 18 : 30)), 0);
    const cambia = ridotto
      ? undefined
      : setInterval(() => {
          setNumeri((v) => v.map((n) => (Math.random() < 0.12 ? { ...n, testo: testoCasuale() } : n)));
        }, 900);
    return () => {
      clearTimeout(avvio);
      if (cambia) clearInterval(cambia);
    };
  }, [ridotto]);

  useEffect(() => {
    if (ridotto) return;
    const leggi = () => {
      const c = contenitore.current;
      const f = fisso.current;
      if (!c || !f) return;
      const r = c.getBoundingClientRect();
      const totale = r.height - f.offsetHeight;
      const v = totale > 0 ? Math.min(1, Math.max(0, (SCARTO_INTESTAZIONE - r.top) / totale)) : 0;
      setP(Math.round(v * 100) / 100);
    };
    leggi();
    window.addEventListener("scroll", leggi, { passive: true });
    window.addEventListener("resize", leggi);
    return () => {
      window.removeEventListener("scroll", leggi);
      window.removeEventListener("resize", leggi);
    };
  }, [ridotto]);

  const titolo = "text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl md:text-8xl";

  if (ridotto) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-16 text-center">
        <h1 className={titolo}>
          <span className="sr-only">{descrizione}</span>
          <span aria-hidden className="block text-slate-400">{a}</span>
          <span aria-hidden className="block text-foreground">{b}</span>
        </h1>
        <div aria-hidden className="flex flex-wrap items-end justify-center gap-10 pt-6">
          <Barre attivo />
          <Torta attivo />
        </div>
      </div>
    );
  }

  const opA = 1 - liscia((p - 0.25) / 0.1);
  const opB = liscia((p - 0.29) / 0.1);
  const opNumeri = 1 - liscia((p - 0.1) / 0.2);
  const opGrafici = liscia((p - 0.36) / 0.1);
  const opSuggerimento = 1 - liscia(p / 0.06);

  return (
    <div ref={contenitore} className="relative" style={{ height: "220svh" }}>
      <div ref={fisso} className="sticky overflow-hidden" style={{ top: SCARTO_INTESTAZIONE, height: `calc(100svh - ${SCARTO_INTESTAZIONE}px)` }}>
        <div className="mx-auto flex h-full max-w-6xl flex-col px-4 text-center">
          <div aria-hidden className="relative min-h-0 flex-1" style={{ opacity: opNumeri }}>
            {numeri.map((n) => (
              <span
                key={n.id}
                className="anim-deriva absolute whitespace-nowrap font-mono font-semibold"
                style={{
                  left: `${n.x}%`,
                  top: `${n.y}%`,
                  fontSize: n.dim,
                  color: n.scuro ? "#09090b" : "#94a3b8",
                  animationDuration: `${n.dur}s`,
                  animationDelay: `${n.ritardo}s`,
                  ["--dx" as string]: `${n.dx}px`,
                  ["--dy" as string]: `${n.dy}px`,
                }}
              >
                {n.testo}
              </span>
            ))}
          </div>

          <h1 className={`grid ${titolo}`}>
            <span className="sr-only">{descrizione}</span>
            <span aria-hidden className="col-start-1 row-start-1 text-slate-400" style={{ opacity: opA, transform: `translateY(${(1 - opA) * -14}px)` }}>{a}</span>
            <span aria-hidden className="col-start-1 row-start-1 text-foreground" style={{ opacity: opB, transform: `translateY(${(1 - opB) * 14}px)` }}>{b}</span>
          </h1>

          <div aria-hidden className="relative flex flex-1 items-start justify-center pt-6" style={{ opacity: opGrafici }}>
            <div className="flex flex-wrap items-end justify-center gap-8 sm:gap-14">
              <Barre attivo={p > 0.4} />
              <Torta attivo={p > 0.4} />
            </div>
          </div>
          <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-4 text-sm font-medium text-slate-400" style={{ opacity: opSuggerimento }}>
            <span className="anim-suggerimento inline-block">{scorri} ↓</span>
          </div>
        </div>
      </div>
    </div>
  );
}
