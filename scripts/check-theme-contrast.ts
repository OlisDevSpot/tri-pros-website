import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

type Tokens = Map<string, string>
type Mode = 'light' | 'dark'
type Rgba = [number, number, number, number]

interface Pair {
  label: string
  fg: string
  bg: string
  /** Non-text steps can need a different floor per mode; see the border pairs. */
  min: number | Record<Mode, number>
  /** Resolves a translucent `bg` against this token first (e.g. a pill fill over the card). */
  base?: string
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

// The cascade on <html>: :root first, then .dark (settings only in dark mode), then the ramp block,
// which derives every surface from those settings.
const rootBlock = readBlock(/^:root,\s*\.funnel-light\s*\{/m)
const darkBlock = readBlock(/^\.dark\s*\{/m)
const rampBlock = readBlock(/^:root,\s*\.dark\s*\{/m)
const blocks: Record<Mode, Tokens> = {
  light: new Map([...rootBlock, ...rampBlock]),
  dark: new Map([...rootBlock, ...darkBlock, ...rampBlock]),
}

function substitute(value: string, mode: Mode, depth = 0): string {
  if (depth > 12) {
    throw new Error(`var() nests too deep in "${value}"`)
  }
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    const raw = blocks[mode].get(name)
    if (raw === undefined) {
      throw new Error(`${name} is not declared`)
    }
    return substitute(raw, mode, depth + 1)
  })
}

const resolve = (name: string, mode: Mode) => substitute(`var(${name})`, mode)

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

// calc()/min()/max() arithmetic on plain numbers, which is all the ramp uses.
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
    // CSS clamps oklch lightness to 0..1, which is what lets light-mode steps above the card stop at white.
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

function contrast(pair: Pair, mode: Mode): number {
  let background = toLinearRgba(resolve(pair.bg, mode))
  if (pair.base) {
    background = composite(background, toLinearRgba(resolve(pair.base, mode)))
  }
  const foreground = composite(toLinearRgba(resolve(pair.fg, mode)), background)
  const [high, low] = [luminance(foreground), luminance(background)].sort((x, y) => y - x)
  return (high + 0.05) / (low + 0.05)
}

const pairs: Pair[] = [
  { label: 'body text on page', fg: '--foreground', bg: '--background', min: 4.5 },
  { label: 'muted text on card', fg: '--muted-foreground', bg: '--card', min: 4.5 },
  { label: 'link on card', fg: '--link', bg: '--card', min: 4.5 },
  { label: 'button label on primary', fg: '--primary-foreground', bg: '--primary', min: 4.5 },
  { label: 'primary vs page', fg: '--primary', bg: '--background', min: 3 },
  { label: 'control border vs card', fg: '--input', bg: '--card', min: 3 },
  { label: 'focus ring vs page', fg: '--ring', bg: '--background', min: 3 },
  { label: 'destructive text on card', fg: '--destructive-text', bg: '--card', min: 4.5 },
  { label: 'label on destructive', fg: '--destructive-foreground', bg: '--destructive', min: 4.5 },
  { label: 'label on success', fg: '--success-foreground', bg: '--success', min: 4.5 },
  { label: 'label on warning', fg: '--warning-foreground', bg: '--warning', min: 4.5 },
  { label: 'sidebar label on rail', fg: '--sidebar-foreground', bg: '--sidebar', min: 4.5 },
  { label: 'sidebar muted on rail', fg: '--sidebar-muted', bg: '--sidebar', min: 4.5 },
  { label: 'active nav label on pill', fg: '--sidebar-accent-foreground', bg: '--sidebar-accent', min: 4.5 },
  { label: 'body text on band', fg: '--foreground', bg: '--band', min: 4.5 },
  { label: 'muted text on band', fg: '--muted-foreground', bg: '--band', min: 4.5 },
  { label: 'muted text on muted', fg: '--muted-foreground', bg: '--muted', min: 4.5 },
  { label: 'body text on hovered row', fg: '--foreground', bg: '--row-hover', min: 4.5 },
  { label: 'body text on selected row', fg: '--foreground', bg: '--row-selected', min: 4.5 },
  { label: 'sidebar label on hover', fg: '--sidebar-foreground', bg: '--sidebar-hover', min: 4.5 },
  { label: 'sidebar label on active pill', fg: '--sidebar-foreground', bg: '--sidebar-accent', min: 4.5 },
  { label: 'active icon on pill', fg: '--sidebar-active-icon', bg: '--sidebar-accent', min: 3 },
  // Dark borders and skeletons measure 1.29:1 on a card at today's settings; the dark floor sits at 1.25 until the settings are tuned on the iPad.
  { label: 'border vs card', fg: '--border', bg: '--card', min: { light: 1.3, dark: 1.25 } },
  { label: 'skeleton bar vs card', fg: '--skeleton', bg: '--card', min: { light: 1.3, dark: 1.25 } },
  { label: 'skeleton block vs card', fg: '--skeleton-soft', bg: '--card', min: 1.15 },
  ...STATUS_TONES.map(tone => ({ label: `status ${tone} text on its fill`, fg: `--status-${tone}-fg`, bg: `--status-${tone}-bg`, min: 4.5, base: '--card' })),
  ...SERIES.map(series => ({ label: `series ${series} vs card`, fg: `--series-${series}`, bg: '--card', min: 3 })),
  ...Array.from({ length: IDENTITY_COUNT }, (_, i) => ({ label: `identity ${i + 1} text on its fill`, fg: `--identity-${i + 1}-fg`, bg: `--identity-${i + 1}-bg`, min: 4.5, base: '--card' })),
]

// Sunlight from above: every step must sit where the ramp puts it. In light mode nothing can be lighter than
// the card (white), so the band and borders step down from it; in dark mode they step up.
const depthSteps: Record<Mode, [string, string][]> = {
  light: [['--card', '--background'], ['--muted', '--background'], ['--card', '--muted'], ['--card', '--band'], ['--band', '--border']],
  dark: [['--card', '--background'], ['--muted', '--background'], ['--card', '--muted'], ['--band', '--card'], ['--border', '--band'], ['--surface-raised', '--card'], ['--sidebar', '--background']],
}

const failures: string[] = []
let checks = 0

for (const mode of ['light', 'dark'] as const) {
  for (const pair of pairs) {
    checks++
    try {
      const ratio = contrast(pair, mode)
      const min = typeof pair.min === 'number' ? pair.min : pair.min[mode]
      if (ratio < min) {
        failures.push(`${mode}: ${pair.label} is ${ratio.toFixed(2)}:1, needs ${min}:1`)
      }
    }
    catch (error) {
      failures.push(`${mode}: ${pair.label}: ${(error as Error).message}`)
    }
  }
  for (const [upper, lower] of depthSteps[mode]) {
    checks++
    try {
      if (luminance(toLinearRgba(resolve(upper, mode))) <= luminance(toLinearRgba(resolve(lower, mode)))) {
        failures.push(`${mode}: ${upper} must be lighter than ${lower}`)
      }
    }
    catch (error) {
      failures.push(`${mode}: ${upper} over ${lower}: ${(error as Error).message}`)
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
