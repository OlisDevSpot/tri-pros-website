'use client'

import type { InsertProposalSchema } from '@/shared/db/schema'
import { CheckIcon } from 'lucide-react'
import { ExpandableLineItems } from '@/shared/components/expandable-line-items'
import { computeFinalTcp } from '@/shared/entities/proposals/lib/compute-final-tcp'
import { computeSectionIncentives, hasIncentives } from '@/shared/entities/proposals/lib/compute-sow-financials'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { ExpirationBadge } from './expiration-badge'
import { InternalCalculationBlock } from './pricing-breakdown/internal-calculation-block'

interface Props {
  proposalData: InsertProposalSchema
  viewMode?: 'customer' | 'agent'
}

export function PricingBreakdown({ proposalData, viewMode = 'customer' }: Props) {
  const { pricingMode } = proposalData.formMetaJSON
  const sow = proposalData.projectJSON.data.sow
  const { incentives: globalIncentives, miscPrice, startingTcp } = proposalData.fundingJSON.data
  const globalTcp = computeFinalTcp(proposalData.fundingJSON.data)

  // Section incentives reduce the price the homeowner pays
  const totalSectionIncentives = sow.reduce(
    (sum, section) => sum + computeSectionIncentives(section),
    0,
  )
  const finalTcp = Math.max(0, globalTcp - totalSectionIncentives)

  // In breakdown mode, section incentives render inline under their
  // section's price row. In total mode, they go in the global block.
  const isBreakdown = pricingMode === 'breakdown'
  const globalSectionIncentives = isBreakdown
    ? []
    : sow
        .filter(hasIncentives)
        .flatMap((section, i) =>
          section.financials.incentives.map(inc => ({
            id: inc.id,
            label: inc.label || `${section.title || `Section ${i + 1}`} discount`,
            amount: inc.amount,
          })),
        )
  const hasAnyIncentives = globalIncentives.length > 0 || globalSectionIncentives.length > 0

  return (
    <>
      <div className="rounded-xl border border-border/40 overflow-hidden text-sm">
        <div className="px-5 py-4 space-y-2.5">
          {pricingMode === 'breakdown'
            ? (
                <>
                  {sow.filter(s => (s.financials.sectionPrice ?? 0) > 0).map((section, i) => {
                    const originalPrice = section.financials.sectionPrice!
                    const discount = computeSectionIncentives(section)
                    const effectivePrice = originalPrice - discount
                    const title = section.title || `Section ${i + 1}`

                    if (discount <= 0) {
                      return (
                        <div key={i} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{title}</span>
                          <span>{formatAsDollars(originalPrice)}</span>
                        </div>
                      )
                    }

                    return (
                      <ExpandableLineItems
                        key={i}
                        label={<span className="text-muted-foreground">{title}</span>}
                        value={(
                          <span className="flex items-center gap-2">
                            <span className="text-muted-foreground/50 line-through text-xs tabular-nums">
                              {formatAsDollars(originalPrice)}
                            </span>
                            <span className="tabular-nums">{formatAsDollars(effectivePrice)}</span>
                          </span>
                        )}
                        items={[
                          { id: '_original', label: 'Original price', value: formatAsDollars(originalPrice) },
                          ...section.financials.incentives.map(inc => ({
                            id: inc.id,
                            label: inc.label || 'Discount',
                            value: `-${formatAsDollars(inc.amount)}`,
                            className: 'text-emerald-700 dark:text-emerald-400',
                          })),
                        ]}
                      />
                    )
                  })}
                  {(miscPrice ?? 0) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Misc</span>
                      <span>{formatAsDollars(miscPrice!)}</span>
                    </div>
                  )}
                </>
              )
            : (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Contract Price</span>
                  <span>{formatAsDollars(startingTcp)}</span>
                </div>
              )}
        </div>

        {pricingMode === 'breakdown' && (
          <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-muted-foreground">
            <span>Subtotal</span>
            <span>{formatAsDollars(startingTcp - totalSectionIncentives)}</span>
          </div>
        )}

        {hasAnyIncentives && (
          <>
            <div className="border-t border-border/40" />
            <div className="px-5 py-4 space-y-2.5 text-emerald-700 dark:text-emerald-400">
              {/* Section-level incentives (total mode only — breakdown mode shows inline) */}
              {globalSectionIncentives.map(inc => (
                <div key={inc.id} className="flex items-center justify-between">
                  <span>{inc.label}</span>
                  <span className="font-medium">
                    -
                    {formatAsDollars(inc.amount)}
                  </span>
                </div>
              ))}

              {/* Global incentives */}
              {globalIncentives.map((incentive, i) => {
                const isExpired = incentive.expiresAt ? new Date() >= new Date(incentive.expiresAt) : false
                const expiresAt = incentive.expiresAt ? new Date(incentive.expiresAt) : null

                if (incentive.type === 'discount') {
                  return (
                    <div key={`discount-${incentive.notes ?? i}`} className="space-y-1">
                      <div className={cn('flex items-center justify-between', isExpired && 'line-through opacity-60')}>
                        <span>{incentive.notes || 'Discount'}</span>
                        <span className="font-medium">
                          -
                          {formatAsDollars(incentive.amount)}
                        </span>
                      </div>
                      {expiresAt && !isExpired && (
                        <ExpirationBadge expiresAt={expiresAt} />
                      )}
                    </div>
                  )
                }
                return (
                  <div key={`offer-${incentive.offer ?? i}`} className="space-y-1">
                    <div className={cn('flex items-center justify-between', isExpired && 'line-through opacity-60')}>
                      <div className="flex items-center">
                        <span>{incentive.offer || 'Exclusive Offer'}</span>
                        {incentive.notes && (
                          <span className="mx-2 flex items-center gap-2">
                            {' '}
                            -
                            <p className="text-muted-foreground text-xs">{incentive.notes}</p>
                          </span>
                        )}
                      </div>
                      <span className="font-medium flex items-center gap-1">
                        <CheckIcon className="w-3.5 h-3.5" />
                        Included
                      </span>
                    </div>
                    {expiresAt && !isExpired && (
                      <ExpirationBadge expiresAt={expiresAt} />
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        <div className={cn(
          'border-t border-border/40 bg-muted/30 px-5 py-4 flex items-center justify-between',
          !hasAnyIncentives && pricingMode === 'total' && 'border-t-0',
        )}
        >
          <span className="font-semibold">Final Contract Price</span>
          <span className="font-semibold text-base">{formatAsDollars(finalTcp)}</span>
        </div>
      </div>

      {viewMode === 'agent' && (
        <InternalCalculationBlock proposalData={proposalData} />
      )}
    </>
  )
}
