import type { ReactNode } from 'react'

import { headers } from 'next/headers'

import { isProductionHost } from '@/shared/config/is-production-host'
import { PixelLoader } from '@/shared/domains/funnels/lib/tracking/pixel-loader'

// Funnel-only chrome. No marketing nav/footer — funnels are deliberately
// isolated from the (site) group. The Meta Pixel base code loads here (Phase 1)
// but ONLY on the production host: dev/preview/ngrok funnel testing must never
// fire the live pixel (the browser pixel has no test_event_code escape hatch the
// way CAPI does). Gate = host, not NODE_ENV (which is 'production' on Vercel
// previews too). see isProductionHost + providers/meta/DOCS.md.
export default async function FunnelLayout({ children }: { children: ReactNode }) {
  const pixelEnabled = isProductionHost((await headers()).get('host'))
  // `text-foreground` is REQUIRED here, not cosmetic: `body` sets
  // `text-foreground` which computes to the dark-theme (near-white) color under
  // the app-wide `<html class="dark">`. The funnel subtree would inherit that
  // computed near-white `color` and render illegible on the light background.
  // Re-asserting `text-foreground` inside `.funnel-light` re-resolves `color`
  // to the light-theme foreground for everything that doesn't set its own.
  return (
    <div className="funnel-light min-h-dvh bg-background text-foreground">
      {pixelEnabled && <PixelLoader />}
      {children}
    </div>
  )
}
