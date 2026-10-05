# 09 — Ability per surface: how each server surface obtains the principal today, what the docs prescribe, and 3 candidate "once per route" designs

> **Scope.** Research + code trace for README §L4/§L5/§L6 ("compute the principal's ability ONCE per route; tRPC middlewares narrow, never rebuild; RSC/route helpers share the same builder; how does the ladder generalize to RSC + `route.ts` + jobs?"). Read-only; nothing here is implemented.
> **Baseline.** Worktree `.worktrees/issue-285` @ `b40403b6`. All `file:line` cites are relative to `src/` unless prefixed. Versions (package.json): `next 15.5.9`, `@trpc/server ^11.4.1`, `@trpc/tanstack-react-query ^11.4.1`, `better-auth ^1.6.9`, `@casl/ability ^6.8.0`, `react ^19`.
> **Doc sources (Context7).** tRPC `/trpc/trpc` (`www/docs/server/{context,middlewares,metadata,server-side-calls}.md`, `www/docs/client/nextjs/app-router/{setup,server-actions}.mdx`, `www/docs/client/tanstack-react-query/server-components.mdx`, `packages/server/skills/{auth,middlewares,server-setup}/SKILL.md`); Next.js `/vercel/next.js` (`docs/01-app/01-getting-started/06-fetching-data.mdx`, `03-api-reference/04-functions/{fetch,unstable_cache}.mdx`, `02-guides/upgrading/version-15.mdx`, `02-guides/migrating-to-cache-components.mdx`, `packages/next/src/server/route-modules/app-route/module.ts`); React `/reactjs/react.dev` (`reference/react/cache.md`); better-auth `/better-auth/better-auth` (`docs/content/docs/guides/optimizing-for-performance.mdx`, `concepts/session-management.mdx`, `reference/faq.mdx`, `packages/better-auth/src/api/routes/session.ts`).
> **Prior reports used as leads and re-verified in code:** `07-flow-catalog.md` Part 2 (rung table) + Part 3 (system contexts) + §1.7; `06-primitive-inventory.md` §3 (tRPC), §6 (Auth), S1, S2.

---

## A. Current state, per surface

### A.0 The memo seams that exist today (all React `cache()` — `grep "= cache("`)

| Seam | `file:line` | Keyed on | What it memoizes | Who hits it |
|---|---|---|---|---|
| `getCachedSession` | `shared/domains/auth/lib/get-cached-session.ts:19-21` | zero args | `auth.api.getSession({ headers: await headers() })` | `dashboard/layout.tsx:14`, `protect-dashboard-page.ts:27` |
| `createHTTPTRPCContext` | `trpc/lib/create-http-context.ts:12-27` | **argument identity** (`{ req?, resHeaders }` — a fresh literal at every call site) | `auth.api.getSession({ headers: await getHeaders() })` (`:13-17`) → root ctx `{ session, ability: null, scope: null, actor: null, req, resHeaders }` (`:19-26`) | `app/api/trpc/[trpc]/route.ts:12` (HTTP), `createRSCTRPCContext` (RSC) |
| `createRSCTRPCContext` | `create-http-context.ts:37-38` | zero args | `createHTTPTRPCContext({ resHeaders: new Headers() })` | `trpc/server.ts:10` (options proxy `ctx`) |
| `getQueryClient` | `trpc/server.ts:8` | zero args | `makeQueryClient()` | `prefetch.ts:20`, `hydrate-client.tsx:18` |

Two facts about these seams that matter for the design:
1. **The RSC guard and the RSC tRPC context are two independent memos** of the same `auth.api.getSession` call. `get-cached-session.ts:10-12` says so explicitly ("a separate memo … consolidating the two is a possible follow-up"). A page that prefetches therefore resolves the session twice per render (each hit is a cookie-cache verification, not a DB round-trip — see B.3).
2. **`createHTTPTRPCContext`'s `cache()` is inert on the HTTP path.** React only serves the cache from inside a component render (React `cache.md` "Calling a memoized function outside of a component will not use the cache"); a Route Handler is outside the tree (Next `fetch.mdx` "Memoization does not apply inside Route Handlers"). It is also argument-keyed on a fresh object. It does not matter in practice because tRPC calls `createContext` **once per HTTP request** and shares it across the batch (tRPC `context.md` "Creating the context") — so the HTTP path is already one session lookup per batch.

`src/middleware.ts:5-22` is a subdomain rewrite only; it never reads the session (matcher excludes `/api`, `:30`).

### A.1 S1 — tRPC procedures

**Root context (HTTP).** `app/api/trpc/[trpc]/route.ts:5-16` → `fetchRequestHandler({ createContext: () => createHTTPTRPCContext({ req, resHeaders }) })`. Session resolved once per HTTP request; `ability`, `scope`, `actor` start `null` (`create-http-context.ts:21-23`).

**Ladder (`trpc/init.ts`).**

| Rung | Lines | Builds | Narrows / gates |
|---|---|---|---|
| `baseProcedure` (= `systemProcedure`, `:39`) | `:29` | — | none; ctx = `HTTPTRPCContext` (`trpc/types.ts:60-63`, all nullable) |
| `protectedProcedure` | `:46-62` | **`defineAbilitiesFor({ id, role })` `:54-57`** + `userActor` `:60` | `!ctx.session` → UNAUTHORIZED `:47-52`; `next({ ctx: { …ctx, session, ability, scope: null, actor } })` `:60` |
| `agentProcedure` | `:72-81` | — | `ability.cannot('access','Dashboard')` → FORBIDDEN `:73`; `next({ ctx })` `:80` |
| `superAdminProcedure` | `:94-103` | — | `ability.cannot('manage','all')` → FORBIDDEN `:95` |

**Where the ability is (re)built on S1 today** (every site is `defineAbilitiesFor`):
- `init.ts:54` — once **per procedure call** (the middleware runs per batched call, per tRPC batching semantics), not once per request.
- `trpc/lib/middleware/shareable-middleware.ts:40-43` — the session branch of every shareable procedure rebuilds it from scratch because `shareableMiddleware` chains off `baseProcedure` (`proposals.router/procedures.ts:45`, `create-crud-router.ts:101`), never off `protectedProcedure`. It also re-derives omni (`:44`) and the legacy scope (`:45`).
- Per-entity `procedures.ts` do not rebuild the ability, but each rebuilds the **actor** and recompiles the scope per call: `resolveTrpcActorScope(spec, { userId: ctx.session.user.id, ability: ctx.ability })` → `userActor(...)` (`resolve-trpc-actor-scope.ts:22`) at `customers.router/procedures.ts:27`, `meetings.router/procedures.ts:21`, `proposals.router/procedures.ts:29,40`, `projects.router/procedures.ts:18,33`; legacy `resolveVisibilityScope` at `applications.router/procedures.ts:21` and as the factory default `create-crud-router.ts:98-100`.
- Handler-level rebuilds inside S1: `meeting-flow.router.ts:46` (`userActor` again), `:52` (hand-built ctx literal), `:71` + `projects.router/business.router.ts:67` (`buildUserContext(...)` → `helpers.ts:65-78`, which rebuilds the ability at `:70` from `session.user.role` and fabricates a session at `:73`).

**Token (shareable) path on S1.** `shareable-middleware.ts:53-68`: no session → `getRawInput()` peek for `token` (`:59-60`, pre-Zod) → `scope = eq(tokenColumn, token)`, `ability: null`, `actor: tokenActor(...)`. No DB validation here (`validateShareToken` is bypassed on this path; it is only used by `resolveShareTokenActor`, `share-token-actor.ts:25`). `systemProcedure` `recordView` (`proposals.router/views.router.ts:36-50`) does the validated variant by hand: `resolveShareTokenActor(input.token,'proposal')` `:41` then a ctx literal `{ session: null, ability: null, scope: resolveActorScope(...), actor }` `:50`.

**`createCallerFactory`** is exported (`init.ts:28`) and has **zero consumers** (grep `createCaller(` / `createCallerFactory(` outside `init.ts`: none). Server-side calls go exclusively through the options proxy (A.2).

### A.2 S2 — React Server Components (pages, layouts, guards, RSC tRPC caller)

**RSC tRPC caller.** `trpc/server.ts:9-13`: `createTRPCOptionsProxy({ ctx: createRSCTRPCContext, router: appRouter, queryClient: getQueryClient })`. `prefetch()` (`trpc/lib/prefetch.ts:37-39` → `executePrefetch :18-25`) is fire-and-forget `queryClient.prefetchQuery(queryOptions)`; each prefetch invokes the procedure **through its full middleware chain** with the cached RSC ctx (DOCS.md `rsc-prefetch-uses-rsc-context` `trpc/DOCS.md:317-325` confirms: a ctx without headers makes every `agentProcedure` prefetch throw UNAUTHORIZED, i.e. the ladder runs). So **every `prefetch(...)` is one more `defineAbilitiesFor` at `init.ts:54`**. `HydrateClient` (`trpc/components/hydrate-client.tsx:17-33`) dehydrates the same request-scoped client.

**Guard.** `shared/domains/permissions/lib/protect-dashboard-page.ts:26-49`: `getCachedSession()` `:27` → `defineAbilitiesFor` `:36-39` → `cannot('access','Dashboard')` → `redirect('/')` `:41-43` → returns `{ status:'authenticated', session, ability }` `:48`. Called by **16 pages** (`app/(frontend)/dashboard/{page, analytics, campaigns, customers, lead-sources, meetings, pipeline/[pipeline], projects, projects/new, projects/[projectId], proposals, proposals/new, proposals/[proposalId], schedule, settings, team}/page.tsx`). Nine of them discard the return value (`await protectDashboardPage()` with no binding — e.g. `pipeline/[pipeline]/page.tsx:7`); two re-gate on it (`lead-sources/page.tsx:13`, `campaigns/page.tsx:23` — `ability.cannot('manage','all')` → redirect); the prefetching pages branch on `authState.status` before prefetching (`customers/page.tsx:23-26`, `dashboard/page.tsx:17-24`, `meetings/page.tsx:23-26`, `proposals`, `projects`, `schedule:17-18`, `campaigns:29-35`).

**Layout.** `app/(frontend)/dashboard/layout.tsx:14` — `getCachedSession()` (same memo as the guard → one lookup for layout+page); passes `session.user` to the client `AppSidebar` `:24`, which rebuilds the ability on the client (`features/agent-dashboard/ui/components/app-sidebar.tsx:73-76`).

**Pages/layouts that read the session directly (not via the guard):**
- `app/(frontend)/intake/page.tsx:22-23` — `auth.api.getSession({ headers: await headers() })`, uncached, only on the bare-URL branch; the real gate is the lead-source `token` compare `:40`.
- `app/(frontend)/proposal-flow/layout.tsx:17-18` — uncached `auth.api.getSession`, reduced to a boolean for the splash screen `:19`. The proposal page itself (`proposal-flow/proposal/[proposalId]/page.tsx:18-25`) does **no** server-side auth; the share token is read client-side and sent as tRPC `input.token` (A.1 token path).
- `app/(frontend)/funnels/layout.tsx:15` reads `headers()` for the host only — not a session read.
- `shared/domains/auth/lib/utils.ts:3-23` (`requireAuth` / `requireUnauth`) — two more `auth.api.getSession` helpers; no callers under `src/app` (grep), retained utility.

**Client provider chain** (the "client provider" leg of the count): `app/(frontend)/layout.tsx:144` → `shared/components/providers/index.tsx:13-31` → `AbilityProvider` (`casl-provider.tsx:19-37`): `useSession()` `:20` → `defineAbilitiesFor(userId ? { id, role } : null)` memoized on `[userId, userRole]` `:27-30`. `useAbility()` (`permissions/hooks.ts:16`) has 27 consumer sites; `AbilityContext` defaults to a deny-all `createMongoAbility()` (`permissions/context.ts:13`).

### A.3 S3 — `route.ts` handlers (all 15 under `src/app/api`)

| # | Route | Authenticates how | Principal / ctx used | Notes |
|---|---|---|---|---|
| 1 | `api/auth/[...all]/route.ts:4` | better-auth owns it (`toNextJsHandler(auth)`) | — | serves `/api/auth/get-session` that the client `useSession` hits |
| 2 | `api/dev/playwright-session/route.ts:64-152` | 3 guards: `VERCEL_ENV !== 'production'` `:69`, `!isProductionHost` `:71`, timing-safe `?secret=` vs `DEV_LOGIN_SECRET` `:73-75` (404 on any failure) | none — mints a real session via `auth.$context.internalAdapter` `:77-126` | dev-only |
| 3 | `api/google-calendar/webhook/route.ts:11-33` | **none** (only `X-Goog-Channel-ID` presence `:13,22`) | none → `schedulingService.handleWebhookNotification(channelId)` `:26` (raw DAL underneath) | always 200 |
| 4 | `api/proposals/[proposalId]/pdf/route.ts:10-55` | `?token=` `:15` → `resolveShareTokenActor(token,'proposal')` `:21` (DB-validated via `validateShareToken`) | hand-built ctx literal `{ session:null, ability:null, scope: resolveActorScope(proposalServerSpec, actor), actor }` `:26-29` for the read; then **`SYSTEM_CONTEXT`** for `pdfService.generateProposalPdf` `:36` | token-scoped read, system-privileged render |
| 5 | `api/proposals/[proposalId]/summary/route.ts:13-135` | same token pattern `:18-25` | same ctx literal `:30-33` | no SYSTEM_CONTEXT |
| 6 | `api/qstash-jobs/route.ts:87-137` | QStash `Receiver.verify({ signature, body })` `:93,105-121` | none at the route; each job picks its own (A.4) | `maxDuration = 60` `:27` |
| 7 | `api/quickbooks/callback/route.ts:8-61` | **none** (any caller with `code`+`realmId` triggers the token exchange `:25-36` and `upsertTokens` `:49`) | none | OAuth callback |
| 8 | `api/trpc/[trpc]/route.ts:5-28` | S1 (`createHTTPTRPCContext`) | S1 | — |
| 9–11 | `api/voip/routing/{caller-lookup,compliance-check,transfer-target}/route.ts` | **none** (Phase-0 mocks; JSON-shape check only) | none; no DB | scaffolding |
| 12 | `api/webhooks/bina/route.ts:12-58` | header secret `gohighlevelClient.verifyWebhookSecret({ authHeader })` `:14-17` | **`SYSTEM_CONTEXT`** `:35` → `customerIntakeService.ingestLead` | audit log `:51-55` |
| 13 | `api/webhooks/cloudtalk/route.ts:31-132` | `?secret=` `cloudtalkClient.verifyWebhookSecret({ url })` `:34` | **`SYSTEM_CONTEXT`** `:62,96` → `campaignEnrollmentService.unenroll`; ctx-less services otherwise | 200 even on handler throw `:124-129` |
| 14 | `api/webhooks/quickbooks/route.ts:29-61` | HMAC-SHA256 `intuit-signature` `:22-27,31-39` | none — dispatches `syncQbPaymentJob`/`syncQbInvoiceJob` `:50,53` | — |
| 15 | `api/webhooks/zoho-sign/route.ts:15-56` | HMAC when header+secret present `:20-24`; **missing header accepted outside production** `:25-31` | none — dispatches `syncZohoSignStatusJob` `:49-53` | — |

Net for S3: exactly **two** handlers build a principal (#4, #5), both by hand from `?token=`, and neither touches `defineAbilitiesFor` (token bearer = `ability: null`). No route handler reads the better-auth session. None uses `createCallerFactory`.

### A.4 S4 — non-request callers (jobs, webhooks, scripts, services)

- **Job plumbing.** `shared/services/providers/upstash/lib/create-job.ts:11-64` — `createJob(key, handler)`; `JobHandler = (payload) => Promise<void>` (`types.ts:16`). **No context parameter exists**; 21 jobs are registered at `api/qstash-jobs/route.ts:32-54`.
- **Jobs that construct a context** (7, all bare `SYSTEM_CONTEXT` import at `:1`): `bulk-dnc.ts:21`, `bulk-enroll.ts:26`, `bulk-unenroll.ts:21`, `enroll-lead.ts:28`, `enroll-source-batch.ts:47`, `graduate-from-campaign.ts:20`, `sync-zoho-sign-status.ts:41`. The other 14 call ctx-less services (e.g. `sync-meeting-to-gcal.ts:19` → `schedulingService.syncMeeting(meetingId)`), which reach raw DAL (07 §1.7 P6-1c…1j).
- **Definitions.** `shared/dal/server/types.ts:53-58` `SYSTEM_CONTEXT = { session:null, ability:null, scope:null, actor: systemActor('legacy:system-context') }`; `systemContext(reason)` `:68-70` (1 caller, `proposals.router/contracts.router.ts:224`); `SystemReason` has 2 variants (`permissions/scope/system-reasons.ts:8-15`). Bare `SYSTEM_CONTEXT` call sites: 33 (30 in `src/`, 3 in `scripts/`) per 07 Part 3; the string appears in 36 files including definitions/comments.
- **Webhooks**: A.3 rows 3, 12–15.
- **Scripts**: 21 scripts import DAL/services/entities. 3 build a context — `scripts/verify-generate-sow-pdf.ts:4,11`, `verify-long-path.ts:15,33`, `verify-short-path.ts:13,63` (all `SYSTEM_CONTEXT`). The rest use raw `db.*` (`add-during-media.ts:34,62`, `backfill-wave3-scalars.ts:26,60,64`, `portfolio-scraper/import-project.ts:268,274,319`) or ctx-less services (`rebuild-gcal-descriptions.ts:100`, `backfill-proposal-media-optimization.ts:63`).
- **Services**: `accounting.service.ts:80,170,224,247` (`SYSTEM_CONTEXT` for QB jobs), `zoho-sign/lib/documents/registry.ts:154`, `voip-{calls,dids}.service.ts:231/:117`; `customer-intake.service.ts:112-113` documents the "ctx is SYSTEM_CONTEXT → authorId stays null" contract.
- **`buildUserContext`** (`shared/dal/server/lib/helpers.ts:65-78`) is the only "act as a user outside tRPC" builder; it fabricates a session (`:73`) and uses the legacy scope engine (`:75`). 2 callers, both inside tRPC handlers (A.1).

### A.5 Build count on a real dashboard page load

**Trace: `/dashboard/pipeline/fresh`** (`app/(frontend)/dashboard/pipeline/[pipeline]/page.tsx`, no prefetch):

| # | Step | Session lookup | `defineAbilitiesFor` |
|---|---|---|---|
| 1 | `dashboard/layout.tsx:14` `getCachedSession()` | **#1** (memo A, cookie-cache fast path) | — |
| 2 | `pipeline/[pipeline]/page.tsx:7` `protectDashboardPage()` → `get-cached-session.ts:19` (memo A hit) → `protect-dashboard-page.ts:36` | (hit) | **build #1** (result discarded by the page) |
| 3 | SSR pass of client tree: `AbilityProvider` `casl-provider.tsx:27` with `useSession()` empty → `defineAbilitiesFor(null)`; `AppSidebar` `app-sidebar.tsx:74` from the `user` prop | — | **build #2**, **build #3** |
| 4 | Client hydration: `AbilityProvider` renders again with `useSession()` pending → `defineAbilitiesFor(null)`; better-auth client then fetches `GET /api/auth/get-session` (row 1 of A.3) → user resolves → memo recomputes | **#2** (auth route, separate request) | **build #4**, **build #5** |
| 5 | Client hydration: `AppSidebar` memo `app-sidebar.tsx:73-76` | — | **build #6** |
| 6 | `CustomerPipelineView` `customer-pipeline-view.tsx:47-50` `useQuery(getCustomerPipelineItems)` → HTTP `/api/trpc` → `create-http-context.ts:15` → `agentProcedure` (`customer-pipelines.router.ts:27`) | **#3** | **build #7** (`init.ts:54`); +1 per additional procedure in the same batch |

So the page renders with **1 server-side build in the RSC pass, 2 more in the SSR pass of client components, 3 on the client, and 1 per tRPC procedure afterwards** — 7 builds and 3 session resolutions before the first board paints, none of them shared. (Rows 3–4 follow from `useSession` being a client store with no server data on the first pass; the exact null→user sequence is inferred from `casl-provider.tsx:20-30`, not instrumented.)

**Prefetching pages** add one build per `prefetch(...)` inside the RSC pass, on top of the guard's: `customers/page.tsx:25` → 1+1 = **2**; `meetings:25`, `projects:25`, `proposals:25` → 2 each; `schedule:17-18` → 3; `campaigns:33-34` → 3; `dashboard/page.tsx:18-23` → **7 builds in one RSC render** (1 guard + 6 prefetches). These pages also resolve the session through **two** memos (A.0 fact 1): `getCachedSession` and `createRSCTRPCContext`.

Cost per build: `defineAbilitiesFor` (`abilities.ts:80-`) constructs a fresh `AbilityBuilder`, re-runs the role switch, and calls `buildScopeConditionsMatcher()` on every invocation (`abilities.ts:88,277` — no memo; 06 E29). Not a DB hit, but not free, and — more importantly for L4 — every build is an independent object, so no two surfaces can ever reason about the same ability instance.

### A.6 Who reads what off the context (for the DAL-shape question in §C)

`grep ctx.session src/shared` — DAL/entity/service sites (all `.user.id` reads, none `.user.role`):

| Site | Reads | Purpose |
|---|---|---|
| `entities/proposals/lib/server-spec.ts:119` | `ctx.session!.user.id` | duplicate override → `ownerId` stamp |
| `entities/meetings/dal/server/crud.ts:34` | `!ctx.session` | "is SYSTEM_CONTEXT" test (pass input through) |
| `entities/meetings/lib/resolve-owner.ts:14-15` | `ctx.ability?.can('own','Meeting')` then `ctx.session!.user.id` | server-authoritative `ownerId` on create |
| `entities/meetings/dal/server/crud.ts:125` | `ctx.session?.user.id` | `excludeUserId` for the time-changed notification |
| `entities/meetings/dal/server/crud.ts:185` | `ctx.session?.user.id ?? source.ownerId` | duplicate override `ownerId` |
| `entities/customer-notes/lib/server-spec.ts:61` | `ctx.session?.user.id` | `authorId` stamp (null for system) |
| `entities/customer-notes/lib/assert-note-author.ts:8-9` | `ctx.session?.user.id`, `ctx.ability?.can('manage','all')` | author-or-admin check |
| `dal/server/lib/scope.ts:68,74` | `!ctx.session`, `ctx.session.user.id` | legacy `isVisible` (system test + scope) |
| `services/notification.service.ts:210,269` | comments only | — |

Router-level identity reads: 49 `ctx.session.user.id` in `src/trpc` (e.g. `agent-settings.router.ts:19,46,57`, `push.router.ts:38,53,66`, `voip-campaigns.router.ts:168,216,229,241` `requestedByUserId`, `projects.router/business.router.ts:52` `ownerId`, `meetings.router/participants.router.ts:39,114,194`, `dashboard.router.ts:8`), 4 `session.user.role` reads (`init.ts:56`, `shareable-middleware.ts:42`, `meeting-flow.router.ts:71`, `projects.router/business.router.ts:69` — the last two only to feed `buildUserContext`), and 2 `session.user.{email,name}` reads (`proposals.router/delivery.router.ts:48-49`).

`ctx.actor` reads outside the compiler: `canSeeUngatedPhone(actor)` (`entities/customers/lib/phone-gating-sql.ts:42-46` — needs only `ability`), `actor.ability.can('read','Proposal')` (`features/customer-pipelines/dal/server/get-customer-pipeline-items.ts:48`, `get-customer-profile.ts:36`), `canAccess(spec, ctx.actor, id)` (`entities/customer-notes/lib/server-spec.ts:58`). Inside the compiler the one identity read is `ctx.actor.userId` at `permissions/scope/operators/meeting-participation.ts:38` (`OperatorCtx.actor`, `operators.ts:12`); note `abilities.ts:149` already bakes `user.id` into a rule condition (`can('read','Project',{ ownerId: user.id })`), so the compiler can be made identity-free by baking `userId` into the `$participatesViaMeeting` value the same way (README §L6-b).

---

## B. Documented patterns

### B.1 tRPC v11

| Pattern | What the docs say | Source |
|---|---|---|
| `createContext` per request | "`createContext()` is called **once per request**, so all procedures within a single batched request share the same context." | `www/docs/server/context.md` "Creating the context" |
| Inner / outer context | Split into `createContextInner({ session })` (no `req`/`res`; "useful for testing … and server-side calls where we don't have req/res") and `createContext(opts)` that resolves the session from the request and spreads `req`/`res` on top. `type Context = Awaited<ReturnType<typeof createContextInner>>`. | `context.md` "Inner and outer context"; `packages/server/skills/server-setup/SKILL.md` |
| `createCallerFactory` | `const createCaller = t.createCallerFactory(appRouter); const caller = createCaller(ctx)` — server-side calls "without HTTP overhead"; the ctx is supplied by the caller (`caller = createCaller(await createContext())`). Middlewares run. | `www/docs/server/server-side-calls.md`; `context.md` "Create Context for Server-side Calls" |
| Middleware narrowing | `t.procedure.use(async ({ ctx, next }) => { if (!ctx.user) throw UNAUTHORIZED; return next({ ctx: { user: ctx.user } }) })` — "narrows to non-null"; plain `next()` "leaves user still nullable downstream" (marked **Wrong**). Chained procedures (`authedProcedure` → `adminProcedure`) accumulate narrowing. | `www/docs/server/middlewares.md` "Context Extension"; `packages/server/skills/auth/SKILL.md` "Correctly Narrow User Type"; `skills/middlewares/SKILL.md` |
| `.meta()` declarative auth | `initTRPC.context<Context>().meta<Meta>().create()`; a middleware reads `opts.meta` (`if (meta?.authRequired && !ctx.user) throw`) and each procedure declares `.meta({ authRequired: true })`. The docs example calls `next()` (no ctx narrowing) — meta decides *whether* to check, it does not change the ctx type. | `www/docs/server/metadata.md` "Example with per route authentication settings" |
| RSC caller (options proxy) | `createTRPCOptionsProxy({ ctx: async () => createTRPCContext({ headers: await headers() }), router, queryClient: cache(makeQueryClient) })` with `'server-only'`; `prefetch()` = `void queryClient.prefetchQuery(...)`; `HydrateClient` = `HydrationBoundary` over `dehydrate(getQueryClient())`. The docs' `ctx` is **not** `cache()`'d (the repo's is). | `www/docs/client/nextjs/app-router/setup.mdx`; `www/docs/client/tanstack-react-query/server-components.mdx`; `packages/next/skills/nextjs-app-router/SKILL.md` |
| `experimental_caller` | `t.procedure.experimental_caller(experimental_nextAppDirCaller({ pathExtractor }))` turns a procedure into a callable server action. "Since the `experimental_nextAppDirCaller` adapter **doesn't use `createContext`**, a middleware is used to retrieve the current user and add it to the procedure's context" (`.use(async opts => next({ ctx: { user: await currentUser() } }))`). Experimental; server-actions only. | `www/docs/client/nextjs/app-router/server-actions.mdx`; blog `2024-05-23-trpc-actions.mdx` |
| Batching | `httpBatchLink` folds parallel calls into one HTTP request (`/api/trpc/a,b?batch=1`); one `createContext`, N middleware chains. | `packages/client/skills/links/references/link-options.md`; `www/docs/further/rpc.md` |

Read-across to the repo: the ladder already follows the documented narrowing form (`init.ts:60` returns `next({ ctx: { …, session: ctx.session, ability, … } })`), but it **builds** inside the narrowing middleware, which the docs never do (their examples derive `user` in `createContext`/inner context and only narrow in middleware). The repo's `createRSCTRPCContext` improves on the docs by caching the ctx function, which is what keeps RSC prefetches on one session lookup.

### B.2 Next.js 15 (+ React 19 `cache`)

| Fact | Source |
|---|---|
| `React.cache` "enable[s] request-level memoization. Multiple components calling the memoized function with identical arguments during the same render pass will share a single result … strictly scoped to the current request lifecycle." | `docs/01-app/01-getting-started/06-fetching-data.mdx` "Reusing data with React.cache" |
| Memoization "does **not** apply inside Route Handlers since they are outside the React component tree." (stated for `fetch`; React's own rule below makes it true for `cache()` too) | `docs/01-app/03-api-reference/04-functions/fetch.mdx` "Memoization" |
| `cache` "is for use in Server Components only"; "Calling a memoized function **outside of a component will not use the cache** … cache access is provided through a context which is only accessible from a component"; "React will invalidate the cache for all memoized functions for each server request"; "Each call to `cache` creates a new function … different memoized functions that do not share the same cache"; errors are cached too. | `react.dev` `reference/react/cache.md` Caveats + Pitfalls |
| So: **a `route.ts` handler and an RSC render never share a request scope**; a `cache()`'d helper called from a route handler simply runs uncached every call. Within one RSC render, layout + page + every `prefetch` share the scope. | (derived from the two rows above) |
| `headers()` / `cookies()` are async in 15 (`const h = await headers()`); usable in both Server Components and Route Handlers. | `docs/01-app/02-guides/upgrading/version-15.mdx` |
| `unstable_cache`: "Request data such as headers or cookies must be read outside the cached function and passed as parameters" — it is a cross-request data cache, keyed by args, and cannot wrap a session lookup. `'use cache'` in a Route Handler throws if `headers()`/`cookies()` are read inside (`trackDynamic`). | `docs/01-app/03-api-reference/04-functions/unstable_cache.mdx`; `packages/next/src/server/route-modules/app-route/module.ts` |
| Cache Components (not enabled in this repo): each Cache Function gets an isolated `React.cache` scope; request-data helpers that must dedupe across those scopes use `'use cache: private'`. Irrelevant until `cacheComponents` is adopted; noted so a future migration doesn't silently break a `cache()`'d principal. | `docs/01-app/02-guides/migrating-to-cache-components.mdx` "React.cache" |

### B.3 better-auth

| Fact | Source |
|---|---|
| Server session retrieval is `auth.api.getSession({ headers: await headers() })` — the exact call at `create-http-context.ts:15`, `get-cached-session.ts:20`, `intake/page.tsx:23`, `proposal-flow/layout.tsx:18`, `auth/lib/utils.ts:4,16`. | `docs/content/docs/guides/next-auth-migration-guide.mdx` |
| Cookie cache: `session.cookieCache: { enabled: true, maxAge }` stores the session in "a short-lived, signed cookie similar to how JWT access tokens function" so repeated checks skip the DB. Repo: `maxAge: 300` (`shared/domains/auth/server.ts:94-98`). | `guides/optimizing-for-performance.mdx` "Cookie Cache" |
| Cost model (source): with a valid `session_data` cookie the endpoint returns "directly from the cookie without any database call — no I/O, just HMAC/JWT/JWE verification"; on miss/expiry/version-mismatch/`disableCookieCache` it falls through to `internalAdapter.findSession(token)` (DB). `refreshCache` auto-refreshes at 80 % of `maxAge`. | `packages/better-auth/src/api/routes/session.ts`; `concepts/session-management.mdx` |
| Guidance: "avoid `useSession` in root layout files; prefer fetching session data in server components via `auth.api.getSession`." The repo's `AbilityProvider` sits in the root providers (`providers/index.tsx:15`) and calls `useSession` (`casl-provider.tsx:20`) — the client's ability currently comes from a second, client-initiated `/api/auth/get-session` round-trip rather than from the RSC-resolved session. | `reference/faq.mdx` "Difference between getSession and useSession" |

Implication for "cost": repeated `auth.api.getSession` calls within the 5-minute window are signature checks, not DB hits, so the duplication in A.0/A.5 is mostly CPU + code-path duplication rather than latency — but the docs still model it as one call per request, and a cookie-cache **miss** (first request after login, after 5 min, or after `disableCookieCache`) turns every uncached duplicate into a DB query.

---

## C. Design options — "ability computed once per route" across S1–S4

Common ground for all three options (from §A/§B, and README §L1–L3):
- Identity inputs that cannot be derived: the session (cookie), a share token (input body / `?token=` / page param), or a system reason. Everything else (`ability`, the Drizzle WHERE) derives from those (06 S1).
- With `Actor` dropped (L1), the compiler needs the acting `userId` only for `$participatesViaMeeting` (`meeting-participation.ts:38`); baking it into the condition at build time (as `abilities.ts:149` already does for `ownerId`) makes the ability self-describing. Every option below assumes that (otherwise the DAL ctx must carry `userId` for scope compilation too, not just for stamping).
- Data stamping (`authorId`/`ownerId`/`excludeUserId`, A.6) needs the user id **independently of the ability** — a CASL ability carries no identity. So every DAL ctx shape needs an identity slot next to `ability`.
- S4 has no session; it needs a `manage all` ability plus an audit reason (L6-a). CASL rules accept a `reason` string (`AbilityBuilder.can(...).because(reason)`; surfaced via `ForbiddenError`) — a candidate home for the reason without a wrapper type; verify against `@casl/ability@6.8.0` before relying on it.

### C.1 Option (i) — one `getRequestPrincipal()` builder, shared by all request surfaces; tRPC middlewares only narrow

**Shape.**
```ts
// shared/domains/permissions/server/request-principal.ts  ('server-only')
export const getRequestPrincipal = cache(async (): Promise<Principal> => {
  const session = await auth.api.getSession({ headers: await headers() })   // the ONE lookup
  return { session, ability: defineAbilitiesFor(session?.user ?? null) }    // the ONE build (anonymous = empty ability)
})
```
- **Where built:** one module. `createHTTPTRPCContext` becomes `{ ...(await getRequestPrincipal()), req, resHeaders }`; `protectDashboardPage` becomes `const { session, ability } = await getRequestPrincipal()` + the redirect gate; route handlers call it directly. `getCachedSession` and `createRSCTRPCContext` collapse into it (A.0 fact 1 disappears). `init.ts:54-57` and `shareable-middleware.ts:40-43` stop calling `defineAbilitiesFor`.
- **Builds per request:** RSC render = **1** (layout, guard, every `prefetch`, and the SSR pass all read the same memo — the client `AbilityProvider` can be fed the RSC ability's rules instead of rebuilding, see below); tRPC HTTP = **1** per HTTP request/batch (via `createContext`; the `cache()` is inert there, which is fine because `createContext` already runs once — B.1 row 1, B.2 row 3); `route.ts` = **1** per handler invocation. The A.5 trace goes from 7 builds / 3 session lookups to 1 build / 1 lookup on the server, plus whatever the client does.
- **Shareable / token:** a single `bearerAbility(spec, rowId)` builder (L3) used by all three token entry forms — tRPC: `shareable(spec)` middleware = `ctx.session ? next({ ctx })` (reuse) `: validateShareToken(await getRawInput().token) → next({ ctx: { ...ctx, ability: bearerAbility(...) } })` (still one build on the token path; today's `eq(tokenColumn, token)` unvalidated branch at `shareable-middleware.ts:61-67` is replaced by the validated path `share-token-actor.ts:25`); `route.ts`: `?token=` → same builder (replaces the ctx literals at `pdf/route.ts:26-29`, `summary/route.ts:30-33`); RSC: `searchParams.token` → same builder if a page ever needs server-side token auth (none does today — A.2). The bearer ability is row-conditioned CASL (`can('read','Proposal',{ id: rowId })` + field limits), so the same Drizzle adapter compiles it; `ability == null` stops being the token discriminator (`contracts.router.ts:191`) — `ctx.session == null` is (L2).
- **S4:** `systemAbility(reason)` → `{ session: null, ability: <manage all, reason-tagged> }`; jobs/webhooks/scripts construct it explicitly at the boundary (replacing the 33 bare `SYSTEM_CONTEXT` sites and `systemContext(reason)`); `createJob` could accept/inject it so job handlers stop importing a global. `buildUserContext` (`helpers.ts:65-78`) is deleted — an in-handler cross-entity call reuses `ctx`.
- **tRPC ctx type per rung** (narrowing only, matching B.1 row 4):

  | Rung | ctx |
  |---|---|
  | `baseProcedure` | `{ session: BetterAuthSession \| null, ability: AppAbility, req?: Request, resHeaders: Headers }` — `ability` always present (anonymous = empty, same idea as `context.ts:13`'s default) so public procedures can `can()` uniformly |
  | `protectedProcedure` | `& { session: BetterAuthSession }` (asserts, never builds) |
  | `agentProcedure` / `superAdminProcedure` | same type; runtime gate only (`can('access','Dashboard')` / `can('manage','all')`) — a branded `AgentSession` type is possible but YAGNI |
  | `<entity>ShareableProcedure` | `{ session: BetterAuthSession \| null, ability: AppAbility }` — bearer or user; handlers that must distinguish test `ctx.session` |

  Per-entity scope-stamping procedures and `ctx.scope` go away (L5): the DAL compiles the WHERE from `ctx.ability` on demand (the adapter's job — report 11).
- **DAL ctx type:** `{ ability: AppAbility, userId: string | null, tx?: Tx }` covers every A.6 site (all are `.user.id`, plus the "is system" tests become `userId === null` or an ability/reason check). `{ ability, session: BetterAuthSession | null, tx? }` is the alternative: it keeps `delivery.router.ts:48-49`-style email/name reads possible at the DAL layer (none exist there today) at the cost of coupling every DAL signature to the better-auth session type (`dal/server/types.ts:13` already does). Both are viable; the minimal one matches the observed reads exactly.
- **Client:** `AbilityProvider` can take `packRules(ability.rules)` from the RSC (`protectDashboardPage` already returns the ability; the dashboard layout could pass rules to the provider) and `unpackRules` on the client — one build, same rules ("client receives the same rules", L4), and it removes the root-layout `useSession` dependency that better-auth's FAQ discourages (B.3). Report 12's scope; noted as the natural continuation.
- **Trade-offs:** (+) exactly one builder and one memo, directly on the documented seams (tRPC `createContext` once-per-request; React `cache` once-per-render); (+) middlewares become pure narrowing, as the docs write them; (+) route handlers and RSC guards share code paths with tRPC instead of hand-built literals (A.3 rows 4–5). (−) `headers()` inside the builder ties it to a Next request scope — tests/scripts need the `systemAbility` path or an explicit `{ headers }` override parameter; (−) `cache()` gives nothing in `route.ts`, so a handler that needs the principal twice must pass it down (a discipline, not a mechanism); (−) the anonymous-but-non-null `ability` on `baseProcedure` is a behavioral change for the handful of `ctx.ability` null-checks (`create-crud-router.ts:118,147`, `contracts.router.ts:191`, `assert-note-author.ts:9`, `resolve-owner.ts:14`).

### C.2 Option (ii) — tRPC-only context, separate RSC/route helpers (formalize today's split)

**Shape.** Move the ability build from `protectedProcedure` into `createHTTPTRPCContext` (`{ session, ability }` in the root ctx, per the docs' inner-context pattern, B.1 row 2); keep `getCachedSession` + `protectDashboardPage` as the RSC pair; give `route.ts` a small `getRouteSession(req)` helper; keep `createRSCTRPCContext` as its own memo.
- **Where built:** two builders — `createHTTPTRPCContext` (S1 + RSC prefetch) and `protectDashboardPage` (RSC guard); route handlers use whichever they import.
- **Builds per request:** tRPC HTTP = 1 per batch (down from N); RSC page with prefetch = **2** (guard + RSC tRPC ctx, on two separate session memos) unless `createRSCTRPCContext` is rewritten to call `getCachedSession` — at which point it is Option (i) with two names; RSC page without prefetch = 1; `route.ts` = 1.
- **Shareable / token:** as in (i) for tRPC; route handlers keep their own token → ability code unless they import the shared bearer builder.
- **S4:** as in (i).
- **tRPC ctx type per rung:** identical to (i) (base already carries `ability`; rungs narrow `session`).
- **DAL ctx type:** identical to (i).
- **Trade-offs:** (+) smallest diff from the current code; (+) each surface's helper stays readable in isolation. (−) does not meet L4 literally on any prefetching dashboard page (two builds, two session lookups) — the one thing the ruling asked for; (−) two `defineAbilitiesFor` call sites will drift again (that is exactly how today's six sites accumulated, 06 E8); (−) `route.ts` remains a hand-rolled surface.

### C.3 Option (iii) — meta-driven authorization middleware

**Shape.** `initTRPC.context<Ctx>().meta<{ auth: 'public' | 'session' | 'agent' | 'superAdmin' | { shareable: EntityServerSpec }; permission?: [AppAction, AppSubject] }>()`; a single `authz` middleware on `t.procedure` reads `opts.meta` and enforces the rung + optional verb gate; procedures declare `.meta({ auth: 'agent', permission: ['update','Meeting'] })` (B.1 row 5).
- **Where built:** orthogonal to the question — `authz` still has to get the principal from somewhere; if it calls `getRequestPrincipal()` this is Option (i) with declarative gating on top; if it builds inline it is today's `protectedProcedure` with a different trigger.
- **Builds per request:** same as whichever builder it delegates to ((i): 1 per request; inline: 1 per procedure call).
- **Shareable / token:** `meta.auth = { shareable: spec }` selects the bearer branch inside `authz` — the same `bearerAbility` builder as (i); the token still arrives via `getRawInput()` on S1 and `?token=` on S3, so meta only moves *which* branch runs, not *how* the ability is built.
- **S4:** unaffected (jobs/webhooks/scripts do not go through procedures).
- **tRPC ctx type per rung:** the documented meta pattern **cannot narrow** `ctx` — TypeScript cannot refine `ctx.session` from a `.meta({ auth: 'session' })` literal, and the docs' example deliberately calls `next()` unchanged (B.1 row 5), so every handler sees `session: BetterAuthSession | null` and either re-checks or casts. That is the opposite of the docs' "Correctly Narrow User Type" guidance (B.1 row 4) and of what the ladder gives today (`init.ts:60`; `customers.router/procedures.ts:11-18` explains why inline `.use()` inference was chosen over a shared middleware).
- **DAL ctx type:** identical to (i).
- **Trade-offs:** (+) the verb/subject gate becomes declarative and greppable per procedure (it could replace `assertCan` at `create-crud-router.ts:185-197` and the 9 hand-rolled `ctx.ability.cannot(...)` gates, 06 T15) and is visible to tooling (OpenAPI, logging via `pathExtractor`-style extraction); (+) a `permission` meta could feed the Drizzle adapter the (action, subject) pair without the handler naming it. (−) loses compile-time narrowing of `session`; (−) meta is per-procedure declaration, so it does nothing for RSC/route handlers/jobs (S2–S4 still need (i) or (ii)); (−) adds a second authorization vocabulary (meta literals) beside CASL, which L1 was trying to reduce to one. Best understood as an optional layer on (i) for verb declaration, not as an alternative for obtaining the ability.

### C.4 Side-by-side

| | (i) shared `getRequestPrincipal()` | (ii) tRPC ctx + separate helpers | (iii) meta-driven middleware |
|---|---|---|---|
| Builders | 1 (+ `bearerAbility`, `systemAbility`) | 2 (+ bearer, system) | delegates to (i) or (ii) |
| Builds / RSC page with N prefetches | 1 | 2 | as delegate |
| Builds / tRPC HTTP batch | 1 | 1 | 1 (delegate) or 1 per call (inline) |
| Builds / `route.ts` | 1 | 1 | n/a (S3 not covered) |
| Session lookups / RSC render | 1 | 2 | as delegate |
| Ctx narrowing at rungs | yes (docs pattern) | yes | **no** (meta cannot narrow) |
| Token entry forms unified | yes (one bearer builder, 3 call sites) | tRPC only unless routes import it | selects branch only |
| S4 | `systemAbility(reason)` at the boundary | same | unchanged |
| Documented precedent | tRPC inner-context + once-per-request; React `cache` per render; middleware narrowing | tRPC inner-context; middleware narrowing | tRPC `metadata.md` per-route auth |
| Meets L4 ("once per route") | S1 ✓ S2 ✓ S3 ✓ | S1 ✓ S3 ✓ S2 ✗ (prefetching pages) | only via (i) |

Facts only; the choice between `{ ability, userId }` and `{ ability, session }` for the DAL, the home of the system `reason`, and whether (iii)'s declarative `permission` meta is layered onto (i) are user decisions (README §L6).
