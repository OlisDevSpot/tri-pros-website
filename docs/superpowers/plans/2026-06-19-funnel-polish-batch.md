# Funnel polish batch — enrich-note, CTAs, confirmation, live-zip, address step

Status: ✅ DONE (shipped 2026-06-22). Execution: subagent-driven-development on `main`. All of T1–T6 implemented and merged to `main`; the cross-session phone data-loss fix it depended on has landed (`optionalPhoneSchema` maps `undefined → undefined`).

Follow-up to the 2c-recut (`2026-06-19-funnel-plan-2c-recut-enrichment-confirmation.md`).
Source of the requirements + decisions: brainstorm session 2026-06-19 (this batch).

## ⚠️ Cross-session dependency — phone fix

A **separate session** is fixing a data-loss bug where `customerCrud.update` nulls
`customers.phone` on any partial update that omits `phone` (Zod-v4 transform fabricates
`phone: null`). Fix is a one-liner in `src/shared/lib/phone.ts` only — **no file overlap**
with this batch.

Two tasks here issue partial customer updates and therefore **runtime-depend** on that fix:
- **T5** (enrich → note) — already live via `enrichFunnelLead`.
- **T6** (address step) — new `setFunnelLeadAddress` update.

Sequence T5/T6 LAST and do not runtime-test them (in dev) until the phone fix has landed on
`main`; otherwise testing them will null the test lead's phone. Their *code* is independent.

## Global constraints (binding — copy into every task brief)

- **Lockstep step model**: adding a step kind edits FOUR things together — `AnswerByKind`,
  `ContentByKind`, the `FunnelStep` union, and `STEP_REGISTRY` — with `pnpm tsc` exhaustiveness
  as the net. Exactly ONE dispatch cast exists in `funnel-engine.tsx`; do not add another.
- **Content-free engine**: the engine/steps never hardcode trade copy. Per-funnel text lives in
  the spec (`constants/kitchens.ts`); shared option→label maps live in funnel-domain constants.
- **One React component per file. Named exports only. No file-level consts/util fns in component
  files** (extract to `constants/` / `lib/`). No barrels in `ui/`, `constants/`, `lib/`, `hooks/`.
- **Phone/URLs**: any phone uses `src/shared/constants/company` + `toDialString` (never hardcode);
  any external URL uses `getPublicBaseUrl()`.
- **DAL discipline**: services orchestrate; DAL implements. No `db.*` in routers/services. Reuse
  `customerCrud.update` / `addCustomerNote`; do NOT add ad-hoc DAL fns.
- **Gate**: `pnpm tsc` + `pnpm lint` (no test runner in repo — zero `*.test.*`). Manual browser
  smoke is controller-run, side-effecting, deferred to end.

## Locked decisions (recap)

1. **Enrich → customer note** (mirror Bina): enrichment stays in `leadMeta.source.enrichment`
   (ids); ALSO write a `📋 Funnel intake` customer note with humanized labels. NO profile-field
   mapping. (User: "treat exactly like a new bina lead → create a customer note with the metadata.")
2. **Confirmation full-width**: render the terminal/confirmation step in the landing's wide content
   zone (`max-w-5xl`), not the `max-w-xl` form shell. ("Same as the rest of the funnel.")
3. **Confirmation CTA**: primary `tel:` "Call now" (company phone) + secondary "See our work" →
   **site home** via `getPublicBaseUrl()`.
4. **CTA after the problem block**: a placed, reusable `cta` marketing block; section-relevant copy
   ("Learn how we do it"); **every CTA scrolls to the form** (Q1 anchor).
5. **Live-zip + anticipation**: resolve location live on valid input; gate the button on a resolved
   badge; varied checking cadence ~1s longer.
6. (folded into 5)
7. **Address step**: new `address` step kind reusing `AddressAutocomplete` + aerial/street preview;
   placed right before confirmation; persists via a guarded funnel update. **Appointment
   scheduling stays deferred** (later plan).

---

## Tasks

### T1 — Live-zip resolve + gated button + varied anticipation (#5 + #6)
**Files**: `ui/steps/location-step.tsx`, `ui/steps/zip-check-progress.tsx`,
maybe `lib/resolve-zip.ts` (no signature change), `constants/funnel-motion.ts` (durations).
**Approach**:
- Input phase: "Check My Area" **disabled** until a resolved badge exists.
- On input change (debounced ~350ms): only when `classifyZip(zip) === 'in-area'` (5-digit, SoCal
  `/^9[0-3]\d{3}$/`), call `resolveZip`; show a small spinner while pending. Use an `AbortController`
  so fast typing/deleting cancels stale requests.
- On resolve success → animate the location badge in (city + `county` when present) and **enable**
  the button. On invalid / <5 digits / 404 → no badge, button stays disabled.
- Deleting a char → `AnimatePresence` exit on badge, clear spinner, disable button, abort in-flight.
- Click "Check My Area" → checking phase is now **pure presentation** (resolve already done) with a
  **varied per-step cadence** (e.g. `[500, 950, 700, 1400]`, last step lingers; total ≈ +1s over
  today's flat 1800ms). `ZipCheckProgress` takes a `durations: number[]` (replace the single
  `stepMs`). Then advance to PII reusing the resolved `{city, state, county}`.
- Back-return (value present): mount with badge shown + button enabled, no refetch.
- Local CA zips resolve synchronously — accept instant badge (no forced spinner).
**Acceptance**: button disabled until badge; API only fires for valid SoCal-format zips; deleting a
char resets cleanly with exit/enter animation; checking cadence varied & ~1s longer; `tsc`+`lint`.

### T2 — Confirmation full-width (#2)
**Files**: `ui/funnel-engine.tsx` (+ confirmation grid widths if needed).
**Approach**: the focused shell is `max-w-xl`. Add a terminal-step branch (mirror the existing
`isFirst` special-case): when the current step is terminal (`!engine.hasNext`, i.e. confirmation),
render the step in a `max-w-5xl` content zone matching the landing's marketing/portfolio width, so
the "Recent Tri Pros work" gallery is wide. Keep heading/CTA readable (inner narrower wrapper is OK).
**Acceptance**: confirmation gallery spans the wide zone; non-terminal steps unchanged; `tsc`+`lint`.

### T3 — Confirmation CTA (#3)
**Files**: `ui/steps/confirmation-step.tsx`, `types.ts` (ConfirmationContent — only if adding fields).
**Approach**: add a primary `tel:` "Call now" button (company phone via `contactInfo` accessor
`'phone'` + `toDialString` for the href) and a secondary "See our work" linking to **site home**
(`getPublicBaseUrl()`). Hardcoding the two CTAs in the view (reading company constants) is fine —
no need to make them per-funnel configurable yet. Keep phone out of literals (use the constant).
**Acceptance**: both CTAs render & work (tel + external link); phone from company constants;
`tsc`+`lint`.

### T4 — `cta` marketing block + place after the problem block (#4)
**Files**: marketing lockstep in `types.ts` (MarketingBlock union + content), `constants/marketing-
registry.ts`, new `ui/blocks/cta-block.tsx`, `constants/kitchens.ts` (place the block), and a shared
`QUESTION_ANCHOR` constant (extract from `funnel-landing.tsx` so the block can target it).
**Approach**: add a `cta` marketing block kind, content `{ label: string }`. `CtaBlock` renders a
button that scrolls to the funnel question anchor (`document.getElementById(QUESTION_ANCHOR)
?.scrollIntoView({ behavior:'smooth', block:'start' })`) — self-contained, no prop threading. In
`kitchens.ts`, insert `{ kind:'cta', content:{ label:'Learn how we do it' } }` right after the
`problem` block. Leave the landing's existing every-3rd-block button as-is (all CTAs scroll to form).
**Acceptance**: a "Learn how we do it" CTA appears after the problem section and scrolls to Q1;
lockstep exhaustive (`tsc` green); `lint`.

### T5 — Enrich → Bina-style customer note (#1)  ⟂ needs phone fix for runtime
**Files**: new `lib/build-funnel-lead-note.ts` (funnel domain), new
`constants/enrichment-labels.ts` (funnel domain, id→label maps for homeType/age/scope/timeline),
`src/shared/services/customer-intake.service.ts` (`enrichFunnelLead`).
**Approach**:
- `constants/enrichment-labels.ts`: canonical id→label maps for the four enrichment dimensions
  (e.g. `single-family → 'Single-family'`, `5-15 → '5–15 years'`, `cabinets-counters →
  'Cabinets + counters'`, `1-3 → '1–3 months'`).
- `buildFunnelLeadNote(leadMeta)`: pure fn → returns a `📋 Funnel intake` note with the humanized
  Home type / Project age / Scope / Timeline lines (skip blank/null dims), or `null` if none.
  Mirror the shape/spirit of `entities/customers/lib/build-lead-note.ts`.
- `enrichFunnelLead`: after the existing `source.enrichment` merge + `customerCrud.update`, build the
  note from `nextLeadMeta` and write it via `addCustomerNote({ customerId: leadId, content,
  authorId: null })`. Best-effort — a note failure must NOT fail the enrich (log + continue), same
  as the ingest note pattern.
**Acceptance**: a funnel lead gets a `📋 Funnel intake` note with humanized values on enrich; ids
still stored in `source.enrichment`; note write is best-effort; `tsc`+`lint`. (Runtime check
deferred until phone fix is on `main`.)

### T6 — Full-address step (Google autocomplete) before confirmation (#7)  ⟂ needs phone fix
**Files**: lockstep in `types.ts` (`address` kind: `AnswerByKind`, `ContentByKind`, `FunnelStep`,
`STEP_REGISTRY`), new `ui/steps/address-step.tsx` (+ `ADDRESS_STEP` prebuilt), new
`hooks/use-set-funnel-lead-address.ts`, `src/trpc/routers/funnels.router.ts`
(`setFunnelLeadAddress` guarded mutation + rate-limit), `customer-intake.service.ts`
(`setFunnelLeadAddress` service method, funnel-leads-only guard), `constants/kitchens.ts` (wire step).
**Approach**:
- Answer type = `AddressFields` (from `@/shared/lib/google-maps-helpers`); content `{ title,
  subtitle? }`.
- `AddressStepView`: wrap `AddressAutocomplete` (in `@vis.gl/react-google-maps` `APIProvider` with
  `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) + the aerial/street preview (reuse the look from
  `address-edit-dialog.tsx`’s `SelectedPreview`). On select → `setValue(fields)`. The shell Next /
  a Continue gates on a picked address.
- Persist on advance: `useSetFunnelLeadAddress()` fires `setFunnelLeadAddress({ leadId:
  answers.pii.leadId, address, city, state, zip })`. Guarded mutation (baseProcedure, uuid leadId,
  funnel-leads-only guard mirroring `enrichFunnelLead`, rate-limited). Service writes via
  `customerCrud.update` (safe once phone fix lands; triggers geocode hook). Best-effort.
- Wire into `kitchens.ts`: order becomes `… timeline → address → confirmation`.
- **Appointment/scheduling stays deferred** — do not add a scheduling step.
**Acceptance**: address step renders Google autocomplete + preview; picking enables advance; on
advance the lead’s address/city/state/zip persist (funnel-leads-only); step sits right before
confirmation; `tsc`+`lint`. (Runtime check deferred until phone fix is on `main`.)

---

## Sequencing
1. **T1, T2, T3, T4** — independent of the phone fix; do first (T2+T3 both touch confirmation —
   can run back-to-back).
2. **T5, T6** — code-independent but runtime-depend on the phone fix; build after T1–T4, and hold
   their dev browser smoke until the phone fix is on `main`.
3. Final whole-branch review, then the controller-run browser smoke for the whole batch.
