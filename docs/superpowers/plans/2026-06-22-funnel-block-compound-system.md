# Funnel Marketing `<Block>` Compound System — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one shared, composable `<Block>` compound primitive that owns width/rhythm/surface/decor, then migrate all 11 funnel marketing blocks onto it so the design tokens are actually enforced and every block stops freelancing its layout.

**Architecture:** Composition-first, RSC-safe (shadcn/Radix-Themes playbook): a presentational `<section>` Root driven by `cva` enum variants (`media`/`surface`/`align`/`size`) + `data-*` attributes, with flat-named slot components re-attached as dot-notation via `Object.assign`. Client behavior (decor motion, accordion, tRPC) stays in leaf components imported flat by the consuming block — never into the `block/` primitives. The shared `<Decor>` atmosphere component is upgraded with a `cover` placement so it can overlay a full-bleed media column.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4 (`@theme inline` + CSS-var tokens), `class-variance-authority@0.7.1`, `@radix-ui/react-slot@1.2.3`, `motion/react`, `next/image`. `cn` at `@/shared/lib/utils`.

**Spec:** `docs/superpowers/specs/2026-06-22-funnel-block-compound-system-design.md` (read it; this plan implements it).

## Global Constraints

- **Verification = `pnpm tsc` + `pnpm lint` + visual** on `/test` and `kitchens.localhost:3000`. There is NO unit-test runner (no vitest/jest). NEVER run `pnpm build`.
- **Work on `main`. No new branch.** Commit per-file with pathspec (`git commit <path> -m ...`), never `git add -A` / bare `git commit`, to avoid sweeping concurrent-session WIP.
- **Tokens are the single source of truth.** Block sizing comes from `--block-*` CSS vars; no hardcoded `max-w-*`, inter-zone `gap-*`/`mt-*`, or font family inside a migrated block. After each migration run: `grep -nE "max-w-|font-mono|mt-\[|gap-\[" <block file>` — expect no shell-owned literals left behind (intra-grid `gap-4` inside a card grid is allowed).
- **RSC export-purity:** every file in `src/shared/domains/funnels/ui/block/` MUST NOT contain `'use client'` and MUST NOT import a client component. Verify: `grep -L "use client" src/shared/domains/funnels/ui/block/*.tsx` lists every file.
- **Fonts:** Headlines use `font-sans` (= Syne, the display face). Eyebrow/Body set NO font utility (inherit Nunito, the body default on `<body>`). **Never `font-mono`** (Space Mono is loaded but forbidden).
- **Color:** sole accent is brand blue `#03AFED` (`--primary` / `--accent-ink`). Surfaces draw only from the neutral ramp (`--background`/`--card`/`--muted`). No second accent, no gradients/glows beyond `<Decor>`.
- **Radius:** reuse `rounded-md` (maps to the deliberate 6px `--radius`). Do NOT introduce an 8px radius.
- **Shadows:** `surface='card'` reuses `--shadow-card`; keep it clean/neutral — no blue-tinted shadow over the warm sand surface.
- **Width authority:** the funnel rail (`FUNNEL_RAIL_MAX_W = max-w-5xl` + `px-5` in `funnel-landing.tsx:103`) is the sole width owner. The Root is always `w-full`; no `max-w-*` on Root/Content. Inter-block `gap-12` and interstitial CTAs remain `funnel-landing`'s job.
- **Decor:** the default `corner` placement must remain byte-identical for existing callers (faq square, etc.); only the new `cover` placement is added.

---

## Task 1: Upgrade `<Decor>` with `cover` placement + prominence

**Files:**
- Modify: `src/shared/components/decor/decor.tsx`

**Interfaces:**
- Produces: `Decor` now accepts `placement?: 'corner' | 'cover'` (default `'corner'`). `cover` fills its host (`inset-0`, `z-10`), anchors the artwork top-right via `preserveAspectRatio="xMaxYMin slice"`, and raises `--decor-gradient-alpha` to `0.5` locally for prominence over a photo. `corner` is unchanged.

- [ ] **Step 1: Read the current component**

Read `src/shared/components/decor/decor.tsx` in full (it is the file being changed). Confirm the wrapper is `pointer-events-none absolute -top-[150px] -right-[150px] z-0 h-[500px] w-[500px]` and the `<svg>` has no `preserveAspectRatio`.

- [ ] **Step 2: Add the `placement` prop and branch the wrapper + svg**

Replace the signature and the wrapper `<div>` + `<svg>` opening tag:

```tsx
export function Decor({ shape = 'arc', rings, placement = 'corner', className }: { shape?: DecorShape, rings?: number, placement?: 'corner' | 'cover', className?: string }) {
  const reduce = useReducedMotion()
  const geometry = buildDecorGeometry(shape, rings)
  const { x, y } = DECOR_ORIGIN
  const isCover = placement === 'cover'

  return (
    <div
      className={cn(
        'pointer-events-none absolute',
        isCover
          ? 'inset-0 z-10 h-full w-full'
          : '-top-[150px] -right-[150px] z-0 h-[500px] w-[500px]',
        className,
      )}
      style={isCover ? ({ '--decor-gradient-alpha': '0.5' } as React.CSSProperties) : undefined}
      aria-hidden="true"
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${DECOR_VIEWBOX} ${DECOR_VIEWBOX}`}
        preserveAspectRatio={isCover ? 'xMaxYMin slice' : 'xMidYMid meet'}
        fill="none"
      >
```

Add the `React` type import if not present (the file already imports from `'motion/react'`; add `import type { CSSProperties } from 'react'` and use `CSSProperties` instead of `React.CSSProperties` to satisfy lint's import rules — adjust the cast to `as CSSProperties`). Everything from `<defs>` through `</svg>` and the rest of the file stays exactly as-is.

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm tsc`
Expected: clean (no errors).
Run: `pnpm lint`
Expected: no new errors/warnings for `decor.tsx` (sorted imports; `CSSProperties` imported as a type).

- [ ] **Step 4: Verify `corner` callers are unchanged**

Run: `grep -rn "<Decor" src/shared/domains/funnels/ui/blocks/`
Expected: existing usages (e.g. `faq-block.tsx` `<Decor shape="square" />`, `callout-block.tsx` `<Decor shape="arc" />`) pass no `placement`, so they default to `corner` — identical output to before. No visual change to those blocks yet.

- [ ] **Step 5: Commit**

```bash
git commit src/shared/components/decor/decor.tsx -m "feat(decor): add cover placement for over-media overlay

Adds placement='corner'|'cover'. 'cover' fills the host (inset-0, z-10),
anchors top-right via preserveAspectRatio slice, and boosts gradient alpha
to 0.5 for prominence over a photo. 'corner' (default) unchanged.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Add `--block-*` tokens to the marketing theme

**Files:**
- Modify: `src/app/(frontend)/globals.css` (the `.theme-marketing, .funnel-light { ... }` rule near line 92–148, after `--decor-gradient-alpha: 0.34;` at ~line 142)

**Interfaces:**
- Produces: CSS custom properties `--block-pad`, `--block-pad-compact`, `--block-gap`, `--block-media-min-h` available under the marketing theme, responsive at the `640px` breakpoint.

- [ ] **Step 1: Add the base tokens**

Inside the `.theme-marketing, .funnel-light { ... }` block, immediately after the `--decor-gradient-alpha: 0.34;` line, add:

```css
  /* <Block> compound system — layout rhythm (see funnel/ui/block/) */
  --block-pad: 1.25rem;          /* inner panel padding (card/muted surfaces) — mobile */
  --block-pad-compact: 1rem;     /* size='compact' vertical padding — mobile */
  --block-gap: 1.5rem;           /* vertical rhythm between Block.Content children */
  --block-media-min-h: 22rem;    /* min height of the media column on desktop */
```

- [ ] **Step 2: Add the responsive override**

Immediately AFTER the closing `}` of the `.theme-marketing, .funnel-light { ... }` rule (and before the `.theme-marketing.theme-dark` rule at ~line 151), add:

```css
@media (min-width: 640px) {
  .theme-marketing,
  .funnel-light {
    --block-pad: 2.25rem;
    --block-pad-compact: 1.5rem;
  }
}
```

- [ ] **Step 3: Typecheck + lint**

Run: `pnpm tsc`
Expected: clean (CSS changes don't affect TS).
Run: `pnpm lint`
Expected: clean (lint does not cover CSS, but confirm no JS/TS regressions).

- [ ] **Step 4: Commit**

```bash
git commit "src/app/(frontend)/globals.css" -m "feat(funnel): add --block-* layout tokens to marketing theme

Responsive panel padding + rhythm tokens for the <Block> compound system.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: `block-variants.ts` (cva variant map)

**Files:**
- Create: `src/shared/domains/funnels/ui/block/block-variants.ts`

**Interfaces:**
- Produces: `blockVariants` (cva) and `BlockVariants` (type = `VariantProps<typeof blockVariants>`), consumed by `BlockRoot`.

- [ ] **Step 1: Write the file**

```ts
import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Layout DNA for the funnel `<Block>` shell. Enum variants only (no boolean
 * soup). Padding comes from --block-* tokens so one change moves every block.
 * Alignment classes live HERE on the Root and reach the content column via a
 * descendant selector; Block.Trust opts out (always left). Media requires a
 * padded surface (card|muted) so the full-bleed negative margins have padding
 * to cancel — enforced by the compound variants below.
 */
export const blockVariants = cva(
  'relative w-full isolate overflow-hidden',
  {
    variants: {
      media: {
        none: '',
        left: 'grid gap-0 md:grid-cols-2',
        right: 'grid gap-0 md:grid-cols-2',
      },
      surface: {
        plain: 'bg-background',
        card: 'bg-card rounded-md shadow-[var(--shadow-card)]',
        muted: 'bg-muted rounded-md',
      },
      align: {
        left: 'text-left [&_[data-slot=block-content]]:items-start',
        center: 'text-center [&_[data-slot=block-content]]:items-center',
        right: 'text-right [&_[data-slot=block-content]]:items-end',
      },
      size: {
        default: '',
        compact: '',
      },
    },
    compoundVariants: [
      { surface: 'card', class: 'p-[var(--block-pad)]' },
      { surface: 'muted', class: 'p-[var(--block-pad)]' },
      { surface: 'plain', size: 'default', class: 'py-[var(--block-pad)]' },
      { surface: 'plain', size: 'compact', class: 'py-[var(--block-pad-compact)]' },
    ],
    defaultVariants: { media: 'none', surface: 'plain', align: 'left', size: 'default' },
  },
)

export type BlockVariants = VariantProps<typeof blockVariants>
```

- [ ] **Step 2: Typecheck + lint**

Run: `pnpm tsc` → clean. Run: `pnpm lint` → clean (sorted imports).

- [ ] **Step 3: Commit**

```bash
git commit src/shared/domains/funnels/ui/block/block-variants.ts -m "feat(funnel): <Block> cva variant map

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: `BlockRoot`

**Files:**
- Create: `src/shared/domains/funnels/ui/block/block-root.tsx`

**Interfaces:**
- Consumes: `blockVariants`, `BlockVariants` from `./block-variants`; `cn` from `@/shared/lib/utils`; `Slot` from `@radix-ui/react-slot`.
- Produces: `BlockRoot` — `<section>` (or `Slot` when `asChild`) with `data-slot="block"` + `data-media/-align/-surface`, classes from `blockVariants`. Props: `ComponentPropsWithoutRef<'section'> & BlockVariants & { asChild?: boolean }`.

- [ ] **Step 1: Write the file**

```tsx
import type { ComponentPropsWithoutRef } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/shared/lib/utils'
import { blockVariants, type BlockVariants } from '@/shared/domains/funnels/ui/block/block-variants'

type BlockRootProps = ComponentPropsWithoutRef<'section'> & BlockVariants & { asChild?: boolean }

/**
 * The funnel marketing block shell. RSC-safe + presentational: no 'use client',
 * no hooks, no client imports. Owns width (always w-full; the rail caps width),
 * surface, padding/rhythm tokens, alignment, and decor clipping (isolate +
 * overflow-hidden). Consumers compose Block.* slots + freeform children.
 */
export function BlockRoot({ media, surface, align, size, asChild, className, ...props }: BlockRootProps) {
  const Comp = asChild ? Slot : 'section'
  return (
    <Comp
      data-slot="block"
      data-media={media ?? 'none'}
      data-align={align ?? 'left'}
      data-surface={surface ?? 'plain'}
      className={cn(blockVariants({ media, surface, align, size }), className)}
      {...props}
    />
  )
}
```

- [ ] **Step 2: Typecheck + lint** — `pnpm tsc` clean; `pnpm lint` clean.

- [ ] **Step 3: Commit**

```bash
git commit src/shared/domains/funnels/ui/block/block-root.tsx -m "feat(funnel): BlockRoot shell (RSC-safe, cva-driven)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Text + structural slots (Content, Eyebrow, Headline, Body, Trust, Actions)

**Files:**
- Create: `src/shared/domains/funnels/ui/block/block-content.tsx`
- Create: `src/shared/domains/funnels/ui/block/block-eyebrow.tsx`
- Create: `src/shared/domains/funnels/ui/block/block-headline.tsx`
- Create: `src/shared/domains/funnels/ui/block/block-body.tsx`
- Create: `src/shared/domains/funnels/ui/block/block-trust.tsx`
- Create: `src/shared/domains/funnels/ui/block/block-actions.tsx`

**Interfaces:**
- Produces: `BlockContent`, `BlockEyebrow`, `BlockHeadline`, `BlockBody`, `BlockTrust`, `BlockActions`. Each is RSC-safe, sets its own `data-slot`, and forwards `className` + native props. `BlockContent` is a `flex-col` with `gap-[var(--block-gap)]`; its `align-items` is set by the Root's `align` descendant selector. `BlockTrust` is the alignment carve-out (always left). `BlockActions` follows `align` (inherits parent `align-items`).

- [ ] **Step 1: `block-content.tsx`**

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

/** Non-media column. flex-col; inter-child rhythm = --block-gap. align-items set by Root's align. */
export function BlockContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="block-content" className={cn('flex flex-col gap-[var(--block-gap)]', className)} {...props} />
}
```

- [ ] **Step 2: `block-eyebrow.tsx`** (Nunito — no font utility; uppercase tracked accent label)

```tsx
import type { ComponentProps, CSSProperties } from 'react'
import { cn } from '@/shared/lib/utils'

const EYEBROW_STYLE: CSSProperties = { color: 'var(--accent-ink)' }

/** Small uppercase accent label. Inherits Nunito (body font) — never font-mono. */
export function BlockEyebrow({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="block-eyebrow" className={cn('text-[11.5px] font-bold tracking-[0.2em] uppercase', className)} style={EYEBROW_STYLE} {...props} />
}
```

- [ ] **Step 3: `block-headline.tsx`** (Syne = `font-sans`)

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

/** Section headline. font-sans = Syne (display). */
export function BlockHeadline({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="block-headline"
      className={cn('text-foreground font-sans text-2xl leading-[1.15] font-bold tracking-[-0.01em] sm:text-[28px]', className)}
      {...props}
    />
  )
}
```

- [ ] **Step 4: `block-body.tsx`** (Nunito inherit; body-text color; prose cap)

```tsx
import type { ComponentProps, CSSProperties } from 'react'
import { cn } from '@/shared/lib/utils'

const BODY_STYLE: CSSProperties = { color: 'var(--body-text)' }

/** Prose paragraph. Inherits Nunito; max-w-[48ch] is the ONLY internal width cap. */
export function BlockBody({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="block-body" className={cn('max-w-[48ch] text-[14.5px] leading-relaxed', className)} style={BODY_STYLE} {...props} />
}
```

- [ ] **Step 5: `block-trust.tsx`** (align carve-out: always left)

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

/** Trust/credential slot. align CARVE-OUT — always reads left, even in a centered block. */
export function BlockTrust({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="block-trust" className={cn('w-full self-start text-left', className)} {...props} />
}
```

- [ ] **Step 6: `block-actions.tsx`** (follows align via parent align-items)

```tsx
import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/utils'

/** CTA area. Spacing from --block-gap (it is a Content child). Alignment follows the block's align. */
export function BlockActions({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="block-actions" className={cn('flex items-center gap-3', className)} {...props} />
}
```

- [ ] **Step 7: Typecheck + lint** — `pnpm tsc` clean; `pnpm lint` clean.

- [ ] **Step 8: Commit**

```bash
git commit src/shared/domains/funnels/ui/block/block-content.tsx src/shared/domains/funnels/ui/block/block-eyebrow.tsx src/shared/domains/funnels/ui/block/block-headline.tsx src/shared/domains/funnels/ui/block/block-body.tsx src/shared/domains/funnels/ui/block/block-trust.tsx src/shared/domains/funnels/ui/block/block-actions.tsx -m "feat(funnel): <Block> text + structural slots

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: `BlockMedia` (full-bleed column + decor overlay)

**Files:**
- Create: `src/shared/domains/funnels/ui/block/block-media.tsx`

**Interfaces:**
- Consumes: `Slot` from `@radix-ui/react-slot`; `cn`.
- Produces: `BlockMedia` — props `{ side?: 'left' | 'right', overlay?: ReactNode, asChild?: boolean, className?: string, children?: ReactNode }`. Renders a positioned wrapper (`relative overflow-hidden`) that hosts an `<Image fill>` (passed as `children`) and the `overlay` (a `<Decor placement="cover">`). Full-bleed via negative margins equal to `--block-pad`; mobile = top banner. `asChild` skips the wrapper for consumer-styled media (no overlay).

- [ ] **Step 1: Write the file**

```tsx
import type { ComponentProps, ReactNode } from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/shared/lib/utils'

type BlockMediaProps = {
  side?: 'left' | 'right'
  overlay?: ReactNode
  asChild?: boolean
  className?: string
  children?: ReactNode
}

/**
 * Full-bleed media column. Requires a padded surface (card|muted) on the Block:
 * the negative margins cancel --block-pad so the image meets the panel edge with
 * no gutter. Desktop: bleeds to the side; mobile: a top banner (aspect-video).
 * `overlay` (a <Decor placement="cover">) rides on top, clipped by the wrapper.
 * `asChild` is for consumer-styled media (no fill wrapper, no overlay).
 */
export function BlockMedia({ side = 'right', overlay, asChild, className, children }: BlockMediaProps) {
  const wrapperCls = cn(
    'relative overflow-hidden',
    // mobile: top banner, bleed top + both sides
    '-mx-[var(--block-pad)] -mt-[var(--block-pad)] aspect-video',
    // desktop: column, reset mobile bleed, fill height, min-h
    'sm:mx-0 sm:mt-0 sm:aspect-auto sm:h-full sm:min-h-[var(--block-media-min-h)]',
    side === 'right'
      ? 'sm:-my-[var(--block-pad)] sm:-mr-[var(--block-pad)]'
      : 'sm:-my-[var(--block-pad)] sm:-ml-[var(--block-pad)]',
    // order: media on top on mobile; on desktop right→source order, left→first
    'order-first',
    side === 'right' ? 'md:order-none' : 'md:order-first',
    className,
  )

  if (asChild) {
    return <Slot data-slot="block-media" className={wrapperCls}>{children}</Slot>
  }

  return (
    <div data-slot="block-media" className={wrapperCls}>
      {children}
      {overlay
        ? <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">{overlay}</div>
        : null}
    </div>
  )
}
```

Note: `ComponentProps` import is unused here — do NOT import it (lint would flag). Import only `ReactNode` (type) and `Slot` and `cn`.

- [ ] **Step 2: Typecheck + lint** — `pnpm tsc` clean; `pnpm lint` clean (no unused imports).

- [ ] **Step 3: Commit**

```bash
git commit src/shared/domains/funnels/ui/block/block-media.tsx -m "feat(funnel): BlockMedia full-bleed column + decor overlay

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: `block.tsx` assembly + `/test` proof

**Files:**
- Create: `src/shared/domains/funnels/ui/block/block.tsx`
- Modify: `src/app/(frontend)/test/page.tsx`

**Interfaces:**
- Consumes: all slot components + `BlockRoot`.
- Produces: `Block` = `Object.assign(BlockRoot, { Content, Eyebrow, Headline, Body, Media, Trust, Actions })`, plus flat re-exports. Single import surface: `@/shared/domains/funnels/ui/block/block`.

- [ ] **Step 1: Write `block.tsx`**

```tsx
import { BlockActions } from '@/shared/domains/funnels/ui/block/block-actions'
import { BlockBody } from '@/shared/domains/funnels/ui/block/block-body'
import { BlockContent } from '@/shared/domains/funnels/ui/block/block-content'
import { BlockEyebrow } from '@/shared/domains/funnels/ui/block/block-eyebrow'
import { BlockHeadline } from '@/shared/domains/funnels/ui/block/block-headline'
import { BlockMedia } from '@/shared/domains/funnels/ui/block/block-media'
import { BlockRoot } from '@/shared/domains/funnels/ui/block/block-root'
import { BlockTrust } from '@/shared/domains/funnels/ui/block/block-trust'

/**
 * Funnel marketing block compound. Flat names are the source of truth; the
 * dot-notation namespace is attached here. Safe to dot from a Server Component
 * because BlockRoot + every slot are RSC-safe (no 'use client', no client imports).
 */
export const Block = Object.assign(BlockRoot, {
  Content: BlockContent,
  Eyebrow: BlockEyebrow,
  Headline: BlockHeadline,
  Body: BlockBody,
  Media: BlockMedia,
  Trust: BlockTrust,
  Actions: BlockActions,
})

export { BlockActions, BlockBody, BlockContent, BlockEyebrow, BlockHeadline, BlockMedia, BlockRoot, BlockTrust }
```

- [ ] **Step 2: Add a Block proof to `/test`**

Edit `src/app/(frontend)/test/page.tsx` — widen the wrapper to mirror the rail and add a media Block above the existing CalloutBlock/FaqBlock demos. Change the `<main>` className `max-w-3xl` → `max-w-5xl`, add imports, and insert the proof block as the first child:

```tsx
import Image from 'next/image'
import { Decor } from '@/shared/components/decor/decor'
import { CredentialStrip } from '@/shared/components/trust/credential-strip'
import { Block } from '@/shared/domains/funnels/ui/block/block'
```

```tsx
<Block media="right" surface="card" align="left">
  <Block.Content>
    <Block.Eyebrow>Financing · in writing</Block.Eyebrow>
    <Block.Headline>A Showcase kitchen, without draining your savings.</Block.Headline>
    <Block.Body>Fixed, low monthly payments. We walk you through the options you qualify for during your consultation — no obligation, clear written numbers.</Block.Body>
    <Block.Trust><CredentialStrip /></Block.Trust>
    <Block.Actions>
      <button type="button" className="bg-foreground text-card inline-flex items-center gap-2.5 rounded-[3px] px-6 py-3.5 text-[14.5px] font-bold">See what you qualify for</button>
    </Block.Actions>
  </Block.Content>
  <Block.Media side="right" overlay={<Decor shape="arc" placement="cover" />}>
    <Image src="/portfolio-photos/modern-kitchen-1.jpeg" alt="" fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
  </Block.Media>
</Block>
```

- [ ] **Step 3: Typecheck + lint** — `pnpm tsc` clean; `pnpm lint` clean.

- [ ] **Step 4: RSC export-purity check**

Run: `grep -L "use client" src/shared/domains/funnels/ui/block/*.tsx`
Expected: lists ALL nine `block/*.tsx` files (none contain `'use client'`).

- [ ] **Step 5: Visual gate on `/test`**

Confirm on `test.localhost:3000` (or the themed `/test`): the media block shows the kitchen photo edge-to-edge on the right (no gutter), the arc decor visibly rides the photo (prominent, not a faint ghost), text is left-aligned, credentials are a single filled left-aligned row, headline is Syne, and at 360px width the photo becomes a top banner with no horizontal scroll.

- [ ] **Step 6: Commit**

```bash
git commit src/shared/domains/funnels/ui/block/block.tsx "src/app/(frontend)/test/page.tsx" -m "feat(funnel): <Block> assembly + /test proof

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Migrate `callout` (the proof block)

**Files:**
- Modify: `src/shared/domains/funnels/types.ts` (add optional `image` to `CalloutBlockContent`)
- Modify: `src/shared/domains/funnels/ui/blocks/callout-block.tsx` (recompose on `<Block>`)
- Modify: `src/shared/domains/funnels/constants/kitchens.ts` (give the live callout an image)

**Interfaces:**
- Consumes: `Block`, `Decor` (`placement="cover"`), `CredentialStrip`, `next/image`.
- Produces: callout rendered via `<Block media="right" surface="card" align="left">`.

- [ ] **Step 1: Extend the content type**

In `src/shared/domains/funnels/types.ts`, find `CalloutBlockContent` (~line 187) and add an optional image:

```ts
export interface CalloutBlockContent {
  headline: string
  body: string
  points?: string[]
  eyebrow?: string
  ctaLabel?: string
  image?: { src: string, alt: string }
}
```

- [ ] **Step 2: Rewrite the block**

Replace `src/shared/domains/funnels/ui/blocks/callout-block.tsx` entirely:

```tsx
import type { CalloutBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import type { CSSProperties } from 'react'
import { ArrowRight } from 'lucide-react'
import Image from 'next/image'
import { Decor } from '@/shared/components/decor/decor'
import { CredentialStrip } from '@/shared/components/trust/credential-strip'
import { Block } from '@/shared/domains/funnels/ui/block/block'

const POINT_DOT_STYLE: CSSProperties = { background: 'var(--primary)' }
const POINT_TEXT_STYLE: CSSProperties = { color: 'var(--body-text)' }
const ARROW_STYLE: CSSProperties = { color: 'var(--primary)' }
const DEFAULT_IMAGE = { src: '/portfolio-photos/modern-kitchen-1.jpeg', alt: 'Remodeled Showcase kitchen' }

/**
 * "Blueprint Authority" financing callout — the canonical media block:
 * content column + full-bleed kitchen photo with brand-blue decor overlay.
 * Composes the shared <Block> shell; all width/surface/rhythm come from there.
 */
export function CalloutBlock({ content }: { content: CalloutBlockContent, ctx: FunnelContext }) {
  const image = content.image ?? DEFAULT_IMAGE
  return (
    <Block media="right" surface="card" align="left">
      <Block.Content>
        <Block.Eyebrow>{content.eyebrow ?? 'Financing · in writing'}</Block.Eyebrow>
        <Block.Headline>{content.headline}</Block.Headline>
        <Block.Body>{content.body}</Block.Body>
        {content.points?.length
          ? (
              <ul className="flex flex-col gap-2">
                {content.points.map(point => (
                  <li key={point} className="flex items-center gap-2 text-[14.5px]" style={POINT_TEXT_STYLE}>
                    <span className="size-[6px] shrink-0 rotate-45 rounded-[1px]" style={POINT_DOT_STYLE} />
                    {point}
                  </li>
                ))}
              </ul>
            )
          : null}
        <Block.Trust><CredentialStrip /></Block.Trust>
        <Block.Actions>
          <button type="button" className="bg-foreground text-card inline-flex items-center gap-2.5 rounded-[3px] px-6 py-3.5 text-[14.5px] font-bold">
            {content.ctaLabel ?? 'See what you qualify for'}
            <ArrowRight className="size-4" style={ARROW_STYLE} />
          </button>
        </Block.Actions>
      </Block.Content>
      <Block.Media side="right" overlay={<Decor shape="arc" placement="cover" />}>
        <Image src={image.src} alt={image.alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 50vw" />
      </Block.Media>
    </Block>
  )
}
```

- [ ] **Step 3: Give the live callout an image**

In `src/shared/domains/funnels/constants/kitchens.ts`, find the `callout` block content and add an `image` (use an existing asset, e.g. the hero's): `image: { src: '/portfolio-photos/modern-kitchen-1.jpeg', alt: 'Remodeled Showcase kitchen' }`. (If the callout content omits it, the block falls back to `DEFAULT_IMAGE` — so this step is optional polish; do it for an explicit, swappable source.)

- [ ] **Step 4: Typecheck + lint + anti-drift grep**

Run: `pnpm tsc` → clean. `pnpm lint` → clean.
Run: `grep -nE "max-w-|font-mono|mt-\[|gap-\[" src/shared/domains/funnels/ui/blocks/callout-block.tsx`
Expected: no matches except none (the `gap-2` on the points list is a plain utility, not `gap-[`; allowed). No `max-w-`, no `font-mono`, no `mt-[`.

- [ ] **Step 5: Visual gate**

`/test` and `kitchens.localhost:3000`: callout now has the photo filling the right edge-to-edge with decor riding it; left/right edges align with the FAQ and other blocks; credentials single filled left row; no mobile horizontal scroll. Compare against the §Verification checklist in the spec.

- [ ] **Step 6: Commit**

```bash
git commit src/shared/domains/funnels/types.ts src/shared/domains/funnels/ui/blocks/callout-block.tsx src/shared/domains/funnels/constants/kitchens.ts -m "refactor(funnel): migrate callout onto <Block>

Canonical media block: content column + full-bleed photo + decor overlay.
Adds optional CalloutBlockContent.image. Deletes the bespoke panel/rhythm.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Migration tasks 9–18 — shared procedure

Each remaining block follows the SAME transform. For task N below:

1. **Read** the current block file in `src/shared/domains/funnels/ui/blocks/` to capture its exact inner markup (grids, cards, accordion, icons, data sourcing).
2. **Wrap** it in `<Block>` with the variants from the spec's per-block map.
3. **Move** the headline → `<Block.Headline>`, any intro/subtitle prose → `<Block.Body>`, any credential row → `<Block.Trust>`, any single CTA → `<Block.Actions>`.
4. **Preserve** the block-specific body (grid/accordion/cards/icons) VERBATIM as freeform children of `<Block.Content>` — do not redesign it.
5. **Delete** the shell-owned wrappers: the outer `<section>` classes (width, surface, `py-10`, `text-center`, `bg-*`, `rounded-*`, `border`, `shadow-*`), and the inter-zone vertical spacing (`gap-6`/`gap-8`/`pt-8` between sibling zones) — that rhythm is now `--block-gap`. Keep intra-grid gaps (`gap-3`/`gap-4` inside a card grid).
6. **Keep** `'use client'` only where the original had it (faq, cta, portfolio); those compose the RSC-safe `<Block>` legally.
7. **Verify:** `pnpm tsc` clean; `pnpm lint` clean; `grep -nE "max-w-|font-mono|mt-\[|gap-\[" <file>` shows nothing shell-owned left; visual gate per the spec checklist; then commit that one file (+ its content-type/constants edits if any) via pathspec.

The per-task rows give the variant + the specific deletions.

### Task 9: `value`
**File:** `src/shared/domains/funnels/ui/blocks/value-block.tsx`
- Variant: `<Block surface="card" align="center">` (no media).
- Slots: `Block.Headline` (headline), `Block.Body` (intro). Freeform children: ROI stat block, before/after image grid, comparison list — kept verbatim.
- Delete: section `flex flex-col gap-6 py-10`; the header `items-center text-center` wrapper (alignment now from Block `align="center"`); any `max-w-2xl` on intro → rely on `Block.Body`'s `max-w-[48ch]` (if the intro needs wider, keep a local `max-w-2xl` ONLY on that paragraph and note it — but prefer `Block.Body`). The three sub-zones become direct freeform children separated by `--block-gap` (remove their own top margins).

### Task 10: `problem`
**File:** `src/shared/domains/funnels/ui/blocks/problem-block.tsx`
- Variant: `<Block surface="plain" align="center">` (no media).
- Slots: `Block.Headline`, `Block.Body` (optional body). Freeform children: the `asGallery` branch (poster `<figure>` grid OR text-card grid) preserved verbatim, and the optional `standardLine` footer as a final freeform zone (keep its `border-t`, delete its `pt-8` — spacing from `--block-gap`).
- Delete: section `flex flex-col gap-8 py-10`; the `items-center text-center` header wrapper.

### Task 11: `guarantee`
**File:** `src/shared/domains/funnels/ui/blocks/guarantee-block.tsx`
- Variant: `<Block surface="card" align="center">` (no media).
- Slots: `Block.Headline`, `Block.Body`. Freeform children: the `ShieldCheck` icon badge (above headline — place it as the first freeform child OR before the headline inside Content), the optional scarcity pill (last freeform child).
- Delete: the section-as-card classes `border-border bg-card ... rounded-lg border ... shadow-sm` and `gap-4 px-6 py-10 text-center` (all now from `surface="card"` + `align="center"` + tokens).

### Task 12: `licensing`
**File:** `src/shared/domains/funnels/ui/blocks/licensing-block.tsx`
- Variant: `<Block surface="muted" align="center">` (no media).
- Slots: `Block.Headline` (title, default `'Licensed, Bonded & Insured'`). Credential row → `<Block.Trust>` (note: Trust forces left; for THIS block the credentials are the centerpiece of a centered block, so DO NOT use `Block.Trust` here — instead keep the credential row as a centered freeform child so it honors `align="center"`). Keep the company-constants sourcing.
- Delete: `bg-muted/30 ... rounded-lg px-6 py-10 text-center gap-3` (now from `surface="muted"` + tokens).

### Task 13: `faq`
**File:** `src/shared/domains/funnels/ui/blocks/faq-block.tsx` (stays `'use client'`)
- Variant: `<Block surface="plain" align="center">`; render `<Decor shape="square" />` (corner, default) as the FIRST child of the Block Root (not inside Content) so it clips to the block.
- Slots: `Block.Headline` (title). Freeform child: the accordion list — **remove its `mx-auto max-w-140`** so it fills the rail (width parity with callout). Keep the per-item motion/markup verbatim.
- Delete: section `bg-background relative isolate w-full overflow-hidden py-10` (Block owns isolate/overflow/surface/padding); the title's own `text-center` and tight placement (gap now `--block-gap`).

### Task 14: `process`
**File:** `src/shared/domains/funnels/ui/blocks/process-block.tsx`
- Variant: `<Block surface="plain" align="center">`.
- Slots: `Block.Headline` (title). Freeform child: the `<ol>` step grid (1→2→4 cols) with per-step images/cards preserved verbatim.
- Delete: section `flex flex-col gap-6 py-10`; the title `text-center`.

### Task 15: `reviews`
**File:** `src/shared/domains/funnels/ui/blocks/reviews-block.tsx`
- Variant: `<Block surface="plain" align="center">`.
- Slots: `Block.Headline` (label). Freeform child: the `<ReviewCard>` grid (constants-sourced) verbatim.
- Delete: section `flex flex-col items-center gap-6 py-10`; the title `text-center`.

### Task 16: `testimonials`
**File:** `src/shared/domains/funnels/ui/blocks/testimonials-block.tsx`
- Variant: `<Block surface="plain" align="center">`.
- Slots: `Block.Headline` (title). Freeform child: the testimonial `<figure>` card grid (content-overridable, constants fallback) verbatim.
- Delete: section `flex flex-col gap-6 py-10`; the title `text-center`.

### Task 17: `cta`
**File:** `src/shared/domains/funnels/ui/blocks/cta-block.tsx` (stays `'use client'`)
- Variant: `<Block surface="plain" align="center" size="compact">`.
- Slots: `Block.Actions` only (the `<Button>` with the scroll handler) — alignment follows `align="center"`.
- Delete: section `flex flex-col items-center py-6` (now `size="compact"` + `align="center"`).

### Task 18: `portfolio`
**File:** `src/shared/domains/funnels/ui/blocks/portfolio-block.tsx` (stays `'use client'`; uses tRPC + `ctx.slug`)
- Variant: `<Block surface="plain" align="center">`.
- Slots: `Block.Headline` (title), `Block.Body` (subtitle). Freeform children: the skeleton/loaded bento grid, fallbacks — verbatim. Keep `ctx.slug` trade filtering and the `useQuery` calls.
- Delete: section `flex flex-col gap-6 py-10`; the title/subtitle `text-center`.

---

## Final whole-branch review

After Task 18: dispatch the whole-branch code review (superpowers:requesting-code-review) over the full diff range. Then a final visual sweep of `kitchens.localhost:3000` top to bottom against the spec's §Verification per-block checklist (edge alignment, decor clipped+prominent, credentials filled, fonts Syne/Nunito, single accent, 360px no-scroll). Address Critical/Important findings with one fix subagent.

---

## Self-Review (author's check against the spec)

- **Spec coverage:** Decor `cover` (Task 1) ✓; tokens incl. responsive pad + 6px radius reuse (Task 2) ✓; cva variants incl. media-needs-padding compound variants + align descendant selectors (Task 3) ✓; RSC-safe Root + asChild (Task 4) ✓; slots incl. Trust left carve-out + Syne headline + Nunito body/eyebrow (Task 5) ✓; full-bleed recipe + mobile banner + overlay (Task 6) ✓; assembly + flat exports + RSC grep + /test proof (Task 7) ✓; callout proof incl. `points` rendering + image field (Task 8) ✓; all 11 blocks mapped (Tasks 8–18) ✓; anti-drift grep + visual gate every task ✓; font no-mono + lone-accent + clean shadow in Global Constraints ✓.
- **Placeholder scan:** migration tasks 9–18 reference "the existing inner markup" deliberately (the implementer reads each file in step 1 of the shared procedure) and give concrete variant + deletion lists — not placeholders.
- **Type consistency:** `Block` slot names (`Content/Eyebrow/Headline/Body/Media/Trust/Actions`) are identical across Tasks 5, 7, 8. `BlockMedia` prop `side` matches `align`/`media` usage. `CalloutBlockContent.image` added in Task 8 and consumed in the same task. `placement` prop on `Decor` defined Task 1, used Tasks 7–8.
- **Known divergences flagged to the user (not resolved here):** hero headline uses Playfair (`font-serif`) vs Block/callout Syne (`font-sans`); `licensing` uses centered credentials (NOT `Block.Trust`) because there the credentials are the centerpiece of a centered block.
