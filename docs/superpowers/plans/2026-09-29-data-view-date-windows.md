# Data-view Date Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Date views prefetch two windows either side, draw skeletons (never another key's rows or a false "No events") while their rows load, and the agent dashboard calendar joins the same `useDataViewQuery` read path with its month in the URL.

**Architecture:** Three layers change in order. The shared data-view machinery (`dal/lib/query`, `dal/client`) gains a wider prefetch radius, a per-window `isPending` flag and a per-view list of allowed calendar views. The schedule's three calendar views render skeletons from that flag. Then the dashboard calendar drops its private `useQuery` for `useDataViewQuery`, with live outcomes pinned by a top-level `liveOnly` input on the meetings list procedure.

**Tech Stack:** Next.js 15 App Router · React 19 · TanStack Query v5 through `@trpc/tanstack-react-query` (`httpBatchLink`, `staleTime` 30s) · nuqs 2.8 · react-day-picker 9.14 · Tailwind v4 · shadcn/ui · Playwright 1.58 and `tsx` for throwaway checks (no unit-test runner in this repo).

**Spec:** `docs/superpowers/specs/2026-09-29-data-view-date-windows-design.md` (ruled 2026-09-29, `f6c6cc45`). Read it before starting; this plan argues from it.

## Global Constraints

- **Radius:** date windows ±2, page windows ±1, whole-list none; nearest first (`-1, +1, -2, +2`). The settle gate in `usePrefetchQueries` is unchanged (A1, A2).
- **Pending:** on a date window, `isPending = result.isLoading || result.isPlaceholderData`. That covers a window step, a filter change and a committed search (A6), and it's false after an error (A3).
- **Dashboard:** config prefix `dm`, no toolbar, sort `scheduledFor` asc, date window on `scheduledFor`, cap 500, views `['month']`, `extra` `{ liveOnly: true }`. Month grid read, month in the URL, error line with retry (A4, A7, A8).
- **Approved names (spec §5), use exactly:** `ADJACENT_WINDOW_RADIUS`, `isPending` (on `DateWindowControls` only), `views`, `liveOnly`, `DASHBOARD_MEETINGS_QUERY`, `DASHBOARD_MEETINGS_EXTRA`, `dm`, `ScheduleCardSkeleton`.
- **Names this plan adds (owner approves at plan review):** `DASHBOARD_LIMITS.meetingsCalendar` (the 500 cap), `SCHEDULE_PENDING_SKELETONS` (2: skeleton cards per week column, placeholder lanes in the day view). Any other new exported name: stop and ask.
- **Files:** only the spec §6 list, plus throwaway files under `.superpowers/sdd/2026-09-29-data-view-date-windows/` (gitignored, never committed). `package.json`, the tRPC provider, the query client and shared configs stay untouched.
- **Checks:** `pnpm tsc` and `pnpm lint` clean after every commit. Never `pnpm build`. Never write to any database; the harness's dev-session sign-in (once per run) is the only accepted write.
- **Git, on a shared workbench (local `main`, other sessions commit concurrently):**
  - Stage new files with `git add -- <path>`, then commit with `git commit -m "…" -- <explicit paths>`.
  - Never `git add -A`, `git add .`, `git add -u`, `git commit -a`, `git commit --amend`, `git stash`, `git checkout -- .`, `git restore`, `git reset` or `git clean`.
  - The index already holds another session's staged deletion (`scripts/snapshot-prod-to-dev.ts`). Leave it staged and out of every commit.
  - End each commit message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Confirm with `git show --stat HEAD`. If a commit comes out wrong, STOP and report; don't repair it.
- **Code style:** comments say why, never what, and never cite plans, specs or tasks. One React component per file. No file-level constants in component files (they go in `constants/`). Named exports; `@/` alias. Match the neighbouring code.
- **Auto-fix lint only on your own files:** `pnpm exec eslint --fix <paths>`. Never `pnpm lint:fix`, which rewrites the whole tree.
- **Dev server:** the harness uses the one already on `:3000` (`ss -ltnp | grep :3000`). Never restart or kill it. If nothing listens there, start `pnpm dev` in the background and stop only that process afterwards.

## Review Focus

1. **A stale or hand-edited view in the URL** (`?s_v=agenda`, `?dm_v=week`) should read as the view's default, not crash or show an unsupported view. Pinned in Task 4's `check-views.ts`.
2. **Month stepping from a 29th–31st anchor** (Jan 31, Mar 31) should step whole months without skipping or repeating one. Pinned in Task 2's `check-adjacent-windows.ts`.
3. **DST days and weeks** (Mar 8 and Nov 1, 2026) should produce windows that start at Pacific midnight. Pinned in Task 2's `check-adjacent-windows.ts`.
4. **A read that fails while a window is pending** should end on the error state, not endless skeletons. Pinned in Task 3's `harness.ts checks:schedule`.
5. **A picked outside day on the dashboard** (Oct 1 clicked in September's grid) should stay picked while the next grid still covers it, and fall back to the anchor day when it doesn't. Pinned in Task 6's `harness.ts checks:dashboard`.

---

### Task 1: Browser harness and baseline

Records how the app behaves today, before any code changes, so Task 8 can compare. Nothing is committed: `.superpowers/` is gitignored.

**Files:**
- Create: `.superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts`
- Output: `.superpowers/sdd/2026-09-29-data-view-date-windows/baseline.json`

**Interfaces:**
- Produces: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts <baseline|after|checks:schedule|checks:dashboard|shots>`. Tasks 3, 6, 8 and 9 run it. The check modes print `PASS <mode>` and exit 0, or print `FAIL (n)` with one line per failure and exit 1.

- [ ] **Step 1: Confirm the tree matches the spec's baseline**

The spec measures "before" at `2495d193`. None of the files this plan touches has changed since.

Run:
```bash
git diff --stat 2495d193 HEAD -- src/shared/dal src/shared/components/calendar src/shared/components/query-toolbar src/features/schedule-management src/features/agent-dashboard src/trpc/routers/meetings.router 'src/app/(frontend)/dashboard/page.tsx'
git status --short -- src/shared/dal src/shared/components/calendar src/shared/components/query-toolbar src/features/schedule-management src/features/agent-dashboard src/trpc/routers/meetings.router 'src/app/(frontend)/dashboard/page.tsx'
ss -ltnp | grep ':3000'
```
Expected: the first two print nothing, and the third shows a `next-server` listening. If either of the first two prints anything, STOP and report: the baseline wouldn't be the spec's baseline.

- [ ] **Step 2: Write the harness**

Create `.superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts`:

```ts
// Throwaway browser harness for docs/superpowers/plans/2026-09-29-data-view-date-windows.md. Gitignored; never committed.
//
//   pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts baseline | after | checks:schedule | checks:dashboard | shots
//
// Browser-side code is passed as strings: tsx (esbuild) wraps functions in a `__name` helper the page doesn't have.

import type { Browser, BrowserContext, Page, Request } from 'playwright'

import fs from 'node:fs'
import { chromium } from 'playwright'

import { LIVE_MEETING_OUTCOMES } from '@/shared/constants/enums/meetings'
import { addCalendarDays, BUSINESS_TIMEZONE, businessDayKey, businessMonthGridWindow, businessToday, startOfDayInTimeZone, toInclusiveRange } from '@/shared/lib/business-time'

type Kind = 'schedule' | 'dashboard'
type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>

interface ListCall {
  batch: number
  index: number
  limit: number
  from: string
  to: string
  search: string | undefined
  filterKeys: string[]
  requestedAt: number
  respondedAt?: number
  failed?: boolean
  rows?: { scheduledFor: string, meetingOutcome: string }[]
}

interface Sample { t: number, noEvents: number, noMeetings: number, skeletons: number, busy: number }

interface Landing {
  kind: Kind
  intervalMs: number
  step: number
  clickAt: number
  endAt: number
  waitMs: number | null
  passedThrough: boolean
  falseEmptyFrames: number
  skeletonFrames: number
  busyMissingFrames: number
}

interface Tracker { calls: ListCall[], batches: () => number }

const DIR = '.superpowers/sdd/2026-09-29-data-view-date-windows'
const LIST_PATH = 'meetingsRouter.reads.list'
// Calendar reads ask for 200+ rows (schedule 500; the dashboard 200 before this plan, 500 after). The snapshot strip asks for 8.
const CALENDAR_MIN_LIMIT = 200
const INTERVALS = [150, 300, 600]
const STEPS: Record<Kind, number> = { schedule: 5, dashboard: 3 }
const NAV: Record<Kind, { path: string, next: string, previous: string }> = {
  schedule: { path: '/dashboard/schedule', next: 'Next', previous: 'Previous' },
  dashboard: { path: '/dashboard', next: 'Go to the Next Month', previous: 'Go to the Previous Month' },
}
const TODAY = businessToday()

function readEnvLocal(key: string): string | undefined {
  const line = fs.readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith(`${key}=`))
  return line?.slice(key.length + 1).trim().replace(/^["']|["']$/g, '')
}

const BASE = `http://localhost:${readEnvLocal('PORT') ?? '3000'}`

const SAMPLER = `(() => {
  window.__samples = []
  window.__sampling = false
  const count = xpath => document.evaluate('count(' + xpath + ')', document, null, XPathResult.NUMBER_TYPE, null).numberValue
  const tick = () => {
    if (window.__sampling && document.body) {
      window.__samples.push({
        t: Date.now(),
        noEvents: count("//span[normalize-space(.)='No events' or normalize-space(.)='No events scheduled for this day']"),
        noMeetings: count("//p[starts-with(normalize-space(.), 'No meetings on')]"),
        skeletons: document.querySelectorAll('[data-slot="skeleton"]').length,
        busy: document.querySelectorAll('[aria-busy="true"]').length,
      })
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})()`

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function waitFor(check: () => boolean | Promise<boolean>, timeoutMs: number, what: string): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (await check()) {
      return
    }
    await sleep(50)
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${what}`)
}

const isListRead = (url: URL) => url.pathname.startsWith('/api/trpc/') && decodeURIComponent(url.pathname).includes(LIST_PATH)

function track(page: Page): Tracker {
  const calls: ListCall[] = []
  const byRequest = new Map<Request, ListCall[]>()
  let batches = 0
  page.on('request', (req) => {
    const url = new URL(req.url())
    if (!url.pathname.startsWith('/api/trpc/')) {
      return
    }
    const procedures = decodeURIComponent(url.pathname.slice('/api/trpc/'.length)).split(',')
    if (!procedures.includes(LIST_PATH)) {
      return
    }
    batches += 1
    const input = JSON.parse(url.searchParams.get('input') ?? '{}') as Record<string, { json?: { pagination?: { limit?: number }, search?: string, filters?: Record<string, unknown> } }>
    const mine: ListCall[] = []
    procedures.forEach((procedure, index) => {
      const json = input[String(index)]?.json
      const range = json?.filters?.scheduledFor as { from?: string, to?: string } | undefined
      if (procedure !== LIST_PATH || !range?.from || !range.to) {
        return
      }
      mine.push({ batch: batches, index, limit: json?.pagination?.limit ?? 0, from: range.from, to: range.to, search: json?.search, filterKeys: Object.keys(json?.filters ?? {}), requestedAt: Date.now() })
    })
    calls.push(...mine)
    byRequest.set(req, mine)
  })
  page.on('requestfinished', async (req) => {
    const mine = byRequest.get(req)
    if (!mine) {
      return
    }
    const at = Date.now()
    const body = await (await req.response())?.json().catch(() => null) as { result?: { data?: { json?: { rows?: ListCall['rows'] } } } }[] | null
    for (const call of mine) {
      call.respondedAt = at
      const rows = body?.[call.index]?.result?.data?.json?.rows
      if (rows) {
        call.rows = rows
      }
      else {
        call.failed = true
      }
    }
  })
  page.on('requestfailed', (req) => {
    for (const call of byRequest.get(req) ?? []) {
      call.respondedAt = Date.now()
      call.failed = true
    }
  })
  return { calls, batches: () => batches }
}

const calendarCalls = (calls: ListCall[]) => calls.filter(c => c.limit >= CALENDAR_MIN_LIMIT)

/** `YYYY-MM-DD` for `day` of the month `offset` months from today's. */
function monthDay(offset: number, day: number): string {
  const [year, month] = TODAY.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1 + offset, day)).toISOString().slice(0, 10)
}

/** An instant inside the window a step lands on: the target week's anchor day, or the 15th of the target month. */
function landingInstant(kind: Kind, step: number): string {
  const day = kind === 'schedule' ? addCalendarDays(TODAY, 7 * step) : monthDay(step, 15)
  return startOfDayInTimeZone(day, BUSINESS_TIMEZONE).toISOString()
}

function firstArrival(calls: ListCall[], instant: string): number | null {
  const hits = calendarCalls(calls).filter(c => !c.failed && c.respondedAt !== undefined && c.from <= instant && instant <= c.to)
  return hits.length > 0 ? Math.min(...hits.map(c => c.respondedAt ?? Number.POSITIVE_INFINITY)) : null
}

/** Waits past hydration until no calendar read is in flight and none has landed for 1.5s. */
async function settle(calls: ListCall[]): Promise<void> {
  await sleep(3000)
  await waitFor(() => {
    const cal = calendarCalls(calls)
    const last = Math.max(0, ...cal.map(c => c.respondedAt ?? 0))
    return cal.every(c => c.respondedAt !== undefined) && Date.now() - last > 1500
  }, 30_000, 'calendar reads to settle')
}

async function signedInState(browser: Browser): Promise<StorageState> {
  const secret = readEnvLocal('DEV_LOGIN_SECRET')
  if (!secret) {
    throw new Error('DEV_LOGIN_SECRET is missing from .env.local')
  }
  const context = await browser.newContext()
  const page = await context.newPage()
  try {
    await page.goto(`${BASE}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent('/dashboard/schedule')}`, { waitUntil: 'load', timeout: 180_000 })
  }
  catch {
    // Playwright's own message prints the URL, and the URL carries the secret.
    throw new Error(`dev sign-in failed; is the dev server up on ${BASE}?`)
  }
  // Warms the dev compile of both pages so the first measured run isn't a compile.
  await page.goto(`${BASE}/dashboard`, { waitUntil: 'load', timeout: 180_000 })
  const state = await context.storageState()
  await context.close()
  return state
}

async function openPage(browser: Browser, state: StorageState, path: string, drift: string[], colorScheme: 'light' | 'dark' = 'light') {
  const context = await browser.newContext({ storageState: state, viewport: { width: 1440, height: 900 }, colorScheme })
  const page = await context.newPage()
  await page.addInitScript(SAMPLER)
  page.on('console', (msg) => {
    if (msg.type() === 'error' && msg.text().includes('[prefetch drift]')) {
      drift.push(`${path}: ${msg.text().slice(0, 240)}`)
    }
  })
  const tracker = track(page)
  await page.goto(`${BASE}${path}`, { waitUntil: 'load', timeout: 180_000 })
  await settle(tracker.calls)
  return { context, page, tracker }
}

async function startSampling(page: Page): Promise<void> {
  await page.evaluate('window.__samples = []; window.__sampling = true')
}

async function stopSampling(page: Page): Promise<Sample[]> {
  await page.evaluate('window.__sampling = false')
  return await page.evaluate('window.__samples') as Sample[]
}

async function clickSeries(page: Page, label: string, count: number, intervalMs: number): Promise<number[]> {
  return await page.evaluate(`(async () => {
    const times = []
    for (let i = 0; i < ${count}; i++) {
      const buttons = [...document.querySelectorAll('button[aria-label=${JSON.stringify(label)}]')].filter(b => b.offsetParent !== null)
      if (buttons.length !== 1) throw new Error(${JSON.stringify(`expected one visible button labelled ${label}, found `)} + buttons.length)
      times.push(Date.now())
      buttons[0].click()
      await new Promise(resolve => setTimeout(resolve, ${intervalMs}))
    }
    return times
  })()`) as number[]
}

function landingsOf(kind: Kind, intervalMs: number, clicks: { at: number, step: number }[], endAt: number, calls: ListCall[], samples: Sample[]): Landing[] {
  return clicks.map((click, i) => {
    const end = clicks[i + 1]?.at ?? endAt
    const arrival = firstArrival(calls, landingInstant(kind, click.step))
    const until = Math.min(end, arrival ?? end)
    const frames = samples.filter(s => s.t >= click.at && s.t < until)
    return {
      kind,
      intervalMs,
      step: click.step,
      clickAt: click.at,
      endAt: end,
      waitMs: arrival === null ? null : Math.max(0, arrival - click.at),
      passedThrough: arrival === null || arrival > end,
      falseEmptyFrames: frames.filter(s => s.noEvents + s.noMeetings > 0).length,
      skeletonFrames: frames.filter(s => s.skeletons > 0).length,
      busyMissingFrames: frames.filter(s => s.skeletons > 0 && s.busy === 0).length,
    }
  })
}

async function measure(browser: Browser, state: StorageState, kind: Kind, intervalMs: number, drift: string[]) {
  const { context, page, tracker } = await openPage(browser, state, NAV[kind].path, drift)
  const callsBefore = tracker.calls.length
  await startSampling(page)
  const steps = STEPS[kind]
  const forward = await clickSeries(page, NAV[kind].next, steps, intervalMs)
  await waitFor(() => firstArrival(tracker.calls, landingInstant(kind, steps)) !== null, 15_000, `step ${steps} rows`)
  const back = await clickSeries(page, NAV[kind].previous, steps, intervalMs)
  await waitFor(() => firstArrival(tracker.calls, landingInstant(kind, 0)) !== null, 15_000, 'step 0 rows')
  await sleep(500)
  const endAt = Date.now()
  const samples = await stopSampling(page)
  const clicks = [...forward.map((at, i) => ({ at, step: i + 1 })), ...back.map((at, i) => ({ at, step: steps - 1 - i }))]
  const runCalls = calendarCalls(tracker.calls.slice(callsBefore))
  await context.close()
  return {
    landings: landingsOf(kind, intervalMs, clicks, endAt, tracker.calls, samples),
    reads: runCalls.length,
    batches: new Set(runCalls.map(c => c.batch)).size,
  }
}

async function runMeasurement(browser: Browser, state: StorageState, mode: 'baseline' | 'after'): Promise<void> {
  const drift: string[] = []
  const results = []
  for (const kind of ['schedule', 'dashboard'] as const) {
    for (const intervalMs of INTERVALS) {
      results.push(await measure(browser, state, kind, intervalMs, drift))
    }
  }
  const summary = results.map((r) => {
    const landed = r.landings.filter(l => !l.passedThrough)
    const waits = landed.map(l => l.waitMs ?? 0)
    return {
      page: r.landings[0].kind,
      intervalMs: r.landings[0].intervalMs,
      landings: r.landings.length,
      passedThrough: r.landings.length - landed.length,
      meanWaitMs: Math.round(waits.reduce((a, b) => a + b, 0) / Math.max(1, waits.length)),
      maxWaitMs: Math.max(0, ...waits),
      landingsWithFalseEmpty: r.landings.filter(l => l.falseEmptyFrames > 0).length,
      landingsWithSkeletons: r.landings.filter(l => l.skeletonFrames > 0).length,
      reads: r.reads,
      batches: r.batches,
    }
  })
  console.table(summary)
  fs.writeFileSync(`${DIR}/${mode}.json`, JSON.stringify({ at: new Date().toISOString(), summary, results, drift }, null, 2))
  console.log(`wrote ${DIR}/${mode}.json${drift.length > 0 ? ` (${drift.length} prefetch-drift errors)` : ''}`)
}

async function checkSchedule(browser: Browser, state: StorageState, failures: string[], drift: string[]): Promise<void> {
  // Fast week steps never state "No events" before their rows arrive, and skeleton frames are aria-busy.
  const run = await measure(browser, state, 'schedule', 150, drift)
  const lying = run.landings.filter(l => l.falseEmptyFrames > 0)
  if (lying.length > 0) {
    failures.push(`schedule: ${lying.length}/${run.landings.length} fast steps showed "No events" before their rows arrived`)
  }
  if (run.landings.some(l => l.busyMissingFrames > 0)) {
    failures.push('schedule: skeleton frames without aria-busy')
  }
  console.log(`schedule: ${run.landings.filter(l => l.skeletonFrames > 0).length}/${run.landings.length} fast steps drew skeletons while loading`)

  // A6: a committed search and a filter change show skeletons, never "No events", until their rows arrive.
  const { context, page, tracker } = await openPage(browser, state, NAV.schedule.path, drift)
  await startSampling(page)
  const searchFrom = tracker.calls.length
  await page.getByPlaceholder('Search by customer or type…').fill('zz')
  await waitFor(() => tracker.calls.slice(searchFrom).some(c => c.search === 'zz' && c.respondedAt !== undefined), 15_000, 'the search read')
  const filterFrom = tracker.calls.length
  await page.getByRole('button', { name: 'Filters', exact: true }).click()
  await page.getByRole('dialog').getByRole('combobox').first().click()
  await page.getByRole('option').first().click()
  await page.keyboard.press('Escape')
  await waitFor(() => tracker.calls.slice(filterFrom).some(c => c.filterKeys.length > 1 && c.respondedAt !== undefined), 15_000, 'the filter read')
  const samples = await stopSampling(page)
  const changes = [
    { label: 'search', call: tracker.calls.slice(searchFrom).find(c => c.search === 'zz') },
    { label: 'filter', call: tracker.calls.slice(filterFrom).find(c => c.filterKeys.length > 1) },
  ]
  for (const { label, call } of changes) {
    const frames = samples.filter(s => call && s.t >= call.requestedAt && s.t < (call.respondedAt ?? 0))
    if (frames.some(s => s.noEvents > 0)) {
      failures.push(`schedule A6: "No events" showed while the ${label} read was loading`)
    }
    console.log(`schedule A6 ${label}: ${frames.filter(s => s.skeletons > 0).length}/${frames.length} loading frames drew skeletons`)
  }

  // A read that fails on a window nobody prefetched ends on the error state, not endless skeletons.
  await settle(tracker.calls)
  await page.route(isListRead, route => route.abort())
  await clickSeries(page, NAV.schedule.next, 3, 800)
  const errorShown = await waitFor(async () => (await page.getByText('Could not load schedule').count()) > 0, 15_000, 'the schedule error state').then(() => true, () => false)
  if (!errorShown) {
    failures.push('schedule: a failed read never reached the error state')
  }
  else if (await page.locator('[data-slot="skeleton"]').count() > 0) {
    failures.push('schedule: skeletons still on screen beside the error state')
  }
  await page.unroute(isListRead)
  await context.close()
}

/** The day the dashboard agenda should show: the picked day while the anchor's month grid holds it, else the anchor. */
function expectShown(anchor: string, picked: string): string {
  const grid = businessMonthGridWindow(anchor)
  const first = businessDayKey(new Date(grid.from))
  const last = addCalendarDays(businessDayKey(new Date(grid.to)), -1)
  return picked >= first && picked <= last ? picked : anchor
}

async function checkDashboard(browser: Browser, state: StorageState, failures: string[], drift: string[]): Promise<void> {
  // The calendar reads the whole month grid, live outcomes only, and outside days with meetings get a dot.
  {
    const { context, page, tracker } = await openPage(browser, state, NAV.dashboard.path, drift)
    await page.getByRole('button', { name: NAV.dashboard.next }).click()
    const instant = landingInstant('dashboard', 1)
    await waitFor(() => firstArrival(tracker.calls, instant) !== null, 15_000, 'next month rows')
    await sleep(500)
    const call = calendarCalls(tracker.calls).find(c => !c.failed && c.rows && c.from <= instant && instant <= c.to)
    const grid = toInclusiveRange(businessMonthGridWindow(monthDay(1, 1)))
    if (!call || call.from !== grid.from || call.to !== grid.to) {
      failures.push(`dashboard: next month read covers ${call?.from}..${call?.to}, not the month grid ${grid.from}..${grid.to}`)
    }
    const liveOutcomes: string[] = LIVE_MEETING_OUTCOMES
    const dead = (call?.rows ?? []).filter(r => !liveOutcomes.includes(r.meetingOutcome))
    if (dead.length > 0) {
      failures.push(`dashboard: ${dead.length} rows with an outcome that isn't live`)
    }
    const month = monthDay(1, 1).slice(0, 7)
    const outsideDays = [...new Set((call?.rows ?? []).map(r => businessDayKey(new Date(r.scheduledFor))).filter(day => day.slice(0, 7) !== month))]
    for (const day of outsideDays) {
      const text = await page.locator(`[role="gridcell"][data-day="${day}"]`).textContent()
      if (!text?.includes('has meetings')) {
        failures.push(`dashboard: outside day ${day} has meetings but no dot`)
      }
    }
    console.log(`dashboard: ${outsideDays.length} outside days with meetings checked for a dot`)
    await context.close()
  }

  // A7: the agenda never lists a day the loaded grid doesn't cover (fresh load, Previous, Back, outside-day pick).
  {
    const target = monthDay(2, 1)
    const { context, page } = await openPage(browser, state, `${NAV.dashboard.path}?dm_d=${target}`, drift)
    const selected = () => page.locator('[role="gridcell"][data-selected="true"]').getAttribute('data-day')
    const expectSelected = async (want: string, when: string) => {
      await waitFor(async () => (await selected()) === want, 5000, `selected day ${want}`).catch(async () => {
        failures.push(`dashboard A7 ${when}: selected ${await selected()}, expected ${want}`)
      })
    }
    await expectSelected(expectShown(target, TODAY), 'on a fresh load two months ahead')
    await page.getByRole('button', { name: NAV.dashboard.previous }).click()
    await expectSelected(expectShown(monthDay(1, 1), TODAY), 'after Previous')
    await page.goBack()
    await expectSelected(expectShown(target, TODAY), 'after Back')
    if (!page.url().includes(`dm_d=${target}`)) {
      failures.push(`dashboard A7: Back left the URL at ${page.url()}`)
    }
    const outside = await page.locator('[role="gridcell"][data-outside="true"]').last().getAttribute('data-day')
    if (outside) {
      await page.locator(`[role="gridcell"][data-day="${outside}"] button`).click()
      await expectSelected(outside, 'after picking an outside day')
      await page.getByRole('button', { name: NAV.dashboard.next }).click()
      await expectSelected(expectShown(monthDay(3, 1), outside), 'after stepping to the next month')
    }
    await context.close()
  }

  // A8: a failed read shows the error line, never "No meetings on …", and Try again recovers.
  {
    const { context, page } = await openPage(browser, state, NAV.dashboard.path, drift)
    await page.route(isListRead, route => route.abort())
    await startSampling(page)
    const clicks = await clickSeries(page, NAV.dashboard.next, 3, 800)
    const errorShown = await waitFor(async () => (await page.getByText('Could not load meetings.').count()) > 0, 15_000, 'the dashboard error line').then(() => true, () => false)
    const samples = await stopSampling(page)
    if (!errorShown) {
      failures.push('dashboard A8: no error line after a failed read')
    }
    const lying = samples.filter(s => s.t >= clicks[2] && s.noMeetings > 0).length
    if (lying > 0) {
      failures.push(`dashboard A8: "No meetings on …" showed for ${lying} frames while the read was failing`)
    }
    await page.unroute(isListRead)
    if (errorShown) {
      await page.getByRole('button', { name: 'Try again' }).click()
      await waitFor(async () => (await page.getByText('Could not load meetings.').count()) === 0, 15_000, 'Try again to clear the error')
        .catch(() => failures.push('dashboard A8: Try again did not recover'))
    }
    await context.close()
  }
}

async function shots(browser: Browser, state: StorageState): Promise<void> {
  const drift: string[] = []
  const views = [
    { name: 'week', path: '/dashboard/schedule', next: 'Next' },
    { name: 'day', path: '/dashboard/schedule?s_v=today', next: 'Next' },
    { name: 'month', path: '/dashboard/schedule?s_v=month', next: 'Next' },
    { name: 'dashboard', path: '/dashboard', next: 'Go to the Next Month' },
  ]
  for (const colorScheme of ['light', 'dark'] as const) {
    for (const view of views) {
      const { context, page } = await openPage(browser, state, view.path, drift, colorScheme)
      // Holds every list read for 5s, so the third step (outside the ±2 prefetch) sits in its pending state.
      await page.route(isListRead, async (route) => {
        await sleep(5000)
        await route.continue()
      })
      await clickSeries(page, view.next, 3, 400)
      await sleep(600)
      await page.screenshot({ path: `${DIR}/pending-${view.name}-${colorScheme}.png` })
      await context.close()
    }
  }
  console.log(`wrote ${DIR}/pending-*.png`)
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? ''
  if (!['baseline', 'after', 'checks:schedule', 'checks:dashboard', 'shots'].includes(mode)) {
    throw new Error('usage: harness.ts baseline | after | checks:schedule | checks:dashboard | shots')
  }
  const browser = await chromium.launch({ headless: true })
  try {
    const state = await signedInState(browser)
    if (mode === 'baseline' || mode === 'after') {
      await runMeasurement(browser, state, mode)
      return
    }
    if (mode === 'shots') {
      await shots(browser, state)
      return
    }
    const failures: string[] = []
    const drift: string[] = []
    if (mode === 'checks:schedule') {
      await checkSchedule(browser, state, failures, drift)
    }
    else {
      await checkDashboard(browser, state, failures, drift)
    }
    failures.push(...drift.map(d => `prefetch drift: ${d}`))
    fs.writeFileSync(`${DIR}/${mode.replace(':', '-')}.json`, JSON.stringify({ at: new Date().toISOString(), failures }, null, 2))
    if (failures.length > 0) {
      console.error(`FAIL (${failures.length})\n- ${failures.join('\n- ')}`)
      process.exitCode = 1
    }
    else {
      console.log(`PASS ${mode}`)
    }
  }
  finally {
    await browser.close()
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
```

- [ ] **Step 3: Record the baseline**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts baseline`
Expected: a `console.table` with six rows (schedule and dashboard, at 150, 300 and 600ms) and `wrote .superpowers/sdd/2026-09-29-data-view-date-windows/baseline.json`. At 150ms, schedule `landingsWithFalseEmpty` is expected to be above 0; that's the bug this plan fixes. If the run throws, fix the harness (selectors, timing), not the app, and rerun until it completes.

- [ ] **Step 4: Confirm the dashboard checks fail today**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:dashboard`
Expected: `FAIL`, including at least `dashboard: next month read covers … not the month grid` and `dashboard A7 on a fresh load two months ahead`. This is Task 6's red. Don't run `checks:schedule` yet: its failed-read step assumes the ±2 prefetch from Task 2.

No commit: everything here is gitignored.

---

### Task 2: Prefetch radius ±2 for date windows

**Files:**
- Modify: `src/shared/dal/lib/query/constants.ts`
- Modify: `src/shared/dal/lib/query/adjacent-windows.ts` (whole file)
- Create (throwaway): `.superpowers/sdd/2026-09-29-data-view-date-windows/check-adjacent-windows.ts`

**Interfaces:**
- Produces: `ADJACENT_WINDOW_RADIUS: { readonly page: 1, readonly date: 2 }` in `@/shared/dal/lib/query/constants`. `adjacentDataViewWindows(urlState, config): DataViewWindowState[]` keeps its signature; it now returns up to 4 date windows, nearest first.

- [ ] **Step 1: Write the failing check**

Create `.superpowers/sdd/2026-09-29-data-view-date-windows/check-adjacent-windows.ts`:

```ts
import type { DataViewQueryConfig, DataViewWindowState } from '@/shared/dal/lib/query/data-view-query-config'

import assert from 'node:assert/strict'

import { SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { adjacentDataViewWindows } from '@/shared/dal/lib/query/adjacent-windows'
import { MAX_PAGE } from '@/shared/dal/lib/query/constants'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
import { businessDayWindow, businessMonthGridWindow, businessWeekWindow, toInclusiveRange } from '@/shared/lib/business-time'

type DateWindow = Extract<DataViewWindowState, { kind: 'date' }>

const TABLE = {
  fields: MEETING_FIELDS,
  paramPrefix: 't',
  toolbar: [],
  window: { kind: 'page', pageSize: 20, pageSizeOptions: [20] },
} as const satisfies DataViewQueryConfig<typeof MEETING_FIELDS>

const KANBAN = { fields: MEETING_FIELDS, paramPrefix: 'k', toolbar: [], window: { kind: 'whole-list' } } as const satisfies DataViewQueryConfig<typeof MEETING_FIELDS>

function dateWindows(view: 'today' | 'week' | 'month', anchor: string): DateWindow[] {
  return adjacentDataViewWindows({ s_d: anchor, s_v: view }, SCHEDULE_MEETINGS_QUERY).map((w) => {
    if (w.kind !== 'date') {
      throw new Error(`expected a date window, got ${w.kind}`)
    }
    return w
  })
}

function expectSteps(view: 'today' | 'week' | 'month', anchor: string, expected: string[], windowOf: (day: string) => { from: string, to: string }) {
  const windows = dateWindows(view, anchor)
  assert.deepEqual(windows.map(w => w.anchor), expected, `${view} from ${anchor}: -1, +1, -2, +2`)
  windows.forEach((w, i) => assert.deepEqual(w.range, toInclusiveRange(windowOf(expected[i])), `${view} from ${anchor}: range of ${expected[i]}`))
}

expectSteps('week', '2026-10-07', ['2026-09-30', '2026-10-14', '2026-09-23', '2026-10-21'], businessWeekWindow)

// DST: spring forward on Sun 2026-03-08, fall back on Sun 2026-11-01. Each day still starts at Pacific midnight.
expectSteps('today', '2026-03-08', ['2026-03-07', '2026-03-09', '2026-03-06', '2026-03-10'], businessDayWindow)
assert.equal(dateWindows('today', '2026-03-08')[0].range.from, '2026-03-07T08:00:00.000Z', 'PST midnight before the switch')
assert.equal(dateWindows('today', '2026-03-08')[1].range.from, '2026-03-09T07:00:00.000Z', 'PDT midnight after the switch')
expectSteps('today', '2026-11-01', ['2026-10-31', '2026-11-02', '2026-10-30', '2026-11-03'], businessDayWindow)
expectSteps('week', '2026-03-08', ['2026-03-01', '2026-03-15', '2026-02-22', '2026-03-22'], businessWeekWindow)

// Months: a year edge, and anchors on the 31st that must not skip or repeat a month.
expectSteps('month', '2026-12-15', ['2026-11-01', '2027-01-01', '2026-10-01', '2027-02-01'], businessMonthGridWindow)
expectSteps('month', '2026-01-31', ['2025-12-01', '2026-02-01', '2025-11-01', '2026-03-01'], businessMonthGridWindow)
expectSteps('month', '2026-03-31', ['2026-02-01', '2026-04-01', '2026-01-01', '2026-05-01'], businessMonthGridWindow)

// Pages keep ±1, clipped to [1, MAX_PAGE].
const pages = (page: number) => adjacentDataViewWindows({ t_p: page }, TABLE).map(w => (w.kind === 'page' ? w.page : Number.NaN))
assert.deepEqual(pages(1), [2], 'page 1 has no previous page')
assert.deepEqual(pages(2), [1, 3], 'page 2 has both neighbours')
assert.deepEqual(pages(MAX_PAGE), [MAX_PAGE - 1], 'the last page has no next page')

assert.deepEqual(adjacentDataViewWindows({}, KANBAN), [], 'a whole-list view has no neighbours')

console.log('adjacent windows ✓')
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/check-adjacent-windows.ts`
Expected: `AssertionError … week from 2026-10-07: -1, +1, -2, +2`, because today's code returns two anchors, not four.

- [ ] **Step 3: Add the radius constant**

In `src/shared/dal/lib/query/constants.ts`, add after the `MAX_PAGE` declaration:

```ts
/** How many windows either side of the current one `useDataViewQuery` prefetches, per window kind. */
export const ADJACENT_WINDOW_RADIUS = { page: 1, date: 2 } as const
```

- [ ] **Step 4: Rewrite `adjacent-windows.ts`**

Replace the whole of `src/shared/dal/lib/query/adjacent-windows.ts` with:

```ts
import type { CalendarViewType } from '@/shared/constants/enums'
import type { DataViewQueryConfig, DataViewWindowState } from '@/shared/dal/lib/query/data-view-query-config'
import type { FieldList } from '@/shared/dal/lib/query/field-list'

import { ADJACENT_WINDOW_RADIUS, MAX_PAGE } from '@/shared/dal/lib/query/constants'
import { dataViewUrlKeys, deriveDataViewWindow } from '@/shared/dal/lib/query/derive-data-view-input'
import { addCalendarDays } from '@/shared/lib/business-time'

function stepAnchor(anchor: string, view: CalendarViewType, step: number): string {
  switch (view) {
    case 'today':
      return addCalendarDays(anchor, step)
    case 'week':
      return addCalendarDays(anchor, 7 * step)
    case 'month': {
      // Any day of a month derives the same month grid, so its 1st stands in for it; stepping the 31st would skip short months.
      const [year, month] = anchor.split('-').map(Number)
      return new Date(Date.UTC(year, month - 1 + step, 1)).toISOString().slice(0, 10)
    }
  }
}

/** `-1, +1, -2, +2, …` out to `radius`: nearest first, so the likeliest next windows are requested first. */
function stepsWithin(radius: number): number[] {
  return Array.from({ length: radius }, (_, i) => [-(i + 1), i + 1]).flat()
}

/**
 * The windows around the current one, nearest first: pages within `ADJACENT_WINDOW_RADIUS.page`, or days, weeks
 * or months within `ADJACENT_WINDOW_RADIUS.date`. Each is derived from URL state the way navigating there would
 * write it, so a prefetched window's read input is the one the view asks for on arrival. A whole-list view has none.
 */
export function adjacentDataViewWindows<F extends FieldList>(urlState: Record<string, unknown>, config: DataViewQueryConfig<F>): DataViewWindowState[] {
  const keys = dataViewUrlKeys(config.paramPrefix)
  const current = deriveDataViewWindow(urlState, config)
  switch (current.kind) {
    case 'page':
      return stepsWithin(ADJACENT_WINDOW_RADIUS.page)
        .map(step => current.page + step)
        .filter(page => page >= 1 && page <= MAX_PAGE)
        .map(page => deriveDataViewWindow({ ...urlState, [keys.pageKey]: page }, config))
    case 'date':
      return stepsWithin(ADJACENT_WINDOW_RADIUS.date).map(step =>
        deriveDataViewWindow({ ...urlState, [keys.anchorKey]: stepAnchor(current.anchor, current.view, step) }, config),
      )
    case 'whole-list':
      return []
  }
}
```

- [ ] **Step 5: Run the check and watch it pass**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/check-adjacent-windows.ts`
Expected: `adjacent windows ✓`

- [ ] **Step 6: Type-check and lint**

Run: `pnpm exec eslint --fix src/shared/dal/lib/query/constants.ts src/shared/dal/lib/query/adjacent-windows.ts && pnpm tsc && pnpm lint`
Expected: no errors. Warnings in files you didn't touch are fine.

- [ ] **Step 7: Commit**

```bash
git commit -m "perf(data-view): prefetch date windows two either side, nearest first

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/dal/lib/query/constants.ts src/shared/dal/lib/query/adjacent-windows.ts
git show --stat HEAD
```
Expected: exactly those two files in the commit.

---

### Task 3: Pending flag and schedule skeletons

**Files:**
- Modify: `src/shared/dal/client/lib/types.ts` (`DateWindowControls`)
- Modify: `src/shared/dal/client/hooks/use-data-view-query.ts`
- Modify: `src/shared/components/query-toolbar/ui/row-cap-notice.tsx`
- Modify: `src/features/schedule-management/constants/schedule-queries.ts` (`SCHEDULE_PENDING_SKELETONS`)
- Create: `src/features/schedule-management/ui/components/schedule-card-skeleton.tsx`
- Modify: `src/features/schedule-management/ui/components/schedule-calendar.tsx`
- Modify: `src/features/schedule-management/ui/components/schedule-week-view.tsx`
- Modify: `src/features/schedule-management/ui/components/schedule-today-view.tsx`
- Modify: `src/shared/components/calendar/ui/calendar-month-view.tsx`

**Interfaces:**
- Consumes: Task 2's ±2 prefetch (the check's failed-read step relies on it).
- Produces: `DateWindowControls.isPending: boolean`, which `useDataViewQuery` sets for every date window (Task 6 reads it as `query.window.isPending`). `SCHEDULE_PENDING_SKELETONS = 2`. `ScheduleCardSkeleton(): JSX.Element` with no props. `ScheduleWeekView`, `ScheduleTodayView` and `CalendarMonthView` take an `isPending` prop (required on the two schedule views, optional on the shared month view).

- [ ] **Step 1: Run the schedule check and watch it fail**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:schedule`
Expected: `FAIL`, with at least one of `schedule: n/10 fast steps showed "No events" before their rows arrived` or `schedule A6: "No events" showed while the search read was loading`. If it prints `PASS`, the dev data or timing hides the bug. Report that before going on; don't weaken the check.

- [ ] **Step 2: Add `isPending` to `DateWindowControls`**

In `src/shared/dal/client/lib/types.ts`, inside `interface DateWindowControls`, add after `cap: number`:

```ts
  /**
   * True while this window's own rows haven't arrived: the first load, or `keepPreviousData` holding another key's
   * rows after a window step, a filter or a search. False after an error, so the error state shows. Not TanStack's
   * query-level `isPending`.
   */
  isPending: boolean
```

- [ ] **Step 3: Set it in `useDataViewQuery`**

In `src/shared/dal/client/hooks/use-data-view-query.ts`, replace the `windowControls` block:

```ts
  const windowControls = useMemo((): DataViewWindowControls => {
    switch (windowState.kind) {
      case 'page':
        return { kind: 'page', page: windowState.page, pageSize: windowState.pageSize, pageSizeOptions: windowState.pageSizeOptions, pageCount, setPage, setPageSize }
      case 'date':
        return { kind: 'date', anchor: windowState.anchor, view: windowState.view, range: windowState.range, cap: windowState.cap, setAnchor, setView }
      case 'whole-list':
        return { kind: 'whole-list' }
    }
  }, [windowState, pageCount, setPage, setPageSize, setAnchor, setView])
```

with:

```ts
  // Another key's rows would land on the wrong days, so date views draw skeletons until this key's rows arrive.
  const isWindowPending = result.isLoading || result.isPlaceholderData

  const windowControls = useMemo((): DataViewWindowControls => {
    switch (windowState.kind) {
      case 'page':
        return { kind: 'page', page: windowState.page, pageSize: windowState.pageSize, pageSizeOptions: windowState.pageSizeOptions, pageCount, setPage, setPageSize }
      case 'date':
        return { kind: 'date', anchor: windowState.anchor, view: windowState.view, range: windowState.range, cap: windowState.cap, isPending: isWindowPending, setAnchor, setView }
      case 'whole-list':
        return { kind: 'whole-list' }
    }
  }, [windowState, pageCount, setPage, setPageSize, setAnchor, setView, isWindowPending])
```

- [ ] **Step 4: Hide the row-cap notice while pending**

In `src/shared/components/query-toolbar/ui/row-cap-notice.tsx`, replace:

```tsx
  if (query.window.kind !== 'date' || query.total <= query.window.cap) {
```

with:

```tsx
  // While pending, `total` still counts the previous key's rows.
  if (query.window.kind !== 'date' || query.window.isPending || query.total <= query.window.cap) {
```

- [ ] **Step 5: Add the skeleton count constant**

In `src/features/schedule-management/constants/schedule-queries.ts`, add after `SCHEDULE_ROW_CAP`:

```ts
/** Skeleton cards per day column (week view) and placeholder lanes (day view) while a window's rows load. */
export const SCHEDULE_PENDING_SKELETONS = 2
```

- [ ] **Step 6: Create `ScheduleCardSkeleton`**

Create `src/features/schedule-management/ui/components/schedule-card-skeleton.tsx`. It has the same surface as `MeetingCard` and one bar per card row: name, time and outcome, participants, phone, address.

```tsx
import { Skeleton } from '@/shared/components/ui/skeleton'

export function ScheduleCardSkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-2 rounded-md border bg-card p-3 pl-3.5 shadow-sm">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  )
}
```

- [ ] **Step 7: `ScheduleCalendar` hands no events and passes the flag**

In `src/features/schedule-management/ui/components/schedule-calendar.tsx`:

Replace `const { anchor, view, setAnchor } = dateWindow` with:

```tsx
  const { anchor, view, isPending, setAnchor } = dateWindow
```

Add, after the `currentDate` memo:

```tsx
  // Rows from another key would land on the wrong days; the views draw skeletons instead.
  const visibleEvents = useMemo(() => (isPending ? [] : events), [isPending, events])
```

Replace the three view branches with:

```tsx
        {view === 'today' && (
          <ScheduleTodayView events={visibleEvents} currentDate={currentDate} isPending={isPending} renderCard={renderCard} />
        )}
        {view === 'week' && (
          <ScheduleWeekView events={visibleEvents} currentDate={currentDate} hiddenDays={hiddenDays} isPending={isPending} renderCard={renderCard} />
        )}
        {view === 'month' && (
          <CalendarMonthView events={visibleEvents} currentDate={currentDate} isPending={isPending} renderCompact={renderCompact} />
        )}
```

- [ ] **Step 8: Week view skeletons**

In `src/features/schedule-management/ui/components/schedule-week-view.tsx`:

Add imports (keep the file's import grouping):

```tsx
import { SCHEDULE_PENDING_SKELETONS } from '@/features/schedule-management/constants/schedule-queries'

import { ScheduleCardSkeleton } from './schedule-card-skeleton'
```

Add `isPending: boolean` to `ScheduleWeekViewProps` (after `hiddenDays`) and to the destructured props.

Replace the root opening tag `<div ref={scrollRef} className="h-full overflow-x-auto">` with:

```tsx
    <div ref={scrollRef} className="h-full overflow-x-auto" aria-busy={isPending || undefined}>
```

Inside each day column, replace:

```tsx
                {sorted.length === 0 && (
```

with:

```tsx
                {isPending && Array.from({ length: SCHEDULE_PENDING_SKELETONS }).map((_, i) => (
                  <ScheduleCardSkeleton
                    // eslint-disable-next-line react/no-array-index-key
                    key={i}
                  />
                ))}
                {!isPending && sorted.length === 0 && (
```

- [ ] **Step 9: Day view skeleton lanes**

In `src/features/schedule-management/ui/components/schedule-today-view.tsx`:

Add imports:

```tsx
import { SCHEDULE_PENDING_SKELETONS } from '@/features/schedule-management/constants/schedule-queries'
import { Skeleton } from '@/shared/components/ui/skeleton'

import { ScheduleCardSkeleton } from './schedule-card-skeleton'
```

Add `isPending: boolean` to `ScheduleTodayViewProps` (after `currentDate`) and to the destructured props.

Replace `if (combos.length === 0) {` with:

```tsx
  if (!isPending && combos.length === 0) {
```

Replace `<ScrollAreaPrimitive.Root className="relative h-full" type="always">` with:

```tsx
    <ScrollAreaPrimitive.Root className="relative h-full" type="always" aria-busy={isPending || undefined}>
```

Replace the swimlane block:

```tsx
          {combos.map(combo => (
            <SwimlaneRow
              key={combo.key}
              combo={combo}
              comboEvents={eventsByCombo.get(combo.key) ?? []}
              renderCard={renderCard}
              collapsed={collapsed}
              gridCols={gridCols}
            />
          ))}
```

with:

```tsx
          {isPending
            ? Array.from({ length: SCHEDULE_PENDING_SKELETONS }).map((_, lane) => (
                <motion.div
                  // eslint-disable-next-line react/no-array-index-key
                  key={lane}
                  className="grid border-b border-dashed"
                  initial={false}
                  animate={{ gridTemplateColumns: gridCols }}
                  transition={TRANSITION}
                >
                  <div className="sticky left-0 z-10 flex items-center gap-2 overflow-hidden border-r bg-background px-3 py-3">
                    <Skeleton className="size-6 shrink-0 rounded-full" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                  {TODAY_VIEW_BUCKETS.map(bucket => (
                    <div key={bucket.id} className="min-h-24 border-r p-1.5 last:border-r-0">
                      <ScheduleCardSkeleton />
                    </div>
                  ))}
                </motion.div>
              ))
            : combos.map(combo => (
                <SwimlaneRow
                  key={combo.key}
                  combo={combo}
                  comboEvents={eventsByCombo.get(combo.key) ?? []}
                  renderCard={renderCard}
                  collapsed={collapsed}
                  gridCols={gridCols}
                />
              ))}
```

- [ ] **Step 10: Month view skeleton lines**

In `src/shared/components/calendar/ui/calendar-month-view.tsx`:

Add the import `import { Skeleton } from '@/shared/components/ui/skeleton'`.

Add to `Props<T>` (after `currentDate`):

```tsx
  /** While a window loads, each cell shows one skeleton line in place of its events. */
  isPending?: boolean
```

Add `isPending = false,` to the destructured props (after `currentDate,`).

Replace the root `<div>` (the one wrapping the day-of-week header) with `<div aria-busy={isPending || undefined}>`.

Inside the events container, replace:

```tsx
                {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map(event => (
                  <div key={event.id} className="w-full text-left">
                    {renderCompact(event)}
                  </div>
                ))}

                {overflowCount > 0 && cell.currentMonth && (
                  <span className="px-1 text-xs font-semibold text-muted-foreground">
                    +
                    {overflowCount}
                    {' '}
                    more
                  </span>
                )}
```

with:

```tsx
                {isPending
                  ? <Skeleton className="h-4 w-full" />
                  : (
                      <>
                        {dayEvents.slice(0, MAX_VISIBLE_EVENTS).map(event => (
                          <div key={event.id} className="w-full text-left">
                            {renderCompact(event)}
                          </div>
                        ))}

                        {overflowCount > 0 && cell.currentMonth && (
                          <span className="px-1 text-xs font-semibold text-muted-foreground">
                            +
                            {overflowCount}
                            {' '}
                            more
                          </span>
                        )}
                      </>
                    )}
```

- [ ] **Step 11: Type-check and lint**

Run:
```bash
pnpm exec eslint --fix src/shared/dal/client/lib/types.ts src/shared/dal/client/hooks/use-data-view-query.ts src/shared/components/query-toolbar/ui/row-cap-notice.tsx src/features/schedule-management/constants/schedule-queries.ts src/features/schedule-management/ui/components/schedule-card-skeleton.tsx src/features/schedule-management/ui/components/schedule-calendar.tsx src/features/schedule-management/ui/components/schedule-week-view.tsx src/features/schedule-management/ui/components/schedule-today-view.tsx src/shared/components/calendar/ui/calendar-month-view.tsx
pnpm tsc && pnpm lint
```
Expected: no errors. `DateWindowControls` has one constructor (the hook), so nothing else needs the new field.

- [ ] **Step 12: Run the schedule check and watch it pass**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:schedule`
Expected: `PASS checks:schedule`. The log lines should report skeleton frames for the search and filter reads. If a line says `0/0 loading frames`, the read landed within one frame; that's still a pass.

- [ ] **Step 13: Commit**

```bash
git add -- src/features/schedule-management/ui/components/schedule-card-skeleton.tsx
git commit -m "feat(schedule): skeletons while a date window's rows load, never another key's rows or \"No events\"

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/dal/client/lib/types.ts src/shared/dal/client/hooks/use-data-view-query.ts src/shared/components/query-toolbar/ui/row-cap-notice.tsx src/features/schedule-management/constants/schedule-queries.ts src/features/schedule-management/ui/components/schedule-card-skeleton.tsx src/features/schedule-management/ui/components/schedule-calendar.tsx src/features/schedule-management/ui/components/schedule-week-view.tsx src/features/schedule-management/ui/components/schedule-today-view.tsx src/shared/components/calendar/ui/calendar-month-view.tsx
git show --stat HEAD
```
Expected: exactly those nine files.

---

### Task 4: Allowed calendar views per data view

**Files:**
- Modify: `src/shared/dal/lib/query/data-view-query-config.ts`
- Modify: `src/shared/dal/lib/query/derive-data-view-input.ts`
- Modify: `src/shared/dal/client/hooks/use-data-view-query.ts` (`setView`)
- Modify: `src/features/schedule-management/constants/schedule-queries.ts` (both configs)
- Create (throwaway): `.superpowers/sdd/2026-09-29-data-view-date-windows/check-views.ts`

**Interfaces:**
- Produces: `DataViewWindow` date kind `{ kind: 'date', field, cap, views: readonly [CalendarViewType, ...CalendarViewType[]] }`, where the first view is the default. Task 6's dashboard config sets `views: ['month']`.

- [ ] **Step 1: Write the failing check**

Create `.superpowers/sdd/2026-09-29-data-view-date-windows/check-views.ts`:

```ts
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'

import assert from 'node:assert/strict'
import { createLoader } from 'nuqs/server'

import { SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { deriveDataViewWindow, makeDataViewParsers } from '@/shared/dal/lib/query/derive-data-view-input'
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'

const MONTH_ONLY = {
  fields: MEETING_FIELDS,
  paramPrefix: 'x',
  toolbar: [],
  window: { kind: 'date', field: 'scheduledFor', cap: 500, views: ['month'] },
} as const satisfies DataViewQueryConfig<typeof MEETING_FIELDS>

function parse(config: DataViewQueryConfig<typeof MEETING_FIELDS>, query: string): Record<string, unknown> {
  return createLoader(makeDataViewParsers(config) as never)(new URLSearchParams(query)) as Record<string, unknown>
}

function viewOf(config: DataViewQueryConfig<typeof MEETING_FIELDS>, urlState: Record<string, unknown>) {
  const window = deriveDataViewWindow(urlState, config)
  assert.equal(window.kind, 'date')
  return window.kind === 'date' ? window.view : undefined
}

// A month-only view: any other view in the URL, or garbage, reads as its default.
assert.equal(parse(MONTH_ONLY, '').x_v, 'month', 'default is the first allowed view')
assert.equal(parse(MONTH_ONLY, 'x_v=week').x_v, 'month', 'a view the config does not allow parses as the default')
assert.equal(viewOf(MONTH_ONLY, { x_d: '2026-10-07', x_v: 'week' }), 'month', 'derivation falls back to the default')
assert.equal(viewOf(MONTH_ONLY, { x_d: '2026-10-07' }), 'month', 'no view means the default')

// The schedule: all three views, week first, exactly as before.
assert.equal(parse(SCHEDULE_MEETINGS_QUERY, '').s_v, 'week', 'schedule default is week')
assert.equal(parse(SCHEDULE_MEETINGS_QUERY, 's_v=today').s_v, 'today', 'schedule allows today')
assert.equal(parse(SCHEDULE_MEETINGS_QUERY, 's_v=agenda').s_v, 'week', 'a stale view name parses as the default')
assert.equal(viewOf(SCHEDULE_MEETINGS_QUERY, { s_d: '2026-10-07', s_v: 'month' }), 'month', 'schedule allows month')
assert.equal(viewOf(SCHEDULE_MEETINGS_QUERY, { s_d: '2026-10-07', s_v: 'agenda' }), 'week', 'unparsed garbage falls back instead of crashing')

console.log('views ✓')
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/check-views.ts`
Expected: `AssertionError … a view the config does not allow parses as the default` (today's parser accepts any calendar view).

- [ ] **Step 3: Add `views` to the date window type**

In `src/shared/dal/lib/query/data-view-query-config.ts`, replace:

```ts
    | { kind: 'date', field: DateRangeFilterId<F>, cap: number }
```

with:

```ts
    // `views`: the calendar views this data view allows; the first is its default.
    | { kind: 'date', field: DateRangeFilterId<F>, cap: number, views: readonly [CalendarViewType, ...CalendarViewType[]] }
```

`CalendarViewType` is already imported in that file.

- [ ] **Step 4: Parse and derive from `views`**

In `src/shared/dal/lib/query/derive-data-view-input.ts`:

Delete the import line `import { calendarViewTypes } from '@/shared/constants/enums'` (it's unused after this step).

In `makeDataViewParsers`, replace:

```ts
    parsers[keys.viewKey] = parseAsStringLiteral(calendarViewTypes).withDefault('week')
```

with:

```ts
    parsers[keys.viewKey] = parseAsStringLiteral(config.window.views).withDefault(config.window.views[0])
```

In `deriveDataViewWindow`'s `case 'date'`, replace:

```ts
      const view = (urlState[keys.viewKey] as CalendarViewType | null) ?? 'week'
```

with:

```ts
      const allowedViews: readonly CalendarViewType[] = configWindow.views
      const requestedView = urlState[keys.viewKey] as CalendarViewType | null | undefined
      const view = requestedView && allowedViews.includes(requestedView) ? requestedView : configWindow.views[0]
```

- [ ] **Step 5: Guard `setView`**

In `src/shared/dal/client/hooks/use-data-view-query.ts`, replace:

```ts
  const setView = useCallback((view: CalendarViewType) => {
    void setUrlState({ [keys.viewKey]: view } as never, { history: 'push' })
  }, [setUrlState, keys])
```

with:

```ts
  const setView = useCallback((view: CalendarViewType) => {
    if (config.window.kind !== 'date') {
      return
    }
    const allowedViews: readonly CalendarViewType[] = config.window.views
    if (!allowedViews.includes(view)) {
      return
    }
    void setUrlState({ [keys.viewKey]: view } as never, { history: 'push' })
  }, [setUrlState, keys, config.window])
```

- [ ] **Step 6: List the schedule's views**

In `src/features/schedule-management/constants/schedule-queries.ts`, change both `window` lines to:

```ts
  window: { kind: 'date', field: 'scheduledFor', cap: SCHEDULE_ROW_CAP, views: ['week', 'today', 'month'] },
```

- [ ] **Step 7: Run both checks and watch them pass**

Run:
```bash
pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/check-views.ts
pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/check-adjacent-windows.ts
```
Expected: `views ✓` and `adjacent windows ✓`.

- [ ] **Step 8: Type-check and lint**

Run:
```bash
pnpm exec eslint --fix src/shared/dal/lib/query/data-view-query-config.ts src/shared/dal/lib/query/derive-data-view-input.ts src/shared/dal/client/hooks/use-data-view-query.ts src/features/schedule-management/constants/schedule-queries.ts
pnpm tsc && pnpm lint
```
Expected: no errors. If `tsc` reports a date-window config without `views`, run `grep -rn "kind: 'date'" src --include=*.ts --include=*.tsx`. Only the two schedule configs should declare one, so any other hit is new code from another session: STOP and report.

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(data-view): a date window lists the calendar views it allows; the first is its default

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/dal/lib/query/data-view-query-config.ts src/shared/dal/lib/query/derive-data-view-input.ts src/shared/dal/client/hooks/use-data-view-query.ts src/features/schedule-management/constants/schedule-queries.ts
git show --stat HEAD
```
Expected: exactly those four files.

---

### Task 5: `liveOnly` on the meetings list

**Files:**
- Modify: `src/trpc/routers/meetings.router/reads.router.ts`

**Interfaces:**
- Produces: `meetingsRouter.reads.list` accepts `liveOnly?: boolean` at the top level of its input. When it's true, `filters.outcome` becomes `LIVE_MEETING_OUTCOMES`, replacing any outcome filter the caller sent. Task 6 sends `{ liveOnly: true }` through `extra`.

- [ ] **Step 1: Extend the procedure**

In `src/trpc/routers/meetings.router/reads.router.ts`:

Add the import `import { LIVE_MEETING_OUTCOMES } from '@/shared/constants/enums'`.

Replace:

```ts
  list: meetingProcedure
    .input(meetingListInputSchema)
    .query(async ({ ctx, input }) => {
      return dalToTrpc(await listMeetings(ctx, input))
    }),
```

with:

```ts
  // `liveOnly` stays a top-level input and becomes a fixed filter here, so no toolbar ever shows it.
  list: meetingProcedure
    .input(meetingListInputSchema.extend({ liveOnly: z.boolean().optional() }))
    .query(async ({ ctx, input }) => {
      const { liveOnly, ...query } = input
      const filters = liveOnly ? { ...query.filters, outcome: LIVE_MEETING_OUTCOMES } : query.filters
      return dalToTrpc(await listMeetings(ctx, { ...query, filters }))
    }),
```

This mirrors `segment` in `leadSourcesRouter.getCustomers` (`src/trpc/routers/lead-sources.router.ts`, the `getCustomers` procedure).

- [ ] **Step 2: Type-check and lint**

Run: `pnpm exec eslint --fix src/trpc/routers/meetings.router/reads.router.ts && pnpm tsc && pnpm lint`
Expected: no errors. No caller sends `liveOnly` yet, so behaviour is unchanged. Task 6's `checks:dashboard` asserts the live-outcome rows in a real browser.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(meetings): liveOnly on the meetings list pins live outcomes server-side

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/trpc/routers/meetings.router/reads.router.ts
git show --stat HEAD
```
Expected: exactly that file.

---

### Task 6: Dashboard calendar on `useDataViewQuery`

**Files:**
- Modify: `src/features/agent-dashboard/constants/dashboard-queries.ts`
- Modify: `src/features/agent-dashboard/lib/meeting-windows.ts`
- Modify: `scripts/verify-analytics-rules.ts` (line 11 import, line 189 assertion)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx` (whole file)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx` (whole file)
- Modify: `src/app/(frontend)/dashboard/page.tsx` (whole file)

**Interfaces:**
- Consumes: `DateWindowControls.isPending` (Task 3), date-window `views` (Task 4), `liveOnly` (Task 5), `useDataViewQuery(procedure, extra, config)` and `loadDataViewQueryInput(searchParams, config, extra)`.
- Produces: `DASHBOARD_MEETINGS_QUERY`, `DASHBOARD_MEETINGS_EXTRA` and `DASHBOARD_LIMITS.meetingsCalendar` from `@/features/agent-dashboard/constants/dashboard-queries`. `DashboardMeetingsCalendar` props: `{ rows: MeetingListRow[], isPending: boolean, isError: boolean, onRetry: () => void, month: string, onMonthChange: (firstOfMonth: string) => void, selectedDay: string, onSelectDay: (calendarDay: string) => void }`, where `month` and `selectedDay` are `YYYY-MM-DD`.
- Deletes: `meetingsMonthInput` and `meetingMonthWindow`. Nothing may import them afterwards.

- [ ] **Step 1: Confirm the red from Task 1**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:dashboard`
Expected: `FAIL`, including `not the month grid`, `dashboard A7 on a fresh load two months ahead`, and `dashboard A8: "No meetings on …" showed`.

- [ ] **Step 2: Dashboard config, extra and cap; drop `meetingsMonthInput`**

In `src/features/agent-dashboard/constants/dashboard-queries.ts`:

Add these imports (keep the file's grouping: type imports first, then value imports):

```ts
import type { DataViewQueryConfig } from '@/shared/dal/lib/query/data-view-query-config'
```

```ts
import { MEETING_FIELDS } from '@/shared/entities/meetings/dal/meeting-fields'
```

Replace `import { meetingMonthWindow, meetingWindow } from '../lib/meeting-windows'` with:

```ts
import { meetingWindow } from '../lib/meeting-windows'
```

Replace the `DASHBOARD_LIMITS` line with:

```ts
export const DASHBOARD_LIMITS = { meetings: 8, meetingsCalendar: 500, proposals: 20, proposalsPerSection: 5, projects: 15, projectsPerSection: 5, actionQueue: 8 } as const
```

Delete the whole `meetingsMonthInput` function with its doc comment (the block starting `/** All meetings in the LA calendar month of`). In its place, add:

```ts
/** The dashboard calendar's data view: one month grid of meetings, the month in the URL (`dm_d`), no toolbar. */
export const DASHBOARD_MEETINGS_QUERY = {
  fields: MEETING_FIELDS,
  paramPrefix: 'dm',
  toolbar: [],
  defaultSort: { sortBy: 'scheduledFor', sortDir: 'asc' },
  window: { kind: 'date', field: 'scheduledFor', cap: DASHBOARD_LIMITS.meetingsCalendar, views: ['month'] },
} as const satisfies DataViewQueryConfig<typeof MEETING_FIELDS>

/** The calendar read's `extra`; the page's prefetch and the hub's hook pass this one object so their keys match. */
export const DASHBOARD_MEETINGS_EXTRA = { liveOnly: true } as const
```

- [ ] **Step 3: Delete `meetingMonthWindow`**

In `src/features/agent-dashboard/lib/meeting-windows.ts`:

Replace the import line with:

```ts
import { addCalendarDays, businessDayWindow, businessToday, toInclusiveRange } from '@/shared/lib/business-time'
```

Delete the `meetingMonthWindow` function and its doc comment (`/** LA-pinned inclusive bounds of the calendar month, …`).

- [ ] **Step 4: Drop the script's import and stale assertion**

In `scripts/verify-analytics-rules.ts`:

Delete line 11: `import { meetingMonthWindow } from '@/features/agent-dashboard/lib/meeting-windows'`.

Delete this line in section 7 (it's line 189 before the import goes). It already fails today, because it compares an inclusive range with an exclusive one:

```ts
assert.deepEqual(meetingMonthWindow('2026-03-15'), businessMonthWindow('2026-03'), 'dashboard month window is the business month window')
```

Run: `pnpm exec tsx scripts/verify-analytics-rules.ts`
Expected: ends with `✅ verify-analytics-rules passed`. It reads no database.

- [ ] **Step 5: Rewrite the hub**

Replace the whole of `src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx` with:

```tsx
'use client'

import { CalendarCheckIcon } from 'lucide-react'
import Link from 'next/link'
import { useState } from 'react'

import { DASHBOARD_MEETINGS_EXTRA, DASHBOARD_MEETINGS_QUERY } from '@/features/agent-dashboard/constants/dashboard-queries'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { businessDayKey, businessToday } from '@/shared/lib/business-time'
import { useTRPC } from '@/trpc/helpers'

import { DashboardMeetingsCalendar } from './dashboard-meetings-calendar'
import { DashboardModule } from './dashboard-module'

/**
 * Meetings module — the dashboard's focal moment. Owns the calendar's read (month in the URL as `dm_d`, so Back
 * steps months) and the picked day, so the header can carry a compact "Today" reset (an icon button beside
 * "See all →") without spending a calendar row on it.
 */
export function DashboardMeetingsHub() {
  const trpc = useTRPC()
  const query = useDataViewQuery(trpc.meetingsRouter.reads.list, DASHBOARD_MEETINGS_EXTRA, DASHBOARD_MEETINGS_QUERY)
  const { anchor, range, isPending, setAnchor } = query.window
  const [pickedDay, setPickedDay] = useState(businessToday)

  const todayKey = businessToday()
  // A fresh load or Back can land on a month whose grid doesn't hold the picked day. The agenda then lists the
  // month's anchor day instead of calling a day it never read empty.
  const shownDay = pickedDay >= businessDayKey(new Date(range.from)) && pickedDay <= businessDayKey(new Date(range.to))
    ? pickedDay
    : anchor
  const isViewingToday = shownDay === todayKey && anchor.slice(0, 7) === todayKey.slice(0, 7)

  return (
    <DashboardModule
      title="Meetings"
      action={(
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Jump to today"
            title="Today"
            disabled={isViewingToday}
            onClick={() => {
              setPickedDay(todayKey)
              setAnchor(undefined)
            }}
            className="-my-1 size-8 text-muted-foreground hover:text-primary"
          >
            <CalendarCheckIcon className="size-4" />
          </Button>
          <Link
            href={ROOTS.dashboard.meetings.root()}
            className="-my-2 -mr-2 inline-flex min-h-11 shrink-0 items-center rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors duration-200 hover:bg-accent/50 hover:text-primary"
          >
            See all →
          </Link>
        </div>
      )}
    >
      <DashboardMeetingsCalendar
        rows={query.rows}
        isPending={isPending}
        isError={query.isError}
        onRetry={() => void query.refresh()}
        month={anchor}
        onMonthChange={setAnchor}
        selectedDay={shownDay}
        onSelectDay={setPickedDay}
      />
    </DashboardModule>
  )
}
```

`range.to` is inclusive (the window's end minus 1ms), so `businessDayKey(new Date(range.to))` is the grid's last day.

- [ ] **Step 6: Rewrite the calendar**

Replace the whole of `src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx` with:

```tsx
'use client'

import type { MeetingListRow } from '@/shared/entities/meetings/dal/server/queries'

import { calendarDayToLocalDate, localDateToCalendarDay } from '@/shared/components/calendar/lib/calendar-helpers'
import { Calendar } from '@/shared/components/ui/calendar'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { businessDayKey } from '@/shared/lib/business-time'

import { CalendarMeetingDayButton } from './calendar-meeting-day-button'
import { DashboardDayAgenda } from './dashboard-day-agenda'

interface DashboardMeetingsCalendarProps {
  /** The month grid's live meetings, chronological. */
  rows: MeetingListRow[]
  /** True while `rows` belong to another month or haven't arrived: no dots, and the agenda shows a skeleton. */
  isPending: boolean
  isError: boolean
  onRetry: () => void
  /** Any `YYYY-MM-DD` in the month shown. */
  month: string
  /** Called with the 1st of the month the viewer pages to. */
  onMonthChange: (firstOfMonth: string) => void
  /** `YYYY-MM-DD` the agenda lists; the hub keeps it inside the loaded grid. */
  selectedDay: string
  onSelectDay: (calendarDay: string) => void
}

/**
 * Meetings calendar — a month `<Calendar>` (left) whose cells carry a cobalt dot on any day with ≥1 live meeting
 * (`CalendarMeetingDayButton`), beside a `<DashboardDayAgenda>` (right) listing the selected day's meetings. The
 * rows cover the whole month grid, so the outside days the picker shows get their dots too.
 */
export function DashboardMeetingsCalendar({ rows, isPending, isError, onRetry, month, onMonthChange, selectedDay, onSelectDay }: DashboardMeetingsCalendarProps) {
  const visibleRows = isPending ? [] : rows
  const daysWithMeetings = new Set(visibleRows.map(row => businessDayKey(new Date(row.scheduledFor))))
  const selectedDayRows = visibleRows.filter(row => businessDayKey(new Date(row.scheduledFor)) === selectedDay)

  return (
    <div className="flex flex-col gap-4 md:flex-row">
      <Calendar
        mode="single"
        selected={calendarDayToLocalDate(selectedDay)}
        onSelect={day => day && onSelectDay(localDateToCalendarDay(day))}
        month={calendarDayToLocalDate(month)}
        onMonthChange={next => onMonthChange(`${localDateToCalendarDay(next).slice(0, 7)}-01`)}
        // Cells are local dates and rows are keyed by Pacific day; converting the cell to Pacific would shift it a day east of California.
        modifiers={{ hasMeeting: date => daysWithMeetings.has(localDateToCalendarDay(date)) }}
        components={{ DayButton: CalendarMeetingDayButton }}
        className="w-full p-0 md:w-fit md:shrink-0 md:p-3"
        // WebKit (every iOS browser) sizes this flex column from the grid's pre-stretch
        // width, where the aspect-square cells are smaller, so the grid then overflows
        // onto the agenda. An explicit width makes it measure at its real size.
        classNames={{ root: 'w-full md:w-fit', month_grid: 'w-full md:w-auto' }}
      />
      <div className="min-w-0 flex-1" aria-busy={isPending || undefined}>
        {isError && rows.length === 0
          ? (
              <div role="alert" className="flex flex-col items-start gap-0.5 py-2">
                <p className="text-sm text-muted-foreground">Could not load meetings.</p>
                <button
                  type="button"
                  onClick={onRetry}
                  className="-mx-2 inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium text-primary transition-colors duration-200 hover:bg-accent/50"
                >
                  Try again
                </button>
              </div>
            )
          : isPending
            ? <DashboardMeetingsCalendarSkeleton />
            : <DashboardDayAgenda rows={selectedDayRows} selectedDay={calendarDayToLocalDate(selectedDay)} />}
      </div>
    </div>
  )
}

/** Dense card-shaped rows matching the agenda's resting row height while the month's rows load. */
function DashboardMeetingsCalendarSkeleton() {
  return (
    <div className="flex flex-col gap-2 py-2">
      <Skeleton className="h-16 w-full rounded-lg" />
      <Skeleton className="h-16 w-full rounded-lg" />
    </div>
  )
}
```

`DashboardMeetingsCalendarSkeleton` was already in this file. Moving it out is not part of this plan.

- [ ] **Step 7: Page prefetch through the loader**

Replace the whole of `src/app/(frontend)/dashboard/page.tsx` with:

```tsx
import type { SearchParams } from 'nuqs/server'

import { activeProjectsInput, awaitingProposalsInput, DASHBOARD_MEETINGS_EXTRA, DASHBOARD_MEETINGS_QUERY, meetingsWindowInput, onHoldProjectsInput, sentProposalsInput } from '@/features/agent-dashboard/constants/dashboard-queries'
import { DashboardView } from '@/features/agent-dashboard/ui/views/dashboard-view'
import { loadDataViewQueryInput } from '@/shared/dal/server/lib/query/load-data-view-query-input'
import { protectDashboardPage } from '@/shared/domains/permissions/lib/protect-dashboard-page'
import { HydrateClient } from '@/trpc/components/hydrate-client'
import { prefetch } from '@/trpc/lib/prefetch'
import { trpc } from '@/trpc/server'

export const dynamic = 'force-dynamic'

interface Props {
  searchParams: Promise<SearchParams>
}

export default async function DashboardPage({ searchParams }: Props) {
  const authState = await protectDashboardPage()

  // Unauthenticated visitors get the layout's sign-in screen; skip the prefetch work.
  if (authState.status === 'authenticated') {
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(meetingsWindowInput('today')))
    prefetch(trpc.meetingsRouter.reads.list.queryOptions(await loadDataViewQueryInput(searchParams, DASHBOARD_MEETINGS_QUERY, DASHBOARD_MEETINGS_EXTRA)))
    prefetch(trpc.proposalsRouter.business.list.queryOptions(awaitingProposalsInput()))
    prefetch(trpc.proposalsRouter.business.list.queryOptions(sentProposalsInput()))
    prefetch(trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput()))
    prefetch(trpc.projectsRouter.crud.list.queryOptions(onHoldProjectsInput()))
  }

  const name = authState.status === 'authenticated' ? authState.session.user.name : null

  return (
    <HydrateClient>
      <DashboardView name={name} />
    </HydrateClient>
  )
}
```

- [ ] **Step 8: Nothing references the deleted builders**

Run: `grep -rn "meetingsMonthInput\|meetingMonthWindow" src scripts`
Expected: no output.

- [ ] **Step 9: Type-check and lint**

Run:
```bash
pnpm exec eslint --fix src/features/agent-dashboard/constants/dashboard-queries.ts src/features/agent-dashboard/lib/meeting-windows.ts src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx 'src/app/(frontend)/dashboard/page.tsx'
pnpm tsc && pnpm lint
```
Expected: no errors. `scripts/` isn't linted by `next lint`, but `pnpm tsc` type-checks it.

- [ ] **Step 10: Run the dashboard check and watch it pass**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:dashboard`
Expected: `PASS checks:dashboard`, with a log line reporting how many outside days were checked for a dot. If it says `0 outside days`, the dev data has no meetings on next month's outside days. That's still a pass; note it in your report so the owner knows that path went unexercised.

Then run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:schedule`
Expected: `PASS checks:schedule` (the shared hook changed again in Task 4).

- [ ] **Step 11: Commit**

```bash
git commit -m "feat(dashboard): meetings calendar on useDataViewQuery — month in the URL, month-grid read, ±2 prefetch, error line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/agent-dashboard/constants/dashboard-queries.ts src/features/agent-dashboard/lib/meeting-windows.ts scripts/verify-analytics-rules.ts src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx 'src/app/(frontend)/dashboard/page.tsx'
git show --stat HEAD
```
Expected: exactly those six files.

---

### Task 7: Glossary paths

**Files:**
- Modify: `docs/ubiquitous-language.md:211-212`

- [ ] **Step 1: Fix the two rows**

In `docs/ubiquitous-language.md`, replace:

```md
| `Meetings/Calendar/Meeting` | `meeting-flow/ui/components/calendar/meeting-calendar.tsx` | `useMeetingActionConfigs` |
| `Meetings/Calendar/Meeting` (dot) | `meeting-flow/ui/components/calendar/meeting-calendar-dot.tsx` | `useMeetingActionConfigs` |
```

with:

```md
| `Meetings/Calendar/Meeting` | `schedule-management/ui/components/schedule-meetings-calendar.tsx` | `useMeetingActionConfigs` |
| `Meetings/Calendar/Meeting` (dot) | `schedule-management/ui/components/schedule-calendar-dot.tsx` | `useMeetingActionConfigs` |
```

- [ ] **Step 2: Confirm both paths exist**

Run: `ls src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx src/features/schedule-management/ui/components/schedule-calendar-dot.tsx`
Expected: both listed.

- [ ] **Step 3: Commit**

```bash
git commit -m "docs(glossary): meetings calendar paths moved to schedule-management

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/ubiquitous-language.md
git show --stat HEAD
```
Expected: exactly that file. If `git status` showed `docs/ubiquitous-language.md` already modified by someone else before your edit, STOP and report instead of committing.

---

### Task 8: After measurement and comparison

**Files:**
- Create (throwaway): `.superpowers/sdd/2026-09-29-data-view-date-windows/compare.ts`
- Output: `after.json`, `verify.md` in the same directory

- [ ] **Step 1: Measure after**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts after`
Expected: `wrote …/after.json` with no prefetch-drift errors reported.

- [ ] **Step 2: Write the comparison script**

Create `.superpowers/sdd/2026-09-29-data-view-date-windows/compare.ts`:

```ts
import fs from 'node:fs'

interface Row { page: string, intervalMs: number, landings: number, passedThrough: number, meanWaitMs: number, maxWaitMs: number, landingsWithFalseEmpty: number, landingsWithSkeletons: number, reads: number, batches: number }

const DIR = '.superpowers/sdd/2026-09-29-data-view-date-windows'
const read = (name: string) => JSON.parse(fs.readFileSync(`${DIR}/${name}.json`, 'utf8')) as { at: string, summary: Row[], drift: string[] }
const before = read('baseline')
const after = read('after')

const lines = [
  '# Date windows: before / after',
  '',
  `Before: ${before.at} · After: ${after.at} · dev server, headless Chromium, 1440×900.`,
  '',
  '| Page | Click interval | Mean wait (ms) | Max wait (ms) | Landings with a false empty state | Landings with skeletons | Calendar reads | HTTP batches |',
  '|---|---|---|---|---|---|---|---|',
  ...before.summary.map((b, i) => {
    const a = after.summary[i]
    return `| ${b.page} | ${b.intervalMs}ms | ${b.meanWaitMs} → ${a.meanWaitMs} | ${b.maxWaitMs} → ${a.maxWaitMs} | ${b.landingsWithFalseEmpty}/${b.landings} → ${a.landingsWithFalseEmpty}/${a.landings} | ${b.landingsWithSkeletons} → ${a.landingsWithSkeletons} | ${b.reads} → ${a.reads} | ${b.batches} → ${a.batches} |`
  }),
  '',
  `Prefetch-drift errors: ${before.drift.length} → ${after.drift.length}.`,
]
fs.writeFileSync(`${DIR}/verify.md`, `${lines.join('\n')}\n`)
console.log(lines.join('\n'))
```

- [ ] **Step 3: Compare**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/compare.ts`
Expected:
- every "false empty state" cell ends at `0/…`;
- calendar reads go up, since each settle now asks for up to four neighbours, but by no more than about two per landing;
- no mean wait gets worse by more than the noise between runs (tens of ms).

If a "false empty state" cell isn't 0 after the change, STOP and report with the landing details from `after.json`.

- [ ] **Step 4: Rerun both checks on the finished tree**

Run:
```bash
pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:schedule
pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:dashboard
```
Expected: `PASS` for both. Append both results, and the count of outside days checked, to the bottom of `verify.md` by hand.

No commit: `verify.md` is gitignored working evidence for the owner.

---

### Task 9: UI pass on the pending states and the error line

The spec requires the owner's usual UI pass (web-design-guidelines, then /impeccable) before the skeletons count as done. Fixes stay inside the files Tasks 3 and 6 touched.

**Files:**
- Review and possibly modify: `src/features/schedule-management/ui/components/schedule-card-skeleton.tsx`, `schedule-week-view.tsx`, `schedule-today-view.tsx`, `src/shared/components/calendar/ui/calendar-month-view.tsx`, `src/features/agent-dashboard/ui/components/dashboard-meetings-calendar.tsx`

- [ ] **Step 1: Capture the pending states**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts shots`
Expected: eight PNGs in the directory, `pending-{week,day,month,dashboard}-{light,dark}.png`, each showing skeletons (not "No events", not another window's cards). Open each one with the Read tool and confirm that. Any PNG without skeletons is a bug: STOP and report.

- [ ] **Step 2: Guidelines review**

Invoke the `web-design-guidelines` skill on the five files above. Fix findings that are in scope: skeleton sizing and contrast in both themes, `aria-busy` placement, motion (`motion-safe:` is already on `Skeleton`), and the error line's focus ring and target size. Record any finding you don't fix, with the reason, in `verify.md`.

- [ ] **Step 3: Polish**

Invoke the `impeccable` skill in polish mode on the same surfaces, giving it the eight screenshots. Apply what it finds that stays inside these files and doesn't change behaviour. Rerun `shots` and look at the new PNGs.

- [ ] **Step 4: Recheck**

Run:
```bash
pnpm tsc && pnpm lint
pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:schedule
pnpm exec tsx .superpowers/sdd/2026-09-29-data-view-date-windows/harness.ts checks:dashboard
```
Expected: no errors, `PASS`, `PASS`.

- [ ] **Step 5: Commit (only if Steps 2–3 changed files)**

```bash
git commit -m "style(schedule): UI pass on the pending skeletons and the dashboard error line

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- <each file you changed, by explicit path>
git show --stat HEAD
```

- [ ] **Step 6: Hand to the owner**

Report:
- the commit list;
- the `verify.md` table;
- the screenshot paths;
- any unfixed guideline findings;
- whether next month's outside days had meetings in the dev data.

The owner eyeballs the pending states on the real app before this counts as done. Nothing is pushed; pushing to production is the owner's call.
