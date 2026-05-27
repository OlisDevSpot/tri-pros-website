// ─── DAL Shared Types ──────────────────────────────────────────────────────
// These types define the contracts between DAL, tRPC, services, and jobs.
// They live here (not in trpc/) because DAL is the foundational layer —
// tRPC, services, and jobs all depend on DAL, never the reverse.
//
// Import from: `@/shared/dal/server/types`

import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type z from 'zod'

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
 * - `createEntityRouter(spec, factory)` — tRPC factory
 * - `buildUserContext(userId, spec)` — context builder for services/jobs
 */
export interface EntityServerSpec<
  TTable extends PgTable = PgTable,
  // eslint-disable-next-line unused-imports/no-unused-vars -- Phantom type param carried through to CrudHandlers<TTable, TId> via createCrudDal
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
  /**
   * Entity lifecycle hooks. Executed by createCrudDal — both before and after.
   *
   * - `before` hooks: async, data transformation. Can read DB via DAL functions
   *   (never naked `db`). Return the (possibly enriched) data.
   * - `after` hooks: async, side effects (services, notifications, realtime).
   *   The hook implementation decides what to `await` (critical) vs
   *   `void .catch()` (best-effort).
   *
   * All hooks receive ScopedContext. Hooks should be thin orchestrators —
   * pure business logic belongs in `entities/<entity>/lib/`, service
   * orchestration uses existing services.
   */
  hooks?: {
    create?: {
      // eslint-disable-next-line ts/method-signature-style -- bivariant method signatures required for EntityServerSpec<Table> → EntityServerSpec<PgTable> assignability
      before?(input: Insert<TTable>, ctx: ScopedContext): Promise<Insert<TTable>> | Insert<TTable>
      // eslint-disable-next-line ts/method-signature-style
      after?(row: Row<TTable>, ctx: ScopedContext): Promise<void>
    }
    update?: {
      // eslint-disable-next-line ts/method-signature-style
      before?(data: Update<TTable>, ctx: ScopedContext): Promise<Update<TTable>> | Update<TTable>
      // eslint-disable-next-line ts/method-signature-style
      after?(row: Row<TTable>, ctx: ScopedContext, meta: {
        previousRow: Row<TTable>
        input: Update<TTable>
      }): Promise<void>
    }
    delete?: {
      // eslint-disable-next-line ts/method-signature-style
      before?(id: string | number, ctx: ScopedContext): Promise<void>
      // eslint-disable-next-line ts/method-signature-style
      after?(id: string | number, ctx: ScopedContext): Promise<void>
    }
  }
  /**
   * Declarative duplicate config. Default behavior: copy full row minus PK.
   * Duplicate routes through createImpl — create hooks fire automatically.
   * This is NOT a hook. It's declarative configuration for field selection.
   */
  duplicate?: {
    /** Fields to drop beyond PK (which is always dropped). */
    exclude?: readonly string[]
    /** Override/transform specific field values on the copy. */
    // eslint-disable-next-line ts/method-signature-style
    overrides?(source: Row<TTable>, ctx: ScopedContext): Partial<Insert<TTable>>
  }
}

// ── CRUD Slot Names ─────────────────────────────────────────────────────

/**
 * Canonical CRUD slot names — 5 single-row operations.
 * `list` is NOT CRUD — each entity writes its own list query.
 */
export type SlotName = 'getById' | 'create' | 'update' | 'delete' | 'duplicate'

// ── CRUD Handler Interface ──────────────────────────────────────────────

export interface CrudHandlers<TTable extends PgTable, TId extends string | number = string> {
  getById: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<Row<TTable> | undefined>>
  create: (ctx: ScopedContext, input: Insert<TTable>) => Promise<DalReturn<Row<TTable>>>
  update: (ctx: ScopedContext, input: { id: TId, data: Update<TTable> }) => Promise<DalReturn<Row<TTable>>>
  delete: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<void>>
  duplicate: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<Row<TTable>>>
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
