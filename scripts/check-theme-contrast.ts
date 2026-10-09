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
  /** Caps a pair that has to stay quiet. */
  max?: number
  /** Resolves a translucent `bg` against this token first (e.g. a pill fill over the card). */
  base?: string
  /** Surface-relative pairs are checked on every place listed; the rest on the page only. */
  on?: Place[]
  /** Checked in both schemes unless narrowed here. */
  modes?: Mode[]
}

const STATUS_TONES = ['info', 'pending', 'attention', 'action', 'success', 'danger', 'idle'] as const
const TILE_TONES = ['attention', 'success', 'danger'] as const
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
const mediaBlock = readBlock(/^:root\s*\{(?=[^{}]*--on-media)/m)

const PLACES: Record<Place, Tokens> = {
  'beneath': beneathBlock,
  'page': new Map(),
  'rung 1': new Map([['--depth', '1']]),
  'rung 2': new Map([['--depth', '2']]),
  'rung 3': new Map([['--depth', '3']]),
  'overlay': overlayBlock,
}
const CARDS: Place[] = ['rung 1', 'rung 2', 'rung 3']

// Ink over a photo can't lean on the photo: its pixels are unknown, and the worst case for light ink is a white one
// (a sky, a stucco wall, a lit window). Each veil strength is checked as the scrim at that alpha composited over white,
// the same color-mix Tailwind writes for `bg-scrim/NN`.
const VEIL_STRENGTHS = [50, 60, 70] as const
const PHOTO_PROBES: Tokens = new Map([
  ['--photo-white', 'white'],
  ...VEIL_STRENGTHS.map((alpha): [string, string] => [`--scrim-${alpha}`, `color-mix(in oklab, var(--scrim) ${alpha}%, transparent)`]),
])

function tokensFor(mode: Mode, place: Place): Tokens {
  return new Map([...rootBlock, ...(mode === 'dark' ? darkBlock : []), ...pageBlock, ...relativeBlock, ...mediaBlock, ...PHOTO_PROBES, ...PLACES[place]])
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

const KEYWORDS: Record<string, Oklab> = { black: [0, 0, 0, 1], white: [1, 0, 0, 1], transparent: [0, 0, 0, 0] }

function toOklab(color: string): Oklab {
  const keyword = KEYWORDS[color.trim()]
  if (keyword) {
    return keyword
  }
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
  // color-mix interpolates premultiplied: mixing into `transparent` keeps the colour and only thins its alpha.
  const alpha = a[3] * weightA + b[3] * weightB
  if (alpha === 0) {
    return [0, 0, 0, 0]
  }
  const channel = (i: number) => (a[i] * a[3] * weightA + b[i] * b[3] * weightB) / alpha
  return [channel(0), channel(1), channel(2), alpha]
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

const encode = (value: number) => (value <= 0.0031308 ? value * 12.92 : 1.055 * value ** (1 / 2.4) - 0.055)
const decode = (value: number) => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)

// Browsers blend a translucent fill in gamma-encoded sRGB, not in linear light.
function composite(top: Rgba, bottom: Rgba): Rgba {
  const alpha = top[3]
  return [0, 1, 2].map(i => decode(encode(top[i]) * alpha + encode(bottom[i]) * (1 - alpha))).concat(1) as Rgba
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
  { label: 'checkbox, radio and switch edge vs surface', fg: '--indicator', bg: '--card', min: 3, on: ON_SURFACES },
  // A field is filled with its own surface, so its edge alone marks it: about 2:1 keeps a search box from vanishing
  // into a toolbar without the old 3:1 grid of dark boxes. The focus ring carries the 3:1 state change.
  { label: 'field edge vs its surface', fg: '--input', bg: '--card', min: 1.9, on: ON_SURFACES },
  // A hovered field firms its edge but never reaches the indicator's 3:1; the owner finds a field boxed at 3:1 harsh.
  { label: 'hovered field edge vs its surface', fg: '--input-hover', bg: '--card', min: 2.2, max: 2.95, on: ON_SURFACES },
  { label: 'body text on band', fg: '--foreground', bg: '--band', min: 4.5, on: ['page', ...CARDS] },
  { label: 'muted text on band', fg: '--muted-foreground', bg: '--band', min: 4.5, on: ['page', ...CARDS] },
  { label: 'body text on hovered row', fg: '--foreground', bg: '--row-hover', min: 4.5, on: ON_SURFACES },
  { label: 'body text on selected row', fg: '--foreground', bg: '--row-selected', min: 4.5, on: ON_SURFACES },
  { label: 'body text on active tab', fg: '--foreground', bg: '--tab-active', min: 4.5, on: ON_SURFACES },
  { label: 'muted text on tab track', fg: '--muted-foreground', bg: '--tab-track', min: 4.5, on: ON_SURFACES },
  // A switch's state is its fill. 1.15 is the selected-control floor; below it the tabs read as one strip with a
  // faint smudge. Near black (a dark page) luminance runs out first, so that is where the floor binds.
  { label: 'active tab vs its track', fg: '--tab-active', bg: '--tab-track', min: 1.15, on: ON_SURFACES },
  // The label brightening carries hover too, so the wash may sit a touch under the surface floor on the darkest well.
  { label: 'hovered tab vs its track', fg: '--hover', bg: '--tab-track', min: 1.08, on: ON_SURFACES },
  // The label says it too: an inactive label is muted, and that has to read as a different weight of ink.
  { label: 'active label vs an inactive label', fg: '--foreground', bg: '--muted-foreground', min: 1.5 },
  { label: 'body text on hover wash', fg: '--foreground', bg: '--hover', base: '--card', min: 4.5, on: ON_SURFACES },
  { label: 'muted text on hover wash', fg: '--muted-foreground', bg: '--hover', base: '--card', min: 4.5, on: ON_SURFACES },
  { label: 'body text on press wash', fg: '--foreground', bg: '--press', base: '--card', min: 4.5, on: ON_SURFACES },
  { label: 'label on hovered secondary', fg: '--secondary-foreground', bg: '--secondary-hover', min: 4.5, on: ON_SURFACES },
  // Edges are the owner's pick (`--edge`, tuned by eye with the elevation-ladder skill). These floors only catch a
  // retune that makes them vanish; the picks of 2026-10-05 measure 1.14–1.16 light and 1.21–1.34 dark on cards.
  { label: 'edge vs its surface', fg: '--border', bg: '--card', min: 1.1, on: [...CARDS, 'overlay'] },
  { label: 'grid line vs its surface', fg: '--grid-line', bg: '--card', min: 1.18, on: [...CARDS, 'overlay'] },
  { label: 'axis vs its surface', fg: '--axis', bg: '--card', min: 1.28, on: [...CARDS, 'overlay'] },
  // An outline button is filled a rung above what it sits on. On the page that is the canvas, not a card. An overlay
  // is the top rung, so a button in a menu has no rung left to climb and is not checked there.
  { label: 'outline button fill vs the page', fg: '--control', bg: '--background', min: 1.06 },
  { label: 'outline button fill vs its surface', fg: '--control', bg: '--card', min: 1.06, on: CARDS },
  // A button's edge is a quiet outline, not a field's 2:1 box: its fill and shadow already lift it. The caps catch a
  // retune that brings back the bold toolbar of boxes the owner rejected on 2026-10-07.
  { label: 'outline button edge vs its fill', fg: '--control-border', bg: '--control', min: 1.25, max: 1.5, on: ['page', ...CARDS] },
  // Stronger than a card's own edge (1.14–1.34), so a button reads as standing on the card, not drawn on it.
  { label: 'outline button edge vs its surface', fg: '--control-border', bg: '--card', min: 1.2, on: CARDS },
  // Segmented tracks and button capsules take the button's edge. The edge is taken off the rung above the surface and
  // the track sinks below it, so light's deepest rungs bring the two closest and dark's sunken track sits furthest off.
  { label: 'segmented track edge vs its track', fg: '--control-border', bg: '--tab-track', min: 1.12, max: 2, on: ['page', ...CARDS] },
  { label: 'selected control vs its rest fill', fg: '--control-selected', bg: '--control', min: 1.15, on: ['page', ...CARDS] },
  { label: 'label on a selected control', fg: '--foreground', bg: '--control-selected', min: 4.5, on: ['page', ...CARDS] },
  // Proposal surfaces put ordinary ink on tone fills (the agent's internal numbers, a section's incentive card) and on
  // selected rows (an open scope section, the active agreement step's disc).
  { label: 'body text on the danger fill', fg: '--foreground', bg: '--status-danger-bg', base: '--card', min: 4.5, on: CARDS },
  { label: 'muted text on the danger fill', fg: '--muted-foreground', bg: '--status-danger-bg', base: '--card', min: 4.5, on: CARDS },
  { label: 'body text on the success fill', fg: '--foreground', bg: '--status-success-bg', base: '--card', min: 4.5, on: CARDS },
  { label: 'muted text on the success fill', fg: '--muted-foreground', bg: '--status-success-bg', base: '--card', min: 4.5, on: CARDS },
  { label: 'body text on a selected row', fg: '--foreground', bg: '--row-selected', min: 4.5, on: CARDS },
  { label: 'muted text on a selected row', fg: '--muted-foreground', bg: '--row-selected', min: 4.5, on: CARDS },
  { label: 'primary icon on a selected row', fg: '--primary', bg: '--row-selected', min: 3, on: CARDS },
  { label: 'hovered outline button vs its fill', fg: '--control-hover', bg: '--control', min: 1.1, on: ['page', ...CARDS] },
  // Near black the first step reads weakest, so dark mode's lift has to keep a card off the page.
  { label: 'card vs the page', fg: '--card', bg: '--background', min: 1.1, on: ['rung 1'], modes: ['dark'] },
  { label: 'skeleton bar vs its surface', fg: '--skeleton', bg: '--card', min: 1.1, on: [...CARDS, 'overlay'] },
  { label: 'skeleton block vs its surface', fg: '--skeleton-soft', bg: '--card', min: 1.07, on: [...CARDS, 'overlay'] },
  // A hover has to show: the wash on its surface, and a filled button against its own rest colour.
  { label: 'hover wash vs its surface', fg: '--hover', bg: '--card', min: 1.1, on: ON_SURFACES },
  { label: 'hovered secondary vs secondary', fg: '--secondary-hover', bg: '--secondary', min: 1.1, on: ON_SURFACES },
  { label: 'hovered primary vs primary', fg: '--primary-hover', bg: '--primary', min: 1.15 },
  { label: 'button label on primary', fg: '--primary-foreground', bg: '--primary', min: 4.5 },
  { label: 'button label on hovered primary', fg: '--primary-foreground', bg: '--primary-hover', min: 4.5 },
  { label: 'label on hovered destructive', fg: '--destructive-foreground', bg: '--destructive-hover', min: 4.5 },
  // Records: proposal tiles are filled with their status tone and hover a solid step off it; their secondary lines are
  // muted ink and the icon sits on a muted square. A draft tile hovers like a row.
  ...TILE_TONES.flatMap(tone => [
    { label: `status ${tone} text on its hovered tile`, fg: `--status-${tone}-fg`, bg: `--status-${tone}-hover`, min: 4.5, on: CARDS },
    { label: `muted text on the ${tone} tile`, fg: '--muted-foreground', bg: `--status-${tone}-bg`, min: 4.5, on: CARDS },
    { label: `muted text on the hovered ${tone} tile`, fg: '--muted-foreground', bg: `--status-${tone}-hover`, min: 4.5, on: CARDS },
    { label: `hovered ${tone} tile vs its fill`, fg: `--status-${tone}-hover`, bg: `--status-${tone}-bg`, min: 1.1, on: CARDS },
    { label: `status ${tone} icon on its icon square`, fg: `--status-${tone}-fg`, bg: '--muted', min: 3, on: CARDS },
  ]),
  { label: 'muted text on a hovered row', fg: '--muted-foreground', bg: '--row-hover', min: 4.5, on: ON_SURFACES },
  // An upcoming meeting's row is filled solid with the pending tone, so the row's ink sits on it.
  { label: 'body text on an upcoming row', fg: '--foreground', bg: '--status-pending-bg', min: 4.5, on: CARDS },
  { label: 'muted text on an upcoming row', fg: '--muted-foreground', bg: '--status-pending-bg', min: 4.5, on: CARDS },
  // A filter chip is filled like an outline button, and its label is part muted.
  { label: 'muted text on an outline button', fg: '--muted-foreground', bg: '--control', min: 4.5, on: ['page', ...CARDS] },
  { label: 'muted text on a hovered outline button', fg: '--muted-foreground', bg: '--control-hover', min: 4.5, on: ['page', ...CARDS] },
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
  // The theme switch: its sun and moon glyphs sit in the groove, and the thumb has to lift out of it.
  { label: 'rail glyph on the switch groove', fg: '--sidebar-muted', bg: '--sidebar-groove', min: 3 },
  { label: 'rail switch thumb vs its groove', fg: '--sidebar-accent', bg: '--sidebar-groove', min: 1.3 },
  { label: 'switch thumb vs the off track', fg: '--switch-thumb', bg: '--indicator', min: 2.5 },
  { label: 'switch thumb vs the on track', fg: '--switch-thumb-checked', bg: '--primary', min: 3 },
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
  ...ON_SURFACES.map((place): [[string, Place], [string, Place]] => [['--tab-track', place], ['--tab-active', place]]),
]

// A selected row has to stand further from its surface than a hovered one, or hover reads as the selection; a
// hovered field's edge further than its resting edge, or the hover doesn't show.
const outranks: [string, string][] = [['--row-selected', '--row-hover'], ['--input-hover', '--input']]
function distanceFromSurface(name: string, mode: Mode, place: Place) {
  const [l1, a1, b1] = toOklab(resolve(name, mode, place))
  const [l2, a2, b2] = toOklab(resolve('--card', mode, place))
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2)
}

// In light mode an edge is darker than its surface; in dark mode, lighter.
const edgeLeans: Record<Mode, 'darker' | 'lighter'> = { light: 'darker', dark: 'lighter' }

// Over media the floors are the veil strengths DESIGN.md promises: body ink from 60%, muted ink from 70%, and icons,
// large text and control glyphs (WCAG's 3:1) from 50%. Without a photo the veil is solid and both inks clear 4.5:1.
const mediaPairs: Pair[] = [
  { label: 'on-media text on a 60% veil over a white photo', fg: '--on-media', bg: '--scrim-60', base: '--photo-white', min: 4.5 },
  { label: 'on-media muted text on a 70% veil over a white photo', fg: '--on-media-muted', bg: '--scrim-70', base: '--photo-white', min: 4.5 },
  { label: 'on-media icon or large text on a 50% veil over a white photo', fg: '--on-media', bg: '--scrim-50', base: '--photo-white', min: 3 },
  { label: 'on-media muted text on the solid scrim', fg: '--on-media-muted', bg: '--scrim', min: 4.5 },
]

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
  for (const pair of [...pairs, ...mediaPairs].filter(pair => !pair.modes || pair.modes.includes(mode))) {
    for (const place of pair.on ?? ['page']) {
      guard(`${mode}: ${pair.label} (${place})`, () => {
        const ratio = contrast(pair, mode, place)
        if (ratio < pair.min) {
          return `${mode}: ${pair.label} (${place}) is ${ratio.toFixed(2)}:1, needs ${pair.min}:1`
        }
        return pair.max !== undefined && ratio > pair.max ? `${mode}: ${pair.label} (${place}) is ${ratio.toFixed(2)}:1, keep it under ${pair.max}:1` : undefined
      })
    }
  }
  for (const [[lower, lowerPlace], [upper, upperPlace]] of climb) {
    guard(`${mode}: ${upper} (${upperPlace}) over ${lower} (${lowerPlace})`, () =>
      luminanceOf(upper, mode, upperPlace) <= luminanceOf(lower, mode, lowerPlace)
        ? `${mode}: ${upper} (${upperPlace}) must be lighter than ${lower} (${lowerPlace})`
        : undefined)
  }
  for (const [stronger, weaker] of outranks) {
    for (const place of ON_SURFACES) {
      guard(`${mode}: ${stronger} vs ${weaker} (${place})`, () =>
        distanceFromSurface(stronger, mode, place) <= distanceFromSurface(weaker, mode, place)
          ? `${mode}: ${stronger} (${place}) must sit further from its surface than ${weaker}`
          : undefined)
    }
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
