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
function flag(name) {
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
    el.scrollTo({ top: el.scrollHeight, behavior: 'instant' })
    const bottoms = [...el.children].map(c => c.getBoundingClientRect()).filter(b => b.height > 0).map(b => b.bottom)
    const out = { left: r.left, right: r.right, bottom: r.bottom, padL: Number.parseFloat(cs.paddingLeft), padB: Number.parseFloat(cs.paddingBottom), scrollable: el.scrollHeight > el.clientHeight + 1, lastBottom: Math.max(...bottoms) }
    el.scrollTo({ top: 0, behavior: 'instant' })
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
    // elementsFromPoint, not elementFromPoint: a Radix scroll area's overlay scrollbar sits above the content at the edge.
    const hits = document.elementsFromPoint(W - 2, r.top + Math.min(r.height / 2, 120))
    const midEdgeIsContent = max > 2 * GAP ? hits.some(h => el.contains(h)) : true
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
  'calculators': { path: '/dashboard/calculators?tab=scope-pricing', ready: 'main [role="tabpanel"][data-state="active"]', run: p => pageScrollChecks(p, 'main [role="tabpanel"][data-state="active"]') },
  'project-new': { path: '/dashboard/projects/new', ready: 'main form', run: p => pageScrollChecks(p) },
  'customers': {
    path: '/dashboard/customers',
    ready: `${TABLE_SCROLLER} tbody tr[data-slot="table-row"]`,
    run: async (p) => {
      const out = [
        ...await bleedXChecks(p, TABLE_SCROLLER, '[data-slot="table-frame"]', '[data-slot="table-frame"]'),
        ...await bottomCheck(p, 'main nav[aria-label="Pagination"]', 'pagination ends where contained pages end'),
      ]
      const frozen = await p.evaluate(([s, GAP]) => {
        const el = document.querySelector(s)
        const cell = el.querySelector('tbody tr[data-slot="table-row"] td:first-child')
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
      const margin = await p.evaluate((s) => {
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
    try {
      for (const [check, ok, detail] of await group.run(page)) {
        console.log(`${ok ? 'PASS' : 'FAIL'} ${name}: ${check}${ok ? '' : `  (${detail})`}`)
        if (!ok) {
          failed++
        }
      }
    }
    catch (error) {
      console.log(`FAIL ${name}: threw ${redact(error.message).split('\n')[0]}`)
      failed++
    }
  }
}
finally {
  await browser.close()
}
console.log(failed ? `\n${failed} check(s) failed (${browserName})` : `\nall checks passed (${browserName})`)
process.exit(failed ? 1 : 0)
