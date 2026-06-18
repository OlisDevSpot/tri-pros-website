# FunnelSpec & Step Model — Foundational Type Design

**Status:** Approved design. Supersedes parts of the headless-step-library doc (see §9). **Must land before Plans 2b/2c are re-cut** (they currently encode the anti-patterns this design removes).
**Owner:** Oliver P
**Audience:** The session hardening the funnel engine type model, and whoever re-cuts Plans 2b/2c afterward.
**Relationship:** Hardens what Plan 2a landed (`src/shared/domains/funnels/`). Keeps the landed discriminated-union + mapped-registry plumbing; replaces the kitchen-sink content type, the single-value answer channel, and the (planned) pii engine special-case.

> **Read this for the *why*.** Each decision states the problem first. The model is foundational: get `FunnelSpec` wrong and every downstream step/plan inherits awkward workarounds.

---

## 0. Why this exists

`FunnelSpec` is the central, trade-aware type the whole funnels engine consumes. Plan 2a landed a sound spine (discriminated-union steps + a mapped-type `kind → component` registry + a static exhaustive funnel registry). But three structural gaps remained, and **Plans 2b/2c already work around them with anti-patterns**:

1. **Kitchen-sink content.** One flat `StepContent` carries `title/subtitle/cta/options` and 2b/2c pile on `checkingLabel/qualifiesLabel` (location) + `consent/fields` (pii). Any field is allowed on any kind — a `card-select`'s content can hold `consent`.
2. **Single-value answer channel.** `value: string | string[]` + `onChange` can't model composite answers (location writes zip+city+state; pii writes a created lead id), so 2b bolts on a parallel `setAnswers(patch)` setter — two ways to write an answer.
3. **The pii step needs funnel-level context** (offer, slug, captured UTM) to build the CRM lead, so 2b Task 7 **special-cases the engine**: `if (step.kind === 'pii-form') render it with extra props`. The plan's own self-review admits this is "the one place the generic step contract is special-cased."

This design closes all three at the root, so 2b/2c become straight feature work with no engine workarounds.

### The four goals (each must be structurally enforced, not just documented)

1. **Per-kind type safety** — each kind owns its content + answer shape; no shared bag.
2. **Zero engine special-cases** — the engine dispatches every kind through one uniform path.
3. **Self-contained, importable step units** — a reusable step (ZIP, PII) is one typed object carrying behavior + default copy + answer shape: "import it, it has everything."
4. **No stringly content/structure split, no hero duplication.**

### How we got here (research)

Three independent reviews (codebase-idiom, external best-practices, type-system rigor) converged on the model below. Two findings reshaped it:

- The type-rigor reviewer **compiled the landed code** and confirmed the discriminated-union + mapped-type registry (`StepRegistry = { [K in StepKind]: StepComponentFor<K> }`) is **provably sound** (wrong-kind slot → compile error; missing kind → compile error) and is a faithful copy of a **blessed in-repo precedent**: `src/shared/components/query-toolbar/lib/filter-renderer-registry.tsx`. So the landed shape is the right foundation — keep it.
- The codebase-idiom reviewer confirmed this repo expresses static config as **`as const satisfies` literals** (`MEETING_ACTIONS`, `proposalServerSpec`) and reserves `createX`/`defineX` for things that **compute runtime behavior** (`createCrudDal`, `createEntityRouter`). So: **no `defineStepKind()`/`step()` factory** — plain literals + `satisfies`.

An earlier exploratory baseline (a `StepKindDef` + `step(def, …)` factory + `StepInstance { config: unknown }`) was **rejected** — it erased per-step types and leaned on a load-bearing cast, a regression from what already landed.

---

## 1. The model

Six concepts. Content and answer are **correlated to the step's `kind` via lookup interfaces**, so the discriminant carries type information end-to-end.

```ts
import type { ComponentType } from 'react'
import type { FunnelSlug } from '@/shared/domains/funnels/constants/slugs'
import type { FunnelUtm } from '@/shared/domains/funnels/hooks/use-funnel-utm'

export type StepId = string

// ── 1. ANSWER: one typed slot per step, keyed by step id. Composites are objects. ──
export interface LocationAnswer { zip: string, city: string, state: string, county: string | null }
export interface PiiAnswer { leadId: string }          // what the pii step writes back after createFromIntake

/** kind → that kind's answer shape. `never` = the step takes no input (hero/info). */
export interface AnswerByKind {
  'info': never
  'card-select': string
  'location': LocationAnswer
  'pii-form': PiiAnswer
  // 2c: 'datetime': DatetimeAnswer; 'confirmation': never
}
export type AnswerOf<S extends FunnelStep> = AnswerByKind[S['kind']]

/** Runtime answer store: loosely typed (ids are dynamic). Strong typing happens
 *  at the component boundary (AnswerOf<S>) and via the opt-in AnswersOf<> view (§5). */
export type AnswerValue = string | string[] | LocationAnswer | PiiAnswer | null
export type FunnelAnswers = Partial<Record<StepId, AnswerValue>>

// ── 2. CONTENT: per kind. No shared StepContent bag. ──
export interface HeroContent { headline: string, subhead: string, scarcityLine: string, cta: string }
export interface CardSelectContent { title: string, subtitle?: string, options: Record<string, OptionContent> }
export interface LocationContent { title: string, subtitle?: string, cta?: string, checkingLabel?: string, qualifiesLabel?: string }
export interface PiiContent { title: string, subtitle?: string, cta?: string, consent: string, fields: PiiFieldLabels }
export interface OptionContent { label: string, icon?: string, description?: string }
export interface PiiFieldLabels { name?: string, phone?: string, email?: string, city?: string }

export interface ContentByKind {
  'info': HeroContent
  'card-select': CardSelectContent
  'location': LocationContent
  'pii-form': PiiContent
}
export type ContentOf<S extends FunnelStep> = ContentByKind[S['kind']]

// ── 3. STEP: a discriminated union. `content` is a TYPED field on each variant. ──
interface BaseStep<K extends string> { id: StepId, kind: K }
export interface InfoStep       extends BaseStep<'info'>        { content: HeroContent }
export interface CardSelectStep extends BaseStep<'card-select'> { optionIds: string[], content: CardSelectContent }
export interface LocationStep   extends BaseStep<'location'>    { content: LocationContent }
export interface PiiStep        extends BaseStep<'pii-form'>    { content: PiiContent }

export type FunnelStep = InfoStep | CardSelectStep | LocationStep | PiiStep
export type StepKind = FunnelStep['kind']

// ── 4. CONTEXT + uniform StepProps. `ctx` is what kills the pii special-case. ──
export interface FunnelContext {
  slug: FunnelSlug
  offer: string
  theme: FunnelTheme
  utm: FunnelUtm
}

export interface StepProps<S extends FunnelStep = FunnelStep> {
  step: S
  content: ContentOf<S>
  value: AnswerOf<S> | null
  setValue: (answer: AnswerOf<S>) => void   // ONE typed channel — replaces onChange + setAnswers
  answers: FunnelAnswers                    // read-only access to all accumulated slots
  ctx: FunnelContext                        // pii reads ctx.utm/offer/slug HERE — no engine branch
  advance: () => void
  back: () => void
  isFirst: boolean
}
export type StepComponentFor<K extends StepKind> = ComponentType<StepProps<Extract<FunnelStep, { kind: K }>>>
export type StepRegistry = { [K in StepKind]: StepComponentFor<K> }

// ── 5. FunnelSpec: ordered steps + branching + metadata. No content map; hero is steps[0]. ──
export interface FunnelTheme { accent: string }
export interface FunnelPixel { contentCategory: string }

export interface FunnelSpec {
  slug: FunnelSlug
  offer: string            // 'showcase' — funnel = trade (slug) + offer
  title: string            // document/SEO title (the only funnel-level "content" left)
  theme: FunnelTheme
  pixel: FunnelPixel
  steps: FunnelStep[]      // discriminated-union instances; steps[0] is the hero
  flow?: (answers: FunnelAnswers, currentStepId: StepId) => StepId | null  // optional; engine defaults to linear
}
```

### How each goal is enforced

| Goal | Mechanism |
|---|---|
| 1 — per-kind type safety | `ContentByKind`/`AnswerByKind` correlate content & answer to the discriminant; `CardSelectContent` cannot hold `consent`. |
| 2 — no engine special-cases | `ctx` is on every step's props, so pii reads `ctx.utm/offer/slug` itself; the engine renders all kinds through one `renderStep<K>` (§3). The 2b Task-7 branch is deleted. |
| 3 — self-contained units | A library step is a prebuilt typed object (`export const ZIP_STEP: LocationStep = {…}`) with default copy baked in; import + spread-override. |
| 4 — no split / no hero dup | `content` rides each step (typed); the separate `content.copy` map and the `funnelContent.title/headline/…` block are deleted; hero is a normal `InfoStep` whose `content` is the hero copy. |

---

## 2. Answers: one typed slot per step id

- The engine writes `answers[step.id] = value`. **Keying is uniform by step id** — the landed `field`-on-`card-select` concept is removed (it made the answer key sometimes `field`, sometimes a hardcoded string, defeating "one slot per step").
- Composite answers are **objects** (`LocationAnswer`, `PiiAnswer`) stored under the one slot — no multi-key `setAnswers`.
- At the component boundary, `value`/`setValue` are typed to `AnswerOf<S>`. The global `FunnelAnswers` map stays loosely typed (ids are dynamic strings) — strong reads happen via the opt-in view in §5.

Example store after the kitchen flow:
```ts
{
  layout: 'l-shape',
  ownership: 'own',
  location: { zip: '92602', city: 'Irvine', state: 'CA', county: 'Orange' },
  pii: { leadId: 'uuid' },
}
```

---

## 3. Engine dispatch: uniform and cast-free

The engine resolves the component from the mapped registry and renders through a **single generic helper** that ties `step` and `component` to the same `K` — no `as` cast leaking per-kind types:

```ts
function renderStep<K extends StepKind>(step: Extract<FunnelStep, { kind: K }>, rest: Omit<StepProps, 'step' | 'content' | 'value' | 'setValue'> & { engine: Engine }) {
  const View = STEP_REGISTRY[step.kind]                 // StepComponentFor<K> — exact, no widening
  return <View step={step} content={step.content} value={rest.engine.answers[step.id] ?? null}
               setValue={a => rest.engine.setAnswer(step.id, a)} answers={rest.engine.answers}
               ctx={rest.ctx} advance={rest.engine.advance} back={rest.engine.back} isFirst={rest.engine.isFirst} />
}
```

`ctx` is assembled in the engine shell: `const utm = useFunnelUtm(spec.slug); const ctx = { slug: spec.slug, offer: spec.offer, theme: spec.theme, utm }`. Every step — including pii — receives it identically.

> If the generic helper proves fiddly against `ComponentType` contravariance during implementation, the documented fallback is **one** localized cast at this single dispatch seam (the same single-cast tradeoff the landed code and ADR-0002's framework-boundary casts already accept) — never a per-kind branch.

---

## 4. Flow: optional, linear by default

`flow?` is optional. When omitted, the engine advances to the next step in `steps[]` order (`defaultLinearNext`, already landed). Branching funnels supply `flow`; it reads `answers` and returns the next step id or `null` to end. No `STEP_ORDER` parallel array (already removed in the 2a cleanup).

---

## 5. Typed answer reads at the boundary (opt-in, not engine-wide)

The engine stays loosely typed internally (it shuttles opaque `AnswerValue`s). For the two places where a typo is costly — branching `flow` and the lead builder — authors opt into a typed **view** derived from the funnel's steps, without genericizing the engine/registry/`getFunnel`:

```ts
const KITCHEN_STEPS = [/* … */] as const satisfies readonly FunnelStep[]

export type AnswersOf<Steps extends readonly FunnelStep[]> = {
  [S in Steps[number] as S['id']]?: AnswerOf<S>
}

// kitchens.ts — typed flow author site
export const kitchenFlow = (a: AnswersOf<typeof KITCHEN_STEPS>, current: StepId): StepId | null =>
  current === 'ownership' && a.ownership === 'rent' ? null : defaultLinearNext(KITCHEN_STEPS, current)
//                                  ^ typed: 'l-shape'|'own'|…; `a.onwership` (typo) errors
```

`build-lead-input` reads `answers.location?.city`, `answers.pii?.leadId` through the same typed view. **We do not** thread `<Steps>` through `FunnelSpec`/`useFunnelEngine`/the registry — that readability tax buys nothing the engine needs.

---

## 6. Self-contained, reusable steps

A reusable step is a **prebuilt typed object** exported from the step's own file; default copy is baked in; a funnel overrides via object spread (defaults-with-override, no machinery):

```ts
// ui/steps/location-step.tsx — the self-contained unit
export interface LocationContent { /* … as above */ }
export function LocationStepView(props: StepProps<LocationStep>) { /* reads props.ctx, props.setValue({zip,city,state,county}) */ }
export const ZIP_STEP: LocationStep = {
  id: 'location', kind: 'location',
  content: { title: 'Where is your home?', subtitle: 'We select Showcase homes by area.', cta: 'Check my area',
             checkingLabel: 'Checking availability in {zip}…', qualifiesLabel: '✓ Your area qualifies — limited spots remain.' },
}

// kitchens.ts — import + spread-override only what differs
{ ...ZIP_STEP, content: { ...ZIP_STEP.content, subtitle: 'Showcase kitchens are selected by neighborhood.' } }
```

The pii step is self-contained the same way: it owns its `react-hook-form` + zod schema internally, reads `ctx.offer/slug/utm` + `answers` (to pre-fill city from the location answer), calls the lead mutation **through the customers/leads entity router's public entrypoint** (entity owns its mutations — the funnel never writes lead DAL), then `setValue({ leadId })` and `advance()`. The engine stays validation-agnostic.

---

## 7. File / directory layout (obeys conventions)

One component per file; named exports only; no barrels in `ui/`/`constants/`/`lib/`/`hooks/`; `schemas/` sibling of `lib/`; `shared/` never imports `features/`.

```
src/shared/domains/funnels/
├── types.ts                    StepKind union, ContentByKind/AnswerByKind, ContentOf/AnswerOf,
│                               StepProps, StepRegistry, FunnelContext, FunnelSpec, FunnelTheme/Pixel
├── constants/
│   ├── slugs.ts                (landed)
│   ├── step-registry.ts        STEP_REGISTRY  ({ … } as const satisfies StepRegistry)
│   ├── funnel-motion.ts        (landed)
│   ├── storage-keys.ts         (landed)
│   ├── kitchens.ts | bathrooms.ts | complete-interior.ts   FunnelSpec ( satisfies FunnelSpec )
│   └── ca-zip-cities.ts        (2b)
├── lib/
│   ├── registry.ts             getFunnel(slug)  (landed)
│   ├── funnel-flow.ts          defaultLinearNext  (landed)
│   ├── resolve-zip.ts          (2b)
│   └── build-lead-input.ts     (2b) — reads AnswersOf<> view
├── schemas/
│   └── pii.schema.ts           (2b)
├── hooks/
│   ├── use-funnel-engine.ts    state machine; answers keyed by step.id; setAnswer(id, value)
│   └── use-funnel-utm.ts       (2b) — feeds ctx.utm
└── ui/
    ├── funnel-engine.tsx        shell: builds ctx, renderStep<K> dispatch
    ├── funnel-progress.tsx
    └── steps/
        ├── info-step.tsx        InfoStepView + HeroContent
        ├── card-select-step.tsx CardSelectStepView + CardSelectContent
        ├── location-step.tsx    LocationStepView + LocationContent + ZIP_STEP
        └── pii-form-step.tsx    PiiFormStepView + PiiContent + PII_STEP
```

Per-kind content/answer types live with their step component file where it keeps the unit self-contained; `types.ts` assembles the union + the `ContentByKind`/`AnswerByKind` lookups (type-only imports — no runtime cycle).

---

## 8. Migration from landed 2a

This rewrites the funnel domain's **type layer** only; blast radius is contained (only 2a landed; 2b/2c are still plans).

1. **`types.ts`** — delete `FunnelContent` + the flat `StepContent`; add per-kind content interfaces + `ContentByKind`/`AnswerByKind` + `ContentOf`/`AnswerOf`; add `FunnelContext`; move `content` onto each step variant; rewrite `StepProps` (drop `funnelContent`/`onChange`; add `content: ContentOf<S>`, `value/setValue: AnswerOf<S>`, `ctx`); `FunnelSpec` loses the content map, keeps `title`, gains nothing else (it already has `slug/theme/pixel`; add `offer`).
2. **`use-funnel-engine.ts`** — key answers by `step.id` uniformly (remove the `field` special-case); expose `setAnswer(id, value)`; keep hydration gate + history/back + `flow?`/linear default.
3. **`funnel-engine.tsx`** — call `useFunnelUtm(spec.slug)`, build `ctx`, dispatch via `renderStep<K>`; remove the `spec.content.copy[id]` lookup (content is now `step.content`).
4. **`constants/step-registry.ts`** — unchanged shape (mapped `StepRegistry`); add new kinds as they land.
5. **`constants/kitchens.ts`** — rewrite: `offer: 'showcase'`, `title`, steps carry inline `content`, hero is `InfoStep` with `HeroContent`; remove the `content.copy` map.
6. **`ui/steps/info-step.tsx`, `card-select-step.tsx`** — adapt to `StepProps<S>` (typed `content`, `value`, `setValue`, `ctx`).

After this lands, **re-cut Plans 2b/2c** against it: 2b drops Task 5 Step 0 (`setAnswers`) and Task 7 (the pii engine branch) entirely; the location/pii/datetime steps become prebuilt typed objects with composite answers.

---

## 9. Relationship to the headless-step-library doc

`docs/superpowers/specs/2026-06-18-funnels-headless-step-library-design.md` (committed `3d4c811f`) framed three seams. This design:

- **Supersedes its Seam C** (`field` on `BaseStep` + `setAnswers(partial)` multi-key setter) → replaced by **composite typed answers keyed by step id + a single `setValue`**. The single-value channel that motivated `setAnswers` is gone.
- **Reshapes its Seam A** (a `StepDefinition = { step, defaultContent }` bundle + `composeSteps()` that splits into `steps[]` + `content.steps{}`) → replaced by **prebuilt typed step objects with inline `content`**, spread-overridden. No bundling/splitting layer; no separate content map to split back into.
- **Defers its Seam B** (per-funnel `stepComponents` UI-override map) → not built now. `data-funnel` + CSS-vars covers every current funnel; add the override seam when a real second skin needs different markup for the same kind.

Keep the headless doc's *intent* (headless behavior in the engine; reusable, restylable, importable steps) — this design realizes it with less machinery.

---

## 10. Explicitly out of scope (stop-lines from the review)

- **No state-machine library (XState).** Hand-rolled reducer; the `FunnelSpec` *is* the flow declaration — a second model would drift (and trip our ping-on-staleness rule).
- **No genericizing `FunnelSpec`/`useFunnelEngine`/registry over `Steps`.** Typed reads are opt-in at `flow`/`build-lead-input` only (§5).
- **No `defineStepKind()`/`step()` factory.** `as const satisfies` literals, per house idiom.
- **No per-funnel component-override seam yet** (headless Seam B).
- **No normalized answer store / state lib, no runtime plugin registry, no CMS-driven specs.** A `useReducer` over `{ currentId, history, answers }` + typed `.ts` specs is the right weight for a 3-funnel in-house engine.

---

## 11. Self-review

- **Goals enforced structurally:** per-kind content/answer via `ContentByKind`/`AnswerByKind` (1); uniform `ctx`-carrying `StepProps` + single `renderStep<K>` (2); prebuilt typed step objects (3); inline `content` + hero-as-step, no map/dup (4). ✅
- **Anti-patterns removed at root:** kitchen-sink `StepContent` (deleted), `setAnswers` (replaced by composite `setValue`), pii engine special-case (replaced by `ctx`). ✅
- **Idiom match:** discriminated union + mapped registry mirrors `filter-renderer-registry.tsx`; `as const satisfies` literals; static exhaustive `getFunnel` registry; one documented dispatch seam at most. ✅
- **Ambiguity check:** answer keying is uniformly by `step.id` (no `field`); composite answers are objects under one slot; `ctx` is ambient and read-only to steps; `flow` typed reads are opt-in. ✅
- **Placeholder scan:** none — concrete TS throughout; 2b/2c-specific kinds (`datetime`, `confirmation`, enrichment) noted as additive lookups, not yet defined here.
- **Sequencing:** this lands before 2b/2c are re-cut (§8). ✅
