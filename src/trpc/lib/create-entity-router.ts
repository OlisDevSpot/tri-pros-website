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
  // so .use() accepts it natively — no `as never` casts.
  const scopedAgentProcedure = agentProcedure.use(scopeMiddleware(spec))
  const scopedShareableProcedure = baseProcedure.use(shareableMiddleware(spec))

  // Controlled cast at the toolkit boundary. After .use(middleware), tRPC's
  // ProcedureBuilder type changes shape (augmented ctx). The EntityToolkit
  // interface uses `typeof agentProcedure` / `typeof baseProcedure` for
  // consumer ergonomics — .input()/.query()/.mutation() still work identically.
  // This is the ONLY place these casts exist.
  const toolkit = {
    authedProcedure: scopedAgentProcedure as typeof agentProcedure,
    shareableProcedure: scopedShareableProcedure as typeof baseProcedure,
    publicProcedure: baseProcedure,
    spec,
  } as EntityToolkit<TSpec['table']>

  return factory(toolkit)
}
