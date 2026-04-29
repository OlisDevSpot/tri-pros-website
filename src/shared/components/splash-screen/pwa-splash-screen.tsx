'use client'

import { useEffect, useState } from 'react'
import { SplashOverlay } from '@/shared/components/splash-screen/splash-overlay'
import { useSplashVisibility } from '@/shared/components/splash-screen/use-splash-visibility'

export function PwaSplashScreen() {
  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
  }, [])

  const visible = useSplashVisibility(isStandalone)
  return <SplashOverlay visible={visible} motionKey="pwa-splash" />
}
