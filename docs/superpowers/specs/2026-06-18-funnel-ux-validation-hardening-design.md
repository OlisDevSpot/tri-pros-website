# Funnel UX & Validation Hardening — Design

**Status:** Approved design. Feeds Plan **2b.5** (this round) then **2c** (enrichment/confirmation).
**Owner:** Oliver P
**Date:** 2026-06-18
**Relationship:** **Amends** `2026-06-18-funnelspec-step-model-design.md` (the hardened step model) and realizes the deferred parts of `2026-06-18-funnels-headless-step-library-design.md`. Where this doc and the step-model spec disagree, **this doc governs** for the items in §1 (it removes the `info` kind and adds `FunnelSpec.hero`). Everything else in the step-model spec stands.

> **Read for the *why*.** Each requirement states the problem (grounded in the landed code), then the decision. These were validated against the real code in `src/shared/domains/funnels/` on 2026-06-18, plus three Context7-backed research passes (RHF/zod form architecture, Twilio Lookup, email validation).

---

## 0. Intent (owner's 11 requirements)

UI/UX: (1) Next button on revisited/answered steps; (2) assets (SVG/icon/image) on choice options; (3) **hero is not a funnel step** — it's the offer-aligned landing that *frames* the first question; (4) ZIP "check my area" needs real anticipation + correct post-check label; (5) ZIP answer must survive Back; (6) **continuous** progress bar (one fill, accounts for post-PII steps); (7) map enter/exit animation on ZIP qualify (defer to 2c).

Form logic: (FL1) best-practice multi-step RHF + shadcn + zod; (FL2) email optional, ZIP region-validated; (FL3) email validation; (FL4) phone validation.

**Bucketing that drives the plans:**
- **Group A — foundational model changes** (§1): #3, #1, #2, #6. Amend the step model.
- **Group B — shipped-behavior bugs** (§2): #4, #5, FL2-email.
- **Group C — form architecture & validation** (§3): FL1, FL4, FL3, FL2-zip.
- **Deferred to 2c**: #7 (rides the region-map task).

---

## 1. Foundational model changes (amends the step-model spec)

### 1.1 Hero is not a step — it frames step 1 (`info` kind removed)

**Problem.** Today the hero **is** `steps[0]` with `kind:'info'` ([kitchens.ts:13-22](../../../src/shared/domains/funnels/constants/kitchens.ts)). So on first load the user is already "inside" the funnel chrome, clicking through a content step. The owner's model: the page first shows an **offer-aligned landing band** (it sells *why* to do the funnel — for us, the Showcase), and that band **contains the first question**. Answering Q1 *enters* the funnel at Q2.

**Decision (approved): the hero is a *presentation mode of step 1*, not a separate page or a step.**
- Add `FunnelSpec.hero: HeroContent` (landing copy + media). It is funnel metadata, **not** an entry in `steps[]`.
- **Remove the `info` kind entirely** — a lockstep delete across the four sites the step-model spec defined: `AnswerByKind`, `ContentByKind`, the `FunnelStep` union (drop `InfoStep`), and `STEP_REGISTRY`. `tsc` enforces all four. Delete `ui/steps/info-step.tsx`.
- `steps[0]` becomes the **first real question** (a `card-select`, e.g. kitchen layout).
- The engine shell, **while `engine.isFirst`** (history empty, on `steps[0]`), wraps the step in a `FunnelHero` band rendered from `spec.hero` and **suppresses the progress bar**. Tapping an answer advances → the hero unmounts → normal funnel chrome (progress + step transitions) takes over from `steps[1]`.

**Why this model (vs. a separate landing page + engine):** one engine, so Q1's answer persists through the same store with no cross-boundary handoff. Rejected the separate-page model purely to avoid that handoff.

**`HeroContent` shape** (replaces today's hero-as-`info` content; the existing `HeroContent` interface is repurposed):
```ts
export interface HeroMedia { kind: 'image', src: string, alt: string } // extend later if needed
export interface HeroContent {
  headline: string
  subhead: string
  scarcityLine: string
  /** Optional prompt that introduces the embedded first question, e.g. "Start here ↓". */
  prompt?: string
  media?: HeroMedia
}
```
The embedded question is just `steps[0]` rendered below the band; there is **no separate hero CTA button** — answering Q1 is the action.

### 1.2 Navigation lifts into the shell + revisit/Next semantics (#1)

**Problem.** Each step hand-rolls its own Back button keyed on `!isFirst` (card-select, location, pii all repeat it), and `card-select` **always** `advance()`s on select ([card-select-step.tsx:9](../../../src/shared/domains/funnels/ui/steps/card-select-step.tsx)). So revisiting an answered step and tapping re-advances instantly — no chance to review. There is no Next button anywhere.

**Decision.** **Lift Back/Next chrome into the engine shell.** Introduce a per-step **review state** driven by a new derived signal:
- `StepProps` gains `isAnswered: boolean` (= `value != null`).
- The shell renders a nav row: **Back** when `history.length > 0`; **Next** when `isAnswered` **and** a forward step exists. Next calls `advance()`.
- Each step uses `isAnswered` to switch off first-time auto-commit:
  - **card-select**: first select (`!isAnswered`) → `setValue` + `advance` (micro-commitment preserved). Revisit (`isAnswered`) → `setValue` only (highlight changes; the shell's **Next** advances).
  - **location**: first qualify writes `value`; revisit reads `value` and renders the qualified view **without** re-checking; **Next** advances (see §2.1, §2.2).
  - **pii-form**: first submit creates the lead and advances; revisit (`isAnswered` — `value.leadId` exists) renders the form pre-filled and **does not re-submit** — **Next** advances. This is also how we avoid duplicate lead creation on back-and-forward.
- Remove the three per-step Back buttons; the shell owns nav. Steps keep only their **primary action** affordance (card taps; "Check my area"; "Submit"), shown only in the first-time (`!isAnswered`) state.

### 1.3 Assets on choice options (#2)

**Problem.** `OptionContent.icon?: string` exists in [types.ts:35](../../../src/shared/domains/funnels/types.ts) but is **never rendered**, and a single string can't carry an inline SVG vs. a raster image vs. a named icon. The owner wants branded, asset-bearing option cards (aligns with the **funnel-design-standards** memory: trade SVG icons, branded card grids).

**Decision.** Replace the unused `icon?: string` with a discriminated asset model on `OptionContent`, and render it in `card-select-step`:
```ts
export type OptionAsset =
  | { kind: 'icon', name: string }    // resolved via an icon registry (e.g. lucide / local trade-icon map)
  | { kind: 'image', src: string, alt: string }
export interface OptionContent {
  label: string
  description?: string
  asset?: OptionAsset
}
```
- An **icon registry** (`constants/option-assets.tsx` or reuse an existing trade-icon map) resolves `{kind:'icon', name}` → a React component. `{kind:'image'}` renders `next/image`. Unknown/absent → label-only (graceful).
- The card grid renders the asset above the label; theming via the existing `data-funnel={slug}` CSS-var seam.

### 1.4 Continuous progress bar (#6)

**Problem.** [funnel-progress.tsx](../../../src/shared/domains/funnels/ui/funnel-progress.tsx) renders discrete segments off `spec.steps.length`, filling `i <= currentIndex`. The owner wants a single **continuous** fill that keeps climbing through the post-PII enrichment steps (so PII doesn't read as ~100%).

**Decision.**
- One bar, **motion-animated width** (`motion/react`; respect `useReducedMotion`). See the **feedback-motion-patterns** memory.
- **Hidden during the hero** (`isFirst`) — no funnel chrome on the landing band (§1.1).
- Denominator = `spec.steps.length` (hero is no longer a step, so it's naturally excluded). 2c's enrichment steps live in `spec.steps`, so the denominator **auto-grows** and PII sits mid-bar.
- `progress = (currentIndex + 1) / spec.steps.length`. For branching funnels this reflects position in the **declared** step order (documented caveat; acceptable — our funnels are near-linear).

---

## 2. Shipped-behavior bug fixes (Group B)

### 2.1 ZIP answer must survive Back (#5) — **confirmed bug**

[location-step.tsx:10-11](../../../src/shared/domains/funnels/ui/steps/location-step.tsx) holds `zip`/`phase` in local `useState` and **never reads the `value` prop**. The composite *is* persisted in the engine (`answers.location`), but the component re-initializes empty on remount. **Fix:** seed local state from `value` — if `value?.zip` is present, mount directly in the `qualified` phase with the stored `{zip,city,state,county}`; the shell's **Next** advances (§1.2). No re-check, no re-fetch.

### 2.2 ZIP phase-label split (#4) — **confirmed bug** (was deferred Minor M-2b-1)

The qualified button renders `content.cta ?? 'Continue'`, but `ZIP_STEP.content.cta` is `'Check my area'`, so after checking it still says "Check my area." Root cause: `LocationContent` conflates **one** `cta` across the input and qualified phases. **Fix:** split the label fields:
```ts
export interface LocationContent {
  title: string
  subtitle?: string
  inputCta?: string        // input phase   — default "Check my area"
  checkingLabel?: string   // checking phase
  qualifiesLabel?: string  // qualified headline
  // (no continue label needed — the shell's Next advances; see §1.2)
}
```

### 2.3 ZIP perceived-latency / anticipation (#4)

Local ZIPs resolve from the in-memory `CA_ZIP_CITIES` map essentially instantly, so the `checking` phase flashes — no anticipation. **Fix:** enforce a **minimum perceived duration** (~1.2s) on the checking phase regardless of how fast `resolveZip` returns, with the spinner + "Checking availability in {zip}…" copy. This is the moment that makes the area feel *qualified*; it must breathe. (The full SVG region reveal is **#7 → 2c**.)

---

## 3. Form architecture & validation (Group C)

### 3.1 Form ownership + async validation pattern (FL1) — Context7-validated

**Finding:** RHF's own docs recommend an **external store** for multi-step wizards. `useFunnelEngine` already *is* that store. **Decision: keep per-step `useForm`** — do **not** introduce a single spanning form. The current model is idiomatic; **no engine change for FL1.**

**Async validation pattern (new, shared):** debounced async field checks (phone) go in RHF's **`validate`** option — **never** in the zod schema (an async refinement forces `parseAsync` on *every* keystroke). Add a small reusable hook:
```ts
// hooks/use-debounced-async-validator.ts — debounce + AbortController; resolves true on abort
function useDebouncedAsyncValidator<T>(
  fn: (value: T, signal: AbortSignal) => Promise<true | string>, delayMs = 600,
): (value: T) => Promise<true | string>
```
Form config: `mode: 'onBlur'`, `reValidateMode: 'onBlur'`. Pre-fill cross-step values via `defaultValues` (as PII already does for `city`); if reactive re-population on back-nav is ever needed use RHF's `values` prop + `resetOptions.keepDirtyValues` — **never** `useEffect(() => form.reset())`.

### 3.2 Phone — hard gate (FL4) — **owner decision: gate, don't warn**

Phone is the **primary** contact channel: "no valid phone number == not a real lead." So we **gate** — but on a *definitive invalid verdict*, never on uncertainty (a Twilio outage must not silently drop 100% of leads).

**Flow (defense in depth):**
1. **Client pre-filter (free):** `libphonenumber-js/min` `isValid(value, 'US')`. Fails → inline field error, no network call. *(New dep: `libphonenumber-js`.)*
2. **Client debounced lookup (UX):** once `isValid`, a debounced (~600–800ms) + on-blur call to the server lookup proc; cache the result per E.164 for the session so the same number isn't re-fetched. Surfaces the verdict inline before submit.
3. **Server-authoritative gate (the real gate):** at submit, the lead-creation path re-runs the lookup server-side (a crafted client request can't bypass it).

**Verdict → action:**
| Twilio result | Action |
|---|---|
| client `isValid` fails, **or** `valid: false` (+ `validationErrors`) | **BLOCK** — field error. Definitive garbage. |
| `valid: true`, line type mobile/landline/fixedVoip/nonFixedVoip | **PASS** — real, reachable. VoIP (Google Voice etc.) is a real customer. |
| **Twilio unreachable / timeout / indeterminate `errorCode`** | **FAIL OPEN** — accept the lead, tag `phoneStatus: 'unverified'`. The gate is "Twilio says fake," never "Twilio didn't answer." |

**Placement (respects service/provider layering):**
- **Provider leaf:** add `lookupPhoneNumber(e164): Promise<{ valid, lineType, carrierName, errorCode, validationErrors }>` to `twilioClient` ([client.ts](../../../src/shared/services/providers/twilio/client.ts)) — primitives in/out, no domain types, matching the existing superset-client pattern. Uses Lookup v2 `fields: 'line_type_intelligence'`.
- **Gate logic (business rule):** a pure function in a funnels lib, e.g. `lib/evaluate-phone-gate.ts` (`(lookup) => { ok: boolean, status: 'verified'|'invalid'|'unverified', reason? }`), implementing the table above incl. fail-open. **Not** in the provider, **not** raw in the router.
- **tRPC:** a thin `baseProcedure` (public funnel) — `phone.lookup` (or co-located in the funnel router) calls the provider; the **submit path** calls the gate before `createFromIntake`.
- **Storage:** add an optional source-agnostic operational field to `leadMetaSchema` ([customers/schemas/index.ts:66](../../../src/shared/entities/customers/schemas/index.ts)):
  ```ts
  phoneVerification: z.object({
    status: z.enum(['verified', 'unverified']),  // 'invalid' never reaches creation (gated out)
    lineType: z.string().nullable(),
    carrierName: z.string().nullable(),
  }).optional(),
  ```
  Sits beside `interestedTradesRaw`/`originCampaign` — generic operational metadata, not under `source`.

**Cost:** ~$0.005/lookup; the `isValid` pre-filter + per-session cache keep it to roughly one paid lookup per real submission (~$10–40/mo at funnel volume). Lookup pricing **must be re-confirmed in the Twilio console before launch** (Context7 didn't return a hard figure).

### 3.3 Email — optional, format-only (FL2/FL3) — **owner decision: keep simple**

Make email **optional**, **format-only**, **no new dependency**, no deliverability/MX, no typo lib.
```ts
// pii.schema.ts — email currently required via z.email(); make optional:
email: z.email('Please enter a valid email').optional().or(z.literal('')),
```
`buildLeadInput` must tolerate an empty/absent email. (We're on zod v4, so `z.email()` is correct.)

### 3.4 ZIP — Southern-California region validation (FL2-zip)

Goal is **typo-prevention**, not strict territory gating (we'd rather qualify an adjacent SoCal homeowner than reject them). Layer onto `resolveZip` ([resolve-zip.ts](../../../src/shared/domains/funnels/lib/resolve-zip.ts)):
- **Format guard:** `^9[0-3]\d{3}$` (SoCal range ≈ 90001–93599: LA/OC/SD/Inland Empire/Ventura). Outside → "We don't serve that area yet" (not-qualified view).
- **Resolution:** known service-area ZIP (the 45 in `CA_ZIP_CITIES`) → qualified. Else Zippopotam confirms a real CA ZIP → qualified (soft). Non-CA / unresolvable → not-qualified.
- The not-qualified state is a real `location` phase (distinct from `checking`/`qualified`) with a graceful message; it does **not** create a lead.

---

## 4. Map animation seam (#7) — deferred to 2c

The qualified phase already carries the seam comment ([location-step.tsx:66](../../../src/shared/domains/funnels/ui/steps/location-step.tsx)). 2c's region-map task replaces the qualified view with a stylized SVG region reveal + motion enter/exit. **2b.5** only delivers the corrected phase machine (§2.1–2.3, §3.4) the map will plug into.

---

## 5. Type-model deltas (concrete)

| Site | Change |
|---|---|
| `AnswerByKind` | remove `'info'` |
| `ContentByKind` | remove `'info'` |
| `FunnelStep` union | remove `InfoStep` |
| `STEP_REGISTRY` | remove `info` entry |
| delete | `ui/steps/info-step.tsx` |
| `FunnelSpec` | **add** `hero: HeroContent` |
| `HeroContent` | repurpose to landing band (headline/subhead/scarcity/prompt?/media?) |
| `StepProps` | **add** `isAnswered: boolean` |
| `OptionContent` | drop `icon?: string`; **add** `asset?: OptionAsset` |
| `LocationContent` | split `cta` → `inputCta`/`checkingLabel`/`qualifiesLabel`; **add** not-qualified copy |
| `pii.schema.ts` | `email` → optional |
| `leadMetaSchema` | **add** optional `phoneVerification` |
| Twilio `client.ts` | **add** `lookupPhoneNumber` leaf method |
| new files | `hooks/use-debounced-async-validator.ts`, `lib/evaluate-phone-gate.ts`, `constants/option-assets.tsx`, `ui/funnel-hero.tsx`, phone-lookup tRPC proc |

Each funnel config (`kitchens.ts`, `bathrooms.ts`, `complete-interior.ts`) drops its `info` hero step and gains a `hero:` block; `steps[0]` becomes the first question.

---

## 6. Stop-lines / non-goals

- **No spanning `useForm`** — per-step forms stay (RHF-recommended for wizards with an external store).
- **No async checks inside zod schemas** — `parseAsync` penalty; use RHF `validate`.
- **No email deliverability / MX / typo lib** — optional field, format-only.
- **No phone fail-*closed*** — gate on definitive-invalid only; fail open on Twilio outage.
- **No XState, no engine genericization, no factory, no normalized store/plugin/CMS** — carried over from the step-model spec §10.
- **No region map in 2b.5** — deferred to 2c (#7).
- **No Seam-B UI-override registry yet** — still deferred (step-model spec §9).

---

## 7. How this maps to the plans

- **Plan 2b.5 — Funnel UX & Validation Hardening** (this doc, Groups A + B + C minus the map): the model amendments (§1), the ZIP bug fixes (§2), per-step async-validate plumbing + hard-gated phone + optional email + ZIP region check (§3). Lands **before** 2c.
- **Plan 2c — Enrichment & Confirmation** (re-cut after 2b.5): datetime + confirmation kinds plug into the continuous-progress + revisit/Next model; the region-map reveal (#7) lands here.

Sequencing rationale: §1 changes the central `FunnelSpec`/step model — exactly the "get it wrong and everything downstream is awkward" risk that drove the original hardening. Land it first; 2c builds on the corrected model.
