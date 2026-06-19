# Kitchen Funnel Full Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Compose a long-scroll, trust-rich, kitchen-specific funnel landing: hero branding + highlighted words, a top TrustBar, 5 new generic content-driven marketing-block kinds, and a full kitchen-specific block composition with drafted copy.

**Architecture:** Extend the `MarketingBlock` registry (lockstep: union member + content interface + component + registry entry, all together per kind so tsc stays green). TrustBar renders in `FunnelLanding` above Q1 (not a registry block). Kitchen copy is authored inline in `kitchens.ts` (shared/ can't import features/`trade-*`).

**Tech Stack:** Next.js 15, React 19, TS strict, motion/react, Tailwind v4, lucide-react, react-icons, next/image.

> No unit-test runner in repo. Per-task gate = `pnpm tsc` (0) + `pnpm lint` (0); behavior verified by a browser smoke at integration. Do NOT add a test framework.

## Global Constraints

- Scoped light is done; funnel components use semantic tokens only, NO `dark:` utilities, NO hardcoded colors. Exception: yellow star glyphs (`fill-yellow-500`).
- Primary color reserved for CTAs + ≤2 highlighted headline words.
- All company data from `src/shared/constants/company/`; never hardcode.
- New block kind = lockstep (union + interface + component + `MARKETING_REGISTRY` entry) in ONE task → tsc green each task.
- Logo: dark-ink asset (`@public/company/logo/logo-dark-right.svg`) via `next/image` (not the `Logo` component — it switches on `dark:` and misfires under `html.dark`).
- Motion reduced-motion-gated; transform/opacity only.
- Conventions: one component/file; named exports; no file-level consts/helpers in component files; `shared/` never imports `features/`; lint clean (`pnpm lint:fix` to sort imports).
- Honesty: no fabricated trust signals; financing copy is placeholder (fixed low monthly payments; exact verbiage pending) — easy to swap.
- Commits pathspec-only; `git add <path>` for new files; trailer `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`. NEVER `pnpm build`/`db:push`.

---

### Task 1: Hero branding + highlighted headline

**Files:**
- Modify: `src/shared/domains/funnels/types.ts` (add `highlightWords?` to `HeroContent`)
- Create: `src/shared/domains/funnels/lib/highlight-headline.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-hero.tsx`
- Modify: `src/shared/domains/funnels/constants/kitchens.ts` (hero `highlightWords`)

**Interfaces:**
- Produces: `renderHighlightedHeadline(headline: string, highlightWords?: string[]): ReactNode`; `HeroContent.highlightWords?: string[]`.

- [ ] **Step 1: Add `highlightWords` to `HeroContent`** in `types.ts`:

```ts
export interface HeroContent {
  headline: string
  subhead: string
  scarcityLine: string
  /** Optional prompt introducing the embedded first question, e.g. "Start here ↓". */
  prompt?: string
  media?: HeroMedia
  /** Phrases within `headline` rendered in primary color (≤2 recommended). */
  highlightWords?: string[]
}
```

- [ ] **Step 2: Create `lib/highlight-headline.tsx`:**

```tsx
import type { ReactNode } from 'react'

/**
 * Wraps each `highlightWords` phrase found in `headline` in a primary-colored
 * span. Exact, case-sensitive substring match; non-overlapping. Returns the
 * headline unchanged when no words are given.
 */
export function renderHighlightedHeadline(headline: string, highlightWords?: string[]): ReactNode {
  if (!highlightWords || highlightWords.length === 0) {
    return headline
  }
  const escaped = highlightWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const parts = headline.split(new RegExp(`(${escaped.join('|')})`, 'g'))
  return parts.map((part, i) =>
    highlightWords.includes(part)
      ? <span key={i} className="text-primary">{part}</span>
      : part,
  )
}
```

- [ ] **Step 3: Rewrite `funnel-hero.tsx`:**

```tsx
import type { HeroContent } from '@/shared/domains/funnels/types'
import LogoDark from '@public/company/logo/logo-dark-right.svg'
import Image from 'next/image'
import { renderHighlightedHeadline } from '@/shared/domains/funnels/lib/highlight-headline'

/**
 * The offer-aligned landing band that frames the funnel's first question.
 * Renders the dark-ink logo directly (the shared Logo component switches on
 * `dark:` and would pick the wrong variant inside the scoped-light funnel).
 */
export function FunnelHero({ content }: { content: HeroContent }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <Image src={LogoDark} alt="Tri Pros Remodeling" width={180} height={48} priority className="h-12 w-auto" />
      {content.media
        ? <Image src={content.media.src} alt={content.media.alt} width={640} height={360} priority className="h-auto w-full rounded-2xl object-cover" />
        : null}
      <h1 className="text-foreground text-balance font-serif text-3xl font-bold tracking-tight sm:text-4xl">
        {renderHighlightedHeadline(content.headline, content.highlightWords)}
      </h1>
      <p className="text-muted-foreground text-balance text-lg">{content.subhead}</p>
      <p className="text-primary text-sm font-medium">{content.scarcityLine}</p>
      {content.prompt ? <p className="text-muted-foreground mt-2 text-sm">{content.prompt}</p> : null}
    </div>
  )
}
```

- [ ] **Step 4: Set kitchens hero `highlightWords`** — in `kitchens.ts`, change the `hero` object to add the field (keep all existing keys):

```ts
  hero: {
    headline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase kitchens.',
    scarcityLine: 'We\'re selecting 5 kitchens in your area.',
    prompt: 'Start by telling us about your kitchen ↓',
    highlightWords: ['AAA-grade', 'Showcase'],
  },
```

- [ ] **Step 5: Verify** — `pnpm tsc` (0), `pnpm lint` (0; `pnpm lint:fix` if import order). **Visual (integration):** logo renders dark-ink on light bg; "AAA-grade" + "Showcase" are primary; headline is serif + legible.

- [ ] **Step 6: Commit:**

```bash
git add src/shared/domains/funnels/lib/highlight-headline.tsx
git commit -m "feat(funnels): hero logo + serif + primary-highlighted headline words

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/types.ts src/shared/domains/funnels/lib/highlight-headline.tsx src/shared/domains/funnels/ui/funnel-hero.tsx src/shared/domains/funnels/constants/kitchens.ts
```

---

### Task 2: TrustBar + funnel-landing wiring (CTAs → primary)

**Files:**
- Create: `src/shared/domains/funnels/ui/trust-bar.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-landing.tsx`

**Interfaces:**
- Consumes: `PlatformBadge`, `StarRating` (shared/components/reviews); `companyInfo`, `licenses`, `socials`, `stats` (company constants).
- Produces: `TrustBar` (no required props).

- [ ] **Step 1: Create `trust-bar.tsx`:**

```tsx
import { Check } from 'lucide-react'
import { FaGoogle, FaYelp } from 'react-icons/fa'
import { PlatformBadge } from '@/shared/components/reviews/platform-badge'
import { StarRating } from '@/shared/components/reviews/star-rating'
import { companyInfo, licenses, socials, stats } from '@/shared/constants/company'

/** Scannable legitimacy strip shown at the top of the funnel landing, under the hero. */
export function TrustBar({ rating = 4.9, count = 200 }: { rating?: number, count?: number }) {
  const googleHref = socials.find(s => s.name === 'google')?.href
  const yelpHref = socials.find(s => s.name === 'yelp')?.href
  const bbb = stats.find(s => s.label === 'BBB Rating')
  const chips = [
    'Licensed & Insured',
    `CSLB #${licenses[0]?.licenseNumber ?? ''}`,
    `${companyInfo.numProjects}+ Projects`,
    `${companyInfo.combinedYearsExperience}+ Yrs`,
    `${Math.round(companyInfo.clientSatisfaction * 100)}% Satisfaction`,
  ]
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PlatformBadge platform="Google" href={googleHref} icon={<FaGoogle className="size-4" />}>
          <StarRating rating={rating} count={count} size={14} />
        </PlatformBadge>
        <PlatformBadge platform="Yelp" href={yelpHref} icon={<FaYelp className="size-4" />}>
          <span className="text-muted-foreground text-sm">Verified</span>
        </PlatformBadge>
        <PlatformBadge platform="BBB">
          <span className="text-foreground text-sm font-semibold">{bbb?.number ?? 'A+'}</span>
        </PlatformBadge>
      </div>
      <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
        {chips.map(chip => (
          <li key={chip} className="text-muted-foreground flex items-center gap-1 text-xs font-medium">
            <Check className="text-primary size-3.5 shrink-0" aria-hidden="true" />
            {chip}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Wire TrustBar + primary CTAs in `funnel-landing.tsx`.** Add `import { TrustBar } from '@/shared/domains/funnels/ui/trust-bar'`. Render `<TrustBar />` between `<FunnelHero ... />` and the Q1 anchor div:

```tsx
      <div className="flex w-full max-w-xl flex-col gap-8 px-5">
        <FunnelHero content={spec.hero} />
        <TrustBar />
        <div id={QUESTION_ANCHOR} className="scroll-mt-6">{children}</div>
      </div>
```

Then change the inter-block CTA to **primary** (drop `variant="outline"`) and fire after every **3rd** block:

```tsx
            {(i + 1) % 3 === 0 && i < blocks.length - 1
              ? (
                  <Button size="lg" onClick={scrollToQuestion} className="self-center">
                    <ArrowUp className="size-4" />
                    See if you qualify
                  </Button>
                )
              : null}
```

- [ ] **Step 3: Verify** — `pnpm tsc` 0, `pnpm lint` 0. **Visual:** TrustBar shows under hero (Google★/Yelp/BBB + 5 check chips), badges open real profiles in new tabs; inter-block CTAs are primary, ~every 3rd block.

- [ ] **Step 4: Commit:**

```bash
git add src/shared/domains/funnels/ui/trust-bar.tsx
git commit -m "feat(funnels): top TrustBar (badges + credibility chips) + primary inter-block CTAs

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/trust-bar.tsx src/shared/domains/funnels/ui/funnel-landing.tsx
```

---

### Task 3: reviews-block → cards-only

**Files:**
- Modify (rewrite): `src/shared/domains/funnels/ui/blocks/reviews-block.tsx`

**Interfaces:**
- Component signature unchanged: `ReviewsBlock({ content: ReviewsBlockContent, ctx: FunnelContext })`. The platform badges move to the TrustBar; this block now renders only the curated cards. `content.label` becomes the optional heading; `rating`/`count` are no longer used here (kept on the type for the TrustBar default + back-compat).

- [ ] **Step 1: Rewrite `reviews-block.tsx`:**

```tsx
import type { FunnelContext, ReviewsBlockContent } from '@/shared/domains/funnels/types'
import { ReviewCard } from '@/shared/components/reviews/review-card'
import { testimonials } from '@/shared/constants/company'

export function ReviewsBlock({ content }: { content: ReviewsBlockContent, ctx: FunnelContext }) {
  return (
    <section className="flex flex-col items-center gap-6 py-10">
      {content.label ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.label}</h2> : null}
      <div className="grid w-full max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map(t => (
          <ReviewCard key={t.name} name={t.name} text={t.text} rating={t.rating} location={t.location} platform="Google" image={t.image} />
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify** — `pnpm tsc` 0, `pnpm lint` 0. **Visual:** the reviews section shows only yellow-star cards (no duplicate badge strip). **Note:** `FaGoogle` and `PlatformBadge`/`StarRating`/`socials`/`stats` imports are now unused here — remove them (lint will flag).

- [ ] **Step 3: Commit:**

```bash
git commit -m "refactor(funnels): reviews block renders cards only (badges live in TrustBar now)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/blocks/reviews-block.tsx
```

---

### Task 4: `problem` block (why kitchen remodels go wrong)

**Files:**
- Modify: `src/shared/domains/funnels/types.ts` (add `ProblemBlockContent` + union member)
- Create: `src/shared/domains/funnels/ui/blocks/problem-block.tsx`
- Modify: `src/shared/domains/funnels/constants/marketing-registry.ts` (import + `problem` entry)

**Interfaces:**
- Produces: `ProblemBlockContent { headline: string, body?: string, points: { title: string, body: string }[], standardLine?: string }`; `ProblemBlock`.

- [ ] **Step 1: types.ts — add interface + union member.** Add near the other block content interfaces:

```ts
export interface ProblemBlockContent {
  headline: string
  body?: string
  points: { title: string, body: string }[]
  standardLine?: string
}
```

Append to the `MarketingBlock` union:

```ts
    | { kind: 'problem', content: ProblemBlockContent }
```

- [ ] **Step 2: Create `problem-block.tsx`:**

```tsx
import type { FunnelContext, ProblemBlockContent } from '@/shared/domains/funnels/types'
import { TriangleAlert } from 'lucide-react'

export function ProblemBlock({ content }: { content: ProblemBlockContent, ctx: FunnelContext }) {
  return (
    <section className="flex flex-col gap-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-foreground text-2xl font-semibold">{content.headline}</h2>
        {content.body ? <p className="text-muted-foreground max-w-2xl text-balance">{content.body}</p> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {content.points.map(p => (
          <div key={p.title} className="border-border bg-card flex flex-col gap-1 rounded-2xl border p-5">
            <div className="text-foreground flex items-center gap-2 font-medium">
              <TriangleAlert className="text-destructive size-4 shrink-0" aria-hidden="true" />
              {p.title}
            </div>
            <p className="text-muted-foreground text-sm">{p.body}</p>
          </div>
        ))}
      </div>
      {content.standardLine
        ? <p className="border-primary/30 bg-primary/5 text-foreground mx-auto max-w-3xl text-balance rounded-2xl border px-6 py-4 text-center text-sm font-medium">{content.standardLine}</p>
        : null}
    </section>
  )
}
```

- [ ] **Step 3: Register** — in `marketing-registry.ts` add `import { ProblemBlock } from '@/shared/domains/funnels/ui/blocks/problem-block'` and the entry `problem: ProblemBlock,` to `MARKETING_REGISTRY`.

- [ ] **Step 4: Verify** — `pnpm tsc` 0 (union ↔ registry ↔ component all present), `pnpm lint` 0.

- [ ] **Step 5: Commit:**

```bash
git add src/shared/domains/funnels/ui/blocks/problem-block.tsx
git commit -m "feat(funnels): add 'problem' marketing block (agitation + raise-the-bar)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/types.ts src/shared/domains/funnels/ui/blocks/problem-block.tsx src/shared/domains/funnels/constants/marketing-registry.ts
```

---

### Task 5: `value` block (highest-ROI pain→outcome)

**Files:** types.ts (+`ValueBlockContent` + union), Create `ui/blocks/value-block.tsx`, marketing-registry.ts (+entry).

**Interfaces:** `ValueBlockContent { headline: string, intro?: string, roiStat?: { value: string, label: string }, items: { before: string, after: string }[] }`; `ValueBlock`.

- [ ] **Step 1: types.ts** — add interface + `| { kind: 'value', content: ValueBlockContent }`:

```ts
export interface ValueBlockContent {
  headline: string
  intro?: string
  roiStat?: { value: string, label: string }
  items: { before: string, after: string }[]
}
```

- [ ] **Step 2: Create `value-block.tsx`:**

```tsx
import type { FunnelContext, ValueBlockContent } from '@/shared/domains/funnels/types'
import { ArrowRight } from 'lucide-react'

export function ValueBlock({ content }: { content: ValueBlockContent, ctx: FunnelContext }) {
  return (
    <section className="flex flex-col gap-6 py-10">
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="text-foreground text-2xl font-semibold">{content.headline}</h2>
        {content.intro ? <p className="text-muted-foreground max-w-2xl text-balance">{content.intro}</p> : null}
      </div>
      {content.roiStat
        ? (
            <div className="flex flex-col items-center">
              <span className="text-primary text-4xl font-bold tabular-nums">{content.roiStat.value}</span>
              <span className="text-muted-foreground text-sm">{content.roiStat.label}</span>
            </div>
          )
        : null}
      <ul className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        {content.items.map(item => (
          <li key={item.after} className="border-border bg-card flex items-center gap-3 rounded-xl border p-4 text-sm">
            <span className="text-muted-foreground flex-1 line-through">{item.before}</span>
            <ArrowRight className="text-primary size-4 shrink-0" aria-hidden="true" />
            <span className="text-foreground flex-1 font-medium">{item.after}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

- [ ] **Step 3: Register** `value: ValueBlock` (+import) in `marketing-registry.ts`.
- [ ] **Step 4: Verify** tsc 0 / lint 0.
- [ ] **Step 5: Commit** (paths: types.ts, value-block.tsx [git add], marketing-registry.ts) — `feat(funnels): add 'value' marketing block (highest-ROI pain→outcome)`.

---

### Task 6: `process` block (how it works)

**Files:** types.ts (+`ProcessBlockContent` + union), Create `ui/blocks/process-block.tsx`, marketing-registry.ts (+entry).

**Interfaces:** `ProcessBlockContent { title?: string, steps: { title: string, body: string, image?: string, duration?: string }[] }`; `ProcessBlock`.

- [ ] **Step 1: types.ts** — interface + `| { kind: 'process', content: ProcessBlockContent }`:

```ts
export interface ProcessBlockContent {
  title?: string
  steps: { title: string, body: string, image?: string, duration?: string }[]
}
```

- [ ] **Step 2: Create `process-block.tsx`:**

```tsx
import type { FunnelContext, ProcessBlockContent } from '@/shared/domains/funnels/types'
import Image from 'next/image'

export function ProcessBlock({ content }: { content: ProcessBlockContent, ctx: FunnelContext }) {
  return (
    <section className="flex flex-col gap-6 py-10">
      {content.title ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.title}</h2> : null}
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {content.steps.map((step, i) => (
          <li key={step.title} className="border-border bg-card flex flex-col overflow-hidden rounded-2xl border">
            {step.image
              ? <Image src={step.image} alt={step.title} width={320} height={180} className="aspect-video w-full object-cover" />
              : null}
            <div className="flex flex-col gap-1 p-4">
              <span className="text-primary text-xs font-semibold tabular-nums">
                Step
                {' '}
                {i + 1}
                {step.duration ? ` · ${step.duration}` : ''}
              </span>
              <span className="text-foreground font-medium">{step.title}</span>
              <p className="text-muted-foreground text-sm">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}
```

- [ ] **Step 3: Register** `process: ProcessBlock` (+import).
- [ ] **Step 4: Verify** tsc 0 / lint 0.
- [ ] **Step 5: Commit** — `feat(funnels): add 'process' marketing block (how-it-works steps)`.

---

### Task 7: `faq` block

**Files:** types.ts (+`FaqBlockContent` + union), Create `ui/blocks/faq-block.tsx`, marketing-registry.ts (+entry).

**Interfaces:** `FaqBlockContent { title?: string, items: { q: string, a: string }[] }`; `FaqBlock`.

- [ ] **Step 1: types.ts** — interface + `| { kind: 'faq', content: FaqBlockContent }`:

```ts
export interface FaqBlockContent {
  title?: string
  items: { q: string, a: string }[]
}
```

- [ ] **Step 2: Create `faq-block.tsx`** (native `<details>` for zero-JS accessibility):

```tsx
import type { FaqBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { ChevronDown } from 'lucide-react'

export function FaqBlock({ content }: { content: FaqBlockContent, ctx: FunnelContext }) {
  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 py-10">
      {content.title ? <h2 className="text-foreground text-center text-2xl font-semibold">{content.title}</h2> : null}
      <div className="flex flex-col gap-2">
        {content.items.map(item => (
          <details key={item.q} className="border-border bg-card group rounded-xl border px-4 py-3">
            <summary className="text-foreground flex cursor-pointer list-none items-center justify-between gap-2 font-medium">
              {item.q}
              <ChevronDown className="text-muted-foreground size-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <p className="text-muted-foreground mt-2 text-sm">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Register** `faq: FaqBlock` (+import).
- [ ] **Step 4: Verify** tsc 0 / lint 0.
- [ ] **Step 5: Commit** — `feat(funnels): add 'faq' marketing block (native details accordion)`.

---

### Task 8: `callout` block (financing)

**Files:** types.ts (+`CalloutBlockContent` + union), Create `ui/blocks/callout-block.tsx`, marketing-registry.ts (+entry).

**Interfaces:** `CalloutBlockContent { headline: string, body: string, points?: string[] }`; `CalloutBlock`.

- [ ] **Step 1: types.ts** — interface + `| { kind: 'callout', content: CalloutBlockContent }`:

```ts
export interface CalloutBlockContent {
  headline: string
  body: string
  points?: string[]
}
```

- [ ] **Step 2: Create `callout-block.tsx`:**

```tsx
import type { CalloutBlockContent, FunnelContext } from '@/shared/domains/funnels/types'
import { Check } from 'lucide-react'

export function CalloutBlock({ content }: { content: CalloutBlockContent, ctx: FunnelContext }) {
  return (
    <section className="border-primary/30 bg-primary/5 mx-auto flex w-full max-w-3xl flex-col items-center gap-3 rounded-2xl border px-6 py-10 text-center">
      <h2 className="text-foreground text-xl font-semibold">{content.headline}</h2>
      <p className="text-muted-foreground max-w-xl text-balance text-sm">{content.body}</p>
      {content.points
        ? (
            <ul className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
              {content.points.map(pt => (
                <li key={pt} className="text-foreground flex items-center gap-1 text-xs font-medium">
                  <Check className="text-primary size-3.5 shrink-0" aria-hidden="true" />
                  {pt}
                </li>
              ))}
            </ul>
          )
        : null}
    </section>
  )
}
```

- [ ] **Step 3: Register** `callout: CalloutBlock` (+import).
- [ ] **Step 4: Verify** tsc 0 / lint 0.
- [ ] **Step 5: Commit** — `feat(funnels): add 'callout' marketing block (financing/offer)`.

---

### Task 9: Kitchens landing composition (full ordered blocks + copy)

**Files:**
- Modify: `src/shared/domains/funnels/constants/kitchens.ts` (add `landing: { blocks: [...] }`)

**Interfaces:** Consumes all block kinds (problem/value/portfolio/reviews/process/callout/faq/guarantee/licensing). Content authored inline (corrected copy: financing = fixed low monthly payments; FAQ timeline 3–10 weeks). `landing` is `FunnelSpec.landing?: { blocks: MarketingBlock[] }`.

- [ ] **Step 1: Add the `landing` block list to `kitchensFunnel`** (insert after `pixel`, before `steps`):

```ts
  landing: {
    blocks: [
      {
        kind: 'problem',
        content: {
          headline: 'Most kitchen remodels go sideways. Here\'s why.',
          body: 'A kitchen is the hardest room in the house to get right — plumbing, gas, electrical, cabinetry, and tight tolerances all have to land at once. One weak link and you\'re living in a months-long jobsite.',
          points: [
            { title: 'Cut-rate "deal" crews', body: 'Low bids hide unpermitted work, no insurance, and no recourse when something goes wrong.' },
            { title: 'No one accountable', body: 'Independent subs blame each other and you become the project manager of your own remodel.' },
            { title: 'Surprise change-orders', body: 'A cheap bid becomes an expensive invoice the moment demo opens the walls.' },
            { title: 'Endless timelines', body: 'Without real scheduling, six weeks becomes six months — and your kitchen stays unusable.' },
          ],
          standardLine: 'What to demand: a licensed, bonded, insured GC you can verify, one accountable team, a fixed written scope, and a real schedule. That\'s the bar — and for us it\'s the floor.',
        },
      },
      {
        kind: 'value',
        content: {
          headline: 'Your kitchen, redesigned for how you actually live.',
          roiStat: { value: '60–80%', label: 'resale ROI — the highest of any room' },
          items: [
            { before: 'Cabinets that don\'t close right', after: 'Soft-close cabinetry, built to last' },
            { before: 'Counter space that was never enough', after: 'Quartz counters with room to actually cook' },
            { before: 'A layout that fights you', after: 'An optimized layout designed around your life' },
            { before: 'A kitchen that feels decades behind', after: 'A space that finally matches how you live' },
          ],
        },
      },
      { kind: 'portfolio', content: { title: 'Recent kitchens in your area' } },
      { kind: 'reviews', content: { rating: 4.9, count: 200, label: 'What homeowners say' } },
      {
        kind: 'process',
        content: {
          title: 'How your Showcase kitchen comes together',
          steps: [
            { title: 'Discovery & Design', duration: 'Wk 1–2', image: '/process/design-stage.jpeg', body: 'We map your goals, measure, and design a kitchen around how you actually cook and live.' },
            { title: 'Pre-Construction & Permits', duration: 'Wk 3–4', image: '/process/pre-construction-stage.jpeg', body: 'We lock the scope, pull permits, and order materials so the build runs without surprises.' },
            { title: 'Construction', image: '/process/construction-stage.jpeg', body: 'One accountable crew, daily quality checks, and photo documentation — not a rotating cast of subs.' },
            { title: 'Completion & Handover', image: '/process/handover-stage.jpeg', body: 'Final walkthrough, punch list, and a kitchen done right — backed by our workmanship guarantee.' },
          ],
        },
      },
      {
        kind: 'callout',
        content: {
          headline: 'Fixed, low monthly payments.',
          body: 'Fixed, low monthly payments put a Showcase kitchen within reach without draining your savings. We\'ll walk you through the options you qualify for during your consultation — no obligation.',
          points: ['Fixed low monthly payments', 'No-obligation consultation', 'Clear, written numbers up front'],
        },
      },
      {
        kind: 'faq',
        content: {
          title: 'Kitchen remodel questions, answered',
          items: [
            { q: 'How much does a kitchen remodel cost?', a: 'It depends on size, scope, and finishes — which is exactly why we give you a fixed written scope and clear numbers up front instead of a low guess that balloons later. Most Showcase kitchens land in a range we\'ll walk you through on your consultation.' },
            { q: 'How long does it take?', a: 'A typical Showcase kitchen runs about 3–10 weeks of active construction after design and permits, depending on complexity and scope. You get a real schedule — not a vague "couple of months."' },
            { q: 'Do I need permits?', a: 'Most kitchen remodels that touch plumbing, gas, or electrical do. As a licensed general contractor we pull and manage them for you. Unpermitted work becomes your problem when you sell.' },
            { q: 'Can I use my kitchen during the remodel?', a: 'There\'s a window where it\'s offline. We sequence the work to keep that window as short as possible and tell you exactly when, up front.' },
            { q: 'Is financing available?', a: 'Yes — with fixed, low monthly payments so you can start now and pay over time. We\'ll cover the options you qualify for during your consultation.' },
            { q: 'Are you licensed and insured?', a: 'Fully. We\'re a licensed, bonded general contractor (CSLB #1076760) insured up to $1M general liability — and you can verify our license on the CSLB website.' },
          ],
        },
      },
      {
        kind: 'guarantee',
        content: {
          headline: 'Showcase-grade work, guaranteed',
          body: 'Every Showcase project is backed by our workmanship guarantee.',
          scarcityLine: 'We\'re selecting 5 kitchens in your area this month.',
        },
      },
      { kind: 'licensing', content: {} },
    ],
  },
```

- [ ] **Step 2: Verify** — `pnpm tsc` 0, `pnpm lint` 0. **Visual (integration):** full kitchens landing renders all 9 blocks in order with the copy; primary CTAs after ~every 3rd block; FAQ expands; process images load.

- [ ] **Step 3: Commit:**

```bash
git commit -m "feat(funnels): compose full kitchen-specific landing (problem→value→proof→process→financing→faq)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/constants/kitchens.ts
```

---

## Integration Browser Smoke (controller, after all tasks)

Dev :3000, localStorage cleared, `/funnels/kitchens` (light):
1. Logo (dark-ink) + serif headline with "AAA-grade"/"Showcase" in primary; all text legible.
2. TrustBar: Google★/Yelp/BBB A+ + 5 check chips; badges open real profiles.
3. Q1 cards (centered, mobile-fit, stagger) → answer → focused funnel → Back → landing with Continue.
4. Scroll: problem → value(60–80%) → portfolio(real kitchens) → reviews(yellow cards) → process(4 images) → financing callout → FAQ(expand) → guarantee → licensing.
5. Inter-block CTAs primary, scroll to Q1; bottom CTA primary.
6. 0 console errors; reduced-motion clean; 375px no horizontal scroll.

## Self-Review Notes

- **Spec coverage:** hero branding+highlights → T1; TrustBar+CTAs → T2; reviews cards-only/dedup → T3; problem/value/process/faq/callout kinds → T4–T8; kitchen composition+copy → T9. Legibility fix already landed. All covered.
- **Type consistency:** each block's content interface (T4–T8) matches the content authored in T9; `MarketingBlock` union grows one member per block task in lockstep with its registry entry (tsc green each task). `highlightWords` defined T1, used T1.
- **Honesty:** financing copy = fixed low monthly payments (placeholder verbiage, user to finalize); FAQ no fixed price, 3–10 wk timeline (user-confirmed); reviews placeholder (user-confirmed).
- **Deferred / out of scope:** stale asset paths (logo/team/services) fixed separately; testimonials kind stays in library but unused by kitchens; DEFAULT_LANDING_BLOCKS left as-is (kitchens fully overrides).
