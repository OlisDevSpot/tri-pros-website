# Funnel card-select layout system

**Date:** 2026-06-26
**Status:** Approved — implementing
**Scope:** `src/shared/domains/funnels/ui/steps/card-select-step.tsx` + the step stage in `src/shared/domains/funnels/ui/funnel-engine.tsx`. Applies to ALL funnels (kitchens, bathrooms, future) because the rule lives in the shared component, not in per-funnel specs.

## Problem

Across funnels, card-select questions vary in option count (2–6) and type (image / icon / text). Two defects followed from that variance:

1. **Vertical jump.** The question stage centered its content, so a tall question's heading sat at a different Y than a short one's — the heading "jumped around" between steps.
2. **Wide grids.** Questions with many image options (kitchens `layout` = 6, bathrooms `scope` = 5) packed too many tiles into a 2-column grid, which read cramped and inconsistent.

The goal is a single, predictable presentation rule that produces identical behavior on every funnel.

## Decisions

### 1. Top-aligned stage
The question stage aligns content to the **top** (`justify-start`), not center. The heading sits at a constant Y on every step; only the empty space below the options varies. The stage remains fixed-height, so the pinned progress bar and the constant-Y nav (the decoupled three-zone scaffold) are unaffected. Applies to every step kind for consistency, not just card-select.

### 2. Count-based layout rule (type-agnostic)
In the shared `CardSelectStepView`, a single threshold governs layout:

- **`options.length > THRESHOLD` → single-column list of rows.**
- **`options.length ≤ THRESHOLD` → 2-column card grid** (vertical cards, equal-height rows).

The threshold is one constant (`CARD_SELECT_SINGLE_COLUMN_THRESHOLD` in `constants/funnel-layout.ts`) in the shared component → no per-funnel layout code. The rule is type-agnostic: image, icon, and text questions all follow it.

**Update 2026-06-27:** the threshold was lowered `4 → 2`. Every real question is 3+ options (the only 2-option step, hero-entry `ownership`, renders via its own panel and never reaches this component), so all card-select questions in every funnel — kitchens and bathrooms alike — now render as single-column lists. The 2-column grid path is retained only as the fallback for a hypothetical ≤2-tile question; no current question hits it. This makes the whole funnel flow uniformly single-column, derived purely from option count with zero per-funnel code.

### 3. Option row design ("Direction A")
- Full-width, same `border-2 rounded-lg` and selected `primary border + tint` as the grid card → ONE selection language across grid and list.
- Leading thumbnail at the image's native ratio (~96px) when the option carries an image/icon. Every list question's options carry an asset (a placeholder image tile until real art exists) so all rows are a uniform height — no text-only options in a list question. (Updated 2026-06-27 — an earlier "selection radio for text rows" experiment was reverted; placeholder image tiles match the other questions far better.)
- Label (+ optional description) vertically centered next to the thumbnail.
- Same tap-to-select + first-answer-auto-advance behavior as the grid card.
- Six rows ≈ ~470px → fits the fixed-height stage without internal scroll on normal screens; overflow scrolls internally (nav never moves).

### 4. Unchanged
- 2×2 grid cards (≤4): unchanged beyond the equal-height rows already in place.
- Hero Q1 (ownership): rendered by the separate `FunnelHeroEntry` compact control; this rule does not touch it.
- Fixed-height stage, pinned progress, constant-Y nav: kept; only inner alignment flips center → top.

## Consistency guarantee

Every rule is in the shared component; funnel specs only supply `options`. Kitchens, bathrooms, and any future funnel render by the same rule with zero per-funnel layout. Adding a new funnel that follows the option conventions inherits this layout system automatically.

## Out of scope

- Trimming option content (we keep all options; the >4 ones list vertically).
- The trailing-check selection variant ("Direction B") — rejected to keep one selection language with the existing grid.
- Per-step-type alignment overrides — rejected; top-align is uniform for predictability.
