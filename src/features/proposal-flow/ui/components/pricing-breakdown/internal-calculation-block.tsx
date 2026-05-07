'use client'

import type { InsertProposalSchema } from '@/shared/db/schema'
import { ChevronsUpDownIcon, LockIcon } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Separator } from '@/shared/components/ui/separator'
import { SectionFinancialsSummary } from '@/shared/entities/proposals/components/section-financials-summary'
import { computeProposalCostTotals } from '@/shared/entities/proposals/lib/compute-proposal-cost-totals'
import {
  formatMultiplier,
  getMultiplierTier,
} from '@/shared/entities/proposals/lib/compute-sow-financials'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

const MULTIPLIER_STYLES: Record<ReturnType<typeof getMultiplierTier>, string> = {
  danger: 'text-red-600 dark:text-red-400',
  healthy: 'text-emerald-600 dark:text-emerald-400',
  excellent: 'text-emerald-600 dark:text-emerald-300 [text-shadow:0_0_12px_oklch(0.7_0.18_155),0_0_4px_oklch(0.7_0.18_155_/_0.4)]',
  unknown: 'text-muted-foreground',
}

interface Props {
  proposalData: InsertProposalSchema
}

export function InternalCalculationBlock({ proposalData }: Props) {
  const [expanded, setExpanded] = useState(false)
  const { pricingMode } = proposalData.formMetaJSON
  const sow = proposalData.projectJSON.data.sow
  const totals = computeProposalCostTotals(proposalData)
  const totalTier = getMultiplierTier(totals.totalMultiplier)

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
              pricingMode={pricingMode}
              compact={!expanded}
            />
          </div>
        ))}
      </div>

      {/* Aggregate totals */}
      <div className="border-t border-destructive/20 px-5 py-4 space-y-2">
        <SummaryRow
          label="Subtotal"
          value={formatAsDollars(totals.subtotal)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
        <SummaryRow
          label="Total Job Costs"
          value={`-${formatAsDollars(totals.totalJobCosts)}`}
          className="text-red-600/90 dark:text-red-400/90"
        />
        {totals.totalSectionIncentives > 0 && (
          <SummaryRow
            label="Section Incentives"
            value={`-${formatAsDollars(totals.totalSectionIncentives)}`}
            className="text-red-600/90 dark:text-red-400/90"
          />
        )}
        {totals.totalGlobalIncentives > 0 && (
          <SummaryRow
            label="Global Discounts"
            value={`-${formatAsDollars(totals.totalGlobalIncentives)}`}
            className="text-red-600/90 dark:text-red-400/90"
          />
        )}

        <Separator />

        <SummaryRow
          label="Total Margin"
          value={formatAsDollars(totals.totalMargin)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground font-medium">Multiplier</span>
          <span className={cn('font-bold tabular-nums', MULTIPLIER_STYLES[totalTier])}>
            {formatMultiplier(totals.totalMultiplier)}
          </span>
        </div>
      </div>

      {totals.hasMissingCostData && (
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
