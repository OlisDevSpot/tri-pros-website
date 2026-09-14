# Meeting Flow Shell — Stage, Top Bar, Inspector Panel, Keys

**Date:** 2026-09-13
**Status:** Approved 2026-09-13 (Phase 4 choices answered); implementation plan next
**Scope:** The meeting-flow shell around every step (`/dashboard/meetings/[meetingId]?step=n`,
`src/features/meeting-flow/ui/views/meeting-flow.tsx`). One full-size stage instead of three
stacked bands, a top bar that carries the customer, a shell-owned inspector panel behind a
hamburger, a floating step capsule, present mode, and one keyboard owner. Step content is
untouched except where it read the shell's old chrome variable.

Related: `docs/plans/2026-09-13-meeting-flow-keyboard-focus-research.md` (key routing,
focus, snap scrolling, cited), `docs/plans/2026-09-13-meeting-flow-present-mode-research.md`
(template opt-out, sidebar mechanism, cited), studies artifact
https://claude.ai/code/artifact/321e2f16-910b-4abf-9ae3-b48417cb3cd2 (study B with panel
model P1 is the visual reference, v2 carries the two corrections),
`docs/superpowers/specs/2026-09-12-who-we-are-scroll-presentation-design.md` (the
presentation primitive this shell hosts), `docs/superpowers/specs/2026-09-13-specialties-trade-sheet-design.md`
(sibling step spec; coordination in §9), `docs/codebase-conventions/app-shell.md`,
`docs/ui-design-playbook.md` (hard rules), `docs/how-to/ui-exploration.md` (process).

---

## 1. Goal

The agent presents from a laptop at the kitchen table, sometimes from a tablet, with the
homeowner looking at the same screen. The shell must:

- be one container: the presentation takes the entire height and width of its parent, no
  navigation band above it and no previous/next band below it;
- answer the keyboard everywhere in the flow, on every step, without clicking into the
  content first: Left and Right change the step, Up and Down and A and Z move within the
  presentation, 1 to 7 jump, P presents, Escape backs out;
- carry the customer's identity in the top bar, next to the step tabs and the logo, with the
  customer profile one click away; no call, text, or email actions there, because the screen
  faces the homeowner;
- keep the internal material (context, persona, reschedule) one deliberate reach away in a
  right-hand panel that is fixed and collapsible, overlaps the stage when open, and is not a
  Sheet, because steps already open sheets of their own;
- float the previous and next controls and the step counter above the content in a design
  that matches the presentation;
- treat pointer and keyboard as equals: every control is at least 44 px and every key has a
  visible control.

Root causes this design removes, measured in the Phase 1 baseline (`baseline.json`):

| Symptom | Root cause | Fix in this spec |
|---|---|---|
| Arrow keys "used to work" and do not | No key handler exists in the flow. Native arrows only scroll the browser's keyboard scroll target, and arriving via the tabs leaves focus on a header button | One window-level hook plus focusing the step root on every step change (§4.5) |
| Stage is 82 % × 79 % of the view at 1440 × 900 | Header and footer are flex bands inside the padded dashboard template; 166 px of vertical chrome | `data-stage` opt-out of the template padding, top bar only, capsule floats (§4.1) |
| Header collisions at 1024 (back link under tab 1, "Deal" clipped, "Syncing" under the logo) | Three clusters with absolutely centred tabs | Three-column grid with clipping zones and container-driven labels (§4.2) |
| Mobile bottom nav still shows on the flow at 390 | Layout renders it for every dashboard route | `:has([data-stage])` rule hides it (§4.1) |
| Presentation defends its bottom strip with `--pres-chrome-b` | Context and Persona pills float over the stage | Pills move into the panel; one shell-published clearance variable replaces the hard-coded strip (§4.3) |

## 2. Decisions already made

| Decision | Choice | Where it was made |
|---|---|---|
| Direction | B: stage plus rail, with present mode | User, 2026-09-13 |
| Panel model | P1 inspector rail | User, 2026-09-13 |
| Scene | Mix: laptop to present, tablet sometimes. Keyboard and 44 px touch both first-class | User, 2026-09-13 |
| Side panel | Not a Sheet. One collapsible, fixed container, shell-owned, overlapping the stage when open | User, 2026-09-13 |
| Mock correction 1 | The panel sits below the rail in z-order and emerges from behind it; still above the stage | User, 2026-09-13 |
| Mock correction 2 | The customer menu is anchored to the customer button | User, 2026-09-13 |
| Present mode mechanism | The existing `useSidebar()` from the shadcn provider that already wraps the dashboard: remember `open`, `setOpen(false)`, restore on exit and unmount. No provider override | User, 2026-09-13 |
| Capsule | Always visible. No idle fade, no pointer-move listeners, no timers | User, 2026-09-13 |
| Keyboard owner | One `keydown` listener on `window`, bubble phase, in the view. `defaultPrevented` plus target-ancestry guards. Focus the step root after each step change with `preventScroll` | Keyboard research note (verified against installed Radix and Next sources) |
| Beat navigation | Absolute `scrollTo` to the section's snap position from a pending index; never `scrollBy` | Keyboard research note §4.3 |
| Template opt-out | `data-stage` on the flow root, `has-data-stage:p-0` on the template main, one `:has()` rule that hides the mobile nav. No route group, no new layout | Present-mode research note Q3 |
| Reduced motion | CSS `motion-safe:` gating for every transition; `MotionConfig reducedMotion="user"` stays in the presentation. Motion's `useReducedMotion` is not used for gating (installed 12.31.0 snapshots once) | Both research notes, verified |
| Privacy | Context and Persona hold internal sales psychology. The panel opens only by a deliberate action, never from the URL, and closes when present mode starts | Phase 1 |
| Data access | UI-only build. No DAL, tRPC, schema, or seed change | Phase 2 and 3 |
| Company facts | Logo through `Logo`; no new company copy in the shell | Ground rule |
| Present toggle | In the capsule as a fourth control, on every size, so a tablet with no keyboard can enter and exit. The rail holds Meeting, Context, Persona only | User, 2026-09-13 (Phase 4) |
| Customer chip | Opens `CustomerProfileModal` directly. No call, text, or email actions in the shell: "we're presenting to the homeowner" | User, 2026-09-13 (Phase 4) |
| Tab labels | Only when the top bar is at least 1300 px wide (as in the approved study); otherwise numbered roundels with the title as tooltip and accessible name | User, 2026-09-13 (Phase 4) |
| Page-step gutters | Page steps' own scroller restores `px-4 md:px-6`; the presentation stays edge to edge | User, 2026-09-13 (Phase 4) |
| Cookie side effect | Accepted: a reload while presenting boots with the sidebar collapsed and the top bar visible; leaving present mode restores the remembered state | User, 2026-09-13 (Phase 4) |

## 3. Content

Everything the shell shows and where the copy comes from.

| Element | Copy or data | Source |
|---|---|---|
| Back link | "Meetings" (icon only below `sm`) | `ROOTS.dashboard.meetings.root()` |
| Customer chip | Initials, name, one address line; click opens the customer profile | `meeting.customer.name`; `getInitials(name)` from `src/shared/entities/users/lib/get-initials.ts`; `formatCustomerAddress` from `src/shared/lib/formatters.ts:38` over `address`, `city`, `state`, `zip`; `CustomerProfileModal` via `useModalStore().setModal` then `open()` (pattern: `src/features/proposal-flow/ui/components/proposal/heading.tsx:33-41`) |
| Step tabs | Number, short label, title | `MEETING_STEPS[].stepNumber`, `.shortLabel`, `.title` (`constants/step-config.ts`) |
| Sync status | "Live", "Syncing...", "Offline" (dot only below `md`) | `SyncStatusIndicator` (unchanged) |
| Logo | Company mark, right variant | `Logo variant="right"` |
| Hamburger | "Open meeting panel" / "Close meeting panel" | New constant in `constants/shell-copy.ts` |
| Capsule | "Previous step", "Next step", `n / 7`, "Present" / "Exit present mode" | `currentStep`, `TOTAL_STEPS`; labels in `constants/shell-copy.ts` |
| Live region | "Step n of 7: {title}" (visually hidden) | `stepConfig.title` |
| Panel: Meeting | Scheduled date and time, meeting type, outcome, Reschedule, View in schedule, Keyboard list | `meeting.scheduledFor`, `meeting.meetingType`, `meeting.meetingOutcome`; `useRescheduleChange` (already in the view) gated by `canRescheduleFromOutcome` with `CANNOT_RESCHEDULE_REASON`; `ROOTS.dashboard.scheduleWithMeetingHighlight(meetingId, scheduledFor)`; key list from `constants/keyboard-hints.ts` |
| Panel: Context | The six existing sections, unchanged | `ContextPanel` body (Situational, Customer Profile, Property, Financial, Agent Observations, Outcome) |
| Panel: Persona | The existing profile content, unchanged | `PersonaProfilePanel` body; `meetingFlowRouter.getPersonaProfile` enabled only while the section is open |

Keyboard list (`MEETING_FLOW_KEY_HINTS`, one array, rendered as `<kbd>` badges in the
Meeting section and used for `aria-keyshortcuts` values):

| Keys | Does |
|---|---|
| ← → | Previous / next step |
| ↑ ↓ and A Z | Previous / next beat in the presentation |
| 1 – 7 | Jump to step |
| P | Present mode on / off |
| Esc | Close the panel, then exit present mode |

## 4. Architecture

### 4.1 Shell shape and the template opt-out

The view root becomes the stage frame:

```
div[data-stage] .relative.flex.h-full.min-w-0.flex-col.[--stage-inset-b:5rem]
├─ TopBar            (always rendered; present mode = fullscreen + sidebar, §4.7)  h-12
└─ div .relative.isolate.flex.min-h-0.flex-1.overflow-hidden
   ├─ Stage          .relative.flex.min-h-0.min-w-0.flex-1.flex-col.overflow-hidden  (flex column: the presentation root is min-h-0 flex-1)
   │  ├─ presentation step: <WhoWeAreStep>  (its scroller is absolute inset-0 already)
   │  │  or page step:     <StepRegion>     (absolute inset-0 overflow-y-auto, §4.3)
   │  └─ StepCapsule  absolute bottom, centred, z-10
   ├─ MeetingPanel    absolute inset-y-0, right-0 (lg: right-12), z-20, slides in
   └─ InspectorRail   hidden lg:flex, w-12, z-30
```

Layering is local to the stage row (`isolate`): stage content 0, capsule 10, panel 20, rail 30.
Radix layers (sheets, dialogs, dropdowns, popovers) are portaled to `body` at `z-50` and sit
above all of it, so the Specialties trade sheet opens over an open panel. The panel is
non-modal on purpose: the stage stays interactive while it is open.

Template opt-out (present-mode note Q3, precedent `has-data-modal-hero:p-0` in
`src/shared/components/dialogs/modals/base-modal.tsx:41`):

- `src/app/(frontend)/dashboard/template.tsx`: `motion.main` gains `has-data-stage:p-0`.
- `src/app/(frontend)/globals.css`, next to the `data-no-gutter-stable` rule:
  `[data-slot='sidebar-inset']:has([data-stage]) [data-slot='dashboard-mobile-nav'] { display: none; }`.
- `src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx`: the fixed wrapper gains
  `data-slot="dashboard-mobile-nav"`.
- `docs/codebase-conventions/app-shell.md`: new rule `stage-routes-opt-out-with-data-stage`
  under the dashboard shape rule, so the next reader knows why the template has a `has-*`
  variant and why `layout.tsx` is untouched.

The loading, error, and invalid-step early returns render inside the same `data-stage` root so
the frame does not jump from padded to edge-to-edge when data arrives.

### 4.2 Top bar

`header` with `@container/topbar`, `h-12 shrink-0 px-3 md:px-4 border-b border-border/40`
and `grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3`. The outer
columns are `min-w-0 overflow-hidden`, which is what stops the 1024 px collisions: nothing is
absolutely positioned any more, the centre column takes its natural width, the side columns
clip.

- **Left**: back link (`size-11` hit area, icon plus "Meetings" `hidden sm:inline`), then the
  `CustomerChip`: a `Button variant="ghost"` `h-11 rounded-full` with an `Avatar` of initials,
  the name (`font-semibold`), and the address line (`text-muted-foreground`), both
  single-line with ellipsis, name and address `hidden md:grid`. Click opens
  `CustomerProfileModal` for `customer.id` through `useModalStore` (`setModal` then `open`),
  exactly as the proposal heading does; `title="View customer profile"`. No menu hangs off
  the chip, so mock correction 2 has nothing left to anchor. With no customer on the meeting
  the chip reads "No customer" and is disabled.
- **Centre**: `StepTabs` (`nav aria-label="Meeting steps"`), replacing `step-nav.tsx`. Each
  tab is a `Button variant="ghost"` `h-11 px-2 rounded-md gap-2` with a `size-6` roundel
  (`tabular-nums`, `text-[11px] font-bold`) and the short label
  `hidden @[81.25rem]/topbar:inline`. States: done (foreground), active (accent text and
  tint, `aria-current="step"`), upcoming (muted at 60 %). `title={step.title}` and
  `aria-label` = title when the label is hidden. `aria-keyshortcuts={String(stepNumber)}`.
  The active tab is the top bar's one primary-colour moment.
- **Right**: `SyncStatusIndicator`, `Logo` (`h-8 w-28`, `hidden sm:block`), then the
  hamburger: `Button variant="ghost" size="icon"` `size-11`, `MenuIcon`, `aria-expanded`,
  `aria-controls="meeting-panel"`, label from `shell-copy.ts`. Click toggles the panel on its
  last section (default Meeting).

The Reschedule button leaves the header for the panel's Meeting section (§4.4). Its dialog
(`RescheduleDialog`) stays mounted in the view.

### 4.3 Stage, scroll ownership, clearance

The stage owns no scrolling itself (`pages-own-their-scroll`). Each step layout brings its
scroller:

- **Presentation** (`layout: 'presentation'`): `SnapPresentation` is unchanged in shape. Its
  scroller gains `data-step-root` and drops `[--pres-chrome-b:3.5rem]`; it now reads
  `--stage-inset-b` from the root. The four consumers rename the variable:
  `pinned-column.tsx:27`, `hook-section.tsx:21`, `point-section.tsx:26`,
  `credentials-section.tsx:68` (`max(…cqh, var(--stage-inset-b))`).
- **Page** (`layout: 'page'`): new `StepRegion` component,
  `div role="region" tabIndex={-1} aria-labelledby={h1Id} data-step-root` with
  `absolute inset-0 overflow-y-auto overscroll-contain px-4 pt-6 md:px-6 pb-(--stage-inset-b)`
  and `outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset`.
  The `h1` stays visually hidden and gets the id. Because it is focusable, native Up, Down,
  Page Down and Space scroll it once the step-change effect focuses it (Chromium starts its
  scroll chain at the focused element; keyboard note §3).

`--stage-inset-b` is `5rem`: capsule 48 px, bottom offset 16 px, 16 px breathing. It is the
single value both scrollers and the presentation's bottom-anchored content read, which also
retires the clearance variable the Specialties spec planned to publish for the old footer
triggers (§9).

### 4.4 Inspector rail and meeting panel

State in the view: `const [panel, setPanel] = useState<PanelSection | null>(null)` with
`type PanelSection = 'meeting' | 'context' | 'persona'` (`types/index.ts`), plus a
`lastSectionRef` so the hamburger reopens where the agent left off. Never in the URL.

**InspectorRail** (`hidden lg:flex`, `w-12 shrink-0 flex-col items-center gap-1 py-2 border-l bg-card z-30`):
three `size-11` ghost icon buttons, Meeting (`CalendarClockIcon`), Context
(`ClipboardListIcon` with the existing `filled/total` badge), Persona (`BrainIcon`, `default`
variant when `hasCustomerProfileData(customer)`). Each has `aria-pressed` when its section is
open, `aria-controls="meeting-panel"`, `title`. Clicking the open section's button closes the
panel. The rail stays visible in present mode: on a laptop the internal material remains one
click away without bringing the chrome back.

**MeetingPanel** (`id="meeting-panel" role="complementary" aria-label="Meeting panel"`):
`absolute inset-y-0 right-0 lg:right-12 z-20 w-full sm:w-[380px] max-w-full bg-card border-l shadow-lg grid grid-rows-[auto_minmax(0,1fr)]`.
Closed: `translate-x-full` and the `inert` attribute (React 19 boolean prop), so nothing inside
is focusable or announced and the row's `overflow-hidden` clips it. Open: `translate-x-0`.
Transition `motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(.32,.72,0,1)]`.
On `lg+` the panel's right edge is the rail's left edge, so a closed panel sits under the
rail (rail `z-30` over panel `z-20`) and slides out from behind it: correction 1.

Header: segmented section tabs (three `h-11` `Button`s, `aria-pressed`), a close button
(`size-11`, `XIcon`). Body: `overflow-y-auto overscroll-contain px-4 py-3`, rendering one of:

- `MeetingSection`: date and time (existing formatters in `src/shared/lib/formatters.ts`),
  type, outcome as a badge, Reschedule (`Button variant="outline"`, same gating as today),
  "View in schedule" link, and the keyboard list as a
  definition list of `<kbd>` badges (pattern: `sidebar-search-bar.tsx:54`).
- `ContextPanel` body: the file keeps its name; the component drops the `Sheet` wrapper and
  the `isOpen` / `onOpenChange` props and renders its six `ContextPanelSection`s directly.
- `PersonaProfilePanel` body: same change; it mounts only while its section is open, so the query
  still loads lazily.

Focus: opening moves focus to the panel header (`tabIndex={-1}`, `focus({ preventScroll: true })`).
Closing (X, Escape, rail, hamburger, entering present mode) moves focus back to the step root,
the same target the step-change effect uses, so the keys keep working. The panel does not trap
focus and does not lock scroll.

Below `lg` there is no rail; the hamburger and the panel's own section tabs do everything.
Below `sm` the panel is full width.

### 4.5 Keyboard owner and focus

`hooks/use-meeting-flow-keys.ts`, mounted once in `MeetingFlowViewInner`. One `keydown`
listener on `window`, bubble phase (never `document` capture: it would run before Radix's
Escape listener and close a dialog and exit present mode on the same key). Guards, in order:

1. `event.defaultPrevented` (Radix Select, Menu, RovingFocus, Dialog Escape, the carousel and
   slider all prevent default when they consume a key).
2. `event.isComposing || event.keyCode === 229`.
3. `metaKey || ctrlKey || altKey`; `shiftKey` additionally bails for arrows only.
4. Target outside the flow root (every Radix layer is portaled to `body` and keeps focus
   inside it; `body` itself counts as inside).
5. Target matches the typing selector (`input`, `textarea`, `select`, content-editable, and
   the `combobox`, `listbox`, `option`, `textbox`, `searchbox`, `slider`, `spinbutton`,
   `menu*` roles), which covers the panel's own fields and Selects.

Map (`event.key`; repeats ignored for P, Escape, digits):

| Key | Action |
|---|---|
| Escape | panel open → close it; else presenting → exit; else nothing |
| ArrowLeft / ArrowRight | `setCurrentStep(step ∓ 1)` within `1..TOTAL_STEPS` |
| ArrowUp / ArrowDown, a / z | `presentationRef.current?.prev() / next()`; when there is no presentation handle the arrows are left to the browser (they scroll the focused `StepRegion`) |
| p | toggle present mode |
| 1–9 | `setCurrentStep(n)` when `n <= TOTAL_STEPS` |

Focus after a step change: `useEffect` on `currentStep` calls
`rootRef.current?.querySelector('[data-step-root]')?.focus({ preventScroll: true })`.
nuqs updates React state synchronously, so the new step is committed when the effect runs
(keyboard note §3). `preventScroll` matters: a bare `focus()` centre-scrolls inside a snap
container.

Presentation handle: `SnapPresentation` accepts `ref: Ref<PresentationHandle>` (React 19 ref
prop) and exposes `{ next(), prev() }` through `useImperativeHandle`. Inside, `scrollToIndex(i)`
reads the section element from a registry the context now carries
(`registerSection(index, el | null)`, filled by `SnapSection`'s ref callback), subtracts the
scroller's computed `scroll-padding-top` (the `--pin-h` band below `lg`), and calls
`scroller.scrollTo({ top })`. A `pendingIndexRef` makes a second press during a smooth scroll
advance from the pending target; it resets when `activeIndex` catches up. `behavior` is left
at `auto`, so `motion-safe:scroll-smooth` decides. `WhoWeAreStep` gains a `presentationRef`
prop and passes it as `ref`. Only this presentation exists today; future presentation steps do
the same.

Exposure: Prev `aria-keyshortcuts="ArrowLeft"`, Next `"ArrowRight"`, each tab its digit,
the present toggle `"P"`, the presentation scroller `"ArrowUp ArrowDown A Z"`. The capsule
carries a visually hidden `aria-live="polite" aria-atomic="true"` span with
"Step n of 7: {title}" that exists before it changes.

Screen readers in browse mode intercept arrows and letters before the page sees them; that is
by design and why every key also has a visible control.

### 4.6 Step capsule

`StepCapsule`, absolutely positioned in the stage:
`absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-10 -translate-x-1/2 flex h-12 items-center gap-0.5 rounded-full border p-0.5 shadow-lg backdrop-blur-md`.
Surface follows the step: page steps `bg-background/80 border-border text-foreground`;
presentation `bg-(--presentation-ground)/70 border-white/15 text-white` (the view knows
`stepConfig.layout`). Contents: Previous (`size-11 rounded-full` ghost, `ArrowLeftIcon`,
disabled on step 1), counter (`min-w-[3.25rem] text-center text-xs font-semibold tabular-nums`),
Next (same, `ArrowRightIcon`, disabled on the last step), a hairline divider, the present toggle
(`size-11`, `PresentationIcon` / `MinimizeIcon`, `aria-pressed`). Icon buttons carry `title`
and `sr-only` labels. No fade, no timers; it is always there.

### 4.7 Present mode

Present mode is the browser's own fullscreen — the same action as F11 — plus the app
sidebar collapsed to icons through `useSidebar().setOpen(false)`. Nothing else changes: the
top bar, rail, panel and capsule render as usual (the view closes the panel on entry).

`hooks/use-present-mode.ts`:

```ts
const { setOpen } = useSidebar()
const [presenting, setPresenting] = useState(false)
useEffect: on document 'fullscreenchange' → active = document.fullscreenElement !== null;
           setPresenting(active); setOpen(!active)
toggle(): document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()
exit():   if (document.fullscreenElement) document.exitFullscreen()
```

`presenting` mirrors `document.fullscreenElement`, so leaving fullscreen by any route (Esc,
F11, the capsule toggle, `exit()`) re-opens the sidebar and the state follows. Present state
is not in the URL and not persisted; `setOpen` writes the `sidebar_state` cookie (choice 5 in
§2). Platforms without the Fullscreen API (iPhone Safari) cannot present; the toggle is a
no-op there. User directive 2026-09-13: this supersedes the earlier remember/restore design
(rememberedOpen ref, external-reopen effect, unmount restore, top-bar hiding), which was
over-complicated.

### 4.8 Responsive behaviour

| Width | Top bar | Panel | Rail | Capsule | Notes |
|---|---|---|---|---|---|
| ≥ 1024 (`lg`) | Full; labels when the bar ≥ 1300 px | 380 px, right of the stage at `right-12` | Visible | Centre bottom | Sidebar expanded 256 px or icon 48 px |
| 768–1023 (`md`) | Chip shows initials plus name; labels off | 380 px at `right-0` | Hidden | Same | Sidebar exists; present collapses it |
| 640–767 (`sm`) | Back label, logo shown; chip initials only | 380 px at `right-0` | Hidden | Same | Sidebar is a sheet; present hides the top bar only |
| < 640 | Back icon only; logo hidden; sync dot only | Full width | Hidden | Same, safe-area aware | Dashboard mobile nav hidden by the `:has()` rule |

No horizontal scroll at any width: both outer top-bar columns are `min-w-0 overflow-hidden`,
the closed panel is clipped by the stage row.

### 4.9 Motion and reduced motion

Panel transform 300 ms, tab and button colour changes 150 ms, all behind `motion-safe:`. The
sidebar keeps its own width transition. The presentation keeps `MotionConfig reducedMotion="user"`
and `motion-safe:scroll-smooth`. No `transition-all`. Nothing animates height or layout.

### 4.10 Accessibility

- Landmarks: `header`, `nav aria-label="Meeting steps"`, `region` step root labelled by the
  step `h1`, `complementary` panel, `aria-live` progress.
- Every control ≥ 44 px (`size-11` / `h-11`), visible `focus-visible` rings, `aria-pressed`
  on toggles, `aria-expanded` and `aria-controls` on the hamburger and rail buttons,
  `aria-current="step"` on the active tab, `aria-keyshortcuts` where a key drives a control.
- Escape order: Radix layer first (it prevents default), then the panel, then present mode.
- Character keys (P, A, Z, digits) are active only while focus is inside the flow region,
  which satisfies WCAG 2.1.4.
- Colour never carries state alone: done, active, and upcoming tabs differ by weight and
  roundel fill as well as colour; the Context badge shows the count.

## 5. Data access

**Reads used as-is**
- `meetingsRouter.reads.getByIdWithJoins({ id })`: `meeting.customer` (`id`, `name`,
  `address`, `city`, `state`, `zip`, profile columns),
  `scheduledFor`, `meetingType`, `meetingOutcome`, `contextJSON`, `flowStateJSON`,
  `agentNotes`, `proposalCount`, `hasSentProposal`, `hasApprovedProposal`.
- `meetingFlowRouter.getPersonaProfile({ meetingId })`, enabled only while the Persona section
  is open (today: only while its Sheet is open; same behaviour).

**Writes used as-is**
- `meetingsRouter.crud.update` (flow state, context, agent notes), `meetingFlowRouter.updateCustomerProfile`,
  `useOutcomeChange`, `useRescheduleChange`.

**Required changes the user runs first**: none.

**UI adaptations at the edge**: none. The shell shows the customer's name and address only;
phone and email stay inside `CustomerProfileModal`, which applies its own visibility rules.

## 6. Error handling and edge cases

- **Loading, error, invalid step**: rendered inside the `data-stage` root so the frame does not
  change shape when data arrives; the existing `LoadingState` and `ErrorState` are reused.
- **No customer on the meeting**: chip reads "No customer" and is disabled; Persona section
  shows its existing empty state; Context sections still edit the meeting's own fields.
- **Radix layer open** (trade sheet, dialogs, dropdowns, popover): flow keys are ignored via
  `defaultPrevented` and the target guard; Escape closes the layer only.
- **Typing in the panel**: inputs, textareas, and Selects match the typing selector; arrows and
  letters never change the step.
- **Panel open across a step change**: stays open (the agent may be editing context while
  moving on). Entering present mode closes it.
- **Push subscription banner above the flow**: the stage is `h-full` of the layout's `flex-1`
  wrapper, so it shrinks; nothing overlaps.
- **Safe areas**: capsule bottom offset uses `env(safe-area-inset-bottom)`; the dashboard
  layout already pads the top inset.
- **Reload while presenting**: present mode ends (not persisted); the sidebar boots from the
  cookie `setOpen(false)` wrote, i.e. collapsed; `?step` is preserved.
- **⌘/Ctrl+B while presenting**: the provider's shortcut opens the sidebar; the present hook
  sees `open` turn true and exits present mode, so chrome comes back as one unit.
- **Two listeners on Left/Right**: the query toolbar's shortcut hook also claims the arrows,
  but it mounts only on the meetings list page (`PastMeetingsTable`), never inside a step.
- **Reduced motion**: panel appears without sliding; smooth scrolling becomes instant.

## 7. Verification

Playwright against a fresh `.next` (`rm -rf .next` before `pnpm dev`), dev session via
`/api/dev/playwright-session`, viewports 1440 × 900, 1024 × 768, 820 × 1180, 390 × 844, light
and dark, steps 1, 2 and 4. Screenshots to `.playwright-mcp/shell-after-<w>-<scheme>-step<n>.png`
mirroring the baseline names.

Layout
- The stage row's box equals the template main's box minus the top bar at every width
  (template padding is 0 on this route; other dashboard routes keep `px-4 md:px-6`).
- `[data-slot='dashboard-mobile-nav']` is not displayed at 390; it is displayed on
  `/dashboard/meetings` at 390.
- Top bar height 48; no element's box exceeds the bar; at 1024 the back link, tab 1, "Deal",
  sync, and logo boxes do not intersect.
- No horizontal scroll at 390 (`scrollWidth === clientWidth` on the document and the stage).
- Every interactive element in the top bar, rail, capsule, and panel header has width and
  height ≥ 44.

Keys (fresh load, no click)
- ArrowRight twice → `?step=3`; ArrowLeft → `?step=2`; `5` → `?step=5`; `9` → unchanged.
- After each step change `document.activeElement` has `data-step-root`.
- Step 1: ArrowDown twice → the presentation's active index is 2 and `scrollTop` equals the
  third section's snap offset; `a` → index 1; `z` → index 2. Step 2: ArrowDown scrolls the
  step region (its `scrollTop` increases) and the step does not change.
- `p` → sidebar `data-state="collapsed"`, top bar absent; `p` again → sidebar state and
  `sidebar_state` cookie equal their values before entering.
- While presenting, ⌘B → present mode ends and the sidebar is expanded.
- Open the Specialties trade sheet (or any dialog), press Escape → the sheet closes, present
  mode and the panel are unchanged; press Escape again → the panel closes if open.
- Focus the Agent Notes textarea in the panel, press ArrowRight → step unchanged.

Panel
- Hamburger → panel `transform: none`, `inert` absent, focus inside the panel header;
  computed z-index of the panel < the rail's at 1440; Escape → panel `inert`, focus on the
  step root.
- Rail Context button → Context section; badge text matches `filled/total`.
- Persona query is not requested until the Persona section opens (network log).

Static
- `pnpm tsc` and `pnpm lint` clean. Never `pnpm build`.

## 8. Files

**Create**
- `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts`
- `src/features/meeting-flow/hooks/use-present-mode.ts`
- `src/features/meeting-flow/constants/keyboard-hints.ts` (`MEETING_FLOW_KEY_HINTS`)
- `src/features/meeting-flow/constants/shell-copy.ts` (button labels)
- `src/features/meeting-flow/ui/components/shell/top-bar.tsx`
- `src/features/meeting-flow/ui/components/shell/customer-chip.tsx`
- `src/features/meeting-flow/ui/components/shell/step-tabs.tsx`
- `src/features/meeting-flow/ui/components/shell/step-capsule.tsx`
- `src/features/meeting-flow/ui/components/shell/step-region.tsx`
- `src/features/meeting-flow/ui/components/shell/inspector-rail.tsx`
- `src/features/meeting-flow/ui/components/shell/meeting-panel.tsx`
- `src/features/meeting-flow/ui/components/shell/meeting-section.tsx`

**Modify**
- `src/features/meeting-flow/ui/views/meeting-flow.tsx`: compose the shell; remove the header,
  footer, floating triggers and both Sheets; `data-stage`; panel and present state; key hook;
  focus effect; `presentationRef`.
- `src/features/meeting-flow/types/index.ts`: `PanelSection`, `PresentationHandle`.
- `src/features/meeting-flow/ui/components/context-panel.tsx`: body only (no `Sheet`,
  no `isOpen` / `onOpenChange`).
- `src/features/meeting-flow/ui/components/persona-profile-panel.tsx`: body only; mounted
  only while its section is open.
- `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx`: `ref` handle,
  section registry, `scrollToIndex`, `data-step-root`, drop `--pres-chrome-b`, doc comment.
- `src/features/meeting-flow/ui/components/presentation/snap-section.tsx`: register its
  element.
- `src/features/meeting-flow/contexts/presentation-context.tsx`: `registerSection`.
- `src/features/meeting-flow/ui/components/presentation/pinned-column.tsx`,
  `steps/who-we-are/hook-section.tsx`, `point-section.tsx`, `credentials-section.tsx`:
  `--pres-chrome-b` → `--stage-inset-b`.
- `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx`: `presentationRef` prop.
- `src/app/(frontend)/dashboard/template.tsx`: `has-data-stage:p-0`.
- `src/app/(frontend)/globals.css`: the `:has([data-stage])` rule.
- `src/features/agent-dashboard/ui/components/mobile-bottom-nav.tsx`: `data-slot`.
- `docs/codebase-conventions/app-shell.md`: rule `stage-routes-opt-out-with-data-stage`.

**Delete**
- `src/features/meeting-flow/ui/components/step-nav.tsx`
- `src/features/meeting-flow/ui/components/context-panel-trigger.tsx`
- `src/features/meeting-flow/ui/components/persona-profile-trigger.tsx`

## 9. Out of scope and follow-ups

- **Step slot in the panel** (the studies' "Scopes" demo): no registration API in this build.
  Steps that need their own overlay use their own sheet (the Specialties trade sheet).
- **Specialties spec coordination**: its §4 note that the context and persona panels "can adopt"
  the sheet host later, and its clearance variable for the footer triggers, are superseded by
  this shell (`--stage-inset-b`). Both specs edit `meeting-flow.tsx`; the shell lands first and
  the Specialties plan rebases on the new view.
- **Customer quick actions (call, text, email) in the shell**: dropped on 2026-09-13 because
  the screen faces the homeowner. If agents ever want them, they belong in the panel's Meeting
  section, never in the top bar; `PhoneAction`, `EmailAction`, and `AddressAction` are ready
  to reuse.
- **Help dialog on `?`**: the key list lives in the panel's Meeting section; a dialog can come
  later if agents ask.
- **Present mode in the URL**: deliberately not shareable or restorable.
- **Provider-owned present override** (no cookie write) and **idle-fading capsule**: dropped by
  the user on 2026-09-13; revisit only if the cookie side effect or the capsule's presence
  turns out to bother agents in the room.
- **`getComputedStyle(scroller).scrollPaddingTop` for `cqh`**: the keyboard note expects a
  pixel value; the plan verifies once at a `<lg` viewport before relying on it.
- **Global `* { scroll-margin-top: 80px }`** (`globals.css:470`): still a marketing-site rule
  leaking into the app; existing follow-up from the Who We Are spec.
- **Motion's `useReducedMotion` docs vs source**: documented as re-rendering on change,
  installed 12.31.0 snapshots once. Not used here; noted for anyone who reaches for it.
- **Staleness pings to fix separately**: `docs/codebase-conventions/frontend-stack.md:3`
  says "Two route groups" but lists three; `memory/MEMORY.md` says coding-conventions has
  "27 enforced rules", the file has 29.
