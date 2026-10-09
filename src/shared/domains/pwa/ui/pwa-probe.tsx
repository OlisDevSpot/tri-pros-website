'use client'

import { useEffect, useState } from 'react'
import { PWA_STARTUP_IMAGE_SIZES, PWA_STARTUP_IMAGE_VERSION } from '@/shared/domains/pwa/constants/startup-images'
import { isStandalonePWA } from '@/shared/domains/pwa/lib/device'

interface Reading {
  width: number
  height: number
  scale: number
  orientation: string
  standalone: boolean
  userAgent: string
}

function read(): Reading {
  return {
    width: Math.min(screen.width, screen.height),
    height: Math.max(screen.width, screen.height),
    scale: window.devicePixelRatio,
    orientation: screen.orientation?.type ?? (screen.width > screen.height ? 'landscape' : 'portrait'),
    standalone: isStandalonePWA(),
    userAgent: navigator.userAgent,
  }
}

/** What iOS will match a startup image against, read on the device itself; the table is the generator's. */
export function PwaProbe() {
  const [reading, setReading] = useState<Reading | null>(null)
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setReading(read())
    const update = () => setReading(read())
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])
  if (!reading) {
    return <p className="p-6 font-mono text-sm">Reading…</p>
  }
  const covered = PWA_STARTUP_IMAGE_SIZES.some(size => size.width === reading.width && size.height === reading.height && size.scale === reading.scale)
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-6 font-mono text-sm">
      <dt>screen</dt>
      <dd>{`${reading.width} × ${reading.height} @ ${reading.scale}x`}</dd>
      <dt>orientation</dt>
      <dd>{reading.orientation}</dd>
      <dt>standalone</dt>
      <dd>{String(reading.standalone)}</dd>
      <dt>startup image</dt>
      <dd>{covered ? `in table (${PWA_STARTUP_IMAGE_VERSION})` : 'MISSING: add this size to scripts/generate-pwa-splash.ts and rerun it'}</dd>
      <dt>user agent</dt>
      <dd className="break-all">{reading.userAgent}</dd>
    </dl>
  )
}
