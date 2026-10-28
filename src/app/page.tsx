import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Chi è già collegato va ai suoi dati, gli altri vedono la pagina di presentazione.
export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  redirect(data.user ? "/dataset" : "/benvenuto");
}
