import type { EntityServerSpec } from '@/shared/dal/server/types'

import { buildUserContext, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import {
  customerNotes,
  insertCustomerNoteSchema,
  selectCustomerNoteSchema,
} from '@/shared/db/schema/customer-notes'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { assertNoteAuthorOrAdmin } from './assert-note-author'
import { CUSTOMER_NOTE } from './constants'
import { customerNoteVisibility } from './visibility'

// Only `content` is mutable; customerId/authorId are immutable after create.
const updateCustomerNoteSchema = insertCustomerNoteSchema.pick({ content: true })

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const customerNoteSchemas = {
  insert: insertCustomerNoteSchema,
  update: updateCustomerNoteSchema,
}

export const customerNoteServerSpec = {
  entityName: CUSTOMER_NOTE,
  caslSubject: CUSTOMER_NOTE,
  visibility: customerNoteVisibility,
  table: customerNotes,
  schemas: {
    insert: insertCustomerNoteSchema,
    update: updateCustomerNoteSchema,
    select: selectCustomerNoteSchema,
  },
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
      async before(data, ctx, { id }) {
        // Lazy import — `customerNoteCrud` (in `../dal/server/crud`) is built
        // from `createCrudDal(customerNoteServerSpec)`, i.e. from THIS module.
        // A top-level import here would make `server-spec.ts` the cycle entry
        // point whenever a caller imports the spec first (every entity router
        // does — see `src/trpc/routers/proposals.router/index.ts`), which
        // would run `crud.ts`'s `createCrudDal(customerNoteServerSpec)` while
        // `customerNoteServerSpec` is still in its TDZ. Deferring the import
        // into the hook body (evaluated well after module load) breaks the
        // cycle for good — `pnpm tsc` can't catch this class of bug, so don't
        // reintroduce a top-level import from `crud.ts` here.
        const { customerNoteCrud } = await import('../dal/server/crud')
        const note = dalVerifySuccess(await customerNoteCrud.getById(ctx, { id: String(id) }))
        if (!note) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        assertNoteAuthorOrAdmin(note, ctx)
        return data
      },
    },
    delete: {
      async before(id, ctx) {
        // see the update hook's comment above — same lazy-import requirement.
        const { customerNoteCrud } = await import('../dal/server/crud')
        const note = dalVerifySuccess(await customerNoteCrud.getById(ctx, { id: String(id) }))
        if (!note) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        assertNoteAuthorOrAdmin(note, ctx)
      },
    },
  },
} satisfies EntityServerSpec<typeof customerNotes>
