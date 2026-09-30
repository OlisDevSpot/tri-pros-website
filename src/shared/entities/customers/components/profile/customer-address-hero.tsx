'use client'

import type { HeroView } from './hero-view-toggle'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { googleMapsClient } from '@/shared/services/providers/google-maps/client'

interface Props {
  address: string | null
  view: HeroView
}

// Backdrop-only component: renders absolutely-positioned map imagery + scrim
// inside a `relative` parent. Parent controls dimensions and owns the view
// state. Static Maps accepts the address string directly, so we build URLs
// client-side and let Google geocode internally — zero extra API calls.
export function CustomerAddressHero({ address, view }: Props) {
  const [imageErrored, setImageErrored] = useState(false)
  const [errorUrl, setErrorUrl] = useState<string | null>(null)
  const keyPresent = googleMapsClient.hasKey()

  useEffect(() => {
    if (!keyPresent) {
      console.warn('[CustomerAddressHero] NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not set. Restart the dev server after updating .env.')
    }
  }, [keyPresent])

  const urls = useMemo(() => {
    if (!address || !keyPresent) {
      return null
    }
    return {
      aerial: googleMapsClient.aerialStaticMapUrl(address),
      map: googleMapsClient.roadmapStaticMapUrl(address),
      street: googleMapsClient.streetViewStaticUrl(address),
    }
  }, [address, keyPresent])

  const hasMap = Boolean(urls && !imageErrored)

  return (
    <>
      {/* Base fallback — always present so the area never feels "broken". Dark in both
          themes: white text and a photo sit on it. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-br from-black/85 via-black/75 to-black"
      />

      {/* Map image layer */}
      {hasMap && urls && (
        <AnimatePresence mode="sync">
          <motion.img
            alt=""
            animate={{ opacity: 1 }}
            className="absolute inset-0 size-full object-cover"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            key={view}
            onError={() => {
              const failedUrl = urls[view]
              const stripped = failedUrl.replace(/([?&])key=[^&]+/, '$1key=REDACTED')
              console.warn('[CustomerAddressHero] Image failed to load. Open this URL in a browser (with the real key) to see Google\'s exact error:', stripped)
              setImageErrored(true)
              setErrorUrl(failedUrl)
            }}
            src={urls[view]}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          />
        </AnimatePresence>
      )}

      {/* Scrim — always present. Stronger at the bottom where the tabs live. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-b from-black/30 via-black/55 to-black/90"
      />

      {/* Dev-only visual hint when the image fails. Helps surface GCP config
          issues (missing API enablement, referrer restrictions, etc.) without
          requiring a trip to the server logs. */}
      {errorUrl && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[60%] rounded-md border border-status-pending-dot/40 bg-status-pending-bg px-2 py-1 text-xs font-medium text-status-pending-fg">
          Map unavailable — check console for diagnostics
        </div>
      )}
    </>
  )
}
