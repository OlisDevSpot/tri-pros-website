'use client'

import { useSuspenseQueries } from '@tanstack/react-query'

import { activeProjectsInput, awaitingProposalsInput, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardSnapshotChips } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-chips'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'
import { useTRPC } from '@/trpc/helpers'

/**
 * Counts are read from the same query inputs the modules below use, so they share the server
 * prefetch in `dashboard/page.tsx` and never fire a count query of their own.
 */
export function DashboardSnapshotCounts() {
  const trpc = useTRPC()
  const meetingsTodayOptions = trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today'))
  const awaitingSignatureOptions = trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput())
  const activeProjectsOptions = trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput())

  useHydrationParityCheck(meetingsTodayOptions.queryKey)
  useHydrationParityCheck(awaitingSignatureOptions.queryKey)
  useHydrationParityCheck(activeProjectsOptions.queryKey)

  // Plural, so the three reads suspend together instead of one after another.
  const [meetingsToday, awaitingSignature, activeProjects] = useSuspenseQueries({
    queries: [meetingsTodayOptions, awaitingSignatureOptions, activeProjectsOptions],
  })

  return (
    <DashboardSnapshotChips
      counts={{
        meetingsToday: meetingsToday.data.total,
        awaitingSignature: awaitingSignature.data.total,
        activeProjects: activeProjects.data.total,
      }}
    />
  )
}
