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
