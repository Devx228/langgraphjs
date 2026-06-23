# Review Setup

This Oracle persistence work lives inside a forked `langgraphjs` monorepo, not
as a standalone package checkout. Please review and test it by pulling the full
fork/branch, then running commands from the repository root.

## Pull The Branch

Branch to review:

```txt
oracle-final-ready
```

Package browser links:

- GitHub package path: https://github.com/Devx228/langgraphjs/tree/oracle-final-ready/libs/checkpoint-oracledb
- GitHub branch: https://github.com/Devx228/langgraphjs/tree/oracle-final-ready

The links above point directly to the package, but please clone/pull the whole
`langgraphjs` fork because this package depends on local workspace packages.

If using GitHub:

```sh
git clone https://github.com/Devx228/langgraphjs.git
cd langgraphjs
git checkout oracle-final-ready
```

If the repo is already cloned:

```sh
git fetch origin
git checkout oracle-final-ready
git pull
```

If using the Oracle GitLab mirror:

```sh
git clone https://linux-git.oraclecorp.com/ddhok/langgraphjs.git
cd langgraphjs
git checkout oracle-final-ready
```

The GitLab clone URL may require Oracle network access and GitLab
authentication. If HTTPS clone is not enabled for your account, use the clone
URL shown by GitLab for the same repository and then check out the branch above.

## Why Pull The Whole Fork

The implementation is in `libs/checkpoint-oracledb`, but it depends on the
workspace packages in this monorepo, especially:

```txt
libs/checkpoint
libs/checkpoint-validation
libs/langgraph-core
```

So the safest review path is to pull the complete forked branch and run the
package commands through `pnpm --filter`.

## Main Review Scope

Primary package:

```txt
libs/checkpoint-oracledb
```

Important files:

```txt
libs/checkpoint-oracledb/src/saver.ts
libs/checkpoint-oracledb/src/store.ts
libs/checkpoint-oracledb/src/sql.ts
libs/checkpoint-oracledb/src/migrations.ts
libs/checkpoint-oracledb/src/store-migrations.ts
libs/checkpoint-oracledb/src/diagnostics.ts
libs/checkpoint-oracledb/src/index.ts
libs/checkpoint-oracledb/src/tests/
libs/checkpoint-oracledb/README.md
```

Base interfaces used for comparison:

```txt
libs/checkpoint/src/base.ts
libs/checkpoint/src/store/base.ts
libs/checkpoint/src/store/memory.ts
libs/checkpoint-validation/src/spec/
```

## Install

Required:

- Node.js 18 or newer
- pnpm
- Oracle Database credentials only for integration tests

From the repository root:

```sh
corepack enable
pnpm install
```

## Quick Verification Without Oracle

These commands do not require Oracle credentials:

```sh
pnpm --filter @oracle/langgraph-oracledb exec tsc --noEmit
pnpm --filter @oracle/langgraph-oracledb test
pnpm --filter @oracle/langgraph-oracledb run lint:dpdm
pnpm --filter @oracle/langgraph-oracledb build:internal
```

Expected coverage:

- TypeScript compile check
- unit tests for SQL helpers, diagnostics, store validation, and saver
  setup/race handling
- circular dependency check
- package compilation and export/type validation

## Oracle Integration Tests

Set credentials first:

```sh
export ORACLE_USER="<user>"
export ORACLE_PASSWORD="<password>"
export ORACLE_CONNECT_STRING="<host>:<port>/<service>"
```

Then run:

```sh
pnpm --filter @oracle/langgraph-oracledb test:int
```

This validates:

- `OracleCheckpointSaver` against the shared LangGraph checkpoint-validation
  suite
- `OracleStore` against BaseStore-style behavior
- Oracle table setup and migrations
- checkpoint writes, pending writes, metadata filters, namespace handling, and
  thread deletion
- store put/get/search/delete/listNamespaces behavior
- native node-oracledb VECTOR binds when supported, with `TO_VECTOR` string-bind
  fallback coverage
- optional Oracle VECTOR search and vector index management when supported by
  the connected database

## Diagnostics Review

Diagnostics are read-only and are useful before or after setup. They inspect the
expected tables, migrations, schema shape, runtime driver mode, and VECTOR
availability without mutating data.

```ts
import {
  OracleCheckpointSaver,
  OracleStore,
} from "@oracle/langgraph-oracledb";

const connection = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
};

const checkpointer = new OracleCheckpointSaver({ connection });
const store = new OracleStore({ connection });

console.dir(
  await checkpointer.getDiagnostics({ includeRowCounts: true }),
  { depth: null }
);
console.dir(
  await store.getDiagnostics({ includeRowCounts: true }),
  { depth: null }
);

await checkpointer.end();
await store.stop();
```

The README has the shorter user-facing diagnostics example. This guide keeps the
full review snippet here so reviewers can paste it into a local scratch script.

## Current Implementation Summary

Completed in this branch:

- `OracleCheckpointSaver` for durable LangGraph checkpoints
- `OracleStore` for long-term memory/store persistence
- Oracle migrations and table setup
- read-only diagnostics for checkpoint and store schema/runtime checks
- reversible checkpoint namespace encoding
- encoded store keys, including empty key support
- pending writes and legacy pending-send handling
- metadata/store filters with Oracle-safe SQL pushdown and JS fallback
- optional Oracle VECTOR search support
- native node-oracledb VECTOR binds with safe string-bind fallback
- explicit VECTOR index create/list/drop helpers
- vector dimension validation before DDL/DML
- integration tests and validation coverage

## Review Areas Where Feedback Would Help

- final package name and upstream naming convention
- CI strategy for Oracle integration tests
- Oracle VECTOR API shape, native bind fallback behavior, and explicit vector
  index management defaults
- performance expectations for complex store filters and wildcard namespace
  listing, which can fall back to broader scans for correctness
- package/workspace/lockfile cleanup needed before an upstream PR

## Notes

The draft PR can remain closed if preferred. The branch itself is enough for a
code review as long as the reviewer pulls the full fork and checks out the
correct branch.
