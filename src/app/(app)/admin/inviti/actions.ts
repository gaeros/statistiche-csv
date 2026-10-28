"use server";

import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { erroreAuth } from "@/lib/errori-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { utenteCorrente } from "@/lib/utente";
import type { StatoForm } from "@/app/accedi/actions";

export async function invita(_prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const t = await getTranslations("inviti");
  const te = await getTranslations("erroriAuth");
  const { utente, amministratore } = await utenteCorrente();
  if (!amministratore) return { errore: t("soloAdmin") };

  const parsed = z.email().safeParse(String(formData.get("email") ?? "").trim().toLowerCase());
  if (!parsed.success) return { errore: (await getTranslations("accedi"))("emailNonValida") };
  const email = parsed.data;
  const inviaEmail = formData.get("invia_email") === "on";

  // L'inserimento passa dalle regole RLS: riesce solo se chi invita è amministratore.
  const supabase = await createClient();
  const { error } = await supabase.from("inviti").insert({ email, invitato_da: utente.id });
  if (error) {
    return {
      errore: error.code === "23505" ? t("giaInvitato") : error.message,
    };
  }

  if (inviaEmail) {
    const { error: errInvito } = await createAdminClient().auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl()}/auth/benvenuto`,
    });
    if (errInvito) {
      revalidatePath("/admin/inviti");
      return {
        errore: t("emailNonPartita", { dettaglio: erroreAuth(te, errInvito.message) }),
      };
    }
  }

  revalidatePath("/admin/inviti");
  return {
    ok: inviaEmail ? t("invitoInviato", { email }) : t("autorizzato", { email }),
  };
}

export async function revocaInvito(formData: FormData) {
  const { amministratore } = await utenteCorrente();
  if (!amministratore) return;
  const email = String(formData.get("email") ?? "");
  const supabase = await createClient();
  await supabase.from("inviti").delete().eq("email", email);
  revalidatePath("/admin/inviti");
}

// Elimina del tutto una persona invitata: account, dati, file originali e invito.
// Così lo stesso indirizzo può essere invitato di nuovo come se fosse la prima volta.
export async function eliminaPersona(formData: FormData) {
  const { utente, amministratore } = await utenteCorrente();
  if (!amministratore) return;
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email || email === utente.email?.toLowerCase()) return;

  const admin = createAdminClient();
  const { data: invito } = await admin.from("inviti").select("amministratore").eq("email", email).maybeSingle();
  if (invito?.amministratore) return;

  let id: string | undefined;
  for (let pagina = 1; !id; pagina++) {
    const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 });
    if (error || !data.users.length) break;
    id = data.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (data.users.length < 200) break;
  }

  if (id) {
    const { data: importazioni } = await admin.from("importazioni").select("percorso_storage").eq("user_id", id);
    const percorsi = (importazioni ?? []).map((i) => i.percorso_storage).filter((p): p is string => !!p);
    if (percorsi.length) await admin.storage.from("originali").remove(percorsi);
    // Le tabelle, i dataset e i grafici si cancellano a cascata con l'utente.
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return;
  }
  await admin.from("inviti").delete().eq("email", email);
  revalidatePath("/admin/inviti");
}
