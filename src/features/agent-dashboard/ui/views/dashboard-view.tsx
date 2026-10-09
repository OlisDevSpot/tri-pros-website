'use client'

// Fill-parent A×C bento for the agent dashboard home screen: a full-width
// hero band above a 12-col work surface (meetings wide-left, proposals +
// projects stacked in the right rail). No max-w/mx-auto — this fills the
// shell MAIN width, matching the records pages. MAIN owns overflow-hidden.
//
// Scroll ownership is viewport-aware: on mobile the whole view scrolls as one
// page. From `lg` up the work surface is viewport-bound (the grid fills the
// remaining height under the hero) and EACH column scrolls internally — a long
// proposals/projects rail scrolls its own container instead of growing the
// page. The Action Queue module is intentionally not rendered here (stub
// removed); the snapshot strip's `#queue` chip is re-skinned in a later task.

import { DashboardHero } from '@/features/agent-dashboard/ui/components/dashboard-hero'
import { DashboardMeetingsHub } from '@/features/agent-dashboard/ui/components/dashboard-meetings-hub'
import { DashboardProjects } from '@/features/agent-dashboard/ui/components/dashboard-projects'
import { DashboardProposals } from '@/features/agent-dashboard/ui/components/dashboard-proposals'
import { DataViewBoundary } from '@/shared/components/data-view-boundary'
import { cn } from '@/shared/lib/utils'

interface Props {
  name?: string | null
  showsProposals: boolean
  showsProjects: boolean
}

export function DashboardView({ name, showsProposals, showsProjects }: Props) {
  // A role that reads neither proposals nor projects gets the meetings across the full width, not an empty rail.
  const hasRail = showsProposals || showsProjects
  return (
    <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto lg:overflow-y-hidden">
      <div className="flex w-full flex-col gap-(--gutter) pb-16 lg:min-h-0 lg:flex-1 lg:pb-0">
        <DashboardHero name={name} />
        <div className="grid grid-cols-1 gap-(--gutter) lg:min-h-0 lg:flex-1 lg:grid-cols-12">
          {/* A scrollbar here would sit between the two cards and widen that one gap past --gutter. */}
          <section id="meetings" className={cn('lg:min-h-0 lg:overflow-y-auto lg:[scrollbar-width:none] lg:[&::-webkit-scrollbar]:hidden', hasRail ? 'lg:col-span-8' : 'lg:col-span-12')}>
            <DataViewBoundary>
              <DashboardMeetingsHub />
            </DataViewBoundary>
          </section>
          {hasRail && (
            <div className="flex flex-col gap-(--gutter) lg:col-span-4 lg:min-h-0 lg:overflow-y-auto lg:scrollbar-gutter-stable">
              {showsProposals && (
                <section id="proposals">
                  <DashboardProposals />
                </section>
              )}
              {showsProjects && (
                <section id="projects">
                  <DashboardProjects />
                </section>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
