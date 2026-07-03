# WS-2: JSONB Deep-Merge (Write-Integrity Keystone) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the shallow `||` JSONB merge in the generic CRUD with an app-side recursive deep-merge run atomically under a row lock, so a partial nested update can never delete sibling keys.

**Architecture:** A pure `deepMergeJsonb(current, patch)` function (unit-tested) is the merge core. `create-crud-dal.ts`'s `updateImpl` gains a two-path branch: a **fast path** (unchanged single `UPDATE`) when no opted-in merge column is present, and a **merge path** that opens a transaction, `SELECT … FOR UPDATE`s the row, deep-merges each opted-in JSONB column against the locked snapshot, re-validates the merged whole with the column's Zod schema, and writes — all atomic. No schema migration.

**Tech Stack:** TypeScript, Drizzle ORM (`node-postgres` + `pg.Pool`), Zod, pnpm, Vitest (added here).

**Spec:** `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` §4. Supersedes-by-building-on `docs/plans/2026-06-27-jsonb-deep-merge-implementation-plan.md`.

## Global Constraints

- Package manager: **pnpm**. Path alias `@/` → `src/`.
- **NEVER run `pnpm build`.** Verify with `pnpm tsc` (type-check) + `pnpm lint`.
- **NEVER run `pnpm db:push`** (production). This change needs **no schema migration** — nothing to push.
- Work directly on `main`. **Stage files explicitly** (`git add <path>`), never `git add -A`, so unrelated WIP isn't swept in.
- **Named exports only.** No `export default`. One responsibility per file. No barrel files in `lib/`.
- Merge semantics (locked): recurse into plain objects; **replace arrays and scalars wholesale**; keys absent from the patch are preserved; `undefined` is skipped; `null` at a leaf sets the leaf to null.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Add Vitest test runner

**Files:**
- Modify: `package.json` (scripts + devDependency)
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: a `pnpm test` script that runs `*.test.ts` files; consumed by Task 2.

- [ ] **Step 1: Add Vitest as a dev dependency**

Run: `pnpm add -D vitest`
Expected: `vitest` appears under `devDependencies` in `package.json`; lockfile updates.

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Unit tests only — no DOM, no DB. Pure functions under src/**.
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 3: Add test scripts to package.json**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify the runner starts with no tests yet**

Run: `pnpm test`
Expected: Vitest runs, reports "No test files found" (exit 0 or the "no tests" notice) — the runner is wired.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore(test): add vitest runner for pure-function unit tests

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The pure `deepMergeJsonb` function (TDD)

**Files:**
- Create: `src/shared/dal/server/lib/deep-merge-jsonb.test.ts`
- Create: `src/shared/dal/server/lib/deep-merge-jsonb.ts`

**Interfaces:**
- Produces: `deepMergeJsonb(current: unknown, patch: Record<string, unknown>): Record<string, unknown>` — consumed by Task 3.

- [ ] **Step 1: Write the failing tests**

Create `src/shared/dal/server/lib/deep-merge-jsonb.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { deepMergeJsonb } from './deep-merge-jsonb'

describe('deepMergeJsonb', () => {
  it('preserves sibling keys of a nested object (the hard rule)', () => {
    const result = deepMergeJsonb(
      { mainPainPoint: { urgencyRating: 5, accessor: 'x' } },
      { mainPainPoint: { urgencyRating: 9 } },
    )
    expect(result).toEqual({ mainPainPoint: { urgencyRating: 9, accessor: 'x' } })
  })

  it('preserves deeply-nested siblings (funnel source case)', () => {
    const result = deepMergeJsonb(
      { source: { kind: 'funnel', utm: { campaign: 'c' }, meta: { fbp: 'a' }, enrichment: { step1: { v: 1 } } } },
      { source: { enrichment: { step2: { v: 2 } } } },
    )
    expect(result).toEqual({
      source: {
        kind: 'funnel',
        utm: { campaign: 'c' },
        meta: { fbp: 'a' },
        enrichment: { step1: { v: 1 }, step2: { v: 2 } },
      },
    })
  })

  it('replaces arrays wholesale, never concatenating or merging by index', () => {
    const result = deepMergeJsonb(
      { data: { sow: ['a', 'b', 'c'] } },
      { data: { sow: ['a', 'c'] } },
    )
    expect(result).toEqual({ data: { sow: ['a', 'c'] } })
  })

  it('sets a leaf to null when the patch value is null', () => {
    const result = deepMergeJsonb({ a: { b: 1 } }, { a: { b: null } })
    expect(result).toEqual({ a: { b: null } })
  })

  it('skips undefined patch values but applies the rest', () => {
    const result = deepMergeJsonb({ a: 1 }, { a: undefined, b: 2 })
    expect(result).toEqual({ a: 1, b: 2 })
  })

  it('replaces wholesale on type mismatch (object over scalar and vice-versa)', () => {
    expect(deepMergeJsonb({ a: 1 }, { a: { b: 2 } })).toEqual({ a: { b: 2 } })
    expect(deepMergeJsonb({ a: { b: 2 } }, { a: 5 })).toEqual({ a: 5 })
  })

  it('treats a non-object current as an empty base', () => {
    expect(deepMergeJsonb(null, { a: 1 })).toEqual({ a: 1 })
    expect(deepMergeJsonb(undefined, { a: 1 })).toEqual({ a: 1 })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/shared/dal/server/lib/deep-merge-jsonb.test.ts`
Expected: FAIL — cannot resolve `./deep-merge-jsonb` (module not found).

- [ ] **Step 3: Write the implementation**

Create `src/shared/dal/server/lib/deep-merge-jsonb.ts`:

```ts
// ─── deepMergeJsonb ────────────────────────────────────────────────────────
// Pure, recursive deep-merge for JSONB column values. Recurses into plain
// objects; replaces arrays, scalars, null, and type-mismatches wholesale.
// Keys present in `current` but absent from `patch` are PRESERVED — this is
// the hard rule that makes partial nested updates safe.
//
// see docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

export function deepMergeJsonb(
  current: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const base: Record<string, unknown> = isPlainObject(current) ? { ...current } : {}
  for (const [key, patchVal] of Object.entries(patch)) {
    if (patchVal === undefined) {
      continue
    }
    const currentVal = base[key]
    if (isPlainObject(currentVal) && isPlainObject(patchVal)) {
      base[key] = deepMergeJsonb(currentVal, patchVal)
    }
    else {
      base[key] = patchVal
    }
  }
  return base
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/shared/dal/server/lib/deep-merge-jsonb.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/dal/server/lib/deep-merge-jsonb.ts src/shared/dal/server/lib/deep-merge-jsonb.test.ts
git commit -m "feat(dal): add pure deepMergeJsonb with sibling-preserving semantics

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire deep-merge into the CRUD update path

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts` (replace `buildUpdateSet` at lines 95-165; rewrite `updateImpl` at lines 167-207; add a `hasMergeColumnKey` helper; import `deepMergeJsonb`)

**Interfaces:**
- Consumes: `deepMergeJsonb` from Task 2.
- Produces: `updateImpl` with fast-path/merge-path branching; no exported signature change (the CRUD factory's public API is unchanged).

**Context for the implementer:** The current `buildUpdateSet` (lines 116-165) emits `sql\`COALESCE(col,'{}') || …\`` — the shallow bug. `updateImpl` (lines 167-207) does an optional unlocked `previousRow` SELECT for after-hooks. We replace `buildUpdateSet` with `buildMergedUpdateData` (takes the locked current row, returns a plain `.set()` object, re-validates the merged whole) and add `hasMergeColumnKey` to decide the path. `spec.schemas.update` is `insert.partial()` — a ZodObject whose `.shape[key]` is that column's own (optional) schema.

- [ ] **Step 1: Replace the import and the `sql` usage note**

At the top of `create-crud-dal.ts`, the existing import is:

```ts
import { and, eq, sql } from 'drizzle-orm'
```

`sql` is no longer used after this task (the merge no longer emits SQL fragments). Change it to:

```ts
import { and, eq } from 'drizzle-orm'
```

Add, below the existing type/`db` imports:

```ts
import { deepMergeJsonb } from './deep-merge-jsonb'
```

- [ ] **Step 2: Replace `buildUpdateSet` (lines 95-165) with `buildMergedUpdateData` + `hasMergeColumnKey`**

Delete the entire JSDoc block + `buildUpdateSet` function (lines 95 through 165) and replace with:

```ts
/**
 * Resolve the TS-side property keys of the opted-in JSONB merge columns for a
 * spec. Drizzle's `PgColumn` reference identity is matched against the table's
 * column entries (TS-side keys are camelCase; DB names are snake_case).
 */
function resolveMergeKeys<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
): Set<string> {
  const keys = new Set<string>()
  const mergeCols = spec.update?.jsonbMergeColumns
  if (!mergeCols || mergeCols.length === 0) {
    return keys
  }
  const mergeColSet = new Set<PgColumn>(mergeCols)
  const tableCols = spec.table as unknown as Record<string, PgColumn>
  for (const [tsKey, col] of Object.entries(tableCols)) {
    if (mergeColSet.has(col)) {
      keys.add(tsKey)
    }
  }
  return keys
}

/**
 * True if the validated payload contains at least one opted-in merge-column
 * key with a defined value — i.e. the update needs the atomic merge path.
 */
function hasMergeColumnKey<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  validated: Record<string, unknown>,
): boolean {
  const mergeKeys = resolveMergeKeys(spec)
  for (const key of mergeKeys) {
    if (validated[key] !== undefined) {
      return true
    }
  }
  return false
}

/**
 * Build the Drizzle `.set()` payload for the merge path. For each opted-in
 * JSONB column, deep-merge the incoming partial against the LOCKED current row
 * and re-validate the merged WHOLE with the column's Zod schema, so the object
 * written to Postgres is always schema-valid and no sibling key is dropped.
 * Non-merge keys pass through unchanged (scalar columns update in the same
 * statement). `null` clears a column; arrays/scalars on a merge column are a
 * precondition error.
 *
 * see docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested
 */
function buildMergedUpdateData<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  validated: Record<string, unknown>,
  currentRow: Record<string, unknown>,
): Record<string, unknown> {
  const mergeKeys = resolveMergeKeys(spec)
  const updateSchema = spec.schemas.update as unknown as {
    shape?: Record<string, { parse: (v: unknown) => unknown }>
  }

  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(validated)) {
    if (value === undefined) {
      continue
    }
    if (!mergeKeys.has(key)) {
      out[key] = value
      continue
    }
    if (value === null) {
      out[key] = null
      continue
    }
    if (Array.isArray(value) || typeof value !== 'object') {
      throw new ThrowableDalError({
        type: 'precondition-failed',
        reason: `[create-crud-dal] jsonbMergeColumns entry '${key}' for '${spec.entityName}' `
          + `received non-object value (${Array.isArray(value) ? 'array' : typeof value}); `
          + `merge requires a plain object, or null to clear.`,
      })
    }
    const merged = deepMergeJsonb(currentRow[key] ?? {}, value as Record<string, unknown>)
    const colSchema = updateSchema.shape?.[key]
    out[key] = colSchema ? colSchema.parse(merged) : merged
  }
  return out
}
```

- [ ] **Step 3: Rewrite `updateImpl` (lines 167-207) with fast-path / merge-path branching**

Replace the whole `updateImpl` function with:

```ts
async function updateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number, data: Update<TTable> },
): Promise<DalReturn<Row<TTable>>> {
  return dalDbOperation(async () => {
    const enrichedData = spec.hooks?.update?.before
      ? await spec.hooks.update.before(input.data, ctx)
      : input.data

    const validated = spec.schemas.update.parse(enrichedData) as Update<TTable>
    const validatedRec = validated as Record<string, unknown>
    const where = and(eq(pkColumn, input.id), ctx.scope ?? undefined)

    // Fast path — no opted-in merge column present: single UPDATE, unchanged.
    if (!hasMergeColumnKey(spec, validatedRec)) {
      let previousRow: Row<TTable> | undefined
      if (spec.hooks?.update?.after) {
        const prev = await getByIdImpl(spec, pkColumn, ctx, { id: input.id })
        if (prev.success) {
          previousRow = prev.data as Row<TTable> | undefined
        }
      }
      const [row] = await db
        .update(spec.table as PgTable)
        .set(validatedRec)
        .where(where)
        .returning()
      if (!row) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (spec.hooks?.update?.after && previousRow) {
        await spec.hooks.update.after(row as Row<TTable>, ctx, {
          previousRow,
          input: input.data,
        })
      }
      return row as Row<TTable>
    }

    // Merge path — lock the row, deep-merge against the snapshot, re-validate,
    // write, all in one transaction. The locked read doubles as previousRow.
    return db.transaction(async (tx) => {
      const [currentRow] = await tx
        .select()
        .from(spec.table as PgTable)
        .where(where)
        .for('update')
        .limit(1)
      if (!currentRow) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      const setData = buildMergedUpdateData(
        spec,
        validatedRec,
        currentRow as Record<string, unknown>,
      )
      const [row] = await tx
        .update(spec.table as PgTable)
        .set(setData)
        .where(where)
        .returning()
      if (!row) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (spec.hooks?.update?.after) {
        await spec.hooks.update.after(row as Row<TTable>, ctx, {
          previousRow: currentRow as Row<TTable>,
          input: input.data,
        })
      }
      return row as Row<TTable>
    })
  })
}
```

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (If `sql` is flagged unused, confirm Step 1's import edit landed.)

- [ ] **Step 5: Commit**

```bash
git add src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "feat(dal): atomic deep-merge for JSONB columns under row lock

Replaces the shallow COALESCE(col,'{}') || value merge with an app-side
recursive deep-merge run inside SELECT ... FOR UPDATE, re-validating the
merged whole. Fast path unchanged for non-merge updates.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: DB smoke — prove siblings survive and concurrency is safe

**Files:**
- Create: `scripts/smoke-deep-merge.ts` (temporary verification script; deleted at the end of the task)

**Interfaces:**
- Consumes: the live merge path from Task 3, the dev DB (isolated Neon branch).

**Context:** There is no DB test harness; this is a manual smoke against the dev DB. Scripts must `import './lib/load-env'` (NOT `dotenv/config`) so `.env.local` worktree overrides load, and the runtime DB client selects `DATABASE_DEV_URL` via `NODE_ENV`. Pick a real dev customer id (one with a `customerProfileJSON`), or create one in the script.

- [ ] **Step 1: Write the smoke script**

Create `scripts/smoke-deep-merge.ts`:

```ts
import './lib/load-env'

import { and, eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { customers } from '@/shared/db/schema'
import { customerCrud } from '@/shared/entities/customers/lib/server-spec' // adjust to the actual export

const SYSTEM_CTX = { scope: null } as const // omni scope; adjust to the real ScopedContext shape

async function main() {
  // 1. Seed a customer with a nested profile.
  const [seed] = await db
    .insert(customers)
    .values({
      name: 'SMOKE deep-merge',
      customerProfileJSON: { mainPainPoint: { urgencyRating: 5, accessor: 'keep-me' } } as never,
    })
    .returning()
  const id = seed.id
  console.log('seeded', id)

  // 2. Partial nested update: change only urgencyRating.
  await customerCrud.update(SYSTEM_CTX as never, {
    id,
    data: { customerProfileJSON: { mainPainPoint: { urgencyRating: 9 } } } as never,
  })

  // 3. Assert the sibling survived.
  const [after] = await db.select().from(customers).where(eq(customers.id, id))
  const profile = after.customerProfileJSON as { mainPainPoint?: { urgencyRating?: number, accessor?: string } }
  const ok = profile.mainPainPoint?.accessor === 'keep-me' && profile.mainPainPoint?.urgencyRating === 9
  console.log('sibling survived:', ok, JSON.stringify(profile))

  // 4. Concurrency: two partial updates to different sub-keys, fired together.
  await Promise.all([
    customerCrud.update(SYSTEM_CTX as never, { id, data: { customerProfileJSON: { mainPainPoint: { urgencyRating: 1 } } } as never }),
    customerCrud.update(SYSTEM_CTX as never, { id, data: { customerProfileJSON: { additionalPainPoints: ['x'] } } as never }),
  ])
  const [after2] = await db.select().from(customers).where(eq(customers.id, id))
  console.log('after concurrent:', JSON.stringify(after2.customerProfileJSON))

  // 5. Cleanup.
  await db.delete(customers).where(and(eq(customers.id, id)))
  if (!ok) {
    throw new Error('SMOKE FAILED: sibling key was dropped')
  }
  console.log('SMOKE PASSED')
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
```

> Adjust the imports (`customerCrud` export path, `ScopedContext` shape) to the actual code — the implementer verifies these against `src/shared/entities/customers/lib/server-spec.ts` before running. The script is throwaway.

- [ ] **Step 2: Run the smoke against the dev DB**

Run: `pnpm tsx scripts/smoke-deep-merge.ts`
Expected: `sibling survived: true …`, then `after concurrent:` showing BOTH `mainPainPoint` (with the last urgencyRating) AND `additionalPainPoints: ['x']` present, then `SMOKE PASSED`.

- [ ] **Step 3: Delete the throwaway script**

Run: `rm scripts/smoke-deep-merge.ts`

- [ ] **Step 4: Verify nothing else changed**

Run: `git status --porcelain`
Expected: empty (the script was created and deleted; no tracked changes remain from this task).

---

### Task 5: Correct the stale docs (part of this work)

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts` (any remaining `||`-describing comments — verify none remain after Task 3)
- Modify: `src/shared/entities/proposals/DOCS.md` (the `#jsonb-merge-on-update` section describing `COALESCE || `)
- Modify: `src/trpc/DOCS.md:260` (merge description)
- Modify: `docs/adr/0002-entity-server-system.md` (add one line: merge is app-side atomic deep-merge, not `||`)
- Modify: `docs/codebase-conventions/dal-conventions.md` (add the merge rule)
- Modify: `memory/MEMORY.md` (fix meeting column names; thin the merge-hazard entry to reflection + link)
- Modify: `docs/plans/2026-06-27-jsonb-deep-merge-handoff.md:69` (fix `situationProfileJSON`/`programDataJSON` → `contextJSON`/`flowStateJSON`)

**Interfaces:** none (documentation).

- [ ] **Step 1: Update `proposals/DOCS.md` merge description**

Find the `#jsonb-merge-on-update` section describing `COALESCE(col,'{}') || $value::jsonb`. Replace the mechanism description with: "JSONB merge columns are deep-merged app-side inside a `SELECT … FOR UPDATE` transaction; partial nested payloads never delete siblings; arrays/scalars replace wholesale; clear a column with an explicit `null`. See `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested`."

- [ ] **Step 2: Update `src/trpc/DOCS.md`**

At the merge description (~line 260), apply the same correction as Step 1 (deep-merge under row lock, not shallow `||`).

- [ ] **Step 3: Add the one-line note to ADR-0002**

In `docs/adr/0002-entity-server-system.md`, where it references the JSONB merge behavior, add: "> Note (2026-07): the merge is an app-side atomic recursive deep-merge under a row lock, not a SQL `||`. See `docs/codebase-conventions/jsonb-columns.md`."

- [ ] **Step 4: Add the rule to `dal-conventions.md`**

In `docs/codebase-conventions/dal-conventions.md`, add: "**JSONB merge columns deep-merge.** Partial nested payloads never delete siblings; arrays and scalars replace wholesale; clear a value with an explicit `null` on a nullable field. Whole-document writers must NOT be listed in `jsonbMergeColumns` (deep-merge would resurrect deliberately-removed keys). See `jsonb-columns.md#never-shallow-merge-nested`."

- [ ] **Step 5: Fix MEMORY.md**

In `memory/MEMORY.md`: (a) correct the entity-model line naming meeting JSONB columns to `contextJSON` / `flowStateJSON` (not `situationProfileJSON` / `programDataJSON`); (b) thin the `project-funnel-capture-and-jsonb-merge` index line to note the deep-merge fix has a spec (`docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` §4).

- [ ] **Step 6: Fix the handoff doc column names**

In `docs/plans/2026-06-27-jsonb-deep-merge-handoff.md` (~line 69), replace `situationProfileJSON` / `programDataJSON` with `contextJSON` / `flowStateJSON`.

- [ ] **Step 7: Commit**

```bash
git add src/shared/entities/proposals/DOCS.md src/trpc/DOCS.md docs/adr/0002-entity-server-system.md docs/codebase-conventions/dal-conventions.md memory/MEMORY.md docs/plans/2026-06-27-jsonb-deep-merge-handoff.md src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "docs(dal): correct JSONB merge description to app-side deep-merge

Docs previously described the merge as shallow COALESCE || ; now it is
app-side atomic deep-merge under a row lock. Also fixes stale meeting
column names (contextJSON/flowStateJSON) in MEMORY.md and the handoff doc.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (§4 of the spec):**
- §4.1 hard rule → Task 2 (sibling-preservation tests) + Task 4 (DB proof). ✓
- §4.2 pure function → Task 2. ✓
- §4.3 array-replace → Task 2 (array test). ✓
- §4.4 CRUD integration (fast/merge paths, FOR UPDATE, merged-whole validation) → Task 3. ✓
- §4.5 `jsonbMergeColumns` stays; meetings full-replace → preserved (config untouched; meetings not opted in) + documented in Task 5 Step 4. ✓
- §4.6 funnel bypass Phase 2 → **out of scope for WS-2 by design** (Phase 1 leaves `mergeFunnelEnrichment` in place); noted, no task. ✓
- §4.7 test strategy → Task 1 (vitest) + Task 2 (unit) + Task 4 (DB smoke). ✓
- §4.8 doc corrections → Task 5. ✓

**Placeholder scan:** No TBD/"add error handling"/"write tests for the above". The one adjustment note (Task 4 import paths) is explicit and bounded — the smoke script is throwaway and the implementer verifies exports against a named file. ✓

**Type consistency:** `deepMergeJsonb(current, patch)` signature identical in Task 2 and its use in `buildMergedUpdateData` (Task 3). `resolveMergeKeys` / `hasMergeColumnKey` / `buildMergedUpdateData` names consistent across Task 3 steps. `ThrowableDalError({ type: 'precondition-failed' | 'not-found' })` matches the existing usage in the read file. ✓

**Out-of-scope (correctly deferred):** funnel bypass unification (Phase 2), the `_v` version field (added when WS-4/WS-5 touch schemas), and the after-hook self-gate (funnel epic). These are not WS-2.
