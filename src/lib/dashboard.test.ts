import { describe, expect, it } from "vitest";
import { fissa, riordina, togli } from "./dashboard";

describe("fissa", () => {
  it("aggiunge in fondo una volta sola", () => {
    expect(fissa(["a"], "b")).toEqual(["a", "b"]);
    expect(fissa(["a", "b"], "a")).toEqual(["a", "b"]);
  });

  it("rifiuta oltre il massimo", () => {
    expect(fissa(["a", "b"], "c", 2)).toBeNull();
    expect(fissa(["a", "b"], "a", 2)).toEqual(["a", "b"]);
  });
});

describe("togli", () => {
  it("toglie solo il grafico indicato", () => {
    expect(togli(["a", "b", "c"], "b")).toEqual(["a", "c"]);
    expect(togli(["a"], "x")).toEqual(["a"]);
  });
});

describe("riordina", () => {
  it("applica l'ordine chiesto", () => {
    expect(riordina(["a", "b", "c"], ["c", "a", "b"])).toEqual(["c", "a", "b"]);
  });

  it("non rimette grafici tolti e tiene in fondo quelli non elencati", () => {
    expect(riordina(["a", "c", "d"], ["c", "b", "a"])).toEqual(["c", "a", "d"]);
  });
});
