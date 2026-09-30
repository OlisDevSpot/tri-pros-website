'use client'

import type { ProjectsListInput } from '@/features/agent-dashboard/constants/dashboard-queries'

import { Suspense } from 'react'

import { DashboardListSectionSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-list-section-skeleton'
import { DashboardProjectSectionList } from '@/features/agent-dashboard/ui/components/dashboard-project-section-list'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'

interface DashboardProjectSectionProps {
  /** Space-Mono eyebrow naming the section's status bucket. */
  title: string
  /** List query input from a shared builder, so the key matches the server prefetch (hydration parity). */
  input: ProjectsListInput
  /** Shown when the section has zero rows. */
  emptyMessage: string
}

/**
 * One labeled sub-section of the dashboard Projects module. Mirrors `DashboardProposalSection`:
 * it suspends on its own, so its rows stream into the server HTML and a failed read stays inside
 * the section.
 */
export function DashboardProjectSection({ title, input, emptyMessage }: DashboardProjectSectionProps) {
  return (
    <HydrationErrorBoundary variant="section">
      <Suspense fallback={<DashboardListSectionSkeleton title={title} />}>
        <DashboardProjectSectionList title={title} input={input} emptyMessage={emptyMessage} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
