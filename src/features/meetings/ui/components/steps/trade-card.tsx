'use client'

import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { CheckIcon } from 'lucide-react'
import {
  TRADE_OUTCOME_LABEL_FALLBACK,
  TRADE_OUTCOME_LABELS,
} from '@/features/meetings/constants/trade-labels'
import { cn } from '@/shared/lib/utils'

interface TradeCardProps {
  trade: Trade
  isSelected: boolean
  onToggle: (trade: Trade) => void
}

export function TradeCard({ trade, isSelected, onToggle }: TradeCardProps) {
  const outcomeLabel = TRADE_OUTCOME_LABELS[trade.slug] ?? TRADE_OUTCOME_LABEL_FALLBACK

  return (
    <button
      type="button"
      onClick={() => onToggle(trade)}
      className={cn(
        'relative flex w-full flex-col gap-1.5 rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'border-primary bg-primary/5 shadow-sm'
          : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40',
      )}
    >
      {/* Selection indicator */}
      <span
        className={cn(
          'absolute right-3 top-3 flex size-5 items-center justify-center rounded-full border-2 transition-all',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-muted-foreground/30 bg-transparent',
        )}
      >
        {isSelected && <CheckIcon className="size-3" />}
      </span>

      {/* Cover image placeholder / actual image */}
      {trade.coverImageUrl
        ? (
            <div className="mb-1 h-10 w-10 overflow-hidden rounded-lg">
              <img
                alt={trade.name}
                className="h-full w-full object-cover"
                src={trade.coverImageUrl}
              />
            </div>
          )
        : (
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-muted-foreground text-lg font-bold">
              {trade.name.charAt(0).toUpperCase()}
            </div>
          )}

      <span className="pr-6 text-sm font-semibold leading-tight">{trade.name}</span>
      <span className="text-xs text-muted-foreground">{outcomeLabel}</span>
    </button>
  )
}
