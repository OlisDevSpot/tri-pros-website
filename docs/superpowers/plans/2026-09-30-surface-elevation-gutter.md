# Surface Elevation and Gutter Line Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The dashboard's page background becomes the lowest, darkest layer, with the sidebar, cards and records tables one lightness step above it. Every surface comes from one hue and a lightness ramp. Records rows are told apart by solid bands, and one 8px gutter lays out the whole shell.

**Architecture:** `globals.css` gets four settings per mode (hue, tint strength, page lightness, step size) and one `:root, .dark` block that derives every surface token from them with plain `oklch(calc(var(...)))` channels. Components then read solid tokens only: `bg-card`, `bg-band`, `bg-row-hover` and so on, never `bg-muted/40`. A new ESLint rule keeps see-through surface classes out, and `pnpm theme:check` learns to evaluate the formulas.

**Tech Stack:** Next.js 15, React 19, Tailwind v4.1 (`@theme inline`), shadcn/ui, next-themes (`attribute="class"`), ESLint flat config (antfu), `tsx` scripts, Playwright (the repo's own `playwright` package, driven from scratch scripts).

**Spec:** `docs/superpowers/specs/2026-09-30-surface-elevation-gutter-design.md` (approved 2026-09-30). Supporting data: `docs/plans/2026-09-30-surface-alpha-sweep-inventory.md` (every one of the 488 usages with its target), `docs/plans/2026-09-30-surface-ramp-research.md` (why the formulas look the way they do). Read the spec before any task. Read the inventory before any sweep task.

## Global Constraints

- **Shared working tree.** Other sessions have uncommitted work in this tree. Never `git stash`, `git checkout -- <path>`, `git restore`, `git reset` or `git add -A`/`git add .`. Stage by explicit pathspec only.
- **Commits.** Commit only after the owner has answered the commit question at execution handoff. If the answer is "no commits", skip every Commit step and list the touched files in the task report instead.
- **Verification.** Use `pnpm theme:check`, `pnpm lint`, `pnpm tsc` and the Playwright checks in this plan. **Never run `pnpm build`.**
- **Rendered CSS.** Before judging anything rendered, confirm the served CSS contains the new tokens (the verify script aborts if `--band` is missing). If it is stale, run `ss -ltnp` to see whose dev server holds the port. Ask the owner to stop it, `rm -rf .next` and restart. Never kill a server you did not start.
- **Docs.** The spec, this plan, the research note, the inventory, `DESIGN.md` edits and the follow-ups doc stay uncommitted until the owner says otherwise.
- **Code comments** say why, never what. No banners, and no references to this plan or the spec from code.
- **Browser floor.** Safari/iPadOS 16.4 and Chrome 111. So: no `oklch(from …)` relative colours in anything this plan writes. `color-mix(in oklab, …)` and `calc()`/`min()` inside `oklch()` are fine.
- **Setting values** (spec §4.1), copied verbatim:
  - light: `--surface-h: 255`, `--surface-c: 0.012`, `--canvas-l: 0.945`, `--lift: 0.055`, `--edge-dir: -1`
  - dark: `--surface-c: 0.045`, `--canvas-l: 0.16`, `--lift: 0.045`, `--edge-dir: 1`
  - `--gutter: 0.5rem`
- **No Data access changes.** No DAL, tRPC, schema, seed or service file is touched (spec §5).
- **No real people in screenshots that leave the machine.** Playwright screenshots stay in the scratchpad. Nothing from them is published.
- **2px type rule and palette rule** stay in force: no `text-[Npx]`, no raw palette classes.
- **Line numbers drift.** Every `file:line` in this plan and in the inventory is a hint. Match on the file plus the class string.

### Files off limits

Do not edit these, even when a search hits them:

- `src/shared/db/**`, `src/trpc/**`, `**/dal/**`, `scripts/*` except `scripts/check-theme-contrast.ts`, `package.json`, `pnpm-lock.yaml`.
- `src/features/meeting-flow/ui/components/steps/who-we-are/**`, `…/steps/portfolio/**`, `…/steps/specialties/**`. These are presentation-palette surfaces, outside the app ramp (inventory §3/§5).
- `src/shared/components/states/coming-soon-state.tsx` (decorative, kept by the inventory).
- The public-site `secondary`-as-accent rows (inventory rows marked `n/a: secondary used as accent`) and the proposal-flow navbar files `src/features/proposal-flow/ui/components/navbar/{navbar-frame,navbar,navbar-menu}.tsx`. Both are follow-ups (spec §4.7, §9).
- Any file not named in a task or in the inventory. If a task seems to need one, stop and ask.

### Dirty files in the tree (read before Task 0)

At plan time (2026-09-30), Navy Rail **Part B** (the phone dock) is uncommitted in the same files this plan edits:

| File | Part B hunk | This plan edits |
|---|---|---|
| `src/app/(frontend)/globals.css` | `z-index: 60` dock rule near line 990 | token blocks, `@theme inline` |
| `src/shared/components/ui/sidebar.tsx` | `SidebarOpenMobileContext`, bottom-sheet drawer, mobile tooltip skip | floating inset, collapsed widths, sub-button active icon |
| `src/features/agent-dashboard/constants/dashboard-main.ts` | phone bottom padding for the dock | the same class string (md padding) |
| `src/shared/components/ui/drawer.tsx` | drawer edits | inventory row (scrim, kept) |
| `src/shared/components/pwa-install-prompt.tsx` | one-line edit | inventory row `bg-popover/95` |
| `src/features/agent-dashboard/ui/components/mobile-dock-tab.tsx` (untracked) | new file | active icon token |
| `src/shared/components/ui/sidebar-mobile-drawer.tsx` (untracked) | new file | kept (lint ignore only) |
| `app-sidebar.tsx`, `dashboard-mobile-nav.tsx`, `dashboard-session-mobile-nav.tsx`, `mobile-dock*.tsx`, `mobile-bottom-nav.tsx` (staged delete) | Part B | `mobile-dock-capsule.tsx` reads `bg-sidebar-accent` (no edit needed) |

`data-table.tsx` was dirty when the spec was written. Commit `89ca2117` has since shipped it, and it is clean now.

Staging a whole file stages every hunk in it, and this plan cannot stage part of a file (`git add -p` is interactive and not available). So **Task 0 gates on Part B**: either it is committed first, or the owner rules that this plan's commits carry it.

## Review Focus

These are the input classes the spec implies that are most likely to bite a person, most likely first. Each has a test in the owning task.

1. **Horizontal scroll on a banded table.** The frozen first column must show the same fill as its row for even, odd, hover, expanded and status-tinted rows, with no scrolled text showing through. Test: Task 5 `tables` check (frozen fill colour equals row colour, for each row state).
2. **The customer-profile hero opened in light mode.** A nested `.dark` wrapper must render dark surfaces, not the page's light ones. Test: Task 2 `ramp` check (nested `.dark` probe).
3. **Expanding a row.** The rows below keep their bands, and the expanded row reads as selected. Test: Task 5 `tables` check (`data-band` list identical before and after expanding; expanded row colour equals `row-selected`).
4. **Funnel and marketing pages.** Their literal warm palettes must still win over the new formulas. Test: Task 16 `scopes` check (`.funnel-light` / `.theme-marketing` computed background is still `#faf7f1`).
5. **The icon-collapsed rail on iPad portrait (820px).** Rail inset, main padding and the rail-to-content gap all stay 8px, with the rail collapsed or expanded. Test: Task 4 `gutter` check (runs at 820 and 1024, both rail states).

---

## Task 0: Pre-flight gate (no code)

**Files:** none edited.

- [ ] **Step 1: Snapshot the tree**

Run: `git status --short && git diff --cached --stat`
Expected: the Part B files listed above are the only dirty `src/` files this plan touches. If any other file this plan edits is dirty, **stop and ask the owner**: another session is working in it.

- [ ] **Step 2: Part B gate**

Ask the owner (AskUserQuestion, recommended first):
1. "Commit Part B first (recommended)". The owner or their session commits Part B. Continue once `git status --short src/app/\(frontend\)/globals.css src/shared/components/ui/sidebar.tsx src/features/agent-dashboard/constants/dashboard-main.ts` prints nothing.
2. "This work's commits carry Part B". Commits that stage those files include Part B's hunks, and their messages say so.
3. "No commits at all". Skip every Commit step.

- [ ] **Step 3: Baseline**

Run: `pnpm theme:check && pnpm lint && pnpm tsc`
Expected: all three pass. If one fails before any edit, record the failure and ask; do not fix unrelated failures.

- [ ] **Step 4: Dev server**

Run: `ss -ltnp | grep -E ':(3000|3001|3002)\b'` and `grep -E '^PORT=' .env.local || echo 'PORT unset (3000)'`
Expected: note which port answers. The verify script reads `PORT` from `.env.local` itself. If no server answers, ask the owner to start `pnpm dev`. Do not start one in the background of their tree without asking.

---

## Task 1: `theme:check` evaluates formulas and knows the new pairs (red)

**Files:**
- Modify: `scripts/check-theme-contrast.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `pnpm theme:check`, which reads three blocks from `globals.css`: `:root, .funnel-light` (settings plus light literals), `.dark` (dark settings plus literals) and `:root, .dark` (the ramp). It evaluates `var()`, `calc()`, `min()`, `max()`, `oklch(… / a)` and `color-mix(in oklab, A p%, B)`. Later tasks rely on the new pair labels and step checks listed below.

- [ ] **Step 1: Replace block reading and colour resolution**

In `scripts/check-theme-contrast.ts`, replace everything from `const blocks: Record<Mode, Tokens> = {` through the end of `function toLinearRgba` with:

```ts
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
```

Delete the old `resolve` function (the one with `hops`). The new `resolve` above replaces it.

- [ ] **Step 2: Per-mode minimums**

Change the `Pair` interface's `min: number` to:

```ts
  /** Non-text steps can need a different floor per mode; see the border pairs. */
  min: number | Record<Mode, number>
```

In the pair loop, replace `if (ratio < pair.min) {` and the push under it with:

```ts
      const min = typeof pair.min === 'number' ? pair.min : pair.min[mode]
      if (ratio < min) {
        failures.push(`${mode}: ${pair.label} is ${ratio.toFixed(2)}:1, needs ${min}:1`)
      }
```

- [ ] **Step 3: New pairs and surface steps**

Append these entries to `pairs` after the existing `'active nav label on pill'` line:

```ts
  { label: 'body text on band', fg: '--foreground', bg: '--band', min: 4.5 },
  { label: 'muted text on band', fg: '--muted-foreground', bg: '--band', min: 4.5 },
  { label: 'muted text on muted', fg: '--muted-foreground', bg: '--muted', min: 4.5 },
  { label: 'body text on hovered row', fg: '--foreground', bg: '--row-hover', min: 4.5 },
  { label: 'body text on selected row', fg: '--foreground', bg: '--row-selected', min: 4.5 },
  { label: 'sidebar label on hover', fg: '--sidebar-foreground', bg: '--sidebar-hover', min: 4.5 },
  { label: 'sidebar label on active pill', fg: '--sidebar-foreground', bg: '--sidebar-accent', min: 4.5 },
  { label: 'active icon on pill', fg: '--sidebar-active-icon', bg: '--sidebar-accent', min: 3 },
  // The spec's own dark values give 1.29:1 for border and skeleton on a card; the dark floor is 1.25 until the iPad check tunes the settings.
  { label: 'border vs card', fg: '--border', bg: '--card', min: { light: 1.3, dark: 1.25 } },
  { label: 'skeleton bar vs card', fg: '--skeleton', bg: '--card', min: { light: 1.3, dark: 1.25 } },
  { label: 'skeleton block vs card', fg: '--skeleton-soft', bg: '--card', min: 1.15 },
```

Replace the `depthSteps` constant and its comment with:

```ts
// Sunlight from above: every step must sit where the ramp puts it. In light mode nothing can be lighter than
// the card (white), so the band and borders step down from it; in dark mode they step up.
const depthSteps: Record<Mode, [string, string][]> = {
  light: [['--card', '--background'], ['--muted', '--background'], ['--card', '--muted'], ['--card', '--band'], ['--band', '--border']],
  dark: [['--card', '--background'], ['--muted', '--background'], ['--card', '--muted'], ['--band', '--card'], ['--border', '--band'], ['--surface-raised', '--card'], ['--sidebar', '--background']],
}
```

- [ ] **Step 4: Run it and confirm it fails for the right reason**

Run: `pnpm theme:check`
Expected: exit 1. The failures name the missing ramp block (`No block matches /^:root,\s*\.dark\s*\{/m`) or undeclared tokens (`--band is not declared`, `--row-hover is not declared`, `--sidebar-active-icon is not declared`). Nothing else should fail: no parse errors on existing literals. If an existing pair fails to parse, fix the evaluator before moving on.

Then run: `pnpm lint scripts/check-theme-contrast.ts && pnpm tsc`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/check-theme-contrast.ts
git commit -m "feat(theme): theme:check evaluates the surface formulas and checks the new pairs

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(Commit the red check only together with Task 2 if the owner prefers every commit green. Ask once at handoff.)

---

## Task 2: The surface ramp in `globals.css` (green)

**Files:**
- Modify: `src/app/(frontend)/globals.css` (`:root, .funnel-light` block, `.dark` block, new `:root, .dark` block, `@theme inline`)
- Modify: `src/shared/components/ui/dropdown-menu.tsx:48,238` (inline relative colour becomes the glass token)
- Create (scratch, not in repo): `$SCRATCH/surface-verify/verify.mjs`, `$SCRATCH/surface-verify/checks/ramp.mjs`, where `SCRATCH=/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/d66834fb-9e71-41fa-9640-c8e7260f2968/scratchpad`

**Interfaces:**
- Consumes: Task 1's `theme:check`.
- Produces these CSS tokens (all solid): `--background`, `--muted`, `--secondary`, `--accent`, `--band`, `--card`, `--input-background`, `--surface-raised`, `--popover`, `--border`, `--border-strong`, `--row-hover`, `--row-selected`, `--skeleton`, `--skeleton-soft`, `--gutter`. The Tailwind utilities `bg-band`, `bg-row-hover`, `bg-row-selected`, `bg-skeleton`, `bg-skeleton-soft` (and `border-*`/`divide-*` forms) exist. The glass token is `--popover-glass`, built with `color-mix`. The verify harness is `node $SCRATCH/surface-verify/verify.mjs <check…>`.

- [ ] **Step 1: Settings on `:root, .funnel-light`**

In the `:root, .funnel-light` block, delete these declarations: `--background`, `--card`, `--popover`, `--surface-raised`, `--secondary`, `--muted`, `--accent`, `--border`, `--border-strong`, `--input-background`. Keep `--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--accent-foreground`, `--muted-foreground`, `--input` and every non-surface token. Directly after `color-scheme: light;`, insert:

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
  /* The floating rail's inset, the page margin and every gap between section cards. */
  --gutter: 0.5rem;
```

Replace the light `--popover-glass` line and its comment's last sentence so the declaration reads:

```css
  --popover-glass: color-mix(in oklab, var(--popover) 78%, transparent);
```

- [ ] **Step 2: Settings on `.dark`**

In the `.dark` block, delete the declarations `--background`, `--card`, `--popover`, `--surface-raised`, `--secondary`, `--muted`, `--accent`, `--border`, `--border-strong`, `--input-background`. Directly after `color-scheme: dark;`, insert:

```css
  --surface-c: 0.045;
  --canvas-l: 0.16;
  --lift: 0.045;
  --edge-dir: 1;
  /* Dark bands need a bigger step than light ones to read at the same strength. */
  --band: oklch(calc(var(--canvas-l) + 1.5 * var(--lift)) var(--surface-c) var(--surface-h));
```

Replace the dark `--popover-glass` literal with:

```css
  --popover-glass: color-mix(in oklab, var(--popover) 62%, transparent);
```

- [ ] **Step 3: The ramp block**

Insert this block directly after the closing `}` of the `.dark` block, before `@theme inline {`:

```css
/* Declared on both selectors because var() resolves where a property is declared: a nested .dark
   wrapper (the customer profile hero) must recompute its surfaces from its own settings, not
   inherit the page's light values. */
:root,
.dark {
  --surface-card-l: min(1, var(--canvas-l) + var(--lift));
  --background: oklch(calc(var(--canvas-l)) var(--surface-c) var(--surface-h));
  --muted: oklch(calc(var(--canvas-l) + 0.5 * var(--lift)) var(--surface-c) var(--surface-h));
  --secondary: var(--muted);
  --accent: var(--muted);
  --card: oklch(calc(var(--surface-card-l)) var(--surface-c) var(--surface-h));
  --input-background: var(--card);
  /* Light mode clamps at white, so the step above the card is carried by shadow there. */
  --surface-raised: oklch(calc(min(1, var(--canvas-l) + 2 * var(--lift))) var(--surface-c) var(--surface-h));
  --popover: var(--surface-raised);
  --border: oklch(calc(var(--surface-card-l) + var(--edge-dir) * 2 * var(--lift)) var(--surface-c) var(--surface-h));
  --border-strong: oklch(calc(var(--surface-card-l) + var(--edge-dir) * 3 * var(--lift)) var(--surface-c) var(--surface-h));
  --row-hover: color-mix(in oklab, var(--primary) 8%, var(--card));
  --row-selected: color-mix(in oklab, var(--primary) 12%, var(--card));
  --skeleton: var(--border);
  --skeleton-soft: oklch(calc(var(--surface-card-l) + var(--edge-dir) * 1.5 * var(--lift)) var(--surface-c) var(--surface-h));
}
```

- [ ] **Step 4: `@theme inline` lines**

In `@theme inline`, after `--color-surface-raised: var(--surface-raised);`, add:

```css
  --color-band: var(--band);
  --color-row-hover: var(--row-hover);
  --color-row-selected: var(--row-selected);
  --color-skeleton: var(--skeleton);
  --color-skeleton-soft: var(--skeleton-soft);
```

- [ ] **Step 5: The dropdown glass reads the token**

In `src/shared/components/ui/dropdown-menu.tsx`, at both places (`DropdownMenuContent` about line 48 and `DropdownMenuSubContent` about line 238), replace:

```tsx
        style={{ backgroundColor: 'oklch(from var(--popover) l c h / 0.8)', ...props.style }}
```

with:

```tsx
        style={{ backgroundColor: 'var(--popover-glass)', ...props.style }}
```

- [ ] **Step 6: `theme:check` passes**

Run: `pnpm theme:check`
Expected: `theme:check: all N checks pass`. If a sidebar pair fails, that is Task 3's job; everything else must pass here. Sidebar pairs that read `--sidebar-active-icon` fail until Task 3. If the owner wants every commit green, do Task 3's Step 1 before committing this task.

Run: `grep -rn "oklch(from" src --include=*.tsx --include=*.ts --include=*.css | grep -v coming-soon-state`
Expected: no output.

- [ ] **Step 7: Write the verify harness**

Create `$SCRATCH/surface-verify/verify.mjs`:

```js
import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'

const REPO = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website'
const HERE = path.dirname(new URL(import.meta.url).pathname)
const SHOTS = path.join(HERE, 'shots')
mkdirSync(SHOTS, { recursive: true })

const { chromium } = createRequire(`${REPO}/package.json`)('playwright')
const env = readFileSync(`${REPO}/.env.local`, 'utf8')
const read = key => new RegExp(`^${key}=(.*)$`, 'm').exec(env)?.[1]?.trim().replace(/^["']|["']$/g, '')
const BASE = `http://localhost:${read('PORT') ?? 3000}`
const SECRET = read('DEV_LOGIN_SECRET')
if (!SECRET) {
  throw new Error('DEV_LOGIN_SECRET missing from .env.local')
}

const VIEWPORTS = { desktop: [1440, 900], laptop: [1024, 768], ipad: [820, 1180], phone: [390, 844] }

// Colours come back from getComputedStyle as oklch()/oklab()/rgb(); every check compares like with like.
export const PROBE = `(() => {
  window.__probe = (expr, prop = 'backgroundColor', host = document.body) => {
    const el = document.createElement('div')
    el.style[prop === 'color' ? 'color' : 'backgroundColor'] = expr
    host.append(el)
    const value = getComputedStyle(el)[prop]
    el.remove()
    return value
  }
  window.__lightness = (value) => {
    const m = /^(oklch|oklab)\\(\\s*([\\d.]+)/.exec(value)
    return m ? Number(m[2]) : Number.NaN
  }
})()`

const wanted = process.argv.slice(2)
const files = readdirSync(path.join(HERE, 'checks')).filter(f => f.endsWith('.mjs'))
const checks = await Promise.all(files.map(async f => ({ name: f.replace('.mjs', ''), ...(await import(path.join(HERE, 'checks', f))) })))
const selected = wanted.length ? checks.filter(c => wanted.includes(c.name)) : checks

const browser = await chromium.launch()
let failed = 0
for (const check of selected) {
  for (const scheme of check.schemes ?? ['light', 'dark']) {
    for (const vp of check.viewports ?? ['desktop']) {
      for (const state of check.states ?? [{ label: 'default' }]) {
        const [width, height] = VIEWPORTS[vp]
        const context = await browser.newContext({ viewport: { width, height }, colorScheme: scheme })
        if (state.sidebar) {
          await context.addCookies([{ name: 'sidebar_state', value: String(state.sidebar === 'expanded'), url: BASE }])
        }
        const page = await context.newPage()
        const login = `${BASE}/api/dev/playwright-session?secret=${encodeURIComponent(SECRET)}${check.role ? `&role=${check.role}` : ''}&redirect=${encodeURIComponent(check.route)}`
        await page.goto(login, { waitUntil: 'networkidle' })
        await page.evaluate(PROBE)
        const served = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--band').trim())
        if (!served) {
          throw new Error('Served CSS has no --band: the dev server is stale. Ask the owner to stop it, rm -rf .next, restart.')
        }
        const tag = `${check.name}-${scheme}-${vp}-${state.label}`
        let failures = []
        try {
          failures = await check.run(page, { scheme, vp, state })
        }
        catch (error) {
          failures = [`threw: ${error.message}`]
        }
        await page.screenshot({ path: path.join(SHOTS, `${tag}.png`), fullPage: false })
        console.log(`${failures.length ? '✗' : '✓'} ${tag}${failures.map(f => `\n    ${f}`).join('')}`)
        failed += failures.length
        await context.close()
      }
    }
  }
}
await browser.close()
process.exit(failed ? 1 : 0)
```

The script reads the secret inside the process and never prints it or the login URL. If the harness refuses to run a script that reads `.env.local`, stop and ask the owner to run `node $SCRATCH/surface-verify/verify.mjs <checks>` and paste the output.

Create `$SCRATCH/surface-verify/checks/ramp.mjs`:

```js
export const route = '/dashboard'
export const role = 'agent'

const EXPECTED = {
  light: { page: 0.945, muted: 0.9725, band: 0.9835, card: 1, border: 0.89, nestedCard: 0.205 },
  dark: { page: 0.16, muted: 0.1825, band: 0.2275, card: 0.205, border: 0.295, nestedCard: 0.205 },
}

export async function run(page, { scheme }) {
  const got = await page.evaluate(() => {
    const nested = document.createElement('div')
    nested.className = 'dark'
    document.body.append(nested)
    const L = expr => window.__lightness(window.__probe(expr))
    const out = {
      page: L('var(--background)'),
      muted: L('var(--muted)'),
      band: L('var(--band)'),
      card: L('var(--card)'),
      border: L('var(--border)'),
      nestedCard: window.__lightness(window.__probe('var(--card)', 'backgroundColor', nested)),
      rowHover: window.__probe('var(--row-hover)'),
    }
    nested.remove()
    return out
  })
  const failures = []
  for (const [key, want] of Object.entries(EXPECTED[scheme])) {
    if (!(Math.abs(got[key] - want) <= 0.002)) {
      failures.push(`${key}: lightness ${got[key]}, want ${want}`)
    }
  }
  if (!got.rowHover || got.rowHover === 'rgba(0, 0, 0, 0)') {
    failures.push(`row-hover did not resolve: ${got.rowHover}`)
  }
  return failures
}
```

- [ ] **Step 8: Run the ramp check**

Run: `node $SCRATCH/surface-verify/verify.mjs ramp`
Expected: `✓ ramp-light-desktop-default` and `✓ ramp-dark-desktop-default`. If `nestedCard` is `1` in the light run, the ramp block is not matching `.dark`. Check the selector list.

- [ ] **Step 9: Lint and types**

Run: `pnpm lint src/shared/components/ui/dropdown-menu.tsx && pnpm tsc`
Expected: pass.

- [ ] **Step 10: Commit**

```bash
git add "src/app/(frontend)/globals.css" src/shared/components/ui/dropdown-menu.tsx
git commit -m "feat(theme): surfaces derive from one hue and a lightness step; solid band, row and skeleton tokens

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Sidebar tokens and the quiet active pill

**Files:**
- Modify: `src/app/(frontend)/globals.css` (sidebar tokens in `:root, .funnel-light` and `.dark`; `@theme inline`)
- Modify: `src/shared/components/ui/sidebar.tsx` (menu button active icon; sub-button active icon)
- Modify: `src/features/agent-dashboard/constants/sidebar-styles.ts`
- Modify: `src/features/agent-dashboard/ui/components/sidebar-pipeline-item.tsx:90`
- Modify: `src/features/agent-dashboard/ui/components/mobile-dock-tab.tsx:30` (Part B file; see Task 0)
- Modify: `src/features/agent-dashboard/ui/components/app-sidebar.tsx:201` (the nav well)
- Create (scratch): `$SCRATCH/surface-verify/checks/sidebar.mjs`

**Interfaces:**
- Consumes: Task 2's settings (`--canvas-l`, `--lift`) for the dark rail formulas.
- Produces: `--sidebar-active-icon` / `text-sidebar-active-icon`. `--sidebar-primary` and `--sidebar-primary-foreground` are **removed**, because every reader was an active icon on the old cyan pill (see the handoff note).

- [ ] **Step 1: Tokens**

In `:root, .funnel-light`, replace the sidebar declarations (`--sidebar` … `--sidebar-border`) with:

```css
  --sidebar: oklch(0.22 0.06 262);
  --sidebar-foreground: oklch(0.86 0.02 250);
  --sidebar-muted: oklch(0.74 0.05 250);
  /* The active pill is a darker navy, not cyan: only its icon carries the brand colour. */
  --sidebar-accent: oklch(0.3 0.065 262);
  --sidebar-accent-foreground: oklch(0.97 0.01 250);
  --sidebar-active-icon: var(--brand-cyan-bright);
  --sidebar-hover: oklch(0.26 0.06 262);
  --sidebar-border: oklch(0.27 0.06 262);
```

(`--sidebar-ring` stays as it is.) In `.dark`, replace the same group with:

```css
  /* Dark rail sits level with the cards, a navy tint of the card step. */
  --sidebar: oklch(calc(var(--canvas-l) + var(--lift)) 0.05 262);
  --sidebar-foreground: oklch(0.82 0.02 252);
  --sidebar-muted: oklch(0.68 0.03 252);
  --sidebar-accent: oklch(calc(var(--canvas-l) + 2.2 * var(--lift)) 0.055 262);
  --sidebar-accent-foreground: oklch(0.96 0.01 250);
  --sidebar-hover: oklch(calc(var(--canvas-l) + 1.6 * var(--lift)) 0.05 262);
  --sidebar-border: oklch(calc(var(--canvas-l) + 2 * var(--lift)) 0.05 262);
```

In `@theme inline`, delete `--color-sidebar-primary` and `--color-sidebar-primary-foreground`, and add `--color-sidebar-active-icon: var(--sidebar-active-icon);` after `--color-sidebar-hover`.

- [ ] **Step 2: Readers of the old active colour**

Run: `grep -rn "sidebar-primary" src`
Expected before editing: four hits, in `sidebar-styles.ts`, `sidebar-pipeline-item.tsx`, `mobile-dock-tab.tsx` and `ui/sidebar.tsx:731`.

- `src/features/agent-dashboard/constants/sidebar-styles.ts`: replace `data-[active=true]:[&_svg]:text-sidebar-primary` with `data-[active=true]:[&_svg]:text-sidebar-active-icon`.
- `src/shared/components/ui/sidebar.tsx`, `SidebarMenuSubButton` (about line 731): replace `data-[active=true]:[&>svg]:text-sidebar-primary` with `data-[active=true]:[&>svg]:text-sidebar-active-icon`.
- `src/shared/components/ui/sidebar.tsx`, `sidebarMenuButtonVariants` base string (about line 516): after `data-[active=true]:text-sidebar-accent-foreground`, add ` data-[active=true]:[&>svg]:text-sidebar-active-icon`.
- `src/features/agent-dashboard/ui/components/mobile-dock-tab.tsx:30`: replace `isActive && 'text-sidebar-primary'` with `isActive && 'text-sidebar-active-icon'`.
- `src/features/agent-dashboard/ui/components/sidebar-pipeline-item.tsx:90`: replace
  `isActive ? 'border-sidebar-primary/30 text-sidebar-primary' : 'border-sidebar-accent/30 text-sidebar-accent'`
  with
  `'border-sidebar-border text-sidebar-active-icon'`. The inactive badge was cyan text on the rail, and `text-sidebar-accent` is now navy, so it would vanish. Both states now use the rail's own hairline and the brand icon colour. If the `isActive` variable becomes unused, remove it and its source line.

Run: `grep -rn "sidebar-primary\|text-sidebar-accent\b" src`
Expected: no output.

- [ ] **Step 3: The nav well**

`app-sidebar.tsx:201` wraps the main nav group in `rounded-xl bg-sidebar-hover p-1`. Now that hover is solid, an item hovered inside that well would not change colour. The approved mock (Sidebar 1) has no well. Remove `bg-sidebar-hover` from that class string and keep the rest (`rounded-xl p-1 transition-[padding,border-radius] …`).

- [ ] **Step 4: `theme:check` green**

Run: `pnpm theme:check`
Expected: all checks pass, including `sidebar label on hover`, `sidebar label on active pill` and `active icon on pill` in both modes.

- [ ] **Step 5: Sidebar check**

Create `$SCRATCH/surface-verify/checks/sidebar.mjs`:

```js
export const route = '/dashboard'
export const role = 'agent'
export const viewports = ['desktop', 'ipad']
export const states = [{ label: 'expanded', sidebar: 'expanded' }, { label: 'collapsed', sidebar: 'collapsed' }]

export async function run(page, { scheme }) {
  const got = await page.evaluate(() => {
    const rail = document.querySelector('[data-slot="sidebar-inner"]')
    const active = rail?.querySelector('[data-sidebar="menu-button"][data-active="true"]')
    const icon = active?.querySelector('svg')
    return {
      rail: rail && getComputedStyle(rail).backgroundColor,
      railWant: window.__probe('var(--sidebar)'),
      pill: active && getComputedStyle(active).backgroundColor,
      pillWant: window.__probe('var(--sidebar-accent)'),
      icon: icon && getComputedStyle(icon).color,
      iconWant: window.__probe('var(--sidebar-active-icon)', 'color'),
      railL: rail && window.__lightness(getComputedStyle(rail).backgroundColor),
      cardL: window.__lightness(window.__probe('var(--card)')),
    }
  })
  const failures = []
  if (got.rail !== got.railWant) failures.push(`rail ${got.rail}, want ${got.railWant}`)
  if (!got.pill) failures.push('no active menu button on /dashboard')
  else if (got.pill !== got.pillWant) failures.push(`active pill ${got.pill}, want ${got.pillWant}`)
  if (got.icon !== got.iconWant) failures.push(`active icon ${got.icon}, want ${got.iconWant}`)
  if (scheme === 'dark' && Math.abs(got.railL - got.cardL) > 0.002) failures.push(`dark rail L ${got.railL} is not card level ${got.cardL}`)
  return failures
}
```

Run: `node $SCRATCH/surface-verify/verify.mjs sidebar`
Expected: eight `✓` lines (2 schemes × 2 viewports × 2 states). Open `shots/sidebar-light-desktop-expanded.png` and `shots/sidebar-dark-desktop-expanded.png` and look: a quiet navy rail, a darker pill, a cyan icon on the active item, and no cyan fill anywhere except the logo.

- [ ] **Step 6: Lint, types, commit**

Run: `pnpm lint && pnpm tsc`
Expected: pass.

```bash
git add "src/app/(frontend)/globals.css" src/shared/components/ui/sidebar.tsx src/features/agent-dashboard/constants/sidebar-styles.ts src/features/agent-dashboard/ui/components/sidebar-pipeline-item.tsx src/features/agent-dashboard/ui/components/mobile-dock-tab.tsx src/features/agent-dashboard/ui/components/app-sidebar.tsx
git commit -m "feat(theme): quiet navy rail: darker active pill with a cyan icon, solid hover, dark rail at card level

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(`mobile-dock-tab.tsx` and `app-sidebar.tsx` belong to Part B. Stage them only under the Task 0 ruling.)

---

## Task 4: One gutter

**Files:**
- Modify: `src/shared/components/ui/sidebar.tsx:263,276`
- Modify: `src/features/agent-dashboard/constants/dashboard-main.ts`
- Modify: `src/features/agent-dashboard/ui/views/dashboard-view.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton.tsx` (mirrors the view's gaps)
- Create (scratch): `$SCRATCH/surface-verify/checks/gutter.mjs`

**Interfaces:**
- Consumes: `--gutter` (Task 2).
- Produces: the rule that the rail inset, the main top/right/bottom padding and every gap between section cards all equal `var(--gutter)`. Task 8 (analytics) uses `gap-(--gutter)` the same way.

- [ ] **Step 1: Write the failing gutter check**

Create `$SCRATCH/surface-verify/checks/gutter.mjs`:

```js
export const route = '/dashboard'
export const role = 'agent'
export const viewports = ['desktop', 'laptop', 'ipad']
export const states = [{ label: 'expanded', sidebar: 'expanded' }, { label: 'collapsed', sidebar: 'collapsed' }]

export async function run(page, { vp }) {
  const m = await page.evaluate(() => {
    const inner = document.querySelector('[data-slot="sidebar-inner"]').getBoundingClientRect()
    const main = document.querySelector('main')
    const cs = getComputedStyle(main)
    const box = main.getBoundingClientRect()
    const grid = document.querySelector('#meetings')?.parentElement
    const proposals = document.querySelector('#proposals')?.getBoundingClientRect()
    const projects = document.querySelector('#projects')?.getBoundingClientRect()
    return {
      railTop: inner.top,
      railBottom: window.innerHeight - inner.bottom,
      railLeft: inner.left,
      railToContent: box.left + Number.parseFloat(cs.paddingLeft) - inner.right,
      pad: [cs.paddingTop, cs.paddingRight, cs.paddingBottom, cs.paddingLeft],
      rowGap: grid && getComputedStyle(grid).rowGap,
      columnGap: grid && getComputedStyle(grid).columnGap,
      stackGap: proposals && projects ? projects.top - proposals.bottom : null,
    }
  })
  const failures = []
  const near = (value, want, label) => { if (Math.abs(value - want) > 0.5) failures.push(`${label} ${value}, want ${want}`) }
  near(m.railTop, 8, 'rail top inset')
  near(m.railBottom, 8, 'rail bottom inset')
  near(m.railLeft, 8, 'rail left inset')
  near(m.railToContent, 8, 'rail to content')
  if (m.pad.join(' ') !== '8px 8px 8px 0px') failures.push(`main padding ${m.pad.join(' ')}, want 8px 8px 8px 0px`)
  if (m.rowGap !== '8px') failures.push(`grid row gap ${m.rowGap}`)
  if (vp !== 'ipad' && m.columnGap !== '8px') failures.push(`grid column gap ${m.columnGap}`)
  if (m.stackGap !== null) near(m.stackGap, 8, 'proposals to projects')
  return failures
}
```

Run: `node $SCRATCH/surface-verify/verify.mjs gutter`
Expected: FAIL. Main padding is `24px 24px 24px 24px` and the gaps are `24px`.

- [ ] **Step 2: Rail inset**

In `src/shared/components/ui/sidebar.tsx`:
- line ~263 (gap div): `group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]` → `group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--gutter)*2)]`
- line ~276 (container): `'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'` → `'p-(--gutter) group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+var(--gutter)*2+2px)]'`

- [ ] **Step 3: Main padding**

Replace the string in `src/features/agent-dashboard/constants/dashboard-main.ts` so the constant reads:

```ts
export const DASHBOARD_MAIN_CLASS = 'relative min-h-0 min-w-0 flex-1 overflow-hidden px-4 pb-[calc(3.5rem+max(1rem,env(safe-area-inset-bottom))+1rem)] pt-4 md:pt-(--gutter) md:pr-(--gutter) md:pb-(--gutter) md:pl-0 has-data-stage:p-0'
```

Keep the JSDoc and add one line to it: `From md up the rail's own right inset is the left gutter, so the page margin matches the rail's gap on every side.`

- [ ] **Step 4: Card gaps on the dashboard**

In `dashboard-view.tsx`:
- outer column `flex w-full flex-col gap-6 pb-16 …` → `gap-(--gutter)` (keep `pb-16 lg:pb-0`; the phone keeps its scroll runway)
- grid `grid grid-cols-1 gap-6 …` → `gap-(--gutter)`
- `#meetings` section: remove `lg:pr-1 lg:pb-6`
- right column `flex flex-col gap-6 lg:col-span-4 … lg:pr-1 lg:pb-6` → `gap-(--gutter)` and remove `lg:pr-1 lg:pb-6`

The column scrollers keep `lg:scrollbar-gutter-stable`. With `pr-1`/`pb-6` gone, the last card's bottom edge lands on the rail's bottom line. The top-of-file comment describes scroll ownership, which is still true, so leave it.

In `dashboard-generic-content-skeleton.tsx`, make the same `gap-6` → `gap-(--gutter)` swaps at lines ~15, ~20 and ~22 (the skeleton must match the view so the swap does not move anything).

- [ ] **Step 5: Gutter check passes**

Run: `node $SCRATCH/surface-verify/verify.mjs gutter`
Expected: twelve `✓` lines. Look at `shots/gutter-light-ipad-collapsed.png` and `shots/gutter-dark-desktop-expanded.png`: the rail's top and bottom line up with the cards' top and bottom.

Also run: `node $SCRATCH/surface-verify/verify.mjs ramp sidebar` (no regressions).

- [ ] **Step 6: Lint, types, commit**

Run: `pnpm lint && pnpm tsc`

```bash
git add src/shared/components/ui/sidebar.tsx src/features/agent-dashboard/constants/dashboard-main.ts src/features/agent-dashboard/ui/views/dashboard-view.tsx src/features/agent-dashboard/ui/components/dashboard-generic-content-skeleton.tsx
git commit -m "feat(dashboard): one 8px gutter: rail inset, page margin and card gaps share one line

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Records tables: card, bands, solid frozen column

**Files:**
- Modify: `src/shared/components/data-table/ui/data-table.tsx` (wrapper ~298, header ~316–335, `CELL_BORDER` import)
- Modify: `src/shared/components/data-table/ui/data-table-body.tsx` (spinner ~73, skeleton rows ~92, rows ~112–205)
- Modify: `src/shared/components/data-table/ui/expanded-row-panel.tsx` (Root, Pane)
- Modify: `src/shared/components/ui/table.tsx` (TableRow, TableFooter)
- Delete: `src/shared/components/data-table/constants/cell-border.ts`
- Create (scratch): `$SCRATCH/surface-verify/checks/tables.mjs`

**Interfaces:**
- Consumes: `bg-card`, `bg-band`, `bg-row-hover`, `bg-row-selected`, `border-border` (Task 2).
- Produces: data rows carry `data-band="even|odd"` by rendered position among **data rows** (expanded detail rows never count). Expanded data rows carry `data-open="true"`. Task 16 reads both.

- [ ] **Step 1: Write the failing table check**

Create `$SCRATCH/surface-verify/checks/tables.mjs`:

```js
// Default login (no role): the fixture agent has no records. Screenshots stay local; never publish them.
export const route = '/dashboard/meetings'
export const viewports = ['desktop', 'ipad']

export async function run(page) {
  await page.waitForSelector('tbody tr[data-band]', { timeout: 15000 })
  const read = () => page.evaluate(() => {
    const table = document.querySelector('table[data-slot="table"]')
    const wrapper = table.closest('.rounded-xl')
    const rows = [...table.querySelectorAll('tbody tr[data-band]')]
    const plain = rows.filter(r => !/bg-status-/.test(r.className))
    const firstOdd = plain.find(r => r.dataset.band === 'odd' && !r.dataset.open)
    const firstEven = plain.find(r => r.dataset.band === 'even' && !r.dataset.open)
    const fill = r => r?.querySelector('td:first-child > div.absolute')
    const th = table.querySelector('thead th')
    const bodyRuled = [...table.querySelectorAll('tbody tr[data-band] td')].filter(td => Number.parseFloat(getComputedStyle(td).borderBottomWidth) > 0).length
    return {
      wrapper: getComputedStyle(wrapper).backgroundColor,
      card: window.__probe('var(--card)'),
      band: window.__probe('var(--band)'),
      selected: window.__probe('var(--row-selected)'),
      border: window.__probe('var(--border)', 'color'),
      odd: firstOdd && getComputedStyle(firstOdd).backgroundColor,
      oddFill: fill(firstOdd) && getComputedStyle(fill(firstOdd)).backgroundColor,
      evenFill: fill(firstEven) && getComputedStyle(fill(firstEven)).backgroundColor,
      headerRule: [getComputedStyle(th).borderBottomWidth, getComputedStyle(th).borderBottomColor],
      bodyRuled,
      bands: rows.map(r => r.dataset.band).join(''),
    }
  })
  const before = await read()
  const failures = []
  if (before.wrapper !== before.card) failures.push(`table wrapper ${before.wrapper}, want card ${before.card}`)
  if (!before.odd) failures.push('no untinted odd row to measure')
  else if (before.odd !== before.band) failures.push(`odd row ${before.odd}, want band ${before.band}`)
  if (before.oddFill && before.oddFill !== before.band) failures.push(`frozen fill on odd row ${before.oddFill}, want ${before.band}`)
  if (before.evenFill && before.evenFill !== before.card) failures.push(`frozen fill on even row ${before.evenFill}, want ${before.card}`)
  if (before.headerRule[0] !== '1px' || before.headerRule[1] !== before.border) failures.push(`header rule ${before.headerRule.join(' ')}`)
  if (before.bodyRuled) failures.push(`${before.bodyRuled} body cells still draw a bottom rule`)

  const toggle = await page.$('button[aria-label="Expand row"]')
  if (toggle) {
    await toggle.click()
    await page.waitForTimeout(400)
    const after = await read()
    if (after.bands !== before.bands) failures.push(`bands shifted after expanding: ${before.bands} → ${after.bands}`)
    const open = await page.evaluate(() => {
      const r = document.querySelector('tbody tr[data-open="true"]')
      const f = r?.querySelector('td:first-child > div.absolute')
      return r && [getComputedStyle(r).backgroundColor, f && getComputedStyle(f).backgroundColor]
    })
    if (!open) failures.push('expanded row has no data-open')
    else if (open[0] !== after.selected || (open[1] && open[1] !== after.selected)) failures.push(`expanded row ${open.join(' / ')}, want ${after.selected}`)
  }
  await page.evaluate(() => { const s = document.querySelector('table[data-slot="table"]').closest('.overflow-auto'); if (s) s.scrollLeft = 240 })
  return failures
}
```

Run: `node $SCRATCH/surface-verify/verify.mjs tables`
Expected: FAIL. There is no `data-band` yet, so the `waitForSelector` times out.

- [ ] **Step 2: `data-table.tsx`**

- Delete `import { CELL_BORDER } from '@/shared/components/data-table/constants/cell-border'`.
- Wrapper (~298): `'grow min-h-0 flex flex-col rounded-xl border border-border/50 overflow-hidden'` → `'grow min-h-0 flex flex-col rounded-xl border border-border bg-card shadow-sm overflow-hidden'`.
- `<TableHeader className="sticky top-0 z-10 bg-background">` → `bg-card`.
- Header `<TableRow … className="hover:bg-transparent border-border/50">` → `className="hover:bg-transparent"`.
- In the `TableHead` `cn(...)`: replace `CELL_BORDER,` with `'border-b border-border',`, and in the frozen branch replace `'sticky left-0 z-30 bg-background border-r border-border/50'` with `'sticky left-0 z-30 bg-card border-r border-border'`.

- [ ] **Step 3: `data-table-body.tsx`**

- Delete the `CELL_BORDER` import.
- Pull spinner (~73): `border-border/50 bg-background` → `border-border bg-background`.
- Skeleton rows (~92–96):

```tsx
            <TableRow key={`skeleton-row-${rowIdx}`} className={cn('hover:bg-transparent', rowIdx % 2 === 1 && 'bg-band', skeletonRowClassName)}>
              {visibleCols.map((col, colIdx) => (
                <TableCell key={`skeleton-${rowIdx}-${col.id}`}>
```

- `{rows.map((row) => {` → `{rows.map((row, rowIndex) => {`, and directly under the `detailId` line add:

```tsx
        const isOdd = rowIndex % 2 === 1
```

- The data `TableRow` (~137): replace the template-literal `className` with the version below. `cn` already comes from `@/shared/lib/utils`; import it if missing.

```tsx
            <TableRow
              data-band={isOdd ? 'odd' : 'even'}
              data-open={isExpanded || undefined}
              // tailwind-merge keeps the last background: a status tint beats the band, the open state beats both.
              className={cn(
                'group cursor-pointer hover:bg-row-hover',
                isOdd && 'bg-band',
                customRowClass,
                isExpanded && 'bg-row-selected hover:bg-row-selected',
              )}
```

- The frozen cell (~168–184):

```tsx
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'sticky left-0 z-5 p-0 border-r border-border',
                        'transition-shadow duration-200',
                        showFrozenShadow && 'shadow-[4px_0_8px_0_rgba(0,0,0,0.3)]',
                      )}
                      style={{ borderRightStyle: 'dashed' }}
                    >
                      {/* Solid, so columns scrolled beneath the frozen cell never show through; it mirrors the row's own fill. */}
                      <div
                        className={cn(
                          'absolute inset-0 bg-card transition-colors group-hover:bg-row-hover',
                          isOdd && !customRowClass && 'bg-band',
                          isExpanded && 'bg-row-selected group-hover:bg-row-selected',
                        )}
                      />
                      {customRowClass && !isExpanded && <div className={cn('absolute inset-0 group-hover:hidden', customRowClass)} />}
                      <div className="relative p-2">
                        {cellContent}
                      </div>
                    </TableCell>
```

- Plain cells: `<TableCell key={cell.id} className={CELL_BORDER}>` → `<TableCell key={cell.id}>`.
- Expanded row cell: `className={cn('p-0 whitespace-normal', isExpanded && CELL_BORDER)}` → `className={cn('p-0 whitespace-normal', isExpanded && 'border-b border-border')}`.

- [ ] **Step 4: Expanded panel and table primitive**

`expanded-row-panel.tsx`:
- Root: `bg-muted/20 p-4` → `bg-muted p-4` (the well).
- Pane: `'flex min-w-0 flex-col gap-2'` → `'flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface-raised p-3'` (panes sit on the well, one step up).

`ui/table.tsx`:
- `TableRow`: `'hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors'` → `'hover:bg-row-hover data-[state=selected]:bg-row-selected border-b transition-colors'`.
- `TableFooter`: `'bg-muted/50 border-t …'` → `'bg-muted border-t …'`.

- [ ] **Step 5: Delete `CELL_BORDER`**

Run: `grep -rn "CELL_BORDER\|cell-border" src`
Expected: no output. Then `git rm src/shared/components/data-table/constants/cell-border.ts` (if the owner declined commits, delete the file with `rm` instead).

- [ ] **Step 6: Table check passes**

Run: `node $SCRATCH/surface-verify/verify.mjs tables`
Expected: four `✓` lines. Then set `route` in `tables.mjs` to `/dashboard/proposals`, `/dashboard/customers` and `/dashboard/projects` in turn and rerun. Each must pass, or report `no untinted odd row` only when that list has fewer than two rows. Look at `shots/tables-dark-desktop-default.png`: you can see where each row ends without any line.

- [ ] **Step 7: Lint, types, commit**

Run: `pnpm lint && pnpm tsc`

```bash
git add src/shared/components/data-table/ui/data-table.tsx src/shared/components/data-table/ui/data-table-body.tsx src/shared/components/data-table/ui/expanded-row-panel.tsx src/shared/components/ui/table.tsx src/shared/components/data-table/constants/cell-border.ts
git commit -m "feat(data-table): the table is a card; rows are banded, not ruled; the frozen column matches its row

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Skeletons use solid border-level tones

**Files:**
- Modify: `src/shared/constants/skeleton-tone.ts`
- Modify: `src/shared/components/ui/skeleton.tsx`

**Interfaces:**
- Consumes: `bg-skeleton`, `bg-skeleton-soft` (Task 2).
- Produces: `SKELETON_TONE_CLASS = 'bg-skeleton'`, `SKELETON_BLOCK_TONE_CLASS = 'bg-skeleton-soft'` and `SKELETON_FRAME_TONE_CLASS = 'border-border'`, with the same export names, so no caller changes. The `Skeleton` primitive's default tone becomes `SKELETON_TONE_CLASS`.

- [ ] **Step 1: Constants**

Replace the whole of `src/shared/constants/skeleton-tone.ts` with:

```ts
// A thin bar reads as a line of text only near 1.3:1 on a card, which is the border step; theme:check guards it.
export const SKELETON_TONE_CLASS = 'bg-skeleton'

// Chips and avatars cover several times a bar's area, so they sit half a step softer and the lines keep leading.
export const SKELETON_BLOCK_TONE_CLASS = 'bg-skeleton-soft'

export const SKELETON_FRAME_TONE_CLASS = 'border-border'
```

- [ ] **Step 2: Primitive default**

In `src/shared/components/ui/skeleton.tsx`, add `import { SKELETON_TONE_CLASS } from '@/shared/constants/skeleton-tone'`, and change `'rounded-md bg-muted/60 motion-safe:animate-pulse'` to:

```tsx
        'rounded-md motion-safe:animate-pulse',
        SKELETON_TONE_CLASS,
```

(Callers that pass a `bg-*` in `className` still win, because `cn` merges last.)

- [ ] **Step 3: Check**

Run: `pnpm theme:check && pnpm lint && pnpm tsc`
Expected: pass (`skeleton bar vs card` and `skeleton block vs card` pass in both modes).

Run: `grep -rn "bg-muted/\|bg-foreground/" src/shared/components/ui/skeleton.tsx src/shared/constants/skeleton-tone.ts`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add src/shared/constants/skeleton-tone.ts src/shared/components/ui/skeleton.tsx
git commit -m "feat(theme): skeletons draw at the solid border step

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Dashboard modules become banded lists

**Files:**
- Modify: `src/shared/components/entities/entity-list/ui/entity-list.tsx` (`renderItem` receives the index)
- Modify: `src/features/agent-dashboard/ui/components/dashboard-module.tsx`
- Modify: `…/dashboard-proposal-card.tsx`, `…/dashboard-proposal-card-skeleton.tsx`, `…/dashboard-proposal-section-list.tsx`
- Modify: `…/dashboard-project-card.tsx`, `…/dashboard-project-card-skeleton.tsx`, `…/dashboard-project-section-list.tsx`
- Modify: `…/dashboard-list-section-skeleton.tsx`
- Modify: `…/dashboard-meeting-card.tsx`, `…/dashboard-day-agenda.tsx`
- Create (scratch): `$SCRATCH/surface-verify/checks/rows.mjs`

(All `…/` paths are under `src/features/agent-dashboard/ui/components/`.)

**Interfaces:**
- Consumes: `bg-band`, `hover:bg-row-hover`, `SKELETON_*` (Task 6).
- Produces: `EntityListProps.renderItem: (item: T, index: number) => ReactNode`. This is backward compatible: existing one-argument callers still type-check.

- [ ] **Step 1: Failing rows check**

Create `$SCRATCH/surface-verify/checks/rows.mjs`:

```js
export const route = '/dashboard'
export const viewports = ['desktop', 'phone']

export async function run(page) {
  await page.waitForSelector('#proposals [data-row-band], #projects [data-row-band], #meetings li', { timeout: 15000 })
  const got = await page.evaluate(() => {
    const band = window.__probe('var(--band)')
    const failures = []
    for (const id of ['#proposals', '#projects']) {
      const module = document.querySelector(id)?.firstElementChild
      const rows = [...(module?.querySelectorAll('[data-row-band]') ?? [])]
      const nested = [...(module?.querySelectorAll('*') ?? [])].filter(el => el !== module && !el.closest('table') && Number.parseFloat(getComputedStyle(el).borderTopWidth) > 0 && getComputedStyle(el).borderTopStyle !== 'none' && el.getBoundingClientRect().height > 30)
      if (nested.length) failures.push(`${id}: ${nested.length} bordered boxes inside the module`)
      rows.forEach((row, i) => {
        const want = i % 2 === 1 ? band : window.__probe('transparent')
        const bg = getComputedStyle(row).backgroundColor
        if (row.dataset.rowBand === 'odd' && bg !== band) failures.push(`${id} row ${i}: ${bg}, want band`)
        if (row.dataset.rowBand === 'even' && bg !== want) failures.push(`${id} row ${i}: ${bg}, want transparent`)
      })
    }
    return failures
  })
  return got
}
```

Run: `node $SCRATCH/surface-verify/verify.mjs rows`
Expected: FAIL (timeout: no `[data-row-band]` yet).

- [ ] **Step 2: `EntityList` passes the index**

In `entity-list.tsx`:
- `renderItem: (item: T) => ReactNode` → `renderItem: (item: T, index: number) => ReactNode` (JSDoc: `Render one item; \`index\` is its rendered position, for banding.`)
- `{items.map(item => (` → `{items.map((item, index) => (`
- `{renderItem(item)}` → `{renderItem(item, index)}`

- [ ] **Step 3: Module chrome**

`dashboard-module.tsx`: `'rounded-xl border border-border bg-card p-4 shadow-sm shadow-primary/5'` → `'rounded-xl border border-border bg-card p-4 shadow-sm'`.

- [ ] **Step 4: Proposal rows**

`dashboard-proposal-card.tsx`:
- Add a prop to the props interface: `/** Rendered position in its list; odd rows take the band. */ index: number`.
- Destructure `index`, and replace `className={cn('rounded-lg border border-border bg-card p-2.5', className)}` with:

```tsx
      data-row-band={index % 2 === 1 ? 'odd' : 'even'}
      className={cn('px-2.5 py-2 transition-colors duration-200 hover:bg-row-hover', index % 2 === 1 && 'bg-band', className)}
```

If `ProposalOverviewCard` does not forward unknown props (`data-*`) to its root element, pass the attribute through its root in `src/shared/modules/proposals/core/components/overview-card.tsx`: add `...rest` passthrough on the root `div`, and nothing else. Check its signature first.
- Update the JSDoc sentence `Matches DashboardMeetingCard's row treatment (rounded-lg border bg-card p-2.5)` to `Renders as a banded row of the module's list, like DashboardMeetingCard and DashboardProjectCard.`

`dashboard-proposal-section-list.tsx`:
- `renderItem={row => <DashboardProposalCard row={row} timeSince={timeSince} />}` → `renderItem={(row, index) => <DashboardProposalCard row={row} index={index} timeSince={timeSince} />}`
- `itemsClassName="space-y-2"` → `itemsClassName="-mx-2.5 space-y-0"`. Rows run edge to edge of the section, so the band's inset matches the row padding.

`dashboard-proposal-card-skeleton.tsx`:
- The root `div` becomes `<div className={cn('px-2.5 py-2', odd && 'bg-band')} aria-hidden>` with a new prop `{ odd = false }: { odd?: boolean }`. Drop `SKELETON_FRAME_TONE_CLASS` from this file's imports.

- [ ] **Step 5: Project rows**

`dashboard-project-card.tsx`:
- Add `index: number` to the props (same JSDoc as the proposal card), and replace the row `div` `className` with:

```tsx
        data-row-band={index % 2 === 1 ? 'odd' : 'even'}
        className={cn(
          'flex flex-wrap items-center gap-2 px-2.5 py-2 transition-colors duration-200 hover:bg-row-hover',
          index % 2 === 1 && 'bg-band',
          className,
        )}
```

- Update its JSDoc's last sentence the same way as the proposal card's.

`dashboard-project-section-list.tsx`: `renderItem={(row, index) => <DashboardProjectCard row={row} index={index} />}` and `itemsClassName="-mx-2.5 space-y-0"`.

`dashboard-project-card-skeleton.tsx`: root `div` → `<div className={cn('flex flex-wrap items-center gap-2 px-2.5 py-2', odd && 'bg-band')} aria-hidden>` with the same `odd` prop, and drop `SKELETON_FRAME_TONE_CLASS`.

`dashboard-list-section-skeleton.tsx`: `<div className="space-y-2">` → `<div className="-mx-2.5">`, and pass `odd={i === 1}` to both skeleton rows.

- [ ] **Step 6: Meeting rows in the day rail**

`dashboard-day-agenda.tsx`:
- `{rows.map(row => (<DayAgendaRow key={row.id} row={row} />))}` → `{rows.map((row, index) => (<DayAgendaRow key={row.id} row={row} odd={index % 2 === 1} />))}`
- `DayAgendaRow({ row }: { row: MeetingListRow })` → `DayAgendaRow({ row, odd }: { row: MeetingListRow, odd: boolean })`, and its `li`:

```tsx
    <li data-row-band={odd ? 'odd' : 'even'} className={cn('-mx-2 flex items-stretch gap-3 px-2', odd && 'bg-band')}>
```

  (import `cn` from `@/shared/lib/utils`).
- The inner `<div className="min-w-0 flex-1 py-2">` stays.
- The empty-state link `hover:bg-accent/50` → `hover:bg-muted` (inventory row).

`dashboard-meeting-card.tsx`: replace `'cursor-pointer rounded-lg border border-border bg-card p-2.5 transition-colors duration-200 hover:border-primary/30 hover:bg-accent/30'` with `'cursor-pointer rounded-md px-2 py-1 transition-colors duration-200 hover:bg-row-hover'`. The band belongs to the rail row (`li`); the card keeps a small radius so the hover reads as a target inside it. Update the JSDoc if it names the old border treatment.

Also in `dashboard-proposals.tsx`, `dashboard-projects.tsx` and `dashboard-meetings-hub.tsx`, replace the `See all →` link's `hover:bg-accent/50` with `hover:bg-muted` (inventory rows).

- [ ] **Step 7: Rows check passes**

Run: `node $SCRATCH/surface-verify/verify.mjs rows gutter`
Expected: all `✓`. Look at `shots/rows-light-desktop-default.png` and `shots/rows-dark-phone-default.png`: no card-in-card, soft alternating rows, and headings still inside their cards.

- [ ] **Step 8: Lint, types, commit**

Run: `pnpm lint && pnpm tsc`

```bash
git add src/shared/components/entities/entity-list/ui/entity-list.tsx src/features/agent-dashboard/ui/components/dashboard-module.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-card.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-card-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-proposal-section-list.tsx src/features/agent-dashboard/ui/components/dashboard-project-card.tsx src/features/agent-dashboard/ui/components/dashboard-project-card-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-project-section-list.tsx src/features/agent-dashboard/ui/components/dashboard-list-section-skeleton.tsx src/features/agent-dashboard/ui/components/dashboard-meeting-card.tsx src/features/agent-dashboard/ui/components/dashboard-day-agenda.tsx src/features/agent-dashboard/ui/components/dashboard-proposals.tsx src/features/agent-dashboard/ui/components/dashboard-projects.tsx src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx
git commit -m "feat(dashboard): module lists are banded rows, not cards inside cards

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

(Add `src/shared/modules/proposals/core/components/overview-card.tsx` to the pathspec only if Step 4 needed the passthrough.)

---

## Task 8: Analytics sections are cards on the canvas

**Files:**
- Modify: `src/features/analytics/ui/views/analytics-view.tsx:49`
- Modify: `src/features/analytics/ui/components/report/report-tab-content.tsx:42`
- Modify: `src/features/analytics/ui/components/report/headline-strip.tsx:27-28`
- Modify: `src/features/analytics/ui/components/report/trend-chart.tsx:45`
- Modify: `src/features/analytics/ui/components/report/breakdown-table.tsx:40,70,74,88-99`
- Modify: `src/features/analytics/ui/components/report/breakdown-row.tsx:28-33`
- Modify: `src/features/analytics/ui/components/report-skeleton.tsx`
- Create (scratch): `$SCRATCH/surface-verify/checks/analytics.mjs`

**Interfaces:**
- Consumes: `gap-(--gutter)`, `bg-band`, `bg-row-hover`, `bg-row-selected`.
- Produces: `BreakdownRow` gains `odd?: boolean`.

The section card class used below is `rounded-xl border border-border bg-card p-4 shadow-sm`. It is the same chrome as `DashboardModule`, inlined because analytics does not import from agent-dashboard.

- [ ] **Step 1: Failing analytics check**

Create `$SCRATCH/surface-verify/checks/analytics.mjs`:

```js
export const route = '/dashboard/analytics'
export const viewports = ['desktop', 'ipad']

export async function run(page) {
  await page.waitForSelector('section[aria-labelledby="breakdown"]', { timeout: 20000 })
  return page.evaluate(() => {
    const card = window.__probe('var(--card)')
    const failures = []
    const sections = ['section[aria-label="Headline figures"]', 'section[aria-labelledby="trend-heading"]', 'section[aria-labelledby="breakdown"]']
      .map(s => document.querySelector(s))
    sections.forEach((s, i) => {
      if (!s) return failures.push(`section ${i} missing`)
      if (getComputedStyle(s).backgroundColor !== card) failures.push(`section ${i} is not a card: ${getComputedStyle(s).backgroundColor}`)
    })
    const gap = getComputedStyle(sections[0].parentElement).rowGap
    if (gap !== '8px') failures.push(`gap between report cards ${gap}`)
    return failures
  })
}
```

Run: `node $SCRATCH/surface-verify/verify.mjs analytics`
Expected: FAIL ("is not a card", gap `20px`).

- [ ] **Step 2: Card sections**

- `report-tab-content.tsx:42`: `'flex flex-col gap-5 transition-opacity'` → `'flex flex-col gap-(--gutter) transition-opacity'`.
- `headline-strip.tsx:27`: `className="flex flex-col gap-2"` → `className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"`. Line 28's inner grid keeps its dividers (they are edges inside one card).
- `trend-chart.tsx:45`: `cn('flex min-w-0 flex-col gap-3')` → `'flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm'` (drop the needless `cn`, and drop the import if nothing else uses it).
- `breakdown-table.tsx:40`: `'flex flex-col gap-3 border-t border-border pt-6'` → `'flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-sm'`.
- `breakdown-table.tsx:70`: `'overflow-x-auto rounded-lg border border-border bg-card'` → `'-mx-4 overflow-x-auto border-y border-border'`. The table runs edge to edge inside its card, with no card inside the card.
- `analytics-view.tsx:49`: `pt-5 pr-2 pb-6` → `pt-5 pr-2 pb-0`. The last card's bottom sits on the main padding, which is the gutter.

- [ ] **Step 3: Banded breakdown rows**

In `breakdown-table.tsx`, the map becomes `{rows.map((row, index) => (` and passes `odd={index % 2 === 1}` to `BreakdownRow`. (The Total row keeps `total`; it is always `bg-muted`.)

In `breakdown-row.tsx`, add `odd?: boolean` to the props (JSDoc: `Odd data rows take the band.`), then:
- row `cn('group/row', total && 'bg-muted font-semibold hover:bg-muted', apply && 'cursor-pointer')` → `cn('group/row', odd && !total && 'bg-band', total && 'bg-muted font-semibold hover:bg-muted', apply && 'cursor-pointer')`
- sticky cell `total ? 'bg-muted' : 'bg-card group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted'` → `total ? 'bg-muted' : cn(odd ? 'bg-band' : 'bg-card', 'group-hover/row:bg-row-hover group-data-[state=selected]/row:bg-row-selected')`

- [ ] **Step 4: Skeleton matches**

`report-skeleton.tsx`: the root's `gap-6` becomes `gap-(--gutter)`, and each block becomes an empty card, so the page shape holds while loading:

```tsx
    <div aria-busy="true" aria-label="Loading the report" className="flex flex-col gap-(--gutter)">
      <div className="h-20 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
      <div className="grid gap-(--gutter) lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="h-64 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
        <div className="h-64 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
      </div>
      <div className="h-72 rounded-xl border border-border bg-card shadow-sm motion-safe:animate-pulse" />
    </div>
```

Remove the now-unused `Skeleton` import.

- [ ] **Step 5: Check passes, lint, types, commit**

Run: `node $SCRATCH/surface-verify/verify.mjs analytics && pnpm lint && pnpm tsc`
Expected: four `✓`, and lint and types pass. Look at `shots/analytics-light-desktop-default.png`: three cards on the canvas, 8px apart.

```bash
git add src/features/analytics/ui/views/analytics-view.tsx src/features/analytics/ui/components/report/report-tab-content.tsx src/features/analytics/ui/components/report/headline-strip.tsx src/features/analytics/ui/components/report/trend-chart.tsx src/features/analytics/ui/components/report/breakdown-table.tsx src/features/analytics/ui/components/report/breakdown-row.tsx src/features/analytics/ui/components/report-skeleton.tsx
git commit -m "feat(analytics): headline, trend and breakdown are cards on the canvas; breakdown rows banded

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: The `surface-alpha` lint rule (warn), as the sweep's worklist

**Files:**
- Modify: `eslint.config.js`

**Interfaces:**
- Produces: `theme-tokens/surface-alpha`, at `warn` level in this task; Task 14 flips it to `error`. `SURFACE_ALPHA_IGNORES` lists the files that keep translucent-by-design classes.

- [ ] **Step 1: Regex, message, ignores**

After `TYPE_RAMP_MSG` in `eslint.config.js`, add:

```js
// Surfaces are solid steps of one ramp (globals.css). A see-through surface class takes its colour from
// whatever happens to be beneath it, which is how tables came to blend into the page.
// esquery regexes cannot contain "/", hence \x2F.
const SURFACE_ALPHA_RE
  = '/(^|[\\s:!])(bg|border(-[xytrblse])?|divide|ring|outline|from|via|to|fill|stroke)-(background|card|muted|secondary|accent|popover|border|foreground|input|sidebar(-[a-z]+)?)\\x2F(\\d+|\\[[\\d.]+\\])/'
const SURFACE_ALPHA_MSG = 'Use a solid surface step (background, muted, band, card, surface-raised, border, border-strong, row-hover, row-selected); glass is --popover-glass.'
// Translucent by design: scrims and gradients over photos, lightbox and modal chrome, and the two follow-ups
// the spec defers (public-site `secondary` used as an accent; the proposal-flow navbar).
const SURFACE_ALPHA_IGNORES = [
  // Scrims, gradients and chrome over photos.
  'src/features/landing/ui/components/about/about-hero.tsx',
  'src/features/landing/ui/components/about/credentials.tsx',
  'src/features/landing/ui/components/about/partner-story.tsx',
  'src/features/landing/ui/components/about/team.tsx',
  'src/features/landing/ui/components/blog/blog-hero.tsx',
  'src/features/landing/ui/components/blog/blogpost-card-small.tsx',
  'src/features/landing/ui/components/blog/blogpost-card.tsx',
  'src/features/landing/ui/components/contact/contact-info.tsx',
  'src/features/landing/ui/components/experience/hero.tsx',
  'src/features/landing/ui/components/experience/project-story-card.tsx',
  'src/features/landing/ui/components/home/home-hero.tsx',
  'src/features/landing/ui/components/home/photo-card.tsx',
  'src/features/landing/ui/components/home/services-preview.tsx',
  'src/features/landing/ui/components/portfolio/portfolio-hero.tsx',
  'src/features/landing/ui/components/portfolio/project-card.tsx',
  'src/features/landing/ui/components/portfolio/project/progress-gallery.tsx',
  'src/features/landing/ui/components/portfolio/project/project-hero.tsx',
  'src/features/landing/ui/components/services/services-hero.tsx',
  'src/features/landing/ui/components/services/trade-hero.tsx',
  'src/features/landing/ui/views/pillar-view.tsx',
  'src/features/project-management/ui/components/form/import-from-proposal-dialog.tsx',
  'src/features/project-management/ui/components/phase-carousel.tsx',
  'src/features/project-management/ui/components/photo-lightbox.tsx',
  'src/features/project-management/ui/components/portfolio-hero.tsx',
  'src/features/project-management/ui/components/portfolio-project-card.tsx',
  'src/features/project-management/ui/components/story-before-after.tsx',
  'src/features/project-management/ui/components/story-gallery.tsx',
  'src/features/project-management/ui/components/story-hero.tsx',
  'src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx',
  'src/features/proposal-flow/ui/components/proposal/trusted-contractor.tsx',
  'src/shared/components/image-slider.tsx',
  'src/shared/components/media/media-card.tsx',
  'src/shared/components/navigation/popover-nav.tsx',
  'src/shared/components/navigation/site-navbar.tsx',
  'src/shared/components/tiptap/tiptap.tsx',
  'src/shared/domains/funnels/ui/blocks/before-after-showcase.tsx',
  'src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx',
  'src/shared/entities/customers/components/profile/customer-hero-header.tsx',
  'src/shared/modules/proposals/core/components/overview-card.tsx',
  // Modal scrims.
  'src/shared/components/ui/alert-dialog.tsx',
  'src/shared/components/ui/dialog.tsx',
  'src/shared/components/ui/drawer.tsx',
  'src/shared/components/ui/sheet.tsx',
  'src/shared/components/ui/sidebar-mobile-drawer.tsx',
  // A data mark (bar fill), not a surface.
  'src/features/lead-sources-admin/ui/components/lead-source-funnel.tsx',
  // Follow-up: public-site `secondary` is used as a brand accent and renders grey today.
  'src/features/landing/ui/components/about/company-story.tsx',
  'src/features/landing/ui/components/about/process-overview.tsx',
  'src/shared/components/decorative-line.tsx',
  // Follow-up: the proposal-flow navbar needs a visual check before its grey band moves.
  'src/features/proposal-flow/ui/components/navbar/navbar-frame.tsx',
  'src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx',
  'src/features/proposal-flow/ui/components/navbar/navbar.tsx',
]
```

- [ ] **Step 2: Share the plugin and add the block**

Above the `project/theme-tokens` block, hoist the plugin to a constant. A flat config can declare one plugin name in two blocks only if both use the same object:

```js
const themeTokensPlugin = { rules: {
  'palette': builtinRules.get('no-restricted-syntax'),
  'type-ramp': builtinRules.get('no-restricted-syntax'),
  'surface-alpha': builtinRules.get('no-restricted-syntax'),
} }
```

(Declare it next to the other top-level constants, not inside the `.append` chain.) In the existing block, replace the inline `plugins: { 'theme-tokens': { rules: { … } } },` with `plugins: { 'theme-tokens': themeTokensPlugin },`. Then chain a new block after the theme-tokens `.append({...})`:

```js
}).append({
  // Its own block because its ignores differ: the landing pages and funnels are swept, not exempt.
  name: 'project/surface-alpha',
  files: ['src/**/*.{ts,tsx}'],
  ignores: SURFACE_ALPHA_IGNORES,
  plugins: { 'theme-tokens': themeTokensPlugin },
  rules: {
    'theme-tokens/surface-alpha': ['warn',
      { selector: `Literal[value=${SURFACE_ALPHA_RE}]`, message: SURFACE_ALPHA_MSG },
      { selector: `TemplateElement[value.raw=${SURFACE_ALPHA_RE}]`, message: SURFACE_ALPHA_MSG },
    ],
  },
})
```

(The spec says "in the existing block". It is a sibling block here because the ignore lists differ. Behaviour is what the spec describes.)

- [ ] **Step 3: The rule fires, and only where it should**

Run: `pnpm lint 2>&1 | grep -c "theme-tokens/surface-alpha"`
Expected: a count well above zero (roughly 280–340; the inventory has 488 usages, of which 146 are kept and many already went in Tasks 2–8). Record the number in the task report.

Run: `pnpm lint 2>&1 | grep -B1 "theme-tokens/surface-alpha" | grep -E "text-muted-foreground|ring-ring/|bg-primary/|bg-status-" | head`
Expected: no output. The rule must not fire on `text-*`, `ring-ring/NN` or accent/status alpha.

Run: `pnpm lint 2>&1 | grep -E "^\s+[0-9]+:[0-9]+\s+error" | head`
Expected: no new errors (warnings only).

- [ ] **Step 4: Commit**

```bash
git add eslint.config.js
git commit -m "chore(lint): theme-tokens/surface-alpha flags see-through surface classes (warn during the sweep)

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Sweep rules (Tasks 10–14)

Every sweep task applies these rules to its directories. Work from `pnpm lint <dir> 2>&1 | grep surface-alpha`, and use the inventory's §7 rows (and §6 for flagged rows) for each hit's target.

**Target → class.** Keep the utility prefix and every variant (`hover:`, `dark:`, `data-[…]:`, `group-hover:`, `!`); swap only the colour and drop the `/NN`:

| Inventory target | Becomes | Example |
|---|---|---|
| `muted` | `…-muted` | `hover:bg-accent/50` → `hover:bg-muted` |
| `border` | `…-border` | `border-foreground/10` → `border-border`; `divide-border/60` → `divide-border`; `dark:bg-border/40` → `dark:bg-border` |
| `border-strong` | `…-border-strong` | `border-foreground/25` → `border-border-strong` |
| `card` | `…-card` | `bg-card/60` → `bg-card` |
| `canvas` | `…-background` | (only rows not overridden below) |
| `raised` | `…-surface-raised` | `bg-background/80` (floating capsule) → `bg-surface-raised` |
| `band` | `…-band` | (only rows not overridden below) |
| `row-hover` | `…-row-hover` | `hover:bg-accent/30` → `hover:bg-row-hover` |
| `keep …` or `n/a …` | unchanged | the file is in `SURFACE_ALPHA_IGNORES` |

**Spec overrides.** These win over the inventory's proposed target:

1. **Filled-control hover.** Every `hover:bg-secondary/80`, `hover:bg-secondary/90`, `[a&]:hover:bg-secondary/90` and `hover:bg-muted/80` becomes `hover:bg-border` (same variants).
2. **Selected state.** Every row whose role contains "selected" and whose target is `muted`, `raised` or `card` becomes `bg-row-selected`, for example `time-range-chips.tsx:39` `bg-foreground/5`, `page-size-segmented.tsx:27` `bg-foreground/10` and `status-dropdown-cell.tsx:82` `bg-accent/60`. Selected **borders** keep `border-strong`.
3. **Menu highlight.** `dropdown-menu.tsx` `focus:bg-muted/50` and `data-[state=open]:bg-muted/50` become `focus:bg-row-hover` and `data-[state=open]:bg-row-hover`.
4. **Sticky blur headers and the public dropdown panel** keep glass through the token: `top-bar.tsx:28` `bg-background/85`, `story-scopes-bar.tsx:21` `bg-background/80`, `site-navbar.tsx:146` `bg-background/95` and `site-navbar.tsx:215` `bg-background/80` become `bg-(--popover-glass)`, keeping their `backdrop-blur-*`. (`site-navbar.tsx` stays in the ignore list for its hero-hover rows.)
5. **Outline button.** `button.tsx:18` `border-border/70` and `dark:border-border/70` → `border-border` (drop the duplicate dark variant); `hover:bg-foreground/5` → `hover:bg-muted`.
6. **Gradient to solid.** `pdf-fallback-card.tsx:26-27`: `bg-card/60` → `bg-card`, and delete the gradient classes (`bg-gradient-to-*`/`bg-linear-*`, `from-card/80`, `to-card/40`).
7. **Hand-mixed form panels** (inventory §3): `bg-[color-mix(in_oklch,var(--card)_97%,var(--foreground)_3%)]` → `bg-band` in `proposal-flow/…/form/project-fields.tsx`, `…/form/funding-fields.tsx`, `project-management/…/form/{homeowner,basic-info,story-content}-fields.tsx`.
8. **Collapse duplicates.** When a base class and its `dark:` twin now map to the same class (`bg-muted/30 dark:bg-muted/20` → `bg-muted bg-muted`), keep one and delete the `dark:` one.
9. **Leave alone:** `bg-primary/NN`, `ring-ring/NN`, status and destructive alpha (out of scope, inventory §4); raw `white`/`black` alpha (§5); presentation tokens (§3); shadow alpha.

**When the inventory row and the code disagree** (the class moved or vanished), trust the code: sweep the class the lint rule points at, by the role you can read in context, and note it in the task report. If the role is unclear, stop and ask.

**Each sweep task ends with:** `pnpm lint <its dirs> 2>&1 | grep -c surface-alpha` → `0`, then `pnpm tsc`, then one Playwright look at one page from its area in both schemes (`node $SCRATCH/surface-verify/verify.mjs ramp`, re-pointed at that route, just for the screenshots).

---

## Task 10: Sweep: shared primitives and shared components

**Files (from inventory §7):** everything under `src/shared/components/**` with hits, and `src/shared/constants/**`. That is `ui/*` (badge, button, dropdown-menu, select, tabs, command, calendar, and the rest listed), `data-table/**` (the rows left after Task 5, for example `status-dropdown-cell.tsx`), `query-toolbar/**` (18), `contract-status-panel/**`, `kanban/**`, `stat-bar/**`, `media/**` (non-scrim rows), `navigation/**` (non-hero rows), `buttons/**`, `customer-search.tsx`, `collapsible-section.tsx`, `loading-hairline.tsx` (→ `bg-border-strong`), `push-subscription-banner.tsx`, `pwa-install-prompt.tsx` (Part B file: `bg-popover/95` → `bg-surface-raised`; stage it only under the Task 0 ruling), `states/**`.

**Interfaces:** consumes the Sweep rules. Produces zero `surface-alpha` warnings under `src/shared/components` and `src/shared/constants`.

- [ ] **Step 1:** `pnpm lint src/shared/components src/shared/constants 2>&1 | grep surface-alpha | wc -l`. Record N.
- [ ] **Step 2:** Apply the Sweep rules to every hit, file by file. The primitives (`ui/button.tsx`, `ui/badge.tsx`, `ui/dropdown-menu.tsx`) go first, because every page reads them.
- [ ] **Step 3:** `pnpm lint src/shared/components src/shared/constants 2>&1 | grep -c surface-alpha`. Expected: `0`.
- [ ] **Step 4:** `pnpm tsc && pnpm theme:check`. Expected: pass.
- [ ] **Step 5:** Run `node $SCRATCH/surface-verify/verify.mjs tables rows`. Expected: still `✓`. Open one dropdown and one secondary button by hand in the screenshot run, or add a `page.click('[data-slot=dropdown-menu-trigger]')` before the screenshot, and look.
- [ ] **Step 6: Commit** by explicit pathspec: `git add` followed by the exact files touched (list them from `git diff --name-only -- src/shared/components src/shared/constants`), and exclude any Part B file unless Task 0 allows it.

```bash
git commit -m "refactor(theme): shared components use solid surface steps

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Sweep: entities, modules, domains, app routes

**Files (inventory §7):** `src/shared/entities/**` (customers 10, meetings 16, lead-sources 2), `src/shared/modules/**` (proposals 6), `src/shared/domains/funnels/**` (13; funnels sit under `.funnel-light`, whose literal tokens still apply to the swept solid classes), `src/app/(frontend)/**` (3 in `test/page.tsx`).

- [ ] **Step 1:** `pnpm lint src/shared/entities src/shared/modules src/shared/domains "src/app" 2>&1 | grep surface-alpha | wc -l`. Record N.
- [ ] **Step 2:** Apply the Sweep rules. `overview-card.tsx:395` and `timeline-filter-chips.tsx:30` take override 1 (`hover:bg-border`); `timeline-event-item.tsx:87` (expanded) → `bg-surface-raised`; the participant-picker rows → `bg-card`.
- [ ] **Step 3:** Rerun the Step 1 command with `grep -c`. Expected: `0`.
- [ ] **Step 4:** `pnpm tsc`. Then run the ramp screenshots on `/dashboard/customers` (open one customer profile in the run: `page.click('tbody tr[data-band] td:nth-child(2)')`). Look at the nested-dark hero in the light screenshot.
- [ ] **Step 5: Commit** by explicit pathspec (`git diff --name-only -- src/shared/entities src/shared/modules src/shared/domains "src/app"`):

```bash
git commit -m "refactor(theme): entity, module and funnel surfaces use solid steps

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: Sweep: dashboard features

**Files (inventory §7):** `src/features/agent-dashboard/**` (rows left after Task 7, for example `action-card.tsx`, `dashboard-action-queue.tsx`, `dashboard-meetings-calendar.tsx`, `dashboard-snapshot-chips.tsx`), `agent-settings/**`, `analytics/**` (rows left after Task 8: `headline-figure.tsx:34` → `hover:bg-muted`, `series-toggle.tsx:30` → `border-border-strong`), `calculators/**` (`top-bar.tsx` override 4), `campaigns-admin/**`, `customer-pipelines/**` (the twin wells on `customer-kanban-card.tsx:114,211` both → `bg-muted`), `intake/**`, `lead-sources-admin/**` (28; time-range-chips override 2), `schedule-management/**`.

- [ ] **Step 1:** `pnpm lint src/features/agent-dashboard src/features/agent-settings src/features/analytics src/features/calculators src/features/campaigns-admin src/features/customer-pipelines src/features/intake src/features/lead-sources-admin src/features/schedule-management 2>&1 | grep surface-alpha | wc -l`. Record N.
- [ ] **Step 2:** Apply the Sweep rules.
- [ ] **Step 3:** Same command with `grep -c`. Expected: `0`.
- [ ] **Step 4:** `pnpm tsc`. Then `node $SCRATCH/surface-verify/verify.mjs gutter rows analytics`. Expected: all `✓`.
- [ ] **Step 5: Commit** by explicit pathspec (`git diff --name-only -- <the dirs above>`, excluding Part B files unless Task 0 allows them):

```bash
git commit -m "refactor(theme): dashboard feature surfaces use solid steps

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: Sweep: meeting-flow, proposal-flow, project-management

**Files (inventory §7):** `src/features/meeting-flow/**` (51, excluding the off-limits presentation folders), `src/features/proposal-flow/**` (41, excluding the navbar trio; override 7 on the form panels; override 6 on `pdf-fallback-card.tsx`), `src/features/project-management/**` (43; override 4 on `story-scopes-bar.tsx`; `project-media-manager.tsx:361` floating bar → `bg-surface-raised`; override 7 on the form panels).

- [ ] **Step 1:** `pnpm lint src/features/meeting-flow src/features/proposal-flow src/features/project-management 2>&1 | grep surface-alpha | wc -l`. Record N.
- [ ] **Step 2:** Apply the Sweep rules. `step-capsule.tsx:37` `bg-background/80` → `bg-surface-raised`; its presentation-tone class on :36 stays. `program-card.tsx:119` selected borders → `border-border-strong` and `ring-border-strong`.
- [ ] **Step 3:** Same command with `grep -c`. Expected: `0`.
- [ ] **Step 4:** `pnpm tsc`. Screenshots in both schemes: one `/proposal-flow/…` page (take a real route from `src/app/(frontend)/proposal-flow`) and one meeting-flow step (a route from `src/app/(frontend)/dashboard/meetings/[meetingId]`). Use ids from the default login's own lists; do not create records.
- [ ] **Step 5: Commit** by explicit pathspec:

```bash
git commit -m "refactor(theme): meeting-flow, proposal-flow and project surfaces use solid steps

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Sweep: public site, then the rule becomes an error

**Files:** `src/features/landing/**` (132 hits; most are kept scrims, and the swept ones are wells, borders and filled-chip hovers, for example `projects-grid.tsx:66` override 1, and `company-story.tsx:131` `bg-background/80` → `bg-card` even though the file is ignored), `eslint.config.js`.

- [ ] **Step 1:** Sweep every non-kept `src/features/landing/**` row in the inventory, **including rows in ignored files** (the ignore list only silences lint; it does not exempt a row the inventory says to sweep). Work from the inventory here, since lint is silent on ignored files.
- [ ] **Step 2:** In `eslint.config.js`, change `'theme-tokens/surface-alpha': ['warn',` to `'theme-tokens/surface-alpha': ['error',`.
- [ ] **Step 3:** `pnpm lint`. Expected: exit 0 with zero `surface-alpha` messages anywhere.
- [ ] **Step 4:** Check the ignore list is not stale: for each path in `SURFACE_ALPHA_IGNORES`, `grep -cE "(bg|border|from|via|to|divide|ring)-(background|card|muted|secondary|accent|popover|border|foreground|sidebar[a-z-]*)/[0-9]" <path>` must be ≥ 1. Remove any path that returns 0 (nothing left to exempt), and rerun `pnpm lint`.
- [ ] **Step 5:** `pnpm tsc`. Screenshots of `/` and one `/services/…` page in both schemes.
- [ ] **Step 6: Commit** by explicit pathspec (`git diff --name-only -- src/features/landing` plus `eslint.config.js`):

```bash
git commit -m "refactor(theme): public-site surfaces use solid steps; see-through surface classes are now a lint error

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: DESIGN.md, the stale follow-up line, the follow-ups doc (uncommitted)

**Files:**
- Modify: `DESIGN.md` (Colors → Neutral — The Command Desk; Layout; Elevation & Depth; Cards / Containers; Navigation (app sidebar))
- Modify: `docs/plans/2026-09-29-dashboard-theme-follow-ups.md:14` (delete the line)
- Create: `docs/plans/2026-09-30-surface-elevation-follow-ups.md`

- [ ] **Step 1: DESIGN.md.** Replace the **Neutral — The Command Desk** bullets for Cool Paper, Card White, Surface Raised, Hairline/Border Strong and Navy Rail with one ramp description that matches the code:

```markdown
- **The ramp.** Every app surface is one cool hue (`--surface-h` 255) at a lightness step above the
  page, set by four settings per mode in `globals.css` (`--surface-c`, `--canvas-l`, `--lift`, `--edge-dir`).
  Page (canvas) → muted (+½ step: wells, tabs, header strips) → band (every other row) → card (+1 step)
  → raised (+2 steps; in light mode it clamps at white and the step is carried by shadow).
  Borders step from the card toward the ink (darker in light, lighter in dark): `--border` 2 steps,
  `--border-strong` 3. Rows: `--row-hover` / `--row-selected` are the primary mixed 8% / 12% into the card.
  Skeletons draw at the border step. Tune the look by changing a setting, never a surface token.
- **No see-through surfaces.** `bg-muted/40`-style classes are a lint error (`theme-tokens/surface-alpha`);
  the exceptions are scrims over photos, modal scrims and the one glass token, `--popover-glass`.
```

In **Layout**, add a named rule:

```markdown
**The One Gutter Rule.** One `--gutter` (8px) is the floating rail's inset, the page's top, right and
bottom margin, and every gap between section cards. Headings stay inside their cards; the gap carries
no labels.
```

In **Elevation & Depth**, change the glass sentence to say `--popover-glass` is `color-mix(in oklab, var(--popover) 78%/62%, transparent)`, and add: `Sunlight from above: the page is the darkest layer; everything on it is lighter. Above the card in light mode, only shadow can carry the step.`

In **Cards / Containers**, make the Background line read `card step of the ramp` and add `Lists inside a card are banded rows, never cards inside cards.`

In **Navigation (app sidebar) — the Navy Rail**, update Fill (light `oklch(0.22 0.06 262)`, dark = the card step at navy chroma), Active state (a darker navy pill `--sidebar-accent`, label `--sidebar-accent-foreground`, icon `--sidebar-active-icon` = brand cyan) and Hover (solid `--sidebar-hover`, one step above the rail).

- [ ] **Step 2: Stale line.** Delete line 14 of `docs/plans/2026-09-29-dashboard-theme-follow-ups.md` ("Six files carry theme edits that are NOT committed…"). Commit `6065c2ab` shipped those six files.

- [ ] **Step 3: Follow-ups doc.** Create `docs/plans/2026-09-30-surface-elevation-follow-ups.md` with:

```markdown
# Surface elevation — follow-ups

From `docs/superpowers/specs/2026-09-30-surface-elevation-gutter-design.md` §9 and the build.

- [ ] Tune the four settings after the owner's iPad daylight check (one-line changes in globals.css).
- [ ] Dark `--border` and `--skeleton` on a card measure 1.29:1 against the spec's 1.30 target; theme:check's dark floor is 1.25. Raise `--lift` or the border factor in dark if the iPad check says edges are weak.
- [ ] Proposal-flow navbar (`navbar-frame.tsx` `bg-foreground/20`, tabs `/40`): visual check, then a solid step or a named glass.
- [ ] Public-site `secondary` used as a brand accent (22 hits, renders grey): pick an accent token.
- [ ] Accent and status alpha (`bg-primary/NN`, status tints; 286 usages): its own sweep with its own tokens.
- [ ] Categorical chart palette (already on the Navy Rail follow-ups).
- [ ] Phone dock (Navy Rail Part B) inherits the sidebar tokens; its own spec stays separate.
- [ ] `coming-soon-state.tsx` still uses `oklch(from …)` (Safari < 18 drops it); decorative, left as is.
```

Leave all three uncommitted (Global Constraints). Report them in the task report.

---

## Task 16: Full verification pass

**Files:**
- Create (scratch): `$SCRATCH/surface-verify/checks/scopes.mjs`

- [ ] **Step 1: Fresh CSS.** Ask the owner to stop the dev server, `rm -rf .next` and restart (run `ss -ltnp` first; never kill a server you did not start). Wait for their go-ahead.

- [ ] **Step 2: Scopes check**

Create `$SCRATCH/surface-verify/checks/scopes.mjs`:

```js
export const route = '/'
export const viewports = ['desktop', 'phone']

export async function run(page) {
  return page.evaluate(() => {
    const failures = []
    for (const cls of ['funnel-light', 'theme-marketing']) {
      const host = document.createElement('div')
      host.className = cls
      document.body.append(host)
      const bg = window.__probe('var(--background)', 'backgroundColor', host)
      if (bg !== 'rgb(250, 247, 241)') failures.push(`.${cls} background ${bg}, want #faf7f1`)
      host.remove()
    }
    return failures
  })
}
```

- [ ] **Step 3: Everything, both schemes, all four sizes**

Set `viewports` to `['desktop', 'laptop', 'ipad', 'phone']` in `tables.mjs`, `rows.mjs` and `analytics.mjs` (`gutter.mjs` stays md+ only). Then run:

`node $SCRATCH/surface-verify/verify.mjs`

Expected: every line `✓`. On any `✗`, fix it in the owning task's files and rerun that check only.

- [ ] **Step 4: The list the spec names (spec §7), by eye from the screenshots or one extra run each:** sidebar expanded, collapsed and phone sheet; one popover, dialog, sheet, toast and the Filters glass popover (open each with a `page.click` before its screenshot); `/`, one funnel page, one `/proposal-flow` page, one meeting-flow step; the customer profile modal hero in light mode.

- [ ] **Step 5: Gates**

Run: `pnpm theme:check && pnpm lint && pnpm tsc`
Expected: all pass, with zero `surface-alpha` messages.

Run: `grep -rn "CELL_BORDER\|sidebar-primary\|oklch(from" src | grep -v coming-soon-state`
Expected: no output.

- [ ] **Step 6: Report** with a table of clickable file links for every changed file, the screenshot folder path, the checks run with their results, and anything skipped. Then the owner's iPad daylight check closes the work (spec §7).

---

## Handoff notes for the owner (read at plan review)

- **`--sidebar-primary` is removed.** Every reader was an active icon or label on the old cyan pill. On the new navy pill, navy would vanish, so they all move to `--sidebar-active-icon` (cyan) and the old token goes. The count stays at one token for one job.
- **The nav well in the rail loses its fill.** Once hover is solid, a hovered item inside the well can't change colour. The approved Sidebar 1 mock has no well.
- **Dark border contrast.** The spec's own dark values give 1.29:1 for border and skeleton on a card, against its 1.30 target. `theme:check` uses a 1.25 dark floor so it passes as specced, and the follow-ups list it for the iPad tuning.
- **The `surface-alpha` rule is a sibling ESLint block, not a line inside `project/theme-tokens`,** because its ignore list differs: landing and funnels are swept, not exempt.
- **Part B.** See Task 0. The three shared files cannot be half-staged.
