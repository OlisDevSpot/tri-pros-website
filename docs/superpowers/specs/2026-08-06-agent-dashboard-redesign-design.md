# Agent Dashboard Redesign — Design Spec (Command Desk)

> **Status:** shaping brief, approved composition. Supersedes the *visual* layer of
> `2026-08-06-adaptive-agent-dashboard-design.md`. The data wiring, scoping, query
> dedupe, reuse mandate, and empty/loading contracts of that original spec are
> unchanged and still binding — this document only replaces layout + skin.

## Why this exists

The dashboard was built correctly (data, scoping, states all verified) but shipped in
a worktree that lacked `DESIGN.md`, so every module was skinned blind. A dual-agent
`/impeccable critique` scored the surface **21/40 (Poor)**: a single narrow `max-w-3xl`
column wasting ~half the desktop canvas, no cobalt accent, flat gray depth, an oversized
non-keyboard-operable action card, a mobile card that drops the customer name, and no
type hierarchy. `DESIGN.md` (the "Command Desk" world) is now committed on the branch.
This redesign re-skins and relays out the surface to that system while keeping the good
bones.

## Mode

**Operate.** This is internal CRM — an agent's operational home. Scanability,
consistency, native expectations, and the real usage scene outrank expression. Brand
lives in precise details (cobalt discipline, tinted depth, the type ramp), not decoration.

## Composition — "A×C"

One adaptive dashboard (agent-first; super-admin = same layout, omni data). The surface
**fills its parent container width** — no `max-w` cap. The app shell
(`dashboard/template.tsx`, a `flex-1 overflow-hidden px-4 md:px-6` MAIN) owns the width
and outer padding; the dashboard fills it exactly the way records pages do via
`RecordsPageMotionShell` (`w-full h-full`). `DashboardView` owns its own scroll region
(`h-full overflow-y-auto`) because the MAIN is `overflow-hidden`.

### Desktop (`lg` and up)

```
┌────────────────────────────────────────────────────────────────┐
│  HERO BAND (full width)                                         │  ← C: cinematic
│  eyebrow (Space Mono · "Your desk")                             │
│  “Welcome back” (Syne headline)                                │
│  [ Meetings today ]  [ Awaiting signature ]  [ Open projects ]  │  ← A: snapshot,
│    cobalt figures · Space Mono labels · jump-links              │     merged into hero
├──────────────────────────────────┬─────────────────────────────┤
│  MEETINGS  (lg:col-span-8)       │  RIGHT RAIL (lg:col-span-4)  │  ← A: meetings-primary
│  the focal moment:               │  ┌─────────────────────────┐ │     + right-rail bento
│  Today day-timeline (cobalt      │  │ Awaiting signature      │ │
│  dots, Space Mono time rail),    │  ├─────────────────────────┤ │
│  then Upcoming / Past tabs       │  │ Open projects           │ │
│                                  │  └─────────────────────────┘ │
└──────────────────────────────────┴─────────────────────────────┘
```

> **Action Queue removed.** The inline "Needs attention" module is a stub (wrong math /
> filters) and is pulled from the dashboard UI — rebuilt under **#282**. The snapshot's
> third chip is therefore **Open projects** (not the action-queue-derived "Follow-ups
> due"), and the right rail holds two modules. The `ActionCard` fixes and tier-token
> remap below apply **when #282 rebuilds the queue**, not in this pass.

- **C (cinematic Today):** the hero band + the Today day-timeline are the focal moment.
  The greeting band gives the screen a real headline and a documented type ramp; the
  timeline is the "shape of my day."
- **A (meetings-primary + right-rail bento):** a 12-col work surface under the hero —
  Meetings occupies the wide primary column (`col-span-8`); the three rosters
  (Needs attention → Awaiting signature → Open projects) stack in the `col-span-4` rail.

### Mobile (below `lg`)

Single focused column. **Snapshot lives in the hero band on top**, then the modules
**mirror the desktop order**: Meetings → Needs attention → Awaiting signature → Open
projects. This is the natural DOM order, so the same markup collapses from
`grid lg:grid-cols-12` to one column with no reordering.

## The Command Desk skin

The single authority is the committed `DESIGN.md`. Binding rules for this surface:

### Accent — cobalt, one voice, ≤10%
`--primary` (Cobalt Command) is the app's only accent and means "interactive / act here."
It appears on: snapshot figures, the active meetings tab, Today-timeline dots, focus
rings (`--ring` is already cobalt), and `See all →` hovers. It is **never** used as a
status color. Its scarcity is the point.

### Status color — semantic urgency ramp, not a rainbow
Available status tokens are exactly `--destructive`, `--warning`, `--success`, plus
`--muted`. There is no purple/info token. The five action tiers therefore encode an
**urgency band by color**, with the tier's icon + label + section header carrying the
per-tier specificity (they are already grouped under a labelled tier header). Mapping:

| Tier | Meaning | Token |
|---|---|---|
| `HOT_NOW` | reading the proposal now — drop everything | `destructive` |
| `HOT_LEAD` | high interest — today | `warning` |
| `FOLLOW_UP_DUE` | cadence touch due | `warning` |
| `STALE` | cold / likely didn't receive | `muted` |
| `NO_PROPOSAL` | meeting done, no proposal | `muted` |

This obeys the Stage-Color Rule (color is semantic data, never restyled for taste) and
the One-Voice Rule (cobalt stays interactive-only). Raw `red/orange/yellow/blue-500`
Tailwind values are removed.

### Depth — tinted, layered, never flat gray
- **Module cards** (the four rosters + hero): the app's tinted elevation — a hairline
  border plus a soft brand-tinted shadow, one step above the cool-paper page. Never a
  flat neutral-gray drop.
- **Floating UI only** (`ActionCenterSheet`, `ActionDetailSheet`): the signature
  **frosted-glass** surface (`--popover-glass` + backdrop blur + the four-layer glass
  shadow). Glass is a brand asset reserved for floating layers — not for the resting
  module cards.

### Type ramp (documented; kills the off-ramp `text-[10px]`)
| Role | Treatment |
|---|---|
| Page greeting | Syne (`font-sans`) headline, `text-2xl`/`1.75rem`, `font-medium` |
| Eyebrow / label / time-rail | **Space Mono** (`font-mono`) `text-[0.72rem]`, `tracking-[0.2em]`, uppercase where a kicker |
| Module title | Syne `font-semibold`, `text-base`→`text-lg` (Title) |
| Card primary (name / title) | Nunito `text-sm font-medium` |
| Card meta / caption | Nunito `text-xs text-muted-foreground` — **the floor; no `text-[10px]`** |
| Snapshot figure | Syne `text-2xl`/`text-3xl font-bold tabular-nums`, cobalt |

Every current `text-[10px]` becomes either the `0.72rem` Space Mono eyebrow (time rail,
snapshot label) or the `text-xs` caption (project address, proposal-count). AA contrast
holds on muted captions and eyebrows.

## Functional fixes (from the critique requirement list)

1. **Mobile drops the customer name (P0).** `ActionCard` lays name + two `shrink-0`
   badges in one `flex items-center` row; on a narrow rail/phone the `truncate` name
   collapses to 0 width. Restructure to a two-row layout: **name on its own line**
   (full width, truncate), badges + suggested-action beneath. The meeting/proposal
   cards already guard with `min-w-0 flex-1`; keep them.
2. **ActionCard not keyboard-operable (P1).** It is a `<Card onClick>`. Make the whole
   card a real, focusable control (`<button type="button">`, full-width, `text-left`,
   cobalt `focus-visible` ring) and **drop the redundant "View" button** — the card is
   the target.
3. **Density.** ActionCard tightens to the dense row family the other dashboard cards
   use; consistent radius (app `lg`/`xl`) and ~`p-4` module padding via shared chrome.
4. **Canvas.** Solved by the fill-parent bento above.

## Structural refactor (removes drift risk)

All four module cards (`meetings-hub`, `action-queue`, `proposals`, `projects`) repeat
the **same header markup** (card chrome + Syne title + `See all →` slot). Extract a
shared presentational `DashboardModule` component: the card chrome (tinted depth, radius,
padding) + a header (Title + optional action slot). The four modules render their body
into it. This makes depth/radius/type single-sourced so a later edit can't skin one
module differently from the others.

## Keep (bones are good — do not touch)

Data wiring and query-key dedupe against the server prefetch; CASL/participation scoping;
`getActionQueue` + `groupByTier` + `capGroupedTierItems` reuse; the compound
`MeetingOverviewCard` / `ProposalOverviewCard` compositions; empty and loading states;
sales-native copy; the DST-safe `meetingWindow` timezone pin; the `overflow-y-auto`
scroll ownership.

## Out of scope

- The pre-existing app-shell sidebar `AvatarFallback` hydration mismatch (separate ticket).
- `entity-list.tsx` is a **shared** component; its `text-[10px]` is touched only if the
  implementer confirms the dashboard is its sole consumer — otherwise left as-is and noted.
- No backend changes. No new queries. No route changes.

## Verification

`pnpm tsc` + `pnpm lint` (no test runner exists — never `pnpm build`), then a live
browser smoke at desktop **1440** and mobile **390**, as super-admin (omni data) and as
an agent (scoping/empty state). Finish with the mechanical detector
(`scripts/detect.mjs`) over the changed targets and an impeccable `polish` + re-`critique`
to confirm the score climbs.
