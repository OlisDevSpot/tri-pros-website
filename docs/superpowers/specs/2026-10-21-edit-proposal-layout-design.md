# Edit Proposal Page Layout — Design

> **Status:** approved 2026-10-21 ("Approved lets proceed"), with the §10 choices as written and Q1 = General info. Planning findings in §11. Plan: `docs/superpowers/plans/2026-10-21-edit-proposal-layout.md`. Nothing built.
> **Requirements:** `docs/plans/2026-10-21-edit-proposal-layout-requirements.md`. Its IDs (L1–L31, P1–P4) bind this spec. Every section below names the IDs it serves. Where this spec and the ledger disagree, the ledger wins; tell the owner.
> **Tracker:** `docs/plans/2026-10-20-proposal-editor-epic.md`, project PE4. Epic ruling O7 applies: rebuild what is wrong, no defensive "smooth transition" code.
> **Reference mock:** https://claude.ai/artifact/5BS6vyHTxQgEmw7jaENMTo (Version 8).

---

## 1. Goal

The rep edits a proposal on one screen that never scrolls as a document: the proposal's name, its customer and visit, and its actions on top; the four parts of the proposal on the left; the part being edited on the right, in a Card that is only as tall as its content. The customer and the visit are one click away as their full overview cards (L1, L14). The page reads well on a laptop, a tablet and a phone (L3).

The flow and the inputs themselves do not change here (L4). The structured SOW editor inside a section is PE2's work.

## 2. Decisions already made

Every row of the ledger, §1–§8, plus the Superseded table. In short:

- Overview on top. Below it: rail (lg), strip (md) or parts list (phone), and the part Card (L8, L20–L22).
- The customer and visit are a split trigger pill. Each half opens a panel of two tabs holding the **full** `CustomerOverviewCard` and `MeetingOverviewCard`. It is a 400px Popover at md+ and a Drawer on phone. The panel height is stable across tabs, and actions are the first row (L2, L14–L17).
- Today's toolbar, unchanged in look (L18). Preview is the eye alone (L13).
- Parts: General info, Scope of Work, Funding, Files (L19).
- A phone summary row above the dock (L24). No unsaved alert (L23).
- SOW accordion on `Collapsible` + `AnimatedCollapsibleContent`. Each open item scrolls inside itself with no sticky positioning (L26–L28). Section incentives stay in each section (L29). Agreement Notes is the last item (L30).
- Funding ledger and the Files Card (L31).
- The page opens on General info until the owner answers Q1.

## 3. Content

Existing labels only; no new copy except:

| String | Where | Note |
|---|---|---|
| "General info" | part label | L19 (today's tab says "General") |
| "Scope of Work", "Funding", "Files" | part labels | today's tab labels |
| "All parts" | phone back link | L22 |
| "Customer", "In-home visit" | panel tabs | L15 |
| "Price" | phone summary row | L12 |
| "Section incentives" | Funding ledger line | L31 |

Part summaries (rail, strip and phone list), all derived from live form values (`useWatch`):

| Part | Summary |
|---|---|
| General info | `timeAllocated` (rail); `type · timeAllocated` (phone list, where there is room) |
| Scope of Work | `n sections` |
| Funding | the final price, `computeFinalTcp` (`src/shared/modules/proposals/core/lib/financials/compute-price-side.ts:34-39`) fed with watched values |
| Files | `n files` from `proposalsRouter.media.list` |

## 4. Architecture

### 4.1 Page frame (L6, L8, L9)

`EditProposalView` becomes a static frame with no document scroll:

```
div.flex.h-full.min-h-0.flex-col.gap-(--gutter)
├─ EditProposalOverview            shrink-0 (PageBar surface: surface rounded-xl border px-3 py-2)
├─ lock Alert (when locked)        shrink-0, unchanged copy (see 4.9)
├─ body                            min-h-0 flex-1
│   lg: grid grid-cols-[240px_minmax(0,1fr)] gap-(--gutter) items-start, h-full
│        ├─ PartRail               surface card, self-start
│        └─ PartCard               flex 0 1 auto, min-h-0, max-h-full
│   md: flex-col gap-(--gutter): PartStrip, then PartCard
│   <md: PartList or PartCard (one at a time)
└─ PhoneSummaryRow (<md only)      shrink-0
```

- `PartCard` is the shadcn `Card` on the measured rhythm (L7): `flex min-h-0 flex-col`. Its `CardContent` is `min-h-0 overflow-y-auto` and scrolls only when the content is taller than the space left (L9). `max-h-full` keeps it inside the body; it never grows to fill it.
- The body uses the same `--gutter` as every dashboard page (L6). `<main>` already has `page-insets`, which gives the phone `--dock-clear` at the bottom, so `PhoneSummaryRow` sits above the dock as the frame's last row, with **no fixed positioning** (L24).
- The `motion.div` y:-30 entrance on the root goes away. The dashboard has "no fade anywhere" (memory `project-pipeline-schedule-speed`).
- The form shell's scroller `min-h-0 flex-1 overflow-y-auto` and the outer `overflow-auto md:pr-4` wrapper are removed. Each part scrolls inside its Card.

### 4.2 Overview (L10–L18)

`EditProposalOverview` lays out in three ways:
- **lg:** `grid grid-cols-[1fr_auto_1fr] items-center`, holding: name + Draft | `ProposalContextTrigger` | `ProposalToolbar` (right-aligned).
- **md:** row 1 is name + Draft and the toolbar; row 2 is the trigger.
- **phone:** the name, then the trigger at full width. No Draft and no toolbar here (L24).

- **`ProposalNameInput`** (L11) is the `project.data.label` field. The input shrinks to its text with the grid-stack technique: the input and an invisible `span` holding the same text share one grid cell, so the cell is as wide as the text in every browser. The Draft chip follows at `gap-1.5`. `field-sizing: content` is not used, because Safari support is uneven. The Draft chip shows when `status === 'draft'`; otherwise the status badge shows in the same place (verify the existing badge component in the plan).
- **`ProposalToolbar`** (L13, L18) is today's track from `form/index.tsx:156-267`, **moved, not restyled**. It keeps the Calculator → `InternalFinancialsModal`, the Settings popover with the Breakdown Pricing switch, the eye link, the Save split (lg) and the icon + chevron popover (below lg). Create mode keeps its single "Save & Preview" button.
- No created / viewed / price text (L12).

### 4.3 Customer and visit (L1, L2, L14–L17)

- **Data:** `customerPipelinesRouter.getCustomerProfile({ customerId })` gives `CustomerOverviewCardData` (`profile.customer`), and the meeting comes from `profile.meetings.find(m => m.id === meetingId)`. This is the same read the cockpit rows use (`cockpit/meeting-row.tsx:74-79`), so no data contract changes. The trigger's labels (customer name, visit date and type) come from `getFullView`, which is already loaded (`customer.name`, `meetingScheduledFor`), so the pill renders without waiting. The profile query is prefetched on idle, as the cockpit does (`cockpit.tsx:42-46`).
- **`ProposalContextTrigger`:** one pill, two buttons split by a hairline: `[initials + customer name] | [calendar icon + visit date · type + chevron]`. Each button opens the panel on its own tab. With no `meetingId`, it shows only the customer half.
- **`ProposalContextPanel`:** shadcn `Tabs` with two `TabsContent` panes stacked in one grid cell (`grid` with `[grid-area:1/1]`). Both panes are `forceMount`ed, and the inactive one is `invisible` + `inert`, so the panel's height is the taller card's and never changes on a tab switch (L16). The container is a `Popover` with `w-100` at md+ and a `Drawer` (vaul) below md, switched with `useIsMobile`.
- **Full card composition** (L2): the first full composition in the app, since no call site composes everything today (`cockpit/customer-row.tsx` uses only Actions):
  - Customer: `CustomerActionsHost` with `overrides={PROPOSAL_CUSTOMER_OVERRIDES}` (`src/features/proposal-flow/lib/customer-action-overrides.ts`, from the uncommitted round 1 change; keep it), containing `CustomerOverviewCard` with Header, **Actions** first (L17), then ContactActions, LeadSource and ProfileFields.
  - Visit: `MeetingActionsHost`, containing `MeetingOverviewCard` with Header, **Actions** first, then Fields, Owner, Trades and Proposals. **No VisitMeter** (L10). Hidden actions come from `constants/cockpit-actions.ts`.
  - The ⋯ menus open downward (`side="bottom"`).
- If the compound parts do not let Actions render before the body without a change to the shared card, that change is a shared-component edit and goes to the owner before the plan (Scope-is-the-spec). See §10.

### 4.4 Part navigation (L19–L23)

- `constants/form-parts.ts` replaces `FORM_TABS`: `general | sow | funding | files`, each with a label and a lucide icon. The nuqs `?formTab` sync stays, with default `general` (Q1).
- **`PartRail`** (lg): a surface card with a vertical nav list (`aria-current` on the active part), each row showing the label, the summary (§3) and an unsaved dot.
- **`PartStrip`** (md): the same four parts as a four-column strip.
- **`PartList`** (phone): the first view. Tapping a part shows its Card in place with an "All parts" back button. Both views use the same `?formTab`; on phone, no value means the list.
- **Unsaved dots** come from `formState.dirtyFields`, mapped to parts by field path prefix (`project.data.label|type|timeAllocated|validThroughTimeframe` → general; `project.data.sow`, `agreementNotes` → sow; `funding`, `priceDisplayMode` → funding). The dots clear on a successful save, when `form.reset(values)` runs. There is no banner or alert (L23).
- All four part panels stay mounted (today they are hidden, not unmounted), so field state and the SOW editors survive switching parts.

### 4.5 Phone summary row (L24)

`PhoneSummaryRow`, below md, is a Card row: Draft chip, "Price" + final price (the same `computeFinalTcp` value as the Funding summary), the ⋯ `DropdownMenu` (Preview → the eye link, Internal financials → the modal, Proposal settings → the Breakdown Pricing switch in a popover or sheet), and the Save split (Save / Save & Preview). It reuses the toolbar's handlers, so there is no second implementation. Its position is fixed by the frame (§4.1), so it never moves.

### 4.6 Scope of Work accordion (L25–L30)

Today's items (`project-fields.tsx:102-136`: `Collapsible` > `div.border.rounded-xl.overflow-hidden.bg-card` > `CollapsibleTrigger` + `SOWCollapsibleHeader` > `AnimatedCollapsibleContent`) keep their look. The CSS changes:

```
CardContent (sow)                flex min-h-0 flex-col
└─ list                          flex min-h-0 flex-col gap-2   (flex 0 1 auto)
   └─ item box (closed)          flex-none rounded-xl border bg-card overflow-hidden flex flex-col
      item box (open)            flex-[0_1_auto] min-h-60
      ├─ header                  flex-none; border-b when open
      └─ AnimatedCollapsibleContent   className="flex min-h-0 flex-col"   (keeps its own overflow-hidden)
         └─ div                  min-h-0 overflow-y-auto overscroll-contain   ← the body scrolls here
            └─ SOWSection (+ SowFinancialsFields)
```

- The open item shrinks to the space left and its body scrolls under its header. The header never moves, and nothing is `sticky` or `fixed` (L27, L28). With two items open, both shrink and each scrolls on its own.
- **The primitive is not modified.** `AnimatedCollapsibleContent` always applies `overflow-hidden` (needed for the height animation) and unmounts when closed (`collapsible.tsx:57-83`). The scroller is a child div, so the animation and the scroll do not fight. While it opens, motion animates to the measured natural height; flex shrink caps it at the space left the whole way.
- Every reveal uses the primitive with `COLLAPSE_TRANSITION` (L26): sections, cost lines' notes, section incentive rows (added and removed rows enter and exit with `AnimatePresence` + `COLLAPSE_HEIGHT_VARIANTS` from `constants/motion.ts`, the same variants the primitive uses), and the Funding incentive rows.
- **Section incentives** (L29) stay where `sow-financials-fields.tsx:283+` renders them, after Section Price and Cost Lines. The final price already subtracts them (`computeFinalTcp`).
- **Agreement Notes** (L30) moves from a block under the list (`project-fields.tsx:153-175`) into the list as the last item, closed by default. Its header shows a one-line truncated preview of `agreementNotes`, hidden while open. When open it is `flex-none` (it does not compete for height). Its body keeps the Templates link and the textarea.
- The `h3` "Complete Scope of Work" heading becomes the Card's `CardTitle` "Scope of Work" (L7).

### 4.7 Funding (L31)

A Card on the rhythm, hugging its content:
- **Ledger:** Scope of Work (Σ section prices), Misc Pricing (`funding.miscPrice`, breakdown mode only), Total Contract Price (`funding.startingTcp`, disabled in breakdown mode, as today), Section incentives (Σ), Incentives (Σ discounts), and **Final price**. Values come from `compute-price-side.ts`; nothing is computed twice.
- Then Deposit (`funding.depositAmount`, cap rule unchanged).
- Then incentives as `Collapsible` rows (`IncentiveCollapsibleHeader` + `AnimatedCollapsibleContent`), with fields unchanged.

There are no financing fields in the form today, and none are added.

### 4.8 General info and Files

- **General info** (L19): `GeneralFields` minus `label` (the label moves to the overview, L11). Project Type, Time Allocated and Valid Through Timeframe sit in `lg:grid-cols-3`, one column on phone.
- **Files** (L31): `ProposalMediaManager` inside a hugging Card. Moving Upload into the Card header depends on what the shared media manager exposes; see §10.

### 4.9 Lock states

The three lock Alerts (`edit-proposal-view.tsx:188-227`: draft, in-flight, terminal) keep their copy and actions, and render as one `shrink-0` row between the overview and the body, only when locked. The form is disabled then, so no edit competes with them. This is not the unsaved alert L23 removed.

### 4.10 Responsive and breakpoints

| Range | Overview | Nav | Card | Bottom |
|---|---|---|---|---|
| ≥ lg (1024) | one row | `PartRail` | right of the rail | — |
| md–lg (768–1023) | two rows | `PartStrip` | under the strip | — |
| < md | name, trigger | `PartList` ⇄ Card | in place | `PhoneSummaryRow` above the dock |

Hooks: `useIsBelowLg` and `useIsMobile` (existing). The panel switches Popover ⇄ Drawer at md.

### 4.11 Accessibility

- The rail and strip are a `nav` with `aria-label="Proposal parts"`, with `aria-current="page"` on the active part.
- The trigger's halves are buttons with `aria-haspopup="dialog"`, with accessible names "Customer: <name>" and "In-home visit: <date>".
- Escape closes the popover and drawer, and focus returns to the half that opened it.
- The inactive tab pane is `inert`.
- Each accordion header is the `CollapsibleTrigger` (`aria-expanded`). The scrolling body is focusable only through its fields.
- Reduced motion comes free from the primitive.

## 5. Data access

- **Reads used as-is:** `proposalsRouter.business.getFullView`, `customerPipelinesRouter.getCustomerProfile` (new on this page, but an existing procedure), `proposalsRouter.media.list`, and the construction reads in `sow-field.tsx`.
- **Writes used as-is:** `proposalsRouter.crud.update`, `proposalsRouter.incentives.replace`, `contracts.discardDraftContract`, and the media mutations.
- **Required changes the owner runs first:** none.
- **Edge adaptations:** none. View counts are not shown (L12), so `views.getProposalViews` is not read.

## 6. Error handling and edge cases

- **No meeting** (`meetingId` null): the trigger shows the customer half only and the panel shows the Customer tab only.
- **Profile still loading or failed:** the trigger renders from `getFullView`. The panel shows the card skeleton while loading; on error it shows an inline error with Retry inside the panel.
- **Locked proposal:** the form is disabled, Save is disabled, and the lock row shows (§4.9).
- **A long SOW with every section closed:** the list is just headers; the Card hugs it (L9).
- **Breakdown mode validation errors** (`superRefine`: section price > 0, cost line `relatedScopeId`, deposit ≤ cap): on a failed save, the rail and strip show an error state on the part holding the first error, and the form navigates there. Today the error can sit on a hidden tab.
- **Create mode** (`create-new-proposal-view.tsx` uses the same `ProposalForm` and `CustomerInfoHeader`): see §10.

## 7. Verification

Playwright at 1440×900, 820×1180 and 390×844, light and dark, on a dev proposal (auth `api/dev/playwright-session`; no DB writes, and the save path is checked only on a dev proposal the owner names). It runs the ledger's checklist, one assertion per line, plus:
- Today's toolbar markup diff: the classes are unchanged (L18).
- No `position: sticky|fixed` inside `main` apart from the dock (L28).
- `pnpm tsc` and `pnpm lint`. Never `pnpm build`.

## 8. Files

**Create** (feature-local, `src/features/proposal-flow/`):
- `ui/components/edit-page/edit-proposal-overview.tsx`
- `ui/components/edit-page/proposal-name-input.tsx`
- `ui/components/edit-page/proposal-toolbar.tsx` (moved from `form/index.tsx`)
- `ui/components/edit-page/proposal-context-trigger.tsx`
- `ui/components/edit-page/proposal-context-panel.tsx`
- `ui/components/edit-page/part-rail.tsx`, `part-strip.tsx`, `part-list.tsx`, `part-card.tsx`
- `ui/components/edit-page/phone-summary-row.tsx`
- `ui/components/form/agreement-notes-item.tsx`
- `ui/components/form/funding-ledger.tsx`
- `constants/form-parts.ts`
- `hooks/use-form-part-state.ts` (summaries, dirty and error per part)

**Modify:**
- `ui/views/edit-proposal-view.tsx` (frame, §4.1; drops `ProposalContextBand`, the entrance motion and the outer scroller)
- `ui/components/form/index.tsx` (tabs, toolbar and scroller out; parts render into `PartCard`)
- `form/project-fields.tsx` (accordion, §4.6)
- `form/general-fields.tsx` (label out)
- `form/funding-fields.tsx` (ledger)

**Delete:** `ui/components/proposal-context-band.tsx` (untracked, round 1), plus the cockpit-row reuse it pulled in if nothing else needs it (check `cockpit/customer-row.tsx` and `meeting-row.tsx` callers in the plan).

**Off limits:** DAL, `src/trpc/`, schema, seeds and entity services. Shared components (`overview-card.tsx` for customers and meetings, `collapsible.tsx`, the media manager) change only if the owner approves §10.

## 9. Out of scope and follow-ups

- **Out of scope:** the editing-flow rethink and the inputs per section (L4); the structured SOW editor (PE2); the payment schedule editor (PE1). PE1 and PE2 build into this shell; whichever lands second rebases.
- **Follow-up:** the create proposal page (`create-new-proposal-view.tsx`) still uses `CustomerInfoHeader` and the old shell.

## 10. Choices worth your eye

1. **Create page:** this spec changes only the edit page. Creating a proposal keeps today's tabs until a follow-up. The alternative is to move both now (the form is shared, so the shell change touches both anyway; about 20% more work).
2. **Lock alerts** (§4.9): one row under the overview, only when locked. The mock did not show them.
3. **Actions first inside the cards** (L17): if `CustomerOverviewCard` and `MeetingOverviewCard` render their parts in the order given, this is feature-local. If either root forces Actions to the bottom, the fix is a small change to a shared entity card. The plan checks this first and asks before touching it.
4. **Upload in the Files Card header** (L31): only if the shared media manager already exposes its upload trigger. Otherwise Upload stays where the manager draws it, and moving it becomes a follow-up.
5. **Errors jump to their part** (§6): new behaviour, small. It fixes today's hidden-tab error trap.

## 11. Planning findings (2026-10-21)

Found while reading the code for the plan. Items marked **needs a yes** wait for the owner; the rest follow from the approved text.

1. **Actions first is feature-local** (§10.3 resolved). Both card roots render their parts in the order the caller gives, so Actions can come first with no shared change.
2. **The L17 buttons need one shared prop — needs a yes.** "View Profile / Schedule Meeting / ⋯" is the shared `toolbar` mode of `EntityActionMenu`: the filled primary, the outline promoted actions, then the overflow menu. Customer and meeting actions carry no `promoted` flag, and `CustomerOverviewCard.Actions` and `MeetingOverviewCard.Actions` take only `mode`, `hide` and `className`. `ProposalOverviewCard.Actions` already takes `roles` and passes it through `withToolbarRoles` (`src/shared/components/entities/entity-actions/lib/with-toolbar-roles.ts`). The plan adds the same optional `roles` prop to the customer and meeting `Actions` (about four lines each, every existing caller unchanged). Toolbar mode labels its overflow trigger **"More"**, not ⋯; a ⋯ would need a second shared change, so the plan uses "More". Without the yes, the fallback is `mode="toolbar"` with no roles: View Profile + More, and View Meeting + More.
3. **Row animations need `sow-financials-fields.tsx`.** §4.6 asks that cost lines and section incentive rows enter and exit with the collapse variants. Those rows live in `form/sow-financials-fields.tsx`, which §8 left out. The plan adds it to Modify.
4. **The open SOW item's floor follows the collapse.** A flat `min-h-60` on the open item would snap the box to 240px on the first frame while its body is still growing from zero. The floor is applied on `data-state=open` with a `min-height` transition of 200ms on CSS `ease`, which is the same curve as `COLLAPSE_TRANSITION` (`cubic-bezier(.25,.1,.25,1)`), so box and body grow together. `motion-reduce:transition-none` matches the primitive's reduced motion.
5. **Files keeps the media manager as it draws itself** (§10.4 resolved). `MediaManager` draws one Upload button per group ("Shown to homeowner", "Internal only") and exposes no single trigger. Upload stays in each group. The tiles and document rows of L31 belong to the same shared component. Both are a follow-up.
6. **The visit half of the pill shows the date only.** `getFullView` carries `meetingScheduledFor` but not the meeting type. Adding the type once the profile loads would widen the pill after first paint. The type is on the meeting card in the panel.
7. **The customer card has no Header part.** The panel's Customer pane starts with the customer's name as a plain heading line, then the card parts.
8. **The proposal name maps to no part.** It is edited in the overview (L11), so its dirty or error state lights no rail dot. A missing name shows its message under the input in the overview.
9. **The create page keeps the name field.** `GeneralFields` takes `withName` (default `false`). The create page passes `true`, because it has no overview (§10.1).

