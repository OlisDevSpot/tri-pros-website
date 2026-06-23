# Funnel Marketing `<Block>` Compound System — Design Spec

**Date:** 2026-06-22
**Status:** Approved (architecture) — revised after coverage + clarity review audits
**Owner:** Oliver P
**Related:** `docs/superpowers/specs/2026-06-22-anti-slop-design-system-design.md` (tokens, `<Decor>`, `<CredentialStrip>`, Blueprint Authority art direction this builds on)

> **Revision note:** This spec was audited by two review agents against a full ledger of the user's stated requirements. Their findings (coverage gaps + ambiguities) are incorporated below. The most consequential: the `<Decor>` component is a corner *underlay* today and must be upgraded to overlay media (see §"Decor changes required").

---

## Goal

Give every funnel marketing block one shared, composable foundation — a compound `<Block>` component that owns width, vertical rhythm, surface, and atmosphere/decor anchoring, while letting the consumer dictate presentation (alignment, optional full-bleed media column, arbitrary content). This turns the design tokens we built into a system that is actually *enforced*, and kills the per-block freelancing that made the page read as inconsistent AI-slop.

## Problem (why this exists)

We tokenized the *atoms* (color, type, shadow, `<Decor>`, `<CredentialStrip>`) but never standardized the *molecule* — the block itself. Each of the 11 marketing blocks freelances its own width, alignment, surface, and decor placement:

- **Width mismatch** — callout fills the rail; FAQ constrains to `max-w-140` centered. Left/right edges don't line up down the page.
- **Alignment jumps** — callout left-aligned, most others centered.
- **Decor floats in dead space** — callout's arc sits in an empty right half; FAQ's squares bleed past the right edge and clip awkwardly (the canonical AI-slop "floating shapes" tell). Decor is also too faint — a recurring complaint.
- **Surfaces diverge** — bare `bg-background`, `bg-card` panel, `bg-muted` panel, and double-nested surfaces all coexist with no rule.
- **Rhythm is hand-set** — every block invents its own `mt-*`/`gap-*`; the FAQ heading sits right on top of its list.

## Architecture

**Composition-first, RSC-safe** — the shadcn/ui + Radix Themes `Section` playbook, NOT the context-heavy interactive-compound playbook our entity cards use.

Rationale (from research):
- Marketing blocks are **presentational layout**, not interactive stateful widgets. Their variation is `surface`/`align`/`media`/`size` (config → variant props) plus block-specific bodies (structure → children). Context is unnecessary.
- **`Object.assign` dot-notation crashes when a Server Component dots into a *client* Root** (`next.js#51593`). Our entity cards dodge this only because everything there is `'use client'`. Marketing blocks are an RSC/client mix and we want to reuse them in RSC pages (e.g. `/test`). So: **keep the Root and all slots RSC-safe and presentational**; isolate client behavior (decor animation, accordion state, tRPC) into client leaf components imported flat.
- Dot-notation (`Block.Media`) is then **safe** because the Root is server-safe — and flat named exports remain the tree-shakeable source of truth.

**Visual-hierarchy rationale (Z-pattern):** the slot order eyebrow → headline → body → trust → actions follows the top-to-bottom reading axis; left-aligned content blocks place the entry point top-left and the CTA at the terminal of the scan. `align='center'` is for blocks with no media column (announcements, grids) where a symmetric axis reads better. This is intentional, not cosmetic.

Sources: shadcn Card, Radix Themes `Section`, `next.js#51593`, Kyle Shevlin "boolean props are a code smell", patterns.dev compound pattern.

### Variants (cva — enums, no boolean soup)

The Root is a `<section>` whose classes come from a `cva` variant map. Four enum variants:

| Variant | Values | Effect |
|---|---|---|
| `media` | `'none'` \| `'left'` \| `'right'` | 1-col, or 2-col grid with the media column ordered first/last |
| `surface` | `'plain'` \| `'card'` \| `'muted'` | `bg-background` (bare, no panel padding) / `bg-card` + `--shadow-card` panel / `bg-muted` panel |
| `align` | `'left'` \| `'center'` \| `'right'` | text + item alignment of the content column |
| `size` | `'default'` \| `'compact'` | vertical padding (compact = the `cta` block's tighter rhythm) |

Defaults: `media='none'`, `surface='plain'`, `align='left'`, `size='default'`.

**Always-on (base class):** `relative w-full isolate overflow-hidden`, padding/gap/radius from tokens. `isolate overflow-hidden` is unconditional so `<Decor>` always clips to the block (fixes the FAQ bleed permanently).

**Width authority:** the Root is always `w-full`. The funnel rail wrapper (`FUNNEL_RAIL_MAX_W = max-w-5xl` + `px-5` in `funnel-landing.tsx:103`) is the **sole** width authority. **No `max-w-*` on the Root or `Block.Content`** — that is exactly what broke FAQ↔callout parity. The only internal width constraint is `Block.Body`'s prose readability cap, `max-w-[48ch]` (matches the current callout body).

**Padding model (responsive, mobile-safe):** `--block-pad` is the **inner panel** padding, applied **only to `surface='card'|'muted'`** (and, by requirement, to any block with `media!=='none'` — see full-bleed recipe). `surface='plain'` has **no panel padding** (the rail `px-5` is its only gutter). Tokens are responsive via media query so one token still "moves every block":

```css
--block-pad: 1.25rem;                              /* mobile */
--block-pad-compact: 1rem;                          /* mobile, size='compact' */
@media (min-width: 640px) {
  --block-pad: 2.25rem;
  --block-pad-compact: 1.5rem;
}
```

`cva` base classes reference these via arbitrary values (`p-[var(--block-pad)]`), which Tailwind v4 JIT resolves (and which re-resolve at the breakpoint automatically). Vertical-only padding for `size='compact'` on `plain` surfaces uses `py-[var(--block-pad-compact)]` (no horizontal panel pad on plain).

**Data attributes** for declarative styling hooks — distinct per slot: Root `data-slot="block"` + `data-align` + `data-media` + `data-surface`; slots carry `data-slot="block-content"`, `"block-media"`, etc.

**Alignment mechanism (concrete):** the `align` classes live on the **Root** via `cva`, using descendant selectors that target the content column, e.g.:
```
align: {
  left:   'text-left [&_[data-slot=block-content]]:items-start',
  center: 'text-center [&_[data-slot=block-content]]:items-center',
  right:  'text-right [&_[data-slot=block-content]]:items-end',
}
```
`Block.Content` therefore takes **no** alignment variant of its own (no `contentVariants` for align). **Carve-outs:** `Block.Trust` and `Block.Actions` are NOT governed by `align`. Per requirement A8, `CredentialStrip` always renders **left-aligned** (`justify-start`) regardless of the block's `align`, because credentials read as a factual ledger, not centered marketing copy.

**Polymorphism:** `asChild` (Radix `Slot`) on the Root swaps `<section>` for any semantic element. `Block.Media`'s `asChild` is for the *non-fill* case only (consumer passes a fully-styled `<picture>`); the default/canonical path uses an internal wrapper (see recipe).

### Slots

Each slot is its own tiny RSC-safe component (flat named export), all re-attached as dot-notation on the Root via `Object.assign` (safe ∵ Root is server-safe). Slots render `null` when their content is absent (the entity-card convention — no `showX` booleans).

| Slot | `data-slot` | Role |
|---|---|---|
| `Block.Content` | `block-content` | the non-media column wrapper — `flex-col`, gap = `--block-gap`; alignment inherited from Root via descendant selector. Holds everything below. When `media='none'` it spans full width. |
| `Block.Eyebrow` | `block-eyebrow` | small uppercase tracked accent line, font `var(--font-text)` (Nunito), color `--accent-ink`. Flat, separate from headline. |
| `Block.Headline` | `block-headline` | the `h2`, font `var(--font-display)` (Syne), `text-2xl sm:text-[28px] leading-[1.15] tracking-[-0.01em] font-bold`. Flat, separate from eyebrow. |
| `Block.Body` | `block-body` | prose paragraph(s), font `var(--font-text)` (Nunito), color `--body-text`, `max-w-[48ch]`. |
| `Block.Media` | `block-media` | the full-bleed media column (see recipe). Hosts an `<Image fill>` + optional `overlay`. |
| `Block.Trust` | `block-trust` | drop-in for `<CredentialStrip>` / trust content; always left-aligned (carve-out). |
| `Block.Actions` | `block-actions` | the CTA area (standard `<Button>`), top rhythm from `--block-gap`; not governed by `align`. |

**Type law (A5):** Headline → `--font-display`; Eyebrow/Body → `--font-text`. **No monospace, ever** (token spec §3). No slot hardcodes a font family.

Block-specific bodies — accordion, bento grid, step list, before/after grid, review cards — are passed as **freeform children** of `Block.Content`. **Anti-drift rule:** freeform children MUST NOT set top-level vertical margins/gaps *between* sibling zones — that inter-zone rhythm is owned by `Block.Content`'s `--block-gap`. Intra-component grid gaps (`gap-4` inside a card grid) are fine. During migration, delete each block's bespoke inter-zone spacing (e.g. value's `gap-6`, problem's `gap-8`, problem's `standardLine` `pt-8`).

`<Decor>` for non-media blocks is a direct child of the Root (clips via the unconditional `isolate overflow-hidden`).

### The canonical media composition

```
┌─ <Block media="right" surface="card"> ───────────────────────┐
│  ┌ Block.Content ────────────┐ ┌ Block.Media (bleeds to edge)┐│
│  │ Eyebrow                   │ │▓▓▓▓ <Image fill> ▓▓▓▓▓▓▓▓▓▓▓││
│  │ Headline                  │ │▓▓▓▓  + <Decor cover>    ▓▓▓▓││
│  │ Body                      │ │▓▓▓▓  (over photo, z-10) ▓▓▓▓││
│  │ Trust  (CredentialStrip)  │ │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓││
│  │ Actions (CTA →)           │ │▓▓▓ no padding, full side ▓▓▓││
│  └───────────────────────────┘ └────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

**Exact full-bleed recipe (desktop):**
- Full-bleed media is only valid when the block has panel padding — i.e. `surface='card'|'muted'`. A media block must not use `surface='plain'` (validate in migration). The grid is 2-col with **column gap `0`** (not `--block-gap`) so the image meets the panel edge.
- `Block.Media` is a positioned wrapper: `relative overflow-hidden min-h-[var(--block-media-min-h)]`, plus negative margins equal to the panel padding to cancel it on the bled edges:
  - `media='right'`: `-my-[var(--block-pad)] -mr-[var(--block-pad)]`
  - `media='left'`:  `-my-[var(--block-pad)] -ml-[var(--block-pad)]`
- Inside the wrapper: `<Image fill className="object-cover">` and the decor overlay as a sibling: `<div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden z-10"><Decor placement="cover" /></div>`. The wrapper's own `overflow-hidden` clips decor to the column.
- Negative margins use the **responsive** `--block-pad`, so full-bleed holds at every breakpoint.

**Mobile:** the grid collapses to one column; the media renders as a **top banner** (`order-first`, `aspect-video`, full panel width). On mobile the *side* negative margins are dropped (`max-sm:mx-0`) — the banner bleeds top/left/right to the panel edge via `-mx-[var(--block-pad)] -mt-[var(--block-pad)]`, not the desktop side-bleed.

`Block.Media`'s `asChild` path (consumer passes their own `<picture>`/element) skips the `fill` wrapper and the overlay; it exists for non-photo media and is not used by the callout proof case.

### Decor changes required (NEW — the component must be upgraded)

The current `<Decor>` (`src/shared/components/decor/decor.tsx`) is hardcoded `pointer-events-none absolute -top-[150px] -right-[150px] z-0` and renders **behind** content (content sits at `z-1`). It cannot overlay media as the recipe requires. Plan tasks must:
1. Add a `placement?: 'corner' | 'cover'` prop (default `'corner'` preserves every current caller). `'cover'` positions the decor to fill its host (`inset-0`, sized to the column) so it visibly rides the photo, and renders above the image (the overlay wrapper supplies `z-10`).
2. Address **prominence** (the user's most-repeated complaint — decor "not pronounced enough," "pushed to its further limits"): for `cover`/over-media use, raise visibility — target `--decor-gradient-alpha` ≈ `0.5` for the cover variant (vs `0.34` corner default) and/or more `rings`. Acceptance bar: decor reads as a deliberate atmosphere layer over the photo, not a faint corner ghost. Tune live on `/test`.
3. Keep `corner` behavior byte-for-byte for existing non-media blocks (faq square, etc.).

This is the one place the system touches a shared primitive (`<Decor>`) rather than only composing — it is required to deliver the user's explicit "atmosphere overlays the image" effect (A21).

## File structure

```
src/shared/domains/funnels/ui/block/
  block-variants.ts     # cva: blockVariants (+ any mediaVariants) + exported VariantProps types
  block-root.tsx        # BlockRoot — RSC-safe <section>/Slot, cva, data-*, asChild
  block-content.tsx     # BlockContent
  block-eyebrow.tsx     # BlockEyebrow
  block-headline.tsx    # BlockHeadline
  block-body.tsx        # BlockBody
  block-media.tsx       # BlockMedia — full-bleed wrapper, Image fill + overlay, asChild
  block-trust.tsx       # BlockTrust
  block-actions.tsx     # BlockActions
  block.tsx             # assembly: import all → export const Block = Object.assign(BlockRoot, {...}); also re-export every flat name
```

- One React component per file (slots are NOT crammed into one file — differs from the entity overview-card precedent on purpose, to stay RSC-safe + tree-shakeable).
- `block.tsx` is the single import surface: `import { Block } from '@/shared/domains/funnels/ui/block/block'`. Assembly module (does `Object.assign` + flat re-exports), not a pure barrel.
- **RSC export-purity rule:** `block.tsx`, `block-root.tsx`, and every `block-*.tsx` slot file MUST NOT contain `'use client'` and MUST NOT import any client component (`<Decor>`, the accordion, a Button with a handler). Client leaves are imported by the *consuming block* and passed in as children/overlay — never imported by the Block primitives. Verify: `grep -L "use client" src/shared/domains/funnels/ui/block/*.tsx` must list every file.
- Prop interfaces live in each component file. Variant types live in `block-variants.ts`.
- **Scope note (A10):** `<Block>` lives under `funnels/ui/block/` because marketing blocks are a funnel-domain concept; the *tokens* it consumes are app-wide (token spec §3). If a second app surface needs the same primitive, promote `<Block>` to `src/shared/components/`. The app-wide tokenization mandate is satisfied by the tokens, not by the block's location.

## Per-block migration map

Each block is recomposed onto `<Block>`, deleting its bespoke layout (width, surface, alignment, inter-zone spacing). "Freeform children" rows below specify which existing spacings to **delete** (replaced by `--block-gap`) vs keep (intra-component grid gaps).

| Block | `media` | `surface` | `align` | `size` | Slots | Migration notes |
|---|---|---|---|---|---|---|
| **callout** | `right` | `card` | `left` | default | Eyebrow, Headline, Body, Trust(`CredentialStrip`), Actions, Media(`Image`+`Decor cover`) | The proof case. Render `points[]` (currently typed-but-dropped, types.ts:190) as a checklist in Content. Delete the inner `px-9 py-9` panel (shell owns it) and the `mt-*` rhythm. |
| **value** | `none` | `card` | `center` | default | Headline, Body(intro); ROI stat + before/after grid + comparison list as freeform children | Delete the section `gap-6` (→ `--block-gap`). Keep intra-grid `gap-3/gap-4`. |
| **problem** | `none` | `plain` | `center` | default | Headline, Body; gallery OR text-card grid as freeform children; `standardLine` as a final freeform zone | Preserve both runtime modes (`asGallery`). Delete section `gap-8` and `standardLine`'s `pt-8` top spacing (→ `--block-gap`); keep its `border-t`. |
| **guarantee** | `none` | `card` | `center` | default | Headline, Body; icon badge + scarcity pill as freeform children | Section-as-card → shell `surface='card'`. Delete the section's own `gap-4`/card classes. |
| **licensing** | `none` | `muted` | `center` | default | Headline; credential row via `Block.Trust` | Self-populates from `constants/company/licenses`. Delete `bg-muted/30` (shell `surface='muted'` owns it). |
| **faq** | `none` | `plain` | `center` | default | Headline; accordion as freeform children; `<Decor shape="square">` as Root child | Fixes: width parity (drop `max-w-140` → fills rail), heading→list gap (→ `--block-gap`), decor bleed (clips now). Stays `'use client'`. |
| **process** | `none` | `plain` | `center` | default | Headline; step `<ol>` grid as freeform children | Per-step images stay inside step cards. Delete section `gap-6` (→ `--block-gap`). |
| **reviews** | `none` | `plain` | `center` | default | Headline; review card grid as freeform children | Data from company constants. Delete section `gap-6`. |
| **testimonials** | `none` | `plain` | `center` | default | Headline; testimonial card grid as freeform children | Content-overridable, falls back to constants. Delete section `gap-6`. |
| **cta** | `none` | `plain` | `center` | **compact** | Actions only | `size='compact'` reproduces `py-6` (vertical only; no horizontal panel pad on plain). Stays `'use client'`. |
| **portfolio** | `none` | `plain` | `center` | default | Headline, Body(subtitle); bento grid as freeform children | Media-forward grid; stays `'use client'` (tRPC). Migrated last. Delete section `gap-6`. |

`media='left'`/`align='right'` exist for future variety (alternating media sides) even though the first pass uses `right`/`center`.

## Tokens

Add to the `.theme-marketing, .funnel-light` block in `src/app/(frontend)/globals.css`:

```css
--block-pad: 1.25rem;          /* inner panel padding — mobile */
--block-pad-compact: 1rem;     /* size='compact' — mobile */
--block-gap: 1.5rem;           /* vertical rhythm between Content children + inter-zone */
--block-media-min-h: 22rem;    /* min height of the media column on desktop */
@media (min-width: 640px) {
  --block-pad: 2.25rem;
  --block-pad-compact: 1.5rem;
}
```

- **Radius:** reuse the existing `--radius` (6px) via `rounded-md` for panels. Do NOT introduce a competing 8px radius — the token system deliberately chose 6px and the globals comment flags 8px as "slop." (Matches the current callout panel.)
- **Color guardrail (A4):** surfaces (`plain/card/muted`) draw only from the neutral ramp (`--background/--card/--muted`); the sole accent across all blocks is brand blue `#03AFED` (`--primary` / `--accent-ink`). No second accent, no gradients/glows beyond `<Decor>`.
- **Shadow caution (A16):** `surface='card'` reuses `--shadow-card`, which must stay clean/neutral over the warm sand surface — **no blue-tinted shadow** (it reads muddy/cream; this-session hero lesson).
- **Decor prominence:** the `cover` variant raises `--decor-gradient-alpha` toward `~0.5` (see Decor changes). Tune on `/test`.
- Reuses existing tokens: `--shadow-card`, `--accent-ink` (eyebrow), `--body-text` (body), `--primary` (accent), `--card/--background/--muted` (surfaces), `--font-display`/`--font-text` (type), `--decor-stroke`/`--decor-gradient-alpha` (`<Decor>`).

## Dependencies

- `class-variance-authority@0.7.1` + `@radix-ui/react-slot@1.2.3` — confirmed present; `button.tsx` already uses both. `cn` at `@/shared/lib/utils`.
- Tailwind v4 (`@import 'tailwindcss'`) — confirmed; arbitrary-value-from-CSS-var (`p-[var(--block-pad)]`) supported.
- No new runtime dependencies.

## Assumptions verified (trust-but-verify)

- `<Decor>` is corner-anchored `z-0` today and **needs the `cover` mode** above before any media block can use it (do this first among the shell tasks). Confirmed `src/shared/components/decor/decor.tsx`.
- `<CredentialStrip>` is constants-sourced, `font-semibold` (600 — satisfies "not too bold", do not re-bold), `flex-wrap` + `var(--cred-gap)`. Needs: explicit left-align contract under any `align`, and a **line-fill rule** — choose an item count from constants that never orphan-wraps (3 or 5, never 4 that wraps to a lonely line). Confirmed `src/shared/components/trust/credential-strip.tsx`.
- `callout-block.tsx` drops `content.points` today; migration should render it.
- `funnel-landing.tsx` is `'use client'` and owns **inter-block** spacing (`gap-12`) and the interstitial "See if you qualify" CTA every 3rd block — those remain its job, NOT `<Block>`'s.

## RSC / client boundary rules

- `block-root.tsx` and every slot are **presentational and RSC-safe** — no `'use client'`, no hooks, no context, no client imports (see export-purity rule).
- Client behavior stays in leaves: `<Decor>` (already `'use client'`), the FAQ accordion, the portfolio fetch — imported flat by the consuming block, rendered as children/overlay, never dotted into from a server component.
- `funnel-landing.tsx` is already `'use client'`, so in the live funnel everything renders client-side regardless; RSC-safety is for correctness, reuse in RSC pages (`/test`), and future-proofing.

## Verification (no unit-test runner in this repo)

This is a visual UI system; the project has no vitest/jest runner. Each task verifies via:
1. `pnpm tsc` — clean typecheck.
2. `pnpm lint` — no new warnings/errors.
3. `grep -L "use client" src/shared/domains/funnels/ui/block/*.tsx` lists every file (RSC purity), and `grep -nE "max-w-|font-mono|mt-\[|gap-\[" <migrated block>` finds no shell-owned literals left behind (anti-drift).
4. **Visual proof on `/test`** — the shell + each migrated block in isolation.
5. **Per-block visual gate** (`kitchens.localhost:3000`) — human confirmation against this falsifiable checklist before moving on:
   - (a) left/right edges align with the adjacent block at `max-w-5xl`;
   - (b) decor is clipped, never floating in dead space; on media blocks it visibly rides the photo and reads as prominent (A7);
   - (c) at 360px width: no horizontal scroll, panel padding comfortable, media is a top banner;
   - (d) credential row left-aligned and single-line-filled (A8);
   - (e) headline = Syne, body/eyebrow = Nunito, no mono anywhere (A5);
   - (f) only accent is `#03AFED`; shadows clean/neutral (A4/A16).

`pnpm build` is never run (project rule). Work happens directly on `main`, staged per-file (pathspec commits) to avoid sweeping concurrent-session WIP.

## Migration order (one block at a time, DRY-checked)

1. **Upgrade `<Decor>`** with the `cover` placement + prominence (prereq for media blocks).
2. **Build the shell** (`block/` dir) + tokens + variants; prove on `/test`.
3. Migrate **callout** (media + decor overlay + trust + CTA); visual gate.
4. Media/standard blocks: **value → problem → guarantee → licensing**.
5. Stack blocks: **faq → process → reviews → testimonials → cta**.
6. **portfolio** last (media-forward grid).

Each step: delete bespoke layout, recompose on `<Block>`, run tsc + lint + grep checks + visual, confirm before the next.

## Out of scope

- The funnel *step* surfaces (card-select, ZIP/address, PII) — separate effort.
- The hero (already redesigned this session as the funnel's one dark moment).
- New marketing copy/content — this is layout standardization only.
- Block *entrance* animation (the landing-level motion already handles it); only `<Decor>`'s internal motion changes.

## Success criteria

- All 11 blocks compose `<Block>`; no block hand-rolls width/surface/rhythm/decor anchoring.
- Left/right edges align down the entire page; alignment is intentional per block.
- Decor never floats in dead space or clips at a section edge; on media blocks it overlays the photo prominently.
- Credentials are left-aligned and line-filled; type is Syne/Nunito with no mono; the only accent is `#03AFED`.
- Changing a single `--block-*` token visibly moves every block in concert; no shell-owned literal (`max-w-`, inter-zone `gap-`/`mt-`, font family) survives inside a migrated block.
- Adding a new block is "compose `<Block>` + drop in content," not "reinvent a layout."
