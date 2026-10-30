export function Messaggio({ tipo, testo }: { tipo: "errore" | "ok"; testo?: string | null }) {
  if (!testo) return null;
  const stile =
    tipo === "errore"
      ? "border-red-300 bg-red-50 text-red-800"
      : "border-green-300 bg-green-50 text-green-800";
  return (
    <p role={tipo === "errore" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${stile}`}>
      {testo}
    </p>
  );
}
