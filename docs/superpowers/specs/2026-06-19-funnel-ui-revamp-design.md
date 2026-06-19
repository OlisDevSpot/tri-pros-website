# Funnel UI Revamp — Design Spec

**Date:** 2026-06-19
**Scope:** Public kitchen funnel — global width rail, confirmation-page revamp (energetic & motion-rich), address-step polish.
**Status:** Approved for planning.

## Context

The funnel (`src/shared/domains/funnels/`) is a headless, content-free engine rendered under a `.funnel-light` scoped-light wrapper (`src/app/(frontend)/funnels/layout.tsx`). Recent work aligned the sticky header to the page rail and replaced a chaotic marketing-bento fallback on the confirmation step. Three issues remain:

1. **Widths feel inconsistent across desktop.** No shared container — landing is `5xl`, question steps `xl`, terminal `3xl`, and individual sections self-center / self-narrow with their own padding. The baseline width changes per screen.
2. **The confirmation page feels dead.** Static checkmark, static 1→2→3 list, squished CTAs, and a "Recent Tri Pros work" gallery that looks poor.
3. **Address step has two theme/UX defects:** the Google-autocomplete predictions dropdown renders in dark mode (it portals outside `.funnel-light`), and it shows a Street View tile that feels intrusive.

## Locked Decisions (from brainstorm)

| Decision | Choice |
|---|---|
| Confirmation personality | **Energetic & motion-rich** — staggered entrances, an animated 1→2→3 timeline, subtle motion. Green success check is mandatory. |
| Recent-work format | **Finished-kitchen peek carousel** — real DB projects, trade-filtered, finished (hero) photos. |
| Carousel tap behavior | **Link to full project story** at `/portfolio-projects/{accessor}`, opened in a **new tab** so the lead keeps their confirmation. |
| Width system | **One unified funnel rail = `max-w-5xl`** (desktop), conforming to the mobile viewport via `px-5`. Hero stays wide. |

## Design

### A. Global funnel rail

Establish a single content rail used by every funnel surface.

- **Rail definition:** `mx-auto w-full max-w-5xl px-5`. Exported as a shared className constant `FUNNEL_CONTENT_RAIL` in `src/shared/domains/funnels/constants/` so landing, engine (steps + terminal), and the sticky header all reference one value.
- **Sections fill the rail.** Every section becomes `w-full`. Content that should read narrower (a focused single-question control, body prose) constrains **internally** with an inner `max-w-*` / padding — never via its own outer centering. Example: the landing Q1 form stays visually focused via an inner `max-w-xl mx-auto` while its section spans the 5xl rail.
- **Sticky header** already accepts `widthClass` (mirrors the rail). With a unified rail, all callers pass `max-w-5xl` (or the shared constant).
- **Hero** keeps its wide, full-bleed treatment inside the 5xl rail (unchanged width).

**Why a constant, not a wrapper component:** the rail is applied to the always-present outer scroll column in two files (engine + landing); a className constant keeps the change minimal and avoids an extra wrapper in the motion/scroll-bound markup. Per-section `w-full` is plain Tailwind.

### B. Confirmation page — energetic & motion-rich

File: `src/shared/domains/funnels/ui/steps/confirmation-step.tsx`, plus two new sibling components.

1. **Green success moment.** Replace the neutral check tint with the semantic success token: `bg-success/10 text-success` on the badge, `CircleCheck` glyph. Mount animation: spring scale-in (`motion/react`) + one soft ring pulse. Gated on `useReducedMotion` → renders static.
2. **Animated 1→2→3 timeline** (new component `confirmation-timeline.tsx`, one component per file). A vertical timeline replacing the static `<ol>`:
   - A connecting line that animates its height in on mount.
   - Step rows that stagger in (~90ms apart), each with a number badge that pops.
   - Reduced-motion → all steps appear instantly, line static.
   - Props: `steps: string[]`. No business logic; pure presentation driven by `content.whatNext`.
3. **Un-squished CTAs.** Primary **Call** button: full-width, prominent height, phone icon — the single solid-primary moment. Secondary **"See our work"**: quieter (outline or link), visually subordinate. Stacked on mobile, side-by-side from `sm` with the primary dominant. Targets ≥44px.
4. **Recent-work peek carousel** (new component `funnel-project-carousel.tsx`). Funnel-local — built on `src/shared/components/ui/carousel` (Embla), mirroring `PhaseCarousel`'s peek (`basis-[85%] sm:basis-[70%] md:basis-[55%]`), arrows + animated dot indicators.
   - **Data:** `useTRPC()` → `projectsRouter.showroomDisplay.getAll` + `notionRouter.scopes.getAll`, trade-filtered via `TRADE_BY_SLUG[ctx.slug]` (same logic the confirmation already uses), using each project's `heroImage` (the finished look) through `getOptimizedSrc`.
   - **Count:** show the full trade-filtered set, capped at **8** slides. If fewer than **3** real projects resolve, pad with `PORTFOLIO_FALLBACK_IMAGES` up to 3 so the peek effect still reads. `null` while queries load → skeleton.
   - **Tap:** real projects link to `/portfolio-projects/{accessor}` via `<a target="_blank" rel="noopener noreferrer">`. Fallback tiles (no accessor) render as non-interactive figures.
   - **Boundary:** funnels live under `shared/domains`, which must not import from `features/`. The carousel is therefore built locally from shared primitives (allowed) rather than importing the project-management feature components.
5. **Section-level stagger.** Title → timeline → CTAs → carousel enter in sequence (subtle), via shared stagger variants. Reduced-motion-safe.

The old `heroTiles` uniform-grid fallback (added last commit) is superseded by the carousel and removed; `PORTFOLIO_FALLBACK_IMAGES` is reused by the carousel.

### C. Address step

1. **Dropdown light-theme fix.** The predictions dropdown (`src/shared/components/inputs/address-predictions-dropdown.tsx`) renders inside a Radix `Popover` that portals to `document.body`, outside `.funnel-light`, so it inherits the app's `html.dark` tokens.
   - Add an optional `contentClassName?: string` prop to `AddressPredictionsDropdown`, appended to `PopoverContent`'s className.
   - Thread a matching `dropdownClassName?: string` prop through `AddressAutocomplete`.
   - The funnel's `address-step.tsx` passes `funnel-light text-foreground`, which re-declares the light token vars on the portaled content (`--popover` → white, `--popover-foreground` → dark text). No `bg-white`; survives a future dark mode.
2. **Aerial only.** In `src/shared/domains/funnels/ui/steps/address-preview.tsx`, remove the `Street` tile. Render the single aerial as one clean framed image (4:3) with the existing address chip below. Keep the `No preview` fallback for the missing-key case.

### D. Cross-cutting motion

Add shared stagger/entrance variants (container + item) to `src/shared/domains/funnels/constants/funnel-motion.ts`. All new motion gated on `prefers-reduced-motion` via `useReducedMotion`.

## Component boundaries (new files)

| File | Purpose | Depends on |
|---|---|---|
| `ui/steps/confirmation-timeline.tsx` | Animated 1→2→3 timeline | `motion/react`, `useReducedMotion`, funnel-motion variants |
| `ui/blocks/funnel-project-carousel.tsx` | Finished-kitchen peek carousel | `shared/components/ui/carousel`, `useTRPC`, `TRADE_BY_SLUG`, `getOptimizedSrc`, `PORTFOLIO_FALLBACK_IMAGES` |

Each is a single presentational/data component, understandable and testable in isolation.

## Files touched

- `constants/` — new `FUNNEL_CONTENT_RAIL`; stagger variants in `funnel-motion.ts`.
- `ui/funnel-engine.tsx`, `ui/funnel-landing.tsx`, `ui/funnel-sticky-header.tsx` — adopt the unified 5xl rail.
- `ui/steps/confirmation-step.tsx` — revamp (success token, timeline, CTAs, carousel, stagger); remove `heroTiles`.
- `ui/steps/confirmation-timeline.tsx` *(new)*, `ui/blocks/funnel-project-carousel.tsx` *(new)*.
- `components/inputs/address-autocomplete.tsx`, `components/inputs/address-predictions-dropdown.tsx` — `contentClassName` / `dropdownClassName` props.
- `ui/steps/address-step.tsx` — pass `funnel-light text-foreground`.
- `ui/steps/address-preview.tsx` — aerial-only.

## Out of scope

- Scheduling/appointment step (still deferred).
- Before/after compare slider in the confirmation (chose finished-only).
- In-place lightbox (chose link-out).
- Any non-funnel surface that consumes `AddressAutocomplete` — the new prop is optional and default-off, so existing callers are unaffected.

## Risks / verify during implementation

- **Question steps at 5xl** must constrain their controls internally so forms don't read sparse — audit each step view when adopting the rail.
- **Funnel-light on the portal** — confirm the predictions dropdown actually re-resolves to light tokens once the class is applied (CSS vars inherit to descendants of the classed element).
- **`text-success` contrast** on `bg-success/10` — verify AA at the badge size.
- **`shared → features` boundary** — the carousel must not import project-management feature components; build from shared primitives only.
- Gate stays `pnpm tsc` + `pnpm lint` + manual browser smoke (no unit runner). Never `pnpm build`.
