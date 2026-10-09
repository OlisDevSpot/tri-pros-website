'use client'

import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { isIOSDevice, isStandalonePWA } from '@/shared/domains/pwa/lib/device'
import { registerServiceWorker } from '@/shared/domains/pwa/lib/register-service-worker'
import { urlBase64ToUint8Array } from '@/shared/domains/pwa/lib/vapid-key'
import { useTRPC } from '@/trpc/helpers'

export type PushSubscriptionStatus
  = | 'loading'
    | 'unsupported' // SW or PushManager missing — desktop Safari pre-16, very old browsers
    | 'needs-install' // iOS but not standalone — push only works in installed PWA
    | 'denied' // Notification.permission === 'denied'
    | 'not-subscribed'
    | 'subscribed'
    | 'error'

export interface UsePushSubscriptionOptions {
  vapidPublicKey?: string
}

export interface UsePushSubscriptionResult {
  status: PushSubscriptionStatus
  error: string | null
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
  busy: boolean
}

// Daily is enough: the drift this catches (Apple's silent invalidation, ITP wipes, DB row loss) never happens mid-day.
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

  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  // eslint-disable-next-line node/prefer-global/process
  const vapidPublicKey = opts.vapidPublicKey ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

  // Reconciles on mount: Apple invalidates subscriptions on an undocumented schedule, ITP wipes idle SWs
  // after ~7 days, and Apple can return 200 for dead endpoints, so the server's 4xx delete isn't reliable.
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

        const registration = await registerServiceWorker()
        if (cancelled) {
          return
        }
        if (!registration) {
          setStatus('unsupported')
          return
        }
        registrationRef.current = registration

        if (Notification.permission === 'denied') {
          setStatus('denied')
          return
        }

        const existing = await registration.pushManager.getSubscription()
        if (existing) {
          // A failed reconcile keeps status 'subscribed': the browser still holds a working subscription.
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
  }, [vapidPublicKey])

  // Must run inside a click handler: Safari requires user activation for requestPermission
  // and pushManager.subscribe, and iOS fails silently from an effect or async chain.
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
      // Even when already granted, requestPermission() spends the Safari user-activation budget — save the gesture for subscribe().
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
      // Roll back the browser subscription so a failed server call leaves no ghost nobody can deliver to.
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
      // A failed server call is only warned: the row is dead either way and 4xx-deletion cleans it up.
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
