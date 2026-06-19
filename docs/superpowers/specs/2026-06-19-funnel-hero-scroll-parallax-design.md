# Funnel Hero Scroll Choreography + Persistent Header — Design

**Date:** 2026-06-19
**Scope:** Funnel engine (all funnels), shared blocks. Public, scoped-light, mobile-first, motion/react.

## Goal

As the user scrolls down from the top of a funnel landing, the hero's text
parallaxes up and fades away while the logo cross-fades into a slim sticky
header that persists for the rest of the funnel (including the Q2+ step pages).
Refined and subtle — premium "felt, not noticed" motion that never delays or
obstructs Question 1.

## Research basis (why these specifics)

- **motion/react (confirmed via Context7 / motion.dev):** `useScroll({ target, offset })`
  produces a `scrollYProgress` MotionValue; `useTransform` maps it to style values;
  `useReducedMotion()` gates motion-sickness-inducing transforms while keeping opacity.
- **CRO/UX (NN/g, Baymard, Comeau, Emil Kowalski):** this hero sits directly above
  Q1 of a conversion funnel on mobile. Motion is acceptable and trust-positive ONLY if
  it is **passive** (no scroll-jacking), **short** (resolves within ~1 viewport so Q1
  stays instantly reachable), **GPU-cheap** (transform + opacity only), and **accessible**
  (real `prefers-reduced-motion` fallback). A documented parallax-hero redesign halved
  form conversions — the floor is "subtle, passive, fast."

## Decisions (user-approved)

1. **Logo persistence:** cross-fade into a slim (~48px) sticky top bar that persists
   through the whole funnel (landing → Q2 → Q3 …).
2. **Intensity:** refined & subtle (no layered photo zoom / cinematic staggering).
3. **Header content:** small logo (left) + persistent tap-to-call (right), using the
   company phone constant.

## Architecture

The sticky bar must be `position: fixed` relative to the **viewport**. A transformed
ancestor creates a containing block that would trap a fixed child — and both
`FunnelLanding`'s wrapper and the step-swap wrapper are `motion.div`s with transforms.
So the header mounts **above** those wrappers, at the `FunnelEngine` root, as a single
DOM node shared across both branches (landing and steps) — it never re-mounts, so the
landing→step transition is seamless.

```
FunnelEngine  (owns heroRef + ONE useScroll on the hero section)
└ <div data-funnel min-h-dvh>
   ├ <FunnelStickyHeader opacity={isFirst ? headerOpacity : 1} />   ← persists across branches
   └ isFirst
       ? <FunnelLanding heroRef={heroRef} scroll={heroScroll}> {stepEl} </FunnelLanding>
       : <step column> (FunnelProgress + AnimatePresence step + Back/Next), padded to clear header
```

- `useScroll({ target: heroRef, offset: ["start start", "end start"] })` → `scrollYProgress`
  runs 0→1 over exactly the hero's own height. On step pages `heroRef.current` is null;
  motion's `useScroll` tolerates a null target (progress stays 0) and the header opacity
  is overridden to `1` there, so tracking value is irrelevant on steps.
- The engine derives all MotionValues once and passes the hero-facing set down as a
  single `scroll` prop object; the header consumes `headerOpacity`. This keeps
  prop signatures small and each component single-responsibility.

### MotionValue ranges (engine-derived, reduced-motion aware)

`p = scrollYProgress`, `reduce = useReducedMotion()`:

| MotionValue   | useTransform(input → output) | Notes |
|---------------|------------------------------|-------|
| `textOpacity` | `[0, 0.5] → [1, 0]`          | fully gone by halfway (premium "fade faster than scroll") |
| `textY`       | `[0, 1] → [0, reduce ? 0 : -120]` | gentle lift; **gated** by reduced motion |
| `logoOpacity` | `[0.05, 0.45] → [1, 0]`      | big in-flow logo fades out |
| `logoScale`   | `[0, 0.45] → [1, reduce ? 1 : 0.85]` | slight shrink; **gated** by reduced motion |
| `headerOpacity` | `[0.4, 0.75] → [0, 1]`     | slim bar cross-fades in (opacity kept even when reduced) |

**Reduced-motion rule:** gate only `y` and `scale` to their no-op values. The opacity
cross-fades stay (opacity is vestibular-safe and aids comprehension). Result: passive,
scroll-linked opacity choreography with zero translate/scale movement.

## Components / Files

### 1. New — `src/shared/domains/funnels/ui/funnel-sticky-header.tsx`
Presentational fixed slim bar. Single responsibility: render the bar; opacity comes in
as a prop.
- Container: `motion.div` `fixed inset-x-0 top-0 z-50 h-12 bg-card border-border border-b shadow-sm`,
  inner `mx-auto flex max-w-xl items-center justify-between px-5`. `style={{ opacity }}`.
  `pointer-events` follows opacity is not needed (tel link is fine to keep tappable; bar
  is visually hidden at opacity 0 but to avoid an invisible tap target, set
  `pointerEvents` via a `useTransform(opacity, v => v < 0.1 ? 'none' : 'auto')` when
  `opacity` is a MotionValue, else `'auto'`).
- Left: logo `Image` `h-7 w-auto`, same `logo-light-right.svg` dark-ink asset the hero uses
  (scoped-light funnel — do not use the `dark:`-switching shared Logo component).
- Right: `<a href={telHref}>` tap-to-call — phone icon (`lucide-react` `Phone`) + "Call",
  `text-sm font-medium`, min 44px tap target. `telHref = \`tel:+1${toDigits(PHONE)}\``
  built from the company phone via `@/shared/lib/phone` `toDigits`; display label uses the
  raw `contactInfo` phone value or just "Call".
- Prop: `opacity: MotionValue<number> | number`.

### 2. Modify — `src/shared/domains/funnels/constants/funnel-motion.ts`
Add (no magic numbers in components, per conventions):
- `HERO_SCROLL_OFFSET = ['start start', 'end start'] as const`
- exported range tuples used above (e.g. `HERO_TEXT_OPACITY_RANGE`, `HERO_TEXT_Y`,
  `HERO_LOGO_OPACITY_RANGE`, `HERO_LOGO_SCALE`, `HERO_HEADER_OPACITY_RANGE`) and the
  `-120` / `0.85` magnitudes as named constants.

### 3. Modify — `src/shared/domains/funnels/ui/funnel-hero.tsx`
- Accept `ref` (forwarded to the `<section>`) and `scroll?: HeroScroll | null`
  (`{ textOpacity, textY, logoOpacity, logoScale }` of MotionValues).
- Wrap the big logo `Image` in `motion.div style={{ opacity: logoOpacity, scale: logoScale }}`.
- Wrap the text group (h1 + subhead + scarcity + CTA + prompt) in
  `motion.div style={{ opacity: textOpacity, y: textY }}`.
- When `scroll` is null (defensive / non-landing), render static (no motion styles).
- Photo + scrims stay static (refined, not cinematic).

### 4. Modify — `src/shared/domains/funnels/ui/funnel-engine.tsx`
- Create `heroRef`; `const { scrollYProgress } = useScroll({ target: heroRef, offset: HERO_SCROLL_OFFSET })`.
- Derive the 5 MotionValues (table above) with `useTransform`, reduced-motion aware.
- Unify the two returns under one `<div data-funnel min-h-dvh>` that always renders
  `<FunnelStickyHeader opacity={engine.isFirst ? headerOpacity : 1} />` first, then the
  branch content.
- Landing branch: pass `heroRef` + `scroll={heroScroll}` into `FunnelLanding`.
- Step branch: add top padding (`pt-16` ≈ header height + breathing room) so
  `FunnelProgress` clears the fixed header.

### 5. Modify — `src/shared/domains/funnels/ui/funnel-landing.tsx`
- Accept `heroRef` + `scroll`; forward to `<FunnelHero ref={heroRef} scroll={scroll} … />`.
- No other layout change (its own `motion.div` wrapper is now below the header, fine).

## Constraints (carried from project)

- Work on `main` (unpushed); pathspec-only commits (`-m` before `--`, explicit paths);
  trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- `pnpm tsc` + `pnpm lint` to verify; NEVER `pnpm build`.
- shared/ never imports features/. Semantic tokens only. Primary color reserved for
  CTA/Next/highlights — the tap-to-call uses foreground/muted, not primary fill.
- Company data (phone) from `src/shared/constants/company/`; tel built via `@/shared/lib/phone`.
- One component per file; named exports; no file-level constants/helpers in component files.

## Testing / verification

Scroll choreography is visual; verification is manual + Playwright (now reconnected):
- `pnpm tsc` clean, `pnpm lint` 0 errors.
- `kitchens.localhost:3000`: scroll down → text fades/lifts, big logo cross-fades into the
  slim bar; bar persists into Q2+. CTA still smooth-scrolls to Q1. Bar tap-to-call dials.
- Emulate `prefers-reduced-motion: reduce`: no translate/scale; opacity fades remain; Q1
  immediately reachable.
- No layout shift at scroll 0 (bar is opacity-0 fixed overlay, takes no flow space).
- Verify no transformed ancestor traps the fixed header (fallback: hoist header mount).
```
