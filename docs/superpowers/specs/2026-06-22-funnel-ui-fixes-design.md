# Funnel UI fixes — carousel URLs + question width

> **Status (updated 2026-06-22):** Fix 2 (question max-width) shipped. **Fix 1 (carousel URL) is SUPERSEDED** by `2026-06-22-url-origin-routing-system-design.md` — the relative-path fix below is insufficient on a funnel subdomain; the carousel link is now part of the unified URL/origin routing system.

**Date:** 2026-06-22
**Scope:** Two surgical UI fixes to the funnel engine (`src/shared/domains/funnels/`), verified against the `/funnels/kitchens` route. No behavior changes beyond the two below.

## Context

The funnel engine renders a landing (with the first/micro-commitment question), a sequence of question steps, and a terminal confirmation. Width is governed by one content rail (`FUNNEL_RAIL_MAX_W = 'max-w-5xl'`); the documented intent is that content which should read narrower constrains INTERNALLY with its own `max-w-*` (see `constants/funnel-layout.ts`).

---

## Fix 1 — Confirmation carousel project URLs are broken

### Problem
The "recent Tri Pros work" carousel on the confirmation page links projects to a route that does not exist.

- `src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx:61`
  ```ts
  href: `/portfolio-projects/${p.project.accessor}`   // ❌ no such route
  ```
- Real route: `/portfolio/projects/[projectAccessor]` (filesystem) — canonical builder is `ROOTS.landing.portfolioProjects()` (`src/shared/config/roots.ts:52`, returns `/portfolio/projects`).
- Canonical usage already in the codebase: `src/features/project-management/ui/components/portfolio-project-card.tsx:44`
  ```ts
  <Link href={`${ROOTS.landing.portfolioProjects()}/${project.accessor}`}>
  ```

### Change
In `funnel-project-carousel.tsx`:
- Add the `ROOTS` import (from `@/shared/config/roots`, matching how `portfolio-project-card.tsx` imports it; respect `perfectionist/sort-imports`).
- Replace the hardcoded `href` with:
  ```ts
  href: `${ROOTS.landing.portfolioProjects()}/${p.project.accessor}`   // → /portfolio/projects/<accessor>
  ```

### Decisions
- **No `accessor` guard.** `project.accessor` is optional, but the canonical `portfolio-project-card.tsx` does not guard against a missing accessor either. We match that for parity. If the showroom display ever returns accessor-less projects, that is a data concern handled upstream, not in the carousel.

### Verification
- `pnpm lint && pnpm tsc` clean.
- On `/funnels/kitchens` confirmation page, each carousel slide links to `/portfolio/projects/<accessor>` and resolves to a real project page.

---

## Fix 2 — Narrow the question content on card-select steps

### Problem
The first/micro-commitment question reads narrow because `FunnelLanding` wraps it in `max-w-xl` (`funnel-landing.tsx:98`). Every *subsequent* question step inherits the full `max-w-5xl` rail (`funnel-engine.tsx:83`) and `CardSelectStepView` adds no inner constraint (`card-select-step.tsx:24`), so the heading + 2-col card grid stretch the full rail width — visually inconsistent with the first question.

> Note: the original request assumed the micro-commitment question used `max-w-3xl`. It actually uses `max-w-xl`. Confirmed target width: **`max-w-xl`**, matching the first question. Confirmed scope: **card-select question steps only** (layout, home-type, scope, age). Location/address keep their internal `max-w-md` input constraints; PII and confirmation are untouched.

### Approach A (chosen): shared constant + internal constraint
This matches the documented "constrain INTERNALLY" architecture and gives one source of truth for the question width.

1. **`constants/funnel-layout.ts`** — add, as a sibling to `FUNNEL_RAIL_MAX_W`, with a docblock explaining it is the narrow rail for an individual question's content (heading + options):
   ```ts
   export const FUNNEL_QUESTION_MAX_W = 'max-w-xl'
   ```
   (Full literal class string so Tailwind picks it up — same pattern as `FUNNEL_RAIL_MAX_W`.)

2. **`ui/steps/card-select-step.tsx:24`** — constrain the question root internally and center it within whatever rail contains it:
   ```ts
   // before
   <div className="flex flex-col gap-6">
   // after — uses FUNNEL_QUESTION_MAX_W
   <div className={cn('mx-auto flex w-full flex-col gap-6', FUNNEL_QUESTION_MAX_W)}>
   ```
   - On subsequent steps: centers the question narrowly inside the `max-w-5xl` rail.
   - On the landing: nests harmlessly inside the existing `max-w-xl` wrapper (same width).
   - `cn` is already imported; add the `FUNNEL_QUESTION_MAX_W` import (respect import sorting).

3. **`ui/funnel-landing.tsx:98`** — replace the hardcoded `max-w-xl` with the same constant so the micro-commitment and the steps stay locked together by one source of truth:
   ```ts
   // before
   <div className="flex w-full max-w-xl flex-col gap-8 px-5">
   // after
   <div className={cn('flex w-full flex-col gap-8 px-5', FUNNEL_QUESTION_MAX_W)}>
   ```
   - Verify `cn` is imported in `funnel-landing.tsx`; add if missing. The `px-5` and `gap-8` here belong to the landing wrapper (TrustBar + question), so they stay — only the width token moves to the constant.

### Approaches considered and rejected
- **B — constrain in the engine's step wrapper (`funnel-engine.tsx`).** Would narrow *all* step types (location/address/PII/confirmation), violating the card-select-only scope. Rejected.
- **C — hardcode `max-w-xl` inline in `card-select-step.tsx`, no shared constant.** Smallest diff, but leaves two hardcoded `max-w-xl` values (landing + step) that can drift. A is barely more work and yields a single source of truth. Rejected.

### Verification
- `pnpm lint && pnpm tsc` clean.
- On `/funnels/kitchens`: the first question and every subsequent card-select question (home-type, layout, scope, age) render at the same `max-w-xl` width, centered. Location/address inputs still `max-w-md`; confirmation unchanged.

---

## Conventions honored
- Constants live in `constants/`; no file-level constants added to component files.
- One canonical URL builder (`ROOTS.landing.portfolioProjects()`); no ad-hoc route strings.
- Import sorting (`perfectionist/sort-imports`) and `antfu/if-newline` respected.
- Staged explicitly on `main` (no feature branch) per repo working style.

## Files touched
- `src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx` (Fix 1)
- `src/shared/domains/funnels/constants/funnel-layout.ts` (Fix 2)
- `src/shared/domains/funnels/ui/steps/card-select-step.tsx` (Fix 2)
- `src/shared/domains/funnels/ui/funnel-landing.tsx` (Fix 2)
