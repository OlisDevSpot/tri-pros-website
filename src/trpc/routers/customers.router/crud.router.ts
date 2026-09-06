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
// see ../../../shared/entities/customers/DOCS.md#phone-visibility-threshold
//
// crud.update uses the framework's field-level CASL enforcement (in
// create-crud-router.ts). The agent CASL grant on 'Customer' is field-
// restricted to just `age` now (Addendum B, 2026-07-14) — the 23
// sales-discovery columns moved to the `customer_profiles` child table and go
// through `profile.upsert`, gated on the CustomerProfile subject instead.

import z from 'zod'

import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { getCustomer } from '@/shared/entities/customers/dal/server/queries'
import { customerSchemas, customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

import { createCrudRouter } from '../../lib/create-crud-router'
import { resolveTrpcActorScope } from '../../lib/middleware/resolve-trpc-actor-scope'

export const crudRouter = createCrudRouter({
  spec: customerServerSpec,
  schemas: { ...customerSchemas, id: z.string().uuid() },
  crud: customerCrud,
  // Phase-7 engine migration (epic S7): customer is the FIRST entity flipped
  // off the legacy visibility engine onto the CASL scope compiler. Its authed
  // slots (getById/update/delete/duplicate) now resolve `ctx.scope` from CASL
  // rules via `resolveTrpcActorScope` (→ resolveActorScope) instead of
  // `spec.visibility`/`customerVisibility`. This is what fixes dispatcher
  // customer edits: the legacy `customerVisibility` emitted `['leads']` only,
  // diverging from the widened CASL scope `['leads','rehash','dead','fresh']`,
  // so any UPDATE against a fresh/rehash/dead customer matched zero rows →
  // not-found → "Failed to update profile". `profile.upsert` + `business.list`
  // already ran on CASL; this brings the CRUD leaf into line. Read + mutation
  // scope are the SAME `read`-visibility predicate today (resolveActorScope is
  // read-only — action-awareness is Grill C, not needed here since Customer has
  // no own-record rule; field/verb auth stays in assertCanUpdateFields).
  // Once this lands, `customerServerSpec.visibility` / `customerVisibility` /
  // `userCanSeeCustomer` are dead code — deleted in Phase 8 with the engine.
  resolveScope: resolveTrpcActorScope,
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
