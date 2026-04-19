'use client'

import type { HeroView } from './hero-view-toggle'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import {
  buildAerialStaticMapUrl,
  buildRoadmapStaticMapUrl,
  buildStreetViewStaticUrl,
  hasGoogleMapsKey,
} from '@/shared/services/google-maps/static-urls'

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
  const keyPresent = hasGoogleMapsKey()

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
      aerial: buildAerialStaticMapUrl(address),
      map: buildRoadmapStaticMapUrl(address),
      street: buildStreetViewStaticUrl(address),
    }
  }, [address, keyPresent])

  const hasMap = Boolean(urls && !imageErrored)

  return (
    <>
      {/* Base fallback — always present so the area never feels "broken". */}
      <div
        aria-hidden
        className="absolute inset-0 bg-linear-to-br from-slate-900 via-slate-800 to-slate-950"
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
        className="absolute inset-0 bg-linear-to-b from-slate-950/30 via-slate-950/55 to-slate-950/90"
      />

      {/* Dev-only visual hint when the image fails. Helps surface GCP config
          issues (missing API enablement, referrer restrictions, etc.) without
          requiring a trip to the server logs. */}
      {errorUrl && (
        <div className="pointer-events-none absolute bottom-3 left-3 z-20 max-w-[60%] rounded-md border border-amber-500/25 bg-amber-500/15 px-2 py-1 text-[10px] font-medium text-amber-100 backdrop-blur-sm">
          Map unavailable — check console for diagnostics
        </div>
      )}
    </>
  )
}
