"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";

type Voce = { id: string; nome: string };

// Ricerca compatta della dashboard: suggerisce i soli nomi dei dataset e, scelto un nome,
// apre subito i grafici di quel dataset. Occupa una riga, così lo spazio resta ai grafici.
export function ScegliDataset({ voci, etichetta, segnaposto, apri, nessuno }: {
  voci: Voce[];
  etichetta: string;
  segnaposto: string;
  apri: string;
  nessuno: string;
}) {
  const router = useRouter();
  const elenco = useId();
  const campo = useId();
  const [testo, setTesto] = useState("");
  const [nonTrovato, setNonTrovato] = useState(false);

  const trova = (valore: string, ancheParziale: boolean) => {
    const v = valore.trim().toLowerCase();
    if (!v) return undefined;
    return voci.find((d) => d.nome.toLowerCase() === v) ?? (ancheParziale ? voci.find((d) => d.nome.toLowerCase().includes(v)) : undefined);
  };
  const vai = (d: Voce | undefined) => {
    if (d) router.push(`/dataset/${d.id}/grafici`);
    setNonTrovato(!d);
  };

  return (
    <form
      role="search"
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        vai(trova(testo, true));
      }}
    >
      <label htmlFor={campo} className="sr-only">{etichetta}</label>
      <input
        id={campo}
        list={elenco}
        value={testo}
        placeholder={segnaposto}
        autoComplete="off"
        className="campo w-64 max-w-full py-2"
        onChange={(e) => {
          setTesto(e.target.value);
          setNonTrovato(false);
          // Scegliendo un suggerimento il campo contiene il nome esatto: si apre subito.
          const d = trova(e.target.value, false);
          if (d) vai(d);
        }}
      />
      <datalist id={elenco}>
        {voci.map((d) => <option key={d.id} value={d.nome} />)}
      </datalist>
      <button type="submit" className="bottone-secondario py-2 text-sm">{apri}</button>
      {nonTrovato && <p role="status" className="w-full text-sm text-slate-500">{nessuno}</p>}
    </form>
  );
}
