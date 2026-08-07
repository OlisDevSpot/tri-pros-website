'use client'

import { SplashAnimation } from '@/shared/components/splash-screen/splash-animation'

export function PwaSplashOverlay({ hidden }: { hidden: boolean }) {
  return (
    <div className="pwa-splash-overlay" data-hidden={hidden} aria-hidden={hidden}>
      <SplashAnimation />
    </div>
  )
}
