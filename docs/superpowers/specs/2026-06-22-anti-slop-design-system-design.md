# Anti-Slop Design Token System — Design Spec

- **Date:** 2026-06-22
- **Status:** Draft for review
- **Author:** Oliver P + Claude
- **Topic:** App-wide, multi-theme design-token system + anti-slop methodology, proven on the funnel "monthly payment" callout.

---

## 1. Goal

Build a **standardized, app-wide design-token system and an anti-slop design methodology** — the architecture, naming, brand primitives, a `DESIGN.md` constitution, and a review checklist — so that every component we (or an AI session) build is intentional and on-brand instead of generic "AI slop."

The system is the deliverable. The funnel **callout block** (and, second, the **FAQ accordion**) are the *proof surfaces* that demonstrate the system end-to-end on a `/test` route.

**Non-goal:** This is not a funnel-only effort. The funnel is one use case. The token architecture, DESIGN.md, and checklist are app-wide standards.

---

## 2. Research summary — why "AI slop" happens and how to beat it

Convergent finding across Anthropic's own frontend-aesthetics cookbook, the frontend-design Skills, and community teardowns: AI design defaults to the **statistical average** of its training data. The cure is **a specific point of view + explicit negative constraints**.

Three load-bearing techniques:
1. **Guide each dimension separately** — typography, color, motion, backgrounds/atmosphere.
2. **Negative constraints** — telling the model what *not* to do removes the defaults it would auto-fill. (Most underused, highest leverage.)
3. **One layout primitive, repeated** — slop is seven different card/icon/stat treatments; signature is one strong move repeated.

Typography is the single highest-leverage decision ("one distinctive font is worth ten layout tweaks"); use weight/size **extremes**, not 400-vs-600 mush.

### The "slop fingerprint" (banned)
Fonts: Inter/Roboto/system everywhere · repetitive Space-Grotesk/Geist combos · **monospace as decoration** · serif-italic accent words.
Color: VibeCode lavender-purple · ubiquitous gradients · colored glows · low-contrast dark body text.
Layout: centered hero · badge-above-H1 · colored left-border cards · **icon-on-top/text-below card grids** · 1-2-3 step rows · stat banners · all-caps body · pill checklists · 8px-radius-on-everything · flat 0.05-opacity shadows.

### Diagnosis of the old callout (baseline)
The original `callout-block.tsx` hit the fingerprint hard: centered circle-icon → centered heading → muted centered paragraph → centered pill checklist, on default shadcn blue/slate/0.5rem tokens. Zero point of view.

Sources: Anthropic "Prompting for frontend aesthetics" cookbook; Anthropic "Improving frontend design through Skills"; developersdigest "16 AI design slop patterns"; freedesignmd / 925studios shadcn-generic teardowns.

---

## 3. Locked decisions

- **Art direction:** "**Blueprint Authority**" (Lean A) — warm-concrete SoCal-modern base + an **architectural blueprint decor motif** (drafting arcs, protractor ticks, dimension line) that signals craftsmanship & trust without literal slop (no hard-hats / hammers / crew-at-laptop).
- **Color = brand primitive, app-wide:** mode-dependent neutrals + **brand blue `#03AFED`** (from the logo "R") as the *only* accent, with a darkened `#0784b3` for small text on light backgrounds. ⚠️ The current funnel `--primary` is indigo `oklch(0.6231 0.188 259.8145)` — **wrong**; this system replaces it with the real brand blue.
- **Type = brand primitive, app-wide:** **Syne** (display) + **Nunito** (text). **No monospace, ever** — this is a remodeling business, not software.
- **Identity scope:** app-wide token *system*; **multi-theme** — `marketing` (warm-concrete showcase) and `app` (current dashboard look, evolves later). Both governed by the same primitives + DESIGN.md + checklist.
- **Atmosphere is a first-class, reusable layer** — the decor motif is a parametric system, always anchored top-right (never crowds text), animated with motion/react.
- **Trust via real data** — credentials sourced from `src/shared/constants/company/`, never hardcoded.

---

## 4. Token architecture (three tiers)

CSS custom properties, organized primitive → semantic → component. Light + dark per theme.

### 4.1 Primitive tokens (raw, theme-agnostic)
- **Brand blue ramp:** `--blue-500: #03AFED` (canonical accent), `--blue-700: #0784b3` (small-text-on-light), plus tints/shades for states. (Convert to OKLCH in implementation to match repo convention.)
- **Warm-neutral ramp** (marketing): `sand #e9e2d6`, `panel #f4efe6`, `raised #efe7d7`, `hairline #ddd4c4`, `ink #2a2520`, `body #5f574b`, `muted #8a7c6a`, `cred-ink #4a443c`.
- **Cool-neutral ramp** (app): the existing slate ramp from `globals.css` (kept).
- **Fonts:** `--font-display: 'Syne'`, `--font-text: 'Nunito'`. (No mono token exists.)
- **Spacing scale:** `2,4,8,12,16,20,24,26,30,38` → `--space-*`.
- **Radius scale:** `--radius-chip: 3px`, `--radius-panel: 6px`, `--radius-pill: 999px` (deliberately *not* uniform 8px).
- **Elevation scale:** warm-tinted; `--shadow-card: 0 44px 64px -42px rgba(60,40,15,.5)`; hairline borders preferred over heavy shadows.
- **Motion:** `--ease-brand: cubic-bezier(.32,.72,0,1)` (matches existing `funnel-motion`), `--dur-fast:.18s`, `--dur-base:.4s`, `--dur-draw:1.4s`.

### 4.2 Semantic tokens (per theme; light + dark)
Theme applied via a wrapper class / `data-theme` attribute. Semantic names consumed by components:
`--surface`, `--surface-raised`, `--ink`, `--ink-muted`, `--hairline`, `--accent`, `--accent-ink` (small text), `--on-accent`, `--on-ink`.

- **`marketing` (light):** surface=sand, surface-raised=panel, ink, ink-muted=body, hairline, accent=blue-500, accent-ink=blue-700, on-accent=white, on-ink=panel.
- **`app`:** maps to the existing slate/indigo→blue tokens (re-pointed to the brand blue accent over time; full re-theme deferred).
- **Dark variants** defined for both.

### 4.3 Component tokens
e.g. `--card-pad`, `--card-radius` (=panel), `--card-shadow`, `--cred-gap: 24px`, `--cred-mark` (blue diamond), plus the decor params (§6).

---

## 5. `DESIGN.md` — the app-wide constitution (to be authored)

Contents:
1. **Brand POV** — "premium, trustworthy SoCal builder." Warm, crafted, exact.
2. **Per-dimension rules** — typography (Syne/Nunito, weight/size extremes), color (neutrals + lone blue accent), spacing rhythm, radius, elevation (hairline-first), motion (high-impact entrance + reduced-motion law), **atmosphere/decor** (always present on hero surfaces), layout (one primitive repeated, left-aligned card content), copy (specific > generic; never false trust claims, e.g. "40+ yrs *combined* experience," not "40 years in business").
3. **Negative constraints** — the banned slop fingerprint (§2), explicitly: no Inter/Roboto/system fonts, **no monospace**, no purple/indigo, no ubiquitous gradients/glows, no centered icon-in-circle stacks, no pill checklists, no colored left-border cards, no uniform-8px radius, no flat 0.05 shadows, no all-caps body.
4. **Theme contract** — how `marketing` vs `app` differ and what they must share (primitives, accent, no-mono, checklist).
5. **Cross-references** — decor system (§6), trust layer (§7), checklist (§8).

---

## 6. Decor-motif system (the signature)

A parametric decorative layer — out of flow, clipped by the card edge, behind content — that becomes the brand's recognizable atmosphere.

- **API (concept):** `<Decor shape anchor rings strokeFalloff gradientAlpha motion />`.
  - `shape`: `arc` (default) · `square` · `triangle` — same DNA, varied per block.
  - `anchor`: **fixed top-right** (so it never collides with left-aligned text).
  - `rings`: count (card uses 8, tight spacing).
  - `strokeFalloff`: opacity ramp from corner outward (≈.82 → .10).
  - `gradientAlpha`: radial band under the strokes (≈.34 at origin → 0), the "atmosphere."
  - `motion`: staggered **draw-in** (stroke-dashoffset, ~60ms stagger) → subtle **sweep** (±3°, 18s) + **breathe** (glow, 7s). All `motion/react`, gated by `useReducedMotion` (final state, no movement, for reduced-motion users).
- **Rules:** brand-blue strokes only; tokenized falloff so it always lands "subtle but noticeable"; parent needs `overflow:hidden; isolation:isolate`; content on `z-index:1`.

---

## 7. Trust layer

- **Credential strip pattern:** left-aligned, single-line items, fixed `--cred-gap` separation (not full-width stretch), each led by a brand-blue **diamond** (geometric DNA), Nunito **600** (never 800), one size — so nothing orphan-wraps. 3 items fill the line cleanly; center-wrap on mobile.
- **Data source:** `src/shared/constants/company/` — `licenses` (#1076760), `insurances` (bonded $5M), BBB A+, `companyInfo` (520 projects, $9M built, 98% satisfaction, 40+ yrs combined). **Never hardcode.**
- **Copy guardrail:** founded 2021 → use "40+ years *combined* experience," never imply 40 years in business.

---

## 8. Anti-slop checklist (review gate)

Run before any block ships. Adapted 16-point + our additions:
- [ ] Fonts = Syne/Nunito only; **no monospace**; weight/size extremes used.
- [ ] Accent = brand blue `#03AFED` only; no purple/indigo; no ubiquitous gradients/glows.
- [ ] No centered icon-in-circle stack; no pill checklist; no colored left-border card; no 1-2-3 stat banner.
- [ ] Radius from the scale (not uniform 8px); shadows warm/intentional (not flat 0.05).
- [ ] One layout primitive, repeated; card content alignment consistent (left).
- [ ] Atmosphere/decor present on hero surfaces (top-right, tokenized, animated).
- [ ] Motion: high-impact entrance + `useReducedMotion` gate.
- [ ] Trust/data from constants, not hardcoded; no false claims.
- [ ] Contrast ≥ WCAG AA (esp. small text / dark mode).
- [ ] Mobile checked.
- Score: 0–1 triggered = clean; 2–3 = mild; 4+ = reject.

---

## 9. Proof component + `/test` route

- Rebuild `callout-block.tsx` to consume semantic tokens + `<Decor>` + the credential pattern, under the `marketing` theme. Faithful to the locked card (eyebrow → headline → body → credential strip → CTA; blueprint arc decor top-right).
- `/test` route under `src/app/(frontend)/(site)/tests/` rendering the redesigned callout (and later the FAQ accordion) in the `marketing` theme — a living proof page.
- Second validation: apply the same tokens/decor/checklist to the **FAQ accordion**.

---

## 10. File placement (proposal)

- **Tokens:** restructure `src/app/(frontend)/globals.css` into the three tiers (primitive `:root`, theme classes, component); the existing `.funnel-light` overrides are folded in / replaced. Optionally split primitives into an imported `tokens.css`.
- **Docs (app-wide):** `docs/design-system/DESIGN.md`, `docs/design-system/tokens.md`, `docs/design-system/anti-slop-checklist.md`; add pointers from `docs/codebase-conventions/README.md` and `CLAUDE.md` "Where to find things."
- **Decor component:** `<Decor>` in shared UI (`src/shared/components/decor/` or funnel-local first), documented as app-wide pattern.
- **Proof:** `src/app/(frontend)/(site)/tests/callout/page.tsx`.

---

## 11. Design-fix communication protocol (methodology)

How we iterate on design together (used this whole session; codify in DESIGN.md):
1. **Annotated mockups** — numbered region markers; feedback by number.
2. **Intent in, tokens out** — user speaks intent ("less shouty"); Claude translates to the specific token change and names which token moved.
3. **Every change states its "why"** (principle/psychology). No silent changes.
4. **One concern at a time**, shown in full context.
5. **Severity tags** — blocker / polish / taste.

---

## 12. Phasing / out of scope (for the implementation plan)

- **In scope now:** token architecture + primitives + `marketing` theme + DESIGN.md + checklist + `<Decor>` + redesigned callout + `/test` route + FAQ accordion as 2nd proof.
- **Deferred:** full `app`/dashboard re-theme to the new system (separate phase, same architecture); OKLCH conversion of all primitives; mobile-fidelity hardening pass.

---

## 13. Open questions

- Exact OKLCH values for the warm-neutral ramp + brand blue (compute during implementation).
- Theme switch mechanism: wrapper class vs `data-theme` attribute (decide in plan).
- `<Decor>` home: shared component vs funnel-local for v1.
