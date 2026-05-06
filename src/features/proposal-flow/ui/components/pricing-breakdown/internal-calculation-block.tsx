import type { InsertProposalSchema } from '@/shared/db/schema'
import { LockIcon } from 'lucide-react'
import { Fragment } from 'react'
import { computeProposalCostTotals } from '@/shared/entities/proposals/lib/compute-proposal-cost-totals'
import {
  computeSectionCost,
  computeSectionMargin,
  computeSectionMultiplier,
  formatMultiplier,
} from '@/shared/entities/proposals/lib/compute-sow-financials'
import { formatAsDollars } from '@/shared/lib/formatters'

interface Props {
  proposalData: InsertProposalSchema
}

/**
 * Agent-only "Internal Calculation" block. Renders below the
 * customer-facing PricingBreakdown when viewMode === 'agent'. Shows
 * per-section cost (and price/margin/multiplier in breakdown mode)
 * plus an aggregate footer with Total Cost, Total Margin, Multiplier
 * computed against finalTcp.
 */
export function InternalCalculationBlock({ proposalData }: Props) {
  const { pricingMode } = proposalData.formMetaJSON
  const sow = proposalData.projectJSON.data.sow
  const totals = computeProposalCostTotals(proposalData)
  const isBreakdown = pricingMode === 'breakdown'

  return (
    <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden text-sm">
      <div className="flex items-center justify-between gap-2 px-5 py-3 border-b border-destructive/20">
        <div className="flex items-center gap-2">
          <LockIcon className="size-4 text-destructive" />
          <span className="font-semibold">Internal Calculation</span>
        </div>
        <span className="text-xs text-muted-foreground">Visible only to you</span>
      </div>

      <div className="px-5 py-4 space-y-2">
        {isBreakdown
          ? (
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-x-6 gap-y-2 items-baseline">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Section</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Price</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Cost</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Margin</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Multiplier</span>

                {sow.map((section, i) => {
                  const cost = computeSectionCost(section)
                  const margin = computeSectionMargin(section)
                  const multiplier = computeSectionMultiplier(section)
                  const hasCost = section.financials.costLines.length > 0
                  return (
                    <Fragment key={`${section.title || i}`}>
                      <span className="text-muted-foreground truncate">{section.title || `Section ${i + 1}`}</span>
                      <span className="text-right tabular-nums">
                        {section.financials.sectionPrice == null ? '—' : formatAsDollars(section.financials.sectionPrice)}
                      </span>
                      <span className="text-right tabular-nums">{hasCost ? formatAsDollars(cost) : '—'}</span>
                      <span className="text-right tabular-nums">{margin == null ? '—' : formatAsDollars(margin)}</span>
                      <span className="text-right tabular-nums">{formatMultiplier(multiplier)}</span>
                    </Fragment>
                  )
                })}
              </div>
            )
          : (
              <div className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-2 items-baseline">
                <span className="text-xs uppercase tracking-wide text-muted-foreground">Section</span>
                <span className="text-xs uppercase tracking-wide text-muted-foreground text-right">Cost</span>

                {sow.map((section, i) => {
                  const cost = computeSectionCost(section)
                  const hasCost = section.financials.costLines.length > 0
                  return (
                    <Fragment key={`${section.title || i}`}>
                      <span className="text-muted-foreground truncate">{section.title || `Section ${i + 1}`}</span>
                      <span className="text-right tabular-nums">{hasCost ? formatAsDollars(cost) : '—'}</span>
                    </Fragment>
                  )
                })}
              </div>
            )}
      </div>

      <div className="border-t border-destructive/20 px-5 py-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">Total Cost</span>
          <span className="font-medium tabular-nums">{formatAsDollars(totals.totalCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            Total Margin
            <span className="ml-2 text-xs">(Final Price − Total Cost)</span>
          </span>
          <span className="font-medium tabular-nums">{formatAsDollars(totals.totalMargin)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground">
            Multiplier
            <span className="ml-2 text-xs">(Final Price ÷ Total Cost)</span>
          </span>
          <span className="font-semibold tabular-nums">{formatMultiplier(totals.totalMultiplier)}</span>
        </div>
      </div>

      {totals.hasMissingCostData && (
        <div className="border-t border-destructive/20 px-5 py-3 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs">
          ⚠ One or more sections are missing cost data — multiplier and margin reflect partial cost.
        </div>
      )}
    </div>
  )
}
