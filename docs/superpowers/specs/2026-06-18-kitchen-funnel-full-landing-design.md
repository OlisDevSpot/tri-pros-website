# Kitchen Funnel — Full Trust-Rich, Kitchen-Specific Landing — Design Spec

**Date:** 2026-06-18
**Status:** Draft for user review (copy included for refinement)
**Predecessors:** `2026-06-18-funnel-landing-and-asset-pipeline-design.md` (block library), `2026-06-18-funnel-landing-polish-and-reviews-design.md` (polish + reviews). Legibility fix already landed (`text-foreground` on `.funnel-light`).

## Goal

Turn the kitchens funnel landing from a generic 5-block skeleton into a long-scroll, trust-rich, **kitchen-specific** conversion page that composes the company's real content and trust arsenal, plus newly-drafted positioning/FAQ/financing copy.

## Strategy & rationale

The repo already holds the content; the funnel just doesn't compose it. `kitchens.ts` sets no `landing.blocks`, so it falls back to generic defaults. The fix is **architectural + compositional**: add a few generic, content-driven marketing-block kinds, then have `kitchens.ts` author a kitchen-specific block list. Trust signals move to a scannable **TrustBar** at the top (first thing seen). Drafted copy (positioning, FAQ, financing) lives in this spec for the user to refine, then in `kitchens.ts`.

**User-flow (Pass 1):** cold Meta-ad homeowner, mobile, skeptical, high-ticket purchase. Order for conversion: instant legitimacy (brand + trust bar) → micro-commitment (Q1) → agitate the real problem → show the payoff (ROI) → prove it (before/after + reviews) → de-risk (process + guarantee + accreditations) → handle objections (FAQ + financing) → close (CTA).

## Global Constraints

- Scoped LIGHT mode (done); funnel components use semantic tokens only (`bg-background`/`text-foreground`/`text-muted-foreground`/`bg-card`/`border-border`/`text-primary`), NO `dark:` utilities, NO hardcoded colors. **Exception:** yellow star glyphs (`fill-yellow-500`).
- Stars yellow. Primary color reserved for CTAs + a small number of highlighted words; not sprayed.
- All company data from `src/shared/constants/company/` — never hardcode license #, ratings, stats, URLs.
- Kitchen copy authored inline in `kitchens.ts` (shared/ cannot import features/`trade-*`). May be extracted to `shared/constants/` later.
- New block kinds via lockstep: `MarketingBlock` union + content interface + `MARKETING_REGISTRY` entry + component (the mapped types compile-enforce registry completeness).
- Motion: reuse `FUNNEL_TRANSITION`; reduced-motion-gated; transform/opacity only.
- Conventions: one component per file; named exports; no file-level consts/helpers in component files; `shared/` never imports `features/`; lint clean.
- Logo: use the **dark-ink** asset (`logo-dark*.svg`) for the light funnel; render it directly via `next/image` (the shared `Logo` component switches on `dark:` and misfires under `html.dark`).
- Honesty: no fabricated trust signals (no Norton/Trustpilot we don't carry); no invented financing rates or fixed cost numbers.
- `pnpm tsc` + `pnpm lint` clean. NEVER `pnpm build` / `pnpm db:push`.

## Architecture

### New marketing-block kinds (generic shells, content-driven, reusable by any funnel)

Added to `MarketingBlock` union in `types.ts`, each with a content interface; component in `ui/blocks/`; registered in `MARKETING_REGISTRY`.

```ts
// problem-agitation + raise-the-bar ("why it's hard to get right")
export interface ProblemBlockContent {
  headline: string
  body?: string
  points: { title: string, body: string }[]
  standardLine?: string   // "what to demand" — positions the company as the bar
}
// pain→outcome value with optional ROI stat
export interface ValueBlockContent {
  headline: string
  intro?: string
  roiStat?: { value: string, label: string }
  items: { before: string, after: string }[]
}
// how-it-works steps (with optional public image path)
export interface ProcessBlockContent {
  title?: string
  steps: { title: string, body: string, image?: string, duration?: string }[]
}
// FAQ accordion
export interface FaqBlockContent {
  title?: string
  items: { q: string, a: string }[]
}
// generic callout (used for financing/offer)
export interface CalloutBlockContent {
  headline: string
  body: string
  points?: string[]
}
```

`MarketingBlock` union gains: `{ kind: 'problem', content: ProblemBlockContent }`, `value`, `process`, `faq`, `callout`. Accreditations are folded into the TrustBar + existing `licensing` block (no new kind).

### TrustBar (top, hero-coupled — NOT a registry block)

New `src/shared/domains/funnels/ui/trust-bar.tsx`, rendered in `FunnelLanding` between `FunnelHero` and the Q1 anchor. Composes:
- Platform badges (reuse `PlatformBadge` + `StarRating`): Google ★ (rating/count), Yelp, BBB **A+** — links from `socials`, A+ from `stats`.
- Check chips (lucide `Check`/`ShieldCheck`): "Licensed & Insured", "CSLB #1076760", "520+ Projects", "40+ Yrs", "98% Satisfaction" — from `companyInfo`/`licenses`/`stats`.
All values from constants. Wraps responsively; scannable; not card-in-card.

### Hero changes (`funnel-hero.tsx`)

- Logo at top: `import LogoDark from '@public/company/logo/logo-dark-right.svg'` → `<Image src={LogoDark} alt="Tri Pros Remodeling" .../>`, constrained height, centered. (No `Logo` component.)
- `font-serif` on the headline (brand match with the marketing site).
- Highlighted words: add `highlightWords?: string[]` to `HeroContent`; a pure helper `renderHighlightedHeadline(headline, highlightWords)` in `src/shared/domains/funnels/lib/highlight-headline.tsx` returns `ReactNode[]`, wrapping matched phrases in `<span className="text-primary">`. Kitchens: `highlightWords: ['AAA-grade', 'Showcase']`.

### Reviews + testimonials reconciliation

- Move badges OUT of `reviews-block` (now in TrustBar). `reviews-block` renders **only the curated cards** (yellow stars).
- **Remove the `testimonials` block** from the kitchens composition (its blue `fill-primary` stars duplicate the review cards — the redundancy the user flagged). The `testimonials` kind stays in the library but isn't used by kitchens.

### CTAs

Inter-block CTAs → **primary** variant (user directive). Insert after roughly every 3rd block (with the larger block count) to avoid clustering; keep the bottom primary CTA. All scroll to `#funnel-q1`.

### Kitchens composition (`kitchens.ts` → `landing.blocks`, ordered)

1. `problem` — why kitchen remodels go wrong (agitate + raise the bar)
2. `value` — highest-ROI room (pain→outcome + 60–80%)
3. `portfolio` — real before/after bento (trade-filtered)
4. `reviews` — curated cards (yellow)
5. `process` — how your Showcase kitchen comes together (4 steps + images)
6. `callout` — financing ("start now, pay over time")
7. `faq` — kitchen FAQ
8. `guarantee` — workmanship guarantee
9. `licensing` — licensed/bonded/insured + accreditation chips

TrustBar renders above Q1; final CTA at the bottom.

## Files

**New:** `ui/trust-bar.tsx`; `ui/blocks/{problem,value,process,faq,callout}-block.tsx`; `lib/highlight-headline.tsx`; (optional) `constants/landing-cta-interval.ts`.
**Modified:** `types.ts` (5 content interfaces + union + `HeroContent.highlightWords`); `marketing-registry.ts` (5 entries); `funnel-hero.tsx` (logo + serif + highlights); `funnel-landing.tsx` (TrustBar render + CTA primary/interval); `reviews-block.tsx` (cards-only); `kitchens.ts` (full `landing.blocks` + highlightWords).

## Design-audit notes (ui-ux-pro-max + web-design-guidelines + impeccable)

- FAQ uses an accessible accordion (button + `aria-expanded`, region); or simple `<details>`/`<summary>` for zero-JS + a11y. Prefer `<details>` styled.
- Process step images: `next/image` explicit dims, `alt`, lazy below fold.
- Headings hierarchy: hero `h1`, each block `h2`, FAQ questions `h3`/summary.
- Logo `<Image>` explicit width/height (CLS); meaningful `alt="Tri Pros Remodeling"`.
- TrustBar chips ≥ legible; check icons `aria-hidden`, text carries meaning (not color-only).
- No nested cards; one primary CTA emphasis per viewport; highlighted words limited to 1–2 phrases.
- Curly quotes/`…`/`&nbsp;` in drafted copy; `tabular-nums` on stat numbers.
- All reduced-motion-gated; transform/opacity only.

## Open flags / honesty

- ⚠️ Testimonials + awards are placeholder/fabricated; `4.9★/200` is a default not a real Google pull — refine before launch.
- ⚠️ **Confirm financing is actually offered** and on what terms before the financing callout goes live; drafted copy states no rates.
- ⚠️ FAQ cost answer intentionally gives NO fixed price (avoids a number that balloons); confirm the timeline ranges (~6–10 wks construction) are accurate.
- ⚠️ Stale asset paths to fix separately (out of scope, flagged): `companyInfo.logo='/logo.png'` (missing), broken team-headshot paths, `/services/` pillar hero images.

## Testing / verification

- `pnpm tsc` 0 / `pnpm lint` 0; union(N) == registry(N); each kitchens block content matches its interface.
- Browser smoke (light): logo + highlighted headline legible; TrustBar badges link out; all 9 blocks render in order with real/placeholder data; FAQ expands; process images load; CTAs primary + scroll to Q1; portfolio shows real kitchen projects; 0 console errors; reduced-motion clean; 375px no horizontal scroll.
- Invariants: no `shared/`→`features/`; no `dark:` utilities in funnel; no hardcoded colors (except yellow stars); no new deps.

## Stop-lines

- No fabricated trust badges or financing terms.
- Light scope stays funnel-only.
- New block kinds are generic shells; kitchen specifics live in `kitchens.ts` content, not hardcoded in components.
- Don't fix the stale asset paths in this batch (separate).

---

## Appendix A — Drafted copy (REVIEW & REFINE)

### Hero
- headline: `Get a AAA-grade kitchen remodel — at a Showcase price.`  (highlight: `AAA-grade`, `Showcase`)

### `problem` — "Why kitchen remodels go wrong"
- headline: `Most kitchen remodels go sideways. Here's why.`
- body: `A kitchen is the hardest room in the house to get right — plumbing, gas, electrical, cabinetry, and tight tolerances all have to land at once. One weak link and you're living in a months-long jobsite.`
- points:
  - `Cut-rate "deal" crews` — `Low bids hide unpermitted work, no insurance, and no recourse when something goes wrong.`
  - `No one accountable` — `Independent subs blame each other and you become the project manager of your own remodel.`
  - `Surprise change-orders` — `A cheap bid becomes an expensive invoice the moment demo opens the walls.`
  - `Endless timelines` — `Without real scheduling, six weeks becomes six months — and your kitchen stays unusable.`
- standardLine: `What to demand: a licensed, bonded, insured GC you can verify, one accountable team, a fixed written scope, and a real schedule. That's the bar — and for us it's the floor.`

### `value` — "The highest-ROI room in your home"
- headline: `Your kitchen, redesigned for how you actually live.`
- roiStat: `60–80%` / `resale ROI — the highest of any room`
- items (before → after):
  - `Cabinets that don't close right` → `Soft-close cabinetry, built to last`
  - `Counter space that was never enough` → `Quartz counters with room to actually cook`
  - `A layout that fights you` → `An optimized layout designed around your life`
  - `A kitchen that feels decades behind` → `A space that finally matches how you live`

### `process` — "How your Showcase kitchen comes together" (images from `public/process/`)
- `Discovery & Design` (Wk 1–2, `/process/design-stage.jpeg`) — `We map your goals, measure, and design a kitchen around how you actually cook and live.`
- `Pre-Construction & Permits` (Wk 3–4, `/process/pre-construction-stage.jpeg`) — `We lock the scope, pull permits, and order materials so the build runs without surprises.`
- `Construction` (`/process/construction-stage.jpeg`) — `One accountable crew, daily quality checks, and photo documentation — not a rotating cast of subs.`
- `Completion & Handover` (`/process/handover-stage.jpeg`) — `Final walkthrough, punch list, and a kitchen that's done right — backed by our workmanship guarantee.`

### `callout` — Financing
- headline: `Start now, pay over time.`
- body: `Flexible financing options make a Showcase kitchen attainable without draining your savings. We'll walk you through what you qualify for during your consultation — no obligation.`
- points: `Options for a range of budgets` · `No-obligation consultation` · `Clear, written numbers up front`

### `faq` — Kitchen FAQ
- `How much does a kitchen remodel cost?` — `It depends on size, scope, and finishes — which is exactly why we give you a fixed written scope and clear numbers up front instead of a low guess that balloons later. Most Showcase kitchens land in a range we'll walk you through on your consultation.`
- `How long does it take?` — `A typical Showcase kitchen runs about 6–10 weeks of active construction after design and permits, depending on scope. You get a real schedule — not a vague "couple of months."`
- `Do I need permits?` — `Most kitchen remodels that touch plumbing, gas, or electrical do. As a licensed general contractor we pull and manage them for you. Unpermitted work becomes your problem when you sell.`
- `Can I use my kitchen during the remodel?` — `There's a window where it's offline. We sequence the work to keep that window as short as possible and tell you exactly when, up front.`
- `Is financing available?` — `Yes. We offer financing options so you can start now and pay over time — we'll cover what you qualify for during your consultation.`
- `Are you licensed and insured?` — `Fully. We're a licensed, bonded general contractor (CSLB #1076760) insured up to $1M general liability — and you can verify our license on the CSLB website.`

### `guarantee` (existing copy, kept)
- headline: `Showcase-grade work, guaranteed` · body: `Every Showcase project is backed by our workmanship guarantee.` · scarcity: `We're selecting 5 kitchens in your area this month.`
