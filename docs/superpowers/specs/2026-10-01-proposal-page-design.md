# Proposal page redesign: the Journey + the agent cockpit

> **Status:** written 2026-10-01 from a `/ui-exploration` run (rounds 1–5, studies artifact https://claude.ai/artifact/LoR7Mjz2xZ8Wb7fR6soKGA, version 6). **Approved by the owner on 2026-10-01** with the amendments to C1 and C2 folded in (D22–D24, R7, F6–F8). Nothing built.
> **Relates to:** the multi-proposal epic `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md`. Spec A owns `sent_message` and the send verb (§4.3). Spec F and #285 own the homeowner projection (H10) and the token resolver (H11). Spec G and C46 own "Let's build!" on the same document surface. The single-pricing-mode follow-up (`docs/plans/2026-09-26-proposal-single-pricing-mode-follow-up.md`, R2) owns `show_section_prices`. W4 (`docs/superpowers/specs/2026-09-24-wave-4-sow-normalization-design.md`) owns SOW normalization.

## 1. Goal

The proposal page is "our main customer-facing artifact that's meant to make the homeowner feel special". It must be easy to follow and understand, and it should walk the homeowner through a transformation. It must be mobile-first and still look crisp on tablet and laptop, because agents present it live in the home. The same page must let the agent act on the proposal, its agreement, its customer and its meeting without leaving it, and internal numbers must never leak.

## 2. Decisions already made

| # | Decision | Round |
|---|---|---|
| D1 | Direction is **the Journey**: one long scroll document, with a chapter rail on wide screens and short chapter tabs on narrow ones. | R1 |
| D2 | Keep today's section order: Overview → Trusted contractor → Past results → Scope of work → Funding → Next steps. Money comes at the end. | R1 |
| D3 | Palette is **navy + cyan**, as in the meeting's Who We Are presentation. Light marketing ground; the hero and Next steps sit on navy. | R1–R2 |
| D4 | The top section shows customer context: name, address, phone, email, and the consultant. | R1 |
| D5 | Trust is shown by **the meeting's comparison table** (Tri Pros vs other contractors), not generic trust badges. On phones the table stacks into cards. | R1 |
| D6 | "What you told us" is dropped, because the data usually doesn't exist at meeting time. | R1 |
| D7 | Agent tools live in a **cockpit**: a `ResponsiveSheet` (right sheet at ≥1024px, bottom drawer below) that dims the document. It never shifts the layout. | R2–R3 |
| D8 | Cockpit card order is **Proposal → Agreement → Customer → Meeting**. The cards are the existing entity overview cards, generalized rather than rebuilt (§4.4). | R2 |
| D9 | One-tap actions: send/resend and copy link, customer contact (call, text, email), deal controls. Meeting controls go in overflow menus. | R1 |
| D10 | **View internal financials** is a new proposal entity action shown only in the cockpit, behind a click. It is never on the document. | R2 |
| D11 | The homeowner may see that the agent has extra tools (the cockpit button). They may never see internal numbers. | R1 |
| D12 | The send composer can **resend with a new note**. The note is stored (`sent_message`, spec A). | R2 |
| D13 | The Agreement card follows the registry. `initial-sale` is signed by the contractor and the homeowner; `additional-work` by the homeowner only. Senior (age ≥ 65) swaps in the senior documents. | R3 |
| D14 | Envelope documents use **switches**. Required documents are on and disabled, as today. Rows are tight, with no gap between them. | R3, R5 |
| D15 | Mobile chapter labels are one or two short words: Overview, Contractor, Results, Scope, Funding, Next steps. | R3 |
| D16 | The closing chapter is titled **"Next steps"** (it assumes the close), not "Ready when you are". | R3 |
| D17 | Cockpit motion matches `ResponsiveSheet`: it slides in over 500ms and out over 300ms, ease-in-out, with a fading scrim. | R3 |
| D18 | Scope of work uses the **spec sheet**. Each part shows key details and exclusions, then numbered phases with step counts, with every step in a drawer. The structured scope data behind it is a follow-up (§9, F1). | R4–R5 |
| D19 | Pricing reads **per part**: list price, then that part's own incentives, then "Your price for this part". After all the parts come the subtotal, a block titled "Applies to the whole project" (global discounts and exclusive offers), the final contract price and the deposit. Nothing reads as "new price minus incentive". | R5 |
| D20 | Cash down is a **slider**, for the feeling of control. | R5 |
| D21 | The cockpit has no visible scrollbar. It scrolls, but the bar is hidden. | R5 |
| D22 | **Payment plan** has four modes: **All cash**, **Some cash** (cash down plus finance), **All finance**, and **Scheduled payments**. These are the same options the Zoho contract uses. The codebase is the source of truth and the scheduled payments structure is flexible; Zoho's fields are changed to match in a follow-up (F6). | Spec gate |
| D23 | **Financing minimum: $3,500.** Whenever a mode finances (Some cash, All finance), the financed amount is at least $3,500, so in Some cash the slider's maximum is `finalTcp − 3,500`. When `finalTcp` is under $3,500 + $500, only All cash and Scheduled payments are offered. | Spec gate |
| D24 | **The homeowner's choices are saved, debounced**: the payment mode, the cash-down amount and the finance option, through the existing token-path (shareable) writes. The agent sees them in the cockpit. | Spec gate |

## 3. Content

Each beat names its source. Company facts come only from `src/shared/constants/company/` or an existing typed constant.

**Chrome.** A navy top bar shows the logo (`companyInfo`), "{proposal label} · {customer name}", and the **Cockpit** button (agent only, §4.3). On wide screens a sticky chapter rail lists the six chapters, numbered, with the active one marked. On narrow screens a sticky row of short-label tabs (D15) does the same.

**1 · Overview (navy hero, then a context card).**
- Eyebrow: "Your proposal · {label}".
- H1: "{first name}, here's the plan for your {project}". The project noun comes from `projectJSON.data.label`. With no label it falls back to "your home".
- Meta row: "{n} parts", "{timeAllocated} on site", "Prepared by {companyInfo.name}".
- Hero photo: the first homeowner-visible proposal media item, else the cover image of the first SOW trade.
- **Prepared for** card: customer name, address, phone and email from `getFullView.customer`. On the token path these are shown as stored. They are the homeowner's own details.
- **Your consultant**: name, headshot and direct line. These need the owner profile on the read (R3).
- **What's in this proposal**: one row per SOW section, with its title and trade. Each row links to that part in Scope.

**2 · Trusted contractor.**
- The comparison table renders from the same data as the meeting: `WHO_WE_ARE_SLIDES` comparison rows and `COMPARISON_COLUMNS` (`src/features/meeting-flow/constants/who-we-are-slides.ts`).
- Credentials: license, insurance and reviews from `companyInfo`, `insurances` and `reviews`. The license and COI scans move behind a "View documents" disclosure. Today they cost about 2,500px of phone scroll.
- Excluded: `TRADE_OUTCOMES` (its % claims have no source), the `testimonials` and `awards` constants (template filler), and anything about solar.

**3 · Past results.**
- Two or three portfolio projects matched by trade, each shown as a before/after card with its name and a one-line summary.
- The source is the public portfolio read (`landing.projects.getProjects` → `getPublicProjects`), filtered by the proposal's trades (R6).
- This replaces the hardcoded seed array (`src/shared/db/seeds/data/projects.ts`) that `related-projects.tsx` maps today.
- With no match, the chapter shows the best general projects. It never shows an empty state to the homeowner.

**4 · Scope of work (spec sheet).** For each SOW section, a numbered spec card shows:
- the title, trade and section price (only when section prices are shown, R2 of the single-pricing-mode follow-up);
- the description;
- **Key details** (key:value pairs);
- **Not included** (exclusions);
- **Phases** as a numbered list with step counts, each opening a drawer with its steps;
- a "We've done this before" chip that links to the matching Past results project.

Until F1 lands, details, exclusions and phases are parsed from the section HTML at the edge (§4.6).

**5 · Funding.**
- **Price breakdown** card, laid out as in D19. Its source is `buildPricingBreakdown` (`src/shared/modules/proposals/core/lib/financials/compute-breakdown.ts`), whose `sections[]` already carry `price`, `incentives[]` and `netPrice`.
- When section prices are hidden, the parts block lists each part's incentives under its title with no part prices, and the subtotal is the first priced line.
- Each line with an expiry gets an expiry badge, "Offer ends {date}".
- **Pricing held through {date} ({n} days)**, from `validThroughTimeframe`.
- **How you'd like to pay** card:
  - a four-way **payment plan** control (D22), a radio group: All cash · Some cash · All finance · Scheduled payments;
  - **All cash:** the final price, the deposit at signing, and the balance on completion. No finance options.
  - **Some cash:** a cash-down slider showing the amount in display type, with $0 and the maximum (`finalTcp − 3,500`, D23) under it; "{amount} to finance after {cash} down."; the finance options with monthly payments.
  - **All finance:** the cash down is fixed at $0; "{finalTcp} to finance"; the finance options.
  - **Scheduled payments:** the schedule as an ordered list (label, amount, when it's due), with the deposit first and amounts summing to `finalTcp`. Homeowners read it; agents edit it from the Proposal card (R7).
  - Finance options come from `finance_options`, with the monthly payment from `getLoanValues`.
  - Under any financing mode: "Estimates, subject to lender approval. Financing starts at $3,500."

**6 · Next steps (navy).**
- H2 "Next steps".
- The agreement timeline in homeowner wording: Proposal reviewed → Agreement sent → Signed → Project kickoff. Its source is `derive-timeline-state` plus the contract status.
- The homeowner's primary action stays today's `requestToMoveForward`.
- The age form shows only when age is missing, as today.
- **A note from {companyInfo.name}**: `sentMessage` once spec A ships (as spec A §4.3 describes).

**Cockpit (agent only).**
- **Proposal card:**
  - Header: status, label, value, view count and sent date.
  - Toolbar: Send/Resend (primary), Copy link, and Edit. Overflow holds Duplicate, **View internal financials** (marked new), Share by SMS and Share by email.
  - The **send composer** (textarea, then "Send" or "Resend with note") shows the last note sent and when.
- **Agreement card:** the timeline, the signers (the contractor only on `initial-sale`), customer age, and envelope switches (D13, D14). Footer: Create draft, Submit, Recall and Resend, matching today's `envelope-card` mutations.
- **Customer card:**
  - Contact rows with call, text, email and copy.
  - Lead source.
  - Insight chips: `timeInHome`, `yearBuilt`, `outcomePriority`, `decisionTimeline`. Never `creditScore`, age, `householdType` or `sellPlan`.
  - The latest notes, and an inline note composer (QuickNoteInput).
  - Overflow: View profile, Edit, and Schedule meeting.
- **Meeting card:** scheduled date, type and an editable outcome. Overflow holds Start, View in schedule, Set outcome, Confirmation, Reschedule, Create proposal and Manage participants.

## 4. Architecture

### 4.1 The document takes its proposal from context (the F15 seam)

`<Proposal/>`, `Heading` and every chapter stop reading `useParams().proposalId` and `?token` through `useCurrentProposal`. A `ProposalDocumentProvider` holds `{ proposal, viewer: 'homeowner' | 'agent' }`, and the chapters read from it.
- The route host (`proposal-flow/proposal/[proposalId]/page.tsx`) feeds it from `getFullView`, as today.
- Spec F's meeting page and spec G's Let's build! tab feed it from their own resolvers.

This is the prerequisite seam epic item F15 names. Doing it here means the redesign is built once and those specs reuse it.

### 4.2 Layout

- **Scroll root:** unchanged. Content scrolls inside `#proposal-container` through `ScrollRootProvider`. The chapter rail and tabs are sticky inside it, and `useActiveSection` drives the active chapter, as the navbar does today.
- **Wide** (container ≥ 1100px, Tailwind v4 `@container` with `@min-[1100px]:`): a two-column grid with a sticky chapter rail (`position: sticky; align-self: start`, no height) and the document.
  - iPad landscape (1180) gets the rail; iPad portrait (820) gets tabs.
  - A container query is used rather than a viewport breakpoint because the shell can be narrower than the viewport.
- **Narrow** (< 1100px): a sticky tab row under the top bar with short labels and horizontal scroll, with no cut-off text at 360px.
- **Chapter width:** the document column is capped at 1240px. Each chapter is full-bleed (the hero and Next steps are navy) with an inner max width.
- **Breakpoints inside chapters:**
  - 700px: the overview card goes to two columns, and the Funding cards go side by side at 1100px.
  - Below 700px: the comparison table stacks into cards.
- **The page replaces** today's navbar step links and mobile `<Select>` (`ui/components/navbar/navbar.tsx`). `ProposalPageNavbar` keeps the kebab menu (View as PDF, the view toggle).

### 4.3 Viewer and gating

- `viewer` is `'agent'` only when `useViewMode()` returns `'agent'`, meaning `?view=agent` **and** `can('update','Proposal')`.
- Everything agent-only renders only when `viewer === 'agent'`: the cockpit button, the cockpit, View internal financials, the send composer and the scheduled-payments editor.
- **The homeowner gating gaps close here:**
  - `CopySowButton` becomes agent only and moves into the Proposal card's overflow.
  - The homeowner's **payment mode, cash down and finance pick stay writable and are saved, debounced** (D24). This is a deliberate token-path write, not a gap. The writes stay limited to these fields once #285 adds field-level gating on the update path.
- **Ability vs view mode:** these controls are gated by `can()`. The view mode decides only whether agent chrome is shown, so an agent can preview the homeowner view.

### 4.4 Cockpit and entity cards (generalize, don't rebuild)

**The sheet.**
- `ResponsiveSheet` (`src/shared/components/dialogs/sheets/responsive-sheet.tsx`), with `title="Cockpit"` and the description "{customer} · {label}".
- It is always mounted and toggled by `open`.
- Per `reference-modal-sheet-body-writes`, frequent sheets should avoid remount cost. The plan measures open cost and keeps the default if it is under 100ms.
- Body: a vertical stack of the four cards with `scrollbar-width: none` and `::-webkit-scrollbar { display: none }` (D21).

**New shared primitive `EntityCard`**, in `src/shared/components/entities/entity-card/`. Today each overview card repeats its own Header and Body as plain divs, and none has a Footer.
- Parts: `Root`, `Header` (icon tile, eyebrow, title, subtitle, actions slot), `Body`, `Section` (label plus content), `Footer`.
- No data, no context, only layout and tokens.
- Each overview card's existing `Header` and `Body` compose these parts, so callsites are unchanged.

**Changes to each card:**
- **`ProposalOverviewCard`:** `Actions` accepts `mode: 'toolbar'`. `EntityActionMenu` already supports it; only the card's prop type restricts it. It also gets a `Footer` part.
- **`CustomerOverviewCard`:** gains `Header`, `Footer` and `Actions`. `Actions` runs `useCustomerActionConfigs` and renders its `DeleteConfirmDialog` at the root. A `Notes` part shows the latest notes and `QuickNoteInput`.
- **`MeetingOverviewCard`:** `Actions` accepts `'toolbar'`.
- **Click handling:** the Proposal and Meeting roots handle clicks (navigate, or open the profile modal). Composer and footer areas stop propagation, using the same pattern the meeting root uses to ignore portaled descendants.
- **The Agreement card:** `EntityCard` around the existing contract-status-panel pieces (`agreement-timeline`, `envelope-signer-grid`, `envelope-configuration-section`, the `envelope-card` mutations). The panel's logic is not forked.

**New proposal action `internalFinancials`.**
- Defined in `PROPOSAL_ACTIONS`: `CalculatorIcon`, `permission: ['update','Proposal']`.
- `useProposalActionConfigs` takes an `onInternalFinancials` override. The cockpit passes a handler that opens the existing `InternalFinancialsModal` through `useModalStore`, as `heading.tsx:43-57` does today.
- Any screen holding the funding data can pass the same override. The action hides when no handler is passed.

### 4.5 Funding components

- **`PricingBreakdown`** (`ui/components/pricing-breakdown.tsx`) is rewritten to the D19 structure:
  - one block per section (title, list price, incentive rows with a gift icon and a negative amount, "Your price for this part" only when the part has incentives);
  - then the subtotal, the "Applies to the whole project" block (global lines with expiry badges, offers shown as "Included"), the final contract price and the deposit.
  - The strike-through `ExpandableLineItems` treatment goes.
  - The PDF (`pdf.service`) is out of scope (§9).
- **Payment plan control** (`payment-plan-group.tsx`): a radio group of the four modes (D22). Modes that would finance less than $3,500 are disabled with the reason as visible text (D23). The selection saves debounced (D24).
- **Cash down** (Some cash only) uses the shadcn `Slider` (`src/shared/components/ui/slider.tsx`):
  - range 0 to `finalTcp − MIN_FINANCED_AMOUNT` in steps of $500;
  - `aria-valuetext` gives the dollar amount;
  - the value is mirrored into the "to finance" line and the monthly payments as it moves;
  - the value saves through `setCashInDeal` **debounced 600ms after the last change** (D24), for homeowner and agent alike, with no Save button. A failed save shows a toast and keeps the local value.
- **`MIN_FINANCED_AMOUNT = 3500`** lives with the proposal financial constants (`src/shared/modules/proposals/core/constants/`), never inline.
- **Scheduled payments list** (`scheduled-payments.tsx`): read-only on the document. Agents edit it in a dialog opened from the Proposal card, adding, removing and reordering rows, and the rows must sum to `finalTcp`.
- **Finance options** form a radio group: `role="radiogroup"`, arrow-key navigation, the monthly payment in tabular numbers.

### 4.6 Scope spec sheet (interim parser, marked LAZY)

`lib/parse-sow-section.ts` turns `{ title, html, scopes, trade }` into `{ description, specs: [key, value][], exclusions: string[], phases: { title, items: string[] }[] }`:
- The description is found in any child element: `<h3>Description:` or `<em>Description:`.
- `<h2>` starts a phase, and `<li>` items are its steps.
- The "Agreement Notes" phase is split: key:value lines of up to 48 characters become specs; lines matching "not included / excluded / not responsible / unless" become exclusions. It is not shown as a phase.
- Whitespace-only nodes are skipped.
- When parsing yields nothing, the card falls back to today's sanitized HTML, so nothing is ever lost.

The file starts with `// LAZY: replaced by the structured scope view model (F1) sourced from the Notion construction catalog`. This is the round-4 mock's parser, which handled both description variants and the "0 steps" bug.

### 4.7 Motion and reduced motion

- **Cockpit:** `ResponsiveSheet`'s own transitions (D17).
- **Chapter change:** smooth scroll, or instant with `prefers-reduced-motion`.
- **Phase drawers:** height/opacity over 200ms, none with reduced motion.
- **Slider:** no animation beyond the thumb.
- Nothing starts at `opacity: 0` waiting on an observer.

### 4.8 Accessibility

- The chapter rail and tabs are a `<nav aria-label="Proposal chapters">` with `aria-current="true"` on the active link.
- Every chapter is a `<section aria-labelledby>`.
- Switches are the shadcn `Switch` (`role="switch"`). Disabled ones carry "required · {reason}" as visible text.
- Touch targets are at least 44px on phone.
- The cockpit's focus returns to the cockpit button (`ResponsiveSheet` handles this).
- The comparison table keeps `<th scope>` on wide screens. On phones each stacked card uses its row header as the card title.
- Text and controls on navy chapters use the cyan-on-navy token (`--presentation-accent`). Every pair must reach AA.

### 4.9 Tokens

The page sits in the marketing world (`.theme-marketing` in `src/app/(frontend)/globals.css`) and uses the existing brand tokens (`--brand-navy`, `--brand-navy-deep`, `--brand-cyan`, `--brand-blue`, `--presentation-accent`). The plan maps each colour in the mock (navy, navy-2, cyan, cyan-ink, action, ok, warn) to an existing token. Any new token is a stop-and-ask, per `feedback-no-mechanical-surface-sweeps`. Dark scheme follows `.theme-marketing.theme-dark`.

## 5. Data access

This section is the single hand-off for backend work. Build tasks that depend on an item wait until it lands.

**Reads used as-is**
- `proposalsRouter.business.getFullView`: proposal, customer, incentives, homeowner media.
- `proposalsRouter.business.getFinanceOptions`.
- `contracts.evaluateEnvelopeContext` and `contracts.getContractStatus`.
- `landing.projects.getProjects` (Past results, filtered at the edge until R6).
- Agent only: the customer profile read behind `CustomerProfileData` (`cross.customerProfile`, as used by the profile modal); `meetings.getByIdWithJoins`; customer notes through `customerNotesRouter`.

**Writes used as-is**
- `proposalsRouter.funding.setCashInDeal` (homeowner and agent, debounced, D24).
- `proposalsRouter.crud.update` `{ financeOptionId }` (homeowner and agent, debounced, D24).
- `proposalsRouter.delivery.sendProposalEmail` with `message`, until spec A's `send` replaces it.
- `contracts.applyEnvelopeContext`, `createContractDraft`, `submitContract`, `recallContract`, `discardDraftContract`, `resendContract`.
- `customerNotesRouter.crud.create`.
- The existing meeting actions (outcome, reschedule, confirmation).

**Required changes the user runs first**

| # | Change | Why | Owner / blocks |
|---|---|---|---|
| R1 | **Homeowner projection on the token path.** `getFullView` selects every `proposals` column, so token holders receive `sow[].financials.costLines` (job cost, margin), `cashInDealCents`, `miscPriceCents`, incentive `notes`, QB refs and `customers.age`. | T1/H10. Internal numbers must never leak (D11). Hiding them in the UI is not enough. | #285 / spec F (H10). **Blocks prod release of this page**, not the build. |
| R2 | `proposals.sent_message` and `proposalService.send` (stores the note, first send stamps `sentAt`, resend replaces the message). | The "resend with a new note" composer and the "A note from…" beat (D12). | Spec A task A5. The composer ships on `sendProposalEmail` first and switches when A5 lands. Only the stored-note display waits. |
| R3 | Join the **owner profile** into the read: `user.name`, `headshotUrl`, `phone`, `yearsOfExperience` through `proposals.ownerId`. These are homeowner-safe fields. | The "Your consultant" beat. | New. Small DAL change in `core/dal/server/queries.ts`, added to the projection's allow list. |
| R4 | Return `gatedPhoneSql` instead of the raw `customers.phone` on the **session** path of `getFullView`. | Breaks the rule at `customers/lib/phone-gating-sql.ts:7-15`. | New. One-line DAL fix. |
| R5 | Join `meetings.scheduledFor` (and `meetingType` for the agent) through `proposals.meetingId`. | The overview's "Visited {date}" and the Meeting card header. | New. Homeowner-safe: the date only, never outcome or participants (H10). |
| R7 | **Payment plan on the proposal**: a mode (`all-cash · some-cash · all-finance · scheduled`) and a flexible ordered list of scheduled payments (label, amount, due description). Column versus child table is settled under ADR 0005 at plan time with the owner. Writable on the token path for the mode only (D24), and by agents for the schedule. `MIN_FINANCED_AMOUNT` is enforced server-side in the write, not only in the UI. | D22–D24. Nothing like it exists today: Zoho only receives `deposit` (`registry.ts:26`), and `dealStructure` (the meeting scratchpad) is being retired by spec E. | New. **Blocks the payment-plan UI tasks.** The rest of Funding (breakdown, slider, finance options) builds without it. |
| R6 | A public portfolio read **filtered by trade** (or scope), with each project's hero before/after media. | Past results matched to this proposal (#64), replacing the hardcoded seed. | New. Extends `getPublicProjects`. Until it lands, the edge filters the full public list. |

**UI adaptations at the edge** (no backend change)
- The SOW parser (§4.6, LAZY).
- Customer insight chips use only the allow-listed fields (§3).
- `ProposalEntity` for actions widens to carry the funding inputs the internal-financials handler needs, or the cockpit passes them through the override closure. The plan picks the override closure.

## 6. Error handling and edge cases

- **No incentives:** the per-part rows show only the list price, and the whole-project block is omitted.
- **Total-mode proposals** (section prices hidden): the parts show incentives without prices. The subtotal is the first priced line.
- **Zero or one SOW section:** the overview list and the spec sheet render one part. With zero sections, the Scope chapter shows "Scope being finalized". This can't reach a homeowner once spec A's readiness gate is live.
- **Unparseable SOW HTML:** the sanitized-HTML fallback (§4.6).
- **Missing customer email or phone:** that row is omitted. The cockpit's contact button is disabled with a tooltip.
- **Missing owner profile (R3 not landed):** the consultant row shows `companyInfo.name` and the main line from `companyInfo`.
- **Customer age missing:** the Agreement card shows the age input and lists no documents, as `evaluateEnvelopeContext` returns `docs: []`. The homeowner sees today's age form.
- **Envelope active or completed:** the switches are locked with a reason, as today (`locked`).
- **Finance options empty:** the pay card shows the cash line only.
- **Cash down above the final price:** clamped by the slider's maximum (`finalTcp − 3,500`).
- **Final price under $4,000:** the financing modes are disabled with "Financing starts at $3,500" (D23).
- **Price changes after a saved choice** (the agent edits the proposal): if the stored cash down would leave less than $3,500 financed, it is clamped down on the next render and saved. If the schedule no longer sums to `finalTcp`, the document shows "Schedule being updated" to the homeowner and a warning in the cockpit.
- **Debounced saves racing:** only the last value is sent, and a pending save flushes when the page hides (`visibilitychange`).
- **`recordView`:** the agent's own open with `?view=agent` must not count as a view. Today an agent with a token records one, and without a token gets a forbidden error. The plan skips the call when `viewer === 'agent'`.
- **Offline or a failed mutation:** a toast with the error. The local slider value is kept.

## 7. Verification

Playwright scripts in the session scratchpad drive the real page with the dev session URL (`/api/dev/playwright-session`) and abort `recordView`. No database writes.

| Check | Viewports | Schemes |
|---|---|---|
| Chapter rail sticks and tracks the active chapter; tabs show all six short labels uncut | 1440, 1180 (iPad landscape), 820 (iPad portrait), 390, 360 | light, dark |
| Cockpit opens as a right sheet at 1180 and as a bottom drawer at 820 and 390; the document doesn't shift; no visible scrollbar; focus returns | 1180, 820, 390 | light, dark |
| Agreement card: `initial-sale` shows two signers, `additional-work` one; required switches are disabled; age ≥ 65 swaps in the senior documents | 1180 | light |
| Homeowner view (no `?view=agent`): no cockpit button, no copy-SOW, no scheduled-payments editor, no internal-financials anywhere in the DOM | 390, 1180 | light |
| Pricing: per-part list price, incentives and net; whole-project block; final price matches `buildPricingBreakdown.finalTcp`; total-mode proposal renders without part prices | 1440, 390 | light, dark |
| Slider updates the amount to finance and every monthly payment live; keyboard arrows step $500; the maximum leaves $3,500 financed; one debounced write per drag (network-intercepted, not sent to the DB) | 1180, 390 | light |
| Payment plan: each of the four modes renders its block; financing modes are disabled under $4,000; the selection persists across a reload (intercepted write, mocked response) | 1180, 390 | light |
| Spec sheet parses both description variants, shows no "0 steps" phase, and falls back to HTML on a malformed section | 1440, 390 | light |
| No horizontal page scroll at 360 | 360 | light, dark |

`pnpm tsc` and `pnpm lint` pass. Never `pnpm build`. Clear `.next` (after `ss -ltnp`) before judging rendered CSS. Before/after page height at 1440 and 390 is compared against the baseline: 9,932px and 16,055px.

## 8. Files

**Create**
- `src/shared/components/entities/entity-card/entity-card.tsx` (compound `Root`, `Header`, `Body`, `Section`, `Footer`), plus its `index.ts`
- `src/features/proposal-flow/contexts/proposal-document-context.tsx` (`ProposalDocumentProvider`, `useProposalDocument`)
- `src/features/proposal-flow/ui/components/proposal/chapter-nav.tsx` (rail and tabs)
- `src/features/proposal-flow/ui/components/proposal/overview-hero.tsx`
- `src/features/proposal-flow/ui/components/proposal/overview-context-card.tsx`
- `src/features/proposal-flow/ui/components/proposal/scope-spec-sheet.tsx`
- `src/features/proposal-flow/ui/components/proposal/scope-spec-card.tsx`
- `src/features/proposal-flow/ui/components/proposal/cash-down-slider.tsx`
- `src/features/proposal-flow/ui/components/proposal/finance-option-group.tsx`
- `src/features/proposal-flow/ui/components/proposal/payment-plan-group.tsx`
- `src/features/proposal-flow/ui/components/proposal/scheduled-payments.tsx`
- `src/features/proposal-flow/ui/components/cockpit/scheduled-payments-dialog.tsx` (after R7)
- `src/features/proposal-flow/ui/components/proposal/next-steps.tsx`
- `src/features/proposal-flow/ui/components/cockpit/cockpit.tsx`
- `src/features/proposal-flow/ui/components/cockpit/cockpit-proposal-card.tsx`
- `src/features/proposal-flow/ui/components/cockpit/cockpit-agreement-card.tsx`
- `src/features/proposal-flow/ui/components/cockpit/cockpit-customer-card.tsx`
- `src/features/proposal-flow/ui/components/cockpit/cockpit-meeting-card.tsx`
- `src/features/proposal-flow/ui/components/cockpit/send-composer.tsx`
- `src/features/proposal-flow/lib/parse-sow-section.ts` (LAZY)
- `src/features/proposal-flow/constants/proposal-chapters.ts` (short labels; or extend `proposal-steps.ts` with `shortLabel`, which the plan prefers)
- `src/shared/entities/customers/components/customer-notes-part.tsx`

**Modify**
- `src/features/proposal-flow/ui/components/proposal/index.tsx`: provider, chapters, cockpit, `recordView` skip for agents.
- The six chapter files: `project-overview.tsx`, `trusted-contractor.tsx`, `related-projects.tsx`, `scope-of-work.tsx`, `funding.tsx`, `heading.tsx`. They read from context and adopt the new layout.
- `src/features/proposal-flow/ui/components/pricing-breakdown.tsx`: D19.
- `src/features/proposal-flow/ui/components/navbar/navbar.tsx`: step links and mobile select give way to `chapter-nav`.
- `src/features/proposal-flow/hooks/use-current-proposal.ts`: becomes the route host's feeder only.
- `src/shared/modules/proposals/core/components/overview-card.tsx`: `EntityCard` parts, `'toolbar'` mode, `Footer`.
- `src/shared/entities/customers/components/overview-card.tsx`: `Header`, `Footer`, `Actions`, `Notes`.
- `src/shared/entities/meetings/components/overview-card.tsx`: `EntityCard` parts, `'toolbar'` mode.
- `src/shared/modules/proposals/core/constants/actions.ts` and `hooks/use-proposal-action-configs.ts`: `internalFinancials`.
- `src/shared/modules/proposals/core/dal/server/queries.ts`: R3, R4 and R5, once approved in §5.

**Delete**
- `src/features/proposal-flow/ui/components/proposal/send-proposal-link.tsx`: dead, no callsites.
- `src/features/proposal-flow/ui/components/proposal/copy-sow-button.tsx`: moves to a Proposal-card action.
- Today's agent buttons in `heading.tsx` (View profile, Edit, Internal financials), which move to the cockpit.

## 9. Out of scope and follow-ups

**Out of scope**
- The PDF (`pdf.service`) layout. The breakdown change applies only to the web page.
- The "Consolidate" funding tab.
- Spec F's meeting proposals page and switcher.
- Spec G's Let's build! tab. Both consume §4.1 and are not built here.
- The `show_section_prices` migration (single-pricing-mode follow-up R2). This page reads whichever field exists.

**Follow-ups**

| # | Follow-up | Trigger |
|---|---|---|
| **F1** | **Structured scope view model** (immediate follow-up, owner 2026-10-01). Split each SOW section's scope-of-work text into logical blocks (description, key details, exclusions, phases with steps), sourced from the Notion construction catalog, fetched and typed. The LAZY parser is then deleted. Coordinate with W4 (SOW normalization) and the construction-data standardization epic. | Starts right after this ships. Needs its own spec. |
| F2 | Before photos per SOW section (proposal media tagged by section) for a before/after pair on the spec card (the round-4 option D idea). | After F1 |
| F3 | Pain points on the overview (spec A P4: read from the sections). | After spec A |
| F4 | Phase durations and home areas per part, which would enable the timeline and home-map views (round-4 options B and C, parked). | Data model decision |
| **F6** | **Zoho contract fields follow the codebase**: change the Zoho templates' payment fields to match the payment plan model (D22, R7), and map them in `registry.ts`'s `fieldMappings` so the envelope is pre-filled from the proposal. | After R7 |
| **F7** | **Per-document configuration form**: when a document in the envelope has extra settings (its contract fields, e.g. the payment schedule), a form opens from its row in the Agreement card to manage those fields before the draft is created. This needs a registry-level declaration of each document's configurable fields. | After F6. Needs its own spec. |
| **F8** | **Remove the automatic email OTP** from app-generated Zoho Sign envelopes: the homeowner signer is set to `verify_recipient: true, verification_type: 'EMAIL'` at `src/shared/services/providers/zoho-sign/lib/documents/assemble-envelope.ts:205-206`. Owner: "unnecessary and annoying for customers". | Independent. Small. |
| F5 | A real-iPad touch check of the slider, sheet and drawer by the owner. | After build |

## 10. Choices worth your eye

- **C1 · Slider maximum → decided:** payment plan modes plus a $3,500 financing minimum (D22, D23).
- **C2 · Homeowner choices → decided:** saved, debounced (D24).
- **C3 · R1 timing.** The page can be built before the projection (#285/H10) lands, but must not go to prod without it. **Recommended:** release gate, not build gate.
- **C4 · `EntityCard` as a shared primitive** in `src/shared/components/entities/` rather than feature-local. Three entity cards already duplicate Header and Body, so it is promoted now rather than later.
- **C5 · New names** for sign-off, per R.5: `ProposalDocumentProvider`/`useProposalDocument`, `EntityCard`, `internalFinancials` (action id), "Cockpit" (the UI label you used), `parseSowSection`, `shortLabel`, `MIN_FINANCED_AMOUNT`, and for R7: "payment plan" (proposed domain term) with the modes `all-cash · some-cash · all-finance · scheduled`.
