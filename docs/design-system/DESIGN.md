# Design System — App-Wide Constitution

The single source of truth for design intent at Tri Pros Remodeling. Every component, every AI session, and every code review runs against this document.

**Cross-references:** [tokens.md](./tokens.md) · [anti-slop-checklist.md](./anti-slop-checklist.md)

---

## 1. Brand POV

**"Premium, trustworthy SoCal builder."** Warm, crafted, exact.

Tri Pros Remodeling is a Southern California residential remodeling company with a human-psychology-driven sales approach. The design language reflects that: it feels earned, not templated. Warm concrete textures, architectural precision, and real data replace the generic "tech startup fresh" look.

**Art direction: "Blueprint Authority"** — warm-concrete SoCal-modern base with an architectural blueprint decor motif (drafting arcs, protractor ticks, dimension lines) that signals craftsmanship and trust. No literal slop (no hard-hats, hammers, or crew-at-laptop imagery).

---

## 2. Per-Dimension Rules

### Typography

- **Display font:** Syne — used for all headings, eyebrows, and display copy.
- **Text font:** Nunito — used for body copy, labels, credentials, and UI text.
- **No monospace, ever.** This is a remodeling business, not software. Monospace as decoration is a slop fingerprint. There is no mono token in this system.
- **Use weight and size extremes.** The difference between `font-weight: 400` and `font-weight: 600` is mush. Use `800` or `900` for display text; `600` for credentials; `400` for body. Jump sizes aggressively: a headline at `clamp(2.5rem, 5vw, 4rem)` next to body at `1rem` has impact; splitting the difference does not.
- Avoid `font-weight: 500` as a "safe middle" — pick a side.

### Color

- **Mode-dependent neutrals + brand blue `#03AFED` as the only accent.** No purple, no indigo, no teal, no custom grays.
- The current app `--primary` was indigo `oklch(0.6231 0.188 259.8145)` — that is wrong and is being replaced by the real brand blue via the `marketing` theme. The `app` theme re-pointing is deferred but shares the same primitive.
- **Small text on light backgrounds** must use `--accent-ink: #0784b3` (darkened blue), never `#03AFED` directly, to meet WCAG AA contrast.
- **Dark mode:** `--accent-ink` flips to `#5cc6f2` (lightened) in `.theme-marketing.theme-dark`.
- No ubiquitous gradients or glows — if a gradient exists, it must have a deliberate atmospheric purpose (see Decor system, §5).
- No low-contrast dark body text on dark surfaces (common AI slop).

### Spacing

Scale: `2, 4, 8, 12, 16, 20, 24, 26, 30, 38` (px). Use these values. Do not invent intermediate values like `10px` or `14px` unless driven by a specific typographic need.

**`--cred-gap: 24px`** is the fixed gap between credential strip items — it must not be stretched to full width.

### Radius

Three deliberate values — never uniform `8px` on everything:
- `--radius-chip: 3px` — small chips, diamonds, tags
- `--radius-panel: 6px` (= `--radius: 0.375rem` in `.theme-marketing`) — cards, panels, the main panel radius
- `--radius-pill: 999px` — true pills only, used sparingly

Do not use `border-radius: 8px` as a default. It is the most recognizable slop fingerprint in shadcn-based UIs.

### Elevation

**Hairline borders before shadows.** `--border: #ddd4c4` reads as a card edge on the sand background without any shadow. Reach for shadows only when you need to signal elevation above that baseline.

When a shadow is warranted, use the warm-tinted card shadow: `--shadow-card: 0 44px 64px -42px rgb(60 40 15 / 0.5)`. This is a long, soft, warm drop — nothing like the flat `0.05` opacity defaults.

Do not use `box-shadow: 0 4px 10px 0 rgb(0 0 0 / 0.05)` as a card shadow. That value is invisible on light surfaces and is a slop default.

### Motion

**High-impact entrance + `useReducedMotion` gate.** Every meaningful entrance animation must be wrapped in a `useReducedMotion()` check — if reduced motion is preferred, render the final (non-animated) state immediately with no movement.

The decor draw-in animation (`--dur-draw: 1.4s`, staggered stroke-dashoffset) is the most distinctive motion in the system. It should animate on first render; after that, only the gentle sweep (`18s infinite alternate`) and breathe (`7s infinite`) continue.

Motion tokens:
- `--ease-brand: cubic-bezier(0.32, 0.72, 0, 1)` — the single approved easing curve
- `--dur-fast: 0.18s` — micro-interactions
- `--dur-base: 0.4s` — standard transitions
- `--dur-draw: 1.4s` — decor draw-in

Never reach for `transition: all` or `ease-in-out` as defaults. Use `--ease-brand` and explicit properties.

### Atmosphere / Decor

The architectural blueprint decor motif is a **first-class, reusable layer** — not a one-off background trick.

**Rule: decor must be present on all hero surfaces.** A marketing section without the decor motif is incomplete.

**Rule: decor is always anchored top-right.** It must never collide with left-aligned text. The parent element must have `overflow: hidden; isolation: isolate` and content must sit on `z-index: 1`.

The `<Decor>` component is parametric:
- `shape`: `arc` (default) · `square` · `triangle` — same visual DNA, varied per block
- `rings`: count of concentric rings (card uses 8, tight spacing)
- `strokeFalloff`: opacity ramp from corner outward (≈0.82 → 0.10)
- `gradientAlpha`: the radial band under the strokes (≈0.34 at origin → 0), the "atmosphere"

Token references: `--decor-stroke: #03afed`, `--decor-gradient-alpha: 0.34`.

### Layout

**One layout primitive, repeated.** Slop is seven different card/icon/stat treatments. Signature is one strong move applied consistently.

**Card content is left-aligned.** Never center-align a card's heading + paragraph + checklist stack — that is the clearest slop fingerprint. Left alignment creates the reading rhythm that signals craft.

The layout grid is standard Tailwind — no custom primitives. Sections use `container` (max-w-7xl, px-4/6/8). Cards do not need a bespoke grid.

### Copy

**Specific beats generic.** "We've completed 520 projects across 8 cities" is specific. "We're the best choice for your home" is generic. Specific copy is always preferred.

**Credential guardrail:** Tri Pros was founded in 2021. The team has a combined 40+ years of experience. The correct phrasing is always **"40+ years combined experience"** — never "40 years in business," never "decades of experience since [year]," never any phrasing that implies the company existed before 2021.

All credential data must come from `src/shared/constants/company/` — licenses, insurance, BBB rating, project counts, dollar volume, satisfaction rate. Never hardcode numbers in a component.

---

## 3. Negative Constraints — The Banned Slop Fingerprint

These are explicitly prohibited. They are the statistical average of AI-generated design and produce components that read as generic.

**Fonts:**
- No Inter, Roboto, or system-ui as the primary font
- No Space Grotesk / Geist combos
- No monospace as decoration (code-editor aesthetic on a remodeling site)
- No serif-italic accent words

**Color:**
- No purple or indigo accents
- No ubiquitous gradients (e.g., `from-blue-500 to-purple-600` backgrounds)
- No colored glows (`box-shadow: 0 0 40px rgba(99, 102, 241, 0.3)`)
- No low-contrast dark body text on dark surfaces (e.g., `text-gray-700` on `bg-gray-900`)

**Layout:**
- No centered hero with icon-in-circle above heading above paragraph above pill checklist
- No badge-above-H1 pattern as the default eyebrow treatment
- No colored left-border cards (`border-l-4 border-blue-500`)
- No 1-2-3 step rows as the primary trust signal
- No stat banners with four centered metrics
- No icon-on-top / text-below card grids as the only card pattern
- No all-caps body copy

**Detail:**
- No uniform `border-radius: 8px` on all elements
- No flat `box-shadow: 0 4px 10px rgb(0 0 0 / 0.05)` as a card shadow (invisible, meaningless)
- No pill checklists (`✓ item 1  ✓ item 2  ✓ item 3` in a flex row)

---

## 4. Theme Contract

### Two themes, one primitive system

**`marketing` (`.theme-marketing` class)** — the warm-concrete light showcase. Applied to the funnel, landing pages, and marketing blocks. This is the primary design expression of the brand.

**`app` (default `:root`)** — the current dashboard look. Currently indigo-accented with slate neutrals. The `app` theme re-pointing to the brand blue is a deferred phase (spec §12). Do not re-theme the dashboard in a marketing-focused PR.

### What both themes must share (non-negotiable primitives)

1. **Brand blue accent** — `#03AFED` in hex; the semantic `--accent` and `--primary` must both point to it.
2. **No monospace** — there is no `--font-mono` token in the design system. Do not add one for display purposes.
3. **Anti-slop checklist** — every new component runs the checklist regardless of which theme it belongs to.
4. **`<Decor>` is available to both** — the decor motif is a shared component in `src/shared/components/decor/`.

### Theme application mechanism

`.theme-marketing` is a CSS class applied to a wrapper element (not `data-theme`, not `html`). This prevents the app-wide `.dark` class on `html` from auto-activating a dark marketing theme when the dashboard is in dark mode.

Dark mode for marketing content is opt-in via `.theme-marketing.theme-dark`. Full dark hardening of the marketing theme is deferred (spec §12).

The `.funnel-light` class is a precursor / shadow of `.theme-marketing` — they coexist for now; `.theme-marketing` is the canonical system.

---

## 5. Communication Protocol

How to iterate on design together (used throughout the design session that produced this system; codified here so future sessions work the same way):

1. **Annotated mockups** — use numbered region markers (e.g., `[1]`, `[2]`) on screenshots or ASCII layouts; reference by number in feedback.
2. **Intent in, tokens out** — the user speaks intent ("less shouty," "more contrast here"); Claude translates to the specific token change and names which token moved (e.g., "`--body-text` → `#3d3830`").
3. **Every change states its why** (principle or psychology). No silent changes. Example: "Moving from `#5f574b` to `#3d3830` increases contrast ratio from 4.1:1 to 5.8:1, passing WCAG AA for 14px Nunito."
4. **One concern at a time**, shown in full context. Do not bundle a typography fix with a layout refactor in one reply.
5. **Severity tags** on feedback:
   - `blocker` — fails WCAG AA, violates a banned pattern, data is hardcoded
   - `polish` — on-brand but could be better; address in the same PR if fast
   - `taste` — subjective; either option is valid; call it out as such

---

## 6. See Also

- [tokens.md](./tokens.md) — three-tier token architecture, every `.theme-marketing` value, consumption patterns
- [anti-slop-checklist.md](./anti-slop-checklist.md) — the 10-point gate to run before any block ships
- [Spec: Anti-Slop Design Token System](../superpowers/specs/2026-06-22-anti-slop-design-system-design.md) — the original design session record
- `src/app/(frontend)/globals.css` — the live token definitions (`.theme-marketing` block)
- `src/shared/constants/company/` — credential data source (never hardcode these values)
- `src/shared/components/decor/` — the `<Decor>` component (shared, app-wide)
