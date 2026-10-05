import type { ShowcaseProject, ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { Scope } from '@/shared/modules/construction/core/schemas'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'
import { hasHeroImage } from '@/shared/modules/projects/core/lib/has-hero-image'

/** Portfolio rows to lookups by trade and scope. Rows without a hero image are skipped: the showcase has nothing to show for them. */
export function indexShowcaseProjects(projects: PortfolioProject[], scopesById: ReadonlyMap<string, Scope>): ShowcaseProjectIndex {
  const byScope = new Map<string, ShowcaseProject[]>()
  const tradeHits = new Map<string, { project: ShowcaseProject, hits: number }[]>()

  for (const row of projects) {
    if (!hasHeroImage(row)) {
      continue
    }
    const item: ShowcaseProject = {
      id: row.project.id,
      city: row.project.city,
      state: row.project.state,
      projectDuration: row.project.projectDuration,
      heroImage: row.heroImage,
      scopeIds: row.scopeIds,
    }
    const hitsPerTrade = new Map<string, number>()
    for (const scopeId of row.scopeIds) {
      byScope.set(scopeId, [...(byScope.get(scopeId) ?? []), item])
      const tradeId = scopesById.get(scopeId)?.tradeId
      if (tradeId) {
        hitsPerTrade.set(tradeId, (hitsPerTrade.get(tradeId) ?? 0) + 1)
      }
    }
    for (const [tradeId, hits] of hitsPerTrade) {
      tradeHits.set(tradeId, [...(tradeHits.get(tradeId) ?? []), { project: item, hits }])
    }
  }

  const byTrade = new Map<string, ShowcaseProject[]>()
  for (const [tradeId, list] of tradeHits) {
    byTrade.set(tradeId, [...list].sort((a, b) => b.hits - a.hits).map(entry => entry.project))
  }
  return { byTrade, byScope }
}
