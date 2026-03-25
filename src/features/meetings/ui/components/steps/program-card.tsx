'use client'

import type { ProgramQualification } from '@/features/meetings/lib/qualify-programs'
import type { MeetingProgram } from '@/features/meetings/types'
import { CheckIcon } from 'lucide-react'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

const ACCENT_BORDER: Record<string, string> = {
  amber: 'border-amber-400/70 bg-amber-50/30 dark:bg-amber-950/10',
  sky: 'border-sky-400/70 bg-sky-50/30 dark:bg-sky-950/10',
  violet: 'border-violet-400/70 bg-violet-50/30 dark:bg-violet-950/10',
}

const ACCENT_SELECTED: Record<string, string> = {
  amber: 'border-amber-500 ring-2 ring-amber-400/40',
  sky: 'border-sky-500 ring-2 ring-sky-400/40',
  violet: 'border-violet-500 ring-2 ring-violet-400/40',
}

const ACCENT_ICON: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  sky: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  violet: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
}

interface ProgramCardProps {
  program: MeetingProgram
  qualification: ProgramQualification
  isSelected: boolean
  onSelect: (accessor: string) => void
}

export function ProgramCard({ program, qualification, isSelected, onSelect }: ProgramCardProps) {
  const accentBorder = ACCENT_BORDER[program.accentColor] ?? ACCENT_BORDER.amber
  const accentSelected = ACCENT_SELECTED[program.accentColor] ?? ACCENT_SELECTED.amber
  const accentIcon = ACCENT_ICON[program.accentColor] ?? ACCENT_ICON.amber

  return (
    <button
      type="button"
      onClick={() => onSelect(program.accessor)}
      className={cn(
        'relative w-full rounded-xl border-2 p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        accentBorder,
        isSelected && accentSelected,
        !isSelected && 'hover:border-opacity-100',
      )}
    >
      {/* Selection indicator */}
      <span
        className={cn(
          'absolute right-4 top-4 flex size-5 items-center justify-center rounded-full border-2 transition-all',
          isSelected
            ? cn(accentIcon, 'border-current')
            : 'border-muted-foreground/30 bg-transparent',
        )}
      >
        {isSelected && <CheckIcon className="size-3" />}
      </span>

      {/* Header */}
      <div className="mb-3 space-y-0.5 pr-7">
        <h3 className="text-sm font-bold leading-tight">{program.name}</h3>
        <p className="text-muted-foreground text-xs">{program.tagline}</p>
      </div>

      {/* Qualification badge */}
      <div className="mb-3">
        {qualification.result.qualified
          ? (
              <Badge className="border-green-500/30 bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 text-xs" variant="outline">
                Qualified
              </Badge>
            )
          : (
              <Badge className="border-red-500/30 bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400 text-xs" variant="outline">
                Not qualified
              </Badge>
            )}
        {!qualification.result.qualified && (
          <p className="mt-1 text-xs text-muted-foreground">{qualification.result.reason}</p>
        )}
      </div>

      {/* Incentives */}
      <ul className="space-y-1">
        {program.incentives.map(incentive => (
          <li className="flex items-center justify-between gap-2" key={incentive.id}>
            <span className="text-xs text-foreground/80">{incentive.label}</span>
            <span className={cn('shrink-0 text-xs font-semibold', accentIcon.split(' ').slice(1).join(' '))}>
              {incentive.valueDisplay}
            </span>
          </li>
        ))}
      </ul>

      {/* Expiry */}
      <p className="mt-3 text-xs text-muted-foreground/70">{program.expiresLabel}</p>
    </button>
  )
}

// ── Standard Pricing Card ────────────────────────────────────────────────────

interface StandardPricingCardProps {
  isSelected: boolean
  onSelect: () => void
}

export function StandardPricingCard({ isSelected, onSelect }: StandardPricingCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative w-full rounded-xl border-2 p-5 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        isSelected
          ? 'border-foreground/50 ring-2 ring-foreground/20'
          : 'border-border bg-card hover:border-foreground/30',
      )}
    >
      {/* Selection indicator */}
      <span
        className={cn(
          'absolute right-4 top-4 flex size-5 items-center justify-center rounded-full border-2 transition-all',
          isSelected
            ? 'border-foreground bg-foreground text-background'
            : 'border-muted-foreground/30 bg-transparent',
        )}
      >
        {isSelected && <CheckIcon className="size-3" />}
      </span>

      {/* Header */}
      <div className="mb-3 space-y-0.5 pr-7">
        <h3 className="text-sm font-bold leading-tight">Standard Pricing</h3>
        <p className="text-muted-foreground text-xs">No program — straightforward pricing with no add-ons.</p>
      </div>

      <Badge className="text-xs" variant="secondary">
        Always available
      </Badge>
    </button>
  )
}
