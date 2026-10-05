'use client'

import { useEffect, useState } from 'react'
import { SplashScreen } from '@/shared/components/splash-screen/splash-screen'
import { sessionStorageKey } from '@/shared/constants/storage-keys'
import { useSessionOnce } from '@/shared/hooks/use-session-once'

export function PwaSplashScreen() {
  const [isStandalone, setIsStandalone] = useState(false)
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches)
  }, [])

  const [open, onDismiss] = useSessionOnce(sessionStorageKey('app-splash-shown'), isStandalone)
  return <SplashScreen dismiss={{ mode: 'timed' }} open={open} onDismiss={onDismiss} />
}
