# Proposal page redesign (the Journey + the agent cockpit): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the customer-facing proposal page (`/proposal-flow/proposal/[proposalId]`) as one long Journey document: six chapters with a chapter rail or tabs, a per-part price breakdown, a cash-down slider and payment plan, and a scope spec sheet. Agents get a dimming cockpit sheet of generalized entity cards, so internal numbers never appear on the document.

**Architecture:** `<Proposal/>` loads the proposal once and hands it to a `ProposalDocumentProvider`, which every chapter reads. This is the F15 seam spec F and spec G reuse later. A top bar and chapter nav replace the layout navbar. Agent tools move into a `Cockpit` built on the existing `ResponsiveSheet`, made of four cards. Those cards are the existing entity overview cards, framed by a new shared `OverviewCard` layout primitive, with their actions coming from the three action hosts (`ProposalActionsHost`, `MeetingActionsHost`, `CustomerActionsHost`) the cockpit mounts. Pure logic (SOW parsing, price parts, cash-down bounds, payment-mode availability) lives in `lib/` files checked by throwaway `node:test` files.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11, TanStack Query, Tailwind v4 (container queries), shadcn/ui (Radix Slider, Switch, Sheet; vaul Drawer), motion/react, nuqs, CASL, pnpm, `tsx`.

> **Tokens (2026-10-07):** brought onto the current app tokens: the elevation ladder, solid row/tone fills, `--on-media` on the navy stage, the Segmented & Tabs model, no faded text, no `theme-marketing`. Verify each class against `DESIGN.md` and `globals.css` before building.

> **Re-aligned 2026-10-15** to the action hosts, modal layers, permissions client path, frozen-proposal lock and owner rulings O1–O4 (stress test).

**Spec:** `docs/superpowers/specs/2026-10-01-proposal-page-design.md` (approved 2026-10-01, commit `1fc8b25a`). Studies artifact: https://claude.ai/artifact/LoR7Mjz2xZ8Wb7fR6soKGA (v6). **Out of this plan:**
- spec §5 R1–R7 (the owner runs them; see "Data access gates" below);
- the payment-plan persistence and scheduled-payments editor (after R7);
- follow-ups F1–F8.

## Global Constraints

- Verification per task: `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`. Heavy commands (tsc, lint, `theme:check`, a Playwright run) always go under `flock .superpowers/heavy.lock`. **Never `pnpm build`.**
- **The dev server is the owner's.** It runs on :3000 (Turbopack). Never start, stop or restart it, and never `rm -rf .next`. If a class seems missing from the rendered page, `curl` the served CSS for it and report what you find; don't clear caches.
- **No database writes for testing** (dev included). Browser checks intercept writes with `page.route` and answer them with a mocked response. They abort `**/*recordView*`.
- No unit runner in the repo. Pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-10-01-proposal-page/tests/` (git-ignored), run from the repo root with `pnpm exec tsx --test <file>` so the `@/` alias resolves. Never commit them.
- Work on `main`, where other sessions commit concurrently (shared tree).
  - Before editing a file, run `git status --short <file>`. If it shows changes you didn't make, stop and report; never overwrite another session's hunks.
  - Stage by explicit path. Never use `git add -A`, `git add .`, stash, checkout, restore or reset.
  - Before each commit, run `git diff --cached --name-status`. Anything staged that isn't yours belongs to another session: leave it staged and untouched.
  - New files are added with `git add -- <path>`; deletions use `git rm -- <path>`.
  - Commit with a pathspec, in a Bash call that **starts with** `git commit` (the Claude pre-commit hook then runs `tsc`, `lint` and `theme:check` on the working tree), with a 300000 ms timeout: `git commit -F - -- <every path this task touched> <<'EOF' … EOF`.
  - After the commit, `git show --stat HEAD` must list only this task's files. Never amend. If a commit is wrong, stop and report.
  - Messages take the shape `type(scope): subject` and end with the Co-Authored-By line the harness gives the session (shown below as `<Co-Authored-By line from the harness>`).
  - After any scripted edit, `git diff --shortstat <file>`: a whole-file diff means CRLF line endings flipped. Redo the edit with the Edit tool.
- **Shared with other plans.** These files are also edited by other open work. Read the current file and merge into it; never overwrite another plan's hunks:
  - `src/shared/entities/meetings/components/overview-card.tsx` (visit-messages plan 3a, omni-search);
  - `src/features/proposal-flow/ui/components/proposal/funding.tsx` and `src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts` (lifecycle guards 2026-10-05, records-table render isolation);
  - `src/shared/components/contract-status-panel/ui/envelope-configuration-section.tsx` and `envelope-card.tsx` (both also render inside `AgentContractView`).
- Code conventions (memory `coding-conventions.md`):
  - one component per file, named exports;
  - constants in `constants/`, pure helpers in `lib/`;
  - only DAL files import `db`;
  - comments say why, never what, with no plan, spec or tracker citations in code;
  - the one exception is the `// LAZY:` header on the SOW parser, whose regexes and `MAX_SPEC_VALUE` stay in that file with it (the whole file is deleted by F1);
  - every other file-level constant (`FALLBACK_HERO_PHOTO`, `PAST_RESULTS_SHOWN`, `COMPARISON_SLIDE_IDS`, the cockpit action lists) lives in a `constants/` file.
- Company facts come only from `src/shared/constants/company/` or an existing typed constant (`WHO_WE_ARE_SLIDES`, `COMPARISON_COLUMNS`). Never use `TRADE_OUTCOMES`, `testimonials`, `awards`, or anything about solar.
- Colours (`DESIGN.md` is the rulebook):
  - The page is on the app's elevation ladder, not `theme-marketing`: the shell is `bg-background`, chrome and chapter bands are `surface`, cards are `bg-card` (a nested `bg-card` climbs a rung by itself), in-card bands are `bg-band`, small fills `bg-muted`.
  - The navy chapters (hero, Next steps, the comparison's Tri Pros header) sit on `bg-(--presentation-ground)`, a fixed dark stage in both schemes. Ink on it is `text-on-media` / `text-on-media-muted`; eyebrows and numerals are `text-(--presentation-accent)`. That accent is for the navy stage only; on ladder surfaces eyebrows and numerals are `text-muted-foreground`.
  - Clickable cards and rows hover `bg-row-hover`, press `pressed:bg-row-press`, and a chosen one is `bg-row-selected` (never a primary border or ring). Status fills are solid: `toneClasses(tone).fill` or `bg-status-<tone>-bg`, never an alpha.
  - No alpha fills or borders, no `white`/`black`, no `dark:` patches, no `opacity-*` on text (secondary text is `text-muted-foreground`), and no `text-[Npx]` (the type-ramp lint floor is `text-xs`).
  - **No new colour tokens.** If one seems needed, stop and ask the owner.
- Never show to anyone, on any surface: `creditScore`, `age`/`ageGroup`, `householdType`, `sellPlan`, `numQuotesReceived`, cost lines, margin.
- Copy, verbatim from the spec:
  - Chapter titles and short labels: Overview · Trusted contractor/Contractor · Past results/Results · Scope of work/Scope · Funding · Next steps/Next steps.
  - "Your price for this part", "Subtotal of all parts", "Applies to the whole project", "Final contract price", "Deposit at signing".
  - "Estimates, subject to lender approval. Financing starts at $3,500."
  - "Pricing held through {date} ({n} days)".
- Breakpoints: chapter rail at container width ≥ 1100px (`@min-[1100px]/proposal:`); cockpit sheet at ≥ 1024px (handled by `ResponsiveSheet` via `useIsBelowLg`).
- `MIN_FINANCED_AMOUNT = 3500`. Cash-down step $500. Debounced save after 600ms. The $3,500 floor is enforced in the UI only until R7: `setCashInDeal` validates `cashInDeal` as `z.number().min(0)` and nothing more (`src/trpc/routers/proposals.router/funding.router.ts`).
- **A frozen proposal never takes a funding write from the page.** `isProposalFrozen` (`src/shared/modules/proposals/core/lib/proposal-lock.ts`) is the only lock test; never compare lock fields by hand.

## Data access gates (spec §5; the owner runs these, this plan builds around them)

| Item | What this plan does until it lands | When it lands |
|---|---|---|
| R1 homeowner projection (#285 / spec F H10) | **Done, live** (`5b9a23fd9`, 2026-10-12). `getFullView` returns `toHomeownerProposalView(ctx.actor.ability, view)` (`src/trpc/routers/proposals.router/business.router.ts`): a share-link holder gets only the columns `proposalBearerRules` lists (`src/shared/domains/permissions/rules/bearer.ts`), plus `customer`, `incentives`, `media`, and `projectJSON` with every `costLines` emptied. Staff get the view unchanged. Task 15 Step 4 asserts it on the wire. | No longer a release gate. |
| R2 `sent_message` + `proposalService.send` (spec A A5) | The send composer passes `message` to `delivery.sendProposalEmail`. The "last note" line and the homeowner's "A note from…" are not rendered. | A one-step follow-up: switch the composer's mutation and render `proposal.sentMessage`. |
| R3 owner profile on the read | The consultant row shows `companyInfo.name` and the main line from `companyInfo`. | Swap the fallback for `proposal.owner`. The DAL join alone is not enough: `toHomeownerProposalView` (`src/shared/modules/proposals/core/lib/to-homeowner-proposal-view.ts`) drops everything a bearer's read rule doesn't list, so `owner` must also be passed through there, the way `customer` is. |
| R4 gated phone on the session path | Nothing to do in UI. A share-link holder gets `customer` as stored: their own details, passed through `toHomeownerProposalView` on purpose. A signed-in agent gets the raw `customers.phone` from `getFullView` (`src/shared/modules/proposals/core/dal/server/queries.ts`, the `customer.phone` select), so `OverviewContextCard` shows the ungated phone to agents only. That is today's exposure, unchanged by this plan. | The context card then shows whatever the gated read returns. |
| R5 meeting date on the read | The overview meta row omits "Visited {date}". The cockpit's Meeting card reads the profile query. | Add the meta item. As with R3, the date must also be passed through `toHomeownerProposalView` for a bearer to receive it (it strips `meetingProjectId` today, and `meetingId` is not in the bearer read rule). |
| R6 trade-filtered portfolio read | Past results shows the first three public projects with a hero image. The spec's before/after cards and the scope card's "We've done this before" chip are **not built**: both need a project matched to the proposal's trades. An empty list shows a one-line fallback, never a bare heading. | Swap the query, then build the before/after cards and the chip. |
| R7 payment plan model | **Owner ruling O1 (2026-10-15):** only the cash-down slider saves. The payment mode is on-screen state; "All cash" and "All finance" never write. A reload opens on "Some cash" when the stored `cashInDeal` is above $0, else on "All finance" (on "All cash" when nothing can be financed). Scheduled payments shows a "Your consultant will set up a payment schedule with you." line. | A plan amendment: mode persistence (D24), the scheduled-payments list and the cockpit editor dialog, and the server-side $3,500 floor. |

## Plan-time settlements (deviations from the spec text)

1. **Viewer values stay `ViewMode = 'customer' | 'agent'`** (`hooks/use-view-mode.ts`). The spec's `'homeowner'` is the existing `'customer'`.
2. **The SOW parser reads `contentJSON` (Tiptap), not `html`.** It is structured, needs no DOM, and is testable in node. Real sections have:
   - the description as an italic `heading` level 3, or a paragraph, starting "Description:";
   - phases as `heading` level 2 followed by a `bulletList`;
   - "Agreement Notes" as bold key:value list items, including "Exclusions: …";
   - an "Optional Add-Ons" / "Optional Addons" phase, which becomes `addOns` rather than a work phase.
3. **The top bar moves into `<Proposal/>`.** The layout's `ProposalPageNavbar` goes, because the cockpit button and the "{label} · {customer}" title need the loaded proposal.
4. **The cockpit reads `customerPipelinesRouter.getCustomerProfile` once.** That one read feeds the Customer card (customer, notes) and the Meeting card (`profile.meetings.find(m => m.id === proposal.meetingId)`), so `meetings.getByIdWithJoins` is not needed.
5. **The comparison is a proposal-local responsive table** reading `WHO_WE_ARE_SLIDES` rows. The meeting's `ComparisonTable` is sized for presentation slides (`cqw` units, white-on-navy only).
6. **The hero photo** is the first image in `proposal.media`, else `/hero-photos/modern-house-5.jpg` (already shipped, used by Who We Are). Trade cover images are not on the read.
7. **The shell stays on the app ladder:** `ProposalFlowShell` is already `bg-background` with no radial red/blue gradient (2026-10-07), and does not take `theme-marketing`, which would switch the ladder off for the whole page. Agent mode has no page tint: it shows as the "Agent view" badge in the top bar, the cockpit button, and the segmented "Viewing as" switch in the menu.
8. **`internalFinancials` and `copySow` are wired through `onInternalFinancials` and `onCopySow` overrides** on `ProposalActionsHost`. Each action is omitted when its override is not passed, so the proposals table, kanban and every other host are unchanged.
9. **Action hosts, not card props (B1).** Cards no longer own action configs: `ProposalOverviewCard` reads `useProposalActionsHost`, `MeetingOverviewCard` reads `useMeetingActionsHost`, and both throw without a host. The cockpit mounts `<ProposalActionsHost overrides><MeetingActionsHost><CustomerActionsHost overrides>` around its cards. The proposal override `onView` is a no-op, because the page *is* the proposal and the card's root click runs View. `CustomerOverviewCard.Actions` reads `useCustomerActionsHost`; the card's root reads no host, so it gains no new requirement.
10. **Cockpit actions shown (owner ruling 2026-10-15: Send is the one primary).** The composer's Send/Resend is the card's only filled button. In the toolbar, "Copy Link (Email)" and "Edit Proposal" are both promoted (outline), set per surface with `withToolbarRoles` and no `primaryId` (made optional in Task 13), so no toolbar button is filled (the shared `PROPOSAL_ACTIONS` keep `view` as primary everywhere else). View and Delete are hidden in the cockpit (deleting the open proposal leaves a dead page). Customer overflow: View Profile (opens the profile as a modal layer over the sheet) and Schedule Meeting (`CreateMeetingModal`); Edit is hidden because the profile edits contact fields inline, and Delete has no place in the cockpit. Meeting overflow: the host's defaults.
11. **Modals open through `openModal` (B2).** `useModalStore` was deleted 2026-10-14. Internal Financials opens with `openModal({ accessor: 'InternalFinancials', Component: InternalFinancialsModal, props })` from `@/shared/lib/open-modal`, as `heading.tsx` does today; the profile with `openCustomerProfile`.
12. **Frozen proposal (O2).** Funding is read-only when `isProposalFrozen(proposal)`: the saved cash down, finance option and monthly payment are shown, every control is disabled, and one line reads "These choices are in your agreement. Ask your consultant to change them." A share-link read carries no `contractEnvelopeId` (it is not in `proposalBearerRules`), so for a homeowner a draft envelope is detected only when `setCashInDeal` or `crud.update` answers `proposal_frozen`; Funding then switches to the locked state with no error toast. No server change. **Owner ruling (2026-10-15):** a proposal whose status is `declined` does not lock Funding by itself. The page locks exactly when `isProposalFrozen` does, plus on the `proposal_frozen` refusal, matching the server (`getProposalLockState` freezes on `approved`, a contract sent, signed or declined, or a draft envelope, never on status `declined` alone).
13. **The re-clamp is derived, not an effect (H3).** The shown cash down is `clampCashDown(picked ?? stored, finalTcp)` on every render, so a price change that would leave under $3,500 financed clamps at once and the debounced save stores it. A `setState` in an effect would trip `react-hooks-extra/no-direct-set-state-in-use-effect` and render one frame of the stale value.
14. **The breakdown reuses `buildPricingBreakdown().sections` (M1).** In breakdown mode the parts are `sections` as computed (title, price, incentives, `netPrice`). The only new helper, `getTotalModeParts`, gives what `sections` doesn't: total-mode titles and their incentives.
15. **Insight chips reuse `CustomerProfileKeyInsights` (H6)** through a new optional `fields` prop, instead of a second chip component.
16. **Glossary (O4).** "Cockpit" and "Proposal chapter" are added to `CONTEXT.md` (Proposal page terms). `OverviewCard` (O3) is the frame name; `EntityCard` is not used.
17. **Shared props are in scope (owner ruling 2026-10-15).** Each is optional and leaves today's callers unchanged: an optional `primaryId` in `withToolbarRoles` (`src/shared/components/entities/entity-actions/lib/with-toolbar-roles.ts`, Task 13, same class of change, added after the ruling), `thumbProps` on the shadcn `Slider` (`src/shared/components/ui/slider.tsx`, Task 6), `bodyClassName` plus a `data-slot="responsive-sheet-body"` on `ResponsiveSheet` (`src/shared/components/dialogs/sheets/responsive-sheet.tsx`, Task 13), and `className` on `EnvelopeCard` (`src/shared/components/contract-status-panel/ui/envelope-card.tsx`, Task 13).

## Review Focus

1. **A homeowner never sees an agent control.** Without `?view=agent`, and also for a logged-in agent without the param, the DOM has no cockpit button, no "Agent view" badge, no "View internal financials", no copy-SOW, no scheduled-payments editor and no send composer. Pinned by Task 15 Step 4 (DOM query on both viewers).
2. **The slider never lets financing drop below $3,500.** The maximum is `finalTcp − 3500` rounded down to $500. A stored `cashInDeal` above that is clamped and re-saved. Under $4,000 the financing modes are disabled. Pinned by `getCashDownBounds` tests (Task 6 Step 1) and Task 15 Step 6.
3. **Dragging the slider sends one write, not dozens.** A drag of ten steps produces one `setCashInDeal` request 600ms after release, and a pending value is flushed when the page is hidden (`visibilitychange` to hidden, and `pagehide`). Switching the payment mode sends nothing (O1). Pinned by Task 15 Step 6 (request count).
4. **Total-mode proposals show no part prices.** Parts list titles and their incentives only. The first priced line is "Contract price". The final price equals `buildPricingBreakdown().finalTcp`. Pinned by `getTotalModeParts` tests (Task 5 Step 1) and Task 15 Step 5.
5. **A malformed or unusual SOW never loses text.** An unparseable `contentJSON`, a section with no headings, or a section whose "Description:" sits in a paragraph still renders: parsed blocks when possible, else the sanitized HTML. No "0 steps" phase appears. Pinned by `parseSowSection` tests (Task 3 Step 1).
6. **A frozen proposal never accepts a funding write from the page.** With a contract sent, signed or declined, or the proposal approved, the controls are disabled and no write is sent; on a `proposal_frozen` refusal the chapter locks with no error toast. Pinned by Task 15 Step 6 (frozen sub-steps).
7. **The cockpit mounts the three action hosts; no card throws for a missing host.** `ProposalActionsHost`, `MeetingActionsHost` and `CustomerActionsHost` wrap every cockpit card. Pinned by Task 13 Step 7 and Task 15 Step 2 (the cockpit opens with no console error).

## File map

| Area | Files (under `src/` unless noted) |
|---|---|
| Document seam | `features/proposal-flow/contexts/proposal-document-context.tsx` (new) · `features/proposal-flow/constants/proposal-steps.ts` · `features/proposal-flow/ui/components/proposal/index.tsx` |
| Chrome | `features/proposal-flow/ui/components/proposal/top-bar-frame.tsx` (new) · `.../proposal/top-bar.tsx` (new) · `.../proposal/chapter-nav.tsx` (new) · `features/proposal-flow/lib/scroll-to-chapter.ts` (new) · `features/proposal-flow/ui/components/proposal-flow-shell.tsx` · `app/(frontend)/proposal-flow/layout.tsx` · `features/proposal-flow/ui/components/navbar/navbar-menu.tsx` · delete `navbar/navbar.tsx`, `navbar/navbar-frame.tsx` |
| Scope | `features/proposal-flow/lib/parse-sow-section.ts` (new) · `.../proposal/scope-spec-card.tsx` (new) · `.../proposal/scope-of-work.tsx` |
| Funding | `features/proposal-flow/lib/get-total-mode-parts.ts` (new) · `features/proposal-flow/ui/components/pricing-breakdown/price-row.tsx` (new) · `features/proposal-flow/ui/components/pricing-breakdown.tsx` · `shared/modules/proposals/core/constants/financing.ts` (new) · `features/proposal-flow/lib/get-cash-down-bounds.ts` (new) · `features/proposal-flow/constants/payment-modes.ts` (new) · `features/proposal-flow/constants/funding-lock.ts` (new) · `features/proposal-flow/hooks/use-debounced-save.ts` (new) · `shared/components/ui/slider.tsx` · `.../proposal/cash-down-slider.tsx` (new) · `.../proposal/finance-option-group.tsx` (new) · `.../proposal/payment-plan-group.tsx` (new) · `.../proposal/funding.tsx` |
| Other chapters | `features/proposal-flow/constants/proposal-hero.ts` (new) · `.../proposal/overview-hero.tsx` (new) · `.../proposal/overview-context-card.tsx` (new) · `.../proposal/project-overview.tsx` · `features/proposal-flow/constants/comparison-slides.ts` (new) · `features/proposal-flow/lib/get-comparison-rows.ts` (new) · `.../proposal/comparison-list.tsx` (new) · `.../proposal/trusted-contractor.tsx` · `features/proposal-flow/constants/past-results.ts` (new) · `.../proposal/related-projects.tsx` · `.../proposal/next-steps.tsx` (new) |
| Entity cards | `shared/components/entities/overview-card/overview-card.tsx` (new) · `shared/modules/proposals/core/components/overview-card.tsx` · `shared/entities/customers/components/overview-card.tsx` · `shared/entities/customers/components/profile/customer-profile-key-insights.tsx` · `shared/modules/customers/core/constants/presentable-insight-fields.ts` (new) · `shared/entities/meetings/components/overview-card.tsx` · `shared/modules/proposals/core/constants/actions.ts` · `shared/modules/proposals/core/hooks/use-proposal-action-configs.ts` |
| Cockpit | `features/proposal-flow/ui/components/cockpit/{cockpit,cockpit-proposal-card,send-composer,cockpit-agreement-card,cockpit-customer-card,cockpit-meeting-card}.tsx` (new) · `features/proposal-flow/constants/cockpit-actions.ts` (new) · `shared/components/dialogs/sheets/responsive-sheet.tsx` · `shared/components/contract-status-panel/ui/envelope-card.tsx` · `shared/components/contract-status-panel/ui/envelope-configuration-section.tsx` |
| Removals | `.../proposal/heading.tsx`, `.../proposal/copy-sow-button.tsx`, `.../proposal/send-proposal-link.tsx` |

`.../proposal/` = `src/features/proposal-flow/ui/components/proposal/`.

---

## Task 1: The proposal document context and chapter metadata

**Files:**
- Create: `src/features/proposal-flow/contexts/proposal-document-context.tsx`
- Modify: `src/features/proposal-flow/constants/proposal-steps.ts`
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`

**Interfaces:**
- Produces: `ProposalDocument` (type), `ProposalDocumentProvider({ proposal, viewMode, token, children })` and `useProposalDocument(): { proposal: ProposalDocument, viewMode: ViewMode, token: string | undefined, isAgent: boolean }`.
- Produces: every `proposalSteps` entry gains `shortLabel: string`. The agreement step's `title` becomes `'Next steps'`.

- [ ] **Step 1: Create the context**

```tsx
// src/features/proposal-flow/contexts/proposal-document-context.tsx
'use client'

import type { inferRouterOutputs } from '@trpc/server'
import type { ReactNode } from 'react'
import type { ViewMode } from '@/features/proposal-flow/hooks/use-view-mode'
import type { AppRouter } from '@/trpc/routers/app'

import { createContext, use, useMemo } from 'react'

export type ProposalDocument = NonNullable<inferRouterOutputs<AppRouter>['proposalsRouter']['business']['getFullView']>

interface ProposalDocumentValue {
  proposal: ProposalDocument
  viewMode: ViewMode
  token: string | undefined
  isAgent: boolean
}

const ProposalDocumentContext = createContext<ProposalDocumentValue | null>(null)

interface ProviderProps {
  proposal: ProposalDocument
  viewMode: ViewMode
  token: string | undefined
  children: ReactNode
}

// The document never reads route params, so another host (a meeting page, the Let's build! tab) can drive it.
export function ProposalDocumentProvider({ proposal, viewMode, token, children }: ProviderProps) {
  const value = useMemo<ProposalDocumentValue>(
    () => ({ proposal, viewMode, token, isAgent: viewMode === 'agent' }),
    [proposal, viewMode, token],
  )
  return <ProposalDocumentContext value={value}>{children}</ProposalDocumentContext>
}

export function useProposalDocument(): ProposalDocumentValue {
  const ctx = use(ProposalDocumentContext)
  if (!ctx) {
    throw new Error('useProposalDocument must be used within ProposalDocumentProvider')
  }
  return ctx
}
```

- [ ] **Step 2: Add short labels and rename the closing chapter**

In `src/features/proposal-flow/constants/proposal-steps.ts`, add a `shortLabel` to each entry and change the agreement `title`:

```ts
// project-overview
title: 'Overview', shortLabel: 'Overview',
// about-tri-pros
title: 'Trusted contractor', shortLabel: 'Contractor',
// related-projects
title: 'Past results', shortLabel: 'Results',
// scope-of-work
title: 'Scope of work', shortLabel: 'Scope',
// funding
title: 'Funding', shortLabel: 'Funding',
// agreement
title: 'Next steps', shortLabel: 'Next steps',
```

Add `shortLabel: string` to the `ProposalStep` type in `src/features/proposal-flow/types` (open the file that exports `ProposalStep` and add the field next to `title`).

- [ ] **Step 3: Wrap the steps in the provider and skip the agent's own view**

In `index.tsx`:
- import `ProposalDocumentProvider`;
- read `const urlToken = searchParams.get('token') ?? undefined` (the name `token` is already taken by `const { token, customer } = proposalData`, the proposal's own token);
- wrap everything inside the scroll container in `<ProposalDocumentProvider proposal={proposalData} viewMode={viewMode} token={urlToken}>`;
- change the `recordView` effect's guard so agents never count as a view, and a missing token never calls it:

```tsx
useEffect(() => {
  if (hasRecorded.current || !proposal.data) {
    return
  }
  hasRecorded.current = true
  const token = searchParams.get('token')
  // An agent previewing the page is not a homeowner view, and the server rejects a missing token anyway.
  if (viewMode === 'agent' || !token) {
    return
  }
  // …existing utm/source + recordView.mutate({ proposalId: params.proposalId, token, … })
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [proposal.data])
```

Leave the steps' rendering unchanged in this task; chapters move to the context one by one in Tasks 4–10.

- [ ] **Step 4: Verify**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`. Expected: both pass (the `navbar.tsx` step titles change text only).

- [ ] **Step 5: Commit**

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/contexts/proposal-document-context.tsx
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/features/proposal-flow/contexts/proposal-document-context.tsx src/features/proposal-flow/constants/proposal-steps.ts src/features/proposal-flow/types/index.ts src/features/proposal-flow/ui/components/proposal/index.tsx <<'EOF'
feat(proposal-flow): the proposal document takes its proposal from context

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these four files.

---

## Task 2: Top bar, chapter nav and the shell

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/top-bar-frame.tsx`
- Create: `src/features/proposal-flow/ui/components/proposal/top-bar.tsx`
- Create: `src/features/proposal-flow/ui/components/proposal/chapter-nav.tsx`
- Create: `src/features/proposal-flow/lib/scroll-to-chapter.ts`
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal-flow-shell.tsx`
- Modify: `src/app/(frontend)/proposal-flow/layout.tsx`
- Modify: `src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx`
- Delete: `src/features/proposal-flow/ui/components/navbar/navbar.tsx`, `navbar/navbar-frame.tsx`

**Interfaces:**
- Consumes: `useProposalDocument()` (Task 1), `proposalSteps[].shortLabel` (Task 1), `useActiveSection(ids, { rootEl })` (`@/shared/hooks/use-active-section`), `useScrollRoot()`, `useAbility()` (`@/shared/domains/permissions/client`).
- Produces: `ProposalTopBarFrame({ children }: { children?: ReactNode })` (back link and logo; needs no proposal, so the loading and error states show it too), `ProposalTopBar({ onOpenCockpit }: { onOpenCockpit?: () => void })`, `ChapterNav({ variant }: { variant: 'rail' | 'tabs' })` and `scrollToChapter(id: string): void`. Each chapter wrapper is `<section id={accessor} aria-labelledby={`${accessor}-title`}>`. Each chapter's heading carries `id={`${accessor}-title`}`: an `<h2>`, except the Overview's, which is the page's one `<h1>` (Task 7).

- [ ] **Step 1: The shell stays on the ladder**

`ProposalFlowShell` is already `bg-background` with no gradient. Keep its `style` sidebar variables and `data-view-mode`; add only `text-foreground`:

```tsx
<div style={/* unchanged */} className="h-full flex flex-col bg-background text-foreground" data-no-gutter-stable data-view-mode={viewMode}>
```

Do not add `theme-marketing` or any agent-mode tint.

- [ ] **Step 2: The layout drops the navbar and the container**

In `layout.tsx`, remove the `ProposalPageNavbar` import and its wrapper `div`. Replace the `container grow min-h-0 py-4 lg:py-8 …` wrapper and its inner `h-full` div with one wrapper that carries both safe-area insets, so the top bar `<Proposal/>` renders sits under the notch and below it nothing scrolls but the document:

```tsx
<ProposalFlowShell>
  <ScrollRootProvider>
    <div className="flex min-h-0 grow flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <Suspense fallback={<ProposalFlowLoadingState />}>
        {children}
      </Suspense>
    </div>
  </ScrollRootProvider>
</ProposalFlowShell>
```

Keep `AbilityProvider`, `ProposalSplashScreen` and `GlobalDialogs` as they are. `proposal-flow/proposal/[proposalId]` is the layout's only route, so no other page loses the navbar.

- [ ] **Step 3: The menu reads the document**

In `navbar-menu.tsx`:
- replace `useCurrentProposal()` with `useProposalDocument()`, so the PDF link uses `proposal.id` and `token`;
- drop the `variant` prop, since it renders one style;
- keep the trigger `variant="ghost"` (its own `hover:bg-hover`) with `size-9 rounded-md data-[state=open]:bg-press`, since the bar is a ladder surface;
- keep the "Viewing as" segmented `ToggleGroup` (`variant="segmented"`, Homeowner / Agent) as it is.

- [ ] **Step 4: Write the top bar**

The frame needs no proposal, so `<Proposal/>` renders it alone while the proposal loads or fails, and the back link is always there.

```tsx
// src/features/proposal-flow/ui/components/proposal/top-bar-frame.tsx
'use client'

import type { ReactNode } from 'react'

import { ArrowLeftIcon } from 'lucide-react'
import Link from 'next/link'

import { Logo } from '@/shared/components/logo'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/client'

export function ProposalTopBarFrame({ children }: { children?: ReactNode }) {
  const ability = useAbility()
  const backHref = ability.can('access', 'Dashboard') ? ROOTS.dashboard.proposals.root() : '/'

  return (
    <header className="surface flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      <Link href={backHref} className="flex h-11 shrink-0 items-center gap-2" aria-label="Back">
        <ArrowLeftIcon className="size-5" />
        <Logo variant="icon" className="size-8" />
      </Link>
      {children}
    </header>
  )
}
```

```tsx
// src/features/proposal-flow/ui/components/proposal/top-bar.tsx
'use client'

import { PanelRightIcon } from 'lucide-react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { AgentViewBadge } from '@/features/proposal-flow/ui/components/navbar/agent-view-badge'
import { ProposalNavbarMenu } from '@/features/proposal-flow/ui/components/navbar/navbar-menu'
import { Button } from '@/shared/components/ui/button'
import { ProposalTopBarFrame } from './top-bar-frame'

interface Props {
  onOpenCockpit?: () => void
}

export function ProposalTopBar({ onOpenCockpit }: Props) {
  const { proposal, isAgent } = useProposalDocument()
  const title = [proposal.label, proposal.customer?.name].filter(Boolean).join(' · ')

  return (
    <ProposalTopBarFrame>
      <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
      <div className="ml-auto flex items-center gap-2">
        <AgentViewBadge />
        {isAgent && onOpenCockpit && (
          <Button size="sm" variant="outline" onClick={onOpenCockpit}>
            <PanelRightIcon className="size-4" />
            Cockpit
          </Button>
        )}
        <ProposalNavbarMenu />
      </div>
    </ProposalTopBarFrame>
  )
}
```

The bar is the same `surface border-b` strip as today's navbar, so the cockpit button is a standalone `outline` action and the menu trigger a `ghost`. `AgentViewBadge` already exists (secondary badge, shield icon, label sr-only below `sm`); it renders only in agent view and is `print:hidden`. The title is a `<p>`: the page's `<h1>` is the hero headline (Task 7).

- [ ] **Step 5: Write the chapter nav**

`offsetTop` is measured from the nearest positioned ancestor, not from the scroll root, so the nav scrolls the target into view instead. The target's `scroll-mt-*` keeps it clear of the sticky tabs.

```ts
// src/features/proposal-flow/lib/scroll-to-chapter.ts
export function scrollToChapter(id: string) {
  const target = document.getElementById(id)
  if (!target) {
    return
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
}
```

```tsx
// src/features/proposal-flow/ui/components/proposal/chapter-nav.tsx
'use client'

import { proposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { scrollToChapter } from '@/features/proposal-flow/lib/scroll-to-chapter'
import { useActiveSection } from '@/shared/hooks/use-active-section'
import { cn } from '@/shared/lib/utils'

interface Props {
  variant: 'rail' | 'tabs'
}

const ids = proposalSteps.map(step => step.accessor)

export function ChapterNav({ variant }: Props) {
  const { rootEl } = useScrollRoot()
  const active = useActiveSection(ids, { rootEl })

  if (variant === 'rail') {
    return (
      <nav aria-label="Proposal chapters" className="sticky top-0 self-start py-8 pl-6 pr-4">
        <ol className="flex flex-col gap-1">
          {proposalSteps.map((step, i) => (
            <li key={step.accessor}>
              <button
                type="button"
                onClick={() => scrollToChapter(step.accessor)}
                aria-current={active === step.accessor ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 border-l-2 border-transparent px-3 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground pressed:text-foreground',
                  active === step.accessor && 'border-foreground text-foreground',
                )}
              >
                <span className="w-4 text-xs tabular-nums">{i + 1}</span>
                {step.title}
              </button>
            </li>
          ))}
        </ol>
      </nav>
    )
  }

  return (
    <nav aria-label="Proposal chapters" className="surface sticky top-0 z-10 border-b border-border">
      <ol className="flex overflow-x-auto [scrollbar-width:none]">
        {proposalSteps.map(step => (
          <li key={step.accessor} className="shrink-0">
            <button
              type="button"
              onClick={() => scrollToChapter(step.accessor)}
              aria-current={active === step.accessor ? 'true' : undefined}
              className={cn(
                'min-h-11 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground pressed:text-foreground',
                active === step.accessor && 'border-foreground text-foreground',
              )}
            >
              {step.shortLabel}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  )
}
```

Both variants follow `DESIGN.md`'s underline-tabs model (foreground text on a foreground line when active, muted text otherwise, no fills), matching today's navbar links. They are scroll-spy buttons, not `Tabs`, because there are no tab panels.

- [ ] **Step 6: Lay out the page**

In `index.tsx`:
- Add `const [cockpitOpen, setCockpitOpen] = useState(false)`. Task 13 uses it.
- The loading and error states return before the provider exists, so they render the bare frame for the back link. The error state shows only when there is **no** data: a failed background refetch (a write's invalidation, a window refocus) keeps the document on screen instead of replacing it with an error.

```tsx
if (proposal.isLoading) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ProposalTopBarFrame />
      <LoadingState title="Loading Proposal" description="This may take a few seconds" />
    </div>
  )
}

if (!proposal.data) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <ProposalTopBarFrame />
      <ErrorState title="Error: Could not load proposal" description={proposal.error?.message ?? 'Please try again'} />
    </div>
  )
}
```

- The ready state is one flex column inside the provider: the bar, then `#proposal-container` as the only scroller. Today's outer `h-full overflow-auto` wrapper goes, so nothing scrolls twice. Replace `<Heading />` and the step map's wrappers with:

```tsx
<ProposalDocumentProvider proposal={proposalData} viewMode={viewMode} token={urlToken}>
  <div className="flex h-full min-h-0 flex-col">
    <ProposalTopBar onOpenCockpit={() => setCockpitOpen(true)} />
    <div ref={setRootEl} id="proposal-container" className="min-h-0 flex-1 overflow-y-auto">
      <div className="@container/proposal">
        <div className="grid @min-[1100px]/proposal:grid-cols-[220px_minmax(0,1fr)]">
          <div className="hidden @min-[1100px]/proposal:block"><ChapterNav variant="rail" /></div>
          <div className="min-w-0">
            <div className="@min-[1100px]/proposal:hidden"><ChapterNav variant="tabs" /></div>
            {proposalSteps.map(step => (
              <section key={step.accessor} id={step.accessor} aria-labelledby={`${step.accessor}-title`} className="scroll-mt-12 @min-[1100px]/proposal:scroll-mt-0">
                {/* existing per-step rendering, unchanged */}
              </section>
            ))}
            {token && <PdfFallbackCard pdfUrl={getProposalPdfUrl(params.proposalId, token)} />}
          </div>
        </div>
      </div>
    </div>
  </div>
</ProposalDocumentProvider>
```

- `urlToken` is the share-link token from Task 1 Step 3; the PDF link keeps the proposal's own `token` from `proposalData`, as today.
- Remove the `motion.div` wrapper, the `space-y-20`, `lg:pr-8` and `scroll-smooth`. Scrolling is driven by `scrollToChapter`, which respects reduced motion.
- `Heading` is no longer rendered; Task 14 deletes it.

- [ ] **Step 7: Delete the old navbar**

```bash
git rm -- src/features/proposal-flow/ui/components/navbar/navbar.tsx src/features/proposal-flow/ui/components/navbar/navbar-frame.tsx
```

Then grep for `ProposalPageNavbar|ProposalNavbarFrame` under `src/`. Expected: no matches. `navbar/agent-view-badge.tsx` and `navbar/navbar-menu.tsx` stay.

- [ ] **Step 8: Verify**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`; both pass. Open `http://localhost:3000/proposal-flow/proposal/<id>?view=agent` using the dev session URL from `reference-playwright-auth.md`, at 1440 and 390, and screenshot each:
- the rail sticks while scrolling at 1440;
- the tabs show all six short labels, uncut, at 390;
- `#proposal-container` is the only element that scrolls (the window's `scrollY` stays 0 after scrolling to the bottom);
- the loading state (throttle the network in the Playwright context) shows the back link.

- [ ] **Step 9: Commit**

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/ui/components/proposal/top-bar-frame.tsx src/features/proposal-flow/ui/components/proposal/top-bar.tsx src/features/proposal-flow/ui/components/proposal/chapter-nav.tsx src/features/proposal-flow/lib/scroll-to-chapter.ts
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/features/proposal-flow/ui/components/proposal/top-bar-frame.tsx src/features/proposal-flow/ui/components/proposal/top-bar.tsx src/features/proposal-flow/ui/components/proposal/chapter-nav.tsx src/features/proposal-flow/lib/scroll-to-chapter.ts src/features/proposal-flow/ui/components/proposal/index.tsx src/features/proposal-flow/ui/components/proposal-flow-shell.tsx "src/app/(frontend)/proposal-flow/layout.tsx" src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx src/features/proposal-flow/ui/components/navbar/navbar.tsx src/features/proposal-flow/ui/components/navbar/navbar-frame.tsx <<'EOF'
feat(proposal-flow): a chapter rail and short-label tabs replace the step navbar

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these files, the two navbar files as deletions.

---

## Task 3: Parse a SOW section into spec-sheet blocks

**Files:**
- Create: `src/features/proposal-flow/lib/parse-sow-section.ts`
- Test: `.superpowers/sdd/2026-10-01-proposal-page/tests/parse-sow-section.test.ts`

**Interfaces:**
- Produces:

```ts
export interface ParsedSowPhase { title: string, steps: string[] }
export interface ParsedSowSection {
  description: string | null
  specs: [label: string, value: string][]
  exclusions: string[]
  phases: ParsedSowPhase[]
  addOns: string[]
}
export function parseSowSection(contentJSON: string): ParsedSowSection | null
```

It returns `null` when the JSON doesn't parse, isn't a Tiptap `doc`, or yields no description and no phases. The caller then falls back to the sanitized HTML.

- [ ] **Step 1: Write the failing test**

```ts
// .superpowers/sdd/2026-10-01-proposal-page/tests/parse-sow-section.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseSowSection } from '@/features/proposal-flow/lib/parse-sow-section'

const text = (t: string, marks: string[] = []) => ({ type: 'text', text: t, marks: marks.map(type => ({ type })) })
const p = (t: string, marks: string[] = []) => ({ type: 'paragraph', content: [text(t, marks)] })
const h = (level: number, t: string, marks: string[] = []) => ({ type: 'heading', attrs: { level }, content: [text(t, marks)] })
const ul = (...items: string[]) => ({ type: 'bulletList', content: items.map(i => ({ type: 'listItem', content: [p(i)] })) })
const doc = (...content: unknown[]) => JSON.stringify({ type: 'doc', content })

test('italic h3 description, phases, agreement notes, add-ons', () => {
  const out = parseSowSection(doc(
    h(3, 'Description: Remove existing attic insulation.', ['italic']),
    h(2, 'Site Preparation'),
    { type: 'horizontalRule' },
    ul('Install drop cloths', 'Install dust barriers'),
    h(2, 'Phase I: Removal'),
    ul('Vacuum insulation'),
    h(2, 'Agreement Notes'),
    ul('Story: 1st story', 'Approximate attic area: ~1,600 sq ft', 'Exclusions: HVAC equipment, registers', 'Permits not included'),
    h(2, 'Optional Addons'),
    ul('HEPA filtration'),
    p(''),
  ))
  assert.ok(out)
  assert.equal(out.description, 'Remove existing attic insulation.')
  assert.deepEqual(out.phases, [
    { title: 'Site Preparation', steps: ['Install drop cloths', 'Install dust barriers'] },
    { title: 'Phase I: Removal', steps: ['Vacuum insulation'] },
  ])
  assert.deepEqual(out.specs, [['Story', '1st story'], ['Approximate attic area', '~1,600 sq ft']])
  assert.deepEqual(out.exclusions, ['HVAC equipment, registers', 'Permits not included'])
  assert.deepEqual(out.addOns, ['HEPA filtration'])
})

test('paragraph description and Optional Add-Ons spelling', () => {
  const out = parseSowSection(doc(
    p('Description: Replace attic ducts.'),
    h(2, 'Phase I: Demolition'),
    ul('Disconnect ducts'),
    h(2, 'Optional Add-Ons'),
    ul('R-8 upgrade'),
  ))
  assert.equal(out?.description, 'Replace attic ducts.')
  assert.equal(out?.phases.length, 1)
  assert.deepEqual(out?.addOns, ['R-8 upgrade'])
})

test('a phase heading with no list is dropped, never a "0 steps" phase', () => {
  const out = parseSowSection(doc(p('Description: x'), h(2, 'Empty'), h(2, 'Real'), ul('step')))
  assert.deepEqual(out?.phases, [{ title: 'Real', steps: ['step'] }])
})

test('a long key:value line is a note, not a spec', () => {
  const long = `Note: ${'a'.repeat(60)}`
  const out = parseSowSection(doc(p('Description: x'), h(2, 'Agreement Notes'), ul(long)))
  assert.deepEqual(out?.specs, [])
  assert.deepEqual(out?.exclusions, [])
  assert.deepEqual(out?.phases, [{ title: 'Agreement Notes', steps: [long] }])
})

test('invalid or empty input returns null', () => {
  assert.equal(parseSowSection('not json'), null)
  assert.equal(parseSowSection(JSON.stringify({ type: 'paragraph' })), null)
  assert.equal(parseSowSection(doc(p(''))), null)
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-01-proposal-page/tests/parse-sow-section.test.ts`
Expected: FAIL, because the module `parse-sow-section` is not found.

- [ ] **Step 3: Implement**

```ts
// src/features/proposal-flow/lib/parse-sow-section.ts
// LAZY: replaced by the structured scope view model sourced from the Notion construction catalog.

interface TiptapNode {
  type: string
  attrs?: Record<string, unknown>
  text?: string
  content?: TiptapNode[]
}

export interface ParsedSowPhase { title: string, steps: string[] }

export interface ParsedSowSection {
  description: string | null
  specs: [label: string, value: string][]
  exclusions: string[]
  phases: ParsedSowPhase[]
  addOns: string[]
}

const DESCRIPTION = /^description:\s*/i
const AGREEMENT_NOTES = /^agreement notes$/i
const ADD_ONS = /^optional add-?ons$/i
const EXCLUSION = /not included|excluded|not responsible|unless|not specifically/i
const EXCLUSIONS_KEY = /^exclusions?$/i
// A longer value reads as a sentence and belongs in the notes, not a two-column spec row.
const MAX_SPEC_VALUE = 48

function inline(node: TiptapNode): string {
  if (node.type === 'text') {
    return node.text ?? ''
  }
  return (node.content ?? []).map(inline).join('')
}

function listItems(node: TiptapNode): string[] {
  return (node.content ?? [])
    .map(item => inline(item).replace(/\s+/g, ' ').trim())
    .filter(Boolean)
}

function parseDoc(json: string): TiptapNode | null {
  try {
    const parsed = JSON.parse(json) as TiptapNode
    return parsed && parsed.type === 'doc' ? parsed : null
  }
  catch {
    return null
  }
}

export function parseSowSection(contentJSON: string): ParsedSowSection | null {
  const root = parseDoc(contentJSON)
  if (!root) {
    return null
  }

  let description: string | null = null
  const groups: ParsedSowPhase[] = []
  let current: ParsedSowPhase | null = null

  for (const node of root.content ?? []) {
    const t = inline(node).replace(/\s+/g, ' ').trim()
    if (!description && (node.type === 'paragraph' || node.type === 'heading') && DESCRIPTION.test(t)) {
      description = t.replace(DESCRIPTION, '')
      continue
    }
    if (node.type === 'heading' && node.attrs?.level === 2 && t) {
      current = { title: t, steps: [] }
      groups.push(current)
      continue
    }
    if ((node.type === 'bulletList' || node.type === 'orderedList') && current) {
      current.steps.push(...listItems(node))
    }
  }

  const specs: [string, string][] = []
  const exclusions: string[] = []
  const addOns: string[] = []
  const phases: ParsedSowPhase[] = []

  for (const group of groups) {
    if (group.steps.length === 0) {
      continue
    }
    if (ADD_ONS.test(group.title)) {
      addOns.push(...group.steps)
      continue
    }
    if (!AGREEMENT_NOTES.test(group.title)) {
      phases.push(group)
      continue
    }
    const notes: string[] = []
    for (const line of group.steps) {
      const match = line.match(/^([^:]{2,40}):\s*(.+)$/)
      if (match && EXCLUSIONS_KEY.test(match[1].trim())) {
        exclusions.push(match[2].trim())
      }
      else if (EXCLUSION.test(line)) {
        exclusions.push(line)
      }
      else if (match && match[2].length <= MAX_SPEC_VALUE) {
        specs.push([match[1].trim(), match[2].trim()])
      }
      else {
        notes.push(line)
      }
    }
    if (notes.length > 0) {
      phases.push({ title: group.title, steps: notes })
    }
  }

  if (!description && phases.length === 0 && specs.length === 0) {
    return null
  }
  return { description, specs, exclusions, phases, addOns }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run the same command. Expected: PASS, 5 tests.

- [ ] **Step 5: Lint, type-check, commit**

The regexes and `MAX_SPEC_VALUE` stay in this file under its `// LAZY:` header: they exist only for the parser, and F1 deletes the whole file.

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`, then:

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/lib/parse-sow-section.ts
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/features/proposal-flow/lib/parse-sow-section.ts <<'EOF'
feat(proposal-flow): parse a scope section into details, exclusions and phases

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only this file.

---

## Task 4: The scope spec sheet chapter

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/scope-spec-card.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx`

**Interfaces:**
- Consumes: `parseSowSection` (Task 3), `useProposalDocument()` (Task 1), `SOW` (`@/shared/modules/proposals/core/types`), `sanitizeUserHtml`, `formatAsDollars`.
- Produces: `ScopeSpecCard({ section, index, showPrice }: { section: SOW, index: number, showPrice: boolean })`. Each card carries `id="scope-part-{n}"` (1-based), the target of the overview's part list (Task 7).

- [ ] **Step 1: Write the card**

```tsx
// src/features/proposal-flow/ui/components/proposal/scope-spec-card.tsx
'use client'
/* eslint-disable react-dom/no-dangerously-set-innerhtml */

import type { SOW } from '@/shared/modules/proposals/core/types'

import { ChevronDownIcon } from 'lucide-react'
import { useMemo, useState } from 'react'

import { parseSowSection } from '@/features/proposal-flow/lib/parse-sow-section'
import { formatAsDollars } from '@/shared/lib/formatters'
import { sanitizeUserHtml } from '@/shared/lib/sanitize-html'
import { cn } from '@/shared/lib/utils'

interface Props {
  section: SOW
  index: number
  showPrice: boolean
}

export function ScopeSpecCard({ section, index, showPrice }: Props) {
  const parsed = useMemo(() => parseSowSection(section.contentJSON), [section.contentJSON])
  const [openPhase, setOpenPhase] = useState<number | null>(0)
  const price = section.financials.sectionPrice ?? 0

  return (
    <article id={`scope-part-${index + 1}`} className="scroll-mt-12 overflow-hidden rounded-lg border border-border bg-card shadow-sm @min-[1100px]/proposal:scroll-mt-0">
      <header className="flex items-start gap-4 border-b border-border px-5 py-4">
        <span className="pt-0.5 text-lg font-semibold tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-balance">{section.title || 'Untitled part'}</h3>
          {section.trade.label && <p className="text-xs font-semibold text-muted-foreground">{section.trade.label}</p>}
        </div>
        {showPrice && price > 0 && <span className="shrink-0 font-semibold tabular-nums">{formatAsDollars(price)}</span>}
      </header>

      {!parsed
        ? <div className="proposal-sow px-5 py-4" dangerouslySetInnerHTML={{ __html: sanitizeUserHtml(section.html) }} />
        : (
            <div className="grid gap-5 px-5 py-4">
              {parsed.description && <p className="text-sm leading-relaxed text-muted-foreground">{parsed.description}</p>}

              {parsed.specs.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Key details</h4>
                  <dl className="grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                    {parsed.specs.map(([label, value]) => (
                      <div key={label} className="contents">
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-semibold">{value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
              )}

              {parsed.exclusions.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Not included</h4>
                  <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
                    {parsed.exclusions.map(line => <li key={line}>{line}</li>)}
                  </ul>
                </div>
              )}

              {parsed.phases.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phases</h4>
                  <ol className="divide-y divide-border rounded-md border border-border">
                    {parsed.phases.map((phase, i) => {
                      const open = openPhase === i
                      return (
                        <li key={phase.title}>
                          <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => setOpenPhase(open ? null : i)}
                            className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold transition-colors hover:bg-row-hover pressed:bg-row-press"
                          >
                            <span className="w-5 tabular-nums text-muted-foreground">{i + 1}</span>
                            <span className="flex-1">{phase.title}</span>
                            <span className="text-xs text-muted-foreground">{`${phase.steps.length} ${phase.steps.length === 1 ? 'step' : 'steps'}`}</span>
                            <ChevronDownIcon className={cn('size-4 transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
                          </button>
                          {open && (
                            <ul className="grid list-disc gap-1 pb-3 pl-12 pr-3 text-sm text-muted-foreground">
                              {phase.steps.map(step => <li key={step}>{step}</li>)}
                            </ul>
                          )}
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}

              {parsed.addOns.length > 0 && (
                <div className="grid gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Optional add-ons</h4>
                  <ul className="grid list-disc gap-1 pl-5 text-sm text-muted-foreground">
                    {parsed.addOns.map(line => <li key={line}>{line}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
    </article>
  )
}
```

- [ ] **Step 2: Rewrite the chapter**

Replace `scope-of-work.tsx` with:

```tsx
'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ProposalMediaGallery } from '@/features/proposal-flow/ui/components/proposal/proposal-media-gallery'
import { ScopeSpecCard } from '@/features/proposal-flow/ui/components/proposal/scope-spec-card'

export function ScopeOfWork() {
  const { proposal } = useProposalDocument()
  const { sow } = proposal.projectJSON.data
  const showPrice = proposal.priceDisplayMode === 'breakdown'

  return (
    <div className="surface px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Scope of work</p>
          <h2 id="scope-of-work-title" className="text-3xl font-semibold text-balance">Exactly what we’ll do</h2>
          <p className="text-muted-foreground">{`${sow.length} ${sow.length === 1 ? 'part' : 'parts'}, written step by step before any work starts.`}</p>
        </header>
        {sow.length === 0
          ? <p className="text-muted-foreground">Scope being finalized.</p>
          : sow.map((section, i) => <ScopeSpecCard key={`${i}-${section.title}`} section={section} index={i} showPrice={showPrice} />)}
        <ProposalMediaGallery media={proposal.media ?? []} />
      </div>
    </div>
  )
}
```

The chapter band is a `surface`, so each `ScopeSpecCard` (`bg-card`) climbs a rung above it by itself.

The free-text `agreementNotes` block is gone: per-section notes now live in each card. The proposal-level `agreementNotes` is empty in every sampled proposal (spec §3).

The per-section `CopySowButton` goes with the old chapter: copying the scope becomes the agent-only `copySow` action in the cockpit's Proposal card (Tasks 12–13), and Task 14 deletes the file.

- [ ] **Step 3: Verify**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`. Screenshot the Scope chapter at 1440 and 390 on a proposal whose sections use both description forms. Check:
- no "0 steps" phase appears;
- details render as two columns;
- exclusions show under "Not included".

- [ ] **Step 4: Commit**

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/ui/components/proposal/scope-spec-card.tsx
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/features/proposal-flow/ui/components/proposal/scope-spec-card.tsx src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx <<'EOF'
feat(proposal-flow): the scope chapter reads as a spec sheet per part

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these two files.

---

## Task 5: Per-part price breakdown

**Files:**
- Create: `src/features/proposal-flow/lib/get-total-mode-parts.ts`
- Create: `src/features/proposal-flow/ui/components/pricing-breakdown/price-row.tsx`
- Modify: `src/features/proposal-flow/ui/components/pricing-breakdown.tsx`
- Test: `.superpowers/sdd/2026-10-01-proposal-page/tests/get-total-mode-parts.test.ts`

**Interfaces:**
- Consumes: `buildPricingBreakdown` and its `PricingBreakdownModel` / `BreakdownSectionLine` (`@/shared/modules/proposals/core/lib/financials`). In breakdown mode `sections[]` already carries each priced part's `key`, `title`, `price`, `incentives` and `netPrice` (`compute-breakdown.ts`), so breakdown mode renders it as is.
- Produces:

```ts
// lib/get-total-mode-parts.ts — what `sections` leaves out: in total mode it is empty
export interface TotalModePart {
  key: string
  title: string
  incentives: BreakdownSectionLine['incentives']
}
export function getTotalModeParts(sow: SOW[]): TotalModePart[]

// pricing-breakdown/price-row.tsx
PriceRow({ label, value, className }: { label: ReactNode, value: ReactNode, className?: string })
```

`PricingBreakdown` keeps its props (`funding`, `sow`, `priceDisplayMode`), so `InternalFinancialsModal` and the funding chapter both get the new layout.

- [ ] **Step 1: Write the failing test**

```ts
// .superpowers/sdd/2026-10-01-proposal-page/tests/get-total-mode-parts.test.ts
import type { FundingData } from '@/shared/modules/proposals/core/schemas'
import type { SOW } from '@/shared/modules/proposals/core/types'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { getTotalModeParts } from '@/features/proposal-flow/lib/get-total-mode-parts'
import { buildPricingBreakdown } from '@/shared/modules/proposals/core/lib/financials'

const section = (title: string, price: number | null, incentives: { id: string, label: string, amount: number }[] = []): SOW => ({
  title,
  contentJSON: '{}',
  html: '',
  scopes: [],
  trade: { id: 't', label: 'Trade' },
  financials: { sectionPrice: price, costLines: [], incentives },
} as unknown as SOW)

const funding: FundingData = { startingTcp: 25206, depositAmount: 1000, cashInDeal: 0, incentives: [] }

const sow = [
  section('Pavers', 22456, [{ id: 'i1', label: 'Bundle savings', amount: 1250 }]),
  section('Demo', 2750),
  section('Unpriced', null),
]

test('total mode: every part listed by title with its own incentives, unpriced parts included', () => {
  assert.deepEqual(getTotalModeParts(sow), [
    { key: '0-Pavers', title: 'Pavers', incentives: [{ id: 'i1', label: 'Bundle savings', amount: 1250 }] },
    { key: '1-Demo', title: 'Demo', incentives: [] },
    { key: '2-Unpriced', title: 'Unpriced', incentives: [] },
  ])
})

test('an untitled incentive reads as Discount', () => {
  assert.equal(getTotalModeParts([section('A', 1, [{ id: 'x', label: '', amount: 5 }])])[0].incentives[0].label, 'Discount')
})

test('titles and keys match the breakdown-mode sections, so a part reads the same in both modes', () => {
  const untitled = [section('', 100), section('Demo', 50)]
  const sections = buildPricingBreakdown({ funding, sow: untitled, priceDisplayMode: 'breakdown' }).sections
  assert.deepEqual(
    getTotalModeParts(untitled).map(({ key, title }) => ({ key, title })),
    sections.map(({ key, title }) => ({ key, title })),
  )
})

test('breakdown-mode sections skip unpriced parts and carry netPrice', () => {
  const { sections } = buildPricingBreakdown({ funding, sow, priceDisplayMode: 'breakdown' })
  assert.deepEqual(sections.map(s => [s.title, s.price, s.netPrice]), [['Pavers', 22456, 21206], ['Demo', 2750, 2750]])
})
```

The last test pins the shared helper this task now relies on, so a change to `buildPricingBreakdown` that breaks the page fails here first.

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-01-proposal-page/tests/get-total-mode-parts.test.ts`. Expected: FAIL, module `get-total-mode-parts` not found.

- [ ] **Step 3: Implement the helper and the row**

```ts
// src/features/proposal-flow/lib/get-total-mode-parts.ts
import type { BreakdownSectionLine } from '@/shared/modules/proposals/core/lib/financials'
import type { SOW } from '@/shared/modules/proposals/core/types'

export interface TotalModePart {
  key: string
  title: string
  incentives: BreakdownSectionLine['incentives']
}

// Keys, titles and incentive labels follow buildPricingBreakdown's sections, so a part reads the same in either mode.
export function getTotalModeParts(sow: SOW[]): TotalModePart[] {
  return sow.map((section, i) => ({
    key: `${i}-${section.title || 'section'}`,
    title: section.title || `Section ${i + 1}`,
    incentives: (section.financials.incentives ?? []).map(inc => ({ id: inc.id, label: inc.label || 'Discount', amount: inc.amount })),
  }))
}
```

```tsx
// src/features/proposal-flow/ui/components/pricing-breakdown/price-row.tsx
import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface Props {
  label: ReactNode
  value: ReactNode
  className?: string
}

export function PriceRow({ label, value, className }: Props) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 whitespace-nowrap tabular-nums">{value}</span>
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Expected: PASS, 4 tests.

- [ ] **Step 5: Rewrite `PricingBreakdown`**

```tsx
// src/features/proposal-flow/ui/components/pricing-breakdown.tsx
'use client'

import type { PriceDisplayMode } from '@/shared/constants/enums'
import type { BreakdownSectionLine } from '@/shared/modules/proposals/core/lib/financials'
import type { FundingData } from '@/shared/modules/proposals/core/schemas'
import type { SOW } from '@/shared/modules/proposals/core/types'

import { CheckIcon, GiftIcon } from 'lucide-react'

import { getTotalModeParts } from '@/features/proposal-flow/lib/get-total-mode-parts'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { buildPricingBreakdown } from '@/shared/modules/proposals/core/lib/financials'
import { ExpirationBadge } from './expiration-badge'
import { PriceRow } from './pricing-breakdown/price-row'

interface Props {
  funding: FundingData
  sow: SOW[]
  priceDisplayMode: PriceDisplayMode
}

// A part's own price shows only in breakdown mode, and its net only when it has incentives to net out.
type PartLine = Omit<BreakdownSectionLine, 'price' | 'netPrice'> & { price: number | null, netPrice: number | null }

export function PricingBreakdown({ funding, sow, priceDisplayMode }: Props) {
  const breakdown = buildPricingBreakdown({ funding, sow, priceDisplayMode })
  const showPrices = breakdown.priceDisplayMode === 'breakdown'
  const parts: PartLine[] = showPrices
    ? breakdown.sections.map(section => ({ ...section, netPrice: section.incentives.length > 0 ? section.netPrice : null }))
    : getTotalModeParts(sow).map(part => ({ ...part, price: null, netPrice: null }))
  const now = new Date()

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-sm">
      {!showPrices && (
        <PriceRow className="px-4 py-3.5 font-semibold" label="Contract price" value={formatAsDollars(breakdown.subtotal)} />
      )}
      <div className={cn('divide-y divide-border', !showPrices && 'border-t border-border')}>
        {parts.map(part => (
          <div key={part.key} className="grid gap-2 px-4 py-3.5">
            <PriceRow label={<span className="font-bold">{part.title}</span>} value={part.price !== null ? <span className="font-semibold">{formatAsDollars(part.price)}</span> : null} />
            {part.incentives.map(inc => (
              <PriceRow
                key={inc.id}
                className="text-status-success-fg"
                label={<span className="inline-flex items-center gap-1.5"><GiftIcon className="size-3.5 shrink-0" />{inc.label}</span>}
                value={`−${formatAsDollars(inc.amount)}`}
              />
            ))}
            {part.netPrice !== null && (
              <PriceRow className="border-t border-dashed border-border pt-2 font-semibold" label="Your price for this part" value={formatAsDollars(part.netPrice)} />
            )}
          </div>
        ))}
        {showPrices && breakdown.miscPrice != null && (
          <PriceRow className="px-4 py-3.5" label={<span className="font-bold">Additional items</span>} value={formatAsDollars(breakdown.miscPrice)} />
        )}
      </div>

      <PriceRow className="border-t border-border px-4 py-3.5 text-muted-foreground" label={showPrices ? 'Subtotal of all parts' : 'Subtotal'} value={formatAsDollars(breakdown.netSubtotal)} />

      {breakdown.globalLines.length > 0 && (
        <div className="grid gap-2.5 border-t border-border bg-status-success-bg px-4 py-3.5 text-status-success-fg">
          <p className="text-xs font-bold uppercase tracking-wider">Applies to the whole project</p>
          {breakdown.globalLines.map((line) => {
            const expiresAt = line.expiresAt ? new Date(line.expiresAt) : null
            const expired = expiresAt ? now >= expiresAt : false
            return (
              <div key={line.key} className="grid gap-1">
                <PriceRow
                  className={cn(expired && 'text-muted-foreground line-through')}
                  label={(
                    <span className="inline-flex items-center gap-1.5">
                      <GiftIcon className="size-3.5 shrink-0" />
                      {line.label}
                      {line.kind === 'exclusive-offer' && line.notes && <span className="text-muted-foreground">{` · ${line.notes}`}</span>}
                    </span>
                  )}
                  value={line.amount != null ? `−${formatAsDollars(line.amount)}` : <span className="inline-flex items-center gap-1"><CheckIcon className="size-3.5" />Included</span>}
                />
                {expiresAt && !expired && <ExpirationBadge expiresAt={expiresAt} />}
              </div>
            )
          })}
        </div>
      )}

      <div className="grid gap-1.5 border-t border-border bg-band px-4 py-3.5">
        <PriceRow label={<span className="font-bold">Final contract price</span>} value={<span className="text-2xl font-semibold">{formatAsDollars(breakdown.finalTcp)}</span>} />
        <PriceRow className="text-muted-foreground" label="Deposit at signing" value={formatAsDollars(breakdown.deposit)} />
      </div>
    </div>
  )
}
```

`bg-status-success-bg` is the solid success tone fill (`TONE_CLASSES.success` in `src/shared/constants/status-tones.ts`). The total footer is `bg-band`, as today's breakdown has it. Breakdown mode now shows each part's incentives under it, so `breakdown.sectionIncentiveLines` (today's total-mode global block) is no longer rendered here; the PDF and the summary route still read it.

- [ ] **Step 6: Verify**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`. Screenshot the Funding chapter on:
- a breakdown-mode proposal;
- a total-mode proposal (any with `priceDisplayMode = 'total'`).

Check that the final price equals the old page's for the same proposal.

- [ ] **Step 7: Commit**

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/lib/get-total-mode-parts.ts src/features/proposal-flow/ui/components/pricing-breakdown/price-row.tsx
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/features/proposal-flow/lib/get-total-mode-parts.ts src/features/proposal-flow/ui/components/pricing-breakdown/price-row.tsx src/features/proposal-flow/ui/components/pricing-breakdown.tsx <<'EOF'
feat(proposal-flow): the price breakdown reads per part with its own incentives

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these three files.

---

## Task 6: Funding chapter: slider, finance options, payment plan, debounced saves

**Files:**
- Create: `src/shared/modules/proposals/core/constants/financing.ts`
- Create: `src/features/proposal-flow/lib/get-cash-down-bounds.ts`
- Create: `src/features/proposal-flow/constants/payment-modes.ts`
- Create: `src/features/proposal-flow/constants/funding-lock.ts`
- Create: `src/features/proposal-flow/hooks/use-debounced-save.ts`
- Create: `src/features/proposal-flow/ui/components/proposal/cash-down-slider.tsx`
- Create: `src/features/proposal-flow/ui/components/proposal/finance-option-group.tsx`
- Create: `src/features/proposal-flow/ui/components/proposal/payment-plan-group.tsx`
- Modify: `src/shared/components/ui/slider.tsx` (optional `thumbProps`; the three existing callers are unaffected)
- Modify: `src/features/proposal-flow/ui/components/proposal/funding.tsx` (shared with other plans: read it first and merge)
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`
- Modify: `src/features/proposal-flow/constants/proposal-steps.ts`
- Test: `.superpowers/sdd/2026-10-01-proposal-page/tests/get-cash-down-bounds.test.ts`

**Interfaces:**
- Consumes: `RadioGroup` / `RadioGroupItem` (`@/shared/components/ui/radio-group`, Radix: roving focus and arrow keys built in), `Slider` (`@/shared/components/ui/slider`), `Label` (`@/shared/components/ui/label`), `isProposalFrozen` (`@/shared/modules/proposals/core/lib/proposal-lock`), `useSetCashInDeal`, `useUpdateProposal` (both take an optional `token`).
- Produces:

```ts
// constants/financing.ts
export const MIN_FINANCED_AMOUNT = 3500
export const CASH_DOWN_STEP = 500

// lib/get-cash-down-bounds.ts
export type PaymentMode = 'all-cash' | 'some-cash' | 'all-finance' | 'scheduled'
export interface CashDownBounds { max: number, canFinance: boolean }
export function getCashDownBounds(finalTcp: number): CashDownBounds
export function clampCashDown(value: number, finalTcp: number): number
export function isPaymentModeAvailable(mode: PaymentMode, finalTcp: number): boolean
export function getStoredPaymentMode(storedCash: number, finalTcp: number): PaymentMode

// constants/funding-lock.ts
export const PROPOSAL_FROZEN_REASON = 'proposal_frozen'
export const FUNDING_LOCKED_NOTE = 'These choices are in your agreement. Ask your consultant to change them.'

// hooks/use-debounced-save.ts
export function useDebouncedSave<T>(value: T, stored: T, save: (value: T) => void, delayMs?: number): void

// shared slider: one new optional prop
Slider({ …Radix Root props, thumbProps?: Omit<ComponentProps<typeof SliderPrimitive.Thumb>, 'children'> })

// components
CashDownSlider({ value, max, disabled, onChange }: { value: number, max: number, disabled?: boolean, onChange: (v: number) => void })
FinanceOptionGroup({ options, selectedId, amountFinanced, disabled, onSelect }: { options: FinanceOption[], selectedId: string | null, amountFinanced: number, disabled?: boolean, onSelect: (optionId: string) => void })
PaymentPlanGroup({ value, finalTcp, disabled, onChange }: { value: PaymentMode, finalTcp: number, disabled?: boolean, onChange: (mode: PaymentMode) => void })
```

- [ ] **Step 1: Write the failing test**

```ts
// .superpowers/sdd/2026-10-01-proposal-page/tests/get-cash-down-bounds.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clampCashDown, getCashDownBounds, getStoredPaymentMode, isPaymentModeAvailable } from '@/features/proposal-flow/lib/get-cash-down-bounds'

test('max leaves at least $3,500 financed, rounded down to $500', () => {
  assert.deepEqual(getCashDownBounds(27340), { max: 23500, canFinance: true })
  assert.deepEqual(getCashDownBounds(4000), { max: 500, canFinance: true })
})

test('under $4,000 nothing can be financed', () => {
  assert.deepEqual(getCashDownBounds(3999), { max: 0, canFinance: false })
  assert.deepEqual(getCashDownBounds(0), { max: 0, canFinance: false })
})

test('clamp keeps the stored value inside the bounds and on the step', () => {
  assert.equal(clampCashDown(30000, 27340), 23500)
  assert.equal(clampCashDown(-5, 27340), 0)
  assert.equal(clampCashDown(1234, 27340), 1000)
})

test('financing modes need room to finance; cash modes are always available', () => {
  assert.equal(isPaymentModeAvailable('some-cash', 3999), false)
  assert.equal(isPaymentModeAvailable('all-finance', 3999), false)
  assert.equal(isPaymentModeAvailable('all-finance', 3500), false)
  assert.equal(isPaymentModeAvailable('all-finance', 4000), true)
  assert.equal(isPaymentModeAvailable('all-cash', 100), true)
  assert.equal(isPaymentModeAvailable('scheduled', 100), true)
})

test('a reload opens on the mode the saved cash down implies', () => {
  assert.equal(getStoredPaymentMode(5000, 27340), 'some-cash')
  assert.equal(getStoredPaymentMode(0, 27340), 'all-finance')
  assert.equal(getStoredPaymentMode(0, 3999), 'all-cash')
  assert.equal(getStoredPaymentMode(2000, 3999), 'all-cash')
})
```

`all-finance` at exactly $3,500 is unavailable. Keeping the $500 step means every financing mode needs `finalTcp ≥ 4,000` (spec D23: "under $3,500 + $500").

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-01-proposal-page/tests/get-cash-down-bounds.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement the constants and helper**

```ts
// src/shared/modules/proposals/core/constants/financing.ts
// Lenders won't originate a home-improvement loan below this amount.
export const MIN_FINANCED_AMOUNT = 3500
export const CASH_DOWN_STEP = 500
```

```ts
// src/features/proposal-flow/lib/get-cash-down-bounds.ts
import { CASH_DOWN_STEP, MIN_FINANCED_AMOUNT } from '@/shared/modules/proposals/core/constants/financing'

export type PaymentMode = 'all-cash' | 'some-cash' | 'all-finance' | 'scheduled'

export interface CashDownBounds { max: number, canFinance: boolean }

export function getCashDownBounds(finalTcp: number): CashDownBounds {
  const room = finalTcp - MIN_FINANCED_AMOUNT
  const max = Math.max(0, Math.floor(room / CASH_DOWN_STEP) * CASH_DOWN_STEP)
  return { max, canFinance: room >= CASH_DOWN_STEP }
}

export function clampCashDown(value: number, finalTcp: number): number {
  const { max } = getCashDownBounds(finalTcp)
  const stepped = Math.floor(Math.max(0, value) / CASH_DOWN_STEP) * CASH_DOWN_STEP
  return Math.min(stepped, max)
}

export function isPaymentModeAvailable(mode: PaymentMode, finalTcp: number): boolean {
  if (mode === 'all-cash' || mode === 'scheduled') {
    return true
  }
  return getCashDownBounds(finalTcp).canFinance
}

// Only the cash down is stored until the payment plan is, so a reload infers the mode from it.
export function getStoredPaymentMode(storedCash: number, finalTcp: number): PaymentMode {
  if (!getCashDownBounds(finalTcp).canFinance) {
    return 'all-cash'
  }
  return storedCash > 0 ? 'some-cash' : 'all-finance'
}
```

```ts
// src/features/proposal-flow/constants/payment-modes.ts
import type { PaymentMode } from '@/features/proposal-flow/lib/get-cash-down-bounds'

export const PAYMENT_MODES: { value: PaymentMode, label: string }[] = [
  { value: 'all-cash', label: 'All cash' },
  { value: 'some-cash', label: 'Some cash' },
  { value: 'all-finance', label: 'All finance' },
  { value: 'scheduled', label: 'Scheduled payments' },
]
```

```ts
// src/features/proposal-flow/constants/funding-lock.ts
// The proposal DAL's refusal reason for a content write to a proposal with an envelope or a terminal status.
export const PROPOSAL_FROZEN_REASON = 'proposal_frozen'

export const FUNDING_LOCKED_NOTE = 'These choices are in your agreement. Ask your consultant to change them.'
```

- [ ] **Step 4: Run the test to verify it passes**

Expected: PASS, 5 tests.

- [ ] **Step 5: The debounced save hook**

It stays in `features/proposal-flow/hooks/`: Funding is its only consumer. The latest arguments go into the ref from an effect, never during render (the React 19 refs rule). A pending value is flushed when the page is hidden: `visibilitychange` covers a phone switching apps or locking, which never fires `pagehide`, and `pagehide` covers a closed tab.

```ts
// src/features/proposal-flow/hooks/use-debounced-save.ts
'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/shared/hooks/use-debounce'

export function useDebouncedSave<T>(value: T, stored: T, save: (value: T) => void, delayMs = 600) {
  const debounced = useDebounce(value, delayMs)
  const latest = useRef({ value, stored, save })
  // A flush on hide and the debounce catching up later must not send the same value twice.
  const lastSent = useRef<{ value: T } | null>(null)

  useEffect(() => {
    latest.current = { value, stored, save }
  })

  useEffect(() => {
    const { stored: s, save: write } = latest.current
    if (Object.is(debounced, s)) {
      // Back at the stored value (a save landed, or a failed one was reverted), so the same pick may be sent again.
      lastSent.current = null
      return
    }
    if (lastSent.current && Object.is(lastSent.current.value, debounced)) {
      return
    }
    lastSent.current = { value: debounced }
    write(debounced)
  }, [debounced])

  useEffect(() => {
    function flush() {
      const { value: v, stored: s, save: write } = latest.current
      if (Object.is(v, s) || (lastSent.current && Object.is(lastSent.current.value, v))) {
        return
      }
      lastSent.current = { value: v }
      write(v)
    }
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flush()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      window.removeEventListener('pagehide', flush)
    }
  }, [])
}
```

The assignment effect has no dependency list and is declared first, so it runs before the debounce effect in the same commit and the save always sees this render's `stored` and `save`.

- [ ] **Step 6: The slider's thumb props, then the three controls**

Radix puts `role="slider"` and the `aria-value*` attributes on each **thumb**, and the shadcn `Slider` passes its props to the Root only, so an `aria-labelledby` or `aria-valuetext` on `<Slider>` never reaches assistive tech. In `src/shared/components/ui/slider.tsx`, add one optional prop and spread it onto every thumb:

```tsx
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  thumbProps,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  // Radix puts role="slider" on each thumb, so a label or value text set on the root never reaches assistive tech.
  thumbProps?: Omit<React.ComponentProps<typeof SliderPrimitive.Thumb>, 'children'>
}) {
```

and replace the thumb element with:

```tsx
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          {...thumbProps}
          className={cn(
            'border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50',
            thumbProps?.className,
          )}
        />
```

Read the file first and change only these two spots; `image-slider.tsx`, `number-range-filter-control.tsx` and `customer-recording-player.tsx` pass no `thumbProps` and render as before.

The slider's touch target is the Root: Radix starts a drag from a press anywhere on it, so `h-11` makes the whole 44px row the target (spec §4.8) while the thumb stays a visual `size-5`.

```tsx
// src/features/proposal-flow/ui/components/proposal/cash-down-slider.tsx
'use client'

import { Label } from '@/shared/components/ui/label'
import { Slider } from '@/shared/components/ui/slider'
import { formatAsDollars } from '@/shared/lib/formatters'
import { CASH_DOWN_STEP } from '@/shared/modules/proposals/core/constants/financing'

interface Props { value: number, max: number, disabled?: boolean, onChange: (value: number) => void }

export function CashDownSlider({ value, max, disabled = false, onChange }: Props) {
  return (
    <div className="grid gap-1">
      <div className="flex items-baseline justify-between">
        <Label id="cash-down-label" className="text-sm font-bold">Cash down</Label>
        <span className="text-2xl font-semibold tabular-nums">{formatAsDollars(value)}</span>
      </div>
      <Slider
        className="h-11"
        min={0}
        max={max}
        step={CASH_DOWN_STEP}
        value={[value]}
        disabled={disabled}
        onValueChange={([v]) => onChange(v ?? 0)}
        thumbProps={{ 'aria-labelledby': 'cash-down-label', 'aria-valuetext': formatAsDollars(value), 'className': 'size-5' }}
      />
      <div className="flex justify-between text-xs font-semibold tabular-nums text-muted-foreground">
        <span>{formatAsDollars(0)}</span>
        <span>{formatAsDollars(max)}</span>
      </div>
    </div>
  )
}
```

```tsx
// src/features/proposal-flow/ui/components/proposal/finance-option-group.tsx
'use client'

import type { FinanceOption } from '@/shared/db/schema'

import { Label } from '@/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { getLoanValues } from '@/shared/lib/loan-calculations'
import { cn } from '@/shared/lib/utils'

interface Props {
  options: FinanceOption[]
  selectedId: string | null
  amountFinanced: number
  disabled?: boolean
  onSelect: (optionId: string) => void
}

export function FinanceOptionGroup({ options, selectedId, amountFinanced, disabled = false, onSelect }: Props) {
  return (
    <RadioGroup aria-label="Finance option" value={selectedId ?? ''} disabled={disabled} onValueChange={onSelect} className="gap-2">
      {options.map((option) => {
        const id = `finance-option-${option.id}`
        const checked = option.id === selectedId
        return (
          // The whole row is the item's label, so a press anywhere on it picks the option.
          <Label
            key={option.id}
            htmlFor={id}
            className={cn(
              'flex min-h-14 cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-4 font-normal leading-normal transition-colors hover:bg-row-hover pressed:bg-row-press',
              checked && 'bg-row-selected hover:bg-row-selected',
              disabled && 'cursor-not-allowed',
              disabled && !checked && 'hover:bg-card',
            )}
          >
            <RadioGroupItem id={id} value={option.id} />
            <span className="grid flex-1">
              <span className="font-bold">{`${option.termInMonths / 12} years`}</span>
              <span className="text-xs text-muted-foreground">{`${option.termInMonths} months · ${Math.round(option.interestRate * 10000) / 100}% APR`}</span>
            </span>
            <span className="tabular-nums">
              <span className="text-lg font-semibold">{getLoanValues(amountFinanced, option.interestRate, option.termInMonths).monthlyFormatted}</span>
              <span className="text-xs text-muted-foreground"> / mo</span>
            </span>
          </Label>
        )
      })}
    </RadioGroup>
  )
}
```

Radix's `RadioGroup` gives the group `role="radiogroup"`, each item `role="radio"` with `aria-checked`, one tab stop, and arrow keys that move and select, so there is no hand-written key handler or `getElementById` focus. Arrowing through the options changes the selection on every key press; Funding saves the selection through `useDebouncedSave`, so a run of arrow presses sends one write.

```tsx
// src/features/proposal-flow/ui/components/proposal/payment-plan-group.tsx
'use client'

import type { PaymentMode } from '@/features/proposal-flow/lib/get-cash-down-bounds'

import { PAYMENT_MODES } from '@/features/proposal-flow/constants/payment-modes'
import { isPaymentModeAvailable } from '@/features/proposal-flow/lib/get-cash-down-bounds'
import { Label } from '@/shared/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/shared/components/ui/radio-group'
import { cn } from '@/shared/lib/utils'

interface Props { value: PaymentMode, finalTcp: number, disabled?: boolean, onChange: (mode: PaymentMode) => void }

export function PaymentPlanGroup({ value, finalTcp, disabled = false, onChange }: Props) {
  function select(next: string) {
    const mode = PAYMENT_MODES.find(m => m.value === next)
    if (mode) {
      onChange(mode.value)
    }
  }

  return (
    <RadioGroup aria-label="Payment plan" value={value} disabled={disabled} onValueChange={select} className="grid-cols-2 gap-2">
      {PAYMENT_MODES.map((mode) => {
        const id = `payment-mode-${mode.value}`
        const available = isPaymentModeAvailable(mode.value, finalTcp)
        const checked = value === mode.value
        const off = disabled || !available
        return (
          <Label
            key={mode.value}
            htmlFor={id}
            className={cn(
              'flex min-h-11 cursor-pointer items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-bold leading-normal transition-colors hover:bg-row-hover pressed:bg-row-press',
              checked && 'bg-row-selected hover:bg-row-selected',
              off && 'cursor-not-allowed',
              off && !checked && 'text-muted-foreground hover:bg-card',
            )}
          >
            <RadioGroupItem id={id} value={mode.value} disabled={!available} className="mt-0.5" />
            <span className="grid">
              {mode.label}
              {!available && <span className="text-xs font-semibold">Financing starts at $3,500</span>}
            </span>
          </Label>
        )
      })}
    </RadioGroup>
  )
}
```

The unavailable reason is visible text inside the label, so it is read with the disabled radio (spec D23).

- [ ] **Step 7: Rewrite the funding chapter**

Replace `funding.tsx` with the following (run `git status --short` on it first: other plans touch it, and their hunks must survive in the rewrite). The `onPickFinancingOption` prop goes; update the `funding` branch in `index.tsx` to render `<step.Component />`, and remove `'funding'` from `customizableSections`.

Owner ruling O1 decides what writes: **only the cash-down slider and the finance option save.** The payment mode is on-screen state; picking "All cash" or "All finance" sends nothing, and a reload opens on `getStoredPaymentMode`. Owner ruling O2 decides the frozen state: everything shows the saved values, every control is disabled, and one line explains why.

```tsx
'use client'

import type { PaymentMode } from '@/features/proposal-flow/lib/get-cash-down-bounds'

import { ClockIcon, LockIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { FUNDING_LOCKED_NOTE, PROPOSAL_FROZEN_REASON } from '@/features/proposal-flow/constants/funding-lock'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useSetCashInDeal } from '@/features/proposal-flow/dal/client/mutations/use-set-cash-in-deal'
import { useUpdateProposal } from '@/features/proposal-flow/dal/client/mutations/use-update-proposal'
import { useGetFinanceOptions } from '@/features/proposal-flow/dal/client/queries/use-get-finance-options'
import { useDebouncedSave } from '@/features/proposal-flow/hooks/use-debounced-save'
import { clampCashDown, getCashDownBounds, getStoredPaymentMode, isPaymentModeAvailable } from '@/features/proposal-flow/lib/get-cash-down-bounds'
import { PricingBreakdown } from '@/features/proposal-flow/ui/components/pricing-breakdown'
import { CashDownSlider } from '@/features/proposal-flow/ui/components/proposal/cash-down-slider'
import { FinanceOptionGroup } from '@/features/proposal-flow/ui/components/proposal/finance-option-group'
import { PaymentPlanGroup } from '@/features/proposal-flow/ui/components/proposal/payment-plan-group'
import { toneClasses } from '@/shared/constants/status-tones'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'

export function Funding() {
  const { proposal, token } = useProposalDocument()
  const funding = useMemo(() => toFundingInputs(proposal), [proposal])
  const sow = proposal.projectJSON.data.sow
  const finalTcp = computeFinalTcp({ funding, sow })
  const { max } = getCashDownBounds(finalTcp)
  const storedCash = funding.cashInDeal ?? 0
  const storedMode = getStoredPaymentMode(storedCash, finalTcp)

  // A share-link read carries no envelope id, so for a homeowner a draft envelope shows up only as the server refusing the write.
  const [refused, setRefused] = useState(false)
  const locked = refused || isProposalFrozen(proposal)

  const [pickedMode, setPickedMode] = useState<PaymentMode | null>(null)
  const [pickedCash, setPickedCash] = useState<number | null>(null)
  const [pickedOptionId, setPickedOptionId] = useState<string | null>(null)

  const mode = !locked && pickedMode && isPaymentModeAvailable(pickedMode, finalTcp) ? pickedMode : storedMode
  // Clamped on every render, not synced in an effect: a price change that would leave under $3,500 financed
  // shows the clamped value at once, and the debounced save below stores it.
  const cash = locked ? storedCash : clampCashDown(pickedCash ?? storedCash, finalTcp)
  const selectedOptionId = locked ? proposal.financeOptionId : pickedOptionId ?? proposal.financeOptionId

  const financeOptions = useGetFinanceOptions()
  const saveCash = useSetCashInDeal()
  const updateProposal = useUpdateProposal()

  function onWriteError(error: { message: string }, fallback: string) {
    if (error.message === PROPOSAL_FROZEN_REASON) {
      setRefused(true)
      return
    }
    toast.error(fallback)
  }

  // The slider is the only cash write: switching to All cash or All finance never sends $0.
  useDebouncedSave(cash, storedCash, (value) => {
    saveCash.mutate({ token, id: proposal.id, cashInDeal: value }, {
      onError: error => onWriteError(error, 'Couldn’t save your cash down. Your choice is kept on this screen.'),
    })
  })

  useDebouncedSave(selectedOptionId, proposal.financeOptionId, (optionId) => {
    if (!optionId) {
      return
    }
    updateProposal.mutate({ token, id: proposal.id, data: { financeOptionId: optionId } }, {
      onError: (error) => {
        setPickedOptionId(null)
        onWriteError(error, 'Couldn’t save your finance option.')
      },
    })
  })

  const cashDown = mode === 'some-cash' ? cash : 0
  const amountFinanced = finalTcp - cashDown
  const validDays = proposal.projectJSON.data.validThroughTimeframe

  return (
    <div className="px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Funding</p>
          <h2 id="funding-title" className="text-3xl font-semibold text-balance">Your investment</h2>
          <p className="text-muted-foreground">Every part priced, every saving shown. Choose how you’d like to pay.</p>
        </header>
        <div className="grid gap-6 @min-[1100px]/proposal:grid-cols-2">
          <div className="grid content-start gap-3">
            <PricingBreakdown funding={funding} sow={sow} priceDisplayMode={proposal.priceDisplayMode} />
            {validDays && (
              <p className={cn('flex items-center gap-2 rounded-md border px-3 py-2.5 text-sm font-semibold', toneClasses('pending').fill)}>
                <ClockIcon className="size-4" />
                {`Pricing held for ${validDays}`}
              </p>
            )}
          </div>
          <div className="grid content-start gap-4 rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">How you’d like to pay</p>
            {locked && (
              <p className="flex items-center gap-2 text-sm font-semibold">
                <LockIcon className="size-4 shrink-0" />
                {FUNDING_LOCKED_NOTE}
              </p>
            )}
            <PaymentPlanGroup value={mode} finalTcp={finalTcp} disabled={locked} onChange={setPickedMode} />
            {mode === 'all-cash' && (
              <p className="text-sm">{`${formatAsDollars(finalTcp)} in total: ${formatAsDollars(funding.depositAmount)} at signing, the balance on completion.`}</p>
            )}
            {mode === 'scheduled' && (
              <p className="text-sm text-muted-foreground">Your consultant will set up a payment schedule with you.</p>
            )}
            {mode === 'some-cash' && <CashDownSlider value={cash} max={max} disabled={locked} onChange={setPickedCash} />}
            {(mode === 'some-cash' || mode === 'all-finance') && (
              <>
                <p className="text-sm">{`${formatAsDollars(amountFinanced)} to finance${cashDown > 0 ? ` after ${formatAsDollars(cashDown)} down` : ''}.`}</p>
                {financeOptions.data && financeOptions.data.length > 0 && (
                  <FinanceOptionGroup
                    options={financeOptions.data}
                    selectedId={selectedOptionId}
                    amountFinanced={amountFinanced}
                    disabled={locked}
                    onSelect={setPickedOptionId}
                  />
                )}
                <p className="text-xs text-muted-foreground">Estimates, subject to lender approval. Financing starts at $3,500.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

Check the details before relying on them:
- **`validThroughTimeframe`:** read its type in `src/shared/modules/proposals/core/schemas/index.ts`. If it is a phrase like "60 days", the hold line reads `Pricing held for 60 days`. If a date can be derived (`sentAt` plus days), render the spec's "Pricing held through {date} ({n} days)" instead. Pick by the stored shape; don't invent a parse.
- **Mutation input types:** both writes take an optional `token` (`funding.router.ts`: `token: z.string().optional()`; `createCrudRouter`'s update input: `token: z.string().optional()`), so pass the context's `token` as is. A signed-in agent's write goes through the session.
- **Hold line tone:** there are no `status-warning-*` utilities. The hold line is the solid `pending` tone, `toneClasses('pending').fill` (it carries its own tone hairline, hence `border`).
- **The frozen refusal:** the DAL throws `precondition-failed` with reason `proposal_frozen` (`setCashInDeal` in `core/dal/server/mutations.ts`, the `update.before` hook in `core/dal/server/crud.ts`); `dalToTrpc` turns it into `PRECONDITION_FAILED` with that reason as the message, which is what `onWriteError` compares. It shows no toast: the chapter's own lock line replaces it.
- **The floor is UI-only until R7:** `setCashInDeal` accepts any `cashInDeal ≥ 0`. The slider's maximum and the derived clamp are what keep $3,500 financed today.

- [ ] **Step 8: Verify**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`. Run the `getCashDownBounds` tests again (Step 4): they are the check for the under-$4,000 rule and must pass. In the browser, with writes intercepted (`page.route('**/proposalsRouter.funding.setCashInDeal**', r => r.fulfill({ status: 200, body: '…' }))`, using a captured response shape), check that:
- dragging the slider updates "to finance" and every monthly payment live;
- one request fires about 600ms after release, and switching between "All cash" and "All finance" fires none;
- under $4,000 the two financing modes are disabled. Don't look for a real proposal that small: rewrite the captured `getFullView` response through `page.route` (in the batched superjson body, set `startingTcpCents` to `390000` and empty `incentives` and every `projectJSON.data.sow[].financials.incentives`) and assert both financing radios are `disabled` with "Financing starts at $3,500" visible. Report the unit-test result and this check separately.

- [ ] **Step 9: Commit**

```bash
git diff --cached --name-status
git add -- src/shared/modules/proposals/core/constants/financing.ts src/features/proposal-flow/lib/get-cash-down-bounds.ts src/features/proposal-flow/constants/payment-modes.ts src/features/proposal-flow/constants/funding-lock.ts src/features/proposal-flow/hooks/use-debounced-save.ts src/features/proposal-flow/ui/components/proposal/cash-down-slider.tsx src/features/proposal-flow/ui/components/proposal/finance-option-group.tsx src/features/proposal-flow/ui/components/proposal/payment-plan-group.tsx
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/shared/modules/proposals/core/constants/financing.ts src/features/proposal-flow/lib/get-cash-down-bounds.ts src/features/proposal-flow/constants/payment-modes.ts src/features/proposal-flow/constants/funding-lock.ts src/features/proposal-flow/hooks/use-debounced-save.ts src/shared/components/ui/slider.tsx src/features/proposal-flow/ui/components/proposal/cash-down-slider.tsx src/features/proposal-flow/ui/components/proposal/finance-option-group.tsx src/features/proposal-flow/ui/components/proposal/payment-plan-group.tsx src/features/proposal-flow/ui/components/proposal/funding.tsx src/features/proposal-flow/ui/components/proposal/index.tsx src/features/proposal-flow/constants/proposal-steps.ts <<'EOF'
feat(proposal-flow): payment plan, cash-down slider and debounced saves on Funding

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these files.

---

## Task 7: Overview chapter (hero and context card)

**Files:**
- Create: `src/features/proposal-flow/constants/proposal-hero.ts`
- Create: `src/features/proposal-flow/ui/components/proposal/overview-hero.tsx`
- Create: `src/features/proposal-flow/ui/components/proposal/overview-context-card.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/project-overview.tsx`

**Interfaces:**
- Consumes: `useProposalDocument()`, `scrollToChapter` (Task 2), `companyInfo` (`@/shared/constants/company`), `OptimizedImage` (`@/shared/modules/media/core/components/display/optimized-image`), `PhoneAction` / `EmailAction` / `AddressAction` (`@/shared/components/contact-actions/ui/*`).
- Produces: `FALLBACK_HERO_PHOTO`, `OverviewHero()` and `OverviewContextCard()`. Both components are argument-free and read the context.

- [ ] **Step 1: The hero**

The hero headline is the page's one `<h1>`: `Heading` (deleted in Task 14) held the old one, and the top bar's title is a `<p>`. The hero image is the page's only `priority` image.

```ts
// src/features/proposal-flow/constants/proposal-hero.ts
export const FALLBACK_HERO_PHOTO = '/hero-photos/modern-house-5.jpg'
```

```tsx
// src/features/proposal-flow/ui/components/proposal/overview-hero.tsx
'use client'

import Image from 'next/image'

import { FALLBACK_HERO_PHOTO } from '@/features/proposal-flow/constants/proposal-hero'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'
import { companyInfo } from '@/shared/constants/company'

export function OverviewHero() {
  const { proposal } = useProposalDocument()
  const data = proposal.projectJSON.data
  const firstName = proposal.customer?.name?.split(' ')[0] ?? 'there'
  const project = data.label?.trim() ? data.label.trim().toLowerCase() : 'your home'
  const photo = (proposal.media ?? []).find(m => m.mimeType.startsWith('image/'))
  const parts = data.sow.length

  return (
    <div className="bg-(--presentation-ground) text-on-media">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-8 @min-[700px]/proposal:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @min-[700px]/proposal:items-center">
        <div className="grid gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">{`Your proposal · ${data.label || companyInfo.name}`}</p>
          <h1 id="project-overview-title" className="text-4xl font-semibold leading-tight text-balance">{`${firstName}, here’s the plan for ${project}.`}</h1>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-on-media-muted">
            <span><b className="text-on-media">{parts}</b>{` ${parts === 1 ? 'part' : 'parts'}`}</span>
            {data.timeAllocated && <span><b className="text-on-media">{data.timeAllocated}</b> on site</span>}
            <span>Prepared by <b className="text-on-media">{companyInfo.name}</b></span>
          </p>
        </div>
        <div className="relative aspect-4/3 overflow-hidden rounded-lg">
          {photo
            ? <OptimizedImage file={photo} alt={photo.name} fill sizes="(max-width: 700px) 100vw, 40vw" priority />
            : <Image src={FALLBACK_HERO_PHOTO} alt="" fill sizes="(max-width: 700px) 100vw, 40vw" className="object-cover" priority />}
        </div>
      </div>
    </div>
  )
}
```

`--presentation-ground` is a fixed navy in both schemes, so its ink is the scheme-independent `text-on-media` / `text-on-media-muted`, never `text-white` or an alpha of it.

The headline reads "{first name}, here's the plan for {project}." With no label, `project` is "your home"; with a label such as "Front & side yard refresh", it is that label lowercased. Confirm the `data.label` field name in `projectSectionSchema` before relying on it.

- [ ] **Step 2: The context card**

```tsx
// src/features/proposal-flow/ui/components/proposal/overview-context-card.tsx
'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { scrollToChapter } from '@/features/proposal-flow/lib/scroll-to-chapter'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { companyInfo } from '@/shared/constants/company'

export function OverviewContextCard() {
  const { proposal } = useProposalDocument()
  const c = proposal.customer
  const address = c ? [c.address, [c.city, c.state, c.zip].filter(Boolean).join(', ')].filter(Boolean).join(', ') : ''
  const sow = proposal.projectJSON.data.sow

  return (
    <div className="mx-auto -mt-6 grid max-w-5xl gap-6 px-4 pb-12 sm:px-8">
      <div className="grid overflow-hidden rounded-lg border border-border bg-card shadow-sm @min-[700px]/proposal:grid-cols-2">
        <div className="grid content-start gap-3 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Prepared for</p>
          <p className="text-xl font-semibold">{c?.name}</p>
          <div className="grid gap-1 text-sm text-muted-foreground">
            {address && <AddressAction address={address} />}
            {c?.phone && <PhoneAction phone={c.phone} />}
            {c?.email && <EmailAction email={c.email} />}
          </div>
        </div>
        <div className="grid content-start gap-3 border-t border-border p-5 @min-[700px]/proposal:border-l @min-[700px]/proposal:border-t-0">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Your consultant</p>
          {/* Until the owner profile is on the read, the company stands in for the consultant. */}
          <p className="font-semibold">{companyInfo.name}</p>
          {companyInfo.phone && <PhoneAction phone={companyInfo.phone} />}
        </div>
      </div>
      <div className="grid gap-2">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">What’s in this proposal</p>
        <ol className="grid gap-2 @min-[700px]/proposal:grid-cols-2">
          {sow.map((section, i) => (
            <li key={`${i}-${section.title}`}>
              <button
                type="button"
                onClick={() => scrollToChapter(`scope-part-${i + 1}`)}
                className="grid min-h-12 w-full grid-cols-[2rem_1fr] items-center rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-semibold transition-colors hover:bg-row-hover pressed:bg-row-press"
              >
                <span className="tabular-nums text-muted-foreground">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  {section.title || `Part ${i + 1}`}
                  {section.trade.label && <span className="block text-xs font-normal text-muted-foreground">{section.trade.label}</span>}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
```

Check `companyInfo`'s phone field name in `src/shared/constants/company/` (for example `companyInfo.phone` or `companyInfo.contact.phone`) and use what exists.

- [ ] **Step 3: Replace the chapter body**

`project-overview.tsx` becomes:

```tsx
'use client'

import { OverviewContextCard } from './overview-context-card'
import { OverviewHero } from './overview-hero'

export function ProjectOverview() {
  return (
    <>
      <OverviewHero />
      <OverviewContextCard />
    </>
  )
}
```

The old label/value rows from `constants/project-overview-display.tsx` are dropped, because those fields are empty in every sampled proposal. Search for imports of `project-overview-display`. If there are none left, `git rm --` the file in this task.

- [ ] **Step 4: Verify and commit**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`, then screenshot at 1440, 820 and 390. Press a row of "What’s in this proposal" and check the page lands on that part's card in Scope, clear of the sticky tabs at 390.

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/constants/proposal-hero.ts src/features/proposal-flow/ui/components/proposal/overview-hero.tsx src/features/proposal-flow/ui/components/proposal/overview-context-card.tsx
```

Then, in a Bash call that starts with `git commit` (timeout 300000). Add `src/features/proposal-flow/constants/project-overview-display.tsx` to the pathspec if Step 3 removed it with `git rm --`:

```bash
git commit -F - -- src/features/proposal-flow/constants/proposal-hero.ts src/features/proposal-flow/ui/components/proposal/overview-hero.tsx src/features/proposal-flow/ui/components/proposal/overview-context-card.tsx src/features/proposal-flow/ui/components/proposal/project-overview.tsx <<'EOF'
feat(proposal-flow): the overview opens on the homeowner's plan and contact card

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these files.

---

## Task 8: Trusted contractor chapter: the comparison

**Files:**
- Create: `src/features/proposal-flow/constants/comparison-slides.ts`
- Create: `src/features/proposal-flow/lib/get-comparison-rows.ts`
- Create: `src/features/proposal-flow/ui/components/proposal/comparison-list.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/trusted-contractor.tsx`

**Interfaces:**
- Consumes: `WHO_WE_ARE_SLIDES`, `COMPARISON_COLUMNS` (`@/features/meeting-flow/constants/who-we-are-slides`), `ComparisonRow` (`@/features/meeting-flow/types`).
- Produces: `COMPARISON_SLIDE_IDS`, `getComparisonRows(): ComparisonRow[]`, which returns the `comparison` and `extras` slides' rows in order, and `ComparisonList({ rows })`.

- [ ] **Step 1: The selector**

```ts
// src/features/proposal-flow/constants/comparison-slides.ts
// The Who We Are slides whose rows make up the proposal's comparison, in reading order.
export const COMPARISON_SLIDE_IDS = ['comparison', 'extras'] as const
```

```ts
// src/features/proposal-flow/lib/get-comparison-rows.ts
import type { ComparisonRow } from '@/features/meeting-flow/types'
import { WHO_WE_ARE_SLIDES } from '@/features/meeting-flow/constants/who-we-are-slides'
import { COMPARISON_SLIDE_IDS } from '@/features/proposal-flow/constants/comparison-slides'

export function getComparisonRows(): ComparisonRow[] {
  return COMPARISON_SLIDE_IDS.flatMap((id) => {
    const slide = WHO_WE_ARE_SLIDES.find(s => s.id === id)
    return slide?.content.kind === 'comparison' ? slide.content.rows : []
  })
}
```

- [ ] **Step 2: The responsive table**

```tsx
// src/features/proposal-flow/ui/components/proposal/comparison-list.tsx
import type { ComparisonRow } from '@/features/meeting-flow/types'
import { CheckIcon, XIcon } from 'lucide-react'
import { COMPARISON_COLUMNS } from '@/features/meeting-flow/constants/who-we-are-slides'

export function ComparisonList({ rows }: { rows: ComparisonRow[] }) {
  return (
    <>
      <table className="hidden w-full table-fixed border-collapse text-sm @min-[700px]/proposal:table">
        <colgroup><col className="w-[26%]" /><col className="w-[40%]" /><col className="w-[34%]" /></colgroup>
        <thead>
          <tr className="border-b border-border text-left">
            <th scope="col"><span className="sr-only">Topic</span></th>
            <th scope="col" className="bg-(--presentation-ground) px-4 py-3 font-bold text-on-media">{COMPARISON_COLUMNS.triPros}</th>
            <th scope="col" className="px-4 py-3 font-semibold text-muted-foreground">{COMPARISON_COLUMNS.others}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-b border-border align-top">
              <th scope="row" className="px-4 py-3 text-left font-bold">{row.label}</th>
              <td className="bg-band px-4 py-3"><CheckIcon className="mr-2 inline size-4 text-status-success-fg" />{row.triPros}</td>
              <td className="px-4 py-3 text-muted-foreground"><XIcon className="mr-2 inline size-4" />{row.others}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="grid gap-3 @min-[700px]/proposal:hidden">
        {rows.map(row => (
          <li key={row.label} className="overflow-hidden rounded-lg border border-border bg-card">
            <h3 className="px-4 pt-3 text-sm font-bold">{row.label}</h3>
            <p className="px-4 pt-2 text-sm"><CheckIcon className="mr-2 inline size-4 text-status-success-fg" /><b>{COMPARISON_COLUMNS.triPros}: </b>{row.triPros}</p>
            <p className="px-4 pb-3 pt-1 text-sm text-muted-foreground"><XIcon className="mr-2 inline size-4" />{`${COMPARISON_COLUMNS.others}: ${row.others}`}</p>
          </li>
        ))}
      </ul>
    </>
  )
}
```

- [ ] **Step 3: Rewrite the chapter**

Rewrite `trusted-contractor.tsx` as follows:
- **Keep** its `DOCS` array (the license and COI scans) and its `LogoLink` / `CompanySocialButtons` usage. They are company material and already on the page.
- **Remove** `ProcessOverview`.
- **Render:**
  - a header: eyebrow "Trusted contractor", `<h2 id="about-tri-pros-title">`, and the comparison slide's own title text `` `${COMPARISON_COLUMNS.triPros} vs other contractors` ``;
  - `<ComparisonList rows={getComparisonRows()} />`;
  - a `<details>` disclosure, `<summary>View license and insurance documents</summary>`, wrapping the existing document thumbnails. Drop the `priority={doc.title === 'License'}` the thumbnails carry today: a collapsed image must not compete with the hero, the page's only `priority` image;
  - the social buttons row.
- **Wrapper:** `px-4 py-12 sm:px-8` with an inner `mx-auto max-w-5xl grid gap-6`.

- [ ] **Step 4: Verify and commit**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`. Screenshot at 1440 (table) and 390 (stacked cards). The documents must be collapsed by default, and the page head must hold one image preload (`link[rel=preload][as=image]`), the hero's.

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/constants/comparison-slides.ts src/features/proposal-flow/lib/get-comparison-rows.ts src/features/proposal-flow/ui/components/proposal/comparison-list.tsx
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/features/proposal-flow/constants/comparison-slides.ts src/features/proposal-flow/lib/get-comparison-rows.ts src/features/proposal-flow/ui/components/proposal/comparison-list.tsx src/features/proposal-flow/ui/components/proposal/trusted-contractor.tsx <<'EOF'
feat(proposal-flow): trust is the meeting's contractor comparison, documents on demand

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these four files.

---

## Task 9: Past results chapter

**Files:**
- Create: `src/features/proposal-flow/constants/past-results.ts`
- Modify: `src/features/proposal-flow/ui/components/proposal/related-projects.tsx`

**Interfaces:**
- Consumes: `trpc.landingRouter.projectsRouter.getProjects` (public, returns `PublicProject[] = { project, heroImage }[]`), `OptimizedImage`, `ROOTS.landing.portfolioProject(accessor)`, `ROOTS.landing.portfolioProjects()`.
- Produces: `PAST_RESULTS_SHOWN`.

What waits for R6 (a portfolio read filtered by the proposal's trades): the spec's before/after cards and the "We've done this before" chip on each scope card. Both need a project matched to this proposal, so neither is built here. Until then the chapter shows the first public projects with a hero image.

- [ ] **Step 1: Rewrite the chapter**

```ts
// src/features/proposal-flow/constants/past-results.ts
// Until the portfolio read can filter by trade, the first public projects stand in.
export const PAST_RESULTS_SHOWN = 3
```

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { PAST_RESULTS_SHOWN } from '@/features/proposal-flow/constants/past-results'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

export function RelatedProjects() {
  const trpc = useTRPC()
  const projects = useQuery(trpc.landingRouter.projectsRouter.getProjects.queryOptions())
  const rows = (projects.data ?? []).filter(r => r.heroImage).slice(0, PAST_RESULTS_SHOWN)

  return (
    <div className="px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Past results</p>
          <h2 id="related-projects-title" className="text-3xl font-semibold text-balance">Work we’ve finished for your neighbors</h2>
        </header>
        {/* A homeowner never meets an empty chapter: with nothing to show, one line points at the portfolio. */}
        {projects.isSuccess && rows.length === 0
          ? (
              <p className="text-muted-foreground">
                {'Browse our finished projects in the '}
                <Link href={ROOTS.landing.portfolioProjects()} target="_blank" className="font-semibold text-foreground underline underline-offset-4">portfolio</Link>
                .
              </p>
            )
          : (
              <ul className="grid gap-4 @min-[700px]/proposal:grid-cols-3">
                {rows.map(({ project, heroImage }) => (
                  <li key={project.id}>
                    <Link href={ROOTS.landing.portfolioProject(project.accessor)} target="_blank" className="grid gap-2">
                      <div className="relative aspect-4/3 overflow-hidden rounded-lg bg-muted">
                        {heroImage && <OptimizedImage file={heroImage} alt={project.title} fill sizes="(max-width: 700px) 100vw, 33vw" />}
                      </div>
                      <p className="font-bold">{project.title}</p>
                      <p className="text-sm text-muted-foreground">{[project.city, project.state].filter(Boolean).join(', ')}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
      </div>
    </div>
  )
}
```

Remove the seed import (`@/shared/db/seeds/data/projects`) and `PROJECT_TYPES`. If `constants/project-types.ts` has no other importers, `git rm --` it.

- [ ] **Step 2: Verify and commit**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`; screenshot at 1440 and 390. Then answer `getProjects` with an empty list through `page.route` and screenshot again: the heading and the one portfolio line, no empty grid.

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/constants/past-results.ts
```

Then, in a Bash call that starts with `git commit` (timeout 300000). Add `src/features/proposal-flow/constants/project-types.ts` to the pathspec if it was removed:

```bash
git commit -F - -- src/features/proposal-flow/constants/past-results.ts src/features/proposal-flow/ui/components/proposal/related-projects.tsx <<'EOF'
feat(proposal-flow): past results come from the public portfolio, not a seed

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these files.

---

## Task 10: Next steps chapter

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/next-steps.tsx`
- Modify: `src/features/proposal-flow/constants/proposal-steps.ts` (the agreement step's `Component` becomes `NextSteps`)
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx` (the agreement branch renders `<step.Component />`; `customizableSections` becomes `[]` and is removed with its import)

**Interfaces:**
- Consumes: `ContractStatusPanel` (`@/shared/components/contract-status-panel/ui/contract-status-panel`), `useProposalDocument()`.
- Produces: `NextSteps()`. The document **always** renders the homeowner contract view. Agents act in the cockpit (Task 13). It passes the proposal's own `proposal.token`, as `index.tsx` does today, not the URL token: an agent opening the page without `?token` still gets a working contract status read.

- [ ] **Step 1: Write the chapter**

```tsx
// src/features/proposal-flow/ui/components/proposal/next-steps.tsx
'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ContractStatusPanel } from '@/shared/components/contract-status-panel/ui/contract-status-panel'

export function NextSteps() {
  const { proposal } = useProposalDocument()
  return (
    <div className="bg-(--presentation-ground) px-4 py-12 text-on-media sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">Next steps</p>
          <h2 id="agreement-title" className="text-3xl font-semibold text-balance">Next steps</h2>
          <p className="text-on-media-muted">Here’s how we get your project started.</p>
        </header>
        <div className="rounded-lg bg-card p-5 text-card-foreground">
          <ContractStatusPanel
            proposalId={proposal.id}
            token={proposal.token ?? undefined}
            isAgent={false}
            customerAge={proposal.customer?.customerAge ?? null}
            envelopeDocumentIds={proposal.envelopeDocumentIds ?? null}
            proposalKind={proposal.kind}
            customerName={proposal.customer?.name ?? null}
            customerEmail={proposal.customer?.email ?? null}
            proposalStatus={proposal.status}
            proposalSentAt={proposal.sentAt}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire and verify**

Point the agreement step at `NextSteps`. Drop its `as unknown as` cast, since `NextSteps` takes no props. Simplify the `index.tsx` step map to `<step.Component />` for every step. Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`.

- [ ] **Step 3: Commit**

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/ui/components/proposal/next-steps.tsx
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/features/proposal-flow/ui/components/proposal/next-steps.tsx src/features/proposal-flow/constants/proposal-steps.ts src/features/proposal-flow/ui/components/proposal/index.tsx <<'EOF'
feat(proposal-flow): the closing chapter is Next steps in the homeowner's words

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these three files.

---

## Task 11: `OverviewCard` and the overview cards generalized

**Files:**
- Create: `src/shared/components/entities/overview-card/overview-card.tsx`
- Create: `src/shared/modules/customers/core/constants/presentable-insight-fields.ts`
- Modify: `src/shared/modules/proposals/core/components/overview-card.tsx`
- Modify: `src/shared/entities/customers/components/overview-card.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-key-insights.tsx`
- Modify: `src/shared/entities/meetings/components/overview-card.tsx` (shared with other plans: read it first and merge)

**Interfaces:**
- Consumes: `useCustomerActionsHost(consumer)` (`@/shared/modules/customers/core/components/customer-actions-host`), `withToolbarRoles` (`@/shared/components/entities/entity-actions/lib/with-toolbar-roles`), `EntityActionMenu` (its `toolbar` mode renders the click action flagged `primary` as a filled button, those flagged `promoted` as outline buttons, the rest under "More").
- Produces:

```tsx
OverviewCard({ className, children })                          // the outer surface
OverviewCard.Header({ icon, eyebrow, title, subtitle, actions, className })
OverviewCard.Body({ className, children })
OverviewCard.Section({ label, children, className })
OverviewCard.Footer({ className, children })
```

- `ProposalOverviewCard.Actions` accepts `mode?: 'compact' | 'bar' | 'toolbar'`, `roles?: Parameters<typeof withToolbarRoles>[1]` (this surface's toolbar buttons) and `hide?: readonly string[]` (action ids left out on this surface). `MeetingOverviewCard.Actions` accepts `mode?: 'compact' | 'bar' | 'toolbar'`. `ProposalOverviewCard` also gains `Footer` (an alias of `OverviewCard.Footer` that stops click propagation). Both cards keep reading their action host; nothing about the hosts changes.
- `CustomerOverviewCard` gains:
  - `Actions({ mode, hide, className })`, which reads `useCustomerActionsHost('CustomerOverviewCard').actions`. The card's root reads no host, so the root's requirements are unchanged;
  - `Notes({ notes, limit })`;
  - `Insights({ fields })`: the existing part, with an optional `fields` list passed to `CustomerProfileKeyInsights`.
- `CustomerProfileKeyInsights({ customer, fields })`, `KeyInsightField = 'triggerEvent' | 'decisionTimeline' | 'outcomePriority' | 'householdType' | 'timeInHome' | 'yearBuilt'`. With no `fields`, it shows today's four, in today's order.
- `PRESENTABLE_INSIGHT_FIELDS = ['timeInHome', 'yearBuilt', 'outcomePriority', 'decisionTimeline'] as const satisfies readonly KeyInsightField[]`.

- [ ] **Step 1: The primitive**

```tsx
// src/shared/components/entities/overview-card/overview-card.tsx
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

function Root({ className, children }: { className?: string, children: ReactNode }) {
  return <div className={cn('overflow-hidden rounded-lg border border-border bg-card text-card-foreground', className)}>{children}</div>
}

interface HeaderProps {
  icon?: ReactNode
  eyebrow?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}

function Header({ icon, eyebrow, title, subtitle, actions, className }: HeaderProps) {
  return (
    <div className={cn('flex items-start gap-3 border-b border-border px-4 py-3', className)}>
      {icon && <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted">{icon}</div>}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>}
        <div className="truncate font-bold">{title}</div>
        {subtitle && <div className="text-xs text-muted-foreground">{subtitle}</div>}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}

function Body({ className, children }: { className?: string, children: ReactNode }) {
  return <div className={cn('grid gap-3 px-4 py-3', className)}>{children}</div>
}

function Section({ label, className, children }: { label: ReactNode, className?: string, children: ReactNode }) {
  return (
    <section className={cn('grid gap-1.5', className)}>
      <h4 className="text-xs font-bold text-foreground">{label}</h4>
      {children}
    </section>
  )
}

function Footer({ className, children }: { className?: string, children: ReactNode }) {
  return <div className={cn('flex flex-wrap items-center gap-2 border-t border-border bg-band px-4 py-3', className)}>{children}</div>
}

export const OverviewCard = Object.assign(Root, { Header, Body, Section, Footer })
```

- [ ] **Step 2: Proposal and meeting cards accept toolbar mode and a footer**

In `MeetingOverviewCard`, widen the `Actions` prop type to `mode?: 'compact' | 'bar' | 'toolbar'`. `EntityActionMenu` already renders `toolbar`.

In `ProposalOverviewCard`, replace `Actions` and add `Footer`:

```tsx
import { withToolbarRoles } from '@/shared/components/entities/entity-actions/lib/with-toolbar-roles'
import { OverviewCard } from '@/shared/components/entities/overview-card/overview-card'

function Actions({
  mode = 'compact',
  roles,
  hide,
  className,
}: {
  mode?: 'compact' | 'bar' | 'toolbar'
  /** This surface's toolbar buttons; the shared action constants keep driving every other surface. */
  roles?: Parameters<typeof withToolbarRoles>[1]
  /** Action ids this surface leaves out. */
  hide?: readonly string[]
  className?: string
}) {
  const { proposal, actions } = useProposalOverviewCard()
  const shown = useMemo(() => {
    const kept = hide ? actions.filter(config => !hide.includes(config.action.id)) : actions
    return roles ? withToolbarRoles(kept, roles) : kept
  }, [actions, hide, roles])
  return (
    <EntityActionMenu
      entity={proposal}
      actions={shown}
      mode={mode}
      className={className}
    />
  )
}

// Footers hold inputs and buttons; a click there must not open the proposal.
function Footer({ className, children }: { className?: string, children: ReactNode }) {
  return <div onClick={e => e.stopPropagation()}><OverviewCard.Footer className={className}>{children}</OverviewCard.Footer></div>
}
```

Then add `Footer` to the compound export. Existing callsites pass neither `roles` nor `hide`, so they are unchanged. Pass `roles` and `hide` as module constants (Task 13 puts them in `constants/cockpit-actions.ts`), so `useMemo` keeps its result between renders.

- [ ] **Step 3: Presentable insights**

`CustomerOverviewCard.Insights` already renders `CustomerProfileKeyInsights` (`src/shared/entities/customers/components/profile/customer-profile-key-insights.tsx`), which shows `triggerEvent`, `decisionTimeline`, `outcomePriority` and `householdType`. The cockpit reuses it with a field list instead of a second chip component. Give it an optional `fields` prop and teach it the two property fields the cockpit shows (`timeInHome`, `yearBuilt`, both enum columns on `customer_profiles`). Its three callers (`overview-card.tsx`, `customer-profile-phone-hero.tsx`, `customer-profile-rail.tsx`) pass no `fields` and render as before.

```tsx
// src/shared/entities/customers/components/profile/customer-profile-key-insights.tsx
'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'

import { Badge } from '@/shared/components/ui/badge'

export type KeyInsightField = 'triggerEvent' | 'decisionTimeline' | 'outcomePriority' | 'householdType' | 'timeInHome' | 'yearBuilt'

interface Props {
  customer: Pick<CustomerWithProfile, KeyInsightField> | null | undefined
  fields?: readonly KeyInsightField[]
}

function formatInsight(field: KeyInsightField, value: string): string {
  switch (field) {
    case 'outcomePriority':
      return `Priority: ${value}`
    case 'timeInHome':
      return `${value} in home`
    case 'yearBuilt':
      return `Built ${value}`
    default:
      return value
  }
}

export function CustomerProfileKeyInsights({ customer, fields = ['triggerEvent', 'decisionTimeline', 'outcomePriority', 'householdType'] }: Props) {
  if (!customer) {
    return null
  }

  const insights = fields.flatMap((field) => {
    const value = customer[field]
    return value != null ? [formatInsight(field, String(value))] : []
  })

  if (insights.length === 0) {
    return null
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {insights.map(insight => (
        <Badge key={insight} variant="secondary" className="text-xs">
          {insight}
        </Badge>
      ))}
    </div>
  )
}
```

Run `pnpm tsc` right after this edit: widening the `Pick` to `timeInHome` and `yearBuilt` must still accept what the three callers pass (each passes a `CustomerWithProfile`-shaped row, which carries every profile column).

```ts
// src/shared/modules/customers/core/constants/presentable-insight-fields.ts
import type { KeyInsightField } from '@/shared/entities/customers/components/profile/customer-profile-key-insights'

// Shown with the homeowner looking at the screen: never household type, nor the trigger event, whose "Selling soon" reveals a selling plan.
export const PRESENTABLE_INSIGHT_FIELDS = ['timeInHome', 'yearBuilt', 'outcomePriority', 'decisionTimeline'] as const satisfies readonly KeyInsightField[]
```

New customers code goes in `modules/customers/core/`, which already holds `customer-actions-host.tsx` and `open-customer-profile.ts`.

- [ ] **Step 4: The customer card gains actions, notes and a field list for insights**

In `src/shared/entities/customers/components/overview-card.tsx`, add three things and leave `Root`, its context and `ContactActions` / `LeadSource` / `ProfileFields` as they are. No action configs and no `DeleteConfirmDialog` go into the card: `CustomerActionsHost` already runs `useCustomerActionConfigs` and renders the dialog, and only `Actions` reads it, so the root still mounts without a host.

```tsx
function Actions({ mode = 'compact', hide, className }: {
  mode?: 'compact' | 'bar' | 'toolbar'
  /** Action ids this surface leaves out. */
  hide?: readonly string[]
  className?: string
}) {
  const { customer } = useCard()
  const { actions } = useCustomerActionsHost('CustomerOverviewCard')
  const shown = useMemo(() => (hide ? actions.filter(config => !hide.includes(config.action.id)) : actions), [actions, hide])
  return <EntityActionMenu entity={customer} actions={shown} mode={mode} className={className} />
}

function Notes({ notes, limit = 2 }: { notes: CustomerNoteWithAuthor[], limit?: number }) {
  const { customer } = useCard()
  return (
    <div className="grid gap-2">
      <ul className="grid gap-2">
        {notes.slice(0, limit).map(note => (
          <li key={note.id} className="border-t border-border pt-2 text-sm first:border-t-0 first:pt-0">
            <p>{note.content}</p>
            <p className="text-xs text-muted-foreground">{[note.authorName, formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })].filter(Boolean).join(' · ')}</p>
          </li>
        ))}
      </ul>
      {/* createNote already invalidates this customer's profile read, which is where `notes` comes from. */}
      <QuickNoteInput customerId={customer.id} onSuccess={() => {}} />
    </div>
  )
}
```

and change the existing `Insights` part to pass a field list through:

```tsx
function Insights({ fields }: { fields?: readonly KeyInsightField[] }) {
  const { customer } = useCard()
  return <CustomerProfileKeyInsights customer={customer} fields={fields} />
}
```

The imports this needs:
- `useMemo` from `react` (next to `createContext`, `use`);
- `formatDistanceToNow` from `date-fns`;
- `EntityActionMenu` (`@/shared/components/entities/entity-actions/ui/entity-action-menu`);
- `QuickNoteInput` (`@/shared/entities/customers/components/timeline/quick-note-input`);
- `useCustomerActionsHost` (`@/shared/modules/customers/core/components/customer-actions-host`);
- the `KeyInsightField` type (from `customer-profile-key-insights.tsx`) and the `CustomerNoteWithAuthor` type (`@/shared/entities/customers/types`).

`QuickNoteInput`'s `createNote` (`useCustomerNoteActions`) invalidates `cross.customerProfile(customerId)`, the `getCustomerProfile` query the cockpit holds, so the new note appears with no extra wiring. Add `Actions` and `Notes` to the compound export.

`CustomerOverviewCard` has no other callsite (the records meeting-row customer pane was removed by the owner on 2026-10-01), so the cockpit is its only consumer. Confirm with `grep -rn "CustomerOverviewCard" src` and `pnpm tsc`.

- [ ] **Step 5: Verify and commit**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`. Open the proposals table, a meeting card on the dashboard and a customer profile (whose rail and phone hero render `CustomerProfileKeyInsights`), and screenshot each at 1440: all must look unchanged.

```bash
git diff --cached --name-status
git add -- src/shared/components/entities/overview-card/overview-card.tsx src/shared/modules/customers/core/constants/presentable-insight-fields.ts
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/shared/components/entities/overview-card/overview-card.tsx src/shared/modules/customers/core/constants/presentable-insight-fields.ts src/shared/modules/proposals/core/components/overview-card.tsx src/shared/entities/customers/components/overview-card.tsx src/shared/entities/customers/components/profile/customer-profile-key-insights.tsx src/shared/entities/meetings/components/overview-card.tsx <<'EOF'
feat(entities): a shared OverviewCard frame; overview cards gain toolbar actions, footers and customer notes

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these six files.

---

## Task 12: "View internal financials" and "Copy scope of work" proposal actions

**Files:**
- Modify: `src/shared/modules/proposals/core/constants/actions.ts`
- Modify: `src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts` (shared with other plans: read it first and merge)

The card's root takes no new prop: `ProposalOverviewCard` reads its actions from `useProposalActionsHost('ProposalOverviewCard')`, and `ProposalActionsHost({ overrides })` passes `overrides` straight into `useProposalActionConfigs`. A host that wants these actions passes the overrides (Task 13).

**Interfaces:**
- Produces: `PROPOSAL_ACTIONS.internalFinancials` and `PROPOSAL_ACTIONS.copySow`. `ProposalActionOverrides` gains `onInternalFinancials?: (entity: T) => void` and `onCopySow?: (entity: T) => void`; `useProposalActionConfigs` includes each action only when its override is passed. `ProposalActionsHost`'s `overrides` prop (typed `Parameters<typeof useProposalActionConfigs>[0]`) accepts both with no change to the host.

- [ ] **Step 1: The action constants**

Add to `PROPOSAL_ACTIONS`, after `edit`, and add `CalculatorIcon` and `ClipboardCopyIcon` to the `lucide-react` import:

```ts
internalFinancials: {
  id: 'internalFinancials',
  label: 'View Internal Financials',
  icon: CalculatorIcon,
  permission: ['update', 'Proposal'],
},
copySow: {
  id: 'copySow',
  label: 'Copy Scope of Work',
  icon: ClipboardCopyIcon,
  permission: ['update', 'Proposal'],
},
```

`CopyIcon` is already Duplicate's icon, hence the clipboard one.

- [ ] **Step 2: The config entries**

In `ProposalActionOverrides` add:

```ts
onInternalFinancials?: (entity: T) => void
onCopySow?: (entity: T) => void
```

In the configs array passed to `useStableCallbacks`, after the `edit` entry:

```ts
...(overrides.onInternalFinancials
  ? [{ action: PROPOSAL_ACTIONS.internalFinancials, onAction: overrides.onInternalFinancials }]
  : []),
...(overrides.onCopySow
  ? [{ action: PROPOSAL_ACTIONS.copySow, onAction: overrides.onCopySow }]
  : []),
```

The entity carries only `{ id, token }`, so the handlers close over what they need (the funding inputs, the scope of work): a host that holds that data passes them, and every other host shows neither action.

- [ ] **Step 3: Verify and commit**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`. Open the proposals table's row menu: no "View Internal Financials" and no "Copy Scope of Work", because no host there passes the overrides.

```bash
git diff --cached --name-status
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/shared/modules/proposals/core/constants/actions.ts src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts <<'EOF'
feat(proposals): View Internal Financials and Copy Scope of Work, actions a host can offer

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these two files.

---

## Task 13: The cockpit

**Files:**
- Create: `src/features/proposal-flow/constants/cockpit-actions.ts`
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit-proposal-card.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/send-composer.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit-agreement-card.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit-customer-card.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit-meeting-card.tsx`
- Modify: `src/shared/components/dialogs/sheets/responsive-sheet.tsx` (optional `bodyClassName`)
- Modify: `src/shared/components/entities/entity-actions/lib/with-toolbar-roles.ts` (optional `primaryId`; 3 existing callers unchanged)
- Modify: `src/shared/components/contract-status-panel/ui/envelope-card.tsx` (optional `className`; shared with `AgentContractView`)
- Modify: `src/shared/components/contract-status-panel/ui/envelope-configuration-section.tsx` (switch rows; shared with `AgentContractView`)
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`

**Interfaces:**
- Consumes:
  - `ResponsiveSheet` (`@/shared/components/dialogs/sheets/responsive-sheet`);
  - `ProposalActionsHost` (`@/shared/modules/proposals/core/components/proposal-actions-host`), `MeetingActionsHost` (`@/shared/modules/meetings/core/components/meeting-actions-host`), `CustomerActionsHost` (`@/shared/modules/customers/core/components/customer-actions-host`);
  - `ProposalOverviewCard` (with `Footer`, `Actions` `mode="toolbar"`, `roles`, `hide`), `CustomerOverviewCard` (`Actions`, `Notes`, `Insights fields`), `MeetingOverviewCard`, `OverviewCard` (Task 11), the `onInternalFinancials` / `onCopySow` overrides (Task 12);
  - `AgreementTimeline` (`@/shared/components/contract-status-panel/ui/agreement-timeline`), `deriveTimelineState` (`@/shared/components/contract-status-panel/lib/derive-timeline-state`), `EnvelopeCard` (`@/shared/components/contract-status-panel/ui/envelope-card`), `useContractStatus` (`@/shared/components/contract-status-panel/hooks/use-contract-status`);
  - `useSendProposal`, `InternalFinancialsModal`, `openModal` (`@/shared/lib/open-modal`), `openCustomerProfile` (`@/shared/modules/customers/core/lib/open-customer-profile`), `CreateMeetingModal`, `copyToClipboard`, `sowToPlaintext`, `toFundingInputs`, `isProposalFrozen`;
  - `trpc.customerPipelinesRouter.getCustomerProfile`.
- Produces: `Cockpit({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void })`; `ResponsiveSheet` gains `bodyClassName?: string`; `EnvelopeCard` gains `className?: string`.

- [ ] **Step 1: The send composer**

`sendProposalEmail`'s input is `{ proposalId, customerName, email, message? }` (`src/trpc/routers/proposals.router/delivery.router.ts`, `sendEmailSchema`): the server builds the link from the proposal's own token, never one the caller supplies, so the composer sends no token.

```tsx
// src/features/proposal-flow/ui/components/cockpit/send-composer.tsx
'use client'

import { useState } from 'react'
import { toast } from 'sonner'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { Button } from '@/shared/components/ui/button'
import { Textarea } from '@/shared/components/ui/textarea'
import { useSendProposal } from '@/shared/modules/proposals/core/hooks/use-send-proposal'

export function SendComposer() {
  const { proposal } = useProposalDocument()
  const [message, setMessage] = useState('')
  const send = useSendProposal()
  const isSent = proposal.status === 'sent'
  const email = proposal.customer?.email ?? null

  function submit() {
    if (!email) {
      return
    }
    send.mutate(
      { proposalId: proposal.id, customerName: proposal.customer?.name ?? '', email, message: message.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(isSent ? 'Proposal resent' : 'Proposal sent')
          setMessage('')
        },
        onError: () => toast.error('Couldn’t send the proposal'),
      },
    )
  }

  return (
    <div className="grid w-full gap-2">
      <Textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={`A note for ${proposal.customer?.name?.split(' ')[0] ?? 'the homeowner'} (optional)`} rows={3} />
      <div className="flex justify-end">
        <Button size="sm" onClick={submit} disabled={!email || send.isPending}>
          {isSent ? (message.trim() ? 'Resend with note' : 'Resend') : 'Send'}
        </Button>
      </div>
      {!email && <p className="text-xs text-muted-foreground">Add the customer’s email to send.</p>}
    </div>
  )
}
```

The router sets `status: 'sent'` on every send, so the Proposal card renders the composer only for a `draft` or `sent` proposal that is not frozen (Step 2). An approved or declined proposal never shows it.

- [ ] **Step 2: The cockpit's action lists and the proposal card**

Spec D9 wants copy link, send and the deal controls one tap away, and everything else behind overflow. `EntityActionMenu`'s `toolbar` mode shows the click action flagged `primary` as a filled button, the ones flagged `promoted` as outline buttons, and the rest under "More". The shared `PROPOSAL_ACTIONS` flag only `view` as primary, and that drives every other surface, so the cockpit sets its own roles with `withToolbarRoles`, the way `meeting-row-action-bar.tsx` does. **Owner ruling (2026-10-15): Send is the card's one primary.** Send/Resend in the composer below the toolbar stays filled; Copy Link (Email) and Edit are outline buttons, and nothing in the toolbar takes the filled style. View and Delete are hidden here: the card's root click already runs View (a no-op on this page), and deleting the open proposal would leave a dead page. In the customer card, Edit is hidden (the profile edits contact fields inline, so it would only repeat View) and so is Delete.

`withToolbarRoles` (`src/shared/components/entities/entity-actions/lib/with-toolbar-roles.ts`) requires a `primaryId` today. Make it optional: in its `ToolbarRoles` interface, `primaryId: string` becomes `primaryId?: string`. The body already compares `config.action.id === primaryId`, so an omitted id marks nothing primary, and its three existing callers are unchanged.

```ts
// src/features/proposal-flow/constants/cockpit-actions.ts
// One tap for what an agent does mid-presentation; the rest stays under More. No primary: the composer's Send is the card's one filled button.
export const COCKPIT_PROPOSAL_TOOLBAR = { promotedIds: ['shareByEmail', 'edit'] } as const

export const COCKPIT_PROPOSAL_HIDDEN_ACTIONS = ['view', 'delete'] as const

export const COCKPIT_CUSTOMER_HIDDEN_ACTIONS = ['edit', 'delete'] as const
```

`ProposalOverviewCard.Actions` drops the hidden ids, then applies the roles; with no `primaryId`, `EntityActionMenu` renders no filled button. The proposal toolbar then reads: "Copy Link (Email)" (outline), "Edit Proposal" (outline), and "More" holding Copy Link (SMS), View Internal Financials, Copy Scope of Work, Duplicate and Assign Rep, each still behind its CASL permission.

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit-proposal-card.tsx
'use client'

import { COCKPIT_PROPOSAL_HIDDEN_ACTIONS, COCKPIT_PROPOSAL_TOOLBAR } from '@/features/proposal-flow/constants/cockpit-actions'
import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ProposalOverviewCard } from '@/shared/modules/proposals/core/components/overview-card'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'
import { isProposalFrozen } from '@/shared/modules/proposals/core/lib/proposal-lock'
import { SendComposer } from './send-composer'

export function CockpitProposalCard() {
  const { proposal } = useProposalDocument()
  const funding = toFundingInputs(proposal)
  // A send stamps status 'sent', so it would reopen an approved or declined proposal; a frozen one is in its agreement.
  const canSend = (proposal.status === 'draft' || proposal.status === 'sent') && !isProposalFrozen(proposal)

  return (
    <ProposalOverviewCard
      proposal={{
        id: proposal.id,
        token: proposal.token,
        status: proposal.status,
        label: proposal.label,
        createdAt: proposal.createdAt,
        sentAt: proposal.sentAt,
        value: computeFinalTcp({ funding, sow: proposal.projectJSON.data.sow }),
      }}
      className="overflow-hidden rounded-lg border border-border bg-card"
    >
      <ProposalOverviewCard.Header className="border-b border-border px-4 py-3">
        <ProposalOverviewCard.StatusIconTile />
        <div className="min-w-0 flex-1">
          <ProposalOverviewCard.Label />
          <ProposalOverviewCard.Fields fields={[{ field: 'status', variant: 'badge' }, { field: 'value' }, { field: 'createdAt', format: 'date-only' }]} />
        </div>
      </ProposalOverviewCard.Header>
      <ProposalOverviewCard.Body className="px-4 py-3">
        <ProposalOverviewCard.Actions mode="toolbar" roles={COCKPIT_PROPOSAL_TOOLBAR} hide={COCKPIT_PROPOSAL_HIDDEN_ACTIONS} />
      </ProposalOverviewCard.Body>
      {canSend && (
        <ProposalOverviewCard.Footer>
          <SendComposer />
        </ProposalOverviewCard.Footer>
      )}
    </ProposalOverviewCard>
  )
}
```

The card reads its actions from the `ProposalActionsHost` the cockpit mounts (Step 5); "View Internal Financials" and "Copy Scope of Work" appear because that host passes their overrides. With `primaryId` optional, `withToolbarRoles` types its roles as `{ primaryId?: string, promotedIds?: readonly string[] }`, which the `as const` object satisfies. Check the exact props of `StatusIconTile`, `Label` and `Fields` in `overview-card.tsx` and match the existing callers (for example `dashboard-proposal-card.tsx:31`). The view count needs `viewCount` on the data, which `getFullView` doesn't carry, so leave it out.

- [ ] **Step 3: The agreement card**

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit-agreement-card.tsx
'use client'

import { FileSignatureIcon } from 'lucide-react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useContractStatus } from '@/shared/components/contract-status-panel/hooks/use-contract-status'
import { deriveTimelineState } from '@/shared/components/contract-status-panel/lib/derive-timeline-state'
import { AgreementTimeline } from '@/shared/components/contract-status-panel/ui/agreement-timeline'
import { EnvelopeCard } from '@/shared/components/contract-status-panel/ui/envelope-card'
import { OverviewCard } from '@/shared/components/entities/overview-card/overview-card'

export function CockpitAgreementCard() {
  const { proposal } = useProposalDocument()
  const { data: contractStatus } = useContractStatus(proposal.id, proposal.token ?? undefined)
  return (
    <OverviewCard>
      <OverviewCard.Header icon={<FileSignatureIcon className="size-4" />} eyebrow="Agreement" title={proposal.kind === 'initial-sale' ? 'Initial sale' : 'Additional work'} />
      <OverviewCard.Body>
        <AgreementTimeline steps={deriveTimelineState(contractStatus ?? null)} />
        <EnvelopeCard
          proposalId={proposal.id}
          contractStatus={contractStatus ?? null}
          customerName={proposal.customer?.name ?? null}
          proposalKind={proposal.kind}
          className="rounded-none border-0 bg-transparent p-0 sm:p-0"
        />
      </OverviewCard.Body>
    </OverviewCard>
  )
}
```

The timeline is the same `AgreementTimeline` the homeowner view renders (`homeowner-contract-view.tsx`, fed by `deriveTimelineState`). `EnvelopeCard` carries the signer grid, the envelope-configuration switches (required documents locked), the age input and the Create draft, Submit, Recall, Discard and Resend actions; its logic is not forked.

**`EnvelopeCard`'s own frame.** Its root is a bordered card of its own (`rounded-lg border border-border bg-card p-4 sm:p-5`), which would sit as a second frame inside `OverviewCard.Body`. Give it an optional `className` merged onto that root, and let the cockpit flatten it. In `src/shared/components/contract-status-panel/ui/envelope-card.tsx`, add `className?: string` to `EnvelopeCardProps`, destructure it, and change the root to:

```tsx
<div className={cn('rounded-lg border border-border bg-card p-4 sm:p-5', className)}>
```

(`cn` is already imported there). `AgentContractView` passes no `className` and renders as before.

**Tighten the switch rows (D14) without shrinking the target (§4.8).** In `src/shared/components/contract-status-panel/ui/envelope-configuration-section.tsx`, the documents list is `ul className="flex flex-col gap-2"` and each row `li className="flex items-center justify-between gap-3"` with no height. Tighten the gaps, not the row: the list becomes `flex flex-col gap-0`, each row `flex min-h-11 items-center justify-between gap-3`, and the row's `Label` gains `self-stretch` (it is already `flex items-center` and `htmlFor` the switch), so the whole 44px row toggles. Read the file and change only those three class lists.

- [ ] **Step 4: The customer and meeting cards**

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit-customer-card.tsx
'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { UserIcon } from 'lucide-react'
import { COCKPIT_CUSTOMER_HIDDEN_ACTIONS } from '@/features/proposal-flow/constants/cockpit-actions'
import { OverviewCard } from '@/shared/components/entities/overview-card/overview-card'
import { CustomerOverviewCard } from '@/shared/entities/customers/components/overview-card'
import { PRESENTABLE_INSIGHT_FIELDS } from '@/shared/modules/customers/core/constants/presentable-insight-fields'

export function CockpitCustomerCard({ profile }: { profile: CustomerProfileData }) {
  return (
    <OverviewCard>
      <CustomerOverviewCard customer={profile.customer} className="gap-0">
        <OverviewCard.Header
          icon={<UserIcon className="size-4" />}
          eyebrow="Customer"
          title={profile.customer.name}
          actions={<CustomerOverviewCard.Actions mode="compact" hide={COCKPIT_CUSTOMER_HIDDEN_ACTIONS} />}
        />
        <OverviewCard.Body>
          <CustomerOverviewCard.ContactActions />
          <CustomerOverviewCard.Insights fields={PRESENTABLE_INSIGHT_FIELDS} />
          <OverviewCard.Section label="Notes">
            <CustomerOverviewCard.Notes notes={profile.notes} />
          </OverviewCard.Section>
        </OverviewCard.Body>
      </CustomerOverviewCard>
    </OverviewCard>
  )
}
```

`ContactActions` gives one-tap call, text and email (spec D9); a gated phone arrives as `null` and its row is simply absent.

`MeetingOverviewCard` takes no `customerId` prop: `customerId` is a field of `MeetingOverviewCardData`, and a `CustomerProfileMeeting` carries it. Its actions come from the `MeetingActionsHost` the cockpit mounts, whose default View opens the customer profile on its Meetings tab.

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit-meeting-card.tsx
'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'

export function CockpitMeetingCard({ meeting }: { meeting: CustomerProfileMeeting }) {
  return (
    <MeetingOverviewCard meeting={meeting} className="overflow-hidden rounded-lg border border-border bg-card">
      <MeetingOverviewCard.Header className="border-b border-border px-4 py-3">
        <MeetingOverviewCard.Fields fields={[{ field: 'scheduledDate' }, { field: 'type' }]} />
        <MeetingOverviewCard.Actions mode="compact" className="ml-auto" />
      </MeetingOverviewCard.Header>
      <MeetingOverviewCard.Body className="px-4 py-3">
        <MeetingOverviewCard.Fields fields={[{ field: 'outcome', variant: 'editable' }]} />
      </MeetingOverviewCard.Body>
    </MeetingOverviewCard>
  )
}
```

`customer-meetings-list.tsx:81` already passes a `CustomerProfileMeeting` straight into `MeetingOverviewCard`, so the types line up.

- [ ] **Step 5: The cockpit sheet**

**The sheet's one scroller.** `ResponsiveSheet` already owns the scrolling body on both sides of the breakpoint (`min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-gutter-stable px-4 …`), so the cockpit must not nest a second scroller. D21 (no visible scrollbar) is met by letting the caller add classes to that body. In `src/shared/components/dialogs/sheets/responsive-sheet.tsx`, add to `ResponsiveSheetProps`:

```ts
  /** Classes for the scrolling body on both sides of the breakpoint. */
  bodyClassName?: string
```

destructure it, and give both body `div`s a `data-slot` and the merged classes:

```tsx
<div data-slot="responsive-sheet-body" className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-gutter-stable px-4', footer === undefined ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : 'pb-4', bodyClassName)}>{children}</div>
```

```tsx
<div data-slot="responsive-sheet-body" className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-gutter-stable px-4 pb-4', bodyClassName)}>{children}</div>
```

The cockpit passes `bodyClassName="scrollbar-none"`, the existing utility in `globals.css` (`scrollbar-width: none` plus the WebKit `display: none`). The five other `ResponsiveSheet` callers pass nothing and are unchanged. Task 15 measures this element.

**The hosts.** Every cockpit card reads an action host and throws without one, so the cockpit body is wrapped in all three. The proposal host's `onView` is a no-op: the page *is* the proposal, and the card's root click runs View. Internal Financials opens through `openModal` (`useModalStore` was deleted 2026-10-14), as `heading.tsx` does today. The customer profile opens with `openCustomerProfile`; both open as modal layers above the sheet.

**The profile read.** `getCustomerProfile` is the heaviest read here (the customer, profile, attribution, enrichment, meetings with proposals, notes, projects), so it runs only while the cockpit is open. It answers `NOT_FOUND` when the agent can't reach the customer; the cockpit then shows one line instead of the Customer and Meeting cards.

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit.tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { InternalFinancialsModal } from '@/features/proposal-flow/ui/components/internal-financials-modal'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { CreateMeetingModal } from '@/shared/entities/meetings/components/create-meeting-modal'
import { copyToClipboard } from '@/shared/lib/clipboard'
import { openModal } from '@/shared/lib/open-modal'
import { sowToPlaintext } from '@/shared/lib/tiptap-to-text'
import { CustomerActionsHost } from '@/shared/modules/customers/core/components/customer-actions-host'
import { openCustomerProfile } from '@/shared/modules/customers/core/lib/open-customer-profile'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
import { ProposalActionsHost } from '@/shared/modules/proposals/core/components/proposal-actions-host'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'
import { useTRPC } from '@/trpc/helpers'
import { CockpitAgreementCard } from './cockpit-agreement-card'
import { CockpitCustomerCard } from './cockpit-customer-card'
import { CockpitMeetingCard } from './cockpit-meeting-card'
import { CockpitProposalCard } from './cockpit-proposal-card'

interface Props { open: boolean, onOpenChange: (open: boolean) => void }

export function Cockpit({ open, onOpenChange }: Props) {
  const { proposal } = useProposalDocument()
  const trpc = useTRPC()
  const [scheduling, setScheduling] = useState<{ id: string, name: string } | null>(null)
  const customerId = proposal.customer?.id
  const profile = useQuery({
    ...trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId: customerId ?? '' }),
    enabled: open && Boolean(customerId),
  })
  const meeting = profile.data?.meetings.find(m => m.id === proposal.meetingId)

  const proposalOverrides = useMemo(() => ({
    // The page is the proposal, so View (and the card's click, which runs it) has nowhere to go.
    onView: () => {},
    onInternalFinancials: () => openModal({
      accessor: 'InternalFinancials',
      Component: InternalFinancialsModal,
      props: { funding: toFundingInputs(proposal), sow: proposal.projectJSON.data.sow, priceDisplayMode: proposal.priceDisplayMode },
    }),
    onCopySow: () => copyToClipboard(sowToPlaintext(proposal.projectJSON.data.sow), 'Scope of work'),
  }), [proposal])

  const customerOverrides = useMemo(() => ({
    onView: (customer: { id: string }) => openCustomerProfile({ customerId: customer.id }),
    onScheduleMeeting: (customer: { id: string, name: string }) => setScheduling({ id: customer.id, name: customer.name }),
  }), [])

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cockpit"
      description={[proposal.customer?.name, proposal.label].filter(Boolean).join(' · ')}
      sheetClassName="sm:max-w-[460px]"
      drawerClassName="max-h-[85dvh]"
      bodyClassName="scrollbar-none"
    >
      <ProposalActionsHost overrides={proposalOverrides}>
        <MeetingActionsHost>
          <CustomerActionsHost overrides={customerOverrides}>
            <div className="grid content-start gap-3 py-1">
              <CockpitProposalCard />
              <CockpitAgreementCard />
              {customerId && profile.isPending && (
                <>
                  <Skeleton className="h-48 rounded-lg" />
                  <Skeleton className="h-24 rounded-lg" />
                </>
              )}
              {profile.isError && <p className="text-sm text-muted-foreground">This customer’s profile isn’t available to you.</p>}
              {profile.data && <CockpitCustomerCard profile={profile.data} />}
              {profile.data && meeting && <CockpitMeetingCard meeting={meeting} />}
            </div>
            {scheduling && (
              <CreateMeetingModal
                isOpen
                customerId={scheduling.id}
                customerName={scheduling.name}
                onClose={() => setScheduling(null)}
              />
            )}
          </CustomerActionsHost>
        </MeetingActionsHost>
      </ProposalActionsHost>
    </ResponsiveSheet>
  )
}
```

`copyToClipboard(text, 'Scope of work')` toasts "Scope of work copied", or "Failed to copy scope of work", the same success/failure pair today's `CopySowButton` shows per section; the action copies every section at once (`sowToPlaintext` takes the whole list). Schedule Meeting uses `CreateMeetingModal` with local state, as `customer-pipeline-view.tsx` does: it takes `isOpen` / `onClose` props, so it is not an `openModal` descriptor.

- [ ] **Step 6: Mount it**

In `index.tsx`, inside the provider and the flex column from Task 2, render `{viewMode === 'agent' && <Cockpit open={cockpitOpen} onOpenChange={setCockpitOpen} />}`. The cockpit's body (and so its hosts and the profile read) mounts only while the sheet is open.

- [ ] **Step 7: Verify**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`. In the browser with `?view=agent`, collecting console errors:
- The cockpit opens with no console error (no card throws "needs a <…ActionsHost> above it").
- At 1180 the cockpit opens as a right sheet, the document dims and doesn't shift, and no scrollbar is visible.
- At 820 and 390 it opens as a bottom drawer.
- Focus returns to the Cockpit button on close.
- The proposal toolbar shows "Copy Link (Email)" and "Edit Proposal" as outline buttons and no `[data-toolbar-role=primary]` element; the composer's Send is the card's only filled button; "More" holds "View Internal Financials" and "Copy Scope of Work", and no "View Proposal" or "Delete".
- "View Internal Financials" opens the modal above the sheet; closing it leaves the sheet open.
- Clicking the Proposal card's body leaves the page where it is.
- The customer card's "More" holds "View Profile" and "Schedule Meeting" only.
- While the profile loads, two skeletons show; answering `getCustomerProfile` with `NOT_FOUND` through `page.route` shows the one "isn’t available" line and no error toast.
- On an `initial-sale` proposal the switches show required documents disabled, and each switch row is at least 44px tall.
- On an approved proposal (rewrite the captured `getFullView` through `page.route`: `status: 'approved'`), the send composer is absent.
- `AgentContractView` (the dashboard proposal page's agreement section) looks as before: screenshot it at 1440.

Intercept any send with `page.route` (never send email).

- [ ] **Step 8: Commit**

```bash
git diff --cached --name-status
git add -- src/features/proposal-flow/constants/cockpit-actions.ts src/features/proposal-flow/ui/components/cockpit/cockpit.tsx src/features/proposal-flow/ui/components/cockpit/cockpit-proposal-card.tsx src/features/proposal-flow/ui/components/cockpit/send-composer.tsx src/features/proposal-flow/ui/components/cockpit/cockpit-agreement-card.tsx src/features/proposal-flow/ui/components/cockpit/cockpit-customer-card.tsx src/features/proposal-flow/ui/components/cockpit/cockpit-meeting-card.tsx
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/features/proposal-flow/constants/cockpit-actions.ts src/features/proposal-flow/ui/components/cockpit/cockpit.tsx src/features/proposal-flow/ui/components/cockpit/cockpit-proposal-card.tsx src/features/proposal-flow/ui/components/cockpit/send-composer.tsx src/features/proposal-flow/ui/components/cockpit/cockpit-agreement-card.tsx src/features/proposal-flow/ui/components/cockpit/cockpit-customer-card.tsx src/features/proposal-flow/ui/components/cockpit/cockpit-meeting-card.tsx src/features/proposal-flow/ui/components/proposal/index.tsx src/shared/components/dialogs/sheets/responsive-sheet.tsx src/shared/components/entities/entity-actions/lib/with-toolbar-roles.ts src/shared/components/contract-status-panel/ui/envelope-card.tsx src/shared/components/contract-status-panel/ui/envelope-configuration-section.tsx <<'EOF'
feat(proposal-flow): an agent cockpit of entity cards in a responsive sheet

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: only these files.

---

## Task 14: Remove what the redesign replaced

**Files:**
- Delete: `src/features/proposal-flow/ui/components/proposal/heading.tsx`
- Delete: `src/features/proposal-flow/ui/components/proposal/copy-sow-button.tsx`
- Delete: `src/features/proposal-flow/ui/components/proposal/send-proposal-link.tsx`

- [ ] **Step 1: Confirm no importers, then delete**

```bash
grep -rn "from './heading'\|proposal/heading'\|copy-sow-button\|CopySowButton\|send-proposal-link" src
```

Expected: no matches, because Task 2 removed `<Heading />` and Task 4 removed `CopySowButton`. Copying the scope now lives in the cockpit's `copySow` action (Tasks 12–13), and Internal Financials and View Profile, `Heading`'s agent buttons, live in the cockpit too. Then:

```bash
git rm -- src/features/proposal-flow/ui/components/proposal/heading.tsx src/features/proposal-flow/ui/components/proposal/copy-sow-button.tsx src/features/proposal-flow/ui/components/proposal/send-proposal-link.tsx
```

- [ ] **Step 2: Check `useCurrentProposal` is the route host's feeder only**

```bash
grep -rn "useCurrentProposal" src
```

Expected: only `proposal/index.tsx` and the hook file. Anything else migrates to `useProposalDocument()` in this task, and joins this task's pathspec.

- [ ] **Step 3: Verify and commit**

Run `flock .superpowers/heavy.lock pnpm tsc` and `flock .superpowers/heavy.lock pnpm lint`.

```bash
git diff --cached --name-status
```

Then, in a Bash call that starts with `git commit` (timeout 300000):

```bash
git commit -F - -- src/features/proposal-flow/ui/components/proposal/heading.tsx src/features/proposal-flow/ui/components/proposal/copy-sow-button.tsx src/features/proposal-flow/ui/components/proposal/send-proposal-link.tsx <<'EOF'
refactor(proposal-flow): drop the heading, copy-SOW and dead send-link components

<Co-Authored-By line from the harness>
EOF
```

Then `git show --stat HEAD`: the three deletions only.

---

## Task 15: Browser verification (spec §7)

**Files:**
- Create (scratch, not committed): `.superpowers/sdd/2026-10-01-proposal-page/pw/verify.ts`

The script is TypeScript, run from the repo root with `flock .superpowers/heavy.lock pnpm exec tsx .superpowers/sdd/2026-10-01-proposal-page/pw/verify.ts`, so it can `import { chromium } from 'playwright'` and import the shipped helpers through the `@/` alias (`buildPricingBreakdown`, `toFundingInputs`), and `superjson` to read and rewrite tRPC bodies. It signs in through `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&redirect=…` (see `reference-playwright-auth.md`). It aborts `**/*recordView*` and intercepts every mutation (`**/proposalsRouter.funding.setCashInDeal**`, `**/proposalsRouter.crud.update**`, `**/proposalsRouter.delivery.**`, `**/customerNotesRouter.**`, `**/contracts.**` mutations) with a 200 and a captured response body. Screenshots go to `.superpowers/sdd/2026-10-01-proposal-page/pw/shots/`.

It runs against the owner's dev server on :3000 as it is: never stop, restart or clear it, and never `rm -rf .next`. If a class seems missing from the rendered page, `curl` the served CSS for it and put what you find in the report.

`getFullView` arrives in a batched superjson body. Reading it: find the entry whose path is `proposalsRouter.business.getFullView` and `superjson.deserialize` its `result.data`. Rewriting it (Steps 5 and 6): change the deserialized object, `superjson.serialize` it back into the same entry, and `route.fulfill` the whole batch.

- [ ] **Step 1: Layout at every viewport**

At 1440, 1180, 820, 390 and 360, light and dark (`emulateMedia({ colorScheme })`), assert:
- `document.documentElement.scrollWidth <= innerWidth` (no horizontal page scroll);
- the rail is visible at ≥1100 container width and hidden below;
- each tab's `scrollWidth <= clientWidth` (no cut-off labels) at 360.

Take a full-page screenshot per viewport and scheme.

- [ ] **Step 2: Cockpit**

At 1180, collecting console errors, click Cockpit and assert:
- no console error (every card found its action host);
- a `[role=dialog]` sits at the right edge;
- the document's `getBoundingClientRect().left` is unchanged;
- the sheet's scroller, `[data-slot=responsive-sheet-body]`, has `offsetWidth - clientWidth === 0` (no visible scrollbar), and no element inside it has a computed `overflow-y` of `auto` or `scroll` (no second scroller).

Press Escape and assert focus is on the Cockpit button. At 820 and 390, assert the drawer is anchored to the bottom.

- [ ] **Step 3: Modal layers over the cockpit**

At 1180 and again at 390, with the cockpit open:
- open "More" on the Proposal card and choose "View Internal Financials": a second `[role=dialog]` titled "Internal Financials" is on top; close it, and assert focus is back inside the sheet and the sheet is still open;
- open "More" on the Customer card and choose "View Profile": the customer profile opens above the sheet; close it, and assert the same.

Screenshot each modal over the sheet.

- [ ] **Step 4: Homeowner sees no agent controls, and gets no cost lines**

Load the page with the token and no `?view=agent`, in two contexts: logged out, and logged in as an agent. In each, assert that these return 0:
- `getByRole('button', { name: 'Cockpit' })` (the button is absent, so the cockpit cannot be opened);
- `getByText('View Internal Financials')`;
- `getByText('Copy Scope of Work')`;
- `getByRole('button', { name: /copy/i })` inside `#scope-of-work`;
- a `textarea` anywhere.

In the logged-out (share-link) context, also read the captured `getFullView` payload and assert, on the wire:
- every `projectJSON.data.sow[].financials.costLines` is an empty array;
- the payload has no `contractEnvelopeId`, `meetingId` or `ownerId` key (the bearer read rule doesn't list them).

- [ ] **Step 5: Pricing**

On a breakdown proposal and a total-mode proposal, read the "Final contract price" text and compare it with the value the shipped helpers compute from the captured payload: `buildPricingBreakdown({ funding: toFundingInputs(view), sow: view.projectJSON.data.sow, priceDisplayMode: view.priceDisplayMode }).finalTcp`, formatted with `formatAsDollars`. Never re-implement the sum in the script. On the total-mode page, assert no part row contains a `$` value.

- [ ] **Step 6: Slider, saves and the frozen lock**

At 1180:
- choose "Some cash";
- focus the slider thumb (`getByRole('slider', { name: 'Cash down' })`, which also proves the thumb is labelled) and press ArrowRight ten times;
- wait 1000ms and assert exactly one intercepted `setCashInDeal` request, with `cashInDeal === 5000`;
- assert that "to finance" changed and every monthly payment changed;
- press End and assert the shown maximum leaves ≥ $3,500 financed;
- choose "All finance", then "All cash", wait 1000ms, and assert no further `setCashInDeal` request (O1);
- arrow through three finance options and assert exactly one intercepted `crud.update` request, with the last option's id;
- reload with `getFullView` rewritten so `cashInDealCents` is `500000`: assert the page opens on "Some cash" with $5,000 down (the cash down survives a reload; the mode is inferred from it, not stored).

Then the frozen lock (Review Focus 6):
- reload with `getFullView` rewritten so `contractSentAt` is set: assert "These choices are in your agreement. Ask your consultant to change them." is visible, the slider and every radio are disabled, and pressing keys on the thumb sends no request;
- reload unfrozen, and answer `setCashInDeal` with a tRPC error (HTTP 412, body: the batched error envelope with `message: 'proposal_frozen'` and `data.code: 'PRECONDITION_FAILED'`, serialized with `superjson`); move the slider, wait 1000ms, and assert the lock line appears, the controls disable, and no toast is shown.

- [ ] **Step 7: Scope**

On a proposal whose sections include both description forms, assert:
- every phase row's step count is ≥ 1 (no "0 steps");
- the "Key details" `dl` exists;
- a section whose `contentJSON` fails to parse falls back to HTML. Simulate this by rewriting the captured `getFullView` response through `page.route` with one section's `contentJSON` set to `"x"`.

- [ ] **Step 8: Page height versus baseline**

Record `#proposal-container.scrollHeight` at 1440 and 390 and compare them with the baseline (9,932px and 16,055px). Report both numbers; the phone number should drop.

- [ ] **Step 9: Report**

Write `.superpowers/sdd/2026-10-01-proposal-page/verify.md`:
- one line per step: pass or fail, with the screenshot path;
- the page heights;
- anything skipped and why. No step may be skipped silently; a step that couldn't run is a fail with its reason.

Then hand off to the owner:
- the real-iPad touch check (F5);
- the R2–R7 hand-offs (R1 is live; Step 4 checked it on the wire).

Nothing is committed in this task.

---

## Self-review notes

- **Spec coverage:**

  | Spec | Task(s) |
  |---|---|
  | §2 D1–D3 | 2, 7, 10 |
  | §2 D4 | 7 |
  | §2 D5 | 8 |
  | §2 D6 | 7 (no "what you told us" block) |
  | §2 D7, D8, D17, D21 | 13 (`ResponsiveSheet` `bodyClassName="scrollbar-none"`, the three action hosts) |
  | §2 D9 | 13 (toolbar roles via `withToolbarRoles`, composer, contact) |
  | §2 D10 | 12–13 (`onInternalFinancials` on `ProposalActionsHost`, `openModal`) |
  | §2 D11 | 13 + Review Focus 1 |
  | §2 D12 | 13 (until R2) |
  | §2 D13–D14 | 13 (`AgreementTimeline`, `EnvelopeCard` `className`, switch rows `gap-0` / `min-h-11`) |
  | §2 D15 | 1–2 |
  | §2 D16 | 10 |
  | §2 D18 | 3–4 |
  | §2 D19 | 5 (`buildPricingBreakdown().sections`, `getTotalModeParts`) |
  | §2 D20, D22–D23 | 6 |
  | §2 D24 | 6 (cash and finance option saved; mode on-screen until R7, owner ruling O1) |
  | §3 frozen Funding (O2) | 6 + Review Focus 6 |
  | §3 Past results before/after cards and the "We've done this before" chip | not built: wait for R6 (Data access gates) |
  | §4.1 | 1 |
  | §4.2 | 2 (one scroller, the frame in every state) |
  | §4.3 | 6, 12–14 + Review Focus 1 |
  | §4.4 | 11–13 + Review Focus 7 |
  | §4.5 | 5–6 (shadcn `RadioGroup`, labelled slider thumb) |
  | §4.6 | 3 |
  | §4.7 | 2 (`scrollToChapter`), 4 (`motion-reduce`) |
  | §4.8 | 2, 6 (44px slider row), 8, 13 (44px switch rows) |
  | §4.9 | Global Constraints (app ladder, navy stage with on-media ink; no new tokens) |
  | §6 | 4 (fallbacks), 6 (bounds, derived clamp, debounce, `visibilitychange`/`pagehide` flush, frozen), 13 (missing email, no profile access) |
  | §7 | 15 |

- **Gaps intentionally left to the R7 amendment:** payment-mode persistence, the scheduled-payments list and its cockpit editor dialog, the server-side $3,500 floor, and the "price changed after a saved schedule" warning.
- **Type names used across tasks:** `ProposalDocument`, `useProposalDocument`, `ProposalTopBarFrame`, `ProposalTopBar`, `ChapterNav`, `scrollToChapter`, `PaymentMode`, `getCashDownBounds`, `clampCashDown`, `isPaymentModeAvailable`, `getStoredPaymentMode`, `MIN_FINANCED_AMOUNT`, `CASH_DOWN_STEP`, `PROPOSAL_FROZEN_REASON`, `FUNDING_LOCKED_NOTE`, `useDebouncedSave`, `TotalModePart`, `getTotalModeParts`, `PriceRow`, `ParsedSowSection`, `parseSowSection`, `FALLBACK_HERO_PHOTO`, `COMPARISON_SLIDE_IDS`, `PAST_RESULTS_SHOWN`, `OverviewCard`, `KeyInsightField`, `PRESENTABLE_INSIGHT_FIELDS`, `PROPOSAL_ACTIONS.internalFinancials`, `PROPOSAL_ACTIONS.copySow`, `onInternalFinancials`, `onCopySow`, `COCKPIT_PROPOSAL_TOOLBAR`, `COCKPIT_PROPOSAL_HIDDEN_ACTIONS`, `COCKPIT_CUSTOMER_HIDDEN_ACTIONS`, `Cockpit`. Each is defined once and used under the same name in every task that consumes it. Existing APIs the plan uses as they are: `ProposalActionsHost`, `MeetingActionsHost`, `CustomerActionsHost` (+ `use…ActionsHost`), `withToolbarRoles`, `openModal`, `openCustomerProfile`, `useAbility` from `@/shared/domains/permissions/client`, `isProposalFrozen`, `buildPricingBreakdown`.
