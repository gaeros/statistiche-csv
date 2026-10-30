"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { FormElimina } from "@/app/(app)/account/FormElimina";

// Icona persona nella barra in alto: al clic apre sotto un riquadro con l'email,
// il link a Il mio account e «Cancella account» (stessa conferma ELIMINA della pagina account).
// È un pulsante a scomparsa (aria-expanded): Esc o un clic fuori lo chiudono e il focus torna all'icona.
export function MenuAccount({ email }: { email: string }) {
  const t = useTranslations("app");
  const [aperto, setAperto] = useState(false);
  const contenitore = useRef<HTMLDivElement>(null);
  const bottone = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aperto) return;
    const suClic = (e: PointerEvent) => {
      if (!contenitore.current?.contains(e.target as Node)) setAperto(false);
    };
    const suTasto = (e: KeyboardEvent) => {
      // Con la finestra di conferma aperta Esc chiude solo quella.
      if (e.key !== "Escape" || document.querySelector("dialog[open]")) return;
      setAperto(false);
      bottone.current?.focus();
    };
    const suFocus = (e: FocusEvent) => {
      const verso = e.relatedTarget as Node | null;
      if (verso && !contenitore.current?.contains(verso)) setAperto(false);
    };
    const c = contenitore.current;
    document.addEventListener("pointerdown", suClic);
    document.addEventListener("keydown", suTasto);
    c?.addEventListener("focusout", suFocus);
    return () => {
      document.removeEventListener("pointerdown", suClic);
      document.removeEventListener("keydown", suTasto);
      c?.removeEventListener("focusout", suFocus);
    };
  }, [aperto]);

  return (
    <div ref={contenitore} className="relative">
      <button
        ref={bottone}
        type="button"
        aria-expanded={aperto}
        aria-controls={`${id}-menu`}
        aria-label={t("menuAccount")}
        title={t("menuAccount")}
        onClick={() => setAperto((a) => !a)}
        className={`flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 ${aperto ? "bg-foreground text-white" : "bg-white text-slate-700 hover:bg-slate-100"}`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21a8 8 0 0 1 16 0" />
        </svg>
      </button>
      {aperto && (
        <div
          id={`${id}-menu`}
          className="absolute right-0 top-full z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-left text-sm shadow-lg"
        >
          <p>
            <span className="block text-xs text-slate-500">{t("accessoCome")}</span>
            <b className="break-all">{email}</b>
          </p>
          <Link href="/account" className="link block" onClick={() => setAperto(false)}>{t("account")}</Link>
          <div className="border-t border-slate-200 pt-3">
            <FormElimina
              etichetta={t("cancellaAccount")}
              classeApri="inline-flex h-9 w-full items-center justify-center rounded-full bg-red-600 px-4 font-semibold text-white hover:bg-red-700"
            />
          </div>
        </div>
      )}
    </div>
  );
}
