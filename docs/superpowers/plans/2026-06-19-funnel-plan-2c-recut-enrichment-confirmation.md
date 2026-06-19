# Funnel Plan 2c (re-cut) — Enrichment + Confirmation + Location reveal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the kitchen funnel after PII — four capture-only enrichment card-selects, a terminal confirmation step with real before/after portfolio proof, a guarded `enrichFunnelLead` persistence call, and a personalized city/county reveal on the location step.

**Architecture:** Engine stays content-free. Enrichment is config-only `card-select`s (no new kind). One new kind — `confirmation` (input-less, `never` answer) — added in lockstep across `AnswerByKind` + `ContentByKind` + `FunnelStep` + `STEP_REGISTRY`. Persistence is a public `enrichFunnelLead` mutation on `funnelsRouter` (mirrors `submitLead`), routing tRPC → service → `customerCrud` (no new DAL function — generic CRUD covers the leadMeta patch). Fired fire-and-forget from the confirmation step on mount.

**Tech Stack:** Next.js 15.5.9, React 19, tRPC, `@tanstack/react-query` (`useQueries`), `motion` v12, shadcn/ui, Drizzle, Upstash Ratelimit, Zod.

**Spec:** `docs/superpowers/specs/2026-06-18-funnel-plan-2c-recut-design.md`.

## Precondition (HARD DEPENDENCY)

Plan 2b is landed: kitchen runs `layout → ownership → location → pii`; `pii-form-step.tsx` calls `funnelsRouter.submitLead` and writes `PiiAnswer = { leadId }` via `setValue`. Verify: `grep -n "setValue({ leadId" src/shared/domains/funnels/ui/steps/pii-form-step.tsx` (present, line ~77).

## Global Constraints

- **No unit-test runner exists in this repo** (only Playwright; zero `*.test.*` files). Per CLAUDE.md ("run lint/typecheck before marking complete"), each task's hard gate is `pnpm tsc` (0 errors) + `pnpm lint` (0 errors). End-to-end behavior is a documented browser-smoke pass at integration. **Do NOT add a test framework** — that would violate "follow existing patterns."
- **NEVER `pnpm build`.** **NEVER `pnpm db:push`** (prod) — schema pushes use `pnpm db:push:dev`.
- Named exports only; `import type` at top level; braces+newline `if` (`antfu/if-newline`); sorted imports (`pnpm lint:fix` auto-sorts `perfectionist/sort-imports` + `sort-named-imports`); `import/no-duplicates`; `@/` → `src/`.
- `shared/` never imports `features/`; `schemas/` is a sibling of `lib/`; one component per file; no barrels in `ui/`/`constants/`/`hooks/`/`lib/`.
- Backend is **tRPC → service → DAL** — no `db.*` in routers or services; reuse generic CRUD (`customerCrud.update`) rather than adding ad-hoc DAL functions; never set `updatedAt` manually (schema-helper `$onUpdate` handles it).
- Adding a kind is a **lockstep** change (`AnswerByKind` + `ContentByKind` + `FunnelStep` + `STEP_REGISTRY`) — never suppress the exhaustiveness error with a cast.
- Motion reuses `FUNNEL_TRANSITION`; every animation gated on `useReducedMotion()`; transform/opacity only.
- Commits: pathspec only (`git commit -m "…" -- <paths>`; `git add <path>` first for new files; never `git add -A`). Trailer on every commit:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- All capture-only — **no qualification gating** added in 2c.

---

### Task 1: Add `enrichment` to the leadMeta `funnel` source variant

**Files:**
- Modify: `src/shared/entities/customers/schemas/index.ts` (the `source` discriminated union, `kind: 'funnel'` object, ~line 114)

**Interfaces:**
- Produces: `LeadMeta['source']` `funnel` variant gains `enrichment?: { homeType, age, scope, timeline }` (each `string | null`).

- [ ] **Step 1:** In the `z.object({ kind: z.literal('funnel'), … })` variant, after the `utm` object, add:

```ts
      enrichment: z.object({
        homeType: z.string().nullable(),
        age: z.string().nullable(),
        scope: z.string().nullable(),
        timeline: z.string().nullable(),
      }).partial().optional(),
```

(`.partial()` so any subset can be patched; `.optional()` so existing funnel leads without enrichment still parse.)

- [ ] **Step 2:** Gate + commit

```bash
pnpm tsc   # Expected: 0 errors
pnpm lint  # Expected: 0 errors
git commit -m "feat(customers): leadMeta funnel enrichment fields (homeType/age/scope/timeline)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/entities/customers/schemas/index.ts
```

---

### Task 2: `enrichFunnelLead` — service method + guarded public mutation

Routes tRPC → service → `customerCrud` (getById + update). No new DAL function: generic CRUD `update` IS the leadMeta patch.

**Files:**
- Modify: `src/shared/services/customer-intake.service.ts` (add method to the object returned by `createCustomerIntakeService`)
- Modify: `src/trpc/routers/funnels.router.ts` (new limiter + procedure)

**Interfaces:**
- Produces: `customerIntakeService.enrichFunnelLead(ctx: ScopedContext, input: EnrichFunnelLeadInput): Promise<DalReturn<{ ok: true }>>`; tRPC `funnelsRouter.enrichFunnelLead` (public), input `{ leadId: string, enrichment?: { homeType?, age?, scope?, timeline? } }`.
- Consumes: `customerCrud.getById(ctx, { id })`, `customerCrud.update(ctx, { id, data })`, `dalError`, `dalSuccess` (all already imported or trivially importable in the service).

**Security model (REVIEW — the one new public write surface):** public `baseProcedure`; the `leadId` UUID is the capability (unguessable, surfaced to the client only at PII); IP rate-limited (`'funnel:enrich'`, 10/h); the service guards `leadMetaJSON.source.kind === 'funnel'` and only writes the `source.enrichment` allowlist — never mutates non-funnel customers or any field outside it.

- [ ] **Step 1: Service method.** In `customer-intake.service.ts`, add the input type above the factory and the method inside the returned object (after `ingestLead`). Add `EnrichFunnelLeadInput` and the method:

```ts
interface EnrichFunnelLeadInput {
  leadId: string
  enrichment?: { homeType?: string | null, age?: string | null, scope?: string | null, timeline?: string | null }
}
```

```ts
    // Guarded enrichment patch for an already-created funnel lead. The leadId is
    // the capability; we refuse anything that isn't a funnel-sourced customer and
    // only ever touch source.enrichment. Best-effort from the confirmation step.
    async enrichFunnelLead(
      ctx: ScopedContext,
      input: EnrichFunnelLeadInput,
    ): Promise<DalReturn<{ ok: true }>> {
      const existing = await customerCrud.getById(ctx, { id: input.leadId })
      if (!existing.success) {
        return existing
      }
      const customer = existing.data
      const leadMeta = customer?.leadMetaJSON
      if (!customer || leadMeta?.source?.kind !== 'funnel') {
        return dalError({ type: 'precondition-failed', reason: 'not_a_funnel_lead' })
      }
      const nextLeadMeta: LeadMeta = {
        ...leadMeta,
        source: {
          ...leadMeta.source,
          enrichment: { ...leadMeta.source.enrichment, ...input.enrichment },
        },
      }
      const updated = await customerCrud.update(ctx, { id: input.leadId, data: { leadMetaJSON: nextLeadMeta } })
      if (!updated.success) {
        return updated
      }
      return dalSuccess({ ok: true })
    },
```

> The `kind !== 'funnel'` guard narrows the discriminated union so `leadMeta.source.enrichment` is type-safe (the `funnel` variant gained it in Task 1).

- [ ] **Step 2: tsc** — `pnpm tsc` (0 errors). If `LeadMeta` isn't already imported in the service, it is (`import type { LeadMeta } from '@/shared/entities/customers/schemas'` — already present at line 3).

- [ ] **Step 3: Router limiter + procedure.** In `funnels.router.ts`, after the `phoneLookupRatelimit` block (~line 31), add:

```ts
const enrichRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'funnel:enrich',
})
```

Then add the procedure inside `createTRPCRouter({ … })`, after `submitLead`:

```ts
  // Guarded post-lead enrichment (funnel leads only). The leadId UUID is the
  // capability; IP rate-limited; the service refuses non-funnel customers and
  // only patches source.enrichment. Best-effort — the client never blocks on it.
  enrichFunnelLead: baseProcedure
    .input(z.object({
      leadId: z.string().uuid(),
      enrichment: z.object({
        homeType: z.string().nullable().optional(),
        age: z.string().nullable().optional(),
        scope: z.string().nullable().optional(),
        timeline: z.string().nullable().optional(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await enrichRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }
      const result = await customerIntakeService.enrichFunnelLead(SYSTEM_CONTEXT, input)
      if (!result.success) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Could not save your details.' })
      }
      return { ok: true as const }
    }),
```

(`z`, `TRPCError`, `Ratelimit`, `redis`, `clientIp`, `SYSTEM_CONTEXT`, `customerIntakeService` are all already imported in this file.)

- [ ] **Step 4: Gate + commit**

```bash
pnpm tsc && pnpm lint
git commit -m "feat(funnels): guarded public enrichFunnelLead mutation (funnel leads only)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/services/customer-intake.service.ts src/trpc/routers/funnels.router.ts
```

---

### Task 3: `useEnrichLead` fire-and-forget hook

**Files:**
- Create: `src/shared/domains/funnels/hooks/use-enrich-lead.ts`

**Interfaces:**
- Produces: `useEnrichLead(): (args: { leadId: string, enrichment?: { homeType?: string | null, age?: string | null, scope?: string | null, timeline?: string | null } }) => void` — fires the mutation, swallows errors.

- [ ] **Step 1: Implement**

```ts
import { useMutation } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

interface EnrichArgs {
  leadId: string
  enrichment?: { homeType?: string | null, age?: string | null, scope?: string | null, timeline?: string | null }
}

/**
 * Best-effort enrichment: never awaited, errors swallowed. Post-lead enrichment
 * must never block or break the confirmation experience (spec §6).
 */
export function useEnrichLead() {
  const trpc = useTRPC()
  const mutation = useMutation(trpc.funnelsRouter.enrichFunnelLead.mutationOptions())
  return (args: EnrichArgs) => {
    mutation.mutate(args, { onError: () => {} })
  }
}
```

- [ ] **Step 2: Gate + commit**

```bash
pnpm tsc && pnpm lint
git add src/shared/domains/funnels/hooks/use-enrich-lead.ts
git commit -m "feat(funnels): fire-and-forget enrichment hook

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/hooks/use-enrich-lead.ts
```

---

### Task 4: Add the `confirmation` kind to the type model (lockstep)

After this task `tsc` errors ONLY in `constants/step-registry.ts` (missing `confirmation` component key) — expected; closed in Task 5.

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`

**Interfaces:**
- Produces: `ConfirmationContent`, `ConfirmationStep`; `AnswerByKind['confirmation'] = never`; `ContentByKind['confirmation'] = ConfirmationContent`; `FunnelStep` includes `ConfirmationStep`.

- [ ] **Step 1: `AnswerByKind`** — add the `confirmation` line:

```ts
export interface AnswerByKind {
  'card-select': string
  'location': LocationAnswer
  'pii-form': PiiAnswer
  'confirmation': never
}
```

- [ ] **Step 2: Content shape + `ContentByKind`.** Add the interface near the other `*Content` types (after `PiiContent`):

```ts
export interface ConfirmationContent {
  title: string
  subtitle?: string
  /** Ordered "what happens next" lines. */
  whatNext?: string[]
  scarcityLine?: string
}
```

and add to `ContentByKind`:

```ts
export interface ContentByKind {
  'card-select': CardSelectContent
  'location': LocationContent
  'pii-form': PiiContent
  'confirmation': ConfirmationContent
}
```

- [ ] **Step 3: Step variant + union.** After `PiiStep`:

```ts
export interface ConfirmationStep extends BaseStep<'confirmation'> { content: ConfirmationContent }

export type FunnelStep = CardSelectStep | LocationStep | PiiStep | ConfirmationStep
```

- [ ] **Step 4: tsc** — `pnpm tsc 2>&1 | grep "domains/funnels"`. Expected: errors ONLY in `constants/step-registry.ts` (missing `confirmation` key). `types.ts` clean.

- [ ] **Step 5: lint + commit**

```bash
pnpm lint
git commit -m "feat(funnels): add confirmation kind to type model (lockstep)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/types.ts
```

---

### Task 5: Confirmation step — before/after proof + fire enrichment + `CONFIRMATION_STEP`

Terminal step. On mount fires enrichment once (fire-and-forget) from typed answers. Renders true before/after pairs from kitchen project detail; falls back to the bento `PortfolioBlock` when no pairs are available.

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/confirmation-step.tsx`
- Modify: `src/shared/domains/funnels/constants/step-registry.ts`

**Interfaces:**
- Consumes: `useEnrichLead` (Task 3); `StepProps<ConfirmationStep>` (Task 4); `PiiAnswer` (types); `TRADE_BY_SLUG`, `getOptimizedSrc`, `PortfolioBlock`; tRPC `projectsRouter.showroomDisplay.getAll`/`getDetail`, `notionRouter.scopes.getAll` (all existing — same surfaces the bento block uses).
- Produces: `ConfirmationStepView`, `CONFIRMATION_STEP`.

- [ ] **Step 1: Component + library object.**

```tsx
'use client'

import type { ConfirmationStep, FunnelContext, PiiAnswer, StepProps } from '@/shared/domains/funnels/types'
import type { PortfolioProject } from '@/shared/entities/projects/types'
import { useQueries, useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { useEffect, useMemo, useRef } from 'react'
import { PortfolioBlock } from '@/shared/domains/funnels/ui/blocks/portfolio-block'
import { TRADE_BY_SLUG } from '@/shared/domains/funnels/constants/trade-by-slug'
import { useEnrichLead } from '@/shared/domains/funnels/hooks/use-enrich-lead'
import { getOptimizedSrc } from '@/shared/lib/get-optimized-urls'
import { useTRPC } from '@/trpc/helpers'

const MAX_PAIRS = 3

function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

export function ConfirmationStepView({ content, answers, ctx }: StepProps<ConfirmationStep>) {
  const trpc = useTRPC()
  const enrich = useEnrichLead()
  const firedRef = useRef(false)

  // Fire enrichment exactly once on mount, from the typed answer slots.
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
  }, [answers, enrich])

  const scopesQ = useQuery(trpc.notionRouter.scopes.getAll.queryOptions())
  const projectsQ = useQuery(trpc.projectsRouter.showroomDisplay.getAll.queryOptions())
  const tradeId = TRADE_BY_SLUG[ctx.slug]

  // Top kitchen accessors (same trade-filter the bento block uses).
  const accessors = useMemo(() => {
    const scopes = scopesQ.data
    const projects = projectsQ.data
    if (!scopes || !projects) {
      return []
    }
    const scopeToTrade = new Map(scopes.map(s => [s.id, s.relatedTrade]))
    return projects
      .filter((p: PortfolioProject) => p.scopeIds.some(id => scopeToTrade.get(id) === tradeId))
      .map((p: PortfolioProject) => p.project.accessor)
      .slice(0, MAX_PAIRS)
  }, [scopesQ.data, projectsQ.data, tradeId])

  const detailQs = useQueries({
    queries: accessors.map(accessor => trpc.projectsRouter.showroomDisplay.getDetail.queryOptions({ accessor })),
  })

  // Pairs where BOTH before and after media exist.
  const pairs = useMemo(() => {
    return detailQs
      .map((q) => {
        const before = q.data?.media.before[0]
        const after = q.data?.media.after[0]
        if (!before || !after) {
          return null
        }
        return { title: q.data!.project.title, before: getOptimizedSrc(before), after: getOptimizedSrc(after) }
      })
      .filter((p): p is { title: string, before: string, after: string } => p !== null)
  }, [detailQs])

  return (
    <div className="flex flex-col items-center gap-8 py-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-2xl font-semibold">{content.title}</h2>
        {content.subtitle ? <p className="text-muted-foreground max-w-prose">{content.subtitle}</p> : null}
      </div>

      {content.whatNext && content.whatNext.length > 0
        ? (
            <ol className="border-border bg-card flex w-full max-w-md flex-col gap-3 rounded-2xl border p-5 text-left text-sm">
              {content.whatNext.map((line, i) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="bg-primary/10 text-primary flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">{i + 1}</span>
                  <span className="text-foreground">{line}</span>
                </li>
              ))}
            </ol>
          )
        : null}

      {pairs.length > 0
        ? (
            <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-3">
              {pairs.map(pair => (
                <figure key={pair.title} className="border-border overflow-hidden rounded-2xl border">
                  <div className="grid grid-cols-2">
                    <div className="relative aspect-square">
                      <Image src={pair.before} alt={`${pair.title} — before`} fill sizes="33vw" className="object-cover" />
                      <span className="bg-background/80 text-foreground absolute left-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium">Before</span>
                    </div>
                    <div className="relative aspect-square">
                      <Image src={pair.after} alt={`${pair.title} — after`} fill sizes="33vw" className="object-cover" />
                      <span className="bg-primary text-primary-foreground absolute right-1 top-1 rounded px-1.5 py-0.5 text-[10px] font-medium">After</span>
                    </div>
                  </div>
                </figure>
              ))}
            </div>
          )
        : <PortfolioBlock content={{ title: 'Recent Tri Pros work' }} ctx={ctx} />}

      {content.scarcityLine
        ? <p className="text-muted-foreground text-sm font-medium">{content.scarcityLine}</p>
        : null}
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

> `FunnelContext` is imported for the `ctx` prop typing carried by `StepProps`. `PortfolioProject` matches the `showroomDisplay.getAll` element shape used by the bento block (`{ project, heroImage, scopeIds }`). If `notionRouter.scopes.getAll` items expose the trade under a different field than `relatedTrade`, mirror exactly what `portfolio-block.tsx` reads (it is the canonical reference for this filter).

- [ ] **Step 2: Register** — in `constants/step-registry.ts` add the import and the key:

```ts
import { ConfirmationStepView } from '@/shared/domains/funnels/ui/steps/confirmation-step'
```
```ts
  'confirmation': ConfirmationStepView,
```

Registry is now exhaustive — the whole domain type-checks.

- [ ] **Step 3: Full tsc + lint** — `pnpm tsc` (0 errors project-wide) + `pnpm lint:fix && pnpm lint` (0 errors). Commit.

```bash
git add src/shared/domains/funnels/ui/steps/confirmation-step.tsx
git commit -m "feat(funnels): confirmation step (before/after proof + fire enrichment) + CONFIRMATION_STEP

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/steps/confirmation-step.tsx src/shared/domains/funnels/constants/step-registry.ts
```

---

### Task 6: Suppress the focused shell footer on a terminal step

Generic rule (NOT a `confirmation` special-case): in a linear funnel only the last step has no next, so hide the Back/Next footer when `!engine.hasNext` — the thank-you is final.

**Files:**
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx` (the footer `div`, ~lines 79-84)

- [ ] **Step 1:** Wrap the footer in `engine.hasNext ? (…) : null`:

```tsx
      {engine.hasNext
        ? (
            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" onClick={engine.back}>← Back</Button>
              {engine.value != null
                ? <Button onClick={engine.advance}>Next →</Button>
                : <span />}
            </div>
          )
        : null}
```

(The inner `Next →` no longer needs the `&& engine.hasNext` guard — the wrapper already ensures `hasNext`.)

- [ ] **Step 2:** Gate + commit

```bash
pnpm tsc && pnpm lint
git commit -m "feat(funnels): hide shell nav on terminal step (generic !hasNext rule)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/funnel-engine.tsx
```

---

### Task 7: Location "qualified" city/county badge reveal

Replace the placeholder in the `qualified` phase with an animated personalized badge read from the resolved `LocationAnswer`. No map, no new kind.

**Files:**
- Modify: `src/shared/domains/funnels/ui/steps/location-step.tsx` (the `qualified` branch, ~lines 47-55; imports)

- [ ] **Step 1:** Add imports at the top (keep sorted — `pnpm lint:fix` will order them):

```ts
import { motion, useReducedMotion } from 'motion/react'
import { MapPin } from 'lucide-react'
import { FUNNEL_TRANSITION } from '@/shared/domains/funnels/constants/funnel-motion'
```

- [ ] **Step 2:** In `LocationStepView`, add `const reduceMotion = useReducedMotion()` at the top of the component body, then replace the `qualified` branch with:

```tsx
  if (phase === 'qualified') {
    const place = [value?.city, value?.county ? `${value.county} County` : null].filter(Boolean).join(', ')
    return (
      <div className="flex flex-col items-center gap-6 py-8 text-center" aria-live="polite">
        <p className="text-primary text-xl font-semibold">
          {content.qualifiesLabel ?? '✓ Great news — your area qualifies.'}
        </p>
        {place
          ? (
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, scale: 0.9, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={FUNNEL_TRANSITION}
                className="border-primary/30 bg-primary/5 inline-flex items-center gap-2 rounded-full border px-4 py-2"
              >
                <MapPin className="text-primary size-4" aria-hidden="true" />
                <span className="text-foreground text-sm font-medium">{place}</span>
              </motion.div>
            )
          : null}
      </div>
    )
  }
```

(The step still wrote its `LocationAnswer` in `handleSubmit`, so `value != null` and the shell's Next advances — unchanged.)

- [ ] **Step 3:** Gate + commit

```bash
pnpm tsc && pnpm lint
git commit -m "feat(funnels): personalized city/county badge on location qualified phase

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/ui/steps/location-step.tsx
```

---

### Task 8: Append enrichment + confirmation to the kitchen flow + full smoke

**Files:**
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`

- [ ] **Step 1:** Import `CONFIRMATION_STEP` and append the post-PII steps to the `steps` array (after `PII_STEP`). Enrichment are kitchen-specific inline `card-select`s; confirmation is the shared library object.

```ts
import { CONFIRMATION_STEP } from '@/shared/domains/funnels/ui/steps/confirmation-step'
```

```ts
    PII_STEP,
    {
      id: 'homeType',
      kind: 'card-select',
      optionIds: ['single-family', 'condo', 'mobile-home', 'commercial'],
      content: {
        title: 'What kind of home is it?',
        options: {
          'single-family': { label: 'Single-family' },
          'condo': { label: 'Condo' },
          'mobile-home': { label: 'Mobile home' },
          'commercial': { label: 'Commercial' },
        },
      },
    },
    {
      id: 'age',
      kind: 'card-select',
      optionIds: ['0-5', '5-15', '15-plus', 'original'],
      content: {
        title: 'How old is your kitchen?',
        options: {
          '0-5': { label: '0–5 years' },
          '5-15': { label: '5–15 years' },
          '15-plus': { label: '15+ years' },
          'original': { label: 'Original / never renovated' },
        },
      },
    },
    {
      id: 'scope',
      kind: 'card-select',
      optionIds: ['full-gut', 'cabinets-counters', 'refresh', 'not-sure'],
      content: {
        title: 'What are you picturing?',
        options: {
          'full-gut': { label: 'Full gut remodel' },
          'cabinets-counters': { label: 'Cabinets + counters' },
          'refresh': { label: 'Cosmetic refresh' },
          'not-sure': { label: 'Not sure yet' },
        },
      },
    },
    {
      id: 'timeline',
      kind: 'card-select',
      optionIds: ['asap', '1-3', '3-6', 'exploring'],
      content: {
        title: 'When would you want to start?',
        options: {
          'asap': { label: 'ASAP' },
          '1-3': { label: '1–3 months' },
          '3-6': { label: '3–6 months' },
          'exploring': { label: 'Just exploring' },
        },
      },
    },
    CONFIRMATION_STEP,
```

- [ ] **Step 2: tsc + lint** — `pnpm tsc` (0 errors) + `pnpm lint` (0 errors).

- [ ] **Step 3: Full end-to-end browser smoke (controller-run, dev :3000)** at `http://kitchens.localhost:3000` (or `/funnels/kitchens?utm_source=meta&utm_campaign=kitchens-showcase`), localStorage cleared:
  1. Run hero → layout → ownership → location → pii → homeType → age → scope → timeline → confirmation. The four enrichment cards **auto-advance on tap**.
  2. Location qualified phase shows the animated **"{city}, {county} County"** badge (with `prefers-reduced-motion`: static).
  3. PII submit creates the lead (network 200); `answers.pii.leadId` set.
  4. Reaching confirmation fires `enrichFunnelLead` (network 200, fire-and-forget); the thank-you renders regardless of that call.
  5. Confirmation shows before/after pairs for kitchen projects that have both phases; with none, falls back to the bento gallery. No console errors.
  6. **Terminal confirmation shows NO Back/Next footer.**
  7. DEV DB: the customer's `leadMetaJSON.source.enrichment` = `{homeType, age, scope, timeline}`; `source.kind:'funnel'` unchanged; `interestedTradesRaw:['Kitchen Renovation']` (from 2b) intact.
  8. `localStorage['…:kitchens'].answers`: `homeType/age/scope/timeline` are strings; `pii` is `{leadId}`; **no flat enrichment keys** (proves no `setAnswers`).
  9. Negative: POST `enrichFunnelLead` with a random UUID, or a non-funnel customer id, is refused (`BAD_REQUEST` — the funnel guard holds).

  Record evidence in the report.

- [ ] **Step 4: Commit**

```bash
pnpm tsc && pnpm lint
git commit -m "feat(funnels): complete kitchen funnel (enrichment + confirmation)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>" -- src/shared/domains/funnels/constants/kitchens.ts
```

---

## Self-Review

- **Spec coverage:** §1 scope → Tasks 2–8; §2 enrichment (4 card-selects, order, capture-only) → Task 8; §3 location badge (no map) → Task 7; §4 confirmation (terminal kind, fire-once enrichment, before/after pairs + bento fallback, copy, terminal nav) → Tasks 4–6; §5 `enrichFunnelLead` on funnelsRouter + security + leadMeta field → Tasks 1–2; §6 fire-and-forget hook → Task 3; §10 acceptance → Task 8 Step 3. All covered.
- **Correction vs spec §8 file-map:** spec listed a possible new `mutations.ts` leadMeta-patch — recon showed `customerCrud.update` already covers it, so per "reuse existing API surface" no new DAL function is added. Documented in Task 2.
- **Placeholder scan:** concrete code in every code step. One named implementation-time check (Task 5 Step 1 note: confirm the notion-scope trade field matches `portfolio-block.tsx`) — points at the exact canonical reference, not a TBD.
- **Type consistency:** `enrichment {homeType,age,scope,timeline}` identical across leadMeta variant (Task 1), service input (Task 2), router input (Task 2), hook (Task 3), confirmation call site (Task 5). `confirmation` kind added to all four lockstep points (Task 4). `ConfirmationContent` fields (`title/subtitle/whatNext/scarcityLine`) match between Task 4 (definition), Task 5 (`CONFIRMATION_STEP` + render). `engine.hasNext` rule (Task 6) consistent with the engine API.
- **Conventions:** backend tRPC→service→DAL with generic CRUD reuse (no `db.*` in service/router); no manual `updatedAt`; one component per file; named exports; lockstep kind add; motion reduced-motion-gated. No `pnpm build`, no `pnpm db:push`.
- **Security flagged for review:** Task 2 — public `enrichFunnelLead`: UUID-capability + `funnel:enrich` rate-limit + funnel-only guard + `source.enrichment` allowlist.
```
