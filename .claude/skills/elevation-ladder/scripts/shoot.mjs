// Screenshots the pages the ladder's gate needs, light and dark, on desktop, tablet and phone, and reports what the
// ladder touches on each: surfaces by depth, page-coloured holes inside surfaces, and see-through fills that repeat
// their surface's colour.
//
//   node shoot.mjs --base http://localhost:3000 --out DIR [--only id,id] [--viewports desktop,tablet,phone] [--public]
//
// --public shoots only pages that need no sign-in (the live site). Dashboard pages sign in through
// /api/dev/playwright-session with DEV_LOGIN_SECRET from .env.local; the secret and the login URL are never printed.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const REPO = path.resolve(HERE, '../../../..')

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, '')
  const next = process.argv[i + 1]
  args[key] = next && !next.startsWith('--') ? (i++, next) : 'true'
}
for (const required of ['base', 'out']) {
  if (!args[required]) {
    console.error(`missing --${required}`)
    process.exit(2)
  }
}

// Tablet is the owner's iPad in portrait. Every width and both schemes are shot from one page load per screen
// (resize, then switch prefers-color-scheme, which the app's theme follows): the dev server grows by every load.
const VIEWPORTS = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 820, height: 1180 },
  phone: { width: 390, height: 844 },
}
const viewports = (args.viewports ?? 'desktop,tablet,phone').split(',')
for (const name of viewports) {
  if (!VIEWPORTS[name]) {
    console.error(`unknown viewport "${name}"; use ${Object.keys(VIEWPORTS).join(', ')}`)
    process.exit(2)
  }
}

// The row actions trigger is the icon button whose screen-reader label is "Actions" (EntityActionDropdown).
const ROW_ACTIONS = 'tbody button:has(> .sr-only:text-is("Actions"))'

// `open` clicks the first match and waits for a dialog or menu; `hover` then points at the first match inside it;
// `pick` clicks the menu item with that name, then shoots the page it opens (`popup`: in a new tab);
// `scroll` is pixels or 'bottom'. `on` lists the viewports a screen is judged on: proposals are presented on the iPad,
// the review page is read on phones, and the menu and /test look the same at every width. Each page load grows the
// dev server's memory, so screens skip the widths that add nothing. A screen that opens a menu or dialog loads again
// at each width, because an open overlay doesn't follow a resize.
const ALL = ['desktop', 'tablet', 'phone']
const SHOTS = [
  { id: 'dashboard', path: '/dashboard', auth: true, on: ALL },
  { id: 'meetings', path: '/dashboard/meetings', auth: true, on: ALL },
  { id: 'meetings-menu', path: '/dashboard/meetings', auth: true, open: ROW_ACTIONS, hover: '[role="menuitem"]', on: ['desktop', 'tablet'] },
  { id: 'customer-profile', path: '/dashboard/meetings', auth: true, open: 'tbody button.decoration-dotted', on: ALL },
  { id: 'proposal-edit', path: '/dashboard/proposals', auth: true, open: ROW_ACTIONS, pick: 'Edit Proposal', on: ['desktop', 'tablet'] },
  { id: 'proposal-review', path: '/dashboard/proposals', auth: true, open: ROW_ACTIONS, pick: 'View Proposal', popup: true, on: ALL },
  { id: 'home-scrolled', path: '/', scroll: 1400, on: ALL },
  { id: 'home-footer', path: '/', scroll: 'bottom', on: ALL },
  { id: 'about', path: '/about', on: ['desktop', 'phone'] },
  { id: 'services', path: '/services', on: ['desktop', 'phone'] },
  { id: 'marketing', path: '/test', on: ['desktop'] },
]

const only = args.only ? new Set(args.only.split(',')) : null
const wanted = SHOTS.filter(s => (!only || only.has(s.id)) && (args.public !== 'true' || !s.auth))

const env = readFileSync(path.join(REPO, '.env.local'), 'utf8')
const secret = /^DEV_LOGIN_SECRET=(.*)$/m.exec(env)?.[1]?.trim().replace(/^["']|["']$/g, '')
const redact = text => (secret ? String(text).split(secret).join('<secret>') : String(text))

// Runs in the page. A surface is .bg-card/.surface; a hole is a bg-background element inside one (it paints the
// page's colour); a see-through fill is bg-card|muted|accent|secondary/N inside a surface.
function REPORT() {
  const surfaces = [...document.querySelectorAll('.bg-card, .surface')]
  const depthOf = el => Number(getComputedStyle(el).getPropertyValue('--depth').trim() || 0)
  const byDepth = {}
  for (const el of surfaces) {
    const d = depthOf(el)
    byDepth[d] = (byDepth[d] ?? 0) + 1
  }
  const describe = el => `${el.tagName.toLowerCase()}${el.dataset.slot ? `[${el.dataset.slot}]` : ''} "${(el.textContent ?? '').trim().slice(0, 40)}"`
  const inSurface = el => el.parentElement?.closest('.bg-card, .surface')
  const holes = [...document.querySelectorAll('.bg-background')].filter(inSurface)
  const seeThrough = [...document.querySelectorAll('[class*="bg-card/"], [class*="bg-muted/"], [class*="bg-accent/"], [class*="bg-secondary/"]')].filter(inSurface)
  return {
    surfacesByDepth: byDepth,
    deepest: surfaces.filter(el => depthOf(el) >= 3).slice(0, 8).map(describe),
    holes: { count: holes.length, first: holes.slice(0, 8).map(describe) },
    seeThrough: { count: seeThrough.length, first: seeThrough.slice(0, 8).map(describe) },
  }
}

async function settle(target) {
  await target.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {})
  await target.waitForTimeout(1500)
}

// Loads the screen and opens what it shows; returns the page to shoot (a popup for `popup` screens).
async function load(page, shot) {
  await page.goto(`${args.base}${shot.path}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await settle(page)
  let target = page
  if (shot.open) {
    await page.locator(shot.open).first().click({ timeout: 20000 })
    await page.locator('[role="dialog"], [role="menu"]').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(600)
  }
  if (shot.hover) {
    await page.locator(`[role="menu"] ${shot.hover}, [role="dialog"] ${shot.hover}`).first().hover()
    await page.waitForTimeout(300)
  }
  if (shot.pick) {
    const item = page.getByRole('menuitem', { name: shot.pick, exact: true }).first()
    if (shot.popup) {
      const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 60000 }), item.click({ timeout: 20000 })])
      await popup.waitForLoadState('domcontentloaded', { timeout: 120000 })
      target = popup
    }
    else {
      const before = page.url()
      await item.click({ timeout: 20000 })
      await page.waitForURL(url => url.toString() !== before, { timeout: 60000 })
    }
    await settle(target)
  }
  return target
}

// next-themes follows the system scheme only once it has mounted, and the first screen after sign-in can still be
// hydrating. Its cross-tab storage event sets the theme either way; resend it until the page reports the scheme.
async function setScheme(target, scheme) {
  await target.emulateMedia({ colorScheme: scheme })
  await target.waitForFunction((s) => {
    if (!document.documentElement.classList.contains(s)) {
      window.dispatchEvent(new StorageEvent('storage', { key: 'theme', newValue: s }))
    }
    return document.documentElement.classList.contains(s)
  }, scheme, { timeout: 20000, polling: 500 })
  await target.waitForTimeout(500)
}

// Scroll is applied after every resize: the page reflows, so the same offset lands elsewhere.
async function scroll(target, shot) {
  if (!shot.scroll) {
    return
  }
  await target.evaluate(y => window.scrollTo(0, y === 'bottom' ? document.body.scrollHeight : y), shot.scroll)
  await target.waitForTimeout(1200)
}

const { chromium } = createRequire(path.join(REPO, 'package.json'))('playwright')
mkdirSync(args.out, { recursive: true })
const browser = await chromium.launch()
const report = {}
const skipped = []

try {
  const context = await browser.newContext({ viewport: VIEWPORTS.desktop, colorScheme: 'light' })
  const page = await context.newPage()
  if (wanted.some(s => s.auth)) {
    if (!secret) {
      throw new Error('DEV_LOGIN_SECRET is missing from .env.local')
    }
    try {
      await page.goto(`${args.base}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent('/dashboard')}`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    }
    catch (error) {
      throw new Error(redact(error.message))
    }
  }
  for (const shot of wanted) {
    const widths = shot.on.filter(v => viewports.includes(v))
    let target = null
    for (const viewport of widths) {
      // One retry: a cold dev server sometimes times out a first navigation.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          await page.setViewportSize(VIEWPORTS[viewport])
          await page.emulateMedia({ colorScheme: 'light' })
          if (!target || shot.open) {
            if (target && target !== page) {
              await target.close()
            }
            target = await load(page, shot)
          }
          else if (target !== page) {
            await target.setViewportSize(VIEWPORTS[viewport])
          }
          await scroll(target, shot)
          for (const scheme of ['light', 'dark']) {
            const tag = `${shot.id}-${scheme}-${viewport}`
            await setScheme(target, scheme)
            await target.screenshot({ path: path.join(args.out, `${tag}.png`) })
            report[tag] = { url: target.url().replace(args.base, ''), ...(await target.evaluate(REPORT)) }
          }
          break
        }
        catch (error) {
          target = null
          if (attempt === 2) {
            skipped.push(`${shot.id}-${viewport}: ${redact(error.message).split('\n')[0]}`)
          }
        }
      }
    }
    if (target && target !== page) {
      await target.close()
    }
    await page.keyboard.press('Escape').catch(() => {})
  }
  await context.close()
}
finally {
  await browser.close()
}

writeFileSync(path.join(args.out, 'report.json'), `${JSON.stringify({ base: args.base, takenAt: new Date().toISOString(), report, skipped }, null, 2)}\n`)
for (const [tag, r] of Object.entries(report)) {
  console.log(`${tag.padEnd(34)} depths ${JSON.stringify(r.surfacesByDepth)} · holes ${r.holes.count} · see-through ${r.seeThrough.count}`)
}
for (const line of skipped) {
  console.log(`skipped ${line}`)
}
console.log(`${Object.keys(report).length} shot(s), ${skipped.length} skipped → ${args.out}`)
process.exit(skipped.length ? 1 : 0)
