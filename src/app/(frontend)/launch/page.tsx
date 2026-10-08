/* eslint-disable react-dom/no-dangerously-set-innerhtml */
import type { Metadata } from 'next'
import { LaunchShell } from '@/features/agent-dashboard/ui/components/launch-shell'
import { ROOTS } from '@/shared/config/roots'
import { PWA_LAUNCH_STALL_MS } from '@/shared/domains/pwa/constants/launch'

export const dynamic = 'force-static'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Runs even when no chunk executes (a cached document whose chunks the server no longer has): the handoff
// sets the flag before it navigates, so a working launch never reaches this.
const WATCHDOG = `setTimeout(function(){if(!window.__tprLaunch){location.replace(${JSON.stringify(ROOTS.dashboard.root)})}},${PWA_LAUNCH_STALL_MS})`

export default function LaunchPage() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: WATCHDOG }} />
      <LaunchShell />
    </>
  )
}
