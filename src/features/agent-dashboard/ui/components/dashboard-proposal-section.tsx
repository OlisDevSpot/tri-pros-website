'use client'

import type { ProposalListInput } from '@/shared/entities/proposals/dal/server/queries'

import { useQuery } from '@tanstack/react-query'

import { DashboardProposalCard } from '@/features/agent-dashboard/ui/components/dashboard-proposal-card'
import { EntityList } from '@/shared/components/entity-list/ui/entity-list'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

interface DashboardProposalSectionProps {
  /** Space-Mono eyebrow naming the section's single state. */
  title: string
  /** List query input from a shared builder, so the key matches the server prefetch (hydration parity). */
  input: ProposalListInput
  /** Which timestamp each row's "time since" reflects. */
  timeSince: 'contractSentAt' | 'sentAt'
  /** Shown when the section has zero rows. */
  emptyMessage: string
}

/**
 * One labeled sub-section of the dashboard Proposals module: an eyebrow label +
 * the full-predicate total (a SQL `count()`, independent of the display cap),
 * then a capped `EntityList` of `DashboardProposalCard`s (or its empty state).
 * The section header IS the state — the cards carry no status badge.
 */
export function DashboardProposalSection({ title, input, timeSince, emptyMessage }: DashboardProposalSectionProps) {
  const trpc = useTRPC()
  const { data, isLoading } = useQuery(trpc.proposalsRouter.business.list.queryOptions(input))

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
        {data?.total !== undefined && (
          <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">{data.total}</span>
        )}
      </div>
      {isLoading
        ? <DashboardProposalSectionSkeleton />
        : (
            // EntityList renders the list body + empty state only. Its built-in
            // header is bypassed (`hideHeader`) on purpose: it is hardcoded
            // `text-[10px]` sans `Title (n)` (entity-list.tsx:88), which violates
            // the dashboard type floor (no `text-[10px]`) and cannot express the
            // spec's Space-Mono eyebrow + right-aligned count — so this section
            // renders its own header above. `title` is a required EntityList prop
            // but inert here. We deliberately do NOT extend the shared EntityList
            // with dashboard eyebrow chrome (feature styling stays out of shared/).
            <EntityList
              title={title}
              hideHeader
              items={data?.rows ?? []}
              getItemKey={row => row.id}
              renderItem={row => <DashboardProposalCard row={row} timeSince={timeSince} />}
              emptyState={{ message: emptyMessage }}
              itemsClassName="space-y-2"
              variant="flush"
            />
          )}
    </section>
  )
}

/** Two dense card-shaped rows while the section query is in flight. */
function DashboardProposalSectionSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      {[0, 1].map(i => (
        <Skeleton key={i} className="h-16 w-full rounded-lg" />
      ))}
    </div>
  )
}
