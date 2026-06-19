import type { ReactNode } from 'react'

// Funnel-only chrome. No marketing nav/footer — funnels are deliberately
// isolated from the (site) group. Meta Pixel mounts here in Plan 3.
export default function FunnelLayout({ children }: { children: ReactNode }) {
  // `text-foreground` is REQUIRED here, not cosmetic: `body` sets
  // `text-foreground` which computes to the dark-theme (near-white) color under
  // the app-wide `<html class="dark">`. The funnel subtree would inherit that
  // computed near-white `color` and render illegible on the light background.
  // Re-asserting `text-foreground` inside `.funnel-light` re-resolves `color`
  // to the light-theme foreground for everything that doesn't set its own.
  return <div className="funnel-light min-h-dvh bg-background text-foreground">{children}</div>
}
