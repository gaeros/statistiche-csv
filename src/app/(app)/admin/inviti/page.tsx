import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { creaFormati } from "@/lib/formato";
import { createClient } from "@/lib/supabase/server";
import { utenteCorrente } from "@/lib/utente";
import { eliminaPersona, revocaInvito } from "./actions";
import { BottoneElimina } from "./BottoneElimina";
import { FormInvito } from "./FormInvito";

export default async function PaginaInviti() {
  const t = await getTranslations("inviti");
  const f = creaFormati(await getLocale());
  const { amministratore } = await utenteCorrente();
  if (!amministratore) notFound();

  const supabase = await createClient();
  const { data: inviti } = await supabase
    .from("inviti")
    .select("email, amministratore, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold tracking-normal">{t("titolo")}</h1>
      <FormInvito />
      <div className="scheda overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 text-slate-500 dark:border-slate-800">
            <tr>
              <th className="px-4 py-2 font-medium">{t("email")}</th>
              <th className="px-4 py-2 font-medium">{t("invitatoIl")}</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {inviti?.map((i) => (
              <tr key={i.email} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                <td className="px-4 py-2">
                  {i.email}
                  {i.amministratore && (
                    <span className="ml-2 rounded bg-slate-900 px-1.5 py-0.5 text-xs text-white dark:bg-blue-950 dark:text-blue-200">
                      {t("amministratore")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-500">{f.dataOra(i.created_at)}</td>
                <td className="px-4 py-2 text-right">
                  {!i.amministratore && (
                    <div className="flex justify-end gap-4">
                      <form action={revocaInvito}>
                        <input type="hidden" name="email" value={i.email} />
                        <button type="submit" className="text-red-600 hover:underline dark:text-red-400">
                          {t("revoca")}
                        </button>
                      </form>
                      <form action={eliminaPersona}>
                        <input type="hidden" name="email" value={i.email} />
                        <BottoneElimina email={i.email} />
                      </form>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-sm text-slate-500">
        {t("nota")}
      </p>
    </div>
  );
}
