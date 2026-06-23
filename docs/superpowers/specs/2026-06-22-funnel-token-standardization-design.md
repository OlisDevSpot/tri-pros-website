# Funnel Token Standardization + Polymorphic Body/Divider — Design

**Status:** approved (brainstorming), ready for implementation plan.
**Date:** 2026-06-22
**Builds on:** `2026-06-22-funnel-block-compound-system-design.md` (the compound `<Block>` shell). This spec eliminates the remaining ad-hoc style literals in that shell + its 11 migrated blocks, makes `Block.Body` polymorphic, and adds a tokenized `Block.Divider`.

## Goal

Kill the last of the per-block style freelancing. After this, every shared `<Block>` slot and every migrated block carries **only `var()`-driven utilities** for type size, leading, tracking, measure, and dividers — change one token, move the whole funnel. Two functional additions ride along: a polymorphic `Block.Body` (a lead region that can hold anything, not just a paragraph) and a `Block.Divider` slot that fixes the "label glued to the rule" spacing bug via a token.

## Problem (why)

The compound `<Block>` standardized width/surface/rhythm, but typography and dividers stayed hardcoded in the slots and blocks:
- Slots hardcode sizes/leading/tracking/measure: headline `text-2xl sm:text-[28px] leading-[1.15] tracking-[-0.01em]`, body `max-w-[48ch] text-[14.5px] leading-relaxed`, eyebrow `text-[11.5px] tracking-[0.2em]`.
- Blocks reintroduce ad-hoc utilities the system was meant to own: `text-balance`, `leading-relaxed`, `text-base sm:text-lg`, the kicker `-mt-4` magic number, and one-off `max-w-*`.
- **Divider bug:** problem's `standardLine` zone carries `border-t` with no internal top padding, so the "THE STANDARD" eyebrow sits flush against the rule. `--block-gap` spaces the zone from its sibling *above* the rule; it cannot create space *below* the rule, inside the zone. The original `pt-8` did that job and was wrongly deleted during migration on the theory that "`--block-gap` owns rhythm." Intra-zone divider padding is a separate concern from inter-zone gap.
- **Centered-lead cramping:** the centered intro is capped at `max-w-[48ch]` and reads as a pinched column against the full-rail content around it.

## Non-goals (YAGNI / scope guard)

- NOT touching color/shadow/radius/motion tokens (already tokenized) or their values.
- NOT restructuring block bodies (grids/accordion/cards stay verbatim).
- NOT changing the media composition recipe.
- NOT making Headline/Eyebrow/Trust/Actions polymorphic (only Body, per the keystone decision).

## Architecture

### 1. Token mechanism

Funnel-scoped CSS custom properties declared in the existing `.theme-marketing, .funnel-light` block in `src/app/(frontend)/globals.css` — same pattern as the current `--block-*` and color tokens. Consumed in slots via Tailwind arbitrary utilities that reference the var, e.g. `text-[length:var(--fs-headline)] leading-[var(--lh-headline)] tracking-[var(--tracking-headline)]`.

**Rejected alternative — Tailwind v4 `@theme` (`text-headline`):** `@theme` registers utilities globally, leaking the funnel's marketing type scale into the entire app and risking name clashes. Scoped vars keep the marketing voice contained and one-change-moves-everything.

### 2. New token set

Declared once (mobile) in `.theme-marketing, .funnel-light`, with responsive overrides in the existing `@media (min-width: 640px)` block where noted:

| Token | Value (initial; tune live) | Replaces |
|---|---|---|
| `--fs-headline` | `1.5rem` mobile → `1.75rem` ≥640 | `text-2xl sm:text-[28px]` |
| `--lh-headline` | `1.15` | `leading-[1.15]` |
| `--tracking-headline` | `-0.01em` | `tracking-[-0.01em]` |
| `--fs-body` | `0.95rem` (~15px) | `text-[14.5px]` |
| `--lh-body` | `1.65` | `leading-relaxed` |
| `--fs-eyebrow` | `0.72rem` (~11.5px) | `text-[11.5px]` |
| `--tracking-eyebrow` | `0.2em` | `tracking-[0.2em]` |
| `--measure-prose` | `60ch` | `max-w-[48ch]` (the pinched intro) |
| `--block-gap-kicker` | `0.5rem` | the `-mt-4` magic number |
| `--block-divider-pad` | `2rem` | the deleted `pt-8` |
| `--fs-display` | `2.25rem` (~36px) | block-specific big numbers (value ROI stat `text-4xl`) |

Existing tokens reused as-is: `--body-text`, `--accent-ink`, `--cred-ink`, `--cred-gap`, `--block-pad`, `--block-pad-compact`, `--block-gap`, `--block-media-min-h`, `--radius`, `--radius-chip`.

### 3. Slot refactor

All in `src/shared/domains/funnels/ui/block/`. RSC-purity preserved (no `'use client'`, no client imports — `Slot` from `@radix-ui/react-slot` is RSC-safe; `block-media.tsx` already imports it).

- **`block-body.tsx` → polymorphic.** Add `asChild?: boolean`; render via `Slot` when true, `<p>` otherwise. Classes (all token-driven): `max-w-[var(--measure-prose)] text-[length:var(--fs-body)] leading-[var(--lh-body)] text-pretty` + color `--body-text`. Default path = prose `<p>`. `asChild` path = consumer's element with the preset merged on; the child's own classes win (Radix merge order), so non-prose leads (stat / rating / media) override size/color/width as needed. Plain freeform children of `Block.Content` remain the path for leads that want NO body treatment.
- **`block-headline.tsx`:** `font-sans text-[length:var(--fs-headline)] leading-[var(--lh-headline)] tracking-[var(--tracking-headline)] font-bold text-balance text-foreground`. (`text-balance` baked in; removes per-block instances. Stays `<h2>`.)
- **`block-eyebrow.tsx`:** `text-[length:var(--fs-eyebrow)] tracking-[var(--tracking-eyebrow)] font-bold uppercase` + color `--accent-ink`.
- **`block-content.tsx`:** keep `flex flex-col gap-[var(--block-gap)]`; the eyebrow→headline tightening becomes token-driven: `[&>[data-slot=block-eyebrow]+[data-slot=block-headline]]:mt-[calc(var(--block-gap-kicker)-var(--block-gap))]` (replaces `-mt-4`).
- **`block-trust.tsx` / `block-actions.tsx`:** structurally unchanged; any literal gap swept to a token where one exists; otherwise left (intra-component gaps like `gap-3` on Actions are allowed).

### 4. `Block.Divider` (new slot)

New file `src/shared/domains/funnels/ui/block/block-divider.tsx`. A polymorphic (`asChild`) `Block.Content` child:
`border-border w-full border-t pt-[var(--block-divider-pad)]` (+ flex-col layout sensible default for grouped label+content; keep it minimal and let consumers add layout).
- As a Content child it inherits `--block-gap` from the zone above; `--block-divider-pad` is the intra-zone breathing room below the rule → fixes the glued-eyebrow bug structurally.
- Exported from `block.tsx` and attached as `Block.Divider` (assembly + flat re-export, matching the other slots).
- **Consumers:** problem `standardLine` footer wraps in `<Block.Divider>`. The credential divider in `Block.Trust` / `CredentialStrip` (currently `border-t pt-4`) adopts `--block-divider-pad` so there is exactly one divider treatment funnel-wide.

### 5. Per-block ad-hoc sweep

Remove every typography/measure literal now owned by tokens/slots from the 11 blocks. Known instances to delete:
- problem: `text-balance` on body (now slot default), `standardLine` `text-base sm:text-lg leading-relaxed` + the `<Block.Body>` there reverts to plain body tokens inside `<Block.Divider>`; remove any leftover `max-w`.
- value: ROI stat `text-4xl` → `text-[length:var(--fs-display)]`; `text-balance` on intro removed (slot default).
- Any remaining `leading-*`, `text-[`, `tracking-[`, `max-w-[` literals across the blocks.

## Verification

- `pnpm tsc` clean; `pnpm lint` clean (pre-existing repo warnings excepted).
- **Extended anti-drift grep** (run over `block/*.tsx` + `blocks/*.tsx`): reject `max-w-[(?!var)`, `text-\[(?!length:var|color:var)`, `leading-\[(?!var)`, `tracking-\[(?!var)`, `font-mono`, raw `mt-\[`, inter-zone `gap-\[`. Only `var()` forms pass. Intra-grid `gap-4`/`gap-3` (non-bracket) allowed.
- RSC purity: `block/` files contain no real `'use client'` directive / client import.
- Visual sweep of `kitchens.localhost:3000` top-to-bottom, mobile + desktop: divider has breathing room above its label; centered intro breathes (wider measure); every block's type reads identically (one scale); no regressions.

## Global Constraints (inherited)

- Work on `main`; per-file pathspec commits; never `git add -A`. NEVER `pnpm build`.
- Tokens are the single source of truth; no raw type/measure/divider literals left in `block/` or `blocks/`.
- Fonts: Headline `font-sans` (Syne); Body/Eyebrow inherit Nunito; **never `font-mono`**.
- Color: sole accent `#03AFED` (`--primary`/`--accent-ink`); surfaces from the neutral ramp only.
- Radius: `rounded-md` (6px); no 8px+.
- Width authority: the funnel rail owns width; Block Root/Content never set `max-w-*` (measure caps live on Body via `--measure-prose` only).
