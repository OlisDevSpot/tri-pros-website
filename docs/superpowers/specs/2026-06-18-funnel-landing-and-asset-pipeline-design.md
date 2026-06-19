# Funnel Landing Overhaul + Marketing-Block Library + Asset Pipeline — Design

**Date:** 2026-06-18
**Status:** Approved (pending spec review)
**Supersedes/extends:** `2026-06-18-funnel-ux-validation-hardening-design.md` (Plan 2b.5, landed) — this is the next funnel spec. Plan 2c (enrichment + appointment + confirmation) is re-cut as a SEPARATE spec after this one.

## Goal

Turn each Meta-ads funnel's first view into a long-scroll, trust-building landing page assembled from a reusable marketing-block library, replace the nonsensical placeholder option icons with accurate visuals backed by an AI-generated asset pipeline, and fix three form-performance issues — plus fold in two carried fixes (shared `clientIp` helper, a11y polish).

## Scope

This spec covers four threads + two carried fixes:

1. **Landing overhaul** — long-scroll landing as the "presentation mode of step 1"
2. **Marketing-block library** — composable, per-funnel-customizable trust blocks
3. **Option visuals + asset pipeline** — accurate SVG diagrams now, AI-photo path later, `public/funnels/` → R2
4. **Form performance** — slow-load investigation, snappier transitions, convincing multi-step ZIP check
5. **(a)** Shared `clientIp` helper applied to both funnels + business routers
6. **(b)** A11y/polish (aria-live on ZIP phase, name trim, honeypot)

**Explicitly out of scope (→ Plan 2c, next spec):** lead enrichment, appointment booking, confirmation screen, the `enrichFunnelLead` public mutation and its security review.

## Global constraints (carried from the funnel domain)

- Funnel code lives in `src/shared/domains/funnels/`. `shared/` MUST NOT import from `features/`. Reuse of `useTRPC()` from `@/trpc/helpers` is established and allowed (see `pii-form-step.tsx`).
- Coding conventions: ONE React component per file; no file-level constants/helpers in component files (→ `constants/` / `lib/`); named exports only; no barrel files in `ui/`/`constants/`/`hooks/`/`lib/`.
- New dependencies require explicit approval. This spec adds NONE (SVG diagrams are authored; R2 client, motion, tRPC, libphonenumber already present).
- No `pnpm build`; verify with `pnpm tsc` + `pnpm lint`. No test runner — pure logic verified with throwaway `tsx` scriptlets; UI verified with Playwright-MCP smoke.
- Company data (license #, stats, phone) derives from `src/shared/constants/company/` — never hardcode in components.

---

## §1 Landing as a long-scroll "presentation mode of step 1"

The funnel's first view (`engine.isFirst`) becomes a **full-width, scrollable landing page**, replacing the current compact centered hero band. The later steps keep the existing focused `max-w-xl` column. One engine, two layouts.

**Landing structure (top → bottom):**

1. **Offer hero** — `FunnelSpec.hero` (headline, subhead, scarcity line, optional media). Funnel/offer-aligned.
2. **Q1 micro-commitment** — the actual first step (`card-select`) rendered inline directly under the hero. Answering it is the commitment that enters the funnel.
3. **Marketing blocks** — the per-funnel block list (§2), revealed on scroll, below the fold.
4. **Bottom CTA** — a "Ready to see if you qualify? ↑" control that smooth-scrolls back to the Q1 anchor, so a user who reads all the proof doesn't hunt for the question.

**Transition:** answering Q1 calls `advance()`; `engine.isFirst` flips false; the shell scrolls to top and **cross-fades** from `FunnelLanding` into the focused funnel column (existing `max-w-xl` + `FunnelProgress`). Marketing blocks render ONLY while `isFirst`.

**Components:**
- `ui/funnel-landing.tsx` — the full-width landing layout: renders hero, the Q1 step inline (reusing the same `STEP_REGISTRY` dispatch), the marketing block list, and the bottom CTA. Owns the Q1 scroll anchor.
- `ui/funnel-engine.tsx` — modified: when `isFirst`, render `FunnelLanding`; otherwise render the focused column as today. The Back/Next shell row shows only in focused mode.
- `ui/funnel-hero.tsx` — extended for the landing band (keeps current props; landing-appropriate styling).

**Performance note:** marketing blocks are below the fold; the portfolio block (live tRPC) must not block first paint (see §4). Defer/lazy below-fold blocks.

---

## §2 Marketing-block library

Mirrors the prebuilt-step pattern (`PII_STEP` / `ZIP_STEP` + `STEP_REGISTRY`): a discriminated-union `MarketingBlock` + a `MARKETING_REGISTRY` mapping `kind → component`, with lockstep types (mapped registry type enforces exhaustiveness, same as `StepRegistry`).

**Types (in `types.ts`, lockstep with the registry):**

```ts
export type MarketingBlock =
  | { kind: 'reviews', content: ReviewsBlockContent }
  | { kind: 'testimonials', content: TestimonialsBlockContent }
  | { kind: 'portfolio', content: PortfolioBlockContent }
  | { kind: 'licensing', content: LicensingBlockContent }
  | { kind: 'guarantee', content: GuaranteeBlockContent }

export type MarketingBlockKind = MarketingBlock['kind']
export type MarketingBlockComponentFor<K extends MarketingBlockKind> =
  ComponentType<{ content: Extract<MarketingBlock, { kind: K }>['content'], ctx: FunnelContext }>
export type MarketingRegistry = { [K in MarketingBlockKind]: MarketingBlockComponentFor<K> }
```

`FunnelSpec` gains:

```ts
landing: { blocks: MarketingBlock[] }
```

**Defaults with override** (per the project's defaults-with-override principle): a `DEFAULT_LANDING_BLOCKS` constant provides the standard ordered set; a funnel may use it as-is, reorder, omit, or override any block's content.

**Block kinds:**

| Kind | Renders | Content source |
|---|---|---|
| `reviews` | Aggregate trust band — rating value, star row, count, optional Google/BBB marks | Static content in the block config (e.g. `{ rating: 4.9, count: 200, label }`) |
| `testimonials` | Named quote cards (photo, quote, name, location, 5 stars) | Defaults to the 3 static entries in `shared/constants/company/testimonials.ts`; overridable per funnel |
| `portfolio` | Live trade-filtered **hero-image grid** of real projects (before/after slider deferred — `getAll` returns only `heroImage`; before/after would need per-project `getDetail`, too heavy for a below-fold block) | `projectsRouter.showroomDisplay.getAll()` filtered by the funnel's Notion **trade** (via scope→trade resolution) |
| `licensing` | Bonded / licensed / insured trust section + license # | `shared/constants/company/` |
| `guarantee` | Offer guarantee + scarcity reinforcement | Static content in the block config |

**Boundary & data:**
- Blocks live in `src/shared/domains/funnels/ui/blocks/` — ONE component per file.
- Blocks reuse only `shared/components/ui` primitives and `shared/constants/company`. They do NOT import from `features/`. The `features/landing` and `features/project-management` components are styling references only; lean funnel-specific versions are built here (landing has different needs than the portfolio page).
- The `portfolio` block fetches live via `useTRPC()` (client). It is below-the-fold and lazy so it never blocks first paint. Loading + empty states required (a funnel/trade with no public projects must degrade gracefully — render nothing rather than an empty shell).

**Trade filtering (verified against live Notion).** There is NO direct trade→project relation. A project carries `scopeIds`; each scope has a `relatedTrade` (the Notion trade UUID). So filtering is: **funnel trade UUID → scopes whose `relatedTrade` matches → projects whose `scopeIds` intersect those scopes.**
- `constants/trade-scopes.ts` — `Record<FunnelSlug, string>` mapping each funnel to its Notion **trade** UUID (verified 2026-06-18 against "All Construction Trades DB"):
  - `kitchens` → `6240ca1b-548b-837d-a9c0-01acc1fb530a` (Notion: "Kitchen Remodel")
  - `bathrooms` → `1290ca1b-548b-830d-a13c-01e4da06eb3d` (Notion: "Bathroom Remodel")
  - `complete-interior` → `9340ca1b-548b-83d5-b3cd-01b5cce9b199` (Notion: "Interior Upgrades & Home Layout")
- The scope→trade map is built at runtime from the scopes data (each scope exposes `relatedTrade`). The plan must identify the client-reachable procedure that returns scopes-with-`relatedTrade` (the `features/project-management` `use-portfolio-filters.ts` builds this from a `getAllScopes`-style source; the funnel block needs the equivalent tRPC query — verify during planning, do NOT import the features hook).
- **Drift guard:** these UUIDs are live Notion page IDs with no in-code source of truth. If a funnel's trade UUID resolves to zero matching scopes/projects, the block degrades to rendering nothing AND logs a `console.warn` so a drifted/renamed trade is visible, not silent.

> ⚠️ **Flagged, out of scope:** `lib/build-lead-input.ts`'s `TRADE_NAME` map (slug → "canonical Notion trade name") diverges from the live Notion trade names on all three trades ("Renovation" vs "Remodel"; "Complete Interior Remodel" vs "Interior Upgrades & Home Layout"). This affects lead/CloudTalk/SMS attribution, not portfolio filtering. Recommend a standalone fix or folding into Plan 2c — NOT addressed in this plan.

---

## §3 Option visuals + AI asset pipeline

**Card variant.** `card-select-step.tsx` gets an **image-forward layout**: when an option has an `asset: { kind: 'image' }`, render a larger example image (≈ full card width, fixed aspect ratio) above the label — instead of the current tiny 48×48. Icon and no-asset layouts remain. The `OptionAsset` union already supports `{ kind: 'image', src, alt }` — no type change.

**Immediate fix (the nonsensical icons).** Replace the placeholder Lucide icons (`Square` for L-shape, `LayoutGrid` for U-shape, etc.) with **accurate authored SVG floor-plan diagrams** for L / U / galley / island / open / not-sure, so the cards read correctly. These are deterministic, tiny, on-brand, and need no AI. Stored as components/SVG referenced via the icon-name registry (`OPTION_ICONS`) OR as image assets — implementation chooses; the cards must accurately depict each layout.

**Asset manifest.** `docs/funnels/asset-manifest.md` — the generation worklist: every asset each campaign needs (per option, per hero), with prompt notes and target dimensions. This is the deliverable that drives out-of-band image generation.

**Tooling (research outcome).** Photoreal example/marketing imagery → **FLUX.2 Pro** (most photorealistic, low per-image cost, consistent variants via Kontext-style editing — ideal for "same kitchen, multiple layouts"). Clean baked-in text (badges) → **Ideogram**. Layout diagrams → authored SVG (Recraft can vector-trace a head start). **Higgsfield** is a video/cinematic-motion tool — reserved for the future ZIP map animation / hero video, NOT these stills. Generation happens out-of-band; the manifest + tool choice is the in-repo deliverable.

**Storage & migration.**
- **Now:** assets land in `public/funnels/<slug>/`, referenced as `/funnels/<slug>/...` in funnel metadata. Visuals ship without waiting on bucket provisioning.
- **Follow-up task (same plan, later):** migrate to a new R2 bucket `tpr-funnel-assets` with its own public domain, via the existing `r2Client` + `get-optimized-urls`. The migration is a `src` ref swap + bucket/public-domain registration in `shared/services/providers/r2/types.ts`. Sequenced after the visuals land so the two don't block each other.

---

## §4 Form performance

**4.1 Slow initial load — investigate first (measured, not guessed).** A diagnostic task precedes any fix: profile the funnel route's initial load / bundle. Likely culprits: eager full `lucide-react` / `motion` imports, client-side spec resolution, the step registry pulling all step components eagerly. Fix follows the finding — candidate remedies: `dynamic()` for heavier/below-fold steps and blocks, defer the portfolio fetch, trim icon imports to per-icon. Record the measurement in the task before/after.

**4.2 Snappier step transitions.** Tune `FUNNEL_TRANSITION` in `constants/funnel-motion.ts` — shorter duration / tighter easing for a snappier feel. Respect `useReducedMotion` (already wired).

**4.3 Convincing multi-step ZIP check.** Replace the single 1200ms anticipation beat in `location-step.tsx` with a **multi-step checklist**: ~4 honest sub-steps that each resolve to a green ✓ in sequence —
1. "Locating your ZIP…"
2. "Checking service radius…"
3. "Confirming crew availability…"
4. "Reserving your area…"

ending as a single check + "Your ZIP qualifies." The real `resolveZip` / `classifyZip` runs underneath; the checklist paces the existing anticipation window (the steps are presentation over the real async, not fake claims of distinct backend calls — copy chosen to be honest framing of "we're checking your area"). Out-of-area and invalid-format phases unchanged in logic. New component: `ui/steps/zip-check-progress.tsx` (the checklist animation), driven by the location step.

---

## §5 Carried fix (a) — shared `clientIp` helper

Extract `clientIp(req): string` to a shared server util returning `x-vercel-forwarded-for ?? x-real-ip ?? 'anonymous'` (edge-set, un-spoofable on Vercel; raw `x-forwarded-for` is client-spoofable and must not be trusted). Apply it in:
- `src/trpc/routers/funnels.router.ts` (replace the inline `clientIp` added in Plan 2b.5)
- `src/trpc/routers/customers.router/business.router.ts` `createFromIntake` (currently uses the spoofable raw pattern — same bug class, lower risk, no paid per-call API)

Verify the helper location follows the repo's util conventions (likely `src/shared/lib/` or a trpc-adjacent helper since it consumes the request). No behavior change beyond the trusted-header switch.

---

## §6 Carried fix (b) — a11y / polish

Folded into this plan (was "file an issue"):
- `aria-live="polite"` on the ZIP phase-change content so the checklist / qualifies / out-of-area messages are announced.
- Per-part trim on the PII name fields (`firstName` / `lastName`) before composing `name`.
- Honeypot field: use `display:none` (the current `className="hidden"` is fine; confirm it's not focusable and is `aria-hidden`).

---

## §7 Verification

- `pnpm tsc` + `pnpm lint` clean.
- Throwaway `tsx` assertion scriptlets (run then delete) for pure logic: the `slug → scopeId[]` trade map resolution, `DEFAULT_LANDING_BLOCKS` composition/override, and any block content defaulting.
- Playwright-MCP smoke: landing renders hero + Q1 + blocks; answering Q1 transitions into the focused funnel; bottom CTA scrolls to Q1; ZIP checklist runs through its steps to "qualifies"; portfolio block renders live projects (and degrades to nothing when empty).
- Form-load: record the §4.1 measurement before/after.

## §8 Stop-lines / non-goals

- Do NOT build enrichment, appointment booking, or confirmation (→ Plan 2c).
- Do NOT add new dependencies.
- Do NOT import `features/` from `shared/`.
- Do NOT generate final production imagery in-repo — the manifest + tool recommendation is the deliverable; generation is out-of-band.
- R2 migration does not block the visual fix; it is a sequenced follow-up task.

## Components touched (map)

**New:**
- `ui/funnel-landing.tsx`
- `ui/blocks/reviews-block.tsx`, `testimonials-block.tsx`, `portfolio-block.tsx`, `licensing-block.tsx`, `guarantee-block.tsx`
- `constants/marketing-registry.ts`, `constants/default-landing-blocks.ts`, `constants/trade-scopes.ts` (slug → Notion trade UUID)
- `ui/steps/zip-check-progress.tsx`
- `docs/funnels/asset-manifest.md`
- shared `clientIp` helper file

**Modified:**
- `types.ts` (MarketingBlock union + registry types, `FunnelSpec.landing`)
- `ui/funnel-engine.tsx` (landing vs focused dispatch)
- `ui/funnel-hero.tsx` (landing styling)
- `ui/steps/card-select-step.tsx` (image-forward variant)
- `ui/steps/location-step.tsx` (multi-step checklist + aria-live)
- `constants/option-assets.tsx` (accurate diagrams)
- `constants/funnel-motion.ts` (transition tuning)
- `constants/kitchens.ts` (+ `bathrooms.ts`, `complete-interior.ts`) (landing blocks, image assets)
- `lib/build-lead-input.ts` (name trim)
- `pii-form-step.tsx` (honeypot/a11y polish)
- `funnels.router.ts`, `business.router.ts` (shared `clientIp`)
