# Phone line-type validation — design spec

Status: drafted (2026-06-22). Brainstormed in this session. Next: writing-plans.
Scope: phone validation only. **ZIP validation is a separate spec to follow.**

## Goal

Gate phone inputs by **line type** so the funnel only accepts **mobile** numbers
(non-mobile → "Please use a mobile number only."), while the dashboard intake and
general-inquiry forms accept **mobile or landline**. Keep paid Twilio lookups
**infrequent** by validating cheaply first. One generic, policy-parameterized gate
used by all surfaces.

## Background — what already exists (verified in code)

The **funnel** already has the full pipeline:
- Free local check first: `isValidPhoneNumber(raw,'US')` + `parsePhoneNumber` → E.164,
  in `useDebouncedAsyncValidator` (PII step, `mode:'onBlur'`).
- Paid Twilio lookup: `twilioClient.lookupPhoneNumber(e164)` uses
  `line_type_intelligence` → `{ valid, lineType, carrierName, errorCode }`. **We already
  pay for the mobile-vs-landline signal — we just don't act on it.**
- tRPC `funnelsRouter.phoneLookup` — rate-limited (per-IP 20/h), global ceiling (300/h,
  fail-open), 5s timeout, returns the raw lookup.
- Gate `src/shared/domains/funnels/lib/evaluate-phone-gate.ts` — currently blocks only on
  `valid===false`; **fails open** on null/error/timeout; ignores `lineType`.
- Server-authoritative re-gate in `funnelsRouter.submitLead`.

What does **not** exist:
- The gate never inspects `lineType` (no mobile-only enforcement anywhere).
- **Dashboard intake** (`src/features/intake/`) uses `requiredPhoneSchema` (format only) —
  no line-type lookup.
- **General-inquiry** (`src/features/landing/`) — schema re-exported from
  `@/shared/entities/landing/schemas`; the `ui/components/forms/general-inquiry-form.tsx`
  variant collects phone (a second `contact/` variant exists — planning confirms which is
  live and whether phone is required there). No line-type lookup.

## Locked decisions

1. **Strict mobile for the funnel.** Only Twilio `lineType === 'mobile'` passes.
   Landline, VoIP (fixed + non-fixed), toll-free = non-mobile → blocked.
2. **Indeterminate fails OPEN + flagged.** `unknown` lineType / lookup error / timeout /
   cost-ceiling-hit / `null` → accept the lead (never drop it), tag it `unverified-line`.
   Applies under every policy. (A definitive non-mobile verdict is the *only* thing that
   blocks on line type.)
3. **Two policies, one generic helper.** `mobile-only` (funnel) and `mobile-or-landline`
   (intake + general-inquiry). `mobile-or-landline` = allow-set `{mobile, landline}`;
   VoIP/toll-free still blocked there (only landline added vs the funnel). The dashboard
   intake **hard-blocks** on a failed gate just like the funnel — a non-{mobile,landline}
   number is unusable to sales, so there's no warn-only mode.
4. **US-only.** Local check rejects anything that isn't a valid US (+1, 10-digit) number
   *before* any paid call.
5. **Warn on blur, hard-block on submit.** Show the line-type error as soon as we have a
   definitive verdict on blur; the authoritative block is server-side at submit.
6. **Silent on uncertainty.** Show "Please use a mobile number only" *only* on a definitive
   non-mobile verdict; on `unverified-line`, accept silently and tag.
7. **Cost layers: B1 + B3 only.** B1 (stronger free pre-filter) and B3 (per-number dedupe
   via the existing client-side cache). **No** cross-session Redis verdict cache (B2 dropped
   — not worth new infra).
8. **The line-type gate lives in the Twilio provider's `lib/`.** Phone line-type validation
   is Twilio's concern, so the business function lives in `providers/twilio/lib/` (matches the
   established `providers/<x>/lib/` convention). Each surface's *existing* router/server-action
   (funnel → `funnelsRouter`, general-inquiry → `landingRouter`, intake → its router) calls
   that one provider function. **No new shared `phoneRouter`.** Generic *format* checks (B1)
   stay in `shared/lib/phone.ts` (libphonenumber's domain, not Twilio's) and are *called by*
   the provider function as the cheap pre-pay gate.

## Requirements

### Validation behavior
- **R1** Funnel rejects a definitive non-mobile number with exactly **"Please use a mobile
  number only."**
- **R2** Intake + general-inquiry reject a definitive VoIP/toll-free number with a
  line-type message; landline and mobile both pass.
- **R3** A paid Twilio lookup fires **only after** the free local check passes (valid US
  10-digit E.164 that survives the B1 pre-filter).
- **R4** Indeterminate results (unknown/error/timeout/ceiling/null) **pass + flag**
  `unverified-line` under every policy. Never drop a lead on uncertainty.
- **R5** Validation runs **on blur**, not per keystroke. Re-editing a number after a verdict
  **invalidates** the prior verdict (re-validate on the new value).
- **R6** Submit is server-authoritative: each surface re-runs lookup + gate server-side with
  its policy; the client verdict is advisory only.

### Cost control
- **R7 (B1)** A free local pre-filter rejects obvious junk before any paid call: length≠10,
  all-same-digit, trivially sequential, `555-01xx`, invalid/again area codes. Lives in
  `src/shared/lib/phone.ts` (extends today's looser `isValidPhoneNumber`-only check).
- **R8 (B3)** One paid lookup per unique number per session — no re-pay on repeated blurs of
  an unchanged number (existing client cache / `staleTime`; no new infra).
- **R9** Every surface's lookup goes through the **same Twilio-provider function**
  (`validatePhoneLine`), which carries the global cost ceiling; each surface's router
  additionally applies its own per-IP rate-limit. The new public general-inquiry surface can't
  become an unbounded cost/abuse vector.

### Generic helper
- **R10** A single Twilio-provider function `validatePhoneLine(e164, policy)` (in
  `providers/twilio/lib/`) does cheap-pre-filter → lookup → line-type gate and returns the
  verdict, used by ALL surfaces' routers. The pure gate `evaluatePhoneLineGate(lookup, policy)`
  is a sibling unit in the same `lib/` that interprets Twilio's result (structural input, no
  SDK dependency, unit-testable).

### Data + observability
- **R11** Persist the line-type verdict on the created lead/customer: `lineType`,
  `carrierName`, and a `status` of `verified-mobile` | `verified-landline` |
  `unverified-line` (in lead/customer meta), so sales can see the line quality and the
  `unverified-line` flag is durable.
- **R12** Log each lookup outcome and each line-type block (counts by surface + verdict) so
  the false-block rate is measurable and thresholds are tunable.

## Architecture

- **`src/shared/services/providers/twilio/lib/validate-phone-line.ts`** (new) — the
  Twilio-provider business function (server-only). Lives in the provider's `lib/` because
  line-type validation is Twilio's concern (matches the established `providers/<x>/lib/`
  convention).
  - `validatePhoneLine(e164: string, policy: LinePolicy): Promise<PhoneLineVerdict>`
    1. **cheap pre-filter** via `shared/lib/phone` (B1) — obvious junk → invalid verdict, NO
       paid call;
    2. **global cost ceiling** check (Twilio-cost concern lives here);
    3. `twilioClient.lookupPhoneNumber(e164)` with timeout;
    4. `evaluatePhoneLineGate(lookup, policy)` → verdict.
    Fail-open: any lookup error / timeout / ceiling hit → `ok:true, status:'unverified-line'`.
  - **`evaluatePhoneLineGate(lookup, policy)`** — sibling pure unit in the same provider
    `lib/`, interprets Twilio's result:
    - `type LinePolicy = 'mobile-only' | 'mobile-or-landline'`
    - Input: structural `{ valid; lineType; errorCode } | null` (no SDK dependency).
    - Verdict `PhoneLineVerdict`: `{ ok, status: 'verified-mobile' | 'verified-landline' |
      'unverified-line'; lineType; carrierName; blockedReason?: 'non-mobile' | 'line-type' }`.
    - Rules: `null` / `errorCode!=null` / `lineType==null|'unknown'` → `ok:true,
      'unverified-line'`. `!valid` → `ok:false` (invalid). `lineType ∈ allow(policy)` →
      `ok:true`. else → `ok:false, blockedReason`.
    - `allow('mobile-only')={mobile}`; `allow('mobile-or-landline')={mobile, landline}`.
- **`src/shared/lib/phone.ts`** — add the B1 format pre-filter (`isPlausibleUsPhone`),
  libphonenumber-based and generic (not Twilio's job). Called by `validatePhoneLine` as the
  cheap pre-pay gate; reusable anywhere a free check is wanted.
- **`src/shared/domains/funnels/lib/evaluate-phone-gate.ts`** — **removed**; its logic moves
  into the provider `lib/`. The funnel router calls `validatePhoneLine(e164,'mobile-only')`.
- **Per-surface routers call the provider function — no new shared router:**
  - **Funnel** → `funnelsRouter`: the live-UX `phoneLookup` procedure returns the **verdict**
    (runs `validatePhoneLine(e164,'mobile-only')` server-side — policy stays server-side, the
    client only renders the message); `submitLead` re-runs it authoritatively.
  - **General-inquiry** → `landingRouter` (where its submit already runs): its procedure calls
    `validatePhoneLine(e164,'mobile-or-landline')`.
  - **Dashboard intake** → its router/server-action: calls
    `validatePhoneLine(e164,'mobile-or-landline')` and **hard-blocks** on `ok:false`.
  - Each router keeps its own per-IP rate-limit; the global cost ceiling lives in the provider
    function.
- **Shared on-blur validator (client)** — generalize the funnel's debounced-async-validator so
  each form's phone field calls its surface's verdict procedure on blur and renders the
  message. The policy never ships to the client.

## Data flow (per surface)

1. User types phone → on blur, the client calls its surface's verdict procedure with the
   typed number. (Skipped for an unchanged number — existing client cache = B3 dedupe.)
2. Server `validatePhoneLine(e164, policy)`: cheap pre-filter (no paid call on junk) → ceiling
   check → Twilio lookup → gate. Returns the **verdict only** (policy stays server-side).
3. Client renders from the verdict:
   - `ok:false` line type → line-type message (funnel: "Please use a mobile number only.").
   - `ok:false` invalid/format → format message.
   - `ok:true` → clear; any `unverified-line` flag is invisible to the user.
4. Submit → server re-runs `validatePhoneLine` authoritatively with the surface's policy. On
   pass, persist `lineType`/`carrierName`/`status` (R11) and proceed; on `ok:false`, block.

## Error handling

Fail-open is load-bearing (R4): a Twilio outage, timeout, or ceiling hit must never drop a
lead — accept + `unverified-line`. The only line-type block is a **definitive** non-allowed
verdict. Local pre-filter and format errors block cheaply client-side and never reach Twilio.

## Out of scope

- ZIP validation (separate spec, next).
- Cross-session Redis verdict cache (B2 — explicitly dropped).
- iOS autofocus / keyboard (separate handoff).
- Loosening the dashboard intake policy beyond `mobile-or-landline` (revisit only if it
  blocks real customers).

## Open items to confirm during planning

- General-inquiry: which form variant is live (`forms/` vs `contact/`) and whether phone is
  required there (drives whether it needs gating at all). Its submit runs in `landingRouter`.
- Exact persistence location for R11 (funnel lead meta vs customer record vs both).

*Resolved in brainstorm:* line-type gate lives in `providers/twilio/lib/`, called by each
surface's existing router — no shared `phoneRouter`; dashboard intake **hard-blocks**.

## Testing / gate

No test runner in repo (zero `*.test.*`). Gate = `pnpm tsc` + `pnpm lint` + manual browser
smoke per surface. Pure helpers (`evaluatePhoneLineGate`, B1 pre-filter) are the most
test-worthy units if a runner is ever added.
