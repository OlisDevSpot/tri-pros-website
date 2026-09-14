# Who We Are Scroll Presentation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the meeting-flow "Who We Are" step with a full-height, section-snapping scroll presentation driven by a small reusable presentation primitive.

**Architecture:** A `SnapPresentation` scroller (CSS scroll snap, size container, in-view tracking via `useInView` with `root`) hosts nine `SnapSection`s and a sticky `PinnedColumn`. Section content is data in a constants file; each beat kind has one small component. The step is rendered in a new `presentation` layout mode of the meeting-flow view so it owns its own scroller.

**Tech Stack:** Next.js 15 (app router, `next/image`), React 19, `motion/react` v12 (`useInView`, `MotionConfig`, `AnimatePresence`), Tailwind v4 (container-query units, scroll-snap utilities), shadcn `Dialog` and `Button`.

**Spec:** `docs/superpowers/specs/2026-09-12-who-we-are-scroll-presentation-design.md`
**Research the snap recipe is built on:** `docs/plans/2026-09-11-meeting-flow-scroll-snap-research.md`

## Global Constraints

- Package manager is **pnpm**. Path alias `@/` → `src/`. Never run `pnpm build`; verification is `pnpm tsc` and `pnpm lint` only (repo memory `feedback-verification-workflow`).
- The working tree is **shared with the user's live editor**. `git stash`, `git checkout <ref> -- .`, `git restore` beyond your own task's files, and `git reset` are forbidden (repo memory `feedback-subagent-shared-tree-safety`).
- Work happens **on `main`**. Stage by explicit path only; never `git add -A` or `git add .` (repo memory `feedback-work-on-main`). The tree already holds unrelated uncommitted changes: do not touch them.
- Commit steps below run **only if the user has confirmed commits for this plan at execution start**; otherwise stop at staging by path and report.
- Coding conventions (repo memory `coding-conventions`): one React component per file; no file-level constants in component or view files (constants go in `constants/`); named exports; prop interfaces stay in the component file; React contexts live in `contexts/`.
- Company facts come from `src/shared/constants/company/` or the existing `DUE_DILIGENCE_ITEMS`. Do not type new numbers. The workmanship warranty must not appear.
- Design system is `docs/design-system/DESIGN.md` (Command Desk world): one accent (cobalt), scrim-not-blur over photos, no glow halos, no gradient text, Syne headings (`font-sans`), Playfair for the one serif moment (`font-serif`).
- Snap rules from the research note: the `<section>` that carries `snap-start` is never transformed; reveals animate inner elements only; `useInView` always passes `root`; sections size with `100cqh` against the scroller, never percentage height; no wheel or touch interception.
- Reduced motion: `MotionConfig reducedMotion="user"` wraps the presentation; smooth scroll behavior is gated with `motion-safe:`.
- No unit test runner exists in this repo. Each task verifies with `pnpm tsc`, `pnpm exec eslint <files>`, and, where the task renders UI, a rendered check in a Playwright browser against the running dev server (`pnpm dev` on port 3000). Log in with `http://localhost:3000/api/dev/playwright-session?secret=<DEV_LOGIN_SECRET from .env.local>&redirect=/dashboard/meetings` first (repo memory `reference-playwright-auth`). A dev meeting to open: `http://localhost:3000/dashboard/meetings/2069fa85-0357-4550-8eb5-6ae40eacf5a9?step=1`.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/features/meeting-flow/types/index.ts` (modify) | `MeetingStepLayout`, `PointMedia`, `PresentationDocument`, `ProofItem`, `PinnedSummary`, `WhoWeAreSection` |
| `src/features/meeting-flow/constants/step-config.ts` (modify) | `layout` on every step |
| `src/features/meeting-flow/constants/presentation-motion.ts` (create) | reveal, image-settle, pin-swap motion tokens |
| `src/features/meeting-flow/constants/who-we-are-sections.ts` (create) | the nine beats and their pinned summaries, derived from company constants |
| `src/features/meeting-flow/constants/due-diligence.ts` (modify) | remove `CREDENTIAL_ITEMS` (only consumer goes away) |
| `src/features/meeting-flow/contexts/presentation-context.tsx` (create) | `PresentationContext`, `usePresentation`, `SectionInViewContext`, `useSectionInView` |
| `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx` (create) | the snapping scroller + grid + context provider |
| `src/features/meeting-flow/ui/components/presentation/snap-section.tsx` (create) | one snap target, in-view tracking |
| `src/features/meeting-flow/ui/components/presentation/reveal.tsx` (create) | staggered text reveal bound to section in-view |
| `src/features/meeting-flow/ui/components/presentation/section-image.tsx` (create) | full-bleed `next/image` with settle motion |
| `src/features/meeting-flow/ui/components/presentation/scrim.tsx` (create) | radial or heavy legibility scrim |
| `src/features/meeting-flow/ui/components/presentation/pinned-column.tsx` (create) | sticky companion column / top band |
| `src/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot.tsx` (create) | labeled dashed media placeholder |
| `src/features/meeting-flow/ui/components/steps/who-we-are/document-card.tsx` (create) | paper document button |
| `src/features/meeting-flow/ui/components/steps/who-we-are/document-dialog.tsx` (create) | lazy full-size document dialog |
| `src/features/meeting-flow/ui/components/steps/who-we-are/point-media-layer.tsx` (create) | media by `PointMedia.type` |
| `src/features/meeting-flow/ui/components/steps/who-we-are/hook-section.tsx` (create) | beat 1 |
| `src/features/meeting-flow/ui/components/steps/who-we-are/credentials-section.tsx` (create) | beat 2 |
| `src/features/meeting-flow/ui/components/steps/who-we-are/point-section.tsx` (create) | beats 3–8 |
| `src/features/meeting-flow/ui/components/steps/who-we-are/truth-section.tsx` (create) | beat 9 |
| `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx` (create) | `WhoWeAreStep` composition |
| `src/features/meeting-flow/ui/views/meeting-flow.tsx` (modify) | `presentation` layout branch, `onContinue` |
| `src/features/meeting-flow/ui/components/steps/who-we-are-step.tsx` (delete) | superseded |

---

### Task 1: Types, step layout flag, motion tokens, section data

**Files:**
- Modify: `src/features/meeting-flow/types/index.ts` (append after the `MeetingStepId` type)
- Modify: `src/features/meeting-flow/constants/step-config.ts`
- Create: `src/features/meeting-flow/constants/presentation-motion.ts`
- Create: `src/features/meeting-flow/constants/who-we-are-sections.ts`

**Interfaces:**
- Consumes: `DUE_DILIGENCE_ITEMS` from `constants/due-diligence.ts` (fields `title`, `short`, `stat`, `statLabel`), `companyInfo` from `@/shared/constants/company`, `R2_BUCKETS` / `R2_PUBLIC_DOMAINS` from `@/shared/services/providers/r2/types`.
- Produces: `MeetingStepLayout`, `PointMedia`, `PresentationDocument`, `ProofItem`, `PinnedSummary`, `WhoWeAreSection` types; `MeetingStepConfig.layout`; `REVEAL_VARIANTS`, `REVEAL_TRANSITION`, `REVEAL_STAGGER_S`, `IMAGE_SETTLE_VARIANTS`, `PIN_SWAP_TRANSITION`; `WHO_WE_ARE_SECTIONS: WhoWeAreSection[]`, `WHO_WE_ARE_PINNED: PinnedSummary[]`.

- [ ] **Step 1: Add the presentation types**

Append to `src/features/meeting-flow/types/index.ts` directly after the `MeetingStepId` type block:

```ts
// ── Presentation (scroll-snap step layout) ─────────────────────────────────

/** `page` = padded scrolling document; `presentation` = the step owns a snapping scroller. */
export type MeetingStepLayout = 'page' | 'presentation'

export type PointMedia
  = | { type: 'photo', src: string, alt: string }
    | { type: 'portrait', src: string, alt: string }
    | { type: 'pair', before: string, after: string, alt: string }
    | { type: 'placeholder', label: string }

export interface PresentationDocument {
  title: string
  src: string
  alt: string
}

export interface ProofItem {
  value: string
  label: string
}

/** What the pinned column shows for one section. */
export interface PinnedSummary {
  number?: number
  title: string
  line: string
  count?: string
}

export type WhoWeAreSection
  = | {
    kind: 'hook'
    id: string
    title: string
    subtitle: string
    accent: string
    image: string
    imageAlt: string
  }
  | {
    kind: 'credentials'
    id: string
    title: string
    documents: PresentationDocument[]
    proof: ProofItem[]
  }
  | {
    kind: 'point'
    id: string
    number: number
    title: string
    line: string
    proof: string
    proofLabel: string
    media: PointMedia
  }
  | {
    kind: 'truth'
    id: string
    title: string
    quote: string
    ctaLabel: string
    image: string
    imageAlt: string
  }
```

- [ ] **Step 2: Add `layout` to the step config**

In `src/features/meeting-flow/constants/step-config.ts`, change the import and interface, and add `layout` to every step:

```ts
import type { MeetingStepId, MeetingStepLayout } from '@/features/meeting-flow/types'

export interface MeetingStepConfig {
  id: MeetingStepId
  stepNumber: number
  title: string
  shortLabel: string
  isCustomerFacing: boolean
  layout: MeetingStepLayout
}
```

Then add `layout: 'presentation',` to the `who-we-are` entry and `layout: 'page',` to each of the other six entries (`specialties`, `portfolio`, `deal-structure`, `program`, `closing`, `create-proposal`), placed after `isCustomerFacing`.

- [ ] **Step 3: Create the motion tokens**

Create `src/features/meeting-flow/constants/presentation-motion.ts`:

```ts
import type { Transition, Variants } from 'motion/react'

/** Exponential ease-out shared by every presentation reveal. */
export const PRESENTATION_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const REVEAL_TRANSITION: Transition = { duration: 0.5, ease: PRESENTATION_EASE }

/**
 * Text groups rise into place. Transitions are set on the <Reveal> component, not
 * here, so a per-element stagger delay can be merged in.
 */
export const REVEAL_VARIANTS: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

/** Delay between sibling reveals inside one section, in seconds. */
export const REVEAL_STAGGER_S = 0.09

/** Images settle from a slight zoom on first reveal. Applied to an inner wrapper only. */
export const IMAGE_SETTLE_VARIANTS: Variants = {
  hidden: { scale: 1.06 },
  visible: { scale: 1, transition: { duration: 1.8, ease: PRESENTATION_EASE } },
}

export const PIN_SWAP_TRANSITION: Transition = { duration: 0.18, ease: 'easeOut' }
```

- [ ] **Step 4: Create the section data**

Create `src/features/meeting-flow/constants/who-we-are-sections.ts`:

```ts
import type { PinnedSummary, WhoWeAreSection } from '@/features/meeting-flow/types'
import { DUE_DILIGENCE_ITEMS } from '@/features/meeting-flow/constants/due-diligence'
import { companyInfo } from '@/shared/constants/company'
import { R2_BUCKETS, R2_PUBLIC_DOMAINS } from '@/shared/services/providers/r2/types'

const DOCS_BASE = R2_PUBLIC_DOMAINS[R2_BUCKETS.companyDocs] ?? ''
const founder = companyInfo.teamInfo.owners[0]
const generalLiability = companyInfo.insurances.find(i => i.label.includes('General Liability'))
const [licensing, scope, supervision, communication, office, performance] = DUE_DILIGENCE_ITEMS

/** Stand-in imagery from the public site until the step gets its own shoot. */
const IMAGES = {
  hook: '/hero-photos/modern-house-5.jpg',
  licensing: '/process/pre-construction-stage.jpeg',
  scope: '/process/design-stage.jpeg',
  supervision: '/process/construction-stage.jpeg',
  before: '/portfolio-photos/projects/Riviera/hero-before.jpeg',
  after: '/portfolio-photos/projects/Riviera/hero-after.jpeg',
  truth: '/process/handover-stage.jpeg',
} as const

export const WHO_WE_ARE_SECTIONS: WhoWeAreSection[] = [
  {
    kind: 'hook',
    id: 'hook',
    title: 'A successful project doesn’t start on demolition day.',
    subtitle: 'It starts when you do your',
    accent: 'due diligence.',
    image: IMAGES.hook,
    imageAlt: 'Finished home exterior at dusk',
  },
  {
    kind: 'credentials',
    id: 'credentials',
    title: 'Licensed. Insured. Verifiable.',
    documents: DOCS_BASE
      ? [
          {
            title: 'Contractor license',
            src: `${DOCS_BASE}/tpr-license.jpg`,
            alt: `${companyInfo.name} contractor license`,
          },
          {
            title: 'Certificate of insurance',
            src: `${DOCS_BASE}/tpr-coi-2026.jpg`,
            alt: `${companyInfo.name} certificate of liability insurance`,
          },
        ]
      : [],
    proof: [
      { value: `#${companyInfo.licenses[0]?.licenseNumber ?? '—'}`, label: 'CA contractor license' },
      { value: generalLiability?.coverage.replace(' Coverage', '') ?? '—', label: 'General liability coverage' },
      { value: `${companyInfo.numProjects}+`, label: 'Southern California projects' },
    ],
  },
  {
    kind: 'point',
    id: 'licensing',
    number: 1,
    title: 'Proper licensing and permits',
    line: licensing.short,
    proof: licensing.stat,
    proofLabel: licensing.statLabel,
    media: { type: 'photo', src: IMAGES.licensing, alt: 'Contractor and homeowner at a framed house' },
  },
  {
    kind: 'point',
    id: 'scope',
    number: 2,
    title: 'A clear scope of work',
    line: scope.short,
    proof: scope.stat,
    proofLabel: scope.statLabel,
    media: { type: 'photo', src: IMAGES.scope, alt: 'Project consultant writing a scope with plans and samples on the table' },
  },
  {
    kind: 'point',
    id: 'supervision',
    number: 3,
    title: 'Proper supervision',
    line: supervision.short,
    proof: supervision.stat,
    proofLabel: supervision.statLabel,
    media: { type: 'photo', src: IMAGES.supervision, alt: 'Crew pouring a driveway while a supervisor watches' },
  },
  {
    kind: 'point',
    id: 'communication',
    number: 4,
    title: 'Communication',
    line: communication.short,
    proof: founder.name,
    proofLabel: `${founder.title}, your direct line`,
    media: { type: 'portrait', src: `/${founder.image}`, alt: `${founder.name}, ${founder.title}` },
  },
  {
    kind: 'point',
    id: 'office',
    number: 5,
    title: 'Office support',
    line: office.short,
    proof: office.stat,
    proofLabel: office.statLabel,
    media: { type: 'placeholder', label: 'Office and team photo, to be shot' },
  },
  {
    kind: 'point',
    id: 'performance',
    number: 6,
    title: 'Proof of performance',
    line: performance.short,
    proof: performance.stat,
    proofLabel: performance.statLabel,
    media: { type: 'pair', before: IMAGES.before, after: IMAGES.after, alt: 'Riviera project' },
  },
  {
    kind: 'truth',
    id: 'truth',
    title: 'Success isn’t about the finishes.',
    quote: 'Many times it boils down to communication, supervision, leadership, and accountability. That is what makes it the real deal.',
    ctaLabel: 'Continue to Specialties',
    image: IMAGES.truth,
    imageAlt: 'Keys handed to a homeowner in their finished living room',
  },
]

const POINT_COUNT = WHO_WE_ARE_SECTIONS.filter(section => section.kind === 'point').length

export const WHO_WE_ARE_PINNED: PinnedSummary[] = WHO_WE_ARE_SECTIONS.map((section) => {
  switch (section.kind) {
    case 'hook':
      return { title: 'Navigating the construction industry', line: 'What a legitimate project actually requires.' }
    case 'credentials':
      return { title: 'Our credentials', line: 'Licensed, insured, verifiable.' }
    case 'point':
      return { number: section.number, title: section.title, line: section.line, count: `${section.number} of ${POINT_COUNT}` }
    case 'truth':
      return { title: 'The real deal', line: 'Done once. Done right.' }
  }
})
```

- [ ] **Step 5: Type-check and lint**

Run:

```bash
pnpm tsc
pnpm exec eslint src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/step-config.ts src/features/meeting-flow/constants/presentation-motion.ts src/features/meeting-flow/constants/who-we-are-sections.ts
```

Expected: both exit 0. If eslint reorders imports, apply its `--fix` and re-run.

- [ ] **Step 6: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/types/index.ts src/features/meeting-flow/constants/step-config.ts src/features/meeting-flow/constants/presentation-motion.ts src/features/meeting-flow/constants/who-we-are-sections.ts
git commit -m "feat(meeting-flow): presentation types, step layout flag, and Who We Are section data

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Presentation primitive — context, scroller, section, reveal, image, scrim

**Files:**
- Create: `src/features/meeting-flow/contexts/presentation-context.tsx`
- Create: `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx`
- Create: `src/features/meeting-flow/ui/components/presentation/snap-section.tsx`
- Create: `src/features/meeting-flow/ui/components/presentation/reveal.tsx`
- Create: `src/features/meeting-flow/ui/components/presentation/section-image.tsx`
- Create: `src/features/meeting-flow/ui/components/presentation/scrim.tsx`

**Interfaces:**
- Consumes: motion tokens from Task 1.
- Produces:
  - `usePresentation(): { scrollerRef: RefObject<HTMLDivElement | null>, activeIndex: number, reportInView: (index: number, inView: boolean) => void }`
  - `useSectionInView(): boolean`
  - `<SnapPresentation label aside children className?>`
  - `<SnapSection index id labelledBy children className?>`
  - `<Reveal order? ...HTMLMotionProps<'div'>>`
  - `<SectionImage src alt priority? className? imageClassName?>`
  - `<Scrim variant?: 'radial' | 'heavy' className?>`
  - CSS custom properties set on the scroller and inherited by everything inside: `--pin-h`, `--presentation-ground`, `--presentation-accent`.

- [ ] **Step 1: Create the contexts**

Create `src/features/meeting-flow/contexts/presentation-context.tsx`:

```tsx
'use client'

import type { RefObject } from 'react'
import { createContext, useContext } from 'react'

export interface PresentationContextValue {
  /** The snapping scroll container. Pass as `root` to every `useInView` inside. */
  scrollerRef: RefObject<HTMLDivElement | null>
  /** Index of the section currently past the in-view threshold. */
  activeIndex: number
  reportInView: (index: number, inView: boolean) => void
}

export const PresentationContext = createContext<PresentationContextValue | null>(null)

export function usePresentation(): PresentationContextValue {
  const ctx = useContext(PresentationContext)
  if (!ctx) {
    throw new Error('usePresentation must be used inside <SnapPresentation>')
  }
  return ctx
}

/** Whether the enclosing <SnapSection> is in view. Drives <Reveal> and <SectionImage>. */
export const SectionInViewContext = createContext(false)

export function useSectionInView(): boolean {
  return useContext(SectionInViewContext)
}
```

- [ ] **Step 2: Create the scroller**

Create `src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { MotionConfig } from 'motion/react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { PresentationContext } from '@/features/meeting-flow/contexts/presentation-context'
import { cn } from '@/shared/lib/utils'

interface SnapPresentationProps {
  /** Accessible name for the scroll region, e.g. "Who we are presentation". */
  label: string
  /** The sticky companion: first grid column on lg+, top band below. */
  aside: ReactNode
  children: ReactNode
  className?: string
}

/**
 * Full-height, section-snapping scroller for `presentation`-layout steps.
 * Snap is the browser's (CSS scroll-snap); the only JS is in-view tracking.
 * Recipe and citations: docs/plans/2026-09-11-meeting-flow-scroll-snap-research.md
 *
 * Sizing contract: this element is a size container, so children size with
 * `cqh`/`cqw`. `--pin-h` is the sticky band height below `lg` (0 on lg+); sections
 * subtract it and the scroller pads snap positions by it.
 */
export function SnapPresentation({ label, aside, children, className }: SnapPresentationProps) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const reportInView = useCallback((index: number, inView: boolean) => {
    if (inView) {
      setActiveIndex(index)
    }
  }, [])

  const value = useMemo(
    () => ({ scrollerRef, activeIndex, reportInView }),
    [activeIndex, reportInView],
  )

  return (
    <MotionConfig reducedMotion="user">
      <PresentationContext.Provider value={value}>
        <div
          ref={scrollerRef}
          aria-label={label}
          className={cn(
            'relative min-h-0 flex-1 overflow-y-auto overscroll-contain',
            'snap-y snap-mandatory motion-safe:scroll-smooth [container-type:size]',
            '[--pin-h:30cqh] lg:[--pin-h:0px] scroll-pt-(--pin-h)',
            '[--presentation-ground:oklch(0.2_0.028_257)] [--presentation-accent:oklch(0.8_0.12_259.8)]',
            'bg-(--presentation-ground) text-white',
            'outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
            className,
          )}
          role="region"
          tabIndex={0}
        >
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(16rem,38%)_1fr]">
            {aside}
            <div>{children}</div>
          </div>
        </div>
      </PresentationContext.Provider>
    </MotionConfig>
  )
}
```

- [ ] **Step 3: Create the section**

Create `src/features/meeting-flow/ui/components/presentation/snap-section.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'
import { useInView } from 'motion/react'
import { useEffect, useRef } from 'react'
import { SectionInViewContext, usePresentation } from '@/features/meeting-flow/contexts/presentation-context'
import { cn } from '@/shared/lib/utils'

interface SnapSectionProps {
  /** Position in the presentation; reported as the active index when in view. */
  index: number
  id: string
  /** id of the heading element rendered inside this section. */
  labelledBy: string
  children: ReactNode
  className?: string
}

/**
 * One snap target. The <section> box is never transformed: snap areas are computed
 * from the transformed border box, so every reveal lives on an inner element.
 */
export function SnapSection({ index, id, labelledBy, children, className }: SnapSectionProps) {
  const ref = useRef<HTMLElement>(null)
  const { scrollerRef, reportInView } = usePresentation()
  const inView = useInView(ref, { root: scrollerRef, amount: 0.5 })

  useEffect(() => {
    reportInView(index, inView)
  }, [index, inView, reportInView])

  return (
    <SectionInViewContext.Provider value={inView}>
      <section
        ref={ref}
        aria-labelledby={labelledBy}
        className={cn(
          'relative min-h-[calc(100cqh-var(--pin-h))] snap-start snap-always overflow-hidden',
          className,
        )}
        id={id}
      >
        {children}
      </section>
    </SectionInViewContext.Provider>
  )
}
```

- [ ] **Step 4: Create the reveal**

Create `src/features/meeting-flow/ui/components/presentation/reveal.tsx`:

```tsx
'use client'

import type { HTMLMotionProps } from 'motion/react'
import { motion } from 'motion/react'
import { REVEAL_STAGGER_S, REVEAL_TRANSITION, REVEAL_VARIANTS } from '@/features/meeting-flow/constants/presentation-motion'
import { useSectionInView } from '@/features/meeting-flow/contexts/presentation-context'

interface RevealProps extends HTMLMotionProps<'div'> {
  /** Position in the section's stagger order; 0 animates first. */
  order?: number
}

/**
 * Text and proof groups rise in when their section is in view. Never wrap media or
 * the section itself. `initial={false}` renders a section that is already in view
 * at rest instead of parking it at opacity 0.
 */
export function Reveal({ order = 0, transition, ...props }: RevealProps) {
  const inView = useSectionInView()
  return (
    <motion.div
      animate={inView ? 'visible' : 'hidden'}
      initial={false}
      transition={{ ...REVEAL_TRANSITION, delay: order * REVEAL_STAGGER_S, ...transition }}
      variants={REVEAL_VARIANTS}
      {...props}
    />
  )
}
```

- [ ] **Step 5: Create the section image**

Create `src/features/meeting-flow/ui/components/presentation/section-image.tsx`:

```tsx
'use client'

import { motion } from 'motion/react'
import Image from 'next/image'
import { IMAGE_SETTLE_VARIANTS } from '@/features/meeting-flow/constants/presentation-motion'
import { useSectionInView } from '@/features/meeting-flow/contexts/presentation-context'
import { cn } from '@/shared/lib/utils'

interface SectionImageProps {
  src: string
  alt: string
  /** Set on the first section so its image is fetched eagerly. */
  priority?: boolean
  /** Position/size overrides for the wrapper (defaults to full bleed). */
  className?: string
  /** `object-position` and similar overrides for the image. */
  imageClassName?: string
}

/** Full-bleed photo that settles from a slight zoom when its section comes into view. */
export function SectionImage({ src, alt, priority = false, className, imageClassName }: SectionImageProps) {
  const inView = useSectionInView()
  return (
    <motion.div
      animate={inView ? 'visible' : 'hidden'}
      className={cn('absolute inset-0', className)}
      initial={false}
      variants={IMAGE_SETTLE_VARIANTS}
    >
      <Image
        alt={alt}
        className={cn('object-cover', imageClassName)}
        draggable={false}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 62vw, 100vw"
        src={src}
      />
    </motion.div>
  )
}
```

- [ ] **Step 6: Create the scrim**

Create `src/features/meeting-flow/ui/components/presentation/scrim.tsx`:

```tsx
import { cn } from '@/shared/lib/utils'

interface ScrimProps {
  /** `radial` keeps the photo alive with a lit lower-left; `heavy` is a near-solid wash for typographic sections. */
  variant?: 'radial' | 'heavy'
  className?: string
}

/** Legibility over photography per DESIGN.md's scrim-not-blur rule. */
export function Scrim({ variant = 'radial', className }: ScrimProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0', className)}
      style={{
        backgroundImage: variant === 'heavy'
          ? 'linear-gradient(oklch(0.14 0.03 257 / 0.86), oklch(0.14 0.03 257 / 0.86))'
          : 'radial-gradient(130% 95% at 18% 100%, oklch(0.14 0.03 257 / 0.94), oklch(0.14 0.03 257 / 0.42) 52%, transparent 82%), linear-gradient(to top, oklch(0.14 0.03 257 / 0.85), transparent 58%)',
      }}
    />
  )
}
```

- [ ] **Step 7: Type-check and lint**

Run:

```bash
pnpm tsc
pnpm exec eslint src/features/meeting-flow/contexts/presentation-context.tsx src/features/meeting-flow/ui/components/presentation
```

Expected: both exit 0.

- [ ] **Step 8: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/contexts/presentation-context.tsx src/features/meeting-flow/ui/components/presentation/snap-presentation.tsx src/features/meeting-flow/ui/components/presentation/snap-section.tsx src/features/meeting-flow/ui/components/presentation/reveal.tsx src/features/meeting-flow/ui/components/presentation/section-image.tsx src/features/meeting-flow/ui/components/presentation/scrim.tsx
git commit -m "feat(meeting-flow): snap presentation primitive (scroller, section, reveal, image, scrim)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pinned column

**Files:**
- Create: `src/features/meeting-flow/ui/components/presentation/pinned-column.tsx`

**Interfaces:**
- Consumes: `usePresentation().activeIndex`, `PinnedSummary`, `PIN_SWAP_TRANSITION`, the `--pin-h` custom property from the scroller.
- Produces: `<PinnedColumn summaries: PinnedSummary[]>` rendering an `<aside>` meant to be the `aside` prop of `SnapPresentation`.

- [ ] **Step 1: Create the component**

Create `src/features/meeting-flow/ui/components/presentation/pinned-column.tsx`:

```tsx
'use client'

import type { PinnedSummary } from '@/features/meeting-flow/types'
import { AnimatePresence, motion } from 'motion/react'
import { PIN_SWAP_TRANSITION } from '@/features/meeting-flow/constants/presentation-motion'
import { usePresentation } from '@/features/meeting-flow/contexts/presentation-context'

interface PinnedColumnProps {
  /** One entry per section, in section order. */
  summaries: PinnedSummary[]
}

/**
 * Sticky companion that names the current section. Side column on lg+ (full
 * scroller height, content bottom-aligned), top band below (`--pin-h` tall).
 * Sticky inside a snap container is fine; it carries no snap alignment itself.
 */
export function PinnedColumn({ summaries }: PinnedColumnProps) {
  const { activeIndex } = usePresentation()
  const current = summaries[activeIndex] ?? summaries[0]
  if (!current) {
    return null
  }

  return (
    <aside
      className="sticky top-0 z-10 grid h-(--pin-h) content-end gap-[1cqh] self-start border-b border-white/15 bg-(--presentation-ground) px-[6cqw] py-[3cqh] lg:h-[100cqh] lg:border-b-0 lg:px-[5cqw] lg:py-[5cqh]"
    >
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={activeIndex}
          animate={{ opacity: 1, y: 0 }}
          className="grid gap-[1cqh]"
          exit={{ opacity: 0, y: -6 }}
          initial={{ opacity: 0, y: 8 }}
          transition={PIN_SWAP_TRANSITION}
        >
          {current.number !== undefined && (
            <span aria-hidden className="hidden font-serif text-[14cqw] leading-[0.9] tracking-tight text-white/25 lg:block">
              {current.number}
            </span>
          )}
          <p className="font-sans text-[5.5cqw] font-semibold leading-[1.08] tracking-tight text-balance lg:text-[3.3cqw]">
            {current.title}
          </p>
          <p className="text-[3cqw] text-white/70 lg:text-[1.5cqw]">{current.line}</p>
          {current.count && (
            <p className="text-[2.4cqw] text-white/50 tabular-nums lg:text-[1.15cqw]">{current.count}</p>
          )}
        </motion.div>
      </AnimatePresence>
    </aside>
  )
}
```

- [ ] **Step 2: Type-check and lint**

Run:

```bash
pnpm tsc
pnpm exec eslint src/features/meeting-flow/ui/components/presentation/pinned-column.tsx
```

Expected: both exit 0.

- [ ] **Step 3: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/ui/components/presentation/pinned-column.tsx
git commit -m "feat(meeting-flow): pinned column for the snap presentation

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Who We Are media atoms — placeholder, document card, document dialog, media layer

**Files:**
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/document-card.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/document-dialog.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/point-media-layer.tsx`

**Interfaces:**
- Consumes: `PointMedia`, `PresentationDocument` (Task 1); `SectionImage`, `Scrim` (Task 2); shadcn `Dialog`, `DialogContent`, `DialogTitle` from `@/shared/components/ui/dialog`.
- Produces: `<PlaceholderSlot label className?>`, `<DocumentCard document onOpen className?>`, `<DocumentDialog document: PresentationDocument | null, onClose>`, `<PointMediaLayer media: PointMedia>`.

- [ ] **Step 1: Placeholder slot**

Create `src/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot.tsx`:

```tsx
import { cn } from '@/shared/lib/utils'

interface PlaceholderSlotProps {
  label: string
  className?: string
}

/** Honest stand-in for imagery that has not been shot yet. Never ships silently. */
export function PlaceholderSlot({ label, className }: PlaceholderSlotProps) {
  return (
    <div
      className={cn('absolute inset-0', className)}
      style={{ backgroundImage: 'repeating-linear-gradient(45deg, oklch(1 0 0 / 0.035) 0 2px, transparent 2px 14px)' }}
    >
      <div className="absolute inset-x-[6cqw] top-[6cqh] bottom-[48%] grid place-items-center rounded-md border-[1.5px] border-dashed border-white/30 p-[2cqw] text-center text-[2.4cqw] text-white/55 lg:top-[8cqh] lg:bottom-[42%] lg:text-[1.5cqw]">
        {label}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Document card**

Create `src/features/meeting-flow/ui/components/steps/who-we-are/document-card.tsx`:

```tsx
'use client'

import type { PresentationDocument } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { cn } from '@/shared/lib/utils'

interface DocumentCardProps {
  document: PresentationDocument
  onOpen: () => void
  /** Placement and rotation; rotation lives here, never on a <Reveal> wrapper. */
  className?: string
}

/** A paper document laid on the desk. Tap to read it full size. */
export function DocumentCard({ document, onOpen, className }: DocumentCardProps) {
  return (
    <button
      aria-label={`Open ${document.title}`}
      className={cn(
        'block h-full w-full cursor-zoom-in bg-white p-[0.9cqw] shadow-2xl shadow-black/60 outline-none',
        'focus-visible:ring-[3px] focus-visible:ring-ring/50',
        className,
      )}
      type="button"
      onClick={onOpen}
    >
      <span className="relative block h-full w-full">
        <Image
          alt={document.alt}
          className="object-cover object-top"
          draggable={false}
          fill
          sizes="(min-width: 1024px) 30vw, 60vw"
          src={document.src}
        />
      </span>
    </button>
  )
}
```

- [ ] **Step 3: Document dialog (lazy, by decision)**

Create `src/features/meeting-flow/ui/components/steps/who-we-are/document-dialog.tsx`:

```tsx
'use client'

// LAZY: first-pass stopgap. The shared `PhotoLightbox`
// (src/features/project-management/ui/components/photo-lightbox.tsx) is bound to
// `MediaFile` records, so this ships a minimal dialog instead of extending it.
// Migrate onto the lightbox and delete this file when that container is
// generalized. See docs/superpowers/specs/2026-09-12-who-we-are-scroll-presentation-design.md §4.3.

import type { PresentationDocument } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { Dialog, DialogContent, DialogTitle } from '@/shared/components/ui/dialog'

interface DocumentDialogProps {
  /** The document to show; `null` keeps the dialog closed. */
  document: PresentationDocument | null
  onClose: () => void
}

/** Full-size, contained view of a credential document on the dark ground. */
export function DocumentDialog({ document, onClose }: DocumentDialogProps) {
  return (
    <Dialog open={document !== null} onOpenChange={open => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="h-[92dvh] w-[min(96vw,1100px)] max-w-none border-0 bg-[oklch(0.14_0.03_257)] p-2 sm:max-w-none"
      >
        {document && (
          <>
            <DialogTitle className="sr-only">{document.title}</DialogTitle>
            <button
              aria-label={`Close ${document.title}`}
              className="relative block h-full w-full cursor-zoom-out outline-none"
              type="button"
              onClick={onClose}
            >
              <Image
                alt={document.alt}
                className="object-contain"
                draggable={false}
                fill
                sizes="96vw"
                src={document.src}
              />
            </button>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Point media layer**

Create `src/features/meeting-flow/ui/components/steps/who-we-are/point-media-layer.tsx`:

```tsx
import type { PointMedia } from '@/features/meeting-flow/types'
import Image from 'next/image'
import { Scrim } from '@/features/meeting-flow/ui/components/presentation/scrim'
import { SectionImage } from '@/features/meeting-flow/ui/components/presentation/section-image'
import { PlaceholderSlot } from '@/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot'

interface PointMediaLayerProps {
  media: PointMedia
}

/**
 * Media for a point section, by kind. `photo` is full bleed under the radial scrim;
 * `portrait` takes the right 46% on lg+ (top 62% below) with a fade into the ground;
 * `pair` splits before/after; `placeholder` is the labeled slot.
 */
export function PointMediaLayer({ media }: PointMediaLayerProps) {
  if (media.type === 'photo') {
    return (
      <>
        <SectionImage alt={media.alt} src={media.src} />
        <Scrim />
      </>
    )
  }

  if (media.type === 'portrait') {
    return (
      <>
        <SectionImage
          alt={media.alt}
          className="inset-auto top-0 right-0 h-[62%] w-full lg:h-full lg:w-[46%]"
          imageClassName="object-[50%_15%]"
          src={media.src}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 lg:hidden"
          style={{ background: 'linear-gradient(to top, var(--presentation-ground) 40%, color-mix(in oklab, var(--presentation-ground) 50%, transparent) 55%, transparent 72%)' }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 hidden lg:block"
          style={{ background: 'linear-gradient(90deg, var(--presentation-ground) 48%, color-mix(in oklab, var(--presentation-ground) 60%, transparent) 58%, transparent 78%)' }}
        />
      </>
    )
  }

  if (media.type === 'pair') {
    return (
      <>
        <div className="absolute top-0 left-0 h-1/2 w-full overflow-hidden lg:h-full lg:w-1/2">
          <Image alt={`${media.alt}, before`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 31vw, 100vw" src={media.before} />
          <span className="absolute top-[3cqh] left-[3cqw] rounded-[3px] bg-black/55 px-[0.7em] py-[0.3em] font-sans text-[2.2cqw] font-semibold lg:text-[1.4cqw]">
            Before
          </span>
        </div>
        <div className="absolute bottom-0 left-0 h-1/2 w-full overflow-hidden lg:top-0 lg:right-0 lg:left-auto lg:h-full lg:w-1/2">
          <Image alt={`${media.alt}, after`} className="object-cover" draggable={false} fill sizes="(min-width: 1024px) 31vw, 100vw" src={media.after} />
          <span className="absolute top-[3cqh] left-[3cqw] rounded-[3px] bg-white/90 px-[0.7em] py-[0.3em] font-sans text-[2.2cqw] font-semibold text-(--presentation-ground) lg:text-[1.4cqw]">
            After
          </span>
        </div>
        <div aria-hidden className="absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 bg-white/80 lg:inset-y-0 lg:left-1/2 lg:h-auto lg:w-0.5 lg:translate-x-[-50%] lg:translate-y-0" />
        <Scrim />
      </>
    )
  }

  return <PlaceholderSlot label={media.label} />
}
```

- [ ] **Step 5: Type-check and lint**

Run:

```bash
pnpm tsc
pnpm exec eslint src/features/meeting-flow/ui/components/steps/who-we-are
```

Expected: both exit 0.

- [ ] **Step 6: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot.tsx src/features/meeting-flow/ui/components/steps/who-we-are/document-card.tsx src/features/meeting-flow/ui/components/steps/who-we-are/document-dialog.tsx src/features/meeting-flow/ui/components/steps/who-we-are/point-media-layer.tsx
git commit -m "feat(meeting-flow): Who We Are media atoms (placeholder, document card, lazy document dialog, media layer)

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The four section components

**Files:**
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/hook-section.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/credentials-section.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/point-section.tsx`
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/truth-section.tsx`

**Interfaces:**
- Consumes: `WhoWeAreSection` (Task 1); `SnapSection`, `Reveal`, `SectionImage`, `Scrim` (Task 2); `PlaceholderSlot`, `DocumentCard`, `DocumentDialog`, `PointMediaLayer` (Task 4); `Button` from `@/shared/components/ui/button`; `ArrowRightIcon` from `lucide-react`.
- Produces: `<HookSection index section>`, `<CredentialsSection index section>`, `<PointSection index section>`, `<TruthSection index section onContinue>`. Every section renders an `h2` whose id is `${section.id}-title` and passes it as `labelledBy`.

- [ ] **Step 1: Hook section**

Create `src/features/meeting-flow/ui/components/steps/who-we-are/hook-section.tsx`:

```tsx
'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { Scrim } from '@/features/meeting-flow/ui/components/presentation/scrim'
import { SectionImage } from '@/features/meeting-flow/ui/components/presentation/section-image'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'

interface HookSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'hook' }>
}

/** Beat 1: the opening line over the finished-home photo. */
export function HookSection({ index, section }: HookSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <SectionImage alt={section.imageAlt} priority src={section.image} />
      <Scrim />
      <div className="absolute inset-x-[6cqw] bottom-[8cqh] grid gap-[1.5cqh] lg:bottom-[6cqh]">
        <Reveal order={0}>
          <h2
            className="max-w-[15ch] font-sans text-[8cqw] leading-[1.04] font-medium tracking-tight text-balance lg:text-[6.2cqw]"
            id={headingId}
          >
            {section.title}
          </h2>
        </Reveal>
        <Reveal order={1}>
          <p className="font-serif text-[4.2cqw] italic lg:text-[3cqw]">
            {section.subtitle}
            {' '}
            <span className="text-(--presentation-accent)">{section.accent}</span>
          </p>
        </Reveal>
      </div>
    </SnapSection>
  )
}
```

- [ ] **Step 2: Credentials section**

Create `src/features/meeting-flow/ui/components/steps/who-we-are/credentials-section.tsx`:

```tsx
'use client'

import type { PresentationDocument, WhoWeAreSection } from '@/features/meeting-flow/types'
import { useState } from 'react'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { DocumentCard } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-card'
import { DocumentDialog } from '@/features/meeting-flow/ui/components/steps/who-we-are/document-dialog'
import { PlaceholderSlot } from '@/features/meeting-flow/ui/components/steps/who-we-are/placeholder-slot'

interface CredentialsSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'credentials' }>
}

/**
 * Beat 2: the license and the certificate of insurance laid like paper on the desk,
 * with the derived proof strip along the bottom. Zones are fixed so nothing overlaps:
 * heading (top), documents (middle), strip (bottom).
 */
export function CredentialsSection({ index, section }: CredentialsSectionProps) {
  const [openDocument, setOpenDocument] = useState<PresentationDocument | null>(null)
  const headingId = `${section.id}-title`

  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(oklch(1 0 0 / 0.045) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0 / 0.045) 1px, transparent 1px)',
          backgroundSize: '6cqw 6cqw',
          maskImage: 'radial-gradient(80% 70% at 60% 40%, #000, transparent)',
        }}
      />

      <div className="absolute inset-x-[6cqw] top-[5cqh]">
        <Reveal order={0}>
          <h2
            className="max-w-[14ch] font-sans text-[6cqw] leading-[1.04] font-semibold tracking-tight text-balance lg:text-[4.8cqw]"
            id={headingId}
          >
            {section.title}
          </h2>
        </Reveal>
      </div>

      <div className="absolute inset-x-[6cqw] top-[24cqh] bottom-[30cqh] lg:top-[20cqh] lg:right-[6cqw] lg:bottom-[26cqh] lg:left-auto lg:w-[50cqw]">
        {section.documents.length === 0
          ? <PlaceholderSlot className="inset-0" label="License and certificate of insurance" />
          : section.documents.map((document, position) => (
              <Reveal
                key={document.title}
                className={position === 0
                  ? 'absolute top-[4%] left-0 z-10 aspect-[3/2] w-[62%]'
                  : 'absolute top-[10%] right-0 h-[86%] w-[44%]'}
                order={position + 1}
              >
                <DocumentCard
                  className={position === 0 ? '-rotate-3' : 'rotate-2'}
                  document={document}
                  onOpen={() => setOpenDocument(document)}
                />
              </Reveal>
            ))}
      </div>

      <dl className="absolute inset-x-[6cqw] bottom-[5cqh] flex flex-wrap gap-x-[4cqw] gap-y-[1cqh] border-t border-white/20 pt-[2cqh]">
        {section.proof.map((item, position) => (
          <Reveal key={item.label} className="grid" order={position + 3}>
            <dt className="order-last text-[2cqw] text-white/60 lg:text-[1.2cqw]">{item.label}</dt>
            <dd className="font-sans text-[3.2cqw] font-bold tracking-tight tabular-nums lg:text-[2.4cqw]">
              {item.value}
            </dd>
          </Reveal>
        ))}
      </dl>

      <DocumentDialog document={openDocument} onClose={() => setOpenDocument(null)} />
    </SnapSection>
  )
}
```

- [ ] **Step 3: Point section**

Create `src/features/meeting-flow/ui/components/steps/who-we-are/point-section.tsx`:

```tsx
'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { PointMediaLayer } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-media-layer'

interface PointSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'point' }>
}

/** Beats 3–8: one due-diligence point. Media, the serif numeral, title, line, proof. */
export function PointSection({ index, section }: PointSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <PointMediaLayer media={section.media} />

      <Reveal className="absolute top-[3.5cqh] left-[6cqw]" order={0}>
        <span aria-hidden className="font-serif text-[22cqw] leading-[0.9] tracking-tight text-white/25 lg:text-[15cqw]">
          {section.number}
        </span>
      </Reveal>

      <div className="absolute inset-x-[6cqw] bottom-[6cqh] grid gap-[1.2cqh]">
        <Reveal order={1}>
          <h2
            className="max-w-[20ch] font-sans text-[6cqw] leading-[1.04] font-semibold tracking-tight text-balance lg:text-[4.8cqw]"
            id={headingId}
          >
            {section.title}
          </h2>
        </Reveal>
        <Reveal order={2}>
          <p className="max-w-[42ch] text-[2.8cqw] leading-snug text-white/80 lg:text-[1.95cqw]">{section.line}</p>
        </Reveal>
        <Reveal className="mt-[1cqh] flex flex-wrap items-baseline gap-x-[1.5cqw] gap-y-1" order={3}>
          <span className="font-sans text-[5.5cqw] leading-none font-bold tracking-tight text-(--presentation-accent) tabular-nums lg:text-[4.2cqw]">
            {section.proof}
          </span>
          <span className="max-w-[30ch] text-[2.2cqw] text-white/65 lg:text-[1.5cqw]">{section.proofLabel}</span>
        </Reveal>
      </div>
    </SnapSection>
  )
}
```

- [ ] **Step 4: Truth section**

Create `src/features/meeting-flow/ui/components/steps/who-we-are/truth-section.tsx`:

```tsx
'use client'

import type { WhoWeAreSection } from '@/features/meeting-flow/types'
import { ArrowRightIcon } from 'lucide-react'
import { Reveal } from '@/features/meeting-flow/ui/components/presentation/reveal'
import { Scrim } from '@/features/meeting-flow/ui/components/presentation/scrim'
import { SectionImage } from '@/features/meeting-flow/ui/components/presentation/section-image'
import { SnapSection } from '@/features/meeting-flow/ui/components/presentation/snap-section'
import { Button } from '@/shared/components/ui/button'

interface TruthSectionProps {
  index: number
  section: Extract<WhoWeAreSection, { kind: 'truth' }>
  /** Advances the meeting flow to the next step. */
  onContinue: () => void
}

/** Beat 9: the closing truth and the hand-off to the next step. */
export function TruthSection({ index, section, onContinue }: TruthSectionProps) {
  const headingId = `${section.id}-title`
  return (
    <SnapSection id={section.id} index={index} labelledBy={headingId}>
      <SectionImage alt={section.imageAlt} src={section.image} />
      <Scrim variant="heavy" />
      <div className="absolute inset-x-[8cqw] inset-y-0 grid content-center justify-items-start gap-[1.5cqh]">
        <Reveal order={0}>
          <h2
            className="max-w-[16ch] font-sans text-[6cqw] leading-[1.04] font-medium tracking-tight text-balance lg:text-[4.8cqw]"
            id={headingId}
          >
            {section.title}
          </h2>
        </Reveal>
        <Reveal order={1}>
          <p className="max-w-[34ch] font-serif text-[3.6cqw] leading-[1.35] text-white/85 italic lg:text-[2.6cqw]">
            {section.quote}
          </p>
        </Reveal>
        <Reveal order={2}>
          <Button className="mt-[1cqh]" size="lg" onClick={onContinue}>
            {section.ctaLabel}
            <ArrowRightIcon />
          </Button>
        </Reveal>
      </div>
    </SnapSection>
  )
}
```

- [ ] **Step 5: Type-check and lint**

Run:

```bash
pnpm tsc
pnpm exec eslint src/features/meeting-flow/ui/components/steps/who-we-are
```

Expected: both exit 0.

- [ ] **Step 6: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/ui/components/steps/who-we-are/hook-section.tsx src/features/meeting-flow/ui/components/steps/who-we-are/credentials-section.tsx src/features/meeting-flow/ui/components/steps/who-we-are/point-section.tsx src/features/meeting-flow/ui/components/steps/who-we-are/truth-section.tsx
git commit -m "feat(meeting-flow): Who We Are hook, credentials, point, and truth sections

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Compose the step, wire the view, retire the old step

**Files:**
- Create: `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx`
- Modify: `src/features/meeting-flow/ui/views/meeting-flow.tsx` (import at line 29; step content block around lines 216–240)
- Modify: `src/features/meeting-flow/constants/due-diligence.ts` (remove `CREDENTIAL_ITEMS` and the `generalLiability` lookup it alone used)
- Delete: `src/features/meeting-flow/ui/components/steps/who-we-are-step.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–5; `handleNext` already defined in the view.
- Produces: `<WhoWeAreStep onContinue: () => void>`; the view's `presentation` branch.

- [ ] **Step 1: Compose the step**

Create `src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx`:

```tsx
'use client'

import { WHO_WE_ARE_PINNED, WHO_WE_ARE_SECTIONS } from '@/features/meeting-flow/constants/who-we-are-sections'
import { PinnedColumn } from '@/features/meeting-flow/ui/components/presentation/pinned-column'
import { SnapPresentation } from '@/features/meeting-flow/ui/components/presentation/snap-presentation'
import { CredentialsSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/credentials-section'
import { HookSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/hook-section'
import { PointSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/point-section'
import { TruthSection } from '@/features/meeting-flow/ui/components/steps/who-we-are/truth-section'

interface WhoWeAreStepProps {
  /** Advances the meeting flow to the Specialties step. */
  onContinue: () => void
}

/**
 * Step 1 of the meeting flow as a snapping scroll presentation of the
 * due-diligence story (docs/sales/due-diligence-story.md).
 */
export function WhoWeAreStep({ onContinue }: WhoWeAreStepProps) {
  return (
    <SnapPresentation aside={<PinnedColumn summaries={WHO_WE_ARE_PINNED} />} label="Who we are presentation">
      {WHO_WE_ARE_SECTIONS.map((section, index) => {
        switch (section.kind) {
          case 'hook':
            return <HookSection key={section.id} index={index} section={section} />
          case 'credentials':
            return <CredentialsSection key={section.id} index={index} section={section} />
          case 'point':
            return <PointSection key={section.id} index={index} section={section} />
          case 'truth':
            return <TruthSection key={section.id} index={index} section={section} onContinue={onContinue} />
        }
        return null
      })}
    </SnapPresentation>
  )
}
```

- [ ] **Step 2: Wire the view**

In `src/features/meeting-flow/ui/views/meeting-flow.tsx`:

Change the import on line 29 from

```ts
import { WhoWeAreStep } from '@/features/meeting-flow/ui/components/steps/who-we-are-step'
```

to

```ts
import { WhoWeAreStep } from '@/features/meeting-flow/ui/components/steps/who-we-are'
```

Replace the whole "Step content" block (from the `{/* Step content */}` comment through the closing `</div>` before `{/* Footer navigation + overlay triggers */}`) with:

```tsx
      {/* Step content — presentation steps own their scroller; page steps share the padded one */}
      {stepConfig.layout === 'presentation'
        ? (
            <>
              <h1 className="sr-only">{stepConfig.title}</h1>
              {stepConfig.id === 'who-we-are' && <WhoWeAreStep onContinue={handleNext} />}
            </>
          )
        : (
            <div className="min-h-0 flex-1 overflow-y-auto py-6">
              <h1 className="sr-only">{stepConfig.title}</h1>
              {stepConfig.id === 'specialties' && <SpecialtiesStep flowContext={flowContext} />}
              {stepConfig.id === 'portfolio' && <PortfolioStep flowContext={flowContext} />}
              {stepConfig.id === 'program' && (
                <ProgramStep flowContext={flowContext} meetingType={meeting.meetingType} />
              )}
              {stepConfig.id === 'deal-structure' && <DealStructureStep flowContext={flowContext} />}
              {stepConfig.id === 'closing' && (
                <ClosingStep
                  flowContext={flowContext}
                  meetingOutcome={meeting.meetingOutcome}
                  onOutcomeChange={handleOutcomeChange}
                  proposalState={{
                    proposalCount: meeting.proposalCount ?? 0,
                    hasSentProposal: meeting.hasSentProposal ?? false,
                    hasApprovedProposal: meeting.hasApprovedProposal ?? false,
                  }}
                />
              )}
              {stepConfig.id === 'create-proposal' && (
                <CreateProposalStep flowContext={flowContext} meetingId={meetingId} />
              )}
            </div>
          )}
```

`handleNext` is the function declaration already in the component (it guards `currentStep < TOTAL_STEPS`); no new handler is needed.

- [ ] **Step 3: Remove the dead credential strip**

In `src/features/meeting-flow/constants/due-diligence.ts` delete the `CREDENTIAL_ITEMS` export block (the last `export const` in the file) and the now-unused line

```ts
const generalLiability = companyInfo.insurances.find(i => i.label.includes('General Liability'))
```

Keep `primaryLicense` and `numProjects`; `DUE_DILIGENCE_ITEMS` still uses them.

- [ ] **Step 4: Delete the old step**

```bash
git rm src/features/meeting-flow/ui/components/steps/who-we-are-step.tsx
```

(If commits are not confirmed, use `rm` instead and leave the deletion unstaged.)

- [ ] **Step 5: Type-check and lint**

Run:

```bash
pnpm tsc
pnpm exec eslint src/features/meeting-flow
grep -rn "who-we-are-step\|CREDENTIAL_ITEMS" src || echo "no stale references"
```

Expected: tsc and eslint exit 0; the grep prints `no stale references`.

- [ ] **Step 6: Rendered check on the dev server**

With `pnpm dev` running and the Playwright browser logged in (see Global Constraints), open the dev meeting at `?step=1` at 1440×900 and confirm:

1. The step renders nine sections with no page-level padding inside the scroller: run in the page

```js
(() => {
  const scroller = document.querySelector('[aria-label="Who we are presentation"]')
  const sections = [...scroller.querySelectorAll('section')]
  return JSON.stringify({
    count: sections.length,
    heights: sections.map(s => Math.round(s.getBoundingClientRect().height)),
    scrollerHeight: Math.round(scroller.clientHeight),
    left: Math.round(scroller.getBoundingClientRect().left),
  })
})()
```

Expected: `count` is 9, every height equals `scrollerHeight`, and `left` is 24px greater than the sidebar inset's left edge (the template padding), same as the records pages.

2. Snap holds: run

```js
(() => new Promise((resolve) => {
  const scroller = document.querySelector('[aria-label="Who we are presentation"]')
  const sections = [...scroller.querySelectorAll('section')]
  scroller.scrollBy({ top: scroller.clientHeight / 3 })
  setTimeout(() => resolve(JSON.stringify({
    scrollTop: Math.round(scroller.scrollTop),
    sectionTops: sections.slice(0, 3).map(s => s.offsetTop),
  })), 1200)
}))()
```

Expected: `scrollTop` equals one of `sectionTops` (0 or the second section's offset), never a third of the way.

3. The pinned column follows: after the scroll above, the `aside` text contains "Our credentials" when the second section is current.

4. The document dialog opens: click the button labelled "Open Contractor license"; a dialog with a hidden title "Contractor license" appears; press Escape; it closes.

5. Reduced motion: emulate `prefers-reduced-motion: reduce` (Playwright `page.emulateMedia({ reducedMotion: 'reduce' })`), reload, and confirm sections still render at full height and the first section's text is visible without scrolling.

- [ ] **Step 7: Commit (only if commits are confirmed)**

```bash
git add src/features/meeting-flow/ui/components/steps/who-we-are/index.tsx src/features/meeting-flow/ui/views/meeting-flow.tsx src/features/meeting-flow/constants/due-diligence.ts src/features/meeting-flow/ui/components/steps/who-we-are-step.tsx
git commit -m "feat(meeting-flow): Who We Are as a snapping scroll presentation; presentation step layout in the view

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Responsive pass and design audits

**Files:**
- Modify (only as findings require): files created in Tasks 2–6.

**Interfaces:**
- Consumes: the running step from Task 6.
- Produces: a punch list applied in place, or listed as follow-ups in the final report.

- [ ] **Step 1: Four-viewport rendered check**

In the Playwright browser, open the dev meeting at `?step=1` at each of 1440×900, 1024×768, 768×1024, and 390×844, and for each record:

- every `section` height equals the scroller height minus the pinned band height (0 on the two wider viewports, the band's height on the two narrower ones);
- after `scroller.scrollBy({ top: scroller.clientHeight / 3 })` and a 1.2s wait, `scroller.scrollTop` equals a section's `offsetTop` minus the band height (snap padded by the band);
- the pinned column is on the left on the two wider viewports and a top band on the two narrower ones;
- no text is clipped: every `h2` and the proof figures have `scrollWidth <= clientWidth`.

Fix any failure in the component that owns it (sizes are container-unit values in the section files; layout is in `snap-presentation.tsx` and `pinned-column.tsx`).

- [ ] **Step 2: Design audits**

Run the two remaining audits from `docs/ui-design-playbook.md` against the new files (the impeccable detector already ran on every edit through the hook):

1. Invoke the `ui-ux-pro-max` skill on `src/features/meeting-flow/ui/components/steps/who-we-are` and `src/features/meeting-flow/ui/components/presentation`.
2. Invoke the `web-design-guidelines` skill on the same paths.

For each finding: fix it in the owning file, or, if it conflicts with the spec, record it in the final report with the reason. Re-run `pnpm tsc` and `pnpm exec eslint src/features/meeting-flow` after fixes.

- [ ] **Step 3: Padding parity check**

At 1440×900, measure the meeting-flow header's back link, the Previous button, and the Context trigger against the records page header on `/dashboard/meetings`:

```js
(() => {
  const inset = document.querySelector('main[data-slot="sidebar-inset"]').getBoundingClientRect()
  const pick = sel => { const el = document.querySelector(sel); return el ? Math.round(el.getBoundingClientRect().left - inset.left) : null }
  return JSON.stringify({ backLink: pick('header a'), prev: pick('footer button'), records: pick('header') })
})()
```

Expected: 24 for each on the meeting flow, matching the records page header's 24.

- [ ] **Step 4: Final verification and commit (only if commits are confirmed)**

```bash
pnpm tsc
pnpm lint
```

Expected: both exit 0 (warnings in unrelated files are acceptable; errors are not).

```bash
git add -u src/features/meeting-flow
git commit -m "fix(meeting-flow): Who We Are presentation responsive and audit fixes

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

`git add -u` here stages only tracked files under `src/features/meeting-flow`; confirm with `git status --porcelain src/features/meeting-flow` that nothing outside this plan's files is staged before committing.

---

## Self-review against the spec

- **§3 content**: Task 1 Step 4 carries all nine beats with the spec's copy sources; the warranty is absent; point 4 uses the founder constants.
- **§4.1 layout modes**: Task 1 Step 2 adds `layout`; Task 6 Step 2 branches on it and keeps the `h1`.
- **§4.2 primitive**: Task 2 (scroller, section, reveal, image, scrim) and Task 3 (pinned column). Snap classes, `[container-type:size]`, `--pin-h`, `scroll-pt-(--pin-h)`, `tabIndex`, `aria-label`, `MotionConfig`, `useInView` with `root` and `amount: 0.5`, `initial={false}` all present.
- **§4.3 sections**: Task 4 (atoms, including the lazy dialog with its `// LAZY:` header) and Task 5 (four sections). `PhotoLightbox` is not reused, per the decision.
- **§4.4 data and types**: Task 1. `CREDENTIAL_ITEMS` removed in Task 6 Step 3.
- **§4.5 responsive**: `lg` breakpoint throughout; Task 7 Step 1 verifies four viewports.
- **§4.6 motion**: reveal, image settle, pin swap, reduced motion covered in Tasks 2–3; verified in Task 6 Step 6.
- **§4.7 accessibility**: focusable labelled scroller, `aria-labelledby` sections with `h2`s, dialog title, alt text.
- **§5 edge cases**: empty documents → placeholder (Task 5 Step 2); pinned count derived from data (Task 1 Step 4).
- **§6 verification**: Task 6 Step 6 and Task 7.
- **§7 files**: every created, modified, and deleted file appears in a task.
