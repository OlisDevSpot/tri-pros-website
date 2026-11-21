# Edit Proposal Page Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the dashboard edit proposal page (`/dashboard/proposals/[proposalId]`) as a static frame: the overview on top, holding the name, a customer + visit pill and today's toolbar; the four parts on the left; the active part in a Card that hugs its content and scrolls inside itself.

**Architecture:** `EditProposalView` keeps its data and mutations and hands rendering to a new `EditProposalShell` under `src/features/proposal-flow/ui/components/edit-page/`. Part navigation is one nuqs value (`?formTab`), shown three ways: rail at lg, strip at md, list on phone. Per-part summaries, unsaved dots and errors come from pure functions in `lib/form-parts.ts`. The create page keeps `ProposalForm` with today's tabs.

**Tech Stack:** Next.js 15.5, React 19, react-hook-form + zod, nuqs 2, motion, Radix (Collapsible, Tabs, Popover), vaul Drawer, Tailwind v4, shadcn Card. Tests: `node:test` run with `pnpm exec tsx --test`, as in `src/features/proposal-flow/lib/*.test.ts`.

**Spec:** `docs/superpowers/specs/2026-10-21-edit-proposal-layout-design.md` (approved 2026-10-21; read §11 too).
**Requirements ledger (binding):** `docs/plans/2026-10-21-edit-proposal-layout-requirements.md`. Every task names the L-IDs it serves. Read the ledger before each task. Never bring back a row of its Superseded table.

## Global Constraints

- The ledger wins over this plan and the spec. If a step would break an L-ID, stop and ask the owner (P1).
- No app code before the owner says build or execute (P2). Verification is `pnpm tsc` and `pnpm lint`, plus the Playwright pass in Task 8. **Never `pnpm build`**. No DB writes for testing, including the dev DB (P3).
- Commits only if the owner authorised them for this run; ask once at the start. Otherwise leave changes uncommitted and list the files at the end of each task.
  - When committing: stage by explicit path, never `git add -A`. Never use stash, checkout or reset. The pre-commit hook takes about 110 s, so batch the paths.
- Off limits: the DAL, `src/trpc/`, schema, seeds and entity services.
  - Shared components change only where a task says so and the owner said yes. This covers `overview-card.tsx` for customers and meetings, `collapsible.tsx`, the media manager and `entity-action-menu.tsx`.
- Copy: existing labels only. The new strings are "General info", "All parts", "Customer", "In-home visit", "Price" and "Section incentives" (spec §3).
- Spacing:
  - Gaps between surfaces use `gap-(--gutter)` (L6).
  - Card interiors use the shadcn Card's own rhythm (`py-6 gap-6`, `px-6` header and content), fields `gap-4`, label 8px above a 36px control (L7).
  - No ad-hoc margins.
- Colour tokens follow `docs/design-system/theme-conventions.md`:
  - rail row hover is `hover:bg-row-hover`; the active rail row is `bg-row-selected`;
  - segmented tracks are `bg-tab-track border-control-border` with the active item `bg-tab-active shadow-xs`;
  - the unsaved dot is `bg-status-attention-dot`; the error dot is `bg-status-danger-dot`.
- No `position: sticky` or `fixed` anywhere inside `<main>` on this page (L28). No entrance fades (dashboard rule: no fade anywhere).
- One component per file, named exports, no file-level constants in component files: constants go in `constants/`, pure functions in `lib/`. Comments say why, never what.
- Breakpoints: phone `< 768`, tablet `768–1023`, desktop `≥ 1024`. Layout switches with Tailwind `md:`/`lg:` classes, never with `useIsMobile`/`useIsBelowLg`, which read `false` on first paint and would flash the wrong layout. The hooks are used only for the Popover ⇄ Drawer choice, which renders after a click.
- Every browser check blocks writes first: `page.route('**/api/trpc/**', r => r.request().method() === 'POST' ? r.abort() : r.continue())`. A test can then never save, even when a submit turns out valid (P3).

## Review Focus

1. **Locked proposal.** The form is disabled: every input, including the overview name input, is disabled and Save is disabled. The rail, strip and list still switch parts, and the lock row shows. Tested in Task 3, Step 6.
2. **Phone deep link.** Opening `?formTab=funding` on a 390px phone shows the Funding Card, not the list. "All parts" clears the param and shows the list. Tested in Task 3, Step 6.
3. **Profile read refused** (`FORBIDDEN` or `NOT_FOUND` for an agent who is not on the visit). The pill still renders from `getFullView`, and the panel shows today's cockpit messages in place of the cards. Tested in Task 5, Step 6.
4. **Long names.** A 60-character proposal name and a 40-character customer name never push the overview wider than the viewport at 820 or 390: the pill truncates and the name input caps at its column. Tested in Task 8.
5. **A proposal with zero SOW sections.** The list holds only Agreement Notes and the add button, the summary reads "0 sections", and the Card hugs it. Tested in Task 1 (summary) and Task 8 (layout).

---

## File map

Paths are relative to `src/features/proposal-flow/` unless they start with `src/`.

| File | Task | Responsibility |
|---|---|---|
| `constants/form-parts.ts` (new) | 1 | Part ids, labels, icons, the field-path prefixes each part owns |
| `lib/form-parts.ts` + `lib/form-parts.test.ts` (new) | 1 | `partOfFieldPath`, `dirtyParts`, `firstErrorPart`, `summarizeParts` |
| `lib/format-project-type.ts` (new) | 1 | `general-remodeling` → `General Remodeling` (used by GeneralFields and the summary) |
| `lib/deep-merge-form-defaults.ts` (new) | 2 | Moved from `form/index.tsx:49-60` |
| `constants/proposal-toolbar.ts` (new) | 2 | `TOOLBAR_BUTTON_*` classes, moved from `form/index.tsx:36-38` |
| `hooks/use-form-part.ts` (new) | 2 | The `?formTab` value |
| `hooks/use-proposal-form-actions.ts` (new) | 2 | Save, Save & Preview, Internal financials, invalid → jump to part |
| `ui/components/edit-page/proposal-toolbar.tsx` (new) | 2 | Today's toolbar, moved unchanged |
| `ui/components/form/index.tsx` | 2, 3 | Uses the toolbar and hooks (2); create-only after Task 3 |
| `ui/components/form/general-fields.tsx` | 2 | `withName` prop; uses `formatProjectType` |
| `ui/components/edit-page/edit-proposal-shell.tsx` (new) | 3 | `<form>`, reset, frame rows |
| `ui/components/edit-page/edit-proposal-overview.tsx` (new) | 3, 5 | Overview row (name, pill slot, toolbar) |
| `ui/components/edit-page/proposal-name-input.tsx` (new) | 3 | Name input that shrinks to its text, plus the status chip |
| `ui/components/edit-page/edit-proposal-body.tsx` (new) | 3 | Nav + the four PartCards |
| `ui/components/edit-page/part-card.tsx`, `part-rail.tsx`, `part-strip.tsx`, `part-list.tsx` (new) | 3, 4 | Card shell and the three navs |
| `ui/views/edit-proposal-view.tsx` | 3 | Frame via the shell; motion, band and scroller removed |
| `ui/components/proposal-context-band.tsx` | 3 | **Delete** (P4) |
| `hooks/use-form-part-state.ts` (new) | 4 | Live summaries, dirty and error per part |
| `ui/components/edit-page/phone-summary-row.tsx` (new) | 4 | L24 row |
| `ui/components/edit-page/proposal-context-trigger.tsx`, `proposal-context-panel.tsx` (new) | 5 | Split pill and tabbed panel |
| `src/shared/entities/customers/components/overview-card.tsx`, `src/shared/entities/meetings/components/overview-card.tsx` | 5 | Optional `roles` prop on `Actions`, **only with the owner's yes** (spec §11.2) |
| `constants/proposal-context-actions.ts` (new) | 5 | Hidden ids and toolbar roles for the panel cards |
| `ui/components/form/project-fields.tsx` | 6 | Accordion CSS and Agreement Notes as the last item |
| `ui/components/form/agreement-notes-item.tsx` (new) | 6 | L30 item |
| `ui/components/form/sow-financials-fields.tsx` | 6 | Row enter and exit animations (spec §11.3) |
| `ui/components/form/funding-ledger.tsx` (new), `form/funding-fields.tsx` | 7 | L31 ledger |

---

### Task 1: Part model (pure)

**Serves:** L19, L20, L22, L23, spec §3 summaries, §6 error jump, §11.8.

**Files:**
- Create: `constants/form-parts.ts`
- Create: `lib/form-parts.ts`
- Create: `lib/format-project-type.ts`
- Test: `lib/form-parts.test.ts`

**Interfaces:**
- Produces, in `constants/form-parts.ts`:
  - `FORM_PART_IDS = ['general', 'sow', 'funding', 'files'] as const`
  - `type FormPartId`
  - `FORM_PARTS: readonly { id: FormPartId, label: string, icon: LucideIcon }[]`, in this order with these icons: General info (`InfoIcon`), Scope of Work (`LayersIcon`), Funding (`WalletIcon`), Files (`ImageIcon`).
  - `FORM_PART_FIELD_PREFIXES: Record<'general' | 'sow' | 'funding', readonly string[]>`:
    - general: `project.data.type`, `project.data.timeAllocated`, `project.data.validThroughTimeframe`
    - sow: `project.data.sow`, `project.data.agreementNotes`
    - funding: `funding`, `priceDisplayMode`
- Produces, in `lib/form-parts.ts`:
  - `partOfFieldPath(path: string): FormPartId | null`: a prefix match on whole segments, so `fundingX` never matches `funding`. `project.data.label` returns `null` (§11.8).
  - `dirtyParts(dirtyFields: unknown): Set<FormPartId>`: walks RHF `dirtyFields`, where a leaf is `true`.
  - `firstErrorPart(errors: unknown): FormPartId | null`: walks RHF `FieldErrors`, where a leaf is an object with a `message` or `type`. Returns the earliest part in `FORM_PART_IDS` order that has an error.
  - `summarizeParts(values: ProposalFormSchema, fileCount: number | undefined): Record<FormPartId, { rail: string, list: string }>`
- Produces, in `lib/format-project-type.ts`: `formatProjectType(type: string): string`.

- [ ] **Step 1: Write the failing tests** in `lib/form-parts.test.ts`, in the header style of `lib/derive-next-steps.test.ts` (`node:assert/strict`, `node:test`, and the eslint-disable line). Build values from `baseDefaultValues` (`@/features/proposal-flow/schemas/form-schema`).
  - `partOfFieldPath`:
    - `'project.data.sow.2.financials.incentives.0.amount'` → `'sow'`
    - `'funding.depositAmount'` → `'funding'`
    - `'priceDisplayMode'` → `'funding'`
    - `'project.data.timeAllocated'` → `'general'`
    - `'project.data.label'` → `null`
    - `'fundingX'` → `null`
  - `dirtyParts({ project: { data: { label: true, sow: [undefined, { title: true }] } }, funding: { depositAmount: false } })` → `new Set(['sow'])`.
  - `firstErrorPart({ funding: { depositAmount: { type: 'custom', message: 'x' } }, project: { data: { sow: [{ financials: { sectionPrice: { type: 'custom', message: 'y' } } }] } } })` → `'sow'`. Also `firstErrorPart({})` → `null`.
  - `summarizeParts`, with values `type: 'general-remodeling'`, `timeAllocated: '4-6 weeks'`, two SOW sections, `startingTcp: 50000`, a `discount` incentive of 1000 and a section incentive of 200, `fileCount: 3`:
    - `general` → `{ rail: '4-6 weeks', list: 'General Remodeling · 4-6 weeks' }`
    - `sow.rail` → `'2 sections'`
    - `funding.rail` → `'$48,800'` (use `formatAsDollars`, which is what the form uses)
    - `files.rail` → `'3 files'`
    - one section → `'1 section'`; zero sections → `'0 sections'`; `fileCount` 1 → `'1 file'`; `fileCount` undefined → `''`
    - For every part `list` equals `rail`, except General info.
- [ ] **Step 2: Run them and confirm they fail.**
  - Run: `pnpm exec tsx --test src/features/proposal-flow/lib/form-parts.test.ts`
  - Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the constants file and the two lib files.
  - `summarizeParts` gets the funding figure from `computeFinalTcp` (`@/shared/modules/proposals/core/lib/financials`). Never compute it twice.
  - `formatProjectType` is today's inline formatter from `form/general-fields.tsx:47`.
- [ ] **Step 4: Run the tests and confirm they pass.** Same command. Expected: all pass.
- [ ] **Step 5:** Check `pnpm tsc` and `pnpm lint` are clean on the new files. Commit if authorised: `feat(proposal-flow): part model for the edit page`.

---

### Task 2: Extract the toolbar and the form actions (no visual change)

**Serves:** L18, L13 (moved, not restyled), spec §6 error jump, §10.1 / §11.9.

**Files:**
- Create: `lib/deep-merge-form-defaults.ts`, `constants/proposal-toolbar.ts`, `hooks/use-form-part.ts`, `hooks/use-proposal-form-actions.ts`, `ui/components/edit-page/proposal-toolbar.tsx`
- Modify: `ui/components/form/index.tsx`, `ui/components/form/general-fields.tsx`

**Interfaces:**
- Consumes: `FORM_PART_IDS`, `FormPartId`, `FORM_PARTS`, `firstErrorPart` and `formatProjectType` (Task 1).
- Produces:
  - `deepMergeFormDefaults(base: ProposalFormSchema, override?: OverrideProposalValues): ProposalFormSchema`: the body of today's `deepMergeDefaults`, moved.
  - `useFormPart(): { part: FormPartId | null, activePart: FormPartId, setPart: (part: FormPartId | null) => void }`. It reads `useQueryState('formTab', parseAsStringLiteral(FORM_PART_IDS))` with **no default**. `activePart = part ?? 'general'` (Q1).
  - `interface ProposalFormActions { saveOnly: () => void, saveAndPreview: () => void, openInternalFinancials: () => void }`
  - `useProposalFormActions({ onSubmit, onSave }: { onSubmit: (data: ProposalFormSchema) => void, onSave?: (data: ProposalFormSchema) => void }): ProposalFormActions`
    - The handlers are today's `handleSaveOnly`, `handleSaveAndPreview`, `handleInternalFinancials` and `onInvalid` from `form/index.tsx:76-132`.
    - `onInvalid` keeps today's toast and console lines, then calls `setPart(part)` when `firstErrorPart(errors)` is not null.
  - `ProposalToolbar({ isLoading, viewHref, actions }: { isLoading: boolean, viewHref: string, actions: ProposalFormActions })`
    - Markup and classes are copied **character for character** from `form/index.tsx:156-269`.
    - It owns `settingsOpen` and the two save-popover states, and reads `priceDisplayMode` with `useWatch`.
    - The popovers' Save and Save & Preview call the actions after closing themselves, as today.
  - `GeneralFields({ withName = false }: { withName?: boolean })`: the `project.data.label` field renders only when `withName` is true.

- [ ] **Step 1:** Move the code into the new files.
- [ ] **Step 2:** Make `form/index.tsx` use the new pieces:
  - `ProposalToolbar` for the edit branch;
  - `useProposalFormActions` for both branches;
  - `useFormPart` in place of `useQueryState` plus the `activeTab` mirror;
  - `FORM_PARTS` for the tabs;
  - `deepMergeFormDefaults`;
  - `<GeneralFields withName />`.

  The tab label becomes "General info". Everything else renders as today.
- [ ] **Step 3: Check the toolbar diff.** Run `git diff -U0 src/features/proposal-flow/ui/components/form/index.tsx | grep '^-' | grep -o 'className="[^"]*"' | sort > /tmp/old.txt` and the same with `^+` on `proposal-toolbar.tsx`, then diff the two. Expected: identical class strings (L18).
- [ ] **Step 4:** Run `pnpm tsc && pnpm lint`. Expected: clean. Re-run the Task 1 tests.
- [ ] **Step 5: Smoke-check in the browser** at 1440×900 that both pages render as before. Use the Task 8 harness, or `/api/dev/playwright-session` if the MCP browser is free, and never print the secret.
  - Edit page: tabs, toolbar, Save popover.
  - Create page: `/dashboard/proposals/new?meetingId=<an existing dev meeting>`, opened but not saved.

  Also check that an invalid submit on the edit page switches to the tab holding the error. Block writes first (Global Constraints). Then, in breakdown mode, set a section price to 0 (the schema's `superRefine` rejects it) and click Save while on the Funding tab. Expected: the tab switches to Scope of Work.
- [ ] **Step 6:** Commit if authorised: `refactor(proposal-flow): move the edit toolbar and form actions out of the form shell`.

---

### Task 3: Edit shell: frame, overview row, part navigation, PartCard

**Serves:** L3, L6, L7, L8, L9, L11, L12, L13, L18, L19, L20, L21, L22, L23, P4; spec §4.1, §4.2, §4.4, §4.8, §4.9, §4.10, §4.11.

**Files:**
- Create in `ui/components/edit-page/`: `edit-proposal-shell.tsx`, `edit-proposal-overview.tsx`, `proposal-name-input.tsx`, `edit-proposal-body.tsx`, `part-card.tsx`, `part-rail.tsx`, `part-strip.tsx`, `part-list.tsx`
- Modify: `ui/views/edit-proposal-view.tsx`, `ui/components/form/index.tsx` (drop the edit-only props: `onSave`, `viewHref`, `proposalId`, `initialValues` and the toolbar branch)
- Delete: `ui/components/proposal-context-band.tsx`.
  - Keep `lib/customer-action-overrides.ts`; Task 5 uses it.
  - Keep the cockpit's use of the overrides file (`cockpit/cockpit.tsx` working-tree change).
  - `cockpit/customer-row.tsx` and `meeting-row.tsx` stay; the cockpit still renders them.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces:
  - `EditProposalShell(props: { proposalId: string, status: Proposal['status'], customer: { id: string, name: string } | null, meetingId: string | null, meetingScheduledFor: string | null, initialValues: OverrideProposalValues | undefined, isLoading: boolean, viewHref: string, lockNotice: ReactNode, onSubmit: (d: ProposalFormSchema) => void, onSave: (d: ProposalFormSchema) => void })`
    - It renders `<form id="proposal-form" className="flex h-full min-h-0 flex-col gap-(--gutter)">`, with the overview, then `lockNotice` when set, then the body.
    - It runs `form.reset(deepMergeFormDefaults(baseDefaultValues, initialValues))` when `initialValues` changes; that effect moves here from `ProposalForm`.
    - It calls `useProposalFormActions` and passes the result down.
  - `EditProposalOverview({ status, customer, meetingId, meetingScheduledFor, isLoading, viewHref, actions })`: `PageBar`-surface classes (`surface rounded-xl border px-3 py-2`), `shrink-0`.
    - lg: `grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3`, with name+chip | pill slot | toolbar (`justify-self-end`).
    - md: two rows: name+chip with the toolbar, then the pill slot.
    - Phone: the name, then the pill slot. No chip and no toolbar (L24).
    - In this task the pill slot renders nothing; Task 5 fills it.
  - `ProposalNameInput({ status }: { status: Proposal['status'] })`: the RHF `project.data.label` field, with its `FormMessage` under it.
    - Width: an `inline-grid` with the `Input` and an `aria-hidden` invisible `span` (same font, padding and border) holding `value || placeholder`, both at `[grid-area:1/1]`, so the input is exactly as wide as its text. Capped with `max-w-full min-w-0`. Do not use `field-sizing`.
    - The chip follows at `gap-1.5`. It is a `Badge variant="outline"` with `PROPOSAL_ROW_STYLES[status].textClass` (`src/shared/modules/proposals/core/constants/proposal-row-styles.ts`), showing the status text, as in `ProposalOverviewCard.StatusBadge`. It is hidden below md.
    - The input sits in the overview with no visible field chrome until hover or focus. Use `border-transparent bg-transparent hover:border-input focus-visible:border-ring`, `text-base font-semibold`, `h-9`.
  - `EditProposalBody({ proposalId }: { proposalId: string })`. One container, CSS only:
    - `flex min-h-0 flex-1 flex-col gap-(--gutter) lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)]`
    - `PartRail` is `hidden lg:block lg:self-start`. `PartStrip` is `hidden shrink-0 md:grid lg:hidden`.
    - With `part === null`, `PartList` renders `md:hidden`, and the card column is `hidden md:flex` and shows General info (Q1).
    - With a part set, there is no list, and the card column shows on every size.
    - The card column is `flex min-h-0 flex-1 flex-col` (it fills the lg grid row by stretch).
    - The body does **not** read form values. Summaries, dots and the price are read inside the nav and summary-row leaves (Task 4), so typing re-renders those leaves, not every field.
    - All four `PartCard`s are always mounted; inactive ones are `hidden`. Titles come from `FORM_PARTS`, except the SOW title, which is "Scope of Work" (spec §4.6).
    - Contents:
      - General: `<GeneralFields />`, with a `lg:grid-cols-3` row and one column on phone.
      - SOW: `<ProjectFields>`, with `contentClassName="flex flex-col"`.
      - Funding: `<FundingFields>`.
      - Files: `<ProposalMediaManager proposalId>`. Upload stays per group (§11.5).
  - `PartCard({ title, hidden, onBack, contentClassName, children })`:
    - shadcn `Card className="flex min-h-0 flex-[0_1_auto] flex-col"`, with `CardHeader` + `CardTitle`. `onBack` renders a `md:hidden` ghost `Button` with `ChevronLeftIcon` and "All parts" above the title. The body passes `onBack={() => setPart(null)}`.
    - `CardContent className={cn('min-h-0 overflow-y-auto overscroll-contain', contentClassName)}`.
    - Never `flex-1`: the Card hugs its content (L9).
  - `PartRail`, `PartStrip` and `PartList` each take `{ proposalId: string, active: FormPartId, onSelect: (part: FormPartId) => void }` (`PartList` has no `active`). Each builds its rows from `FORM_PARTS`. In Task 3 summaries are `''` and the dots are off; Task 4 fills them from `useFormPartState(proposalId)`, called inside each nav.
  - `PartRail`:
    - `nav aria-label="Proposal parts"` in a `surface rounded-xl border p-1` box.
    - Rows are buttons with `aria-current="page"` when active, `grid grid-cols-[16px_minmax(0,1fr)_auto] items-center gap-x-2 rounded-lg px-2.5 py-2`, `hover:bg-row-hover`, active `bg-row-selected`.
    - Each row holds the label (`text-sm font-medium`), the summary (`text-xs text-muted-foreground truncate`) and a 7px dot: attention when dirty, danger when error, error first.
  - `PartStrip`: the same nav as a `grid grid-cols-4` segmented track (`bg-tab-track border border-control-border rounded-lg p-0.5 gap-0.5`, active `bg-tab-active shadow-xs`), with no icons.
  - `PartList`: a `surface rounded-xl border` list of rows, each with icon, label, `list` summary, dot and `ChevronRightIcon`. It shows with `part === null`.
- `EditProposalView`:
  - Remove `motion`, `ProposalContextBand`, the `overflow-auto md:pr-4` wrapper and the `ProposalForm` import.
  - The root becomes `<Form {...form}><EditProposalShell …/></Form>` plus `DiscardConfirmDialog`.
  - The three lock `Alert`s move unchanged into one `lockNotice` node, a `shrink-0` fragment (§4.9).

- [ ] **Step 1:** Build the components and rewire `EditProposalView`. Delete `proposal-context-band.tsx`. Run `grep -rn "proposal-context-band\|ProposalContextBand" src` and expect nothing.
- [ ] **Step 2:** Strip `ProposalForm` back to create-only. `create-new-proposal-view.tsx` is unchanged and still type-checks.
- [ ] **Step 3:** Run `pnpm tsc && pnpm lint`. Expected: clean.
- [ ] **Step 4: Check the layout in the browser** (Task 8 harness, a dev proposal the owner names).
  - At 1440×900, 820×1180 and 390×844: `document.scrollingElement.scrollHeight <= innerHeight` and no horizontal overflow (L8).
  - On General info and Files, the Card's `getBoundingClientRect().bottom` is below the pane's bottom (L9).
- [ ] **Step 5: Check navigation.**
  - Clicking each rail row sets `?formTab` and shows its Card.
  - At 390, the page opens on the list. Tapping Funding opens its Card. "All parts" goes back.
- [ ] **Step 6: Check two Review Focus items.**
  - Item 1: on a locked dev proposal, if one exists (do not create one), inputs are `disabled`, the lock row shows and nav still switches parts.
  - Item 2: at 390, `?formTab=funding` opens straight on the Funding Card.
- [ ] **Step 7:** Commit if authorised: `feat(proposal-flow): edit page frame, overview row and part navigation`.

---

### Task 4: Live part state and the phone summary row

**Serves:** L12, L20, L21, L22, L23, L24; spec §4.4 (dots), §4.5, §6 (error state).

**Files:**
- Create: `hooks/use-form-part-state.ts`, `ui/components/edit-page/phone-summary-row.tsx`
- Modify: `edit-page/edit-proposal-body.tsx`, `edit-page/edit-proposal-shell.tsx`

**Interfaces:**
- Consumes: `summarizeParts`, `dirtyParts`, `firstErrorPart` (Task 1); the nav props (Task 3); `ProposalFormActions` (Task 2).
- Produces:
  - `useFormPartState(proposalId: string): Record<FormPartId, { summary: string, listSummary: string, dirty: boolean, error: boolean }>`
    - `useWatch({ control })` with no name gives the whole form, which feeds `summarizeParts`.
    - `fileCount` comes from `useQuery(trpc.proposalsRouter.media.list.queryOptions({ proposalId }))`, the same query key as the media manager, so it is one request.
    - `dirty` comes from `dirtyParts(formState.dirtyFields)`.
    - `error` is true only for the part `firstErrorPart(formState.errors)` names.
    - Read `formState` through `useFormState({ control })`.
  - `PhoneSummaryRow({ proposalId, status, isLoading, viewHref, actions }: { proposalId: string, status: Proposal['status'], isLoading: boolean, viewHref: string, actions: ProposalFormActions })`
    - Below md only (`md:hidden`), `shrink-0`, as the shell's last row, on `surface rounded-xl border px-3 py-2`. `<main>`'s `page-insets` already clears the dock, so there is no fixed positioning.
    - Left to right:
      - the status chip (the same Badge as `ProposalNameInput`);
      - "Price" (`text-xs text-muted-foreground`) over the final price (`text-sm font-semibold tabular-nums`), from `useFormPartState(proposalId).funding.summary` (one source);
      - `ml-auto`, then a `DropdownMenu` whose trigger is an icon `Button` with `MoreHorizontalIcon` and `aria-label="More"`. Its items:
        - "Preview" is `<a href={viewHref} target="_blank" rel="noopener noreferrer">`, as the toolbar's eye does today (it opens the review in a new tab).
        - "Internal financials" calls `actions.openInternalFinancials()`.
        - "Proposal settings" opens a `Popover` anchored to the row, holding today's General / Breakdown Pricing switch markup. Reuse the markup by extracting it from `ProposalToolbar` into `edit-page/pricing-mode-settings.tsx` (`PricingModeSettings()`), used by both.
      - the Save split: today's mobile save, the icon and chevron Popover with Save and Save & Preview, inside the `bg-tab-track` track.
- `PartRail`, `PartStrip` and `PartList` call `useFormPartState(proposalId)` themselves (the rail and strip use `summary`, the list uses `listSummary`). Nothing above them watches form values.

- [ ] **Step 1:** Implement the hook, `PricingModeSettings` and `PhoneSummaryRow`, and wire them in. Re-run the Task 2 Step 3 class diff: `ProposalToolbar`'s classes are still unchanged.
- [ ] **Step 2:** Run `pnpm tsc && pnpm lint`.
- [ ] **Step 3: Check state in the browser** (no saving).
  - Typing in Time Allocated updates the General rail summary and lights its dot.
  - Adding a SOW section shows "n sections" and lights the SOW dot.
  - There is no "Unsaved changes" text anywhere (`page.getByText(/unsaved/i)` has count 0, L23).
- [ ] **Step 4: Check the phone row.**
  - At 390, the summary row's and the overview's `getBoundingClientRect().top` are identical on the list, on Scope of Work and on Files (L24).
  - The ⋯ menu lists Preview, Internal financials and Proposal settings.
- [ ] **Step 5:** Commit if authorised: `feat(proposal-flow): part summaries, unsaved dots and the phone summary row`.

---

### Task 5: Customer and visit: split pill and tabbed panel

**Serves:** L1, L2, L10, L14, L15, L16, L17; spec §4.3, §4.11, §6; §11.1, §11.2, §11.6, §11.7.

**Files:**
- Create: `ui/components/edit-page/proposal-context-trigger.tsx`, `ui/components/edit-page/proposal-context-panel.tsx`, `constants/proposal-context-actions.ts`
- Modify: `edit-page/edit-proposal-overview.tsx` (fill the pill slot)
- Modify, **only after the owner's yes on §11.2**: `src/shared/entities/customers/components/overview-card.tsx`, `src/shared/entities/meetings/components/overview-card.tsx`

**Interfaces:**
- Produces:
  - In `constants/proposal-context-actions.ts`:
    - `PROPOSAL_CONTEXT_CUSTOMER_HIDDEN = ['delete'] as const`
    - `PROPOSAL_CONTEXT_MEETING_HIDDEN = ['delete'] as const`
    - `PROPOSAL_CONTEXT_CUSTOMER_ROLES = { primaryId: 'view', promotedIds: ['scheduleMeeting'] } as const`
    - `PROPOSAL_CONTEXT_MEETING_ROLES = { primaryId: 'view', promotedIds: ['reschedule'] } as const`
  - `ProposalContextTrigger({ customer, meetingId, meetingScheduledFor }: { customer: { id: string, name: string }, meetingId: string | null, meetingScheduledFor: string | null })`
    - It owns `open: boolean` and `tab: 'customer' | 'visit'`, and renders the panel.
    - Pill: `inline-flex h-9 max-w-full min-w-0 items-center overflow-hidden rounded-lg border border-control-border bg-control text-sm`.
    - Two halves:
      - Customer half: initials avatar + name (`font-semibold truncate`). Its name is `aria-label="Customer: <name>"`.
      - Visit half: `CalendarIcon` + `format(meetingScheduledFor, 'MMM d')` + `ChevronDownIcon`, which turns 180° when open. Its name is `aria-label="In-home visit: <date>"`. The halves are split by `border-l border-control-border`.
    - Each half is `hover:bg-control-hover` with `aria-haspopup="dialog"` and `aria-expanded`.
    - When `meetingId` is null, the visit half is absent.
    - At 390 the pill is `w-full`, and the customer half grows with `flex-1`.
  - `ProposalContextPanel({ customerId, meetingId, tab, onTabChange }: { customerId: string, meetingId: string | null, tab: 'customer' | 'visit', onTabChange: (t: 'customer' | 'visit') => void })`
    - It reads `customerPipelinesRouter.getCustomerProfile`.
      - While pending: a `Skeleton className="h-64 rounded-xl"`.
      - On error: the two messages from `cockpit/customer-row.tsx:29-33`, plus, for the non-access error only, a `Button variant="outline" size="sm"` "Retry" calling `refetch()` (spec §6).
    - It renders `MeetingActionsHost` > `CustomerActionsHost overrides={PROPOSAL_CUSTOMER_OVERRIDES}` > `Tabs`. The `TabsList` holds "Customer" and "In-home visit"; the latter only when `meetingId` is set.
    - A `div.grid` holds both `TabsContent` with `forceMount` and `className="[grid-area:1/1]"`. The inactive pane gets `invisible` and the `inert` attribute (L16).
    - Customer pane:
      1. `<p className="font-semibold">{customer.name}</p>` (§11.7)
      2. `<CustomerOverviewCard customer leadSource>`: **Actions first**, `mode="toolbar"`, `hide={PROPOSAL_CONTEXT_CUSTOMER_HIDDEN}`, plus `roles={PROPOSAL_CONTEXT_CUSTOMER_ROLES}` when §11.2 is approved
      3. `ContactActions`
      4. `LeadSource`
      5. `ProfileFields`

      Pass the lead source as the customer profile modal does: `grep -rn "CustomerOverviewCard" src --include=*.tsx` to find the caller that supplies `leadSource`, and copy its lookup.
    - Visit pane: `<MeetingOverviewCard meeting className="flex flex-col gap-3">` with `Header`, then **Actions** (as the customer's, with the meeting constants), then `Fields` (`scheduledDate: 'full'`, `type`, `outcome: 'badge'`), `Owner`, `Trades`, `Proposals`. **No `VisitMeter`** (L10).
    - Container:
      - md+: `Popover`, with `PopoverContent className="w-100 p-4" align="center"` anchored on the pill.
      - Phone: `Drawer` with `DrawerContent`, with a `DrawerTitle` "Customer" or "In-home visit" for a11y, `sr-only`.
      - Switch with `useIsMobile`.
    - The pill is wrapped in `PopoverAnchor`. The halves are plain buttons that set `tab` and `open`. A `lastHalfRef` remembers which one opened it.
    - Escape and outside click close it. `onCloseAutoFocus={e => { e.preventDefault(); lastHalfRef.current?.focus() }}` on both `PopoverContent` and `DrawerContent` returns focus to that half.
- The shell prefetches the profile on idle, as `cockpit.tsx:42-46` does (`useIdleReady` + `prefetchQuery`).

- [ ] **Step 1: Owner gate.** Ask the owner for a yes on spec §11.2: an optional `roles` prop on the two cards' `Actions`, mirroring `ProposalOverviewCard.Actions` (`src/shared/modules/proposals/core/components/overview-card.tsx:431-460`), with overflow labelled "More".
  - With the yes, add `roles?: Parameters<typeof withToolbarRoles>[1]` to both `Actions` and apply it after `hide`, exactly as the proposal card does. Then `grep -rn "OverviewCard.Actions" src` and confirm every existing caller compiles unchanged.
  - Without it, skip the shared edit and use `mode="toolbar"` with no roles. Record which in the ledger's Owner rulings.
- [ ] **Step 2:** Build the trigger, the panel and the constants; fill the overview's pill slot.
- [ ] **Step 3:** Run `pnpm tsc && pnpm lint`.
- [ ] **Step 4: Check the panel in the browser** at 1440 and 390.
  - Opening on each half selects its tab.
  - The panel's `getBoundingClientRect().height` is equal across a tab switch, in the popover and in the drawer (L16).
  - In each pane, the actions row's `top` is smaller than the first field's `top` (L17).
  - The ⋯/More menu opens below its trigger: menu `top` > trigger `bottom` (L17).
  - No element with `aria-label^="Visit messages"` (L10).
- [ ] **Step 5: Check the full composition.** The Customer pane shows phone, email, address, lead source and profile fields. The visit pane shows owner, trades and proposals (L2).
- [ ] **Step 6: Review Focus item 3.** Sign in as `&role=agent` on a proposal whose visit that agent is not on. If the page itself refuses the agent, record that the case is unreachable. Otherwise the pill renders, and the panel shows "This customer’s profile isn’t available to you."
- [ ] **Step 7:** Commit if authorised: `feat(proposal-flow): customer and visit pill with full overview cards`. If the shared cards changed, commit them separately: `feat(entities): roles on customer and meeting card actions`.

---

### Task 6: Scope of Work accordion

**Serves:** L25, L26, L27, L28, L29, L30; spec §4.6; §11.3, §11.4.

**Files:**
- Modify: `ui/components/form/project-fields.tsx`, `ui/components/form/sow-financials-fields.tsx`
- Create: `ui/components/form/agreement-notes-item.tsx`

**Interfaces:**
- Produces: `AgreementNotesItem()`. It owns its own `open` state (closed by default) and reads `project.data.agreementNotes` with `useWatch`.

**Target structure** (classes are exact; nothing else changes in the item's look, L25):

```
<div className="flex min-h-0 flex-[0_1_auto] flex-col gap-2">                         ← list (replaces the h3 block)
  <Collapsible className="flex min-h-0 flex-none flex-col overflow-hidden rounded-xl border border-border bg-card
                          data-[state=open]:flex-[0_1_auto] data-[state=open]:min-h-60
                          transition-[min-height] duration-200 ease-[ease] motion-reduce:transition-none">
    <CollapsibleTrigger asChild><div className="flex-none data-[state=open]:border-b">…SOWCollapsibleHeader…</div></CollapsibleTrigger>
    <AnimatedCollapsibleContent open={isOpen} className="flex min-h-0 flex-col">
      <div className="min-h-0 overflow-y-auto overscroll-contain">…SOWSection…</div>
    </AnimatedCollapsibleContent>
  </Collapsible>
  … one per section …
  <AgreementNotesItem />                                                                ← last item (L30)
  <Button size="icon" variant="outline" className="flex-none self-start">               ← add section, unchanged
</div>
```

- The item box *is* the Radix `Collapsible` root, so `data-state` drives the floor. The trigger carries its own `data-state`, which draws the header rule. The `min-height` transition mirrors `COLLAPSE_TRANSITION`, whose curve `cubic-bezier(.25,.1,.25,1)` is CSS `ease` (§11.4). Leave one comment there saying so; it is a trap if either value changes.
- The `h3` "Complete Scope of Work" is removed; the Card title says "Scope of Work" (Task 3).
- `AgreementNotesItem`: the same box classes, but **`flex-none` when open** and no `min-h-60`.
  - Header: "Agreement Notes" plus, while closed, a one-line `truncate text-muted-foreground` preview of the notes.
  - Body: today's Templates button and `Textarea` from `project-fields.tsx:152-179`, unchanged. Remove the old block.
- `sow-financials-fields.tsx`: wrap the cost-line map and the section-incentive map each in `<AnimatePresence initial={false}>`. Each row becomes a `motion.div` with `initial/animate/exit` from `COLLAPSE_HEIGHT_VARIANTS`, `transition={reduceMotion ? { duration: 0 } : COLLAPSE_TRANSITION}` (`useReducedMotion`) and `className="overflow-hidden"`. Keep the row's inner markup unchanged and put it in a child div, so padding does not fight the height animation. Section incentives stay after Section Price and Cost Lines (L29).

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `pnpm tsc && pnpm lint`.
- [ ] **Step 3: L27/L28 check in the browser** at 1440 and 820.
  - Open a long section and scroll its body to the bottom. The header's `top` equals the item's `top`.
  - `[...document.querySelectorAll('main *')].filter(e => /sticky|fixed/.test(getComputedStyle(e).position))` is empty, apart from the dock.
  - With two sections open, each body scrolls on its own.
- [ ] **Step 4: L26 check.** Click a section header and sample the item's height at about 100ms: it lies strictly between its closed and open heights. Do the same for adding a section incentive row.
- [ ] **Step 5: L29 check.** Add a section incentive of 200 without saving. The Funding rail summary and the phone row's Price both drop by $200.
- [ ] **Step 6: L30 check.** Agreement Notes is the last item and closed on load. Its header preview shows the first line of the notes and hides while open.
- [ ] **Step 7:** Commit if authorised: `feat(proposal-flow): SOW accordion scrolls inside each open section; agreement notes as the last item`.

---

### Task 7: Funding ledger

**Serves:** L7, L9, L26, L31; spec §4.7.

**Files:**
- Create: `ui/components/form/funding-ledger.tsx`
- Modify: `ui/components/form/funding-fields.tsx`

**Interfaces:**
- Produces: `FundingLedger({ pricingMode }: { pricingMode: PriceDisplayMode })`.
  - It renders a `dl` of rows (`flex items-center justify-between gap-4 min-h-11 border-t first:border-t-0 text-sm`; the final row `min-h-13 font-semibold`).
  - Rows, in order:
    - **Scope of Work**: `computeTotalSectionPrices(sow)`, breakdown mode only.
    - **Misc Pricing**: the `funding.miscPrice` input, breakdown mode only.
    - **Total Contract Price**: the `funding.startingTcp` input, disabled in breakdown mode, as today.
    - **Section incentives**: `− computeTotalSectionIncentives(sow)`.
    - **Incentives**: `− computeTotalDiscounts(funding)`.
    - **Final price**: `computeFinalTcp`.
  - All values come from `src/shared/modules/proposals/core/lib/financials`, formatted with `formatAsDollars`.
  - Input rows keep their `FormField`, with the label as the row's `dt`. Each input is right-aligned and `w-36`.
- `FundingFields`:
  - The three-column base grid (`funding-fields.tsx:96-165`) is replaced by `<FundingLedger>`, then the Deposit field unchanged (placeholder, description and cap rule).
  - Then the Incentives block: rows keep `IncentiveCollapsibleHeader` + `AnimatedCollapsibleContent`, with the fields unchanged.
  - The breakdown `useEffect` that syncs `startingTcp` stays exactly as it is.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** Run `pnpm tsc && pnpm lint`.
- [ ] **Step 3: Check the totals.** With the Task 1 fixture values typed in the browser (starting 50,000; a 1,000 discount; a 200 section incentive), the ledger reads Final price `$48,800`, equal to the rail summary. In breakdown mode, Total Contract Price is disabled and follows Σ section prices + misc.
- [ ] **Step 4: Check the Card.** The Funding Card hugs its content at 1440: its bottom sits above the pane's bottom (L9).
- [ ] **Step 5:** Commit if authorised: `feat(proposal-flow): funding ledger`.

---

### Task 8: Verification pass and ledger walk

**Serves:** every L-ID; P1, P3.

**Files:**
- Create a scratch harness outside the repo: `<scratchpad>/edit-proposal-verify.mjs`.
  - It loads the repo's playwright with `createRequire('<repo>/package.json')('playwright')`.
  - It signs in through `/api/dev/playwright-session?secret=…`, reading the secret from `.env.local`. Never print it, and redact `secret=` from any error.
  - It waits on a page element, not `networkidle`.
  - It blocks every tRPC POST before the first navigation (Global Constraints).

- [ ] **Step 1: Preflight.**
  - `ss -ltnp | grep -E ':300[0-9]'` finds the dev server's port. Do not start or kill the owner's server.
  - Ask the owner for a dev proposal id to use; a second one with zero SOW sections is useful if one exists. Never write to the DB to make one.
- [ ] **Step 2: Run the ledger checklist.** For each of 1440×900, 820×1180 and 390×844, in light and dark, save screenshots and assert each line of the ledger's Verification checklist, one assertion per line, plus:
  - Review Focus item 4: type a 60-character name into the overview input (no save). Then `document.documentElement.scrollWidth <= innerWidth` at 820 and 390, and the pill's right edge is ≤ the overview's right edge.
  - Review Focus item 5, on the zero-section proposal if the owner has one: "0 sections" in the rail, and the SOW Card hugs its content.
  - Re-run the Task 2 Step 3 toolbar class diff (L18).
- [ ] **Step 3: Walk the ledger.** Write a table into the ledger, under a new heading "Build check (date)", with columns L-ID | where it is built (file:line) | evidence (screenshot or assertion). Every L1–L31 row needs a line. Check the Superseded table: none of its earlier states is present.
- [ ] **Step 4: Check the docs for drift.** `grep -n "FORM_TABS\|formTab\|CustomerInfoHeader\|ProposalContextBand" src/features/proposal-flow/DOCS.md`. Report any drift to the owner with the line; do not rewrite the DOCS.md unasked.
- [ ] **Step 5:** Run `pnpm tsc && pnpm lint` one final time and the Task 1 tests. Show the owner the screenshots (both schemes, all three sizes) before calling it done.
- [ ] **Step 6:** Update the epic: `docs/plans/2026-10-20-proposal-editor-epic.md`, PE4 row → `[x] built <date>`. Update the memory `project-edit-proposal-layout.md` to "built; follow-ups: create page shell (§10.1), Files tiles/rows/Upload in header (§11.5)".
