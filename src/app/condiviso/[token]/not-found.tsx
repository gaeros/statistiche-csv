import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { Logo } from "@/components/Logo";

// Link inesistente, revocato o scaduto: non si dice quale dei tre, per non dare indizi.
export default async function LinkNonValido() {
  const t = await getTranslations("condiviso");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-4 py-16">
      <Link href="/">
        <Logo className="h-11 w-auto" />
      </Link>
      <h1 className="text-2xl font-semibold">{t("nonValidoTitolo")}</h1>
      <p className="text-slate-600 dark:text-slate-300">{t("nonValido")}</p>
    </main>
  );
}
