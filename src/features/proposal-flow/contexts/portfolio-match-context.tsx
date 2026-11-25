'use client'

import type { ReactNode } from 'react'
import type { PortfolioMatch } from '@/shared/modules/projects/core/types'

import { createContext, use, useMemo } from 'react'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { usePortfolioMatches } from '@/shared/modules/projects/core/hooks/use-portfolio-matches'
import { sowToTradeSelections } from '@/shared/modules/projects/core/lib/sow-to-trade-selections'

interface PortfolioMatchValue {
  matches: PortfolioMatch[]
  isPending: boolean
  /** Nothing matched the proposal's scopes or trades, so the strongest projects stand in. */
  isFallback: boolean
  /** The one trade every part shares, else null. */
  tradeLabel: string | null
}

const PortfolioMatchContext = createContext<PortfolioMatchValue | null>(null)

// Results and Scope read one match, so a part's "done this before" chip always names the project Results features.
export function PortfolioMatchProvider({ children }: { children: ReactNode }) {
  const { proposal } = useProposalDocument()
  const sow = proposal.projectJSON.data.sow
  // The matches hook memoizes on the selections' identity; a fresh array each render would re-run the match and its prefetch.
  const selections = useMemo(() => sowToTradeSelections(sow), [sow])
  const { matches, isPending } = usePortfolioMatches(selections)

  const value = useMemo<PortfolioMatchValue>(() => {
    const kind = matches[0]?.kind
    const tradeNames = new Set(selections.map(selection => selection.tradeName))
    return {
      matches,
      isPending,
      // No first match yet (loading) is not a fallback, so the matched headline never flips once the list lands.
      isFallback: kind !== undefined && kind !== 'scope' && kind !== 'trade',
      tradeLabel: tradeNames.size === 1 ? [...tradeNames][0]! : null,
    }
  }, [matches, isPending, selections])

  return <PortfolioMatchContext value={value}>{children}</PortfolioMatchContext>
}

export function usePortfolioMatch(): PortfolioMatchValue {
  const ctx = use(PortfolioMatchContext)
  if (!ctx) {
    throw new Error('usePortfolioMatch must be used within PortfolioMatchProvider')
  }
  return ctx
}
