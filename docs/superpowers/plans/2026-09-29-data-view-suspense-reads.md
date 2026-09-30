# Data-view Suspense Reads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every data view reads its server-prefetched rows with `useSuspenseQuery`, so the server streams real rows into the HTML, hydration mismatches stop, and every loading state is the real view drawn without rows, aligned with the content it stands in for.

**Architecture:** `useDataViewQuery` and `usePaginatedQuery` keep their names. Inside, each one defers the URL state (`useDeferredValue`), derives the requested and the shown input, and reads the shown input with `useSuspenseQuery`. A `DataViewBoundary` renders its own children as its Suspense fallback inside a pending context. In that context the hooks return the view with no rows instead of suspending, so the loading state is the real toolbar, table skeleton rows and calendar skeletons. The dashboard layout's fallback reuses the same pending views per route.

**Tech Stack:** Next.js 15.5 App Router · React 19 · `@tanstack/react-query` 5.104.0 through `@trpc/tanstack-react-query` 11 (`httpBatchLink`, `staleTime` 30s) · nuqs 2.8.8 · react-error-boundary · Tailwind v4 · shadcn/ui · Playwright + `tsx` for the browser harness (no unit-test runner in this repo).

**Spec:** `docs/superpowers/specs/2026-09-29-data-view-suspense-reads-design.md` (approved 2026-09-29, D1–D11). Read it before starting; this plan argues from it.

## Global Constraints

- **Read hooks:** `useSuspenseQuery` on the shown input; `useDeferredValue` on the nuqs URL state; no nuqs `startTransition` option; no `placeholderData`; no `enabled` option (D1, D3, D8).
- **Result fields:** `rows`, `total`, `isPending`, `isStale`, `isFetching`, `refresh`, `filterSort`, `window` (plus the paginated extras). Removed: `isLoading`, `isPlaceholderData`, `isError`, `error` (D8).
  - `isPending` is true only inside a `DataViewBoundary` fallback (no rows exist yet).
  - `isStale`: `hashKey(requested key) !== hashKey(shown key)`.
  - A date window's `window.isPending` is `isPending || isStale`.
- **Stale dimming:** the table's `<table>` gets `data-stale` and `transition-opacity duration-200 data-[stale=true]:opacity-60 data-[stale=true]:delay-200`. The delay applies only on the way in (Q2).
- **Skeletons match content (D11):** the loading state of a data view is the real view in the pending context. The dashboard home's section and card skeletons copy their card's frame classes and row heights. The harness `align` mode must pass with 2 px tolerance.
- **Commit rule:** a hook and all its callers switch in one commit. No shims survive a commit. `pnpm tsc` and `pnpm lint` are clean after every commit.
- **New exported names (owner approves at plan review; any other new export: stop and ask):**
  - `DataViewBoundary`, `DataViewPendingContext`, `useIsDataViewPending`, `useServerPrefetchGuard`, `EMPTY_DATA_VIEW_READ`
  - `DASHBOARD_MAIN_CLASS`, `DASHBOARD_ROUTE_PENDING_VIEWS`, `DashboardGenericContentSkeleton`
  - `DashboardProposalCardSkeleton`, `DashboardProjectCardSkeleton`
  - `DashboardHomePendingView`, `CustomersRoutePendingView`, `ProposalsRoutePendingView`, `ProjectsRoutePendingView`
  - The result field `isStale`
- **Files:** only the ones named in each task, plus throwaway files under `.superpowers/sdd/2026-09-29-data-view-suspense-reads/` (gitignored, never committed). `package.json`, the query client, `prefetch.ts` and `HydrateClient` stay untouched.
- **Checks:** `pnpm tsc` and `pnpm lint`. Never `pnpm build`. Never write to any database. The harness's dev-session sign-in is the only accepted write.
- **Git, on a shared workbench (local `main`, other sessions commit concurrently):**
  - Stage new files with `git add -- <path>` and commit with `git commit -m "…" -- <explicit paths>`.
  - Never `git add -A`, `git add .`, `git add -u`, `git commit -a`, `--amend`, `git stash`, `git checkout -- .`, `git restore`, `git reset` or `git clean`.
  - The index holds another session's staged deletion (`scripts/snapshot-prod-to-dev.ts`); leave it out of every commit.
  - End each commit message with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
  - Confirm with `git show --stat HEAD`. If a commit comes out wrong, STOP and report.
- **Uncommitted work this plan builds on** (from the same session, in the tree now; Task 0 commits it):
  - `use-is-hydrating.ts` and its four callers
  - the dashboard section/strip suspense files
  - `ServerAbilityProvider`
  - the `HydrationErrorFallback` `section` variant and the `prefetch.ts` comment
  - the TanStack bump in `package.json` / `pnpm-lock.yaml`
- **Code style:** comments say why, never what, and never cite plans, specs or tasks. One React component per file. No file-level constants in component files (they go in `constants/`). Named exports; `@/` alias. Auto-fix lint only on your own files: `pnpm exec eslint --fix <paths>`.
- **Dev server:** use the one on `:3000` (`ss -ltnp | grep :3000`). Never kill it. It must be running 5.104.0: if `curl -s localhost:3000/dashboard -b <jar> | grep -o 'react-query@[0-9.]*' | sort -u` prints `5.90.20`, STOP and ask the owner to restart it.

## Review Focus

1. **Typing fast in the search box:** each committed search (after the debounce) must keep the old rows dimmed, never flash the fallback, and end on the last search's rows. Pinned in Task 2 (`filter` mode, two searches in quick succession).
2. **Back after two filter changes:** the rows for the previous URL must come back with no fallback. Pinned in Task 2 (`back` mode).
3. **A read that fails for a new key** must show the section error and recover on "Try again" once the network is back, and also on Back. Pinned in Task 2 (`error` mode).
4. **A page past the end** (`?p=999` on customers) must clamp to the last page without a fallback loop. Pinned in Task 2 (`clamp` mode).
5. **A cold session on a phone** (layout fallback, then page) must show one continuous skeleton, with no jump when the page swaps in. Pinned in Task 5 (`align` at 390×844 on `/dashboard` and `/dashboard/customers`).

---

## File map

| File | Task | Responsibility |
|---|---|---|
| `.superpowers/sdd/2026-09-29-data-view-suspense-reads/harness.ts` | 1 | Browser checks: hydration, SSR rows, align, filter, back, error, clamp, window-step |
| `src/shared/dal/client/lib/data-view-pending-context.ts` | 2 | `DataViewPendingContext` |
| `src/shared/dal/client/hooks/use-is-data-view-pending.ts` | 2 | Reads the context |
| `src/shared/dal/client/hooks/use-server-prefetch-guard.ts` | 2 | Dev-only: a server suspense read with no prefetch |
| `src/shared/dal/client/constants/empty-data-view-read.ts` | 2 | Query options that resolve at once to `{ rows: [], total: 0 }` |
| `src/shared/components/data-view-boundary.tsx` | 2 | Error boundary + Suspense whose fallback is its children in the pending context |
| `src/shared/dal/client/hooks/use-data-view-query.ts` | 3 | Deferred URL state, suspense read, pending read |
| `src/shared/dal/client/lib/types.ts` | 3, 4 | Result types |
| `src/shared/components/data-table/lib/to-data-table-pagination.ts`, `types.ts`, `ui/data-table.tsx`, `ui/data-table-body.tsx` | 3 | Stale dimming; the error row goes away |
| `src/shared/components/query-toolbar/ui/bar.tsx`, `src/shared/components/records-page-header.tsx` | 3 | Read `isPending` / `isStale` |
| Callers #1, #2, #5–#10 (spec §5.2) | 3 | Boundaries; loading/error branches go |
| `src/shared/dal/client/hooks/use-paginated-query.ts`, `src/shared/dal/client/lib/from-paginated-query.ts` | 3 (interim map), 4 | Same core for the legacy hook |
| Callers #3, #4, #11 + `campaigns/page.tsx` | 4 | Boundaries; leads prefetch |
| `src/features/agent-dashboard/ui/components/dashboard-{proposal,project}-card-skeleton.tsx`, `dashboard-list-section-skeleton.tsx`, sections, strip | 5 | Card-shaped skeletons; sections honour the pending context |
| `src/features/agent-dashboard/constants/dashboard-main.ts`, `constants/route-pending-views.ts`, `ui/components/dashboard-content-skeleton.tsx`, `dashboard-generic-content-skeleton.tsx`, `src/app/(frontend)/dashboard/template.tsx` | 6 | Route-aware layout fallback |

---

### Task 0: Commit the pilot already in the tree

The session that wrote this plan left verified, uncommitted work that later tasks build on. Commit it first so every later diff is only this plan's.

**Files (commit only these):**
- `package.json`: only the `@tanstack/react-query` line. Another session also has uncommitted `scripts` changes in this file; see Step 1.
- `pnpm-lock.yaml`
- `src/shared/hooks/use-is-hydrating.ts`
- `src/app/(frontend)/dashboard/template.tsx`
- `src/shared/components/records-page-motion-shell.tsx`
- `src/features/schedule-management/ui/views/schedule-view.tsx`
- `src/features/project-management/ui/views/create-project-view.tsx`
- `src/features/agent-dashboard/ui/components/`:
  - `dashboard-list-section-header.tsx`, `dashboard-list-section-skeleton.tsx`
  - `dashboard-proposal-section.tsx`, `dashboard-proposal-section-list.tsx`
  - `dashboard-project-section.tsx`, `dashboard-project-section-list.tsx`
  - `dashboard-snapshot-chips.tsx`, `dashboard-snapshot-counts.tsx`, `dashboard-snapshot-strip.tsx`
  - `dashboard-session-content.tsx`
- `src/shared/components/providers/server-ability-provider.tsx`
- `src/app/(frontend)/proposal-flow/layout.tsx`
- `src/trpc/components/hydration-error-boundary.tsx`, `src/trpc/components/hydration-error-fallback.tsx`
- `src/trpc/lib/prefetch.ts`

- [ ] **Step 1: Stage only the dependency line of `package.json`**

`git diff package.json` also shows another session's `scripts` edits (`db:refresh:dev`, `email`). Stage only the dependency hunk:

```bash
git diff package.json > /tmp/pkg.diff
python3 - <<'EOF'
import re
d = open('/tmp/pkg.diff').read()
header, *hunks = re.split(r'(?m)^(?=@@)', d)
keep = [h for h in hunks if '@tanstack/react-query' in h]
assert len(keep) == 1, keep
open('/tmp/pkg-dep.diff', 'w').write(header + keep[0])
EOF
git apply --cached /tmp/pkg-dep.diff
git diff --cached package.json
```
Expected: one hunk, `-    "@tanstack/react-query": "^5.80.7",` → `+    "@tanstack/react-query": "^5.104.0",`.

- [ ] **Step 2: Check and commit**

```bash
pnpm tsc && pnpm lint
git add -- src/shared/hooks/use-is-hydrating.ts src/features/agent-dashboard/ui/components/dashboard-list-section-header.tsx src/features/agent-dashboard/ui/components/dashboard-list-section-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-section-list.tsx src/features/agent-dashboard/ui/components/dashboard-project-section-list.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-chips.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-counts.tsx src/shared/components/providers/server-ability-provider.tsx
git commit -m "perf(dashboard): server HTML is visible before hydration; home sections stream their rows; permissions seeded from the server session

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- package.json pnpm-lock.yaml src/shared/hooks/use-is-hydrating.ts 'src/app/(frontend)/dashboard/template.tsx' src/shared/components/records-page-motion-shell.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/features/project-management/ui/views/create-project-view.tsx src/features/agent-dashboard/ui/components/dashboard-list-section-header.tsx src/features/agent-dashboard/ui/components/dashboard-list-section-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-section-list.tsx src/features/agent-dashboard/ui/components/dashboard-project-section.tsx src/features/agent-dashboard/ui/components/dashboard-project-section-list.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-chips.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-counts.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx src/features/agent-dashboard/ui/components/dashboard-session-content.tsx src/shared/components/providers/server-ability-provider.tsx 'src/app/(frontend)/proposal-flow/layout.tsx' src/trpc/components/hydration-error-boundary.tsx src/trpc/components/hydration-error-fallback.tsx src/trpc/lib/prefetch.ts
git show --stat HEAD
```
Expected:
- `package.json` shows exactly the 1-line dependency change, and `git diff package.json` still shows the other session's `scripts` edits, unstaged.
- `scripts/snapshot-prod-to-dev.ts` is not in the commit.

---

### Task 1: Browser harness and baseline

**Files:**
- Create: `.superpowers/sdd/2026-09-29-data-view-suspense-reads/harness.ts`
- Output: `.superpowers/sdd/2026-09-29-data-view-suspense-reads/baseline.txt`

**Interfaces:**
- Produces: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-suspense-reads/harness.ts <mode> <path> [args]`. It exits 0 and prints `PASS <mode> <path>`, or prints one `FAIL …` line per failure and exits 1. Later tasks call these modes:
  - `hydration <path> [runs=5]`: fresh context per run; fails on any `Hydration failed` page error or console error.
  - `ssr-rows <path> <selector>`: JS off; passes if `selector` matches at least one element anywhere in the DOM, including React's hidden streamed segments. That means the rows were in the server HTML.
  - `align <path> <desktop|phone>`: compares element boxes on the JS-off first paint (the layout fallback) and on the settled JS page, using the per-route selector table below.
  - `filter <path> <searchA> <searchB>`: types A then B into the toolbar search. Passes if `[data-slot=data-view-pending]` never appears and data rows are present at every 50 ms sample.
  - `back <path> <searchA> <searchB>`: after A then B, `page.goBack()`. The search box shows A, and pending never appears.
  - `error <path> <procedure> <search>`: aborts `**/api/trpc/*<procedure>*`, types `search`, and expects the text "This section failed to load". It then stops aborting, clicks "Try again", and expects rows.
  - `clamp <path>`: loads `<path>?p=999`; within 8 s the URL's `p` is the last page, rows are shown, and pending is gone.
  - `window-step <path>`: clicks "Next" (`aria-label="Next"`, `calendar-header.tsx`) three times. The first two windows are prefetched (radius ±2) and should show at once; the third is not. For 1.5 s it samples: any `main [aria-busy="true"]` region must contain `[data-slot=skeleton]` elements (the ruling: skeletons, never another window's rows). Within 6 s nothing is busy.
  - `softnav <path> <otherPath>`: loads `path`, clicks the sidebar link to `otherPath`, then back to `path`. `[data-slot=data-view-pending]` must never appear on the return, because the rows are cached.

- [ ] **Step 1: Write the harness**

```ts
// .superpowers/sdd/2026-09-29-data-view-suspense-reads/harness.ts
import type { Browser, BrowserContext, Page } from 'playwright'
import { readFileSync } from 'node:fs'
import process from 'node:process'
import { chromium } from 'playwright'

const BASE = 'http://localhost:3000'
const secret = readFileSync('.env.local', 'utf8').match(/^DEV_LOGIN_SECRET=(.*)$/m)![1].replace(/"/g, '').trim()
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const
const ROW_SELECTOR = '[data-table-row], [data-meeting-row], [data-project-row]'
const PENDING = '[data-slot=data-view-pending]'

// Selectors compared by `align`, per route. `dims` = which box edges must match (2 px tolerance); `n` = how many matches to pair.
const ALIGN: Record<string, { sel: string, n: number, dims: ('x' | 'y' | 'w' | 'h')[] }[]> = {
  '/dashboard': [
    { sel: 'main h1', n: 1, dims: ['x', 'y', 'h'] },
    { sel: 'main a[href^="#"]', n: 3, dims: ['x', 'y', 'w', 'h'] },
    { sel: 'main .rounded-xl.border', n: 3, dims: ['x', 'y', 'w'] },
    { sel: '#meetings .rounded-xl.border', n: 1, dims: ['h'] },
    { sel: '#proposals section > div:first-child', n: 2, dims: ['x', 'y', 'w', 'h'] },
    { sel: '#proposals .rounded-lg.border', n: 2, dims: ['x', 'y', 'w', 'h'] },
    { sel: '#projects .rounded-lg.border', n: 2, dims: ['x', 'w', 'h'] },
  ],
  '/dashboard/customers': [
    { sel: 'main h2', n: 1, dims: ['x', 'y', 'h'] },
    { sel: 'main input[placeholder^="Search"]', n: 1, dims: ['x', 'y', 'w', 'h'] },
    { sel: 'main thead tr', n: 1, dims: ['x', 'y', 'w', 'h'] },
    { sel: 'main tbody tr', n: 3, dims: ['x', 'y', 'w', 'h'] },
  ],
  '/dashboard/meetings': [
    { sel: 'main h2', n: 1, dims: ['x', 'y', 'h'] },
    { sel: 'main input[placeholder^="Search"]', n: 1, dims: ['x', 'y', 'w', 'h'] },
    { sel: 'main thead tr', n: 1, dims: ['x', 'y', 'w', 'h'] },
    { sel: 'main tbody tr', n: 3, dims: ['x', 'y', 'h'] },
  ],
  '/dashboard/schedule': [
    { sel: 'main input[placeholder^="Search"]', n: 1, dims: ['x', 'y', 'w', 'h'] },
    { sel: 'main button[aria-label="Next"]', n: 1, dims: ['x', 'y'] },
  ],
}

async function signedIn(browser: Browser, opts: { js?: boolean, viewport?: keyof typeof VIEWPORTS } = {}): Promise<{ ctx: BrowserContext, page: Page }> {
  const vp = opts.viewport ?? 'desktop'
  const ctx = await browser.newContext({ javaScriptEnabled: opts.js ?? true, viewport: VIEWPORTS[vp], isMobile: vp === 'phone', hasTouch: vp === 'phone' })
  const page = await ctx.newPage()
  await page.goto(`${BASE}/api/dev/playwright-session?secret=${secret}&redirect=/api/auth/get-session`, { waitUntil: 'load', timeout: 120_000 })
  return { ctx, page }
}

async function settle(page: Page, path: string) {
  await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 120_000 })
  await page.waitForFunction(sel => document.querySelectorAll(sel).length === 0, PENDING, { timeout: 60_000 })
  await page.waitForTimeout(1500)
}

async function boxes(page: Page, sel: string, n: number) {
  return page.$$eval(sel, (els, n) => els.slice(0, n).map((el) => {
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }), n)
}

async function search(page: Page, text: string) {
  const input = page.locator('main input[placeholder^="Search"]').first()
  await input.fill(text)
  await page.waitForTimeout(600) // past the toolbar debounce
}

const failures: string[] = []
const fail = (msg: string) => failures.push(`FAIL ${msg}`)

async function run(browser: Browser, mode: string, path: string, args: string[]) {
  switch (mode) {
    case 'hydration': {
      const runs = Number(args[0] ?? 5)
      for (let i = 0; i < runs; i++) {
        const { ctx, page } = await signedIn(browser)
        let n = 0
        page.on('pageerror', e => { if (/Hydration failed|didn't match/.test(e.message)) n++ })
        page.on('console', m => { if (m.type() === 'error' && /Hydration failed|didn't match/.test(m.text())) n++ })
        await settle(page, path)
        if (n > 0) fail(`hydration ${path} run ${i}: ${n} error(s)`)
        await ctx.close()
      }
      return
    }
    case 'ssr-rows': {
      const { ctx, page } = await signedIn(browser, { js: false })
      await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 120_000 })
      const count = await page.locator(args[0] ?? ROW_SELECTOR).count()
      if (count === 0) fail(`ssr-rows ${path}: no '${args[0] ?? ROW_SELECTOR}' in the server HTML`)
      await ctx.close()
      return
    }
    case 'align': {
      const vp = (args[0] ?? 'desktop') as keyof typeof VIEWPORTS
      const off = await signedIn(browser, { js: false, viewport: vp })
      await off.page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 120_000 })
      const on = await signedIn(browser, { viewport: vp })
      await settle(on.page, path)
      for (const { sel, n, dims } of ALIGN[path] ?? []) {
        const a = await boxes(off.page, sel, n)
        const b = await boxes(on.page, sel, n)
        if (a.length < Math.min(n, b.length)) fail(`align ${path} ${vp} '${sel}': skeleton has ${a.length}, page has ${b.length}`)
        for (let i = 0; i < Math.min(a.length, b.length); i++) {
          for (const d of dims) {
            if (Math.abs(a[i][d] - b[i][d]) > 2) fail(`align ${path} ${vp} '${sel}'[${i}].${d}: skeleton ${a[i][d]} vs page ${b[i][d]}`)
          }
        }
      }
      await off.ctx.close()
      await on.ctx.close()
      return
    }
    case 'filter':
    case 'back': {
      const { ctx, page } = await signedIn(browser)
      await settle(page, path)
      let sawPending = false
      let sawEmpty = false
      const probe = setInterval(async () => {
        const [p, r] = await Promise.all([page.locator(PENDING).count(), page.locator(ROW_SELECTOR).count()]).catch(() => [0, 1])
        if (p > 0) sawPending = true
        if (r === 0) sawEmpty = true
      }, 50)
      await search(page, args[0])
      await search(page, args[1])
      await page.waitForTimeout(2500)
      if (mode === 'back') {
        await page.goBack()
        await page.waitForTimeout(2500)
        const value = await page.locator('main input[placeholder^="Search"]').first().inputValue()
        if (value !== args[0]) fail(`back ${path}: search box shows '${value}', expected '${args[0]}'`)
      }
      clearInterval(probe)
      if (sawPending) fail(`${mode} ${path}: the fallback appeared during a change`)
      if (sawEmpty) fail(`${mode} ${path}: rows vanished during a change (only OK if a search matched nothing; pick searches that match)`)
      await ctx.close()
      return
    }
    case 'error': {
      const [procedure, text] = args
      const { ctx, page } = await signedIn(browser)
      await settle(page, path)
      await ctx.route(`**/api/trpc/*${procedure}*`, r => r.abort())
      await search(page, text)
      await page.getByText('This section failed to load').waitFor({ timeout: 30_000 }).catch(() => fail(`error ${path}: no section error`))
      await ctx.unroute(`**/api/trpc/*${procedure}*`)
      await page.getByRole('button', { name: 'Try again' }).click()
      await page.waitForTimeout(4000)
      if (await page.locator(ROW_SELECTOR).count() === 0) fail(`error ${path}: no rows after Try again`)
      await ctx.close()
      return
    }
    case 'clamp': {
      const { ctx, page } = await signedIn(browser)
      await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}p=999`, { waitUntil: 'load', timeout: 120_000 })
      await page.waitForTimeout(8000)
      const p = new URL(page.url()).searchParams.get('p')
      if (p === '999') fail(`clamp ${path}: page stayed at 999`)
      if (await page.locator(ROW_SELECTOR).count() === 0) fail(`clamp ${path}: no rows`)
      if (await page.locator(PENDING).count() > 0) fail(`clamp ${path}: stuck pending`)
      await ctx.close()
      return
    }
    case 'window-step': {
      const { ctx, page } = await signedIn(browser)
      await settle(page, path)
      const next = page.locator('main button[aria-label="Next"]').first()
      for (let i = 0; i < 3; i++) {
        await next.click()
      }
      const t0 = Date.now()
      while (Date.now() - t0 < 1500) {
        const busy = page.locator('main [aria-busy="true"]')
        if (await busy.count() > 0 && await busy.locator('[data-slot=skeleton]').count() === 0) {
          fail(`window-step ${path}: a pending window shows no skeletons (another window's rows?)`)
          break
        }
        await page.waitForTimeout(15)
      }
      await page.waitForTimeout(4500)
      if (await page.locator('main [aria-busy="true"]').count() > 0) fail(`window-step ${path}: still pending after 6 s`)
      await ctx.close()
      return
    }
    case 'softnav': {
      const other = args[0]
      const { ctx, page } = await signedIn(browser)
      await settle(page, path)
      await page.locator(`[data-slot=sidebar] a[href="${other}"]`).first().click()
      await page.waitForURL(`**${other}`, { timeout: 60_000 })
      await page.waitForTimeout(2000)
      let sawPending = false
      const probe = setInterval(async () => {
        if (await page.locator(PENDING).count().catch(() => 0) > 0) sawPending = true
      }, 25)
      await page.locator(`[data-slot=sidebar] a[href="${path}"]`).first().click()
      await page.waitForURL(`**${path}`, { timeout: 60_000 })
      await page.waitForTimeout(2000)
      clearInterval(probe)
      if (sawPending) fail(`softnav ${path}: the fallback flashed on a return with cached rows`)
      await ctx.close()
      return
    }
    default:
      fail(`unknown mode ${mode}`)
  }
}

;(async () => {
  const [mode, path, ...args] = process.argv.slice(2)
  const browser = await chromium.launch()
  try {
    await run(browser, mode, path, args)
  }
  finally {
    await browser.close()
  }
  if (failures.length) {
    console.log(failures.join('\n'))
    process.exit(1)
  }
  console.log(`PASS ${mode} ${path}`)
})()
```

- [ ] **Step 2: Record the baseline (expected to FAIL; that is the point)**

```bash
H=.superpowers/sdd/2026-09-29-data-view-suspense-reads/harness.ts
{
  for p in /dashboard/customers /dashboard/meetings /dashboard /dashboard/schedule; do pnpm exec tsx $H hydration $p 5; done
  pnpm exec tsx $H ssr-rows /dashboard/customers
  pnpm exec tsx $H ssr-rows /dashboard/meetings '[data-meeting-row]'
  for p in /dashboard /dashboard/customers; do for v in desktop phone; do pnpm exec tsx $H align $p $v; done; done
} 2>&1 | tee .superpowers/sdd/2026-09-29-data-view-suspense-reads/baseline.txt
```
Expected:
- `hydration /dashboard/meetings` fails on most runs (3/3 measured 2026-09-29).
- `ssr-rows` FAILs on both tables.
- `align /dashboard` FAILs with many lines. The layout skeleton has no chips; its main block is at y=100 against real modules at y=189, and it is 256 px tall against a 442 px Meetings card.

Nothing is committed (`.superpowers/` is gitignored).

---

### Task 2: Pending context, `DataViewBoundary`, dev prefetch guard

No behaviour change yet: nothing mounts the boundary.

**Files:**
- Create: `src/shared/dal/client/lib/data-view-pending-context.ts`
- Create: `src/shared/dal/client/hooks/use-is-data-view-pending.ts`
- Create: `src/shared/dal/client/hooks/use-server-prefetch-guard.ts`
- Create: `src/shared/dal/client/constants/empty-data-view-read.ts`
- Create: `src/shared/components/data-view-boundary.tsx`

**Interfaces:**
- Produces:
  - `DataViewPendingContext: React.Context<boolean>` (default `false`)
  - `useIsDataViewPending(): boolean`
  - `useServerPrefetchGuard(queryKey: readonly unknown[], active: boolean): void`
  - `EMPTY_DATA_VIEW_READ`: `useSuspenseQuery` options whose data is `{ rows: [], total: 0 }` and which never suspend
  - `DataViewBoundary({ children }: { children: React.ReactNode })`: fallback = `children` inside `<DataViewPendingContext value={true}>` and a `display: contents` div with `data-slot="data-view-pending"`; error UI = `HydrationErrorFallback variant="section"`; resets when the URL's search params change.

- [ ] **Step 1: Write the four modules and the component**

```ts
// src/shared/dal/client/lib/data-view-pending-context.ts
'use client'

import { createContext } from 'react'

/**
 * True inside a `DataViewBoundary`'s fallback. There, data-view hooks return the view with no rows instead of
 * suspending, so the loading state is the real view (toolbar, table skeleton rows, calendar skeletons) and lines up
 * with it by construction.
 */
export const DataViewPendingContext = createContext(false)
```

```ts
// src/shared/dal/client/hooks/use-is-data-view-pending.ts
'use client'

import { use } from 'react'

import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'

export function useIsDataViewPending(): boolean {
  return use(DataViewPendingContext)
}
```

```ts
// src/shared/dal/client/hooks/use-server-prefetch-guard.ts
'use client'

import { isServer, useQueryClient } from '@tanstack/react-query'
import process from 'node:process'

/**
 * Dev-only. A suspense read the page did not prefetch runs during SSR through `httpBatchLink`, which carries none of
 * the viewer's cookies, so it fails or reads as signed out. Every server-rendered data view must prefetch its exact key.
 */
export function useServerPrefetchGuard(queryKey: readonly unknown[], active: boolean): void {
  const qc = useQueryClient()
  if (active && isServer && process.env.NODE_ENV !== 'production' && qc.getQueryState(queryKey) === undefined) {
    console.error(`[data-view] suspense read on the server without a prefetch: ${JSON.stringify(queryKey[0])}. Prefetch this exact input in the page.`)
  }
}
```

If `import process from 'node:process'` breaks the client bundle (check `pnpm tsc` and the dev server log), use `// eslint-disable-next-line node/prefer-global/process` with the global `process` instead. That is the pattern in `src/trpc/components/hydrate-client.tsx`.

```ts
// src/shared/dal/client/constants/empty-data-view-read.ts
import type { PaginatedResult } from '@/shared/dal/lib/query/paginated-result'

const EMPTY_PAGE: PaginatedResult<never> = { rows: [], total: 0 }

/**
 * What a data-view hook reads inside a `DataViewBoundary` fallback. Every hook call must run on every render, so the
 * fallback still calls `useSuspenseQuery`, on a key that already holds data and never goes stale: it never suspends
 * and never fetches.
 */
export const EMPTY_DATA_VIEW_READ = {
  queryKey: ['data-view', 'pending'] as const,
  queryFn: () => EMPTY_PAGE,
  initialData: EMPTY_PAGE,
  staleTime: Infinity,
  gcTime: Infinity,
}
```

Before writing `EMPTY_PAGE`, check `PaginatedResult`'s exact fields in `src/shared/dal/lib/query/paginated-result.ts`. If it has more required fields than `rows` and `total`, include them with empty values.

```tsx
// src/shared/components/data-view-boundary.tsx
'use client'

import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ErrorBoundary } from 'react-error-boundary'

import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'
import { HydrationErrorFallback } from '@/trpc/components/hydration-error-fallback'

/**
 * Wraps one data view. Its loading state is the view itself with no rows (see `DataViewPendingContext`), so the swap
 * to the real rows moves nothing. A failed first read shows a retry; changing the URL (Back, another filter) also
 * clears it.
 */
export function DataViewBoundary({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams()
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          resetKeys={[searchParams.toString()]}
          fallbackRender={({ resetErrorBoundary }) => <HydrationErrorFallback variant="section" onRetry={resetErrorBoundary} />}
        >
          <Suspense
            fallback={(
              <DataViewPendingContext value={true}>
                <div className="contents" data-slot="data-view-pending">{children}</div>
              </DataViewPendingContext>
            )}
          >
            {children}
          </Suspense>
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}
```

- [ ] **Step 2: Check**

```bash
pnpm exec eslint --fix src/shared/dal/client/lib/data-view-pending-context.ts src/shared/dal/client/hooks/use-is-data-view-pending.ts src/shared/dal/client/hooks/use-server-prefetch-guard.ts src/shared/dal/client/constants/empty-data-view-read.ts src/shared/components/data-view-boundary.tsx
pnpm tsc && pnpm lint
```
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add -- src/shared/dal/client/lib/data-view-pending-context.ts src/shared/dal/client/hooks/use-is-data-view-pending.ts src/shared/dal/client/hooks/use-server-prefetch-guard.ts src/shared/dal/client/constants/empty-data-view-read.ts src/shared/components/data-view-boundary.tsx
git commit -m "feat(data-view): a boundary whose loading state is the view itself with no rows

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/shared/dal/client/lib/data-view-pending-context.ts src/shared/dal/client/hooks/use-is-data-view-pending.ts src/shared/dal/client/hooks/use-server-prefetch-guard.ts src/shared/dal/client/constants/empty-data-view-read.ts src/shared/components/data-view-boundary.tsx
git show --stat HEAD
```

---

### Task 3: `useDataViewQuery` suspends; its 8 callers get boundaries (one commit)

**Files:**
- Modify: `src/shared/dal/client/hooks/use-data-view-query.ts`
- Modify: `src/shared/dal/client/lib/types.ts` (`DataViewQueryResult`, `DateWindowControls.isPending` doc)
- Modify: `src/shared/dal/client/lib/from-paginated-query.ts` (interim mapping until Task 4)
- Modify: `src/shared/components/data-table/lib/to-data-table-pagination.ts`, `src/shared/components/data-table/types.ts` (`DataTableServerPagination`), `src/shared/components/data-table/ui/data-table.tsx:~381`, `src/shared/components/data-table/ui/data-table-body.tsx:~99-107`
- Modify: `src/shared/components/query-toolbar/ui/bar.tsx`, `src/shared/components/records-page-header.tsx`
- Modify callers:
  - `src/app/(frontend)/dashboard/(records)/customers/page.tsx`
  - `src/features/records-management/ui/views/meetings-records-view.tsx`
  - `src/features/schedule-management/ui/views/schedule-view.tsx`, `ui/components/schedule-meetings-calendar.tsx`, `ui/components/schedule-activities-calendar.tsx`
  - `src/app/(frontend)/dashboard/pipeline/[pipeline]/page.tsx`, `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`
  - `src/features/agent-dashboard/ui/views/dashboard-view.tsx`, `ui/components/dashboard-meetings-hub.tsx`, `ui/components/dashboard-meetings-calendar.tsx`
  - `src/features/lead-sources-admin/ui/components/source-detail.tsx`, `all-detail.tsx`, `lead-source-customers-section.tsx`, `all-customers-section.tsx`
- Delete: `src/features/schedule-management/ui/components/schedule-calendar-error-state.tsx`, once Step 6's grep shows no importer.

**Interfaces:**
- Consumes: Task 2's exports.
- Produces:
  - `useDataViewQuery(procedure, extra, config)`: the 4th `options` argument is gone.
  - `DataViewQueryResult<TRow, F, T, K>` = `{ rows, total, isPending, isStale, isFetching, refresh, filterSort, window }`.
  - `DataTableServerPagination` gains `isStale?: boolean` and loses `isError`.

- [ ] **Step 1: Confirm no caller passes the 4th argument**

```bash
grep -rn "useDataViewQuery(" src --include=*.ts --include=*.tsx | grep -v "export function"
```
Expected: 8 calls, each with exactly 3 arguments.

- [ ] **Step 2: Rewrite the read in `use-data-view-query.ts`**

Keep the imports, `runtimeOptionFields`, the setters (`setFilter`, `setSearch`, `setSort`, `clearFilters`, `setPage`, `setPageSize`, `setAnchor`, `setView`), `refresh`, `runtimeOptions` and `filterSortControls` exactly as they are. Replace the rest as follows.

Import changes:
- `@tanstack/react-query`: drop `keepPreviousData` and `useQuery`; add `hashKey` and `useSuspenseQuery` (keep `useQueries`, `useQueryClient`).
- `react`: add `useDeferredValue`.
- Add `EMPTY_DATA_VIEW_READ`, `useIsDataViewPending` and `useServerPrefetchGuard` from Task 2.
- Delete `interface UseDataViewQueryOptions` and the `options` parameter.

The body, from the start of the function to `const anyProcedure`, becomes:

```ts
  const qc = useQueryClient()
  const trpc = useTRPC()
  const ability = useAbility()
  const isPending = useIsDataViewPending()
  const keys = useMemo(() => dataViewUrlKeys(config.paramPrefix), [config.paramPrefix])
  const parsers = useMemo(() => makeDataViewParsers(config), [config])

  // useQueryStates' generic can't express a parser map built at runtime; the derivation narrows values.
  const [urlState, setUrlState] = useQueryStates(parsers as never, { clearOnDefault: true })
  const state = urlState as Record<string, unknown>
  // The rows stay on the last URL state whose data is in while the next one loads, instead of falling back to the
  // skeleton. Deferring the state (not wrapping the setters) also covers Back/Forward, which nuqs applies from an effect.
  const shownState = useDeferredValue(state)

  // The toolbar's search box debounces before it commits, so the URL value is already the settled search.
  const search = (state[keys.searchKey] as string | null) ?? ''

  const filterSort = useMemo(() => deriveFilterSortState(state, config), [state, config])
  const windowState = useMemo(() => deriveDataViewWindow(state, config), [state, config])
  const shownFilterSort = useMemo(() => deriveFilterSortState(shownState, config), [shownState, config])
  const shownWindowState = useMemo(() => deriveDataViewWindow(shownState, config), [shownState, config])

  const extraKey = JSON.stringify(extra)
  const requestedInput = useMemo(
    () => ({ ...toDataViewInput(filterSort, windowState, config), ...extra }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra is deep-keyed via extraKey so an inline literal doesn't refetch
    [filterSort, windowState, config, extraKey],
  )
  const shownInput = useMemo(
    () => ({ ...toDataViewInput(shownFilterSort, shownWindowState, config), ...extra }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra is deep-keyed via extraKey so an inline literal doesn't refetch
    [shownFilterSort, shownWindowState, config, extraKey],
  )

  const anyProcedure = procedure as AnyQueryProcedure
  const requestedOptions = anyProcedure.queryOptions(requestedInput)
  const shownOptions = anyProcedure.queryOptions(shownInput)
  const isStale = !isPending && hashKey(requestedOptions.queryKey) !== hashKey(shownOptions.queryKey)

  useServerPrefetchGuard(shownOptions.queryKey, !isPending)
  useEffect(() => {
    if (!isPending) {
      checkHydrationParity(shownOptions.queryKey as readonly unknown[])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only; later keys are client-driven, not hydration targets
  }, [])

  // Suspends until the shown key's rows are in (streamed from the server prefetch on a document load). Inside a
  // DataViewBoundary fallback it reads a key that already holds an empty page, so the view draws with no rows.
  const read = useSuspenseQuery(isPending ? (EMPTY_DATA_VIEW_READ as unknown as typeof shownOptions) : shownOptions)
  const data = read.data as PaginatedResult<DataViewRowOf<TProcedure>>
  const rows = data.rows
  const total = data.total
  const isFetching = !isPending && read.isFetching
```

Delete the old `baseOptions`, the old `checkHydrationParity` effect, `const result = useQuery(…)`, and the old `data`/`rows`/`total` lines.

Replace the clamp effect, the adjacent prefetch, `isWindowPending` and the `windowControls` `date` case with:

```ts
  const pageCount = windowState.kind === 'page' && total > 0 ? Math.ceil(total / windowState.pageSize) : 0

  // Page past the end (rows deleted, filter narrowed elsewhere): clamp; an empty result keeps its own empty state.
  useEffect(() => {
    if (!isPending && !isStale && windowState.kind === 'page' && pageCount > 0 && windowState.page > pageCount) {
      void setUrlState({ [keys.pageKey]: pageCount } as never, { history: 'replace' })
    }
  }, [isPending, isStale, windowState, pageCount, keys, setUrlState])

  const adjacentWindows = useMemo(() => adjacentDataViewWindows(shownState, config), [shownState, config])
  const adjacentQueries = adjacentWindows
    .filter(adjacent => adjacent.kind !== 'page' || adjacent.pagination.offset < total)
    .map(adjacent => anyProcedure.queryOptions({ ...toDataViewInput(shownFilterSort, adjacent, config), ...extra }))
  usePrefetchQueries(adjacentQueries, !isPending && !isStale && !isFetching)

  // Another key's rows would land on the wrong days, so date views draw skeletons until this key's rows arrive.
  const isWindowPending = isPending || isStale
```

The `windowControls` `useMemo` keeps its shape; the `date` case still passes `isPending: isWindowPending`.

The returned object becomes:

```ts
  return {
    rows,
    total,
    isPending,
    isStale,
    isFetching,
    refresh,
    filterSort: filterSortControls,
    window: windowControls as DataViewWindowControls<W['kind']>,
  }
```

The runtime-options `useQueries` still runs in the pending fallback (it is a plain `useQuery` read, not dehydrated, so it cannot mismatch), and `enabled: … canRead(ability)` stays.

- [ ] **Step 3: Update the result types (`src/shared/dal/client/lib/types.ts`)**

In `DataViewQueryResult`, replace:
```ts
  isLoading: boolean
  isFetching: boolean
  isPlaceholderData: boolean
  isError: boolean
  error: unknown
```
with:
```ts
  /** True only inside a `DataViewBoundary` fallback: no rows exist yet, and the view draws its loading state. */
  isPending: boolean
  /** The rows belong to an older URL state while the requested one loads; tables dim them. */
  isStale: boolean
  /** A background refetch (an invalidation or `refresh()`); the rows stay. */
  isFetching: boolean
```

Replace `DateWindowControls.isPending`'s doc comment with:
```ts
  /**
   * True while this window's own rows aren't shown: inside a `DataViewBoundary` fallback, or while a window step, a
   * filter or a search loads (the shown rows belong to another key). Date views draw skeletons, never those rows.
   */
```

Leave `PaginatedQueryResult` for Task 4.

- [ ] **Step 4: Interim `fromPaginatedQuery` (the legacy tables still run `useQuery` until Task 4)**

In `src/shared/dal/client/lib/from-paginated-query.ts`, replace the five `isLoading … error` lines with:

```ts
    isPending: result.isLoading,
    isStale: result.isPlaceholderData,
    isFetching: result.isFetching && !result.isPlaceholderData,
```

- [ ] **Step 5: Adapters**

`to-data-table-pagination.ts`: replace
```ts
    isFetching: query.isFetching || query.isPlaceholderData,
    isError: query.isError,
```
with
```ts
    isFetching: query.isPending || query.isFetching,
    isStale: query.isStale,
```

`data-table/types.ts`: in `DataTableServerPagination`, delete `isError?: boolean` (and its doc line) and add:
```ts
  /** The rows belong to an older query while the next one loads; the table dims them after a short delay. */
  isStale?: boolean
```

`data-table-body.tsx`: delete the `if (serverPagination?.isError) { … }` block (the `ErrorState` row). Then remove the now-unused `ErrorState` import if `pnpm tsc`/lint flags it. A failed read now reaches the `DataViewBoundary`.

`data-table.tsx` at the `<Table … aria-busy={…}>` element (~line 381): add `data-stale={serverPagination?.isStale || undefined}` and extend its `className` to:
```tsx
            className="table-fixed border-separate border-spacing-0 transition-opacity duration-200 data-[stale=true]:opacity-60 data-[stale=true]:delay-200"
```

`query-toolbar/ui/bar.tsx`:
```ts
  const showShimmer = query.isPending || query.isFetching || query.isStale
```

`records-page-header.tsx`:
- the `query` prop type becomes `Pick<DataViewQueryResult<unknown, FieldList, string>, 'total' | 'isPending'>`
- its doc line becomes `reads only total and isPending for the count`
- `const countText = query.isPending ? 'Loading…' : formatTotalCount(query.total)`

- [ ] **Step 6: Callers**

Customers page (`(records)/customers/page.tsx`): wrap the table.
```tsx
      <RecordsPageMotionShell>
        <DataViewBoundary>
          <CustomersTable />
        </DataViewBoundary>
      </RecordsPageMotionShell>
```
(import `DataViewBoundary` from `@/shared/components/data-view-boundary`).

Meetings (`meetings-records-view.tsx`): wrap `<MeetingsTable … />` in `<DataViewBoundary>`.

Schedule:
- In `schedule-view.tsx`, wrap each of `<ScheduleActivitiesCalendar … />` and `<ScheduleMeetingsCalendar … />` in `<DataViewBoundary>`.
- In both calendar components, replace the ternary inside `<div className="min-h-0 flex-1">` with the `<ScheduleCalendar … />` branch alone, and delete the `LoadingState` and `ScheduleCalendarErrorState` imports.
- Then:
  ```bash
  grep -rn "schedule-calendar-error-state" src
  ```
  If nothing else imports it, `git rm -- src/features/schedule-management/ui/components/schedule-calendar-error-state.tsx`.

Pipeline:
- The page wraps `<CustomerPipelineView />` in `<DataViewBoundary>`.
- In `customer-pipeline-view.tsx`:
  - delete the `isInitialLoad` early return and the `LoadingState` import
  - `const isSwitching = query.isStale || query.isFetching`
  - `<CustomerPipelineMetricsBar … isLoading={query.isPending || isSwitching} />`
  - delete the `query.isError && items.length === 0` branch, and drop `ErrorState`/`Button` imports if they become unused
  - the empty branch becomes `items.length === 0 && !query.isPending ? <EmptyState …/> : <KanbanBoard …/>`, so the pending view draws the real, empty stage columns
- Guard its now server-rendered entrance like the other shells: `const isHydrating = useIsHydrating()` and `initial={isHydrating ? false : { opacity: 0, y: 30 }}`, importing from `@/shared/hooks/use-is-hydrating`.

Dashboard calendar:
- In `dashboard-view.tsx`, wrap `<DashboardMeetingsHub />` in `<DataViewBoundary>`.
- In `dashboard-meetings-hub.tsx`, delete the `isError` and `onRetry` props passed to the calendar.
- In `dashboard-meetings-calendar.tsx`:
  - delete `isError` and `onRetry` from the props interface and the destructuring
  - replace the three-way branch with `{isPending ? <DashboardMeetingsCalendarSkeleton /> : <DashboardDayAgenda … />}`
  - delete the `Button` import if unused
  - change the `isPending` doc to: `True while rows belong to another month or haven't arrived (the boundary fallback): no dots, and the agenda shows a skeleton.`

Lead sources:
- Wrap `<LeadSourceCustomersSection leadSourceId={source.id} />` (`source-detail.tsx:134`) and `<AllCustomersSection />` (`all-detail.tsx:171`) in `<DataViewBoundary>`.
- In both sections, `{query.isLoading ? 'Loading…' : …}` becomes `{query.isPending ? 'Loading…' : …}`.

- [ ] **Step 7: Let the compiler list what's left**

```bash
pnpm tsc 2>&1 | grep -E "isLoading|isPlaceholderData|isError|\.error\b" | head -40
```
Every hit is a reader of a removed field; apply Step 5/6's pattern. Expected: none left, then `pnpm tsc` clean.

```bash
pnpm exec eslint --fix <every file changed in this task>
pnpm tsc && pnpm lint
```

- [ ] **Step 8: Verify every P1 surface with the harness (must PASS)**

```bash
H=.superpowers/sdd/2026-09-29-data-view-suspense-reads/harness.ts
pnpm exec tsx $H ssr-rows /dashboard/customers
pnpm exec tsx $H ssr-rows /dashboard/meetings '[data-meeting-row]'
for p in /dashboard/customers /dashboard/meetings /dashboard /dashboard/schedule '/dashboard/pipeline/fresh'; do pnpm exec tsx $H hydration $p 5; done
pnpm exec tsx $H filter /dashboard/customers a e
pnpm exec tsx $H back /dashboard/customers
pnpm exec tsx $H error /dashboard/customers customersRouter.business.list a
pnpm exec tsx $H clamp /dashboard/customers
pnpm exec tsx $H window-step /dashboard/schedule
pnpm exec tsx $H window-step /dashboard "Go to the Next Month"
pnpm exec tsx $H softnav /dashboard/customers /dashboard/meetings
```
Expected: `PASS` for each.
- If `filter`/`back` report "rows vanished", pick two search letters that both match rows (they must not be empty results).
- If `error` finds no section error, check that the procedure name matches the `/api/trpc/` URL in DevTools.
- Also watch the dev server log for `[data-view] suspense read on the server without a prefetch`. It must not appear for these routes.

- [ ] **Step 9: Commit**

```bash
git commit -m "perf(data-view): data views stream their first rows and never hydrate against the wrong state

The read suspends on the server-prefetched key, rows stay (dimmed) while the next URL state loads, and a
DataViewBoundary's loading state is the view itself with no rows.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- <every file changed or deleted in this task>
git show --stat HEAD
```

---

### Task 4: `usePaginatedQuery` suspends; proposals, projects, campaign leads (one commit)

**Files:**
- Modify: `src/shared/dal/client/hooks/use-paginated-query.ts`, `src/shared/dal/client/lib/types.ts` (`PaginatedQueryResult`), `src/shared/dal/client/lib/from-paginated-query.ts`
- Modify: `src/app/(frontend)/dashboard/(records)/proposals/page.tsx`, `src/app/(frontend)/dashboard/(records)/projects/page.tsx`
- Modify: `src/features/campaigns-admin/ui/views/campaigns-view.tsx`, `src/app/(frontend)/dashboard/campaigns/page.tsx`
- Modify: `src/features/proposal-flow/ui/components/table/index.tsx`, `src/features/project-management/ui/components/table/index.tsx`, `src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx`, but only where `tsc` flags a removed field

**Interfaces:**
- Consumes: Task 2 and Task 3.
- Produces: `PaginatedQueryResult<TRow>` with `isPending`, `isStale`, `isFetching`; `isLoading`, `isPlaceholderData`, `isError` and `error` are removed. `UsePaginatedQueryOptions` loses `enabled`.

- [ ] **Step 1: Confirm no caller passes `enabled`**

```bash
grep -rn "enabled" src/features/proposal-flow/ui/components/table/index.tsx src/features/project-management/ui/components/table/index.tsx src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx src/features/project-management/constants/projects-table-query-config.ts src/features/proposal-flow/constants/proposals-table-query-config.ts src/features/campaigns-admin/constants/campaign-leads-table-query-config.ts
```
Expected: no `enabled:` passed to `usePaginatedQuery`.

- [ ] **Step 2: Rewrite the read in `use-paginated-query.ts`**

Imports:
- `@tanstack/react-query`: `hashKey, useQueryClient, useSuspenseQuery` (drop `keepPreviousData`, `useQuery`).
- `react`: add `useDeferredValue`.
- Add `EMPTY_DATA_VIEW_READ`, `useIsDataViewPending` and `useServerPrefetchGuard`.

Remove `enabled` from `UsePaginatedQueryOptions`, from the destructuring and from its doc.

After `const stateAny = urlState as Record<string, unknown>` add:

```ts
  const isPending = useIsDataViewPending()
  // Rows stay on the last URL state whose data is in while the next one loads (covers Back/Forward too).
  const shownStateAny = useDeferredValue(stateAny)
```

After `const derived = …` add:

```ts
  const shownDerived = useMemo(() => derivePaginatedQueryState(shownStateAny, config), [shownStateAny, config])
```

Rename the existing `queryInput`/`baseOptions` pair to the requested one, and add the shown one:

```ts
  const requestedInput = useMemo<PaginatedQueryInput & TExtra>(
    () => ({ ...derived.input, ...extra } as PaginatedQueryInput & TExtra),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra deep-keyed via extraKey
    [derived, extraKey],
  )
  const shownInput = useMemo<PaginatedQueryInput & TExtra>(
    () => ({ ...shownDerived.input, ...extra } as PaginatedQueryInput & TExtra),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra deep-keyed via extraKey
    [shownDerived, extraKey],
  )
  const requestedOptions = queryOptionsFactory(requestedInput)
  const baseOptions = queryOptionsFactory(shownInput)
  const isStale = !isPending && hashKey(requestedOptions.queryKey) !== hashKey(baseOptions.queryKey)
```

Keep `procedureKey`/`refresh` reading `baseOptions.queryKey[0]` (same procedure path).

The parity effect runs only `if (!isPending)`. Add `useServerPrefetchGuard(baseOptions.queryKey, !isPending)`.

Replace the `useQuery` call and the data lines with:

```ts
  const read = useSuspenseQuery(isPending ? (EMPTY_DATA_VIEW_READ as unknown as typeof baseOptions) : baseOptions)
  const data = read.data as PaginatedResult<TRow>
  const isFetching = !isPending && read.isFetching
  const total = data.total
  const rows = data.rows
```

- The clamp effect's condition becomes `!isPending && !isStale && pageCount > 0 && page > pageCount`, with deps `[isPending, isStale, page, pageCount, keys.pageKey, setUrlState]`.
- The next-page prefetch effect gates on `if (!prefetchNextPage || isPending || isStale || isFetching) return`, reads the shown page (`shownDerived.input.pagination.offset`, `shownDerived.pageSize`) and builds from `shownInput`. Deps: `[prefetchNextPage, isPending, isStale, isFetching, data.total, shownDerived, shownInput, queryOptionsFactory, qc]`.
- In the return, replace `isLoading, isFetching, isPlaceholderData, isError, error,` with `isPending, isStale, isFetching,`.

- [ ] **Step 3: Types and adapter**

In `PaginatedQueryResult` (`types.ts`), the `// -- Query state --` block becomes the same three documented fields as `DataViewQueryResult` (Task 3 Step 3).

In `from-paginated-query.ts`, the interim lines become pass-through:

```ts
    isPending: result.isPending,
    isStale: result.isStale,
    isFetching: result.isFetching,
```

- [ ] **Step 4: Boundaries and the leads prefetch**

- `(records)/proposals/page.tsx`: `<RecordsPageMotionShell><DataViewBoundary><PastProposalsTable /></DataViewBoundary></RecordsPageMotionShell>`.
- `(records)/projects/page.tsx`: the same around `<PortfolioProjectsTable />`.
- `campaigns-view.tsx:39`: `<TabsContent …value="leads"><DataViewBoundary><CampaignsLeadsView /></DataViewBoundary></TabsContent>`.
- `campaigns/page.tsx`: inside the authenticated branch, after the `overview` block:

```ts
    // A `?tab=leads` deep link renders the leads table on the server; its first read must be prefetched with the
    // viewer's session (a suspense read without one would fetch cookieless during SSR).
    if (tab === 'leads') {
      prefetch(trpc.voipCampaignsRouter.listLeads.queryOptions(await loadPaginatedQueryInput(searchParams, CAMPAIGN_LEADS_TABLE_QUERY_CONFIG) as never))
    }
```

Imports: `loadPaginatedQueryInput` from `@/shared/dal/server/lib/query/load-paginated-query-input` and `CAMPAIGN_LEADS_TABLE_QUERY_CONFIG` from `@/features/campaigns-admin/constants/campaign-leads-table-query-config`.

The `as never` mirrors the view's own cast; see the comment at `campaigns-leads-view.tsx` above its `usePaginatedQuery` call.

- [ ] **Step 5: Compiler sweep, lint**

```bash
pnpm tsc 2>&1 | grep -E "isLoading|isPlaceholderData|isError|\.error\b|enabled" | head -40
pnpm exec eslint --fix <every file changed in this task>
pnpm tsc && pnpm lint
```
Expected: clean.

- [ ] **Step 6: Verify (must PASS)**

```bash
H=.superpowers/sdd/2026-09-29-data-view-suspense-reads/harness.ts
pnpm exec tsx $H ssr-rows /dashboard/proposals
pnpm exec tsx $H ssr-rows /dashboard/projects '[data-project-row]'
for p in /dashboard/proposals /dashboard/projects '/dashboard/campaigns?tab=leads'; do pnpm exec tsx $H hydration "$p" 5; done
pnpm exec tsx $H filter /dashboard/proposals a e
pnpm exec tsx $H clamp /dashboard/projects
```
Expected: `PASS`, and no `[data-view] suspense read on the server without a prefetch` in the dev log for `?tab=leads`.

- [ ] **Step 7: Commit**

```bash
git commit -m "perf(data-view): the paginated tables stream their first rows too; campaign leads prefetch on a deep link

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- <every file changed in this task>
git show --stat HEAD
```

---

### Task 5: Dashboard home skeletons match the cards

The measured misalignment on 2026-09-29 at 1440×900: section skeleton rows are 64 px tall, while proposal cards are 92 px (72 px at 390 wide when the meta fits on one line) and project cards are 60 px.

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-proposal-card-skeleton.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-project-card-skeleton.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-list-section-skeleton.tsx`, `dashboard-proposal-section.tsx`, `dashboard-project-section.tsx`, `dashboard-snapshot-strip.tsx`

**Interfaces:**
- Consumes: `useIsDataViewPending` (Task 2).
- Produces:
  - `DashboardProposalCardSkeleton()` and `DashboardProjectCardSkeleton()`, no props.
  - `DashboardListSectionSkeleton({ title, card }: { title: string, card: 'proposal' | 'project' })`.
  - Inside the pending context the sections render their skeleton and the strip renders `<DashboardSnapshotChips />`; neither reads.

- [ ] **Step 1: Card skeletons that copy the real frames**

Match the frame classes of `DashboardProposalCard` (`rounded-lg border border-border bg-card p-2.5`, a header row, then `mt-1.5 flex flex-wrap … gap-y-1` meta that wraps to two lines at 315 px). Use the tone classes the calendar skeleton already uses (`@/shared/constants/skeleton-tone`).

```tsx
// src/features/agent-dashboard/ui/components/dashboard-proposal-card-skeleton.tsx
import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_BLOCK_TONE_CLASS, SKELETON_FRAME_TONE_CLASS, SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

/** `DashboardProposalCard`'s frame and rows (label + actions, then two meta lines), so the swap to the card moves nothing. */
export function DashboardProposalCardSkeleton() {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-2.5', SKELETON_FRAME_TONE_CLASS)} aria-hidden>
      <div className="flex h-6 items-center gap-1.5">
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3.5 w-40 max-w-full')} />
        <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'ml-auto size-6 shrink-0 rounded-md')} />
      </div>
      <div className="mt-1.5 flex flex-col gap-1">
        <div className="flex h-[18px] items-center gap-2">
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-24')} />
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-16')} />
        </div>
        <div className="flex h-[18px] items-center gap-2">
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-14')} />
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'h-3.5 w-12')} />
        </div>
      </div>
    </div>
  )
}
```

```tsx
// src/features/agent-dashboard/ui/components/dashboard-project-card-skeleton.tsx
import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_BLOCK_TONE_CLASS, SKELETON_FRAME_TONE_CLASS, SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

/** `DashboardProjectCard`'s frame and rows (icon, title over address, stage badge, actions), so the swap moves nothing. */
export function DashboardProjectCardSkeleton() {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2.5', SKELETON_FRAME_TONE_CLASS)} aria-hidden>
      <Skeleton className={cn(SKELETON_TONE_CLASS, 'size-3.5 shrink-0 rounded-sm')} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3.5 w-32 max-w-full')} />
        <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-40 max-w-full')} />
      </div>
      <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'h-5 w-16 shrink-0 rounded-full')} />
      <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'size-6 shrink-0 rounded-md')} />
    </div>
  )
}
```

These inner heights are starting values: 92 px = 20 padding + 2 border + (24 + 6 + 18 + 4 + 18), and 60 px for the project card. Step 4's `align` is the test; adjust the inner rows until it passes. Read the real cards' row heights in DevTools, or from the `align` failure lines.

- [ ] **Step 2: The section skeleton takes the card kind; sections and strip honour the pending context**

`dashboard-list-section-skeleton.tsx`: add `card: 'proposal' | 'project'` to the props and replace the two `<Skeleton className="h-16 …" />` rows with `{card === 'proposal' ? <DashboardProposalCardSkeleton /> : <DashboardProjectCardSkeleton />}` rendered twice (keys `0`, `1`). The list container keeps `space-y-2`, the real `EntityList` `itemsClassName`: change `flex flex-col gap-2` to `space-y-2`.

`dashboard-proposal-section.tsx`:

```tsx
export function DashboardProposalSection({ title, input, timeSince, emptyMessage }: DashboardProposalSectionProps) {
  // The layout's loading state draws this page with no reads (see DataViewPendingContext).
  const isPending = useIsDataViewPending()
  const skeleton = <DashboardListSectionSkeleton title={title} card="proposal" />
  if (isPending) {
    return skeleton
  }
  return (
    <HydrationErrorBoundary variant="section">
      <Suspense fallback={skeleton}>
        <DashboardProposalSectionList title={title} input={input} timeSince={timeSince} emptyMessage={emptyMessage} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
```

`dashboard-project-section.tsx`: the same shape, with `card="project"`.

`dashboard-snapshot-strip.tsx`: add `const isPending = useIsDataViewPending()` and `if (isPending) return <DashboardSnapshotChips />` before the boundary.

- [ ] **Step 3: Lint and types**

```bash
pnpm exec eslint --fix src/features/agent-dashboard/ui/components/dashboard-proposal-card-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-project-card-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-list-section-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx src/features/agent-dashboard/ui/components/dashboard-project-section.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx
pnpm tsc && pnpm lint
```

- [ ] **Step 4: Alignment (runs after Task 6 wires the layout fallback; until then use a soft-throttle check)**

`align` compares the JS-off first paint, which is the layout fallback that Task 6 makes route-aware. Until Task 6, check the section skeletons directly:
1. In DevTools, throttle the network to "Slow 3G".
2. Soft-navigate from `/dashboard/meetings` to `/dashboard`, so the sections suspend on the client.
3. Screenshot the skeleton and the settled page at the same scroll position, and compare the card edges.

Final gate (Task 6 Step 5): `align /dashboard desktop` and `align /dashboard phone` PASS.

- [ ] **Step 5: Commit**

```bash
git add -- src/features/agent-dashboard/ui/components/dashboard-proposal-card-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-project-card-skeleton.tsx
git commit -m "fix(dashboard): section skeletons copy their cards' frames and rows

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- src/features/agent-dashboard/ui/components/dashboard-proposal-card-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-project-card-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-list-section-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx src/features/agent-dashboard/ui/components/dashboard-project-section.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx
git show --stat HEAD
```

---

### Task 6: Route-aware layout fallback

On a document load the layout shows its fallback until the session resolves. Today that fallback is a generic block layout. After this task, on the routes below it is the page itself in the pending context, so the layout fallback, the page's own boundary fallback and the page all line up.

**Files:**
- Create: `src/features/agent-dashboard/constants/dashboard-main.ts`
- Create: `src/features/agent-dashboard/constants/route-pending-views.ts`
- Create: `src/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton.tsx` (today's `DashboardContentSkeleton` body, moved as-is)
- Create: `src/features/agent-dashboard/ui/components/{dashboard-home,customers-route,proposals-route,projects-route}-pending-view.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-content-skeleton.tsx`
- Modify: `src/app/(frontend)/dashboard/template.tsx` (read `DASHBOARD_MAIN_CLASS`)

**Interfaces:**
- Consumes: `DataViewPendingContext` (Task 2); pending-aware views (Tasks 3–5).
- Produces:
  - `DASHBOARD_MAIN_CLASS: string`, the template `<main>` classes, shared by the template and the fallback.
  - `DASHBOARD_ROUTE_PENDING_VIEWS: Record<string, React.ComponentType>`, keyed by pathname.
  - `DashboardContentSkeleton()` (client).
  - `DashboardGenericContentSkeleton()`.

- [ ] **Step 1: Share the template's `<main>` classes**

```ts
// src/features/agent-dashboard/constants/dashboard-main.ts
/** The dashboard template's `<main>` box; the layout's loading state uses the same box so its content lines up. */
export const DASHBOARD_MAIN_CLASS = 'relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-20 pt-4 md:px-6 md:py-6 md:pb-6 has-data-stage:p-0'
```

In `template.tsx`, replace the literal `className="relative min-h-0 … has-data-stage:p-0"` on `motion.main` with `className={DASHBOARD_MAIN_CLASS}`.

- [ ] **Step 2: The route map (lazy, so the layout bundle doesn't carry every page)**

Create four small wrappers, one component per file (owner rule), each rendering what its page renders under `HydrateClient`:
- `src/features/agent-dashboard/ui/components/dashboard-home-pending-view.tsx`: `DashboardHomePendingView` renders `<DashboardView name={null} />`. The name streams with the page, and the greeting line keeps its height.
- `src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx`: `CustomersRoutePendingView` renders `<RecordsPageMotionShell><CustomersTable /></RecordsPageMotionShell>`.
- `src/features/agent-dashboard/ui/components/proposals-route-pending-view.tsx`: `ProposalsRoutePendingView` renders `<RecordsPageMotionShell><PastProposalsTable /></RecordsPageMotionShell>`.
- `src/features/agent-dashboard/ui/components/projects-route-pending-view.tsx`: `ProjectsRoutePendingView` renders `<RecordsPageMotionShell><PortfolioProjectsTable /></RecordsPageMotionShell>`.

Each is a `'use client'` file with a one-line comment: `// The page's own composition, drawn in the pending context as the layout's loading state.`

```ts
// src/features/agent-dashboard/constants/route-pending-views.ts
import type { ComponentType } from 'react'

import dynamic from 'next/dynamic'

import { ROOTS } from '@/shared/config/roots'

// Lazy, so the layout's bundle doesn't carry every page; the pending context (not these components) keeps them from
// reading, so each one is its page's own loading state.
export const DASHBOARD_ROUTE_PENDING_VIEWS: Record<string, ComponentType> = {
  [ROOTS.dashboard.root]: dynamic(() => import('@/features/agent-dashboard/ui/components/dashboard-home-pending-view').then(m => m.DashboardHomePendingView)),
  [ROOTS.dashboard.customers.root()]: dynamic(() => import('@/features/agent-dashboard/ui/components/customers-route-pending-view').then(m => m.CustomersRoutePendingView)),
  [ROOTS.dashboard.meetings.root()]: dynamic(() => import('@/features/records-management/ui/views/meetings-records-view').then(m => m.MeetingsRecordsView)),
  [ROOTS.dashboard.proposals.root()]: dynamic(() => import('@/features/agent-dashboard/ui/components/proposals-route-pending-view').then(m => m.ProposalsRoutePendingView)),
  [ROOTS.dashboard.projects.root()]: dynamic(() => import('@/features/agent-dashboard/ui/components/projects-route-pending-view').then(m => m.ProjectsRoutePendingView)),
  [ROOTS.dashboard.schedule()]: dynamic(() => import('@/features/schedule-management/ui/views/schedule-view').then(m => m.ScheduleView)),
}
```

The pipeline route is deliberately absent: its view needs the `[pipeline]` layout's `PipelineProvider`, so it keeps the generic fallback.

- [ ] **Step 3: The route-aware fallback**

```tsx
// src/features/agent-dashboard/ui/components/dashboard-content-skeleton.tsx
'use client'

import { usePathname } from 'next/navigation'

import { DASHBOARD_MAIN_CLASS } from '@/features/agent-dashboard/constants/dashboard-main'
import { DASHBOARD_ROUTE_PENDING_VIEWS } from '@/features/agent-dashboard/constants/route-pending-views'
import { DashboardGenericContentSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton'
import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'

// Shows only on a document load while the session resolves (the layout persists across in-app navigation). On the
// routes that have one, it is the page itself with no rows, the same as the page's own loading state, so the two
// hand over without a jump.
export function DashboardContentSkeleton() {
  const pathname = usePathname()
  const PendingView = DASHBOARD_ROUTE_PENDING_VIEWS[pathname]
  if (!PendingView) {
    return <DashboardGenericContentSkeleton />
  }
  return (
    <div className="flex h-full min-w-0 flex-col" data-slot="dashboard-content-skeleton" aria-busy="true">
      <div className={DASHBOARD_MAIN_CLASS}>
        <DataViewPendingContext value={true}>
          <div className="contents" data-slot="data-view-pending">
            <PendingView />
          </div>
        </DataViewPendingContext>
      </div>
    </div>
  )
}
```

`dashboard-generic-content-skeleton.tsx` holds today's `DashboardContentSkeleton` JSX unchanged, renamed `DashboardGenericContentSkeleton`, keeping its `data-slot="dashboard-content-skeleton"`.

- [ ] **Step 4: Lint and types**

```bash
pnpm exec eslint --fix <every file created or changed in this task>
pnpm tsc && pnpm lint
```

- [ ] **Step 5: Alignment and hydration (must PASS)**

```bash
H=.superpowers/sdd/2026-09-29-data-view-suspense-reads/harness.ts
for p in /dashboard /dashboard/customers /dashboard/meetings /dashboard/schedule; do for v in desktop phone; do pnpm exec tsx $H align $p $v; done; done
for p in /dashboard /dashboard/customers /dashboard/meetings /dashboard/schedule /dashboard/proposals /dashboard/projects; do pnpm exec tsx $H hydration $p 5; done
```
Expected: `PASS`. For a `FAIL align …` line, fix the component that owns that box:
- the card skeletons (Task 5), for `.rounded-lg.border` heights
- `DashboardSnapshotChips`, for chip boxes; it is the real component, so a mismatch there means the fallback isn't on the right route

Never fix one by loosening the tolerance. Also confirm the dev log shows no `[data-view] suspense read on the server without a prefetch`: the fallback must not read.

- [ ] **Step 6: Commit**

```bash
git add -- src/features/agent-dashboard/constants/dashboard-main.ts src/features/agent-dashboard/constants/route-pending-views.ts src/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-home-pending-view.tsx src/features/agent-dashboard/ui/components/customers-route-pending-view.tsx src/features/agent-dashboard/ui/components/proposals-route-pending-view.tsx src/features/agent-dashboard/ui/components/projects-route-pending-view.tsx
git commit -m "fix(dashboard): a cold load's skeleton is the page itself, so it hands over without a jump

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>" -- <every file created or changed in this task>
git show --stat HEAD
```

---

### Task 7: Full sweep and records

**Files:**
- Modify: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-dashboard-loading-sequence.md` and its `MEMORY.md` line (not in git)
- Modify: `docs/superpowers/specs/2026-09-29-data-view-suspense-reads-design.md` status line only

- [ ] **Step 1: Run every mode once more, all surfaces**

```bash
H=.superpowers/sdd/2026-09-29-data-view-suspense-reads/harness.ts
{
  for p in /dashboard /dashboard/customers /dashboard/meetings /dashboard/proposals /dashboard/projects /dashboard/schedule '/dashboard/schedule?show=activities' /dashboard/pipeline/fresh '/dashboard/campaigns?tab=leads'; do pnpm exec tsx $H hydration "$p" 5; done
  pnpm exec tsx $H ssr-rows /dashboard/customers; pnpm exec tsx $H ssr-rows /dashboard/meetings '[data-meeting-row]'; pnpm exec tsx $H ssr-rows /dashboard/proposals; pnpm exec tsx $H ssr-rows /dashboard/projects '[data-project-row]'
  for p in /dashboard /dashboard/customers /dashboard/meetings /dashboard/schedule; do for v in desktop phone; do pnpm exec tsx $H align $p $v; done; done
  pnpm exec tsx $H filter /dashboard/customers a e; pnpm exec tsx $H back /dashboard/customers
  pnpm exec tsx $H error /dashboard/customers customersRouter.business.list a
  pnpm exec tsx $H clamp /dashboard/customers; pnpm exec tsx $H window-step /dashboard/schedule; pnpm exec tsx $H window-step /dashboard "Go to the Next Month"
  pnpm exec tsx $H softnav /dashboard/customers /dashboard/meetings; pnpm exec tsx $H softnav /dashboard /dashboard/customers
} 2>&1 | tee .superpowers/sdd/2026-09-29-data-view-suspense-reads/after.txt
grep -c PASS .superpowers/sdd/2026-09-29-data-view-suspense-reads/after.txt; grep FAIL .superpowers/sdd/2026-09-29-data-view-suspense-reads/after.txt
```
Expected: no `FAIL` lines. Compare with `baseline.txt` in the report to the owner.

- [ ] **Step 2: Manual pass on a phone viewport**

In Chrome DevTools, use an iPhone 14 viewport with Slow 4G, signed in. Hard-reload `/dashboard` and `/dashboard/meetings`: one continuous skeleton, with no jump when rows arrive. Change a filter: the rows dim, with no flash. Report what you saw.

- [ ] **Step 3: Records**

- Spec status line: `**Status:** SHIPPED <date> (<first>..<last> commit)`.
- Memory note: append the shipped range and the before/after harness counts, and update the `MEMORY.md` line to `SHIPPED`.
