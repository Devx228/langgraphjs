# Bug Hunt Report

## 1. Executive Summary

This pass followed `BOSS_BUG_HUNTER.md` and focused only on real runtime, logical, package-consumer, and edge-case bugs for `@oracle/langgraph-oracledb`.

Confirmed or strongly evidenced user-facing issues:

- P2: 4
- P0/P1/P3: 0

Fixed in this branch:

- `OracleStore` now rejects non-JSON-serializable values before Oracle writes.
- `OracleStore` now rejects incomplete vector index configs at construction.
- `OracleCheckpointSaver` now rejects empty Oracle key fields before they become Oracle `NULL` values.

Remaining risk:

- A real external `pnpm add` consumer install failed by default because `oracledb` build scripts were blocked by pnpm's build-approval policy. Runtime works after approving/allowing builds, but the package install story needs an explicit release decision.

Final recommendation: Ready after the package install policy decision is handled.

## 2. Public Surface Area

| Public API / Feature | Where Defined | How Users Call It | Expected Contract | Current Test Coverage | Risk Level |
|---|---|---|---|---|---|
| `OracleCheckpointSaver` | `src/saver.ts`, root export | `new OracleCheckpointSaver({ connection, pool, tablePrefix, serde })` | Persist/list/load/delete LangGraph checkpoints with Oracle-backed setup and clear validation errors | Unit, integration, shared checkpoint validation, consumer probe | High |
| `OracleCheckpointSaver.setup()` | `src/saver.ts` | `await saver.setup()` | Idempotently create/migrate tables; retry after failure | Unit and integration | Medium |
| `OracleCheckpointSaver.put/getTuple/list/putWrites/deleteThread/end` | `src/saver.ts` | LangGraph checkpointer APIs | Match BaseCheckpointSaver behavior; avoid Oracle `NULL`/length/runtime surprises | Unit, integration, shared validation | High |
| `OracleStore` | `src/store.ts`, root export, `./store` export | `new OracleStore({ connection, pool, tablePrefix, ensureTable, index })` | Persist JSON store rows; optional vector indexing; clear config validation | Unit, integration, consumer probe | High |
| `OracleStore.get/put/delete/search/batch/listNamespaces/start/stop` | inherited BaseStore API implemented by `batch` | `await store.put(...)`, `await store.search(...)` | Match BaseStore semantics for keys, namespaces, filters, pagination, vector search, lifecycle | Unit, integration, consumer probe | High |
| Package root entrypoint | `package.json` exports `"."` | `import { OracleStore } from "@oracle/langgraph-oracledb"` or `require(...)` | ESM/CJS runtime and declarations expose saver/store | Build, import smoke, consumer probe, TS check | Medium |
| Package store entrypoint | `package.json` exports `"./store"` | `import { OracleStore } from "@oracle/langgraph-oracledb/store"` | ESM/CJS runtime and declarations expose `OracleStore` | Build, import smoke, consumer probe, TS check | Medium |
| `./package.json` export | `package.json` exports | `import pkg from "@oracle/langgraph-oracledb/package.json" with { type: "json" }` | Package metadata can be read by tooling | Consumer probe | Low |

## 3. Real Usage Test Matrix

| API / Feature | Normal Case Tested | Edge Cases Tested | Invalid Inputs Tested | Expected Behavior | Actual Behavior | Bug Found? |
|---|---|---|---|---|---|---|
| Package install | Packed tarball installed in temp consumer | pnpm default build approval | `oracledb` native build script blocked | Install should complete or give documented path | `pnpm add` exited nonzero with `ERR_PNPM_IGNORED_BUILDS` | Yes, unfixed |
| Root and `/store` exports | ESM/CJS import from built package and temp consumer | package JSON import with JSON attribute | None | Exports match runtime/declarations | Passed | No |
| TypeScript declarations | Temp consumer `tsc --noEmit` | Root and `/store` imports | None | `.d.ts` matches runtime exports | Passed | No |
| `OracleStore.put/get/search` | Put/get/search with score filter | Empty key, unicode namespace, unicode value, limit 0 | `undefined`, function property, NaN, circular object | Valid values round-trip; invalid JSON values reject clearly | Fixed to reject before Oracle writes | Yes, fixed |
| `OracleStore` vector config | Vector constructor paths | Missing `embeddings`, missing `embedQuery`, non-string fields | malformed `index` object | Constructor rejects bad config | Fixed to reject at construction | Yes, fixed |
| `OracleStore` lifecycle | `stop()` then reuse | Stop twice | None | No pool leak; reuse works | Passed | No |
| `OracleCheckpointSaver` normal flow | `put/getTuple/deleteThread` | Empty checkpoint ID | Empty checkpoint/task/channel/delete thread | Valid flow works; bad Oracle key strings reject clearly | Fixed to reject before DB writes | Yes, fixed |
| Oracle integration behavior | Existing integration suite | Empty namespace/key, long strings, vector dims, setup concurrency, filters, pagination | Invalid dims, oversize vectors | All expected paths pass | Passed 754 tests | No new bug |

## 4. Commands Run

| Command | Result | Notes |
|---|---|---|
| `pnpm install --frozen-lockfile --prefer-offline --registry=https://registry.npmjs.org/ --store-dir /Users/devanshabhaydhok/Library/pnpm/store` | Pass with warnings | Used npm main registry. pnpm warned about ignored build scripts, including `oracledb`. |
| `pnpm --filter @oracle/langgraph-oracledb build` | Pass | Built package and workspace dependencies. |
| `pnpm --filter @oracle/langgraph-oracledb pack --pack-destination /private/tmp` | Pass | Produced `/private/tmp/oracle-langgraph-oracledb-0.0.0.tgz`. |
| `pnpm add /private/tmp/oracle-langgraph-oracledb-0.0.0.tgz @langchain/core@^1.1.44 @langchain/langgraph-checkpoint@^1.0.0 --registry=https://registry.npmjs.org/ --store-dir /Users/devanshabhaydhok/Library/pnpm/store` | Fail | External consumer install failed with `ERR_PNPM_IGNORED_BUILDS` for `oracledb@6.10.0`. |
| `pnpm add oracledb --config.dangerouslyAllowAllBuilds=true --registry=https://registry.npmjs.org/ --store-dir /Users/devanshabhaydhok/Library/pnpm/store` | Pass | Enabled temp consumer Oracle runtime probe. |
| `node --env-file=... /private/tmp/lg-oracledb-consumer/edge-probe.mjs` | Fail before fixes; pass after fixes | Reproduced and then verified external runtime edge cases. |
| `/Users/.../node_modules/.bin/tsc --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --skipLibCheck typecheck-consumer.ts` | Pass | External consumer declaration smoke check. |
| `pnpm --filter @oracle/langgraph-oracledb test` | Pass | 9 unit tests passed after fixes. |
| `pnpm --filter @oracle/langgraph-oracledb exec tsc --noEmit` | Pass | Typecheck passed. |
| `pnpm --filter @oracle/langgraph-oracledb test:int` | Pass | 754 Oracle-backed tests passed. |
| `pnpm --filter @oracle/langgraph-oracledb run lint:eslint` | Pass | 0 warnings/errors. |
| `pnpm --filter @oracle/langgraph-oracledb run lint:dpdm` | Pass | No circular dependencies. |
| `pnpm lint` | Pass | Root lint passed. |
| `pnpm format:check` | Pass | Root format check passed. |

## 5. Edge Cases Tested

- External ESM root import.
- External ESM `/store` import.
- External CommonJS root and `/store` import.
- External `package.json` import with JSON import attribute.
- External TypeScript declarations for root and `/store`.
- Normal store put/get/search from packed package.
- Empty string store key.
- Unicode namespace segment and emoji value.
- `search(..., { limit: 0 })`.
- `listNamespaces({ limit: 0 })`.
- `store.put(..., undefined)`.
- Store value with function property.
- Store value with `NaN`.
- Store value with circular reference.
- Incomplete vector `index` config.
- Non-string vector `fields`.
- `store.stop()` twice, then reuse.
- Checkpointer put/get/delete from packed package.
- Empty checkpoint ID.
- Empty checkpoint write task ID.
- Empty checkpoint write channel.
- Empty `deleteThread("")`.

## Real User Logical Bug Pass

### BUG-001: `OracleStore.put` accepted non-JSON values and failed late or lost data

Severity: P2

User impact: A package user could pass `undefined` or an object containing functions/non-finite numbers and get either a low-level Oracle error or silently persisted data with fields dropped.

Public API / Feature: `OracleStore.put`, `OracleStore.batch`

Reproduction command: `node --env-file=... /private/tmp/lg-oracledb-consumer/edge-probe.mjs`

Minimal reproduction snippet:

    await store.put(["bad-values"], "undefined", undefined);
    await store.put(["bad-values"], "function-prop", {
      kept: true,
      dropped: () => "gone",
    });

Expected behavior: Reject invalid JSON values with an actionable package-level error before Oracle writes.

Actual behavior before fix: `undefined` reached Oracle and produced `ORA-01400`; function properties were silently dropped and `{ kept: true }` was persisted.

Root cause: `batchPuts` used `JSON.stringify(op.value)` without checking for `undefined`, functions, symbols, bigint, non-finite numbers, or circular references.

Files involved: `libs/checkpoint-oracledb/src/store.ts`, `OracleStore.batchPuts`

Fix status: fixed

Test added: yes, `libs/checkpoint-oracledb/src/tests/store.test.ts`

Verification command: `pnpm --filter @oracle/langgraph-oracledb test`

Confidence: high

### BUG-002: `OracleStore` accepted malformed vector index config and crashed later

Severity: P2

User impact: JavaScript users could instantiate `new OracleStore({ index: { dims: 2 } })`; the constructor succeeded, then the first vector-indexed write crashed with `Cannot read properties of undefined (reading 'embedDocuments')`. In the external probe, that failure also left a pool alive until the process exited.

Public API / Feature: `OracleStore` constructor, vector indexing

Reproduction command: `node --env-file=... /private/tmp/lg-oracledb-consumer/edge-probe.mjs`

Minimal reproduction snippet:

    const store = new OracleStore({
      connection,
      tablePrefix,
      index: { dims: 2 },
    });
    await store.put(["vectors"], "item", { text: "hello" });

Expected behavior: Constructor rejects malformed index config immediately with a clear message.

Actual behavior before fix: Constructor accepted it; `put` crashed later with a raw TypeError.

Root cause: Constructor validated only `index.dims`, not the required `embeddings.embedDocuments`/`embedQuery` methods or `fields` shape.

Files involved: `libs/checkpoint-oracledb/src/store.ts`, `OracleStore.constructor`

Fix status: fixed

Test added: yes, `libs/checkpoint-oracledb/src/tests/store.test.ts`

Verification command: `pnpm --filter @oracle/langgraph-oracledb test`

Confidence: high

### BUG-003: Empty checkpoint key fields reached Oracle as `NULL`

Severity: P2

User impact: A caller using the public saver methods with empty checkpoint IDs, task IDs, write channels, blob channels, or delete thread IDs would hit confusing Oracle behavior because Oracle treats `""` as `NULL` for `VARCHAR2`. That can produce `ORA-01400`, missing writes, or a misleading no-op delete.

Public API / Feature: `OracleCheckpointSaver.put`, `putWrites`, `deleteThread`

Reproduction command: `node --env-file=... /private/tmp/lg-oracledb-consumer/edge-probe.mjs`

Minimal reproduction snippet:

    await saver.put(
      { configurable: { thread_id: "thread-1" } },
      { ...checkpoint, id: "" },
      metadata,
      {}
    );

Expected behavior: Reject empty Oracle key fields before database execution.

Actual behavior before fix: Validation allowed empty optional key fields; Oracle would convert them to `NULL` in `NOT NULL` key columns.

Root cause: Saver validation checked byte length but did not require non-empty strings for non-null Oracle key fields.

Files involved: `libs/checkpoint-oracledb/src/saver.ts`, `validateCheckpointKeyFields`, `putWrites`, `deleteThread`, `dumpBlobs`, `dumpWrites`

Fix status: fixed

Test added: yes, `libs/checkpoint-oracledb/src/tests/saver.test.ts`

Verification command: `pnpm --filter @oracle/langgraph-oracledb test`

Confidence: high

### BUG-004: Packed package install can fail for pnpm consumers because `oracledb` build scripts are blocked

Severity: P2

User impact: A pnpm consumer installing the packed package hit a nonzero install failure before they could run the package. This is a real package-consumer flow, not an in-repo test issue.

Public API / Feature: package install, `oracledb` dependency

Reproduction command:

    pnpm add /private/tmp/oracle-langgraph-oracledb-0.0.0.tgz @langchain/core@^1.1.44 @langchain/langgraph-checkpoint@^1.0.0 --registry=https://registry.npmjs.org/ --store-dir /Users/devanshabhaydhok/Library/pnpm/store

Minimal reproduction snippet: not applicable

Expected behavior: Consumer install completes or the package has a decided install policy for native `oracledb` build approval.

Actual behavior: pnpm exited with `ERR_PNPM_IGNORED_BUILDS` because `oracledb@6.10.0` build scripts were ignored.

Root cause: `oracledb` has an install script and modern pnpm requires build-script approval. This may need consumer docs, package-manager policy, or dependency strategy; the package itself cannot silently approve scripts in downstream projects.

Files involved: `libs/checkpoint-oracledb/package.json`

Fix status: needs decision

Test added: no

Verification command: same reproduction command

Confidence: high

## 6. Fixed Bugs

- Added `stringifyStoreValue` validation in `OracleStore` to reject unsupported JSON values before writes.
- Added `validateIndexConfig` in `OracleStore` to reject missing embeddings methods and malformed fields at construction.
- Added non-empty Oracle key validation in `OracleCheckpointSaver` for checkpoint IDs, parent checkpoint IDs, task IDs, write channels, blob channels, blob versions, and delete thread IDs.
- Added unit regression tests for all fixed runtime validation paths.

## 7. Unfixed Bugs and Risks

- P2: pnpm consumer install can fail until `oracledb` build-script approval is handled. Recommended next step: choose the release policy for pnpm consumers, such as documenting `pnpm approve-builds`, providing a package manager config recommendation, or changing the dependency strategy if that is acceptable.
- P2: Oracle integration tests still require a live Oracle database and credentials. If CI cannot provide that, key runtime behavior can only be manually validated.

## 8. Test Gaps

- No automated external-consumer fixture is checked into the repo. The temp consumer probe proved the behavior, but a maintained package-consumer smoke test would catch packaging regressions earlier.
- The install/build-script behavior needs a repeatable CI or release validation job using a clean pnpm consumer project.
- Multi-version Oracle server compatibility was not covered; this pass used the available local Oracle container.

## 9. Areas Not Fully Inspected

- Security review was intentionally out of scope.
- I focused on `libs/checkpoint-oracledb` and its direct package-consumer behavior, not a full monorepo behavioral audit.
- I did not test npm, Yarn, Bun, or Windows consumers.
- I did not test browser bundlers; this package imports `oracledb` and is Node/Oracle oriented.

## 10. Final Recommendation

Ready after listed fixes and install-policy decision.

The fixed runtime bugs now have regression tests, the package passes unit/type/integration/lint/format gates, and a packed-package consumer probe verifies the corrected behavior from outside the repo. The remaining blocker is deciding how this package should guide or support pnpm consumers through `oracledb` build-script approval.
