# PWA Cold-Start Optimization — Diagnosis, Validated Changes, What's Next

> **What this is:** the working plan for cutting the installed-PWA cold-open time. It records what the cold-open chain actually looks like in code (not what the docs said), a set of **validated but NOT applied** code changes (§2 — the full recipe, ready for a follow-up branch), the suggestions that were checked and rejected (§3), a 20-minute measurement protocol to run *before* spending money (§4), and the remaining phases — Vercel/Neon settings, paid tiers, Next 16 `cacheComponents`, bundle work (§5–§7).
> **Status:** NOTES ONLY. On 2026-09-23 the §2 changes were built in a scratch worktree and verified (`pnpm tsc` clean, `pnpm lint` clean, `public/sw.js` diff additive-only, `app-shell.html` self-contained), then reverted at the owner's request so this session ships documentation, not code. Nothing in §2 has been device-tested.
> **Created:** 2026-09-23. Builds on the approved-but-unimplemented Aug 6 spec `docs/superpowers/specs/2026-08-06-pwa-app-shell-service-worker-design.md` and its plan `docs/superpowers/plans/2026-08-06-pwa-app-shell-service-worker.md` (their "Domain A/B" split: A = launch paint, B = server cold start). §2 is A plus the free half of B.
> **How to keep it honest:** when a phase ships or a measurement lands, update the status table (§9). When §2 is applied, add its convention rules to `docs/codebase-conventions/app-shell.md` in the same PR (§2.7) — never before, since the README forbids rules with no reference impl.

---

## 1. The cold-open chain, as found in code

Three cold starts stack, and today the first byte of HTML waits on all three.

| # | Stage | What the code does today | Typical cost on Hobby + Neon Free |
|---|---|---|---|
| 0 | iOS opens `start_url` (`/dashboard`) | `public/sw.js` has **no `fetch` handler** (push + deep-link only) → every launch goes to the network. White screen until HTML arrives. | — |
| 1 | Vercel function cold start | Hobby has no scale-to-one; a low-traffic app is cold between sessions. Every dashboard page function imports the whole tRPC `appRouter` via `src/trpc/server.ts`, so it carries every provider SDK (Twilio, AWS S3, Notion, pdfmake, AI SDK…). Function size ↔ startup time. | ~0.5–1.5 s |
| 2 | Session → database | `src/app/(frontend)/dashboard/layout.tsx` does `await Promise.all([getCachedSession(), cookies()])` **at the top level**, so nothing renders until better-auth → drizzle → `pg` (TCP+TLS) → Neon answers. Neon Free suspends after 5 min idle and takes ~0.5–1.5 s to wake. The better-auth cookie cache (`maxAge: 300`) only skips the DB within 5 min — exactly the window in which Neon is still awake anyway — so on the cold path the session read almost always hits a *sleeping* DB. The tRPC RSC context (`src/trpc/lib/create-http-context.ts`) resolves the session through its **own** `cache()`, so prefetching pages do a second `getSession` per request (see §7). | ~0.5–1.5 s wake + connect |
| 3 | Page + data | `dashboard/page.tsx` awaits `protectDashboardPage()` (same memo as the layout — free once 2 resolves), then fires six `prefetch()`es **in parallel** (already correct) and streams them inside `<HydrateClient>`'s Suspense. | DB query time |
| 4 | Client | Bundle download + hydrate; `ablyClient` opens a WebSocket at module load (`autoConnect: typeof window !== 'undefined'`) on every page, though only `meeting-flow` consumes it. | device + network |

Realistic cold open today: **~2–4 s of white** before any paint, then content. Stages 1 + 2 are serialized *and* both block first paint.

Things the research brief assumed that are **not** true here (verified in the tree):
- Not on Next 16.2 / `cacheComponents` — the app is on **Next 15.5.9**. PPR is canary-only in 15, so "static shell + streamed holes" for `/dashboard` is not available without the major upgrade in §6.
- No Serwist and no `next-pwa` in use — `next-pwa` sits in `package.json` but is never wired into `next.config.ts` (dead dependency; §2.6).
- The DB driver is `drizzle-orm/node-postgres` + `pg`, not the Neon serverless driver, and it should stay that way for now (§3).
- `experimental.optimizePackageImports` gains nothing: Next 15.5's built-in list already covers `lucide-react`, `date-fns`, `recharts`, and `react-icons/*` (the only barrel-style libs in use).

## 2. Validated changes — the recipe (apply on a follow-up branch)

Everything below was built and verified together on 2026-09-23 (`pnpm tsc` + `pnpm lint` clean). Apply in order; each step is independently revertible. Expected effect is in §2.8.

### 2.1 Static app-shell document — `public/app-shell.html` (new)

Aug 6 plan Task 1, with four small additions (`theme-color`, `noindex`, `color-scheme: dark`, an accessible label). Generate it from the canonical splash paths so nothing is mistyped — run once from the repo root:

```bash
node - <<'JS'
const fs = require('fs')
const src = fs.readFileSync('src/shared/components/splash-screen/splash-paths.ts', 'utf8')
const house = [...src.matchAll(/^\s+'(M[^']+)',$/gm)].map(m => m[1])
const r = src.match(/R_PATH\s*=\s*'(M[^']+)'/)[1]
if (house.length !== 6 || !r) throw new Error(`unexpected paths: ${house.length}`)
const paths = [
  ...house.map(d => `      <path fill="#ffffff" d="${d}"/>`),
  `      <path fill="#03AFED" d="${r}"/>`,
].join('\n')
fs.writeFileSync('public/app-shell.html', `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#09090b">
<meta name="robots" content="noindex">
<title>Tri Pros</title>
<!--
  Instant-launch app shell for the installed PWA.
  The service worker (public/sw.js) precaches this file and serves it for the
  home-screen cold-launch navigation (/dashboard?source=pwa) with NO server
  round-trip, so the app paints a dark branded frame immediately instead of a
  white hang while the Vercel function and the database wake up. The inline
  script then hands off to the real, auth-gated /dashboard document.
  Everything is inline (no external CSS/JS/font/image) so the shell precaches
  as one file and can never break on a deploy. No Next, no auth, no RSC.
  Design: docs/superpowers/specs/2026-08-06-pwa-app-shell-service-worker-design.md
  The mark below is the resting frame of the in-app splash (splash-paths.ts).
-->
<style>
  html, body { margin: 0; height: 100%; background: #09090b; color-scheme: dark; }
  .wrap { display: flex; height: 100vh; align-items: center; justify-content: center; }
  .mark { width: 12rem; height: auto; animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse {
    0%, 100% { opacity: .85; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.03); }
  }
  @media (prefers-reduced-motion: reduce) { .mark { animation: none; } }
</style>
</head>
<body>
  <div class="wrap">
    <svg class="mark" viewBox="0 0 589 463" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Tri Pros Remodeling" role="img">
${paths}
    </svg>
  </div>
  <script>
    // Hand off immediately to the real, network-verified, auth-gated route.
    // '/dashboard' carries NO ?source=pwa marker, so the service worker does
    // not re-intercept it; the shell stays on screen until the real document
    // starts painting.
    location.replace('/dashboard');
  </script>
</body>
</html>
`)
JS
# self-containment check — expect no output:
grep -nE '<link|<script[^>]*src=|url\(|/_next/' public/app-shell.html
```

### 2.2 Manifest launch marker — `src/app/manifest.ts`

```ts
    short_name: 'TPR',
    // `?source=pwa` is the home-screen cold-launch marker. The service worker
    // serves the precached /app-shell.html ONLY for this exact navigation, so
    // in-app links, hard reloads, and push deep links never get shell-served.
    // see docs/codebase-conventions/app-shell.md#sw-app-shell-launch-marker
    start_url: '/dashboard?source=pwa',
```

`scope: '/'` stays (push deep links). **Existing installs keep the `start_url` they were added with** — every phone must remove and re-add the PWA once to get the shell; until then it behaves exactly as today (the SW ignores unmarked `/dashboard`).

The literal `/dashboard` + `source=pwa` pair is coupled across three files that the `project/no-raw-nav-paths` lint deliberately does not cover: `manifest.ts`, the `sw.js` fetch guard, and `app-shell.html`'s `location.replace`. Rename all three together.

### 2.3 Service worker — `public/sw.js` (additive block + header rewrite)

Insert the block below **between** the existing `activate` handler and the `// ── push:` section. Do not modify the `push` / `notificationclick` / `pushsubscriptionchange` handlers (verify with `git diff public/sw.js | grep '^-'` → nothing but the header comment). The existing `skipWaiting()` on install is **kept on purpose** (the spec's Safari mid-navigation risk was weighed; push updates must keep landing promptly — revisit only if device testing shows a broken in-flight launch).

Also rewrite the file's header comment (lines 2–4 today say "push + deep-link only… we deliberately do NOT add offline caching"), e.g.: `// Tri Pros service worker — push + deep-link handlers, plus the instant-launch app-shell cache (see the block below). No other caching: documents, RSC payloads and API responses are never cached.`

```js
// ── App-shell instant-launch cache ──────────────────────────────────────
//
// Additive to the push handlers above/below (multiple listeners per event all
// run). Precaches the static /app-shell.html and serves it INSTANTLY for the
// home-screen cold-launch navigation only (/dashboard?source=pwa — see
// src/app/manifest.ts), so the installed PWA paints a dark branded frame with
// no server round-trip while the Vercel function + Neon wake up. The shell
// hands off to the real /dashboard, which has no marker and is never
// intercepted. Every path fails open to the network.
// Design: docs/superpowers/specs/2026-08-06-pwa-app-shell-service-worker-design.md
const SHELL_VERSION = '1' // bump whenever /app-shell.html changes
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
  } catch (_err) {
    return
  }

  if (url.origin !== self.location.origin) return
  // Never intercept local dev (HMR, on-demand compiles). ngrok/preview/prod
  // are allowed so the shell is testable end-to-end before it hits prod.
  if (self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1') return
  if (url.pathname === '/sw.js') return
  if (url.pathname.startsWith('/_next/')) return
  if (url.pathname.startsWith('/api/')) return
  // Never touch App Router RSC fetches — intercepting them corrupts
  // client-side navigation.
  if (url.searchParams.has('_rsc')) return
  if (req.headers.get('RSC') || req.headers.get('Next-Router-State-Tree')) return

  // Only the exact home-screen cold-launch URL gets the instant shell.
  if (url.pathname !== '/dashboard' || url.searchParams.get('source') !== 'pwa') return

  event.respondWith(
    (async () => {
      try {
        const cached = await caches.match(SHELL_URL, { cacheName: SHELL_CACHE })
        if (cached) return cached
        // Cache miss (storage evicted after inactivity): fall through to the
        // network now and re-warm the shell for the next launch.
        event.waitUntil(
          caches.open(SHELL_CACHE)
            .then((cache) => cache.add(new Request(SHELL_URL, { cache: 'reload' })))
            .catch(() => {}),
        )
      } catch (_err) {
        // iOS 16.4+ intermittently throws inside respondWith — fail open.
      }
      return fetch(req)
    })(),
  )
})
```

### 2.4 Eager registration — `src/shared/components/pwa/service-worker-registrar.tsx` (new)

Deviation from the Aug plan's Task 4, on purpose: mount it from the **dashboard layout** (§2.5), not the marketing root, so site visitors never install a worker they don't need. Idempotent with the push hook's own `register('/sw.js')`. A SW never controls the page that registered it, so the shell benefit starts on the **second** launch after (re)install.

```tsx
'use client'

import { useEffect } from 'react'

// Registers the service worker as early as possible on every dashboard load
// so it is installed + active in time to serve the app-shell on the NEXT
// cold launch. The push hook (usePushSubscription) also registers '/sw.js',
// but only when the push UI mounts and only where PushManager exists;
// registering the same script URL twice is idempotent.
// see docs/codebase-conventions/app-shell.md#sw-registered-from-dashboard
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

### 2.5 Dashboard layout streams before the session

The layout stops awaiting the session at its top level. It reads only `cookies()` (request context, no I/O) and returns JSX immediately; the session read moves into three small async server components, each under its own `<Suspense>`. They share **one** DB round-trip through `getCachedSession()`'s React `cache()` memo, and the page's `protectDashboardPage()` joins the same memo — zero added queries. Gating semantics are unchanged (sign-in screen for anonymous, `redirect('/')` for non-internal users still happens in the page). Soft navigations are unaffected: layouts persist across App Router navigations, so these boundaries only suspend on document loads. No route-level `loading.tsx` (the `server-prefetch-two-tiers` rule forbids it). The locked `dashboard-layout-shape-fixed` invariants all hold: `flex-1 min-h-0` div outside Suspense, no layout scroll, `overflow-hidden` on the inset.

`src/app/(frontend)/dashboard/layout.tsx`:

```tsx
import { cookies } from 'next/headers'
import { Suspense } from 'react'

import { AppSidebarSkeleton } from '@/features/agent-dashboard/ui/components/app-sidebar-skeleton'
import { DashboardContentSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-content-skeleton'
import { DashboardSessionContent } from '@/features/agent-dashboard/ui/components/dashboard-session-content'
import { DashboardSessionMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-session-mobile-nav'
import { DashboardSessionSidebar } from '@/features/agent-dashboard/ui/components/dashboard-session-sidebar'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { PwaInstallPrompt } from '@/shared/components/pwa-install-prompt'
import { ServiceWorkerRegistrar } from '@/shared/components/pwa/service-worker-registrar'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'

// The layout itself never awaits the session. Only cookies() is read here —
// it resolves from the request context with no I/O — so the HTML shell
// (sidebar frame, inset, skeletons) streams as soon as the function is up.
// The session→DB round-trip happens inside the three DashboardSession*
// server components, each under its own <Suspense>, and is shared via
// getCachedSession's request memo. On a cold open this removes the database
// (and a suspended Neon wake-up) from the time-to-first-byte path.
// Shape is locked — see docs/codebase-conventions/app-shell.md
// #dashboard-layout-shape-fixed and #dashboard-layout-streams-before-session.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()

  const sidebarCookie = cookieStore.get('sidebar_state')
  const defaultOpen = sidebarCookie ? sidebarCookie.value === 'true' : true

  return (
    <>
      <GlobalDialogs />
      <PwaInstallPrompt />
      <ServiceWorkerRegistrar />
      <SidebarProvider defaultOpen={defaultOpen} data-no-gutter-stable>
        <Suspense fallback={<AppSidebarSkeleton />}>
          <DashboardSessionSidebar />
        </Suspense>
        <SidebarInset
          className="h-full min-w-0 overflow-hidden"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in oklch, var(--primary) 35%, transparent), var(--background) 70%), var(--background)`,
          }}
        >
          <div className="flex-1 min-h-0 pt-[env(safe-area-inset-top)]">
            <Suspense fallback={<DashboardContentSkeleton />}>
              <DashboardSessionContent>{children}</DashboardSessionContent>
            </Suspense>
          </div>
          <Suspense>
            <DashboardSessionMobileNav />
          </Suspense>
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
```

`src/features/agent-dashboard/ui/components/dashboard-session-sidebar.tsx`:

```tsx
import { AppSidebar } from '@/features/agent-dashboard/ui/components/app-sidebar'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Server component that owns the session read for the sidebar slot. Lives
// under a <Suspense> in the dashboard layout so the layout's HTML shell
// streams BEFORE the session→DB round-trip resolves (cold document loads).
// getCachedSession is request-memoized, so this shares one round-trip with
// the other session slots and the page's protectDashboardPage().
// see docs/codebase-conventions/app-shell.md#dashboard-layout-streams-before-session
export async function DashboardSessionSidebar() {
  const session = await getCachedSession()
  if (!session) {
    return null
  }
  return <AppSidebar user={session.user} />
}
```

`src/features/agent-dashboard/ui/components/dashboard-session-content.tsx`:

```tsx
import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { PushSubscriptionBanner } from '@/shared/components/push-subscription-banner'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Server component that owns the session read for the page slot: signed-in
// users get the push banner + the page; everyone else gets the sign-in
// screen (no redirect — see protectDashboardPage). Lives under a <Suspense>
// in the dashboard layout so the shell streams before the session resolves.
// see docs/codebase-conventions/app-shell.md#dashboard-layout-streams-before-session
export async function DashboardSessionContent({ children }: { children: React.ReactNode }) {
  const session = await getCachedSession()
  if (!session) {
    return <DashboardSignIn />
  }
  return (
    <>
      <PushSubscriptionBanner />
      {children}
    </>
  )
}
```

`src/features/agent-dashboard/ui/components/dashboard-session-mobile-nav.tsx`:

```tsx
import { DashboardMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-mobile-nav'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Server component that owns the session read for the mobile bottom nav —
// hidden on the sign-in screen. Lives under a <Suspense> in the dashboard
// layout so the shell streams before the session resolves.
// see docs/codebase-conventions/app-shell.md#dashboard-layout-streams-before-session
export async function DashboardSessionMobileNav() {
  const session = await getCachedSession()
  if (!session) {
    return null
  }
  return <DashboardMobileNav />
}
```

`src/features/agent-dashboard/ui/components/app-sidebar-skeleton.tsx` — must render the same `<Sidebar>` primitive as `AppSidebar` (it is the `peer` + gap element that `SidebarInset` margins key on) so the inset never shifts when the real sidebar swaps in. Fixed widths on purpose: `SidebarMenuSkeleton` randomizes width in `useMemo`, which mismatches between server and client render.

```tsx
import { Skeleton } from '@/shared/components/ui/skeleton'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarSeparator,
} from '@/shared/components/ui/sidebar'

export function AppSidebarSkeleton() {
  return (
    <Sidebar collapsible="icon" side="left" variant="sidebar">
      <SidebarHeader>
        <div className="flex h-12 items-center px-2">
          <Skeleton className="h-6 w-28 group-data-[collapsible=icon]:w-6" />
        </div>
      </SidebarHeader>
      <SidebarSeparator className="mx-0" />
      <SidebarContent className="gap-0">
        <div className="px-2 pt-2">
          <Skeleton className="h-8 w-full" />
        </div>
        <SidebarGroup>
          <div className="flex flex-col gap-1 p-1">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </SidebarGroup>
        <SidebarGroup>
          <div className="flex flex-col gap-1 p-1">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="flex items-center gap-2 p-1">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex flex-1 flex-col gap-1 group-data-[collapsible=icon]:hidden">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
```

(Lint note: `perfectionist/sort-imports` wants `ui/sidebar` before `ui/skeleton` — run `pnpm lint:fix` on the file.)

`src/features/agent-dashboard/ui/components/dashboard-content-skeleton.tsx` — generic on purpose (every dashboard page shares the layout), padded like `DashboardTemplate` so the swap doesn't jump; pages still own scroll + their own loading states:

```tsx
import { Skeleton } from '@/shared/components/ui/skeleton'

export function DashboardContentSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-col px-4 pb-20 pt-4 md:px-6 md:py-6" aria-busy="true">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <Skeleton className="h-64 lg:col-span-8" />
          <div className="flex flex-col gap-6 lg:col-span-4">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        </div>
      </div>
    </div>
  )
}
```

### 2.6 Cleanup — `pnpm remove next-pwa`

Dead since it was never in `next.config.ts`; webpack-only and unmaintained, so also a future Turbopack/Next 16 blocker. Lockfile shrinks by ~4.3k lines; the ~70 inserted lines are pnpm re-inlining Babel entries previously shared through its tree (no new packages).

### 2.7 Docs that must land in the same PR

- `docs/codebase-conventions/app-shell.md`: refresh the JSX block under `#dashboard-layout-shape-fixed` to the §2.5 shape (+ the rule that the sidebar fallback renders the same `<Sidebar>` primitive); add H3s `#dashboard-layout-streams-before-session`, `#sw-app-shell-launch-marker`, `#sw-never-touches-rsc`, `#sw-registered-from-dashboard` (Why / Reference impl / Enforced by); add anti-patterns "awaiting the session at the top level of the dashboard layout" and "letting the SW cache authenticated HTML or `?_rsc=` payloads"; update `#manifest-scope-stays-slash` to mention the `start_url` marker. The code comments in §2.2–2.5 reference these anchors — grep them before committing (README "Anchor verification").
- `public/sw.js` header comment (§2.3).
- Status lines of `docs/superpowers/specs/2026-08-06-pwa-app-shell-service-worker-design.md` and `…-pwa-launch-shell-theme-design.md` ("Approved design, pending spec review") → implemented / partially shipped, pointing here.
- `docs/README.md` plan index line for this doc.

### 2.8 Verification checklist + expected effect

- `pnpm tsc && pnpm lint` (never `pnpm build`; CI builds on the PR).
- `git diff public/sw.js | grep '^-'` shows only the header comment; the push handlers are untouched.
- `grep -nE '<link|<script[^>]*src=|url\(|/_next/' public/app-shell.html` → nothing.
- On a **Vercel Preview** (not `pnpm dev`, which compiles on demand): remove + re-add the PWA on an iPhone. Launch #1 best-effort. Fully close. Launch #2: the dark mark **immediately**, then the dashboard chrome + skeletons, then data. Web Inspector: Cache Storage has `app-shell-v1` → `/app-shell.html`; `/dashboard?source=pwa` served by the SW; `/dashboard`, `/_next/*`, `?_rsc=` not. Send a push and tap it: deep link still routes.
- In a normal browser tab, `/dashboard` cold load: sidebar skeleton → real sidebar with no width jump; sign-out state still shows the sign-in screen with no sidebar/mobile nav.

| Metric (installed PWA, cold, launch #2+) | Today | After §2 | After §5 paid tiers |
|---|---|---|---|
| Time to first paint (dark branded frame) | ~2–4 s (white) | **~0.1–0.3 s** (SW cache, no network) | same |
| Time to dashboard chrome (sidebar frame + skeletons) | ~2–4 s | ~0.5–1.5 s (function cold start only) | ~0.1–0.3 s (warm instance) |
| Time to real content | ~3–5 s | ~1.5–3 s (function + Neon wake + queries, now overlapped) | ~0.5–1 s |

Estimates, not measurements — §4 turns them into numbers. First paint is where the "90 %" lands; time-to-content improves by roughly a third to a half from §2 alone and needs §5 for the rest.

## 3. Checked and rejected (with evidence)

| Suggestion | Decision | Reason (verified in code / node_modules) |
|---|---|---|
| Switch to `drizzle-orm/neon-http` | **No** | `NeonHttpSession.transaction()` throws `"No transactions support in neon-http driver"`. Nine call sites use `db.transaction()` (incl. `withTx` in `src/shared/dal/server/lib/helpers.ts`, the DAL's ambient-tx contract; `ScopedContext.tx`). A dual-driver split (`http` for reads, WebSocket for tx) would make `DbOrTx` a union of two `PgDatabase` HKTs and break query-builder typing across the DAL. `@neondatabase/serverless` is in `package.json` with zero importers today. |
| Switch to `drizzle-orm/neon-serverless` (WebSocket) | **Not now** | Handshake count is the same as `pg` over TCP+TLS (TCP + TLS + WS upgrade + PG startup), so no cold-start win on Node functions; needs a `ws` shim on Node < 22 (CI runs Node 20; Vercel runtime unverified); `pg` would stay anyway (`db-reset.ts`, `db-seed.ts`, eight `scripts/*.ts` import it directly). Revisit only if §4 shows connect time (not Neon wake) dominates. |
| Raise better-auth `session.cookieCache.maxAge` (300 s) | **Knob, not changed** | Saves one session query per cold open, but a revoked session / role change stays live for up to `maxAge`. With §2.5 the session no longer blocks first paint, so the trade-off no longer buys perceived speed. If wanted: 1 h is reasonable for an internal tool; change `src/shared/domains/auth/server.ts` and update the two docs that hard-code "5-min" (`docs/codebase-conventions/dev-auth-route.md`, `docs/superpowers/plans/2026-07-26-prefetch-hydration-fault-audit.md`). |
| `experimental.optimizePackageImports` | **Not needed** | Next 15.5 defaults already cover every barrel-style lib in use (§1). |
| `@serwist/next` precache + `navigationPreload` | **Deferred** (sanctioned by the Aug 6 spec) | The hand-written shell gives the same launch paint with no build-tool coupling. Serwist pays off when we want `_next/static` precaching/offline; if adopted: never use its `defaultCache` as-is (it NetworkFirst-caches documents and RSC), gitignore + eslint-ignore the generated workers, and note it needs `next build --webpack` or Serwist's Turbopack path on Next 16. |
| A precached static `/launch` Next route as the shell (instead of `app-shell.html`) | **No** | Its HTML references hashed `_next/static` chunks; after a deploy the cached shell points at chunks that no longer exist → white screen until the SW updates. The static HTML shell has no such coupling. |
| Next 16 + `cacheComponents` | **§6** | Major upgrade that changes the caching model repo-wide; only a full build validates it. |
| Splash overlay rewrite (Aug plan Task 5) | **Skip** | `PwaSplashScreen` is mounted nowhere; the standalone-dark `<style>` in the root layout plus the shell keep every frame dark. |

## 4. Measure before spending (≈20 min) — do this first

Run against a **Vercel Preview or prod** (never `pnpm dev`).

**1. Cold vs warm TTFB (isolates function + DB from the app):**
```bash
# wait ≥10 min idle first (Neon suspends at 5, Hobby function goes cold), then:
curl -s -o /dev/null -w 'ttfb=%{time_starttransfer}s total=%{time_total}s\n' -H "cookie: <better-auth cookie>" https://triprosremodeling.com/dashboard
sleep 2
curl -s -o /dev/null -w 'ttfb=%{time_starttransfer}s total=%{time_total}s\n' -H "cookie: <better-auth cookie>" https://triprosremodeling.com/dashboard
```
Run 1 at 2–4 s and run 2 < 300 ms → the cold chain is the problem (§2, §5, §6 pay off). Run 2 still slow → app/bundle work first (§7).

**2. Attribute the cold cost:** Vercel → Observability → function startup performance, cold-start percentage, external-API latency. "In-function time" dominating cold starts = Neon wake / query time, not the function. Cross-check Neon console → compute graph: suspend/resume cycles should line up with slow opens.

**3. Record the numbers in §9** and decide the §5 spend from them.

## 5. Phase 2 — settings and money (no code)

Independent steps, cheapest first.

1. **Co-locate the function with Neon.** Vercel → Project → Settings → Functions → region = the Neon project's region (Neon console → project settings). Default is `iad1`; if Neon is in Oregon, every query pays ~60 ms cross-country and the dashboard's six prefetches multiply it. Function→DB proximity matters more than function→user because the CDN serves the static part.
2. **Confirm Fluid compute is on.** Default for projects created after 2025-04-23; older projects enable it in Settings → Functions. Bytecode caching + instance reuse (the `pg` Pool then survives across warm invocations).
3. **Use Neon's pooled connection string** (`-pooler` host) for `DATABASE_URL` if not already.
4. **Vercel Hobby → Pro ($20/seat, 14-day trial with $20 credit).** (a) Scale-to-one keeps one production instance warm for 14 days after the last invocation → removes stage 1. (b) Hobby's terms exclude commercial use; a Tri Pros app is commercial, so this is likely required regardless. Use the trial to measure the delta before committing.
5. **Neon Launch, always-on.** Disabling scale-to-zero is paid-only; 0.25 CU × 730 h × $0.106 ≈ **$19/mo**. Removes stage 2 entirely. For a low-traffic internal app this is usually the better first dollar over Vercel Pro — but with §2.5 applied, stage 2 no longer blocks first paint, so let §4 say which cold start still dominates time-to-content.
   *Free stopgap:* an external scheduler pinging a cheap DB endpoint every ~4 min in business hours (Hobby crons are once-a-day only). Free tier's 100 CU-hours/project ≈ 12 h/weekday at 0.25 CU. Fragile; a bridge, not a fix.

## 6. Phase 3 — Next 16 + `cacheComponents` (code, needs a build to validate)

Goal: make `/dashboard` itself a static, CDN/SW-cacheable shell with streamed dynamic holes — the "proper" version of §2.1–2.4, and the only way to ship non-per-user data (nav config, settings) in the shell for free.

Upgrade checklist (verified against the current tree):
- `next@16.x` + `eslint-config-next@16`; React 19.2 comes with it.
- `pnpm lint` uses `next lint`, **removed in Next 16** → switch the script to `eslint .` (the antfu config already runs standalone; today's "Next.js plugin was not detected" warning is harmless).
- `src/middleware.ts` → `src/proxy.ts` (deprecated alias still works in 16). Matcher unchanged.
- Turbopack becomes the default `next build`. `serverExternalPackages: ['pdfkit']` and `outputFileTracingIncludes` carry over; re-verify pdfkit AFM/ICC tracing on a preview (the `next.config.ts` comment explains why both are required).
- Async request APIs: already compliant (`await cookies()`, `await headers()`, `await searchParams`).
- Then `cacheComponents: true` and fix what the build flags. Audit list (what forces dynamic rendering today):
  - Layouts reading `cookies()`/`headers()`: `dashboard/layout.tsx` (sidebar-state cookie — move into a Suspense-wrapped slot or a client-read default), `funnels/layout.tsx`, `proposal-flow/layout.tsx`.
  - `export const dynamic = 'force-dynamic'`: all 16 `src/app/(frontend)/dashboard/**/page.tsx`. Under `cacheComponents` these become "dynamic inside Suspense"; the `HydrateClient` boundary already exists on each.
  - `searchParams` pages: `dashboard/{campaigns,customers,meetings,projects,proposals}`, `funnels/[trade]`, `intake`, `proposal-flow/proposal/[proposalId]`.
  - `export const revalidate` (ISR): the four `(site)/services/**` pages and `sitemap.ts` → `use cache` + `cacheLife()`.
  - `getCachedSession()` (`headers()`) is fine inside Suspense; the page-level `redirect('/')` in `protectDashboardPage()` must stay inside a boundary (it does).
- Non-per-user reads that could ship in the static shell with `use cache`: sidebar nav config (`getSidebarNav` is ability-derived — cache per role, not per user), pipeline enums, non-user-scoped settings.
- PWA follow-through once `/dashboard` is static: replace the hand-written shell with Serwist precaching of the real route (`start_url` back to `/dashboard`), enable `navigationPreload`.

Reported effect of this pattern elsewhere: TTFB ~700 ms → 60–80 ms; ours drops further because today's TTFB includes stage 2.

## 7. Phase 4 — bundle and server startup

- **Session double-read (cheap, real):** the tRPC RSC context (`src/trpc/lib/create-http-context.ts`) resolves the session with its own `cache()`, separate from `getCachedSession()`, so every prefetching dashboard page runs `getSession` twice per request. Consolidating them (the follow-up already noted in `get-cached-session.ts`) removes one DB query from every cold open.
- **Client:** run `@next/bundle-analyzer` on the dashboard route. Candidates: Ably (`src/shared/services/providers/upstash/realtime-client.ts` connects at module load on *every* page; only `meeting-flow` uses it → `autoConnect: false` + connect from `RealtimeProvider` in an effect, or mount the provider in `meeting-flow` only), `motion/react` (sidebar + template), `recharts` (analytics only — confirm it isn't in the dashboard chunk), tiptap (editor surfaces only).
- **Server:** every dashboard page function bundles the full `appRouter` (`src/trpc/server.ts` → `createTRPCOptionsProxy`), dragging every provider SDK in at module scope. Cheapest first: lazy `await import()` of heavy SDKs inside the procedures that use them (Twilio, AWS S3, Notion, pdfmake, AI SDK, web-push, Resend); `serverExternalPackages` for the biggest (reduces bundle size, not parse time — the import graph must also be lazy). Measure with Vercel's function-size + startup metrics before/after.
- Keep the start route free of third-party scripts; fonts already go through `next/font`.

## 8. Doc drift found during this exploration

Fixed in this change (pure corrections, code unchanged):
- `docs/codebase-conventions/app-shell.md#manifest-scope-stays-slash` pointed at `public/manifest.json`; the manifest is the Next metadata route `src/app/manifest.ts`.
- `docs/codebase-conventions/app-shell.md#html-theme-boot` claimed an `apple-touch-startup-image` matrix (`metadata.appleWebApp.startupImage`, `scripts/generate-pwa-splash.ts`) plus a mounted `PwaSplashScreen`; none exist. The live always-dark mechanism is the inline standalone-scoped `<style>` in `src/app/(frontend)/layout.tsx`.

Still open (not fixed here):
- `docs/design-system/DESIGN.md` says "no monospace, ever; no `--font-mono` token", but `layout.tsx` loads `Space_Mono` as `--font-mono`, `globals.css` exposes it, and 16 `font-mono` usages exist in the dashboard. Needs a carve-out or a removal decision.
- `src/app/sitemap.ts` references `./DOCS.md#sitemap-strategy`; `src/app/DOCS.md` does not exist.
- `src/app/robots.ts` disallows `/tests` (route is `/test`); `/dev` is not disallowed; `/admin` has no route.
- `docs/codebase-conventions/frontend-stack.md` opens with "Two route groups" and lists three, omitting `auth/`, `intake/`, `funnels/`, `dev/`, `test/`.
- `app-shell.md`, `environment.md`, `docs/ui-design-playbook.md` point at `memory/*.md`; `memory/` is not in the repo, so the "how to add a push type" recipe has no in-repo home (candidate: `docs/how-to/add-a-push-type.md`).
- Both 2026-08-06 PWA specs still read "Approved design, pending spec review"; nothing from the SW spec has shipped and only the 1100 ms splash timer from the theme spec did.
- `PwaSplashScreen` (`src/shared/components/splash-screen/pwa-splash-screen.tsx`) is exported but never mounted — mount it or delete it.

## 9. Status

| Item | Status |
|---|---|
| §2 validated recipe (SW shell, streaming layout, `next-pwa` removal) | ⬜ not applied — validated 2026-09-23 (tsc + lint clean); needs a follow-up branch, CI build, device test, PWA re-add on phones |
| §4 measurement | ⬜ run on prod/preview; record numbers here |
| §5 settings (region, Fluid, pooled URL) | ⬜ owner action in Vercel/Neon consoles |
| §5 paid tiers | ⬜ decide after §4 (Hobby terms already point at Pro) |
| §6 Next 16 + `cacheComponents` | ⬜ separate branch; CI build validates |
| §7 session double-read + bundle | ⬜ after analyzer run |
| §8 remaining doc drift | ⬜ |
