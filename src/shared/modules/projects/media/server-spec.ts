import { defineSubEntitySpec } from '@/shared/dal/server/lib/define-spec'
import {
  insertProjectMediaFilesSchema,
  projectMediaFiles,
  selectProjectMediaFilesSchema,
} from '@/shared/db/schema/project-media-files'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { PROJECT_MEDIA_FILE } from '@/shared/modules/projects/media/lib/constants'

// The insert schema already `.partial()`s the server-derived/defaulted columns;
// update partials the rest so any subset is patchable (e.g. `{ name }`, `{ phase }`).
const updateProjectMediaFileSchema = insertProjectMediaFilesSchema.partial()

/** Concrete schemas for tRPC input inference (spec carries type-erased copies). */
export const projectMediaSchemas = {
  insert: insertProjectMediaFilesSchema,
  update: updateProjectMediaFileSchema,
}

/**
 * `media_files` (project media) as a first-class CHILD entity, parented to
 * `projects`. Like proposal media it declares NO own `visibility`; its effective
 * scope is the parent bridge `projectId IN (SELECT projects.id WHERE <project
 * participation scope>)`, folded into `ctx.scope` by a child-scoped procedure.
 *
 * NOTE (S5b): the project-media ROUTER still runs on a bare `agentProcedure`
 * (`ctx.scope = null`), so this CRUD DAL currently executes UNSCOPED there —
 * preserving today's behavior. Turning the bridge on (swapping to a child-scoped
 * procedure) is a deliberate security TIGHTENING, deferred to its own reviewed
 * slice. The spec/DAL are ready for that flip; nothing else needs to change.
 *
 * It is the field `media` of `Project`, with no subject of its own. The spec
 * itself carries no `hooks` — those live on `createCrudDal`'s
 * config factory in `dal/server/crud.ts`, where `create.after`/`delete.before`
 * fire optimize dispatch and R2 cleanup on every origin (C32, D5).
 */
export const projectMediaServerSpec = defineSubEntitySpec({
  entityName: PROJECT_MEDIA_FILE,
  parent: { spec: projectServerSpec, fk: projectMediaFiles.projectId, field: 'media' },
  table: projectMediaFiles,
  schemas: {
    insert: insertProjectMediaFilesSchema,
    update: updateProjectMediaFileSchema,
    select: selectProjectMediaFilesSchema,
  },
})
