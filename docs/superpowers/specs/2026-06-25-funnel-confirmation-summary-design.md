# Funnel confirmation — generic, entity-driven answer summary

**Date:** 2026-06-25
**Status:** Approved design, pre-implementation
**Domain:** `src/shared/domains/funnels/`

## Problem

The `/test` page holds a redesigned funnel confirmation page (prototype, local-only,
hardcoded to kitchens) demonstrating three things:

1. A grouped, on-brand **summary** of what the user told us.
2. **Edit a field** without leaving the confirmation page.
3. **Start over**.

We want to ship that look + behavior on the real terminal `confirmation` step, and
make the summary **generic** so it works for every funnel (kitchens, bathrooms,
complete-interior, …) with no per-funnel wiring.

The live `ConfirmationStepView` today is a simpler celebratory lockup (success icon
+ what's-next timeline + Call / See-our-work CTAs + project carousel) with no summary
and no edit.

## Decisions (from brainstorming)

- **Scope:** full — summary + edit + start-over.
- **Summary content model:** *persisted facts (entity-driven)*. Rows are the funnel's
  declared `enrichment[]` dimensions + address + contact. Every row maps 1:1 to a
  customer field and is editable through the existing Customer entity CRUD. Qualifying
  questions not in `enrichment` (e.g. kitchens `layout`, `ownership`) are **not** shown
  — they are never stored on the customer.
- **Editing reuses the Customer entity layer**, not ad-hoc functions. The existing
  `customerIntakeService` is already pure orchestration over `customerCrud`; contact
  edits become a third guarded method in the same shape.
- **Edit is inline, no engine navigation.** The prototype's own implementation swaps a
  local editor in/out; that is better than the `goTo` its header comment speculated
  about (jumping into a real card-select step would re-trigger auto-advance and replay
  the funnel tail). ⚠️ The prototype comment ("real build adds a goTo() to the engine")
  is wrong — disregard it.

## Architecture

### A. The generic summary builder (the "generic" core)

New pure module `lib/build-confirmation-summary.ts`:

```
buildConfirmationSummary(spec: FunnelSpec, answers: FunnelAnswers): SummarySection[]
```

- `SummaryRow = { key: string; label: string; value: string; asset?: OptionAsset; edit: EditTarget }`
- `EditTarget = { kind: 'card', stepId } | { kind: 'address' } | { kind: 'contact' }`
- `SummarySection = { eyebrow: string; rows: SummaryRow[] }`

Sourcing (all from data the funnel already declares):

- **Project section** — one row per `spec.enrichment[]` entry. `label` = `dim.label`;
  the answered value lives in `answers[dim.stepId]` (a card-select option id); resolve
  `value` (option label) + `asset` from that step's `content.options`. Reuses the same
  lookup `build-lead-enrichment.ts` already does. Skip any dimension whose step is
  unanswered or not card-select.
- **Your details section** — the address row (only if the funnel has an `address`
  step *and* `answers.address` is present) + the contact row (from `answers.pii`).

A new funnel therefore gets a complete summary for free from its `enrichment` array +
standard steps. No new authoring fields.

Empty/missing answers are skipped; a funnel with no enrichment + no address still
renders a valid (contact-only) summary.

### B. Editing — inline, persisted via Customer entity CRUD

The confirmation view holds local `editing: EditTarget | null` state and swaps a local
editor in (AnimatePresence), mirroring the prototype. On **Save** each editor (1)
updates the local answer store via the engine and (2) persists to the backend:

| Row | Editor (reused UI) | Persistence path |
|-----|--------------------|------------------|
| Project dim | card-select tile grid | `enrichFunnelLead` → `customerCrud.update(leadMetaJSON.source.enrichment)` |
| Address | `AddressAutocomplete` | existing `setFunnelLeadAddress` → `customerCrud.update({address,city,state,zip})` |
| Contact | name / phone inputs | **new** `setFunnelLeadContact` → `customerCrud.update({name,phone})` |

Persistence is **explicit on Save**, not via the mounted `useProgressiveEnrichment`
effect. That effect dedupes on a monotonic `sentRef` set, so an edit-then-edit-back
would fail to re-send the original value. Calling the mutation directly on Save is
correct for edits. Progressive enrichment stays as-is for the forward pre-confirmation
flow; a harmless possible double-fire on a forward edit is acceptable (idempotent
merge).

#### New backend method (mirrors the two existing guarded patches)

`customerIntakeService.setFunnelLeadContact(ctx, { leadId, name, phone })`:

1. `customerCrud.getById(ctx, { id: leadId })`
2. Guard: refuse if `leadMetaJSON.source.kind !== 'funnel'` (`precondition-failed`).
3. `validatePhoneLine(phone, 'mobile-only')` — same mobile gate `submitLead` uses;
   fail-open on outage. Reject non-mobile with the same copy.
4. `customerCrud.update(ctx, { id: leadId, data: { name, phone } })`.

New public router proc `funnelsRouter.setFunnelLeadContact` — `baseProcedure`, leadId
UUID is the bearer capability, IP rate-limited (new `funnel:contact` limiter, 10/h like
address), input `{ leadId: uuid, name: 1..200, phone: e164 }`. New client hook
`useSetFunnelLeadContact` alongside `use-set-funnel-lead-address.ts`.

### C. Start over

Confirm-gated button in the summary footer → engine `reset()` (sets engine state to
`initial` → returns to step 1). The customer record is untouched; copy reassures the
request is already submitted ("your spot is safe").

## Contained changes to existing files

- **`types.ts`**
  - `PiiAnswer`: `{ leadId }` → `{ leadId, firstName, lastName, phone }`.
  - `StepProps`: add `setAnswerFor(stepId: StepId, value: AnswerValue): void` and
    `reset(): void`. Keeps props uniform across all step kinds.
- **`use-funnel-engine.ts`**: add `setAnswerFor` (generalizes `setAnswer`, which stays
  as the current-step convenience). `reset` already exists — thread it through.
- **`funnel-engine.tsx`**: pass `setAnswerFor` + `reset` into the rendered step.
- **`pii-form-step.tsx`**: `setValue({ leadId, firstName, lastName, phone })` (store the
  three new fields). `buildLeadInput` reads form data, not answers — unaffected.
  `useProgressiveEnrichment` reads `answers.pii.leadId` — unaffected.

## UI structure (new files, one component per file)

Under `ui/steps/confirmation/`:

- `confirmation-step.tsx` (the view; replaces the body of the current
  `ui/steps/confirmation-step.tsx`) — frosted hero plate (success lockup + Call / See-our-work
  CTAs) using `--hero-plate` / `--hero-plate-ring` / `--shadow-hero` / `--hero-ink-soft`;
  then a two-column block (what's-next timeline + summary card); manages `editing` state
  and the AnimatePresence swap.
- `confirmation-summary-card.tsx` — sections + rows + start-over footer.
- `confirmation-summary-row.tsx` — thumbnail/icon + label + value + edit pencil.
- `confirmation-edit-card.tsx` — card-select tile grid editor.
- `confirmation-edit-address.tsx` — address autocomplete editor.
- `confirmation-edit-contact.tsx` — name/phone inputs editor.
- `confirmation-reset.tsx` — confirm-gated start-over control.

Reuse: `ConfirmationTimeline` (existing), `OPTION_ICONS`, the card-tile styling from
`card-select-step.tsx`, `AddressAutocomplete`, `Input`, `Button`. Reduced-motion paths
preserved throughout. The project carousel is dropped (the prototype did); trivially
re-addable below the summary if wanted.

Tokens confirmed present in `globals.css`: `--shadow-hero`, `--hero-plate`,
`--hero-plate-ring`, `--hero-ink-soft`, `--measure-prose`, `--fs-eyebrow`,
`--tracking-eyebrow`.

## Error handling

- Mutation failures surface via the existing `toast.error` in the hooks/mutations; the
  editor stays open so the user can retry. Local answer-store update only commits
  alongside a successful save path (or is reverted on failure — implementation detail
  for the plan).
- Missing/!funnel lead on a patch → guarded `precondition-failed`, generic user copy.
- Non-mobile phone on contact edit → same rejection copy as `submitLead`.

## Testing

- `build-confirmation-summary.ts` — pure unit tests: enrichment dims resolve to
  label/value/asset in order; address row present/absent by step + answer; contact row
  from pii; graceful with empty answers / no enrichment.
- `setFunnelLeadContact` service — funnel-guard rejection, non-mobile rejection,
  happy-path `customerCrud.update` call.
- Manual: complete a kitchens funnel → confirmation shows project + details; edit each
  row type → value updates + persists (verify on the customer record); start-over
  returns to step 1 with the customer intact.

## Out of scope

- Non-enrichment qualifying questions in the summary (not stored on the customer).
- Engine `goTo` / real-step navigation.
- Editing zip (city/state derive from it; address supersedes it for display).
