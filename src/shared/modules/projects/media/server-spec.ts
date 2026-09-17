import type { EntityServerSpec } from '@/shared/dal/server/types'

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
 * `caslSubject` reuses the parent `Project` subject. Serial int PK → `TId =
 * number`. No `hooks`: R2 cleanup + optimize dispatch are orchestration in
 * `mediaService`, which rings this DAL.
 */
export const projectMediaServerSpec = {
  entityName: PROJECT_MEDIA_FILE,
  caslSubject: projectServerSpec.caslSubject,
  parent: { spec: projectServerSpec, fk: projectMediaFiles.projectId },
  table: projectMediaFiles,
  schemas: {
    insert: insertProjectMediaFilesSchema,
    update: updateProjectMediaFileSchema,
    select: selectProjectMediaFilesSchema,
  },
} satisfies EntityServerSpec<typeof projectMediaFiles, number>
