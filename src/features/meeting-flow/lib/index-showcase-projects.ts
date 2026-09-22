import type { ShowcaseProject, ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { TradeScopeGroup } from '@/shared/modules/construction/core/lib/build-catalog-index'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'

/** Portfolio rows to lookups by trade and scope. Rows without a hero image are skipped: the showcase has nothing to show for them. */
export function indexShowcaseProjects(projects: PortfolioProject[], scopesByTrade: ReadonlyMap<string, TradeScopeGroup>): ShowcaseProjectIndex {
  const tradeOfScope = new Map<string, string>()
  for (const [tradeId, group] of scopesByTrade) {
    for (const entry of [...group.scopes, ...group.addons]) {
      tradeOfScope.set(entry.id, tradeId)
    }
  }

  const byScope = new Map<string, ShowcaseProject[]>()
  const tradeHits = new Map<string, { project: ShowcaseProject, hits: number }[]>()

  for (const row of projects) {
    if (!row.heroImage) {
      continue
    }
    const item: ShowcaseProject = {
      id: row.project.id,
      city: row.project.city,
      state: row.project.state,
      duration: row.project.projectDuration,
      heroImage: row.heroImage,
      scopeIds: row.scopeIds,
    }
    const hitsPerTrade = new Map<string, number>()
    for (const scopeId of row.scopeIds) {
      byScope.set(scopeId, [...(byScope.get(scopeId) ?? []), item])
      const tradeId = tradeOfScope.get(scopeId)
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
