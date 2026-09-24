# Portfolio Step and the Project Story — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild meeting-flow step 3 as Option D — one project at a time on the dark presentation ground, its project story (challenge → solution → result) told across its story phases, with a list of portfolio matches (scope → trade → fallback) — and make challenge → solution → result the standard project story, retiring the four unused phase-text fields.

**Architecture:** The project story is a pure helper in `modules/projects` (`buildProjectStoryPhases`), fed by two additive shared primitives (`PortfolioProject.phaseCounts`, `CatalogIndex.tradeIdByScope`). The meeting-flow feature matches projects to the meeting (`matchPortfolioProjects`), holds the position in `usePortfolioNavigation`, and renders a `presentation`-layout step that exposes a `MeetingStepHandle` (`next`/`prev`/`advance`) to the flow's single key owner.

**Tech Stack:** Next.js 15, React 19 (`ref` as a prop), tRPC + TanStack Query (superjson), Drizzle (Postgres, `drizzle-kit push`), Tailwind v4 container queries, `motion/react`, shadcn `Sheet`.

**Spec:** `docs/superpowers/specs/2026-09-23-portfolio-step-project-story-design.md` — read it first. Its §2 vocabulary is binding: never use walkthrough, chapter, stage, queue, tier, featured, cursor or beat in names, copy or comments.

## Global Constraints

- **No data writes in any environment, dev included.** Read-only queries only. The one schema change (dropping four empty columns) goes to dev with `pnpm db:push:dev`; **never** `db:push:prod` — that is the owner's.
- **No test runner.** No vitest/jest, no `package.json` change. Pure-function checks are throwaway `tsx` scripts in the session scratchpad, never committed. `$SCRATCH` = `/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b2219856-9a14-407a-ab52-f91e3f5d57d6/scratchpad` (or the executing session's own scratchpad). Run them from the repo root: `pnpm exec tsx $SCRATCH/portfolio-checks/<file>.ts` — `tsx` then resolves `@/` inside project files (verified 2026-09-23). Check files import project code by absolute path.
- Verification per task: `pnpm tsc` and `pnpm lint` clean (`pnpm lint:fix` for import order). **Never `pnpm build`.**
- **Commits:** on `main`; `git add <explicit paths>` then `git commit -m "…" -- <same paths>`. The index holds unrelated staged deletions (docs prune) that a bare `git commit` would sweep in. Never `git add -A`, never stash / checkout / reset.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Comments say why, never what.** No file banners, no restating code, no citations of plans / specs / tasks / docs in code. A `// path/to/file.ts` first line in a code block below only labels the file — do not copy it.
- One React component per file; no file-level constants in component files; named exports; `@/` → `src/`.
- **Untracked owner file:** `scripts/tmp-smoke-scopes-persist.ts` is type-checked and reads the retired fields. Never edit or delete it; when `pnpm tsc` flags it (Task 3), stop and ask the owner.
- Copy (spec §2, §5): phase labels from `PHASE_LABELS` (Before, During, After, Gallery); story labels `Challenge`, `Solution`, `Result`; hero story phase `The project`; list sections `For your project`, `From our portfolio`, `Other projects`; `No finished projects match these scopes yet.`; `No portfolio projects to show yet`.
- `FALLBACK_MATCH_COUNT = 3`, `PREFETCH_AHEAD = 2`, `PROJECT_LIST_ROW_COUNT = 3`. Wide layout = `@5xl/portfolio` (≥1024px of step width).

## Review Focus

1. **Space while a control has focus** — Space on a focused story-phase segment, thumbnail or list card acts once (the button's click), never click + advance. Pinned: Task 7 Step 4 and Task 10 Step 4.
2. **Selections edited mid-meeting** — the project on screen stays while still listed; otherwise the first match shows, never a blank frame. Pinned: Task 6 (position keyed by project id) and Task 10 Step 6.
3. **`getDetail` null or errored** — the hero story phase shows and Space moves to the next project. Pinned: Task 2 Step 1 (`media === null` case) and Task 6 (`isPending` vs error).
4. **Long story text on the 820 tablet** — story lines scroll in their own box; the bar and capsule stay clear. Pinned: Task 8 (`story-lines.tsx`) and Task 10 Step 5.
5. **End of the list** — Space on the last photo of the last project and ↓ on the last project do nothing; no "Next" cue there. Pinned: Task 6 Step 1 (`nextPhotoPosition` at the end) and Task 6 (`next` clamps).

---

### Task 1: `phaseCounts` on portfolio list rows

**Files:**
- Modify: `src/shared/modules/projects/core/types.ts`
- Modify: `src/shared/modules/projects/core/dal/server/queries.ts` (`getPortfolioProjects`; the `drizzle-orm` import on line 6)
- Create: `src/shared/modules/projects/core/lib/count-media-phases.ts`
- Scratch: `$SCRATCH/portfolio-checks/count-media-phases.check.ts`

**Interfaces:**
- Produces: `type MediaPhaseCounts = Record<MediaPhase, number>`; `PortfolioProject.phaseCounts: MediaPhaseCounts`; `countMediaPhases(phaseCounts: MediaPhaseCounts): number` (0–3).

- [ ] **Step 1: Write the check**

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

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module …/count-media-phases`)

- [ ] **Step 3: Types** — in `src/shared/modules/projects/core/types.ts`:

```ts
import type { MediaPhase } from '@/shared/constants/enums/media'
import type { Project, ProjectMediaFile } from '@/shared/db/schema'

/** Non-video photos per media phase; every phase present, zero when empty. */
export type MediaPhaseCounts = Record<MediaPhase, number>

export interface PortfolioProject {
  project: Project
  heroImage: ProjectMediaFile | null
  scopeIds: string[]
  phaseCounts: MediaPhaseCounts
}
```

- [ ] **Step 4: `countMediaPhases`**

```ts
// src/shared/modules/projects/core/lib/count-media-phases.ts
import type { MediaPhaseCounts } from '@/shared/modules/projects/core/types'

/** How many of before, during and after have photos (0–3). Gallery photos carry no part of the story, so they never count. */
export function countMediaPhases(phaseCounts: MediaPhaseCounts): number {
  return [phaseCounts.before, phaseCounts.during, phaseCounts.after].filter(n => n > 0).length
}
```

- [ ] **Step 5: The grouped query** — add `notLike` to the `drizzle-orm` import (alphabetical: `…, lte, notLike, or, sql`); merge `MediaPhaseCounts` into the existing `@/shared/modules/projects/core/types` type import. Replace `getPortfolioProjects` from the `// Fetch scope IDs` comment to the end of the function with:

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

- [ ] **Step 6: Verify** — the check prints `count-media-phases: ok`; `pnpm tsc` clean (this DAL is the only `PortfolioProject` builder); `pnpm lint` clean.

- [ ] **Step 7: Commit**

```bash
git add src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/dal/server/queries.ts src/shared/modules/projects/core/lib/count-media-phases.ts
git commit -m "feat(projects): photo counts per media phase on portfolio rows

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/dal/server/queries.ts src/shared/modules/projects/core/lib/count-media-phases.ts
```

---

### Task 2: The project story in `modules/projects`

**Files:**
- Move: `src/features/project-management/constants/phase-labels.ts` → `src/shared/modules/projects/core/constants/phase-labels.ts` (`git mv`, content unchanged)
- Modify: `src/features/project-management/ui/components/story-gallery.tsx` (the `PHASE_LABELS` import)
- Modify: `src/shared/modules/projects/core/types.ts` (story types)
- Create: `src/shared/modules/projects/core/constants/project-story.ts`
- Create: `src/shared/modules/projects/core/lib/build-project-story-phases.ts`
- Modify: `CONTEXT.md` (new "Project story" section)
- Scratch: `$SCRATCH/portfolio-checks/fixtures.ts`, `$SCRATCH/portfolio-checks/project-story.check.ts`

**Interfaces:**
- Produces:

```ts
type ProjectStoryPart = 'challenge' | 'solution' | 'result'
interface ProjectStoryLine { part: ProjectStoryPart, label: string, text: string }
interface ProjectStoryPhase { phase: MediaPhase | 'hero', label: string, photos: ProjectMediaFile[], story: ProjectStoryLine[] }
buildProjectStoryPhases(input: { project: Pick<Project, 'challengeDescription' | 'solutionDescription' | 'resultDescription'>, heroImage: ProjectMediaFile, media: ProjectMediaGroups | null }): ProjectStoryPhase[]
PHASE_LABELS  // now at '@/shared/modules/projects/core/constants/phase-labels'
```

- [ ] **Step 1: Write the fixtures and the check**

```ts
// $SCRATCH/portfolio-checks/fixtures.ts
import type { TradeSelection } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/entities/meetings/schemas'
import type { MediaPhaseCounts, PortfolioProject } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/core/types'

let nextMediaId = 1
export function media(phase: string, extra: Record<string, unknown> = {}) {
  return { id: nextMediaId++, phase, isHeroImage: false, url: `https://x/${nextMediaId}.jpg`, mimeType: 'image/jpeg', pathKey: null, bucket: null, optimizationStatus: 'pending', ...extra } as any
}

export function mediaGroups(groups: Record<string, any[]>) {
  return { hero: [], before: [], during: [], after: [], uncategorized: [], videos: [], all: [], ...groups } as any
}

export const story = {
  challengeDescription: 'Leaky single-pane windows.',
  solutionDescription: 'Dual-pane vinyl, full frame.',
  resultDescription: 'Quieter, cooler rooms.',
}

export function row(id: string, opts: { title?: string, scopeIds?: string[], phases?: Partial<MediaPhaseCounts>, hero?: boolean } = {}): PortfolioProject {
  return {
    project: { id, accessor: id, title: opts.title ?? id, city: 'Long Beach', state: 'CA', projectDuration: '6 weeks', ...story } as any,
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

```ts
// $SCRATCH/portfolio-checks/project-story.check.ts
import assert from 'node:assert/strict'
import { buildProjectStoryPhases } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/core/lib/build-project-story-phases'
import { media, mediaGroups, story } from './fixtures'

const hero = media('after', { isHeroImage: true })
const shape = (phases: { phase: string, story: { part: string }[] }[]) => phases.map(p => `${p.phase}:${p.story.map(s => s.part).join('+')}`)
const build = (m: Record<string, any[]> | null, project = story) => buildProjectStoryPhases({ project, heroImage: hero, media: m && mediaGroups(m) })

// every media phase: each part at home, Gallery last with no story
{
  const phases = build({ before: [media('before')], during: [media('during')], after: [media('after')], uncategorized: [media('uncategorized')] })
  assert.deepEqual(shape(phases), ['before:challenge', 'during:solution', 'after:result', 'uncategorized:'])
  assert.deepEqual(phases.map(p => p.label), ['Before', 'During', 'After', 'Gallery'])
  assert.deepEqual(phases[0].story[0], { part: 'challenge', label: 'Challenge', text: story.challengeDescription })
}

// Before + After + Gallery: the solution moves forward to After
assert.deepEqual(shape(build({ before: [media('before')], after: [media('after')], uncategorized: [media('uncategorized')] })), ['before:challenge', 'after:solution+result', 'uncategorized:'])

// Gallery only: the whole story there
assert.deepEqual(shape(build({ uncategorized: [media('uncategorized'), media('uncategorized')] })), ['uncategorized:challenge+solution+result'])

// Before only: parts with nothing after them fall back to the last story phase
assert.deepEqual(shape(build({ before: [media('before')] })), ['before:challenge+solution+result'])

// blank parts are skipped
assert.deepEqual(shape(build({ before: [media('before')], after: [media('after')] }, { ...story, resultDescription: '   ', solutionDescription: null as any })), ['before:challenge', 'after:'])

// the hero leads inside its own phase
assert.equal(build({ after: [media('after'), hero] })[0].photos[0], hero)

// no media: one hero story phase with the whole story
{
  const phases = build(null)
  assert.deepEqual(shape(phases), ['hero:challenge+solution+result'])
  assert.equal(phases[0].label, 'The project')
  assert.deepEqual(phases[0].photos, [hero])
}
console.log('project-story: ok')
```

- [ ] **Step 2: Run the check — expect FAIL** (`Cannot find module …/build-project-story-phases`)

- [ ] **Step 3: Move `PHASE_LABELS`**

```bash
git mv src/features/project-management/constants/phase-labels.ts src/shared/modules/projects/core/constants/phase-labels.ts
```

In `story-gallery.tsx` change the import to `import { PHASE_LABELS } from '@/shared/modules/projects/core/constants/phase-labels'`. Confirm no other importer: `grep -rn "project-management/constants/phase-labels" src` → no output.

- [ ] **Step 4: Story types** — append to `src/shared/modules/projects/core/types.ts`:

```ts
export type ProjectStoryPart = 'challenge' | 'solution' | 'result'

export interface ProjectStoryLine {
  part: ProjectStoryPart
  label: string
  text: string
}

/** A media phase with photos and the parts of the project story told against it. `'hero'` stands in when no media is loaded. */
export interface ProjectStoryPhase {
  phase: MediaPhase | 'hero'
  label: string
  photos: ProjectMediaFile[]
  story: ProjectStoryLine[]
}
```

- [ ] **Step 5: Story constants**

```ts
// src/shared/modules/projects/core/constants/project-story.ts
import type { MediaPhase } from '@/shared/constants/enums/media'
import type { ProjectStoryPart } from '@/shared/modules/projects/core/types'

/** The order a project is told in. Gallery comes last: it carries no part of the story. */
export const STORY_PHASE_ORDER = ['before', 'during', 'after', 'uncategorized'] as const satisfies readonly MediaPhase[]

/** Where each part of the story belongs: the challenge is what the before photos show, and so on. */
export const STORY_PART_PHASE: Record<ProjectStoryPart, MediaPhase> = {
  challenge: 'before',
  solution: 'during',
  result: 'after',
}

export const STORY_LABELS: Record<ProjectStoryPart, string> = {
  challenge: 'Challenge',
  solution: 'Solution',
  result: 'Result',
}

export const HERO_STORY_PHASE_LABEL = 'The project'
```

- [ ] **Step 6: `buildProjectStoryPhases`**

```ts
// src/shared/modules/projects/core/lib/build-project-story-phases.ts
import type { Project, ProjectMediaFile } from '@/shared/db/schema'
import type { ProjectMediaGroups, ProjectStoryLine, ProjectStoryPart, ProjectStoryPhase } from '@/shared/modules/projects/core/types'
import { PHASE_LABELS } from '@/shared/modules/projects/core/constants/phase-labels'
import { HERO_STORY_PHASE_LABEL, STORY_LABELS, STORY_PART_PHASE, STORY_PHASE_ORDER } from '@/shared/modules/projects/core/constants/project-story'

interface BuildProjectStoryPhasesInput {
  project: Pick<Project, 'challengeDescription' | 'solutionDescription' | 'resultDescription'>
  heroImage: ProjectMediaFile
  media: ProjectMediaGroups | null
}

function storyLines(project: BuildProjectStoryPhasesInput['project']): ProjectStoryLine[] {
  const texts: Record<ProjectStoryPart, string | null> = {
    challenge: project.challengeDescription,
    solution: project.solutionDescription,
    result: project.resultDescription,
  }
  return (Object.keys(STORY_PART_PHASE) as ProjectStoryPart[])
    .map(part => ({ part, label: STORY_LABELS[part], text: texts[part]?.trim() ?? '' }))
    .filter(line => line.text)
}

function heroFirst(photos: ProjectMediaFile[], hero: ProjectMediaFile): ProjectMediaFile[] {
  const match = photos.find(photo => photo.id === hero.id)
  return match ? [match, ...photos.filter(photo => photo !== match)] : photos
}

/**
 * The project story told against the project's photos: one story phase per media phase that has
 * photos, in story order. A part whose own phase has no photos joins the next story phase (or the
 * last one), so no part of the story is dropped with its photos.
 */
export function buildProjectStoryPhases({ project, heroImage, media }: BuildProjectStoryPhasesInput): ProjectStoryPhase[] {
  const lines = storyLines(project)
  const phases: ProjectStoryPhase[] = media
    ? STORY_PHASE_ORDER
        .filter(phase => media[phase].length > 0)
        .map(phase => ({ phase, label: PHASE_LABELS[phase], photos: heroFirst(media[phase], heroImage), story: [] }))
    : []

  if (phases.length === 0) {
    return [{ phase: 'hero', label: HERO_STORY_PHASE_LABEL, photos: [heroImage], story: lines }]
  }

  for (const line of lines) {
    const home = STORY_PHASE_ORDER.indexOf(STORY_PART_PHASE[line.part])
    const target = phases.find(p => p.phase !== 'hero' && STORY_PHASE_ORDER.indexOf(p.phase) >= home) ?? phases.at(-1)!
    target.story.push(line)
  }
  return phases
}
```

- [ ] **Step 7: `CONTEXT.md`** — add after the "Presentation terms" section:

```markdown
## Project story terms

How a project is told, on every surface (portfolio page, meeting-flow Portfolio step).

- **Project story** — challenge → solution → result (`challengeDescription`, `solutionDescription`, `resultDescription`). The one standard for telling a project. _Avoid_: phase text, caption, timeline description.
- **Media phase** — before · during · after · uncategorized (labelled "Gallery"), on each project photo (`MediaPhase`, `PHASE_LABELS`).
- **Story phase** — a media phase that has photos, with the story told against it: challenge → Before, solution → During, result → After. A part whose phase has no photos joins the next story phase, else the last. With no media loaded, the hero stands in (`ProjectStoryPhase`, `buildProjectStoryPhases`). _Avoid_: chapter, step.
```

- [ ] **Step 8: Verify** — the check prints `project-story: ok`; `pnpm tsc` clean; `pnpm lint` clean.

- [ ] **Step 9: Commit**

```bash
git add src/shared/modules/projects/core/constants/phase-labels.ts src/features/project-management/constants/phase-labels.ts src/features/project-management/ui/components/story-gallery.tsx src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/constants/project-story.ts src/shared/modules/projects/core/lib/build-project-story-phases.ts CONTEXT.md
git commit -m "feat(projects): the project story is challenge, solution, result across story phases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/modules/projects/core/constants/phase-labels.ts src/features/project-management/constants/phase-labels.ts src/features/project-management/ui/components/story-gallery.tsx src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/constants/project-story.ts src/shared/modules/projects/core/lib/build-project-story-phases.ts CONTEXT.md
```

---

### Task 3: Retire the phase-text fields

**Files:**
- Modify: `src/shared/db/schema/projects.ts:32-35` (drop the four columns)
- Modify: `src/shared/modules/projects/core/schemas/index.ts:39-42, 80-83`
- Modify: `src/features/project-management/ui/views/edit-project-view.tsx:91-94`
- Modify: `src/features/project-management/ui/components/form/story-content-fields.tsx` (the "Timeline Phase Descriptions" block, from the `<div … >` holding the `<h3>` at ~line 104 through its closing `</div>` before `</section>`)
- Modify: `src/features/project-management/ui/components/story-timeline.tsx` (description map, `project` prop)
- Modify: `src/features/project-management/ui/views/project-story-view.tsx:57`

**Interfaces:**
- Produces: `projects` table and `Project` type without `beforeDescription`, `duringDescription`, `afterDescription`, `mainDescription`; `StoryTimeline({ media })`.

- [ ] **Step 1: Drop the columns** — delete these four lines from `src/shared/db/schema/projects.ts`:

```ts
  beforeDescription: text('before_description'),
  duringDescription: text('during_description'),
  afterDescription: text('after_description'),
  mainDescription: text('main_description'),
```

- [ ] **Step 2: Form schema and defaults** — delete the four `…Description: z.string().nullable().optional(),` lines (39–42) and the four `…Description: null,` lines (80–83) in `modules/projects/core/schemas/index.ts`.

- [ ] **Step 3: Editor** — delete lines 91–94 in `edit-project-view.tsx` (`beforeDescription: p.beforeDescription ?? null,` … `mainDescription: …`). In `story-content-fields.tsx`, delete the whole "Timeline Phase Descriptions" block (its container `div`, the `h3`, the helper `p` and the four `FormField`s), leaving the preceding block and `</section>`.

- [ ] **Step 4: `StoryTimeline` reads no phase text** — in `story-timeline.tsx`, remove the `Project` type import and the `project` prop, and build phases from the config alone:

```tsx
interface Props {
  media: ProjectMediaGroups
}

export function StoryTimeline({ media }: Props) {
  // …unchanged state and handlers…

  const phases = useMemo<TimelinePhase[]>(() => {
    return PHASE_CONFIG
      .filter(cfg => media[cfg.key].length > 0)
      .map(cfg => ({
        key: cfg.key,
        label: cfg.label,
        description: cfg.fallbackDescription,
        photos: media[cfg.key],
      }))
  }, [media])
```

(`ProjectMediaFile` stays imported for `TimelinePhase`.) In `project-story-view.tsx:57`: `{hasTimelinePhotos && <StoryTimeline media={media} />}`.

- [ ] **Step 5: Type-check** — `pnpm tsc`. Expected: clean except, possibly, `scripts/tmp-smoke-scopes-persist.ts` (untracked owner file reading the four fields). If it is flagged: **stop and ask the owner** whether to delete that script or drop its four lines; do not touch it yourself. Then `grep -rn "beforeDescription\|duringDescription\|afterDescription\|mainDescription" src` → no output. `pnpm lint` clean.

- [ ] **Step 6: Push the schema to dev** — `pnpm db:push:dev`. The columns are empty on dev (checked 2026-09-23), so no rows change. If `drizzle-kit` asks an interactive confirmation you cannot answer, stop and hand the command to the owner. Never run `db:push:prod`.

- [ ] **Step 7: Commit**

```bash
git add src/shared/db/schema/projects.ts src/shared/modules/projects/core/schemas/index.ts src/features/project-management/ui/views/edit-project-view.tsx src/features/project-management/ui/components/form/story-content-fields.tsx src/features/project-management/ui/components/story-timeline.tsx src/features/project-management/ui/views/project-story-view.tsx
git commit -m "refactor(projects): retire the per-phase caption fields for the project story

The four columns were empty in every environment. Prod needs db:push:prod.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/db/schema/projects.ts src/shared/modules/projects/core/schemas/index.ts src/features/project-management/ui/views/edit-project-view.tsx src/features/project-management/ui/components/form/story-content-fields.tsx src/features/project-management/ui/components/story-timeline.tsx src/features/project-management/ui/views/project-story-view.tsx
```

---

### Task 4: `tradeIdByScope` on the catalog index

**Files:**
- Modify: `src/shared/modules/construction/core/lib/build-catalog-index.ts`
- Modify: `src/features/meeting-flow/lib/index-showcase-projects.ts`
- Modify: `src/features/meeting-flow/hooks/use-showcase-projects.ts`
- Modify: `src/features/meeting-flow/contexts/trade-selection-provider.tsx:59`
- Scratch: `$SCRATCH/portfolio-checks/catalog-index.check.ts`

**Interfaces:**
- Produces: `CatalogIndex.tradeIdByScope: ReadonlyMap<string, string>`; `indexShowcaseProjects(projects, tradeIdByScope)`; `useShowcaseProjects(tradeIdByScope)`.

- [ ] **Step 1: Write the check**

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

- [ ] **Step 2: Run it — expect FAIL** (`Cannot read properties of undefined (reading 'get')`)

- [ ] **Step 3: Build the map**

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

- [ ] **Step 4: The showcase index reads it** — in `index-showcase-projects.ts`: drop the `TradeScopeGroup` import; signature `indexShowcaseProjects(projects: PortfolioProject[], tradeIdByScope: ReadonlyMap<string, string>): ShowcaseProjectIndex`; delete the inline `tradeOfScope` loop (lines 7–12); `const tradeId = tradeIdByScope.get(scopeId)` where `tradeOfScope.get(scopeId)` was.

`use-showcase-projects.ts` — drop the `TradeScopeGroup` import:

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

`trade-selection-provider.tsx:59`: `const projects = useShowcaseProjects(catalog.tradeIdByScope)`.

- [ ] **Step 5: Verify** — `catalog-index: ok`; `pnpm tsc`; `pnpm lint`.

- [ ] **Step 6: Commit**

```bash
git add src/shared/modules/construction/core/lib/build-catalog-index.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/hooks/use-showcase-projects.ts src/features/meeting-flow/contexts/trade-selection-provider.tsx
git commit -m "refactor(construction): the catalog index owns scope-to-trade lookup

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/modules/construction/core/lib/build-catalog-index.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/hooks/use-showcase-projects.ts src/features/meeting-flow/contexts/trade-selection-provider.tsx
```

---

### Task 5: Portfolio matches

**Files:**
- Modify: `src/features/meeting-flow/types/index.ts` (append)
- Create: `src/features/meeting-flow/constants/portfolio-step.ts`
- Create: `src/features/meeting-flow/lib/match-portfolio-projects.ts`
- Create: `src/features/meeting-flow/lib/group-portfolio-matches.ts`
- Create: `src/features/meeting-flow/lib/format-portfolio-meta.ts`
- Modify: `CONTEXT.md` (match terms; Presentation-terms intro line)
- Scratch: `$SCRATCH/portfolio-checks/match.check.ts`

**Interfaces:**
- Consumes: Task 1 (`phaseCounts`, `countMediaPhases`), Task 4 (`tradeIdByScope`), `TradeSelection`.
- Produces:

```ts
export type MeetingStepHandle = PresentationHandle & { advance?: () => void }
export type PortfolioRowWithHero = PortfolioProject & { heroImage: ProjectMediaFile }
export type PortfolioMatchKind = 'scope' | 'trade' | 'fallback' | 'none'
export interface PortfolioMatch { row: PortfolioRowWithHero, kind: PortfolioMatchKind, matchedScopeIds: string[], matchedTradeIds: string[], matchLabels: string[] }
export interface PortfolioMatchSection { label: string, items: { match: PortfolioMatch, index: number }[] }
export interface PortfolioPosition { projectIndex: number, phaseIndex: number, photoIndex: number }

matchPortfolioProjects(projects: PortfolioProject[], selections: TradeSelection[], catalog: Pick<CatalogIndex, 'tradeIdByScope'>): PortfolioMatch[]
groupPortfolioMatches(matches: PortfolioMatch[]): PortfolioMatchSection[]
formatPortfolioMeta(project: Pick<Project, 'city' | 'state' | 'projectDuration'>): string
```

- [ ] **Step 1: Write the check**

```ts
// $SCRATCH/portfolio-checks/match.check.ts
import assert from 'node:assert/strict'
import { groupPortfolioMatches } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/group-portfolio-matches'
import { matchPortfolioProjects } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/match-portfolio-projects'
import { row, selection, tradeIdByScope } from './fixtures'

const catalog = { tradeIdByScope }
const ids = (matches: { row: { project: { id: string } } }[]) => matches.map(m => m.row.project.id)
const kitchenCabinets = [selection('t-kitchen', 'Kitchen', [['s-cabinets', 'Cabinets']])]

// scope before trade; more matched scopes first
{
  const projects = [row('trade-only', { scopeIds: ['s-backsplash'] }), row('one-scope', { scopeIds: ['s-cabinets'] }), row('two-scopes', { scopeIds: ['s-cabinets', 's-counters'] })]
  const matches = matchPortfolioProjects(projects, [selection('t-kitchen', 'Kitchen', [['s-cabinets', 'Cabinets'], ['s-counters', 'Countertops']])], catalog)
  assert.deepEqual(ids(matches), ['two-scopes', 'one-scope', 'trade-only'])
  assert.deepEqual(matches.map(m => m.kind), ['scope', 'scope', 'trade'])
  assert.deepEqual(matches[0].matchLabels, ['Cabinets', 'Countertops'])
  assert.deepEqual(matches[2].matchLabels, ['Kitchen'])
}

// a trade selected with no scopes still matches by trade
{
  const matches = matchPortfolioProjects([row('k', { scopeIds: ['s-counters'] })], [selection('t-kitchen', 'Kitchen', [])], catalog)
  assert.equal(matches[0].kind, 'trade')
  assert.deepEqual(matches[0].matchedTradeIds, ['t-kitchen'])
}

// nothing matches → exactly 3 fallback by story strength, then none
{
  const projects = [
    row('a-none', { scopeIds: ['s-windows'] }),
    row('b-full', { scopeIds: ['s-windows'], phases: { before: 2, during: 5, after: 4 } }),
    row('c-two', { scopeIds: ['s-doors'], phases: { during: 1, after: 1 } }),
    row('d-two-more', { scopeIds: ['s-doors'], phases: { during: 8, after: 8 } }),
    row('e-none', {}),
  ]
  const matches = matchPortfolioProjects(projects, kitchenCabinets, catalog)
  assert.deepEqual(ids(matches), ['b-full', 'd-two-more', 'c-two', 'a-none', 'e-none'])
  assert.deepEqual(matches.map(m => m.kind), ['fallback', 'fallback', 'fallback', 'none', 'none'])
  const sections = groupPortfolioMatches(matches)
  assert.deepEqual(sections.map(s => s.label), ['From our portfolio', 'Other projects'])
  assert.deepEqual(sections[1].items.map(i => i.index), [3, 4], 'indexes are list positions')
}

// no selections → fallback first
assert.equal(matchPortfolioProjects([row('x', { scopeIds: ['s-cabinets'] }), row('y')], [], catalog)[0].kind, 'fallback')

// hero-less rows are left out; ties fall to title
assert.deepEqual(ids(matchPortfolioProjects([row('no-hero', { hero: false }), row('b', { title: 'Beta' }), row('a', { title: 'Alpha' })], [], catalog)), ['a', 'b'])

// scope and trade share one section
{
  const matches = matchPortfolioProjects([row('s', { scopeIds: ['s-cabinets'] }), row('t', { scopeIds: ['s-counters'] }), row('o')], kitchenCabinets, catalog)
  assert.deepEqual(groupPortfolioMatches(matches).map(s => s.label), ['For your project', 'Other projects'])
}
console.log('match: ok')
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module …/group-portfolio-matches`)

- [ ] **Step 3: Types** — append to `src/features/meeting-flow/types/index.ts` (merge new type imports into existing import lines where the module is already imported; `ProjectMediaFile` already is):

```ts
// ── Portfolio step ──────────────────────────────────────────────────────────

/** What a presentation-layout meeting step exposes to the flow's key map. `advance` is the Space key; a step without it ignores Space. */
export type MeetingStepHandle = PresentationHandle & { advance?: () => void }

export type PortfolioRowWithHero = PortfolioProject & { heroImage: ProjectMediaFile }

export type PortfolioMatchKind = 'scope' | 'trade' | 'fallback' | 'none'

/** A portfolio project and why it is shown for this meeting. */
export interface PortfolioMatch {
  row: PortfolioRowWithHero
  kind: PortfolioMatchKind
  matchedScopeIds: string[]
  matchedTradeIds: string[]
  /** The pills: matched scope labels, or trade names, as the meeting named them. */
  matchLabels: string[]
}

export interface PortfolioMatchSection {
  label: string
  items: { match: PortfolioMatch, index: number }[]
}

export interface PortfolioPosition {
  projectIndex: number
  phaseIndex: number
  photoIndex: number
}
```

- [ ] **Step 4: Constants**

```ts
// src/features/meeting-flow/constants/portfolio-step.ts
import type { PortfolioMatchKind } from '@/features/meeting-flow/types'

export const PORTFOLIO_SECTION_LABELS: Record<PortfolioMatchKind, string> = {
  scope: 'For your project',
  trade: 'For your project',
  fallback: 'From our portfolio',
  none: 'Other projects',
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
  listTitle: 'Projects',
} as const

/** When nothing matches the meeting's scopes or trades, this many projects lead instead. */
export const FALLBACK_MATCH_COUNT = 3

/** Project details fetched ahead of the one on screen, so ↓ lands on loaded photos. */
export const PREFETCH_AHEAD = 2

/** Cards in the narrow step's project row. */
export const PROJECT_LIST_ROW_COUNT = 3
```

- [ ] **Step 5: `matchPortfolioProjects`**

```ts
// src/features/meeting-flow/lib/match-portfolio-projects.ts
import type { PortfolioMatch, PortfolioRowWithHero } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { CatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'
import { FALLBACK_MATCH_COUNT } from '@/features/meeting-flow/constants/portfolio-step'
import { countMediaPhases } from '@/shared/modules/projects/core/lib/count-media-phases'

function hasHero(row: PortfolioProject): row is PortfolioRowWithHero {
  return row.heroImage !== null
}

function storyPhotoCount(row: PortfolioProject): number {
  return row.phaseCounts.before + row.phaseCounts.during + row.phaseCounts.after
}

/** A fuller before → during → after story leads; then more story photos; then the title keeps the order stable. */
function byStoryStrength(a: PortfolioMatch, b: PortfolioMatch): number {
  return countMediaPhases(b.row.phaseCounts) - countMediaPhases(a.row.phaseCounts)
    || storyPhotoCount(b.row) - storyPhotoCount(a.row)
    || a.row.project.title.localeCompare(b.row.project.title)
}

/**
 * The meeting's portfolio, most relevant first: projects sharing a selected scope, then projects in a
 * selected trade, then the rest. When nothing matches by scope or trade, the strongest
 * `FALLBACK_MATCH_COUNT` projects lead, so the step never opens on nothing.
 */
export function matchPortfolioProjects(
  projects: PortfolioProject[],
  selections: TradeSelection[],
  catalog: Pick<CatalogIndex, 'tradeIdByScope'>,
): PortfolioMatch[] {
  const scopeLabels = new Map(selections.flatMap(s => s.selectedScopes.map(item => [item.id, item.label] as const)))
  const tradeNames = new Map(selections.map(s => [s.tradeId, s.tradeName] as const))

  const weight = new Map<string, number>()
  const byScope: PortfolioMatch[] = []
  const byTrade: PortfolioMatch[] = []
  const rest: PortfolioMatch[] = []

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
      byScope.push({ row, kind: 'scope', matchedScopeIds, matchedTradeIds, matchLabels: matchedScopeIds.map(id => scopeLabels.get(id)!) })
    }
    else if (matchedTradeIds.length > 0) {
      weight.set(row.project.id, scopesInSelectedTrades.length)
      byTrade.push({ row, kind: 'trade', matchedScopeIds: [], matchedTradeIds, matchLabels: matchedTradeIds.map(id => tradeNames.get(id)!) })
    }
    else {
      rest.push({ row, kind: 'none', matchedScopeIds: [], matchedTradeIds: [], matchLabels: [] })
    }
  }

  const byWeight = (a: PortfolioMatch, b: PortfolioMatch) =>
    (weight.get(b.row.project.id) ?? 0) - (weight.get(a.row.project.id) ?? 0) || byStoryStrength(a, b)

  byScope.sort(byWeight)
  byTrade.sort(byWeight)
  rest.sort(byStoryStrength)

  const fallbackCount = byScope.length + byTrade.length === 0 ? FALLBACK_MATCH_COUNT : 0
  const fallback = rest.slice(0, fallbackCount).map(match => ({ ...match, kind: 'fallback' as const }))

  return [...byScope, ...byTrade, ...fallback, ...rest.slice(fallbackCount)]
}
```

- [ ] **Step 6: `groupPortfolioMatches` and `formatPortfolioMeta`**

```ts
// src/features/meeting-flow/lib/group-portfolio-matches.ts
import type { PortfolioMatch, PortfolioMatchSection } from '@/features/meeting-flow/types'
import { PORTFOLIO_SECTION_LABELS } from '@/features/meeting-flow/constants/portfolio-step'

/** Consecutive kinds with the same label share a section; `index` stays the list position so numbers and jumps agree. */
export function groupPortfolioMatches(matches: PortfolioMatch[]): PortfolioMatchSection[] {
  const sections: PortfolioMatchSection[] = []
  matches.forEach((match, index) => {
    const label = PORTFOLIO_SECTION_LABELS[match.kind]
    const last = sections.at(-1)
    if (last?.label === label) {
      last.items.push({ match, index })
    }
    else {
      sections.push({ label, items: [{ match, index }] })
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

- [ ] **Step 7: `CONTEXT.md`** — append to the "Project story terms" section (added in Task 2):

```markdown
- **Portfolio match** — why a portfolio project is shown in a meeting: `scope` (shares a selected scope), `trade` (in a selected trade), `fallback` (the strongest few when nothing matches), `none` (`PortfolioMatch`, `matchPortfolioProjects`). _Avoid_: tier, rank, featured.
- **Match labels** — the pills naming a match: scope names, or the trade name.
```

And in "Presentation terms", replace the intro sentence "Meeting-flow step 1 (Who We Are) is a presentation; Program and Portfolio will be too." with: "Meeting-flow step 1 (Who We Are) is a presentation, and Program will be too. Portfolio (step 3) shares the presentation layout and ground but shows one project at a time through its story phases, not slides."

- [ ] **Step 8: Verify** — `match: ok`; `pnpm tsc`; `pnpm lint`.

- [ ] **Step 9: Commit**

```bash
git add src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/portfolio-step.ts src/features/meeting-flow/lib/match-portfolio-projects.ts src/features/meeting-flow/lib/group-portfolio-matches.ts src/features/meeting-flow/lib/format-portfolio-meta.ts CONTEXT.md
git commit -m "feat(meeting-flow): match portfolio projects to the meeting by scope, trade, then fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/portfolio-step.ts src/features/meeting-flow/lib/match-portfolio-projects.ts src/features/meeting-flow/lib/group-portfolio-matches.ts src/features/meeting-flow/lib/format-portfolio-meta.ts CONTEXT.md
```

---

### Task 6: Position math and navigation hooks

**Files:**
- Create: `src/features/meeting-flow/lib/portfolio-position.ts`
- Create: `src/features/meeting-flow/hooks/use-portfolio-project-detail.ts`
- Create: `src/features/meeting-flow/hooks/use-portfolio-navigation.ts`
- Scratch: `$SCRATCH/portfolio-checks/position.check.ts`

**Interfaces:**
- Consumes: `PortfolioMatch`, `PortfolioPosition`, `PREFETCH_AHEAD` (Task 5); `buildProjectStoryPhases`, `ProjectStoryPhase` (Task 2); `SHOWCASE_PROJECTS_STALE_MS`.
- Produces:

```ts
nextPhotoPosition(position: PortfolioPosition, phasePhotoCounts: readonly number[], projectCount: number): PortfolioPosition
isLastPhoto(position: PortfolioPosition, phasePhotoCounts: readonly number[]): boolean
usePortfolioProjectDetail(matches: PortfolioMatch[], projectIndex: number): UseQueryResult<PortfolioProjectDetail | null>
usePortfolioNavigation(matches: PortfolioMatch[]): {
  current: PortfolioMatch | undefined
  storyPhases: ProjectStoryPhase[] | null   // null while the current detail loads
  position: PortfolioPosition
  lastPhoto: boolean                        // on the current project's last photo
  advance: () => void; next: () => void; prev: () => void
  jumpToPhase: (phaseIndex: number) => void; jumpToPhoto: (photoIndex: number) => void; jumpToProject: (projectIndex: number) => void
}
```

- [ ] **Step 1: Write the check**

```ts
// $SCRATCH/portfolio-checks/position.check.ts
import assert from 'node:assert/strict'
import { isLastPhoto, nextPhotoPosition } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/portfolio-position'

const counts = [2, 1]
assert.deepEqual(nextPhotoPosition({ projectIndex: 0, phaseIndex: 0, photoIndex: 0 }, counts, 2), { projectIndex: 0, phaseIndex: 0, photoIndex: 1 })
assert.deepEqual(nextPhotoPosition({ projectIndex: 0, phaseIndex: 0, photoIndex: 1 }, counts, 2), { projectIndex: 0, phaseIndex: 1, photoIndex: 0 })
assert.deepEqual(nextPhotoPosition({ projectIndex: 0, phaseIndex: 1, photoIndex: 0 }, counts, 2), { projectIndex: 1, phaseIndex: 0, photoIndex: 0 })
const end = { projectIndex: 1, phaseIndex: 1, photoIndex: 0 }
assert.deepEqual(nextPhotoPosition(end, counts, 2), end, 'the last photo of the last project stays')
assert.equal(isLastPhoto({ projectIndex: 0, phaseIndex: 1, photoIndex: 0 }, counts), true)
assert.equal(isLastPhoto({ projectIndex: 0, phaseIndex: 0, photoIndex: 1 }, counts), false)
console.log('position: ok')
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module …/portfolio-position`)

- [ ] **Step 3: Position math**

```ts
// src/features/meeting-flow/lib/portfolio-position.ts
import type { PortfolioPosition } from '@/features/meeting-flow/types'

/** Space: the next photo, into the next story phase, then the next project's first photo. The very last photo stays put. */
export function nextPhotoPosition(position: PortfolioPosition, phasePhotoCounts: readonly number[], projectCount: number): PortfolioPosition {
  const { projectIndex, phaseIndex, photoIndex } = position
  if (photoIndex + 1 < (phasePhotoCounts[phaseIndex] ?? 0)) {
    return { projectIndex, phaseIndex, photoIndex: photoIndex + 1 }
  }
  if (phaseIndex + 1 < phasePhotoCounts.length) {
    return { projectIndex, phaseIndex: phaseIndex + 1, photoIndex: 0 }
  }
  if (projectIndex + 1 < projectCount) {
    return { projectIndex: projectIndex + 1, phaseIndex: 0, photoIndex: 0 }
  }
  return position
}

/** The project's last photo: the next Space leaves this project. */
export function isLastPhoto(position: PortfolioPosition, phasePhotoCounts: readonly number[]): boolean {
  const lastPhase = phasePhotoCounts.length - 1
  return position.phaseIndex === lastPhase && position.photoIndex === (phasePhotoCounts[lastPhase] ?? 1) - 1
}
```

- [ ] **Step 4: `usePortfolioProjectDetail`**

```ts
// src/features/meeting-flow/hooks/use-portfolio-project-detail.ts
'use client'

import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { PREFETCH_AHEAD } from '@/features/meeting-flow/constants/portfolio-step'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { useTRPC } from '@/trpc/helpers'

/** The detail (media by phase) of the project on screen, with the next few fetched ahead so ↓ never waits. */
export function usePortfolioProjectDetail(matches: PortfolioMatch[], projectIndex: number) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const accessor = matches[projectIndex]?.row.project.accessor

  const detail = useQuery({
    ...trpc.projectsRouter.showroomDisplay.getDetail.queryOptions({ accessor: accessor ?? '' }),
    enabled: accessor !== undefined,
    staleTime: SHOWCASE_PROJECTS_STALE_MS,
  })

  useEffect(() => {
    for (const ahead of matches.slice(projectIndex + 1, projectIndex + 1 + PREFETCH_AHEAD)) {
      void queryClient.prefetchQuery({
        ...trpc.projectsRouter.showroomDisplay.getDetail.queryOptions({ accessor: ahead.row.project.accessor }),
        staleTime: SHOWCASE_PROJECTS_STALE_MS,
      })
    }
  }, [matches, projectIndex, queryClient, trpc])

  return detail
}
```

- [ ] **Step 5: `usePortfolioNavigation`**

```ts
// src/features/meeting-flow/hooks/use-portfolio-navigation.ts
'use client'

import type { PortfolioMatch, PortfolioPosition } from '@/features/meeting-flow/types'
import { useCallback, useMemo, useState } from 'react'
import { usePortfolioProjectDetail } from '@/features/meeting-flow/hooks/use-portfolio-project-detail'
import { isLastPhoto, nextPhotoPosition } from '@/features/meeting-flow/lib/portfolio-position'
import { buildProjectStoryPhases } from '@/shared/modules/projects/core/lib/build-project-story-phases'

interface NavigationState {
  projectId: string | null
  phaseIndex: number
  photoIndex: number
}

/**
 * Which project, story phase and photo are on screen. Kept by project id, not list index, so a
 * re-match (selections edited from the panel) keeps the project on screen while it is still listed,
 * and returns to the first match when it is not.
 */
export function usePortfolioNavigation(matches: PortfolioMatch[]) {
  const [state, setState] = useState<NavigationState>({ projectId: null, phaseIndex: 0, photoIndex: 0 })

  const found = state.projectId === null ? -1 : matches.findIndex(match => match.row.project.id === state.projectId)
  const projectIndex = Math.max(found, 0)
  const current = matches[projectIndex]
  const detailQuery = usePortfolioProjectDetail(matches, projectIndex)

  // An errored detail is not pending, so it falls through to the hero story phase instead of loading forever.
  const storyPhases = useMemo(
    () => (current && !detailQuery.isPending
      ? buildProjectStoryPhases({ project: current.row.project, heroImage: current.row.heroImage, media: detailQuery.data?.media ?? null })
      : null),
    [current, detailQuery.isPending, detailQuery.data],
  )
  const photoCounts = useMemo(() => storyPhases?.map(phase => phase.photos.length) ?? null, [storyPhases])

  const phaseIndex = found === -1 || !storyPhases ? 0 : Math.min(state.phaseIndex, storyPhases.length - 1)
  const photoIndex = found === -1 || !storyPhases ? 0 : Math.min(state.photoIndex, storyPhases[phaseIndex].photos.length - 1)
  const position = useMemo<PortfolioPosition>(() => ({ projectIndex, phaseIndex, photoIndex }), [projectIndex, phaseIndex, photoIndex])

  const goTo = useCallback((target: PortfolioPosition) => {
    const match = matches[target.projectIndex]
    if (match) {
      setState({ projectId: match.row.project.id, phaseIndex: target.phaseIndex, photoIndex: target.photoIndex })
    }
  }, [matches])

  const advance = useCallback(() => {
    if (photoCounts) {
      goTo(nextPhotoPosition(position, photoCounts, matches.length))
    }
  }, [goTo, position, photoCounts, matches.length])

  const jumpToProject = useCallback((index: number) => {
    if (index !== projectIndex) {
      goTo({ projectIndex: index, phaseIndex: 0, photoIndex: 0 })
    }
  }, [goTo, projectIndex])

  const next = useCallback(() => jumpToProject(Math.min(projectIndex + 1, matches.length - 1)), [jumpToProject, projectIndex, matches.length])
  const prev = useCallback(() => jumpToProject(Math.max(projectIndex - 1, 0)), [jumpToProject, projectIndex])
  const jumpToPhase = useCallback((index: number) => goTo({ projectIndex, phaseIndex: index, photoIndex: 0 }), [goTo, projectIndex])
  const jumpToPhoto = useCallback((index: number) => goTo({ projectIndex, phaseIndex, photoIndex: index }), [goTo, projectIndex, phaseIndex])

  return {
    current,
    storyPhases,
    position,
    lastPhoto: photoCounts !== null && isLastPhoto(position, photoCounts),
    advance,
    next,
    prev,
    jumpToPhase,
    jumpToPhoto,
    jumpToProject,
  }
}
```

- [ ] **Step 6: Verify** — `position: ok`; `pnpm tsc`; `pnpm lint`.

- [ ] **Step 7: Commit**

```bash
git add src/features/meeting-flow/lib/portfolio-position.ts src/features/meeting-flow/hooks/use-portfolio-project-detail.ts src/features/meeting-flow/hooks/use-portfolio-navigation.ts
git commit -m "feat(meeting-flow): portfolio navigation across projects, story phases and photos

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/lib/portfolio-position.ts src/features/meeting-flow/hooks/use-portfolio-project-detail.ts src/features/meeting-flow/hooks/use-portfolio-navigation.ts
```

---

### Task 7: Space through the flow's key owner

**Files:**
- Modify: `src/features/meeting-flow/constants/keyboard-hints.ts`
- Modify: `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (type import line 4; ref line 82)

**Interfaces:**
- Consumes: `MeetingStepHandle` (Task 5).
- Produces: `KEY_SHORTCUTS.portfolio`; `ACTIVATABLE_TARGET_SELECTOR`; `useMeetingFlowKeys({ presentationRef: RefObject<MeetingStepHandle | null>, … })`.

- [ ] **Step 1: Constants** — in `keyboard-hints.ts`:

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

Below `TYPING_TARGET_SELECTOR`:

```ts
/** Controls the browser already activates on Space; the flow must not act on the same press. */
export const ACTIVATABLE_TARGET_SELECTOR = 'button, a[href], summary, [role="button"], [role="link"], [role="tab"]'
```

- [ ] **Step 2: The view's ref** — in `meeting-flow.tsx`, drop the `PresentationHandle` type import (line 4), add `MeetingStepHandle` to the `@/features/meeting-flow/types` import (line 3), and line 82: `const presentationRef = useRef<MeetingStepHandle>(null)`. (`WhoWeAreStep`'s `Ref<PresentationHandle>` still accepts it.)

- [ ] **Step 3: The hook's argument** — in `use-meeting-flow-keys.ts`, import `MeetingStepHandle` from `@/features/meeting-flow/types` instead of `PresentationHandle`:

```ts
  /** `current` is null on page steps; arrows then fall through to the browser. `advance` exists only on steps where Space means something. */
  presentationRef: RefObject<MeetingStepHandle | null>
```

- [ ] **Step 4: The Space case** — import `ACTIVATABLE_TARGET_SELECTOR` with the other keyboard-hint constants; add before `case 'p':`:

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

Held Space never repeats: `' '` is not in `REPEATABLE_KEYS`.

- [ ] **Step 5: Verify** — `pnpm tsc`; `pnpm lint`. (No step has `advance` until Task 9, so Space stays a no-op meanwhile.)

- [ ] **Step 6: Commit**

```bash
git add src/features/meeting-flow/constants/keyboard-hints.ts src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/ui/views/meeting-flow.tsx
git commit -m "feat(meeting-flow): Space advances a step that asks for it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/constants/keyboard-hints.ts src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/ui/views/meeting-flow.tsx
```

---

### Task 8: Portfolio step components

**Files (all new, `src/features/meeting-flow/ui/components/steps/portfolio/`):** `project-photo.tsx`, `match-pills.tsx`, `project-heading.tsx`, `story-lines.tsx`, `story-phase-bar.tsx`, `story-phase-photos.tsx`, `space-cue.tsx`, `project-list-card.tsx`, `project-list.tsx`, `project-list-sheet.tsx`, `project-list-row.tsx`, `portfolio-step-layout.tsx`

**Interfaces:**
- Consumes: Tasks 2, 5; `OptimizedImage`; `getOptimizedSrc` / `getOptimizedSrcSet`; `SHOWCASE_CROSSFADE`; shadcn `Sheet*`; `Skeleton`; `cn`.
- Produces the props below; Task 9 composes them.

Styling: presentation tokens only (`text-presentation-title|body|label`, `gap|p|m-presentation-tight|group|zone`), `text-white` on the ground, accent `text-(--presentation-accent)` / `bg-(--presentation-accent)`, targets ≥44px (`min-h-11`), focus `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white`.

- [ ] **Step 1: `project-photo.tsx`**

```tsx
'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect } from 'react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { SHOWCASE_CROSSFADE } from '@/features/meeting-flow/constants/showcase'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { getOptimizedSrc, getOptimizedSrcSet } from '@/shared/lib/get-optimized-urls'

interface ProjectPhotoProps {
  file: ProjectMediaFile
  alt: string
  /** The photo Space shows next; fetched now so the crossfade never lands on a blank frame. */
  upcoming: ProjectMediaFile | null
  canAdvance: boolean
  onAdvance: () => void
}

export function ProjectPhoto({ file, alt, upcoming, canAdvance, onAdvance }: ProjectPhotoProps) {
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

- [ ] **Step 2: `match-pills.tsx` and `project-heading.tsx`**

```tsx
// match-pills.tsx
interface MatchPillsProps {
  labels: string[]
}

export function MatchPills({ labels }: MatchPillsProps) {
  if (labels.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-wrap gap-presentation-tight">
      {labels.map(label => (
        <li key={label} className="rounded-full bg-(--presentation-accent) px-3 py-1 text-presentation-label font-semibold text-(--presentation-ground)">
          {label}
        </li>
      ))}
    </ul>
  )
}
```

```tsx
// project-heading.tsx
import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { formatPortfolioMeta } from '@/features/meeting-flow/lib/format-portfolio-meta'
import { MatchPills } from '@/features/meeting-flow/ui/components/steps/portfolio/match-pills'

interface ProjectHeadingProps {
  match: PortfolioMatch
}

export function ProjectHeading({ match }: ProjectHeadingProps) {
  const { project } = match.row
  return (
    <div className="grid justify-items-start gap-presentation-tight [text-shadow:0_2px_12px_rgb(0_0_0/0.5)]">
      <h2 className="font-sans text-presentation-title leading-[1.05] font-semibold tracking-tight text-balance">{project.title}</h2>
      <p className="text-presentation-label text-white/80">{formatPortfolioMeta(project)}</p>
      <MatchPills labels={match.matchLabels} />
    </div>
  )
}
```

- [ ] **Step 3: `story-lines.tsx`** (Review Focus 4)

```tsx
import type { ProjectStoryLine } from '@/shared/modules/projects/core/types'

interface StoryLinesProps {
  lines: ProjectStoryLine[]
}

export function StoryLines({ lines }: StoryLinesProps) {
  if (lines.length === 0) {
    return null
  }
  return (
    // Long stories scroll here rather than pushing the phase bar under the capsule.
    <div className="grid max-h-[28cqh] gap-presentation-tight overflow-y-auto overscroll-contain pr-2 [text-shadow:0_1px_8px_rgb(0_0_0/0.6)]">
      {lines.map(line => (
        <p key={line.part} className="text-presentation-body leading-snug text-white">
          <span className="block text-presentation-label font-bold tracking-widest text-(--presentation-accent) uppercase">{line.label}</span>
          {line.text}
        </p>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: `story-phase-bar.tsx`**

```tsx
import type { ProjectStoryPhase } from '@/shared/modules/projects/core/types'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { cn } from '@/shared/lib/utils'

interface StoryPhaseBarProps {
  /** Null while the project's photos load. */
  storyPhases: ProjectStoryPhase[] | null
  phaseIndex: number
  photoIndex: number
  onSelect: (phaseIndex: number) => void
}

export function StoryPhaseBar({ storyPhases, phaseIndex, photoIndex, onSelect }: StoryPhaseBarProps) {
  if (!storyPhases) {
    return <Skeleton className="h-11 w-full bg-white/10" />
  }
  return (
    <div className="grid auto-cols-fr grid-flow-col gap-1.5">
      {storyPhases.map((storyPhase, index) => {
        const fill = index < phaseIndex ? 1 : index === phaseIndex ? (photoIndex + 1) / storyPhase.photos.length : 0
        const active = index === phaseIndex
        const count = storyPhase.photos.length
        return (
          <button
            key={storyPhase.phase}
            aria-current={active ? 'step' : undefined}
            aria-label={`${storyPhase.label}, ${count} ${count === 1 ? 'photo' : 'photos'}`}
            className={cn(
              'relative min-h-11 overflow-hidden rounded-md bg-white/12 px-3 text-left text-presentation-label font-bold tracking-[0.08em] text-white/80 uppercase',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
              active && 'text-white ring-1 ring-white/50',
            )}
            type="button"
            onClick={() => onSelect(index)}
          >
            <span aria-hidden className="absolute inset-0 origin-left bg-(--presentation-accent) transition-transform duration-300 motion-reduce:transition-none" style={{ transform: `scaleX(${fill})` }} />
            <span className={cn('relative', fill === 1 && 'text-(--presentation-ground)')}>{storyPhase.label}</span>
            <span className="relative ml-1.5 font-semibold tracking-normal normal-case opacity-80">{count}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: `story-phase-photos.tsx`**

```tsx
'use client'

import type { ProjectMediaFile } from '@/shared/db/schema'
import { useEffect, useRef } from 'react'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { cn } from '@/shared/lib/utils'

interface StoryPhasePhotosProps {
  photos: ProjectMediaFile[]
  photoIndex: number
  phaseLabel: string
  onSelect: (photoIndex: number) => void
}

export function StoryPhasePhotos({ photos, photoIndex, phaseLabel, onSelect }: StoryPhasePhotosProps) {
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
          aria-label={`${phaseLabel} photo ${index + 1} of ${photos.length}`}
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

- [ ] **Step 6: `space-cue.tsx`**

```tsx
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'

interface SpaceCueProps {
  /** The next project's title on a project's last photo; absent on the opening photo. */
  nextTitle?: string
}

export function SpaceCue({ nextTitle }: SpaceCueProps) {
  return (
    <span aria-hidden className="inline-flex w-fit items-center gap-2 rounded-md bg-(--presentation-ground)/80 px-3 py-1.5 text-presentation-label font-semibold text-white backdrop-blur-sm">
      {nextTitle ? `${PORTFOLIO_COPY.nextCue} ${nextTitle}` : PORTFOLIO_COPY.startCue}
      <kbd className="rounded-sm border border-b-2 border-white/40 px-1.5 text-[0.85em] font-semibold">Space</kbd>
    </span>
  )
}
```

- [ ] **Step 7: `project-list-card.tsx` and `project-list.tsx`**

```tsx
// project-list-card.tsx
import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { OptimizedImage } from '@/shared/components/optimized-image'
import { cn } from '@/shared/lib/utils'

interface ProjectListCardProps {
  match: PortfolioMatch
  number: number
  active: boolean
  /** The narrow row: number and title only. */
  compact?: boolean
  onSelect: () => void
}

export function ProjectListCard({ match, number, active, compact = false, onSelect }: ProjectListCardProps) {
  const { project } = match.row
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
        <span className="relative h-11.5 w-16 overflow-hidden rounded-sm">
          <OptimizedImage alt="" className="object-cover" fill file={match.row.heroImage} sizes="64px" />
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate font-sans text-sm font-bold">{project.title}</span>
        {!compact && match.matchLabels.length > 0 && (
          <span className="block truncate text-xs text-white/70">{match.matchLabels.join(' · ')}</span>
        )}
      </span>
      <span className={cn('grid size-6 place-items-center rounded-full bg-white/15 text-xs font-bold', active && 'bg-(--presentation-accent) text-(--presentation-ground)')}>
        {number}
      </span>
    </button>
  )
}
```

```tsx
// project-list.tsx
import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { groupPortfolioMatches } from '@/features/meeting-flow/lib/group-portfolio-matches'
import { ProjectListCard } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list-card'

interface ProjectListProps {
  matches: PortfolioMatch[]
  activeIndex: number
  /** Selections exist but nothing matched their scopes or trades. */
  showNoMatchNote: boolean
  onSelect: (index: number) => void
}

export function ProjectList({ matches, activeIndex, showNoMatchNote, onSelect }: ProjectListProps) {
  return (
    <div className="grid gap-presentation-group">
      {showNoMatchNote && <p className="text-presentation-label text-white/70">{PORTFOLIO_COPY.noMatches}</p>}
      {groupPortfolioMatches(matches).map(section => (
        <section key={section.label} aria-label={section.label} className="grid gap-1.5">
          <h3 className="text-presentation-label font-bold tracking-[0.06em] text-white/70 uppercase">{section.label}</h3>
          {section.items.map(({ match, index }) => (
            <ProjectListCard key={match.row.project.id} active={index === activeIndex} match={match} number={index + 1} onSelect={() => onSelect(index)} />
          ))}
        </section>
      ))}
    </div>
  )
}
```

- [ ] **Step 8: `project-list-sheet.tsx` and `project-list-row.tsx`**

```tsx
// project-list-sheet.tsx
'use client'

import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { useState } from 'react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { ProjectList } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/shared/components/ui/sheet'

interface ProjectListSheetProps {
  matches: PortfolioMatch[]
  activeIndex: number
  showNoMatchNote: boolean
  onSelect: (index: number) => void
}

export function ProjectListSheet({ matches, activeIndex, showNoMatchNote, onSelect }: ProjectListSheetProps) {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger className="min-h-11 shrink-0 rounded-md border border-white/35 px-3 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
        {PORTFOLIO_COPY.allProjects(matches.length)}
      </SheetTrigger>
      <SheetContent className="max-h-[80dvh] overflow-y-auto border-white/10 bg-[oklch(var(--presentation-scrim))] p-5 text-white" side="bottom">
        <SheetTitle className="text-white">{PORTFOLIO_COPY.listTitle}</SheetTitle>
        <ProjectList
          activeIndex={activeIndex}
          matches={matches}
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
// project-list-row.tsx
import type { PortfolioMatch } from '@/features/meeting-flow/types'
import { PROJECT_LIST_ROW_COUNT } from '@/features/meeting-flow/constants/portfolio-step'
import { ProjectListCard } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list-card'
import { ProjectListSheet } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list-sheet'

interface ProjectListRowProps {
  matches: PortfolioMatch[]
  activeIndex: number
  showNoMatchNote: boolean
  onSelect: (index: number) => void
}

export function ProjectListRow({ matches, activeIndex, showNoMatchNote, onSelect }: ProjectListRowProps) {
  const start = Math.max(0, Math.min(activeIndex, matches.length - PROJECT_LIST_ROW_COUNT))
  return (
    <div className="flex items-stretch gap-1.5">
      <div className="grid min-w-0 flex-1 auto-cols-fr grid-flow-col gap-1.5">
        {matches.slice(start, start + PROJECT_LIST_ROW_COUNT).map((match, offset) => (
          <ProjectListCard key={match.row.project.id} active={start + offset === activeIndex} compact match={match} number={start + offset + 1} onSelect={() => onSelect(start + offset)} />
        ))}
      </div>
      <ProjectListSheet activeIndex={activeIndex} matches={matches} showNoMatchNote={showNoMatchNote} onSelect={onSelect} />
    </div>
  )
}
```

- [ ] **Step 9: `portfolio-step-layout.tsx`**

```tsx
import type { ReactNode } from 'react'
import { KEY_SHORTCUTS } from '@/features/meeting-flow/constants/keyboard-hints'

interface PortfolioStepLayoutProps {
  labelledBy: string
  photo: ReactNode
  heading: ReactNode
  /** The project list as a column; shown on wide steps only. */
  listColumn: ReactNode
  /** The project list as a row with "All N"; shown on narrow steps only. */
  listRow: ReactNode
  story: ReactNode
  /** Read by screen readers when the project or story phase changes. */
  announcement: string
}

/**
 * The step root. `data-step-root` + `tabIndex={-1}` let the view focus it after a step change, as it
 * focuses a page step's region. Overlays pass pointer events through to the photo except on controls.
 */
export function PortfolioStepLayout({ labelledBy, photo, heading, listColumn, listRow, story, announcement }: PortfolioStepLayoutProps) {
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
          <div className="pointer-events-auto hidden max-h-[calc(100cqh-var(--stage-clear-b)-2rem)] w-75 shrink-0 overflow-y-auto overscroll-contain pr-1 @5xl/portfolio:block">{listColumn}</div>
        </div>
        <div className="mt-auto grid gap-presentation-group">
          <div className="pointer-events-auto @5xl/portfolio:hidden">{listRow}</div>
          <div className="pointer-events-auto grid max-w-190 gap-presentation-tight">{story}</div>
        </div>
      </div>
      <p aria-atomic="true" aria-live="polite" className="sr-only">{announcement}</p>
    </div>
  )
}
```

(`--stage-clear-b` is the flow frame's CSS variable for the capsule clearance, defined in `shell/stage-frame.tsx`; its name is existing code, not this plan's vocabulary.)

- [ ] **Step 10: Verify** — `pnpm tsc`; `pnpm lint` (`pnpm lint:fix` for import / attribute order).

- [ ] **Step 11: Commit**

```bash
git add src/features/meeting-flow/ui/components/steps/portfolio/
git commit -m "feat(meeting-flow): portfolio step components

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/ui/components/steps/portfolio/
```

---

### Task 9: `PortfolioStep`, wiring, removal of the grid

**Files:**
- Create: `src/features/meeting-flow/ui/components/steps/portfolio/index.tsx`
- Modify: `src/features/meeting-flow/constants/step-config.ts` (portfolio entry)
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (import line 38; presentation branch ~line 320; page branch line 331)
- Delete: `src/features/meeting-flow/ui/components/steps/portfolio-step.tsx`, `src/features/meeting-flow/ui/components/steps/trade-project-grid.tsx`

**Interfaces:**
- Consumes: everything above; `useTradeSelections` (`@/features/meeting-flow/contexts/trade-selections-context`); `useTradeCatalogContext` (`@/features/meeting-flow/contexts/trade-catalog-context`); `ErrorState`, `EmptyState`, `Skeleton`.
- Produces: `PortfolioStep({ labelledBy, ref })`, `ref?: Ref<MeetingStepHandle>`.

- [ ] **Step 1: `PortfolioStep`**

```tsx
// src/features/meeting-flow/ui/components/steps/portfolio/index.tsx
'use client'

import type { Ref } from 'react'
import type { MeetingStepHandle } from '@/features/meeting-flow/types'
import { useQuery } from '@tanstack/react-query'
import { useImperativeHandle, useMemo } from 'react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { usePortfolioNavigation } from '@/features/meeting-flow/hooks/use-portfolio-navigation'
import { matchPortfolioProjects } from '@/features/meeting-flow/lib/match-portfolio-projects'
import { PortfolioStepLayout } from '@/features/meeting-flow/ui/components/steps/portfolio/portfolio-step-layout'
import { ProjectHeading } from '@/features/meeting-flow/ui/components/steps/portfolio/project-heading'
import { ProjectList } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list'
import { ProjectListRow } from '@/features/meeting-flow/ui/components/steps/portfolio/project-list-row'
import { ProjectPhoto } from '@/features/meeting-flow/ui/components/steps/portfolio/project-photo'
import { SpaceCue } from '@/features/meeting-flow/ui/components/steps/portfolio/space-cue'
import { StoryLines } from '@/features/meeting-flow/ui/components/steps/portfolio/story-lines'
import { StoryPhaseBar } from '@/features/meeting-flow/ui/components/steps/portfolio/story-phase-bar'
import { StoryPhasePhotos } from '@/features/meeting-flow/ui/components/steps/portfolio/story-phase-photos'
import { EmptyState } from '@/shared/components/states/empty-state'
import { ErrorState } from '@/shared/components/states/error-state'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTRPC } from '@/trpc/helpers'

interface PortfolioStepProps {
  /** id of the step's visually hidden h1. */
  labelledBy: string
  /** Project and photo navigation for the flow's key map. */
  ref?: Ref<MeetingStepHandle>
}

/**
 * Step 3: one project at a time, its project story told across its story phases, the meeting's best
 * matches first. There is always a first match — by scope, by trade, or the fallback — so the step
 * never opens empty while any project has a photo.
 */
export function PortfolioStep({ labelledBy, ref }: PortfolioStepProps) {
  const trpc = useTRPC()
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const projectsQuery = useQuery({ ...trpc.projectsRouter.showroomDisplay.getAll.queryOptions(), staleTime: SHOWCASE_PROJECTS_STALE_MS })

  const matches = useMemo(
    () => matchPortfolioProjects(projectsQuery.data ?? [], selections, catalog),
    [projectsQuery.data, selections, catalog],
  )
  const nav = usePortfolioNavigation(matches)
  const { advance, next, prev } = nav

  useImperativeHandle(ref, () => ({ next, prev, advance }), [next, prev, advance])

  if (projectsQuery.isPending) {
    return (
      <PortfolioStepLayout
        announcement=""
        heading={<Skeleton className="h-12 w-2/3 bg-white/10" />}
        labelledBy={labelledBy}
        listColumn={null}
        listRow={null}
        photo={null}
        story={<Skeleton className="h-11 w-full bg-white/10" />}
      />
    )
  }

  if (projectsQuery.isError) {
    return (
      <PortfolioStepLayout
        announcement={PORTFOLIO_COPY.errorTitle}
        heading={(
          <ErrorState className="h-auto border-white/15 text-white" title={PORTFOLIO_COPY.errorTitle}>
            <button className="min-h-11 rounded-md border border-white/35 px-3 font-semibold" type="button" onClick={() => void projectsQuery.refetch()}>
              {PORTFOLIO_COPY.retry}
            </button>
          </ErrorState>
        )}
        labelledBy={labelledBy}
        listColumn={null}
        listRow={null}
        photo={null}
        story={null}
      />
    )
  }

  const { current, storyPhases, position, lastPhoto } = nav
  if (!current) {
    return (
      <PortfolioStepLayout
        announcement={PORTFOLIO_COPY.empty}
        heading={<EmptyState className="h-auto border-white/20 text-white" title={PORTFOLIO_COPY.empty} />}
        labelledBy={labelledBy}
        listColumn={null}
        listRow={null}
        photo={null}
        story={null}
      />
    )
  }

  const storyPhase = storyPhases?.[position.phaseIndex] ?? null
  const photo = storyPhase?.photos[position.photoIndex] ?? current.row.heroImage
  const upcoming = storyPhase?.photos[position.photoIndex + 1]
    ?? storyPhases?.[position.phaseIndex + 1]?.photos[0]
    ?? matches[position.projectIndex + 1]?.row.heroImage
    ?? null
  const nextProject = matches[position.projectIndex + 1]
  const showNoMatchNote = selections.length > 0 && !matches.some(match => match.kind === 'scope' || match.kind === 'trade')
  const atOpening = position.projectIndex === 0 && position.phaseIndex === 0 && position.photoIndex === 0
  const title = current.row.project.title
  const listProps = { matches, activeIndex: position.projectIndex, showNoMatchNote, onSelect: nav.jumpToProject }

  return (
    <PortfolioStepLayout
      announcement={storyPhase ? `${title}, ${storyPhase.label}` : title}
      heading={<ProjectHeading match={current} />}
      labelledBy={labelledBy}
      listColumn={<ProjectList {...listProps} />}
      listRow={<ProjectListRow {...listProps} />}
      photo={(
        <ProjectPhoto
          alt={storyPhase ? `${title} — ${storyPhase.label} photo ${position.photoIndex + 1} of ${storyPhase.photos.length}` : title}
          canAdvance={storyPhases !== null && !(lastPhoto && !nextProject)}
          file={photo}
          upcoming={upcoming}
          onAdvance={advance}
        />
      )}
      story={(
        <>
          {storyPhase && <StoryLines lines={storyPhase.story} />}
          {storyPhases && (atOpening || (lastPhoto && nextProject)) && <SpaceCue nextTitle={atOpening ? undefined : nextProject?.row.project.title} />}
          <StoryPhaseBar phaseIndex={position.phaseIndex} photoIndex={position.photoIndex} storyPhases={storyPhases} onSelect={nav.jumpToPhase} />
          {storyPhase && <StoryPhasePhotos phaseLabel={storyPhase.label} photoIndex={position.photoIndex} photos={storyPhase.photos} onSelect={nav.jumpToPhoto} />}
        </>
      )}
    />
  )
}
```

The opening cue wins when the first project's first photo is also its last (it teaches the key once).

- [ ] **Step 2: Layout** — `step-config.ts`, portfolio entry: `layout: 'presentation',`.

- [ ] **Step 3: The view** — `meeting-flow.tsx`:
  - line 38: `import { PortfolioStep } from '@/features/meeting-flow/ui/components/steps/portfolio'`
  - presentation branch, after the Who We Are line: `{stepConfig.id === 'portfolio' && <PortfolioStep ref={presentationRef} labelledBy={stepTitleId} />}`
  - delete the page-branch line `{stepConfig.id === 'portfolio' && <PortfolioStep flowContext={flowContext} />}`

- [ ] **Step 4: Delete the grid step**

```bash
git rm src/features/meeting-flow/ui/components/steps/portfolio-step.tsx src/features/meeting-flow/ui/components/steps/trade-project-grid.tsx
```

`grep -rn "steps/portfolio-step\|trade-project-grid" src` → no output.

- [ ] **Step 5: Verify** — `pnpm tsc`; `pnpm lint`.

- [ ] **Step 6: Commit**

```bash
git add src/features/meeting-flow/ui/components/steps/portfolio/index.tsx src/features/meeting-flow/constants/step-config.ts src/features/meeting-flow/ui/views/meeting-flow.tsx
git commit -m "feat(meeting-flow): the portfolio step tells one project story at a time

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/ui/components/steps/portfolio/index.tsx src/features/meeting-flow/constants/step-config.ts src/features/meeting-flow/ui/views/meeting-flow.tsx src/features/meeting-flow/ui/components/steps/portfolio-step.tsx src/features/meeting-flow/ui/components/steps/trade-project-grid.tsx
```

---

### Task 10: Browser verification on dev (read-only)

**Files:** none unless a fix is needed (fix in the owning file; commit `fix(meeting-flow): …` by explicit path).

**Setup:** `ss -ltnp | grep 3000` — reuse a running dev server, else `pnpm dev`. Auth via `/api/dev/playwright-session`. Open a dev meeting at `/dashboard/meetings/<id>?step=3`. **No database writes.** To vary selections use the meeting's own UI (step 2 / the Project panel); if that would disturb the owner's fixtures, stop and ask which meeting to use.

- [ ] **Step 1: Shape** — 1440×900 and 820×1180, light and dark dashboard theme; screenshot each. Dark ground, full-bleed photo, heading top-left, list column at 1440 / list row + "All N" at 820, story lines → phase bar → photos above the capsule, no overlap.
- [ ] **Step 2: Story-phase shapes** — `eclipse` (Before / During / After / Gallery, each part at home), `biggal` or `amoria` (During / After: challenge joins During), `emmie` (Before / After: solution joins After), `makaia` (After: whole story), a no-phase project (Gallery: whole story).
- [ ] **Step 3: Keys** — Space: photo → story phase → next project; ↓/↑ and Z/A change project; ←/→ still change steps; on Who We Are, Space does nothing new.
- [ ] **Step 4: Review Focus 1** — Tab to a phase-bar segment, press Space: it jumps to that phase's first photo once (the active thumbnail is the first, not the second).
- [ ] **Step 5: Review Focus 4** — at 820, the project with the longest challenge / solution text: story lines scroll inside their box; bar and capsule stay clear.
- [ ] **Step 6: Matches and Review Focus 2** — scope matches lead with scope pills; a trade whose scopes no project has, but whose trade does → trade-name pills; no matches → note line + "From our portfolio" (3) + "Other projects". Mid-meeting, change selections from the Project panel: the project on screen stays while still listed.
- [ ] **Step 7: Review Focus 5** — the last project's last photo: no "Next" cue; Space and ↓ inert.
- [ ] **Step 8: Reduced motion** — `prefers-reduced-motion: reduce` swaps photos without the fade.
- [ ] **Step 9: Network** — `showroomDisplay.getAll` rows carry `phaseCounts`; moving to project n fetches n+1..n+2 ahead.
- [ ] **Step 10: Retirement** — the project editor (`/dashboard/projects/<id>/edit` or its current route) has no "Timeline Phase Descriptions" section and still saves challenge / solution / result; a public project page's timeline renders with its generic lines.
- [ ] **Step 11: Final gate** — `pnpm tsc && pnpm lint` clean; `git status` shows nothing stray from this work; report screenshots, fixes, and the owner's pending `pnpm db:push:prod`.
