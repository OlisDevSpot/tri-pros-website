import { PWA_SW_DISABLED_KEY } from '@/shared/domains/pwa/constants/storage-keys'
import { isStandalonePWA } from '@/shared/domains/pwa/lib/device'

// A document served by a worker under `next dev` never hydrates, so only production builds register
// the shell-serving variant; the worker reads the flag from its own URL.
// eslint-disable-next-line node/prefer-global/process
const SW_URL = process.env.NODE_ENV === 'production' ? '/sw.js?shell=1' : '/sw.js'
const OPTIONS: RegistrationOptions = { scope: '/', updateViaCache: 'none' }

let pending: Promise<ServiceWorkerRegistration | null> | undefined

function isSwitchedOff(): boolean {
  // eslint-disable-next-line node/prefer-global/process
  if (process.env.NEXT_PUBLIC_SW_DISABLED === '1') {
    return true
  }
  try {
    return localStorage.getItem(PWA_SW_DISABLED_KEY) === '1'
  }
  catch {
    return false
  }
}

/**
 * The one place that registers the worker. Every caller passes the same URL and options, so the calls
 * collapse into one registration and the push subscription stays bound to it. Switched off (the build
 * env or the device switch) it removes every registration and cache instead, so the worker cannot come
 * back on the next load.
 */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return Promise.resolve(null)
  }
  pending ??= (isSwitchedOff() ? remove() : register()).catch((error) => {
    pending = undefined
    throw error
  })
  return pending
}

async function register(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register(SW_URL, OPTIONS)
  if (isStandalonePWA() && navigator.storage?.persist) {
    // Granted silently to an installed app; the answer changes nothing here.
    void navigator.storage.persist().catch(() => false)
  }
  return registration
}

async function remove(): Promise<null> {
  const registrations = await navigator.serviceWorker.getRegistrations()
  await Promise.all(registrations.map(registration => registration.unregister()))
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map(key => caches.delete(key)))
  }
  return null
}

/** Asks the controlling worker to refresh its launch shell; a no-op without one. */
export function requestShellRevalidation(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return
  }
  navigator.serviceWorker.controller?.postMessage({ type: 'tpr:revalidate-shell' })
}
