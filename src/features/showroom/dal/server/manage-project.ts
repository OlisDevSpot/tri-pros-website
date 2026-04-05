import type { InsertProject, Project } from '@/shared/db/schema'
import type { R2BucketName } from '@/shared/services/r2/buckets'

import { asc, eq, inArray } from 'drizzle-orm'

import { db } from '@/shared/db'
import { mediaFiles, projects, x_projectScopes } from '@/shared/db/schema'
import { deleteMediaWithVariants } from '@/shared/services/r2/lib/delete-media-with-variants'

export async function createShowroomProject(
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

export async function updateShowroomProject(
  projectId: string,
  data: Partial<InsertProject>,
  scopeIds?: string[],
): Promise<Project> {
  const [project] = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(projects.id, projectId))
    .returning()

  if (scopeIds !== undefined) {
    // Delete existing scope associations
    await db
      .delete(x_projectScopes)
      .where(eq(x_projectScopes.projectId, projectId))

    // Insert new scope associations
    if (scopeIds.length > 0) {
      await db.insert(x_projectScopes).values(
        scopeIds.map(scopeId => ({
          projectId,
          scopeId,
        })),
      )
    }
  }

  return project
}

export async function deleteShowroomProject(projectId: string): Promise<void> {
  // Delete R2 files before DB cascade removes the media file records
  const files = await db
    .select({ pathKey: mediaFiles.pathKey, bucket: mediaFiles.bucket })
    .from(mediaFiles)
    .where(eq(mediaFiles.projectId, projectId))

  await Promise.all(
    files.map(f => deleteMediaWithVariants(f.bucket as R2BucketName, f.pathKey)),
  )

  await db.delete(projects).where(eq(projects.id, projectId))
}

interface ProjectWithScopeIds extends Project {
  scopeIds: string[]
}

export async function getAllProjects(): Promise<ProjectWithScopeIds[]> {
  const rows = await db
    .select()
    .from(projects)
    .orderBy(asc(projects.title))

  const scopeRows = rows.length > 0
    ? await db
        .select({
          projectId: x_projectScopes.projectId,
          scopeId: x_projectScopes.scopeId,
        })
        .from(x_projectScopes)
        .where(inArray(x_projectScopes.projectId, rows.map(r => r.id)))
    : []

  const scopesByProject = new Map<string, string[]>()
  for (const row of scopeRows) {
    if (!scopesByProject.has(row.projectId)) {
      scopesByProject.set(row.projectId, [])
    }
    scopesByProject.get(row.projectId)!.push(row.scopeId)
  }

  return rows.map(project => ({
    ...project,
    scopeIds: scopesByProject.get(project.id) ?? [],
  }))
}
