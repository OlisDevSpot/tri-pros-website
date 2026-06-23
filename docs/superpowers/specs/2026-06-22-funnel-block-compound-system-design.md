# Funnel Marketing `<Block>` Compound System — Design Spec

**Date:** 2026-06-22
**Status:** Approved (architecture) — pending spec review
**Owner:** Oliver P
**Related:** `docs/superpowers/specs/2026-06-22-anti-slop-design-system-design.md` (tokens, `<Decor>`, `<CredentialStrip>`, Blueprint Authority art direction this builds on)

---

## Goal

Give every funnel marketing block one shared, composable foundation — a compound `<Block>` component that owns width, vertical rhythm, surface, and atmosphere/decor anchoring, while letting the consumer dictate presentation (alignment, optional full-bleed media column, arbitrary content). This turns the design tokens we built into a system that is actually *enforced*, and kills the per-block freelancing that made the page read as inconsistent AI-slop.

## Problem (why this exists)

We tokenized the *atoms* (color, type, shadow, `<Decor>`, `<CredentialStrip>`) but never standardized the *molecule* — the block itself. Each of the 11 marketing blocks freelances its own width, alignment, surface, and decor placement:

- **Width mismatch** — callout fills the rail; FAQ constrains to `max-w-140` centered. Left/right edges don't line up down the page.
- **Alignment jumps** — callout left-aligned, most others centered.
- **Decor floats in dead space** — callout's arc sits in an empty right half; FAQ's squares bleed past the right edge and clip awkwardly (the canonical AI-slop "floating shapes" tell).
- **Surfaces diverge** — bare `bg-background`, `bg-card` panel, `bg-muted` panel, and double-nested surfaces all coexist with no rule.
- **Rhythm is hand-set** — every block invents its own `mt-*`/`gap-*`; the FAQ heading sits right on top of its list.

## Architecture

**Composition-first, RSC-safe** — the shadcn/ui + Radix Themes `Section` playbook, NOT the context-heavy interactive-compound playbook our entity cards use.

Rationale (from research):
- Marketing blocks are **presentational layout**, not interactive stateful widgets. Their variation is `surface`/`align`/`media` (config → variant props) plus block-specific bodies (structure → children). Context is unnecessary.
- **`Object.assign` dot-notation crashes when a Server Component dots into a *client* Root** (`next.js#51593`). Our entity cards dodge this only because everything there is `'use client'`. Marketing blocks are an RSC/client mix and we want to reuse them in RSC pages (e.g. `/test`). So: **keep the Root and all slots RSC-safe and presentational**; isolate client behavior (decor animation, accordion state, tRPC) into client leaf components imported flat.
- Dot-notation (`Block.Media`) is then **safe** because the Root is server-safe — and flat named exports remain the tree-shakeable source of truth.

Sources: shadcn Card, Radix Themes `Section`, `next.js#51593`, Kyle Shevlin "boolean props are a code smell", patterns.dev compound pattern. (Full citations in the brainstorming research, this session.)

### Variants (cva — enums, no boolean soup)

The Root is a `<section>` whose classes come from a `cva` variant map. Four enum variants:

| Variant | Values | Effect |
|---|---|---|
| `media` | `'none'` \| `'left'` \| `'right'` | 1-col, or 2-col grid with the media column ordered first/last |
| `surface` | `'plain'` \| `'card'` \| `'muted'` | `bg-background` (bare) / `bg-card` + `--shadow-card` panel / `bg-muted` panel |
| `align` | `'left'` \| `'center'` \| `'right'` | text + item alignment of the content column |
| `size` | `'default'` \| `'compact'` | vertical padding (compact = the `cta` block's tighter rhythm) |

Defaults: `media='none'`, `surface='plain'`, `align='left'`, `size='default'`.

**Always-on (base class):** `relative w-full isolate overflow-hidden`, padding/gap/radius from tokens. `isolate overflow-hidden` is unconditional so `<Decor>` always clips to the block (fixes the FAQ bleed permanently).

**Data attributes** for declarative styling hooks: `data-slot="block"`, `data-align`, `data-media`, `data-surface`.

**Polymorphism:** `asChild` (Radix `Slot`) on the Root swaps `<section>` for any semantic element; on `Block.Media` it merges block styling onto the consumer's `<Image>`/`<picture>` so the DOM stays clean.

### Slots

Each slot is its own tiny RSC-safe component (flat named export), all re-attached as dot-notation on the Root via `Object.assign` (safe ∵ Root is server-safe). Slots render `null` when their content is absent (the entity-card convention — no `showX` booleans).

| Slot | Role |
|---|---|
| `Block.Content` | the non-media column wrapper — `flex-col`, gap = `--block-gap`, alignment from the Root's `align` (via data-attr). Holds everything below. When `media='none'` it spans full width. |
| `Block.Eyebrow` | small uppercase tracked accent line, color `--accent-ink`. Flat, separate from headline. |
| `Block.Headline` | the `h2`, display scale + tracking. Flat, separate from eyebrow. |
| `Block.Body` | prose paragraph(s), color `--body-text`, readable max-width. |
| `Block.Media` | the full-bleed media column (see below). `asChild` to merge onto an `<Image>`; `overlay` prop slots `<Decor>` (or any node) on top. |
| `Block.Trust` | drop-in for `<CredentialStrip>` or other trust content. |
| `Block.Actions` | the CTA area (standard `<Button>`), gap + top rhythm. |

Block-specific bodies — accordion, bento grid, step list, before/after grid, review cards — are passed as **freeform children** of `Block.Content`. `<Decor>` for non-media blocks is a direct child of the Root (clips via the unconditional `isolate overflow-hidden`).

### The canonical media composition

```
┌─ <Block media="right" surface="card"> ───────────────────────┐
│  ┌ Block.Content ────────────┐ ┌ Block.Media (bleeds to edge)┐│
│  │ Eyebrow                   │ │▓▓▓▓ <Image fill> ▓▓▓▓▓▓▓▓▓▓▓││
│  │ Headline                  │ │▓▓▓▓  + <Decor> overlay  ▓▓▓▓││
│  │ Body                      │ │▓▓▓▓ (absolute inset-0,  ▓▓▓▓││
│  │ Trust  (CredentialStrip)  │ │▓▓▓▓  pointer-events-none)▓▓▓││
│  │ Actions (CTA →)           │ │▓▓▓ no padding, full side ▓▓▓││
│  └───────────────────────────┘ └────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

`Block.Media` cancels the Block's padding with negative margins (top/bottom/outer-edge) so the image covers the entire side edge-to-edge with no gutter. `<Decor>` rides on top as `absolute inset-0 pointer-events-none`. Min height from `--block-media-min-h`. **Mobile:** the grid collapses to one column and the media renders as a top banner (`aspect-video`), so the photo still shows. This is the standard recipe every media block adopts.

## File structure

```
src/shared/domains/funnels/ui/block/
  block-variants.ts     # cva: blockVariants, contentVariants, mediaVariants + exported VariantProps types
  block-root.tsx        # BlockRoot — RSC-safe <section>/Slot, cva, data-*, asChild
  block-content.tsx     # BlockContent
  block-eyebrow.tsx     # BlockEyebrow
  block-headline.tsx    # BlockHeadline
  block-body.tsx        # BlockBody
  block-media.tsx       # BlockMedia — full-bleed column, overlay prop, asChild
  block-trust.tsx       # BlockTrust
  block-actions.tsx     # BlockActions
  block.tsx             # assembly: import all → export const Block = Object.assign(BlockRoot, {...}); also re-export every flat name
```

- One React component per file (the slots are NOT crammed into one file — this differs from the entity overview-card precedent, on purpose, to stay RSC-safe + tree-shakeable per the research).
- `block.tsx` is the single import surface: `import { Block } from '@/shared/domains/funnels/ui/block/block'`. It is an assembly module (does `Object.assign` + flat re-exports), not a pure barrel.
- Prop interfaces live in each component file. Variant types live in `block-variants.ts` and are imported where needed.

## Per-block migration map

Each block is recomposed onto `<Block>`, deleting its bespoke layout. Target variant + slot usage:

| Block | `media` | `surface` | `align` | `size` | Slots used | Notes |
|---|---|---|---|---|---|---|
| **callout** | `right` | `card` | `left` | default | Eyebrow, Headline, Body, Trust(`CredentialStrip`), Actions, Media(`Image`+`Decor` arc) | The proof case. Also render `points[]` (currently typed-but-dropped) as a checklist in Content. |
| **value** | `none` | `card` | `center` | default | Headline, Body(intro); ROI stat + before/after grid + comparison list as freeform children | Keeps its 3 sub-zones; gains shell rhythm/surface. |
| **problem** | `none` | `plain` | `center` | default | Headline, Body; gallery OR text-card grid as freeform children | Preserves its two runtime modes. |
| **guarantee** | `none` | `card` | `center` | default | Headline, Body; icon badge + scarcity pill as freeform children | Section-as-card → shell `surface='card'`. |
| **licensing** | `none` | `muted` | `center` | default | Headline; credential row via `Block.Trust` | Self-populates from `constants/company/licenses`. |
| **faq** | `none` | `plain` | `center` | default | Headline; accordion as freeform children; `<Decor shape="square">` as Root child | Fixes: width parity (drop `max-w-140` → fills rail like callout), heading→list gap (rhythm token), decor bleed (clips now). Stays `'use client'`. |
| **process** | `none` | `plain` | `center` | default | Headline; step `<ol>` grid as freeform children | Per-step images stay inside the step cards. |
| **reviews** | `none` | `plain` | `center` | default | Headline; review card grid as freeform children | Data from company constants. |
| **testimonials** | `none` | `plain` | `center` | default | Headline; testimonial card grid as freeform children | Content-overridable, falls back to constants. |
| **cta** | `none` | `plain` | `center` | **compact** | Actions only | `size='compact'` reproduces its tighter `py-6`. Stays `'use client'`. |
| **portfolio** | `none` | `plain` | `center` | default | Headline, Body(subtitle); bento grid as freeform children | Media-forward grid; stays `'use client'` (tRPC). Migrated last. |

`media='left'`/`align='right'` exist for future variety (alternating media sides down the page) even though the first pass uses `right`/`center`.

## Tokens

Add to the `.theme-marketing, .funnel-light` block in `src/app/(frontend)/globals.css`; `cva` base classes reference them via arbitrary values (`p-[var(--block-pad)]`) so there is one source of truth:

```css
--block-pad: 2.25rem;          /* panel padding (card/muted surfaces) */
--block-gap: 1.5rem;           /* vertical rhythm between Content children */
--block-radius: 0.5rem;        /* panel corner radius */
--block-media-min-h: 22rem;    /* min height of the media column on desktop */
--block-pad-compact: 1.5rem;   /* size='compact' vertical padding */
```

Reuses existing tokens: `--shadow-card`, `--accent-ink` (eyebrow), `--body-text` (body), `--primary` (accent), `--card`/`--background`/`--muted` (surfaces), `--decor-stroke`/`--decor-gradient-alpha` (`<Decor>`).

## Dependencies

- `class-variance-authority` and `@radix-ui/react-slot` — both already used by the shadcn/ui components in this repo (verify presence in the plan; `cn` lives at `@/shared/lib/utils`).
- No new runtime dependencies expected.

## RSC / client boundary rules

- `block-root.tsx` and every slot are **presentational and RSC-safe** — no `'use client'`, no hooks, no context.
- Client behavior stays in leaves: `<Decor>` (already `'use client'`), the FAQ accordion, the portfolio fetch. These are imported flat and rendered as children — never dotted into from a server component.
- `funnel-landing.tsx` is already `'use client'`, so in the live funnel everything renders client-side regardless; RSC-safety is for correctness, reuse in RSC pages (`/test`), and future-proofing.

## Verification (no unit-test runner in this repo)

This is a visual UI system; the project has no vitest/jest runner. Each task verifies via:
1. `pnpm tsc` — clean typecheck.
2. `pnpm lint` — no new warnings/errors.
3. **Visual proof on `/test`** — the shell and each migrated block rendered in isolation.
4. **Visual gate on the live funnel** (`kitchens.localhost:3000`) — human confirmation per block before moving on.

`pnpm build` is never run (project rule). Work happens directly on `main`, staged per-file (pathspec commits) to avoid sweeping concurrent-session WIP.

## Migration order (one block at a time, DRY-checked)

1. Build the shell (`block/` dir) + tokens + variants; prove on `/test`.
2. Migrate **callout** (media + decor overlay + trust + CTA); visual gate.
3. Media/standard blocks: **value → problem → guarantee → licensing**.
4. Stack blocks: **faq → process → reviews → testimonials → cta**.
5. **portfolio** last (media-forward grid).

Each step: delete bespoke layout, recompose on `<Block>`, run tsc + lint + visual, confirm before the next.

## Out of scope

- The funnel *step* surfaces (card-select, ZIP/address, PII) — separate effort.
- The hero (already redesigned this session as the funnel's one dark moment).
- New marketing copy/content — this is layout standardization only.
- Animating the shell itself (decor already animates; block entrance is the existing landing-level motion).

## Success criteria

- All 11 blocks compose `<Block>`; no block hand-rolls width/surface/rhythm/decor anchoring.
- Left/right edges align down the entire page; alignment is intentional per block, not accidental.
- Decor never floats in dead space or clips at a section edge — it overlays media or anchors to a clipped panel.
- Changing a single `--block-*` token visibly moves every block in concert.
- Adding a new block is "compose `<Block>` + drop in content," not "reinvent a layout."
