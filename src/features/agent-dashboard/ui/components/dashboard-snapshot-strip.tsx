'use client'

import { useQuery } from '@tanstack/react-query'

import { activeProjectsInput, awaitingProposalsInput, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { useTRPC } from '@/trpc/helpers'

/**
 * Slim, non-sticky ribbon of 3 jump-links at the top of the dashboard:
 * meetings today · awaiting signature · open projects. Counts are read
 * from the same query inputs the modules below use (dedupes against the
 * server prefetch in `dashboard/page.tsx`), so this never fires its own
 * count query. See the spec at
 * docs/superpowers/specs/2026-08-06-adaptive-agent-dashboard-design.md#11.
 */
export function DashboardSnapshotStrip() {
  const trpc = useTRPC()

  const meetingsToday = useQuery(trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today')))
  const awaitingSignature = useQuery(trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()))
  const activeProjects = useQuery(trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput()))

  const chips = [
    { href: '#meetings', label: 'Meetings today', count: meetingsToday.data?.total },
    { href: '#proposals', label: 'Out for signature', count: awaitingSignature.data?.total },
    { href: '#projects', label: 'Open projects', count: activeProjects.data?.total },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {chips.map(chip => (
        <a
          key={chip.href}
          href={chip.href}
          className="
            flex min-h-11 flex-col items-start justify-center gap-1 rounded-md
            border border-border bg-card px-3 py-2
            transition-colors duration-200
            hover:border-primary/40 hover:bg-accent/50
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
            {chip.label}
          </span>
          <span
            className={
              chip.count === undefined
                ? 'font-sans text-2xl font-bold tabular-nums text-muted-foreground'
                : 'font-sans text-2xl font-bold tabular-nums text-primary'
            }
          >
            {chip.count ?? '—'}
          </span>
        </a>
      ))}
    </div>
  )
}
