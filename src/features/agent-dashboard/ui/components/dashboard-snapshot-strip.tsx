'use client'

import { Suspense } from 'react'

import { DashboardSnapshotChips } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-chips'
import { DashboardSnapshotCounts } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-counts'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'

/**
 * The chips are jump-links first, so they render while the counts load and stay when a count
 * read fails; the modules below own the loud error state and its retry.
 */
export function DashboardSnapshotStrip() {
  return (
    <HydrationErrorBoundary fallback={<DashboardSnapshotChips />}>
      <Suspense fallback={<DashboardSnapshotChips />}>
        <DashboardSnapshotCounts />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
