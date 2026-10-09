# ADR-0006: Dev runs on Turbopack; server SDKs stay unbundled; realtime lives in the meeting flow

## Status

Accepted (trial) — 2026-10-09. Owner chose to move dev to Turbopack carefully and watch
for breakage. Production builds are unchanged (`next build` is still webpack).

## Context

The dev server was slow to become usable after every start. Measured on the owner's
machine (Next 15.5.9, cold cache, same routes, same data):

| | Webpack (before) | Webpack + this ADR's config | Turbopack + this ADR's config |
|---|---|---|---|
| First `/dashboard` load | 44–50 s | 24 s | 9 s |
| First visit to all 48 pages | — | 8.1 min | 2.7 min |
| Peak dev-server memory | 8.0 GB | 6.9 GB | 5.8 GB |

The cause is graph size, not one slow page. Every dashboard page compiled ~10,000
modules: the RSC tRPC caller (`src/trpc/server.ts`) imports the whole app router, which
reaches every server SDK. Twilio alone was ~740 modules, the AWS presigner ~300, Ably's
Node build and its `got`/`keyv` chain more. The lazy `import()` seams from the PWA
cold-start work keep these out of production start-up, but a bundler still compiles a
lazily imported module in dev.

Turbopack was the dev bundler until 2025-12-10, when it was removed after an
unexplained error. The app then wrapped its config in Payload CMS's `withPayload`, which
customises webpack. Turbopack ignores webpack config: on that commit it warns
"Webpack is configured while Turbopack is not". The public homepage still compiled there,
so the failure was most likely in Payload's admin. Payload was removed on 2026-03-15.
That reason no longer applies.

Three things blocked Turbopack on 2026-10-09. All three were also bugs or waste under
webpack:

1. **Escaped quotes in shadcn class strings.** ESLint's quote rule rewrote the shadcn
   CLI's `"[&_svg:not([class*='size-'])]:size-4"` into `'…[class*=\'size-\']…'`. Tailwind
   reads classes from raw source text, so the backslash became part of the selector.
   Webpack emitted rules that matched nothing: seven utilities were dead, including the
   muted icon colour in menus and selects and four chart strokes. Turbopack refused to
   parse the CSS at all.
2. **Ably in the root providers.** Every page, including the public site, downloaded Ably
   and opened a WebSocket for every visitor, though only the meeting flow subscribes.
   Server rendering also pulled Ably's Node build, whose optional `keyv` require Turbopack
   cannot resolve under pnpm.
3. **Server SDKs bundled.** See above.

## Decision

- **`pnpm dev` runs `next dev --turbopack`** (`scripts/dev.mjs`). `pnpm dev --webpack` is
  the one-step fallback. Production keeps webpack until Next makes Turbopack builds the
  default and we have checked them.
- **Server-only SDKs are `serverExternalPackages`** (`next.config.ts`): `ably`, `twilio`,
  `pdf-lib`, `@aws-sdk/s3-request-presigner`, `web-push`, next to `pdfkit`. Each must be
  a direct dependency (pnpm). A package that renders React must never be external,
  because an external require loads a second React. So `resend` stays bundled: it renders
  the email templates.
- **Realtime is browser-only and lives in the meeting flow.** The flow loads
  `MeetingRealtimeSync` with `next/dynamic` `ssr: false`. No other page loads Ably.
- **Class strings never escape quotes.** `style/quotes` allows double quotes when they
  avoid an escape (`eslint.config.js`).
- **`prettier` and `postcss` are `transpilePackages`.** Next lists both as external by
  default, but under pnpm they are only transitive, so neither bundler can externalize
  them. Webpack bundled them silently; Turbopack warned on every compile.
- **`outputFileTracingRoot` and `turbopack.root` are this checkout.** Dispatch worktrees
  live inside it, so Next otherwise sees two lockfiles and picks the outer checkout.

## Consequences

- Dev and production now use different bundlers. A bug that only appears under one of
  them is possible. When something looks wrong in dev, re-check with `pnpm dev --webpack`
  before debugging the code. A Turbopack-only bug does not reach production, but record
  it here.
- Before each production push, the release candidate is still built with webpack
  (`/pre-ship`), so production regressions are caught where they ship.
- Turbopack in Next 15.5 keeps no compile cache between restarts. A restart costs a cold
  start, which is still faster than webpack's cached restart (~88 s for the measured
  routes).
- The meeting flow's realtime status starts as `connecting` until the client chunk loads.
- **Exit criteria for the trial:** keep Turbopack if two weeks pass without a
  Turbopack-only defect that costs real time. Otherwise set `pnpm dev` back to webpack and
  keep the rest of this ADR, which helps webpack too.

## Also changed with this record

Found in the same investigation, each fixed at its source:

- The script font (`--font-script`, Dancing Script) had no Tailwind theme entry, so
  `font-script` generated nothing. The About page quote now renders in it, as DESIGN.md
  intends. Nunito (body) and Syne (headings) were already correct.
- `sslmode=require` in the database URLs triggered a `pg` deprecation warning. Local
  `.env` now uses `sslmode=verify-full`, which is today's behaviour. Neon's certificate
  passes full verification. Vercel's `DATABASE_URL` values need the same change by hand.
- The Notion catalog's "dropped N of M rows" warning counted disabled trades. It now
  counts only invalid rows.
- The provider checklist printed every time a route compiled, and again from each of
  Next's dev worker processes. `src/instrumentation.ts` now prints it once per server
  start.
- The About page's team headshots pointed at `/company-info/`, a folder moved to
  `/company/employees/` on 2025-12-06. Four photos had been broken since.
- Next's dev log printed every tRPC batch with its whole JSON input. Those lines are
  filtered, and a dev-only tRPC middleware logs one line per procedure with its duration.
