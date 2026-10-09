'use client'

import type { Permission } from '@/shared/domains/permissions/types'

import { useAbility } from '@/shared/domains/permissions/client'
import { cn } from '@/shared/lib/utils'

interface DashboardSnapshotChipsProps {
  /** Omitted while the counts load (or when they failed): each chip shows a muted dash. */
  counts?: {
    meetingsToday: number
    awaitingSignature?: number
    activeProjects?: number
  }
}

/** Slim, non-sticky ribbon of jump-links: meetings today · out for signature · open projects, each only for a viewer who reads what it counts. */
export function DashboardSnapshotChips({ counts }: DashboardSnapshotChipsProps) {
  const ability = useAbility()
  const chips: { href: string, label: string, count: number | undefined, permission: Permission }[] = [
    { href: '#meetings', label: 'Meetings today', count: counts?.meetingsToday, permission: ['read', 'Meeting'] },
    { href: '#proposals', label: 'Out for signature', count: counts?.awaitingSignature, permission: ['read', 'Proposal'] },
    { href: '#projects', label: 'Open projects', count: counts?.activeProjects, permission: ['read', 'Project'] },
  ]
  const visible = chips.filter(chip => ability.can(...chip.permission))

  return (
    <div
      className={cn('grid gap-(--gutter)', visible.length === 3 ? 'grid-cols-3' : visible.length === 2 ? 'grid-cols-2' : 'grid-cols-1')}
      aria-busy={counts === undefined || undefined}
    >
      {visible.map(chip => (
        <a
          key={chip.href}
          href={chip.href}
          className="
            flex min-h-11 flex-col items-start justify-center gap-1 rounded-xl
            border border-border bg-card px-3 py-2
            transition-colors duration-200
            hover:bg-row-hover pressed:bg-row-press
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {chip.label}
          </span>
          <span
            className={
              chip.count === undefined
                ? 'font-sans text-2xl font-bold tabular-nums text-muted-foreground'
                : 'font-sans text-2xl font-bold tabular-nums text-foreground'
            }
          >
            {chip.count ?? '—'}
          </span>
        </a>
      ))}
    </div>
  )
}
