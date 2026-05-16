// ─── Entity Server System — Shared Types ────────────────────────────────────
// Type contract consumed by L0 (create-crud-handlers), L1 (create-crud-router),
// L2 (create-entity-router), and the entity registry.
//
// See ADR-0002 (docs/adr/0002-entity-server-system.md) for design rationale
// and the Phase 1a spec (docs/superpowers/specs/...) for scope and policy.

import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type z from 'zod'

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

// ── Helper row-shape aliases ─────────────────────────────────────────────
// Row, Insert, Update derived from the Drizzle table's $infer* properties.
// This keeps the spec compact — entities don't have to thread row types
// through every generic parameter; the factory pulls them from the table.

export type Row<TTable extends PgTable> = TTable['$inferSelect']
export type Insert<TTable extends PgTable> = TTable['$inferInsert']
export type Update<TTable extends PgTable> = Partial<TTable['$inferInsert']>

// ── Shared spec base — both branches have these fields with the same shape ─

interface EntitySpecBase<TTable extends PgTable = PgTable> {
  entityName: EntityName
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

// ── Core branch ──────────────────────────────────────────────────────────
//
// `parentEntity: null` is the discriminant. Core entities REQUIRE
// `caslSubject` and `visibility` — they're root-level identities.

export interface CoreEntitySpec<TTable extends PgTable = PgTable> extends EntitySpecBase<TTable> {
  parentEntity: null
  caslSubject: AppSubject
  visibility: (userId: string) => SQL
}

// ── Nested branch ────────────────────────────────────────────────────────
//
// DORMANT in Phase 1a — types compile, but no entity uses this branch yet.
// Policy: all new entities MUST be authored as `CoreEntitySpec`. Reach for
// `NestedEntitySpec` only when a concrete consumer emerges that genuinely
// requires parent-chain auth inheritance, and revisit the design with the
// consumer in hand.
//
// When that day comes:
//   - `parentEntity` is a non-null EntityName (parent must already exist
//     in the registry at module load time).
//   - `parentRef` is the FK on THIS table pointing at the parent.
//   - `caslSubject` and `visibility` default to inherited from parent chain;
//     override locally if this nested entity has genuinely different rules.

export interface NestedEntitySpec<TTable extends PgTable = PgTable> extends EntitySpecBase<TTable> {
  parentEntity: EntityName
  parentRef: { foreignKey: PgColumn }
  caslSubject?: AppSubject
  visibility?: (userId: string) => SQL
}

export type EntityServerSpec = CoreEntitySpec | NestedEntitySpec

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
  getById: (ctx: AgentCtx, input: { id: string }) => Promise<Row<TTable> | undefined>
  create: (ctx: AgentCtx, input: Insert<TTable>) => Promise<Row<TTable>>
  update: (ctx: AgentCtx, input: { id: string, data: Update<TTable> }) => Promise<Row<TTable>>
  delete: (ctx: AgentCtx, input: { id: string }) => Promise<void>
  duplicate: (ctx: AgentCtx, input: { id: string }) => Promise<Row<TTable>>
}
