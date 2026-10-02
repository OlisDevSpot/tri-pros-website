// Reads the surface colours a running site actually serves, in light and dark, and
// writes them as one comparison preset for the ladder page.
//
//   node measure.mjs --url http://localhost:3000/ --id current --label "Local build now" --out /tmp/current.json
//
// A public page is enough; no login is needed. Each rung is built in the page from its chain of classes in
// ladder.json and read where it paints, so a card nested in cards reports its real colour; the chip, band and
// edge are read inside each rung. A rung whose class the site doesn't ship falls back to the token in `else`.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const HERE = path.dirname(new URL(import.meta.url).pathname)
const SKILL = path.resolve(HERE, '..')
const REPO = path.resolve(SKILL, '../../..')

const args = {}
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i].replace(/^--/, '')
  const next = process.argv[i + 1]
  args[key] = next && !next.startsWith('--') ? (i++, next) : 'true'
}
for (const required of ['url', 'id', 'label', 'out']) {
  if (!args[required]) {
    console.error(`missing --${required}`)
    process.exit(2)
  }
}

const ladder = JSON.parse(readFileSync(path.join(SKILL, 'ladder.json'), 'utf8'))
const map = ladder.measure.map

// Chrome reports computed colours as oklch(), oklab(), color(srgb …) or rgb(); normalise all of them to OKLCH.
function toOklch(value) {
  if (!value || value === 'rgba(0, 0, 0, 0)' || value === 'transparent')
    return null
  const nums = (value.match(/-?[\d.]+(?:e-?\d+)?/g) ?? []).map(Number)
  const alphaOf = (s) => {
    const match = /\/\s*([\d.]+)/.exec(s)
    return match ? Number(match[1]) : 1
  }
  if (value.startsWith('oklch('))
    return { L: nums[0], c: nums[1], h: nums[2], alpha: alphaOf(value) }
  if (value.startsWith('oklab(')) {
    const [L, a, b] = nums
    return { L, c: Math.hypot(a, b), h: (Math.atan2(b, a) * 180 / Math.PI + 360) % 360, alpha: alphaOf(value) }
  }
  let rgb
  let alpha = 1
  if (value.startsWith('color(srgb')) {
    rgb = nums.slice(0, 3)
    alpha = alphaOf(value)
  }
  else if (value.startsWith('rgb')) {
    rgb = nums.slice(0, 3).map(n => n / 255)
    alpha = nums[3] ?? 1
  }
  else {
    return null
  }
  const lin = c => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  const [r, g, b] = rgb.map(lin)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, c: Math.hypot(A, B), h: (Math.atan2(B, A) * 180 / Math.PI + 360) % 360, alpha }
}

const round = x => x && { L: +x.L.toFixed(4), c: +x.c.toFixed(4), h: +x.h.toFixed(1), ...(x.alpha < 1 ? { alpha: +x.alpha.toFixed(3) } : {}) }
const css = x => x && `oklch(${x.L.toFixed(4)} ${x.c.toFixed(4)} ${x.h.toFixed(1)})`

// Runs in the page: builds each rung, reads its paint and the step tokens inside it, then removes it.
function readRungs({ levels, inside, textNames }) {
  const paint = el => getComputedStyle(el).backgroundColor
  const probe = (host, token) => {
    const el = document.createElement('div')
    el.style.backgroundColor = `var(${token})`
    host.append(el)
    const value = paint(el)
    el.remove()
    return value
  }
  const rungs = {}
  for (const [level, spec] of Object.entries(levels)) {
    let host = document.body
    let root = null
    for (const name of spec.chain) {
      const el = document.createElement('div')
      el.className = name
      host.append(el)
      root ??= el
      host = el
    }
    let surface = paint(host)
    if (spec.else && (surface === 'rgba(0, 0, 0, 0)' || surface === 'transparent'))
      surface = probe(document.body, spec.else)
    rungs[level] = { surface, ...Object.fromEntries(Object.entries(inside).map(([role, token]) => [role, probe(host, token)])) }
    root?.remove()
  }
  return { rungs, raw: Object.fromEntries(textNames.map(name => [name, probe(document.body, name)])) }
}

const { chromium } = createRequire(path.join(REPO, 'package.json'))('playwright')
const browser = await chromium.launch()
const result = { id: args.id, label: args.label, source: args.url, measuredAt: new Date().toISOString() }

try {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ colorScheme: scheme, viewport: { width: 1280, height: 800 } })
    const page = await context.newPage()
    await page.goto(args.url, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForTimeout(1500)
    const textNames = [...new Set(Object.values(map.text).filter(Boolean))]
    const { rungs, raw } = await page.evaluate(readRungs, { levels: map.levels, inside: { chip: map.chip, band: map.band, edge: map.edge }, textNames })
    const byRung = role => Object.fromEntries(Object.entries(rungs).map(([level, r]) => [level, round(toOklch(r[role]))]))
    const onPage = rungs['0']
    const text = {}
    for (const [role, name] of Object.entries(map.text)) text[role] = css(toOklch(raw[name]))
    result[scheme] = {
      lv: byRung('surface'),
      chip: round(toOklch(onPage?.chip)),
      band: round(toOklch(onPage?.band)),
      edge: round(toOklch(onPage?.edge)),
      chipAt: byRung('chip'),
      bandAt: byRung('band'),
      edgeAt: byRung('edge'),
      text,
      raw: { ...raw, rungs },
    }
    await context.close()
  }
}
finally {
  await browser.close()
}

writeFileSync(args.out, `${JSON.stringify(result, null, 2)}\n`)
const brief = s => Object.entries(result[s].lv).map(([n, x]) => `${n}:${x ? x.L.toFixed(3) : '—'}`).join(' ')
console.log(`${args.label} — light ${brief('light')} · dark ${brief('dark')} → ${args.out}`)
