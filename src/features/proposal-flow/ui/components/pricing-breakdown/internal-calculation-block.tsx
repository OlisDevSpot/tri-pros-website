'use client'

import type { PriceDisplayMode } from '@/shared/constants/enums'
import type { FundingData } from '@/shared/entities/proposals/schemas'
import type { SOW } from '@/shared/entities/proposals/types'
import { ChevronsUpDownIcon, LockIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { SectionFinancialsSummary } from '@/shared/entities/proposals/components/section-financials-summary'
import { MULTIPLIER_STYLES } from '@/shared/entities/proposals/constants/multiplier-styles'
import { computeProposalFinancials, formatMultiplier } from '@/shared/entities/proposals/lib/financials'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  funding: FundingData
  sow: SOW[]
  priceDisplayMode: PriceDisplayMode
}

export function InternalCalculationBlock({ funding, sow, priceDisplayMode }: Props) {
  const [expanded, setExpanded] = useState(false)
  const financials = computeProposalFinancials({
    funding,
    sow,
    priceDisplayMode,
  })

  return (
    <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden text-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-destructive/20">
        <div className="flex items-center gap-2">
          <LockIcon className="size-4 text-destructive" />
          <span className="font-semibold">Internal Calculation</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Visible only to you</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => setExpanded(prev => !prev)}
            aria-label={expanded ? 'Collapse details' : 'Expand details'}
          >
            <ChevronsUpDownIcon className="size-4" />
          </Button>
        </div>
      </div>

      {/* Per-section financials */}
      <div className="px-5 py-4 space-y-4">
        {sow.map((section, i) => (
          <div key={i}>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
              {section.title || `Section ${i + 1}`}
            </p>
            <SectionFinancialsSummary
              financials={section.financials}
              priceDisplayMode={priceDisplayMode}
              compact={!expanded}
            />
          </div>
        ))}
      </div>

      {/* Aggregate totals — price side, then cost side */}
      <div className="border-t border-destructive/20 px-5 py-4 space-y-2">
        <SummaryRow
          label="Subtotal"
          value={formatAsDollars(financials.subtotal)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
        {financials.totalSectionIncentives > 0 && (
          <SummaryRow
            label="Section Incentives"
            value={`-${formatAsDollars(financials.totalSectionIncentives)}`}
            className="text-emerald-700 dark:text-emerald-400"
          />
        )}
        {financials.totalGlobalDiscounts > 0 && (
          <SummaryRow
            label="Global Discounts"
            value={`-${formatAsDollars(financials.totalGlobalDiscounts)}`}
            className="text-emerald-700 dark:text-emerald-400"
          />
        )}
        <SummaryRow
          label="Final Contract Price"
          value={formatAsDollars(financials.finalTcp)}
          bold
        />
        <SummaryRow
          label="Total Job Costs"
          value={`-${formatAsDollars(financials.totalJobCosts)}`}
          className="text-red-600/90 dark:text-red-400/90"
        />

        <Separator />

        <SummaryRow
          label="Total Margin"
          value={formatAsDollars(financials.margin)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Multiplier</span>
          <span className={cn('font-bold tabular-nums', MULTIPLIER_STYLES[financials.tier])}>
            {formatMultiplier(financials.multiplier)}
          </span>
        </div>
      </div>

      {financials.hasMissingCostData && (
        <div className="border-t border-destructive/20 px-5 py-3 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
          One or more sections are missing cost data — multiplier and margin reflect partial cost.
        </div>
      )}
    </div>
  )
}

function SummaryRow({
  label,
  value,
  className,
  bold,
}: {
  label: string
  value: string
  className?: string
  bold?: boolean
}) {
  return (
    <div className={cn('flex items-center justify-between', className)}>
      <span className={cn(bold && 'font-medium')}>{label}</span>
      <span className={cn('tabular-nums shrink-0', bold && 'font-medium')}>{value}</span>
    </div>
  )
}
