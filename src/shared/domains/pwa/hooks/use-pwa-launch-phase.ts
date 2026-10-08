'use client'

import type { PwaLaunchPhase } from '@/shared/domains/pwa/lib/launch-store'
import { useSyncExternalStore } from 'react'
import { pwaLaunch } from '@/shared/domains/pwa/lib/launch-store'

/** The server snapshot is `idle`, and so is the client's first one, so the shell document hydrates against its own HTML. */
export function usePwaLaunchPhase(): PwaLaunchPhase {
  return useSyncExternalStore(pwaLaunch.subscribe, pwaLaunch.phase, () => 'idle')
}
