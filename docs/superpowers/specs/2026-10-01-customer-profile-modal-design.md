# Customer profile modal: identity rail and tab bar

Status: draft for owner review · 2026-10-01 (revised after the owner grill the same day) · warm-up: https://claude.ai/artifact/FaTVMLzSAgCRPBGormG1GF (Option B, picked)

## 1. Goal

An agent opens a customer from the pipeline, the calendar, a meeting or a proposal, usually on a phone between appointments. They need to see who the customer is and where the deal stands, then add a note, book a meeting, start a proposal, or leave. In the owner's words: "The close button, the creation of related entities button etc should be at the bottom of the page, should be easy to click."

## 2. Decisions already made

| Decision | Source |
|---|---|
| Direction B: identity rail on desktop, bottom tab bar on phone | owner pick in /ui-warmup |
| Close sits on the left side: far-left slot of the phone tab bar, foot of the rail on desktop | owner correction to B |
| The wide hero photo becomes a 380×190 thumbnail at the top of the rail | owner ruling, 2026-10-01 |
| Copy, the tab set (Overview / Meetings / Projects), `CustomerProfileData`, `defaultTab` and `highlightMeetingId` stay | warm-up brief |
| Mode Operate, phone-first | warm-up brief |
| Add note and Add meeting keep their existing dialogs (`QuickNoteInput`, `CreateMeetingForm`); only the proposal picker's nested submenu is replaced | design approval |
| One layout tree, not two hidden by CSS. A shared `useMediaQuery` (built on `useSyncExternalStore`) picks the desktop or the phone arrangement at `md` (768px) and only that one mounts. Duplicates broke `register()` of name/phone/email (`setFocus`, `reset`), duplicated Radix trigger ids and loaded two hero image trees | owner grill 2026-10-01 |
| The New sheet on phone is a new shared primitive, `InlineSheet`: always mounted, no portal, toggled by `data-state`, drag to close. Not the shadcn Drawer (vaul) or a nested Radix dialog: those write to `<body>` on every open and close (pointer-events, react-remove-scroll), which forced whole-document restyles measured at 179ms of a 251ms open on desktop (memory `reference-modal-sheet-body-writes`), and vaul 1.1.2 ignores `modal={false}` | owner grill 2026-10-01 |
| Phone header is the full photo hero, pinned: it sits outside the scroller, the tab bar sits outside it too, and only the tab content between them scrolls. No name strip | owner grill 2026-10-01 |
| Switching tabs scrolls the content to the top | owner grill 2026-10-01 |
| The phone tab bar is built on shadcn `Tabs`: a new `variant: 'bar'` in `src/shared/components/ui/tabs.tsx` (the only `ui/` file this work touches). Close and New are plain buttons outside the tablist, placed among the tabs by a 5-column grid | owner grill 2026-10-01 |
| Contact rows and round contact buttons use a new shared presentational `ContactActionTrigger` (shape `row` or `round`, surface `card` or `image`) as the child of `PhoneAction` / `EmailAction` / `AddressAction` | owner grill 2026-10-01 |
| The proposal picker links with `next/link` to `ROOTS.dashboard.proposals.newForMeeting(meetingId)`; nothing calls `close()`, because `GlobalDialogs` closes the modal on a pathname change | owner grill 2026-10-01 |
| Desktop dialog: 32px from every viewport edge at `md+`, width capped at 100rem; fullscreen below 768 | owner grill 2026-10-01 |
| Overview is a single column below `xl` and has no inner scrollers | design approval |
| The header X is hidden for this modal; Close lives in the rail, the tab bar and the error state | design approval |

Warm-up findings this design fixes: F1 28px top-corner Close and ⋯ on phone; F2 verbs hidden behind ⋯ with a nested New proposal submenu; F3 two homes for Add meeting; F4 phone hero fixed at 264 of 844px; F5 unlabeled desktop glyph cluster mixed with view toggle and Close; F6 empty band under the desktop overview.

## 3. Content

Every string already exists; nothing new is claimed.

| Item | Source |
|---|---|
| Name, address, phone, email, initials | `CustomerProfileData['customer']`; `formatCustomerAddress`, `formatPhone`, `getInitials` |
| Contact actions (call/text, email, maps, edit) | `PhoneAction`, `EmailAction`, `AddressAction` in `src/shared/components/contact-actions/ui/` |
| "Add address" / "Add phone" / "Add email" placeholders and gating | `customer-hero-header.tsx` today (`canAgentSeePhone`, `editForm.canEditContact`) |
| Insights badges | `customer-profile-key-insights.tsx` |
| Street / Aerial / Map | `hero-view-toggle.tsx` `VIEW_CONFIG` |
| Tab labels `Overview`, `Meetings (n)`, `Projects (n)` | `customer-profile-modal-content.tsx` |
| "Add meeting", "New proposal", "Add note", "Attach it to a meeting", "No meetings yet", "A proposal is built against a meeting.", "Add a meeting first" | `customer-hero-actions.tsx` |
| "Close" | base modal's sr-only label, now visible |
| "New" (tab bar label) | new UI label for the create sheet trigger; the owner may rename |

## 4. Architecture

### Layout

```
≥768 (md): dialog 32px from every edge, ≤100rem wide        <768: fullscreen
┌─────────────────────┬──────────────────────────────┐    ┌──────────────────────┐
│ rail 380            │ Overview | Meetings | Projects│    │ PHOTO HERO (pinned)  │
│ ┌ map 190 ┐ toggle  │ ─────────────────────────────│    │  toggle (top right)  │
│ avatar              │ tab content                  │    │  name ✎    (☎)(✉)   │
│ name ✎              │ (the only scroller)          │    │  ⌖ address           │
│ ⌖ address  (40px)   │                              │    │  insights            │
│ ☎ phone    (40px)   │                              │    ├──────────────────────┤
│ ✉ email    (40px)   │                              │    │ tab content          │
│ insights            │                              │    │ (the only scroller)  │
│ ─────────────────── │                              │    │   ┌ New sheet ─────┐ │
│ [ New proposal   ]  │                              │    │   │ slides up from │ │
│ [Add meeting][note] │                              │    │   │ behind the bar │ │
│ ✕ Close        Esc  │                              │    ├───┴────────────────┴─┤
└─────────────────────┴──────────────────────────────┘    │ ✕   ◷   (+)   ▦   ▢  │
                                                           │Close Ov New Meet Proj│
                                                           └──────────────────────┘
```

- **One tree.** `CustomerProfileModalContent` owns the edit form, the commands, the tab, the highlight, the New sheet state and the scroller ref. `useMediaQuery('(min-width: 768px)')` (the query is built from `BREAKPOINTS.md`) picks `CustomerProfileDesktopLayout` or `CustomerProfilePhoneLayout`; the other never mounts. The modal is only ever rendered client-side after a click, so the hook's first client read is already correct and no layout flashes. Crossing 768 with the modal open (rotation, window resize) swaps arrangements and keeps the tab, the highlight and unsaved edit values (the form state lives above both).
- **One `Tabs` root** wraps whichever arrangement is mounted (`flex-col`, `md:flex-row`). Both arrangements render the same `CustomerProfileTabPanels`.
- **Rail** (card rung, `border-r`, 380px): `CustomerAddressHero` in a 190px box with `HeroViewToggle` top-right; a 68px avatar overlapping the map by 34px; the name row with the edit toggle; contact rows; insights; then the command stack pinned at the foot. The identity part scrolls on its own if a short viewport cannot fit it.
- **Phone**: the photo hero (`min-h-56`, about 224px, sized to its content) holds the name row with the edit toggle and the round call/email buttons, the one-line address row and the insights; `HeroViewToggle` sits top-right below the top safe-area inset. The hero is outside the scroller and never moves. In edit mode it grows to show the name, phone and email inputs and the content area shrinks; the tab bar stays visible. Below the hero, the content scroller; below that, the tab bar.
- **Tab bar** (card rung, `border-t`): a `nav` with a 5-column grid, 56px slots, `pb` adds the bottom safe-area inset. DOM order is Close, New, then the `TabsList variant="bar"` (Overview, Meetings, Projects). The tablist spans columns 2 to 5 as a `grid-cols-subgrid` with its tabs at subgrid columns 1, 3 and 4, and New takes the bar's column 3, so the visual order is Close · Overview · New · Meetings · Projects while the tablist holds only tabs. New is a 48px primary disc raised above the bar; it rotates into an × while the sheet is open. Meetings and Projects carry count badges.
- **Overview:** unchanged composition (`CustomerProfileOverview`). At ≥1280 (`xl`) the 3/5 + 2/5 split stays; below `xl` it is one column with the profile cards after the timeline. No inner scrollers; the pane scrolls as one.

### Commands

- `useProfileCommands()` (plain hook) returns `{ canAddMeeting, canAddProposal, meetingOpen, noteOpen, setMeetingOpen, setNoteOpen, openMeeting, openNote }`. `CustomerProfileCommandDialogs` renders the two existing dialogs once, given those, the customer and `onMutationSuccess`. Today they mount twice (once per header variant).
- **Rail stack** (`CustomerHeroActions`, now rail-only): New proposal (`Button` default, `h-11 w-full`) as a `DropdownMenu modal={false}` trigger opening `side="top"` with `CustomerProposalPicker`; Add meeting and Add note (`outline`, `h-11`, two columns, collapsing to one when Add meeting is not allowed); Close (`ghost`, left-aligned, an `Esc` hint).
- **New sheet** (`CustomerProfileNewSheet` on `InlineSheet`): step 1 lists New proposal (sub-line "Attach it to a meeting"), Add meeting and Add note. New proposal and Add meeting are gated by `ability.can('create', …)` as today; Add note is ungated, so New always has at least one verb. Step 2 (New proposal) shows `CustomerProposalPicker` with a Back button. Add meeting and Add note close the sheet and open their dialogs. Every opening starts on step 1. The sheet sits above the content and below the tab bar, so it rises from behind the opaque bar, and the bar (Close, the tabs, the × disc) stays live while it is open. Tapping a tab closes it.
- `CustomerProposalPicker`: one component with `presentation: 'menu' | 'list'`. Each meeting row is a `next/link` `Link` to `ROOTS.dashboard.proposals.newForMeeting(m.id)`; in the menu it sits inside `DropdownMenuItem asChild`. The empty state shows "No meetings yet" and "Add a meeting first".
- **Removed:** `headerActions` on the modal; the header X (hidden via the modal's `className` with `**:data-modal-close:hidden`; `base-modal.tsx` untouched; Escape and the overlay still close); the top-left mobile ⋯ trigger; the `Popover` + Add Meeting button in `CustomerMeetingsList` (F3).

### Shared primitives

- `src/shared/hooks/use-media-query.ts`: `useMediaQuery(query: string): boolean` on `useSyncExternalStore` (`getSnapshot` reads `matchMedia(query).matches`, `getServerSnapshot` returns `false`).
- `src/shared/components/ui/tabs.tsx`: `variant: 'bar'` for `TabsList` (clears the pill track; layout comes from the caller) and `TabsTrigger` (56px icon-over-label slot, active = `bg-muted` + `text-primary`); `tabsTriggerVariants` is exported so a plain button in the same bar (Close) matches the tabs.
- `src/shared/components/contact-actions/ui/contact-action-trigger.tsx` with `contact-action-trigger-variants.ts`: presentational button, `shape: 'row' | 'round'`, `surface: 'card' | 'image'`, props `icon` and `label` (visible text for a row with a `title`, the `aria-label` for a round disc). It spreads every prop including `ref`, so it works as the `asChild` child of the contact action dropdown triggers. Customer gating (`canAgentSeePhone`, the "Add …" placeholders, edit-mode inputs) stays in customer components.
- `src/shared/components/dialogs/sheets/inline-sheet.tsx` (+ `inline-sheet-body.tsx`, `src/shared/hooks/use-drag-to-close.ts`, `src/shared/constants/drag-to-close.ts`, `src/shared/constants/inline-sheet.ts`): props `id`, `open`, `onOpenChange`, `labelledBy`, `className`, `children`. Renders a backdrop and the sheet where it is placed; the nearest positioned ancestor is its frame. A `--inline-sheet-offset` custom property (set through `className`) lifts the sheet off the frame's bottom edge for a bar that stays live below it. `role="dialog"`, `aria-modal="false"`, `inert` while closed, `data-state="open|closed"`, 260ms `translate` on `cubic-bezier(0.32,0.72,0,1)`, a backdrop tap closes it. Escape: a `keydown` listener on `window` in the capture phase stops the event and closes the sheet. Radix's dismissable layers listen on `document` in the capture phase, and window's capture runs first, so the dialog around the sheet stays open. Opening by keyboard moves focus to the first focusable element; closing returns focus to the element with `aria-controls={id}`. Drag to close is ported from `sidebar-mobile-sheet.tsx`: the drag starts only after 6px, so taps land; release past 25% of the sheet height or faster than 0.5px/ms closes it, anything less springs back; the click that ends a drag is suppressed. A drag that starts inside `InlineSheetBody` (the part that may scroll) is left to native scrolling. `sidebar-mobile-sheet.tsx` is not changed (follow-up).

### Modal shell

`customer-profile-modal.tsx` passes `className`: `md:h-[calc(100dvh-4rem)] md:max-h-none md:w-[calc(100vw-4rem)] md:max-w-[100rem]`; `sm:max-md:h-full sm:max-md:max-h-none sm:max-md:max-w-full sm:max-md:rounded-none sm:max-md:border-0` (the base modal becomes a centered dialog at `sm`; a plain `max-md:` would lose to its `sm:` classes in the CSS order, the stacked `sm:max-md:` wins, verified against Tailwind 4.1.18); `**:data-modal-close:hidden`. `HeroViewToggle` state stays here. The loading skeleton uses the same media hook and draws the rail and pane, or the hero, content and a tab bar with a live Close. The error state renders `ErrorState` with a Close button.

### Types

No new data types. `CustomerProfileTab`, `NewSheetChoice`, `NewSheetStep`, `ProfileCommands` are UI types in `types/profile-modal.ts`; `HeroView` stays exported from `hero-view-toggle.tsx`.

### Motion and reduced motion

The sheet slides 260ms on `cubic-bezier(0.32,0.72,0,1)` (the sidebar sheet's curve); its backdrop fades on the same curve; the New disc's plus rotates 200ms; the map crossfade stays as is. All transitions drop under `prefers-reduced-motion`.

### Accessibility

- The tab bar is a `nav` with `aria-label="Customer profile"`; its `tablist` contains only `tab`s, and arrow keys move among the three. Close and New are plain buttons with visible labels. Tab order is Close, New, then the active tab (DOM order), which differs from the visual order around New.
- The New sheet is `role="dialog"` `aria-modal="false"` `aria-labelledby` its heading, `inert` while closed; the New button carries `aria-controls` and `aria-expanded`.
- Every tab bar target is at least 56px tall and 44px wide at 390px; rail buttons are 44px tall; contact rows and round buttons 40px.
- The visually hidden `DialogTitle` stays (`{name}'s Profile`).

## 5. Data access

- **Reads used as-is:** `customerPipelinesRouter.getCustomerProfile` (customer, meetings, projects, hasRecording, notes); `customerPipelinesRouter.getRecordingUrl`.
- **Writes used as-is:** `customersRouter.crud.update` (address, name, phone, email via the edit form), `useCustomerNoteActions().createNote`, `CreateMeetingForm`'s create mutation; invalidation through `useInvalidation().invalidateCustomer`.
- **Required changes the user runs first:** none.
- **UI adaptations at the edge:** none.

## 6. Error handling and edge cases

| Case | Behavior |
|---|---|
| Profile query pending | skeleton in the new shape with a live Close; no commands rendered |
| Profile query error | existing `ErrorState` with a Close button inside the dialog |
| No address | the map shows the dark fallback; the view toggle is hidden (as today); "Add address" when editable |
| No phone / gated phone | phone row and call button hidden; "Add phone" only when unlocked and editable (as today) |
| Zero meetings | the picker shows "No meetings yet" and "Add a meeting first", which opens Add meeting |
| Viewer lacks create rights | New proposal / Add meeting are absent from the rail stack and the sheet; Add note is ungated, so the New slot always stays |
| Edit mode active | the rail grows and scrolls above the pinned command stack; on phone the hero grows, the content shrinks, the tab bar stays |
| Crossing 768 with the modal open | the other arrangement mounts; tab, highlight and unsaved edits survive |
| Long names and emails | truncate with a `title` attribute; the rail never widens |
| Deep link to a meeting (`defaultTab: 'meetings'`, `highlightMeetingId`) | opens on Meetings with the row highlighted at both widths |
| iOS PWA | the tab bar adds the bottom safe-area inset; the phone hero adds the top inset |

## 7. Verification

- `pnpm tsc`, `pnpm exec eslint <changed paths>`.
- Stop the dev server, `rm -rf .next`, restart before judging rendered CSS.
- Shared primitives first, in isolation: a temporary `/dev/primitives-check` page (deleted in the same task, never committed) and a Playwright script check the row and round triggers (sizes, `title`, `aria-label`, opening a contact menu as an `asChild` child), the bar tablist (only tabs, visual order, arrow keys) and `InlineSheet` (inert when closed, keyboard focus in and back, Escape stopped before a document capture listener, tap lands, drag closes without clicking, backdrop closes).
- The modal: Playwright as the super-admin fixture (`/api/dev/playwright-session?secret=…&role=super-admin`, the fixture that reaches pipeline cards), opened from `/dashboard/pipeline`, at 1440×900, 1024×768, 1920×1080, 700×900 and 390×844, `colorScheme` light and dark. Desktop sizes: the dialog is at least 90% of the viewport in both directions with 24 to 40px gaps on every edge (at 1920 the 100rem cap applies: height and top/bottom gaps as before, side gaps equal and at least 24px); rail 380, map 190; underline tabs; the New proposal menu opens upward; Escape closes the menu, not the modal; choosing a meeting navigates to `/dashboard/proposals/new?meetingId=` and the dialog is gone. Phone and 700px: fullscreen; Close bottom-left within the bottom 100px; every bar target at least 44×44; the tablist holds only tabs; the hero does not move when the content scrolls; a tab switch resets the scroll to 0; New opens the sheet; New proposal → picker → Back; Escape closes only the sheet; a drag past 30% closes it and a 10px drag springs back; edit mode shows the name input with the bar still visible, and exactly one `input[name=phone]` exists. A forced 500 on `getCustomerProfile` shows the error state with a Close button.
- Deep link from the Meetings table ("View Meeting") at 1440 and 390: the Meetings tab is selected and one meeting card is outlined.
- Screenshots to `.playwright-mcp/customer-profile-<viewport>-<scheme>.png`, personal values masked.
- Then `/impeccable polish src/shared/entities/customers/components/profile`: one batched round, one confirmation round at most.
- Owner hands-on check on a phone, including Add note and Add meeting (they write data, so they are not automated).

## 8. Files

**Create (shared)**
- `src/shared/hooks/use-media-query.ts`
- `src/shared/hooks/use-drag-to-close.ts`
- `src/shared/constants/drag-to-close.ts`
- `src/shared/constants/inline-sheet.ts`
- `src/shared/components/dialogs/sheets/inline-sheet.tsx`
- `src/shared/components/dialogs/sheets/inline-sheet-body.tsx`
- `src/shared/components/contact-actions/ui/contact-action-trigger.tsx`
- `src/shared/components/contact-actions/ui/contact-action-trigger-variants.ts`

**Modify (shared)**
- `src/shared/components/ui/tabs.tsx` (`bar` variant, export `tabsTriggerVariants`)

**Create (under `src/shared/entities/customers/`)**
- `types/profile-modal.ts`, `constants/profile-modal.ts`, `lib/format-profile-meeting.ts`, `hooks/use-profile-commands.ts`
- `components/profile/`: `customer-profile-command-dialogs.tsx`, `customer-proposal-picker.tsx`, `customer-contact-input-row.tsx`, `customer-contact-add-trigger.tsx`, `customer-contact-address-row.tsx`, `customer-contact-phone-row.tsx`, `customer-contact-email-row.tsx`, `customer-contact-buttons.tsx`, `customer-edit-toggle.tsx`, `customer-profile-tab-bar-trigger.tsx`, `customer-profile-new-button.tsx`, `customer-profile-tab-bar.tsx`, `customer-profile-new-menu.tsx`, `customer-profile-new-sheet.tsx`, `customer-profile-phone-hero.tsx`, `customer-profile-tab-panels.tsx`, `customer-profile-phone-layout.tsx`, `customer-profile-rail.tsx`, `customer-profile-desktop-layout.tsx`, `customer-profile-loading-skeleton.tsx`

**Modify (under `src/shared/entities/customers/`)**
- `components/profile/customer-profile-modal.tsx`, `customer-profile-modal-content.tsx` (rewrite), `customer-hero-header.tsx` (rewrite), `customer-hero-actions.tsx` (rewrite, rail stack only), `customer-profile-overview.tsx`
- `components/lists/customer-meetings-list.tsx` (drop the Add Meeting popover and the `customerName` prop)

**Delete:** none.

**Off limits:** `src/shared/components/dialogs/modals/base-modal.tsx`, every other file under `src/shared/components/ui/`, `src/shared/components/ui/sidebar-mobile-sheet.tsx`, everything under `src/trpc/`, `src/shared/db/`, `src/shared/entities/customers/dal/`, entity services, and every `openModal` caller outside the customers entity.

## 9. Out of scope and follow-ups

- **Out of scope:** the recording player, funnel intake card, timeline internals, profile card internals, edit-mode behavior, the base modal.
- **Follow-up:** `getCustomerProfile` runs 7 DAL queries one after another; run the independent ones in parallel.
- **Follow-up:** a shared `prefetchCustomerProfile` on `pointerdown`/hover for the 13 `openModal` callers, so the profile is often loaded before the dialog opens.
- **Follow-up:** move `sidebar-mobile-sheet.tsx` onto `InlineSheet` and `useDragToClose`.
- **Follow-up:** move the contacts in `action-detail-sheet.tsx` onto `ContactActionTrigger`.
- **Follow-up:** Add note and Add meeting still open centered Radix dialogs on top of the profile on phone. If they feel heavy on device, move them into the New sheet as further steps.
- **Follow-up:** the "New" label is a placeholder name for the create trigger; the owner may prefer "Create" or "Add".
- **Follow-up:** a deep link highlights a meeting but does not scroll it into view; a long Meetings list can hide the highlighted card below the fold.
- **Follow-up:** DESIGN.md:8 still lists the pre-ladder app background (`oklch(0.965 0.009 246)`); globals.css derives it from `--canvas-l`.
