import { describe, expect, test } from "vitest";

import { OracleStore } from "../store.js";

const unusedPool = {
  async getConnection() {
    throw new Error("Oracle should not be called for validation failures.");
  },
};

describe("OracleStore runtime validation", () => {
  test("rejects incomplete vector index configs at construction", () => {
    expect(
      () =>
        new OracleStore({
          index: { dims: 2 } as never,
        })
    ).toThrow(
      "OracleStore index embeddings must provide embedDocuments and embedQuery methods."
    );

    expect(
      () =>
        new OracleStore({
          index: {
            dims: 2,
            embeddings: { async embedDocuments() {} },
          } as never,
        })
    ).toThrow(
      "OracleStore index embeddings must provide embedDocuments and embedQuery methods."
    );

    expect(
      () =>
        new OracleStore({
          index: {
            dims: 2,
            embeddings: {
              async embedDocuments() {
                return [];
              },
              async embedQuery() {
                return [];
              },
            },
            fields: ["text", 1],
          } as never,
        })
    ).toThrow("OracleStore index fields must be an array of strings.");
  });

  test("rejects non-JSON-serializable store values before Oracle writes", async () => {
    const store = new OracleStore({
      pool: unusedPool as never,
      ensureTable: false,
      tablePrefix: "VALIDATION_",
    });

    await expect(
      store.put(["bad-values"], "undefined-root", undefined as never)
    ).rejects.toThrow("OracleStore values must be JSON-serializable");

    await expect(
      store.put(["bad-values"], "function-property", {
        kept: true,
        dropped: () => "gone",
      } as never)
    ).rejects.toThrow("contains unsupported function value");

    await expect(
      store.put(["bad-values"], "nan", { score: Number.NaN })
    ).rejects.toThrow("contains a non-finite number");

    const circular: Record<string, unknown> = {};
    circular.self = circular;
    await expect(store.put(["bad-values"], "circular", circular)).rejects.toThrow(
      "contains circular references"
    );
  });
});
