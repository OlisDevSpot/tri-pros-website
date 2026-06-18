# Showcase Funnel — Plan 2c: Enrichment + Appointment + Confirmation (+ region map)

> **RE-CUT (2026-06-18) against the hardened step model** (`docs/superpowers/specs/2026-06-18-funnelspec-step-model-design.md`). Supersedes the prior 2c. No `setAnswers` (the `datetime` step writes a composite `DatetimeAnswer` via the single `setValue`); no engine special-casing; the created lead id lives in the `pii` step's typed `PiiAnswer.leadId` (written by 2b), read here as `answers.pii.leadId`. New kinds (`datetime`, `confirmation`) land as forced-exhaustive lockstep extensions.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Complete the kitchen funnel end-to-end: post-lead **enrichment** (age / scope / timeline via `card-select`), a soft **appointment** picker (`datetime` → `scheduledFor`), a **confirmation** step with real portfolio before/afters, and the **stylized SVG region map** reveal on the location step. Enrichment + appointment persist to the already-created lead via a guarded public mutation.

**Architecture:** Enrichment reuses `card-select` (no new kind) — each answer is a string keyed by step id (`answers.age`, `answers.scope`, `answers.timeline`). Two new kinds: `datetime` (day + window, composite answer `{scheduledFor, window}`, card-based — no calendar dep) and `confirmation` (terminal, no input). Because the lead already exists (2b creates it at PII and stores `{ leadId }` in the `pii` slot), enrichment/appointment are saved **best-effort, fire-and-forget** when the user reaches confirmation, via a new **public `enrichFunnelLead` tRPC mutation** — guarded by the lead UUID as a capability, rate-limited, restricted to patching enrichment fields on `source.kind === 'funnel'` leads only. The shared steps ship as importable prebuilt objects (`DATETIME_STEP`, `CONFIRMATION_STEP`) — Seam A.

**Tech Stack:** Next.js 15.5.9, React 19, tRPC, `motion` v12, shadcn/ui, Drizzle.

**Specs:** product `2026-06-17-showcase-funnel-system-design.md` (§2 flow, soft preferred-time, confirmation); type model `2026-06-18-funnelspec-step-model-design.md`.

## Precondition (HARD DEPENDENCY)

- **The hardened model + Plan 2b are landed.** Kitchen runs hero→layout→ownership→location→pii and creates a `branded-meta-ads` lead; the `pii` step writes `PiiAnswer = { leadId }` into `answers.pii` via `setValue` on success.
- Verify: `grep -n "PiiAnswer\|LocationAnswer" src/shared/domains/funnels/types.ts` (present) and that `pii-form-step.tsx` does `setValue({ leadId: … })` on success.

> **Contracts to build on (the hardened model — source of truth):** `StepProps<S>` = `{ step, content: ContentOf<S>, value: AnswerOf<S> | null, setValue: (a: AnswerOf<S>) => void, answers: FunnelAnswers, ctx: FunnelContext, advance, back, isFirst }`. Answers are one typed slot per step id; composites are objects. Add a kind by extending `FunnelStep` + `AnswerByKind` + `ContentByKind` + `STEP_REGISTRY` (`constants/step-registry.ts`) in lockstep — `tsc` forces all four. The engine is NOT modified by this plan.

## Locked decisions

- **Enrichment:** age/condition, project scope, timeline (`card-select`). `ownership` is qualification (pre-PII, 2a), not here.
- **Appointment:** soft preferred-time (day + window) → `leadMeta.scheduledFor`; human confirms (no auto-meeting). Day = next 14 days as pills; window = morning/afternoon/evening cards. No calendar dependency.
- **Persistence of post-lead data:** one **fire-and-forget** `enrichFunnelLead` call when the user reaches confirmation; never blocks the thank-you.
- **Confirmation proof:** kitchen before/afters from the existing public portfolio query.
- **Region map:** stylized SVG, animated reveal, highlights the resolved region; no external map API.

## Global Constraints

(Same as 2a/2b.) No test runner — `pnpm tsc`+`pnpm lint`+runtime smoke; NEVER `pnpm build`. Named exports; `import type` top level; braces+newline `if`; sorted imports; `@/`→`src/`; **pathspec commits on `main`**; `shared` never imports `features`; `schemas/` sibling of `lib/`; backend follows **tRPC → service → DAL** (no `db.*` in routers/services); one component per file; no barrels; **engine trade-agnostic and unmodified**; motion respects reduced-motion. Adding a kind is a lockstep change (union + AnswerByKind + ContentByKind + STEP_REGISTRY) — don't suppress the exhaustiveness error with casts.

## File structure (this plan)

```
src/shared/entities/customers/schemas/index.ts        MODIFY — enrichment fields on the 'funnel' source variant
src/trpc/routers/customers.router/business.router.ts  MODIFY — add enrichFunnelLead public procedure
src/shared/services/customer-intake.service.ts        MODIFY — enrichFunnelLead service method
src/shared/entities/customers/dal/server/mutations.ts MODIFY — leadMeta patch mutation (if none fits)
src/shared/domains/funnels/
├── types.ts                         MODIFY — add datetime + confirmation kinds (lockstep)
├── constants/
│   ├── step-registry.ts             MODIFY — register datetime + confirmation
│   ├── socal-regions.ts             CREATE — county → SVG region id mapping
│   └── kitchens.ts                  MODIFY — full flow + inline enrichment content
├── hooks/use-enrich-lead.ts         CREATE — fire-and-forget enrichment mutation hook
└── ui/
    ├── region-map.tsx               CREATE — stylized SVG region reveal
    └── steps/
        ├── datetime-step.tsx        CREATE — DatetimeStepView + DatetimeContent + DATETIME_STEP
        └── confirmation-step.tsx    CREATE — ConfirmationStepView + ConfirmationContent + CONFIRMATION_STEP
```

---

### Task 1: Add enrichment fields to the leadMeta `funnel` variant

(The prior 2c's "make PII store customerId" step is obsolete — 2b already stores `PiiAnswer.leadId` via `setValue`.)

**Files:**
- Modify: `src/shared/entities/customers/schemas/index.ts`

- [ ] **Step 1:** Extend the `kind: 'funnel'` source variant (added in 2b) with optional enrichment fields:

```ts
// within the funnel variant object in leadMetaSchema.source
enrichment: z.object({
  age: z.string().nullable(),
  scope: z.string().nullable(),
  timeline: z.string().nullable(),
}).optional(),
```

(`scheduledFor` already exists at the top level of `leadMetaSchema` — reuse it; do not add a new field.)

- [ ] **Step 2:** tsc + lint + commit

```bash
git status --short
git commit -m "feat(customers): leadMeta funnel enrichment fields (age/scope/timeline)" -- src/shared/entities/customers/schemas/index.ts
```

---

### Task 2: `enrichFunnelLead` — guarded public mutation (tRPC → service → DAL)

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`
- Modify: `src/shared/services/customer-intake.service.ts`
- Modify (or create): a DAL mutation that patches `leadMetaJSON` for a customer id.

**Interfaces:**
- Produces: `customersRouter.business.enrichFunnelLead` (public), input `{ leadId, scheduledFor?, enrichment? }`; service `customerIntakeService.enrichFunnelLead(ctx, input)`.

**Security model (REVIEW THIS — the one new public write surface):** public `baseProcedure`; the **`leadId` UUID is the capability** (unguessable, returned to the client only at PII); IP rate-limited (mirror `createFromIntake`'s limiter, prefix `'intake:enrich'`, e.g. 10/h); the service **only patches** `scheduledFor` + `source.enrichment` and **only when** the target customer's `leadMetaJSON.source.kind === 'funnel'` — so it can never mutate non-funnel customers or any field outside the enrichment allowlist. No PII, no status, no ownership changes.

- [ ] **Step 1: Zod input + procedure**

```ts
// business.router.ts
enrichFunnelLead: entity.publicProcedure
  .input(z.object({
    leadId: z.string().uuid(),
    scheduledFor: z.string().optional(),
    enrichment: z.object({
      age: z.string().nullable().optional(),
      scope: z.string().nullable().optional(),
      timeline: z.string().nullable().optional(),
    }).optional(),
  }))
  .mutation(async ({ input }) => {
    // rate-limit by IP (mirror createFromIntake's limiter; prefix 'intake:enrich')
    return customerIntakeService.enrichFunnelLead(SYSTEM_CONTEXT, input)
  }),
```

> Mirror the existing rate-limit block at the top of `createFromIntake` (Upstash sliding window, `x-forwarded-for`), with a distinct prefix `'intake:enrich'` and a sane window.

- [ ] **Step 2: Service method** — load customer, guard on `source.kind === 'funnel'`, merge patch, call the DAL update:

```ts
// customer-intake.service.ts (sketch — follow this file's DalReturn conventions)
async enrichFunnelLead(ctx: ScopedContext, input: EnrichFunnelLeadInput): Promise<DalReturn<{ ok: true }>> {
  const existing = await customerCrud.getById(ctx, input.leadId)
  if (!existing.ok) {
    return existing
  }
  const leadMeta = existing.data.leadMetaJSON
  if (leadMeta?.source?.kind !== 'funnel') {
    return dalPreconditionFailed('not a funnel lead')   // refuse non-funnel customers
  }
  const nextLeadMeta = {
    ...leadMeta,
    scheduledFor: input.scheduledFor ?? leadMeta.scheduledFor,
    source: { ...leadMeta.source, enrichment: { ...leadMeta.source.enrichment, ...input.enrichment } },
  }
  return customerLeadMetaUpdate(ctx, input.leadId, nextLeadMeta)
}
```

> Use the exact helpers this file already uses (`customerCrud`, `dalSuccess`, the precondition-failed helper). The leadMeta patch MUST go through a DAL mutation — if no `db.update` for leadMeta exists, add `customerLeadMetaUpdate` in `src/shared/entities/customers/dal/server/mutations.ts` (services never call `db.*` directly). Do NOT set `updatedAt` manually.

- [ ] **Step 3:** tsc + lint + commit

```bash
git commit -m "feat(funnels): guarded public enrichFunnelLead mutation (funnel leads only)" -- src/trpc/routers/customers.router/business.router.ts src/shared/services/customer-intake.service.ts src/shared/entities/customers/dal/server/mutations.ts
```

---

### Task 3: Enrichment hook (fire-and-forget)

**Files:**
- Create: `src/shared/domains/funnels/hooks/use-enrich-lead.ts`

**Interfaces:**
- Produces: `useEnrichLead(): (args: { leadId: string, scheduledFor?: string, enrichment?: {...} }) => void` — fires the mutation, swallows errors.

- [ ] **Step 1: Implement**

```ts
// src/shared/domains/funnels/hooks/use-enrich-lead.ts
import { useMutation } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useEnrichLead() {
  const trpc = useTRPC()
  const mutation = useMutation(trpc.customersRouter.business.enrichFunnelLead.mutationOptions())
  return (args: { leadId: string, scheduledFor?: string, enrichment?: { age?: string | null, scope?: string | null, timeline?: string | null } }) => {
    // Best-effort: do not await, do not surface errors — enrichment must never
    // block or break the confirmation experience.
    mutation.mutate(args, { onError: () => {} })
  }
}
```

- [ ] **Step 2:** tsc + lint + commit

```bash
git commit -m "feat(funnels): fire-and-forget enrichment hook" -- src/shared/domains/funnels/hooks/use-enrich-lead.ts
```

---

### Task 4: Add `datetime` + `confirmation` kinds to the type model (lockstep)

Add both kinds' answer + content + step variants in one cohesive change. After it, `tsc` errors ONLY in `constants/step-registry.ts` (missing component keys) — expected; closed in Tasks 5–6.

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`

- [ ] **Step 1: Answer shapes + AnswerByKind:**

```ts
export interface DatetimeAnswer { scheduledFor: string, window: string }

export interface AnswerByKind {
  'info': never
  'card-select': string
  'location': LocationAnswer
  'pii-form': PiiAnswer
  'datetime': DatetimeAnswer
  'confirmation': never
}
```

- [ ] **Step 2: Content shapes + ContentByKind:**

```ts
export interface DatetimeContent { title: string, subtitle?: string, cta?: string, windows?: Record<string, string> }
export interface ConfirmationContent { title: string, subtitle?: string }

export interface ContentByKind {
  'info': HeroContent
  'card-select': CardSelectContent
  'location': LocationContent
  'pii-form': PiiContent
  'datetime': DatetimeContent
  'confirmation': ConfirmationContent
}
```

- [ ] **Step 3: Step variants:**

```ts
export interface DatetimeStep extends BaseStep<'datetime'> { content: DatetimeContent }
export interface ConfirmationStep extends BaseStep<'confirmation'> { content: ConfirmationContent }

export type FunnelStep = InfoStep | CardSelectStep | LocationStep | PiiStep | DatetimeStep | ConfirmationStep
```

- [ ] **Step 4: tsc** — `pnpm tsc 2>&1 | grep "domains/funnels"`. Expected: errors ONLY in `constants/step-registry.ts` (missing `datetime`/`confirmation` keys). `types.ts` clean.

- [ ] **Step 5: lint + commit**

```bash
git commit -m "feat(funnels): add datetime + confirmation kinds to type model (lockstep)" -- src/shared/domains/funnels/types.ts
```

---

### Task 5: `datetime` step + register + `DATETIME_STEP` library object

Writes a **composite** `DatetimeAnswer` via the single `setValue`. Day pills + window cards; no calendar dep.

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/datetime-step.tsx`
- Modify: `src/shared/domains/funnels/constants/step-registry.ts`

- [ ] **Step 1: Component + library object**

```tsx
// src/shared/domains/funnels/ui/steps/datetime-step.tsx
import type { DatetimeStep, StepProps } from '@/shared/domains/funnels/types'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'

// 14 upcoming dates. Date/new Date() are fine in client app code (the no-Date
// rule applies only to workflow scripts).
function upcomingDays(count: number): { iso: string, label: string }[] {
  const out: { iso: string, label: string }[] = []
  const base = new Date()
  for (let i = 1; i <= count; i++) {
    const d = new Date(base)
    d.setDate(base.getDate() + i)
    out.push({ iso: d.toISOString().slice(0, 10), label: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) })
  }
  return out
}

export function DatetimeStepView({ content, setValue, advance, back, isFirst }: StepProps<DatetimeStep>) {
  const [day, setDay] = useState<string | null>(null)
  const [windowKey, setWindowKey] = useState<string | null>(null)
  const days = upcomingDays(14)
  const windows = content.windows ?? { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }
  const ready = day && windowKey

  function confirm() {
    if (!day || !windowKey) {
      return
    }
    // Soft preferred time: composite answer in one slot. No setAnswers.
    setValue({ scheduledFor: `${day}T00:00:00.000Z`, window: windowKey })
    advance()
  }

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-center text-2xl font-semibold">{content.title}</h2>
      <div className="flex flex-wrap justify-center gap-2">
        {days.map(d => (
          <button key={d.iso} type="button" onClick={() => setDay(d.iso)}
            className={cn('rounded-full border px-3 py-1.5 text-sm', day === d.iso ? 'border-primary bg-primary/10' : 'border-border')}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(windows).map(([key, label]) => (
          <button key={key} type="button" onClick={() => setWindowKey(key)}
            className={cn('rounded-xl border-2 p-3 text-sm', windowKey === key ? 'border-primary bg-primary/5' : 'border-border')}>
            {label}
          </button>
        ))}
      </div>
      <Button size="lg" disabled={!ready} onClick={confirm}>{content.cta ?? 'Confirm preferred time'}</Button>
      {!isFirst ? <Button variant="ghost" onClick={back}>← Back</Button> : null}
    </div>
  )
}

/** Importable prebuilt step (Seam A). */
export const DATETIME_STEP: DatetimeStep = {
  id: 'datetime',
  kind: 'datetime',
  content: {
    title: 'When works for a quick call?',
    cta: 'Confirm preferred time',
    windows: { morning: 'Morning (8–12)', afternoon: 'Afternoon (12–4)', evening: 'Evening (4–7)' },
  },
}
```

- [ ] **Step 2: Register** `'datetime': DatetimeStepView` in `constants/step-registry.ts`.

- [ ] **Step 3: tsc** — `pnpm tsc 2>&1 | grep "domains/funnels"` → errors only for the still-missing `'confirmation'` key.

- [ ] **Step 4: lint:fix + commit**

```bash
git commit -m "feat(funnels): datetime step (composite answer) + DATETIME_STEP" -- src/shared/domains/funnels/ui/steps/datetime-step.tsx src/shared/domains/funnels/constants/step-registry.ts
```

---

### Task 6: `confirmation` step + register + `CONFIRMATION_STEP`

Terminal step (no input). On mount, fires enrichment once (fire-and-forget), reading the typed answers (`answers.pii.leadId`, `answers.datetime.scheduledFor`, `answers.age/scope/timeline`). Renders portfolio before/afters.

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/confirmation-step.tsx`
- Modify: `src/shared/domains/funnels/constants/step-registry.ts`

- [ ] **Step 0: Confirm the public portfolio query** — recon noted `projectsRouter.showroomDisplay` is the public portfolio surface. Find the exact public query returning kitchen before/after media (filter by trade, or fetch the showroom list + filter client-side). Name the exact procedure + return shape in the report.

- [ ] **Step 1: Component + library object** — reads typed composite answers via small guards:

```tsx
// src/shared/domains/funnels/ui/steps/confirmation-step.tsx
import type { ConfirmationStep, DatetimeAnswer, PiiAnswer, StepProps } from '@/shared/domains/funnels/types'
import { useEffect, useRef } from 'react'
import { useEnrichLead } from '@/shared/domains/funnels/hooks/use-enrich-lead'

function asObject<T>(v: unknown): Partial<T> {
  return v && typeof v === 'object' && !Array.isArray(v) ? v as T : {}
}
function asString(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

export function ConfirmationStepView({ content, answers }: StepProps<ConfirmationStep>) {
  const enrich = useEnrichLead()
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) {
      return
    }
    firedRef.current = true
    const leadId = asObject<PiiAnswer>(answers.pii).leadId
    if (!leadId) {
      return
    }
    const dt = asObject<DatetimeAnswer>(answers.datetime)
    enrich({
      leadId,
      scheduledFor: dt.scheduledFor,
      enrichment: {
        age: asString(answers.age),
        scope: asString(answers.scope),
        timeline: asString(answers.timeline),
      },
    })
  }, [answers, enrich])

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <h2 className="text-2xl font-semibold">{content.title}</h2>
      {content.subtitle ? <p className="text-muted-foreground max-w-prose">{content.subtitle}</p> : null}
      {/* before/after proof grid from the portfolio query confirmed in Step 0 */}
    </div>
  )
}

/** Importable prebuilt step (Seam A). Terminal — no advance. */
export const CONFIRMATION_STEP: ConfirmationStep = {
  id: 'confirmation',
  kind: 'confirmation',
  content: {
    title: 'You\'re on the list.',
    subtitle: 'We review fit and call within 24 hours. Here\'s recent Tri Pros kitchen work.',
  },
}
```

> Add the before/after gallery (a few lazy images) from the portfolio query confirmed in Step 0; wire it inside this component (a `useQuery` for the showroom list, kitchen-filtered). Keep field access aligned to the query's real return shape.

- [ ] **Step 2: Register** `'confirmation': ConfirmationStepView` — registry now exhaustive; whole domain type-checks.

- [ ] **Step 3: Full tsc + lint** → clean project-wide. Commit.

```bash
git commit -m "feat(funnels): confirmation step (portfolio proof + fire enrichment) + CONFIRMATION_STEP" -- src/shared/domains/funnels/ui/steps/confirmation-step.tsx src/shared/domains/funnels/constants/step-registry.ts
```

---

### Task 7: Stylized SVG region map on the location step

**Files:**
- Create: `src/shared/domains/funnels/constants/socal-regions.ts`
- Create: `src/shared/domains/funnels/ui/region-map.tsx`
- Modify: `src/shared/domains/funnels/ui/steps/location-step.tsx`

- [ ] **Step 1: Region mapping** — county → SVG region id:

```ts
// src/shared/domains/funnels/constants/socal-regions.ts
export const COUNTY_TO_REGION: Record<string, string> = {
  'Los Angeles': 'la',
  'Orange': 'oc',
  'San Bernardino': 'ie',
  'Riverside': 'ie',
  'Ventura': 'ventura',
  'San Diego': 'sd',
}
export const DEFAULT_REGION = 'socal'
```

- [ ] **Step 2: `region-map.tsx`** — a branded inline SVG of the SoCal service area; the active region path animates in (`motion.path`/`motion.g` with `FUNNEL_TRANSITION`), others dimmed; respect reduced motion. Props: `{ region: string }`. Author stylized low-detail regional shapes (not a precise geographic map).

- [ ] **Step 3:** In `location-step.tsx` `qualified` phase, derive the region from the resolved county (the `location` step already resolves `county` into its composite answer — keep a local `resolved` ref or re-read; the county is available from the `resolveZip` result captured in `handleSubmit`). Map via `COUNTY_TO_REGION` (fallback `DEFAULT_REGION`) and render `<RegionMap region={...} />` above the "qualifies" copy. Keep the `Continue` button (`advance`).

- [ ] **Step 4:** tsc + lint + runtime (map renders + animates on a known CA ZIP; reduced-motion static). Commit.

```bash
git commit -m "feat(funnels): stylized SVG region map reveal on location step" -- src/shared/domains/funnels/constants/socal-regions.ts src/shared/domains/funnels/ui/region-map.tsx src/shared/domains/funnels/ui/steps/location-step.tsx
```

---

### Task 8: Complete the kitchen flow + full end-to-end smoke

**Files:**
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`

- [ ] **Step 1:** Append the post-PII steps to `steps` (linear — no `flow`). Enrichment steps are kitchen-specific `card-select`s (inline content); `datetime`/`confirmation` are the shared library objects (spread-overridable). Full flow:
`hero → layout → ownership → location → pii → age → scope → timeline → datetime → confirmation`

```ts
import { DATETIME_STEP } from '@/shared/domains/funnels/ui/steps/datetime-step'
import { CONFIRMATION_STEP } from '@/shared/domains/funnels/ui/steps/confirmation-step'
// … appended to steps[] after the pii step:
{ id: 'age', kind: 'card-select', optionIds: ['0-5', '5-15', '15-plus', 'original'], content: {
  title: 'How old is your kitchen?',
  options: { '0-5': { label: '0–5 years' }, '5-15': { label: '5–15 years' }, '15-plus': { label: '15+ years' }, 'original': { label: 'Original / never renovated' } } } },
{ id: 'scope', kind: 'card-select', optionIds: ['full-gut', 'cabinets-counters', 'refresh', 'not-sure'], content: {
  title: 'What are you picturing?',
  options: { 'full-gut': { label: 'Full gut remodel' }, 'cabinets-counters': { label: 'Cabinets + counters' }, 'refresh': { label: 'Cosmetic refresh' }, 'not-sure': { label: 'Not sure yet' } } } },
{ id: 'timeline', kind: 'card-select', optionIds: ['asap', '1-3', '3-6', 'exploring'], content: {
  title: 'When would you want to start?',
  options: { 'asap': { label: 'ASAP' }, '1-3': { label: '1–3 months' }, '3-6': { label: '3–6 months' }, 'exploring': { label: 'Just exploring' } } } },
DATETIME_STEP,
CONFIRMATION_STEP,
```

(Answers land keyed by step id: `answers.age`, `answers.scope`, `answers.timeline`, `answers.datetime` = `{scheduledFor, window}`, `answers.pii` = `{leadId}`.)

- [ ] **Step 2: tsc + lint** → clean project-wide.

- [ ] **Step 3: Full end-to-end runtime smoke (dev, browser)** at `http://localhost:3000/funnels/kitchens?utm_source=meta&utm_campaign=kitchens-showcase` (or the `kitchens.localhost:3000` host):
  1. Complete all steps hero → … → confirmation.
  2. ZIP step: a known CA ZIP shows the animated region map + "qualifies"; city pre-fills on PII.
  3. PII submit creates the lead (network 200); `answers.pii.leadId` set.
  4. Reaching confirmation fires `enrichFunnelLead` (network 200, fire-and-forget).
  5. DEV DB: the customer's `leadMetaJSON` has `source.kind:'funnel'`, `offer:'showcase'`, `funnelSlug:'kitchens'`, `utm.source:'meta'`, `utm.campaign:'kitchens-showcase'`, `source.enrichment.{age,scope,timeline}` set, `scheduledFor` set, `interestedTradesRaw:['Kitchen Renovation']`.
  6. `localStorage['tri-pros:funnel:kitchens'].answers`: `datetime` is a composite `{scheduledFor, window}` object; `age`/`scope`/`timeline` are strings; `pii` is `{leadId}`. **No flat enrichment keys** (proves no `setAnswers`).
  7. Before/after gallery renders kitchen projects.
  8. Negative: POSTing `enrichFunnelLead` with a random UUID, or a non-funnel customer id, is refused (precondition-failed) — confirms the guard.

  Record evidence in the report.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): complete kitchen funnel (enrichment + appointment + confirmation)" -- src/shared/domains/funnels/constants/kitchens.ts
```

---

## Out of scope (later plans)

- Meta Pixel + CAPI dual-fire (`PageView`/`ViewContent`/`Lead`/`Schedule`) — **Plan 3**.
- Bathroom + complete-interior specs (config-only, reusing this engine + step library) — **Plan 4**.
- Trade icon set, per-trade accent tuning, copy polish, fuller region-map artwork — **Plan 5**.

## Self-Review

- **Anti-patterns removed:** no `setAnswers` (datetime writes a composite `DatetimeAnswer` via `setValue`; enrichment uses plain `card-select` string answers keyed by step id); no engine special-case (confirmation reads `answers` + the engine is untouched); lead id read from the typed `PiiAnswer.leadId`, not an ad-hoc `customerId` answer key. ✅
- **Lockstep enforced:** Task 4 adds both kinds to union + AnswerByKind + ContentByKind; registry stays red until Tasks 5–6 register components — `tsc` is the safety net. ✅
- **Seam A honored:** `DATETIME_STEP`/`CONFIRMATION_STEP` are importable prebuilt objects; age/scope/timeline are trade-specific inline card-selects (correctly NOT library steps). ✅
- **Spec coverage:** enrichment age/scope/timeline (Tasks 4,8) [§2]; soft preferred-time → `scheduledFor`, human confirms (Task 5 + 2b `customer_only`) [§2]; confirmation + portfolio proof + scarcity (Task 6,8); region map reveal (Task 7); guarded post-lead persistence (Task 2); enrichment never blocks confirmation (Task 3 fire-and-forget). Deferred-with-note: pixel/CAPI (3), other trades (4), polish (5).
- **Security flagged for review:** Task 2's public `enrichFunnelLead` — UUID-capability + rate-limit + funnel-only + field-allowlist. The one new public write surface; review before merge.
- **Backend conventions:** leadMeta patch via DAL mutation (Task 2), not `db.*` in the service; no manual `updatedAt`.
- **Placeholder scan:** concrete code throughout; two scoped implementation-time investigations (the public portfolio query shape in Task 6 Step 0; the region SVG artwork in Task 7 Step 2) — each names exactly what to resolve.
- **Type consistency:** `DatetimeAnswer`/`PiiAnswer` (Task 4) ↔ `setValue` composites (Task 5) ↔ confirmation reads `answers.pii.leadId`/`answers.datetime.scheduledFor` (Task 6) ↔ `enrichFunnelLead` input `{leadId, scheduledFor?, enrichment?}` (Task 2) ↔ hook (Task 3); `enrichment` shape identical across leadMeta variant (Task 1), mutation, hook, and call site.
