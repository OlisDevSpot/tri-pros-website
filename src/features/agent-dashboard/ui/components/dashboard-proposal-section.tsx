'use client'

import type { ProposalListInput } from '@/shared/modules/proposals/core/dal/server/queries'

import { Suspense } from 'react'

import { DashboardListSectionSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-list-section-skeleton'
import { DashboardProposalSectionList } from '@/features/agent-dashboard/ui/components/dashboard-proposal-section-list'
import { useLoadingScreenRead } from '@/shared/dal/client/hooks/use-loading-screen-read'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'
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
 * One labeled sub-section of the dashboard Proposals module. Each section suspends on its own,
 * so the server streams its rows into the HTML as its prefetch lands and a failed read stays
 * inside the section.
 */
export function DashboardProposalSection({ title, input, timeSince, emptyMessage }: DashboardProposalSectionProps) {
  const trpc = useTRPC()
  const options = useLoadingScreenRead(trpc.proposalsRouter.business.list.queryOptions(input))
  const skeleton = <DashboardListSectionSkeleton title={title} card="proposal" />
  if (!options) {
    return skeleton
  }
  return (
    <HydrationErrorBoundary variant="section">
      <Suspense fallback={skeleton}>
        <DashboardProposalSectionList title={title} options={options} timeSince={timeSince} emptyMessage={emptyMessage} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
