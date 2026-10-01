import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

type Tokens = Map<string, string>
type Mode = 'light' | 'dark'
type Rgba = [number, number, number, number]

/** Where a token is read: the page, a surface on a rung of the elevation ladder, an overlay, or beneath the page. */
type Place = 'beneath' | 'page' | 'rung 1' | 'rung 2' | 'rung 3' | 'overlay'

interface Pair {
  label: string
  fg: string
  bg: string
  min: number
  /** Resolves a translucent `bg` against this token first (e.g. a pill fill over the card). */
  base?: string
  /** Surface-relative pairs are checked on every place listed; the rest on the page only. */
  on?: Place[]
}

const STATUS_TONES = ['info', 'pending', 'attention', 'action', 'success', 'danger', 'idle'] as const
const SERIES = ['leads', 'booked', 'sits', 'sales'] as const
const IDENTITY_COUNT = 8

const cssPath = process.argv[2] ?? path.join(process.cwd(), 'src/app/(frontend)/globals.css')
const css = readFileSync(cssPath, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

function readBlock(selector: RegExp): Tokens {
  const match = selector.exec(css)
  if (!match) {
    throw new Error(`No block matches ${selector}`)
  }
  const open = css.indexOf('{', match.index)
  let depth = 0
  let close = open
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') {
      depth++
    }
    else if (css[i] === '}' && --depth === 0) {
      close = i
      break
    }
  }
  const tokens: Tokens = new Map()
  for (const declaration of css.slice(open + 1, close).split(';')) {
    const colon = declaration.indexOf(':')
    const name = declaration.slice(0, colon).trim()
    if (colon > 0 && name.startsWith('--')) {
      tokens.set(name, declaration.slice(colon + 1).trim().replace(/\s+/g, ' '))
    }
  }
  return tokens
}

// The cascade: the settings (:root, then .dark in dark mode), the page's absolute rungs, then the relative block
// that every surface re-declares against its own --depth. A place is that cascade with the depth it would have.
const rootBlock = readBlock(/^:root,\s*\.funnel-light\s*\{/m)
const darkBlock = readBlock(/^\.dark\s*\{/m)
const pageBlock = readBlock(/^:root,\s*\.dark\s*\{/m)
const relativeBlock = readBlock(/^:root,\s*\.dark,\s*:is\(\.bg-card/m)
const overlayBlock = readBlock(/^:is\(\.bg-popover,\s*\.surface-overlay\)\s*\{/m)
const beneathBlock = readBlock(/^\.surface-beneath\s*\{/m)

const PLACES: Record<Place, Tokens> = {
  'beneath': beneathBlock,
  'page': new Map(),
  'rung 1': new Map([['--depth', '1']]),
  'rung 2': new Map([['--depth', '2']]),
  'rung 3': new Map([['--depth', '3']]),
  'overlay': overlayBlock,
}
const CARDS: Place[] = ['rung 1', 'rung 2', 'rung 3']

function tokensFor(mode: Mode, place: Place): Tokens {
  return new Map([...rootBlock, ...(mode === 'dark' ? darkBlock : []), ...pageBlock, ...relativeBlock, ...PLACES[place]])
}

function substitute(value: string, tokens: Tokens, depth = 0): string {
  if (depth > 12) {
    throw new Error(`var() nests too deep in "${value}"`)
  }
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    const raw = tokens.get(name)
    if (raw === undefined) {
      throw new Error(`${name} is not declared`)
    }
    return substitute(raw, tokens, depth + 1)
  })
}

const resolve = (name: string, mode: Mode, place: Place = 'page') => substitute(`var(${name})`, tokensFor(mode, place))

// Splits on a separator only outside parentheses, so `calc(a + b) 0.01 255` gives three channels.
function splitTopLevel(text: string, separator: RegExp): string[] {
  const parts: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < text.length; i++) {
    const character = text[i]
    if (character === '(') {
      depth++
    }
    else if (character === ')') {
      depth--
    }
    else if (depth === 0 && separator.test(character)) {
      parts.push(text.slice(start, i))
      start = i + 1
    }
  }
  parts.push(text.slice(start))
  return parts.map(part => part.trim()).filter(Boolean)
}

// calc()/min()/max() arithmetic on plain numbers, which is all the ladder uses.
function evaluate(expression: string): number {
  const tokens = expression.replace(/calc\(/g, '(').match(/min|max|\d*\.?\d+|[-+*/(),]/g) ?? []
  let at = 0
  const peek = () => tokens[at]
  const take = () => tokens[at++]
  function sum(): number {
    let value = product()
    while (peek() === '+' || peek() === '-') {
      value = take() === '+' ? value + product() : value - product()
    }
    return value
  }
  function product(): number {
    let value = unary()
    while (peek() === '*' || peek() === '/') {
      value = take() === '*' ? value * unary() : value / unary()
    }
    return value
  }
  function unary(): number {
    if (peek() === '-') {
      take()
      return -unary()
    }
    return atom()
  }
  function atom(): number {
    const token = take()
    if (token === '(') {
      const value = sum()
      take()
      return value
    }
    if (token === 'min' || token === 'max') {
      take()
      const args = [sum()]
      while (peek() === ',') {
        take()
        args.push(sum())
      }
      take()
      return token === 'min' ? Math.min(...args) : Math.max(...args)
    }
    const value = Number(token)
    if (token === undefined || Number.isNaN(value)) {
      throw new Error(`Cannot evaluate "${expression}"`)
    }
    return value
  }
  const value = sum()
  if (at !== tokens.length) {
    throw new Error(`Cannot evaluate "${expression}"`)
  }
  return value
}

type Oklab = [number, number, number, number]

function toOklab(color: string): Oklab {
  const call = /^(oklch|color-mix)\(([\s\S]*)\)$/.exec(color.trim())
  if (!call) {
    throw new Error(`Cannot parse color "${color}"`)
  }
  if (call[1] === 'oklch') {
    const [channels, alpha] = splitTopLevel(call[2], /\//)
    const [l, c, h] = splitTopLevel(channels, /\s/)
    // CSS clamps oklch lightness to 0..1, which is what lets light-mode steps above the top rung stop at white.
    const lightness = Math.min(1, Math.max(0, l.endsWith('%') ? evaluate(l.slice(0, -1)) / 100 : evaluate(l)))
    const chroma = evaluate(c)
    const hue = (evaluate(h) * Math.PI) / 180
    return [lightness, chroma * Math.cos(hue), chroma * Math.sin(hue), alpha ? evaluate(alpha) : 1]
  }
  const [space, first, second] = splitTopLevel(call[2], /,/)
  if (space !== 'in oklab' || !first || !second) {
    throw new Error(`Only color-mix(in oklab, A p%, B) is supported: "${color}"`)
  }
  const stop = (text: string): [Oklab, number | undefined] => {
    const parts = splitTopLevel(text, /\s/)
    const last = parts.at(-1) ?? ''
    return last.endsWith('%')
      ? [toOklab(parts.slice(0, -1).join(' ')), evaluate(last.slice(0, -1)) / 100]
      : [toOklab(text), undefined]
  }
  const [a, shareA] = stop(first)
  const [b, shareB] = stop(second)
  const weightA = shareA ?? (shareB === undefined ? 0.5 : 1 - shareB)
  const weightB = shareB ?? 1 - weightA
  return [0, 1, 2, 3].map(i => a[i] * weightA + b[i] * weightB) as Oklab
}

// Same oklab → linear sRGB math as the theme studies page, so its ratios reproduce here.
function oklabToLinear([lightness, a, b, alpha]: Oklab): Rgba {
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    alpha,
  ]
}

function toLinearRgba(color: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const channel = (offset: number) => {
      const value = Number.parseInt(hex[1].slice(offset, offset + 2), 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    return [channel(0), channel(2), channel(4), 1]
  }
  return oklabToLinear(toOklab(color))
}

function composite(top: Rgba, bottom: Rgba): Rgba {
  const alpha = top[3]
  return [0, 1, 2].map(i => top[i] * alpha + bottom[i] * (1 - alpha)).concat(1) as Rgba
}

const luminance = (rgb: Rgba) => 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
const luminanceOf = (name: string, mode: Mode, place: Place = 'page') => luminance(toLinearRgba(resolve(name, mode, place)))

function contrast(pair: Pair, mode: Mode, place: Place): number {
  let background = toLinearRgba(resolve(pair.bg, mode, place))
  if (pair.base) {
    background = composite(background, toLinearRgba(resolve(pair.base, mode, place)))
  }
  const foreground = composite(toLinearRgba(resolve(pair.fg, mode, place)), background)
  const [high, low] = [luminance(foreground), luminance(background)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const EVERYWHERE: Place[] = ['beneath', 'page', ...CARDS, 'overlay']
const ON_SURFACES: Place[] = ['page', ...CARDS, 'overlay']

const pairs: Pair[] = [
  { label: 'body text on page', fg: '--foreground', bg: '--background', min: 4.5 },
  { label: 'body text on surface', fg: '--foreground', bg: '--card', min: 4.5, on: EVERYWHERE },
  { label: 'muted text on surface', fg: '--muted-foreground', bg: '--card', min: 4.5, on: EVERYWHERE },
  { label: 'muted text on step-up', fg: '--muted-foreground', bg: '--muted', min: 4.5, on: EVERYWHERE },
  { label: 'link on surface', fg: '--link', bg: '--card', min: 4.5, on: ON_SURFACES },
  { label: 'destructive text on surface', fg: '--destructive-text', bg: '--card', min: 4.5, on: ON_SURFACES },
  { label: 'control border vs surface', fg: '--input', bg: '--card', min: 3, on: ON_SURFACES },
  { label: 'body text on band', fg: '--foreground', bg: '--band', min: 4.5, on: ['page', ...CARDS] },
  { label: 'muted text on band', fg: '--muted-foreground', bg: '--band', min: 4.5, on: ['page', ...CARDS] },
  { label: 'body text on hovered row', fg: '--foreground', bg: '--row-hover', min: 4.5, on: ON_SURFACES },
  { label: 'body text on selected row', fg: '--foreground', bg: '--row-selected', min: 4.5, on: ON_SURFACES },
  // Edges are the owner's pick (`--edge`, tuned by eye with the elevation-ladder skill). These floors only catch a
  // retune that makes them vanish; the pick of 2026-10-01 measures 1.13–1.22 on cards.
  { label: 'edge vs its surface', fg: '--border', bg: '--card', min: 1.1, on: [...CARDS, 'overlay'] },
  { label: 'skeleton bar vs its surface', fg: '--skeleton', bg: '--card', min: 1.1, on: [...CARDS, 'overlay'] },
  { label: 'skeleton block vs its surface', fg: '--skeleton-soft', bg: '--card', min: 1.07, on: [...CARDS, 'overlay'] },
  { label: 'button label on primary', fg: '--primary-foreground', bg: '--primary', min: 4.5 },
  { label: 'primary vs page', fg: '--primary', bg: '--background', min: 3 },
  { label: 'focus ring vs page', fg: '--ring', bg: '--background', min: 3 },
  { label: 'label on destructive', fg: '--destructive-foreground', bg: '--destructive', min: 4.5 },
  { label: 'label on success', fg: '--success-foreground', bg: '--success', min: 4.5 },
  { label: 'label on warning', fg: '--warning-foreground', bg: '--warning', min: 4.5 },
  { label: 'sidebar label on rail', fg: '--sidebar-foreground', bg: '--sidebar', min: 4.5 },
  { label: 'sidebar muted on rail', fg: '--sidebar-muted', bg: '--sidebar', min: 4.5 },
  { label: 'active nav label on pill', fg: '--sidebar-accent-foreground', bg: '--sidebar-accent', min: 4.5 },
  { label: 'sidebar label on hover', fg: '--sidebar-foreground', bg: '--sidebar-hover', min: 4.5 },
  { label: 'sidebar label on active pill', fg: '--sidebar-foreground', bg: '--sidebar-accent', min: 4.5 },
  { label: 'active icon on pill', fg: '--sidebar-active-icon', bg: '--sidebar-accent', min: 3 },
  ...STATUS_TONES.map(tone => ({ label: `status ${tone} text on its fill`, fg: `--status-${tone}-fg`, bg: `--status-${tone}-bg`, min: 4.5, base: '--card', on: CARDS })),
  ...SERIES.map(series => ({ label: `series ${series} vs surface`, fg: `--series-${series}`, bg: '--card', min: 3, on: CARDS })),
  ...Array.from({ length: IDENTITY_COUNT }, (_, i) => ({ label: `identity ${i + 1} text on its fill`, fg: `--identity-${i + 1}-fg`, bg: `--identity-${i + 1}-bg`, min: 4.5, base: '--card', on: CARDS })),
]

// Sunlight from above: the ladder climbs from beneath the page to the overlays, and on every surface the band sits
// between the surface and its step-up. Each entry reads [lower, upper]: upper must be lighter.
const climb: [[string, Place], [string, Place]][] = [
  [['--card', 'beneath'], ['--background', 'page']],
  [['--background', 'page'], ['--card', 'rung 1']],
  [['--card', 'rung 1'], ['--card', 'rung 2']],
  [['--card', 'rung 2'], ['--card', 'rung 3']],
  [['--card', 'rung 3'], ['--card', 'overlay']],
  [['--card', 'rung 3'], ['--popover', 'page']],
  ...CARDS.flatMap((place): [[string, Place], [string, Place]][] => [
    [['--card', place], ['--band', place]],
    [['--band', place], ['--muted', place]],
  ]),
]

// In light mode an edge is darker than its surface; in dark mode, lighter.
const edgeLeans: Record<Mode, 'darker' | 'lighter'> = { light: 'darker', dark: 'lighter' }

const railClimb: [string, string][] = [['--background', '--sidebar'], ['--sidebar', '--sidebar-hover'], ['--sidebar-hover', '--sidebar-accent']]

const failures: string[] = []
let checks = 0

function guard(label: string, test: () => string | undefined) {
  checks++
  try {
    const failure = test()
    if (failure) {
      failures.push(failure)
    }
  }
  catch (error) {
    failures.push(`${label}: ${(error as Error).message}`)
  }
}

for (const mode of ['light', 'dark'] as const) {
  for (const pair of pairs) {
    for (const place of pair.on ?? ['page']) {
      guard(`${mode}: ${pair.label} (${place})`, () => {
        const ratio = contrast(pair, mode, place)
        return ratio < pair.min ? `${mode}: ${pair.label} (${place}) is ${ratio.toFixed(2)}:1, needs ${pair.min}:1` : undefined
      })
    }
  }
  for (const [[lower, lowerPlace], [upper, upperPlace]] of climb) {
    guard(`${mode}: ${upper} (${upperPlace}) over ${lower} (${lowerPlace})`, () =>
      luminanceOf(upper, mode, upperPlace) <= luminanceOf(lower, mode, lowerPlace)
        ? `${mode}: ${upper} (${upperPlace}) must be lighter than ${lower} (${lowerPlace})`
        : undefined)
  }
  for (const place of CARDS) {
    guard(`${mode}: edge on ${place}`, () => {
      const edgeIsLighter = luminanceOf('--border', mode, place) > luminanceOf('--card', mode, place)
      return edgeIsLighter === (edgeLeans[mode] === 'lighter') ? undefined : `${mode}: the edge on ${place} must be ${edgeLeans[mode]} than its surface`
    })
  }
  if (mode === 'dark') {
    for (const [lower, upper] of railClimb) {
      guard(`dark: ${upper} over ${lower}`, () =>
        luminanceOf(upper, mode) <= luminanceOf(lower, mode) ? `dark: ${upper} must be lighter than ${lower}` : undefined)
    }
  }
}

// The 2px rule: a fixed font-size step is an even number of pixels (16px root). Fluid clamp() steps are not fixed sizes.
for (const [, name, value, unit] of css.matchAll(/(--text-[\w-]+)\s*:\s*([\d.]+)(px|rem)\s*;/g)) {
  checks++
  const pixels = Number(value) * (unit === 'rem' ? 16 : 1)
  if (!Number.isInteger(pixels) || pixels % 2 !== 0) {
    failures.push(`type ramp: ${name} is ${pixels}px; every step must be an even number of pixels`)
  }
}

if (failures.length > 0) {
  console.error(`theme:check: ${failures.length} of ${checks} checks failed\n${failures.map(line => `  ✗ ${line}`).join('\n')}`)
  process.exit(1)
}
console.log(`theme:check: all ${checks} checks pass`)
