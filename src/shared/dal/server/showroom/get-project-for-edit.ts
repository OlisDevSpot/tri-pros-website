import type { MediaFile, Project } from '@/shared/db/schema'
import { eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles, projects, x_projectScopes } from '@/shared/db/schema'

export interface ProjectForEdit {
  project: Project
  scopeIds: number[]
  media: MediaFile[]
}

export async function getProjectForEdit(projectId: string): Promise<ProjectForEdit | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))

  if (!project) {
    return null
  }

  const [scopeRows, media] = await Promise.all([
    db
      .select({ scopeId: x_projectScopes.scopeId })
      .from(x_projectScopes)
      .where(eq(x_projectScopes.projectId, projectId)),
    db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.projectId, projectId))
      .orderBy(mediaFiles.sortOrder, mediaFiles.createdAt),
  ])

  return {
    project,
    scopeIds: scopeRows.map(r => r.scopeId),
    media,
  }
}
