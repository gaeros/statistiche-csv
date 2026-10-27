import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "@/lib/env";

// Client con la chiave amministrativa: solo lato server, per operazioni precise (es. inviti).
export function createAdminClient() {
  const chiave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!chiave) {
    throw new Error("Variabile d'ambiente mancante: SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(supabaseUrl(), chiave, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
