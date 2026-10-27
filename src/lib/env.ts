function richiesta(nome: string, valore: string | undefined): string {
  if (!valore) {
    throw new Error(
      `Variabile d'ambiente mancante: ${nome}. Copia .env.example in .env.local e compilala.`,
    );
  }
  return valore;
}

// Le variabili NEXT_PUBLIC_ vanno lette per esteso perché Next.js le sostituisce in fase di build.
export const supabaseUrl = () =>
  richiesta("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseAnonKey = () =>
  richiesta("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
