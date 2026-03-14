import type { ShowroomProjectDetail, ShowroomProjectScope, ShowroomProjectTrade } from '@/shared/entities/projects/types'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles, projects, scopes, trades, x_projectScopes } from '@/shared/db/schema'

export async function getShowroomProjectDetail(accessor: string): Promise<ShowroomProjectDetail | null> {
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.accessor, accessor), eq(projects.isPublic, true)))

  if (!project) {
    return null
  }

  // Fetch media and scope/trade associations in parallel
  const [media, scopeRows] = await Promise.all([
    db
      .select()
      .from(mediaFiles)
      .where(eq(mediaFiles.projectId, project.id))
      .orderBy(asc(mediaFiles.sortOrder), desc(mediaFiles.createdAt)),

    db
      .select({
        scopeId: scopes.id,
        scopeLabel: scopes.label,
        tradeId: trades.id,
        tradeLabel: trades.label,
      })
      .from(x_projectScopes)
      .innerJoin(scopes, eq(x_projectScopes.scopeId, scopes.id))
      .innerJoin(trades, eq(scopes.tradeId, trades.id))
      .where(eq(x_projectScopes.projectId, project.id))
      .orderBy(asc(trades.label), asc(scopes.label)),
  ])

  const projectScopes: ShowroomProjectScope[] = scopeRows.map(r => ({
    id: r.scopeId,
    label: r.scopeLabel,
    tradeId: r.tradeId,
  }))

  const tradeMap = new Map<number, ShowroomProjectTrade>()
  for (const row of scopeRows) {
    if (!tradeMap.has(row.tradeId)) {
      tradeMap.set(row.tradeId, { id: row.tradeId, label: row.tradeLabel })
    }
  }

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
    scopes: projectScopes,
    trades: Array.from(tradeMap.values()),
  }
}
