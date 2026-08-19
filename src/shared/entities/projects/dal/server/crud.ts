import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { InsertProject, Project } from '@/shared/db/schema'
import type { R2BucketName } from '@/shared/services/providers/r2/types'

import { eq } from 'drizzle-orm'

import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema'
import { setProjectScopes } from '@/shared/entities/projects/dal/server/mutations'
import { projectServerSpec } from '@/shared/entities/projects/lib/server-spec'
import { r2Client } from '@/shared/services/providers/r2/client'

/**
 * Stable CRUD handlers for the projects entity. Sub-plan D routes the full
 * lifecycle through here — see `create/updateProjectWithScopes` below and the
 * `delete.before` R2-cleanup hook.
 */
export const projectCrud = createCrudDal(projectServerSpec, () => ({
  hooks: {
    delete: {
      // G4: the engine hands us the row. R2 media cleanup runs BEFORE the DB
      // cascade removes the media_files rows (moved verbatim from the old
      // deleteProject). Non-atomic + partial-tolerant, matching the pre-D order.
      async before(row: Project) {
        const files = await db
          .select({ pathKey: mediaFiles.pathKey, bucket: mediaFiles.bucket })
          .from(mediaFiles)
          .where(eq(mediaFiles.projectId, row.id))

        await Promise.all(
          files
            .filter((f): f is { pathKey: string, bucket: string } => f.pathKey !== null && f.bucket !== null)
            .map(f => r2Client.deleteMediaWithVariants(f.bucket as R2BucketName, f.pathKey)),
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
