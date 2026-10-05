import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertLeadSourceSchema,
  leadSourcesTable,
  selectLeadSourceSchema,
} from '@/shared/db/schema/lead-sources'
import { LEAD_SOURCE } from './constants'
import { leadSourceVisibility } from './visibility'

// `insertLeadSourceSchema` requires slug + token (notNull, no default); the
// config factory's create.before generates both, so the schema validates the
// ENRICHED post-hook data. Update partials the insert schema.
const updateLeadSourceSchema = insertLeadSourceSchema.partial()

export const leadSourceSchemas = {
  insert: insertLeadSourceSchema,
  update: updateLeadSourceSchema,
}

// Lifecycle logic (unique-slug + token generation on create, slug-rotation
// token-refresh on update, attached-customer delete precondition, duplicate
// copy semantics) lives in the config factory in ../dal/server/crud.ts.
export const leadSourceServerSpec = {
  entityName: LEAD_SOURCE,
  caslSubject: LEAD_SOURCE,
  visibility: leadSourceVisibility,
  table: leadSourcesTable,
  schemas: {
    insert: insertLeadSourceSchema,
    update: updateLeadSourceSchema,
    select: selectLeadSourceSchema,
  },
} satisfies EntityServerSpec<typeof leadSourcesTable>
