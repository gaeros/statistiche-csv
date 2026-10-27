import { describe, expect, it } from "vitest";
import { deduplica, nomeFileSenzaEstensione, sanificaNomeColonna, sanificaNomeTabella } from "./nomi";

describe("sanificazione dei nomi (SPEC §4.6)", () => {
  it("applica gli esempi della specifica", () => {
    expect(sanificaNomeTabella(nomeFileSenzaEstensione("Vendite 2024.xlsx"))).toBe("vendite_2024");
    expect(sanificaNomeColonna("Fatturato", 1)).toBe("fatturato");
    expect(sanificaNomeColonna("Data ordine", 1)).toBe("data_ordine");
    expect(sanificaNomeColonna("Quantità", 1)).toBe("quantita");
    expect(sanificaNomeColonna("Prezzo (€)", 1)).toBe("prezzo_eur");
    expect(sanificaNomeTabella("2024_dati")).toBe("t_2024_dati");
    expect(sanificaNomeColonna("order", 1)).toBe("order_col");
    expect(sanificaNomeColonna("", 5)).toBe("colonna_5");
    expect(sanificaNomeColonna("id", 1)).toBe("id_file");
    expect(sanificaNomeColonna("User ID", 1)).toBe("user_id_file");
  });

  it("toglie il BOM e tronca a 63 caratteri", () => {
    expect(sanificaNomeColonna("\uFEFFData", 1)).toBe("data");
    expect(sanificaNomeColonna("a".repeat(100), 1)).toHaveLength(63);
    expect(sanificaNomeTabella("b".repeat(100)).length).toBeLessThanOrEqual(53);
  });

  it("aggiunge suffissi ai nomi ripetuti", () => {
    expect(deduplica(["totale", "totale", "prezzo", "totale"])).toEqual(["totale", "totale_2", "prezzo", "totale_3"]);
  });

  it("dà il nome atteso al file della pressione", () => {
    expect(sanificaNomeTabella(nomeFileSenzaEstensione("pressione-2026-10-27.csv"))).toBe("pressione_2026_10_27");
    expect(sanificaNomeTabella(nomeFileSenzaEstensione("Vendite Q1 2024.csv"))).toBe("vendite_q1_2024");
  });
});
