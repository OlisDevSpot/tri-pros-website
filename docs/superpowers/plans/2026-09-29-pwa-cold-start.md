# PWA Cold Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the installed-PWA cold launch of `/dashboard` from ≈ 5–7 s toward ≤ 1.5 s by shrinking what a cold function compiles, letting the shell stream before the session, and making the first HTML visible and data-bearing before JavaScript.

**Architecture:** Phase 1 (server) loads heavy provider SDKs on first use instead of at boot (guarded by a lint rule), reads the session once per request, and streams the dashboard shell before the session resolves. Phase 2 (client) replaces the JS-driven page fade with CSS, makes the home modules suspend so data streams in the HTML, seeds permissions from the server session, and keeps Ably inside meeting-flow. Each phase ships to production and is measured before the next; paid tiers are decided only after both (Phase 3).

**Tech Stack:** Next.js 15.5.9 (App Router, webpack build), React 19, tRPC 11 + TanStack Query 5, better-auth 1.6, drizzle + `pg`, Tailwind v4 + `tw-animate-css`, ESLint (antfu flat config), pnpm.

**Spec:** `docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md`

## Execution amendments (2026-09-30)

Rulings made while executing this plan; the task text below still shows the earlier shape.

- Task 4 kept `resendClient` as an object whose `emails.send` loads the SDK lazily — there is no `getResendClient`.
- Task 7 replaced the `ably` export with `realtimeClient.publish(channel, event, data)` — there is no `publishRealtime`.
- Task 8's guard is the core `no-restricted-imports` aliased as `lazy-only/imports`, not `ts/no-restricted-imports`.
- Task 10 wraps the sidebar slot in `SidebarSessionBoundary` (fixes a phone-width hydration mismatch) and did not add the two app-shell.md "Critical rules" bullets.
- Phase 1 tasks 1–10 are done (commits `1f1ee4aa`…`4b6c1845`), not yet pushed.
- Task 15 Steps 1–2 done 2026-10-09 on the owner's go-ahead, ahead of the other Phase 2 tasks and in a different shape: `RealtimeProvider` is deleted, and the meeting flow loads `MeetingRealtimeSync` (`ui/components/realtime/`) with `next/dynamic` `ssr: false`, which reports the connection status back to the view. Ably's Node build must stay out of server rendering (Turbopack cannot bundle it, and `ably` is now in `serverExternalPackages`). Step 4 (`pnpm remove next-pwa`) is still open.
- Phase 2 amendments already decided: no new frontend-stack.md paragraph in Task 12; section titles stay inline literals in Task 13; Playwright checks select the page's inner `main main` (the sidebar inset is the outer `<main>`).
- Phase 2 is blocked on four owner decisions: the proposal-card relative-time hydration fix (shared `overview-card.tsx`), a session keep-alive after Task 14 removes the client `useSession()`, whether the snapshot strip may become all-or-nothing, and accepting the extended views-own-data-fetching drift.

## Global Constraints

- **No paid tiers.** No Vercel or Neon plan change until Phase 3 (spec §7).
- **Phase gates.** Each phase ships to production and is measured (spec §4.1) before the next phase starts.
- **No route-level `loading.tsx`** anywhere under `src/app/(frontend)/dashboard`.
- **Out of scope:** service-worker changes, Next 16 / `cacheComponents`, DB driver change, better-auth `cookieCache.maxAge`, prefetching the detail pages.
- **Comments say why, never what,** and never cite the spec, this plan, tasks or docs (CLAUDE.md).
- **Git on the owner's workbench (`main`):** stage new files with `git add -- <path>`, commit with `git commit -F - -- <paths>` (explicit paths). Never a plain `git commit`, `git add -A`, `commit -a`, `stash`, `reset`, `checkout .` or `clean` in the main tree — the owner's index holds staged work (`D scripts/snapshot-prod-to-dev.ts`) and `package.json` has their uncommitted edit.
- **Commit trailer:** every commit message ends with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- **Verification:** `pnpm tsc` and `pnpm lint` (use `CI=1 npx eslint --fix <files>` for scoped fixes — never repo-wide `lint:fix`). Never `pnpm build` in the main tree; the isolated `.worktrees/perf-profile` build is the one approved exception.
- **No test data writes.** No DB writes, emails, SMS or uploads to verify anything. Browser checks use the Playwright MCP authenticated through `http://localhost:3000/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>` (add `&role=homeowner` / `&redirect=/dashboard` as needed). The dev server on :3000 is the owner's; do not restart it or touch its `.next`.
- **Pushing `main` to `origin` deploys production.** The owner confirms every push.
- **Phase 1 local target (spec §1):** `/dashboard` ≤ 6 MB minified server JS and ≤ 0.6 s cold first request, measured with the Task 1 tools (baseline 11.0 MB, ≈ 1.1 s).
- **The repo has no unit-test runner.** Checks are `tsc`, `lint`, the Task 1 measurement and smoke scripts, and Playwright browser checks. Do not add a test framework.

## Review Focus

1. **A modal opened through `GlobalDialogs` on the dashboard keeps its permission-gated actions** (e.g. the customer profile modal from a proposal card's customer link shows its edit actions for an admin). Owner: Task 14, Step 7.
2. **A present-but-stale session cookie** shows the sign-in screen with no sidebar and no mobile nav, and never crashes; with no cookie at all the sign-in screen renders immediately with no skeletons. Owner: Task 10, Step 8.
3. **A signed-in non-internal user** (`role=homeowner`) who opens `/dashboard` still ends on `/`. Owner: Task 10, Step 8.
4. **In-app navigation never flashes a skeleton when data is cached:** moving Customers → Dashboard home in one tab shows neither the layout content skeleton nor a section skeleton. Owner: Task 10, Step 8 and Task 13, Step 9.
5. **Without the JS bundle, the dashboard home is visible and carries real data** (block `/_next/static/chunks/**`: main area opacity 1, proposal/project rows or their empty-state text present); with reduced motion, content shows with no animation. Owner: Task 12, Step 6 and Task 13, Step 9.

---

## File map

| File | Change | Task |
|---|---|---|
| `.worktrees/perf-tools/*` (gitignored) | measurement + smoke scripts | 1 |
| `src/trpc/lib/create-http-context.ts`, `src/shared/domains/auth/lib/get-cached-session.ts`, `src/trpc/DOCS.md` | RSC context reuses the session memo | 2 |
| `src/shared/config/lazy-async.ts` (new) | memoize an async factory, retry on rejection | 3 |
| `src/shared/services/providers/twilio/client.ts` | REST client lazy; helpers from twilio sub-modules | 3 |
| `src/shared/services/providers/resend/client.ts`, `src/shared/services/email.service.ts` | Resend + templates lazy | 4 |
| `src/shared/lib/pdf/render-pdf.ts`, `…/count-pdf-pages.ts`, `src/shared/lib/file-optimization/strategies/pdf.ts`, `src/shared/modules/media/core/lib/process-image-variants.ts` | pdfmake, pdf-lib, sharp lazy | 5 |
| `src/shared/services/providers/ai/client.ts`, `src/shared/services/providers/r2/client.ts` | AI SDK, S3 SDK lazy | 6 |
| `src/shared/services/providers/upstash/realtime.ts`, `src/trpc/routers/meeting-flow.router.ts`, `src/shared/entities/meetings/dal/server/crud.ts`, `src/shared/entities/customers/dal/server/crud.ts` | `publishRealtime()`, Ably REST lazy | 7 |
| `eslint.config.js` | lazy-only import guard | 8 |
| `src/app/(frontend)/dashboard/layout.tsx` + 5 new components in `src/features/agent-dashboard/ui/components/`, `docs/codebase-conventions/app-shell.md` | shell streams before session | 10 |
| `src/app/(frontend)/dashboard/template.tsx`, `src/shared/components/records-page-motion-shell.tsx`, `src/features/schedule-management/ui/views/schedule-view.tsx`, `src/features/meeting-flow/ui/components/meeting-splash-mount.tsx`, `docs/codebase-conventions/{app-shell,frontend-stack}.md` | CSS entrance fades | 12 |
| `src/features/agent-dashboard/ui/components/dashboard-{hero,snapshot-strip,snapshot-chips,section-skeleton,proposals,proposal-section,projects,project-section}.tsx` | home modules suspend | 13 |
| `src/shared/components/providers/{casl-provider,session-ability-provider,index}.tsx`, `dashboard-session-content.tsx`, dashboard + proposal-flow + (site) layouts | server-seeded ability | 14 |
| `src/shared/components/providers/index.tsx`, `src/features/meeting-flow/ui/views/meeting-flow.tsx`, `package.json`, `pnpm-lock.yaml` | Ably client in meeting-flow; drop `next-pwa` | 15 |

---

## Phase 0 — measure

### Task 1: Measurement tools, baseline, commit the design docs

**Files:**
- Create: `.worktrees/perf-tools/rebuild-profile.sh`, `.worktrees/perf-tools/bytes.mjs`, `.worktrees/perf-tools/measure-local.mjs`, `.worktrees/perf-tools/measure-prod.sh`, `.worktrees/perf-tools/smoke-lazy-seams.ts` (all gitignored — `.worktrees/` is in `.gitignore`)
- Modify: `docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md` (§10 measurements)
- Commit: the spec and this plan

**Interfaces:**
- Produces: `bash .worktrees/perf-tools/rebuild-profile.sh <ref>` (run from repo root) — rebuilds `.worktrees/perf-profile` at `<ref>`; `node ../perf-tools/bytes.mjs` and `node ../perf-tools/measure-local.mjs [runs]` (run from `.worktrees/perf-profile`); `bash .worktrees/perf-tools/measure-prod.sh [cookie-file]`; `NODE_OPTIONS="--conditions=react-server" pnpm -s tsx .worktrees/perf-tools/smoke-lazy-seams.ts [--network]` (repo root). The smoke script imports `publishRealtime` (Task 7) and `getResendClient` (Task 4); it is first run in Task 8.

- [ ] **Step 1: Write `rebuild-profile.sh`**

```bash
#!/usr/bin/env bash
# Rebuilds the isolated perf-profile worktree at a git ref with two
# measurement-only next.config edits (never committed): named server module ids
# so bytes can be attributed to packages, and no entry preloading so each
# route's first request shows its own load cost. Run from the repo root.
set -euo pipefail
ROOT="$(git rev-parse --show-toplevel)"
WT="$ROOT/.worktrees/perf-profile"
REF="${1:-main}"
if [ ! -d "$WT" ]; then
  git -C "$ROOT" worktree add --detach "$WT" "$REF"
  ln -s ../../.env "$WT/.env"
  if [ -f "$ROOT/.env.local" ]; then ln -s ../../.env.local "$WT/.env.local"; fi
fi
git -C "$WT" checkout -- next.config.ts
git -C "$WT" checkout --detach "$REF"
python3 - "$WT/next.config.ts" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
marker = "const nextConfig: NextConfig = {"
assert marker in s, "next.config.ts shape changed: update rebuild-profile.sh"
assert "experimental:" not in s and "webpack:" not in s, "next.config.ts now sets experimental/webpack: merge by hand"
s = s.replace(marker, marker + """
  experimental: { preloadEntriesOnStart: false },
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.optimization.moduleIds = 'named'
    }
    return config
  },""", 1)
open(p, 'w').write(s)
PY
cd "$WT"
pnpm install --frozen-lockfile --prefer-offline > /dev/null
rm -rf "$WT/.next"
CI=1 NEXT_TELEMETRY_DISABLED=1 pnpm next build > "$ROOT/.worktrees/perf-tools/last-build.log" 2>&1 || { tail -40 "$ROOT/.worktrees/perf-tools/last-build.log"; exit 1; }
echo "perf-profile built at $(git -C "$WT" rev-parse --short HEAD)"
```

- [ ] **Step 2: Write `bytes.mjs`**

```js
// Minified server JS per route, attributed to packages, plus the server
// externals each route require()s at boot and whether Ably reaches the
// dashboard's client chunks. Run from .worktrees/perf-profile after a build.
import fs from 'node:fs'
import { builtinModules } from 'node:module'

const TOP = Number(process.argv[2] ?? 15)
const ROUTES = {
  '/dashboard': '.next/server/app/(frontend)/dashboard/page.js',
  '/api/trpc': '.next/server/app/api/trpc/[trpc]/route.js',
  '/api/auth': '.next/server/app/api/auth/[...all]/route.js',
}
const BUILTINS = new Set(builtinModules.flatMap(m => [m, `node:${m}`]))
const kb = n => `${(n / 1024).toFixed(0).padStart(6)} KB`
const bucket = (id) => {
  const nm = id.lastIndexOf('node_modules/')
  if (nm !== -1) {
    const r = id.slice(nm + 13).split('/')
    return r[0].startsWith('@') ? `${r[0]}/${r[1]}` : r[0]
  }
  return id.includes('/src/') ? 'app:src' : 'other'
}

for (const [route, entry] of Object.entries(ROUTES)) {
  const ids = fs.readFileSync(entry, 'utf8').match(/\.X\(0,\[([0-9,]+)\]/)?.[1].split(',') ?? []
  const files = [entry, ...ids.map(id => `.next/server/chunks/${id}.js`)].filter(f => fs.existsSync(f))
  const totals = new Map()
  const externals = new Set()
  let all = 0
  for (const f of files) {
    const x = fs.readFileSync(f, 'utf8')
    all += x.length
    const re = /"(\([a-z-]+\)\/\.\/[^"]+)":(?:\(|function|async)/g
    let prev = null
    let prevIdx = 0
    let m
    while ((m = re.exec(x))) {
      if (prev)
        totals.set(bucket(prev), (totals.get(bucket(prev)) ?? 0) + m.index - prevIdx)
      prev = m[1]
      prevIdx = m.index
    }
    if (prev)
      totals.set(bucket(prev), (totals.get(bucket(prev)) ?? 0) + x.length - prevIdx)
    for (const r of x.matchAll(/require\("([^"./][^"]*)"\)/g)) {
      if (!BUILTINS.has(r[1]) && !r[1].startsWith('next/'))
        externals.add(r[1])
    }
  }
  console.log(`\n${route}: ${(all / 1024 / 1024).toFixed(1)} MB in ${files.length} files`)
  for (const [k, v] of [...totals].sort((a, b) => b[1] - a[1]).slice(0, TOP))
    console.log(`${kb(v)}  ${k}`)
  // Presence only: a lazily imported external keeps a require() stub that runs when the import() does.
  console.log(`externals referenced: ${[...externals].sort().join(', ') || 'none'}`)
}

const pages = JSON.parse(fs.readFileSync('.next/app-build-manifest.json', 'utf8')).pages
const clientChunks = [...new Set(['/(frontend)/layout', '/(frontend)/dashboard/layout', '/(frontend)/dashboard/page'].flatMap(k => pages[k] ?? []))]
const ablyChunks = clientChunks.filter(f => fs.existsSync(`.next/${f}`) && fs.readFileSync(`.next/${f}`, 'utf8').includes('ably.net'))
console.log(`\ndashboard client chunks containing Ably: ${ablyChunks.length}`)
```

- [ ] **Step 3: Write `measure-local.mjs`**

```js
// Cold (first) and warm (second) request per route, each on a fresh
// `next start` of the perf-profile build. Run from .worktrees/perf-profile.
import { spawn } from 'node:child_process'

const PORT = 3999
const RUNS = Number(process.argv[2] ?? 2)
const ROUTES = ['/dashboard', '/api/trpc/healthcheck', '/api/auth/get-session']
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function waitReady() {
  for (let i = 0; i < 300; i++) {
    const up = await fetch(`http://127.0.0.1:${PORT}/manifest.webmanifest`, { method: 'HEAD' }).then(() => true, () => false)
    if (up)
      return
    await sleep(100)
  }
  throw new Error('next start never came up')
}

async function ttfb(path) {
  const t0 = performance.now()
  const res = await fetch(`http://127.0.0.1:${PORT}${path}`, { redirect: 'manual' })
  const ms = Math.round(performance.now() - t0)
  await res.arrayBuffer()
  return ms
}

for (const route of ROUTES) {
  const cold = []
  const warm = []
  for (let i = 0; i < RUNS; i++) {
    const child = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
      env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
      stdio: 'ignore',
    })
    try {
      await waitReady()
      cold.push(await ttfb(route))
      warm.push(await ttfb(route))
    }
    finally {
      child.kill('SIGINT')
      await new Promise(r => child.on('exit', r))
    }
  }
  console.log(`${route.padEnd(26)} cold ${cold.join(' / ')} ms   warm ${warm.join(' / ')} ms`)
}
```

- [ ] **Step 4: Write `measure-prod.sh`**

```bash
#!/usr/bin/env bash
# Production TTFB: cold is only cold right after a deploy (functions) or after
# >= 20 min without traffic (functions + Neon). Pass a file holding the owner's
# better-auth cookie header value to add the signed-in /dashboard reading.
set -uo pipefail
BASE=https://www.triprosremodeling.com
t() { curl -s -o /dev/null -w '%{time_starttransfer}' "$@"; }
for path in /dashboard /api/auth/get-session /api/trpc/healthcheck; do
  cold=$(t "$BASE$path"); warm=$(t "$BASE$path")
  region=$(curl -s -o /dev/null -D - "$BASE$path" | grep -i '^x-vercel-id' | tr -d '\r' | cut -d' ' -f2)
  printf '%-24s cold %ss  warm %ss  %s\n' "$path" "$cold" "$warm" "$region"
done
if [ -n "${1:-}" ]; then
  cookie=$(cat "$1")
  cold=$(t -H "cookie: $cookie" "$BASE/dashboard"); warm=$(t -H "cookie: $cookie" "$BASE/dashboard")
  printf '%-24s cold %ss  warm %ss\n' "/dashboard (signed in)" "$cold" "$warm"
fi
```

- [ ] **Step 5: Write `smoke-lazy-seams.ts`**

```ts
// Calls each lazily loaded provider SDK's first-use path with no side effects:
// no email, SMS, upload or DB write. `--network` adds one Twilio GET for a
// non-existent call SID (expects a 404 RestException) and one Ably publish to a
// scratch channel with no subscribers. Run from the repo root:
//   NODE_OPTIONS="--conditions=react-server" pnpm -s tsx .worktrees/perf-tools/smoke-lazy-seams.ts [--network]
import '../../scripts/lib/load-env'

import { readFile } from 'node:fs/promises'
import process from 'node:process'
import * as React from 'react'

import { readPdfPageCount } from '@/shared/lib/file-optimization/strategies/pdf'
import { countPdfPages } from '@/shared/lib/pdf/count-pdf-pages'
import { renderPdf } from '@/shared/lib/pdf/render-pdf'
import { processImageVariants } from '@/shared/modules/media/core/lib/process-image-variants'
import { r2Client } from '@/shared/services/providers/r2/client'
import { R2_BUCKETS } from '@/shared/services/providers/r2/types'
import { getResendClient } from '@/shared/services/providers/resend/client'
import { RestException, twilioClient } from '@/shared/services/providers/twilio/client'
import { publishRealtime } from '@/shared/services/providers/upstash/realtime'

// tsx compiles the email templates' JSX in classic mode (React.createElement).
Object.assign(globalThis, { React })

const network = process.argv.includes('--network')
const lines: string[] = []

async function check(name: string, run: () => Promise<string>) {
  try {
    lines.push(`PASS ${name}: ${await run()}`)
  }
  catch (error) {
    lines.push(`FAIL ${name}: ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}

await check('pdfmake render + pdf-lib count', async () => {
  const pdf = await renderPdf({ content: ['Smoke test'] })
  const pages = await countPdfPages(pdf)
  const pagesAgain = await readPdfPageCount(pdf)
  if (pages !== 1 || pagesAgain !== 1)
    throw new Error(`expected 1 page, got ${pages} / ${pagesAgain}`)
  return `${pdf.byteLength} bytes, 1 page`
})

await check('sharp variants', async () => {
  const image = await readFile('public/company/logo/logo-light-512.png')
  const result = await processImageVariants(image)
  if (!result.blurDataUrl.startsWith('data:image/webp;base64,'))
    throw new Error('no blur placeholder')
  return `blur ok, variants [${result.variantSuffixes.join(',')}]`
})

await check('twilio helpers (local)', async () => {
  const xml = twilioClient.buildDialTwiml({ to: '+15555550100', callerId: '+15555550101' })
  if (!xml.includes('<Dial'))
    throw new Error(xml)
  if (twilioClient.verifyWebhookSignature({ url: 'https://example.com/hook', signature: 'bogus', params: {} }))
    throw new Error('bogus signature accepted')
  const jwt = twilioClient.mintVoiceAccessToken({ identity: 'smoke-test' })
  if (jwt.split('.').length !== 3)
    throw new Error('malformed access token')
  return 'TwiML built, bogus signature rejected, access token minted'
})

await check('r2 presigned URL (local signing)', async () => {
  const url = await r2Client.getPresignedDownloadUrl({ bucket: R2_BUCKETS.media, pathKey: 'smoke/none.txt', expiresIn: 60 })
  if (!url.includes('X-Amz-Signature'))
    throw new Error(url)
  return 'signed'
})

await check('resend client + template element (nothing sent)', async () => {
  const resend = await getResendClient()
  const { renderProposalEmail } = await import('@/shared/services/providers/resend/lib/render-emails')
  const element = renderProposalEmail({ proposalUrl: 'https://example.com', customerName: 'Smoke Test' })
  if (typeof resend.emails.send !== 'function' || !element)
    throw new Error('client or template missing')
  return 'constructed'
})

if (network) {
  await check('twilio REST (GET non-existent call → 404)', async () => {
    try {
      await twilioClient.fetchCall('CA00000000000000000000000000000000')
    }
    catch (error) {
      if (error instanceof RestException)
        return `RestException ${error.status}`
      throw error
    }
    throw new Error('expected a RestException')
  })
  await check('ably REST publish (scratch channel)', async () => {
    await publishRealtime('smoke:lazy-seams', 'smoke', { at: Date.now() })
    return 'published'
  })
}

console.log(lines.join('\n'))
```

- [ ] **Step 6: Rebuild the profile at `HEAD` and confirm the baseline reproduces**

Run (repo root): `bash .worktrees/perf-tools/rebuild-profile.sh HEAD`
Then (from `.worktrees/perf-profile`): `node ../perf-tools/bytes.mjs 8 && node ../perf-tools/measure-local.mjs 2`
Expected: `/dashboard: 11.0 MB`, `twilio` ≈ 3,439 KB at the top, externals include `@aws-sdk/client-s3, pdfkit, sharp`, `dashboard client chunks containing Ably: 1`; `/dashboard cold` ≈ 1,100 ms. If the numbers differ by more than 15 %, stop and report — the spec's §4.3 baseline would be stale.

- [ ] **Step 7: Owner baseline (production) — STOP and hand to the owner**

Ask the owner to:
1. Copy the production cookie header value for their signed-in session (DevTools → Application → Cookies → `__Secure-better-auth.session_token` and `__Secure-better-auth.session_data`, formatted as `name=value; name=value`) into `.worktrees/perf-tools/prod-cookie.txt`.
2. After ≥ 20 min with nobody using the app, run `bash .worktrees/perf-tools/measure-prod.sh .worktrees/perf-tools/prod-cookie.txt`.
3. On the phone: three cold launches (≥ 20 min idle each) and three warm, timing tap → real dashboard data.
4. Vercel → Observability: note the cold-start rate and startup duration of the dashboard and `/api/*` functions.
5. Vercel logs: search for `triprosremodeling.com/dashboard` 307s on the apex host. If present, reinstall the PWA from `https://www.triprosremodeling.com/dashboard`.

Record the results as a new row in the spec's §10 Measurements table ("2026-MM-DD owner baseline") and set "Phase 0 — §4.1 baseline" to ✅.

- [ ] **Step 8: Commit the spec and this plan**

```bash
git add -- docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md docs/superpowers/plans/2026-09-29-pwa-cold-start.md
git commit -F - -- docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md docs/superpowers/plans/2026-09-29-pwa-cold-start.md <<'MSG'
docs(pwa): cold-start design and plan, grounded in a measured boot profile

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

---

## Phase 1 — server code

### Task 2: One session read per request

**Files:**
- Modify: `src/trpc/lib/create-http-context.ts`
- Modify: `src/shared/domains/auth/lib/get-cached-session.ts`
- Modify: `src/trpc/DOCS.md` (`### rsc-prefetch-uses-rsc-context`)

**Interfaces:**
- Consumes: `getCachedSession(): Promise<Session | null>` (existing, React `cache()` memo).
- Produces: `createRSCTRPCContext` with an unchanged signature and return type (`HTTPTRPCContext`).

- [ ] **Step 1: Rewrite the RSC half of `create-http-context.ts`**

Replace the whole file with:

```ts
// ─── createHTTPTRPCContext ───────────────────────────────────────────────────
// Factory for the HTTP adapter context. Resolves the session from request
// headers; ability + scope start null (narrowed by procedure middleware).

import type { HTTPTRPCContext } from '@/trpc/types'

import { headers as getHeaders } from 'next/headers'
import { cache } from 'react'

import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'
import { auth } from '@/shared/domains/auth/server'

export const createHTTPTRPCContext = cache(async (ctx: { req?: Request, resHeaders: Headers }): Promise<HTTPTRPCContext> => {
  const reqHeaders = await getHeaders()

  const session = await auth.api.getSession({
    headers: reqHeaders,
  })

  return {
    session,
    ability: null,
    scope: null,
    req: ctx.req,
    resHeaders: ctx.resHeaders,
  }
})

// ─── createRSCTRPCContext ────────────────────────────────────────────────────
// Context for server-component prefetching via the options proxy in
// `src/trpc/server.ts`. It takes the session from getCachedSession, the request
// memo the dashboard layout and protectDashboardPage already filled, so a
// prefetching page reads the session once instead of twice in sequence before
// its first query starts. There is no adapter Request: `req` stays undefined,
// which is safe because shareable-token procedures pull `token` out of the
// procedure input via `getRawInput()` (shareable-middleware.ts), never `req`.
export const createRSCTRPCContext = cache(async (): Promise<HTTPTRPCContext> => ({
  session: await getCachedSession(),
  ability: null,
  scope: null,
  req: undefined,
  resHeaders: new Headers(),
}))
```

- [ ] **Step 2: Update the `get-cached-session.ts` comment**

Replace the comment paragraph

```ts
// This is the canonical way to read the session inside a dashboard RSC render.
// (The tRPC HTTP context resolves the session via its own cache() in
// create-http-context.ts — a separate memo that only fires on prefetching
// pages; consolidating the two is a possible follow-up.)
```

with

```ts
// This is the canonical way to read the session inside a dashboard RSC render.
// The tRPC RSC prefetch context (create-http-context.ts) reads through this
// memo too, so a prefetching page makes one session round-trip in total.
```

- [ ] **Step 3: Update `src/trpc/DOCS.md#rsc-prefetch-uses-rsc-context`**

Replace the first paragraph's opening sentence

```
`src/trpc/server.ts`'s options proxy resolves its context via `createRSCTRPCContext` (`src/trpc/lib/create-http-context.ts`) — the SAME session resolution as the HTTP adapter (headers from `next/headers`), React-`cache()`'d per request.
```

with

```
`src/trpc/server.ts`'s options proxy resolves its context via `createRSCTRPCContext` (`src/trpc/lib/create-http-context.ts`), which takes the session from `getCachedSession()` — the same request memo the dashboard layout and `protectDashboardPage()` use, so a prefetching page reads the session once.
```

Leave the rest of the section as is.

- [ ] **Step 4: Type-check and lint the touched files**

Run: `pnpm tsc && CI=1 npx eslint --fix src/trpc/lib/create-http-context.ts src/shared/domains/auth/lib/get-cached-session.ts`
Expected: no errors.

- [ ] **Step 5: Browser check — prefetch is still authorized**

With Playwright: authenticate (`/api/dev/playwright-session?secret=…&redirect=/dashboard`), wait for the dashboard. Expected: the Proposals and Projects modules show rows or their empty-state text ("None out for signature", "No active projects"), not "Something went wrong"; the snapshot strip shows numbers, not "—". Take a screenshot for the record.

- [ ] **Step 6: Commit**

```bash
git commit -F - -- src/trpc/lib/create-http-context.ts src/shared/domains/auth/lib/get-cached-session.ts src/trpc/DOCS.md <<'MSG'
perf(trpc): server prefetches read the session through the request memo, once per page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 3: `lazyAsync` + twilio loads its REST client on first use

**Files:**
- Create: `src/shared/config/lazy-async.ts`
- Modify: `src/shared/services/providers/twilio/client.ts` (whole file)

**Interfaces:**
- Produces: `lazyAsync<T>(factory: () => Promise<T>): () => Promise<T>` in `@/shared/config/lazy-async` — used by Tasks 4, 5, 6, 7.
- Produces: `twilioClient` with every method name and signature unchanged; `RestException` still exported as a class; `TwilioClient` type unchanged.

- [ ] **Step 1: Create `src/shared/config/lazy-async.ts`**

```ts
/**
 * Memoize an async factory: the first call starts it and later calls share the
 * same promise. A rejection is not cached, so the next call retries — the same
 * recovery `lazyProxy` has when its factory throws.
 *
 * Use case: provider SDKs loaded with `import()` on first use. A static import
 * puts the SDK in the server bundle of every route that imports the tRPC app
 * router, and a cold start compiles all of it; `import()` gets its own chunk,
 * read only when called.
 */
export function lazyAsync<T>(factory: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined
  return () => {
    pending ??= factory().catch((error: unknown) => {
      pending = undefined
      throw error
    })
    return pending
  }
}
```

- [ ] **Step 2: Replace `src/shared/services/providers/twilio/client.ts`**

```ts
import type { Twilio } from 'twilio'
import type { CallInstance, CallListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/call'
import type { IncomingPhoneNumberInstance, IncomingPhoneNumberListInstanceOptions } from 'twilio/lib/rest/api/v2010/account/incomingPhoneNumber'
import type { MessageInstance, MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message'

import type { MintVoiceAccessTokenInput } from './schemas/access-token'

import RestException from 'twilio/lib/base/RestException'
import AccessToken from 'twilio/lib/jwt/AccessToken'
import MessagingResponse from 'twilio/lib/twiml/MessagingResponse'
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse'
import { validateRequest } from 'twilio/lib/webhooks/webhooks'

import { lazyAsync } from '@/shared/config/lazy-async'

import { ACCESS_TOKEN_TTL_SECONDS, INBOUND_VOICE_TTS_VOICE } from './constants'
import { getTwilioConfig } from './lib/config'

// Leaf provider: primitives + SDK types in and out — no domain types, DB writes, or business rules (those live in services/voip/*).

export interface PhoneLookupResult {
  valid: boolean
  lineType: string | null
  carrierName: string | null
  errorCode: number | null
}

interface BuildInboundVoiceTwimlInput {
  greeting?: string
  dialTarget?: string
  // Twilio defaults the bridged leg's caller-ID to the original `To`; set it explicitly when bridging from a shared DID.
  callerId?: string
  dialStatusCallbackUrl?: string
}

interface BuildDialTwimlInput {
  to: string
  callerId: string
  statusCallbackUrl?: string
  record?: boolean
}

interface BuildInboundMessagingTwimlInput {
  replyBody?: string
}

interface VerifyWebhookSignatureInput {
  // Must match the URL Twilio was configured with EXACTLY, query string included — a trailing-slash or missing-query mismatch fails validation.
  url: string
  // Value of the X-Twilio-Signature request header.
  signature: string
  // Twilio webhooks are form-urlencoded; values are always strings.
  params: Record<string, string>
}

function createTwilioClient() {
  // The REST client is most of the SDK's weight, and a static import compiles
  // it on every cold start of every route that imports the app router, so it
  // loads on the first REST call. Construction stays lazy too: module-load
  // construction breaks edge-runtime static probes and test envs with a
  // partial env. The TwiML, JWT and webhook helpers come from twilio's own
  // small modules above, so they stay synchronous.
  const sdk = lazyAsync(async (): Promise<Twilio> => {
    const { default: twilio } = await import('twilio')
    const config = getTwilioConfig()
    return twilio(config.accountSid, config.authToken)
  })

  return {
    /** NEVER call from a route handler — go through `voip-calls.service` so the compliance gate + DNC check run first. */
    async placeOutboundCall(params: CallListInstanceCreateOptions): Promise<CallInstance> {
      return (await sdk()).calls.create(params)
    },

    async fetchCall(callSid: string): Promise<CallInstance> {
      return (await sdk()).calls(callSid).fetch()
    },

    /** Server-side hangup for when the softphone's local disconnect didn't propagate. */
    async hangupCall(callSid: string): Promise<CallInstance> {
      return (await sdk()).calls(callSid).update({ status: 'completed' })
    },

    /** NEVER call from a route handler — go through `voip-messages.service` so the compliance gate, STOP-keyword guard, and 10DLC check run first. */
    async sendMessage(params: MessageListInstanceCreateOptions): Promise<MessageInstance> {
      return (await sdk()).messages.create(params)
    },

    async fetchMessage(messageSid: string): Promise<MessageInstance> {
      return (await sdk()).messages(messageSid).fetch()
    },

    /** Paid (~$0.005/lookup). Throws on a transport/API error — callers MUST treat that as indeterminate and fail open (never block a lead on a Twilio outage). */
    async lookupPhoneNumber(e164: string): Promise<PhoneLookupResult> {
      const res = await (await sdk()).lookups.v2.phoneNumbers(e164).fetch({ fields: 'line_type_intelligence' })
      return {
        valid: res.valid ?? false,
        lineType: res.lineTypeIntelligence?.type ?? null,
        carrierName: res.lineTypeIntelligence?.carrierName ?? null,
        errorCode: res.lineTypeIntelligence?.errorCode ?? null,
      }
    },

    /** Numbers are purchased in the Twilio console, never programmatically. */
    async listIncomingPhoneNumbers(
      params?: IncomingPhoneNumberListInstanceOptions,
    ): Promise<IncomingPhoneNumberInstance[]> {
      const client = await sdk()
      // Branch the overload — the SDK's no-arg + params forms are distinct.
      if (params === undefined) {
        return client.incomingPhoneNumbers.list()
      }
      return client.incomingPhoneNumbers.list(params)
    },

    async fetchIncomingPhoneNumber(sid: string): Promise<IncomingPhoneNumberInstance> {
      return (await sdk()).incomingPhoneNumbers(sid).fetch()
    },

    /** Signed with the API Key SID + Secret, NOT the account auth token — Twilio uses API Keys for JWTs and the auth token for REST + webhook validation. */
    mintVoiceAccessToken(input: MintVoiceAccessTokenInput): string {
      const config = getTwilioConfig()
      const { VoiceGrant } = AccessToken

      const token = new AccessToken(
        config.accountSid,
        config.apiKeySid,
        config.apiKeySecret,
        {
          identity: input.identity,
          ttl: input.ttlSeconds ?? ACCESS_TOKEN_TTL_SECONDS,
        },
      )

      token.addGrant(new VoiceGrant({
        incomingAllow: true,
        outgoingApplicationSid: config.twimlAppSid,
        outgoingApplicationParams: input.outgoingApplicationParams,
      }))

      return token.toJwt()
    },

    buildInboundVoiceTwiml(input: BuildInboundVoiceTwimlInput): string {
      const response = new VoiceResponse()

      if (input.greeting) {
        response.say({ voice: INBOUND_VOICE_TTS_VOICE }, input.greeting)
      }

      if (input.dialTarget) {
        const dialAttrs: { callerId?: string, action?: string } = {}
        if (input.callerId) {
          dialAttrs.callerId = input.callerId
        }
        if (input.dialStatusCallbackUrl) {
          dialAttrs.action = input.dialStatusCallbackUrl
        }
        response.dial(dialAttrs, input.dialTarget)
      }
      else {
        response.hangup()
      }

      return response.toString()
    },

    buildDialTwiml(input: BuildDialTwimlInput): string {
      const response = new VoiceResponse()

      const dialAttrs: { callerId: string, action?: string, record?: 'record-from-answer' } = {
        callerId: input.callerId,
      }
      if (input.statusCallbackUrl) {
        dialAttrs.action = input.statusCallbackUrl
      }
      if (input.record) {
        dialAttrs.record = 'record-from-answer'
      }

      response.dial(dialAttrs, input.to)

      return response.toString()
    },

    buildInboundMessagingTwiml(input: BuildInboundMessagingTwimlInput): string {
      const response = new MessagingResponse()

      if (input.replyBody) {
        response.message(input.replyBody)
      }

      return response.toString()
    },

    /** Twilio signs webhooks with HMAC-SHA1 over url + sorted form params using the account auth token; `false` ⇒ respond 403. */
    verifyWebhookSignature(input: VerifyWebhookSignatureInput): boolean {
      return validateRequest(
        getTwilioConfig().authToken,
        input.signature,
        input.url,
        input.params,
      )
    },
  }
}

export type TwilioClient = ReturnType<typeof createTwilioClient>

export const twilioClient = createTwilioClient()

// The same class the lazily loaded REST client throws (one module instance), so
// callers keep `instanceof RestException`.
export { RestException }
```

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && CI=1 npx eslint --fix src/shared/config/lazy-async.ts src/shared/services/providers/twilio/client.ts`
Expected: no errors. If `tsc` rejects a default import from a `twilio/lib/...` module, check that module's `.d.ts`: `export =` modules (`VoiceResponse`, `MessagingResponse`, `AccessToken`) take a default import under the repo's `esModuleInterop`; `RestException.d.ts` has `export default class`; `webhooks.d.ts` exports `validateRequest` by name. Fix the import form to match, not the call sites.

- [ ] **Step 4: Confirm callers are untouched**

Run: `git diff --stat -- src/shared/services/voip src/trpc/routers`
Expected: empty (the `instanceof RestException` callers in `voip-calls.service.ts` and `voip-messages.service.ts` did not change).

- [ ] **Step 5: Commit**

```bash
git add -- src/shared/config/lazy-async.ts
git commit -F - -- src/shared/config/lazy-async.ts src/shared/services/providers/twilio/client.ts <<'MSG'
perf(twilio): the REST client loads on first use; helpers come from twilio's small modules

The static `import twilio from 'twilio'` put 3.4 MB of REST client code in every
route that imports the app router, compiled on each cold start.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 4: Resend and the email templates load on first send

**Files:**
- Modify: `src/shared/services/providers/resend/client.ts` (whole file)
- Modify: `src/shared/services/email.service.ts`

**Interfaces:**
- Consumes: `lazyAsync` (Task 3).
- Produces: `getResendClient(): Promise<Resend>` in `@/shared/services/providers/resend/client` (replaces `resendClient`; only `email.service.ts` used it). `emailService`'s methods keep their names and signatures.

- [ ] **Step 1: Replace `src/shared/services/providers/resend/client.ts`**

```ts
import { lazyAsync } from '@/shared/config/lazy-async'

import { getResendConfig } from './lib/config'

/**
 * Resend SDK client, loaded and constructed on the first send. The SDK brings
 * mail-parsing dependencies (svix, libmime, iconv-lite) that no page render
 * needs; a static import compiles them on every cold start of every route that
 * imports the app router. A missing RESEND_API_KEY rejects the first send with
 * `NotConfiguredError` instead of crashing app boot.
 */
export const getResendClient = lazyAsync(async () => {
  const { Resend } = await import('resend')
  return new Resend(getResendConfig().apiKey)
})
```

- [ ] **Step 2: Swap `email.service.ts`'s static imports for a loader**

Delete these two imports:

```ts
import { resendClient } from '@/shared/services/providers/resend/client'
```

```ts
import {
  renderCustomerConfirmationEmail,
  renderGeneralInquiryEmail,
  renderMoveForwardRequestEmail,
  renderNewLeadEmail,
  renderProposalEmail,
  renderScheduleConsultationEmail,
} from '@/shared/services/providers/resend/lib/render-emails'
```

Add this import in their place:

```ts
import { getResendClient } from '@/shared/services/providers/resend/client'
```

Add this function directly above `function createEmailService() {`:

```ts
// The Resend SDK and the react-email templates load together on the first
// send: neither is needed to render a page, and both are heavy.
async function loadEmailKit() {
  const [resend, templates] = await Promise.all([
    getResendClient(),
    import('@/shared/services/providers/resend/lib/render-emails'),
  ])
  return { resend, templates }
}
```

- [ ] **Step 3: Use the loader in all six send methods**

In each of `sendProposalEmail`, `sendMoveForwardRequestEmail`, `sendScheduleConsultationEmail`, `sendGeneralInquiryEmail`, `sendInquiryConfirmationEmail` and `sendNewLeadNotificationEmail`:
- add `const { resend, templates } = await loadEmailKit()` as the method body's first statement;
- change `await resendClient.emails.send({` to `await resend.emails.send({`;
- prefix the `render…` call with `templates.`.

The six render calls become exactly: `templates.renderProposalEmail(`, `templates.renderMoveForwardRequestEmail(`, `templates.renderScheduleConsultationEmail(`, `templates.renderGeneralInquiryEmail(`, `templates.renderCustomerConfirmationEmail(`, `templates.renderNewLeadEmail(`. For example, `sendScheduleConsultationEmail` becomes:

```ts
    sendScheduleConsultationEmail: async (formData: ScheduleConsultationFormSchema) => {
      const { resend, templates } = await loadEmailKit()
      const { data, error } = await resend.emails.send({
        // …existing fields unchanged…
        react: templates.renderScheduleConsultationEmail(formData),
      })
```

Run: `grep -n "resendClient\|[^.]render[A-Z][a-zA-Z]*Email(" src/shared/services/email.service.ts`
Expected: no output (every render call is `templates.`-prefixed; `resendClient` is gone).

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && CI=1 npx eslint --fix src/shared/services/providers/resend/client.ts src/shared/services/email.service.ts`
Expected: no errors. Also run `grep -rn "resendClient" src` — expected: no output.

- [ ] **Step 5: Commit**

```bash
git commit -F - -- src/shared/services/providers/resend/client.ts src/shared/services/email.service.ts <<'MSG'
perf(email): Resend and the react-email templates load on the first send

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 5: pdfmake, pdf-lib and sharp load on first use

**Files:**
- Modify: `src/shared/lib/pdf/render-pdf.ts`
- Modify: `src/shared/lib/pdf/count-pdf-pages.ts` (whole file)
- Modify: `src/shared/lib/file-optimization/strategies/pdf.ts` (whole file)
- Modify: `src/shared/modules/media/core/lib/process-image-variants.ts`

**Interfaces:**
- Consumes: `lazyAsync` (Task 3).
- Produces: `renderPdf`, `countPdfPages`, `readPdfPageCount`, `processImageVariants` — all already async, signatures unchanged.

- [ ] **Step 1: `render-pdf.ts` — load pdfmake and set its fonts once, on the first render**

Replace the top of the file, from the imports through the end of `renderPdf` (everything above the `pdfSafeString` doc comment), with:

```ts
import type { Buffer } from 'node:buffer'
import type { TDocumentDefinitions } from 'pdfmake/interfaces'

import { lazyAsync } from '@/shared/config/lazy-async'

/**
 * pdfmake loads on the first render, not at boot: a static import compiles it
 * on every cold start of every route that imports the app router.
 *
 * pdfmake requires font definitions. We use the 14 standard PDF fonts
 * (Helvetica family) to avoid shipping TTF files with the bundle. These
 * are built into every PDF reader, so file size stays tiny and rendering
 * is universal. The fontDictionary maps the logical font name "Roboto"
 * (used in our styles) to Helvetica — visual result is near-identical
 * for the reference SOW doc.
 */
const loadPdfMake = lazyAsync(async () => {
  const { default: pdfMake } = await import('pdfmake')
  pdfMake.setFonts({
    Roboto: {
      normal: 'Helvetica',
      bold: 'Helvetica-Bold',
      italics: 'Helvetica-Oblique',
      bolditalics: 'Helvetica-BoldOblique',
    },
  })
  return pdfMake
})

/**
 * Renders a pdfmake doc definition to a Buffer.
 */
export async function renderPdf(def: TDocumentDefinitions): Promise<Buffer> {
  const pdfMake = await loadPdfMake()
  const created = pdfMake.createPdf(sanitizeValue(def) as TDocumentDefinitions)
  return created.getBuffer()
}
```

(`fontsConfigured` and `ensureFontsConfigured` are gone; `pdfSafeString` and `sanitizeValue` below stay as they are.)

- [ ] **Step 2: Replace `count-pdf-pages.ts`**

```ts
import type { Buffer } from 'node:buffer'

/** Counts pages in a PDF buffer without rendering it. pdf-lib loads on first use, not at boot. */
export async function countPdfPages(buffer: Buffer): Promise<number> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(buffer)
  return doc.getPageCount()
}
```

- [ ] **Step 3: Replace `file-optimization/strategies/pdf.ts`**

```ts
// src/shared/lib/file-optimization/strategies/pdf.ts
import type { Buffer } from 'node:buffer'

/**
 * Best-effort page count for a PDF. Returns null (never throws) when the PDF
 * can't be parsed — a page-count failure must not fail the whole optimize; the
 * file is still a usable download. pdf-lib loads on first use, not at boot.
 *
 * PLAN 1b: add first-page raster → WebP thumbnail here (pdfjs-dist + canvas)
 * and surface a thumbnailPathKey; Plan 1 only reads the page count.
 */
export async function readPdfPageCount(buffer: Buffer): Promise<number | null> {
  try {
    const { PDFDocument } = await import('pdf-lib')
    const doc = await PDFDocument.load(buffer, { ignoreEncryption: true })
    return doc.getPageCount()
  }
  catch (error) {
    console.warn('[file-optimization] readPdfPageCount failed:', error)
    return null
  }
}
```

- [ ] **Step 4: `process-image-variants.ts` — import sharp where it is used**

Delete the line `import sharp from 'sharp'`.

In `resizeWithBudget`, make the first statement of the body:

```ts
  // sharp is a native addon required from node_modules; loading it here keeps
  // it out of the boot path of every route that imports the app router.
  const { default: sharp } = await import('sharp')
```

In `processImageVariants`, make the first statement of the body:

```ts
  const { default: sharp } = await import('sharp')
```

Run: `grep -n "sharp(" src/shared/modules/media/core/lib/process-image-variants.ts`
Expected: every `sharp(` call sits inside `resizeWithBudget` or `processImageVariants` (both now have a local `sharp`).

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && CI=1 npx eslint --fix src/shared/lib/pdf/render-pdf.ts src/shared/lib/pdf/count-pdf-pages.ts src/shared/lib/file-optimization/strategies/pdf.ts src/shared/modules/media/core/lib/process-image-variants.ts`
Expected: no errors.

- [ ] **Step 6: Browser check — the proposal PDF route still renders (webpack interop)**

With Playwright (authenticated): open `/dashboard/proposals`, read the first proposal's id from a row link, then run via `browser_run_code_unsafe`:

```js
async (page) => {
  const res = await page.request.get(`/api/proposals/${PROPOSAL_ID}/pdf`)
  return [res.status(), res.headers()['content-type'], (await res.body()).subarray(0, 5).toString()]
}
```

Expected: `[200, 'application/pdf', '%PDF-']`. (Read-only: the route renders, it does not write.)

- [ ] **Step 7: Commit**

```bash
git commit -F - -- src/shared/lib/pdf/render-pdf.ts src/shared/lib/pdf/count-pdf-pages.ts src/shared/lib/file-optimization/strategies/pdf.ts src/shared/modules/media/core/lib/process-image-variants.ts <<'MSG'
perf(pdf,media): pdfmake, pdf-lib and sharp load on first use

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 6: The AI SDK and the S3 SDK load on first use

**Files:**
- Modify: `src/shared/services/providers/ai/client.ts`
- Modify: `src/shared/services/providers/r2/client.ts`

**Interfaces:**
- Consumes: `lazyAsync` (Task 3).
- Produces: `aiClient` and `r2Client` with unchanged method names and signatures (`getPresignedUploadUrl` / `getPresignedDownloadUrl` still return `Promise<string>`).

- [ ] **Step 1: `ai/client.ts` — import the AI SDK inside `generateProjectSummary`**

Delete:

```ts
import { openai } from '@ai-sdk/openai'
import { generateText, Output } from 'ai'
```

Make the first statement inside the method's `try {`:

```ts
        // The AI SDK loads on the first summary, not at boot.
        const [{ openai }, { generateText, Output }] = await Promise.all([
          import('@ai-sdk/openai'),
          import('ai'),
        ])
```

- [ ] **Step 2: `r2/client.ts` — replace the `lazyProxy` S3 client with a lazy loader**

Replace the imports

```ts
import { CopyObjectCommand, DeleteObjectCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { lazyProxy } from '@/shared/config/lazy-proxy'
```

with

```ts
import { lazyAsync } from '@/shared/config/lazy-async'
```

Replace the `s3` block (its doc comment and `const s3 = lazyProxy(() => { … })`) with:

```ts
/**
 * The S3 SDK and its client load on the first object operation, not at boot.
 * `@aws-sdk/client-s3` is a Next server external, required from node_modules,
 * so a static import would require it on every cold start of every route that
 * imports the app router. Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID /
 * R2_SECRET_ACCESS_KEY reject that first operation with `NotConfiguredError`.
 */
const loadS3 = lazyAsync(async () => {
  const sdk = await import('@aws-sdk/client-s3')
  const config = getR2Config()
  const client = new sdk.S3Client({
    region: 'auto',
    endpoint: config.endpoint,
    forcePathStyle: false,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  })
  return { sdk, client }
})
```

Then replace the method bodies that touch the SDK (the other methods — `deleteMediaWithVariants` — are unchanged):

```ts
  /** Upload a buffer to `bucket/pathKey` with the given content type. */
  putObject: async (bucket: R2BucketName, pathKey: string, body: Buffer, mimeType: string): Promise<void> => {
    const { sdk, client } = await loadS3()
    await client.send(
      new sdk.PutObjectCommand({ Bucket: bucket, Key: pathKey, Body: body, ContentType: mimeType }),
    )
  },

  /** Download `bucket/pathKey` into a Buffer. Throws if the object is empty. */
  getObject: async (bucket: R2BucketName, pathKey: string): Promise<Buffer> => {
    const { sdk, client } = await loadS3()
    const response = await client.send(new sdk.GetObjectCommand({ Bucket: bucket, Key: pathKey }))

    if (!response.Body) {
      throw new Error(`Empty response for ${bucket}/${pathKey}`)
    }

    const bytes = await response.Body.transformToByteArray()
    return Buffer.from(bytes)
  },

  /** List every object key in a bucket (optionally under a prefix), paginated. */
  listAllKeys: async (bucket: R2BucketName, prefix?: string): Promise<string[]> => {
    const { sdk, client } = await loadS3()
    const keys: string[] = []
    let continuationToken: string | undefined
    do {
      const res = await client.send(new sdk.ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      }))
      for (const obj of res.Contents ?? []) {
        if (obj.Key) {
          keys.push(obj.Key)
        }
      }
      continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (continuationToken)
    return keys
  },

  /** Delete a single object at `bucket/pathKey`. */
  deleteObject: async (bucket: R2BucketName, pathKey: string): Promise<void> => {
    const { sdk, client } = await loadS3()
    await client.send(new sdk.DeleteObjectCommand({ Bucket: bucket, Key: pathKey }))
  },
```

```ts
  copyObject: async ({ sourceBucket, sourceKey, destBucket, destKey }: {
    sourceBucket: R2BucketName
    sourceKey: string
    destBucket: R2BucketName
    destKey: string
  }): Promise<void> => {
    const { sdk, client } = await loadS3()
    await client.send(new sdk.CopyObjectCommand({
      Bucket: destBucket,
      Key: destKey,
      // CopySource is `${bucket}/${key}`; the key segment must be URL-encoded
      // so paths containing spaces/slashes/unicode resolve correctly.
      CopySource: `${sourceBucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
    }))
  },

  /** Presigned PUT URL for a direct browser upload. Default TTL 15 min. */
  getPresignedUploadUrl: async ({ bucket, pathKey, mimeType, expiresIn = 900 }: PresignedUploadInput): Promise<string> => {
    const [{ sdk, client }, { getSignedUrl }] = await Promise.all([loadS3(), import('@aws-sdk/s3-request-presigner')])
    const command = new sdk.PutObjectCommand({ Bucket: bucket, Key: pathKey, ContentType: mimeType })
    return getSignedUrl(client, command, { expiresIn })
  },

  /** Presigned GET URL for a direct browser download. Default TTL 1 hour. */
  getPresignedDownloadUrl: async ({ bucket, pathKey, expiresIn = 3600 }: PresignedDownloadInput): Promise<string> => {
    const [{ sdk, client }, { getSignedUrl }] = await Promise.all([loadS3(), import('@aws-sdk/s3-request-presigner')])
    const command = new sdk.GetObjectCommand({ Bucket: bucket, Key: pathKey })
    return getSignedUrl(client, command, { expiresIn })
  },
```

(`copyObject` keeps its existing doc comment above it.)

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && CI=1 npx eslint --fix src/shared/services/providers/ai/client.ts src/shared/services/providers/r2/client.ts`
Expected: no errors. `grep -n "lazyProxy\|s3\.send" src/shared/services/providers/r2/client.ts` → no output.

- [ ] **Step 4: Commit**

```bash
git commit -F - -- src/shared/services/providers/ai/client.ts src/shared/services/providers/r2/client.ts <<'MSG'
perf(ai,r2): the AI SDK and the S3 SDK load on first use

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 7: Server-side Ably publishes through `publishRealtime()`

**Files:**
- Modify: `src/shared/services/providers/upstash/realtime.ts` (whole file)
- Modify: `src/trpc/routers/meeting-flow.router.ts` (import + one call)
- Modify: `src/shared/entities/meetings/dal/server/crud.ts` (import + one call)
- Modify: `src/shared/entities/customers/dal/server/crud.ts` (commented example only)

**Interfaces:**
- Consumes: `lazyAsync` (Task 3).
- Produces: `publishRealtime(channel: string, event: string, data: unknown): Promise<void>` in `@/shared/services/providers/upstash/realtime` (replaces the `ably` export; its two callers change).

- [ ] **Step 1: Replace `realtime.ts`**

```ts
import { lazyAsync } from '@/shared/config/lazy-async'

import { getAblyConfig } from './lib/config'

// HOW REALTIME SYNC WORKS:
// 1. A tRPC mutation writes to Postgres
// 2. After the write, the server publishes an event to an Ably channel (meeting:{id})
// 3. The receiving client's useChannel hook picks up the event via WebSocket
// 4. The hook calls invalidate() → React Query refetches from DB
//
// The client IGNORES the event payload — it only uses the event as a trigger to refetch.
// We still send the changed data for forward-compatibility: if we ever want to skip the
// refetch and apply changes directly to the React Query cache (lower latency, offline
// support), the data is already there.
//
// Ably REST client is used server-side (short-lived HTTP POST to publish, no persistent
// connection). The client-side uses Ably Realtime (WebSocket, managed by Ably's infra —
// no Vercel function time consumed for the connection).
//
// The REST client loads and is constructed on the first publish, not at boot: the SDK
// brings its own HTTP and WebSocket stacks, which no page render needs. A missing
// ABLY_API_KEY rejects that first publish with `NotConfiguredError` instead of crashing
// app boot.

const getRest = lazyAsync(async () => {
  const { Rest } = await import('ably')
  return new Rest({ key: getAblyConfig().apiKey })
})

export async function publishRealtime(channel: string, event: string, data: unknown): Promise<void> {
  const rest = await getRest()
  await rest.channels.get(channel).publish(event, data)
}
```

- [ ] **Step 2: `meeting-flow.router.ts`**

Change `import { ably } from '@/shared/services/providers/upstash/realtime'` to `import { publishRealtime } from '@/shared/services/providers/upstash/realtime'`, and replace

```ts
      await ably.channels
        .get(`meeting:${meetingId}`)
        .publish('meeting.updated', { fields: Object.keys(patch) })
        .catch(err => console.warn('[meeting-flow] ably publish failed:', err))
```

with

```ts
      await publishRealtime(`meeting:${meetingId}`, 'meeting.updated', { fields: Object.keys(patch) })
        .catch(err => console.warn('[meeting-flow] ably publish failed:', err))
```

- [ ] **Step 3: `meetings/dal/server/crud.ts`**

Change `import { ably } from '@/shared/services/providers/upstash/realtime'` to `import { publishRealtime } from '@/shared/services/providers/upstash/realtime'`, and replace

```ts
        await ably.channels.get(`meeting:${row.id}`).publish('meeting.updated', {
          fields: Object.keys(data),
        })
```

with

```ts
        await publishRealtime(`meeting:${row.id}`, 'meeting.updated', {
          fields: Object.keys(data),
        })
```

Also update the comment that names `ably.publish` (≈ line 20: "The after-hook side-effects below (job dispatches, ably.publish, …)") to say `publishRealtime` instead of `ably.publish`.

- [ ] **Step 4: `customers/dal/server/crud.ts` — keep the commented example accurate**

Replace

```ts
      //   await ably.channels.get(`customer:${row.id}`).publish(
      //     'customer.updated', { fields: Object.keys(meta.input) })
```

with

```ts
      //   await publishRealtime(`customer:${row.id}`, 'customer.updated',
      //     { fields: Object.keys(meta.input) })
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && CI=1 npx eslint --fix src/shared/services/providers/upstash/realtime.ts src/trpc/routers/meeting-flow.router.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/customers/dal/server/crud.ts`
Expected: no errors. `grep -rn "ably\.channels" src` → no output.

- [ ] **Step 6: Commit**

```bash
git commit -F - -- src/shared/services/providers/upstash/realtime.ts src/trpc/routers/meeting-flow.router.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/customers/dal/server/crud.ts <<'MSG'
perf(realtime): server publishes go through publishRealtime(), which loads Ably REST on first use

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 8: Lint guard against static imports of the lazy-only packages + smoke run

**Files:**
- Modify: `eslint.config.js` (constants at the top, three appended blocks at the end)

**Interfaces:**
- Consumes: the lazy seams from Tasks 3–7 (the rule must report zero diagnostics on the tree they leave).
- Produces: the `project/lazy-only-imports*` config blocks, the sole owners of `ts/no-restricted-imports`.

- [ ] **Step 1: Add the constants below the existing `NAV_PATH_MSG` constant**

```js
// Packages no page render needs. A static value import puts their code in the
// server bundle of every route that imports the tRPC app router, and each cold
// start compiles all of it (twilio alone was 3.4 MB of /dashboard's 11 MB).
// Load them with `await import()` in the function that uses them —
// `no-restricted-imports` does not see `import()`, and type-only imports stay
// allowed. These blocks are the only owners of `ts/no-restricted-imports`: a
// later block setting it would replace these lists for the files it matches,
// not add to them (same flat-config rule as project/no-inline-table-config).
const LAZY_ONLY_MESSAGE
  = 'Load this with `await import()` where it is used: a static import compiles it on every cold start of every route that imports the tRPC app router. See src/shared/config/lazy-async.ts.'
const LAZY_ONLY_PACKAGES = [
  'twilio',
  'resend',
  '@react-email/components',
  'pdfmake',
  'pdf-lib',
  'ably',
  'ai',
  '@ai-sdk/openai',
  '@aws-sdk/client-s3',
  '@aws-sdk/s3-request-presigner',
  'sharp',
]
const TWILIO_REST_PATTERN = {
  group: ['twilio/lib/rest/**'],
  message: `${LAZY_ONLY_MESSAGE} Twilio's TwiML, JWT, webhook and RestException modules are fine to import directly.`,
  allowTypeImports: true,
}
const EMAIL_TEMPLATES_PATTERN = {
  group: ['@/shared/services/providers/resend/emails/*'],
  message: 'Email templates are imported only by providers/resend/lib/render-emails.tsx, which email.service.ts loads with `await import()`.',
  allowTypeImports: true,
}
const RENDER_EMAILS_PATTERN = {
  group: ['@/shared/services/providers/resend/lib/render-emails'],
  message: 'Load render-emails with `await import()` (see loadEmailKit in email.service.ts): it pulls in every react-email template.',
  allowTypeImports: true,
}
function lazyOnlyImports({ except = [], patterns = [TWILIO_REST_PATTERN, EMAIL_TEMPLATES_PATTERN, RENDER_EMAILS_PATTERN] } = {}) {
  return ['error', {
    paths: LAZY_ONLY_PACKAGES
      .filter(name => !except.includes(name))
      .map(name => ({ name, message: LAZY_ONLY_MESSAGE, allowTypeImports: true })),
    patterns,
  }]
}
```

- [ ] **Step 2: Append the three blocks after the last `.append({ … })`**

Change the file's final `})` of the `project/no-inline-table-config` block to continue the chain:

```js
}).append({
  name: 'project/lazy-only-imports',
  files: ['src/**/*.ts', 'src/**/*.tsx'],
  rules: {
    'ts/no-restricted-imports': lazyOnlyImports(),
  },
}).append({
  // The templates themselves and render-emails (loaded with import() by
  // email.service.ts) are where the react-email code is meant to live.
  name: 'project/lazy-only-imports/email-templates',
  files: [
    'src/shared/services/providers/resend/emails/**',
    'src/shared/services/providers/resend/lib/render-emails.tsx',
  ],
  rules: {
    'ts/no-restricted-imports': lazyOnlyImports({
      except: ['@react-email/components'],
      patterns: [TWILIO_REST_PATTERN, RENDER_EMAILS_PATTERN],
    }),
  },
}).append({
  // Ably's browser Realtime client, rendered by RealtimeProvider.
  name: 'project/lazy-only-imports/realtime-client',
  files: ['src/shared/services/providers/upstash/realtime-client.ts'],
  rules: {
    'ts/no-restricted-imports': lazyOnlyImports({ except: ['ably'] }),
  },
})
```

- [ ] **Step 3: Run lint — the tree must be clean**

Run: `pnpm lint`
Expected: no `ts/no-restricted-imports` errors (and no new errors of any kind). If one appears, the offending file still has a static value import from Tasks 3–7's list — fix that file, do not loosen the rule.

- [ ] **Step 4: Prove the guard fires (and allows what it should)**

Create `src/lint-probe.ts`:

```ts
import type { Twilio } from 'twilio'
import twilio from 'twilio'
import Api from 'twilio/lib/rest/Api'
import VoiceResponse from 'twilio/lib/twiml/VoiceResponse'

export const probe: [Twilio | undefined, unknown, unknown, unknown] = [undefined, twilio, Api, VoiceResponse]
```

Run: `CI=1 npx eslint src/lint-probe.ts`
Expected: exactly two `ts/no-restricted-imports` errors — line 2 (`'twilio'`) and line 3 (`twilio/lib/rest/**`); none for line 1 (type import) or line 4 (TwiML module).
Then delete it: `rm src/lint-probe.ts`.

- [ ] **Step 5: Run the smoke script (local checks)**

Run: `NODE_OPTIONS="--conditions=react-server" pnpm -s tsx .worktrees/perf-tools/smoke-lazy-seams.ts`
Expected: five `PASS` lines (pdf, sharp, twilio helpers, r2 presign, resend). A `FAIL` whose message is `NotConfiguredError` for a provider whose env is absent locally is an env gap, not a code failure — report it to the owner; any other `FAIL` is a bug in that task's seam.

- [ ] **Step 6: Ask the owner, then run the network checks**

Ask the owner: "OK to run the smoke script's `--network` mode? It makes one Twilio GET for a non-existent call SID (no charge, no side effect) and one Ably publish to `smoke:lazy-seams` (no subscribers)." On yes:
Run: `NODE_OPTIONS="--conditions=react-server" pnpm -s tsx .worktrees/perf-tools/smoke-lazy-seams.ts --network`
Expected: the five local `PASS` lines plus `PASS twilio REST (GET non-existent call → 404): RestException 404` and `PASS ably REST publish (scratch channel): published`.

- [ ] **Step 7: Commit**

```bash
git commit -F - -- eslint.config.js <<'MSG'
chore(lint): heavy provider SDKs may only be loaded with import()

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 9: Re-measure the server bundle against the Phase 1 target

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md` (§4.3 addendum, §10 status)

**Interfaces:**
- Consumes: Task 1 tools; the commits of Tasks 2–8 on `main`.

- [ ] **Step 1: Rebuild and measure**

Run (repo root): `bash .worktrees/perf-tools/rebuild-profile.sh main`
Then (from `.worktrees/perf-profile`): `node ../perf-tools/bytes.mjs 12 && node ../perf-tools/measure-local.mjs 3`
Expected: `/dashboard` ≤ 6.0 MB with no `twilio`, `resend`, `svix`, `libmime`, `pdf-lib`, `pdfmake`, `ably`, `ai` or `@ai-sdk/*` in its top list; `/dashboard` cold ≤ 600 ms. The externals line may still name `@aws-sdk/client-s3`, `sharp` and `pdfkit`: webpack keeps a one-line stub that `require`s an external, and after this phase that stub runs only when the `import()` does — the cold timing, not the text scan, is the check for externals. (The build itself passing is also the webpack-level check that every `import()` resolves.)

- [ ] **Step 2: If a target is missed, stop and report**

If `/dashboard` is still above 6.0 MB or 600 ms: list the top 12 packages and the externals from Step 1, identify which are still statically reachable (`grep -rn "from '<pkg>'" src`), and report to the owner with a proposed next seam. Do not start Task 10 until the owner decides (proceed, or add a seam task).

- [ ] **Step 3: Record the result in the spec**

Append to §4.3 a line `After Phase 1 server seams (<short sha>): /dashboard <X.X> MB, cold <N> ms; /api/trpc <X.X> MB, cold <N> ms; /api/auth <X.X> MB, cold <N> ms.` with the measured numbers, and set §10 rows "Phase 1 — §5.1" and "Phase 1 — §5.2 lazy SDKs + lint guard" to ✅.

- [ ] **Step 4: Commit**

```bash
git commit -F - -- docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md <<'MSG'
docs(pwa): record the Phase 1 server-bundle measurement

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 10: The dashboard shell streams before the session

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-session-sidebar.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-session-content.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-session-mobile-nav.tsx`
- Create: `src/features/agent-dashboard/ui/components/app-sidebar-skeleton.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-content-skeleton.tsx`
- Modify: `src/app/(frontend)/dashboard/layout.tsx` (whole file)
- Modify: `docs/codebase-conventions/app-shell.md` (`### dashboard-layout-shape-fixed`)

**Interfaces:**
- Consumes: `getCachedSession()`; `AppSidebar({ user })`; `DashboardMobileNav()`; `DashboardSignIn()`; `PushSubscriptionBanner()`; `getSessionCookie(headers)` from `better-auth/cookies`.
- Produces: `DashboardSessionContent({ children })` (Task 14 extends it), `DashboardContentSkeleton` with `data-slot="dashboard-content-skeleton"` (Task 13's soft-nav check looks for it).

- [ ] **Step 1: `dashboard-session-sidebar.tsx`**

```tsx
import { AppSidebar } from '@/features/agent-dashboard/ui/components/app-sidebar'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Owns the session read for the sidebar slot, under a Suspense in the dashboard
// layout, so the layout streams before the database answers. getCachedSession
// is request-memoized: this shares one round-trip with the other slots and the
// page's protectDashboardPage().
export async function DashboardSessionSidebar() {
  const session = await getCachedSession()
  if (!session) {
    return null
  }
  return <AppSidebar user={session.user} />
}
```

- [ ] **Step 2: `dashboard-session-content.tsx`**

```tsx
import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { PushSubscriptionBanner } from '@/shared/components/push-subscription-banner'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Owns the session read for the page slot. A session cookie that no longer maps
// to a session (expired, revoked) lands here as null and gets the sign-in
// screen, the same screen as having no cookie at all.
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

- [ ] **Step 3: `dashboard-session-mobile-nav.tsx`**

```tsx
import { DashboardMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-mobile-nav'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Owns the session read for the mobile bottom nav, which the sign-in screen
// does not show.
export async function DashboardSessionMobileNav() {
  const session = await getCachedSession()
  if (!session) {
    return null
  }
  return <DashboardMobileNav />
}
```

- [ ] **Step 4: `app-sidebar-skeleton.tsx`**

```tsx
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarSeparator,
} from '@/shared/components/ui/sidebar'
import { Skeleton } from '@/shared/components/ui/skeleton'

// Same <Sidebar> primitive and props as AppSidebar: SidebarInset keys its
// margin on it as a `peer`, so the inset does not shift when the real sidebar
// swaps in. Fixed widths on purpose — SidebarMenuSkeleton randomizes its width,
// which differs between the server and the client render.
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

- [ ] **Step 5: `dashboard-content-skeleton.tsx`**

```tsx
import { Skeleton } from '@/shared/components/ui/skeleton'

// Generic on purpose (every dashboard page shares the layout) and padded like
// the dashboard template, so the swap to the real page does not jump. Shows
// only on a document load: the layout persists across in-app navigation.
export function DashboardContentSkeleton() {
  return (
    <div
      className="flex h-full min-w-0 flex-col px-4 pb-20 pt-4 md:px-6 md:py-6"
      data-slot="dashboard-content-skeleton"
      aria-busy="true"
    >
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

- [ ] **Step 6: Replace `src/app/(frontend)/dashboard/layout.tsx`**

```tsx
import { getSessionCookie } from 'better-auth/cookies'
import { cookies, headers } from 'next/headers'
import { Suspense } from 'react'

import { AppSidebarSkeleton } from '@/features/agent-dashboard/ui/components/app-sidebar-skeleton'
import { DashboardContentSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-content-skeleton'
import { DashboardSessionContent } from '@/features/agent-dashboard/ui/components/dashboard-session-content'
import { DashboardSessionMobileNav } from '@/features/agent-dashboard/ui/components/dashboard-session-mobile-nav'
import { DashboardSessionSidebar } from '@/features/agent-dashboard/ui/components/dashboard-session-sidebar'
import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { MeetingSplashMount } from '@/features/meeting-flow/ui/components/meeting-splash-mount'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { PwaInstallPrompt } from '@/shared/components/pwa-install-prompt'
import { SidebarInset, SidebarProvider } from '@/shared/components/ui/sidebar'

// Nothing here waits on the database. Whether a session cookie is present (a
// header read) picks the sign-in screen or the signed-in shell; the session
// itself is read inside the three Suspense slots, which share one request memo.
// On a cold start the sidebar frame and skeletons stream while the database
// wakes, instead of the whole document waiting on it.
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
  const hasSessionCookie = getSessionCookie(requestHeaders) !== null

  const sidebarCookie = cookieStore.get('sidebar_state')
  const defaultOpen = sidebarCookie ? sidebarCookie.value === 'true' : true

  return (
    <>
      {/* Above the sidebar and the template so it is the first paint of a meeting (E9). */}
      {hasSessionCookie && <MeetingSplashMount />}
      <GlobalDialogs />
      <PwaInstallPrompt />
      <SidebarProvider defaultOpen={defaultOpen} data-no-gutter-stable>
        {hasSessionCookie && (
          <Suspense fallback={<AppSidebarSkeleton />}>
            <DashboardSessionSidebar />
          </Suspense>
        )}
        <SidebarInset
          className="h-full min-w-0 overflow-hidden"
          style={{
            background: `radial-gradient(ellipse 80% 50% at 50% 0%, color-mix(in oklch, var(--primary) 35%, transparent), var(--background) 70%), var(--background)`,
          }}
        >
          <div className="flex-1 min-h-0 pt-[env(safe-area-inset-top)]">
            {hasSessionCookie
              ? (
                  <Suspense fallback={<DashboardContentSkeleton />}>
                    <DashboardSessionContent>{children}</DashboardSessionContent>
                  </Suspense>
                )
              : <DashboardSignIn />}
          </div>
          {hasSessionCookie && (
            <Suspense>
              <DashboardSessionMobileNav />
            </Suspense>
          )}
        </SidebarInset>
      </SidebarProvider>
    </>
  )
}
```

- [ ] **Step 7: Update `app-shell.md#dashboard-layout-shape-fixed`**

Replace the section's JSX block with:

```jsx
<SidebarProvider>                                    {/* height: 100% via CSS */}
  <Suspense fallback={<AppSidebarSkeleton />}>       {/* same <Sidebar> primitive as AppSidebar */}
    <DashboardSessionSidebar />                      {/* → AppSidebar: fixed inset-y-0; owns its safe areas */}
  </Suspense>
  <SidebarInset className="h-full min-w-0 overflow-hidden">
    <div className="flex-1 min-h-0 pt-[env(safe-area-inset-top)]">
      <Suspense fallback={<DashboardContentSkeleton />}>
        <DashboardSessionContent>{children}</DashboardSessionContent>
      </Suspense>
    </div>
    <Suspense><DashboardSessionMobileNav /></Suspense>  {/* → DashboardMobileNav: fixed bottom-4 */}
  </SidebarInset>
</SidebarProvider>
```

and add these bullets to its **Critical rules** list:

```
- The layout never awaits the session. The session cookie's presence (`getSessionCookie`, a header read) picks the shell above or, with no cookie, `DashboardSignIn` directly with no skeletons; the session is read inside the three Suspense slots through one `getCachedSession()` memo. Awaiting it at the top of the layout puts a database round-trip (and, on a cold start, a Neon wake) in front of the first byte.
- `AppSidebarSkeleton` renders the same `<Sidebar collapsible="icon">` primitive as `AppSidebar` — `SidebarInset` keys its margin on it as a `peer`.
```

- [ ] **Step 8: Browser checks (Review Focus 2, 3, 4)**

Type-check and lint first: `pnpm tsc && CI=1 npx eslint --fix 'src/app/(frontend)/dashboard/layout.tsx' src/features/agent-dashboard/ui/components/dashboard-session-*.tsx src/features/agent-dashboard/ui/components/app-sidebar-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-content-skeleton.tsx`

Then with Playwright (`browser_run_code_unsafe` for cookie work):
1. **Signed in:** authenticate with `&redirect=/dashboard`. Expected: sidebar, dashboard content, mobile nav at a 390 px viewport; no console errors about hydration.
2. **Soft navigation (RF 4):** run
   ```js
   () => { window.__skeletonSeen = false; new MutationObserver(() => { if (document.querySelector('[data-slot="dashboard-content-skeleton"]')) window.__skeletonSeen = true }).observe(document.body, { childList: true, subtree: true }); return 'armed' }
   ```
   then click the sidebar's Customers item, wait for the customers table, click the Dashboard item, wait for "Your desk", and evaluate `() => window.__skeletonSeen`. Expected: `false`.
3. **No cookie (RF 2):** `async (page) => { await page.context().clearCookies(); await page.goto('/dashboard'); await page.getByText(/sign in with google/i).waitFor(); return page.locator('[data-slot="dashboard-content-skeleton"], [data-sidebar="sidebar"]').count() }` — expected `0`.
4. **Stale cookie (RF 2):** `async (page) => { await page.context().clearCookies(); await page.context().addCookies([{ name: 'better-auth.session_token', value: 'stale.value', domain: 'localhost', path: '/' }]); await page.goto('/dashboard'); await page.getByText(/sign in with google/i).waitFor(); return page.locator('[data-sidebar="sidebar"], [data-slot="dashboard-mobile-nav"]').count() }` — expected `0`, no error overlay.
5. **Non-internal user (RF 3):** navigate to `/api/dev/playwright-session?secret=…&role=homeowner&redirect=/dashboard`. Expected: the final URL is `/` (the redirect is now client-side, after the shell streams).
6. Re-authenticate as the default user before moving on.

If a check fails, fix the layout or slot components and repeat Step 8.

- [ ] **Step 9: Commit**

```bash
git add -- src/features/agent-dashboard/ui/components/dashboard-session-sidebar.tsx src/features/agent-dashboard/ui/components/dashboard-session-content.tsx src/features/agent-dashboard/ui/components/dashboard-session-mobile-nav.tsx src/features/agent-dashboard/ui/components/app-sidebar-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-content-skeleton.tsx
git commit -F - -- 'src/app/(frontend)/dashboard/layout.tsx' src/features/agent-dashboard/ui/components/dashboard-session-sidebar.tsx src/features/agent-dashboard/ui/components/dashboard-session-content.tsx src/features/agent-dashboard/ui/components/dashboard-session-mobile-nav.tsx src/features/agent-dashboard/ui/components/app-sidebar-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-content-skeleton.tsx docs/codebase-conventions/app-shell.md <<'MSG'
perf(dashboard): the shell streams before the session; the session is read in three Suspense slots

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 11: Phase 1 gate — ship and measure

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md` (§10)

- [ ] **Step 1: Full verification**

Run: `pnpm tsc && pnpm lint`
Expected: both clean.

- [ ] **Step 2: STOP — owner ships**

Tell the owner: Phase 1 is committed on `main` (list the commit SHAs from `git log --oneline origin/main..main`). Ask them to push (`git push origin main`) or to confirm that Claude may push. Wait for the deploy to finish (Vercel dashboard).

- [ ] **Step 3: Measure right after the deploy (functions cold)**

Run: `bash .worktrees/perf-tools/measure-prod.sh`
Record the no-cookie cold/warm TTFB and the function region (`pdx1` expected).

- [ ] **Step 4: Owner measurements**

Ask the owner for: the signed-in cold/warm reading after ≥ 20 min idle (`bash .worktrees/perf-tools/measure-prod.sh .worktrees/perf-tools/prod-cookie.txt`), three cold and three warm device launches (tap → real data), and the Vercel Observability cold-start numbers; plus the device checks: dark launch, then sidebar frame + skeletons, then data; in-app navigation keeps the previous page; the meeting splash is still the first paint on a meeting; sign-out shows the sign-in screen without sidebar or mobile nav.

- [ ] **Step 5: Record and commit**

Add a "Phase 1 shipped (<date>)" row to §10 Measurements, set "Phase 1 — §5.3" and "Phase 1 — measured" to ✅, then:

```bash
git commit -F - -- docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md <<'MSG'
docs(pwa): record the Phase 1 production measurements

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

---

## Phase 2 — client code

### Task 12: Page entrance fades are CSS

**Files:**
- Modify: `src/app/(frontend)/dashboard/template.tsx` (whole file)
- Modify: `src/shared/components/records-page-motion-shell.tsx` (whole file)
- Modify: `src/features/schedule-management/ui/views/schedule-view.tsx`
- Modify: `src/features/meeting-flow/ui/components/meeting-splash-mount.tsx` (comment)
- Modify: `docs/codebase-conventions/app-shell.md` (`### stage-routes-opt-out-with-data-stage`)
- Modify: `docs/codebase-conventions/frontend-stack.md` (`### motion-not-framer`)

- [ ] **Step 1: Replace `template.tsx`**

```tsx
// A CSS entrance, not a motion component: motion writes `initial={{ opacity: 0 }}`
// into the server HTML, which kept every page invisible until the bundle
// hydrated. The template remounts on each navigation, so the fade still replays
// per page; reduced-motion users get no animation.
export function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-w-0 flex-col">
      <main className="relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-20 pt-4 md:px-6 md:py-6 md:pb-6 has-data-stage:p-0 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
        {children}
      </main>
    </div>
  )
}

export default DashboardTemplate
```

- [ ] **Step 2: Replace `records-page-motion-shell.tsx`**

```tsx
import type { ReactNode } from 'react'

/**
 * Outer wrapper for records-page routes. Sibling to `RecordsPageShell`
 * (which owns the inner Header/Toolbar/Table layout) — this only adds the
 * page-level entrance animation and the full-height flex container that
 * lets the shell's table area scroll. The entrance is CSS with no delay: a
 * JS-driven or delayed start would hide the server-rendered page until
 * hydration.
 */
export function RecordsPageMotionShell({ children }: { children: ReactNode }) {
  return (
    <div className="w-full h-full flex flex-col overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-250">
      {children}
    </div>
  )
}
```

- [ ] **Step 3: `schedule-view.tsx` — same swap for the page wrapper**

Delete `import { motion } from 'motion/react'`. Replace

```tsx
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col overflow-hidden"
    >
```

with

```tsx
    <div className="w-full h-full flex flex-col overflow-hidden motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-8 motion-safe:duration-250">
```

and the closing `</motion.div>` with `</div>`.

- [ ] **Step 4: Update the `MeetingSplashMount` comment**

Replace

```ts
 * Where the meeting splash mounts: the dashboard layout, above the dashboard template (E9). The
 * template starts every page at opacity 0 inside a transformed, overflow-hidden `main`
 * (`app/(frontend)/dashboard/template.tsx`), so nothing inside a page can be the first paint;
```

with

```ts
 * Where the meeting splash mounts: the dashboard layout, above the dashboard template (E9). The
 * template animates every page in from a transformed, overflow-hidden `main`
 * (`app/(frontend)/dashboard/template.tsx`), so nothing inside a page can sit above it all;
```

- [ ] **Step 5: Docs**

In `app-shell.md#stage-routes-opt-out-with-data-stage`, change "`motion.main` carries `has-data-stage:p-0`" to "its `main` carries `has-data-stage:p-0`".

In `frontend-stack.md#motion-not-framer`, add after the first paragraph:

```
Page-level entrance fades (the dashboard template, `RecordsPageMotionShell`, the schedule view) are CSS — `motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-*` from tw-animate-css, no delay — never a motion `initial={{ opacity: 0 }}` on an element that wraps server-rendered content: motion writes that initial state into the server HTML, so the page stays invisible until the bundle hydrates.
```

- [ ] **Step 6: Checks (Review Focus 5, first half)**

Run: `pnpm tsc && CI=1 npx eslint --fix 'src/app/(frontend)/dashboard/template.tsx' src/shared/components/records-page-motion-shell.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/features/meeting-flow/ui/components/meeting-splash-mount.tsx`

With Playwright (authenticated):
1. `async (page) => { await page.route('**/_next/static/chunks/**', r => r.abort()); await page.goto('/dashboard'); await page.waitForTimeout(600); const o = await page.evaluate(() => getComputedStyle(document.querySelector('main')).opacity); await page.unroute('**/_next/static/chunks/**'); return o }` — expected `'1'`, and a screenshot shows the hero ("Your desk") and module cards.
2. `browser_emulate_media` with `reducedMotion: 'reduce'`, reload `/dashboard`, evaluate `() => getComputedStyle(document.querySelector('main')).animationName` — expected `'none'`. Reset the emulation after.
3. Open `/dashboard/customers` and `/dashboard/schedule`: both render and fade in (screenshot).

- [ ] **Step 7: Commit**

```bash
git commit -F - -- 'src/app/(frontend)/dashboard/template.tsx' src/shared/components/records-page-motion-shell.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/features/meeting-flow/ui/components/meeting-splash-mount.tsx docs/codebase-conventions/app-shell.md docs/codebase-conventions/frontend-stack.md <<'MSG'
perf(dashboard): page entrance fades are CSS, so the first HTML is visible before hydration

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 13: Dashboard home modules suspend, so their data streams in the HTML

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-snapshot-chips.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-section-skeleton.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx` (whole file)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-hero.tsx` (whole file)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx` (whole file)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-project-section.tsx` (whole file)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposals.tsx` (whole file)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-projects.tsx` (whole file)

**Interfaces:**
- Consumes: the six prefetches in `src/app/(frontend)/dashboard/page.tsx` (unchanged); `HydrationErrorBoundary({ children, fallback? })` from `@/trpc/components/hydration-error-boundary`.
- Produces: `DashboardSnapshotChips({ meetingsToday?, awaitingSignature?, activeProjects? }: number | undefined)`; `DashboardSectionSkeleton({ title })` with `data-slot="dashboard-section-skeleton"`.

- [ ] **Step 1: `dashboard-snapshot-chips.tsx`**

```tsx
interface DashboardSnapshotChipsProps {
  meetingsToday?: number
  awaitingSignature?: number
  activeProjects?: number
}

/**
 * Slim, non-sticky ribbon of 3 jump-links at the top of the dashboard:
 * meetings today · out for signature · open projects. A missing count renders
 * as a muted dash, which is also the loading and error state of
 * DashboardSnapshotStrip.
 */
export function DashboardSnapshotChips({ meetingsToday, awaitingSignature, activeProjects }: DashboardSnapshotChipsProps) {
  const chips = [
    { href: '#meetings', label: 'Meetings today', count: meetingsToday },
    { href: '#proposals', label: 'Out for signature', count: awaitingSignature },
    { href: '#projects', label: 'Open projects', count: activeProjects },
  ]

  return (
    <div className="grid grid-cols-3 gap-3">
      {chips.map(chip => (
        <a
          key={chip.href}
          href={chip.href}
          className="
            flex min-h-11 flex-col items-start justify-center gap-1 rounded-md
            border border-border bg-card px-3 py-2
            transition-colors duration-200
            hover:border-primary/40 hover:bg-accent/50
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          "
        >
          <span className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">
            {chip.label}
          </span>
          <span
            className={
              chip.count === undefined
                ? 'font-sans text-2xl font-bold tabular-nums text-muted-foreground'
                : 'font-sans text-2xl font-bold tabular-nums text-primary'
            }
          >
            {chip.count ?? '—'}
          </span>
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Replace `dashboard-snapshot-strip.tsx`**

```tsx
'use client'

import { useSuspenseQueries } from '@tanstack/react-query'

import { activeProjectsInput, awaitingProposalsInput, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardSnapshotChips } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-chips'
import { useTRPC } from '@/trpc/helpers'

/**
 * The three snapshot counts, read from the same query inputs the modules below
 * use (they dedupe against the server prefetch in `dashboard/page.tsx`), so the
 * strip never fires its own count query. It suspends until they resolve, so the
 * counts arrive in the streamed HTML; DashboardHero supplies the fallback.
 */
export function DashboardSnapshotStrip() {
  const trpc = useTRPC()
  // Plural hook: three singular suspense hooks in one component would waterfall.
  const [meetingsToday, awaitingSignature, activeProjects] = useSuspenseQueries({
    queries: [
      trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today')),
      trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()),
      trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput()),
    ],
  })

  return (
    <DashboardSnapshotChips
      meetingsToday={meetingsToday.data.total}
      awaitingSignature={awaitingSignature.data.total}
      activeProjects={activeProjects.data.total}
    />
  )
}
```

- [ ] **Step 3: Replace `dashboard-hero.tsx`**

```tsx
import type { ReactElement } from 'react'

import { Suspense } from 'react'

import { DashboardSnapshotChips } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-chips'
import { DashboardSnapshotStrip } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-strip'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'

interface DashboardHeroProps {
  /** The signed-in user's name (server-provided, so the greeting hydrates without a flash). First token is used. */
  name?: string | null
}

/**
 * Full-width cinematic band at the top of the dashboard: eyebrow + Syne
 * greeting + the snapshot stat row. Deliberately a non-time greeting (no
 * "Good morning") — a clock-derived greeting would diverge between server
 * render and client hydration. The name is threaded from the server page
 * (not read client-side) for the same hydration-safety reason. Spacing only
 * here; no card chrome — `DashboardSnapshotChips` owns the chip styling, and
 * its dash-filled form stands in while the counts stream or if they fail.
 */
export function DashboardHero({ name }: DashboardHeroProps): ReactElement {
  const firstName = name?.trim().split(/\s+/)[0]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">Your desk</p>
        <h1 className="font-sans text-2xl font-medium text-foreground">
          {firstName ? `👋 Welcome back, ${firstName}` : '👋 Welcome back'}
        </h1>
      </div>
      <HydrationErrorBoundary fallback={<DashboardSnapshotChips />}>
        <Suspense fallback={<DashboardSnapshotChips />}>
          <DashboardSnapshotStrip />
        </Suspense>
      </HydrationErrorBoundary>
    </div>
  )
}
```

- [ ] **Step 4: `dashboard-section-skeleton.tsx`**

```tsx
import { Skeleton } from '@/shared/components/ui/skeleton'

interface DashboardSectionSkeletonProps {
  /** The section's eyebrow, shown while its rows stream so the header does not pop in. */
  title: string
}

/** A dashboard list section while its query streams: the eyebrow plus two dense card-shaped rows. */
export function DashboardSectionSkeleton({ title }: DashboardSectionSkeletonProps) {
  return (
    <section className="flex flex-col gap-2" data-slot="dashboard-section-skeleton" aria-busy="true">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
      <div className="flex flex-col gap-2">
        {[0, 1].map(i => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 5: Replace `dashboard-proposal-section.tsx`**

```tsx
'use client'

import type { ProposalListInput } from '@/shared/modules/proposals/core/dal/server/queries'

import { useSuspenseQuery } from '@tanstack/react-query'

import { DashboardProposalCard } from '@/features/agent-dashboard/ui/components/dashboard-proposal-card'
import { EntityList } from '@/shared/components/entities/entity-list/ui/entity-list'
import { useTRPC } from '@/trpc/helpers'

interface DashboardProposalSectionProps {
  /** Space-Mono eyebrow naming the section's single state. */
  title: string
  /** List query input from a shared builder, so the key matches the server prefetch (hydration parity). */
  input: ProposalListInput
  /** Which timestamp each row's "time since" reflects. */
  timeSince: 'contractSentAt' | 'sentAt'
  /** Shown when the section has zero rows. */
  emptyMessage: string
}

/**
 * One labeled sub-section of the dashboard Proposals module: an eyebrow label +
 * the full-predicate total (a SQL `count()`, independent of the display cap),
 * then a capped `EntityList` of `DashboardProposalCard`s (or its empty state).
 * The section header IS the state — the cards carry no status badge. It
 * suspends until its rows resolve, so they arrive in the streamed HTML;
 * DashboardProposals supplies the fallback.
 */
export function DashboardProposalSection({ title, input, timeSince, emptyMessage }: DashboardProposalSectionProps) {
  const trpc = useTRPC()
  const { data } = useSuspenseQuery(trpc.proposalsRouter.business.list.queryOptions(input))

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
        <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">{data.total}</span>
      </div>
      {/* EntityList renders the list body + empty state only. Its built-in
          header is bypassed (`hideHeader`) on purpose: it is hardcoded
          `text-[10px]` sans `Title (n)` (entity-list.tsx:88), which violates
          the dashboard type floor (no `text-[10px]`) and cannot express the
          spec's Space-Mono eyebrow + right-aligned count — so this section
          renders its own header above. `title` is a required EntityList prop
          but inert here. We deliberately do NOT extend the shared EntityList
          with dashboard eyebrow chrome (feature styling stays out of shared/). */}
      <EntityList
        title={title}
        hideHeader
        items={data.rows}
        getItemKey={row => row.id}
        renderItem={row => <DashboardProposalCard row={row} timeSince={timeSince} />}
        emptyState={{ message: emptyMessage }}
        itemsClassName="space-y-2"
        variant="flush"
      />
    </section>
  )
}
```

- [ ] **Step 6: Replace `dashboard-project-section.tsx`**

```tsx
'use client'

import type { ProjectsListInput } from '@/features/agent-dashboard/constants/dashboard-queries'

import { useSuspenseQuery } from '@tanstack/react-query'

import { DashboardProjectCard } from '@/features/agent-dashboard/ui/components/dashboard-project-card'
import { EntityList } from '@/shared/components/entities/entity-list/ui/entity-list'
import { useTRPC } from '@/trpc/helpers'

interface DashboardProjectSectionProps {
  /** Space-Mono eyebrow naming the section's status bucket. */
  title: string
  /** List query input from a shared builder, so the key matches the server prefetch (hydration parity). */
  input: ProjectsListInput
  /** Shown when the section has zero rows. */
  emptyMessage: string
}

/**
 * One labeled sub-section of the dashboard Projects module: an eyebrow label +
 * the full-predicate total (a SQL `count()`, independent of the display cap),
 * then a capped `EntityList` of `DashboardProjectCard`s (or its empty state).
 * The section header IS the status bucket — derived from `pipelineStage` via
 * `PROJECT_STAGE_BUCKET`, not the vestigial `status` column — so the cards
 * carry no coarse status badge, only their specific pipeline stage. Mirrors
 * `DashboardProposalSection` so the dashboard's list modules read as one family,
 * including suspending until its rows resolve (DashboardProjects supplies the
 * fallback).
 */
export function DashboardProjectSection({ title, input, emptyMessage }: DashboardProjectSectionProps) {
  const trpc = useTRPC()
  const { data } = useSuspenseQuery(trpc.projectsRouter.crud.list.queryOptions(input))

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">{title}</p>
        <span className="font-mono text-[0.72rem] tabular-nums text-muted-foreground">{data.total}</span>
      </div>
      <EntityList
        title={title}
        hideHeader
        items={data.rows}
        getItemKey={row => row.id}
        renderItem={row => <DashboardProjectCard row={row} />}
        emptyState={{ message: emptyMessage }}
        itemsClassName="space-y-2"
        variant="flush"
      />
    </section>
  )
}
```

- [ ] **Step 7: Replace `dashboard-proposals.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { Suspense } from 'react'

import { awaitingProposalsInput, sentProposalsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardModule } from '@/features/agent-dashboard/ui/components/dashboard-module'
import { DashboardProposalSection } from '@/features/agent-dashboard/ui/components/dashboard-proposal-section'
import { DashboardSectionSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-section-skeleton'
import { ROOTS } from '@/shared/config/roots'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'

const OUT_FOR_SIGNATURE = 'Out for signature'
const SENT_AWAITING = 'Sent — awaiting response'

/**
 * Proposals module — two truthful, non-overlapping sections: "Out for signature"
 * (contract envelope out for signature) and "Sent — awaiting response" (proposal
 * sent, no contract yet). Each section header names the state, so the rows carry
 * no status badge. Each section reuses the exact query keys the dashboard route
 * prefetches (`awaitingProposalsInput` / `sentProposalsInput`) and streams in
 * behind its own Suspense; the card chrome renders at once, and a failed query
 * stays inside this card.
 */
export function DashboardProposals() {
  return (
    <DashboardModule
      title="Proposals"
      action={(
        <Link
          href={ROOTS.dashboard.proposals.root()}
          className="-mr-2 -my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
        >
          See all →
        </Link>
      )}
    >
      <HydrationErrorBoundary>
        <div className="flex flex-col gap-4">
          <Suspense fallback={<DashboardSectionSkeleton title={OUT_FOR_SIGNATURE} />}>
            <DashboardProposalSection
              title={OUT_FOR_SIGNATURE}
              input={awaitingProposalsInput()}
              timeSince="contractSentAt"
              emptyMessage="None out for signature"
            />
          </Suspense>
          <Suspense fallback={<DashboardSectionSkeleton title={SENT_AWAITING} />}>
            <DashboardProposalSection
              title={SENT_AWAITING}
              input={sentProposalsInput()}
              timeSince="sentAt"
              emptyMessage="Nothing sent awaiting a response"
            />
          </Suspense>
        </div>
      </HydrationErrorBoundary>
    </DashboardModule>
  )
}
```

- [ ] **Step 8: Replace `dashboard-projects.tsx`**

```tsx
'use client'

import Link from 'next/link'
import { Suspense } from 'react'

import { activeProjectsInput, onHoldProjectsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardModule } from '@/features/agent-dashboard/ui/components/dashboard-module'
import { DashboardProjectSection } from '@/features/agent-dashboard/ui/components/dashboard-project-section'
import { DashboardSectionSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-section-skeleton'
import { ROOTS } from '@/shared/config/roots'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'

const ACTIVE = 'Active'
const ON_HOLD = 'On hold'

/**
 * Projects module — two truthful, non-overlapping sections grouped by the
 * status bucket derived from `pipelineStage` (NOT the vestigial `status`
 * column, which is ~always 'active'): "Active" (live work, signed → full
 * payment) and "On hold" (paused). Each section reuses the exact query keys the
 * dashboard route prefetches (`activeProjectsInput` / `onHoldProjectsInput`)
 * and streams in behind its own Suspense; a failed query stays inside this
 * card. Completed/cancelled projects are terminal — reachable via "See all →".
 */
export function DashboardProjects() {
  return (
    <DashboardModule
      title="Projects"
      action={(
        <Link
          href={ROOTS.dashboard.projects.root()}
          className="-mr-2 -my-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
        >
          See all →
        </Link>
      )}
    >
      <HydrationErrorBoundary>
        <div className="flex flex-col gap-4">
          <Suspense fallback={<DashboardSectionSkeleton title={ACTIVE} />}>
            <DashboardProjectSection
              title={ACTIVE}
              input={activeProjectsInput()}
              emptyMessage="No active projects"
            />
          </Suspense>
          <Suspense fallback={<DashboardSectionSkeleton title={ON_HOLD} />}>
            <DashboardProjectSection
              title={ON_HOLD}
              input={onHoldProjectsInput()}
              emptyMessage="Nothing on hold"
            />
          </Suspense>
        </div>
      </HydrationErrorBoundary>
    </DashboardModule>
  )
}
```

- [ ] **Step 9: Checks (Review Focus 4 and 5, second half)**

Run: `pnpm tsc && CI=1 npx eslint --fix src/features/agent-dashboard/ui/components/dashboard-{snapshot-chips,snapshot-strip,hero,section-skeleton,proposal-section,project-section,proposals,projects}.tsx`

With Playwright (authenticated):
1. **Data without JS (RF 5):** `async (page) => { await page.route('**/_next/static/chunks/**', r => r.abort()); await page.goto('/dashboard'); await page.waitForTimeout(1500); const text = await page.locator('main').innerText(); await page.unroute('**/_next/static/chunks/**'); return text }` — expected: the text contains "Out for signature" and "Active" plus either proposal/project rows or the empty messages ("None out for signature", "No active projects"), and the three snapshot chips show numbers, not "—".
2. **No skeleton on cached soft navigation (RF 4):** arm the observer from Task 10 Step 8.2 with the selector `'[data-slot="dashboard-content-skeleton"], [data-slot="dashboard-section-skeleton"]'`, navigate Dashboard → Customers → Dashboard via the sidebar, and evaluate the flag. Expected: `false`.
3. **No hydration errors:** `browser_console_messages` after a hard reload of `/dashboard` — no "Hydration failed" / "did not match" and no `[prefetch drift]` errors.

- [ ] **Step 10: Commit**

```bash
git add -- src/features/agent-dashboard/ui/components/dashboard-snapshot-chips.tsx src/features/agent-dashboard/ui/components/dashboard-section-skeleton.tsx
git commit -F - -- src/features/agent-dashboard/ui/components/dashboard-snapshot-chips.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx src/features/agent-dashboard/ui/components/dashboard-hero.tsx src/features/agent-dashboard/ui/components/dashboard-section-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx src/features/agent-dashboard/ui/components/dashboard-project-section.tsx src/features/agent-dashboard/ui/components/dashboard-proposals.tsx src/features/agent-dashboard/ui/components/dashboard-projects.tsx <<'MSG'
perf(dashboard): home modules suspend, so their data arrives in the streamed HTML

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 14: Permissions come from the server session

**Files:**
- Modify: `src/shared/components/providers/casl-provider.tsx` (whole file)
- Create: `src/shared/components/providers/session-ability-provider.tsx`
- Modify: `src/shared/components/providers/index.tsx` (whole file)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-session-content.tsx` (whole file)
- Modify: `src/app/(frontend)/dashboard/layout.tsx` (`GlobalDialogs` line)
- Modify: `src/app/(frontend)/proposal-flow/layout.tsx`
- Modify: `src/app/(frontend)/(site)/layout.tsx`

**Interfaces:**
- Consumes: `defineAbilitiesFor(user: { id: string, role: UserRole } | null)`; `AbilityContext`; `useSession()` from `@/shared/domains/auth/client`.
- Produces: `AbilityProvider({ user: { id: string, role: UserRole } | null, children })` (no longer fetches); `SessionAbilityProvider({ children })`.

Before Step 1, capture the baseline for Step 7: with Playwright (authenticated), open a customer profile from a dashboard proposal card's customer link (it opens through `GlobalDialogs`) and take a screenshot of the modal's hero actions.

- [ ] **Step 1: Replace `casl-provider.tsx`**

```tsx
'use client'

import type { UserRole } from '@/shared/constants/enums'

import { useMemo } from 'react'

import { defineAbilitiesFor } from '@/shared/domains/permissions/abilities'
import { AbilityContext } from '@/shared/domains/permissions/context'

interface AbilityProviderProps {
  user: { id: string, role: UserRole } | null
  children: React.ReactNode
}

// Builds the CASL ability from a user its caller already holds. The dashboard
// and proposal-flow layouts pass their server session, so permission-gated UI
// is right on the first render and nothing waits on a client session fetch.
export function AbilityProvider({ user, children }: AbilityProviderProps) {
  const userId = user?.id ?? null
  const userRole = user?.role ?? null

  // Rebuild only when id or role change (primitives), not on every new user object.
  const ability = useMemo(
    () => defineAbilitiesFor(userId ? { id: userId, role: userRole! } : null),
    [userId, userRole],
  )

  return (
    <AbilityContext value={ability}>
      {children}
    </AbilityContext>
  )
}
```

- [ ] **Step 2: `session-ability-provider.tsx`**

```tsx
'use client'

import { useSession } from '@/shared/domains/auth/client'

import { AbilityProvider } from './casl-provider'

// For route groups with no server session in hand (the marketing site): the
// ability follows better-auth's client session and denies everything until it
// loads.
export function SessionAbilityProvider({ children }: { children: React.ReactNode }) {
  const { data } = useSession()
  const user = data?.user ? { id: data.user.id, role: data.user.role! } : null

  return <AbilityProvider user={user}>{children}</AbilityProvider>
}
```

- [ ] **Step 3: Replace `providers/index.tsx` (AbilityProvider removed)**

```tsx
'use client'

import { NuqsProvider } from './nuqs-adapter'
import { RealtimeProvider } from './realtime-provider'
import { ThemeProvider } from './theme-provider'
import { ToasterProvider } from './toaster-provider'
import { TooltipProvider } from './tooltip-provider'
import { TRPCReactProvider } from './trpc-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <RealtimeProvider>
        <NuqsProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              {children}
            </TooltipProvider>
            <ToasterProvider />
          </ThemeProvider>
        </NuqsProvider>
      </RealtimeProvider>
    </TRPCReactProvider>
  )
}
```

- [ ] **Step 4: Replace `dashboard-session-content.tsx` (provider + GlobalDialogs)**

```tsx
import { DashboardSignIn } from '@/features/agent-dashboard/ui/components/dashboard-sign-in'
import { GlobalDialogs } from '@/shared/components/dialogs/modals/global-dialogs'
import { PushSubscriptionBanner } from '@/shared/components/push-subscription-banner'
import { AbilityProvider } from '@/shared/components/providers/casl-provider'
import { getCachedSession } from '@/shared/domains/auth/lib/get-cached-session'

// Owns the session read for the page slot. A session cookie that no longer maps
// to a session (expired, revoked) lands here as null and gets the sign-in
// screen. GlobalDialogs sits under the AbilityProvider because the modal store
// renders caller-supplied components (the customer profile modal, entity
// actions) at this position in the React tree, and they read permissions; its
// DOM position does not matter — dialogs portal to <body>.
export async function DashboardSessionContent({ children }: { children: React.ReactNode }) {
  const session = await getCachedSession()
  if (!session) {
    return (
      <>
        <GlobalDialogs />
        <DashboardSignIn />
      </>
    )
  }
  return (
    <AbilityProvider user={{ id: session.user.id, role: session.user.role }}>
      <GlobalDialogs />
      <PushSubscriptionBanner />
      {children}
    </AbilityProvider>
  )
}
```

- [ ] **Step 5: Layouts**

`src/app/(frontend)/dashboard/layout.tsx`: change `<GlobalDialogs />` to `{!hasSessionCookie && <GlobalDialogs />}` (the signed-in path renders it inside `DashboardSessionContent`).

`src/app/(frontend)/proposal-flow/layout.tsx`: add `import { AbilityProvider } from '@/shared/components/providers/casl-provider'` and wrap the returned fragment's children:

```tsx
  return (
    <AbilityProvider user={session ? { id: session.user.id, role: session.user.role } : null}>
      <ProposalSplashScreen isAuthenticated={isAuthenticated} />
      <GlobalDialogs />
      <ProposalFlowShell>
        {/* …unchanged… */}
      </ProposalFlowShell>
    </AbilityProvider>
  )
```

(Replace the outer `<>` / `</>` with `<AbilityProvider …>` / `</AbilityProvider>`; the children stay exactly as they are.)

`src/app/(frontend)/(site)/layout.tsx`: add `import { SessionAbilityProvider } from '@/shared/components/providers/session-ability-provider'` and replace the outer `<>` / `</>` of the returned tree with `<SessionAbilityProvider>` / `</SessionAbilityProvider>`.

- [ ] **Step 6: Type-check and lint**

Run: `pnpm tsc && CI=1 npx eslint --fix src/shared/components/providers/casl-provider.tsx src/shared/components/providers/session-ability-provider.tsx src/shared/components/providers/index.tsx src/features/agent-dashboard/ui/components/dashboard-session-content.tsx 'src/app/(frontend)/dashboard/layout.tsx' 'src/app/(frontend)/proposal-flow/layout.tsx' 'src/app/(frontend)/(site)/layout.tsx'`
Expected: no errors. If `tsc` rejects `session.user.role` as `UserRole` in a layout, match `AppSidebar`, which passes `user.role` to `defineAbilitiesFor` directly — the server session's `role` is already `UserRole`.

- [ ] **Step 7: Browser checks (Review Focus 1)**

With Playwright (authenticated as the default super-admin):
1. Record requests while loading `/dashboard` (`browser_network_requests` after a hard reload). Expected: no request to `/api/auth/get-session`.
2. Open the same customer profile from the dashboard proposal card's customer link. Expected: the hero actions match the baseline screenshot taken before Step 1.
3. `/dashboard/customers`: the row action menus still list their actions.
4. A proposal-flow page for an existing proposal (open one from `/dashboard/proposals`): the navbar menu and heading actions that were visible before are still visible.
5. The marketing home `/`: the navbar renders; `/services/...` pages show the catalog refresh button only for the signed-in admin.

- [ ] **Step 8: Commit**

```bash
git add -- src/shared/components/providers/session-ability-provider.tsx
git commit -F - -- src/shared/components/providers/casl-provider.tsx src/shared/components/providers/session-ability-provider.tsx src/shared/components/providers/index.tsx src/features/agent-dashboard/ui/components/dashboard-session-content.tsx 'src/app/(frontend)/dashboard/layout.tsx' 'src/app/(frontend)/proposal-flow/layout.tsx' 'src/app/(frontend)/(site)/layout.tsx' <<'MSG'
perf(permissions): the dashboard and proposal flow seed abilities from the server session

The root AbilityProvider fetched /api/auth/get-session on every page and denied
everything until it answered.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 15: Ably's browser client mounts only in meeting-flow; drop `next-pwa`

**Files:**
- Modify: `src/shared/components/providers/index.tsx` (whole file)
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (import + `MeetingFlowView`)
- Modify: `package.json`, `pnpm-lock.yaml` (via `pnpm remove next-pwa`)

- [ ] **Step 1: Replace `providers/index.tsx` (RealtimeProvider removed)**

```tsx
'use client'

import { NuqsProvider } from './nuqs-adapter'
import { ThemeProvider } from './theme-provider'
import { ToasterProvider } from './toaster-provider'
import { TooltipProvider } from './tooltip-provider'
import { TRPCReactProvider } from './trpc-provider'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCReactProvider>
      <NuqsProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <TooltipProvider>
            {children}
          </TooltipProvider>
          <ToasterProvider />
        </ThemeProvider>
      </NuqsProvider>
    </TRPCReactProvider>
  )
}
```

- [ ] **Step 2: Wrap `MeetingFlowView` in `RealtimeProvider`**

Add `import { RealtimeProvider } from '@/shared/components/providers/realtime-provider'` to `meeting-flow.tsx`, and replace

```tsx
  return (
    <ChannelProvider channelName={`meeting:${meetingId}`}>
      <MeetingFlowViewInner meetingId={meetingId} splashOpen={splashOpen} />
    </ChannelProvider>
  )
```

with

```tsx
  // Realtime mounts here, in the only view that subscribes, so no other page
  // downloads Ably or opens its WebSocket.
  return (
    <RealtimeProvider>
      <ChannelProvider channelName={`meeting:${meetingId}`}>
        <MeetingFlowViewInner meetingId={meetingId} splashOpen={splashOpen} />
      </ChannelProvider>
    </RealtimeProvider>
  )
```

- [ ] **Step 3: Type-check, lint, and check the meeting page connects**

Run: `pnpm tsc && CI=1 npx eslint --fix src/shared/components/providers/index.tsx src/features/meeting-flow/ui/views/meeting-flow.tsx`

With Playwright (authenticated), via `browser_run_code_unsafe`:

```js
async (page) => {
  const sockets = []
  page.on('websocket', ws => sockets.push(ws.url()))
  await page.goto('/dashboard')
  await page.waitForTimeout(2000)
  const onDashboard = sockets.filter(u => u.includes('ably')).length
  const href = await page.locator('a[href^="/dashboard/meetings/"]').first().getAttribute('href')
  await page.goto(href)
  await page.waitForTimeout(3000)
  return { onDashboard, onMeeting: sockets.filter(u => u.includes('ably')).length - onDashboard, href }
}
```

Expected: `onDashboard: 0`, `onMeeting: 1` (or more), no console errors on the meeting page. If the dashboard has no meeting link, open `/dashboard/meetings` and use its first row's link instead.

- [ ] **Step 4: Remove `next-pwa` — only if `package.json` is clean**

Run: `git diff --quiet -- package.json && echo clean || echo dirty`
If `dirty`: STOP and ask the owner to commit (or discard) their own `package.json` edit first — committing `package.json` now would sweep their change into this commit. Continue after they confirm it is clean.
Then run: `pnpm remove next-pwa`
Expected: `package.json` loses the `"next-pwa"` line and `pnpm-lock.yaml` shrinks; `grep -rn "next-pwa" --include=*.{ts,tsx,js,mjs} src next.config.ts` → no output.

- [ ] **Step 5: Commit**

```bash
git commit -F - -- src/shared/components/providers/index.tsx src/features/meeting-flow/ui/views/meeting-flow.tsx <<'MSG'
perf(realtime): Ably's browser client mounts only in meeting-flow

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
git commit -F - -- package.json pnpm-lock.yaml <<'MSG'
chore(deps): remove next-pwa, never wired into next.config

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

### Task 16: Phase 2 gate — verify, ship, measure; Phase 3 hand-off; clean up

**Files:**
- Modify: `docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md` (§4.3, §10)
- Modify: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-pwa-startup-performance.md`

- [ ] **Step 1: Full verification + rebuild the profile**

Run: `pnpm tsc && pnpm lint`
Run (repo root): `bash .worktrees/perf-tools/rebuild-profile.sh main`, then (from `.worktrees/perf-profile`): `node ../perf-tools/bytes.mjs 12 && node ../perf-tools/measure-local.mjs 3`
Expected: the Phase 1 targets still hold, and `dashboard client chunks containing Ably: 0`.

- [ ] **Step 2: STOP — owner ships**

As Task 11 Step 2: list `git log --oneline origin/main..main`, ask the owner to push or to let Claude push, wait for the deploy.

- [ ] **Step 3: Measure (as Task 11 Steps 3–4)**

`bash .worktrees/perf-tools/measure-prod.sh` right after the deploy; then the owner's signed-in cold/warm reading, three cold + three warm device launches, Vercel Observability numbers, and the §8 device checks. Record a "Phase 2 shipped (<date>)" row in §10 and set the Phase 2 rows to ✅. Add the Step 1 local numbers to §4.3.

- [ ] **Step 4: Phase 3 hand-off (owner decision)**

Present the before/after table (baseline → Phase 1 → Phase 2) and apply the spec §7 decision rule to the Phase 2 numbers:
- function boot still the largest cold cost (no-cookie cold TTFB right after a deploy well above warm) → recommend **Vercel Pro** first;
- signed-in cold time-to-data still clearly above the no-cookie cold reading (the DB wake) → recommend **Neon Launch** with scale-to-zero off.
The owner decides; Claude makes no plan changes. Record the decision in §10 ("Phase 3 — paid decision").

- [ ] **Step 5: Commit the measurements**

```bash
git commit -F - -- docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md <<'MSG'
docs(pwa): record the Phase 2 measurements and the paid-tier decision

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
MSG
```

- [ ] **Step 6: Clean up**

1. Remove the profile worktree and tools (this deletes the owner's prod cookie file): `git worktree remove --force .worktrees/perf-profile && rm -rf .worktrees/perf-tools`.
2. Update the memory file `project-pwa-startup-performance.md`: replace the "CURRENT STATE" block with the shipped state (what landed, final numbers, the paid decision) and trim the superseded history.
3. Per CLAUDE.md ("a plan or spec is deleted once it ships"): once the owner confirms the Phase 3 decision is final, delete this plan and the spec in one commit (`git rm -- docs/superpowers/plans/2026-09-29-pwa-cold-start.md docs/superpowers/specs/2026-09-29-pwa-cold-start-design.md` then `git commit -F - -- <both paths>`), and ask the owner whether to delete the remote research branch `origin/claude/pwa-loading-optimization-be6nlb` (outward-facing: only on their yes).
