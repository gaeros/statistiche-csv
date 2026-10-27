import { PaginaAuth } from "@/components/PaginaAuth";
import { FormAccesso } from "./FormAccesso";

export default async function PaginaAccedi({ searchParams }: PageProps<"/accedi">) {
  const { errore, ok } = await searchParams;
  return (
    <PaginaAuth titolo="Accedi">
      <FormAccesso
        errore={typeof errore === "string" ? errore : undefined}
        ok={typeof ok === "string" ? ok : undefined}
      />
    </PaginaAuth>
  );
}
