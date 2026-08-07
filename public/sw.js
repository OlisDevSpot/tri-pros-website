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

// ── App-shell instant-launch cache (additive; see docs/superpowers/specs/
//    2026-08-06-pwa-app-shell-service-worker-design.md) ───────────────────
const SHELL_VERSION = '1' // bump manually whenever /app-shell.html changes
const SHELL_CACHE = 'app-shell-v' + SHELL_VERSION
const SHELL_URL = '/app-shell.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.add(new Request(SHELL_URL, { cache: 'reload' })),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('app-shell-') && k !== SHELL_CACHE)
          .map((k) => caches.delete(k)),
      ),
    ),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return

  let url
  try {
    url = new URL(req.url)
  } catch (_e) {
    return
  }

  if (url.origin !== self.location.origin) return
  // Never touch dev on desktop; ngrok/preview/prod are allowed so the shell
  // is testable over the tunnel (the shell is a static file, not build chunks).
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') return
  if (url.pathname === '/sw.js') return
  if (url.pathname.startsWith('/_next/')) return
  if (url.pathname.startsWith('/api/')) return
  if (url.searchParams.has('_rsc')) return
  if (req.headers.get('RSC') || req.headers.get('Next-Router-State-Tree')) return

  // Only the exact home-screen cold-launch URL gets the instant shell.
  if (url.pathname !== '/dashboard' || !url.searchParams.has('source')) return
  if (url.searchParams.get('source') !== 'pwa') return

  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE })
        if (cached) return cached
      } catch (_e) {
        // fall through to network on the iOS 16.4+ respondWith bug
      }
      return fetch(req)
    })(),
  )
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
