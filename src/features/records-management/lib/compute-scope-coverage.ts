import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { ProposalScopeCoverage, ScopeRef } from '@/shared/modules/proposals/core/components/overview-card'
import type { SowTradeScope } from '@/shared/modules/proposals/core/types'

/**
 * Compares the scopes a meeting captured with one proposal's SOW. Matched by scope id, so a label edited
 * on the proposal still counts. Null when either side has no scopes: a proposal saved without SOW scopes
 * would read as covering nothing, and a meeting that captured none would mark every scope as added.
 */
export function computeScopeCoverage(
  tradeSelections: TradeSelection[],
  sowSummary: SowTradeScope[],
): ProposalScopeCoverage | null {
  const proposalScopes = new Map<string, string>()
  for (const section of sowSummary) {
    for (const scope of section.scopes) {
      proposalScopes.set(scope.id, scope.label)
    }
  }
  if (proposalScopes.size === 0) {
    return null
  }

  const captured = new Map<string, string>()
  for (const selection of tradeSelections) {
    for (const scope of selection.selectedScopes) {
      captured.set(scope.id, scope.label)
    }
  }

  if (captured.size === 0) {
    return null
  }

  const covered: ScopeRef[] = []
  const missing: ScopeRef[] = []
  for (const [id, label] of captured) {
    (proposalScopes.has(id) ? covered : missing).push({ id, label })
  }
  const extra: ScopeRef[] = [...proposalScopes]
    .filter(([id]) => !captured.has(id))
    .map(([id, label]) => ({ id, label }))

  return { covered, missing, extra }
}
