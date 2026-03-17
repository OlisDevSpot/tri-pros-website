import type { ShowroomProject } from '@/shared/entities/projects/types'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles, projects, x_projectScopes } from '@/shared/db/schema'

export async function getShowroomProjects(): Promise<ShowroomProject[]> {
  const rows = await db
    .select({
      project: projects,
      heroImage: mediaFiles,
    })
    .from(projects)
    .leftJoin(
      mediaFiles,
      and(
        eq(mediaFiles.projectId, projects.id),
        eq(mediaFiles.isHeroImage, true),
      ),
    )
    .where(eq(projects.isPublic, true))
    .orderBy(asc(projects.title))

  // Deduplicate: one row per project (take the first hero image match)
  const seen = new Set<string>()
  const uniqueRows = rows.filter((row) => {
    if (seen.has(row.project.id)) {
      return false
    }
    seen.add(row.project.id)
    return true
  })

  if (uniqueRows.length === 0) {
    return []
  }

  // Fetch scope IDs (Notion UUIDs) for all projects
  const scopeRows = await db
    .select({
      projectId: x_projectScopes.projectId,
      scopeId: x_projectScopes.scopeId,
    })
    .from(x_projectScopes)

  // Group scope IDs by project
  const scopesByProject = new Map<string, string[]>()
  for (const row of scopeRows) {
    if (!scopesByProject.has(row.projectId)) {
      scopesByProject.set(row.projectId, [])
    }
    scopesByProject.get(row.projectId)!.push(row.scopeId)
  }

  return uniqueRows.map(row => ({
    project: row.project,
    heroImage: row.heroImage,
    scopeIds: scopesByProject.get(row.project.id) ?? [],
  }))
}
