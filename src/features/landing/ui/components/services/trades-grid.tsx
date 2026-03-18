import type { PillarSlug, TradeWithScopes } from '@/features/landing/lib/notion-trade-helpers'

import { TradeCard } from './trade-card'

interface TradesGridProps {
  trades: TradeWithScopes[]
  pillarSlug: PillarSlug
}

export function TradesGrid({ trades, pillarSlug }: TradesGridProps) {
  return (
    <section className="container py-16 lg:py-24">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {trades.map(trade => (
          <TradeCard
            key={trade.id}
            trade={trade}
            pillarSlug={pillarSlug}
          />
        ))}
      </div>
    </section>
  )
}
