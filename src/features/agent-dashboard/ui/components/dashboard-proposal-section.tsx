'use client'

import type { ProposalListInput } from '@/shared/modules/proposals/core/dal/server/queries'

import { Suspense } from 'react'

import { DashboardListSectionSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-list-section-skeleton'
import { DashboardProposalSectionList } from '@/features/agent-dashboard/ui/components/dashboard-proposal-section-list'
import { useIsDataViewPending } from '@/shared/dal/client/hooks/use-is-data-view-pending'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'

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
  // The layout's loading state draws this page with no reads (see DataViewPendingContext).
  const isPending = useIsDataViewPending()
  const skeleton = <DashboardListSectionSkeleton title={title} card="proposal" />
  if (isPending) {
    return skeleton
  }
  return (
    <HydrationErrorBoundary variant="section">
      <Suspense fallback={skeleton}>
        <DashboardProposalSectionList title={title} input={input} timeSince={timeSince} emptyMessage={emptyMessage} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
