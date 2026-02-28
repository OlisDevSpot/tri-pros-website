import type { Project, SelectMediaFilesSchema } from '@/shared/db/schema'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles, projects } from '@/shared/db/schema'

export interface PublicProject { project: Project, heroImage: SelectMediaFilesSchema | null }

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
    .orderBy(desc(projects.createdAt))

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

export interface ProjectMediaGroups {
  hero: SelectMediaFilesSchema[]
  before: SelectMediaFilesSchema[]
  during: SelectMediaFilesSchema[]
  after: SelectMediaFilesSchema[]
  main: SelectMediaFilesSchema[]
  videos: SelectMediaFilesSchema[]
  all: SelectMediaFilesSchema[]
}

export type ProjectDetail = { project: Project, media: ProjectMediaGroups } | null

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
      main: media.filter(f => f.phase === 'main' && !f.mimeType.startsWith('video/')),
      videos: media.filter(f => f.mimeType.startsWith('video/')),
      all: media,
    },
  }
}
