// Lives in dal/, not trpc/: tRPC, services, and jobs all depend on DAL, never the reverse.

import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type z from 'zod'

import type { Tx } from '@/shared/db'
import type { Insert, Row, Update } from '@/shared/db/types'
import type { EntityName } from '@/shared/domains/permissions/abilities'
import type { Actor } from '@/shared/domains/permissions/actor'
import type { AppAbility } from '@/shared/domains/permissions/types'

import { abilityFromRules } from '@/shared/domains/permissions/abilities'

export interface ScopedContext {
  actor: Actor
  /** `null` = no visibility restriction (system/omni). */
  scope: SQL | null
  /** Present ⇒ run on the caller's ambient transaction. Absent ⇒ autocommit on `db`. */
  tx?: Tx
}

// No user and every action: jobs, webhooks and server-derived writes.
export const SYSTEM_CONTEXT: ScopedContext = {
  actor: { ability: abilityFromRules([{ action: 'manage', subject: 'all' }]), userId: null },
  scope: null,
}

export interface VisibilityScope {
  userId: string
  ability: AppAbility
}

export type MaybePromise<T> = T | Promise<T>

/** `input` is the ORIGINAL (pre-hook) insert payload. */
export interface CreateAfterMeta<TTable extends PgTable, TInsert = Insert<TTable>> {
  input: TInsert
}

/** `previousRow` is the pre-update snapshot; `input` is the ORIGINAL (pre-hook) update payload. */
export interface UpdateAfterMeta<TTable extends PgTable, TUpdate = Update<TTable>> {
  previousRow: Row<TTable>
  input: TUpdate
}

/** Meta for a duplicate `after` hook. `source` is the row that was copied. */
export interface DuplicateAfterMeta<TTable extends PgTable> {
  source: Row<TTable>
}

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

export type CrudMutationSlot = keyof CrudSlotHookMap<PgTable, string> & string

/** Factory-invariant hooks: fire on every call from every origin. */
export type CrudHooks<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>> = {
  [S in CrudMutationSlot]?: CrudSlotHookMap<TTable, TId, TInsert, TUpdate>[S]
}

/** Per-call hooks for one slot. `afterCommit` is declared but NOT wired — it is never invoked. */
export type CrudCallsiteHooks<
  TTable extends PgTable,
  TId extends string | number,
  S extends CrudMutationSlot,
  TInsert = Insert<TTable>,
  TUpdate = Update<TTable>,
> = CrudSlotHookMap<TTable, TId, TInsert, TUpdate>[S] & {
  afterCommit?: (row: Row<TTable>, ctx: ScopedContext) => void
}

export interface CrudConfig<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>> {
  hooks?: CrudHooks<TTable, TId, TInsert, TUpdate>
  duplicate?: {
    exclude?: readonly string[]
    overrides?: (source: Row<TTable>, ctx: ScopedContext) => Partial<TInsert>
    /**
     * Fires once the copy exists — after `createImpl` (and therefore after the
     * create before/after hooks) returned success — with the created row and
     * the SOURCE row. The place for child-row cloning the engine cannot express
     * (`duplicateImpl` copies `spec.table` only). Return a replacement row to
     * thread it back to the caller, or void. There is no `duplicate.before`:
     * `overrides` is the before-shaping seam. Fires for every origin.
     */
    after?: (row: Row<TTable>, ctx: ScopedContext, meta: DuplicateAfterMeta<TTable>) => MaybePromise<Row<TTable> | void>
  }
}

/** Late-bound so a hook can call the entity's own crud handlers without a circular import — resolved at call time. */
export type CrudConfigFactory<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>>
  = (crudHandlers: CrudHandlers<TTable, TId, TInsert, TUpdate>) => CrudConfig<TTable, TId, TInsert, TUpdate>

// The engine validates payloads with the spec's Zod schemas AFTER the hooks run, so the
// contract is the schema INPUT (hook-filled columns optional), not Drizzle's insert model.
export type SpecInsert<TSpec extends AnyServerSpec> = z.input<TSpec['schemas']['insert']>
export type SpecUpdate<TSpec extends AnyServerSpec> = z.input<TSpec['schemas']['update']>
/** PK value type, read off the table's `id` column (serial → number, uuid → string). Tables keyed by another column (`primaryKey` override) fall back to string. */
export type SpecId<TSpec extends AnyServerSpec> = Row<TSpec['table']> extends { id: infer I extends string | number } ? I : string
export type SpecCrudHandlers<TSpec extends AnyServerSpec> = CrudHandlers<TSpec['table'], SpecId<TSpec>, SpecInsert<TSpec>, SpecUpdate<TSpec>>

type ZodObjectAny = z.ZodObject<Record<string, z.ZodTypeAny>>

export interface ServerSpecSchemas {
  insert: ZodObjectAny
  update: ZodObjectAny
  select: ZodObjectAny
}

interface ServerSpecBase<TTable extends PgTable, TSchemas extends ServerSpecSchemas> {
  entityName: EntityName
  table: TTable
  schemas: TSchemas
  /** Defaults to 'id'. Override for serial PKs or custom column names. */
  primaryKey?: string
}

/** Has its own CASL subject. A `parent` adds reach through another entity without giving up the subject. */
export interface EntitySpec<
  TTable extends PgTable,
  TSchemas extends ServerSpecSchemas,
  TSubject extends EntityName,
  TConditionColumn extends string,
  TParent extends AnyServerSpec,
> extends ServerSpecBase<TTable, TSchemas> {
  subject: TSubject
  /** The only columns a rule condition may name. A row checked against a rule on the client must carry them. */
  conditionColumns: readonly TConditionColumn[]
  parent?: { spec: TParent, fk: PgColumn }
  /** The entity's OWN visibility fragment. An entity without a `parent` MUST declare it or it is unscoped (checked in `resolveEffectiveScope`). */
  visibility?: (scope: VisibilityScope) => SQL
  shareable?: { tokenColumn: string }
}

/** Has no subject: it is the field `parent.field` of its parent's subject, and is reached only through that parent. */
export interface SubEntitySpec<
  TTable extends PgTable,
  TSchemas extends ServerSpecSchemas,
  TParent extends AnyServerSpec,
  TField extends string,
> extends ServerSpecBase<TTable, TSchemas> {
  parent: { spec: TParent, fk: PgColumn, field: TField }
  // Entity-only. Declared `never` so a sub-entity cannot carry them.
  visibility?: never
  shareable?: never
}

/** Any spec over `TTable`: the two shapes the constructors build. Enforcement is typed against the list in `permissions/specs.ts`. */
export type AnyServerSpec<TTable extends PgTable = PgTable>
  = | EntitySpec<TTable, ServerSpecSchemas, EntityName, string, AnyServerSpec>
    | SubEntitySpec<TTable, ServerSpecSchemas, AnyServerSpec, string>

/** `list` is deliberately not a slot — each entity writes its own list query. */
export type SlotName = 'getById' | 'create' | 'update' | 'delete' | 'duplicate'

export interface CrudHandlers<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>> {
  getById: (ctx: ScopedContext, input: { id: TId }) => Promise<DalReturn<Row<TTable> | undefined>>
  create: (ctx: ScopedContext, input: TInsert, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) => Promise<DalReturn<Row<TTable>>>
  update: (ctx: ScopedContext, input: { id: TId, data: TUpdate }, options?: CrudCallsiteHooks<TTable, TId, 'update', TInsert, TUpdate>) => Promise<DalReturn<Row<TTable>>>
  delete: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'delete', TInsert, TUpdate>) => Promise<DalReturn<void>>
  duplicate: (ctx: ScopedContext, input: { id: TId }, options?: CrudCallsiteHooks<TTable, TId, 'create', TInsert, TUpdate>) => Promise<DalReturn<Row<TTable>>>
}

// Every DAL function returns this — never throws, never redirects; the caller maps the error.
export type DalReturn<T>
  = | { success: true, data: T }
    | { success: false, error: DalError }

export type DalError
  = | { type: 'not-found' }
    | { type: 'forbidden', field?: string }
    | { type: 'create-failed', cause?: unknown }
    | { type: 'duplicate-failed', cause?: unknown }
    | { type: 'db-error', cause: unknown }
    | { type: 'unknown-error', cause: unknown }
    | { type: 'precondition-failed', reason: string }

export function dalSuccess<T>(data: T): DalReturn<T> {
  return { success: true, data }
}

export function dalError<T = never>(error: DalError): DalReturn<T> {
  return { success: false, error }
}

// Throw inside `dalDbOperation` to short-circuit into a structured DalError instead of a db-error.
export class ThrowableDalError extends Error {
  dalError: DalError
  constructor(dalError: DalError) {
    super(`DalError: ${dalError.type}`)
    this.dalError = dalError
  }
}
