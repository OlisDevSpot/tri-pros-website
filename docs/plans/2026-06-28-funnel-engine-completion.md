# Funnel Engine Completion — pickup guide + new-funnel playbook

**Created:** 2026-06-28
**Tracking epic:** see the `type:epic` issue "Funnel engine completion" on the [project board](https://github.com/users/OlisDevSpot/projects/3)

This is the single entry point for finishing the funnel engine. Read this first, then open the sub-issue you're picking up. Every sub-issue links back here.

---

## 1. How to pick this up cold

1. Read this file top to bottom (~5 min).
2. Open the epic on the board; pick a sub-issue in `Ready`.
3. Read the source doc that sub-issue cites (spec / handoff / audit report — indexed in §6).
4. **Trust but verify** — every doc below is a point-in-time snapshot. Confirm each finding against current code before changing it. If a doc has drifted, STOP and fix the doc (see CLAUDE.md "Ping on staleness").
5. Verify with `pnpm tsc` + `pnpm lint` (there is **no** unit-test runner) plus a browser pass. **Never** `pnpm build` or `pnpm db:push`.

---

## 2. Where things stand

**Shipped and working:** the engine (`useFunnelEngine`), the step registry + 5 step kinds, the marketing-block registry + 11 block kinds, prebuilt shared step configs (`lib/steps/*`), the shared footer, tracking/pixel + CAPI with renter suppression, ZIP resolution, progressive lead enrichment, OG image generation, and two live funnels (**kitchens**, **bathrooms**).

**What's left** — four workstreams:

| # | Workstream | Source of truth |
|---|---|---|
| **A** | Shell composition refactor (config-in-context architecture) | `docs/superpowers/specs/2026-06-28-funnel-shell-composition-design.md` |
| **B** | Correctness + infra hardening (6 items) | `.superpowers/research/funnel-audit/handoff-tier1-correctness-infra.md` |
| **C** | Polish + docs hardening (5 items) | `.superpowers/research/funnel-audit/handoff-tier3-polish-docs.md` |
| **D** | Third funnel buildout (`complete-interior`) + the new-funnel playbook | §4 below |

**Ordering:** A is the only workstream with internal sequencing (its tasks are strictly ordered). B, C, and D are independent of A and of each other — D can proceed in parallel and is the real proof that the reusable layer works. Do **A before C**, because Tier 3 item 5 touches `funnel-engine.tsx`, which A rewrites.

---

## 3. Workstream A — shell composition (summary)

Full design in the spec. The shape:

- One **`FunnelConfig`** object (the future JSONB row), built once by `buildFunnelConfig()`, provided once via **`FunnelConfigContext`** by the root **`FunnelShell`** (a rename of today's `FunnelEngine` component).
- **`useFunnelConfig()`** is how sub-components read their slice — including **layout**, which is a field on the config (`config.layout`, keyed by view type: `steps` | `confirmation`).
- **`FunnelFrame`** (per-view) reads `config.layout[view]` and owns the blueprint-grid `z-0` / content `z-10` layering.
- **Config ≠ runtime state**: current step, answers, and `stickyOpacity` stay in `useFunnelEngine`, never in config-context.
- The footer collapses to **one mount** in `FunnelShell` with `relative z-10` (grid-safe, keeps the ~50% peek).

**Why Context here when the audit said not to:** the audit's advice was scoped to a compile-time constant config. The direction is a DB-driven funnel builder where config is a runtime JSONB row — with a fetched object, Context is correct. The spec documents this explicitly.

---

## 4. New-funnel playbook (the clean requirements pass)

This is the answer to "what does it take to ship funnel #4?"

### 4a. Reusable — do NOT rebuild these

| Layer | What you get |
|---|---|
| Engine / state | `hooks/use-funnel-engine.ts`, `lib/funnel-flow.ts`, `constants/storage-keys.ts` |
| Frame / layout | `FunnelShell`, `FunnelFrame`, `FunnelStickyHeader`, `FunnelProgress`, `FunnelFooter`, `constants/funnel-layout.ts` |
| Prebuilt steps | `lib/steps/`: `ZIP_STEP`, `HOME_TYPE_STEP`, `TIMELINE_STEP`, `ADDRESS_STEP`, `PII_STEP`, `CONFIRMATION_STEP` |
| Step kinds | `STEP_REGISTRY` + `ui/steps/*` — 5 kinds: `zip`, `card-select`, `address`, `pii-form`, `confirmation` |
| Marketing blocks | `MARKETING_REGISTRY` + `ui/blocks/*` — 11 kinds; `constants/default-landing-blocks.ts` as the fallback set |
| Option authoring | `lib/card-options.ts` — `cardOptions`, `img`, `icon`, `text` |
| Tracking | `lib/tracking/*` — pixel + CAPI dedup, advanced matching, renter suppression |
| Lead capture | `lib/build-lead-input.ts`, `lib/build-lead-enrichment.ts`, `hooks/use-progressive-enrichment.ts` |
| ZIP / service area | `lib/resolve-zip.ts`, `lib/build-zip-check-sequence.ts`, `hooks/use-live-zip-resolve.ts` |
| Copy constants | `constants/cta-copy.ts`, `constants/footer-copy.ts` (TCPA-reviewed — do not hand-edit legal copy) |
| OG images | `lib/og/*` + `app/(frontend)/funnels/[trade]/opengraph-image.tsx` |

### 4b. Per-funnel checklist (everything you must author)

1. **Slug** — add to `FUNNEL_SLUGS` in `constants/slugs.ts`. This is the compile-time completeness guard: adding it makes `tsc` demand every `Record<FunnelSlug, …>` be filled, which cascades the rest of this list.
2. **Trade facts** — add a `TRADE_FACTS` entry in `constants/trade-facts.ts`: `name` (canonical Notion trade name), `notionTradeId` (UUID from the "All Construction Trades" DB), and `meta` (`title`, `description`, `ogHeadline`, `ogImage`). **This file must stay component-free** — server metadata reads it.
3. **The spec** — create `constants/<slug>.ts` exporting a `FunnelSpec`:
   - `slug`, `offer`, `title`, `theme`
   - `hero`: `headline`, `subhead`, `scarcityLine`, `ctaLabel`, `media`, `highlightWords`
   - `pixel.contentCategory` (measurement config — lives on the spec, **not** a trade fact)
   - `landing.blocks` — compose from the 11 block kinds (or omit to inherit `DEFAULT_LANDING_BLOCKS`)
   - `steps` — compose prebuilts + trade-specific `card-select` steps
   - `enrichment` — the dimensions that enrich the CRM lead
4. **Register** — add to the `FUNNELS` record in `lib/registry.ts` (`tsc` enforces exhaustiveness).
5. **Assets** — hero + option imagery into `public/funnels/<slug>/`; run the `optimize-image-assets` skill (webp, sized, no stray multi-MB PNGs).
6. **Subdomain** — verify `src/shared/config/subdomains.ts` and `roots.ts` pick up the new slug; confirm DNS/host config for `<slug>.triprosremodeling.com`.
7. **Measurement** — wire the Meta campaign (`scripts/meta`, see `scripts/meta/DOCS.md`).
8. **Verify** — `pnpm tsc` + `pnpm lint`, then a full browser pass on `<slug>.localhost:3000`: hero → every step → PII submit → confirmation, plus the footer legal block and Pixel Helper showing one `Lead`.

### 4c. Adding a new *step kind* (rarer — code, not config)

Lockstep edits: `AnswerByKind` → `ContentByKind` → the `FunnelStep` union (`types.ts`) → `STEP_REGISTRY` → a `ui/steps/*` component → optionally a `lib/steps/*` prebuilt config.

⚠️ **TDZ hazard:** a `lib/steps/*` config must stay **component-free**. Importing its component there recreates the `registry → spec → config → component → registry` cycle, which crashes at runtime with **no TypeScript error**. (Tier 3 item 4 adds this checklist to `DOCS.md`.)

⚠️ `buildLeadEnrichment` currently only handles `card-select` answers — a new enrichable kind produces **no** CRM enrichment until that builder is extended.

---

## 5. Workstream D — `complete-interior` buildout

`constants/complete-interior.ts` is a **stub**: `steps: []`, no landing blocks, hero has no media/highlightWords.

Already done for it: the slug is registered, and `TRADE_FACTS['complete-interior']` is fully populated (name, Notion UUID, title/description/ogHeadline/ogImage). **The only gap is the spec itself** — follow §4b items 3, 5, 7, 8.

**Confirmation / thank-you page** — two senses, both in scope:
- `CONFIRMATION_STEP` (`lib/steps/confirmation-step.ts`) with its `confirmation-timeline` UI is shared and already used by kitchens + bathrooms. `complete-interior` must include it as its terminal step.
- Under workstream A the confirmation view is re-homed into `FunnelConfirmationView` + `FunnelFrame`; its rendering must stay pixel-identical.

Guard note: Tier 1 item 6 (guard empty `steps`) exists **because** this funnel is a stub — building it out reduces that risk but does not replace the guard.

---

## 6. Document index

| Doc | What it is |
|---|---|
| `docs/superpowers/specs/2026-06-28-funnel-shell-composition-design.md` | **Workstream A spec** — approved architecture |
| `docs/superpowers/plans/2026-06-27-funnel-shell-composition-refactor.md` | Prior plan — Tasks 1/2/4 still valid, **Task 3 superseded** by the spec |
| `.superpowers/research/funnel-audit/handoff-tier1-correctness-infra.md` | Workstream B — 6 items |
| `.superpowers/research/funnel-audit/handoff-tier3-polish-docs.md` | Workstream C — 5 items |
| `.superpowers/research/funnel-audit/handoff-tier2-shell-refactor.md` | ⚠️ **Superseded** by the spec — kept for history only; do not implement |
| `.superpowers/research/funnel-audit/agent-1..4-*.md` | The four audit reports (file:line detail behind every finding) |
| `src/shared/domains/funnels/DOCS.md` | Funnel business rules + conventions |
| `docs/marketing/showcase-offer.md` | Canonical Showcase offer copy for all funnels |

---

## 7. Working rules

- **Branch:** `{type}/{issue-number}-{slug}`; PR with `Closes #N`.
- **Verification:** `pnpm tsc` + `pnpm lint` + browser pass. **Never** `pnpm build` / `pnpm db:push`.
- **Staging:** the tree carries heavy unrelated WIP — stage only the files each task touches, never `git add -A`.
- **Conventions:** one component per file; named exports only; no barrels in `ui/`; `shared/` never imports `features/`; helpers in `lib/`, not component files; constants/copy outside component files.
- **Commit trailer:** `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
