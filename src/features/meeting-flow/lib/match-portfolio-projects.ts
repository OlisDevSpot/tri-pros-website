import type { PortfolioMatch } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { CatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'
import { FALLBACK_MATCH_COUNT } from '@/features/meeting-flow/constants/portfolio-step'
import { resolveScopes } from '@/shared/modules/construction/core/lib/resolve-catalog-ids'
import { compareStoryStrength } from '@/shared/modules/projects/core/lib/compare-story-strength'
import { hasHeroImage } from '@/shared/modules/projects/core/lib/has-hero-image'

function byStoryStrength(a: PortfolioMatch, b: PortfolioMatch): number {
  return compareStoryStrength(a.row, b.row)
}

/**
 * The meeting's portfolio, most relevant first: projects sharing a selected scope, then projects in a
 * selected trade, then the rest. When nothing matches by scope or trade, the strongest
 * `FALLBACK_MATCH_COUNT` projects lead, so the step never opens on nothing.
 */
export function matchPortfolioProjects(
  projects: PortfolioProject[],
  selections: TradeSelection[],
  catalog: Pick<CatalogIndex, 'scopesById'>,
): PortfolioMatch[] {
  const scopeLabels = new Map(selections.flatMap(s => s.selectedScopes.map(item => [item.id, item.label] as const)))
  const tradeNames = new Map(selections.map(s => [s.tradeId, s.tradeName] as const))

  const weight = new Map<string, number>()
  const byScope: PortfolioMatch[] = []
  const byTrade: PortfolioMatch[] = []
  const rest: PortfolioMatch[] = []

  for (const row of projects) {
    if (!hasHeroImage(row)) {
      continue
    }
    const matchedScopeIds = row.scopeIds.filter(id => scopeLabels.has(id))
    // An orphan scope id cannot place the project in a trade; it still matches by id above.
    const scopesInSelectedTrades = resolveScopes(row.scopeIds, catalog).found.filter(scope => tradeNames.has(scope.tradeId))
    const matchedTradeIds = [...new Set(scopesInSelectedTrades.map(scope => scope.tradeId))]

    if (matchedScopeIds.length > 0) {
      weight.set(row.project.id, matchedScopeIds.length)
      byScope.push({ row, kind: 'scope', matchedScopeIds, matchedTradeIds, matchLabels: matchedScopeIds.map(id => scopeLabels.get(id)!) })
    }
    else if (matchedTradeIds.length > 0) {
      weight.set(row.project.id, scopesInSelectedTrades.length)
      byTrade.push({ row, kind: 'trade', matchedScopeIds: [], matchedTradeIds, matchLabels: matchedTradeIds.map(id => tradeNames.get(id)!) })
    }
    else {
      rest.push({ row, kind: 'none', matchedScopeIds: [], matchedTradeIds: [], matchLabels: [] })
    }
  }

  const byWeight = (a: PortfolioMatch, b: PortfolioMatch) =>
    (weight.get(b.row.project.id) ?? 0) - (weight.get(a.row.project.id) ?? 0) || byStoryStrength(a, b)

  byScope.sort(byWeight)
  byTrade.sort(byWeight)
  rest.sort(byStoryStrength)

  const fallbackCount = byScope.length + byTrade.length === 0 ? FALLBACK_MATCH_COUNT : 0
  const fallback = rest.slice(0, fallbackCount).map(match => ({ ...match, kind: 'fallback' as const }))

  return [...byScope, ...byTrade, ...fallback, ...rest.slice(fallbackCount)]
}
