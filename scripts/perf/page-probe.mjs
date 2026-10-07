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

const PAGES = {
  'meetings': { path: '/dashboard/meetings', link: '/dashboard/meetings', item: 'tbody tr[data-meeting-row]', htmlMarker: 'data-meeting-row', cardNames: ['TableRow'] },
  'pipeline-fresh': { path: '/dashboard/pipeline/fresh', link: '/dashboard/pipeline/fresh', item: '.min-w-70 [data-slot="card"]', htmlMarker: 'cursor-grab', cardNames: ['CustomerKanbanCardImpl'] },
  'pipeline-leads': { path: '/dashboard/pipeline/leads', link: null, item: '.min-w-70 [data-slot="card"]', htmlMarker: 'cursor-grab', cardNames: ['CustomerKanbanCardImpl'] },
  'pipeline-rehash': { path: '/dashboard/pipeline/rehash', link: null, item: '.min-w-70 [data-slot="card"]', htmlMarker: 'cursor-grab', cardNames: ['CustomerKanbanCardImpl'] },
  'pipeline-projects': { path: '/dashboard/pipeline/projects', link: null, item: '.min-w-70 [data-slot="card"]', htmlMarker: 'cursor-grab', cardNames: ['CustomerKanbanCardImpl'] },
  'schedule': { path: '/dashboard/schedule?s_d=2026-08-24', link: '/dashboard/schedule', item: '.group.relative.rounded-md.border.bg-card', htmlMarker: 'aria-label="Participants', cardNames: ['MeetingCard'] },
}

const key = process.argv[2]
const target = PAGES[key]
if (!target) {
  console.error(`Usage: node scripts/perf/page-probe.mjs <${Object.keys(PAGES).join('|')}> [runs]`)
  process.exit(1)
}
const RUNS = Number(process.argv[3] ?? 3)
const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
const sum = values => values.reduce((total, value) => total + value, 0)
const max = values => Math.max(0, ...values)

function installProbe(cardNames) {
  window.__probe = { commits: [], longTasks: [], components: {}, cards: {} }
  window.__errors = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__probe.longTasks.push(Math.round(entry.duration))
    }
  }).observe({ type: 'longtask', buffered: true })

  const seen = new WeakMap()
  let commitIndex = 0
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
      commitIndex++
      lastRoot = root
      const probe = window.__probe
      probe.commits.push(Math.round(root.current.actualDuration ?? 0))
      const stack = [root.current.child]
      while (stack.length > 0) {
        const fiber = stack.pop()
        if (!fiber) {
          continue
        }
        const type = fiber.type?.type ?? fiber.type
        if (typeof type === 'function') {
          const mine = seen.get(fiber)
          const theirs = fiber.alternate ? seen.get(fiber.alternate) : undefined
          const last = !mine ? theirs : !theirs ? mine : (mine.at > theirs.at ? mine : theirs)
          const rendered = !last || last.props !== fiber.memoizedProps || last.state !== fiber.memoizedState
          seen.set(fiber, { props: fiber.memoizedProps, state: fiber.memoizedState, at: commitIndex })
          if (rendered) {
            const name = type.displayName || type.name || 'anon'
            probe.components[name] = (probe.components[name] ?? 0) + 1
            if (cardNames.includes(name)) {
              const id = fiber.memoizedProps?.item?.id ?? fiber.memoizedProps?.event?.id ?? fiber.key ?? fiber.return?.key ?? '?'
              probe.cards[id] = (probe.cards[id] ?? 0) + 1
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

  // What is mounted right now: component instances, TanStack observers held in hook state, DOM size.
  window.__census = () => {
    const counts = {}
    let mutationObservers = 0
    let queryObservers = 0
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
          const ctor = value?.constructor?.name
          if (ctor === 'MutationObserver' && typeof value.mutate === 'function') {
            mutationObservers++
          }
          else if ((ctor === 'QueryObserver' || ctor === 'QueriesObserver') && typeof value.getCurrentResult === 'function') {
            queryObservers++
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
    return { fibers, mutationObservers, queryObservers, counts, dom: document.querySelectorAll('*').length }
  }

  // First frame at which each stage is on screen, in ms since `__timelineStart()` (or since navigation start).
  window.__timeline = null
  window.__timelineStart = (itemSelector) => {
    const t0 = performance.now()
    const marks = { t0 }
    const fullyShown = (el) => {
      for (let node = el; node; node = node.parentElement) {
        const style = getComputedStyle(node)
        if (Number.parseFloat(style.opacity) < 0.99) {
          return false
        }
        if (style.transform !== 'none' && style.transform !== 'matrix(1, 0, 0, 1, 0, 0)') {
          return false
        }
      }
      return true
    }
    const visible = el => !!el && el.getClientRects().length > 0
    const tick = () => {
      const now = Math.round(performance.now() - t0)
      const pending = document.querySelector('[data-slot="data-view-pending"], [data-slot="dashboard-content-skeleton"]')
      const generic = document.querySelector('[data-slot="dashboard-content-skeleton"]:not(:has([data-slot="data-view-pending"]))')
      const search = document.querySelector('input[placeholder^="Search by"]')
      const item = document.querySelector(itemSelector)
      const busy = document.querySelector('[aria-busy="true"]')
      if (marks.pendingShell == null && pending) {
        marks.pendingShell = now
      }
      if (marks.genericSkeleton == null && generic) {
        marks.genericSkeleton = now
      }
      if (marks.toolbar == null && visible(search)) {
        marks.toolbar = now
      }
      if (marks.toolbarShown == null && visible(search) && fullyShown(search)) {
        marks.toolbarShown = now
      }
      if (marks.items == null && item) {
        marks.items = now
      }
      if (marks.itemsShown == null && item && fullyShown(item)) {
        marks.itemsShown = now
      }
      if (marks.hydrated == null && item && Object.keys(item).some(name => name.startsWith('__reactFiber'))) {
        marks.hydrated = now
      }
      if (marks.settledEmpty == null && visible(search) && !busy && !pending && fullyShown(search)) {
        marks.settledEmpty = now
      }
      window.__timeline = marks
      if ((marks.itemsShown == null || marks.hydrated == null) && now < 90000) {
        requestAnimationFrame(tick)
      }
    }
    requestAnimationFrame(tick)
  }
}

const browser = await chromium.launch()
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } })
const page = await context.newPage()
await page.addInitScript(installProbe, target.cardNames)

const consoleIssues = []
page.on('console', (message) => {
  const text = message.text()
  if (message.type() === 'error' || /hydrat|did not match|didn't match/i.test(text)) {
    consoleIssues.push(redact(text).split('\n')[0].slice(0, 220))
  }
})
page.on('pageerror', error => consoleIssues.push(`pageerror: ${redact(error.message).split('\n')[0].slice(0, 220)}`))

const requests = []
page.on('request', (request) => {
  const url = request.url()
  if (url.includes('/api/trpc/')) {
    requests.push(...decodeURIComponent(url.split('/api/trpc/')[1].split('?')[0]).split(','))
  }
})

async function take(label) {
  const snapshot = await page.evaluate(() => {
    const probe = window.__probe
    window.__probe = { commits: [], longTasks: [], components: {}, cards: {} }
    return probe
  })
  const cardCounts = Object.values(snapshot.cards)
  const procedures = Object.entries(Object.groupBy(requests.splice(0), name => name)).map(([name, calls]) => `${name} ×${calls.length}`)
  const top = Object.entries(snapshot.components).sort((a, b) => b[1] - a[1]).slice(0, 10)
  console.log(`\n=== ${label} ===`)
  console.log(`commits ${snapshot.commits.length} · render ${sum(snapshot.commits)}ms (max ${max(snapshot.commits)}ms) · long tasks ${snapshot.longTasks.length} (sum ${sum(snapshot.longTasks)}ms, max ${max(snapshot.longTasks)}ms)`)
  console.log(`cards rendered ${cardCounts.length} · card renders ${sum(cardCounts)} (max ${max(cardCounts)} per card)`)
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
    console.log(`\n=== ${label} === failed: ${redact(error.message).split('\n')[0]}`)
    await take(`${label} (after failure)`)
  }
}

async function waitTimeline(field, timeout = 60000) {
  await page.waitForFunction(name => window.__timeline?.[name] != null, field, { timeout, polling: 50 })
  return page.evaluate(() => window.__timeline)
}

try {
  await signIn(page, target.path)
  await page.waitForSelector(target.item, { timeout: 180000 })
  await page.waitForTimeout(2000)
  await page.goto(`${BASE}/dashboard`, { timeout: 120000 })
  await page.waitForTimeout(3000)

  // 1 ─ What the server sends: is the data in the HTML, and how long does the document take?
  const htmlRuns = []
  for (let run = 0; run < RUNS; run++) {
    const started = Date.now()
    const response = await context.request.get(`${BASE}${target.path}`, { timeout: 120000 })
    const headersAt = Date.now() - started
    const body = await response.text()
    htmlRuns.push({ headersAt, total: Date.now() - started, bytes: body.length, items: body.split(target.htmlMarker).length - 1, pendingMarker: body.includes('data-view-pending') })
  }
  console.log(`\n### ${key} — ${target.path}`)
  console.log(`server HTML: total ${median(htmlRuns.map(r => r.total))}ms (median of ${RUNS}) · ${Math.round(median(htmlRuns.map(r => r.bytes)) / 1024)} KB · items in HTML ${htmlRuns[0].items} · pending marker in HTML ${htmlRuns[0].pendingMarker}`)

  // 2 ─ Document load (refresh / PWA launch / deep link).
  const docRuns = []
  for (let run = 0; run < RUNS; run++) {
    consoleIssues.length = 0
    await page.goto('about:blank')
    await page.goto(`${BASE}${target.path}`, { timeout: 120000, waitUntil: 'commit' })
    await page.evaluate(selector => window.__timelineStart(selector), target.item)
    await waitTimeline('itemsShown')
    const marks = await waitTimeline('hydrated', 90000)
    const paint = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0]
      return { fcp: fcp ? Math.round(fcp.startTime) : null, t0: Math.round(window.__timeline.t0) }
    })
    await page.waitForTimeout(2500)
    const longTasks = await page.evaluate(() => window.__probe.longTasks)
    docRuns.push({ ...marks, fcp: paint.fcp, offset: paint.t0, longTaskSum: sum(longTasks), longTaskMax: max(longTasks), hydrationIssues: consoleIssues.filter(text => /hydrat|match/i.test(text)).length, issues: [...consoleIssues] })
    await take(`(doc load ${run + 1} render totals)`)
  }
  const docValues = field => docRuns.map(r => (r[field] ?? Number.NaN) + (['fcp', 'longTaskSum', 'longTaskMax', 'hydrationIssues'].includes(field) ? 0 : r.offset))
  const doc = field => `${median(docValues(field))} (min ${Math.min(...docValues(field))})`
  console.log(`\n>>> DOCUMENT LOAD (median (min) of ${RUNS}, ms since navigation): FCP ${doc('fcp')} · pending shell ${doc('pendingShell')} · generic skeleton ${doc('genericSkeleton')} · toolbar ${doc('toolbar')} · items in DOM ${doc('items')} · items fully shown ${doc('itemsShown')} · items interactive (hydrated) ${doc('hydrated')} · long tasks ${doc('longTaskSum')}ms, longest ${doc('longTaskMax')}ms · hydration warnings ${docRuns.map(r => r.hydrationIssues).join('/')}`)
  const issues = [...new Set(docRuns.flatMap(r => r.issues))]
  if (issues.length > 0) {
    console.log(`console issues:\n  ${issues.slice(0, 6).join('\n  ')}`)
  }

  // 3 ─ Sidebar click from the dashboard home (soft navigation).
  if (target.link) {
    const softRuns = []
    for (let run = 0; run < RUNS; run++) {
      await page.goto(`${BASE}/dashboard`, { timeout: 120000 })
      await page.waitForTimeout(3500)
      await take('(discarded)')
      const link = page.locator(`a[href="${target.link}"]`).first()
      const softItem = key === 'schedule' ? '[class*="min-h-48"], .group.relative.rounded-md.border.bg-card' : target.item
      await page.evaluate(selector => window.__timelineStart(selector), softItem)
      await link.click({ timeout: 10000 })
      const marks = await waitTimeline('itemsShown')
      softRuns.push(marks)
      await page.waitForTimeout(2500)
      await take(`(soft nav ${run + 1} render totals)`)
    }
    const soft = field => `${median(softRuns.map(r => r[field] ?? Number.NaN))} (min ${Math.min(...softRuns.map(r => r[field] ?? Number.NaN))})`
    console.log(`\n>>> SIDEBAR CLICK → ${target.link} (median (min) of ${RUNS}, ms since click): pending shell ${soft('pendingShell')} · toolbar in DOM ${soft('toolbar')} · toolbar fully shown ${soft('toolbarShown')} · content in DOM ${soft('items')} · content fully shown ${soft('itemsShown')}`)
    console.log(`    runs: ${softRuns.map(r => `${r.pendingShell}/${r.toolbar}/${r.toolbarShown}/${r.items}/${r.itemsShown}`).join('  ')}  (pendingShell/toolbar/toolbarShown/content/contentShown)`)
  }

  // 4 ─ Steady state: what is mounted, and what each interaction costs.
  await page.goto(`${BASE}${target.path}`, { timeout: 120000 })
  await page.waitForSelector(target.item, { timeout: 60000 })
  // The census walks fibers, so it must wait for hydration, which a cold dev server can take far longer than the settle.
  await page.waitForFunction(selector => Object.keys(document.querySelector(selector) ?? {}).some(name => name.startsWith('__reactFiber')), target.item, { timeout: 120000, polling: 100 })
  await page.waitForTimeout(4000)
  await take('(discarded) load')
  const census = await page.evaluate(() => window.__census())
  const items = page.locator(target.item)
  const itemCount = await items.count()
  const interesting = Object.entries(census.counts).filter(([name]) => /Card|Dialog|Modal|Dropdown|Popover|Menu|Tooltip|Kanban|Participants|Picker|Select/.test(name)).sort((a, b) => b[1] - a[1]).slice(0, 22)
  console.log(`\n>>> MOUNTED (${itemCount} items): DOM nodes ${census.dom} · component instances ${census.fibers} · useMutation observers ${census.mutationObservers} · query observers ${census.queryObservers}`)
  console.log(`    per item: ${Math.round(census.dom / itemCount)} DOM nodes · ${Math.round(census.fibers / itemCount)} components · ${(census.mutationObservers / itemCount).toFixed(1)} mutation observers`)
  console.log(`    ${interesting.map(([name, count]) => `${name}×${count}`).join(' | ')}`)

  await scenario('idle 5s', async () => {
    await page.waitForTimeout(5000)
  })

  await scenario('hover sweep (12 items)', async () => {
    for (let index = 0; index < Math.min(12, itemCount); index++) {
      const box = await items.nth(index).boundingBox()
      if (box && box.y < 880 && box.x < 1380) {
        await page.mouse.move(box.x + box.width / 2, box.y + Math.min(20, box.height / 2), { steps: 3 })
      }
    }
    await page.waitForTimeout(500)
  })

  await scenario('open profile modal', async () => {
    const opener = key === 'meetings'
      ? items.nth(1).locator('button.underline').first()
      : key.startsWith('pipeline') ? items.first().locator('span.font-semibold').first() : items.first()
    const started = Date.now()
    if (key === 'schedule') {
      await opener.click({ position: { x: 12, y: 6 } })
    }
    else {
      await opener.click()
    }
    await page.waitForSelector('[role=dialog]', { timeout: 30000 })
    console.log(`\n    dialog in DOM after ${Date.now() - started}ms`)
    await page.waitForTimeout(3000)
  })

  await scenario('close profile modal', async () => {
    if (await page.locator('[role=dialog]').count() === 0) {
      return 'no dialog open'
    }
    await page.keyboard.press('Escape')
    await page.waitForSelector('[role=dialog]', { state: 'detached', timeout: 10000 })
    await page.waitForTimeout(1500)
  })

  await scenario('search keystrokes "ma"', async () => {
    const input = page.locator('input[placeholder^="Search by"]').first()
    await input.click()
    await page.keyboard.type('ma', { delay: 150 })
    await page.waitForTimeout(3000)
  })

  await scenario('clear search', async () => {
    await page.locator('input[placeholder^="Search by"]').first().fill('')
    await page.waitForTimeout(3000)
  })

  if (key === 'schedule') {
    for (const [label, name] of [['previous week', 'Previous'], ['previous week again', 'Previous'], ['next week (cached)', 'Next'], ['next week (cached) again', 'Next']]) {
      await scenario(label, async () => {
        const started = Date.now()
        await page.getByRole('button', { name, exact: true }).click()
        await page.waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000, polling: 16 })
        console.log(`\n    settled after ${Date.now() - started}ms`)
        await page.waitForTimeout(2500)
      })
    }
    await scenario('show activities', async () => {
      const started = Date.now()
      await page.getByRole('radio', { name: 'Activities' }).click()
      await page.waitForFunction(() => document.querySelector('input[placeholder^="Search by title"]') && !document.querySelector('[aria-busy="true"]'), null, { timeout: 30000, polling: 16 })
      console.log(`\n    settled after ${Date.now() - started}ms`)
      await page.waitForTimeout(2500)
    })
    await scenario('show meetings', async () => {
      const started = Date.now()
      await page.getByRole('radio', { name: 'Meetings' }).click()
      await page.waitForSelector(target.item, { timeout: 30000 })
      console.log(`\n    cards back after ${Date.now() - started}ms`)
      await page.waitForTimeout(2500)
    })
  }

  if (key.startsWith('pipeline-fresh')) {
    for (const [label, option, wait] of [['switch pipeline → Rehash (181 cards)', 'Rehash', '/dashboard/pipeline/rehash'], ['switch pipeline → Fresh', 'Fresh', '/dashboard/pipeline/fresh']]) {
      await scenario(label, async () => {
        const trigger = page.locator('button[role=combobox]').first()
        if (await trigger.count() === 0) {
          return 'no pipeline select'
        }
        await trigger.click()
        const started = Date.now()
        await page.getByRole('option', { name: new RegExp(option, 'i') }).first().click()
        await page.waitForURL(`**${wait}*`, { timeout: 60000 })
        const urlAt = Date.now() - started
        await page.waitForFunction(() => {
          const card = document.querySelector('.min-w-70 [data-slot="card"]')
          if (!card || document.querySelector('[data-slot="data-view-pending"]')) {
            return false
          }
          for (let node = card; node; node = node.parentElement) {
            const style = getComputedStyle(node)
            if (Number.parseFloat(style.opacity) < 0.99 || (style.transform !== 'none' && style.transform !== 'matrix(1, 0, 0, 1, 0, 0)')) {
              return false
            }
          }
          return true
        }, null, { timeout: 60000, polling: 16 })
        console.log(`\n    url changed ${urlAt}ms · board fully shown ${Date.now() - started}ms · cards ${await page.locator('.min-w-70 [data-slot="card"]').count()}`)
        await page.waitForTimeout(3000)
      })
    }
  }
}
catch (error) {
  console.error(`probe failed: ${redact(error.message).split('\n')[0]}`)
}
await browser.close()
