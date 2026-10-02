# Elevation Ladder Tokens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the owner's elevation ladder (picked 2026-10-01) into the app's colour tokens, so the page is the darkest layer and every surface stacked over it is one rung lighter in light and dark. Then bring the dashboard cards, the public site, the overlays and the records tables onto it, each behind an owner screenshot gate.

**Architecture:**
- **Settings.** `globals.css` declares six settings per mode: `--canvas-l`, `--step`, `--surface-c`, `--surface-h`, `--edge` and `--edge-dir`.
- **Depth.** A CSS-only chain gives every `.bg-card` / `.surface` element a `--depth` of 1–3 by how many surfaces it sits inside.
- **Relative tokens.** `--card`, `--muted`, `--band`, `--border`, the row tints and the rest are declared again on every surface, so each surface resolves them against its own rung.
- **Fixed rungs.** The page is rung 0. Overlays are rung 4: `.bg-popover`, plus the new `.surface-overlay` marker for the glass ones. The footer is rung −1 (`.surface-beneath`).
- **Check.** `theme:check` resolves every pair on every rung.

**Tech Stack:** Tailwind v4 (`@theme inline`, `@utility`), OKLCH custom properties, shadcn/Radix, Playwright (local screenshots), tsx.

**Spec:** `docs/superpowers/specs/2026-10-01-elevation-ladder-tokens-design.md` (approved 2026-10-01).

## Global Constraints

**Values and rules**
- Ladder values, verbatim: `light canvas 0.894 step 0.024 tint 0.017 · dark canvas 0.159 step 0.047 tint 0.059 · hue 253 · edge 0.048`. Hairline edges stay on.
- Rungs:

  | Rung | Role | Light L | Dark L |
  |---|---|---|---|
  | −1 | beneath the page (footer) | 0.870 | 0.112 |
  | 0 | canvas | 0.894 | 0.159 |
  | 1 | section, module, table sheet, dialog, sheet | 0.918 | 0.206 |
  | 2 | card in a section | 0.942 | 0.253 |
  | 3 | card on a card | 0.966 | 0.300 |
  | 4 | menu, popover, tooltip | 0.990 | 0.347 |

- Relative steps:
  - step up = +1 rung (`muted`, `accent`, `secondary`);
  - band = +½ rung;
  - edge = the surface ± 0.048, darker in light and lighter in dark; `border-strong` doubles it;
  - row hover / selected = primary mixed 8% / 12% over the surface.
- A surface knows its rung by nesting (owner, 2026-10-01). The public site follows the same ladder (owner, 2026-10-01). `.theme-marketing` and `.funnel-light` keep their literal palettes.
- No class sweep. Only the files a task names change. The owner, 2026-10-01: mechanical sweeps made the app worse. A surface the owner flags is fixed in Task 7, one at a time.
- A colour token other than the ladder settings changes only on the owner's ruling (spec §4.1).

**Working rules**
- Every task: run `pnpm tsc`, `pnpm lint` and `pnpm theme:check`. Shoot before and after with `.claude/skills/elevation-ladder/scripts/shoot.mjs`, show the owner the pairs, and commit only after the owner says so. Never run `pnpm build`.
- Shared working tree: other sessions commit in parallel.
  - Never stash, checkout, reset, restore or `git add -A`.
  - Run `git status --short` before each commit and commit only the task's paths: `git commit -m "…" -- <paths>`.
  - Specs and plans stay uncommitted.
- Never stop or restart the dev server, or clear `.next`, without asking the owner. If shots taken after Task 2 still report every surface at depth 0, the served CSS is stale: ask.
- No DB writes. Screenshots stay in `$SCRATCH` (this session's scratchpad); never publish them.
- `DEV_LOGIN_SECRET` and the login URL are never printed. `shoot.mjs` redacts them.
- Code comments say why, never what, and never cite plans or specs (CLAUDE.md).

**Shell setup used by every task**

```bash
cd /home/olis-solutions/olis-v3/nextjs/tri-pros-website
PORT=$(grep -E '^PORT=' .env.local | cut -d= -f2); PORT=${PORT:-3000}
S=.claude/skills/elevation-ladder/scripts
SCRATCH=<this session's scratchpad directory>
```

## Review Focus

1. **Status and identity pills on light cards.**
   - The risk: pill fills sit at L 0.93–0.955 and cards now at 0.918–0.966, so a fill can vanish into a rung-2 card. `theme:check` tests a pill's text on its fill, not the fill against its card.
   - Expected: pills still read as pills.
   - Test: Task 2 Step 12 has the owner look at the Status/Outcome columns of `meetings-light.png` and the dashboard pills at 200%.
2. **`bg-card` used as a plain fill** (sticky headers, toggles, skeleton frames) now counts as a surface and climbs a rung when nested.
   - Expected: no element turns lighter than the thing it belongs to.
   - Test: the shoot report's `deepest` list per page, read in Task 2 Step 12.
3. **`bg-background` inside a surface** paints a page-coloured hole.
   - Expected: holes only where a sunken well is meant.
   - Test: the report's `holes` list before and after, in Task 2 Step 12 and Task 5 Step 6.
4. **See-through fills** (`bg-muted/50`, `bg-card/80`) inside a surface repeat their surface's colour and vanish.
   - Test: the report's `seeThrough` list, Task 2 Step 12. Each one the owner flags goes to Task 7.
5. **Menu highlights.** The glass dropdown's hovered item is the row-hover tint over rung 4: a darker blue in light, a lighter blue in dark.
   - Expected: the hovered item is visible in both schemes.
   - Test: `meetings-menu-*.png` (the script hovers the first item), Task 5 Step 6.

## File map

| File | Responsibility | Task |
|---|---|---|
| `.claude/skills/elevation-ladder/scripts/shoot.mjs` (new) | The gate's screenshots, plus a report of surfaces, holes and see-through fills | 1 |
| `.claude/skills/elevation-ladder/SKILL.md`, `references/applying-values.md` | Point the gate at `shoot.mjs`; then describe the rung settings | 1, 8 |
| `src/app/(frontend)/globals.css` | Ladder settings, absolute and relative tokens, depth chain, overlay/beneath markers, marketing guard, `surface` utilities | 2 |
| `scripts/check-theme-contrast.ts` | `theme:check` on every rung | 2 |
| `src/shared/components/ui/tabs.tsx`, `src/features/proposal-flow/ui/components/form/index.tsx` | The two `bg-surface-raised` users | 2 |
| The 15 files of commit `84428499` | Dashboard module items are cards again | 3 |
| `src/shared/components/footer.tsx` | Footer on rung −1 | 4 |
| `src/shared/components/ui/{dialog,alert-dialog,sheet,drawer,dropdown-menu,popover,tooltip,select,command,context-menu}.tsx`, `src/shared/components/charts/chart-tooltip-card.tsx` | Overlays: dialogs on rung 1, menus on rung 4, highlights take the row-hover tint | 5 |
| `src/shared/components/data-table/ui/data-table.tsx`, `ui/data-table-row.tsx`, `constants/cell-border.ts`, `src/shared/components/ui/table.tsx` | Records tables: sheet, header, stripes, frozen column | 6 |
| `.claude/skills/elevation-ladder/scripts/measure.mjs`, `assets/ladder-template.html`, `ladder.json` | The skill measures real rungs; records `applied` | 8 |

## Order and blockers

The order is spec §4 with the records tables moved to Task 6. `data-table.tsx` and the row markup are also rewritten by Task 4 of `docs/superpowers/plans/2026-10-01-records-table-render-isolation.md`, which moves the rows into a new `data-table-row.tsx`. So Task 6 runs after that Task 4 is committed, against the new file.

Rulings made while writing this plan:
- **Dialogs, sheets, drawers and alert dialogs take `bg-card`, not `surface`.** Callers pass their own `bg-*` through `cn()`; `tailwind-merge` resolves `bg-card` against them but cannot see `surface` as a background.
- **Glass overlays get a `surface-overlay` marker.** The dropdown, popover, tooltip and chart tooltip paint from an inline style, so without a class they are not on rung 4.
- **Active tab and active proposal-toolbar button use `bg-popover` in both schemes.** Rung 4 is the one fill guaranteed lighter than the `bg-muted` track under it.
- **Records-table body rows lose their per-cell rules, and stripes separate the rows.** This matches the picker table the owner approved. The header keeps a full-edge rule.

---

### Task 1: Screenshot gate script and baselines

**Files:**
- Create: `.claude/skills/elevation-ladder/scripts/shoot.mjs`
- Modify: `.claude/skills/elevation-ladder/references/applying-values.md` (gate step 2)
- Modify: `.claude/skills/elevation-ladder/SKILL.md` (Files list)

**Interfaces:**
- Produces:
  - `node $S/shoot.mjs --base <url> --out <dir> [--only id,id] [--public]`.
  - Shot ids: `dashboard`, `meetings`, `meetings-menu`, `customer-profile`, `proposal-edit`, `proposal-review`, `home-scrolled`, `home-footer`, `about`, `services`, `marketing`.
  - Output: `<id>-<light|dark>.png` per shot, and `report.json` holding `{ report: { "<id>-<scheme>": { url, surfacesByDepth, deepest, holes: { count, first }, seeThrough: { count, first } } }, skipped }`.
  - Exit codes: 1 when any shot was skipped, 2 when an argument is missing.

- [ ] **Step 1: Write `shoot.mjs`**

```js
// Screenshots the pages the ladder's gate needs, light and dark, and reports what the ladder touches on each:
// surfaces by depth, page-coloured holes inside surfaces, and see-through fills that repeat their surface's colour.
//
//   node shoot.mjs --base http://localhost:3000 --out DIR [--only id,id] [--public]
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

// The row actions trigger is the icon button whose screen-reader label is "Actions" (EntityActionDropdown).
const ROW_ACTIONS = 'tbody button:has(> .sr-only:text-is("Actions"))'

// `open` clicks the first match and waits for a dialog or menu; `hover` then points at the first match inside it;
// `pick` clicks the menu item with that name, then shoots the page it opens (`popup`: in a new tab);
// `scroll` is pixels or 'bottom'.
const SHOTS = [
  { id: 'dashboard', path: '/dashboard', auth: true },
  { id: 'meetings', path: '/dashboard/meetings', auth: true },
  { id: 'meetings-menu', path: '/dashboard/meetings', auth: true, open: ROW_ACTIONS, hover: '[role="menuitem"]' },
  { id: 'customer-profile', path: '/dashboard/meetings', auth: true, open: 'tbody button.decoration-dotted' },
  { id: 'proposal-edit', path: '/dashboard/proposals', auth: true, open: ROW_ACTIONS, pick: 'Edit Proposal' },
  { id: 'proposal-review', path: '/dashboard/proposals', auth: true, open: ROW_ACTIONS, pick: 'View Proposal', popup: true },
  { id: 'home-scrolled', path: '/', scroll: 1400 },
  { id: 'home-footer', path: '/', scroll: 'bottom' },
  { id: 'about', path: '/about' },
  { id: 'services', path: '/services' },
  { id: 'marketing', path: '/test' },
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

async function shoot(page, shot, file) {
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
  if (shot.scroll === 'bottom') {
    await target.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await target.waitForTimeout(1500)
  }
  else if (shot.scroll) {
    await target.mouse.wheel(0, shot.scroll)
    await target.waitForTimeout(1200)
  }
  await target.screenshot({ path: file })
  const result = { url: target.url().replace(args.base, ''), ...(await target.evaluate(REPORT)) }
  if (target !== page) {
    await target.close()
  }
  return result
}

const { chromium } = createRequire(path.join(REPO, 'package.json'))('playwright')
mkdirSync(args.out, { recursive: true })
const browser = await chromium.launch()
const report = {}
const skipped = []

try {
  for (const scheme of ['light', 'dark']) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })
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
      const tag = `${shot.id}-${scheme}`
      // One retry: a cold dev server sometimes times out a first navigation.
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          report[tag] = await shoot(page, shot, path.join(args.out, `${tag}.png`))
          break
        }
        catch (error) {
          if (attempt === 2) {
            skipped.push(`${tag}: ${redact(error.message).split('\n')[0]}`)
          }
        }
        finally {
          await page.keyboard.press('Escape').catch(() => {})
        }
      }
    }
    await context.close()
  }
}
finally {
  await browser.close()
}

writeFileSync(path.join(args.out, 'report.json'), `${JSON.stringify({ base: args.base, takenAt: new Date().toISOString(), report, skipped }, null, 2)}\n`)
for (const [tag, r] of Object.entries(report)) {
  console.log(`${tag.padEnd(26)} depths ${JSON.stringify(r.surfacesByDepth)} · holes ${r.holes.count} · see-through ${r.seeThrough.count}`)
}
for (const line of skipped) {
  console.log(`skipped ${line}`)
}
console.log(`${Object.keys(report).length} shot(s), ${skipped.length} skipped → ${args.out}`)
process.exit(skipped.length ? 1 : 0)
```

- [ ] **Step 2: Lint it**

Run: `pnpm exec eslint .claude/skills/elevation-ladder/scripts/shoot.mjs`
Expected: no output, exit 0.

- [ ] **Step 3: Baseline the local build**

Run: `node $S/shoot.mjs --base http://localhost:$PORT --out $SCRATCH/ladder-shots/before`
Expected: 22 lines of `depths {"0":N} · holes N · see-through N`, then `22 shot(s), 0 skipped`. Today every depth reads `0`, because `--depth` doesn't exist yet.

If a shot is skipped, a selector has drifted:
1. Open that page in the Playwright browser after signing in through `/api/dev/playwright-session`, without printing the URL.
2. Find the trigger and update its `SHOTS` entry.
3. Rerun with `--only <id>`.

- [ ] **Step 4: Baseline the live site**

Run: `node $S/shoot.mjs --base https://triprosremodeling.com --public --out $SCRATCH/ladder-shots/live`
Expected: `10 shot(s), 0 skipped`. The live `/test` may serve a 404 page; that shot is still taken.

- [ ] **Step 5: Point the skill's gate at the script**

In `references/applying-values.md`, replace step 2 of "The gate before committing":

```markdown
2. Screenshots in light and dark of: `/dashboard`, a records table (`/dashboard/meetings`), a proposal-flow page, `/` scrolled past the hero (navbar over content), the bottom of `/` (footer), and `/about`. Use the repo's verify harness or a local Playwright script; sign in through `/api/dev/playwright-session` and never print the login secret or URL.
3. Shoot the live site (`https://triprosremodeling.com/`) at the same spots as the "before".
```

with:

```markdown
2. Shoot the local build before and after the change: `node scripts/shoot.mjs --base http://localhost:$PORT --out <dir>` (light and dark, 11 shots: dashboard, records table, its row menu, the customer dialog, the proposal editor and review page, home scrolled and at the footer, `/about`, `/services`, `/test`). It signs in through `/api/dev/playwright-session` without printing the secret. Read its `report.json`: surfaces by depth, page-coloured holes inside surfaces, and see-through fills.
3. Shoot the live site with `--public` as the "before" for the public pages.
```

In `SKILL.md`, under `## Files`, after the `scripts/build.mjs` line, add:

```markdown
- `scripts/shoot.mjs`: the gate's screenshots, light and dark, of the pages the owner judges by, with a report of surfaces by depth, page-coloured holes and see-through fills.
```

- [ ] **Step 6: Hold the commit for the first gate**

This task changes nothing on screen. Its commit goes to the owner together with Task 2's screenshots (Task 2 Step 13).

---

### Task 2: Ladder tokens, nesting, and `theme:check` on every rung

**Files:**
- Modify: `scripts/check-theme-contrast.ts` (whole file)
- Modify: `src/app/(frontend)/globals.css`, in five places:
  - the `:root, .funnel-light` settings (lines 9–17);
  - the `.theme-marketing` `--surface-raised` line (178);
  - the `.dark` settings (322–327);
  - the `.dark` sidebar (346–353);
  - the ramp block (436–461) and `@theme inline` (498).
- Modify: `src/shared/components/ui/tabs.tsx:25`
- Modify: `src/features/proposal-flow/ui/components/form/index.tsx:38`

**Interfaces:**
- Produces, for every later task:
  - **Classes:** `.surface`, a utility that paints `var(--card)` and counts as a surface. `.surface-beneath`, a utility that paints rung −1. `.surface-overlay`, a marker that puts a glass overlay on rung 4.
  - **Custom properties:** `--depth` (−1…4), `--here-l` (the lightness of the surface you are on), `--step` and `--edge`.
  - **`bg-(--card)`** paints the current surface's colour without becoming a surface.
- Removed: `--lift`, `--surface-card-l`, `--surface-raised`, `--color-surface-raised` (`bg-surface-raised`).

- [ ] **Step 1: Write the failing check**

Replace all of `scripts/check-theme-contrast.ts` with:

```ts
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
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm theme:check`
Expected: FAIL, throwing `No block matches /^:root,\s*\.dark,\s*:is\(\.bg-card/m`.

- [ ] **Step 3: Write the ladder into `globals.css`**

3a. In the `:root, .funnel-light` block, replace:

```css
  /* Every app surface is one hue at a lightness step from the page (the :root, .dark block derives them).
     Tune the look here: page lightness, step size, tint strength. Borders step toward the ink. */
  --surface-h: 255;
  --surface-c: 0.012;
  --canvas-l: 0.945;
  --lift: 0.055;
  --edge-dir: -1;
  /* One band, lighter than the page and darker than the card: every other row. */
  --band: oklch(calc(var(--canvas-l) + 0.7 * var(--lift)) var(--surface-c) var(--surface-h));
```

with:

```css
  /* The elevation ladder: one hue, the page darkest, every surface stacked over another one rung lighter.
     Tune it with the elevation-ladder skill (its ladder.json records each pick): page lightness, rung step,
     tint, and how far an edge sits from its surface (darker in light, lighter in dark). */
  --surface-h: 253;
  --surface-c: 0.017;
  --canvas-l: 0.894;
  --step: 0.024;
  --edge: 0.048;
  --edge-dir: -1;
  --depth: 0;
```

3b. In the `.theme-marketing, .funnel-light` block, delete the line `  --surface-raised: var(--popover);`.

3c. In the `.dark` block, replace:

```css
  --surface-c: 0.045;
  --canvas-l: 0.16;
  --lift: 0.045;
  --edge-dir: 1;
  /* Dark bands need a bigger step than light ones to read at the same strength. */
  --band: oklch(calc(var(--canvas-l) + 1.5 * var(--lift)) var(--surface-c) var(--surface-h));
```

with:

```css
  --surface-c: 0.059;
  --canvas-l: 0.159;
  --step: 0.047;
  --edge-dir: 1;
  --depth: 0;
```

3d. In the same `.dark` block, replace the four rail lines:

```css
  /* Dark rail sits level with the cards, a navy tint of the card step. */
  --sidebar: oklch(calc(var(--canvas-l) + var(--lift)) 0.05 262);
```
```css
  --sidebar-accent: oklch(calc(var(--canvas-l) + 2.2 * var(--lift)) 0.055 262);
```
```css
  --sidebar-hover: oklch(calc(var(--canvas-l) + 1.6 * var(--lift)) 0.05 262);
  --sidebar-border: oklch(calc(var(--canvas-l) + 2 * var(--lift)) 0.05 262);
```

with, in the same positions:

```css
  /* The dark rail is rung 1, level with a section; its active pill sits 2.2 steps above it. */
  --sidebar: oklch(calc(var(--canvas-l) + var(--step)) var(--surface-c) var(--surface-h));
```
```css
  --sidebar-accent: oklch(calc(var(--canvas-l) + 3.2 * var(--step)) var(--surface-c) var(--surface-h));
```
```css
  --sidebar-hover: oklch(calc(var(--canvas-l) + 1.6 * var(--step)) var(--surface-c) var(--surface-h));
  --sidebar-border: oklch(calc(var(--canvas-l) + 2 * var(--step)) var(--surface-c) var(--surface-h));
```

3e. Find the comment that opens `/* Declared on both selectors because var() resolves where a property is declared: a nested .dark`. Replace everything from it down to the `}` that closes its `:root,\n.dark {` block, just above `@theme inline {`, with:

```css
/* Absolute rungs, the same wherever they are read: the page (rung 0) and the overlays on rung 4. Declared on
   .dark too, so a nested .dark wrapper (the customer profile hero) resolves them with the dark settings. */
:root,
.dark {
  --background: oklch(calc(var(--canvas-l)) var(--surface-c) var(--surface-h));
  --popover: oklch(calc(var(--canvas-l) + 4 * var(--step)) var(--surface-c) var(--surface-h));
}

/* Relative tokens. Every surface declares them again, because var() resolves where a property is declared and
   is inherited as a finished colour: declared on :root alone, a card inside a card would get the page's answer.
   On the page itself (not a surface) they describe a card placed on it, rung 1; `muted` is always one rung above
   wherever it is read. */
:root,
.dark,
:is(.bg-card, .surface, .surface-beneath, .bg-popover, .surface-overlay) {
  --here-l: calc(var(--canvas-l) + max(var(--depth), 1) * var(--step));
  --card: oklch(var(--here-l) var(--surface-c) var(--surface-h));
  --muted: oklch(calc(var(--canvas-l) + (var(--depth) + 1) * var(--step)) var(--surface-c) var(--surface-h));
  --secondary: var(--muted);
  --accent: var(--muted);
  --band: oklch(calc(var(--here-l) + 0.5 * var(--step)) var(--surface-c) var(--surface-h));
  --border: oklch(calc(var(--here-l) + var(--edge-dir) * var(--edge)) var(--surface-c) var(--surface-h));
  --border-strong: oklch(calc(var(--here-l) + var(--edge-dir) * 2 * var(--edge)) var(--surface-c) var(--surface-h));
  --input-background: var(--card);
  --row-hover: color-mix(in oklab, var(--primary) 8%, var(--card));
  --row-selected: color-mix(in oklab, var(--primary) 12%, var(--card));
  --skeleton: var(--border);
  --skeleton-soft: oklch(
    calc(var(--here-l) + var(--edge-dir) * 0.75 * var(--edge)) var(--surface-c) var(--surface-h)
  );
}

/* A surface counts the surfaces it sits in, up to three. Variants (`md:bg-card`, `bg-card/50`) are other class
   names, so they are not surfaces. */
:is(.bg-card, .surface) {
  --depth: 1;
}
:is(.bg-card, .surface) :is(.bg-card, .surface) {
  --depth: 2;
}
:is(.bg-card, .surface) :is(.bg-card, .surface) :is(.bg-card, .surface) {
  --depth: 3;
}

/* Overlays render in portals, out of nesting's reach, and sit on the top rung. `surface-overlay` marks the glass
   ones, which paint their own fill. */
:is(.bg-popover, .surface-overlay) {
  --depth: 4;
}

/* The rung beneath the page: the public footer the page scrolls over. Comes after the relative block so its
   lightness wins. */
.surface-beneath {
  --depth: -1;
  --here-l: calc(var(--canvas-l) - var(--step));
}

/* The marketing world keeps its literal palette: its surfaces take the scope's values, not the ladder's. */
:is(.theme-marketing, .funnel-light) :is(.bg-card, .surface, .surface-beneath, .bg-popover, .surface-overlay) {
  --card: inherit;
  --muted: inherit;
  --secondary: inherit;
  --accent: inherit;
  --band: inherit;
  --border: inherit;
  --border-strong: inherit;
  --input-background: inherit;
  --row-hover: inherit;
  --row-selected: inherit;
  --skeleton: inherit;
  --skeleton-soft: inherit;
}

@utility surface {
  background-color: var(--card);
}

@utility surface-beneath {
  background-color: var(--card);
}
```

3f. In `@theme inline`, delete the line `  --color-surface-raised: var(--surface-raised);`.

- [ ] **Step 4: Run the check: only the expected non-ladder failures remain**

Run: `pnpm theme:check`
Expected: exit 1 with exactly these 9 failures. Each one is a colour tuned against the old white light card or a darker dark menu:

```
theme:check: 9 of 299 checks failed
  ✗ light: control border vs surface (page) is 2.85:1, needs 3:1
  ✗ light: control border vs surface (rung 1) is 2.85:1, needs 3:1
  ✗ light: focus ring vs page (page) is 2.99:1, needs 3:1
  ✗ light: series leads vs surface (rung 1) is 2.42:1, needs 3:1
  ✗ light: series leads vs surface (rung 2) is 2.60:1, needs 3:1
  ✗ light: series leads vs surface (rung 3) is 2.80:1, needs 3:1
  ✗ dark: muted text on step-up (overlay) is 4.25:1, needs 4.5:1
  ✗ dark: control border vs surface (rung 3) is 2.59:1, needs 3:1
  ✗ dark: control border vs surface (overlay) is 2.17:1, needs 3:1
```

- [ ] **Step 5: Apply the owner's ruling on those colours**

Spec §4.1: a failing text or control colour is proposed to the owner, not slipped in. The recommended values below are the smallest that pass:

| Token | Mode | Today | Recommended | Why |
|---|---|---|---|---|
| `--input` | light | `oklch(0.62 0.03 255)` | `oklch(0.6 0.03 255)` | field borders 3:1 on rung 1 |
| `--ring` | light | `oklch(0.58 0.15 238)` | `oklch(0.575 0.15 238)` | focus ring 3:1 on the page |
| `--series-leads` | light | `oklch(0.655 0.12 228)` | `oklch(0.59 0.12 228)` | chart bar 3:1 on cards |
| `--series-booked` | light | `oklch(0.56 0.14 236)` | `oklch(0.51 0.14 236)` | keeps the ramp's spacing below leads |
| `--series-sits` | light | `oklch(0.46 0.14 245)` | `oklch(0.43 0.14 245)` | keeps the ramp's spacing below booked |
| `--input` | dark | `oklch(0.53 0.04 256)` | `oklch(0.62 0.04 256)` | field borders 3:1 inside menus |
| `--muted-foreground` | dark | `oklch(0.75 0.03 252)` | `oklch(0.77 0.03 252)` | muted text on a chip inside a menu |

Edit each line in place: light values in the `:root, .funnel-light` block, dark values in the `.dark` block. If the owner rules differently, use their values and rerun Step 6. A failure the owner accepts as-is leaves its pair failing, so it has to be removed from `pairs` with a comment giving the owner's reason.

- [ ] **Step 6: Run the check to see it pass**

Run: `pnpm theme:check`
Expected: `theme:check: all 299 checks pass`

- [ ] **Step 7: Move the two `bg-surface-raised` users**

In `src/shared/components/ui/tabs.tsx:25`:
- replace `data-[state=active]:bg-background dark:data-[state=active]:text-foreground` with `data-[state=active]:bg-popover dark:data-[state=active]:text-foreground`;
- delete ` dark:data-[state=active]:bg-surface-raised`.

The line becomes:

```ts
        default: 'data-[state=active]:bg-popover dark:data-[state=active]:text-foreground dark:data-[state=active]:border-border text-foreground dark:text-muted-foreground h-[calc(100%-1px)] flex-1 rounded-md border border-transparent px-2 py-1 data-[state=active]:shadow-sm',
```

In `src/features/proposal-flow/ui/components/form/index.tsx:38`:

```ts
const TOOLBAR_BUTTON_ACTIVE = 'bg-popover shadow-sm dark:border-border'
```

- [ ] **Step 8: Nothing reads the removed tokens**

Run: `grep -rn "surface-raised\|--lift\|surface-card-l" src scripts`
Expected: no output.

- [ ] **Step 9: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: both pass. The four `src` files are the only ones changed.

- [ ] **Step 10: Shoot after**

Run: `node $S/shoot.mjs --base http://localhost:$PORT --out $SCRATCH/ladder-shots/task2`
Expected:
- `22 shot(s), 0 skipped`.
- `dashboard` reports depths `1` and `2`. The modules are surfaces, and any card inside one is at 2.
- If every page still reports only depth `0`, the dev server is serving stale CSS. Stop and ask the owner before restarting it or clearing `.next`.

- [ ] **Step 11: Read the reports**

Compare `before/report.json` and `task2/report.json` per shot:
- new `holes` (Review Focus 3);
- the `deepest` list (Review Focus 2);
- `seeThrough` entries (Review Focus 4).

Note each one with its page and element. These are what the owner will be asked about.

- [ ] **Step 12: Owner gate**

Show the owner, for every shot id and both schemes, `before` beside `task2`, and for the public pages also `live`. Point out:
- the pills (Review Focus 1);
- the notes from Step 11;
- dialogs and menus still use the old classes until Task 5, so dialogs show the page colour for now.

Ask whether the ladder reads right.
- A problem with the ladder itself goes back to the elevation-ladder skill for a retune. Don't hand-edit numbers.
- A problem with one surface goes on Task 7's list.

- [ ] **Step 13: Commit (Task 1's commit, then this task's), after the owner approves**

```bash
git status --short
git commit -m "feat(skills): elevation-ladder shoots the gate's before/after screenshots" -- .claude/skills/elevation-ladder/scripts/shoot.mjs .claude/skills/elevation-ladder/references/applying-values.md .claude/skills/elevation-ladder/SKILL.md
git commit -m "feat(theme): the elevation ladder: surfaces climb one rung per nesting level, the page darkest" -- "src/app/(frontend)/globals.css" scripts/check-theme-contrast.ts src/shared/components/ui/tabs.tsx src/features/proposal-flow/ui/components/form/index.tsx
```

End both messages with the attribution lines from the session's system reminder.

---

### Task 3: Dashboard module items are cards again

**Files:** the 15 files of `84428499`:
- in `src/features/agent-dashboard/ui/components/`:
  - `dashboard-day-agenda.tsx`, `dashboard-meeting-card.tsx`, `dashboard-meetings-hub.tsx`, `dashboard-module.tsx`;
  - `dashboard-list-section-skeleton.tsx`, `dashboard-project-card-skeleton.tsx`, `dashboard-proposal-card-skeleton.tsx`;
  - `dashboard-project-card.tsx`, `dashboard-project-section-list.tsx`, `dashboard-projects.tsx`;
  - `dashboard-proposal-card.tsx`, `dashboard-proposal-section-list.tsx`, `dashboard-proposals.tsx`;
- `src/shared/components/entities/entity-list/ui/entity-list.tsx`;
- `src/shared/modules/proposals/core/components/overview-card.tsx`.

**Interfaces:**
- Consumes: Task 2's nesting. A `bg-card` item inside a `bg-card` module is depth 2.
- Produces:
  - `EntityList`'s `renderItem` goes back to `(item: T) => ReactNode`. Today its only index users are the two section lists this task reverts.
  - `data-row-band` disappears; nothing else reads it (`grep -rn data-row-band src` lists only these files).

- [ ] **Step 1: Check nothing has edited these files since**

Run: `git log --oneline 84428499..HEAD -- $(git show --name-only --format= 84428499)`
Expected: no output. If any commit shows up, stop and apply the reversal by hand against today's code.

- [ ] **Step 2: Reverse the commit in the working tree only**

Run: `git diff 84428499~1 84428499 | git apply -R --check && git diff 84428499~1 84428499 | git apply -R`
Expected: no output.

Then run `git diff --stat`. Expected: the 15 files, 45 insertions and 54 deletions (the commit reversed).

- [ ] **Step 3: Type-check, lint, check**

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: all pass.

- [ ] **Step 4: Shoot**

Run: `node $S/shoot.mjs --base http://localhost:$PORT --out $SCRATCH/ladder-shots/task3 --only dashboard`
Expected: `2 shot(s), 0 skipped`, and depth `2` counts go up by the number of items on screen.

- [ ] **Step 5: Owner gate**

Show `task2/dashboard-*` beside `task3/dashboard-*`. The meeting, proposal and project items are cards one rung above their module, with an edge, lifting on hover.

- [ ] **Step 6: Commit after approval**

```bash
git status --short
git commit -m "feat(dashboard): module items are cards again, a rung above their module" -- $(git show --name-only --format= 84428499)
```

---

### Task 4: Public site: the footer sits beneath the page

**Files:**
- Modify: `src/shared/components/footer.tsx:12`

**Interfaces:**
- Consumes: Task 2's `surface-beneath` utility.

- [ ] **Step 1: Put the footer on rung −1**

Replace:

```tsx
    <footer className="text-foreground lg:sticky lg:bottom-0 w-full z-1 min-h-fit bg-muted">
```

with:

```tsx
    <footer className="text-foreground lg:sticky lg:bottom-0 w-full z-1 min-h-fit surface-beneath">
```

- [ ] **Step 2: Type-check, lint, check**

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: all pass.

- [ ] **Step 3: Shoot the public pages**

Run: `node $S/shoot.mjs --base http://localhost:$PORT --out $SCRATCH/ladder-shots/task4 --public`
Expected: `10 shot(s), 0 skipped`.

Also read the footer's colour: `grep -A3 '"home-footer-light"' $SCRATCH/ladder-shots/task4/report.json`. The report doesn't list the footer, so the screenshot carries the evidence.

- [ ] **Step 4: Owner gate**

Show three columns for `home-scrolled`, `home-footer`, `about`, `services` and `marketing`: `live`, `before` (Task 1) and `task4`. Point out:
- the footer is one rung darker than the page it slides from under;
- the scrolled navbar keeps its 95% page fill over content;
- `/test` (marketing) is unchanged.

Spec §6 keeps these out of scope; mention them, don't fix them:
- the `/about` headline and eyebrow in `text-secondary`, invisible on the live site too;
- the navbar CTA's near-white icons on the dark-mode primary.

- [ ] **Step 5: Commit after approval**

```bash
git status --short
git commit -m "feat(site): the footer sits a rung beneath the page it slides from under" -- src/shared/components/footer.tsx
```

---

### Task 5: Overlays: dialogs on rung 1, menus on rung 4

**Files:**
- Modify, background to `bg-card`:
  - `src/shared/components/ui/dialog.tsx:96`, `alert-dialog.tsx:67`, `sheet.tsx:63`: `'bg-background ` → `'bg-card `;
  - `drawer.tsx:61`: `group/drawer-content bg-background` → `group/drawer-content bg-card`.
- Modify, add the `surface-overlay` marker:
  - `src/shared/components/ui/dropdown-menu.tsx:45` and `:235`: `'text-popover-foreground backdrop-blur-xl ` → `'surface-overlay text-popover-foreground backdrop-blur-xl `;
  - `popover.tsx:36`: `'z-50 w-72 ` → `'surface-overlay z-50 w-72 `;
  - `tooltip.tsx:68`: `'z-50 w-fit max-w-xs ` → `'surface-overlay z-50 w-fit max-w-xs `;
  - `src/shared/components/charts/chart-tooltip-card.tsx:13`: `className="rounded-md px-3 py-2 text-popover-foreground"` → `className="surface-overlay rounded-md px-3 py-2 text-popover-foreground"`.
- Modify, highlights to `bg-row-hover`:
  - `dropdown-menu.tsx:78, 96, 132, 215`: `focus:bg-muted/50` → `focus:bg-row-hover`; on line 215 also `data-[state=open]:bg-muted/50` → `data-[state=open]:bg-row-hover`;
  - `select.tsx:110`: `focus:bg-accent focus:text-accent-foreground` → `focus:bg-row-hover focus:text-accent-foreground`;
  - `command.tsx:150`: `data-[selected=true]:bg-accent` → `data-[selected=true]:bg-row-hover`;
  - `context-menu.tsx:69, 129, 147, 172`: `focus:bg-accent` → `focus:bg-row-hover`; on line 69 also `data-[state=open]:bg-accent` → `data-[state=open]:bg-row-hover`.

**Interfaces:**
- Consumes: Task 2's `.surface-overlay` and `.bg-popover`, which are depth 4. Inside them `--row-hover` mixes over rung 4.
- `bg-card` on dialog content makes it a depth-1 surface, so cards inside a dialog are depth 2.

- [ ] **Step 1: Make the edits listed above**

Every replacement is a literal string swap on the named line, nothing else.

- [ ] **Step 2: Confirm the counts**

Run:

```bash
R=src/shared/components/ui
grep -c "'bg-card " $R/dialog.tsx $R/alert-dialog.tsx $R/sheet.tsx
grep -c "drawer-content bg-card" $R/drawer.tsx
grep -c "surface-overlay" $R/dropdown-menu.tsx $R/popover.tsx $R/tooltip.tsx src/shared/components/charts/chart-tooltip-card.tsx
grep -c "bg-row-hover" $R/dropdown-menu.tsx $R/select.tsx $R/command.tsx $R/context-menu.tsx
grep -n "bg-muted/50\|focus:bg-accent\|selected=true\]:bg-accent\|state=open\]:bg-accent" $R/dropdown-menu.tsx $R/select.tsx $R/command.tsx $R/context-menu.tsx
```

Expected:
- `1` for each of dialog, alert-dialog, sheet and drawer;
- `surface-overlay` counts: `2`, `1`, `1`, `1`;
- `bg-row-hover` counts: `5`, `1`, `1`, `5`;
- the last grep prints nothing.

- [ ] **Step 3: Type-check, lint, check**

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: all pass.

- [ ] **Step 4: Shoot**

Run: `node $S/shoot.mjs --base http://localhost:$PORT --out $SCRATCH/ladder-shots/task5 --only meetings-menu,customer-profile,proposal-edit,dashboard`
Expected: `8 shot(s), 0 skipped`.

- [ ] **Step 5: Check one value in the browser**

Run `node $SCRATCH/overlay-probe.mjs`, written as below. It prints the dialog's and the open menu's `--depth` and background:

```js
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import process from 'node:process'

const REPO = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website'
const env = readFileSync(`${REPO}/.env.local`, 'utf8')
const secret = /^DEV_LOGIN_SECRET=(.*)$/m.exec(env)?.[1]?.trim().replace(/^["']|["']$/g, '')
const port = /^PORT=(\d+)/m.exec(env)?.[1] ?? '3000'
const { chromium } = createRequire(`${REPO}/package.json`)('playwright')
const browser = await chromium.launch()
for (const scheme of ['light', 'dark']) {
  const page = await browser.newPage({ colorScheme: scheme, viewport: { width: 1440, height: 900 } })
  await page.goto(`http://localhost:${port}/api/dev/playwright-session?secret=${encodeURIComponent(secret)}&redirect=${encodeURIComponent('/dashboard/meetings')}`, { waitUntil: 'domcontentloaded', timeout: 120000 }).catch(e => { console.error(String(e.message).split(secret).join('<secret>')); process.exit(1) })
  await page.waitForTimeout(4000)
  await page.locator('tbody button:has(> .sr-only:text-is("Actions"))').first().click()
  const menu = await page.locator('[role="menu"]').first().evaluate(el => ({ depth: getComputedStyle(el).getPropertyValue('--depth').trim(), card: getComputedStyle(el).getPropertyValue('--card').trim() }))
  await page.keyboard.press('Escape')
  await page.locator('tbody button.decoration-dotted').first().click()
  const dialog = await page.locator('[role="dialog"]').first().evaluate(el => ({ depth: getComputedStyle(el).getPropertyValue('--depth').trim(), bg: getComputedStyle(el).backgroundColor }))
  console.log(scheme, JSON.stringify({ menu, dialog }))
  await page.close()
}
await browser.close()
```

Expected: in both schemes `menu.depth` is `4` and `dialog.depth` is `1`. The dialog background is about L 0.918 in light and 0.206 in dark.

- [ ] **Step 6: Owner gate**

Show `task2` beside `task5` for `meetings-menu`, `customer-profile` and `proposal-edit`:
- dialogs are one rung above the page;
- the hovered menu item is visible (Review Focus 5);
- holes inside the dialog come from the `holes` list in `task5/report.json` (Review Focus 3).

- [ ] **Step 7: Commit after approval**

```bash
git status --short
R=src/shared/components/ui
git commit -m "feat(theme): dialogs and sheets sit a rung above the page; menus on the top rung highlight with the row tint" -- $R/dialog.tsx $R/alert-dialog.tsx $R/sheet.tsx $R/drawer.tsx $R/dropdown-menu.tsx $R/popover.tsx $R/tooltip.tsx $R/select.tsx $R/command.tsx $R/context-menu.tsx src/shared/components/charts/chart-tooltip-card.tsx
```

---

### Task 6: Records tables: a sheet with striped rows

**Precondition:** Task 4 of `docs/superpowers/plans/2026-10-01-records-table-render-isolation.md` is committed: `src/shared/components/data-table/ui/data-table-row.tsx` exists, and `git status --short src/shared/components/data-table` is empty.

If not, stop and ask the owner which goes first. If the ladder goes first, apply the row changes below in `data-table-body.tsx` instead, and tell the owner the other plan's Task 4 must carry them over.

**Files:**
- Modify: `src/shared/components/data-table/ui/data-table.tsx`: the wrapper `<div className="grow min-h-0 flex flex-col rounded-xl border border-border/50 overflow-hidden">`, `<TableHeader className="sticky top-0 z-10 bg-background">`, and the frozen header cell's `'sticky left-0 z-30 bg-background border-r border-border/50'`.
- Modify: `src/shared/components/data-table/ui/data-table-row.tsx`: the row `TableRow`, the frozen body cell, and the body cells.
- Modify: `src/shared/components/data-table/constants/cell-border.ts`
- Modify: `src/shared/components/ui/table.tsx:60` (`TableRow`)

**Interfaces:**
- Consumes: Task 2's `surface` utility and `bg-(--card)`.
- Produces:
  - Rows carry `data-band="odd" | "even"` by their rendered position (the index of `table.getRowModel().rows.map`), not `nth-child`, so expanded-panel rows don't break the stripe.
  - `DataTableRow` gains a prop `isOddRow: boolean`.

- [ ] **Step 1: Write the failing browser check**

Create `$SCRATCH/table-probe.mjs`:
- start from Task 5's overlay probe: same sign-in and redaction, redirect to `/dashboard/meetings`;
- replace its body after `waitForTimeout(4000)` with:

```js
  const rows = await page.locator('tbody tr:not([data-expanded-row])').evaluateAll(trs => trs.slice(0, 4).map(tr => ({ band: tr.dataset.band, bg: getComputedStyle(tr).backgroundColor })))
  const header = await page.locator('thead').first().evaluate(el => getComputedStyle(el).backgroundColor)
  const sheet = await page.locator('table').first().evaluate(el => getComputedStyle(el.closest('.surface')).backgroundColor)
  await page.locator('tbody tr:not([data-expanded-row])').nth(1).hover()
  await page.waitForTimeout(300)
  // The first cell is the frozen one only while the table is frozen (the pin in its header).
  const hovered = await page.locator('tbody tr:not([data-expanded-row])').nth(1).evaluate(tr => ({ row: getComputedStyle(tr).backgroundColor, frozen: tr.cells[0].classList.contains('sticky') ? getComputedStyle(tr.cells[0]).backgroundColor : undefined }))
  const ok = rows[0].band === 'even' && rows[1].band === 'odd' && rows[0].bg !== rows[1].bg && rows[0].bg === rows[2].bg && header === sheet && (hovered.frozen === undefined || hovered.row === hovered.frozen)
  console.log(scheme, ok ? 'PASS' : 'FAIL', JSON.stringify({ rows, header, sheet, hovered }))
```

Run: `node $SCRATCH/table-probe.mjs`
Expected: it fails. With no `.surface` ancestor it throws inside `evaluate`, or it prints `FAIL`.

- [ ] **Step 2: The table is a sheet on its rung**

In `data-table.tsx`, replace the wrapper class `grow min-h-0 flex flex-col rounded-xl border border-border/50 overflow-hidden` with `grow min-h-0 flex flex-col rounded-xl border overflow-hidden surface`.

- [ ] **Step 3: The header takes the sheet's colour without becoming a surface**

In `data-table.tsx`:
- replace `<TableHeader className="sticky top-0 z-10 bg-background">` with `<TableHeader className="sticky top-0 z-10 bg-(--card)">`;
- in the frozen header cell, replace `'sticky left-0 z-30 bg-background border-r border-border/50'` with `'sticky left-0 z-30 bg-(--card) border-r border-border/50'`.

- [ ] **Step 4: Rules: the header keeps its edge, body cells lose theirs**

`constants/cell-border.ts`:

```ts
// The header's rule and an open row's panel edge. Body rows have none: the stripes separate them.
export const CELL_BORDER = 'border-b border-border'
```

In `data-table-row.tsx`:
- the plain body cell `<TableCell key={cell.id} className={CELL_BORDER}>` becomes `<TableCell key={cell.id} className={customRowClass}>`;
- remove `CELL_BORDER` from the frozen body cell's `cn(...)`.

Keep it on the expanded-row cell.

- [ ] **Step 5: Stripes, hover, and the frozen cell follow the row**

In the parent that maps rows (`data-table-body.tsx`), pass `isOddRow={index % 2 === 1}`, where `index` is the map index.

In `data-table-row.tsx`:
- the row `TableRow` gets `data-band={isOddRow ? 'odd' : 'even'}` and `className={cn('group cursor-pointer bg-(--card) hover:bg-row-hover', isOddRow && 'bg-band')}`.
- The status tint (`customRowClass`) moves off the row onto each body cell (Step 4), so it layers over the stripe instead of replacing it.
- The frozen body cell's `cn(...)` gains `'bg-inherit'`, so it carries the row's colour in every state.
- Delete its base layer `<div className="absolute inset-0 bg-background group-hover:bg-muted/50 transition-colors" />`.
- Keep the `customRowClass` overlay div.

In `src/shared/components/ui/table.tsx:60`, replace `'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors'` with `'hover:bg-row-hover data-[state=selected]:bg-row-selected border-b transition-colors'`.

- [ ] **Step 6: Run the check to see it pass**

Run: `node $SCRATCH/table-probe.mjs`
Expected: `light PASS …` and `dark PASS …`.

- [ ] **Step 7: Type-check, lint, check**

Run: `pnpm tsc && pnpm lint && pnpm theme:check`
Expected: all pass.

- [ ] **Step 8: Shoot**

Run: `node $S/shoot.mjs --base http://localhost:$PORT --out $SCRATCH/ladder-shots/task6 --only meetings,meetings-menu,customer-profile`
Expected: `6 shot(s), 0 skipped`. `meetings` reports no `holes`: the header and frozen column no longer paint `bg-background`.

- [ ] **Step 9: Owner gate**

Show `before`, `task5` and `task6` for `meetings`:
- the table is a sheet one rung above the page;
- rows alternate in half-rung stripes, as in the picker;
- hover tints the whole row, frozen cell included;
- upcoming and in-progress meetings keep their status tint over the stripe.

Also scroll the table sideways by hand in the owner's browser: the frozen column stays opaque.

- [ ] **Step 10: Commit after approval**

```bash
git status --short
D=src/shared/components/data-table
git commit -m "feat(records): tables are a sheet on their rung with striped rows; the header and frozen column take the row's colour" -- $D/ui/data-table.tsx $D/ui/data-table-row.tsx $D/ui/data-table-body.tsx $D/constants/cell-border.ts src/shared/components/ui/table.tsx
```

---

### Task 7: Surfaces the owner flags (repeat per flag)

**Files:** one component per round, named by the flag.

Each round:

- [ ] **Step 1: Find the element.** Use the shoot report (`holes`, `seeThrough`, `deepest`) or the Playwright browser, and read its class list in the source.
- [ ] **Step 2: Pick the fix by what the element is.**
  - A `bg-background` hole inside a surface that should match the surface: `bg-(--card)`. If it should sit above it: `bg-muted`.
  - A see-through `bg-card/N` or `bg-muted/N` that vanished: `bg-muted` (one rung up) or no fill.
  - `bg-card` used as a plain fill that climbed a rung (a sticky header, a toggle): `bg-(--card)`.
  - A real card that sits flat inside another: give it `bg-card` so it climbs.
- [ ] **Step 3: Run `pnpm tsc && pnpm lint && pnpm theme:check`**, then shoot that page with `--only <id>` (or a one-off shot for a page not in the list).
- [ ] **Step 4: Owner gate** on the before/after pair.
- [ ] **Step 5: Commit that one file** after approval: `git commit -m "fix(theme): <surface> <what changed>" -- <file>`.

---

### Task 8: The elevation-ladder skill measures real rungs

**Files:**
- Modify: `.claude/skills/elevation-ladder/scripts/measure.mjs` (whole file)
- Modify: `.claude/skills/elevation-ladder/assets/ladder-template.html` (`ladderFor`, `edgeOf`, `upOf`, the table band)
- Modify: `.claude/skills/elevation-ladder/ladder.json` (`measure.map.levels`, `applied`, `history`)
- Modify: `.claude/skills/elevation-ladder/references/applying-values.md` (status paragraph), `.claude/skills/elevation-ladder/SKILL.md` (the `measure.map` bullet)

**Interfaces:**
- Consumes:
  - The rung classes from Task 2.
  - `surface-beneath` in use from Task 4. Tailwind only ships a `@utility` that some source uses.
- Produces: measured presets gain `chipAt`, `bandAt` and `edgeAt`, maps keyed by rung. The template prefers them over the single `chip`, `band` and `edge`.

- [ ] **Step 1: Write the new map in `ladder.json`**

Replace `measure.map.levels` with:

```json
      "levels": {
        "-1": { "chain": ["surface-beneath"], "else": "--muted" },
        "0": { "chain": [] },
        "1": { "chain": ["bg-card"] },
        "2": { "chain": ["bg-card", "bg-card"] },
        "3": { "chain": ["bg-card", "bg-card", "bg-card"] },
        "4": { "chain": ["bg-popover"] }
      },
```

- [ ] **Step 2: Rewrite `measure.mjs`**

Each rung is built in the page as its chain of classes, and chips, bands and edges are read inside it:

```js
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
```

- [ ] **Step 3: Let the template use the per-rung values**

In `assets/ladder-template.html`, replace:

```js
    return { lv: m.lv, chip: m.chip, band: m.band, edge: m.edge, relative: false, text: m.text ?? {} }
```

with:

```js
    return { lv: m.lv, chip: m.chip, band: m.band, edge: m.edge, chipAt: m.chipAt, bandAt: m.bandAt, edgeAt: m.edgeAt, relative: false, text: m.text ?? {} }
```

Replace:

```js
    const edgeOf = n => lad.relative ? col(shift(n, dir * edgeD)) : (lad.edge ? col(lad.edge) : surf(n))
    const upOf = n => lad.relative ? col(shift(n, lad.step)) : (lad.chip ? col(lad.chip) : surf(n))
```

with:

```js
    // A measured build reports its chip, band and edge per rung; older presets carry one value for all rungs.
    const measured = (byRung, single, n, fallback) => byRung?.[n] ? col(byRung[n]) : (single ? col(single) : fallback)
    const edgeOf = n => lad.relative ? col(shift(n, dir * edgeD)) : measured(lad.edgeAt, lad.edge, n, surf(n))
    const upOf = n => lad.relative ? col(shift(n, lad.step)) : measured(lad.chipAt, lad.chip, n, surf(n))
```

And replace:

```js
        const band = lad.relative ? col(shift(n, lad.step * 0.5)) : (lad.band ? col(lad.band) : row)
```

with:

```js
        const band = lad.relative ? col(shift(n, lad.step * 0.5)) : measured(lad.bandAt, lad.band, n, row)
```

- [ ] **Step 4: Measure both builds and check the rungs climb**

```bash
node $S/measure.mjs --url http://localhost:$PORT/ --id current --label "Local build now" --out $SCRATCH/ladder-current.json
node $S/measure.mjs --url https://triprosremodeling.com/ --id live --label "Live site today" --out $SCRATCH/ladder-live.json
```

Expected:
- Local prints `light 0:0.894 1:0.918 2:0.942 3:0.966 4:0.990 -1:0.870 · dark 0:0.159 1:0.206 2:0.253 3:0.300 4:0.347 -1:0.112`, within ±0.001.
- Live prints equal lightness for rungs 1–3: its cards don't climb. On 2026-10-01 live read `light 0:0.985 1:1.000 2:1.000 3:1.000 4:1.000 -1:0.967 · dark 0:0.243 1:0.242 2:0.242 3:0.242 4:0.268 -1:0.303`.

- [ ] **Step 5: Lint**

Run: `pnpm exec eslint .claude/skills/elevation-ladder/scripts/measure.mjs`
Expected: no output.

- [ ] **Step 6: Record the application and update the notes**

In `ladder.json`, set `"applied": { "date": "<Task 2 commit date>", "commit": "<Task 2 commit hash>" }`, and append a `history` entry:

```json
    { "date": "<that date>", "values": "light canvas 0.894 step 0.024 tint 0.017 · dark canvas 0.159 step 0.047 tint 0.059 · hue 253 · edge 0.048", "note": "Applied to the app's tokens in <hash>, with the owner's contrast rulings on --input, --ring, the series ramp and dark --muted-foreground." }
```

In `references/applying-values.md`, replace the paragraph that starts `**Status on 2026-10-01:** the app does not have rung tokens yet.` and the sentence after it (`Once rung tokens exist, also update …`) with:

```markdown
**Where each number goes.** Light values sit in the `:root, .funnel-light` block and dark values in `.dark`: canvas → `--canvas-l`, step → `--step`, tint → `--surface-c`. Hue → `--surface-h` and edge → `--edge` are declared once, in `:root, .funnel-light`. Everything else (rungs, chips, bands, edges, the dark rail) derives from these. After a change, `pnpm theme:check` resolves every text and control colour on every rung; a failure there is the owner's call, not a number to nudge quietly.
```

In `SKILL.md`, replace the bullet that starts `- When the app's tokens change (for example once rung tokens exist), update` with:

```markdown
- `measure.map.levels` builds each rung in the page as a chain of classes (`bg-card` nested for rungs 1–3, `bg-popover` for 4, `surface-beneath` for −1) and reads what paints. If the app renames its surface classes, update the chains.
```

- [ ] **Step 7: Rebuild and republish the picker**

Run: `node $S/build.mjs --out $SCRATCH/elevation-ladder.html $SCRATCH/ladder-current.json $SCRATCH/ladder-live.json`

Publish `$SCRATCH/elevation-ladder.html` with the Artifact tool to the `artifact` URL in `ladder.json`. Read the artifact first if this conversation hasn't published it.

Open "Local build now" on the page. Expected: its scenes look like the proposed ladder.

- [ ] **Step 8: Commit after the owner has seen the page**

```bash
git status --short
K=.claude/skills/elevation-ladder
git commit -m "feat(skills): elevation-ladder measures each rung as the app builds it, and records the applied pick" -- $K/scripts/measure.mjs $K/assets/ladder-template.html $K/ladder.json $K/references/applying-values.md $K/SKILL.md
```

- [ ] **Step 9: Update memory**

Update `project-surface-elevation.md`: the ladder is applied (commit hashes per task), any Task 7 rounds still open, and the follow-ups spec §6 keeps out of scope. Then update its line in `MEMORY.md`.
