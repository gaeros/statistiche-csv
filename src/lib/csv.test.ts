import { describe, expect, it } from "vitest";
import { cella, cellaTesto } from "./csv";

describe("csv", () => {
  it("neutralizza le formule nei testi ma non i numeri negativi", () => {
    expect(cellaTesto("=SOMMA(A1)")).toBe("'=SOMMA(A1)");
    expect(cellaTesto("@cmd")).toBe("'@cmd");
    expect(cella(-3.5, "decimale")).toBe("-3,5");
    expect(cella("-2", "testo")).toBe("'-2");
  });
  it("mette tra virgolette i testi con ; o a capo", () => {
    expect(cellaTesto('a;b "c"')).toBe('"a;b ""c"""');
  });
  it("scrive date, ore e Sì/No in italiano", () => {
    expect(cella("2026-10-27", "data")).toBe("27/10/2026");
    expect(cella("2026-10-27T06:30:00Z", "data_ora")).toBe("27/10/2026 07:30");
    expect(cella(true, "booleano")).toBe("Sì");
  });
});
