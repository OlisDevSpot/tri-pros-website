import { unstable_cache } from 'next/cache'
import { queryNotionDatabase } from '@/shared/services/notion/dal/query-notion-database'
import { pageToPainPoint } from '@/shared/services/notion/lib/pain-points/adapter'

export const getCachedPainPoints = unstable_cache(
  async () => {
    const raw = await queryNotionDatabase('painPoints')
    return raw ? raw.map(pageToPainPoint) : []
  },
  ['notion-pain-points'],
  { tags: ['notion-pain-points'], revalidate: 600 },
)
