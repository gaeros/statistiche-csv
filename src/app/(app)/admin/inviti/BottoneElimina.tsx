"use client";

import { useTranslations } from "next-intl";

export function BottoneElimina({ email }: { email: string }) {
  const t = useTranslations("inviti");
  return (
    <button
      type="submit"
      className="text-red-600 hover:underline dark:text-red-400"
      onClick={(e) => {
        if (!window.confirm(t("confermaElimina", { email }))) e.preventDefault();
      }}
    >
      {t("elimina")}
    </button>
  );
}
