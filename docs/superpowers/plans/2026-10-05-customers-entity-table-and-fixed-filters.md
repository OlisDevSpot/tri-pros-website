# Fixed Filters and the Dashboard Reads Implementation Plan (R2, part 1 of 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A data view can pin filter values itself (in its config, or at the callsite for a value only the callsite knows) and can ask for the first N rows of its order; the agent dashboard's meetings and project reads move onto that, with every card unchanged.

**Architecture:** `DataViewQueryConfig` gains `fixed`; `useDataViewQuery`, `loadDataViewQueryInput` and the new pure `staticDataViewInput` take the same optional runtime `fixed`. One merge in `toDataViewInput` builds the filters (URL values, config pins, runtime pins, then a date window's own field), and one helper drops pinned ids from the toolbar, so a pin never has a URL key, a control or a chip. A `{ kind: 'first', count }` window sends `limit: count, offset: 0` and pages nothing. The server is untouched: every filter id already has an input schema and a SQL condition.

**Tech Stack:** Next.js 15 App Router, tRPC v11, TanStack Query v5, nuqs, Zod 4, TypeScript 5.9, pnpm, `tsx`, Playwright (read-only checks).

**Spec:** `docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md` §2–§4, §6, §8, §11 (approved by the owner 2026-10-05), under the records tracker `docs/plans/2026-09-26-records-management-epic.md` **D29, D45, D60, D62** and open item **O9**. Part 2 (`docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters-part-2.md`) builds the customers entity table on this; it needs Tasks 1 and 2 here. This part ships on its own.

## Owner confirms

Each is isolated so a different answer is a small change. Spec §5.5 (the two customer row actions) is in part 2.

1. **`dataViewToolbar(config, fixed?)`** is the name of the one helper that returns a data view's toolbar ids without its pinned ids (Task 1). The spec describes the behaviour (§3.2.4) and leaves the function unnamed; the name follows its neighbours `dataViewUrlKeys` and `makeDataViewParsers`.
2. **Dashboard config names** (Task 3), after the existing `DASHBOARD_MEETINGS_QUERY`: `DASHBOARD_MEETINGS_WINDOW_QUERIES` (a record keyed by `today | upcoming | past`), `DASHBOARD_ACTIVE_PROJECTS_QUERY`, `DASHBOARD_ON_HOLD_PROJECTS_QUERY`. `meetingsWindowInput(kind)` stays, as the one place the day's pin is built for both the page and the snapshot strip; `activeProjectsInput` and `onHoldProjectsInput` go (callers call `staticDataViewInput(CONFIG)`).
3. **Their `paramPrefix` values** (`dmt`, `dmu`, `dmp`, `dpa`, `dph`) are never read: a static data view has no URL state, but the config type requires a prefix. They are distinct in case one is later mounted with the hook.
4. **An empty pin throws in development** (`fixed: { leadSource: [] }`), beside the spec's throw for pinning a date window's field. Not in the spec. Without it the server reads an empty list as "no filter" and returns every row. Remove the second `if` in `assertPinsApply` (Task 1 Step 5) and its test to drop it.

## Global Constraints

- Verification per task: `pnpm tsc` and `pnpm lint`. **Never `pnpm build`.**
- **No database writes for testing** (dev included). Browser checks read and open UI only; never submit a form.
- **No schema change.** If a step seems to need one, stop and report it.
- No unit runner in the repo: pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/` (git-ignored), run from the repo root with `pnpm exec tsx --test <file>` so the `@/` alias resolves. A file that imports a `server-only` module runs with `NODE_OPTIONS=--conditions=react-server`. Never commit them.
- Work on `main`; other sessions commit concurrently and the index can hold their staged work. Add only new files with `git add -- <path>`, then **commit with an explicit pathspec** (`git commit -m "…" -- <paths>`, as every commit block below does) so nothing already staged rides along; confirm with `git show --stat HEAD`. Never `git add -A`, `git stash`, `checkout`, `reset`, `restore`, `clean` or `commit --amend`. Before editing any file this plan modifies, run `git status --short <file>`: if it shows changes you didn't make, stop and ask. Message shape `type(scope): subject`, ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **The meetings setter plan** (`docs/superpowers/plans/2026-10-05-meetings-setter.md`) is built on this tree. It rewrote the imports and `getInternalUsers` of `src/trpc/routers/meetings.router/reads.router.ts` and added to `MEETING_FIELDS`, `OPTION_SOURCES` and the meetings table view. Steps below name symbols, not line numbers; never undo its additions.
- Edits are given as exact "replace this with that" pairs. If the text to replace is not in the file as written, stop and re-read the file: another session changed it. Do not guess.
- Never start, stop or restart a dev server; never touch `.next`. Run `ss -ltnp | grep :3000` and reuse the running one.
- Browser checks: the local Playwright script from Task 1 Step 1 (memory `reference-playwright-auth.md`, `/api/dev/playwright-session`, roles via `&role=super-admin|agent`), desktop and 390px wide, light and dark; screenshots and reports land under `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/` and are listed in the task report. Never print `.env.local`, `DEV_LOGIN_SECRET` or a URL containing `secret=`. The script is a tool: if one of its selectors misses, fix the script, never the app, and say so in the report.
- A fixed filter narrows what a view asks for; **it is not access control** (spec §2). Never rely on a pin to hide rows from a viewer.
- Everything that shapes a query key is a static constant the page's prefetch and the client both import. A runtime pin goes to the loader and to the hook with the same value.
- Non-defensive migrations: a step that moves a consumer deletes the old path in the same task. No shims, no re-exports.
- Names: use the spec's (`fixed`, `first`, `count`, `staticDataViewInput`). Do not coin others; the unavoidable ones are under "Owner confirms".
- Code conventions (memory `coding-conventions.md`): named exports, constants in `constants/`, pure helpers in `lib/`. Comments say why, never what; no plan, spec or tracker citations in code.

## Review Focus

1. **Every existing data view still asks for exactly what it asked before.** The hook and the derivation every table, calendar and kanban uses change in Tasks 1 and 2; the customers, meetings and projects tables, the schedule, the pipeline board and the lead-sources tables must send the same inputs and show the same rows. Pinned by Task 2 Step 7 (before/after capture of each list request's input and row ids).
2. **An old bookmark carrying a key for a pinned id changes nothing.** `/dashboard?dm_outcome=cancelled` still shows live meetings only, with no error. Pinned by Task 1 Step 2 (two tests), Task 2 Step 1 (loader test) and Task 3 Step 7 (browser).
3. **An empty pin never returns every row silently.** `fixed: { source: [] }` throws in development, as a pin on a date window's field does. Pinned by Task 1 Step 2 (test).
4. **A static data view built from a config that lists toolbar ids does not crash.** `staticDataViewInput` runs with an empty URL state, where a multi-select or a date range has no default to read. Pinned by Task 1 Step 2 (test).
5. **The dashboard shows the same cards and counts to an agent, at 390px and in the dark scheme, with no prefetch-drift error.** The snapshot strip's counts read the same keys as the sections below it, so they must not send a request of their own. Pinned by Task 3 Step 1 (key-parity test) and Task 3 Step 7 (browser, both roles).

## File map

| Task | Files |
|---|---|
| 1 Pins, the first-rows window and the static input | `src/shared/dal/lib/query/{data-view-query-config,derive-data-view-input,adjacent-windows}.ts` · `src/shared/dal/client/lib/types.ts` · `src/shared/dal/client/hooks/use-data-view-query.ts` (one `switch` case) |
| 2 Pins at the callsite | `src/shared/dal/client/hooks/use-data-view-query.ts` · `src/shared/dal/server/lib/query/load-data-view-query-input.ts` |
| 3 Dashboard reads | `src/features/agent-dashboard/constants/dashboard-queries.ts` · `src/features/agent-dashboard/ui/components/{dashboard-meetings-hub,dashboard-snapshot-counts,dashboard-projects,dashboard-project-section,dashboard-project-section-list}.tsx` · `src/app/(frontend)/dashboard/page.tsx` · `src/trpc/routers/meetings.router/reads.router.ts` · `src/shared/modules/projects/core/DOCS.md` · tracker and spec status lines |

None of these files carried another session's uncommitted edits on 2026-10-05, except `reads.router.ts` (the setter plan's, since committed or about to be). Check each with `git status --short` anyway.

---

### Task 1: Pins, the first-rows window and `staticDataViewInput` in the derivation

**Files:**
- Modify: `src/shared/dal/lib/query/data-view-query-config.ts`
- Modify: `src/shared/dal/lib/query/derive-data-view-input.ts`
- Modify: `src/shared/dal/lib/query/adjacent-windows.ts`
- Modify: `src/shared/dal/client/lib/types.ts` (`DataViewWindowControls`)
- Modify: `src/shared/dal/client/hooks/use-data-view-query.ts` (only the `windowControls` switch, so `pnpm tsc` stays clean; the hook's `fixed` argument is Task 2)
- Tool (throwaway): `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts`
- Test (throwaway): `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/data-view-fixed.test.ts`

**Interfaces:**
- Produces:
  - `DataViewQueryConfig<F, T, W>.fixed?: FilterValues<F>`
  - `DataViewWindow<F>` and `DataViewWindowState` gain `{ kind: 'first', count: number }` (the state also carries `pagination: { limit: count, offset: 0 }`); `DataViewWindowControls` gains `{ kind: 'first', count: number }`
  - `dataViewToolbar<F, T>(config: DataViewQueryConfig<F, T>, fixed?: FilterValues<F>): readonly T[]`
  - `makeDataViewParsers(config, fixed?)`, `deriveFilterSortState(urlState, config, fixed?)`, `toDataViewInput(filterSort, windowState, config, fixed?)`, `deriveDataViewInput(urlState, config, fixed?)`: the same functions with one more optional `FilterValues<F>` argument at the end
  - `staticDataViewInput<F>(config: DataViewQueryConfig<F>, fixed?: FilterValues<F>): DataViewInput<F>`
  - Development-only throws from `toDataViewInput`: a pin on a date window's field; an empty pin

- [ ] **Step 1: Baseline, before any edit**

Create `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts` (type-checked when this plan was written, not yet run against the app):

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'

import { chromium } from 'playwright'

// Usage: pnpm exec tsx <this file> <label> <role> <path> [<path>…]
// Reads only: signs in, opens each path at two widths in both schemes, presses each table's Refresh, and writes
// screenshots plus one JSON report. It never submits a form.
//   TABLE_PREFS='{"<tableId>":{…}}'  loads with saved table layouts, in the cookie format DataTable writes
//   THEN_CLICK='<selector>'          clicks one element after the page settles (e.g. another lead source)
const DIR = '.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters'
const BASE = process.env.BASE ?? 'http://localhost:3000'
const [label, role, ...paths] = process.argv.slice(2)
const secret = readFileSync('.env.local', 'utf8').match(/^DEV_LOGIN_SECRET=(.*)$/m)![1].replace(/"/g, '').trim()
const tablePrefs: Record<string, unknown> = JSON.parse(process.env.TABLE_PREFS ?? '{}')
const VIEWPORTS = { desktop: { width: 1440, height: 900 }, phone: { width: 390, height: 844 } } as const
const LIST_READS = ['customersRouter.business.list', 'leadSourcesRouter.getCustomers', 'meetingsRouter.reads.list', 'projectsRouter.crud.list', 'scheduleRouter.activities.list', 'customerPipelinesRouter.getCustomerPipelineItems']

interface ListRead { procedure: string, input: unknown, ids: string[], total: number }

const slug = (path: string) => path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'root'
const readKey = (read: ListRead) => JSON.stringify([read.procedure, read.input])
const textOf = (els: Element[]) => els.map(el => (el as HTMLElement).innerText.replace(/\s+/g, ' ').trim())

mkdirSync(DIR, { recursive: true })
const browser = await chromium.launch()
const report: Record<string, unknown> = {}

try {
  for (const path of paths) {
    for (const [width, viewport] of Object.entries(VIEWPORTS)) {
      for (const colorScheme of ['light', 'dark'] as const) {
        const ctx = await browser.newContext({ viewport, colorScheme, isMobile: width === 'phone', hasTouch: width === 'phone' })
        await ctx.addCookies(Object.entries(tablePrefs).map(([tableId, prefs]) => ({
          name: `dt.${tableId}`,
          value: encodeURIComponent(JSON.stringify(prefs)),
          domain: new URL(BASE).hostname,
          path: '/dashboard',
        })))
        const page = await ctx.newPage()
        const errors: string[] = []
        const reads: ListRead[] = []
        page.on('pageerror', error => errors.push(error.message.slice(0, 400)))
        page.on('console', (message) => {
          if (message.type() === 'error') {
            errors.push(message.text().slice(0, 400))
          }
        })
        // A batched GET names its procedures in the path and carries their inputs, by position, in `input`.
        page.on('response', async (response) => {
          const url = new URL(response.url())
          if (!url.pathname.startsWith('/api/trpc/')) {
            return
          }
          const procedures = url.pathname.slice('/api/trpc/'.length).split(',')
          const inputs = JSON.parse(url.searchParams.get('input') ?? '{}')
          const body = await response.json().catch(() => null)
          procedures.forEach((procedure, i) => {
            const data = body?.[i]?.result?.data?.json
            if (LIST_READS.includes(procedure) && Array.isArray(data?.rows)) {
              reads.push({ procedure, input: inputs[i]?.json, ids: data.rows.map((row: { id: string }) => row.id), total: data.total })
            }
          })
        })

        await page.goto(`${BASE}/api/dev/playwright-session?secret=${secret}&role=${role}&redirect=/api/auth/get-session`, { waitUntil: 'load', timeout: 120_000 })
        await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 120_000 })
        await page.waitForFunction(() => document.querySelectorAll('[data-slot=data-view-pending]').length === 0, undefined, { timeout: 60_000 })
        await page.waitForTimeout(1500)
        if (process.env.THEN_CLICK) {
          // A target one width doesn't show (the phone layout hides the source list behind a pane) is recorded, not fatal.
          await page.locator(process.env.THEN_CLICK).first().click({ timeout: 5000 }).catch(() => errors.push('THEN_CLICK: target not found at this width'))
          await page.waitForTimeout(2500)
        }
        await page.screenshot({ path: `${DIR}/${label}-${role}-${slug(path)}-${width}-${colorScheme}.png` })

        // A document load streams its rows inside the HTML. Refresh makes the table ask over HTTP, where its ids can be read.
        for (const refresh of await page.locator('main button[aria-label="Refresh"]').all()) {
          if (await refresh.isVisible()) {
            await refresh.click()
            await page.waitForTimeout(2000)
          }
        }

        report[`${path} ${width} ${colorScheme}`] = {
          url: page.url(),
          columns: await page.locator('main thead th').evaluateAll(textOf),
          rows: await page.locator('main tbody tr:not([aria-hidden]):not([data-expanded-row])').evaluateAll(textOf),
          chips: await page.locator('main a[href^="#"]').evaluateAll(textOf),
          sections: await page.locator('#meetings, #proposals, #projects').evaluateAll(textOf),
          // One entry per distinct request, sorted, so two runs diff cleanly; `readCount` keeps how many responses arrived.
          reads: [...new Map(reads.map(read => [readKey(read), read])).values()].sort((a, b) => readKey(a).localeCompare(readKey(b))),
          readCount: reads.length,
          errors,
        }
        await ctx.close()
      }
    }
  }
}
finally {
  await browser.close()
}

writeFileSync(`${DIR}/${label}-${role}.json`, `${JSON.stringify(report, null, 2)}\n`)
console.log(`wrote ${DIR}/${label}-${role}.json`)
```

Confirm a dev server is up (`ss -ltnp | grep :3000`; if none, stop and ask the owner), then run:

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts baseline super-admin /dashboard /dashboard/customers /dashboard/meetings /dashboard/projects /dashboard/lead-sources /dashboard/schedule /dashboard/pipeline/fresh
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts baseline agent /dashboard /dashboard/customers /dashboard/meetings /dashboard/projects /dashboard/schedule /dashboard/pipeline/fresh
```

Expected: `baseline-super-admin.json`, `baseline-agent.json` and four screenshots per path and role. Open two screenshots to confirm the pages rendered signed in. In each report, `rows` holds the table's rows as text; `reads` holds each distinct list request the page made over HTTP (its input, row ids and total; Refresh makes a table ask, and the next page's prefetch shows as a second entry with `pagination.offset` 20); `readCount` is how many list responses arrived; and `/dashboard`'s `sections` and `chips` hold the three modules' and the snapshot strip's text. The dashboard's rows arrive inside the HTML, so its `reads` holds at most the calendar's neighbouring months (prefetched over HTTP once the page settles): its lists are compared by text, and Task 3's test proves their keys are unchanged. Note any `errors` already present; they are the baseline, not this plan's.

- [ ] **Step 2: Write the failing test**

Create `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/data-view-fixed.test.ts`:

```ts
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import assert from 'node:assert/strict'
import { test } from 'node:test'

import z from 'zod'

import { adjacentDataViewWindows } from '@/shared/dal/lib/query/adjacent-windows'
import { dataViewToolbar, deriveDataViewInput, deriveDataViewWindow, deriveFilterSortState, makeDataViewParsers, staticDataViewInput, toDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { dateRange, defineFieldList, fixedOnly, multiSelect } from '@/shared/dal/lib/query/field-list'

const FIELDS = defineFieldList({
  status: { label: 'Status', filter: multiSelect({ values: ['open', 'held', 'done'] }), sort: true },
  source: { label: 'Source', filter: multiSelect({ schema: z.string().min(1), source: 'leadSources' }) },
  when: { label: 'When', filter: dateRange(), sort: true },
  internalOnly: { filter: fixedOnly(z.boolean()) },
})

type Config = DataViewQueryConfig<typeof FIELDS>

const PAGE: Config = {
  fields: FIELDS,
  paramPrefix: 't',
  toolbar: ['status', 'source', 'when'],
  defaultSort: { sortBy: 'when', sortDir: 'desc' },
  window: { kind: 'page', pageSize: 20, pageSizeOptions: [10, 20] },
}
const PAGE_PINNED: Config = { ...PAGE, fixed: { status: ['open'], internalOnly: true } }
const DATE: Config = { ...PAGE, window: { kind: 'date', field: 'when', cap: 500, views: ['month'] } }
const FIRST: Config = { ...PAGE, toolbar: [], fixed: { status: ['open'] }, window: { kind: 'first', count: 5 } }

const RANGE = { from: '2026-10-01T07:00:00.000Z', to: '2026-10-02T06:59:59.999Z' }

test('a pinned id leaves the toolbar, whether the config or the callsite pins it', () => {
  assert.deepEqual(dataViewToolbar(PAGE), ['status', 'source', 'when'])
  assert.deepEqual(dataViewToolbar(PAGE_PINNED), ['source', 'when'])
  assert.deepEqual(dataViewToolbar(PAGE, { source: ['s1'] }), ['status', 'when'])
  assert.deepEqual(dataViewToolbar(PAGE_PINNED, { source: ['s1'] }), ['when'])
})

test('an undefined runtime value pins nothing and leaves the config pin in place', () => {
  assert.deepEqual(dataViewToolbar(PAGE, { source: undefined }), ['status', 'source', 'when'])
  assert.deepEqual(staticDataViewInput(FIRST, { status: undefined }).filters, { status: ['open'] })
})

test('a pinned id gets no URL parser; the other keys stay', () => {
  const keys = Object.keys(makeDataViewParsers(PAGE_PINNED, { source: ['s1'] }))
  assert.ok(!keys.includes('t_status'))
  assert.ok(!keys.includes('t_source'))
  assert.ok(keys.includes('t_when'))
  assert.ok(keys.includes('t_q') && keys.includes('t_sort') && keys.includes('t_p'))
})

test('a URL value for a pinned id (an old bookmark) is not a toolbar filter, so it draws no chip', () => {
  const urlState = { t_status: ['done'], t_source: ['s9'], t_when: {} }
  assert.deepEqual(deriveFilterSortState(urlState, PAGE_PINNED).filters, { source: ['s9'] })
  assert.deepEqual(deriveFilterSortState(urlState, PAGE_PINNED, { source: ['s1'] }).filters, {})
})

test('the runtime pin beats the config pin, which beats the URL value', () => {
  const fromUrl = deriveFilterSortState({ t_status: ['done'], t_source: ['s9'], t_when: {} }, PAGE)
  const windowState = deriveDataViewWindow({}, PAGE)
  assert.deepEqual(toDataViewInput(fromUrl, windowState, PAGE).filters, { status: ['done'], source: ['s9'] })
  assert.deepEqual(toDataViewInput(fromUrl, windowState, PAGE_PINNED).filters, { status: ['open'], source: ['s9'], internalOnly: true })
  assert.deepEqual(
    toDataViewInput(fromUrl, windowState, PAGE_PINNED, { status: ['held'], source: ['s1'] }).filters,
    { status: ['held'], source: ['s1'], internalOnly: true },
  )
})

test('through the whole derivation a bookmarked key for a pinned id changes nothing', () => {
  const withKey = deriveDataViewInput({ t_status: ['done'], t_source: [], t_when: {} }, PAGE_PINNED)
  const without = deriveDataViewInput({ t_source: [], t_when: {} }, PAGE_PINNED)
  assert.deepEqual(withKey, without)
  assert.deepEqual(withKey.filters, { status: ['open'], internalOnly: true })
})

test('a date window still owns its field, set after the pins', () => {
  const input = deriveDataViewInput({}, DATE, { status: ['open'] })
  assert.deepEqual(Object.keys(input.filters ?? {}).sort(), ['status', 'when'])
})

test('pinning the date window\'s field throws in development', () => {
  assert.throws(() => deriveDataViewInput({}, DATE, { when: RANGE }), /date window owns that filter/)
  assert.throws(() => deriveDataViewInput({}, { ...DATE, fixed: { when: RANGE } }), /date window owns that filter/)
})

test('an empty pin throws in development instead of returning every row', () => {
  assert.throws(() => staticDataViewInput(FIRST, { source: [] }), /pin on 'source' is empty/)
  assert.throws(() => staticDataViewInput(FIRST, { when: {} }), /pin on 'when' is empty/)
  assert.doesNotThrow(() => staticDataViewInput(FIRST, { internalOnly: false }))
})

test('production skips both checks', () => {
  // Next's types mark NODE_ENV read-only; the test only needs to flip it for two calls.
  const env = process.env as Record<string, string | undefined>
  const before = env.NODE_ENV
  env.NODE_ENV = 'production'
  try {
    assert.doesNotThrow(() => deriveDataViewInput({}, DATE, { when: RANGE }))
    assert.doesNotThrow(() => staticDataViewInput(FIRST, { source: [] }))
  }
  finally {
    env.NODE_ENV = before
  }
})

test('a first window asks for its first rows and has nothing to page', () => {
  assert.deepEqual(deriveDataViewWindow({}, FIRST), { kind: 'first', count: 5, pagination: { limit: 5, offset: 0 } })
  assert.deepEqual(adjacentDataViewWindows({}, FIRST), [])
  const keys = Object.keys(makeDataViewParsers(FIRST))
  assert.ok(!keys.includes('t_p') && !keys.includes('t_ps'))
})

test('a static data view input is its config\'s default sort, pins and window', () => {
  assert.deepEqual(staticDataViewInput(FIRST), {
    pagination: { limit: 5, offset: 0 },
    sort: { sortBy: 'when', sortDir: 'desc' },
    search: undefined,
    filters: { status: ['open'] },
  })
  assert.deepEqual(staticDataViewInput(FIRST, { when: RANGE }).filters, { status: ['open'], when: RANGE })
})

test('a static data view input ignores toolbar ids instead of failing on an empty URL state', () => {
  assert.deepEqual(staticDataViewInput(PAGE).filters, undefined)
  assert.deepEqual(staticDataViewInput(PAGE).pagination, { limit: 20, offset: 0 })
})
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/data-view-fixed.test.ts`
Expected: FAIL with `SyntaxError: The requested module '@/shared/dal/lib/query/derive-data-view-input' does not provide an export named 'dataViewToolbar'`.

- [ ] **Step 4: The config types**

In `src/shared/dal/lib/query/data-view-query-config.ts`, replace the `DataViewWindow` type and its doc comment with:

```ts
/** What limits the rows a data view gets: a table page, a calendar's date window, the first rows of its order, or the whole list (kanban). */
export type DataViewWindow<F extends FieldList>
  = | { kind: 'page', pageSize: number, pageSizeOptions: readonly number[] }
    // `views`: the calendar views this data view allows; the first is its default.
    | { kind: 'date', field: DateRangeFilterId<F>, cap: number, views: readonly [CalendarViewType, ...CalendarViewType[]] }
    // Nothing pages: the read's `total` still counts every matching row, so a callsite can say "5 of 23".
    | { kind: 'first', count: number }
    | { kind: 'whole-list' }
```

In `DataViewQueryConfig`, between `defaultSort?: SortState<F>` and `window: W`, add:

```ts
  /** Filter values this data view always applies. Never read from the URL, never shown in the toolbar. */
  fixed?: FilterValues<F>
```

(`FilterValues` is already in the file's type import.) In `DataViewWindowState`, between the `date` member and `| { kind: 'whole-list' }`, add:

```ts
    | { kind: 'first', count: number, pagination: { limit: number, offset: number } }
```

- [ ] **Step 5: The derivation**

All in `src/shared/dal/lib/query/derive-data-view-input.ts`.

(a) Add `ToolbarFilterId` to the `field-list` type import:

```ts
import type { FieldList, FilterValues, SortDir, SortId, ToolbarFilterId, ToolbarFilterSpec, ToolbarFilterValues } from '@/shared/dal/lib/query/field-list'
```

(b) Directly above the doc comment of `makeDataViewParsers`, add:

```ts
/** A data view's pins by filter id: the config's, then the callsite's over them. An `undefined` value pins nothing. */
function pinnedFilters<F extends FieldList>(config: DataViewQueryConfig<F>, fixed: FilterValues<F> | undefined): Record<string, unknown> {
  const pins: Record<string, unknown> = {}
  for (const source of [config.fixed, fixed]) {
    for (const [id, value] of Object.entries(source ?? {})) {
      if (value !== undefined) {
        pins[id] = value
      }
    }
  }
  return pins
}

/** The toolbar ids a data view parses and shows: the config's list without the pinned ids, so one list serves a records page and a pinned embed. */
export function dataViewToolbar<F extends FieldList, T extends ToolbarFilterId<F>>(config: DataViewQueryConfig<F, T>, fixed?: FilterValues<F>): readonly T[] {
  const pins = pinnedFilters(config, fixed)
  return config.toolbar.filter(id => !(id in pins))
}
```

(c) `makeDataViewParsers`: change the signature line to

```ts
export function makeDataViewParsers<F extends FieldList>(config: DataViewQueryConfig<F>, fixed?: FilterValues<F>): Record<string, unknown> {
```

and, inside it, the loop header `for (const id of config.toolbar) {` to

```ts
  for (const id of dataViewToolbar(config, fixed)) {
```

(d) `deriveFilterSortState`: change the signature line to

```ts
export function deriveFilterSortState<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>, fixed?: FilterValues<F>): FilterSortState<F> {
```

and replace, inside its loop,

```ts
  for (const id of config.toolbar) {
    const filter = fields[id].filter as ToolbarFilterSpec
    const { normalize } = filterParserRegistry[filter.kind] as { normalize: (raw: unknown) => unknown }
    const value = normalize(urlState[keys.filterKey(id)])
```

with

```ts
  for (const id of dataViewToolbar(config, fixed)) {
    const filter = fields[id].filter as ToolbarFilterSpec
    const { normalize } = filterParserRegistry[filter.kind] as { normalize: (raw: unknown) => unknown }
    const raw = urlState[keys.filterKey(id)]
    // A state built without the parsers (a static data view's empty one) carries no defaults to normalize.
    const value = raw === undefined || raw === null ? undefined : normalize(raw)
```

Leave the rest of the function (search, sort, the schema check) as it is.

(e) `deriveDataViewWindow`: above `case 'whole-list':`, add:

```ts
    case 'first':
      return { kind: 'first', count: configWindow.count, pagination: { limit: configWindow.count, offset: 0 } }
```

(f) Replace the first two lines of `toDataViewInput` (its signature and the `const filters` line) with the block below. The rest of the function (the date-window `if` and the `return`) stays.

```ts
// Both are callsite mistakes that would otherwise show as a wrong list instead of an error.
function assertPinsApply<F extends FieldList>(config: DataViewQueryConfig<F>, pins: Record<string, unknown>): void {
  // eslint-disable-next-line node/prefer-global/process
  if (process.env.NODE_ENV === 'production') {
    return
  }
  const fields: FieldList = config.fields
  for (const [id, value] of Object.entries(pins)) {
    if (config.window.kind === 'date' && id === config.window.field) {
      throw new Error(`[data-view] '${id}' is pinned, but this data view's date window owns that filter. Remove the pin.`)
    }
    const filter = fields[id]?.filter
    if (filter && filter.kind !== 'fixed' && (filterParserRegistry[filter.kind] as { normalize: (raw: unknown) => unknown }).normalize(value) === undefined) {
      throw new Error(`[data-view] The pin on '${id}' is empty, so the read would ignore it and return every row.`)
    }
  }
}

export function toDataViewInput<F extends FieldList>(filterSort: FilterSortState<F>, windowState: DataViewWindowState, config: DataViewQueryConfig<F>, fixed?: FilterValues<F>): DataViewInput<F> {
  const pins = pinnedFilters(config, fixed)
  assertPinsApply(config, pins)
  // Later entries win: the toolbar's URL values, then the pins, then the date window's own field.
  const filters: Record<string, unknown> = { ...filterSort.filters, ...pins }
```

(g) Replace `deriveDataViewInput` (keep its doc comment) and add `staticDataViewInput` after it:

```ts
export function deriveDataViewInput<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>, fixed?: FilterValues<F>): DataViewInput<F> {
  return toDataViewInput(deriveFilterSortState(urlState, config, fixed), deriveDataViewWindow(urlState, config), config, fixed)
}

/** The input of a data view nobody can change: its config's default sort, pins and window. The page's prefetch and the component's read both call it, so their keys match. */
export function staticDataViewInput<F extends FieldList>(config: DataViewQueryConfig<F>, fixed?: FilterValues<F>): DataViewInput<F> {
  return deriveDataViewInput({}, config, fixed)
}
```

- [ ] **Step 6: The three places that switch on the window kind**

`src/shared/dal/lib/query/adjacent-windows.ts`: in `adjacentDataViewWindows`, put `case 'first':` directly above `case 'whole-list':` so both return `[]`, and end the function's doc comment with "A first-rows or whole-list view has none." in place of "A whole-list view has none."

`src/shared/dal/client/lib/types.ts`: in `DataViewWindowControls`, replace

```ts
  PageWindowControls | DateWindowControls | { kind: 'whole-list' },
```

with

```ts
  PageWindowControls | DateWindowControls | { kind: 'first', count: number } | { kind: 'whole-list' },
```

`src/shared/dal/client/hooks/use-data-view-query.ts`: in the `windowControls` switch, above `case 'whole-list':`, add:

```ts
      case 'first':
        return { kind: 'first', count: windowState.count }
```

No other file switches exhaustively on the window kind (`grep -rn "window.kind\|windowState.kind" src` lists the query-toolbar parts, which only ask "is it a page" or "is it a date").

- [ ] **Step 7: Run the test, type-check, lint**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/data-view-fixed.test.ts`
Expected: 13 pass, 0 fail.

Run: `pnpm tsc && pnpm lint`
Expected: clean. No config has `fixed` yet and no view has a `first` window, so nothing on screen changes in this task.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(data-view): a data view pins filter values in its config and can ask for its first rows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/dal/lib/query/data-view-query-config.ts src/shared/dal/lib/query/derive-data-view-input.ts src/shared/dal/lib/query/adjacent-windows.ts src/shared/dal/client/lib/types.ts src/shared/dal/client/hooks/use-data-view-query.ts
git show --stat HEAD
```

---

### Task 2: Pins at the callsite: the hook and the loader

**Files:**
- Modify: `src/shared/dal/client/hooks/use-data-view-query.ts`
- Modify: `src/shared/dal/server/lib/query/load-data-view-query-input.ts`
- Test (throwaway): `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/loader-parity.test.ts`

**Interfaces:**
- Consumes (Task 1): `dataViewToolbar`, and the `fixed` argument of `makeDataViewParsers`, `deriveFilterSortState`, `toDataViewInput`, `deriveDataViewInput`.
- Produces:
  - `useDataViewQuery(procedure, extra, config, fixed?: FilterValues<F>)`: same result type; `filterSort.toolbar` no longer holds pinned ids; an inline `fixed` object does not refetch (it is keyed by value)
  - `loadDataViewQueryInput(searchParams, config, extra?, fixed?: FilterValues<F>): Promise<DataViewInput<F> & TExtra>`

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/loader-parity.test.ts`:

```ts
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import assert from 'node:assert/strict'
import { test } from 'node:test'

import z from 'zod'

import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { dateRange, defineFieldList, multiSelect } from '@/shared/dal/lib/query/field-list'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'

const FIELDS = defineFieldList({
  status: { label: 'Status', filter: multiSelect({ values: ['open', 'held', 'done'] }), sort: true },
  source: { label: 'Source', filter: multiSelect({ schema: z.string().min(1), source: 'leadSources' }) },
  when: { label: 'When', filter: dateRange(), sort: true },
})

type Config = DataViewQueryConfig<typeof FIELDS>

const FIRST: Config = {
  fields: FIELDS,
  paramPrefix: 't',
  toolbar: [],
  defaultSort: { sortBy: 'when', sortDir: 'desc' },
  fixed: { status: ['open'] },
  window: { kind: 'first', count: 5 },
}
const PAGE: Config = { ...FIRST, toolbar: ['status', 'source', 'when'], fixed: undefined, window: { kind: 'page', pageSize: 20, pageSizeOptions: [10, 20] } }

test('the loader and the static input agree on an empty URL', async () => {
  assert.deepEqual(await loadDataViewQueryInput({}, FIRST), staticDataViewInput(FIRST))
  assert.deepEqual(await loadDataViewQueryInput({}, FIRST, undefined, { source: ['s1'] }), staticDataViewInput(FIRST, { source: ['s1'] }))
  assert.deepEqual(await loadDataViewQueryInput({}, PAGE), staticDataViewInput(PAGE))
})

test('the loader drops a URL value for a pinned id and keeps the pin', async () => {
  const input = await loadDataViewQueryInput({ t_source: 's9', t_status: 'done' }, PAGE, undefined, { source: ['s1'] })
  assert.deepEqual(input.filters, { status: ['done'], source: ['s1'] })
})

test('the loader keeps `extra` beside the pins', async () => {
  const input = await loadDataViewQueryInput({}, FIRST, { id: 'x' }, { source: ['s1'] })
  assert.equal(input.id, 'x')
  assert.deepEqual(input.filters, { status: ['open'], source: ['s1'] })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `NODE_OPTIONS=--conditions=react-server pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/loader-parity.test.ts`
Expected: 3 fail (the loader ignores its fourth argument). Without `NODE_OPTIONS` the file fails earlier on `server-only`; that is not the failure to look for.

- [ ] **Step 3: The loader**

In `src/shared/dal/server/lib/query/load-data-view-query-input.ts`, change the `field-list` type import to `import type { FieldList, FilterValues } from '@/shared/dal/lib/query/field-list'` and replace the doc comment and the function with:

```ts
/**
 * The server half of `useDataViewQuery`'s first render: same parsers, same derivation, same config
 * object. `extra` and `fixed` must equal the hook's, or the prefetch is wasted.
 */
export async function loadDataViewQueryInput<F extends FieldList, TExtra extends object = Record<string, never>>(
  searchParams: Promise<SearchParams> | SearchParams,
  config: DataViewQueryConfig<F>,
  extra?: TExtra,
  fixed?: FilterValues<F>,
): Promise<DataViewInput<F> & TExtra> {
  // The parser map is built at runtime, which createLoader's generic can't express.
  const load = createLoader(makeDataViewParsers(config, fixed) as never)
  const urlState = await load(Promise.resolve(searchParams))
  return { ...deriveDataViewInput(urlState as Record<string, unknown>, config, fixed), ...extra } as DataViewInput<F> & TExtra
}
```

- [ ] **Step 4: The hook**

All in `src/shared/dal/client/hooks/use-data-view-query.ts`. Twelve small replacements; each replaced text occurs once in the file.

1. Type import: add `FilterValues`.

```ts
import type { FieldList, FilterOption, FilterValues, SortDir, ToolbarFilterId, ToolbarFilterSpec } from '@/shared/dal/lib/query/field-list'
```

2. Value import: add `dataViewToolbar`.

```ts
import { dataViewToolbar, dataViewUrlKeys, deriveDataViewWindow, deriveFilterSortState, makeDataViewParsers, toDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
```

3. The hook's doc comment: replace its last line ` * and pass the result down.` with

```ts
 * and pass the result down. `fixed` pins filter values only the callsite knows (one lead source's id); a pin that
 * never changes belongs in the config's `fixed`. A page that prefetches passes the same `fixed` to its loader.
```

4. The parameter list: after `config: DataViewQueryConfig<F, T, W>,` add

```ts
  fixed?: FilterValues<F>,
```

5. Replace `const parsers = useMemo(() => makeDataViewParsers(config), [config])` with

```ts
  const fixedKey = JSON.stringify(fixed)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deep-keyed, so an inline literal keeps one identity and doesn't refetch
  const pins = useMemo(() => fixed, [fixedKey])
  const parsers = useMemo(() => makeDataViewParsers(config, pins), [config, pins])
  const toolbar = useMemo(() => dataViewToolbar(config, pins), [config, pins])
```

6. `filterSort` and `deferredFilterSort`:

```ts
  const filterSort = useMemo(() => deriveFilterSortState(state, config, pins), [state, config, pins])
```

```ts
  const deferredFilterSort = useMemo(() => deriveFilterSortState(shownState, config, pins), [shownState, config, pins])
```

7. `requestedInput`: the factory becomes `() => ({ ...toDataViewInput(filterSort, windowState, config, pins), ...extra }),` and its dependency list `[filterSort, windowState, config, pins, extraKey],`. Keep the `eslint-disable-next-line` comment between them.

8. `shownInput`: the factory becomes `() => ({ ...toDataViewInput(shownFilterSort, shownWindowState, config, pins), ...extra }),` and its dependency list `[shownFilterSort, shownWindowState, config, pins, extraKey],`.

9. `optionFields`:

```ts
  const optionFields = useMemo(() => runtimeOptionFields(config.fields, toolbar), [config.fields, toolbar])
```

10. `clearFilters`: the loop header becomes `for (const id of toolbar) {` and the dependency list `[setUrlState, keys, toolbar, resetsPage]`.

11. `adjacentQueries`: the `.map` becomes

```ts
    .map(adjacent => anyProcedure.queryOptions({ ...toDataViewInput(filterSort, adjacent, config, pins), ...extra }))
```

12. `filterSortControls`: the entry `toolbar: config.toolbar,` becomes `toolbar,` and the dependency list starts `[config.fields, toolbar, filterSort, …` (replace `config.toolbar` with `toolbar`; the rest of the list is unchanged).

After the edit, `grep -n "config.toolbar" src/shared/dal/client/hooks/use-data-view-query.ts` prints nothing.

- [ ] **Step 5: Run the tests, type-check, lint**

Run: `NODE_OPTIONS=--conditions=react-server pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/loader-parity.test.ts`
Expected: 3 pass.

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/data-view-fixed.test.ts`
Expected: 13 pass.

Run: `pnpm tsc && pnpm lint`
Expected: clean, with no new `react-hooks/exhaustive-deps` warning on the hook file.

- [ ] **Step 6: Code read (the inline pin)**

Read the saved hook and confirm, with line numbers in the task report: `pins` is the only place `fixed` is read; `pins` is memoized on `fixedKey`; every `useMemo` that reads `pins` lists it; `extra` is still spread last over the derived input, so a top-level input can never be overwritten by a pin.

- [ ] **Step 7: Browser regression check (Review Focus 1)**

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts task2 super-admin /dashboard /dashboard/customers /dashboard/meetings /dashboard/projects /dashboard/lead-sources /dashboard/schedule /dashboard/pipeline/fresh
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts task2 agent /dashboard /dashboard/customers /dashboard/meetings /dashboard/projects /dashboard/schedule /dashboard/pipeline/fresh
diff .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/baseline-super-admin.json .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/task2-super-admin.json
diff .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/baseline-agent.json .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/task2-agent.json
```

Expected: for every path, width and scheme, `columns`, every `reads[].input`, every `reads[].ids` and `errors` are the same as the baseline, and `readCount` is within one or two of it (a prefetch can land after the report is written). Differences in relative times ("2 minutes ago"), or in rows another session's writes changed, are not regressions; name each difference in the report and say which kind it is. A changed `input` or a new error is a regression: stop and fix. Then, by hand on `/dashboard/meetings` (desktop, light): pick one filter, see its chip, press "Clear"; the filter key leaves the URL and the rows return. On `/dashboard/pipeline/fresh`, the Rep and Lead source filters still list their options.

- [ ] **Step 8: Commit**

```bash
git commit -m "feat(data-view): the hook and the loader take callsite pins; a pinned id has no URL key, control or chip

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/dal/client/hooks/use-data-view-query.ts src/shared/dal/server/lib/query/load-data-view-query-input.ts
git show --stat HEAD
```

---

### Task 3: The dashboard's meetings and project reads on data-view configs

**Files:**
- Modify: `src/features/agent-dashboard/constants/dashboard-queries.ts`
- Modify: `src/app/(frontend)/dashboard/page.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-snapshot-counts.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-projects.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-project-section.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-project-section-list.tsx`
- Modify: `src/trpc/routers/meetings.router/reads.router.ts` (the setter plan rewrote this file's imports and `getInternalUsers`; touch only the `list` procedure and the `LIVE_MEETING_OUTCOMES` import)
- Modify: `src/shared/modules/projects/core/DOCS.md` (one line that names the removed builders)
- Modify: `docs/plans/2026-09-26-records-management-epic.md`, `docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md` (status lines)
- Test (throwaway): `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/dashboard-inputs.test.ts`

`dashboard-snapshot-chips.tsx` (not edited here) carried another session's theme edits on 2026-10-05; leave it alone.

**Interfaces:**
- Consumes: `staticDataViewInput(config, fixed?)`, `DataViewQueryConfig.fixed`, the `first` window (Task 1); `loadDataViewQueryInput` and `useDataViewQuery` reading `config.fixed` (Tasks 1–2); `DataViewInput<F>` from `@/shared/dal/lib/query/data-view-query-config`.
- Produces: `DASHBOARD_MEETINGS_WINDOW_QUERIES: Record<MeetingWindowKind, DataViewQueryConfig<typeof MEETING_FIELDS>>`; `meetingsWindowInput(kind): DataViewInput<typeof MEETING_FIELDS>`; `DASHBOARD_MEETINGS_QUERY` with `fixed: { outcome: LIVE_MEETING_OUTCOMES }`; `DASHBOARD_ACTIVE_PROJECTS_QUERY`, `DASHBOARD_ON_HOLD_PROJECTS_QUERY`. Removed: `DASHBOARD_MEETINGS_EXTRA`, `activeProjectsInput`, `onHoldProjectsInput`, `ProjectsListInput`, and the `liveOnly` input of `meetingsRouter.reads.list`.

- [ ] **Step 1: Write the failing test**

Create `.superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/dashboard-inputs.test.ts`:

```ts
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { hashKey } from '@tanstack/react-query'

import { DASHBOARD_ACTIVE_PROJECTS_QUERY, DASHBOARD_LIMITS, DASHBOARD_MEETINGS_QUERY, DASHBOARD_ON_HOLD_PROJECTS_QUERY, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { meetingWindow } from '@/features/agent-dashboard/lib/meeting-windows'
import { LIVE_MEETING_OUTCOMES } from '@/shared/constants/enums'
import { deriveDataViewInput, staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'

// What each builder returned before the move, written out by hand. A query key is the hash of its input,
// so equal hashes mean the same cached read and the same rows.
test('the project sections ask for exactly what they asked before', () => {
  assert.equal(
    hashKey([staticDataViewInput(DASHBOARD_ACTIVE_PROJECTS_QUERY)]),
    hashKey([{ pagination: { limit: DASHBOARD_LIMITS.projectsPerSection, offset: 0 }, sort: { sortBy: 'createdAt', sortDir: 'desc' }, filters: { statusBucket: ['active'], excludePortfolio: true } }]),
  )
  assert.equal(
    hashKey([staticDataViewInput(DASHBOARD_ON_HOLD_PROJECTS_QUERY)]),
    hashKey([{ pagination: { limit: DASHBOARD_LIMITS.projectsPerSection, offset: 0 }, sort: { sortBy: 'createdAt', sortDir: 'desc' }, filters: { statusBucket: ['on_hold'], excludePortfolio: true } }]),
  )
})

test('each meetings window asks for exactly what it asked before', () => {
  for (const kind of ['today', 'upcoming', 'past'] as const) {
    assert.equal(
      hashKey([meetingsWindowInput(kind)]),
      hashKey([{
        pagination: { limit: DASHBOARD_LIMITS.meetings, offset: 0 },
        sort: { sortBy: 'scheduledFor', sortDir: kind === 'past' ? 'desc' : 'asc' },
        filters: { scheduledFor: meetingWindow(kind), outcome: LIVE_MEETING_OUTCOMES },
      }]),
    )
  }
})

test('the calendar pins live outcomes beside its month range', () => {
  const input = deriveDataViewInput({}, DASHBOARD_MEETINGS_QUERY)
  assert.deepEqual(input.filters?.outcome, LIVE_MEETING_OUTCOMES)
  assert.ok(input.filters?.scheduledFor?.from && input.filters.scheduledFor.to)
  assert.deepEqual(input.pagination, { limit: DASHBOARD_LIMITS.meetingsCalendar, offset: 0 })
})
```

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/dashboard-inputs.test.ts`
Expected: FAIL with `does not provide an export named 'DASHBOARD_ACTIVE_PROJECTS_QUERY'`.

- [ ] **Step 2: The configs**

Replace `src/features/agent-dashboard/constants/dashboard-queries.ts` with (the two proposal builders are unchanged; proposals have no field list until R3):

```ts
// Every dashboard module (snapshot strip, meetings hub, proposals and projects sections) reads through these, so
// a module and the page's prefetch share one query key per concern. Meetings and projects are data-view configs:
// a wrong filter or sort id fails `pnpm tsc` against the entity's field list. Proposals have no field list yet,
// so their inputs are checked with `satisfies` against the procedure's input type.

import type { MeetingWindowKind } from '../lib/meeting-windows'
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'
import type { ProposalListInput } from '@/shared/modules/proposals/core/dal/server/queries'

import { LIVE_MEETING_OUTCOMES } from '@/shared/constants/enums'
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
import { meetingWindow } from '../lib/meeting-windows'

/** Caps shared by every dashboard module that lists this entity — a Top-N slice for most, the month grid's row cap for the meetings calendar. */
export const DASHBOARD_LIMITS = { meetings: 8, meetingsCalendar: 500, proposals: 20, proposalsPerSection: 5, projects: 15, projectsPerSection: 5, actionQueue: 8 } as const

/** The Today, Upcoming and Past lists: live outcomes only, the first rows by `scheduledFor` (latest first for Past). */
export const DASHBOARD_MEETINGS_WINDOW_QUERIES = {
  today: {
    fields: MEETING_FIELDS,
    paramPrefix: 'dmt',
    toolbar: [],
    defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
    fixed: { outcome: LIVE_MEETING_OUTCOMES },
    window: { kind: 'first', count: DASHBOARD_LIMITS.meetings },
  },
  upcoming: {
    fields: MEETING_FIELDS,
    paramPrefix: 'dmu',
    toolbar: [],
    defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
    fixed: { outcome: LIVE_MEETING_OUTCOMES },
    window: { kind: 'first', count: DASHBOARD_LIMITS.meetings },
  },
  past: {
    fields: MEETING_FIELDS,
    paramPrefix: 'dmp',
    toolbar: [],
    defaultSort: { sortBy: 'scheduledFor', sortDir: 'desc' },
    fixed: { outcome: LIVE_MEETING_OUTCOMES },
    window: { kind: 'first', count: DASHBOARD_LIMITS.meetings },
  },
} as const satisfies Record<MeetingWindowKind, DataViewQueryConfig<typeof MEETING_FIELDS>>

/** The day range moves with the clock, so it is pinned when the input is built; the page's prefetch and the snapshot strip both call this. */
export function meetingsWindowInput(kind: MeetingWindowKind) {
  return staticDataViewInput(DASHBOARD_MEETINGS_WINDOW_QUERIES[kind], { scheduledFor: meetingWindow(kind) })
}

/** The month calendar: live outcomes only. */
export const DASHBOARD_MEETINGS_QUERY = {
  fields: MEETING_FIELDS,
  paramPrefix: 'dm',
  toolbar: [],
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
  fixed: { outcome: LIVE_MEETING_OUTCOMES },
  window: { kind: 'date', field: 'scheduledFor', cap: DASHBOARD_LIMITS.meetingsCalendar, views: ['month'] },
} as const satisfies DataViewQueryConfig<typeof MEETING_FIELDS>

/** Proposals awaiting the homeowner's signature (contract sent, unsigned/undeclined). */
export function awaitingProposalsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.proposalsPerSection, offset: 0 },
    sort: { sortBy: 'contractSentAt', sortDir: 'desc' },
    filters: { awaitingSignature: true },
  } satisfies ProposalListInput
}

/** Proposals sent, awaiting the customer's response — `status='sent'` with no contract envelope yet (the `proposal_sent` stage). Newest-first by send recency (coalesced to createdAt), matching the card's displayed "time since". */
export function sentProposalsInput() {
  return {
    pagination: { limit: DASHBOARD_LIMITS.proposalsPerSection, offset: 0 },
    sort: { sortBy: 'sentRecency', sortDir: 'desc' },
    filters: { sentNoContract: true },
  } satisfies ProposalListInput
}

/**
 * Live work (signed through full payment), newest first. `statusBucket` is derived from the pipeline stage;
 * `excludePortfolio` drops showcase-only projects, which never ran the lifecycle.
 */
export const DASHBOARD_ACTIVE_PROJECTS_QUERY = {
  fields: PROJECT_FIELDS,
  paramPrefix: 'dpa',
  toolbar: [],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  fixed: { statusBucket: ['active'], excludePortfolio: true },
  window: { kind: 'first', count: DASHBOARD_LIMITS.projectsPerSection },
} as const satisfies DataViewQueryConfig<typeof PROJECT_FIELDS>

/** Projects paused mid-flight, newest first. Real projects only. */
export const DASHBOARD_ON_HOLD_PROJECTS_QUERY = {
  fields: PROJECT_FIELDS,
  paramPrefix: 'dph',
  toolbar: [],
  defaultSort: { sortBy: 'createdAt', sortDir: 'desc' },
  fixed: { statusBucket: ['on_hold'], excludePortfolio: true },
  window: { kind: 'first', count: DASHBOARD_LIMITS.projectsPerSection },
} as const satisfies DataViewQueryConfig<typeof PROJECT_FIELDS>
```

Only `today` has a caller today; `upcoming` and `past` keep `meetingsWindowInput(kind)` total over `MeetingWindowKind`, as before.

- [ ] **Step 3: The page's prefetch**

In `src/app/(frontend)/dashboard/page.tsx`, replace the `dashboard-queries` import and add the `staticDataViewInput` import directly above the `loadDataViewQueryInput` import:

```ts
import { awaitingProposalsInput, DASHBOARD_ACTIVE_PROJECTS_QUERY, DASHBOARD_MEETINGS_QUERY, DASHBOARD_ON_HOLD_PROJECTS_QUERY, meetingsWindowInput, sentProposalsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
```

```ts
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
```

Then replace the calendar prefetch and the two project prefetches (the `today` and the two proposal lines stay):

```ts
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(await loadDataViewQueryInput(searchParams, DASHBOARD_MEETINGS_QUERY)))
```

```ts
    prefetch(trpc.projectsRouter.crud.list.queryOptions(staticDataViewInput(DASHBOARD_ACTIVE_PROJECTS_QUERY)))
    prefetch(trpc.projectsRouter.crud.list.queryOptions(staticDataViewInput(DASHBOARD_ON_HOLD_PROJECTS_QUERY)))
```

- [ ] **Step 4: The dashboard components**

`dashboard-meetings-hub.tsx`: the import becomes `import { DASHBOARD_MEETINGS_QUERY } from '@/features/agent-dashboard/constants/dashboard-queries'` and the read becomes

```ts
  const query = useDataViewQuery(trpc.meetingsRouter.reads.list, {}, DASHBOARD_MEETINGS_QUERY)
```

`dashboard-snapshot-counts.tsx`: the `dashboard-queries` import becomes

```ts
import { awaitingProposalsInput, DASHBOARD_ACTIVE_PROJECTS_QUERY, meetingsWindowInput } from '@/features/agent-dashboard/constants/dashboard-queries'
```

add, directly below the `use-hydration-parity-check` import,

```ts
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
```

and the projects line becomes

```ts
  const activeProjectsOptions = trpc.projectsRouter.crud.list.queryOptions(staticDataViewInput(DASHBOARD_ACTIVE_PROJECTS_QUERY))
```

`dashboard-projects.tsx`: the `dashboard-queries` import becomes

```ts
import { DASHBOARD_ACTIVE_PROJECTS_QUERY, DASHBOARD_ON_HOLD_PROJECTS_QUERY } from '@/features/agent-dashboard/constants/dashboard-queries'
```

add, directly below the `ROOTS` import,

```ts
import { staticDataViewInput } from '@/shared/dal/lib/query/derive-data-view-input'
```

in the doc comment replace the sentence "Each section reuses the exact query keys the dashboard route prefetches (`activeProjectsInput` / `onHoldProjectsInput`), so both hydrate instantly." with "Each section builds its input from the config the dashboard route prefetches, so both hydrate instantly."; and the two props become

```tsx
          input={staticDataViewInput(DASHBOARD_ACTIVE_PROJECTS_QUERY)}
```

```tsx
          input={staticDataViewInput(DASHBOARD_ON_HOLD_PROJECTS_QUERY)}
```

`dashboard-project-section.tsx` and `dashboard-project-section-list.tsx`, both: replace the `ProjectsListInput` type import with

```ts
import type { DataViewInput } from '@/shared/dal/lib/query/data-view-query-config'
import type { PROJECT_FIELDS } from '@/shared/modules/projects/core/dal/project-fields'
```

and the prop type `input: ProjectsListInput` with `input: DataViewInput<typeof PROJECT_FIELDS>`. In `dashboard-project-section.tsx` the prop's doc comment becomes `/** The static input of the config the page prefetches, so the key matches (hydration parity). */`.

- [ ] **Step 5: `liveOnly` goes**

In `src/trpc/routers/meetings.router/reads.router.ts`: delete the `import { LIVE_MEETING_OUTCOMES } from '@/shared/constants/enums'` line, and replace the whole `list` procedure, with the comment line above it, by:

```ts
  list: meetingProcedure
    .input(meetingListInputSchema)
    .query(async ({ ctx, input }) => dalToTrpc(await listMeetings(ctx, input))),
```

`z` stays imported (`getByIdWithJoins`, `listForProject` and `getInternalUsers` use it).

One notes file names the removed builders. In `src/shared/modules/projects/core/DOCS.md`, in the "Reference impl" line that ends with "(`activeProjectsInput` / `onHoldProjectsInput`)", replace that parenthesis with "(`DASHBOARD_ACTIVE_PROJECTS_QUERY` / `DASHBOARD_ON_HOLD_PROJECTS_QUERY`)".

- [ ] **Step 6: Tests, greps, type-check, lint**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/tests/dashboard-inputs.test.ts`
Expected: 3 pass. The first two tests are the proof that each list's query key, and so its rows, did not change.

Run: `grep -rn "liveOnly\|DASHBOARD_MEETINGS_EXTRA\|activeProjectsInput\|onHoldProjectsInput\|ProjectsListInput" src`
Expected: no output.

Run: `pnpm tsc && pnpm lint`
Expected: clean.

- [ ] **Step 7: Browser read check (Review Focus 2 and 5)**

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts task3 super-admin /dashboard "/dashboard?dm_outcome=cancelled"
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts task3 agent /dashboard
THEN_CLICK='#meetings button[aria-label="Go to the Next Month"]' pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts task3-next-month super-admin /dashboard
```

Compare `task3-*.json` with `baseline-*.json` for `/dashboard`, and look at the screenshots beside the baseline's, for both roles, both widths and both schemes:
- `chips` (the snapshot strip: meetings today, awaiting signature, active projects) and `sections` (Meetings, Proposals, Projects) read the same as the baseline, card for card, apart from relative times;
- the Projects module still shows "Active" and "On hold" with their totals, at most five cards each;
- `errors` holds no `[prefetch drift]`, no `[data-view]` and no hydration error that the baseline did not have;
- `readCount` is the baseline's, give or take a late prefetch: a higher count means a list missed its prefetch and asked again. Any `meetingsRouter.reads.list` entry (the calendar's neighbouring months) has the baseline's `ids` for the same month, and its `input` now carries `filters.outcome` where the baseline's carried `liveOnly: true`;
- `/dashboard?dm_outcome=cancelled` shows the same calendar dots and agenda as `/dashboard` (the key is ignored);
- in `task3-next-month-super-admin.json`, the `meetingsRouter.reads.list` read made by stepping a month has `input.filters.outcome` equal to the live outcomes (every outcome except `cancelled` and `no_show`), an `input.filters.scheduledFor` range, and no `liveOnly` key.

The meetings table and the schedule read the same procedure, whose input just lost `liveOnly`. Capture them once more and confirm their `reads[].input` and `reads[].ids` still equal the baseline's:

```bash
pnpm exec tsx .superpowers/sdd/2026-10-05-customers-entity-table-and-fixed-filters/capture.ts task3-meetings super-admin /dashboard/meetings /dashboard/schedule
```

- [ ] **Step 8: Tracker and spec status**

Re-read both files first; if either carries uncommitted hunks you didn't make, report the edit for the owner instead of committing it.

In `docs/plans/2026-09-26-records-management-epic.md`:
- §3, row **R2**, status cell: replace it with `[~] spec approved 2026-10-05. Part 1 (fixed filters, the first-rows window, dashboard reads) built on local main <first-sha>..<last-sha>: docs/superpowers/plans/2026-10-05-customers-entity-table-and-fixed-filters.md. Part 2 (customers entity table, the three table views) next: …-part-2.md` with this plan's first and last commit hashes.
- §4, row **O9**, last cell: `built with R2 part 1 (config \`fixed\`, a runtime \`fixed\` on the hook and the loader, \`staticDataViewInput\`)`.
- §5, **H2**: replace "the page's `loadPaginatedQueryInput` and the client's `usePaginatedQuery` import (`query-toolkit.md#shared-table-config`)" with "the page's `loadDataViewQueryInput` and the client's `useDataViewQuery` import", and add the sentence "A runtime pin (`fixed`) is the one key-relevant value that is not in the constant: pass the same value to both."

In the spec, replace the **Status** line with `> **Status:** approved by the owner 2026-10-05. Part 1 (§3, §4, §6) is built; part 2 (§5, §7) is planned.`

- [ ] **Step 9: Commit**

```bash
git commit -m "refactor(dashboard): meetings and project reads come from data-view configs with their filters pinned; liveOnly goes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/features/agent-dashboard/constants/dashboard-queries.ts "src/app/(frontend)/dashboard/page.tsx" src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx src/features/agent-dashboard/ui/components/dashboard-snapshot-counts.tsx src/features/agent-dashboard/ui/components/dashboard-projects.tsx src/features/agent-dashboard/ui/components/dashboard-project-section.tsx src/features/agent-dashboard/ui/components/dashboard-project-section-list.tsx src/trpc/routers/meetings.router/reads.router.ts
git commit -m "docs(records): fixed filters and the dashboard reads are built; tracker and spec follow

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- docs/plans/2026-09-26-records-management-epic.md docs/superpowers/specs/2026-10-05-customers-entity-table-and-fixed-filters-design.md src/shared/modules/projects/core/DOCS.md
git show --stat HEAD
```

---

## Self-review notes (kept for the executor)

- **Spec coverage.** §3.2.1 (config `fixed`) → Task 1 Step 4; §3.2.2 (runtime `fixed` on the hook and the loader, keyed by value) → Task 2 Steps 3–4; §3.2.3 (one merge) and §3.2.5 (the date-window throw) → Task 1 Step 5(f); §3.2.4 (a pinned id leaves the toolbar) → Task 1 Step 5(b–d), Task 2 Step 4; §3.2.6 (no server change) → nothing to do; §3.2.7 (prefetch parity) → Task 2 Step 3, Task 3 Step 3; §4 (`first`, `staticDataViewInput`) → Task 1 Steps 4–6; §6 (dashboard reads) → Task 3; §8 (a bookmarked key for a pinned id) → Task 1 Step 2, Task 3 Step 7; §11 (baseline, tests, browser) → Task 1 Step 1, the three test files, Tasks 2–3 browser steps. §5 and §7 are part 2.
- **Type consistency.** `fixed?: FilterValues<F>` is the last parameter everywhere it appears (Task 1 functions, the hook, the loader, `staticDataViewInput`). `dataViewToolbar` returns `readonly T[]`, which is what `DataViewFilterSort.toolbar` holds. The `first` window state carries `count` and `pagination`; the hook's controls carry `count` only. `meetingsWindowInput` returns `DataViewInput<typeof MEETING_FIELDS>`, which `trpc.meetingsRouter.reads.list.queryOptions` accepts (the same type `useDataViewQuery` checks the procedure against).
- **Order.** Task 2 needs Task 1's functions; Task 3 needs both (the calendar's pin goes through the loader and the hook). Nothing runs in parallel.
- **Checked while writing (2026-10-05, on a scratch copy of the tree at `834614d7`).** Every code block here was applied, and `tsc --noEmit`, ESLint and the three test files passed: 13, 3 and 3 tests. The capture script was type-checked only.
