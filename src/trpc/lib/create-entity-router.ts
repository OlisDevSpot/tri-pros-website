// ─── createEntityRouter (L2) ────────────────────────────────────────────────
// Top-level composer. Takes an EntityServerSpec and a factory function that
// receives a pre-configured toolkit of tRPC procedures with scope middleware
// baked in. The factory returns a router — that's it.
//
// The toolkit provides:
//   - `authedProcedure`     — agentProcedure + scope middleware
//   - `shareableProcedure`  — baseProcedure + shareable middleware (token-or-session)
//   - `publicProcedure`     — baseProcedure pass-through
//   - `crud(options?)`      — generate the L1 CRUD sub-router with optional overrides
//   - `spec`                — the entity spec itself
//
// Usage:
// ```ts
// export const proposalsRouter = createEntityRouter(proposalServerSpec, (entity) =>
//   createTRPCRouter({
//     crud: entity.crud({ handlers: { create: customCreate } }),
//     business: createTRPCRouter({
//       list: entity.authedProcedure.input(listSchema).query(listHandler),
//     }),
//   })
// )
// ```
//
// Side effect on call: registerEntity(spec). Duplicate registration throws.

import type { PgTable } from 'drizzle-orm/pg-core'

import type { createTRPCRouter } from '@/trpc/init'
import type { CrudHandlers, EntityServerSpec, SlotName } from '@/trpc/types'

import { agentProcedure, baseProcedure } from '@/trpc/init'

import { createCrudRouter } from './create-crud-router'
import { registerEntity } from './entity-registry'
import { scopeMiddleware } from './middleware/scope-middleware'
import { shareableMiddleware } from './middleware/shareable-middleware'

// tRPC routers don't expose a clean public-facing supertype, so we infer
// the plugin return type from createTRPCRouter directly.
type AnyRouter = ReturnType<typeof createTRPCRouter>

/**
 * Entity toolkit — pre-configured procedures and utilities provided to the
 * entity's factory function. These are NOT custom abstractions: each procedure
 * IS a real tRPC procedure with full type inference and middleware composability.
 *
 * The procedure types are typed as `any` because tRPC's ProcedureBuilder type
 * is deeply generic and changes shape after `.use()` — the middleware chain
 * makes the exact type impractical to express. At runtime the procedures are
 * correct: they expose `.input()`, `.query()`, `.mutation()` etc.
 */
export interface EntityToolkit<TTable extends PgTable> {
  /** Agent-only procedure with visibility scope resolved. */
  authedProcedure: typeof agentProcedure
  /** Token-or-session procedure. Auto-resolves scope from token or session. */
  shareableProcedure: typeof baseProcedure
  /** No auth required. Pass-through of baseProcedure. */
  publicProcedure: typeof baseProcedure
  /** Generate CRUD sub-router with optional handler overrides and slot exclusions. */
  crud: (options?: { exclude?: SlotName[], handlers?: Partial<CrudHandlers<TTable>> }) => AnyRouter
  /** The entity spec itself, for sub-routers that need it. */
  spec: EntityServerSpec<TTable>
}

export function createEntityRouter<TSpec extends EntityServerSpec<PgTable>, TRouter extends AnyRouter>(
  spec: TSpec,
  factory: (entity: EntityToolkit<TSpec['table']>) => TRouter,
): TRouter {
  registerEntity(spec)

  // Build pre-configured procedures with scope middleware baked in.
  // These are real tRPC procedure builders — the factory uses them directly.
  //
  // The `as any` + `as typeof` double-cast is necessary because tRPC's
  // MiddlewareFunction is deeply generic (7+ type parameters tied to the
  // procedure builder chain). Our middleware factories return structurally
  // correct functions but can't satisfy the exact generic instantiation.
  // The outer `as typeof` cast restores the procedure builder API so the
  // toolkit consumer gets .input()/.query()/.mutation() type inference.
  const scopedAgentProcedure = agentProcedure
    .use(scopeMiddleware(spec) as never) as typeof agentProcedure
  const scopedShareableProcedure = baseProcedure
    .use(shareableMiddleware(spec) as never) as typeof baseProcedure

  // CRUD sub-router builder — delegates to L1 with pre-scoped procedures.
  const crud = (options?: { exclude?: SlotName[], handlers?: Partial<CrudHandlers<PgTable>> }) =>
    createCrudRouter(spec, {
      exclude: options?.exclude,
      handlers: options?.handlers,
      authedProcedure: scopedAgentProcedure,
      shareableProcedure: scopedShareableProcedure,
    }) as AnyRouter

  const toolkit: EntityToolkit<TSpec['table']> = {
    authedProcedure: scopedAgentProcedure,
    shareableProcedure: scopedShareableProcedure,
    publicProcedure: baseProcedure,
    crud: crud as EntityToolkit<TSpec['table']>['crud'],
    spec,
  }

  return factory(toolkit) as TRouter
}
