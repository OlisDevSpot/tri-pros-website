import type { ReactElement } from 'react'

import { DashboardSnapshotStrip } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-strip'

/**
 * Full-width cinematic band at the top of the dashboard: eyebrow + Syne
 * greeting + the snapshot stat row. Deliberately a non-time greeting (no
 * "Good morning") — a clock-derived greeting would diverge between server
 * render and client hydration. Spacing only here; no card chrome — the
 * `DashboardSnapshotStrip` owns its own chip styling and Task 3 re-skins it.
 */
export function DashboardHero(): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">Your desk</p>
        <h1 className="font-sans text-2xl font-medium text-foreground">Welcome back</h1>
      </div>
      <DashboardSnapshotStrip />
    </div>
  )
}
