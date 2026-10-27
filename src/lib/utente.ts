import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Utente collegato (verificato dal server di Supabase) e se è amministratore.
export const utenteCorrente = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/accedi");

  const { data: admin } = await supabase.rpc("is_admin");
  return { utente: data.user, amministratore: admin === true };
});
