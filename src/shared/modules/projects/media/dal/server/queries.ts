import type { MediaPhaseCounts } from '@/shared/modules/projects/media/types'
import { and, count, inArray, notLike } from 'drizzle-orm'
import { mediaPhases } from '@/shared/constants/enums/media'
import { db } from '@/shared/db'
import { projectMediaFiles } from '@/shared/db/schema'

/** Every requested id is in the result. Videos are left out, as the portfolio detail's phase groups leave them out. */
export async function getMediaPhaseCountsByProjectIds(projectIds: string[]): Promise<Map<string, MediaPhaseCounts>> {
  const counts = new Map(projectIds.map(id => [id, Object.fromEntries(mediaPhases.map(phase => [phase, 0])) as MediaPhaseCounts]))
  if (projectIds.length === 0) {
    return counts
  }

  const rows = await db
    .select({ projectId: projectMediaFiles.projectId, phase: projectMediaFiles.phase, total: count() })
    .from(projectMediaFiles)
    .where(and(inArray(projectMediaFiles.projectId, projectIds), notLike(projectMediaFiles.mimeType, 'video/%')))
    .groupBy(projectMediaFiles.projectId, projectMediaFiles.phase)

  for (const row of rows) {
    const entry = counts.get(row.projectId)
    if (entry) {
      entry[row.phase] = row.total
    }
  }
  return counts
}
