# Dashboard edge-to-edge layout: design

> **Status:** design approved in conversation by the owner on 2026-10-12; this written spec awaits their review. Nothing is built.
> **Facts:** read-only audit of every dashboard route on 2026-10-12 at `5f9a3d425`. Re-check a `file:line` before relying on it.
> **Delete this file when it ships;** the rule it leaves behind lives in `docs/codebase-conventions/app-shell.md` and in the utilities themselves.

## 1. Goal

On a phone the dashboard wastes the screen. The template's `<main>` pads 16px on each side and ~88px at the bottom, and clips (`overflow-hidden`). So:

- **Sides.** Horizontal scrollers (pipeline board, tables, schedule grid) stop 16px short of the screen edge on both sides, cutting content that is about to scroll in.
- **Bottom.** Pages that scroll as a whole (home, analytics, settings…) end in a hard cut ~16px above the floating dock. Everything below that line, behind and beside the dock, is dead space.

**Success:**

1. A page-level horizontal scroller shows the page gap on a side only when there is no more content that way: gap at rest on the left, edge on the right while more columns wait, gap on the right at scroll end.
2. A page that scrolls as a whole runs to the bottom of the screen, its content passing behind the dock, and its last item still stops clear of the dock.
3. Pages whose scroll lives inside a data container (tables, schedule, pipeline) keep today's gap above the dock.
4. The top is unchanged.
5. A new page gets this with zero config if it uses the shared bodies, and with one class if it scrolls as a whole. A page that opts into nothing renders exactly as today.
6. Works on every width; from `md` the left inset is the rail's gap, so only the right side bleeds.

## 2. Owner rulings (2026-10-12)

- **R1 — the card rides along.** A framed data body (DataTable, schedule grid) keeps its rounded, bordered card, but the card lives *inside* a full-width scroller and is as wide as its content. At rest: left gap, left border, card runs off the right edge. At scroll end: right border, right gap. (Rejected: card goes flat on phones; card stays inset.)
- **R2 — soft canvas fade under the dock.** Behind the dock zone, a fade in the canvas colour, so content dissolves into the dock rather than showing sharp text in its gaps. (Rejected: nothing; frosted band.)

## 3. The mechanism: insets as variables, two utilities

### 3.1 One definition of the dock and the page insets

`:root` (globals.css) owns the dock's geometry:

```css
--dock-h: 3.5rem;                                          /* MobileDockCapsule h-14 / menu button size-14 */
--dock-baseline: max(1rem, env(safe-area-inset-bottom));   /* MOBILE_DOCK_BOTTOM_CLASS */
--dock-clear: calc(var(--dock-baseline) + var(--dock-h) + 1rem);
```

`<main>` (`DASHBOARD_MAIN_CLASS`) owns the page insets and pads by them:

| Var | phone | `md` and up |
|---|---|---|
| `--page-t` | `1rem` | `var(--gutter)` |
| `--page-r` | `1rem` | `var(--gutter)` |
| `--page-b` | `var(--dock-clear)` | `var(--gutter)` |
| `--page-l` | `1rem` | `0` (the rail's right inset is the gap) |

`padding: var(--page-t) var(--page-r) var(--page-b) var(--page-l)`. The stage opt-out (`has-data-stage:p-0`) becomes "all four insets are 0", so nothing downstream bleeds inside the meeting flow.

`<main>` also publishes the **bleed allowance** that descendants may reach into: `--bleed-l: var(--page-l)`, `--bleed-r: var(--page-r)`, `--bleed-b: var(--page-b)`.

Every place that hand-copies the dock today reads the vars instead:

- `dashboard-main.ts` (the `pb-[calc(3.5rem+…)]`)
- `dashboard-generic-content-skeleton.tsx:11` (a duplicated string; it imports the constant instead)
- `MOBILE_DOCK_BOTTOM_CLASS`, `MOBILE_DOCK_SHEET_CLASS` (`mobile-dock.ts`)
- `pwa-install-prompt.tsx:84`
- `dashboard-view.tsx:24` (`pb-16` goes)

### 3.2 The allowance resets where a page edge stops being the edge

A data view never knows whether it sits on a page, in a tab, in a card or in a modal (data-view spec, `2026-10-07-data-view-surface-design.md` §1). So the shared bodies always apply `bleed-x`, and the allowance decides how far that reaches:

- **Every surface resets `--bleed-*` (never `--bled-*`, 3.3) to 0.** Done on the existing all-surfaces rule (`globals.css:537`, `:is(.bg-card, .surface, .surface-beneath, .bg-popover, .surface-overlay)`). Inside a card, sheet or popover nothing bleeds: a DataTable in the lead-source detail pane renders exactly as today.
- **Outside `<main>` the vars are unset, so the allowance is 0.** Portalled modals (customer profile) need no rule.
- **A `bleed-x` element resets `--bleed-l/r` to 0 for its descendants,** so nested scrollers never double-bleed.
- **A non-surface wrapper that adds horizontal padding** between `<main>` and a `bleed-x` body must reset `--bleed-l/r` to 0 itself. Today none sits on a bleeding path, so there is no utility for it yet. The convention doc names the rule.

### 3.3 `bleed-x`: horizontal scrollers

```css
@utility bleed-x {
  /* What this scroller actually took. Inherits past surfaces, so the card and sticky
     pieces inside can line up with the visible edge (4.3). */
  --bled-l: var(--bleed-l, 0px);
  --bled-r: var(--bleed-r, 0px);
  margin-inline: calc(-1 * var(--bled-l)) calc(-1 * var(--bled-r));
  padding-inline: var(--bled-l) var(--bled-r);
  scroll-padding-inline: var(--bled-l) var(--bled-r);
  & > * { --bleed-l: 0px; --bleed-r: 0px; }  /* no double bleed below (3.2) */
}
```

The reset sits on the children, not on the scroller: a custom property declared on the element itself would zero its own margin. Surfaces reset `--bleed-*` only, never `--bled-*`, so a card inside a scroller still knows the scroller's edges. (`--edge` is taken: it is an elevation knob.) Replaces `mobile-bleed-right` (`globals.css:1171`, hard-coded `1rem`, kanban only).

**Measured 2026-10-12 (static probe, Chromium + WebKit in the Playwright Docker image):**

- **WebKit drops the inline-end padding of a block scroller.** A `bleed-x` scroller must be a flex row, or end its content in a spacer. Flex scrollers keep the end padding in both engines.
- **Neither engine adds a scroller's padding to a grandchild's overflow.** That's why DataTable ends its content in a spacer of width `--bled-r`.
- **Sticky offsets resolve against the scroller's content box, not its screen edge.** A pinned column or panel uses `left: calc(-1 * var(--bled-l))` to sit flush at the screen edge.
- **`overflow: clip` on the riding card keeps sticky working.**

**Ancestors must not clip sideways.** These ancestors are `overflow-hidden` today and become `overflow-y-clip` (vertical containment kept, horizontal visible):

- `RecordsPageFrame`
- `CustomerPipelineView`'s root
- `ScheduleView`'s root

This is also why the old `mobile-bleed-right` never reached the screen edge.

### 3.4 `page-scroll`: a page that scrolls as a whole

```css
@utility page-scroll {
  overflow-y: auto;
  overscroll-behavior-y: contain;
  margin: 0 calc(-1 * var(--bleed-r, 0px)) calc(-1 * var(--bleed-b, 0px)) calc(-1 * var(--bleed-l, 0px));
  padding: 0 var(--bleed-r, 0px) var(--bleed-b, 0px) var(--bleed-l, 0px);
  scroll-padding-bottom: var(--bleed-b, 0px);
  /* Descendants keep --bleed-l/r (this element pads by exactly that), so a rail inside
     can still bleed to the screen sides; they lose --bleed-b. */
  & > * { --bleed-b: 0px; }
}
```

The scroller reaches the screen bottom (and, on a phone, both screen sides, so the scrollbar sits at the window edge and card shadows stop clipping). Its own padding brings the content back, so the last item lands `--dock-clear` above the bottom: clear of the dock. Variants work (`max-lg:page-scroll`, since `@utility` takes variants). It must be the last box in `<main>`'s column for the bottom bleed to land on the screen edge; every page-scroll target below already is.

**No `:has()` on `<main>`.** Bleeding is local: an element reaches into an inset its ancestor reserved. `<main>` never learns what its page is. `layout.tsx` keeps its fixed shape (`app-shell.md#dashboard-layout-shape-fixed`), and layout-level scroll is still forbidden (`#pages-own-their-scroll`).

### 3.5 The convention, for future pages

> **If the whole page scrolls, put `page-scroll` on its scroller. Horizontal bodies (`DataTable`, `KanbanBoard`, `ScheduleCalendar`) bleed by themselves.** Do nothing else and the page renders as today.

This goes into `docs/codebase-conventions/app-shell.md` as a new rule `page-insets-and-bleed`. The doc's stale "`motion.main`" (`:119-129`) becomes "`main`" in the same edit.

## 4. Where it applies

### 4.1 `page-scroll` (replaces each scroller's own `overflow-y-auto` and any hand-rolled bleed)

| Route | Element |
|---|---|
| `/dashboard` | `dashboard-view.tsx:23`, phone through `lg` only (`max-lg:page-scroll`); from `lg` the two columns keep their own scroll and `<main>` pads as today |
| `/dashboard/settings` | `settings-view.tsx:29` |
| `/dashboard/analytics` | `analytics-view.tsx:52` (drops `-mr-2 pr-2`) |
| `/dashboard/campaigns` overview, setup | `campaigns-overview-view.tsx:40`, `campaigns-setup-view.tsx:15`, and the overview skeleton (drop `pr-1`) |
| `/dashboard/calculators` | scope tab `calculators-view.tsx:32`. The remodel ROI story canvas is deferred: it is a pane inside an `overflow-hidden` tab and, from `lg` up, a two-pane grid, so bleeding it means restructuring that workspace. |
| `/dashboard/projects/new`, `[projectId]` | `create-project-view.tsx:62`, `edit-project-view.tsx:157` below `lg` |

### 4.2 `bleed-x` (inside the shared bodies, so every consumer inherits it)

| Body | Change |
|---|---|
| `KanbanBoard` (`kanban-board.tsx:121`) | `bleed-x` on the board; `customer-pipeline-view.tsx:181` drops `mobile-bleed-right` |
| `DataTable` | Card rides along (4.3) |
| `ScheduleCalendar` week and today views | Card rides along (4.4) |

### 4.3 DataTable: the card rides along

Today (`data-table.tsx:284-433`): frame `rounded-xl border overflow-hidden surface` → scroller (both axes) → `Table` (`width: totalDeclaredWidth; min-width: 100%`) → pagination inside the frame.

After:

- **The scroller is the outermost box and gets `bleed-x`.** It is not a surface, so the allowance reaches it.
- **The card moves inside the scroller.** The frame (`surface rounded-xl border`) wraps the table, with width = table width, `min-width: calc(100% - var(--bled-l) - var(--bled-r))`. The table's `min-width: 100%` becomes "fill the card".
- **The sticky header stays** `top-0` on the scroller. The card's top edge scrolls up under it vertically.
- **The frozen first column moves from `left-0` to `left: calc(-1 * var(--bled-l))`.** At rest it sits at the gap. Once scrolled it pins flush at the screen edge, which is the edge-while-more-content behaviour. The sticky z-order and the dashed border are unchanged.
- **The expanded-row panel** (`data-table-row.tsx:117`, sticky `left-0`, `width: 100cqw`) becomes sticky at `left: calc(-1 * var(--bled-l))` with `width: calc(100cqw + var(--bled-l) + var(--bled-r))`. It spans the screen, and the card's `overflow: clip` trims it to the card at rest and at the scroll end. The `cqw` container stays the scroller's full-width child, now a flex `@container` that also holds the trailing spacer.
- **The pull spinner** is `100cqw` wide and not sticky, so at rest it already centres on the card. No change.
- **Pagination leaves the card** and becomes its own inset bar below the scroller (`surface rounded-xl border`, same grid as today).
- **Inside a surface, the allowance is 0.** The scroller then equals today's frame box, and the card fills it with no gap, so the picture matches today apart from pagination being a separate bar.

### 4.4 Schedule: the card rides along

Today (`schedule-calendar.tsx:47`): one surface card holds `CalendarHeader` (date nav) and the view.

After:

- **`CalendarHeader` becomes its own surface card above the grid,** the way the table's toolbar sits above the table.
- **Week view (`schedule-week-view.tsx:74`):** the horizontal scroller gets `bleed-x`. The day-header row and the day columns sit inside a card that is `w-max` with `min-width` = visible width minus the bleed. Each day column keeps its own vertical scroll.
- **Today view (`schedule-today-view.tsx:101`, Radix ScrollArea, both axes, sticky top header row and sticky-left label cells):** the ScrollArea root gets `bleed-x` and the card goes inside its viewport, as in DataTable. The sticky-left labels pin at the screen edge once scrolled.
- **Month view:** it has no horizontal scroll, so it sits in an inset card as today.

### 4.5 Untouched

- **Scrollers inside a padded card stay in the card,** whether automatically (the surface resets the allowance) or because they don't use `bleed-x`:
  - the toolbar `ChipRail`
  - the analytics tabs and report tables
  - lead-source tab lists and time-range chips
  - the meeting-row trades rail
- **The meeting flow** (`data-stage`).
- **Proposal new/edit:** a pinned tab row with the form card scrolling inside it (`form/index.tsx:284`), so it's contained scroll and stays as it is.
- **Contained pages keep `<main>`'s bottom inset,** so their bodies end 16px above the dock as today.

## 5. The fade under the dock (R2)

- **What it is:** a fixed, `pointer-events-none`, `md:hidden` element rendered by `MobileDock`. It sits inside the `data-slot="dashboard-mobile-nav"` wrapper, so the stage rule hides it and the typing state slides it away with the dock.
- **Stacking:** below the dock (`z-40`) and above page content (the table's sticky cells reach `z-30`).
- **Geometry:** `inset-x-0 bottom-0`, height `var(--dock-clear)`. Its top therefore stops exactly where contained pages end, so on table, pipeline and schedule pages it only ever covers bare canvas.
- **Paint:** solid `--background` (canvas, rung 0, `theme-conventions.md`) from the screen bottom up to `--dock-baseline`. From there to the top it fades to transparent. Both schemes follow the token.
- **Where it shows:** on page-scroll pages, mid-scroll content dissolves into it. At scroll end, the scroller's bottom padding has lifted the last item above it.
- **Hidden while the menu sheet is open.** Canvas over the sheet's scrim would read as a light band.

## 6. Interactions with pending work

- **Data-view surface spec (2026-10-07, awaiting review).**
  - Bodies stay unchanged there. This spec changes `DataTable` and `ScheduleCalendar` internals, which is compatible.
  - Constraint for that work: `DataView.Body` (one plain `div`) must not add horizontal padding, or it must reset `--bleed-l/r` to 0.
  - Its "hand-copied strip" removal in the schedule views touches the same files as 4.4. Whichever lands second rebases.
- **Records management R2 part 2 and the pipeline-speed follow-ups** touch `DataTable` and `KanbanBoard`. The plan re-reads both trackers before touching those files.

## 7. Out of scope (found during the audit)

- **The schedule month view and the lead-sources analytics tab have no scroller,** so tall content is clipped by the `overflow-hidden` chain. That's a separate fix. Each one could adopt `page-scroll` or a contained scroller later.
- **Desktop layout is otherwise unchanged.** Bleed only reaches into the existing `--gutter` on the right.

## 8. Verification

- **Screenshots from a local Playwright script, at 390×844 and 1280×800, in Chromium and WebKit, light and dark:**
  - home, analytics, settings
  - customers: at rest, scrolled to the middle, scrolled to the end, frozen column on and off, a row expanded
  - pipeline (Fresh): at rest and at the end
  - schedule: week at rest and at the end, today view
  - lead sources: a table inside a surface, unchanged
- **At 390px, prove by measurement, not by eye:**
  1. The left gap at rest is 16px.
  2. The right edge is flush while more content remains.
  3. The right gap at scroll end is 16px.
  4. The last item on page-scroll pages ends `--dock-clear` above the screen bottom.
  5. On table pages, the bottom of the pagination bar ends where it does today.
- **WebKit risk:** an overflow container's inline-end padding has historically been left out of the scrollable area. If the 16px right gap doesn't appear at scroll end in WebKit, `bleed-x` moves its padding onto an inner track element.
- `pnpm tsc` and `pnpm lint` pass.
- **Owner checks on their phone (installed app):** home and analytics behind the dock, the customers table end to end, the pipeline, the schedule week view.
