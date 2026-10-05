# Records Table Render Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `DataTable` re-render only the rows a state change affects. Opening a modal re-renders nothing, cells make no per-row requests, and records pages fade in without a delay.

**Architecture:** One generic hook, `useStableCallbacks`, gives an object (or an array of objects) stable function entries and keeps its identity until a non-function entry changes. `DataTable` runs `meta` through it and renders each row through a memoized `DataTableRow`. Each entity's action-config hook runs its array through the same hook, so `meta.<entity>Actions` can be a value. Separately:
- modal openers call a plain `openModal()` instead of subscribing to the store
- the participant picker stops fetching per row
- two shared components lose a wasted render and the animation delay

A Playwright probe in `scripts/perf/` measures all of it before and after.

**Tech Stack:** React 19, TanStack Table v8, TanStack Query v5 (via tRPC), zustand 5, motion 12, Tailwind v4, Playwright 1.58, Node 24 (`process.loadEnvFile`), `tsx` for verify scripts.

**Spec:** `docs/superpowers/specs/2026-10-01-records-table-render-isolation-design.md` (approved 2026-10-01, amended while planning: A.1, A.2, A.5, B and C changed; read it first).

## Global Constraints

- Verify with `pnpm tsc` and `pnpm lint` only. Never run `pnpm build`.
- The repo has no unit test runner. Pure logic is verified with a `scripts/verify-*.ts` file run by `pnpm tsx` using `node:assert/strict`, following `scripts/verify-is-long-sow.ts`. Render behaviour is verified with the probe and by hand.
- `package.json` is not touched. Run the probe with `node scripts/perf/records-probe.mjs <path>`.
- The probe reads `DEV_LOGIN_SECRET` from `.env.local`. Never write the secret into a file.
- Comments say why, never what. No banners, and no citations of this plan or the spec in code.
- Non-defensive migration: move every consumer and delete the old pattern in the same task, with no shim. After Task 5, `useModalStore()` with no selector appears nowhere in `src/`.
- One component per file, named exports, `@/` imports.
- Stage by explicit path; never `git add -A` or `git add .`. No stash, checkout or reset.
- A pre-existing `pnpm tsc` error in `src/features/calculators/remodel-roi-calculator/ui/components/charts/monthly-cost-chart.tsx(31)` is not ours. Leave it, and report any other error.
- The dev server runs on `PORT` from `.env.local` (default 3000). Don't start a second one, and don't `rm -rf .next` while it runs.
- Probe output goes in `.superpowers/sdd/2026-10-01-records-render-isolation/`, which is gitignored.

## Review Focus

1. **A row's own data changes after an inline edit** (outcome, status, scheduled date, created date). The edited row must show the new value once the list refetches, because `row.original` changed. Pinned by the Task 4 manual check.
2. **An action's pending state.** Duplicate or delete in progress must still show `isLoading` in the row menu. The flag flips, the actions array changes identity and the rows re-render. Pinned by the Task 3 manual check.
3. **Frozen-column shadow.** It must appear on horizontal scroll and survive React re-renders, freeze toggles and page changes. It's now a DOM attribute React doesn't own. Pinned by the Task 4 manual check.
4. **Reassigning a meeting owner** through the picker. The closed trigger must show the new owner after the list refetches, because it reads the row snapshot, not the disabled query's cache. Pinned by the Task 6 manual check.
5. **Selection and column changes that touch every row.** Campaign-leads checkbox and select-all, and hiding or showing a column from the toolbar, must update every row. These are value changes in `meta` and changes to `visibleColumnIds`. Pinned by the Task 4 manual check.

---

## Before Task 1: working tree (orchestrator, not a subagent)

These files carry uncommitted edits: the owner's own work, plus the meetings customer-cell change from earlier in this session.
- `src/shared/components/data-table/ui/data-table-body.tsx`
- `data-table.tsx`, `primary-cell.tsx` and `customer-name-cell.tsx`
- the `should-toggle-row.ts → is-row-click.ts` rename
- `src/shared/entities/meetings/components/meeting-customer-cell.tsx`
- `use-meetings-table.tsx`
- the meetings and proposals `columns-registry.tsx`

Tasks 3–6 edit most of these files, so their commits would sweep those edits in. **Ask the owner** whether to commit those edits first, as their own commit, before Task 3 starts. Don't commit them without that answer. The two spec files under `docs/superpowers/specs/` are also uncommitted. Commit this spec with the plan only if the owner says so.

---

### Task 1: Records perf probe and baseline

**Files:**
- Create: `scripts/perf/records-probe.mjs`
- Output (gitignored): `.superpowers/sdd/2026-10-01-records-render-isolation/baseline-{meetings,customers,proposals,projects}.txt`

**Interfaces:**
- Produces: `node scripts/perf/records-probe.mjs <path>` prints one block per scenario, in the format shown in Step 3. Every later task and the acceptance task read this format.

- [ ] **Step 1: Write the probe**

```js
/* eslint-disable no-console */
// Measures a records page's render cost per interaction, against the running dev server.
// Dev React is 3-5x slower than production: compare runs with each other, not with production numbers.
import process from 'node:process'
import { chromium } from 'playwright'

process.loadEnvFile('.env.local')

const path = process.argv[2]
if (!path?.startsWith('/')) {
  console.error('Usage: node scripts/perf/records-probe.mjs /dashboard/<records page>')
  process.exit(1)
}
const secret = process.env.DEV_LOGIN_SECRET
if (!secret) {
  console.error('DEV_LOGIN_SECRET is missing from .env.local')
  process.exit(1)
}
const base = `http://localhost:${process.env.PORT ?? 3000}`

function installProbe() {
  window.__probe = { commits: [], longTasks: [], components: {}, rows: {} }
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__probe.longTasks.push(Math.round(entry.duration))
    }
  }).observe({ type: 'longtask', buffered: true })

  // React leaves stale work flags on fibers it reuses, so a fiber counts as rendered when its props or
  // state differ from what this probe last recorded for it or its alternate, whichever was recorded later.
  const seen = new WeakMap()
  let commitIndex = 0
  const isDataRowProps = props => Object.keys(props ?? {}).some(key => /^data-.+-row$/.test(key) && key !== 'data-expanded-row')
  const rowKeyOf = (fiber) => {
    let node = fiber
    for (let depth = 0; depth < 4 && node; depth++, node = node.return) {
      if (node.key != null) {
        return node.key
      }
    }
    return '?'
  }

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
      commitIndex++
      const probe = window.__probe
      probe.commits.push(Math.round(root.current.actualDuration ?? 0))
      const stack = [root.current.child]
      while (stack.length > 0) {
        const fiber = stack.pop()
        if (!fiber) {
          continue
        }
        if (typeof fiber.type === 'function') {
          const mine = seen.get(fiber)
          const theirs = fiber.alternate ? seen.get(fiber.alternate) : undefined
          const last = !mine ? theirs : !theirs ? mine : (mine.at > theirs.at ? mine : theirs)
          const rendered = !last || last.props !== fiber.memoizedProps || last.state !== fiber.memoizedState
          seen.set(fiber, { props: fiber.memoizedProps, state: fiber.memoizedState, at: commitIndex })
          if (rendered) {
            const name = fiber.type.displayName || fiber.type.name || 'anon'
            probe.components[name] = (probe.components[name] ?? 0) + 1
            if (name === 'TableRow' && isDataRowProps(fiber.memoizedProps)) {
              const key = rowKeyOf(fiber)
              probe.rows[key] = (probe.rows[key] ?? 0) + 1
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
    },
  }
}

const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage()
await page.addInitScript(installProbe)

const requests = []
page.on('request', (request) => {
  const url = request.url()
  if (url.includes('/api/trpc/')) {
    requests.push(...decodeURIComponent(url.split('/api/trpc/')[1].split('?')[0]).split(','))
  }
})

const sum = values => values.reduce((total, value) => total + value, 0)
const max = values => Math.max(0, ...values)

async function take(label) {
  const snapshot = await page.evaluate(() => {
    const probe = window.__probe
    window.__probe = { commits: [], longTasks: [], components: {}, rows: {} }
    return probe
  })
  const rowCounts = Object.values(snapshot.rows)
  const procedures = Object.entries(Object.groupBy(requests.splice(0), name => name))
    .map(([name, calls]) => `${name} ×${calls.length}`)
  const top = Object.entries(snapshot.components).sort((a, b) => b[1] - a[1]).slice(0, 8)
  console.log(`\n=== ${label} ===`)
  console.log(`commits ${snapshot.commits.length} · render ${sum(snapshot.commits)}ms (max ${max(snapshot.commits)}ms) · long tasks ${snapshot.longTasks.length} (max ${max(snapshot.longTasks)}ms)`)
  console.log(`rows rendered ${rowCounts.length} · row renders ${sum(rowCounts)} (max ${max(rowCounts)} per row)`)
  console.log(`trpc ${procedures.join(', ') || '—'}`)
  console.log(`top ${top.map(([name, count]) => `${name}×${count}`).join(' | ')}`)
}

async function scenario(label, run) {
  try {
    const skipped = await run()
    if (skipped) {
      console.log(`\n=== ${label} === skipped: ${skipped}`)
      await take(`${label} (discarded)`)
      return
    }
    await take(label)
  }
  catch (error) {
    console.log(`\n=== ${label} === failed: ${error.message.split('\n')[0]}`)
  }
}

function hasDataRows() {
  return [...document.querySelectorAll('tbody tr')]
    .some(tr => [...tr.attributes].some(attr => /^data-.+-row$/.test(attr.name) && attr.name !== 'data-expanded-row'))
}

function firstRowFullyShown() {
  const tr = [...document.querySelectorAll('tbody tr')]
    .find(el => [...el.attributes].some(attr => /^data-.+-row$/.test(attr.name) && attr.name !== 'data-expanded-row'))
  for (let node = tr; node; node = node.parentElement) {
    const style = getComputedStyle(node)
    if (Number.parseFloat(style.opacity) < 0.99) {
      return false
    }
    if (style.transform !== 'none' && style.transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
      return false
    }
  }
  return !!tr
}

await page.goto(`${base}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent(path)}`)
await page.waitForFunction(hasDataRows, null, { timeout: 120000 })
const rowAttribute = await page.evaluate(() => {
  const tr = [...document.querySelectorAll('tbody tr')]
    .find(el => [...el.attributes].some(attr => /^data-.+-row$/.test(attr.name) && attr.name !== 'data-expanded-row'))
  return [...tr.attributes].find(attr => /^data-.+-row$/.test(attr.name) && attr.name !== 'data-expanded-row').name
})
const rows = page.locator(`tbody tr[${rowAttribute}]`)

await page.goto(`${base}/dashboard`)
await page.waitForTimeout(4000)
await take('(discarded) warm-up')

const navigationStart = Date.now()
await page.locator(`a[href="${path}"]`).first().click({ timeout: 10000 })
await page.waitForFunction(hasDataRows, null, { timeout: 60000 })
const rowsInDom = Date.now() - navigationStart
await page.waitForFunction(firstRowFullyShown, null, { timeout: 10000, polling: 16 })
console.log(`\nwarm navigation ${path}: rows in DOM ${rowsInDom}ms · fully shown ${Date.now() - navigationStart}ms`)
await page.waitForTimeout(3000)
await take(`initial load (${await rows.count()} rows)`)

await scenario('idle 5s', async () => {
  await page.waitForTimeout(5000)
})

await scenario('hover sweep', async () => {
  const count = await rows.count()
  for (let index = 0; index < count; index++) {
    const box = await rows.nth(index).boundingBox()
    if (box) {
      await page.mouse.move(box.x + 600, box.y + box.height / 2, { steps: 3 })
    }
  }
  await page.waitForTimeout(500)
})

await scenario('scroll', async () => {
  await page.mouse.move(800, 500)
  for (const delta of [...Array.from({ length: 10 }).fill(300), ...Array.from({ length: 10 }).fill(-300)]) {
    await page.mouse.wheel(0, delta)
    await page.waitForTimeout(50)
  }
  await page.waitForTimeout(500)
})

let opener = 'row click'
await scenario('modal open', async () => {
  // A row with an expand panel toggles on click instead of opening, so fall back to the customer-name link.
  await rows.nth(1).locator('td').nth(1).click({ position: { x: 3, y: 3 } })
  const opened = await page.waitForSelector('[role=dialog]', { timeout: 4000 }).then(() => true, () => false)
  if (!opened) {
    if (await page.locator('[data-expanded-row]:not([aria-hidden])').count() > 0) {
      await rows.nth(1).locator('td').nth(1).click({ position: { x: 3, y: 3 } })
    }
    const link = rows.nth(1).locator('button.underline').first()
    if (await link.count() === 0) {
      return 'no row click or customer link opens a dialog'
    }
    opener = 'customer link'
    await page.waitForTimeout(1500)
    await take('(discarded) row click toggled the row')
    await link.click()
    await page.waitForSelector('[role=dialog]', { timeout: 30000 })
  }
  await page.waitForTimeout(3000)
})
console.log(`(modal opened by ${opener})`)

await scenario('modal close', async () => {
  if (await page.locator('[role=dialog]').count() === 0) {
    return 'no dialog open'
  }
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 10000 })
  await page.waitForTimeout(1500)
})

await scenario('expand row', async () => {
  const toggle = rows.first().locator('button[aria-label="Expand row"]')
  if (await toggle.count() === 0) {
    return 'table has no expand panel'
  }
  await toggle.click()
  await page.waitForTimeout(2000)
})

await scenario('collapse row', async () => {
  const toggle = rows.first().locator('button[aria-label="Collapse row"]')
  if (await toggle.count() === 0) {
    return 'no expanded row'
  }
  await toggle.click()
  await page.waitForTimeout(1000)
})

await scenario('open participant picker', async () => {
  const trigger = page.locator('button[aria-label^="Participants:"]').first()
  if (await trigger.count() === 0) {
    return 'no participant picker'
  }
  await trigger.click()
  await page.waitForTimeout(2000)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
})

await scenario('search keystrokes "ma"', async () => {
  const input = page.locator('input[placeholder^="Search"]').first()
  if (await input.count() === 0) {
    return 'no search input'
  }
  await input.click()
  await page.keyboard.type('ma', { delay: 150 })
  await page.waitForTimeout(2500)
})

await scenario('clear search', async () => {
  const input = page.locator('input[placeholder^="Search"]').first()
  if (await input.count() === 0) {
    return 'no search input'
  }
  await input.fill('')
  await page.waitForTimeout(2500)
})

await scenario('next page', async () => {
  const next = page.getByRole('button', { name: 'Next page' })
  if (await next.count() === 0 || !(await next.isEnabled())) {
    return 'only one page'
  }
  await next.click()
  await page.waitForTimeout(2500)
})

await browser.close()
```

- [ ] **Step 2: Lint the probe**

Run: `pnpm eslint scripts/perf/records-probe.mjs --fix && pnpm eslint scripts/perf/records-probe.mjs`

Expected: no errors. If the antfu config rejects `Object.groupBy` or the top-level `await`, change only the flagged lines, and note in the commit what changed.

- [ ] **Step 3: Run the baseline on all four pages**

Make sure the dev server is up first: `ss -ltnp | grep ":${PORT:-3000}"`.

Run, one page at a time and each to completion:

```bash
mkdir -p .superpowers/sdd/2026-10-01-records-render-isolation
for page in meetings customers proposals projects; do
  node scripts/perf/records-probe.mjs /dashboard/$page < /dev/null | tee .superpowers/sdd/2026-10-01-records-render-isolation/baseline-$page.txt
done
```

Expected on `/dashboard/meetings`: blocks in this shape, with the numbers below roughly matching the spec's "Why" table.

```
warm navigation /dashboard/meetings: rows in DOM 900ms · fully shown 1300ms

=== initial load (20 rows) ===
commits 51 · render 2400ms (max 615ms) · long tasks 6 (max 590ms)
rows rendered 20 · row renders 300 (max 20 per row)
trpc meetingsRouter.reads.list ×1, meetingsRouter.participants.getParticipants ×20, …
top TableCell×… | …
```

What matters:
- `modal open` shows row renders ≈ 20 (every row).
- `initial load` shows `getParticipants ×` ≈ the row count.
- `idle`, `hover sweep` and `scroll` show `commits 0` or close to it.

If a scenario prints `failed:`, fix the selector in the probe before continuing. A baseline with gaps proves nothing later.

- [ ] **Step 4: Commit**

```bash
git add scripts/perf/records-probe.mjs
git commit -m "chore(perf): records-page render probe

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `useStableCallbacks`

**Files:**
- Create: `src/shared/lib/stable-callbacks.ts`
- Create: `src/shared/hooks/use-stable-callbacks.ts`
- Test: `scripts/verify-stable-callbacks.ts`

**Interfaces:**
- Produces: `hasSameValues(prev: unknown, next: unknown): boolean` and `withLatestCallbacks<T>(value: T, read: () => T): T` from `@/shared/lib/stable-callbacks`.
- Produces: `useStableCallbacks<T extends object>(value: T): T` from `@/shared/hooks/use-stable-callbacks`. It takes a plain object or an array of plain objects, and returns the same shape. Function entries are stable wrappers that call the latest committed render's function. The result keeps its identity until a non-function entry changes, by `Object.is`, or until entries or items are added or removed.

- [ ] **Step 1: Write the failing verify script**

```ts
/* eslint-disable no-console */
import assert from 'node:assert/strict'
import { hasSameValues, withLatestCallbacks } from '@/shared/lib/stable-callbacks'

const first = () => 1
const second = () => 2
const selected = new Set(['x'])

assert.equal(hasSameValues({ onClick: first, can: true }, { onClick: second, can: true }), true, 'a new closure alone is no change')
assert.equal(hasSameValues({ onClick: first, can: true }, { onClick: first, can: false }), false, 'a value change is a change')
assert.equal(hasSameValues({ ids: selected }, { ids: new Set(['x']) }), false, 'values compare by identity')
assert.equal(hasSameValues({ ids: selected }, { ids: selected }), true, 'the same value is no change')
assert.equal(hasSameValues({ onClick: first }, { onClick: first, extra: 1 }), false, 'an added entry is a change')
assert.equal(hasSameValues({ x: 1, onClick: first }, { y: 1, onClick: first }), false, 'a renamed entry is a change')
assert.equal(hasSameValues({ onClick: first }, { onClick: undefined }), false, 'a callback removed is a change')
assert.equal(hasSameValues([{ onAction: first, isLoading: false }], [{ onAction: second, isLoading: false }]), true, 'array items compare entry by entry')
assert.equal(hasSameValues([{ onAction: first, isLoading: false }], [{ onAction: first, isLoading: true }]), false, 'a flag flip in an item is a change')
assert.equal(hasSameValues([{ onAction: first }], [{ onAction: first }, { onAction: first }]), false, 'an added item is a change')

let current = { onClick: (n: number) => n + 1, label: 'x' }
const stable = withLatestCallbacks(current, () => current)
current = { onClick: (n: number) => n + 100, label: 'x' }
assert.equal(stable.onClick(1), 101, 'the wrapper calls the latest closure')
assert.equal(stable.label, 'x', 'values pass through')

let items = [{ onAction: () => 'first', isLoading: false }]
const stableItems = withLatestCallbacks(items, () => items)
items = [{ onAction: () => 'second', isLoading: false }]
assert.equal(stableItems[0]?.onAction(), 'second', 'array items call the latest closure')

let shrinking: { onClick?: () => string } = { onClick: () => 'kept' }
const fallback = withLatestCallbacks(shrinking, () => shrinking)
shrinking = {}
assert.equal(fallback.onClick?.(), 'kept', 'a callback gone from the latest value falls back to its own closure')

console.log('✅ stable callbacks verified')
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm tsx scripts/verify-stable-callbacks.ts`

Expected: FAIL, because `@/shared/lib/stable-callbacks` can't be resolved.

- [ ] **Step 3: Write the lib**

`src/shared/lib/stable-callbacks.ts`:

```ts
type Callback = (...args: unknown[]) => unknown
type Entries = Record<string, unknown>

function isPlainObject(value: unknown): value is Entries {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

function sameEntries(prev: Entries, next: Entries): boolean {
  const keys = Object.keys(next)
  if (keys.length !== Object.keys(prev).length) {
    return false
  }
  return keys.every((key) => {
    if (!(key in prev)) {
      return false
    }
    const before = prev[key]
    const after = next[key]
    return (typeof before === 'function' && typeof after === 'function') || Object.is(before, after)
  })
}

/** Whether `next` differs from `prev` only in which closures its function entries hold. */
export function hasSameValues(prev: unknown, next: unknown): boolean {
  if (Array.isArray(prev) && Array.isArray(next)) {
    return prev.length === next.length && next.every((item, index) => {
      const before: unknown = prev[index]
      return isPlainObject(before) && isPlainObject(item) ? sameEntries(before, item) : Object.is(before, item)
    })
  }
  if (isPlainObject(prev) && isPlainObject(next)) {
    return sameEntries(prev, next)
  }
  return Object.is(prev, next)
}

function wrapEntries(entries: Entries, read: () => unknown): Entries {
  return Object.fromEntries(Object.entries(entries).map(([key, entry]) => [
    key,
    typeof entry === 'function'
      ? (...args: unknown[]) => {
          const latest = isPlainObject(read()) ? (read() as Entries)[key] : undefined
          // Between a render that drops this entry and its commit, the latest value no longer has it.
          return (typeof latest === 'function' ? latest as Callback : entry as Callback)(...args)
        }
      : entry,
  ]))
}

/** A copy of `value` whose function entries call whatever `read()` holds at call time. */
export function withLatestCallbacks<T>(value: T, read: () => T): T {
  if (Array.isArray(value)) {
    return value.map((item: unknown, index) =>
      isPlainObject(item) ? wrapEntries(item, () => (read() as unknown[])[index]) : item,
    ) as T
  }
  return (isPlainObject(value) ? wrapEntries(value, read) : value) as T
}
```

- [ ] **Step 4: Run the verify script**

Run: `pnpm tsx scripts/verify-stable-callbacks.ts`

Expected: `✅ stable callbacks verified`

- [ ] **Step 5: Write the hook**

`src/shared/hooks/use-stable-callbacks.ts`:

```ts
'use client'

import { useLayoutEffect, useRef, useState } from 'react'

import { hasSameValues, withLatestCallbacks } from '@/shared/lib/stable-callbacks'

/**
 * `value` (an object, or an array of objects) with stable function entries that call the latest
 * committed render's version, keeping its identity until a non-function entry changes. For values
 * whose identity drives re-renders, like table meta and row action configs. A function called while
 * rendering runs the previous commit's closure, so such functions must depend only on their arguments.
 */
export function useStableCallbacks<T extends object>(value: T): T {
  const latest = useRef(value)
  useLayoutEffect(() => {
    latest.current = value
  })
  const [snapshot, setSnapshot] = useState(() => ({ source: value, stable: withLatestCallbacks(value, () => latest.current) }))
  if (!hasSameValues(snapshot.source, value)) {
    const next = { source: value, stable: withLatestCallbacks(value, () => latest.current) }
    setSnapshot(next)
    return next.stable
  }
  return snapshot.stable
}
```

- [ ] **Step 6: Type-check and lint**

Run: `pnpm tsc && pnpm lint`

Expected: clean, apart from the known `monthly-cost-chart.tsx(31)` error.

- [ ] **Step 7: Commit**

```bash
git add src/shared/lib/stable-callbacks.ts src/shared/hooks/use-stable-callbacks.ts scripts/verify-stable-callbacks.ts
git commit -m "feat(hooks): useStableCallbacks keeps an object's identity across new closures

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Entity row actions become stable values

**Files:**
- Modify: `src/shared/entities/meetings/hooks/use-meeting-action-configs.ts:109-191`
- Modify: `src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts:80-123`
- Modify: `src/shared/modules/projects/core/hooks/use-project-action-configs.ts:45-63`
- Modify: `src/shared/entities/customers/hooks/use-customer-action-configs.ts:47-74`
- Modify registries:
  - `src/shared/entities/meetings/lib/columns-registry.tsx` (`MeetingTableMeta`, and the `customerName` cell's `actions=`)
  - `src/shared/modules/proposals/core/lib/columns-registry.tsx:22-39`
  - `src/shared/modules/projects/core/lib/columns-registry.tsx:13-26`
  - `src/shared/entities/customers/lib/columns-registry.tsx` (`CustomerTableMeta.customerActions`, and the cell at about line 110)
- Modify consumers:
  - `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx:77`
  - `src/features/proposal-flow/ui/components/table/index.tsx:127`
  - `src/features/project-management/ui/components/table/index.tsx:60`
  - `src/shared/entities/customers/components/customers-table.tsx:64`
  - `src/features/lead-sources-admin/ui/components/all-customers-section.tsx:62`
  - `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx:72`

**Interfaces:**
- Consumes: `useStableCallbacks` (Task 2).
- Produces: `MeetingTableMeta.meetingActions?: EntityActionConfig<MeetingRow>[]`, `ProposalTableMeta.proposalActions?: EntityActionConfig<ProposalRow>[]`, `ProjectTableMeta.projectActions?: EntityActionConfig<ProjectRow>[]` and `CustomerTableMeta.customerActions?: EntityActionConfig<CustomerTableRow>[]`. These are values, not getters.
- Produces: each `use<Entity>ActionConfigs(...).actions` keeps its identity across renders until an `isLoading` or `isDisabled` flips, or an action is added or removed.

- [ ] **Step 1: Run the four action arrays through `useStableCallbacks`**

In each of the four hooks:
- replace the `useMemo((): EntityActionConfig<T>[] => [...], [deps])` with a plain array passed to `useStableCallbacks`
- delete the deps array
- drop `useMemo` from the `react` import if nothing else uses it
- add `import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'`

Projects, as the shape every hook follows:

```ts
  // The configs' callbacks close over this render's mutations; only the loading flag should re-render rows.
  const actions = useStableCallbacks<EntityActionConfig<T>[]>([
    {
      action: PROJECT_ACTIONS.view,
      onAction: overrides.onView ?? defaultView,
    },
    {
      action: PROJECT_ACTIONS.edit,
      onAction: overrides.onEdit ?? defaultEdit,
    },
    {
      action: PROJECT_ACTIONS.delete,
      onAction: async (entity) => {
        const ok = await confirmDelete()
        if (ok) {
          deleteProject.mutate({ id: entity.id })
        }
      },
      isLoading: deleteProject.isPending,
    },
  ])
```

Proposals and customers follow the same pattern: the existing array literal, unchanged, becomes the argument, and the deps array goes.

Meetings builds its array with `push`. Keep the construction and drop only the memo:

```ts
  const configs: EntityActionConfig<T>[] = [
    // …the existing literal entries, unchanged…
  ]

  if (overrides.onAssignProject) {
    configs.push({
      action: MEETING_ACTIONS.assignProject,
      onAction: overrides.onAssignProject,
    })
  }

  configs.push({
    // …the existing delete entry, unchanged…
  })

  // The configs' callbacks close over this render's mutations; only the loading flags should re-render rows.
  const actions = useStableCallbacks(configs)
```

- [ ] **Step 2: Make the registries read actions as values**

For each of the four registries, change the `meta` field's type from a getter to a value, and the cell from a call to a read. For meetings:

```ts
export interface MeetingTableMeta {
  meetingActions?: EntityActionConfig<MeetingRow>[]
  // …other fields unchanged…
}
```

```tsx
          actions={meta?.meetingActions}
```

Make the same change for `proposalActions` (`ProposalRow`), `projectActions` (`ProjectRow`) and `customerActions` (`CustomerTableRow`).

- [ ] **Step 3: Pass the arrays from the six consumers**

In each consumer, `xActions: () => actions` becomes `xActions: actions`. For example, in `use-meetings-table.tsx`:

```ts
    meetingActions: actions,
```

Likewise:
- `proposalActions: sharedActions`
- `projectActions: sharedActions`
- `customerActions: actions` in `customers-table.tsx`, `all-customers-section.tsx` and `lead-source-customers-section.tsx`

Then confirm nothing still calls a getter:

Run: `grep -rnE "(meeting|proposal|project|customer)Actions(\?\.)?\(" src`

Expected: no output.

- [ ] **Step 4: Type-check and lint**

Run: `pnpm tsc && pnpm lint`

Expected: clean, apart from the known error. A leftover getter fails here, because a getter is not assignable to an array.

- [ ] **Step 5: Manual check (Review Focus 2)**

Open `/dashboard/proposals` in the dev server. On one row, open the actions menu and choose Duplicate. The menu item shows its loading state while the request runs, and the list gets the copy.

On `/dashboard/meetings`, check these through the row actions menu:
- Set outcome shows a checkmark on the current value.
- Reschedule is disabled, with its reason, on a meeting that can't be rescheduled.
- View opens the customer profile.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/meetings/hooks/use-meeting-action-configs.ts \
  src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts \
  src/shared/modules/projects/core/hooks/use-project-action-configs.ts \
  src/shared/entities/customers/hooks/use-customer-action-configs.ts \
  src/shared/entities/meetings/lib/columns-registry.tsx \
  src/shared/modules/proposals/core/lib/columns-registry.tsx \
  src/shared/modules/projects/core/lib/columns-registry.tsx \
  src/shared/entities/customers/lib/columns-registry.tsx \
  src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx \
  src/features/proposal-flow/ui/components/table/index.tsx \
  src/features/project-management/ui/components/table/index.tsx \
  src/shared/entities/customers/components/customers-table.tsx \
  src/features/lead-sources-admin/ui/components/all-customers-section.tsx \
  src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx
git commit -m "refactor(entities): row action configs keep their identity until a flag changes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `DataTable` stable meta and memoized rows

**Files:**
- Create: `src/shared/components/data-table/ui/data-table-row.tsx`
- Create: `src/shared/components/data-table/constants/frozen-column-shadow.ts`
- Modify: `src/shared/components/data-table/ui/data-table-body.tsx` (whole row loop and props)
- Modify: `src/shared/components/data-table/ui/data-table.tsx`:
  - the `meta` prop doc, at line 34
  - the `isScrolled` state and `handleScroll`, at lines 105–116
  - `meta:` in `useReactTable`, at lines 258–261
  - `showFrozenShadow`, at line 277
  - the header's shadow class, at line 337
  - the scroller `className`, at lines 302–309
  - the `DataTableBody` props, at lines 424–442

**Interfaces:**
- Consumes: `useStableCallbacks` (Task 2). Task 3's stable action arrays make `meta` stable on the four records pages.
- Produces: `DataTableRow` (memoized). Its probe-visible behaviour: on an unrelated render, a row's `TableRow` doesn't re-render.
- Produces: the body prop `onRowClick: (event: MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void`, a stable wrapper made by `DataTable`.
- The public `DataTableProps` is unchanged.

- [ ] **Step 1: Add the shadow constant**

`src/shared/components/data-table/constants/frozen-column-shadow.ts`:

```ts
// Keyed off the scroller's `data-scrolled`, which the scroll handler sets on the DOM directly, so scrolling renders nothing.
export const FROZEN_COLUMN_SHADOW = 'transition-shadow duration-200 group-data-[scrolled]/scroller:shadow-[4px_0_8px_0_rgba(0,0,0,0.3)]'
```

- [ ] **Step 2: Write `DataTableRow`**

`src/shared/components/data-table/ui/data-table-row.tsx`:

```tsx
'use client'

import type { Row } from '@tanstack/react-table'
import type { MouseEvent, ReactNode } from 'react'

import { flexRender } from '@tanstack/react-table'
import { ChevronRightIcon } from 'lucide-react'
import { Fragment, memo } from 'react'

import { CELL_BORDER } from '@/shared/components/data-table/constants/cell-border'
import { FROZEN_COLUMN_SHADOW } from '@/shared/components/data-table/constants/frozen-column-shadow'
import { AnimatedCollapsibleContent } from '@/shared/components/ui/collapsible'
import { TableCell, TableRow } from '@/shared/components/ui/table'
import { cn } from '@/shared/lib/utils'

interface DataTableRowProps<TData extends { id: string }> {
  row: Row<TData>
  /** `table.options.meta`. Cells read it from the table; only its identity matters here. */
  meta: unknown
  /** The column definitions. Cells read them from the row; only their identity matters here. */
  columns: unknown
  /** Visible column ids, joined, so hiding or showing a column re-renders the row. */
  visibleColumnIds: string
  isExpanded: boolean
  isFrozen: boolean
  rowClassName?: string
  rowDataAttribute: string
  detailId: string
  hasExpandedRow: boolean
  /** Built by the body only while the row is expanded. */
  expandedContent: ReactNode
  onRowClick: (event: MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void
}

function DataTableRowImpl<TData extends { id: string }>({
  row,
  isExpanded,
  isFrozen,
  rowClassName,
  rowDataAttribute,
  detailId,
  hasExpandedRow,
  expandedContent,
  onRowClick,
}: DataTableRowProps<TData>) {
  const rowProps: Record<string, unknown> = { [rowDataAttribute]: true }
  const expandToggle = hasExpandedRow
    ? (
        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={detailId}
          aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
          onClick={(e) => {
            e.stopPropagation()
            row.toggleExpanded()
          }}
          className="shrink-0 cursor-pointer rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          <ChevronRightIcon className={cn('size-4 motion-safe:transition-transform', isExpanded && 'rotate-90')} />
        </button>
      )
    : null

  return (
    <Fragment>
      <TableRow
        className={`group cursor-pointer border-border/50${rowClassName ? ` ${rowClassName}` : ''}`}
        onClick={e => onRowClick(e, row)}
        {...rowProps}
      >
        {row.getVisibleCells().map((cell, colIdx) => {
          const content = flexRender(cell.column.columnDef.cell, cell.getContext())
          const cellContent = colIdx === 0 && expandToggle
            ? (
                <div className="flex items-center gap-1">
                  {expandToggle}
                  <div className="min-w-0 flex-1">{content}</div>
                </div>
              )
            : content

          if (colIdx === 0 && isFrozen) {
            return (
              <TableCell
                key={cell.id}
                className={cn('sticky left-0 z-5 p-0 border-r border-border/50', CELL_BORDER, FROZEN_COLUMN_SHADOW)}
                style={{ borderRightStyle: 'dashed' }}
              >
                <div className="absolute inset-0 bg-background group-hover:bg-muted/50 transition-colors" />
                {rowClassName && <div className={cn('absolute inset-0', rowClassName)} />}
                <div className="relative p-2">
                  {cellContent}
                </div>
              </TableCell>
            )
          }

          return (
            <TableCell key={cell.id} className={CELL_BORDER}>
              {cellContent}
            </TableCell>
          )
        })}
      </TableRow>
      {hasExpandedRow && (
        <TableRow data-expanded-row aria-hidden={!isExpanded || undefined} className="hover:bg-transparent">
          <TableCell colSpan={row.getVisibleCells().length} className={cn('p-0 whitespace-normal', isExpanded && CELL_BORDER)}>
            {/* Pinned to the visible width so the panel stays in view while the columns scroll sideways.
                Sticky breaks if this cell or any ancestor up to the scroller gets overflow: hidden. */}
            <div id={detailId} className="sticky left-0" style={{ width: '100cqw' }}>
              <AnimatedCollapsibleContent open={isExpanded}>
                {expandedContent}
              </AnimatedCollapsibleContent>
            </div>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  )
}

// A refetch that changes one row rebuilds every TanStack Row, so the row's data decides, not the Row instance.
// Query structural sharing keeps unchanged rows' data identical.
function areRowPropsEqual<TData extends { id: string }>(prev: DataTableRowProps<TData>, next: DataTableRowProps<TData>) {
  for (const key of Object.keys(next) as (keyof DataTableRowProps<TData>)[]) {
    if (key !== 'row' && !Object.is(prev[key], next[key])) {
      return false
    }
  }
  return prev.row.original === next.row.original
}

export const DataTableRow = memo(DataTableRowImpl, areRowPropsEqual) as typeof DataTableRowImpl
```

- [ ] **Step 3: Render rows through `DataTableRow` in the body**

In `data-table-body.tsx`:
- Delete the props `isMobile`, `setActiveRowId` and `showFrozenShadow`. Change `onRowClick` to `onRowClick: (event: MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void`.
- Drop the now-unused imports: `Dispatch`, `SetStateAction`, `flexRender`, `ChevronRightIcon`, `Fragment`, `isRowClick` and `AnimatedCollapsibleContent`. Add `MouseEvent` (type) and `DataTableRow`.
- Replace the whole `{rows.map((row) => { … })}` block (lines 112–211) with:

```tsx
      {rows.map((row) => {
        const isExpanded = row.getIsExpanded()
        return (
          <DataTableRow
            key={row.id}
            row={row}
            meta={meta}
            columns={columns}
            visibleColumnIds={visibleColumnIds}
            isExpanded={isExpanded}
            isFrozen={isFrozen}
            rowClassName={getRowClassName?.(row.original)}
            rowDataAttribute={rowDataAttribute}
            detailId={`${tableId ?? entityName}-detail-${row.id}`}
            hasExpandedRow={!!renderExpandedRow}
            expandedContent={isExpanded && renderExpandedRow ? renderExpandedRow(row.original) : null}
            onRowClick={onRowClick}
          />
        )
      })}
```

with, at the top of `DataTableBodyImpl`'s body:

```tsx
  const meta = table.options.meta
  const columns = table.options.columns
  const visibleColumnIds = table.getVisibleLeafColumns().map(column => column.id).join(',')
```

The column-drag memo at the bottom of the file stays as it is.

- [ ] **Step 4: Rewire `DataTable`**

In `data-table.tsx`:

1. Imports:
   - add `import type { Row } from '@tanstack/react-table'`
   - add `MouseEvent` to the `react` type import
   - add `import { FROZEN_COLUMN_SHADOW } from '@/shared/components/data-table/constants/frozen-column-shadow'`
   - add `import { isRowClick } from '@/shared/components/data-table/lib/is-row-click'`
   - add `import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'`
2. The `meta` prop doc:

```ts
  /**
   * Read by cells through `table.options.meta`. Function entries are event callbacks: they stay stable and
   * always run the latest version. Anything a cell reads while rendering must be a value, because rows
   * re-render only when a value here changes identity.
   */
  meta?: TMeta
```

3. Delete `const [isScrolled, setIsScrolled] = useState(false)`. `handleScroll` becomes:

```ts
  const handleScroll = useCallback(() => {
    const el = scrollRef.current
    if (el) {
      el.toggleAttribute('data-scrolled', el.scrollLeft > 0)
    }
  }, [])
```

4. Before `useReactTable`:

```ts
  const stableMeta = useStableCallbacks((meta ?? NO_META) as object) as TMeta
  const { handleRowClick } = useStableCallbacks({
    handleRowClick: (event: MouseEvent<HTMLTableRowElement>, row: Row<TData>) => {
      if (onRowClick || renderExpandedRow) {
        if (!isRowClick(event, window.getSelection()?.toString() ?? '')) {
          return
        }
        if (renderExpandedRow) {
          row.toggleExpanded()
        }
        else {
          onRowClick?.(row.original)
        }
      }
      else if (isMobile) {
        setActiveRowId(prev => prev === row.original.id ? null : row.original.id)
      }
    },
  })
```

   with `const NO_META = {}` next to `NO_COLUMN_SIZING`. Copy the click branch exactly from the current `data-table-body.tsx:139-154`, which is the owner's current behaviour. If the file differs when you start, copy what it says then.

5. In `useReactTable`: `meta: stableMeta,`. `activeRowId` leaves `meta`, because no cell reads it. The `activeRowId` state and its effects stay.
6. Delete `const showFrozenShadow = isFrozen && isScrolled`. In the header's first-column `cn(...)`, replace the `'transition-shadow duration-200'` and `showFrozenShadow && 'shadow-…'` lines with `FROZEN_COLUMN_SHADOW`.
7. Add `'group/scroller'` to the scroller `div`'s `cn(...)`.
8. In `<DataTableBody …>`, delete `isMobile`, `setActiveRowId` and `showFrozenShadow`, and pass `onRowClick={handleRowClick}`.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`

Expected: clean, apart from the known error.

- [ ] **Step 6: Probe meetings and customers**

Run:

```bash
node scripts/perf/records-probe.mjs /dashboard/meetings < /dev/null | tee .superpowers/sdd/2026-10-01-records-render-isolation/after-a-meetings.txt
node scripts/perf/records-probe.mjs /dashboard/customers < /dev/null | tee .superpowers/sdd/2026-10-01-records-render-isolation/after-a-customers.txt
```

Expected:
- `modal open` and `modal close`: `row renders` at most the row count. This can't reach 0 yet: every modal opener still subscribes to the whole store until Task 5. The probe should show far less render time than the baseline.
- `expand row`: `row renders 1` on meetings.
- `hover sweep` and `scroll`: still about 0 commits.

If `modal open` still shows every row re-rendering, a value in `meta` is changing identity on every render. Log `hasSameValues` mismatches temporarily to find it, then remove the logging.

- [ ] **Step 7: Manual checks (Review Focus 1, 3, 5)**

On the dev server:
- Meetings: change an outcome inline, change a scheduled date, open and close a row's expand panel, and use the panel's actions. The edited row shows the new values.
- Proposals: change a status inline.
- Customers: change a created date.
- Scroll any table sideways: the frozen column's shadow appears. Toggle the freeze pin off and on, and change page: the shadow still follows the scroll.
- Hide a column and show it again from the toolbar: every row updates.
- `/dashboard/campaigns` leads table: tick one row, then select all, then clear. Every checkbox follows.
- Resize a column: the drag stays smooth and the widths stick.
- Mobile viewport (DevTools device mode): tap a row on a table without `onRowClick`. It behaves as before.

- [ ] **Step 8: Commit**

```bash
git add src/shared/components/data-table/ui/data-table-row.tsx \
  src/shared/components/data-table/constants/frozen-column-shadow.ts \
  src/shared/components/data-table/ui/data-table-body.tsx \
  src/shared/components/data-table/ui/data-table.tsx
git commit -m "perf(data-table): rows re-render only when their data, expansion, meta values or columns change

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `openModal()` and selector-only modal store reads

**Files:**
- Create: `src/shared/lib/open-modal.ts`
- Modify openers (18 files in all, counting the readers below):
  - `src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx:34,107-117`
  - `src/features/proposal-flow/ui/components/form/index.tsx:75-88`
  - `src/features/proposal-flow/ui/components/proposal/heading.tsx:20-56`
  - `src/features/meeting-flow/ui/components/shell/customer-chip.tsx:24-43`
  - `src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx:37-52`
  - `src/features/proposal-flow/ui/components/form/sow-field.tsx:68,233-252`
  - `src/features/proposal-flow/ui/components/table/index.tsx:42,134-137`
  - `src/features/agent-dashboard/ui/components/dashboard-proposal-customer-link.tsx:28-41`
  - `src/features/lead-sources-admin/ui/components/all-customers-section.tsx:29,45-51`
  - `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx:43,95-101`
  - `src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx:33,49-55`
  - `src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx:44,51-61,85-89`
  - `src/shared/entities/meetings/components/overview-card.tsx:111-120`
  - `src/shared/entities/customers/components/customers-table.tsx:29,44-51`
- Modify readers:
  - `src/shared/components/dialogs/modals/global-dialogs.tsx:7`
  - `src/shared/components/dialogs/modals/templates-modal.tsx:14`
  - `src/features/proposal-flow/ui/components/internal-financials-modal.tsx:23`
  - `src/shared/entities/customers/components/profile/customer-profile-modal.tsx:23`

**Interfaces:**
- Produces: `openModal<P>(modal: ModalDescriptor<P>): void` from `@/shared/lib/open-modal`.
- Consumes: `useModalStore` and `ModalDescriptor`, which are unchanged.

- [ ] **Step 1: Write `openModal`**

`src/shared/lib/open-modal.ts`:

```ts
import type { ModalDescriptor } from '@/shared/lib/create-modal-store'

import { useModalStore } from '@/shared/hooks/use-modal-store'

// A plain function, not a hook: an opener that subscribed to the store re-rendered on every modal open and close.
export function openModal<P>(modal: ModalDescriptor<P>) {
  const { setModal, open } = useModalStore.getState()
  setModal(modal)
  open()
}
```

- [ ] **Step 2: Migrate the openers**

The same transformation applies in each opener:
- Delete the `const { open…, setModal } = useModalStore()` line and the `useModalStore` import.
- Add `import { openModal } from '@/shared/lib/open-modal'`.
- Replace each `setModal(X)` followed by `openModal()` (or `open()` in `customer-chip.tsx`) with `openModal(X)`.
- Remove `setModal` and `openModal` from every deps array. Where a `useCallback` is left with only module-level references, keep it with `[]`.

Before:

```ts
  const { setModal, open: openModal } = useModalStore()
  const handleViewProfile = useCallback((customerId: string) => {
    setModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
    openModal()
  }, [setModal, openModal])
```

After:

```ts
  const handleViewProfile = useCallback((customerId: string) => {
    openModal({ accessor: 'CustomerProfile', Component: CustomerProfileModal, props: { customerId } })
  }, [])
```

`sow-field.tsx` also closes from inside the modal's `onSelect`. Delete its destructuring line, call `openModal({...})`, and replace `closeModal()` with `useModalStore.getState().close()`. Keep its `useModalStore` import for that.

- [ ] **Step 3: Migrate the readers to selectors**

```ts
// global-dialogs.tsx
  const baseModal = useModalStore(state => state.modal)
```

```ts
// templates-modal.tsx, internal-financials-modal.tsx, customer-profile-modal.tsx
  const isOpen = useModalStore(state => state.isOpen)
  const close = useModalStore(state => state.close)
```

- [ ] **Step 4: Confirm nothing subscribes to the whole store**

Run: `grep -rn "useModalStore()" src`

Expected: no output.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`

Expected: clean, apart from the known error. Watch for `react-hooks/exhaustive-deps` warnings in the edited callbacks.

- [ ] **Step 6: Probe meetings**

Run:

```bash
node scripts/perf/records-probe.mjs /dashboard/meetings < /dev/null | tee .superpowers/sdd/2026-10-01-records-render-isolation/after-b-meetings.txt
```

Expected: `modal open` and `modal close` show `row renders 0`.

- [ ] **Step 7: Manual check**

Open each modal type once:
- customer profile, from meetings, customers, proposals, the campaign leads table, the pipeline view, the schedule calendar, the agent dashboard link, and the meeting overview card
- templates, from the proposal form's SOW field: picking a template closes it and inserts the content
- internal financials, from the proposal heading

Each opens with the right content and closes on Escape.

- [ ] **Step 8: Commit**

Stage the new file, then each of the 18 files listed above, by path:

```bash
git add src/shared/lib/open-modal.ts \
  src/features/campaigns-admin/ui/views/campaigns-leads-view.tsx \
  src/features/proposal-flow/ui/components/form/index.tsx \
  src/features/proposal-flow/ui/components/proposal/heading.tsx \
  src/features/meeting-flow/ui/components/shell/customer-chip.tsx \
  src/features/schedule-management/ui/components/schedule-meetings-calendar.tsx \
  src/features/proposal-flow/ui/components/form/sow-field.tsx \
  src/features/proposal-flow/ui/components/table/index.tsx \
  src/features/agent-dashboard/ui/components/dashboard-proposal-customer-link.tsx \
  src/features/lead-sources-admin/ui/components/all-customers-section.tsx \
  src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx \
  src/features/lead-sources-admin/ui/components/lead-source-customers-section.tsx \
  src/shared/entities/meetings/components/meetings-table/use-meetings-table.tsx \
  src/shared/entities/meetings/components/overview-card.tsx \
  src/shared/entities/customers/components/customers-table.tsx \
  src/shared/components/dialogs/modals/global-dialogs.tsx \
  src/shared/components/dialogs/modals/templates-modal.tsx \
  src/features/proposal-flow/ui/components/internal-financials-modal.tsx \
  src/shared/entities/customers/components/profile/customer-profile-modal.tsx
git commit -m "perf(modals): openers call openModal() instead of subscribing to the whole store

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Participant picker fetches only when opened

**Files:**
- Modify: `src/shared/entities/meetings/components/participant-picker/participant-picker.tsx:15-69`
- Modify: `src/shared/entities/meetings/components/participant-picker/types.ts:1-10` (the comment only)

**Interfaces:**
- The props are unchanged. Behaviour change: with `initialOwner` or `initialCoOwner` set, there's no `getParticipants` request until the popover opens.

- [ ] **Step 1: Gate the query and render from the snapshot while closed**

Replace lines 50–69 with:

```tsx
  const snapshot = useMemo(
    () => buildPlaceholderParticipants(initialOwner, initialCoOwner),
    [initialOwner, initialCoOwner],
  )

  // A row that passes its owner needs no request until the picker opens. While closed it shows that
  // snapshot, not the cache: invalidation skips a disabled query, so the cache would keep a stale owner
  // after a reassign, while the refetched row carries the new one.
  const participantsQuery = useQuery({
    ...trpc.meetingsRouter.participants.getParticipants.queryOptions({ meetingId }),
    enabled: popoverOpen || !snapshot,
  })

  const fetched = popoverOpen || !snapshot ? participantsQuery.data : undefined
  const participants = fetched ?? snapshot ?? []
  const owner = participants.find(p => p.role === 'owner')
  const coOwner = participants.find(p => p.role === 'co_owner')
  const isLoading = !snapshot && participantsQuery.isLoading
```

Replace the `initialOwner` prop doc (lines 18–24) with:

```ts
  /** The owner the parent already loaded (e.g. a table row). Shown while closed; no request until the picker opens. */
```

- [ ] **Step 2: Correct the `types.ts` comment**

Replace lines 1–10 with:

```ts
/**
 * The owner / co-owner a parent (e.g. a table row) already loaded, passed to `ParticipantPicker` and
 * `ReadOnlyParticipantSummary` so neither fetches `getParticipants` per row: the picker shows it until it
 * opens, the summary seeds the cache with it as `initialData`.
 *
 * Fields are nullable to mirror the list query's left joins on the participants table.
 */
```

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`

Expected: clean, apart from the known error.

- [ ] **Step 4: Probe meetings**

Run:

```bash
node scripts/perf/records-probe.mjs /dashboard/meetings < /dev/null | tee .superpowers/sdd/2026-10-01-records-render-isolation/after-c-meetings.txt
```

Expected:
- `getParticipants` is absent from `initial load`, `search keystrokes`, `clear search` and `next page`.
- `open participant picker` shows `getParticipants ×1`.

- [ ] **Step 5: Manual check (Review Focus 4)**

On meetings:
1. Open a row's participant picker. The current owner and helpers show.
2. Reassign the owner from the picker, then close it.
3. After the list refetches, the closed trigger shows the new owner.
4. Open "Manage participants" from the footer. The modal opens.

- [ ] **Step 6: Commit**

```bash
git add src/shared/entities/meetings/components/participant-picker/participant-picker.tsx \
  src/shared/entities/meetings/components/participant-picker/types.ts
git commit -m "perf(meetings): participant picker fetches only when opened

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: `DateTimePicker` sync and records-page fade

**Files:**
- Modify: `src/shared/components/date-time-picker.tsx:26-31`
- Modify: `src/shared/components/records-page-motion-shell.tsx:9-27`

**Interfaces:**
- The props of both components are unchanged.

- [ ] **Step 1: Sync the draft on the instant, not the `Date` object**

Replace lines 26–31 with:

```tsx
  // Rows build a new Date from the same ISO string every render; syncing on the instant skips those.
  const valueTime = value?.getTime()
  useEffect(() => {
    if (!openRef.current) {
      setDraft(valueTime === undefined ? undefined : new Date(valueTime))
    }
  }, [valueTime])
```

- [ ] **Step 2: Fade with no delay and no slide**

Replace the component and its doc comment with:

```tsx
/**
 * Outer motion wrapper for records-page routes. Sibling to `RecordsPageShell`
 * (which owns the inner Header/Toolbar/Table layout) — this only adds the
 * page-level fade and the full-height flex container that lets the shell's
 * table area scroll.
 */
export function RecordsPageMotionShell({ children }: { children: ReactNode }) {
  const isHydrating = useIsHydrating()
  return (
    <motion.div
      initial={isHydrating ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="w-full h-full flex flex-col overflow-hidden"
    >
      {children}
    </motion.div>
  )
}
```

- [ ] **Step 3: Type-check and lint**

Run: `pnpm tsc && pnpm lint`

Expected: clean, apart from the known error.

- [ ] **Step 4: Manual check**

Go to `/dashboard` and click Meetings in the sidebar. The page fades in quickly, with no pause and no upward slide.

Edit a meeting's scheduled date inline. The picker opens on the current value, and committing saves it.

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/date-time-picker.tsx src/shared/components/records-page-motion-shell.tsx
git commit -m "perf(records): pages fade in without a delay; date picker skips same-instant syncs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Acceptance

**Files:**
- Output (gitignored): `.superpowers/sdd/2026-10-01-records-render-isolation/after-{meetings,customers,proposals,projects}.txt` and `acceptance.md`

- [ ] **Step 1: Probe all four pages**

```bash
for page in meetings customers proposals projects; do
  node scripts/perf/records-probe.mjs /dashboard/$page < /dev/null | tee .superpowers/sdd/2026-10-01-records-render-isolation/after-$page.txt
done
```

- [ ] **Step 2: Check each acceptance line against the output**

Write `acceptance.md` as a table with one row per page and these columns, each showing the baseline value, then the after value, then pass or fail:

| Column | Pass condition |
|---|---|
| `modal open` row renders | 0 |
| `modal close` row renders | 0 |
| `expand row` row renders | exactly 1, on meetings only |
| `collapse row` row renders | exactly 1, on meetings only |
| `initial load` max renders per row | ≤ 2 |
| `getParticipants` on load, search and next page | 0 |
| `getParticipants` on picker open | 1 |
| `idle`, `hover sweep` and `scroll` commits | about 0 |
| warm navigation "fully shown" | at least 250ms below the baseline |

A failing line is a finding. Report it, with the probe block, to the orchestrator rather than tuning numbers.

- [ ] **Step 3: Full manual pass**

On each of meetings, customers, proposals and projects, plus the campaign-leads and lead-source customer sections, check:
- inline outcome, status and date edits
- the row actions menu, including a pending duplicate
- campaign-leads select-all and single selection
- column resize and freeze, including the scroll shadow
- the row expand panel, on meetings
- mobile row tap, in a DevTools device view

Record each as pass or fail in `acceptance.md`.

- [ ] **Step 4: Final checks**

Run: `pnpm tsc && pnpm lint`

Expected: clean, apart from the known `monthly-cost-chart.tsx(31)` error.

Run: `grep -rn "useModalStore()" src`

Expected: no output.

Run: `pnpm tsx scripts/verify-stable-callbacks.ts`

Expected: `✅ stable callbacks verified`
