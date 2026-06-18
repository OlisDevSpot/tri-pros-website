# Showcase Funnel — Plan 2c: Enrichment + Appointment + Confirmation (+ region map)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the kitchen funnel end-to-end: post-lead **enrichment** (age / scope / timeline), a soft **appointment** picker (→ `scheduledFor`), a **confirmation** step with real portfolio before/afters, and the **stylized SVG region map** reveal on the location step. Enrichment + appointment persist to the already-created lead via a guarded public mutation.

**Architecture:** Enrichment reuses the `card-select` step (no new kind). New step kinds: `datetime` (day + time-window, card-based — no calendar dependency) and `confirmation`. Because the lead already exists (Plan 2b creates it at PII), enrichment/appointment are saved **best-effort, batched, fire-and-forget** at the end via a new **public `enrichFunnelLead` tRPC mutation** — guarded by the customer UUID (returned at PII) as a capability, rate-limited, and restricted to patching `leadMetaJSON` enrichment fields on `source.kind === 'funnel'` leads only. The confirmation step queries the public portfolio for kitchen before/afters.

**Tech Stack:** Next.js 15.5.9, React 19, tRPC, `motion` v12, shadcn/ui, Drizzle.

**Specs:** product `2026-06-17-showcase-funnel-system-design.md` (§2 flow, §2 soft preferred-time, confirmation); architecture doc.

## Precondition (HARD DEPENDENCY)

- **Plans 2a + 2b implemented.** Kitchen runs hero→layout→ownership→location→pii and creates a `branded-meta-ads` lead; PII stores the returned `customerId` into answers.

Verify: `ls src/shared/domains/funnels/ui/steps/{location-step.tsx,pii-form-step.tsx}` and that `pii-form-step.tsx` writes `customerId` into answers on success. If PII does not yet persist `customerId` into `answers`, add that first (Task 1).

> **RECONCILE FIRST (read the landed 2a/2b contracts).** Treat the landed `StepProps` (`{ step, funnelContent, content?, answers, setAnswers, value, onChange, onAdvance, onBack, isFirst }`) and the landed `leadMetaSchema` `funnel` source variant as source of truth; this plan's snippets show only the deltas they add. Per-step `content` is optional → use `content?.x`. `FunnelContent`/`FunnelAnswers` are owned by 2a — extend the step union + content via the established pattern, don't redefine the base types.

## Locked decisions

- **Enrichment:** age/condition, project scope, timeline (card-selects). `ownership` (own/rent) is NOT here — it's qualification, already collected pre-PII in 2a.
- **Appointment:** soft preferred-time (day + window), stored as `leadMeta.scheduledFor`; a human confirms (no auto-meeting). Day picker = next 14 days as selectable pills; window = morning/afternoon/evening cards. (No calendar component dependency.)
- **Persistence of post-lead data:** one **fire-and-forget** `enrichFunnelLead` call when the user reaches confirmation; never blocks the thank-you (matches "lead never blocked by downstream").
- **Confirmation proof:** kitchen before/afters from the existing public portfolio query.
- **Region map:** stylized SVG (per the earlier decision), animated reveal, highlights the resolved region; no external map API.

## Global Constraints

(Same as 2a/2b.) Named exports; `pnpm tsc`+`pnpm lint`+runtime smoke; `import type`; braces+newline; `@/`→`src/`; **pathspec commits on `main`**; `shared` never imports `features`; schemas in `schemas/` sibling of `lib/`; backend follows **tRPC → service → DAL** (no `db.*` in routers/services — DAL owns mutations); one component per file; no barrels; engine trade-agnostic; motion respects reduced-motion.

## File structure (this plan)

```
src/shared/entities/customers/schemas/index.ts        MODIFY — enrichment fields on the 'funnel' source variant
src/trpc/routers/customers.router/business.router.ts  MODIFY — add enrichFunnelLead public procedure
src/shared/services/customer-intake.service.ts        MODIFY — enrichFunnelLead service method (or sibling)
src/shared/entities/customers/dal/server/…            MODIFY — leadMeta patch mutation (if none fits)
src/shared/domains/funnels/
├── types.ts                         MODIFY — add DatetimeStep + ConfirmationStep; content fields
├── lib/step-registry.ts             MODIFY — register datetime + confirmation
├── hooks/use-enrich-lead.ts         CREATE — fire-and-forget enrichment mutation hook
├── constants/socal-regions.ts       CREATE — county/region → SVG region id mapping
├── constants/kitchens.ts            MODIFY — full flow + enrichment/datetime/confirmation content
└── ui/
    ├── region-map.tsx               CREATE — stylized SVG region reveal
    └── steps/
        ├── datetime-step.tsx        CREATE — day + window picker
        └── confirmation-step.tsx    CREATE — portfolio before/afters + next steps
```

---

### Task 1: Ensure PII writes `customerId`; add enrichment fields to leadMeta

**Files:**
- Modify: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx` (if not already)
- Modify: `src/shared/entities/customers/schemas/index.ts`

- [ ] **Step 1:** In `pii-form-step.tsx`, after a successful `submit.mutateAsync(...)`, persist the returned id: `setAnswers({ customerId: result.customerId })` before `onAdvance()`. (The mutation returns `{ customerId, meetingId }`.)

- [ ] **Step 2:** Extend the `kind: 'funnel'` source variant (added in 2b) with optional enrichment fields:

```ts
// within the funnel variant object in leadMetaSchema.source
enrichment: z.object({
  age: z.string().nullable(),
  scope: z.string().nullable(),
  timeline: z.string().nullable(),
}).optional(),
```

(`scheduledFor` already exists at the top level of `leadMetaSchema` — reuse it; don't add a new field.)

- [ ] **Step 3:** tsc + lint + commit

```bash
git commit -m "feat(funnels): PII stores customerId; leadMeta funnel enrichment fields" -- src/shared/domains/funnels/ui/steps/pii-form-step.tsx src/shared/entities/customers/schemas/index.ts
```

---

### Task 2: `enrichFunnelLead` — guarded public mutation (tRPC → service → DAL)

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts`
- Modify: `src/shared/services/customer-intake.service.ts`
- Modify (or create): a DAL mutation that patches `leadMetaJSON` for a customer id.

**Interfaces:**
- Produces: `customersRouter.business.enrichFunnelLead` (public), input `{ customerId, scheduledFor?, enrichment? }`; service `customerIntakeService.enrichFunnelLead(ctx, input)`.

**Security model (review me):** public `baseProcedure`; the **`customerId` UUID is the capability** (unguessable); IP rate-limited (reuse the `intake:submit` limiter or a new `intake:enrich` window); the service **only patches** `scheduledFor` + `source.funnel.enrichment` and **only when** the target customer's `leadMetaJSON.source.kind === 'funnel'` (so this endpoint can never mutate non-funnel customers or any field outside the enrichment allowlist). No PII, no status, no ownership changes.

- [ ] **Step 1: Zod input + procedure**

```ts
// business.router.ts
enrichFunnelLead: entity.publicProcedure
  .input(z.object({
    customerId: z.string().uuid(),
    scheduledFor: z.string().optional(),
    enrichment: z.object({
      age: z.string().nullable().optional(),
      scope: z.string().nullable().optional(),
      timeline: z.string().nullable().optional(),
    }).optional(),
  }))
  .mutation(async ({ input }) => {
    // rate-limit by IP (mirror createFromIntake's limiter; prefix 'intake:enrich')
    // then delegate to the service:
    return customerIntakeService.enrichFunnelLead(SYSTEM_CONTEXT, input)
  }),
```

> Mirror the existing rate-limit block at the top of `createFromIntake` (Upstash sliding window, `x-forwarded-for`). Use a distinct prefix `'intake:enrich'` and a sane window (e.g. `10 per 1 h`).

- [ ] **Step 2: Service method** — load customer, guard on `source.kind === 'funnel'`, merge patch, call the DAL update.

```ts
// customer-intake.service.ts (sketch — follow DalReturn conventions in this file)
async enrichFunnelLead(ctx: ScopedContext, input: EnrichFunnelLeadInput): Promise<DalReturn<{ ok: true }>> {
  const existing = await customerCrud.getById(ctx, input.customerId)  // or the appropriate read
  if (!existing.ok) {
    return existing
  }
  const leadMeta = existing.data.leadMetaJSON
  if (leadMeta?.source?.kind !== 'funnel') {
    return dalPreconditionFailed('not a funnel lead')  // refuse non-funnel customers
  }
  const nextLeadMeta = {
    ...leadMeta,
    scheduledFor: input.scheduledFor ?? leadMeta.scheduledFor,
    source: { ...leadMeta.source, enrichment: { ...leadMeta.source.enrichment, ...input.enrichment } },
  }
  return customerLeadMetaUpdate(ctx, input.customerId, nextLeadMeta)  // DAL mutation
}
```

> Use the exact helpers this file already uses (`customerCrud`, `dalSuccess`, the precondition-failed helper). The leadMeta patch must go through a **DAL mutation** — if no `db.update` for leadMeta exists, add `customerLeadMetaUpdate` in `src/shared/entities/customers/dal/server/mutations.ts` (services never call `db.*` directly — see conventions). Do NOT set `updatedAt` manually (schema-helper handles it).

- [ ] **Step 3:** tsc + lint + commit

```bash
git commit -m "feat(funnels): guarded public enrichFunnelLead mutation (funnel leads only)" -- src/trpc/routers/customers.router/business.router.ts src/shared/services/customer-intake.service.ts src/shared/entities/customers/dal/server/mutations.ts
```

---

### Task 3: Enrichment hook (fire-and-forget)

**Files:**
- Create: `src/shared/domains/funnels/hooks/use-enrich-lead.ts`

**Interfaces:**
- Produces: `useEnrichLead(): (args: { customerId: string, scheduledFor?: string, enrichment?: {...} }) => void` — fires the mutation, swallows errors (best-effort; never throws to the UI).

- [ ] **Step 1: Implement**

```ts
// src/shared/domains/funnels/hooks/use-enrich-lead.ts
import { useMutation } from '@tanstack/react-query'
import { useTRPC } from '@/trpc/helpers'

export function useEnrichLead() {
  const trpc = useTRPC()
  const mutation = useMutation(trpc.customersRouter.business.enrichFunnelLead.mutationOptions())
  return (args: { customerId: string, scheduledFor?: string, enrichment?: { age?: string | null, scope?: string | null, timeline?: string | null } }) => {
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

### Task 4: `datetime` step (day + window picker)

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/datetime-step.tsx`
- Modify: `src/shared/domains/funnels/types.ts` (add `DatetimeStep` to union; content fields `windows`)
- Modify: `src/shared/domains/funnels/lib/step-registry.ts`

- [ ] **Step 1: Type** — add `export interface DatetimeStep extends BaseStep { kind: 'datetime', field: string }` to the union; add to `StepContent` an optional `windows?: Record<string, string>` (e.g. `{ morning: 'Morning (8–12)', afternoon: 'Afternoon (12–4)', evening: 'Evening (4–7)' }`).

- [ ] **Step 2: Component** — next-14-day pills + a window card-select; on confirm, compose an ISO-ish preferred string and write it to answers (`scheduledFor`), then advance.

```tsx
// src/shared/domains/funnels/ui/steps/datetime-step.tsx
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { cn } from '@/shared/lib/utils'
import type { DatetimeStep, StepProps } from '@/shared/domains/funnels/types'

// 14 upcoming dates. NOTE: Date.now()/new Date() are fine in a client component
// at runtime (the no-Date rule applies only to workflow scripts, not app code).
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

export function DatetimeStepView({ content, setAnswers, onAdvance, onBack, isFirst }: StepProps<DatetimeStep>) {
  const [day, setDay] = useState<string | null>(null)
  const [windowKey, setWindowKey] = useState<string | null>(null)
  const days = upcomingDays(14)
  const windows = content.windows ?? { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening' }
  const ready = day && windowKey

  function confirm() {
    if (!day || !windowKey) {
      return
    }
    // Soft preferred time: human confirms exact slot. Store date + window key.
    setAnswers({ scheduledFor: `${day}T00:00:00.000Z`, preferredWindow: windowKey })
    onAdvance()
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
      {!isFirst ? <Button variant="ghost" onClick={onBack}>← Back</Button> : null}
    </div>
  )
}
```

> `preferredWindow` is stored in answers; the human-readable window can be appended to the lead note or carried in leadMeta later. For 2c, `scheduledFor` (date) is what persists to the lead.

- [ ] **Step 3:** Register `'datetime'` in the registry. tsc + lint + commit.

```bash
git commit -m "feat(funnels): datetime step (day + window soft preferred-time)" -- src/shared/domains/funnels/ui/steps/datetime-step.tsx src/shared/domains/funnels/types.ts src/shared/domains/funnels/lib/step-registry.ts
```

---

### Task 5: `confirmation` step (portfolio proof + fire enrichment)

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/confirmation-step.tsx`
- Modify: `src/shared/domains/funnels/types.ts` (add `ConfirmationStep`)
- Modify: `src/shared/domains/funnels/lib/step-registry.ts`

- [ ] **Step 0: Confirm the public portfolio query** — recon noted `projectsRouter.showroomDisplay` is the public portfolio surface. During implementation, find the exact public query that returns kitchen before/after media filtered by trade, and its input/return shape. If none filters by trade cleanly, fetch the showroom list and filter client-side by the kitchen trade. Name the exact procedure in the report.

- [ ] **Step 1: Component** — on mount, fire enrichment once (fire-and-forget); render scarcity + "we'll call within 24h" + a small before/after gallery from the portfolio query. This step is terminal (no advance).

```tsx
// src/shared/domains/funnels/ui/steps/confirmation-step.tsx
import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useEnrichLead } from '@/shared/domains/funnels/hooks/use-enrich-lead'
import { useTRPC } from '@/trpc/helpers'
import type { ConfirmationStep, StepProps } from '@/shared/domains/funnels/types'

export function ConfirmationStepView({ content, answers }: StepProps<ConfirmationStep>) {
  const enrich = useEnrichLead()
  const firedRef = useRef(false)
  const trpc = useTRPC()
  // Replace with the real public portfolio query confirmed in Step 0:
  const portfolio = useQuery(trpc.projectsRouter.showroomDisplay.list.queryOptions(/* { trade: 'kitchen' } */))

  useEffect(() => {
    if (firedRef.current) {
      return
    }
    firedRef.current = true
    const customerId = typeof answers.customerId === 'string' ? answers.customerId : null
    if (!customerId) {
      return
    }
    enrich({
      customerId,
      scheduledFor: typeof answers.scheduledFor === 'string' ? answers.scheduledFor : undefined,
      enrichment: {
        age: typeof answers.age === 'string' ? answers.age : null,
        scope: typeof answers.scope === 'string' ? answers.scope : null,
        timeline: typeof answers.timeline === 'string' ? answers.timeline : null,
      },
    })
  }, [answers, enrich])

  return (
    <div className="flex flex-col items-center gap-6 py-6 text-center">
      <h2 className="text-2xl font-semibold">{content.title}</h2>
      {content.subtitle ? <p className="text-muted-foreground max-w-prose">{content.subtitle}</p> : null}
      {/* before/after proof grid from `portfolio.data` — kitchen-filtered */}
    </div>
  )
}
```

> Render a compact before/after grid from `portfolio.data` (kitchen projects). Keep it lightweight (a few images, lazy). Exact field access depends on the showroom query's return shape (Step 0).

- [ ] **Step 2:** Add `ConfirmationStep` to the union + register `'confirmation'`. tsc + lint + commit.

```bash
git commit -m "feat(funnels): confirmation step (portfolio proof + fire enrichment)" -- src/shared/domains/funnels/ui/steps/confirmation-step.tsx src/shared/domains/funnels/types.ts src/shared/domains/funnels/lib/step-registry.ts
```

---

### Task 6: Stylized SVG region map on the location step

**Files:**
- Create: `src/shared/domains/funnels/constants/socal-regions.ts`
- Create: `src/shared/domains/funnels/ui/region-map.tsx`
- Modify: `src/shared/domains/funnels/ui/steps/location-step.tsx`

- [ ] **Step 1: Region mapping** — county → a region id used to highlight the SVG.

```ts
// src/shared/domains/funnels/constants/socal-regions.ts
// Resolved county (from resolve-zip) → highlighted region id in the SVG.
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

- [ ] **Step 2: `region-map.tsx`** — a branded inline SVG of the SoCal service area; the active region path animates in (motion), others dimmed. Props: `{ region: string }`. Use `motion.path`/`motion.g` with `FUNNEL_TRANSITION`; respect reduced motion. (Author the SVG paths as a stylized, low-detail regional shape — not a precise geographic map.)

- [ ] **Step 3:** In `location-step.tsx` `qualified` phase, store the resolved county in answers (extend `resolveZip` usage to keep `county`), map it via `COUNTY_TO_REGION`, and render `<RegionMap region={...} />` above the "qualifies" copy. Keep the `Continue` button.

- [ ] **Step 4:** tsc + lint + runtime (map renders + animates on a known CA ZIP; reduced-motion shows it statically). Commit.

```bash
git commit -m "feat(funnels): stylized SVG region map reveal on location step" -- src/shared/domains/funnels/constants/socal-regions.ts src/shared/domains/funnels/ui/region-map.tsx src/shared/domains/funnels/ui/steps/location-step.tsx
```

---

### Task 7: Complete the kitchen flow + full end-to-end smoke

**Files:**
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`

- [ ] **Step 1:** Extend `steps` + `STEP_ORDER` to the full flow:
`hero → layout → ownership → location → pii → age → scope → timeline → datetime → confirmation`
Add `age`/`scope`/`timeline` as `card-select` steps (`field: 'age'|'scope'|'timeline'`), `datetime` (`field:'scheduledFor'`), and `confirmation`. Add their `content.steps` entries:

```ts
age: { title: 'How old is your kitchen?', options: {
  '0-5': { label: '0–5 years' }, '5-15': { label: '5–15 years' },
  '15-plus': { label: '15+ years' }, original: { label: 'Original / never renovated' } } },
scope: { title: 'What are you picturing?', options: {
  'full-gut': { label: 'Full gut remodel' }, 'cabinets-counters': { label: 'Cabinets + counters' },
  refresh: { label: 'Cosmetic refresh' }, 'not-sure': { label: 'Not sure yet' } } },
timeline: { title: 'When would you want to start?', options: {
  asap: { label: 'ASAP' }, '1-3': { label: '1–3 months' },
  '3-6': { label: '3–6 months' }, exploring: { label: 'Just exploring' } } },
datetime: { title: 'When works for a quick call?', cta: 'Confirm preferred time',
  windows: { morning: 'Morning (8–12)', afternoon: 'Afternoon (12–4)', evening: 'Evening (4–7)' } },
confirmation: { title: "You're on the list.",
  subtitle: "We review fit and call within 24 hours. Here's recent Tri Pros kitchen work." },
```

- [ ] **Step 2: tsc + lint** → clean.

- [ ] **Step 3: Full end-to-end runtime smoke (dev, browser)** at `http://kitchens.localhost:3000/?utm_source=meta&utm_campaign=kitchens-showcase`:
  1. Complete all steps hero → … → confirmation.
  2. On the ZIP step, a known CA ZIP shows the animated region map + "qualifies"; city pre-fills on PII.
  3. PII submit creates the lead (network 200).
  4. Reaching confirmation fires `enrichFunnelLead` (network 200, fire-and-forget).
  5. Verify in the DEV DB the customer's `leadMetaJSON` has: `source.kind:'funnel'`, `offer:'showcase'`, `funnelSlug:'kitchens'`, `utm.source:'meta'`, `utm.campaign:'kitchens-showcase'`, `source.enrichment.{age,scope,timeline}` set, `scheduledFor` set, `interestedTradesRaw:['Kitchen Renovation']`.
  6. Confirm the before/after gallery renders kitchen projects.
  7. Negative: directly POSTing `enrichFunnelLead` with a random UUID, or a non-funnel customer id, is refused (precondition-failed) — confirms the guard.

  Record evidence in the report.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): complete kitchen funnel (enrichment + appointment + confirmation)" -- src/shared/domains/funnels/constants/kitchens.ts
```

---

## Out of scope for Plan 2c (later plans)

- Meta Pixel + CAPI dual-fire (`PageView`/`ViewContent`/`Lead`/`Schedule` browser + the server pipeline events) — **Plan 3**.
- Bathroom + complete-interior specs (config-only, reusing this engine + step library) — **Plan 4**.
- Trade icon set, per-trade accent tuning, copy polish, fuller region-map artwork — **Plan 5**.

## Self-Review

- **Spec coverage:** enrichment age/scope/timeline (Tasks 1,4,7) ✅ [product §2 enrichment]; soft preferred-time → `scheduledFor`, human confirms, no auto-meeting (Task 4 + 2b `customer_only`) ✅ [§2]; confirmation w/ portfolio before/afters + next-steps + scarcity (Task 5,7) ✅; region map reveal (Task 6) ✅; post-lead persistence without exposing a broad update (Task 2 guarded mutation) ✅; enrichment never blocks confirmation (Task 3 fire-and-forget) ✅.
- **Placeholder scan:** none in code; two explicit "confirm during implementation" hooks (the public portfolio query shape in Task 5 Step 0; the region SVG artwork in Task 6 Step 2) are scoped investigations, not placeholders — each names exactly what to resolve.
- **Type consistency:** `enrichment` shape identical across leadMeta variant (Task 1), `enrichFunnelLead` input (Task 2), the hook (Task 3), and the confirmation call (Task 5); `scheduledFor` reuses the existing top-level leadMeta field (not duplicated); new step kinds (`datetime`,`confirmation`) added to the union + registry consistently; `setAnswers` (from 2b) used by datetime + location.
- **Security flagged for review:** Task 2's public `enrichFunnelLead` — UUID-capability + rate-limit + funnel-only + field-allowlist. This is the one new public write surface; called out in the plan header and to be reviewed before merge.
- **Backend conventions:** leadMeta patch goes through a DAL mutation (Task 2 note), not `db.*` in the service; no manual `updatedAt`.
```
