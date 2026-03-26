'use client'

import type { Trade } from '@/shared/services/notion/lib/trades/schema'
import { CheckIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'
import { cn } from '@/shared/lib/utils'
import { useGetScopes } from '@/shared/services/notion/dal/scopes/hooks/queries/use-get-scopes'

interface TradeCardProps {
  trade: Trade
  isSelected: boolean
  onToggle: (trade: Trade) => void
}

export function TradeCard({ trade, isSelected, onToggle }: TradeCardProps) {
  const [isHovered, setIsHovered] = useState(false)
  const totalRelated = trade.relatedScopes.length

  const scopesQuery = useGetScopes(
    { query: trade.id, filterProperty: 'relatedTrade' },
    { enabled: isHovered && totalRelated > 0 },
  )

  const { scopeCount, addonCount, scopeNames, addonNames } = useMemo(() => {
    const items = scopesQuery.data ?? []
    const scopes = items.filter(s => s.entryType === 'Scope')
    const addons = items.filter(s => s.entryType === 'Addon')
    return {
      scopeCount: scopes.length,
      addonCount: addons.length,
      scopeNames: scopes.map(s => s.name),
      addonNames: addons.map(s => s.name),
    }
  }, [scopesQuery.data])

  const hasData = scopesQuery.isSuccess && totalRelated > 0

  return (
    <Tooltip delayDuration={400}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onToggle(trade)}
          onMouseEnter={() => setIsHovered(true)}
          className={cn(
            'group relative flex h-44 w-full flex-col justify-end overflow-hidden rounded-2xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isSelected
              ? 'border-primary/60 shadow-lg shadow-primary/10 ring-2 ring-primary/30'
              : 'border-border/60 shadow-sm hover:border-primary/30 hover:shadow-md',
          )}
        >
          {/* Background image or fallback */}
          {trade.coverImageUrl
            ? (
                <img
                  alt=""
                  className={cn(
                    'absolute inset-0 h-full w-full object-cover transition-transform duration-300',
                    'group-hover:scale-105',
                  )}
                  loading="lazy"
                  src={trade.coverImageUrl}
                />
              )
            : (
                <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/10" />
              )}

          {/* Gradient overlay */}
          <div className={cn(
            'absolute inset-0 transition-opacity duration-200',
            'bg-gradient-to-t from-black/85 via-black/40 to-transparent',
            'group-hover:from-black/90',
          )}
          />

          {/* Selection indicator */}
          <span
            className={cn(
              'absolute right-3 top-3 z-10 flex size-6 items-center justify-center rounded-full border-2 transition-all duration-200',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground scale-110'
                : 'border-white/40 bg-black/20 group-hover:border-white/60',
            )}
          >
            {isSelected && <CheckIcon className="size-3.5" strokeWidth={3} />}
          </span>

          {/* Text content */}
          <div className="relative z-10 space-y-1 px-3.5 pb-3.5">
            <span className="text-[15px] font-semibold leading-tight tracking-tight text-white drop-shadow-md">
              {trade.name}
            </span>
            {totalRelated > 0 && (
              <p className="text-[11px] leading-tight text-white/60">
                {hasData
                  ? [
                      scopeCount > 0 && `${scopeCount} scope${scopeCount !== 1 ? 's' : ''}`,
                      addonCount > 0 && `${addonCount} addon${addonCount !== 1 ? 's' : ''}`,
                    ].filter(Boolean).join(' · ')
                  : `${totalRelated} item${totalRelated !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        </button>
      </TooltipTrigger>

      {hasData && (scopeCount > 0 || addonCount > 0) && (
        <TooltipContent
          side="bottom"
          className="max-w-72 border-border/50 bg-background/80 backdrop-blur-xl shadow-xl"
        >
          {scopeCount > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Scopes</p>
              <ul className="space-y-0.5">
                {scopeNames.map(name => (
                  <li key={name} className="text-xs text-muted-foreground">{name}</li>
                ))}
              </ul>
            </div>
          )}
          {addonCount > 0 && (
            <div className={cn('space-y-1', scopeCount > 0 && 'mt-2.5 border-t border-border/50 pt-2.5')}>
              <p className="text-xs font-semibold text-foreground">Addons</p>
              <ul className="space-y-0.5">
                {addonNames.map(name => (
                  <li key={name} className="text-xs text-muted-foreground">{name}</li>
                ))}
              </ul>
            </div>
          )}
        </TooltipContent>
      )}
    </Tooltip>
  )
}
