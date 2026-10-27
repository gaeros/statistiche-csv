import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { utenteCorrente } from "@/lib/utente";
import { revocaInvito } from "./actions";
import { FormInvito } from "./FormInvito";

const formatoData = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

export default async function PaginaInviti() {
  const { amministratore } = await utenteCorrente();
  if (!amministratore) notFound();

  const supabase = await createClient();
  const { data: inviti } = await supabase
    .from("inviti")
    .select("email, amministratore, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Inviti</h1>
      <FormInvito />
      <div className="scheda overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
            <tr>
              <th className="px-4 py-2 font-medium">Email</th>
              <th className="px-4 py-2 font-medium">Invitato il</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {inviti?.map((i) => (
              <tr key={i.email} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-2">
                  {i.email}
                  {i.amministratore && (
                    <span className="ml-2 rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">
                      amministratore
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500">{formatoData.format(new Date(i.created_at))}</td>
                <td className="px-4 py-2 text-right">
                  {!i.amministratore && (
                    <form action={revocaInvito}>
                      <input type="hidden" name="email" value={i.email} />
                      <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                        Revoca
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">
        Revocare un invito impedisce una nuova registrazione, ma non elimina un account già creato.
      </p>
    </div>
  );
}
