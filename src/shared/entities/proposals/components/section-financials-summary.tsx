'use client'

import type { z } from 'zod'
import type { sowFinancialsSchema } from '@/shared/entities/proposals/schemas'
import { ExpandableLineItems } from '@/shared/components/expandable-line-items'
import { Separator } from '@/shared/components/ui/separator'
import {
  computeSectionCost,
  computeSectionIncentives,
  computeSectionMargin,
  computeSectionMultiplier,
  formatMultiplier,
  getMultiplierTier,
  hasCostLines,
  hasIncentives,
} from '@/shared/entities/proposals/lib/compute-sow-financials'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

type SowFinancials = z.infer<typeof sowFinancialsSchema>

interface Props {
  financials: SowFinancials
  pricingMode: 'total' | 'breakdown'
  /** Compact mode: shows only Section Price + aggregate Section Cost */
  compact?: boolean
}

const MULTIPLIER_STYLES: Record<ReturnType<typeof getMultiplierTier>, string> = {
  danger: 'text-red-600 dark:text-red-400',
  healthy: 'text-emerald-600 dark:text-emerald-400',
  excellent: 'text-emerald-600 dark:text-emerald-300 [text-shadow:0_0_12px_oklch(0.7_0.18_155),0_0_4px_oklch(0.7_0.18_155_/_0.4)]',
  unknown: 'text-muted-foreground',
}

/**
 * Shared financial summary for a single SOW section.
 *
 * Layout: inputs (price, costs, incentives) → Separator → outputs (margin, multiplier)
 * In total mode (no sectionPrice), only cost + incentives are shown.
 * Line items toggle open/closed via clickable summary rows.
 */
export function SectionFinancialsSummary({ financials, pricingMode, compact }: Props) {
  const section = { financials }
  const isBreakdown = pricingMode === 'breakdown'

  const price = financials.sectionPrice
  const cost = computeSectionCost(section)
  const incentiveTotal = computeSectionIncentives(section)
  const totalSectionCost = cost + incentiveTotal
  const margin = computeSectionMargin(section)
  const multiplier = computeSectionMultiplier(section)
  const tier = getMultiplierTier(multiplier)

  const showCostLines = hasCostLines(section)
  const showIncentives = hasIncentives(section)
  const hasAnyData = showCostLines || showIncentives
  const showOutputs = isBreakdown && price != null && showCostLines

  if (compact) {
    return (
      <div className="rounded-lg bg-muted/30 px-4 py-2 text-sm space-y-1">
        {isBreakdown && price != null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Price</span>
            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-medium">
              {formatAsDollars(price)}
            </span>
          </div>
        )}
        {hasAnyData && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Total Costs</span>
            <span className="text-red-600/90 dark:text-red-400/90 tabular-nums font-medium">
              -
              {formatAsDollars(totalSectionCost)}
            </span>
          </div>
        )}
        {!hasAnyData && (
          <p className="text-xs text-muted-foreground">No cost data</p>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm space-y-2">
      {/* Section Price (breakdown only) */}
      {isBreakdown && price != null && (
        <SummaryRow
          label="Section Price"
          value={formatAsDollars(price)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
      )}

      {/* Job Costs */}
      {showCostLines && (
        <ExpandableLineItems
          label={(
            <span className="font-medium">
              Job Costs
              <span className="text-xs text-muted-foreground font-normal ml-1">
                (
                {financials.costLines.length}
                )
              </span>
            </span>
          )}
          value={<span className="font-medium">{`-${formatAsDollars(cost)}`}</span>}
          className="text-red-600/90 dark:text-red-400/90"
          items={financials.costLines.map(line => ({
            id: line.id,
            label: line.label || 'Untitled',
            value: `-${formatAsDollars(line.amount)}`,
          }))}
        />
      )}

      {/* Incentives */}
      {showIncentives && (
        <ExpandableLineItems
          label={(
            <span className="font-medium">
              Incentives
              <span className="text-xs text-muted-foreground font-normal ml-1">
                (
                {financials.incentives.length}
                )
              </span>
            </span>
          )}
          value={<span className="font-medium">{`-${formatAsDollars(incentiveTotal)}`}</span>}
          className="text-red-600/90 dark:text-red-400/90"
          items={financials.incentives.map(inc => ({
            id: inc.id,
            label: inc.label || 'Untitled',
            value: `-${formatAsDollars(inc.amount)}`,
          }))}
        />
      )}

      {showOutputs && <Separator className="my-1" />}

      {showOutputs && (
        <>
          <SummaryRow
            label="Margin"
            value={margin == null ? '—' : formatAsDollars(margin)}
            className="text-emerald-600 dark:text-emerald-400"
            bold
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Multiplier</span>
            <span className={cn('font-bold tabular-nums', MULTIPLIER_STYLES[tier])}>
              {formatMultiplier(multiplier)}
            </span>
          </div>
        </>
      )}

      {!hasAnyData && !isBreakdown && (
        <p className="text-center text-xs text-muted-foreground py-1">
          Add cost lines to see financial summary
        </p>
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
