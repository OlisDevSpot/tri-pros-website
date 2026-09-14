// ─── DAL Shared Types ──────────────────────────────────────────────────────
// These types define the contracts between DAL, tRPC, services, and jobs.
// They live here (not in trpc/) because DAL is the foundational layer —
// tRPC, services, and jobs all depend on DAL, never the reverse.
//
// Import from: `@/shared/dal/server/types`

import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type z from 'zod'

import type { Tx } from '@/shared/db'
import type { Insert, Row, Update } from '@/shared/db/types'
import type { BetterAuthSession } from '@/shared/domains/auth/server'
import type { EntityName } from '@/shared/domains/permissions/abilities'
import type { AppAbility, AppSubject } from '@/shared/domains/permissions/types'

// ── Context ─────────────────────────────────────────────────────────────

/**
 * Minimal context for all DAL functions. Every DAL function receives this
 * as its first argument, regardless of how it's invoked:
 *
 * - **From tRPC**: middleware resolves session/ability/scope from HTTP
 *   request, passes as `ScopedContext`.
 * - **From services/jobs**: caller constructs context via helpers
 *   (`SYSTEM_CONTEXT` for privileged, `buildUserContext()` for scoped).
 *
 * `scope` is a Drizzle SQL fragment applied to WHERE clauses for
 * visibility. `null` = no restriction (system/omni access).
 */
export interface ScopedContext {
  session: BetterAuthSession | null
  ability: AppAbility | null
  scope: SQL | null
  /** Present ⇒ run on the caller's ambient transaction (composed atomicity). Absent ⇒ autocommit on `db`. Threaded via `withTx` (see dal/server/lib/helpers.ts). */
  tx?: Tx
}

/**
 * System-level context with no scoping. Used by background jobs,
 * webhooks, and services that need full access to all rows.
 */
export const SYSTEM_CONTEXT: ScopedContext = {
  session: null,
  ability: null,
  scope: null,
}

// ── Visibility Scope ────────────────────────────────────────────────────

/** Inputs a visibility predicate may branch on. userId for row-ownership; ability for capability-based views. */
export interface VisibilityScope {
  userId: string
  ability: AppAbility
}

// ── Hook plumbing (Sub-plan A) ──────────────────────────────────────────

/** A hook may be sync or async. No existing repo util covers this. */
export type MaybePromise<T> = T | Promise<T>

/** Meta for a create `after` hook. `input` is the ORIGINAL insert payload. */
export interface CreateAfterMeta<TTable extends PgTable, TInsert = Insert<TTable>> {
  input: TInsert
}

/** Meta for an update `after` hook. `previousRow` is the pre-update snapshot; `input` is the ORIGINAL update payload. */
export interface UpdateAfterMeta<TTable extends PgTable, TUpdate = Update<TTable>> {
  previousRow: Row<TTable>
  input: TUpdate
}

/**
 * SINGLE source of truth for per-slot hook signatures. Add a slot or change a
 * signature here and every hook type below follows. `create`/`update` `before`
 * threads (transforms) the payload; `delete` `before`/`after` take the pre-delete
 * row and return void.
 */
export interface CrudSlotHookMap<TTable extends PgTable, TId extends string | number, TInsert = Insert<TTable>, TUpdate = Update<TTable>> {
  create: {
    before?: (input: TInsert, ctx: ScopedContext) => MaybePromise<TInsert>
    after?: (row: Row<TTable>, ctx: ScopedContext, meta: CreateAfterMeta<TTable, TInsert>) => MaybePromise<Row<TTable> | void>
  }
  update: {
    before?: (data: TUpdate, ctx: ScopedContext, meta: { id: TId }) => MaybePromise<TUpdate>
    after?: (row: Row<TTable>, ctx: ScopedContext, meta: UpdateAfterMeta<TTable, TUpdate>) => MaybePromise<Row<TTable> | void>
  }
  delete: {
    before?: (row: Row<TTable>, ctx: ScopedContext) => MaybePromise<void>
    after?: (row: Row<TTable>, ctx: ScopedContext) => MaybePromise<void>
  }
}

/** The three hook-bearing mutation slots, derived from the map (stays in sync). */
export type CrudMutationSlot = keyof CrudSlotHookMap<PgTable, string> & string

/** Factory-invariant hooks — each slot optional. Fire every call, every origin. */
export type CrudHooks<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>> = {
  [S in CrudMutationSlot]?: CrudSlotHookMap<TTable, TId, TInsert, TUpdate>[S]
}

/**
 * Call-site hooks for ONE slot: that slot's before/after (looked up) PLUS a
 * commit-boundary hook. `afterCommit` is declared for a stable option surface
 * but WIRED by Sub-plan C — never invoked in A.
 */
export type CrudCallsiteHooks<
  TTable extends PgTable,
  TId extends string | number,
  S extends CrudMutationSlot,
  TInsert = Insert<TTable>,
  TUpdate = Update<TTable>,
> = CrudSlotHookMap<TTable, TId, TInsert, TUpdate>[S] & {
  afterCommit?: (row: Row<TTable>, ctx: ScopedContext) => void
}

/**
 * Factory-invariant hook + duplicate config for an entity. Returned by a
 * `CrudConfigFactory`. Entities with no hooks pass no factory and get `{}`.
 */
export interface CrudConfig<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>> {
  hooks?: CrudHooks<TTable, TId, TInsert, TUpdate>
  duplicate?: {
    exclude?: readonly string[]
    overrides?: (source: Row<TTable>, ctx: ScopedContext) => Partial<TInsert>
  }
}

/**
 * Late-bound config factory. Receives the crud handlers the factory itself
 * produces, so a hook can call `crudHandlers.getById(...)` for a same-entity
 * read — resolved at call time, long after construction. This kills the
 * circular barrier (spec §1.1, §2.3).
 */
export type CrudConfigFactory<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>>
  = (crudHandlers: CrudHandlers<TTable, TId, TInsert, TUpdate>) => CrudConfig<TTable, TId, TInsert, TUpdate>

// ── Spec-derived contracts ──────────────────────────────────────────────
//
// The engine VALIDATES a create/update payload with the spec's Zod schemas
// (`createImpl`: hooks → `schemas.insert.parse` → insert). So the payload an
// orchestrator may hand to `create`/`update` is the INPUT of those schemas —
// server-derived columns the hooks fill in (`token`, `ownerId`, `kind`) are
// optional there — not Drizzle's insert model, where every NOT NULL column
// without a default is required. `createCrudDal` derives its handler types
// from the spec through these, so the TS contract and the runtime contract
// are the same object. `Insert<TTable>` stays the default for the generic
// interfaces above (nothing outside the factory needs to change).

/** What `create` accepts: the spec's insert schema INPUT (hook-derived columns optional). */
export type SpecInsert<TSpec extends EntityServerSpec<any, any>> = z.input<TSpec['schemas']['insert']>
/** What `update.data` accepts: the spec's update schema INPUT. */
export type SpecUpdate<TSpec extends EntityServerSpec<any, any>> = z.input<TSpec['schemas']['update']>
/** PK value type, read off the table's `id` column (serial → number, uuid → string). Tables keyed by another column (`primaryKey` override) fall back to string. */
export type SpecId<TSpec extends EntityServerSpec<any, any>> = Row<TSpec['table']> extends { id: infer I extends string | number } ? I : string
/** The precise handler set `createCrudDal(spec)` returns — use for `satisfies` on a service that spreads a crud. */
export type SpecCrudHandlers<TSpec extends EntityServerSpec<any, any>> = CrudHandlers<TSpec['table'], SpecId<TSpec>, SpecInsert<TSpec>, SpecUpdate<TSpec>>

// ── Entity Server Spec ──────────────────────────────────────────────────

/**
 * Typed declaration per entity. The single source of truth for an entity's
 * table, schemas, visibility predicate, and named configuration.
 *
 * @typeParam TTable — Drizzle table type for this entity.
 * @typeParam TId — Primary key value type. Defaults to `string` (UUID).
 *   Override to `number` for serial PKs.
 *
 * Consumed by:
 * - `createCrudDal(spec)` — DAL crud factory
 * - `createCrudRouter({ spec, schemas })` — tRPC CRUD leaf (builds scoped procedures inline)
 * - `<entity>.router/procedures.ts` — per-entity pre-scoped procedures (defined once)
 * - `buildUserContext(userId, spec)` — context builder for services/jobs
 */
export interface EntityServerSpec<
  TTable extends PgTable = PgTable,
  // eslint-disable-next-line unused-imports/no-unused-vars -- Phantom type param carried through to CrudHandlers<TTable, TId> via createCrudDal
  TId extends string | number = string,
> {
  entityName: EntityName
  caslSubject: AppSubject
  /**
   * The entity's OWN visibility fragment (references THIS table's columns).
   * Optional: a pure child entity (one with a `parent` link and no independent
   * ownership) omits it — its effective scope is entirely parent-derived. A
   * top-level entity without a `parent` MUST declare it, else it would be
   * unscoped. Enforced at resolve time (`resolveEffectiveScope`), which ANDs
   * this fragment with the parent bridge. Omni is handled by the callers of
   * `resolveEffectiveScope`, never here.
   */
  visibility?: (scope: VisibilityScope) => SQL
  /**
   * Parent link for a sub-entity. `fk` is the CHILD column that references the
   * parent's primary key. `resolveEffectiveScope` composes
   * `fk IN (SELECT parent.pk FROM parent WHERE <parent effective scope>)` and
   * ANDs it with this entity's own `visibility` (additive). Children reuse the
   * parent's `caslSubject`. see dal/server/lib/scope.ts
   */
  parent?: { spec: EntityServerSpec, fk: PgColumn }
  table: TTable
  schemas: {
    insert: z.ZodObject<Record<string, z.ZodTypeAny>>
    update: z.ZodObject<Record<string, z.ZodTypeAny>>
    select: z.ZodObject<Record<string, z.ZodTypeAny>>
  }
  /** Defaults to 'id'. Override for serial PKs or custom column names. */
  primaryKey?: string
  shareable?: { tokenColumn: string }
}

// ── CRUD Slot Names ─────────────────────────────────────────────────────

/**
 * Canonical CRUD slot names — 5 single-row operations.
 * `list` is NOT CRUD — each entity writes its own list query.
 */
export type SlotName = 'getById' | 'create' | 'update' | 'delete' | 'duplicate'

// ── CRUD Handler Interface ──────────────────────────────────────────────

export interface CrudHandlers<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>> {
  getById: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<Row<TTable> | undefined>>
  create: (ctx: ScopedContext, input: TInsert, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) => Promise<DalReturn<Row<TTable>>>
  update: (ctx: ScopedContext, input: { id: TId, data: TUpdate }, options?: CrudCallsiteHooks<TTable, TId, 'update', TInsert, TUpdate>) => Promise<DalReturn<Row<TTable>>>
  delete: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'delete', TInsert, TUpdate>) => Promise<DalReturn<void>>
  duplicate: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) => Promise<DalReturn<Row<TTable>>>
}

// ── DalReturn Result Type ───────────────────────────────────────────────
//
// Every DAL function returns this discriminated union — never throws,
// never redirects. The DAL is a pure data boundary. Callers decide what
// to do with errors:
//
// - tRPC procedures: map DalError → TRPCError (client gets HTTP status)
// - Services/jobs: inspect error type, log, retry, or propagate
// - Server components: redirect on no-user, throw on DB error
//
// Adapted from WebDevSimplified/next-js-data-access-layer.

export type DalReturn<T>
  = | { success: true, data: T }
    | { success: false, error: DalError }

export type DalError
  = | { type: 'not-found' }
    | { type: 'forbidden' }
    | { type: 'create-failed', cause?: unknown }
    | { type: 'duplicate-failed', cause?: unknown }
    | { type: 'db-error', cause: unknown }
    | { type: 'unknown-error', cause: unknown }
    | { type: 'precondition-failed', reason: string }

// ── Result Constructors ─────────────────────────────────────────────────

export function dalSuccess<T>(data: T): DalReturn<T> {
  return { success: true, data }
}

export function dalError<T = never>(error: DalError): DalReturn<T> {
  return { success: false, error }
}

// ── ThrowableDalError ───────────────────────────────────────────────────
//
// For use INSIDE dalDbOperation: when business logic detects an error
// mid-query (e.g., row count = 0 after update), throw this to short-
// circuit into a structured DalError instead of an unknown-error.

export class ThrowableDalError extends Error {
  dalError: DalError
  constructor(dalError: DalError) {
    super(`DalError: ${dalError.type}`)
    this.dalError = dalError
  }
}
