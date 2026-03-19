import { and, count, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema/media-files'
import { projects } from '@/shared/db/schema/projects'
import { x_projectScopes } from '@/shared/db/schema/x-project-scopes'

/**
 * Given an array of Notion scope IDs belonging to a trade,
 * finds matching public projects and returns their hero image URLs.
 * Single-trade projects are prioritized to avoid cross-trade image bleed.
 *
 * Flow: scopeIds -> x_projectScopes -> projects (isPublic) -> mediaFiles (prefer hero)
 */
export async function getTradeImages(scopeNotionIds: string[]): Promise<string[]> {
  if (scopeNotionIds.length === 0) {
    return []
  }

  // 1. Find project IDs linked to any of the given scope IDs, with matching scope count
  const matchingRows = await db
    .select({ projectId: x_projectScopes.projectId, matchCount: count() })
    .from(x_projectScopes)
    .where(inArray(x_projectScopes.scopeId, scopeNotionIds))
    .groupBy(x_projectScopes.projectId)

  const projectIds = matchingRows.map(r => r.projectId)
  if (projectIds.length === 0) {
    return []
  }

  // 2. Count total scopes per project to identify single-trade vs multi-trade projects
  const totalRows = await db
    .select({ projectId: x_projectScopes.projectId, totalCount: count() })
    .from(x_projectScopes)
    .where(inArray(x_projectScopes.projectId, projectIds))
    .groupBy(x_projectScopes.projectId)

  const totalMap = new Map(totalRows.map(r => [r.projectId, r.totalCount]))
  const matchMap = new Map(matchingRows.map(r => [r.projectId, r.matchCount]))
  const singleTradeIds = projectIds.filter(id => matchMap.get(id) === totalMap.get(id))
  const multiTradeIds = projectIds.filter(id => matchMap.get(id) !== totalMap.get(id))

  // 3. Fetch images — single-trade projects first (run in parallel)
  const fetchImages = (ids: string[]) =>
    ids.length === 0
      ? Promise.resolve([])
      : db
          .select({ url: mediaFiles.url })
          .from(mediaFiles)
          .innerJoin(projects, eq(mediaFiles.projectId, projects.id))
          .where(and(
            inArray(mediaFiles.projectId, ids),
            eq(projects.isPublic, true),
          ))
          .orderBy(desc(mediaFiles.isHeroImage), mediaFiles.sortOrder)

  const [singleTradeImages, multiTradeImages] = await Promise.all([
    fetchImages(singleTradeIds),
    fetchImages(multiTradeIds),
  ])

  // 4. Deduplicate URLs, single-trade results first
  const seen = new Set<string>()
  const urls: string[] = []
  for (const img of [...singleTradeImages, ...multiTradeImages]) {
    if (!seen.has(img.url)) {
      seen.add(img.url)
      urls.push(img.url)
    }
  }

  return urls
}
