import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertMediaFilesSchema,
  mediaFiles,
  selectMediaFilesSchema,
} from '@/shared/db/schema/media-files'
import { MEDIA_FILE } from '@/shared/entities/media-files/lib/constants'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'

// The insert schema already `.partial()`s the server-derived/defaulted columns;
// update partials the rest so any subset is patchable (e.g. `{ name }`, `{ phase }`).
const updateMediaFileSchema = insertMediaFilesSchema.partial()

/** Concrete schemas for tRPC input inference (spec carries type-erased copies). */
export const mediaFileSchemas = {
  insert: insertMediaFilesSchema,
  update: updateMediaFileSchema,
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
export const mediaFileServerSpec = {
  entityName: MEDIA_FILE,
  caslSubject: projectServerSpec.caslSubject,
  parent: { spec: projectServerSpec, fk: mediaFiles.projectId },
  table: mediaFiles,
  schemas: {
    insert: insertMediaFilesSchema,
    update: updateMediaFileSchema,
    select: selectMediaFilesSchema,
  },
} satisfies EntityServerSpec<typeof mediaFiles, number>
