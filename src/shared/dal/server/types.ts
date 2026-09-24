// Lives in dal/, not trpc/: tRPC, services, and jobs all depend on DAL, never the reverse.

import type { SQL } from 'drizzle-orm'
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core'
import type z from 'zod'

import type { Tx } from '@/shared/db'
import type { Insert, Row, Update } from '@/shared/db/types'
import type { BetterAuthSession } from '@/shared/domains/auth/server'
import type { EntityName } from '@/shared/domains/permissions/abilities'
import type { AppAbility, AppSubject } from '@/shared/domains/permissions/types'

/** `scope: null` = no visibility restriction (system/omni). */
export interface ScopedContext {
  session: BetterAuthSession | null
  ability: AppAbility | null
  scope: SQL | null
  /** Present ⇒ run on the caller's ambient transaction. Absent ⇒ autocommit on `db`. */
  tx?: Tx
}

export const SYSTEM_CONTEXT: ScopedContext = {
  session: null,
  ability: null,
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
  }
}

/** Late-bound so a hook can call the entity's own crud handlers without a circular import — resolved at call time. */
export type CrudConfigFactory<TTable extends PgTable, TId extends string | number = string, TInsert = Insert<TTable>, TUpdate = Update<TTable>>
  = (crudHandlers: CrudHandlers<TTable, TId, TInsert, TUpdate>) => CrudConfig<TTable, TId, TInsert, TUpdate>

// The engine validates payloads with the spec's Zod schemas AFTER the hooks run, so the
// contract is the schema INPUT (hook-filled columns optional), not Drizzle's insert model.
export type SpecInsert<TSpec extends EntityServerSpec<any, any>> = z.input<TSpec['schemas']['insert']>
export type SpecUpdate<TSpec extends EntityServerSpec<any, any>> = z.input<TSpec['schemas']['update']>
/** PK value type, read off the table's `id` column (serial → number, uuid → string). Tables keyed by another column (`primaryKey` override) fall back to string. */
export type SpecId<TSpec extends EntityServerSpec<any, any>> = Row<TSpec['table']> extends { id: infer I extends string | number } ? I : string
export type SpecCrudHandlers<TSpec extends EntityServerSpec<any, any>> = CrudHandlers<TSpec['table'], SpecId<TSpec>, SpecInsert<TSpec>, SpecUpdate<TSpec>>

export interface EntityServerSpec<
  TTable extends PgTable = PgTable,
  // eslint-disable-next-line unused-imports/no-unused-vars -- Phantom type param carried through to CrudHandlers<TTable, TId> via createCrudDal
  TId extends string | number = string,
> {
  entityName: EntityName
  caslSubject: AppSubject
  /** The entity's OWN visibility fragment. Optional only for a child with `parent`; a top-level entity MUST declare it or it is unscoped (checked in `resolveEffectiveScope`). */
  visibility?: (scope: VisibilityScope) => SQL
  /** Parent link for a sub-entity: `fk` is the CHILD column referencing the parent's PK; the parent's effective scope is ANDed in through it. Children reuse the parent's `caslSubject`. */
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
    | { type: 'forbidden' }
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
