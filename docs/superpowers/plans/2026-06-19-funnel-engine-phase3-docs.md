# Funnel Engine — Phase 3: Documentation (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Author the canonical `src/shared/domains/funnels/DOCS.md` (cross-funnel invariants, business rules, block/step tiers, branching model, and the "instantiate a new funnel" recipe), wire in-code `// see ./DOCS.md#slug` references from the key engine files, and refresh stale memory.

**Architecture:** Pure documentation. `DOCS.md` is slug-anchored per the codebase convention (`src/<dir>/DOCS.md` with `#slug` anchors that survive reordering). It documents the engine **as it actually is after Phases 1-2**: three-tier blocks/steps, `defineBlock`/`defineStep`/`configureStep`, per-step branching — and explicitly marks disqualification as a built-but-inert stub and pixel as deferred to Phase 2.5.

**Tech Stack:** Markdown. No code changes except one-line `// see` comments.

**Source spec:** `docs/superpowers/specs/2026-06-19-headless-funnel-engine-design.md` (§7). **Depends on:** Phases 1 and 2 (documents their shipped surface).

## Global Constraints

- **Work on `main`.** Stage only the files each task names.
- **Verification:** `DOCS.md` claims must match code (trust-but-verify). Each documented file path / function name / business rule must be confirmed against the current code before writing it — this is the CLAUDE.md "ping on staleness" rule applied to authoring the doc itself.
- Anchor slugs are kebab-case and referenced by `// see ./DOCS.md#slug` (same dir) or `// see <path>/DOCS.md#slug` (cross-dir).

---

## File Structure

**New files:**
- `src/shared/domains/funnels/DOCS.md` — the deliverable.

**Modified files:**
- `src/shared/domains/funnels/types.ts` — `// see ./DOCS.md#funnelspec-contract` over `FunnelSpec`.
- `src/shared/domains/funnels/hooks/use-funnel-engine.ts` — `// see ../DOCS.md#branching` at the `advance` chokepoint.
- `src/shared/domains/funnels/lib/define-block.ts`, `lib/define-step.ts`, `lib/configure-step.ts`, `lib/outcomes.ts` — replace the "added in Phase 3" placeholder comments with real `// see ../DOCS.md#…` anchors.
- `memory/feedback-funnel-design-standards.md` + `memory/MEMORY.md` — refresh to point at `DOCS.md`.

---

## Task 1: Author `DOCS.md`

**Files:**
- Create: `src/shared/domains/funnels/DOCS.md`

**Interfaces:** none (documentation). Section anchors produced (referenced by Task 2): `#core-model`, `#funnelspec-contract`, `#cross-funnel-invariants`, `#business-rules`, `#block-tiers`, `#step-tiers`, `#branching`, `#new-funnel-recipe`.

- [ ] **Step 1: Verify every claim against code first**

Before writing, confirm each of these against the current code (quote-check):
- Route + resolution: `src/app/(frontend)/funnels/[trade]/page.tsx`, `lib/registry.ts` `getFunnel`, `constants/slugs.ts` `FUNNEL_SLUGS` + `isFunnelSlug`.
- Lead lifecycle: `ui/steps/pii-form-step.tsx` (`submitLead` → `leadId`), `lib/build-lead-input.ts` (`leadSourceSlug: 'branded-meta-ads'`, `leadMetaJSON.source.kind: 'funnel'`), `ui/steps/confirmation-step.tsx` (`enrichFunnelLead` on mount), `src/trpc/routers/funnels.router.ts` (procedure names + inputs).
- Persistence keys: `constants/storage-keys.ts` (`funnel:${slug}`, the UTM key).
- Block composition + fallback: `ui/funnel-landing.tsx` (`spec.landing?.blocks ?? DEFAULT_LANDING_BLOCKS`, CTA every 3 blocks), `constants/default-landing-blocks.ts`.
- Pixel: `types.ts` `FunnelPixel` is declared but NOT fired (confirm no `fbq` call exists).
- Light theme scoping: confirm the funnel wrapper uses `.funnel-light` + `text-foreground` (memory `feedback-scoped-light-theme-inheritance.md`).
- Assets: `public/funnels/common/` (shared) vs `public/funnels/<slug>/` (trade-specific).

If any claim has drifted, note it and document the code's actual behavior (do not document the stale version).

- [ ] **Step 2: Write the document**

Create `src/shared/domains/funnels/DOCS.md` with these sections (use `##`/`###` headings whose text yields the anchor slugs above):

1. **`## Core model`** (`#core-model`) — A funnel = **trade (slug) + offer**, expressed as a `FunnelSpec` config object authored in TypeScript (developer-authored; not serializable/CMS — and why). One funnel per slug; specs are resolved **client-side** (`getFunnel`) because they contain functions that can't cross the RSC boundary.

2. **`## FunnelSpec contract`** (`#funnelspec-contract`) — Field-by-field table of `FunnelSpec` (`slug`, `offer`, `title`, `hero`, `theme`, `pixel`, `landing?.blocks`, `steps`, legacy `flow?`). Note `pixel.contentCategory` is currently **declared but not fired** (Phase 2.5).

3. **`## Cross-funnel invariants`** (`#cross-funnel-invariants`) — what EVERY real funnel must have, stated as rules:
   - Slug registered in `FUNNEL_SLUGS` + spec registered in `getFunnel`'s map; route is `/funnels/[trade]`.
   - A hero; the **first step is embedded in the landing**; a **terminal `confirmation` step last** (terminal = `resolveNext` yields `done`, so no Next button).
   - A **location/ZIP service-area gate**, a **PII step** (creates the lead via `submitLead`, stores `leadId`), an **address step**, and a **confirmation** (fires `enrichFunnelLead` on mount).
   - State persists in `localStorage` under `funnel:${slug}`; UTM under the UTM key. Resuming a spec whose current step id was removed restarts safely.
   - Landing renders `spec.landing?.blocks ?? DEFAULT_LANDING_BLOCKS`; a "See if you qualify ↑" CTA is auto-inserted every 3 blocks.
   - Funnel subtree is scoped light via `.funnel-light` + `text-foreground` (link `feedback-scoped-light-theme-inheritance`).

4. **`## Business rules`** (`#business-rules`):
   - **Lead lifecycle:** `submitLead` (PII step) → `enrichFunnelLead` (confirmation). Lead source slug `branded-meta-ads`; `leadMetaJSON.source = { kind: 'funnel', offer, funnelSlug, utm }`; interested trade derived via `TRADE_NAME[slug]`.
   - **Service-area gating** happens at the location step (ZIP lookup).
   - **Owner-only / renter disqualification: DESIGNED BUT NOT ACTIVE.** The branching model supports it (`disqualify` outcome + `disqualified` stub screen) but no funnel wires it and there is no lead capture/pixel on DQ yet. The business has not committed to disqualifying leads. Activating it is a future phase (see `#branching`).

5. **`## Block tiers`** (`#block-tiers`) — the three tiers table + how to add each:
   - Tier 1 (shared static) / Tier 2 (shared customizable: content override, defaulting to globals — e.g. `reviews`/`testimonials` honor `content.items`) / Tier 3 (custom one-off via `defineBlock`).
   - Recipe for a Tier-3 custom block: `defineBlock({ id, content, component, schema? })` placed inline in `landing.blocks`; the landing dispatch renders its inline component (no registry/union edit).

6. **`## Step tiers`** (`#step-tiers`) — mirror of block tiers:
   - Tier 1 (shared defaults: `ZIP_STEP`/`PII_STEP`/`ADDRESS_STEP`/`CONFIRMATION_STEP` used as-is) / Tier 2 (`configureStep(BASE, { content, next? })`) / Tier 3 (`defineStep({ id, content, component, answerSchema?, next? })` inline).
   - Note the "add a shared step kind" 6-point process (variant in `types.ts` → `ContentByKind` → `AnswerByKind` → view component → exported default → `STEP_REGISTRY`).

7. **`## Branching`** (`#branching`) — the conditional-logic model:
   - Every step may carry `next?: (answers) => StepOutcome`. Precedence: step `next` → legacy `spec.flow` → linear.
   - `StepOutcome = go(to) | done() | disqualify(reason, behavior)`; `DqBehavior = stop | capture-stop | soft-route(to)`.
   - The engine resolves via `resolveNext`/`outcomeTargetId` at the single `advance()` chokepoint; history stack gives correct multi-level Back across branches.
   - **Disqualification is an inert stub:** `capture-stop` performs no capture, no pixel fires, no funnel wires a DQ rule. To activate later: (a) wire a `disqualified` step into the spec, (b) implement lead-capture-on-DQ (anonymous pre-PII DQ event + post-PII lead flag), (c) Phase 2.5 pixel split.
   - **Known limitation:** progress bar denominator is `spec.steps.length`, not the branched path length.

8. **`## New funnel recipe`** (`#new-funnel-recipe`) — the canonical end-to-end checklist:
   1. Add the slug to `constants/slugs.ts` (`FUNNEL_SLUGS`).
   2. Add the trade mapping (`constants/trade-by-slug.ts` for portfolio filtering; `TRADE_NAME` for lead meta).
   3. Drop assets under `public/funnels/<slug>/` (shared art → `public/funnels/common/`).
   4. Create `constants/<slug>.ts` exporting a `FunnelSpec` (copy `kitchens.ts` as the reference): hero, theme, pixel, `landing.blocks` (compose Tier-1/2/3), `steps` (compose `*_STEP` defaults via `configureStep`, custom via `defineStep`).
   5. Register it in `lib/registry.ts`'s `getFunnel` map.
   6. (Optional) attach `next` transitions for branching.
   7. Verify invariants (hero, ZIP gate, PII, address, terminal confirmation) and run `pnpm tsc && pnpm lint`; smoke `/funnels/<slug>`.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/DOCS.md
git commit -m "docs(funnel): canonical DOCS.md — invariants, tiers, branching, new-funnel recipe

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Wire in-code references

**Files:**
- Modify: `types.ts`, `hooks/use-funnel-engine.ts`, `lib/define-block.ts`, `lib/define-step.ts`, `lib/configure-step.ts`, `lib/outcomes.ts`

- [ ] **Step 1: Add/replace the `// see` comments**

- `types.ts` above `export interface FunnelSpec`: `// see ./DOCS.md#funnelspec-contract`
- `hooks/use-funnel-engine.ts` above the `advance` callback: `// see ../DOCS.md#branching`
- `lib/define-block.ts`: replace `see ../DOCS.md#block-tiers (added in Phase 3)` → `see ../DOCS.md#block-tiers`
- `lib/define-step.ts`: replace the Phase-3 placeholder → `see ../DOCS.md#step-tiers`
- `lib/configure-step.ts`: replace the Phase-3 placeholder → `see ../DOCS.md#step-tiers`
- `lib/outcomes.ts`: replace the Phase-3 placeholder → `see ../DOCS.md#branching`

- [ ] **Step 2: Verify + lint**

Run: `pnpm tsc` → Expected: PASS (comments only).
Run: `pnpm lint` → Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/types.ts src/shared/domains/funnels/hooks/use-funnel-engine.ts src/shared/domains/funnels/lib/define-block.ts src/shared/domains/funnels/lib/define-step.ts src/shared/domains/funnels/lib/configure-step.ts src/shared/domains/funnels/lib/outcomes.ts
git commit -m "docs(funnel): in-code refs to DOCS.md anchors

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Refresh memory

**Files:**
- Modify: `memory/feedback-funnel-design-standards.md`
- Modify: `memory/MEMORY.md`

- [ ] **Step 1: Update the funnel-design-standards memory**

Open `memory/feedback-funnel-design-standards.md` and update it to reflect the engine's current state, adding a pointer line: the canonical reference for funnel architecture (model, tiers, invariants, branching, new-funnel recipe) is now `src/shared/domains/funnels/DOCS.md`. Keep the design-standards guidance (branded card grids, trade SVGs, premium feel) but note it is now one input among the documented tiers.

- [ ] **Step 2: Update the MEMORY.md index line**

In `memory/MEMORY.md`, update the `[Funnel Design Standards]` pointer (under Active Backlog) to add: "Canonical engine architecture: `src/shared/domains/funnels/DOCS.md` (tiers, invariants, branching, new-funnel recipe)."

- [ ] **Step 3: Commit**

```bash
git add memory/feedback-funnel-design-standards.md memory/MEMORY.md
git commit -m "docs(funnel): point memory at canonical DOCS.md

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

Note: `memory/` is outside the repo working dir (`/home/olis-solutions/.claude/projects/.../memory/`). If `git add` from the repo root cannot stage it, these files live in the Claude memory store, not the repo — update them with the Write/Edit tools and skip the commit for those two files (commit only `DOCS.md` + code refs from Tasks 1-2).

---

## Self-Review (against the spec)

**Spec coverage (§7):** all 7 documented sections map to the spec's required DOCS.md sections (core model, invariants, business rules, block tiers, step tiers, branching, new-funnel recipe) → Task 1. In-code refs + memory refresh → Tasks 2, 3. ✓

**Placeholder scan:** The DOCS.md *content* is specified as concrete section-by-section bullet requirements (each naming the exact files/functions/rules to capture), not vague "document X". The executor transcribes + expands verified facts; Step 1 of Task 1 forces verification before writing.

**Consistency:** anchor slugs produced in Task 1 (`#funnelspec-contract`, `#branching`, `#block-tiers`, `#step-tiers`) exactly match the references wired in Task 2.

**Reality flags baked in:** DQ documented as inert stub; pixel documented as deferred (Phase 2.5); progress-bar branch limitation documented; `reviews`/`testimonials` Tier-2 status accurate.
