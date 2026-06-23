# Bathrooms Funnel + Engine Reusability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a second marketing funnel (bathrooms) by reusing the funnel engine, hardening the engine's reuse seams (generic + progressive enrichment, a generic customer-facing intake panel, a positioning-variant seam, and removal of kitchen-specific leaks) so funnels 2..N are "author one spec + drop assets."

**Architecture:** Phase 0 makes the engine's lead-enrichment generic, self-describing, progressively captured, and surfaced as a generic read-only customer panel; adds a `variants` landing seam; removes kitchen-default leaks; documents the convention. Phase 1 authors `bathrooms.ts` with bathroom-native questions (two of which kitchens lacks) and the blend landing, proving the seams.

**Tech Stack:** Next.js 15 (App Router), TypeScript, tRPC, Drizzle (Postgres/Neon, JSONB), Zod, React 19, motion/react, Tailwind v4, shadcn/ui.

## Global Constraints

- **Work directly on `main`.** Do NOT create feature branches. Stage files explicitly per task so unrelated WIP isn't swept in.
- **NEVER run `pnpm build`.** Verify with `pnpm tsc` (`tsc --noEmit`) and `pnpm lint` (`next lint`).
- **No DB migration / `db:push` for this work.** The enrichment shape lives *inside* the `leadMetaJSON` JSONB column; changing its Zod schema does not alter any column. Do not run `pnpm db:push` (prod) or `pnpm db:push:dev`.
- **Named exports only.** Never `export default`.
- **One React component per file.** No second component in a view/component file.
- **No file-level constants in component/view files** — extract to `constants/`. **No standalone helper functions in component files** — extract to `lib/`.
- **No barrel files** in `ui/`, `constants/`, `hooks/`, `lib/`, `dal/`.
- **Import directionality:** `shared/` never imports from `features/`. Funnel domain lives in `src/shared/domains/funnels/`.
- **Path alias:** `@/` → `src/`.
- **Verification baseline for every task:** `pnpm tsc && pnpm lint` must pass before commit. Pure-logic tasks add a throwaway `tsx -e` assertion run (this project has no unit-test runner; do not add one). UI/wiring tasks add an explicit manual/Playwright behavior check with concrete expected output.
- **Commit after each task** with a conventional-commit message; co-author trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`

---

## File Structure

**Phase 0 — engine (modify unless noted):**
- `src/shared/domains/funnels/types.ts` — add `enrichment` + `variants` to `FunnelSpec`; add `EnrichmentDimension`, `EnrichmentRecord` types.
- `src/shared/domains/funnels/lib/build-lead-enrichment.ts` — **new** pure helpers.
- `src/shared/domains/funnels/hooks/use-progressive-enrichment.ts` — **new** client hook.
- `src/shared/domains/funnels/ui/funnel-engine.tsx` — call the progressive-enrichment hook; thread `variant`.
- `src/shared/domains/funnels/ui/steps/confirmation-step.tsx` — remove enrichment firing + literal answer reads.
- `src/shared/domains/funnels/hooks/use-enrich-lead.ts` — generic patch args.
- `src/shared/domains/funnels/constants/enrichment-labels.ts` — **delete**.
- `src/shared/domains/funnels/lib/build-funnel-lead-note.ts` — rewrite generic.
- `src/trpc/routers/funnels.router.ts` — generic `enrichFunnelLead` input; rate-limit headroom.
- `src/shared/services/customer-intake.service.ts` — drop per-enrich note; add creation-time note.
- `src/shared/entities/customers/schemas/index.ts` — generic `enrichment` shape.
- `src/shared/entities/customers/constants/funnel-intake-fields.ts` — **new** (no file-level consts in components).
- `src/shared/entities/customers/components/profile/funnel-intake-panel.tsx` — **new** read-only panel.
- `src/shared/entities/customers/components/profile/customer-profile-details.tsx` — mount the panel.
- `src/app/(frontend)/funnels/[trade]/page.tsx` — read `?v=` variant param.
- `src/shared/domains/funnels/ui/funnel-landing.tsx` — variant block resolution.
- `src/shared/domains/funnels/ui/blocks/callout-block.tsx`, `before-after-showcase.tsx` — remove kitchen defaults.
- `src/shared/domains/funnels/constants/kitchens.ts` — declare `enrichment` (migration).
- `src/shared/domains/funnels/DOCS.md` — document convention + checklist.

**Phase 1 — bathrooms:**
- `src/shared/domains/funnels/constants/bathrooms.ts` — full spec (replace stub).
- `public/funnels/bathrooms/**` — assets via optimize-image-assets.

---

## Phase 0 — Engine pattern improvements

### Task 1: Generic enrichment + variants types

**Files:**
- Modify: `src/shared/domains/funnels/types.ts`

**Interfaces:**
- Produces: `EnrichmentDimension = { stepId: StepId, label: string }`; `EnrichmentEntry = { label: string, value: string, order: number }`; `EnrichmentRecord = Record<string, EnrichmentEntry>`; `FunnelSpec.enrichment?: EnrichmentDimension[]`; `FunnelSpec.variants?: Record<string, { blocks: MarketingBlock[] }>`.

- [ ] **Step 1: Add the enrichment + variant types and extend `FunnelSpec`**

In `src/shared/domains/funnels/types.ts`, add near the `FunnelSpec` block (after `FunnelPixel`):

```ts
/** A funnel dimension whose selected answer enriches the lead. */
export interface EnrichmentDimension { stepId: StepId, label: string }
/** One captured dimension, self-describing for display (no server label mirror). */
export interface EnrichmentEntry { label: string, value: string, order: number }
/** Captured enrichment keyed by step id — JSONB-merge-safe (object, not array). */
export type EnrichmentRecord = Record<string, EnrichmentEntry>
```

Then extend `FunnelSpec`:

```ts
export interface FunnelSpec {
  slug: FunnelSlug
  offer: string
  title: string
  hero: HeroContent
  theme: FunnelTheme
  pixel: FunnelPixel
  /** Optional landing block list; falls back to DEFAULT_LANDING_BLOCKS when absent. */
  landing?: { blocks: MarketingBlock[] }
  /** Alternate landing block sets selectable via `?v=` / UTM content. Steps + measurement unchanged. */
  variants?: Record<string, { blocks: MarketingBlock[] }>
  /** Steps whose answers enrich the lead, in display order. */
  enrichment?: EnrichmentDimension[]
  steps: FunnelStep[]
  flow?: (answers: FunnelAnswers, currentStepId: StepId) => StepId | null
}
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm tsc`
Expected: PASS (no errors). `enrichment`/`variants` are optional, so existing specs still typecheck.

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/types.ts
git commit -m "feat(funnels): add generic enrichment + variants types to FunnelSpec

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pure enrichment-building helpers

**Files:**
- Create: `src/shared/domains/funnels/lib/build-lead-enrichment.ts`

**Interfaces:**
- Consumes: `FunnelSpec`, `FunnelAnswers`, `EnrichmentRecord` (Task 1); `CardSelectStep` content options (`types.ts`).
- Produces:
  - `buildLeadEnrichment(spec: FunnelSpec, answers: FunnelAnswers): EnrichmentRecord` — full record of all currently-answered declared dimensions.
  - `enrichmentSignature(record: EnrichmentRecord): string` — stable key for diffing sent state.

- [ ] **Step 1: Write the helper**

`buildLeadEnrichment` walks `spec.enrichment`, and for each dimension whose step is a `card-select` with a selected option, resolves the human label from the step's `content.options[selectedId].label`. Only card-select answers (plain string ids) are enrichable; non-card answers are skipped.

```ts
import type { CardSelectStep, EnrichmentRecord, FunnelAnswers, FunnelSpec } from '@/shared/domains/funnels/types'

/** True when a step contributes a selectable, label-resolvable answer. */
function isCardSelect(step: FunnelSpec['steps'][number]): step is CardSelectStep {
  return step.kind === 'card-select'
}

/**
 * Build the full enrichment record from currently-answered declared dimensions.
 * Self-describing: stores the option's human label as `value` so no server-side
 * label mirror is needed. `order` is the dimension's index in `spec.enrichment`.
 */
export function buildLeadEnrichment(spec: FunnelSpec, answers: FunnelAnswers): EnrichmentRecord {
  const dims = spec.enrichment ?? []
  const out: EnrichmentRecord = {}
  dims.forEach((dim, order) => {
    const step = spec.steps.find(s => s.id === dim.stepId)
    if (!step || !isCardSelect(step)) {
      return
    }
    const selectedId = answers[dim.stepId]
    if (typeof selectedId !== 'string') {
      return
    }
    const label = step.content.options[selectedId]?.label
    if (!label) {
      return
    }
    out[dim.stepId] = { label: dim.label, value: label, order }
  })
  return out
}

/** Stable signature for diffing what has already been persisted. */
export function enrichmentSignature(record: EnrichmentRecord): string {
  return Object.keys(record)
    .sort()
    .map(k => `${k}=${record[k].value}`)
    .join('|')
}
```

- [ ] **Step 2: Verify the helper with a throwaway assertion run**

Run (single line; this is the project's pure-logic check pattern — nothing committed):

```bash
pnpm exec tsx -e "
import { buildLeadEnrichment, enrichmentSignature } from './src/shared/domains/funnels/lib/build-lead-enrichment.ts'
const spec: any = {
  enrichment: [{ stepId: 'whichBathroom', label: 'Which bathroom' }, { stepId: 'scope', label: 'Scope' }],
  steps: [
    { id: 'whichBathroom', kind: 'card-select', optionIds: ['primary'], content: { title: '', options: { primary: { label: 'Primary / ensuite' } } } },
    { id: 'scope', kind: 'card-select', optionIds: ['walk-in'], content: { title: '', options: { 'walk-in': { label: 'Walk-in shower' } } } },
  ],
}
const r = buildLeadEnrichment(spec, { whichBathroom: 'primary' })
console.assert(JSON.stringify(r) === JSON.stringify({ whichBathroom: { label: 'Which bathroom', value: 'Primary / ensuite', order: 0 } }), 'partial capture FAIL: ' + JSON.stringify(r))
const full = buildLeadEnrichment(spec, { whichBathroom: 'primary', scope: 'walk-in' })
console.assert(full.scope.order === 1 && full.scope.value === 'Walk-in shower', 'full capture FAIL')
console.assert(enrichmentSignature(r) === 'whichBathroom=Primary / ensuite', 'sig FAIL: ' + enrichmentSignature(r))
console.log('OK')
"
```

Expected: prints `OK` with no assertion errors.

- [ ] **Step 3: Verify compile + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/lib/build-lead-enrichment.ts
git commit -m "feat(funnels): pure buildLeadEnrichment + signature helpers

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Generic enrichment storage schema

**Files:**
- Modify: `src/shared/entities/customers/schemas/index.ts` (the `leadMetaSchema` funnel `enrichment` field, ~lines 114-137)

**Interfaces:**
- Consumes: nothing new.
- Produces: `leadMeta.source.enrichment` is now `Record<string, { label, value, order }>` (optional), tolerant of legacy by being permissive at read sites.

- [ ] **Step 1: Replace the fixed four-key enrichment with the generic record**

Find the funnel variant's `enrichment` in `leadMetaSchema` (currently):

```ts
  enrichment: z.object({
    homeType: z.string().nullable(),
    age: z.string().nullable(),
    scope: z.string().nullable(),
    timeline: z.string().nullable(),
  }).partial().optional(),
```

Replace with the generic, merge-safe keyed record:

```ts
  // Generic, self-describing enrichment keyed by step id. JSONB-merge-safe
  // (object keys merge under Postgres `||`). `value` is the resolved option
  // label so no server-side label mirror is needed; `order` drives display.
  enrichment: z.record(
    z.string(),
    z.object({ label: z.string(), value: z.string(), order: z.number().int() }),
  ).optional(),
```

> Note on legacy: existing kitchen leads carry the old flat `{ homeType: 'condo', … }` shape. `z.record(...)` would reject those if re-validated, but `leadMetaJSON` is only *read* (not re-parsed) on display; the panel + note builder (Tasks 5, 9) tolerate legacy explicitly. No migration.

- [ ] **Step 2: Verify compile**

Run: `pnpm tsc`
Expected: this WILL surface errors at the old consumers (`enrichFunnelLead` router input, `use-enrich-lead`, `confirmation-step`, `build-funnel-lead-note`). That is expected — Tasks 4–8 fix each. To keep the build green per-task, this task's commit happens after Step 3 confirms only the *schema file itself* is internally valid; the consumer errors are resolved in the immediately-following tasks. If your workflow requires green tsc per commit, implement Tasks 3–7 as one combined commit (they are a single atomic refactor of the enrichment contract).

> **Decision for the implementer:** Tasks 3–7 form one atomic contract change. Either (a) commit them together as a single "refactor enrichment contract" commit, or (b) commit per-task accepting transient tsc failures between 3 and 7. Option (a) is recommended. The steps below are written so they can be combined.

- [ ] **Step 3: Commit (or defer to combined commit — see note)**

```bash
git add src/shared/entities/customers/schemas/index.ts
# Combined-commit path: stage Tasks 3-7 files together, commit once at end of Task 7.
```

---

### Task 4: Generic `enrichFunnelLead` router input + rate-limit headroom

**Files:**
- Modify: `src/trpc/routers/funnels.router.ts` (the `enrichFunnelLead` input ~lines 159-168; `enrichRatelimit` ~line 33-37)

**Interfaces:**
- Consumes: generic enrichment record (Task 3).
- Produces: `enrichFunnelLead` accepts `{ leadId: uuid, enrichment: Record<string, { label, value, order }> }`.

- [ ] **Step 1: Bump enrich rate-limit headroom for progressive firing**

Replace:

```ts
const enrichRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'funnel:enrich',
})
```

with:

```ts
const enrichRatelimit = new Ratelimit({
  // Progressive capture fires once per answered enrichment dimension; a funnel
  // can declare ~6. 20/h leaves comfortable headroom over a single session.
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  prefix: 'funnel:enrich',
})
```

- [ ] **Step 2: Replace the fixed enrichment input with the generic record**

Replace the `enrichFunnelLead` `.input(...)`:

```ts
    .input(z.object({
      leadId: z.string().uuid(),
      enrichment: z.record(
        z.string(),
        z.object({ label: z.string(), value: z.string(), order: z.number().int() }),
      ),
    }))
```

(The body still calls `customerIntakeService.enrichFunnelLead(SYSTEM_CONTEXT, input)`; the service's spread-merge over the JSONB `||` merge already handles per-key upsert — confirmed in `customer-intake.service.ts` and `create-crud-dal.ts`.)

- [ ] **Step 3: Verify compile (in combined-commit context)**

Run: `pnpm tsc` (expected clean once Tasks 5-7 land, or now if combined).

---

### Task 5: Generic enrichment note builder (delete the label mirror)

**Files:**
- Delete: `src/shared/domains/funnels/constants/enrichment-labels.ts`
- Modify: `src/shared/domains/funnels/lib/build-funnel-lead-note.ts`

**Interfaces:**
- Consumes: `leadMeta.source.enrichment` generic record (Task 3).
- Produces: `buildFunnelLeadNote(leadMeta): string | null` iterating the generic record, ordered by `order`, tolerant of legacy flat shape.

- [ ] **Step 1: Delete the static label mirror**

```bash
git rm src/shared/domains/funnels/constants/enrichment-labels.ts
```

- [ ] **Step 2: Rewrite the note builder to be generic + legacy-tolerant**

Replace the entire contents of `src/shared/domains/funnels/lib/build-funnel-lead-note.ts`:

```ts
import type { LeadMeta } from '@/shared/entities/customers/schemas'

// Pure: build a `📋 Funnel intake` note from the generic enrichment record.
// Self-describing entries ({ label, value, order }) need no label mirror.
// Tolerates the legacy flat shape (Record<string, string>) from pre-refactor
// kitchen leads by best-effort rendering of key: value. No I/O.

interface Entry { label: string, value: string, order: number }

function isEntry(v: unknown): v is Entry {
  return typeof v === 'object' && v !== null && 'label' in v && 'value' in v
}

export function buildFunnelLeadNote(leadMeta: LeadMeta | null | undefined): string | null {
  if (leadMeta?.source?.kind !== 'funnel') {
    return null
  }
  const enrichment = leadMeta.source.enrichment as Record<string, unknown> | undefined
  if (!enrichment) {
    return null
  }

  const rows: { label: string, value: string, order: number }[] = []
  for (const [key, raw] of Object.entries(enrichment)) {
    if (isEntry(raw)) {
      rows.push({ label: raw.label, value: raw.value, order: raw.order })
    }
    else if (typeof raw === 'string') {
      // Legacy flat shape: key is the dimension id, value is a raw option id.
      rows.push({ label: key, value: raw, order: rows.length })
    }
  }
  if (rows.length === 0) {
    return null
  }
  rows.sort((a, b) => a.order - b.order)

  const lines = ['📋 Funnel intake', ...rows.map(r => `${r.label}: ${r.value}`)]
  return lines.join('\n')
}
```

- [ ] **Step 3: Verify compile**

Run: `pnpm tsc` (expected clean in combined context).

---

### Task 6: Stop the confirmation step from firing enrichment

**Files:**
- Modify: `src/shared/domains/funnels/ui/steps/confirmation-step.tsx`
- Modify: `src/shared/domains/funnels/hooks/use-enrich-lead.ts`

**Interfaces:**
- Consumes: nothing — removes literal-answer-key coupling from the shared view.
- Produces: `useEnrichLead()` returns `(args: { leadId: string, enrichment: EnrichmentRecord }) => void`.

- [ ] **Step 1: Make `useEnrichLead` accept the generic patch**

Replace `src/shared/domains/funnels/hooks/use-enrich-lead.ts`:

```ts
import type { EnrichmentRecord } from '@/shared/domains/funnels/types'
import { useMutation } from '@tanstack/react-query'

import { useTRPC } from '@/trpc/helpers'

interface EnrichArgs {
  leadId: string
  enrichment: EnrichmentRecord
}

/**
 * Best-effort enrichment: never awaited, errors swallowed. Post-lead enrichment
 * must never block or break the funnel experience.
 */
export function useEnrichLead() {
  const trpc = useTRPC()
  const mutation = useMutation(trpc.funnelsRouter.enrichFunnelLead.mutationOptions())
  return (args: EnrichArgs) => {
    mutation.mutate(args, { onError: () => {} })
  }
}
```

- [ ] **Step 2: Remove enrichment firing + literal answer reads from the confirmation view**

In `src/shared/domains/funnels/ui/steps/confirmation-step.tsx`:
- Delete the `asString` helper (lines ~16-18).
- Delete the `useEnrichLead` import (line ~10) and the `enrich`/`firedRef`/`useEffect` enrichment block (lines ~21-46).
- Keep everything else (the success UI, timeline, CTA, carousel). The component keeps `useReducedMotion` and `useRef`/`useEffect` only if still used elsewhere; if `useRef`/`useEffect` become unused after deletion, remove them from the React import.

The component signature stays `function ConfirmationStepView({ content, answers, ctx }: StepProps<ConfirmationStep>)` but `answers` is now only used (if at all) for the carousel slug via `ctx.slug` — verify `answers` is still referenced; if not, drop it from the destructure to satisfy lint.

After edit, the top of the component reads approximately:

```tsx
export function ConfirmationStepView({ content, ctx }: StepProps<ConfirmationStep>) {
  const reduceMotion = useReducedMotion()
  const phone = contactInfo.find(info => info.accessor === 'phone')!.value
  // …unchanged entrance()/render below…
}
```

- [ ] **Step 3: Verify compile + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS (combined context — Tasks 3-7 landed). Confirm no unused-import or unused-var warnings in `confirmation-step.tsx`.

---

### Task 7: Progressive enrichment hook + engine wiring

**Files:**
- Create: `src/shared/domains/funnels/hooks/use-progressive-enrichment.ts`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx`

**Interfaces:**
- Consumes: `buildLeadEnrichment`, `enrichmentSignature` (Task 2); `useEnrichLead` (Task 6); engine `answers` + `spec`.
- Produces: `useProgressiveEnrichment(spec: FunnelSpec, answers: FunnelAnswers): void` — fires generic enrich patches as dimensions become answerable once a `leadId` exists.

- [ ] **Step 1: Write the progressive-enrichment hook**

The hook reads the leadId from `answers.pii` (set by the PII step as `{ leadId }`), computes the full enrichment record from currently-answered declared dimensions, diffs it against what was already sent (a ref keyed by signature), and fires a single merged patch for the delta. This naturally flushes pre-PII answers the moment the lead exists, and fires later dimensions as they're answered.

```ts
import type { EnrichmentRecord, FunnelAnswers, FunnelSpec, PiiAnswer } from '@/shared/domains/funnels/types'
import { useEffect, useRef } from 'react'
import { buildLeadEnrichment } from '@/shared/domains/funnels/lib/build-lead-enrichment'
import { useEnrichLead } from '@/shared/domains/funnels/hooks/use-enrich-lead'

/**
 * Progressive lead enrichment. Captures each declared enrichment dimension as
 * soon as it is answered AND a leadId exists — so a drop-off before the
 * confirmation step still persists everything answered so far. Pre-PII answers
 * flush in one patch the moment the lead is created. The server merges per key
 * (JSONB `||`), so sending only the delta is safe.
 */
export function useProgressiveEnrichment(spec: FunnelSpec, answers: FunnelAnswers): void {
  const enrich = useEnrichLead()
  const sentRef = useRef<Set<string>>(new Set())

  const leadId = (answers.pii as PiiAnswer | null)?.leadId ?? null
  const full = buildLeadEnrichment(spec, answers)

  useEffect(() => {
    if (!leadId) {
      return
    }
    const delta: EnrichmentRecord = {}
    for (const [stepId, entry] of Object.entries(full)) {
      const key = `${stepId}=${entry.value}`
      if (!sentRef.current.has(key)) {
        delta[stepId] = entry
        sentRef.current.add(key)
      }
    }
    if (Object.keys(delta).length > 0) {
      enrich({ leadId, enrichment: delta })
    }
    // Re-run whenever the captured set changes (or the lead first appears).
    // `enrich` is stable from useEnrichLead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, Object.keys(full).map(k => `${k}=${full[k].value}`).join('|')])
}
```

- [ ] **Step 2: Wire the hook into the engine**

In `src/shared/domains/funnels/ui/funnel-engine.tsx`, add the import and call it alongside the other engine hooks:

```ts
import { useProgressiveEnrichment } from '@/shared/domains/funnels/hooks/use-progressive-enrichment'
```

and inside `FunnelEngine`, right after `useFunnelTracking(spec, engine)`:

```ts
  useProgressiveEnrichment(spec, engine.answers)
```

- [ ] **Step 3: Verify compile + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. This completes the atomic enrichment-contract refactor (Tasks 3-7).

- [ ] **Step 4: Commit the enrichment-contract refactor (Tasks 3-7 combined)**

```bash
git add src/shared/entities/customers/schemas/index.ts \
        src/trpc/routers/funnels.router.ts \
        src/shared/domains/funnels/lib/build-funnel-lead-note.ts \
        src/shared/domains/funnels/constants/enrichment-labels.ts \
        src/shared/domains/funnels/hooks/use-enrich-lead.ts \
        src/shared/domains/funnels/ui/steps/confirmation-step.tsx \
        src/shared/domains/funnels/hooks/use-progressive-enrichment.ts \
        src/shared/domains/funnels/ui/funnel-engine.tsx
git commit -m "refactor(funnels): generic + progressive lead enrichment

Self-describing keyed-object enrichment (label/value/order), progressive
per-step capture once leadId exists, generic note builder. Deletes the
kitchen-specific label mirror; decouples the shared confirmation view from
literal answer keys.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Creation-time funnel note (single, no duplication)

**Files:**
- Modify: `src/shared/services/customer-intake.service.ts`

**Interfaces:**
- Consumes: `buildFunnelLeadNote` (Task 5).
- Produces: a single funnel-intake note at lead creation; the per-enrich note is removed.

- [ ] **Step 1: Remove the per-enrich note from `enrichFunnelLead`**

In `customer-intake.service.ts`, find the block in `enrichFunnelLead` that builds + adds the note (the `buildFunnelLeadNote(nextLeadMeta)` + `addCustomerNote` block, ~lines 154-165) and delete it. Progressive firing would otherwise append a duplicate note per patch. Current state is shown by the panel (Task 9).

- [ ] **Step 2: Add a single funnel note at lead creation in `ingestLead`**

In `ingestLead`, after the customer is created successfully (after `const created = await customerCrud.create(...)` and its success check), add a best-effort single note built from the creation-time `leadMeta` (which already includes any pre-PII enrichment flushed into the submit payload — and even if empty, records the funnel source):

```ts
    // Best-effort single funnel-intake note (never rolls back the lead).
    const funnelNote = buildFunnelLeadNote(input.leadMeta)
    if (funnelNote) {
      const noteResult = await addCustomerNote({
        customerId: created.data.customer.id,
        content: funnelNote,
        authorId: null,
      })
      if (!noteResult.success) {
        console.error('[customerIntake] funnel intake note failed (lead kept)', noteResult.error)
      }
    }
```

Ensure `buildFunnelLeadNote` is imported at the top of the file (it may already be imported for the deleted block — keep the import). Verify `addCustomerNote` and the exact `created.data.customer.id` access path against the surrounding code (the create result shape is used elsewhere in the same function).

> Note: at lead-creation time the submit payload's `leadMeta.source.enrichment` carries only pre-PII dims (whichBathroom, etc., once Phase 1 includes them in `buildLeadInput`). Post-PII dims arrive via progressive enrich and appear in the panel; the creation note is the chronological marker, intentionally a point-in-time snapshot.

- [ ] **Step 3: Verify compile + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/services/customer-intake.service.ts
git commit -m "refactor(funnels): single creation-time intake note (drop per-enrich note)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Generic "Funnel Intake" customer panel

**Files:**
- Create: `src/shared/entities/customers/constants/funnel-intake-fields.ts`
- Create: `src/shared/entities/customers/components/profile/funnel-intake-panel.tsx`
- Modify: `src/shared/entities/customers/components/profile/customer-profile-details.tsx`

**Interfaces:**
- Consumes: `LeadMeta` (`@/shared/entities/customers/schemas`).
- Produces: `<FunnelIntakePanel leadMetaJSON={...} />` — read-only card; renders nothing when not a funnel lead or no enrichment.

- [ ] **Step 1: Add the legacy-label constant (no consts in component files)**

Create `src/shared/entities/customers/constants/funnel-intake-fields.ts`:

```ts
// Legacy dimension-id → label fallback for pre-refactor kitchen leads whose
// enrichment is the old flat { homeType: 'condo', … } shape. New leads are
// self-describing and don't use this map.
export const LEGACY_ENRICHMENT_LABELS: Record<string, string> = {
  homeType: 'Home type',
  age: 'Project age',
  scope: 'Scope',
  timeline: 'Timeline',
}
```

- [ ] **Step 2: Write the read-only panel**

Create `src/shared/entities/customers/components/profile/funnel-intake-panel.tsx`. It reads `leadMetaJSON.source.enrichment`, normalizes both the new keyed-object and legacy flat shapes into ordered rows, and renders them with the same Card + 2-col label/value grid the profile cards use.

```tsx
import type { LeadMeta } from '@/shared/entities/customers/schemas'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { LEGACY_ENRICHMENT_LABELS } from '@/shared/entities/customers/constants/funnel-intake-fields'

interface Row { label: string, value: string, order: number }

function toRows(enrichment: Record<string, unknown>): Row[] {
  const rows: Row[] = []
  for (const [key, raw] of Object.entries(enrichment)) {
    if (typeof raw === 'object' && raw !== null && 'label' in raw && 'value' in raw) {
      const e = raw as { label: string, value: string, order?: number }
      rows.push({ label: e.label, value: e.value, order: e.order ?? rows.length })
    }
    else if (typeof raw === 'string') {
      rows.push({ label: LEGACY_ENRICHMENT_LABELS[key] ?? key, value: raw, order: rows.length })
    }
  }
  return rows.sort((a, b) => a.order - b.order)
}

export function FunnelIntakePanel({ leadMetaJSON }: { leadMetaJSON: LeadMeta | null | undefined }) {
  if (leadMetaJSON?.source?.kind !== 'funnel') {
    return null
  }
  const enrichment = leadMetaJSON.source.enrichment as Record<string, unknown> | undefined
  if (!enrichment) {
    return null
  }
  const rows = toRows(enrichment)
  if (rows.length === 0) {
    return null
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-sm">Funnel Intake</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2">
          {rows.map(row => (
            <div key={row.label}>
              <p className="text-xs text-muted-foreground">{row.label}</p>
              <p className="text-sm font-medium">{row.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
```

> Verify the `Card`/`CardHeader`/`CardContent`/`CardTitle` import path matches `profile-card.tsx`'s imports (same UI primitives) before finalizing.

- [ ] **Step 3: Mount the panel in `CustomerProfileDetails`**

In `src/shared/entities/customers/components/profile/customer-profile-details.tsx`:
- Add `leadMetaJSON` to the component's `Props` (type `LeadMeta | null | undefined`) and destructure it. Pass it from the parent that renders `CustomerProfileDetails` (find the call site; the customer object already carries `leadMetaJSON`). If threading the prop is non-trivial, read the customer from the same source the other `*ProfileJSON` props come from and add `leadMetaJSON` alongside them.
- Render `<FunnelIntakePanel leadMetaJSON={leadMetaJSON} />` after the three `ProfileCard`s, inside the existing `<div className="space-y-4">`.

```tsx
import { FunnelIntakePanel } from '@/shared/entities/customers/components/profile/funnel-intake-panel'
// …
      <FunnelIntakePanel leadMetaJSON={leadMetaJSON} />
```

- [ ] **Step 4: Verify compile + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/entities/customers/constants/funnel-intake-fields.ts \
        src/shared/entities/customers/components/profile/funnel-intake-panel.tsx \
        src/shared/entities/customers/components/profile/customer-profile-details.tsx
git commit -m "feat(customers): generic Funnel Intake profile panel

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Positioning-variant seam (route → engine → landing)

**Files:**
- Modify: `src/app/(frontend)/funnels/[trade]/page.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-engine.tsx`
- Modify: `src/shared/domains/funnels/ui/funnel-landing.tsx`

**Interfaces:**
- Consumes: `FunnelSpec.variants` (Task 1).
- Produces: `<FunnelEngine slug variant?>`; `FunnelLanding` resolves blocks as `variants?.[variant] ?? landing ?? DEFAULT`.

- [ ] **Step 1: Read `?v=` in the route and pass it to the engine**

In `src/app/(frontend)/funnels/[trade]/page.tsx`, accept `searchParams` and read `v` (fall back to UTM `content` later if desired — `v` is sufficient for v1). Pass `variant` to `<FunnelEngine>`:

```tsx
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ trade: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { trade } = await params
  const sp = await searchParams
  if (!isFunnelSlug(trade)) {
    notFound()
  }
  const variantRaw = sp.v
  const variant = typeof variantRaw === 'string' ? variantRaw : undefined
  return <FunnelEngine slug={trade} variant={variant} />
}
```

> Match the existing file's exact param-handling idiom (it already awaits `params` and calls `isFunnelSlug`/`notFound`). Only ADD `searchParams` + `variant`.

- [ ] **Step 2: Thread `variant` through the engine to the landing**

In `src/shared/domains/funnels/ui/funnel-engine.tsx`, change the signature and pass `variant` to `FunnelLanding`:

```tsx
export function FunnelEngine({ slug, variant }: { slug: FunnelSlug, variant?: string }) {
```

and in the `engine.isFirst` branch:

```tsx
        <FunnelLanding spec={spec} ctx={ctx} variant={variant} scrollToQuestionOnMount={engine.value != null}>{stepEl}</FunnelLanding>
```

- [ ] **Step 3: Resolve variant blocks in `FunnelLanding`**

Open `src/shared/domains/funnels/ui/funnel-landing.tsx`. Add `variant?: string` to its `Props`. At the site where it currently computes blocks (`spec.landing?.blocks ?? DEFAULT_LANDING_BLOCKS`), change to:

```tsx
  const blocks = (variant ? spec.variants?.[variant]?.blocks : undefined)
    ?? spec.landing?.blocks
    ?? DEFAULT_LANDING_BLOCKS
```

(Use the actual local variable / JSX expression the file uses; the resolution precedence is variant → landing → default.)

- [ ] **Step 4: Verify compile + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add "src/app/(frontend)/funnels/[trade]/page.tsx" \
        src/shared/domains/funnels/ui/funnel-engine.tsx \
        src/shared/domains/funnels/ui/funnel-landing.tsx
git commit -m "feat(funnels): positioning-variant landing seam (?v= -> variant blocks)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Remove kitchen-default leaks in shared blocks

**Files:**
- Modify: `src/shared/domains/funnels/ui/blocks/callout-block.tsx`
- Modify: `src/shared/domains/funnels/ui/blocks/before-after-showcase.tsx`

**Interfaces:**
- Consumes: `ctx` (`FunnelContext`) already passed to blocks; `ctx` has `slug` (and the block can use a neutral default).
- Produces: no funnel that omits an image/alt silently renders kitchen content.

- [ ] **Step 1: Neutralize the callout default image**

In `callout-block.tsx`, the `DEFAULT_IMAGE = { src: '/portfolio-photos/modern-kitchen-1.jpeg', alt: 'Remodeled Showcase kitchen' }` must go. Preferred: render the image only when `content.image` is provided (no default). Locate the usage and make the media render conditional:

```tsx
// remove the DEFAULT_IMAGE const entirely
const image = content.image // may be undefined
// …in JSX, render the media column only when `image` is set:
{image ? (/* existing <img>/<Image> using image.src / image.alt */) : null}
```

If the block's layout requires an image, instead derive a neutral alt and use a vertical-neutral placeholder under `public/funnels/common/`. Prefer conditional render (simplest, no new asset).

- [ ] **Step 2: Neutralize before/after alt text**

In `before-after-showcase.tsx` (lines ~75, 81), replace the hardcoded `'Kitchen before the remodel'` / `'Kitchen after the remodel'` with vertical-neutral copy, preferring an explicit `pair.label` when present:

```tsx
alt={pair.label ? `${pair.label} — before` : 'Before the remodel'}
// …
alt={pair.label ? `${pair.label} — after` : 'After the remodel'}
```

(Use the existing `pair`/`label` variable names in that file.)

- [ ] **Step 3: Verify compile + lint, and that kitchens still renders**

Run: `pnpm tsc && pnpm lint`
Expected: PASS. (Kitchens' callout *does* pass an `image`, so it is unaffected; its before/after pairs gain neutral alts.)

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/ui/blocks/callout-block.tsx \
        src/shared/domains/funnels/ui/blocks/before-after-showcase.tsx
git commit -m "fix(funnels): remove kitchen-specific default image/alt leaks in shared blocks

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Migrate kitchens to declare `enrichment`

**Files:**
- Modify: `src/shared/domains/funnels/constants/kitchens.ts`

**Interfaces:**
- Consumes: `FunnelSpec.enrichment` (Task 1); `buildLeadEnrichment` reads kitchens' step option labels.
- Produces: kitchens keeps enriching leads (homeType/age/scope/timeline) under the generic pipeline.

- [ ] **Step 1: Add the `enrichment` declaration to `kitchensFunnel`**

In `kitchens.ts`, add the `enrichment` field on the spec (e.g. right before `steps:`). The step ids must match existing kitchen steps (`homeType` is `HOME_TYPE_STEP.id`; `age`, `scope`, `timeline` are the card-select ids already present):

```ts
  enrichment: [
    { stepId: 'homeType', label: 'Home type' },
    { stepId: 'age', label: 'Project age' },
    { stepId: 'scope', label: 'Scope' },
    { stepId: 'timeline', label: 'Timeline' },
  ],
```

> Verify `HOME_TYPE_STEP.id === 'homeType'` by reading `src/shared/domains/funnels/ui/steps/home-type-step.ts`. If its id differs, use the actual id. The card-select ids `age`/`scope`/`timeline` are confirmed in `kitchens.ts`.

- [ ] **Step 2: Verify capture with a throwaway run**

Run:

```bash
pnpm exec tsx -e "
import { kitchensFunnel } from './src/shared/domains/funnels/constants/kitchens.ts'
import { buildLeadEnrichment } from './src/shared/domains/funnels/lib/build-lead-enrichment.ts'
const r = buildLeadEnrichment(kitchensFunnel, { homeType: 'single-family', age: '5-15', scope: 'full-gut', timeline: 'asap' })
console.log(JSON.stringify(r, null, 2))
console.assert(r.scope?.value === 'Full gut remodel' && r.scope?.order === 2, 'kitchens scope FAIL')
console.assert(r.timeline?.value === 'ASAP', 'kitchens timeline FAIL')
console.log('OK')
"
```

Expected: prints the four resolved entries and `OK`.

- [ ] **Step 3: Verify compile + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/constants/kitchens.ts
git commit -m "refactor(funnels): kitchens declares enrichment dims (generic pipeline)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: Document the funnel-authoring convention

**Files:**
- Modify (or create if absent): `src/shared/domains/funnels/DOCS.md`

- [ ] **Step 1: Add the asset convention + new-funnel checklist**

Append a slug-anchored section to `src/shared/domains/funnels/DOCS.md` (create the file with a title if it doesn't exist):

```markdown
## Adding a new funnel  <!-- #adding-a-new-funnel -->

A new funnel is "author one spec + drop assets":

1. **Spec:** create `constants/<slug>.ts` exporting `<slug>Funnel: FunnelSpec`.
   Reuse prebuilt steps (`ZIP_STEP`, `PII_STEP`, `HOME_TYPE_STEP`,
   `ADDRESS_STEP`, `CONFIRMATION_STEP`); add card-select steps for trade-native
   questions. Declare `enrichment: { stepId, label }[]` for every dimension that
   should reach the CRM (it renders in the customer Funnel Intake panel + the
   creation-time intake note automatically). Set `pixel.contentCategory`.
2. **Register:** add the slug to `constants/slugs.ts`, the spec to
   `lib/registry.ts`, the trade UUID to `constants/trade-by-slug.ts`, and the
   lead name to `lib/build-lead-input.ts`.
3. **Assets:** vertical-specific images live under
   `public/funnels/<slug>/<dimension>/<option>.webp`; shared assets live under
   `public/funnels/common/...`. Generate with an image model and run them
   through the `optimize-image-assets` skill (convert→webp, crop, resize,
   organize, delete source PNGs) before committing.
4. **Variants (optional):** add `variants: { <name>: { blocks } }` for alternate
   landing positioning, reachable at `/funnels/<slug>?v=<name>`. Steps + pixel
   are unchanged.

Measurement, ZIP gating, phone validation, lead submission, and enrichment are
all funnel-agnostic — no backend wiring is needed for a new funnel.
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/domains/funnels/DOCS.md
git commit -m "docs(funnels): document new-funnel + asset convention

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Phase 1 — The bathrooms funnel

### Task 14: Bathrooms assets

**Files:**
- Create: `public/funnels/bathrooms/whichBathroom/*.webp`, `public/funnels/bathrooms/age/*.webp`, `public/funnels/bathrooms/scope/*.webp`, `public/funnels/bathrooms/before-1.webp`, `after-1.webp`, `before-2.webp`, `after-2.webp`, and a hero image.

**Interfaces:**
- Produces: the exact asset paths referenced by `bathrooms.ts` (Task 15).

- [ ] **Step 1: Generate + optimize the option/hero/before-after images**

Use the **optimize-image-assets** skill on AI-generated source PNGs. Required files (paths are the contract Task 15 references):
- `whichBathroom/primary.webp`, `guest.webp`, `powder.webp`, `multiple.webp`
- `age/0-5.webp`, `5-15.webp`, `15-plus.webp`, `original.webp`
- `scope/full-gut.webp`, `tub-to-shower.webp`, `walk-in-shower.webp`, `vanity-fixtures.webp`, `cosmetic.webp`
- `before-1.webp` / `after-1.webp`, `before-2.webp` / `after-2.webp`
- a hero image (reuse an existing bathroom portfolio photo under `public/portfolio-photos/` if a generated hero isn't ready — record which path is used so Task 15's `hero.media.src` matches).

> `accessibility`, `timeline`, and `ownership` options are text/icon (no images), matching how kitchens handles `ownership`/`timeline`.

- [ ] **Step 2: Verify the files exist at the contracted paths**

Run: `ls -R public/funnels/bathrooms`
Expected: the files listed above are present as `.webp`, organized into `whichBathroom/`, `age/`, `scope/` folders, no leftover source PNGs.

- [ ] **Step 3: Commit**

```bash
git add public/funnels/bathrooms
git commit -m "assets(funnels): bathrooms funnel option/before-after/hero webps

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Author the bathrooms funnel spec

**Files:**
- Modify (replace stub): `src/shared/domains/funnels/constants/bathrooms.ts`

**Interfaces:**
- Consumes: prebuilt steps, `FunnelSpec` with `enrichment`/`variants`, asset paths from Task 14.
- Produces: `bathroomsFunnel: FunnelSpec` registered already via `lib/registry.ts`.

- [ ] **Step 1: Replace the stub with the full spec**

Replace the entire contents of `src/shared/domains/funnels/constants/bathrooms.ts`. Step order mirrors kitchens (early PII after micro-commitments + ZIP). Six enrichment dims include `whichBathroom` + `accessibility` (the two kitchens lacks). Blend positioning landing.

```ts
import type { FunnelSpec } from '@/shared/domains/funnels/types'
import { ADDRESS_STEP } from '@/shared/domains/funnels/ui/steps/address-step'
import { CONFIRMATION_STEP } from '@/shared/domains/funnels/ui/steps/confirmation-step'
import { HOME_TYPE_STEP } from '@/shared/domains/funnels/ui/steps/home-type-step'
import { PII_STEP } from '@/shared/domains/funnels/ui/steps/pii-form-step'
import { ZIP_STEP } from '@/shared/domains/funnels/ui/steps/zip-step'

export const bathroomsFunnel: FunnelSpec = {
  slug: 'bathrooms',
  offer: 'showcase',
  title: 'Bathroom Showcase',
  hero: {
    headline: 'The spa bathroom you\'ll actually use — at a Showcase price.',
    subhead: 'See if your home qualifies to be featured in our bathroom showcase.',
    scarcityLine: 'We\'re selecting 5 bathrooms in your area.',
    ctaLabel: 'See if you qualify',
    media: { kind: 'image', src: '/portfolio-photos/modern-bathroom-1.jpeg', alt: 'Modern remodeled bathroom' },
    highlightWords: ['spa', 'Showcase'],
  },
  theme: { accent: 'primary' },
  pixel: { contentCategory: 'bathroom' },
  enrichment: [
    { stepId: 'whichBathroom', label: 'Which bathroom' },
    { stepId: 'homeType', label: 'Home type' },
    { stepId: 'age', label: 'Bathroom age' },
    { stepId: 'scope', label: 'Scope' },
    { stepId: 'accessibility', label: 'Accessibility' },
    { stepId: 'timeline', label: 'Timeline' },
  ],
  landing: {
    blocks: [
      {
        kind: 'problem',
        content: {
          headline: 'Most bathroom remodels hide their worst problems behind the tile.',
          body: 'A bathroom is a waterproofing problem first and a design project second. Get the membrane, slope, or plumbing wrong and the damage grows inside the walls for years — long after the "deal" crew has cashed your check.',
          points: [
            { title: 'Hidden water damage', body: 'Bad waterproofing and rushed tile work trap moisture — rot, mold, and a rebuild you pay for twice.', image: '/funnels/common/reason-cut-rate-crews.webp', alt: 'Hidden water damage from cut-rate work' },
            { title: 'No one accountable', body: 'Independent subs blame each other and you become the project manager of your own remodel.', image: '/funnels/common/reason-no-accountability.webp', alt: 'No one accountable' },
            { title: 'Surprise change-orders', body: 'A cheap bid becomes an expensive invoice the moment demo opens the wall behind the shower.', image: '/funnels/common/reason-surprise-change-orders.webp', alt: 'Surprise change orders' },
            { title: 'Endless timelines', body: 'Without real scheduling, two weeks becomes two months — and your only shower stays offline.', image: '/funnels/common/reason-endless-timelines.webp', alt: 'Endless timelines' },
          ],
          standardLine: 'What to demand: a licensed, bonded, insured GC you can verify, one accountable team, proper waterproofing, a fixed written scope, and a real schedule. That\'s the bar — and for us it\'s the floor.',
        },
      },
      { kind: 'cta', content: { label: 'Learn how we do it' } },
      {
        kind: 'value',
        content: {
          headline: 'A bathroom that feels like a retreat — and protects your home.',
          roiStat: { value: '60–70%', label: 'typical resale ROI on a bath remodel' },
          beforeAfter: [
            { before: '/funnels/bathrooms/before-1.webp', after: '/funnels/bathrooms/after-1.webp' },
            { before: '/funnels/bathrooms/before-2.webp', after: '/funnels/bathrooms/after-2.webp' },
          ],
          items: [
            { before: 'A cramped tub you never use', after: 'A walk-in spa shower built around your routine' },
            { before: 'Dated tile and failing grout', after: 'Properly waterproofed, easy-clean surfaces' },
            { before: 'A slippery, awkward step-over', after: 'Curbless, safe access that ages with you' },
            { before: 'A bathroom decades behind', after: 'A calm, modern space you look forward to' },
          ],
        },
      },
      { kind: 'portfolio', content: { title: 'Recent bathrooms in your area' } },
      { kind: 'reviews', content: { rating: 4.9, count: 200, label: 'What homeowners say' } },
      {
        kind: 'process',
        content: {
          title: 'How your Showcase bathroom comes together',
          steps: [
            { title: 'Discovery & Design', duration: 'Wk 1–2', image: '/process/design-stage.jpeg', body: 'We map how you use the space, measure, and design a bathroom around your routine and your home\'s plumbing.' },
            { title: 'Pre-Construction & Permits', duration: 'Wk 2–3', image: '/process/pre-construction-stage.jpeg', body: 'We lock the scope, pull permits, and order materials so the build runs without surprises.' },
            { title: 'Construction', image: '/process/construction-stage.jpeg', body: 'One accountable crew, proper waterproofing, daily quality checks, and photo documentation — not a rotating cast of subs.' },
            { title: 'Completion & Handover', image: '/process/handover-stage.jpeg', body: 'Final walkthrough, punch list, and a bathroom done right — backed by our workmanship guarantee.' },
          ],
        },
      },
      {
        kind: 'callout',
        content: {
          headline: 'Fixed, low monthly payments.',
          body: 'Fixed, low monthly payments put a Showcase bathroom within reach without draining your savings. We\'ll walk you through the options you qualify for during your consultation — no obligation.',
          points: ['Fixed low monthly payments', 'No-obligation consultation', 'Clear, written numbers up front'],
          image: { src: '/portfolio-photos/modern-bathroom-1.jpeg', alt: 'Remodeled Showcase bathroom' },
        },
      },
      {
        kind: 'faq',
        content: {
          title: 'Bathroom remodel questions, answered',
          items: [
            { q: 'How much does a bathroom remodel cost?', a: 'It depends on size, scope, and finishes — which is why we give you a fixed written scope and clear numbers up front instead of a low guess that balloons later. We\'ll walk you through the range on your consultation.' },
            { q: 'How long does it take?', a: 'A typical Showcase bathroom runs about 2–5 weeks of active construction after design and permits, depending on scope. You get a real schedule — not a vague "couple of weeks."' },
            { q: 'Do I need permits?', a: 'Most bathroom remodels that touch plumbing or electrical do. As a licensed general contractor we pull and manage them for you. Unpermitted work becomes your problem when you sell.' },
            { q: 'Can you convert my tub to a walk-in shower?', a: 'Yes — tub-to-shower and curbless walk-in conversions are among our most requested projects, with proper waterproofing and safe, code-compliant access.' },
            { q: 'Is financing available?', a: 'Yes — with fixed, low monthly payments so you can start now and pay over time. We\'ll cover the options you qualify for during your consultation.' },
            { q: 'Are you licensed and insured?', a: 'Fully. We\'re a licensed, bonded general contractor (CSLB #1076760) insured up to $1M general liability — and you can verify our license on the CSLB website.' },
          ],
        },
      },
      {
        kind: 'guarantee',
        content: {
          headline: 'Showcase-grade work, guaranteed',
          body: 'Every Showcase project is backed by our workmanship guarantee — including the waterproofing behind the walls.',
          scarcityLine: 'We\'re selecting 5 bathrooms in your area this month.',
        },
      },
      { kind: 'licensing', content: {} },
    ],
  },
  steps: [
    {
      id: 'whichBathroom',
      kind: 'card-select',
      optionIds: ['primary', 'guest', 'powder', 'multiple'],
      content: {
        title: 'Which bathroom are you remodeling?',
        options: {
          primary: { label: 'Primary / ensuite', asset: { kind: 'image', src: '/funnels/bathrooms/whichBathroom/primary.webp', alt: 'Primary ensuite bathroom' } },
          guest: { label: 'Guest / hall bath', asset: { kind: 'image', src: '/funnels/bathrooms/whichBathroom/guest.webp', alt: 'Guest or hall bathroom' } },
          powder: { label: 'Powder room', asset: { kind: 'image', src: '/funnels/bathrooms/whichBathroom/powder.webp', alt: 'Powder room' } },
          multiple: { label: 'Multiple bathrooms', asset: { kind: 'image', src: '/funnels/bathrooms/whichBathroom/multiple.webp', alt: 'Multiple bathrooms' } },
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
    { ...ZIP_STEP, content: { ...ZIP_STEP.content, subtitle: 'Showcase bathrooms are selected by neighborhood.' } },
    PII_STEP,
    HOME_TYPE_STEP,
    {
      id: 'age',
      kind: 'card-select',
      optionIds: ['0-5', '5-15', '15-plus', 'original'],
      content: {
        title: 'How old is your bathroom?',
        options: {
          '0-5': { label: '0–5 years', asset: { kind: 'image', src: '/funnels/bathrooms/age/0-5.webp', alt: 'Bathroom 0–5 years old' } },
          '5-15': { label: '5–15 years', asset: { kind: 'image', src: '/funnels/bathrooms/age/5-15.webp', alt: 'Bathroom 5–15 years old' } },
          '15-plus': { label: '15+ years', asset: { kind: 'image', src: '/funnels/bathrooms/age/15-plus.webp', alt: 'Bathroom 15+ years old' } },
          'original': { label: 'Original / never renovated', asset: { kind: 'image', src: '/funnels/bathrooms/age/original.webp', alt: 'Original, never-renovated bathroom' } },
        },
      },
    },
    {
      id: 'scope',
      kind: 'card-select',
      optionIds: ['full-gut', 'tub-to-shower', 'walk-in-shower', 'vanity-fixtures', 'cosmetic'],
      content: {
        title: 'What are you picturing?',
        options: {
          'full-gut': { label: 'Full gut remodel', asset: { kind: 'image', src: '/funnels/bathrooms/scope/full-gut.webp', alt: 'Full gut bathroom remodel' } },
          'tub-to-shower': { label: 'Tub → shower conversion', asset: { kind: 'image', src: '/funnels/bathrooms/scope/tub-to-shower.webp', alt: 'Tub to shower conversion' } },
          'walk-in-shower': { label: 'New walk-in shower', asset: { kind: 'image', src: '/funnels/bathrooms/scope/walk-in-shower.webp', alt: 'New walk-in shower' } },
          'vanity-fixtures': { label: 'Vanity + fixtures', asset: { kind: 'image', src: '/funnels/bathrooms/scope/vanity-fixtures.webp', alt: 'New vanity and fixtures' } },
          'cosmetic': { label: 'Cosmetic refresh', asset: { kind: 'image', src: '/funnels/bathrooms/scope/cosmetic.webp', alt: 'Cosmetic bathroom refresh' } },
        },
      },
    },
    {
      id: 'accessibility',
      kind: 'card-select',
      optionIds: ['curbless', 'grab-bars', 'not-needed'],
      content: {
        title: 'Any accessibility or safety needs?',
        subtitle: 'Aging-in-place upgrades are one of our specialties.',
        options: {
          'curbless': { label: 'Curbless / walk-in access' },
          'grab-bars': { label: 'Grab bars & safety upgrades' },
          'not-needed': { label: 'Not needed right now' },
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
    ADDRESS_STEP,
    CONFIRMATION_STEP,
  ],
}
```

> Asset-path check: every `src` above must match a file created in Task 14. If a generated hero/portfolio image isn't available, point `hero.media.src` and the callout `image.src` at an existing `public/portfolio-photos/` bathroom photo and adjust the alt text. Confirm `HOME_TYPE_STEP.id === 'homeType'` so the `homeType` enrichment dim resolves.

- [ ] **Step 2: Verify the spec builds enrichment correctly**

Run:

```bash
pnpm exec tsx -e "
import { bathroomsFunnel } from './src/shared/domains/funnels/constants/bathrooms.ts'
import { buildLeadEnrichment } from './src/shared/domains/funnels/lib/build-lead-enrichment.ts'
const r = buildLeadEnrichment(bathroomsFunnel, { whichBathroom: 'primary', homeType: 'single-family', age: '15-plus', scope: 'tub-to-shower', accessibility: 'curbless', timeline: 'asap' })
console.log(JSON.stringify(r, null, 2))
console.assert(Object.keys(r).length === 6, 'expected 6 dims, got ' + Object.keys(r).length)
console.assert(r.whichBathroom.value === 'Primary / ensuite' && r.whichBathroom.order === 0, 'whichBathroom FAIL')
console.assert(r.accessibility.value === 'Curbless / walk-in access' && r.accessibility.order === 4, 'accessibility FAIL')
console.log('OK')
"
```

Expected: prints six entries and `OK`.

- [ ] **Step 3: Verify compile + lint**

Run: `pnpm tsc && pnpm lint`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/constants/bathrooms.ts
git commit -m "feat(funnels): author bathrooms funnel (6 enrichment dims, blend landing)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 16: End-to-end verification

**Files:** none (verification only).

- [ ] **Step 1: Static gates**

Run: `pnpm tsc && pnpm lint`
Expected: PASS across the whole project.

- [ ] **Step 2: Run the funnel locally and walk bathrooms**

Start dev (`pnpm dev`) and open `/funnels/bathrooms`. Using the Playwright MCP (or a browser), verify:
- Landing renders the blend blocks (problem → cta → value → portfolio → reviews → process → callout → faq → guarantee → licensing), the hero shows the bathroom image, and no kitchen imagery/copy appears anywhere.
- Step sequence: whichBathroom → ownership → ZIP → PII → homeType → age → scope → accessibility → timeline → address → confirmation. Card-select images load from `/funnels/bathrooms/...`.
- Network tab: `PageView` on load, `ViewContent` on first answer, `Lead` on PII submit, `CompleteRegistration` on reaching confirmation (same as kitchens).

- [ ] **Step 3: Verify progressive drop-off capture**

Complete through PII (lead is created), answer `age` and `scope`, then **abandon** (close the tab) before confirmation. In the dev DB, open the created customer in the dashboard profile and confirm the **Funnel Intake** panel shows the answered dims (whichBathroom, home type, bathroom age, scope) — proving progressive capture persists a drop-off. Confirm a single `📋 Funnel intake` creation note exists (not duplicated).

- [ ] **Step 4: Verify full completion + the two kitchens-lacks dims**

Complete the full funnel. Confirm the Funnel Intake panel shows all six dimensions including **Which bathroom** and **Accessibility** (the two kitchens doesn't have), ordered by `order`.

- [ ] **Step 5: Verify the variant seam**

Open `/funnels/bathrooms?v=safety`. Since the `safety` variant isn't authored yet, confirm it **falls back to the blend landing** (no crash) — proving the resolution precedence (variant → landing → default). (Authoring the `safety`/`sanctuary` block arrays is the fast-follow noted in the spec.)

- [ ] **Step 6: Verify kitchens regression**

Open `/funnels/kitchens`, complete it, and confirm its Funnel Intake panel still shows Home type / Project age / Scope / Timeline — proving the generic pipeline preserved kitchens.

- [ ] **Step 7: Final commit (if any verification fixups were needed)**

```bash
git add -A
git commit -m "test(funnels): bathrooms funnel end-to-end verification fixups

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

(If no fixups were needed, skip — verification produced no code changes.)

---

## Self-review — spec coverage

- **Phase 0a generic/progressive/self-describing enrichment** → Tasks 1, 2, 3, 4, 5, 6, 7, 12. ✓
- **Keyed merge-safe storage shape** → Task 1 (types), Task 3 (schema), Task 2 (builder). ✓
- **Drop per-enrich note / single creation note** → Task 8. ✓
- **Phase 0b generic Funnel Intake panel** → Task 9. ✓
- **Phase 0c variant seam** → Tasks 1 (type), 10 (route→engine→landing). ✓
- **Phase 0d kitchen-default leak removal** → Task 11. ✓
- **Phase 0e document convention** → Task 13. ✓
- **Kitchens migration to declare enrichment** → Task 12. ✓
- **Phase 1 bathrooms steps (6 dims incl. whichBathroom + accessibility)** → Task 15. ✓
- **Phase 1 blend landing** → Task 15. ✓
- **Phase 1 assets** → Task 14. ✓
- **Verification (event sequence, drop-off persistence, variant fallback, kitchens regression)** → Task 16. ✓
- **Out of scope honored:** no safety/sanctuary content authored, no variant stamped into lead meta, no B2 structured-field mapping, no FIX/IMPROVE, no data migration. ✓

**Type consistency:** `EnrichmentRecord` / `EnrichmentEntry { label, value, order }` used identically in Tasks 1, 2, 3, 4, 5, 6, 7, 9. `buildLeadEnrichment` signature consistent across Tasks 2, 7, 12, 15. `useEnrichLead` arg shape (`{ leadId, enrichment }`) consistent in Tasks 6 and 7. `FunnelEngine({ slug, variant })` consistent in Tasks 7/10. ✓

**Note on Tasks 3–7:** flagged as one atomic contract change — implement as a single combined commit (recommended) to keep `tsc` green per commit.
