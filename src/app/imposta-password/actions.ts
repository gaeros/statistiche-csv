"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { erroreAuth } from "@/lib/errori-auth";
import { createClient } from "@/lib/supabase/server";
import type { StatoForm } from "../accedi/actions";

export async function impostaPassword(_prev: StatoForm, formData: FormData): Promise<StatoForm> {
  const t = await getTranslations("impostaPassword");
  const te = await getTranslations("erroriAuth");
  const schema = z
    .object({
      password: z.string().min(8, t("troppoCorta")),
      conferma: z.string(),
    })
    .refine((d) => d.password === d.conferma, { message: t("nonCoincidono") });

  const dati = schema.safeParse({
    password: formData.get("password"),
    conferma: formData.get("conferma"),
  });
  if (!dati.success) return { errore: dati.error.issues[0].message };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: dati.data.password });
  if (error) return { errore: erroreAuth(te, error.message) };

  redirect("/dataset");
}
