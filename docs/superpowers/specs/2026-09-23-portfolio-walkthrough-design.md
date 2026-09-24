# Portfolio Walkthrough — Design (meeting-flow step 3)

> **Source:** the `/ui-warmup` artifact https://claude.ai/artifact/Bqp9UCTg2Gf5n13zXbx6wM, **Option D "Walkthrough"** (owner's pick, 2026-09-23). The artifact's baseline captures and findings F1–F9 are the "why"; this spec is the "what".
> **Baseline:** `main` at `c8ce1956` (2026-09-23).
> **Status:** brainstormed with the owner 2026-09-23; every ruling below was taken in that session (§6).
> **Constraint:** no schema change, no prod data write. One additive field on a shared DAL read (§4.1), one additive map on the shared catalog index (§4.2).

---

## 1. Why this exists

Step 3 today (`src/features/meeting-flow/ui/components/steps/portfolio-step.tsx`) is the marketing portfolio grid dropped into the meeting: ten equal cards, pagination above and below, the story hidden behind hover, a tap that leaves the meeting, a light admin page between two dark presentation steps. When step 2 has no matching scopes it opens straight on the full grid. The sales playbook asks for two or three relevant homes, each told as "same issue → what we did → what they got".

D turns that sentence into the interface: one project at a time, the photo filling the stage, its photos told in chapters (Before · During · After · More photos) the agent taps through, and a ranked queue that says why each next project fits this customer.

## 2. Scope

**In:** D as mocked, with the owner's rulings (§6): the walkthrough stage, the chapter model, the three-tier ranking with fallback, the queue (column / row + sheet), the Space key, `phaseCounts` on portfolio rows, `tradeIdByScope` on the catalog index. No data writes in any environment (W12).

**Out (named so nobody builds them by accident):** distance ("4 mi from you") — no coordinates exist (0 of 788 customers geocoded; 8 of 43 public projects have a zip); profile echoes ("single-pane windows, like yours") — projects carry no property attributes; E's before/after slider; a Shift+Space back key; persisting the walkthrough position to flow state; testimonials (no field); any link to the marketing site.

**Data facts this design rests on (prod, 2026-09-23):** 43 public projects, all with a hero. Photo phases: 9 have Before + During + After, 10 During + After, 2 Before + After, 1 After only, 21 none (hero + uncategorized only). Story text: challenge/solution/result filled on 38/38/37; `before/during/afterDescription` filled on 0. Dev (`development` branch): 39 public projects; 6 Before + During + After, 8 During + After, 2 Before + After, 1 After only, 22 none.

## 3. Target structure

```
src/shared/modules/construction/core/lib/
  build-catalog-index.ts            CatalogIndex gains tradeIdByScope                              (§4.2)

src/shared/modules/projects/core/
  types.ts                          PortfolioProject gains phaseCounts: Record<MediaPhase, number> (§4.1)
  dal/server/queries.ts             getPortfolioProjects: one grouped phase-count query           (§4.1)
  lib/count-media-phases.ts         NEW: how many of before/during/after have photos             (§4.1)

src/shared/components/presentation/ untouched

src/features/meeting-flow/
  constants/step-config.ts          portfolio: layout 'page' → 'presentation'
  constants/keyboard-hints.ts       KEY_SHORTCUTS.portfolio
  constants/portfolio-walkthrough.ts NEW: chapter + story labels, section labels, FALLBACK_LEAD_COUNT = 3,
                                    PREFETCH_AHEAD = 2, QUEUE_ROW_COUNT = 3
  types/index.ts                    MeetingStageHandle, WalkthroughChapter, RankedProject, RankTier
  hooks/use-meeting-flow-keys.ts    Space → handle.advance                                        (§4.4)
  hooks/use-portfolio-walkthrough.ts NEW: position state machine                                   (§4.5)
  hooks/use-portfolio-details.ts    NEW: getDetail for current + next PREFETCH_AHEAD               (§4.6)
  lib/index-showcase-projects.ts    takes tradeIdByScope instead of rebuilding it                  (§4.2)
  hooks/use-showcase-projects.ts    passes tradeIdByScope through                                 (§4.2)
  contexts/trade-selection-provider.tsx  useShowcaseProjects(catalog.tradeIdByScope)              (§4.2)
  lib/rank-portfolio-projects.ts    NEW: three tiers + fallback                                    (§4.3)
  lib/build-walkthrough-chapters.ts NEW: detail → chapters with photos and story lines             (§4.5)
  ui/views/meeting-flow.tsx         presentationRef: MeetingStageHandle; portfolio in the presentation branch
  ui/components/steps/portfolio-step.tsx     DELETED
  ui/components/steps/trade-project-grid.tsx DELETED
  ui/components/steps/portfolio/    NEW, one component per file:
    index.tsx            PortfolioStep: contexts + ranking + hooks; useImperativeHandle
    walkthrough-stage.tsx  layout only (container queries)
    stage-photo.tsx        full-bleed photo, crossfade, tap → advance
    project-heading.tsx    trade · title · city/duration · pills
    scope-pills.tsx        why-pills for the scope / trade tiers
    chapter-caption.tsx    the chapter's story lines
    chapter-bar.tsx        chapter segments, fill per photo, tap → jump
    chapter-thumbs.tsx     current chapter's thumbnails
    advance-cue.tsx        "Tap or press Space" on the first photo; "Next: <title>" on a project's last photo
    ranked-queue.tsx       section-labelled list (column) / next-3 row + "All N"
    queue-card.tsx         thumbnail, rank, title, why-line
    queue-sheet.tsx        the full ranked list in a bottom Sheet (narrow container)
```

`PortfolioGrid`, `PortfolioPagination` and `usePortfolioFilters` in `features/project-management` stay: the portfolio page still uses them.

## 4. Contracts

### 4.1 `phaseCounts` on portfolio rows (shared projects module)

- `PortfolioProject` (`modules/projects/core/types.ts`) gains `phaseCounts: Record<MediaPhase, number>`, `MediaPhase` from `@/shared/constants/enums/media`.
- `getPortfolioProjects` (`modules/projects/core/dal/server/queries.ts`) adds one grouped query after the unique rows are known, shaped like `getProjectScopeCountsByScopeIds` in the same file: `select({ projectId, phase, count() })` from `projectMediaFiles`, `inArray(projectId, uniqueIds)`, `mimeType not like 'video/%'` (the same video exclusion `getPortfolioProjectDetail` applies), `groupBy(projectId, phase)`. Every row gets all four keys; a project with no media gets zeros.
- `countMediaPhases(phaseCounts): number` in `modules/projects/core/lib/count-media-phases.ts` — how many of `before`, `during`, `after` are non-zero (0–3). It is the completeness score; `uncategorized` does not count.
- The router (`showroomDisplay.getAll`) is unchanged; its type follows the DAL. Other consumers (`use-showcase-projects`, `portfolio-grid-view`, `funnel-project-carousel`, `portfolio-block`) ignore the new field.

### 4.2 `tradeIdByScope` on the catalog index (shared construction module)

- `CatalogIndex` (`modules/construction/core/lib/build-catalog-index.ts`) gains `tradeIdByScope: ReadonlyMap<string, string>`, filled in the existing loop from `scope.tradeId` (scopes and add-ons alike). `ConstructionCatalog` inherits it.
- `indexShowcaseProjects` uses `scopesByTrade` only to build that same map inline (`index-showcase-projects.ts:7-12`). Its second parameter becomes `tradeIdByScope: ReadonlyMap<string, string>`; `useShowcaseProjects(tradeIdByScope)` and its call in `TradeSelectionProvider` (`useShowcaseProjects(catalog.tradeIdByScope)`) follow, and the hook's stable-identity note now names `tradeIdByScope` (memoized in `useConstructionCatalog` with the rest of the index). Behaviour unchanged. One map, one builder.

### 4.3 Ranking — `rankPortfolioProjects` (feature)

`rankPortfolioProjects(projects: PortfolioProject[], selections: TradeSelection[], catalog: CatalogIndex): RankedProject[]` — pure, in `features/meeting-flow/lib/`.

```ts
type RankTier = 'scope' | 'trade' | 'featured' | 'other'
interface RankedProject {
  row: PortfolioProject
  tier: RankTier
  matchedScopeIds: string[]   // tier 'scope'
  matchedTradeIds: string[]   // tiers 'scope' and 'trade'
}
```

Only rows with a `heroImage` are ranked (the showcase index applies the same rule). Each row lands in exactly one tier:

| Tier | Membership | Sort | Pills / why-line |
|---|---|---|---|
| `scope` | shares ≥1 id with the union of `selection.selectedScopes[].id` | matched-scope count desc → `countMediaPhases` desc → total phased photos desc → title | matched scope labels |
| `trade` | not `scope`; ≥1 of its `scopeIds` maps through `catalog.tradeIdByScope` to a selected `tradeId` (a trade selected with zero scopes counts) | scopes in selected trades desc → completeness → phased photos → title | trade name(s) from `catalog.tradesById` |
| `featured` | only when `scope` and `trade` are both empty: the first `FALLBACK_LEAD_COUNT` (3) rows by completeness → phased photos → title | — | none |
| `other` | everything else | completeness → phased photos → title | none |

The returned array is the queue, in order: `scope`, `trade`, `featured`, `other`. Rank numbers are positions in it. With no selections, the queue opens on `featured`. The step therefore always opens on a project whenever any project has a hero.

Section labels in the queue (constants): `scope` + `trade` → "For your project"; `featured` → "From our portfolio"; `other` → "Other projects". When selections exist but `scope` and `trade` are empty, one quiet line sits above "From our portfolio": "No finished projects match these scopes yet."

### 4.4 Keyboard — one owner, one new key

- `MeetingStageHandle = PresentationHandle & { advance?: () => void }` in `features/meeting-flow/types`. The shared engine's `PresentationHandle` is untouched. `presentationRef` in `meeting-flow.tsx` and the `presentationRef` argument of `useMeetingFlowKeys` take the new type.
- `useMeetingFlowKeys` gains a `' '` case: when `presentationRef.current?.advance` exists, `preventDefault()` and call it; otherwise fall through (Who We Are and page steps unchanged). The case returns early when the target is inside `button, a, [role="button"]` — a focused button already fires `click` on Space, so without the guard one press would advance twice. The existing typing-target, modifier, composing and repeat guards apply as they do to every key.
- ↓/↑ and Z/A keep calling `next`/`prev`, which on this step mean next / previous project. ←/→ remain the flow's step keys.
- `KEY_SHORTCUTS.portfolio` (constants/keyboard-hints.ts) lists Space, ArrowUp, ArrowDown, A, Z for the stage root's `aria-keyshortcuts`.

### 4.5 Chapters and the walkthrough state

`buildWalkthroughChapters(detail: PortfolioProjectDetail, row: PortfolioProject): WalkthroughChapter[]` — pure, in `features/meeting-flow/lib/`.

```ts
interface WalkthroughChapter {
  phase: MediaPhase                   // 'before' | 'during' | 'after' | 'uncategorized'
  label: string                       // Before · During · After · More photos
  photos: ProjectMediaFile[]
  story: { label: string, text: string }[]   // 0–3 lines, in story order
}
```

- **Order:** before, during, after, uncategorized. **A chapter with no photos is dropped.**
- **Photos:** `detail.media[phase]` in the DAL's order (`sortOrder` asc, `createdAt` desc); the hero, when it is in that chapter, is moved first.
- **Story lines:** "The situation" = `beforeDescription ?? challengeDescription` → home chapter `before`; "What we did" = `duringDescription ?? solutionDescription` → `during`; "The result" = `afterDescription ?? resultDescription` → `after`. Empty / whitespace text is skipped. A line whose home chapter was dropped moves to the **next** chapter that exists in order, or the **previous** one when none follows. So Before + After + More → "What we did" joins After; a hero-and-uncategorized-only project stacks all three lines on More photos.
- **Degenerate detail** (`null`, error, or zero chapters): one synthetic chapter — the row's `heroImage` as its only photo, all story lines, label "The project".

`usePortfolioWalkthrough(queue: RankedProject[])` holds `{ projectIndex, chapterIndex, photoIndex }` and exposes:

- `advance()` — next photo; at a chapter's last photo, the next chapter's first; at the project's last photo, the next project (chapter 0, photo 0); at the queue's last photo, nothing. Inert while the current project's detail is pending.
- `next()` / `prev()` — project ±1, position reset; clamped at the ends.
- `jumpToChapter(i)`, `jumpToPhoto(i)`, `jumpToProject(i)`.
- **Re-rank while on the step** (selections edited from the panel): keep the current project if it is still in the queue (by `project.id`), at its current position; otherwise go to rank 1.
- Leaving and re-entering step 3 starts at rank 1 (state is component-local).

`PortfolioStep` exposes `useImperativeHandle(ref, () => ({ next, prev, advance }))`.

### 4.6 Data access

- **List:** `showroomDisplay.getAll` with `staleTime: SHOWCASE_PROJECTS_STALE_MS` (the showcase already warms this query in step 2).
- **Catalog + selections:** `useTradeCatalogContext().catalog` and `useTradeSelections()` — the step takes no props besides `ref`.
- **Detail:** `usePortfolioDetails(queue, projectIndex)` queries `showroomDisplay.getDetail({ accessor })` for the current project and prefetches the next `PREFETCH_AHEAD` (2) via the query client. No other detail loads until navigated to.
- **Images:** `OptimizedImage`, `object-cover`. The current photo loads eagerly; the next photo in walkthrough order is preloaded so Space never lands on an empty frame.

### 4.7 Layout (container queries on `@container/portfolio`)

- Stage root: `relative h-full` on `bg-(--presentation-ground)`, `data-step-root`, `role="region"` labelled by the step's sr-only h1, `aria-keyshortcuts`. Presentation tokens only: `text-presentation-title` (project title), `-body` (captions), `-label` (chapter / queue / pill labels), `spacing-presentation-{tight,group,zone}`. Scrims: `oklch(var(--presentation-scrim) / α)`, one from the top behind the heading, one from the bottom behind caption + bar.
- Everything anchored to the bottom keeps clear of the capsule with `var(--stage-clear-b)`, the value Who We Are hands the engine.
- **Wide (≥ ~1100px container):** photo full-bleed; heading top-left; queue top-right, ~300px column, own scroll, section-labelled, cards with thumbnail + rank + title + why-line; bottom-left block max ~760px: caption → chapter bar → thumbnails.
- **Narrow (820 tablet):** heading top; queue as a row of the next `QUEUE_ROW_COUNT` (3) cards (title + rank) plus an "All N" button opening `queue-sheet.tsx` (shadcn Sheet, bottom), sitting above the caption / bar block; thumbnails scroll horizontally.
- **Motion:** ~400ms crossfade on the shared ease; the flow's root `MotionConfig reducedMotion="user"` turns it into a swap. Chapter-bar fill animates with the same rule.
- **Accessibility:** photo `alt` = "<title> — <chapter> photo n of m"; chapter segments and thumbnails are `button`s with `aria-current`; one polite live region announces project and chapter changes; targets ≥ 44px; focus rings visible on the dark ground.

### 4.8 States

| State | Stage shows |
|---|---|
| `getAll` pending | ground + skeleton heading and bar (no light `LoadingState` card) |
| `getAll` error | `ErrorState` on the ground with retry; ←/→ still leave the step |
| no row has a hero | empty state "No portfolio projects to show yet" |
| detail pending | the row's hero, heading, pills; bar as skeleton; `advance` inert |
| detail null / error | the synthetic "The project" chapter (§4.5) |
| single-photo chapter | no thumbnail strip |
| last photo of the last project | no "Next" cue; Space does nothing |

## 5. Verification

- **Pure functions:** `rankPortfolioProjects` — scope beats trade; a zero-scope trade selection still yields trade-tier rows; no scope/trade hits → exactly 3 `featured` then `other`; no selections → `featured` first; hero-less rows excluded; tie-break order. `buildWalkthroughChapters` — all four phases; hero-only; Before + After + More; empty story fields; hero moved first; null detail. The repo has no test runner (`package.json` has none, no `*.test.ts`), so the plan either adds one with owner approval or checks these cases with a scratch script; decided at plan review.
- `pnpm tsc && pnpm lint` clean at every commit.
- **No data writes, dev included.** Dev already covers every chapter shape: all three phases (eclipse, picasso, sunrise, tableau, travertine, juanita-szalony-fontana-bg6eje), During + After (amoria, biggal, fulcrum, paragon, quartzite, solstice, volute, larry-merritt-los-angeles-xvhcfr), Before + After (emmie, meridian), After only (makaia), and 22 with no phases.
- **Playwright on dev**, 1440×900 and 820×1180, light and dark shell: 0 / 1 / 2 selected trades; selections with scope matches, trade-only matches, and no matches (featured fallback); Space through a full project into the next; ↓/↑; chapter and thumbnail taps; "All N" sheet at 820; bottom block clear of the capsule; reduced motion.

## 6. Decisions taken in this session (owner, 2026-09-23)

| # | Decision |
|---|---|
| W1 | Build D. Why-pills are matched scopes / trade only. |
| W2 | Distance dropped for v1 (no coordinates); a later geocoding sub-project if wanted. |
| W3 | Profile echoes dropped for v1; projects would need property tags first. |
| W4 | Empty phases are hidden; a fourth "More photos" chapter holds uncategorized photos so every photo of a project is reachable. |
| W5 | Space / tap advances photo by photo, rolling into the next chapter and then the next project. |
| W6 | Queue = one ranked list with section labels; nothing is unreachable in-meeting. |
| W7 | Wiring approach A: `layout: 'presentation'` + a stage handle through the flow's single key owner. |
| W8 | `phaseCounts` on `getPortfolioProjects`, following the DAL's grouped-count pattern. |
| W9 | Relevance falls back scope → trade → first `FALLBACK_LEAD_COUNT` projects; the ranking rules live in the feature, on shared primitives (`CatalogIndex.tradeIdByScope`, `countMediaPhases`, `PortfolioProject.phaseCounts`). |
| W10 | `indexShowcaseProjects` moves onto `tradeIdByScope` in the same change. |
| W11 | Story text: `before/during/afterDescription` when present, else challenge / solution / result. |
| W12 | No database writes, dev included — dev projects are the owner's visual fixtures, and they already cover every chapter shape (§5). |

## 7. Follow-ups — not in this spec

- Distance: geocode customer addresses and project cities, then a distance pill and tie-break.
- Profile echoes: project property attributes in the project editor, then exact-match pills.
- E's before/after reveal as the After chapter's treatment when a project has both phases.
- Fill `before/during/afterDescription` for the projects that have phased photos (content work).
