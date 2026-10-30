// Accetta solo percorsi interni, per evitare redirect verso altri siti.
export function destinazioneSicura(next: string | null): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
}
