# PWA Launch: Logo Splash + Service-Worker Shell — Design

> **Status:** rulings D1–D6 agreed in conversation 2026-10-08; revised the same day on the owner's review: the cover lifts on the dashboard layout's commit, not on the session (D2), and PWA code gathers under `src/shared/domains/pwa/` (D7). Awaiting owner review of the revision.
> **Research:** `docs/plans/2026-10-08-pwa-launch-research.md` (F1–F20 are cited by number below). Delete both files when the work ships; git keeps them.
> **History:** the 2026-08 app-shell attempt and its revert are summarised in the research §2. This design is built around the four things that went wrong there: a second document load, a logo that animated twice, two registration owners, and cold-start CSS shipped without device checks.
> **Code comments never cite this spec.** They say why, per CLAUDE.md.

## 1. Goal and success criteria

The installed Tri Pros app (iPhone, iPad, team Android phones) opens on the TPR mark from the first frame, never on white, and the web layer paints before the server answers. The mark fades once into the live dashboard. The server wait is hidden, not removed: time to live data stays what Phase 1 of the cold-start work made it.

| Metric (installed app, cold launch = force-quit → tap) | Target | How it is read |
|---|---|---|
| White or blank frames between tap and the mark | 0 | Device screen recording, light and dark, iPhone + iPad (portrait and landscape) + one Android |
| The mark animates or jumps between the native stage and the web stage | never | Same recording |
| Tap → web layer's first paint, launch #2 onward | ≤ 0.4 s | Safari Web Inspector / Chrome remote timeline on device; the recording as a proxy |
| Tap → live dashboard | no regression vs today | Same |
| Public site navigations | no added latency | Chrome: the worker never boots for them (F17); iOS: navigation preload overlaps the boot (F20) |
| Push deep links, in-app navigation, push delivery | unchanged | Regression checks in §8 |

Launch #1 after (re)installing is never served by the worker (F6): the native stage still shows the mark; the web stage is today's streamed shell.

## 2. Decisions (owner, 2026-10-08)

| # | Decision | Ruling |
|---|---|---|
| D1 | Splash colour in light mode | Brand navy `#040f23` always, on both platforms. It is an overlay that unmounts; nothing forces the page canvas, so the 2026-10-05 ruling (the app follows light/dark) still holds. Reason: Android's splash is one baked colour (F4) and iOS locks the scheme at install (F3). |
| D2 | When the cover fades | Held until the dashboard layout has committed from the server's response: the sidebar frame and the route's skeleton (or the sign-in screen) are on screen. Not held for the session read or the page data; those fill in behind a visible skeleton, as on any document load today. The line is the server's answer (owner, 2026-10-08: the app is live once Vercel has come back), not the cached shell's own paint. A 300 ms floor so a warm launch never blinks; the 4 s bound is only the fail-open ceiling for a server that never answers and never binds on a launch that gets one. |
| D3 | Launch marker | `start_url` becomes `/dashboard?launch=1`, manifest `id` is pinned to `/dashboard` first (F15). Every phone re-adds the app once (iOS freezes `start_url` and startup images at install, F2; Android re-mints its WebAPK on its own schedule, F15). Push `navigate` values never carry the marker (F16). |
| D4 | What the worker caches | A static, content-free shell document plus the chunks it references, as one set. Never the real dashboard HTML (F9, F14). |
| D5 | Tooling | Hand-rolled inside the existing `public/sw.js`; push handlers untouched; no new dependencies. |
| D6 | Devices | The iOS matrix covers every current Apple size (§5.1) so it does not wait on model names; a probe page confirms coverage on the owner's devices before the first device check. |
| D7 | Where PWA code lives | A platform domain, `src/shared/domains/pwa/`, beside `auth` and `permissions` (§4). PWA owns no resource (not a module) and has no flow of its own, the root and dashboard layouts consume it (not a feature). Today's scattered PWA client files move there first, path-only; convention-bound files stay put. |

## 3. The launch sequence

### 3.1 Cold launch, worker active (launch #2 onward)

```
tap
 → native stage: iOS startup image / Android manifest splash — navy field, white-and-blue mark at rest      (§5.1)
 → the OS navigates to /dashboard?launch=1
 → service worker answers from Cache Storage with the shell document for /launch                           (§5.5)
 → first web paint = the same navy field and mark, SSR'd open, inline-styled, no motion                     (§5.4)
   (iOS drops the startup image here, F5; Android fades its splash here, F4 — no seam either way)
 → shell hydrates from precached chunks; the handoff marks the launch "covering" and soft-navigates to /dashboard
 → the server answers: the dashboard layout commits under the cover with the sidebar frame and the
   route's skeleton → ready → the cover fades (300 ms) once the floor has elapsed                           (§5.4)
 → the session and page slots fill in behind the visible skeleton, as on any document load today            (unchanged)
 → live dashboard
```

The cover lives in the root layout, so it survives the soft navigation. One document, one logo, one fade.

### 3.2 Other paths

| Path | What happens |
|---|---|
| Launch #1 after install, or cache evicted | Native stage as above; the navigation goes to the network; the server renders `/dashboard` as today (the marker is ignored). No cover: the root cover is SSR-closed on any document that is not the shell. |
| Warm resume (app still in memory) | No navigation; nothing changes. |
| Push notification tap | `notificationclick` opens the deep link (unmarked); it goes to the network as today. The native stage still shows the mark on a cold process launch. |
| In-app navigation | Soft navigations are `rsc` fetches; the worker ignores them (F11, §5.5). |
| After a deploy, before the shell is revalidated | The old shell (old chunks, both precached together) hydrates and soft-navigates; Next sees a build-id mismatch and hard-loads `/dashboard` **unmarked** → network → today's streamed shell (F10). Meanwhile the worker revalidates the shell; the next launch is instant again. One slower launch per deploy, no loop. |
| Signed out | Shell → soft-navigate → the layout commits with the sign-in screen (no cookie) or its skeleton (stale cookie) → ready → the cover fades; a stale cookie then swaps the skeleton for the sign-in screen. Nothing personal is ever cached. |
| Browser tab (desktop or mobile Safari) | `/dashboard` is unmarked; nothing changes. A direct visit to `/launch` shows the shell and lands on `/dashboard`. |
| Development (`next dev`, tunnel included) | The worker registers as `/sw.js` (push keeps working) but shell logic is off (F13, §5.5); an env opt-out unregisters entirely (§5.6). A local production build (`next start`) registers `/sw.js?shell=1` and behaves like production. |

## 4. Components

### Where PWA code lives (D7)

PWA is not a feature: it has no flow of its own, and the root and dashboard layouts consume it (a feature imported by a layout is an inversion). It is not a module: it owns no resource; push subscriptions are one, and the module map already sends them to `users`. It is a platform capability with a client half (registration, launch, install detection, push subscription), a server half (manifest, startup images, the payload guard) and its own UI, the same kind of thing as `auth` and `permissions`. It lives at `src/shared/domains/pwa/` in the domain shape (`constants/`, `lib/`, `hooks/`, `ui/`), and a domain never imports a feature.

Today's PWA client code is scattered across naked `src/shared/{lib,hooks,components}`; it moves into the domain first, path-only, so the domain is the one home instead of a second scattering: `lib/pwa.ts` → `lib/device.ts`, `lib/push.ts` → `lib/vapid-key.ts`, `hooks/use-push-subscription.ts`, `components/pwa-install-prompt.tsx`, `components/push-subscription-banner.tsx`, `components/push-subscription-manager.tsx` (mounted nowhere today; moved, not deleted; its fate is the owner's call). Storage keys follow the funnels precedent: the domain declares its own from `STORAGE_KEY_PREFIX`.

Stays where convention or ownership puts it: `public/sw.js` (plain JS served from the origin root, which scope `/` needs) and `public/pwa/*`; `src/app/manifest.ts` and the two routes (Next conventions, thin, importing from the domain); `scripts/*` (the repo's home for generators and `verify-*` checks); `launch-shell.tsx` with the dashboard feature (it composes that feature's skeletons); `splash-screen.tsx` in shared components (a primitive the meeting and proposal splashes use); `entities/push-subscriptions`, `push.router` and `providers/web-push` (resource, router and provider tiers).

### The files

New files, one component per file.

| Path | Role |
|---|---|
| `src/shared/domains/pwa/constants/launch.ts` | The launch field colour, marker name/value, start URL built from `ROOTS`, and the cover's floor, bound and stall constants (§5.4) |
| `src/shared/domains/pwa/constants/startup-images.ts` | **Generated** by the splash script: the `startupImage` entries and the size table the probe checks (§5.1) |
| `src/shared/domains/pwa/constants/storage-keys.ts` | The device switch key (§5.6) |
| `src/shared/domains/pwa/lib/launch-url.ts` | Pure helpers: is this a launch URL, strip the marker (§5.7) |
| `src/shared/domains/pwa/lib/launch-store.ts` | The launch phase store: a factory (testable with a fake clock) and the singleton (§6) |
| `src/shared/domains/pwa/lib/register-service-worker.ts` | The one registration owner (§5.6) |
| `src/shared/domains/pwa/hooks/use-pwa-launch-phase.ts` | The store's React reader (§6) |
| `src/shared/domains/pwa/ui/pwa-launch-cover.tsx` | The cover: the splash primitive, mark at rest, held until ready (§5.4) |
| `src/shared/domains/pwa/ui/pwa-launch-ready.tsx` | The ready beacon, mounted where the dashboard layout commits (§5.4) |
| `src/shared/domains/pwa/ui/pwa-launch-handoff.tsx` | Marks the launch, soft-navigates to the dashboard, owns the stall watchdog (§5.3) |
| `src/shared/domains/pwa/ui/service-worker-registrar.tsx` | Mounts the registration helper once per document (§5.6) |
| `src/shared/domains/pwa/ui/pwa-probe.tsx` | The device probe's client half (§5.1) |
| `src/features/agent-dashboard/ui/components/launch-shell.tsx` | The shell's composition: sidebar skeleton + inset + home pending view + the domain's handoff and registrar (§5.3) |
| `src/app/(frontend)/launch/page.tsx` | The shell route (§5.3) |
| `src/app/(frontend)/dev/pwa-probe/page.tsx` | Device probe beside the existing `dev` route (§5.1) |
| `scripts/generate-pwa-splash.ts` | Startup-image generator (restored from `9ca491a8` and extended, §5.1) |
| `scripts/verify-pwa-launch-url.ts`, `scripts/verify-pwa-launch-store.ts`, `scripts/verify-pwa-splash-matrix.ts`, `scripts/verify-push-launch-marker.ts` | Side-effect-free checks in the repo's `verify-*` style (§8) |
| `public/pwa/splash/*.png`, `public/pwa/icon-maskable-512.png` | Generated assets |

Moved (path-only, consumers updated in the same commit): the six files named above, into `src/shared/domains/pwa/{lib,hooks,ui}/`.

Modified: `src/app/manifest.ts`, `src/app/(frontend)/layout.tsx`, `src/app/(frontend)/dashboard/layout.tsx`, `src/app/robots.ts`, `src/shared/components/splash-screen/splash-screen.tsx`, `src/shared/domains/pwa/hooks/use-push-subscription.ts` (after its move), `src/shared/services/providers/web-push/lib/build-payload.ts`, `src/shared/config/roots.ts` (`ROOTS.pwa.shell`), `scripts/generate-pwa-icons.mjs` → `scripts/generate-pwa-icons.ts` (so it reads the shared field colour), `public/pwa/icon-*.png`, `public/sw.js`, `docs/codebase-conventions/app-shell.md`.

Deleted: `src/shared/components/splash-screen/pwa-splash-screen.tsx` (mounted nowhere since `9ca491a8`).

## 5. Design

### 5.1 Native splash assets

**One field colour.** `PWA_LAUNCH_FIELD = '#040f23'` in `src/shared/domains/pwa/constants/launch.ts` is the single source for the manifest `background_color`, the splash primitive's overlay colour, the startup images and the icons. Today the manifest and the primitive both hardcode it and the icons use `#09090b`; after this change they agree.

**iOS startup images** (`appleWebApp.startupImage` in the root layout, entries imported from the generated `src/shared/domains/pwa/constants/startup-images.ts`). The generator owns the device table; it writes one PNG per device per orientation and the matching metadata entry:

| Logical size (pt) | Scale | Devices |
|---|---|---|
| 320×568 | 2 | iPhone SE (1st), 5s |
| 375×667 | 2 | iPhone 6–8, SE (2nd/3rd) |
| 414×736 | 3 | iPhone 6–8 Plus |
| 375×812 | 3 | iPhone X, XS, 11 Pro, 12 mini, 13 mini |
| 414×896 | 2 | iPhone XR, 11 |
| 414×896 | 3 | iPhone XS Max, 11 Pro Max |
| 390×844 | 3 | iPhone 12, 12 Pro, 13, 13 Pro, 14, 16e |
| 428×926 | 3 | iPhone 12 Pro Max, 13 Pro Max, 14 Plus |
| 393×852 | 3 | iPhone 14 Pro, 15, 15 Pro, 16 |
| 430×932 | 3 | iPhone 14 Pro Max, 15 Plus, 15 Pro Max, 16 Plus |
| 402×874 | 3 | iPhone 16 Pro, 17, 17 Pro |
| 440×956 | 3 | iPhone 16 Pro Max, 17 Pro Max |
| 420×912 | 3 | iPhone Air |
| 744×1133 | 2 | iPad mini (6th, 7th) |
| 768×1024 | 2 | iPad 9.7", mini 5, Air 2 |
| 810×1080 | 2 | iPad 10.2" |
| 820×1180 | 2 | iPad 10.9" (10th/11th), Air 10.9"/11" |
| 834×1112 | 2 | iPad Pro 10.5", Air 3 |
| 834×1194 | 2 | iPad Pro 11" (1st–4th) |
| 834×1210 | 2 | iPad Pro 11" (M4, M5) |
| 1024×1366 | 2 | iPad Pro 12.9", Air 13" |
| 1032×1376 | 2 | iPad Pro 13" (M4, M5) |

Rules the generator encodes (F2, F5):
- Media query per entry: `screen and (device-width: Wpx) and (device-height: Hpx) and (-webkit-device-pixel-ratio: N) and (orientation: portrait|landscape)`. `device-width`/`device-height` are the **portrait** values in both orientations; only the PNG is rotated (W·N × H·N portrait, H·N × W·N landscape).
- The mark is `logo-dark.svg` (white house, blue R) at rest, centred on the field. Its width equals what the cover renders: 192 CSS px when the viewport's width in that orientation is under 640 px, else 224 px (the primitive's `w-48 sm:w-56`), times the scale. The cover centres in the full viewport (`fixed inset-0`, which under `viewport-fit=cover` + `black-translucent` is the whole screen), so the two frames coincide.
- Filenames carry a version suffix (`-v3`); bump it whenever the content changes, because iOS keys its cache on the URL (F2). The generated constants file carries the same version.
- No `prefers-color-scheme` variants (D1).
- `sharp` renders the SVG (the asset-generator tool crashes on this machine; research §4).

**Device probe** (`/dev/pwa-probe`, a plain page beside the existing ungated `dev/multi-step-flow` route; it reads nothing but `screen` and `navigator`): shows `screen.width × screen.height @ devicePixelRatio`, orientation, `display-mode`, `navigator.standalone`, and whether the generated table contains that size. The owner opens it in Safari on each device before the first device check; a miss is added to the table and the script rerun.

**Android** (F4, research §5):
- `scripts/generate-pwa-icons.ts` renders `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` on the navy field (mark at 60 %), plus `icon-maskable-512.png` with the mark at 50 % so it sits inside the 40 %-radius safe zone.
- The manifest lists the maskable icon as a separate entry with `purpose: 'maskable'`; the `any` entries stay. Chrome's splash then draws the mark floating on the navy field instead of a near-black tile.
- `name` ("Tri Pros Remodeling") is what the splash prints; unchanged.
- The cyan `theme_color` tints Android's status bar during the splash and in the app today; left as is, flagged in §10.

### 5.2 Manifest (`src/app/manifest.ts`)

```ts
id: ROOTS.dashboard.root,          // pins identity before start_url changes (F15)
start_url: PWA_START_URL,          // '/dashboard?launch=1'
scope: '/',                        // unchanged: push deep links need it
background_color: PWA_LAUNCH_FIELD,
icons: [192 any, 512 any, 512 maskable],
```

`PWA_START_URL`, `PWA_LAUNCH_PARAM` (`launch`) and `PWA_LAUNCH_VALUE` (`'1'`) come from `src/shared/domains/pwa/constants/launch.ts`; `ROOTS.pwa.shell` (`'/launch'`) is added to `roots.ts`. The worker is plain JS in `public/` and cannot import them: it repeats the three literals under a comment that names the constants file. They change together.

### 5.3 The shell route (`/launch`)

A server page that reads no cookies, headers or params (`export const dynamic = 'force-static'`), so Next prerenders it at build and the worker can cache it as a plain file. `metadata.robots = { index: false }`; it is not in `sitemap.ts` (that list is static routes only, so nothing to remove) and `robots.ts` gets `/launch` in `disallow`.

It renders `LaunchShell`:

```jsx
<SidebarProvider defaultOpen>                     {/* the real layout reads a cookie; the shell cannot */}
  <AppSidebarSkeleton />
  <SidebarInset className="h-full min-w-0 overflow-hidden bg-background">
    <div className="flex-1 min-h-0 pt-[env(safe-area-inset-top)]">
      <div className={DASHBOARD_MAIN_CLASS}>       {/* same padding as the dashboard template */}
        <Suspense fallback={<DashboardGenericContentSkeleton />}>
          <DataViewPending><DashboardHomePendingView /></DataViewPending>
        </Suspense>
      </div>
    </div>
  </SidebarInset>
</SidebarProvider>
<PwaLaunchHandoff />
```

- The shape follows `app-shell.md#dashboard-layout-shape-fixed` so the swap to the real layout does not move anything the cover might reveal early.
- The home pending view reads URL state through nuqs, which is `useSearchParams` underneath; in a static page that must sit under a `Suspense` boundary or the build fails. The generic skeleton is its fallback and is also what the shell shows if the pending view ever becomes dynamic.
- The cover is **not** rendered here. It lives in the root layout and is SSR-open for this pathname (§5.4), so the shell's first paint is the cover.

`PwaLaunchHandoff` (client, from the domain; the shell mounts it), on mount:
1. `pwaLaunch.begin()` (§6) and `window.__tprLaunch = true`.
2. `router.replace(ROOTS.dashboard.root)`.
3. Stall watchdog: a timer armed on mount and cleared on unmount. The handoff lives in the shell page's tree, so a completed soft navigation unmounts it; if it is still mounted after `PWA_LAUNCH_STALL_MS`, `window.location.replace(ROOTS.dashboard.root)` — unmarked, so the network answers. This is the only hard load in the design and it only fires when the soft navigation has failed.

The page also carries one inline `<script>` (the file-level eslint disable the proposal scope-of-work already uses): if `window.__tprLaunch` is still unset after `PWA_LAUNCH_STALL_MS`, `location.replace('/dashboard')`. It covers the case where the precached chunks fail to execute at all (nothing React ever runs). `PwaLaunchHandoff` sets the flag before navigating, so a working launch never trips it.

### 5.4 The cover and the ready signal

**`SplashScreen` primitive** (`splash-screen.tsx`) gains two things, both opt-in so the proposal and meeting splashes are unchanged:
- `dismiss: { mode: 'held' }` — no timer, no press; the caller closes it by flipping `open`.
- `entrance?: boolean` (default `true`) — `false` renders `SplashMark` at rest from the first frame (`playEntrance = animate && entrance`, with `animate = !reduced` untouched so the closing fade still plays). The mark's rest frame is exactly the native image.
- Its invariant layout (`position: fixed; inset: 0; z-index`) moves from classes into the inline style object it already uses for colour and opacity. A full-screen cover must not depend on a stylesheet rule being present (the August unstyled push-down; research §2). The Tailwind classes it keeps are for flex centring and spacing; losing them cannot uncover the page.

**`PwaLaunchCover`** (client, mounted once in `src/app/(frontend)/layout.tsx` as a sibling after `{children}` inside `Providers`): 

```ts
const phase = usePwaLaunchPhase()           // 'idle' | 'covering' | 'done'; server snapshot 'idle'
const pathname = usePathname()
const open = phase === 'covering' || (phase === 'idle' && pathname === ROOTS.pwa.shell)
return <SplashScreen dismiss={{ mode: 'held' }} entrance={false} open={open} onDismiss={noop} />
```

- On the shell document the server renders it open (pathname is `/launch`), so the first paint is the cover; hydration matches because both snapshots say `idle`.
- `PwaLaunchHandoff` moves the phase to `covering`, so the cover stays open through the soft navigation while the pathname changes.
- On every other document (`/dashboard` from the network, the public site) it renders nothing: phase `idle`, pathname not the shell.
- It is a leaf: no context, no children. Hazard H6 (an urgent context change during hydration forces client renders of hydrating boundaries) cannot apply.
- Reduced motion: the primitive already drops the fade; the mark is at rest anyway.

**`PwaLaunchReady`** (client, renders nothing): on mount calls `pwaLaunch.ready()` from an effect, so the frame it reacts to has painted. Mounted once in the dashboard layout, outside both Suspense slots and above the cookie branch (next to the install prompt), so it mounts on the layout's first commit: the moment the server's response has put the sidebar frame and the route's skeleton (or the sign-in screen) on screen under the cover, before the session read or the page data resolve (D2). Those slots then fill in behind a visible skeleton, exactly as on a plain document load today. `DashboardSessionContent` is not touched. On a non-launch document `ready()` is a no-op. It also posts `{ type: 'tpr:revalidate-shell' }` to the controlling worker on every dashboard document, launch or not (§5.5): on Chrome the static route answers the launch without running the worker, and after a deploy the stale shell hard-loads before its own dashboard commits, so a plain dashboard load is the only moment the worker can learn the shell is stale. The worker writes nothing when the shell is unchanged.

**Timing** (in `src/shared/domains/pwa/constants/launch.ts`):

| Constant | Value | Why |
|---|---|---|
| `PWA_LAUNCH_COVER_MIN_MS` | 300 | The cover never fades within 300 ms of the shell's first client render; a warm launch otherwise blinks |
| `PWA_LAUNCH_COVER_MAX_MS` | 4000 | The fail-open ceiling for a server that never answers: past it the cover fades over the shell's skeletons. On a launch the server answers it never binds, because ready fires on the layout's commit (D2) |
| `PWA_LAUNCH_STALL_MS` | 8000 | Past this with the pathname still `/launch`, the soft navigation has failed; hard-load `/dashboard` |
| fade | `SPLASH_FADE_S` (0.3 s) | Reused from the primitive |

### 5.5 The service worker (`public/sw.js`)

Additive. The push, notification-click and subscription-change handlers are not edited; `skipWaiting()` on install and `clients.claim()` on activate stay (F8). The file's header comment, which today says caching is deliberately absent, is rewritten.

**Constants:** `LAUNCH_PATH = '/dashboard'`, `LAUNCH_SEARCH = 'launch=1'`, `SHELL_PATH = '/launch'`, `SHELL_CACHE = 'tpr-launch-shell'`, `SHELL_ON = new URL(self.location.href).searchParams.get('shell') === '1'`.

**Why `?shell=1` on the script URL:** the registrar registers `/sw.js?shell=1` from production builds (`NODE_ENV === 'production'`: Vercel production and preview, and a local `next start`) and `/sw.js` from `next dev`. Same scope, so it is the same registration and the push subscription survives (F12); the worker reads its own URL to know whether a production build is behind it. A `next dev` document served by a worker never hydrates (F13), so the shell is never on for dev builds, tunnel included; a local production build on `localhost` does get the shell, which is what the browser checks in §8 need. No hostname guard. The `next.config.ts` headers for `/sw.js` match regardless of the query.

**install:** `self.skipWaiting()` as today, then `event.waitUntil(precacheShell().catch(() => {}))` — a precache failure never fails the install (push must keep working). On Chrome, `event.addRoutes([...])` inside try/catch (§ static routes below).

**activate:** `clients.claim()` as today; delete any `tpr-launch-shell-*` cache from earlier versions; `registration.navigationPreload.enable()` in try/catch (F6, F20).

**`precacheShell()`:** fetch `SHELL_PATH` with `cache: 'reload'`; require `ok`, status 200, not redirected, `text/html`. Read the body text, collect every same-origin `/_next/static/...` URL it references (`src`, `href`, including `?dpl=`), `cache.addAll` those, then put the shell body last under **two** keys: `SHELL_PATH` and the launch URL `LAUNCH_PATH?LAUNCH_SEARCH` (the second is what Chrome's static route and `cache.match` look up). Assets first, shell last, so a launch during the precache either misses (network) or finds a complete set.

**`revalidateShell()`:** same fetch; if the body text equals the cached shell's, stop. Otherwise precache the new set into the same cache (new assets added, shell replaced last), then delete every `/_next/static/` entry the new shell does not reference. A launch in flight during the swap holds its old shell response already; an old chunk it still needs is, at worst, fetched from the network, and the watchdogs bound the failure.

**fetch handler** (the only one):

```
if (!SHELL_ON) return
const url = new URL(request.url)
if (url.origin !== self.location.origin || request.method !== 'GET') return
if (request.mode === 'navigate') {
  if (url.pathname === LAUNCH_PATH && url.search === '?' + LAUNCH_SEARCH && !request.headers.has('rsc')) {
    event.respondWith(serveShell(event))
  }
  return                                      // every other navigation: default network; preload response is used if present
}
if (url.pathname.startsWith('/_next/static/')) {
  event.respondWith(caches.open(SHELL_CACHE).then(c => c.match(request)).then(r => r ?? fetch(request)))
}
```

`serveShell`: `cache.match(launch URL)`; on a hit, `event.waitUntil(revalidateShell())` and return it; on a miss or any throw, `return fetch(request)` and `event.waitUntil(precacheShell())`. Never a redirect, never a non-200, never anything with an `rsc`/`next-router-prefetch` header or `_rsc` param, never `/api/`, never a POST (`next-action`). Not calling `respondWith` for other navigations leaves them to the browser, which uses the preload response when one exists.

**message:** `{ type: 'tpr:revalidate-shell' }` → `revalidateShell()`. Needed because on Chrome the static route answers the launch without running the handler, so the worker would otherwise never see a launch; the page posts it on every dashboard commit because after a deploy the stale shell's own dashboard never commits.

**Static routes (Chrome 123+, F17), registered in `install`, in order, all same-origin:**
1. `{ urlPattern: { pathname: LAUNCH_PATH, search: LAUNCH_SEARCH }, requestMode: 'navigate' }` → `{ cacheName: SHELL_CACHE }`. Cache hit: served with no worker boot. Miss: straight to the network, bypassing the handler.
2. `{ urlPattern: { pathname: '/_next/static/*' } }` → `{ cacheName: SHELL_CACHE }`. Same semantics.
3. `{ urlPattern: '/*' }` → `'network'`. The worker never boots for anything else on this origin: the public site, RSC fetches, tRPC, images.

Cross-origin requests have no route and reach the handler, which returns at once. Chrome's auto-preload (F17) is moot for the launch URL because route 1 answers it without a fetch event. Browsers without `addRoutes` (Safari) use the handler path above; navigation preload hides the boot for pass-through navigations.

**Guards against the August failure modes:**

| Failure | Guard |
|---|---|
| A second document load | The shell soft-navigates; the only hard load is the stall watchdog |
| Logo animates twice | Native image, cover and shell all show the mark at rest (`entrance={false}`); the entrance animation is never played on a launch |
| Register storm / cannot unregister | One helper (§5.6), identical options everywhere, an env opt-out that unregisters and clears caches |
| Shell served to a deep link or a browser tab | Exact pathname **and** exact search; push payload guard (§5.7) |
| Post-deploy reload loop | Hard loads are unmarked (F10) |
| Chunk 404 after a deploy (Hobby, F9) | The shell and its chunks are precached as one set and replaced as one set; `/_next/static/` served from that set |
| Shell served under `next dev` (F13) | `SHELL_ON` is false without `?shell=1`, which only production builds register |
| Worker outage or eviction | Every branch falls through to `fetch(request)`; precache failure never fails install (F7, research §7) |
| Stuck cover | Floor, bound and stall watchdog (§5.4); inline watchdog for a dead JS bundle (§5.3) |

### 5.6 Registration (`register-service-worker.ts`, `ServiceWorkerRegistrar`, `usePushSubscription`)

One function owns registration:

```ts
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null>
```

- Returns `null` when `serviceWorker` is absent, or when the worker is switched off: `NEXT_PUBLIC_SW_DISABLED === '1'` at build time, or `localStorage` `tri-pros:sw-disabled` = `'1'` on the device (a switch DevTools can flip without a rebuild, which is what the August "it keeps coming back" needed). Switched off, it first unregisters every registration on the origin and deletes every cache; the push hook then reports `unsupported`.
- Registers `SW_URL` (`/sw.js?shell=1` in production builds, `/sw.js` otherwise) with `{ scope: '/', updateViaCache: 'none' }`; the same URL and options from every caller, so the calls are idempotent (F12).
- After registering, in standalone display mode only, calls `navigator.storage.persist()` and ignores the result (granted silently on both platforms for installed apps, F7, research §5; the standalone guard avoids Firefox's desktop prompt).
- Memoises the promise per document.

`usePushSubscription` replaces its direct `register(swPath)` with the helper; its `swPath` option goes (nothing passes it). `ServiceWorkerRegistrar` (client, renders nothing, calls the helper in an effect) is mounted in the dashboard layout outside the Suspense slots and above the cookie branch, next to the ready beacon, so a signed-out user's phone still gets the worker, and in the shell page. It is not mounted on the public site: marketing visitors have no reason to download the dashboard shell.

### 5.7 Push payload guard (`build-payload.ts`)

`resolveNavigateUrl` passes every `navigate` URL through `withoutPwaLaunchMarker` (`src/shared/domains/pwa/lib/launch-url.ts`, pure, tested on its own). A push that opened `/dashboard?launch=1` would be served the static shell instead of the dashboard; the rule lives in code, not in a doc.

Named so the owner can veto it: this is a provider `lib/` file importing from a domain. It already resolves against `publicUrl()` from shared config, so this is a second config-grade outward import, and the helper has no React, DAL or service behind it. The alternative, one push service every send goes through, does not exist: `push.router.ts`, `notification.service.ts` and `scripts/send-push.ts` all call `webPushClient` directly, so the payload builder is the one choke point.

### 5.8 Docs touched

Lines the change makes wrong, edited in the same commit; no new convention sections:
- `docs/codebase-conventions/app-shell.md#html-theme-boot` — the paragraph claiming an inline standalone `<style>` forces `html,body` dark is stale since `444af460`; replace it with: the launch field is the native stage plus the cover overlay, nothing forces the canvas.
- `docs/codebase-conventions/app-shell.md#dashboard-layout-shape-fixed` — the JSX block gains `ServiceWorkerRegistrar` and `PwaLaunchReady` above the sidebar provider, next to the install prompt; the branches are unchanged.
- `public/sw.js` header comment.

## 6. The launch phase store (`lib/launch-store.ts`, `hooks/use-pwa-launch-phase.ts`)

Module-level state with `useSyncExternalStore`, the shape `use-session-once.ts` already uses. The store (a factory and the singleton `pwaLaunch`) is a plain module in `lib/`; the hook in `hooks/` is its only React reader:

```
phase: 'idle' → begin() → 'covering' → ready() | bound → 'done'
```

- `begin()`: records the time, starts the bound timer (`PWA_LAUNCH_COVER_MAX_MS` → `done`).
- `ready()`: the dashboard layout has committed. If `covering`, moves to `done` at `max(now, beganAt + PWA_LAUNCH_COVER_MIN_MS)`; otherwise no-op.
- `usePwaLaunchPhase()`: server snapshot `idle`; the client's initial snapshot is also `idle`, so hydration of the shell matches its HTML.

Nothing in the store touches React context; the cover and the beacon are the only readers.

## 7. Failure handling

| Condition | Behaviour |
|---|---|
| Worker not yet active (launch #1, after an update that is still installing) | Network launch, no cover; today's behaviour |
| Cache Storage evicted | `cache.match` misses → network; `precacheShell` rebuilds it in the background |
| `/launch` fetch fails during precache (offline, 5xx) | Install still succeeds; no shell until the next revalidation |
| Precached chunk missing at runtime | Browser fetches it; after a deploy that is a 404 → React never runs → inline watchdog hard-loads `/dashboard` at 8 s |
| Soft navigation never completes (offline, function error) | Cover fades at 4 s over the shell's skeletons; stall watchdog hard-loads at 8 s; offline then shows the browser's error, as today |
| Build-id mismatch after a deploy | Next hard-loads `/dashboard` unmarked (F10); the shell is revalidated for next time |
| `respondWith` throws (the pre-17.2 class, F6) | `serveShell` catches and returns `fetch(request)` |
| User signs out, then launches | Shell → sign-in screen → ready → fade; nothing personal was cached |
| Push `navigate` carries the marker | Stripped by the payload guard |
| `addRoutes` or `navigationPreload` unsupported or throwing | try/catch; the handler path works without them |
| Reduced motion | No fade, mark at rest; the cover still lifts on ready |

## 8. Testing and verification

Automated, before any device check:
- `pnpm tsc` and `pnpm lint` clean (the `no-raw-nav-paths` rule covers the new paths; the inline script uses the existing file-level disable).
- Unit checks (tsx scripts, side-effect free, like `scripts/verify-*.ts`): the store's phase transitions and timing; the push guard strips the marker; the generator's table yields W·N × H·N PNGs and matching media strings.
- The shell route prerenders statically: the build output marks `/launch` ○ and its HTML contains the cover open (`data-splash` with `data-state="open"`) and no session-dependent content.

**Owner gate — a production build is required.** `next dev` cannot host a worker-served document (F13), and `pnpm hotfix dev` is a dev server. The plan proposes `next build && next start` in an isolated worktree (the cold-start work used `.worktrees/perf-profile` the same way), served on its own port, with the Playwright MCP browser signed in through `/api/dev/playwright-session`. This spec asks for that approval explicitly; nothing builds without it.

Browser checks on that build (Chromium, standalone rule forced as in the 2026-09-29 filming scripts; CDP cannot emulate `display-mode`):
1. First visit to `/dashboard`: worker installs, Cache Storage `tpr-launch-shell` holds `/launch`, `/dashboard?launch=1` and every `/_next/static/` URL the shell references.
2. Navigate to `/dashboard?launch=1`: served by the worker (DevTools Network "ServiceWorker" or static route), first paint is the cover, URL lands on `/dashboard`, the cover starts fading within ~100 ms of the server's skeleton appearing and before the session slot's content replaces it (a MutationObserver installed before the navigation, with the RSC response delayed 1 s so the floor cannot mask the order), no second document load (one `Navigation` entry in the performance timeline), no console errors, no hydration warnings.
3. `/dashboard` unmarked, `/dashboard/meetings`, a `?_rsc=` fetch and a push-style deep link: never served from cache.
4. The device switch: set `localStorage` `tri-pros:sw-disabled` to `1`, reload `/dashboard`: no registration, caches gone; clear it, reload: registered again.
5. Simulated deploy: rebuild with a changed shell, launch marked: old shell hydrates, hard-loads `/dashboard` unmarked once; after the worker's revalidation the next launch serves the new shell.
6. Signed out: launch marked → sign-in screen → cover lifts.
7. Reduced motion: cover present, no fade, lifts on ready.

Device checks (owner, after a Vercel preview or production deploy; the native stage cannot be emulated):
1. Open `/dev/pwa-probe` in Safari on each iPhone and iPad; every size must read "in table".
2. Remove and re-add the app from `www.triprosremodeling.com` on each device; on Android confirm `about://webapks` shows the new `start_url` (or force Update).
3. Film force-quit → tap, three times per device, light and dark, iPad also in landscape, one Android on current Chrome: expect the mark from the first frame, no white, no second mark, one fade. Launch #1 after re-adding is allowed to go to the network.
4. Push: send one test push (`pnpm push:test`), tap it: the deep link opens, not the shell.
5. Status bar on iOS 26: check the top strip over the cover (F19); if a blur band shows, that is a separate call on `black-translucent`.
6. Chrome Canary on the Android phone once: the same cold launch (the Chrome 143 regression class, F17).

Record every result in §11 before the next phase; cold-start changes shipped without device checks were reverted twice in August and that does not repeat.

## 9. Order of work and shipping

| Phase | What ships | Gate before the next |
|---|---|---|
| 1 | Native assets + manifest `id` + probe page + icons (§5.1, §5.2 without the marker) | Owner device check 1–3 with the network launch: mark from the first frame on every device |
| 2 | Cover + primitive changes + shell route + handoff + store + ready beacon (§5.3, §5.4, §6), reachable at `/launch` but not yet wired to `start_url` | Browser checks 6 and 7, and check 2 run by visiting `/launch` directly (network-served; the worker arrives in Phase 3), all on the production build |
| 3 | Worker + registrar + helper + push guard + `start_url` marker (§5.5–§5.7) | Browser checks 1–5; owner device checks 2–6 |

Each phase is one commit set on local main by explicit path, ships through the owner's normal flow, and is measured on its own. Phase 1 alone already removes the white frame on devices the old matrix missed.

## 10. Risks and open items

| Risk | Guard or note |
|---|---|
| A device size is missing from the table | The probe page shows it before the first check; adding a row is one script run |
| The home pending view cannot prerender statically | The Suspense fallback is the generic skeleton; the shell still works, just plainer under the fail-open view |
| Next rewrites the URL to `/launch` on hydration before the handoff runs | Invisible in standalone; `router.replace` lands on `/dashboard` within the same tick of effects; verified in browser check 2 |
| `?dpl=` chunk URLs differ between the shell's precache fetch and a page load | Both come from the same deploy; the precache parses what the HTML references, nothing is guessed |
| Precaching every launch of every signed-out visitor to `/dashboard` | Only the dashboard layout and the shell register; the shell set is a few hundred KB; revalidation only re-downloads on change |
| The worker now intercepts `/_next/static/` on Safari for the public site too | Only when the shell is on; a miss is a plain `fetch`; HTTP cache semantics unchanged |
| Android `theme_color` (cyan) tints the splash's status bar | Unchanged; owner call whether to move it to the navy later |
| Samsung Internet installs | Steer Android installs to Chrome (research §5) |
| iOS 26 Liquid Glass strip over the cover | Device check 5; a separate ruling on `black-translucent` if it bites |
| `next-pwa` dead dependency | Out of scope here; remains Task 15 of the cold-start plan |

## 11. Status

| Item | Status |
|---|---|
| Research | ✅ 2026-10-08 (`docs/plans/2026-10-08-pwa-launch-research.md`) |
| Rulings D1–D7 | ✅ 2026-10-08 (D7 added in the revision) |
| Spec review (owner) | ✅ 2026-10-08 (revision: D2 timing, D7 home) |
| Implementation plan | ✅ 2026-10-08 (16 tasks; subagent-driven) |
| Phase 1 — native assets | ✅ 2026-10-08 — commits `8725950c` (docs), `e6ce8cfd` (PWA domain move), `c2b2954c` (launch constants + marker helpers), `b5951294` (navy icons, maskable, manifest id), `f755d7d2` (44 startup images), `6aac8022` (probe page); tsc + lint clean; manifest and `/` HTML verified on the dev server; the maskable icon and a startup image viewed |
| Phase 1 — device check | ⬜ |
| Phase 2 — cover + shell route | ✅ 2026-10-08 — commits `4d1c139a`+`6beb3991` (primitive: `held`, `entrance`, inline box; `entrance` skips only the entrance), `17f20f18` (launch store + hook), `7a9e0965` (cover in the root layout, beacon in the dashboard layout above the cookie branch), `40f628c8` (`/launch` shell, handoff, watchdogs, robots); tsc + lint clean |
| Phase 2 — browser check | ✅ 2026-10-08 on the dev server (network-served `/launch`): cover is the first painted element (navy, mark at rest), one navigation entry, cover starts closing 14 ms (signed out) / 8 ms (signed in) after the dashboard layout commits with the RSC delayed 1 s, 300 ms fade; Back never returns to `/launch`; reduced motion lifts with no fade and no overlay left; RSC hanging → cover lifts at 4 s over the shell, unmarked hard load at 8 s; no console errors. Open: under `prefers-reduced-motion` the primitive's SSR'd `transition-duration` mismatches the client's (dev-only React attribute-mismatch error; pre-existing for any SSR-open splash) |
| Phase 3 — worker + marker | ✅ 2026-10-08 — commits `508811f6` (one registration owner + `tri-pros:sw-disabled` device switch), `f5b954ae` (push payload guard), `0e3539f7`+`8c49a06d` (sw.js launch-shell block; one sync at a time, preload fallback), `82bb0c74` (beacon revalidation after a shell launch, marked `start_url`, app-shell.md); tsc + lint clean; dev-server look: plain `/sw.js` registration (no `?shell=1` under next dev), no shell cache, push handlers byte-for-byte, manifest `start_url` `/dashboard?launch=1` with `id` `/dashboard` |
| Phase 3 — browser + device checks | ⬜ |
| Docs deleted (this spec, the research, the plan) | ⬜ |
