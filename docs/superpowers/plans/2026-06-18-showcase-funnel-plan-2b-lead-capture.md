# Showcase Funnel — Plan 2b: Location (ZIP) + PII + Lead Capture

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the funnel engine with two step kinds — `location` (ZIP capture + "your area qualifies" beat) and `pii-form` (name/phone/email/city + TCPA consent) — and wire the PII submit to create a real CRM lead via the existing `createFromIntake` path, attributed to a single **`Branded Meta Ads`** lead source with per-lead funnel metadata (offer + funnel + UTM).

**Architecture:** Builds on Plan 2a's engine. `location` collects ZIP, resolves it to city/region (bundled CA map + Zippopotam fallback) to power the "qualifies" beat and pre-fill the PII city field. `pii-form` is a react-hook-form step that, on submit, assembles the `createFromIntake` payload from the engine's accumulated `answers` + captured UTM, fires the public tRPC mutation (lead created + the `Lead` pixel event will mount here in Plan 3), then advances. Lead attribution: one `branded-meta-ads` source; segmentation via a new `kind: 'funnel'` variant on `leadMetaJSON.source` (`offer`, `funnelSlug`, `utm`).

**Tech Stack:** Next.js 15.5.9, React 19, `react-hook-form` + `@hookform/resolvers` + `zod` v4, `motion` v12, shadcn/ui, tRPC (`@trpc/tanstack-react-query`).

**Specs:** product `2026-06-17-showcase-funnel-system-design.md` (§2 flow, §5 lead plumbing, §8 TCPA); architecture `2026-06-18-funnels-domain-config-architecture-design.md`.

## Precondition (HARD DEPENDENCY)

- **Plan 2a is implemented** (`use-funnel-engine`, `FunnelEngine`, `step-registry`, `info`/`card-select` steps, kitchen hero→layout→ownership).
- The funnels domain/config foundation is in place (`slugs.ts`, `types.ts`, static `registry.ts`, kitchen spec, route page renders `<FunnelEngine spec={spec} />`).

Verify: `ls src/shared/domains/funnels/{hooks/use-funnel-engine.ts,ui/funnel-engine.tsx,lib/step-registry.ts}`. If missing, STOP — 2a must land first.

> **RECONCILE FIRST (read the landed 2a `types.ts`).** 2a finalized `StepProps` as `{ step, funnelContent: FunnelContent, content?: StepContent, value, onChange, onAdvance, onBack, isFirst }` and `FunnelContent` as the four hero fields + a `steps` map. This plan's snippets show only the fields they add (`answers`, `setAnswers`); when implementing, treat the **landed** `StepProps`/`FunnelContent`/`FunnelStep` as source of truth and merge these additions in (per-step `content` is optional → use `content?.x`). `FunnelContent` is owned by 2a — do not redefine it; only extend `FunnelSpec` with `offer` and add the new step kinds.

## Locked decisions (from brainstorm)

- **One lead source:** `branded-meta-ads` (name "Branded Meta Ads") — the channel = our in-app funnels engine. NOT per-trade, NOT per-offer.
- **Segmentation via leadMeta:** new `source` variant `{ kind: 'funnel', offer, funnelSlug, utm }`. `offer` = `'showcase'` (current). `funnelSlug` = the funnel (`'kitchens'`). `utm` = captured params. `interestedTradesRaw` still carries the trade name (`['Kitchen Renovation']`) for CT/SMS uniformity.
- **"Funnel = trade + offer":** `FunnelSpec` gains an `offer: string` field; the trade is the slug.
- **City source:** the **PII form** collects `city` (pre-filled, editable, from the ZIP resolution). ZIP is collected at the `location` step.
- **ZIP→city resolution:** bundled CA ZIP→city map first; **Zippopotam** (`https://api.zippopotam.us/us/<zip>`, no key, CORS-open) fallback for misses; on total failure, leave city blank for the user to type. Keep it simple.
- **Lead mode:** `customer_only` (NO auto-meeting; `scheduledFor` captured later in 2c and stored in leadMeta; a human confirms).

## Global Constraints

(Same as Plan 2a.) Named exports only; `pnpm tsc` + `pnpm lint` + runtime smoke (no test runner); `import type` top-level; braces+newline `if`; `@/`→`src/`; **pathspec-only commits on `main`** (`git commit -- <paths>`, never `git add -A`/bare commit; `git status --short` first); `shared` never imports `features`; **schemas live in `schemas/` sibling of `lib/`**; one component per file; no barrels; engine stays trade-agnostic (trade/offer data only via spec/answers); motion respects `prefers-reduced-motion`.

## File structure (this plan)

```
src/shared/entities/customers/schemas/index.ts   MODIFY — add source 'funnel' variant
src/shared/domains/funnels/
├── types.ts                          MODIFY — add `offer` to FunnelSpec; add LocationStep + PiiStep to union; add `answers` to StepProps
├── schemas/
│   └── pii.schema.ts                 CREATE — zod schema for the PII step
├── constants/
│   ├── ca-zip-cities.ts              CREATE — bundled CA ZIP→{city,county} map
│   └── kitchens.ts                   MODIFY — add location + pii steps, offer:'showcase'
├── lib/
│   ├── resolve-zip.ts                CREATE — ZIP→{city,state,county} (bundled + Zippopotam fallback)
│   ├── build-lead-input.ts           CREATE — answers+utm+spec → createFromIntake input
│   └── step-registry.ts              MODIFY — register 'location' + 'pii-form'
├── hooks/
│   └── use-funnel-utm.ts             CREATE — capture utm_*/fbclid/gclid on mount, persisted
└── ui/steps/
    ├── location-step.tsx             CREATE — ZIP input + "checking…" + "qualifies"
    └── pii-form-step.tsx             CREATE — RHF form + consent + createFromIntake submit
scripts/seed-lead-sources.ts          MODIFY — add branded-meta-ads source
```

---

### Task 1: Extend `leadMetaJSON` with the `funnel` source variant

**Files:**
- Modify: `src/shared/entities/customers/schemas/index.ts`

**Interfaces:**
- Produces: a third `source` discriminated-union variant `kind: 'funnel'` on `leadMetaSchema`.

- [ ] **Step 1: Add the variant** (additive — existing `bina`/`generic` rows stay valid; the column is nullable jsonb, no DB push)

In `leadMetaSchema.source`'s `z.discriminatedUnion('kind', [...])`, add:

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

- [ ] **Step 2: Type-check** — `pnpm tsc` clean (additive change; no consumer branches on `kind` exhaustively per the entity DOCS, but verify no switch breaks).

Run: `pnpm tsc 2>&1 | tail -5`. If a `source.kind` exhaustive switch errors, that's a real call site — handle the `funnel` case minimally and note it in the report.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(customers): leadMeta source 'funnel' variant (offer+funnelSlug+utm)" -- src/shared/entities/customers/schemas/index.ts
```

---

### Task 2: Extend funnel types — `offer`, `location`/`pii-form` steps, `answers` in StepProps

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`

**Interfaces:**
- Produces: `FunnelSpec.offer: string`; `LocationStep`, `PiiStep` added to `FunnelStep` union; `StepProps.answers: FunnelAnswers`; richer `StepContent` fields for these steps.

- [ ] **Step 1: Add the new step variants + spec field + StepProps.answers**

```ts
// add to the step union region
/** ZIP capture + "your area qualifies" beat. Writes zip/city/state into answers. */
export interface LocationStep extends BaseStep {
  kind: 'location'
}

/** Name/phone/email/city + consent. On submit, creates the CRM lead. */
export interface PiiStep extends BaseStep {
  kind: 'pii-form'
}

export type FunnelStep = InfoStep | CardSelectStep | LocationStep | PiiStep
```

```ts
// extend StepProps with read-only access to all accumulated answers
export interface StepProps<S extends FunnelStep = FunnelStep> {
  step: S
  content: StepContent
  /** All accumulated answers (read-only) — lets pii-form assemble the lead. */
  answers: FunnelAnswers
  value: string | string[] | null
  onChange: (value: string | string[]) => void
  onAdvance: () => void
  onBack: () => void
  isFirst: boolean
}
```

```ts
// add `offer` to FunnelSpec
export interface FunnelSpec {
  slug: FunnelSlug
  offer: string                       // 'showcase'
  content: FunnelContent
  theme: FunnelTheme
  steps: FunnelStep[]
  flow: (answers: FunnelAnswers, currentStepId: StepId) => StepId | null
  pixel: FunnelPixel
}
```

Extend `StepContent` with optional fields these steps use:

```ts
export interface StepContent {
  title: string
  subtitle?: string
  cta?: string
  options?: Record<string, OptionContent>
  /** location step */
  checkingLabel?: string        // "Checking availability in {zip}…"
  qualifiesLabel?: string       // "Your area qualifies — {spots} spots left"
  /** pii-form step */
  consent?: string              // TCPA wording
  fields?: { name?: string, phone?: string, email?: string, city?: string }
}
```

- [ ] **Step 2: Engine passes `answers`** — update `src/shared/domains/funnels/ui/funnel-engine.tsx` to pass `answers={engine.answers}` into `<StepView>`.

- [ ] **Step 3: tsc** — expect errors only in step components not yet updated; `types.ts` + engine clean.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): add offer + location/pii steps + answers in StepProps" -- src/shared/domains/funnels/types.ts src/shared/domains/funnels/ui/funnel-engine.tsx
```

---

### Task 3: UTM capture hook

**Files:**
- Create: `src/shared/domains/funnels/hooks/use-funnel-utm.ts`

**Interfaces:**
- Produces: `useFunnelUtm(slug): FunnelUtm` — reads `utm_*`/`fbclid`/`gclid` from the URL once, persists per funnel, returns the captured object. `FunnelUtm` matches the `utm` shape in Task 1.

- [ ] **Step 1: Implement** (capture-once on mount; persist so it survives the multi-step flow + refresh)

```ts
// src/shared/domains/funnels/hooks/use-funnel-utm.ts
import { useEffect } from 'react'
import { usePersistedState } from '@/shared/hooks/use-persisted-state'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'

export interface FunnelUtm {
  source: string | null
  medium: string | null
  campaign: string | null
  content: string | null
  term: string | null
  fbclid: string | null
  gclid: string | null
}

const EMPTY_UTM: FunnelUtm = {
  source: null, medium: null, campaign: null, content: null, term: null, fbclid: null, gclid: null,
}

export function useFunnelUtm(slug: FunnelSlug): FunnelUtm {
  const [utm, setUtm] = usePersistedState<FunnelUtm>(`tri-pros:funnel-utm:${slug}`, EMPTY_UTM)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const p = new URLSearchParams(window.location.search)
    const captured: FunnelUtm = {
      source: p.get('utm_source'),
      medium: p.get('utm_medium'),
      campaign: p.get('utm_campaign'),
      content: p.get('utm_content'),
      term: p.get('utm_term'),
      fbclid: p.get('fbclid'),
      gclid: p.get('gclid'),
    }
    // Only overwrite if this visit actually carries attribution params —
    // don't wipe a prior capture on an internal refresh with a clean URL.
    const hasAny = Object.values(captured).some(Boolean)
    if (hasAny) {
      setUtm(captured)
    }
  }, [setUtm])

  return utm
}
```

- [ ] **Step 2: tsc + lint + commit**

```bash
git commit -m "feat(funnels): capture utm/fbclid/gclid (persisted per funnel)" -- src/shared/domains/funnels/hooks/use-funnel-utm.ts
```

---

### Task 4: ZIP→city resolution (bundled map + Zippopotam fallback)

**Files:**
- Create: `src/shared/domains/funnels/constants/ca-zip-cities.ts`
- Create: `src/shared/domains/funnels/lib/resolve-zip.ts`

**Interfaces:**
- Produces: `CA_ZIP_CITIES: Record<string, { city: string, county: string }>`; `resolveZip(zip): Promise<{ zip, city, state, county } | null>`.

- [ ] **Step 1: Bundled CA ZIP map** — seed it with the Tri Pros service-area ZIPs (start with the SoCal coverage ZIPs; this is curated data, expand over time). Structure:

```ts
// src/shared/domains/funnels/constants/ca-zip-cities.ts
// Curated CA service-area ZIPs → city/county. Expand as coverage grows;
// unknown ZIPs fall back to the Zippopotam API in resolve-zip.ts.
export const CA_ZIP_CITIES: Record<string, { city: string, county: string }> = {
  '90001': { city: 'Los Angeles', county: 'Los Angeles' },
  '92602': { city: 'Irvine', county: 'Orange' },
  '91709': { city: 'Chino Hills', county: 'San Bernardino' },
  // … seed with the real Tri Pros service-area ZIPs (see docs/company/overview.md coverage)
}
```

> During implementation, populate from the company coverage area (`src/shared/constants/company/` + `docs/company/overview.md`). A partial map is fine — the API fallback covers gaps.

- [ ] **Step 2: Resolver with fallback** (bundled first; Zippopotam on miss; null on total failure)

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
git commit -m "feat(funnels): ZIP->city resolver (bundled CA map + zippopotam fallback)" -- src/shared/domains/funnels/constants/ca-zip-cities.ts src/shared/domains/funnels/lib/resolve-zip.ts
```

---

### Task 5: `location` step component

**Files:**
- Create: `src/shared/domains/funnels/ui/steps/location-step.tsx`

**Interfaces:**
- Consumes: `StepProps<LocationStep>`, `resolveZip` (Task 4). Writes resolved `zip`/`city`/`state` into answers via `onChange` is single-value — so this step writes multiple answer keys; see note.

> **Engine note:** `onChange` writes one `field`. The `location` step needs to persist `zip` + `city` + `state`. Simplest within the 2a contract: store a JSON-encoded composite in a single `location` answer key, OR extend the engine with a `setAnswers(patch)` multi-key setter. **Decision: add `setAnswers(patch: Partial<FunnelAnswers>)` to the engine + StepProps** (cleaner than encoding). Implement that as Step 0 here:

- [ ] **Step 0: Add `setAnswers` to the engine + StepProps**
  - `use-funnel-engine.ts`: add `setAnswers: (patch: Partial<FunnelAnswers>) => void` that merges into `answers`. Return it.
  - `types.ts` `StepProps`: add `setAnswers: (patch: Partial<FunnelAnswers>) => void`.
  - `funnel-engine.tsx`: pass `setAnswers={engine.setAnswers}`.

```ts
// in use-funnel-engine.ts
const setAnswers = useCallback((patch: Partial<FunnelAnswers>) => {
  setState(prev => ({ ...prev, answers: { ...prev.answers, ...patch } }))
}, [setState])
// add `setAnswers` to the returned object and the FunnelEngine interface
```

- [ ] **Step 1: The step** — ZIP input → on submit, show "Checking availability…" for a beat, resolve ZIP, store `zip`/`city`/`state`, show "qualifies", then advance.

```tsx
// src/shared/domains/funnels/ui/steps/location-step.tsx
import { useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { resolveZip } from '@/shared/domains/funnels/lib/resolve-zip'
import type { LocationStep, StepProps } from '@/shared/domains/funnels/types'

type Phase = 'input' | 'checking' | 'qualified'

export function LocationStepView({ content, setAnswers, onAdvance, onBack, isFirst }: StepProps<LocationStep>) {
  const [zip, setZip] = useState('')
  const [phase, setPhase] = useState<Phase>('input')

  async function handleSubmit() {
    if (!/^\d{5}$/.test(zip)) {
      return
    }
    setPhase('checking')
    const resolved = await resolveZip(zip)
    setAnswers({
      zip,
      city: resolved?.city ?? '',
      state: resolved?.state ?? 'CA',
    })
    // Brief "qualifying" beat for the casting story (always proceeds).
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
        {!isFirst ? <Button variant="ghost" onClick={onBack}>← Back</Button> : null}
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

  // qualified
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <p className="text-xl font-semibold text-primary">
        {content.qualifiesLabel ?? '✓ Great news — your area qualifies.'}
      </p>
      {/* Plan 2c replaces this with the stylized SVG region reveal. */}
      <Button size="lg" onClick={onAdvance}>{content.cta ?? 'Continue'}</Button>
    </div>
  )
}
```

- [ ] **Step 2: Register** in `step-registry.ts`: add `'location': LocationStepView as StepComponent`.

- [ ] **Step 3: tsc + lint + commit**

```bash
git commit -m "feat(funnels): location step (ZIP capture + qualify beat) + setAnswers" -- src/shared/domains/funnels/ui/steps/location-step.tsx src/shared/domains/funnels/lib/step-registry.ts src/shared/domains/funnels/hooks/use-funnel-engine.ts src/shared/domains/funnels/types.ts src/shared/domains/funnels/ui/funnel-engine.tsx
```

---

### Task 6: PII schema + `pii-form` step + lead submit

**Files:**
- Create: `src/shared/domains/funnels/schemas/pii.schema.ts`
- Create: `src/shared/domains/funnels/lib/build-lead-input.ts`
- Create: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx`

**Interfaces:**
- Consumes: `StepProps<PiiStep>`, `FunnelAnswers`, `FunnelUtm`, the `createFromIntake` mutation, `resolveZip` result already in answers.
- Produces: `piiSchema`/`PiiFormData`; `buildLeadInput(args)`; `PiiFormStepView`.

- [ ] **Step 1: PII zod schema** (zod v4 idioms: `import z from 'zod'`, `z.email()`; honeypot + consent)

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

- [ ] **Step 2: Lead-input builder** (maps answers + utm + spec → `createFromIntake` input; pure, testable by reading)

```ts
// src/shared/domains/funnels/lib/build-lead-input.ts
import type { FunnelAnswers, FunnelSpec } from '@/shared/domains/funnels/types'
import type { FunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'
import type { PiiFormData } from '@/shared/domains/funnels/schemas/pii.schema'

// trade slug → canonical Notion trade name for interestedTradesRaw (CT/SMS uniformity)
const TRADE_NAME: Record<string, string> = {
  kitchens: 'Kitchen Renovation',
  bathrooms: 'Bathroom Renovation',
  'complete-interior': 'Complete Interior Remodel',
}

export function buildLeadInput(args: {
  spec: FunnelSpec
  pii: PiiFormData
  answers: FunnelAnswers
  utm: FunnelUtm
}) {
  const { spec, pii, answers, utm } = args
  const zip = typeof answers.zip === 'string' ? answers.zip : ''
  const state = typeof answers.state === 'string' ? answers.state : 'CA'
  const campaign = utm.campaign ?? utm.source ?? `funnel:${spec.slug}`

  return {
    name: pii.name,
    phone: pii.phone,
    email: pii.email,
    city: pii.city,
    state,
    zip,
    mode: 'customer_only' as const,
    leadSourceSlug: 'branded-meta-ads',
    leadMetaJSON: {
      interestedTradesRaw: [TRADE_NAME[spec.slug] ?? spec.slug],
      originCampaign: campaign,
      source: {
        kind: 'funnel' as const,
        offer: spec.offer,
        funnelSlug: spec.slug,
        utm,
      },
    },
  }
}
```

- [ ] **Step 3: The PII step** (RHF + zodResolver, consent checkbox, honeypot, city pre-filled from answers, submit → mutation → advance)

```tsx
// src/shared/domains/funnels/ui/steps/pii-form-step.tsx
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
import type { FunnelSpec, PiiStep, StepProps } from '@/shared/domains/funnels/types'
import type { FunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'

// The engine injects spec + utm via a thin wrapper (see Task 7) so this step
// stays inside the StepProps contract while still reaching spec/utm.
interface PiiStepProps extends StepProps<PiiStep> {
  spec: FunnelSpec
  utm: FunnelUtm
}

export function PiiFormStepView({ content, answers, spec, utm, onAdvance, onBack, isFirst }: PiiStepProps) {
  const trpc = useTRPC()
  const submit = useMutation(trpc.customersRouter.business.createFromIntake.mutationOptions({
    onError: err => toast.error(err.message),
  }))

  const form = useForm<PiiFormData>({
    resolver: zodResolver(piiSchema),
    defaultValues: {
      name: '', phone: '', email: '',
      city: typeof answers.city === 'string' ? answers.city : '',
      consent: false as unknown as true,
      _honeypot: '',
    },
  })

  async function onSubmit(data: PiiFormData) {
    if (data._honeypot) {
      return
    }
    await submit.mutateAsync(buildLeadInput({ spec, pii: data, answers, utm }))
    onAdvance()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-5">
        <div className="text-center">
          <h2 className="text-2xl font-semibold">{content.title}</h2>
          {content.subtitle ? <p className="text-muted-foreground mt-1">{content.subtitle}</p> : null}
        </div>
        <fieldset disabled={form.formState.isSubmitting} className="contents disabled:opacity-95">
          <FormField control={form.control} name="name" render={({ field }) => (
            <FormItem><FormLabel>{content.fields?.name ?? 'Full name'}</FormLabel><Input {...field} /><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="phone" render={({ field }) => (
            <FormItem><FormLabel>{content.fields?.phone ?? 'Phone'}</FormLabel><Input type="tel" {...field} /><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="email" render={({ field }) => (
            <FormItem><FormLabel>{content.fields?.email ?? 'Email'}</FormLabel><Input type="email" {...field} /><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="city" render={({ field }) => (
            <FormItem><FormLabel>{content.fields?.city ?? 'City'}</FormLabel><Input {...field} /><FormMessage /></FormItem>
          )} />
          <FormField control={form.control} name="consent" render={({ field }) => (
            <FormItem className="flex items-start gap-2">
              <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
              <FormLabel className="text-muted-foreground text-xs font-normal leading-snug">{content.consent}</FormLabel>
              <FormMessage />
            </FormItem>
          )} />
          {/* honeypot */}
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
```

> Verify `toast` import path (`sonner`) and the shadcn `Checkbox`/`Form` exports during implementation. Confirm `useTRPC` is at `@/trpc/helpers`.

- [ ] **Step 4: tsc + lint + commit**

```bash
git commit -m "feat(funnels): PII schema + pii-form step + lead-input builder" -- src/shared/domains/funnels/schemas/pii.schema.ts src/shared/domains/funnels/lib/build-lead-input.ts src/shared/domains/funnels/ui/steps/pii-form-step.tsx
```

---

### Task 7: Wire spec/utm into the PII step via the engine

**Files:**
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx`
- Modify: `src/shared/domains/funnels/lib/step-registry.ts`

**Problem:** `pii-form` needs `spec` + `utm`, which aren't in the base `StepProps`. Keep the registry generic by having the engine inject them only for the pii step via a small adapter — do NOT pollute every step's contract.

- [ ] **Step 1:** In `funnel-engine.tsx`, call `const utm = useFunnelUtm(spec.slug)`. When rendering, if `engine.step.kind === 'pii-form'`, render `<PiiFormStepView … spec={spec} utm={utm} />` directly (a typed branch), else dispatch via `STEP_REGISTRY` as before. Register `'pii-form'` in the registry too (for completeness/typing) but the engine's explicit branch supplies the extra props. Document this single special-case.

```tsx
// inside FunnelEngine render, replacing the generic <StepView .../> for pii:
{engine.step.kind === 'pii-form'
  ? <PiiFormStepView step={engine.step} content={stepContent} answers={engine.answers}
      value={engine.value} onChange={engine.setAnswer} setAnswers={engine.setAnswers}
      onAdvance={engine.advance} onBack={engine.back} isFirst={engine.isFirst}
      spec={spec} utm={utm} />
  : <StepView step={engine.step} content={stepContent} answers={engine.answers}
      value={engine.value} onChange={engine.setAnswer} setAnswers={engine.setAnswers}
      onAdvance={engine.advance} onBack={engine.back} isFirst={engine.isFirst} />}
```

- [ ] **Step 2:** Register `'pii-form': PiiFormStepView as StepComponent` in `step-registry.ts` (so the union stays exhaustive even though the engine special-cases it).

- [ ] **Step 3: tsc + lint + commit**

```bash
git commit -m "feat(funnels): inject spec+utm into pii step via engine adapter" -- src/shared/domains/funnels/ui/funnel-engine.tsx src/shared/domains/funnels/lib/step-registry.ts
```

---

### Task 8: Seed the `branded-meta-ads` lead source

**Files:**
- Modify: `scripts/seed-lead-sources.ts`

- [ ] **Step 1:** Add an entry (mirror the existing rows' shape — `name` + `formConfigJSON`; slug auto-derives to `branded-meta-ads`; token auto-generates; skips if slug exists):

```ts
{ name: 'Branded Meta Ads', /* formConfigJSON: mirror an existing customer_only entry */ },
```

> Inspect the existing entries' `formConfigJSON` shape and replicate the minimal `customer_only` config (the funnel doesn't use the hosted `/intake` form UI, but the row must exist for `createFromIntake` slug resolution).

- [ ] **Step 2: Run the seed against the DEV DB**

Run: `pnpm tsx scripts/seed-lead-sources.ts` (the script is idempotent — skips existing slugs). Confirm output reports `branded-meta-ads` inserted.

> Per project rules: dev DB only. If the script targets prod by default, run the dev-targeted variant (check how other seeds gate env, e.g. `DRIZZLE_TARGET=dev` / `NODE_ENV`). Do NOT seed prod.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(funnels): seed 'Branded Meta Ads' lead source" -- scripts/seed-lead-sources.ts
```

---

### Task 9: Add location + PII to the kitchen flow + end-to-end smoke

**Files:**
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`

- [ ] **Step 1:** Set `offer: 'showcase'`; extend `steps` + `STEP_ORDER` to `hero → layout → ownership → location → pii`; add `content.steps.location` and `content.steps.pii` (incl. the TCPA `consent` string and the `checkingLabel`/`qualifiesLabel`).

```ts
// additions to kitchensFunnel
offer: 'showcase',
// steps: add after 'ownership'
{ id: 'location', kind: 'location' },
{ id: 'pii', kind: 'pii-form' },
// STEP_ORDER: ['hero','layout','ownership','location','pii']
// content.steps additions:
location: {
  title: 'Where is your home?',
  subtitle: 'We select Showcase homes by area.',
  cta: 'Check my area',
  checkingLabel: 'Checking availability in {zip}…',
  qualifiesLabel: '✓ Great news — your area qualifies. Limited spots remain.',
},
pii: {
  title: 'Where should we send your Showcase details?',
  cta: 'See if I qualify',
  consent: "By submitting, I agree Tri Pros Remodeling may contact me by call, text, and email about my project. Consent isn't a condition of purchase. Msg/data rates may apply. See our Privacy Policy.",
  fields: { name: 'Full name', phone: 'Phone', email: 'Email', city: 'City' },
},
```

- [ ] **Step 2: tsc + lint**

Run: `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 3: End-to-end runtime smoke (dev)** — in a browser at `http://kitchens.localhost:3000/`:
  1. hero → layout → own/rent → **ZIP step**: enter a CA ZIP → "Checking…" beat → "qualifies" → Continue.
  2. **PII**: city is pre-filled from the ZIP; fill name/phone/email, check consent, submit.
  3. Confirm the mutation succeeds (network 200) and a **customer row is created in the DEV DB** with `leadSourceSlug` resolving to `branded-meta-ads`, `leadMetaJSON.source.kind === 'funnel'`, `offer: 'showcase'`, `funnelSlug: 'kitchens'`, `interestedTradesRaw: ['Kitchen Renovation']`, and UTM captured if the URL had `?utm_source=…`.
  4. Verify via a quick dev query or the dashboard lead-sources/customer view.
  5. Refresh mid-flow (e.g. on PII) → resumes on PII (2a persistence still holds with the new steps).

Record evidence (network status, the created customer's leadMeta) in the report.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(funnels): kitchen flow through PII -> creates Branded Meta Ads lead" -- src/shared/domains/funnels/constants/kitchens.ts
```

---

## Out of scope for Plan 2b (later plans)

- Enrichment card-selects (age/scope/timeline), `datetime` (preferred appointment → `scheduledFor`), `confirmation` (portfolio before/afters), and the **stylized SVG region map** on the location step — **Plan 2c**.
- Meta Pixel `Lead`/`Schedule` + CAPI dual-fire (the `Lead` event mounts on this PII submit) — **Plan 3**.
- Bathroom / complete-interior specs — **Plan 4**. Trade icons, accent tuning, polish — **Plan 5**.

## Self-Review

- **Spec coverage:** lead created at PII (Task 6,9) ✅ [product §2 lead-first]; routes through `customerIntakeService`/`createFromIntake` (Task 6 builder + mutation) ✅ [§5]; single `branded-meta-ads` source + funnel metadata (Tasks 1,8, builder) ✅ [locked decision]; UTM/click-id capture → leadMeta (Tasks 1,3, builder) ✅ [§7.4]; `customer_only` no-auto-meeting (builder `mode`) ✅ [§2]; TCPA consent on PII (Task 6 schema + Task 9 content) ✅ [§8]; ZIP→city resolution + pre-fill (Tasks 4,5,6) ✅; refresh-resume preserved (Task 9 smoke) ✅ [§7.3]. Deferred-with-note: `Schedule`/datetime + confirmation (2c), pixel/CAPI (3), SVG map (2c).
- **Placeholder scan:** none — concrete code/commands throughout. The CA ZIP map is explicitly a curated, expandable dataset (with API fallback), not a placeholder.
- **Type consistency:** `source.kind:'funnel'` shape (Task 1) matches `buildLeadInput`'s emitted object (Task 6) and `FunnelUtm` (Task 3); `FunnelSpec.offer` (Task 2) read by builder (Task 6) + set by kitchen spec (Task 9); `setAnswers` added in Task 5 Step 0 to engine + StepProps + engine render, consumed by location step; `createFromIntake` input matches the recon'd zod schema (`name,phone,address?,city,state?,zip,email?,mode,leadSourceSlug?,leadMetaJSON?`).
- **Risk flagged:** Task 7 is the one place the generic step contract is special-cased (pii needs spec+utm) — documented and contained to the engine.
