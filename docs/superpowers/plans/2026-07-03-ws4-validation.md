# WS-4: Validation Gaps (Zod at the Write Boundary) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the runtime-validation gaps on `.$type<>()`-only JSONB columns. `.$type` is a compile-time no-op — the only runtime guarantee is an explicit Zod `.parse()` at the write boundary. These tables do NOT use `createCrudDal`; every write is a bespoke `db.insert/update`. Wire (or author-then-wire) a Zod schema at each strict boundary, document the two loose-OK columns, drop one dead column, and remove one manual-`updatedAt` rule violation.

**Architecture:** Six STRICT columns get a `schema.parse()` at their bespoke write boundary (two schemas already exist and are just unwired; four are authored fresh, TDD-first). Two LOOSE-OK columns (machine-generated / external-audit) get a one-line justifying comment, no strict Zod. One dead column (`x_project_scopes.variablesData`, zero writers) is dropped via `pnpm db:push:dev`. One manual `updatedAt` at `manage-project.ts:35` is removed (schema-helpers already `.$onUpdate()`s it).

**Tech Stack:** TypeScript, Drizzle ORM (`node-postgres` + `pg.Pool`), Zod, drizzle-zod, pnpm, Vitest (added in WS-2 — this plan reuses it).

**Spec:** `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` §6.

**Depends on:** WS-1 governance rule (`docs/codebase-conventions/jsonb-columns.md#zod-parse-at-write-boundary` — cross-linked, not blocking) and **WS-2 for the Vitest runner** (`vitest.config.ts` + the `pnpm test` script land in WS-2 Task 1). If WS-2 has not landed, add Vitest first per WS-2 Task 1. Otherwise independent of WS-3 / WS-5.

## ⚠️ Staleness flagged during research (verify before implementing)

1. **`projects.beforeAfterPairsJSON` write boundary is NOT `manage-project.ts`.** The spec's WS-4 table says "wire `beforeAfterPairsSchema.parse()` in `manage-project.ts`". But `beforeAfterPairsJSON` is absent from `projectFormSchema` and is never written by `createProject`/`updateProject`. Its **only** writer is `scripts/match-before-after.ts:351` (`.set({ beforeAfterPairsJSON: result })`). The correct strict boundary is that script — see Task 2. `beforeAfterPairsSchema` already exists at `src/shared/entities/projects/schemas/index.ts:12`.
2. **`activityMetaSchemas` is authored but unwired** (`src/shared/entities/activities/schemas/index.ts:29`) — the router validates `metaJSON` only as `z.record(z.string(), z.unknown())` (`activities.router.ts:117,153`). Task 4 wires the per-type union.
3. **`x_project_scopes.variablesData` is dead** — zero writers confirmed. (The `variablesData` symbol in `seeds/variables.ts` / `db/types/variables.ts` is the seed-data object for the *`variables`* table, unrelated to this column.) Task 8 drops it.
4. **`manage-project.ts:35` sets `updatedAt` manually** — `schema-helpers.ts:13` `updatedAt` already has `.$onUpdate()`. Task 3 removes the manual set (folded in with `hoRequirements`, same file).

## Global Constraints

- Package manager: **pnpm**. Path alias `@/` → `src/`. **NEVER run `pnpm build`** — verify with `pnpm tsc` + `pnpm lint`. **NEVER run `pnpm db:push`** (production); dev only via `pnpm db:push:dev` (only the `variablesData` drop, Task 8, touches schema).
- Work directly on `main`. **Stage files explicitly** (`git add <path>`), never `git add -A`, so unrelated WIP isn't swept in.
- **Named exports only.** No `export default` (existing seed files that already `export default async function seed` are pre-existing and out of scope — do not convert them).
- Zod schemas co-locate at `entities/<domain>/schemas/index.ts` (`schemas/` is a **sibling** of `lib/`, never `lib/schemas/`). For tables without an entity home (`scopes`, `variables`), co-locate the schema **beside the seed** until a runtime mutation justifies an entity home (YAGNI).
- `.$type<>()` is a runtime no-op — the ONLY runtime guarantee is the Zod `.parse()` at the write boundary. External-payload columns may stay loose (document why).
- **Never set `updatedAt` manually.** Reuse existing API surface; don't invent ad-hoc DAL.
- Every authored Zod schema is TDD'd (Vitest): a `<schema>.test.ts` asserting it ACCEPTS a valid shape and REJECTS a bad one, written and failing BEFORE it is wired at the boundary.
- Commit messages end with: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

### Task 1: Confirm the Vitest runner is available

**Files:**
- Read-only: `package.json`, `vitest.config.ts`

**Interfaces:**
- Consumes: WS-2 Task 1 output (`pnpm test` script + `vitest.config.ts` with `include: ['src/**/*.test.ts']`).
- Produces: a working `pnpm test` for Tasks 2, 4, 5, 6, 7.

- [ ] **Step 1: Verify Vitest is wired**

Run: `grep -n '"test"' package.json && test -f vitest.config.ts && echo "vitest config present"`
Expected: a `"test": "vitest run"` script AND `vitest config present`.

If EITHER is missing (WS-2 not yet landed), execute **WS-2 Task 1 verbatim** (`pnpm add -D vitest`, create `vitest.config.ts` with `include: ['src/**/*.test.ts']` + `environment: 'node'`, add `"test": "vitest run"` / `"test:watch": "vitest"`), commit it as its own `chore(test): add vitest runner` commit, then continue.

> Note: `vitest.config.ts` includes only `src/**/*.test.ts`. The `beforeAfterPairsSchema` test in Task 2 lives under `src/` (the schema is at `entities/projects/schemas/`), so it is picked up. No test files are authored under `scripts/`.

---

### Task 2: Wire `beforeAfterPairsSchema.parse()` at the script boundary (STRICT)

**Files:**
- Create: `src/shared/entities/projects/schemas/before-after-pairs.test.ts`
- Read-only (schema already exists): `src/shared/entities/projects/schemas/index.ts:5-17`
- Modify: `scripts/match-before-after.ts` (the `.set({ beforeAfterPairsJSON: result })` at line ~351)

**Interfaces:**
- Consumes: `beforeAfterPairsSchema` (already exported at `entities/projects/schemas/index.ts:12`).
- Produces: a schema-validated write of `beforeAfterPairsJSON` — the object persisted to Postgres is always `{ pairs: BeforeAfterPair[] }`.

**Context:** `beforeAfterPairsSchema` = `z.object({ pairs: z.array(beforeAfterPairSchema) })`; `beforeAfterPairSchema` = `{ beforeMediaId: number, afterMediaId: number, label: string, confidence: number(0..1) }`. The schema exists but is never `.parse()`d — `match-before-after.ts` writes `result` (the raw matcher output) directly. This is the strict boundary.

- [ ] **Step 1: Write the failing test for the existing schema**

Create `src/shared/entities/projects/schemas/before-after-pairs.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { beforeAfterPairsSchema } from './index'

describe('beforeAfterPairsSchema', () => {
  it('accepts a valid pairs payload', () => {
    const valid = {
      pairs: [
        { beforeMediaId: 1, afterMediaId: 2, label: 'Kitchen', confidence: 0.9 },
      ],
    }
    expect(beforeAfterPairsSchema.parse(valid)).toEqual(valid)
  })

  it('rejects a confidence outside 0..1', () => {
    const bad = {
      pairs: [
        { beforeMediaId: 1, afterMediaId: 2, label: 'Kitchen', confidence: 1.5 },
      ],
    }
    expect(() => beforeAfterPairsSchema.parse(bad)).toThrow()
  })

  it('rejects a non-array pairs value', () => {
    expect(() => beforeAfterPairsSchema.parse({ pairs: 'nope' })).toThrow()
  })
})
```

- [ ] **Step 2: Run the test — it should PASS immediately (schema already exists)**

Run: `pnpm test src/shared/entities/projects/schemas/before-after-pairs.test.ts`
Expected: PASS (3 tests green). This test is a regression guard for the existing schema; if it fails, the schema shape drifted — stop and reconcile before wiring.

- [ ] **Step 3: Wire `.parse()` at the script write boundary**

In `scripts/match-before-after.ts`, add the import at the top with the other `@/` imports:

```ts
import { beforeAfterPairsSchema } from '@/shared/entities/projects/schemas'
```

Then change the write (line ~348-354) from:

```ts
      if (!DRY_RUN) {
        await db
          .update(projects)
          .set({ beforeAfterPairsJSON: result })
          .where(eq(projects.id, projectId))
        console.log(`  Saved ${result.pairs.length} pairs to DB.`)
      }
```

to:

```ts
      if (!DRY_RUN) {
        const validated = beforeAfterPairsSchema.parse(result)
        await db
          .update(projects)
          .set({ beforeAfterPairsJSON: validated })
          .where(eq(projects.id, projectId))
        console.log(`  Saved ${validated.pairs.length} pairs to DB.`)
      }
```

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/projects/schemas/before-after-pairs.test.ts scripts/match-before-after.ts
git commit -m "feat(projects): parse beforeAfterPairsJSON at the match-before-after write boundary

Wires the already-authored beforeAfterPairsSchema at its only writer
(scripts/match-before-after.ts). .\$type<> is compile-time only; this adds
the runtime guarantee. Corrects the spec's manage-project.ts location.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Author + wire `hoRequirements` schema; drop manual `updatedAt` (STRICT + CLEANUP)

**Files:**
- Modify: `src/shared/entities/projects/schemas/index.ts` (add `hoRequirementsSchema` near `beforeAfterPairsSchema`, ~line 17)
- Create: `src/shared/entities/projects/schemas/ho-requirements.test.ts`
- Modify: `src/features/project-management/dal/server/manage-project.ts` (`createProject` ~line 14, `updateProject` ~line 33-36 incl. the manual `updatedAt` at :35)

**Interfaces:**
- Consumes: nothing new.
- Produces: `hoRequirementsSchema` (`z.array(z.string())`); `createProject`/`updateProject` that parse `hoRequirements` before write and never set `updatedAt`.

**Context:** `hoRequirements` (`jsonb('ho_requirements').$type<string[]>()`) IS written through `manage-project.ts` — the edit-project form (`edit-project-view.tsx:83`) sends it through `projectFormSchema.partial()` → `crud.router.ts:133` → `updateProject`. `projectFormSchema` already types it as `z.array(z.string()).nullable().optional()`, but the DAL boundary itself does not parse. Add an explicit parse there so ALL callers of `createProject`/`updateProject` (form, and any future caller) are guarded. Also remove the manual `updatedAt: new Date().toISOString()` at :35 (rule violation — `schema-helpers.ts:13` `.$onUpdate()`s it).

- [ ] **Step 1: Author the schema**

In `src/shared/entities/projects/schemas/index.ts`, immediately after the `beforeAfterPairs` block (after line 17), add:

```ts
export const hoRequirementsSchema = z.array(z.string())
export type HoRequirements = z.infer<typeof hoRequirementsSchema>
```

- [ ] **Step 2: Write the failing test**

Create `src/shared/entities/projects/schemas/ho-requirements.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { hoRequirementsSchema } from './index'

describe('hoRequirementsSchema', () => {
  it('accepts an array of strings', () => {
    expect(hoRequirementsSchema.parse(['open up space', 'wider parking'])).toEqual([
      'open up space',
      'wider parking',
    ])
  })

  it('accepts an empty array', () => {
    expect(hoRequirementsSchema.parse([])).toEqual([])
  })

  it('rejects a non-string element', () => {
    expect(() => hoRequirementsSchema.parse(['ok', 42])).toThrow()
  })

  it('rejects a non-array', () => {
    expect(() => hoRequirementsSchema.parse('nope')).toThrow()
  })
})
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `pnpm test src/shared/entities/projects/schemas/ho-requirements.test.ts`
Expected: PASS (4 tests green).

- [ ] **Step 4: Wire the parse + drop the manual `updatedAt` in `manage-project.ts`**

Add the import at the top with the other `@/` imports:

```ts
import { hoRequirementsSchema } from '@/shared/entities/projects/schemas'
```

Add a small local helper above `createProject` (after the imports) that parses `hoRequirements` when present (it is nullable/optional — `null`/`undefined` pass through untouched):

```ts
function parseHoRequirements<T extends { hoRequirements?: string[] | null }>(data: T): T {
  if (data.hoRequirements == null) {
    return data
  }
  return { ...data, hoRequirements: hoRequirementsSchema.parse(data.hoRequirements) }
}
```

Change `createProject` (line ~14) from:

```ts
  const [project] = await db.insert(projects).values(data).returning()
```

to:

```ts
  const [project] = await db.insert(projects).values(parseHoRequirements(data)).returning()
```

Change `updateProject` (line ~33-37) from:

```ts
  const [project] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, projectId))
    .returning()
```

to:

```ts
  const [project] = await db
    .update(projects)
    .set(parseHoRequirements(data))
    .where(eq(projects.id, projectId))
    .returning()
```

> Note: `parseHoRequirements` is typed against `hoRequirements?: string[] | null`; both `InsertProject` and `Partial<InsertProject>` satisfy it. `updatedAt` now auto-bumps via `.$onUpdate()` — do not re-add it.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/projects/schemas/index.ts src/shared/entities/projects/schemas/ho-requirements.test.ts src/features/project-management/dal/server/manage-project.ts
git commit -m "feat(projects): parse hoRequirements at the DAL boundary; drop manual updatedAt

Authors hoRequirementsSchema and parses it in createProject/updateProject so
every caller is guarded (not just the form-level schema). Removes the manual
updatedAt set in updateProject — schema-helpers already .\$onUpdate()s it.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire `activityMetaSchemas` per-type parse at the two write boundaries (STRICT)

**Files:**
- Create: `src/shared/entities/activities/schemas/meta.test.ts`
- Modify: `src/shared/entities/activities/schemas/index.ts` (add a `parseActivityMeta` helper after the `activityMetaSchemas` map, ~line 34)
- Modify: `src/trpc/routers/schedule.router/activities.router.ts` (`create` mutation ~line 119-126; `update` mutation ~line 174-178)
- Modify: `src/shared/entities/activities/dal/server/google-calendar.ts` (`createActivityFromGCalEvent` ~line 65-69)

**Interfaces:**
- Consumes: `activityMetaSchemas` (already exported at `entities/activities/schemas/index.ts:29`), discriminated by activity `type` (`'note' | 'reminder' | 'task' | 'event'`).
- Produces: `parseActivityMeta(type, meta)` — returns the parsed meta for a known type, `undefined` when meta is nullish, and passes through unchanged for any unmapped type. Wired at both write boundaries.

**Context:** `activityMetaSchemas` is `{ note, reminder, task, event }` keyed by activity type. The router currently validates `metaJSON` only as `z.record(z.string(), z.unknown())` — the union is unwired. The two bespoke writers are the tRPC `create`/`update` mutations (`db.insert/update(activities)`) and `createActivityFromGCalEvent` (`db.insert(activities).values(data)`, where `data.type` and `data.metaJSON` are present). A per-type parse must key off the row's `type`.

- [ ] **Step 1: Add the `parseActivityMeta` helper**

In `src/shared/entities/activities/schemas/index.ts`, after the `activityMetaSchemas` map (after line 34), add:

```ts
export type ActivityType = keyof typeof activityMetaSchemas

/**
 * Validate an activity's metaJSON against its type-specific schema. Returns
 * `undefined` for nullish meta; passes through unchanged for an unmapped type
 * (defensive — the type enum is the source of truth, but never throw on a type
 * we don't have a schema for). `.$type<>()` gives no runtime guarantee — this
 * is the guarantee.
 *
 * see docs/codebase-conventions/jsonb-columns.md#zod-parse-at-write-boundary
 */
export function parseActivityMeta(
  type: string,
  meta: unknown,
): Record<string, unknown> | undefined {
  if (meta == null) {
    return undefined
  }
  const schema = activityMetaSchemas[type as ActivityType]
  if (!schema) {
    return meta as Record<string, unknown>
  }
  return schema.parse(meta) as Record<string, unknown>
}
```

- [ ] **Step 2: Write the failing test**

Create `src/shared/entities/activities/schemas/meta.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { parseActivityMeta } from './index'

describe('parseActivityMeta', () => {
  it('accepts a valid task meta (priority)', () => {
    expect(parseActivityMeta('task', { priority: 'high' })).toEqual({ priority: 'high' })
  })

  it('accepts a valid event meta (location/allDay)', () => {
    expect(parseActivityMeta('event', { location: 'Site', allDay: true })).toEqual({
      location: 'Site',
      allDay: true,
    })
  })

  it('rejects a task meta with a bad priority enum value', () => {
    expect(() => parseActivityMeta('task', { priority: 'urgent-ish' })).toThrow()
  })

  it('rejects an event meta with a non-boolean allDay', () => {
    expect(() => parseActivityMeta('event', { allDay: 'yes' })).toThrow()
  })

  it('returns undefined for nullish meta', () => {
    expect(parseActivityMeta('note', null)).toBeUndefined()
    expect(parseActivityMeta('note', undefined)).toBeUndefined()
  })
})
```

> Verify the priority enum before running: `parseActivityMeta('task', { priority: 'high' })` must use a member of `activityTaskPriorities`. If `'high'` is not a member, substitute a real one (check `@/shared/constants/enums`).

- [ ] **Step 3: Run the test to verify it passes**

Run: `pnpm test src/shared/entities/activities/schemas/meta.test.ts`
Expected: PASS (5 tests green).

- [ ] **Step 4: Wire the parse in the tRPC `create` mutation**

In `activities.router.ts`, add the import with the other `@/` imports:

```ts
import { parseActivityMeta } from '@/shared/entities/activities/schemas'
```

In the `create` mutation (~line 119-126), change:

```ts
    .mutation(async ({ ctx, input }) => {
      const [created] = await db
        .insert(activities)
        .values({
          ...input,
          ownerId: ctx.session.user.id,
        })
        .returning()
```

to:

```ts
    .mutation(async ({ ctx, input }) => {
      const metaJSON = parseActivityMeta(input.type, input.metaJSON)
      const [created] = await db
        .insert(activities)
        .values({
          ...input,
          metaJSON,
          ownerId: ctx.session.user.id,
        })
        .returning()
```

- [ ] **Step 5: Wire the parse in the tRPC `update` mutation**

In the `update` mutation (~line 155-178), the type may be absent on a partial update, so read the existing row's type when needed. Change:

```ts
    .mutation(async ({ ctx, input }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const { id, ...rest } = input

      if (!isOmni) {
        const [existing] = await db
          .select({ ownerId: activities.ownerId })
          .from(activities)
          .where(eq(activities.id, id))

        if (!existing) {
          throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' })
        }

        if (existing.ownerId !== ctx.session.user.id) {
          throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update this activity' })
        }
      }

      const [updated] = await db
        .update(activities)
        .set(rest)
        .where(eq(activities.id, id))
        .returning()
```

to:

```ts
    .mutation(async ({ ctx, input }) => {
      const isOmni = ctx.ability.can('manage', 'all')
      const { id, ...rest } = input

      const [existing] = await db
        .select({ ownerId: activities.ownerId, type: activities.type })
        .from(activities)
        .where(eq(activities.id, id))

      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Activity not found' })
      }

      if (!isOmni && existing.ownerId !== ctx.session.user.id) {
        throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to update this activity' })
      }

      const set = rest.metaJSON !== undefined
        ? { ...rest, metaJSON: parseActivityMeta(rest.type ?? existing.type, rest.metaJSON) }
        : rest

      const [updated] = await db
        .update(activities)
        .set(set)
        .where(eq(activities.id, id))
        .returning()
```

> This folds the previously omni-only `existing` fetch into an always-fetch so the type is available for the parse, and preserves the not-found / forbidden checks. If `metaJSON` is not in the payload, the write is unchanged.

- [ ] **Step 6: Wire the parse in `createActivityFromGCalEvent`**

In `src/shared/entities/activities/dal/server/google-calendar.ts`, add the import at the top:

```ts
import { parseActivityMeta } from '@/shared/entities/activities/schemas'
```

Change `createActivityFromGCalEvent` (line ~65-69) from:

```ts
export async function createActivityFromGCalEvent(
  data: typeof activities.$inferInsert,
): Promise<void> {
  await db.insert(activities).values(data)
}
```

to:

```ts
export async function createActivityFromGCalEvent(
  data: typeof activities.$inferInsert,
): Promise<void> {
  await db.insert(activities).values({
    ...data,
    metaJSON: parseActivityMeta(data.type, data.metaJSON),
  })
}
```

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/shared/entities/activities/schemas/index.ts src/shared/entities/activities/schemas/meta.test.ts src/trpc/routers/schedule.router/activities.router.ts src/shared/entities/activities/dal/server/google-calendar.ts
git commit -m "feat(activities): wire per-type metaJSON validation at both write boundaries

activityMetaSchemas was authored but unwired — the router parsed metaJSON only
as a loose record. Adds parseActivityMeta(type, meta) and applies it in the
tRPC create/update mutations and createActivityFromGCalEvent.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Author + wire `scopes.homeArea` schema in the seed mapper (STRICT, seed-only, low urgency)

**Files:**
- Create: `src/shared/db/seeds/scope-home-areas.schema.ts` (co-located beside the seed — `scopes` has no entity home)
- Create: `src/shared/db/seeds/scope-home-areas.test.ts`
- Modify: `src/shared/db/seeds/scopes.ts` (the mapper loop, ~line 23-26)

**Interfaces:**
- Consumes: `homeAreas` enum (`@/shared/domains/construction/constants/enums`).
- Produces: `scopeHomeAreaSchema` (`z.array(z.enum(homeAreas))`); parsed per scope in the seed mapper before insert.

**Context:** `scopes.homeArea` is `jsonb('home_areas').$type<HomeArea[]>().notNull()`. The only writer is the seed (`seeds/scopes.ts`), which maps `scopesData` → `InsertScope[]` and upserts. `scopes` has no entity home, so per the Global Constraints the schema co-locates beside the seed (YAGNI — revisit if a runtime mutation appears).

- [ ] **Step 1: Author the schema beside the seed**

Create `src/shared/db/seeds/scope-home-areas.schema.ts`:

```ts
import { z } from 'zod'

import { homeAreas } from '@/shared/domains/construction/constants/enums'

export const scopeHomeAreaSchema = z.array(z.enum(homeAreas))
```

- [ ] **Step 2: Write the failing test**

Create `src/shared/db/seeds/scope-home-areas.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { scopeHomeAreaSchema } from './scope-home-areas.schema'

describe('scopeHomeAreaSchema', () => {
  it('accepts an array of valid home areas', () => {
    expect(scopeHomeAreaSchema.parse(['bathroom', 'kitchen'])).toEqual(['bathroom', 'kitchen'])
  })

  it('rejects an unknown home area', () => {
    expect(() => scopeHomeAreaSchema.parse(['bathroom', 'rooftop-deck'])).toThrow()
  })

  it('rejects a non-array', () => {
    expect(() => scopeHomeAreaSchema.parse('bathroom')).toThrow()
  })
})
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `pnpm test src/shared/db/seeds/scope-home-areas.test.ts`
Expected: PASS (3 tests green).

- [ ] **Step 4: Parse in the seed mapper**

In `src/shared/db/seeds/scopes.ts`, add the import with the other imports:

```ts
import { scopeHomeAreaSchema } from './scope-home-areas.schema'
```

Change the inner mapper loop (~line 23-25) from:

```ts
    for (const scope of tradeScopes) {
      mappedScopes.push({ ...scope, tradeId: tradeEntry.id })
    }
```

to:

```ts
    for (const scope of tradeScopes) {
      mappedScopes.push({
        ...scope,
        homeArea: scopeHomeAreaSchema.parse(scope.homeArea),
        tradeId: tradeEntry.id,
      })
    }
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (No `pnpm db:push:dev` — no schema change; the parse guards the seed's runtime write.)

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/seeds/scope-home-areas.schema.ts src/shared/db/seeds/scope-home-areas.test.ts src/shared/db/seeds/scopes.ts
git commit -m "feat(seeds): validate scopes.homeArea against the homeAreas enum at seed write

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Author + wire `media_files.tags` schema in the seed writer (STRICT, seed-only, low urgency)

**Files:**
- Create: `src/shared/db/seeds/media-file-tags.schema.ts` (co-located beside the seed — `media_files` has no entity home)
- Create: `src/shared/db/seeds/media-file-tags.test.ts`
- Modify: `src/shared/db/seeds/data/media-files.ts` (the `db.insert(mediaFiles).values({ … tags: [] … })` at ~line 38-48)

**Interfaces:**
- Consumes: `tags` enum (`@/shared/constants/tags`).
- Produces: `mediaFileTagsSchema` (`z.array(z.enum(tags))`); parsed at the seed insert.

**Context:** `media_files.tags` is `jsonb('tags').$type<Tag[]>()`. The seed writer is `seeds/data/media-files.ts` (`seedMediaFilesInDrizzle`), which inserts each file with `tags: []`. `media_files` has no entity home → schema co-locates beside the seed.

- [ ] **Step 1: Author the schema beside the seed**

Create `src/shared/db/seeds/media-file-tags.schema.ts`:

```ts
import { z } from 'zod'

import { tags } from '@/shared/constants/tags'

export const mediaFileTagsSchema = z.array(z.enum(tags))
```

- [ ] **Step 2: Write the failing test**

Create `src/shared/db/seeds/media-file-tags.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { mediaFileTagsSchema } from './media-file-tags.schema'

describe('mediaFileTagsSchema', () => {
  it('accepts an empty array', () => {
    expect(mediaFileTagsSchema.parse([])).toEqual([])
  })

  it('accepts an array of valid tags', () => {
    expect(mediaFileTagsSchema.parse(['modern', 'luxury'])).toEqual(['modern', 'luxury'])
  })

  it('rejects an unknown tag', () => {
    expect(() => mediaFileTagsSchema.parse(['modern', 'not-a-real-tag'])).toThrow()
  })
})
```

> Verify `'modern'` and `'luxury'` are members of `tags` (`src/shared/constants/tags.ts`) before running; substitute real members if the list drifted.

- [ ] **Step 3: Run the test to verify it passes**

Run: `pnpm test src/shared/db/seeds/media-file-tags.test.ts`
Expected: PASS (3 tests green).

- [ ] **Step 4: Parse at the seed insert**

In `src/shared/db/seeds/data/media-files.ts`, add the import with the other imports:

```ts
import { mediaFileTagsSchema } from '../media-file-tags.schema'
```

Change the insert (~line 38-48) so `tags` is parsed:

```ts
      await db.insert(mediaFiles).values({
        name: file,
        pathKey: `projects/${newProject.title}/${file}`,
        bucket: 'portfolio-photos',
        mimeType: 'image/jpeg',
        fileExtension: 'jpeg',
        url: `https://one-stop-sales.r2.cloudflarestorage.com/portfolio-photos/projects/${newProject.title}/${file}`,
        tags: mediaFileTagsSchema.parse([]),
        isHeroImage: false,
        projectId: newProject.id,
      })
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/seeds/media-file-tags.schema.ts src/shared/db/seeds/media-file-tags.test.ts src/shared/db/seeds/data/media-files.ts
git commit -m "feat(seeds): validate media_files.tags against the tags enum at seed write

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Author + wire `variables.options` schema in the seed mapper (STRICT, seed-only)

**Files:**
- Create: `src/shared/db/seeds/variable-options.schema.ts` (co-located beside the seed — `variables` has no entity home)
- Create: `src/shared/db/seeds/variable-options.test.ts`
- Modify: `src/shared/db/seeds/variables.ts` (the mapper loop, ~line 16-19)

**Interfaces:**
- Consumes: nothing new.
- Produces: `variableOptionsSchema` (`z.union([z.array(z.string()), z.array(z.number())])`); parsed per variable in the seed mapper.

**Context:** `variables.options` is `jsonb('options').$type<string[] | number[]>()` (nullable). The only writer is `seeds/variables.ts`, mapping `variablesData` → `InsertVariable[]`. Some variables have no `options` (undefined), so the parse only runs when `options` is present.

- [ ] **Step 1: Author the schema beside the seed**

Create `src/shared/db/seeds/variable-options.schema.ts`:

```ts
import { z } from 'zod'

export const variableOptionsSchema = z.union([
  z.array(z.string()),
  z.array(z.number()),
])
```

- [ ] **Step 2: Write the failing test**

Create `src/shared/db/seeds/variable-options.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { variableOptionsSchema } from './variable-options.schema'

describe('variableOptionsSchema', () => {
  it('accepts an array of strings', () => {
    expect(variableOptionsSchema.parse(['a', 'b'])).toEqual(['a', 'b'])
  })

  it('accepts an array of numbers', () => {
    expect(variableOptionsSchema.parse([1, 2, 3])).toEqual([1, 2, 3])
  })

  it('rejects a mixed string/number array', () => {
    expect(() => variableOptionsSchema.parse(['a', 1])).toThrow()
  })

  it('rejects a non-array', () => {
    expect(() => variableOptionsSchema.parse('a')).toThrow()
  })
})
```

- [ ] **Step 3: Run the test to verify it passes**

Run: `pnpm test src/shared/db/seeds/variable-options.test.ts`
Expected: PASS (4 tests green).

- [ ] **Step 4: Parse in the seed mapper**

In `src/shared/db/seeds/variables.ts`, add the import with the other imports:

```ts
import { variableOptionsSchema } from './variable-options.schema'
```

Change the inner mapper loop (~line 16-18) from:

```ts
    for (const variable of tradeVariables) {
      mappedVariables.push({ ...variable })
    }
```

to:

```ts
    for (const variable of tradeVariables) {
      mappedVariables.push({
        ...variable,
        options: variable.options == null
          ? variable.options
          : variableOptionsSchema.parse(variable.options),
      })
    }
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/seeds/variable-options.schema.ts src/shared/db/seeds/variable-options.test.ts src/shared/db/seeds/variables.ts
git commit -m "feat(seeds): validate variables.options (string[] | number[]) at seed write

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Drop the dead `x_project_scopes.variablesData` column (DROP)

**Files:**
- Modify: `src/shared/db/schema/x-project-scopes.ts` (remove the `variablesData` column, ~line 18)

**Interfaces:**
- Consumes: nothing.
- Produces: a `x_project_scopes` table without `variables_data`.

**Context:** `variablesData: jsonb('variables_data').$type<Record<string, any>>()` has **zero writers** (confirmed: the only `variablesData` symbols elsewhere are the unrelated seed-data object for the `variables` table). It is a dead column. Dropping it is the only schema change in WS-4 → `pnpm db:push:dev` only.

- [ ] **Step 1: Re-confirm zero writers immediately before dropping**

Run:
```bash
grep -rn "variablesData\|variables_data" src/ scripts/ --include="*.ts" --include="*.tsx" | grep -v "seeds/variables\|seeds/data/variables\|db/types/variables\|x-project-scopes.ts"
```
Expected: **no output** (the only remaining hits are the dead column definition itself and the unrelated `variables`-table seed object, which the grep excludes). If any real reader/writer appears, STOP — the column is not dead; reassess.

- [ ] **Step 2: Remove the column from the schema**

In `src/shared/db/schema/x-project-scopes.ts`, delete line ~18:

```ts
  variablesData: jsonb('variables_data').$type<Record<string, any>>(),
```

If `jsonb` becomes an unused import after the deletion, remove it from the `drizzle-orm/pg-core` import list on line 4 (`import { integer, jsonb, pgTable, text, unique, uuid } from 'drizzle-orm/pg-core'` → drop `jsonb`).

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. (`selectXProjectScopeSchema` / `insertXProjectScopeSchema` are generated from the table, so they update automatically.)

- [ ] **Step 4: Push the schema change to the DEV DB only**

Run: `pnpm db:push:dev`
Expected: Drizzle reports dropping the `variables_data` column on the dev branch. Confirm the diff is ONLY that column drop before accepting. **NEVER `pnpm db:push`.**

- [ ] **Step 5: Commit**

```bash
git add src/shared/db/schema/x-project-scopes.ts
git commit -m "chore(schema): drop dead x_project_scopes.variables_data column (zero writers)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Document the two LOOSE-OK columns (no strict Zod)

**Files:**
- Modify: `src/shared/db/schema/media-files.ts` (comment above `optimizationVariants`, ~line 25)
- Modify: `src/shared/db/schema/bina-webhook-logs.ts` (comment above `payload` / `matchedTrades`, ~line 13-14)

**Interfaces:** none (documentation).

**Context:** Two columns are deliberately left loose. Record *why* inline so a future session doesn't "fix" them into strict Zod:
- `media_files.optimizationVariants` — machine-generated by our own optimize job; internally produced, trusted.
- `bina_webhook_logs.payload` / `matchedTrades` — raw external audit log; strict Zod would defeat forensics/replay of malformed inbound payloads.

- [ ] **Step 1: Annotate `optimizationVariants`**

In `src/shared/db/schema/media-files.ts`, add a comment directly above line ~25 (`optimizationVariants: jsonb('optimization_variants')…`):

```ts
  // LOOSE-OK: machine-generated by our own optimize job (internally produced,
  // trusted). No write-boundary Zod by design.
  // see docs/codebase-conventions/jsonb-columns.md#zod-parse-at-write-boundary
  optimizationVariants: jsonb('optimization_variants').$type<string[]>(),
```

- [ ] **Step 2: Annotate `payload` / `matchedTrades`**

In `src/shared/db/schema/bina-webhook-logs.ts`, add a comment directly above line ~13 (`payload: jsonb('payload').notNull()`):

```ts
  // LOOSE-OK: raw external audit log. Strict Zod at the write boundary would
  // reject malformed inbound payloads and defeat forensics/replay — the whole
  // point of the log is to capture exactly what GHL sent, valid or not.
  // see docs/codebase-conventions/jsonb-columns.md#zod-parse-at-write-boundary
  payload: jsonb('payload').notNull(),
  matchedTrades: jsonb('matched_trades'),
```

- [ ] **Step 3: Lint (no type change)**

Run: `pnpm lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/shared/db/schema/media-files.ts src/shared/db/schema/bina-webhook-logs.ts
git commit -m "docs(schema): document LOOSE-OK JSONB columns (optimizationVariants, bina logs)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Self-Review

**Spec coverage (§6 WS-4 table):**
- STRICT `projects.beforeAfterPairsJSON` (schema exists, unwired) → Task 2. Corrected write boundary from `manage-project.ts` (spec) to `scripts/match-before-after.ts` (the actual + only writer). ✓ ⚠️ flagged.
- STRICT `projects.hoRequirements` (author `z.array(z.string())`, parse in `manage-project.ts`) + drop manual `updatedAt` at :35 → Task 3. ✓
- STRICT `activities.metaJSON` (union exists, unwired; wire `activityMetaSchemas[type].parse()` at router + `google-calendar.ts:68`) → Task 4. ✓
- STRICT seed-only `scopes.homeArea` (`z.array(z.enum(homeAreas))`) → Task 5. ✓
- STRICT seed-only `media_files.tags` (`z.array(z.enum(tags))`) → Task 6. ✓
- STRICT seed-only `variables.options` (`z.union([z.array(z.string()), z.array(z.number())])`) → Task 7. ✓
- LOOSE-OK `media_files.optimizationVariants` + `bina_webhook_logs.payload`/`matchedTrades` → Task 9 (documented, no strict Zod). ✓
- DROP `x_project_scopes.variablesData` (zero writers) → Task 8 (re-confirmed, dropped, `db:push:dev`). ✓
- CLEANUP `manage-project.ts:35` manual `updatedAt` → folded into Task 3. ✓

**TDD coverage:** Every AUTHORED schema has a `<schema>.test.ts` written to pass (accepts valid / rejects bad) before wiring — Tasks 3, 5, 6, 7. The two ALREADY-EXISTING schemas (`beforeAfterPairsSchema` Task 2, `activityMetaSchemas` via `parseActivityMeta` Task 4) get a regression test asserting the same accept/reject contract before their parse is wired. ✓

**Placeholder scan:** No TBD / "add validation" / "write tests for the above". Every code step shows complete code. Line numbers are marked `~` where a preceding edit may shift them; each such edit shows the exact before/after text to anchor on. ✓

**Constraint consistency:** Named exports only (helpers `parseHoRequirements`, `parseActivityMeta` and all schemas are named/`export const`/`export function`; pre-existing seed `export default` files left untouched). Seed-table schemas (`scopes`, `variables`, `media_files`) co-locate beside the seed, not in an entity home (YAGNI). Only Task 8 touches schema → the only `pnpm db:push:dev`. No `pnpm build`, no `pnpm db:push`, no `git add -A`. ✓

**Staleness flagged:** (1) `beforeAfterPairsJSON` boundary is the script, not `manage-project.ts`; (2) `activityMetaSchemas` authored-but-unwired; (3) `x_project_scopes.variablesData` dead; (4) `manage-project.ts:35` manual `updatedAt`. All four surfaced in the header + addressed in tasks. ✓

**Out of scope (correctly deferred):** WS-1 governance docs (the `jsonb-columns.md` anchors are cross-linked, not authored here), WS-2 deep-merge (only its Vitest runner is reused — Task 1), WS-3 generated columns, WS-5 `lead_meta`. No entity home created for `scopes`/`variables`/`media_files` (no runtime mutation justifies it yet — YAGNI). ✓
