import type { CustomerNote } from '@/shared/db/schema/customer-notes'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { buildUserContext, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { assertNoteAuthorOrAdmin } from '@/shared/entities/customer-notes/lib/assert-note-author'
import { customerNoteServerSpec } from '@/shared/entities/customer-notes/lib/server-spec'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'

/**
 * Stable CRUD handlers for the customer-notes entity. Hooks live here (config
 * factory), not on the spec. The factory receives `crudHandlers` — the very
 * handlers being built — so own-entity reads (`update.before`) call
 * `crudHandlers.getById(...)` directly. This DISSOLVES the old TDZ cycle: the
 * previous spec-hooks needed a lazy `await import('../dal/server/crud')` because
 * a top-level import of `customerNoteCrud` from a hook in `server-spec.ts` made
 * the spec module its own cycle entry point. The late-bound factory arg removes
 * that hazard entirely — no dynamic import required.
 */
export const customerNoteCrud = createCrudDal(customerNoteServerSpec, crudHandlers => ({
  hooks: {
    create: {
      // Probe the target customer is visible, and stamp authorId from the
      // session (closes the addNote scope gap — see issue #280).
      //
      // MUST probe with the CUSTOMER's own visibility, not `ctx.scope` (which
      // here is `customerNoteVisibility` — an EXISTS correlated on
      // `customer_notes.customer_id`). Reusing `ctx` as-is against
      // `customerCrud.getById` (`SELECT ... FROM customers WHERE ... AND
      // <scope>`) would reference `customer_notes` in a query that never
      // joins it — "missing FROM-clause entry" for every non-omni agent.
      // `buildUserContext` (the codebase's blessed idiom for a
      // differently-scoped probe — see
      // `features/customer-pipelines/dal/server/move-customer-pipeline-item.ts`)
      // rebuilds a context whose scope is `customerServerSpec.visibility`
      // instead. Omni callers and system/public writes (no session — Bina
      // ingest, intake) skip straight to SYSTEM_CONTEXT (unrestricted), since
      // there's no per-user visibility to apply.
      async before(input, ctx) {
        const userId = ctx.session?.user.id
        const isOmni = ctx.ability?.can('manage', 'all') ?? false
        const probeCtx = (!userId || isOmni)
          ? SYSTEM_CONTEXT
          : buildUserContext(userId, ctx.session!.user.role, customerServerSpec)

        const customer = dalVerifySuccess(await customerCrud.getById(probeCtx, { id: input.customerId }))
        if (!customer) {
          throw new ThrowableDalError({ type: 'not-found' })
        }

        return { ...input, authorId: userId ?? input.authorId ?? null }
      },
    },
    update: {
      // Own-entity read via the `crudHandlers` factory arg — no lazy import.
      // Only the author (or an admin) may edit note content.
      async before(data, ctx, { id }) {
        const note = dalVerifySuccess(await crudHandlers.getById(ctx, { id: String(id) }))
        if (!note) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        assertNoteAuthorOrAdmin(note, ctx)
        return data
      },
    },
    delete: {
      // G4: the engine prefetches the note row and hands it in — no getById,
      // no lazy import. Only the author (or an admin) may delete.
      async before(row: CustomerNote, ctx) {
        assertNoteAuthorOrAdmin(row, ctx)
      },
    },
  },
}))
