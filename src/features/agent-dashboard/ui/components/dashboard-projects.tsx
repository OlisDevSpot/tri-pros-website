'use client'

import { DASHBOARD_ACTIVE_PROJECTS_QUERY, DASHBOARD_ON_HOLD_PROJECTS_QUERY } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardModule } from '@/features/agent-dashboard/ui/components/dashboard-module'
import { DashboardProjectSection } from '@/features/agent-dashboard/ui/components/dashboard-project-section'
import { DashboardSeeAllLink } from '@/features/agent-dashboard/ui/components/dashboard-see-all-link'
import { ROOTS } from '@/shared/config/roots'
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'

/**
 * Projects module — two truthful, non-overlapping sections grouped by the
 * status bucket derived from `pipelineStage` (NOT the vestigial `status`
 * column, which is ~always 'active'): "Active" (live work, signed → full
 * payment) and "On hold" (paused). Each section builds its input from the
 * config the dashboard route prefetches, so both hydrate instantly. Completed/cancelled projects are terminal —
 * reachable via "See all →".
 */
export function DashboardProjects() {
  return (
    <DashboardModule
      title="Projects"
      action={<DashboardSeeAllLink href={ROOTS.dashboard.projects.root()} />}
    >
      <div className="flex flex-col gap-4">
        <DashboardProjectSection
          title="Active"
          input={staticDataViewInput(DASHBOARD_ACTIVE_PROJECTS_QUERY)}
          emptyMessage="No active projects"
        />
        <DashboardProjectSection
          title="On hold"
          input={staticDataViewInput(DASHBOARD_ON_HOLD_PROJECTS_QUERY)}
          emptyMessage="Nothing on hold"
        />
      </div>
    </DashboardModule>
  )
}
