import type { ShowroomProjectDetail } from '@/shared/entities/projects/types'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles, projects, x_projectScopes } from '@/shared/db/schema'

export async function getShowroomProjectDetail(accessor: string): Promise<ShowroomProjectDetail | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.accessor, accessor), eq(projects.isPublic, true)))

  if (!project) {
    return null
  }

  const [media, scopeRows] = await Promise.all([
    db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.projectId, project.id))
      .orderBy(asc(mediaFiles.sortOrder), desc(mediaFiles.createdAt)),

    db
      .select({ scopeId: x_projectScopes.scopeId })
      .from(x_projectScopes)
      .where(eq(x_projectScopes.projectId, project.id)),
  ])

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
    scopeIds: scopeRows.map(r => r.scopeId),
  }
}
