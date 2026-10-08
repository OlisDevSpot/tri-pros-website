# Pipeline and Schedule Speed, Phase 2 (one action host per view) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every meeting, proposal, customer and project card reads its actions from one host per view instead of calling the action-config hooks and mounting dialogs itself, so a board of 50 cards carries 4 hosts' worth of mutations and dialogs, not 50 cards' worth.

**Architecture:** Four thin client components (`MeetingActionsHost`, `ProposalActionsHost`, `CustomerActionsHost`, `ProjectActionsHost`), each at its module's address, call the existing action-config hook once with the view's overrides, render that hook's dialogs once and provide `actions` (plus `changeOutcome` and `manageParticipants` for meetings) through a context whose reader throws when no host is above it (spec R6). Cards drop their hook calls, dialogs and per-card handler props; every view that shows a card mounts the hosts it needs in the same commit as the card change. First, the board stops dimming for refetches the viewer did not cause (owner, 2026-10-08: the schedule → pipeline switch showed a faded board). Two card-hygiene fixes (`MeetingCard` memoized, `useIsMobile` read once per board) take the schedule and kanban cards to one render on mount. The probe re-measures at the end and the acceptance table decides whether the lazy-dropdown step (spec §3.2, "Re-measure, then decide") is taken in a later plan.

**Tech Stack:** Next.js 15 App Router, React 19 (`use`, `memo`, `useMemo`), TanStack Query 5 via tRPC 11, Radix dialogs and dropdowns, dnd-kit, Playwright (read-only checks against the dev server), `tsx` for a render check with `react-dom/server`.

**Spec:** `docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md`, §3.2 (design), §4 (names), §5 (targets: the rows marked Phase 2), §6 (verification), §7 (out of scope). Phase 1's acceptance, which is this phase's "before": `.superpowers/sdd/2026-10-06-pipeline-schedule-speed-phase-1/acceptance.md`.

## Sequencing note for the owner (read before Task 1)

The spec's Order line (owner, 2026-10-07; records tracker D64) puts records R2 **before** Phase 2. R2 has not landed on local `main` (no `src/shared/modules/customers/core/`; `customer-meetings-list.tsx`, `customer-projects-list.tsx` and `project-entity-card.tsx` still sit under `entities/customers/components/lists/`). This plan names today's paths for the files it modifies and the module addresses (D64) for the four new hosts. If R2 lands first, the three list files move and this plan's paths for them are the R2 ones (`entities/meetings/components/customer-meetings-list.tsx`, `modules/projects/core/components/customer-projects-list.tsx`, `modules/projects/core/components/project-entity-card.tsx`); nothing else here depends on R2. Executing before R2 is the owner's call (asked in the handoff).

## Global Constraints

- Verification per task is `pnpm tsc` then `pnpm lint`; never `pnpm build`.
- Never write to any database for testing, dev included: every browser check cancels or escapes the dialog it opens, drags end over the card's own stage, and nothing is submitted.
- Checks sign in through `/api/dev/playwright-session?secret=…` and never print `DEV_LOGIN_SECRET`; every error message passes through `redact()`.
- Dev numbers compare with dev numbers (Phase 1's acceptance), never with production.
- Commit by explicit path (`git add <paths>`), no stash, checkout or reset in the shared tree; another session is committing to the same `main`.
- Names come from spec §4: `MeetingActionsHost`, `ProposalActionsHost`, `CustomerActionsHost`, `ProjectActionsHost`, `useMeetingActionsHost`, `useProposalActionsHost`, `useCustomerActionsHost`, `useProjectActionsHost`, `manageParticipants`. No other new exported name; check scripts live in the gitignored workspace.
- New files go to module addresses (D64): `src/shared/modules/<module>/core/components/`; existing `entities/**` files stay where they are.
- Spec R6: a card and every view that renders it change in the same commit; the reader hook throws without a host; no fallback.
- Comments say why, never what; no plan, spec or task citations in code.
- `.superpowers/` is gitignored; the plan's workspace is `.superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/` (the `sdd-workspace` script prints it). Phase 1's workspace is another plan's; do not read or write it. Its numbers are quoted in this plan where needed.
- The dev server runs on `:3000` (`PORT` in `.env.local` otherwise); the schedule anchor with data is `?s_d=2026-08-24` (13 cards), the dashboard home's is `?dm_d=2026-08-24`.

## Review Focus

1. A meeting with no customer (`customerId` null: the row's left join found none): clicking the card or choosing View Meeting does nothing, instead of opening a profile for customer `''`. Test: Task 3 Step 2's `openMeetingProfile` guard, which `pnpm tsc` enforces (`CustomerProfileModal` takes `customerId: string`; the data carries `string | null`), re-checked in Task 4 Step 6.
2. One host, two cards: Manage Participants from card A, close, Manage Participants from card B opens the modal again for B; a dialog whose state used to die with its card now lives in the host. Test: Task 4 Step 14 (`check-actions.mjs schedule`, two cards in turn).
3. A host's own re-render (its modal opening, its confirm dialog) must not re-render the cards below it: the context value has to stay referentially stable. Test: Task 4 Step 14 and Task 6 Step 12 (card render deltas of 0 across open and close).
4. The kanban drag overlay renders a card copy through `renderCard(item, href, true)`: it must render inside the hosts (no throw while dragging), with the overlay's menus hidden as today. Test: Task 6 Step 12 (`check-actions.mjs fresh-drag`).
5. After `useIsMobile` moves to the board, a phone-width board still drags by the grip handle and a desktop board by the whole card. Test: Task 6 Step 12 (`check-actions.mjs fresh-mobile`, dnd-kit's `aria-roledescription="draggable"` on the handle at 500 px and on the card at 1400 px).

## File structure

**New (module addresses):**

| File | Responsibility |
|---|---|
| `src/shared/modules/meetings/core/components/meeting-actions-host.tsx` | `MeetingActionsHost` (calls `useMeetingActionConfigs` once, owns the one `ManageParticipantsModal`, renders the hook's three dialogs) and `useMeetingActionsHost(consumer)` |
| `src/shared/modules/proposals/core/components/proposal-actions-host.tsx` | `ProposalActionsHost` + `useProposalActionsHost(consumer)` |
| `src/shared/modules/customers/core/components/customer-actions-host.tsx` | `CustomerActionsHost` + `useCustomerActionsHost(consumer)` (first file of `modules/customers/core/`, per D64) |
| `src/shared/modules/projects/core/components/project-actions-host.tsx` | `ProjectActionsHost` + `useProjectActionsHost(consumer)` |

**Modified, by task:**

- Task 2 (board dim): `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` (dim on `data-stale` and a drag's refresh only; `aria-busy` while fetching; metrics bar loads on stale only).
- Task 4 (meetings): `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` (`onAssignOwner` required; the hook's internal participants dialog goes), `src/shared/entities/meetings/components/overview-card.tsx` (root reads the host; `customerId` required on the data; props `customerId`/`onAssignOwner`/`onAssignProject` go), `src/shared/entities/meetings/components/participants-slot.tsx` (compact variant calls `manageParticipants`), `src/shared/entities/customers/types.ts` + `src/shared/entities/meetings/dal/server/meetings-with-proposals.ts` (`customerId` on `CustomerProfileMeeting`), `src/features/schedule-management/ui/components/{schedule-meetings-calendar,schedule-calendar-dot,meeting-card}.tsx`, `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`, `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` (meeting parts), `src/features/agent-dashboard/ui/components/{dashboard-day-agenda,dashboard-meeting-card}.tsx`, `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx`, `src/shared/entities/customers/components/lists/{customer-meetings-list,customer-projects-list,project-entity-card}.tsx`, `src/shared/entities/meetings/components/project-meeting-list.tsx`, `src/features/records-management/ui/components/project-row-panel/{index,project-sales-history-pane}.tsx`.
- Task 5 (proposals): `src/shared/modules/proposals/core/components/overview-card.tsx`, `src/shared/entities/meetings/components/meeting-proposal-row.tsx`, `src/features/records-management/ui/components/meeting-row-panel/meeting-proposals-pane.tsx`, `src/features/agent-dashboard/ui/components/dashboard-proposal-section-list.tsx`, plus the pipeline view, kanban card (`KanbanProposalRow`), profile tab panels, project meeting list and sales-history pane from Task 4.
- Task 6 (customers, projects, `isMobile`): `src/shared/entities/customers/hooks/use-customer-action-configs.ts` (`CustomerEntity` gains `name`), the kanban card and pipeline view, `src/features/agent-dashboard/ui/components/{dashboard-project-card,dashboard-project-section-list}.tsx`, `project-entity-card.tsx`, profile tab panels.
- Task 7: `meeting-card.tsx` (schedule) and `schedule-meetings-calendar.tsx` (`highlightRef` only for the highlighted card).
- Task 8: `docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md` (status line), this plan (deleted).

**Not in this plan (found while planning, for the owner):** `src/shared/entities/customers/components/lists/proposal-row.tsx` has no importers (dead; it calls `useProposalActionConfigs` per row). `MeetingProposalRow`'s `onMutationSuccess` prop is unused (`_onMutationSuccess`). Both stay as they are.

---

### Task 1: Workspace, check library, census and host-required checks, before-numbers

**Files:**
- Create (gitignored workspace): `.superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-lib.mjs`, `check-census.mjs`, `check-host-required.tsx`
- Output: `.superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/before-schedule.txt`, `before-pipeline-fresh.txt`, `before-census-*.txt`

**Interfaces:**
- Produces: `openPage(redirect, extra = '', { viewport, init }) → { browser, page, errors }`, `BASE`, `redact(text)`, `installCensus(cardNames)` (an init script: counts renders per card component in `window.__renders[name]` and exposes `window.__census()` → `{ fibers, mutationObservers, counts, dom }`); `node check-census.mjs <path> <cardName> [extra] [--step <ButtonName>]` prints one JSON line `{ cards, mutationObservers, dialogContents, cardRenders, step? }`; `pnpm exec tsx .superpowers/sdd/…/check-host-required.tsx` prints `PASS`/`FAIL` lines and exits 1 on any FAIL. Every later task's browser check imports `check-lib.mjs`.

- [ ] **Step 1: Confirm the dev server and the schedule read**

Run: `ss -ltnp | grep -E ':3000\b' && curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/dashboard/schedule`
Expected: a `next-server` listener and `200` (or `307` to sign-in). If nothing listens, start `pnpm dev` in another terminal first. Phase 1's final schedule probe failed on `meetingsRouter.reads.list` 500s because the meetings schema (commit `56893395`) was not on the dev database; the permissions memory says it was pushed 2026-10-08. Step 5 is the test of that.

- [ ] **Step 2: Create the workspace and the check library**

Run: `/home/olis-solutions/.claude/plugins/cache/claude-plugins-official/superpowers/6.4.1/skills/subagent-driven-development/scripts/sdd-workspace docs/superpowers/plans/2026-10-08-pipeline-schedule-speed-phase-2.md`
Expected: prints `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2`.

Write `check-lib.mjs` (run every check from the repo root; `loadEnvFile` resolves `.env.local` against the cwd):

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
// Playwright's errors quote the URL, which carries the secret.
export const redact = text => String(text).replaceAll(encodeURIComponent(secret), '***').replaceAll(secret, '***')

/**
 * A signed-in page at `redirect`. `extra` appends to the dev sign-in query (`&role=agent`, `&as=<email>`);
 * `init` is `[fn, arg]` for `page.addInitScript`, installed before the app's JS runs.
 */
export async function openPage(redirect, extra = '', { viewport = { width: 1400, height: 900 }, init } = {}) {
  const browser = await chromium.launch()
  const page = await (await browser.newContext({ viewport })).newPage()
  if (init) {
    await page.addInitScript(init[0], init[1])
  }
  const errors = []
  page.on('pageerror', error => errors.push(redact(error.message).split('\n')[0]))
  try {
    await page.goto(`${BASE}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent(redirect)}${extra}`, { timeout: 180000 })
  }
  catch (error) {
    await browser.close()
    throw new Error(redact(error.message))
  }
  return { browser, page, errors }
}

/** Waits until a component named `cardName` has fibers (hydration or the first client render is done), then a settle. */
export async function waitForCards(page, cardName, settleMs = 2000) {
  await page.waitForFunction(name => (window.__census?.().counts[name] ?? 0) > 0, cardName, { timeout: 180000, polling: 250 })
  await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 60000, polling: 100 })
  await page.waitForTimeout(settleMs)
}

/**
 * Init script (serialized by Playwright, so it is self-contained): a fake devtools hook that counts renders of the
 * named card components in `window.__renders` and exposes `window.__census()` over the last committed root.
 */
export function installCensus(cardNames) {
  window.__renders = {}
  const seen = new WeakMap()
  let commit = 0
  let lastRoot = null
  window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map(),
    supportsFiber: true,
    inject(renderer) {
      const id = this.renderers.size + 1
      this.renderers.set(id, renderer)
      return id
    },
    onScheduleFiberRoot() {},
    onCommitFiberUnmount() {},
    onPostCommitFiberRoot() {},
    checkDCE() {},
    onCommitFiberRoot(_id, root) {
      commit++
      lastRoot = root
      const stack = [root.current.child]
      while (stack.length > 0) {
        const fiber = stack.pop()
        if (!fiber) {
          continue
        }
        const type = fiber.type?.type ?? fiber.type
        if (typeof type === 'function') {
          const name = type.displayName || type.name || 'anon'
          if (cardNames.includes(name)) {
            const mine = seen.get(fiber)
            const theirs = fiber.alternate ? seen.get(fiber.alternate) : undefined
            const last = !mine ? theirs : !theirs ? mine : (mine.at > theirs.at ? mine : theirs)
            if (!last || last.props !== fiber.memoizedProps || last.state !== fiber.memoizedState) {
              window.__renders[name] = (window.__renders[name] ?? 0) + 1
            }
            seen.set(fiber, { props: fiber.memoizedProps, state: fiber.memoizedState, at: commit })
          }
        }
        if (fiber.sibling) {
          stack.push(fiber.sibling)
        }
        if (fiber.child) {
          stack.push(fiber.child)
        }
      }
    },
  }
  window.__census = () => {
    const counts = {}
    let mutationObservers = 0
    let fibers = 0
    const stack = lastRoot ? [lastRoot.current.child] : []
    while (stack.length > 0) {
      const fiber = stack.pop()
      if (!fiber) {
        continue
      }
      const type = fiber.type?.type ?? fiber.type
      if (typeof type === 'function') {
        fibers++
        const name = type.displayName || type.name || 'anon'
        counts[name] = (counts[name] ?? 0) + 1
        for (let hook = fiber.memoizedState, guard = 0; hook && typeof hook === 'object' && 'next' in hook && guard < 400; hook = hook.next, guard++) {
          const value = hook.memoizedState
          if (value?.constructor?.name === 'MutationObserver' && typeof value.mutate === 'function') {
            mutationObservers++
          }
        }
      }
      if (fiber.sibling) {
        stack.push(fiber.sibling)
      }
      if (fiber.child) {
        stack.push(fiber.child)
      }
    }
    return { fibers, mutationObservers, counts, dom: document.querySelectorAll('*').length }
  }
}
```

- [ ] **Step 3: Write the census check**

`check-census.mjs`:

```js
import process from 'node:process'
import { installCensus, openPage, redact, waitForCards } from './check-lib.mjs'

// Usage: node check-census.mjs <path> <cardName> [extra] [--step Previous|Next]
// cardName is the component function's name as React sees it (CustomerKanbanCardImpl, MeetingCard, ...).
const args = process.argv.slice(2)
const stepIndex = args.indexOf('--step')
const stepName = stepIndex >= 0 ? args.splice(stepIndex, 2)[1] : null
const [path, cardName, extra = ''] = args
if (!path || !cardName) {
  console.error('Usage: node check-census.mjs <path> <cardName> [extra] [--step Previous|Next]')
  process.exit(1)
}

const { browser, page, errors } = await openPage(path, extra, { init: [installCensus, [cardName]] })
try {
  await waitForCards(page, cardName)
  const read = () => page.evaluate((name) => {
    const census = window.__census()
    return { cards: census.counts[name] ?? 0, mutationObservers: census.mutationObservers, dialogContents: census.counts.DialogContent ?? 0, cardRenders: window.__renders[name] ?? 0 }
  }, cardName)
  const result = await read()
  if (stepName) {
    const before = result.cardRenders
    await page.getByRole('button', { name: stepName, exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 60000, polling: 16 })
    await page.waitForTimeout(2500)
    const after = await read()
    result.step = { name: stepName, cards: after.cards, cardRenders: after.cardRenders - before }
  }
  result.pageErrors = errors
  console.log(JSON.stringify(result))
}
catch (error) {
  console.error(redact(error.message).split('\n')[0])
  process.exitCode = 1
}
await browser.close()
```

- [ ] **Step 4: Write the host-required check (RED for Task 3)**

`check-host-required.tsx` (the `React` import is needed: the repo's tsconfig keeps `jsx: preserve`, so `tsx` compiles JSX to `React.createElement`):

```tsx
import React from 'react'
import { renderToString } from 'react-dom/server'

import { MeetingActionsHost, useMeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'

let failed = false
function expectThrow(label: string, element: React.ReactElement, pattern: RegExp) {
  try {
    renderToString(element)
    console.log(`FAIL ${label}: rendered without throwing`)
    failed = true
  }
  catch (error) {
    const message = (error as Error).message.split('\n')[0]
    const ok = pattern.test(message)
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: ${message.slice(0, 140)}`)
    failed ||= !ok
  }
}

function MeetingProbe() {
  useMeetingActionsHost('MeetingProbe')
  return null
}

// Without a host the reader throws its own message. With one, the host's hook reaches Next's useRouter, which has
// no app router here: a different error, which proves the provider rendered before the probe.
expectThrow('useMeetingActionsHost without a host', <MeetingProbe />, /MeetingProbe needs a <MeetingActionsHost> above it/)
expectThrow('useMeetingActionsHost inside a host', <MeetingActionsHost><MeetingProbe /></MeetingActionsHost>, /app router to be mounted/)

process.exit(failed ? 1 : 0)
```

- [ ] **Step 5: Run the host-required check (RED) and the before-probes**

Run: `pnpm exec tsx .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx`
Expected: exits non-zero with `Cannot find module '@/shared/modules/meetings/core/components/meeting-actions-host'` (the host does not exist yet). This is Task 3's RED.

Run (one at a time; each takes several minutes; the dev server must be warm):
```bash
node scripts/perf/page-probe.mjs schedule 3 < /dev/null > .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/before-schedule.txt 2>&1
node scripts/perf/page-probe.mjs pipeline-fresh 3 < /dev/null > .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/before-pipeline-fresh.txt 2>&1
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-census.mjs '/dashboard/schedule?show=meetings&s_d=2026-08-24' MeetingCard --step Previous > .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/before-census-schedule.txt
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-census.mjs /dashboard/pipeline/fresh CustomerKanbanCardImpl > .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/before-census-fresh.txt
```
Expected: `before-schedule.txt` has a `>>> MOUNTED (13 items)` line with `useMutation observers` near 304–347 and `DialogContent×7x`, and the four week-step scenarios end with `card renders 24 (max 3 per card)` or similar (Phase 1 measured 24/9/24/52 with max 3–4). If the DOCUMENT LOAD section shows `console issues` with `meetingsRouter.reads.list` 500s, the schema is still not pushed: stop and tell the owner; the plan cannot measure the schedule without it. `before-pipeline-fresh.txt`'s MOUNTED line: `useMutation observers` ≈ 1425, `DialogContent×3xx`. `before-census-schedule.txt`: `cards 13`, `cardRenders` ≥ 26 (2–3 per card on mount), `step.cardRenders` ≥ 2 × `step.cards`. `before-census-fresh.txt`: `cards 50`, `cardRenders 100` (2 per card), `dialogContents` ≥ 300, `mutationObservers` ≥ 1200.

- [ ] **Step 6: Record the baseline in the ledger**

Append to the ledger (`progress.md` in the workspace) one line per file with the MOUNTED numbers and the census JSON. No commit: the workspace is gitignored and nothing in the repo changed.

---

### Task 2: The board dims only for a refetch the viewer caused

**Files:**
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx:56-66,121,128,145-151`
- Test: `.superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-nav-dim.mjs` (new)

**Why (owner, 2026-10-08):** coming to a pipeline from the schedule, the board shows its cached cards at 50% for about a second. Measured: within 30 s of the last visit there is no dim and no client read; past the 30 s `staleTime` the view mounts on stale cached rows, TanStack refetches them on mount while the server's streamed prefetch is still in flight, and the board's `query.isFetching && !query.isStale → opacity-50` rule dims it until that read returns (`diag`: dimmed 4196–5177 ms after the click, one client `getCustomerPipelineItems` read). The records tables dim on `data-stale` alone ("the one faded state": rows of the previous query) and only mark `aria-busy` while fetching; Phase 1's removed fades used to hide the board's extra dim.

**Interfaces:**
- Consumes: `useDataViewQuery` result (`isPending`, `isStale`, `isFetching`, `refresh(): Promise<void>` = `invalidateQueries`), `useMutation` for the move.
- Produces: the board wrapper dims on `data-stale` and while a drag's move is pending or its refresh is settling; `aria-busy` while any fetch runs; `CustomerPipelineMetricsBar` loads on `isPending || isStale` only. Nothing exported changes. Later tasks edit this file further (hosts, `isMobile`) and keep this rule.

- [ ] **Step 1: Write the navigation check (RED)**

`check-nav-dim.mjs` (imports Task 1's library; run from the repo root). It warms the Fresh board, goes to the schedule, comes back at once (inside `staleTime`) and again after 35 s (past it), samples the board wrapper's computed opacity every 50 ms for 6 s after each click, and fails if any sample with cards on screen is below 1. It prints the client tRPC reads so the duplicate read stays visible.

```js
import { openPage, redact } from './check-lib.mjs'

const BOARD = '[data-stale], .flex-1.min-h-0.transition-opacity'
const CARD = '.min-w-70 [data-slot="card"]'

const { browser, page, errors } = await openPage('/dashboard/pipeline/fresh')
const reads = []
let t0 = Date.now()
page.on('request', (request) => {
  if (request.url().includes('/api/trpc/')) {
    reads.push(`${Date.now() - t0}ms ${decodeURIComponent(request.url().split('/api/trpc/')[1].split('?')[0])}`)
  }
})
try {
  await page.waitForSelector(CARD, { timeout: 120000 })
  await page.waitForFunction(selector => Object.keys(document.querySelector(selector) ?? {}).some(k => k.startsWith('__reactFiber')), CARD, { timeout: 120000 })
  await page.waitForTimeout(3000)
  await page.getByRole('link', { name: /schedule/i }).first().click()
  await page.waitForURL('**/dashboard/schedule**', { timeout: 60000 })
  await page.waitForFunction(() => !document.querySelector('[data-slot="data-view-pending"]') && !document.querySelector('[aria-busy="true"]'), null, { timeout: 120000, polling: 100 })
  await page.waitForTimeout(3000)

  for (const [label, wait] of [['inside staleTime', 3000], ['past staleTime', 35000]]) {
    reads.length = 0
    t0 = Date.now()
    const sampler = page.evaluate(([board, card]) => new Promise((resolve) => {
      const samples = []
      const start = performance.now()
      const tick = () => {
        const wrapper = document.querySelector(board)
        const cards = document.querySelectorAll(card).length
        samples.push({ t: Math.round(performance.now() - start), cards, dim: wrapper ? Number(getComputedStyle(wrapper).opacity) : null, stale: wrapper?.getAttribute('data-stale') ?? null })
        if (performance.now() - start < 6000) {
          setTimeout(tick, 50)
        }
        else {
          resolve(samples)
        }
      }
      tick()
    }), [BOARD, CARD])
    await page.getByRole('link', { name: /pipeline/i }).first().click()
    const samples = await sampler
    const dimmed = samples.filter(s => s.cards > 0 && s.dim != null && s.dim < 1)
    const firstCards = samples.find(s => s.cards > 0)
    const ok = dimmed.length === 0 && firstCards
    console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: cards at ${firstCards?.t ?? '—'}ms · dimmed-with-cards ${dimmed.length} samples${dimmed.length ? ` (${dimmed[0].t}–${dimmed.at(-1).t}ms, opacity ${dimmed[0].dim}, data-stale ${dimmed[0].stale ?? 'unset'})` : ''}`)
    console.log(`     client reads: ${reads.join(' | ') || 'none'}`)
    if (!ok) {
      process.exitCode = 1
    }
    await page.getByRole('link', { name: /schedule/i }).first().click()
    await page.waitForURL('**/dashboard/schedule**', { timeout: 60000 })
    await page.waitForTimeout(wait)
  }
}
catch (error) {
  console.error(`FAIL ${redact(error.message).split('\n')[0]}`)
  process.exitCode = 1
}
if (errors.length > 0) {
  console.error(`FAIL page errors: ${errors.join(' | ')}`)
  process.exitCode = 1
}
await browser.close()
```

Run: `node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-nav-dim.mjs`
Expected: `PASS inside staleTime` (no dim, `client reads: none`) and `FAIL past staleTime: … dimmed-with-cards ≥ 5 samples (opacity 0.5, data-stale unset)` with one `customerPipelinesRouter.getCustomerPipelineItems` client read; exit 1. (The loop's first wait is 3 s and its second 35 s, so the second click is the stale one.)

- [ ] **Step 2: Dim on the drag's refresh only; the metrics bar loads on stale only**

In `customer-pipeline-view.tsx`, replace the move mutation (lines 56–66) with:

```tsx
  // A refetch the viewer caused (a drag's move) dims the board until the rows land. A background refetch (the
  // server's prefetch adopted on navigation, a stale re-read on mount) does not: the rows on screen stay at full
  // opacity until the new ones replace them, as the records tables do.
  const [settlingMove, setSettlingMove] = useState(false)
  const moveMutation = useMutation(
    trpc.customerPipelinesRouter.moveCustomerPipelineItem.mutationOptions({
      onError: () => {
        toast.error('Failed to move customer. Please try again.')
      },
      onSettled: () => {
        setSettlingMove(true)
        void query.refresh().finally(() => setSettlingMove(false))
      },
    }),
  )
  const isMoving = moveMutation.isPending || settlingMove
```

(`onSettled` runs after `onError` too, so the refresh that `onError` used to call on its own is the same refresh.) Delete `const isSwitching = query.isStale || query.isFetching` (line 121). The metrics bar: `isLoading={query.isPending || query.isStale}`. The board wrapper (lines 145–151):

```tsx
      {/* A filter change dims only after a short delay (quick loads never flash); a drag's refresh dims at once. */}
      <div
        data-stale={query.isStale || undefined}
        aria-busy={query.isFetching || undefined}
        className={cn(
          'flex-1 min-h-0 transition-opacity duration-200 data-[stale=true]:pointer-events-none data-[stale=true]:opacity-50 data-[stale=true]:delay-200',
          isMoving && 'opacity-50 pointer-events-none',
        )}
      >
```

- [ ] **Step 3: Run the check (GREEN), type-check, lint**

Run: `node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-nav-dim.mjs`
Expected: `PASS inside staleTime` and `PASS past staleTime` with `dimmed-with-cards 0 samples`; the past-staleTime line still lists the client `getCustomerPipelineItems` read (that duplicate read is the data-view hook's `refetchOnMount` on stale rows racing the server prefetch, shared with every records route; it goes to the owner as a finding, not fixed here). Exit 0.

Run: `pnpm tsc` then `pnpm lint`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx
git commit -m "fix(pipeline): the board dims only for a drag's own refresh; a background refetch leaves the cards at full opacity, as the records tables do

Coming back from the schedule past staleTime, the stale cached rows refetched on mount while the server's prefetch streamed, and the board sat at 50% until the read returned.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: `MeetingActionsHost`

**Files:**
- Create: `src/shared/modules/meetings/core/components/meeting-actions-host.tsx`
- Test: `.superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx` (Task 1 Step 4)

**Interfaces:**
- Consumes: `useMeetingActionConfigs(overrides)` from `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` as it is today (`onAssignOwner` still optional; Task 4 makes it required), `ManageParticipantsModal({ meetingIds, open, onOpenChange })`, `CustomerProfileModal` + `openModal` (the card's own profile-opening call today), `useStableCallbacks` from `src/shared/hooks/use-stable-callbacks.ts`.
- Produces:
  ```ts
  export function MeetingActionsHost(props: { overrides?: Omit<MeetingActionOverrides, 'onAssignOwner'>, children: ReactNode }): JSX.Element
  export function useMeetingActionsHost(consumer: string): {
    actions: ReturnType<typeof useMeetingActionConfigs>['actions']        // EntityActionConfig<MeetingEntity>[]
    changeOutcome: (meetingId: string, outcome: MeetingOutcome) => Promise<void>
    manageParticipants: (meetingId: string) => void
  }
  ```
  where `MeetingActionOverrides` is `NonNullable<Parameters<typeof useMeetingActionConfigs>[0]>` (the hook's overrides for its constraint type: `onView`, `onStart`, `onViewSchedule`, `onAssignProject`, `onCreateProposal`, each `(entity) => void`). The reader throws `` `${consumer} needs a <MeetingActionsHost> above it` `` when no host is mounted. The default `onView` opens the customer's profile on the meeting and does nothing for a meeting without a customer.

- [ ] **Step 1: Run the check to see it fail for the right reason**

Run: `pnpm exec tsx .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx`
Expected: `Cannot find module '@/shared/modules/meetings/core/components/meeting-actions-host'`.

- [ ] **Step 2: Write the host**

`src/shared/modules/meetings/core/components/meeting-actions-host.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import { createContext, use, useCallback, useState } from 'react'

import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { ManageParticipantsModal } from '@/shared/entities/meetings/components/manage-participants-modal'
import { useMeetingActionConfigs } from '@/shared/entities/meetings/hooks/use-meeting-action-configs'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'
import { openModal } from '@/shared/lib/open-modal'

type MeetingActionConfigs = ReturnType<typeof useMeetingActionConfigs>
type MeetingActionOverrides = NonNullable<Parameters<typeof useMeetingActionConfigs>[0]>

interface MeetingActionsHostValue {
  actions: MeetingActionConfigs['actions']
  /** The ⋯ menu's Set Outcome and a card's editable outcome badge share this one reason-dialog flow. */
  changeOutcome: MeetingActionConfigs['changeOutcome']
  /** Opens the host's one participants modal for a meeting. */
  manageParticipants: (meetingId: string) => void
}

const MeetingActionsHostContext = createContext<MeetingActionsHostValue | null>(null)

interface MeetingActionsHostProps {
  /** View-level handlers. Each takes the entity, so one `actions` array serves every card below the host. */
  overrides?: Omit<MeetingActionOverrides, 'onAssignOwner'>
  children: ReactNode
}

// A meeting without a customer has no profile to open.
function openMeetingProfile(entity: { id: string, customerId?: string | null }) {
  if (!entity.customerId) {
    return
  }
  openModal({
    accessor: 'CustomerProfile',
    Component: CustomerProfileModal,
    props: { customerId: entity.customerId, defaultTab: 'meetings' as const, highlightMeetingId: entity.id },
  })
}

export function MeetingActionsHost({ overrides, children }: MeetingActionsHostProps) {
  const [participantsMeetingId, setParticipantsMeetingId] = useState<string | null>(null)
  const manageParticipants = useCallback((meetingId: string) => setParticipantsMeetingId(meetingId), [])

  const { actions, DeleteConfirmDialog, OutcomeReasonDialog, RescheduleDialog, changeOutcome } = useMeetingActionConfigs({
    onView: openMeetingProfile,
    ...overrides,
    onAssignOwner: entity => manageParticipants(entity.id),
  })

  // Stable while `actions` is: the host re-rendering (its modal opening, a confirm dialog) must not re-render
  // every card below it.
  const value = useStableCallbacks<MeetingActionsHostValue>({ actions, changeOutcome, manageParticipants })

  return (
    <MeetingActionsHostContext value={value}>
      <DeleteConfirmDialog />
      <OutcomeReasonDialog />
      <RescheduleDialog />
      <ManageParticipantsModal
        meetingIds={participantsMeetingId ? [participantsMeetingId] : []}
        open={participantsMeetingId !== null}
        onOpenChange={open => !open && setParticipantsMeetingId(null)}
      />
      {children}
    </MeetingActionsHostContext>
  )
}

export function useMeetingActionsHost(consumer: string): MeetingActionsHostValue {
  const value = use(MeetingActionsHostContext)
  if (!value) {
    throw new Error(`${consumer} needs a <MeetingActionsHost> above it`)
  }
  return value
}
```

- [ ] **Step 3: Run the check to see it pass**

Run: `pnpm exec tsx .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx`
Expected:
```
PASS useMeetingActionsHost without a host: MeetingProbe needs a <MeetingActionsHost> above it
PASS useMeetingActionsHost inside a host: invariant expected app router to be mounted
```
exit 0.

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc` then `pnpm lint`
Expected: both clean apart from the other session's pre-existing warnings (`use-step-engine.ts`, `push-subscription-banner.tsx`, `optimized-image.tsx`, `proposal-email.tsx`). The host has no consumer yet, so nothing else changes.

- [ ] **Step 5: Commit**

```bash
git add src/shared/modules/meetings/core/components/meeting-actions-host.tsx
git commit -m "feat(meetings): MeetingActionsHost — one action-config hook, one participants modal and one set of dialogs per view, read through a context that throws without a host

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Meeting cards and every meeting-card view onto the host (one commit, R6)

**Files:**
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx:1-105,166-170,208-210`
- Modify: `src/shared/entities/meetings/components/overview-card.tsx:1-150` (types, context, root)
- Modify: `src/shared/entities/meetings/components/participants-slot.tsx:300-382` (compact variant)
- Modify: `src/shared/entities/customers/types.ts:7-9`, `src/shared/entities/meetings/dal/server/meetings-with-proposals.ts:16-25,106-116`
- Modify: `src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx`, `schedule-calendar-dot.tsx`, `meeting-card.tsx`
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx`, `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` (meeting parts only; Task 6 finishes it)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-day-agenda.tsx`, `dashboard-meeting-card.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx`, `src/shared/entities/customers/components/lists/customer-meetings-list.tsx`, `customer-projects-list.tsx`, `project-entity-card.tsx`, `src/shared/entities/meetings/components/project-meeting-list.tsx`
- Modify: `src/features/records-management/ui/components/project-row-panel/index.tsx`, `project-sales-history-pane.tsx`
- Test: `check-host-required.tsx` (extended), new `check-actions.mjs` in the workspace, `check-census.mjs`

**Interfaces:**
- Consumes: `MeetingActionsHost`, `useMeetingActionsHost(consumer)` from Task 3.
- Produces: `MeetingOverviewCardData` with `customerId: string | null` **required**; `MeetingOverviewCard` root props are `{ meeting, children } & Omit<ComponentProps<'div'>, 'onClick'>` (no `customerId`, `onAssignOwner`, `onAssignProject`); `useMeetingActionConfigs` overrides require `onAssignOwner` and the result no longer has `AssignOwnerDialog`; `CustomerProfileMeeting` has `customerId: string | null`; `ParticipantsSlot`'s compact variant needs a `MeetingActionsHost`; `ScheduleCalendarDot({ event, onUpdateScheduledFor })` (no `actions`); `MeetingCard({ event, onUpdateScheduledFor, isHighlighted?, highlightRef? })`; `CustomerKanbanCard` loses `onAssignRep`; `CustomerMeetingsList({ meetings, highlightMeetingId? })`; `ProjectMeetingList({ meetings, onMutationSuccess, onNavigate?, highlightMeetingId? })`; `ProjectEntityCard({ project, onMutationSuccess, onNavigate?, highlightMeetingId? })`; `ProjectSalesHistoryPane({ meetings, isLoading, onMutationSuccess })`. Task 5 and Task 6 consume these.

- [ ] **Step 1: Extend the host-required check with the card and the slot (RED)**

In `check-host-required.tsx`, add after the imports:

```tsx
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { ParticipantsSlot } from '@/shared/entities/meetings/components/participants-slot'
```

and before `process.exit`:

```tsx
expectThrow(
  'MeetingOverviewCard without a host',
  <MeetingOverviewCard meeting={{ id: 'm1', customerId: null }}><span /></MeetingOverviewCard>,
  /MeetingOverviewCard needs a <MeetingActionsHost> above it/,
)
expectThrow(
  'ParticipantsSlot (compact) without a host',
  <ParticipantsSlot meetingId="m1" variant="compact" initialParticipants={[{ id: 'u1', name: 'Rep', image: null, role: 'owner' }]} />,
  /ParticipantsSlot needs a <MeetingActionsHost> above it/,
)
```

Run: `pnpm exec tsx .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx`
Expected: the two new lines are `FAIL … invariant expected app router to be mounted` (the card still calls the hook itself) and `FAIL … ` (the slot reaches `useTRPC` or `useAbility` first). Exit 1. (`tsx` type-checks nothing, so the `customerId: null` the type does not yet allow is not an error here.)

- [ ] **Step 2: The hook: `onAssignOwner` required, its internal participants dialog goes**

In `use-meeting-action-configs.tsx`:

Delete lines 25–40 (`// ── Stable top-level component …` through `InternalAssignOwnerDialog`'s closing brace) and the `ManageParticipantsModal` import (line 13). Change the React import to `import { useCallback } from 'react'` only if `useCallback` remains in use after the edits below; otherwise delete the line entirely (`JSX` stays a type import).

Replace the override and result types:

```ts
interface MeetingActionOverrides<T extends MeetingEntity> {
  onView?: (entity: T) => void
  onStart?: (entity: T) => void
  onViewSchedule?: (entity: T) => void
  onAssignProject?: (entity: T) => void
  onCreateProposal?: (entity: T) => void
  /** Required: whoever calls this hook owns the participants modal, so the opener is theirs to supply. */
  onAssignOwner: (entity: T) => void
}

interface MeetingActionConfigsResult<T extends MeetingEntity> {
  actions: EntityActionConfig<T>[]
  DeleteConfirmDialog: () => JSX.Element
  OutcomeReasonDialog: () => JSX.Element
  RescheduleDialog: () => JSX.Element
  changeOutcome: (meetingId: string, outcome: MeetingOutcome) => Promise<void>
}
```

Change the signature so overrides are required (there is no default without `onAssignOwner`):

```ts
export function useMeetingActionConfigs<T extends MeetingEntity>(
  overrides: MeetingActionOverrides<T>,
): MeetingActionConfigsResult<T> {
```

Delete the block from `// Internal assign-owner dialog state` through the `AssignOwnerDialog = useCallback(…)` declaration (the `assignTarget` state, `defaultAssignOwner`, `clearAssignTarget`, `AssignOwnerDialog`). In the `assignOwner` config, `onAction: overrides.onAssignOwner` and keep the comment above it minus its second sentence about the submenu (the first sentence about CASL stays). The return becomes:

```ts
  return { actions, DeleteConfirmDialog, OutcomeReasonDialog, RescheduleDialog, changeOutcome }
```

- [ ] **Step 3: The card root reads the host; `customerId` lives on the data**

In `overview-card.tsx`:

Replace the `useMeetingActionConfigs` import with:

```ts
import { isClickAction } from '@/shared/components/entities/entity-actions/types'
import { MEETING_ACTIONS } from '@/shared/entities/meetings/constants/actions'
import { useMeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
```

and delete the `CustomerProfileModal` and `openModal` imports (the host's View action opens the profile now).

Change the data type (lines 48–50):

```ts
export type MeetingOverviewCardData
  = Pick<Meeting, 'id' | 'customerId'>
    & Partial<Pick<Meeting, 'scheduledFor' | 'confirmedAt' | 'createdAt' | 'meetingType' | 'meetingOutcome' | 'ownerId'>>
```

Change the context value and the root (replace from `interface MeetingOverviewCardContextValue` through the end of `MeetingOverviewCardRoot`):

```tsx
interface MeetingOverviewCardContextValue {
  meeting: MeetingOverviewCardData
  actions: ReturnType<typeof useMeetingActionsHost>['actions']
  /** Shared with the ⋯ menu's "Set Outcome" — same reason-dialog flow. */
  changeOutcome: ReturnType<typeof useMeetingActionsHost>['changeOutcome']
}

const MeetingOverviewCardContext = createContext<MeetingOverviewCardContextValue | null>(null)

function useMeetingOverviewCard() {
  const ctx = React.use(MeetingOverviewCardContext)
  if (!ctx) {
    throw new Error('MeetingOverviewCard sub-components must be used within <MeetingOverviewCard>')
  }
  return ctx
}

// ── Root ───────────────────────────────────────────────────────────────────────

// The root owns the click, so a caller can't replace it; other div attributes (`data-press`, aria) pass through.
interface MeetingOverviewCardProps extends Omit<ComponentProps<'div'>, 'onClick'> {
  meeting: MeetingOverviewCardData
  children: ReactNode
}

function MeetingOverviewCardRoot({ meeting, children, ...props }: MeetingOverviewCardProps) {
  const { actions, changeOutcome } = useMeetingActionsHost('MeetingOverviewCard')

  const value = useMemo<MeetingOverviewCardContextValue>(
    () => ({ meeting, actions, changeOutcome }),
    [meeting, actions, changeOutcome],
  )

  const handleClick = useCallback((e: React.MouseEvent) => {
    // Prevent bubbling when nested inside a parent kanban/list card that has
    // its own click handler (e.g. customer-kanban-card opens the customer
    // profile modal). The meeting card owns its own "View Meeting" click.
    e.stopPropagation()

    // Reject clicks that originate inside a portaled descendant (Radix Dialog,
    // Popover, etc.). React synthetic events bubble through the React tree
    // regardless of DOM placement, so a click inside a popover rendered as a
    // child of this card would otherwise bubble here and open the profile on
    // every participant add/remove. The DOM `contains` check is the source of
    // truth: portaled content lives elsewhere in the DOM, so it fails this check.
    const target = e.target as Node | null
    if (target && !e.currentTarget.contains(target)) {
      return
    }

    // The click is the View action, so a view that overrides View changes the click with it.
    const view = actions.find(config => config.action.id === MEETING_ACTIONS.view.id)
    if (view && isClickAction(view)) {
      view.onAction(meeting)
    }
  }, [actions, meeting])

  return (
    <MeetingOverviewCardContext value={value}>
      <div {...props} onClick={handleClick}>
        {children}
      </div>
    </MeetingOverviewCardContext>
  )
}
```

- [ ] **Step 4: The participants slot's compact variant uses the host's modal**

In `participants-slot.tsx`, add `import { useMeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'`. In `CompactVariant`, make the host read the first hook and drop the modal state:

```tsx
function CompactVariant({ meetingId, initialParticipants, className }: CompactVariantProps) {
  const { manageParticipants } = useMeetingActionsHost('ParticipantsSlot')
  const ability = useAbility()
  const canManage = ability.can('assign', 'Meeting')
  const [popoverOpen, setPopoverOpen] = useState(false)
```

(delete the `const [manageOpen, setManageOpen] = useState(false)` line), change the Manage button's handler to:

```tsx
                onClick={() => {
                  setPopoverOpen(false)
                  manageParticipants(meetingId)
                }}
```

and delete the trailing `{canManage && (<ManageParticipantsModal … open={manageOpen} onOpenChange={setManageOpen} />)}` block so the component returns the `<Popover>` alone (drop the fragment). `FullVariant` keeps its own modal; the `ManageParticipantsModal` import stays for it.

- [ ] **Step 5: `CustomerProfileMeeting` carries `customerId`**

`src/shared/entities/customers/types.ts:8` → add `'customerId'` to the Pick:

```ts
  = Pick<Meeting, 'id' | 'customerId' | 'ownerId' | 'meetingType' | 'meetingOutcome' | 'scheduledFor' | 'confirmedAt' | 'createdAt' | 'updatedAt' | 'projectId'>
```

`meetings-with-proposals.ts`: add `customerId: meetings.customerId,` after `ownerId: meetings.ownerId,` in the select (line 18) and `customerId: m.customerId,` after `ownerId: m.ownerId,` in the map (line 108).

- [ ] **Step 6: Type-check to list every consumer (RED on the type contract)**

Run: `pnpm tsc 2>&1 | grep -E "error TS" | sed -E 's/\(.*//' | sort | uniq -c`
Expected: errors in exactly these files, each for a reason this task fixes: `customer-kanban-card.tsx` (two `meeting={{…}}` literals lack `customerId`; `customerId=` and `onAssignOwner=` props no longer exist), `meeting-card.tsx` (schedule; `customerId=`, `onAssignOwner=`), `dashboard-meeting-card.tsx` (`customerId=`), `customer-meetings-list.tsx` and `project-meeting-list.tsx` (`customerId=`, `onAssignOwner=`), `schedule-meetings-calendar.tsx` (`AssignOwnerDialog` is not destructured there, but `useMeetingActionConfigs<ScheduleCalendarEvent>` is called with `onAssignOwner` so it still compiles: expect **no** error here; it changes in Step 8 for the host). The null guard the host needs is already in `openMeetingProfile`; if `tsc` reports `CustomerProfileModal`'s `customerId: string` rejecting `string | null` anywhere, that call lacks its guard.

- [ ] **Step 7: Schedule: calendar mounts the host, dot and card read it**

`schedule-calendar-dot.tsx`:

```tsx
'use client'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'

import { getVisibleActions } from '@/shared/components/entities/entity-actions/lib/visible-actions'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { formatBusinessTime } from '@/shared/lib/business-time'
import { useMeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'

import { ActivityDotContent } from './activity-dot-content'
import { MeetingDotContent } from './meeting-dot-content'

interface ScheduleCalendarDotProps {
  event: ScheduleCalendarEvent
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
}

export function ScheduleCalendarDot({ event, onUpdateScheduledFor }: ScheduleCalendarDotProps) {
  const { actions } = useMeetingActionsHost('ScheduleCalendarDot')
  const ability = useAbility()

  const formattedTime = formatBusinessTime(event.startAt, { hour: 'numeric', minute: '2-digit' })

  const permittedActions = getVisibleActions(actions, ability, event)
  // … the two returns stay exactly as they are
```

(`MeetingDotContent` and `DotActions` keep `EntityActionConfig<ScheduleCalendarEvent>[]`: an `EntityActionConfig` of the hook's entity type is assignable to one of the event type because every callback only takes a wider entity.)

`meeting-card.tsx` (schedule): remove `onAssignOwner` from `MeetingCardProps` and the destructuring, delete the `handleAssignOwner` declaration, and render the card as `<MeetingOverviewCard meeting={meetingData} data-press className={…}>` (no `customerId`, no `onAssignOwner`). `meetingData` already carries `customerId: event.customerId`. Delete the now-unused `ScheduleCalendarEvent` type import.

`schedule-meetings-calendar.tsx` becomes:

```tsx
'use client'

import type { ReactNode } from 'react'

import type { ScheduleCalendarEvent } from '@/features/schedule-management/types'

import { useCallback, useMemo } from 'react'

import { toCalendarEvent } from '@/features/meeting-flow/lib'
import { SCHEDULE_MEETINGS_QUERY } from '@/features/schedule-management/constants/schedule-queries'
import { MeetingCard } from '@/features/schedule-management/ui/components/meeting-card'
import { ScheduleCalendar } from '@/features/schedule-management/ui/components/schedule-calendar'
import { ScheduleCalendarDot } from '@/features/schedule-management/ui/components/schedule-calendar-dot'
import { ScheduleControlsBar } from '@/features/schedule-management/ui/components/schedule-controls-bar'
import { PageBar } from '@/shared/components/page-bar'
import { QueryToolbar } from '@/shared/components/query-toolbar/ui/query-toolbar'
import { useDataViewQuery } from '@/shared/dal/client/hooks/use-data-view-query'
import { useMeetingActions } from '@/shared/entities/meetings/hooks/use-meeting-actions'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
import { useTRPC } from '@/trpc/helpers'

interface ScheduleMeetingsCalendarProps {
  showToggle: ReactNode
  showSaturday: boolean
  onToggleSaturday: () => void
  onNewActivity: () => void
  isHighlighted: (meetingId: string) => boolean
  highlightRef: (meetingId: string) => React.RefCallback<HTMLDivElement>
}

export function ScheduleMeetingsCalendar({ showToggle, showSaturday, onToggleSaturday, onNewActivity, isHighlighted, highlightRef }: ScheduleMeetingsCalendarProps) {
  const trpc = useTRPC()
  const query = useDataViewQuery(trpc.meetingsRouter.reads.list, {}, SCHEDULE_MEETINGS_QUERY)
  const { updateScheduledFor } = useMeetingActions()

  const events = useMemo<ScheduleCalendarEvent[]>(() => query.rows.map(toCalendarEvent), [query.rows])

  const handleUpdateScheduledFor = useCallback((meetingId: string, date: Date) => {
    updateScheduledFor.mutate({ id: meetingId, data: { scheduledFor: date.toISOString() } })
  }, [updateScheduledFor])

  const renderCard = useCallback((event: ScheduleCalendarEvent) => (event.kind === 'meeting'
    ? (
        <MeetingCard
          event={event}
          onUpdateScheduledFor={handleUpdateScheduledFor}
          isHighlighted={isHighlighted(event.meetingId)}
          highlightRef={highlightRef(event.meetingId)}
        />
      )
    : null), [handleUpdateScheduledFor, isHighlighted, highlightRef])

  const renderCompact = useCallback((event: ScheduleCalendarEvent) => (
    <ScheduleCalendarDot event={event} onUpdateScheduledFor={handleUpdateScheduledFor} />
  ), [handleUpdateScheduledFor])

  return (
    <MeetingActionsHost>
      <div className="flex h-full min-h-0 flex-col gap-(--gutter)">
        <PageBar>
          <QueryToolbar query={query} entityName="meetings">
            <QueryToolbar.Standard leading={showToggle} searchPlaceholder="Search by customer or type…" />
          </QueryToolbar>
        </PageBar>
        <div className="min-h-0 flex-1">
          <ScheduleCalendar
            events={events}
            dateWindow={query.window}
            showSaturday={showSaturday}
            renderCard={renderCard}
            renderCompact={renderCompact}
            controlsRight={(
              <ScheduleControlsBar
                calendarView={query.window.view}
                onCalendarViewChange={query.window.setView}
                showSaturday={showSaturday}
                onToggleSaturday={onToggleSaturday}
                onNewActivity={onNewActivity}
              />
            )}
          />
        </div>
      </div>
    </MeetingActionsHost>
  )
}
```

(The host's default View opens the customer's profile on the meeting, which is what `handleViewMeeting` did; the host's modal replaces `assignRepMeetingId`.)

- [ ] **Step 8: Pipeline board: host around the board, the view's participants modal goes, kanban meeting literals carry `customerId`**

`customer-pipeline-view.tsx`:

- Add `import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'`; delete the `ManageParticipantsModal` import.
- Delete `const [assignRepTarget, setAssignRepTarget] = useState<{ meetingIds: string[] } | null>(null)`, the `handleAssignRep` callback, and the `{assignRepTarget && (<ManageParticipantsModal … />)}` block at the end of the JSX.
- `renderCard` no longer passes `onAssignRep`; its dependency array becomes `[handleViewProfile]`:

```tsx
  const renderCard = useCallback(
    (item: CustomerPipelineItem, _href: string, isDragOverlay?: boolean) => (
      <CustomerKanbanCard
        item={item}
        isDragOverlay={isDragOverlay}
        onViewProfile={handleViewProfile}
        onCreateMeeting={setCreateMeetingForCustomer}
      />
    ),
    [handleViewProfile],
  )
```

- Wrap the returned root element: the component returns `<MeetingActionsHost>{…the existing root <div>…}</MeetingActionsHost>`. (Task 5 and Task 6 nest the other three hosts inside it.)

`customer-kanban-card.tsx` (meeting parts only):

- Remove `onAssignRep` from `Props`, the destructuring, and `KanbanProjectMeeting`'s props and call site.
- The Fresh meeting literal gains `customerId: item.id,` (after `id: item.nextMeetingId,`) and loses the `customerId={item.id}` and `onAssignOwner={…}` JSX props.
- `KanbanProjectMeeting`'s literal gains `customerId,` (its prop) and loses the same two JSX props; its signature becomes `({ meeting, customerId, isFirst, isDragOverlay }: { meeting: PipelineItemProjectMeeting, customerId: string, isFirst: boolean, isDragOverlay?: boolean })`.

- [ ] **Step 9: Dashboard home: the day agenda hosts its cards**

`dashboard-day-agenda.tsx`: add `import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'` and return the list as

```tsx
  return (
    <MeetingActionsHost>
      <ol className="flex flex-col">
        {rows.map(row => (
          <DayAgendaRow key={row.id} row={row} />
        ))}
      </ol>
    </MeetingActionsHost>
  )
```

(the empty-state branch above it is unchanged: no cards, no host).

`dashboard-meeting-card.tsx`: delete the `customerId={row.customerId ?? ''}` prop; `MeetingListRow` is `Meeting & …`, so `row.customerId` already satisfies the data type.

- [ ] **Step 10: Customer profile: the tab panels host their lists; the lists stop threading `customerId`**

`customer-profile-tab-panels.tsx`: add the host import and wrap the three `TabsContent`s:

```tsx
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
…
  return (
    <MeetingActionsHost>
      <TabsContent className="mt-0 p-4 md:p-6" value="overview">
        <CustomerProfileOverview data={data} editForm={editForm} onOpenMeeting={onOpenMeeting} />
      </TabsContent>
      <TabsContent className="mt-0 p-4 md:p-6" value="meetings">
        <CustomerMeetingsList highlightMeetingId={highlightMeetingId} meetings={data.meetings} />
      </TabsContent>
      <TabsContent className="mt-0 p-4 md:p-6" value="projects">
        <CustomerProjectsList data={data} highlightMeetingId={highlightMeetingId} onMutationSuccess={onMutationSuccess} />
      </TabsContent>
    </MeetingActionsHost>
  )
```

(Radix `TabsContent` finds its `Tabs` through context, so the wrapper changes nothing about which panel shows.)

`customer-meetings-list.tsx`: `Props` becomes `{ meetings: CustomerProfileMeeting[], highlightMeetingId?: string }`; the card is `<MeetingOverviewCard meeting={meeting}>` (`CustomerProfileMeeting` now carries `customerId`).

`project-meeting-list.tsx`: `ProjectMeetingListProps` loses `customerId` and `onAssignRep`; the card is `<MeetingOverviewCard meeting={meeting}>`; the signature is `({ meetings, onMutationSuccess, onNavigate, highlightMeetingId })`.

`project-entity-card.tsx`: `Props` loses `customerId` and `onAssignRep`; the `ProjectMeetingList` call drops both props. (Task 6 replaces this card's hook call.)

`customer-projects-list.tsx`: the `ProjectEntityCard` call drops `customerId={data.customer.id}`.

- [ ] **Step 11: Projects table: the sales-history pane hosts its meeting cards**

`project-sales-history-pane.tsx`:

```tsx
'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'

import { ExpandedRowPanel } from '@/shared/components/data-table/ui/expanded-row-panel'
import { ProjectMeetingList } from '@/shared/entities/meetings/components/project-meeting-list'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'

interface ProjectSalesHistoryPaneProps {
  meetings: CustomerProfileMeeting[]
  isLoading: boolean
  onMutationSuccess: () => void
}

export function ProjectSalesHistoryPane({ meetings, isLoading, onMutationSuccess }: ProjectSalesHistoryPaneProps) {
  return (
    <ExpandedRowPanel.Pane title="Sales history" isLoading={isLoading}>
      {meetings.length === 0
        ? <p className="text-sm text-muted-foreground">No meetings linked to this project</p>
        : (
            <MeetingActionsHost>
              <ProjectMeetingList meetings={meetings} onMutationSuccess={onMutationSuccess} />
            </MeetingActionsHost>
          )}
    </ExpandedRowPanel.Pane>
  )
}
```

`project-row-panel/index.tsx`: the `ProjectSalesHistoryPane` call drops `customerId={project.customerId}`. (Each meeting now says which customer it belongs to, so a project without a customer id lists its meetings too; a card whose meeting has no customer opens nothing.)

- [ ] **Step 12: Type-check, lint, host-required check (GREEN)**

Run: `pnpm tsc` then `pnpm lint`
Expected: clean (the pre-existing warnings only). Unused imports the edits left behind (`useState` in the calendar, `ManageParticipantsModal` in the view, `useCallback` in the hook) are lint errors: remove them.

Run: `pnpm exec tsx .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx`
Expected: four `PASS` lines (`MeetingProbe` ×2, `MeetingOverviewCard`, `ParticipantsSlot`), exit 0.

- [ ] **Step 13: Write the read-only actions check (used by Tasks 4, 5 and 6)**

`.superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs`. Every step opens a menu, picks an item, waits for the dialog it names, presses Escape and waits for it to go; nothing is confirmed, so nothing is written. It also reports how many times the view's card component rendered across the whole sequence (Review Focus 3: a host's dialogs must not re-render the cards).

```js
import process from 'node:process'
import { installCensus, openPage, redact, waitForCards } from './check-lib.mjs'

// Usage: node check-actions.mjs <view>   (run from the repo root)
const KANBAN_CARD = '.min-w-70 [data-slot="card"]'
const SCHEDULE_CARD = '.group.relative.rounded-md.border.bg-card'
const PANE = 'div:has(> h4)'

async function openAndCancel(page, scope, nth, item, dialogText) {
  await scope.getByRole('button', { name: 'Actions' }).nth(nth).click()
  await page.getByRole('menuitem', { name: item, exact: true }).click()
  const dialog = page.getByRole('dialog').filter({ hasText: dialogText })
  await dialog.first().waitFor({ timeout: 15000 })
  await page.keyboard.press('Escape')
  await dialog.first().waitFor({ state: 'detached', timeout: 15000 })
  console.log(`PASS ${item} → "${dialogText}" opened and closed`)
}

// A kanban card with at least `count` ⋯ menus: a customer with a meeting (2) or with a meeting and a proposal (3).
function kanbanCardWithMenus(page, count) {
  return page.locator(KANBAN_CARD).filter({ has: page.getByRole('button', { name: 'Actions' }).nth(count - 1) }).first()
}

// Clicks table rows until an expanded pane titled `title` holds an Actions menu; the pane is returned.
async function expandRowWithActions(page, title) {
  const rows = page.locator('tbody tr')
  const total = Math.min(await rows.count(), 20)
  for (let index = 0; index < total; index++) {
    await rows.nth(index).click()
    const pane = page.locator(PANE).filter({ hasText: new RegExp(`^${title}`) })
    await pane.first().waitFor({ timeout: 30000 })
    await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000, polling: 100 })
    if (await pane.first().getByRole('button', { name: 'Actions' }).count() > 0) {
      return pane.first()
    }
    await rows.nth(index).click()
  }
  throw new Error(`no row among the first ${total} has an Actions menu in its "${title}" pane; try ?p=2`)
}

const VIEWS = {
  'schedule': { path: '/dashboard/schedule?show=meetings&s_d=2026-08-24', cardName: 'MeetingCard', async run(page) {
    const cards = page.locator(SCHEDULE_CARD)
    await openAndCancel(page, cards.nth(0), 0, 'Manage Participants', 'Manage participants')
    await openAndCancel(page, cards.nth(1), 0, 'Manage Participants', 'Manage participants')
    await openAndCancel(page, cards.nth(0), 0, 'Delete', 'Delete meeting')
  } },
  'fresh-meeting': { path: '/dashboard/pipeline/fresh', cardName: 'CustomerKanbanCardImpl', async run(page) {
    await openAndCancel(page, kanbanCardWithMenus(page, 2), 1, 'Manage Participants', 'Manage participants')
  } },
  'fresh-proposal': { path: '/dashboard/pipeline/fresh', cardName: 'CustomerKanbanCardImpl', async run(page) {
    await openAndCancel(page, kanbanCardWithMenus(page, 3), 2, 'Delete', 'Delete proposal')
  } },
  'fresh-customer': { path: '/dashboard/pipeline/fresh', cardName: 'CustomerKanbanCardImpl', async run(page) {
    await openAndCancel(page, kanbanCardWithMenus(page, 1), 0, 'Delete', 'Delete customer')
  } },
  'projects-project': { path: '/dashboard/pipeline/projects', cardName: 'CustomerKanbanCardImpl', async run(page) {
    await openAndCancel(page, kanbanCardWithMenus(page, 2), 1, 'Delete', 'Delete project')
  } },
  'home-meeting': { path: '/dashboard?dm_d=2026-08-24', cardName: 'DashboardMeetingCard', async run(page) {
    await openAndCancel(page, page.locator('ol li [data-press]').first(), 0, 'Delete', 'Delete meeting')
  } },
  'home-proposal': { path: '/dashboard?dm_d=2026-08-24', cardName: 'DashboardProposalCard', async run(page) {
    await openAndCancel(page, page.locator('[data-press]:not(ol *)').first(), 0, 'Delete', 'Delete proposal')
  } },
  'home-project': { path: '/dashboard?dm_d=2026-08-24', cardName: 'DashboardProjectCard', async run(page) {
    const card = page.locator('div.rounded-lg.border').filter({ has: page.getByRole('button', { name: 'Actions' }) }).filter({ hasText: /./ }).filter({ hasNot: page.locator('[data-press]') }).first()
    await openAndCancel(page, card, 0, 'Delete', 'Delete project')
  } },
  'profile-meeting': { path: '/dashboard/pipeline/fresh', cardName: 'CustomerKanbanCardImpl', async run(page) {
    await kanbanCardWithMenus(page, 2).locator('span.font-semibold').first().click()
    const profile = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: /Meetings/ }) })
    await profile.waitFor({ timeout: 30000 })
    await profile.getByRole('tab', { name: /Meetings/ }).click()
    const card = profile.locator('[data-slot="card"]').filter({ has: page.getByRole('button', { name: 'Actions' }) }).first()
    await card.waitFor({ timeout: 30000 })
    await openAndCancel(page, card, 0, 'Delete', 'Delete meeting')
    if (await profile.count() === 0) {
      throw new Error('Escape closed the profile instead of the confirm dialog')
    }
  } },
  'profile-project': { path: '/dashboard/pipeline/projects', cardName: 'CustomerKanbanCardImpl', async run(page) {
    await kanbanCardWithMenus(page, 2).locator('span.font-semibold').first().click()
    const profile = page.getByRole('dialog').filter({ has: page.getByRole('tab', { name: /Projects/ }) })
    await profile.waitFor({ timeout: 30000 })
    await profile.getByRole('tab', { name: /Projects/ }).click()
    const card = profile.locator('[data-slot="card"]').filter({ has: page.getByRole('button', { name: 'Actions' }) }).first()
    await card.waitFor({ timeout: 30000 })
    await openAndCancel(page, card, 0, 'Delete', 'Delete project')
  } },
  'meetings-row': { path: '/dashboard/meetings', cardName: 'TableRow', async run(page) {
    const pane = await expandRowWithActions(page, 'Proposals')
    await openAndCancel(page, pane, 0, 'Delete', 'Delete proposal')
  } },
  'projects-row': { path: '/dashboard/projects', cardName: 'TableRow', async run(page) {
    const pane = await expandRowWithActions(page, 'Sales history')
    await openAndCancel(page, pane, 0, 'Delete', 'Delete meeting')
  } },
  'fresh-drag': { path: '/dashboard/pipeline/fresh', cardName: 'CustomerKanbanCardImpl', async run(page) {
    const card = page.locator(KANBAN_CARD).first()
    const box = await card.boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + 20)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 12, box.y + 20, { steps: 4 })
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + 80, { steps: 8 })
    const overlays = await page.locator('[data-slot="card"].rotate-1').count()
    await page.mouse.move(box.x + box.width / 2, box.y + 20, { steps: 4 })
    await page.mouse.up()
    await page.waitForTimeout(1000)
    console.log(`${overlays === 1 ? 'PASS' : 'FAIL'} drag overlay rendered inside the hosts (${overlays} overlay card)`)
    if (overlays !== 1) {
      process.exitCode = 1
    }
  } },
  'fresh-mobile': { path: '/dashboard/pipeline/fresh', cardName: 'CustomerKanbanCardImpl', viewport: { width: 500, height: 900 }, async run(page) {
    const handle = page.locator('[aria-roledescription="draggable"]').first()
    const tag = await handle.evaluate(node => node.tagName)
    console.log(`${tag === 'SPAN' ? 'PASS' : 'FAIL'} at 500px the draggable is the grip handle (${tag})`)
    if (tag !== 'SPAN') {
      process.exitCode = 1
    }
  } },
}

const view = VIEWS[process.argv[2]]
if (!view) {
  console.error(`Usage: node check-actions.mjs <${Object.keys(VIEWS).join('|')}>`)
  process.exit(1)
}
const { browser, page, errors } = await openPage(view.path, '', { viewport: view.viewport, init: [installCensus, [view.cardName]] })
try {
  await waitForCards(page, view.cardName)
  const before = await page.evaluate(name => window.__renders[name] ?? 0, view.cardName)
  await view.run(page)
  const after = await page.evaluate(name => window.__renders[name] ?? 0, view.cardName)
  console.log(`${after - before === 0 ? 'PASS' : 'FAIL'} ${view.cardName} renders during the sequence: ${after - before}`)
  if (after - before !== 0) {
    process.exitCode = 1
  }
}
catch (error) {
  console.error(`FAIL ${redact(error.message).split('\n')[0]}`)
  process.exitCode = 1
}
if (errors.length > 0) {
  console.error(`FAIL page errors: ${errors.join(' | ')}`)
  process.exitCode = 1
}
await browser.close()
```

(`home-project` is used by Task 6, `home-proposal`, `fresh-proposal` and `meetings-row` by Task 5, `fresh-customer`, `projects-project`, `profile-project`, `fresh-drag` and `fresh-mobile` by Task 6. The `meetings-row`/`projects-row` views report `TableRow` renders, which the dropdown's open state does not touch either.)

- [ ] **Step 14: Run the meeting checks**

Run, from the repo root, one at a time:
```bash
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs schedule
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs fresh-meeting
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs home-meeting
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs profile-meeting
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs projects-row
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-census.mjs '/dashboard/schedule?show=meetings&s_d=2026-08-24' MeetingCard
```
Expected: every line `PASS`, exit 0 each; `schedule` shows three dialogs opened and closed (two cards' participants modals in turn) and `MeetingCard renders during the sequence: 0`. The census: `cards 13`, `mutationObservers` ≤ 45 (the host's hook holds 8 from `useMeetingActions` plus the outcome, reschedule and setter mutations, and `ScheduleMeetingsCalendar`'s own `useMeetingActions` holds 8 more; Phase 1 measured 304–347), `dialogContents` ≤ 12 (was 71–73). `cardRenders` is still 2–3 per card: Task 7 owns that.

- [ ] **Step 15: Commit (cards and views together, R6)**

```bash
git add src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx src/shared/entities/meetings/components/overview-card.tsx src/shared/entities/meetings/components/participants-slot.tsx src/shared/entities/customers/types.ts src/shared/entities/meetings/dal/server/meetings-with-proposals.ts src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx src/features/schedule-management/ui/components/schedule-calendar-dot.tsx src/features/schedule-management/ui/components/meeting-card.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx src/features/customer-pipelines/ui/components/customer-kanban-card.tsx src/features/agent-dashboard/ui/components/dashboard-day-agenda.tsx src/features/agent-dashboard/ui/components/dashboard-meeting-card.tsx src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx src/shared/entities/customers/components/lists/customer-meetings-list.tsx src/shared/entities/customers/components/lists/customer-projects-list.tsx src/shared/entities/customers/components/lists/project-entity-card.tsx src/shared/entities/meetings/components/project-meeting-list.tsx src/features/records-management/ui/components/project-row-panel/index.tsx src/features/records-management/ui/components/project-row-panel/project-sales-history-pane.tsx
git commit -m "perf(meetings): meeting cards read their actions from the view's MeetingActionsHost; the board, schedule, dashboard agenda, profile and sales-history pane mount one each

A card no longer calls useMeetingActionConfigs or mounts four dialogs; the host does once per view and owns the participants modal. Meeting data carries its customerId (CustomerProfileMeeting included), so the card's click and the View action need no customerId prop; a meeting without a customer opens nothing.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: `ProposalActionsHost` and every proposal-card view

**Files:**
- Create: `src/shared/modules/proposals/core/components/proposal-actions-host.tsx`
- Modify: `src/shared/modules/proposals/core/components/overview-card.tsx:1-25,68-135` (imports, context, root)
- Modify: `src/shared/entities/meetings/components/meeting-proposal-row.tsx`
- Modify: `src/features/records-management/ui/components/meeting-row-panel/meeting-proposals-pane.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposal-section-list.tsx`
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` (second host), `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` (`KanbanProposalRow`)
- Modify: `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx` (second host), `src/shared/entities/meetings/components/project-meeting-list.tsx` (`onNavigate` goes), `src/shared/entities/customers/components/lists/project-entity-card.tsx` (stops passing `onNavigate` down), `src/features/records-management/ui/components/project-row-panel/project-sales-history-pane.tsx` (second host)
- Test: `check-host-required.tsx` (extended), `check-actions.mjs fresh-proposal | home-proposal | meetings-row`

**Interfaces:**
- Consumes: `useProposalActionConfigs(overrides?)` → `{ actions, DeleteConfirmDialog }` (unchanged), `useStableCallbacks`.
- Produces:
  ```ts
  export function ProposalActionsHost(props: { overrides?: Parameters<typeof useProposalActionConfigs>[0], children: ReactNode }): JSX.Element
  export function useProposalActionsHost(consumer: string): { actions: ReturnType<typeof useProposalActionConfigs>['actions'] }
  ```
  `ProposalOverviewCard` root props become `{ proposal, children, meta? } & Omit<ComponentProps<'div'>, 'onClick'>` (no `onView`, `onEdit`, `onAssignOwner`); the card's click is its View action. `MeetingProposalRow({ proposal, onMutationSuccess?, showSentDate?, meta?, footer? })` (no `onNavigate`); `ProjectMeetingList` and `ProjectEntityCard` lose `onNavigate`.

- [ ] **Step 1: Extend the host-required check (RED)**

Add to `check-host-required.tsx`:

```tsx
import { ProposalOverviewCard } from '@/shared/modules/proposals/core/components/overview-card'
…
expectThrow(
  'ProposalOverviewCard without a host',
  <ProposalOverviewCard proposal={{ id: 'p1', token: null }}><span /></ProposalOverviewCard>,
  /ProposalOverviewCard needs a <ProposalActionsHost> above it/,
)
```

Run: `pnpm exec tsx .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx`
Expected: the new line is `FAIL … invariant expected app router to be mounted` (the card still calls the hook, whose `useRouter` throws first). Exit 1.

- [ ] **Step 2: Write the host**

`src/shared/modules/proposals/core/components/proposal-actions-host.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import { createContext, use, useMemo } from 'react'

import { useProposalActionConfigs } from '@/shared/modules/proposals/core/hooks/use-proposal-action-configs'

interface ProposalActionsHostValue {
  actions: ReturnType<typeof useProposalActionConfigs>['actions']
}

const ProposalActionsHostContext = createContext<ProposalActionsHostValue | null>(null)

interface ProposalActionsHostProps {
  /** View-level handlers. Each takes the entity, so one `actions` array serves every card below the host. */
  overrides?: Parameters<typeof useProposalActionConfigs>[0]
  children: ReactNode
}

export function ProposalActionsHost({ overrides, children }: ProposalActionsHostProps) {
  const { actions, DeleteConfirmDialog } = useProposalActionConfigs(overrides)
  // `actions` keeps its identity while its loading flags do, so the cards below only re-render for those.
  const value = useMemo<ProposalActionsHostValue>(() => ({ actions }), [actions])

  return (
    <ProposalActionsHostContext value={value}>
      <DeleteConfirmDialog />
      {children}
    </ProposalActionsHostContext>
  )
}

export function useProposalActionsHost(consumer: string): ProposalActionsHostValue {
  const value = use(ProposalActionsHostContext)
  if (!value) {
    throw new Error(`${consumer} needs a <ProposalActionsHost> above it`)
  }
  return value
}
```

- [ ] **Step 3: The proposal card reads the host; its click is the View action**

In `overview-card.tsx` (proposals): replace the `useProposalActionConfigs` import with

```ts
import { isClickAction } from '@/shared/components/entities/entity-actions/types'
import { PROPOSAL_ACTIONS } from '@/shared/modules/proposals/core/constants/actions'
import { useProposalActionsHost } from '@/shared/modules/proposals/core/components/proposal-actions-host'
```

and delete the `ROOTS` import if nothing else in the file uses it (today only `handleClick` does). The context type's `actions` becomes `ReturnType<typeof useProposalActionsHost>['actions']`. Replace the root (from `interface ProposalOverviewCardProps` through the end of `ProposalOverviewCardRoot`):

```tsx
// The root owns the click, so a caller can't replace it; other div attributes (`data-press`, aria) pass through.
interface ProposalOverviewCardProps extends Omit<ComponentProps<'div'>, 'onClick'> {
  proposal: ProposalOverviewCardData
  children: ReactNode
  meta?: ProposalOverviewCardMeta
}

function ProposalOverviewCardRoot({ proposal, children, meta, ...props }: ProposalOverviewCardProps) {
  const { actions } = useProposalActionsHost('ProposalOverviewCard')

  // The click is the View action, so a view that overrides View changes the click with it.
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const view = actions.find(config => config.action.id === PROPOSAL_ACTIONS.view.id)
    if (view && isClickAction(view)) {
      view.onAction(proposal)
    }
  }, [actions, proposal])

  const style = PROPOSAL_ROW_STYLES[proposal.status ?? 'draft'] ?? PROPOSAL_ROW_STYLES.draft

  const value = useMemo<ProposalOverviewCardContextValue>(
    () => ({ proposal, actions, style, meta: meta ?? {} }),
    [proposal, actions, style, meta],
  )

  return (
    <ProposalOverviewCardContext value={value}>
      <div {...props} onClick={handleClick}>
        {children}
      </div>
    </ProposalOverviewCardContext>
  )
}
```

(The hook's default View opens the public review page in a new tab and its default Edit pushes the proposal's dashboard route: exactly what every caller's `onView`/`onEdit` did, so no view needs an override.)

- [ ] **Step 4: Type-check to list the consumers (RED on the type contract)**

Run: `pnpm tsc 2>&1 | grep -E "error TS" | sed -E 's/\(.*//' | sort | uniq -c`
Expected: errors only in `meeting-proposal-row.tsx` (`onView`, `onEdit`), `customer-kanban-card.tsx` (`KanbanProposalRow`'s `onEdit`), and nowhere else (`DashboardProposalCard` and the meeting card's `DefaultProposalRow` pass no overrides).

- [ ] **Step 5: Rows and views**

`meeting-proposal-row.tsx`: delete the `useRouter`, `useCallback` and `ROOTS` imports, the `onNavigate` prop and doc line, `handleView` and `handleEdit`; the signature is `({ proposal, onMutationSuccess: _onMutationSuccess, showSentDate = false, meta, footer }: Props)` and the card is `<ProposalOverviewCard proposal={proposal} meta={meta} className={…}>`.

`customer-kanban-card.tsx`: `KanbanProposalRow` loses `useRouter`/`handleEdit` and renders `<ProposalOverviewCard proposal={proposal} className={…}>`; delete the `useRouter` import if `CustomerKanbanCardImpl` no longer uses it either (it still does until Task 6, so leave it for now if so).

`project-meeting-list.tsx`: remove `onNavigate` from the props interface, the signature and the `MeetingProposalRow` call (`<MeetingProposalRow key={p.id} proposal={p as CustomerProfileProposal} onMutationSuccess={onMutationSuccess} />`).

`project-entity-card.tsx`: the `ProjectMeetingList` call drops `onNavigate={onNavigate}` (the prop itself goes in Task 6 with the card's hook).

`meeting-proposals-pane.tsx`: add `import { ProposalActionsHost } from '@/shared/modules/proposals/core/components/proposal-actions-host'` and wrap the list:

```tsx
      {proposals.length > 0 && (
        <ProposalActionsHost>
          <ul className="flex flex-col gap-2">
            …unchanged…
          </ul>
        </ProposalActionsHost>
      )}
```

`dashboard-proposal-section-list.tsx`: import the host and wrap `<EntityList …/>` in `<ProposalActionsHost>…</ProposalActionsHost>` (inside the `<section>`, after the header).

`customer-pipeline-view.tsx`: import the host; the returned tree becomes `<MeetingActionsHost><ProposalActionsHost>{root div}</ProposalActionsHost></MeetingActionsHost>`.

`customer-profile-tab-panels.tsx`: import the host; wrap the three `TabsContent`s in `<ProposalActionsHost>` inside the `<MeetingActionsHost>`.

`project-sales-history-pane.tsx`: import the host; the list branch becomes `<MeetingActionsHost><ProposalActionsHost><ProjectMeetingList … /></ProposalActionsHost></MeetingActionsHost>`.

- [ ] **Step 6: Type-check, lint, host-required check (GREEN)**

Run: `pnpm tsc` then `pnpm lint`
Expected: clean (pre-existing warnings only).

Run: `pnpm exec tsx .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx`
Expected: five `PASS` lines, exit 0.

- [ ] **Step 7: Browser checks**

```bash
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs fresh-proposal
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs home-proposal
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs meetings-row
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs profile-meeting
```
Expected: all `PASS`, exit 0 (the profile check re-runs because the tab panels gained a host). The `meetings-row` check may need `?p=2` appended to its path if the first 20 rows have no proposals; change the path in `VIEWS['meetings-row']` and say so in the ledger.

- [ ] **Step 8: Commit**

```bash
git add src/shared/modules/proposals/core/components/proposal-actions-host.tsx src/shared/modules/proposals/core/components/overview-card.tsx src/shared/entities/meetings/components/meeting-proposal-row.tsx src/features/records-management/ui/components/meeting-row-panel/meeting-proposals-pane.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-section-list.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx src/features/customer-pipelines/ui/components/customer-kanban-card.tsx src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx src/shared/entities/meetings/components/project-meeting-list.tsx src/shared/entities/customers/components/lists/project-entity-card.tsx src/features/records-management/ui/components/project-row-panel/project-sales-history-pane.tsx
git commit -m "perf(proposals): proposal cards read their actions from the view's ProposalActionsHost; the board, dashboard rosters, profile, meeting row panel and sales-history pane mount one each

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: `CustomerActionsHost`, `ProjectActionsHost`, the kanban card on both, `isMobile` read once per board

**Files:**
- Create: `src/shared/modules/customers/core/components/customer-actions-host.tsx`, `src/shared/modules/projects/core/components/project-actions-host.tsx`
- Modify: `src/shared/entities/customers/hooks/use-customer-action-configs.ts:11-13` (`CustomerEntity` gains `name`)
- Modify: `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` (props, hooks, click, dialogs, `useIsMobile`), `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` (two more hosts, `useIsMobile()` once, customer overrides)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-project-card.tsx`, `dashboard-project-section-list.tsx`
- Modify: `src/shared/entities/customers/components/lists/project-entity-card.tsx`, `src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx` (third host)
- Test: `check-host-required.tsx` (extended), `check-actions.mjs fresh-customer | projects-project | home-project | profile-project | fresh-drag | fresh-mobile`, `check-census.mjs` on Fresh

**Interfaces:**
- Consumes: `useCustomerActionConfigs(overrides?)` → `{ actions, DeleteConfirmDialog }`, `useProjectActionConfigs(overrides?)` → `{ actions, DeleteConfirmDialog }`, `useIsMobile()`.
- Produces:
  ```ts
  export function CustomerActionsHost(props: { overrides?: Parameters<typeof useCustomerActionConfigs>[0], children: ReactNode }): JSX.Element
  export function useCustomerActionsHost(consumer: string): { actions: ReturnType<typeof useCustomerActionConfigs>['actions'] }
  export function ProjectActionsHost(props: { overrides?: Parameters<typeof useProjectActionConfigs>[0], children: ReactNode }): JSX.Element
  export function useProjectActionsHost(consumer: string): { actions: ReturnType<typeof useProjectActionConfigs>['actions'] }
  ```
  `CustomerEntity` is `{ id: string, name: string }` (an override that schedules a meeting needs the name for the modal; every caller's rows carry one). `CustomerKanbanCard({ item, isDragOverlay?, isMobile })`; `KanbanBoard`'s `renderCard` passes the board's `isMobile`. `ProjectEntityCard({ project, onMutationSuccess, highlightMeetingId? })`; `DashboardProjectCard({ row, className? })` unchanged in props but reads the host.

- [ ] **Step 1: Extend the host-required check (RED)**

Add to `check-host-required.tsx` (the kanban card needs both hosts; render it with the project host alone to prove the customer reader is first, and with the customer host alone to prove the project reader runs next):

```tsx
import { CustomerKanbanCard } from '@/features/customer-pipelines/ui/components/customer-kanban-card'
import { CustomerActionsHost } from '@/shared/modules/customers/core/components/customer-actions-host'
import { ProjectActionsHost } from '@/shared/modules/projects/core/components/project-actions-host'
…
const item = { id: 'c1', name: 'Customer', stage: 'new', phone: null, address: null, city: null, state: null, zip: null, nextMeetingId: null, nextMeetingAt: null, meetingScheduledFor: null, meetingConfirmedAt: null, meetingCount: 0, assignedRep: null, proposals: [], project: null, totalPipelineValue: 0, latestActivityAt: null, customerId: 'c1' } as any
expectThrow('CustomerKanbanCard without a customer host', <ProjectActionsHost><CustomerKanbanCard item={item} isMobile={false} /></ProjectActionsHost>, /CustomerKanbanCard needs a <CustomerActionsHost> above it/)
expectThrow('CustomerKanbanCard without a project host', <CustomerActionsHost><CustomerKanbanCard item={item} isMobile={false} /></CustomerActionsHost>, /CustomerKanbanCard needs a <ProjectActionsHost> above it/)
```

Run: `pnpm exec tsx .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx`
Expected: `Cannot find module '@/shared/modules/customers/core/components/customer-actions-host'`, exit 1.

- [ ] **Step 2: Write the two hosts**

`src/shared/modules/customers/core/components/customer-actions-host.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import { createContext, use, useMemo } from 'react'

import { useCustomerActionConfigs } from '@/shared/entities/customers/hooks/use-customer-action-configs'

interface CustomerActionsHostValue {
  actions: ReturnType<typeof useCustomerActionConfigs>['actions']
}

const CustomerActionsHostContext = createContext<CustomerActionsHostValue | null>(null)

interface CustomerActionsHostProps {
  /** View-level handlers. Each takes the entity, so one `actions` array serves every card below the host. */
  overrides?: Parameters<typeof useCustomerActionConfigs>[0]
  children: ReactNode
}

export function CustomerActionsHost({ overrides, children }: CustomerActionsHostProps) {
  const { actions, DeleteConfirmDialog } = useCustomerActionConfigs(overrides)
  // `actions` keeps its identity while its loading flag does, so the cards below only re-render for that.
  const value = useMemo<CustomerActionsHostValue>(() => ({ actions }), [actions])

  return (
    <CustomerActionsHostContext value={value}>
      <DeleteConfirmDialog />
      {children}
    </CustomerActionsHostContext>
  )
}

export function useCustomerActionsHost(consumer: string): CustomerActionsHostValue {
  const value = use(CustomerActionsHostContext)
  if (!value) {
    throw new Error(`${consumer} needs a <CustomerActionsHost> above it`)
  }
  return value
}
```

`src/shared/modules/projects/core/components/project-actions-host.tsx`: the same file with `Customer` → `Project` throughout and the hook import `import { useProjectActionConfigs } from '@/shared/modules/projects/core/hooks/use-project-action-configs'`.

`use-customer-action-configs.ts:11-13`:

```ts
interface CustomerEntity {
  id: string
  /** The Schedule Meeting override opens the create-meeting modal, which shows the customer's name. */
  name: string
}
```

- [ ] **Step 3: Type-check (RED on the entity contract)**

Run: `pnpm tsc 2>&1 | grep -E "error TS" | sed -E 's/\(.*//' | sort | uniq -c`
Expected: no errors from `name` (the customers table rows, the two lead-sources sections' rows and `CustomerPipelineItem` all carry `name`). If one does appear, stop: the ruling is whether that caller's row type gains `name` or `CustomerEntity` goes back to `{ id }` with the kanban override reading the name from the board's `items`; ledger it.

- [ ] **Step 4: The kanban card reads both hosts and takes `isMobile`**

In `customer-kanban-card.tsx`:

Imports: delete `useRouter`, `useIsMobile`, `useCustomerActionConfigs`, `useProjectActionConfigs`, `ROOTS`; `useCallback` goes too if nothing else uses it; add

```ts
import { isClickAction } from '@/shared/components/entities/entity-actions/types'
import { CUSTOMER_ACTIONS } from '@/shared/entities/customers/constants/actions'
import { useCustomerActionsHost } from '@/shared/modules/customers/core/components/customer-actions-host'
import { useProjectActionsHost } from '@/shared/modules/projects/core/components/project-actions-host'
```

Props and the top of the component:

```tsx
interface Props {
  item: CustomerPipelineItem
  isDragOverlay?: boolean
  /** The board reads the viewport once; a per-card media query would re-render every card after mount. */
  isMobile: boolean
}

function CustomerKanbanCardImpl({ item, isDragOverlay, isMobile }: Props) {
  const { actions: customerActions } = useCustomerActionsHost('CustomerKanbanCard')
  const { actions: projectActions } = useProjectActionsHost('CustomerKanbanCard')
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    data: item,
  })

  const cardDragProps = !isDragOverlay && !isMobile ? { ...attributes, ...listeners } : {}
  const handleDragProps = !isDragOverlay && isMobile ? { ...attributes, ...listeners } : {}

  // The click is the customer's View action, so the board decides what viewing a customer means.
  function handleClick() {
    if (isDragging || isDragOverlay) {
      return
    }
    const view = customerActions.find(config => config.action.id === CUSTOMER_ACTIONS.view.id)
    if (view && isClickAction(view)) {
      view.onAction(item)
    }
  }
```

Delete the `// -- Customer entity actions --` block through the `useProjectActionConfigs` call (`handleViewCustomer`, `handleScheduleMeeting`, both hook calls, `handleViewProject`); keep `const projectEntity = item.project ? { id: item.project.id } : null`. Delete `<CustomerDeleteDialog />` and `<ProjectDeleteDialog />` and the fragment around the `<Card>` (the component returns the `<Card>` directly). The two `EntityActionMenu`s keep `actions={customerActions}` / `actions={projectActions}`.

- [ ] **Step 5: The board mounts the two hosts, reads `isMobile` once, passes the customer overrides**

In `customer-pipeline-view.tsx`:

```ts
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { CustomerActionsHost } from '@/shared/modules/customers/core/components/customer-actions-host'
import { ProjectActionsHost } from '@/shared/modules/projects/core/components/project-actions-host'
```

Inside the component, after `handleViewProfile`:

```tsx
  const isMobile = useIsMobile()

  const customerOverrides = useMemo(() => ({
    onView: (customer: { id: string }) => handleViewProfile(customer.id),
    onScheduleMeeting: (customer: { id: string, name: string }) => setCreateMeetingForCustomer({ id: customer.id, name: customer.name }),
  }), [handleViewProfile])

  const renderCard = useCallback(
    (item: CustomerPipelineItem, _href: string, isDragOverlay?: boolean) => (
      <CustomerKanbanCard item={item} isDragOverlay={isDragOverlay} isMobile={isMobile} />
    ),
    [isMobile],
  )
```

and the returned tree is

```tsx
    <MeetingActionsHost>
      <ProposalActionsHost>
        <CustomerActionsHost overrides={customerOverrides}>
          <ProjectActionsHost>
            {…the root <div> as before…}
          </ProjectActionsHost>
        </CustomerActionsHost>
      </ProposalActionsHost>
    </MeetingActionsHost>
```

- [ ] **Step 6: Dashboard projects roster and the profile's project cards**

`dashboard-project-card.tsx`: replace the `useProjectActionConfigs` import with `import { useProjectActionsHost } from '@/shared/modules/projects/core/components/project-actions-host'`; the body starts `const { actions: projectActions } = useProjectActionsHost('DashboardProjectCard')`; delete `<DeleteConfirmDialog />` and the fragment (return the `<div>`); in the doc comment, replace the sentence beginning "Reuses the same `useProjectActionConfigs` + `EntityActionMenu` action plumbing" with "Reads the roster's `ProjectActionsHost` and renders `EntityActionMenu` like every other project surface, so actions can't drift between surfaces."

`dashboard-project-section-list.tsx`: import `ProjectActionsHost` and wrap `<EntityList …/>` in it.

`project-entity-card.tsx`: delete the `useRouter`, `useCallback`, `ROOTS` and `useProjectActionConfigs` imports; add `import { useProjectActionsHost } from '@/shared/modules/projects/core/components/project-actions-host'`; `Props` is `{ project: CustomerProfileProject, onMutationSuccess: () => void, highlightMeetingId?: string }`; the body starts `const { actions: projectActions } = useProjectActionsHost('ProjectEntityCard')` (no `handleViewProject`: the host's default Edit pushes the project's route, which is what it did); delete `<DeleteConfirmDialog />` and the fragment; the `ProjectMeetingList` call passes `meetings`, `onMutationSuccess`, `highlightMeetingId`.

`customer-profile-tab-panels.tsx`: import `ProjectActionsHost`; the panels are wrapped `<MeetingActionsHost><ProposalActionsHost><ProjectActionsHost>…</ProjectActionsHost></ProposalActionsHost></MeetingActionsHost>`.

- [ ] **Step 7: Type-check, lint, host-required check (GREEN)**

Run: `pnpm tsc` then `pnpm lint`
Expected: clean. `tsc` will name every place that still passes `onViewProfile`, `onCreateMeeting`, `customerId` or `onNavigate` to a component that lost the prop; fix each (they are all in the files above).

Run: `pnpm exec tsx .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-host-required.tsx`
Expected: seven `PASS` lines, exit 0. (The kanban item literal is cast; `tsx` does not type-check.)

- [ ] **Step 8: Browser checks**

```bash
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs fresh-customer
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs projects-project
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs home-project
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs profile-project
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs fresh-drag
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs fresh-mobile
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-census.mjs /dashboard/pipeline/fresh CustomerKanbanCardImpl
```
Expected: every `PASS`, exit 0. `profile-project` needs a Projects-pipeline customer whose profile lists a project; if the first card's profile shows "No Projects", pick the next card (`kanbanCardWithMenus(page, 2).nth(1)`) and note it. The census: `cards 50`, `mutationObservers` ≤ 50 (the four hosts' hooks plus the board's move mutation; was ≈ 1425), so ≤ 1.0 per card, `dialogContents` ≤ 12 (was ≈ 337; the four hosts hold 6, the create-meeting and create-project modals mount only while open), `cardRenders 50` (1 per card on mount; was 100).

- [ ] **Step 9: Commit**

```bash
git add src/shared/modules/customers/core/components/customer-actions-host.tsx src/shared/modules/projects/core/components/project-actions-host.tsx src/shared/entities/customers/hooks/use-customer-action-configs.ts src/features/customer-pipelines/ui/components/customer-kanban-card.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx src/features/agent-dashboard/ui/components/dashboard-project-card.tsx src/features/agent-dashboard/ui/components/dashboard-project-section-list.tsx src/shared/entities/customers/components/lists/project-entity-card.tsx src/shared/entities/customers/components/profile/customer-profile-tab-panels.tsx
git commit -m "perf(pipelines): kanban cards read customer and project actions from the board's hosts and the viewport from the board; the dashboard roster and profile project cards read a ProjectActionsHost

A 50-card board now holds four hosts' mutations and dialogs instead of fifty cards' worth, and each card renders once on mount.

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: `MeetingCard` renders once per mount and per week step

**Files:**
- Modify: `src/features/schedule-management/ui/components/meeting-card.tsx`
- Modify: `src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx` (`renderCard`)
- Test: `check-census.mjs` on the schedule with `--step`

**Interfaces:**
- Consumes: `MeetingCard({ event, onUpdateScheduledFor, isHighlighted?, highlightRef? })` from Task 4; `useScheduleHighlight().highlightRef(id)` returns a new callback on every call.
- Produces: `MeetingCard` is `memo`ized; `highlightRef` is passed only for the highlighted card (`undefined` otherwise), so every other card's props are referentially stable across a calendar re-render.

- [ ] **Step 1: Measure (RED)**

Run: `node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-census.mjs '/dashboard/schedule?show=meetings&s_d=2026-08-24' MeetingCard --step Previous`
Expected: `cards 13`, `cardRenders` ≥ 26 (2–3 renders per card on mount), and `step.cardRenders` ≥ 2 × `step.cards` (Phase 1 measured 24 renders for 8 cards, max 3 per card). This is the RED.

- [ ] **Step 2: Memoize the card and its data**

In `meeting-card.tsx`: import `memo` and `useMemo` from `react`; rename the function to `MeetingCardImpl`; build the data with

```tsx
  const meetingData = useMemo<MeetingOverviewCardData>(() => ({
    id: event.meetingId,
    meetingOutcome: event.meetingOutcome,
    meetingType: event.meetingType as MeetingType,
    scheduledFor: event.startAt,
    confirmedAt: event.confirmedAt,
    customerId: event.customerId,
    ownerId: event.ownerId,
    createdAt: event.createdAt,
    ownerName: event.ownerName,
    ownerImage: event.ownerImage,
    customerName: event.customerName,
    customerPhone: event.customerPhone,
    customerHasSentProposal: event.customerHasSentProposal,
    customerAddress: event.customerAddress,
    customerCity: event.customerCity,
    customerState: event.customerState,
    customerZip: event.customerZip,
  }), [event])
```

and end the file with

```tsx
// A week step re-renders the calendar; a card whose event and handlers are unchanged skips its render.
export const MeetingCard = memo(MeetingCardImpl)
```

In `schedule-meetings-calendar.tsx`, pass the ref callback only to the highlighted card (the hook builds a new callback per call, which would defeat the memo for every card):

```tsx
  const renderCard = useCallback((event: ScheduleCalendarEvent) => {
    if (event.kind !== 'meeting') {
      return null
    }
    const highlighted = isHighlighted(event.meetingId)
    return (
      <MeetingCard
        event={event}
        onUpdateScheduledFor={handleUpdateScheduledFor}
        isHighlighted={highlighted}
        highlightRef={highlighted ? highlightRef(event.meetingId) : undefined}
      />
    )
  }, [handleUpdateScheduledFor, isHighlighted, highlightRef])
```

- [ ] **Step 3: Measure (GREEN)**

Run: `node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-census.mjs '/dashboard/schedule?show=meetings&s_d=2026-08-24' MeetingCard --step Previous`
Expected: `cardRenders 13` (one per card on mount) and `step.cardRenders` equal to `step.cards` (each card of the new week renders once; no card of the old week survives a week step). If `cardRenders` is 26 with every card rendering exactly twice, the second pass comes from above the card (the calendar's `events` memo or `ScheduleCalendar`'s own state after mount): find which prop changed with the probe's `top` line before changing anything else, and ledger the finding; the spec's target is 1.

Run: `pnpm tsc` then `pnpm lint`
Expected: clean.

Run: `node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-actions.mjs schedule`
Expected: all `PASS` (the memo must not break the highlight path: `isHighlighted` changes flip the prop, so the highlighted card still re-renders).

- [ ] **Step 4: Commit**

```bash
git add src/features/schedule-management/ui/components/meeting-card.tsx src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx
git commit -m "perf(schedule): MeetingCard is memoized and builds its data once per event; only the highlighted card gets a ref callback, so a week step renders each new card once

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Re-measure, acceptance table, spec status, delete the plan

**Files:**
- Output (workspace): `after-schedule.txt`, `after-pipeline-fresh.txt`, `after-pipeline-leads.txt`, `after-census-*.txt`, `acceptance.md`
- Modify: `docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md:3` (status line)
- Delete: `docs/superpowers/plans/2026-10-08-pipeline-schedule-speed-phase-2.md`

**Interfaces:**
- Consumes: Phase 1's acceptance numbers (quoted below), Task 1's `before-*.txt`.
- Produces: `acceptance.md` in the workspace, in the shape of Phase 1's: one row per spec §5 Phase 2 target plus the Phase 1 rows that must not regress; the spec's status line says Phase 2 shipped and what the numbers say about the lazy-dropdown step.

- [ ] **Step 1: Run the probes (quiet machine; warm dev server; one at a time)**

```bash
node scripts/perf/page-probe.mjs schedule 3 < /dev/null > .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/after-schedule.txt 2>&1
node scripts/perf/page-probe.mjs pipeline-fresh 3 < /dev/null > .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/after-pipeline-fresh.txt 2>&1
node scripts/perf/page-probe.mjs pipeline-leads 3 < /dev/null > .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/after-pipeline-leads.txt 2>&1
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-census.mjs '/dashboard/schedule?show=meetings&s_d=2026-08-24' MeetingCard --step Previous > .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/after-census-schedule.txt
node .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/check-census.mjs /dashboard/pipeline/fresh CustomerKanbanCardImpl > .superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/after-census-fresh.txt
```
Expected: each probe ends with its `switch pipeline` or `show meetings` scenario and no `failed:` scenario; `console issues` absent or `hydration warnings 0/0/0`.

- [ ] **Step 2: Write `acceptance.md`**

Rows, with "Where" naming the probe line, Phase 1's number, this run's number and a verdict:

| Target (spec §5) | Where | Phase 1 (before) | Goal |
|---|---|---|---|
| `useMutation` observers per card: Fresh | `>>> MOUNTED … per item: … mutation observers` | 28.5 (1425 / 50) | ≤ 1 |
| `useMutation` observers: Schedule | same line, and `after-census-schedule.txt` | 347 for 13 cards (26.7) | the total no longer grows with cards: report the total and note it against the 13-card week; the ratio target is for the owner's re-ruling on small views (the hosts' fixed cost of ≈ 30 is 2.3 per card at 13 cards and 0 per card thereafter) |
| Closed dialogs mounted per view | `DialogContent×N` on the MOUNTED line | Fresh 337 · Schedule 71–73 · Leads 1025 | ≤ 12 |
| Renders per card on mount | `after-census-*.txt` `cardRenders / cards`; the probe's `(doc load N render totals)` `max N per card` | Fresh 2 · Schedule 2–3 | 1 |
| Fresh: sidebar click → fully shown | `SIDEBAR CLICK … content fully shown` | 2696 ms (min 2476) | ≤ 1.5 s (Phase 1 + 2) |
| Schedule: cached week step | `=== next week (cached) ===` `settled after` | 490–502 ms (Task 3 run; baseline 409–461) | ≤ 150 ms |
| Idle 5 s, hover sweep, modal open/close: card renders | those scenarios | 0 | 0 |
| Hydration warnings | DOCUMENT LOAD tail | 0/0/0 | 0 |
| Phase 1 rows that must hold: content in DOM → fully shown; own pending view on document load; shell on click; switch keeps the cache | as in Phase 1's table | Phase 1's values | no regression |
| For the record (Phase 3's lines) | Leads `items interactive`, `open profile modal` | 6786 ms · 1328 ms | report |

Then a section "Decision on the lazy-dropdown step (spec §3.2)": if Fresh's sidebar click → fully shown is still over 1.5 s, or the cached week step over 150 ms, write what the `top` line of the slow scenario shows (`DropdownMenu×`, `Dialog×`, `Tooltip×` counts per card) and recommend the step as the next plan; otherwise write that the step is not taken. Then "Owner hand-checks" (spec §6, writes): delete / outcome / reschedule / confirmation / assign-rep / assign-project from a card in each of the six host views (board, schedule, dashboard home, profile, meetings row panel, projects sales history); manage participants from a schedule card and from a dashboard card; drag a card in Fresh on a phone (grip) and on a desktop (card); the highlight scroll from a push notification on an iPhone.

- [ ] **Step 3: Spec status line and plan deletion**

In the spec's line 3, replace `Phase 2 planning started 2026-10-08; Phase 3 not started.` with `**Phase 2 shipped <date>** on local main (acceptance: \`.superpowers/sdd/2026-10-08-pipeline-schedule-speed-phase-2/acceptance.md\`; lazy-dropdown step: <taken as the next plan | not taken>, per that table); Phase 3 not started.`

```bash
git rm docs/superpowers/plans/2026-10-08-pipeline-schedule-speed-phase-2.md
git add docs/superpowers/specs/2026-10-05-pipeline-schedule-speed-design.md
git commit -m "docs(specs): pipeline + schedule speed — Phase 2 shipped; its plan is deleted

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

- [ ] **Step 4: Final verification**

Run: `pnpm tsc` then `pnpm lint`; `git status --short` must show nothing of this plan uncommitted (the other session's files may be modified).
Expected: clean; the eight-or-so commits of this plan are on local `main`, not pushed (pushing is the owner's call).
