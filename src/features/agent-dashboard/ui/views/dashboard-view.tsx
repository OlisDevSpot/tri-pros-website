'use client'

// Vertical stack container for the agent dashboard home screen. Modules are
// dropped into these anchored sections in Phase 3 (Tasks 6-9); the anchor
// ids (#meetings #queue #proposals #projects) are the jump targets for the
// snapshot strip's links.

import { DashboardActionQueue } from '@/features/agent-dashboard/ui/components/dashboard-action-queue'
import { DashboardMeetingsHub } from '@/features/agent-dashboard/ui/components/dashboard-meetings-hub'
import { DashboardProjects } from '@/features/agent-dashboard/ui/components/dashboard-projects'
import { DashboardProposals } from '@/features/agent-dashboard/ui/components/dashboard-proposals'
import { DashboardSnapshotStrip } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-strip'

export function DashboardView() {
  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 pb-24 pt-4">
        <DashboardSnapshotStrip />
        <section id="meetings">
          <DashboardMeetingsHub />
        </section>
        <section id="queue">
          <DashboardActionQueue />
        </section>
        <section id="proposals">
          <DashboardProposals />
        </section>
        <section id="projects">
          <DashboardProjects />
        </section>
      </div>
    </div>
  )
}
