import { PWA_LAUNCH_COVER_MAX_MS, PWA_LAUNCH_COVER_MIN_MS } from '@/shared/domains/pwa/constants/launch'

export type PwaLaunchPhase = 'idle' | 'covering' | 'done'

interface Timers {
  now: () => number
  setTimeout: (fn: () => void, ms: number) => unknown
  clearTimeout: (handle: unknown) => void
}

/**
 * The cover's clock. `begin` is the shell's first client render; `ready` is the dashboard layout
 * committed under the cover, skeletons and all. The floor keeps a warm launch from blinking, the bound
 * keeps a launch the server never answers from locking. A factory, so the clock can be faked.
 */
export function createPwaLaunchStore(timers: Timers) {
  let phase: PwaLaunchPhase = 'idle'
  let beganAt = 0
  let bound: unknown
  let floor: unknown
  const listeners = new Set<() => void>()

  function setPhase(next: PwaLaunchPhase) {
    if (phase === next) {
      return
    }
    phase = next
    for (const listener of listeners) {
      listener()
    }
  }

  function finish() {
    timers.clearTimeout(bound)
    timers.clearTimeout(floor)
    bound = undefined
    floor = undefined
    setPhase('done')
  }

  return {
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    phase: () => phase,
    begin() {
      if (phase !== 'idle') {
        return
      }
      beganAt = timers.now()
      setPhase('covering')
      bound = timers.setTimeout(finish, PWA_LAUNCH_COVER_MAX_MS)
    },
    ready() {
      if (phase !== 'covering' || floor !== undefined) {
        return
      }
      floor = timers.setTimeout(finish, Math.max(0, beganAt + PWA_LAUNCH_COVER_MIN_MS - timers.now()))
    },
  }
}

export const pwaLaunch = createPwaLaunchStore({
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
})
