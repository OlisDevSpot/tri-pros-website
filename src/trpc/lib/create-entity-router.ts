// Top-level entity-router composer. see ../DOCS.md#entity-router-via-factory
// Side effect on call: registerEntity(spec). Duplicate registration throws.
// Canonical usage: src/trpc/routers/proposals.router/index.ts

import type { PgTable } from 'drizzle-orm/pg-core'

import type { createTRPCRouter } from '@/trpc/init'
import type { EntityServerSpec } from '@/trpc/types'

import { agentProcedure, baseProcedure } from '@/trpc/init'

import { registerEntity } from './entity-registry'
import { scopeMiddleware } from './middleware/scope-middleware'
import { shareableMiddleware } from './middleware/shareable-middleware'

type AnyRouter = ReturnType<typeof createTRPCRouter>

/**
 * Entity toolkit handed to the factory function. Real tRPC procedures, not
 * custom abstractions — full type inference + middleware composability.
 * CRUD is NOT on the toolkit — call `createCrudRouter()` directly in the
 * factory to preserve full type inference.
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

  // Cast: tRPC's ProcedureBuilder type changes after every .use() — the
  // augmented ctx makes the post-middleware type incompatible with the
  // pre-middleware type. tRPC provides no interface for "procedure builder
  // of any middleware depth." Their pattern is top-level const + typeof,
  // which doesn't work for our per-entity factory. The .input()/.query()/
  // .mutation() API is identical regardless — the cast restores the builder
  // API type for downstream consumers.
  const toolkit = {
    authedProcedure: scopedAgentProcedure as typeof agentProcedure,
    shareableProcedure: scopedShareableProcedure as typeof baseProcedure,
    publicProcedure: baseProcedure,
    spec,
  } as EntityToolkit<TSpec['table']>

  return factory(toolkit)
}
