// ─── Entity Server System — Shared Types ────────────────────────────────────
// Type contract consumed by L0 (create-crud-handlers), L1 (create-crud-router),
// L2 (create-entity-router), and the entity registry.
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
 * Framework-agnostic context that every L0 handler receives. Session is
 * always present — L1's `shareable` token path takes a separate branch
 * that bypasses L0 entirely (no session, no scope, just a token match).
 */
export interface AgentCtx {
  session: BetterAuthSession
  ability: AppAbility
  /** Visibility SQL fragment to apply to reads. `null` = omni / no scoping. */
  scope: SQL | null
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
    insert: z.ZodTypeAny
    update: z.ZodTypeAny
    select: z.ZodTypeAny
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
  list: (ctx: AgentCtx, input: ListInput) => Promise<PaginatedResult<Row<TTable>>>
  getById: (ctx: AgentCtx, input: { id: PkField<TTable> }) => Promise<Row<TTable> | undefined>
  create: (ctx: AgentCtx, input: Insert<TTable>) => Promise<Row<TTable>>
  update: (ctx: AgentCtx, input: { id: PkField<TTable>, data: Update<TTable> }) => Promise<Row<TTable>>
  delete: (ctx: AgentCtx, input: { id: PkField<TTable> }) => Promise<void>
  duplicate: (ctx: AgentCtx, input: { id: PkField<TTable> }) => Promise<Row<TTable>>
}
