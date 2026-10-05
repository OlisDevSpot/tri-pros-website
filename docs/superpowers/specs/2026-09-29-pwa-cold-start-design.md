# PWA Cold Start — Design

> **Status:** approved in conversation 2026-09-29 (§1 goal and order, §5–§6 design); written spec awaiting owner review.
> **Supersedes:** the unmerged research note `docs/plans/2026-09-23-pwa-cold-start-optimization.md` on branch `origin/claude/pwa-loading-optimization-be6nlb`. Its code findings were re-verified against `main` on 2026-09-29 and are folded in here; its cost estimates are replaced by measurements (§2, §4). The branch is not merged.
> **Code comments never cite this spec.** They say why, per CLAUDE.md.

## 1. Goal and success criteria

The installed iPhone PWA opens `/dashboard` (`src/app/manifest.ts` `start_url`). Today a launch after idle takes roughly 5–7 s before real data shows.

| Metric (installed PWA, iPhone) | Target |
|---|---|
| Cold launch (≥ 20 min idle): tap → real dashboard data | ≤ 1.5 s once code **and** hosting work land; code alone is measured and recorded, not targeted |
| Warm launch: tap → real dashboard data | ≤ 1 s |
| In-app navigation | No regression: the previous page stays visible until the next is ready (no route `loading.tsx`) |
| Phase 1 local proxy (§4.2) | `/dashboard` ≤ 6 MB minified server JS and ≤ 0.6 s cold first request (from 11.0 MB, ≈ 1.1 s) |

Owner decisions (2026-09-29):
- **Code first, paid later.** Every code improvement ships and is measured before any paid tier is bought (§7).
- Each phase ships to production and is measured on its own. Cold-start changes shipped without device checks were reverted twice in 2026-08; that does not repeat.

## 2. What a cold launch does today (verified 2026-09-29)

| # | Stage | Cost | Basis |
|---|---|---|---|
| 1 | Vercel function boots. Every dashboard page imports the whole tRPC `appRouter` (`src/trpc/server.ts`), so it loads and compiles every provider SDK's code: 11.0 MB of minified server JS for `/dashboard`, 3.4 MB of it twilio (§4.3) | **≈ 3.6 s** | curl `www…/dashboard`, no cookie (no DB): cold TTFB 4.40 s vs warm 0.77 s |
| 2 | `dashboard/layout.tsx` awaits `getCachedSession()` before rendering anything. The better-auth cookie cache (`maxAge: 300`) has expired, so it hits Neon, which sleeps after 5 min on the Free plan | a few hundred ms wake + TCP/TLS | Neon docs; project is `free_v3`, suspend fixed |
| 3 | `dashboard/page.tsx` awaits `protectDashboardPage()` (same memo), then fires six `prefetch()`es. Each builds its context through `createHTTPTRPCContext`, which reads the session again under its **own** `cache()` — a second sequential DB round-trip | ~1 extra round-trip + queries | `src/trpc/lib/create-http-context.ts` |
| 4 | HTML streams, but `dashboard/template.tsx` renders `motion.main initial={{ opacity: 0 }}`, so the whole main area is invisible until JS downloads and hydrates. Home modules use `useQuery`, so the server renders skeletons and data appears only after hydration | ~0.5–1.5 s on a phone | code |
| 5 | Root `AbilityProvider` (`casl-provider.tsx`) calls better-auth `useSession()` → `/api/auth/get-session`, a separate function. Until it answers, `useAbility()` denies everything | up to ≈ 2.1 s | curl, cold, no cookie |

Already done or ruled out:
- Functions already run in **pdx1**, next to Neon us-west-2 (`x-vercel-id`), via the Vercel project setting. The code-level `preferredRegion` was reverted (`91bb103e`) and stays out.
- `DATABASE_URL` already uses Neon's pooled host.
- Launch paint is already dark: inline standalone `<style>` in `src/app/(frontend)/layout.tsx` plus manifest `background_color`.
- Driver swap (`neon-http` / `neon-serverless`): rejected; nine `db.transaction()` call sites and the DAL `DbOrTx` contract.

## 3. Order of work

| Phase | What | Who |
|---|---|---|
| 0 | Baseline measurement (§4.1) and the local boot profile (§4.2) | owner + Claude |
| 1 | Server code (§5) | Claude |
| 2 | Client code (§6) | Claude |
| 3 | Measure, then decide paid tiers (§7) | owner |

Each phase ends with `pnpm tsc && pnpm lint`, a production ship, the §4.1 measurements and the §8 device checks, recorded in §10. Phase 1 also reruns §4.2 before shipping.

## 4. Phase 0 — measure

### 4.1 Measurement protocol (run at the end of every phase)

1. **Function cold boot:** right after a production deploy, a function has no warm instance. `curl -s -o /dev/null -w 'ttfb=%{time_starttransfer}\n'` against `https://www.triprosremodeling.com/dashboard`, `/api/auth/get-session` and `/api/trpc/healthcheck` with no cookie, then again (warm). Always from the same machine so runs compare.
2. **Signed-in cold path:** after ≥ 20 min with no traffic, the same curl for `/dashboard` with the owner's better-auth session cookie (`-H 'cookie: …'`), then again warm.
3. **Vercel Observability** (owner): function cold-start rate and startup duration for the dashboard and `/api/*` functions.
4. **Device** (owner): installed PWA, tap → real data, three cold launches (≥ 20 min idle) and three warm. Stopwatch or screen recording.
5. **Origin check, once:** Vercel logs for apex `triprosremodeling.com/dashboard` 307s. If present, the PWA was installed from the apex and every launch pays a redirect; reinstall it from `www`.

### 4.2 Boot profile (local, production build in an isolated worktree)

A production build in `.worktrees/perf-profile` (gitignored, detached at `HEAD`, `.env` symlinked). Its `next.config.ts` gets two worktree-only edits that are never committed: server `optimization.moduleIds = 'named'` (so bytes can be attributed to packages; minification stays on, as deployed) and `experimental.preloadEntriesOnStart: false` (Next 15 otherwise loads every route at `next start`, which hides per-route cost). Then, per route (`/dashboard`, `/api/trpc/healthcheck`, `/api/auth/get-session`): a fresh `next start`, first request (cold) and second (warm) timed, no cookie. Bytes are attributed by parsing the route entry's chunk list (`.X(0,[…])`) and the named module keys in each chunk. The two scripts are embedded in the implementation plan so later phases rerun the same measurement. The worktree is kept until Phase 1 is measured, then removed.

This is a proxy: a fast local machine, no network, no Vercel unpacking. It ranks causes and tracks progress; §4.1 is the verdict.

### 4.3 Boot profile results (2026-09-29, `HEAD` 5d044e07)

| Route | Minified server JS | Cold first request | Warm |
|---|---|---|---|
| `/dashboard` | 11.0 MB | 1.09–1.15 s | 36–46 ms |
| `/api/trpc/healthcheck` | 8.7 MB | 0.79–0.81 s | 8–9 ms |
| `/api/auth/get-session` | 1.4 MB | 0.26–0.28 s | 8–14 ms |

Plus ≈ 0.8 s of `next start` itself before any route loads. Cold cost tracks code size (≈ 0.1 s per MB here); CPU self-time inside SDKs is small, and most of the cost is Node reading and compiling the code.

Largest avoidable packages in `/dashboard` (none is needed to render it):

| Package | KB | Comes in through |
|---|---|---|
| `twilio` | 3,439 | `providers/twilio/client.ts` static import |
| `resend` + `svix`, `libmime`, `iconv-lite`, `encoding-japanese` | ≈ 900 | `providers/resend/client.ts`, email templates |
| `pdf-lib`, `pdfmake` | ≈ 540 | `src/shared/lib/pdf/*`, `file-optimization/strategies/pdf.ts` |
| `ably` + `got`, `ws` | ≈ 550 | server `providers/upstash/realtime.ts` + SSR of the root `RealtimeProvider` |
| `ai`, `@ai-sdk/openai`, `@ai-sdk/provider-utils` | ≈ 260 | `providers/ai/client.ts` |

Together ≈ 5.7 MB, about half of the route. Checked and not a problem in the deployed build: `react-icons` (5.8 MB in an unminified build, removed by the minifier's dead-code elimination).

After Phase 1 server seams (`4313ed27`): `/dashboard` 4.8 MB, cold 1260 / 1170 / 1284 ms; `/api/trpc` 2.5 MB, cold 867 / 940 / 840 ms; `/api/auth` 1.4 MB, cold 490 / 551 / 512 ms. Size target met (≤ 6.0 MB); cold-time target missed (median 1260 ms vs ≤ 600 ms) — Task 9 stopped per plan and reported the miss with a proposed next seam instead of starting Task 10.

A/B under equal load (6 interleaved rounds, 1f1ee4aa vs 4313ed27): `/dashboard` cold median 1,904 → 1,106 ms, `/api/trpc` 1,521 → 725 ms, `/api/auth` 457 → 479 ms (unchanged code); normalized to `/api/auth`, ≈ 0.62 s at the quiet-machine conditions above. The earlier single run above was taken under heavier load. Remaining cold time: V8 compile ≈ 0.47 s, auth + DB schema graph ≈ 0.32 s (drizzle-zod ≈ 90 ms), tRPC app router ≈ 0.25 s; Next's page floor ≈ 0.48 s.

## 5. Phase 1 — server code

### 5.1 One session read per request

`createRSCTRPCContext` stops routing through `createHTTPTRPCContext` and builds its context from `getCachedSession()`, sharing the memo the layout and `protectDashboardPage()` already use. The `/api/trpc` HTTP adapter context is unchanged. Update the "possible follow-up" note in `get-cached-session.ts` and `src/trpc/DOCS.md#rsc-prefetch-uses-rsc-context` in the same change.

### 5.2 Heavy SDKs load on first use

Each heavy provider keeps its current export shape. Its methods load the SDK through `await import()` on first call (memoized by a small `lazyAsync` helper in `src/shared/config/lazy-async.ts`, sibling of `lazy-proxy.ts`, where construction or configuration must happen once; a rejection is not cached), so callers do not change and the SDK's code is no longer in the route's boot graph (webpack splits an `import()` into its own chunk, read only when called). Scope, from §4.3:

| Package(s) | Seam | Notes |
|---|---|---|
| `twilio` | `providers/twilio/client.ts` | Only the REST client (the 3.4 MB) loads through `await import('twilio')` inside the existing `sdk()` memo. The synchronous helpers import twilio's own small modules directly (`twilio/lib/twiml/VoiceResponse`, `…/MessagingResponse`, `twilio/lib/jwt/AccessToken`, `twilio/lib/webhooks/webhooks`) and stay synchronous; `RestException` comes from `twilio/lib/base/RestException` (no dependencies) and stays an exported class, so the two `instanceof RestException` callers do not change. |
| `resend` (+ its mail-parsing deps), `@react-email/components` + templates | `providers/resend/client.ts`, `providers/resend/lib/render-emails.tsx` | `resendClient` keeps its object shape (`resendClient.emails.send`); the SDK loads inside it via `lazyAsync(() => import('resend'))`. The six call sites in `email.service.ts` do not change; only the react-email templates are imported dynamically there. |
| `pdf-lib`, `pdfmake` | `src/shared/lib/pdf/*`, `src/shared/lib/file-optimization/strategies/pdf.ts` | `pdfkit` is already a server external. |
| `ably` (server REST) | `providers/upstash/realtime.ts` | The `ably` export becomes a `realtimeClient` object with `publish(channel, event, data)` (the `<provider>Client` convention; `ablyClient` is the browser client's name); its two callers switch to `realtimeClient.publish(...)`. The client half is §6.4. |
| `ai`, `@ai-sdk/openai` | `providers/ai/client.ts` | |
| `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` | `providers/r2/client.ts` | `client-s3` is a Next server external, so it is absent from the byte counts but still `require`d from `node_modules` at boot (≈ 80 ms raw). |
| `sharp` | `src/shared/modules/media/core/lib/process-image-variants.ts` | Server external, native addon (≈ 43 ms raw `require`). |

Guard: an ESLint rule — the core `no-restricted-imports` aliased as `lazy-only/imports` (the same technique as `project/no-inline-table-config` in `eslint.config.js`), not `ts/no-restricted-imports` — bans static value imports of these packages (type-only imports allowed; the `import type … from 'twilio/lib/…'` lines stay), plus static imports of `providers/resend/emails/*` from outside that folder. `no-restricted-imports` does not see `import()` expressions, which is exactly the allowed form. A regression then fails `pnpm lint`.

Target, remeasured with §4.2 at the end of Phase 1: `/dashboard` ≤ 6 MB of minified server JS and ≤ 0.6 s cold first request locally (from 11.0 MB and ≈ 1.1 s). Expected on Vercel: roughly 1 s off each cold boot (the local saving scaled by the ≈ 1.8× production-to-local ratio: 3.6 s measured vs ≈ 2 s local boot plus first request); §4.1 confirms.

Out of this change: `web-push` and `sanitize-html` (each under 100 KB in the route). Rerun §4.2 after Phase 1, including the list of server externals the route `require`s at boot (today: `@aws-sdk/client-s3`, `sharp`, `pdfkit`); anything still above 100 KB or 30 ms and not needed to render gets the same treatment.

### 5.3 The dashboard layout renders before the session

`src/app/(frontend)/dashboard/layout.tsx` stops awaiting the session. It reads only request cookies (no I/O):

- **No better-auth session cookie** (`getSessionCookie` from `better-auth/cookies`): render the sign-in screen directly, no skeletons, as today.
- **Cookie present:** render the shell immediately. Three server components, each under its own `<Suspense>`, read the session through the shared `getCachedSession()` memo (one DB round-trip total):
  - `DashboardSessionSidebar` → `AppSidebar`, fallback `AppSidebarSkeleton`
  - `DashboardSessionContent` → push banner + page, or `DashboardSignIn` if the cookie turned out stale; fallback `DashboardContentSkeleton`
  - `DashboardSessionMobileNav` → `DashboardMobileNav`, no fallback
- `MeetingSplashMount` renders on cookie presence (no DB), outside the Suspense slots, so it stays the first paint of a meeting.
- `AppSidebarSkeleton` renders the same `<Sidebar collapsible="icon">` primitive as `AppSidebar` (its in-flow `sidebar-gap` div reserves the sidebar's width, so rendering the same primitive keeps the inset from shifting), with fixed skeleton widths (no random widths: they mismatch server and client).
- `DashboardContentSkeleton` is generic and padded like the template, so the swap does not jump.

Invariants kept (`app-shell.md#dashboard-layout-shape-fixed`): the `flex-1 min-h-0` div stays outside every Suspense, no layout-level scroll, `overflow-hidden` on the inset, no route `loading.tsx`. Layouts persist across soft navigations, so these boundaries only suspend on document loads.

Known behaviour change: a signed-in non-internal user who opens `/dashboard` is still redirected by `protectDashboardPage()`. The redirect is already client-side today (the current layout wraps the page in `<Suspense>`, so `redirect()` is thrown inside a boundary: 200 + meta refresh, not a 307) and stays so; the only difference is that the content skeleton shows until the client redirects.

New files (one component each) under `src/features/agent-dashboard/ui/components/`: `dashboard-session-sidebar.tsx`, `dashboard-session-content.tsx`, `dashboard-session-mobile-nav.tsx`, `app-sidebar-skeleton.tsx`, `dashboard-content-skeleton.tsx`.

## 6. Phase 2 — client code

### 6.1 Page entrance fades are CSS, not motion

`dashboard/template.tsx` becomes a server component whose `<main>` keeps its classes (including `has-data-stage:p-0`) and adds `motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200` (`tw-animate-css` is already imported in `globals.css`). A CSS animation runs from the first paint without hydration; the template still remounts per navigation, so the fade still replays per page.

Same swap for `src/shared/components/records-page-motion-shell.tsx` (`slide-in-from-bottom-8`, **no delay**: a delayed CSS enter keeps SSR content hidden for the delay) and the page-level wrapper in `src/features/schedule-management/ui/views/schedule-view.tsx`. The inert `exit` prop goes with it. Motion inside components is unaffected; the rule is only "no `initial={{ opacity: 0 }}` on an element that wraps SSR content".

Update the `MeetingSplashMount` comment, which reasons from the template's opacity-0 start.

### 6.2 Dashboard home data streams in the HTML

- `dashboard-snapshot-strip.tsx`: the three counts through one `useSuspenseQueries` call.
- `dashboard-proposal-section.tsx`, `dashboard-project-section.tsx`: `useSuspenseQuery`; the `isLoading` branches go.
- One `<Suspense>` plus `HydrationErrorBoundary` per module, **inside** `DashboardModule`, so the card chrome, title and "See all" render immediately and one failing query cannot blank the page. Section skeletons move to their own files first (one component per file) and become the fallbacks.
- `dashboard-meetings-calendar.tsx` stays `useQuery` + `keepPreviousData` (month paging; suspense has no `placeholderData`).

The server prefetch inputs are already quantized to the LA business day (`meeting-windows.ts`), so server and client keys match. Existing drift left as is: these modules call tRPC from `ui/components/`, which `frontend-stack.md#views-own-data-fetching` reserves for views.

### 6.3 The browser gets its session from the server

- `AbilityProvider` becomes presentational: it takes `user` (`{ id, role } | null`) and builds the ability. It no longer calls `useSession()`.
- The root `Providers` drop it.
- `DashboardSessionContent` (§5.3) wraps the page in `<AbilityProvider user={session.user}>`, and `GlobalDialogs` moves inside it: the modal store renders caller-supplied components (e.g. the customer profile modal, whose hero actions call `useAbility()`) at `GlobalDialogs`' position in the React tree, so it must sit under the provider. Its DOM position is irrelevant (dialogs portal to `<body>`). The no-cookie branch of the layout keeps its own `GlobalDialogs`.
- `proposal-flow/layout.tsx` already awaits its session; it wraps its tree the same way.
- A small client `SessionAbilityProvider` (calls `useSession()`, renders `AbilityProvider`) wraps the `(site)` layout (`catalog-refresh-button.tsx`, the navbar).
- Audit (import graph from each route group's `page`/`layout`/`template`, 2026-09-29): only `(site)`, `dashboard` and `proposal-flow` reach `useAbility()` / `<Can>`; `auth`, `dev`, `funnels`, `intake`, `test` reach none.
- A route group left without a provider fails closed: the context default denies everything.

Result: the dashboard home makes no `/api/auth/get-session` call at boot, and permission-gated UI is right on first render. Like the sidebar today, the seeded user is fixed for the document's lifetime; a role change needs a reload. Pages that call better-auth `useSession()` directly — `create-new-proposal-view.tsx`, `use-customer-note-action-configs.ts`, `site-navbar.tsx` and `popover-nav.tsx` (the meeting splash hook uses sessionStorage, not better-auth) — still trigger that call on their own pages, but nothing waits on it.

### 6.4 Ably lives with meeting-flow

`RealtimeProvider` moves from the root `Providers` to the meeting-flow view, its only consumer (`meeting-flow.tsx`, `use-meeting-sync.ts`). `realtime-client.ts` then loads, and its WebSocket connects, only on meeting pages. Verify in the build's client manifest that `ably` is absent from the `/dashboard` chunks.

### 6.5 Remove `next-pwa`

Dead dependency: never wired into `next.config.ts`. `pnpm remove next-pwa`.

## 7. Phase 3 — measure, then decide paid tiers

Facts checked 2026-09-29:
- **Vercel Pro** ($20/seat/mo): "scale to one" keeps at least one instance of the current production deployment warm if it was invoked in the last 14 days, plus pre-warming and precompiled function code. One instance: a fresh deploy and extra concurrent instances still boot cold. Hobby's terms also exclude commercial use.
- **Neon Launch** ($0.106/CU-hour, no minimum): scale-to-zero can be disabled; 0.25 CU always on ≈ $19/mo. Removes the wake in stage 2; code cannot.

Decision rule: Vercel Pro first if the Phase 2 measurements still show function boot as the largest cold cost; Neon Launch if the DB wake still separates cold from warm time-to-data.

## 8. Risks and verification

| Risk | Guard |
|---|---|
| Sidebar swap shifts the inset | Skeleton uses the same `<Sidebar>` primitive; checked in browser at desktop and mobile widths |
| Hydration mismatch from suspense modules | Keys already quantized; dev `[prefetch drift]` console error; browser check |
| A heavy SDK creeps back into boot | §5.2 lint rule |
| Ability-gated UI wrong on a route group without a provider | Fails closed (deny-all default); §6.3 audit |
| Meeting splash no longer first paint | Rendered on cookie presence, outside the Suspense slots; device check |
| Behaviour regressions from lazy SDKs | A side-effect-free smoke script calls each seam's first-use path (render + count a PDF, sharp on a `public/` image, TwiML + webhook signature, a locally signed R2 URL, Resend client construction + a rendered template element); an opt-in `--network` mode adds one Twilio GET for a non-existent call SID (expects a 404 `RestException`) and one Ably publish to a scratch channel. No emails, SMS, uploads or DB writes. Plus the proposal PDF route opened read-only in dev. |

Device checks after Phases 1 and 2 (owner, installed PWA): cold launch shows dark, then chrome and skeletons, then data; in-app navigation keeps the previous page until ready; the meeting splash is still the first paint on a meeting; sign-out shows the sign-in screen without sidebar or mobile nav.

## 9. Out of scope

- Service-worker app shell. Launch paint is already dark, and the 2026-08 attempt was reverted for jank.
- Next 16 + `cacheComponents` / PPR.
- DB driver swap; better-auth `cookieCache.maxAge` change.
- Prefetching the detail pages (`meetings/[meetingId]`, `projects/[projectId]`, `proposals/[proposalId]`, `settings`) and the other top-level session awaits (`proposal-flow/layout.tsx` beyond §6.3, `intake/page.tsx`). Follow-ups once the home path is done.

## 10. Docs touched and status

Docs edited in the same change as the code they describe (lines the change makes wrong; no new convention sections):
- `docs/codebase-conventions/app-shell.md` — `#dashboard-layout-shape-fixed` JSX block (§5.3 shape); `#stage-routes-opt-out-with-data-stage` (`motion.main` → `main`).
- `docs/codebase-conventions/frontend-stack.md#motion-not-framer` — page-level entrance fades are CSS.
- `src/trpc/DOCS.md#rsc-prefetch-uses-rsc-context` (§5.1).

When Phase 3 is recorded, this spec and its plan are deleted (git keeps them) and the owner decides whether to delete the remote research branch.

| Item | Status |
|---|---|
| Phase 0 — §4.1 baseline | ⬜ |
| Phase 0 — §4.2 boot profile | ✅ 2026-09-29 (§4.3) |
| Phase 1 — §5.1 session single read | ✅ 2026-09-29 |
| Phase 1 — §5.2 lazy SDKs + lint guard | ✅ 2026-09-29 (§4.3) |
| Phase 1 — §5.3 layout streams before session | ✅ 2026-09-30 (4b6c1845) |
| Phase 1 — measured | ⬜ — local target met within noise (A/B, §4.3); production measurement pending |
| Phase 2 — §6.1–§6.5 | ⬜ |
| Phase 2 — measured | ⬜ |
| Phase 3 — paid decision | ⬜ |

Measurements:

| When | `/dashboard` cold / warm TTFB (no cookie) | `/api/auth` cold | Signed-in cold / warm TTFB | Device cold / warm tap → data |
|---|---|---|---|---|
| 2026-09-29 baseline (curl from WSL, EU egress) | 4.40 s / 0.77 s | 2.11 s | — | — |
