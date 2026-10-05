# Portfolio Step and the Project Story — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild meeting-flow step 3 as Option D — one project at a time on the dark presentation ground, its project story (challenge → solution → result) told across its story phases, with a list of portfolio matches (scope → trade → fallback) — and make challenge → solution → result the standard project story, retiring the four unused phase-text fields.

**Architecture:** Generic primitives live in the shared modules and the feature composes them. `modules/projects/media` (the project-media unit) owns media-phase code: `PHASE_LABELS`, `MediaPhaseCounts`, the grouped count read. `modules/projects/core` owns the project story (`buildProjectStoryPhases`) and the portfolio primitives (`hasHeroImage`, `compareStoryStrength`, `formatProjectCaption`, `usePortfolioProjects`). `modules/construction` gains construction P2's id resolver (`scopesById`, `resolveTrades`, `resolveScopes`), built early to P2's contract. The meeting-flow feature keeps the meeting's rules — `matchPortfolioProjects`, `usePortfolioMatches`, position and navigation — and renders a `presentation`-layout step that exposes a `MeetingStepHandle` (`next`/`prev`/`advance`) to the flow's single key owner.

**Tech Stack:** Next.js 15, React 19 (`ref` as a prop), tRPC + TanStack Query (superjson), Drizzle (Postgres, `drizzle-kit push`), Tailwind v4 container queries, `motion/react`, shadcn `Sheet`.

**Spec:** `docs/superpowers/specs/2026-09-23-portfolio-step-project-story-design.md` — read it first. Its §2 vocabulary is binding: never use walkthrough, chapter, stage, queue, tier, featured, cursor or beat in names, copy or comments. §7 W17–W19 are the placement rulings.

## Global Constraints

- **No data writes in any environment, dev included.** Read-only queries only. The one schema change (dropping four empty columns) goes to dev with `pnpm db:push:dev`; **never** `db:push:prod` — that is the owner's.
- **No test runner.** No vitest/jest, no `package.json` change. Pure-function checks are throwaway `tsx` scripts in the session scratchpad, never committed. `$SCRATCH` = `/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/b2219856-9a14-407a-ab52-f91e3f5d57d6/scratchpad` (or the executing session's own scratchpad). Run them from the repo root: `pnpm exec tsx $SCRATCH/portfolio-checks/<file>.ts` — `tsx` then resolves `@/` inside project files (verified 2026-09-23). Check files import project code by absolute path.
- Verification per task: `pnpm tsc` and `pnpm lint` clean (`pnpm lint:fix` for import order). **Never `pnpm build`.**
- **Commits:** on `main`; `git add <explicit paths>` then `git commit -m "…" -- <same paths>`. The index holds unrelated staged deletions (docs prune) that a bare `git commit` would sweep in. Never `git add -A`, never stash / checkout / reset.
- **Foreign hunks (preflight).** `git commit -- <path>` commits the whole file. On 2026-09-24 these files carried uncommitted work from other sessions: `CONTEXT.md`, `src/shared/modules/construction/core/lib/build-catalog-index.ts`, `src/features/meeting-flow/hooks/use-showcase-projects.ts`, `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts`, `src/features/meeting-flow/ui/views/meeting-flow.tsx`. Before a task edits any file, run `git diff --stat -- <file>`; if it shows changes this plan did not make, **stop and ask the owner** to land them (or to say how to proceed) — never commit them, never revert them. Same check for the two construction docs in Task 5.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Comments say why, never what.** No file banners, no restating code, no citations of plans / specs / tasks / docs in code. A `// path/to/file.ts` first line in a code block below only labels the file — do not copy it.
- One React component per file; no file-level constants in component files; components fetch nothing (data comes from hooks); named exports; `@/` → `src/`.
- **Placement (W17–W19):** anything generic about a project, its media or the catalog goes in the module named in the task, never in `features/`. Do not add a helper to the feature that a module in this plan already exports.
- **Untracked owner file:** `scripts/tmp-smoke-scopes-persist.ts` is type-checked and reads the retired fields. Never edit or delete it; when `pnpm tsc` flags it (Task 4), stop and ask the owner. Other untracked scripts (the construction P2 backfill) belong to another session: leave them alone.
- Copy (spec §2, §5): phase labels from `PHASE_LABELS` (Before, During, After, Gallery); story labels `Challenge`, `Solution`, `Result`; hero story phase `The project`; list sections `For your project`, `From our portfolio`, `Other projects`; `No finished projects match these scopes yet.`; `No portfolio projects to show yet`.
- `FALLBACK_MATCH_COUNT = 3`, `PREFETCH_AHEAD = 2`, `PROJECT_LIST_ROW_COUNT = 3`. Wide layout = `@5xl/portfolio` (≥1024px of step width).

## Review Focus

1. **Space while a control has focus** — Space on a focused story-phase segment, thumbnail or list card acts once (the button's click), never click + advance. Pinned: Task 8 Step 4 and Task 11 Step 4.
2. **Selections edited mid-meeting** — the project on screen stays while still listed; otherwise the first match shows, never a blank frame. Pinned: Task 7 (position keyed by project id) and Task 11 Step 6.
3. **`getDetail` null or errored** — the hero story phase shows and Space moves to the next project. Pinned: Task 2 Step 1 (`media === null` case) and Task 7 (`isPending` vs error).
4. **Long story text on the 820 tablet** — story lines scroll in their own box; the bar and capsule stay clear. Pinned: Task 9 (`story-lines.tsx`) and Task 11 Step 5.
5. **End of the list** — Space on the last photo of the last project and ↓ on the last project do nothing; no "Next" cue there. Pinned: Task 7 Step 1 (`nextPhotoPosition` at the end) and Task 7 (`next` clamps).

---

### Task 1: Photo counts per media phase (project-media unit)

**Files:**
- Create: `src/shared/modules/projects/media/types.ts`
- Create: `src/shared/modules/projects/media/dal/server/queries.ts`
- Modify: `src/shared/modules/projects/core/types.ts`
- Modify: `src/shared/modules/projects/core/dal/server/queries.ts` (`getPortfolioProjects`, from the `// Fetch scope IDs` comment to the end of the function)
- Scratch: `$SCRATCH/portfolio-checks/phase-counts.read.ts` (read-only, dev)

**Interfaces:**
- Produces: `type MediaPhaseCounts = Record<MediaPhase, number>` (`@/shared/modules/projects/media/types`); `getMediaPhaseCountsByProjectIds(projectIds: string[]): Promise<Map<string, MediaPhaseCounts>>` — every requested id present; `PortfolioProject.phaseCounts: MediaPhaseCounts`.

- [ ] **Step 1: The media unit's type**

```ts
// src/shared/modules/projects/media/types.ts
import type { MediaPhase } from '@/shared/constants/enums/media'

/** Photos per media phase, videos excluded; every phase present, zero when empty. */
export type MediaPhaseCounts = Record<MediaPhase, number>
```

- [ ] **Step 2: The grouped count read** — the core unit composes it, as `modules/proposals/core/dal/server/queries.ts` composes its media unit's queries.

```ts
// src/shared/modules/projects/media/dal/server/queries.ts
import type { MediaPhaseCounts } from '@/shared/modules/projects/media/types'
import { and, count, inArray, notLike } from 'drizzle-orm'
import { mediaPhases } from '@/shared/constants/enums/media'
import { db } from '@/shared/db'
import { projectMediaFiles } from '@/shared/db/schema'

/** Every requested id is in the result. Videos are left out, as the portfolio detail's phase groups leave them out. */
export async function getMediaPhaseCountsByProjectIds(projectIds: string[]): Promise<Map<string, MediaPhaseCounts>> {
  const counts = new Map(projectIds.map(id => [id, Object.fromEntries(mediaPhases.map(phase => [phase, 0])) as MediaPhaseCounts]))
  if (projectIds.length === 0) {
    return counts
  }

  const rows = await db
    .select({ projectId: projectMediaFiles.projectId, phase: projectMediaFiles.phase, total: count() })
    .from(projectMediaFiles)
    .where(and(inArray(projectMediaFiles.projectId, projectIds), notLike(projectMediaFiles.mimeType, 'video/%')))
    .groupBy(projectMediaFiles.projectId, projectMediaFiles.phase)

  for (const row of rows) {
    const entry = counts.get(row.projectId)
    if (entry) {
      entry[row.phase] = row.total
    }
  }
  return counts
}
```

- [ ] **Step 3: `PortfolioProject.phaseCounts`** — in `src/shared/modules/projects/core/types.ts` add `import type { MediaPhaseCounts } from '@/shared/modules/projects/media/types'` and:

```ts
export interface PortfolioProject {
  project: Project
  heroImage: ProjectMediaFile | null
  scopeIds: string[]
  phaseCounts: MediaPhaseCounts
}
```

- [ ] **Step 4: `getPortfolioProjects` composes it** — import `getMediaPhaseCountsByProjectIds` from `@/shared/modules/projects/media/dal/server/queries`; replace from the `// Fetch scope IDs` comment to the end of the function with:

```ts
  const projectIds = uniqueRows.map(row => row.project.id)
  const [scopeRows, phaseCounts] = await Promise.all([
    db
      .select({
        projectId: x_projectScopes.projectId,
        scopeId: x_projectScopes.scopeId,
      })
      .from(x_projectScopes)
      .where(inArray(x_projectScopes.projectId, projectIds)),
    getMediaPhaseCountsByProjectIds(projectIds),
  ])

  const scopesByProject = new Map<string, string[]>()
  for (const row of scopeRows) {
    if (!scopesByProject.has(row.projectId)) {
      scopesByProject.set(row.projectId, [])
    }
    scopesByProject.get(row.projectId)!.push(row.scopeId)
  }

  return uniqueRows.map(row => ({
    project: row.project,
    heroImage: row.heroImage,
    scopeIds: scopesByProject.get(row.project.id) ?? [],
    phaseCounts: phaseCounts.get(row.project.id)!,
  }))
}
```

- [ ] **Step 5: Read-only check on dev** (no `DRIZZLE_TARGET`, so the dev branch; SELECT only):

```ts
// $SCRATCH/portfolio-checks/phase-counts.read.ts
import '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/scripts/lib/load-env'
import assert from 'node:assert/strict'
import { getPortfolioProjects } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/core/dal/server/queries'

async function main() {
  const rows = await getPortfolioProjects()
  for (const row of rows) {
    assert.deepEqual(Object.keys(row.phaseCounts).sort(), ['after', 'before', 'during', 'uncategorized'])
  }
  const shape = (prefix: string) => {
    const counts = rows.find(row => row.project.accessor.startsWith(prefix))!.phaseCounts
    return (['before', 'during', 'after'] as const).filter(phase => counts[phase] > 0).join('+')
  }
  assert.equal(shape('eclipse'), 'before+during+after')
  assert.equal(shape('biggal'), 'during+after')
  assert.equal(shape('emmie'), 'before+after')
  assert.equal(shape('makaia'), 'after')
  console.log('phase-counts: ok', rows.length, 'rows')
  process.exit(0)
}
void main()
```

Expected before Step 4 lands: a type error or `undefined` phaseCounts. After: `phase-counts: ok 39 rows` (spec §3 dev facts). If a fixture shape differs, report it — never change data.

- [ ] **Step 6: Verify** — `pnpm tsc` clean (this DAL is the only `PortfolioProject` builder); `pnpm lint` clean.

- [ ] **Step 7: Commit**

```bash
git add src/shared/modules/projects/media/types.ts src/shared/modules/projects/media/dal/server/queries.ts src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/dal/server/queries.ts
git commit -m "feat(projects): photo counts per media phase on portfolio rows, read by the project-media unit

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/modules/projects/media/types.ts src/shared/modules/projects/media/dal/server/queries.ts src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/dal/server/queries.ts
```

---

### Task 2: The project story in `modules/projects`

**Files:**
- Move: `src/features/project-management/constants/phase-labels.ts` → `src/shared/modules/projects/media/constants/phase-labels.ts` (`git mv`, content unchanged)
- Modify: `src/features/project-management/ui/components/story-gallery.tsx` (the `PHASE_LABELS` import)
- Modify: `src/shared/modules/projects/core/types.ts` (story types)
- Create: `src/shared/modules/projects/core/constants/project-story.ts`
- Create: `src/shared/modules/projects/core/lib/build-project-story-phases.ts`
- Scratch: `$SCRATCH/portfolio-checks/fixtures.ts`, `$SCRATCH/portfolio-checks/project-story.check.ts`

**Interfaces:**
- Consumes: `MediaPhaseCounts` (Task 1).
- Produces:

```ts
type ProjectStoryPart = 'challenge' | 'solution' | 'result'
interface ProjectStoryLine { part: ProjectStoryPart, label: string, text: string }
interface ProjectStoryPhase { phase: MediaPhase | 'hero', label: string, photos: ProjectMediaFile[], story: ProjectStoryLine[] }
buildProjectStoryPhases(input: { project: Pick<Project, 'challengeDescription' | 'solutionDescription' | 'resultDescription'>, heroImage: ProjectMediaFile, media: ProjectMediaGroups | null }): ProjectStoryPhase[]
STORY_PHASE_ORDER, STORY_PART_PHASE, STORY_LABELS, HERO_STORY_PHASE_LABEL  // '@/shared/modules/projects/core/constants/project-story'
PHASE_LABELS  // now at '@/shared/modules/projects/media/constants/phase-labels'
```

- [ ] **Step 1: Write the fixtures and the check** (the fixtures serve Tasks 3, 5 and 6 too)

```ts
// $SCRATCH/portfolio-checks/fixtures.ts
import type { TradeSelection } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/entities/meetings/schemas'
import type { PortfolioProject } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/core/types'
import type { MediaPhaseCounts } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/media/types'

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

const scope = (id: string, tradeId: string) => [id, { id, name: id, kind: 'scope', tradeId }] as const
export const scopesById = new Map([
  scope('s-cabinets', 't-kitchen'), scope('s-counters', 't-kitchen'), scope('s-backsplash', 't-kitchen'),
  scope('s-windows', 't-windows'), scope('s-doors', 't-windows'),
]) as any

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

- [ ] **Step 3: Move `PHASE_LABELS` to the project-media unit**

```bash
mkdir -p src/shared/modules/projects/media/constants
git mv src/features/project-management/constants/phase-labels.ts src/shared/modules/projects/media/constants/phase-labels.ts
```

In `story-gallery.tsx` change the import to `import { PHASE_LABELS } from '@/shared/modules/projects/media/constants/phase-labels'`. Confirm no other importer: `grep -rn "project-management/constants/phase-labels" src` → no output.

- [ ] **Step 4: Story types** — append to `src/shared/modules/projects/core/types.ts` (add `MediaPhase` to the imports):

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
import { HERO_STORY_PHASE_LABEL, STORY_LABELS, STORY_PART_PHASE, STORY_PHASE_ORDER } from '@/shared/modules/projects/core/constants/project-story'
import { PHASE_LABELS } from '@/shared/modules/projects/media/constants/phase-labels'

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

- [ ] **Step 7: Verify** — the check prints `project-story: ok`; `pnpm tsc` clean; `pnpm lint` clean.

- [ ] **Step 8: Commit**

```bash
git add src/shared/modules/projects/media/constants/phase-labels.ts src/features/project-management/constants/phase-labels.ts src/features/project-management/ui/components/story-gallery.tsx src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/constants/project-story.ts src/shared/modules/projects/core/lib/build-project-story-phases.ts
git commit -m "feat(projects): the project story is challenge, solution, result across story phases

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/modules/projects/media/constants/phase-labels.ts src/features/project-management/constants/phase-labels.ts src/features/project-management/ui/components/story-gallery.tsx src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/constants/project-story.ts src/shared/modules/projects/core/lib/build-project-story-phases.ts
```

---

### Task 3: Shared portfolio primitives in `modules/projects/core`

**Files:**
- Modify: `src/shared/modules/projects/core/types.ts` (`PortfolioProjectWithHero`)
- Create: `src/shared/modules/projects/core/lib/has-hero-image.ts`
- Create: `src/shared/modules/projects/core/lib/compare-story-strength.ts`
- Create: `src/shared/modules/projects/core/lib/format-project-caption.ts`
- Create: `src/shared/modules/projects/core/hooks/use-portfolio-projects.ts`
- Modify: `src/features/meeting-flow/types/index.ts` (`ShowcaseProject.duration` → `projectDuration`)
- Modify: `src/features/meeting-flow/lib/index-showcase-projects.ts` (the field rename only)
- Modify: `src/features/meeting-flow/lib/to-showcase-media.ts`
- Delete: `src/features/meeting-flow/lib/format-project-caption.ts`
- Scratch: `$SCRATCH/portfolio-checks/portfolio-primitives.check.ts`

**Interfaces:**
- Consumes: `PortfolioProject.phaseCounts` (Task 1); `STORY_PART_PHASE` (Task 2).
- Produces:

```ts
type PortfolioProjectWithHero = PortfolioProject & { heroImage: ProjectMediaFile }   // core/types
hasHeroImage(row: PortfolioProject): row is PortfolioProjectWithHero
compareStoryStrength(a: StoryStrengthInput, b: StoryStrengthInput): number   // StoryStrengthInput = { project: Pick<Project, 'title'>, phaseCounts: MediaPhaseCounts }
formatProjectCaption(project: { city: string | null, state: string | null, projectDuration: string | null }): string
usePortfolioProjects(options?: { staleTime?: number }): UseQueryResult<PortfolioProject[]>
```

- [ ] **Step 1: Write the check**

```ts
// $SCRATCH/portfolio-checks/portfolio-primitives.check.ts
import assert from 'node:assert/strict'
import { compareStoryStrength } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/core/lib/compare-story-strength'
import { formatProjectCaption } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/core/lib/format-project-caption'
import { hasHeroImage } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/projects/core/lib/has-hero-image'
import { row } from './fixtures'

const order = (rows: ReturnType<typeof row>[]) => [...rows].sort(compareStoryStrength).map(r => r.project.id)

assert.deepEqual(order([
  row('gallery-only', { phases: { uncategorized: 40 } }),
  row('two-few', { phases: { during: 1, after: 1 } }),
  row('two-many', { phases: { during: 8, after: 8 } }),
  row('full', { phases: { before: 2, during: 5, after: 4 } }),
]), ['full', 'two-many', 'two-few', 'gallery-only'], 'phases first, then story photos; Gallery never counts')
assert.deepEqual(order([row('b', { title: 'Beta' }), row('a', { title: 'Alpha' })]), ['a', 'b'], 'ties fall to title')

assert.equal(formatProjectCaption({ city: 'Long Beach', state: 'CA', projectDuration: '6 weeks' }), 'Long Beach, CA · 6 weeks')
assert.equal(formatProjectCaption({ city: 'Long Beach', state: null, projectDuration: null }), 'Long Beach')
assert.equal(formatProjectCaption({ city: '', state: 'CA', projectDuration: '3 days' }), 'CA · 3 days')
assert.equal(formatProjectCaption({ city: null, state: null, projectDuration: null }), '')

assert.equal(hasHeroImage(row('x')), true)
assert.equal(hasHeroImage(row('y', { hero: false })), false)
console.log('portfolio-primitives: ok')
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module …/compare-story-strength`)

- [ ] **Step 3: The hero type and predicate** — in `core/types.ts`, below `PortfolioProject`:

```ts
/** A portfolio row the portfolio surfaces can show: it has a hero image. */
export type PortfolioProjectWithHero = PortfolioProject & { heroImage: ProjectMediaFile }
```

```ts
// src/shared/modules/projects/core/lib/has-hero-image.ts
import type { PortfolioProject, PortfolioProjectWithHero } from '@/shared/modules/projects/core/types'

export function hasHeroImage(row: PortfolioProject): row is PortfolioProjectWithHero {
  return row.heroImage !== null
}
```

- [ ] **Step 4: Story strength**

```ts
// src/shared/modules/projects/core/lib/compare-story-strength.ts
import type { Project } from '@/shared/db/schema'
import type { MediaPhaseCounts } from '@/shared/modules/projects/media/types'
import { STORY_PART_PHASE } from '@/shared/modules/projects/core/constants/project-story'

interface StoryStrengthInput {
  project: Pick<Project, 'title'>
  phaseCounts: MediaPhaseCounts
}

function storyPhotoCounts({ phaseCounts }: StoryStrengthInput): number[] {
  return Object.values(STORY_PART_PHASE).map(phase => phaseCounts[phase])
}

/**
 * Stronger story first: more of the story's phases with photos, then more photos across them, then
 * title so the order is stable. Gallery photos carry no part of the story, so they never count.
 */
export function compareStoryStrength(a: StoryStrengthInput, b: StoryStrengthInput): number {
  const countsA = storyPhotoCounts(a)
  const countsB = storyPhotoCounts(b)
  const phasesWithPhotos = (counts: number[]) => counts.filter(n => n > 0).length
  const photos = (counts: number[]) => counts.reduce((sum, n) => sum + n, 0)
  return phasesWithPhotos(countsB) - phasesWithPhotos(countsA)
    || photos(countsB) - photos(countsA)
    || a.project.title.localeCompare(b.project.title)
}
```

- [ ] **Step 5: The project caption**

```ts
// src/shared/modules/projects/core/lib/format-project-caption.ts
interface ProjectCaptionInput {
  city: string | null
  state: string | null
  projectDuration: string | null
}

export function formatProjectCaption(project: ProjectCaptionInput): string {
  const place = [project.city, project.state].filter(Boolean).join(', ')
  return [place, project.projectDuration].filter(Boolean).join(' · ')
}
```

Meeting-flow moves onto it:
- `types/index.ts` `ShowcaseProject`: rename `duration: string | null` → `projectDuration: string | null`.
- `lib/index-showcase-projects.ts`: `duration: row.project.projectDuration,` → `projectDuration: row.project.projectDuration,`.
- `lib/to-showcase-media.ts`:

```ts
import type { ShowcaseMedia, ShowcaseProject, TradePhoto } from '@/features/meeting-flow/types'
import { SPECIALTIES_COPY } from '@/features/meeting-flow/constants/specialties-copy'
import { formatProjectCaption } from '@/shared/modules/projects/core/lib/format-project-caption'

export function curatedMedia(photo: TradePhoto): ShowcaseMedia {
  return { key: photo.src, kind: 'curated', photo, caption: photo.alt }
}

export function projectMedia(project: ShowcaseProject): ShowcaseMedia {
  const caption = [SPECIALTIES_COPY.showcase.projectCaptionLead, formatProjectCaption(project)].filter(Boolean).join(' · ')
  return { key: `project:${project.id}`, kind: 'project', file: project.heroImage, caption }
}
```

- `git rm src/features/meeting-flow/lib/format-project-caption.ts`; `grep -rn "meeting-flow/lib/format-project-caption" src` → no output. The specialties caption text is unchanged ("Tri Pros project · Long Beach, CA · 6 weeks").

- [ ] **Step 6: The portfolio list hook** (the construction module's `useConstructionCatalog` is the precedent for a module read hook)

```ts
// src/shared/modules/projects/core/hooks/use-portfolio-projects.ts
'use client'

import { useQuery } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

interface UsePortfolioProjectsOptions {
  staleTime?: number
}

/**
 * The public portfolio list, for every client surface; when its procedure changes, only this file does.
 * Options are spread only when passed, so the query client's default `staleTime` holds otherwise.
 */
export function usePortfolioProjects(options: UsePortfolioProjectsOptions = {}) {
  const trpc = useTRPC()
  return useQuery({ ...trpc.projectsRouter.showroomDisplay.getAll.queryOptions(), ...options })
}
```

- [ ] **Step 7: Verify** — `portfolio-primitives: ok`; `pnpm tsc`; `pnpm lint`.

- [ ] **Step 8: Commit**

```bash
git add src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/lib/has-hero-image.ts src/shared/modules/projects/core/lib/compare-story-strength.ts src/shared/modules/projects/core/lib/format-project-caption.ts src/shared/modules/projects/core/hooks/use-portfolio-projects.ts src/features/meeting-flow/types/index.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/lib/to-showcase-media.ts
git commit -m "feat(projects): hero, story-strength, caption and list-read primitives for portfolio surfaces

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/modules/projects/core/types.ts src/shared/modules/projects/core/lib/has-hero-image.ts src/shared/modules/projects/core/lib/compare-story-strength.ts src/shared/modules/projects/core/lib/format-project-caption.ts src/shared/modules/projects/core/hooks/use-portfolio-projects.ts src/features/meeting-flow/types/index.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/lib/to-showcase-media.ts src/features/meeting-flow/lib/format-project-caption.ts
```

---

### Task 4: Retire the phase-text fields

**Files:**
- Modify: `src/shared/db/schema/projects.ts:32-35` (drop the four columns)
- Modify: `src/shared/modules/projects/core/schemas/index.ts:39-42, 80-83`
- Modify: `src/features/project-management/ui/views/edit-project-view.tsx:91-94`
- Modify: `src/features/project-management/ui/components/form/story-content-fields.tsx` (the "Timeline Phase Descriptions" block; the three story `FormLabel`s)
- Modify: `src/features/project-management/constants/phase-config.ts`
- Modify: `src/features/project-management/ui/components/story-timeline.tsx` (description map, `project` prop, labels)
- Modify: `src/features/project-management/ui/views/project-story-view.tsx:57`

**Interfaces:**
- Consumes: `STORY_LABELS` (Task 2), `PHASE_LABELS` (Task 2, project-media unit).
- Produces: `projects` table and `Project` type without `beforeDescription`, `duringDescription`, `afterDescription`, `mainDescription`; `PHASE_CONFIG: { key: MediaPhase, fallbackDescription: string }[]`; `StoryTimeline({ media })`.

- [ ] **Step 1: Drop the columns** — delete these four lines from `src/shared/db/schema/projects.ts`:

```ts
  beforeDescription: text('before_description'),
  duringDescription: text('during_description'),
  afterDescription: text('after_description'),
  mainDescription: text('main_description'),
```

- [ ] **Step 2: Form schema and defaults** — delete the four `…Description: z.string().nullable().optional(),` lines (39–42) and the four `…Description: null,` lines (80–83) in `modules/projects/core/schemas/index.ts`.

- [ ] **Step 3: Editor** — delete lines 91–94 in `edit-project-view.tsx` (`beforeDescription: p.beforeDescription ?? null,` … `mainDescription: …`). In `story-content-fields.tsx`, delete the whole "Timeline Phase Descriptions" block (its container `div`, the `h3`, the helper `p` and the four `FormField`s), leaving the preceding block and `</section>`. The story fields read the standard labels: import `STORY_LABELS` from `@/shared/modules/projects/core/constants/project-story` and write `<FormLabel>{STORY_LABELS.challenge}</FormLabel>`, `{STORY_LABELS.solution}`, `{STORY_LABELS.result}` in place of the three literals.

- [ ] **Step 4: The timeline reads no phase text and restates no labels** — `phase-config.ts`:

```ts
import type { MediaPhase } from '@/shared/constants/enums/media'

export const PHASE_CONFIG: { key: MediaPhase, fallbackDescription: string }[] = [
  { key: 'before', fallbackDescription: 'Where the project began' },
  { key: 'during', fallbackDescription: 'The transformation in progress' },
  { key: 'after', fallbackDescription: 'The finished result' },
]
```

In `story-timeline.tsx`, remove the `Project` type import and the `project` prop, import `PHASE_LABELS` from `@/shared/modules/projects/media/constants/phase-labels`, and build phases from the config alone:

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
        label: PHASE_LABELS[cfg.key],
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
git add src/shared/db/schema/projects.ts src/shared/modules/projects/core/schemas/index.ts src/features/project-management/ui/views/edit-project-view.tsx src/features/project-management/ui/components/form/story-content-fields.tsx src/features/project-management/constants/phase-config.ts src/features/project-management/ui/components/story-timeline.tsx src/features/project-management/ui/views/project-story-view.tsx
git commit -m "refactor(projects): retire the per-phase caption fields for the project story

The four columns were empty in every environment. Prod needs db:push:prod.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/db/schema/projects.ts src/shared/modules/projects/core/schemas/index.ts src/features/project-management/ui/views/edit-project-view.tsx src/features/project-management/ui/components/form/story-content-fields.tsx src/features/project-management/constants/phase-config.ts src/features/project-management/ui/components/story-timeline.tsx src/features/project-management/ui/views/project-story-view.tsx
```

---

### Task 5: The construction resolver (construction P2 F9, built early) and the showcase index

Build exactly what `docs/superpowers/specs/2026-09-22-construction-p2-rules-and-identity-design.md` §4.1, §4.5 and §4.7-C specify for these files — its names, its shapes. Read those three sections first. Nothing beyond them: P2 plan 2 owns every other F9 site.

**Files:**
- Modify: `src/shared/modules/construction/core/lib/build-catalog-index.ts` ⚠️ preflight (foreign hunk on 2026-09-24)
- Create: `src/shared/modules/construction/core/lib/resolve-catalog-ids.ts`
- Modify: `src/features/meeting-flow/lib/index-showcase-projects.ts`
- Modify: `src/features/meeting-flow/hooks/use-showcase-projects.ts` ⚠️ preflight (foreign hunk on 2026-09-24)
- Modify: `src/features/meeting-flow/contexts/trade-selection-provider.tsx:59`
- Modify (Step 7): `docs/superpowers/specs/2026-09-22-construction-p2-rules-and-identity-design.md`, `docs/plans/2026-09-15-construction-data-standardization-epic.md` ⚠️ preflight
- Scratch: `$SCRATCH/portfolio-checks/catalog-index.check.ts`

**Interfaces:**
- Consumes: `hasHeroImage` (Task 3), `usePortfolioProjects` (Task 3).
- Produces: `CatalogIndex.scopesById: ReadonlyMap<string, Scope>`; `resolveTrades(ids: readonly string[], index: Pick<CatalogIndex, 'tradesById'>): ResolvedCatalogIds<Trade>`; `resolveScopes(ids: readonly string[], index: Pick<CatalogIndex, 'scopesById'>): ResolvedCatalogIds<Scope>`; `ResolvedCatalogIds<T> = { found: T[], orphans: string[] }`; `indexShowcaseProjects(projects, scopesById)`; `useShowcaseProjects(scopesById)`.

- [ ] **Step 0: Preflight** — `git diff --stat -- src/shared/modules/construction/core/lib/build-catalog-index.ts src/features/meeting-flow/hooks/use-showcase-projects.ts docs/superpowers/specs/2026-09-22-construction-p2-rules-and-identity-design.md docs/plans/2026-09-15-construction-data-standardization-epic.md`. Any output → stop and ask the owner (Global Constraints).

- [ ] **Step 1: Write the check**

```ts
// $SCRATCH/portfolio-checks/catalog-index.check.ts
import type { Scope, Trade } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/construction/core/schemas'
import assert from 'node:assert/strict'
import { buildCatalogIndex } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/construction/core/lib/build-catalog-index'
import { resolveScopes, resolveTrades } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/shared/modules/construction/core/lib/resolve-catalog-ids'

const trades = [{ id: 't-kitchen', name: 'Kitchen', slug: 'kitchen', coverImageUrl: null, scopeIds: [] }] as unknown as Trade[]
const scopes = [
  { id: 's-cabinets', name: 'Cabinets', kind: 'scope', unitOfPricing: 'unit', coverImageUrl: null, tradeId: 't-kitchen', sowIds: [] },
  { id: 'a-lighting', name: 'Under-cabinet lighting', kind: 'addon', unitOfPricing: 'unit', coverImageUrl: null, tradeId: 't-kitchen', sowIds: [] },
] as unknown as Scope[]

const index = buildCatalogIndex(trades, scopes)
assert.equal(index.scopesById.get('s-cabinets')?.tradeId, 't-kitchen')
assert.equal(index.scopesById.get('a-lighting')?.kind, 'addon', 'add-ons are indexed too')

const resolvedScopes = resolveScopes(['a-lighting', 'gone', 's-cabinets'], index)
assert.deepEqual(resolvedScopes.found.map(scope => scope.id), ['a-lighting', 's-cabinets'], 'stored order')
assert.deepEqual(resolvedScopes.orphans, ['gone'], 'orphans returned, not dropped')

const resolvedTrades = resolveTrades(['gone', 't-kitchen'], index)
assert.deepEqual(resolvedTrades.found.map(trade => trade.id), ['t-kitchen'])
assert.deepEqual(resolvedTrades.orphans, ['gone'])
console.log('catalog-index: ok')
```

- [ ] **Step 2: Run it — expect FAIL** (`Cannot find module …/resolve-catalog-ids`)

- [ ] **Step 3: `scopesById`** — in `build-catalog-index.ts`:

```ts
export interface CatalogIndex {
  trades: Trade[]
  tradesById: ReadonlyMap<string, Trade>
  tradesBySlug: ReadonlyMap<string, Trade>
  scopesByTrade: ReadonlyMap<string, TradeScopeGroup>
  /** Scopes and add-ons by id: the one scope → trade lookup (`scopesById.get(id)?.tradeId`). */
  scopesById: ReadonlyMap<string, Scope>
}

export function buildCatalogIndex(trades: Trade[], scopes: Scope[]): CatalogIndex {
  const scopesByTrade = new Map<string, TradeScopeGroup>()
  const scopesById = new Map<string, Scope>()
  for (const scope of scopes) {
    const group = scopesByTrade.get(scope.tradeId) ?? { scopes: [], addons: [] }
    if (scope.kind === 'addon') {
      group.addons.push(scope)
    }
    else {
      group.scopes.push(scope)
    }
    scopesByTrade.set(scope.tradeId, group)
    scopesById.set(scope.id, scope)
  }

  return {
    trades,
    tradesById: new Map(trades.map(trade => [trade.id, trade])),
    tradesBySlug: new Map(trades.map(trade => [trade.slug, trade])),
    scopesByTrade,
    scopesById,
  }
}
```

- [ ] **Step 4: The resolver**

```ts
// src/shared/modules/construction/core/lib/resolve-catalog-ids.ts
import type { CatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import type { Scope, Trade } from '@/shared/modules/construction/core/schemas'

export interface ResolvedCatalogIds<T> {
  found: T[]
  orphans: string[]
}

function resolveIds<T>(ids: readonly string[], byId: ReadonlyMap<string, T>): ResolvedCatalogIds<T> {
  const found: T[] = []
  const orphans: string[] = []
  for (const id of ids) {
    const entry = byId.get(id)
    if (entry) {
      found.push(entry)
    }
    else {
      orphans.push(id)
    }
  }
  return { found, orphans }
}

/** Stored ids to catalog entries, in stored order. An id the catalog no longer has comes back as an orphan; what an orphan means is the caller's call. */
export function resolveTrades(ids: readonly string[], index: Pick<CatalogIndex, 'tradesById'>): ResolvedCatalogIds<Trade> {
  return resolveIds(ids, index.tradesById)
}

export function resolveScopes(ids: readonly string[], index: Pick<CatalogIndex, 'scopesById'>): ResolvedCatalogIds<Scope> {
  return resolveIds(ids, index.scopesById)
}
```

- [ ] **Step 5: The showcase index takes `scopesById`** (P2 §4.7-C's row) — `index-showcase-projects.ts`:

```ts
import type { ShowcaseProject, ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { Scope } from '@/shared/modules/construction/core/schemas'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'
import { hasHeroImage } from '@/shared/modules/projects/core/lib/has-hero-image'

/** Portfolio rows to lookups by trade and scope. Rows without a hero image are skipped: the showcase has nothing to show for them. */
export function indexShowcaseProjects(projects: PortfolioProject[], scopesById: ReadonlyMap<string, Scope>): ShowcaseProjectIndex {
  const byScope = new Map<string, ShowcaseProject[]>()
  const tradeHits = new Map<string, { project: ShowcaseProject, hits: number }[]>()

  for (const row of projects) {
    if (!hasHeroImage(row)) {
      continue
    }
    const item: ShowcaseProject = {
      id: row.project.id,
      city: row.project.city,
      state: row.project.state,
      projectDuration: row.project.projectDuration,
      heroImage: row.heroImage,
      scopeIds: row.scopeIds,
    }
    const hitsPerTrade = new Map<string, number>()
    for (const scopeId of row.scopeIds) {
      byScope.set(scopeId, [...(byScope.get(scopeId) ?? []), item])
      const tradeId = scopesById.get(scopeId)?.tradeId
      if (tradeId) {
        hitsPerTrade.set(tradeId, (hitsPerTrade.get(tradeId) ?? 0) + 1)
      }
    }
    for (const [tradeId, hits] of hitsPerTrade) {
      tradeHits.set(tradeId, [...(tradeHits.get(tradeId) ?? []), { project: item, hits }])
    }
  }

  const byTrade = new Map<string, ShowcaseProject[]>()
  for (const [tradeId, list] of tradeHits) {
    byTrade.set(tradeId, [...list].sort((a, b) => b.hits - a.hits).map(entry => entry.project))
  }
  return { byTrade, byScope }
}
```

`use-showcase-projects.ts` — the read goes through the module hook, so the file's "swap the query here" header is obsolete and goes:

```ts
'use client'

import type { ShowcaseProjectIndex } from '@/features/meeting-flow/types'
import type { Scope } from '@/shared/modules/construction/core/schemas'
import { useMemo } from 'react'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { indexShowcaseProjects } from '@/features/meeting-flow/lib/index-showcase-projects'
import { usePortfolioProjects } from '@/shared/modules/projects/core/hooks/use-portfolio-projects'

/**
 * Portfolio projects with a hero image, indexed by trade and scope. Empty while loading or on
 * error: the showcase falls back, silently.
 *
 * `scopesById` must keep a stable identity across renders — memoize it at the source, as
 * `useConstructionCatalog` does. A map rebuilt inline on every render rebuilds the whole index with it.
 */
export function useShowcaseProjects(scopesById: ReadonlyMap<string, Scope>): ShowcaseProjectIndex {
  const query = usePortfolioProjects({ staleTime: SHOWCASE_PROJECTS_STALE_MS })
  return useMemo(() => indexShowcaseProjects(query.data ?? [], scopesById), [query.data, scopesById])
}
```

`trade-selection-provider.tsx:59`: `const projects = useShowcaseProjects(catalog.scopesById)`.

- [ ] **Step 6: Verify and commit the code** — `catalog-index: ok`; `pnpm tsc`; `pnpm lint`; `grep -rn "tradeOfScope\|TradeScopeGroup" src/features/meeting-flow` → no output.

```bash
git add src/shared/modules/construction/core/lib/build-catalog-index.ts src/shared/modules/construction/core/lib/resolve-catalog-ids.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/hooks/use-showcase-projects.ts src/features/meeting-flow/contexts/trade-selection-provider.tsx
git commit -m "feat(construction): scopesById and the catalog id resolver, first consumed by the showcase index

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/shared/modules/construction/core/lib/build-catalog-index.ts src/shared/modules/construction/core/lib/resolve-catalog-ids.ts src/features/meeting-flow/lib/index-showcase-projects.ts src/features/meeting-flow/hooks/use-showcase-projects.ts src/features/meeting-flow/contexts/trade-selection-provider.tsx
```

- [ ] **Step 7: Record it in construction P2** — so P2 plan 2 builds on it instead of building it again. Take the hash: `HASH=$(git log -1 --format=%h)`. Then run this script (it asserts each anchor exists before replacing; if one is missing, the P2 docs moved — stop and ask):

```python
# $SCRATCH/portfolio-checks/record-p2.py  — run: HASH=$HASH python3 $SCRATCH/portfolio-checks/record-p2.py
import os, pathlib
h = os.environ['HASH']
plan = 'docs/superpowers/plans/2026-09-23-portfolio-step-project-story.md'
note = f'**Delivered early** by the portfolio step plan (`{h}`, `{plan}` Task 5).'

spec = pathlib.Path('docs/superpowers/specs/2026-09-22-construction-p2-rules-and-identity-design.md')
s = spec.read_text()
edits = [
    ("| `core/lib/build-catalog-index.ts` | `CatalogIndex` gains `scopesById: ReadonlyMap<string, Scope>`. | F9 |",
     f"| `core/lib/build-catalog-index.ts` | `CatalogIndex` gains `scopesById: ReadonlyMap<string, Scope>`. {note} | F9 |"),
    ("| `core/lib/resolve-catalog-ids.ts` | `resolveTrades(ids, index)` and `resolveScopes(ids, index)` → `{ found: T[]; orphans: string[] }`, stored order preserved. | F9 |",
     f"| `core/lib/resolve-catalog-ids.ts` | `resolveTrades(ids, index)` and `resolveScopes(ids, index)` → `{{ found: T[]; orphans: string[] }}`, stored order preserved. {note} The result type is exported as `ResolvedCatalogIds<T>`. | F9 |"),
    ("`index-showcase-projects.ts` and `use-showcase-projects.ts` take `scopesById` instead of rebuilding the inverse map.",
     f"`index-showcase-projects.ts` and `use-showcase-projects.ts` take `scopesById` instead of rebuilding the inverse map ({note})"),
    ("| `meeting-flow/lib/index-showcase-projects.ts` + `hooks/use-showcase-projects.ts` | take `scopesById` |",
     f"| `meeting-flow/lib/index-showcase-projects.ts` + `hooks/use-showcase-projects.ts` | take `scopesById` — {note} |"),
    ("1. Module registries (from Appendix A), constants, lib functions, `scopesById`.",
     f"1. Module registries (from Appendix A), constants, lib functions. `scopesById` and `core/lib/resolve-catalog-ids.ts` already exist — {note} Build on them; do not rebuild."),
    ("## 6. Files\n",
     f"## 6. Files\n\n> `core/lib/resolve-catalog-ids.ts` (created), `scopesById` in `core/lib/build-catalog-index.ts`, and the meeting-flow `index-showcase-projects.ts` / `use-showcase-projects.ts` edits below are already done — {note}\n"),
]
for old, new in edits:
    assert s.count(old) == 1, old[:70]
    s = s.replace(old, new)
spec.write_text(s)

tracker = pathlib.Path('docs/plans/2026-09-15-construction-data-standardization-epic.md')
t = tracker.read_text()
old = "B8/B10/B11/B19 stay P3."
assert t.count(old) == 1, old
t = t.replace(old, old + f" **Partly delivered {__import__('datetime').date.today()} by the portfolio step plan** (`{h}`, `{plan}` Task 5): `scopesById`, `core/lib/resolve-catalog-ids.ts` (`resolveTrades`, `resolveScopes`, `ResolvedCatalogIds<T>`), and the `index-showcase-projects` / `use-showcase-projects` site. Every other F9 site stays P2 plan 2's.")
tracker.write_text(t)
print('recorded', h)
```

Commit:

```bash
git add docs/superpowers/specs/2026-09-22-construction-p2-rules-and-identity-design.md docs/plans/2026-09-15-construction-data-standardization-epic.md
git commit -m "docs(construction-p2): the F9 resolver and the showcase index site landed early

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- docs/superpowers/specs/2026-09-22-construction-p2-rules-and-identity-design.md docs/plans/2026-09-15-construction-data-standardization-epic.md
```

---

### Task 6: Portfolio matches

**Files:**
- Modify: `src/features/meeting-flow/types/index.ts` (append)
- Create: `src/features/meeting-flow/constants/portfolio-step.ts`
- Create: `src/features/meeting-flow/lib/match-portfolio-projects.ts`
- Create: `src/features/meeting-flow/lib/group-portfolio-matches.ts`
- Create: `src/features/meeting-flow/hooks/use-portfolio-matches.ts`
- Modify: `CONTEXT.md` ⚠️ preflight (foreign hunks on 2026-09-24 — the Presentation terms section this step edits)
- Scratch: `$SCRATCH/portfolio-checks/match.check.ts`

**Interfaces:**
- Consumes: `PortfolioProjectWithHero`, `hasHeroImage`, `compareStoryStrength`, `usePortfolioProjects` (Task 3); `resolveScopes`, `CatalogIndex.scopesById` (Task 5); `TradeSelection`; `useTradeSelections`, `useTradeCatalogContext`.
- Produces:

```ts
export type MeetingStepHandle = PresentationHandle & { advance?: () => void }
export type PortfolioMatchKind = 'scope' | 'trade' | 'fallback' | 'none'
export interface PortfolioMatch { row: PortfolioProjectWithHero, kind: PortfolioMatchKind, matchedScopeIds: string[], matchedTradeIds: string[], matchLabels: string[] }
export interface PortfolioMatchSection { label: string, items: { match: PortfolioMatch, index: number }[] }
export interface PortfolioPosition { projectIndex: number, phaseIndex: number, photoIndex: number }

matchPortfolioProjects(projects: PortfolioProject[], selections: TradeSelection[], catalog: Pick<CatalogIndex, 'scopesById'>): PortfolioMatch[]
groupPortfolioMatches(matches: PortfolioMatch[]): PortfolioMatchSection[]
usePortfolioMatches(): { matches: PortfolioMatch[], showNoMatchNote: boolean, isPending: boolean, isError: boolean, refetch: () => unknown }
```

- [ ] **Step 1: Write the check**

```ts
// $SCRATCH/portfolio-checks/match.check.ts
import assert from 'node:assert/strict'
import { groupPortfolioMatches } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/group-portfolio-matches'
import { matchPortfolioProjects } from '/home/olis-solutions/olis-v3/nextjs/tri-pros-website/src/features/meeting-flow/lib/match-portfolio-projects'
import { row, scopesById, selection } from './fixtures'

const catalog = { scopesById }
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

// an orphan scope id cannot place a project in a trade
assert.equal(matchPortfolioProjects([row('o', { scopeIds: ['gone'] })], [selection('t-kitchen', 'Kitchen', [])], catalog)[0].kind, 'fallback')

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

- [ ] **Step 3: Types** — append to `src/features/meeting-flow/types/index.ts` (add `PresentationHandle` to the existing `@/shared/components/presentation/types` import and `import type { PortfolioProjectWithHero } from '@/shared/modules/projects/core/types'`; no new `@/shared/db/schema` import):

```ts
// ── Portfolio step ──────────────────────────────────────────────────────────

/** What a presentation-layout meeting step exposes to the flow's key map. `advance` is the Space key; a step without it ignores Space. */
export type MeetingStepHandle = PresentationHandle & { advance?: () => void }

export type PortfolioMatchKind = 'scope' | 'trade' | 'fallback' | 'none'

/** A portfolio project and why it is shown for this meeting. */
export interface PortfolioMatch {
  row: PortfolioProjectWithHero
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

- [ ] **Step 5: `matchPortfolioProjects`** — the meeting's rule, on the module primitives:

```ts
// src/features/meeting-flow/lib/match-portfolio-projects.ts
import type { PortfolioMatch } from '@/features/meeting-flow/types'
import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { CatalogIndex } from '@/shared/modules/construction/core/lib/build-catalog-index'
import type { PortfolioProject } from '@/shared/modules/projects/core/types'
import { FALLBACK_MATCH_COUNT } from '@/features/meeting-flow/constants/portfolio-step'
import { resolveScopes } from '@/shared/modules/construction/core/lib/resolve-catalog-ids'
import { compareStoryStrength } from '@/shared/modules/projects/core/lib/compare-story-strength'
import { hasHeroImage } from '@/shared/modules/projects/core/lib/has-hero-image'

function byStoryStrength(a: PortfolioMatch, b: PortfolioMatch): number {
  return compareStoryStrength(a.row, b.row)
}

/**
 * The meeting's portfolio, most relevant first: projects sharing a selected scope, then projects in a
 * selected trade, then the rest. When nothing matches by scope or trade, the strongest
 * `FALLBACK_MATCH_COUNT` projects lead, so the step never opens on nothing.
 */
export function matchPortfolioProjects(
  projects: PortfolioProject[],
  selections: TradeSelection[],
  catalog: Pick<CatalogIndex, 'scopesById'>,
): PortfolioMatch[] {
  const scopeLabels = new Map(selections.flatMap(s => s.selectedScopes.map(item => [item.id, item.label] as const)))
  const tradeNames = new Map(selections.map(s => [s.tradeId, s.tradeName] as const))

  const weight = new Map<string, number>()
  const byScope: PortfolioMatch[] = []
  const byTrade: PortfolioMatch[] = []
  const rest: PortfolioMatch[] = []

  for (const row of projects) {
    if (!hasHeroImage(row)) {
      continue
    }
    const matchedScopeIds = row.scopeIds.filter(id => scopeLabels.has(id))
    // An orphan scope id cannot place the project in a trade; it still matches by id above.
    const scopesInSelectedTrades = resolveScopes(row.scopeIds, catalog).found.filter(scope => tradeNames.has(scope.tradeId))
    const matchedTradeIds = [...new Set(scopesInSelectedTrades.map(scope => scope.tradeId))]

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

- [ ] **Step 6: `groupPortfolioMatches`**

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

- [ ] **Step 7: `usePortfolioMatches`** — the step's one data hook; `PortfolioStep` fetches nothing itself.

```ts
// src/features/meeting-flow/hooks/use-portfolio-matches.ts
'use client'

import { useMemo } from 'react'
import { SHOWCASE_PROJECTS_STALE_MS } from '@/features/meeting-flow/constants/showcase'
import { useTradeCatalogContext } from '@/features/meeting-flow/contexts/trade-catalog-context'
import { useTradeSelections } from '@/features/meeting-flow/contexts/trade-selections-context'
import { matchPortfolioProjects } from '@/features/meeting-flow/lib/match-portfolio-projects'
import { usePortfolioProjects } from '@/shared/modules/projects/core/hooks/use-portfolio-projects'

/** The meeting's portfolio matches; re-matched whenever the selections or the catalog change. */
export function usePortfolioMatches() {
  const selections = useTradeSelections()
  const { catalog } = useTradeCatalogContext()
  const query = usePortfolioProjects({ staleTime: SHOWCASE_PROJECTS_STALE_MS })

  const matches = useMemo(
    () => matchPortfolioProjects(query.data ?? [], selections, catalog),
    [query.data, selections, catalog],
  )
  const showNoMatchNote = selections.length > 0 && !matches.some(match => match.kind === 'scope' || match.kind === 'trade')

  return { matches, showNoMatchNote, isPending: query.isPending, isError: query.isError, refetch: query.refetch }
}
```

- [ ] **Step 8: `CONTEXT.md`** — preflight `git diff --stat -- CONTEXT.md`; if it shows hunks this plan did not make, stop and ask the owner before editing. Then add after the "Presentation terms" section:

```markdown
## Project story terms

How a project is told, on every surface (portfolio page, meeting-flow Portfolio step).

- **Project story** — challenge → solution → result (`challengeDescription`, `solutionDescription`, `resultDescription`). The one standard for telling a project. _Avoid_: phase text, caption, timeline description.
- **Media phase** — before · during · after · uncategorized (labelled "Gallery"), on each project photo (`MediaPhase`, `PHASE_LABELS`).
- **Story phase** — a media phase that has photos, with the story told against it: challenge → Before, solution → During, result → After. A part whose phase has no photos joins the next story phase, else the last. With no media loaded, the hero stands in (`ProjectStoryPhase`, `buildProjectStoryPhases`). _Avoid_: chapter, step.
- **Story strength** — how fully a project's photos tell its story: how many of Before · During · After have photos, then how many photos those phases hold (`compareStoryStrength`).
- **Portfolio match** — why a portfolio project is shown in a meeting: `scope` (shares a selected scope), `trade` (in a selected trade), `fallback` (the strongest few when nothing matches), `none` (`PortfolioMatch`, `matchPortfolioProjects`). _Avoid_: tier, rank, featured.
- **Match labels** — the pills naming a match: scope names, or the trade name.
```

And in "Presentation terms", replace the intro sentence "Meeting-flow step 1 (Who We Are) is a presentation; Program and Portfolio will be too." with: "Meeting-flow step 1 (Who We Are) is a presentation, and Program will be too. Portfolio (step 3) shares the presentation layout and ground but shows one project at a time through its story phases, not slides."

- [ ] **Step 9: Verify** — `match: ok`; `pnpm tsc`; `pnpm lint`.

- [ ] **Step 10: Commit**

```bash
git add src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/portfolio-step.ts src/features/meeting-flow/lib/match-portfolio-projects.ts src/features/meeting-flow/lib/group-portfolio-matches.ts src/features/meeting-flow/hooks/use-portfolio-matches.ts CONTEXT.md
git commit -m "feat(meeting-flow): match portfolio projects to the meeting by scope, trade, then fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/portfolio-step.ts src/features/meeting-flow/lib/match-portfolio-projects.ts src/features/meeting-flow/lib/group-portfolio-matches.ts src/features/meeting-flow/hooks/use-portfolio-matches.ts CONTEXT.md
```

---

### Task 7: Position math and navigation hooks

**Files:**
- Create: `src/features/meeting-flow/lib/portfolio-position.ts`
- Create: `src/features/meeting-flow/hooks/use-portfolio-project-detail.ts`
- Create: `src/features/meeting-flow/hooks/use-portfolio-navigation.ts`
- Scratch: `$SCRATCH/portfolio-checks/position.check.ts`

**Interfaces:**
- Consumes: `PortfolioMatch`, `PortfolioPosition`, `PREFETCH_AHEAD` (Task 6); `buildProjectStoryPhases`, `ProjectStoryPhase` (Task 2); `SHOWCASE_PROJECTS_STALE_MS`.
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

### Task 8: Space through the flow's key owner

**Files:**
- Modify: `src/features/meeting-flow/constants/keyboard-hints.ts`
- Modify: `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts` ⚠️ preflight (foreign hunk on 2026-09-24)
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (type import line 4; ref line 82) ⚠️ preflight (foreign hunk on 2026-09-24)

**Interfaces:**
- Consumes: `MeetingStepHandle` (Task 6).
- Produces: `KEY_SHORTCUTS.portfolio`; `ACTIVATABLE_TARGET_SELECTOR`; `useMeetingFlowKeys({ presentationRef: RefObject<MeetingStepHandle | null>, … })`.

- [ ] **Step 0: Preflight** — `git diff --stat -- src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/ui/views/meeting-flow.tsx`. Any output → stop and ask the owner (Global Constraints).

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

- [ ] **Step 5: Verify** — `pnpm tsc`; `pnpm lint`. (No step has `advance` until Task 10, so Space stays a no-op meanwhile.)

- [ ] **Step 6: Commit**

```bash
git add src/features/meeting-flow/constants/keyboard-hints.ts src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/ui/views/meeting-flow.tsx
git commit -m "feat(meeting-flow): Space advances a step that asks for it

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>" -- src/features/meeting-flow/constants/keyboard-hints.ts src/features/meeting-flow/hooks/use-meeting-flow-keys.ts src/features/meeting-flow/ui/views/meeting-flow.tsx
```

---

### Task 9: Portfolio step components

**Files (all new, `src/features/meeting-flow/ui/components/steps/portfolio/`):** `project-photo.tsx`, `match-pills.tsx`, `project-heading.tsx`, `story-lines.tsx`, `story-phase-bar.tsx`, `story-phase-photos.tsx`, `space-cue.tsx`, `project-list-card.tsx`, `project-list.tsx`, `project-list-sheet.tsx`, `project-list-row.tsx`, `portfolio-step-layout.tsx`

**Interfaces:**
- Consumes: Tasks 2, 3, 6 (`formatProjectCaption` from `modules/projects/core`); `OptimizedImage`; `getOptimizedSrc` / `getOptimizedSrcSet`; `SHOWCASE_CROSSFADE`; shadcn `Sheet*`; `Skeleton`; `cn`.
- Produces the props below; Task 10 composes them.

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
import { MatchPills } from '@/features/meeting-flow/ui/components/steps/portfolio/match-pills'
import { formatProjectCaption } from '@/shared/modules/projects/core/lib/format-project-caption'

interface ProjectHeadingProps {
  match: PortfolioMatch
}

export function ProjectHeading({ match }: ProjectHeadingProps) {
  const { project } = match.row
  return (
    <div className="grid justify-items-start gap-presentation-tight [text-shadow:0_2px_12px_rgb(0_0_0/0.5)]">
      <h2 className="font-sans text-presentation-title leading-[1.05] font-semibold tracking-tight text-balance">{project.title}</h2>
      <p className="text-presentation-label text-white/80">{formatProjectCaption(project)}</p>
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

### Task 10: `PortfolioStep`, wiring, removal of the grid

**Files:**
- Create: `src/features/meeting-flow/ui/components/steps/portfolio/index.tsx`
- Modify: `src/features/meeting-flow/constants/step-config.ts` (portfolio entry)
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (import line 38; presentation branch ~line 320; page branch line 331) ⚠️ preflight — Task 8 already cleared it; re-check `git diff --stat` shows only this plan's lines
- Delete: `src/features/meeting-flow/ui/components/steps/portfolio-step.tsx`, `src/features/meeting-flow/ui/components/steps/trade-project-grid.tsx`

**Interfaces:**
- Consumes: everything above; `usePortfolioMatches` (Task 6) is the step's only data source; `ErrorState`, `EmptyState`, `Skeleton`.
- Produces: `PortfolioStep({ labelledBy, ref })`, `ref?: Ref<MeetingStepHandle>`.

- [ ] **Step 1: `PortfolioStep`**

```tsx
// src/features/meeting-flow/ui/components/steps/portfolio/index.tsx
'use client'

import type { Ref } from 'react'
import type { MeetingStepHandle } from '@/features/meeting-flow/types'
import { useImperativeHandle } from 'react'
import { PORTFOLIO_COPY } from '@/features/meeting-flow/constants/portfolio-step'
import { usePortfolioMatches } from '@/features/meeting-flow/hooks/use-portfolio-matches'
import { usePortfolioNavigation } from '@/features/meeting-flow/hooks/use-portfolio-navigation'
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
  const { matches, showNoMatchNote, isPending, isError, refetch } = usePortfolioMatches()
  const nav = usePortfolioNavigation(matches)
  const { advance, next, prev } = nav

  useImperativeHandle(ref, () => ({ next, prev, advance }), [next, prev, advance])

  if (isPending) {
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

  if (isError) {
    return (
      <PortfolioStepLayout
        announcement={PORTFOLIO_COPY.errorTitle}
        heading={(
          <ErrorState className="h-auto border-white/15 text-white" title={PORTFOLIO_COPY.errorTitle}>
            <button className="min-h-11 rounded-md border border-white/35 px-3 font-semibold" type="button" onClick={() => void refetch()}>
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

### Task 11: Browser verification on dev (read-only)

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
- [ ] **Step 9: Network** — one `showroomDisplay.getAll` request serves both the specialties step and the portfolio step (same query key via `usePortfolioProjects`); its rows carry `phaseCounts`; moving to project n fetches n+1..n+2 ahead. The specialties stage captions still read "Tri Pros project · <city>, <state> · <duration>".
- [ ] **Step 10: Retirement** — the project editor (`/dashboard/projects/<id>/edit` or its current route) has no "Timeline Phase Descriptions" section and still saves challenge / solution / result; a public project page's timeline renders with its generic lines.
- [ ] **Step 11: Final gate** — `pnpm tsc && pnpm lint` clean; `git status` shows nothing stray from this work; grep gates: `grep -rn "tradeIdByScope\|formatPortfolioMeta\|PortfolioRowWithHero\|countMediaPhases\|tradeOfScope" src` → no output. Report screenshots, fixes, the construction P2 docs commit from Task 5, and the owner's pending `pnpm db:push:prod`.
