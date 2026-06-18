import type { ReactNode } from 'react'

// Funnel-only chrome. No marketing nav/footer — funnels are deliberately
// isolated from the (site) group. Meta Pixel mounts here in Plan 3.
export default function FunnelLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-dvh bg-background">{children}</div>
}
