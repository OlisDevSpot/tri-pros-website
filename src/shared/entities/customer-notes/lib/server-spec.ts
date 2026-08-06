import type { EntityServerSpec } from '@/shared/dal/server/types'

import { dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { ThrowableDalError } from '@/shared/dal/server/types'
import {
  customerNotes,
  insertCustomerNoteSchema,
  selectCustomerNoteSchema,
} from '@/shared/db/schema/customer-notes'
import { customerCrud } from '@/shared/entities/customers/dal/server/crud'
import { customerNoteCrud } from '../dal/server/crud'
import { assertNoteAuthorOrAdmin } from './assert-note-author'
import { CUSTOMER_NOTE } from './constants'
import { customerNoteVisibility } from './visibility'

// Circular import note: `customerNoteCrud` above (from `../dal/server/crud`)
// is itself built from `customerNoteServerSpec` in this module — a
// same-entity cycle (unlike the `customers` spec importing `meetingCrud`,
// which is cross-entity). This resolves fine: `customerNoteCrud` is only
// referenced inside the async hook bodies below, never at module-evaluation
// time, so by the time a hook actually runs, `crud.ts`'s export has long
// since been assigned. If `pnpm tsc` ever surfaces a genuine cycle error,
// switch to a lazy `await import('../dal/server/crud')` inside the hook body.

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
      // Probe the target customer against ctx.scope (closes the addNote scope
      // gap — see issue #280), and stamp authorId from the session. System/
      // public writes (Bina ingest, intake) leave authorId null/caller-supplied.
      async before(input, ctx) {
        dalVerifySuccess(await customerCrud.getById(ctx, { id: input.customerId }))
        return { ...input, authorId: ctx.session?.user.id ?? input.authorId ?? null }
      },
    },
    update: {
      async before(data, ctx, { id }) {
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
        const note = dalVerifySuccess(await customerNoteCrud.getById(ctx, { id: String(id) }))
        if (!note) {
          throw new ThrowableDalError({ type: 'not-found' })
        }
        assertNoteAuthorOrAdmin(note, ctx)
      },
    },
  },
} satisfies EntityServerSpec<typeof customerNotes>
