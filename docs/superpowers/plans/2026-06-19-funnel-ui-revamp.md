# Funnel UI Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify the funnel onto one 5xl content rail, rebuild the confirmation page as an energetic, motion-rich screen with a real-project carousel, and fix the address step's dark dropdown + intrusive street view.

**Architecture:** A single shared rail constant governs width across landing, steps, and confirmation. The confirmation step becomes a thin composer over two new leaf components — an animated timeline and a funnel-local Embla carousel — both built only from `shared/` primitives (the funnel lives under `shared/domains` and must not import from `features/`). The address dropdown is re-scoped to the funnel's light theme by passing the `funnel-light` class onto the portaled popover content.

**Tech Stack:** Next.js 15 / React 19, Tailwind v4 (token-based), motion/react v12, Embla (`shared/components/ui/carousel`), tRPC (`useTRPC`), `@vis.gl/react-google-maps`.

## Global Constraints

- **Package manager:** pnpm. Path alias `@/` → `src/`.
- **Verification gate (no unit-test runner in repo):** `pnpm tsc` must be clean and `pnpm lint` must report **no new errors** after every task. **NEVER run `pnpm build`.** Browser smoke is manual (human runs `pnpm dev`).
- **ESLint (will fail the gate):** `perfectionist/sort-imports` + `sort-named-imports` (type imports first, then external, then internal `@/`, alphabetical by source within group); **named exports only** (no `export default`); **one React component per file**; `antfu/if-newline` (single-line `if` bodies need braces + newline); no barrel files in `ui/`, `constants/`, `hooks/`, `lib/`.
- **Import directionality:** `shared/` must NEVER import from `features/`. The new carousel is funnel-local, built from `shared/components/ui/carousel` only.
- **Light-theme tokens, never raw colors:** the funnel is scoped-light via `.funnel-light` (`src/app/(frontend)/funnels/layout.tsx`). Use semantic tokens (`bg-card`, `text-success`, `bg-popover`); no `bg-white`.
- **Single unified rail value:** `max-w-5xl` (desktop). Mobile governed by `px-5`.
- **Carousel caps:** show the trade-filtered set capped at **8** slides; if fewer than **3** real projects resolve, pad with `PORTFOLIO_FALLBACK_IMAGES` up to 3.
- **Carousel tap:** real projects link to `/portfolio-projects/{accessor}` via `<a target="_blank" rel="noopener noreferrer">`.
- **Motion:** every animation gated on `useReducedMotion()` (translate/scale dropped, static render under reduced motion).
- **Commit hygiene:** commit ONLY each task's named files via explicit pathspec. **Never `git add -A` / `git commit -am`.** Two unrelated artifacts in the working tree must remain untouched: the uncommitted `src/shared/domains/funnels/ui/steps/location-step.tsx` edit and any untracked `docs/superpowers/plans/2026-06-19-funnel-polish-batch.md`.
- **Branch:** the session has been committing to `main`; confirm at execution handoff whether to branch first.

---

### Task 1: Unify the funnel onto one 5xl rail

**Files:**
- Create: `src/shared/domains/funnels/constants/funnel-layout.ts`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-landing.tsx`

**Interfaces:**
- Produces: `FUNNEL_RAIL_MAX_W: string` (`'max-w-5xl'`) — the single rail width, consumed by the engine body, the landing, and the sticky header `widthClass`.

- [ ] **Step 1: Create the rail constant**

```ts
// src/shared/domains/funnels/constants/funnel-layout.ts
/**
 * The single content-rail width for every funnel surface — landing, question
 * steps, and the terminal confirmation — plus the sticky header. Every section
 * fills this rail (`w-full`); content that should read narrower (a focused
 * single input, body prose) constrains INTERNALLY with its own `max-w-*`.
 * Desktop caps at 5xl; on mobile the `px-5` gutter governs.
 */
export const FUNNEL_RAIL_MAX_W = 'max-w-5xl'
```

- [ ] **Step 2: Point the engine at the rail**

In `src/shared/domains/funnels/ui/funnel-engine.tsx`, add the import (sorted into the `@/shared/domains/funnels/constants/*` group):

```tsx
import { FUNNEL_RAIL_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
```

Replace the per-step width logic:

```tsx
  // One content rail for the whole funnel (see constants/funnel-layout). Every
  // step + the terminal confirmation share this baseline width; the sticky
  // header mirrors it. Focused controls constrain internally.
  const contentWidth = FUNNEL_RAIL_MAX_W
```

(The existing `<FunnelStickyHeader opacity={stickyOpacity} widthClass={contentWidth} />` and the body `${contentWidth}` now both resolve to 5xl — no further change in this file.)

- [ ] **Step 3: Align the landing to the same rail**

In `src/shared/domains/funnels/ui/funnel-landing.tsx`, add the import:

```tsx
import { FUNNEL_RAIL_MAX_W } from '@/shared/domains/funnels/constants/funnel-layout'
```

Pass the rail to the landing's own sticky header:

```tsx
      <FunnelStickyHeader opacity={headerOpacity} widthClass={FUNNEL_RAIL_MAX_W} />
```

Swap the two hard-coded `max-w-5xl` literals for the constant (the hero wrapper and the marketing-blocks wrapper), leaving the focused Q1 form column at its inner `max-w-xl`:

```tsx
          <div className={`w-full ${FUNNEL_RAIL_MAX_W} px-5`}>
            <FunnelHero content={spec.hero} onCta={scrollToQuestion} ref={heroRef} scroll={heroScroll} />
          </div>
```

```tsx
        <div className={`flex w-full ${FUNNEL_RAIL_MAX_W} flex-col gap-12 px-5`}>
```

- [ ] **Step 4: Verify the gate**

Run: `pnpm tsc 2>&1 | tail -5 && pnpm lint 2>&1 | tail -5`
Expected: tsc prints nothing after the banner; lint shows no errors (warnings about pre-existing array-index keys are acceptable).

- [ ] **Step 5: Manual browser smoke** (human, `pnpm dev`)

Load a funnel. Confirm: on the landing the sticky-header logo + Call line up with the hero and marketing-block edges; question steps now span the 5xl rail with their cards/controls still centered/legible; the confirmation header aligns with its content. No horizontal scroll at 375px.

- [ ] **Step 6: Commit**

```bash
git add src/shared/domains/funnels/constants/funnel-layout.ts src/shared/domains/funnels/ui/funnel-engine.tsx src/shared/domains/funnels/ui/funnel-landing.tsx
git commit -m "feat(funnel): unify every surface onto one max-w-5xl rail"
```

---

### Task 2: Add timeline motion variants

**Files:**
- Modify: `src/shared/domains/funnels/constants/funnel-motion.ts`

**Interfaces:**
- Consumes: existing `Variants` type import (already present), `CARD_STAGGER_ITEM` (reused by the timeline steps — shares the `hidden`/`visible` labels).
- Produces: `TIMELINE_STAGGER_CONTAINER: Variants`, `TIMELINE_LINE: Variants`.

- [ ] **Step 1: Append the variants**

Add to the end of `src/shared/domains/funnels/constants/funnel-motion.ts`:

```ts
/**
 * Confirmation "what's next" timeline. The container draws its steps in with a
 * deliberate 120ms stagger; TIMELINE_LINE scales the connecting line in from
 * the top (origin-top). Steps reuse CARD_STAGGER_ITEM (shared hidden/visible
 * labels). Gated on useReducedMotion() at the call site.
 */
export const TIMELINE_STAGGER_CONTAINER: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.15 } },
}

export const TIMELINE_LINE: Variants = {
  hidden: { scaleY: 0 },
  visible: { scaleY: 1, transition: { duration: 0.5, ease: [0.32, 0.72, 0, 1] } },
}
```

- [ ] **Step 2: Verify the gate**

Run: `pnpm tsc 2>&1 | tail -5 && pnpm lint 2>&1 | tail -5`
Expected: clean (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/constants/funnel-motion.ts
git commit -m "feat(funnel): add confirmation timeline motion variants"
```

---

### Task 3: ConfirmationTimeline component

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/confirmation-timeline.tsx`

**Interfaces:**
- Consumes: `TIMELINE_STAGGER_CONTAINER`, `TIMELINE_LINE`, `CARD_STAGGER_ITEM` from `constants/funnel-motion`.
- Produces: `ConfirmationTimeline({ steps }: { steps: string[] })`.

Not wired into the page yet (Task 5 does that). Deliverable is the component; gate is tsc/lint + code review.

- [ ] **Step 1: Write the component**

```tsx
// src/shared/domains/funnels/ui/steps/confirmation-timeline.tsx
'use client'

import { motion, useReducedMotion } from 'motion/react'
import { CARD_STAGGER_ITEM, TIMELINE_LINE, TIMELINE_STAGGER_CONTAINER } from '@/shared/domains/funnels/constants/funnel-motion'

/**
 * Animated "what happens next" timeline for the confirmation step. A vertical
 * connecting line draws itself in from the top while the numbered steps stagger
 * up in sequence. Pure presentation — `steps` is the ordered copy. Reduced
 * motion renders everything static (no draw, no stagger). The number badges use
 * the subtle primary TINT — the page's one SOLID-primary moment is the Call CTA.
 */
export function ConfirmationTimeline({ steps }: { steps: string[] }) {
  const reduceMotion = useReducedMotion()

  return (
    <motion.ol
      variants={reduceMotion ? undefined : TIMELINE_STAGGER_CONTAINER}
      initial={reduceMotion ? false : 'hidden'}
      animate="visible"
      className="relative flex w-full flex-col gap-6 text-left"
    >
      <motion.span
        aria-hidden
        variants={reduceMotion ? undefined : TIMELINE_LINE}
        className="bg-border absolute bottom-3 left-4 top-3 w-px origin-top"
      />
      {steps.map((step, i) => (
        <motion.li
          key={step}
          variants={reduceMotion ? undefined : CARD_STAGGER_ITEM}
          className="relative flex items-start gap-4"
        >
          <span className="bg-primary/10 text-primary relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
            {i + 1}
          </span>
          <span className="text-foreground pt-1 text-sm leading-relaxed">{step}</span>
        </motion.li>
      ))}
    </motion.ol>
  )
}
```

- [ ] **Step 2: Verify the gate**

Run: `pnpm tsc 2>&1 | tail -5 && pnpm lint 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/ui/steps/confirmation-timeline.tsx
git commit -m "feat(funnel): animated confirmation what's-next timeline"
```

---

### Task 4: FunnelProjectCarousel component

**Files:**
- Create: `src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx`

**Interfaces:**
- Consumes: `Carousel`/`CarouselContent`/`CarouselItem`/`CarouselNext`/`CarouselPrevious`/`CarouselApi` from `shared/components/ui/carousel`; `TRADE_BY_SLUG`; `PORTFOLIO_FALLBACK_IMAGES`; `getOptimizedSrc`; `useTRPC`; `PortfolioProject` type.
- Produces: `FunnelProjectCarousel({ slug }: { slug: string })`.

Not wired in yet (Task 5). The single component owns its own dot-indicator state — no second component (one-per-file rule).

- [ ] **Step 1: Write the component**

```tsx
// src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx
'use client'

import type { CarouselApi } from '@/shared/components/ui/carousel'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useCallback, useMemo, useState } from 'react'
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/shared/components/ui/carousel'
import { PORTFOLIO_FALLBACK_IMAGES } from '@/shared/domains/funnels/constants/portfolio-fallback-images'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

const MAX_SLIDES = 8
const MIN_SLIDES = 3

interface Slide {
  title: string
  src: string
  href: string | null
}

/**
 * Funnel-local "finished kitchens" peek carousel for the confirmation step.
 * Mirrors the portfolio PhaseCarousel's peek feel using only shared primitives
 * (the funnel must not import from features/). Shows real trade-filtered
 * projects' hero photos; real slides link out to the full project story in a
 * new tab. Padded with on-brand fallbacks so it's never empty; `null` while the
 * queries load → skeleton.
 */
export function FunnelProjectCarousel({ slug }: { slug: string }) {
  const trpc = useTRPC()
  const scopesQ = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const projectsQ = useQuery(trpc.projectsRouter.showroomDisplay.getAll.queryOptions())
  const tradeId = TRADE_BY_SLUG[slug]

  const [api, setApi] = useState<CarouselApi>()
  const [current, setCurrent] = useState(0)

  const handleSetApi = useCallback((newApi: CarouselApi) => {
    setApi(newApi)
    if (newApi) {
      newApi.on('select', () => setCurrent(newApi.selectedScrollSnap()))
    }
  }, [])

  const slides = useMemo<Slide[] | null>(() => {
    const scopes = scopesQ.data
    const projects = projectsQ.data
    if (!scopes || !projects) {
      return null
    }
    const scopeToTrade = new Map(scopes.map(s => [s.id, s.relatedTrade]))
    const real: Slide[] = projects
      .filter((p): p is PortfolioProject & { heroImage: NonNullable<PortfolioProject['heroImage']> } =>
        p.heroImage !== null && p.scopeIds.some(id => scopeToTrade.get(id) === tradeId),
      )
      .slice(0, MAX_SLIDES)
      .map(p => ({ title: p.project.title, src: getOptimizedSrc(p.heroImage), href: `/portfolio-projects/${p.project.accessor}` }))
    const padded = [...real]
    for (let i = 0; padded.length < MIN_SLIDES; i++) {
      const fb = PORTFOLIO_FALLBACK_IMAGES[i % PORTFOLIO_FALLBACK_IMAGES.length]
      padded.push({ title: fb.alt, src: fb.src, href: null })
    }
    return padded
  }, [scopesQ.data, projectsQ.data, tradeId])

  if (slides === null) {
    return <div className="bg-muted/40 h-56 w-full animate-pulse rounded-2xl" />
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Carousel setApi={handleSetApi} opts={{ align: 'start', loop: slides.length > 1 }} className="w-full">
        <CarouselContent className="-ml-3">
          {slides.map((slide, i) => (
            <CarouselItem
              key={`${slide.src}-${i}`}
              className={cn('pl-3', slides.length === 1 ? 'basis-full' : 'basis-[85%] sm:basis-[70%] md:basis-[55%]')}
            >
              {slide.href
                ? (
                    <a
                      href={slide.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group relative block aspect-video w-full overflow-hidden rounded-xl shadow-lg"
                    >
                      <Image src={slide.src} alt={slide.title} fill sizes="(max-width: 640px) 85vw, (max-width: 768px) 70vw, 55vw" className="object-cover transition-transform duration-300 group-hover:scale-105" />
                    </a>
                  )
                : (
                    <div className="relative aspect-video w-full overflow-hidden rounded-xl shadow-lg">
                      <Image src={slide.src} alt={slide.title} fill sizes="(max-width: 640px) 85vw, (max-width: 768px) 70vw, 55vw" className="object-cover" />
                    </div>
                  )}
            </CarouselItem>
          ))}
        </CarouselContent>
        {slides.length > 1
          ? (
              <>
                <CarouselPrevious className="bg-background/80 -left-3 backdrop-blur-sm md:-left-5" />
                <CarouselNext className="bg-background/80 -right-3 backdrop-blur-sm md:-right-5" />
              </>
            )
          : null}
      </Carousel>

      {slides.length > 1
        ? (
            <div className="flex items-center justify-center gap-1.5">
              {slides.map((slide, i) => (
                <button
                  key={`dot-${slide.src}-${i}`}
                  type="button"
                  onClick={() => api?.scrollTo(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all duration-300',
                    i === current ? 'bg-primary w-6' : 'bg-muted-foreground/30 hover:bg-muted-foreground/50 w-1.5',
                  )}
                  aria-label={`Go to project ${i + 1}`}
                />
              ))}
            </div>
          )
        : null}
    </div>
  )
}
```

- [ ] **Step 2: Verify the gate**

Run: `pnpm tsc 2>&1 | tail -5 && pnpm lint 2>&1 | tail -5`
Expected: clean (a `react/no-array-index-key` warning on the keyed maps is acceptable — matches the codebase's existing portfolio components).

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/ui/blocks/funnel-project-carousel.tsx
git commit -m "feat(funnel): finished-kitchen peek carousel for confirmation"
```

---

### Task 5: Rewrite the confirmation step (success green, timeline, CTAs, carousel, stagger)

**Files:**
- Modify (full rewrite of the component body): `src/shared/domains/funnels/ui/steps/confirmation-step.tsx`

**Interfaces:**
- Consumes: `ConfirmationTimeline` (Task 3), `FunnelProjectCarousel` (Task 4).
- Produces: unchanged exports `ConfirmationStepView`, `CONFIRMATION_STEP`.

This replaces the bento/hero-grid gallery and the static `<ol>` entirely, and removes the now-dead before/after query machinery (`useQueries`, `accessors`, `detailQs`, `pairs`, `heroTiles`, `MAX_PAIRS`, and the `scopes`/`projects`/`Image`/`getOptimizedSrc`/`PORTFOLIO_FALLBACK_IMAGES`/`TRADE_BY_SLUG`/`PortfolioProject` imports). The carousel owns project fetching now.

- [ ] **Step 1: Replace the whole file**

```tsx
// src/shared/domains/funnels/ui/steps/confirmation-step.tsx
'use client'

import type { ConfirmationStep, PiiAnswer, StepProps } from '@/shared/domains/funnels/types'
import { CircleCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { Button } from '@/shared/components/ui/button'
import { contactInfo } from '@/shared/constants/company/contact-info'
import { useEnrichLead } from '@/shared/domains/funnels/hooks/use-enrich-lead'
import { FunnelProjectCarousel } from '@/shared/domains/funnels/ui/blocks/funnel-project-carousel'
import { ConfirmationTimeline } from '@/shared/domains/funnels/ui/steps/confirmation-timeline'
import { toDialString } from '@/shared/lib/phone'

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

export function ConfirmationStepView({ content, answers, ctx }: StepProps<ConfirmationStep>) {
  const enrich = useEnrichLead()
  const firedRef = useRef(false)
  const reduceMotion = useReducedMotion()

  // Fire enrichment exactly once on mount, fire-and-forget. Empty dep array =
  // run-once-on-mount; firedRef is belt-and-suspenders (never re-fire).
  useEffect(() => {
    if (firedRef.current) {
      return
    }
    firedRef.current = true
    const leadId = (answers.pii as PiiAnswer | null)?.leadId
    if (!leadId) {
      return
    }
    enrich({
      leadId,
      enrichment: {
        homeType: asString(answers.homeType),
        age: asString(answers.age),
        scope: asString(answers.scope),
        timeline: asString(answers.timeline),
      },
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const phone = contactInfo.find(info => info.accessor === 'phone')!.value

  // Per-block entrance: each section fades up in sequence on mount, gated on
  // reduced motion. Climbing delays land the eye top→bottom.
  function entrance(delay: number) {
    if (reduceMotion) {
      return {}
    }
    return {
      initial: { opacity: 0, y: 14 },
      animate: { opacity: 1, y: 0 },
      transition: { duration: 0.4, ease: [0.32, 0.72, 0, 1] as const, delay },
    }
  }

  return (
    <div className="flex flex-col items-center gap-8 py-6 text-center">
      <motion.div className="flex flex-col items-center gap-3" {...entrance(0)}>
        <motion.span
          className="bg-success/10 text-success flex size-16 items-center justify-center rounded-full"
          initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
          animate={reduceMotion ? undefined : { scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 18, delay: 0.05 }}
        >
          <CircleCheck className="size-9" aria-hidden />
        </motion.span>
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground max-w-prose">{content.subtitle}</p> : null}
      </motion.div>

      {content.whatNext && content.whatNext.length > 0
        ? (
            <motion.div className="border-border bg-card w-full rounded-2xl border p-6" {...entrance(0.1)}>
              <ConfirmationTimeline steps={content.whatNext} />
            </motion.div>
          )
        : null}

      <motion.div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center" {...entrance(0.18)}>
        <Button asChild size="lg" className="h-14 flex-1 text-base shadow-sm">
          <a href={`tel:${toDialString(phone)}`}>{`Call ${phone}`}</a>
        </Button>
        <Button asChild variant="outline" size="lg" className="h-14 text-base sm:w-auto">
          {/* eslint-disable-next-line node/prefer-global/process */}
          <a href={process.env.NEXT_PUBLIC_BASE_URL ?? '/'} target="_blank" rel="noopener noreferrer">See our work</a>
        </Button>
      </motion.div>

      {content.scarcityLine
        ? <motion.p className="text-muted-foreground text-sm font-medium" {...entrance(0.24)}>{content.scarcityLine}</motion.p>
        : null}

      <motion.section className="flex w-full flex-col gap-4" {...entrance(0.3)}>
        <h3 className="text-foreground text-lg font-semibold">Recent Tri Pros work</h3>
        <FunnelProjectCarousel slug={ctx.slug} />
      </motion.section>
    </div>
  )
}

/** Importable prebuilt step (Seam A). Terminal — no advance. */
export const CONFIRMATION_STEP: ConfirmationStep = {
  id: 'confirmation',
  kind: 'confirmation',
  content: {
    title: 'You\'re on the Showcase list.',
    subtitle: 'We review every home for fit and call within 24 hours to confirm your spot.',
    whatNext: [
      'We review your home against this round\'s Showcase criteria.',
      'A Tri Pros specialist calls within 24 hours to confirm fit.',
      'If selected, we schedule your in-home design visit.',
    ],
    scarcityLine: 'Spots are limited — selected homes are confirmed first-come.',
  },
}
```

- [ ] **Step 2: Verify the gate**

Run: `pnpm tsc 2>&1 | tail -5 && pnpm lint 2>&1 | tail -5`
Expected: clean. tsc must show NO "declared but never read" errors (all removed imports/memos are gone).

- [ ] **Step 3: Manual browser smoke** (human)

On the confirmation step: green check springs in; the 1→2→3 timeline draws its line + staggers steps; the Call button is the dominant full-width primary with "See our work" subordinate (stacked on mobile, row from `sm`); the "Recent Tri Pros work" carousel shows finished kitchens with peek + arrows + dots, and tapping a real project opens `/portfolio-projects/{accessor}` in a new tab. Toggle OS reduced-motion → everything renders static, no draw.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/ui/steps/confirmation-step.tsx
git commit -m "feat(funnel): motion-rich confirmation — green check, timeline, carousel, CTA hierarchy"
```

---

### Task 6: Re-scope the address predictions dropdown to the funnel's light theme

**Files:**
- Modify: `src/shared/components/inputs/address-predictions-dropdown.tsx`
- Modify: `src/shared/components/inputs/address-autocomplete.tsx`
- Modify: `src/shared/domains/funnels/ui/steps/address-step.tsx`

**Interfaces:**
- `AddressPredictionsDropdown` gains optional `contentClassName?: string` (appended to `PopoverContent`).
- `AddressAutocomplete` gains optional `dropdownClassName?: string` (forwarded as `contentClassName`).
- Both default-off, so existing non-funnel callers are unaffected.

- [ ] **Step 1: Thread `contentClassName` into the portaled popover**

In `src/shared/components/inputs/address-predictions-dropdown.tsx`, add the `cn` import (sorted into the internal group):

```tsx
import { cn } from '@/shared/lib/utils'
```

Add the prop to the interface:

```tsx
interface AddressPredictionsDropdownProps {
  predictions: google.maps.places.AutocompletePrediction[]
  isOpen: boolean
  onSelect: (placeId: string) => void
  isLoading?: boolean
  anchorRef: React.RefObject<HTMLDivElement | null>
  contentClassName?: string
}
```

Destructure it and apply to `PopoverContent` — the portaled element inherits app-theme tokens unless we re-assert the funnel scope here:

```tsx
export function AddressPredictionsDropdown({
  predictions,
  isOpen,
  onSelect,
  isLoading = false,
  anchorRef,
  contentClassName,
}: AddressPredictionsDropdownProps) {
```

```tsx
      <PopoverContent
        className={cn('w-[var(--radix-popover-trigger-width)] p-0', contentClassName)}
        align="start"
```

- [ ] **Step 2: Forward `dropdownClassName` through the autocomplete**

In `src/shared/components/inputs/address-autocomplete.tsx`, add to `AddressAutocompleteProps`:

```tsx
  dropdownClassName?: string
```

Add it to the destructured params (with the other optionals):

```tsx
  debounceMs = 300,
  minChars = 2,
  dropdownClassName,
}: AddressAutocompleteProps) {
```

Pass it down where `AddressPredictionsDropdown` is rendered:

```tsx
      <AddressPredictionsDropdown
        predictions={predictions}
        isOpen={isOpen}
        onSelect={handleSelect}
        isLoading={isLoading}
        anchorRef={anchorRef}
        contentClassName={dropdownClassName}
      />
```

- [ ] **Step 3: Pass the funnel light scope from the address step**

In `src/shared/domains/funnels/ui/steps/address-step.tsx`, add `dropdownClassName` to the `AddressAutocomplete` usage. Re-asserting `funnel-light` re-declares the light token vars (`--popover` → white, `--popover-foreground` → dark) on the portaled dropdown; `text-foreground` re-resolves the inherited text color (same pattern as the funnel layout):

```tsx
          <AddressAutocomplete
            defaultValue={value?.fullAddress}
            onSelect={handleSelect}
            showMap={false}
            dropdownClassName="funnel-light text-foreground"
          />
```

- [ ] **Step 4: Verify the gate**

Run: `pnpm tsc 2>&1 | tail -5 && pnpm lint 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 5: Manual browser smoke** (human)

On the address step, type an address. The predictions dropdown is now LIGHT (white surface, dark text, matching the funnel) instead of dark. Selecting a prediction still fills the field and shows the preview.

- [ ] **Step 6: Commit**

```bash
git add src/shared/components/inputs/address-predictions-dropdown.tsx src/shared/components/inputs/address-autocomplete.tsx src/shared/domains/funnels/ui/steps/address-step.tsx
git commit -m "fix(funnel): light-theme the portaled address predictions dropdown"
```

---

### Task 7: Address preview — aerial only

**Files:**
- Modify (full rewrite): `src/shared/domains/funnels/ui/steps/address-preview.tsx`

**Interfaces:**
- Produces: unchanged export `AddressPreview({ fullAddress }: { fullAddress: string })`.

- [ ] **Step 1: Replace the file (drop the Street tile)**

```tsx
// src/shared/domains/funnels/ui/steps/address-preview.tsx
import { MapPin } from 'lucide-react'
import { googleMapsClient } from '@/shared/services/providers/google-maps/client'

/**
 * Funnel-local preview of the picked place — AERIAL ONLY. Street View is omitted
 * on the lead funnel because a photo of the prospect's house feels intrusive.
 * Built from a static-map URL; renders only once an address is picked.
 */
export function AddressPreview({ fullAddress }: { fullAddress: string }) {
  const aerialSrc = googleMapsClient.hasKey()
    ? googleMapsClient.aerialStaticMapUrl(fullAddress, '640x480')
    : null

  return (
    <div className="space-y-2">
      <div className="border-border bg-muted relative aspect-4/3 overflow-hidden rounded-lg border">
        {aerialSrc
          ? <img alt="" className="size-full object-cover" src={aerialSrc} />
          : (
              <div className="text-muted-foreground grid size-full place-items-center text-xs">
                No preview
              </div>
            )}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white backdrop-blur-sm">
          Aerial
        </span>
      </div>
      <div className="border-border bg-muted/40 flex items-start gap-2 rounded-md border px-3 py-2 text-sm">
        <MapPin className="text-primary mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span className="min-w-0 flex-1 wrap-break-word font-medium">{fullAddress}</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the gate**

Run: `pnpm tsc 2>&1 | tail -5 && pnpm lint 2>&1 | tail -5`
Expected: clean.

- [ ] **Step 3: Manual browser smoke** (human)

Pick an address on the address step — only the aerial tile shows (no Street View), with the address chip below.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/ui/steps/address-preview.tsx
git commit -m "feat(funnel): address preview shows aerial only (drop street view)"
```

---

## Self-Review

**Spec coverage:**
- Global 5xl rail → Task 1 ✓
- Confirmation: green success check → Task 5 ✓; animated 1→2→3 timeline → Tasks 2+3+5 ✓; un-squished CTA hierarchy → Task 5 ✓; finished-kitchen peek carousel from DB, capped 8 / padded 3, link-out new tab → Task 4+5 ✓; section stagger + reduced-motion → Task 5 ✓
- Address dropdown light theme (no `bg-white`, token-based) → Task 6 ✓
- Address aerial-only → Task 7 ✓
- Cross-cutting motion variants → Task 2 ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type/name consistency:** `FUNNEL_RAIL_MAX_W` (Task 1) consumed in Tasks 1 only. `TIMELINE_STAGGER_CONTAINER`/`TIMELINE_LINE` (Task 2) consumed in Task 3. `ConfirmationTimeline({ steps })` (Task 3) called with `steps={content.whatNext}` (Task 5) ✓. `FunnelProjectCarousel({ slug })` (Task 4) called with `slug={ctx.slug}` (Task 5) ✓. `contentClassName`/`dropdownClassName` chain (Task 6) consistent ✓.

**Boundary check:** the carousel imports only `shared/*` — no `features/` import. ✓

## Execution Handoff

Pick an execution approach (see bottom of this message).
