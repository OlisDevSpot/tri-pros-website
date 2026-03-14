import type { ShowroomProject, ShowroomProjectScope, ShowroomProjectTrade } from '@/shared/entities/projects/types'
import { and, asc, desc, eq } from 'drizzle-orm'
import { db } from '@/shared/db'
import { mediaFiles, projects, scopes, trades, x_projectScopes } from '@/shared/db/schema'

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
    .orderBy(desc(projects.createdAt))

  // Deduplicate: one row per project (take the first hero image match)
  const seen = new Set<string>()
  const uniqueRows = rows.filter((row) => {
    if (seen.has(row.project.id)) {
      return false
    }
    seen.add(row.project.id)
    return true
  })

  const projectIds = uniqueRows.map(r => r.project.id)

  if (projectIds.length === 0) {
    return []
  }

  // Fetch scope/trade associations for all projects in one query
  const scopeRows = await db
    .select({
      projectId: x_projectScopes.projectId,
      scopeId: scopes.id,
      scopeLabel: scopes.label,
      tradeId: trades.id,
      tradeLabel: trades.label,
    })
    .from(x_projectScopes)
    .innerJoin(scopes, eq(x_projectScopes.scopeId, scopes.id))
    .innerJoin(trades, eq(scopes.tradeId, trades.id))
    .orderBy(asc(trades.label), asc(scopes.label))

  // Group scope/trade data by project
  const scopesByProject = new Map<string, { scopes: ShowroomProjectScope[], trades: ShowroomProjectTrade[] }>()
  for (const row of scopeRows) {
    if (!scopesByProject.has(row.projectId)) {
      scopesByProject.set(row.projectId, { scopes: [], trades: [] })
    }
    const entry = scopesByProject.get(row.projectId)!
    entry.scopes.push({ id: row.scopeId, label: row.scopeLabel, tradeId: row.tradeId })
    if (!entry.trades.some(t => t.id === row.tradeId)) {
      entry.trades.push({ id: row.tradeId, label: row.tradeLabel })
    }
  }

  return uniqueRows.map(row => ({
    project: row.project,
    heroImage: row.heroImage,
    trades: scopesByProject.get(row.project.id)?.trades ?? [],
    scopes: scopesByProject.get(row.project.id)?.scopes ?? [],
  }))
}
