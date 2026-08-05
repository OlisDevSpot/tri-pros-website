# Proposal Portfolio-by-Trade — Implementation Plan (Plan 2 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the proposal's static before/after "Past Results" slider with **real portfolio projects matched to the proposal's selected trades** (scope-id intersection), capped at 7, with a latest-projects fallback and a "View our other projects" link.

**Architecture:** Rewrite `RelatedProjects` (a no-props proposal step) to self-fetch `showroomDisplay.getAll` + the Notion trades/scopes catalogs (all public `baseProcedure`s), intersect each project's `scopeIds` against the union of the proposal's `sow[].scopes[].id`, dedupe, cap 7, and render the existing `PortfolioGrid`. Pure selection logic lives in a testable helper. Fallback = latest 7 public projects. Independent of Plans 1/1b.

**Tech Stack:** Next.js 15, tRPC, TanStack Query, Tailwind v4, shadcn/ui, `motion/react`.

**Design spec:** `docs/superpowers/specs/2026-08-05-proposal-capabilities-media-portfolio-finance-design.md` (Feature 2).

## Global Constraints

- **Verification model (NO unit-test runner):** each task closes with `pnpm tsc` (no errors) + `pnpm lint` (clean) + the stated manual check. Never `pnpm build`.
- **Ids are Notion string ids:** `sow[].trade.id` / `sow[].scopes[].id` share the id-space of `PortfolioProject.scopeIds` — intersect directly, never FK to `trades.id`.
- **Public data path:** the proposal renders for homeowner (token) too — only `baseProcedure` queries (`showroomDisplay.getAll`, `notionRouter.{trades,scopes}.getAll`) may be used. All three are confirmed `baseProcedure`.
- **Feature→feature import** (`proposal-flow` → `project-management` `PortfolioGrid`) is acceptable — it's the established pattern (`meeting-flow` already imports it). The **shared→features** ban does not apply here.
- **Cap = 7** total, deduped across trades.
- **Git:** work on `main`, stage by explicit path. Commit trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- **Conventions:** one component per file, named exports, `motion/react`, entity co-location, `memory/coding-conventions.md`.

---

## File Structure

**Create:**
- `src/features/proposal-flow/lib/select-portfolio-for-proposal.ts` — pure selection helper.

**Modify:**
- `src/features/proposal-flow/ui/components/proposal/related-projects.tsx` — full rewrite (self-fetch + intersect + `PortfolioGrid` + view-more link; drop seed data + `CustomImageSlider`).
- DOCS: a short note in `src/features/proposal-flow/DOCS.md` (or `proposals/DOCS.md`) on the portfolio-by-trade rule; tick Feature 2 in the spec checklist.

**Unchanged (verify not broken):** `src/shared/components/image-slider.tsx` (`CustomImageSlider`) — stays in the repo, now with zero importers (spec: kept, unused).

---

## Task 1: Pure portfolio-selection helper

**Files:** Create `src/features/proposal-flow/lib/select-portfolio-for-proposal.ts`

**Interfaces:**
- Consumes: `PortfolioProject` (`@/shared/entities/projects/types` — `{ project: Project, heroImage, scopeIds: string[] }`).
- Produces: `selectPortfolioForProposal(sow, allProjects): ProposalPortfolioSelection` where `ProposalPortfolioSelection = { projects: PortfolioProject[], tradeIds: string[], usedFallback: boolean }`.

- [ ] **Step 1:** Implement the pure helper (no React, no fetching — the whole matching rule in one place):

```ts
// src/features/proposal-flow/lib/select-portfolio-for-proposal.ts
import type { PortfolioProject } from '@/shared/entities/projects/types'

/** Max portfolio projects to show in the proposal section. */
export const MAX_PROPOSAL_PORTFOLIO = 7

/** Structural view of the proposal SOW this helper needs (avoids importing the full schema type). */
export interface SowSectionRef {
  trade: { id: string }
  scopes: { id: string }[]
}

export interface ProposalPortfolioSelection {
  /** Deduped, capped list to render. */
  projects: PortfolioProject[]
  /** Unique selected trade ids — for the "view our other projects" pre-filtered link. */
  tradeIds: string[]
  /** true when no project matched the selected scopes and we fell back to latest projects. */
  usedFallback: boolean
}

/**
 * Match public portfolio projects to a proposal's selected trades by scope-id intersection.
 * A project matches if ANY of its scopeIds is in the union of the proposal's selected scope ids.
 * Falls back to the latest projects (by creation date) when nothing matches.
 */
export function selectPortfolioForProposal(
  sow: SowSectionRef[],
  allProjects: PortfolioProject[],
): ProposalPortfolioSelection {
  const tradeIds = [...new Set(sow.map(s => s.trade.id))]
  const scopeIds = new Set(sow.flatMap(s => s.scopes.map(sc => sc.id)))

  const matched = allProjects.filter(p => p.scopeIds.some(id => scopeIds.has(id)))
  if (matched.length > 0)
    return { projects: matched.slice(0, MAX_PROPOSAL_PORTFOLIO), tradeIds, usedFallback: false }

  const latest = [...allProjects]
    .sort((a, b) => String(b.project.createdAt ?? '').localeCompare(String(a.project.createdAt ?? '')))
    .slice(0, MAX_PROPOSAL_PORTFOLIO)
  return { projects: latest, tradeIds, usedFallback: true }
}
```

- [ ] **Step 2:** `pnpm tsc && pnpm lint`. Sanity-check the types against `PortfolioProject` (confirm `.project.createdAt` exists — it does, via schema-helpers). Commit (`feat(proposal): pure portfolio-by-trade selection helper`).

---

## Task 2: Rewrite `RelatedProjects`

**Files:** Modify `src/features/proposal-flow/ui/components/proposal/related-projects.tsx`

**Interfaces:**
- Consumes: `useCurrentProposal()` (proposal with `.data.projectJSON.data.sow`), `trpc.projectsRouter.showroomDisplay.getAll`, `trpc.notionRouter.trades.getAll`, `trpc.notionRouter.scopes.getAll`, `selectPortfolioForProposal` (Task 1), `PortfolioGrid` (`@/features/project-management/ui/components/portfolio-grid`), `ROOTS.landing.portfolioProjects()`.

- [ ] **Step 1:** Replace the whole component. Self-fetch the three public queries, compute the selection, render `PortfolioGrid` + a new-tab pre-filtered link. Keep the existing loading/null guards and heading source (`PROJECT_TYPES[proposal.data.projectJSON.data.type]`). Remove the `projectsData` seed import and `CustomImageSlider` usage.

```tsx
'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import { ROOTS } from '@/shared/config/roots'
import { PortfolioGrid } from '@/features/project-management/ui/components/portfolio-grid'
import { useTRPC } from '@/trpc/helpers'
import { useCurrentProposal } from '@/features/proposal-flow/hooks/use-current-proposal'
import { selectPortfolioForProposal } from '@/features/proposal-flow/lib/select-portfolio-for-proposal'

export function RelatedProjects() {
  const trpc = useTRPC()
  const proposal = useCurrentProposal()

  const { data: allProjects = [] } = useQuery(trpc.projectsRouter.showroomDisplay.getAll.queryOptions())
  const { data: allTrades = [] } = useQuery(trpc.notionRouter.trades.getAll.queryOptions())
  const { data: allScopes = [] } = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())

  const sow = proposal?.data.projectJSON.data.sow ?? []
  const { projects, tradeIds, usedFallback } = useMemo(
    () => selectPortfolioForProposal(sow, allProjects),
    [sow, allProjects],
  )

  if (!proposal)
    return null

  const viewMoreHref = `${ROOTS.landing.portfolioProjects()}${tradeIds.length ? `?trades=${tradeIds.join(',')}` : ''}`

  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold">Our Work</h2>
      <p className="text-muted-foreground mt-1 text-sm">
        {usedFallback ? 'A selection of our recent projects.' : 'Projects like yours, from our portfolio.'}
      </p>

      <div className="mt-6">
        <PortfolioGrid projects={projects} allScopes={allScopes} allTrades={allTrades} />
      </div>

      <div className="mt-6 flex justify-center">
        <Button asChild variant="outline">
          <a href={viewMoreHref} target="_blank" rel="noopener noreferrer">View our other projects</a>
        </Button>
      </div>
    </Card>
  )
}
```

> Confirm the exact import paths for `Button`/`Card`/`useTRPC`/`ROOTS`/`useCurrentProposal` against the pre-rewrite file (they were already imported there or in sibling steps). `PortfolioGrid` empty-state handles `projects.length === 0` internally.

- [ ] **Step 2:** `grep -n "projectsData\|CustomImageSlider\|image-slider\|hero-before\|hero-after" src/features/proposal-flow/ui/components/proposal/related-projects.tsx` → empty (all legacy removed).
- [ ] **Step 3:** `pnpm tsc && pnpm lint`.
- [ ] **Step 4: Manual verification** (`pnpm dev`):
  1. Open a proposal whose SOW has trades with matching portfolio projects → the section shows real matched projects (≤ 7), no slider.
  2. Open a proposal whose SOW trades have NO matching projects → shows the latest 7 public projects with the "recent projects" subheading.
  3. "View our other projects" opens `/portfolio/projects?trades=<ids>` in a **new tab**, and the portfolio page is pre-filtered to those trades.
  4. Render as a homeowner (token) view — the section still loads (public queries).
- [ ] **Step 5:** Commit (`feat(proposal): portfolio-by-trade section replaces before/after slider`).

---

## Task 3: Docs + checklist

**Files:** Modify `src/features/proposal-flow/DOCS.md` (create if absent) or `src/shared/entities/proposals/DOCS.md`; the spec's Feature 2 checklist

- [ ] **Step 1:** Add a short rule: "The proposal 'Our Work' section shows portfolio projects whose `scopeIds` intersect the proposal SOW's selected scope ids (Notion id-space), deduped + capped at 7; falls back to the latest 7 public projects; the 'View our other projects' link deep-links `/portfolio/projects?trades=…` in a new tab. Logic: `select-portfolio-for-proposal.ts`."
- [ ] **Step 2:** Tick Feature 2 items in `docs/superpowers/specs/2026-08-05-proposal-capabilities-media-portfolio-finance-design.md`.
- [ ] **Step 3:** `pnpm lint`; commit (`docs(proposal): portfolio-by-trade rule + checklist`).

---

## Self-Review

**Spec coverage (Feature 2):** rewrite via `showroomDisplay.getAll` + Notion catalogs + scope-id intersection → Task 2 ✅; cap 7 + dedupe → Task 1 (flat filter + `slice(0,7)`) ✅; fallback latest 7 → Task 1 ✅; reuses `PortfolioGrid` → Task 2 ✅; "View our other projects" new-tab pre-filtered link → Task 2 ✅; legacy seed + `CustomImageSlider` no longer used → Task 2 Step 2 ✅.

> Note: the spec mentions `PortfolioGrid`/`TradeProjectGrid`. The section wants a **flat deduped capped-7 list**, not per-trade groups — so `PortfolioGrid` (flat) is the correct fit; `TradeProjectGrid` (per-trade grouping w/ pagination) is not used here.

**Placeholder scan:** none. The one flagged confirmation (import paths for `Button`/`Card`/etc.) is a "match the existing file" check, not a placeholder.

**Type consistency:** `selectPortfolioForProposal`/`ProposalPortfolioSelection`/`SowSectionRef`/`MAX_PROPOSAL_PORTFOLIO`, `PortfolioProject`, `PortfolioGrid` props (`projects`/`allScopes`/`allTrades`) — consistent.

**Risk:** minimal (one display section, public data). No schema/DB changes. `CustomImageSlider` intentionally left in the repo unused per spec.
