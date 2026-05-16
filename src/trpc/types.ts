// ─── tRPC Shared Types ──────────────────────────────────────────────────────
// Central type definitions for the entire tRPC layer: context shapes,
// Entity Server System contracts (L0/L1/L2), and HTTP adapter types.
//
// See ADR-0002 (docs/adr/0002-entity-server-system.md) for design rationale
// and the Phase 1a spec (docs/superpowers/specs/...) for scope and policy.

import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type z from 'zod'

import type { Insert, Row, Update } from '@/shared/db/types'
import type { BetterAuthSession } from '@/shared/domains/auth/server'
import type { EntityName } from '@/shared/domains/permissions/abilities'
import type { AppAbility, AppSubject } from '@/shared/domains/permissions/types'

/**
 * Canonical CRUD slot names. Used by the L1 `exclude` option and by
 * `CrudHandlers` to key its slot functions.
 */
export type SlotName = 'list' | 'getById' | 'create' | 'update' | 'delete' | 'duplicate'

/**
 * Single shared context shape for all tRPC procedures. Each field starts
 * nullable; middleware layers progressively narrow:
 *   - baseProcedure:      all nullable (public routes)
 *   - protectedProcedure: session + ability non-null
 *   - L1 entity layer:    scope computed (null for omni, SQL for scoped)
 */
export interface BaseTRPCContext {
  session: BetterAuthSession | null
  ability: AppAbility | null
  /** Visibility SQL fragment for row-level reads. `null` = omni / no scoping / not yet resolved. */
  scope: SQL | null
}

/** Context after protectedProcedure/agentProcedure — session + ability guaranteed non-null. */
export type AuthedContext = BaseTRPCContext & {
  session: BetterAuthSession
  ability: AppAbility
  scope: SQL | null
}

/** HTTP adapter context — extends base with request/response headers. */
export interface HTTPTRPCContext extends BaseTRPCContext {
  req?: Request
  resHeaders: Headers
}

/**
 * Typed declaration per entity. Required fields: `caslSubject` and `visibility`
 * — every entity is a top-level identity with its own CASL subject and
 * visibility predicate. Entity-internal relations (junction tables, append-only
 * logs) live as business plugin procedures on the parent's L2 router.
 */
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

  // Named typed config — all optional. Promote new patterns here only when
  // 2+ entities adopt them (per ADR-0002 "one-adopter-not-a-seam" rule).
  shareable?: { tokenColumn: string }
  update?: { jsonbMergeColumns: readonly PgColumn[] }
  list?: {
    searchColumns?: readonly PgColumn[]
    sortableColumns?: Record<string, PgColumn>
    defaultSort?: { column: string, dir: 'asc' | 'desc' }
  }
}

// ── Primary key type derivation ──────────────────────────────────────────
//
// Extracts the PK value type from a table's select schema so handler inputs
// reflect the actual column type (string for UUID, number for serial).
// All current entities use `id` as the column name. If a future entity uses
// a different column name via `primaryKey`, this falls back to string | number
// until the design is revisited (one-adopter-not-a-seam per ADR-0002).

export type PkField<TTable extends PgTable>
  = Row<TTable> extends { id: infer T } ? T : string | number

// ── L0 handler shape ─────────────────────────────────────────────────────
//
// Each slot is `(ctx, input) => Promise<output>`. Pure async functions, no
// tRPC dependency, throw domain errors (`new Error('NotFound')` etc.) which
// L1 maps to TRPCError. `list` input is the standard paginated-query shape.

export interface ListInput {
  pagination: { limit: number, offset: number }
  sort?: { sortBy?: string, sortDir?: 'asc' | 'desc' }
  search?: string
  filters?: Record<string, unknown>
}

export interface PaginatedResult<T> {
  rows: T[]
  total: number
}

export interface CrudHandlers<TTable extends PgTable> {
  list: (ctx: AuthedContext, input: ListInput) => Promise<PaginatedResult<Row<TTable>>>
  getById: (ctx: AuthedContext, input: { id: PkField<TTable> }) => Promise<Row<TTable> | undefined>
  create: (ctx: AuthedContext, input: Insert<TTable>) => Promise<Row<TTable>>
  update: (ctx: AuthedContext, input: { id: PkField<TTable>, data: Update<TTable> }) => Promise<Row<TTable>>
  delete: (ctx: AuthedContext, input: { id: PkField<TTable> }) => Promise<void>
  duplicate: (ctx: AuthedContext, input: { id: PkField<TTable> }) => Promise<Row<TTable>>
}
