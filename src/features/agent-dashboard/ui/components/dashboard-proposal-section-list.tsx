'use client'

import type { ProposalListInput } from '@/shared/modules/proposals/core/dal/server/queries'

import { useSuspenseQuery } from '@tanstack/react-query'

import { DashboardListSectionHeader } from '@/features/agent-dashboard/ui/components/dashboard-list-section-header'
import { DashboardProposalCard } from '@/features/agent-dashboard/ui/components/dashboard-proposal-card'
import { EntityList } from '@/shared/components/entities/entity-list/ui/entity-list'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'
import { ProposalActionsHost } from '@/shared/modules/proposals/core/components/proposal-actions-host'
import { useTRPC } from '@/trpc/helpers'

interface DashboardProposalSectionListProps {
  title: string
  input: ProposalListInput
  timeSince: 'contractSentAt' | 'sentAt'
  emptyMessage: string
}

/**
 * The eyebrow label + the full-predicate total (a SQL `count()`, independent of the display cap),
 * then a capped `EntityList` of `DashboardProposalCard`s (or its empty state). The header IS the
 * state, so the cards carry no status badge.
 */
export function DashboardProposalSectionList({ title, input, timeSince, emptyMessage }: DashboardProposalSectionListProps) {
  const trpc = useTRPC()
  const options = trpc.proposalsRouter.business.list.queryOptions(input)
  useHydrationParityCheck(options.queryKey)
  const { data } = useSuspenseQuery(options)

  return (
    <section className="flex flex-col gap-2">
      <DashboardListSectionHeader title={title} total={data.total} />
      {/* EntityList's own header is hardcoded `text-[10px]` sans `Title (n)`, below the dashboard
          type floor and unable to express the Space-Mono eyebrow + right-aligned count, so it is
          bypassed and the header above stands in. `title` is required but inert here. */}
      <ProposalActionsHost>
        <EntityList
          title={title}
          hideHeader
          items={data.rows}
          getItemKey={row => row.id}
          renderItem={row => <DashboardProposalCard row={row} timeSince={timeSince} />}
          emptyState={{ message: emptyMessage }}
          itemsClassName="space-y-2"
          variant="flush"
        />
      </ProposalActionsHost>
    </section>
  )
}
