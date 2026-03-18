import { and, desc, eq, inArray } from 'drizzle-orm'

import { db } from '@/shared/db'
import { mediaFiles } from '@/shared/db/schema/media-files'
import { projects } from '@/shared/db/schema/projects'
import { x_projectScopes } from '@/shared/db/schema/x-project-scopes'

/**
 * Given an array of Notion scope IDs belonging to a trade,
 * finds matching public projects and returns their hero image URLs.
 *
 * Flow: scopeIds -> x_projectScopes -> projects (isPublic) -> mediaFiles (prefer hero)
 */
export async function getTradeImages(scopeNotionIds: string[]): Promise<string[]> {
  if (scopeNotionIds.length === 0) {
    return []
  }

  // 1. Find distinct project IDs linked to any of the given scope IDs
  const projectScopeRows = await db
    .selectDistinct({ projectId: x_projectScopes.projectId })
    .from(x_projectScopes)
    .where(inArray(x_projectScopes.scopeId, scopeNotionIds))

  const projectIds = projectScopeRows.map(r => r.projectId)
  if (projectIds.length === 0) {
    return []
  }

  // 2. Query media files for those projects (only public projects), preferring hero images
  const images = await db
    .select({
      url: mediaFiles.url,
      isHeroImage: mediaFiles.isHeroImage,
    })
    .from(mediaFiles)
    .innerJoin(projects, eq(mediaFiles.projectId, projects.id))
    .where(
      and(
        inArray(mediaFiles.projectId, projectIds),
        eq(projects.isPublic, true),
      ),
    )
    .orderBy(desc(mediaFiles.isHeroImage), mediaFiles.sortOrder)

  // 3. Deduplicate URLs
  const seen = new Set<string>()
  const urls: string[] = []
  for (const img of images) {
    if (!seen.has(img.url)) {
      seen.add(img.url)
      urls.push(img.url)
    }
  }

  return urls
}
