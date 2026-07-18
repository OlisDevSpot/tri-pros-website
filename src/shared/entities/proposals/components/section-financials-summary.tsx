'use client'

import type { SowFinancials } from '@/shared/entities/proposals/schemas'
import { ExpandableLineItems } from '@/shared/components/expandable-line-items'
import { Separator } from '@/shared/components/ui/separator'
import { MULTIPLIER_STYLES } from '@/shared/entities/proposals/constants/multiplier-styles'
import { computeSectionFinancials, formatMultiplier } from '@/shared/entities/proposals/lib/financials'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props {
  financials: SowFinancials
  pricingMode: 'total' | 'breakdown'
  /** Compact mode: shows only Net Price + Job Costs */
  compact?: boolean
}

/**
 * Shared financial summary for a single SOW section.
 *
 * Layout: inputs (price, costs, incentives) → Separator → outputs (margin, multiplier)
 * In total mode (no sectionPrice), only cost + incentives are shown.
 * Line items toggle open/closed via clickable summary rows.
 */
export function SectionFinancialsSummary({ financials, pricingMode, compact }: Props) {
  const section = computeSectionFinancials({ title: '', financials })
  const isBreakdown = pricingMode === 'breakdown'

  const hasAnyData = section.hasCostLines || section.hasIncentives
  const showOutputs = isBreakdown && section.price != null && section.hasCostLines

  if (compact) {
    return (
      <div className="rounded-lg bg-muted/30 px-4 py-2 text-sm space-y-1">
        {isBreakdown && section.netPrice != null && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Net Price</span>
            <span className="text-emerald-600 dark:text-emerald-400 tabular-nums font-medium">
              {formatAsDollars(section.netPrice)}
            </span>
          </div>
        )}
        {section.hasCostLines && (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-xs">Job Costs</span>
            <span className="text-red-600/90 dark:text-red-400/90 tabular-nums font-medium">
              -
              {formatAsDollars(section.jobCost)}
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
      {isBreakdown && section.price != null && (
        <SummaryRow
          label="Section Price"
          value={formatAsDollars(section.price)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
      )}

      {/* Incentives — reduce the section's PRICE */}
      {section.hasIncentives && (
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
          value={<span className="font-medium">{`-${formatAsDollars(section.incentives)}`}</span>}
          className="text-emerald-700 dark:text-emerald-400"
          items={financials.incentives.map(inc => ({
            id: inc.id,
            label: inc.label || 'Untitled',
            value: `-${formatAsDollars(inc.amount)}`,
          }))}
        />
      )}

      {/* Net Price (only when incentives moved it off the sticker price) */}
      {isBreakdown && section.netPrice != null && section.hasIncentives && (
        <SummaryRow
          label="Net Price"
          value={formatAsDollars(section.netPrice)}
          className="text-emerald-600 dark:text-emerald-400"
          bold
        />
      )}

      {/* Job Costs — what WE pay */}
      {section.hasCostLines && (
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
          value={<span className="font-medium">{`-${formatAsDollars(section.jobCost)}`}</span>}
          className="text-red-600/90 dark:text-red-400/90"
          items={financials.costLines.map(line => ({
            id: line.id,
            label: line.label || 'Untitled',
            value: `-${formatAsDollars(line.amount)}`,
          }))}
        />
      )}

      {showOutputs && <Separator className="my-1" />}

      {showOutputs && (
        <>
          <SummaryRow
            label="Margin"
            value={section.margin == null ? '—' : formatAsDollars(section.margin)}
            className="text-emerald-600 dark:text-emerald-400"
            bold
          />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground font-medium">Multiplier</span>
            <span className={cn('font-bold tabular-nums', MULTIPLIER_STYLES[section.tier])}>
              {formatMultiplier(section.multiplier)}
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
