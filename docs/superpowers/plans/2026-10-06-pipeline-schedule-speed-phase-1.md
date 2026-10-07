# Pipeline + Schedule Speed, Phase 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry the records pages' loading fixes to `/dashboard/pipeline/[pipeline]` and `/dashboard/schedule`: one fade, an instant shell on click and on document load, skeleton cards while a board loads, a pipeline switch that keeps the query cache, and a Fresh read whose follow-up queries run together.

**Architecture:** Both views drop their own `motion.div` and rely on the dashboard template's 200 ms fade. Each route gets a `loading.tsx` that renders the view inside `DataViewPending` (the view with no rows, the same device the records routes use), and the dashboard layout's route→pending-view map learns the five pipeline paths through a `PipelineRoutePendingView` that supplies the `PipelineProvider` the segment layout would otherwise provide. `KanbanBoard` learns `isPending` and its columns draw seeded skeleton cards instead of "No <stage>". `onPipelineChange` stops invalidating customer queries, so a switch back lands on cached rows. The committed probe `scripts/perf/page-probe.mjs` measures each step against the 2026-10-05 baseline.

**Tech Stack:** Next.js 15 App Router (`loading.tsx`, `next/dynamic`, `useParams`), React 19, TanStack Query 5 (`useSuspenseQuery`, hydration of streamed prefetches), nuqs, Drizzle on Neon, Playwright (dev-only probe and read-only checks).

**Spec:** `docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md` — §3.1 Phase 1, §4 names, §5 targets (Phase 1 rows), §6 verification. Read §1 first: it lists each cause with the file it lives in.

## Global Constraints

- Never `pnpm build`. Verify with `pnpm tsc` and `pnpm lint` after every task (CLAUDE.md).
- Never write to any database for testing, dev included. Every browser check below is read-only: no drags, no deletes, no outcome changes, no form submits.
- Another session edits this working tree while you work. Commit by explicit path only: `git add <files>` then `git commit -m … -- <files>`. Never `git add -A`, `git stash`, `git checkout --`, or `git reset`. Run `git diff --cached --stat` before each commit and expect it empty.
- Never print `DEV_LOGIN_SECRET` or a URL carrying it. The probe's `redact` exists for that; scratch scripts use the same `redact`.
- New exported names come from spec §4 only: `KanbanCardSkeleton`, `KANBAN_SKELETON_CARDS_PER_STAGE`, `PipelineRoutePendingView`, `scripts/perf/page-probe.mjs`. No other new exported names in this phase.
- Comments say why, never what; no file banners; code never cites this plan or the spec (CLAUDE.md).
- Dev-server numbers are compared with other dev-server numbers (the baseline files), never with production. Compare medians, and read the per-run list when a median looks odd: one slow run is usually a dev recompile from the other session's edits.
- `.superpowers/` is gitignored. Probe outputs and scratch scripts live in `.superpowers/sdd/2026-10-06-pipeline-schedule-speed-phase-1/`, called `$SDD` below (`export SDD=.superpowers/sdd/2026-10-06-pipeline-schedule-speed-phase-1` at the top of each shell). Baselines stay where they are: `.superpowers/harness/pipeline-schedule-perf/baseline-2026-10-05/*.txt`.
- Spec §3.1 fixes only. Lazy-mounting menus, action hosts, memoizing cards and paging stages belong to Phases 2 and 3; do not start them even where a file you edit invites it.
- The dev server listens on `:3000` and belongs to the other session. Do not restart it or delete `.next`. If `:3000` answers nothing, stop and tell the owner.
- Probe runs take several minutes each. Run them with `< /dev/null`, redirect output to a file in `$SDD`, and run them in the background when your tool's timeout is shorter than ~10 minutes; read the file when the run ends.

## Review Focus

1. **Unknown pipeline slug** (`/dashboard/pipeline/bogus`): both the loading state and the page resolve to Fresh through `resolvePipelineParam`; the pending map has no entry for the bogus path, so a document load shows the generic skeleton, then the Fresh board. Nothing throws. → tested in Task 4.
2. **Two switches in quick succession** (Fresh → Rehash → Fresh before Rehash's rows arrive): with no invalidation step, the board must end on Fresh's cards and the URL on `/dashboard/pipeline/fresh`; Rehash's late rows never land on the Fresh board, because the pipeline is part of the query key. → tested in Task 5.
3. **A search that matches nothing** (`?cp_q=zzqqxx`): the board shows the "No Customers" empty state, not skeleton cards, because `isPending` is false once the empty rows are in. → tested in Task 3.
4. **Fresh customers with no proposals or no rep** once the three follow-up reads run together: the row maps hold nothing for them and the card keeps `proposals: []`, `assignedRep: null`, as today. Stage counts and card order must match exactly before and after, as admin and as agent. → tested in Task 6.
5. **A push-notification deep link** (`/dashboard/schedule?show=meetings&s_d=…&highlightMeeting=<id>`): the highlighted card must scroll into the viewport after the shorter wait on desktop Chromium; the iPhone stays the owner's hand-check (spec §6). → tested in Task 2.

---

### Task 1: Commit the probe as `scripts/perf/page-probe.mjs`

**Files:**
- Create: `scripts/perf/page-probe.mjs` (from `.superpowers/harness/pipeline-schedule-perf/probe.mjs` with `lib.mjs` inlined)
- Create (gitignored): `$SDD/`

**Interfaces:**
- Produces: `node scripts/perf/page-probe.mjs <meetings|pipeline-fresh|pipeline-leads|pipeline-rehash|pipeline-projects|schedule> [runs] < /dev/null`. Same sections as the harness probe (`### <page>` server HTML line, `>>> DOCUMENT LOAD`, `>>> SIDEBAR CLICK`, `>>> MOUNTED`, one `=== <scenario> ===` block per interaction) plus one new mark on the DOCUMENT LOAD line: `generic skeleton <ms>` = first frame at which a `[data-slot="dashboard-content-skeleton"]` with no `[data-slot="data-view-pending"]` inside it is in the DOM, `NaN` when it never shows. Tasks 2, 4, 5 and 7 read `pending shell`, `generic skeleton`, `content in DOM`, `content fully shown`, and the pipeline-switch scenarios' `url changed`, `board fully shown` and `trpc` lines.

- [ ] **Step 1: Confirm the dev server and make the scratch folder**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
export SDD=.superpowers/sdd/2026-10-06-pipeline-schedule-speed-phase-1
ss -ltnp | grep -E ':3000\b'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/dashboard/pipeline/fresh
mkdir -p "$SDD"
```

Expected: one `LISTEN` line for `:3000` (a `next-server` process) and `200` or `307`. Anything else: stop and tell the owner; the other session owns that server.

- [ ] **Step 2: Copy the harness probe into the repo**

```bash
cp .superpowers/harness/pipeline-schedule-perf/probe.mjs scripts/perf/page-probe.mjs
```

- [ ] **Step 3: Replace the header so the file stands alone**

In `scripts/perf/page-probe.mjs`, replace lines 1–5 (the two comment lines, the `node:process` import, the blank line and `import { BASE, chromium, redact, signIn } from './lib.mjs'`) with:

```js
// Read-only timing + render-cost probe for a dashboard page, against the running dev server.
// Dev React is several times slower than production: compare pages and runs with each other.
import process from 'node:process'
import { chromium } from 'playwright'

process.loadEnvFile('.env.local')
const secret = process.env.DEV_LOGIN_SECRET
if (!secret) {
  console.error('DEV_LOGIN_SECRET is missing from .env.local')
  process.exit(1)
}
const BASE = `http://localhost:${process.env.PORT ?? 3000}`

// Playwright's errors quote the URL, which carries the secret.
const redact = text => String(text).replaceAll(encodeURIComponent(secret), '***').replaceAll(secret, '***')

async function signIn(page, redirect) {
  try {
    await page.goto(`${BASE}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent(redirect)}`, { timeout: 180000 })
  }
  catch (error) {
    throw new Error(redact(error.message))
  }
}
```

Then change the usage line

```js
  console.error(`Usage: node probe.mjs <${Object.keys(PAGES).join('|')}> [runs]`)
```

to

```js
  console.error(`Usage: node scripts/perf/page-probe.mjs <${Object.keys(PAGES).join('|')}> [runs]`)
```

- [ ] **Step 4: Add the `generic skeleton` mark**

Inside `installProbe`, in the `tick` function of `window.__timelineStart`, the line

```js
      const pending = document.querySelector('[data-slot="data-view-pending"], [data-slot="dashboard-content-skeleton"]')
```

becomes two lines:

```js
      const pending = document.querySelector('[data-slot="data-view-pending"], [data-slot="dashboard-content-skeleton"]')
      const generic = document.querySelector('[data-slot="dashboard-content-skeleton"]:not(:has([data-slot="data-view-pending"]))')
```

Directly after the block

```js
      if (marks.pendingShell == null && pending) {
        marks.pendingShell = now
      }
```

add

```js
      if (marks.genericSkeleton == null && generic) {
        marks.genericSkeleton = now
      }
```

In the DOCUMENT LOAD summary line, after `pending shell ${doc('pendingShell')}` insert ` · generic skeleton ${doc('genericSkeleton')}` so the line reads:

```js
  console.log(`\n>>> DOCUMENT LOAD (median (min) of ${RUNS}, ms since navigation): FCP ${doc('fcp')} · pending shell ${doc('pendingShell')} · generic skeleton ${doc('genericSkeleton')} · toolbar ${doc('toolbar')} · items in DOM ${doc('items')} · items fully shown ${doc('itemsShown')} · items interactive (hydrated) ${doc('hydrated')} · long tasks ${doc('longTaskSum')}ms, longest ${doc('longTaskMax')}ms · hydration warnings ${docRuns.map(r => r.hydrationIssues).join('/')}`)
```

`doc()` already turns a missing mark into `NaN`, so a route that never shows the generic skeleton prints `generic skeleton NaN (min NaN)`.

- [ ] **Step 5: Lint the file**

```bash
npx eslint scripts/perf/page-probe.mjs
```

Expected: no output. If it reports style errors, run `npx eslint --fix scripts/perf/page-probe.mjs` and re-run; fix anything left by hand.

- [ ] **Step 6: Smoke-run on the Fresh board (one run)**

```bash
node scripts/perf/page-probe.mjs pipeline-fresh 1 < /dev/null > "$SDD/smoke-pipeline-fresh.txt" 2>&1
grep -E '^### |^>>> DOCUMENT LOAD|^>>> SIDEBAR|^probe failed' "$SDD/smoke-pipeline-fresh.txt"
```

Expected: `### pipeline-fresh — /dashboard/pipeline/fresh`; a DOCUMENT LOAD line whose `generic skeleton` is a number (today the pipeline route has no pending-map entry, so the layout's generic skeleton is the first paint); a SIDEBAR CLICK line; no `probe failed`. If the run fails on the sign-in wait, the dev server was compiling; run it once more.

- [ ] **Step 7: Commit**

```bash
git diff --cached --stat
git add scripts/perf/page-probe.mjs
git commit -m "chore(perf): page probe for the pipeline and schedule routes — timeline, census and interaction costs against the dev server

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- scripts/perf/page-probe.mjs
```

The harness copies (`probe.mjs`, `lib.mjs`, `step.mjs`, the baselines) stay untouched until Task 7.

---

### Task 2: One fade, and the highlight scroll waits 250 ms

**Files:**
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx:5-7,27,45,126-133,215`
- Modify: `src/features/schedule-management/ui/views/schedule-view.tsx:3,14,21,28-35,61`
- Modify: `src/features/schedule-management/hooks/use-schedule-highlight.ts:8-14,40-47`
- Create (gitignored): `$SDD/check-lib.mjs`, `$SDD/check-highlight.mjs`

**Interfaces:**
- Consumes: nothing from Task 1 beyond the probe command.
- Produces: `$SDD/check-lib.mjs` exporting `BASE`, `redact(text)`, `openPage(redirect, extra = '')` → `{ browser, page, errors }` (signed in through `/api/dev/playwright-session`, 1400×900 viewport, `errors` collects redacted `pageerror` messages). Tasks 3–6 import it.

- [ ] **Step 1: Write the shared check library**

`$SDD/check-lib.mjs`:

```js
import process from 'node:process'
import { chromium } from 'playwright'

process.loadEnvFile('.env.local')
const secret = process.env.DEV_LOGIN_SECRET
if (!secret) {
  console.error('DEV_LOGIN_SECRET is missing from .env.local')
  process.exit(1)
}
export const BASE = `http://localhost:${process.env.PORT ?? 3000}`

export const redact = text => String(text).replaceAll(encodeURIComponent(secret), '***').replaceAll(secret, '***')

// `extra` is appended to the dev-login query, e.g. '&role=agent'.
export async function openPage(redirect, extra = '') {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
  const errors = []
  page.on('pageerror', error => errors.push(redact(error.message).split('\n')[0]))
  try {
    await page.goto(`${BASE}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}${extra}&redirect=${encodeURIComponent(redirect)}`, { timeout: 180000 })
  }
  catch (error) {
    await browser.close()
    throw new Error(redact(error.message))
  }
  return { browser, page, errors }
}
```

Run every check from the repo root (`node $SDD/<check>.mjs`): `.env.local` resolves from the cwd, and `playwright` resolves from the repo's `node_modules` because `$SDD` sits inside the repo tree.

- [ ] **Step 2: Write the highlight check**

`$SDD/check-highlight.mjs` — opens the schedule on the week that has data, reads a meeting id off the last card's React props (the rows arrive in the server HTML, so no list request carries them), reloads with `highlightMeeting=<id>`, and times how long after the highlighted card exists it sits inside the viewport:

```js
import process from 'node:process'
import { BASE, openPage } from './check-lib.mjs'

const WEEK = '2026-08-24'
const CARD = '.group.relative.rounded-md.border.bg-card'
const { browser, page, errors } = await openPage(`/dashboard/schedule?show=meetings&s_d=${WEEK}`)
await page.waitForSelector(CARD, { timeout: 120000 })
await page.waitForTimeout(3000)
// MeetingCard's `event` prop holds the id; the card's DOM node links to its fiber, and `return` walks up to that prop.
const meetingId = await page.evaluate((selector) => {
  const cards = document.querySelectorAll(selector)
  const card = cards[cards.length - 1]
  const key = card && Object.keys(card).find(name => name.startsWith('__reactFiber'))
  for (let fiber = key ? card[key] : null; fiber; fiber = fiber.return) {
    const id = fiber.memoizedProps?.event?.meetingId
    if (typeof id === 'string') {
      return id
    }
  }
  return null
}, CARD)
if (!meetingId) {
  console.error('FAIL: no meetingId on the last card\'s MeetingCard props (is the card hydrated?)')
  await browser.close()
  process.exit(1)
}

await page.goto('about:blank')
await page.goto(`${BASE}/dashboard/schedule?show=meetings&s_d=${WEEK}&highlightMeeting=${meetingId}`, { timeout: 120000, waitUntil: 'commit' })
const result = await page.evaluate(() => new Promise((resolve) => {
  const t0 = performance.now()
  let cardAt = null
  const tick = () => {
    const now = performance.now() - t0
    const glow = document.querySelector('.outline-primary')
    const card = glow?.parentElement
    if (card && cardAt == null) {
      cardAt = now
    }
    if (card) {
      const rect = card.getBoundingClientRect()
      const inView = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth
      if (inView) {
        resolve({ cardAt: Math.round(cardAt), inViewAt: Math.round(now) })
        return
      }
    }
    if (now > 60000) {
      resolve({ cardAt: cardAt == null ? null : Math.round(cardAt), inViewAt: null })
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}))
await browser.close()

const sinceCard = result.inViewAt == null || result.cardAt == null ? null : result.inViewAt - result.cardAt
console.log(`highlighted card in DOM at ${result.cardAt}ms · in viewport at ${result.inViewAt}ms · scroll settled ${sinceCard}ms after the card · page errors ${errors.length}`)
const pass = sinceCard != null && sinceCard <= 1000 && errors.length === 0
console.log(pass ? 'PASS' : 'FAIL')
process.exit(pass ? 0 : 1)
```

- [ ] **Step 3: Run the check before the change, for the reference number**

```bash
node "$SDD/check-highlight.mjs" | tee "$SDD/highlight-before.txt"
```

Expected: `PASS`, with `scroll settled` somewhere above 600 ms (today's wait is 600 ms plus the smooth scroll). If `cardAt` is `null`, the week has no meeting on the dev DB any more; pick another week by changing `WEEK` to a `YYYY-MM-DD` Monday that shows cards in the browser and re-run.

- [ ] **Step 4: Drop the pipeline view's own fade**

In `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`:

Remove these two imports:

```ts
import { motion } from 'motion/react'
```

```ts
import { useIsHydrating } from '@/shared/hooks/use-is-hydrating'
```

Remove the line

```ts
  const isHydrating = useIsHydrating()
```

Replace the opening tag

```tsx
    <motion.div
      initial={isHydrating ? false : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col gap-(--gutter) overflow-hidden"
    >
```

with

```tsx
    <div className="w-full h-full flex flex-col gap-(--gutter) overflow-hidden">
```

and the closing `</motion.div>` with `</div>`. (`exit` never ran: nothing wraps the view in `AnimatePresence`.)

- [ ] **Step 5: Drop the schedule view's own fade**

In `src/features/schedule-management/ui/views/schedule-view.tsx`:

Remove

```ts
import { motion } from 'motion/react'
```

and

```ts
import { useIsHydrating } from '@/shared/hooks/use-is-hydrating'
```

and the line

```ts
  const isHydrating = useIsHydrating()
```

Replace

```tsx
    <motion.div
      initial={isHydrating ? false : { opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ delay: 0.25, duration: 0.25 }}
      className="w-full h-full flex flex-col overflow-hidden"
    >
```

with

```tsx
    <div className="w-full h-full flex flex-col overflow-hidden">
```

and the closing `</motion.div>` with `</div>`.

- [ ] **Step 6: Shorten the highlight wait and fix its reason**

In `src/features/schedule-management/hooks/use-schedule-highlight.ts`, replace

```ts
const HIGHLIGHT_DURATION_MS = 10_000
// The ScheduleView root is wrapped in a motion.div with `delay: 0.25s + duration: 0.25s`.
// On iOS Safari / PWA, transforms applied during that animation break
// scrollIntoView's position calculation, so the page loads and looks like
// it "only navigated to the schedule" — no scroll happens. We defer the
// scroll until the motion animation has settled (with a small safety margin).
const SCROLL_DEFER_MS = 600
```

with

```ts
const HIGHLIGHT_DURATION_MS = 10_000
// On iOS Safari / PWA, a transform still animating on an ancestor breaks scrollIntoView's position math and the
// scroll silently no-ops. The dashboard template fades the page in over 200 ms with a 4px rise, so the scroll
// waits for that to settle, with a margin.
const SCROLL_DEFER_MS = 250
```

and replace the comment above the `setTimeout`

```ts
        // Card has rendered — wait for the page-level motion animation to
        // settle before scrolling (otherwise iOS Safari miscalculates the
        // target and silently no-ops). `block: 'center'` is also more
        // reliable than 'nearest' when the target sits inside a nested
        // ScrollArea viewport on mobile.
```

with

```ts
        // Card has rendered — wait for the template's entrance to settle before scrolling (see SCROLL_DEFER_MS).
        // `block: 'center'` is also more reliable than 'nearest' when the target sits inside a nested
        // ScrollArea viewport on mobile.
```

- [ ] **Step 7: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both clean. An unused-import error here means a removed import was left behind.

- [ ] **Step 8: Re-run the highlight check**

```bash
node "$SDD/check-highlight.mjs" | tee "$SDD/highlight-after.txt"
```

Expected: `PASS`, `scroll settled` lower than the before number and under 1000 ms, `page errors 0`.

- [ ] **Step 9: Probe both pages for the fade target**

```bash
node scripts/perf/page-probe.mjs schedule 3 < /dev/null > "$SDD/after-task2-schedule.txt" 2>&1
node scripts/perf/page-probe.mjs pipeline-fresh 3 < /dev/null > "$SDD/after-task2-pipeline-fresh.txt" 2>&1
grep -A1 '^>>> SIDEBAR CLICK' "$SDD"/after-task2-*.txt
```

Each `runs:` line lists `pendingShell/toolbar/toolbarShown/content/contentShown` per run. Expected: `contentShown − content` ≤ 250 on every run of both pages (baseline: schedule 254 / 510 / 237, Fresh 672 / 678). The template's own fade still runs, so the delta is near 200 on a soft navigation, not 0.

- [ ] **Step 10: Commit**

```bash
git diff --cached --stat
git add src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/features/schedule-management/hooks/use-schedule-highlight.ts
git commit -m "perf(pipeline,schedule): one fade — the views drop their own entrance animation; the highlight scroll waits 250 ms

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/features/schedule-management/hooks/use-schedule-highlight.ts
```

---

### Task 3: Skeleton cards while a board loads

**Files:**
- Create: `src/shared/components/kanban/constants/skeleton-cards.ts`
- Create: `src/shared/components/kanban/ui/kanban-card-skeleton.tsx`
- Modify: `src/shared/components/kanban/ui/kanban-column.tsx`
- Modify: `src/shared/components/kanban/ui/kanban-board.tsx:21-34,47-60,120-131`
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` (the `<KanbanBoard>` props)
- Create (gitignored): `$SDD/check-board-pending.mjs`

**Interfaces:**
- Consumes: `seededIntInRange(seed: string, range: { min: number, max: number }): number` from `@/shared/components/calendar/lib/calendar-helpers` (unchanged); `query.isPending: boolean` from `useDataViewQuery`.
- Produces: `KanbanBoard` prop `isPending?: boolean`; `KanbanColumn` prop `isPending?: boolean`; `KanbanCardSkeleton()` (no props); `KANBAN_SKELETON_CARDS_PER_STAGE = { min: 1, max: 3 } as const`. A pending column carries `aria-busy="true"` on its card list. Phase 3's load-more row and Phase 2's card work build on `KanbanColumn` as left here.

- [ ] **Step 1: Write the check**

`$SDD/check-board-pending.mjs` — from the dashboard home, clicks the Fresh sidebar link and samples the board every frame while the pending shell exists; then searches for a string that matches nothing:

```js
import { openPage } from './check-lib.mjs'

const { browser, page, errors } = await openPage('/dashboard')
await page.waitForTimeout(3000)

await page.evaluate(() => {
  window.__samples = { emptyMessagesWhilePending: 0, skeletonsWhilePending: 0, framesPending: 0, skeletonsAfter: null }
  const tick = () => {
    const pending = document.querySelector('[data-slot="data-view-pending"]')
    const board = document.querySelector('.min-w-70')
    if (pending && board) {
      window.__samples.framesPending++
      window.__samples.emptyMessagesWhilePending += [...document.querySelectorAll('.min-w-70 p')].filter(p => /^No /.test(p.textContent ?? '')).length
      window.__samples.skeletonsWhilePending += document.querySelectorAll('.min-w-70 [data-slot="skeleton"]').length
    }
    if (!pending && board && document.querySelector('.min-w-70 [data-slot="card"]')) {
      window.__samples.skeletonsAfter = document.querySelectorAll('.min-w-70 [data-slot="skeleton"]').length
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})
await page.locator('a[href="/dashboard/pipeline/fresh"]').first().click()
await page.waitForSelector('.min-w-70 [data-slot="card"]', { timeout: 120000 })
await page.waitForFunction(() => window.__samples.skeletonsAfter != null, null, { timeout: 30000 })
const samples = await page.evaluate(() => window.__samples)

const input = page.locator('input[placeholder^="Search by"]').first()
await input.fill('zzqqxx')
await page.waitForFunction(() => document.body.textContent?.includes('No Customers'), null, { timeout: 30000 })
const skeletonsOnEmpty = await page.locator('.min-w-70 [data-slot="skeleton"]').count()
const cardsOnEmpty = await page.locator('.min-w-70 [data-slot="card"]').count()
await browser.close()

console.log(JSON.stringify({ ...samples, skeletonsOnEmpty, cardsOnEmpty, errors }, null, 2))
const pass = samples.framesPending > 0
  && samples.emptyMessagesWhilePending === 0
  && samples.skeletonsWhilePending > 0
  && samples.skeletonsAfter === 0
  && skeletonsOnEmpty === 0
  && cardsOnEmpty === 0
  && errors.length === 0
console.log(pass ? 'PASS' : 'FAIL')
process.exit(pass ? 0 : 1)
```

- [ ] **Step 2: Run it to see today's behavior fail**

```bash
node "$SDD/check-board-pending.mjs"
```

Expected: `FAIL` with `emptyMessagesWhilePending` > 0 and `skeletonsWhilePending` 0 (today every column says "No <stage>" while the rows load). If `framesPending` is 0 the shell was too quick to catch on a warm server; re-run once.

- [ ] **Step 3: Add the constant**

`src/shared/components/kanban/constants/skeleton-cards.ts`:

```ts
// A loading stage draws a believable handful of cards rather than the same block in every column.
export const KANBAN_SKELETON_CARDS_PER_STAGE = { min: 1, max: 3 } as const
```

- [ ] **Step 4: Add the skeleton card**

`src/shared/components/kanban/ui/kanban-card-skeleton.tsx`:

```tsx
import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_BLOCK_TONE_CLASS, SKELETON_FRAME_TONE_CLASS, SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { cn } from '@/shared/lib/utils'

// Rows sit where CustomerKanbanCard's customer block puts its name, created line, phone and address, so the swap to
// real cards doesn't jump. No `data-slot="card"`: a placeholder is not a card to anything that counts them.
export function KanbanCardSkeleton() {
  return (
    <div aria-hidden className={cn('rounded-xl border bg-card p-2.5 shadow-sm', SKELETON_FRAME_TONE_CLASS)}>
      <div className="space-y-1.5 rounded-md border border-border/60 bg-muted/30 p-2.5 dark:bg-muted/20">
        <div className="flex h-5 items-center gap-1.5">
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'size-3.5 shrink-0')} />
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-3 w-32 max-w-full')} />
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'ml-auto size-5 shrink-0')} />
        </div>
        <div className="flex h-4 items-center">
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-24')} />
        </div>
        <div className="flex h-4 items-center gap-1.5">
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'size-3.5 shrink-0 rounded-full')} />
          <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-20')} />
        </div>
        <div className="flex items-start gap-1.5">
          <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'mt-0.5 size-3.5 shrink-0')} />
          <div className="flex flex-col gap-1.5 py-0.5">
            <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-36 max-w-full')} />
            <Skeleton className={cn(SKELETON_TONE_CLASS, 'h-2.5 w-20')} />
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Teach the column about `isPending`**

Replace the whole of `src/shared/components/kanban/ui/kanban-column.tsx` with:

```tsx
'use client'

import type { KanbanItem, KanbanStageConfig } from '@/shared/components/kanban/types'

import { useDroppable } from '@dnd-kit/core'
import { ChevronDownIcon } from 'lucide-react'
import { memo, useState } from 'react'

import { seededIntInRange } from '@/shared/components/calendar/lib/calendar-helpers'
import { badgeColorMap, stageColorMap } from '@/shared/components/kanban/constants/color-maps'
import { KANBAN_SKELETON_CARDS_PER_STAGE } from '@/shared/components/kanban/constants/skeleton-cards'
import { KanbanCardSkeleton } from '@/shared/components/kanban/ui/kanban-card-skeleton'
import { KanbanEmptyColumn } from '@/shared/components/kanban/ui/kanban-empty-column'
import { Badge } from '@/shared/components/ui/badge'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { SKELETON_BLOCK_TONE_CLASS } from '@/shared/constants/skeleton-tone'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'

interface Props<T extends KanbanItem = KanbanItem> {
  stage: KanbanStageConfig
  items: T[]
  isPending?: boolean
  collapsed?: boolean
  getItemHref?: (item: T) => string
  showValueTotal?: boolean
  getItemValue?: (item: T) => number | null
  renderCard: (item: T, href: string, isDragOverlay?: boolean) => React.ReactNode
}

function KanbanColumnImpl<T extends KanbanItem>({
  stage,
  items,
  isPending,
  collapsed: initialCollapsed,
  getItemHref = () => '#',
  showValueTotal,
  getItemValue,
  renderCard,
}: Props<T>) {
  const [isCollapsed, setIsCollapsed] = useState(initialCollapsed ?? false)
  const { setNodeRef, isOver } = useDroppable({ id: stage.key })

  const Icon = stage.icon
  const borderColor = stageColorMap[stage.color] ?? 'border-t-muted'
  const badgeColor = badgeColorMap[stage.color] ?? 'bg-muted text-muted-foreground'

  // A count of 0 beside skeleton cards would be a lie; the count waits for the rows.
  const count = isPending
    ? <Skeleton className={cn(SKELETON_BLOCK_TONE_CLASS, 'h-5 w-7')} />
    : (
        <Badge variant="secondary" className={cn('text-xs', badgeColor)}>
          {items.length}
        </Badge>
      )

  if (isCollapsed) {
    return (
      <div className="min-w-70 flex-1">
        <button
          type="button"
          onClick={() => setIsCollapsed(false)}
          className="w-full flex items-center gap-2 p-3 rounded-xl border border-dashed border-border-strong hover:bg-hover transition-colors"
        >
          <Icon size={14} className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">{stage.label}</span>
          {count}
          <ChevronDownIcon size={14} className="ml-auto text-muted-foreground" />
        </button>
      </div>
    )
  }

  return (
    // A column is a rung-1 surface with the ladder's edge, so it holds its shape in dark and its cards climb a rung.
    // The drop target shows as a ring alone: a fill here would fight the surface's own background.
    <div
      ref={setNodeRef}
      className={cn(
        'surface min-w-70 flex-1 flex flex-col rounded-xl border border-t-2 transition-all',
        borderColor,
        isOver && 'ring-2 ring-primary/40',
      )}
    >
      <div className="flex items-center gap-2 p-3 pb-2">
        <Icon size={14} className="text-muted-foreground shrink-0" />
        <span className="text-sm font-medium truncate">{stage.label}</span>
        {count}
        {showValueTotal && getItemValue && (() => {
          const total = items.reduce((sum, item) => sum + (getItemValue(item) ?? 0), 0)
          return total > 0
            ? <span className="text-xs font-semibold text-status-success-fg tabular-nums">{formatAsDollars(total)}</span>
            : null
        })()}
        {initialCollapsed && (
          <button
            type="button"
            onClick={() => setIsCollapsed(true)}
            className="ml-auto text-muted-foreground hover:text-foreground"
          >
            <ChevronDownIcon size={14} className="rotate-180" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-gutter-stable px-2 pb-2 space-y-2" aria-busy={isPending || undefined}>
        {isPending
          // Seeded by the stage, so the loading board has the same shape on the server, on the client and on the next load.
          ? Array.from({ length: seededIntInRange(stage.key, KANBAN_SKELETON_CARDS_PER_STAGE) }, (_, index) => <KanbanCardSkeleton key={index} />)
          : items.length === 0
            ? <KanbanEmptyColumn label={stage.label} />
            : items.map(item => (
                <div key={item.id}>{renderCard(item, getItemHref(item))}</div>
              ))}
      </div>
    </div>
  )
}

// A board re-render (search typing, fetch state) skips every column whose items and handlers are unchanged.
export const KanbanColumn = memo(KanbanColumnImpl) as typeof KanbanColumnImpl
```

- [ ] **Step 6: Pass `isPending` through the board**

In `src/shared/components/kanban/ui/kanban-board.tsx`, add to `Props` after `groupedItems`:

```ts
  isPending?: boolean
```

add `isPending,` to the destructured parameters after `groupedItems,`, and add `isPending={isPending}` to the `<KanbanColumn>` element so it reads:

```tsx
          <KanbanColumn
            key={stage.key}
            stage={stage}
            items={groupedItems[stage.key] ?? []}
            isPending={isPending}
            collapsed={collapsedStages.includes(stage.key)}
            getItemHref={getItemHref}
            showValueTotal={showColumnValues}
            getItemValue={getItemValue}
            renderCard={renderCard}
          />
```

- [ ] **Step 7: The view passes its pending state**

In `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`, add `isPending={query.isPending}` to the `<KanbanBoard<CustomerPipelineItem>` element, after `groupedItems={groupedItems}`.

- [ ] **Step 8: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both clean.

- [ ] **Step 9: Run the check**

```bash
node "$SDD/check-board-pending.mjs"
```

Expected: `PASS` — `emptyMessagesWhilePending 0`, `skeletonsWhilePending > 0`, `skeletonsAfter 0`, `skeletonsOnEmpty 0`, `cardsOnEmpty 0`, no errors. Also open `http://localhost:3000/dashboard/pipeline/fresh` yourself with the network throttled and look: columns show one to three grey cards and a grey count while loading, then the real cards; the Declined column (collapsed) shows a grey count.

- [ ] **Step 10: Commit**

```bash
git diff --cached --stat
git add src/shared/components/kanban/constants/skeleton-cards.ts src/shared/components/kanban/ui/kanban-card-skeleton.tsx src/shared/components/kanban/ui/kanban-column.tsx src/shared/components/kanban/ui/kanban-board.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx
git commit -m "feat(kanban): a loading board draws seeded skeleton cards per stage instead of \"No <stage>\"

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/components/kanban/constants/skeleton-cards.ts src/shared/components/kanban/ui/kanban-card-skeleton.tsx src/shared/components/kanban/ui/kanban-column.tsx src/shared/components/kanban/ui/kanban-board.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx
```

---

### Task 4: Instant shell on click and on document load

**Files:**
- Create: `src/app/(frontend)/dashboard/pipeline/[pipeline]/loading.tsx`
- Create: `src/app/(frontend)/dashboard/schedule/loading.tsx`
- Create: `src/features/agent-dashboard/ui/components/pipeline-route-pending-view.tsx`
- Modify: `src/features/agent-dashboard/constants/route-pending-views.ts`
- Modify: `src/app/(frontend)/dashboard/schedule/page.tsx:10,45` (the dead `fallback`)
- Create (gitignored): `$SDD/check-shells.mjs`

**Interfaces:**
- Consumes: `DataViewPending` (`@/shared/components/data-view-pending`), `PipelineProvider` (`@/shared/domains/pipelines/hooks/pipeline-context`), `pipelines` (`@/shared/constants/enums/pipelines`), `ROOTS.dashboard.pipeline(pipeline)`.
- Produces: `PipelineRoutePendingView()` (client component, no props) and five more keys in `DASHBOARD_ROUTE_PENDING_VIEWS` (`/dashboard/pipeline/projects|fresh|leads|rehash|dead`).

- [ ] **Step 1: Write the check**

`$SDD/check-shells.mjs` — three document loads and two soft navigations:

```js
import { BASE, openPage } from './check-lib.mjs'

const { browser, page, errors } = await openPage('/dashboard')
await page.waitForTimeout(3000)

// Which skeleton paints first on a document load, and does the page's own pending view ever appear.
async function documentLoad(path, itemSelector) {
  await page.goto('about:blank')
  await page.goto(`${BASE}${path}`, { timeout: 120000, waitUntil: 'commit' })
  await page.evaluate((selector) => {
    window.__marks = { generic: null, own: null, items: null }
    const tick = () => {
      const generic = document.querySelector('[data-slot="dashboard-content-skeleton"]:not(:has([data-slot="data-view-pending"]))')
      const own = document.querySelector('[data-slot="data-view-pending"]')
      if (generic && window.__marks.generic == null) {
        window.__marks.generic = Math.round(performance.now())
      }
      if (own && window.__marks.own == null) {
        window.__marks.own = Math.round(performance.now())
      }
      if (window.__marks.items == null && document.querySelector(selector)) {
        window.__marks.items = Math.round(performance.now())
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, itemSelector)
  await page.waitForFunction(() => window.__marks.items != null, null, { timeout: 120000 })
  return page.evaluate(() => window.__marks)
}

// Does the pending shell appear on a sidebar click before the first card.
async function softNav(href, itemSelector) {
  await page.goto(`${BASE}/dashboard`, { timeout: 120000 })
  await page.waitForTimeout(3000)
  await page.evaluate((selector) => {
    window.__soft = { shell: null, items: null }
    const t0 = performance.now()
    const tick = () => {
      const now = Math.round(performance.now() - t0)
      if (window.__soft.shell == null && document.querySelector('[data-slot="data-view-pending"]')) {
        window.__soft.shell = now
      }
      if (document.querySelector(selector)) {
        window.__soft.items = now
        return
      }
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }, itemSelector)
  await page.locator(`a[href="${href}"]`).first().click()
  await page.waitForFunction(() => window.__soft.items != null, null, { timeout: 120000 })
  return page.evaluate(() => window.__soft)
}

const CARD = '.min-w-70 [data-slot="card"]'
const MEETING = '.group.relative.rounded-md.border.bg-card'
const results = {
  docFresh: await documentLoad('/dashboard/pipeline/fresh', CARD),
  docSchedule: await documentLoad('/dashboard/schedule?show=meetings&s_d=2026-08-24', MEETING),
  docBogus: await documentLoad('/dashboard/pipeline/bogus', CARD),
  softFresh: await softNav('/dashboard/pipeline/fresh', CARD),
  softSchedule: await softNav('/dashboard/schedule', '[class*="min-h-48"], .group.relative.rounded-md.border.bg-card'),
  bogusUrl: null,
}
await page.goto(`${BASE}/dashboard/pipeline/bogus`, { timeout: 120000 })
await page.waitForSelector(CARD, { timeout: 120000 })
results.bogusUrl = page.url()
await browser.close()

console.log(JSON.stringify({ ...results, errors }, null, 2))
const pass = results.docFresh.generic == null && results.docFresh.own != null
  && results.docSchedule.generic == null && results.docSchedule.own != null
  && results.docBogus.items != null
  && results.softFresh.shell != null && results.softFresh.shell <= results.softFresh.items
  && results.softSchedule.shell != null && results.softSchedule.shell <= results.softSchedule.items
  && errors.length === 0
console.log(pass ? 'PASS' : 'FAIL')
process.exit(pass ? 0 : 1)
```

- [ ] **Step 2: Run it to see today's behavior fail**

```bash
node "$SDD/check-shells.mjs"
```

Expected: `FAIL` with `docFresh.generic` a number (the generic skeleton paints first on the pipeline route today) and `softSchedule.shell` null or later than its items on a warm server.

- [ ] **Step 3: Add the pipeline route's loading state**

`src/app/(frontend)/dashboard/pipeline/[pipeline]/loading.tsx`:

```tsx
import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { DataViewPending } from '@/shared/components/data-view-pending'

export default function PipelineLoading() {
  return (
    <DataViewPending>
      <CustomerPipelineView />
    </DataViewPending>
  )
}
```

The segment's `layout.tsx` already wraps this in `PipelineProvider`, so `usePipeline()` resolves the slug the same way the page does.

- [ ] **Step 4: Add the schedule route's loading state**

`src/app/(frontend)/dashboard/schedule/loading.tsx`:

```tsx
import { ScheduleView } from '@/features/schedule-management/ui/views/schedule-view'
import { DataViewPending } from '@/shared/components/data-view-pending'

export default function ScheduleLoading() {
  return (
    <DataViewPending>
      <ScheduleView />
    </DataViewPending>
  )
}
```

- [ ] **Step 5: Add the layout-level pending view for pipeline paths**

`src/features/agent-dashboard/ui/components/pipeline-route-pending-view.tsx`:

```tsx
'use client'

import { CustomerPipelineView } from '@/features/customer-pipelines/ui/views'
import { PipelineProvider } from '@/shared/domains/pipelines/hooks/pipeline-context'

// The layout's loading state renders above the [pipeline] segment layout, so the provider the view reads comes from here.
export function PipelineRoutePendingView() {
  return (
    <PipelineProvider>
      <CustomerPipelineView />
    </PipelineProvider>
  )
}
```

- [ ] **Step 6: Register one entry per pipeline path**

Replace the whole of `src/features/agent-dashboard/constants/route-pending-views.ts` with:

```ts
import type { ComponentType } from 'react'

import dynamic from 'next/dynamic'

import { ROOTS } from '@/shared/config/roots'
import { pipelines } from '@/shared/constants/enums/pipelines'

// Lazy, so the layout's bundle doesn't carry every page; the pending context (not these components) keeps them from
// reading, so each one is its page's own loading state.
const PipelineRoutePendingView = dynamic(() => import('@/features/agent-dashboard/ui/components/pipeline-route-pending-view').then(m => m.PipelineRoutePendingView))

export const DASHBOARD_ROUTE_PENDING_VIEWS: Record<string, ComponentType> = {
  [ROOTS.dashboard.root]: dynamic(() => import('@/features/agent-dashboard/ui/components/dashboard-home-pending-view').then(m => m.DashboardHomePendingView)),
  [ROOTS.dashboard.customers.root()]: dynamic(() => import('@/features/agent-dashboard/ui/components/customers-route-pending-view').then(m => m.CustomersRoutePendingView)),
  [ROOTS.dashboard.meetings.root()]: dynamic(() => import('@/features/records-management/ui/views/meetings-records-view').then(m => m.MeetingsRecordsView)),
  [ROOTS.dashboard.proposals.root()]: dynamic(() => import('@/features/agent-dashboard/ui/components/proposals-route-pending-view').then(m => m.ProposalsRoutePendingView)),
  [ROOTS.dashboard.projects.root()]: dynamic(() => import('@/features/records-management/ui/views/projects-records-view').then(m => m.ProjectsRecordsView)),
  [ROOTS.dashboard.schedule()]: dynamic(() => import('@/features/schedule-management/ui/views/schedule-view').then(m => m.ScheduleView)),
  // The map matches the exact pathname, so every pipeline path gets its own key.
  ...Object.fromEntries(pipelines.map(pipeline => [ROOTS.dashboard.pipeline(pipeline), PipelineRoutePendingView])),
}
```

- [ ] **Step 7: Drop the dead `HydrateClient` fallback on the schedule page**

In `src/app/(frontend)/dashboard/schedule/page.tsx`, remove the import

```ts
import { LoadingState } from '@/shared/components/states/loading-state'
```

and change

```tsx
    <HydrateClient fallback={<LoadingState title="Loading schedule…" />}>
```

to

```tsx
    <HydrateClient>
```

(The view's `DataViewBoundary` suspends first, so that fallback could never show; with `loading.tsx` in place the route's own pending state is the view itself.)

- [ ] **Step 8: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both clean.

- [ ] **Step 9: Run the check**

```bash
node "$SDD/check-shells.mjs"
```

Expected: `PASS` — `docFresh.generic null`, `docFresh.own` a number; `docSchedule.generic null`; `docBogus.items` a number (the bogus slug falls back to Fresh and renders its cards; `bogusUrl` still ends in `/pipeline/bogus`, as today; `docBogus.generic` is usually a number, since that path has no map entry, and is reported, not asserted); `softFresh.shell` and `softSchedule.shell` numbers no later than their `items`; no errors. Then look yourself: a reload of `/dashboard/pipeline/fresh` shows the pipeline page with grey stat cards, the toolbar and skeleton columns from the first paint, never the generic three-block skeleton. One thing you will see and should expect: the pipeline select (super-admins only) is absent in the layout-level shell and appears once the session resolves, because the layout shell renders above `ServerAbilityProvider` and the default ability allows nothing. The records routes' gated controls behave the same way today.

- [ ] **Step 10: Commit**

```bash
git diff --cached --stat
git add "src/app/(frontend)/dashboard/pipeline/[pipeline]/loading.tsx" "src/app/(frontend)/dashboard/schedule/loading.tsx" src/features/agent-dashboard/ui/components/pipeline-route-pending-view.tsx src/features/agent-dashboard/constants/route-pending-views.ts "src/app/(frontend)/dashboard/schedule/page.tsx"
git commit -m "perf(pipeline,schedule): loading.tsx on both routes and the pipeline paths in the layout's pending map; the schedule page drops its dead HydrateClient fallback

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- "src/app/(frontend)/dashboard/pipeline/[pipeline]/loading.tsx" "src/app/(frontend)/dashboard/schedule/loading.tsx" src/features/agent-dashboard/ui/components/pipeline-route-pending-view.tsx src/features/agent-dashboard/constants/route-pending-views.ts "src/app/(frontend)/dashboard/schedule/page.tsx"
```

---

### Task 5: A pipeline switch keeps the query cache

**Files:**
- Modify: `src/shared/domains/pipelines/lib/on-pipeline-change.ts` (rewrite)
- Modify: `src/shared/domains/pipelines/hooks/use-pipeline-change.ts` (rewrite)
- Modify: `src/shared/constants/storage-keys.ts:7,9`
- Create (gitignored): `$SDD/check-switch.mjs`

**Interfaces:**
- Consumes: `STORAGE_KEYS.ACTIVE_PIPELINE` (kept; read by `getStoredPipeline` for the sidebar and the mobile dock), `ROOTS.dashboard.pipeline(pipeline)`.
- Produces: `onPipelineChange(next: Pipeline, navigate: (pipeline: Pipeline) => void): void` — stores the pipeline, then navigates. `usePipelineChange(): (next: Pipeline) => void` — unchanged signature; `app-sidebar.tsx` and `PipelineProvider` keep calling it as before. `STORAGE_KEYS.MEETINGS_SCOPE` and `STORAGE_KEYS.PROPOSALS_SCOPE` no longer exist.

- [ ] **Step 1: Write the check**

`$SDD/check-switch.mjs` — loads Fresh, switches to Rehash and back through the page's pipeline select, then does a quick double switch:

```js
import { BASE, openPage } from './check-lib.mjs'

const CARD = '.min-w-70 [data-slot="card"]'
const { browser, page, errors } = await openPage('/dashboard/pipeline/fresh')
await page.waitForSelector(CARD, { timeout: 120000 })
await page.waitForTimeout(3000)
const freshCards = await page.locator(CARD).count()

const freshReads = []
page.on('request', (request) => {
  const url = decodeURIComponent(request.url())
  if (url.includes('/api/trpc/') && url.includes('getCustomerPipelineItems') && url.includes('"pipeline":"fresh"')) {
    freshReads.push(Math.round(performance.now()))
  }
})

async function pick(name, path) {
  await page.locator('button[role=combobox]').first().click()
  const started = Date.now()
  await page.getByRole('option', { name: new RegExp(name, 'i') }).first().click()
  await page.waitForURL(`**${path}*`, { timeout: 60000 })
  const urlAt = Date.now() - started
  await page.waitForFunction(() => {
    const card = document.querySelector('.min-w-70 [data-slot="card"]')
    if (!card || document.querySelector('[data-slot="data-view-pending"]')) {
      return false
    }
    for (let node = card; node; node = node.parentElement) {
      const style = getComputedStyle(node)
      if (Number.parseFloat(style.opacity) < 0.99) {
        return false
      }
    }
    return true
  }, null, { timeout: 60000, polling: 16 })
  return { urlAt, shownAt: Date.now() - started, cards: await page.locator(CARD).count() }
}

const toRehash = await pick('Rehash', '/dashboard/pipeline/rehash')
await page.waitForTimeout(1500)
const backToFresh = await pick('Fresh', '/dashboard/pipeline/fresh')
// Counted here, inside the 30 s staleTime of the first load; the double switch below may run past it.
const clientFreshReadsOnReturn = freshReads.length
await page.waitForTimeout(1500)

// Two switches before the first one's rows can land.
await page.locator('button[role=combobox]').first().click()
await page.getByRole('option', { name: /rehash/i }).first().click()
await page.waitForURL('**/dashboard/pipeline/rehash*', { timeout: 60000 })
await page.locator('button[role=combobox]').first().click()
await page.getByRole('option', { name: /fresh/i }).first().click()
await page.waitForURL('**/dashboard/pipeline/fresh*', { timeout: 60000 })
await page.waitForSelector(CARD, { timeout: 60000 })
await page.waitForTimeout(4000)
const afterDouble = { url: page.url(), cards: await page.locator(CARD).count(), stored: await page.evaluate(() => localStorage.getItem('tri-pros:active-pipeline')) }
await browser.close()

console.log(JSON.stringify({ freshCards, toRehash, backToFresh, afterDouble, clientFreshReadsOnReturn, errors }, null, 2))
const pass = backToFresh.urlAt <= 1000
  && backToFresh.cards === freshCards
  && clientFreshReadsOnReturn === 0
  && afterDouble.url.endsWith('/dashboard/pipeline/fresh')
  && afterDouble.cards === freshCards
  && afterDouble.stored === 'fresh'
  && errors.length === 0
console.log(pass ? 'PASS' : 'FAIL')
process.exit(pass ? 0 : 1)
```

- [ ] **Step 2: Run it to see today's behavior fail**

```bash
node "$SDD/check-switch.mjs"
```

Expected: `FAIL` — `backToFresh.urlAt` in the thousands (the baseline measured 5.3 s) and `clientFreshReadsOnReturn` ≥ 1 (the invalidation refetches the Fresh board from the browser).

- [ ] **Step 3: Rewrite `onPipelineChange`**

Replace the whole of `src/shared/domains/pipelines/lib/on-pipeline-change.ts` with:

```ts
import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { STORAGE_KEYS } from '@/shared/constants/storage-keys'

// The stored pipeline is the sidebar's and the mobile dock's link target outside the pipeline routes. Nothing is
// invalidated here: a board's read carries its pipeline in the query key, so switching back lands on cached rows.
export function onPipelineChange(next: Pipeline, navigate: (pipeline: Pipeline) => void) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_PIPELINE, next)
  }
  catch {
    // SSR or storage unavailable
  }
  navigate(next)
}
```

- [ ] **Step 4: Rewrite `usePipelineChange`**

Replace the whole of `src/shared/domains/pipelines/hooks/use-pipeline-change.ts` with:

```ts
'use client'

import type { Pipeline } from '@/shared/constants/enums/pipelines'

import { useRouter } from 'next/navigation'
import { useCallback } from 'react'

import { ROOTS } from '@/shared/config/roots'
import { onPipelineChange } from '@/shared/domains/pipelines/lib/on-pipeline-change'

export function usePipelineChange() {
  const router = useRouter()

  return useCallback((next: Pipeline) => {
    onPipelineChange(next, pipeline => router.push(ROOTS.dashboard.pipeline(pipeline)))
  }, [router])
}
```

- [ ] **Step 5: Delete the two unread storage keys**

In `src/shared/constants/storage-keys.ts`, remove the lines

```ts
  MEETINGS_SCOPE: `${STORAGE_KEY_PREFIX}meetings-scope`,
```

and

```ts
  PROPOSALS_SCOPE: `${STORAGE_KEY_PREFIX}proposals-scope`,
```

so `STORAGE_KEYS` holds `ACTIVE_PIPELINE` and `SCHEDULE_SCOPE`. Then confirm nothing else referenced them:

```bash
grep -rn "MEETINGS_SCOPE\|PROPOSALS_SCOPE\|PIPELINE_SCOPED_KEYS\|invalidateQueries:" src
```

Expected: no output.

- [ ] **Step 6: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both clean. A type error in `app-sidebar.tsx` or `pipeline-context.tsx` here means the hook's return type changed; it must still be `(next: Pipeline) => void`.

- [ ] **Step 7: Run the check**

```bash
node "$SDD/check-switch.mjs"
```

Expected: `PASS` — `backToFresh.urlAt` under 1000 ms, `clientFreshReadsOnReturn 0`, the same Fresh card count after each return, `stored 'fresh'`, no errors. Expected look: switching back to Fresh shows the cached cards at once, dimmed to 50 % while the server's streamed prefetch for the new URL lands, then full opacity. That dim is the view's existing "background refetch" state, the same as after a drag.

- [ ] **Step 8: Probe the switch scenario**

```bash
node scripts/perf/page-probe.mjs pipeline-fresh 3 < /dev/null > "$SDD/after-task5-pipeline-fresh.txt" 2>&1
grep -B1 -A3 'switch pipeline' "$SDD/after-task5-pipeline-fresh.txt"
```

Expected on `switch pipeline → Fresh`: `url changed` ≤ 1000 ms (baseline 5274), `trpc` line without `getCustomerPipelineItems` (baseline ×2), `board fully shown` far below 7609 ms. `switch pipeline → Rehash` still fetches once (it was never loaded in that session).

- [ ] **Step 9: Commit**

```bash
git diff --cached --stat
git add src/shared/domains/pipelines/lib/on-pipeline-change.ts src/shared/domains/pipelines/hooks/use-pipeline-change.ts src/shared/constants/storage-keys.ts
git commit -m "perf(pipelines): a pipeline switch keeps the query cache; the unread scope storage keys go

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/domains/pipelines/lib/on-pipeline-change.ts src/shared/domains/pipelines/hooks/use-pipeline-change.ts src/shared/constants/storage-keys.ts
```

---

### Task 6: The Fresh read runs its follow-up queries together

**Files:**
- Modify: `src/shared/entities/customers/dal/server/pipeline-items.ts:236-304` (inside `getFreshPipelineItems`)
- Create (gitignored): `$SDD/check-fresh-parity.mjs`

**Interfaces:**
- Consumes: nothing new.
- Produces: the same `CustomerPipelineItem[]` as today, byte for byte; only the three independent follow-up reads run under one `Promise.all`.

- [ ] **Step 1: Write the parity check**

`$SDD/check-fresh-parity.mjs` — records what the Fresh board shows (per column: label, count, card names in order; plus the stat bar's text) for a role, and either saves it or compares it with the saved file:

```js
import fs from 'node:fs'
import process from 'node:process'
import { openPage } from './check-lib.mjs'

const [mode, role = 'super-admin'] = process.argv.slice(2)
if (!['save', 'compare'].includes(mode)) {
  console.error('Usage: node check-fresh-parity.mjs <save|compare> [super-admin|agent]')
  process.exit(1)
}
const file = new URL(`./fresh-${role}.json`, import.meta.url)

const { browser, page, errors } = await openPage('/dashboard/pipeline/fresh', `&role=${role}`)
await page.waitForFunction(() => !document.querySelector('[data-slot="data-view-pending"]') && !document.querySelector('[aria-busy="true"]'), null, { timeout: 120000 })
await page.waitForTimeout(3000)
const snapshot = await page.evaluate(() => ({
  stats: [...document.querySelectorAll('[data-slot="card"]:not(.min-w-70 [data-slot="card"])')].map(card => card.textContent?.replace(/\s+/g, ' ').trim()),
  columns: [...document.querySelectorAll('.min-w-70')].map(column => ({
    label: column.querySelector('span.text-sm')?.textContent?.trim() ?? '',
    count: column.querySelector('[data-slot="badge"]')?.textContent?.trim() ?? '',
    cards: [...column.querySelectorAll('[data-slot="card"] span.font-semibold')].map(name => name.textContent?.trim()),
  })),
}))
await browser.close()

if (errors.length > 0) {
  console.error(`page errors: ${errors.join(' | ')}`)
  process.exit(1)
}
if (mode === 'save') {
  fs.writeFileSync(file, JSON.stringify(snapshot, null, 2))
  console.log(`saved ${snapshot.columns.length} columns, ${snapshot.columns.reduce((n, c) => n + c.cards.length, 0)} cards, ${snapshot.stats.length} stats for ${role}`)
  process.exit(0)
}
const before = JSON.parse(fs.readFileSync(file, 'utf8'))
const same = JSON.stringify(before) === JSON.stringify(snapshot)
if (!same) {
  fs.writeFileSync(new URL(`./fresh-${role}-after.json`, import.meta.url), JSON.stringify(snapshot, null, 2))
  console.log(`DIFF — compare fresh-${role}.json with fresh-${role}-after.json`)
}
console.log(same ? `PASS (${role})` : `FAIL (${role})`)
process.exit(same ? 0 : 1)
```

Note: the stat bar cards (`StatCard` renders `Card`) and the kanban cards both use `data-slot="card"`; the `:not(.min-w-70 …)` selector keeps the stats apart. The count badge is `Badge`, which renders `data-slot="badge"`. The comparison only needs the same selectors before and after.

- [ ] **Step 2: Save the before snapshots, as admin and as agent**

```bash
node "$SDD/check-fresh-parity.mjs" save super-admin
node "$SDD/check-fresh-parity.mjs" save agent
```

Expected: two `saved … for <role>` lines with non-zero card counts (the agent fixture sees fewer cards than the admin).

- [ ] **Step 3: Run the three follow-ups together**

In `src/shared/entities/customers/dal/server/pipeline-items.ts`, inside `getFreshPipelineItems`, replace everything from

```ts
  const customerIds = rows.map(r => r.customerId)
```

down to and including

```ts
    .orderBy(desc(proposals.createdAt))
```

(the proposal summary query with its `proposalMap`, the rep query with its `repMap`, and the proposal-detail query) with:

```ts
  const customerIds = rows.map(r => r.customerId)

  // The three follow-ups need only the customer ids, so they run together.
  const [proposalRows, repRows, proposalDetailRows] = await Promise.all([
    // Pipeline value is read per-customer below from the stored final_tcp_cents
    // rollup (Wave 2). This aggregate query only counts + summarizes statuses.
    db
      .select({
        customerId: customers.id,
        proposalCount: count(proposals.id).as('proposal_count'),
        proposalStatuses: sql<string[] | string>`array_agg(DISTINCT ${proposals.status})`.as('proposal_statuses'),
        hasSentContract: sql<boolean>`bool_or(${proposals.contractSentAt} IS NOT NULL)`.as('has_sent_contract'),
        latestProposalAt: max(proposals.createdAt).as('latest_proposal_at'),
      })
      .from(proposals)
      .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
      .innerJoin(customers, eq(customers.id, meetings.customerId))
      .where(and(
        args.isOmni ? undefined : userParticipatesInMeeting(args.userId, proposals.meetingId),
        inArray(customers.id, customerIds),
      ))
      .groupBy(customers.id),
    // Assigned rep + meeting ID: owner of the most relevant meeting (latest by scheduledFor) per customer
    db
      .selectDistinctOn([meetings.customerId], {
        customerId: meetings.customerId,
        meetingId: meetings.id,
        meetingScheduledFor: meetings.scheduledFor,
        meetingConfirmedAt: meetings.confirmedAt,
        repId: user.id,
        repName: user.name,
        repEmail: user.email,
        repImage: user.image,
      })
      .from(meetings)
      .innerJoin(user, eq(user.id, meetings.ownerId))
      .where(and(
        inArray(meetings.customerId, customerIds),
        args.isOmni ? undefined : userParticipatesInMeeting(args.userId, meetings.id),
      ))
      .orderBy(meetings.customerId, desc(meetings.scheduledFor)),
    // Individual proposals per customer for card display + value calculation.
    // Value reads the stored final_tcp_cents rollup (Wave 2).
    db
      .select({
        customerId: meetings.customerId,
        meetingId: proposals.meetingId,
        proposalId: proposals.id,
        token: proposals.token,
        status: proposals.status,
        createdAt: proposals.createdAt,
        finalTcpCents: proposals.finalTcpCents,
      })
      .from(proposals)
      .innerJoin(meetings, eq(meetings.id, proposals.meetingId))
      .where(and(
        args.isOmni ? undefined : userParticipatesInMeeting(args.userId, proposals.meetingId),
        inArray(meetings.customerId, customerIds),
      ))
      .orderBy(desc(proposals.createdAt)),
  ])

  const proposalMap = new Map(proposalRows.map(r => [r.customerId, r]))

  const repMap = new Map(
    repRows
      .filter(r => r.customerId !== null)
      .map(r => [r.customerId!, {
        meetingId: r.meetingId,
        meetingScheduledFor: r.meetingScheduledFor,
        meetingConfirmedAt: r.meetingConfirmedAt,
        rep: { id: r.repId, name: r.repName, email: r.repEmail, image: r.repImage } as PipelineItemRep,
      }]),
  )
```

Everything from `const proposalDetailMap = new Map<string, PipelineItemProposal[]>()` onward stays as it is. Drizzle's query builders are thenables, so `Promise.all` starts all three at once and types each result as before.

- [ ] **Step 4: Type-check and lint**

```bash
pnpm tsc && pnpm lint
```

Expected: both clean. If `tsc` complains about `proposalRows`' element type, the summary query's `select` shape was altered in the paste; it must match the original field list exactly.

- [ ] **Step 5: Compare**

```bash
node "$SDD/check-fresh-parity.mjs" compare super-admin
node "$SDD/check-fresh-parity.mjs" compare agent
```

Expected: `PASS (super-admin)` and `PASS (agent)`. A `DIFF` means the other session changed data in the dev DB between the two runs or the selector drifted; re-save and re-compare once with the dev server idle. A persistent difference in card order or counts is a real regression: stop and report it.

- [ ] **Step 6: Note the server time**

```bash
grep '^server HTML' "$SDD/after-task5-pipeline-fresh.txt"
node scripts/perf/page-probe.mjs pipeline-fresh 3 < /dev/null > "$SDD/after-task6-pipeline-fresh.txt" 2>&1
grep '^server HTML' "$SDD/after-task6-pipeline-fresh.txt"
```

Expected: the Fresh `server HTML: total` median lower than Task 5's number (baseline 1771 ms). Dev timing is noisy; a drop of a few hundred ms is the expected size.

- [ ] **Step 7: Commit**

```bash
git diff --cached --stat
git add src/shared/entities/customers/dal/server/pipeline-items.ts
git commit -m "perf(pipelines): the Fresh read runs its three follow-up queries together

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- src/shared/entities/customers/dal/server/pipeline-items.ts
```

---

### Task 7: Re-measure, write the acceptance table, close the plan

**Files:**
- Create (gitignored): `$SDD/after-schedule.txt`, `$SDD/after-pipeline-fresh.txt`, `$SDD/after-pipeline-leads.txt`, `$SDD/acceptance.md`
- Delete (gitignored): `.superpowers/harness/pipeline-schedule-perf/probe.mjs`
- Modify: `docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md:3` (the Status line)
- Delete: `docs/superpowers/plans/2026-10-06-pipeline-schedule-speed-phase-1.md` (this plan)
- Modify: `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-pipeline-schedule-speed.md` and `MEMORY.md` (the index line)

**Interfaces:**
- Consumes: the baseline files in `.superpowers/harness/pipeline-schedule-perf/baseline-2026-10-05/` and every probe output above.
- Produces: `$SDD/acceptance.md`, the table Phase 2 starts from, and a spec whose Status line says Phase 1 shipped.

- [ ] **Step 1: Warm the routes, then probe the three pages**

```bash
for p in /dashboard /dashboard/pipeline/fresh /dashboard/pipeline/leads '/dashboard/schedule?show=meetings&s_d=2026-08-24'; do curl -s -o /dev/null "http://localhost:3000$p"; done
node scripts/perf/page-probe.mjs schedule 3 < /dev/null > "$SDD/after-schedule.txt" 2>&1
node scripts/perf/page-probe.mjs pipeline-fresh 3 < /dev/null > "$SDD/after-pipeline-fresh.txt" 2>&1
node scripts/perf/page-probe.mjs pipeline-leads 3 < /dev/null > "$SDD/after-pipeline-leads.txt" 2>&1
grep -E '^### |^server HTML|^>>> |^    runs|url changed|^=== (idle|hover)' "$SDD"/after-*.txt
```

Expected: three complete outputs, no `probe failed`.

- [ ] **Step 2: Write the acceptance table**

`$SDD/acceptance.md`, in the shape of `.superpowers/sdd/2026-10-01-records-table-render-isolation/acceptance.md`: a heading with the commit range (`git log --oneline <Task 1 commit>^..HEAD`), one table row per line below with Baseline → After and ✅/❌, then notes on any run you discarded and why. Fill every cell from the files; `—` only where the baseline file has no such number.

| Line | Where to read it | Baseline | Pass when |
|---|---|---|---|
| Schedule: sidebar click, content in DOM → fully shown | `runs:` under `>>> SIDEBAR CLICK` in `after-schedule.txt`, `contentShown − content` per run | 254 / 510 / 237 ms | every run ≤ 250 ms |
| Fresh: sidebar click, content in DOM → fully shown | same, `after-pipeline-fresh.txt` | 672 / 678 ms | every run ≤ 250 ms |
| Fresh: document load shows the page's own pending view first | `>>> DOCUMENT LOAD` `generic skeleton` | a number (generic skeleton painted first) | `NaN (min NaN)` |
| Schedule: document load shows the page's own pending view first | same, `after-schedule.txt` | NaN already | `NaN (min NaN)` |
| Fresh + Schedule: sidebar click shows a pending shell | `>>> SIDEBAR CLICK` `pending shell` | Schedule NaN; Fresh NaN on one run of three | a number on every run |
| Fresh: sidebar click → fully shown | `>>> SIDEBAR CLICK` `content fully shown` median | 3251 ms (min 2619) | report; the ≤ 1.5 s goal closes in Phase 2 |
| Switch → Fresh: URL change | `switch pipeline → Fresh` `url changed` | 5274 ms | ≤ 1000 ms |
| Switch → Fresh: client reads | that scenario's `trpc` line | `getCustomerPipelineItems ×2` | no `getCustomerPipelineItems` |
| Switch → Fresh: board fully shown | `board fully shown` | 7609 ms | report (lower) |
| Fresh: server HTML total | `server HTML:` | 1771 ms | report (lower) |
| Fresh parity, admin and agent | Task 6 output | n/a | both `PASS` |
| Hydration warnings, both pages | `>>> DOCUMENT LOAD` tail | 0/0/0 | 0/0/0 |
| Idle 5 s and hover sweep, both pages | `=== idle 5s ===`, `=== hover sweep ===` `card renders` | 0 | 0 |
| Leads: document load → interactive | `>>> DOCUMENT LOAD` `items interactive (hydrated)` | 6.7–18 s | report only; Phase 3 owns the target |

Copy the Phase 1 rows of spec §5 verbatim above the table so a reader sees goal and result together. Any ❌ stops here: fix, re-probe, and only then continue.

- [ ] **Step 3: Owner hand-checks to list, not to run**

Add a short "Owner hand-checks" section to `acceptance.md`, copied from spec §6 and limited to what Phase 1 touched: the highlight scroll from a push notification on an iPhone (the 250 ms wait); a drag in Fresh after a switch from Rehash (the cached board must still accept the move and refresh). Do not perform them.

- [ ] **Step 4: Delete the harness copy of the probe**

```bash
rm .superpowers/harness/pipeline-schedule-perf/probe.mjs
ls .superpowers/harness/pipeline-schedule-perf/
```

Expected: `baseline-2026-10-05  lib.mjs  step.mjs`. The step probe and the baselines stay: Phase 2 commits a step probe and measures the week-step target, and Phases 2 and 3 compare with these files.

- [ ] **Step 5: Mark the phase shipped and delete this plan**

In `docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md`, change line 3

```md
> **Status:** design approved in conversation 2026-10-05; spec written for the owner's review. Nothing is built.
```

to

```md
> **Status:** design approved 2026-10-05. **Phase 1 shipped <YYYY-MM-DD>** (acceptance: `.superpowers/sdd/2026-10-06-pipeline-schedule-speed-phase-1/acceptance.md`); Phases 2 and 3 not started.
```

with today's date. Then:

```bash
git diff --cached --stat
git rm docs/superpowers/plans/2026-10-06-pipeline-schedule-speed-phase-1.md
git add docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md
git commit -m "docs(specs): pipeline + schedule speed — Phase 1 shipped; its plan is deleted

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>" -- docs/superpowers/plans/2026-10-06-pipeline-schedule-speed-phase-1.md docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md
```

- [ ] **Step 6: Update memory**

In `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/memory/project-pipeline-schedule-speed.md`, replace the status sentence in the first paragraph (from "Awaiting the owner's spec review" to "**Nothing built.**") with: "**Phase 1 shipped <date>** (commits `<first>..<last>`; after-numbers in `.superpowers/sdd/2026-10-06-pipeline-schedule-speed-phase-1/acceptance.md`); next is `writing-plans` for Phase 2 (action hosts), starting from those numbers." Add one line under **Findings** with the two surprises most likely to matter in Phase 2 (for example: how long the cached Fresh board stays dimmed on a switch back; whether `generic skeleton` is `NaN` on `pipeline-leads` too). Update the `description:` front-matter line to say Phase 1 shipped. In `MEMORY.md`, change the index line's hook to "Phase 1 shipped <date> (one fade, loading.tsx, skeleton cards, cached switch, Fresh Promise.all); Phase 2 action hosts next".

- [ ] **Step 7: Report**

Tell the owner, in one message: the commit list, the acceptance table (paste it), the two hand-checks they owe, and whether anything in the table says ❌.

---

## Self-review (done while writing)

**Spec coverage, §3.1:** one fade → Task 2; `SCROLL_DEFER_MS` 600→250 with the iOS reason kept → Task 2; `pipeline/[pipeline]/loading.tsx` and `schedule/loading.tsx` → Task 4; `DASHBOARD_ROUTE_PENDING_VIEWS` per pipeline path via `PipelineRoutePendingView` → Task 4; `KanbanBoard isPending` → `KanbanColumn` skeletons, seeded 1–3 via `seededIntInRange(stage.key, KANBAN_SKELETON_CARDS_PER_STAGE)` → Task 3; `onPipelineChange` loses invalidation, `PIPELINE_SCOPED_KEYS` + the two storage keys go → Task 5; Fresh `Promise.all` → Task 6; dead `HydrateClient fallback` → Task 4. §4 names used: `KanbanCardSkeleton`, `KANBAN_SKELETON_CARDS_PER_STAGE`, `PipelineRoutePendingView`, `scripts/perf/page-probe.mjs`. §5 Phase 1 rows and §6's probe + read-only checks + owner hand-checks → Task 7. §8 first follow-up (delete the harness probe) → Task 7 Step 4, scoped to the probe file because the baselines serve Phases 2–3.

**Beyond the spec's letter, flagged for the owner:** (a) a pending column shows a small skeleton in place of its count badge and sets `aria-busy` on its card list (Task 3) — the spec names only the skeleton cards; (b) `seededIntInRange` is imported from the calendar helpers where it lives, not moved; (c) `STORAGE_KEYS.SCHEDULE_SCOPE` also has no readers but stays, since the spec names only the two keys.

**Placeholders:** none; every step carries its code or command. **Type consistency:** `isPending?: boolean` on both `KanbanBoard` and `KanbanColumn`; `onPipelineChange(next, navigate)` matches its one caller; `openPage(redirect, extra)` is used the same way in Tasks 2–6. **Review Focus:** all five lines have a test in the task that owns the code (Tasks 4, 5, 3, 6, 2).
