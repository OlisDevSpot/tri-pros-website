# Instant Tab Return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Returning to a dashboard tab used this browser session shows its cached rows on the first frame, refetches every time, and replaces the rows in place; skeletons only on a true first visit.

**Architecture:** The pending context becomes `false | 'loading' | 'error'`. One hook, `useLoadingScreenRead`, decides what any read does in a pending view: cached in a `'loading'` view → the real options with `refetchOnMount: false`; otherwise in a pending view → `null` (the caller draws its skeleton); outside → the options unchanged. Both data-view read hooks and the dashboard home sections go through it. The hooks' exposed `isFetching` becomes "refetching rows older than `staleTime` or invalidated", so every hairline/spinner consumer follows the owner's rule unchanged. Client `gcTime` 30 min; home gets its own loading screen in a `(home)` route group and greets from the client session; the week view places itself before paint.

**Tech Stack:** Next.js 15.5 App Router, React 19, TanStack Query 5.104, tRPC 11 (`@trpc/tanstack-react-query`), nuqs, better-auth (`useSession`), Playwright + CDP (checks), tsx (checks).

**Spec:** `docs/superpowers/specs/2026-10-12-instant-tab-return-design.md` (approved 2026-10-12; revised after the adversarial review with rulings R6–R9).

## Global Constraints

- Never run `pnpm build`. Verify with `pnpm tsc` and `pnpm lint`.
- Never write to any database for testing, dev included. Checks only read and navigate.
- Shared working tree with other active sessions: no `git stash`, `git checkout -- <file>`, `git reset`; stage and commit by explicit path only. Never stage a file another session has dirty (check `git status` before each commit). `CONTEXT.md` is held by another session: do not edit it.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comments say why, never what; no citations of plans, specs, tasks or file paths that will rot.
- Never print `DEV_LOGIN_SECRET`; checks pass every error through `redact` from `check-lib.mjs`.
- `next.config.ts` is not touched. `staleTime` stays `30 * 1000`. Client `gcTime` is `30 * 60 * 1000`; server `gcTime` stays `Infinity`.
- Names (owner-approved): `useLoadingScreenRead`; route group `(home)`; pending-context values `'loading'` and `'error'`. Local flag in the read hooks: `isPendingView` (any pending view) — distinct from `isPending` (no rows to show).
- Workspace for checks (gitignored): `.superpowers/sdd/2026-10-12-instant-tab-return/`, written below as `$W`.
- Checks need the dev server: `ss -ltnp | grep -E ':(3000|300[1-9])'` first; if nothing listens on `.env.local`'s `PORT`, start `pnpm dev` in the background. Never kill a dev server you did not start.
- Another session is actively changing the dashboard home reads and `use-data-view-query.ts` (commits `88d0fe37`, `6d3e0fdd`, `9c56c55e` on 2026-10-12). At each task's start, re-read every file the task touches and `git log -3 -- <files>`. If an anchor quoted here no longer matches, apply the same change to the current code, keeping the other session's work intact, and ledger the ruling.
- A check that passes on RED proves nothing. If a RED step passes, stop that task, find out why (selector, timing, throttling), fix the check, ledger the ruling, and only then change product code.

## Review Focus

1. A return whose URL (filters, page, week) matches no cached key → the loading screen shows skeletons, never another key's rows. Not exercised by a check: the loading screen derives its key with the same hook and URL as the page (`useSearchParams` sees the new URL in the loading screen). The reviewer confirms nothing in the plan breaks that.
2. A render error in a row/card while cached rows show → the error stays inside its section (`'error'` views never read the cache). Task 1's unit check pins the hook; the reviewer reads `DataViewBoundary`.
3. A pending view never writes the URL, starts preloads, runs hydration checks, or starts the schedule highlight timer → only the page does. Code-gated in Tasks 2 and 3; the reviewer checks every gate.
4. Clock skew: the silent quick-return refresh needs `dehydratedAt > dataUpdatedAt`; a fast client clock skips it (accepted in the spec). The reviewer confirms nothing else depends on that ordering.
5. The new `isFetching` meaning on surfaces outside the seven routes (lead sources, campaign leads, proposal-flow table, all-customers sections) → the refresh button still spins on its own click, "Updating…" shows only for stale refetches. The reviewer greps every `isFetching` consumer.

---

### Task 1: The pending-view states, `useLoadingScreenRead`, client `gcTime`, drift check off in pending views

**Files:**
- Modify: `src/shared/dal/client/lib/data-view-pending-context.ts`
- Modify: `src/shared/dal/client/hooks/use-is-data-view-pending.ts`
- Modify: `src/shared/components/data-view-pending.tsx`
- Modify: `src/shared/components/data-view-boundary.tsx` (error fallback value, doc comment)
- Modify: `src/shared/dal/client/constants/empty-data-view-read.ts` (doc comment)
- Create: `src/shared/dal/client/hooks/use-loading-screen-read.ts`
- Modify: `src/shared/dal/client/hooks/use-hydration-parity-check.ts`
- Modify: `src/trpc/query-client.ts` (`gcTime`)
- Test: `$W/check-loading-screen-read.tsx`, `$W/tsconfig.json`, `$W/check-lib.mjs` (copy)

**Interfaces:**
- Produces: `type DataViewPendingState = false | 'loading' | 'error'` and `DataViewPendingContext: Context<DataViewPendingState>` (default `false`), from `@/shared/dal/client/lib/data-view-pending-context`.
- Produces: `useIsDataViewPending(): boolean` — unchanged signature, `true` for `'loading'` and `'error'`.
- Produces: `useLoadingScreenRead<TOptions extends { queryKey: QueryKey }>(options: TOptions): TOptions | null`.
- Produces: `useHydrationParityCheck(queryKey: readonly unknown[]): void` — unchanged signature; no-op in any pending view.

- [ ] **Step 1: Set up the workspace**

```bash
W=.superpowers/sdd/2026-10-12-instant-tab-return
mkdir -p $W
cp .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-lib.mjs $W/check-lib.mjs
cat > $W/tsconfig.json <<'EOF'
{
  "extends": "../../../tsconfig.json",
  "compilerOptions": { "jsx": "react-jsx" }
}
EOF
```

- [ ] **Step 2: Write the failing check**

`$W/check-loading-screen-read.tsx`:

```tsx
import type { QueryClient } from '@tanstack/react-query'

let failed = false
function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail ? `: ${detail}` : ''}`)
  failed ||= !ok
}

async function main() {
  // TanStack reads `isServer` once at import; the client defaults are what this checks, so a window must exist first.
  ;(globalThis as Record<string, unknown>).window = globalThis
  const { QueryClientProvider } = await import('@tanstack/react-query')
  const { renderToString } = await import('react-dom/server')
  const { makeQueryClient } = await import('@/trpc/query-client')

  const gcTime = makeQueryClient().getDefaultOptions().queries?.gcTime
  check('client gcTime is 30 min', gcTime === 30 * 60 * 1000, String(gcTime))

  const { DataViewPendingContext } = await import('@/shared/dal/client/lib/data-view-pending-context')
  const { useLoadingScreenRead } = await import('@/shared/dal/client/hooks/use-loading-screen-read')

  const options = { queryKey: ['probe', { input: 1 }] as const, queryFn: () => ({ rows: [], total: 0 }) }

  function run(state: false | 'loading' | 'error', cached: boolean) {
    const qc: QueryClient = makeQueryClient()
    if (cached) {
      qc.setQueryData(options.queryKey, { rows: [{ id: 'r1' }], total: 1 })
    }
    const out: { read?: unknown } = {}
    function Probe() {
      out.read = useLoadingScreenRead(options)
      return null
    }
    renderToString(
      <QueryClientProvider client={qc}>
        <DataViewPendingContext value={state}>
          <Probe />
        </DataViewPendingContext>
      </QueryClientProvider>,
    )
    return out.read as (typeof options & { refetchOnMount?: boolean }) | null
  }

  check('outside a pending view, uncached: options unchanged', run(false, false) === options)
  check('outside a pending view, cached: options unchanged', run(false, true) === options)
  const cachedRead = run('loading', true)
  check('loading view with cached rows: same key, no mount refetch', cachedRead?.queryKey === options.queryKey && cachedRead?.refetchOnMount === false, JSON.stringify(cachedRead && { refetchOnMount: cachedRead.refetchOnMount }))
  check('loading view with nothing cached: null', run('loading', false) === null)
  check('error view never reads the cache: null', run('error', true) === null)
  process.exit(failed ? 1 : 0)
}

void main()
```

- [ ] **Step 3: Run it to verify it fails**

Run: `env TSX_TSCONFIG_PATH=$W/tsconfig.json pnpm exec tsx $W/check-loading-screen-read.tsx`
Expected: `FAIL client gcTime is 30 min: 300000` (or `undefined`), then a crash importing `use-loading-screen-read` (tsx may word it "Cannot find package '@/shared'"; same cause).

- [ ] **Step 4: The pending context carries its state**

`src/shared/dal/client/lib/data-view-pending-context.ts`:

```ts
'use client'

import { createContext } from 'react'

/**
 * `'loading'` inside a route's loading screen, a `DataViewBoundary`'s suspense fallback, the layout's document-load
 * skeleton and the PWA launch shell; `'error'` inside a `DataViewBoundary`'s error fallback. In either, data-view reads
 * never suspend, so the pending state is the real view and lines up with it by construction. Only `'loading'` shows
 * cached rows (`useLoadingScreenRead`): rows that failed to render must not render again inside their own fallback.
 */
export type DataViewPendingState = false | 'loading' | 'error'

export const DataViewPendingContext = createContext<DataViewPendingState>(false)
```

`src/shared/dal/client/hooks/use-is-data-view-pending.ts` — the return becomes:

```ts
export function useIsDataViewPending(): boolean {
  return use(DataViewPendingContext) !== false
}
```

`src/shared/components/data-view-pending.tsx` — `value={true}` becomes `value="loading"`, and the doc comment becomes `/** Renders a data view as its own loading state: the real view, with its cached rows or none. */`.

`src/shared/components/data-view-boundary.tsx` — in the error fallback, `<DataViewPendingContext value={true}>` becomes `<DataViewPendingContext value="error">`; the component's doc comment becomes:

```ts
/**
 * Wraps one data view. Its loading state is the view itself, with its cached rows or none (see `DataViewPendingContext`),
 * so the swap to the real rows moves nothing. A failed read shows a retry above the row-less view, so the toolbar stays
 * live: a key that keeps failing is escaped by changing a filter, which changes the URL and clears the error.
 */
```

`src/shared/dal/client/constants/empty-data-view-read.ts` — the doc comment becomes:

```ts
/**
 * What a data-view hook reads in a pending view with nothing to show (`useLoadingScreenRead` returned null). Every hook
 * call must run on every render, so the hook still calls `useSuspenseQuery`, on a key that already holds data and never
 * goes stale: it never suspends and never fetches.
 */
```

- [ ] **Step 5: Create the hook**

`src/shared/dal/client/hooks/use-loading-screen-read.ts`:

```ts
'use client'

import type { QueryKey } from '@tanstack/react-query'

import { useQueryClient } from '@tanstack/react-query'
import { use } from 'react'

import { DataViewPendingContext } from '@/shared/dal/client/lib/data-view-pending-context'

/**
 * What a read does in a pending view. A loading screen shows the key's cached rows and starts no fetch, because the
 * page that replaces it refreshes them. `null` means there is nothing to show (nothing cached, or an error fallback),
 * so the caller draws its skeleton. Outside a pending view the options pass through unchanged.
 */
export function useLoadingScreenRead<TOptions extends { queryKey: QueryKey }>(options: TOptions): TOptions | null {
  const state = use(DataViewPendingContext)
  const qc = useQueryClient()
  if (state === false) {
    return options
  }
  if (state === 'error' || qc.getQueryData(options.queryKey) === undefined) {
    return null
  }
  return { ...options, refetchOnMount: false }
}
```

- [ ] **Step 6: Client `gcTime`**

In `src/trpc/query-client.ts`, inside `defaultOptions.queries`, directly under `staleTime: 30 * 1000,`:

```ts
        // A tab used earlier this session reopens on its cached rows. On the server a finite value would hold each
        // request's cache alive after the response, so it stays at Infinity there.
        gcTime: isServer ? Infinity : 30 * 60 * 1000,
```

- [ ] **Step 7: The drift check skips pending views**

`src/shared/dal/client/hooks/use-hydration-parity-check.ts` becomes:

```ts
'use client'

import { useEffect } from 'react'

import { useIsDataViewPending } from '@/shared/dal/client/hooks/use-is-data-view-pending'
import { checkHydrationParity } from '@/shared/lib/hydration-drift'

/**
 * Dev-only: call with the exact queryOptions.queryKey a suspense view mounts,
 * to detect server-prefetch drift (see hydration-drift.ts). No-op in prod.
 */
export function useHydrationParityCheck(queryKey: readonly unknown[]): void {
  // A pending view draws before its route's server render arrives, so the recorded keys are the previous page's.
  const isPendingView = useIsDataViewPending()
  useEffect(() => {
    if (!isPendingView) {
      checkHydrationParity(queryKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only
  }, [])
}
```

- [ ] **Step 8: Run the check to verify it passes**

Run: `env TSX_TSCONFIG_PATH=$W/tsconfig.json pnpm exec tsx $W/check-loading-screen-read.tsx`
Expected: six `PASS` lines, exit 0.

- [ ] **Step 9: Type-check and lint**

Run: `pnpm tsc` → no errors (every `DataViewPendingContext` provider now passes a `DataViewPendingState`; there are exactly two, in `data-view-pending.tsx` and `data-view-boundary.tsx`). Run: `pnpm exec eslint src/shared/dal/client src/shared/components/data-view-pending.tsx src/shared/components/data-view-boundary.tsx src/trpc/query-client.ts` → no output.

- [ ] **Step 10: Commit**

```bash
F="src/shared/dal/client/lib/data-view-pending-context.ts src/shared/dal/client/hooks/use-is-data-view-pending.ts src/shared/components/data-view-pending.tsx src/shared/components/data-view-boundary.tsx src/shared/dal/client/constants/empty-data-view-read.ts src/shared/dal/client/hooks/use-loading-screen-read.ts src/shared/dal/client/hooks/use-hydration-parity-check.ts src/trpc/query-client.ts"
git add $F
git commit -m "feat(data-view): reads in a loading screen show cached rows; an error fallback stays row-less; 30-minute client cache

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $F
```

---

### Task 2: The read hooks show cached rows in loading screens; `isFetching` means "refreshing stale rows"; the schedule highlight waits for the page

**Files:**
- Modify: `src/shared/dal/client/hooks/use-data-view-query.ts`
- Modify: `src/shared/dal/client/hooks/use-paginated-query.ts`
- Modify: `src/shared/dal/client/lib/types.ts` (both result types' query-state comments)
- Modify: `src/features/agent-dashboard/constants/route-pending-views.ts:8-9` (comment)
- Modify: `src/features/schedule-management/hooks/use-schedule-highlight.ts`
- Test: `$W/check-return.mjs`

**Interfaces:**
- Consumes: `useLoadingScreenRead`, `useIsDataViewPending`, `useHydrationParityCheck` (Task 1).
- Produces: result fields with new meaning, names and types unchanged — `isPending`: no rows to show (a pending view with nothing to show); `isFetching`: refetching rows older than `staleTime` or invalidated.

- [ ] **Step 1: Write the failing browser check**

`$W/check-return.mjs`:

```js
import { openPage, redact } from './check-lib.mjs'

// Exact nav hrefs (the sidebar/dock links); the pipeline link carries the active pipeline, so it is a prefix.
const ROUTES = {
  meetings: { link: 'a[href="/dashboard/meetings"]', path: p => p === '/dashboard/meetings', item: 'tbody tr[data-meeting-row]' },
  customers: { link: 'a[href="/dashboard/customers"]', path: p => p === '/dashboard/customers', item: 'tbody tr[data-customer-row]' },
  projects: { link: 'a[href="/dashboard/projects"]', path: p => p === '/dashboard/projects', item: 'tbody tr[data-project-row]' },
  proposals: { link: 'a[href="/dashboard/proposals"]', path: p => p === '/dashboard/proposals', item: 'tbody tr[data-proposal-row]' },
  schedule: { link: 'a[href="/dashboard/schedule"]', path: p => p === '/dashboard/schedule', item: null },
  pipeline: { link: 'a[href^="/dashboard/pipeline/"]', path: p => p.startsWith('/dashboard/pipeline/'), item: '.min-w-70 [data-slot="card"]' },
}

const { browser, page, errors } = await openPage('/dashboard/pipeline/fresh')
const cdp = await page.context().newCDPSession(page)
const throttle = on => cdp.send('Network.emulateNetworkConditions', on
  ? { offline: false, latency: 300, downloadThroughput: 60000, uploadThroughput: -1 }
  : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
const drift = []
page.on('console', (msg) => {
  if (msg.text().includes('[prefetch drift]')) {
    drift.push(redact(msg.text()).slice(0, 160))
  }
})
let failed = false
const verdict = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} — ${detail}`)
  failed ||= !ok
}

// Every 50 ms for `ms` after the click: pending-view frames (with and without items), skeleton frames with no items,
// hairline frames, and the fewest items once items were seen.
function sample(item, ms) {
  return page.evaluate(([item, ms]) => new Promise((resolve) => {
    const out = { pendingFrames: 0, pendingWithItems: 0, skeletonNoItems: 0, hairline: 0, minItemsAfterFirst: null }
    const start = performance.now()
    let seen = false
    const tick = () => {
      const pending = !!document.querySelector('[data-slot="data-view-pending"]')
      const skeleton = !!document.querySelector('main main [data-slot="skeleton"], [data-slot="data-view-pending"] [data-slot="skeleton"]')
      const items = item ? [...document.querySelectorAll(item)].filter(el => el.getClientRects().length > 0).length : null
      if (pending) out.pendingFrames++
      if (pending && items > 0) out.pendingWithItems++
      if (item && skeleton && items === 0) out.skeletonNoItems++
      if (document.querySelector('.animate-toolbar-shimmer')) out.hairline++
      if (items > 0) seen = true
      if (seen) out.minItemsAfterFirst = Math.min(out.minItemsAfterFirst ?? items, items)
      if (performance.now() - start < ms) setTimeout(tick, 50)
      else resolve(out)
    }
    tick()
  }), [item, ms])
}

async function go(name, ms) {
  const r = ROUTES[name]
  const sampler = sample(r.item, ms)
  await page.locator(r.link).filter({ visible: true }).first().click()
  await page.waitForURL(url => r.path(new URL(url).pathname), { timeout: 120000 })
  if (r.item) {
    await page.waitForSelector(r.item, { timeout: 120000 })
  }
  return sampler
}

try {
  await page.waitForSelector(ROUTES.pipeline.item, { timeout: 180000 })
  // First visits (dev compiles) unthrottled.
  for (const name of ['meetings', 'customers', 'projects', 'proposals', 'schedule', 'pipeline']) {
    await go(name, 4000)
  }
  // 1. Throttled quick returns: X → pipeline → X, the return within seconds of the first visit.
  await throttle(true)
  for (const name of ['meetings', 'customers', 'projects', 'proposals', 'schedule', 'pipeline']) {
    const away = name === 'pipeline' ? 'meetings' : 'pipeline'
    await go(name, 3000)
    await go(away, 3000)
    const r = await go(name, 12000)
    const pendingOk = !ROUTES[name].item || r.pendingFrames === 0 || r.pendingWithItems > 0
    verdict(`quick return → ${name}`, r.hairline === 0 && r.skeletonNoItems === 0 && pendingOk, JSON.stringify(r))
  }
  await throttle(false)
  // 2. Refresh button: the hairline shows although the rows are fresh.
  await go('meetings', 3000)
  const refreshSampler = sample(ROUTES.meetings.item, 3000)
  await page.getByRole('button', { name: /refresh/i }).filter({ visible: true }).first().click()
  const refreshed = await refreshSampler
  verdict('refresh button shows the hairline', refreshed.hairline > 0, JSON.stringify(refreshed))
  // 3. A failed refetch past the 30 s window keeps the rows. Page errors in this window are reported, not judged.
  await go('pipeline', 3000)
  await page.waitForTimeout(31000)
  let aborted = 0
  const onFailed = (request) => {
    if (request.url().includes('/api/trpc/')) aborted++
  }
  page.on('requestfailed', onFailed)
  await page.route('**/api/trpc/**', route => route.abort())
  const errorsBefore = errors.length
  const failedRefetch = await go('meetings', 6000)
  await page.unroute('**/api/trpc/**')
  page.off('requestfailed', onFailed)
  const abortErrors = errors.splice(errorsBefore)
  verdict('failed refetch keeps the rows', aborted > 0 && failedRefetch.minItemsAfterFirst > 0, `${JSON.stringify(failedRefetch)} aborted=${aborted} errorsDuringAbort=${JSON.stringify(abortErrors)}`)
}
catch (error) {
  console.error('ERR', redact(error.message).split('\n')[0])
  failed = true
}
verdict('no prefetch-drift errors', drift.length === 0, drift.join(' | ') || 'none')
verdict('no page errors', errors.length === 0, errors.join(' | ') || 'none')
await browser.close()
process.exit(failed ? 1 : 0)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node $W/check-return.mjs 2>&1 | tee $W/task-2-red.txt`
Expected: FAIL on at least one `quick return →` line, with `hairline` > 0 (the in-flight server copy is adopted as a fetch) and/or `pendingFrames` > 0 with `pendingWithItems` 0 (the loading screen showed skeletons). The refresh and failed-refetch lines pass on current code too; they are regression guards, not this task's RED.
If every quick-return line passes, the throttle is not keeping the stream in flight: lower `downloadThroughput` (e.g. 30000) or raise `latency`, re-run, and ledger the values that reproduce. Do not change product code until a quick return FAILs here. If a selector matches nothing, fix it first (a timeout is not RED).

- [ ] **Step 3: Update `useDataViewQuery`**

In `src/shared/dal/client/hooks/use-data-view-query.ts`:

a) Imports: add `import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'` and `import { useLoadingScreenRead } from '@/shared/dal/client/hooks/use-loading-screen-read'` (sorted among the `@/shared/dal/client/hooks/*` imports); remove `import { checkHydrationParity } from '@/shared/lib/hydration-drift'`.

b) Replace `const isPending = useIsDataViewPending()` with `const isPendingView = useIsDataViewPending()`.

c) Replace this block:

```ts
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

with:

```ts
  const shownOptions = anyProcedure.queryOptions(shownInput)
  const loadingScreenRead = useLoadingScreenRead(shownOptions)
  const isPending = loadingScreenRead === null
  const isStale = !isPending && hashKey(requestedOptions.queryKey) !== hashKey(shownOptions.queryKey)

  useServerPrefetchGuard(shownOptions.queryKey, !isPendingView)
  useHydrationParityCheck(shownOptions.queryKey as readonly unknown[])

  // Suspends until the shown key's rows are in (streamed from the server prefetch on a document load). A pending view
  // with nothing to show reads a key that already holds an empty page, so the view draws with no rows.
  const read = useSuspenseQuery(loadingScreenRead ?? (EMPTY_DATA_VIEW_READ as unknown as typeof shownOptions))
  const data = read.data as PaginatedResult<DataViewRowOf<TProcedure>>
  const rows = data.rows
  const total = data.total
  // Every return to a route refetches; only a refetch of rows older than staleTime, or invalidated by a save or
  // refresh, is worth showing, so a quick return refreshes silently.
  const isPastStaleTime = read.isStale
  const isFetching = !isPending && read.isFetching && isPastStaleTime
```

d) The page clamp — replace

```ts
    if (!isPending && !isStale && windowState.kind === 'page' && pageCount > 0 && windowState.page > pageCount) {
      void setUrlState({ [keys.pageKey]: pageCount } as never, { history: 'replace' })
    }
  }, [isPending, isStale, windowState, pageCount, keys, setUrlState])
```

with

```ts
    if (!isPendingView && !isStale && windowState.kind === 'page' && pageCount > 0 && windowState.page > pageCount) {
      void setUrlState({ [keys.pageKey]: pageCount } as never, { history: 'replace' })
    }
  }, [isPendingView, isStale, windowState, pageCount, keys, setUrlState])
```

e) The neighbour preload — replace `usePrefetchQueries(adjacentQueries, !isPending && !isFetching)` with

```ts
  // The page that replaces a pending view warms the neighbours, so a pending view starts no fetch.
  usePrefetchQueries(adjacentQueries, !isPendingView && !read.isFetching)
```

f) If `useEffect` is no longer used elsewhere in the file, remove it from the `react` import (it is still used by the page clamp, so it stays).

- [ ] **Step 4: Update `usePaginatedQuery`**

In `src/shared/dal/client/hooks/use-paginated-query.ts`:

a) Imports: add `useHydrationParityCheck` and `useLoadingScreenRead` (sorted); remove `import { checkHydrationParity } from '@/shared/lib/hydration-drift'`.

b) Replace `const isPending = useIsDataViewPending()` with `const isPendingView = useIsDataViewPending()`.

c) Replace

```ts
  const baseOptions = queryOptionsFactory(shownInput)
  const isStale = !isPending && hashKey(requestedOptions.queryKey) !== hashKey(baseOptions.queryKey)
```

with

```ts
  const baseOptions = queryOptionsFactory(shownInput)
  const loadingScreenRead = useLoadingScreenRead(baseOptions)
  const isPending = loadingScreenRead === null
  const isStale = !isPending && hashKey(requestedOptions.queryKey) !== hashKey(baseOptions.queryKey)
```

d) Replace

```ts
  // Dev-only: detect server-prefetch key drift (wasted hydration).
  const baseQueryKey = baseOptions.queryKey as readonly unknown[]
  useServerPrefetchGuard(baseOptions.queryKey, !isPending)
  useEffect(() => {
    if (!isPending) {
      checkHydrationParity(baseQueryKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only; later key changes are client-driven refetches, not hydration targets
  }, [])

  // Suspends until the shown key's rows are in; inside a DataViewBoundary fallback it reads an empty page instead.
  const read = useSuspenseQuery(isPending ? (EMPTY_DATA_VIEW_READ as unknown as typeof baseOptions) : baseOptions)
  const data = read.data as PaginatedResult<TRow>
  const isFetching = !isPending && read.isFetching
```

with

```ts
  useServerPrefetchGuard(baseOptions.queryKey, !isPendingView)
  useHydrationParityCheck(baseOptions.queryKey as readonly unknown[])

  // Suspends until the shown key's rows are in; a pending view with nothing to show reads an empty page instead.
  const read = useSuspenseQuery(loadingScreenRead ?? (EMPTY_DATA_VIEW_READ as unknown as typeof baseOptions))
  const data = read.data as PaginatedResult<TRow>
  // Every return to a route refetches; only a refetch of rows older than staleTime, or invalidated by a save or
  // refresh, is worth showing, so a quick return refreshes silently.
  const isPastStaleTime = read.isStale
  const isFetching = !isPending && read.isFetching && isPastStaleTime
  const isReadFetching = read.isFetching
```

e) The clamp: `if (!isPending && !isStale && pageCount > 0 && page > pageCount) {` → `if (!isPendingView && !isStale && pageCount > 0 && page > pageCount) {`; deps `[isPending, isStale, page, pageCount, keys.pageKey, setUrlState]` → `[isPendingView, isStale, page, pageCount, keys.pageKey, setUrlState]`.

f) The next-page prefetch: `if (!prefetchNextPage || isPending || isStale || isFetching) {` → `if (!prefetchNextPage || isPendingView || isStale || isReadFetching) {`; deps `[prefetchNextPage, isPending, isStale, isFetching, data.total, shownDerived, shownInput, queryOptionsFactory, qc]` → `[prefetchNextPage, isPendingView, isStale, isReadFetching, data.total, shownDerived, shownInput, queryOptionsFactory, qc]`.

g) Keep `useEffect` in the `react` import only if still used (the clamp and next-page prefetch use it, so it stays).

- [ ] **Step 5: Result types, route-pending-views comment, schedule highlight**

`src/shared/dal/client/lib/types.ts` — in both result types, replace the three query-state comments with:

```ts
  /** True when there are no rows to show: a pending view with nothing cached, so the view draws its skeleton. */
  isPending: boolean
  /** The rows belong to an older URL state while the requested one loads; tables dim them. */
  isStale: boolean
  /** Refetching rows older than staleTime or invalidated (a save, `refresh()`); the rows stay. A fresh refetch is silent. */
  isFetching: boolean
```

`src/features/agent-dashboard/constants/route-pending-views.ts` — the comment's "keeps them from reading" becomes "keeps them from fetching":

```ts
// Lazy, so the layout's bundle doesn't carry every page; the pending context (not these components) keeps them from
// fetching, so each one is its page's own loading state.
```

`src/features/schedule-management/hooks/use-schedule-highlight.ts`:
- add `import { useIsDataViewPending } from '@/shared/dal/client/hooks/use-is-data-view-pending'` (after the `@/features/...` import, per the sorter);
- inside `useScheduleHighlight`, before `isHighlighted`: `const isPendingView = useIsDataViewPending()`;
- in `highlightRef`, the guard becomes:

```ts
        // Only fire once, only for the highlighted meeting, only on mount (not unmount), and only on the page: a
        // loading screen showing cached rows unmounts a moment later, and its scroll and timer would run twice.
        if (!node || isPendingView || meetingId !== activeHighlight || timerRef.current) {
          return
        }
```

- `useCallback` deps `[activeHighlight, setHighlightMeeting]` → `[activeHighlight, isPendingView, setHighlightMeeting]`.

- [ ] **Step 6: Run the check to verify it passes**

Run: `node $W/check-return.mjs 2>&1 | tee $W/task-2-green.txt`
Expected: every line `PASS`, exit 0. Ledger, per route, whether `pendingFrames` > 0 was observed (the loading screen exercised in dev) — routes where it never appeared are covered by Task 1's unit check and the owner's production check.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc` → no errors. Run: `pnpm exec eslint src/shared/dal/client src/features/agent-dashboard/constants/route-pending-views.ts src/features/schedule-management/hooks/use-schedule-highlight.ts` → no output.

- [ ] **Step 8: Commit**

```bash
F="src/shared/dal/client/hooks/use-data-view-query.ts src/shared/dal/client/hooks/use-paginated-query.ts src/shared/dal/client/lib/types.ts src/features/agent-dashboard/constants/route-pending-views.ts src/features/schedule-management/hooks/use-schedule-highlight.ts"
git add $F
git commit -m "fix(data-view): a return to a tab shows its cached rows and refreshes them silently until they are stale

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $F
```

---

### Task 3: Dashboard home — its own loading screen, sections read the cache, greeting from the session

**Files:**
- Move: `src/app/(frontend)/dashboard/page.tsx` → `src/app/(frontend)/dashboard/(home)/page.tsx`
- Create: `src/app/(frontend)/dashboard/(home)/loading.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-home-pending-view.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx`, `dashboard-proposal-section-list.tsx`, `dashboard-project-section.tsx`, `dashboard-project-section-list.tsx`, `dashboard-snapshot-strip.tsx`, `dashboard-snapshot-counts.tsx`
- Test: `$W/check-home.mjs`

**Interfaces:**
- Consumes: `useLoadingScreenRead` (Task 1); `useSession` from `@/shared/domains/auth/client`; `useTRPC` from `@/trpc/helpers`.
- Produces: `DashboardProposalSectionList` props `{ title, options, timeSince, emptyMessage }`; `DashboardProjectSectionList` props `{ title, options, emptyMessage }`; `DashboardSnapshotCounts` props `{ meetingsToday, awaitingSignature, activeProjects }` (each a read's options). Each list's options type is `ReturnType<ReturnType<typeof useTRPC>['<router>']['<sub>']['list']['queryOptions']>`, the repo's precedent (`use-get-proposal.ts`).

- [ ] **Step 1: Write the failing check**

`$W/check-home.mjs`:

```js
import { existsSync } from 'node:fs'

import { openPage, redact } from './check-lib.mjs'

let failed = false
const verdict = (label, ok, detail) => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label} — ${detail}`)
  failed ||= !ok
}

const D = 'src/app/(frontend)/dashboard'
verdict('home page lives in (home)', existsSync(`${D}/(home)/page.tsx`) && !existsSync(`${D}/page.tsx`), `${D}/(home)/page.tsx`)
verdict('home loading screen lives in (home), none at the dashboard root', existsSync(`${D}/(home)/loading.tsx`) && !existsSync(`${D}/loading.tsx`), `${D}/(home)/loading.tsx`)

const { browser, page, errors } = await openPage('/dashboard')
const cdp = await page.context().newCDPSession(page)
const drift = []
page.on('console', (msg) => {
  if (msg.text().includes('[prefetch drift]')) {
    drift.push(redact(msg.text()).slice(0, 160))
  }
})
// Frames where the home view shows on another route; on home: frames with section skeletons, frames greeting with no name.
function sample(ms) {
  return page.evaluate(ms => new Promise((resolve) => {
    const out = { homeOnOtherRoute: 0, sectionSkeletons: 0, greetingNoName: 0, homeFrames: 0 }
    const start = performance.now()
    const tick = () => {
      const home = !!document.querySelector('main section#proposals')
      if (home && location.pathname !== '/dashboard') out.homeOnOtherRoute++
      if (home && location.pathname === '/dashboard') {
        out.homeFrames++
        if (document.querySelector('main section#meetings [data-slot="skeleton"], main section#proposals [data-slot="skeleton"], main section#projects [data-slot="skeleton"]')) out.sectionSkeletons++
        if (!/Welcome back, \S/.test(document.querySelector('main h1')?.textContent ?? '')) out.greetingNoName++
      }
      if (performance.now() - start < ms) setTimeout(tick, 50)
      else resolve(out)
    }
    tick()
  }), ms)
}
async function go(selector, isTarget, ms) {
  const sampler = sample(ms)
  await page.locator(selector).filter({ visible: true }).first().click()
  await page.waitForURL(url => isTarget(new URL(url).pathname), { timeout: 120000 })
  return sampler
}
try {
  await page.waitForSelector('main section#proposals', { timeout: 180000 })
  await page.waitForTimeout(3000)
  // Warm analytics (first visit compiles), then come home.
  await go('a[href="/dashboard/analytics"]', p => p === '/dashboard/analytics', 4000)
  await go('a[href="/dashboard"]', p => p === '/dashboard', 4000)
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 60000, uploadThroughput: -1 })
  await go('a[href^="/dashboard/pipeline/"]', p => p.startsWith('/dashboard/pipeline/'), 4000)
  const home = await go('a[href="/dashboard"]', p => p === '/dashboard', 12000)
  verdict('return → home: cached sections and the name from the first frame', home.homeFrames > 0 && home.sectionSkeletons === 0 && home.greetingNoName === 0, JSON.stringify(home))
  const analytics = await go('a[href="/dashboard/analytics"]', p => p === '/dashboard/analytics', 12000)
  verdict('→ analytics never shows the home view', analytics.homeOnOtherRoute === 0, JSON.stringify(analytics))
}
catch (error) {
  console.error('ERR', redact(error.message).split('\n')[0])
  failed = true
}
verdict('no prefetch-drift errors', drift.length === 0, drift.join(' | ') || 'none')
verdict('no page errors', errors.length === 0, errors.join(' | ') || 'none')
await browser.close()
process.exit(failed ? 1 : 0)
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node $W/check-home.mjs 2>&1 | tee $W/task-3-red.txt`
Expected: FAIL on both structural lines. The browser lines may pass on current code (no home loading screen exists yet, so dev keeps the previous page up); they guard the GREEN.

- [ ] **Step 3: Move the page, add the loading screen, greet from the session**

```bash
mkdir -p 'src/app/(frontend)/dashboard/(home)'
git mv 'src/app/(frontend)/dashboard/page.tsx' 'src/app/(frontend)/dashboard/(home)/page.tsx'
```

`src/app/(frontend)/dashboard/(home)/loading.tsx`:

```tsx
import { DashboardHomePendingView } from '@/features/agent-dashboard/ui/components/dashboard-home-pending-view'
import { DataViewPending } from '@/shared/components/data-view-pending'

// Inside the (home) group: a loading screen beside the dashboard layout would also stand in for every dashboard route
// that has none of its own.
export default function DashboardHomeLoading() {
  return (
    <DataViewPending>
      <DashboardHomePendingView />
    </DataViewPending>
  )
}
```

`src/features/agent-dashboard/ui/components/dashboard-home-pending-view.tsx`:

```tsx
'use client'

import { DashboardView } from '@/features/agent-dashboard/ui/views/dashboard-view'
import { useSession } from '@/shared/domains/auth/client'

// The page's own composition, drawn in the pending context as its loading state. The page gets the name from the
// server; here the client session supplies it (loaded on any in-app navigation), so a return to home keeps its greeting.
export function DashboardHomePendingView() {
  const { data: session } = useSession()
  return <DashboardView name={session?.user.name ?? null} />
}
```

In `dashboard-snapshot-counts.tsx`, the doc comment's "share the server prefetch in `dashboard/page.tsx`" becomes "share the dashboard home page's server prefetch".

- [ ] **Step 4: Sections decide; lists read**

`dashboard-proposal-section.tsx`:

```tsx
'use client'

import type { ProposalListInput } from '@/shared/modules/proposals/core/dal/server/queries'

import { Suspense } from 'react'

import { DashboardListSectionSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-list-section-skeleton'
import { DashboardProposalSectionList } from '@/features/agent-dashboard/ui/components/dashboard-proposal-section-list'
import { useLoadingScreenRead } from '@/shared/dal/client/hooks/use-loading-screen-read'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'
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
 * One labeled sub-section of the dashboard Proposals module. Each section suspends on its own,
 * so the server streams its rows into the HTML as its prefetch lands and a failed read stays
 * inside the section.
 */
export function DashboardProposalSection({ title, input, timeSince, emptyMessage }: DashboardProposalSectionProps) {
  const trpc = useTRPC()
  const options = useLoadingScreenRead(trpc.proposalsRouter.business.list.queryOptions(input))
  const skeleton = <DashboardListSectionSkeleton title={title} card="proposal" />
  if (!options) {
    return skeleton
  }
  return (
    <HydrationErrorBoundary variant="section">
      <Suspense fallback={skeleton}>
        <DashboardProposalSectionList title={title} options={options} timeSince={timeSince} emptyMessage={emptyMessage} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
```

`dashboard-proposal-section-list.tsx` — drop the `ProposalListInput` import; props and the read become:

```tsx
type ProposalListOptions = ReturnType<ReturnType<typeof useTRPC>['proposalsRouter']['business']['list']['queryOptions']>

interface DashboardProposalSectionListProps {
  title: string
  options: ProposalListOptions
  timeSince: 'contractSentAt' | 'sentAt'
  emptyMessage: string
}
```

and in the component, replace

```tsx
  const trpc = useTRPC()
  const options = trpc.proposalsRouter.business.list.queryOptions(input)
  useHydrationParityCheck(options.queryKey)
```

with

```tsx
  useHydrationParityCheck(options.queryKey)
```

and the signature's `input` with `options`. Keep `import type { useTRPC } from '@/trpc/helpers'` (type-only now).

`dashboard-project-section.tsx`:

```tsx
'use client'

import type { DataViewInput } from '@/shared/dal/lib/query/data-view-query-config'
import type { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'

import { Suspense } from 'react'

import { DashboardListSectionSkeleton } from '@/features/agent-dashboard/ui/components/dashboard-list-section-skeleton'
import { DashboardProjectSectionList } from '@/features/agent-dashboard/ui/components/dashboard-project-section-list'
import { useLoadingScreenRead } from '@/shared/dal/client/hooks/use-loading-screen-read'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'
import { useTRPC } from '@/trpc/helpers'

interface DashboardProjectSectionProps {
  /** Space-Mono eyebrow naming the section's status bucket. */
  title: string
  /** The static input of the config the page prefetches, so the key matches (hydration parity). */
  input: DataViewInput<typeof PROJECT_FIELDS>
  /** Shown when the section has zero rows. */
  emptyMessage: string
}

/**
 * One labeled sub-section of the dashboard Projects module. Mirrors `DashboardProposalSection`:
 * it suspends on its own, so its rows stream into the server HTML and a failed read stays inside
 * the section.
 */
export function DashboardProjectSection({ title, input, emptyMessage }: DashboardProjectSectionProps) {
  const trpc = useTRPC()
  const options = useLoadingScreenRead(trpc.projectsRouter.crud.list.queryOptions(input))
  const skeleton = <DashboardListSectionSkeleton title={title} card="project" />
  if (!options) {
    return skeleton
  }
  return (
    <HydrationErrorBoundary variant="section">
      <Suspense fallback={skeleton}>
        <DashboardProjectSectionList title={title} options={options} emptyMessage={emptyMessage} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
```

`dashboard-project-section-list.tsx` — drop the `DataViewInput` and `PROJECT_FIELDS` type imports (they typed `input`); add

```tsx
type ProjectListOptions = ReturnType<ReturnType<typeof useTRPC>['projectsRouter']['crud']['list']['queryOptions']>

interface DashboardProjectSectionListProps {
  title: string
  options: ProjectListOptions
  emptyMessage: string
}
```

replace `const trpc = useTRPC()` + `const options = trpc.projectsRouter.crud.list.queryOptions(input)` with nothing (the parity check and `useSuspenseQuery(options)` stay), take `options` in the signature instead of `input`, and make the `useTRPC` import type-only.

If `pnpm tsc` rejects the `ReturnType` of the overloaded `queryOptions` at the call sites, ledger the error and type the prop as the narrowest TanStack options type that compiles (for example `UseSuspenseQueryOptions<inferOutput<...>>` built from the procedure's output); do not add casts at the call sites.

- [ ] **Step 5: The snapshot strip decides; the counts read**

`dashboard-snapshot-strip.tsx`:

```tsx
'use client'

import { Suspense } from 'react'

import { awaitingProposalsInput, DASHBOARD_ACTIVE_PROJECTS_QUERY, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardSnapshotChips } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-chips'
import { DashboardSnapshotCounts } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-counts'
import { useLoadingScreenRead } from '@/shared/dal/client/hooks/use-loading-screen-read'
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { HydrationErrorBoundary } from '@/trpc/components/hydration-error-boundary'
import { useTRPC } from '@/trpc/helpers'

/**
 * The chips are jump-links first, so they render while the counts load and stay when a count
 * read fails; the modules below own the loud error state and its retry.
 */
export function DashboardSnapshotStrip() {
  const trpc = useTRPC()
  const meetingsToday = useLoadingScreenRead(trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today')))
  const awaitingSignature = useLoadingScreenRead(trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()))
  const activeProjects = useLoadingScreenRead(trpc.projectsRouter.crud.list.queryOptions(staticDataViewInput(DASHBOARD_ACTIVE_PROJECTS_QUERY)))
  if (!meetingsToday || !awaitingSignature || !activeProjects) {
    return <DashboardSnapshotChips />
  }
  return (
    <HydrationErrorBoundary fallback={<DashboardSnapshotChips />}>
      <Suspense fallback={<DashboardSnapshotChips />}>
        <DashboardSnapshotCounts meetingsToday={meetingsToday} awaitingSignature={awaitingSignature} activeProjects={activeProjects} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
```

`dashboard-snapshot-counts.tsx`:

```tsx
'use client'

import type { useTRPC } from '@/trpc/helpers'

import { useSuspenseQueries } from '@tanstack/react-query'

import { DashboardSnapshotChips } from '@/features/agent-dashboard/ui/components/dashboard-snapshot-chips'
import { useHydrationParityCheck } from '@/shared/dal/client/hooks/use-hydration-parity-check'

type TRPC = ReturnType<typeof useTRPC>

interface DashboardSnapshotCountsProps {
  meetingsToday: ReturnType<TRPC['meetingsRouter']['reads']['list']['queryOptions']>
  awaitingSignature: ReturnType<TRPC['proposalsRouter']['business']['list']['queryOptions']>
  activeProjects: ReturnType<TRPC['projectsRouter']['crud']['list']['queryOptions']>
}

/**
 * Counts are read from the same query inputs the modules below use, so they share the dashboard
 * home page's server prefetch and never fire a count query of their own.
 */
export function DashboardSnapshotCounts({ meetingsToday, awaitingSignature, activeProjects }: DashboardSnapshotCountsProps) {
  useHydrationParityCheck(meetingsToday.queryKey)
  useHydrationParityCheck(awaitingSignature.queryKey)
  useHydrationParityCheck(activeProjects.queryKey)

  // Plural, so the three reads suspend together instead of one after another.
  const [meetingsTodayRead, awaitingSignatureRead, activeProjectsRead] = useSuspenseQueries({
    queries: [meetingsToday, awaitingSignature, activeProjects],
  })

  return (
    <DashboardSnapshotChips
      counts={{
        meetingsToday: meetingsTodayRead.data.total,
        awaitingSignature: awaitingSignatureRead.data.total,
        activeProjects: activeProjectsRead.data.total,
      }}
    />
  )
}
```

(Same typing fallback rule as Step 4.)

- [ ] **Step 6: Run the check to verify it passes**

Run: `node $W/check-home.mjs 2>&1 | tee $W/task-3-green.txt`
Expected: every line `PASS`, exit 0. Ledger whether `homeFrames` included pending-view frames (`[data-slot="data-view-pending"]`) — i.e. whether the home loading screen was exercised in dev.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc` → no errors. A stale `.next/types` entry for the old `dashboard/page.tsx` path clears once the dev server recompiles `/dashboard`; if `tsc` names it, load `/dashboard` once and re-run. Run: `pnpm exec eslint 'src/app/(frontend)/dashboard/(home)' src/features/agent-dashboard/ui/components` → no output.

- [ ] **Step 8: Commit**

```bash
D=src/features/agent-dashboard/ui/components
git add 'src/app/(frontend)/dashboard/(home)/loading.tsx'
git commit -m "feat(dashboard): home has its own loading screen, drawn from the cache and greeting by name

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- 'src/app/(frontend)/dashboard/page.tsx' 'src/app/(frontend)/dashboard/(home)/page.tsx' 'src/app/(frontend)/dashboard/(home)/loading.tsx' $D/dashboard-home-pending-view.tsx $D/dashboard-proposal-section.tsx $D/dashboard-proposal-section-list.tsx $D/dashboard-project-section.tsx $D/dashboard-project-section-list.tsx $D/dashboard-snapshot-strip.tsx $D/dashboard-snapshot-counts.tsx
```

---

### Task 4: The schedule week view opens on today's column without a scroll

**Files:**
- Modify: `src/features/schedule-management/ui/components/schedule-week-view.tsx` (React import; the scroll effect)
- Test: `$W/check-week-entry.mjs`

**Interfaces:** none consumed or produced.

- [ ] **Step 1: Write the failing check**

`$W/check-week-entry.mjs`:

```js
import { openPage, redact } from './check-lib.mjs'

const day = new Date().getDay()
if (day === 0 || day === 6) {
  console.log('WARN today is a weekend day: today\'s column may sit at the left edge or be hidden, so RED can pass vacuously. Run on a weekday.')
}

let failed = false
const { browser, page, errors } = await openPage('/dashboard/pipeline/fresh', '', { viewport: { width: 390, height: 860 } })
const scheduleLink = 'a[href="/dashboard/schedule"]'
const pipelineLink = 'a[href^="/dashboard/pipeline/"]'

// The week scroller: the overflow-x container whose first child carries the grid's inline min-width (the kanban board
// is also an overflow-x container, but has no such child). Records only on the schedule route, for `ms` after it appears.
function sampleScroller(ms) {
  return page.evaluate(ms => new Promise((resolve) => {
    const values = []
    let firstSeen = null
    const giveUp = performance.now() + 60000
    const find = () => [...document.querySelectorAll('main .overflow-x-auto')].find(el => el.firstElementChild?.style?.minWidth)
    const tick = () => {
      const scroller = location.pathname.startsWith('/dashboard/schedule') ? find() : null
      if (scroller) {
        firstSeen ??= performance.now()
        values.push(Math.round(scroller.scrollLeft))
      }
      const now = performance.now()
      if ((firstSeen !== null && now - firstSeen > ms) || now > giveUp) resolve(values)
      else requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }), ms)
}

try {
  await page.waitForSelector('.min-w-70 [data-slot="card"]', { timeout: 180000 })
  // Warm the schedule route (first visit compiles), then come back.
  await page.locator(scheduleLink).filter({ visible: true }).first().click()
  await page.waitForURL('**/dashboard/schedule**', { timeout: 120000 })
  await page.waitForTimeout(3000)
  await page.locator(pipelineLink).filter({ visible: true }).first().click()
  await page.waitForURL('**/dashboard/pipeline/**', { timeout: 120000 })
  await page.waitForTimeout(2000)
  for (const round of [1, 2]) {
    const sampler = sampleScroller(3000)
    await page.locator(scheduleLink).filter({ visible: true }).first().click()
    await page.waitForURL('**/dashboard/schedule**', { timeout: 120000 })
    const values = await sampler
    const distinct = [...new Set(values)]
    const ok = values.length > 0 && distinct.length === 1
    console.log(`${ok ? 'PASS' : 'FAIL'} round ${round}: scrollLeft never moves on entry — distinct ${JSON.stringify(distinct.slice(0, 12))} over ${values.length} frames`)
    failed ||= !ok
    if (round === 2) {
      // A week step still animates: forward aligns Sunday at the start, from today's offset.
      const stepSampler = sampleScroller(1500)
      await page.getByRole('button', { name: 'Next' }).filter({ visible: true }).first().click()
      const step = [...new Set(await stepSampler)]
      const animated = step.length > 2
      console.log(`${animated ? 'PASS' : 'FAIL'} Next still animates — distinct ${JSON.stringify(step.slice(0, 12))}`)
      failed ||= !animated
    }
    await page.locator(pipelineLink).filter({ visible: true }).first().click()
    await page.waitForURL('**/dashboard/pipeline/**', { timeout: 120000 })
    await page.waitForTimeout(2000)
  }
}
catch (error) {
  console.error('ERR', redact(error.message).split('\n')[0])
  failed = true
}
console.log(`${errors.length === 0 ? 'PASS' : 'FAIL'} no page errors — ${errors.join(' | ') || 'none'}`)
failed ||= errors.length > 0
await browser.close()
process.exit(failed ? 1 : 0)
```

Note: if today's offset is 0 (today's column already fits the 390 px viewport), the `Next` step has nothing to animate from; on a weekday at 390 px Monday onward overflows, so this holds Monday–Friday. If the `Next` line fails on RED as well, ledger its distinct values before deciding whether the assertion or the code is wrong.

- [ ] **Step 2: Run it to verify it fails**

Run: `node $W/check-week-entry.mjs 2>&1 | tee $W/task-4-red.txt`
Expected: FAIL on the `round` lines — several distinct `scrollLeft` values per entry (the smooth scroll from 0 to today's column). The `Next` line passes on current code (it guards the GREEN).

- [ ] **Step 3: Place the viewport before paint on mount; animate only week changes**

In `schedule-week-view.tsx`, change the React import to `import { useLayoutEffect, useMemo, useRef } from 'react'`, and replace the comment block and effect (from `// Snap the horizontal viewport on week navigation for continuity:` through the effect's closing `}, [currentDate])`) with:

```tsx
  // Snap the horizontal viewport on week navigation for continuity:
  // - Today landing in the week wins (covers the "Today" button)
  // - Forward (next week)  → align Sunday at the start of the viewport
  // - Backward (prev week) → align Friday at the end of the viewport
  useLayoutEffect(() => {
    const prev = prevDateRef.current
    prevDateRef.current = currentDate
    const scroller = scrollRef.current
    const todayCol = todayColRef.current

    if (!prev) {
      // A mount places the viewport before the first paint instead of scrolling there: the route's loading screen and
      // the page each mount this view, and a slide on every entry reads as the page jumping. Only the horizontal
      // scroller moves (scrollIntoView would move its ancestors too), and the app-wide smooth scroll-behavior is
      // lifted for this one assignment.
      if (scroller && todayCol) {
        const overflow = todayCol.getBoundingClientRect().right - scroller.getBoundingClientRect().left - scroller.clientWidth
        if (overflow > 0) {
          scroller.style.scrollBehavior = 'auto'
          scroller.scrollLeft = overflow
          scroller.style.scrollBehavior = ''
        }
      }
      return
    }

    if (todayCol) {
      todayCol.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
      return
    }

    const direction = currentDate.getTime() > prev.getTime() ? 'forward' : 'backward'
    const target = direction === 'forward' ? sundayColRef.current : fridayColRef.current
    if (!target) {
      return
    }
    target.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: direction === 'forward' ? 'start' : 'end',
    })
  }, [currentDate])
```

(React 19 dev StrictMode re-runs the layout effect on mount: the second run sees `prev` set and smooth-scrolls to today, which is already in view, so nothing moves.)

- [ ] **Step 4: Run the check to verify it passes**

Run: `node $W/check-week-entry.mjs 2>&1 | tee $W/task-4-green.txt`
Expected: both rounds `PASS` (one distinct value each), `Next still animates` `PASS`, no page errors, exit 0.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc` → no errors. Run: `pnpm exec eslint src/features/schedule-management/ui/components/schedule-week-view.tsx` → no output.

- [ ] **Step 6: Commit**

```bash
F=src/features/schedule-management/ui/components/schedule-week-view.tsx
git add $F
git commit -m "fix(schedule): the week view opens on today's column instead of scrolling there on every entry

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $F
```

---

## After the tasks

- Re-run all four checks on the final tree, then `pnpm tsc && pnpm lint`.
- Whole-branch review by a fresh reviewer on the most capable model, with this plan's Review Focus.
- Owner checks in production after the owner ships (dev cannot prefetch loading screens): returns to pipeline, schedule, meetings, customers, proposals, projects and home show rows at once with no skeleton flash; a return after half a minute shows the hairline briefly; home greets by name on every return; the schedule on a phone opens on today's column without sliding; a deep-linked meeting on the schedule scrolls once.
- Follow-ups outside this plan's files:
  - A `CONTEXT.md` glossary entry for "loading screen" (R6) once another session releases `CONTEXT.md`.
  - Other unfinished plans cite the old `dashboard/page.tsx` path: `docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters.md:740,935`, `2026-09-29-data-view-date-windows.md:1369,1633`, and `2026-09-29-pwa-cold-start.md:187`, which depends on the build-manifest key `'/(frontend)/dashboard/page'` (now `'/(frontend)/dashboard/(home)/page'`). Tell the owner; edit only with the owner's go-ahead.
- Delete this plan and its spec once shipped (the deferred `2026-10-09` spec stays).
