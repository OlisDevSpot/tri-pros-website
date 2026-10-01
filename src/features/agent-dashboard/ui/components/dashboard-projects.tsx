'use client'

import Link from 'next/link'

import { activeProjectsInput, onHoldProjectsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardModule } from '@/features/agent-dashboard/ui/components/dashboard-module'
import { DashboardProjectSection } from '@/features/agent-dashboard/ui/components/dashboard-project-section'
import { ROOTS } from '@/shared/config/roots'

/**
 * Projects module — two truthful, non-overlapping sections grouped by the
 * status bucket derived from `pipelineStage` (NOT the vestigial `status`
 * column, which is ~always 'active'): "Active" (live work, signed → full
 * payment) and "On hold" (paused). Each section reuses the exact query keys the
 * dashboard route prefetches (`activeProjectsInput` / `onHoldProjectsInput`),
 * so both hydrate instantly. Completed/cancelled projects are terminal —
 * reachable via "See all →".
 */
export function DashboardProjects() {
  return (
    <DashboardModule
      title="Projects"
      action={(
        <Link
          href={ROOTS.dashboard.projects.root()}
          className="-mr-2 -my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
        >
          See all →
        </Link>
      )}
    >
      <div className="flex flex-col gap-4">
        <DashboardProjectSection
          title="Active"
          input={activeProjectsInput()}
          emptyMessage="No active projects"
        />
        <DashboardProjectSection
          title="On hold"
          input={onHoldProjectsInput()}
          emptyMessage="Nothing on hold"
        />
      </div>
    </DashboardModule>
  )
}
