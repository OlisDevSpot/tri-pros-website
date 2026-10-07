import { z } from 'zod'

import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  customerNotes,
  insertCustomerNoteSchema,
  selectCustomerNoteSchema,
} from '@/shared/db/schema/customer-notes'
import { customerServerSpec } from '@/shared/entities/customers/lib/server-spec'
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

// The authorId stamp on create lives in the config factory in ../dal/server/crud.ts — NOT on this spec.
export const customerNoteServerSpec = defineEntitySpec({
  entityName: CUSTOMER_NOTE,
  subject: CUSTOMER_NOTE,
  conditionColumns: ['authorId'],
  parent: { spec: customerServerSpec, fk: customerNotes.customerId },
  table: customerNotes,
  schemas: {
    insert: insertCustomerNoteSchemaBounded,
    update: updateCustomerNoteSchema,
    select: selectCustomerNoteSchema,
  },
})
