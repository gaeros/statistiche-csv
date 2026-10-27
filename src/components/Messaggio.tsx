export function Messaggio({ tipo, testo }: { tipo: "errore" | "ok"; testo?: string | null }) {
  if (!testo) return null;
  const stile =
    tipo === "errore"
      ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
      : "border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-200";
  return (
    <p role={tipo === "errore" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${stile}`}>
      {testo}
    </p>
  );
}
