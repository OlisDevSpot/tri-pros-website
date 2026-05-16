// ─── createEntityRouter (L2) ────────────────────────────────────────────────
// Top-level composer. Takes an EntityServerSpec and any number of plugin
// factories, registers the spec, auto-mounts the L1 CRUD sub-router under
// key `crud`, and mounts each plugin under its key in the returned router.
//
// Plugin signature: (spec) => Router. Plugins are factories so they can
// reach for `createCrudHandlers(spec)` and compose with L0 slots inside
// their own procedure bodies.
//
// Side effect on call: registerEntity(spec). Duplicate registration throws.

import type { PgTable } from 'drizzle-orm/pg-core'

import type { EntityServerSpec } from '@/trpc/types'

import { createTRPCRouter } from '@/trpc/init'

import { createCrudRouter } from './create-crud-router'
import { registerEntity } from './entity-registry'

// tRPC routers don't expose a clean public-facing supertype, so we infer
// the plugin return type from createTRPCRouter directly.
type AnyRouter = ReturnType<typeof createTRPCRouter>

type PluginFactory<TSpec> = (spec: TSpec) => AnyRouter

export function createEntityRouter<TSpec extends EntityServerSpec<PgTable>>(
  spec: TSpec,
  plugins: Record<string, PluginFactory<TSpec>> = {},
) {
  registerEntity(spec)

  const composed: Record<string, AnyRouter> = {
    crud: createCrudRouter(spec) as AnyRouter,
  }

  for (const [key, factory] of Object.entries(plugins)) {
    if (key === 'crud') {
      throw new Error(
        `[create-entity-router] Plugin key 'crud' is reserved. Used by the auto-mounted `
        + `CRUD sub-router for '${spec.entityName}'.`,
      )
    }
    composed[key] = factory(spec)
  }

  return createTRPCRouter(composed)
}
