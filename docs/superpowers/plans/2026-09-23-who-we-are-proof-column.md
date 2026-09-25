# Who We Are proof column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Who We Are points 1 (licensing), 4 (communication) and 6 (proof of performance) a centrepiece that fills the right column, with a uniform three-tile proof rail under it.

**Architecture:**
- Feature-local components in `MF/ui/components/steps/who-we-are/`, driven by the slide constants. There is no engine change.
- Licensing stays a fixed-canvas slide on `PointLayout`. Communication and Performance become growth slides on a new `GrowthLayout` (the comparison slides move onto it too).
- The only new data is the homeowner quotes: an edge mapper in `MF/lib/` over the showroom query the meeting already fires.

**Tech Stack:** Next.js 15, React 19, Tailwind v4 (container queries on the named `presentation` container), motion/react, react-compare-slider 4.0.0-2, TanStack Query + tRPC.

**Spec:** `docs/superpowers/specs/2026-09-23-who-we-are-proof-column-design.md` (approved 2026-09-23). Studies page: https://claude.ai/artifact/7oZkzCGhDS2FVo8NpMycA6 (version 2).

## Global Constraints

### Tooling and git
- **pnpm.** `@/` maps to `src/` and `@public/` to `public/`. **Never run `pnpm build`.** Verification is `pnpm tsc`, `pnpm exec eslint <files>`, and `pnpm lint` once at the end.
- **The working tree is shared with the owner's live editor.** Forbidden: `git stash`, `git checkout <ref> -- .`, `git restore` beyond your own task's files, `git reset`, `git add -A`, `git add .`, `git add -u`, `git mv`.
- **Work on `main`.** Commit steps run only if the owner confirmed per-task commits at execution start. Otherwise stop before the commit step and report the paths.
- **Commit recipe (exact).** The trailer is `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. If either check in (4) fails, stop and report BLOCKED; don't repair git state.
  1. `git diff --cached --name-status | wc -l`, and note N.
  2. `git add -- <only the NEW files you created>`.
  3. `git commit -m "…" -- <every path of your task: new, modified, deleted>`.
  4. `git show --stat HEAD` lists only your paths, and `git diff --cached --name-status | wc -l` prints N again.
- **Foreign uncommitted work.** Before editing any file, run `git diff --stat -- <file>`. If it shows changes you didn't make, stop and report BLOCKED with the file name. ("Before Task 1" clears the four known files.)
- **Files off limits:** `src/trpc/**`, `src/shared/entities/**`, `src/shared/modules/**`, `src/shared/db/**`, `src/shared/services/**`, `src/shared/dal/**`, `src/shared/components/presentation/**` (the engine; no change is needed), `docs/design-system/**`, seeds, `scripts/**`. If a task seems to need one, stop and report BLOCKED.
- **Owner rule.** Anything outside a task's brief goes to the owner as a question.
- **Dev server on port 3000 is the owner's.** Never start, stop or restart it, and never touch `.next`. It compiled its CSS at boot, so every browser script injects a fresh build (`buildCss()`) before judging styles.

### Coding conventions (repo memory `coding-conventions`)
- One React component per file.
- No file-level constants or helpers in component, hook or context files. Feature constants go to `MF/constants/`, pure functions to `MF/lib/`.
- Named exports only. Prop interfaces stay in the component file. `import type` for type-only imports.
- Explicit `{ }` on every `if`.
- `'use client'` on every component that uses hooks or motion.
- Run `pnpm exec eslint --fix <files>` after writing a file.

### Comments
- **Comments say why, never what** (CLAUDE.md). New comments **never cite a spec, plan, task or doc**: no "spec C §", no "(C42)", no "D5". When you rewrite a doc comment on a file you touch, drop the old citations.

### Vocabulary
- Code says *presentation*, *slide*, *frame*, *run*, *heading column*, *content*, *subheading*, *growth slide*, *centrepiece*, *proof rail*.
- "Beat" never appears in code. "Stage" is the shell's word and never appears in `MF/ui/components/steps/who-we-are/**`.

### Type and colour
- **Type:** no `font-medium`. Titles are `font-sans font-semibold`, figures `font-bold`, and body inherits Nunito. Eyebrows and timeline stage labels are `font-mono font-bold uppercase` (Space Mono is the app's `--font-mono`).
- **Sizes:** in the presentation, text sizes come only from `text-presentation-{display,title,figure,lead,body,label}`. Group spacing uses `gap-presentation-{tight,group,zone}` / `p*-presentation-*`. No viewport `sm:`/`md:`/`lg:` variants: responsive changes use `@max-[40rem]/presentation:` (timeline) and `@max-[30rem]/presentation:` (rail and quote stacking).
  - Exception: the document dialog portals out of the presentation container, so its new zoom control uses `text-sm`.
- **Colour:** no new colour literals in class names. The accent is `(--presentation-accent)`, the ground `(--presentation-ground)`, and white ink `text-white/NN`.
  - Exception: the compare knob's inline `buttonStyle` (a library style object) uses `'white'` and `'var(--presentation-ground)'`.
- **Tailwind v4 doesn't reliably scan `.ts` files:** keep every utility class literal inside `.tsx` files. Constants carry data and icons, never class names.

### Motion
- `motion/react` only. The easing is `BRAND_EASE` from `@/shared/constants/motion`.
- Reduced motion is handled by the existing `MotionConfig reducedMotion="user"` around the presentation. Add no new gate.
- `Reveal` (`@/shared/components/presentation/reveal`) wraps text and proof groups, never media (the documents already do; the compare slider does not).

### Company facts
- Company facts come only from `src/shared/constants/company/`, `MF/constants/due-diligence.ts`, or copy listed in the spec §3.
- **Excluded:** workers' comp, professional liability, license classification, and `testimonials.ts`/`awards.ts`/`certifications.ts`.

### Browser and workspace
- **Browser:** standalone Node scripts in `$WS/tools/`, importing the previous run's helpers: `import { buildCss, openStep1, setup } from '../../2026-09-22-presentation-config-and-critique/tools/common.mjs'`.
  - `setup()` logs in through `/api/dev/playwright-session`, reading `DEV_LOGIN_SECRET` at runtime; never print it.
  - Dev meeting `2069fa85-0357-4550-8eb5-6ae40eacf5a9`, step 1. Step 1 writes nothing to the meeting.
  - Screenshots go to `.playwright-mcp/` (git-ignored).
- **Pure functions** get an assertion script in `$WS/checks/`, run with `pnpm exec tsx <script>` from the repo root. Write it first, watch it fail, then implement.
- `$WS` = `.superpowers/sdd/2026-09-23-who-we-are-proof-column` (git-ignored). `MF` = `src/features/meeting-flow`. `W` = `MF/ui/components/steps/who-we-are`.

## Review Focus

1. **A vertical swipe on the before/after photo on a touch tablet** must move the presentation, not get trapped by the slider. Only a sideways drag moves the divider. Pinned in Task 2 (`synthesizeScrollGesture` over the compare).
2. **Homeowner names from real data:** null, blank, one word, an initial already abbreviated, or prefixed with a non-letter marker (dev data's `🧪`). The caption must never read "null", "🧪 T." or "undefined". Pinned in Task 1.
3. **No quotes** (loading, error, or none pass the filter): no empty figure, no stray pager. Pinned in Task 2 (the route rewrites the showroom result to `[]`).
4. **Reopening a document tile after zooming out** must open zoomed again, not remember the last zoom-out. Pinned in Task 3.
5. **Short stages (1024×768, where a slide is 504px tall):** Communication and Performance grow instead of clipping. No text clips anywhere and no tile value overflows its column. Pinned in Tasks 2 and 4 (`clipped` and growth checks), swept in Task 5.

## Rulings made while planning

| Ruling | Why | Cost if wrong |
|---|---|---|
| The `agent` arm gains `timelineLabel: string` ("From today to the final walkthrough"), which the spec's §4.1 list didn't name | Spec §4.7 requires an `aria-label` on the timeline; copy lives in constants, not components | One field to drop |
| During Task 2 the reputation marks are a module constant `REPUTATION` used by both Licensing and Performance; Task 3 removes Licensing's use | Each task must compile and render; the marks move without a gap | None; the interim is one task long |
| The first stage dot's "you are here" ring uses `ring-4 ring-(--presentation-accent)/20` | The mock's ring; a crisp ring, not a glow | Visual only |
| Tasks run in the order quotes → Performance → Licensing → Communication → sweep | Performance introduces the shared rail and `GrowthLayout`; Licensing then Communication consume them | None |

## Before Task 1 (controller, with the owner)

- [ ] The owner commits the docs-prune edits sitting uncommitted in `MF/constants/who-we-are-slides.ts`, `MF/types/index.ts`, `W/index.tsx` and `W/document-dialog.tsx` (comment-only citation removals). Confirm with `git diff --stat -- <those four>`, which should print nothing.
- [ ] The owner confirms per-task commits to `main` (yes / stage only).
- [ ] `mkdir -p .superpowers/sdd/2026-09-23-who-we-are-proof-column/{tools,checks}`.
- [ ] The owner's dev server answers on :3000 (`ss -ltnp | grep :3000`).

---

### Task 1: Homeowner quotes from the portfolio read

**Files:**
- Create: `MF/constants/homeowner-quotes.ts`
- Create: `MF/lib/pick-homeowner-quotes.ts`
- Create: `MF/hooks/use-homeowner-quotes.ts`
- Modify: `MF/types/index.ts` (add `HomeownerQuote`)
- Test: `$WS/checks/pick-homeowner-quotes.check.ts`

**Interfaces:**
- Consumes: `PortfolioProject` (`@/shared/modules/projects/core/types`: `{ project: Project, heroImage: ProjectMediaFile | null, scopeIds: string[] }`); `TradeScopeGroup` (`@/shared/modules/construction/core/lib/build-catalog-index`); `Trade` (`@/shared/modules/construction/core/schemas`, which has `name`); `useTradeCatalogContext()` → `{ catalog: { scopesByTrade, tradesById }, projects }`; `useTradeSelections()` → `TradeSelection[]` (each has `tradeId`); `SHOWCASE_PROJECTS_STALE_MS`.
- Produces: `type HomeownerQuote = { id: string, text: string, shortName: string | null, city: string, trade: string | null, image: string }`; `pickHomeownerQuotes(rows: PortfolioProject[], options: PickHomeownerQuotesOptions): HomeownerQuote[]`; `useHomeownerQuotes(): HomeownerQuote[]`; `HOMEOWNER_QUOTE_LIMIT = 3`; `HOMEOWNER_QUOTE_MAX_LENGTH = 240`.

- [ ] **Step 1: Add the type.** In `MF/types/index.ts`, after `PresentationPartner`, add:

```ts
/** A portfolio homeowner's words, reduced to what the Performance slide shows. */
export interface HomeownerQuote {
  id: string
  text: string
  /** First name and last initial, e.g. "Sarah T."; `null` when the project has no usable name. */
  shortName: string | null
  city: string
  trade: string | null
  /** The project's hero image URL. */
  image: string
}
```

- [ ] **Step 2: Write the failing check.** Create `$WS/checks/pick-homeowner-quotes.check.ts`:

```ts
import type { PortfolioProject } from '../../../../src/shared/modules/projects/core/types'
import assert from 'node:assert/strict'
import { pickHomeownerQuotes } from '../../../../src/features/meeting-flow/lib/pick-homeowner-quotes'

type Options = Parameters<typeof pickHomeownerQuotes>[1]

function row(id: string, over: { quote?: string | null, name?: string | null, scopes?: string[], hero?: boolean } = {}): PortfolioProject {
  return {
    project: {
      id,
      homeownerQuote: over.quote === undefined ? `Quote ${id}` : over.quote,
      homeownerName: over.name === undefined ? 'Sarah Tanaka' : over.name,
      city: 'Pomona',
    },
    heroImage: over.hero === false ? null : { url: `https://media.example/${id}.jpg` },
    scopeIds: over.scopes ?? [],
  } as unknown as PortfolioProject
}

const scopesByTrade = new Map([
  ['bath', { scopes: [{ id: 's-bath-1' }, { id: 's-bath-2' }], addons: [] }],
  ['kitchen', { scopes: [{ id: 's-kit-1' }], addons: [{ id: 'a-kit-1' }] }],
]) as unknown as Options['scopesByTrade']
const tradesById = new Map([['bath', { name: 'Bathroom' }], ['kitchen', { name: 'Kitchen' }]]) as unknown as Options['tradesById']
const base: Options = { scopesByTrade, tradesById, preferredTradeIds: new Set<string>(), limit: 3, maxLength: 240 }
const one = (r: PortfolioProject) => pickHomeownerQuotes([r], base)[0]

// A row needs a hero image and a quote of 1 to maxLength characters.
assert.deepEqual(pickHomeownerQuotes([row('a', { hero: false }), row('b', { quote: '   ' }), row('c', { quote: null }), row('d', { quote: 'x'.repeat(241) })], base), [])
assert.equal(pickHomeownerQuotes([row('e', { quote: 'x'.repeat(240) })], base).length, 1)

// Wrapping quote marks are stripped; inner ones stay.
assert.equal(one(row('f', { quote: '  "We love it."  ' })).text, 'We love it.')
assert.equal(one(row('g', { quote: '“Night and day,” she said.”' })).text, 'Night and day,” she said.')

// Names: first name and last initial; words without a letter are ignored.
assert.equal(one(row('n1', { name: 'Sarah Tanaka' })).shortName, 'Sarah T.')
assert.equal(one(row('n2', { name: '🧪 Sarah Tanaka' })).shortName, 'Sarah T.')
assert.equal(one(row('n3', { name: 'Harold' })).shortName, 'Harold')
assert.equal(one(row('n4', { name: 'Juanita S.' })).shortName, 'Juanita S.')
assert.equal(one(row('n5', { name: null })).shortName, null)
assert.equal(one(row('n6', { name: '  ' })).shortName, null)
assert.equal(one(row('n7', { name: '🧪' })).shortName, null)

// Trade: the trade with the most scope hits; null when no scope maps.
assert.equal(one(row('t1', { scopes: ['s-kit-1', 's-bath-1', 'a-kit-1'] })).trade, 'Kitchen')
assert.equal(one(row('t2', { scopes: ['unknown'] })).trade, null)

// Image and city pass through.
assert.equal(one(row('i1')).image, 'https://media.example/i1.jpg')
assert.equal(one(row('i1')).city, 'Pomona')

// Order: preferred-trade hits first (most first), then portfolio order; limit applies last.
const rows = [row('p1', { scopes: ['s-bath-1'] }), row('p2', { scopes: ['s-kit-1'] }), row('p3', { scopes: ['s-kit-1', 'a-kit-1'] }), row('p4'), row('p5', { scopes: ['s-kit-1'] })]
assert.deepEqual(pickHomeownerQuotes(rows, { ...base, preferredTradeIds: new Set(['kitchen']) }).map(q => q.id), ['p3', 'p2', 'p5'])
assert.deepEqual(pickHomeownerQuotes(rows, base).map(q => q.id), ['p1', 'p2', 'p3'])

console.log('pick-homeowner-quotes: all checks pass')
```

- [ ] **Step 3: Run it and watch it fail.**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-23-who-we-are-proof-column/checks/pick-homeowner-quotes.check.ts`
Expected: FAIL, with "Cannot find module … pick-homeowner-quotes".

- [ ] **Step 4: Write the constants.** Create `MF/constants/homeowner-quotes.ts`:

```ts
/** How many homeowners the agent can switch between on the Performance slide. */
export const HOMEOWNER_QUOTE_LIMIT = 3

/** Longer quotes are skipped rather than clamped: this is four lines on a portrait tablet, and clipped words read as a defect. */
export const HOMEOWNER_QUOTE_MAX_LENGTH = 240
```

- [ ] **Step 5: Write the picker.** Create `MF/lib/pick-homeowner-quotes.ts`:

```ts
import type { HomeownerQuote } from '@/features/meeting-flow/types'
import type { TradeScopeGroup } from '@/shared/modules/construction/core/lib/build-catalog-index'
import type { Trade } from '@/shared/modules/construction/core/schemas'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'

export interface PickHomeownerQuotesOptions {
  scopesByTrade: ReadonlyMap<string, TradeScopeGroup>
  tradesById: ReadonlyMap<string, Pick<Trade, 'name'>>
  /** The meeting's trades: their projects come first. */
  preferredTradeIds: ReadonlySet<string>
  limit: number
  maxLength: number
}

/**
 * Portfolio rows to the homeowner quotes the Performance slide can show. A row needs a hero
 * image and a quote no longer than `maxLength`: the slide never clamps words, so a long quote is
 * skipped. Projects in the meeting's trades come first, most matching scopes first, then
 * portfolio order.
 */
export function pickHomeownerQuotes(rows: PortfolioProject[], options: PickHomeownerQuotesOptions): HomeownerQuote[] {
  const tradeOfScope = new Map<string, string>()
  for (const [tradeId, group] of options.scopesByTrade) {
    for (const entry of [...group.scopes, ...group.addons]) {
      tradeOfScope.set(entry.id, tradeId)
    }
  }

  const candidates: { order: number, preferredHits: number, quote: HomeownerQuote }[] = []
  rows.forEach((row, order) => {
    const text = unquote(row.project.homeownerQuote ?? '')
    if (!row.heroImage || text.length === 0 || text.length > options.maxLength) {
      return
    }

    const hits = new Map<string, number>()
    for (const scopeId of row.scopeIds) {
      const tradeId = tradeOfScope.get(scopeId)
      if (tradeId) {
        hits.set(tradeId, (hits.get(tradeId) ?? 0) + 1)
      }
    }

    let topTradeId: string | null = null
    let preferredHits = 0
    for (const [tradeId, count] of hits) {
      if (topTradeId === null || count > (hits.get(topTradeId) ?? 0)) {
        topTradeId = tradeId
      }
      if (options.preferredTradeIds.has(tradeId)) {
        preferredHits += count
      }
    }

    candidates.push({
      order,
      preferredHits,
      quote: {
        id: row.project.id,
        text,
        shortName: shortName(row.project.homeownerName),
        city: row.project.city,
        trade: topTradeId ? options.tradesById.get(topTradeId)?.name ?? null : null,
        image: row.heroImage.url,
      },
    })
  })

  return candidates
    .sort((a, b) => b.preferredHits - a.preferredHits || a.order - b.order)
    .slice(0, options.limit)
    .map(candidate => candidate.quote)
}

/** Some stored quotes carry their own quotation marks; the slide draws its own. */
function unquote(text: string): string {
  return text.trim().replace(/^["“”]+|["“”]+$/g, '').trim()
}

/** First name and last initial. Words without a letter (a marker, an emoji) are not names. */
function shortName(name: string | null): string | null {
  const words = (name ?? '').trim().split(/\s+/).filter(word => /\p{L}/u.test(word))
  const [first, ...rest] = words
  if (!first) {
    return null
  }
  const last = rest.at(-1)
  return last ? `${first} ${Array.from(last)[0].toUpperCase()}.` : first
}
```

- [ ] **Step 6: Run the check and watch it pass.**

Run: `pnpm exec tsx .superpowers/sdd/2026-09-23-who-we-are-proof-column/checks/pick-homeowner-quotes.check.ts`
Expected: `pick-homeowner-quotes: all checks pass`

- [ ] **Step 7: Write the hook.** Create `MF/hooks/use-homeowner-quotes.ts`:

```ts
'use client'

// LAZY: the same read as `useShowcaseProjects` (`projectsRouter.showroomDisplay.getAll`); swap
// both together when the projects read model lands.

import type { HomeownerQuote } from '@/features/meeting-flow/types'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { HOMEOWNER_QUOTE_LIMIT, HOMEOWNER_QUOTE_MAX_LENGTH } from '@/features/meeting-flow/constants/homeowner-quotes'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { pickHomeownerQuotes } from '@/features/meeting-flow/lib/pick-homeowner-quotes'
import { useTRPC } from '@/trpc/helpers'

/**
 * Up to three portfolio homeowners' words, projects in the meeting's trades first. The
 * provider fired this query when the meeting opened, with the same options, so the cache
 * answers. Empty while loading or on error: the slide is whole without a quote.
 */
export function useHomeownerQuotes(): HomeownerQuote[] {
  const trpc = useTRPC()
  const query = useQuery({ ...trpc.projectsRouter.showroomDisplay.getAll.queryOptions(), staleTime: SHOWCASE_PROJECTS_STALE_MS })
  const { catalog } = useTradeCatalogContext()
  const selections = useTradeSelections()
  const preferredTradeIds = useMemo(() => new Set(selections.map(selection => selection.tradeId)), [selections])

  return useMemo(() => pickHomeownerQuotes(query.data ?? [], {
    scopesByTrade: catalog.scopesByTrade,
    tradesById: catalog.tradesById,
    preferredTradeIds,
    limit: HOMEOWNER_QUOTE_LIMIT,
    maxLength: HOMEOWNER_QUOTE_MAX_LENGTH,
  }), [query.data, catalog.scopesByTrade, catalog.tradesById, preferredTradeIds])
}
```

- [ ] **Step 8: Type-check and lint.**

Run: `pnpm exec eslint --fix src/features/meeting-flow/constants/homeowner-quotes.ts src/features/meeting-flow/lib/pick-homeowner-quotes.ts src/features/meeting-flow/hooks/use-homeowner-quotes.ts src/features/meeting-flow/types/index.ts && pnpm tsc`
Expected: no errors. If `query.data` isn't assignable to `PortfolioProject[]`, report NEEDS_CONTEXT with the tsc message (don't cast).

- [ ] **Step 9: Re-run the check** (the lint fix must not change behaviour). Same command as Step 6, same expected output.

- [ ] **Step 10: Commit.**

```bash
git diff --cached --name-status | wc -l
git add -- src/features/meeting-flow/constants/homeowner-quotes.ts src/features/meeting-flow/lib/pick-homeowner-quotes.ts src/features/meeting-flow/hooks/use-homeowner-quotes.ts
git commit -m "feat(who-we-are): homeowner quotes from the portfolio read, the meeting's trades first

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/constants/homeowner-quotes.ts src/features/meeting-flow/lib/pick-homeowner-quotes.ts src/features/meeting-flow/hooks/use-homeowner-quotes.ts src/features/meeting-flow/types/index.ts
git show --stat HEAD
git diff --cached --name-status | wc -l
```

---

### Task 2: Proof of performance: compare, record rail, reputation, quote

**Files:**
- Create: `W/proof-tile.tsx`, `W/proof-rail.tsx`, `W/growth-layout.tsx`, `W/before-after-compare.tsx`, `W/homeowner-quote.tsx`, `W/performance-section.tsx`
- Modify: `MF/types/index.ts` (the `ProofTile`, `FocusPoint` and `ProofRail` types; the `performance` arm; the `point` arm loses `media`)
- Modify: `MF/constants/who-we-are-slides.ts` (the performance slide; a `REPUTATION` constant)
- Modify: `W/index.tsx` (`case 'performance'`), `W/point-section.tsx` (no media branch), `W/comparison-section.tsx` (onto `GrowthLayout`), `W/credentials-section.tsx` (reads `content.reputation`, unchanged shape)
- Delete: `W/before-after-pair.tsx`
- Test: `$WS/tools/verify-proof-column.mjs` (created here, extended in Tasks 3 and 4)

**Interfaces:**
- Consumes: `useHomeownerQuotes()` and `HomeownerQuote` (Task 1); `BeforeAfterMedia`, `ReputationMark` (existing types); `ReputationMark` component (`W/reputation-mark.tsx`, renders an `<li>`); `Slide`, `Reveal`, `SlideProps` from `@/shared/components/presentation/*`.
- Produces:
  - `interface FocusPoint { x: number, y: number }`
  - `interface ProofTile { kicker: string, icon: LucideIcon, value: string, label: string, opens?: { document: number, focus: FocusPoint } }`
  - `interface ProofRail { eyebrow: string, tiles: readonly [ProofTile, ProofTile, ProofTile] }`
  - The component `ProofRail({ rail, onOpen? }: { rail: ProofRail, onOpen?: (opens: { document: number, focus: FocusPoint }) => void })`, whose root carries `data-proof-rail`.
  - `ProofTile({ tile, onOpen? })`.
  - `GrowthLayout({ children, className? })`.
  - Data attributes `data-compare` and `data-quote`.

- [ ] **Step 1: Write the failing verification tool.** Create `$WS/tools/verify-proof-column.mjs`:

```js
// Who We Are proof column (points 1, 4, 6): measured checks per slide and viewport.
// Usage: node verify-proof-column.mjs <performance|licensing|communication|all> [WxH ...] [--reduce] [--shots] [--present] [--empty-quotes]
import path from 'node:path'
import { buildCss, openStep1, setup } from '../../2026-09-22-presentation-config-and-critique/tools/common.mjs'

const REPO = '/home/olis-solutions/olis-v3/nextjs/tri-pros-website'
const args = process.argv.slice(2)
const which = args[0] ?? 'all'
const flags = new Set(args.filter(a => a.startsWith('--')))
const sizeArgs = args.filter(a => /^\d+x\d+$/.test(a))
const SIZES = (sizeArgs.length ? sizeArgs : ['1440x900', '1024x768', '820x1180', '390x844']).map(s => s.split('x').map(Number))
const ONE_SCREEN = new Set(['1440x900', '820x1180'])
const SLIDES = which === 'all' ? ['licensing', 'communication', 'performance'] : [which]
const css = buildCss()
const failures = []

function check(label, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}${ok ? '' : ` ${JSON.stringify(detail)}`}`)
  if (!ok) {
    failures.push(label)
  }
}

async function goTo(page, id) {
  await page.evaluate((slideId) => {
    const scroller = document.querySelector('[role="region"][data-step-root]')
    const el = scroller.querySelector(`section[id="${slideId}"]`)
    scroller.scrollTo({ top: el.offsetTop - Number.parseFloat(getComputedStyle(el).scrollMarginTop || '0'), behavior: 'instant' })
  }, id)
  await page.waitForTimeout(1500)
}

async function measure(page, id) {
  return page.evaluate((slideId) => {
    const scroller = document.querySelector('[role="region"][data-step-root]')
    const section = document.getElementById(slideId)
    const presentButton = [...document.querySelectorAll('button')].find(b => /^(?:Present|Exit present mode)$/.test(b.textContent.trim()))
    const capsule = presentButton?.closest('div.rounded-full') ?? null
    const rail = section.querySelector('[data-proof-rail]')
    const centrepieces = [...section.querySelectorAll('[data-compare], [data-timeline], button[aria-label^="Open "]')]
    const bottomOf = el => Math.max(el.getBoundingClientRect().bottom, ...[...el.querySelectorAll('*')].map(child => child.getBoundingClientRect().bottom))
    const card = section.querySelector('[data-agent-card]')
    const timeline = section.querySelector('[data-timeline]')
    const stages = timeline ? [...timeline.querySelectorAll(':scope > li')].map(li => li.getBoundingClientRect()) : []
    const line = section.querySelector('[data-timeline-line]')
    const centre = el => (el ? el.getBoundingClientRect().left + el.getBoundingClientRect().width / 2 : null)
    return {
      presentationWidth: scroller.clientWidth,
      screenHeight: scroller.clientHeight - (Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0),
      sectionHeight: section.getBoundingClientRect().height,
      railTop: rail?.getBoundingClientRect().top ?? null,
      railBottom: rail?.getBoundingClientRect().bottom ?? null,
      capsuleTop: capsule?.getBoundingClientRect().top ?? null,
      centrepieceBottom: centrepieces.length ? Math.max(...centrepieces.map(bottomOf)) : null,
      clipped: [...section.querySelectorAll('[data-proof-rail] li span, [data-timeline] li span, [data-quote] blockquote, [data-quote] figcaption span')]
        .filter(el => el.scrollWidth > el.clientWidth + 1)
        .map(el => el.textContent.trim()),
      cardCentre: centre(card),
      timelineCentre: centre(timeline),
      horizontal: stages.length > 1 ? stages.every(s => Math.abs(s.top - stages[0].top) <= 2) : null,
      vertical: stages.length > 1 ? stages.every(s => Math.abs(s.left - stages[0].left) <= 2) : null,
      lineTransform: line ? getComputedStyle(line).transform : null,
      text: section.innerText,
    }
  }, id)
}

function layoutChecks(tag, id, m) {
  check(`${tag} rail present`, m.railTop !== null, m)
  check(`${tag} centrepiece ends above the rail`, m.centrepieceBottom === null || m.railTop === null || m.centrepieceBottom <= m.railTop + 1, { centrepieceBottom: m.centrepieceBottom, railTop: m.railTop })
  check(`${tag} no clipped text`, m.clipped.length === 0, m.clipped)
  const oneScreen = m.sectionHeight <= m.screenHeight + 1
  if (oneScreen && m.capsuleTop !== null) {
    check(`${tag} rail clears the capsule`, m.railBottom <= m.capsuleTop - 8, { railBottom: m.railBottom, capsuleTop: m.capsuleTop })
  }
  if (id !== 'licensing' && ONE_SCREEN.has(tag.split(' ')[0])) {
    check(`${tag} one screen`, oneScreen, { sectionHeight: m.sectionHeight, screenHeight: m.screenHeight })
  }
}

async function performanceBehaviour(page, tag) {
  const scrollTop = () => page.evaluate(() => document.querySelector('[role="region"][data-step-root]').scrollTop)
  const compare = page.locator('#performance [data-compare]')
  const box = await compare.boundingBox()
  const cdp = await page.context().newCDPSession(page)
  const before = await scrollTop()
  await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(box.x + box.width / 2), y: Math.round(box.y + box.height / 2), yDistance: -260, gestureSourceType: 'touch', speed: 1200 })
  await page.waitForTimeout(1500)
  check(`${tag} vertical touch swipe on the compare moves the presentation`, (await scrollTop()) !== before, { before })
  await goTo(page, 'performance')

  const handle = page.locator('#performance [data-compare] [role="slider"]')
  const value = async () => Number(await handle.getAttribute('aria-valuenow'))
  const start = await value()
  const b = await compare.boundingBox()
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width * 0.25, b.y + b.height / 2, { steps: 8 })
  await page.mouse.up()
  const dragged = await value()
  check(`${tag} sideways drag moves the divider`, dragged < start - 10, { start, dragged })
  await handle.focus()
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  check(`${tag} arrow keys move the divider`, (await value()) > dragged, { dragged })

  const pager = page.locator('#performance [data-quote] button[aria-pressed]')
  if ((await pager.count()) > 1) {
    const first = await page.locator('#performance [data-quote] blockquote').innerText()
    await pager.nth(1).click()
    check(`${tag} quote pager switches the quote`, (await page.locator('#performance [data-quote] blockquote').innerText()) !== first && (await pager.nth(1).getAttribute('aria-pressed')) === 'true', { first })
  }
  const caption = await page.locator('#performance [data-quote] figcaption').allInnerTexts()
  check(`${tag} quote caption has no null/undefined`, caption.every(t => !/null|undefined/.test(t)), caption)
}

async function emptyQuotes(page) {
  await page.route('**/api/trpc/**', async (route) => {
    const url = new URL(route.request().url())
    const procedures = decodeURIComponent(url.pathname.split('/api/trpc/')[1] ?? '').split(',')
    const index = procedures.indexOf('projectsRouter.showroomDisplay.getAll')
    if (index === -1) {
      return route.continue()
    }
    const response = await route.fetch()
    const body = await response.json()
    const batch = Array.isArray(body) ? body : [body]
    batch[index].result.data.json = []
    delete batch[index].result.data.meta
    return route.fulfill({ response, json: Array.isArray(body) ? batch : batch[0] })
  })
}

for (const [width, height] of SIZES) {
  const { browser, page } = await setup({ width, height, reducedMotion: flags.has('--reduce') ? 'reduce' : 'no-preference' })
  try {
    if (flags.has('--empty-quotes')) {
      await emptyQuotes(page)
    }
    await openStep1(page, { css })
    if (flags.has('--present')) {
      await page.keyboard.press('p')
      await page.waitForTimeout(800)
    }
    for (const id of SLIDES) {
      const tag = `${width}x${height}${flags.has('--present') ? ' present' : ''} ${id}`
      await goTo(page, id)
      const m = await measure(page, id)
      layoutChecks(tag, id, m)
      if (flags.has('--shots')) {
        await page.screenshot({ path: path.join(REPO, '.playwright-mcp', `proof-column-${width}x${height}${flags.has('--present') ? '-present' : ''}-${id}.png`) })
      }
      if (id === 'performance') {
        if (flags.has('--empty-quotes')) {
          check(`${tag} no quote block without quotes`, (await page.locator('#performance [data-quote]').count()) === 0)
        }
        else {
          await performanceBehaviour(page, tag)
        }
      }
      if (id === 'licensing') {
        check(`${tag} reputation is not on licensing`, !/reviews/i.test(m.text), m.text.slice(0, 200))
      }
    }
  }
  finally {
    await browser.close()
  }
}

console.log(failures.length ? `\n${failures.length} FAILED` : '\nALL PASS')
process.exit(failures.length ? 1 : 0)
```

- [ ] **Step 2: Run it and watch it fail.**

Run: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs performance 1440x900`
Expected: FAIL on `rail present` (there's no `[data-proof-rail]` yet), then a Playwright timeout or error on `[data-compare]`. The failure proves the tool reaches the slide.

- [ ] **Step 3: Add the types.** In `MF/types/index.ts`:
  - Add `import type { LucideIcon } from 'lucide-react'`, merged with any existing `lucide-react` import.
  - Add after `HomeownerQuote`:

```ts
/** A spot on a document's scan: fractions of its width and height. */
export interface FocusPoint {
  x: number
  y: number
}

/** One proof in a rail. `opens` names one of the slide's documents and the spot the tile cites. */
export interface ProofTile {
  kicker: string
  icon: LucideIcon
  value: string
  label: string
  opens?: { document: number, focus: FocusPoint }
}

/** The proofs under a slide's centrepiece. Always three: a fourth turns the rail into a stat wall. */
export interface ProofRail {
  eyebrow: string
  tiles: readonly [ProofTile, ProofTile, ProofTile]
}
```

  In `WhoWeAreContent`:
  - Change the `point` arm to `| { kind: 'point', proof: ProofFigure }`.
  - Add the arm `| { kind: 'performance', media: BeforeAfterMedia, rail: ProofRail, reputation: ReputationMark[] }` after `team`.

- [ ] **Step 4: Update the constants.** In `MF/constants/who-we-are-slides.ts`:
  - Add the icon imports: `import { FileTextIcon, HeartIcon, HomeIcon } from 'lucide-react'` (merge ordering with eslint later).
  - Add `ReputationMark` to the type import from `@/features/meeting-flow/types`.
  - After `const TAP_TO_VIEW = 'Tap to view'`, add:

```ts
/** The public review standing. It proves performance, so it sits on the Performance slide. */
const REPUTATION: ReputationMark[] = [
  { kind: 'rating', platform: reviews.google.platform, rating: reviews.google.rating.toFixed(1), count: reviews.google.count },
  { kind: 'rating', platform: reviews.yelp.platform, rating: reviews.yelp.rating.toFixed(1), count: reviews.yelp.count },
  { kind: 'fact', value: reviews.bbb.rating, label: `${reviews.bbb.platform} rating` },
  { kind: 'fact', value: companyInfo.ownership, label: `${companyInfo.generations} generations` },
]
// e.g. 9_000_000 -> '$9M'
const valueDelivered = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 0 }).format(companyInfo.valueOfProjectsInDollars)
const clientSatisfaction = `${Math.round(companyInfo.clientSatisfaction * 100)}%`
```

  In the `licensing` slide, replace the inline `reputation: [ … ]` array with `reputation: REPUTATION,` (Task 3 removes it).

  Replace the whole `performance` slide's `content` with:

```ts
    content: {
      kind: 'performance',
      media: { before: IMAGES.bathroomBefore, after: IMAGES.bathroomAfter, alt: 'Bathroom remodel', width: 1280, height: 714 },
      rail: {
        eyebrow: 'The record',
        tiles: [
          { kicker: 'Projects', icon: HomeIcon, value: performance.stat, label: performance.statLabel },
          { kicker: 'Delivered', icon: FileTextIcon, value: valueDelivered, label: 'In projects delivered' },
          { kicker: 'Satisfaction', icon: HeartIcon, value: clientSatisfaction, label: 'Client satisfaction' },
        ],
      },
      reputation: REPUTATION,
    },
```

- [ ] **Step 5: Write `W/proof-tile.tsx`.**

```tsx
'use client'

import type { ProofTile as ProofTileData } from '@/features/meeting-flow/types'
import { ZoomInIcon } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface ProofTileProps {
  tile: ProofTileData
  /** Opens the document the tile cites; without it the tile is static. */
  onOpen?: () => void
}

/**
 * One proof: what it is, the figure, what the figure means. A tile that cites a document is a
 * button that opens the document at the cited line; its accent rule rises on hover and focus,
 * and nothing moves, so the snap area's box never shifts.
 */
export function ProofTile({ tile, onOpen }: ProofTileProps) {
  const Icon = tile.icon
  const body = (
    <>
      <span className="flex items-center gap-[0.45em] text-presentation-label font-bold text-(--presentation-accent)">
        <Icon aria-hidden className="size-[1em] shrink-0" />
        {tile.kicker}
        {onOpen && <ZoomInIcon aria-hidden className="ml-auto size-[1em] shrink-0 opacity-70" />}
      </span>
      <span className="font-sans text-presentation-figure leading-tight font-bold tracking-tight tabular-nums lining-nums">{tile.value}</span>
      <span className="text-presentation-label text-white/60">{tile.label}</span>
    </>
  )

  if (!onOpen) {
    return <div className="grid min-w-0 content-start gap-1 pt-presentation-tight">{body}</div>
  }

  return (
    <button
      className={cn(
        'relative grid w-full min-w-0 cursor-zoom-in content-start gap-1 pt-presentation-tight text-left outline-none',
        'before:absolute before:inset-x-0 before:-top-px before:h-0.5 before:origin-left before:scale-x-0 before:bg-(--presentation-accent) before:transition-transform',
        'hover:before:scale-x-100 focus-visible:before:scale-x-100 focus-visible:ring-[3px] focus-visible:ring-ring/50',
      )}
      type="button"
      onClick={onOpen}
    >
      {body}
      <span className="sr-only">, open the document</span>
    </button>
  )
}
```

- [ ] **Step 6: Write `W/proof-rail.tsx`.**

```tsx
'use client'

import type { FocusPoint, ProofRail as ProofRailData } from '@/features/meeting-flow/types'
import { ProofTile } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-tile'

interface ProofRailProps {
  rail: ProofRailData
  /** Called with a tile's `opens` when the tile is pressed; tiles without `opens` stay static. */
  onOpen?: (opens: { document: number, focus: FocusPoint }) => void
}

/**
 * The proofs under a slide's centrepiece, built the same way on every point: an eyebrow that
 * names the argument, then three tiles on one hairline, split by hairlines, never boxed as
 * cards. On a phone-width presentation the tiles stack, so no figure clips.
 */
export function ProofRail({ rail, onOpen }: ProofRailProps) {
  return (
    <div className="grid gap-presentation-tight" data-proof-rail>
      <p className="font-mono text-presentation-label font-bold tracking-[0.16em] text-white/55 uppercase">{rail.eyebrow}</p>
      <ul className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/15 @max-[30rem]/presentation:grid-cols-1 @max-[30rem]/presentation:divide-x-0 @max-[30rem]/presentation:divide-y">
        {rail.tiles.map((tile) => {
          const { opens } = tile
          return (
            <li key={tile.kicker} className="min-w-0 px-[1.4cqw] first:pl-0 last:pr-0 @max-[30rem]/presentation:px-0 @max-[30rem]/presentation:pb-presentation-tight">
              <ProofTile tile={tile} onOpen={opens && onOpen ? () => onOpen(opens) : undefined} />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
```

- [ ] **Step 7: Write `W/growth-layout.tsx`.**

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface GrowthLayoutProps {
  children: ReactNode
  /** Rows and gaps for the slide's own composition. */
  className?: string
}

/**
 * The content of a growth slide: in flow, at least one screen tall, centred when shorter. On a
 * short screen the slide grows taller instead of clipping its content. Copy ends clear of the
 * floating capsule.
 */
export function GrowthLayout({ children, className }: GrowthLayoutProps) {
  return (
    <div className={cn('grid min-h-[calc(100cqh-var(--band-h,0px))] content-center px-[6cqw] pt-presentation-zone pb-[max(6cqh,var(--presentation-clear-b,0px))]', className)}>
      {children}
    </div>
  )
}
```

- [ ] **Step 8: Move `W/comparison-section.tsx` onto it.** Replace the file's JSX and doc comment:

```tsx
'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { ComparisonTable } from '@/features/meeting-flow/ui/components/steps/who-we-are/comparison-table'
import { GrowthLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/growth-layout'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type ComparisonSectionProps = SlideProps<WhoWeAreContentOf<'comparison'>>

/** Tri Pros against other contractors: the six points, and the extras. A growth slide, so a long table makes the slide taller instead of being clipped. */
export function ComparisonSection({ content, ...slide }: ComparisonSectionProps) {
  return (
    <Slide {...slide}>
      <GrowthLayout>
        <Reveal order={0}>
          <ComparisonTable rows={content.rows} />
        </Reveal>
      </GrowthLayout>
    </Slide>
  )
}
```

- [ ] **Step 9: Write `W/before-after-compare.tsx`.**

```tsx
'use client'

import type { BeforeAfterMedia } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { ReactCompareSlider, ReactCompareSliderHandle } from 'react-compare-slider'

interface BeforeAfterCompareProps {
  media: BeforeAfterMedia
}

/**
 * The same room before and after under one divider the homeowner can drag. The slider's root
 * keeps `touch-action: pan-y`, so a vertical swipe on the photo still moves the presentation
 * and only a sideways drag moves the divider. The knob is solid: a backdrop blur over the photo
 * collapses once an ancestor animates. Its width is capped by the screen's height, so on a tall
 * screen the pair never crowds out the record.
 */
export function BeforeAfterCompare({ media }: BeforeAfterCompareProps) {
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-md"
      data-compare
      style={{ aspectRatio: `${media.width} / ${media.height}`, width: `min(100%, calc(42cqh * ${media.width} / ${media.height}))` }}
    >
      <ReactCompareSlider
        className="size-full"
        handle={(
          <ReactCompareSliderHandle
            buttonStyle={{ backdropFilter: 'none', WebkitBackdropFilter: 'none', backgroundColor: 'white', color: 'var(--presentation-ground)', border: 0 }}
          />
        )}
        itemOne={(
          <div className="relative size-full">
            <Image alt={`${media.alt}, before`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 50vw, 90vw" src={media.before} />
          </div>
        )}
        itemTwo={(
          <div className="relative size-full">
            <Image alt={`${media.alt}, after`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 50vw, 90vw" src={media.after} />
          </div>
        )}
      />
      <span aria-hidden className="pointer-events-none absolute top-presentation-tight left-presentation-tight z-10 rounded-sm bg-black/60 px-2 py-0.5 font-sans text-presentation-label font-semibold">
        Before
      </span>
      <span aria-hidden className="pointer-events-none absolute top-presentation-tight right-presentation-tight z-10 rounded-sm bg-white/90 px-2 py-0.5 font-sans text-presentation-label font-semibold text-(--presentation-ground)">
        After
      </span>
    </div>
  )
}
```

- [ ] **Step 10: Write `W/homeowner-quote.tsx`.**

```tsx
'use client'

import type { HomeownerQuote as HomeownerQuoteData } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { useState } from 'react'
import { cn } from '@/shared/lib/utils'

interface HomeownerQuoteProps {
  /** Non-empty; the section renders nothing without a quote. */
  quotes: HomeownerQuoteData[]
}

/**
 * A portfolio homeowner's words beside their own project's photo. The agent switches between
 * homeowners with the dots; nothing advances by itself, because movement the agent didn't start
 * pulls the room's attention.
 */
export function HomeownerQuote({ quotes }: HomeownerQuoteProps) {
  const [position, setPosition] = useState(0)
  const current = position < quotes.length ? position : 0
  const quote = quotes[current]
  const caption = [quote.shortName, quote.city, quote.trade].filter(Boolean).join(' · ')

  return (
    <figure className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-presentation-tight @max-[30rem]/presentation:grid-cols-1" data-quote>
      <span className="relative block size-[clamp(3.5rem,6cqw,5.25rem)] overflow-hidden rounded-sm">
        <Image alt="" className="object-cover" draggable={false} fill sizes="6rem" src={quote.image} />
      </span>
      <div className="grid min-w-0 gap-1">
        <blockquote className="text-presentation-body text-white/90 before:mr-0.5 before:font-sans before:font-bold before:text-(--presentation-accent) before:content-['“']">
          {quote.text}
        </blockquote>
        <figcaption className="flex flex-wrap items-center justify-between gap-x-presentation-tight text-presentation-label text-white/60">
          <span>{caption}</span>
          {quotes.length > 1 && (
            <span aria-label="Homeowner quotes" className="flex" role="group">
              {quotes.map((item, index) => (
                <button
                  key={item.id}
                  aria-label={`Quote ${index + 1} of ${quotes.length}`}
                  aria-pressed={index === current}
                  className="grid size-11 place-items-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  type="button"
                  onClick={() => setPosition(index)}
                >
                  <span aria-hidden className={cn('size-1.5 rounded-full', index === current ? 'bg-(--presentation-accent)' : 'bg-white/30')} />
                </button>
              ))}
            </span>
          )}
        </figcaption>
      </div>
    </figure>
  )
}
```

- [ ] **Step 11: Write `W/performance-section.tsx`.**

```tsx
'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { useHomeownerQuotes } from '@/features/meeting-flow/hooks/use-homeowner-quotes'
import { BeforeAfterCompare } from '@/features/meeting-flow/ui/components/steps/who-we-are/before-after-compare'
import { GrowthLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/growth-layout'
import { HomeownerQuote } from '@/features/meeting-flow/ui/components/steps/who-we-are/homeowner-quote'
import { ProofRail } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-rail'
import { ReputationMark } from '@/features/meeting-flow/ui/components/steps/who-we-are/reputation-mark'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type PerformanceSectionProps = SlideProps<WhoWeAreContentOf<'performance'>>

/**
 * Point 6: a room the homeowner can drag from before to after, the record and the public
 * standing under it, then a portfolio homeowner in their own words. The compare fills what the
 * record and quote leave; on a short screen the slide grows rather than clip the quote.
 */
export function PerformanceSection({ content, ...slide }: PerformanceSectionProps) {
  const quotes = useHomeownerQuotes()

  return (
    <Slide {...slide}>
      <GrowthLayout className="grid-rows-[1fr_auto_auto] gap-presentation-group">
        <div className="grid content-center">
          <BeforeAfterCompare media={content.media} />
        </div>
        <Reveal className="grid gap-presentation-tight" order={0}>
          <ProofRail rail={content.rail} />
          <ul className="flex flex-wrap gap-x-[2.2cqw] gap-y-1 pt-presentation-tight text-presentation-body">
            {content.reputation.map(mark => (
              <ReputationMark key={mark.kind === 'fact' ? mark.value : mark.platform} mark={mark} />
            ))}
          </ul>
        </Reveal>
        {quotes.length > 0 && (
          <Reveal order={1}>
            <HomeownerQuote quotes={quotes} />
          </Reveal>
        )}
      </GrowthLayout>
    </Slide>
  )
}
```

- [ ] **Step 12: Wire the kind and retire the media branch.**
  - In `W/index.tsx`, import `PerformanceSection` and add the case before `agent`:

```tsx
      case 'performance':
        return <PerformanceSection key={slide.id} {...props} content={content} />
```

  - Replace `W/point-section.tsx` with:

```tsx
'use client'

import type { WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofFigure } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-figure'
import { Slide } from '@/shared/components/presentation/slide'

type PointSectionProps = SlideProps<WhoWeAreContentOf<'point'>>

/** A due-diligence point whose photo is the slide's background: only its figure sits in the content. */
export function PointSection({ content, ...slide }: PointSectionProps) {
  return (
    <Slide {...slide}>
      <PointLayout media={null}>
        <ProofFigure order={0} proof={content.proof} />
      </PointLayout>
    </Slide>
  )
}
```

  - Delete the stand-alone pair: `rm src/features/meeting-flow/ui/components/steps/who-we-are/before-after-pair.tsx`. Then run `grep -rn "before-after-pair\|BeforeAfterPair" src`, which should print nothing.

- [ ] **Step 13: Type-check and lint.**

Run: `pnpm exec eslint --fix src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/who-we-are-slides.ts src/features/meeting-flow/ui/components/steps/who-we-are/{proof-tile,proof-rail,growth-layout,before-after-compare,homeowner-quote,performance-section,index,point-section,comparison-section}.tsx && pnpm tsc`
Expected: no errors.

- [ ] **Step 14: Run the tool and watch it pass.**

Run: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs performance 1440x900 1024x768 820x1180 390x844`
Expected: `ALL PASS` (the swipe, drag, keys, pager, caption, rail, centrepiece and one-screen checks, where they apply).
Then: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs performance 1440x900 --empty-quotes`
Expected: `PASS … no quote block without quotes`, `ALL PASS`.
Also run: `node .superpowers/sdd/2026-09-22-presentation-config-and-critique/tools/verify-comparison.mjs`, which should give its previous result (the comparison slides are now on `GrowthLayout` with the identical class string). If a check fails, fix only within this task's files and re-run. If the fix would leave the task's files, report BLOCKED.

- [ ] **Step 15: Commit.**

```bash
git diff --cached --name-status | wc -l
git add -- src/features/meeting-flow/ui/components/steps/who-we-are/{proof-tile,proof-rail,growth-layout,before-after-compare,homeowner-quote,performance-section}.tsx
git commit -m "feat(who-we-are): proof of performance as a drag-to-compare, the record and a homeowner's words

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/who-we-are-slides.ts src/features/meeting-flow/ui/components/steps/who-we-are/{proof-tile,proof-rail,growth-layout,before-after-compare,homeowner-quote,performance-section,index,point-section,comparison-section,before-after-pair}.tsx
git show --stat HEAD
git diff --cached --name-status | wc -l
```

---

### Task 3: Licensing: the documents and "What protects you"

**Files:**
- Modify: `MF/types/index.ts` (the `credentials` arm)
- Modify: `MF/constants/who-we-are-slides.ts` (the licensing slide)
- Modify: `W/credentials-section.tsx`, `W/credential-documents.tsx`, `W/document-dialog.tsx`
- Test: `$WS/tools/verify-proof-column.mjs` (licensing behaviour added)

**Interfaces:**
- Consumes: `ProofRail` and `ProofTile` components, and the `ProofRail`/`FocusPoint` types (Task 2); `PresentationDocument` (existing).
- Produces:
  - `CredentialDocuments({ documents, openLabel, onOpen }: { documents: PresentationDocument[], openLabel: string, onOpen: (document: PresentationDocument) => void })`
  - `DocumentDialog({ document, focus?, onClose }: { document: PresentationDocument | null, focus?: FocusPoint | null, onClose: () => void })`

- [ ] **Step 1: Extend the tool with the failing licensing behaviour.**
  - In `$WS/tools/verify-proof-column.mjs`, add this function after `performanceBehaviour`:

```js
async function licensingBehaviour(page, tag) {
  const tile = page.locator('#licensing [data-proof-rail] button').first()
  const zoomOf = () => page.locator('[role="dialog"] img').first().evaluate(img => getComputedStyle(img).transform)
  await tile.click()
  await page.locator('[role="dialog"]').waitFor()
  await page.waitForTimeout(700)
  check(`${tag} the license tile opens the document zoomed`, (await zoomOf()) !== 'none')
  await page.getByRole('button', { name: 'Zoom out' }).click()
  await page.waitForTimeout(700)
  check(`${tag} zoom out shows the whole document`, (await zoomOf()) === 'none')
  await page.keyboard.press('Escape')
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' })
  await tile.click()
  await page.locator('[role="dialog"]').waitFor()
  await page.waitForTimeout(700)
  check(`${tag} reopening the tile opens zoomed again`, (await zoomOf()) !== 'none')
  await page.keyboard.press('Escape')
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' })
  await page.locator('#licensing button[aria-label^="Open "]').first().click()
  await page.locator('[role="dialog"]').waitFor()
  await page.waitForTimeout(700)
  check(`${tag} the document itself opens whole`, (await zoomOf()) === 'none')
  await page.keyboard.press('Escape')
  await page.locator('[role="dialog"]').waitFor({ state: 'detached' })
}
```

  - In the main loop, change the `if (id === 'licensing') { … }` block to:

```js
      if (id === 'licensing') {
        check(`${tag} reputation is not on licensing`, !/reviews/i.test(m.text), m.text.slice(0, 200))
        await licensingBehaviour(page, tag)
      }
```

- [ ] **Step 2: Run it and watch it fail.**

Run: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs licensing 1440x900`
Expected: FAIL on `rail present` and `reputation is not on licensing`, then a timeout on the tile click.

- [ ] **Step 3: Change the type.** In `MF/types/index.ts`, change the `credentials` arm to:

```ts
    | { kind: 'credentials', documents: PresentationDocument[], rail: ProofRail, openLabel: string }
```

- [ ] **Step 4: Change the licensing slide.** In `MF/constants/who-we-are-slides.ts`, add `BadgeCheckIcon` and `ShieldCheckIcon` to the `lucide-react` import. In the `licensing` slide's `content`, replace `protection: […]` and `reputation: REPUTATION,` with:

```ts
      rail: {
        eyebrow: 'What protects you',
        tiles: [
          // Focus points are fractions of the current scans: re-measure them when a document is replaced.
          { kicker: 'License', icon: ShieldCheckIcon, value: `#${license.licenseNumber}`, label: 'CA contractor license', opens: { document: 0, focus: { x: 0.29, y: 0.35 } } },
          { kicker: 'Insurance', icon: FileTextIcon, value: liabilityCoverage, label: 'Insurance per project', opens: { document: 1, focus: { x: 0.62, y: 0.45 } } },
          { kicker: 'Bond', icon: BadgeCheckIcon, value: 'Bonded', label: 'Most contractors aren’t' },
        ],
      },
```

- [ ] **Step 5: `CredentialDocuments` reports the press instead of owning the dialog.** Replace `W/credential-documents.tsx` with:

```tsx
'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import { DocumentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-card'
import { TapCue } from '@/features/meeting-flow/ui/components/steps/who-we-are/tap-cue'
import { Reveal } from '@/shared/components/presentation/reveal'

interface CredentialDocumentsProps {
  /** The contractor license, then the certificate of insurance. */
  documents: PresentationDocument[]
  /** The visible cue under the license, e.g. "Tap to view". */
  openLabel: string
  onOpen: (document: PresentationDocument) => void
}

/**
 * The license and the certificate of insurance laid like paper on the desk, filling the media
 * row. Both size from the row's height at their true proportions, and the license lies over the
 * certificate when the row is narrow. The one tap cue hangs under the license like a caption,
 * inside its tap target: every edge of a license carries print. Square to the slide, because
 * tilted type blurs on low-DPI screens.
 */
export function CredentialDocuments({ documents, openLabel, onOpen }: CredentialDocumentsProps) {
  return documents.map((document, position) => (
    <Reveal
      key={document.title}
      className={position === 0
        ? 'absolute top-[12%] left-0 z-10 h-[62%] max-w-[72%]'
        : 'absolute top-0 right-0 h-full max-w-[56%]'}
      order={position}
    >
      <DocumentCard
        cue={position === 0 ? <TapCue label={openLabel} /> : undefined}
        document={document}
        onOpen={() => onOpen(document)}
      />
    </Reveal>
  ))
}
```

- [ ] **Step 6: `DocumentDialog` opens at a focus point.** In `W/document-dialog.tsx`:
  - Keep the `// LAZY:` header block unchanged.
  - Change the imports to add `FocusPoint`, `ZoomInIcon`, `ZoomOutIcon`, `useState` and `cn`:

```tsx
import type { FocusPoint, PresentationDocument } from '@/features/meeting-flow/types'
import { ZoomInIcon, ZoomOutIcon } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'
import { cn } from '@/shared/lib/utils'
```

  - Replace the props interface, doc comment and function with:

```tsx
interface DocumentDialogProps {
  /** The document to show; `null` keeps the dialog closed. */
  document: PresentationDocument | null
  /** Opens a one-page document zoomed in at this spot, e.g. a license number. */
  focus?: FocusPoint | null
  onClose: () => void
}

/**
 * Every page of a document on the dark ground. A one-page document is sized to fit the dialog
 * whole; a multi-page one scrolls at reading width. Opened at a focus point, the page starts
 * zoomed in on it, and a tap on the page or the Zoom control toggles it. Each opening starts
 * zoomed, whatever the last one ended on. The close control is a 44px round target; the dialog
 * portals out of the presentation, so its palette comes from `:root`.
 */
export function DocumentDialog({ document, focus = null, onClose }: DocumentDialogProps) {
  const [zoomedOut, setZoomedOut] = useState(false)
  const [openedAt, setOpenedAt] = useState<FocusPoint | null>(focus)
  if (focus !== openedAt) {
    setOpenedAt(focus)
    setZoomedOut(false)
  }
  const zoomable = focus !== null && document?.pages.length === 1
  const zoomed = zoomable && !zoomedOut

  return (
    <Dialog open={document !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="h-[92dvh] w-[min(96vw,1100px)] max-w-none grid-rows-[minmax(0,1fr)] border-0 bg-[oklch(var(--presentation-scrim))] p-2 text-white sm:max-w-none *:data-[slot=dialog-close]:inline-flex *:data-[slot=dialog-close]:size-11 *:data-[slot=dialog-close]:items-center *:data-[slot=dialog-close]:justify-center *:data-[slot=dialog-close]:rounded-full *:data-[slot=dialog-close]:bg-black/60 *:data-[slot=dialog-close]:opacity-100"
      >
        {document && (
          <>
            <DialogTitle className="sr-only">{document.title}</DialogTitle>
            {zoomable && (
              <button
                className="absolute top-4 left-4 z-10 inline-flex h-11 items-center gap-2 rounded-full bg-black/60 px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                type="button"
                onClick={() => setZoomedOut(value => !value)}
              >
                {zoomed ? <ZoomOutIcon aria-hidden className="size-4" /> : <ZoomInIcon aria-hidden className="size-4" />}
                {zoomed ? 'Zoom out' : 'Zoom in'}
              </button>
            )}
            <div className={cn('grid min-h-0 content-start justify-items-center gap-3 overscroll-contain', zoomable ? 'overflow-hidden' : 'overflow-y-auto')}>
              {document.pages.map((page, position) => {
                const image = (
                  <Image
                    alt={`${document.alt}, page ${position + 1} of ${document.pages.length}`}
                    className={cn('h-auto bg-white', zoomable && 'transition-transform duration-500 ease-out motion-reduce:transition-none', zoomed && 'scale-[2.4]')}
                    draggable={false}
                    height={document.height}
                    sizes="96vw"
                    src={page}
                    style={{
                      width: document.pages.length === 1
                        ? `min(100%, calc((92dvh - 1rem) * ${document.width} / ${document.height}))`
                        : 'min(100%, 56rem)',
                      transformOrigin: zoomable && focus ? `${focus.x * 100}% ${focus.y * 100}%` : undefined,
                    }}
                    width={document.width}
                  />
                )
                return zoomable
                  ? (
                      <button
                        // Placeholder documents reuse one image for every page, so the position is the identity.
                        // eslint-disable-next-line react/no-array-index-key
                        key={position}
                        aria-pressed={zoomed}
                        className={cn('outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50', zoomed ? 'cursor-zoom-out' : 'cursor-zoom-in')}
                        type="button"
                        onClick={() => setZoomedOut(value => !value)}
                      >
                        {image}
                        <span className="sr-only">Toggle zoom</span>
                      </button>
                    )
                  : (
                      // eslint-disable-next-line react/no-array-index-key
                      <div key={position}>{image}</div>
                    )
              })}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

  The page button's accessible name is "Toggle zoom" (with its `aria-pressed` state), deliberately different from the visible control's "Zoom out"/"Zoom in". The tool's `getByRole('button', { name: 'Zoom out' })` must match exactly one element.

- [ ] **Step 7: `CredentialsSection` owns the one open document.** Replace `W/credentials-section.tsx` with:

```tsx
'use client'

import type { FocusPoint, PresentationDocument, WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { useState } from 'react'
import { CredentialDocuments } from '@/features/meeting-flow/ui/components/steps/who-we-are/credential-documents'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'
import { PointLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-layout'
import { ProofRail } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-rail'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

type CredentialsSectionProps = SlideProps<WhoWeAreContentOf<'credentials'>>

/**
 * Point 1: the license and the certificate of insurance on the desk, then what protects the
 * homeowner. A document opens whole; a License or Insurance tile opens its document at the line
 * the tile cites. One dialog serves both, so only one document is ever open.
 */
export function CredentialsSection({ content, ...slide }: CredentialsSectionProps) {
  const [open, setOpen] = useState<{ document: PresentationDocument, focus: FocusPoint | null } | null>(null)

  return (
    <Slide {...slide}>
      <PointLayout
        media={(
          <CredentialDocuments
            documents={content.documents}
            openLabel={content.openLabel}
            onOpen={document => setOpen({ document, focus: null })}
          />
        )}
      >
        <Reveal order={2}>
          <ProofRail rail={content.rail} onOpen={({ document, focus }) => setOpen({ document: content.documents[document], focus })} />
        </Reveal>
      </PointLayout>
      <DocumentDialog document={open?.document ?? null} focus={open?.focus ?? null} onClose={() => setOpen(null)} />
    </Slide>
  )
}
```

- [ ] **Step 8: Type-check and lint.**

Run: `pnpm exec eslint --fix src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/who-we-are-slides.ts src/features/meeting-flow/ui/components/steps/who-we-are/{credentials-section,credential-documents,document-dialog}.tsx && pnpm tsc`
Expected: no errors. Also check `grep -n "ReputationMark\b" src/features/meeting-flow/constants/who-we-are-slides.ts`: `REPUTATION` is now used once (performance), and the licensing slide has no `protection` or `reputation` keys.

- [ ] **Step 9: Run the tool and watch it pass.**

Run: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs licensing 1440x900 1024x768 820x1180 390x844`
Expected: `ALL PASS`. The licensing slide stays a fixed canvas, so there's no one-screen check. Rail clears the capsule; documents above the rail; zoom opens, zooms out, and reopens zoomed; the documents open whole.

- [ ] **Step 10: Commit.**

```bash
git diff --cached --name-status | wc -l
git commit -m "feat(who-we-are): licensing proves protection: license, insurance and bond tiles open the line they cite

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/who-we-are-slides.ts src/features/meeting-flow/ui/components/steps/who-we-are/{credentials-section,credential-documents,document-dialog}.tsx
git show --stat HEAD
git diff --cached --name-status | wc -l
```

---

### Task 4: Communication: the card on the timeline, "What you can count on"

**Files:**
- Create: `W/contact-timeline.tsx`
- Modify: `MF/types/index.ts` (the `TimelineStage` type; the `agent` arm)
- Modify: `MF/constants/who-we-are-slides.ts` (the communication slide)
- Modify: `W/agent-section.tsx`
- Test: `$WS/tools/verify-proof-column.mjs` (communication checks added)

**Interfaces:**
- Consumes: `ProofRail` and `GrowthLayout` (Task 2); `AgentCard` (existing, `{ agent, role }`); `useSlideInView()` from `@/shared/components/presentation/context`; `BRAND_EASE` from `@/shared/constants/motion`.
- Produces: `interface TimelineStage { when: string, caption: (firstName: string) => string }`; `ContactTimeline({ stages, firstName, label })`, whose `ol` carries `data-timeline` and whose line carries `data-timeline-line`; the `agent` arm `{ kind: 'agent', cardRole: string, timelineLabel: string, timeline: TimelineStage[], rail: ProofRail }`; the card wrapper `data-agent-card`.

- [ ] **Step 1: Extend the tool with the failing communication checks.** In `$WS/tools/verify-proof-column.mjs`, inside the per-slide loop after the licensing block, add:

```js
      if (id === 'communication') {
        check(`${tag} card centred on the timeline`, m.cardCentre !== null && m.timelineCentre !== null && Math.abs(m.cardCentre - m.timelineCentre) <= 1, { card: m.cardCentre, timeline: m.timelineCentre })
        const wide = m.presentationWidth >= 640
        check(`${tag} timeline ${wide ? 'horizontal' : 'vertical'} at ${m.presentationWidth}px`, wide ? m.horizontal === true : m.vertical === true, { horizontal: m.horizontal, vertical: m.vertical })
        if (flags.has('--reduce')) {
          const match = /matrix\(([^,]+),[^,]+,[^,]+,([^,]+),/.exec(m.lineTransform ?? '')
          check(`${tag} reduced motion: the line is drawn at rest`, m.lineTransform === 'none' || (match && Number(match[1]) === 1 && Number(match[2]) === 1), m.lineTransform)
        }
      }
```

- [ ] **Step 2: Run it and watch it fail.**

Run: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs communication 1440x900`
Expected: FAIL on `rail present`, `card centred on the timeline` and `timeline horizontal`.

- [ ] **Step 3: Add the type and change the arm.** In `MF/types/index.ts`, after `ProofRail`, add:

```ts
/** One stage of the homeowner's line to their contact. The caption names the meeting owner by first name. */
export interface TimelineStage {
  when: string
  caption: (firstName: string) => string
}
```

  Change the `agent` arm to:

```ts
    | { kind: 'agent', cardRole: string, timelineLabel: string, timeline: TimelineStage[], rail: ProofRail }
```

- [ ] **Step 4: Change the communication slide.** In `MF/constants/who-we-are-slides.ts`, add `CameraIcon`, `ClockIcon` and `UserIcon` to the `lucide-react` import, then replace the `communication` slide's `content` with:

```ts
    content: {
      kind: 'agent',
      cardRole: 'Your point of contact',
      timelineLabel: 'From today to the final walkthrough',
      timeline: [
        { when: 'Today', caption: firstName => `You meet ${firstName}` },
        { when: 'Before work starts', caption: () => 'Walk the job together' },
        { when: 'During the job', caption: firstName => `${firstName} keeps you posted` },
        { when: 'Final walkthrough', caption: firstName => `Still ${firstName}` },
      ],
      rail: {
        eyebrow: 'What you can count on',
        tiles: [
          { kicker: 'Contact', icon: UserIcon, value: communication.stat, label: 'Dedicated contact, start to finish' },
          { kicker: 'Replies', icon: ClockIcon, value: 'Same day', label: 'Calls and texts answered' },
          { kicker: 'Updates', icon: CameraIcon, value: 'Weekly', label: 'Progress update with photos' },
        ],
      },
    },
```

- [ ] **Step 5: Write `W/contact-timeline.tsx`.**

```tsx
'use client'

import type { CSSProperties } from 'react'
import type { TimelineStage } from '@/features/meeting-flow/types'
import { motion } from 'motion/react'
import { useSlideInView } from '@/shared/components/presentation/context'
import { BRAND_EASE } from '@/shared/constants/motion'
import { cn } from '@/shared/lib/utils'

interface ContactTimelineProps {
  stages: TimelineStage[]
  /** The meeting owner's first name, for the captions. */
  firstName: string
  /** The list's accessible name, e.g. "From today to the final walkthrough". */
  label: string
}

/**
 * The homeowner's line to one person, laid out in time: across the slide, or down it on a
 * narrow presentation. The first stage is today, so its dot is filled. The line draws when the
 * slide comes into view; under reduced motion the flow's MotionConfig skips the transform and
 * the line is simply there. A uniform scale grows the line from its start in either
 * orientation; its 2px thickness hides the rest.
 */
export function ContactTimeline({ stages, firstName, label }: ContactTimelineProps) {
  const inView = useSlideInView()

  return (
    <ol
      aria-label={label}
      className="relative grid auto-cols-fr grid-flow-col @max-[40rem]/presentation:mx-auto @max-[40rem]/presentation:w-fit @max-[40rem]/presentation:grid-flow-row @max-[40rem]/presentation:gap-presentation-tight"
      data-timeline
      style={{ '--stages': stages.length } as CSSProperties}
    >
      <motion.span
        animate={{ scale: inView ? 1 : 0 }}
        aria-hidden
        className="absolute inset-x-[calc(50%/var(--stages))] top-[7px] h-0.5 origin-left bg-linear-to-r from-(--presentation-accent) to-(--presentation-accent)/30 @max-[40rem]/presentation:inset-x-auto @max-[40rem]/presentation:top-2 @max-[40rem]/presentation:bottom-2 @max-[40rem]/presentation:left-[7px] @max-[40rem]/presentation:h-auto @max-[40rem]/presentation:w-0.5 @max-[40rem]/presentation:origin-top @max-[40rem]/presentation:bg-linear-to-b"
        data-timeline-line
        initial={false}
        transition={{ duration: 1.1, delay: 0.25, ease: BRAND_EASE }}
      />
      {stages.map((stage, position) => (
        <li
          key={stage.when}
          className="grid justify-items-center gap-presentation-tight px-[0.6cqw] text-center @max-[40rem]/presentation:grid-cols-[1rem_minmax(0,1fr)] @max-[40rem]/presentation:justify-items-start @max-[40rem]/presentation:gap-x-presentation-tight @max-[40rem]/presentation:gap-y-0.5 @max-[40rem]/presentation:px-0 @max-[40rem]/presentation:text-left"
        >
          <span
            aria-hidden
            className={cn(
              'relative z-10 size-4 rounded-full border-2 border-(--presentation-accent) @max-[40rem]/presentation:row-span-2 @max-[40rem]/presentation:mt-0.5',
              position === 0 ? 'bg-(--presentation-accent) ring-4 ring-(--presentation-accent)/20' : 'bg-(--presentation-ground)',
            )}
          />
          <span className="font-mono text-presentation-label font-bold tracking-[0.1em] text-white/60 uppercase">{stage.when}</span>
          <span className="text-presentation-body leading-snug text-balance text-white/90">{stage.caption(firstName)}</span>
        </li>
      ))}
    </ol>
  )
}
```

- [ ] **Step 6: Rewrite `W/agent-section.tsx`.**

```tsx
'use client'

import type { PresentationAgent, WhoWeAreContentOf } from '@/features/meeting-flow/types'
import type { SlideProps } from '@/shared/components/presentation/types'
import { AgentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/agent-card'
import { ContactTimeline } from '@/features/meeting-flow/ui/components/steps/who-we-are/contact-timeline'
import { GrowthLayout } from '@/features/meeting-flow/ui/components/steps/who-we-are/growth-layout'
import { ProofRail } from '@/features/meeting-flow/ui/components/steps/who-we-are/proof-rail'
import { Reveal } from '@/shared/components/presentation/reveal'
import { Slide } from '@/shared/components/presentation/slide'

interface AgentSectionProps extends SlideProps<WhoWeAreContentOf<'agent'>> {
  /** The meeting owner: the homeowner's point of contact. */
  agent: PresentationAgent
}

/**
 * Point 4: the agent in the room is the homeowner's line, from today to the final walkthrough.
 * Their card sits centred on the timeline, and what the homeowner can count on is under both.
 * A growth slide: on a short screen it grows rather than crowd the rail.
 */
export function AgentSection({ content, agent, ...slide }: AgentSectionProps) {
  const firstName = agent.name.split(' ')[0]

  return (
    <Slide {...slide}>
      <GrowthLayout className="grid-rows-[1fr_auto] gap-presentation-zone">
        <div className="grid content-center justify-items-center gap-presentation-zone">
          <Reveal data-agent-card order={0}>
            <AgentCard agent={agent} role={content.cardRole} />
          </Reveal>
          <Reveal className="w-full" order={1}>
            <ContactTimeline firstName={firstName} label={content.timelineLabel} stages={content.timeline} />
          </Reveal>
        </div>
        <Reveal order={2}>
          <ProofRail rail={content.rail} />
        </Reveal>
      </GrowthLayout>
    </Slide>
  )
}
```

  `Reveal` spreads its props onto `motion.div`, so `data-agent-card` lands on the card's wrapper, which shrinks to the card inside a `justify-items-center` grid. If tsc rejects `data-agent-card` on `Reveal`'s props, report NEEDS_CONTEXT; don't edit the engine.

- [ ] **Step 7: Type-check and lint.**

Run: `pnpm exec eslint --fix src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/who-we-are-slides.ts src/features/meeting-flow/ui/components/steps/who-we-are/{contact-timeline,agent-section}.tsx && pnpm tsc`
Expected: no errors. `grep -rn "commitments" src/features/meeting-flow` should print nothing (the field retired; `check-list.tsx` stays for the team slide).

- [ ] **Step 8: Run the tool and watch it pass.**

Run: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs communication 1440x900 1024x768 820x1180 390x844`
Expected: `ALL PASS`. The timeline is horizontal at 1136 and 720 widths and vertical at 564 and 390, the card is centred within 1px, and the slide is one screen at 1440×900 and 820×1180.
Then: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs communication 1440x900 820x1180 --reduce`
Expected: `PASS … reduced motion: the line is drawn at rest`.

- [ ] **Step 9: Commit.**

```bash
git diff --cached --name-status | wc -l
git add -- src/features/meeting-flow/ui/components/steps/who-we-are/contact-timeline.tsx
git commit -m "feat(who-we-are): communication as one contact from today to the final walkthrough

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/who-we-are-slides.ts src/features/meeting-flow/ui/components/steps/who-we-are/{contact-timeline,agent-section}.tsx
git show --stat HEAD
git diff --cached --name-status | wc -l
```

---

### Task 5: The whole sweep (verification only)

No product changes. Every failure goes back to the owner with evidence. Nothing is fixed inside this task.

**Files:**
- Test: `$WS/tools/verify-proof-column.mjs` (as built in Tasks 2–4)

- [ ] **Step 1: The full matrix with screenshots.**

Run: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs all 1440x900 1024x768 820x1180 390x844 --shots`
Expected: `ALL PASS`; 12 screenshots in `.playwright-mcp/proof-column-*.png`.

- [ ] **Step 2: Present mode (sidebar collapsed).**

Run: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs all 1440x900 1024x768 --present --shots`
Expected: `ALL PASS`.

- [ ] **Step 3: Reduced motion and empty quotes.**

Run: `node .superpowers/sdd/2026-09-23-who-we-are-proof-column/tools/verify-proof-column.mjs all 1440x900 820x1180 --reduce` and then `… performance 1440x900 820x1180 --empty-quotes`.
Expected: `ALL PASS` for both.

- [ ] **Step 4: The rest of the deck is unchanged.**

Run: `node .superpowers/sdd/2026-09-22-presentation-config-and-critique/tools/gate-shots.mjs proof-column-sweep 1440x900 820x1180`
Expected: every slide id prints, with `at=` equal to its own id (snap unchanged). Read the scope, supervision and team screenshots next to the Gate C set if the owner asks.

- [ ] **Step 5: Repo checks.**

Run: `pnpm tsc && pnpm lint`
Expected: no errors. Then check `git status --short src/features/meeting-flow`: nothing from this plan is left uncommitted (only the owner's own files, if any).

- [ ] **Step 6: Report.** In one message: the PASS/FAIL tally per command, the screenshot paths, the commit SHAs of Tasks 1–4, and the controller's ledger of rulings. Then hand off to `/impeccable polish src/features/meeting-flow/ui/components/steps/who-we-are` (Phase 7), and to the owner's hands-on check on the laptop and the tablet.

---

## Self-review against the spec

- **§3 Content:**
  - Licensing documents, rail and focus points: Task 3. Reputation removed from licensing: Task 3, moved in Task 2.
  - Communication card, timeline (four stages, first name) and rail: Task 4. `commitments` retired: Task 4, Step 7.
  - Performance compare, record rail ($9M and 98% derived from `companyInfo`), reputation order, quote with `shortName · city · trade` and pager: Tasks 1 and 2.
- **§4.1 Types:**
  - `ProofTile`, `FocusPoint`, `ProofRail` (tuple): Task 2. `TimelineStage` and the agent arm: Task 4. `HomeownerQuote`: Task 1. The credentials arm: Task 3. The point arm without `media`: Task 2.
  - `timelineLabel` is the one addition, recorded in Rulings.
- **§4.2 Components:** every create and modify in spec §8 maps to a task. `before-after-pair.tsx` is deleted in Task 2.
- **§4.4 Layout:**
  - Licensing stays on `PointLayout`: Task 3. Communication and Performance are growth slides: Tasks 4 and 2. `ComparisonSection` moves onto `GrowthLayout`: Task 2.
  - The 40rem timeline switch: Task 4. The 30rem rail stack: Task 2. The compare width cap `min(100%, 42cqh × ratio)`: Task 2.
- **§4.5 Motion:** Reveal orders per slide (Tasks 2–4); the line draws 1.1s on `BRAND_EASE` after 0.25s (Task 4); reduced motion is checked in Tasks 4 and 5; quote switches are instant (Task 2).
- **§4.6 Slider:** default touch handling, `onlyHandleDraggable` left false, the knob restyled through `buttonStyle`: Task 2, with the swipe, drag and key checks.
- **§4.7 Accessibility:**
  - Tile buttons: the visible text plus `sr-only` ", open the document" keeps label-in-name. The spec suggested an `aria-label` with the value; the visible text already carries it.
  - The timeline `ol` has `aria-label`. Pager buttons are "Quote n of m" with 44px targets. The dialog zoom control is 44px tall.
- **§5 Data access:** reads as-is and the edge mapper: Task 1. Precondition: "Before Task 1".
- **§6 Edge cases:**
  - No quotes: Task 2 `--empty-quotes`. One quote gets no pager (`quotes.length > 1`). A late quote re-centres the growth layout; accepted in the spec, no check.
  - No phone: `AgentCard` is unchanged. The scan trap comment: Task 3, Step 4. Long first names wrap (`text-balance`) and the `clipped` check covers them.
- **§7 Verification:** every measured and behaviour item is in the tool, and Task 5 sweeps it.
- **Placeholder scan:** no TBD, TODO or "similar to". Every code step has code.
- **Type consistency:**
  - `onOpen` on `ProofRail` takes `{ document: number, focus: FocusPoint }`, matching `ProofTile['opens']`.
  - `DocumentDialog`'s `focus` is `FocusPoint | null`.
  - `CredentialDocuments.onOpen` takes a `PresentationDocument`.
  - `useHomeownerQuotes` returns `HomeownerQuote[]`, which `HomeownerQuote` takes as `quotes`.
- **Review Focus:** items 1 and 3 are pinned in Task 2, item 2 in Task 1, item 4 in Task 3, item 5 in Tasks 2 and 4 and swept in Task 5.
