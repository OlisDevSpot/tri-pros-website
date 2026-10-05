import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { InsertProject, Project } from '@/shared/db/schema'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { projectMediaFiles } from '@/shared/db/schema/project-media-files'
import { listMediaByOwner } from '@/shared/modules/media/core/dal/server/media-ops'
import { purgeMediaObject } from '@/shared/modules/media/core/lib/purge'
import { setProjectScopes } from '@/shared/modules/projects/core/dal/server/mutations'
import { projectServerSpec } from '@/shared/modules/projects/core/server-spec'
import { PROJECT_MEDIA } from '@/shared/modules/projects/media/lib/constants'

/**
 * Stable CRUD handlers for the projects entity. Sub-plan D routes the full
 * lifecycle through here — see `create/updateProjectWithScopes` below and the
 * `delete.before` R2-cleanup hook.
 */
export const projectCrud = createCrudDal(projectServerSpec, () => ({
  hooks: {
    delete: {
      // G4: the engine hands us the row. R2 media cleanup runs BEFORE the DB
      // cascade removes the project media rows. Non-atomic + partial-tolerant,
      // matching the pre-D order.
      //
      // scope: null is deliberate — the purge must be exhaustive. `ctx.scope` here
      // is the PROJECTS predicate; applying it to the media table would either
      // filter rows we must delete objects for, or produce a column mismatch.
      // A DAL may not import a service, so this reads through the media module's
      // table-generic DAL and purges through the leaf helper (C31, D1).
      async before(row: Project, ctx: ScopedContext) {
        const files = await listMediaByOwner(
          projectMediaFiles,
          projectMediaFiles.projectId,
          { ...ctx, scope: null },
          row.id,
        )
        if (!files.success) {
          // Fail loud: deleting the project without purging its media would orphan
          // every R2 object it owns, with no DB row left to find them by. Throwing
          // here surfaces through deleteImpl's dalDbOperation as a visible dalError.
          console.error(`[projectCrud.delete] media read failed for project ${row.id}; aborting delete`, files.error)
          throw new Error(`Failed to read project media for purge (project ${row.id})`)
        }
        await Promise.all(
          files.data.map(f => purgeMediaObject(f as { bucket: string | null, pathKey: string | null, optimizationVariants?: string[] | null }, PROJECT_MEDIA.variants)),
        )
      },
    },
  },
}))

/**
 * scopeIds is a CALL-SITE CLOSURE (G2 / §5.11), never engine input. Composes
 * projectCrud.create + an inline `after` child-set — non-atomic, matching the
 * pre-D order (tx deferred with crux-2). No factory hook models scopeIds.
 */
export async function createProjectWithScopes(
  ctx: ScopedContext,
  data: InsertProject,
  scopeIds: string[],
): Promise<DalReturn<Project>> {
  return projectCrud.create(ctx, data, {
    after: async (row) => {
      await setProjectScopes(row.id, scopeIds)
      return row
    },
  })
}

/**
 * Update a project and (optionally) replace its scope links.
 *
 * G7 subtlety: a scopes-only update passes `data: {}`, which the engine's
 * empty-`.set()` guard short-circuits — it returns the current row WITHOUT
 * bumping `updatedAt` and WITHOUT firing `after`. So the scopes-only branch
 * writes scopes directly and re-reads the row, rather than relying on the
 * `after` hook (which never runs on empty data). Non-scopes updates thread
 * `setProjectScopes` through the callsite `after` as usual.
 */
export async function updateProjectWithScopes(
  ctx: ScopedContext,
  id: string,
  data: Partial<InsertProject>,
  scopeIds?: string[],
): Promise<DalReturn<Project>> {
  const hasData = Object.values(data).some(v => v !== undefined)
  if (!hasData && scopeIds !== undefined) {
    // Scopes-only: the engine would no-op the update (G7) and skip `after`, so
    // set scopes directly. No projects-row write → updatedAt intentionally
    // unbumped (matches the old updateProject empty-data branch).
    await setProjectScopes(id, scopeIds)
    const current = await projectCrud.getById(ctx, { id })
    if (!current.success) {
      return current
    }
    if (!current.data) {
      return { success: false, error: { type: 'not-found' } }
    }
    return { success: true, data: current.data }
  }
  const after = scopeIds === undefined
    ? undefined
    : async (row: Project): Promise<Project> => {
      await setProjectScopes(row.id, scopeIds)
      return row
    }
  return projectCrud.update(ctx, { id, data }, { after })
}
