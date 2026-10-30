"use client";

import { useLocale } from "next-intl";
import { createContext, useContext, useMemo } from "react";
import { creaFormati } from "@/lib/formato";
import { PREFERENZE_BASE, type Preferenze } from "@/lib/preferenze";

// Formati scelti dall'utente (data e decimali) per i componenti che girano nel browser:
// il layout dell'app li legge dal profilo e li passa qui. Fuori dall'app (es. pagine condivise) valgono quelli della lingua.
const Contesto = createContext<Preferenze>(PREFERENZE_BASE);

export function FormatiUtente({ preferenze, children }: { preferenze: Preferenze; children: React.ReactNode }) {
  return <Contesto.Provider value={preferenze}>{children}</Contesto.Provider>;
}

export function useFormati() {
  const lingua = useLocale();
  const preferenze = useContext(Contesto);
  return useMemo(() => creaFormati(lingua, preferenze), [lingua, preferenze]);
}
