# Agent Dashboard Redesign Implementation Plan (Plan 1 of the dashboard epic)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> Before editing any UI, load impeccable `reference/craft-floor.md`.
> Part of `2026-08-06-agent-dashboard-epic.md`. This is the **UI-centric first pass** —
> data-correctness lands in Plans 2–3.

**Goal:** Re-skin and relay out the `/dashboard` agent home to the committed "Command
Desk" design system (`DESIGN.md`) — a fill-parent-width A×C bento with cobalt accent,
tinted depth, a documented type ramp, and the critique's card-level functional fixes —
without touching data semantics.

**Architecture:** Extract a shared `DashboardModule` chrome, replace the single narrow
column with a full-width 12-col bento (hero band + meetings-primary + right rail), and
re-skin each module to Command Desk tokens. The **Action Queue module is removed from the
dashboard UI** (stub with wrong math — rebuilt under #282); the `ActionCenterSheet` stays
reachable from nav, untouched. All changes here are presentational/layout; queries,
prefetch keys, scoping, and empty/loading contracts of the *remaining* modules are unchanged.

**Tech Stack:** Next.js 15 App Router (RSC + `'use client'`), tRPC + TanStack Query,
Tailwind v4 (design tokens in `globals.css`), shadcn/ui, motion/react, lucide-react.

**Design authority:** `docs/superpowers/specs/2026-08-06-agent-dashboard-redesign-design.md`
(this plan's brief) and the committed root `DESIGN.md` (the Command Desk world).

## Global Constraints

- **No `pnpm build` — ever.** Verify with `pnpm tsc` + `pnpm lint` only. No test runner
  exists; do not invent one or add test files.
- **One React component per file. Named exports only (never `export default`). No
  file-level constants in component files (extract to `constants/`). No helper functions
  in component files (extract to `lib/`).**
- **Cobalt = interactive only, ≤10% of the screen.** `--primary` on snapshot figures,
  active tab, timeline dots, focus rings, `See all →` hovers. Never a status color.
- **Type floor:** no `text-[10px]`. Eyebrows/time-rail = `font-mono text-[0.72rem]
  tracking-[0.2em]`; captions = `text-xs text-muted-foreground`; titles = Syne
  (`font-sans`) `font-semibold`; body = Nunito.
- **Depth:** module cards = tinted app elevation (border + soft brand-tinted shadow),
  never flat gray. Frosted glass (`--popover-glass`) is out of scope here (it belongs to
  the Action Center sheets, rebuilt under #282).
- **Fill parent width** — no `max-w` cap. The shell MAIN owns outer padding;
  `DashboardView` owns its own `overflow-y-auto` scroll region.
- **Do not touch data semantics.** Keep every remaining `useQuery` input, prefetch key,
  scoping, compound-card composition, and empty/loading state as-is. Wrong data is
  corrected in Plans 2–3, not here.
- **Action Queue is out of scope** — remove its dashboard mount (Task 2) and its snapshot
  dependency (Task 3); do not re-skin `action-card.tsx` / `tier-color-map.ts` /
  `action-tiers.ts` / the sheets (all owned by #282).
- **Do not open a PR or push.** The user runs `pnpm dispatch pr 281`.

---

### Task 1: `DashboardModule` shared chrome

**Files:**
- Create: `src/features/agent-dashboard/ui/components/dashboard-module.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposals.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-projects.tsx`

**Interfaces:**
- Produces: `DashboardModule` — a presentational card + header wrapper.
  ```tsx
  interface DashboardModuleProps {
    title: string
    /** Optional right-aligned header slot — the module's `See all →` link/button. */
    action?: React.ReactNode
    className?: string
    children: React.ReactNode
  }
  export function DashboardModule(props: DashboardModuleProps): React.ReactElement
  ```
  - Card chrome (single-sourced Command Desk elevation):
    `rounded-xl border border-border bg-card p-4 shadow-sm shadow-primary/5`
    (tinted brand shadow, not flat gray; `rounded-xl` = app 12px).
  - Header row: `mb-3 flex items-center justify-between gap-3`, with
    `<h2 className="font-sans text-base font-semibold text-foreground">{title}</h2>`
    (Syne Title) on the left and `{action}` on the right when present.
  - Section anchors (`#meetings`, `#proposals`, `#projects`) are owned by the `<section>`
    wrappers in `DashboardView` (Task 2), **not** by this component — avoid duplicate ids.

- [ ] **Step 1: Create `dashboard-module.tsx`** with the interface above. The `See all →`
  action styling stays owned by each module (they pass their own `<Link>`), so the wrapper
  only positions it.

- [ ] **Step 2: Refactor `dashboard-meetings-hub.tsx`** to render its `<Tabs>` body inside
  `<DashboardModule title="Meetings" action={<SeeAllLink/>}>`. Remove the duplicated outer
  `rounded-lg border … p-4` div and the hand-rolled header. Keep tabs, queries, lazy-mount.

- [ ] **Step 3: Refactor `dashboard-proposals.tsx` and `dashboard-projects.tsx`** the same
  way (`title="Awaiting signature"` / `"Open projects"`, `action` = the existing `<Link>`).
  Keep `EntityList`, queries, skeletons, empty states.

- [ ] **Step 4: Verify.** `pnpm tsc` then `pnpm lint` — both pass; the three modules render
  identical chrome.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/features/agent-dashboard/ui/components/dashboard-module.tsx \
    src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx \
    src/features/agent-dashboard/ui/components/dashboard-proposals.tsx \
    src/features/agent-dashboard/ui/components/dashboard-projects.tsx
  git commit -m "refactor(dashboard): extract shared DashboardModule chrome"
  ```

---

### Task 2: Fill-parent-width bento + hero band, minus the Action Queue

**Files:**
- Modify: `src/features/agent-dashboard/ui/views/dashboard-view.tsx`
- Modify: `src/app/(frontend)/dashboard/page.tsx`
- Create: `src/features/agent-dashboard/ui/components/dashboard-hero.tsx`

**Interfaces:**
- Consumes: `DashboardSnapshotStrip` (Task 3 re-skins its internals; here it is composed
  in the hero — export name and props unchanged).
- Produces: `DashboardHero` — the full-width cinematic band (eyebrow + Syne greeting +
  the snapshot stat row). Use a **non-time greeting** ("Welcome back" / eyebrow "Your desk")
  — no clock, so no server/client hydration divergence.

- [ ] **Step 1: Create `dashboard-hero.tsx`.** Full-width band:
  - eyebrow: `<p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground">Your desk</p>`
  - headline: `<h1 className="font-sans text-2xl font-medium text-foreground">Welcome back</h1>`
  - stat row: render `<DashboardSnapshotStrip />` beneath. Spacing only; no card chrome.

- [ ] **Step 2: Rewrite `dashboard-view.tsx`** to the fill-parent bento **without** the
  Action Queue:
  ```tsx
  export function DashboardView() {
    return (
      <div className="h-full overflow-x-hidden overflow-y-auto">
        <div className="flex w-full flex-col gap-6 pb-16">
          <DashboardHero />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <section id="meetings" className="lg:col-span-8">
              <DashboardMeetingsHub />
            </section>
            <div className="flex flex-col gap-6 lg:col-span-4">
              <section id="proposals"><DashboardProposals /></section>
              <section id="projects"><DashboardProjects /></section>
            </div>
          </div>
        </div>
      </div>
    )
  }
  ```
  - **Remove** the `DashboardActionQueue` import and its `#queue` section.
  - **No `max-w` / `mx-auto`.** Fills the shell MAIN width (matches records pages). Keep
    `overflow-y-auto` scroll ownership (MAIN is `overflow-hidden`). Keep exactly one id per
    anchor (`#meetings`, `#proposals`, `#projects`).

- [ ] **Step 3: `page.tsx` — drop the action-queue prefetch.** Remove the
  `prefetch(trpc.dashboardRouter.getActionQueue.queryOptions())` line (nothing renders it
  now). Leave the other three prefetches.

- [ ] **Step 4: Verify.** `pnpm tsc` + `pnpm lint` pass.

- [ ] **Step 5: Browser smoke.** `pnpm dev` (port 3003), authenticate via the dev-auth route
  (`/api/dev/playwright-session?secret=…&as=info@triprosremodeling.com&redirect=/dashboard`).
  At **1440**: two columns, meetings wide-left, proposals+projects stacked right, **no dead
  right gutter**, no Action Queue. At **390**: single column — hero → meetings → proposals →
  projects; no horizontal scroll; scroll reaches Open projects.

- [ ] **Step 6: Commit.**
  ```bash
  git add src/features/agent-dashboard/ui/views/dashboard-view.tsx \
    src/app/\(frontend\)/dashboard/page.tsx \
    src/features/agent-dashboard/ui/components/dashboard-hero.tsx
  git commit -m "feat(dashboard): fill-parent A×C bento + hero; remove stub action queue (#282)"
  ```

---

### Task 3: Snapshot strip re-skin (cobalt figures, Open-projects chip)

**Files:**
- Modify: `src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx`

**Interfaces:**
- Consumes: `meetingsWindowInput('today')`, `awaitingProposalsInput()`, and now
  `activeProjectsInput()` (replacing the `getActionQueue` dependency). Same query keys the
  modules use — no new queries, still dedupes against the prefetch.

- [ ] **Step 1: Replace the third chip + drop the action-queue query.** Remove the
  `dashboardRouter.getActionQueue` `useQuery` and the `followUpsDue` derivation. The three
  chips become:
  - `{ href: '#meetings', label: 'Meetings today', count: meetingsToday.data?.total }`
  - `{ href: '#proposals', label: 'Awaiting signature', count: awaitingSignature.data?.total }`
  - `{ href: '#projects', label: 'Open projects', count: activeProjects.data?.total }`
    (add `const activeProjects = useQuery(trpc.projectsRouter.crud.list.queryOptions(activeProjectsInput()))`).

- [ ] **Step 2: Re-skin the tiles** as a `grid grid-cols-3 gap-3` family with the hero:
  - label: `font-mono text-[0.72rem] uppercase tracking-[0.2em] text-muted-foreground`
    (replaces the `text-[10px]` off-ramp label).
  - figure: `font-sans text-2xl font-bold tabular-nums` — **cobalt when present**
    (`text-primary`), `text-muted-foreground` when the count is still `undefined` (`—`).
  - tile: keep the anchor (`<a href={chip.href}>`), `min-h-11`, `hover:border-primary/40`,
    cobalt `focus-visible:ring-ring`, `rounded-md border border-border bg-card`.

- [ ] **Step 3: Verify.** `pnpm tsc` + `pnpm lint` pass;
  `grep -n 'text-\[10px\]' dashboard-snapshot-strip.tsx` → no matches.

- [ ] **Step 4: Commit.**
  ```bash
  git add src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx
  git commit -m "feat(dashboard): cobalt snapshot figures; swap follow-ups chip for open projects"
  ```

---

### Task 4: Meetings module re-skin (focal timeline + cobalt tabs)

**Files:**
- Modify: `src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-today-timeline.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-meeting-card.tsx`

**Interfaces:** Consumes `DashboardModule` (Task 1). Timeline data/query/cap unchanged.

- [ ] **Step 1: Tabs (`dashboard-meetings-hub.tsx`).** Ensure the active `TabsTrigger` reads
  cobalt (resolve to `--primary`/`--ring`, not gray — add `data-[state=active]:text-primary`
  only if the shared `Tabs` doesn't already carry brand active styling). Keep `min-h-11` +
  lazy-mount.

- [ ] **Step 2: Today timeline (`dashboard-today-timeline.tsx`).** Make it the focal moment:
  - time label: `font-mono text-[0.72rem] tabular-nums text-muted-foreground` (replaces
    `text-[10px]`).
  - dot marker: keep `bg-primary` (cobalt). Keep the rail hairline, empty state, skeleton.

- [ ] **Step 3: Meeting card (`dashboard-meeting-card.tsx`).** Keep the compound
  `MeetingOverviewCard` composition. Replace the proposal-count caption `text-[10px]` with
  `text-xs text-muted-foreground`. Keep dense `rounded-lg border … p-2.5` chrome and the
  name's `min-w-0 flex-1 truncate` (do not regress).

- [ ] **Step 4: Verify.** `pnpm tsc` + `pnpm lint` pass; no `text-[10px]` in the three files.

- [ ] **Step 5: Commit.**
  ```bash
  git add src/features/agent-dashboard/ui/components/dashboard-meetings-hub.tsx \
    src/features/agent-dashboard/ui/components/dashboard-today-timeline.tsx \
    src/features/agent-dashboard/ui/components/dashboard-meeting-card.tsx
  git commit -m "feat(dashboard): re-skin meetings module as focal cobalt timeline"
  ```

---

### Task 5: Proposals & projects roster re-skin

**Files:**
- Modify: `src/features/agent-dashboard/ui/components/dashboard-proposal-card.tsx`
- Modify: `src/features/agent-dashboard/ui/components/dashboard-project-card.tsx`

**Interfaces:** Consumes the compound `ProposalOverviewCard` / project row shapes — unchanged.

- [ ] **Step 1: Project card (`dashboard-project-card.tsx`).** Replace the address caption
  `text-[10px]` (line ~50) with `text-xs text-muted-foreground`; shrink `MapPinIcon` to
  `size-3`. Keep the green status badge (project's real `converted`/active semantic per
  `ProjectEntityCard` — Stage-Color green=converted). Keep dense `rounded-lg border … p-2.5`.

- [ ] **Step 2: Proposal card (`dashboard-proposal-card.tsx`).** No `text-[10px]` here;
  confirm the second-line meta reads as the `text-xs` caption family and the status badge
  uses the proposal entity's own semantic colors (do not restyle). If already consistent,
  this file may need no change — confirm and note it.

- [ ] **Step 3: Verify.** `pnpm tsc` + `pnpm lint` pass; no `text-[10px]` in either file.

- [ ] **Step 4: Commit.**
  ```bash
  git add src/features/agent-dashboard/ui/components/dashboard-proposal-card.tsx \
    src/features/agent-dashboard/ui/components/dashboard-project-card.tsx
  git commit -m "feat(dashboard): roster card type-scale fixes (kill text-[10px])"
  ```

---

### Task 6: Type-scale sweep + mechanical detector

**Files:**
- Investigate (change only if dashboard-only): `src/shared/components/entity-list/ui/entity-list.tsx:88`

- [ ] **Step 1: Type-scale sweep.** From the feature dir run
  `grep -rn 'text-\[10px\]' src/features/agent-dashboard` — expect **zero** matches (action
  queue files are unmounted/out-of-scope; if any remain there, leave them for #282 and note
  it). For the shared `entity-list.tsx:88` `text-[10px]`: run
  `grep -rn "EntityList" src --include=*.tsx | grep -v agent-dashboard`. **If the dashboard
  is the only consumer**, bump to `text-xs`; **otherwise leave it** and record the skip in
  the ledger (shared-component blast radius).

- [ ] **Step 2: Verify.** `pnpm tsc` + `pnpm lint` pass.

- [ ] **Step 3: Mechanical detector.** From project root run
  `node /home/olis-solutions/.claude/skills/impeccable/scripts/detect.mjs --json
  src/features/agent-dashboard/ui/components/dashboard-module.tsx
  src/features/agent-dashboard/ui/components/dashboard-hero.tsx
  src/features/agent-dashboard/ui/views/dashboard-view.tsx
  src/features/agent-dashboard/ui/components/dashboard-snapshot-strip.tsx`
  Fix real off-system findings; do not silence without cause.

- [ ] **Step 4: Commit (if changed).**
  ```bash
  git add -p
  git commit -m "feat(dashboard): type-scale sweep"
  ```

---

## Post-plan (controller, after final whole-branch review)

- Live browser smoke: desktop **1440** + mobile **390**, omni + agent — bento fills width,
  cobalt present but ≤10%, tinted depth, no Action Queue, scroll reaches Open projects.
- impeccable `polish` (bounded pass), then re-run `critique` to confirm the score climbs
  from 21/40.
- Proceed to **Plan 2** (data correctness). Leave the SDD workspace/ledger until merge.
  **Do not open the PR** — the user runs `pnpm dispatch pr 281`.

## Self-Review

- **Brief coverage:** fill-parent bento (T2) · cobalt accent (T3/T4) · tinted depth via
  shared chrome (T1) · type ramp / kill `text-[10px]` (T3/T4/T5/T6) · mobile mirrors
  desktop order (T2). Action-Queue-specific fixes (tier tokens, keyboard card, name-drop)
  are **deferred to #282** by decision, not dropped. Frosted-glass sheets → #282.
- **Placeholders:** none — every step names exact files, tokens, and class strings.
- **Type consistency:** `DashboardModule` prop shape (T1) matches its three consumers (T1);
  snapshot's new `activeProjectsInput` query (T3) reuses the projects module's key; anchor
  ids are single-sourced on the `<section>` wrappers (T2), never duplicated on the module.
