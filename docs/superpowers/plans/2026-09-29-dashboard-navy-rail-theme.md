# Navy Rail Theme (Part A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the whole app on the Navy Rail (Harbor, floating) token set: navy rail, one logo-derived action blue, a real surface ramp in both modes, seven status tones, navy-tinted elevation, chart tokens, and the 2px type ramp. Guards in code keep it that way.

**Architecture:** Every color is decided once in `src/app/(frontend)/globals.css` (`:root` / `.dark`) and exposed through `@theme inline` as utilities. `src/shared/constants/status-tones.ts` is the single place that turns a stage/status key into tone utility classes; the ~15 existing maps keep their exported names and shapes and are rewritten to read from it. A `pnpm theme:check` script proves every contrast pair and the 2px rule from the CSS itself, and two ESLint guards ban raw palette classes and literal font sizes.

**Tech Stack:** Next.js 15, Tailwind v4 (`@theme inline`), shadcn/ui sidebar, TypeScript, `tsx` scripts, ESLint flat config (`@antfu/eslint-config`), Playwright MCP for captures.

**Spec:** `docs/superpowers/specs/2026-09-29-dashboard-navy-rail-theme-design.md` (Part A only; Part B is a brief for a separate session and is **not** in this plan).

## Global Constraints

- Verification is `pnpm tsc`, `pnpm lint` and `pnpm theme:check`. **Never `pnpm build`.**
- There is no unit-test runner in this repo. Tests here are the `theme:check` script (tokens), the ESLint guards (class usage) and `pnpm tsc` (map shapes). Each task's red/green step uses one of them.
- **Dirty shared tree.** Local `main` is a shared workbench with other uncommitted work, and the index already holds a staged deletion (`D scripts/snapshot-prod-to-dev.ts`) that is not ours.
  - Before editing, run `git status --porcelain -- <each file the task lists>`. A file that already shows ` M` or `??` holds someone else's uncommitted work: edit it in the working tree, **do not commit it**, and list it in the task report.
  - Commit only by explicit path: `git commit -m "<msg>" -- <path> <path> …`. This commits exactly those paths and leaves the foreign staged deletion alone. Never `git add -A`, `git commit -a`, stash, checkout or reset.
  - `package.json` already carries a foreign uncommitted diff (a dependency bump). Task 1 writes the `theme:check` line to the working tree and does **not** commit `package.json`; the final report tells the owner.
- Values in this plan are normative. They are copied from the spec §A4 and proven by `theme:check` (a prototype of the script passed all 69 checks against exactly these blocks). Where the spec left a value open (identity hues, dark shadow steps, chart dark lift), this plan fills it and says so.
- Status colors keep the Stage-Color Rule meanings: red bad, yellow in progress, green converted, purple action, blue neutral. Pipeline stage objects keep `color: '<key>'` (D11); only the map from key to classes changes.
- **2px rule:** every font size is an even number of pixels. The ramp is Tailwind's default steps only: `text-xs` 12 (floor), `text-sm` 14, `text-base` 16, `text-lg` 18, `text-xl` 20, `text-2xl` 24, `text-3xl` 30. No new `--text-*` step. A literal maps to the nearest step; an exact tie rounds up; anything under 12px is `text-xs`.
- Off limits: `src/shared/db/**`, `src/trpc/**`, `**/dal/**`, `**/server/**`, entity services, seeds, and the `.theme-marketing` / `.theme-marketing.theme-dark` blocks in `globals.css`.
- Comments say why, never what. No file banners. No citations of this plan or the spec in code.
- **Guard report** (used by Tasks 7, 8, 10). `pnpm lint` is `next lint`; call ESLint directly with `CI=true` (otherwise `@antfu/eslint-config` detects the editor and disables rules) and read its JSON:
  ```bash
  CI=true pnpm exec eslint src/features src/shared -f json -o /tmp/theme-eslint.json; node -e "
  const rule = process.argv[1], r = require('/tmp/theme-eslint.json')
  const hits = r.flatMap(f => f.messages.filter(m => m.ruleId === rule).map(() => f.filePath.replace(process.cwd() + '/', '')))
  const files = [...new Set(hits)]
  require('fs').writeFileSync('/tmp/' + rule.replace('/', '-') + '.txt', files.join('\\n'))
  console.log(rule + ': ' + hits.length + ' hits in ' + files.length + ' files')" <rule-id>
  ```
  It prints `<rule-id>: N hits in M files` and writes the file list to `/tmp/<rule-id with / as ->.txt`.
- Stale CSS on the long-running dev server: before judging any rendered color, run `ss -ltnp | grep -E ':30[0-9]{2}'` to see which dev servers run (another worktree may own one), stop only this worktree's server, `rm -rf .next`, restart.

## Review Focus

1. **Muted text inside the navy rail.** `text-muted-foreground` (0.47 L) on the navy rail is unreadable, and the rail's user button, search bar and group labels use it today. Expected: everything in the rail reads `text-sidebar-muted` / `text-sidebar-foreground`. Pinned by Task 4 Step 6 (grep that finds zero `muted-foreground` in the rail files) and by the `sidebar muted on rail` pair in `theme:check`.
2. **Dark primary is now a light cyan.** Any `text-white` riding on `bg-primary` becomes white on light cyan in dark mode. Expected: labels on primary use `text-primary-foreground`. Pinned by Task 3 Step 5 (multi-line grep over every `bg-primary` element).
3. **The collapsed (icon) rail and the mobile sheet with `variant="floating"`.** The collapse chevron sits on the panel edge, the floating gap adds `--spacing(4)`, and on phones the same `Sidebar` renders inside a `Sheet`. Expected: no clipped chevron, no doubled inset, navy sheet with readable labels. Pinned by Task 4 Step 8 captures at 1440 (expanded and collapsed) and 390 (sheet open).
4. **Consumers that slice class strings.** `action-card.tsx` and `action-detail-sheet.tsx` read `tierColorMap[color].split(' ')[1]` as the text class. Expected: the rewritten map keeps the order `bg text border`. Pinned by Task 5 Step 6 (a `tsx -e` assertion that index 1 starts with `text-`).
5. **Unknown stage keys.** Action tiers use `color: 'muted'`; kanban and pipeline badges use `indigo`/`cyan`, which no pipeline sets today. Expected: every key resolves to a tone, and an unknown key falls back to `idle` instead of an unstyled column. Pinned by Task 5 Step 6 (`stageTone('nonsense') === 'idle'` and every key used in `src/shared/domains/pipelines/constants/*.ts` and `action-tiers.ts` is in `STAGE_COLOR_TONE`).

---

## File map

| File | Responsibility | Task |
|---|---|---|
| Create `scripts/check-theme-contrast.ts` | Parses `:root`/`.dark` from globals.css; asserts contrast pairs, surface depth, 2px rule | 1 |
| Modify `package.json` (working tree only) | `theme:check` script | 1 |
| Modify `src/app/(frontend)/globals.css` | All tokens (§A4), `@theme inline` exposure, elevation | 2 |
| Modify `src/app/manifest.ts`, `src/app/(frontend)/layout.tsx`, `src/shared/components/splash-screen/splash-screen.tsx` | PWA standalone background `#040f23` | 2 |
| Modify `src/app/(frontend)/dashboard/layout.tsx` | Remove the 35% primary radial glow | 3 |
| Modify `src/shared/components/ui/{input,textarea,input-group,input-otp,multi-select,checkbox,tabs,switch}.tsx`, `src/features/proposal-flow/ui/components/form/index.tsx` | Controls read `--input-background` / `--input` roles | 3 |
| Modify `src/shared/components/ui/sidebar.tsx` | Floating panel radius 18px + `shadow-lg` | 4 |
| Modify `src/features/agent-dashboard/constants/sidebar-styles.ts`, `ui/components/app-sidebar.tsx`, `app-sidebar-skeleton.tsx`, `sidebar-pipeline-item.tsx`, `sidebar-records-group.tsx`, `sidebar-search-bar.tsx`, `sidebar-user-button.tsx` | Navy floating rail, cyan pill, rail-only tokens | 4 |
| Create `src/shared/constants/status-tones.ts` | `StatusTone`, `STAGE_COLOR_TONE`, `stageTone()`, `TONE_CLASSES`, `toneClasses()` | 5 |
| Modify the 14 maps in §A6.4 (listed in Task 5) | Read tones; exported names/shapes unchanged | 5 |
| Modify `src/shared/entities/users/lib/get-user-color.ts` | 8 identity tokens | 6 |
| Modify `src/features/analytics/constants/chart-series.ts`, `ui/components/report/trend-chart.tsx`, `src/features/calculators/remodel-roi-calculator/constants/bill-colors.ts` | Series/categorical tokens from globals | 6 |
| Modify `eslint.config.js` | `theme-tokens/palette` and `theme-tokens/type-ramp` guards | 7, 8 |
| Modify the long-tail palette files (Task 7) and literal font-size files (Task 8) | Semantic tokens by meaning; ramp steps | 7, 8 |
| Modify `DESIGN.md`, `docs/design-system/tokens.md`; create `docs/plans/2026-09-29-dashboard-theme-follow-ups.md` | Docs match the code | 9 |

## Spec corrections (the code wins; all folded back into the spec on 2026-09-29)

- ⚠️ Spec §A6.7 says "`ui/chart.tsx` hex literals move to tokens". The only hex in `src/shared/components/ui/chart.tsx:70` are recharts **attribute selectors** (`[stroke='#ccc']`, `[stroke='#fff']`) that match recharts' own defaults; they set no color. They stay.
- ⚠️ Spec §A6.10 names `manifest.ts` and `layout.tsx` for the PWA hex, but `src/shared/components/splash-screen/splash-screen.tsx:115` also paints `#09090b`. Task 2 changes all three.
- ⚠️ Spec §A6.5 asks for eight identity hues but gives no values, and today's palette has ten. Task 6 uses eight (values below, proven by `theme:check`). A rep's avatar hue can change once, because the hash now runs modulo 8.
- ⚠️ Spec §A8 says the pinned "FRESH" badge moves to `sidebar-primary` tokens. `--sidebar-primary` is navy, which is invisible on the navy rail at rest. Task 4 uses `text-sidebar-accent` (cyan) at rest and `text-sidebar-primary` (navy) when the badge sits on the active cyan pill.
- Spec §A7 asks the build to confirm stage `color` keys are not database values: `grep -rn color src/shared/db/schema/` returns nothing (checked 2026-09-29), so they are TypeScript constants only.
- The contrast guard also checks `--sidebar-muted` on the rail and every identity pair; the spec's list did not name them, but they are text on a fill.

---

### Task 1: Theme contrast and 2px-rule guard

**Files:**
- Create: `scripts/check-theme-contrast.ts`
- Modify (working tree only, do not commit): `package.json` (`scripts`)

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm theme:check` (exit 0 = pass). It reads the blocks `/^:root,\s*\.funnel-light\s*\{/m` and `/^\.dark\s*\{/m` of `src/app/(frontend)/globals.css`, or a CSS path passed as the first argument. It requires these tokens in both modes: `--foreground --background --card --muted-foreground --link --primary --primary-foreground --input --ring --destructive --destructive-foreground --destructive-text --success --success-foreground --warning --warning-foreground --sidebar --sidebar-foreground --sidebar-muted --sidebar-accent --sidebar-accent-foreground --surface-raised`, `--status-<tone>-{fg,bg}` for the 7 tones, `--series-{leads,booked,sits,sales}`, `--identity-<1..8>-{fg,bg}`.

- [ ] **Step 1: Write the script**

Create `scripts/check-theme-contrast.ts` with exactly:

```ts
import { readFileSync } from 'node:fs'
import path from 'node:path'

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
```

- [ ] **Step 2: Add the package script (working tree only)**

In `package.json` `"scripts"`, after `"tsc": "tsc --noEmit",` add:

```json
    "theme:check": "tsx scripts/check-theme-contrast.ts",
```

- [ ] **Step 3: Run it against today's tokens and watch it fail**

Run: `pnpm theme:check`
Expected: exit 1, first line `theme:check: 54 of 69 checks failed`, including `light: link on card: --link is not declared` and `light: button label on primary is 3.68:1, needs 4.5:1`.

- [ ] **Step 4: Prove the 2px rule branch fires**

Run:
```bash
{ cat 'src/app/(frontend)/globals.css'; echo '@theme inline { --text-probe: 0.8125rem; }'; } > /tmp/theme-probe.css && pnpm exec tsx scripts/check-theme-contrast.ts /tmp/theme-probe.css | grep 'type ramp'; rm /tmp/theme-probe.css
```
Expected: `type ramp: --text-probe is 13px; every step must be an even number of pixels`.

- [ ] **Step 5: Lint the script and commit**

Run: `CI=true pnpm exec eslint scripts/check-theme-contrast.ts` → no errors (fix formatting with `CI=true pnpm exec eslint --fix scripts/check-theme-contrast.ts`).

```bash
git commit -m "chore(theme): contrast and 2px type-rule guard for the app tokens" -- scripts/check-theme-contrast.ts
```

(`package.json` stays uncommitted; see Global Constraints.)

---

### Task 2: Navy Rail tokens in globals.css

**Files:**
- Modify: `src/app/(frontend)/globals.css` (the `:root, .funnel-light` block, lines 6–80 today; the `.dark` block, lines 251–319; the `@theme inline` block from line 321)
- Modify: `src/app/manifest.ts:14`, `src/app/(frontend)/layout.tsx:137-141`, `src/shared/components/splash-screen/splash-screen.tsx:115`

**Interfaces:**
- Consumes: `pnpm theme:check` (Task 1).
- Produces (utilities later tasks use): `bg-surface-raised`, `text-link`, `border-border-strong`, `bg-input-background`, `text-destructive-text`, `text-sidebar-muted`, `bg-sidebar-hover`, `{text,bg,border,ring,fill,stroke}-status-<tone>-{fg,bg,dot}` for tones `info pending attention action success danger idle`, `bg-identity-<1..8>-{bg,fg,ring}` / `text-…` / `ring-…`, and `var(--series-*)`, `var(--chart-1..5)`, `bg-chart-1..5`.

- [ ] **Step 1: Replace the color declarations of `:root, .funnel-light`**

In the `:root, .funnel-light { … }` block, keep `color-scheme: light;`, the three `--popover-glass*` declarations **with their comments**, `--radius`, `--tracking-normal` and `--spacing`. Delete every other declaration (`--background` through `--sidebar-ring`, the six `--shadow-x/-y/-blur/-spread/-opacity/-color` knobs, which nothing reads — `grep -rn 'var(--shadow-\(x\|y\|blur\|spread\|opacity\|color\))' src` returns nothing — and the old `--shadow-2xs … --shadow-2xl`). Insert right after `color-scheme: light;`:

```css
  --brand-cyan: #03afed;
  --brand-cyan-bright: oklch(0.8 0.12 228);
  --brand-blue: oklch(0.5 0.15 243);
  --brand-navy: oklch(0.215 0.072 262);
  --brand-navy-deep: oklch(0.13 0.05 262);
  --background: oklch(0.965 0.009 246);
  --foreground: oklch(0.235 0.045 258);
  --card: oklch(1 0 0);
  --card-foreground: var(--foreground);
  --popover: oklch(1 0 0);
  --popover-foreground: var(--foreground);
  --surface-raised: oklch(0.978 0.006 250);
  --primary: var(--brand-blue);
  --primary-foreground: oklch(1 0 0);
  --secondary: oklch(0.955 0.008 250);
  --secondary-foreground: var(--foreground);
  --muted: oklch(0.955 0.008 250);
  --muted-foreground: oklch(0.47 0.03 256);
  --accent: oklch(0.955 0.012 250);
  --accent-foreground: var(--foreground);
  --link: oklch(0.47 0.14 243);
  --destructive: oklch(0.53 0.19 27);
  --destructive-foreground: oklch(1 0 0);
  --destructive-text: oklch(0.49 0.17 27);
  --success: var(--status-success-fg);
  --success-foreground: oklch(1 0 0);
  --warning: var(--status-pending-fg);
  --warning-foreground: oklch(1 0 0);
  --border: oklch(0.905 0.012 252);
  --border-strong: oklch(0.84 0.015 252);
  --input: oklch(0.62 0.03 255);
  --input-background: oklch(1 0 0);
  --ring: oklch(0.58 0.15 238);
  --sidebar: var(--brand-navy);
  --sidebar-foreground: oklch(0.93 0.015 250);
  --sidebar-muted: oklch(0.74 0.05 250);
  --sidebar-primary: oklch(0.2 0.07 262);
  --sidebar-primary-foreground: oklch(0.19 0.045 258);
  --sidebar-accent: var(--brand-cyan-bright);
  --sidebar-accent-foreground: oklch(0.2 0.07 262);
  --sidebar-hover: oklch(1 0 0 / 0.06);
  --sidebar-border: oklch(0.29 0.075 262);
  --sidebar-ring: var(--brand-cyan-bright);
  --status-info-fg: oklch(0.44 0.08 252);
  --status-info-bg: oklch(0.945 0.02 250);
  --status-info-dot: oklch(0.60 0.09 250);
  --status-pending-fg: oklch(0.46 0.095 72);
  --status-pending-bg: oklch(0.955 0.05 88);
  --status-pending-dot: oklch(0.76 0.15 82);
  --status-attention-fg: oklch(0.49 0.14 45);
  --status-attention-bg: oklch(0.95 0.035 55);
  --status-attention-dot: oklch(0.67 0.17 48);
  --status-action-fg: oklch(0.46 0.16 300);
  --status-action-bg: oklch(0.95 0.03 300);
  --status-action-dot: oklch(0.60 0.18 300);
  --status-success-fg: oklch(0.45 0.11 152);
  --status-success-bg: oklch(0.95 0.04 152);
  --status-success-dot: oklch(0.64 0.15 152);
  --status-danger-fg: oklch(0.49 0.17 27);
  --status-danger-bg: oklch(0.95 0.025 25);
  --status-danger-dot: oklch(0.61 0.20 27);
  --status-idle-fg: oklch(0.46 0.02 255);
  --status-idle-bg: oklch(0.94 0.008 255);
  --status-idle-dot: oklch(0.66 0.02 255);
  --series-leads: oklch(0.66 0.12 228);
  --series-booked: oklch(0.56 0.14 236);
  --series-sits: oklch(0.46 0.14 245);
  --series-sales: oklch(0.3 0.075 258);
  --series-neutral-strong: oklch(0.4 0.03 256);
  --series-neutral-soft: oklch(0.66 0.02 255);
  --chart-1: oklch(0.52 0.15 243);
  --chart-2: oklch(0.58 0.1 190);
  --chart-3: oklch(0.7 0.14 72);
  --chart-4: oklch(0.55 0.16 300);
  --chart-5: oklch(0.55 0.03 255);
  --identity-1-bg: oklch(0.93 0.045 25);
  --identity-1-fg: oklch(0.43 0.11 25);
  --identity-1-ring: oklch(0.66 0.13 25);
  --identity-2-bg: oklch(0.93 0.045 70);
  --identity-2-fg: oklch(0.43 0.11 70);
  --identity-2-ring: oklch(0.66 0.13 70);
  --identity-3-bg: oklch(0.93 0.045 115);
  --identity-3-fg: oklch(0.43 0.11 115);
  --identity-3-ring: oklch(0.66 0.13 115);
  --identity-4-bg: oklch(0.93 0.045 155);
  --identity-4-fg: oklch(0.43 0.11 155);
  --identity-4-ring: oklch(0.66 0.13 155);
  --identity-5-bg: oklch(0.93 0.045 200);
  --identity-5-fg: oklch(0.43 0.11 200);
  --identity-5-ring: oklch(0.66 0.13 200);
  --identity-6-bg: oklch(0.93 0.045 245);
  --identity-6-fg: oklch(0.43 0.11 245);
  --identity-6-ring: oklch(0.66 0.13 245);
  --identity-7-bg: oklch(0.93 0.045 290);
  --identity-7-fg: oklch(0.43 0.11 290);
  --identity-7-ring: oklch(0.66 0.13 290);
  --identity-8-bg: oklch(0.93 0.045 335);
  --identity-8-fg: oklch(0.43 0.11 335);
  --identity-8-ring: oklch(0.66 0.13 335);
```

Then, after `--radius: 0.5rem;`, insert the light elevation ramp:

```css
  --shadow-2xs: 0 1px 2px oklch(0.25 0.05 258 / 0.06);
  --shadow-xs: 0 1px 2px oklch(0.25 0.05 258 / 0.06);
  --shadow-sm: 0 1px 2px oklch(0.25 0.05 258 / 0.06), 0 4px 12px -6px oklch(0.25 0.05 258 / 0.12);
  --shadow: 0 1px 2px oklch(0.25 0.05 258 / 0.06), 0 4px 12px -6px oklch(0.25 0.05 258 / 0.12);
  --shadow-md: 0 1px 2px oklch(0.25 0.05 258 / 0.06), 0 4px 12px -6px oklch(0.25 0.05 258 / 0.12), 0 10px 24px -12px oklch(0.25 0.05 258 / 0.16);
  --shadow-lg: 0 16px 36px -14px oklch(0.2 0.06 258 / 0.35), 0 4px 10px -4px oklch(0.2 0.06 258 / 0.15);
  --shadow-xl: 0 16px 36px -14px oklch(0.2 0.06 258 / 0.35), 0 4px 10px -4px oklch(0.2 0.06 258 / 0.15);
  --shadow-2xl: 0 16px 36px -14px oklch(0.2 0.06 258 / 0.35), 0 4px 10px -4px oklch(0.2 0.06 258 / 0.15);
```

Replace the light `--popover-glass-shadow` value (keep its comment) with the navy-tinted four layers:

```css
  --popover-glass-shadow:
    inset 0 1px 0 oklch(1 0 0 / 0.7), inset 0 0 0 1px oklch(0.25 0.05 258 / 0.08), 0 20px 40px -12px oklch(0.2 0.06 258 / 0.25),
    0 6px 16px -8px oklch(0.2 0.06 258 / 0.12);
```

Add one why-comment above `--brand-cyan`:

```css
  /* The raw logo color is identity only (logo, browser theme-color): as text on light it fails contrast. */
```

- [ ] **Step 2: Replace the color declarations of `.dark`**

In `.dark { … }`, keep `color-scheme: dark;`, `--popover-glass-overlay`, `--popover-glass-shadow` (unchanged; it is already the deep dark ramp) and their comments, and `--radius`. Delete every other declaration (including the six shadow knobs and the old shadow ramp). Insert after `color-scheme: dark;`:

```css
  --background: oklch(0.17 0.045 260);
  --foreground: oklch(0.955 0.008 250);
  --card: oklch(0.21 0.05 260);
  --card-foreground: var(--foreground);
  --popover: oklch(0.21 0.05 260);
  --popover-foreground: var(--foreground);
  --surface-raised: oklch(0.245 0.055 260);
  --primary: oklch(0.76 0.13 230);
  --primary-foreground: oklch(0.19 0.045 258);
  --secondary: oklch(0.245 0.055 260);
  --secondary-foreground: var(--foreground);
  --muted: oklch(0.245 0.055 260);
  --muted-foreground: oklch(0.75 0.03 252);
  --accent: oklch(0.245 0.055 260);
  --accent-foreground: var(--foreground);
  --link: oklch(0.81 0.11 228);
  --destructive: oklch(0.53 0.19 27);
  --destructive-foreground: oklch(1 0 0);
  --destructive-text: oklch(0.83 0.1 25);
  --success: var(--status-success-fg);
  --success-foreground: oklch(0.19 0.045 258);
  --warning: var(--status-pending-fg);
  --warning-foreground: oklch(0.19 0.045 258);
  --border: oklch(0.3 0.04 258);
  --border-strong: oklch(0.38 0.04 258);
  --input: oklch(0.53 0.04 256);
  --input-background: oklch(0.195 0.038 258);
  --ring: oklch(0.78 0.12 228);
  --sidebar: var(--brand-navy-deep);
  --sidebar-foreground: oklch(0.92 0.012 250);
  --sidebar-muted: oklch(0.68 0.03 252);
  --sidebar-primary: oklch(0.18 0.06 262);
  --sidebar-primary-foreground: oklch(0.19 0.045 258);
  --sidebar-accent: var(--brand-cyan-bright);
  --sidebar-accent-foreground: oklch(0.18 0.06 262);
  --sidebar-hover: oklch(1 0 0 / 0.05);
  --sidebar-border: oklch(0.25 0.06 262);
  --sidebar-ring: var(--brand-cyan-bright);
  --status-info-fg: oklch(0.84 0.06 245);
  --status-info-bg: oklch(0.30 0.045 250);
  --status-info-dot: oklch(0.72 0.08 245);
  --status-pending-fg: oklch(0.87 0.11 88);
  --status-pending-bg: oklch(0.31 0.05 80);
  --status-pending-dot: oklch(0.82 0.14 85);
  --status-attention-fg: oklch(0.84 0.10 55);
  --status-attention-bg: oklch(0.31 0.06 45);
  --status-attention-dot: oklch(0.74 0.15 50);
  --status-action-fg: oklch(0.84 0.09 300);
  --status-action-bg: oklch(0.31 0.07 300);
  --status-action-dot: oklch(0.72 0.15 300);
  --status-success-fg: oklch(0.84 0.11 155);
  --status-success-bg: oklch(0.30 0.06 155);
  --status-success-dot: oklch(0.74 0.15 152);
  --status-danger-fg: oklch(0.83 0.10 25);
  --status-danger-bg: oklch(0.31 0.08 25);
  --status-danger-dot: oklch(0.70 0.17 27);
  --status-idle-fg: oklch(0.82 0.02 255);
  --status-idle-bg: oklch(0.30 0.02 258);
  --status-idle-dot: oklch(0.66 0.02 255);
  --series-leads: oklch(0.58 0.1 240);
  --series-booked: oklch(0.68 0.12 234);
  --series-sits: oklch(0.79 0.11 228);
  --series-sales: oklch(0.91 0.05 222);
  --series-neutral-strong: oklch(0.85 0.02 250);
  --series-neutral-soft: oklch(0.55 0.03 255);
  --chart-1: oklch(0.64 0.15 243);
  --chart-2: oklch(0.7 0.1 190);
  --chart-3: oklch(0.82 0.14 72);
  --chart-4: oklch(0.67 0.16 300);
  --chart-5: oklch(0.67 0.03 255);
  --identity-1-bg: oklch(0.33 0.06 25);
  --identity-1-fg: oklch(0.88 0.07 25);
  --identity-1-ring: oklch(0.66 0.13 25);
  --identity-2-bg: oklch(0.33 0.06 70);
  --identity-2-fg: oklch(0.88 0.07 70);
  --identity-2-ring: oklch(0.66 0.13 70);
  --identity-3-bg: oklch(0.33 0.06 115);
  --identity-3-fg: oklch(0.88 0.07 115);
  --identity-3-ring: oklch(0.66 0.13 115);
  --identity-4-bg: oklch(0.33 0.06 155);
  --identity-4-fg: oklch(0.88 0.07 155);
  --identity-4-ring: oklch(0.66 0.13 155);
  --identity-5-bg: oklch(0.33 0.06 200);
  --identity-5-fg: oklch(0.88 0.07 200);
  --identity-5-ring: oklch(0.66 0.13 200);
  --identity-6-bg: oklch(0.33 0.06 245);
  --identity-6-fg: oklch(0.88 0.07 245);
  --identity-6-ring: oklch(0.66 0.13 245);
  --identity-7-bg: oklch(0.33 0.06 290);
  --identity-7-fg: oklch(0.88 0.07 290);
  --identity-7-ring: oklch(0.66 0.13 290);
  --identity-8-bg: oklch(0.33 0.06 335);
  --identity-8-fg: oklch(0.88 0.07 335);
  --identity-8-ring: oklch(0.66 0.13 335);
```

Replace the dark `--popover-glass` value (keep the comment, and change "50% alpha" in it to "62% alpha"):

```css
  --popover-glass: oklch(0.245 0.055 260 / 0.62);
```

After `--radius: 0.5rem;` add the dark elevation ramp (the spec gives `sm` and `lg`; `xs` and `md` are the in-between steps):

```css
  --shadow-2xs: 0 1px 2px oklch(0 0 0 / 0.4);
  --shadow-xs: 0 1px 2px oklch(0 0 0 / 0.4);
  --shadow-sm: inset 0 1px 0 oklch(1 0 0 / 0.04), 0 6px 18px -10px oklch(0 0 0 / 0.6);
  --shadow: inset 0 1px 0 oklch(1 0 0 / 0.04), 0 6px 18px -10px oklch(0 0 0 / 0.6);
  --shadow-md: inset 0 1px 0 oklch(1 0 0 / 0.05), 0 10px 24px -12px oklch(0 0 0 / 0.65);
  --shadow-lg: 0 18px 40px -12px oklch(0 0 0 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.06);
  --shadow-xl: 0 18px 40px -12px oklch(0 0 0 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.06);
  --shadow-2xl: 0 18px 40px -12px oklch(0 0 0 / 0.7), inset 0 1px 0 oklch(1 0 0 / 0.06);
```

- [ ] **Step 3: Run the guard and watch it pass**

Run: `pnpm theme:check`
Expected: `theme:check: all 69 checks pass`, exit 0.

- [ ] **Step 4: Expose the new roles in `@theme inline`**

In `@theme inline`, after `--color-sidebar-ring: var(--sidebar-ring);`, add:

```css
  --color-surface-raised: var(--surface-raised);
  --color-link: var(--link);
  --color-border-strong: var(--border-strong);
  --color-input-background: var(--input-background);
  --color-destructive-text: var(--destructive-text);
  --color-sidebar-muted: var(--sidebar-muted);
  --color-sidebar-hover: var(--sidebar-hover);
  --color-status-info-fg: var(--status-info-fg);
  --color-status-info-bg: var(--status-info-bg);
  --color-status-info-dot: var(--status-info-dot);
  --color-status-pending-fg: var(--status-pending-fg);
  --color-status-pending-bg: var(--status-pending-bg);
  --color-status-pending-dot: var(--status-pending-dot);
  --color-status-attention-fg: var(--status-attention-fg);
  --color-status-attention-bg: var(--status-attention-bg);
  --color-status-attention-dot: var(--status-attention-dot);
  --color-status-action-fg: var(--status-action-fg);
  --color-status-action-bg: var(--status-action-bg);
  --color-status-action-dot: var(--status-action-dot);
  --color-status-success-fg: var(--status-success-fg);
  --color-status-success-bg: var(--status-success-bg);
  --color-status-success-dot: var(--status-success-dot);
  --color-status-danger-fg: var(--status-danger-fg);
  --color-status-danger-bg: var(--status-danger-bg);
  --color-status-danger-dot: var(--status-danger-dot);
  --color-status-idle-fg: var(--status-idle-fg);
  --color-status-idle-bg: var(--status-idle-bg);
  --color-status-idle-dot: var(--status-idle-dot);
  --color-identity-1-bg: var(--identity-1-bg);
  --color-identity-1-fg: var(--identity-1-fg);
  --color-identity-1-ring: var(--identity-1-ring);
  --color-identity-2-bg: var(--identity-2-bg);
  --color-identity-2-fg: var(--identity-2-fg);
  --color-identity-2-ring: var(--identity-2-ring);
  --color-identity-3-bg: var(--identity-3-bg);
  --color-identity-3-fg: var(--identity-3-fg);
  --color-identity-3-ring: var(--identity-3-ring);
  --color-identity-4-bg: var(--identity-4-bg);
  --color-identity-4-fg: var(--identity-4-fg);
  --color-identity-4-ring: var(--identity-4-ring);
  --color-identity-5-bg: var(--identity-5-bg);
  --color-identity-5-fg: var(--identity-5-fg);
  --color-identity-5-ring: var(--identity-5-ring);
  --color-identity-6-bg: var(--identity-6-bg);
  --color-identity-6-fg: var(--identity-6-fg);
  --color-identity-6-ring: var(--identity-6-ring);
  --color-identity-7-bg: var(--identity-7-bg);
  --color-identity-7-fg: var(--identity-7-fg);
  --color-identity-7-ring: var(--identity-7-ring);
  --color-identity-8-bg: var(--identity-8-bg);
  --color-identity-8-fg: var(--identity-8-fg);
  --color-identity-8-ring: var(--identity-8-ring);
```

(`--color-primary`, `--color-chart-*`, `--color-sidebar-*` already exist and now read the new values.)

- [ ] **Step 5: PWA standalone background**

- `src/app/manifest.ts:14`: `background_color: '#09090b',` → `background_color: '#040f23',`
- `src/app/(frontend)/layout.tsx`: in the comment at line 137 and the `__html` string at line 141, `#09090b` → `#040f23`.
- `src/shared/components/splash-screen/splash-screen.tsx:115`: `backgroundColor: '#09090b',` → `backgroundColor: '#040f23',`

`#040f23` is dark `--background` (`oklch(0.17 0.045 260)`) in sRGB. `theme_color` stays `#03AFED`: the browser chrome tint is the logo's one place.

- [ ] **Step 6: Verify and commit**

Run: `pnpm theme:check && pnpm tsc && pnpm lint`
Expected: all three clean.

Run: `grep -rn '09090b' src` → no output.

```bash
git commit -m "feat(theme): Navy Rail tokens — navy rail, logo-derived action blue, surface ramp, status tones, series, identity, navy elevation" -- 'src/app/(frontend)/globals.css' src/app/manifest.ts 'src/app/(frontend)/layout.tsx' src/shared/components/splash-screen/splash-screen.tsx
```

---

### Task 3: Page shell and form controls

**Files:**
- Modify: `src/app/(frontend)/dashboard/layout.tsx:43-48`
- Modify: `src/shared/components/ui/input.tsx:11`, `textarea.tsx:10`, `input-group.tsx:18`, `input-otp.tsx:54`, `multi-select.tsx:135`, `checkbox.tsx:17`, `tabs.tsx:25`, `switch.tsx:16`, `button.tsx:18`; `src/features/proposal-flow/ui/components/form/index.tsx:38`

**Interfaces:**
- Consumes: `bg-input-background`, `border-input`, `bg-input` (Task 2).
- Produces: nothing new.

`--input` is now the 3:1 **control border** in both modes, so `dark:bg-input/30` would paint a light slab. Controls get their fill from `--input-background` instead.

- [ ] **Step 1: Remove the radial glow**

In `src/app/(frontend)/dashboard/layout.tsx`, delete the `style={{ background: … }}` prop on `SidebarInset` and add `bg-background` to its className:

```tsx
        <SidebarInset className="h-full min-w-0 overflow-hidden bg-background">
```

- [ ] **Step 2: Failing check for the old control fill**

Run: `grep -rn 'dark:bg-input/\|bg-transparent.*border-input\|border-input.*bg-transparent' src/shared/components/ui src/features/proposal-flow/ui/components/form/index.tsx`
Expected: hits in the files listed above (this is the red state).

- [ ] **Step 3: Controls read the control roles**

Apply these exact class edits (leave every other class as is):
- `input.tsx`, `textarea.tsx`: remove `dark:bg-input/30`; replace `bg-transparent` with `bg-input-background`.
- `input-group.tsx`, `input-otp.tsx`, `checkbox.tsx`: replace `dark:bg-input/30` with `bg-input-background`.
- `multi-select.tsx`: replace `bg-transparent` with `bg-input-background`; remove `dark:bg-input/30`; replace `dark:hover:bg-input/50` with `hover:bg-accent`.
- `tabs.tsx` (the `default` variant): replace `dark:data-[state=active]:border-input dark:data-[state=active]:bg-input/30` with `dark:data-[state=active]:border-border dark:data-[state=active]:bg-surface-raised`.
- `switch.tsx`: keep `data-[state=unchecked]:bg-input` (the 3:1 border color is the right weight for an off track); remove `dark:data-[state=unchecked]:bg-input/80`.
- `button.tsx:18` (`outline` variant): remove the typo'd `dark:bg-foregound/20` and replace `dark:hover:bg-input/50` with `dark:hover:bg-accent`.
- `src/features/proposal-flow/ui/components/form/index.tsx:38`: `'bg-background shadow-sm dark:border-input dark:bg-input/30'` → `'bg-background shadow-sm dark:border-border dark:bg-surface-raised'`.

- [ ] **Step 4: Re-run the check**

Run the Step 2 grep again. Expected: no output.

- [ ] **Step 5: Labels on primary use `text-primary-foreground`**

Dark `--primary` is light cyan with a navy label, so a hardcoded light label on it disappears in dark mode. Class lists wrap across lines, so look at a window around every `bg-primary`:

```bash
grep -rn -B3 -A3 'bg-primary\b' src --include=*.tsx | grep -E 'text-white|text-background' | grep -v 'primary-foreground'
```

For each hit that styles the **same element** as a solid `bg-primary` (not `bg-primary/10` and not a sibling), replace `text-white` / `text-background` with `text-primary-foreground`. Expected after the fix: every remaining line is on a different element (say so in the report), or the command prints nothing.

- [ ] **Step 6: Verify and commit**

Run: `pnpm tsc && pnpm lint` → clean.

```bash
git commit -m "feat(theme): controls read the control roles; drop the dashboard's primary glow" -- 'src/app/(frontend)/dashboard/layout.tsx' src/shared/components/ui/input.tsx src/shared/components/ui/textarea.tsx src/shared/components/ui/input-group.tsx src/shared/components/ui/input-otp.tsx src/shared/components/ui/multi-select.tsx src/shared/components/ui/checkbox.tsx src/shared/components/ui/tabs.tsx src/shared/components/ui/switch.tsx src/shared/components/ui/button.tsx src/features/proposal-flow/ui/components/form/index.tsx
```

(Add any file changed in Step 5 to the path list.)

---

### Task 4: The floating navy rail

**Files:**
- Modify: `src/shared/components/ui/sidebar.tsx:249`
- Modify: `src/features/agent-dashboard/constants/sidebar-styles.ts` (whole file)
- Modify: `src/features/agent-dashboard/ui/components/app-sidebar.tsx`, `app-sidebar-skeleton.tsx:18`, `sidebar-pipeline-item.tsx`, `sidebar-records-group.tsx:40`, `sidebar-search-bar.tsx:38-62`, `sidebar-user-button.tsx:49-57`

**Interfaces:**
- Consumes: `bg-sidebar`, `text-sidebar-foreground`, `text-sidebar-muted`, `bg-sidebar-hover`, `bg-sidebar-accent`, `text-sidebar-accent-foreground`, `text-sidebar-primary`, `border-sidebar-border`, `ring-sidebar-ring`, `shadow-lg` (Task 2).
- Produces: `SIDEBAR_NAV_ITEM_CLASS` (string). `SIDEBAR_NAV_ACTIVE_STYLE` is **deleted**; its two importers (`app-sidebar.tsx`, `sidebar-pipeline-item.tsx`) stop using it in this task.

- [ ] **Step 1: The floating panel shape**

`src/shared/components/ui/sidebar.tsx:249`, in the `sidebar-inner` className: `group-data-[variant=floating]:rounded-lg` → `group-data-[variant=floating]:rounded-[18px]`, and `group-data-[variant=floating]:shadow-sm` → `group-data-[variant=floating]:shadow-lg`. Nothing else in the file changes.

- [ ] **Step 2: Nav item styles from the rail tokens**

Replace the whole of `src/features/agent-dashboard/constants/sidebar-styles.ts` with:

```ts
// `!` beats the shadcn menu-button's own hover, active and transition utilities.
export const SIDEBAR_NAV_ITEM_CLASS = '[transition:background_200ms_ease,color_200ms_ease]! text-sidebar-foreground! hover:bg-sidebar-hover! hover:text-sidebar-foreground! data-[active=true]:bg-sidebar-accent! data-[active=true]:font-semibold data-[active=true]:text-sidebar-accent-foreground! [&_svg]:text-sidebar-muted data-[active=true]:[&_svg]:text-sidebar-primary'
```

- [ ] **Step 3: `app-sidebar.tsx`**

- Import: `import { SIDEBAR_NAV_ITEM_CLASS } from '@/features/agent-dashboard/constants/sidebar-styles'` (drop `SIDEBAR_NAV_ACTIVE_STYLE`).
- `<Sidebar collapsible="icon" side="left" variant="sidebar">` → `variant="floating"`.
- In `renderNavItem`: className → `cn('gap-4', SIDEBAR_NAV_ITEM_CLASS)`; delete the `style={…}` prop; the icon className → `"size-4 shrink-0 transition-colors duration-200"`.
- Action Center button className → `cn('gap-4', SIDEBAR_NAV_ITEM_CLASS)`.
- Logo: the rail is navy in both modes, so keep only the dark-surface artwork. Replace each light/dark `Image` pair with its dark one and drop the `dark:hidden` / `hidden dark:block` classes: collapsed → `/company/logo/logo-dark.svg` (24×24), expanded → `/company/logo/logo-dark-right.svg` (140×40).
- Collapse chevron `Button`: `bg-background` → `bg-card` (it straddles the panel edge and the page).
- The pinned group wrapper `div` (the `bg-linear-to-b from-primary/5 …` slab): replace its whole className with
  `"rounded-xl bg-sidebar-hover p-1 transition-[padding,border-radius] duration-200 ease-linear group-data-[collapsible=icon]:rounded-md group-data-[collapsible=icon]:p-0"`.
- Admin `SidebarGroupLabel`: add `className="text-sidebar-muted"`.

- [ ] **Step 4: `app-sidebar-skeleton.tsx:18`**

`variant="sidebar"` → `variant="floating"`, so the streamed skeleton occupies the same box as the panel it is replaced by.

- [ ] **Step 5: The pipeline item, records label, search bar and user button**

`sidebar-pipeline-item.tsx`:
- Import only `SIDEBAR_NAV_ITEM_CLASS`; menu button className → `cn('gap-4', SIDEBAR_NAV_ITEM_CLASS)`; delete its `style` prop; icon className → `"size-4 shrink-0 transition-colors duration-200"`.
- The pipeline badge (line ~89): delete its `style={{ … }}` object and add to its className
  `cn('border', isActive ? 'border-sidebar-primary/30 text-sidebar-primary' : 'border-sidebar-accent/30 text-sidebar-accent')`
  (the badge sits on the cyan pill when active, on the navy rail otherwise). Its literal `text-[10px]` becomes `text-xs` in Task 8, not here.
- The pipeline dropdown (line ~107): delete its `style` object; className → `"w-44 rounded-xl p-1.5 shadow-lg"`. The option buttons (line ~123): delete the active inline `style`; className → `cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 hover:bg-accent', isCurrent && 'bg-accent font-semibold')`, where `isCurrent` is whatever boolean the existing inline style was conditioned on (read the line; keep its name).

`sidebar-records-group.tsx:40`: `hover:text-sidebar-foreground` → `text-sidebar-muted hover:text-sidebar-foreground`.

`sidebar-search-bar.tsx`, the trigger button className:
- `border-border/70` → `border-sidebar-border`
- `bg-linear-to-b from-background to-muted/50` → `bg-sidebar-hover`
- `text-muted-foreground` → `text-sidebar-muted`
- `hover:border-border hover:text-foreground` → `hover:border-sidebar-muted hover:text-sidebar-foreground`
- `focus-visible:ring-ring` → `focus-visible:ring-sidebar-ring`

and the `kbd`: `border-border/70 bg-muted` → `border-sidebar-border bg-transparent`, `text-muted-foreground` → `text-sidebar-muted`.

`sidebar-user-button.tsx`: in the **trigger** (lines 49–57, on the rail): the avatar fallback gets `className="rounded-lg bg-sidebar-accent font-semibold text-sidebar-accent-foreground"`, and the email span `text-muted-foreground` → `text-sidebar-muted`. The dropdown **content** (lines 63+) sits on the popover, so its `text-muted-foreground` stays.

- [ ] **Step 6: No page-surface text tokens left on the rail**

Run:
```bash
grep -n 'muted-foreground\|text-foreground\|--primary\|text-primary\|from-background\|bg-background' src/features/agent-dashboard/ui/components/{app-sidebar,sidebar-pipeline-item,sidebar-records-group,sidebar-search-bar}.tsx src/features/agent-dashboard/constants/sidebar-styles.ts
sed -n 45,60p src/features/agent-dashboard/ui/components/sidebar-user-button.tsx | grep -n 'muted-foreground'
```
Expected: the first prints only the chevron `Button` line if any (it is on the page edge, `bg-card`), and nothing else; the second prints nothing.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && pnpm lint` → clean. (`SIDEBAR_NAV_ACTIVE_STYLE` has no importers left: `grep -rn SIDEBAR_NAV_ACTIVE_STYLE src` → nothing.)

- [ ] **Step 8: Look at it**

Clear stale CSS first (Global Constraints). Sign in with `http://localhost:3000/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>` and capture `/dashboard` at 1440×900 in light and dark, expanded and collapsed (click the chevron), and at 390×844 with the mobile sheet open (the current Menu button in the bottom capsule). Save to `.playwright-mcp/theme-sidebar-<vp>-<state>-<mode>.png`. Check: the panel floats with an 18px radius and the navy fill in both modes; the active page is a solid cyan pill with navy label and icon; the chevron is not clipped; the page behind is `--background` with no glow; the sheet is navy with readable labels.

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(theme): floating navy rail with a solid cyan active pill" -- src/shared/components/ui/sidebar.tsx src/features/agent-dashboard/constants/sidebar-styles.ts src/features/agent-dashboard/ui/components/app-sidebar.tsx src/features/agent-dashboard/ui/components/app-sidebar-skeleton.tsx src/features/agent-dashboard/ui/components/sidebar-pipeline-item.tsx src/features/agent-dashboard/ui/components/sidebar-records-group.tsx src/features/agent-dashboard/ui/components/sidebar-search-bar.tsx src/features/agent-dashboard/ui/components/sidebar-user-button.tsx
```

---

### Task 5: Status tones, fixed once at the root

**Files:**
- Create: `src/shared/constants/status-tones.ts`
- Modify:
  - `src/shared/components/kanban/constants/color-maps.ts`
  - `src/shared/modules/proposals/core/constants/proposal-status-colors.ts`, `proposal-row-styles.ts`, `multiplier-styles.ts`
  - `src/shared/entities/meetings/constants/status-colors.ts`, `src/shared/entities/meetings/lib/meeting-row-class.ts`
  - `src/shared/components/contract-status-panel/lib/get-status-badge.ts`, `constants/contract-statuses.ts`, `constants/action-impacts.ts`
  - `src/features/agent-dashboard/constants/tier-color-map.ts`
  - `src/features/campaigns-admin/constants/lead-status.ts`
  - `src/features/schedule-management/constants/schedule-calendar-config.ts`
  - `src/shared/entities/activities/constants/index.ts`
  - `src/shared/entities/customers/components/customer-pipeline-badge.tsx`

**Interfaces:**
- Consumes: the `status-<tone>-{fg,bg,dot}` utilities (Task 2).
- Produces:
  ```ts
  export type StatusTone = 'info' | 'pending' | 'attention' | 'action' | 'success' | 'danger' | 'idle'
  export const STAGE_COLOR_TONE: Record<string, StatusTone>
  export function stageTone(color: string): StatusTone          // unknown key → 'idle'
  export interface ToneClasses { text: string, fill: string, dot: string, border: string, bar: string, wash: string }
  export const TONE_CLASSES: Record<StatusTone, ToneClasses>
  export function toneClasses(tone: StatusTone): ToneClasses
  ```
  `fill` is `'bg-… text-…'` (a badge), `bar` is the kanban column's `border-t-…`, `wash` is a row tint. Every map below keeps its exported name and type.

- [ ] **Step 1: Write `status-tones.ts`**

```ts
export type StatusTone = 'info' | 'pending' | 'attention' | 'action' | 'success' | 'danger' | 'idle'

// Stage objects keep their palette-named `color` keys; this is the one place a key becomes a meaning.
// `indigo` and `cyan` are unused by today's pipelines but stay mapped so a new stage cannot render unstyled.
export const STAGE_COLOR_TONE: Record<string, StatusTone> = {
  blue: 'info',
  indigo: 'info',
  yellow: 'pending',
  orange: 'attention',
  purple: 'action',
  cyan: 'action',
  green: 'success',
  red: 'danger',
  slate: 'idle',
  muted: 'idle',
}

export function stageTone(color: string): StatusTone {
  return STAGE_COLOR_TONE[color] ?? 'idle'
}

export interface ToneClasses {
  text: string
  fill: string
  dot: string
  border: string
  bar: string
  wash: string
}

// Whole class strings, never assembled from pieces, so Tailwind's scanner emits every one.
export const TONE_CLASSES: Record<StatusTone, ToneClasses> = {
  info: { text: 'text-status-info-fg', fill: 'bg-status-info-bg text-status-info-fg', dot: 'bg-status-info-dot', border: 'border-status-info-dot/40', bar: 'border-t-status-info-dot', wash: 'bg-status-info-bg/70' },
  pending: { text: 'text-status-pending-fg', fill: 'bg-status-pending-bg text-status-pending-fg', dot: 'bg-status-pending-dot', border: 'border-status-pending-dot/40', bar: 'border-t-status-pending-dot', wash: 'bg-status-pending-bg/70' },
  attention: { text: 'text-status-attention-fg', fill: 'bg-status-attention-bg text-status-attention-fg', dot: 'bg-status-attention-dot', border: 'border-status-attention-dot/40', bar: 'border-t-status-attention-dot', wash: 'bg-status-attention-bg/70' },
  action: { text: 'text-status-action-fg', fill: 'bg-status-action-bg text-status-action-fg', dot: 'bg-status-action-dot', border: 'border-status-action-dot/40', bar: 'border-t-status-action-dot', wash: 'bg-status-action-bg/70' },
  success: { text: 'text-status-success-fg', fill: 'bg-status-success-bg text-status-success-fg', dot: 'bg-status-success-dot', border: 'border-status-success-dot/40', bar: 'border-t-status-success-dot', wash: 'bg-status-success-bg/70' },
  danger: { text: 'text-status-danger-fg', fill: 'bg-status-danger-bg text-status-danger-fg', dot: 'bg-status-danger-dot', border: 'border-status-danger-dot/40', bar: 'border-t-status-danger-dot', wash: 'bg-status-danger-bg/70' },
  idle: { text: 'text-status-idle-fg', fill: 'bg-status-idle-bg text-status-idle-fg', dot: 'bg-status-idle-dot', border: 'border-status-idle-dot/40', bar: 'border-t-status-idle-dot', wash: 'bg-status-idle-bg/70' },
}

export function toneClasses(tone: StatusTone): ToneClasses {
  return TONE_CLASSES[tone]
}
```

- [ ] **Step 2: Failing check — the maps still hold palette classes**

Run:
```bash
grep -cE '(bg|text|border|ring)-(slate|zinc|blue|indigo|cyan|red|green|emerald|amber|yellow|orange|purple)-[0-9]{2,3}' src/shared/components/kanban/constants/color-maps.ts src/shared/modules/proposals/core/constants/{proposal-status-colors,proposal-row-styles,multiplier-styles}.ts src/shared/entities/meetings/constants/status-colors.ts src/shared/entities/meetings/lib/meeting-row-class.ts src/shared/components/contract-status-panel/lib/get-status-badge.ts src/shared/components/contract-status-panel/constants/{contract-statuses,action-impacts}.ts src/features/agent-dashboard/constants/tier-color-map.ts src/features/campaigns-admin/constants/lead-status.ts src/features/schedule-management/constants/schedule-calendar-config.ts src/shared/entities/activities/constants/index.ts src/shared/entities/customers/components/customer-pipeline-badge.tsx
```
Expected: non-zero counts (red).

- [ ] **Step 3: Rewrite the maps**

Each file imports what it needs from `@/shared/constants/status-tones`. Exported names, key sets and types stay exactly as they are.

`kanban/constants/color-maps.ts`:
```ts
import { STAGE_COLOR_TONE, TONE_CLASSES } from '@/shared/constants/status-tones'

export const stageColorMap: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_COLOR_TONE).map(([color, tone]) => [color, TONE_CLASSES[tone].bar]),
)

export const badgeColorMap: Record<string, string> = Object.fromEntries(
  Object.entries(STAGE_COLOR_TONE).map(([color, tone]) => [color, TONE_CLASSES[tone].fill]),
)
```

`proposal-status-colors.ts` (sent is attention everywhere, matching the kanban and the studies):
```ts
import type { Proposal } from '@/shared/db/schema'
import type { StatusTone } from '@/shared/constants/status-tones'

import { TONE_CLASSES } from '@/shared/constants/status-tones'

const PROPOSAL_STATUS_TONE: Record<Proposal['status'], StatusTone> = {
  draft: 'idle',
  sent: 'attention',
  approved: 'success',
  declined: 'danger',
}

export const PROPOSAL_STATUS_COLORS = Object.fromEntries(
  Object.entries(PROPOSAL_STATUS_TONE).map(([status, tone]) => [status, TONE_CLASSES[tone].fill]),
) as Record<Proposal['status'], string>

export const PROPOSAL_STATUS_DOT_COLORS = Object.fromEntries(
  Object.entries(PROPOSAL_STATUS_TONE).map(([status, tone]) => [status, TONE_CLASSES[tone].dot]),
) as Record<Proposal['status'], string>
```

`proposal-row-styles.ts` — keep the interface and icons; replace the `sent`, `approved`, `declined` entries:
```ts
  sent: { bg: 'bg-status-attention-bg/50 hover:bg-status-attention-bg', icon: SendIcon, iconClass: 'text-status-attention-fg', textClass: 'text-status-attention-fg font-medium', valueClass: 'text-status-attention-fg' },
  approved: { bg: 'bg-status-success-bg/50 hover:bg-status-success-bg', icon: CheckCircle2Icon, iconClass: 'text-status-success-fg', textClass: 'text-status-success-fg font-medium', valueClass: 'text-status-success-fg' },
  declined: { bg: 'bg-status-danger-bg/40 hover:bg-status-danger-bg/70', icon: XCircleIcon, iconClass: 'text-status-danger-fg/70', textClass: 'text-status-danger-fg/70 line-through', valueClass: 'text-status-danger-fg/60 line-through' },
```

`multiplier-styles.ts`:
```ts
export const MULTIPLIER_STYLES: Record<MultiplierTier, string> = {
  danger: 'text-status-danger-fg',
  healthy: 'text-status-success-fg',
  excellent: 'text-status-success-fg [text-shadow:0_0_12px_var(--status-success-dot),0_0_4px_color-mix(in_oklch,var(--status-success-dot)_40%,transparent)]',
  unknown: 'text-muted-foreground',
}
```

`meetings/constants/status-colors.ts` — replace the three scheme objects passed to `buildOutcomeColorMap` (sentiment → tone: negative danger, positive success, neutral pending, unset idle) and update the comment above the badge maps to say they read the status tones:
```ts
export const MEETING_LIST_STATUS_COLORS: Record<MeetingOutcome, string> = buildOutcomeColorMap({
  negative: 'border-status-danger-dot/40 bg-status-danger-bg text-status-danger-fg',
  positive: 'border-status-success-dot/40 bg-status-success-bg text-status-success-fg',
  neutral: 'border-status-pending-dot/40 bg-status-pending-bg text-status-pending-fg',
  unset: 'border-border bg-muted text-muted-foreground',
})
```
`MEETING_OUTCOME_COLORS`: the same four strings. `MEETING_OUTCOME_DOT_COLORS`: `negative: 'bg-status-danger-dot'`, `positive: 'bg-status-success-dot'`, `neutral: 'bg-status-pending-dot'`, `unset: 'bg-status-idle-dot'`.

`meetings/lib/meeting-row-class.ts`: `'bg-yellow-400/[0.05]'` → `'bg-status-pending-bg/60'`; `'bg-orange-400/[0.1]'` → `'bg-status-attention-bg'`. Update the doc comment's "very light yellow/orange" to "pending tint / attention tint".

`contract-status-panel/lib/get-status-badge.ts`: `inprogress` → `'bg-status-pending-bg text-status-pending-fg'`; `completed`, `approved` → `'bg-status-success-bg text-status-success-fg'`; `declined`, `expired` (both functions) → `'bg-status-danger-bg text-status-danger-fg'`; proposal `sent` → `'bg-status-attention-bg text-status-attention-fg'`.

`contract-statuses.ts`: `inprogress` → `color: 'text-status-pending-fg', dotClass: 'bg-status-pending-dot'`; `completed` → `'text-status-success-fg'` / `'bg-status-success-dot'`; `declined`, `expired` → `'text-status-danger-fg'` / `'bg-status-danger-dot'`.

`action-impacts.ts`: `notifies` → `iconClassName: 'text-status-info-fg'`, `labelClassName: 'text-status-info-fg'`.

`tier-color-map.ts` — order stays `bg text border` (two consumers read index 1 as the text class):
```ts
export const tierColorMap: Record<string, string> = {
  red: 'bg-status-danger-bg text-status-danger-fg border-status-danger-dot/40',
  orange: 'bg-status-attention-bg text-status-attention-fg border-status-attention-dot/40',
  yellow: 'bg-status-pending-bg text-status-pending-fg border-status-pending-dot/40',
  blue: 'bg-status-info-bg text-status-info-fg border-status-info-dot/40',
  muted: 'bg-muted text-muted-foreground border-muted',
}
```

`lead-status.ts`: `enrolled` → `dotClass: 'bg-status-success-dot', toneClass: 'text-status-success-fg border-status-success-dot/40'`; `removed` → pending the same way; `dnc` → danger the same way.

`schedule-calendar-config.ts` `ACTIVITY_TYPE_BG_TINTS` (activity type → tone: note info, reminder pending, task success, event action):
```ts
export const ACTIVITY_TYPE_BG_TINTS: Record<ActivityType, string> = {
  note: 'bg-status-info-bg/60 border-status-info-dot/30',
  reminder: 'bg-status-pending-bg/60 border-status-pending-dot/30',
  task: 'bg-status-success-bg/60 border-status-success-dot/30',
  event: 'bg-status-action-bg/60 border-status-action-dot/30',
}
```

`activities/constants/index.ts` `ACTIVITY_TYPE_CONFIG`, same tones: `note` → `color: 'text-status-info-fg', bgColor: 'bg-status-info-bg'`; `reminder` → pending; `task` → success; `event` → action.

`customer-pipeline-badge.tsx` `PIPELINE_CLASSES` (projects success, fresh info, leads action, rehash pending, dead idle), each value `TONE_CLASSES[<tone>].fill`; update the doc comment's "Colors align with the kanban `badgeColorMap` palette" to "Tones match the kanban badges (status-tones)".

- [ ] **Step 4: Re-run the Step 2 grep**

Expected: every count is `0`.

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 6: Pin the Review Focus cases**

Run:
```bash
cat > /tmp/check-status-tones.ts <<EOF
import { readdirSync, readFileSync } from 'node:fs'
import { STAGE_COLOR_TONE, stageTone } from '$PWD/src/shared/constants/status-tones'
import { tierColorMap } from '$PWD/src/features/agent-dashboard/constants/tier-color-map'

function assert(ok: boolean, message: string) {
  if (!ok) {
    console.error('FAIL', message)
    process.exit(1)
  }
}
assert(stageTone('nonsense') === 'idle', 'an unknown key falls back to idle')
for (const [key, classes] of Object.entries(tierColorMap)) {
  assert(classes.split(' ')[1].startsWith('text-'), \`tier \${key} keeps the bg text border order\`)
}
const dir = 'src/shared/domains/pipelines/constants'
const files = [...readdirSync(dir).map(file => \`\${dir}/\${file}\`), 'src/features/agent-dashboard/constants/action-tiers.ts']
for (const file of files) {
  for (const [, key] of readFileSync(file, 'utf8').matchAll(/color: '(\\w+)'/g)) {
    assert(key in STAGE_COLOR_TONE, \`\${file} uses the unmapped key \${key}\`)
  }
}
console.log('status tones: ok')
EOF
pnpm exec tsx /tmp/check-status-tones.ts; rm /tmp/check-status-tones.ts
```
Expected: `status tones: ok`.

- [ ] **Step 7: Commit**

```bash
git commit -m "feat(theme): one status-tone module; every status and stage map reads it" -- src/shared/constants/status-tones.ts src/shared/components/kanban/constants/color-maps.ts src/shared/modules/proposals/core/constants/proposal-status-colors.ts src/shared/modules/proposals/core/constants/proposal-row-styles.ts src/shared/modules/proposals/core/constants/multiplier-styles.ts src/shared/entities/meetings/constants/status-colors.ts src/shared/entities/meetings/lib/meeting-row-class.ts src/shared/components/contract-status-panel/lib/get-status-badge.ts src/shared/components/contract-status-panel/constants/contract-statuses.ts src/shared/components/contract-status-panel/constants/action-impacts.ts src/features/agent-dashboard/constants/tier-color-map.ts src/features/campaigns-admin/constants/lead-status.ts src/features/schedule-management/constants/schedule-calendar-config.ts src/shared/entities/activities/constants/index.ts src/shared/entities/customers/components/customer-pipeline-badge.tsx
```

---

### Task 6: Identity colors and chart tokens

**Files:**
- Modify: `src/shared/entities/users/lib/get-user-color.ts`
- Modify: `src/features/analytics/constants/chart-series.ts:37-43`, `src/features/analytics/ui/components/report/trend-chart.tsx:7,46`
- Modify: `src/features/calculators/remodel-roi-calculator/constants/bill-colors.ts`

**Interfaces:**
- Consumes: `bg-identity-<n>-bg`, `text-identity-<n>-fg`, `ring-identity-<n>-ring`, `var(--series-*)`, `var(--chart-1..5)`, `bg-chart-1..5` (Task 2).
- Produces: `getUserColorToken(userId): UserColorToken` (unchanged signature); `SERIES_COLOR_VARS` is **deleted**.

- [ ] **Step 1: Failing check**

Run: `grep -n 'SERIES_COLOR_VARS\|#[0-9a-f]\{6\}' src/features/analytics/constants/chart-series.ts; grep -c -- '-500/25' src/shared/entities/users/lib/get-user-color.ts; grep -c 'color-yellow\|color-sky\|bg-yellow\|bg-sky' src/features/calculators/remodel-roi-calculator/constants/bill-colors.ts`
Expected: hits, `10`, `4` (red).

- [ ] **Step 2: Identity palette**

In `get-user-color.ts`, replace the doc comment's "Kept intentionally small (10 hues)…" sentence with "Eight hues, 45° apart, L-matched per mode, so one person keeps one hue in light and dark." and replace `USER_COLOR_PALETTE` with:

```ts
const USER_COLOR_PALETTE: readonly UserColorToken[] = [
  { bg: 'bg-identity-1-bg', text: 'text-identity-1-fg', ring: 'ring-identity-1-ring' },
  { bg: 'bg-identity-2-bg', text: 'text-identity-2-fg', ring: 'ring-identity-2-ring' },
  { bg: 'bg-identity-3-bg', text: 'text-identity-3-fg', ring: 'ring-identity-3-ring' },
  { bg: 'bg-identity-4-bg', text: 'text-identity-4-fg', ring: 'ring-identity-4-ring' },
  { bg: 'bg-identity-5-bg', text: 'text-identity-5-fg', ring: 'ring-identity-5-ring' },
  { bg: 'bg-identity-6-bg', text: 'text-identity-6-fg', ring: 'ring-identity-6-ring' },
  { bg: 'bg-identity-7-bg', text: 'text-identity-7-fg', ring: 'ring-identity-7-ring' },
  { bg: 'bg-identity-8-bg', text: 'text-identity-8-fg', ring: 'ring-identity-8-ring' },
] as const
```

(The values live in globals.css; `theme:check` already proved each fg on its bg ≥ 4.5:1 in both modes.)

- [ ] **Step 3: Series colors come from globals**

In `chart-series.ts`, delete the `SERIES_COLOR_VARS` export and its doc comment, and change "one cobalt ramp" in the `SERIES_COLORS` comment to "one cyan → navy ramp". In `trend-chart.tsx`, remove the `SERIES_COLOR_VARS` import and the `SERIES_COLOR_VARS` argument from `cn(…)` on line 46 (leave `'flex min-w-0 flex-col gap-3'`).

- [ ] **Step 4: Bill categories on the categorical set**

Replace `bill-colors.ts`'s comment and two maps (bill categories are categories, so they take the categorical `--chart-*` set, which is declared in `:root` itself and needs no class to be emitted):

```ts
// Bill categories are unordered, so they take the categorical chart set, not status colors.
export const BILL_COLORS = {
  electric: 'var(--chart-3)',
  water: 'var(--chart-1)',
  gas: 'var(--chart-4)',
  gardening: 'var(--chart-2)',
  misc: 'var(--chart-5)',
} as const satisfies Record<BillCategory, string>
```
```ts
export const BILL_SWATCH_CLASSES = {
  electric: 'bg-chart-3',
  water: 'bg-chart-1',
  gas: 'bg-chart-4',
  gardening: 'bg-chart-2',
  misc: 'bg-chart-5',
} as const satisfies Record<BillCategory, string>
```

- [ ] **Step 5: Validate the categorical set**

Load the `dataviz` skill and run its palette validator on the five `--chart-*` values for light (`oklch(0.52 0.15 243)`, `oklch(0.58 0.1 190)`, `oklch(0.7 0.14 72)`, `oklch(0.55 0.16 300)`, `oklch(0.55 0.03 255)` on `#ffffff`) and dark (`oklch(0.64 0.15 243)`, `oklch(0.7 0.1 190)`, `oklch(0.82 0.14 72)`, `oklch(0.67 0.16 300)`, `oklch(0.67 0.03 255)` on dark `--card` `oklch(0.21 0.05 260)`). Paste its output into the task report. If a check fails, report it and stop; do not tune values without the owner.

- [ ] **Step 6: Re-run Step 1, type-check, lint, commit**

Step 1 grep → no hits, `0`, `0`. `pnpm tsc && pnpm lint` → clean.

```bash
git commit -m "feat(theme): identity, series and categorical chart colors come from theme tokens" -- src/shared/entities/users/lib/get-user-color.ts src/features/analytics/constants/chart-series.ts src/features/analytics/ui/components/report/trend-chart.tsx src/features/calculators/remodel-roi-calculator/constants/bill-colors.ts
```

---

### Task 7: Palette guard and the long tail

**Files:**
- Modify: `eslint.config.js` (append one config object)
- Modify: every file the guard reports (the list is regenerated in Step 2; 88 files and 570 hits before Tasks 5–6, fewer after)

**Interfaces:**
- Consumes: all status, identity, chart, destructive, success, warning, link and surface utilities (Tasks 2, 5, 6); `TONE_CLASSES` for anything status-shaped.
- Produces: the ESLint rule `theme-tokens/palette`.

- [ ] **Step 1: Add the guard**

Append to the end of the `antfu(…).append(…)` chain in `eslint.config.js` (after the last existing `.append({ … })`):

```js
.append({
  // Aliased under its own plugin namespace for the same reason as project/no-inline-table-config:
  // a second `no-restricted-syntax` entry for these files would replace the nav-path one.
  name: 'project/theme-tokens',
  files: ['src/features/**/*.{ts,tsx}', 'src/shared/**/*.{ts,tsx}'],
  ignores: THEME_TOKEN_IGNORES,
  plugins: { 'theme-tokens': { rules: { palette: builtinRules.get('no-restricted-syntax') } } },
  rules: {
    'theme-tokens/palette': ['error',
      { selector: `Literal[value=${PALETTE_RE}]`, message: PALETTE_MSG },
      { selector: `TemplateElement[value.raw=${PALETTE_RE}]`, message: PALETTE_MSG },
    ],
  },
})
```

and near the top of the file, after the `NAV_PATH_MSG` constant:

```js
// Status, identity and chart colors are theme tokens; a raw palette class is light-only or needs a
// `dark:` patch, which is how 88 files drifted off-theme before.
const PALETTE_RE
  = '/\\b(bg|text|border|ring|fill|stroke|outline|divide|from|to|via)-(slate|gray|zinc|neutral|stone|blue|sky|indigo|cyan|teal|red|rose|pink|green|emerald|lime|amber|yellow|orange|purple|violet|fuchsia)-\\d{2,3}\\b/'
const PALETTE_MSG = 'Use a theme token (status-*, chart-*, identity-*, destructive, success, warning) chosen by meaning.'
// The marketing world keeps its own palette, third-party brand marks keep theirs, and the meeting-flow
// program/benefit accents wait on a presentation decision before they move onto tokens.
const THEME_TOKEN_IGNORES = [
  'src/features/landing/**',
  'src/shared/domains/funnels/**',
  'src/shared/components/navigation/site-navbar.tsx',
  'src/shared/components/reviews/**',
  'src/shared/constants/company/socials.ts',
  'src/features/meeting-flow/constants/benefit-categories.ts',
  'src/features/meeting-flow/ui/components/steps/program-card.tsx',
  'src/features/meeting-flow/ui/components/steps/closing-step.tsx',
]
```

- [ ] **Step 2: See the red list**

Run the **guard report** (Global Constraints) with `theme-tokens/palette`.
Expected: `theme-tokens/palette: N hits in M files` with N > 0. `/tmp/theme-tokens-palette.txt` is the task's checklist.

Confirm the nav-path guard survived (the alias exists so it would): `CI=true pnpm exec eslint --print-config src/shared/components/kanban/ui/kanban-column.tsx | grep -c 'theme-tokens/palette\|no-restricted-syntax'` → `2` or more.

- [ ] **Step 3: Migrate each file by meaning**

For each file in the list, replace each raw class using this table. Delete any `dark:` variant whose only job was patching the palette class you removed.

| The class means | Use |
|---|---|
| a status or stage (badge, pill, dot, column marker) | the tone's `TONE_CLASSES` entry: `fill` / `text` / `dot` / `border` / `bar` / `wash` (info = neutral blue, pending = in progress/waiting, attention = needs a look, action = purple, success = done/converted, danger = bad/failed, idle = inactive/draft) |
| money up / good number | `text-status-success-fg` |
| money down / bad number | `text-status-danger-fg` |
| warning, caution, "expiring" | `pending` tone |
| destructive UI (delete, danger zone) | `text-destructive-text`, `bg-destructive text-destructive-foreground`, `border-destructive/40` |
| a link in running text | `text-link` |
| a categorical series or category with no status meaning | `bg-chart-1..5` / `var(--chart-1..5)` |
| a person | `getUserColorToken(userId)` |
| decoration with no meaning (gray text, neutral borders, subtle fills) | `text-muted-foreground`, `border-border`, `border-border-strong`, `bg-muted`, `bg-surface-raised` |

The guard does not see `bg-white` / `bg-black` (they are not palette steps), so handle the three files the spec names by hand: `grep -n 'bg-white\|bg-black' src/shared/components/optimized-image.tsx src/shared/components/dialogs/modals/base-modal.tsx src/features/agent-settings/ui/components/headshot-upload.tsx`. A scrim over a photo stays black in both themes: keep it and add a one-line why-comment. Anything else becomes `bg-card` (a white surface) or `bg-foreground` (a black one).

Files that need a judgment call (decorative categorical colors in a customer-facing meeting-flow surface, like the three already ignored): add them to `THEME_TOKEN_IGNORES`, list them in the task report, and add a line to the follow-ups doc in Task 9. Do not invent new tokens.

Work through the list in batches by folder; after each batch run `CI=true pnpm exec eslint <folder>` and `pnpm tsc`.

- [ ] **Step 4: Green**

Run the guard report with `theme-tokens/palette`.
Expected: `theme-tokens/palette: 0 hits in 0 files`. Then `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 5: Commit**

Commit `eslint.config.js` and every file this task changed, **minus** any file that was already dirty or untracked before the task (compare with the `git status --porcelain` you took at the start; name those files in the report):

```bash
git diff --name-only -- src/features src/shared > /tmp/theme-task7-files.txt   # then delete the pre-dirty lines from it
git commit -m "feat(theme): guard against raw palette classes; move the long tail onto theme tokens by meaning" -- eslint.config.js $(cat /tmp/theme-task7-files.txt)
```

---

### Task 8: Type-ramp guard and literal font sizes (the 2px rule)

**Files:**
- Modify: `eslint.config.js` (extend the `project/theme-tokens` object from Task 7)
- Modify: every file the guard reports (regenerate with Step 2; today `grep -rnE 'text-\[[0-9.]+(px|rem)\]' src` lists ~180 hits, most in `features/calculators`, `features/meeting-flow`, `features/lead-sources-admin`, `features/agent-dashboard`, `shared/entities`)

**Interfaces:**
- Consumes: Tailwind's default `text-*` steps only.
- Produces: the ESLint rule `theme-tokens/type-ramp`.

- [ ] **Step 1: Add the guard**

In the `project/theme-tokens` object, add a second aliased rule to the plugin and the rules:

```js
  plugins: { 'theme-tokens': { rules: {
    'palette': builtinRules.get('no-restricted-syntax'),
    'type-ramp': builtinRules.get('no-restricted-syntax'),
  } } },
```
```js
    'theme-tokens/type-ramp': ['error',
      { selector: `Literal[value=${TYPE_RAMP_RE}]`, message: TYPE_RAMP_MSG },
      { selector: `TemplateElement[value.raw=${TYPE_RAMP_RE}]`, message: TYPE_RAMP_MSG },
    ],
```

and beside the palette constants:

```js
// The 2px rule: every font size is an even number of pixels, and Tailwind's steps are the ramp.
const TYPE_RAMP_RE = '/\\btext-\\[\\d/'
const TYPE_RAMP_MSG = 'Use the type ramp (2px rule: Tailwind steps only, text-xs 12px is the floor).'
```

- [ ] **Step 2: See the red list**

Run the guard report with `theme-tokens/type-ramp`.
Expected: N > 0 hits. `/tmp/theme-tokens-type-ramp.txt` is the checklist.

- [ ] **Step 3: Map every literal to a step**

| Literal | Step |
|---|---|
| 8, 9, 10, 11, 11.5, 12, 12.5px, `0.72rem`, `0.8rem` | `text-xs` |
| 13, 13.5, 14, 14.5px | `text-sm` |
| 15, 15.5px | `text-base` |
| 17px | `text-lg` |
| 22, 25px | `text-2xl` |
| `1.75rem` (28px) | `text-3xl` |
| any other value | the nearest step; an exact tie rounds up; under 12px is `text-xs` |

Where the literal sat beside a `leading-[…]` literal that only existed to fit the odd size, drop that too and let the step's line-height apply. Keep `leading-none` / `leading-tight` where they are set on purpose (badges, stat figures).

- [ ] **Step 4: Green, then look at the dense spots**

Guard report with `theme-tokens/type-ramp` → `0 hits in 0 files`; `pnpm tsc && pnpm lint` → clean; `pnpm theme:check` → pass.

Capture after clearing `.next`, at 390×844 and 820×1180, light mode: `/dashboard/pipeline/fresh` (kanban cards), `/dashboard/calculators` (roi story + readouts), `/dashboard/analytics` (tooltip: tap a bar), `/dashboard/schedule`. If a rounded-up size overflows its box, drop that one use a single step down (never back to a literal) and note it in the report.

- [ ] **Step 5: Commit**

Same path-list rule as Task 7 (today the untracked `dashboard-list-section-header.tsx`, `dashboard-proposal-section-list.tsx` and `dashboard-snapshot-chips.tsx` belong to other uncommitted work: edit them, do not commit them, name them in the report):

```bash
git diff --name-only -- src/features src/shared > /tmp/theme-task8-files.txt   # then delete the pre-dirty lines from it
git commit -m "feat(theme): type-ramp guard; literal font sizes fold into Tailwind's even-pixel steps" -- eslint.config.js $(cat /tmp/theme-task8-files.txt)
```

---

### Task 9: Docs match the code; follow-ups recorded

**Files:**
- Modify: `DESIGN.md` (the "Command Desk" sections: colors, the Stage-Color Rule, Elevation, Sidebar; every "Cobalt Command" mention)
- Modify: `docs/design-system/tokens.md` (the app-token tables)
- Create: `docs/plans/2026-09-29-dashboard-theme-follow-ups.md`

**Interfaces:**
- Consumes: the final `globals.css`, `status-tones.ts`, `eslint.config.js`.
- Produces: nothing code reads.

- [ ] **Step 1: DESIGN.md**

- Replace the name "Cobalt Command" everywhere (`grep -n 'Cobalt' DESIGN.md`) with "Harbor blue" and its value with light `oklch(0.50 0.15 243)` / dark `oklch(0.76 0.13 230)`; say it does one job, "act here", with a white label in light and a navy label in dark.
- Add the navy rail: `--sidebar` light `oklch(0.215 0.072 262)`, dark `oklch(0.13 0.05 262)`; the floating panel (18px radius, `shadow-lg`); the solid cyan active pill (`oklch(0.80 0.12 228)`) with a navy label.
- The Stage-Color Rule: keep its meanings and name the seven tones and where they live (`src/shared/constants/status-tones.ts`), and that the blue stage is now a muted steel (`info`).
- Elevation: the navy-tinted ramp.
- Typography: the 2px rule and that Tailwind's steps are the ramp, enforced by `theme-tokens/type-ramp` and `pnpm theme:check`.
- Remove any sentence the code no longer supports (the radial primary glow, the flat 4px/10px shadow ramp).

- [ ] **Step 2: tokens.md**

Update the app-token tables to the Task 2 values (Tier 1 brand primitives, Tier 2 semantic roles including the four new ones, status tones, series, identity, elevation). Point to `pnpm theme:check` as the proof of every pair instead of listing ratios.

- [ ] **Step 3: Follow-ups doc**

Create `docs/plans/2026-09-29-dashboard-theme-follow-ups.md`:

```markdown
# Dashboard theme — follow-ups

Open items the Navy Rail theme (spec `docs/superpowers/specs/2026-09-29-dashboard-navy-rail-theme-design.md`) left on purpose. Delete each line when it ships.

- Meeting-flow program and benefit accents keep raw palette classes (`benefit-categories.ts`, `program-card.tsx`, `closing-step.tsx`, and any file Task 7 added to `THEME_TOKEN_IGNORES`). Decide their colors as a presentation decision, then drop them from the ignore list in `eslint.config.js`.
- `--text-presentation-label` (min 13px) and `--text-presentation-body` (min 17px) break the 2px rule at their minimums. The one-screen-per-slide rule makes resizing them a presentation decision.
- Detector non-color findings: nested cards on the kanban; the `side-tab` border in `story-challenge.tsx:50` and `story-solution.tsx:76`; `border-t-2` on rounded kanban columns.
- Part B of the spec (floating mobile dock) is a brief for a new session.
```

Add one line per extra ignore or per "dropped one step" from Tasks 7–8.

- [ ] **Step 4: Commit**

```bash
git commit -m "docs(design): Navy Rail tokens, tones, elevation and the 2px type rule; theme follow-ups" -- DESIGN.md docs/design-system/tokens.md docs/plans/2026-09-29-dashboard-theme-follow-ups.md
```

---

### Task 10: Verification and hands-on gate

**Files:** none changed unless a check fails (then fix in the owning file and commit by path).

- [ ] **Step 1: Static gates**

Run: `pnpm theme:check && pnpm tsc && pnpm lint`
Expected: all pass; the guard report shows `0 hits` for both `theme-tokens/palette` and `theme-tokens/type-ramp`.

- [ ] **Step 2: Captures**

Clear stale CSS (Global Constraints). Sign in via `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>`. Set the theme with localStorage `theme` = `light` / `dark` plus `browser_emulate_media`. At 1440×900, 820×1180 and 390×844, in light and dark, capture:
`/dashboard`, `/dashboard/pipeline/fresh`, `/dashboard/meetings`, `/dashboard/proposals`, `/dashboard/schedule`, `/dashboard/analytics`, `/dashboard/calculators`, `/dashboard/settings`; one open popover (the Filters popover over the kanban, dark mode especially), one dialog, one sheet and one toast; and the `:root` scope check pages `/`, one `/proposal-flow` page and `/intake`.
Save as `.playwright-mcp/theme-<page>-<vp>-<mode>.png`. Check the Sonner toast against the status tones.

- [ ] **Step 3: Detector**

Re-run the impeccable detector on the dashboard feature trees. Expected: zero off-token palette colors on the five pages Assessment B audited. Report its summary.

- [ ] **Step 4: Polish**

Run `/impeccable polish` on the dashboard: one batched round of fixes, at most one confirmation round. Commit fixes by path.

- [ ] **Step 5: Hands-on gate (owner)**

Report to the owner, with the captures: the `/`, `/proposal-flow` and `/intake` before/after (the `:root` scope ruling, D10, can still flip to the `data-surface="command-desk"` fallback in spec §A5); the uncommitted `package.json` `theme:check` line; every dirty file edited but not committed; every added ignore. The owner checks on the iPad in daylight, light and dark. Do not push.
