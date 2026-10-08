/* eslint-disable */
// Tri Pros service worker: push + deep-link handlers, plus the installed app's launch shell.
//
// Launch shell — the installed app's start_url is /dashboard?launch=1 (src/shared/domains/pwa/constants/launch.ts;
// the literals below mirror it, change them together). For that one navigation the worker answers from
// Cache Storage with the static /launch document and the chunks it references, precached as one set so a
// deploy can never leave a cached document pointing at chunks the server no longer has. Every other
// navigation goes to the network untouched — a push deep link is one of them. Only a production build
// registers this script with ?shell=1: a document served by a worker under `next dev` never hydrates.
//
// Three event handlers cover all the iOS PWA push paths:
//   - `push`                    → imperative fallback (iOS 16.4–18.3)
//   - `notificationclick`       → deep-link routing on every iOS version
//   - `pushsubscriptionchange`  → best-effort renewal when Apple rotates
//
// On iOS 18.4+ (Safari Declarative Web Push), the browser unwraps the
// payload natively and never invokes our `push` handler. The SW still
// runs `notificationclick` because the *click* always goes through us.

const SHELL_ON = new URL(self.location.href).searchParams.get('shell') === '1'
const LAUNCH_PATH = '/dashboard'
const LAUNCH_SEARCH = '?launch=1'
const SHELL_PATH = '/launch'
const SHELL_CACHE = 'tpr-launch-shell'
const STATIC_PREFIX = '/_next/static/'
const SHELL_FETCH_TIMEOUT_MS = 15000
const LAUNCH_URL = new URL(LAUNCH_PATH + LAUNCH_SEARCH, self.location.origin).href

self.addEventListener('install', (event) => {
  // Take control on first install instead of waiting for the next reload.
  self.skipWaiting()
  if (!SHELL_ON) return
  // A failed precache must never fail the install: push has to keep working.
  event.waitUntil(syncShell().catch(() => {}))
  addStaticRoutes(event)
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    await self.clients.claim()
    if (!SHELL_ON) return
    try {
      const keys = await caches.keys()
      await Promise.all(keys
        .filter(key => key !== SHELL_CACHE && (key.startsWith('tpr-launch-shell') || key.startsWith('app-shell-')))
        .map(key => caches.delete(key)))
    } catch (_err) {
      // Cache Storage unavailable (private modes): nothing to clean, and preload must still be enabled below.
    }
    if (self.registration.navigationPreload) {
      await self.registration.navigationPreload.enable().catch(() => {})
    }
  })())
})

// Chrome 123+: the launch document and the precached chunks come from Cache Storage without starting the
// worker, and every other same-origin request goes straight to the network, so the public site never pays
// a worker boot. Safari takes the fetch handler below instead.
function addStaticRoutes(event) {
  if (typeof event.addRoutes !== 'function') return
  try {
    event.addRoutes([
      { condition: { urlPattern: { pathname: LAUNCH_PATH, search: LAUNCH_SEARCH.slice(1) }, requestMode: 'navigate' }, source: { cacheName: SHELL_CACHE } },
      { condition: { urlPattern: { pathname: STATIC_PREFIX + '*' } }, source: { cacheName: SHELL_CACHE } },
      { condition: { urlPattern: { pathname: '/*' } }, source: 'network' },
    ]).catch(() => {})
  } catch (_err) {
    // A Chrome that rejects the shape: the fetch handler covers it.
  }
}

self.addEventListener('fetch', (event) => {
  if (!SHELL_ON) return
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    if (isLaunchNavigation(request, url)) {
      event.respondWith(serveShell(event))
    }
    // Every other navigation is left to the browser, which uses the preload response when one exists.
    return
  }
  if (url.pathname.startsWith(STATIC_PREFIX)) {
    event.respondWith(
      caches.open(SHELL_CACHE)
        .then(cache => cache.match(request))
        .then(hit => hit || fetch(request))
        .catch(() => fetch(request)),
    )
  }
})

self.addEventListener('message', (event) => {
  if (!SHELL_ON || !event.data || event.data.type !== 'tpr:revalidate-shell') return
  event.waitUntil(syncShell().catch(() => {}))
})

function isLaunchNavigation(request, url) {
  return url.pathname === LAUNCH_PATH
    && url.search === LAUNCH_SEARCH
    && !request.headers.has('rsc')
    && !request.headers.has('next-router-prefetch')
}

async function serveShell(event) {
  try {
    const cache = await caches.open(SHELL_CACHE)
    const hit = await cache.match(LAUNCH_URL)
    if (hit) {
      event.waitUntil(syncShell().catch(() => {}))
      return hit
    }
  } catch (_err) {
    // Cache Storage unavailable: the network answers, as on every launch before the shell existed.
  }
  event.waitUntil(syncShell().catch(() => {}))
  const preloaded = await Promise.resolve(event.preloadResponse).catch(() => undefined)
  return preloaded || fetch(event.request)
}

// A cache-hit launch and the page's revalidate message can ask for a sync in the same instant; two running at
// once could each prune the chunks the other's document needs, so one runs and later callers share it.
let syncInFlight = null

function syncShell() {
  if (!syncInFlight) {
    syncInFlight = writeShell().finally(() => { syncInFlight = null })
  }
  return syncInFlight
}

// The shell and the chunks it references are one set: assets go in first and the document last, so a
// launch during the swap finds a complete set or none, and the document never points at a chunk the
// cache lacks. An unchanged document costs one fetch and no writes.
async function writeShell() {
  const cache = await caches.open(SHELL_CACHE)
  const fresh = await fetchShell()
  const current = await cache.match(LAUNCH_URL)
  if (current && (await current.text()) === fresh.html) return
  const assets = staticUrls(fresh.html)
  const fetched = await Promise.all(assets.map(async (asset) => {
    if (await cache.match(asset)) return null
    const response = await fetch(asset, { credentials: 'omit', signal: shellFetchSignal() })
    if (!response.ok) throw new Error(`asset ${response.status}: ${asset}`)
    return [asset, response]
  }))
  for (const entry of fetched) {
    if (entry) await cache.put(entry[0], entry[1])
  }
  await cache.put(LAUNCH_URL, new Response(fresh.html, {
    status: 200,
    headers: { 'content-type': fresh.contentType, 'cache-control': 'no-store' },
  }))
  const keep = new Set(assets)
  const keys = await cache.keys()
  await Promise.all(keys
    .filter(key => key.url.includes(STATIC_PREFIX) && !keep.has(key.url))
    .map(key => cache.delete(key)))
}

// A hung shell or chunk request would hold the install, and a fresh install must activate before push can
// subscribe, so every precache fetch gives up after a bound.
function shellFetchSignal() {
  return typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(SHELL_FETCH_TIMEOUT_MS)
    : undefined
}

async function fetchShell() {
  const response = await fetch(SHELL_PATH, { cache: 'reload', credentials: 'omit', signal: shellFetchSignal() })
  const contentType = response.headers.get('content-type') || ''
  if (!response.ok || response.status !== 200 || response.redirected || !contentType.includes('text/html')) {
    throw new Error(`shell ${response.status} ${contentType}`)
  }
  return { html: await response.text(), contentType }
}

// Every same-origin /_next/static URL the document references (scripts, stylesheets, fonts), with its
// ?dpl= deployment tag; HTML escapes `&` inside attributes.
function staticUrls(html) {
  const urls = new Set()
  const attribute = /(?:src|href)="(\/_next\/static\/[^"]+)"/g
  let match
  while ((match = attribute.exec(html)) !== null) {
    urls.add(new URL(match[1].replace(/&amp;/g, '&'), self.location.origin).href)
  }
  return [...urls]
}

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
