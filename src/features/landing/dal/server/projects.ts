import type { ProjectDetail, PublicProject } from '@/shared/entities/projects/types'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles, projects } from '@/shared/db/schema'

export async function getPublicProjects(): Promise<PublicProject[]> {
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
  return rows.filter((row) => {
    if (seen.has(row.project.id)) {
      return false
    }
    seen.add(row.project.id)
    return true
  })
}

export async function getProjectByAccessor(accessor: string): Promise<ProjectDetail> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.accessor, accessor), eq(projects.isPublic, true)))

  if (!project) {
    return null
  }

  const media = await db
    .select()
    .from(mediaFiles)
    .where(eq(mediaFiles.projectId, project.id))
    .orderBy(asc(mediaFiles.sortOrder), desc(mediaFiles.createdAt))

  return {
    project,
    media: {
      hero: media.filter(f => f.isHeroImage),
      before: media.filter(f => f.phase === 'before' && !f.mimeType.startsWith('video/')),
      during: media.filter(f => f.phase === 'during' && !f.mimeType.startsWith('video/')),
      after: media.filter(f => f.phase === 'after' && !f.mimeType.startsWith('video/')),
      uncategorized: media.filter(f => f.phase === 'uncategorized' && !f.mimeType.startsWith('video/')),
      videos: media.filter(f => f.mimeType.startsWith('video/')),
      all: media,
    },
  }
}
