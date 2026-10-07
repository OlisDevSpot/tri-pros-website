import type { AnyServerSpec } from '@/shared/dal/server/types'

import type { ServerSpec } from '@/shared/domains/permissions/specs'
import type { AppAbility, AppAction } from '@/shared/domains/permissions/types'
import type { CrudHandlers, SlotName } from '@/trpc/types'

import { TRPCError } from '@trpc/server'
import z from 'zod'

import { subjectOf } from '@/shared/dal/server/lib/define-spec'
import { agentProcedure, baseProcedure, createTRPCRouter } from '@/trpc/init'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'
import { resolveVisibilityScope } from '@/trpc/lib/middleware/scope-middleware'
import { shareableMiddleware } from '@/trpc/lib/middleware/shareable-middleware'

const SLOT_ACTIONS: Record<SlotName, AppAction> = {
  getById: 'read',
  create: 'create',
  update: 'update',
  delete: 'delete',
  duplicate: 'create',
}

export interface CreateCrudRouterConfig<
  TSpec extends ServerSpec,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
> {
  spec: TSpec
  schemas: { id: z.ZodType<TId>, insert: TInsert, update: TUpdate }
  /** The entity's single hooked crud instance — the router never rebuilds handlers, so un-hooked ones cannot exist. */
  crud: CrudHandlers<TSpec['table'], TId, z.input<TInsert>, z.input<TUpdate>>
  /** Slot overrides BYPASS the crud's hooks entirely — the override replaces the whole DAL function. */
  handlers?: Partial<CrudHandlers<TSpec['table'], TId, z.input<TInsert>, z.input<TUpdate>>>
}

export function createCrudRouter<
  TSpec extends ServerSpec,
  TId extends string | number,
  TInsert extends z.ZodObject<z.ZodRawShape>,
  TUpdate extends z.ZodObject<z.ZodRawShape>,
>(config: CreateCrudRouterConfig<TSpec, TId, TInsert, TUpdate>) {
  type TTable = TSpec['table']
  // Spreading the Partial `handlers` widens property types to include `undefined`, hence the cast.
  const handlers = { ...config.crud, ...config.handlers } as CrudHandlers<TTable, TId, z.input<TInsert>, z.input<TUpdate>>

  // Built inline off agentProcedure so `ctx` infers concretely — no builder-type cast at a param boundary.
  const authedProcedure = agentProcedure.use(async ({ ctx, next }) =>
    next({ ctx: { ...ctx, scope: resolveVisibilityScope(config.spec, { userId: ctx.session.user.id, ability: ctx.actor.ability }) } }))
  const shareableProcedure = baseProcedure.use(shareableMiddleware(config.spec))

  const readProcedure = config.spec.shareable ? shareableProcedure : authedProcedure
  const updateProcedure = config.spec.shareable ? shareableProcedure : authedProcedure

  // `token` is always optional — harmless on non-shareable entities.
  const { id: idZod } = config.schemas
  const idInput = z.object({ id: idZod, token: z.string().optional() })
  const updateInput = z.object({ id: idZod, data: config.schemas.update, token: z.string().optional() })
  const idOnlyInput = z.object({ id: idZod })

  return createTRPCRouter({
    getById: readProcedure
      .input(idInput)
      .query(async ({ ctx, input }) => {
        assertCan(ctx.actor.ability, 'getById', config.spec)
        const row = dalToTrpc(await handlers.getById(ctx, { id: input.id }))
        if (!row) {
          throw new TRPCError({ code: 'NOT_FOUND', message: `${config.spec.entityName} not found` })
        }
        return row
      }),

    create: authedProcedure
      .input(config.schemas.insert)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.actor.ability, 'create', config.spec)
        // tRPC hands us the schema OUTPUT; the DAL contract is its INPUT. Identical for our
        // transform-free insert schemas, which TS cannot prove for a generic TInsert — hence the cast.
        const row = dalToTrpc(await handlers.create(ctx, input as z.input<TInsert>))
        return row
      }),

    update: updateProcedure
      .input(updateInput)
      .mutation(async ({ ctx, input }) => {
        // Zod 4 can't resolve the generic TUpdate output inside z.object({ data: TUpdate }); runtime validation already ran.
        const { id, data } = input as { id: TId, data: z.input<TUpdate>, token?: string }

        assertCanUpdateFields(ctx.actor.ability, config.spec, data as Record<string, unknown>)

        const row = dalToTrpc(await handlers.update(ctx, { id, data }))
        return row
      }),

    delete: authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.actor.ability, 'delete', config.spec)
        dalToTrpc(await handlers.delete(ctx, { id: input.id }))
      }),

    duplicate: authedProcedure
      .input(idOnlyInput)
      .mutation(async ({ ctx, input }) => {
        assertCan(ctx.actor.ability, 'duplicate', config.spec)
        const row = dalToTrpc(await handlers.duplicate(ctx, { id: input.id }))
        return row
      }),
  })
}

// The subject and the field are known only at run time here, which the typed `can` refuses.
// This is what `can` does inside CASL.
function isGranted(ability: AppAbility, action: AppAction, spec: AnyServerSpec, field?: string): boolean {
  const rule = ability.relevantRuleFor(action, subjectOf(spec), field)
  return rule != null && !rule.inverted
}

/** Not for `update`: a slot-level check would let a field-restricted grant bypass per-field intent. */
function assertCan(ability: AppAbility, slot: SlotName, spec: AnyServerSpec): void {
  const action = SLOT_ACTIONS[slot]
  if (!isGranted(ability, action, spec)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: `You do not have permission to ${action} ${spec.entityName}`,
    })
  }
}

/**
 * CASL field semantics: an unrestricted grant passes every field; a field-restricted grant
 * (`can('update', 'X', ['a', 'b'])`) passes only those; `manage all` passes every field.
 * Undefined values are skipped — "not attempting to write this field", same as the input shape.
 */
function assertCanUpdateFields(ability: AppAbility, spec: AnyServerSpec, data: Record<string, unknown>): void {
  for (const [field, value] of Object.entries(data)) {
    if (value === undefined) {
      continue
    }
    if (!isGranted(ability, 'update', spec, field)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: `You do not have permission to update ${spec.entityName}.${field}`,
      })
    }
  }
}
