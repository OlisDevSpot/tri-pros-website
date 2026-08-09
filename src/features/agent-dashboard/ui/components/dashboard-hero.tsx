import type { ReactElement } from 'react'

import { DashboardSnapshotStrip } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-strip'

interface DashboardHeroProps {
  /** The signed-in user's name (server-provided, so the greeting hydrates without a flash). First token is used. */
  name?: string | null
}

/**
 * Full-width cinematic band at the top of the dashboard: eyebrow + Syne
 * greeting + the snapshot stat row. Deliberately a non-time greeting (no
 * "Good morning") — a clock-derived greeting would diverge between server
 * render and client hydration. The name is threaded from the server page
 * (not read client-side) for the same hydration-safety reason. Spacing only
 * here; no card chrome — the `DashboardSnapshotStrip` owns its own chip styling.
 */
export function DashboardHero({ name }: DashboardHeroProps): ReactElement {
  const firstName = name?.trim().split(/\s+/)[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">Your desk</p>
        <h1 className="font-sans text-2xl font-medium text-foreground">
          {firstName ? `👋 Welcome back, ${firstName}` : '👋 Welcome back'}
        </h1>
      </div>
      <DashboardSnapshotStrip />
    </div>
  )
}
