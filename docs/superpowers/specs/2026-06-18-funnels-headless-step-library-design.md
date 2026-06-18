# Funnels — Headless Step Library Design

**Status:** Design input for the engine session (feeds Plan 2b/2c). Not yet planned into tasks.
**Owner:** Oliver P
**Audience:** The session building the funnel engine + step kinds.
**Relationship:** Additive to what Plan 2a landed (`src/shared/domains/funnels/`). Nothing here replaces the engine, the `StepProps` contract, or the `kind → component` registry — it extends them.

> **Read this for the *why*, not just the *what*.** Each section states the problem first, then the proposed solution, so the engine session can adapt the mechanics while preserving the intent.

---

## 0. The intent (in the owner's words)

Every funnel (kitchen, bathroom, complete-interior) shares a spine: a hero, a ZIP step, a PII form, a confirmation. Those steps are **"basic funnel truths"** — the funnel engine already provides the behavior; they should exist as **reusable building blocks** that slot into any funnel. A funnel author should be able to either:

- **instantiate** a bespoke step inline in the funnel's config (e.g. the kitchen-specific layout cards), **or**
- **import** a predefined step from a shared library (e.g. ZIP, PII) and drop it in.

These steps are **headless**: the functionality is already there (state, navigation, persistence, validation); only the **UI is customizable** to fit each funnel's design. Customization should usually be just CSS/theme; swapping the actual markup is the escape hatch.

The rest of this doc translates that intent into seams on top of the landed engine.

---

## 1. What Plan 2a already gives us (the baseline)

The landed code already realizes most of the headless model — worth naming so we build on it, not around it:

- **Headless behavior** lives in `useFunnelEngine` (`hooks/use-funnel-engine.ts`): it owns `{ currentStepId, history, answers }`, exposes `value / setAnswer / advance / back / reset`, persists via `usePersistedState` (refresh-resume), and computes the next step from `spec.flow(answers, currentStepId)`. A step never implements any of this.
- **Steps are data + a shared component.** A step in `spec.steps` is a plain object (`{ id, kind, field, optionIds }`); the UI for each `kind` lives once in `STEP_REGISTRY` (`lib/step-registry.ts`). The engine shell (`ui/funnel-engine.tsx`) dispatches `STEP_REGISTRY[step.kind]` and feeds it `StepProps`.
- **Content is data** in `spec.content.steps[stepId]` (`types.ts` → `StepContent`).

So "headless behavior + reusable component per kind" is **done**. The gaps are about (A) *packaging* reusable steps for slot-in, (B) *swapping* their UI per funnel, and (C) *generalizing the answer model* so non-card steps (ZIP, PII) fit.

---

## 2. Seam A — a predefined step library

### Why

Today a reusable step is split across two places: the step **object** in `spec.steps[]` and its **copy** in `spec.content.steps[id]`. For a shared step like ZIP, every funnel would re-declare both — the object *and* "Enter your ZIP" copy. That's duplication of a "basic funnel truth," and it contradicts the intent that the step "already has everything." It also has no single home to import from.

### Proposed solution

A shared step library where each predefined step is a **self-contained bundle of data + default content**:

```ts
// shared/domains/funnels/constants/steps/zip.ts
export const ZIP_STEP: StepDefinition = {
  step: { id: 'zip', kind: 'location', field: 'zip' },
  defaultContent: { title: 'Where is the project?', subtitle: 'Enter your ZIP code.' },
}

// factory for the rare repeated / parameterized case
export function zipStep(overrides?: Partial<…>): StepDefinition { … }
```

A funnel composes by **mixing library bundles with bespoke ones** — both yield the same shape, which is exactly the owner's "instantiate inline OR import from library":

```ts
steps: composeSteps([
  HERO_STEP,           // library
  kitchenLayoutStep,   // bespoke, inline in kitchens.ts
  ZIP_STEP,            // library
  PII_STEP,            // library
  CONFIRMATION_STEP,   // library
])
```

`composeSteps()` splits the bundles into the engine's existing `steps[]` + a merged `content.steps{}`, applying **defaults-with-override**: the library default copy fills in; the funnel overrides only what it chooses. (This is the codebase's established `defaults-with-override` principle — sensible defaults + explicit local override, never strict inheritance with no escape hatch.)

**Net:** the engine's runtime shape (`spec.steps` + `spec.content.steps`) is unchanged — `composeSteps` produces it. The library + bundling is a new authoring layer, not an engine change.

---

## 3. Seam B — a UI-override seam (headless, customizable UI)

### Why

`STEP_REGISTRY` is `kind → exactly one component`, so every funnel renders a given kind identically; the only per-funnel variation today is theme/CSS vars + copy. The intent explicitly wants the UI **customizable per funnel** while the behavior stays shared. Most of the time that's just restyling — but some funnels will need genuinely different markup for the same behavior (a different hero, a different card layout). There's no seam for that yet.

### Proposed solution

Keep the default `kind → component` registry, but let a spec optionally override, resolved in the engine shell:

```
StepView = step.component
        ?? spec.stepComponents?.[step.kind]
        ?? STEP_REGISTRY[step.kind]
```

- **Default path** (unchanged): shared component, restyled via the `data-funnel={slug}` attribute + CSS vars already stamped in `funnel-engine.tsx`. This is the common case — no override, just theme.
- **Escape hatch:** a funnel supplies a custom component that **still consumes `StepProps`**, so all the engine's headless wiring (value, `advance`, `back`, persistence) is intact — only the markup changes. This is "headless" in the Radix/Headless-UI sense: logic shared, presentation swappable.

**Net:** one resolution line in the engine shell + two optional fields (`step.component`, `spec.stepComponents`). Fully backward-compatible — funnels that override nothing behave exactly as today.

---

## 4. Seam C — generalize the field / answer model

### Why (this is the one that will strain the landed code)

The engine currently hardcodes the answer key to one kind:

```ts
// use-funnel-engine.ts:45
const field = step.kind === 'card-select' ? step.field : null
```

and `value` is a single `string | string[]`. That holds for `card-select`, and is fine for `location` (single ZIP field) once `field` is read generically. But it **breaks for PII**, which is a *composite* step writing **multiple** answer keys (name, email, phone) — the single-`value` contract can't represent that. If we don't address it now, the PII step will either hack around the engine or force an awkward retrofit mid-flight.

### Proposed solution

1. Lift optional `field` onto `BaseStep` so the engine reads it generically (`'field' in step ? step.field : null`) instead of switching on `kind`. ZIP/location then needs no special-casing.
2. Add `setAnswers(partial: FunnelAnswers)` to the headless contract (engine + `StepProps`) for **composite** steps. A PII step manages its own sub-fields and writes several answer keys at once via `setAnswers`, while still getting `advance` / `back` / persistence from the engine. Single-field steps keep using `value` / `onChange`.

**Net:** the headless contract grows by one method; the single-value steps are unaffected. Validation (zod + react-hook-form, already in the Plan 2a tech-stack note) lives inside the composite step component; the engine stays validation-agnostic.

---

## 5. What a funnel spec looks like after

```ts
export const kitchensFunnel: FunnelSpec = {
  slug: 'kitchens',
  steps: composeSteps([HERO_STEP, kitchenLayoutStep, ZIP_STEP, PII_STEP, CONFIRMATION_STEP]),
  flow: linearFlow,            // or a branching fn — the "tap X → reveal Y" logic, as code
  content: { /* hero copy + only the per-step overrides this funnel wants */ },
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'kitchen' },
}
```

Kitchen-specific steps are inline; ZIP / PII / hero / confirmation come from the library — headless, restyled by theme, overridable where needed. Adding a new funnel is mostly "pick steps from the library + write the trade-specific ones."

---

## 6. Two decisions for the owner (recommendations noted)

1. **Content co-location.** Bundle each library step's default copy *with* the step (§2) and merge per-funnel overrides — so a slot-in step "already has everything"? **Recommended.** Alternative: keep content fully separate in `spec.content.steps` and accept re-declaring copy per funnel.
2. **PII / multi-field shape.** Composite step writing several answer keys via `setAnswers` + `field` on `BaseStep` (§4)? **Recommended.** Alternative: force everything through the single-`value` contract (will get awkward fast).

---

## 7. Coordination / how this maps to the plan

- This is **Plan 2b/2c territory** — Plan 2a's own file-structure note defers "remaining step kinds (location, pii-form, datetime, confirmation)" to 2b/2c. Seams A–C are the foundation those kinds need.
- All three seams **extend** the landed `types.ts` / `step-registry.ts` / `funnel-engine.tsx` / `use-funnel-engine.ts` — none replace them. Backward-compatible: a funnel that uses no library steps, no component overrides, and only single-value steps behaves exactly as Plan 2a does today.
- **Shared working tree:** the engine session and other sessions commit to `main` in the same checkout. Whoever implements these seams should touch the engine files in one focused pass (pathspec commits) to avoid colliding with concurrent work.
