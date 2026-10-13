// ─── Customers CRUD Router ───────────────────────────────────────────────────
// The 5 single-row operations. Plain leaf: createCrudRouter builds its scoped
// procedures inline from the spec (no createEntityRouter, no cast — epic S6a).
//
// spec.hooks.delete.before cascades meeting and proposal deletes before the
// customer row is removed; spec.hooks.update.before resets the geocode cache
// when address fields change. (leadMeta jsonbMergeColumns registration was
// removed in Wave-2 — the blob is frozen; attribution + enrichment are their
// own child tables now.)
//
// crud.getById is overridden to return the phone-gated row shape — the default
// handler from createCrudDal does a plain SELECT * which would include the
// ungated phone column, violating phone-visibility-threshold.
//
// crud.update: the engine checks each changed column against the loaded row. The agent grant on 'Customer' covers `age` and the discovery profile (the `profile` part); dispatchers hold the contact fields.

import z from 'zod'

import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { getCustomer } from '@/shared/entities/customers/dal/server/queries'
import { customerSchemas, customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'

export const crudRouter = createCrudRouter({
  spec: customerServerSpec,
  schemas: { ...customerSchemas, id: z.string().uuid() },
  crud: customerCrud,
  handlers: {
    // Cast: getCustomer returns CustomerWithProfile (a structural superset of
    // Row<typeof customers> — phone-gated + flattened-spread joined against
    // customer_profiles). The CrudHandlers contract types getById as
    // Row<TTable> | undefined — the extra fields are harmless (callers that
    // don't read them see the standard row shape). The framework-level type for
    // handlers.getById doesn't admit phantom enrichments, so the cast is necessary.
    getById: async (ctx, input) => getCustomer(ctx, input) as ReturnType<typeof customerCrud.getById>,
  },
})
