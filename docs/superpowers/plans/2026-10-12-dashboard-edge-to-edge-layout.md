# Dashboard Edge-to-Edge Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a phone the dashboard uses the whole screen. Page-level horizontal scrollers run to the screen edge while more content waits on that side. Pages that scroll as a whole run behind the floating dock, which gets a soft canvas fade. Every page that opts into nothing renders exactly as today.

**Architecture:**

- **One set of insets.** `<main>` pads by CSS variables (`page-insets`) and publishes them as a bleed allowance.
- **Two utilities read the allowance.** `bleed-x` is for horizontal scrollers. `page-scroll` is for a page's vertical scroller. Each reaches into the insets and pads its content back.
- **Surfaces reset the allowance to 0,** so a scroller inside a card never bleeds.
- **DataTable and the schedule grid:** their rounded card moves inside a full-width scroller ("the card rides along").
- **The dock's geometry** becomes `:root` variables that every consumer reads.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS v4 (`@utility` in `src/app/(frontend)/globals.css`), React 19, Radix ScrollArea, Playwright 1.58 (probe only).

**Spec:** `docs/superpowers/specs/2026-10-12-dashboard-edge-to-edge-layout-design.md`. Read it first, especially §3.3 "Measured 2026-10-12".

## Global Constraints

- Phone insets: side gap `1rem` (16px); bottom `--dock-clear` = `max(1rem, env(safe-area-inset-bottom)) + 3.5rem + 1rem` (88px with no safe area). From `md` (48rem): top/right/bottom `var(--gutter)` (0.5rem), left `0px`.
- `@utility` names are exactly `page-insets`, `bleed-x`, `page-scroll`. Variables are exactly `--dock-h`, `--dock-baseline`, `--dock-clear`, `--page-t|r|b|l`, `--bleed-l|r|b`, `--bled-l|r`. Never `--edge-*`: that's an elevation knob.
- A `bleed-x` scroller must be a flex row, or end its content in a spacer of width `--bled-r` (WebKit drops a block scroller's inline-end padding).
- No `:has()` on `<main>` for this. `src/app/(frontend)/dashboard/layout.tsx` does not change (`app-shell.md#dashboard-layout-shape-fixed`). No layout-level scroll.
- `page-scroll` sets its own height. Never pair it with an `h-*` class on the same element.
- Comments say why, never what. No file banners, no plan/spec citations in code (`CLAUDE.md`).
- Verification is `pnpm tsc`, `pnpm lint` and the probe. **Never `pnpm build`.**
- **Commits:** stage and commit by explicit path only. The working tree has other sessions' uncommitted files; never `git add -A`, stash, checkout or reset. The pre-commit hook takes about 110 s, so give the commit a 180 s timeout.
- No DB writes for testing. Probe and screenshot whatever data the dev DB has.
- **Do not kill the dev server.** The dev server on :3000 belongs to the owner's main checkout. If a new utility class has no effect in the browser (stale dev CSS), STOP and tell the owner rather than killing the server or deleting `.next`.

## Review Focus

1. **A table, kanban board or schedule inside a card, sheet or modal must look exactly as today.** Examples: the lead-source detail pane, the customer profile modal. The surface reset (Task 2) and the probe's `lead-sources` group pin it.
2. **The menu sheet opening over the fade.** Canvas over the sheet's scrim would read as a light band. The fade hides while the sheet is open (Task 4). Pinned by a probe step that opens the menu.
3. **The meeting flow (`data-stage`) must stay edge to edge with no dock and no fade.** `page-insets` zeroes all insets there (Task 2), and the existing stage rule hides the whole dock slot, fade included. Pinned by the probe's `stage` group.
4. **A frozen first column or an expanded row panel while scrolled sideways.** Both must pin flush at the screen edge, not 16px in, with no table cells peeking through the gap. Pinned by the probe's `customers` group (frozen cell left = 0 mid-scroll), plus an expanded-row screenshot.
5. **Week navigation in the schedule.** "Today", next and previous weeks must land today's column clear of the right gap, and Sunday/Friday at the padded edges (scroll-padding). Pinned by the probe's `schedule-week` group (today column right ≤ 390 − 16).

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `scripts/perf/layout-probe.mjs` (new) | Read-only measurements of every rule below against the dev server, Chromium or Docker WebKit | 1 |
| `src/app/(frontend)/globals.css` | Dock vars on `:root`; `page-insets`, `bleed-x`, `page-scroll` utilities; surface reset; delete `mobile-bleed-right` | 2 |
| `src/features/agent-dashboard/constants/dashboard-main.ts` | `<main>` box = `page-insets` + layout classes | 2 |
| `src/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton.tsx` | Same insets as `<main>` | 2 |
| `src/features/agent-dashboard/constants/mobile-dock.ts` | Dock bottom + menu sheet geometry from the vars | 2 |
| `src/shared/domains/pwa/ui/pwa-install-prompt.tsx` | Clears the dock via the vars | 2 |
| `src/shared/components/kanban/ui/kanban-board.tsx` | Board is `bleed-x` | 2 |
| `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` | Drop `mobile-bleed-right`; root no longer clips sideways | 2 |
| Page scrollers (9 files, listed in Task 3) | Adopt `page-scroll` | 3 |
| `src/features/agent-dashboard/ui/components/mobile-dock.tsx` | Dock slot spans the clearance zone; canvas fade | 4 |
| `src/shared/components/data-table/ui/data-table.tsx`, `data-table-row.tsx`, `data-table-pagination.tsx`, `src/shared/components/records-page-frame.tsx` | Card rides along; pagination its own card | 5 |
| `src/features/schedule-management/constants/schedule-frame.ts` (new), `schedule-calendar.tsx`, `schedule-week-view.tsx`, `schedule-today-view.tsx`, `views/schedule-view.tsx`, `src/shared/components/calendar/ui/calendar-header.tsx` | Schedule header card + riding grids | 6 |
| `docs/codebase-conventions/app-shell.md` | New rule `page-insets-and-bleed`; fix stale `motion.main` | 7 |

---

### Task 1: The layout probe (the failing test)

**Files:**
- Create: `scripts/perf/layout-probe.mjs`

**Interfaces:**
- Produces: `node scripts/perf/layout-probe.mjs [--browser chromium|webkit] [--only group,…]`. Prints `PASS`/`FAIL` per check and exits 1 on any failure.
- Groups: `home analytics settings campaigns calculators project-new customers pipeline schedule-week schedule-today lead-sources menu stage`.
- Later tasks rely on these DOM hooks, which they add:
  - `[data-slot="table-frame"]` (Task 5)
  - `[data-slot="schedule-frame"]` (Task 6)
  - `[data-slot="dashboard-dock-fade"]` (Task 4)
  - class names containing `page-scroll` / `bleed-x` (Tasks 2–3)

- [ ] **Step 1: Write the probe**

Write `scripts/perf/layout-probe.mjs` (same sign-in pattern as `scripts/perf/page-probe.mjs`):

```js
// Read-only probe of the dashboard's edge-to-edge layout (page insets, bleed-x, page-scroll, the dock fade)
// against the running dev server, at a phone viewport. Headless browsers have no safe area, so the dock
// clearance is 16 + 56 + 16 = 88px. Exits 1 when any check fails.
//   node scripts/perf/layout-probe.mjs [--browser chromium|webkit] [--only group,group]
// WebKit needs system libraries this machine lacks; run it from the Playwright image instead:
//   docker run --rm --network host -v "$PWD":/repo:ro -w /repo mcr.microsoft.com/playwright:v1.58.2-noble \
//     node scripts/perf/layout-probe.mjs --browser webkit
import process from 'node:process'
import { chromium, webkit } from 'playwright'

process.loadEnvFile('.env.local')
const secret = process.env.DEV_LOGIN_SECRET
if (!secret) {
  console.error('DEV_LOGIN_SECRET is missing from .env.local')
  process.exit(1)
}
const BASE = `http://localhost:${process.env.PORT ?? 3000}`
const redact = text => String(text).replaceAll(encodeURIComponent(secret), '***').replaceAll(secret, '***')

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? undefined : args[i + 1]
}
const browserName = flag('--browser') ?? 'chromium'
const only = flag('--only')?.split(',')

const W = 390
const H = 844
const GAP = 16
const DOCK_CLEAR = 88
const TABLE_SCROLLER = '[class*="group/scroller"]'
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) <= 1

// Every ancestor between the element and <main> whose overflow on `axis` would clip a bleed.
async function clippers(page, selector, axis) {
  return page.evaluate(([selector, axis]) => {
    const el = document.querySelector(selector)
    const out = []
    for (let a = el?.parentElement; a && a.tagName !== 'MAIN'; a = a.parentElement) {
      const value = getComputedStyle(a)[axis === 'x' ? 'overflowX' : 'overflowY']
      if (value !== 'visible') {
        out.push(`${a.tagName.toLowerCase()}[${value}] ${String(a.className).slice(0, 70)}`)
      }
    }
    return out
  }, [selector, axis])
}

async function pageScrollChecks(page, selector = 'main [class*="page-scroll"]') {
  const m = await page.evaluate(([selector]) => {
    const el = document.querySelector(selector)
    if (!el) {
      return null
    }
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    el.scrollTop = el.scrollHeight
    const bottoms = [...el.children].map(c => c.getBoundingClientRect()).filter(b => b.height > 0).map(b => b.bottom)
    const out = { left: r.left, right: r.right, bottom: r.bottom, padL: Number.parseFloat(cs.paddingLeft), padB: Number.parseFloat(cs.paddingBottom), scrollable: el.scrollHeight > el.clientHeight + 1, lastBottom: Math.max(...bottoms) }
    el.scrollTop = 0
    return out
  }, [selector])
  if (!m) {
    return [['page-scroll element present', false, selector]]
  }
  const clip = await clippers(page, selector, 'y')
  return [
    ['page-scroll spans the screen width', near(m.left, 0) && near(m.right, W), `${m.left}..${m.right}`],
    ['page-scroll reaches the screen bottom', near(m.bottom, H), m.bottom],
    ['page-scroll pads the side gap', near(m.padL, GAP), m.padL],
    ['page-scroll pads the dock clearance', near(m.padB, DOCK_CLEAR), m.padB],
    ['no ancestor clips it vertically', clip.length === 0, clip.join(' | ')],
    ...(m.scrollable ? [['last item clears the dock at the scroll end', near(m.lastBottom, H - DOCK_CLEAR), m.lastBottom]] : []),
  ]
}

// `first`/`last` select the content's first and last box inside the scroller (default: its first/last child).
async function bleedXChecks(page, scroller, first, last) {
  const m = await page.evaluate(([s, f, l, W, GAP]) => {
    const el = document.querySelector(s)
    if (!el) {
      return null
    }
    const firstEl = f ? el.querySelector(f) : el.firstElementChild
    const lastEl = l ? el.querySelector(l) : el.lastElementChild
    if (!firstEl || !lastEl) {
      return { missing: f ?? l ?? 'first/last child' }
    }
    const firstBox = () => firstEl.getBoundingClientRect()
    const lastBox = () => lastEl.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    const previous = el.style.scrollBehavior
    el.style.scrollBehavior = 'auto'
    el.scrollLeft = 0
    const restLeft = firstBox().left
    const max = el.scrollWidth - el.clientWidth
    el.scrollLeft = Math.round(max / 2)
    const hit = document.elementFromPoint(W - 2, r.top + Math.min(r.height / 2, 120))
    const midEdgeIsContent = max > 2 * GAP ? el.contains(hit) : true
    el.scrollLeft = max
    const endRight = lastBox().right
    el.scrollLeft = 0
    el.style.scrollBehavior = previous
    return { left: r.left, right: r.right, bottom: r.bottom, restLeft, endRight, max, midEdgeIsContent }
  }, [scroller, first ?? null, last ?? null, W, GAP])
  if (!m) {
    return [['bleed-x scroller present', false, scroller]]
  }
  if (m.missing) {
    return [['bleed-x content present', false, m.missing]]
  }
  const clip = await clippers(page, scroller, 'x')
  return [
    ['scroller spans the screen width', near(m.left, 0) && near(m.right, W), `${m.left}..${m.right}`],
    ['content starts one gap in at rest', near(m.restLeft, GAP), m.restLeft],
    ['content ends one gap in at the scroll end', near(m.endRight, W - GAP), `${m.endRight} (max scroll ${m.max})`],
    ['content runs to the screen edge mid-scroll', m.midEdgeIsContent, `max scroll ${m.max}`],
    ['no ancestor clips it sideways', clip.length === 0, clip.join(' | ')],
  ]
}

async function bottomCheck(page, selector, name) {
  const bottom = await page.evaluate(s => document.querySelector(s)?.getBoundingClientRect().bottom ?? null, selector)
  return [[name, near(bottom, H - DOCK_CLEAR), bottom]]
}

async function fadeChecks(page) {
  const r = await page.evaluate(() => {
    const el = document.querySelector('[data-slot="dashboard-dock-fade"]')
    if (!el) {
      return null
    }
    const b = el.getBoundingClientRect()
    return { top: b.top, bottom: b.bottom, opacity: getComputedStyle(el).opacity }
  })
  return [
    ['dock fade spans the clearance zone', !!r && near(r.top, H - DOCK_CLEAR) && near(r.bottom, H), JSON.stringify(r)],
    ['dock fade is visible', r?.opacity === '1', r?.opacity],
  ]
}

const GROUPS = {
  'home': { path: '/dashboard', ready: '#meetings', run: async p => [...await pageScrollChecks(p), ...await fadeChecks(p)] },
  'analytics': { path: '/dashboard/analytics', ready: 'main [role="tablist"]', run: p => pageScrollChecks(p) },
  'settings': { path: '/dashboard/settings', ready: 'main h1', run: p => pageScrollChecks(p) },
  'campaigns': { path: '/dashboard/campaigns', ready: 'main [role="tabpanel"]', run: p => pageScrollChecks(p) },
  'calculators': { path: '/dashboard/calculators?tab=scope-pricing', ready: 'main [role="tabpanel"]', run: p => pageScrollChecks(p, 'main [role="tabpanel"][data-state="active"]') },
  'project-new': { path: '/dashboard/projects/new', ready: 'main form', run: p => pageScrollChecks(p) },
  'customers': {
    path: '/dashboard/customers',
    ready: `${TABLE_SCROLLER} tbody tr`,
    run: async (p) => {
      const out = [
        ...await bleedXChecks(p, TABLE_SCROLLER, '[data-slot="table-frame"]', '[data-slot="table-frame"]'),
        ...await bottomCheck(p, 'main nav[aria-label="Pagination"]', 'pagination ends where contained pages end'),
      ]
      const frozen = await p.evaluate(([s, GAP]) => {
        const el = document.querySelector(s)
        const cell = el.querySelector('tbody tr td:first-child')
        const max = el.scrollWidth - el.clientWidth
        if (max <= 2 * GAP || getComputedStyle(cell).position !== 'sticky') {
          return 'skip'
        }
        el.style.scrollBehavior = 'auto'
        el.scrollLeft = Math.round(max / 2)
        const left = cell.getBoundingClientRect().left
        el.scrollLeft = 0
        return left
      }, [TABLE_SCROLLER, GAP])
      if (frozen !== 'skip') {
        out.push(['frozen column pins flush at the screen edge', near(frozen, 0), frozen])
      }
      return out
    },
  },
  'pipeline': {
    path: '/dashboard/pipeline/fresh',
    ready: 'main [class*="bleed-x"] .min-w-70',
    run: async p => [
      ...await bleedXChecks(p, 'main [class*="bleed-x"]'),
      ...await bottomCheck(p, 'main [class*="bleed-x"]', 'board ends where contained pages end'),
    ],
  },
  'schedule-week': {
    path: '/dashboard/schedule',
    ready: '[data-slot="schedule-frame"]',
    run: async (p) => {
      const scroller = 'main [class*="bleed-x"]:has(> [data-slot="schedule-frame"])'
      const out = [
        ...await bleedXChecks(p, scroller, '[data-slot="schedule-frame"]', '[data-slot="schedule-frame"]'),
        ...await bottomCheck(p, '[data-slot="schedule-frame"]', 'week grid ends where contained pages end'),
      ]
      // The mount places today's column before the first paint; it must sit clear of the right gap.
      await p.reload({ waitUntil: 'networkidle' })
      await p.waitForSelector('[data-slot="schedule-frame"]')
      const todayRight = await p.evaluate(() => document.querySelector('[data-slot="schedule-frame"] [class*="bg-primary/5"]')?.getBoundingClientRect().right ?? 'none')
      if (todayRight !== 'none') {
        out.push(['today column lands clear of the right gap', todayRight <= W - GAP + 1, todayRight])
      }
      return out
    },
  },
  'schedule-today': {
    path: '/dashboard/schedule?s_v=today',
    ready: '[data-slot="schedule-frame"]',
    run: async (p) => {
      const hasGrid = await p.evaluate(() => !!document.querySelector('[data-radix-scroll-area-viewport] [data-slot="schedule-frame"]'))
      if (hasGrid) {
        return [
          ...await bleedXChecks(p, '[data-radix-scroll-area-viewport]', '[data-slot="schedule-frame"]', '[data-slot="schedule-frame"]'),
          ...await bottomCheck(p, '[data-radix-scroll-area-viewport]', 'today grid ends where contained pages end'),
        ]
      }
      const r = await p.evaluate(() => document.querySelector('[data-slot="schedule-frame"]').getBoundingClientRect().toJSON())
      return [['empty today frame sits inset', near(r.left, GAP) && near(r.right, W - GAP) && near(r.bottom, H - DOCK_CLEAR), JSON.stringify(r)]]
    },
  },
  'lead-sources': {
    path: '/dashboard/lead-sources',
    ready: 'main',
    run: async (p) => {
      const margin = await p.evaluate(s => {
        const el = document.querySelector(`main ${s}`)
        return el ? getComputedStyle(el).marginLeft : 'none'
      }, TABLE_SCROLLER)
      return margin === 'none'
        ? [['(no table on the default lead-sources view; check the Customers tab by hand)', true, '']]
        : [['a table inside a card does not bleed', margin === '0px', margin]]
    },
  },
  'menu': {
    path: '/dashboard',
    ready: '#meetings',
    run: async (p) => {
      await p.getByRole('button', { name: 'Open menu' }).click()
      await p.waitForTimeout(600)
      const opacity = await p.evaluate(() => {
        const el = document.querySelector('[data-slot="dashboard-dock-fade"]')
        return el ? getComputedStyle(el).opacity : 'none'
      })
      return [['dock fade hides while the menu sheet is open', opacity === '0', opacity]]
    },
  },
  'stage': {
    // A meeting that does not exist still renders inside the stage frame ("Meeting not found").
    path: '/dashboard/meetings/00000000-0000-0000-0000-000000000000',
    ready: '[data-stage]',
    run: async (p) => {
      const insets = await p.evaluate(() => {
        const main = document.querySelector('main')
        const cs = getComputedStyle(main)
        const nav = document.querySelector('[data-slot="dashboard-mobile-nav"]')
        return { pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft].join(' '), nav: nav ? getComputedStyle(nav).display : 'none' }
      })
      return [
        ['stage route keeps <main> unpadded', insets.pad === '0px 0px 0px 0px', insets.pad],
        ['stage route hides the dock and its fade', insets.nav === 'none', insets.nav],
      ]
    },
  },
}

const browserType = browserName === 'webkit' ? webkit : chromium
const browser = await browserType.launch()
const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: browserName !== 'webkit', hasTouch: true })
const page = await context.newPage()
let failed = 0
try {
  try {
    await page.goto(`${BASE}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent('/dashboard')}`, { timeout: 180000 })
  }
  catch (error) {
    throw new Error(redact(error.message))
  }
  for (const [name, group] of Object.entries(GROUPS)) {
    if (only && !only.includes(name)) {
      continue
    }
    await page.goto(BASE + group.path, { waitUntil: 'networkidle', timeout: 180000 })
    try {
      await page.waitForSelector(group.ready, { timeout: 60000 })
    }
    catch {
      console.log(`FAIL ${name}: never rendered ${group.ready}`)
      failed++
      continue
    }
    await page.waitForTimeout(800)
    for (const [check, ok, detail] of await group.run(page)) {
      console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${check}${ok ? '' : `  (${detail})`}`)
      if (!ok) {
        failed++
      }
    }
  }
}
finally {
  await browser.close()
}
console.log(failed ? `\n${failed} check(s) failed (${browserName})` : `\nall checks passed (${browserName})`)
process.exit(failed ? 1 : 0)
```

`isMobile` is a Chromium-only emulation flag. WebKit in the Docker image takes the viewport alone, which is all the probe needs.

- [ ] **Step 2: Run it to see it fail**

Run: `node scripts/perf/layout-probe.mjs`
Expected: exit 1. FAIL lines include `page-scroll element present` (home, analytics, settings, campaigns, calculators, project-new), `dock fade spans the clearance zone`, `never rendered [data-slot="schedule-frame"]`, `pipeline: never rendered main [class*="bleed-x"] .min-w-70`, and customers' `bleed-x content present`. `stage` and `lead-sources` should already PASS: they pin behaviour that must not change.

- [ ] **Step 3: Lint the probe**

Run: `pnpm lint scripts/perf/layout-probe.mjs`
Expected: no errors. Fix anything the repo's ESLint config flags (import order, brace style) and re-run.

- [ ] **Step 4: Commit**

```bash
git add scripts/perf/layout-probe.mjs
git commit -m "chore(dashboard): a layout probe for page insets, bleed and the dock zone" -- scripts/perf/layout-probe.mjs
```

---

### Task 2: Insets, utilities, dock vars, and the kanban board

**Files:**
- Modify: `src/app/(frontend)/globals.css` (`:root` near `--gutter` ~line 30; the utilities block ~lines 1154-1176)
- Modify: `src/features/agent-dashboard/constants/dashboard-main.ts`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton.tsx:11`
- Modify: `src/features/agent-dashboard/constants/mobile-dock.ts`
- Modify: `src/shared/domains/pwa/ui/pwa-install-prompt.tsx:84`
- Modify: `src/shared/components/kanban/ui/kanban-board.tsx:121`
- Modify: `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx:128,181`

**Interfaces:**
- Produces:
  - Utilities `page-insets`, `bleed-x`, `page-scroll` (Tasks 3, 5, 6 use them).
  - Variables `--dock-h`, `--dock-baseline`, `--dock-clear` on `:root` (Task 4).
  - `--bled-l` / `--bled-r` on every `bleed-x` element, inherited by its descendants (Tasks 5, 6).

- [ ] **Step 1: Dock vars on `:root`**

In `globals.css`, directly after `--gutter: 0.5rem;` (inside the same `:root` block), add:

```css
  /* The phone dock, 56px tall (MobileDockCapsule h-14), on the meeting flow's step-capsule baseline. */
  --dock-h: 3.5rem;
  --dock-baseline: max(1rem, env(safe-area-inset-bottom));
  /* Where content stops so it clears the dock: baseline, dock, 16px of air. */
  --dock-clear: calc(var(--dock-baseline) + var(--dock-h) + 1rem);
```

- [ ] **Step 2: Replace `mobile-bleed-right` with the three utilities and the surface reset**

Delete the `/* ── Mobile bleed-right ── … */` comment block, which sits above the `scrollbar-gutter` comment around lines 1154-1158. Delete the `@utility mobile-bleed-right { … }` block too. In place of the deleted utility, add:

```css
/* The dashboard <main> pads by these and publishes them as the bleed allowance: how far a scroller
   inside may reach back out to the screen edge. */
@utility page-insets {
  --page-t: 1rem;
  --page-r: 1rem;
  --page-b: var(--dock-clear);
  --page-l: 1rem;
  @media (width >= 48rem) {
    --page-t: var(--gutter);
    --page-r: var(--gutter);
    --page-b: var(--gutter);
    /* The floating rail's own right inset is the left gap. */
    --page-l: 0px;
  }
  /* A stage route (the meeting flow) draws edge to edge and supplies its own gutters. */
  &:has([data-stage]) {
    --page-t: 0px;
    --page-r: 0px;
    --page-b: 0px;
    --page-l: 0px;
  }
  padding: var(--page-t) var(--page-r) var(--page-b) var(--page-l);
  --bleed-l: var(--page-l);
  --bleed-r: var(--page-r);
  --bleed-b: var(--page-b);
}

/* A horizontal scroller on the page reaches into the side insets and pads its content back: the gap
   shows at rest and at the scroll end, and content runs to the screen edge while more waits that way.
   `--bled-*` records what it took, for the sticky pieces and cards inside. WebKit drops the inline-end
   padding of a block scroller, so the element must be a flex row or end its content in a spacer. */
@utility bleed-x {
  --bled-l: var(--bleed-l, 0px);
  --bled-r: var(--bleed-r, 0px);
  margin-inline: calc(-1 * var(--bled-l)) calc(-1 * var(--bled-r));
  padding-inline: var(--bled-l) var(--bled-r);
  scroll-padding-inline: var(--bled-l) var(--bled-r);
  /* On the children: declared on this element it would zero its own margin. */
  & > * {
    --bleed-l: 0px;
    --bleed-r: 0px;
  }
}

/* A page that scrolls as a whole reaches into the side and bottom insets and pads its content back,
   so it runs behind the phone dock and its last item still clears it. It takes its own height; as a
   flex-1 item its flex basis wins instead. Never pair it with an h-* class. */
@utility page-scroll {
  overflow-y: auto;
  overscroll-behavior-y: contain;
  height: calc(100% + var(--bleed-b, 0px));
  margin: 0 calc(-1 * var(--bleed-r, 0px)) calc(-1 * var(--bleed-b, 0px)) calc(-1 * var(--bleed-l, 0px));
  padding: 0 var(--bleed-r, 0px) var(--bleed-b, 0px) var(--bleed-l, 0px);
  scroll-padding-bottom: var(--bleed-b, 0px);
  & > * {
    --bleed-b: 0px;
  }
}

/* A surface draws its own edges, so nothing inside it bleeds to the page edge. `--bled-*` stays:
   a card riding inside a scroller still needs that scroller's edges. */
:is(.bg-card, .surface, .surface-beneath, .bg-popover, .surface-overlay) {
  --bleed-l: 0px;
  --bleed-r: 0px;
  --bleed-b: 0px;
}
```

- [ ] **Step 3: `<main>` uses the insets**

Replace the whole of `src/features/agent-dashboard/constants/dashboard-main.ts` with:

```ts
/**
 * The dashboard template's `<main>` box; the layout's loading state uses the same box so its content lines up.
 * `page-insets` pads it (16px sides and the dock's clearance on phones, the rail's gaps from md) and lets the
 * scrollers inside reach back out to the screen edge.
 */
export const DASHBOARD_MAIN_CLASS = 'page-insets relative min-h-0 min-w-0 flex-1 overflow-hidden'
```

- [ ] **Step 4: The generic skeleton uses the same insets**

In `dashboard-generic-content-skeleton.tsx:11`, change:

```tsx
      className="flex h-full min-w-0 flex-col px-4 pb-[calc(3.5rem+max(1rem,env(safe-area-inset-bottom))+1rem)] pt-4 md:pt-(--gutter) md:pr-(--gutter) md:pb-(--gutter) md:pl-0"
```

to:

```tsx
      className="page-insets flex h-full min-w-0 flex-col"
```

- [ ] **Step 5: Dock constants read the vars**

In `mobile-dock.ts`, change `MOBILE_DOCK_BOTTOM_CLASS` and `MOBILE_DOCK_SHEET_CLASS` to the following. The values are the same: 4rem = dock + 0.5rem, and 5rem = dock + 1.5rem.

```ts
export const MOBILE_DOCK_BOTTOM_CLASS = 'bottom-(--dock-baseline)'
```

```ts
export const MOBILE_DOCK_SHEET_CLASS = [
  'inset-x-3 bottom-[calc(var(--dock-baseline)+var(--dock-h)+0.5rem)]',
  'max-h-[min(78dvh,calc(100dvh-env(safe-area-inset-top)-var(--dock-baseline)-var(--dock-h)-1.5rem))]',
  '[--sheet-travel:calc(100%+var(--dock-baseline)+var(--dock-h)+1.5rem)]',
].join(' ')
```

Keep the existing comments above each constant.

- [ ] **Step 6: The install prompt clears the dock via the vars**

In `pwa-install-prompt.tsx:84`, replace `bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.5rem)]` with `bottom-[calc(var(--dock-baseline)+var(--dock-h)+1rem)]`. Leave the rest of the class string unchanged.

- [ ] **Step 7: The kanban board bleeds; the pipeline root stops clipping sideways**

In `kanban-board.tsx:121`:

```tsx
      <div className={cn('flex h-full gap-(--gutter) overflow-x-auto pb-2', className)}>
```

becomes

```tsx
      <div className={cn('bleed-x flex h-full gap-(--gutter) overflow-x-auto pb-2', className)}>
```

In `customer-pipeline-view.tsx`:
- Delete the prop line `className="mobile-bleed-right"` (around line 181).
- At line 128, change `"w-full h-full flex flex-col gap-(--gutter) overflow-hidden"` to `"w-full h-full flex flex-col gap-(--gutter) overflow-y-clip"`. Horizontal `overflow: hidden` here cut the board off 16px before the screen edge.

- [ ] **Step 8: Confirm nothing else used the removed names**

Run: `grep -rn "mobile-bleed-right\|3.5rem+max(1rem" src`
Expected: no output.

- [ ] **Step 9: Type-check, lint, probe**

Run: `pnpm tsc && pnpm lint`
Expected: both clean.

Run: `node scripts/perf/layout-probe.mjs --only pipeline,stage,lead-sources`
Expected: all PASS. If `scroller spans the screen width` fails with a left of 16, check in the browser whether `.bleed-x` has a computed `margin-left`. If it has none, the dev CSS is stale: STOP and tell the owner (Global Constraints).

Run: `node scripts/perf/layout-probe.mjs --only customers,home`
Expected: FAILs for the not-yet-built parts only. The table and home must render exactly as before: confirm that by eye with Step 10.

- [ ] **Step 10: Screenshot sanity**

Capture 390×844 and 1280×800 screenshots of `/dashboard`, `/dashboard/customers`, `/dashboard/pipeline/fresh` and `/dashboard/settings` with a local Playwright script; `page-probe.mjs` shows the sign-in pattern. Phone pages other than the pipeline must look identical to the baseline. The pipeline's columns now reach the right screen edge.

- [ ] **Step 11: Commit**

```bash
git add "src/app/(frontend)/globals.css" src/features/agent-dashboard/constants/dashboard-main.ts src/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton.tsx src/features/agent-dashboard/constants/mobile-dock.ts src/shared/domains/pwa/ui/pwa-install-prompt.tsx src/shared/components/kanban/ui/kanban-board.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx
git commit -m "feat(dashboard): page insets as variables, bleed-x and page-scroll; the pipeline board runs to the screen edge" -- "src/app/(frontend)/globals.css" src/features/agent-dashboard/constants/dashboard-main.ts src/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton.tsx src/features/agent-dashboard/constants/mobile-dock.ts src/shared/domains/pwa/ui/pwa-install-prompt.tsx src/shared/components/kanban/ui/kanban-board.tsx src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx
```

`globals.css` may hold another session's uncommitted hunks. Before committing, run `git diff "src/app/(frontend)/globals.css"`. If it shows hunks that aren't yours, STOP and ask the owner rather than committing them.

---

### Task 3: Pages that scroll as a whole adopt `page-scroll`

**Files:**
- Modify: `src/features/agent-dashboard/ui/views/dashboard-view.tsx:23-24`
- Modify: `src/features/agent-settings/ui/views/settings-view.tsx:29-30`
- Modify: `src/features/analytics/ui/views/analytics-view.tsx:35,52`
- Modify: `src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx:40`
- Modify: `src/features/campaigns-admin/ui/views/campaigns-setup-view.tsx:15`
- Modify: `src/features/campaigns-admin/ui/components/overview/campaigns-overview-skeleton.tsx:5`
- Modify: `src/features/calculators/ui/views/calculators-view.tsx:32`
- Modify: `src/features/project-management/ui/views/create-project-view.tsx:62`
- Modify: `src/features/project-management/ui/views/edit-project-view.tsx:157`

**Interfaces:**
- Consumes: the `page-scroll` utility (Task 2).

- [ ] **Step 1: Run the probe to see these fail**

Run: `node scripts/perf/layout-probe.mjs --only home,analytics,settings,campaigns,calculators,project-new`
Expected: each group FAILs `page-scroll element present`.

- [ ] **Step 2: Home (phone through lg)**

`dashboard-view.tsx:23-24`:

```tsx
    <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto lg:overflow-y-hidden">
      <div className="flex w-full flex-col gap-(--gutter) pb-16 lg:min-h-0 lg:flex-1 lg:pb-0">
```

becomes

```tsx
    <div className="flex flex-col overflow-x-hidden max-lg:page-scroll lg:h-full lg:overflow-y-hidden">
      <div className="flex w-full flex-col gap-(--gutter) lg:min-h-0 lg:flex-1">
```

In the file's top comment, change "on mobile the whole view scrolls as one page" to "on mobile the whole view scrolls as one page, behind the dock". Nothing else in the comment changes.

- [ ] **Step 3: Settings**

`settings-view.tsx:29-30`: `"h-full overflow-y-auto"` → `"page-scroll"`. The inner `"mx-auto flex max-w-4xl flex-col gap-(--gutter) pb-8"` → `"mx-auto flex max-w-4xl flex-col gap-(--gutter) md:pb-8"`. On phones `page-scroll` already clears the dock.

- [ ] **Step 4: Analytics**

`analytics-view.tsx:52`: `"-mr-2 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2 pb-0 scrollbar-gutter-stable"` → `"min-h-0 flex-1 page-scroll scrollbar-gutter-stable"`. On desktop, `page-scroll` reaches the same 8px (`--gutter`) that `-mr-2 pr-2` did.

Line 35's comment `// The template pads the page; this view owns the scroll so the controls stay put above the data.` becomes `// The controls stay put; the data below scrolls as the page, behind the phone dock.`

- [ ] **Step 5: Campaigns overview, setup, and the overview skeleton**

In all three files, replace `overflow-y-auto overscroll-contain scrollbar-gutter-stable pr-1` with `page-scroll scrollbar-gutter-stable` and keep the rest of each class string:
- overview: `"flex min-h-0 flex-1 flex-col gap-5 page-scroll scrollbar-gutter-stable"`
- setup: `"flex min-h-0 flex-1 flex-col gap-4 page-scroll scrollbar-gutter-stable"`
- skeleton: `"flex min-h-0 flex-1 flex-col gap-5 page-scroll scrollbar-gutter-stable"`

- [ ] **Step 6: Calculators' scope tab**

`calculators-view.tsx:32`: `"min-h-0 flex-1 overflow-y-auto data-[state=inactive]:hidden"` → `"min-h-0 flex-1 page-scroll data-[state=inactive]:hidden"`. Leave the remodel-roi `TabsContent` (line 29) alone: it's deferred per the spec. The sticky `QuoteTotal` (`sticky bottom-0`) sticks to the scroller's content box, which ends above the dock. The probe's screenshot step confirms it.

- [ ] **Step 7: Project new and edit (phone only; desktop keeps its own `pr-4`)**

`create-project-view.tsx:62`: `"h-full w-full overflow-auto pr-4"` → `"w-full max-md:page-scroll md:h-full md:overflow-auto md:pr-4"`.

`edit-project-view.tsx:157`: `"min-h-0 w-full grow pr-4 lg:flex lg:flex-col lg:overflow-hidden overflow-auto"` → `"min-h-0 w-full grow max-md:page-scroll md:overflow-auto md:pr-4 lg:flex lg:flex-col lg:overflow-hidden"`.

- [ ] **Step 8: Run the probe to see them pass**

Run: `node scripts/perf/layout-probe.mjs --only home,analytics,settings,campaigns,calculators,project-new`
Expected: every `page-scroll` check PASSes. The home group's fade checks still FAIL (Task 4). If `no ancestor clips it vertically` fails, the message names the ancestor; switch its `overflow-hidden` to `overflow-x-clip` (it only needs horizontal containment) and re-run.

- [ ] **Step 9: Type-check, lint, screenshots**

Run: `pnpm tsc && pnpm lint`. Expected: clean.

Capture 390×844 screenshots of the six routes, scrolled to the middle and to the end. Mid-scroll, content passes behind the dock. At the end, the last card sits about 16px above the dock top. Capture 1280×800 of `/dashboard` and `/dashboard/analytics`: identical to baseline apart from analytics' scrollbar sitting at the window edge, as before.

- [ ] **Step 10: Commit**

```bash
git add src/features/agent-dashboard/ui/views/dashboard-view.tsx src/features/agent-settings/ui/views/settings-view.tsx src/features/analytics/ui/views/analytics-view.tsx src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx src/features/campaigns-admin/ui/views/campaigns-setup-view.tsx src/features/campaigns-admin/ui/components/overview/campaigns-overview-skeleton.tsx src/features/calculators/ui/views/calculators-view.tsx src/features/project-management/ui/views/create-project-view.tsx src/features/project-management/ui/views/edit-project-view.tsx
git commit -m "feat(dashboard): pages that scroll as a whole run behind the phone dock" -- src/features/agent-dashboard/ui/views/dashboard-view.tsx src/features/agent-settings/ui/views/settings-view.tsx src/features/analytics/ui/views/analytics-view.tsx src/features/campaigns-admin/ui/views/campaigns-overview-view.tsx src/features/campaigns-admin/ui/views/campaigns-setup-view.tsx src/features/campaigns-admin/ui/components/overview/campaigns-overview-skeleton.tsx src/features/calculators/ui/views/calculators-view.tsx src/features/project-management/ui/views/create-project-view.tsx src/features/project-management/ui/views/edit-project-view.tsx
```

---

### Task 4: The dock zone and its canvas fade

**Files:**
- Modify: `src/features/agent-dashboard/ui/components/mobile-dock.tsx`

**Interfaces:**
- Consumes: `--dock-clear`, `--dock-baseline` (Task 2); `useSidebarOpenMobile` from `@/shared/components/ui/sidebar` (exists; `mobile-dock-menu-button.tsx` uses it).
- Produces: `[data-slot="dashboard-mobile-nav"]` is now the full clearance zone, with the fade child `[data-slot="dashboard-dock-fade"]` inside it. The stage rule in `globals.css` (`[data-slot='sidebar-inset']:has([data-stage]) [data-slot='dashboard-mobile-nav'] { display: none }`) keeps hiding all of it.

- [ ] **Step 1: Run the probe to see it fail**

Run: `node scripts/perf/layout-probe.mjs --only home,menu`
Expected: FAIL `dock fade spans the clearance zone` and `dock fade hides while the menu sheet is open`.

- [ ] **Step 2: Restructure the dock**

Replace the imports from `@/shared/components/ui/sidebar` with:

```tsx
import { useSidebar, useSidebarOpenMobile } from '@/shared/components/ui/sidebar'
```

Replace the component body from `const isTyping = useIsTyping()` to the end of the function with:

```tsx
  const isTyping = useIsTyping()
  const { setOpenMobile } = useSidebar()
  const isMenuOpen = useSidebarOpenMobile()

  return (
    // z-40: over page content (a data table's sticky columns reach z-30) and over the menu sheet
    // (z-35), which rises from behind it; under dialogs (z-50). The box is the dock's whole clearance
    // zone, so the fade ends exactly where a contained page's content does.
    <div
      data-slot="dashboard-mobile-nav"
      data-hidden={isTyping || undefined}
      inert={isTyping}
      className={cn(
        'pointer-events-none fixed inset-x-0 bottom-0 z-40 h-(--dock-clear) md:hidden',
        'transition-[translate,opacity] duration-200 ease-out motion-reduce:transition-none',
        'data-hidden:translate-y-[calc(100%+2rem)] data-hidden:opacity-0',
      )}
    >
      {/* Content scrolling behind the dock dissolves into the canvas instead of cutting against the capsule.
          Off while the menu sheet is up: canvas over the sheet's scrim would read as a light band. */}
      <div
        aria-hidden
        data-slot="dashboard-dock-fade"
        data-menu-open={isMenuOpen || undefined}
        className="absolute inset-0 bg-[linear-gradient(to_top,var(--background)_var(--dock-baseline),transparent)] transition-opacity duration-200 data-menu-open:opacity-0 motion-reduce:transition-none"
      />
      <div className={cn('pointer-events-auto absolute inset-x-3 flex items-center gap-2', MOBILE_DOCK_BOTTOM_CLASS)}>
        <MobileDockMenuButton />
        <MobileDockCapsule
          tabs={tabs}
          onActionCenterClick={() => {
            setOpenMobile(false)
            onActionCenterClick()
          }}
          className="min-w-0 flex-1"
        />
      </div>
    </div>
  )
}
```

The old `data-hidden:pointer-events-none` is no longer needed: the outer box is always `pointer-events-none`, and `inert` covers the dock row while typing.

- [ ] **Step 3: Run the probe to see it pass**

Run: `node scripts/perf/layout-probe.mjs --only home,menu,stage`
Expected: all PASS.

- [ ] **Step 4: Type-check, lint, screenshots in both schemes**

Run: `pnpm tsc && pnpm lint`. Expected: clean.

Capture 390×844 screenshots in light and dark (`colorScheme` on the context):
- `/dashboard` mid-scroll: content dissolves behind and beneath the dock; no hard edge.
- `/dashboard/customers`: the pagination bar ends exactly at the fade's top; nothing looks washed.
- `/dashboard` with the menu sheet open: no light band at the bottom.
- `/dashboard` while typing (focus a search input on `/dashboard/customers`): dock and fade slide away together.

- [ ] **Step 5: Commit**

```bash
git add src/features/agent-dashboard/ui/components/mobile-dock.tsx
git commit -m "feat(dashboard): a canvas fade under the phone dock; the dock slot spans its clearance zone" -- src/features/agent-dashboard/ui/components/mobile-dock.tsx
```

---

### Task 5: DataTable — the card rides along

**Files:**
- Modify: `src/shared/components/data-table/ui/data-table.tsx:284-298,322-326,429-433`
- Modify: `src/shared/components/data-table/ui/data-table-row.tsx:94,114-118`
- Modify: `src/shared/components/data-table/ui/data-table-pagination.tsx:24-39`
- Modify: `src/shared/components/records-page-frame.tsx`

**Interfaces:**
- Consumes: `bleed-x`, `--bled-l`, `--bled-r` (Task 2).
- Produces: `[data-slot="table-frame"]` (the riding card). The scroller keeps its `group/scroller` class and `scrollRef`. `usePullToRefresh` and `handleScroll` are unchanged.

- [ ] **Step 1: Run the probe to see it fail**

Run: `node scripts/perf/layout-probe.mjs --only customers`
Expected: FAIL `bleed-x content present` (no `[data-slot="table-frame"]` yet; the scroller already carries no `bleed-x` either).

- [ ] **Step 2: Restructure the DataTable return**

In `data-table.tsx`, replace the opening of the return. The current code runs from `<div className="flex flex-col h-full gap-4">` through the `<Table` opening tag:

```tsx
    <div className="flex flex-col h-full gap-4">
      <div className="grow min-h-0 flex flex-col rounded-xl border overflow-hidden surface">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className={cn(
            'group/scroller grow min-h-0 overflow-auto overscroll-none touch-pan-x touch-pan-y',
            // The pull spinner and expanded panels size to the visible width with `cqw`, without measuring it.
            // The size container is this scroller's full-width child, not the scroller: Chromium resolves a
            // scroller's own `cqw` with its vertical scrollbar included, so `100cqw` overflowed it sideways.
            '**:data-[slot=table-container]:overflow-visible *:data-[slot=table-container]:@container',
            isAnyColumnResizing && 'cursor-col-resize select-none',
          )}
        >
```

with:

```tsx
    <div className="flex h-full flex-col gap-(--gutter)">
      {/* On a page the scroller spans the screen and the card rides inside it, as wide as the table, so a
          card edge shows only where the table ends. Inside a surface the bleed is 0: an ordinary card. */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={cn(
          'bleed-x group/scroller grow min-h-0 overflow-auto overscroll-none touch-pan-x touch-pan-y',
          '**:data-[slot=table-container]:overflow-visible',
          isAnyColumnResizing && 'cursor-col-resize select-none',
        )}
      >
        {/* The pull spinner and expanded panels size to the visible width with `cqw`, without measuring it.
            The size container is this scroller's full-width child, not the scroller: Chromium resolves a
            scroller's own `cqw` with its vertical scrollbar included, so `100cqw` overflowed it sideways.
            The trailing spacer is the right gap at the scroll end: neither engine pads a grandchild's
            overflow with the scroller's padding. */}
        <div className="@container flex after:w-(--bled-r) after:flex-none after:content-['']">
          {/* `clip`, not `hidden`: it rounds the corners without becoming a scroller, so sticky cells
              still stick to the scroller above. */}
          <div data-slot="table-frame" className="surface w-max min-w-full flex-none overflow-clip rounded-xl border">
```

Then close the two new wrappers and drop the old frame. The current end of the return is:

```tsx
          </Table>
        </div>

        <DataTablePagination table={table} serverPagination={serverPagination} />
      </div>
    </div>
```

It becomes:

```tsx
            </Table>
          </div>
        </div>
      </div>

      <DataTablePagination table={table} serverPagination={serverPagination} />
    </div>
```

Re-indent the `<Table>…</Table>` block by two spaces so it nests under the new wrappers. `pnpm lint --fix` on the file handles it.

- [ ] **Step 3: The frozen header cell pins at the screen edge**

In `data-table.tsx` (the `isFirstCol && isFrozen && cn(` block, ~line 324):

```tsx
                            'sticky left-0 z-30 bg-(--card) border-r border-border',
```

becomes

```tsx
                            'sticky -left-(--bled-l) z-30 bg-(--card) border-r border-border',
```

- [ ] **Step 4: The frozen body cell and the expanded panel pin at the screen edge**

In `data-table-row.tsx:94`:

```tsx
                className={cn('sticky left-0 z-5 p-0 border-r border-border bg-inherit', FROZEN_COLUMN_SHADOW)}
```

becomes

```tsx
                className={cn('sticky -left-(--bled-l) z-5 p-0 border-r border-border bg-inherit', FROZEN_COLUMN_SHADOW)}
```

In `data-table-row.tsx:114-117`:

```tsx
            {/* Pinned to the visible width so the panel stays in view while the columns scroll sideways.
                Sticky breaks if this cell or any ancestor up to the scroller gets overflow: hidden. */}
            <div id={detailId} className="sticky left-0" style={{ width: '100cqw' }}>
```

becomes

```tsx
            {/* Pinned to the scroller's full width so the panel stays in view while the columns scroll
                sideways; the card's clip trims it to the card at rest and at the scroll end. Sticky breaks
                if this cell or any ancestor up to the scroller gets overflow: hidden (clip is fine). */}
            <div id={detailId} className="sticky -left-(--bled-l)" style={{ width: 'calc(100cqw + var(--bled-l) + var(--bled-r))' }}>
```

- [ ] **Step 5: Pagination is its own card**

In `data-table-pagination.tsx`:
- The comment sentence `The pagination sits inside a bordered card shell, so applying it here would double-pad on iOS.` becomes `The pagination is its own card below the table, inside the page's padding, so applying it here would double-pad on iOS.`
- The nav class `"grid shrink-0 grid-cols-3 items-stretch border-t border-border"` becomes `"surface grid shrink-0 grid-cols-3 items-stretch overflow-hidden rounded-xl border"`.

- [ ] **Step 6: RecordsPageFrame stops clipping sideways**

In `records-page-frame.tsx`, replace the stale comment and the class:

```tsx
// Clips vertically only: the table's scroller reaches out into the page's side insets.
export function RecordsPageFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col overflow-y-clip">
```

- [ ] **Step 7: Run the probe to see it pass**

Run: `node scripts/perf/layout-probe.mjs --only customers,lead-sources`
Expected: all PASS, including `frozen column pins flush at the screen edge` when the dev data makes the table wider than the phone. If a FAIL in `no ancestor clips it sideways` names another ancestor, change its `overflow-hidden` to `overflow-y-clip` and record the file in the commit message.

- [ ] **Step 8: Type-check, lint, screenshots**

Run: `pnpm tsc && pnpm lint`. Expected: clean.

Capture 390×844 screenshots of `/dashboard/customers`:
- at rest
- mid-scroll (frozen column flush left; the cells to its right run to the screen's right edge)
- scroll end (card's right border, 16px gap)
- a row expanded (`/dashboard/meetings` rows expand): the panel spans the screen while scrolled and sits inside the card at rest

Capture 1280×800 of `/dashboard/customers`: card inset, pagination its own card below.

Check `/dashboard/lead-sources` → Customers tab by hand: the table renders as before inside its pane.

- [ ] **Step 9: Commit**

```bash
git add src/shared/components/data-table/ui/data-table.tsx src/shared/components/data-table/ui/data-table-row.tsx src/shared/components/data-table/ui/data-table-pagination.tsx src/shared/components/records-page-frame.tsx
git commit -m "feat(data-table): the card rides inside an edge-to-edge scroller; pagination is its own card" -- src/shared/components/data-table/ui/data-table.tsx src/shared/components/data-table/ui/data-table-row.tsx src/shared/components/data-table/ui/data-table-pagination.tsx src/shared/components/records-page-frame.tsx
```

---

### Task 6: Schedule — header card and riding grids

**Files:**
- Create: `src/features/schedule-management/constants/schedule-frame.ts`
- Modify: `src/features/schedule-management/ui/components/schedule-calendar.tsx:45-73`
- Modify: `src/features/schedule-management/ui/components/schedule-week-view.tsx:60,88-89`
- Modify: `src/features/schedule-management/ui/components/schedule-today-view.tsx:94,101-103,112,148,183,188,218`
- Modify: `src/features/schedule-management/ui/views/schedule-view.tsx:26`
- Modify: `src/shared/components/calendar/ui/calendar-header.tsx:43`

**Interfaces:**
- Consumes: `bleed-x`, `--bleed-l`, `--bleed-r`, `--bled-l`, `--bled-r` (Task 2).
- Produces: `SCHEDULE_FRAME_CLASS` (string) and `[data-slot="schedule-frame"]` on the week grid, the today grid, the today empty state and the month view's card.

- [ ] **Step 1: Run the probe to see it fail**

Run: `node scripts/perf/layout-probe.mjs --only schedule-week,schedule-today`
Expected: FAIL `never rendered [data-slot="schedule-frame"]`.

- [ ] **Step 2: The frame constant**

Create `src/features/schedule-management/constants/schedule-frame.ts`:

```ts
// The schedule grid's card. `clip`, not `hidden`: it rounds the corners without becoming a scroller,
// so the sticky header row and agent column still stick to the scroller around it.
export const SCHEDULE_FRAME_CLASS = 'surface overflow-clip rounded-xl border'
```

- [ ] **Step 3: ScheduleCalendar splits the header into its own card**

In `schedule-calendar.tsx`, add the import (keep the import sorter's order; `pnpm lint --fix` settles it):

```tsx
import { SCHEDULE_FRAME_CLASS } from '@/features/schedule-management/constants/schedule-frame'
```

Add `import { cn } from '@/shared/lib/utils'` if the file does not import it yet.

Replace the return (the `// A surface of its own …` comment through the final `)`) with:

```tsx
  return (
    <div className="flex h-full w-full flex-col gap-(--gutter)">
      {/* A card of its own, so the grid below can run to the screen edge while the date controls stay put. */}
      <div className="surface rounded-xl border">
        <CalendarHeader
          currentDate={currentDate}
          activeView={view}
          onDateChange={handleDateChange}
          rightSlot={controlsRight}
        />
      </div>

      <div className="w-full min-h-0 flex-1">
        {view === 'today' && (
          <ScheduleTodayView events={visibleEvents} currentDate={currentDate} isPending={isPending} renderCard={renderCard} />
        )}
        {view === 'week' && (
          <ScheduleWeekView events={visibleEvents} currentDate={currentDate} hiddenDays={hiddenDays} isPending={isPending} renderCard={renderCard} />
        )}
        {view === 'month' && (
          <div data-slot="schedule-frame" className={cn(SCHEDULE_FRAME_CLASS, 'h-full')}>
            <CalendarMonthView events={visibleEvents} currentDate={currentDate} isPending={isPending} renderCompact={renderCompact} />
          </div>
        )}
      </div>
    </div>
  )
```

- [ ] **Step 4: CalendarHeader drops its bottom border**

In `calendar-header.tsx:43`, change `"flex items-center justify-between gap-2 border-b px-3 py-2"` to `"flex items-center justify-between gap-2 px-3 py-2"`. Its only consumer is `ScheduleCalendar`, where it is now a card of its own.

- [ ] **Step 5: ScheduleView stops clipping sideways**

`schedule-view.tsx:26`: `"w-full h-full flex flex-col overflow-hidden"` → `"w-full h-full flex flex-col overflow-y-clip"`.

- [ ] **Step 6: The week grid rides along**

In `schedule-week-view.tsx`, add the imports:

```tsx
import { SCHEDULE_FRAME_CLASS } from '@/features/schedule-management/constants/schedule-frame'
```

(`cn` is already imported; it's used at line 98.)

Lines 88-89:

```tsx
    <div ref={scrollRef} className="h-full overflow-x-auto" aria-busy={isPending || undefined}>
      <div className="flex h-full flex-col" style={{ minWidth: `${gridMinWidth}px` }}>
```

become

```tsx
    // A flex row, so WebKit keeps the right gap at the scroll end.
    <div ref={scrollRef} className="bleed-x flex h-full overflow-x-auto" aria-busy={isPending || undefined}>
      <div data-slot="schedule-frame" className={cn(SCHEDULE_FRAME_CLASS, 'flex h-full w-full flex-none flex-col')} style={{ minWidth: `${gridMinWidth}px` }}>
```

The mount's placement maths (line 60) aligns today's right edge to the scroller's edge. The right gap is now inside that edge, so subtract it:

```ts
        const overflow = todayCol.getBoundingClientRect().right - scroller.getBoundingClientRect().left - scroller.clientWidth
```

becomes

```ts
        const overflow = todayCol.getBoundingClientRect().right - scroller.getBoundingClientRect().left - scroller.clientWidth
          + Number.parseFloat(getComputedStyle(scroller).paddingRight)
```

The `scrollIntoView` calls already honour `scroll-padding-inline`, which `bleed-x` sets.

- [ ] **Step 7: The today grid rides along**

In `schedule-today-view.tsx`, add `import { SCHEDULE_FRAME_CLASS } from '@/features/schedule-management/constants/schedule-frame'`.

The empty state (line 94) `"flex h-full items-center justify-center"` becomes:

```tsx
      <div data-slot="schedule-frame" className={cn(SCHEDULE_FRAME_CLASS, 'flex h-full items-center justify-center')}>
```

Lines 101-103:

```tsx
    <ScrollAreaPrimitive.Root className="relative h-full" type="always" aria-busy={isPending || undefined}>
      <ScrollAreaPrimitive.Viewport ref={viewportRef} className="size-full rounded-[inherit]">
        <div className="flex min-h-full flex-col" style={{ minWidth: `${gridMinWidth}px` }}>
```

become

```tsx
    // Radix splits the scroller in two, so `bleed-x` is spelled out: the root reaches into the side
    // insets, and the viewport (the element that scrolls) pads the left. The right gap is the spacer:
    // WebKit drops a block scroller's end padding, and Chromium would add it on top of the spacer.
    <ScrollAreaPrimitive.Root
      className="relative h-full [--bled-l:var(--bleed-l,0px)] [--bled-r:var(--bleed-r,0px)] -ml-(--bled-l) -mr-(--bled-r)"
      type="always"
      aria-busy={isPending || undefined}
    >
      <ScrollAreaPrimitive.Viewport ref={viewportRef} className="size-full rounded-[inherit] pl-(--bled-l) scroll-pl-(--bled-l) scroll-pr-(--bled-r)">
        <div className="flex min-h-full after:w-(--bled-r) after:flex-none after:content-['']">
          <div data-slot="schedule-frame" className={cn(SCHEDULE_FRAME_CLASS, 'flex min-h-full flex-1 flex-col')} style={{ minWidth: `${gridMinWidth}px` }}>
```

Close the extra wrapper. Before line 189 (`</ScrollAreaPrimitive.Viewport>`), the current

```tsx
        </div>
      </ScrollAreaPrimitive.Viewport>
```

becomes

```tsx
          </div>
        </div>
      </ScrollAreaPrimitive.Viewport>
```

Re-indent the moved block (`pnpm lint --fix`).

Pin the four sticky-left cells at the screen edge. In each of lines 112, 148, 183 and 218, replace `sticky left-0` with `sticky -left-(--bled-l)`. Change nothing else on those lines.

- [ ] **Step 8: Run the probe to see it pass**

Run: `node scripts/perf/layout-probe.mjs --only schedule-week,schedule-today`
Expected: all PASS. With no meetings today, `schedule-today` takes the empty-frame branch.

- [ ] **Step 9: Type-check, lint, screenshots**

Run: `pnpm tsc && pnpm lint`. Expected: clean.

Capture 390×844 screenshots:
- `/dashboard/schedule` at rest and at the scroll end
- after pressing next week and previous week (Sunday lands at the left gap, Friday at the right gap)
- `/dashboard/schedule?s_v=today`
- `/dashboard/schedule?s_v=month` (an inset card)

Capture 1280×800 of the week view: header card above, grid card below, both inset.

- [ ] **Step 10: Commit**

```bash
git add src/features/schedule-management/constants/schedule-frame.ts src/features/schedule-management/ui/components/schedule-calendar.tsx src/features/schedule-management/ui/components/schedule-week-view.tsx src/features/schedule-management/ui/components/schedule-today-view.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/shared/components/calendar/ui/calendar-header.tsx
git commit -m "feat(schedule): date controls in their own card; the week and today grids ride an edge-to-edge scroller" -- src/features/schedule-management/constants/schedule-frame.ts src/features/schedule-management/ui/components/schedule-calendar.tsx src/features/schedule-management/ui/components/schedule-week-view.tsx src/features/schedule-management/ui/components/schedule-today-view.tsx src/features/schedule-management/ui/views/schedule-view.tsx src/shared/components/calendar/ui/calendar-header.tsx
```

---

### Task 7: The convention, the full verification, the owner gate

**Files:**
- Modify: `docs/codebase-conventions/app-shell.md` (the `stage-routes-opt-out-with-data-stage` section ~lines 119-129; add a rule after `pages-own-their-scroll`)

- [ ] **Step 1: Fix the stale stage rule**

In `app-shell.md`'s `stage-routes-opt-out-with-data-stage` section, replace the bullet:

```
- `src/app/(frontend)/dashboard/template.tsx` — `motion.main` carries `has-data-stage:p-0`, so the template's page padding disappears only while a stage is inside it.
```

with:

```
- `src/app/(frontend)/globals.css` — `page-insets` (the template `<main>`'s class) sets every inset to 0 while a stage is inside it, so the page padding and every bleed disappear.
```

- [ ] **Step 2: Add the rule `page-insets-and-bleed`**

Insert after the `pages-own-their-scroll` section:

```markdown
### page-insets-and-bleed

The template `<main>` pads by `page-insets`: 16px sides and the dock's clearance (`--dock-clear`) on phones, the rail's gaps from `md`. It publishes those insets as a bleed allowance (`--bleed-l|r|b`). Two utilities spend it:

- **`page-scroll`** — put it on the scroller of a page that scrolls as a whole. It reaches into the side and bottom insets and pads its content back, so the page runs behind the phone dock and its last item still clears it. It sets its own height; never pair it with `h-*`.
- **`bleed-x`** — on a horizontal scroller that sits on the page. The gap shows at rest and at the scroll end; content runs to the screen edge while more waits that way. `KanbanBoard`, `DataTable` and the schedule grids apply it themselves, so a page that uses them gets it free.

Rules:
- Every surface (`.surface`, `.bg-card`, popovers, overlays) resets the allowance to 0, so nothing inside a card bleeds.
- A non-surface ancestor between `<main>` and a bleeding element must not clip that axis. Use `overflow-y-clip` where a page root needs vertical containment.
- A `bleed-x` scroller must be a flex row, or end its content in a spacer of width `--bled-r`. WebKit drops a block scroller's inline-end padding.
- Sticky pieces inside a bleeding scroller pin at `-left-(--bled-l)`, the screen edge. Sticky offsets resolve against the scroller's content box.
- A page that uses neither utility renders as before.

**Why**: the phone dashboard wasted the screen's sides and everything behind the dock. Bleeding is local, so `<main>` never learns what its page is, and the layout shape stays fixed.
**Reference impl**: `src/app/(frontend)/globals.css` (`page-insets`, `bleed-x`, `page-scroll`), `src/shared/components/data-table/ui/data-table.tsx`, `src/features/agent-dashboard/ui/views/dashboard-view.tsx`
**Verified by**: `node scripts/perf/layout-probe.mjs` (Chromium; WebKit via the Playwright Docker image, see the script's header)
```

- [ ] **Step 3: Full probe, both engines**

Run: `node scripts/perf/layout-probe.mjs`
Expected: `all checks passed (chromium)`.

Run: `docker run --rm --network host -v "$PWD":/repo:ro -w /repo mcr.microsoft.com/playwright:v1.58.2-noble node scripts/perf/layout-probe.mjs --browser webkit`
Expected: `all checks passed (webkit)`. A WebKit-only FAIL on `content ends one gap in at the scroll end` means a `bleed-x` scroller isn't a flex row. Fix it per the convention and re-run both engines.

- [ ] **Step 4: Final checks**

Run: `pnpm tsc && pnpm lint`. Expected: clean.

Run: `grep -rn "mobile-bleed-right\|has-data-stage:p-0\|3.5rem+max(1rem" src docs/codebase-conventions`
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add docs/codebase-conventions/app-shell.md
git commit -m "docs(app-shell): page insets and bleed; the stage opt-out lives in page-insets" -- docs/codebase-conventions/app-shell.md
```

- [ ] **Step 6: Owner gate (stop here)**

Report to the owner, with the commit range, a table of the screenshots taken, and the probe output from both engines. Ask them to check on their phone, in the installed app:

- home and analytics: scroll behind the dock
- customers end to end: rest, mid-scroll, end, one row expanded
- the pipeline
- the schedule week view, with next and previous weeks

Open follow-ups to list for them: the remodel ROI story canvas (deferred), and the schedule month view and lead-sources analytics tab, which have no scroller and clip tall content. Do not delete the spec or the plan until the owner says it ships.
