'use client'

import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { CheckIcon } from 'lucide-react'
import { memo } from 'react'
import { cn } from '@/shared/lib/utils'

interface TradeCardProps {
  trade: Trade
  isSelected: boolean
  onToggle: (trade: Trade) => void
}

export const TradeCard = memo(function TradeCard({ trade, isSelected, onToggle }: TradeCardProps) {
  const totalRelated = trade.relatedScopes.length

  return (
    <button
      type="button"
      onClick={() => onToggle(trade)}
      className={cn(
        'relative flex h-28 w-full flex-col justify-end overflow-hidden rounded-xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'border-primary shadow-md ring-2 ring-primary/30'
          : 'border-border hover:border-primary/40',
      )}
    >
      {/* Background image or fallback */}
      {trade.coverImageUrl
        ? (
            <img
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="lazy"
              src={trade.coverImageUrl}
            />
          )
        : (
            <div className="absolute inset-0 bg-muted" />
          )}

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />

      {/* Selection indicator */}
      <span
        className={cn(
          'absolute right-2.5 top-2.5 z-10 flex size-5 items-center justify-center rounded-full border-2 transition-all',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'border-white/50 bg-black/30',
        )}
      >
        {isSelected && <CheckIcon className="size-3" />}
      </span>

      {/* Text content */}
      <div className="relative z-10 px-3 pb-2.5">
        <span className="text-sm font-semibold leading-tight text-white drop-shadow-sm">
          {trade.name}
        </span>
        {totalRelated > 0 && (
          <p className="mt-0.5 text-[11px] leading-tight text-white/70">
            {`${totalRelated} item${totalRelated !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>
    </button>
  )
})
