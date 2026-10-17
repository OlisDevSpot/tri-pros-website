import type { ProjectMediaFile } from '@/shared/db/schema'
import type { PortfolioProjectDetail } from '@/shared/modules/projects/core/types'

export interface ResolvedBeforeAfterPair {
  label: string
  confidence: number
  before: ProjectMediaFile
  after: ProjectMediaFile
}

/** The project's before/after pairs whose photos are still on the project, the most confident first. */
export function resolveBeforeAfterPairs(detail: Pick<PortfolioProjectDetail, 'project' | 'media'>): ResolvedBeforeAfterPair[] {
  const byId = new Map(detail.media.all.map(file => [file.id, file]))
  return (detail.project.beforeAfterPairsJSON?.pairs ?? [])
    .flatMap((pair) => {
      const before = byId.get(pair.beforeMediaId)
      const after = byId.get(pair.afterMediaId)
      return before && after ? [{ label: pair.label, confidence: pair.confidence, before, after }] : []
    })
    .toSorted((a, b) => b.confidence - a.confidence)
}
