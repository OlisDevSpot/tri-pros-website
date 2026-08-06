# PWA Instant-Launch App Shell (Service Worker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the installed iOS PWA paint an instant dark splash on cold launch (from launch #2 onward) instead of a long white hang, by extending the existing hand-written service worker with a static app-shell precache + a tightly-scoped navigation fetch, and making the real dashboard's splash cover the shell→document handoff seamlessly.

**Architecture:** `tap → native startup image → SW serves cached /app-shell.html instantly (dark + logo) → shell location.replace('/dashboard') → real dashboard HTML arrives with the same splash covering from frame 1 (standalone) → hydrate → splash dismisses`. All stages dark `#09090b`. Launch #1 (SW not yet active) falls through to network (best-effort). Every SW path fails open to network.

**Tech Stack:** Next.js 15 App Router, hand-written `public/sw.js` (no Serwist/next-pwa), `motion/react`, Tailwind v4, next-themes.

## Global Constraints

- Verify with `pnpm tsc` + `pnpm lint` ONLY. NEVER `pnpm build`, NEVER `pnpm dev` (from a subagent).
- Work on `main`; stage explicitly by path; NEVER `git add -A`. End commits with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Do NOT touch the existing push/notificationclick/pushsubscriptionchange handlers in `public/sw.js`.** All SW changes are ADDITIVE (new listeners / additive logic).
- SW fetch handler: intercept ONLY `GET` + `req.mode === 'navigate'` + same-origin + `pathname === '/dashboard'` + `search` contains `source=pwa`. Exclude `/sw.js`, `/_next/`, `/api/`, `?_rsc=`, `RSC`/`Next-Router-State-Tree` headers, and hostnames `localhost`/`127.0.0.1`. On any miss/error, `return fetch(req)` (fail open). Wrap in try/catch (iOS 16.4+ `respondWith` bug).
- Splash overlay color is `#09090b` (matches manifest `background_color` + startup images). Dark canvas is PWA-scoped (`@media (display-mode: standalone)`) so browser FOUC never returns.
- Path alias `@/` → `src/`.

---

### Task 1: Static app-shell document

The instant-paint shell the SW serves on cold launch: a fully self-contained HTML file (no Next, no auth, no external assets) — dark `#09090b` + centered static TPR mark with a gentle pulse — that immediately hands off to the real dashboard.

**Files:**
- Create: `public/app-shell.html`
- Read for the mark: `src/shared/components/splash-screen/splash-paths.ts` (`HOUSE_PATHS`, `R_PATH`) and `src/shared/components/splash-screen/splash-animation.tsx` (viewBox `0 0 589 463`, house fill `white`, R fill `#03AFED`)

**Interfaces:**
- Consumes: nothing.
- Produces: `/app-shell.html` served statically; contains a centered SVG using the same `HOUSE_PATHS` + `R_PATH` as the in-app splash (static, no motion), on `#09090b`, and an inline `<script>` that runs `location.replace('/dashboard')`.

- [ ] **Step 1: Create `public/app-shell.html`**

Read `splash-paths.ts` and inline the SAME `HOUSE_PATHS` (each as a `<path fill="white" d="…"/>`) and `R_PATH` (`<path fill="#03AFED" d="…"/>`) into a single static SVG (viewBox `0 0 589 463`), so the shell mark matches the in-app splash's resting frame. Everything inline — no external CSS/JS/font/image. Template:

```html
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Tri Pros</title>
<style>
  html, body { margin: 0; height: 100%; background: #09090b; }
  .wrap { display: flex; height: 100vh; align-items: center; justify-content: center; }
  .mark { width: 12rem; height: auto; animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 0%,100% { opacity: .85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.03); } }
  @media (prefers-reduced-motion: reduce) { .mark { animation: none; } }
</style>
</head>
<body>
  <div class="wrap">
    <svg class="mark" viewBox="0 0 589 463" fill="none" xmlns="http://www.w3.org/2000/svg">
      <!-- inline each HOUSE_PATHS entry as <path fill="white" d="..."/> -->
      <!-- then R_PATH as <path fill="#03AFED" d="..."/> -->
    </svg>
  </div>
  <script>
    // Hand off immediately to the real, network-verified, auth-gated route.
    // '/dashboard' has NO ?source=pwa marker, so the SW does NOT re-intercept it.
    location.replace('/dashboard');
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify it's served and self-contained**

Run `pnpm lint` (HTML isn't linted, but confirm no repo lint config chokes). Then confirm the file has NO external references:

Run: `grep -nE '<link|<script[^>]*src=|url\(|https?://|/_next/' public/app-shell.html`
Expected: no matches except the inline `<script>` (which has no `src`). If any external ref appears, inline or remove it.

- [ ] **Step 3: Commit**

```bash
git add public/app-shell.html
git commit public/app-shell.html -m "$(cat <<'EOF'
feat(pwa): static app-shell document for instant cold-launch paint

Self-contained dark #09090b shell with the TPR splash mark (static) that
the service worker serves instantly on cold launch, then hands off to the
real /dashboard. No Next/auth/external assets so it precaches as one file.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Manifest start_url launch marker

Give the SW a deterministic signal that a navigation is a genuine home-screen cold launch (vs in-app nav), by tagging the manifest `start_url`.

**Files:**
- Modify: `src/app/manifest.ts:7`

**Interfaces:**
- Consumes: nothing.
- Produces: manifest `start_url: '/dashboard?source=pwa'` (the marker the SW fetch handler keys on in Task 3). `scope: '/'` unchanged.

- [ ] **Step 1: Change start_url**

In `src/app/manifest.ts`, change `start_url: '/dashboard',` to `start_url: '/dashboard?source=pwa',`. Leave `scope: '/'` and the deep-link comment above it untouched (scope must stay `/` for push deep-links).

- [ ] **Step 2: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/app/manifest.ts
git commit src/app/manifest.ts -m "$(cat <<'EOF'
feat(pwa): tag start_url with ?source=pwa launch marker

Lets the service worker distinguish a genuine home-screen cold launch from
in-app navigation, so it only serves the app-shell for the real launch.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Extend the service worker with app-shell precache + scoped navigation serve

Add install (precache shell), activate (clean old shell caches), and a tightly-scoped fetch (serve shell for the launch URL only) to `public/sw.js` — ADDITIVELY, leaving all existing push code untouched.

**Files:**
- Modify: `public/sw.js` (add new listeners; do NOT alter existing `push`/`notificationclick`/`pushsubscriptionchange`)

**Interfaces:**
- Consumes: `/app-shell.html` (Task 1), the `?source=pwa` marker (Task 2).
- Produces: a SW that serves `/app-shell.html` from cache for `GET`+navigate+`/dashboard?source=pwa`, failing open to network otherwise.

- [ ] **Step 1: Add shell precache + activate cleanup + fetch handler**

Insert this block into `public/sw.js` (e.g. directly below the existing `activate` handler, above the `push` handler). Do NOT modify the existing `install` (`skipWaiting`) or `activate` (`clients.claim`) handlers — these ADD alongside them (multiple listeners for the same event all run):

```js
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
```

- [ ] **Step 2: Confirm existing push handlers are untouched**

Run: `git diff public/sw.js`
Expected: ONLY additions (the block above). The `push`, `notificationclick`, `pushsubscriptionchange` handlers and their comments must appear unchanged in the diff (as context, not modified). If any existing line changed, revert it.

- [ ] **Step 3: Lint the SW**

Run: `pnpm lint`
Expected: PASS (`public/sw.js` starts with `/* eslint-disable */`, so lint should not flag it; confirm no config error).

- [ ] **Step 4: Commit**

```bash
git add public/sw.js
git commit public/sw.js -m "$(cat <<'EOF'
feat(pwa): app-shell precache + scoped navigation serve in sw.js

Additive install/activate/fetch: precache /app-shell.html and serve it
instantly for GET+navigate to /dashboard?source=pwa, failing open to
network for everything else (excludes /_next, /api, RSC, /sw.js, localhost).
Existing push/notification handlers untouched.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Register the service worker eagerly

Today the SW registers lazily inside the push hook. Register it eagerly on every app load so it's installed/active in time to shell-serve the NEXT launch.

**Files:**
- Create: `src/shared/components/pwa/service-worker-registrar.tsx`
- Modify: `src/app/(frontend)/layout.tsx` (mount the registrar inside `<Providers>`, near `<PwaSplashScreen />`)

**Interfaces:**
- Consumes: `/sw.js`.
- Produces: a mounted client component that calls `navigator.serviceWorker.register('/sw.js')` once on mount. Idempotent with the push hook's identical `register('/sw.js')` (same script URL → same registration).

- [ ] **Step 1: Create the registrar component**

```tsx
'use client'

import { useEffect } from 'react'

// Registers the service worker as early as possible so it is active in time
// to serve the app-shell on the NEXT cold launch. The push hook also calls
// register('/sw.js'); registering the same script URL twice is idempotent.
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
      return
    }
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] eager registration failed:', err)
    })
  }, [])

  return null
}
```

- [ ] **Step 2: Mount it in the root layout**

In `src/app/(frontend)/layout.tsx`, import `ServiceWorkerRegistrar` and render it inside `<Providers>` next to `<PwaSplashScreen />`:

```tsx
        <Providers>
          <ServiceWorkerRegistrar />
          <PwaSplashScreen />
          {children}
        </Providers>
```

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/components/pwa/service-worker-registrar.tsx src/app/\(frontend\)/layout.tsx
git commit src/shared/components/pwa/service-worker-registrar.tsx src/app/\(frontend\)/layout.tsx -m "$(cat <<'EOF'
feat(pwa): register service worker eagerly on app load

So the SW is active in time to serve the app-shell on the next cold launch,
instead of only registering lazily when the push UI mounts.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Splash covers from frame 1 (standalone) + dark canvas

Rework the splash so the overlay covers the screen on the FIRST paint in standalone mode (not two effects late) and the pre-splash canvas is dark — so the shell→real-document handoff is seamless and there is no content-behind-splash flash. Scoped to `display-mode: standalone` so browsers keep the (already-shipped) FOUC-free behavior.

**Files:**
- Modify: `src/app/(frontend)/globals.css` (add standalone dark canvas + `.pwa-splash-overlay` rules)
- Rewrite: `src/shared/components/splash-screen/use-splash-visibility.ts`
- Rewrite: `src/shared/components/splash-screen/pwa-splash-screen.tsx`
- Rewrite: `src/shared/components/splash-screen/splash-overlay.tsx`
- Leave unchanged: `src/shared/components/splash-screen/splash-animation.tsx`, `splash-paths.ts`

**Interfaces:**
- Consumes: `motion/react` `SplashAnimation` (unchanged).
- Produces: a splash overlay present in the initial SSR HTML, shown only in standalone via CSS (covers from frame 1), dismissed on ready (min floor + max cap) with a CSS opacity fade, then unmounted. Replaces the old `SPLASH_VISIBLE_MS = 1100` timer + `visible`-gated `AnimatePresence`.

- [ ] **Step 1: Add CSS — standalone dark canvas + overlay rules**

In `src/app/(frontend)/globals.css`, add (place near the existing app-shell/theme rules; do not disturb `:root`/`.dark`/`.theme-marketing`):

```css
/* Installed-PWA launch: dark canvas from the first frame so the app-shell
   → dashboard handoff never flashes white. Scoped to standalone so browser
   theme resolution (and its FOUC-free behavior) is untouched. */
@media (display-mode: standalone) {
  html {
    background-color: #09090b;
  }
}

/* Splash overlay: present in the initial HTML, but only shown in standalone
   (so it covers from frame 1 on PWA launch and never appears in a browser). */
.pwa-splash-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: none;
  align-items: center;
  justify-content: center;
  background-color: #09090b;
  opacity: 1;
  transition: opacity 0.3s ease-out;
}
@media (display-mode: standalone) {
  .pwa-splash-overlay {
    display: flex;
  }
}
.pwa-splash-overlay[data-hidden='true'] {
  opacity: 0;
  pointer-events: none;
}
```

- [ ] **Step 2: Rewrite `use-splash-visibility.ts` as a dismiss hook**

```ts
'use client'

import { useEffect, useState } from 'react'

const SPLASH_SESSION_KEY = 'app-splash-shown'
// Minimum on-screen time so the splash never flickers; max cap so a slow
// launch can never trap the user behind it. Dismissal fires at the later of
// (first paint after hydration) and MIN, or at MAX, whichever comes first.
const MIN_VISIBLE_MS = 900
const MAX_VISIBLE_MS = 8000

/**
 * Returns whether the splash should be dismissed (faded out). Starts false so
 * the overlay is present in the initial (SSR) paint — the CSS gate shows it
 * only in standalone. Flips true when the app is ready (or at the cap).
 */
export function useSplashDismissed(): boolean {
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches
    if (!standalone || sessionStorage.getItem(SPLASH_SESSION_KEY)) {
      // Browser, or already shown this session → remove without a splash.
      // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
      setDismissed(true)
      return
    }
    sessionStorage.setItem(SPLASH_SESSION_KEY, '1')

    const start = performance.now()
    let done = false
    const finish = () => {
      if (done) {
        return
      }
      done = true
      const wait = Math.max(0, MIN_VISIBLE_MS - (performance.now() - start))
      window.setTimeout(() => setDismissed(true), wait)
    }

    const cap = window.setTimeout(finish, MAX_VISIBLE_MS)
    // "Ready" ≈ the first paint after hydration (two RAFs). For the current
    // static overview this is near-immediate, so MIN_VISIBLE_MS dominates.
    const raf = requestAnimationFrame(() => requestAnimationFrame(finish))

    return () => {
      window.clearTimeout(cap)
      cancelAnimationFrame(raf)
    }
  }, [])

  return dismissed
}
```

- [ ] **Step 3: Rewrite `splash-overlay.tsx`**

```tsx
'use client'

import { SplashAnimation } from '@/shared/components/splash-screen/splash-animation'

export function SplashOverlay({ hidden }: { hidden: boolean }) {
  return (
    <div className="pwa-splash-overlay" data-hidden={hidden} aria-hidden={hidden}>
      <SplashAnimation />
    </div>
  )
}
```

- [ ] **Step 4: Rewrite `pwa-splash-screen.tsx`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { SplashOverlay } from '@/shared/components/splash-screen/splash-overlay'
import { useSplashDismissed } from '@/shared/components/splash-screen/use-splash-visibility'

export function PwaSplashScreen() {
  const dismissed = useSplashDismissed()
  const [removed, setRemoved] = useState(false)

  useEffect(() => {
    if (!dismissed) {
      return
    }
    // Unmount after the 300ms opacity fade (see .pwa-splash-overlay CSS).
    const t = window.setTimeout(() => setRemoved(true), 350)
    return () => window.clearTimeout(t)
  }, [dismissed])

  if (removed) {
    return null
  }
  return <SplashOverlay hidden={dismissed} />
}
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. Fix any unused-import/type errors from the rewrites (the old `AnimatePresence`/`motion` imports in `splash-overlay.tsx` are gone; ensure nothing else imports the removed `useSplashVisibility` name — grep and update).

Run: `grep -rn "useSplashVisibility\|SPLASH_VISIBLE_MS" src`
Expected: no matches (old names fully removed).

- [ ] **Step 6: Manual browser verification (no regression in browser)**

`pnpm dev`, open `/dashboard` in a normal browser (light theme):
- No splash overlay appears (CSS `display:none` outside standalone).
- No dark→light FOUC; `html` background matches theme (standalone dark canvas does NOT apply in a browser tab).
DevTools → toggle `display-mode: standalone` emulation + clear `sessionStorage['app-splash-shown']`, reload:
- Splash covers from the first paint (no content flash before it), animation plays, fades out after ~1s.
Expected: both behaviors correct.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(frontend\)/globals.css src/shared/components/splash-screen/use-splash-visibility.ts src/shared/components/splash-screen/pwa-splash-screen.tsx src/shared/components/splash-screen/splash-overlay.tsx
git commit src/app/\(frontend\)/globals.css src/shared/components/splash-screen/use-splash-visibility.ts src/shared/components/splash-screen/pwa-splash-screen.tsx src/shared/components/splash-screen/splash-overlay.tsx -m "$(cat <<'EOF'
fix(pwa): splash covers from frame 1 in standalone + dark canvas

Overlay now renders in the initial paint (shown only in standalone via CSS)
so the app-shell → dashboard handoff never flashes content/white; dismisses
on ready with a min floor + max cap instead of a fixed 1100ms timer. Adds a
PWA-scoped dark html canvas so pre-splash frames are dark, not white, without
reintroducing browser FOUC.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## End-to-end verification (after all tasks)

- `pnpm tsc` + `pnpm lint` clean.
- **On a real iOS device over `dev:mobile`+ngrok OR a Vercel Preview Deploy** (preview is the truer test — no dev-compile):
  1. Install the PWA (Add to Home Screen). **Launch #1:** best-effort — may still be white during the first cold start (SW not yet active). Expected.
  2. Fully close, **launch #2:** expect an **instant dark splash** (the shell) holding through the cold-start wait, seamlessly into the dashboard. No white, no content-behind-splash flash.
  3. In-app navigation still works and does NOT get shell-served (App Router soft-nav; no document fetch).
  4. **Push + deep-link regression check:** send a push, tap it — still deep-links correctly (the whole reason we didn't clobber `sw.js`).
- DevTools (Application tab): SW active; Cache Storage has `app-shell-v1` containing `/app-shell.html`; a navigation to `/dashboard?source=pwa` is served from the SW; `/dashboard`, `/_next/*`, `?_rsc=` are NOT.

## Notes for the implementer

- **Launch #1 white is expected** and unavoidable (a SW never controls the launch that installed it). Do not try to "fix" it here — that's Domain B (server cold-start).
- **`SHELL_VERSION`** is bumped by hand when `app-shell.html` changes; `activate` purges the old `app-shell-*` cache.
- If the shell's static logo → real-doc motion animation reads as a "re-animate" on device, a deferred polish is to pass the `source=pwa` signal into the layout and show the splash's resting frame (skip re-animation) on cold launch — NOT in this plan.
- Domain B (Neon driver, PPR/static shell, `getSession` dedup) remains a separate effort; it shortens the wait the shell now covers.

## Self-review

- **Spec coverage:** C1→Task 1; C2→Task 3; C3→Task 2; C4→Task 4; C5→Task 5. All components covered. Viability caveats (launch-2, fail-open, RSC/exclusions, respondWith try/catch) encoded in Task 3 + Global Constraints.
- **Placeholder scan:** the only non-literal is the inline SVG paths in `app-shell.html` (Task 1 Step 1), which the step explicitly sources from `splash-paths.ts` — a read-and-inline instruction, not undefined behavior.
- **Type/name consistency:** old `useSplashVisibility`/`SPLASH_VISIBLE_MS` fully replaced by `useSplashDismissed`; Task 5 Step 5 greps to confirm no stragglers. `SHELL_CACHE`/`SHELL_URL`/`SHELL_VERSION`/`source=pwa` consistent between Tasks 2 and 3.
