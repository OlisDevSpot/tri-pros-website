'use client'

import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import { CheckIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface ScopeCardProps {
  scope: ScopeOrAddon
  isSelected: boolean
  onToggle: (scopeId: string) => void
}

export function ScopeCard({ scope, isSelected, onToggle }: ScopeCardProps) {
  return (
    <button
      type="button"
      onClick={() => onToggle(scope.id)}
      className={cn(
        'group relative flex h-28 w-full flex-col justify-end overflow-hidden rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'border-primary/60 shadow-md ring-2 ring-primary/30'
          : 'border-border/60 shadow-sm hover:border-primary/30 hover:shadow-md',
      )}
    >
      {/* Background image or fallback */}
      {scope.coverImageUrl
        ? (
            <img
              alt=""
              className={cn(
                'absolute inset-0 h-full w-full object-cover transition-transform duration-300',
                'group-hover:scale-105',
              )}
              loading="lazy"
              src={scope.coverImageUrl}
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
          'absolute right-2 top-2 z-10 flex size-5 items-center justify-center rounded-full border-2 transition-all duration-200',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground scale-110'
            : 'border-white/40 bg-black/20 group-hover:border-white/60',
        )}
      >
        {isSelected && <CheckIcon className="size-3" strokeWidth={3} />}
      </span>

      {/* Text content */}
      <div className="relative z-10 px-3 pb-2.5">
        <span className="text-sm font-semibold leading-tight text-white drop-shadow-sm">
          {scope.name}
        </span>
      </div>
    </button>
  )
}
