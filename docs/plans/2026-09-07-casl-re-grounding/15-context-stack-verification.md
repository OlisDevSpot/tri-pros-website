# 15 — Context-stack verification: every framework claim under README §L4/§L5/§L7 and handoff 13, checked against docs AND the installed packages

> **Scope.** Read-only verification of the framework-API claims that the "compute identity + ability exactly once per request" decision rests on. Nothing here is implemented. Checked 2026-09-09 in worktree `.worktrees/issue-285` @ `b40403b6` (three uncommitted files, none relevant).
> **Versions.** Declared (`package.json`) → installed (`node_modules/<pkg>/package.json`): `next 15.5.9 → 15.5.9` · `react ^19.0.0 → 19.2.4` (Next vendors its own React for the App Router: `node_modules/next/dist/compiled/react`, which is what `import 'react'` resolves to there) · `@trpc/server ^11.4.1 → 11.9.0` · `@trpc/tanstack-react-query ^11.4.1 → 11.9.0` · `@tanstack/react-query ^5.80.7 → 5.90.20` · `better-auth ^1.6.9 → 1.6.9` · `@casl/ability ^6.8.0 → 6.8.0` · `@casl/react` **not installed** (npm `latest` = 7.0.1 per `pnpm view`).
> **Doc sources (Context7).** tRPC `/trpc/trpc` (`www/docs/server/{context,middlewares,metadata,server-side-calls}.md`, `www/docs/server/adapters/fetch.mdx`, `www/docs/client/tanstack-react-query/server-components.mdx`, `packages/server/skills/{middlewares,server-setup}/SKILL.md`, `packages/next/skills/nextjs-app-router/SKILL.md`); Next.js `/vercel/next.js` (`docs/01-app/01-getting-started/{05-server-and-client-components,06-fetching-data,14-metadata-and-og-images}.mdx`, `docs/01-app/03-api-reference/04-functions/{fetch,headers,cookies}.mdx`, `03-api-reference/01-directives/use-client.mdx`, `03-file-conventions/route.mdx`, `packages/next/src/server/request/headers.ts`, `packages/next/src/server/route-modules/app-route/module.ts`); React `/reactjs/react.dev` (`reference/react/cache.md`, `reference/rsc/use-client.md`, `reference/react/{use,createContext}.md`); better-auth `/better-auth/better-auth` (`docs/content/docs/integrations/next.mdx`, `guides/next-auth-migration-guide.mdx`, `concepts/session-management.mdx`, `packages/better-auth/src/api/routes/session.ts`); CASL `/stalniy/casl` (`packages/casl-react/README.md`, `docs-src/.../casl-react/en.md`, `casl-ability-extra/en.md`).
> **Installed-source cites** are under `node_modules/` and given as `<pkg>/dist/<file>:<line>`. Repo cites are relative to `src/` unless prefixed.

---

## 0. Verdict at a glance

| # | Claim | Verdict | One-line evidence |
|---|---|---|---|
| 1 | tRPC fetch adapter calls `createContext` once per HTTP request (= once per batch); a React `cache()` inside it is inert but harmless | **VERIFIED** | `ctxManager.create` guarded "should only be called once", invoked once before the per-call loop (`@trpc/server/dist/resolveResponse-ByfQ6olt.cjs:1869-1893,1910`); route handlers have no Flight request → `cache()` runs the fn every call (§3) |
| 2 | Middleware narrows via `next({ ctx })` and the narrowed type flows downstream; `.meta()`-driven auth cannot narrow ctx types | **VERIFIED** (with a precision note) | `next<$ContextOverride>(opts:{ctx?})` → `MiddlewareResult<$ContextOverride>`; `.use<$Out>` → `Overwrite<TContextOverrides,$Out>`; `.meta()` returns the builder with `TContextOverrides` unchanged (`unstable-core-do-not-import.d-CjQPvBRI.d.mts:338-346,548,553`) |
| 3 | React 19 `cache()` memoizes per server render across layout + page + nested RSCs + in-render tRPC prefetch; does NOT apply in `route.ts` | **VERIFIED** (both halves, from source) | Flight keeps the cache on the per-render `request` object resolved via `AsyncLocalStorage` (`react-server-dom-webpack-server.node.production.js:426,612-623,800-804,1831-1835,1936`); route handlers run under Next's `workUnitAsyncStorage` only (`next/dist/server/route-modules/app-route/module.js:422`) so `resolveRequest()` is `null` and every call gets a fresh `new Map()` |
| 4 | Next 15: `headers()`/`cookies()` are async and must be awaited; calling them inside a `cache()`'d function is allowed in RSC | **VERIFIED** | `headers(): Promise<ReadonlyHeaders>` (Next `headers.ts` JSDoc; `headers.mdx` "asynchronous… sync access… will be deprecated"); `headers()` only throws for `cache`/`private-cache`/`unstable-cache` work-unit stores, and React `cache()` does not change the store (`next/dist/server/request/headers.js:21-74`) — the repo already does it (`shared/domains/auth/lib/get-cached-session.ts:19-21`) |
| 5 | better-auth server session read is `auth.api.getSession({ headers: await headers() })` | **VERIFIED** | Next integration docs use exactly that; installed 1.6.9 endpoint `/get-session`, `requireHeaders: true`, optional `query: { disableCookieCache?, disableRefresh? }`, returns `{ session, user } \| null` (`better-auth/dist/api/routes/session.mjs:16-21`, `session.d.mts:9-16`, `cookies/session-store.mjs:191-194`) |
| 6 | How the RSC caller/prefetch builds ctx today, and whether one `cache()`'d `getRequestActor()` shared with `createContext` would dedupe | **VERIFIED — it would** | `createTRPCOptionsProxy` calls `unwrapLazyArg(opts.ctx)` on **every** procedure call (`@trpc/tanstack-react-query/dist/index.mjs:314-316,542-549`); today's dedupe is only `createRSCTRPCContext`'s zero-arg `cache()` (`trpc/lib/create-http-context.ts:37-38`), a **different memo** from the guard's (`get-cached-session.ts:19`). One module-level zero-arg `cache()`'d builder called from layout, guard and the proxy's `ctx` callback hits the same `request.cache` entry (§3.6) |
| 7 | Client `AbilityProvider` hydrated from rules passed by the dashboard layout RSC: `'use client'` provider, serializable props, packed rules OK; `hasMounted` guards become unnecessary | **VERIFIED for the boundary rules; CORRECTED on the guards** | Next: "Context is not supported directly within Server Components"; `'use client'` props "must be serializable"; React lists plain objects/arrays/primitives as serializable → `packRules()` output qualifies. **But** the only `hasMounted` guard is on the **proposal-flow** navbar, not the dashboard (`features/proposal-flow/ui/components/navbar/navbar.tsx:24-32`, plus `navbar-menu.tsx:27-37`) — it goes away only if the proposal-flow tree is ALSO wrapped by a rules-hydrated provider, and the root provider's fate must be decided (§4) |
| 8 | One procedure builder can expose the SAME ctx shape to HTTP and RSC-caller invocations without duplicating the context builder | **VERIFIED** | `createCallerFactory(router)(ctxOrCallback)` resolves `isFunction(x) ? await x() : x` per call (`@trpc/server/dist/tracked-D4WGA_Z-.cjs` `createCallerFactory`); `createTRPCOptionsProxy({ ctx })` accepts `inferRouterContext<TRouter> \| (() => MaybePromise<…>)` (`index.d.mts:432`); fetch adapter `createContext(opts: { req, resHeaders, info })` (`adapters/fetch/index.d.mts:7-12`). tRPC's own "inner/outer context" doc is this exact split |
| 9 | A `/dashboard/pipeline/[pipeline]` load builds the ability 7× across 3 session lookups | **VERIFIED — 7 builds, 3 lookups** (two framing precisions) | Trace in §3.9. Precision: on THIS page only one `cache()` memo fires (the "two independent memos" statement is true for prefetching pages); lookups #1/#3 are server-side cookie-cache verifications and #2 is a client HTTP round-trip that survives handoff 13 while any `useSession()` stays mounted (5 files) |

**Net for the decisions:** no framework-API correction invalidates L4, L5, L7 or handoff 13's target shape. Two factual premises in the handoff/L10 need editing (the `hasMounted` location and the "two memos" framing), one shape nit (`resHeaders` should be optional), and one open decision surfaces (what the ROOT `AbilityProvider` does once the dashboard/proposal providers hydrate from rules). Details in §4.

---

## 1. What the repo does today (the facts the trace rests on)

| Seam | Where | Keyed on | Notes |
|---|---|---|---|
| `getCachedSession` | `shared/domains/auth/lib/get-cached-session.ts:19-21` | zero args → memo A | `auth.api.getSession({ headers: await headers() })`; used by `app/(frontend)/dashboard/layout.tsx:14` and `shared/domains/permissions/lib/protect-dashboard-page.ts:27` |
| `createHTTPTRPCContext` | `trpc/lib/create-http-context.ts:12-27` | **the `{ req?, resHeaders }` argument object** | `cache()` keys object args by identity in a `WeakMap` (`next/dist/compiled/react/cjs/react.react-server.production.js:306-315`); every call site passes a fresh literal (`app/api/trpc/[trpc]/route.ts:12`, `create-http-context.ts:38`) → never a hit on its own |
| `createRSCTRPCContext` | `create-http-context.ts:37-38` | zero args → memo B | `cache(async () => createHTTPTRPCContext({ resHeaders: new Headers() }))`; consumed by `trpc/server.ts:9-13` as the options-proxy `ctx` |
| `getQueryClient` | `trpc/server.ts:8` | zero args | `cache(makeQueryClient)`; `trpc/lib/prefetch.ts:20`, `trpc/components/hydrate-client.tsx:18` |
| Ladder | `trpc/init.ts:29-103` | — | `baseProcedure` (= `systemProcedure`, `:39`) → `protectedProcedure` **builds** at `:54-57` and stamps `{ …ctx, session, ability, scope: null, actor: userActor(...) }` at `:60` → `agentProcedure` gate `:73` → `superAdminProcedure` gate `:95` |
| Context type | `trpc/types.ts:44-63` | — | `BaseTRPCContext { session, ability, scope, actor }` all nullable; `HTTPTRPCContext` adds `req?: Request`, `resHeaders: Headers` (`resHeaders` has **zero readers** in `src/` — grep) |
| Shareable | `trpc/lib/middleware/shareable-middleware.ts:39-50` | — | session branch rebuilds the ability at `:40-43` (chains off `baseProcedure`) |
| Client provider | `shared/components/providers/casl-provider.tsx:19-37` | — | mounted in the ROOT providers (`app/(frontend)/layout.tsx:144` → `shared/components/providers/index.tsx:15`); `useSession()` → `defineAbilitiesFor(...)` memoized on `[userId, userRole]` |
| Sidebar | `features/agent-dashboard/ui/components/app-sidebar.tsx:73-76` | — | `getSidebarNav(defineAbilitiesFor({ id: user.id, role: user.role }))` from the `user` prop passed by `dashboard/layout.tsx:24` |
| `createCallerFactory` | `trpc/init.ts:28` | — | exported, **zero consumers** (grep `createCaller(` / `createCallerFactory(` outside `init.ts`) |
| `next.config.ts` | — | — | no `cacheComponents` / `dynamicIO` / `ppr` / `useCache` flags → the Cache-Components caveat in 09 §B.2 is dormant |

---

## 2. Claim-by-claim evidence

### 2.1 Claim 1 — `createContext` once per HTTP request; `cache()` inert but harmless there — **VERIFIED**

**Installed source.** `@trpc/server/dist/resolveResponse-ByfQ6olt.cjs:1869-1893` builds a `ctxManager` whose `create()` throws `"This should only be called once - report a bug in tRPC"` on a second call and stores the single `await opts.createContext({ info })` result; `:1910` calls `await ctxManager.create(info)` **once**, before `info.calls.map(...)` (`:1911`) fans out the batched procedures, each reading `ctxManager.value()` / `valueOrUndefined()`. The fetch adapter forwards `opts.createContext` with `{ req, resHeaders, info }` (`adapters/fetch/index.mjs:16-18`; typed `FetchCreateContextFnOptions = { req, resHeaders, info }` at `adapters/fetch/index.d.mts:7-12`).

**Docs.** `www/docs/server/context.md` "Creating the context": "`createContext()` is called once per request, so all procedures within a single batched request share the same context." The repo's client uses `httpBatchLink` (`shared/components/providers/trpc-provider.tsx:21`), so parallel `useQuery`s do fold into one request.

**Why `cache()` is inert on that path (and stays inert after handoff 13).** Route handlers are compiled into the `rsc` webpack layer (`next/dist/build/entries.js:436-448` → `layer: WEBPACK_LAYERS.reactServerComponents`), so `import { cache } from 'react'` there is the react-server build: `exports.cache = fn => function () { var dispatcher = ReactSharedInternals.A; if (!dispatcher) return fn.apply(null, arguments); var fnMap = dispatcher.getCacheForType(createCacheRoot); … }` (`next/dist/compiled/react/cjs/react.react-server.production.js:296-301`). The dispatcher is Flight's `DefaultAsyncDispatcher`, whose `getCacheForType` does `resolveRequest() ? request.cache : new Map()` (`react-server-dom-webpack-server.node.production.js:612-623`) and `resolveRequest()` reads `currentRequest || requestStorage.getStore()` (`:800-804`). A route handler executes under Next's `workUnitAsyncStorage.run(requestStore, handler, request, handlerContext)` (`next/dist/server/route-modules/app-route/module.js:422`) — there is no Flight `request`, so every `cache()`'d call gets a fresh `Map` and executes the function. Today there is a second, independent reason: `createHTTPTRPCContext` is keyed on a fresh object argument (§1). After the rewrite (`getRequestActor` is zero-arg) only the first reason remains. Either way: inert, harmless, and irrelevant because tRPC already guarantees one `createContext` per HTTP request.

**Consequence to record.** A non-tRPC `route.ts` that calls `getRequestActor()` twice (or once plus a tRPC caller whose `createContext` calls it again) pays two `getSession` executions. No such handler exists today (09 §A.3: none reads the session). On the cookie-cache fast path each execution is an HMAC verification, not a DB hit (§2.5).

### 2.2 Claim 2 — middleware narrowing via `next({ ctx })`; `.meta()` cannot narrow — **VERIFIED**

**Installed types** (`@trpc/server/dist/unstable-core-do-not-import.d-CjQPvBRI.d.mts`):
- `MiddlewareFunction<TContext, TMeta, TContextOverridesIn, $ContextOverridesOut, TInputOut>` receives `ctx: Simplify<Overwrite<TContext, TContextOverridesIn>>` and a `next` with three overloads: `(): Promise<MiddlewareResult<TContextOverridesIn>>` (no narrowing), `<$ContextOverride>(opts: { ctx?: $ContextOverride; input?: unknown }): Promise<MiddlewareResult<$ContextOverride>>` (narrowing), and the `getRawInput` form (`:329-350`).
- `ProcedureBuilder.use<$ContextOverridesOut>(fn)` returns `ProcedureBuilder<TContext, TMeta, Overwrite<TContextOverrides, $ContextOverridesOut>, …>` (`:553`) — the override accumulates down the chain; `agentProcedure = protectedProcedure.use(...)` inherits `session: Session` etc.
- `ProcedureBuilder.meta(meta: TMeta)` returns `ProcedureBuilder<TContext, TMeta, TContextOverrides, …>` — **`TContextOverrides` untouched** (`:548`). `initTRPC.meta<TNewMeta>()` only changes `TMeta` (`:1727`).

**Docs.** `middlewares.md` "Context Extension" (a middleware "passes a non-nullable user object down the chain"); `packages/server/skills/middlewares/SKILL.md` "Auth middleware that narrows context type" (`return opts.next({ ctx: { user: ctx.user } })`); `metadata.md` "Example with per route authentication settings" — the middleware reads `opts.meta` and calls **`next()` with no ctx**, and the docs describe meta as deciding *whether* to check.

**Precision note (does not change the decision).** Nothing in the types stops a meta-aware middleware from calling `next({ ctx: { user: ctx.user! } })`. What it cannot do is narrow *conditionally on the meta value* — the override type is fixed at `.use()` time for every downstream procedure regardless of what `.meta({ authRequired: false })` later says — so a meta-driven "optional auth" middleware either lies about nullability or does not narrow. That is the substantive content of "cannot narrow", and it is why L4 option (iii) was rejected correctly.

**Read-across.** The repo's `init.ts:60` already uses the documented narrowing form; the only deviation from the docs is that it *builds* (`:54-57`) inside the narrowing middleware. Handoff 13 step 3 (`next({ ctx: { ...ctx, session: ctx.session } })`) is exactly the documented shape; spreading `...ctx` is unnecessary under `Overwrite` but harmless.

### 2.3 Claim 3 — `cache()` scope: one RSC render (layout + page + nested + in-render prefetch); not `route.ts` — **VERIFIED**

**Mechanism from installed source** (`next/dist/compiled/react-server-dom-webpack/cjs/react-server-dom-webpack-server.node.production.js`):
- `requestStorage = new async_hooks.AsyncLocalStorage()` (`:426`); the render is started as `requestStorage.run(request, performWork, request)` (`:1936`); `performWork` also sets the module-global `currentRequest = request` for its synchronous span (`:1831-1835`).
- `DefaultAsyncDispatcher.getCacheForType` stores cache roots on `request.cache` (`:612-623`); `resolveRequest()` = `currentRequest || requestStorage.getStore()` (`:800-804`). Because the store is an `AsyncLocalStorage`, every `await` continuation spawned inside the render — including an async page component's code after `await protectDashboardPage()` and a TanStack `queryFn` invoked from `prefetch()` — still resolves the same `request`, hence the same cache.
- The memo stores the function's **return value** (for an async fn, the `Promise` itself) with status 1 (`react.react-server.production.js:326-330`), so concurrent callers in the same render share one in-flight promise; a thrown error is stored with status 2 and re-thrown to later callers (`:331-333`).

**Docs.** Next `06-fetching-data.mdx` "Reusing data with React.cache": "request-level memoization … strictly scoped to the current request lifecycle"; `14-metadata-and-og-images.mdx`: a `cache()`'d fetcher shared by `generateMetadata` and the page "will be used twice, but execute only once". React `cache.md` caveats: "React will invalidate the cache for all memoized functions for each server request"; "`cache` is for use in Server Components only"; "Calling a memoized function outside of a component will not use the cache … cache access is provided through a context which is only accessible from a component." Next `fetch.mdx` "Memoization": "does not apply inside Route Handlers since they are outside the React component tree" (stated for `fetch`; the source above shows the same holds for `cache()`).

**Route handlers: no cache, from source.** See §2.1 — no Flight `request` under `workUnitAsyncStorage.run(requestStore, handler, …)` (`app-route/module.js:422`), so `getCacheForType` hands back a throw-away `new Map()` per call.

**Two extra facts worth recording.**
1. The **client/SSR build** of `cache` is a passthrough: `exports.cache = fn => function () { return fn.apply(null, arguments) }` (`next/dist/compiled/react/cjs/react.production.js`, same in `node_modules/react/cjs/react.production.js`). So `cache()` also does nothing inside `'use client'` components during the SSR pass — the `AbilityProvider`/`AppSidebar` builds in §3.9 cannot be deduped with `cache()`, which is why L10 moves them to props.
2. `next.config.ts` enables no `cacheComponents`/`dynamicIO`; the "each Cache Function gets an isolated `React.cache` scope" caveat (09 §B.2) is dormant until that flag is adopted.

### 2.4 Claim 4 — async `headers()`/`cookies()`; allowed inside a `cache()`'d function in RSC — **VERIFIED**

**Docs.** Next `headers.mdx` "Good to know": "`headers` is an asynchronous function that returns a promise … synchronous access in Next.js 15 is for backwards compatibility and will be deprecated"; `cookies.mdx` says the same. `packages/next/src/server/request/headers.ts` JSDoc: usable in Server Components, Server Actions, Route Handlers and Middleware; `route.mdx` shows `const headersList = await headers()` inside `GET`.

**Installed source.** `next/dist/server/request/headers.js:21-74`: `headers()` switches on `workUnitAsyncStorage.getStore().type` and throws only for `'cache'`, `'private-cache'` and `'unstable-cache'` stores (the `'use cache'` / `unstable_cache` scopes — the same rule the app-route module enforces at `module.js:826-836`); for `'request'` it returns the request headers. React's `cache()` is not a Next cache scope and does not change the work-unit store, so `await headers()` inside a `cache()`'d function sees `type: 'request'` — which is what `get-cached-session.ts:19-21` and `create-http-context.ts:12-13` already do in production.

### 2.5 Claim 5 — better-auth `auth.api.getSession({ headers: await headers() })` — **VERIFIED**

**Docs.** `integrations/next.mdx` (Server Component, Server Action, and `runtime: 'nodejs'` middleware examples) and `guides/next-auth-migration-guide.mdx` all use `const session = await auth.api.getSession({ headers: await headers() })`. Cache bypass: `auth.api.getSession({ query: { disableCookieCache: true }, headers: await headers() })` (`concepts/session-management.mdx`).

**Installed 1.6.9.** `better-auth/dist/api/routes/session.mjs:16-21`: `createAuthEndpoint("/get-session", { method: ["GET","POST"], query: getSessionQuerySchema, requireHeaders: true, … })`; `cookies/session-store.mjs:191-194`: `getSessionQuerySchema = z.optional(z.object({ disableCookieCache?: boolean, disableRefresh?: boolean }))`; `session.d.mts:9-16` mirrors this. `headers` is `HeadersInit` on the better-call context (`better-call/dist/context.d.mts:61-63`), so Next's `ReadonlyHeaders` is accepted. Return: `{ session, user } | null` — the repo's `BetterAuthSession = Auth['$Infer']['Session']` (`shared/domains/auth/server.ts:115`). With the repo's `session.cookieCache.enabled` + `maxAge: 300` (`auth/server.ts:94-97`) the hit path is a signed-cookie verification with no DB call (`session.mjs:93-…`; docs "Cookie cache hit … no I/O, just HMAC/JWT/JWE verification"). One oddity for completeness: `POST /get-session` over HTTP is rejected unless `deferSessionRefresh` is set (`session.mjs:37-39`); irrelevant to `auth.api.*` server calls.

**Handoff snippet typing.** `defineAbilitiesFor(session?.user ?? null)` typechecks: `PermissionUser = { id: string; role: UserRole }` (`shared/domains/permissions/abilities.ts:75-78`) and `BetterAuthUser.role` is inferred from `additionalFields.role: { type: [...userRoles], defaultValue: 'user' }` (`auth/server.ts:72-75`); extra user fields are fine structurally.

### 2.6 Claim 6 — today's RSC caller/prefetch context, and whether one shared `getRequestActor()` would dedupe — **VERIFIED (it would)**

**Today's real call chain (file:line).**
1. `trpc/server.ts:9-13` — `createTRPCOptionsProxy({ ctx: createRSCTRPCContext, router: appRouter, queryClient: getQueryClient })` under `'server-only'`.
2. A page calls `prefetch(trpc.x.queryOptions(...))` (`trpc/lib/prefetch.ts:37-39` → `executePrefetch :18-25` → `queryClient.prefetchQuery(queryOptions)`).
3. The `queryFn` produced by the proxy is `callIt('query')` (`@trpc/tanstack-react-query/dist/index.mjs:588`), which does `Promise.resolve(unwrapLazyArg(opts.ctx)).then(ctx => callTRPCProcedure({ router: opts.router, path, getRawInput: async () => input, ctx, type }))` (`:542-549`); `unwrapLazyArg = v => isFunction(v) ? v() : v` (`:314-316`). **So `opts.ctx` is invoked once per procedure call** — the same as `createCallerFactory` (§2.8). The only thing making six prefetches on `dashboard/page.tsx` cost one session lookup is that `createRSCTRPCContext` is a zero-arg `cache()` (`create-http-context.ts:37-38`).
4. `callTRPCProcedure` runs the full middleware chain, so every prefetch pays `init.ts:54` (`defineAbilitiesFor`) — confirmed by the repo's own note that a ctx without headers makes every `agentProcedure` prefetch throw UNAUTHORIZED (`trpc/DOCS.md#rsc-prefetch-uses-rsc-context`).
5. The RSC guard resolves the session through a **different** memo (`get-cached-session.ts:19`, and its header comment `:10-12` says so). Prefetching pages therefore run `auth.api.getSession` twice per render: memo A (layout/guard) + memo B (proxy ctx). Non-prefetching pages (e.g. `pipeline/[pipeline]`) never touch memo B.
6. `HydrateClient` dehydrates the same `getQueryClient()` (`trpc/components/hydrate-client.tsx:17-19`).

**Would one `cache()`'d `getRequestActor()` dedupe across guard + `createContext` (RSC branch) + layout?** Yes, by the mechanism in §2.3: React keys the memo on (memoized-function identity, argument list) inside `request.cache`; a single module-level `export const getRequestActor = cache(async () => …)` with zero args, called from `layout.tsx`, `protectDashboardPage()` and the proxy's `ctx: async () => ({ ...(await getRequestActor()), resHeaders })` — all executing within the same Flight render's async context — hits one cache node; concurrent callers share the stored promise (`react.react-server.production.js:326-330`). Preconditions: (a) `getRequestActor` must be defined once at module scope (React caveat: "Each call to `cache` creates a new function … different memoized functions that do not share the same cache"); (b) all callers must be in the `rsc` layer so it is one module instance — `trpc/server.ts` is `'server-only'` and layouts/guards are RSCs, so this holds; (c) errors are memoized for the render (a `getSession` throw surfaces at every call site) — same blast radius as today's `protectDashboardPage`, acceptable.

### 2.7 Claim 7 — client `AbilityProvider` hydrated from layout-passed rules — **VERIFIED (boundary rules) / CORRECTED (guards)**

**Boundary rules (docs).** Next `05-server-and-client-components.mdx`: "Create a React context provider as a Client Component … Context is not supported directly within Server Components", and render it from a server layout ("Render providers as deep as possible"). Next `use-client.mdx`: "all props passed to the component must be serializable." React `rsc/use-client.md` "Serializable types": primitives, arrays/Map/Set, `Date`, plain objects with serializable properties, Promises, JSX; **not** class instances, non-server functions, non-global symbols. `packRules(ability.rules)` produces `PackRule[]` — arrays of strings/numbers/plain condition objects (the repo's conditions are plain: `{ ownerId: user.id }`, `{ $participatesViaMeeting: {…} }`) — so it serializes; `packRules`/`unpackRules` are exported from `@casl/ability/extra` (`@casl/ability/dist/types/extra/index.d.ts:1`; CASL docs "unpackRules … so they can be consumed by `Ability` instance"). The provider rebuilds with `createMongoAbility(unpackRules(rules), { conditionsMatcher })` — `conditions-matcher.ts:41-49` has no server imports and is already in the client bundle (`abilities.ts:46` imports it and `abilities.ts` is imported by `casl-provider.tsx:16`).

**`@casl/react` API (handoff step 5).** npm `latest` = 7.0.1 (`pnpm view @casl/react`); docs (`packages/casl-react/README.md`) show `import { AbilityProvider, Can, useAbility } from '@casl/react'` with `<AbilityProvider value={ability}>` and describe the package as "three main features: AbilityProvider … Can … useAbility". The specific statement "`createContextualCan` was removed in 7.0" was **not returned by the fetched docs** (UNVERIFIABLE from Context7; consistent with the README listing only the three exports). Not decision-bearing.

**Corrections.**
- **There is no `hasMounted` guard on the dashboard.** The only ones are `features/proposal-flow/ui/components/navbar/navbar.tsx:24-32` (`viewerRole`/`backHref` gated on `hasMounted && ability.can(...)`) and the sibling `navbar-menu.tsx:27-37` (`showViewToggle = mounted && ability.can('update','Proposal')`). The dashboard's deny-all SSR paint is real but unguarded: `AbilityProvider` renders with `useSession()`'s SSR initial `{ data: null, isPending: true }` (`better-auth/dist/client/query.mjs:6-8`) → `defineAbilitiesFor(null)`; `AppSidebar` is immune because it builds from the `user` prop. So L10/handoff wording "today's `hasMounted` guards" should point at proposal-flow.
- **Those guards become unnecessary only if the proposal-flow tree is also wrapped by a rules-hydrated provider** (L10 already says "the dashboard layout and the proposal page RSC ship `packRules`"). With identical props in the SSR pass and the first client render, SSR output == hydration output → no mismatch → guard removable. If only the dashboard layout ships rules, the proposal-flow navbar still reads the root session-based provider and the guards must stay.
- **The root provider must be decided, not just bypassed.** `AbilityProvider` sits in the root `Providers` (`providers/index.tsx:15`) above every route; a nested `<AbilityContext value>` in the dashboard layout shadows it for that subtree only. The 27 `useAbility()` sites include 1 in `features/landing` (`notion-refresh-button.tsx:14`), 5 in `features/proposal-flow`, 8 in `shared/entities`, 6 in `shared/components`. Whatever is outside the dashboard/proposal providers sees either the root session-based ability (if kept) or the deny-all default `createMongoAbility()` (`shared/domains/permissions/context.ts:13`) (if removed). Open decision → §4.
- **Rules-as-props are a per-request snapshot.** Today's provider re-derives on any better-auth store change. After the change, an in-place session change updates nothing until the RSC re-renders. Current sign-out is a full reload (`app-sidebar.tsx:292-296` → `window.location.assign('/')`), so no regression there; note it as a rule ("session changes → `router.refresh()`").

### 2.8 Claim 8 — one builder, same ctx shape for HTTP and RSC callers — **VERIFIED**

- **`createCallerFactory`.** Installed body (`@trpc/server/dist/tracked-D4WGA_Z-.cjs`, `createCallerFactory` → `createCaller(ctxOrCallback, opts)`): inside the recursive proxy, per call, `ctx = isFunction(ctxOrCallback) ? await Promise.resolve(ctxOrCallback()) : ctxOrCallback`, then `procedure({ path, getRawInput, ctx, type, signal })` (middlewares run). Docs (`context.md` "Create Context for Server-side Calls", `server-side-calls.md`): `const createCaller = t.createCallerFactory(appRouter); const caller = createCaller(await createContext())`.
- **Options proxy.** `createTRPCOptionsProxy` `ctx: inferRouterContext<TRouter> | (() => MaybePromise<inferRouterContext<TRouter>>)` (`@trpc/tanstack-react-query/dist/index.d.mts:432`), resolved per call (§2.6). tRPC's Next skill wires it as `ctx: async () => createTRPCContext({ headers: await headers() })` — i.e. the same context builder the HTTP adapter uses, called with request headers.
- **Fetch adapter.** `createContext(opts: FetchCreateContextFnOptions)` with `{ req, resHeaders, info }` (`adapters/fetch/index.d.mts:7-12`).
- **The documented way to share the shape** is the inner/outer split (`context.md` "Inner and outer context"; `skills/server-setup/SKILL.md`): `createContextInner({ session })` — "useful for … server-side calls where we don't have `req`/`res`" — and `createContext(opts)` that spreads `req`/`res` on top, with `type Context = Awaited<ReturnType<typeof createContextInner>>` fed to `initTRPC.context<Context>()`. Mapping to handoff 13: `getRequestActor()` **is** the inner context (`{ session, actor }`); the HTTP outer wrapper adds `req`/`resHeaders`; the RSC `ctx` callback adds nothing. One `initTRPC.context<…>()` builder, one ladder, zero duplication of the identity/ability logic.
- **Shape nit.** For the type to be shared, HTTP-only fields must be optional. `req?` already is; `resHeaders: Headers` is required (`trpc/types.ts:60-63`) and the RSC branch satisfies it with a throwaway `new Headers()` (`create-http-context.ts:38`) that **nobody reads** (grep `resHeaders` in `src/` → only the three plumbing files). Make it `resHeaders?: Headers` (or drop it) in the target `{ session, actor, req?, resHeaders }`.

### 2.9 Claim 9 — `/dashboard/pipeline/[pipeline]` at HEAD: 7 builds, 3 session lookups — **VERIFIED**

Baseline `b40403b6`. `page.tsx` is `force-dynamic`, calls `await protectDashboardPage()` and discards the result (`app/(frontend)/dashboard/pipeline/[pipeline]/page.tsx:4-8`); no `prefetch`.

| # | Pass | Step (file:line) | `getSession` | `defineAbilitiesFor` |
|---|---|---|---|---|
| 1 | RSC (Flight) | `dashboard/layout.tsx:14` `getCachedSession()` | **lookup #1** (memo A; cookie-cache fast path) | — |
| 2 | RSC | `pipeline/[pipeline]/page.tsx:7` → `protect-dashboard-page.ts:27` (memo A hit) → `:36-39` | hit | **build 1** (discarded by the page) |
| — | RSC | memo B (`createRSCTRPCContext`) | never invoked on this page | — |
| 3 | SSR (Fizz, `cache()` is a passthrough) | `casl-provider.tsx:20-30`: `useSession()` SSR initial `{ data: null, isPending: true }` (`better-auth/dist/client/query.mjs:6-8`) → `defineAbilitiesFor(null)` | — | **build 2** (deny-all) |
| 4 | SSR | `features/agent-dashboard/ui/components/app-sidebar.tsx:73-76` (rendered by `layout.tsx:24` because `session` is truthy) | — | **build 3** |
| 5 | Client hydration | `casl-provider.tsx:27-30` first render, `useMemo` on `[null, null]` → `defineAbilitiesFor(null)`; better-auth client then fetches `GET /api/auth/get-session` (`app/api/auth/[...all]/route.ts`) → store updates → deps change | **lookup #2** (client-initiated HTTP request) | **build 4**, then **build 5** |
| 6 | Client hydration | `app-sidebar.tsx:73-76` `useMemo` runs on mount | — | **build 6** |
| 7 | Client → tRPC | `features/customer-pipelines/ui/views/customer-pipeline-view.tsx:46-49` `useQuery(getCustomerPipelineItems)` → `httpBatchLink` (`trpc-provider.tsx:21`) → `app/api/trpc/[trpc]/route.ts:12` → `create-http-context.ts:15` → `agentProcedure` (`trpc/routers/customer-pipelines.router.ts:27`) → `protectedProcedure` `init.ts:54` | **lookup #3** | **build 7** |

No second procedure rides in that first batch: the sidebar subcomponents (`sidebar-pipeline-item`, `sidebar-records-group`, `sidebar-search-bar`, `sidebar-user-button`, `action-center-sheet`), `DashboardMobileNav`, `PushSubscriptionBanner`, `GlobalDialogs`, `RealtimeProvider`, `PwaInstallPrompt` contain no `useQuery`/`useSuspenseQuery` (grep); `ActionCenterSheet` is mounted closed (`app-sidebar.tsx:300`); the two `useQuery`s in `features/customer-pipelines/ui/components/` are dialog-scoped (`assign-project-dialog.tsx:34`, `create-project-form.tsx:64`). `CustomerPipelineView` itself reads `useAbility()` (`:35`) but builds nothing.

**Total: 7 builds (1 RSC + 2 SSR + 3 client + 1 tRPC) across 3 `getSession` executions — the handoff's numbers stand.** Two framing precisions:
- "through two independent `cache()` memos" is true for the seven **prefetching** pages (`dashboard/page.tsx` ×6 prefetches, `schedule` ×2, `campaigns` ×2, `customers`/`meetings`/`projects`/`proposals` ×1 — `grep -c "prefetch("`), where memo A and memo B both fire. On `pipeline/[pipeline]` only memo A fires.
- The three lookups are not alike: #1 and #3 are server-internal `auth.api.getSession` calls (cookie verification while the 5-minute cookie cache is warm); #2 is a separate client HTTP round-trip that handoff 13 does **not** remove by itself — it disappears only when no client component mounts better-auth's `useSession()`. Besides `casl-provider.tsx`, four files still do (`shared/components/navigation/popover-nav.tsx:39`, `site-navbar.tsx:49`, `features/proposal-flow/ui/views/create-new-proposal-view.tsx:33`, `shared/entities/customer-notes/hooks/use-customer-note-action-configs.ts:34` — the last is one of the L10 "mirrors" slated for deletion).

**Floor after handoff 13 on this page** (for the step-9 report to compare against): RSC render 1 lookup + 1 build; SSR pass 0 `defineAbilitiesFor` (1 `createMongoAbility(unpackRules)` hydration per provider instance); client 0 builds (1 hydration); tRPC batch 1 lookup + 1 build **per HTTP batch** (unless the page is moved to server prefetch, in which case that batch's cost folds into the RSC render's single build). "Exactly once per request" is achievable per server request; a page load is still ≥2 server requests (document + first tRPC batch).

---

## 3. Verified minimal shapes (doc snippets, verbatim where it matters)

### 3.1 Cached request-context builder (React `cache` + Next `headers` + better-auth)

React/Next — define at module scope, zero or primitive args (Next `06-fetching-data.mdx` / `14-metadata-and-og-images.mdx`; React `cache.md` "Correct usage: … in a dedicated module"):
```ts
import { cache } from 'react'
// getPost will be used twice, but execute only once
export const getPost = cache(async (slug: string) => { /* … */ })
```
better-auth (`integrations/next.mdx`):
```ts
import { auth } from "@/lib/auth";
import { headers } from "next/headers";
const session = await auth.api.getSession({ headers: await headers() })
```
Composed (the handoff's target, unchanged; only `resHeaders?` differs — §2.8):
```ts
// 'server-only'
export const getRequestActor = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() })   // one lookup per RSC render
  const ability = defineAbilitiesFor(session?.user ?? null)                   // one build; null ⇒ deny-all
  return { session, actor: { ability, userId: session?.user.id ?? null } }
})
```

### 3.2 tRPC `createContext` (inner/outer) + narrowing ladder

Inner/outer (`www/docs/server/context.md` "Inner and outer context"):
```ts
export async function createContextInner(opts?: { session: Session | null }) {
  return { db, session: opts?.session }
}
export async function createContext(opts: CreateHTTPContextOptions) {
  const session = getSessionFromCookie(opts.req)
  const contextInner = await createContextInner({ session })
  return { ...contextInner, req: opts.req, res: opts.res }
}
export type Context = Awaited<ReturnType<typeof createContextInner>>
```
Fetch adapter signature (`www/docs/server/adapters/fetch.mdx`):
```ts
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch'
export function createContext({ req, resHeaders }: FetchCreateContextFnOptions) { /* … */ }
```
Narrowing middleware (`packages/server/skills/middlewares/SKILL.md`):
```ts
export const authedProcedure = t.procedure.use(async (opts) => {
  const { ctx } = opts
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return opts.next({ ctx: { user: ctx.user } })   // user is non-nullable downstream
})
```
Meta example for contrast (`www/docs/server/metadata.md`) — checks, does not narrow:
```ts
export const authedProcedure = t.procedure.use(async (opts) => {
  const { meta, next, ctx } = opts
  if (meta?.authRequired && !ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' })
  return next()
})
```

### 3.3 RSC caller / prefetch context reuse

`www/docs/client/tanstack-react-query/server-components.mdx` + `packages/next/skills/nextjs-app-router/SKILL.md`:
```tsx
import 'server-only'
export const getQueryClient = cache(makeQueryClient)
export const trpc = createTRPCOptionsProxy({
  ctx: async () => createTRPCContext({ headers: await headers() }),   // same builder as HTTP, per call
  router: appRouter,
  queryClient: getQueryClient,
})
export function prefetch<T extends ReturnType<TRPCQueryOptions<any>>>(queryOptions: T) {
  const queryClient = getQueryClient()
  if (queryOptions.queryKey[1]?.type === 'infinite') void queryClient.prefetchInfiniteQuery(queryOptions as any)
  else void queryClient.prefetchQuery(queryOptions)
}
export function HydrateClient(props: { children: React.ReactNode }) {
  return <HydrationBoundary state={dehydrate(getQueryClient())}>{props.children}</HydrationBoundary>
}
```
Server-side caller with the same context (`www/docs/server/context.md` "Create Context for Server-side Calls"):
```ts
const createCaller = t.createCallerFactory(appRouter)
const caller = createCaller(await createContext())
```

### 3.4 better-auth session read (with cache bypass)

`concepts/session-management.mdx`:
```ts
await auth.api.getSession({
  query: { disableCookieCache: true },   // optional: force DB + refresh the cookie cache
  headers: await headers(),
})
```

### 3.5 Client provider hydrated from serializable rules (Next + CASL)

Next `05-server-and-client-components.mdx` (provider is a Client Component rendered by a server layout) + CASL `packages/casl-react/README.md`:
```tsx
'use client'
import { AbilityProvider, useAbility, Can } from '@casl/react'          // 7.0.1
export function DashboardAbility({ rules, children }: { rules: PackRule<RawRule>[]; children: React.ReactNode }) {
  const ability = useMemo(() => createMongoAbility<AppAbility>(unpackRules(rules), { conditionsMatcher: buildScopeConditionsMatcher() }), [rules])
  return <AbilityProvider value={ability}>{children}</AbilityProvider>
}
```
```tsx
// layout.tsx (RSC)
const { actor } = await getRequestActor()
return <DashboardAbility rules={packRules(actor.ability.rules)}>{children}</DashboardAbility>
```

---

## 4. Corrections that change (or sharpen) a decision

| Target | What the verification found | Change required |
|---|---|---|
| **L4 (compute once per route)** | Every API premise holds: one `createContext` per HTTP batch (§2.1), per-render `cache()` shared by layout + guard + in-render prefetch (§2.3, §2.6), `.meta()` cannot conditionally narrow (§2.2). | **None.** |
| **L5 (5-rung ladder)** | `protectedProcedure` as `if (!ctx.session) throw; return next({ ctx: { session: ctx.session } })` is the documented narrowing form and the narrowed type flows into `agent`/`superAdmin` (§2.2). | **None.** |
| **L7 (`Actor` record, one builder per surface family)** | `getRequestActor` composes exactly the documented inner-context; `defineAbilitiesFor(session?.user ?? null)` typechecks against `PermissionUser` (§2.5). | **None.** |
| **Handoff 13 — target ctx shape `{ session, actor, req?, resHeaders }`** | `resHeaders` has zero readers and the RSC path fabricates one; the shared-shape argument (§2.8) wants HTTP-only fields optional. | Make it `resHeaders?: Headers` (or drop it). Trivial; do it in step 1/2. |
| **Handoff 13 — step 5 / L10 "removes the deny-all first paint that today's `hasMounted` guards hide"** | The dashboard has no such guard; the only guards are on the proposal-flow navbar (`navbar.tsx:24-32`, `navbar-menu.tsx:27-37`). They become removable only when the proposal-flow tree is also wrapped by a rules-hydrated provider (§2.7). | Reword the premise; make "proposal page RSC ships `packRules`" a hard dependency of deleting those two guards (they stay if only the dashboard layout ships rules). |
| **L10 / handoff 13 — root `AbilityProvider`** | Nested providers shadow the root one only for their subtree; consumers elsewhere (landing `notion-refresh-button.tsx:14`, shared components/entities rendered outside dashboard/proposal) fall to the deny-all default if the root session-based provider is removed. | **New decision needed (add to §J):** keep the root provider as the session-derived fallback, ship rules from the root layout too, or accept deny-all outside the two trees. Also record the rule "in-place session change ⇒ `router.refresh()`" since rules-as-props are a per-request snapshot (§2.7). |
| **Handoff 13 — "Facts" paragraph, "through two independent `cache()` memos"** | True for prefetching pages; on `pipeline/[pipeline]` only memo A fires (§2.9). | Precision edit only; the 7/3 numbers are correct. |
| **Handoff 13 — step 9 report ("builds-per-page-load after")** | Lookup #2 (client `/api/auth/get-session`) survives while any `useSession()` is mounted (5 files, §2.9); lookup #3 (tRPC batch) is a separate HTTP request and is legitimately one-per-batch. | Define the "after" floor as in §2.9 so the step-9 comparison is apples-to-apples: per server request, not per page load. |
| **Handoff 13 — step 2, "the `cache()` is inert there — fine"** | Verified from source, and currently double-inert (no Flight request + identity-keyed arg). After the rewrite only the first reason remains; a non-tRPC `route.ts` calling `getRequestActor()` twice pays twice (§2.1). | No change; add a one-line comment in `getRequestActor` stating that route handlers get no memo so callers there should call it once and pass the result down. |
| **Handoff 13 — step 5, `@casl/react` 7.0.1 API** | `AbilityProvider` / `useAbility` / `Can` confirmed by docs and npm; the "`createContextualCan` removed in 7.0" note was not present in the fetched docs (UNVERIFIABLE, non-bearing). | None; treat the removal note as unconfirmed colour. |

Nothing above reopens L4, L5 or L7. The one genuinely new decision is the root-provider question (row 6), which belongs with L10, not with the tRPC/RSC unification.

---

## 5. Non-bearing observations recorded for the implementer

- `createHTTPTRPCContext`'s `cache()` never hits today even in RSC because it is keyed on a fresh object (`react.react-server.production.js:306-315` uses a `WeakMap` by identity) — `createRSCTRPCContext`'s zero-arg wrapper is what actually memoizes. Folding both into a zero-arg `getRequestActor()` removes the trap.
- React `cache()` memoizes thrown errors for the render (`react.react-server.production.js:331-333`); a cookie-cache miss with the DB down will surface the same error at layout, guard and every prefetch — same as today's behaviour through `protectDashboardPage`.
- `generateMetadata` shares the render cache with the page (Next `14-metadata-and-og-images.mdx`), so a future dashboard `generateMetadata` reading the actor is free.
- better-auth's FAQ guidance ("avoid `useSession` in root layout files; prefer `auth.api.getSession` in server components", 09 §B.3) aligns with moving the provider's source of truth to RSC-shipped rules; the remaining four `useSession()` consumers are the reason lookup #2 persists.
- `experimental_nextAppDirCaller` (server actions) bypasses `createContext` (09 §B.1); the repo does not use it, so the "exactly once" guarantee has no third path to cover.
