# Portfolio Walkthrough Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace meeting-flow step 3's portfolio grid with Option D "Walkthrough": one project at a time on the dark presentation stage, its photos in chapters (Before · During · After · More photos) advanced with Space or a tap, and a ranked queue that falls back scope → trade → featured.

**Architecture:** Step 3 becomes a `presentation`-layout step that exposes a `MeetingStageHandle` (`next`/`prev`/`advance`) to the flow's single key owner. Two additive shared primitives (`PortfolioProject.phaseCounts`, `CatalogIndex.tradeIdByScope`) feed pure feature libs (ranking, chapters, position math), which one hook (`usePortfolioWalkthrough`) turns into state; leaf components render it.

**Tech Stack:** Next.js 15, React 19 (`ref` as a prop), tRPC + TanStack Query (superjson), Drizzle (Postgres), Tailwind v4 container queries, `motion/react`, shadcn `Sheet`.

**Spec:** `docs/superpowers/specs/2026-09-23-portfolio-walkthrough-design.md` — read it before starting; this plan argues from it.

## Global Constraints

- **No database writes, in any environment, dev included.** Read-only queries only. Dev fixtures already cover every chapter shape (spec §5).
- **No test runner.** No vitest/jest, no `package.json` change. Pure-function checks are throwaway `tsx` scripts in the session scratchpad, never committed. `$SCRATCH` = `/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b2219856-9a14-407a-ab52-f91e3f5d57d6/scratchpad` (or the executing session's own scratchpad); run them from the repo root so `tsx` resolves `@/` inside project files (verified 2026-09-23).
- A `// path/to/file.ts` first line in a code block only labels the file — do not copy it into the source (no file banners).
- Verification per task: `pnpm tsc` and `pnpm lint` clean (`pnpm lint:fix` may fix import order). **Never `pnpm build`.**
- **Commits:** work on `main`; `git add <explicit paths>` then `git commit -m "…" -- <same paths>`. The index already holds unrelated staged deletions (docs prune) — a bare `git commit` would sweep them in. Never `git add -A`, never stash/checkout/reset.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Comments say why, never what.** No file banners, no restating code, no citations of plans/specs/tasks/docs in code.
- One React component per file; no file-level constants in component files (they go in `constants/`); named exports; path alias `@/` → `src/`.
- Copy is fixed by the spec: chapter labels `Before`, `During`, `After`, `More photos`, synthetic `The project`; story labels `The situation`, `What we did`, `The result`; queue sections `For your project`, `From our portfolio`, `Other projects`; note `No finished projects match these scopes yet.`; empty `No portfolio projects to show yet`.
- `FALLBACK_LEAD_COUNT = 3`, `PREFETCH_AHEAD = 2`, `QUEUE_ROW_COUNT = 3`.
- Wide layout breakpoint is the `@5xl/portfolio` container query (64rem = 1024px). The stage at 1440×900 with the sidebar open is ~1136px wide; the 820 tablet stage is ~516px (sidebar open) or ~772px (present mode). This refines the spec's "≈1100px".

## Review Focus

1. **Space while a control has focus** — Space on a focused chapter segment, thumbnail or queue card must act once (the button's own click), never click + advance. Pinned: Task 5 Step 4 (guard) and Task 9 Step 4 (browser check).
2. **Selections edited mid-walkthrough** (from the Project panel) — the project on stage stays put if it is still in the queue; otherwise the stage returns to rank 1 without a blank frame. Pinned: Task 6 (cursor keyed by project id) and Task 9 Step 6.
3. **`getDetail` returns null or errors** (project made private, network) — the stage shows the synthetic "The project" chapter and Space moves on to the next project. Pinned: Task 4 Step 1 (null detail case) and Task 6 (`isPending` vs error split).
4. **Long story text / long titles on the 820 tablet** — the caption must never slide under the chapter bar or the capsule; it scrolls inside its own box. Pinned: Task 7 (`chapter-caption.tsx` max-height + overflow) and Task 9 Step 5.
5. **End of the queue** — Space on the last photo of the last project and ↓ on the last project do nothing, and the "Next:" cue is hidden there. Pinned: Task 4 Step 1 (`advancePosition` at the end) and Task 6 (`next` clamps).

---

## File map

| File | Responsibility |
|---|---|
| `src/shared/modules/projects/core/types.ts` | `MediaPhaseCounts`; `PortfolioProject.phaseCounts` |
| `src/shared/modules/projects/core/dal/server/queries.ts` | `getPortfolioProjects` adds the grouped phase counts |
| `src/shared/modules/projects/core/lib/count-media-phases.ts` | NEW — completeness score (0–3) |
| `src/shared/modules/construction/core/lib/build-catalog-index.ts` | `CatalogIndex.tradeIdByScope` |
| `src/features/meeting-flow/lib/index-showcase-projects.ts` | takes `tradeIdByScope` |
| `src/features/meeting-flow/hooks/use-showcase-projects.ts` | passes `tradeIdByScope` |
| `src/features/meeting-flow/contexts/trade-selection-provider.tsx` | `useShowcaseProjects(catalog.tradeIdByScope)` |
| `src/features/meeting-flow/types/index.ts` | `MeetingStageHandle`, `PortfolioRowWithHero`, `RankTier`, `RankedProject`, `StoryLine`, `WalkthroughChapter`, `WalkthroughPosition`, `QueueSection` |
| `src/features/meeting-flow/constants/portfolio-walkthrough.ts` | NEW — labels, copy, counts |
| `src/features/meeting-flow/constants/keyboard-hints.ts` | Space hint, `KEY_SHORTCUTS.portfolio`, `ACTIVATABLE_TARGET_SELECTOR` |
| `src/features/meeting-flow/lib/rank-portfolio-projects.ts` | NEW — tiers + fallback |
| `src/features/meeting-flow/lib/group-queue-sections.ts` | NEW — queue → labelled sections |
| `src/features/meeting-flow/lib/format-portfolio-meta.ts` | NEW — "City, ST · 6 weeks" |
| `src/features/meeting-flow/lib/build-walkthrough-chapters.ts` | NEW — detail → chapters |
| `src/features/meeting-flow/lib/walkthrough-position.ts` | NEW — advance / final-photo math |
| `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts` | Space → `advance` |
| `src/features/meeting-flow/hooks/use-portfolio-details.ts` | NEW — current detail + prefetch |
| `src/features/meeting-flow/hooks/use-portfolio-walkthrough.ts` | NEW — cursor state + actions |
| `src/features/meeting-flow/ui/components/steps/portfolio/*.tsx` | NEW — stage components (Task 7, 8) |
| `src/features/meeting-flow/ui/views/meeting-flow.tsx` | ref type; portfolio in the presentation branch |
| `src/features/meeting-flow/constants/step-config.ts` | portfolio `layout: 'presentation'` |
| `src/features/meeting-flow/ui/components/steps/portfolio-step.tsx` | DELETE |
| `src/features/meeting-flow/ui/components/steps/trade-project-grid.tsx` | DELETE |

---

### Task 1: `phaseCounts` on portfolio rows

**Files:**
- Modify: `src/shared/modules/projects/core/types.ts`
- Modify: `src/shared/modules/projects/core/dal/server/queries.ts` (`getPortfolioProjects`, lines 15–68; imports line 6)
- Create: `src/shared/modules/projects/core/lib/count-media-phases.ts`
- Scratch: `$SCRATCH/portfolio-checks/count-media-phases.check.ts`

**Interfaces:**
- Produces: `type MediaPhaseCounts = Record<MediaPhase, number>`; `PortfolioProject.phaseCounts: MediaPhaseCounts`; `countMediaPhases(phaseCounts: MediaPhaseCounts): number` (0–3).

- [ ] **Step 1: Write the scratch check**

```ts
// $SCRATCH/portfolio-checks/count-media-phases.check.ts
import assert from 'node:assert/strict'
import { countMediaPhases } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/core/lib/count-media-phases'

assert.equal(countMediaPhases({ uncategorized: 0, before: 0, during: 0, after: 0 }), 0)
assert.equal(countMediaPhases({ uncategorized: 12, before: 0, during: 0, after: 0 }), 0, 'uncategorized never counts')
assert.equal(countMediaPhases({ uncategorized: 0, before: 3, during: 0, after: 9 }), 2)
assert.equal(countMediaPhases({ uncategorized: 1, before: 1, during: 1, after: 1 }), 3)
console.log('count-media-phases: ok')
```

- [ ] **Step 2: Run it to see it fail**

Run (from the repo root): `pnpm exec tsx $SCRATCH/portfolio-checks/count-media-phases.check.ts`
Expected: FAIL — cannot find module `…/count-media-phases`.

- [ ] **Step 3: Add the type**

In `src/shared/modules/projects/core/types.ts`, add the import and type, and extend `PortfolioProject`:

```ts
import type { MediaPhase } from '@/shared/constants/enums/media'
import type { Project, ProjectMediaFile } from '@/shared/db/schema'

/** Non-video photos per phase; every phase present, zero when empty. */
export type MediaPhaseCounts = Record<MediaPhase, number>

export interface PortfolioProject {
  project: Project
  heroImage: ProjectMediaFile | null
  scopeIds: string[]
  phaseCounts: MediaPhaseCounts
}
```

- [ ] **Step 4: Write `countMediaPhases`**

```ts
// src/shared/modules/projects/core/lib/count-media-phases.ts
import type { MediaPhaseCounts } from '@/shared/modules/projects/core/types'

/** How many of before, during and after have photos (0–3). Uncategorized photos tell no part of the story, so they never count. */
export function countMediaPhases(phaseCounts: MediaPhaseCounts): number {
  return [phaseCounts.before, phaseCounts.during, phaseCounts.after].filter(n => n > 0).length
}
```

- [ ] **Step 5: Add the grouped query to `getPortfolioProjects`**

Add `notLike` to the `drizzle-orm` import on line 6 (keep the list alphabetical: `…, lte, notLike, or, sql`). Add `import type { MediaPhaseCounts } from '@/shared/modules/projects/core/types'` alongside the existing `PortfolioProject` type import (same module — merge into that import). Then replace the tail of `getPortfolioProjects`, from `// Fetch scope IDs` to the end of the function, with:

```ts
  const projectIds = uniqueRows.map(row => row.project.id)

  const [scopeRows, phaseRows] = await Promise.all([
    db
      .select({
        projectId: x_projectScopes.projectId,
        scopeId: x_projectScopes.scopeId,
      })
      .from(x_projectScopes),
    // Videos are excluded to match getPortfolioProjectDetail, whose phase groups are photos only.
    db
      .select({ projectId: projectMediaFiles.projectId, phase: projectMediaFiles.phase, total: count() })
      .from(projectMediaFiles)
      .where(and(inArray(projectMediaFiles.projectId, projectIds), notLike(projectMediaFiles.mimeType, 'video/%')))
      .groupBy(projectMediaFiles.projectId, projectMediaFiles.phase),
  ])

  const scopesByProject = new Map<string, string[]>()
  for (const row of scopeRows) {
    if (!scopesByProject.has(row.projectId)) {
      scopesByProject.set(row.projectId, [])
    }
    scopesByProject.get(row.projectId)!.push(row.scopeId)
  }

  const phaseCountsByProject = new Map<string, MediaPhaseCounts>()
  for (const row of phaseRows) {
    const counts = phaseCountsByProject.get(row.projectId) ?? { uncategorized: 0, before: 0, during: 0, after: 0 }
    counts[row.phase] = row.total
    phaseCountsByProject.set(row.projectId, counts)
  }

  return uniqueRows.map(row => ({
    project: row.project,
    heroImage: row.heroImage,
    scopeIds: scopesByProject.get(row.project.id) ?? [],
    phaseCounts: phaseCountsByProject.get(row.project.id) ?? { uncategorized: 0, before: 0, during: 0, after: 0 },
  }))
}
```

(The existing scope query stays unfiltered, exactly as today; it only moves into the `Promise.all`.)

- [ ] **Step 6: Run the check and the type-check**

Run: `pnpm exec tsx $SCRATCH/portfolio-checks/count-media-phases.check.ts` → `count-media-phases: ok`
Run: `pnpm tsc` → no errors. The only `PortfolioProject` builder is this DAL, so nothing else should break; if `tsc` names another builder, add `phaseCounts` there.
Run: `pnpm lint` → clean.

- [ ] **Step 7: Commit**

```bash
git add src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/dal/server/queries.ts src/shared/modules/projects/core/lib/count-media-phases.ts
git commit -m "feat(projects): photo counts per phase on portfolio rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/dal/server/queries.ts src/shared/modules/projects/core/lib/count-media-phases.ts
```

---

### Task 2: `tradeIdByScope` on the catalog index

**Files:**
- Modify: `src/shared/modules/construction/core/lib/build-catalog-index.ts`
- Modify: `src/features/meeting-flow/lib/index-showcase-projects.ts`
- Modify: `src/features/meeting-flow/hooks/use-showcase-projects.ts`
- Modify: `src/features/meeting-flow/contexts/trade-selection-provider.tsx:59`
- Scratch: `$SCRATCH/portfolio-checks/catalog-index.check.ts`

**Interfaces:**
- Produces: `CatalogIndex.tradeIdByScope: ReadonlyMap<string, string>` (scope or add-on id → trade id). `indexShowcaseProjects(projects, tradeIdByScope)`; `useShowcaseProjects(tradeIdByScope)`.

- [ ] **Step 1: Write the scratch check**

```ts
// $SCRATCH/portfolio-checks/catalog-index.check.ts
import type { Scope, Trade } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/construction/core/schemas'
import assert from 'node:assert/strict'
import { buildCatalogIndex } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/construction/core/lib/build-catalog-index'

const trades = [{ id: 't-kitchen', name: 'Kitchen', slug: 'kitchen', coverImageUrl: null, scopeIds: [] }] as Trade[]
const scopes = [
  { id: 's-cabinets', name: 'Cabinets', kind: 'scope', unitOfPricing: 'unit', coverImageUrl: null, tradeId: 't-kitchen', sowIds: [] },
  { id: 'a-lighting', name: 'Under-cabinet lighting', kind: 'addon', unitOfPricing: 'unit', coverImageUrl: null, tradeId: 't-kitchen', sowIds: [] },
] as Scope[]

const index = buildCatalogIndex(trades, scopes)
assert.equal(index.tradeIdByScope.get('s-cabinets'), 't-kitchen')
assert.equal(index.tradeIdByScope.get('a-lighting'), 't-kitchen', 'add-ons map too')
assert.equal(index.tradeIdByScope.get('nope'), undefined)
console.log('catalog-index: ok')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec tsx $SCRATCH/portfolio-checks/catalog-index.check.ts`
Expected: FAIL — `index.tradeIdByScope` is undefined (`Cannot read properties of undefined (reading 'get')`).

- [ ] **Step 3: Add the map to `buildCatalogIndex`**

```ts
export interface CatalogIndex {
  trades: Trade[]
  tradesById: ReadonlyMap<string, Trade>
  tradesBySlug: ReadonlyMap<string, Trade>
  scopesByTrade: ReadonlyMap<string, TradeScopeGroup>
  /** Scope and add-on ids to the trade that owns them. */
  tradeIdByScope: ReadonlyMap<string, string>
}

export function buildCatalogIndex(trades: Trade[], scopes: Scope[]): CatalogIndex {
  const scopesByTrade = new Map<string, TradeScopeGroup>()
  const tradeIdByScope = new Map<string, string>()
  for (const scope of scopes) {
    const group = scopesByTrade.get(scope.tradeId) ?? { scopes: [], addons: [] }
    if (scope.kind === 'addon') {
      group.addons.push(scope)
    }
    else {
      group.scopes.push(scope)
    }
    scopesByTrade.set(scope.tradeId, group)
    tradeIdByScope.set(scope.id, scope.tradeId)
  }

  return {
    trades,
    tradesById: new Map(trades.map(trade => [trade.id, trade])),
    tradesBySlug: new Map(trades.map(trade => [trade.slug, trade])),
    scopesByTrade,
    tradeIdByScope,
  }
}
```

- [ ] **Step 4: Move `indexShowcaseProjects` onto it**

In `src/features/meeting-flow/lib/index-showcase-projects.ts`: drop the `TradeScopeGroup` import, change the signature, delete the inline `tradeOfScope` loop (lines 7–12), and read the passed map where `tradeOfScope.get(scopeId)` was:

```ts
import type { ShowcaseProject, ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'

/** Portfolio rows to lookups by trade and scope. Rows without a hero image are skipped: the showcase has nothing to show for them. */
export function indexShowcaseProjects(projects: PortfolioProject[], tradeIdByScope: ReadonlyMap<string, string>): ShowcaseProjectIndex {
  const byScope = new Map<string, ShowcaseProject[]>()
  // …unchanged body, with `const tradeId = tradeIdByScope.get(scopeId)`
}
```

- [ ] **Step 5: Pass it through the hook and the provider**

`src/features/meeting-flow/hooks/use-showcase-projects.ts` — drop the `TradeScopeGroup` import; the doc comment's identity note names the new parameter:

```ts
/**
 * Portfolio projects with a hero image, indexed by trade and scope. Empty while loading or on
 * error: the showcase falls back, silently.
 *
 * `tradeIdByScope` must keep a stable identity across renders — memoize it at the source, as
 * `useConstructionCatalog` does. A map rebuilt inline on every render rebuilds the whole index with it.
 */
export function useShowcaseProjects(tradeIdByScope: ReadonlyMap<string, string>): ShowcaseProjectIndex {
  const trpc = useTRPC()
  const query = useQuery({ ...trpc.projectsRouter.showroomDisplay.getAll.queryOptions(), staleTime: SHOWCASE_PROJECTS_STALE_MS })
  return useMemo(() => indexShowcaseProjects(query.data ?? [], tradeIdByScope), [query.data, tradeIdByScope])
}
```

`src/features/meeting-flow/contexts/trade-selection-provider.tsx:59`:

```ts
  const projects = useShowcaseProjects(catalog.tradeIdByScope)
```

- [ ] **Step 6: Run the check, type-check, lint**

Run: `pnpm exec tsx $SCRATCH/portfolio-checks/catalog-index.check.ts` → `catalog-index: ok`
Run: `pnpm tsc` → clean. Run: `pnpm lint` → clean.

- [ ] **Step 7: Commit**

```bash
git add src/shared/modules/construction/core/lib/build-catalog-index.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/hooks/use-showcase-projects.ts src/features/meeting-flow/contexts/trade-selection-provider.tsx
git commit -m "refactor(construction): the catalog index owns scope-to-trade lookup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/modules/construction/core/lib/build-catalog-index.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/hooks/use-showcase-projects.ts src/features/meeting-flow/contexts/trade-selection-provider.tsx
```

---

### Task 3: Types, constants, ranking, queue sections, meta line

**Files:**
- Modify: `src/features/meeting-flow/types/index.ts` (append a "Portfolio walkthrough" block)
- Create: `src/features/meeting-flow/constants/portfolio-walkthrough.ts`
- Create: `src/features/meeting-flow/lib/rank-portfolio-projects.ts`
- Create: `src/features/meeting-flow/lib/group-queue-sections.ts`
- Create: `src/features/meeting-flow/lib/format-portfolio-meta.ts`
- Scratch: `$SCRATCH/portfolio-checks/fixtures.ts`, `$SCRATCH/portfolio-checks/rank.check.ts`

**Interfaces:**
- Consumes: `PortfolioProject` + `phaseCounts` (Task 1), `CatalogIndex.tradeIdByScope` (Task 2), `countMediaPhases` (Task 1), `TradeSelection` from `@/shared/entities/meetings/schemas`.
- Produces (exact):

```ts
export type MeetingStageHandle = PresentationHandle & { advance?: () => void }
export type PortfolioRowWithHero = PortfolioProject & { heroImage: ProjectMediaFile }
export type RankTier = 'scope' | 'trade' | 'featured' | 'other'
export interface RankedProject { row: PortfolioRowWithHero, tier: RankTier, matchedScopeIds: string[], matchedTradeIds: string[], reasons: string[] }
export interface StoryLine { label: string, text: string }
export interface WalkthroughChapter { phase: MediaPhase | 'project', label: string, photos: ProjectMediaFile[], story: StoryLine[] }
export interface WalkthroughPosition { projectIndex: number, chapterIndex: number, photoIndex: number }
export interface QueueSection { label: string, items: { ranked: RankedProject, index: number }[] }

rankPortfolioProjects(projects: PortfolioProject[], selections: TradeSelection[], catalog: Pick<CatalogIndex, 'tradeIdByScope'>): RankedProject[]
groupQueueSections(queue: RankedProject[]): QueueSection[]
formatPortfolioMeta(project: Pick<Project, 'city' | 'state' | 'projectDuration'>): string
```

`reasons` = the pill texts: matched scope labels (tier `scope`), trade names (tier `trade`), `[]` otherwise — labels come from the selections (`selectedScopes[].label`, `tradeName`), so the ranker needs no scope-name lookup.

- [ ] **Step 1: Write the shared scratch fixtures**

```ts
// $SCRATCH/portfolio-checks/fixtures.ts
import type { TradeSelection } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/entities/meetings/schemas'
import type { MediaPhaseCounts, PortfolioProject } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/core/types'

let nextMediaId = 1
export function media(phase: string, extra: Record<string, unknown> = {}) {
  return { id: nextMediaId++, phase, isHeroImage: false, url: `https://x/${nextMediaId}.jpg`, mimeType: 'image/jpeg', pathKey: null, bucket: null, optimizationStatus: 'pending', ...extra } as any
}

export function row(id: string, opts: { title?: string, scopeIds?: string[], phases?: Partial<MediaPhaseCounts>, hero?: boolean, story?: Record<string, string | null> } = {}): PortfolioProject {
  return {
    project: { id, accessor: id, title: opts.title ?? id, city: 'Long Beach', state: 'CA', projectDuration: '6 weeks', challengeDescription: null, solutionDescription: null, resultDescription: null, beforeDescription: null, duringDescription: null, afterDescription: null, ...opts.story } as any,
    heroImage: opts.hero === false ? null : media('after', { isHeroImage: true }),
    scopeIds: opts.scopeIds ?? [],
    phaseCounts: { uncategorized: 0, before: 0, during: 0, after: 0, ...opts.phases },
  }
}

export const tradeIdByScope = new Map([
  ['s-cabinets', 't-kitchen'], ['s-counters', 't-kitchen'], ['s-backsplash', 't-kitchen'],
  ['s-windows', 't-windows'], ['s-doors', 't-windows'],
])

export function selection(tradeId: string, tradeName: string, scopes: [string, string][]): TradeSelection {
  return { tradeId, tradeName, selectedScopes: scopes.map(([id, label]) => ({ id, label })), painPoints: [] }
}
```

- [ ] **Step 2: Write the ranking check**

```ts
// $SCRATCH/portfolio-checks/rank.check.ts
import assert from 'node:assert/strict'
import { groupQueueSections } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/group-queue-sections'
import { rankPortfolioProjects } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/rank-portfolio-projects'
import { row, selection, tradeIdByScope } from './fixtures'

const catalog = { tradeIdByScope }
const ids = (q: { row: { project: { id: string } } }[]) => q.map(r => r.row.project.id)
const kitchenCabinets = [selection('t-kitchen', 'Kitchen', [['s-cabinets', 'Cabinets']])]

// scope beats trade; more matched scopes first
{
  const projects = [
    row('trade-only', { scopeIds: ['s-backsplash'] }),
    row('one-scope', { scopeIds: ['s-cabinets'] }),
    row('two-scopes', { scopeIds: ['s-cabinets', 's-counters'] }),
  ]
  const sel = [selection('t-kitchen', 'Kitchen', [['s-cabinets', 'Cabinets'], ['s-counters', 'Countertops']])]
  const q = rankPortfolioProjects(projects, sel, catalog)
  assert.deepEqual(ids(q), ['two-scopes', 'one-scope', 'trade-only'])
  assert.deepEqual(q.map(r => r.tier), ['scope', 'scope', 'trade'])
  assert.deepEqual(q[0].reasons, ['Cabinets', 'Countertops'])
  assert.deepEqual(q[2].reasons, ['Kitchen'])
}

// a trade selected with zero scopes still yields trade-tier rows
{
  const q = rankPortfolioProjects([row('k', { scopeIds: ['s-counters'] })], [selection('t-kitchen', 'Kitchen', [])], catalog)
  assert.equal(q[0].tier, 'trade')
  assert.deepEqual(q[0].matchedTradeIds, ['t-kitchen'])
}

// no scope/trade hits → exactly FALLBACK_LEAD_COUNT featured, strongest photos first, then other
{
  const projects = [
    row('a-none', { scopeIds: ['s-windows'] }),
    row('b-full', { scopeIds: ['s-windows'], phases: { before: 2, during: 5, after: 4 } }),
    row('c-two', { scopeIds: ['s-doors'], phases: { during: 1, after: 1 } }),
    row('d-two-more', { scopeIds: ['s-doors'], phases: { during: 8, after: 8 } }),
    row('e-none', {}),
  ]
  const q = rankPortfolioProjects(projects, kitchenCabinets, catalog)
  assert.deepEqual(ids(q), ['b-full', 'd-two-more', 'c-two', 'a-none', 'e-none'])
  assert.deepEqual(q.map(r => r.tier), ['featured', 'featured', 'featured', 'other', 'other'])
  const sections = groupQueueSections(q)
  assert.deepEqual(sections.map(s => s.label), ['From our portfolio', 'Other projects'])
  assert.deepEqual(sections[1].items.map(i => i.index), [3, 4], 'indexes are queue positions')
}

// no selections → featured first
{
  const q = rankPortfolioProjects([row('x', { scopeIds: ['s-cabinets'] }), row('y')], [], catalog)
  assert.equal(q[0].tier, 'featured')
}

// hero-less rows are excluded; ties fall to title
{
  const q = rankPortfolioProjects([row('no-hero', { hero: false }), row('b', { title: 'Beta' }), row('a', { title: 'Alpha' })], [], catalog)
  assert.deepEqual(ids(q), ['a', 'b'])
}

// scope + trade tiers share one section label
{
  const q = rankPortfolioProjects([row('s', { scopeIds: ['s-cabinets'] }), row('t', { scopeIds: ['s-counters'] }), row('o')], kitchenCabinets, catalog)
  assert.deepEqual(groupQueueSections(q).map(s => s.label), ['For your project', 'Other projects'])
}
console.log('rank: ok')
```

- [ ] **Step 3: Run it to see it fail**

Run: `pnpm exec tsx $SCRATCH/portfolio-checks/rank.check.ts`
Expected: FAIL — cannot find module `…/group-queue-sections`.

- [ ] **Step 4: Append the types**

At the end of `src/features/meeting-flow/types/index.ts` (add `MediaPhase`, `PresentationHandle`, `PortfolioProject` type imports at the top, merged into existing imports where the module is already imported; `ProjectMediaFile` is already imported for `ShowcaseProject`):

```ts
// ── Portfolio walkthrough ───────────────────────────────────────────────────

/** What a presentation-layout step exposes to the flow's key map. `advance` is the Space key; steps without one ignore it. */
export type MeetingStageHandle = PresentationHandle & { advance?: () => void }

export type PortfolioRowWithHero = PortfolioProject & { heroImage: ProjectMediaFile }

export type RankTier = 'scope' | 'trade' | 'featured' | 'other'

export interface RankedProject {
  row: PortfolioRowWithHero
  tier: RankTier
  matchedScopeIds: string[]
  matchedTradeIds: string[]
  /** The why-pills: matched scope labels, or trade names, as the meeting named them. */
  reasons: string[]
}

export interface StoryLine {
  label: string
  text: string
}

export interface WalkthroughChapter {
  /** `'project'` is the stand-in chapter when a project's photos could not be loaded. */
  phase: MediaPhase | 'project'
  label: string
  photos: ProjectMediaFile[]
  story: StoryLine[]
}

export interface WalkthroughPosition {
  projectIndex: number
  chapterIndex: number
  photoIndex: number
}

export interface QueueSection {
  label: string
  items: { ranked: RankedProject, index: number }[]
}
```

- [ ] **Step 5: Write the constants**

```ts
// src/features/meeting-flow/constants/portfolio-walkthrough.ts
import type { RankTier } from '@/features/meeting-flow/types'
import type { MediaPhase } from '@/shared/constants/enums/media'

/** Story order: uncategorized photos come last because they carry no part of the before → after arc. */
export const CHAPTER_ORDER = ['before', 'during', 'after', 'uncategorized'] as const satisfies readonly MediaPhase[]

export const CHAPTER_LABELS: Record<MediaPhase, string> = {
  before: 'Before',
  during: 'During',
  after: 'After',
  uncategorized: 'More photos',
}

export const PROJECT_CHAPTER_LABEL = 'The project'

export const STORY_LABELS = {
  situation: 'The situation',
  work: 'What we did',
  result: 'The result',
} as const

export const QUEUE_SECTION_LABELS: Record<RankTier, string> = {
  scope: 'For your project',
  trade: 'For your project',
  featured: 'From our portfolio',
  other: 'Other projects',
}

export const PORTFOLIO_COPY = {
  noMatches: 'No finished projects match these scopes yet.',
  empty: 'No portfolio projects to show yet',
  errorTitle: 'The portfolio did not load',
  retry: 'Try again',
  startCue: 'Tap or press Space',
  nextCue: 'Next:',
  nextPhoto: 'Next photo',
  allProjects: (count: number) => `All ${count}`,
  queueTitle: 'Projects',
} as const

/** When nothing matches the meeting's scopes or trades, this many projects lead instead. */
export const FALLBACK_LEAD_COUNT = 3

/** Project details fetched ahead of the one on stage, so ↓ lands on loaded photos. */
export const PREFETCH_AHEAD = 2

/** Cards in the narrow-stage queue row. */
export const QUEUE_ROW_COUNT = 3
```

- [ ] **Step 6: Write `rankPortfolioProjects`**

```ts
// src/features/meeting-flow/lib/rank-portfolio-projects.ts
import type { PortfolioRowWithHero, RankedProject } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { CatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'
import { FALLBACK_LEAD_COUNT } from '@/features/meeting-flow/constants/portfolio-walkthrough'
import { countMediaPhases } from '@/shared/modules/projects/core/lib/count-media-phases'

function hasHero(row: PortfolioProject): row is PortfolioRowWithHero {
  return row.heroImage !== null
}

function phasedPhotoCount(row: PortfolioProject): number {
  return row.phaseCounts.before + row.phaseCounts.during + row.phaseCounts.after
}

/** A fuller before → during → after story leads; then more photos; then the title keeps the order stable. */
function byStory(a: RankedProject, b: RankedProject): number {
  return countMediaPhases(b.row.phaseCounts) - countMediaPhases(a.row.phaseCounts)
    || phasedPhotoCount(b.row) - phasedPhotoCount(a.row)
    || a.row.project.title.localeCompare(b.row.project.title)
}

/**
 * The portfolio queue for one meeting: projects sharing a selected scope, then projects in a selected
 * trade, then everything else. When neither of the first two has anything, the strongest
 * `FALLBACK_LEAD_COUNT` projects lead as `featured` so the step never opens on nothing.
 */
export function rankPortfolioProjects(
  projects: PortfolioProject[],
  selections: TradeSelection[],
  catalog: Pick<CatalogIndex, 'tradeIdByScope'>,
): RankedProject[] {
  const scopeLabels = new Map(selections.flatMap(s => s.selectedScopes.map(item => [item.id, item.label] as const)))
  const tradeNames = new Map(selections.map(s => [s.tradeId, s.tradeName] as const))

  const weight = new Map<string, number>()
  const scope: RankedProject[] = []
  const trade: RankedProject[] = []
  const rest: RankedProject[] = []

  for (const row of projects) {
    if (!hasHero(row)) {
      continue
    }
    const matchedScopeIds = row.scopeIds.filter(id => scopeLabels.has(id))
    const scopesInSelectedTrades = row.scopeIds.filter((id) => {
      const tradeId = catalog.tradeIdByScope.get(id)
      return tradeId !== undefined && tradeNames.has(tradeId)
    })
    const matchedTradeIds = [...new Set(scopesInSelectedTrades.map(id => catalog.tradeIdByScope.get(id)!))]

    if (matchedScopeIds.length > 0) {
      weight.set(row.project.id, matchedScopeIds.length)
      scope.push({ row, tier: 'scope', matchedScopeIds, matchedTradeIds, reasons: matchedScopeIds.map(id => scopeLabels.get(id)!) })
    }
    else if (matchedTradeIds.length > 0) {
      weight.set(row.project.id, scopesInSelectedTrades.length)
      trade.push({ row, tier: 'trade', matchedScopeIds: [], matchedTradeIds, reasons: matchedTradeIds.map(id => tradeNames.get(id)!) })
    }
    else {
      rest.push({ row, tier: 'other', matchedScopeIds: [], matchedTradeIds: [], reasons: [] })
    }
  }

  const byWeight = (a: RankedProject, b: RankedProject) =>
    (weight.get(b.row.project.id) ?? 0) - (weight.get(a.row.project.id) ?? 0) || byStory(a, b)

  scope.sort(byWeight)
  trade.sort(byWeight)
  rest.sort(byStory)

  const featuredCount = scope.length + trade.length === 0 ? FALLBACK_LEAD_COUNT : 0
  const featured = rest.slice(0, featuredCount).map(ranked => ({ ...ranked, tier: 'featured' as const }))

  return [...scope, ...trade, ...featured, ...rest.slice(featuredCount)]
}
```

- [ ] **Step 7: Write `groupQueueSections` and `formatPortfolioMeta`**

```ts
// src/features/meeting-flow/lib/group-queue-sections.ts
import type { QueueSection, RankedProject } from '@/features/meeting-flow/types'
import { QUEUE_SECTION_LABELS } from '@/features/meeting-flow/constants/portfolio-walkthrough'

/** Consecutive tiers that share a label share a section; `index` stays the queue position so rank numbers and jumps agree. */
export function groupQueueSections(queue: RankedProject[]): QueueSection[] {
  const sections: QueueSection[] = []
  queue.forEach((ranked, index) => {
    const label = QUEUE_SECTION_LABELS[ranked.tier]
    const last = sections.at(-1)
    if (last?.label === label) {
      last.items.push({ ranked, index })
    }
    else {
      sections.push({ label, items: [{ ranked, index }] })
    }
  })
  return sections
}
```

```ts
// src/features/meeting-flow/lib/format-portfolio-meta.ts
import type { Project } from '@/shared/db/schema'

export function formatPortfolioMeta(project: Pick<Project, 'city' | 'state' | 'projectDuration'>): string {
  const place = [project.city, project.state].filter(Boolean).join(', ')
  return [place, project.projectDuration].filter(Boolean).join(' · ')
}
```

- [ ] **Step 8: Run the check, type-check, lint**

Run: `pnpm exec tsx $SCRATCH/portfolio-checks/rank.check.ts` → `rank: ok`
Run: `pnpm tsc` → clean. Run: `pnpm lint` → clean (`pnpm lint:fix` for import order).

- [ ] **Step 9: Commit**

```bash
git add src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/portfolio-walkthrough.ts src/features/meeting-flow/lib/rank-portfolio-projects.ts src/features/meeting-flow/lib/group-queue-sections.ts src/features/meeting-flow/lib/format-portfolio-meta.ts
git commit -m "feat(meeting-flow): rank portfolio projects by scope, then trade, then featured

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/portfolio-walkthrough.ts src/features/meeting-flow/lib/rank-portfolio-projects.ts src/features/meeting-flow/lib/group-queue-sections.ts src/features/meeting-flow/lib/format-portfolio-meta.ts
```

---

### Task 4: Chapters and position math

**Files:**
- Create: `src/features/meeting-flow/lib/build-walkthrough-chapters.ts`
- Create: `src/features/meeting-flow/lib/walkthrough-position.ts`
- Scratch: `$SCRATCH/portfolio-checks/chapters.check.ts`

**Interfaces:**
- Consumes: types + constants (Task 3), `PortfolioProjectDetail` from `@/shared/modules/projects/core/types`.
- Produces:

```ts
buildWalkthroughChapters(row: PortfolioRowWithHero, detail: Pick<PortfolioProjectDetail, 'media'> | null): WalkthroughChapter[]
advancePosition(position: WalkthroughPosition, chapterPhotoCounts: readonly number[], projectCount: number): WalkthroughPosition
isFinalPhoto(position: WalkthroughPosition, chapterPhotoCounts: readonly number[]): boolean
```

- [ ] **Step 1: Write the check**

```ts
// $SCRATCH/portfolio-checks/chapters.check.ts
import assert from 'node:assert/strict'
import { buildWalkthroughChapters } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/build-walkthrough-chapters'
import { advancePosition, isFinalPhoto } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/walkthrough-position'
import { media, row } from './fixtures'

const story = { challengeDescription: 'Leaky single-pane windows.', solutionDescription: 'Dual-pane vinyl, full frame.', resultDescription: 'Quieter, cooler rooms.' }
const detailOf = (m: Record<string, any[]>) => ({ media: { hero: [], before: [], during: [], after: [], uncategorized: [], videos: [], all: [], ...m } }) as any
const shape = (chapters: { phase: string, story: { label: string }[] }[]) => chapters.map(c => `${c.phase}:${c.story.map(s => s.label).join('+')}`)

// all four phases: each line at home, More photos last with no story
{
  const r = row('p', { story })
  const c = buildWalkthroughChapters(r as any, detailOf({ before: [media('before')], during: [media('during')], after: [media('after')], uncategorized: [media('uncategorized')] }))
  assert.deepEqual(shape(c), ['before:The situation', 'during:What we did', 'after:The result', 'uncategorized:'])
  assert.deepEqual(c.map(ch => ch.label), ['Before', 'During', 'After', 'More photos'])
}

// Before + After + More: "What we did" moves forward to After
{
  const c = buildWalkthroughChapters(row('p', { story }) as any, detailOf({ before: [media('before')], after: [media('after')], uncategorized: [media('uncategorized')] }))
  assert.deepEqual(shape(c), ['before:The situation', 'after:What we did+The result', 'uncategorized:'])
}

// hero + uncategorized only: the whole story stacks on More photos
{
  const c = buildWalkthroughChapters(row('p', { story }) as any, detailOf({ uncategorized: [media('uncategorized'), media('uncategorized')] }))
  assert.deepEqual(shape(c), ['uncategorized:The situation+What we did+The result'])
}

// only Before: lines with no chapter after them fall back to the last one
{
  const c = buildWalkthroughChapters(row('p', { story }) as any, detailOf({ before: [media('before')] }))
  assert.deepEqual(shape(c), ['before:The situation+What we did+The result'])
}

// phase text wins over challenge/solution/result; blank text is skipped
{
  const c = buildWalkthroughChapters(row('p', { story: { ...story, beforeDescription: 'Phase text.', resultDescription: '   ' } }) as any, detailOf({ before: [media('before')], after: [media('after')] }))
  assert.equal(c[0].story[0].text, 'Phase text.')
  assert.deepEqual(shape(c), ['before:The situation', 'after:What we did'])
}

// the hero leads inside its own chapter
{
  const r = row('p', { story })
  const hero = { ...r.heroImage, phase: 'after' }
  const c = buildWalkthroughChapters({ ...r, heroImage: hero } as any, detailOf({ after: [media('after'), hero] }))
  assert.equal(c[0].photos[0].id, hero.id)
}

// null detail → one synthetic chapter: hero + every line
{
  const r = row('p', { story })
  const c = buildWalkthroughChapters(r as any, null)
  assert.deepEqual(shape(c), ['project:The situation+What we did+The result'])
  assert.equal(c[0].label, 'The project')
  assert.equal(c[0].photos[0], r.heroImage)
}

// advance: photo → chapter → project → stop at the end
{
  const counts = [2, 1]
  assert.deepEqual(advancePosition({ projectIndex: 0, chapterIndex: 0, photoIndex: 0 }, counts, 2), { projectIndex: 0, chapterIndex: 0, photoIndex: 1 })
  assert.deepEqual(advancePosition({ projectIndex: 0, chapterIndex: 0, photoIndex: 1 }, counts, 2), { projectIndex: 0, chapterIndex: 1, photoIndex: 0 })
  assert.deepEqual(advancePosition({ projectIndex: 0, chapterIndex: 1, photoIndex: 0 }, counts, 2), { projectIndex: 1, chapterIndex: 0, photoIndex: 0 })
  const end = { projectIndex: 1, chapterIndex: 1, photoIndex: 0 }
  assert.deepEqual(advancePosition(end, counts, 2), end, 'last photo of the last project stays')
  assert.equal(isFinalPhoto({ projectIndex: 0, chapterIndex: 1, photoIndex: 0 }, counts), true)
  assert.equal(isFinalPhoto({ projectIndex: 0, chapterIndex: 0, photoIndex: 1 }, counts), false)
}
console.log('chapters: ok')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm exec tsx $SCRATCH/portfolio-checks/chapters.check.ts`
Expected: FAIL — cannot find module `…/build-walkthrough-chapters`.

- [ ] **Step 3: Write `buildWalkthroughChapters`**

```ts
// src/features/meeting-flow/lib/build-walkthrough-chapters.ts
import type { PortfolioRowWithHero, StoryLine, WalkthroughChapter } from '@/features/meeting-flow/types'
import type { MediaPhase } from '@/shared/constants/enums/media'
import type { ProjectMediaFile } from '@/shared/db/schema'
import type { PortfolioProjectDetail } from '@/shared/modules/projects/core/types'
import { CHAPTER_LABELS, CHAPTER_ORDER, PROJECT_CHAPTER_LABEL, STORY_LABELS } from '@/features/meeting-flow/constants/portfolio-walkthrough'

function firstText(...candidates: (string | null)[]): string {
  return candidates.map(text => text?.trim() ?? '').find(Boolean) ?? ''
}

function heroFirst(photos: ProjectMediaFile[], heroId: number): ProjectMediaFile[] {
  const hero = photos.find(photo => photo.id === heroId)
  return hero ? [hero, ...photos.filter(photo => photo !== hero)] : photos
}

/**
 * A project's photos as chapters in story order, empty phases dropped. Each story line belongs to a
 * phase; when that phase has no photos, the line moves to the next chapter that exists (or the last
 * one), so the story is never lost with its photos. Without a detail, one stand-in chapter holds the
 * hero and the whole story.
 */
export function buildWalkthroughChapters(row: PortfolioRowWithHero, detail: Pick<PortfolioProjectDetail, 'media'> | null): WalkthroughChapter[] {
  const { project } = row
  const lines: (StoryLine & { home: MediaPhase })[] = [
    { home: 'before' as const, label: STORY_LABELS.situation, text: firstText(project.beforeDescription, project.challengeDescription) },
    { home: 'during' as const, label: STORY_LABELS.work, text: firstText(project.duringDescription, project.solutionDescription) },
    { home: 'after' as const, label: STORY_LABELS.result, text: firstText(project.afterDescription, project.resultDescription) },
  ].filter(line => line.text)

  const chapters: WalkthroughChapter[] = detail
    ? CHAPTER_ORDER
        .map(phase => ({ phase, label: CHAPTER_LABELS[phase], photos: heroFirst(detail.media[phase], row.heroImage.id), story: [] as StoryLine[] }))
        .filter(chapter => chapter.photos.length > 0)
    : []

  if (chapters.length === 0) {
    return [{ phase: 'project', label: PROJECT_CHAPTER_LABEL, photos: [row.heroImage], story: lines.map(({ label, text }) => ({ label, text })) }]
  }

  for (const { home, label, text } of lines) {
    const homeOrder = CHAPTER_ORDER.indexOf(home)
    const target = chapters.find(chapter => CHAPTER_ORDER.indexOf(chapter.phase as MediaPhase) >= homeOrder) ?? chapters.at(-1)!
    target.story.push({ label, text })
  }
  return chapters
}
```

- [ ] **Step 4: Write the position math**

```ts
// src/features/meeting-flow/lib/walkthrough-position.ts
import type { WalkthroughPosition } from '@/features/meeting-flow/types'

/** Space: the next photo, rolling into the next chapter, then the next project's first photo. The very last photo stays put. */
export function advancePosition(position: WalkthroughPosition, chapterPhotoCounts: readonly number[], projectCount: number): WalkthroughPosition {
  const { projectIndex, chapterIndex, photoIndex } = position
  if (photoIndex + 1 < (chapterPhotoCounts[chapterIndex] ?? 0)) {
    return { projectIndex, chapterIndex, photoIndex: photoIndex + 1 }
  }
  if (chapterIndex + 1 < chapterPhotoCounts.length) {
    return { projectIndex, chapterIndex: chapterIndex + 1, photoIndex: 0 }
  }
  if (projectIndex + 1 < projectCount) {
    return { projectIndex: projectIndex + 1, chapterIndex: 0, photoIndex: 0 }
  }
  return position
}

/** The project's last photo: the next Space leaves this project. */
export function isFinalPhoto(position: WalkthroughPosition, chapterPhotoCounts: readonly number[]): boolean {
  const lastChapter = chapterPhotoCounts.length - 1
  return position.chapterIndex === lastChapter && position.photoIndex === (chapterPhotoCounts[lastChapter] ?? 1) - 1
}
```

- [ ] **Step 5: Run the check, type-check, lint**

Run: `pnpm exec tsx $SCRATCH/portfolio-checks/chapters.check.ts` → `chapters: ok`
Run: `pnpm tsc` → clean. Run: `pnpm lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/meeting-flow/lib/build-walkthrough-chapters.ts src/features/meeting-flow/lib/walkthrough-position.ts
git commit -m "feat(meeting-flow): portfolio chapters and walkthrough position math

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/lib/build-walkthrough-chapters.ts src/features/meeting-flow/lib/walkthrough-position.ts
```

---

### Task 5: Space through the flow's key owner

**Files:**
- Modify: `src/features/meeting-flow/constants/keyboard-hints.ts`
- Modify: `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (import line 4, ref line 82)

**Interfaces:**
- Consumes: `MeetingStageHandle` (Task 3).
- Produces: `KEY_SHORTCUTS.portfolio = 'Space ArrowUp ArrowDown A Z'`; `ACTIVATABLE_TARGET_SELECTOR`; `useMeetingFlowKeys` accepts `presentationRef: RefObject<MeetingStageHandle | null>`.

- [ ] **Step 1: Constants**

In `keyboard-hints.ts`:

```ts
export const MEETING_FLOW_KEY_HINTS: KeyHint[] = [
  { keys: ['←', '→'], label: 'Previous / next step' },
  { keys: ['↑', '↓', 'A', 'Z'], label: 'Previous / next slide, or project in the portfolio' },
  { keys: ['Space'], label: 'Next photo in the portfolio' },
  { keys: ['1–7'], label: 'Jump to a step' },
  { keys: ['P'], label: 'Present mode on / off' },
  { keys: ['Esc'], label: 'Close the panel, then exit present mode' },
]

export const KEY_SHORTCUTS = {
  prevStep: 'ArrowLeft',
  nextStep: 'ArrowRight',
  present: 'P',
  presentation: 'ArrowUp ArrowDown A Z',
  portfolio: 'Space ArrowUp ArrowDown A Z',
} as const
```

And below `TYPING_TARGET_SELECTOR`:

```ts
/** Controls the browser already activates on Space; the flow must not act on the same press. */
export const ACTIVATABLE_TARGET_SELECTOR = 'button, a[href], summary, [role="button"], [role="link"], [role="tab"]'
```

- [ ] **Step 2: Retype the ref in the view**

`meeting-flow.tsx`: replace `import type { PresentationHandle } from '@/shared/components/presentation/types'` with `MeetingStageHandle` merged into the existing `@/features/meeting-flow/types` import (line 3), and line 82:

```ts
  const presentationRef = useRef<MeetingStageHandle>(null)
```

(`WhoWeAreStep`'s `ref?: Ref<PresentationHandle>` still accepts it — the handle is a superset.)

- [ ] **Step 3: Retype the hook argument**

`use-meeting-flow-keys.ts`: import `MeetingStageHandle` from `@/features/meeting-flow/types` instead of `PresentationHandle`, and:

```ts
  /** `current` is null on page steps; arrows then fall through to the browser. `advance` exists only where Space means something. */
  presentationRef: RefObject<MeetingStageHandle | null>
```

- [ ] **Step 4: Add the Space case (with the focused-control guard)**

Import `ACTIVATABLE_TARGET_SELECTOR` with the other keyboard-hint constants. Add this case to the `switch (key)` block, before `case 'p':`:

```ts
        case ' ': {
          const advance = presentationRef.current?.advance
          // A focused button already clicks on Space; acting here too would move twice.
          if (!advance || target.closest(ACTIVATABLE_TARGET_SELECTOR)) {
            return
          }
          event.preventDefault()
          advance()
          return
        }
```

Held Space never repeats: `' '` is not in `REPEATABLE_KEYS`, so the existing `event.repeat` guard drops repeats.

- [ ] **Step 5: Type-check, lint**

Run: `pnpm tsc` → clean. Run: `pnpm lint` → clean. (Behaviour is exercised in Task 9; until Task 8 no step exposes `advance`, so Space is a no-op everywhere — same as today.)

- [ ] **Step 6: Commit**

```bash
git add src/features/meeting-flow/constants/keyboard-hints.ts src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/ui/views/meeting-flow.tsx
git commit -m "feat(meeting-flow): Space advances a stage that asks for it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/constants/keyboard-hints.ts src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/ui/views/meeting-flow.tsx
```

---

### Task 6: Walkthrough hooks

**Files:**
- Create: `src/features/meeting-flow/hooks/use-portfolio-details.ts`
- Create: `src/features/meeting-flow/hooks/use-portfolio-walkthrough.ts`

**Interfaces:**
- Consumes: `RankedProject`, `WalkthroughChapter`, `WalkthroughPosition` (Task 3); `buildWalkthroughChapters`, `advancePosition`, `isFinalPhoto` (Task 4); `PREFETCH_AHEAD`, `SHOWCASE_PROJECTS_STALE_MS`.
- Produces:

```ts
usePortfolioDetails(queue: RankedProject[], projectIndex: number): UseQueryResult<PortfolioProjectDetail | null>
usePortfolioWalkthrough(queue: RankedProject[]): {
  current: RankedProject | undefined
  chapters: WalkthroughChapter[] | null   // null while the current detail loads
  position: WalkthroughPosition
  finalPhoto: boolean                      // on the current project's last photo
  advance: () => void
  next: () => void
  prev: () => void
  jumpToChapter: (chapterIndex: number) => void
  jumpToPhoto: (photoIndex: number) => void
  jumpToProject: (projectIndex: number) => void
}
```

- [ ] **Step 1: Write `usePortfolioDetails`**

```ts
// src/features/meeting-flow/hooks/use-portfolio-details.ts
'use client'

import type { RankedProject } from '@/features/meeting-flow/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { PREFETCH_AHEAD } from '@/features/meeting-flow/constants/portfolio-walkthrough'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { useTRPC } from '@/trpc/helpers'

/** The detail (phased photos) of the project on stage, with the next few fetched ahead so ↓ never waits. */
export function usePortfolioDetails(queue: RankedProject[], projectIndex: number) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const accessor = queue[projectIndex]?.row.project.accessor

  const detail = useQuery({
    ...trpc.projectsRouter.showroomDisplay.getDetail.queryOptions({ accessor: accessor ?? '' }),
    enabled: accessor !== undefined,
    staleTime: SHOWCASE_PROJECTS_STALE_MS,
  })

  useEffect(() => {
    for (const ahead of queue.slice(projectIndex + 1, projectIndex + 1 + PREFETCH_AHEAD)) {
      void queryClient.prefetchQuery({
        ...trpc.projectsRouter.showroomDisplay.getDetail.queryOptions({ accessor: ahead.row.project.accessor }),
        staleTime: SHOWCASE_PROJECTS_STALE_MS,
      })
    }
  }, [queue, projectIndex, queryClient, trpc])

  return detail
}
```

- [ ] **Step 2: Write `usePortfolioWalkthrough`**

```ts
// src/features/meeting-flow/hooks/use-portfolio-walkthrough.ts
'use client'

import type { RankedProject, WalkthroughPosition } from '@/features/meeting-flow/types'
import { useCallback, useMemo, useState } from 'react'
import { usePortfolioDetails } from '@/features/meeting-flow/hooks/use-portfolio-details'
import { buildWalkthroughChapters } from '@/features/meeting-flow/lib/build-walkthrough-chapters'
import { advancePosition, isFinalPhoto } from '@/features/meeting-flow/lib/walkthrough-position'

interface WalkthroughCursor {
  projectId: string | null
  chapterIndex: number
  photoIndex: number
}

/**
 * Where the walkthrough is. The cursor holds a project id, not a queue index, so a re-rank (selections
 * edited from the panel) keeps the project on stage when it is still in the queue, and falls back to
 * rank 1 when it is not.
 */
export function usePortfolioWalkthrough(queue: RankedProject[]) {
  const [cursor, setCursor] = useState<WalkthroughCursor>({ projectId: null, chapterIndex: 0, photoIndex: 0 })

  const found = cursor.projectId === null ? -1 : queue.findIndex(ranked => ranked.row.project.id === cursor.projectId)
  const projectIndex = Math.max(found, 0)
  const current = queue[projectIndex]
  const detailQuery = usePortfolioDetails(queue, projectIndex)

  // An errored detail is not pending, so it falls through to the stand-in chapter instead of loading forever.
  const chapters = useMemo(
    () => (current && !detailQuery.isPending ? buildWalkthroughChapters(current.row, detailQuery.data ?? null) : null),
    [current, detailQuery.isPending, detailQuery.data],
  )
  const photoCounts = useMemo(() => chapters?.map(chapter => chapter.photos.length) ?? null, [chapters])

  const chapterIndex = found === -1 || !chapters ? 0 : Math.min(cursor.chapterIndex, chapters.length - 1)
  const photoIndex = found === -1 || !chapters ? 0 : Math.min(cursor.photoIndex, chapters[chapterIndex].photos.length - 1)
  const position = useMemo<WalkthroughPosition>(() => ({ projectIndex, chapterIndex, photoIndex }), [projectIndex, chapterIndex, photoIndex])

  const goTo = useCallback((target: WalkthroughPosition) => {
    const ranked = queue[target.projectIndex]
    if (ranked) {
      setCursor({ projectId: ranked.row.project.id, chapterIndex: target.chapterIndex, photoIndex: target.photoIndex })
    }
  }, [queue])

  const advance = useCallback(() => {
    if (photoCounts) {
      goTo(advancePosition(position, photoCounts, queue.length))
    }
  }, [goTo, position, photoCounts, queue.length])

  const jumpToProject = useCallback((index: number) => {
    if (index !== projectIndex) {
      goTo({ projectIndex: index, chapterIndex: 0, photoIndex: 0 })
    }
  }, [goTo, projectIndex])

  const next = useCallback(() => jumpToProject(Math.min(projectIndex + 1, queue.length - 1)), [jumpToProject, projectIndex, queue.length])
  const prev = useCallback(() => jumpToProject(Math.max(projectIndex - 1, 0)), [jumpToProject, projectIndex])
  const jumpToChapter = useCallback((index: number) => goTo({ projectIndex, chapterIndex: index, photoIndex: 0 }), [goTo, projectIndex])
  const jumpToPhoto = useCallback((index: number) => goTo({ projectIndex, chapterIndex, photoIndex: index }), [goTo, projectIndex, chapterIndex])

  return {
    current,
    chapters,
    position,
    finalPhoto: photoCounts !== null && isFinalPhoto(position, photoCounts),
    advance,
    next,
    prev,
    jumpToChapter,
    jumpToPhoto,
    jumpToProject,
  }
}
```

- [ ] **Step 3: Type-check, lint**

Run: `pnpm tsc` → clean. Run: `pnpm lint` → clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/meeting-flow/hooks/use-portfolio-details.ts src/features/meeting-flow/hooks/use-portfolio-walkthrough.ts
git commit -m "feat(meeting-flow): portfolio walkthrough state and detail prefetch

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/hooks/use-portfolio-details.ts src/features/meeting-flow/hooks/use-portfolio-walkthrough.ts
```

---

### Task 7: Stage components

**Files (all new, under `src/features/meeting-flow/ui/components/steps/portfolio/`):**
`stage-photo.tsx`, `project-heading.tsx`, `scope-pills.tsx`, `chapter-caption.tsx`, `chapter-bar.tsx`, `chapter-thumbs.tsx`, `advance-cue.tsx`, `queue-card.tsx`, `queue-list.tsx`, `queue-sheet.tsx`, `ranked-queue.tsx`, `walkthrough-stage.tsx`

**Interfaces:**
- Consumes: Task 3 types/constants/libs, `OptimizedImage` (`@/shared/components/optimized-image`), `getOptimizedSrc` / `getOptimizedSrcSet` (`@/shared/lib/get-optimized-urls`), `SHOWCASE_CROSSFADE`, shadcn `Sheet*`, `Skeleton`, `cn`.
- Produces: the component props below; Task 8 composes them.

Styling rules for every file: presentation tokens (`text-presentation-title|body|label`, `gap|p|m-presentation-tight|group|zone`), `text-white` on the ground, the accent `text-(--presentation-accent)` / `bg-(--presentation-accent)`, tap targets ≥ 44px (`min-h-11`), `focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2`.

- [ ] **Step 1: `stage-photo.tsx`**

```tsx
'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-walkthrough'
import { SHOWCASE_CROSSFADE } from '@/features/meeting-flow/constants/showcase'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/lib/get-optimized-urls'

interface StagePhotoProps {
  file: ProjectMediaFile
  alt: string
  /** The photo Space shows next; fetched now so the crossfade never lands on a blank frame. */
  upcoming: ProjectMediaFile | null
  canAdvance: boolean
  onAdvance: () => void
}

export function StagePhoto({ file, alt, upcoming, canAdvance, onAdvance }: StagePhotoProps) {
  useEffect(() => {
    if (!upcoming) {
      return
    }
    const image = new window.Image()
    image.sizes = '100vw'
    image.srcset = getOptimizedSrcSet(upcoming) ?? ''
    image.src = getOptimizedSrc(upcoming)
  }, [upcoming])

  return (
    <button
      aria-label={PORTFOLIO_COPY.nextPhoto}
      className="absolute inset-0 cursor-pointer outline-none disabled:cursor-default"
      disabled={!canAdvance}
      type="button"
      onClick={onAdvance}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={file.id}
          animate={{ opacity: 1 }}
          className="absolute inset-0"
          exit={{ opacity: 0 }}
          initial={{ opacity: 0 }}
          transition={SHOWCASE_CROSSFADE}
        >
          <OptimizedImage alt={alt} className="object-cover" fill file={file} priority sizes="100vw" />
        </motion.div>
      </AnimatePresence>
    </button>
  )
}
```

- [ ] **Step 2: `scope-pills.tsx` and `project-heading.tsx`**

```tsx
// scope-pills.tsx
interface ScopePillsProps {
  reasons: string[]
}

export function ScopePills({ reasons }: ScopePillsProps) {
  if (reasons.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-wrap gap-presentation-tight">
      {reasons.map(reason => (
        <li key={reason} className="rounded-full bg-(--presentation-accent) px-3 py-1 text-presentation-label font-semibold text-(--presentation-ground)">
          {reason}
        </li>
      ))}
    </ul>
  )
}
```

```tsx
// project-heading.tsx
import type { RankedProject } from '@/features/meeting-flow/types'
import { formatPortfolioMeta } from '@/features/meeting-flow/lib/format-portfolio-meta'
import { ScopePills } from '@/features/meeting-flow/ui/components/steps/portfolio/scope-pills'

interface ProjectHeadingProps {
  ranked: RankedProject
}

export function ProjectHeading({ ranked }: ProjectHeadingProps) {
  const { project } = ranked.row
  return (
    <div className="grid justify-items-start gap-presentation-tight [text-shadow:0_2px_12px_rgb(0_0_0/0.5)]">
      <h2 className="font-sans text-presentation-title leading-[1.05] font-semibold tracking-tight text-balance">{project.title}</h2>
      <p className="text-presentation-label text-white/80">{formatPortfolioMeta(project)}</p>
      <ScopePills reasons={ranked.reasons} />
    </div>
  )
}
```

- [ ] **Step 3: `chapter-caption.tsx` (bounded, scrolls inside itself — Review Focus 4)**

```tsx
import type { StoryLine } from '@/features/meeting-flow/types'

interface ChapterCaptionProps {
  story: StoryLine[]
}

export function ChapterCaption({ story }: ChapterCaptionProps) {
  if (story.length === 0) {
    return null
  }
  return (
    // Long stories scroll here rather than pushing the chapter bar under the capsule.
    <div className="grid max-h-[28cqh] gap-presentation-tight overflow-y-auto overscroll-contain pr-2 [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
      {story.map(line => (
        <p key={line.label} className="text-presentation-body leading-snug text-white">
          <span className="block text-presentation-label font-bold tracking-[0.1em] text-(--presentation-accent) uppercase">{line.label}</span>
          {line.text}
        </p>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: `chapter-bar.tsx`**

```tsx
import type { WalkthroughChapter } from '@/features/meeting-flow/types'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'

interface ChapterBarProps {
  /** Null while the project's photos load. */
  chapters: WalkthroughChapter[] | null
  chapterIndex: number
  photoIndex: number
  onSelect: (chapterIndex: number) => void
}

export function ChapterBar({ chapters, chapterIndex, photoIndex, onSelect }: ChapterBarProps) {
  if (!chapters) {
    return <Skeleton className="h-11 w-full bg-white/10" />
  }
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1.5">
      {chapters.map((chapter, index) => {
        const fill = index < chapterIndex ? 1 : index === chapterIndex ? (photoIndex + 1) / chapter.photos.length : 0
        const active = index === chapterIndex
        return (
          <button
            key={chapter.phase}
            aria-current={active ? 'step' : undefined}
            aria-label={`${chapter.label}, ${chapter.photos.length} ${chapter.photos.length === 1 ? 'photo' : 'photos'}`}
            className={cn(
              'relative min-h-11 overflow-hidden rounded-md bg-white/12 px-3 text-left text-presentation-label font-bold tracking-[0.08em] text-white/80 uppercase',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              active && 'text-white ring-1 ring-white/50',
            )}
            type="button"
            onClick={() => onSelect(index)}
          >
            <span aria-hidden className="absolute inset-0 origin-left bg-(--presentation-accent) transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${fill})` }} />
            <span className={cn('relative', fill === 1 && 'text-(--presentation-ground)')}>{chapter.label}</span>
            <span className="relative ml-1.5 font-semibold tracking-normal normal-case opacity-80">{chapter.photos.length}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: `chapter-thumbs.tsx`**

```tsx
'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import { useEffect, useRef } from 'react'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { cn } from '@/shared/lib/utils'

interface ChapterThumbsProps {
  photos: ProjectMediaFile[]
  photoIndex: number
  chapterLabel: string
  onSelect: (photoIndex: number) => void
}

export function ChapterThumbs({ photos, photoIndex, chapterLabel, onSelect }: ChapterThumbsProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [photoIndex, photos])

  if (photos.length < 2) {
    return null
  }
  return (
    <div className="flex gap-1.5 overflow-x-auto overscroll-contain pb-1">
      {photos.map((photo, index) => (
        <button
          key={photo.id}
          ref={index === photoIndex ? activeRef : undefined}
          aria-current={index === photoIndex ? 'true' : undefined}
          aria-label={`${chapterLabel} photo ${index + 1} of ${photos.length}`}
          className={cn(
            'relative h-12 w-16 shrink-0 overflow-hidden rounded-sm border-2 border-white/30 @5xl/portfolio:h-14 @5xl/portfolio:w-20',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
            index === photoIndex && 'border-white',
          )}
          type="button"
          onClick={() => onSelect(index)}
        >
          <OptimizedImage alt="" className="object-cover" fill file={photo} sizes="80px" />
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 6: `advance-cue.tsx`**

```tsx
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-walkthrough'

interface AdvanceCueProps {
  /** The next project's title on a project's last photo; absent on the opening photo. */
  nextTitle?: string
}

export function AdvanceCue({ nextTitle }: AdvanceCueProps) {
  return (
    <span aria-hidden className="inline-flex w-fit items-center gap-2 rounded-md bg-(--presentation-ground)/80 px-3 py-1.5 text-presentation-label font-semibold text-white backdrop-blur-sm">
      {nextTitle ? `${PORTFOLIO_COPY.nextCue} ${nextTitle}` : PORTFOLIO_COPY.startCue}
      <kbd className="rounded-sm border border-b-2 border-white/40 px-1.5 text-[0.85em] font-semibold">Space</kbd>
    </span>
  )
}
```

- [ ] **Step 7: `queue-card.tsx` and `queue-list.tsx`**

```tsx
// queue-card.tsx
import type { RankedProject } from '@/features/meeting-flow/types'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { cn } from '@/shared/lib/utils'

interface QueueCardProps {
  ranked: RankedProject
  rank: number
  active: boolean
  /** The narrow row: rank and title only. */
  compact?: boolean
  onSelect: () => void
}

export function QueueCard({ ranked, rank, active, compact = false, onSelect }: QueueCardProps) {
  const { project } = ranked.row
  return (
    <button
      aria-current={active ? 'true' : undefined}
      className={cn(
        'grid min-h-11 w-full min-w-0 items-center gap-2.5 rounded-md border border-white/12 bg-[oklch(var(--presentation-scrim)/0.6)] p-1.5 text-left text-white backdrop-blur-md',
        compact ? 'grid-cols-[1fr_auto] px-2.5' : 'grid-cols-[64px_1fr_auto]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        active && 'border-(--presentation-accent) bg-[oklch(var(--presentation-scrim)/0.85)]',
      )}
      type="button"
      onClick={onSelect}
    >
      {!compact && (
        <span className="relative h-[46px] w-16 overflow-hidden rounded-sm">
          <OptimizedImage alt="" className="object-cover" fill file={ranked.row.heroImage} sizes="64px" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-sans text-sm font-bold">{project.title}</span>
        {!compact && ranked.reasons.length > 0 && (
          <span className="block truncate text-xs text-white/70">{ranked.reasons.join(' · ')}</span>
        )}
      </span>
      <span className={cn('grid size-6 place-items-center rounded-full bg-white/15 text-xs font-bold', active && 'bg-(--presentation-accent) text-(--presentation-ground)')}>
        {rank}
      </span>
    </button>
  )
}
```

```tsx
// queue-list.tsx
import type { RankedProject } from '@/features/meeting-flow/types'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-walkthrough'
import { groupQueueSections } from '@/features/meeting-flow/lib/group-queue-sections'
import { QueueCard } from '@/features/meeting-flow/ui/components/steps/portfolio/queue-card'

interface QueueListProps {
  queue: RankedProject[]
  activeIndex: number
  /** Selections exist but nothing matched their scopes or trades. */
  showNoMatchNote: boolean
  onSelect: (index: number) => void
}

export function QueueList({ queue, activeIndex, showNoMatchNote, onSelect }: QueueListProps) {
  return (
    <div className="grid gap-presentation-group">
      {showNoMatchNote && <p className="text-presentation-label text-white/70">{PORTFOLIO_COPY.noMatches}</p>}
      {groupQueueSections(queue).map(section => (
        <section key={section.label} aria-label={section.label} className="grid gap-1.5">
          <h3 className="text-presentation-label font-bold tracking-[0.06em] text-white/70 uppercase">{section.label}</h3>
          {section.items.map(({ ranked, index }) => (
            <QueueCard key={ranked.row.project.id} active={index === activeIndex} rank={index + 1} ranked={ranked} onSelect={() => onSelect(index)} />
          ))}
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: `queue-sheet.tsx` and `ranked-queue.tsx`**

```tsx
// queue-sheet.tsx
'use client'

import type { RankedProject } from '@/features/meeting-flow/types'
import { useState } from 'react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-walkthrough'
import { QueueList } from '@/features/meeting-flow/ui/components/steps/portfolio/queue-list'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'

interface QueueSheetProps {
  queue: RankedProject[]
  activeIndex: number
  showNoMatchNote: boolean
  onSelect: (index: number) => void
}

export function QueueSheet({ queue, activeIndex, showNoMatchNote, onSelect }: QueueSheetProps) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="min-h-11 shrink-0 rounded-md border border-white/35 px-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        {PORTFOLIO_COPY.allProjects(queue.length)}
      </SheetTrigger>
      <SheetContent className="max-h-[80dvh] overflow-y-auto border-white/10 bg-[oklch(var(--presentation-scrim))] p-5 text-white" side="bottom">
        <SheetTitle className="text-white">{PORTFOLIO_COPY.queueTitle}</SheetTitle>
        <QueueList
          activeIndex={activeIndex}
          queue={queue}
          showNoMatchNote={showNoMatchNote}
          onSelect={(index) => {
            onSelect(index)
            setOpen(false)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
```

```tsx
// ranked-queue.tsx
import type { RankedProject } from '@/features/meeting-flow/types'
import { QUEUE_ROW_COUNT } from '@/features/meeting-flow/constants/portfolio-walkthrough'
import { QueueCard } from '@/features/meeting-flow/ui/components/steps/portfolio/queue-card'
import { QueueList } from '@/features/meeting-flow/ui/components/steps/portfolio/queue-list'
import { QueueSheet } from '@/features/meeting-flow/ui/components/steps/portfolio/queue-sheet'

interface RankedQueueProps {
  queue: RankedProject[]
  activeIndex: number
  showNoMatchNote: boolean
  variant: 'column' | 'row'
  onSelect: (index: number) => void
}

export function RankedQueue({ queue, activeIndex, showNoMatchNote, variant, onSelect }: RankedQueueProps) {
  if (variant === 'column') {
    return (
      <div className="max-h-[calc(100cqh-var(--stage-clear-b)-2rem)] overflow-y-auto overscroll-contain pr-1">
        <QueueList activeIndex={activeIndex} queue={queue} showNoMatchNote={showNoMatchNote} onSelect={onSelect} />
      </div>
    )
  }
  const start = Math.max(0, Math.min(activeIndex, queue.length - QUEUE_ROW_COUNT))
  return (
    <div className="flex items-stretch gap-1.5">
      <div className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1.5">
        {queue.slice(start, start + QUEUE_ROW_COUNT).map((ranked, offset) => (
          <QueueCard key={ranked.row.project.id} active={start + offset === activeIndex} compact rank={start + offset + 1} ranked={ranked} onSelect={() => onSelect(start + offset)} />
        ))}
      </div>
      <QueueSheet activeIndex={activeIndex} queue={queue} showNoMatchNote={showNoMatchNote} onSelect={onSelect} />
    </div>
  )
}
```

- [ ] **Step 9: `walkthrough-stage.tsx` (layout only)**

```tsx
import type { ReactNode } from 'react'
import { KEY_SHORTCUTS } from '@/features/meeting-flow/constants/keyboard-hints'

interface WalkthroughStageProps {
  labelledBy: string
  photo: ReactNode
  heading: ReactNode
  queueColumn: ReactNode
  queueRow: ReactNode
  story: ReactNode
  /** Read by screen readers when the project or chapter changes. */
  announcement: string
}

/**
 * The step root. `data-step-root` + `tabIndex={-1}` let the view focus it after a step change, as a
 * page step's region is focused. Overlays pass pointer events through to the photo except on controls.
 */
export function WalkthroughStage({ labelledBy, photo, heading, queueColumn, queueRow, story, announcement }: WalkthroughStageProps) {
  return (
    <div
      aria-keyshortcuts={KEY_SHORTCUTS.portfolio}
      aria-labelledby={labelledBy}
      className="@container/portfolio relative isolate min-h-0 flex-1 overflow-hidden bg-(--presentation-ground) text-white outline-none"
      data-step-root
      role="region"
      tabIndex={-1}
    >
      {photo}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-2/5 bg-linear-to-b from-[oklch(var(--presentation-scrim)/0.7)] to-transparent" />
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-[oklch(var(--presentation-scrim)/0.96)] via-[oklch(var(--presentation-scrim)/0.55)] to-transparent" />
      <div className="pointer-events-none absolute inset-0 flex flex-col gap-presentation-group px-4 pt-5 pb-(--stage-clear-b) @5xl/portfolio:px-7 @5xl/portfolio:pt-6">
        <div className="flex items-start gap-presentation-group">
          <div className="pointer-events-auto min-w-0 flex-1">{heading}</div>
          <div className="pointer-events-auto hidden w-[300px] shrink-0 @5xl/portfolio:block">{queueColumn}</div>
        </div>
        <div className="mt-auto grid gap-presentation-group">
          <div className="pointer-events-auto @5xl/portfolio:hidden">{queueRow}</div>
          <div className="pointer-events-auto grid max-w-[760px] gap-presentation-tight">{story}</div>
        </div>
      </div>
      <p aria-atomic="true" aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  )
}
```

- [ ] **Step 10: Type-check, lint**

Run: `pnpm tsc` → clean. Run: `pnpm lint` (then `pnpm lint:fix` for import/attribute order) → clean.

- [ ] **Step 11: Commit**

```bash
git add src/features/meeting-flow/ui/components/steps/portfolio/
git commit -m "feat(meeting-flow): portfolio walkthrough stage components

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/ui/components/steps/portfolio/
```

---

### Task 8: `PortfolioStep`, wiring, removal of the grid

**Files:**
- Create: `src/features/meeting-flow/ui/components/steps/portfolio/index.tsx`
- Modify: `src/features/meeting-flow/constants/step-config.ts` (portfolio entry)
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (import line 38; presentation branch ~line 320; page branch line 331)
- Delete: `src/features/meeting-flow/ui/components/steps/portfolio-step.tsx`, `src/features/meeting-flow/ui/components/steps/trade-project-grid.tsx`

**Interfaces:**
- Consumes: everything above; `useTradeSelections` (`@/features/meeting-flow/contexts/trade-selections-context`), `useTradeCatalogContext` (`@/features/meeting-flow/contexts/trade-catalog-context`), `ErrorState`, `EmptyState`, `Skeleton`.
- Produces: `PortfolioStep({ labelledBy, ref })` with `ref?: Ref<MeetingStageHandle>`.

- [ ] **Step 1: Write `PortfolioStep`**

```tsx
// src/features/meeting-flow/ui/components/steps/portfolio/index.tsx
'use client'

import type { Ref } from 'react'
import type { MeetingStageHandle } from '@/features/meeting-flow/types'
import { useQuery } from '@tanstack/react-query'
import { useImperativeHandle, useMemo } from 'react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-walkthrough'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { usePortfolioWalkthrough } from '@/features/meeting-flow/hooks/use-portfolio-walkthrough'
import { rankPortfolioProjects } from '@/features/meeting-flow/lib/rank-portfolio-projects'
import { AdvanceCue } from '@/features/meeting-flow/ui/components/steps/portfolio/advance-cue'
import { ChapterBar } from '@/features/meeting-flow/ui/components/steps/portfolio/chapter-bar'
import { ChapterCaption } from '@/features/meeting-flow/ui/components/steps/portfolio/chapter-caption'
import { ChapterThumbs } from '@/features/meeting-flow/ui/components/steps/portfolio/chapter-thumbs'
import { ProjectHeading } from '@/features/meeting-flow/ui/components/steps/portfolio/project-heading'
import { RankedQueue } from '@/features/meeting-flow/ui/components/steps/portfolio/ranked-queue'
import { StagePhoto } from '@/features/meeting-flow/ui/components/steps/portfolio/stage-photo'
import { WalkthroughStage } from '@/features/meeting-flow/ui/components/steps/portfolio/walkthrough-stage'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

interface PortfolioStepProps {
  /** id of the step's visually hidden h1. */
  labelledBy: string
  /** Project and photo navigation for the flow's key map. */
  ref?: Ref<MeetingStageHandle>
}

/**
 * Step 3: one project at a time, told in photo chapters, most relevant to this meeting first. The
 * queue always has a lead — scope matches, then trade matches, then the strongest projects — so the
 * step never opens empty while any project has a photo.
 */
export function PortfolioStep({ labelledBy, ref }: PortfolioStepProps) {
  const trpc = useTRPC()
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const projectsQuery = useQuery({ ...trpc.projectsRouter.showroomDisplay.getAll.queryOptions(), staleTime: SHOWCASE_PROJECTS_STALE_MS })

  const queue = useMemo(
    () => rankPortfolioProjects(projectsQuery.data ?? [], selections, catalog),
    [projectsQuery.data, selections, catalog],
  )
  const walk = usePortfolioWalkthrough(queue)
  const { advance, next, prev } = walk

  useImperativeHandle(ref, () => ({ next, prev, advance }), [next, prev, advance])

  if (projectsQuery.isPending) {
    return (
      <WalkthroughStage
        announcement=""
        heading={<Skeleton className="h-12 w-2/3 bg-white/10" />}
        labelledBy={labelledBy}
        photo={null}
        queueColumn={null}
        queueRow={null}
        story={<Skeleton className="h-11 w-full bg-white/10" />}
      />
    )
  }

  if (projectsQuery.isError) {
    return (
      <WalkthroughStage
        announcement={PORTFOLIO_COPY.errorTitle}
        heading={(
          <ErrorState className="h-auto border-white/15 text-white" title={PORTFOLIO_COPY.errorTitle}>
            <button className="min-h-11 rounded-md border border-white/35 px-3 font-semibold" type="button" onClick={() => void projectsQuery.refetch()}>
              {PORTFOLIO_COPY.retry}
            </button>
          </ErrorState>
        )}
        labelledBy={labelledBy}
        photo={null}
        queueColumn={null}
        queueRow={null}
        story={null}
      />
    )
  }

  const { current, chapters, position, finalPhoto } = walk
  if (!current) {
    return (
      <WalkthroughStage
        announcement={PORTFOLIO_COPY.empty}
        heading={<EmptyState className="h-auto border-white/20 text-white" title={PORTFOLIO_COPY.empty} />}
        labelledBy={labelledBy}
        photo={null}
        queueColumn={null}
        queueRow={null}
        story={null}
      />
    )
  }

  const chapter = chapters?.[position.chapterIndex] ?? null
  const photo = chapter?.photos[position.photoIndex] ?? current.row.heroImage
  const upcoming = chapter?.photos[position.photoIndex + 1]
    ?? chapters?.[position.chapterIndex + 1]?.photos[0]
    ?? queue[position.projectIndex + 1]?.row.heroImage
    ?? null
  const nextProject = queue[position.projectIndex + 1]
  const showNoMatchNote = selections.length > 0 && !queue.some(ranked => ranked.tier === 'scope' || ranked.tier === 'trade')
  const atOpening = position.projectIndex === 0 && position.chapterIndex === 0 && position.photoIndex === 0
  const photoAlt = chapter
    ? `${current.row.project.title} — ${chapter.label} photo ${position.photoIndex + 1} of ${chapter.photos.length}`
    : current.row.project.title
  const queueProps = { queue, activeIndex: position.projectIndex, showNoMatchNote, onSelect: walk.jumpToProject }

  return (
    <WalkthroughStage
      announcement={chapter ? `${current.row.project.title}, ${chapter.label}` : current.row.project.title}
      heading={<ProjectHeading ranked={current} />}
      labelledBy={labelledBy}
      photo={<StagePhoto alt={photoAlt} canAdvance={chapters !== null && !(finalPhoto && !nextProject)} file={photo} upcoming={upcoming} onAdvance={advance} />}
      queueColumn={<RankedQueue {...queueProps} variant="column" />}
      queueRow={<RankedQueue {...queueProps} variant="row" />}
      story={(
        <>
          {chapter && <ChapterCaption story={chapter.story} />}
          {chapters && (atOpening || (finalPhoto && nextProject)) && <AdvanceCue nextTitle={atOpening ? undefined : nextProject?.row.project.title} />}
          <ChapterBar chapterIndex={position.chapterIndex} chapters={chapters} photoIndex={position.photoIndex} onSelect={walk.jumpToChapter} />
          {chapter && <ChapterThumbs chapterLabel={chapter.label} photoIndex={position.photoIndex} photos={chapter.photos} onSelect={walk.jumpToPhoto} />}
        </>
      )}
    />
  )
}
```

Note: `atOpening` and a single-photo first project can coincide with `finalPhoto`; the opening cue wins there (it teaches the key once).

- [ ] **Step 2: Switch the step layout**

`step-config.ts`, portfolio entry: `layout: 'presentation',`.

- [ ] **Step 3: Wire the view**

`meeting-flow.tsx`:
- Line 38: `import { PortfolioStep } from '@/features/meeting-flow/ui/components/steps/portfolio'`
- In the presentation branch, after the Who We Are line:

```tsx
                      {stepConfig.id === 'portfolio' && <PortfolioStep ref={presentationRef} labelledBy={stepTitleId} />}
```

- Delete the page-branch line `{stepConfig.id === 'portfolio' && <PortfolioStep flowContext={flowContext} />}`.

- [ ] **Step 4: Delete the grid step**

```bash
git rm src/features/meeting-flow/ui/components/steps/portfolio-step.tsx src/features/meeting-flow/ui/components/steps/trade-project-grid.tsx
```

Then confirm nothing else imports them: `grep -rn "steps/portfolio-step\|trade-project-grid" src` → no output.

- [ ] **Step 5: Type-check, lint**

Run: `pnpm tsc` → clean. Run: `pnpm lint` → clean.

- [ ] **Step 6: Commit**

```bash
git add src/features/meeting-flow/ui/components/steps/portfolio/index.tsx src/features/meeting-flow/constants/step-config.ts src/features/meeting-flow/ui/views/meeting-flow.tsx
git commit -m "feat(meeting-flow): the portfolio step is a walkthrough on the presentation stage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/ui/components/steps/portfolio/index.tsx src/features/meeting-flow/constants/step-config.ts src/features/meeting-flow/ui/views/meeting-flow.tsx src/features/meeting-flow/ui/components/steps/portfolio-step.tsx src/features/meeting-flow/ui/components/steps/trade-project-grid.tsx
```

---

### Task 9: Browser verification on dev (read-only)

**Files:** none committed unless a fix is needed (fixes go back into the owning file and are committed with a `fix(meeting-flow): …` message by explicit path).

**Setup:** `ss -ltnp | grep 3000` — reuse a running dev server; otherwise `pnpm dev`. Auth via `/api/dev/playwright-session` (memory `reference-playwright-auth.md`). Open a dev meeting at `/dashboard/meetings/<id>?step=3`. **Do not write to the database** — to vary selections, use the meeting's own UI (step 2 / the Project panel), which the owner's fixtures allow; if a meeting cannot be edited without disturbing fixtures, stop and ask the owner which meeting to use.

- [ ] **Step 1: Shape at both sizes, both shells** — 1440×900 and 820×1180, light and dark dashboard theme. Screenshot each. Expect: dark stage, photo full-bleed, heading top-left, queue column at 1440 / row + "All N" at 820, caption → bar → thumbs above the capsule with no overlap.
- [ ] **Step 2: Chapter shapes from the dev fixtures** — walk `eclipse` (Before/During/After/More), `biggal` or `amoria` (During/After), `emmie` (Before/After: "What we did" sits on After), `makaia` (After only), and any no-phase project (More photos only, full story). Jump via the "All N" sheet or the column.
- [ ] **Step 3: Keys** — Space steps photo → chapter → next project; ↓/↑ and Z/A change project; ←/→ still change steps; on Who We Are (step 1) Space does nothing new.
- [ ] **Step 4: Review Focus 1** — Tab to a chapter segment, press Space: it jumps to that chapter once (check the thumbnail strip's active photo is the chapter's first, not the second).
- [ ] **Step 5: Review Focus 4** — at 820, find the project with the longest challenge/solution text; confirm the caption scrolls inside its box and the bar and capsule stay clear.
- [ ] **Step 6: Review Focus 2 and fallbacks** — with selections that match scopes: "For your project" leads with scope pills. With a trade selected whose scopes no project has but whose trade does: trade-name pills. With selections that match nothing: note line + "From our portfolio" (3) + "Other projects". Mid-walkthrough, change selections from the Project panel: the project on stage stays when still queued.
- [ ] **Step 7: Review Focus 5** — jump to the last project, Space through to its last photo: no "Next" cue, Space inert, ↓ inert.
- [ ] **Step 8: Reduced motion** — emulate `prefers-reduced-motion: reduce`; photos swap without fade.
- [ ] **Step 9: Network** — the `showroomDisplay.getAll` response rows carry `phaseCounts`; stepping to project n triggers `getDetail` for n+1..n+2 ahead of navigation.
- [ ] **Step 10: Final gate** — `pnpm tsc && pnpm lint` clean; `git status` shows no stray changes from this work; report screenshots and any fixes to the owner.
