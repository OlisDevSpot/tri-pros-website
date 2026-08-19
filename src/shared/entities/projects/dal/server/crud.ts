import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'

/**
 * Stable CRUD handlers for the projects entity. Sub-plan D routes the full
 * lifecycle through here — see `create/updateProjectWithScopes` below and the
 * `delete.before` R2-cleanup hook.
 */
export const projectCrud = createCrudDal(projectServerSpec)
