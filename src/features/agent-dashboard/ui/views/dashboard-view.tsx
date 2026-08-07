'use client'

// Fill-parent A×C bento for the agent dashboard home screen: a full-width
// hero band above a 12-col work surface (meetings wide-left, proposals +
// projects stacked in the right rail). No max-w/mx-auto — this fills the
// shell MAIN width, matching the records pages. MAIN owns overflow-hidden,
// so this view owns vertical scroll. The Action Queue module is intentionally
// not rendered here (stub removed); the snapshot strip's `#queue` chip is
// re-skinned in a later task.

import { DashboardHero } from '@/features/agent-dashboard/ui/components/dashboard-hero'
import { DashboardMeetingsHub } from '@/features/agent-dashboard/ui/components/dashboard-meetings-hub'
import { DashboardProjects } from '@/features/agent-dashboard/ui/components/dashboard-projects'
import { DashboardProposals } from '@/features/agent-dashboard/ui/components/dashboard-proposals'

export function DashboardView() {
  return (
    <div className="h-full overflow-x-hidden overflow-y-auto">
      <div className="flex w-full flex-col gap-6 pb-16">
        <DashboardHero />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <section id="meetings" className="lg:col-span-8">
            <DashboardMeetingsHub />
          </section>
          <div className="flex flex-col gap-6 lg:col-span-4">
            <section id="proposals">
              <DashboardProposals />
            </section>
            <section id="projects">
              <DashboardProjects />
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
