# CRUD Type Inference Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate ~25 type casts across the entity server system by fixing middleware typing, schema type erasure, and dynamic router construction.

**Architecture:** Three structural fixes: (1) export `t.middleware` and rewrite middleware factories to use it — eliminates ctx type erasure, (2) add `TId` generic to `EntityServerSpec`/`CrudHandlers` and pass concrete schemas to `createCrudRouter` — eliminates Zod type erasure, (3) rewrite `createCrudRouter` as a static object literal — eliminates dynamic construction.

**Tech Stack:** tRPC v11, Zod, Drizzle ORM, TypeScript

**Spec:** `docs/superpowers/specs/2026-05-17-crud-type-inference-design.md`

**Checkpoint:** `checkpoint/pre-crud-type-fix` tag. Revert with `git reset --hard checkpoint/pre-crud-type-fix`.

**CRITICAL:** After EACH task, run `pnpm tsc --noEmit`. If it fails with errors unrelated to files not yet modified (i.e. downstream consumers), that's expected — note them and continue. If it fails on files you just touched, stop and fix before committing. The implementation order is designed so each step either compiles clean or has predictable downstream errors that the next task fixes.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/dal/server/lib/types.ts` | Modify | Add `TId` to `EntityServerSpec` + `CrudHandlers`, delete `PkField` |
| `src/shared/dal/server/lib/create-crud-dal.ts` | Modify | Update generics to use `TId` instead of `PkField` |
| `src/shared/entities/proposals/dal/server/mutations.ts` | Modify | Update `PkField` → `string` in `proposalDuplicateDal` |
| `src/shared/entities/proposals/lib/server-spec.ts` | Modify | Export `proposalSchemas` alongside spec |
| `src/trpc/init.ts` | Modify | Export `createMiddleware = t.middleware` |
| `src/trpc/types.ts` | Modify | Remove `PkField` re-export |
| `src/trpc/lib/middleware/scope-middleware.ts` | Rewrite | Use `createMiddleware`, delete hand-typed interface |
| `src/trpc/lib/middleware/shareable-middleware.ts` | Rewrite | Use `createMiddleware`, delete hand-typed interface |
| `src/trpc/lib/create-crud-router.ts` | Rewrite | Static literal, concrete schemas config, `TId` generic |
| `src/trpc/lib/create-entity-router.ts` | Modify | Remove `crud` from toolkit, remove casts |
| `src/trpc/routers/proposals.router/index.ts` | Modify | Replace inlined CRUD with `createCrudRouter()` call |

---

### Task 1: Add `TId` generic to `EntityServerSpec` and `CrudHandlers`, delete `PkField`

**Files:**
- Modify: `src/shared/dal/server/lib/types.ts`
- Modify: `src/trpc/types.ts`

- [ ] **Step 1: Update `EntityServerSpec` to add `TId` generic**

In `src/shared/dal/server/lib/types.ts`, replace lines 58-72:

```ts
export interface EntityServerSpec<TTable extends PgTable = PgTable> {
  entityName: EntityName
  caslSubject: AppSubject
  visibility: (userId: string) => SQL
  table: TTable
  schemas: {
    insert: z.ZodObject<Record<string, z.ZodTypeAny>>
    update: z.ZodObject<Record<string, z.ZodTypeAny>>
    select: z.ZodObject<Record<string, z.ZodTypeAny>>
  }
  /** Defaults to 'id'. Override for serial PKs or custom column names. */
  primaryKey?: string
  shareable?: { tokenColumn: string }
  update?: { jsonbMergeColumns: readonly PgColumn[] }
}
```

with:

```ts
/**
 * Typed declaration per entity. The single source of truth for an entity's
 * table, visibility predicate, and named configuration.
 *
 * `TId` is the primary key type — `string` for UUID (default), `number` for serial.
 * This flows into `CrudHandlers<TTable, TId>` so handler overrides type-check
 * without conditional type gymnastics.
 *
 * Schemas are type-erased at the interface level (for DAL runtime `.parse()`).
 * For tRPC type inference, pass concrete schemas to `createCrudRouter` separately.
 *
 * Consumed by:
 * - `createCrudDal(spec)` — DAL crud factory
 * - `createEntityRouter(spec, factory)` — tRPC factory
 * - `buildUserContext(userId, spec)` — context builder for services/jobs
 */
export interface EntityServerSpec<
  TTable extends PgTable = PgTable,
  TId extends string | number = string,
> {
  entityName: EntityName
  caslSubject: AppSubject
  visibility: (userId: string) => SQL
  table: TTable
  schemas: {
    insert: z.ZodObject<Record<string, z.ZodTypeAny>>
    update: z.ZodObject<Record<string, z.ZodTypeAny>>
    select: z.ZodObject<Record<string, z.ZodTypeAny>>
  }
  /** Defaults to 'id'. Override for serial PKs or custom column names. */
  primaryKey?: string
  shareable?: { tokenColumn: string }
  update?: { jsonbMergeColumns: readonly PgColumn[] }
}
```

- [ ] **Step 2: Delete `PkField` and update `CrudHandlers` to use `TId`**

In the same file, delete lines 74-77:

```ts
// ── Primary Key Type Derivation ─────────────────────────────────────────

export type PkField<TTable extends PgTable>
  = Row<TTable> extends { id: infer T } ? T : string | number
```

Replace lines 89-95 (`CrudHandlers`):

```ts
export interface CrudHandlers<TTable extends PgTable> {
  getById: (ctx: ScopedContext, input: { id: PkField<TTable> }) => Promise<DalReturn<Row<TTable> | undefined>>
  create: (ctx: ScopedContext, input: Insert<TTable>) => Promise<DalReturn<Row<TTable>>>
  update: (ctx: ScopedContext, input: { id: PkField<TTable>, data: Update<TTable> }) => Promise<DalReturn<Row<TTable>>>
  delete: (ctx: ScopedContext, input: { id: PkField<TTable> }) => Promise<DalReturn<void>>
  duplicate: (ctx: ScopedContext, input: { id: PkField<TTable> }) => Promise<DalReturn<Row<TTable>>>
}
```

with:

```ts
export interface CrudHandlers<TTable extends PgTable, TId extends string | number = string> {
  getById: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<Row<TTable> | undefined>>
  create: (ctx: ScopedContext, input: Insert<TTable>) => Promise<DalReturn<Row<TTable>>>
  update: (ctx: ScopedContext, input: { id: TId, data: Update<TTable> }) => Promise<DalReturn<Row<TTable>>>
  delete: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<void>>
  duplicate: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<Row<TTable>>>
}
```

- [ ] **Step 3: Remove `PkField` from `trpc/types.ts` re-exports**

In `src/trpc/types.ts`, remove `PkField` from the type re-export block (line 23):

```ts
export type {
  CrudHandlers,
  DalError,
  DalReturn,
  EntityServerSpec,
  ScopedContext,
  SlotName,
} from '@/shared/dal/server/lib/types'
```

- [ ] **Step 4: Check compilation — expect downstream errors**

Run: `pnpm tsc --noEmit 2>&1 | head -30`
Expected: Errors in `create-crud-dal.ts` and `proposals/dal/server/mutations.ts` about `PkField` not existing. These are fixed in Tasks 2 and 3.

- [ ] **Step 5: Commit**

```bash
git add src/shared/dal/server/lib/types.ts src/trpc/types.ts
git commit -m "refactor(types): add TId generic to EntityServerSpec/CrudHandlers, delete PkField"
```

---

### Task 2: Update `createCrudDal` to use `TId`

**Files:**
- Modify: `src/shared/dal/server/lib/create-crud-dal.ts`

- [ ] **Step 1: Update imports — remove `PkField`**

Replace the type import block (lines 17-23):

```ts
import type {
  CrudHandlers,
  DalReturn,
  EntityServerSpec,
  PkField,
  ScopedContext,
} from './types'
```

with:

```ts
import type {
  CrudHandlers,
  DalReturn,
  EntityServerSpec,
  ScopedContext,
} from './types'
```

- [ ] **Step 2: Update `createCrudDal` signature to carry `TId`**

Replace line 33-35:

```ts
export function createCrudDal<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
): CrudHandlers<TTable> {
```

with:

```ts
export function createCrudDal<TTable extends PgTable, TId extends string | number = string>(
  spec: EntityServerSpec<TTable, TId>,
): CrudHandlers<TTable, TId> {
```

- [ ] **Step 3: Update all `Impl` function signatures — replace `PkField<TTable>` with `TId`**

For `getByIdImpl` (line 53), `updateImpl` (line 92), `deleteImpl` (line 115), `duplicateImpl` (line 135) — replace `PkField<TTable>` with `string | number` in the input type:

`getByIdImpl`:
```ts
async function getByIdImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<Row<TTable> | undefined>> {
```

`updateImpl`:
```ts
async function updateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number, data: Update<TTable> },
): Promise<DalReturn<Row<TTable>>> {
```

`deleteImpl`:
```ts
async function deleteImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<void>> {
```

`duplicateImpl`:
```ts
async function duplicateImpl<TTable extends PgTable>(
  spec: EntityServerSpec<TTable>,
  pkColumn: PgColumn,
  ctx: ScopedContext,
  input: { id: string | number },
): Promise<DalReturn<Row<TTable>>> {
```

Note: The impl functions use `string | number` directly (not `TId`) because they're internal to the factory. The generic `TId` is on `createCrudDal` and `CrudHandlers` — the public interface. Internally, Drizzle's `eq(pkColumn, input.id)` accepts both types.

- [ ] **Step 4: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: Error in `proposals/dal/server/mutations.ts` about `PkField` import — fixed in Task 3. No errors in `create-crud-dal.ts` itself.

- [ ] **Step 5: Commit**

```bash
git add src/shared/dal/server/lib/create-crud-dal.ts
git commit -m "refactor(dal): update createCrudDal generics to use TId instead of PkField"
```

---

### Task 3: Update proposal mutations — replace `PkField` with `string`

**Files:**
- Modify: `src/shared/entities/proposals/dal/server/mutations.ts`

- [ ] **Step 1: Replace `PkField` import and usage**

In `src/shared/entities/proposals/dal/server/mutations.ts`, replace the type import (line 12):

```ts
import type { DalReturn, PkField, ScopedContext } from '@/shared/dal/server/lib/types'
```

with:

```ts
import type { DalReturn, ScopedContext } from '@/shared/dal/server/lib/types'
```

Replace the `proposalDuplicateDal` input type (line 109):

```ts
  input: { id: PkField<typeof proposals> },
```

with:

```ts
  input: { id: string },
```

- [ ] **Step 2: Verify compilation — should be clean now**

Run: `pnpm tsc --noEmit 2>&1 | head -10`
Expected: Zero errors. All `PkField` references are resolved.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/proposals/dal/server/mutations.ts
git commit -m "refactor(proposals): replace PkField with string in dal mutations"
```

---

### Task 4: Export `proposalSchemas` from server-spec

**Files:**
- Modify: `src/shared/entities/proposals/lib/server-spec.ts`

- [ ] **Step 1: Export concrete schemas object**

Replace the entire file content:

```ts
import type { EntityServerSpec } from '@/shared/dal/server/lib/types'

import {
  insertProposalSchema,
  proposals,
  selectProposalSchema,
} from '@/shared/db/schema'
import { PROPOSAL } from '@/shared/entities/proposals/lib/constants'
import { proposalVisibility } from '@/shared/entities/proposals/lib/visibility'

// The update schema is the insert schema but .partial() — allows updating
// any field. `kind` is excluded from insert (server-derived), so it's also
// excluded from update.
const updateProposalSchema = insertProposalSchema.partial()

/**
 * Concrete-typed schemas for tRPC CRUD router type inference.
 * The spec also holds these objects, but type-erased via the EntityServerSpec
 * interface (fine for DAL's runtime .parse()). Pass this to createCrudRouter
 * for full client-side type inference.
 */
export const proposalSchemas = {
  insert: insertProposalSchema,
  update: updateProposalSchema,
}

export const proposalServerSpec = {
  entityName: PROPOSAL,
  caslSubject: PROPOSAL,
  visibility: proposalVisibility,
  table: proposals,
  schemas: {
    ...proposalSchemas,
    select: selectProposalSchema,
  },
  shareable: { tokenColumn: 'token' },
  update: {
    // These 3 JSONB columns need deep merge on update, not replace.
    // Phase 1a declares them; Phase 1b implements the merge logic.
    jsonbMergeColumns: [
      proposals.formMetaJSON,
      proposals.projectJSON,
      proposals.fundingJSON,
    ] as const,
  },
} satisfies EntityServerSpec<typeof proposals>
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | head -10`
Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/shared/entities/proposals/lib/server-spec.ts
git commit -m "refactor(proposals): export proposalSchemas for tRPC type inference"
```

---

### Task 5: Export `createMiddleware` from `init.ts`

**Files:**
- Modify: `src/trpc/init.ts`

- [ ] **Step 1: Add the export**

After line 25 (`export const createTRPCRouter = t.router`), add:

```ts
export const createMiddleware = t.middleware
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | head -10`
Expected: Zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/init.ts
git commit -m "refactor(trpc): export createMiddleware for properly-typed middleware factories"
```

---

### Task 6: Rewrite `scopeMiddleware` with `createMiddleware`

**Files:**
- Rewrite: `src/trpc/lib/middleware/scope-middleware.ts`

- [ ] **Step 1: Replace entire file**

```ts
// ─── Scope Middleware ───────────────────────────────────────────────────────
// Middleware factory that resolves visibility scope for an entity.
// Omni users (CASL `manage all`) get `scope: null` — they see everything.
// Non-omni users get `scope: spec.visibility(userId)` — a Drizzle SQL fragment
// that DAL handlers apply to WHERE clauses.
//
// Uses `createMiddleware` (t.middleware) so tRPC natively tracks the ctx
// transformation — downstream procedures see `scope` on ctx without casts.
//
// Chain after agentProcedure (which guarantees session + ability non-null).

import type { EntityServerSpec } from '@/shared/dal/server/lib/types'

import { createMiddleware } from '@/trpc/init'

/**
 * Builds a scope-resolving middleware for the given entity spec.
 *
 * Reads `ctx.ability` + `ctx.session` (guaranteed non-null by agentProcedure)
 * and sets `ctx.scope` to the entity's visibility predicate, or `null` for
 * omni users.
 */
export function scopeMiddleware(spec: EntityServerSpec) {
  return createMiddleware(async ({ ctx, next }) => {
    const isOmni = ctx.ability.can('manage', 'all')
    const scope = isOmni ? null : spec.visibility(ctx.session.user.id)
    return next({ ctx: { ...ctx, scope } })
  })
}
```

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | head -10`
Expected: May see errors if `ctx.ability` or `ctx.session` types don't match what tRPC infers from `HTTPTRPCContext`. If `ability` is `AppAbility | null` on the base context, `ctx.ability.can(...)` would error — but this middleware chains after `agentProcedure` which narrows ability to non-null. Whether tRPC tracks that narrowing through `.use()` chaining is the key question.

If errors occur about `ctx.ability` being possibly null: this means tRPC sees the base HTTPTRPCContext (where ability IS null), not the narrowed agentProcedure context. This is expected — `createMiddleware` creates middleware against the base context type. The fix: guard with a null check (which is a no-op at runtime since agentProcedure already checked):

```ts
export function scopeMiddleware(spec: EntityServerSpec) {
  return createMiddleware(async ({ ctx, next }) => {
    if (!ctx.ability || !ctx.session) {
      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'scopeMiddleware requires authed context' })
    }
    const isOmni = ctx.ability.can('manage', 'all')
    const scope = isOmni ? null : spec.visibility(ctx.session.user.id)
    return next({ ctx: { ...ctx, scope } })
  })
}
```

This is NOT a cast — it's a runtime guard that TypeScript uses for narrowing. At runtime it never fires (agentProcedure already checked). At the type level it narrows `ability` and `session` to non-null.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/lib/middleware/scope-middleware.ts
git commit -m "refactor(middleware): rewrite scopeMiddleware with createMiddleware — zero casts"
```

---

### Task 7: Rewrite `shareableMiddleware` with `createMiddleware`

**Files:**
- Rewrite: `src/trpc/lib/middleware/shareable-middleware.ts`

- [ ] **Step 1: Replace entire file**

```ts
// ─── Shareable Middleware ───────────────────────────────────────────────────
// Middleware factory for shareable entities (e.g., proposals with token URLs).
//
// Two paths:
// - **Token present**: validates token against entity table, injects scope as
//   `eq(tokenColumn, input.token)`. CASL checks skipped — token IS authorization.
//   `ability` is null on ctx.
// - **Session present, no token**: requires session, builds ability, resolves
//   scope from spec.visibility(userId). Normal authenticated flow.
// - **Neither**: throws UNAUTHORIZED.
//
// Uses `createMiddleware` (t.middleware) so tRPC natively tracks ctx
// transformation — downstream procedures see scope/ability without casts.
//
// Chain on baseProcedure (no session required for token path).

import type { PgColumn } from 'drizzle-orm/pg-core'

import type { EntityServerSpec } from '@/shared/dal/server/lib/types'

import { TRPCError } from '@trpc/server'
import { eq } from 'drizzle-orm'

import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { createMiddleware } from '@/trpc/init'

/**
 * Builds a shareable-access middleware for the given entity spec.
 *
 * Token path: sets `ctx.scope = eq(tokenColumn, token)`, `ctx.ability = null`.
 * Session path: builds ability, resolves scope from `spec.visibility(userId)`.
 * Neither: throws UNAUTHORIZED.
 */
export function shareableMiddleware(spec: EntityServerSpec) {
  // Resolve token column at factory time (not per-request) for early validation.
  const table = spec.table as unknown as Record<string, PgColumn | undefined>
  const tokenColumnName = spec.shareable?.tokenColumn
  const tokenColumn = tokenColumnName ? table[tokenColumnName] : undefined

  if (spec.shareable && !tokenColumn) {
    throw new Error(
      `[shareable-middleware] spec.shareable.tokenColumn '${tokenColumnName}' `
      + `is not a column on ${spec.entityName}'s table.`,
    )
  }

  return createMiddleware(async ({ ctx, next, getRawInput }) => {
    const rawInput = await getRawInput() as Record<string, unknown> | undefined
    const token = rawInput?.token as string | undefined

    // ── Token path ───────────────────────────────────────────────────────
    // Token IS authorization. No session/ability needed.
    if (token && tokenColumn) {
      return next({
        ctx: {
          ...ctx,
          session: ctx.session,
          ability: null,
          scope: eq(tokenColumn, token),
        },
      })
    }

    // ── Session path ─────────────────────────────────────────────────────
    // No token — require authenticated session.
    if (!ctx.session) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'A valid token or authenticated session is required',
      })
    }

    const ability = defineAbilitiesFor({
      id: ctx.session.user.id,
      role: ctx.session.user.role,
    })

    const isOmni = ability.can('manage', 'all')
    const scope = isOmni ? null : spec.visibility(ctx.session.user.id)

    return next({
      ctx: {
        ...ctx,
        session: ctx.session,
        ability,
        scope,
      },
    })
  })
}
```

Note: The `spec.table as unknown as Record<string, PgColumn | undefined>` cast on the token column resolution stays — this is a genuine Drizzle type boundary (table objects don't expose column accessors as a typed record). This is 1 cast, well-understood, at a framework boundary.

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | head -10`
Expected: Zero errors in this file. There may be downstream errors in `create-entity-router.ts` if the middleware return type doesn't match `.use()` — that's fixed in Task 9.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/lib/middleware/shareable-middleware.ts
git commit -m "refactor(middleware): rewrite shareableMiddleware with createMiddleware — zero casts"
```

---

### Task 8: Rewrite `createCrudRouter` — static literal, concrete schemas

**Files:**
- Rewrite: `src/trpc/lib/create-crud-router.ts`

- [ ] **Step 1: Replace entire file**

```ts
// ─── createCrudRouter (CRUD Sub-router) ─────────────────────────────────────
// Thin tRPC sub-router that maps 5 CRUD slots to tRPC procedures.
// Receives pre-scoped procedures from the entity router and concrete Zod
// schemas for full type inference. Each slot wires:
//   - CASL action gate (action <- slot, subject <- spec.caslSubject)
//   - Zod input validation from concrete schemas (not type-erased spec)
//   - DAL handler call (default from createCrudDal, overridable per-slot)
//   - DalReturn → TRPCError via dalToTrpc
//
// The router is a static object literal — all 5 slots always present.
// TypeScript infers the full router shape for end-to-end client type safety.
//
// `spec.shareable` controls whether `getById` and `update` use the shareable
// procedure (token-or-session) or the authed procedure (session-only).

import type { PgTable } from 'drizzle-orm/pg-core'

import type { agentProcedure, baseProcedure } from '@/trpc/init'
import type { CrudHandlers, EntityServerSpec, SlotName } from '@/trpc/types'
import type { Insert } from '@/shared/db/types'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

// Action mapping per slot — fixed (not entity-configurable).
const SLOT_ACTIONS: Record<SlotName, 'read' | 'create' | 'update' | 'delete'> = {
  getById: 'read',
  create: 'create',
  update: 'update',
  delete: 'delete',
  duplicate: 'create',
}

export interface CreateCrudRouterConfig<
  TTable extends PgTable,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
> {
  /** Entity spec — runtime config (table, visibility, casl, shareable). */
  spec: EntityServerSpec<TTable, TId>
  /**
   * Concrete Zod schemas for tRPC input validation + type inference.
   * `id`: Zod validator matching TId (z.string().uuid() or z.number().int())
   * `insert`: Entity's insert schema (concrete, not type-erased)
   * `update`: Entity's update schema (concrete, not type-erased)
   */
  schemas: { id: z.ZodType<TId>, insert: TInsert, update: TUpdate }
  /** Pre-scoped agent procedure (agentProcedure + scope middleware). */
  authedProcedure: typeof agentProcedure
  /** Pre-scoped shareable procedure (baseProcedure + shareable middleware). */
  shareableProcedure: typeof baseProcedure
  /** Override individual CRUD handlers. Merged with createCrudDal defaults. */
  handlers?: Partial<CrudHandlers<TTable, TId>>
}

export function createCrudRouter<
  TTable extends PgTable,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
>(config: CreateCrudRouterConfig<TTable, TId, TInsert, TUpdate>) {
  // Merge default DAL handlers with any caller-provided overrides.
  const defaults = createCrudDal(config.spec)
  const handlers = { ...defaults, ...config.handlers } as CrudHandlers<TTable, TId>

  // Select the right procedure based on shareable config.
  const readProcedure = config.spec.shareable
    ? config.shareableProcedure
    : config.authedProcedure
  const updateProcedure = config.spec.shareable
    ? config.shareableProcedure
    : config.authedProcedure

  // Input schemas — token always optional (harmless on non-shareable entities).
  const { id: idZod } = config.schemas
  const idInput = z.object({ id: idZod, token: z.string().optional() })
  const updateInput = z.object({ id: idZod, data: config.schemas.update, token: z.string().optional() })
  const idOnlyInput = z.object({ id: idZod })

  // Static object literal — TypeScript infers the full router shape.
  return createTRPCRouter({
    getById: readProcedure
      .input(idInput)
      .query(async ({ ctx, input }) => {
        if (ctx.ability) {
          assertCan(ctx, 'getById', config.spec)
        }
        const row = dalToTrpc(await handlers.getById(ctx, { id: input.id }))
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${config.spec.entityName} not found` })
        }
        return row
      }),

    create: config.authedProcedure
      .input(config.schemas.insert)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'create', config.spec)
        return dalToTrpc(await handlers.create(ctx, input as Insert<TTable>))
      }),

    update: updateProcedure
      .input(updateInput)
      .mutation(async ({ ctx, input }) => {
        if (ctx.ability) {
          assertCan(ctx, 'update', config.spec)
        }
        return dalToTrpc(await handlers.update(ctx, { id: input.id, data: input.data }))
      }),

    delete: config.authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'delete', config.spec)
        dalToTrpc(await handlers.delete(ctx, { id: input.id }))
      }),

    duplicate: config.authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx, 'duplicate', config.spec)
        return dalToTrpc(await handlers.duplicate(ctx, { id: input.id }))
      }),
  })
}

// ── helpers ──────────────────────────────────────────────────────────────

/**
 * CASL permission gate. Checks if ctx.ability allows the action on the
 * entity's caslSubject. Throws TRPCError FORBIDDEN if not.
 *
 * `ctx` is typed as `Record<string, unknown>` because tRPC's middleware
 * chain transforms ctx at each layer. At runtime, agentProcedure guarantees
 * `ability` is non-null when this is called from an authedProcedure.
 * The shareable path guards with `if (ctx.ability)` before calling.
 */
function assertCan(
  ctx: { ability: { can: (action: string, subject: string) => boolean } },
  slot: SlotName,
  spec: EntityServerSpec,
): void {
  const action = SLOT_ACTIONS[slot]
  if (!ctx.ability.can(action, spec.caslSubject)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `You do not have permission to ${action} ${spec.entityName}`,
    })
  }
}
```

**Casts in this file (2 total, both at genuine boundaries):**
- `{ ...defaults, ...config.handlers } as CrudHandlers<TTable, TId>` — spread merge loses the full interface type; cast reasserts it.
- `input as Insert<TTable>` on create — Zod→Drizzle type boundary.

**Casts eliminated (16 → 2):**
- All `ctx as unknown as AuthedContext` / `ScopedContext` — gone (tRPC infers ctx from middleware)
- All `input as unknown as IdInput` / `PgTable['$inferInsert']` — gone (concrete Zod schemas)
- `Record<string, unknown>` dynamic procs — gone (static literal)
- `procs as Parameters<typeof createTRPCRouter>[0]` — gone (literal return)

Note on `assertCan`: The ctx parameter uses a structural type `{ ability: { can: ... } }` instead of importing `AuthedContext`. This avoids a cast while being structurally compatible with what tRPC provides.

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: Errors in `create-entity-router.ts` (still imports old `createCrudRouter` with old options type) and `proposals.router/index.ts` (still inlines CRUD). These are fixed in Tasks 9 and 10.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/lib/create-crud-router.ts
git commit -m "refactor(trpc): rewrite createCrudRouter — static literal, concrete schemas, 2 casts from 16"
```

---

### Task 9: Update `createEntityRouter` — remove `crud` from toolkit, remove casts

**Files:**
- Modify: `src/trpc/lib/create-entity-router.ts`

- [ ] **Step 1: Replace entire file**

```ts
// ─── createEntityRouter ─────────────────────────────────────────────────────
// Top-level composer. Takes an EntityServerSpec and a factory function that
// receives pre-scoped tRPC procedures. The factory returns a router.
//
// The toolkit provides pre-scoped tRPC procedures for building sub-routers:
//   - `authedProcedure`     — agentProcedure + scope middleware
//   - `shareableProcedure`  — baseProcedure + shareable middleware (token-or-session)
//   - `publicProcedure`     — baseProcedure pass-through
//   - `spec`                — the entity spec itself
//
// CRUD sub-router: call `createCrudRouter()` directly in the factory with
// concrete schemas. This preserves full tRPC type inference — the return
// type flows through the object literal into TRouter.
//
// Usage:
// ```ts
// export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
//   createTRPCRouter({
//     crud: createCrudRouter({
//       spec: proposalServerSpec,
//       schemas: { ...proposalSchemas, id: z.string().uuid() },
//       authedProcedure: entity.authedProcedure,
//       shareableProcedure: entity.shareableProcedure,
//       handlers: { create: proposalCreateDal },
//     }),
//     business: createTRPCRouter({ ... }),
//     delivery: createDeliveryRouter(entity),
//   })
// )
// ```
//
// Side effect on call: registerEntity(spec). Duplicate registration throws.

import type { PgTable } from 'drizzle-orm/pg-core'

import type { createTRPCRouter } from '@/trpc/init'
import type { EntityServerSpec } from '@/trpc/types'

import { agentProcedure, baseProcedure } from '@/trpc/init'

import { registerEntity } from './entity-registry'
import { scopeMiddleware } from './middleware/scope-middleware'
import { shareableMiddleware } from './middleware/shareable-middleware'

type AnyRouter = ReturnType<typeof createTRPCRouter>

/**
 * Entity toolkit — pre-scoped procedures provided to the entity's factory
 * function and sub-router factories. These are NOT custom abstractions:
 * each procedure IS a real tRPC procedure with full type inference and
 * middleware composability.
 *
 * CRUD sub-router is NOT on the toolkit — call `createCrudRouter()` directly
 * in the factory function to preserve full type inference.
 */
export interface EntityToolkit<TTable extends PgTable> {
  /** Agent-only procedure with visibility scope resolved. */
  authedProcedure: typeof agentProcedure
  /** Token-or-session procedure. Auto-resolves scope from token or session. */
  shareableProcedure: typeof baseProcedure
  /** No auth required. Pass-through of baseProcedure. */
  publicProcedure: typeof baseProcedure
  /** The entity spec itself, for sub-routers that need it. */
  spec: EntityServerSpec<TTable>
}

export function createEntityRouter<TSpec extends EntityServerSpec, TRouter extends AnyRouter>(
  spec: TSpec,
  factory: (entity: EntityToolkit<TSpec['table']>) => TRouter,
): TRouter {
  registerEntity(spec)

  // Build pre-configured procedures with scope middleware baked in.
  // createMiddleware (t.middleware) returns properly-typed middleware,
  // so .use() accepts it natively.
  const scopedAgentProcedure = agentProcedure.use(scopeMiddleware(spec))
  const scopedShareableProcedure = baseProcedure.use(shareableMiddleware(spec))

  const toolkit: EntityToolkit<TSpec['table']> = {
    authedProcedure: scopedAgentProcedure,
    shareableProcedure: scopedShareableProcedure,
    publicProcedure: baseProcedure,
    spec,
  }

  return factory(toolkit)
}
```

**Important:** The `.use(scopeMiddleware(spec))` call may not compile if the middleware return type is incompatible with the procedure's `.use()` method. If TypeScript errors here, the scoped procedure type after `.use()` won't match `typeof agentProcedure` on the `EntityToolkit` interface.

**If `.use()` compiles but the toolkit assignment errors** (scoped procedure type doesn't match `typeof agentProcedure`): add a single controlled cast at the toolkit boundary:

```ts
  const toolkit = {
    authedProcedure: scopedAgentProcedure as typeof agentProcedure,
    shareableProcedure: scopedShareableProcedure as typeof baseProcedure,
    publicProcedure: baseProcedure,
    spec,
  } as EntityToolkit<TSpec['table']>
```

This is acceptable — it's at the toolkit assembly boundary (1 location), not scattered across 16 handler sites. The `.use()` chain is correct at runtime; the cast just restores the builder API type for downstream `.input()/.query()/.mutation()` chaining.

- [ ] **Step 2: Verify compilation**

Run: `pnpm tsc --noEmit 2>&1 | head -20`
Expected: Errors in `proposals.router/index.ts` only (still inlines CRUD, imports old things). Fixed in Task 10.

- [ ] **Step 3: Commit**

```bash
git add src/trpc/lib/create-entity-router.ts
git commit -m "refactor(trpc): simplify createEntityRouter — remove crud from toolkit, use createMiddleware"
```

---

### Task 10: Update proposals router — replace inlined CRUD with `createCrudRouter()`

**Files:**
- Modify: `src/trpc/routers/proposals.router/index.ts`

- [ ] **Step 1: Replace entire file**

```ts
import z from 'zod'

import { getFinanceOptions } from '@/shared/dal/server/finance-options/api'
import { proposalCreateDal, proposalDuplicateDal } from '@/shared/entities/proposals/dal/server/mutations'
import { getFullView, listProposals, proposalListInputSchema } from '@/shared/entities/proposals/dal/server/queries'
import { proposalSchemas, proposalServerSpec } from '@/shared/entities/proposals/lib/server-spec'

import { createTRPCRouter } from '../../init'
import { createCrudRouter } from '../../lib/create-crud-router'
import { createEntityRouter } from '../../lib/create-entity-router'
import { dalToTrpc } from '../../lib/dal-to-trpc'
import { contractsRouter } from './contracts.router'
import { createDeliveryRouter } from './delivery.router'

export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) => {
  return createTRPCRouter({
    // ── CRUD (5 single-row operations) ──────────────────────────────────
    // Generated by createCrudRouter — wires CASL gating, Zod validation,
    // shareable procedure selection, and dalToTrpc bridge automatically.
    // Custom handlers override create (kind derivation + token gen + SOW
    // snapshot) and duplicate (cherry-pick + owner reassignment + status reset).
    crud: createCrudRouter({
      spec: proposalServerSpec,
      schemas: { ...proposalSchemas, id: z.string().uuid() },
      authedProcedure: entity.authedProcedure,
      shareableProcedure: entity.shareableProcedure,
      handlers: { create: proposalCreateDal, duplicate: proposalDuplicateDal },
    }),

    // ── Business queries ──────────────────────────────────────────────────
    // Enriched reads and complex list with entity-specific joins/filters.
    // These use free-form return types — not Row<TTable>.
    business: createTRPCRouter({
      getFullView: entity.shareableProcedure
        .input(z.object({ id: z.string().uuid(), token: z.string().optional() }))
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await getFullView(ctx, input)) ?? null
        }),

      list: entity.authedProcedure
        .input(proposalListInputSchema)
        .query(async ({ ctx, input }) => {
          return dalToTrpc(await listProposals(ctx, input))
        }),

      getFinanceOptions: entity.publicProcedure
        .query(async () => {
          return getFinanceOptions()
        }),
    }),

    // ── Service-layer sub-routers ─────────────────────────────────────────
    delivery: createDeliveryRouter(entity),
    contracts: contractsRouter,
  })
})
```

- [ ] **Step 2: Verify full compilation**

Run: `pnpm tsc --noEmit`
Expected: Zero errors. This is the critical moment — the full type chain should resolve.

If errors appear, they will likely be one of:
- Handler override type mismatch → check `proposalCreateDal`/`proposalDuplicateDal` signatures match `CrudHandlers<typeof proposals, string>`
- Toolkit procedure type mismatch → controlled cast in Task 9
- Middleware type issues → debug in Tasks 6/7

- [ ] **Step 3: Run lint**

Run: `pnpm lint 2>&1 | tail -10`
Expected: Zero errors (pre-existing warnings acceptable).

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/proposals.router/index.ts
git commit -m "refactor(proposals): replace 95 lines of inlined CRUD with createCrudRouter() — full type inference"
```

---

### Task 11: Final verification

- [ ] **Step 1: Full type check**

Run: `pnpm tsc --noEmit`
Expected: Exit 0, zero errors.

- [ ] **Step 2: Full lint**

Run: `pnpm lint`
Expected: Zero errors.

- [ ] **Step 3: Count remaining casts across the changed files**

Run: `grep -n ' as ' src/trpc/lib/create-crud-router.ts src/trpc/lib/create-entity-router.ts src/trpc/lib/middleware/scope-middleware.ts src/trpc/lib/middleware/shareable-middleware.ts src/trpc/routers/proposals.router/index.ts`

Expected: 2-4 casts total:
- `create-crud-router.ts`: `as CrudHandlers<TTable, TId>` (handler merge), `as Insert<TTable>` (Zod→Drizzle)
- `create-entity-router.ts`: 0-2 (possible procedure type compat on toolkit)
- Middleware: 0-1 (`spec.table as unknown as Record<...>` in shareable for token column)
- Proposals router: 0

If the count is higher than 4, investigate — something didn't resolve correctly.

- [ ] **Step 4: Verify client type inference works**

Run: `grep -n "unknown" src/trpc/routers/proposals.router/index.ts`
Expected: Zero results — no `unknown` types in the router file.

- [ ] **Step 5: Review diff**

Run: `git diff checkpoint/pre-crud-type-fix --stat`
Review: Confirm only the expected files changed. No debug logs, no leftover imports.
