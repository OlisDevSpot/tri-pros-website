# Proposal page redesign (the Journey + the agent cockpit): Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the customer-facing proposal page (`/proposal-flow/proposal/[proposalId]`) as one long Journey document: six chapters with a chapter rail or tabs, a per-part price breakdown, a cash-down slider and payment plan, and a scope spec sheet. Agents get a dimming cockpit sheet of generalized entity cards, so internal numbers never appear on the document.

**Architecture:** `<Proposal/>` loads the proposal once and hands it to a `ProposalDocumentProvider`, which every chapter reads. This is the F15 seam spec F and spec G reuse later. A top bar and chapter nav replace the layout navbar. Agent tools move into a `Cockpit` built on the existing `ResponsiveSheet`, made of four cards. Those cards are the existing entity overview cards, re-based on a new shared `EntityCard` layout primitive. Pure logic (SOW parsing, price parts, cash-down bounds, payment-mode availability) lives in `lib/` files checked by throwaway `node:test` files.

**Tech Stack:** Next.js 15 App Router, React 19, tRPC v11, TanStack Query, Tailwind v4 (container queries), shadcn/ui (Radix Slider, Switch, Sheet; vaul Drawer), motion/react, nuqs, CASL, pnpm, `tsx`.

**Spec:** `docs/superpowers/specs/2026-10-01-proposal-page-design.md` (approved 2026-10-01, commit `1fc8b25a`). Studies artifact: https://claude.ai/artifact/LoR7Mjz2xZ8Wb7fR6soKGA (v6). **Out of this plan:**
- spec §5 R1–R7 (the owner runs them; see "Data access gates" below);
- the payment-plan persistence and scheduled-payments editor (after R7);
- follow-ups F1–F8.

## Global Constraints

- Verification per task: `pnpm tsc` and `pnpm lint`. **Never `pnpm build`.** Clear `.next` (check `ss -ltnp` first) before judging rendered CSS on a long-running dev server.
- **No database writes for testing** (dev included). Browser checks intercept writes with `page.route` and answer them with a mocked response. They abort `**/*recordView*`.
- No unit runner in the repo. Pure functions are checked with throwaway `node:test` files under `.superpowers/sdd/2026-10-01-proposal-page/tests/` (git-ignored), run from the repo root with `pnpm exec tsx --test <file>` so the `@/` alias resolves. Never commit them.
- Work on `main`, where other sessions commit concurrently.
  - Stage by explicit path. Never use `git add -A`, `git add .`, stash, checkout-dot, restore or reset.
  - Before each commit, run `git diff --cached --stat` and confirm only this task's files are staged.
  - Commit messages take the shape `type(scope): subject` and end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- Code conventions (memory `coding-conventions.md`):
  - one component per file, named exports;
  - constants in `constants/`, pure helpers in `lib/`;
  - only DAL files import `db`;
  - comments say why, never what, with no plan, spec or tracker citations in code;
  - the one exception is the `// LAZY:` header on the SOW parser.
- Company facts come only from `src/shared/constants/company/` or an existing typed constant (`WHO_WE_ARE_SLIDES`, `COMPARISON_COLUMNS`). Never use `TRADE_OUTCOMES`, `testimonials`, `awards`, or anything about solar.
- Colours: navy chapters use the existing `--presentation-ground` / `--presentation-accent` tokens (`bg-(--presentation-ground)`, `text-(--presentation-accent)`). Everything else uses theme tokens (`bg-background`, `bg-card`, `text-muted-foreground`, `border-border`, `text-status-success-fg`). **No new colour tokens.** If one seems needed, stop and ask the owner.
- Never show to anyone, on any surface: `creditScore`, `age`/`ageGroup`, `householdType`, `sellPlan`, `numQuotesReceived`, cost lines, margin.
- Copy, verbatim from the spec:
  - Chapter titles and short labels: Overview · Trusted contractor/Contractor · Past results/Results · Scope of work/Scope · Funding · Next steps/Next steps.
  - "Your price for this part", "Subtotal of all parts", "Applies to the whole project", "Final contract price", "Deposit at signing".
  - "Estimates, subject to lender approval. Financing starts at $3,500."
  - "Pricing held through {date} ({n} days)".
- Breakpoints: chapter rail at container width ≥ 1100px (`@min-[1100px]/proposal:`); cockpit sheet at ≥ 1024px (handled by `ResponsiveSheet` via `useIsBelowLg`).
- `MIN_FINANCED_AMOUNT = 3500`. Cash-down step $500. Debounced save after 600ms.

## Data access gates (spec §5; the owner runs these, this plan builds around them)

| Item | What this plan does until it lands | When it lands |
|---|---|---|
| R1 homeowner projection (#285 / spec F H10) | Nothing. The page never renders cost data, so the leak is in the payload only. | **Release gate:** do not push this page to prod before R1. |
| R2 `sent_message` + `proposalService.send` (spec A A5) | The send composer passes `message` to `delivery.sendProposalEmail`. The "last note" line and the homeowner's "A note from…" are not rendered. | A one-step follow-up: switch the composer's mutation and render `proposal.sentMessage`. |
| R3 owner profile on the read | The consultant row shows `companyInfo.name` and the main line from `companyInfo`. | Swap the fallback for `proposal.owner`. |
| R4 gated phone on the session path | Nothing to do in UI. | n/a |
| R5 meeting date on the read | The overview meta row omits "Visited {date}". The cockpit's Meeting card reads the profile query. | Add the meta item. |
| R6 trade-filtered portfolio read | Past results shows the first three public projects. | Swap the query. |
| R7 payment plan model | The payment-mode control keeps **local state**. Scheduled payments shows an "Ask your consultant for a payment schedule" placeholder line. | A plan amendment: persistence (D24), the scheduled-payments list and the cockpit editor dialog. |

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
7. **The shell joins the marketing world:** `ProposalFlowShell` drops the radial red/blue gradient and gets `theme-marketing bg-background`. Agent mode is shown by the cockpit button, not a red wash.
8. **`internalFinancials` is wired through an `onInternalFinancials` override.** The action is omitted when no override is passed, so the proposals table and kanban are unchanged.

## Review Focus

1. **A homeowner never sees an agent control.** Without `?view=agent`, and also for a logged-in agent without the param, the DOM has no cockpit button, no "View internal financials", no copy-SOW, no scheduled-payments editor and no send composer. Pinned by Task 15 Step 3 (DOM query on both viewers).
2. **The slider never lets financing drop below $3,500.** The maximum is `finalTcp − 3500` rounded down to $500. A stored `cashInDeal` above that is clamped and re-saved. Under $4,000 the financing modes are disabled. Pinned by `getCashDownBounds` tests (Task 6 Step 1) and Task 15 Step 5.
3. **Dragging the slider sends one write, not dozens.** A drag of ten steps produces one `setCashInDeal` request 600ms after release, and a pending value is flushed on `pagehide`. Pinned by Task 15 Step 5 (request count).
4. **Total-mode proposals show no part prices.** Parts list titles and their incentives only. The first priced line is "Contract price". The final price equals `buildPricingBreakdown().finalTcp`. Pinned by `buildPriceParts` tests (Task 5 Step 1) and Task 15 Step 4.
5. **A malformed or unusual SOW never loses text.** An unparseable `contentJSON`, a section with no headings, or a section whose "Description:" sits in a paragraph still renders: parsed blocks when possible, else the sanitized HTML. No "0 steps" phase appears. Pinned by `parseSowSection` tests (Task 3 Step 1).

## File map

| Area | Files (under `src/` unless noted) |
|---|---|
| Document seam | `features/proposal-flow/contexts/proposal-document-context.tsx` (new) · `features/proposal-flow/constants/proposal-steps.ts` · `features/proposal-flow/ui/components/proposal/index.tsx` |
| Chrome | `features/proposal-flow/ui/components/proposal/top-bar.tsx` (new) · `.../proposal/chapter-nav.tsx` (new) · `features/proposal-flow/ui/components/proposal-flow-shell.tsx` · `app/(frontend)/proposal-flow/layout.tsx` · `features/proposal-flow/ui/components/navbar/navbar-menu.tsx` · delete `navbar/navbar.tsx`, `navbar/navbar-frame.tsx` |
| Scope | `features/proposal-flow/lib/parse-sow-section.ts` (new) · `.../proposal/scope-spec-card.tsx` (new) · `.../proposal/scope-of-work.tsx` |
| Funding | `features/proposal-flow/lib/build-price-parts.ts` (new) · `features/proposal-flow/ui/components/pricing-breakdown.tsx` · `shared/modules/proposals/core/constants/financing.ts` (new) · `features/proposal-flow/lib/get-cash-down-bounds.ts` (new) · `features/proposal-flow/constants/payment-modes.ts` (new) · `features/proposal-flow/hooks/use-debounced-save.ts` (new) · `.../proposal/cash-down-slider.tsx` (new) · `.../proposal/finance-option-group.tsx` (new) · `.../proposal/payment-plan-group.tsx` (new) · `.../proposal/funding.tsx` |
| Other chapters | `.../proposal/overview-hero.tsx` (new) · `.../proposal/overview-context-card.tsx` (new) · `.../proposal/project-overview.tsx` · `features/proposal-flow/lib/get-comparison-rows.ts` (new) · `.../proposal/comparison-list.tsx` (new) · `.../proposal/trusted-contractor.tsx` · `.../proposal/related-projects.tsx` · `.../proposal/next-steps.tsx` (new) |
| Entity cards | `shared/components/entities/entity-card/entity-card.tsx` (new) · `shared/modules/proposals/core/components/overview-card.tsx` · `shared/entities/customers/components/overview-card.tsx` · `shared/entities/customers/constants/presentable-insight-fields.ts` (new) · `shared/entities/meetings/components/overview-card.tsx` · `shared/modules/proposals/core/constants/actions.ts` · `shared/modules/proposals/core/hooks/use-proposal-action-configs.ts` |
| Cockpit | `features/proposal-flow/ui/components/cockpit/{cockpit,cockpit-proposal-card,send-composer,cockpit-agreement-card,cockpit-customer-card,cockpit-meeting-card}.tsx` (new) |
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
- read `const token = searchParams.get('token') ?? undefined`;
- wrap everything inside the scroll container in `<ProposalDocumentProvider proposal={proposalData} viewMode={viewMode} token={token}>`;
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

Run `pnpm tsc` and `pnpm lint`. Expected: both pass (the `navbar.tsx` step titles change text only).

- [ ] **Step 5: Commit**

```bash
git add src/features/proposal-flow/contexts/proposal-document-context.tsx src/features/proposal-flow/constants/proposal-steps.ts src/features/proposal-flow/types src/features/proposal-flow/ui/components/proposal/index.tsx
git diff --cached --stat
git commit -m "feat(proposal-flow): the proposal document takes its proposal from context

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Top bar, chapter nav and the marketing shell

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/top-bar.tsx`
- Create: `src/features/proposal-flow/ui/components/proposal/chapter-nav.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal-flow-shell.tsx`
- Modify: `src/app/(frontend)/proposal-flow/layout.tsx`
- Modify: `src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx`
- Delete: `src/features/proposal-flow/ui/components/navbar/navbar.tsx`, `navbar/navbar-frame.tsx`

**Interfaces:**
- Consumes: `useProposalDocument()` (Task 1), `proposalSteps[].shortLabel` (Task 1), `useActiveSection(ids, { rootEl })` (`@/shared/hooks/use-active-section`), `useScrollRoot()`.
- Produces: `ProposalTopBar({ onOpenCockpit }: { onOpenCockpit?: () => void })` and `ChapterNav({ variant }: { variant: 'rail' | 'tabs' })`. Each chapter wrapper is `<section id={accessor} aria-labelledby={`${accessor}-title`}>`. Each chapter's `<h2>` carries `id={`${accessor}-title`}`.

- [ ] **Step 1: The shell joins the marketing world**

Replace the body of `ProposalFlowShell` with:

```tsx
export function ProposalFlowShell({ children }: Props) {
  const viewMode = useViewMode()
  return (
    <div className="theme-marketing bg-background text-foreground h-full flex flex-col" data-no-gutter-stable data-view-mode={viewMode}>
      {children}
    </div>
  )
}
```

Update its doc comment to say why: the proposal is a marketing-world surface, and agent mode is signalled by the cockpit button.

- [ ] **Step 2: The layout drops the navbar and the container**

In `layout.tsx`, remove the `ProposalPageNavbar` import and its wrapper `div`. Replace the `container grow min-h-0 py-4 lg:py-8 …` wrapper with `<div className="grow min-h-0 pb-[env(safe-area-inset-bottom)]">`. Keep `Suspense`, `ScrollRootProvider` and `pt-[env(safe-area-inset-top)]` (move it to the new wrapper's outer `div`).

- [ ] **Step 3: The menu reads the document**

In `navbar-menu.tsx`:
- replace `useCurrentProposal()` with `useProposalDocument()`, so the PDF link uses `proposal.id` and `token`;
- drop the `variant` prop, since it renders one style;
- make the trigger `variant="ghost"` with `text-white hover:bg-white/10`.

- [ ] **Step 4: Write the top bar**

```tsx
// src/features/proposal-flow/ui/components/proposal/top-bar.tsx
'use client'

import { ArrowLeftIcon, PanelRightIcon } from 'lucide-react'
import Link from 'next/link'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ProposalNavbarMenu } from '@/features/proposal-flow/ui/components/navbar/navbar-menu'
import { Logo } from '@/shared/components/logo'
import { Button } from '@/shared/components/ui/button'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/hooks'

interface Props {
  onOpenCockpit?: () => void
}

export function ProposalTopBar({ onOpenCockpit }: Props) {
  const { proposal, isAgent } = useProposalDocument()
  const ability = useAbility()
  const backHref = ability.can('access', 'Dashboard') ? ROOTS.dashboard.proposals.root() : '/'
  const title = [proposal.label, proposal.customer?.name].filter(Boolean).join(' · ')

  return (
    <header className="bg-(--presentation-ground) text-white h-14 shrink-0 flex items-center gap-3 px-4">
      <Link href={backHref} className="flex items-center gap-2 h-11 shrink-0" aria-label="Back">
        <ArrowLeftIcon className="size-5" />
        <Logo variant="icon" className="size-8" />
      </Link>
      <p className="min-w-0 truncate text-sm font-semibold">{title}</p>
      <div className="ml-auto flex items-center gap-2">
        {isAgent && onOpenCockpit && (
          <Button size="sm" onClick={onOpenCockpit} className="bg-(--presentation-accent) text-(--presentation-ground) hover:bg-(--presentation-accent)/90">
            <PanelRightIcon className="size-4" />
            Cockpit
          </Button>
        )}
        <ProposalNavbarMenu />
      </div>
    </header>
  )
}
```

- [ ] **Step 5: Write the chapter nav**

```tsx
// src/features/proposal-flow/ui/components/proposal/chapter-nav.tsx
'use client'

import { proposalSteps } from '@/features/proposal-flow/constants/proposal-steps'
import { useScrollRoot } from '@/features/proposal-flow/contexts/scroll-context'
import { useActiveSection } from '@/shared/hooks/use-active-section'
import { cn } from '@/shared/lib/utils'

interface Props {
  variant: 'rail' | 'tabs'
}

const ids = proposalSteps.map(step => step.accessor)

export function ChapterNav({ variant }: Props) {
  const { rootEl } = useScrollRoot()
  const active = useActiveSection(ids, { rootEl })

  function go(id: string) {
    const target = document.getElementById(id)
    if (!target || !rootEl) {
      return
    }
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    rootEl.scrollTo({ top: id === ids[0] ? 0 : target.offsetTop, behavior: reduce ? 'auto' : 'smooth' })
  }

  if (variant === 'rail') {
    return (
      <nav aria-label="Proposal chapters" className="sticky top-0 self-start py-8 pl-6 pr-4">
        <ol className="flex flex-col gap-1">
          {proposalSteps.map((step, i) => (
            <li key={step.accessor}>
              <button
                type="button"
                onClick={() => go(step.accessor)}
                aria-current={active === step.accessor ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-3 rounded-md border-l-2 border-transparent px-3 py-2 text-left text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground',
                  active === step.accessor && 'border-(--presentation-accent) bg-card text-foreground',
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
    <nav aria-label="Proposal chapters" className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <ol className="flex overflow-x-auto [scrollbar-width:none]">
        {proposalSteps.map(step => (
          <li key={step.accessor} className="shrink-0">
            <button
              type="button"
              onClick={() => go(step.accessor)}
              aria-current={active === step.accessor ? 'true' : undefined}
              className={cn(
                'min-h-11 whitespace-nowrap border-b-2 border-transparent px-3 text-sm font-semibold text-muted-foreground',
                active === step.accessor && 'border-(--presentation-accent) text-foreground',
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

- [ ] **Step 6: Lay out the page**

In `index.tsx`:
- Add `const [cockpitOpen, setCockpitOpen] = useState(false)`. Task 13 uses it.
- Render `<ProposalTopBar onOpenCockpit={() => setCockpitOpen(true)} />` above the scroll container, inside the provider. The provider now wraps the top bar too.
- Inside `#proposal-container`, replace `<Heading />` and the step map's wrapper with:

```tsx
<div className="@container/proposal">
  <div className="grid @min-[1100px]/proposal:grid-cols-[220px_minmax(0,1fr)]">
    <div className="hidden @min-[1100px]/proposal:block"><ChapterNav variant="rail" /></div>
    <div className="min-w-0">
      <div className="@min-[1100px]/proposal:hidden"><ChapterNav variant="tabs" /></div>
      {proposalSteps.map(step => (
        <section key={step.accessor} id={step.accessor} aria-labelledby={`${step.accessor}-title`} className="scroll-mt-12">
          {/* existing per-step rendering, unchanged */}
        </section>
      ))}
    </div>
  </div>
</div>
```

- Remove the `motion.div` wrapper, the `space-y-20`, `lg:pr-8` and `scroll-smooth`. Scrolling is driven by `ChapterNav.go`, which respects reduced motion.
- Keep `PdfFallbackCard` after the last section.
- `Heading` is no longer rendered; Task 14 deletes it.

- [ ] **Step 7: Delete the old navbar**

```bash
git rm src/features/proposal-flow/ui/components/navbar/navbar.tsx src/features/proposal-flow/ui/components/navbar/navbar-frame.tsx
```

Then grep for `ProposalPageNavbar|ProposalNavbarFrame` under `src/`. Expected: no matches.

- [ ] **Step 8: Verify**

Run `pnpm tsc` and `pnpm lint`; both pass. Open `http://localhost:3000/proposal-flow/proposal/<id>?view=agent` using the dev session URL from `reference-playwright-auth.md`, at 1440 and 390, and screenshot each:
- the rail sticks while scrolling at 1440;
- the tabs show all six short labels, uncut, at 390.

- [ ] **Step 9: Commit**

```bash
git add src/features/proposal-flow/ui/components/proposal/top-bar.tsx src/features/proposal-flow/ui/components/proposal/chapter-nav.tsx src/features/proposal-flow/ui/components/proposal/index.tsx src/features/proposal-flow/ui/components/proposal-flow-shell.tsx "src/app/(frontend)/proposal-flow/layout.tsx" src/features/proposal-flow/ui/components/navbar/navbar-menu.tsx
git diff --cached --stat
git commit -m "feat(proposal-flow): a chapter rail and short-label tabs replace the step navbar

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

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

Run `pnpm tsc` and `pnpm lint`, then:

```bash
git add src/features/proposal-flow/lib/parse-sow-section.ts
git diff --cached --stat
git commit -m "feat(proposal-flow): parse a scope section into details, exclusions and phases

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: The scope spec sheet chapter

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/scope-spec-card.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx`

**Interfaces:**
- Consumes: `parseSowSection` (Task 3), `useProposalDocument()` (Task 1), `SOW` (`@/shared/modules/proposals/core/types`), `sanitizeUserHtml`, `formatAsDollars`.
- Produces: `ScopeSpecCard({ section, index, showPrice }: { section: SOW, index: number, showPrice: boolean })`.

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
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex items-start gap-4 border-b border-border px-5 py-4">
        <span className="pt-0.5 text-lg font-semibold tabular-nums text-(--presentation-accent)">{String(index + 1).padStart(2, '0')}</span>
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
                            className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold"
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
    <div className="bg-muted/40 px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">Scope of work</p>
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

The free-text `agreementNotes` block is gone: per-section notes now live in each card. The proposal-level `agreementNotes` is empty in every sampled proposal (spec §3).

- [ ] **Step 3: Verify**

Run `pnpm tsc` and `pnpm lint`. Screenshot the Scope chapter at 1440 and 390 on a proposal whose sections use both description forms. Check:
- no "0 steps" phase appears;
- details render as two columns;
- exclusions show under "Not included".

- [ ] **Step 4: Commit**

```bash
git add src/features/proposal-flow/ui/components/proposal/scope-spec-card.tsx src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx
git diff --cached --stat
git commit -m "feat(proposal-flow): the scope chapter reads as a spec sheet per part

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Per-part price breakdown

**Files:**
- Create: `src/features/proposal-flow/lib/build-price-parts.ts`
- Modify: `src/features/proposal-flow/ui/components/pricing-breakdown.tsx`
- Test: `.superpowers/sdd/2026-10-01-proposal-page/tests/build-price-parts.test.ts`

**Interfaces:**
- Consumes: `buildPricingBreakdown` and its `PricingBreakdownModel` (`@/shared/modules/proposals/core/lib/financials`).
- Produces:

```ts
export interface PricePart {
  key: string
  title: string
  price: number | null // null when section prices are hidden
  incentives: { id: string, label: string, amount: number }[]
  netPrice: number | null // set only when price is shown and the part has incentives
}
export function buildPriceParts(sow: SOW[], showSectionPrices: boolean): PricePart[]
```

`PricingBreakdown` keeps its props (`funding`, `sow`, `priceDisplayMode`), so `InternalFinancialsModal` and the funding chapter both get the new layout.

- [ ] **Step 1: Write the failing test**

```ts
// .superpowers/sdd/2026-10-01-proposal-page/tests/build-price-parts.test.ts
import type { SOW } from '@/shared/modules/proposals/core/types'
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildPriceParts } from '@/features/proposal-flow/lib/build-price-parts'

const section = (title: string, price: number | null, incentives: { id: string, label: string, amount: number }[] = []): SOW => ({
  title,
  contentJSON: '{}',
  html: '',
  scopes: [],
  trade: { id: 't', label: 'Trade' },
  financials: { sectionPrice: price, costLines: [], incentives },
} as unknown as SOW)

const sow = [
  section('Pavers', 22456, [{ id: 'i1', label: 'Bundle savings', amount: 1250 }]),
  section('Demo', 2750),
  section('Unpriced', null),
]

test('breakdown mode: price, incentives, net only when there are incentives; unpriced parts skipped', () => {
  assert.deepEqual(buildPriceParts(sow, true), [
    { key: '0-Pavers', title: 'Pavers', price: 22456, incentives: [{ id: 'i1', label: 'Bundle savings', amount: 1250 }], netPrice: 21206 },
    { key: '1-Demo', title: 'Demo', price: 2750, incentives: [], netPrice: null },
  ])
})

test('total mode: every part listed by title with its incentives and no prices', () => {
  const parts = buildPriceParts(sow, false)
  assert.equal(parts.length, 3)
  assert.ok(parts.every(p => p.price === null && p.netPrice === null))
  assert.equal(parts[0].incentives.length, 1)
})

test('untitled parts get a numbered fallback', () => {
  assert.equal(buildPriceParts([section('', 100)], true)[0].title, 'Part 1')
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec tsx --test .superpowers/sdd/2026-10-01-proposal-page/tests/build-price-parts.test.ts`. Expected: FAIL, module not found.

- [ ] **Step 3: Implement the helper**

```ts
// src/features/proposal-flow/lib/build-price-parts.ts
import type { SOW } from '@/shared/modules/proposals/core/types'

export interface PricePart {
  key: string
  title: string
  price: number | null
  incentives: { id: string, label: string, amount: number }[]
  netPrice: number | null
}

export function buildPriceParts(sow: SOW[], showSectionPrices: boolean): PricePart[] {
  return sow
    .map((section, i) => {
      const title = section.title || `Part ${i + 1}`
      const incentives = (section.financials.incentives ?? []).map(inc => ({ id: inc.id, label: inc.label || 'Discount', amount: inc.amount }))
      const rawPrice = section.financials.sectionPrice ?? 0
      const price = showSectionPrices ? rawPrice : null
      const discount = incentives.reduce((sum, inc) => sum + inc.amount, 0)
      return {
        key: `${i}-${section.title || 'part'}`,
        title,
        price,
        incentives,
        netPrice: price !== null && incentives.length > 0 ? price - discount : null,
        rawPrice,
      }
    })
    .filter(part => !showSectionPrices || part.rawPrice > 0)
    .map(({ rawPrice: _rawPrice, ...part }) => part)
}
```

- [ ] **Step 4: Run the test to verify it passes**

Expected: PASS, 3 tests.

- [ ] **Step 5: Rewrite `PricingBreakdown`**

```tsx
// src/features/proposal-flow/ui/components/pricing-breakdown.tsx
'use client'

import type { PriceDisplayMode } from '@/shared/constants/enums'
import type { FundingData } from '@/shared/modules/proposals/core/schemas'
import type { SOW } from '@/shared/modules/proposals/core/types'

import { CheckIcon, GiftIcon } from 'lucide-react'

import { buildPriceParts } from '@/features/proposal-flow/lib/build-price-parts'
import { formatAsDollars } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { buildPricingBreakdown } from '@/shared/modules/proposals/core/lib/financials'
import { ExpirationBadge } from './expiration-badge'

interface Props {
  funding: FundingData
  sow: SOW[]
  priceDisplayMode: PriceDisplayMode
}

function Row({ label, value, className }: { label: React.ReactNode, value: React.ReactNode, className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-3', className)}>
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 whitespace-nowrap tabular-nums">{value}</span>
    </div>
  )
}

export function PricingBreakdown({ funding, sow, priceDisplayMode }: Props) {
  const breakdown = buildPricingBreakdown({ funding, sow, priceDisplayMode })
  const showPrices = priceDisplayMode === 'breakdown'
  const parts = buildPriceParts(sow, showPrices)
  const now = new Date()

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-card text-sm">
      {!showPrices && (
        <Row className="px-4 py-3.5 font-semibold" label="Contract price" value={formatAsDollars(breakdown.subtotal)} />
      )}
      <div className={cn('divide-y divide-border', !showPrices && 'border-t border-border')}>
        {parts.map(part => (
          <div key={part.key} className="grid gap-2 px-4 py-3.5">
            <Row label={<span className="font-bold">{part.title}</span>} value={part.price !== null ? <span className="font-semibold">{formatAsDollars(part.price)}</span> : null} />
            {part.incentives.map(inc => (
              <Row
                key={inc.id}
                className="text-status-success-fg"
                label={<span className="inline-flex items-center gap-1.5"><GiftIcon className="size-3.5 shrink-0" />{inc.label}</span>}
                value={`−${formatAsDollars(inc.amount)}`}
              />
            ))}
            {part.netPrice !== null && (
              <Row className="border-t border-dashed border-border pt-2 font-semibold" label="Your price for this part" value={formatAsDollars(part.netPrice)} />
            )}
          </div>
        ))}
        {showPrices && breakdown.miscPrice != null && (
          <Row className="px-4 py-3.5" label={<span className="font-bold">Additional items</span>} value={formatAsDollars(breakdown.miscPrice)} />
        )}
      </div>

      <Row className="border-t border-border px-4 py-3.5 text-muted-foreground" label={showPrices ? 'Subtotal of all parts' : 'Subtotal'} value={formatAsDollars(breakdown.netSubtotal)} />

      {breakdown.globalLines.length > 0 && (
        <div className="grid gap-2.5 border-t border-border bg-status-success-bg/40 px-4 py-3.5 text-status-success-fg">
          <p className="text-[11px] font-bold uppercase tracking-wider">Applies to the whole project</p>
          {breakdown.globalLines.map((line) => {
            const expiresAt = line.expiresAt ? new Date(line.expiresAt) : null
            const expired = expiresAt ? now >= expiresAt : false
            return (
              <div key={line.key} className="grid gap-1">
                <Row
                  className={cn(expired && 'line-through opacity-60')}
                  label={(
                    <span className="inline-flex items-center gap-1.5">
                      <GiftIcon className="size-3.5 shrink-0" />
                      {line.label}
                      {line.kind === 'exclusive-offer' && line.notes && <span className="opacity-80">{` · ${line.notes}`}</span>}
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

      <div className="grid gap-1.5 border-t border-border bg-muted/40 px-4 py-3.5">
        <Row label={<span className="font-bold">Final contract price</span>} value={<span className="text-2xl font-semibold">{formatAsDollars(breakdown.finalTcp)}</span>} />
        <Row className="text-muted-foreground" label="Deposit at signing" value={formatAsDollars(breakdown.deposit)} />
      </div>
    </div>
  )
}
```

If `bg-status-success-bg` is not a defined utility, check with `grep -n "status-success" "src/app/(frontend)/globals.css"`. If it's missing, use the success-surface token the file defines instead. Do not add a token.

- [ ] **Step 6: Verify**

Run `pnpm tsc` and `pnpm lint`. Screenshot the Funding chapter on:
- a breakdown-mode proposal;
- a total-mode proposal (any with `priceDisplayMode = 'total'`).

Check that the final price equals the old page's for the same proposal.

- [ ] **Step 7: Commit**

```bash
git add src/features/proposal-flow/lib/build-price-parts.ts src/features/proposal-flow/ui/components/pricing-breakdown.tsx
git diff --cached --stat
git commit -m "feat(proposal-flow): the price breakdown reads per part with its own incentives

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Funding chapter: slider, finance options, payment plan, debounced saves

**Files:**
- Create: `src/shared/modules/proposals/core/constants/financing.ts`
- Create: `src/features/proposal-flow/lib/get-cash-down-bounds.ts`
- Create: `src/features/proposal-flow/constants/payment-modes.ts`
- Create: `src/features/proposal-flow/hooks/use-debounced-save.ts`
- Create: `src/features/proposal-flow/ui/components/proposal/cash-down-slider.tsx`
- Create: `src/features/proposal-flow/ui/components/proposal/finance-option-group.tsx`
- Create: `src/features/proposal-flow/ui/components/proposal/payment-plan-group.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/funding.tsx`
- Test: `.superpowers/sdd/2026-10-01-proposal-page/tests/get-cash-down-bounds.test.ts`

**Interfaces:**
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

// hooks/use-debounced-save.ts
export function useDebouncedSave<T>(value: T, stored: T, save: (value: T) => void, delayMs?: number): void

// components
CashDownSlider({ value, max, onChange }: { value: number, max: number, onChange: (v: number) => void })
FinanceOptionGroup({ options, selectedId, amountFinanced, onSelect }: { options: FinanceOption[], selectedId: string | null, amountFinanced: number, onSelect: (option: FinanceOption) => void })
PaymentPlanGroup({ value, finalTcp, onChange }: { value: PaymentMode, finalTcp: number, onChange: (mode: PaymentMode) => void })
```

- [ ] **Step 1: Write the failing test**

```ts
// .superpowers/sdd/2026-10-01-proposal-page/tests/get-cash-down-bounds.test.ts
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clampCashDown, getCashDownBounds, isPaymentModeAvailable } from '@/features/proposal-flow/lib/get-cash-down-bounds'

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

- [ ] **Step 4: Run the test to verify it passes**

Expected: PASS, 4 tests.

- [ ] **Step 5: The debounced save hook**

```ts
// src/features/proposal-flow/hooks/use-debounced-save.ts
'use client'

import { useEffect, useRef } from 'react'
import { useDebounce } from '@/shared/hooks/use-debounce'

export function useDebouncedSave<T>(value: T, stored: T, save: (value: T) => void, delayMs = 600) {
  const debounced = useDebounce(value, delayMs)
  const latest = useRef({ value, stored, save })
  latest.current = { value, stored, save }

  useEffect(() => {
    if (!Object.is(debounced, latest.current.stored)) {
      latest.current.save(debounced)
    }
  }, [debounced])

  // A homeowner who drags and closes the tab still gets their last value saved.
  useEffect(() => {
    function flush() {
      const { value: v, stored: s, save: write } = latest.current
      if (!Object.is(v, s)) {
        write(v)
      }
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])
}
```

- [ ] **Step 6: The three controls**

```tsx
// src/features/proposal-flow/ui/components/proposal/cash-down-slider.tsx
'use client'

import { Slider } from '@/shared/components/ui/slider'
import { formatAsDollars } from '@/shared/lib/formatters'
import { CASH_DOWN_STEP } from '@/shared/modules/proposals/core/constants/financing'

interface Props { value: number, max: number, onChange: (value: number) => void }

export function CashDownSlider({ value, max, onChange }: Props) {
  return (
    <div className="grid gap-2">
      <div className="flex items-baseline justify-between">
        <label id="cash-down-label" className="text-sm font-bold">Cash down</label>
        <span className="text-2xl font-semibold tabular-nums">{formatAsDollars(value)}</span>
      </div>
      <Slider
        aria-labelledby="cash-down-label"
        aria-valuetext={formatAsDollars(value)}
        min={0}
        max={max}
        step={CASH_DOWN_STEP}
        value={[value]}
        onValueChange={([v]) => onChange(v ?? 0)}
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

import { getLoanValues } from '@/shared/lib/loan-calculations'
import { cn } from '@/shared/lib/utils'

interface Props {
  options: FinanceOption[]
  selectedId: string | null
  amountFinanced: number
  onSelect: (option: FinanceOption) => void
}

export function FinanceOptionGroup({ options, selectedId, amountFinanced, onSelect }: Props) {
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') {
      return
    }
    e.preventDefault()
    const next = options[(index + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length]
    if (next) {
      onSelect(next)
      document.getElementById(`finance-option-${next.id}`)?.focus()
    }
  }

  return (
    <div role="radiogroup" aria-label="Finance option" className="grid gap-2">
      {options.map((option, i) => {
        const checked = option.id === selectedId
        return (
          <button
            key={option.id}
            id={`finance-option-${option.id}`}
            type="button"
            role="radio"
            aria-checked={checked}
            tabIndex={checked || (!selectedId && i === 0) ? 0 : -1}
            onClick={() => onSelect(option)}
            onKeyDown={e => onKeyDown(e, i)}
            className={cn(
              'flex min-h-14 items-center justify-between gap-3 rounded-md border border-border bg-card px-4 text-left',
              checked && 'border-primary ring-1 ring-primary',
            )}
          >
            <span className="grid">
              <span className="font-bold">{`${option.termInMonths / 12} years`}</span>
              <span className="text-xs text-muted-foreground">{`${option.termInMonths} months · ${Math.round(option.interestRate * 10000) / 100}% APR`}</span>
            </span>
            <span className="tabular-nums">
              <span className="text-lg font-semibold">{getLoanValues(amountFinanced, option.interestRate, option.termInMonths).monthlyFormatted}</span>
              <span className="text-xs text-muted-foreground"> / mo</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
```

```tsx
// src/features/proposal-flow/ui/components/proposal/payment-plan-group.tsx
'use client'

import type { PaymentMode } from '@/features/proposal-flow/lib/get-cash-down-bounds'

import { PAYMENT_MODES } from '@/features/proposal-flow/constants/payment-modes'
import { isPaymentModeAvailable } from '@/features/proposal-flow/lib/get-cash-down-bounds'
import { cn } from '@/shared/lib/utils'

interface Props { value: PaymentMode, finalTcp: number, onChange: (mode: PaymentMode) => void }

export function PaymentPlanGroup({ value, finalTcp, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Payment plan" className="grid grid-cols-2 gap-2">
      {PAYMENT_MODES.map((mode) => {
        const available = isPaymentModeAvailable(mode.value, finalTcp)
        return (
          <button
            key={mode.value}
            type="button"
            role="radio"
            aria-checked={value === mode.value}
            disabled={!available}
            onClick={() => onChange(mode.value)}
            className={cn(
              'grid min-h-11 rounded-md border border-border bg-card px-3 py-2 text-left text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50',
              value === mode.value && 'border-primary ring-1 ring-primary',
            )}
          >
            {mode.label}
            {!available && <span className="text-xs font-semibold text-muted-foreground">Financing starts at $3,500</span>}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7: Rewrite the funding chapter**

Replace `funding.tsx` with the following. The `onPickFinancingOption` prop goes; update the `funding` branch in `index.tsx` to render `<step.Component />`, and remove `'funding'` from `customizableSections`.

```tsx
'use client'

import type { PaymentMode } from '@/features/proposal-flow/lib/get-cash-down-bounds'
import type { FinanceOption } from '@/shared/db/schema'

import { ClockIcon } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useSetCashInDeal } from '@/features/proposal-flow/dal/client/mutations/use-set-cash-in-deal'
import { useUpdateProposal } from '@/features/proposal-flow/dal/client/mutations/use-update-proposal'
import { useGetFinanceOptions } from '@/features/proposal-flow/dal/client/queries/use-get-finance-options'
import { useDebouncedSave } from '@/features/proposal-flow/hooks/use-debounced-save'
import { clampCashDown, getCashDownBounds } from '@/features/proposal-flow/lib/get-cash-down-bounds'
import { PricingBreakdown } from '@/features/proposal-flow/ui/components/pricing-breakdown'
import { CashDownSlider } from '@/features/proposal-flow/ui/components/proposal/cash-down-slider'
import { FinanceOptionGroup } from '@/features/proposal-flow/ui/components/proposal/finance-option-group'
import { PaymentPlanGroup } from '@/features/proposal-flow/ui/components/proposal/payment-plan-group'
import { formatAsDollars } from '@/shared/lib/formatters'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'

export function Funding() {
  const { proposal, token } = useProposalDocument()
  const funding = useMemo(() => toFundingInputs(proposal), [proposal])
  const sow = proposal.projectJSON.data.sow
  const finalTcp = computeFinalTcp({ funding, sow })
  const { max } = getCashDownBounds(finalTcp)
  const storedCash = clampCashDown(funding.cashInDeal ?? 0, finalTcp)

  // Local until R7 stores the payment plan on the proposal.
  const [mode, setMode] = useState<PaymentMode>(storedCash > 0 ? 'some-cash' : 'all-finance')
  const [cash, setCash] = useState(storedCash)
  const financeOptions = useGetFinanceOptions()
  const saveCash = useSetCashInDeal()
  const updateProposal = useUpdateProposal()

  const cashDown = mode === 'some-cash' ? cash : 0
  const amountFinanced = finalTcp - cashDown

  useDebouncedSave(cashDown, funding.cashInDeal ?? 0, (value) => {
    saveCash.mutate({ token, id: proposal.id, cashInDeal: value }, {
      onError: () => toast.error('Couldn’t save your cash down. Your choice is kept on this screen.'),
    })
  })

  function selectFinanceOption(option: FinanceOption) {
    updateProposal.mutate({ token: token ?? '', id: proposal.id, data: { financeOptionId: option.id } }, {
      onError: () => toast.error('Couldn’t save your finance option.'),
    })
  }

  const validDays = proposal.projectJSON.data.validThroughTimeframe

  return (
    <div className="px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">Funding</p>
          <h2 id="funding-title" className="text-3xl font-semibold text-balance">Your investment</h2>
          <p className="text-muted-foreground">Every part priced, every saving shown. Choose how you’d like to pay.</p>
        </header>
        <div className="grid gap-6 @min-[1100px]/proposal:grid-cols-2">
          <div className="grid content-start gap-3">
            <PricingBreakdown funding={funding} sow={sow} priceDisplayMode={proposal.priceDisplayMode} />
            {validDays && (
              <p className="flex items-center gap-2 rounded-md bg-status-warning-bg/50 px-3 py-2.5 text-sm font-semibold text-status-warning-fg">
                <ClockIcon className="size-4" />
                {`Pricing held for ${validDays}`}
              </p>
            )}
          </div>
          <div className="grid content-start gap-4 rounded-lg border border-border bg-card p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">How you’d like to pay</p>
            <PaymentPlanGroup value={mode} finalTcp={finalTcp} onChange={setMode} />
            {mode === 'all-cash' && (
              <p className="text-sm">{`${formatAsDollars(finalTcp)} in total: ${formatAsDollars(funding.depositAmount)} at signing, the balance on completion.`}</p>
            )}
            {mode === 'scheduled' && (
              <p className="text-sm text-muted-foreground">Your consultant will set up a payment schedule with you.</p>
            )}
            {mode === 'some-cash' && <CashDownSlider value={cash} max={max} onChange={setCash} />}
            {(mode === 'some-cash' || mode === 'all-finance') && (
              <>
                <p className="text-sm">{`${formatAsDollars(amountFinanced)} to finance${cashDown > 0 ? ` after ${formatAsDollars(cashDown)} down` : ''}.`}</p>
                {financeOptions.data && financeOptions.data.length > 0 && (
                  <FinanceOptionGroup options={financeOptions.data} selectedId={proposal.financeOptionId} amountFinanced={amountFinanced} onSelect={selectFinanceOption} />
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
- **Mutation input types:** `setCashInDeal` and `crud.update` must accept `token` as the types require. Match `useSetCashInDeal`'s input (`{ id, token?, cashInDeal }`). `crud.update` takes `token` as a string, so pass `token ?? ''` as the old code did.
- **Warning tokens:** if `status-warning-*` utilities don't exist, use the warning tokens `globals.css` defines.

- [ ] **Step 8: Verify**

Run `pnpm tsc` and `pnpm lint`. In the browser, with writes intercepted (`page.route('**/proposalsRouter.funding.setCashInDeal**', r => r.fulfill({ status: 200, body: '…' }))`, using a captured response shape), check that:
- dragging the slider updates "to finance" and every monthly payment live;
- one request fires about 600ms after release;
- financing modes are disabled on a proposal under $4,000. If none exists, skip this check and rely on the unit test, saying so in the report.

- [ ] **Step 9: Commit**

```bash
git add src/shared/modules/proposals/core/constants/financing.ts src/features/proposal-flow/lib/get-cash-down-bounds.ts src/features/proposal-flow/constants/payment-modes.ts src/features/proposal-flow/hooks/use-debounced-save.ts src/features/proposal-flow/ui/components/proposal/cash-down-slider.tsx src/features/proposal-flow/ui/components/proposal/finance-option-group.tsx src/features/proposal-flow/ui/components/proposal/payment-plan-group.tsx src/features/proposal-flow/ui/components/proposal/funding.tsx src/features/proposal-flow/ui/components/proposal/index.tsx src/features/proposal-flow/constants/proposal-steps.ts
git diff --cached --stat
git commit -m "feat(proposal-flow): payment plan, cash-down slider and debounced saves on Funding

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: Overview chapter (hero and context card)

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/overview-hero.tsx`
- Create: `src/features/proposal-flow/ui/components/proposal/overview-context-card.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/project-overview.tsx`

**Interfaces:**
- Consumes: `useProposalDocument()`, `companyInfo` (`@/shared/constants/company`), `OptimizedImage` (`@/shared/modules/media/core/components/display/optimized-image`), `PhoneAction` / `EmailAction` / `AddressAction` (`@/shared/components/contact-actions/ui/*`).
- Produces: `OverviewHero()` and `OverviewContextCard()`. Both are argument-free and read the context.

- [ ] **Step 1: The hero**

```tsx
// src/features/proposal-flow/ui/components/proposal/overview-hero.tsx
'use client'

import Image from 'next/image'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'
import { companyInfo } from '@/shared/constants/company'

const FALLBACK_HERO = '/hero-photos/modern-house-5.jpg'

export function OverviewHero() {
  const { proposal } = useProposalDocument()
  const data = proposal.projectJSON.data
  const firstName = proposal.customer?.name?.split(' ')[0] ?? 'there'
  const project = data.label?.trim() ? data.label.trim().toLowerCase() : 'your home'
  const photo = (proposal.media ?? []).find(m => m.mimeType.startsWith('image/'))
  const parts = data.sow.length

  return (
    <div className="bg-(--presentation-ground) text-white">
      <div className="mx-auto grid max-w-5xl gap-8 px-4 py-12 sm:px-8 @min-[700px]/proposal:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] @min-[700px]/proposal:items-center">
        <div className="grid gap-4">
          <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">{`Your proposal · ${data.label || companyInfo.name}`}</p>
          <h2 id="project-overview-title" className="text-4xl font-semibold leading-tight text-balance">{`${firstName}, here’s the plan for ${project}.`}</h2>
          <p className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/80">
            <span><b className="text-white">{parts}</b>{` ${parts === 1 ? 'part' : 'parts'}`}</span>
            {data.timeAllocated && <span><b className="text-white">{data.timeAllocated}</b> on site</span>}
            <span>Prepared by <b className="text-white">{companyInfo.name}</b></span>
          </p>
        </div>
        <div className="relative aspect-4/3 overflow-hidden rounded-lg">
          {photo
            ? <OptimizedImage file={photo} alt={photo.name} fill sizes="(max-width: 700px) 100vw, 40vw" priority />
            : <Image src={FALLBACK_HERO} alt="" fill sizes="(max-width: 700px) 100vw, 40vw" className="object-cover" priority />}
        </div>
      </div>
    </div>
  )
}
```

The headline reads "{first name}, here's the plan for {project}." With no label, `project` is "your home"; with a label such as "Front & side yard refresh", it is that label lowercased. Confirm the `data.label` field name in `projectSectionSchema` before relying on it.

- [ ] **Step 2: The context card**

```tsx
// src/features/proposal-flow/ui/components/proposal/overview-context-card.tsx
'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
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
              <a href="#scope-of-work" className="grid min-h-12 grid-cols-[2rem_1fr] items-center rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold">
                <span className="tabular-nums text-(--presentation-accent)">{String(i + 1).padStart(2, '0')}</span>
                <span>
                  {section.title || `Part ${i + 1}`}
                  {section.trade.label && <span className="block text-xs font-normal text-muted-foreground">{section.trade.label}</span>}
                </span>
              </a>
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

The old label/value rows from `constants/project-overview-display.tsx` are dropped, because those fields are empty in every sampled proposal. Search for imports of `project-overview-display`. If there are none left, `git rm` the file in this task.

- [ ] **Step 4: Verify and commit**

Run `pnpm tsc` and `pnpm lint`, then screenshot at 1440, 820 and 390.

```bash
git add src/features/proposal-flow/ui/components/proposal/overview-hero.tsx src/features/proposal-flow/ui/components/proposal/overview-context-card.tsx src/features/proposal-flow/ui/components/proposal/project-overview.tsx
git diff --cached --stat
git commit -m "feat(proposal-flow): the overview opens on the homeowner's plan and contact card

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Trusted contractor chapter: the comparison

**Files:**
- Create: `src/features/proposal-flow/lib/get-comparison-rows.ts`
- Create: `src/features/proposal-flow/ui/components/proposal/comparison-list.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/trusted-contractor.tsx`

**Interfaces:**
- Consumes: `WHO_WE_ARE_SLIDES`, `COMPARISON_COLUMNS` (`@/features/meeting-flow/constants/who-we-are-slides`), `ComparisonRow` (`@/features/meeting-flow/types`).
- Produces: `getComparisonRows(): ComparisonRow[]`, which returns the `comparison` and `extras` slides' rows in order, and `ComparisonList({ rows })`.

- [ ] **Step 1: The selector**

```ts
// src/features/proposal-flow/lib/get-comparison-rows.ts
import type { ComparisonRow } from '@/features/meeting-flow/types'
import { WHO_WE_ARE_SLIDES } from '@/features/meeting-flow/constants/who-we-are-slides'

const SLIDE_IDS = ['comparison', 'extras']

export function getComparisonRows(): ComparisonRow[] {
  return SLIDE_IDS.flatMap((id) => {
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
            <th scope="col" className="bg-(--presentation-ground) px-4 py-3 font-bold text-white">{COMPARISON_COLUMNS.triPros}</th>
            <th scope="col" className="px-4 py-3 font-semibold text-muted-foreground">{COMPARISON_COLUMNS.others}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-b border-border align-top">
              <th scope="row" className="px-4 py-3 text-left font-bold">{row.label}</th>
              <td className="bg-(--presentation-ground)/5 px-4 py-3"><CheckIcon className="mr-2 inline size-4 text-(--presentation-accent)" />{row.triPros}</td>
              <td className="px-4 py-3 text-muted-foreground"><XIcon className="mr-2 inline size-4" />{row.others}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="grid gap-3 @min-[700px]/proposal:hidden">
        {rows.map(row => (
          <li key={row.label} className="overflow-hidden rounded-lg border border-border bg-card">
            <h3 className="px-4 pt-3 text-sm font-bold">{row.label}</h3>
            <p className="px-4 pt-2 text-sm"><CheckIcon className="mr-2 inline size-4 text-(--presentation-accent)" /><b>{COMPARISON_COLUMNS.triPros}: </b>{row.triPros}</p>
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
  - a `<details>` disclosure, `<summary>View license and insurance documents</summary>`, wrapping the existing document thumbnails;
  - the social buttons row.
- **Wrapper:** `px-4 py-12 sm:px-8` with an inner `mx-auto max-w-5xl grid gap-6`.

- [ ] **Step 4: Verify and commit**

Run `pnpm tsc` and `pnpm lint`. Screenshot at 1440 (table) and 390 (stacked cards). The documents must be collapsed by default.

```bash
git add src/features/proposal-flow/lib/get-comparison-rows.ts src/features/proposal-flow/ui/components/proposal/comparison-list.tsx src/features/proposal-flow/ui/components/proposal/trusted-contractor.tsx
git diff --cached --stat
git commit -m "feat(proposal-flow): trust is the meeting's contractor comparison, documents on demand

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Past results chapter

**Files:**
- Modify: `src/features/proposal-flow/ui/components/proposal/related-projects.tsx`

**Interfaces:**
- Consumes: `trpc.landingRouter.projectsRouter.getProjects` (public, returns `PublicProject[] = { project, heroImage }[]`), `OptimizedImage`, `ROOTS.landing.portfolioProject(accessor)`.

- [ ] **Step 1: Rewrite the chapter**

```tsx
'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'

import { OptimizedImage } from '@/shared/modules/media/core/components/display/optimized-image'
import { ROOTS } from '@/shared/config/roots'
import { useTRPC } from '@/trpc/helpers'

// Until the portfolio read can filter by trade, the first public projects stand in.
const SHOWN = 3

export function RelatedProjects() {
  const trpc = useTRPC()
  const projects = useQuery(trpc.landingRouter.projectsRouter.getProjects.queryOptions())
  const rows = (projects.data ?? []).filter(r => r.heroImage).slice(0, SHOWN)

  return (
    <div className="px-4 py-12 sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">Past results</p>
          <h2 id="related-projects-title" className="text-3xl font-semibold text-balance">Work we’ve finished for your neighbors</h2>
        </header>
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
      </div>
    </div>
  )
}
```

Remove the seed import (`@/shared/db/seeds/data/projects`) and `PROJECT_TYPES`. If `constants/project-types.ts` has no other importers, `git rm` it.

- [ ] **Step 2: Verify and commit**

Run `pnpm tsc` and `pnpm lint`; screenshot at 1440 and 390.

```bash
git add src/features/proposal-flow/ui/components/proposal/related-projects.tsx
git diff --cached --stat
git commit -m "feat(proposal-flow): past results come from the public portfolio, not a seed

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Next steps chapter

**Files:**
- Create: `src/features/proposal-flow/ui/components/proposal/next-steps.tsx`
- Modify: `src/features/proposal-flow/constants/proposal-steps.ts` (the agreement step's `Component` becomes `NextSteps`)
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx` (the agreement branch renders `<step.Component />`; `customizableSections` becomes `[]` and is removed with its import)

**Interfaces:**
- Consumes: `ContractStatusPanel` (`@/shared/components/contract-status-panel/ui/contract-status-panel`), `useProposalDocument()`.
- Produces: `NextSteps()`. The document **always** renders the homeowner contract view. Agents act in the cockpit (Task 13).

- [ ] **Step 1: Write the chapter**

```tsx
// src/features/proposal-flow/ui/components/proposal/next-steps.tsx
'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ContractStatusPanel } from '@/shared/components/contract-status-panel/ui/contract-status-panel'

export function NextSteps() {
  const { proposal, token } = useProposalDocument()
  return (
    <div className="bg-(--presentation-ground) px-4 py-12 text-white sm:px-8">
      <div className="mx-auto grid max-w-5xl gap-6">
        <header className="grid gap-2">
          <p className="text-xs font-bold uppercase tracking-widest text-(--presentation-accent)">Next steps</p>
          <h2 id="agreement-title" className="text-3xl font-semibold text-balance">Next steps</h2>
          <p className="text-white/80">Here’s how we get your project started.</p>
        </header>
        <div className="rounded-lg bg-card p-5 text-card-foreground">
          <ContractStatusPanel
            proposalId={proposal.id}
            token={token}
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

Point the agreement step at `NextSteps`. Drop its `as unknown as` cast, since `NextSteps` takes no props. Simplify the `index.tsx` step map to `<step.Component />` for every step. Run `pnpm tsc` and `pnpm lint`.

- [ ] **Step 3: Commit**

```bash
git add src/features/proposal-flow/ui/components/proposal/next-steps.tsx src/features/proposal-flow/constants/proposal-steps.ts src/features/proposal-flow/ui/components/proposal/index.tsx
git diff --cached --stat
git commit -m "feat(proposal-flow): the closing chapter is Next steps in the homeowner's words

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: `EntityCard` and the overview cards generalized

**Files:**
- Create: `src/shared/components/entities/entity-card/entity-card.tsx`
- Create: `src/shared/entities/customers/constants/presentable-insight-fields.ts`
- Modify: `src/shared/modules/proposals/core/components/overview-card.tsx`
- Modify: `src/shared/entities/customers/components/overview-card.tsx`
- Modify: `src/shared/entities/meetings/components/overview-card.tsx`

**Interfaces:**
- Produces:

```tsx
EntityCard({ className, children })                          // the outer surface
EntityCard.Header({ icon, eyebrow, title, subtitle, actions, className })
EntityCard.Body({ className, children })
EntityCard.Section({ label, children, className })
EntityCard.Footer({ className, children })
```

- `ProposalOverviewCard.Actions` and `MeetingOverviewCard.Actions` accept `mode?: 'compact' | 'bar' | 'toolbar'`. `ProposalOverviewCard` also gains `Footer` (an alias of `EntityCard.Footer` that stops click propagation).
- `CustomerOverviewCard` gains:
  - an `actions` context: the root takes `onView?`, `onEdit?`, `onScheduleMeeting?` and runs `useCustomerActionConfigs`;
  - `Actions({ mode })`;
  - `Notes({ notes, limit })`;
  - `PresentableInsights()`.
- `PRESENTABLE_INSIGHT_FIELDS: readonly ('timeInHome' | 'yearBuilt' | 'outcomePriority' | 'decisionTimeline')[]`.

- [ ] **Step 1: The primitive**

```tsx
// src/shared/components/entities/entity-card/entity-card.tsx
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
      {icon && <div className="grid size-9 shrink-0 place-items-center rounded-md border border-border bg-muted/50">{icon}</div>}
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>}
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
  return <div className={cn('flex flex-wrap items-center gap-2 border-t border-border bg-muted/30 px-4 py-3', className)}>{children}</div>
}

export const EntityCard = Object.assign(Root, { Header, Body, Section, Footer })
```

- [ ] **Step 2: Proposal and meeting cards accept toolbar mode and a footer**

In both overview cards, widen the `Actions` prop type to `mode?: 'compact' | 'bar' | 'toolbar'`. `EntityActionMenu` already renders `toolbar`.

In `ProposalOverviewCard`, add:

```tsx
import { EntityCard } from '@/shared/components/entities/entity-card/entity-card'

// Footers hold inputs and buttons; a click there must not open the proposal.
function Footer({ className, children }: { className?: string, children: ReactNode }) {
  return <div onClick={e => e.stopPropagation()}><EntityCard.Footer className={className}>{children}</EntityCard.Footer></div>
}
```

Then add `Footer` to the compound export. Existing callsites are unchanged.

- [ ] **Step 3: Presentable insights constant**

```ts
// src/shared/entities/customers/constants/presentable-insight-fields.ts
// Safe to show with the homeowner looking at the screen: never credit, age, household or selling plans.
export const PRESENTABLE_INSIGHT_FIELDS = ['timeInHome', 'yearBuilt', 'outcomePriority', 'decisionTimeline'] as const
```

- [ ] **Step 4: The customer card gains actions, notes and presentable insights**

In `src/shared/entities/customers/components/overview-card.tsx`:

1. Extend the context to carry `actions` from `useCustomerActionConfigs`. In `RootProps` add `onView?`, `onEdit?` and `onScheduleMeeting?`. The root calls

```ts
const { actions, DeleteConfirmDialog } = useCustomerActionConfigs<CustomerOverviewCardData>({ onView, onEdit, onScheduleMeeting })
```

and renders `<DeleteConfirmDialog />` first inside the provider. Add `actions` to the memoized value and its deps.

2. Add the parts:

```tsx
function Actions({ mode = 'compact', className }: { mode?: 'compact' | 'bar' | 'toolbar', className?: string }) {
  const { customer, actions } = useCard()
  return <EntityActionMenu entity={customer} actions={actions} mode={mode} className={className} />
}

function Notes({ notes, limit = 2 }: { notes: CustomerNoteWithAuthor[], limit?: number }) {
  const { customer } = useCard()
  return (
    <div className="grid gap-2" onClick={e => e.stopPropagation()}>
      <ul className="grid gap-2">
        {notes.slice(0, limit).map(note => (
          <li key={note.id} className="border-t border-border pt-2 text-sm first:border-t-0 first:pt-0">
            <p>{note.content}</p>
            <p className="text-xs text-muted-foreground">{[note.authorName, formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })].filter(Boolean).join(' · ')}</p>
          </li>
        ))}
      </ul>
      <QuickNoteInput customerId={customer.id} onSuccess={() => {}} />
    </div>
  )
}

function PresentableInsights() {
  const { customer } = useCard()
  const chips = PRESENTABLE_INSIGHT_FIELDS
    .map(key => customer[key])
    .filter((v): v is NonNullable<typeof v> => v != null && v !== '')
    .map(String)
  if (chips.length === 0) {
    return null
  }
  return (
    <ul className="flex flex-wrap gap-1.5">
      {chips.map(chip => <li key={chip} className="rounded-md bg-muted px-2 py-1 text-xs font-semibold">{chip}</li>)}
    </ul>
  )
}
```

The imports this needs:
- `formatDistanceToNow` from `date-fns`;
- `EntityActionMenu`;
- `QuickNoteInput` (`@/shared/entities/customers/components/timeline/quick-note-input`);
- `useCustomerActionConfigs`;
- `PRESENTABLE_INSIGHT_FIELDS`;
- the `CustomerNoteWithAuthor` type (`@/shared/entities/customers/types`).

Chips are shown as stored strings. If a field's stored value is an enum key, map it through the label constant that `ProfileCard` / `CUSTOMER_OVERVIEW_PROFILE_FIELDS` already uses for that field (open `customer-overview-profile-fields.ts` and reuse its formatter). Add `Actions`, `Notes` and `PresentableInsights` to the compound export.

3. `CustomerOverviewCard` has no other callsite (the records meeting-row customer pane was removed by the owner on 2026-10-01), so the cockpit is its only consumer. Confirm with `grep -rn "CustomerOverviewCard" src` and `pnpm tsc`.

- [ ] **Step 5: Verify and commit**

Run `pnpm tsc` and `pnpm lint`. Open the proposals table and a meeting card on the dashboard and screenshot both at 1440: their proposal and meeting cards must look unchanged.

```bash
git add src/shared/components/entities/entity-card/entity-card.tsx src/shared/entities/customers/constants/presentable-insight-fields.ts src/shared/modules/proposals/core/components/overview-card.tsx src/shared/entities/customers/components/overview-card.tsx src/shared/entities/meetings/components/overview-card.tsx
git diff --cached --stat
git commit -m "feat(entities): a shared EntityCard layout; overview cards gain toolbar actions, footers and customer notes

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: "View internal financials" proposal action

**Files:**
- Modify: `src/shared/modules/proposals/core/constants/actions.ts`
- Modify: `src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts`
- Modify: `src/shared/modules/proposals/core/components/overview-card.tsx` (root passes the override through)

**Interfaces:**
- Produces: `PROPOSAL_ACTIONS.internalFinancials`. `useProposalActionConfigs({ …, onInternalFinancials?: (entity: T) => void })` includes the action only when the override is passed. `ProposalOverviewCard` root prop `onInternalFinancials?`.

- [ ] **Step 1: The action constant**

Add to `PROPOSAL_ACTIONS`, after `edit`, and import `CalculatorIcon`:

```ts
internalFinancials: {
  id: 'internalFinancials',
  label: 'View Internal Financials',
  icon: CalculatorIcon,
  permission: ['update', 'Proposal'],
},
```

- [ ] **Step 2: The config entry**

In `ProposalActionOverrides` add `onInternalFinancials?: (entity: T) => void`. In the configs array, after the `edit` entry:

```ts
...(overrides.onInternalFinancials
  ? [{ action: PROPOSAL_ACTIONS.internalFinancials, onAction: overrides.onInternalFinancials }]
  : []),
```

- [ ] **Step 3: The card passes it through**

In `ProposalOverviewCardProps`, add `'onInternalFinancials'?: (entity: ProposalOverviewCardData) => void`. Destructure it in the root and pass it into `useProposalActionConfigs({ onView, onEdit, onAssignOwner, onInternalFinancials })`.

- [ ] **Step 4: Verify and commit**

Run `pnpm tsc` and `pnpm lint`. Open the proposals table's row menu: no "View Internal Financials" entry, because no override is passed there.

```bash
git add src/shared/modules/proposals/core/constants/actions.ts src/shared/modules/proposals/core/hooks/use-proposal-action-configs.ts src/shared/modules/proposals/core/components/overview-card.tsx
git diff --cached --stat
git commit -m "feat(proposals): a View Internal Financials action any host can offer

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: The cockpit

**Files:**
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit-proposal-card.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/send-composer.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit-agreement-card.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit-customer-card.tsx`
- Create: `src/features/proposal-flow/ui/components/cockpit/cockpit-meeting-card.tsx`
- Modify: `src/features/proposal-flow/ui/components/proposal/index.tsx`

**Interfaces:**
- Consumes:
  - `ResponsiveSheet` (`@/shared/components/dialogs/sheets/responsive-sheet`);
  - `ProposalOverviewCard` (with `Footer`, `toolbar`, `onInternalFinancials`), `CustomerOverviewCard`, `MeetingOverviewCard`, `EntityCard` (Tasks 11–12);
  - `EnvelopeCard` (`@/shared/components/contract-status-panel/ui/envelope-card`), `useContractStatus` (`@/shared/components/contract-status-panel/hooks/use-contract-status`);
  - `useSendProposal`, `InternalFinancialsModal`, `useModalStore`, `toFundingInputs`;
  - `trpc.customerPipelinesRouter.getCustomerProfile`.
- Produces: `Cockpit({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void })`.

- [ ] **Step 1: The send composer**

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
    if (!email || !proposal.token) {
      return
    }
    send.mutate(
      { proposalId: proposal.id, customerName: proposal.customer?.name ?? '', email, token: proposal.token, message: message.trim() || undefined },
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

Check the `sendProposalEmail` input against `delivery.router.ts:22-64` before relying on these field names (`proposalId`, `customerName`, `email`, `token`, `message`).

- [ ] **Step 2: The proposal card**

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit-proposal-card.tsx
'use client'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { InternalFinancialsModal } from '@/features/proposal-flow/ui/components/internal-financials-modal'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { ProposalOverviewCard } from '@/shared/modules/proposals/core/components/overview-card'
import { computeFinalTcp } from '@/shared/modules/proposals/core/lib/financials'
import { toFundingInputs } from '@/shared/modules/proposals/core/lib/funding-columns'
import { SendComposer } from './send-composer'

export function CockpitProposalCard() {
  const { proposal } = useProposalDocument()
  const { open, setModal } = useModalStore()
  const funding = toFundingInputs(proposal)

  function openInternalFinancials() {
    setModal({
      accessor: 'InternalFinancials',
      Component: InternalFinancialsModal,
      props: { funding, sow: proposal.projectJSON.data.sow, priceDisplayMode: proposal.priceDisplayMode },
    })
    open()
  }

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
      onInternalFinancials={openInternalFinancials}
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
        <ProposalOverviewCard.Actions mode="toolbar" />
      </ProposalOverviewCard.Body>
      <ProposalOverviewCard.Footer>
        <SendComposer />
      </ProposalOverviewCard.Footer>
    </ProposalOverviewCard>
  )
}
```

Check the exact props of `StatusIconTile`, `Label` and `Fields` in `overview-card.tsx` and match the existing callers (for example `dashboard-proposal-card.tsx:31`). The view count needs `viewCount` on the data, which `getFullView` doesn't carry, so leave it out.

- [ ] **Step 3: The agreement card**

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit-agreement-card.tsx
'use client'

import { FileSignatureIcon } from 'lucide-react'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { useContractStatus } from '@/shared/components/contract-status-panel/hooks/use-contract-status'
import { EnvelopeCard } from '@/shared/components/contract-status-panel/ui/envelope-card'
import { EntityCard } from '@/shared/components/entities/entity-card/entity-card'

export function CockpitAgreementCard() {
  const { proposal } = useProposalDocument()
  const { data: contractStatus } = useContractStatus(proposal.id, proposal.token ?? undefined)
  return (
    <EntityCard>
      <EntityCard.Header icon={<FileSignatureIcon className="size-4" />} eyebrow="Agreement" title={proposal.kind === 'initial-sale' ? 'Initial sale' : 'Additional work'} />
      <EntityCard.Body>
        <EnvelopeCard proposalId={proposal.id} contractStatus={contractStatus ?? null} customerName={proposal.customer?.name ?? null} proposalKind={proposal.kind} />
      </EntityCard.Body>
    </EntityCard>
  )
}
```

`EnvelopeCard` already carries the timeline, signer grid, envelope-configuration switches (required documents locked) and the Create draft, Submit, Recall and Resend actions. Its logic is not forked. If its own outer border doubles inside `EntityCard.Body`, pass the outer-surface override `EnvelopeCard` accepts. If it accepts none, wrap it in `[&>*]:border-0 [&>*]:shadow-none` on the body.

**Tighten the switch rows (D14) at the source.** In `src/shared/components/contract-status-panel/ui/envelope-configuration-section.tsx`, set the documents list container's gap to `gap-0` and each switch row to `min-h-9 py-1`. Read the file and change only those two classes. Add that file to this task's `git add`.

- [ ] **Step 4: The customer and meeting cards**

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit-customer-card.tsx
'use client'

import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { UserIcon } from 'lucide-react'
import { EntityCard } from '@/shared/components/entities/entity-card/entity-card'
import { CustomerOverviewCard } from '@/shared/entities/customers/components/overview-card'

export function CockpitCustomerCard({ profile }: { profile: CustomerProfileData }) {
  return (
    <EntityCard>
      <CustomerOverviewCard customer={profile.customer} className="gap-0">
        <EntityCard.Header icon={<UserIcon className="size-4" />} eyebrow="Customer" title={profile.customer.name} actions={<CustomerOverviewCard.Actions mode="compact" />} />
        <EntityCard.Body>
          <CustomerOverviewCard.ContactActions />
          <CustomerOverviewCard.PresentableInsights />
          <EntityCard.Section label="Notes">
            <CustomerOverviewCard.Notes notes={profile.notes} />
          </EntityCard.Section>
        </EntityCard.Body>
      </CustomerOverviewCard>
    </EntityCard>
  )
}
```

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit-meeting-card.tsx
'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'

export function CockpitMeetingCard({ meeting, customerId }: { meeting: CustomerProfileMeeting, customerId: string }) {
  return (
    <MeetingOverviewCard meeting={meeting} customerId={customerId} className="overflow-hidden rounded-lg border border-border bg-card">
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

```tsx
// src/features/proposal-flow/ui/components/cockpit/cockpit.tsx
'use client'

import { useQuery } from '@tanstack/react-query'

import { useProposalDocument } from '@/features/proposal-flow/contexts/proposal-document-context'
import { ResponsiveSheet } from '@/shared/components/dialogs/sheets/responsive-sheet'
import { useTRPC } from '@/trpc/helpers'
import { CockpitAgreementCard } from './cockpit-agreement-card'
import { CockpitCustomerCard } from './cockpit-customer-card'
import { CockpitMeetingCard } from './cockpit-meeting-card'
import { CockpitProposalCard } from './cockpit-proposal-card'

interface Props { open: boolean, onOpenChange: (open: boolean) => void }

export function Cockpit({ open, onOpenChange }: Props) {
  const { proposal } = useProposalDocument()
  const trpc = useTRPC()
  const customerId = proposal.customer?.id
  const profile = useQuery({
    ...trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId: customerId ?? '' }),
    enabled: open && Boolean(customerId),
  })
  const meeting = profile.data?.meetings.find(m => m.id === proposal.meetingId)

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cockpit"
      description={[proposal.customer?.name, proposal.label].filter(Boolean).join(' · ')}
      sheetClassName="sm:max-w-[460px]"
      drawerClassName="max-h-[85dvh]"
    >
      <div className="grid content-start gap-3 overflow-y-auto overscroll-contain p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <CockpitProposalCard />
        <CockpitAgreementCard />
        {profile.data && <CockpitCustomerCard profile={profile.data} />}
        {profile.data && meeting && customerId && <CockpitMeetingCard meeting={meeting} customerId={customerId} />}
      </div>
    </ResponsiveSheet>
  )
}
```

- [ ] **Step 6: Mount it**

In `index.tsx`, inside the provider, render `{viewMode === 'agent' && <Cockpit open={cockpitOpen} onOpenChange={setCockpitOpen} />}`.

- [ ] **Step 7: Verify**

Run `pnpm tsc` and `pnpm lint`. In the browser with `?view=agent`:
- At 1180 the cockpit opens as a right sheet, the document dims and doesn't shift, and no scrollbar is visible.
- At 820 and 390 it opens as a bottom drawer.
- Focus returns to the Cockpit button on close.
- "View Internal Financials" opens the modal.
- On an `initial-sale` proposal the switches show required documents disabled.

Intercept any send with `page.route` (never send email).

- [ ] **Step 8: Commit**

```bash
git add src/features/proposal-flow/ui/components/cockpit src/features/proposal-flow/ui/components/proposal/index.tsx src/shared/components/contract-status-panel/ui/envelope-configuration-section.tsx
git diff --cached --stat
git commit -m "feat(proposal-flow): an agent cockpit of entity cards in a responsive sheet

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: Remove what the redesign replaced

**Files:**
- Delete: `src/features/proposal-flow/ui/components/proposal/heading.tsx`
- Delete: `src/features/proposal-flow/ui/components/proposal/copy-sow-button.tsx`
- Delete: `src/features/proposal-flow/ui/components/proposal/send-proposal-link.tsx`

- [ ] **Step 1: Confirm no importers, then delete**

```bash
grep -rn "proposal/heading'\|copy-sow-button\|send-proposal-link" src
```

Expected: no matches, because Tasks 2 and 4 removed the uses. Then:

```bash
git rm src/features/proposal-flow/ui/components/proposal/heading.tsx src/features/proposal-flow/ui/components/proposal/copy-sow-button.tsx src/features/proposal-flow/ui/components/proposal/send-proposal-link.tsx
```

- [ ] **Step 2: Check `useCurrentProposal` is the route host's feeder only**

```bash
grep -rn "useCurrentProposal" src
```

Expected: only `proposal/index.tsx` and the hook file. Anything else migrates to `useProposalDocument()` in this task.

- [ ] **Step 3: Verify and commit**

Run `pnpm tsc` and `pnpm lint`.

```bash
git diff --cached --stat
git commit -m "refactor(proposal-flow): drop the heading, copy-SOW and dead send-link components

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: Browser verification (spec §7)

**Files:**
- Create (scratch, not committed): `.superpowers/sdd/2026-10-01-proposal-page/pw/verify.cjs`

The script uses `require('<repo>/node_modules/playwright')`. It signs in through `/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET>&redirect=…` (see `reference-playwright-auth.md`). It aborts `**/*recordView*` and intercepts every mutation (`**/proposalsRouter.funding.setCashInDeal**`, `**/proposalsRouter.crud.update**`, `**/proposalsRouter.delivery.**`, `**/customerNotesRouter.**`, `**/contracts.**` mutations) with a 200 and a captured response body. Screenshots go to `.superpowers/sdd/2026-10-01-proposal-page/pw/shots/`. Stop the dev server, run `rm -rf .next`, and restart before the run.

- [ ] **Step 1: Layout at every viewport**

At 1440, 1180, 820, 390 and 360, light and dark (`emulateMedia({ colorScheme })`), assert:
- `document.documentElement.scrollWidth <= innerWidth` (no horizontal page scroll);
- the rail is visible at ≥1100 container width and hidden below;
- each tab's `scrollWidth <= clientWidth` (no cut-off labels) at 360.

Take a full-page screenshot per viewport and scheme.

- [ ] **Step 2: Cockpit**

At 1180, click Cockpit and assert:
- a `[role=dialog]` sits at the right edge;
- the document's `getBoundingClientRect().left` is unchanged;
- the sheet body's `offsetWidth - clientWidth === 0` (no visible scrollbar).

Press Escape and assert focus is on the Cockpit button. At 820 and 390, assert the drawer is anchored to the bottom.

- [ ] **Step 3: Homeowner sees no agent controls**

Load the page with the token and no `?view=agent`, in two contexts: logged out, and logged in as an agent. In each, assert that these return 0:
- `getByText('Cockpit')`;
- `getByText('View Internal Financials')`;
- `getByRole('button', { name: /copy/i })` inside `#scope-of-work`;
- a `textarea` anywhere.

- [ ] **Step 4: Pricing**

On a breakdown proposal and a total-mode proposal, read the "Final contract price" text and compare it with the dollar amount computed by `buildPricingBreakdown` for the same data. Use the `getFullView` response captured with `page.waitForResponse`, and compute in the script by re-implementing the sum: `startingTcp − Σ section incentives − Σ discounts`, floored at 0. On the total-mode page, assert no part row contains a `$` value.

- [ ] **Step 5: Slider**

At 1180:
- choose "Some cash";
- focus the slider thumb and press ArrowRight ten times;
- wait 1000ms and assert exactly one intercepted `setCashInDeal` request, with `cashInDeal === 5000`;
- assert that "to finance" changed and every monthly payment changed;
- press End and assert the shown maximum leaves ≥ $3,500 financed.

- [ ] **Step 6: Scope**

On a proposal whose sections include both description forms, assert:
- every phase row's step count is ≥ 1 (no "0 steps");
- the "Key details" `dl` exists;
- a section whose `contentJSON` fails to parse falls back to HTML. Simulate this by rewriting the captured `getFullView` response through `page.route` with one section's `contentJSON` set to `"x"`.

- [ ] **Step 7: Page height versus baseline**

Record `#proposal-container.scrollHeight` at 1440 and 390 and compare them with the baseline (9,932px and 16,055px). Report both numbers; the phone number should drop.

- [ ] **Step 8: Report**

Write `.superpowers/sdd/2026-10-01-proposal-page/verify.md`:
- one line per step: pass or fail, with the screenshot path;
- the page heights;
- anything skipped and why.

Then hand off to the owner:
- the real-iPad touch check (F5);
- the R1 release gate;
- the R2–R7 hand-offs.

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
  | §2 D7, D8, D17, D21 | 13 |
  | §2 D9 | 13 (toolbar, composer, contact) |
  | §2 D10 | 12–13 |
  | §2 D11 | 13 + Review Focus 1 |
  | §2 D12 | 13 (until R2) |
  | §2 D13–D14 | 13 (`EnvelopeCard`, switch rows) |
  | §2 D15 | 1–2 |
  | §2 D16 | 10 |
  | §2 D18 | 3–4 |
  | §2 D19 | 5 |
  | §2 D20, D22–D23 | 6 |
  | §2 D24 | 6 (cash and finance saved; mode local until R7) |
  | §4.1 | 1 |
  | §4.2 | 2 |
  | §4.3 | 6, 13, 14 + Review Focus 1 |
  | §4.4 | 11–13 |
  | §4.5 | 5–6 |
  | §4.6 | 3 |
  | §4.7 | 2, 4 (`motion-reduce`) |
  | §4.8 | 2, 6, 8, 13 |
  | §4.9 | Global Constraints (existing presentation tokens; no new tokens) |
  | §6 | 4 (fallbacks), 6 (bounds, clamping, debounce, pagehide), 13 (missing email) |
  | §7 | 15 |

- **Gaps intentionally left to the R7 amendment:** payment-mode persistence, the scheduled-payments list and its cockpit editor dialog, and the "price changed after a saved schedule" warning.
- **Type names used across tasks:** `ProposalDocument`, `useProposalDocument`, `PaymentMode`, `getCashDownBounds`, `clampCashDown`, `isPaymentModeAvailable`, `MIN_FINANCED_AMOUNT`, `CASH_DOWN_STEP`, `PricePart`, `buildPriceParts`, `ParsedSowSection`, `parseSowSection`, `EntityCard`, `PRESENTABLE_INSIGHT_FIELDS`, `PROPOSAL_ACTIONS.internalFinancials`, `onInternalFinancials`. Each is defined once and used under the same name in every task that consumes it.
