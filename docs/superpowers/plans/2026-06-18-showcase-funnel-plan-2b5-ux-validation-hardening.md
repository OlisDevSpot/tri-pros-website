# Showcase Funnel — Plan 2b.5: UX & Validation Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reshape the funnel so the hero frames the first question (not a step), lift navigation into the shell with revisit/Next semantics, add option assets + a continuous progress bar, fix the ZIP step's persistence/label/anticipation bugs, and add hard-gated phone validation + optional-and-removed email + a progressive-disclosure PII form.

**Architecture:** Extends the landed engine at `src/shared/domains/funnels/` (the hardened discriminated-union step model + mapped-type `STEP_REGISTRY`). The hero becomes `FunnelSpec.hero` rendered by the shell while on step 1; the `info` step kind is removed in lockstep. Phone validation runs as a free `libphonenumber-js` client pre-check → a server-authoritative Twilio Lookup gate (via the existing `twilioClient` provider) enforced in a new `funnelsRouter.submitLead`, which delegates to the shared `customerIntakeService.ingestLead`.

**Tech Stack:** Next.js 15.5.9, React 19, TypeScript strict, tRPC, Drizzle/Neon, `motion/react` v12, react-hook-form v7 + `@hookform/resolvers/zod`, zod v4, shadcn/ui, lucide-react, Twilio SDK v6, `libphonenumber-js` (new).

**Spec:** `docs/superpowers/specs/2026-06-18-funnel-ux-validation-hardening-design.md` (this plan implements it). Where the spec and the older step-model spec disagree, the UX/validation spec governs.

## Global Constraints

- **Branch:** Work on `main`. Commit with pathspecs only (`git commit -m "…" -- <paths>`); run `git status --short` first; never `git add -A` / bare commit. (Standing user instruction.)
- **No test runner exists** (no vitest/jest, zero test files). Verification per task = `pnpm tsc` (zero errors) + `pnpm lint` (zero errors) as the hard gate. Pure logic is verified with a throwaway `tsx` assertion scriptlet (`scripts/_verify-*.ts`) — run it, confirm PASS, then **delete it** (do not commit). UI is verified in the running dev server (`pnpm dev`) via the Playwright MCP if available; otherwise tsc/lint + a careful code read. **Never `pnpm build`. Never `pnpm db:push` (prod) — only `pnpm db:push:dev`.**
- **Dependency directionality:** `shared/` never imports from `features/`. No barrel files in `ui/`, `constants/`, `hooks/`, `lib/`. One React component per file; named exports only; no file-level constants or helper functions inside component files (extract to `constants/` / `lib/`).
- **Only one new dependency is allowed:** `libphonenumber-js`. No email-validation / typo / MX libraries. No deliverability checks.
- **Phone gate is hard but fails OPEN:** block lead creation only on a *definitive* invalid verdict (client `isValid` fails, or Twilio `valid: false`). On a Twilio outage / timeout / indeterminate `errorCode`, **accept the lead** and tag `phoneVerification.status: 'unverified'`. Never drop a lead because Twilio didn't answer.
- **PII final fields:** `firstName`, `lastName`, `phone`, `consent`. **No email, no city field.** City/state/zip come from `answers.location`.
- **Email** is removed from PII entirely (deferred to enrichment); do not reintroduce it in this plan.
- **Hero** is `FunnelSpec.hero`, not a step; the `info` kind is removed.
- **zod v4** — use `z.email()` (not `z.string().email()`); `import z from 'zod'`.
- **Motion:** use `motion/react`; always honor `useReducedMotion()`.
- **Twilio Lookup pricing must be re-confirmed in the console before launch** (not blocking implementation).

---

## File Structure

**Modify**
- `src/shared/domains/funnels/types.ts` — remove `info`/`InfoStep`; add `FunnelSpec.hero`, `HeroMedia`, repurpose `HeroContent`; add `StepProps.isAnswered`; add `OptionAsset` + change `OptionContent`; split `LocationContent` labels.
- `src/shared/domains/funnels/constants/step-registry.ts` — drop `info` entry, drop `InfoStepView` import.
- `src/shared/domains/funnels/hooks/use-funnel-engine.ts` — add `hasNext` to the API.
- `src/shared/domains/funnels/ui/funnel-engine.tsx` — render hero band while first; pass `isAnswered`; render shell Back/Next.
- `src/shared/domains/funnels/ui/funnel-progress.tsx` — continuous motion bar.
- `src/shared/domains/funnels/ui/steps/card-select-step.tsx` — render option assets; auto-advance only on first answer; drop own Back.
- `src/shared/domains/funnels/ui/steps/location-step.tsx` — persistence from `value`, min checking duration, not-in-area phase, split labels; drop own Back.
- `src/shared/domains/funnels/ui/steps/pii-form-step.tsx` — first/last split, drop email+city, progressive disclosure, phone gate wiring, submit via `submitLead`.
- `src/shared/domains/funnels/lib/resolve-zip.ts` — add `classifyZip` (region/format).
- `src/shared/domains/funnels/lib/build-lead-input.ts` — compose name, city from location, drop email.
- `src/shared/domains/funnels/schemas/pii.schema.ts` — firstName/lastName, drop email+city.
- `src/shared/domains/funnels/constants/kitchens.ts` — drop info step, add `hero`, option assets.
- `src/shared/domains/funnels/constants/bathrooms.ts` / `complete-interior.ts` — add minimal `hero`.
- `src/shared/services/providers/twilio/client.ts` — add `lookupPhoneNumber`.
- `src/shared/entities/customers/schemas/index.ts` — add `phoneVerification` to `leadMetaSchema`.
- `src/trpc/routers/app.ts` — register `funnelsRouter`.

**Create**
- `src/shared/domains/funnels/ui/funnel-hero.tsx` — the landing band.
- `src/shared/domains/funnels/constants/option-assets.tsx` — icon-name → component registry.
- `src/shared/domains/funnels/lib/evaluate-phone-gate.ts` — pure gate verdict.
- `src/shared/domains/funnels/hooks/use-debounced-async-validator.ts` — debounce + AbortController.
- `src/trpc/routers/funnels.router.ts` — `phoneLookup` query + `submitLead` mutation.

**Delete**
- `src/shared/domains/funnels/ui/steps/info-step.tsx`.

---

## Task 1: Hero off the step model (foundation)

Removes the `info` kind in lockstep, adds `FunnelSpec.hero` rendered by the shell while on step 1, and adds the `isAnswered` prop. After this task the kitchens funnel opens on a hero band that frames the first question; answering it enters the funnel.

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`
- Modify: `src/shared/domains/funnels/constants/step-registry.ts`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx`
- Create: `src/shared/domains/funnels/ui/funnel-hero.tsx`
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`
- Modify: `src/shared/domains/funnels/constants/bathrooms.ts`
- Modify: `src/shared/domains/funnels/constants/complete-interior.ts`
- Delete: `src/shared/domains/funnels/ui/steps/info-step.tsx`

**Interfaces:**
- Produces: `FunnelSpec.hero: HeroContent`; `HeroContent = { headline, subhead, scarcityLine, prompt?, media? }`; `HeroMedia = { kind:'image', src, alt }`; `StepProps.isAnswered: boolean`; `FunnelHero({ content }: { content: HeroContent })`.
- Consumes: existing `FunnelStep` union, `STEP_REGISTRY`, `useFunnelEngine`.

- [ ] **Step 1: Reshape `types.ts`**

In `src/shared/domains/funnels/types.ts`: remove the `'info'` keys and `InfoStep`, add the hero types, and add `isAnswered`. Apply these exact edits:

Replace the `AnswerByKind` interface body so `'info'` is gone:
```ts
export interface AnswerByKind {
  'card-select': string
  'location': LocationAnswer
  'pii-form': PiiAnswer
}
```

Replace the `HeroContent` interface (currently `{ headline, subhead, scarcityLine, cta }`) with:
```ts
export interface HeroMedia { kind: 'image', src: string, alt: string }
export interface HeroContent {
  headline: string
  subhead: string
  scarcityLine: string
  /** Optional prompt introducing the embedded first question, e.g. "Start here ↓". */
  prompt?: string
  media?: HeroMedia
}
```

Remove `'info': HeroContent` from `ContentByKind`:
```ts
export interface ContentByKind {
  'card-select': CardSelectContent
  'location': LocationContent
  'pii-form': PiiContent
}
```

Delete the `InfoStep` interface and remove it from the union:
```ts
export type FunnelStep = CardSelectStep | LocationStep | PiiStep
```

Add `isAnswered` to `StepProps` (after `value`):
```ts
export interface StepProps<S extends FunnelStep = FunnelStep> {
  step: S
  content: ContentOf<S>
  value: AnswerOf<S> | null
  isAnswered: boolean
  setValue: (answer: AnswerOf<S>) => void
  answers: FunnelAnswers
  ctx: FunnelContext
  advance: () => void
  back: () => void
  isFirst: boolean
}
```

Add `hero` to `FunnelSpec` (after `title`):
```ts
export interface FunnelSpec {
  slug: FunnelSlug
  offer: string
  title: string
  hero: HeroContent
  theme: FunnelTheme
  pixel: FunnelPixel
  steps: FunnelStep[]
  flow?: (answers: FunnelAnswers, currentStepId: StepId) => StepId | null
}
```

- [ ] **Step 2: Update the registry and delete `info-step.tsx`**

`src/shared/domains/funnels/constants/step-registry.ts` — remove the info import and entry:
```ts
import type { StepRegistry } from '@/shared/domains/funnels/types'
import { CardSelectStepView } from '@/shared/domains/funnels/ui/steps/card-select-step'
import { LocationStepView } from '@/shared/domains/funnels/ui/steps/location-step'
import { PiiFormStepView } from '@/shared/domains/funnels/ui/steps/pii-form-step'

/** kind → step component. Typed by StepRegistry so each slot is checked against its kind. */
export const STEP_REGISTRY: StepRegistry = {
  'card-select': CardSelectStepView,
  'location': LocationStepView,
  'pii-form': PiiFormStepView,
}
```

Then delete the file `src/shared/domains/funnels/ui/steps/info-step.tsx`.

- [ ] **Step 3: Create `funnel-hero.tsx`**

`src/shared/domains/funnels/ui/funnel-hero.tsx`:
```tsx
import type { HeroContent } from '@/shared/domains/funnels/types'
import Image from 'next/image'

/** The offer-aligned landing band that frames the funnel's first question.
 *  Rendered by the engine shell only while on step 1 (see funnel-engine.tsx). */
export function FunnelHero({ content }: { content: HeroContent }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      {content.media
        ? (
            <Image
              src={content.media.src}
              alt={content.media.alt}
              width={640}
              height={360}
              priority
              className="h-auto w-full rounded-2xl object-cover"
            />
          )
        : null}
      <h1 className="text-balance text-3xl font-bold tracking-tight">{content.headline}</h1>
      <p className="text-muted-foreground text-balance text-lg">{content.subhead}</p>
      <p className="text-primary text-sm font-medium">{content.scarcityLine}</p>
      {content.prompt ? <p className="text-muted-foreground mt-2 text-sm">{content.prompt}</p> : null}
    </div>
  )
}
```

- [ ] **Step 4: Render the hero band + pass `isAnswered` in the shell**

`src/shared/domains/funnels/ui/funnel-engine.tsx` — import `FunnelHero`, gate the progress + render the band while first, pass `isAnswered`. Replace the `return (...)` block (lines 39-65) with:
```tsx
  const showHero = engine.isFirst

  return (
    <div data-funnel={spec.slug} className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-8 px-5 py-10">
      {showHero ? null : <FunnelProgress total={spec.steps.length} currentIndex={currentIndex} />}
      {showHero ? <FunnelHero content={spec.hero} /> : null}
      <AnimatePresence mode="wait">
        <motion.div
          key={engine.step.id}
          initial={reduceMotion ? false : STEP_VARIANTS.initial}
          animate={STEP_VARIANTS.animate}
          exit={reduceMotion ? undefined : STEP_VARIANTS.exit}
          transition={FUNNEL_TRANSITION}
          className="flex-1"
        >
          <StepView
            step={engine.step}
            content={engine.step.content}
            value={engine.value}
            isAnswered={engine.value != null}
            setValue={engine.setAnswer}
            answers={engine.answers}
            ctx={ctx}
            advance={engine.advance}
            back={engine.back}
            isFirst={engine.isFirst}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  )
```
Add the import near the other UI imports:
```tsx
import { FunnelHero } from '@/shared/domains/funnels/ui/funnel-hero'
```

- [ ] **Step 5: Update the kitchens config — drop the info step, add `hero`**

`src/shared/domains/funnels/constants/kitchens.ts` — remove the `{ id: 'hero', kind: 'info', … }` step entirely so `steps[0]` is the `layout` card-select, and add a top-level `hero` block (the old hero copy moves into it). Result:
```ts
import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { ZIP_STEP } from '@/shared/domains/funnels/ui/steps/location-step'
import { PII_STEP } from '@/shared/domains/funnels/ui/steps/pii-form-step'

export const kitchensFunnel: FunnelSpec = {
  slug: 'kitchens',
  offer: 'showcase',
  title: 'Kitchen Showcase',
  hero: {
    headline: 'Get a AAA-grade kitchen remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase kitchens.',
    scarcityLine: 'We\'re selecting 5 kitchens in your area.',
    prompt: 'Start by telling us about your kitchen ↓',
  },
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'kitchen' },
  // Linear funnel: no `flow` — the engine advances through `steps` in order.
  steps: [
    {
      id: 'layout',
      kind: 'card-select',
      optionIds: ['l-shape', 'u-shape', 'galley', 'island', 'open', 'not-sure'],
      content: {
        title: 'Which best describes your kitchen?',
        options: {
          'l-shape': { label: 'L-shaped' },
          'u-shape': { label: 'U-shaped' },
          'galley': { label: 'Galley' },
          'island': { label: 'Has an island' },
          'open': { label: 'Open-concept' },
          'not-sure': { label: 'Not sure' },
        },
      },
    },
    {
      id: 'ownership',
      kind: 'card-select',
      optionIds: ['own', 'rent'],
      content: {
        title: 'Do you own or rent your home?',
        subtitle: 'Showcase projects are available to homeowners.',
        options: {
          own: { label: 'I own my home' },
          rent: { label: 'I rent' },
        },
      },
    },
    { ...ZIP_STEP, content: { ...ZIP_STEP.content, subtitle: 'Showcase kitchens are selected by neighborhood.' } },
    PII_STEP,
  ],
}
```

- [ ] **Step 6: Add a minimal `hero` to the two stubs**

`src/shared/domains/funnels/constants/bathrooms.ts` — add a `hero` block (keep `steps: []`):
```ts
  hero: {
    headline: 'A showcase bathroom remodel — at a Showcase price.',
    subhead: 'See if your home qualifies for one of our Showcase bathrooms.',
    scarcityLine: 'Limited Showcase spots in your area.',
  },
```
Add it after `title: 'Bathroom Showcase',`. Do the same for `complete-interior.ts` with copy adapted to "complete-interior" / "Complete-Interior Showcase".

- [ ] **Step 7: Verify**

Run: `pnpm tsc` → Expected: 0 errors (the lockstep removal forces all four sites; if any `info` reference remains, tsc names it).
Run: `pnpm lint` → Expected: 0 errors.
Browser (if dev server + Playwright available): load the kitchens funnel; expect the hero band (headline/subhead/scarcity/prompt) above the "Which best describes your kitchen?" cards, **no progress bar yet**; tapping a card advances and the hero disappears with the progress bar now visible.

- [ ] **Step 8: Commit**
```bash
git status --short
git commit -m "feat(funnels): hero frames step 1; remove info kind" -- \
  src/shared/domains/funnels/types.ts \
  src/shared/domains/funnels/constants/step-registry.ts \
  src/shared/domains/funnels/ui/funnel-engine.tsx \
  src/shared/domains/funnels/ui/funnel-hero.tsx \
  src/shared/domains/funnels/constants/kitchens.ts \
  src/shared/domains/funnels/constants/bathrooms.ts \
  src/shared/domains/funnels/constants/complete-interior.ts \
  src/shared/domains/funnels/ui/steps/info-step.tsx
```

---

## Task 2: Lift Back/Next nav into the shell + revisit semantics

The shell owns Back/Next. Card-select auto-advances only on a *first* answer; revisiting an answered step shows a Next button instead of jumping. Per-step Back buttons are removed.

**Files:**
- Modify: `src/shared/domains/funnels/hooks/use-funnel-engine.ts`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx`
- Modify: `src/shared/domains/funnels/ui/steps/card-select-step.tsx`

**Interfaces:**
- Produces: `FunnelEngineApi.hasNext: boolean`.
- Consumes: `StepProps.isAnswered` (Task 1), `defaultLinearNext`, `engine.advance/back`.

- [ ] **Step 1: Add `hasNext` to the engine**

`src/shared/domains/funnels/hooks/use-funnel-engine.ts` — add to `FunnelEngineApi` (after `isFirst`):
```ts
  hasNext: boolean
```
Compute it before the `return` (it mirrors `advance`'s next-id logic):
```ts
  const nextId = spec.flow
    ? spec.flow(effective.answers, step.id)
    : defaultLinearNext(spec.steps, step.id)
  const hasNext = nextId != null && nextId !== step.id
```
Add `hasNext,` to the returned object.

- [ ] **Step 2: Render Back/Next in the shell**

`src/shared/domains/funnels/ui/funnel-engine.tsx` — import `Button`, and add a nav row after the `</AnimatePresence>`:
```tsx
import { Button } from '@/shared/components/ui/button'
```
```tsx
      <div className="flex items-center justify-between gap-3">
        {engine.isFirst
          ? <span />
          : <Button variant="ghost" onClick={engine.back}>← Back</Button>}
        {engine.value != null && engine.hasNext
          ? <Button onClick={engine.advance}>Next →</Button>
          : <span />}
      </div>
```
Place this inside the outer `<div data-funnel …>`, after the `AnimatePresence` block. (The empty `<span />`s keep Back left / Next right via `justify-between`.)

- [ ] **Step 3: Card-select auto-advances only on first answer; drop own Back**

`src/shared/domains/funnels/ui/steps/card-select-step.tsx` — change the signature to take `isAnswered`, gate the advance, and remove the per-step Back block:
```tsx
export function CardSelectStepView({ step, content, value, isAnswered, setValue, advance }: StepProps<CardSelectStep>) {
  function handleSelect(optionId: string) {
    setValue(optionId)
    // Micro-commitment: a first answer advances immediately. On a revisit
    // (already answered, reached via Back), selecting only changes the value —
    // the shell's Next advances, so the user can review.
    if (!isAnswered) {
      advance()
    }
  }
```
Delete the trailing `{!isFirst ? (<div…><Button…Back…/></div>) : null}` block entirely (the shell owns Back now). Remove `back`/`isFirst` from the destructure.

- [ ] **Step 4: Verify**

`pnpm tsc` → 0 errors. `pnpm lint` → 0 errors.
Browser: answer Q1 → auto-advances. On Q2 press Back → returns to Q1 showing a **Next →** button (right) and **← Back** (left); the prior selection is highlighted; tapping the same/another option does **not** jump; pressing Next advances.

- [ ] **Step 5: Commit**
```bash
git status --short
git commit -m "feat(funnels): shell-owned Back/Next + revisit review state" -- \
  src/shared/domains/funnels/hooks/use-funnel-engine.ts \
  src/shared/domains/funnels/ui/funnel-engine.tsx \
  src/shared/domains/funnels/ui/steps/card-select-step.tsx
```

---

## Task 3: Continuous progress bar

One motion-animated fill that climbs across all steps (so post-PII enrichment steps in 2c keep it below 100% at PII). Hidden during the hero (already gated in Task 1).

**Files:**
- Modify: `src/shared/domains/funnels/ui/funnel-progress.tsx`

**Interfaces:**
- Consumes: the existing `{ total, currentIndex }` props passed by `funnel-engine.tsx`.

- [ ] **Step 1: Rewrite the progress bar**

`src/shared/domains/funnels/ui/funnel-progress.tsx`:
```tsx
import { motion, useReducedMotion } from 'motion/react'

export function FunnelProgress({ total, currentIndex }: { total: number, currentIndex: number }) {
  const reduceMotion = useReducedMotion()
  // currentIndex is 0-based; +1 so the first in-funnel step shows real progress.
  const pct = total > 0 ? Math.min(100, Math.round(((currentIndex + 1) / total) * 100)) : 0

  return (
    <div className="bg-border h-1.5 w-full overflow-hidden rounded-full" aria-hidden>
      <motion.div
        className="bg-primary h-full rounded-full"
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify**

`pnpm tsc` → 0 errors. `pnpm lint` → 0 errors.
Browser: progressing through steps animates a single continuous fill; at the PII step it is **not** at 100% only if later steps exist (in 2b.5 PII is last, so it will read full — that's expected until 2c adds steps).

- [ ] **Step 3: Commit**
```bash
git status --short
git commit -m "feat(funnels): continuous animated progress bar" -- \
  src/shared/domains/funnels/ui/funnel-progress.tsx
```

---

## Task 4: Option assets on card-select

Choice cards can carry an icon (lucide) or an image. Adds the asset model, an icon registry, the render, and assets on the kitchen layout options.

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`
- Create: `src/shared/domains/funnels/constants/option-assets.tsx`
- Modify: `src/shared/domains/funnels/ui/steps/card-select-step.tsx`
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`

**Interfaces:**
- Produces: `OptionAsset = { kind:'icon', name: OptionIconName } | { kind:'image', src, alt }`; `OPTION_ICONS: Record<OptionIconName, LucideIcon>`; `OptionContent.asset?: OptionAsset`.

- [ ] **Step 1: Add the asset type to `types.ts`**

Replace the `OptionContent` interface (currently `{ label, icon?, description? }`):
```ts
export type OptionAsset =
  | { kind: 'icon', name: string }
  | { kind: 'image', src: string, alt: string }
export interface OptionContent { label: string, description?: string, asset?: OptionAsset }
```

- [ ] **Step 2: Create the icon registry**

`src/shared/domains/funnels/constants/option-assets.tsx` (lucide-react is already a dep):
```tsx
import type { LucideIcon } from 'lucide-react'
import { CookingPot, Grid2x2, HelpCircle, LayoutGrid, Refrigerator, Square } from 'lucide-react'

/** Named icons referenceable from a funnel's option `asset: { kind:'icon', name }`.
 *  Keep names stable — funnel configs reference them by string. */
export const OPTION_ICONS: Record<string, LucideIcon> = {
  'l-shape': Square,
  'u-shape': LayoutGrid,
  'galley': Grid2x2,
  'island': CookingPot,
  'open': Refrigerator,
  'not-sure': HelpCircle,
}
```

- [ ] **Step 3: Render the asset in card-select**

`src/shared/domains/funnels/ui/steps/card-select-step.tsx` — add imports and render the asset above the label. Add:
```tsx
import Image from 'next/image'
import { OPTION_ICONS } from '@/shared/domains/funnels/constants/option-assets'
```
Inside the option `<button>`, before the label `<span>`:
```tsx
              {option?.asset?.kind === 'icon' && OPTION_ICONS[option.asset.name]
                ? (() => {
                    const Icon = OPTION_ICONS[option.asset.name]
                    return <Icon className="text-primary mb-2 size-6" />
                  })()
                : null}
              {option?.asset?.kind === 'image'
                ? <Image src={option.asset.src} alt={option.asset.alt} width={48} height={48} className="mb-2" />
                : null}
```

- [ ] **Step 4: Add assets to the kitchen layout options**

`src/shared/domains/funnels/constants/kitchens.ts` — give each `layout` option an icon asset:
```ts
        options: {
          'l-shape': { label: 'L-shaped', asset: { kind: 'icon', name: 'l-shape' } },
          'u-shape': { label: 'U-shaped', asset: { kind: 'icon', name: 'u-shape' } },
          'galley': { label: 'Galley', asset: { kind: 'icon', name: 'galley' } },
          'island': { label: 'Has an island', asset: { kind: 'icon', name: 'island' } },
          'open': { label: 'Open-concept', asset: { kind: 'icon', name: 'open' } },
          'not-sure': { label: 'Not sure', asset: { kind: 'icon', name: 'not-sure' } },
        },
```

- [ ] **Step 5: Verify**

`pnpm tsc` → 0 errors. `pnpm lint` → 0 errors.
Browser: the layout cards show an icon above each label; the ownership step (no assets) renders label-only (graceful absence).

- [ ] **Step 6: Commit**
```bash
git status --short
git commit -m "feat(funnels): option assets (icon/image) on card-select" -- \
  src/shared/domains/funnels/types.ts \
  src/shared/domains/funnels/constants/option-assets.tsx \
  src/shared/domains/funnels/ui/steps/card-select-step.tsx \
  src/shared/domains/funnels/constants/kitchens.ts
```

---

## Task 5: ZIP region classification (pure lib)

Adds a pure `classifyZip` for SoCal format + service-area checks, without changing `resolveZip`'s signature (non-breaking; the location step consumes it in Task 6).

**Files:**
- Modify: `src/shared/domains/funnels/lib/resolve-zip.ts`

**Interfaces:**
- Produces: `classifyZip(zip: string): 'in-area' | 'out-of-area' | 'invalid-format'`.
- Consumes: `CA_ZIP_CITIES` (existing).

- [ ] **Step 1: Add `classifyZip`**

Append to `src/shared/domains/funnels/lib/resolve-zip.ts`:
```ts
/** SoCal ZIP range ≈ 90001–93599 (LA / OC / SD / Inland Empire / Ventura). */
const SOCAL_ZIP = /^9[0-3]\d{3}$/

/**
 * Typo-prevention + light territory check (NOT a hard gate — we'd rather
 * qualify an adjacent SoCal homeowner than reject them):
 * - 'invalid-format'  → not a 5-digit SoCal-range ZIP; reject as a mistake.
 * - 'in-area'         → a known service-area ZIP, OR a SoCal-range ZIP we accept.
 * - 'out-of-area'     → reserved for future tightening (currently unused; SoCal
 *                       range all maps to 'in-area'). Kept for the not-qualified UI.
 */
export function classifyZip(zip: string): 'in-area' | 'out-of-area' | 'invalid-format' {
  if (!SOCAL_ZIP.test(zip)) {
    return 'invalid-format'
  }
  return 'in-area'
}
```

- [ ] **Step 2: Verify with a throwaway scriptlet**

Create `scripts/_verify-classify-zip.ts`:
```ts
import { classifyZip } from '@/shared/domains/funnels/lib/resolve-zip'

const cases: Array<[string, ReturnType<typeof classifyZip>]> = [
  ['91335', 'in-area'],   // Reseda
  ['90001', 'in-area'],   // LA
  ['93599', 'in-area'],   // upper SoCal range
  ['94016', 'invalid-format'], // SF — out of SoCal range
  ['1234', 'invalid-format'],  // too short
  ['ABCDE', 'invalid-format'],
]
let ok = true
for (const [zip, want] of cases) {
  const got = classifyZip(zip)
  if (got !== want) {
    ok = false
    console.error(`FAIL ${zip}: got ${got}, want ${want}`)
  }
}
console.log(ok ? 'PASS classifyZip' : 'FAIL classifyZip')
```
Run: `pnpm tsx scripts/_verify-classify-zip.ts` → Expected: `PASS classifyZip`.
Then `pnpm tsc && pnpm lint` → 0 errors. **Delete the scriptlet:** `rm scripts/_verify-classify-zip.ts`.

- [ ] **Step 3: Commit**
```bash
git status --short
git commit -m "feat(funnels): classifyZip SoCal region check" -- \
  src/shared/domains/funnels/lib/resolve-zip.ts
```

---

## Task 6: Location step rework

Fixes the persistence bug (#5), the label conflation (#4), adds an anticipation beat and a not-in-area phase, and consumes `classifyZip`. Splits `LocationContent` labels.

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`
- Modify: `src/shared/domains/funnels/ui/steps/location-step.tsx`

**Interfaces:**
- Consumes: `classifyZip` (Task 5), `resolveZip`, `StepProps.isAnswered`/`value`, `LocationAnswer`.
- Produces: split `LocationContent` (`inputCta`/`checkingLabel`/`qualifiesLabel`/`outOfAreaLabel`); updated `ZIP_STEP`.

- [ ] **Step 1: Split `LocationContent` in `types.ts`**

Replace the `LocationContent` interface:
```ts
export interface LocationContent {
  title: string
  subtitle?: string
  inputCta?: string        // input phase button — default "Check my area"
  checkingLabel?: string   // checking phase ({zip} placeholder supported)
  qualifiesLabel?: string  // qualified headline
  outOfAreaLabel?: string  // not-in-area message
}
```

- [ ] **Step 2: Rework the location step**

Replace `src/shared/domains/funnels/ui/steps/location-step.tsx` body (keep the file's exports). The step now: seeds from `value` (persistence), enforces a ~1.2s minimum checking duration (anticipation), branches on `classifyZip` (not-in-area), and uses the split labels. The shell owns Back/Next — no own Back; on a qualified revisit it renders the qualified view and the shell's Next advances.
```tsx
import type { LocationStep, StepProps } from '@/shared/domains/funnels/types'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { classifyZip, resolveZip } from '@/shared/domains/funnels/lib/resolve-zip'

type Phase = 'input' | 'checking' | 'qualified' | 'out-of-area'
const MIN_CHECKING_MS = 1200

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms))
}

export function LocationStepView({ content, value, setValue }: StepProps<LocationStep>) {
  // Persistence (#5): if this step was already answered (reached via Back),
  // mount directly in the qualified phase with the stored ZIP.
  const [zip, setZip] = useState(value?.zip ?? '')
  const [phase, setPhase] = useState<Phase>(value?.zip ? 'qualified' : 'input')

  async function handleSubmit() {
    if (!/^\d{5}$/.test(zip)) {
      return
    }
    if (classifyZip(zip) !== 'in-area') {
      setPhase('out-of-area')
      return
    }
    setPhase('checking')
    // Anticipation beat (#4): local ZIPs resolve instantly — make qualifying breathe.
    const [resolved] = await Promise.all([resolveZip(zip), delay(MIN_CHECKING_MS)])
    setValue({
      zip,
      city: resolved?.city ?? '',
      state: resolved?.state ?? 'CA',
      county: resolved?.county ?? null,
    })
    setPhase('qualified')
  }

  if (phase === 'checking') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
        <p className="text-muted-foreground">{(content.checkingLabel ?? 'Checking availability in {zip}…').replace('{zip}', zip)}</p>
      </div>
    )
  }

  if (phase === 'qualified') {
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center">
        <p className="text-primary text-xl font-semibold">
          {content.qualifiesLabel ?? '✓ Great news — your area qualifies.'}
        </p>
        {/* Plan 2c replaces this with the stylized SVG region reveal. */}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground mt-1">{content.subtitle}</p> : null}
      </div>
      <Input
        inputMode="numeric"
        maxLength={5}
        placeholder="ZIP code"
        value={zip}
        onChange={(e) => {
          setZip(e.target.value.replace(/\D/g, ''))
          if (phase === 'out-of-area') {
            setPhase('input')
          }
        }}
        className="mx-auto max-w-xs text-center text-lg"
      />
      {phase === 'out-of-area'
        ? <p className="text-muted-foreground text-center text-sm">{content.outOfAreaLabel ?? 'We don\'t serve that area yet — double-check your ZIP.'}</p>
        : null}
      <Button size="lg" disabled={!/^\d{5}$/.test(zip)} onClick={handleSubmit}>
        {content.inputCta ?? 'Check my area'}
      </Button>
    </div>
  )
}

/** Importable prebuilt step (Seam A). Spread + override `content` to customize per funnel. */
export const ZIP_STEP: LocationStep = {
  id: 'location',
  kind: 'location',
  content: {
    title: 'Where is your home?',
    subtitle: 'We select Showcase homes by area.',
    inputCta: 'Check my area',
    checkingLabel: 'Checking availability in {zip}…',
    qualifiesLabel: '✓ Great news — your area qualifies. Limited spots remain.',
    outOfAreaLabel: 'We don\'t serve that area yet — double-check your ZIP.',
  },
}
```
Note: the qualified phase now has **no Continue button** — the shell's Next advances (the step is `isAnswered` once `setValue` ran). On a qualified revisit, `value` seeds the qualified phase and Next is shown by the shell.

- [ ] **Step 3: Verify**

`pnpm tsc` → 0 errors. `pnpm lint` → 0 errors.
Browser: enter `91335` → spinner shows for ~1.2s → "your area qualifies" + shell Next. Press Back from PII → the location step shows the qualified view with the ZIP preserved (not blank) and Next available. Enter `94016` → "We don't serve that area yet"; editing the ZIP clears the message.

- [ ] **Step 4: Commit**
```bash
git status --short
git commit -m "fix(funnels): ZIP persistence, label split, anticipation, out-of-area" -- \
  src/shared/domains/funnels/types.ts \
  src/shared/domains/funnels/ui/steps/location-step.tsx
```

---

## Task 7: PII rework — name split, drop email + city, progressive disclosure

Splits name into first/last, removes email and city from the form, and reveals phone + consent only once both names are filled. Submission still goes through the existing `createFromIntake` (the phone gate is wired in Task 10).

**Files:**
- Modify: `src/shared/domains/funnels/schemas/pii.schema.ts`
- Modify: `src/shared/domains/funnels/lib/build-lead-input.ts`
- Modify: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx`

**Interfaces:**
- Produces: `PiiFormData = { firstName, lastName, phone, consent, _honeypot? }`; `buildLeadInput` reads city/state/zip from `answers.location`, composes `name`, omits `email`.
- Consumes: `answers.location` (`LocationAnswer`), `createFromIntake` (single `name`, optional `email`, required `city`).

- [ ] **Step 1: Rewrite `pii.schema.ts`**
```ts
import z from 'zod'

export const piiSchema = z.object({
  firstName: z.string().min(1, 'Please enter your first name'),
  lastName: z.string().min(1, 'Please enter your last name'),
  phone: z.string().min(7, 'Please enter a valid phone'),
  consent: z.literal(true, { message: 'Please agree to be contacted' }),
  _honeypot: z.string().max(0).optional(),
})
export type PiiFormData = z.infer<typeof piiSchema>
```

- [ ] **Step 2: Rewrite `build-lead-input.ts`**

Compose `name`, source city/state/zip from the location answer, omit email. The `createFromIntake` input requires `city` (min 1) — fall back so a rare unresolved city never drops a real lead (never-drop principle).
```ts
import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'
import type { FunnelAnswers, FunnelContext, LocationAnswer } from '@/shared/domains/funnels/types'

// trade slug → canonical Notion trade name (CT/SMS uniformity)
const TRADE_NAME: Record<string, string> = {
  'kitchens': 'Kitchen Renovation',
  'bathrooms': 'Bathroom Renovation',
  'complete-interior': 'Complete Interior Remodel',
}

function locationAnswer(answers: FunnelAnswers): Partial<LocationAnswer> {
  const a = answers.location
  return a && typeof a === 'object' && !Array.isArray(a) ? (a as LocationAnswer) : {}
}

export function buildLeadInput(args: { ctx: FunnelContext, pii: PiiFormData, answers: FunnelAnswers }) {
  const { ctx, pii, answers } = args
  const loc = locationAnswer(answers)
  const campaign = ctx.utm.campaign ?? ctx.utm.source ?? `funnel:${ctx.slug}`

  return {
    name: `${pii.firstName} ${pii.lastName}`.trim(),
    phone: pii.phone,
    // city is required by createFromIntake (min 1); the qualified ZIP gate
    // guarantees a resolved city, but never drop a real lead on the rare
    // unresolved case.
    city: loc.city || 'Unknown',
    state: loc.state ?? 'CA',
    zip: loc.zip ?? '',
    mode: 'customer_only' as const,
    leadSourceSlug: 'branded-meta-ads',
    leadMetaJSON: {
      interestedTradesRaw: [TRADE_NAME[ctx.slug] ?? ctx.slug],
      originCampaign: campaign,
      source: {
        kind: 'funnel' as const,
        offer: ctx.offer,
        funnelSlug: ctx.slug,
        utm: ctx.utm,
      },
    },
  }
}
```

- [ ] **Step 3: Rewrite the PII step with progressive disclosure**

`src/shared/domains/funnels/ui/steps/pii-form-step.tsx`. Both name fields show on mount; phone + consent animate in (`AnimatePresence`) once both names are non-empty; submit is disabled until the form is valid. Still submits via `createFromIntake`.
```tsx
import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'
import type { PiiStep, StepProps } from '@/shared/domains/funnels/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { buildLeadInput } from '@/shared/domains/funnels/lib/build-lead-input'
import { piiSchema } from '@/shared/domains/funnels/schemas/pii.schema'
import { useTRPC } from '@/trpc/helpers'

export function PiiFormStepView({ content, answers, ctx, setValue, advance }: StepProps<PiiStep>) {
  const trpc = useTRPC()
  const reduceMotion = useReducedMotion()
  const submit = useMutation(trpc.customersRouter.business.createFromIntake.mutationOptions({
    onError: err => toast.error(err.message),
  }))

  const form = useForm<PiiFormData>({
    resolver: zodResolver(piiSchema),
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    defaultValues: { firstName: '', lastName: '', phone: '', consent: false as unknown as true, _honeypot: '' },
  })

  const [firstName, lastName] = form.watch(['firstName', 'lastName'])
  const namesFilled = Boolean(firstName?.trim()) && Boolean(lastName?.trim())

  async function onSubmit(data: PiiFormData) {
    if (data._honeypot) {
      return
    }
    const created = await submit.mutateAsync(buildLeadInput({ ctx, pii: data, answers }))
    setValue({ leadId: created.customerId })
    advance()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">{content.title}</h2>
          {content.subtitle ? <p className="text-muted-foreground mt-1">{content.subtitle}</p> : null}
        </div>
        <fieldset disabled={form.formState.isSubmitting} className="contents">
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{content.fields.firstName ?? 'First name'}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{content.fields.lastName ?? 'Last name'}</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <AnimatePresence>
            {namesFilled
              ? (
                  <motion.div
                    key="reveal"
                    initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                    className="flex flex-col gap-5 overflow-hidden"
                  >
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{content.fields.phone ?? 'Phone'}</FormLabel>
                          <FormControl><Input type="tel" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="consent"
                      render={({ field }) => (
                        <FormItem className="flex items-start gap-2">
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                          <FormLabel className="text-muted-foreground text-xs font-normal leading-snug">{content.consent}</FormLabel>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )
              : null}
          </AnimatePresence>
          <input type="text" tabIndex={-1} autoComplete="off" className="hidden" {...form.register('_honeypot')} />
        </fieldset>
        <Button type="submit" size="lg" disabled={!namesFilled || submit.isPending}>
          {submit.isPending ? 'Submitting…' : (content.cta ?? 'See if I qualify')}
        </Button>
      </form>
    </Form>
  )
}

/** Importable prebuilt step (Seam A). Spread + override `content` per funnel. */
export const PII_STEP: PiiStep = {
  id: 'pii',
  kind: 'pii-form',
  content: {
    title: 'Where should we send your Showcase details?',
    cta: 'See if I qualify',
    consent: 'By submitting, I agree Tri Pros Remodeling may contact me by call, text, and email about my project. Consent isn\'t a condition of purchase. Msg/data rates may apply. See our Privacy Policy.',
    fields: { firstName: 'First name', lastName: 'Last name', phone: 'Phone' },
  },
}
```

- [ ] **Step 4: Update `PiiContent.fields` labels in `types.ts`**

Replace `PiiFieldLabels`:
```ts
export interface PiiFieldLabels { firstName?: string, lastName?: string, phone?: string }
```

- [ ] **Step 5: Verify**

`pnpm tsc` → 0 errors. `pnpm lint` → 0 errors.
Browser: PII step shows only First/Last + a disabled submit. Filling both names animates in the phone field + consent. Submitting a valid form creates a lead (toast/advance). Confirm the dev-DB customer's `name` is `"First Last"`, `city` came from the ZIP step, and there is no email.

- [ ] **Step 6: Commit**
```bash
git status --short
git commit -m "feat(funnels): PII name split + progressive disclosure; drop email/city" -- \
  src/shared/domains/funnels/schemas/pii.schema.ts \
  src/shared/domains/funnels/lib/build-lead-input.ts \
  src/shared/domains/funnels/ui/steps/pii-form-step.tsx \
  src/shared/domains/funnels/types.ts
```

---

## Task 8: Twilio Lookup provider method + phone-gate lib + leadMeta field

Adds the provider leaf, the pure gate verdict (with fail-open), the `phoneVerification` leadMeta field, and the `libphonenumber-js` dependency.

**Files:**
- Modify: `src/shared/services/providers/twilio/client.ts`
- Create: `src/shared/domains/funnels/lib/evaluate-phone-gate.ts`
- Modify: `src/shared/entities/customers/schemas/index.ts`
- Modify: `package.json` (add `libphonenumber-js`)

**Interfaces:**
- Produces: `twilioClient.lookupPhoneNumber(e164: string): Promise<PhoneLookupResult>`; `PhoneLookupResult = { valid: boolean, lineType: string | null, carrierName: string | null, errorCode: number | null }`; `evaluatePhoneGate(result | null): { ok: boolean, status: 'verified' | 'unverified', lineType, carrierName }`; `leadMetaSchema.phoneVerification`.

- [ ] **Step 1: Install `libphonenumber-js`**

Run: `pnpm add libphonenumber-js`
Expected: `package.json` dependencies now include `libphonenumber-js`.

- [ ] **Step 2: Add `lookupPhoneNumber` to the Twilio client**

`src/shared/services/providers/twilio/client.ts` — add a method inside the returned object (e.g. after `fetchMessage`), plus the result type near the other interfaces. Type:
```ts
export interface PhoneLookupResult {
  valid: boolean
  lineType: string | null
  carrierName: string | null
  errorCode: number | null
}
```
Method (leaf — primitives in/out, no domain types):
```ts
    /**
     * Lookup v2 with line-type-intelligence. Confirms a number is real/reachable
     * and resolves its line type + carrier. Paid (~$0.005/lookup). Throws on a
     * transport/API error — callers MUST treat a throw as "indeterminate" and
     * fail open (never block a lead on a Twilio outage). See the funnel phone gate.
     */
    async lookupPhoneNumber(e164: string): Promise<PhoneLookupResult> {
      const res = await sdk().lookups.v2.phoneNumbers(e164).fetch({ fields: 'line_type_intelligence' })
      return {
        valid: res.valid ?? false,
        lineType: res.lineTypeIntelligence?.type ?? null,
        carrierName: res.lineTypeIntelligence?.carrier_name ?? null,
        errorCode: res.lineTypeIntelligence?.error_code ?? null,
      }
    },
```
(If the SDK property names differ at compile time, prefer the typed accessors the SDK exposes; the field request string is `'line_type_intelligence'`.)

- [ ] **Step 3: Create the pure gate**

`src/shared/domains/funnels/lib/evaluate-phone-gate.ts`:
```ts
import type { PhoneLookupResult } from '@/shared/services/providers/twilio/client'

export interface PhoneGateVerdict {
  ok: boolean
  status: 'verified' | 'unverified'
  lineType: string | null
  carrierName: string | null
}

/**
 * Hard gate, but fail OPEN. Pass `null` when the lookup threw / timed out.
 * - lookup === null OR errorCode set  → indeterminate → accept, status 'unverified'.
 * - valid === false                   → definitive garbage → block.
 * - valid === true                    → accept, status 'verified'.
 * Never blocks on uncertainty; never drops a lead because Twilio didn't answer.
 */
export function evaluatePhoneGate(lookup: PhoneLookupResult | null): PhoneGateVerdict {
  if (lookup === null || lookup.errorCode != null) {
    return { ok: true, status: 'unverified', lineType: lookup?.lineType ?? null, carrierName: lookup?.carrierName ?? null }
  }
  if (!lookup.valid) {
    return { ok: false, status: 'unverified', lineType: lookup.lineType, carrierName: lookup.carrierName }
  }
  return { ok: true, status: 'verified', lineType: lookup.lineType, carrierName: lookup.carrierName }
}
```

- [ ] **Step 4: Add `phoneVerification` to `leadMetaSchema`**

`src/shared/entities/customers/schemas/index.ts` — add inside the `leadMetaSchema` object (beside `interestedTradesRaw`/`originCampaign`):
```ts
  phoneVerification: z.object({
    status: z.enum(['verified', 'unverified']),
    lineType: z.string().nullable(),
    carrierName: z.string().nullable(),
  }).optional(),
```

- [ ] **Step 5: Verify the pure gate with a throwaway scriptlet**

Create `scripts/_verify-phone-gate.ts`:
```ts
import { evaluatePhoneGate } from '@/shared/domains/funnels/lib/evaluate-phone-gate'

const tests = [
  [null, { ok: true, status: 'unverified' }],
  [{ valid: false, lineType: null, carrierName: null, errorCode: null }, { ok: false, status: 'unverified' }],
  [{ valid: true, lineType: 'mobile', carrierName: 'AT&T', errorCode: null }, { ok: true, status: 'verified' }],
  [{ valid: true, lineType: null, carrierName: null, errorCode: 60600 }, { ok: true, status: 'unverified' }],
] as const
let ok = true
for (const [input, want] of tests) {
  const v = evaluatePhoneGate(input as never)
  if (v.ok !== want.ok || v.status !== want.status) {
    ok = false
    console.error('FAIL', input, '→', v, 'want', want)
  }
}
console.log(ok ? 'PASS evaluatePhoneGate' : 'FAIL evaluatePhoneGate')
```
Run: `pnpm tsx scripts/_verify-phone-gate.ts` → Expected: `PASS evaluatePhoneGate`. Then `pnpm tsc && pnpm lint` → 0 errors. **Delete:** `rm scripts/_verify-phone-gate.ts`.

- [ ] **Step 6: Commit**
```bash
git status --short
git commit -m "feat(funnels): Twilio Lookup provider + phone-gate lib + leadMeta field" -- \
  package.json pnpm-lock.yaml \
  src/shared/services/providers/twilio/client.ts \
  src/shared/domains/funnels/lib/evaluate-phone-gate.ts \
  src/shared/entities/customers/schemas/index.ts
```

---

## Task 9: funnelsRouter — phoneLookup + submitLead

A new tRPC router housing the public phone lookup (for the client UX check) and the server-authoritative `submitLead` (the hard gate + ingest). This is also where 2c's `enrichFunnelLead` will live.

**Files:**
- Create: `src/trpc/routers/funnels.router.ts`
- Modify: `src/trpc/routers/app.ts`

**Interfaces:**
- Consumes: `twilioClient.lookupPhoneNumber`, `evaluatePhoneGate`, `customerIntakeService.ingestLead`, `SYSTEM_CONTEXT`, `leadMetaSchema`, `baseProcedure`/`createTRPCRouter`.
- Produces: `funnelsRouter` with `phoneLookup` (query → `PhoneLookupResult`) and `submitLead` (mutation → `{ customerId }`).

- [ ] **Step 1: Create the router**

`src/trpc/routers/funnels.router.ts`:
```ts
import { TRPCError } from '@trpc/server'
import z from 'zod'

import { SYSTEM_CONTEXT } from '@/shared/dal/server/types'
import { evaluatePhoneGate } from '@/shared/domains/funnels/lib/evaluate-phone-gate'
import { leadMetaSchema } from '@/shared/entities/customers/schemas'
import { customerIntakeService } from '@/shared/services/customer-intake.service'
import { RestException, twilioClient } from '@/shared/services/providers/twilio/client'

import { baseProcedure, createTRPCRouter } from '../init'

const e164 = z.string().regex(/^\+1\d{10}$/, 'Expected a US E.164 number')

export const funnelsRouter = createTRPCRouter({
  // Public UX check — the PII step calls this (debounced) to surface the
  // verdict before submit. Returns the raw lookup; the gate is applied client
  // and (authoritatively) server-side in submitLead.
  phoneLookup: baseProcedure
    .input(z.object({ phone: e164 }))
    .query(async ({ input }) => {
      try {
        return await twilioClient.lookupPhoneNumber(input.phone)
      }
      catch (err) {
        if (err instanceof RestException) {
          // Treat as indeterminate — the client gate will fail open.
          return { valid: true, lineType: null, carrierName: null, errorCode: -1 }
        }
        throw err
      }
    }),

  // Server-authoritative submit: hard gate (fail-open on outage) → ingest.
  submitLead: baseProcedure
    .input(z.object({
      phone: e164,
      name: z.string().min(1),
      city: z.string().min(1),
      state: z.string().length(2).optional(),
      zip: z.string().min(1),
      leadSourceSlug: z.string(),
      leadMetaJSON: leadMetaSchema,
    }))
    .mutation(async ({ input }) => {
      // Authoritative lookup; a transport error fails OPEN (never drop a lead).
      let lookup = null
      try {
        lookup = await twilioClient.lookupPhoneNumber(input.phone)
      }
      catch {
        lookup = null
      }
      const verdict = evaluatePhoneGate(lookup)
      if (!verdict.ok) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'That phone number doesn\'t look valid — please double-check it.' })
      }

      const result = await customerIntakeService.ingestLead(SYSTEM_CONTEXT, {
        core: {
          name: input.name,
          phone: input.phone,
          email: null,
          address: null,
          city: input.city,
          state: input.state ?? 'CA',
          zip: input.zip,
          leadSourceSlug: input.leadSourceSlug,
        },
        leadMeta: {
          ...input.leadMetaJSON,
          phoneVerification: {
            status: verdict.status,
            lineType: verdict.lineType,
            carrierName: verdict.carrierName,
          },
        },
      })
      if (!result.success) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not save your details. Please try again.' })
      }
      return { customerId: result.data.customer.id }
    }),
})
```
(`submitLead` input `phone` is E.164; the client must normalize to E.164 before calling — Task 10.)

- [ ] **Step 2: Register in `app.ts`**

`src/trpc/routers/app.ts` — add the import (alphabetical, before `intakeRouter`) and the registration (in the `createTRPCRouter({…})` block):
```ts
import { funnelsRouter } from './funnels.router'
```
```ts
  funnelsRouter,
```

- [ ] **Step 3: Verify**

`pnpm tsc` → 0 errors. `pnpm lint` → 0 errors. (Runtime submit is exercised in Task 10's browser check.)

- [ ] **Step 4: Commit**
```bash
git status --short
git commit -m "feat(funnels): funnelsRouter — phoneLookup + gated submitLead" -- \
  src/trpc/routers/funnels.router.ts \
  src/trpc/routers/app.ts
```

---

## Task 10: Wire the PII step to the phone gate

Adds the `libphonenumber-js` client pre-check, a debounced server lookup as an RHF async validator, and switches submission to `funnelsRouter.submitLead` (E.164-normalized).

**Files:**
- Create: `src/shared/domains/funnels/hooks/use-debounced-async-validator.ts`
- Modify: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx`

**Interfaces:**
- Consumes: `funnelsRouter.phoneLookup`, `funnelsRouter.submitLead`, `evaluatePhoneGate` (client-side, on the lookup result), `isValidPhoneNumber`/`parsePhoneNumber` from `libphonenumber-js/min`, `buildLeadInput`.
- Produces: `useDebouncedAsyncValidator<T>(fn, delayMs?)`.

- [ ] **Step 1: Create the debounced async validator hook**

`src/shared/domains/funnels/hooks/use-debounced-async-validator.ts`:
```ts
import { useCallback, useRef } from 'react'

/**
 * Wraps an async validator with a debounce + AbortController so it fits RHF's
 * `validate` option. Resolves `true` on abort (a superseded value validates
 * itself), so a stale request never flashes an error.
 */
export function useDebouncedAsyncValidator<T>(
  fn: (value: T, signal: AbortSignal) => Promise<true | string>,
  delayMs = 600,
): (value: T) => Promise<true | string> {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  return useCallback((value: T) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
    }
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac

    return new Promise<true | string>((resolve) => {
      timerRef.current = setTimeout(async () => {
        try {
          resolve(await fn(value, ac.signal))
        }
        catch (err) {
          if (err instanceof Error && err.name === 'AbortError') {
            resolve(true)
          }
          else {
            resolve(true) // network error → fail open; the server gate is authoritative
          }
        }
      }, delayMs)
    })
  }, [fn, delayMs])
}
```

- [ ] **Step 2: Wire phone validation + submitLead in the PII step**

`src/shared/domains/funnels/ui/steps/pii-form-step.tsx` — add imports, a phone validator, and switch the mutation. Add imports:
```tsx
import { isValidPhoneNumber, parsePhoneNumber } from 'libphonenumber-js/min'
import { useDebouncedAsyncValidator } from '@/shared/domains/funnels/hooks/use-debounced-async-validator'
import { evaluatePhoneGate } from '@/shared/domains/funnels/lib/evaluate-phone-gate'
```
Replace the `createFromIntake` mutation with `submitLead`, and add `phoneLookup` access:
```tsx
  const submit = useMutation(trpc.funnelsRouter.submitLead.mutationOptions({
    onError: err => toast.error(err.message),
  }))
  const lookupPhone = trpc.funnelsRouter.phoneLookup
```
Add a phone validator (uses libphonenumber for the free pre-check, then the debounced server lookup):
```tsx
  const queryClient = useQueryClient()
  const validatePhone = useDebouncedAsyncValidator<string>(async (raw, signal) => {
    if (!isValidPhoneNumber(raw, 'US')) {
      return 'Please enter a valid US phone number'
    }
    const e164 = parsePhoneNumber(raw, 'US')!.number
    const lookup = await queryClient.fetchQuery({
      ...lookupPhone.queryOptions({ phone: e164 }),
      staleTime: 5 * 60 * 1000,
    })
    if (signal.aborted) {
      return true
    }
    return evaluatePhoneGate(lookup).ok ? true : 'That phone number doesn\'t look valid — please double-check it.'
  })
```
Add the imports for the query client:
```tsx
import { useMutation, useQueryClient } from '@tanstack/react-query'
```
Attach the validator to the phone `FormField` via `rules`:
```tsx
            <FormField
              control={form.control}
              name="phone"
              rules={{ validate: validatePhone }}
              render={({ field }) => (
                ...
              )}
            />
```
Update `onSubmit` to normalize to E.164 and call `submitLead`:
```tsx
  async function onSubmit(data: PiiFormData) {
    if (data._honeypot) {
      return
    }
    const lead = buildLeadInput({ ctx, pii: data, answers })
    const e164 = parsePhoneNumber(data.phone, 'US')!.number
    const created = await submit.mutateAsync({
      phone: e164,
      name: lead.name,
      city: lead.city,
      state: lead.state,
      zip: lead.zip,
      leadSourceSlug: lead.leadSourceSlug,
      leadMetaJSON: lead.leadMetaJSON,
    })
    setValue({ leadId: created.customerId })
    advance()
  }
```

- [ ] **Step 3: Verify**

`pnpm tsc` → 0 errors. `pnpm lint` → 0 errors.
Browser (dev server): enter a fake phone (`1234567890`) → after blur, a field error appears and submit is blocked. Enter a real US mobile → no error → submit creates a lead. Confirm via dev DB (`db:push:dev` env, NOT prod) that the new customer's `leadMetaJSON.phoneVerification.status` is `'verified'`, the lead source is `branded-meta-ads`, and `source.kind === 'funnel'`.

- [ ] **Step 4: Commit**
```bash
git status --short
git commit -m "feat(funnels): wire PII phone gate (libphonenumber + Lookup + submitLead)" -- \
  src/shared/domains/funnels/hooks/use-debounced-async-validator.ts \
  src/shared/domains/funnels/ui/steps/pii-form-step.tsx
```

---

## Self-Review

**1. Spec coverage**
- §1.1 hero-not-a-step → Task 1. §1.2 nav lift + revisit → Task 2. §1.3 option assets → Task 4. §1.4 continuous progress → Task 3.
- §2.1 ZIP persistence → Task 6. §2.2 label split → Task 6 (type) + Task 6 (use). §2.3 anticipation → Task 6.
- §3.1 per-step RHF + debounced validate hook → Task 10 (hook) used by phone. §3.2 phone hard-gate (provider/lib/router/wire, fail-open) → Tasks 8–10. §3.3 email removed → Task 7. §3.4 ZIP region → Tasks 5–6. §3.5 name split + progressive disclosure → Task 7. §3.6 city from location → Task 7.
- §4 map (#7) → correctly deferred to 2c (not in this plan).
- §5 type deltas → spread across Tasks 1, 4, 6, 7, 8. §6 stop-lines → encoded in Global Constraints.

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". Every code step shows the code. Verification commands are explicit. Pure-logic tasks carry full assertion scriptlets.

**3. Type consistency:** `PhoneLookupResult` (Task 8) is consumed by `evaluatePhoneGate` (Task 8) and `phoneLookup`/`submitLead` (Task 9) and the client validator (Task 10). `PiiFormData` (Task 7) = `{firstName,lastName,phone,consent,_honeypot}` is consumed consistently by `buildLeadInput` and the PII step. `FunnelEngineApi.hasNext` (Task 2) is consumed by the shell (Task 2). `OptionAsset.name: string` (Task 4) is keyed into `OPTION_ICONS` (Task 4). `LocationContent` split labels (Task 6) match `ZIP_STEP.content` (Task 6). `StepProps.isAnswered` (Task 1) is provided by the shell (Task 1) and consumed by card-select (Task 2).

**Note on Twilio SDK field accessors (Task 8):** the Lookup v2 response property names (`lineTypeIntelligence?.type` / `carrier_name` / `error_code`) should be confirmed against the installed `twilio@^6` typings during implementation; the `fields: 'line_type_intelligence'` request string is stable. If the typed accessor differs, adapt the mapping — the `PhoneLookupResult` shape stays the same.
