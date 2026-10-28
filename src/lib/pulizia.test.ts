import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { eliminaOriginaliScaduti } from "./pulizia";

// Finto client: registra i filtri della query e i file tolti dallo Storage.
function finto(righe: { id: string; percorso_storage: string | null }[]) {
  const registro = { lt: "", rimossi: [] as string[], azzerati: [] as string[] };
  const query = {
    select: () => query,
    not: () => query,
    lt: (_c: string, v: string) => ((registro.lt = v), query),
    order: () => query,
    limit: async () => ({ data: righe, error: null }),
    update: (v: unknown) => {
      expect(v).toEqual({ percorso_storage: null });
      return { in: async (_c: string, ids: string[]) => ((registro.azzerati = ids), { error: null }) };
    },
  };
  const admin = {
    from: vi.fn(() => query),
    storage: {
      from: () => ({ remove: async (p: string[]) => ((registro.rimossi = p), { error: null }) }),
    },
  } as unknown as SupabaseClient;
  return { admin, registro };
}

describe("eliminaOriginaliScaduti", () => {
  it("toglie i file più vecchi di 30 giorni e azzera il percorso", async () => {
    const { admin, registro } = finto([
      { id: "a", percorso_storage: "u/a/x.csv" },
      { id: "b", percorso_storage: "u/b/y.csv" },
    ]);
    const r = await eliminaOriginaliScaduti(admin, new Date("2026-11-30T12:00:00Z"));
    expect(registro.lt).toBe("2026-10-31T12:00:00.000Z");
    expect(registro.rimossi).toEqual(["u/a/x.csv", "u/b/y.csv"]);
    expect(registro.azzerati).toEqual(["a", "b"]);
    expect(r).toEqual({ eliminati: 2, rimanenti: false });
  });

  it("senza file scaduti non tocca lo Storage", async () => {
    const { admin, registro } = finto([]);
    expect(await eliminaOriginaliScaduti(admin)).toEqual({ eliminati: 0, rimanenti: false });
    expect(registro.rimossi).toEqual([]);
  });
});
