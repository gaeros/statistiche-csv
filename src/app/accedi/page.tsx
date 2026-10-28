import { PaginaAuth } from "@/components/PaginaAuth";
import { FormAccesso } from "./FormAccesso";

export default async function PaginaAccedi({ searchParams }: PageProps<"/accedi">) {
  const { errore, ok, eliminato } = await searchParams;
  return (
    <PaginaAuth titolo="Accedi">
      <FormAccesso
        errore={typeof errore === "string" ? errore : undefined}
        ok={eliminato ? "Il tuo account e tutti i tuoi dati sono stati eliminati." : typeof ok === "string" ? ok : undefined}
      />
    </PaginaAuth>
  );
}
