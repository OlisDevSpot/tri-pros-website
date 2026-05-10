/* eslint-disable */
// Tri Pros service worker — push + deep-link only. We deliberately do NOT
// add offline caching here; if/when we want it, fold a Workbox/Serwist
// runtime-cache layer into this file rather than spinning up a new SW.
//
// Three event handlers cover all the iOS PWA push paths:
//   - `push`                    → imperative fallback (iOS 16.4–18.3)
//   - `notificationclick`       → deep-link routing on every iOS version
//   - `pushsubscriptionchange`  → best-effort renewal when Apple rotates
//
// On iOS 18.4+ (Safari Declarative Web Push), the browser unwraps the
// payload natively and never invokes our `push` handler. The SW still
// runs `notificationclick` because the *click* always goes through us.

self.addEventListener('install', () => {
  // Take control on first install instead of waiting for the next reload.
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

// ── push: imperative fallback for iOS 16.4–18.3 / Chromium ──────────────
//
// Apple's Declarative Web Push only kicks in on iOS 18.4+. On older iOS
// (16.4–18.3) and Chromium, the browser delivers the raw JSON to us and
// expects `showNotification` to be called from this handler.
self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch (_err) {
    payload = { title: 'Tri Pros', body: event.data.text() }
  }

  // Two payload shapes we accept:
  //   1. Declarative format: { web_push: 8030, notification: { ... } }
  //   2. Legacy/imperative:  { title, body, navigate, ... }
  const notif = payload && payload.notification ? payload.notification : payload
  const title = notif.title || 'Tri Pros'

  const options = {
    body: notif.body,
    icon: notif.icon || '/pwa/icon-192.png',
    badge: notif.badge || '/pwa/icon-192.png',
    tag: notif.tag,
    silent: notif.silent === true,
    // Stash navigate on data so notificationclick can read it. iOS does
    // not support `data` in Declarative Web Push, so this codepath only
    // executes for the imperative fallback.
    data: { navigate: notif.navigate || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// ── notificationclick: deep-link router on every iOS version ────────────
//
// preventDefault() is REQUIRED on iOS — without it, iOS silently ignores
// our openWindow/focus and just opens the manifest's start_url. This bug
// has persisted across iOS 16.x, 17.x, and 18.x.
self.addEventListener('notificationclick', (event) => {
  event.preventDefault()
  event.notification.close()

  const navigateRaw =
    (event.notification.data && event.notification.data.navigate) || '/'

  // Resolve relative paths against the SW's origin so openWindow gets an
  // absolute URL (some browser/iOS combos otherwise fail silently).
  const target = new URL(navigateRaw, self.location.origin).href

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })

      // Prefer focusing+navigating an already-open window of our origin.
      // This avoids spawning duplicate tabs/standalone windows.
      for (const client of allClients) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus()
          if ('navigate' in client && typeof client.navigate === 'function') {
            try {
              await client.navigate(target)
            } catch (_err) {
              // Some browsers reject cross-origin navigate even within scope.
              // Falling through to openWindow is the right escape hatch.
            }
          }
          return
        }
      }

      await self.clients.openWindow(target)
    })()
  )
})

// ── pushsubscriptionchange: log only ────────────────────────────────────
//
// Apple/Google can rotate subscription endpoints at any time. WebKit's
// support for this event has been spotty historically and the SW has no
// reliable way to call our tRPC API (no superjson, no auth context). We
// rely on the client-side reconcile-on-mount in usePushSubscription as
// the real safety net — this handler only logs.
self.addEventListener('pushsubscriptionchange', (event) => {
  console.warn('[sw] pushsubscriptionchange — client will reconcile on next mount', event)
})
