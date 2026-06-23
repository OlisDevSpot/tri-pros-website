# Bathrooms Funnel + Funnel-Engine Reusability — Design

**Date:** 2026-06-23
**Status:** Approved (design); implementation plan pending
**Author:** Oliver P (with Claude)

## Summary

Stand up a second marketing funnel — **bathrooms** — by reusing the existing
funnel engine, and in doing so harden the engine's reuse seams that the first
(kitchens) funnel left coupled. The work is two phases:

- **Phase 0 — engine pattern improvements** (the reusability payoff): make lead
  enrichment generic + progressive + self-describing, surface it as a generic
  customer panel, add a positioning-variant seam, remove kitchen-specific
  default leaks, and document the funnel-authoring convention.
- **Phase 1 — the bathrooms funnel** (the proof): author one `bathrooms.ts`
  spec with bathroom-native questions (two of which kitchens lacks), the blend
  positioning landing, and the asset tree.

The guiding principle: **a new funnel should be "author one spec file + drop
assets," with zero edits to shared engine/UI code.** Phase 0 closes the gaps
that prevent that today; Phase 1 demonstrates it end to end.

## Context — what the investigation found

The funnel engine is genuinely reusable already:

- `FunnelSpec` (`src/shared/domains/funnels/types.ts`) is a real single-source
  config type. The registry is `Record<FunnelSlug, FunnelSpec>` — omitting a
  slug is a `tsc` error.
- Routing (`/funnels/[trade]`), tRPC `submitLead`, the ZIP service-area gate,
  Twilio mobile-only validation, and the entire Meta Pixel/CAPI loop are all
  funnel-agnostic and convention-driven off `pixel.contentCategory`. A second
  funnel needs **zero** backend or measurement wiring.
- Step + marketing-block registries are kind-keyed; reusing existing kinds
  requires no registry edits. `ZIP_STEP`, `PII_STEP`, `HOME_TYPE_STEP`,
  `ADDRESS_STEP`, `CONFIRMATION_STEP` are importable prebuilts.
- `bathrooms` already exists as a metadata-only stub (`steps: []`) and is
  already in the slug list, trade-UUID map, and lead-name map.

The leaks are concentrated, not systemic:

1. **Lead enrichment is the one real architectural coupling.** The fixed
   `{ homeType, age, scope, timeline }` shape is hardcoded across five files,
   including the *shared* `confirmation-step.tsx` which reaches into
   `answers.scope` etc. by literal key, and a server-side label mirror
   (`enrichment-labels.ts`) that is a hand-copy of `kitchens.ts`. The moment a
   funnel wants a different question, enrichment silently breaks.
2. **Enrichment is all-or-nothing in time.** The confirmation view fires
   `enrichFunnelLead` once on mount. A user who drops off before the
   confirmation step persists *no* enrichment (their PII lead survives, but the
   answered dimensions are lost). The server-side merge already exists
   (`leadMetaJSON` is in `jsonbMergeColumns`; `enrichFunnelLead` spread-merges
   over a Postgres `||` merge), so progressive capture is a client-trigger
   change, not a persistence rebuild.
3. **Kitchen-default leaks in shared blocks.** `callout-block.tsx` and
   `before-after-showcase.tsx` fall back to kitchen imagery/alt-text, so a
   bathrooms author who leaves a field blank silently ships a kitchen photo.
4. **No documented asset/author convention.** The `/funnels/<slug>/...`
   convention is real but implicit; funnel #3 would reverse-engineer it.

### Staleness note (verified against code)

A memory note claims a universal "FIX vs IMPROVE" first question is
non-negotiable across all funnels. The shipped `kitchens.ts` does **not** do
this — it opens with "Which best describes your kitchen?". The FIX/IMPROVE
concept lives in the meta-ads *strategy* doc as a future landing-page vision,
not in the running funnel. Bathrooms will **not** adopt FIX/IMPROVE unless
explicitly requested.

## Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| 1 | Enrichment coupling | Fix it first (Phase 0), then build bathrooms |
| 2 | Bathrooms qualifying questions | whichBathroom, bath-native scope, accessibility/aging-in-place, age + timeline |
| 3 | Positioning | Blend (sanctuary hook + done-right credibility) as default |
| 4 | Multiple positioning angles | Lightweight variant seam; build blend now, author safety/sanctuary as fast-follow |
| 5 | Enrichment timing | Progressive (per-step, buffer pre-PII, flush at lead creation) |
| 6 | Enrichment storage shape | Keyed merge-safe object `Record<stepId, { label, value, order }>` |
| 7 | Enrichment surface | Generic read-only "Funnel Intake" profile panel; drop per-enrich note; one creation-time note |

## Phase 0 — Engine pattern improvements

### 0a. Generic, progressive, self-describing enrichment

**Spec API.** `FunnelSpec` gains:

```ts
enrichment?: { stepId: StepId, label: string }[]
```

The author declares which steps enrich the lead and the CRM-facing label for
each dimension. Order in this array is the canonical display order.

**Storage shape.** `leadMeta.source.enrichment` changes from the fixed
four-key object to a keyed, merge-safe object:

```ts
enrichment?: Record<string /* stepId */, { label: string, value: string, order: number }>
```

Rationale for keyed-object (not a `{label,value}[]` array): Postgres JSONB `||`
*concatenates* arrays (→ duplicates on incremental merge) but *merges* object
keys (→ clean per-dimension upsert). `order` carries the dimension's index in
`spec.enrichment` so the display surface can sort deterministically without
importing the funnel spec. `value` is the resolved human label of the selected
option (e.g. `"Tub → walk-in shower"`), making the record self-describing — no
server-side label mirror needed.

**Resolution helper.** A pure `lib/` function:

```ts
buildLeadEnrichmentPatch(spec: FunnelSpec, answers: FunnelAnswers, stepId: StepId):
  Record<string, { label, value, order }> | null
```

It finds the declared dimension for `stepId`, reads the selected answer, and
resolves the option label from `step.content.options[selectedId].label`.
Returns a single-key patch (for progressive per-step firing) or `null` if the
step isn't a declared enrichment dimension / has no answer.

**Progressive capture (client trigger).** The funnel engine — which holds both
`spec` and `answers` — fires `enrichFunnelLead` with a single-dimension patch
whenever an enrichment-step answer is set **and** a `leadId` exists. Enrichment
steps answered *before* PII (e.g. `whichBathroom`, `ownership`) are buffered;
the buffer is flushed in one patch the moment the lead is created (leadId
becomes available). The confirmation view no longer fires enrichment and no
longer reads `answers.*` by literal key — it becomes purely presentational.

**Server.** `enrichFunnelLead` router input becomes the generic keyed-object
patch (`z.record(z.string(), z.object({ label, value, order }))`). The service
keeps its spread-merge (already correct). Bump the enrich rate-limit headroom
(10 → 20 / hr) to comfortably cover ~6 progressive patches per session.

**Notes.** Stop adding the `📋 Funnel intake` note inside `enrichFunnelLead`
(it would duplicate under progressive firing). Instead fire **one** timeline
note at lead creation (in `submitLead` / `ingestLead`) recording that the lead
arrived via the `<Trade>` funnel plus whatever dims are known at creation
(the pre-PII answers). Current state lives in the panel (0b); the note is a
single chronological marker.

**Deletions / rewrites.**
- Delete `src/shared/domains/funnels/constants/enrichment-labels.ts`.
- Rewrite `buildFunnelLeadNote` to iterate the generic record (`label: value`),
  or fold its logic into the creation-time note builder.
- Update `leadMetaSchema.enrichment` (`src/shared/entities/customers/schemas/index.ts`)
  to the generic keyed-object shape.

**Back-compat.** Existing kitchen leads carry the legacy `{ homeType, age,
scope, timeline }` shape (raw option-ids as values). These are low-volume
(kitchens just launched). The new render surface (0b) and note builder should
tolerate a legacy object by best-effort display (show key + raw value) rather
than crash. No data migration is required; new captures use the new shape.

### 0b. Generic "Funnel Intake" customer panel

A new read-only panel renders `leadMeta.source.enrichment` as labeled
key/value rows, reusing the existing `ProfileCard` label/value grid pattern.

- Component: `FunnelIntakePanel` (read-only; sorts entries by `order`).
- Mounted in `CustomerProfileDetails` alongside Customer / Property / Financial
  profile cards, shown only when the customer's `leadMeta.source.kind ===
  'funnel'` and enrichment is present.
- Renders **whatever dimensions any funnel declared** — zero per-funnel UI
  edits. This is the surface that makes funnel answers look first-class "like
  customer age" without polluting the shared customer/property profile schemas.

Explicitly **not** done: mapping funnel dims into `customerProfileJSON` /
`propertyProfileJSON` structured fields. That path (B2) was rejected for large,
corrosive blast radius — it requires schema + enum + hardcoded field-list edits
per dimension, enum-translation for mismatches (funnel `timeline` ≠
`decisionTimeline`), and bathroom-specific dims (`whichBathroom`,
`accessibility`) have no structured home and would pollute shared profiles as
funnels multiply.

### 0c. Positioning-variant seam

`FunnelSpec` gains:

```ts
variants?: Record<string, { blocks: MarketingBlock[] }>
```

- `src/app/(frontend)/funnels/[trade]/page.tsx` reads a `?v=` search param
  (falling back to UTM `content`) and passes `variant` into `<FunnelEngine>`.
- `FunnelLanding` resolves:
  `spec.variants?.[variant]?.blocks ?? spec.landing?.blocks ?? DEFAULT_LANDING_BLOCKS`.
- Steps, PII, and measurement are unchanged — only the landing blocks swap.
  Same pixel, same `content_name`, same lead shape. `/funnels/bathrooms` =
  blend; `/funnels/bathrooms?v=safety` = safety angle; `?v=sanctuary` =
  sanctuary angle.

Optional (P2, not in v1): stamp the active `variant` into lead meta for A/B
analysis. Flagged, not built.

### 0d. Remove kitchen-default leaks in shared blocks

- `ui/blocks/callout-block.tsx`: remove the hardcoded
  `/portfolio-photos/modern-kitchen-1.jpeg` default + kitchen alt. Make the
  image required for the block, or derive neutral alt text from `ctx` (funnel
  `title`).
- `ui/blocks/before-after-showcase.tsx`: replace the
  `'Kitchen before/after the remodel'` default alts with vertical-neutral copy
  (`'Before the remodel'` / `'After the remodel'`) or alt derived from a
  pair `label` / `ctx.title`.

### 0e. Document the convention

Add to the funnels `DOCS.md`:
- Asset convention: `/funnels/<slug>/<dimension>/<option>.webp` for
  vertical-specific assets; `/funnels/common/...` for shared assets.
- A short "adding a new funnel" checklist (author `constants/<slug>.ts`,
  declare `enrichment`, register in `lib/registry.ts`, drop assets, run the
  `optimize-image-assets` pipeline).

## Phase 1 — The bathrooms funnel

### Step flow (mirrors kitchens' proven order)

Kitchens captures PII early (after a couple of micro-commitments + ZIP
qualification), then keeps the user moving through softer enrichment questions.
Bathrooms mirrors that psychology:

| # | Step id | Kind | Notes |
|---|---|---|---|
| 1 | `whichBathroom` | card-select (images) | Primary/ensuite · Guest/hall · Powder room · Multiple — opening micro-commitment |
| 2 | `ownership` | card-select | own / rent gate |
| 3 | (zip) | `zip` (shared) | service-area gate |
| 4 | (pii) | `pii-form` (shared) | **lead captured** → Lead pixel + CAPI twin; buffered enrichment flushes here |
| 5 | `homeType` | HOME_TYPE_STEP (shared) | |
| 6 | `age` | card-select (images) | bathroom age / condition |
| 7 | `scope` | card-select (images) | bath-native: full gut · tub→shower · walk-in shower · vanity+fixtures · cosmetic refresh |
| 8 | `accessibility` | card-select | aging-in-place: curbless/walk-in · grab bars & safety · not needed |
| 9 | `timeline` | card-select | ASAP · 1–3mo · 3–6mo · exploring |
| 10 | (address) | ADDRESS_STEP (shared) | |
| 11 | (confirmation) | CONFIRMATION_STEP (shared) | terminal |

**`spec.enrichment`** declares six dimensions:
`whichBathroom, homeType, age, scope, accessibility, timeline` — two of which
(`whichBathroom`, `accessibility`) kitchens does not have. This is the concrete
stress-test of the generic enrichment pipeline.

Reused for free: ZIP, PII, HOME_TYPE, ADDRESS, CONFIRMATION, card-select,
every marketing block, the engine, hero, progress bar, sticky header, all
hooks, all measurement.

### Positioning & landing content (blend — default variant)

- **Hero:** sanctuary hook with a Showcase price frame, e.g. *"The spa
  bathroom you'll actually use — at a Showcase price."* (`highlightWords`
  ≈ `['spa', 'Showcase']`).
- **Problem block:** the done-right vs. cut-rate credibility angle, reframed
  around the bathroom-specific risk — water intrusion and bad waterproofing —
  with accountability, surprise change-orders, and endless-timeline reasons.
- **Value block:** before/after pairs + ROI stat (bathroom remodels carry a
  strong resale ROI) + transformation list (dated tile → spa shower, etc.).
- Then the proven block sequence: **portfolio → reviews → process →
  callout (financing) → faq (bathroom questions) → guarantee → licensing.**

**Variants:** the seam is built in v1. The `safety` (aging-in-place / slip
safety / independence forward) and `sanctuary` (wellness / retreat forward)
variants are authored as a fast-follow — each is just an alternate `blocks`
array. (Author all three in this pass only if explicitly requested.)

### Assets

New `public/funnels/bathrooms/` tree, following the documented convention:
- `whichBathroom/*.webp`, `age/*.webp`, `scope/*.webp` option images
  (`accessibility`, `timeline`, `ownership` can be icon/text like kitchens).
- `before-1.webp` / `after-1.webp`, `before-2.webp` / `after-2.webp` pairs for
  the value block.
- Hero image.

Assets are AI-generated PNGs run through the **optimize-image-assets** skill
(convert → webp, crop baked-in captions, resize to spec, organize) before they
land; source PNGs deleted.

## Affected files (indicative, not exhaustive)

**Phase 0 — engine:**
- `src/shared/domains/funnels/types.ts` — add `enrichment`, `variants` to `FunnelSpec`.
- `src/shared/domains/funnels/lib/build-lead-enrichment-patch.ts` — new pure helper.
- `src/shared/domains/funnels/ui/funnel-engine.tsx` — progressive enrich firing + pre-PII buffer flush.
- `src/shared/domains/funnels/ui/steps/confirmation-step.tsx` — remove enrich firing + literal answer reads.
- `src/shared/domains/funnels/hooks/use-enrich-lead.ts` — generic patch args.
- `src/trpc/routers/funnels.router.ts` — generic `enrichFunnelLead` input; rate-limit headroom.
- `src/shared/services/customer-intake.service.ts` — drop per-enrich note; add creation-time note.
- `src/shared/entities/customers/schemas/index.ts` — generic `enrichment` shape.
- `src/shared/domains/funnels/constants/enrichment-labels.ts` — **delete**.
- `src/shared/domains/funnels/lib/build-funnel-lead-note.ts` — rewrite generic (or fold into creation note).
- `src/shared/entities/customers/components/profile/funnel-intake-panel.tsx` — new read-only panel.
- `src/shared/entities/customers/components/profile/customer-profile-details.tsx` — mount the panel.
- `src/app/(frontend)/funnels/[trade]/page.tsx` — read `?v=` variant param.
- `src/shared/domains/funnels/ui/funnel-landing.tsx` — variant block resolution.
- `src/shared/domains/funnels/ui/blocks/callout-block.tsx`, `before-after-showcase.tsx` — remove kitchen defaults.
- `src/shared/domains/funnels/DOCS.md` — document convention + checklist.

**Phase 1 — bathrooms:**
- `src/shared/domains/funnels/constants/bathrooms.ts` — full spec (steps, enrichment, blend landing).
- `public/funnels/bathrooms/**` — assets.
- `lib/registry.ts` — already imports the stub; no change beyond the filled spec.

## Verification

- `pnpm tsc` + `pnpm lint` clean.
- Bathrooms fires the full Meta event sequence: PageView → ViewContent (first
  answer) → Lead (browser + CAPI dedup at PII submit) → CompleteRegistration
  (confirmation reached) — identical to kitchens, no per-funnel wiring.
- A **partial drop-off** (e.g. abandon at step 8) persists every dimension
  answered through step 7 into the customer's Funnel Intake panel — proving
  progressive capture.
- A full completion shows all six bathroom dimensions in the Funnel Intake
  panel, including `whichBathroom` and `accessibility` (the two kitchens lacks)
  — proving the generic pipeline.
- `/funnels/bathrooms?v=safety` swaps landing blocks with steps + measurement
  unchanged — proving the variant seam.

## Out of scope (explicitly)

- Authoring the `safety` / `sanctuary` variant block content (fast-follow).
- Stamping `variant` into lead meta for A/B analysis (P2, flagged).
- Mapping funnel dims into structured customer/property profile fields (B2,
  rejected).
- Any FIX/IMPROVE universal first question.
- Data migration of existing kitchen leads (handled by best-effort legacy
  tolerance, not migration).
