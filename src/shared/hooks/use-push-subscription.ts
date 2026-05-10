'use client'

import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { urlBase64ToUint8Array } from '@/shared/lib/push'
import { isIOSDevice, isStandalonePWA } from '@/shared/lib/pwa'
import { useTRPC } from '@/trpc/helpers'

// All the states the manager UI needs to render. Driven off the browser
// APIs + the user's current OS context. The flow:
//   loading -> (one of the terminal states)
//   not-subscribed -> (subscribe()) -> subscribed
//   subscribed     -> (unsubscribe()) -> not-subscribed
export type PushSubscriptionStatus
  = | 'loading'
    | 'unsupported' // SW or PushManager missing — desktop Safari pre-16, very old browsers
    | 'needs-install' // iOS but not standalone — push only works in installed PWA
    | 'denied' // Notification.permission === 'denied'
    | 'not-subscribed'
    | 'subscribed'
    | 'error'

export interface UsePushSubscriptionOptions {
  /**
   * VAPID public key. Defaults to NEXT_PUBLIC_VAPID_PUBLIC_KEY which Next.js
   * inlines at build time. Override only if you have a reason (e.g. tests).
   */
  vapidPublicKey?: string
  /**
   * Path to the registered service worker. Must be served from the origin
   * root with no-cache headers (see next.config.ts). Override only for tests.
   */
  swPath?: string
}

export interface UsePushSubscriptionResult {
  status: PushSubscriptionStatus
  error: string | null
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  /** True while a subscribe/unsubscribe network call is in flight. */
  busy: boolean
}

const DEFAULT_SW_PATH = '/sw.js'

// Reconcile cadence: re-POST the existing subscription to the server at
// most once per day per device. The reconcile catches Apple's silent
// invalidation + ITP wipes + DB row loss — but those don't fire mid-day,
// so a 24h cadence covers the cases without billing every page mount.
const RECONCILE_KEY = 'push-reconcile-at'
const RECONCILE_TTL_MS = 24 * 60 * 60 * 1000

function shouldReconcile(): boolean {
  if (typeof window === 'undefined') {
    return false
  }
  const last = localStorage.getItem(RECONCILE_KEY)
  if (!last) {
    return true
  }
  const lastAt = Number.parseInt(last, 10)
  if (Number.isNaN(lastAt)) {
    return true
  }
  return Date.now() - lastAt > RECONCILE_TTL_MS
}

function markReconciled() {
  if (typeof window === 'undefined') {
    return
  }
  localStorage.setItem(RECONCILE_KEY, Date.now().toString())
}

export function usePushSubscription(opts: UsePushSubscriptionOptions = {}): UsePushSubscriptionResult {
  const trpc = useTRPC()
  const subscribeMutation = useMutation(trpc.pushRouter.subscribe.mutationOptions())
  const unsubscribeMutation = useMutation(trpc.pushRouter.unsubscribe.mutationOptions())

  const [status, setStatus] = useState<PushSubscriptionStatus>('loading')
  const [error, setError] = useState<string | null>(null)

  // Cache the registration so subscribe()/unsubscribe() don't have to walk
  // through SW registration every call. Stays null until mount-time setup
  // resolves.
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  // eslint-disable-next-line node/prefer-global/process
  const vapidPublicKey = opts.vapidPublicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''
  const swPath = opts.swPath ?? DEFAULT_SW_PATH

  // ── Mount-time setup + reconcile ───────────────────────────────────────
  // On every app mount we POST whatever the browser thinks is the current
  // subscription back to the server. Apple invalidates subscriptions on a
  // sliding undocumented schedule, ITP can wipe SWs after ~7 days of
  // inactivity, and the server-side delete on 4xx isn't fully reliable
  // (Apple sometimes returns 200 for already-dead endpoints). The upsert
  // is a no-op when the row already exists; cheap insurance against drift.
  useEffect(() => {
    let cancelled = false

    async function setup() {
      try {
        if (typeof window === 'undefined') {
          return
        }
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          if (!cancelled) {
            setStatus('unsupported')
          }
          return
        }
        if (isIOSDevice() && !isStandalonePWA()) {
          if (!cancelled) {
            setStatus('needs-install')
          }
          return
        }
        if (!vapidPublicKey) {
          if (!cancelled) {
            setStatus('error')
            setError('Push is not configured (NEXT_PUBLIC_VAPID_PUBLIC_KEY missing).')
          }
          return
        }

        const registration = await navigator.serviceWorker.register(swPath)
        if (cancelled) {
          return
        }
        registrationRef.current = registration

        if (Notification.permission === 'denied') {
          setStatus('denied')
          return
        }

        const existing = await registration.pushManager.getSubscription()
        if (existing) {
          // Reconcile: re-upsert in case the server lost the row.
          // Throttled to once/24h (RECONCILE_TTL_MS) — drift catching
          // doesn't need same-session granularity. Failures here don't
          // change the user-visible state since the browser still has
          // a working subscription.
          if (shouldReconcile()) {
            subscribeMutation.mutate({
              subscription: existing.toJSON() as {
                endpoint: string
                keys: { p256dh: string, auth: string }
              },
              userAgent: navigator.userAgent,
              platform: navigator.platform || null,
            }, {
              onSuccess: () => markReconciled(),
              onError: err => console.warn('[push] reconcile failed:', err.message),
            })
          }
          if (!cancelled) {
            setStatus('subscribed')
          }
          return
        }

        if (!cancelled) {
          setStatus('not-subscribed')
        }
      }
      catch (err) {
        if (!cancelled) {
          setStatus('error')
          setError(err instanceof Error ? err.message : 'Push setup failed')
        }
      }
    }

    setup()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vapidPublicKey, swPath])

  // ── subscribe ──────────────────────────────────────────────────────────
  // MUST be called from within a click handler — both Notification.requestPermission
  // and pushManager.subscribe require user activation on Safari. Calling
  // them from a useEffect or async chain will silently fail on iOS.
  const subscribe = useCallback(async () => {
    setError(null)
    if (!registrationRef.current) {
      setError('Service worker not ready')
      return
    }
    if (!vapidPublicKey) {
      setError('VAPID public key missing')
      return
    }

    try {
      // Skip the permission prompt if already granted. Even though
      // requestPermission() is a no-op when granted, on Safari it still
      // counts against the user-activation budget — so we save the gesture
      // for the actual pushManager.subscribe call.
      let permission = Notification.permission
      if (permission !== 'granted') {
        permission = await Notification.requestPermission()
      }
      if (permission !== 'granted') {
        setStatus(permission === 'denied' ? 'denied' : 'not-subscribed')
        return
      }

      const sub = await registrationRef.current.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      })

      await subscribeMutation.mutateAsync({
        subscription: sub.toJSON() as {
          endpoint: string
          keys: { p256dh: string, auth: string }
        },
        userAgent: navigator.userAgent,
        platform: navigator.platform || null,
      })

      markReconciled()
      setStatus('subscribed')
    }
    catch (err) {
      // If the server call fails after the browser subscribed, roll back
      // the browser-side subscription so we don't have a ghost on the
      // device that nobody can deliver to.
      try {
        const existing = await registrationRef.current.pushManager.getSubscription()
        if (existing) {
          await existing.unsubscribe()
        }
      }
      catch {
        // best-effort; original error wins below
      }
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Subscribe failed')
    }
  }, [subscribeMutation, vapidPublicKey])

  // ── unsubscribe ────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setError(null)
    if (!registrationRef.current) {
      return
    }
    try {
      const sub = await registrationRef.current.pushManager.getSubscription()
      if (!sub) {
        setStatus('not-subscribed')
        return
      }
      const endpoint = sub.endpoint
      await sub.unsubscribe()
      // Tell the server even if browser-side unsub fails partway — the
      // row is dead either way and our 4xx-deletion would clean it up.
      await unsubscribeMutation.mutateAsync({ endpoint }).catch((err) => {
        console.warn('[push] server unsubscribe failed:', err.message)
      })
      setStatus('not-subscribed')
    }
    catch (err) {
      setStatus('error')
      setError(err instanceof Error ? err.message : 'Unsubscribe failed')
    }
  }, [unsubscribeMutation])

  return {
    status,
    error,
    subscribe,
    unsubscribe,
    busy: subscribeMutation.isPending || unsubscribeMutation.isPending,
  }
}
