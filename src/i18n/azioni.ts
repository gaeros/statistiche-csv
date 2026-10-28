"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { COOKIE_LINGUA, èLingua } from "./lingue";

export async function impostaLingua(lingua: string) {
  if (!èLingua(lingua)) return;
  (await cookies()).set(COOKIE_LINGUA, lingua, { maxAge: 60 * 60 * 24 * 365, path: "/", sameSite: "lax" });
  revalidatePath("/", "layout");
}
