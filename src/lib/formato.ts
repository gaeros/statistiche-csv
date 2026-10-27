// Formattazione italiana di numeri e date (SPEC §6.3).

const numero = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 10 });
const data = new Intl.DateTimeFormat("it-IT", { dateStyle: "short", timeZone: "UTC" });
const dataOra = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Rome",
});

export function formattaNumero(n: number): string {
  return numero.format(n);
}

export function formattaDataOra(iso: string): string {
  return dataOra.format(new Date(iso));
}

export function formattaValore(valore: unknown, tipo: string): string {
  if (valore === null || valore === undefined) return "";
  switch (tipo) {
    case "intero":
    case "decimale":
      return formattaNumero(Number(valore));
    case "data":
      return data.format(new Date(`${valore}T00:00:00Z`));
    case "data_ora":
      return formattaDataOra(String(valore));
    case "booleano":
      return valore ? "Sì" : "No";
    default:
      return String(valore);
  }
}
