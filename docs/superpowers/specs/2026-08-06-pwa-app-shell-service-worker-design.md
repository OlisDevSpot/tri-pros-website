# PWA Instant-Launch App Shell (Service Worker) — Design

**Date:** 2026-08-06
**Status:** Approved design, pending spec review
**Scope:** Service-worker app-shell so the installed PWA paints an instant dark splash on cold launch instead of a long white hang. Follow-on to the Domain A launch-shell work (`2026-08-06-pwa-launch-shell-theme-design.md`).

## Problem

On a PWA cold launch, the long white hang happens **before any of our HTML is delivered** — iOS requests `start_url` (`/dashboard`, a `force-dynamic`, auth-gated App Router route) and the browser shows white while the server renders. **No in-page splash can cover this window** — the splash lives in HTML that hasn't arrived yet. Only two things can cover it: the native `apple-touch-startup-image` (a brief OS moment), or a **service worker serving a cached shell instantly** with no server round-trip. This spec builds the latter.

(Note: testing over `pnpm dev` + ngrok exaggerates the wait because the dev server compiles routes on demand — the first `/dashboard` hit took ~18s to compile. Production has no dev-compile, but a real cold-start server wait remains, which this shell covers.)

## Decisions (locked during brainstorming)

- **Extend the existing hand-written `public/sw.js`** with app-shell caching — do **NOT** adopt `next-pwa`, and defer `@serwist/next`. The existing SW's own header comment mandates folding caching into this file rather than spinning up a new SW.
  - **`next-pwa` evaluated and rejected** (research 2026-08-06): abandoned (last npm 5.6.0 = Aug 2022, repo dead since 2024), **webpack-only** (cannot run under Turbopack / Next 16 — a dead end), documented App Router precache breakage, and it *generates/owns* `sw.js` (GenerateSW) — adopting it would force the delicate iOS push handlers into a secondary bundled file (high risk). It does **not** help cold-launch (default `_next/static` precaching speeds interactivity, not first paint; the app-shell is bespoke either way) and cannot help server cold-start at all. **Remove the unused dep** in a separate cleanup.
  - **Serwist (`@serwist/next`, `InjectManifest` mode)** is the maintained, Next-official successor and would *keep* this hand-written `sw.js`, injecting only a precache manifest — additive, low push-risk. Its sole edge over this plan is free deploy-time cache-busting (vs. our manual `SHELL_VERSION`). **Sanctioned future upgrade** if we later want asset precaching / offline; **not adopted now** (the launch fix is identical bespoke work without it).
- **Instant frame = dark branded splash only** (no cached authenticated content). We cache a **content-free static shell**, never real dashboard HTML — sidesteps all authenticated-caching risk.
- **Shell splash = simple static/pulse logo** on `#09090b` (pure CSS/SVG, no motion runtime). The real dashboard's `motion/react` splash plays on handoff; shared logo + dark bg keeps the swap seamless.
- **Benefit starts launch #2**; launch #1 after install is best-effort (SW not yet active). All SW paths **fail open to network**.

## Research basis (viability + iOS caveats)

Verified against MDN, WebKit, Apple/Next.js docs (current iOS 17/18, Next 15):

- **iOS DOES let the SW intercept the standalone launch navigation** to `start_url` (the iOS-12 "cache not shared in standalone" bug was fixed in iOS 12.1.1). No hard iOS blocker.
- A SW **never controls the page that registered it** → shell benefit is **launch-#2 onward**; launch-#1 falls through to network. Not an iOS quirk — normative SW behavior.
- **Storage eviction:** WebKit ITP caps script-writable storage (incl. Cache Storage) after inactivity (~7 days documented for Safari tabs; "weeks" reported for installed apps). → the shell must **degrade gracefully to network**, never assume warm cache.
- **iOS 16.4+ `FetchEvent.respondWith` intermittently throws `TypeError: Internal error`** (unresolved) → wrap `respondWith` logic in try/catch and fall through to `fetch(event.request)`.
- **Never let the SW touch RSC fetches** (`?_rsc=` query, `RSC`/`Next-Router-State-Tree` headers, `text/x-component`) — intercepting them corrupts App Router client navigation. Only full-document (`mode:'navigate'`) same-origin GETs are eligible.
- **Don't force `skipWaiting()` mid-navigation** (Safari kills the old SW and breaks the in-flight load). The existing SW currently calls `skipWaiting()` on install — see Risks.

## Architecture

The cold-launch sequence (launch #2+):

```
tap
 → native apple-touch-startup-image (dark #09090b, brief OS moment)   [Domain A, already shipped]
 → SW fetch intercepts navigation to /dashboard?source=pwa
 → serves cached public/app-shell.html INSTANTLY (dark + static/pulse logo)
 → shell's inline script: location.replace('/dashboard')   (marker stripped)
 → shell stays visible while the REAL /dashboard is fetched (covers the cold-start wait)
 → real /dashboard HTML arrives; its root layout renders the SAME splash covering from frame 1 (standalone)
 → dashboard hydrates; splash dismisses when ready → dashboard revealed
```

Every stage is dark `#09090b` → no white, no content flash. Launch #1 (SW inactive): skips the shell stage, falls through to network SSR — white during that first cold start only.

## Components

### C1 — `public/app-shell.html` (new, static)

A self-contained document: `<html>`/`<body>` background `#09090b`, a centered inline **SVG TPR logo** (reuse the mark from the splash paths / `logo-dark.svg`, white on dark), a gentle CSS fade/pulse (no house-draw replication), and an inline `<script>` that runs `location.replace('/dashboard')` immediately. **No** external CSS/JS/font — everything inline so it precaches as one file and never breaks with a deploy. No auth, no Next, no RSC.

### C2 — `public/sw.js` extension (modify — keep all existing push code untouched)

Add, above/around the existing push handlers:

- **`SHELL_VERSION` constant + `SHELL_CACHE = 'app-shell-v' + SHELL_VERSION`** — bump manually when `app-shell.html` changes (the shell is static and changes rarely; no build-time BUILD_ID injection since the SW is hand-written with no codegen step).
- **`install`:** `caches.open(SHELL_CACHE)` → `cache.add(new Request('/app-shell.html', { cache: 'reload' }))`. Keep the existing `skipWaiting()` behavior decision explicit (see Risks).
- **`activate`:** delete any `app-shell-*` cache ≠ `SHELL_CACHE` (leave non-shell caches alone); keep existing `clients.claim()`.
- **`fetch`:** a new handler that ONLY acts on the launch URL and otherwise returns (does nothing). Guard conditions — return early (no interception) unless ALL hold:
  - `req.method === 'GET'`
  - `req.mode === 'navigate'`
  - same-origin (`url.origin === self.location.origin`)
  - `url.pathname === '/dashboard'` AND `url.search.includes('source=pwa')`
  - NOT `/sw.js`, NOT `/_next/`, NOT `/api/`, NOT `url.searchParams.has('_rsc')`, NOT (`RSC` or `Next-Router-State-Tree` headers present)
  - NOT dev/tunnel host (`localhost`, `*.ngrok-free.app`)
  - When eligible: `respondWith` → try `caches.match('/app-shell.html', { cacheName: SHELL_CACHE })`; if hit, return it; on miss or ANY error, `return fetch(req)` (fail open). Wrap in try/catch for the iOS 16.4+ `respondWith` bug.
  - Note: `fetch` cannot be added as a *second* `addEventListener('fetch')` conflicting with push — push doesn't use `fetch` today, so this is the only fetch handler. Confirm during implementation.

### C3 — Manifest `start_url` marker (modify `src/app/manifest.ts`)

`start_url: '/dashboard'` → `'/dashboard?source=pwa'`. Keep `scope: '/'` (required for push deep-links — unchanged). The marker is the deterministic "genuine home-screen cold launch" signal; App Router soft-nav means real document navigations to `/dashboard` essentially only occur on cold launch / hard reload / deep link, so the shell rule rarely fires otherwise. (Minor: any analytics keyed on exact `start_url` sees the query — acceptable.)

### C4 — Eager SW registration (new small client component in root layout)

Today `navigator.serviceWorker.register('/sw.js')` runs **lazily** inside `usePushSubscription` (only when the push UI mounts). Add a tiny always-mounted client component (e.g. `ServiceWorkerRegistrar`) in `src/app/(frontend)/layout.tsx` that registers `/sw.js` eagerly on mount (guarded by `'serviceWorker' in navigator`). Idempotent with the push hook's `register()` (same script URL → same registration). This ensures the SW installs/activates during the current session so the **next** launch is shell-served.

### C5 — Real dashboard layout: splash covers from frame 1 (standalone) + dark canvas

So the shell→real-document handoff is seamless (both dark, splash-covered), fold in the fix identified during debugging:

- **Dark canvas in standalone:** `globals.css` → `@media (display-mode: standalone) { html { background-color: #09090b; } }`. PWA-only, so no browser FOUC returns.
- **Splash covers from frame 1 in standalone:** rework `PwaSplashScreen` / `SplashOverlay` so the overlay is present on the initial paint in standalone mode (not gated behind two post-hydration effects that currently let content flash first — the "content-behind-splash" jank). Use a CSS `@media (display-mode: standalone)` gate so browsers never render it. Dismiss when ready (min floor + max cap), then fade. The existing `motion/react` house-draw animation plays on the real document.
- The existing `SPLASH_VISIBLE_MS = 1100` (Domain A) is superseded here by the ready/min-floor logic — reconcile during implementation.

## Interaction with existing / other work

- **Existing push SW handlers stay byte-for-byte untouched** — only additive install/activate/fetch logic and the shared install/activate events are extended.
- **Domain A startup images compose** (native image → SW shell → real). No conflict.
- **Domain A FOUC fix stays** (no hardcoded dark on `<html>` in browser); the standalone dark canvas is PWA-scoped and doesn't reintroduce browser FOUC.
- **Domain B (server cold-start speed) is still separate and complementary** — the shell covers the wait; Domain B shortens it. Not in this spec.

## Testing & verification

- `pnpm tsc` + `pnpm lint` pass (never `pnpm build`).
- **Real iOS device, and preferably a Vercel Preview Deploy** (production build — no dev-compile; real cold-start; proper HTTPS/PWA install) rather than dev-over-ngrok, which exaggerates the wait.
  1. Install PWA; **launch #1**: expect best-effort (may still be white during first cold start — SW not yet active). Acceptable.
  2. Fully close; **launch #2**: expect **instant dark splash** (shell), holding through the cold-start wait, seamlessly into the dashboard. No white.
  3. In-app navigation still works (soft-nav; shell rule must not fire — verify no shell served for in-app links).
  4. Push notifications + deep-links still work (regression check — the whole point of not clobbering `sw.js`).
  5. Deploy a shell change with a bumped `SHELL_VERSION` → confirm old shell cache is purged on activate.
- DevTools: Application → Service Workers shows the SW active; Cache Storage shows `app-shell-v<n>` with `/app-shell.html`; a navigation to `/dashboard?source=pwa` is served from SW; `/dashboard` (no marker), `/_next/*`, `?_rsc=` are NOT.

## Risks & mitigations

- **`skipWaiting()` mid-navigation (Safari race):** the existing SW calls `skipWaiting()` on install. With a shell in play, an update activating mid-launch could break an in-flight navigation. Mitigation: evaluate switching to a non-forced update (wait + claim on next launch) — but this touches existing push-SW behavior, so **decide explicitly and test push still updates promptly**. Default: keep current behavior unless testing shows breakage.
- **Launch-#1 white:** unavoidable (SW not active). Documented expectation; native startup image still covers the OS moment.
- **Storage eviction / cold cache:** fail-open to network everywhere; never assume the shell is cached.
- **Marker leak into analytics/links:** `?source=pwa` visible in `start_url`; benign.
- **Double-animation feel:** shell shows static logo, then the real doc's motion splash plays — could read as a slight "re-animate." If it looks off on device, pass the `source=pwa` signal into the layout to show the resting splash (skip re-animation) on cold launch. Deferred polish; decide after device test.
- **iOS 16.4+ `respondWith` TypeError:** wrapped in try/catch → network fallback.

## Out of scope

- `@serwist/next` / `next-pwa` adoption; removing the unused `next-pwa` dep (separate cleanup).
- Caching authenticated/dynamic dashboard HTML (explicitly rejected).
- Offline support beyond the launch shell; precaching `_next/static` (possible later enhancement, not required for the instant-launch goal).
- Domain B server cold-start work (Neon driver, PPR, `getSession` dedup).
- Cross-Document View Transitions (iOS 18.2+ progressive enhancement) — optional later polish.
