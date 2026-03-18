import type { PillarSlug, TradeWithScopes } from '@/features/landing/lib/notion-trade-helpers'

import Image from 'next/image'
import Link from 'next/link'

import { tradeOutcomeStatements } from '@/features/landing/constants/trade-outcome-statements'
import { Badge } from '@/shared/components/ui/badge'

interface TradeCardProps {
  trade: TradeWithScopes
  pillarSlug: PillarSlug
}

export function TradeCard({ trade, pillarSlug }: TradeCardProps) {
  return (
    <Link
      href={`/services/${pillarSlug}/${trade.slug}`}
      className="group block rounded-xl border border-border bg-card overflow-hidden transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
    >
      {/* Cover Image */}
      <div className="relative aspect-16/10 w-full overflow-hidden">
        {trade.images[0]
          ? (
              <Image
                src={trade.images[0]}
                alt={trade.name}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              />
            )
          : (
              <div className="absolute inset-0 bg-linear-to-br from-primary/20 via-primary/10 to-muted" />
            )}
      </div>

      {/* Content */}
      <div className="p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors">
            {trade.name}
          </h3>
          <Badge variant="secondary" className="shrink-0 text-xs">
            {trade.scopes.length}
            {' '}
            {trade.scopes.length === 1 ? 'service' : 'services'}
          </Badge>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
          {tradeOutcomeStatements[trade.slug] ?? 'Professional installation backed by a licensed team, proper permits, and a written warranty.'}
        </p>
      </div>
    </Link>
  )
}
