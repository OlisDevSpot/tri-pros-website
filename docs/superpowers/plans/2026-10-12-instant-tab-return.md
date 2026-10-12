# Instant Tab Return Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Returning to a dashboard tab used this browser session shows its cached rows on the first frame, refetches every time, and replaces the rows in place; skeletons only on a true first visit.

**Architecture:** One hook, `useLoadingScreenRead`, decides what any read does inside a route's loading screen (`DataViewPending`): cached → the real options with `refetchOnMount: false`; uncached → `null` (the caller draws its skeleton); outside a loading screen → the options unchanged. Both data-view read hooks and the dashboard home lists go through it. The hooks' exposed `isFetching` becomes "refetching stale rows", so every hairline/spinner consumer follows the owner's rule without edits. Client `gcTime` goes to 30 min; dashboard home gets its own loading screen inside a `(home)` route group; the week view positions before paint.

**Tech Stack:** Next.js 15.5 App Router, React 19, TanStack Query 5.104, tRPC 11 (`@trpc/tanstack-react-query`), nuqs, Playwright (checks), tsx (checks).

**Spec:** `docs/superpowers/specs/2026-10-12-instant-tab-return-design.md` (approved 2026-10-12; name `useLoadingScreenRead` and route group `(home)` approved).

## Global Constraints

- Never run `pnpm build`. Verify with `pnpm tsc` and `pnpm lint`.
- Never write to any database for testing, dev included. Checks only read and navigate.
- Shared working tree with other active sessions: no `git stash`, `git checkout -- <file>`, `git reset`; stage and commit by explicit path only. Files other sessions have dirty (see `git status`) are never staged.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Comments say why, never what; no citations of plans, specs or tasks in code.
- Never print `DEV_LOGIN_SECRET`; checks import `redact` from `check-lib.mjs` and pass every error through it.
- `next.config.ts` is not touched.
- `staleTime` stays `30 * 1000`. Client `gcTime` is `30 * 60 * 1000`; server `gcTime` stays `Infinity`.
- Workspace for checks (gitignored): `.superpowers/sdd/2026-10-12-instant-tab-return/` — written below as `$W`.
- Checks need the dev server: `ss -ltnp | grep -E ':(3000|300[1-9])'` first; if none is listening on `.env.local`'s `PORT`, start `pnpm dev` in the background. Never kill a dev server you did not start.

## Review Focus

1. A return whose URL (filters, page, week) differs from every cached key → that loading screen shows skeletons, never another key's rows. (Inherent: the loading screen derives the same shown key as the page; Task 2's check returns to a filtered meetings URL.)
2. A save or the toolbar refresh button while rows are fresh → the hairline still shows (invalidation marks rows stale). Task 2's check presses refresh.
3. A refetch that fails while cached rows show → the rows stay, no error screen. Task 2's check aborts tRPC requests after the 30 s window and returns.
4. Dev-only hydration-drift detector inside a loading screen → stays silent (its reads are not hydration targets). Tasks 2 and 3's checks fail on any `[prefetch drift]` console error.
5. A loading screen with cached rows must not write the URL (page clamp) or start preloads → only the real page does. Covered by code (Task 2 gates both on `isLoadingScreen`); the reviewer checks it deliberately.

---

### Task 1: `useLoadingScreenRead`, client `gcTime`, silent drift check in loading screens

**Files:**
- Create: `src/shared/dal/client/hooks/use-loading-screen-read.ts`
- Modify: `src/trpc/query-client.ts:12` (add `gcTime`)
- Modify: `src/shared/dal/client/hooks/use-hydration-parity-check.ts` (skip in a loading screen)
- Test: `$W/check-loading-screen-read.tsx`, `$W/tsconfig.json`, `$W/check-lib.mjs` (copy)

**Interfaces:**
- Produces: `useLoadingScreenRead<TOptions extends { queryKey: QueryKey }>(options: TOptions): TOptions | null` — returns `options` unchanged outside a loading screen; inside one, `{ ...options, refetchOnMount: false }` when `queryClient.getQueryData(options.queryKey) !== undefined`, else `null`.
- Produces: `useHydrationParityCheck(queryKey)` — unchanged signature; no-op inside a loading screen.

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
  const { DataViewPendingContext } = await import('@/shared/dal/client/lib/data-view-pending-context')
  const { useLoadingScreenRead } = await import('@/shared/dal/client/hooks/use-loading-screen-read')

  const options = { queryKey: ['probe', { input: 1 }] as const, queryFn: () => ({ rows: [], total: 0 }) }

  function run(isLoadingScreen: boolean, cached: boolean) {
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
        <DataViewPendingContext value={isLoadingScreen}>
          <Probe />
        </DataViewPendingContext>
      </QueryClientProvider>,
    )
    return out.read as (typeof options & { refetchOnMount?: boolean }) | null
  }

  const gcTime = makeQueryClient().getDefaultOptions().queries?.gcTime
  check('client gcTime is 30 min', gcTime === 30 * 60 * 1000, String(gcTime))
  check('outside a loading screen the options pass through unchanged', run(false, false) === options)
  check('outside a loading screen, cached or not, nothing changes', run(false, true) === options)
  const cachedRead = run(true, true)
  check('inside a loading screen with cached rows: same key, no mount refetch', cachedRead?.queryKey === options.queryKey && cachedRead?.refetchOnMount === false, JSON.stringify(cachedRead && { refetchOnMount: cachedRead.refetchOnMount }))
  check('inside a loading screen with nothing cached: null', run(true, false) === null)
  process.exit(failed ? 1 : 0)
}

void main()
```

- [ ] **Step 3: Run it to verify it fails**

Run: `env TSX_TSCONFIG_PATH=$W/tsconfig.json pnpm exec tsx $W/check-loading-screen-read.tsx`
Expected: FAIL — an import error for `@/shared/dal/client/hooks/use-loading-screen-read` (tsx may word it as "Cannot find package '@/shared'"; same cause).

- [ ] **Step 4: Create the hook**

`src/shared/dal/client/hooks/use-loading-screen-read.ts`:

```ts
'use client'

import type { QueryKey } from '@tanstack/react-query'

import { useQueryClient } from '@tanstack/react-query'

import { useIsDataViewPending } from '@/shared/dal/client/hooks/use-is-data-view-pending'

/**
 * What a read does inside a route's loading screen (`DataViewPending`). Cached rows show at once, and the screen starts
 * no fetch because the page that replaces it refreshes them. `null` means nothing is cached, so the caller draws its
 * skeleton and reads `EMPTY_DATA_VIEW_READ` (or no queries) to keep its hook order. Outside a loading screen the
 * options pass through unchanged.
 */
export function useLoadingScreenRead<TOptions extends { queryKey: QueryKey }>(options: TOptions): TOptions | null {
  const isLoadingScreen = useIsDataViewPending()
  const qc = useQueryClient()
  if (!isLoadingScreen) {
    return options
  }
  return qc.getQueryData(options.queryKey) === undefined ? null : { ...options, refetchOnMount: false }
}
```

- [ ] **Step 5: Add the client `gcTime`**

In `src/trpc/query-client.ts`, inside `defaultOptions.queries`, directly under `staleTime: 30 * 1000,`:

```ts
        // A tab used earlier this session reopens on its cached rows. The server keeps TanStack's own default: a
        // finite value there would hold each request's cache alive after the response.
        gcTime: isServer ? Infinity : 30 * 60 * 1000,
```

(`isServer` is already imported in that file.)

- [ ] **Step 6: Silence the drift check inside a loading screen**

Replace the body of `src/shared/dal/client/hooks/use-hydration-parity-check.ts` with:

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
  // A loading screen draws before the route's server render arrives, so the recorded keys are the previous page's.
  const isLoadingScreen = useIsDataViewPending()
  useEffect(() => {
    if (!isLoadingScreen) {
      checkHydrationParity(queryKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only
  }, [])
}
```

- [ ] **Step 7: Run the check to verify it passes**

Run: `env TSX_TSCONFIG_PATH=$W/tsconfig.json pnpm exec tsx $W/check-loading-screen-read.tsx`
Expected: five `PASS` lines, exit 0.

- [ ] **Step 8: Type-check and lint**

Run: `pnpm tsc` → Expected: no errors. Run: `pnpm exec eslint src/shared/dal/client/hooks/use-loading-screen-read.ts src/shared/dal/client/hooks/use-hydration-parity-check.ts src/trpc/query-client.ts` → Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add src/shared/dal/client/hooks/use-loading-screen-read.ts src/shared/dal/client/hooks/use-hydration-parity-check.ts src/trpc/query-client.ts
git commit -m "feat(data-view): one rule for reads in a loading screen, and a 30-minute client cache

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/dal/client/hooks/use-loading-screen-read.ts src/shared/dal/client/hooks/use-hydration-parity-check.ts src/trpc/query-client.ts
```

---

### Task 2: Data-view read hooks show cached rows in loading screens; `isFetching` means "refreshing stale rows"

**Files:**
- Modify: `src/shared/dal/client/hooks/use-data-view-query.ts`
- Modify: `src/shared/dal/client/hooks/use-paginated-query.ts`
- Modify: `src/shared/dal/client/lib/types.ts:132-137` and `:212-218` (doc comments)
- Modify: `src/shared/dal/client/lib/data-view-pending-context.ts` (doc comment)
- Modify: `src/shared/components/data-view-pending.tsx` (doc comment)
- Test: `$W/check-return.mjs`

**Interfaces:**
- Consumes: `useLoadingScreenRead` (Task 1).
- Produces: `DataViewQueryResult` / paginated result fields with new meaning — `isPending`: no rows to show yet (a loading screen with nothing cached); `isFetching`: refetching rows that are stale (`read.isFetching && read.isStale`). Names and types unchanged.

- [ ] **Step 1: Write the failing browser check**

`$W/check-return.mjs`:

```js
import { openPage, redact } from './check-lib.mjs'

const ROUTES = {
  meetings: { link: /^meetings$/i, url: '/dashboard/meetings', item: 'tbody tr[data-meeting-row]' },
  pipeline: { link: /pipeline/i, url: '/dashboard/pipeline', item: '.min-w-70 [data-slot="card"]' },
  customers: { link: /^customers$/i, url: '/dashboard/customers', item: 'tbody tr:not([aria-hidden]):not(:has([data-slot="skeleton"]))' },
  schedule: { link: /schedule/i, url: '/dashboard/schedule', item: null },
}

const { browser, page, errors } = await openPage('/dashboard/pipeline/fresh')
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

// Samples every 50 ms for `ms` after the click: frames with a skeleton in main and no items, frames with the hairline.
function sample(item, ms) {
  return page.evaluate(([item, ms]) => new Promise((resolve) => {
    const out = { skeletonNoItems: 0, hairline: 0, minItemsAfterFirst: null }
    const start = performance.now()
    let seen = false
    const tick = () => {
      const skeleton = !!document.querySelector('main [data-slot="skeleton"]')
      const items = item ? [...document.querySelectorAll(item)].filter(el => el.getClientRects().length > 0).length : null
      if (skeleton && (items === null || items === 0)) out.skeletonNoItems++
      if (document.querySelector('.animate-toolbar-shimmer')) out.hairline++
      if (items > 0) seen = true
      if (seen) out.minItemsAfterFirst = Math.min(out.minItemsAfterFirst ?? items, items)
      if (performance.now() - start < ms) setTimeout(tick, 50)
      else resolve(out)
    }
    tick()
  }), [item, ms])
}

async function go(name, ms = 4000) {
  const r = ROUTES[name]
  const sampler = sample(r.item, ms)
  await page.getByRole('link', { name: r.link }).filter({ visible: true }).first().click()
  await page.waitForURL(`**${r.url}**`, { timeout: 120000 })
  return sampler
}

try {
  await page.waitForSelector(ROUTES.pipeline.item, { timeout: 180000 })
  // Warm every route once (first visits, dev compiles), then come back to pipeline.
  for (const name of ['meetings', 'customers', 'schedule', 'pipeline']) {
    await go(name, 6000)
  }
  // 1. Quick returns: rows from the cache, no skeleton, no hairline (the refetch runs silently).
  for (const name of ['meetings', 'pipeline', 'schedule', 'customers']) {
    const r = await go(name)
    verdict(`quick return → ${name}`, r.skeletonNoItems === 0 && r.hairline === 0, JSON.stringify(r))
  }
  // 2. Refresh button: the hairline shows even though the rows are fresh.
  await go('meetings', 3000)
  const refreshSampler = sample(ROUTES.meetings.item, 3000)
  await page.getByRole('button', { name: /refresh/i }).filter({ visible: true }).first().click()
  const refreshed = await refreshSampler
  verdict('refresh button shows the hairline', refreshed.hairline > 0, JSON.stringify(refreshed))
  // 3. Past the 30 s window: rows at once, hairline while the refetch runs.
  await go('pipeline', 3000)
  await page.waitForTimeout(31000)
  const late = await go('meetings', 5000)
  verdict('return after 30 s → meetings', late.skeletonNoItems === 0 && late.hairline > 0, JSON.stringify(late))
  // 4. A failed refetch past the window keeps the rows.
  await go('pipeline', 3000)
  await page.waitForTimeout(31000)
  await page.route('**/api/trpc/**', route => route.abort())
  const failedRefetch = await go('meetings', 6000)
  await page.unroute('**/api/trpc/**')
  verdict('failed refetch keeps the rows', failedRefetch.minItemsAfterFirst > 0, JSON.stringify(failedRefetch))
  // 5. Informational: throttled bytes can expose the loading screen in dev, which production always shows.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 300, downloadThroughput: 40000, uploadThroughput: -1 })
  const throttled = await go('pipeline', 8000)
  console.log(`INFO throttled return → pipeline: ${JSON.stringify(throttled)}`)
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
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
Expected: FAIL on the `quick return →` lines with `hairline` > 0 (the server's streamed copy is adopted as a fetch on every return). The refresh and after-30 s lines may already pass. If the checker cannot find a link or the refresh button, fix the selector (ledger a ruling) before continuing; a selector failure is not RED.

- [ ] **Step 3: Update `useDataViewQuery`**

In `src/shared/dal/client/hooks/use-data-view-query.ts`:

a) Add the import (sorted with the other `@/shared/dal/client/hooks/*` imports):

```ts
import { useLoadingScreenRead } from '@/shared/dal/client/hooks/use-loading-screen-read'
```

b) Replace `const isPending = useIsDataViewPending()` with:

```ts
  const isLoadingScreen = useIsDataViewPending()
```

c) Replace these lines:

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

  useServerPrefetchGuard(shownOptions.queryKey, !isLoadingScreen)
  useEffect(() => {
    if (!isLoadingScreen) {
      checkHydrationParity(shownOptions.queryKey as readonly unknown[])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- first mount only; later keys are client-driven, not hydration targets
  }, [])

  // Suspends until the shown key's rows are in (streamed from the server prefetch on a document load). A loading
  // screen with nothing cached reads a key that already holds an empty page, so the view draws with no rows.
  const read = useSuspenseQuery(loadingScreenRead ?? (EMPTY_DATA_VIEW_READ as unknown as typeof shownOptions))
  const data = read.data as PaginatedResult<DataViewRowOf<TProcedure>>
  const rows = data.rows
  const total = data.total
  // Every return to a route refetches; only a refetch of rows past staleTime (or marked stale by a save or refresh)
  // is worth showing, so a quick return refreshes silently.
  const isFetching = !isPending && read.isFetching && read.isStale
```

d) The page clamp: replace

```ts
    if (!isPending && !isStale && windowState.kind === 'page' && pageCount > 0 && windowState.page > pageCount) {
      void setUrlState({ [keys.pageKey]: pageCount } as never, { history: 'replace' })
    }
  }, [isPending, isStale, windowState, pageCount, keys, setUrlState])
```

with

```ts
    if (!isLoadingScreen && !isStale && windowState.kind === 'page' && pageCount > 0 && windowState.page > pageCount) {
      void setUrlState({ [keys.pageKey]: pageCount } as never, { history: 'replace' })
    }
  }, [isLoadingScreen, isStale, windowState, pageCount, keys, setUrlState])
```

e) The neighbouring-window preload: replace `usePrefetchQueries(adjacentQueries, !isPending && !isFetching)` with

```ts
  // The page that replaces a loading screen warms the neighbours, so the loading screen starts no fetch.
  usePrefetchQueries(adjacentQueries, !isLoadingScreen && !read.isFetching)
```

- [ ] **Step 4: Update `usePaginatedQuery`**

In `src/shared/dal/client/hooks/use-paginated-query.ts`:

a) Add `import { useLoadingScreenRead } from '@/shared/dal/client/hooks/use-loading-screen-read'` (sorted).

b) Replace `const isPending = useIsDataViewPending()` with `const isLoadingScreen = useIsDataViewPending()`.

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
  useServerPrefetchGuard(baseOptions.queryKey, !isPending)
  useEffect(() => {
    if (!isPending) {
      checkHydrationParity(baseQueryKey)
    }
```

with

```ts
  useServerPrefetchGuard(baseOptions.queryKey, !isLoadingScreen)
  useEffect(() => {
    if (!isLoadingScreen) {
      checkHydrationParity(baseQueryKey)
    }
```

e) Replace

```ts
  // Suspends until the shown key's rows are in; inside a DataViewBoundary fallback it reads an empty page instead.
  const read = useSuspenseQuery(isPending ? (EMPTY_DATA_VIEW_READ as unknown as typeof baseOptions) : baseOptions)
  const data = read.data as PaginatedResult<TRow>
  const isFetching = !isPending && read.isFetching
```

with

```ts
  // Suspends until the shown key's rows are in; a loading screen with nothing cached reads an empty page instead.
  const read = useSuspenseQuery(loadingScreenRead ?? (EMPTY_DATA_VIEW_READ as unknown as typeof baseOptions))
  const data = read.data as PaginatedResult<TRow>
  // Every return to a route refetches; only a refetch of rows past staleTime (or marked stale by a save or refresh)
  // is worth showing, so a quick return refreshes silently.
  const isFetching = !isPending && read.isFetching && read.isStale
  const isReadFetching = read.isFetching
```

f) The clamp: replace `if (!isPending && !isStale && pageCount > 0 && page > pageCount) {` with `if (!isLoadingScreen && !isStale && pageCount > 0 && page > pageCount) {` and its deps `[isPending, isStale, page, pageCount, keys.pageKey, setUrlState]` with `[isLoadingScreen, isStale, page, pageCount, keys.pageKey, setUrlState]`.

g) The next-page prefetch: replace `if (!prefetchNextPage || isPending || isStale || isFetching) {` with `if (!prefetchNextPage || isLoadingScreen || isStale || isReadFetching) {` and its deps `[prefetchNextPage, isPending, isStale, isFetching, data.total, shownDerived, shownInput, queryOptionsFactory, qc]` with `[prefetchNextPage, isLoadingScreen, isStale, isReadFetching, data.total, shownDerived, shownInput, queryOptionsFactory, qc]`.

- [ ] **Step 5: Update the doc comments**

In `src/shared/dal/client/lib/types.ts`, both result types (lines ~132-137 and ~212-218), replace the three comments:

```ts
  /** True when there are no rows to show yet: a loading screen with nothing cached, so the view draws its skeleton. */
  isPending: boolean
  /** The rows belong to an older URL state while the requested one loads; tables dim them. */
  isStale: boolean
  /** Refetching rows past staleTime or marked stale (a save, `refresh()`); the rows stay. A fresh refetch is silent. */
  isFetching: boolean
```

In `src/shared/dal/client/lib/data-view-pending-context.ts`, replace the comment with:

```ts
/**
 * True inside a route's loading screen and a `DataViewBoundary`'s fallback. There, reads show cached rows without
 * fetching (`useLoadingScreenRead`) and otherwise draw the view with no rows instead of suspending, so the loading
 * state is the real view and lines up with it by construction.
 */
```

In `src/shared/components/data-view-pending.tsx`, replace `/** Renders a data view as its own loading state: the real view, with no rows. */` with `/** Renders a data view as its own loading state: the real view, with its cached rows or none. */`.

- [ ] **Step 6: Run the check to verify it passes**

Run: `node $W/check-return.mjs 2>&1 | tee $W/task-2-green.txt`
Expected: every line `PASS`, exit 0. Record the `INFO throttled` line in the ledger: if it shows `skeletonNoItems` 0 with the pending view observed, the loading screen itself was exercised in dev; if dev never showed the loading screen, ledger that the loading-screen path is proven by Task 1's check plus the owner's production check.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc` → no errors. Run: `pnpm exec eslint src/shared/dal/client/hooks/use-data-view-query.ts src/shared/dal/client/hooks/use-paginated-query.ts src/shared/dal/client/lib/types.ts src/shared/dal/client/lib/data-view-pending-context.ts src/shared/components/data-view-pending.tsx` → no output.

- [ ] **Step 8: Commit**

```bash
F="src/shared/dal/client/hooks/use-data-view-query.ts src/shared/dal/client/hooks/use-paginated-query.ts src/shared/dal/client/lib/types.ts src/shared/dal/client/lib/data-view-pending-context.ts src/shared/components/data-view-pending.tsx"
git add $F
git commit -m "fix(data-view): a return to a tab shows its cached rows and refreshes them silently until they are stale

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- $F
```

---

### Task 3: Dashboard home — its own loading screen, sections read the cache

**Files:**
- Move: `src/app/(frontend)/dashboard/page.tsx` → `src/app/(frontend)/dashboard/(home)/page.tsx`
- Create: `src/app/(frontend)/dashboard/(home)/loading.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx`, `dashboard-proposal-section-list.tsx`, `dashboard-project-section.tsx`, `dashboard-project-section-list.tsx`, `dashboard-snapshot-strip.tsx`, `dashboard-snapshot-counts.tsx`
- Test: `$W/check-home.mjs`

**Interfaces:**
- Consumes: `useLoadingScreenRead` (Task 1); `EMPTY_DATA_VIEW_READ` from `@/shared/dal/client/constants/empty-data-view-read`; `DashboardHomePendingView`; `DataViewPending`.
- Produces: `/dashboard` served from the `(home)` group with a `loading.tsx` that covers only `/dashboard`.

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

const groupLoading = 'src/app/(frontend)/dashboard/(home)/loading.tsx'
const rootLoading = 'src/app/(frontend)/dashboard/loading.tsx'
verdict('home has its own loading screen inside (home)', existsSync(groupLoading), groupLoading)
verdict('no loading screen covers every dashboard route', !existsSync(rootLoading), rootLoading)

const { browser, page, errors } = await openPage('/dashboard')
const drift = []
page.on('console', (msg) => {
  if (msg.text().includes('[prefetch drift]')) {
    drift.push(redact(msg.text()).slice(0, 160))
  }
})
function sample(ms) {
  return page.evaluate(ms => new Promise((resolve) => {
    const out = { homeOnOtherRoute: 0, skeletonAfterHome: 0, homeSeen: false }
    const start = performance.now()
    const tick = () => {
      const home = !!document.querySelector('main section#proposals')
      if (home && location.pathname !== '/dashboard') out.homeOnOtherRoute++
      if (home) out.homeSeen = true
      if (out.homeSeen && location.pathname === '/dashboard' && document.querySelector('main section#proposals [data-slot="skeleton"]')) out.skeletonAfterHome++
      if (performance.now() - start < ms) setTimeout(tick, 50)
      else resolve(out)
    }
    tick()
  }), ms)
}
try {
  await page.waitForSelector('main section#proposals', { timeout: 180000 })
  await page.waitForTimeout(3000)
  for (const href of ['/dashboard/pipeline', '/dashboard', '/dashboard/analytics', '/dashboard']) {
    const sampler = sample(5000)
    await page.locator(`a[href="${href}"]`).filter({ visible: true }).first().click()
    await page.waitForURL(url => new URL(url).pathname.startsWith(href), { timeout: 120000 })
    const r = await sampler
    if (href === '/dashboard') {
      verdict('return → home shows cached sections, no skeleton', r.homeSeen && r.skeletonAfterHome === 0, JSON.stringify(r))
    }
    else {
      verdict(`→ ${href} never shows the home view`, r.homeOnOtherRoute === 0, JSON.stringify(r))
    }
  }
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

If the dashboard nav has no visible `a[href="/dashboard/pipeline"]` (pipeline links may point at `/dashboard/pipeline/<stage>`), use the visible pipeline link's real `href` and ledger it.

- [ ] **Step 2: Run it to verify it fails**

Run: `node $W/check-home.mjs 2>&1 | tee $W/task-3-red.txt`
Expected: FAIL on `home has its own loading screen inside (home)`.

- [ ] **Step 3: Move the page and add the loading screen**

```bash
mkdir -p 'src/app/(frontend)/dashboard/(home)'
git mv 'src/app/(frontend)/dashboard/page.tsx' 'src/app/(frontend)/dashboard/(home)/page.tsx'
```

`src/app/(frontend)/dashboard/(home)/loading.tsx`:

```tsx
import { DashboardHomePendingView } from '@/features/agent-dashboard/ui/components/dashboard-home-pending-view'
import { DataViewPending } from '@/shared/components/data-view-pending'

// Inside the (home) group: a loading screen next to the dashboard layout would also stand in for every dashboard
// route that has none of its own.
export default function DashboardHomeLoading() {
  return (
    <DataViewPending>
      <DashboardHomePendingView />
    </DataViewPending>
  )
}
```

In `src/features/agent-dashboard/ui/components/dashboard-snapshot-counts.tsx`, the comment's `dashboard/page.tsx` becomes `dashboard/(home)/page.tsx`.

- [ ] **Step 4: The proposal and project sections read through the hook**

`dashboard-proposal-section.tsx` — remove the `useIsDataViewPending` import and the pending branch; the body becomes:

```tsx
export function DashboardProposalSection({ title, input, timeSince, emptyMessage }: DashboardProposalSectionProps) {
  const skeleton = <DashboardListSectionSkeleton title={title} card="proposal" />
  return (
    <HydrationErrorBoundary variant="section">
      <Suspense fallback={skeleton}>
        <DashboardProposalSectionList title={title} input={input} timeSince={timeSince} emptyMessage={emptyMessage} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
```

`dashboard-proposal-section-list.tsx` — add imports `DashboardListSectionSkeleton` (`@/features/agent-dashboard/ui/components/dashboard-list-section-skeleton`), `EMPTY_DATA_VIEW_READ` (`@/shared/dal/client/constants/empty-data-view-read`), `useLoadingScreenRead` (`@/shared/dal/client/hooks/use-loading-screen-read`); replace

```tsx
  useHydrationParityCheck(options.queryKey)
  const { data } = useSuspenseQuery(options)

  return (
```

with

```tsx
  useHydrationParityCheck(options.queryKey)
  const read = useLoadingScreenRead(options)
  const { data } = useSuspenseQuery(read ?? (EMPTY_DATA_VIEW_READ as unknown as typeof options))

  // A loading screen with nothing cached: the skeleton, from the read that never fetches above.
  if (!read) {
    return <DashboardListSectionSkeleton title={title} card="proposal" />
  }

  return (
```

`dashboard-project-section.tsx` — remove the `useIsDataViewPending` import and the pending branch; the body becomes:

```tsx
export function DashboardProjectSection({ title, input, emptyMessage }: DashboardProjectSectionProps) {
  const skeleton = <DashboardListSectionSkeleton title={title} card="project" />
  return (
    <HydrationErrorBoundary variant="section">
      <Suspense fallback={skeleton}>
        <DashboardProjectSectionList title={title} input={input} emptyMessage={emptyMessage} />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
```

`dashboard-project-section-list.tsx` — add the same three imports (`DashboardListSectionSkeleton`, `EMPTY_DATA_VIEW_READ`, `useLoadingScreenRead`); replace

```tsx
  useHydrationParityCheck(options.queryKey)
  const { data } = useSuspenseQuery(options)

  return (
```

with

```tsx
  useHydrationParityCheck(options.queryKey)
  const read = useLoadingScreenRead(options)
  const { data } = useSuspenseQuery(read ?? (EMPTY_DATA_VIEW_READ as unknown as typeof options))

  // A loading screen with nothing cached: the skeleton, from the read that never fetches above.
  if (!read) {
    return <DashboardListSectionSkeleton title={title} card="project" />
  }

  return (
```

Both section files keep their existing doc comments; drop only the `// The layout's loading state draws this page with no reads` line with the branch it described.

- [ ] **Step 5: The snapshot strip reads through the hook**

`dashboard-snapshot-strip.tsx` — remove the `useIsDataViewPending` import and the pending branch; the body becomes:

```tsx
export function DashboardSnapshotStrip() {
  return (
    <HydrationErrorBoundary fallback={<DashboardSnapshotChips />}>
      <Suspense fallback={<DashboardSnapshotChips />}>
        <DashboardSnapshotCounts />
      </Suspense>
    </HydrationErrorBoundary>
  )
}
```

`dashboard-snapshot-counts.tsx` — add `useLoadingScreenRead`; replace from `// Plural, so the three reads suspend together instead of one after another.` to the end of the component with:

```tsx
  const reads = [
    useLoadingScreenRead(meetingsTodayOptions),
    useLoadingScreenRead(awaitingSignatureOptions),
    useLoadingScreenRead(activeProjectsOptions),
  ]
  const cachedReads = reads.filter(read => read !== null)
  const isMissingCount = cachedReads.length < reads.length

  // Plural, so the three reads suspend together instead of one after another. A loading screen missing any count
  // reads none of them (it starts no fetch) and shows the bare chips.
  const totals = useSuspenseQueries({
    queries: isMissingCount ? [] : cachedReads,
    combine: results => results.map(result => result.data.total),
  })

  if (isMissingCount) {
    return <DashboardSnapshotChips />
  }
  const [meetingsToday, awaitingSignature, activeProjects] = totals
  return (
    <DashboardSnapshotChips
      counts={{ meetingsToday, awaitingSignature, activeProjects }}
    />
  )
}
```

If `pnpm tsc` rejects the union in `queries` or `result.data.total`, narrow with the smallest explicit type that compiles (for example `combine: results => results.map(result => (result.data as { total: number }).total)`) and ledger the ruling.

- [ ] **Step 6: Run the check to verify it passes**

Run: `node $W/check-home.mjs 2>&1 | tee $W/task-3-green.txt`
Expected: every line `PASS`, exit 0.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc` → no errors (a stale `.next/types` entry for the old `dashboard/page.tsx` path is cleared by the dev server's next compile; if `tsc` names it, reload `/dashboard` once and re-run). Run: `pnpm exec eslint 'src/app/(frontend)/dashboard/(home)' src/features/agent-dashboard/ui/components/dashboard-proposal-section.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-section-list.tsx src/features/agent-dashboard/ui/components/dashboard-project-section.tsx src/features/agent-dashboard/ui/components/dashboard-project-section-list.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-counts.tsx` → no output.

- [ ] **Step 8: Commit**

```bash
D=src/features/agent-dashboard/ui/components
F="src/app/(frontend)/dashboard/page.tsx src/app/(frontend)/dashboard/(home)/page.tsx src/app/(frontend)/dashboard/(home)/loading.tsx $D/dashboard-proposal-section.tsx $D/dashboard-proposal-section-list.tsx $D/dashboard-project-section.tsx $D/dashboard-project-section-list.tsx $D/dashboard-snapshot-strip.tsx $D/dashboard-snapshot-counts.tsx"
git add 'src/app/(frontend)/dashboard/(home)/loading.tsx'
git commit -m "feat(dashboard): home has its own loading screen, drawn from the cache

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- 'src/app/(frontend)/dashboard/page.tsx' 'src/app/(frontend)/dashboard/(home)/page.tsx' 'src/app/(frontend)/dashboard/(home)/loading.tsx' $D/dashboard-proposal-section.tsx $D/dashboard-proposal-section-list.tsx $D/dashboard-project-section.tsx $D/dashboard-project-section-list.tsx $D/dashboard-snapshot-strip.tsx $D/dashboard-snapshot-counts.tsx
```

---

### Task 4: Schedule week view opens on today's column without a scroll

**Files:**
- Modify: `src/features/schedule-management/ui/components/schedule-week-view.tsx:6` (import) and `:44-71` (the effect)
- Test: `$W/check-week-entry.mjs`

**Interfaces:**
- Consumes: none. Produces: none.

- [ ] **Step 1: Write the failing check**

`$W/check-week-entry.mjs`:

```js
import { openPage, redact } from './check-lib.mjs'

let failed = false
const { browser, page, errors } = await openPage('/dashboard/pipeline/fresh', '', { viewport: { width: 390, height: 860 } })
try {
  await page.waitForSelector('.min-w-70 [data-slot="card"]', { timeout: 180000 })
  await page.waitForTimeout(2500)
  for (const round of [1, 2]) {
    const sampler = page.evaluate(() => new Promise((resolve) => {
      const values = []
      const start = performance.now()
      const tick = () => {
        const scroller = document.querySelector('main .h-full.overflow-x-auto')
        if (scroller) values.push(Math.round(scroller.scrollLeft))
        if (performance.now() - start < 4000) requestAnimationFrame(tick)
        else resolve(values)
      }
      requestAnimationFrame(tick)
    }))
    await page.getByRole('link', { name: /schedule/i }).filter({ visible: true }).first().click()
    await page.waitForURL('**/dashboard/schedule**', { timeout: 120000 })
    const values = await sampler
    // The scroller is replaced once (loading screen → page); each instance must paint at its final position.
    const distinct = [...new Set(values)]
    const ok = values.length > 0 && distinct.length === 1
    console.log(`${ok ? 'PASS' : 'FAIL'} round ${round}: scrollLeft never moves on entry — distinct values ${JSON.stringify(distinct.slice(0, 12))}`)
    failed ||= !ok
    await page.getByRole('link', { name: /pipeline/i }).filter({ visible: true }).first().click()
    await page.waitForURL('**/dashboard/pipeline**', { timeout: 120000 })
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

- [ ] **Step 2: Run it to verify it fails**

Run: `node $W/check-week-entry.mjs 2>&1 | tee $W/task-4-red.txt`
Expected: FAIL — several distinct `scrollLeft` values per round (the smooth scroll from 0 to today's column). If today is Sunday the column may already be at 0 and the check passes vacuously; ledger the date and re-run on a weekday before claiming GREEN.

- [ ] **Step 3: Position before paint, animate only week changes**

In `schedule-week-view.tsx`, change the React import to `import { useLayoutEffect, useMemo, useRef } from 'react'`, and replace the comment block and effect (from `// Snap the horizontal viewport on week navigation for continuity:` through the effect's closing `}, [currentDate])`) with:

```tsx
  // Snap the horizontal viewport on week navigation for continuity:
  // - Today landing in the week wins (covers initial mount + "Today" button)
  // - Forward (next week)  → align Sunday at the start of the viewport
  // - Backward (prev week) → align Friday at the end of the viewport
  // A mount places the viewport before the first paint instead of scrolling there: the route's loading screen and the
  // page each mount this view, and a visible slide on every entry reads as the page jumping.
  useLayoutEffect(() => {
    const prev = prevDateRef.current
    prevDateRef.current = currentDate

    if (todayColRef.current) {
      todayColRef.current.scrollIntoView({ behavior: prev ? 'smooth' : 'instant', block: 'nearest', inline: 'nearest' })
      return
    }

    if (!prev) {
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

- [ ] **Step 4: Run the check to verify it passes**

Run: `node $W/check-week-entry.mjs 2>&1 | tee $W/task-4-green.txt`
Expected: both rounds `PASS` (one distinct value each), no page errors, exit 0.

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

- Re-run all four checks together on the final tree (`check-loading-screen-read.tsx`, `check-return.mjs`, `check-home.mjs`, `check-week-entry.mjs`) and `pnpm tsc && pnpm lint`.
- Owner checks on production after the owner ships (dev cannot prefetch loading screens): click between pipeline, schedule, meetings, customers, proposals, projects and home — every return shows rows at once (no skeleton flash); a return after half a minute shows the hairline briefly; the schedule on a phone opens on today's column without sliding.
- Update `docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md`'s status line only if it cites this work; delete this plan and its spec once shipped (the deferred `2026-10-09` spec stays).
