'use client'

import type { UnusedSkipTokenOptions } from '@tanstack/react-query'
import type { TRPCClientErrorLike } from '@trpc/client'
import type { inferOutput, TRPCQueryKey } from '@trpc/tanstack-react-query'
import type { useTRPC } from '@/trpc/helpers'
import type { AppRouter } from '@/trpc/routers/app'

import { useSuspenseQueries } from '@tanstack/react-query'

import { DashboardSnapshotChips } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-chips'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'

type TRPC = ReturnType<typeof useTRPC>
type ReadOptions<TOutput> = UnusedSkipTokenOptions<TOutput, TRPCClientErrorLike<AppRouter>, TOutput, TRPCQueryKey>

interface DashboardSnapshotCountsProps {
  meetingsToday: ReadOptions<inferOutput<TRPC['meetingsRouter']['reads']['list']>>
  awaitingSignature: ReadOptions<inferOutput<TRPC['proposalsRouter']['business']['list']>>
  activeProjects: ReadOptions<inferOutput<TRPC['projectsRouter']['crud']['list']>>
}

/**
 * Counts are read from the same query inputs the modules below use, so they share the dashboard
 * home page's server prefetch and never fire a count query of their own.
 */
export function DashboardSnapshotCounts({ meetingsToday, awaitingSignature, activeProjects }: DashboardSnapshotCountsProps) {
  useHydrationParityCheck(meetingsToday.queryKey)
  useHydrationParityCheck(awaitingSignature.queryKey)
  useHydrationParityCheck(activeProjects.queryKey)

  // Plural, so the three reads suspend together instead of one after another.
  const [meetingsTodayRead, awaitingSignatureRead, activeProjectsRead] = useSuspenseQueries({
    queries: [meetingsToday, awaitingSignature, activeProjects],
  })

  return (
    <DashboardSnapshotChips
      counts={{
        meetingsToday: meetingsTodayRead.data.total,
        awaitingSignature: awaitingSignatureRead.data.total,
        activeProjects: activeProjectsRead.data.total,
      }}
    />
  )
}
