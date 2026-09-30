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
  min: number
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

const blocks: Record<Mode, Tokens> = {
  light: readBlock(/^:root,\s*\.funnel-light\s*\{/m),
  dark: readBlock(/^\.dark\s*\{/m),
}

// `.dark` inherits anything it does not redeclare from `:root`, exactly as the cascade does.
function resolve(name: string, mode: Mode, hops = 0): string {
  const raw = blocks[mode].get(name) ?? blocks.light.get(name)
  if (raw === undefined) {
    throw new Error(`${name} is not declared`)
  }
  const reference = /^var\((--[\w-]+)\)$/.exec(raw)
  return reference && hops < 8 ? resolve(reference[1], mode, hops + 1) : raw
}

// Same oklch → linear sRGB math as the theme studies page, so its ratios reproduce here.
function toLinearRgba(color: string): Rgba {
  const hex = /^#([0-9a-f]{6})$/i.exec(color)
  if (hex) {
    const channel = (offset: number) => {
      const value = Number.parseInt(hex[1].slice(offset, offset + 2), 16) / 255
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
    }
    return [channel(0), channel(2), channel(4), 1]
  }
  const oklch = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+))?\s*\)$/.exec(color)
  if (!oklch) {
    throw new Error(`Cannot parse color "${color}"`)
  }
  const lightness = Number(oklch[1]) / (oklch[2] ? 100 : 1)
  const chroma = Number(oklch[3])
  const hue = (Number(oklch[4]) * Math.PI) / 180
  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)
  const l = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3
  const clamp = (value: number) => Math.min(1, Math.max(0, value))
  return [
    clamp(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    clamp(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    clamp(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
    oklch[5] ? Number(oklch[5]) : 1,
  ]
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
  ...STATUS_TONES.map(tone => ({ label: `status ${tone} text on its fill`, fg: `--status-${tone}-fg`, bg: `--status-${tone}-bg`, min: 4.5, base: '--card' })),
  ...SERIES.map(series => ({ label: `series ${series} vs card`, fg: `--series-${series}`, bg: '--card', min: 3 })),
  ...Array.from({ length: IDENTITY_COUNT }, (_, i) => ({ label: `identity ${i + 1} text on its fill`, fg: `--identity-${i + 1}-fg`, bg: `--identity-${i + 1}-bg`, min: 4.5, base: '--card' })),
]

// Each surface step must read as a step: the card sits above the page in both modes, and in dark mode
// the raised surface sits above the card (today's dark cards are darker than the page).
const depthSteps: Record<Mode, [string, string][]> = {
  light: [['--card', '--background']],
  dark: [['--card', '--background'], ['--surface-raised', '--card']],
}

const failures: string[] = []
let checks = 0

for (const mode of ['light', 'dark'] as const) {
  for (const pair of pairs) {
    checks++
    try {
      const ratio = contrast(pair, mode)
      if (ratio < pair.min) {
        failures.push(`${mode}: ${pair.label} is ${ratio.toFixed(2)}:1, needs ${pair.min}:1`)
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
