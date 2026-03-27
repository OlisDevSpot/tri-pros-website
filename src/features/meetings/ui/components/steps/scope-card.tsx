'use client'

import type { ScopeOrAddon } from '@/shared/services/notion/lib/scopes/schema'
import { CheckIcon } from 'lucide-react'
import { useMemo } from 'react'
import { cn } from '@/shared/lib/utils'

const FALLBACK_GRADIENTS = [
  'from-slate-700 via-slate-800 to-slate-900',
  'from-zinc-700 via-zinc-800 to-zinc-900',
  'from-stone-700 via-stone-800 to-stone-900',
  'from-neutral-700 via-neutral-800 to-neutral-900',
  'from-slate-700 via-blue-900 to-slate-900',
  'from-zinc-700 via-violet-900 to-zinc-900',
  'from-stone-700 via-amber-900 to-stone-900',
  'from-neutral-700 via-emerald-900 to-neutral-900',
  'from-slate-700 via-rose-900 to-slate-900',
  'from-zinc-700 via-sky-900 to-zinc-900',
] as const

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

interface ScopeCardProps {
  scope: ScopeOrAddon
  isSelected: boolean
  onToggle: (scopeId: string) => void
}

export function ScopeCard({ scope, isSelected, onToggle }: ScopeCardProps) {
  const fallbackGradient = useMemo(
    () => FALLBACK_GRADIENTS[hashString(scope.id) % FALLBACK_GRADIENTS.length],
    [scope.id],
  )

  return (
    <button
      type="button"
      onClick={() => onToggle(scope.id)}
      className={cn(
        'group relative flex h-56 w-full flex-col justify-end overflow-hidden rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'border-primary/60 shadow-md outline-2 outline-primary/30 -outline-offset-2'
          : 'border-border/60 shadow-sm hover:border-primary/30 hover:shadow-md',
      )}
    >
      {/* Background image or deterministic gradient fallback */}
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
            <div className={cn('absolute inset-0 bg-gradient-to-br', fallbackGradient)} />
          )}

      {/* Gradient overlay — ensures text readability on both images and gradient fallbacks */}
      <div className={cn(
        'absolute inset-0 transition-opacity duration-200',
        scope.coverImageUrl
          ? 'bg-gradient-to-t from-black/85 via-black/40 to-transparent group-hover:from-black/90'
          : 'bg-gradient-to-t from-black/50 to-transparent',
      )}
      />

      {/* Selection indicator */}
      <span
        className={cn(
          'absolute right-2.5 top-2.5 z-10 flex size-5 items-center justify-center rounded-full border-2 transition-all duration-200',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground scale-110'
            : 'border-white/40 bg-black/20 group-hover:border-white/60',
        )}
      >
        {isSelected && <CheckIcon className="size-3" strokeWidth={3} />}
      </span>

      {/* Text content */}
      <div className="relative z-10 px-3 pb-3">
        <span className="text-[13px] font-semibold leading-tight text-white drop-shadow-md">
          {scope.name}
        </span>
      </div>
    </button>
  )
}
