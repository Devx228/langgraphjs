import { describe, expect, test } from "vitest";

import { OracleStore } from "../store.js";
import { ORACLE_VECTOR_MAX_DIMENSIONS } from "../store/constants.js";

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

  test("rejects invalid and oversized vector dimensions at construction", () => {
    const embeddings = {
      async embedDocuments() {
        return [];
      },
      async embedQuery() {
        return [];
      },
    };

    for (const dims of [
      0,
      -1,
      1.5,
      Number.POSITIVE_INFINITY,
      Number.NaN,
      ORACLE_VECTOR_MAX_DIMENSIONS + 1,
      Number.MAX_SAFE_INTEGER,
    ]) {
      expect(
        () =>
          new OracleStore({
            index: {
              dims,
              embeddings: embeddings as never,
            },
          })
      ).toThrow(
        `OracleStore index dims must be an integer between 1 and ${ORACLE_VECTOR_MAX_DIMENSIONS}`
      );
    }
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
