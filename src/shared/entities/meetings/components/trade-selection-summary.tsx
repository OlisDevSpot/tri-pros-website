'use client'

import type { ReactNode } from 'react'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'

import { HybridPopoverTooltip } from '@/shared/components/hybridPopoverTooltip'
import { TRADE_SELECTION_COPY } from '@/shared/entities/meetings/constants/trade-selection-copy'
import { formatWorkSummary } from '@/shared/entities/meetings/lib/format-work-summary'
import { cn } from '@/shared/lib/utils'

interface TradeSelectionSummaryProps {
  entry: TradeSelection
  /** 'summary' = first scope +N, one line each; 'full' = every scope label, lines wrap. */
  work: 'summary' | 'full'
  /** Defaults to the trade name captured with the selection. */
  name?: string
  thumb?: ReactNode
  badges?: ReactNode
  showNote?: boolean
  className?: string
}

// Returns siblings, not a wrapper, so a caller's flex row (e.g. a collapsible trigger) keeps its own gaps.
export function TradeSelectionSummary({ entry, work, name, thumb, badges, showNote = false, className }: TradeSelectionSummaryProps) {
  const workText = work === 'summary'
    ? formatWorkSummary(entry)
    : entry.selectedScopes.map(scope => scope.label).join(', ') || TRADE_SELECTION_COPY.noWork
  const reasons = entry.painPoints.length > 0 ? entry.painPoints.join(' · ') : TRADE_SELECTION_COPY.noReason
  const note = showNote ? entry.notes?.trim() : undefined

  return (
    <>
      {thumb}
      <span className={cn('flex min-w-0 flex-1 flex-col gap-0.5', className)}>
        <span className="flex flex-wrap items-center gap-2 text-[15px] font-semibold">
          {name ?? entry.tradeName}
          {badges}
        </span>
        <span className="text-[13px]">{workText}</span>
        <span className={cn('text-[13px] text-muted-foreground', work === 'summary' && 'truncate')}>{reasons}</span>
        {note && (
          <HybridPopoverTooltip content={<p className="max-w-xs whitespace-pre-wrap">{note}</p>}>
            <span tabIndex={0} className="line-clamp-3 text-[13px] text-muted-foreground">
              {TRADE_SELECTION_COPY.notePrefix}
              {note}
            </span>
          </HybridPopoverTooltip>
        )}
      </span>
    </>
  )
}
