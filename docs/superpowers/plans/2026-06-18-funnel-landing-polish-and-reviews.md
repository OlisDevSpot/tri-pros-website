# Funnel Landing Polish & Reviews Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the funnel landing into a credible, mobile-first, light-mode trust surface with motion, a reusable reviews UI, an editorial bento media layout, and a fixed back-navigation path.

**Architecture:** Scoped light theme via a `.funnel-light` CSS-variable override (rest of site untouched). New reusable reviews primitives in `src/shared/components/reviews/` composed by the funnel `ReviewsBlock`. Motion via `motion/react` (staggered cards + landing entrance fade-up), all reduced-motion-gated. Nav dead-end fixed by a `Continue` affordance on the answered Q1 card plus a scroll-to-Q1-on-Back behavior.

**Tech Stack:** Next.js 15, React 19, TypeScript (strict), motion/react v12, Tailwind v4, shadcn/ui, lucide-react, react-icons (brand icons), next/image.

> **No unit-test runner exists in this repo** (only Playwright; zero `*.test.*` files). Per project convention (CLAUDE.md: "run lint/typecheck before marking complete"), each task's hard gate is `pnpm tsc` (0 errors) + `pnpm lint` (0 errors). Visual behavior is verified by a documented browser-smoke pass at integration (controller-run). Do NOT add a test framework — that would violate "follow existing patterns."

## Global Constraints

- Scoped LIGHT mode only; rest of site (hard `<html class="dark">`) untouched. Funnel components must NOT use `dark:` utilities — rely on semantic tokens.
- Stars are **yellow** (`fill-yellow-500 text-yellow-500`), never `primary`/blue.
- Primary color reserved for the **single forward CTA**; inter-block re-entry CTAs are `variant="outline"`. No primary on 3+ things.
- All company data derives from `src/shared/constants/company/` — never hardcode in components.
- Motion: reuse `FUNNEL_TRANSITION` (`{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }`); stagger 0.05s/item; transform/opacity only; every animation gated on `useReducedMotion()`.
- Conventions: ONE component per file; named exports only; no file-level constants/helpers in component files (extract to `constants/`/`lib/`); no barrels in `ui/`,`constants/`,`lib/`; `shared/` never imports `features/`.
- Lint: `perfectionist/sort-imports` + `sort-named-imports` (run `pnpm lint:fix` to auto-sort); `antfu/if-newline` (braces+newline); `import/no-duplicates`.
- `pnpm tsc` + `pnpm lint` must pass. NEVER `pnpm build`. NEVER `pnpm db:push` (prod).
- Commits: pathspec only (`git commit -m "…" -- <paths>`; `git add <path>` first for new files; never `git add -A`). Trailer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

### Task 1: Scoped light mode

**Files:**
- Modify: `src/app/(frontend)/globals.css` (the `:root {` selector ~line 6, and add a `.funnel-light` color-scheme rule)
- Modify: `src/app/(frontend)/funnels/layout.tsx`

**Interfaces:**
- Produces: a `.funnel-light` wrapper class that renders the funnel subtree in light tokens regardless of the app-wide `<html class="dark">`.

- [ ] **Step 1: Extend the light-token selector**

In `src/app/(frontend)/globals.css`, change the opening of the light-token block from:

```css
:root {
  --background: oklch(0.9846 0.0017 247.8389);
```

to (add `.funnel-light` to the same selector — reuses the identical light values, zero duplication):

```css
:root,
.funnel-light {
  --background: oklch(0.9846 0.0017 247.8389);
```

- [ ] **Step 2: Add the color-scheme rule**

Immediately AFTER the closing `}` of that `:root, .funnel-light { … }` block (before the `.dark {` block), add:

```css
.funnel-light {
  color-scheme: light;
}
```

- [ ] **Step 3: Tag the funnel layout wrapper**

Replace the body of `src/app/(frontend)/funnels/layout.tsx` so the wrapper div carries `funnel-light`:

```tsx
import type { ReactNode } from 'react'

export default function FunnelLayout({ children }: { children: ReactNode }) {
  return <div className="funnel-light min-h-dvh bg-background">{children}</div>
}
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc` → Expected: 0 errors.
Run: `pnpm lint` → Expected: 0 errors.

**Visual acceptance (integration):** `/funnels/kitchens` renders on a light background with dark text; the rest of the app stays dark.

- [ ] **Step 5: Commit**

```bash
git add src/app/\(frontend\)/globals.css src/app/\(frontend\)/funnels/layout.tsx
git commit -m "feat(funnels): scope funnel route to light mode via .funnel-light

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- "src/app/(frontend)/globals.css" "src/app/(frontend)/funnels/layout.tsx"
```

---

### Task 2: Reusable reviews primitives

**Files:**
- Create: `src/shared/components/reviews/star-rating.tsx`
- Create: `src/shared/components/reviews/platform-badge.tsx`
- Create: `src/shared/components/reviews/review-card.tsx`

**Interfaces:**
- Produces:
  - `StarRating({ rating: number, count?: number, size?: number, showValue?: boolean, className?: string })`
  - `PlatformBadge({ platform: string, href?: string, icon?: ReactNode, children: ReactNode, className?: string })`
  - `ReviewCard({ name: string, text: string, rating: number, location?: string, platform?: string, image?: string, className?: string })`

- [ ] **Step 1: Create `star-rating.tsx`**

```tsx
import { Star } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

interface StarRatingProps {
  rating: number
  count?: number
  size?: number
  showValue?: boolean
  className?: string
}

export function StarRating({ rating, count, size = 18, showValue = true, className }: StarRatingProps) {
  const full = Math.round(rating)
  const label = count != null
    ? `${rating.toFixed(1)} out of 5 stars from ${count} reviews`
    : `${rating.toFixed(1)} out of 5 stars`
  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      <div className="flex items-center gap-0.5" role="img" aria-label={label}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star
            key={i}
            size={size}
            aria-hidden="true"
            className={i < full ? 'fill-yellow-500 text-yellow-500' : 'fill-transparent text-muted-foreground/30'}
          />
        ))}
      </div>
      {showValue
        ? <span className="text-foreground text-sm font-semibold tabular-nums">{rating.toFixed(1)}</span>
        : null}
    </div>
  )
}
```

- [ ] **Step 2: Create `platform-badge.tsx`**

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface PlatformBadgeProps {
  platform: string
  href?: string
  icon?: ReactNode
  children: ReactNode
  className?: string
}

export function PlatformBadge({ platform, href, icon, children, className }: PlatformBadgeProps) {
  const base = 'border-border bg-card flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 shadow-sm'
  const inner = (
    <>
      {icon ? <span className="text-foreground shrink-0" aria-hidden="true">{icon}</span> : null}
      <span className="text-foreground text-sm font-semibold">{platform}</span>
      {children}
    </>
  )
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${platform} reviews (opens in a new tab)`}
        className={cn(base, 'hover:border-primary/50 transition-colors', className)}
      >
        {inner}
      </a>
    )
  }
  return <div className={cn(base, className)}>{inner}</div>
}
```

- [ ] **Step 3: Create `review-card.tsx`**

```tsx
import { BadgeCheck } from 'lucide-react'
import Image from 'next/image'
import { StarRating } from '@/shared/components/reviews/star-rating'
import { cn } from '@/shared/lib/utils'

interface ReviewCardProps {
  name: string
  text: string
  rating: number
  location?: string
  platform?: string
  image?: string
  className?: string
}

export function ReviewCard({ name, text, rating, location, platform, image, className }: ReviewCardProps) {
  const meta = [location, platform].filter(Boolean).join(' · ')
  return (
    <figure className={cn('border-border bg-card flex flex-col gap-3 rounded-2xl border p-5 shadow-sm', className)}>
      <StarRating rating={rating} size={16} showValue={false} />
      <blockquote className="text-foreground text-sm leading-relaxed">{text}</blockquote>
      <figcaption className="mt-auto flex items-center gap-3">
        {image
          ? <Image src={image} alt={name} width={40} height={40} className="size-10 rounded-full object-cover" />
          : null}
        <div className="min-w-0">
          <div className="text-foreground flex items-center gap-1 text-sm font-medium">
            {name}
            <BadgeCheck className="text-primary size-4 shrink-0" aria-label="Verified review" />
          </div>
          {meta ? <div className="text-muted-foreground text-xs">{meta}</div> : null}
        </div>
      </figcaption>
    </figure>
  )
}
```

- [ ] **Step 4: Verify**

Run: `pnpm tsc` → Expected: 0 errors.
Run: `pnpm lint` → Expected: 0 errors (run `pnpm lint:fix` first if import order flags).

- [ ] **Step 5: Commit**

```bash
git add src/shared/components/reviews/star-rating.tsx src/shared/components/reviews/platform-badge.tsx src/shared/components/reviews/review-card.tsx
git commit -m "feat(reviews): reusable StarRating, PlatformBadge, ReviewCard primitives

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/components/reviews/star-rating.tsx src/shared/components/reviews/platform-badge.tsx src/shared/components/reviews/review-card.tsx
```

---

### Task 3: ReviewsBlock rewrite (proof strip + curated cards)

**Files:**
- Modify (full rewrite): `src/shared/domains/funnels/ui/blocks/reviews-block.tsx`

**Interfaces:**
- Consumes: `StarRating`, `PlatformBadge`, `ReviewCard` (Task 2); `socials`, `stats`, `testimonials` from `@/shared/constants/company` (arrays — `socials`/`stats` items have `name`/`label`+`href`/`number`; `testimonials` items have `name,project,rating,text,image,location`).
- Component signature unchanged: `ReviewsBlock({ content: ReviewsBlockContent, ctx: FunnelContext })`.

- [ ] **Step 1: Rewrite `reviews-block.tsx`**

```tsx
import type { FunnelContext, ReviewsBlockContent } from '@/shared/domains/funnels/types'
import { FaGoogle, FaYelp } from 'react-icons/fa'
import { PlatformBadge } from '@/shared/components/reviews/platform-badge'
import { ReviewCard } from '@/shared/components/reviews/review-card'
import { StarRating } from '@/shared/components/reviews/star-rating'
import { socials, stats, testimonials } from '@/shared/constants/company'

export function ReviewsBlock({ content }: { content: ReviewsBlockContent, ctx: FunnelContext }) {
  const googleHref = socials.find(s => s.name === 'google')?.href
  const yelpHref = socials.find(s => s.name === 'yelp')?.href
  const bbb = stats.find(s => s.label === 'BBB Rating')

  return (
    <section className="flex flex-col items-center gap-8 py-10">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <PlatformBadge platform="Google" href={googleHref} icon={<FaGoogle className="size-4" />}>
          <StarRating rating={content.rating} count={content.count} size={14} />
        </PlatformBadge>
        <PlatformBadge platform="Yelp" href={yelpHref} icon={<FaYelp className="size-4" />}>
          <span className="text-muted-foreground text-sm">Verified</span>
        </PlatformBadge>
        <PlatformBadge platform="BBB">
          <span className="text-foreground text-sm font-semibold">{bbb?.number ?? 'A+'}</span>
        </PlatformBadge>
      </div>
      <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map(t => (
          <ReviewCard
            key={t.name}
            name={t.name}
            text={t.text}
            rating={t.rating}
            location={t.location}
            platform="Google"
            image={t.image}
          />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify**

Run: `pnpm tsc` → Expected: 0 errors.
Run: `pnpm lint` → Expected: 0 errors (`pnpm lint:fix` for import sort if needed).

**Visual acceptance (integration):** yellow stars; three badges (Google/Yelp link out in new tab, BBB shows "A+"); three review cards render.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(funnels): rebuild reviews block with platform proof + curated cards

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/blocks/reviews-block.tsx
```

---

### Task 4: Card-select redesign (centered, mobile-compact, staggered, Continue)

**Files:**
- Modify: `src/shared/domains/funnels/constants/funnel-motion.ts` (add stagger variants)
- Modify (full rewrite): `src/shared/domains/funnels/ui/steps/card-select-step.tsx`

**Interfaces:**
- Consumes: `FUNNEL_TRANSITION` (existing), `OPTION_ICONS` (existing), `Button` (shadcn), `StepProps<CardSelectStep>` (provides `isFirst`, `isAnswered`, `value`, `advance`, `setValue`).
- Produces: `CARD_STAGGER_CONTAINER`, `CARD_STAGGER_ITEM` (`Variants`) from funnel-motion.

- [ ] **Step 1: Add stagger variants to `funnel-motion.ts`**

Change the type import line to include `Variants`:

```ts
import type { TargetAndTransition, Transition, Variants } from 'motion/react'
```

Then append at the end of the file:

```ts
/**
 * Container + item variants for the card-select grid entrance. The container
 * orchestrates a 50ms stagger; each card fades up. Reuses FUNNEL_TRANSITION
 * easing. Engine gates these on useReducedMotion().
 */
export const CARD_STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.08 } },
}

export const CARD_STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: FUNNEL_TRANSITION },
}
```

- [ ] **Step 2: Rewrite `card-select-step.tsx`**

```tsx
import type { CardSelectStep, StepProps } from '@/shared/domains/funnels/types'
import { ArrowRight } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { Button } from '@/shared/components/ui/button'
import { CARD_STAGGER_CONTAINER, CARD_STAGGER_ITEM } from '@/shared/domains/funnels/constants/funnel-motion'
import { OPTION_ICONS } from '@/shared/domains/funnels/constants/option-assets'
import { cn } from '@/shared/lib/utils'

export function CardSelectStepView({ step, content, value, isAnswered, isFirst, setValue, advance }: StepProps<CardSelectStep>) {
  const reduceMotion = useReducedMotion()

  function handleSelect(optionId: string) {
    setValue(optionId)
    // Micro-commitment: a first answer advances immediately. On a revisit
    // (already answered, reached via Back) selecting only changes the value;
    // the Continue button (landing) or shell Next (focused) advances.
    if (!isAnswered) {
      advance()
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle
          ? <p className="text-muted-foreground mt-1">{content.subtitle}</p>
          : null}
      </div>
      <motion.div
        variants={reduceMotion ? undefined : CARD_STAGGER_CONTAINER}
        initial={reduceMotion ? false : 'hidden'}
        animate={reduceMotion ? false : 'visible'}
        className="grid grid-cols-2 gap-3 sm:gap-4"
      >
        {step.optionIds.map((optionId) => {
          const option = content.options[optionId]
          const selected = value === optionId
          const asset = option?.asset
          return (
            <motion.button
              key={optionId}
              type="button"
              variants={reduceMotion ? undefined : CARD_STAGGER_ITEM}
              whileTap={reduceMotion ? undefined : { scale: 0.97 }}
              onClick={() => handleSelect(optionId)}
              className={cn(
                'flex flex-col items-center overflow-hidden rounded-xl border-2 text-center transition-colors [touch-action:manipulation] hover:border-primary/60',
                selected ? 'border-primary bg-primary/5' : 'border-border',
              )}
            >
              {asset
                ? (
                    <div className="bg-muted/40 flex aspect-square w-full items-center justify-center sm:aspect-4/3">
                      {asset.kind === 'icon' && OPTION_ICONS[asset.name]
                        ? (() => {
                            const Icon = OPTION_ICONS[asset.name]
                            return <Icon className="text-primary size-12 sm:size-16" />
                          })()
                        : null}
                      {asset.kind === 'image'
                        ? <Image src={asset.src} alt={asset.alt} width={320} height={240} className="h-full w-full object-cover" />
                        : null}
                    </div>
                  )
                : null}
              <div className="flex flex-col items-center gap-1 p-3">
                <span className="block text-sm font-medium sm:text-base">{option?.label ?? optionId}</span>
                {option?.description
                  ? <span className="text-muted-foreground hidden text-sm sm:block">{option.description}</span>
                  : null}
              </div>
            </motion.button>
          )
        })}
      </motion.div>
      {isFirst && isAnswered
        ? (
            <Button size="lg" onClick={advance} className="self-center">
              Continue
              <ArrowRight className="size-4" />
            </Button>
          )
        : null}
    </div>
  )
}
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc` → Expected: 0 errors.
Run: `pnpm lint` → Expected: 0 errors (`pnpm lint:fix` for import sort).

**Visual acceptance (integration):** at 375px all 6 cards visible without scrolling, 2-up, icon+label centered, descriptions hidden on mobile; cards cascade in; tap scales; selected card shows primary border/tint. After Back, a centered **Continue** button appears and advances.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): center + mobile-size + stagger Q1 cards; add Continue affordance

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/constants/funnel-motion.ts src/shared/domains/funnels/ui/steps/card-select-step.tsx
```

---

### Task 5: Landing entrance + scroll-on-back + inter-block CTAs

**Files:**
- Modify: `src/shared/domains/funnels/ui/funnel-landing.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx`

**Interfaces:**
- Consumes: `FUNNEL_TRANSITION` (funnel-motion), `engine.value` (engine API) to decide scroll-on-mount.
- Produces: `FunnelLanding` gains a `scrollToQuestionOnMount?: boolean` prop.

- [ ] **Step 1: Rewrite `funnel-landing.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'
import type { FunnelContext, FunnelSpec, MarketingBlock } from '@/shared/domains/funnels/types'
import { ArrowUp } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Fragment, useEffect } from 'react'
import { Button } from '@/shared/components/ui/button'
import { DEFAULT_LANDING_BLOCKS } from '@/shared/domains/funnels/constants/default-landing-blocks'
import { FUNNEL_TRANSITION } from '@/shared/domains/funnels/constants/funnel-motion'
import { MARKETING_REGISTRY } from '@/shared/domains/funnels/constants/marketing-registry'
import { FunnelHero } from '@/shared/domains/funnels/ui/funnel-hero'

const QUESTION_ANCHOR = 'funnel-q1'

function scrollToQuestion() {
  document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function renderBlock(block: MarketingBlock, ctx: FunnelContext, index: number) {
  // Re-narrow per kind: the registry is typed per kind; indexing by the union
  // widens the lookup, so cast through the per-kind content like the step seam.
  const Block = MARKETING_REGISTRY[block.kind] as (props: { content: typeof block.content, ctx: FunnelContext }) => ReactNode
  return <Block content={block.content} ctx={ctx} />
}

export function FunnelLanding({ spec, ctx, children, scrollToQuestionOnMount }: {
  spec: FunnelSpec
  ctx: FunnelContext
  children: ReactNode
  scrollToQuestionOnMount?: boolean
}) {
  const reduceMotion = useReducedMotion()
  const blocks = spec.landing?.blocks ?? DEFAULT_LANDING_BLOCKS

  // On a Back-return to the landing (Q1 already answered) jump to the question
  // so the Continue affordance is visible instead of buried under the hero.
  useEffect(() => {
    if (scrollToQuestionOnMount) {
      document.getElementById(QUESTION_ANCHOR)?.scrollIntoView({ block: 'start' })
    }
  }, [scrollToQuestionOnMount])

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={FUNNEL_TRANSITION}
      className="flex w-full flex-col items-center gap-16 py-10"
    >
      <div className="flex w-full max-w-xl flex-col gap-8 px-5">
        <FunnelHero content={spec.hero} />
        <div id={QUESTION_ANCHOR} className="scroll-mt-6">{children}</div>
      </div>
      <div className="flex w-full max-w-5xl flex-col gap-12 px-5">
        {blocks.map((block, i) => (
          <Fragment key={`${block.kind}-${i}`}>
            {renderBlock(block, ctx, i)}
            {(i + 1) % 2 === 0 && i < blocks.length - 1
              ? (
                  <Button variant="outline" size="lg" onClick={scrollToQuestion} className="self-center">
                    <ArrowUp className="size-4" />
                    See if you qualify
                  </Button>
                )
              : null}
          </Fragment>
        ))}
      </div>
      <Button size="lg" onClick={scrollToQuestion}>Ready? See if you qualify ↑</Button>
    </motion.div>
  )
}
```

- [ ] **Step 2: Pass `scrollToQuestionOnMount` from the engine**

In `src/shared/domains/funnels/ui/funnel-engine.tsx`, update the landing branch to pass the prop (true when Q1 is already answered, i.e. a Back-return):

```tsx
  if (engine.isFirst) {
    return (
      <div data-funnel={spec.slug} className="min-h-dvh w-full">
        <FunnelLanding spec={spec} ctx={ctx} scrollToQuestionOnMount={engine.value != null}>{stepEl}</FunnelLanding>
      </div>
    )
  }
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc` → Expected: 0 errors.
Run: `pnpm lint` → Expected: 0 errors (`pnpm lint:fix` for import sort).

**Visual acceptance (integration):** the landing fades/slides up smoothly when returning from step 2 (no jarring hero pop); an outline "↑ See if you qualify" CTA appears after the 2nd block (and after the 4th if present) and smooth-scrolls to Q1; on Back the page lands at Q1 with Continue visible.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): landing entrance fade-up, scroll-to-Q1 on back, inter-block CTAs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/funnel-landing.tsx src/shared/domains/funnels/ui/funnel-engine.tsx
```

---

### Task 6: Editorial bento media + placeholder fallback

**Files:**
- Create: `src/shared/domains/funnels/constants/portfolio-fallback-images.ts`
- Modify (full rewrite): `src/shared/domains/funnels/ui/blocks/portfolio-block.tsx`

**Interfaces:**
- Consumes: `TRADE_BY_SLUG` (existing), `getOptimizedSrc` (existing), `PortfolioProject` type, tRPC `notionRouter.scopes.getAll` + `projectsRouter.showroomDisplay.getAll` (existing).
- Produces: `PORTFOLIO_FALLBACK_IMAGES`, `PORTFOLIO_SLOT_COUNT`, `PORTFOLIO_BENTO_SPANS`.

- [ ] **Step 1: Create `portfolio-fallback-images.ts`**

```ts
export interface FallbackImage { src: string, alt: string }

/** Public-folder construction photos used to pad thin trade coverage so the
 *  bento always reads full. Interim until real per-trade DB coverage exists. */
export const PORTFOLIO_FALLBACK_IMAGES: FallbackImage[] = [
  { src: '/portfolio-photos/modern-kitchen-1.jpeg', alt: 'Recent Tri Pros kitchen remodel' },
  { src: '/portfolio-photos/modern-bathroom-1.jpeg', alt: 'Recent Tri Pros bathroom remodel' },
  { src: '/portfolio-photos/modern-staircase-1.jpeg', alt: 'Recent Tri Pros interior remodel' },
  { src: '/hero-photos/modern-house-1.png', alt: 'Completed Tri Pros remodeling project' },
  { src: '/hero-photos/modern-house-2.png', alt: 'Completed Tri Pros remodeling project' },
]

/** Number of tiles the bento renders (1 featured 2×2 + 4 fill). */
export const PORTFOLIO_SLOT_COUNT = 5

/** Per-tile responsive span classes; index 0 is the featured tile. */
export const PORTFOLIO_BENTO_SPANS = ['sm:col-span-2 sm:row-span-2', '', '', '', '']
```

- [ ] **Step 2: Rewrite `portfolio-block.tsx`**

```tsx
'use client'

import type { FunnelContext, PortfolioBlockContent } from '@/shared/domains/funnels/types'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useMemo } from 'react'
import { PORTFOLIO_BENTO_SPANS, PORTFOLIO_FALLBACK_IMAGES, PORTFOLIO_SLOT_COUNT } from '@/shared/domains/funnels/constants/portfolio-fallback-images'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

export function PortfolioBlock({ content, ctx }: { content: PortfolioBlockContent, ctx: FunnelContext }) {
  const trpc = useTRPC()
  const scopesQ = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const projectsQ = useQuery(trpc.projectsRouter.showroomDisplay.getAll.queryOptions())
  const tradeId = TRADE_BY_SLUG[ctx.slug]

  const tiles = useMemo(() => {
    const scopes = scopesQ.data
    const projects = projectsQ.data
    if (!scopes || !projects) {
      return null
    }
    const scopeToTrade = new Map(scopes.map(s => [s.id, s.relatedTrade]))
    const hits = projects.filter((p): p is PortfolioProject & { heroImage: NonNullable<PortfolioProject['heroImage']> } =>
      p.heroImage !== null && p.scopeIds.some(id => scopeToTrade.get(id) === tradeId),
    )
    if (hits.length === 0) {
      console.warn(`[funnels] portfolio block: no projects matched trade ${tradeId} for funnel ${ctx.slug}`)
    }
    const real = hits.map(p => ({ src: getOptimizedSrc(p.heroImage), alt: p.project.title }))
    const padded = [...real]
    for (let i = 0; padded.length < PORTFOLIO_SLOT_COUNT; i++) {
      const fb = PORTFOLIO_FALLBACK_IMAGES[i % PORTFOLIO_FALLBACK_IMAGES.length]
      padded.push({ src: fb.src, alt: fb.alt })
    }
    return padded.slice(0, PORTFOLIO_SLOT_COUNT)
  }, [scopesQ.data, projectsQ.data, tradeId, ctx.slug])

  if (tiles === null) {
    return <div className="bg-muted/40 h-64 w-full animate-pulse rounded-2xl" />
  }

  return (
    <section className="flex flex-col gap-6 py-10">
      {content.title ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.title}</h2> : null}
      {content.subtitle ? <p className="text-muted-foreground text-center">{content.subtitle}</p> : null}
      <div className="grid auto-rows-[140px] grid-cols-2 gap-3 sm:auto-rows-[160px] sm:grid-cols-4">
        {tiles.map((tile, i) => (
          <div
            key={`${tile.src}-${i}`}
            className={cn('group relative overflow-hidden rounded-2xl', i === 0 ? 'col-span-2' : '', PORTFOLIO_BENTO_SPANS[i])}
          >
            <Image
              src={tile.src}
              alt={tile.alt}
              fill
              sizes="(max-width: 640px) 50vw, 25vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify**

Run: `pnpm tsc` → Expected: 0 errors.
Run: `pnpm lint` → Expected: 0 errors (`pnpm lint:fix` for import sort).

**Visual acceptance (integration):** kitchens funnel shows an asymmetric bento (featured large tile + fill), real DB projects first, padded with public photos if fewer than 5; subtle hover zoom; no layout shift; no horizontal scroll at 375px.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/constants/portfolio-fallback-images.ts
git commit -m "feat(funnels): editorial bento portfolio with public-photo fallback padding

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/constants/portfolio-fallback-images.ts src/shared/domains/funnels/ui/blocks/portfolio-block.tsx
```

---

## Integration Browser Smoke (after all tasks — controller-run)

Dev server on :3000, localStorage cleared, `/funnels/kitchens`:
1. Renders **light**; hero + 6 **centered** cards stagger in; all 6 fit a 375px viewport with no scroll.
2. Tap a card → focused column. Click **Back** → landing re-appears (hero + marketing), scrolled to Q1, **Continue →** visible; Continue advances. No dead-end.
3. Reviews: yellow stars; Google/Yelp badges open real profiles in a new tab; BBB shows A+; 3 cards.
4. Portfolio renders as a bento (real kitchen projects, padded if needed); hover zoom; no CLS.
5. Inter-block "↑ See if you qualify" outline CTA scrolls to Q1.
6. 0 console errors; with `prefers-reduced-motion` the entrance/stagger are disabled cleanly.

## Self-Review Notes

- **Spec coverage:** §1 nav → Task 4 (Continue) + Task 5 (scroll-on-back); §2 hero smoothness → Task 5 (entrance; layoutId intentionally dropped — see plan header); §3 cards → Task 4; §4 reviews → Tasks 2–3; §5 bento → Task 6; §6 CTAs → Task 5; §7 light mode → Task 1. All covered.
- **Deviation from spec:** `layoutId` shared-element morph removed (would require special-casing step 1 in the generic engine; never fires in the real nav flow). Entrance fade-up covers the "no jarring pop" requirement. Flagged to user before execution.
- **Type consistency:** `StarRating`/`PlatformBadge`/`ReviewCard` prop names match between Task 2 (definition) and Task 3 (use). `scrollToQuestionOnMount` matches between Task 5 landing + engine. `PORTFOLIO_SLOT_COUNT`/`PORTFOLIO_BENTO_SPANS` match between Task 6 constants + block.
- **Open flags (non-blocking, from spec):** testimonials are placeholder seed data; confirm real Google 4.9/200+ numbers; live Google Places feed deferred.
