'use client'

import type { PriceDisplayMode } from '@/shared/constants/enums'
import type { BreakdownSectionLine } from '@/shared/modules/proposals/core/lib/financials'
import type { FundingData } from '@/shared/modules/proposals/core/schemas'
import type { SOW } from '@/shared/modules/proposals/core/types'

import { CheckIcon, GiftIcon } from 'lucide-react'

import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { buildPricingBreakdown } from '@/shared/modules/proposals/core/lib/financials'
import { ExpirationBadge } from './expiration-badge'
import { PriceRow } from './pricing-breakdown/price-row'

interface Props {
  funding: FundingData
  sow: SOW[]
  priceDisplayMode: PriceDisplayMode
}

// A part's own price shows only in breakdown mode, and its net only when it has incentives to net out.
type PartLine = Omit<BreakdownSectionLine, 'price' | 'netPrice'> & { price: number | null, netPrice: number | null }

export function PricingBreakdown({ funding, sow, priceDisplayMode }: Props) {
  const breakdown = buildPricingBreakdown({ funding, sow, priceDisplayMode })
  const showPrices = breakdown.priceDisplayMode === 'breakdown'
  const parts: PartLine[] = showPrices
    ? breakdown.sections.map(section => ({ ...section, netPrice: section.incentives.length > 0 ? section.netPrice : null }))
    : breakdown.totalModeParts.map(part => ({ ...part, price: null, netPrice: null }))
  // In total mode the subtotal only says something when part incentives already took it below the contract price.
  const showSubtotal = showPrices || Math.round(breakdown.netSubtotal * 100) !== Math.round(breakdown.subtotal * 100)
  const now = new Date()

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card text-sm">
      {!showPrices && (
        <PriceRow className="px-4.5 py-3.5 font-semibold" label="Contract price" value={formatAsDollars(breakdown.subtotal)} />
      )}
      <div className={cn('divide-y divide-border', !showPrices && 'border-t border-border')}>
        {parts.map(part => (
          <div key={part.key} className="grid gap-2 px-4.5 py-3.5">
            <PriceRow label={<span className="font-bold">{part.title}</span>} value={part.price !== null ? <span className="font-semibold">{formatAsDollars(part.price)}</span> : null} />
            {part.incentives.map(inc => (
              <PriceRow
                key={inc.id}
                className="text-status-success-fg"
                label={(
                  <span className="inline-flex items-center gap-1.5">
                    <GiftIcon className="size-3.5 shrink-0" />
                    {inc.label}
                  </span>
                )}
                value={`−${formatAsDollars(inc.amount)}`}
              />
            ))}
            {part.netPrice !== null && (
              <PriceRow className="border-t border-dashed border-border pt-2 font-semibold" label="Your price for this part" value={formatAsDollars(part.netPrice)} />
            )}
          </div>
        ))}
        {showPrices && breakdown.miscPrice != null && (
          <PriceRow className="px-4.5 py-3.5" label={<span className="font-bold">Additional items</span>} value={formatAsDollars(breakdown.miscPrice)} />
        )}
      </div>

      {showSubtotal && (
        <PriceRow className="border-t border-border px-4.5 py-3 text-muted-foreground" label={showPrices ? 'Subtotal of all parts' : 'Subtotal'} value={formatAsDollars(breakdown.netSubtotal)} />
      )}

      {breakdown.globalLines.length > 0 && (
        <div className="grid gap-2.5 border-t border-border bg-[color-mix(in_oklab,var(--status-success-bg)_55%,var(--card))] px-4.5 py-3.5 text-status-success-fg">
          <p className="text-xs font-bold uppercase tracking-wider">Applies to the whole project</p>
          {breakdown.globalLines.map((line) => {
            const expiresAt = line.expiresAt ? new Date(line.expiresAt) : null
            const expired = expiresAt ? now >= expiresAt : false
            return (
              <div key={line.key} className="grid gap-1">
                <PriceRow
                  className={cn(expired && 'text-muted-foreground line-through')}
                  label={(
                    <span className="inline-flex items-center gap-1.5">
                      <GiftIcon className="size-3.5 shrink-0" />
                      {line.label}
                      {line.kind === 'exclusive-offer' && line.notes && <span className="text-muted-foreground">{` · ${line.notes}`}</span>}
                    </span>
                  )}
                  value={line.amount != null
                    ? `−${formatAsDollars(line.amount)}`
                    : (
                        <span className="inline-flex items-center gap-1">
                          <CheckIcon className="size-3.5" />
                          Included
                        </span>
                      )}
                />
                {expiresAt && !expired && <ExpirationBadge expiresAt={expiresAt} />}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid gap-1.5 border-t border-border bg-band px-4.5 py-4">
        <PriceRow label={<span className="font-bold">Final contract price</span>} value={<span className="font-sans text-3xl leading-none font-medium">{formatAsDollars(breakdown.finalTcp)}</span>} />
        <PriceRow className="text-muted-foreground" label="Deposit at signing" value={formatAsDollars(breakdown.deposit)} />
      </div>
    </div>
  )
}
