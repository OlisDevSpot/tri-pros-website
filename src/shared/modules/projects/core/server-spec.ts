import { defineEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertProjectSchema,
  projects,
  selectProjectSchema,
} from '@/shared/db/schema'
import { PROJECT } from '@/shared/modules/projects/core/lib/constants'

// `scopeIds` is not a `projects` column: it rides beside the row through `create/updateProjectWithScopes`.
const updateProjectSchema = insertProjectSchema.partial()

/** Concrete schemas for `createCrudRouter` type inference (spec carries type-erased copies). */
export const projectSchemas = {
  insert: insertProjectSchema,
  update: updateProjectSchema,
}

export const projectServerSpec = defineEntitySpec({
  entityName: PROJECT,
  subject: PROJECT,
  conditionColumns: [],
  table: projects,
  schemas: {
    insert: insertProjectSchema,
    update: updateProjectSchema,
    select: selectProjectSchema,
  },
})
