# Portfolio Step and the Project Story — Design (meeting-flow step 3)

> **Source:** the `/ui-warmup` artifact https://claude.ai/artifact/Bqp9UCTg2Gf5n13zXbx6wM, **Option D** (owner's pick, 2026-09-23). "D · Walkthrough" was that artifact's option label; it is not a domain or code term. The artifact's baseline captures and findings F1–F9 are the "why"; this spec is the "what".
> **Baseline:** `main` at `c8ce1956` (2026-09-23).
> **Status:** brainstormed with the owner 2026-09-23; every ruling is in §7. Vocabulary agreed 2026-09-23 (§2) and recorded in `CONTEXT.md` as part of the build.
> **Constraint:** no data writes in any environment. One schema change: four empty `projects` columns are dropped (§5.3); dev gets `pnpm db:push:dev`, prod is the owner's push.

---

## 1. Why this exists

Step 3 today (`src/features/meeting-flow/ui/components/steps/portfolio-step.tsx`) is the marketing portfolio grid dropped into the meeting: ten equal cards, pagination above and below, the story hidden behind hover, a tap that leaves the meeting, a light admin page between two dark presentation steps. When step 2 has no matching scopes it opens straight on the full grid. The sales playbook asks for two or three relevant homes, each told as "same issue → what we did → what they got".

Option D turns that sentence into the step: one project at a time, its photo filling the step, its **project story** told phase by phase (Before · During · After · Gallery) as the agent taps through, and a list that says why each next project fits this customer.

The same work settles how every surface tells a project: **challenge → solution → result** is the project story, told against the media phases. The unused per-phase caption fields are retired.

## 2. Vocabulary (agreed 2026-09-23; added to `CONTEXT.md`)

| Term | Meaning | Code |
|---|---|---|
| **Project story** | challenge → solution → result — the one way a project is told, on every surface. | `challengeDescription`, `solutionDescription`, `resultDescription`; parts typed `ProjectStoryPart` |
| **Media phase** (existing) | before · during · after · uncategorized. Uncategorized is labelled "Gallery". | `MediaPhase`, `PHASE_LABELS` |
| **Story phase** | A media phase that has photos, with the story told against it: challenge → Before, solution → During, result → After. A part whose phase has no photos joins the next phase that has photos, else the last one. With no media loaded, the hero stands in as the only story phase. | `ProjectStoryPhase`, `buildProjectStoryPhases()` |
| **Portfolio match** | Why a project is shown for this meeting: `scope` (shares a selected scope), `trade` (in a selected trade), `fallback` (the strongest few when nothing matches), `none`. | `PortfolioMatch`, `PortfolioMatchKind`, `matchPortfolioProjects()` |
| **Match labels** | The pills: matched scope names, or the trade name. | `PortfolioMatch.matchLabels` |
| **Step handle** | What a presentation-layout meeting step exposes to the flow's key map: `next`, `prev`, and optional `advance` (the Space key). | `MeetingStepHandle` |

Words not used: walkthrough, chapter (CONTEXT.md avoids it), stage (CONTEXT.md avoids it), queue, tier, featured, cursor, beat.

## 3. Scope

**In:** the portfolio step (D) with the owner's rulings (§7); the project story standard and its helper in `modules/projects`; `PHASE_LABELS` moved into `modules/projects`; retirement of `before/during/after/mainDescription`; `phaseCounts` on portfolio list rows; `tradeIdByScope` on the catalog index; `CONTEXT.md` entries.

**Out:** distance (no coordinates: 0 of 788 customers geocoded; 8 of 43 public projects have a zip); profile echoes (projects carry no property attributes); a before/after slider; a Shift+Space back key; persisting the step's position to flow state; testimonials; any link to the marketing site; **the public project page adopting `buildProjectStoryPhases`** (owner: later — this work only removes the retired fields from its timeline).

**Data facts (2026-09-23, read-only):**
- `production`: 43 public projects, all with a hero. Photo phases: 9 Before + During + After, 10 During + After, 2 Before + After, 1 After only, 21 none. Challenge / solution / result filled on 38 / 38 / 37. `before/during/after/mainDescription` filled on 0.
- `development`: 39 public projects. 6 Before + During + After (eclipse, picasso, sunrise, tableau, travertine, juanita-szalony-fontana-bg6eje), 8 During + After (amoria, biggal, fulcrum, paragon, quartzite, solstice, volute, larry-merritt-los-angeles-xvhcfr), 2 Before + After (emmie, meridian), 1 After only (makaia), 22 none. Phase texts filled on 0 of 48 projects.

## 4. Target structure

```
src/shared/modules/projects/core/
  types.ts                         MediaPhaseCounts; PortfolioProject.phaseCounts;
                                   ProjectStoryPart, ProjectStoryLine, ProjectStoryPhase
  constants/phase-labels.ts        MOVED from features/project-management/constants/phase-labels.ts
  constants/project-story.ts       NEW: STORY_PHASE_ORDER, STORY_PART_PHASE, STORY_LABELS, HERO_STORY_PHASE_LABEL
  lib/build-project-story-phases.ts NEW
  lib/count-media-phases.ts        NEW
  dal/server/queries.ts            getPortfolioProjects adds phaseCounts
  schemas/index.ts                 phase-text fields removed from the form schema + defaults

src/shared/db/schema/projects.ts   before/during/after/mainDescription columns dropped
src/shared/modules/construction/core/lib/build-catalog-index.ts   CatalogIndex.tradeIdByScope

src/features/project-management/
  constants/phase-labels.ts        DELETED (moved)
  ui/components/story-gallery.tsx  imports PHASE_LABELS from modules/projects
  ui/components/story-timeline.tsx reads no phase text; PHASE_CONFIG's generic lines only
  ui/components/form/story-content-fields.tsx  "Timeline Phase Descriptions" section removed
  ui/views/edit-project-view.tsx   four fields removed from the form values

src/features/meeting-flow/
  types/index.ts                   MeetingStepHandle, PortfolioRowWithHero, PortfolioMatchKind, PortfolioMatch,
                                   PortfolioMatchSection, PortfolioPosition
  constants/portfolio-step.ts      NEW: section labels, copy, FALLBACK_MATCH_COUNT, PREFETCH_AHEAD, PROJECT_LIST_ROW_COUNT
  constants/step-config.ts         portfolio: layout 'page' → 'presentation'
  constants/keyboard-hints.ts      Space hint, KEY_SHORTCUTS.portfolio, ACTIVATABLE_TARGET_SELECTOR
  lib/match-portfolio-projects.ts  NEW
  lib/group-portfolio-matches.ts   NEW: matches → labelled list sections
  lib/format-portfolio-meta.ts     NEW: "City, ST · 6 weeks"
  lib/portfolio-position.ts        NEW: nextPhotoPosition, isLastPhoto
  lib/index-showcase-projects.ts   takes tradeIdByScope
  hooks/use-showcase-projects.ts   passes tradeIdByScope
  contexts/trade-selection-provider.tsx  useShowcaseProjects(catalog.tradeIdByScope)
  hooks/use-meeting-flow-keys.ts   Space → handle.advance
  hooks/use-portfolio-project-detail.ts  NEW: current project's detail + prefetch ahead
  hooks/use-portfolio-navigation.ts      NEW: position state + actions
  ui/views/meeting-flow.tsx        ref: MeetingStepHandle; portfolio in the presentation branch
  ui/components/steps/portfolio-step.tsx       DELETED
  ui/components/steps/trade-project-grid.tsx   DELETED
  ui/components/steps/portfolio/   NEW, one component per file:
    index.tsx               PortfolioStep
    portfolio-step-layout.tsx  the step root; container-query layout
    project-photo.tsx       full-bleed photo, crossfade, tap = advance
    project-heading.tsx     title · city/duration · match pills
    match-pills.tsx
    story-lines.tsx         the story phase's lines
    story-phase-bar.tsx     one segment per story phase, fill per photo, tap = jump
    story-phase-photos.tsx  thumbnails of the current story phase
    space-cue.tsx           "Tap or press Space" / "Next: <title>"
    project-list.tsx        sectioned list (wide column; inside the sheet)
    project-list-card.tsx
    project-list-row.tsx    narrow: the next PROJECT_LIST_ROW_COUNT cards + "All N"
    project-list-sheet.tsx  the full list in a bottom Sheet

CONTEXT.md                         "Project story" section; Presentation terms line updated (§5.9)
```

`PortfolioGrid`, `PortfolioPagination`, `usePortfolioFilters` stay in `features/project-management` (the portfolio page uses them).

## 5. Contracts

### 5.1 `phaseCounts` on portfolio list rows

- `PortfolioProject` gains `phaseCounts: MediaPhaseCounts` (`= Record<MediaPhase, number>`).
- `getPortfolioProjects` adds one grouped query shaped like `getProjectScopeCountsByScopeIds` in the same file: `projectId`, `phase`, `count()` from `projectMediaFiles`, `inArray(projectId, ids)`, videos excluded (`mimeType not like 'video/%'`, as `getPortfolioProjectDetail` does), grouped by project and phase. Missing phases are 0.
- `countMediaPhases(phaseCounts)` — how many of before / during / after have photos (0–3); uncategorized never counts.
- Router unchanged; other consumers ignore the field.

### 5.2 The project story (`modules/projects`)

```ts
type ProjectStoryPart = 'challenge' | 'solution' | 'result'
interface ProjectStoryLine { part: ProjectStoryPart, label: string, text: string }
interface ProjectStoryPhase { phase: MediaPhase | 'hero', label: string, photos: ProjectMediaFile[], story: ProjectStoryLine[] }

buildProjectStoryPhases(input: {
  project: Pick<Project, 'challengeDescription' | 'solutionDescription' | 'resultDescription'>
  heroImage: ProjectMediaFile
  media: ProjectMediaGroups | null
}): ProjectStoryPhase[]
```

- Constants (`constants/project-story.ts`): `STORY_PHASE_ORDER = ['before', 'during', 'after', 'uncategorized']`; `STORY_PART_PHASE = { challenge: 'before', solution: 'during', result: 'after' }`; `STORY_LABELS = { challenge: 'Challenge', solution: 'Solution', result: 'Result' }` (the editor's labels); `HERO_STORY_PHASE_LABEL = 'The project'`.
- Phase labels come from `PHASE_LABELS` (moved to `modules/projects/core/constants/phase-labels.ts`; Before, During, After, Gallery).
- A story phase exists for each media phase with ≥1 photo, in `STORY_PHASE_ORDER`. Photos keep the DAL order; the hero, when in that phase, moves first.
- Story parts with blank text (null or whitespace) are skipped. Each remaining part goes to its phase (`STORY_PART_PHASE`); if that phase has no story phase, to the next story phase in order, else the last one.
- `media === null`, or no story phase at all: one story phase `{ phase: 'hero', label: HERO_STORY_PHASE_LABEL, photos: [heroImage], story: all parts }`.

### 5.3 Retiring the phase text

`beforeDescription`, `duringDescription`, `afterDescription`, `mainDescription` are removed in one non-defensive change: the Drizzle columns (`db/schema/projects.ts`), the form schema and defaults (`modules/projects/core/schemas`), `edit-project-view.tsx`, the editor's "Timeline Phase Descriptions" section (`story-content-fields.tsx`), and `StoryTimeline`'s description map (it shows `PHASE_CONFIG.fallbackDescription` only). Empty on both branches, so nothing is lost. Dev: `pnpm db:push:dev` (schema only). Prod: `pnpm db:push:prod`, run by the owner. The untracked owner script `scripts/tmp-smoke-scopes-persist.ts` reads these fields and is type-checked; the build stops and asks the owner what to do with it.

### 5.4 `tradeIdByScope` on the catalog index

`CatalogIndex` gains `tradeIdByScope: ReadonlyMap<string, string>` (scope and add-on id → trade id), built in `buildCatalogIndex`'s existing loop. `indexShowcaseProjects` used `scopesByTrade` only to rebuild this map inline; it now takes `tradeIdByScope`, and `useShowcaseProjects(catalog.tradeIdByScope)` follows.

### 5.5 Portfolio matches (`features/meeting-flow`)

```ts
type PortfolioMatchKind = 'scope' | 'trade' | 'fallback' | 'none'
interface PortfolioMatch {
  row: PortfolioRowWithHero        // PortfolioProject with a non-null heroImage
  kind: PortfolioMatchKind
  matchedScopeIds: string[]
  matchedTradeIds: string[]
  matchLabels: string[]
}
matchPortfolioProjects(projects: PortfolioProject[], selections: TradeSelection[], catalog: Pick<CatalogIndex, 'tradeIdByScope'>): PortfolioMatch[]
```

Rows without a hero are left out. Each row gets one kind; the result is ordered `scope`, `trade`, `fallback`, `none`:

| Kind | Membership | Order | Match labels |
|---|---|---|---|
| `scope` | shares ≥1 selected scope id | matched-scope count ↓, then story strength | matched scope labels (from `selectedScopes[].label`) |
| `trade` | not `scope`; ≥1 scope maps via `tradeIdByScope` to a selected trade (a trade selected with no scopes counts) | scopes in selected trades ↓, then story strength | trade names (from `tradeName`) |
| `fallback` | only when `scope` and `trade` are both empty: the first `FALLBACK_MATCH_COUNT` (3) by story strength | story strength | none |
| `none` | the rest | story strength | none |

Story strength = `countMediaPhases` ↓ → before + during + after photo count ↓ → title.

List section labels: `scope` and `trade` → "For your project"; `fallback` → "From our portfolio"; `none` → "Other projects". When selections exist but `scope` and `trade` are empty, one line above the list: "No finished projects match these scopes yet." The step opens on the first match whenever any project has a hero.

### 5.6 Keyboard

- `MeetingStepHandle = PresentationHandle & { advance?: () => void }` (meeting-flow `types/`); the engine's `PresentationHandle` is untouched. The view's `presentationRef` and `useMeetingFlowKeys` take it.
- `useMeetingFlowKeys` gains `' '`: when the handle has `advance`, `preventDefault()` and call it — unless the target is inside `ACTIVATABLE_TARGET_SELECTOR` (`button, a[href], summary, [role="button"], [role="link"], [role="tab"]`), where Space already clicks. Existing guards (typing targets, modifiers, composing, repeat) apply.
- ↓/↑ and Z/A call `next`/`prev` = next / previous project. ←/→ stay the flow's step keys.
- `KEY_SHORTCUTS.portfolio = 'Space ArrowUp ArrowDown A Z'`; the key-hint list gains Space.

### 5.7 Navigation state

`usePortfolioNavigation(matches)` holds `{ projectId, phaseIndex, photoIndex }` — a project id, not an index, so a re-match (selections edited from the panel) keeps the project on screen while it is still listed, else returns to the first match. It exposes `current`, `storyPhases` (null while the current detail loads), `position: PortfolioPosition { projectIndex, phaseIndex, photoIndex }`, `lastPhoto`, and `advance` (next photo → next story phase → next project; nothing after the last photo of the last project; inert while loading), `next`, `prev` (clamped), `jumpToPhase`, `jumpToPhoto`, `jumpToProject`. Leaving and re-entering the step starts at the first match.

`usePortfolioProjectDetail(matches, projectIndex)` queries `showroomDisplay.getDetail({ accessor })` for the current project and prefetches the next `PREFETCH_AHEAD` (2). An errored detail is not pending, so the step falls back to the hero story phase rather than loading forever.

`PortfolioStep` exposes `useImperativeHandle(ref, () => ({ next, prev, advance }))`.

### 5.8 Layout, states, accessibility

- Step root (`portfolio-step-layout.tsx`): `@container/portfolio`, `bg-(--presentation-ground)`, `data-step-root`, `tabIndex={-1}`, `role="region"` labelled by the step's sr-only h1, `aria-keyshortcuts`. Presentation tokens only (`text-presentation-*`, `*-presentation-tight|group|zone`); scrims `oklch(var(--presentation-scrim) / α)`; bottom content clears the capsule with `var(--stage-clear-b)`.
- **Wide** (`@5xl/portfolio`, ≥1024px of step width — the 1440×900 step is ~1136px with the sidebar open): photo full-bleed; heading top-left; project list top-right in a ~300px scrolling column; bottom-left block ≤760px: story lines → story phase bar → story phase photos.
- **Narrow** (the 820 tablet, ~516–772px): heading on top; `project-list-row` (next 3 + "All N" → bottom Sheet) above the bottom block.
- Motion: ~400ms crossfade on the shared ease; `MotionConfig reducedMotion="user"` at the flow root turns it into a swap.
- Accessibility: photo alt "<title> — <phase label> photo n of m"; bar segments and thumbnails are buttons with `aria-current`; a polite live region announces project and story phase; targets ≥44px; visible focus on the dark ground.
- Story lines scroll inside their own box (max ~28% of the step height) so long text never slides under the bar or the capsule.

| State | Shows |
|---|---|
| list pending | ground + skeleton heading and bar |
| list error | `ErrorState` on the ground with a retry |
| no project has a hero | `EmptyState` "No portfolio projects to show yet" |
| detail pending | hero, heading, pills; bar skeleton; `advance` inert |
| detail null / error | the hero story phase |
| one photo in a story phase | no thumbnails |
| last photo of the last project | no "Next" cue; Space does nothing |

### 5.9 `CONTEXT.md`

A "Project story" section with the §2 terms (project story, story phase, portfolio match, match labels; media phase noted as existing). The Presentation-terms intro line ("Program and Portfolio will be too") changes to say Portfolio uses the presentation layout and ground but shows one project at a time with its story phases, not slides.

## 6. Verification

- Pure functions (no test runner — throwaway `tsx` scripts in the session scratchpad, never committed): `countMediaPhases`; `buildCatalogIndex().tradeIdByScope`; `buildProjectStoryPhases` (all phases; Before + After + Gallery; Gallery only; Before only; blank parts; hero first; `media === null`); `matchPortfolioProjects` + `groupPortfolioMatches` (scope over trade; trade with no scopes; no matches → exactly 3 fallback; no selections; hero-less excluded; tie-break); `nextPhotoPosition` / `isLastPhoto`.
- `pnpm tsc && pnpm lint` clean at every commit.
- Browser on dev (read-only), 1440×900 and 820×1180, light and dark shell, using the fixtures in §3: every story-phase shape; scope / trade / fallback lists; Space, ↓/↑, taps; Space on a focused control acts once; long story at 820; end of the list; reduced motion; the project editor without the phase-text section; the public project page's timeline still rendering.

## 7. Decisions (owner, 2026-09-23)

| # | Decision |
|---|---|
| W1 | Build Option D. Pills show matched scopes / trade only. |
| W2 | Distance out for v1 (no coordinates). |
| W3 | Profile echoes out for v1 (projects need property tags first). |
| W4 | Media phases with no photos are hidden; Gallery (uncategorized) is its own story phase, so every photo is reachable. |
| W5 | Space / tap advances photo by photo, into the next story phase, then the next project. |
| W6 | One list with section labels; nothing unreachable in the meeting. |
| W7 | A `presentation`-layout step exposing a step handle through the flow's single key owner. |
| W8 | `phaseCounts` on `getPortfolioProjects`, following the DAL's grouped-count pattern. |
| W9 | Matching falls back scope → trade → first `FALLBACK_MATCH_COUNT`; rules in the feature, on shared primitives. |
| W10 | `indexShowcaseProjects` moves onto `tradeIdByScope`. |
| W11 | **Challenge → solution → result is the standard project story** on every surface. |
| W12 | No data writes, dev included; dev fixtures cover every story-phase shape. |
| W13 | Vocabulary per §2; the story helper and `PHASE_LABELS` live in `modules/projects` (part of epic R13). |
| W14 | `before/during/after/mainDescription` retired fully, columns dropped. |
| W15 | The public project page adopts `buildProjectStoryPhases` later; now it only stops reading the retired fields. |
| W16 | No test runner; scratch `tsx` checks. |

## 8. Coordination with the upgrading-meeting-flow epic

`docs/plans/2026-09-14-upgrading-meeting-flow-epic.md` (spec B, not written) plans to retire `getPortfolioProjects` / `getPortfolioProjectDetail` behind a projects service (R9), one trade-matching rule for project reads (R12), and moving the project story primitives into `modules/projects` (R13). This work: extends `getPortfolioProjects` with `phaseCounts` — spec B carries the field into the service's list read; moves `PHASE_LABELS` and adds `buildProjectStoryPhases` in `modules/projects` — a first slice of R13; keeps `matchPortfolioProjects` in the meeting-flow feature on `tradeIdByScope` — R12 decides later whether it becomes the shared rule.

## 9. Follow-ups

- Public project page on `buildProjectStoryPhases` (W15), resolving the duplicate challenge/solution text between its timeline and its Challenge / Solution sections.
- Distance; profile echoes; a before/after reveal inside the After phase.
