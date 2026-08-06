'use client'

// Vertical stack container for the agent dashboard home screen. Modules are
// dropped into these anchored sections in Phase 3 (Tasks 6-9); the anchor
// ids (#meetings #queue #proposals #projects) are the jump targets for the
// snapshot strip's links.

import { DashboardMeetingsHub } from '@/features/agent-dashboard/ui/components/dashboard-meetings-hub'
import { DashboardSnapshotStrip } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-strip'

export function DashboardView() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pb-24 pt-4">
      <DashboardSnapshotStrip />
      <section id="meetings">
        <DashboardMeetingsHub />
      </section>
      <section id="queue">{/* Task 7 */}</section>
      <section id="proposals">{/* Task 8 */}</section>
      <section id="projects">{/* Task 9 */}</section>
    </div>
  )
}
