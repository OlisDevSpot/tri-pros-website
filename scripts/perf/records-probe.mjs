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

try {
  await page.goto(`${base}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent(path)}`)
  await page.waitForFunction(hasDataRows, null, { timeout: 120000 })
}
catch (error) {
  // Playwright's navigation errors quote the URL, which carries the secret.
  console.error(error.message.replaceAll(encodeURIComponent(secret), '***').replaceAll(secret, '***'))
  await browser.close()
  process.exit(1)
}
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
