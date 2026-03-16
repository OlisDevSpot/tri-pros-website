import type { InsertProject, Project } from '@/shared/db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { projects, x_projectScopes } from '@/shared/db/schema'

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
  await db.delete(projects).where(eq(projects.id, projectId))
}

export async function getAllProjects(): Promise<Project[]> {
  return db
    .select()
    .from(projects)
    .orderBy(projects.createdAt)
}
