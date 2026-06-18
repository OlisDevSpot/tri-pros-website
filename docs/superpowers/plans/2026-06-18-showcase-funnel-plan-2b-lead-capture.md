# Showcase Funnel — Plan 2b: Location (ZIP) + PII + Lead Capture

> **RE-CUT (2026-06-18) against the hardened step model** (`docs/superpowers/specs/2026-06-18-funnelspec-step-model-design.md`, implemented in `docs/superpowers/plans/2026-06-18-funnelspec-step-model-rewrite.md`). This supersedes the prior 2b. The two anti-patterns the old 2b carried are GONE: there is **no `setAnswers` multi-key setter** (composite answers are typed objects written via the single `setValue`) and **no `pii-form` engine special-case** (the step reads funnel context from `ctx`, which the engine already hands every step). New kinds land as forced-exhaustive lockstep extensions.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Add two step kinds — `location` (ZIP capture + "your area qualifies" beat, composite answer `{zip,city,state,county}`) and `pii-form` (name/phone/email/city + TCPA consent, answer `{leadId}`) — and wire the PII submit to create a real CRM lead via the existing customers intake mutation, attributed to a single `Branded Meta Ads` lead source with per-lead funnel metadata (offer + funnelSlug + UTM).

**Architecture:** Builds on the hardened model. Each new kind is added by extending `FunnelStep` + `AnswerByKind` + `ContentByKind` + `STEP_REGISTRY` in lockstep (`tsc` forces all four). `location` writes a composite `LocationAnswer` via `setValue`. `pii-form` reads `ctx.{slug,offer,utm}` + `answers` (to pre-fill city from the location answer), runs its own react-hook-form + zod, calls the public intake mutation, then `setValue({ leadId })`. The genuinely-shared steps ship as **importable prebuilt typed objects** (`ZIP_STEP`, `PII_STEP`) — Seam A of the headless-step-library doc, realized without `composeSteps`.

**Tech Stack:** Next.js 15.5.9, React 19, `react-hook-form` + `@hookform/resolvers` + `zod` v4 (`import z from 'zod'`, `z.email()`), `motion` v12, shadcn/ui, tRPC (`useTRPC()` from `@/trpc/helpers`).

**Specs:** product `2026-06-17-showcase-funnel-system-design.md` (§2 flow, §5 lead plumbing, §8 TCPA); type model `2026-06-18-funnelspec-step-model-design.md`.

## Precondition (HARD DEPENDENCY)

- **The hardened step model is landed** (the type-layer rewrite is complete on `main`). Verify the new contracts exist before starting:
  - `grep -n "AnswerByKind\|ContentByKind\|FunnelContext\|setValue\|StepComponentFor" src/shared/domains/funnels/types.ts` → all present.
  - `src/shared/domains/funnels/hooks/use-funnel-utm.ts` exists (created by the rewrite — **this plan consumes it, does not create it**).
  - `src/shared/domains/funnels/ui/funnel-engine.tsx` already passes `answers` + `ctx` to every step. **This plan does NOT modify the engine** — that's the whole point of the re-cut.
  - If any of the above is missing, STOP — the rewrite must land first.

## Locked decisions (from brainstorm)

- **One lead source:** `branded-meta-ads` (name "Branded Meta Ads"). NOT per-trade, NOT per-offer.
- **Segmentation via leadMeta:** new `source` variant `{ kind: 'funnel', offer, funnelSlug, utm }`. `offer` = `'showcase'`. `funnelSlug` = the slug. `utm` = captured params. `interestedTradesRaw` carries the trade name for CT/SMS uniformity.
- **"Funnel = trade + offer":** `FunnelSpec.offer` already exists (set by the rewrite). The trade is the slug.
- **City source:** the PII form collects `city` (pre-filled, editable, from the ZIP resolution). ZIP is collected at the `location` step.
- **ZIP→city resolution:** bundled CA ZIP→city map first; **Zippopotam** (`https://api.zippopotam.us/us/<zip>`, no key, CORS-open) fallback for misses; on total failure leave city blank.
- **Lead mode:** `customer_only` (NO auto-meeting; `scheduledFor` captured in 2c).

## Global Constraints

- **No test runner.** Verification = `pnpm tsc` + `pnpm lint` (+ `pnpm lint:fix`) + runtime browser smoke. NEVER `pnpm build`.
- Work on `main`. **Pathspec-only commits** (`git status --short` first; `git commit -- <paths>`; never `git add -A`/bare commit). Leave any unrelated modified files (e.g. another session's docs) untouched.
- Named exports only (except Next.js `page.tsx`). `import type` top level. Braces+newline on every `if`. Imports sorted (`pnpm lint:fix`). `@/`→`src/`.
- `shared/` never imports `features/`. `schemas/` is a sibling of `lib/`. One component per file. No barrels. Constants/config in `constants/`, pure fns in `lib/`. Motion respects `prefers-reduced-motion`.
- **Engine stays trade-agnostic and is NOT modified by this plan.** New kinds reach funnel context only via `ctx` and `answers` (already on `StepProps`).
- **Lead creation goes through the customers entity router's public intake mutation** (entity owns its mutations — the funnel never writes lead DAL itself).
- **Adding a kind is a lockstep change:** `FunnelStep` union + `AnswerByKind` + `ContentByKind` + `STEP_REGISTRY` must all gain the kind together, or `tsc` errors (this is the safety net — do not suppress it with casts).

## File structure (this plan)

```
src/shared/entities/customers/schemas/index.ts   MODIFY — add source 'funnel' variant
src/shared/domains/funnels/
├── types.ts                          MODIFY — add LocationStep/PiiStep + Location/Pii Answer + Content (lockstep)
├── schemas/
│   └── pii.schema.ts                 CREATE — zod schema for the PII step
├── constants/
│   ├── ca-zip-cities.ts              CREATE — bundled CA ZIP→{city,county} map
│   ├── step-registry.ts              MODIFY — register 'location' + 'pii-form'
│   └── kitchens.ts                   MODIFY — append ZIP_STEP + PII_STEP to the flow
├── lib/
│   ├── resolve-zip.ts                CREATE — ZIP→{city,state,county} (bundled + Zippopotam)
│   └── build-lead-input.ts           CREATE — ctx + answers + pii → intake mutation input
└── ui/steps/
    ├── location-step.tsx             CREATE — LocationStepView + LocationContent + ZIP_STEP (library object)
    └── pii-form-step.tsx             CREATE — PiiFormStepView + PiiContent + PII_STEP (library object)
scripts/seed-lead-sources.ts          MODIFY — add branded-meta-ads source
```

---

### Task 1: Extend `leadMetaJSON` with the `funnel` source variant

**Files:**
- Modify: `src/shared/entities/customers/schemas/index.ts`

**Interfaces:**
- Produces: a third `source` discriminated-union variant `kind: 'funnel'` on `leadMetaSchema`.

- [ ] **Step 1: Locate the schema** — `grep -n "leadMetaSchema\|discriminatedUnion\|kind: z.literal" src/shared/entities/customers/schemas/index.ts`. Confirm `leadMetaSchema.source` is a `z.discriminatedUnion('kind', [...])` with existing `bina`/`generic` variants. Read the surrounding lines.

- [ ] **Step 2: Add the variant** (additive — existing rows stay valid; column is nullable jsonb, no DB push) inside the `discriminatedUnion('kind', [...])` array:

```ts
z.object({
  kind: z.literal('funnel'),
  offer: z.string(),               // 'showcase'
  funnelSlug: z.string(),          // 'kitchens'
  utm: z.object({
    source: z.string().nullable(),
    medium: z.string().nullable(),
    campaign: z.string().nullable(),
    content: z.string().nullable(),
    term: z.string().nullable(),
    fbclid: z.string().nullable(),
    gclid: z.string().nullable(),
  }),
}),
```

- [ ] **Step 3: Type-check** — `pnpm tsc 2>&1 | tail -5`. If a `source.kind` exhaustive switch errors elsewhere, that's a real call site — handle the `funnel` case minimally and note it in the report.

- [ ] **Step 4: Commit**

```bash
git status --short
git commit -m "feat(customers): leadMeta source 'funnel' variant (offer+funnelSlug+utm)" -- src/shared/entities/customers/schemas/index.ts
```

---

### Task 2: Extend the type model with `location` + `pii-form` kinds (lockstep)

Add both kinds' answer + content + step variants. This is a single cohesive type change. After it, `tsc` errors ONLY in `constants/step-registry.ts` (the mapped `StepRegistry` now demands `location`/`pii-form` components that don't exist yet) — expected; closed in Tasks 4–5.

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`

**Interfaces:**
- Produces: `LocationAnswer`, `PiiAnswer` (added to `AnswerByKind`); `LocationContent`, `PiiContent`, `PiiFieldLabels` (added to `ContentByKind`); `LocationStep`, `PiiStep` (added to `FunnelStep`).

- [ ] **Step 1: Add the answer shapes + AnswerByKind entries.** In `types.ts`, add the composite answer interfaces near the other answer types, and extend `AnswerByKind`:

```ts
export interface LocationAnswer { zip: string, city: string, state: string, county: string | null }
export interface PiiAnswer { leadId: string }

export interface AnswerByKind {
  'info': never
  'card-select': string
  'location': LocationAnswer
  'pii-form': PiiAnswer
}
```

(`AnswerValue = AnswerByKind[keyof AnswerByKind] | null` auto-widens to include the composites — no other edit needed.)

- [ ] **Step 2: Add the content shapes + ContentByKind entries:**

```ts
export interface LocationContent {
  title: string
  subtitle?: string
  cta?: string
  checkingLabel?: string        // "Checking availability in {zip}…"
  qualifiesLabel?: string       // "Your area qualifies — limited spots remain."
}
export interface PiiFieldLabels { name?: string, phone?: string, email?: string, city?: string }
export interface PiiContent {
  title: string
  subtitle?: string
  cta?: string
  consent: string               // TCPA wording
  fields: PiiFieldLabels
}

export interface ContentByKind {
  'info': HeroContent
  'card-select': CardSelectContent
  'location': LocationContent
  'pii-form': PiiContent
}
```

- [ ] **Step 3: Add the step variants to the union:**

```ts
export interface LocationStep extends BaseStep<'location'> { content: LocationContent }
export interface PiiStep extends BaseStep<'pii-form'> { content: PiiContent }

export type FunnelStep = InfoStep | CardSelectStep | LocationStep | PiiStep
```

- [ ] **Step 4: tsc** — `pnpm tsc 2>&1 | grep "domains/funnels"`. Expected: errors ONLY in `constants/step-registry.ts` (missing `location`/`pii-form` keys, since `StepKind` now includes them). No errors in `types.ts`. This is the lockstep safety net working.

- [ ] **Step 5: lint + commit**

```bash
git status --short
pnpm lint:fix && pnpm lint 2>&1 | grep "types.ts" || true
git commit -m "feat(funnels): add location + pii-form kinds to type model (lockstep)" -- src/shared/domains/funnels/types.ts
```

---

### Task 3: ZIP→city resolution (bundled CA map + Zippopotam fallback)

**Files:**
- Create: `src/shared/domains/funnels/constants/ca-zip-cities.ts`
- Create: `src/shared/domains/funnels/lib/resolve-zip.ts`

**Interfaces:**
- Produces: `CA_ZIP_CITIES: Record<string, { city: string, county: string }>`; `ResolvedZip` ({ zip, city, state, county }); `resolveZip(zip): Promise<ResolvedZip | null>`.

- [ ] **Step 1: Bundled CA ZIP map** — seed with the Tri Pros service-area ZIPs (curated; expand over time). Populate from `src/shared/constants/company/` + `docs/company/overview.md` coverage during implementation; a partial map is fine (API covers gaps):

```ts
// src/shared/domains/funnels/constants/ca-zip-cities.ts
// Curated CA service-area ZIPs → city/county. Unknown ZIPs fall back to the
// Zippopotam API in resolve-zip.ts. Expand as coverage grows.
export const CA_ZIP_CITIES: Record<string, { city: string, county: string }> = {
  '90001': { city: 'Los Angeles', county: 'Los Angeles' },
  '92602': { city: 'Irvine', county: 'Orange' },
  '91709': { city: 'Chino Hills', county: 'San Bernardino' },
  // … seed with the real Tri Pros service-area ZIPs
}
```

- [ ] **Step 2: Resolver with fallback:**

```ts
// src/shared/domains/funnels/lib/resolve-zip.ts
import { CA_ZIP_CITIES } from '@/shared/domains/funnels/constants/ca-zip-cities'

export interface ResolvedZip {
  zip: string
  city: string
  state: string
  county: string | null
}

export async function resolveZip(zip: string): Promise<ResolvedZip | null> {
  const local = CA_ZIP_CITIES[zip]
  if (local) {
    return { zip, city: local.city, state: 'CA', county: local.county }
  }
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`)
    if (!res.ok) {
      return null
    }
    const data = await res.json() as { places?: Array<{ 'place name': string, 'state abbreviation': string }> }
    const place = data.places?.[0]
    if (!place) {
      return null
    }
    return { zip, city: place['place name'], state: place['state abbreviation'], county: null }
  }
  catch {
    return null
  }
}
```

- [ ] **Step 3: tsc + lint + commit**

```bash
git status --short
pnpm tsc 2>&1 | grep -E "resolve-zip|ca-zip-cities" || true   # expect none
git commit -m "feat(funnels): ZIP->city resolver (bundled CA map + zippopotam fallback)" -- src/shared/domains/funnels/constants/ca-zip-cities.ts src/shared/domains/funnels/lib/resolve-zip.ts
```

---

### Task 4: `location` step component + register + `ZIP_STEP` library object

The location step writes a **composite** `LocationAnswer` via the single `setValue` (no `setAnswers`). It exports `ZIP_STEP` — the importable prebuilt step object (Seam A).

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/location-step.tsx`
- Modify: `src/shared/domains/funnels/constants/step-registry.ts`

**Interfaces:**
- Consumes: `StepProps<LocationStep>`, `LocationAnswer`, `LocationContent`, `LocationStep` (types), `resolveZip`, `Button`, `Input`.
- Produces: `LocationStepView`; `ZIP_STEP: LocationStep`.

- [ ] **Step 1: The component + library object.** Note: it reads `content`, writes the composite via `setValue`, and advances. No `field`, no `setAnswers`.

```tsx
// src/shared/domains/funnels/ui/steps/location-step.tsx
import type { LocationStep, StepProps } from '@/shared/domains/funnels/types'
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { resolveZip } from '@/shared/domains/funnels/lib/resolve-zip'

type Phase = 'input' | 'checking' | 'qualified'

export function LocationStepView({ content, setValue, advance, back, isFirst }: StepProps<LocationStep>) {
  const [zip, setZip] = useState('')
  const [phase, setPhase] = useState<Phase>('input')

  async function handleSubmit() {
    if (!/^\d{5}$/.test(zip)) {
      return
    }
    setPhase('checking')
    const resolved = await resolveZip(zip)
    // Composite answer — one slot, written once. No setAnswers.
    setValue({
      zip,
      city: resolved?.city ?? '',
      state: resolved?.state ?? 'CA',
      county: resolved?.county ?? null,
    })
    setPhase('qualified')
  }

  if (phase === 'input') {
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
          onChange={e => setZip(e.target.value.replace(/\D/g, ''))}
          className="mx-auto max-w-xs text-center text-lg"
        />
        <Button size="lg" disabled={!/^\d{5}$/.test(zip)} onClick={handleSubmit}>
          {content.cta ?? 'Check my area'}
        </Button>
        {!isFirst ? <Button variant="ghost" onClick={back}>← Back</Button> : null}
      </div>
    )
  }

  if (phase === 'checking') {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <span className="border-primary size-8 animate-spin rounded-full border-2 border-t-transparent" />
        <p className="text-muted-foreground">{(content.checkingLabel ?? 'Checking availability in {zip}…').replace('{zip}', zip)}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <p className="text-primary text-xl font-semibold">
        {content.qualifiesLabel ?? '✓ Great news — your area qualifies.'}
      </p>
      {/* Plan 2c replaces this with the stylized SVG region reveal. */}
      <Button size="lg" onClick={advance}>{content.cta ?? 'Continue'}</Button>
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
    cta: 'Check my area',
    checkingLabel: 'Checking availability in {zip}…',
    qualifiesLabel: '✓ Great news — your area qualifies. Limited spots remain.',
  },
}
```

- [ ] **Step 2: Register** in `constants/step-registry.ts` — add `'location': LocationStepView` to `STEP_REGISTRY` (the `StepRegistry` mapped type now type-checks this slot against `StepProps<LocationStep>`; no cast):

```ts
import { LocationStepView } from '@/shared/domains/funnels/ui/steps/location-step'
// …
export const STEP_REGISTRY: StepRegistry = {
  'info': InfoStepView,
  'card-select': CardSelectStepView,
  'location': LocationStepView,
  // 'pii-form' added in Task 5
}
```

- [ ] **Step 3: tsc** — `pnpm tsc 2>&1 | grep "domains/funnels"`. Expected: errors ONLY remain for the still-missing `'pii-form'` registry key. `location-step.tsx` + the `location` slot are clean.

- [ ] **Step 4: lint:fix + commit**

```bash
git status --short
git commit -m "feat(funnels): location step (composite answer) + ZIP_STEP library object" -- src/shared/domains/funnels/ui/steps/location-step.tsx src/shared/domains/funnels/constants/step-registry.ts
```

---

### Task 5: PII schema + lead-input builder + `pii-form` step + register + `PII_STEP`

The PII step is fully self-contained: own react-hook-form + zod, reads `ctx.{slug,offer,utm}` + `answers` (city pre-fill from the location answer), calls the public intake mutation, then `setValue({ leadId })`. **No engine special-case** — it gets `ctx` like every step.

**Files:**
- Create: `src/shared/domains/funnels/schemas/pii.schema.ts`
- Create: `src/shared/domains/funnels/lib/build-lead-input.ts`
- Create: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx`
- Modify: `src/shared/domains/funnels/constants/step-registry.ts`

**Interfaces:**
- Consumes: `StepProps<PiiStep>`, `FunnelContext`, `FunnelAnswers`, `LocationAnswer`, the customers intake mutation.
- Produces: `piiSchema`/`PiiFormData`; `buildLeadInput(args)`; `PiiFormStepView`; `PII_STEP: PiiStep`.

- [ ] **Step 1: PII zod schema** (zod v4: `import z from 'zod'`, `z.email()`; honeypot + consent):

```ts
// src/shared/domains/funnels/schemas/pii.schema.ts
import z from 'zod'

export const piiSchema = z.object({
  name: z.string().min(1, 'Please enter your name'),
  phone: z.string().min(7, 'Please enter a valid phone'),
  email: z.email('Please enter a valid email'),
  city: z.string().min(1, 'Please enter your city'),
  consent: z.literal(true, { message: 'Please agree to be contacted' }),
  _honeypot: z.string().max(0).optional(),
})
export type PiiFormData = z.infer<typeof piiSchema>
```

- [ ] **Step 2: Lead-input builder** — pure; maps `ctx` + `answers` + form data → the intake mutation input. Reads the composite location answer from `answers.location` (typed via a guard):

```ts
// src/shared/domains/funnels/lib/build-lead-input.ts
import type { FunnelAnswers, FunnelContext, LocationAnswer } from '@/shared/domains/funnels/types'
import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'

// trade slug → canonical Notion trade name (CT/SMS uniformity)
const TRADE_NAME: Record<string, string> = {
  kitchens: 'Kitchen Renovation',
  bathrooms: 'Bathroom Renovation',
  'complete-interior': 'Complete Interior Remodel',
}

function locationAnswer(answers: FunnelAnswers): Partial<LocationAnswer> {
  const a = answers.location
  return a && typeof a === 'object' && !Array.isArray(a) ? a as LocationAnswer : {}
}

export function buildLeadInput(args: { ctx: FunnelContext, pii: PiiFormData, answers: FunnelAnswers }) {
  const { ctx, pii, answers } = args
  const loc = locationAnswer(answers)
  const campaign = ctx.utm.campaign ?? ctx.utm.source ?? `funnel:${ctx.slug}`

  return {
    name: pii.name,
    phone: pii.phone,
    email: pii.email,
    city: pii.city,
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

> During implementation, verify the exact intake mutation path + input field names against the customers router (the prior 2b recon used `customersRouter.business.createFromIntake` with `{name,phone,email,city,state?,zip,mode,leadSourceSlug?,leadMetaJSON?}`). Adjust `buildLeadInput`'s returned shape to match the live mutation input. The mutation must return the created lead/customer id.

- [ ] **Step 3: The PII step + library object** — reads `ctx` (no injected props), submits, stores `{ leadId }`:

```tsx
// src/shared/domains/funnels/ui/steps/pii-form-step.tsx
import type { PiiStep, StepProps } from '@/shared/domains/funnels/types'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'
import { buildLeadInput } from '@/shared/domains/funnels/lib/build-lead-input'
import { piiSchema } from '@/shared/domains/funnels/schemas/pii.schema'
import { useTRPC } from '@/trpc/helpers'
import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'

export function PiiFormStepView({ content, answers, ctx, setValue, advance, onBack, isFirst }: StepProps<PiiStep>) {
  const trpc = useTRPC()
  // Verify the exact mutation path during implementation (see Task 5 Step 2 note).
  const submit = useMutation(trpc.customersRouter.business.createFromIntake.mutationOptions({
    onError: err => toast.error(err.message),
  }))

  const prefillCity = (() => {
    const loc = answers.location
    return loc && typeof loc === 'object' && !Array.isArray(loc) && 'city' in loc ? String(loc.city ?? '') : ''
  })()

  const form = useForm<PiiFormData>({
    resolver: zodResolver(piiSchema),
    defaultValues: { name: '', phone: '', email: '', city: prefillCity, consent: false as unknown as true, _honeypot: '' },
  })

  async function onSubmit(data: PiiFormData) {
    if (data._honeypot) {
      return
    }
    const created = await submit.mutateAsync(buildLeadInput({ ctx, pii: data, answers }))
    // Store the created lead id in this step's slot (2c enrichment keys off it).
    setValue({ leadId: String((created as { id: string }).id) })
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
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>{content.fields.name ?? 'Full name'}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>{content.fields.phone ?? 'Phone'}</FormLabel><FormControl><Input type="tel" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>{content.fields.email ?? 'Email'}</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem><FormLabel>{content.fields.city ?? 'City'}</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="consent" render={({ field }) => (
            <FormItem className="flex items-start gap-2">
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              <FormLabel className="text-muted-foreground text-xs font-normal leading-snug">{content.consent}</FormLabel>
              <FormMessage />
            </FormItem>
          )} />
          <input type="text" tabIndex={-1} autoComplete="off" className="hidden" {...form.register('_honeypot')} />
        </fieldset>
        <Button type="submit" size="lg" disabled={submit.isPending}>
          {submit.isPending ? 'Submitting…' : (content.cta ?? 'See if I qualify')}
        </Button>
        {!isFirst ? <Button type="button" variant="ghost" onClick={onBack}>← Back</Button> : null}
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
    consent: "By submitting, I agree Tri Pros Remodeling may contact me by call, text, and email about my project. Consent isn't a condition of purchase. Msg/data rates may apply. See our Privacy Policy.",
    fields: { name: 'Full name', phone: 'Phone', email: 'Email', city: 'City' },
  },
}
```

> Note: `StepProps` exposes `back` (not `onBack`) — confirm the exact prop name in `types.ts` during implementation and destructure accordingly. Verify `toast` (`sonner`), `Checkbox`/`Form` shadcn exports, and `useTRPC` (`@/trpc/helpers`) paths.

- [ ] **Step 4: Register** `'pii-form': PiiFormStepView` in `constants/step-registry.ts`. After this the registry is exhaustive and the whole domain type-checks.

- [ ] **Step 5: Full tsc + lint** — `pnpm tsc 2>&1 | grep "domains/funnels"` → no output; `pnpm lint:fix && pnpm lint 2>&1 | grep "domains/funnels"` → no errors.

- [ ] **Step 6: Commit**

```bash
git status --short
git commit -m "feat(funnels): pii-form step (ctx-driven lead create) + PII_STEP + builder + schema" -- src/shared/domains/funnels/schemas/pii.schema.ts src/shared/domains/funnels/lib/build-lead-input.ts src/shared/domains/funnels/ui/steps/pii-form-step.tsx src/shared/domains/funnels/constants/step-registry.ts
```

---

### Task 6: Seed the `branded-meta-ads` lead source

**Files:**
- Modify: `scripts/seed-lead-sources.ts`

- [ ] **Step 1:** Add an entry mirroring the existing rows (`name` + minimal `customer_only` `formConfigJSON`; slug auto-derives to `branded-meta-ads`; idempotent). Inspect an existing entry first to replicate its shape:

```ts
{ name: 'Branded Meta Ads', /* formConfigJSON: mirror an existing customer_only entry */ },
```

- [ ] **Step 2: Run against the DEV DB** — `pnpm tsx scripts/seed-lead-sources.ts`. Confirm `branded-meta-ads` inserted. **Dev DB only** — if the script targets prod by default, run the dev-gated variant (check how other seeds gate env). Do NOT seed prod.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(funnels): seed 'Branded Meta Ads' lead source" -- scripts/seed-lead-sources.ts
```

---

### Task 7: Add location + PII to the kitchen flow + end-to-end smoke

**Files:**
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`

- [ ] **Step 1:** Append the two library steps after `ownership`, importing and spread-overriding only what differs (Seam A in action):

```ts
import { ZIP_STEP } from '@/shared/domains/funnels/ui/steps/location-step'
import { PII_STEP } from '@/shared/domains/funnels/ui/steps/pii-form-step'
// … in steps: [], after the ownership step:
{ ...ZIP_STEP, content: { ...ZIP_STEP.content, subtitle: 'Showcase kitchens are selected by neighborhood.' } },
PII_STEP,
```

(No `flow` change — the funnel stays linear; the engine advances hero→layout→ownership→location→pii in order.)

- [ ] **Step 2: tsc + lint** — `pnpm tsc && pnpm lint` → clean (project-wide).

- [ ] **Step 3: End-to-end runtime smoke (dev)** at `http://localhost:3000/funnels/kitchens?utm_source=meta&utm_campaign=test` (or the `kitchens.localhost:3000` host):
  1. hero → layout → own/rent → **ZIP step**: enter a CA ZIP → "Checking…" beat → "qualifies" → Continue.
  2. **PII**: city pre-filled from the ZIP answer; fill name/phone/email, check consent, submit.
  3. Confirm the mutation returns 200 and a **customer row is created in the DEV DB** with `leadSourceSlug` → `branded-meta-ads`, `leadMetaJSON.source.kind === 'funnel'`, `offer: 'showcase'`, `funnelSlug: 'kitchens'`, `interestedTradesRaw: ['Kitchen Renovation']`, UTM captured.
  4. Inspect `localStorage['tri-pros:funnel:kitchens'].answers` → `location` is a composite `{zip,city,state,county}` object and `pii` is `{ leadId }`. **No flat `zip`/`city`/`state` keys** (proves no `setAnswers`).
  5. Refresh mid-flow → resumes on the current step (persistence holds with the new kinds), 0 console errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): kitchen flow through PII -> creates Branded Meta Ads lead" -- src/shared/domains/funnels/constants/kitchens.ts
```

---

## Out of scope (later plans)

- Enrichment card-selects (age/scope/timeline), `datetime` (→ `scheduledFor`), `confirmation` (portfolio before/afters), the stylized SVG region map, and the public `enrichFunnelLead` mutation — **Plan 2c** (also re-cut against the hardened model: new kinds via lockstep extension; `datetime` answer is a composite object).
- Meta Pixel `Lead`/CAPI dual-fire (mounts on the PII submit) — **Plan 3**.
- Bathroom / complete-interior specs — **Plan 4**. Trade icons, accent tuning — **Plan 5**.

## Self-Review

- **Anti-patterns removed:** no `setAnswers` (location writes a composite `LocationAnswer` via `setValue`); no engine special-case (pii reads `ctx`; engine untouched — Task list never modifies `funnel-engine.tsx`/`use-funnel-engine.ts`). ✅ [the whole reason for the re-cut]
- **Lockstep enforced:** Task 2 adds both kinds to `FunnelStep`+`AnswerByKind`+`ContentByKind`; `STEP_REGISTRY` stays red until Tasks 4–5 register the components — `tsc` is the safety net. ✅
- **Seam A honored:** `ZIP_STEP`/`PII_STEP` are importable prebuilt typed objects, spread-overridden in `kitchens.ts`; no `composeSteps`, no per-funnel re-declaration of shared copy. ✅
- **Spec coverage:** lead created at PII (Tasks 5,7) [product §2 lead-first]; routes through the customers intake mutation (Task 5) [§5]; single `branded-meta-ads` source + funnel metadata (Tasks 1,6, builder) [locked]; UTM via `ctx` from the existing `useFunnelUtm` (no re-creation) [§7.4]; `customer_only` (builder `mode`) [§2]; TCPA consent (Task 5 schema + content) [§8]; ZIP→city resolution + pre-fill (Tasks 3,4,5); refresh-resume preserved (Task 7 smoke) [§7.3]. Deferred-with-note: datetime/confirmation/SVG map (2c), pixel/CAPI (3).
- **Placeholder scan:** concrete code throughout; the CA ZIP map and the exact intake-mutation input shape are explicitly flagged as implementation-time verification, not placeholders.
- **Type consistency:** `LocationAnswer`/`PiiAnswer` (Task 2) ↔ `setValue` composites (Tasks 4,5) ↔ `buildLeadInput`'s `answers.location` read (Task 5) ↔ `source.kind:'funnel'` schema (Task 1); `ctx.{slug,offer,utm}` (engine-provided) consumed by the builder + pii step.
