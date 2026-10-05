import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  applications,
  insertApplicationSchema,
  selectApplicationSchema,
} from '@/shared/db/schema'
import { APPLICATION } from '@/shared/entities/applications/lib/constants'
import { applicationVisibility } from '@/shared/entities/applications/lib/visibility'

// Type/meetingId come from input; status defaults to 'draft' at the column.
// No server-derived fields, so update simply partials the insert schema.
const updateApplicationSchema = insertApplicationSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const applicationSchemas = {
  insert: insertApplicationSchema,
  update: updateApplicationSchema,
}

export const applicationServerSpec = {
  entityName: APPLICATION,
  caslSubject: APPLICATION,
  visibility: applicationVisibility,
  table: applications,
  schemas: {
    insert: insertApplicationSchema,
    update: updateApplicationSchema,
    select: selectApplicationSchema,
  },
} satisfies EntityServerSpec<typeof applications>
