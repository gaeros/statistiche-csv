import { describe, expect, it } from "vitest";
import { converti, convertiDataOra, rilevaTipo } from "./tipi";

describe("rilevamento dei tipi (SPEC §4.9)", () => {
  it("riconosce interi e decimali italiani e inglesi", () => {
    expect(rilevaTipo(["1", "22", "-3"], "it").tipo).toBe("intero");
    expect(rilevaTipo(["1.234,56", "12,5", "7"], "it")).toMatchObject({ tipo: "decimale", formatoNumero: "it" });
    expect(rilevaTipo(["1,234.56", "12.5"], "it")).toMatchObject({ tipo: "decimale", formatoNumero: "en" });
    expect(converti("1.234,56", "decimale", "it")).toBe(1234.56);
    expect(converti("1,234.56", "decimale", "en")).toBe(1234.56);
  });

  it("toglie i simboli di valuta", () => {
    expect(rilevaTipo(["€ 12,50", "EUR 3,00", "4,99 €"], "it").tipo).toBe("decimale");
    expect(converti("€ 12,50", "decimale", "it")).toBe(12.5);
    expect(converti("$1,299.00", "decimale", "en")).toBe(1299);
  });

  it("usa il formato predefinito per i casi ambigui", () => {
    expect(rilevaTipo(["1.234", "5.678"], "it")).toMatchObject({ tipo: "intero", formatoNumero: "it" });
    expect(rilevaTipo(["1.234", "5.678"], "en")).toMatchObject({ tipo: "decimale", formatoNumero: "en" });
  });

  it("tiene come testo i codici con zeri iniziali", () => {
    expect(rilevaTipo(["00184", "20121"], "it").tipo).toBe("testo");
  });

  it("riconosce le date e le date con ora", () => {
    expect(rilevaTipo(["24/09/2026", "1/10/2026"], "it").tipo).toBe("data");
    expect(rilevaTipo(["2026-09-24", "2026-10-01"], "it").tipo).toBe("data");
    expect(rilevaTipo(["24-09-2026"], "it").tipo).toBe("data");
    expect(rilevaTipo(["24/09/2026 08:30", "25/09/2026"], "it").tipo).toBe("data_ora");
    expect(rilevaTipo(["2024-03-05T10:15:00Z", "2024-03-06T11:00:00.000Z"], "it").tipo).toBe("data_ora");
    expect(converti("24/09/2026", "data", "it")).toBe("2026-09-24");
  });

  it("non accetta date impossibili", () => {
    expect(rilevaTipo(["31/02/2026"], "it").tipo).toBe("testo");
  });

  it("converte le ore senza fuso come ora di Roma, anche con l'ora legale", () => {
    expect(convertiDataOra("15/07/2026 08:00")).toBe("2026-07-15T08:00:00+02:00");
    expect(convertiDataOra("15/01/2026 08:00")).toBe("2026-01-15T08:00:00+01:00");
    expect(convertiDataOra("2024-03-05T10:15:00Z")).toBe("2024-03-05T10:15:00Z");
    expect(convertiDataOra("2024-03-05T10:15:00+0530")).toBe("2024-03-05T10:15:00+05:30");
  });

  it("riconosce i booleani ma lascia numeri le colonne di soli 0/1", () => {
    expect(rilevaTipo(["sì", "no", "Sì"], "it").tipo).toBe("booleano");
    expect(rilevaTipo(["true", "false"], "it").tipo).toBe("booleano");
    expect(rilevaTipo(["1", "0", "1"], "it").tipo).toBe("intero");
    expect(converti("Vero", "booleano", "it")).toBe(true);
  });

  it("tratta come mancanti vuoti, NA, N/A, null e trattino", () => {
    const r = rilevaTipo(["1", "", "NA", "N/A", "null", "-", "2"], "it");
    expect(r).toMatchObject({ tipo: "intero", mancanti: 5, valori: 2 });
    expect(converti("N/A", "intero", "it")).toBeNull();
  });

  it("con tipi misti importa come testo e avvisa", () => {
    const r = rilevaTipo(["1", "2", "3", "4", "boh"], "it");
    expect(r.tipo).toBe("testo");
    expect(r.avviso).toEqual({ chiave: "avvNonNumericoUno", valori: { n: 1 } });
  });
});
