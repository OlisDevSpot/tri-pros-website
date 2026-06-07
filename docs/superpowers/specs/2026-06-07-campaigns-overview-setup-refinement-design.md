# Campaigns — Overview & Setup Visual Refinement

**Date:** 2026-06-07
**Status:** Design approved (brainstorm). Ready for implementation plan.
**Page:** `/dashboard/campaigns` (super-admin only) — **Overview** and **Setup** tabs only.
**Builds on / refines:** `docs/superpowers/specs/2026-06-06-campaigns-page-ux-redesign-design.md` (the master redesign that produced the current scaffold).
**Supersedes the visual treatment of:** §① Overview and §③ Setup in the 2026-06-06 spec. Information architecture, tabs, data model, tRPC surface, and the Leads tab are unchanged.

---

## Goal

The Overview and Setup tabs shipped functionally but break basic UI/UX discipline. This pass tightens visual hierarchy, kills layout instability, and fixes mobile — **no behavior, data, or API changes.** Same procedures, same actions, same flows; only the rendering of `CampaignsOverviewView` / `CampaignsSetupView` and their child components changes.

## Problems being fixed (diagnosis)

1. **No hierarchy** — the totals strip and the per-source cards use near-identical card chrome; the page's most important numbers read as just more tiles.
2. **Unstable grid** — the `needsBinding` amber banner is injected *inside* the card body, so cards with a warning are taller → ragged rows in the 3-col grid.
3. **Disproportionate warning** — a full-width amber banner with icon + two lines of prose, repeated on every unbound source, shouts louder than the data. It's a status, not an event.
4. **Empty sources get full weight** — sources with `0/0/0` occupy the same footprint as actionable ones; ~half the grid is noise.
5. **Primary action everywhere** — "Enroll all eligible" is a full-width primary button on every card (incl. disabled). When everything is primary, nothing is.
6. **Stats cramped & color-inconsistent** — card stats are uncolored micro-columns, unlike the (colored) totals strip.
7. **Mobile broken** — totals strip is hard-locked `grid-cols-3` (three cards crushed at 375px); Setup table overflows.
8. **Setup looks lonely** — `max-w-3xl` column leaves a big dead zone on wide screens; two stacked cards float.

## Decisions (resolved during brainstorming)

| # | Decision | Choice |
|---|---|---|
| 1 | Overview purpose | **Both, ranked** — show everything, but actionable sources float up and look alive; idle ones are demoted but visible. |
| 2 | Idle source treatment | **Compact list rows** — actionable = rich cards on top; idle = tight single-line rows below. |
| 3 | `needsBinding` treatment | **Inline pill + helper link** — small amber `No default` pill in the card header + one quiet line "Pick a campaign on enroll, or set a default → Setup". Replaces the banner. |
| 4 | Totals treatment | **Slim inline summary bar** — one low horizontal bar, structurally distinct from cards. |
| 5 | Hero stat on cards | **Eligible** — emphasized/largest; it drives the enroll action. |
| 6 | Idle container | **Always open** — never hidden, zero clicks to scan. |
| 7 | Name emoji (green 🖊 in some source names) | **Leave data as-is, render raw** — comes from the source `name` field; not stripped, not touched. |
| 8 | Setup layout | **2/1 split** — wide binding table (`col-span-2`) + narrow attributes sidebar (`col-span-1`) on desktop; stacks on mobile. |

---

## Overview tab — layout

Top → bottom:

1. **Page header** — unchanged (`Campaigns` title + description).
2. **Slim summary bar** — replaces the three KPI cards. `bg-muted/40 rounded-lg`, ~44px tall, three segments split by thin dividers. Each: colored dot + label + bold `tabular-nums` number. Enrolled = green dot, Eligible = neutral/emphasized, DNC = red dot. **No card chrome / no shadow** — reads as a page summary, not data tiles.
3. **"Needs action" section** — label + count, then a responsive grid of rich cards for sources with `eligibleCount > 0`, sorted by `eligibleCount` desc.
4. **"Idle" section** — label + count (`Idle · N sources`), then a single bordered, `divide-y` container of compact rows for sources with `eligibleCount === 0`. Always open.

If there are no sources at all → muted empty-state line.

### Needs-action card — fixed anatomy

Every card is structurally identical (eliminates ragged heights). Top → bottom:

- **Header row:** source name (rendered raw, emoji intact) + one status pill — green `Bound` or amber `No default`.
- **Stats row:** Enrolled / **Eligible** / DNC. Same semantic colors as the summary bar (Enrolled green, DNC red). **Eligible is the hero** — largest weight/size; Enrolled & DNC are smaller context. All `tabular-nums`.
- **Helper line (conditional):** only when `No default` — one quiet muted line: "Pick a campaign on enroll, or set a default → Setup". The "→ Setup" switches the `tab` nuqs param to `setup`.
- **Action:** `Enroll all eligible (N)` primary button, **pinned to card bottom** via `mt-auto` so buttons align across a row even when one card shows the helper line. (Popover behavior unchanged — for unbound sources it still lets you pick a campaign ad-hoc.)

Grid columns equalize height per row (CSS grid `stretch`); the bottom-pinned button keeps actions aligned. Cross-row height variance is acceptable.

### Idle row — anatomy

One line each, inside the shared bordered/divided container:
- **Left:** source name.
- **Middle:** inline mini-stats `Enrolled · Eligible · DNC` (muted, `tabular-nums`).
- **Right:** binding badge (`Bound` / `No default`).
- No action button; muted text overall.

---

## Setup tab — layout

Drop `max-w-3xl`. Responsive grid that fills the width:

- `grid grid-cols-1 lg:grid-cols-3 gap-4`.
- **CloudTalk Sync & Binding card** → `lg:col-span-2` (the wide 5-column binding table needs the room).
- **Contact attributes card** → `lg:col-span-1` (small list as a sidebar).
- Stacks to single column on mobile/tablet.

Within `CloudtalkSyncCard`:
- **Header:** `flex-col sm:flex-row` so the Resync button drops below the title on narrow screens instead of cramping.
- **Binding table:** wrap in `overflow-x-auto` so the 5-column grid scrolls horizontally on small screens rather than breaking layout. (A full card-per-row mobile refactor of the binding table is **out of scope** — horizontal scroll is the disciplined minimum that keeps every control reachable. Logged as a follow-up.)

---

## Mobile behavior

- **Summary bar:** stays three segments; tightens padding + number size below `sm`. Three short numbers fit 375px (the old bug was three full *cards*).
- **Needs-action grid:** `grid-cols-1 sm:grid-cols-2 xl:grid-cols-3` → full-width stacked cards on phone.
- **Idle rows:** name + stats on one line; binding badge wraps under at the narrowest widths.
- **Setup:** both cards full-width stacked; binding table scrolls horizontally.

---

## Files

All within `src/features/campaigns-admin/`. Follows project conventions: one React component per file, named exports only, no file-level constants/helpers in component files, no barrels.

| File | Change |
|---|---|
| `ui/views/campaigns-overview-view.tsx` | Partition summaries → render summary bar + needs-action grid + idle list. Skeleton updated to match new structure. |
| `ui/components/overview/overview-summary-bar.tsx` | **Renamed** from `overview-totals-strip.tsx` — slim summary bar (dots, dividers, no card chrome). |
| `ui/components/overview/source-rollup-card.tsx` | Redesigned needs-action card: header pill, hero-Eligible stats, conditional helper line, bottom-pinned action. |
| `ui/components/overview/idle-source-row.tsx` | **NEW** — compact single-line idle row. |
| `ui/components/overview/idle-sources-list.tsx` | **NEW** — bordered `divide-y` container that maps idle summaries to rows + section label/count. |
| `lib/partition-source-summaries.ts` | **NEW** — pure helper: split summaries into `{ actionable, idle }` and sort actionable by `eligibleCount` desc. Keeps logic out of the view (Rule: no helpers in component files). |
| `constants/query-parsers.ts` | **NEW** — extract `TABS` literal + `tabParser` (`parseAsStringLiteral(TABS).withDefault('overview')`) so the view and the card share one source of truth (codebase nuqs convention). |
| `ui/views/campaigns-view.tsx` | Consume `tabParser`/`TABS` from `constants/query-parsers.ts` instead of inlining them. |
| `ui/views/campaigns-setup-view.tsx` | New responsive 2/1 grid; drop `max-w-3xl`. |
| `ui/components/setup/cloudtalk-sync-card.tsx` | Header `flex-col sm:flex-row`; wrap table in `overflow-x-auto`. |

**No changes to:** routers, services, DAL, schemas, hooks, the Leads tab, or `enroll-all-popover.tsx` logic (styling only if needed). The page shell (`campaigns-view.tsx`) changes only to import the extracted tab parser — no structural/tab change.

**"→ Setup" tab switch (approved: direct nuqs in the card).** The helper line's "→ Setup" link switches the `tab` param directly via `useQueryState`, avoiding prop-drilling. To match the codebase nuqs convention (parsers extracted to `constants/query-parsers.ts`, per `meeting-flow` / `schedule-management`), extract the currently-inlined `TABS` literal + tab parser out of `campaigns-view.tsx` into `constants/query-parsers.ts` so both `campaigns-view.tsx` and `source-rollup-card.tsx` consume the *same* `tabParser` (`parseAsStringLiteral(TABS).withDefault('overview')`). Both call `useQueryState('tab', tabParser)`; the card calls `setTab('setup')`. This keeps a single source of truth for the tab keys.

---

## Visual / convention alignment

- Reuses the **existing shadcn token system** — no new palette or fonts (consistent with the 2026-06-06 spec's "consistency over generic suggestions" rule).
- **Status color = semantic + never color-alone:** every pill carries text (`Bound` / `No default`) alongside color; stats pair color with their label.
- **Focus:** `outline-2 outline-primary -outline-offset-2`, not `ring-*` (project convention — avoids clipping in scroll containers).
- **`tabular-nums`** on all counts.
- **A11y:** ≥44px touch targets on actions, contrast ≥4.5:1 in light + dark, focus order matches visual order.
- During implementation: run the standard `ui-ux-pro-max → web-design-guidelines → impeccable` audit chain before finalizing. Verify with `pnpm lint && pnpm tsc` (never `pnpm build`).

## Acceptance criteria

- Totals render as a slim bar visually distinct from cards; no longer three KPI cards.
- Needs-action cards are structurally uniform; the amber banner is gone, replaced by a header pill + (conditional) one-line helper; "Enroll all" buttons align across each row.
- Sources with `eligibleCount === 0` render as compact rows in an always-open bordered container, not full cards.
- Actionable cards sorted by `eligibleCount` desc; Eligible is the visually dominant stat.
- Setup fills the width via a 2/1 split (table card `col-span-2`, attributes `col-span-1`); no `max-w-3xl` dead zone.
- Mobile (375px): summary bar fits on one line, cards stack full-width, Setup cards stack, binding table scrolls horizontally — no horizontal page overflow on any tab.
- `pnpm lint` and `pnpm tsc` clean. No behavior/data/API change.

## Out of scope

- Leads tab (untouched).
- Page header / tab shell restructuring.
- Card-per-row mobile refactor of the Setup binding table (follow-up).
- Any data model, tRPC, service, or DAL change.
- The green 🖊 emoji in source-name data (left as-is per decision #7).
