# PWA launch: logo splash + service-worker shell — research

> **Status:** research only (2026-10-08). Nothing built. Feeds the design spec that follows the owner's rulings in §8. Four read-only research passes (iOS/WebKit, Android/Chromium, Next.js 15.5 + Vercel, production app-shell practice) plus the code and the two reverted attempts. Every claim names its source; `UNVERIFIED` marks what no primary source confirmed.
> Delete this file when the spec that cites it ships (git keeps it).

## 1. What a cold launch does today (verified in code 2026-10-08)

| Piece | State |
|---|---|
| `src/app/manifest.ts` | `start_url: '/dashboard'`, `scope: '/'`, `display: standalone`, `background_color: '#040f23'`, `theme_color: '#03AFED'`, icons 192 + 512 (`any`, no `maskable`), no `id`, no `screenshots` |
| `public/sw.js` | Push only: `push`, `notificationclick`, `pushsubscriptionchange`. `skipWaiting()` on install, `clients.claim()` on activate. **No `fetch` handler.** |
| Registration | Only `usePushSubscription` (`src/shared/hooks/use-push-subscription.ts`) calls `register('/sw.js')`, via `PushSubscriptionBanner` inside `DashboardSessionContent` — so on every signed-in dashboard load, no `scope`/`updateViaCache` options |
| `next.config.ts` | `/sw.js` → `no-cache, no-store, must-revalidate`, `Service-Worker-Allowed: /` |
| `src/app/(frontend)/layout.tsx` | **No** `appleWebApp.startupImage`, **no** standalone inline style (both removed: `ea88fd8a`, `444af460`). `statusBarStyle: 'black-translucent'`, `viewportFit: 'cover'`. Theme = next-themes `system`, class attribute |
| `src/app/(frontend)/dashboard/layout.tsx` | Cookie-gated shell streams before the session (`AppSidebarSkeleton`, `DashboardContentSkeleton` → route pending views); `template.tsx` uses `useIsHydrating()` so a document load is not hidden |
| Splash primitive | `src/shared/components/splash-screen/splash-screen.tsx` (`SplashScreen`, navy `#040f23`, `SplashMark` with an entrance animation; `animate=false` renders the resting mark). `PwaSplashScreen` exists but is mounted nowhere; `ProposalSplashScreen` and `MeetingSplashMount` use the primitive |
| Icons | `scripts/generate-pwa-icons.mjs` composes `logo-dark.svg` on **`#09090b`** (not the manifest navy) |
| Vercel | Hobby plan, functions in pdx1. No Skew Protection (Pro+). `NEXT_DEPLOYMENT_ID` is set by Vercel, so chunk URLs carry `?dpl=` |
| Cold TTFB (prod, 2026-09-29) | signed-in `/dashboard` 1.65 s cold / 0.48–0.66 s warm |

⚠️ Stale ref — `docs/codebase-conventions/app-shell.md#html-theme-boot` says an inline `@media (display-mode: standalone)` `<style>` forces `html,body` to `#09090b`; the layout has no such block since `444af460` and the manifest colour is `#040f23`. Fix in the same change as the launch work.

## 2. What was tried and why it failed

| When | What | Why it was reverted | Lesson carried into the design |
|---|---|---|---|
| 2026-08-06 | Static `public/app-shell.html` served by the SW for `/dashboard?source=pwa`, then `location.replace('/dashboard')` | Hard reload replayed the logo entrance (logo → flicker → logo); eager registrar + push hook both registered on every mount with no opt-out, so DevTools Unregister never stuck; `skipWaiting`+`claim` seized open tabs | One document, never a reload; the first paint shows the mark **at rest**; one registration owner with an opt-out |
| 2026-08-07 | `html{background}` in standalone (two colours) | The white was the **native** launch surface; CSS cannot reach it | Only startup images / manifest colour reach the pre-paint stage |
| 2026-08-08 | Logo on 18 startup images + `PwaLaunchScreen` SSR cover | Cover used a `globals.css` class → rendered unstyled under deploy skew; the image matrix never matched the owner's device (exact-dimension rule) | Cover styles inline; the device matrix must be generated from the real devices and verified with a probe |
| 2026-09-29 | Cold-start Phase 1 (server seams, streaming layout) | Shipped; cold TTFB 4.31 → 1.65 s | The server wait is now ~0.5–1.7 s; the SW hides it, it does not remove it |
| 2026-10-05 | Standalone navy `html,body` rule | Owner: the installed app follows light/dark; the forced colour painted a navy column behind the floating rail in light mode | Nothing forces the page canvas; a splash is an overlay that unmounts |

## 3. Facts that bind the design

| # | Fact | Platform | Consequence | Source |
|---|---|---|---|---|
| F1 | With no `apple-touch-startup-image`, iOS paints a blank (white) native surface until the web view's first paint. iOS ignores manifest `background_color`. iOS 26 changed nothing here | iOS 18/26 | The startup-image matrix is the only lever for the native stage | web.dev/learn/pwa/web-app-manifest; webkit.org/blog/17333, 17541, 17640; Safari 26.0 notes |
| F2 | Startup images match by **exact** `device-width`/`device-height`/`-webkit-device-pixel-ratio`/`orientation`; PNG must be exactly W·N × H·N; no match → white. Images are frozen at Add-to-Home-Screen; iOS keys the cache on the URL | iOS | Generate per device **and orientation** (iPad landscape), version the filenames, re-add the app after any change | firt.dev/notes/pwa-ios; Apple forum 733490; repo 2026-08 device notes |
| F3 | `(prefers-color-scheme: dark)` in the startup `media` works but the choice is **locked at install** (WebKit 259328, NEW) | iOS | A theme-following native splash cannot follow a theme change after install | bugs.webkit.org/259328 |
| F4 | Android's splash is one baked `background_color` + the icon (prefers `purpose: maskable`, rendered as an adaptive icon) + `name`; **dark mode does not change it**; it hides at first visually-non-empty paint with a 300 ms fade, no minimum | Android Chrome | One brand colour for the native stage on both platforms is the only consistent choice | Chromium `SplashController.java`, `shortcut_info.cc`, `manifest.mojom`; blink-dev dark-colour OT lapse |
| F5 | iOS removes the startup image at the web view's **first paint**; the fade must be a web-layer cover that already looks like the image | iOS | The first HTML frame reproduces the splash: same colour, same mark, no motion, inline styles | practitioner reports (all secondary); Android `SplashController` hides on first paint |
| F6 | A SW can intercept the launch navigation to `start_url` on iOS (12.1.1 fix holds; the 17.0 `respondWith` "Internal error" was fixed in Safari 17.2); navigation preload is supported since iOS 15.4 | iOS | SW-served launch is viable; benefit starts at launch #2 (the installing launch is never controlled) | WebKit 190269, 261767; Safari 17.2 notes; caniuse |
| F7 | Home-screen web apps are **exempt** from Safari's 7-day script-writable-storage cap; `navigator.storage.persist()` is granted for them | iOS | Cache Storage survives; still design it to be rebuildable | webkit.org/blog/10218, 14403, 13878 |
| F8 | Every navigation triggers a SW soft-update check (spec Handle Fetch step 12); `skipWaiting`+`claim` cannot hijack an in-flight HTML response | both | A SW file that rarely changes can keep `skipWaiting`+`claim` (push updates land promptly, as the 2026-08 ruling wanted) | w3c.github.io/ServiceWorker; web.dev/articles/service-worker-lifecycle |
| F9 | **Vercel Skew Protection is Pro/Enterprise only.** On Hobby, a cached HTML page's `/_next/static/chunks/<hash>?dpl=` URLs 404 as soon as a new deploy lands | Vercel | Whatever HTML the SW serves must bring its own chunks (precached together as one consistent set) | vercel.com/docs/skew-protection |
| F10 | Next 15.5.9: `router.refresh()`/soft navigation on a build-id mismatch does `doMpaNavigation` — a **hard** document load back through the SW | Next | The SW must serve the shell only for a **launch-marked URL**, so the post-deploy hard load (unmarked) goes to the network; otherwise it loops | `fetch-server-response.js` (15.5.9) |
| F11 | Cache Storage ignores HTTP cache headers; `cache.match()` honours `Vary`, and Next sends `Vary: rsc, next-router-state-tree, …`, so a cached document can never answer an RSC fetch | Next | RSC/prefetch requests are safe by construction; still exclude `RSC`/`_rsc`/`next-action`/`/api` explicitly | MDN Cache; nextjs.org cdn-caching |
| F12 | `register()` with the same script URL + scope + `updateViaCache` is idempotent; a **new scope = new registration** and the push subscription stays on the old one | both | One registration helper, identical options everywhere, scope stays `/` | MDN `ServiceWorkerContainer.register` |
| F13 | Under `next dev`, a SW-served document never hydrates (React debug channel waits on HMR; vercel/next.js#99423, closed-unfixed) | dev | The shell logic is off on `localhost`; an env opt-out unregisters | github.com/vercel/next.js/issues/99423 |
| F14 | No production PWA serves the last **per-user** server-rendered HTML cache-first; the shipped pattern is a content-free shell (Flipkart Lite, Twitter Lite, Pinterest, PWA Directory) revalidated in the background | practice | Cache a static shell document, never the real dashboard HTML | §7 sources |
| F15 | `start_url` with a query is launched verbatim on Android; changing `start_url` changes app identity unless manifest `id` is set; any manifest change needs a WebAPK re-mint (24 h check, app closed, charging, Wi-Fi; force via `about://webapks`) | Android | Set `id` **before** changing `start_url`; expect a delayed update on team phones | Chromium `HostBrowserLauncherParams.java`; web.dev/articles/manifest-updates |
| F16 | `notificationclick` → `openWindow(url)` is an ordinary navigation and reaches the `fetch` handler | both | The shell rule keys on the exact launch URL; push deep links never carry the marker | w3c `clients-openwindow`; MDN |
| F17 | Chrome 123+ Static Routing (`event.addRoutes`) can serve a cache entry or go straight to the network **without booting the SW**; Chrome 140+ AutoPreload issues the network request in parallel when the SW is idle; Chrome 143 shipped a blank-cold-start regression (crbug 466790291, fixed Jan 2026) | Android | Optional: static routes for Chrome (launch URL → cache, everything else → network); test cold launch on current Chrome and Canary | developer.chrome.com/blog/service-worker-static-routing; blink-dev AutoPreload; crbug 466790291 |
| F18 | Chrome's automatic install prompt still requires a `fetch` handler (menu install does not, since 108) | Android | Adding the handler gives the team phones the install prompt | developer.chrome.com/blog/update-install-criteria |
| F19 | Safari 26 ignores `theme-color` for chrome tint; with `black-translucent` the status bar overlays content; one report of a Liquid Glass blur strip over the top ~110 px in home-screen apps (n=1) | iOS 26 | Status bar text sits on the navy cover; check the blur strip on the owner's devices | benfrain.com (2025-11-16); herdr PR 199 (UNVERIFIED) |
| F20 | SW boot costs ~50 ms desktop, ~250 ms mobile, 500 ms+ on slow devices; a fetch handler puts that on **every** navigation under scope `/` (the public site too) | both | Pass-through navigations use `event.preloadResponse` (iOS) or a static `network` route (Chrome) so the public site pays nothing | web.dev/blog/navigation-preload; Workbox docs |

## 4. iOS details worth keeping

- Devices in the August matrix (portrait only): 320×568@2, 375×667@2, 414×736@3, 375×812@3, 414×896@2/@3, 390×844@3, 428×926@3, 393×852@3, 430×932@3, 402×874@3, 440×956@3, iPads 768×1024@2, 810×1080@2, 820×1180@2, 834×1112@2, 834×1194@2, 1024×1366@2. It "never matched the test device": either the device is not in that list (the 2025 iPhone Air is 420×912@3) or the iPad was in landscape. A probe (`screen.width`, `screen.height`, `devicePixelRatio`, orientation) run in Safari on each real device settles it before generating.
- `pwa-asset-generator` crashes on WSL + Node 24; `sharp` works (the deleted `scripts/generate-pwa-splash.ts` in `9ca491a8` is the starting point).
- `display-mode: standalone` is reliable on iOS; CDP/Playwright cannot emulate it or the native frame — web-layer checks force the rule, the native stage is device-only.
- Cross-document View Transitions (iOS 18.2+) cannot animate from the native image; the fade is a CSS opacity transition on the cover.

## 5. Android details worth keeping

- Add a separate `purpose: 'maskable'` 512 icon with the navy field and the mark inside the 40 %-radius safe zone; keep the `any` icons; regenerate all icons on `#040f23` so the splash icon blends into the splash field.
- `name` (not `short_name`) is drawn on the splash.
- Richer install UI needs ≥1 `screenshots` entry with `form_factor: 'narrow'` plus `description` — nice to have, not required.
- Samsung Internet mints its own WebAPK, requires a SW, pads the maskable icon in a white box, and its 2026 WebAPKs trip Play Protect — steer Android installs to Chrome.
- Call `navigator.storage.persist()` after registration; installation only raises the odds of a silent grant.

## 6. Next.js + Vercel details worth keeping

- Serwist 9.5.13 (`@serwist/next`) is webpack `InjectManifest`; it overwrites `public/sw.js` from a `sw.ts` source and precaches **all** of `_next/static` by default (every deploy re-downloads the bundle on install). The Turbopack route (`@serwist/turbopack`) has an open Vercel crash (#360). Nothing in `defaultCache` serves navigations cache-first. Verdict: not needed for one shell route; hand-roll inside the existing `sw.js`.
- The shell's chunk set can be derived in the SW itself: fetch the shell HTML, collect every `/_next/static/…` URL in it (scripts, CSS, fonts, with `?dpl=`), `addAll`. No build step, no stamping. Revalidate the shell in the background on each launch and swap the cache atomically; the SW file itself only changes when its code changes.
- Hand-written SW versioning via `VERCEL_DEPLOYMENT_ID` stamping is possible but needs a build-command change (pnpm does not run `prebuild`); a `/sw.js` route handler turns every update check into a function invocation. Neither is needed with self-revalidation.
- Next adds no header a SW must respect on document navigations; exclude `RSC`/`next-router-prefetch` headers, `?_rsc`, `next-action` POSTs, `/api/`, `/_next/image`, non-`navigate` modes, cross-origin, redirects and non-200.
- `next-pwa@5.6.0` is a dead dependency (never wired); removal is already Task 15 of the cold-start plan.

## 7. The proven pattern (what the strongest sources agree on)

1. Tap → native splash: Android from the manifest (`background_color`, icon, `name`), iOS from the per-device startup image. Both identical to the first painted frame.
2. The browser issues the navigation to `start_url`; the SW (active from launch #2) answers from cache with a **content-free shell document**, never per-user HTML. Launch #1 is full SSR.
3. The shell's first paint reproduces the splash exactly: same field colour, same mark at rest, inline styles, no motion.
4. An in-page cover (already the logo) stays until the app signals ready, then fades once. One document load, never a second one.
5. The app hydrates, pulls live data, and revalidates the shell in the background for the next launch.
6. Precache is best-effort: a miss falls through to the network; nothing in the launch path can block install or activation.
7. Per-build consistency: the cached shell and the chunks it references are stored together and replaced together.
8. Sign-out: nothing personalised is ever cached, so nothing to purge.

Sources: developer.chrome.com/blog/app-shell (2015), Flipkart Lite (medium.com, 2015-11-11), web.dev/case-studies/twitter, Pinterest case study (2017-11-29), Hybrid-rendered PWA (medium.com dev-channel, 2017-08-18), web.dev/articles/offline-cookbook, developer.chrome.com/docs/workbox/app-shell-model, developer.apple.com HIG "Launching", developer.android.com splash-screen, serwist.pages.dev (defaultCache), nextjs.org/docs/app/guides/progressive-web-apps.

Where sources disagree (the owner's calls, §8): cache-first shell vs network-first HTML; one brand colour vs per-scheme splash; hold the cover until ready vs fade at first paint; `skipWaiting` now vs prompt-to-reload; brand moment on the launch screen (Apple says no, Flipkart/Android fade one in).

## 8. Open decisions

| # | Decision | Options | Recommendation and why |
|---|---|---|---|
| D1 | Splash colour in light mode | (a) brand navy `#040f23` always; (b) theme-following (iOS only, locked at install; Android stays navy) | **(a)**. F3 + F4: (b) cannot be consistent across platforms or after a theme change. The navy is an overlay that unmounts, so the 2026-10-05 ruling (nothing forces the page canvas) still holds |
| D2 | When the cover fades | (a) hold until the real sidebar and page are committed (session resolved), bounded at ~4 s, then fade; (b) fade at the shell's first paint, show skeletons | **(a)**. It is the "logo splash" asked for and hides the sidebar/session swap; the bound makes skeletons the fail-open view |
| D3 | Launch marker | `start_url: '/dashboard?launch=1'` + manifest `id: '/dashboard'`; every phone re-adds / re-mints once | Required by F10/F16. Push `navigate` values never carry it |
| D4 | Caching approach | (a) static shell route served for the marked launch URL + its chunks precached; (b) stale-while-revalidate of the real `/dashboard` HTML | **(a)**. F9 (Hobby chunk 404s), F14 (nobody ships (b)), no stale data flash, no per-user cache, no sign-out purge |
| D5 | Service-worker tooling | hand-rolled in `public/sw.js` vs Serwist | **hand-rolled** (§6); push handlers untouched |
| D6 | Devices to verify | owner's iPhone/iPad models + iOS version; team Android models + browser | Needed to generate the iOS matrix and to know where to run checks |

## 9. Verification that cannot be faked

- Native stage: device only — force-quit → tap, filmed, light and dark, iPhone and iPad (portrait + landscape), one Android phone on current Chrome. Expect: logo on navy with no white frame, no second logo, one fade into the live dashboard.
- Web layer: Playwright with the standalone rule forced, served from a production build (`pnpm hotfix dev` on :3010, never `next dev`), DevTools Application → Service Workers / Cache Storage: launch URL served from the SW, `/dashboard` unmarked and `?_rsc=` never served from cache, push deep link opens the right page.
- Deploy skew: deploy, then launch without reinstalling: expect one network launch, then shell launches again.
- Sign-out → launch: shell → sign-in screen, no cached personal content.
