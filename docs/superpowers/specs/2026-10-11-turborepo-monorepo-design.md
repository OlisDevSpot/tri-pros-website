# Turborepo monorepo: web + shared backend + Expo

Status: design, not started. Grounded in an import-graph audit of `main` at `438f741` (2026-10-11).

## Goal

Turn the single Next.js app into a Turborepo where:

- `apps/web` is today's Next.js app (site, dashboard, funnels, route handlers).
- The non-Next building blocks (tRPC, Drizzle DB, auth, DAL, services, validators, enums) live in shared packages.
- A future `apps/mobile` (Expo) calls the same tRPC API with full type safety and reuses the same validators, enums, pure business logic and permissions.

## What the audit found

The server side is already well separated. The work is mostly moving files and fixing a short, known list of leaks.

| Measure | Count |
|---|---|
| Files in `src/` | 2,221 |
| Files reachable from the tRPC app router (server closure) | 580 |
| `'use client'` files in the server closure | 0 |
| Files reachable from all `'use client'` files (client closure) | 1,981 |
| Client-closure files that reach the DB client, `dal/server` or `server-env` | 0 |
| Files in **both** closures (the true isomorphic core) | 121 |
| `next/*` server APIs used in the server closure | 5 files |
| Server-closure files that live under `src/features/` | 19 |

The 121 shared files are: enums (25), company constants (16), proposal financials and schemas (16), pipeline config (7), entity schemas and constants, `lib/phone`, `lib/formatters`, `lib/business-time`, `config/roots`, CASL `abilities.ts`. Their only npm dependencies are `zod`, `@casl/ability`, plus three UI leaks (below). Nothing in them touches Node or the DOM, so they are React-Native safe once the leaks are fixed.

### Leaks that block a clean split

1. **tRPC context reads Next.** `src/trpc/lib/create-http-context.ts` calls `next/headers` and React `cache` even though the fetch adapter already passes `req`. The RSC context and `getCachedSession` are Next-only by nature.
2. **`next/cache` in server code.** `revalidateTag` in `trpc/routers/construction.router/index.ts`, `revalidatePath` in `trpc/routers/projects.router/crud.router.ts`, `unstable_cache` in `shared/modules/construction/service.ts`.
3. **Routers import from `src/features/`.** Analytics DAL and report builders (12 files), customer-pipelines DAL (2), agent-dashboard DAL (1), landing DAL (1), meeting-flow persona builder (2), proposal-flow form schema (1).
4. **UI packages in server/isomorphic code.** `lucide-react` icons in the five `domains/pipelines/constants/*-pipeline.ts` files, `react-icons` in `constants/company/socials.ts`, `nuqs/server` parsers in `dal/lib/query/filter-parser-registry.ts`.
5. **Server-only SQL helpers live in isomorphic-looking `lib/` folders.** 13 files such as `entities/*/lib/visibility.ts`, `customers/lib/derived-pipeline-sql.ts`, `lead-sources/lib/segment-sql.ts`, `domains/permissions/lib/validate-share-token.ts`, `features/landing/lib/get-trade-images.ts`.
6. **`db` and `auth` depend on everything through env.** `shared/db/index.ts` and `domains/auth/server.ts` import `config/server-env.ts`, which imports every provider's env fragment. A `db` package would therefore depend on all integrations.
7. **A client component imports seed data.** `features/proposal-flow/ui/components/proposal/related-projects.tsx` imports `db/seeds/data/projects.ts`. Seeds belong to `db`, so this data moves to `core` or the web app.
8. **Runtime reads relative to `process.cwd()`.** `lib/pdf/proposal-doc-definition.ts` reads the logo from `public/`, `domains/funnels/lib/og/og-assets.ts` reads fonts and photos, `services/meta-insights-sync.service.ts` reads `scripts/meta/meta.lock.json`. In a monorepo the package code and `public/` live in different folders.
9. **Provider tier imports services and DAL.** ⚠️ Stale ref: `docs/adr/0003-service-provider-architecture.md:66-68` says providers never import services or DAL, but the 20 qstash job handlers in `services/providers/upstash/jobs/` do, as do `providers/ai/client.ts`, `providers/quickbooks/lib/access-token-cache.ts` and `providers/zoho-sign/lib/documents/registry.ts`. This does not block the split if providers stay inside the `api` package. It does block a separate integrations package.

## Target layout

```
apps/
  web/                Next.js: app/, middleware, features/ (UI), shared/components, web hooks,
                      PWA, public/, route handlers (thin), RSC tRPC proxy, Next cache adapter
  mobile/             Expo (Phase 4)
packages/
  core/               @tripros/core: isomorphic, RN-safe. enums, company constants, zod schemas
                      (entity + JSONB + form), shared types, pure lib (phone, formatters,
                      business-time, proposal financials, pipeline compute), CASL abilities,
                      route builders. Deps: zod, @casl/ability, date-fns, libphonenumber-js.
  db/                 @tripros/db: Drizzle tables + drizzle-zod schemas, pool client, migrations,
                      seeds, drizzle.config, db scripts, its own env fragment. Deps: core.
  auth/               @tripros/auth: better-auth server instance, session types, shared client
                      plugin config. Deps: db, core.
  api/                @tripros/api: tRPC init, procedures, middleware, appRouter, framework-free
                      createContext({ headers }), DAL, services, providers, module services,
                      email templates, PDF, qstash job registry, server env.
                      Deps: auth, db, core.
tooling/
  typescript/         base, nextjs, library, expo tsconfigs
  eslint/             antfu base + project rules (lazy-only imports → api; theme tokens → web)
```

Dependency direction is strict and enforced by `package.json` dependencies: `core ← db ← auth ← api ← web`. Mobile depends on `core` at runtime and on `api` and `auth` for **types only**.

### Why these boundaries

- **One `core` package, not separate `validators`, `constants` and `utils`.** The 121 shared files are interlinked: schemas import enums, financials import schemas, the DB schema imports entity JSONB schemas. Splitting them creates packages that always change together. Use subpath exports instead (`@tripros/core/enums`, `@tripros/core/entities/customers/schemas`).
- **`auth` separate from `api`.** Mobile needs the auth server's inferred types for `better-auth` client plugins without pulling the whole router type graph into that file. It also mirrors the dependency that already exists (`api` reads sessions, `auth` never reads `api`).
- **`db` exports two entry points.** `@tripros/db` is the pool client and is server-only. `@tripros/db/schema` is table definitions and drizzle-zod schemas, which are plain JS and safe to type-import from mobile. Today every client file already imports the schema as types only.
- **Providers stay inside `api`.** A separate integrations package would make ADR-0003's rule a build error, which is attractive. It is gated on moving the qstash job handlers into the service tier first (leak 9). Do it later if wanted.
- **No `packages/ui` yet.** Web components are Radix plus Tailwind DOM and cannot run in React Native. A shared UI package only pays off with a second web app. A small `packages/tokens` (DESIGN.md colours and type ramp exported for Tailwind and NativeWind) is the one shared-design piece worth adding when mobile starts.
- **No shared React hooks package yet.** Of the 115 hook and client-DAL files, only 18 call tRPC without also touching Next, `nuqs`, `sonner`, `motion` or the DOM. Mobile writes its own hooks against the same `AppRouter`. Revisit once mobile has real screens and duplication is visible.
- **Entity folder names stay parallel.** `entities/customers` splits by tier: schemas and constants into `core/src/entities/customers`, DAL and SQL into `api/src/entities/customers`, components and hooks stay in `apps/web/src/shared/entities/customers`. Same name in every package keeps navigation predictable.

### Package mechanics

- **Just-in-time internal packages.** Packages export TypeScript source, with no build step. Next compiles them via `transpilePackages`; Metro compiles TS natively. Each package runs its own `tsc --noEmit`.
- **Imports.** Inside a package, use relative imports. Across packages, use `@tripros/<pkg>/<subpath>`. Only apps keep the `@/` alias. TS path aliases do not survive being compiled by another package's toolchain, so `@/` inside a package would resolve against the consuming app.
- **`exports` maps.** Wildcard subpath exports (`"./*": "./src/*.ts"`) do not resolve folder `index.ts` files. Pick one convention in Phase 1: explicit barrel entries, or no folder barrels across package lines.
- **`server-only`.** Keep it in `api`, `auth` and `db` server entries. Next resolves it correctly from packages. Scripts keep `--conditions=react-server`.
- **React versions.** No shared package may list `react` as a dependency. Use `peerDependencies` wherever React is touched (the email templates in `api`). Otherwise Next and Expo pull two Reacts into one graph.

## Mobile-specific requirements on the shared backend

These are server changes the Expo app needs. They belong in `api` and `auth` before `apps/mobile` exists.

1. **Auth.** Add the `@better-auth/expo` server plugin and the app scheme to `trustedOrigins` (plus `exp://` patterns for development). The Expo client stores the session cookie in SecureStore. The tRPC link sends it as a `Cookie` header from `authClient.getCookie()`. Google OAuth runs through the system browser and deep-links back, so the current offline Calendar and Drive scopes keep working.
2. **Context.** `createContext` must build the session from the incoming request headers only. This is leak 1, and it is what makes the same endpoint serve web and mobile.
3. **API host.** Keep tRPC hosted by `apps/web` on Vercel at `/api/trpc`. Mobile calls the absolute production URL. A standalone API server is not needed and can be extracted later because `api` will no longer import Next.
4. **Version skew.** A web deploy updates every browser at once. An installed mobile binary keeps calling the old procedure shapes until the user updates. Adopt a rule that procedures used by mobile only change additively, send an app-version header, and add a minimum-supported-version check. EAS Update covers JS-only fixes.
5. **Push.** `push_subscriptions` is Web Push (VAPID) only. Add a platform or kind column and an Expo push (or FCM/APNs) sender behind `notification.service`.
6. **Realtime.** Ably supports React Native. Confirm the token endpoint accepts the mobile session.
7. **Type-only imports from mobile.** `apps/mobile` imports `AppRouter` and the auth type with `import type` only. Add a lint rule that rejects value imports of `@tripros/api`, `@tripros/auth` and `@tripros/db` (root entry) from `apps/mobile`. Otherwise Metro tries to bundle `pg`, `twilio` and `sharp`.

## Migration plan

Each step ships independently and keeps production working. The key idea is **carve in place, then lift**: create `packages/*` folders inside today's single app, map `@tripros/*` with tsconfig paths, and move code into them while Next still builds one app. The Turborepo switch then becomes a mechanical move rather than a refactor.

### Phase 0: fix the leaks in the current app (about 5 PRs)

| PR | Change |
|---|---|
| 0.1 | `createHTTPTRPCContext` reads `req.headers`. The RSC context and `getCachedSession` stay web-only. |
| 0.2 | A small cache adapter (tag revalidation, path revalidation, cached function) replaces the three `next/cache` call sites. The web app provides the Next implementation. |
| 0.3 | Move the 19 server-closure files out of `src/features/` into `shared/` (DAL into `dal/server`, pure logic into `lib`, schemas into `schemas`). |
| 0.4 | Split pipeline config into data (labels, order, colours as tokens) and a web-only icon map. Same for socials. Move `nuqs` parsers out of `dal/lib/query` into a web-only file and keep the zod range schemas shared. |
| 0.5 | Move the 13 server-only SQL helpers from `lib/` into `dal/server`, so `lib/` means isomorphic everywhere. Give `db` and `auth` their own env fragments, the way providers already do. Pass asset bytes or an asset resolver to the PDF and OG code instead of reading `process.cwd()`. Move the seed data the proposal page imports. |

Optional, independent: move `providers/upstash/jobs/*` into the service tier and fix the other three provider files (leak 9).

### Phase 1: carve packages in place (4 PRs, one per package)

Order: `core`, `db`, `auth`, `api`. Each PR moves files with `git mv`, runs a ts-morph codemod that rewrites `@/shared/...` imports from a move map, and adds tsconfig paths `@tripros/<pkg>/* → packages/<pkg>/src/*`. An ESLint boundary rule enforces the dependency direction from the first PR: a package never imports `@/`, `core` imports no other package, and so on. `pnpm lint && pnpm tsc` plus a preview deploy validates each step.

### Phase 2: switch to Turborepo (1 PR, short freeze)

- Add `pnpm-workspace.yaml` and `turbo.json`, move the app into `apps/web`, add a `package.json` per package and split dependencies, and add `tooling/typescript` and `tooling/eslint`.
- **Vercel.** Set Root Directory to `apps/web` and allow files outside the root. Set `outputFileTracingRoot` to the repo root. Rewrite the `pdfkit` tracing globs to `../../node_modules/.pnpm/pdfkit@*/...`. `pdfkit` must remain a **direct** dependency of `apps/web` for `serverExternalPackages` to work, even though `pdfmake` moves to `api`.
- **`next.config.ts`** imports `roots.ts`, `hidden-trades` and funnel slugs. Node cannot load TS from a workspace package at config time, so keep those config-time constants importable from inside `apps/web`, or ship them as plain JS.
- **Env.** Turborepo 2 runs tasks in strict env mode: undeclared variables are hidden from tasks. Declare server variables in `turbo.json` (`env` or `globalPassThroughEnv`). Decide one `.env` location (repo root recommended) and make `server-env`, `drizzle.config.ts` and Next all load from it. `scripts/dispatch.sh` writes `.env` and `.env.local` per worktree and must follow.
- **Scripts.** DB scripts and migrations move with `packages/db` (`pnpm --filter @tripros/db db:push:dev`, or root aliases). Ops scripts move to `apps/web/scripts` or a `tooling/scripts` workspace. 54 scripts import `@/` and go through the same codemod.
- **Lint.** `next lint` is deprecated in Next 15.5 and removed in 16. Run the ESLint CLI per package via Turbo. Consolidate the two ESLint config files.
- **CI.** `turbo run lint typecheck build --filter=...[origin/main]` runs only affected packages.
- **Repo docs and tooling.** Update CLAUDE.md commands and paths, `components.json` (shadcn) paths, `.claude/` skills and the convention-auditor path references.

### Phase 3: server-side mobile readiness (2–3 PRs)

Items 1, 4, 5 and 6 from the mobile section: Expo auth plugin and trusted origins, version header and minimum-version gate, push platform column and sender, Ably token check.

### Phase 4: `apps/mobile`

Bootstrap with the current Expo SDK. SDK 54 and later support pnpm's isolated installs. If Metro loads two copies of `react-native`, fall back to `nodeLinker: hoisted`. That setting is workspace-wide, so test it against the web build. Wire `TRPCProvider` with `httpBatchLink`, `superjson` and the cookie header. Import `@tripros/core` for schemas, enums, financials and abilities.

## Open decisions

1. **Package scope.** `@tripros/*` is assumed.
2. **What mobile does first.** Agent field use (schedule, meetings, customer profile, meeting flow) is the likely start. It decides which hooks get duplicated and whether `packages/tokens` is needed on day one.
3. **Provider-tier cleanup.** Fix leak 9 now, which allows a separate integrations package, or leave providers inside `api`.
4. **Freeze window for Phase 2.** Every open branch conflicts with the move into `apps/web`. Land it when `pnpm dispatch` worktrees are drained.
