import type { EntityServerSpec } from '@/shared/dal/server/types'

import { z } from 'zod'

import {
  customerNotes,
  insertCustomerNoteSchema,
  selectCustomerNoteSchema,
} from '@/shared/db/schema/customer-notes'
import { CUSTOMER_NOTE } from './constants'
import { customerNoteVisibility } from './visibility'

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

// Lifecycle hooks (customer-visibility probe + authorId stamp on create,
// author-gate on update/delete) live in the config factory in
// ../dal/server/crud.ts — NOT on this spec. That factory takes `crudHandlers`
// as an arg, which is why the old TDZ-avoiding lazy import is gone.
export const customerNoteServerSpec = {
  entityName: CUSTOMER_NOTE,
  caslSubject: CUSTOMER_NOTE,
  visibility: customerNoteVisibility,
  table: customerNotes,
  schemas: {
    insert: insertCustomerNoteSchemaBounded,
    update: updateCustomerNoteSchema,
    select: selectCustomerNoteSchema,
  },
} satisfies EntityServerSpec<typeof customerNotes>
