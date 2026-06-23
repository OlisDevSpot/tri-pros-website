# Funnel Token Standardization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hardcoded type/leading/tracking/measure/divider literal in the funnel `<Block>` slots and its 11 blocks with funnel-scoped CSS-var tokens, make `Block.Body` polymorphic, and add a tokenized `Block.Divider` slot.

**Architecture:** New CSS custom properties in the existing `.theme-marketing, .funnel-light` scope in globals.css; slots consume them via Tailwind arbitrary utilities (`text-[length:var(--fs-headline)]`). `Block.Body` and the new `Block.Divider` gain `asChild` polymorphism via `@radix-ui/react-slot`. Consuming blocks drop their ad-hoc utilities.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4 (`@theme inline` + scoped CSS vars), `@radix-ui/react-slot`, motion/react, pnpm.

**Spec:** `docs/superpowers/specs/2026-06-22-funnel-token-standardization-design.md`

## Global Constraints

- **No unit-test runner exists.** Verification per task = `pnpm tsc` + `pnpm lint` + the anti-drift grep + visual. NEVER run `pnpm build`.
- **Work on `main`. No new branch.** Commit per-file/per-task with pathspec (`git commit <path> -m …`), never `git add -A` / bare commit (a concurrent session has unrelated WIP). New (untracked) files: `git add <exact path>` then `git commit <exact path>`.
- **Visual verification is on `kitchens.localhost:3000`** (top-to-bottom). `/test` is now a ShowcaseHero preview and does NOT render the Block proof — do not rely on it.
- **Tokens are the single source of truth.** After this work, no raw `max-w-[`, `text-[` (except `length:var`/`color:var`), `leading-[`, `tracking-[`, `font-mono`, `mt-[`, or inter-zone `gap-[` remain in `src/shared/domains/funnels/ui/block/` or `…/ui/blocks/`. Non-bracket grid gaps (`gap-4`) and grid sizing (`auto-rows-[140px]`) are allowed.
- **RSC purity:** every file in `…/ui/block/` must contain no real `'use client'` directive and import no client component. `@radix-ui/react-slot`'s `Slot` is RSC-safe (already used by `block-media.tsx`).
- **Fonts:** Headline `font-sans` (Syne); Body/Eyebrow inherit Nunito; **never `font-mono`**.
- **Color:** sole accent `#03AFED` (`--primary`/`--accent-ink`); surfaces from the neutral ramp only. Radius `rounded-md` (6px); no 8px+.
- **Tailwind arbitrary calc needs underscores for spaces:** write `mt-[calc(var(--block-gap-kicker)_-_var(--block-gap))]` (Tailwind converts `_`→space; CSS calc requires whitespace around `-`).

## Anti-drift grep (used in every task's verification)

```bash
grep -rnP '(max-w-\[(?!var)|text-\[(?!length:var|color:var)|leading-\[(?!var)|tracking-\[(?!var)|font-mono|mt-\[|\bgap-\[)' \
  src/shared/domains/funnels/ui/block src/shared/domains/funnels/ui/blocks
```
Expected after the full plan: no output. (`grep -P` for the negative lookaheads. A match in a JSDoc comment — e.g. the literal text "max-w-[48ch]" in a comment — is acceptable; judge hits in code only.)

## File Structure

- `src/app/(frontend)/globals.css` — add the token set (Task 1).
- `src/shared/domains/funnels/ui/block/block-headline.tsx` — tokenized (Task 2).
- `src/shared/domains/funnels/ui/block/block-eyebrow.tsx` — tokenized (Task 2).
- `src/shared/domains/funnels/ui/block/block-content.tsx` — tokenized kicker (Task 2).
- `src/shared/domains/funnels/ui/block/block-body.tsx` — polymorphic + tokenized (Task 3).
- `src/shared/domains/funnels/ui/block/block-divider.tsx` — NEW slot (Task 4).
- `src/shared/domains/funnels/ui/block/block.tsx` — register `Block.Divider` (Task 4).
- `src/shared/domains/funnels/ui/blocks/problem-block.tsx` — use `Block.Divider`, tokenize label (Task 5).
- `src/shared/domains/funnels/ui/blocks/value-block.tsx` — `--fs-display`, drop `text-balance` (Task 5).
- `src/shared/components/trust/credential-strip.tsx` — adopt `--block-divider-pad` (Task 5).
- All `…/ui/blocks/*.tsx` — final straggler sweep (Task 6).

---

## Task 1: Add the token set to globals.css

**Files:**
- Modify: `src/app/(frontend)/globals.css` (the `--block-*` group ~line 144-148, and the `@media (min-width: 640px)` block ~line 153-158)

**Interfaces:**
- Produces: CSS vars `--fs-headline`, `--lh-headline`, `--tracking-headline`, `--fs-body`, `--lh-body`, `--fs-eyebrow`, `--tracking-eyebrow`, `--measure-prose`, `--block-gap-kicker`, `--block-divider-pad`, `--fs-display`, scoped to `.theme-marketing, .funnel-light`.

- [ ] **Step 1: Add the mobile token declarations.** In `globals.css`, immediately after the existing `--block-media-min-h: 22rem;` line (inside `.theme-marketing, .funnel-light`), add:

```css
  /* funnel type scale (see funnel/ui/block/ slots) */
  --fs-headline: 1.5rem; /* mobile; ≥640 below */
  --lh-headline: 1.15;
  --tracking-headline: -0.01em;
  --fs-body: 0.95rem;
  --lh-body: 1.65;
  --fs-eyebrow: 0.72rem;
  --tracking-eyebrow: 0.2em;
  --fs-display: 2.25rem; /* prominent block numbers (e.g. ROI stat) */
  --measure-prose: 60ch; /* lead/body readable measure */
  --block-gap-kicker: 0.5rem; /* eyebrow→headline tight rhythm */
  --block-divider-pad: 2rem; /* rule→content breathing inside a divided zone */
```

- [ ] **Step 2: Add the ≥640 headline override.** Inside the existing `@media (min-width: 640px) { .theme-marketing, .funnel-light { … } }` block (which already overrides `--block-pad`), add:

```css
    --fs-headline: 1.75rem;
```

- [ ] **Step 3: Verify tsc + lint.**

Run: `pnpm tsc 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3`
Expected: tsc clean; no new lint errors. (Tokens are not consumed yet, so no visual change.)

- [ ] **Step 4: Commit.**

```bash
git commit "src/app/(frontend)/globals.css" -m "feat(funnel): add type/measure/divider tokens to marketing theme

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Tokenize the static slots (Headline, Eyebrow, Content kicker)

**Files:**
- Modify: `src/shared/domains/funnels/ui/block/block-headline.tsx` (full file)
- Modify: `src/shared/domains/funnels/ui/block/block-eyebrow.tsx` (full file)
- Modify: `src/shared/domains/funnels/ui/block/block-content.tsx` (full file)

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: unchanged component signatures (`BlockHeadline`/`BlockEyebrow`/`BlockContent` as `ComponentProps<'h2'|'p'|'div'>`).

These are pure literal→token substitutions; the token values equal the old literals, so the rendered result is identical (headline 1.5/1.75rem == text-2xl/sm:text-[28px]; eyebrow 0.72rem ≈ 11.5px; kicker calc == -mt-4).

- [ ] **Step 1: Rewrite `block-headline.tsx`.**

```tsx
import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

/** Section headline. font-sans = Syne (display). Type from funnel tokens. */
export function BlockHeadline({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="block-headline"
      className={cn('text-foreground font-sans text-balance font-bold text-[length:var(--fs-headline)] leading-[var(--lh-headline)] tracking-[var(--tracking-headline)]', className)}
      {...props}
    />
  )
}
```

- [ ] **Step 2: Rewrite `block-eyebrow.tsx`.**

```tsx
import type { ComponentProps, CSSProperties } from 'react'

import { cn } from '@/shared/lib/utils'

const EYEBROW_STYLE: CSSProperties = { color: 'var(--accent-ink)' }

/** Small uppercase accent label. Inherits Nunito (body font) — never font-mono. */
export function BlockEyebrow({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="block-eyebrow" className={cn('font-bold uppercase text-[length:var(--fs-eyebrow)] tracking-[var(--tracking-eyebrow)]', className)} style={EYEBROW_STYLE} {...props} />
}
```

- [ ] **Step 3: Rewrite `block-content.tsx`** (kicker becomes token-driven; note the underscores in the calc):

```tsx
import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

/**
 * Non-media column. flex-col; inter-child rhythm = --block-gap. align-items set
 * by Root's align. The eyebrow is a kicker: when a headline directly follows it,
 * the gap is pulled tight to --block-gap-kicker so the label hugs its headline.
 */
export function BlockContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="block-content" className={cn('flex flex-col gap-[var(--block-gap)] [&>[data-slot=block-eyebrow]+[data-slot=block-headline]]:mt-[calc(var(--block-gap-kicker)_-_var(--block-gap))]', className)} {...props} />
}
```

- [ ] **Step 4: Verify.**

Run: `pnpm tsc 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3`
Expected: clean. Visual on `kitchens.localhost:3000`: headlines, eyebrows, and eyebrow→headline spacing look identical to before (token values == old literals).

- [ ] **Step 5: Commit.**

```bash
git commit src/shared/domains/funnels/ui/block/block-headline.tsx src/shared/domains/funnels/ui/block/block-eyebrow.tsx src/shared/domains/funnels/ui/block/block-content.tsx -m "refactor(funnel): tokenize headline/eyebrow type + content kicker

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Polymorphic + tokenized Block.Body

**Files:**
- Modify: `src/shared/domains/funnels/ui/block/block-body.tsx` (full file)

**Interfaces:**
- Consumes: `--measure-prose`, `--fs-body`, `--lh-body`, `--body-text`; `Slot` from `@radix-ui/react-slot`.
- Produces: `BlockBody({ asChild?: boolean } & ComponentProps<'p'>)`. Default renders `<p>`; `asChild` renders the single child element with the body preset merged on (child classes win).

This CHANGES the body visually: measure widens 48ch→`--measure-prose` (60ch) and size 14.5px→`--fs-body` (0.95rem) — the deliberate "breathing" fix for centered intros.

- [ ] **Step 1: Rewrite `block-body.tsx`.**

```tsx
import type { ComponentProps, CSSProperties } from 'react'

import { Slot } from '@radix-ui/react-slot'

import { cn } from '@/shared/lib/utils'

const BODY_STYLE: CSSProperties = { color: 'var(--body-text)' }

interface BlockBodyProps extends ComponentProps<'p'> {
  asChild?: boolean
}

/**
 * Lead/prose region. Polymorphic: default renders a <p> with the prose preset
 * (measure + size + leading + body color, all token-driven); `asChild` renders
 * the consumer's element with the preset merged on (the child's own classes win,
 * so a stat/rating/media lead overrides size/color/width). Measure is the ONLY
 * width cap in the system (Root/Content never set max-w).
 */
export function BlockBody({ asChild, className, ...props }: BlockBodyProps) {
  const Comp = asChild ? Slot : 'p'
  return <Comp data-slot="block-body" className={cn('text-pretty max-w-[var(--measure-prose)] text-[length:var(--fs-body)] leading-[var(--lh-body)]', className)} style={BODY_STYLE} {...props} />
}
```

- [ ] **Step 2: Verify.**

Run: `pnpm tsc 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3`
Expected: clean. Visual on `kitchens.localhost:3000`: the centered intro paragraphs (problem, value, portfolio subtitle) now breathe — wider measure, no longer a pinched column; the callout body (in its 52% card) is unchanged (the measure just fills the narrower card).

- [ ] **Step 3: Commit.**

```bash
git commit src/shared/domains/funnels/ui/block/block-body.tsx -m "feat(funnel): polymorphic + tokenized Block.Body (asChild, --measure-prose)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Block.Divider slot + register in Block

**Files:**
- Create: `src/shared/domains/funnels/ui/block/block-divider.tsx`
- Modify: `src/shared/domains/funnels/ui/block/block.tsx` (full file)

**Interfaces:**
- Consumes: `--block-divider-pad`; `Slot` from `@radix-ui/react-slot`.
- Produces: `BlockDivider({ asChild?: boolean } & ComponentProps<'div'>)` with `data-slot="block-divider"`; attached as `Block.Divider` and flat-exported as `BlockDivider`.

- [ ] **Step 1: Create `block-divider.tsx`** (minimal: rule + tokenized pad + full width; consumer adds any flex/centering layout):

```tsx
import type { ComponentProps } from 'react'

import { Slot } from '@radix-ui/react-slot'

import { cn } from '@/shared/lib/utils'

interface BlockDividerProps extends ComponentProps<'div'> {
  asChild?: boolean
}

/**
 * A Block.Content child that introduces a zone with a top rule. The rule→content
 * breathing room is --block-divider-pad (intra-zone — --block-gap only spaces the
 * zone from its sibling ABOVE the rule, it can't reach inside). The single divider
 * treatment for the whole funnel. Polymorphic via asChild; consumers add layout
 * (flex/centering) through className.
 */
export function BlockDivider({ asChild, className, ...props }: BlockDividerProps) {
  const Comp = asChild ? Slot : 'div'
  return <Comp data-slot="block-divider" className={cn('border-border w-full border-t pt-[var(--block-divider-pad)]', className)} {...props} />
}
```

- [ ] **Step 2: Rewrite `block.tsx`** to register the slot (import alphabetical after `block-content`; `Divider` added to the namespace; flat export alphabetical after `BlockContent`):

```tsx
import { BlockActions } from '@/shared/domains/funnels/ui/block/block-actions'
import { BlockBody } from '@/shared/domains/funnels/ui/block/block-body'
import { BlockContent } from '@/shared/domains/funnels/ui/block/block-content'
import { BlockDivider } from '@/shared/domains/funnels/ui/block/block-divider'
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
  Divider: BlockDivider,
  Eyebrow: BlockEyebrow,
  Headline: BlockHeadline,
  Body: BlockBody,
  Media: BlockMedia,
  Trust: BlockTrust,
  Actions: BlockActions,
})

export { BlockActions, BlockBody, BlockContent, BlockDivider, BlockEyebrow, BlockHeadline, BlockMedia, BlockRoot, BlockTrust }
```

- [ ] **Step 3: Verify (incl. RSC purity).**

Run: `pnpm tsc 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3 && grep -rn "use client" src/shared/domains/funnels/ui/block/*.tsx`
Expected: tsc/lint clean; the only `use client` hits are JSDoc comment text in `block.tsx`/`block-root.tsx` (not directives). No visual change yet (slot unused).

- [ ] **Step 4: Commit.**

```bash
git add src/shared/domains/funnels/ui/block/block-divider.tsx
git commit src/shared/domains/funnels/ui/block/block-divider.tsx src/shared/domains/funnels/ui/block/block.tsx -m "feat(funnel): add tokenized Block.Divider slot

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Consume Divider + tokenize the known ad-hoc consumers

**Files:**
- Modify: `src/shared/domains/funnels/ui/blocks/problem-block.tsx` (the `standardLine` footer + its label)
- Modify: `src/shared/domains/funnels/ui/blocks/value-block.tsx` (the ROI stat)
- Modify: `src/shared/components/trust/credential-strip.tsx` (the divider pad)

**Interfaces:**
- Consumes: `Block.Divider`, `Block.Eyebrow`, `--fs-display`, `--block-divider-pad`.

- [ ] **Step 1: problem `standardLine` → `Block.Divider` + `Block.Eyebrow` label.** In `problem-block.tsx`, replace the `content.standardLine` block with (the divider supplies the rule + `--block-divider-pad` breathing room; the label becomes a tokenized eyebrow; the statement stays `Block.Body`):

```tsx
        {content.standardLine
          ? (
              <Block.Divider className="flex flex-col items-center gap-3 text-center">
                <Block.Eyebrow className="text-primary inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                  The standard
                </Block.Eyebrow>
                <Block.Body>{content.standardLine}</Block.Body>
              </Block.Divider>
            )
          : null}
```

Note: this overrides the eyebrow's default `--accent-ink` color with `text-primary` to match the original label intent; the `tracking-[0.18em]` literal is dropped in favor of the eyebrow token (`0.2em`).

- [ ] **Step 2: value ROI stat → `--fs-display`.** In `value-block.tsx`, change the ROI value span from `text-4xl` to the display token:

```tsx
                <span className="text-primary font-bold tabular-nums text-[length:var(--fs-display)]">{content.roiStat.value}</span>
```

(The `text-balance` on the value intro is already removed in Task 3's slot default — confirm none remains; if a literal `text-balance` is still on the `<Block.Body>` call, delete it.)

- [ ] **Step 3: CredentialStrip adopts the divider pad token.** In `credential-strip.tsx`, change `pt-4` to the token (it already depends on funnel-scoped `--cred-gap`/`--cred-ink`, so scope is consistent):

```tsx
    <div className={cn('flex flex-wrap items-center border-t pt-[var(--block-divider-pad)]', className)} style={{ columnGap: 'var(--cred-gap)', rowGap: '10px' }}>
```

- [ ] **Step 4: Verify.**

Run: `pnpm tsc 2>&1 | tail -3 && pnpm lint 2>&1 | tail -3`
then the anti-drift grep over `problem-block.tsx`, `value-block.tsx`:
`grep -nP '(max-w-\[(?!var)|text-\[(?!length:var|color:var)|leading-\[(?!var)|tracking-\[(?!var)|font-mono|mt-\[|\bgap-\[)' src/shared/domains/funnels/ui/blocks/problem-block.tsx src/shared/domains/funnels/ui/blocks/value-block.tsx`
Expected: tsc/lint clean; grep empty. Visual on `kitchens.localhost:3000`: "THE STANDARD" now has clear space below the rule; the ROI stat renders at the display size; credential strip spacing unchanged or slightly more generous.

- [ ] **Step 5: Commit.**

```bash
git commit src/shared/domains/funnels/ui/blocks/problem-block.tsx src/shared/domains/funnels/ui/blocks/value-block.tsx src/shared/components/trust/credential-strip.tsx -m "refactor(funnel): use Block.Divider + display/divider tokens; fix divider breathing

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Final straggler sweep + visual gate

**Files:**
- Modify: any `src/shared/domains/funnels/ui/blocks/*.tsx` or `…/ui/block/*.tsx` still flagged by the grep.

**Interfaces:** none new — this is cleanup + verification.

- [ ] **Step 1: Run the full anti-drift grep over both dirs.**

Run:
```bash
grep -rnP '(max-w-\[(?!var)|text-\[(?!length:var|color:var)|leading-\[(?!var)|tracking-\[(?!var)|font-mono|mt-\[|\bgap-\[)' \
  src/shared/domains/funnels/ui/block src/shared/domains/funnels/ui/blocks
```
Expected: no output. For any hit in CODE (not a JSDoc comment), replace the literal with the matching token from Task 1 (e.g. a stray `leading-relaxed`/`text-base sm:text-lg`/`max-w-*`). Headline/body/eyebrow type belongs on the respective slot, not re-declared on a block. If a hit is genuinely block-specific and has no token (rare), STOP and raise it rather than inventing a token silently.

- [ ] **Step 2: Confirm RSC purity + no font-mono anywhere.**

Run: `grep -rn "use client" src/shared/domains/funnels/ui/block/*.tsx` (expect only JSDoc text) and `grep -rn "font-mono" src/shared/domains/funnels/ui/block src/shared/domains/funnels/ui/blocks` (expect nothing).

- [ ] **Step 3: Full verify.**

Run: `pnpm tsc 2>&1 | tail -3 && pnpm lint 2>&1 | tail -5`
Expected: tsc clean; only pre-existing repo warnings.

- [ ] **Step 4: Commit any sweep edits** (only if Step 1 changed files):

```bash
git commit <each changed path> -m "refactor(funnel): sweep residual ad-hoc type literals to tokens

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Visual gate.** Walk `kitchens.localhost:3000` top-to-bottom on mobile (375px) + desktop. Confirm: one consistent type scale across all blocks; divider has breathing room above its label; centered intro breathes; no horizontal scroll; single blue accent; no regressions. Report findings for user sign-off.

---

## Final whole-branch review

After Task 6: dispatch the whole-branch code review (superpowers:requesting-code-review) over the feature range (`git merge-base`-style from the commit before Task 1 to HEAD), then the user's visual gate. Address Critical/Important findings with one fix subagent.

---

## Self-Review (author's check against the spec)

- **Spec coverage:** token mechanism + scoped vars (Task 1) ✓; full token set incl. responsive headline (Task 1) ✓; tokenized headline/eyebrow/content-kicker (Task 2) ✓; polymorphic+tokenized Body w/ asChild + measure (Task 3) ✓; Block.Divider slot + registration (Task 4) ✓; divider consumption + credential-strip unification + display-stat token + divider breathing fix (Task 5) ✓; per-block ad-hoc sweep + extended anti-drift grep + RSC/font checks (Task 6) ✓; verification = tsc+lint+grep+visual on kitchens.localhost, never /test, never build ✓; work-on-main pathspec ✓.
- **Placeholder scan:** every code step contains complete file/snippet content; no TBD/"similar to". The Task 6 sweep is grep-driven with an explicit "STOP and raise" escape rather than a vague "fix the rest".
- **Type consistency:** `asChild` prop shape identical in Body (Task 3) and Divider (Task 4); `data-slot` names (`block-body`, `block-divider`, `block-eyebrow`, `block-headline`) consistent across slots and the Content kicker selector; token names identical between Task 1 declarations and Tasks 2/3/4/5 consumers; `Block.Divider`/`Block.Eyebrow`/`Block.Body` usage in Task 5 matches the registration in Task 4 and existing slots.
