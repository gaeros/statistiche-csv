import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";

// Pagine raggiungibili senza essere collegati.
const PUBBLICHE = ["/accedi", "/password-dimenticata", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([chiave, valore]) =>
          response.headers.set(chiave, valore),
        );
      },
    },
  });

  // Rinnova la sessione se serve. Non mettere codice tra createServerClient e getClaims.
  const { data } = await supabase.auth.getClaims();
  const utente = data?.claims;

  const percorso = request.nextUrl.pathname;
  const pubblica = PUBBLICHE.some((p) => percorso === p || percorso.startsWith(`${p}/`));

  if (!utente && !pubblica) {
    const url = request.nextUrl.clone();
    url.pathname = "/accedi";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
