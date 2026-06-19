# Funnel Landing Polish & Reviews Overhaul — Design Spec

**Date:** 2026-06-18
**Status:** Approved (design); pending spec review → plan → SDD
**Predecessor:** `2026-06-18-funnel-landing-and-asset-pipeline-design.md` (the landing + marketing-block library this polishes)

## Goal

Polish the funnel landing into a credible, mobile-first, light-mode trust surface: fix the back-navigation dead-end, add motion (staggered cards, smooth hero entrance, shared-element morph), rebuild the reviews section with real platform proof and a reusable reviews UI, replace the uniform portfolio grid with an editorial bento, right-size the Q1 cards for mobile, and add low-friction re-entry CTAs.

## Context & user-flow rationale (Pass 1)

**Who:** A cold inbound lead from a Meta ad — SoCal homeowner, low construction-domain knowledge, high skepticism, almost certainly on a phone (one thumb), ready to bounce.

**Scenario:** They tapped a paid ad promising an offer. They land mid-scroll-session, low commitment. The landing must earn a micro-commitment (answer Q1) fast, then build trust to carry them to the PII step without bouncing.

**Most probable path:** Mobile, thumb-driven; answers Q1 immediately *iff* it's frictionless (all options visible without scrolling — hence the mobile-sizing fix), then scrolls for reassurance, then continues.

**Where the primary moment lives:** the Q1 card interaction and the qualify CTA. Stars are yellow (the universal trust convention); the brand primary color is reserved for the single forward action, not sprayed across the page.

## Global Constraints

- **Scoped light mode only.** The funnel renders light even though `<html class="dark">` is hard-coded app-wide. Achieved by re-declaring the existing `:root` light tokens on a `.funnel-light` wrapper (see §7). The rest of the site is untouched. Funnel components must NOT use `dark:` utilities — rely on semantic tokens (`bg-background`, `text-foreground`, …).
- **Stars are yellow** (`text-yellow-500` fill), never `primary`/blue. Matches the existing home testimonials component.
- **Primary color is reserved for the single forward CTA.** Inter-block re-entry CTAs are secondary/ghost. No primary on 3+ distinct things (anti-slop).
- **All company data derives from `src/shared/constants/company/`** — license #, ratings, BBB status, profile URLs, project counts. Never hardcode in components (`feedback-company-data-central-ref`).
- **Motion:** reuse `FUNNEL_TRANSITION` easing `[0.32, 0.72, 0, 1]`. Micro-interactions 150–300ms; stagger 50ms/item; exit faster than enter; animate `transform`/`opacity` only; every animation gated on `useReducedMotion()`.
- **Coding conventions:** one React component per file; named exports only; no file-level constants/helpers in component files (extract to `constants/` / `lib/`); no barrels in `ui/`,`constants/`,`lib/`; `shared/` never imports `features/`; `schemas/` sibling of `lib/`.
- **Reusable reviews components live in `src/shared/components/reviews/`** (app-wide reuse), not inside the funnels domain.
- **Verify, don't break:** `pnpm tsc` and `pnpm lint` clean; no `pnpm build`; no `pnpm db:push`.

## Surfaces & Design Decisions

### 1. Navigation fix — landing persists on Back, with a forward path

The landing (hero + marketing) **re-appears on Back** (the engine keeps rendering `FunnelLanding` while `engine.isFirst`). The dead-end is fixed by adding a **forward affordance**, not by hiding the landing:

- **`CardSelectStepView` gains a "Continue →" button** rendered only when `isAnswered` (i.e. `value != null`). It calls `advance()`. Because the card step owns `advance`, this works identically on the fresh landing and on a Back-return. lucide `ArrowRight` icon; primary; ≥44px; visible focus ring.
- On the **fresh, unanswered** landing the button is absent (the card's existing first-answer auto-advance carries the user forward on tap).
- **On Back-return to the landing, scroll Q1 into view on mount** (when `isAnswered`) so the Continue button is immediately visible rather than buried under the hero. Initial unanswered load stays scrolled to the hero top.

This makes every page CTA (bottom + inter-block) a "scroll to Q1" action, and Q1 itself the single commit point — one coherent mental model.

### 2. Smooth hero entrance (no jarring pop)

Wrap the landing body in `AnimatePresence`; the landing's root `motion.div` gets `initial={{opacity:0, y:8}} animate={{opacity:1, y:0}} exit={{opacity:0, y:8}}` with `FUNNEL_TRANSITION` (≈0.18–0.3s, ease-out). The hero fades up as one intentional motion instead of snapping in when returning from step 2. Gated on `useReducedMotion()` (then `initial={false}`).

**Shared-element morph:** the Q1 card container carries `layoutId="funnel-q1"`. When the engine swaps between the landing (full-width column) and the focused column (`max-w-xl`), motion animates the card between the two positions/sizes instead of cross-fading. Both the landing's Q1 wrapper and the focused-column wrapper use the same `layoutId`. (Framer Motion 5+/motion: `layoutId` alone; no `AnimateSharedLayout`.)

### 3. Q1 card step — centered, mobile-right-sized, staggered

- **Center-aligned:** icon, label, and description all centered (`items-center text-center`). Fixes today's centered-icon / left-text mismatch.
- **Mobile sizing:** `grid-cols-2` on mobile (was `grid-cols-1`) with **compact** cards — smaller diagram area (`aspect-square` or reduced height, `size-12`–`size-14` icon vs `size-20`), tighter padding (`p-3`), **description hidden below `sm`** (label only) so all 6 options fit one mobile screen without scrolling. Scales to roomier cards + visible descriptions at `sm:`.
- **Staggered entrance:** the grid is a `motion.div` with container variants:
  ```
  hidden:  {}
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } }
  ```
  Each card is a `motion.button` with `variants={{ hidden:{opacity:0,y:12}, visible:{opacity:1,y:0} }}`, `initial="hidden" animate="visible"`. Gated on `useReducedMotion()`.
- **Press feedback:** `whileTap={{ scale: 0.97 }}` (transform only). `touch-action: manipulation`.
- Selected state keeps the **outline** highlight convention (`outline-2 outline-primary -outline-offset-2`, per `feedback-highlight-outline-pattern`), not a ring.

### 4. Reviews — credible, yellow-starred, reusable

*(Decision: badges + curated cards now; live Google feed later.)*

**New reusable components in `src/shared/components/reviews/`:**
- `star-rating.tsx` — `StarRating({ rating, count?, size?, showValue? })`. Yellow filled stars (`fill-yellow-500 text-yellow-500`), empty stars `text-muted-foreground/30`. Numeric value rendered as **dark foreground text** (yellow text fails 4.5:1; star glyphs are large/decorative so 3:1 is fine). `aria-label` e.g. `"4.9 out of 5 stars from 200 reviews"`; individual star glyphs `aria-hidden`.
- `platform-badge.tsx` — `PlatformBadge({ platform, rating?, label?, href })`. A card-styled, tappable badge linking to the real profile (`target="_blank" rel="noopener noreferrer"`, descriptive `aria-label`). Renders platform name + StarRating or label (e.g. BBB "A+"). ≥44px tap height.
- `review-card.tsx` — `ReviewCard({ name, location?, text, rating, platform?, image? })`. Light card, soft shadow (`shadow-sm`), yellow StarRating, blockquote, attribution, optional verified check + platform tag.

**Funnel `ReviewsBlock` (rewritten)** composes:
1. A **proof strip** of three `PlatformBadge`s — **Google** (rating from block content, link from `socials.google`), **Yelp** (link from `socials.yelp`), **BBB** ("A+", from `stats`; link to BBB profile if available, else non-link badge). Wraps responsively; centered.
2. A **row of `ReviewCard`s** (2-up mobile-stacked → 3-up desktop) from the existing company testimonials (placeholder content — flagged §10).

All numbers/links pulled from `src/shared/constants/company/` (`socials.ts`, `stats.ts`, `company-info.ts`). Block content keeps `rating`/`count` overridable.

**Seam for live reviews:** `ReviewsBlock` reads its card list from a single source (`content.items ?? company testimonials`); a future Google Places integration swaps that source with no component change.

### 5. Editorial bento media (replaces uniform 3×2)

Rewrite `PortfolioBlock`'s grid as an **asymmetric bento mosaic**: one featured tile spanning 2×2, remaining tiles filling a `grid-cols-2 sm:grid-cols-3` + `auto-rows` layout with varied spans. Rounded corners (`rounded-2xl`), subtle hover zoom (`transition-transform group-hover:scale-[1.03]`, image-only, overflow-hidden parent — no layout shift). Every tile uses `next/image` with explicit width/height (CLS-safe), `loading="lazy"` (the featured tile may be eager), meaningful `alt` (project title).

**Data + placeholder fallback:** keep the real trade-filtered DB projects it already fetches. If fewer than the bento's slot count match, **pad with curated public construction photos** (`src/shared/domains/funnels/constants/portfolio-fallback-images.ts` — paths from `public/`: `modern-kitchen-1.jpeg`, `modern-bathroom-1.jpeg`, `modern-staircase-1.jpeg`, `hero-photos/modern-house-*`, select `portfolio-photos/projects/*` after/hero shots). Fallback images carry generic alts. Interim until real coverage per trade (flagged §10). Skeleton during load is preserved.

### 6. Inter-block re-entry CTAs

A lightweight **secondary** CTA ("See if you qualify ↑", lucide `ArrowUp`) inserted **after every 2nd marketing block**, each smooth-scrolling to `#funnel-q1`. Ghost/secondary styling (not primary). The existing bottom CTA stays. This satisfies "more ways back to the micro-interaction" without a wall of buttons or primary overload.

### 7. Scoped light mode

In `globals.css`:
1. Change the light-token selector from `:root {` to `:root,\n.funnel-light {` — the funnel subtree gets the identical light token values (single source, no duplication/drift), overriding the dark values inherited from `<html class="dark">`.
2. Add `.funnel-light { color-scheme: light; }` (fixes native scrollbar/inputs/select rendering per web guidelines).
3. Tag the funnel route wrapper: `src/app/(frontend)/funnels/layout.tsx` → `<div className="funnel-light min-h-dvh bg-background">`.

Constraint: funnel components avoid `dark:` utilities (the `dark` variant still matches under `html.dark`); they rely on tokens, which now resolve light.

## Component / File Inventory

**New:**
- `src/shared/components/reviews/star-rating.tsx`
- `src/shared/components/reviews/platform-badge.tsx`
- `src/shared/components/reviews/review-card.tsx`
- `src/shared/domains/funnels/constants/portfolio-fallback-images.ts`
- (optional) `src/shared/domains/funnels/constants/landing-cta-interval.ts` — the "every 2nd block" interval constant

**Modified:**
- `globals.css` — `.funnel-light` light-token scope + `color-scheme`
- `src/app/(frontend)/funnels/layout.tsx` — `funnel-light` wrapper
- `funnel-engine.tsx` — `layoutId` on focused-column Q1 wrapper; (landing branch unchanged structurally)
- `funnel-landing.tsx` — `AnimatePresence` + motion root; inter-block CTAs; `layoutId` on Q1 wrapper; scroll-to-Q1-on-back
- `ui/steps/card-select-step.tsx` — centered, 2-col compact mobile, stagger, Continue button, tap scale, outline highlight
- `ui/blocks/reviews-block.tsx` — proof strip + review cards via shared components
- `ui/blocks/portfolio-block.tsx` — bento layout + fallback padding
- (light-mode token resolution makes existing blocks render light automatically)

## Design-Audit Punch List (ui-ux-pro-max + web-design-guidelines + impeccable)

**Accessibility**
- Star numeric value = dark foreground text (yellow fails 4.5:1); star glyphs `aria-hidden`, container `aria-label` carries the rating.
- Platform badges: descriptive `aria-label` ("Google rating 4.9 out of 5, opens in new tab"); not color-only.
- External links: `target="_blank" rel="noopener noreferrer"`.
- Heading hierarchy: hero `h1`, block `h2` — sequential, no skips.
- Bento images: meaningful `alt` (project title); fallback images generic alt.
- `scroll-margin-top` on `#funnel-q1` (already `scroll-mt-6`; keep/verify).
- Keep visible `focus-visible` rings on cards, Continue, CTAs, badges.

**Touch & Interaction**
- Compact mobile cards still ≥44px tap height; ≥8px gap. Continue/CTAs ≥44px.
- `touch-action: manipulation`; intentional tap-highlight.
- Press feedback within 100ms (whileTap scale).

**Performance / CLS**
- All images explicit width/height or aspect-ratio; bento reserves space.
- `loading="lazy"` below fold; portfolio block already dynamic-imported.
- Transform/opacity-only animations; no width/height/top/left.

**Style / anti-slop (impeccable)**
- One primary CTA emphasis; inter-block CTAs secondary. No primary overload.
- No nested cards (badge strip is flat, not card-in-card-in-card).
- No decorative uppercase-tracked labels per row.
- lucide icons only (ArrowRight/ArrowUp/Star/BadgeCheck) — no emoji, no literal-glyph arrows where an icon is cleaner.
- Consistent elevation scale (`shadow-sm` for review cards, no random shadows).

**Layout**
- Mobile-first; no horizontal scroll at 375px; bento must not overflow.
- 4/8px spacing rhythm; consistent container max-widths (`max-w-xl` focus, `max-w-5xl` blocks).
- Bottom CTA respects `env(safe-area-inset-bottom)` if it becomes sticky (per app-shell memory) — current bottom CTA is in-flow; keep in-flow unless sticky is added.

**Typography**
- Body ≥16px; card labels readable; descriptions `text-sm` (14px), hidden on mobile compact (not shrunk below 12px).
- Curly quotes in review blockquotes; `…` not `...`; `&nbsp;` for "A+" / brand adjacencies where wrapping looks wrong; `tabular-nums` on the rating value.
- `text-balance`/`text-pretty` on hero headline (already `text-balance`).

**Animation**
- Stagger 50ms/item; enter ease-out, exit ~60–70% duration; interruptible; reduced-motion variant.
- Forward = up/left, back = down/right (keep `layoutId` morph + entrance directions consistent).

**Forms / Navigation**
- Continue button is `<button>` (action), CTAs that scroll are `<button>` too (in-page action, not navigation). Back/Next predictable.
- aria-live on the qualify/out-of-area location states (already present) — keep.

## Data Flow

- `socials.google`, `socials.yelp` → PlatformBadge hrefs. `stats` → BBB "A+". `company-info` (numProjects, satisfaction) available if a stat strip is wanted (not required).
- Reviews cards: company `testimonials` (placeholder) via `content.items ?? defaults`.
- Portfolio: `notionRouter.scopes.getAll` + `projectsRouter.showroomDisplay.getAll`, trade-filtered (unchanged), padded with `portfolio-fallback-images`.
- Theme: CSS-variable scope only; no JS.

## Error / Edge Handling

- Portfolio: 0 DB matches → bento renders entirely from fallback images (block no longer returns `null`, so the landing always has media). Keep the `console.warn` drift guard.
- Missing BBB profile URL → BBB badge renders as a non-link proof chip (still shows "A+").
- `useReducedMotion()` → all entrance/stagger/morph disabled (static render).
- Hydration: landing motion `initial` guarded; no date/random in render.

## Testing / Verification

- `pnpm tsc` 0, `pnpm lint` 0.
- Manual/browser smoke (dev :3000, localStorage cleared):
  1. `/funnels/kitchens` loads **light**; hero + 6 **centered** cards staggering in; all 6 visible on a 375px viewport without scrolling.
  2. Answer Q1 → focused column (card morphs, not snaps). Click **Back** → landing re-appears (hero + marketing), scrolled to Q1, **Continue →** visible; Continue advances. **No dead-end.**
  3. Reviews: yellow stars; Google/Yelp/BBB badges link to real profiles in new tabs; review cards render.
  4. Portfolio renders as bento (real kitchen projects; padded if needed).
  5. Inter-block "↑" CTAs scroll to Q1.
  6. 0 console errors; `prefers-reduced-motion` disables animation cleanly.
- Invariants: no `shared/`→`features/` import; no new deps; named exports; one component/file.

## Open Flags (not blockers)

- ⚠️ The 3 company `testimonials` read like **seed/placeholder** data — swap real review quotes when available (clean seam in place).
- ⚠️ Confirm the **4.9 / 200+** Google numbers against the real Google profile; they're currently funnel defaults.
- Live Google Places reviews feed = deferred follow-up (separate integration: API key + place_id + caching).
- Optional hero image (public modern-house photo) to strengthen the trust hero — include if low-risk; otherwise defer.

## Stop-Lines

- Do not touch the rest of the site's theme; light is scoped to the funnel subtree only.
- Do not wire the Google Places API in this batch.
- Do not replace real DB portfolio projects with placeholders — placeholders only **pad** thin coverage.
- Do not introduce `dark:` utilities into funnel components.
- Do not hardcode company data in components.
