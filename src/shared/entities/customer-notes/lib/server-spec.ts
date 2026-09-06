import type { EntityServerSpec } from '@/shared/dal/server/types'

import { z } from 'zod'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { canAccess } from '@/shared/dal/server/lib/resolve-actor-scope'
import { ThrowableDalError } from '@/shared/dal/server/types'
import {
  customerNotes,
  insertCustomerNoteSchema,
  selectCustomerNoteSchema,
} from '@/shared/db/schema/customer-notes'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
import { assertNoteAuthorOrAdmin } from './assert-note-author'
import { CUSTOMER_NOTE } from './constants'

// `createInsertSchema` derives bounds from the Drizzle column (text — no
// length limit), so `content` needs an explicit bound here. Restores the
// `.min(1).max(2000)` the deleted `addNote` procedure enforced — otherwise a
// direct API caller could write empty or arbitrarily long note content.
const boundedContent = z.string().min(1).max(2000)
const insertCustomerNoteSchemaBounded = insertCustomerNoteSchema.extend({ content: boundedContent })
// Only `content` is mutable; customerId/authorId are immutable after create.
const updateCustomerNoteSchema = insertCustomerNoteSchemaBounded.pick({ content: true })

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const customerNoteSchemas = {
  insert: insertCustomerNoteSchemaBounded,
  update: updateCustomerNoteSchema,
}

export const customerNoteServerSpec = {
  entityName: CUSTOMER_NOTE,
  caslSubject: CUSTOMER_NOTE,
  parent: { spec: customerServerSpec, fk: customerNotes.customerId },
  table: customerNotes,
  schemas: {
    insert: insertCustomerNoteSchemaBounded,
    update: updateCustomerNoteSchema,
    select: selectCustomerNoteSchema,
  },
  hooks: {
    create: {
      // Probe the target customer is visible, and stamp authorId from the
      // session (closes the addNote scope gap — see issue #280).
      //
      // Single-engine probe via `canAccess`: it compiles the ACTOR's CASL
      // Customer scope directly (system/omni → allow-all, dispatcher → the
      // operational pipeline incl. `fresh`, agent → participation) and runs a
      // point-read `SELECT 1 FROM customers WHERE id = ? AND <scope>`. This
      // replaces the legacy `buildUserContext` / `customerVisibility` probe,
      // whose dispatcher branch was hard-coded to `['leads']` and diverged from
      // the widened CASL role scope — NOT_FOUND'ing dispatchers on every
      // non-`leads` customer. The legacy read engine (and this whole class of
      // hand-rolled probes) is retired uniformly in Grill B/C — see
      // docs/plans/2026-08-10-casl-scope-compiler-epic.md.
      async before(input, ctx) {
        if (!(await canAccess(customerServerSpec, ctx.actor, input.customerId))) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        const userId = ctx.session?.user.id
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
