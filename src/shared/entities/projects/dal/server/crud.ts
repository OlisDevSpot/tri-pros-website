import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'

/**
 * Stable CRUD handlers for the projects entity. Single instance, fully typed.
 *
 * Row-level foundation (S5a): `getById`/`update`/`delete`/`duplicate` compose
 * `ctx.scope` (project participation) automatically. Lifecycle side-effects
 * (x_projectScopes, R2 media cleanup on delete) are NOT here yet — they stay in
 * `features/project-management/dal/server/manage-project.ts` until the projects
 * router migrates onto `createCrudRouter` (S8). See `../../lib/server-spec.ts`.
 */
export const projectCrud = createCrudDal(projectServerSpec)
