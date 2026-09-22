import { unstable_cache } from 'next/cache'
import { pageToPainPoint } from '@/shared/modules/construction/sources/notion/pain-points/adapter'
import { queryNotionDatabase } from '@/shared/modules/construction/sources/notion/query'

export const getCachedPainPoints = unstable_cache(
  async () => {
    const raw = await queryNotionDatabase('painPoints')
    if (!raw) {
      return []
    }
    const painPoints = raw.flatMap(page => pageToPainPoint(page) ?? [])
    if (painPoints.length < raw.length) {
      console.warn(`[getCachedPainPoints] dropped ${raw.length - painPoints.length} of ${raw.length} pain points`)
    }
    return painPoints
  },
  ['notion-pain-points'],
  { tags: ['notion-pain-points'], revalidate: 600 },
)
