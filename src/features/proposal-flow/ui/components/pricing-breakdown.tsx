'use client'

import type { InsertProposalSchema } from '@/shared/db/schema'
import { CheckIcon } from 'lucide-react'
import { ExpandableLineItems } from '@/shared/components/expandable-line-items'
import { buildPricingBreakdown } from '@/shared/entities/proposals/lib/financials'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { ExpirationBadge } from './expiration-badge'

interface Props {
  proposalData: InsertProposalSchema
}

export function PricingBreakdown({ proposalData }: Props) {
  const breakdown = buildPricingBreakdown({
    funding: proposalData.fundingJSON.data,
    sow: proposalData.projectJSON.data.sow,
    pricingMode: proposalData.formMetaJSON.pricingMode,
  })

  const isBreakdown = breakdown.pricingMode === 'breakdown'
  // In breakdown mode, section incentives render inline under their section's
  // price row. In total mode, they go in the global block.
  const globalLines = isBreakdown
    ? breakdown.globalLines
    : [...breakdown.sectionIncentiveLines, ...breakdown.globalLines]
  const hasAnyIncentives = globalLines.length > 0

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden text-sm">
      <div className="px-5 py-4 space-y-2.5">
        {isBreakdown
          ? (
              <>
                {breakdown.sections.map(section => (
                  section.incentives.length === 0
                    ? (
                        <div key={section.key} className="flex items-center justify-between">
                          <span className="text-muted-foreground">{section.title}</span>
                          <span>{formatAsDollars(section.price)}</span>
                        </div>
                      )
                    : (
                        <ExpandableLineItems
                          key={section.key}
                          label={<span className="text-muted-foreground">{section.title}</span>}
                          value={(
                            <span className="flex items-center gap-2">
                              <span className="text-muted-foreground/50 line-through text-xs tabular-nums">
                                {formatAsDollars(section.price)}
                              </span>
                              <span className="tabular-nums">{formatAsDollars(section.netPrice)}</span>
                            </span>
                          )}
                          items={[
                            { id: '_original', label: 'Original price', value: formatAsDollars(section.price) },
                            ...section.incentives.map(inc => ({
                              id: inc.id,
                              label: inc.label,
                              value: `-${formatAsDollars(inc.amount)}`,
                              className: 'text-emerald-700 dark:text-emerald-400',
                            })),
                          ]}
                        />
                      )
                ))}
                {breakdown.miscPrice != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Misc</span>
                    <span>{formatAsDollars(breakdown.miscPrice)}</span>
                  </div>
                )}
              </>
            )
          : (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Contract Price</span>
                <span>{formatAsDollars(breakdown.subtotal)}</span>
              </div>
            )}
      </div>

      {isBreakdown && (
        <div className="border-t border-border/40 px-5 py-3 flex items-center justify-between text-muted-foreground">
          <span>Subtotal</span>
          <span>{formatAsDollars(breakdown.netSubtotal)}</span>
        </div>
      )}

      {hasAnyIncentives && (
        <>
          <div className="border-t border-border/40" />
          <div className="px-5 py-4 space-y-2.5 text-emerald-700 dark:text-emerald-400">
            {globalLines.map((line) => {
              const isExpired = line.expiresAt ? new Date() >= new Date(line.expiresAt) : false
              const expiresAt = line.expiresAt ? new Date(line.expiresAt) : null

              return (
                <div key={line.key} className="space-y-1">
                  <div className={cn('flex items-center justify-between', isExpired && 'line-through opacity-60')}>
                    {line.kind === 'exclusive-offer'
                      ? (
                          <div className="flex items-center">
                            <span>{line.label}</span>
                            {line.notes && (
                              <span className="mx-2 flex items-center gap-2">
                                {' '}
                                -
                                <p className="text-muted-foreground text-xs">{line.notes}</p>
                              </span>
                            )}
                          </div>
                        )
                      : <span>{line.label}</span>}
                    {line.amount != null
                      ? (
                          <span className="font-medium">
                            -
                            {formatAsDollars(line.amount)}
                          </span>
                        )
                      : (
                          <span className="font-medium flex items-center gap-1">
                            <CheckIcon className="w-3.5 h-3.5" />
                            Included
                          </span>
                        )}
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
        !hasAnyIncentives && !isBreakdown && 'border-t-0',
      )}
      >
        <span className="font-semibold">Final Contract Price</span>
        <span className="font-semibold text-base">{formatAsDollars(breakdown.finalTcp)}</span>
      </div>
    </div>
  )
}
