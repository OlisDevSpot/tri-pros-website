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

  // Fetch scopes lazily on hover for the tooltip — cached by React Query
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
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={() => onToggle(trade)}
          onMouseEnter={() => setIsHovered(true)}
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
        <TooltipContent side="bottom" className="max-w-64">
          {scopeCount > 0 && (
            <div className="space-y-1">
              <p className="text-xs font-semibold">Scopes</p>
              <ul className="space-y-0.5">
                {scopeNames.map(name => (
                  <li key={name} className="text-xs text-muted-foreground">{name}</li>
                ))}
              </ul>
            </div>
          )}
          {addonCount > 0 && (
            <div className={cn('space-y-1', scopeCount > 0 && 'mt-2')}>
              <p className="text-xs font-semibold">Addons</p>
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
