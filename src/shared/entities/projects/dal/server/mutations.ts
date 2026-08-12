import type { InsertProject, Project } from '@/shared/db/schema'
import type { R2BucketName } from '@/shared/services/providers/r2/types'

import { eq } from 'drizzle-orm'

import { db } from '@/shared/db'
import { mediaFiles, projects, x_projectScopes } from '@/shared/db/schema'
import { r2Client } from '@/shared/services/providers/r2/client'

/**
 * Delete-then-insert the x_projectScopes rows for a project. Shared by
 * `updateProject`'s scopes-provided branch; kept standalone so callers that
 * only need the scope link (no project-row write) can reach it directly.
 */
export async function setProjectScopes(projectId: string, scopeIds: string[]): Promise<void> {
  await db
    .delete(x_projectScopes)
    .where(eq(x_projectScopes.projectId, projectId))

  if (scopeIds.length > 0) {
    await db.insert(x_projectScopes).values(
      scopeIds.map(scopeId => ({
        projectId,
        scopeId,
      })),
    )
  }
}

export async function createProject(
  data: InsertProject,
  scopeIds: string[],
): Promise<Project> {
  const [project] = await db.insert(projects).values(data).returning()

  if (scopeIds.length > 0) {
    await db.insert(x_projectScopes).values(
      scopeIds.map(scopeId => ({
        projectId: project.id,
        scopeId,
      })),
    )
  }

  return project
}

export async function updateProject(
  projectId: string,
  data: Partial<InsertProject>,
  scopeIds?: string[],
): Promise<Project> {
  // `updatedAt` is NOT set manually here — the schema column stamps it via
  // `.$onUpdate()` (schema-helpers.ts), which Drizzle applies to every
  // `.update().set()` call regardless of whether `data` is empty (a
  // scopes-only update): `onUpdateFn` columns are force-included in the
  // generated SET clause even when absent from the object passed to `.set()`.
  // see memory/feedback-no-manual-updated-at.md
  const [project] = await db
    .update(projects)
    .set(data)
    .where(eq(projects.id, projectId))
    .returning()

  if (scopeIds !== undefined) {
    await setProjectScopes(projectId, scopeIds)
  }

  return project
}

export async function deleteProject(projectId: string): Promise<void> {
  // Delete R2 files before DB cascade removes the media file records
  const files = await db
    .select({ pathKey: mediaFiles.pathKey, bucket: mediaFiles.bucket })
    .from(mediaFiles)
    .where(eq(mediaFiles.projectId, projectId))

  await Promise.all(
    files
      .filter((f): f is { pathKey: string, bucket: string } => f.pathKey !== null && f.bucket !== null)
      .map(f => r2Client.deleteMediaWithVariants(f.bucket as R2BucketName, f.pathKey)),
  )

  await db.delete(projects).where(eq(projects.id, projectId))
}
