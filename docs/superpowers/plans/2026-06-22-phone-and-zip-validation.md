# Phone Line-Type + Funnel ZIP Service-Area Validation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate phone inputs by Twilio line type (funnel = mobile-only; intake + general-inquiry = mobile-or-landline) and gate the funnel ZIP step to the real Tri Pros service area, rejecting out-of-area ZIPs at the input.

**Architecture:** One Twilio-provider function `validatePhoneLine(rawPhone, policy)` in `providers/twilio/lib/` (cheap free pre-filter → global ceiling → Twilio lookup → pure policy gate) called by every surface's existing router. ZIP gate is a pure local `isInServiceArea(zip)` over a generated served-ZIP `Set`, wired into the funnel's existing (currently dark) out-of-area UX.

**Tech Stack:** Next.js 15 / React 19 / tRPC / Zod / Upstash Ratelimit+Redis / Twilio Lookup v2 (`line_type_intelligence`) / libphonenumber-js / motion/react.

**Specs:** `docs/superpowers/specs/2026-06-22-phone-line-type-validation-design.md`, `docs/superpowers/specs/2026-06-22-funnel-zip-service-area-validation-design.md`.

## Global Constraints

- **No test runner in the repo** (zero `*.test.*`). Verification per task = `pnpm tsc` + `pnpm lint`, plus a one-off `pnpm tsx -e '…'` sanity check for pure functions, plus manual browser smoke for UI/integration. **NEVER run `pnpm build`.**
- **Funnel non-mobile message is exactly:** `Please use a mobile number only.`
- **Fail-open is load-bearing:** indeterminate lookup (null / error / timeout / ceiling-hit / `lineType` null|`'unknown'`) → `ok:true, status:'unverified-line'`. Never drop a lead on uncertainty.
- **Phone home:** all phone transforms go through `src/shared/lib/phone.ts`; E.164 only at external boundaries via `toE164`; storage is bare 10-digit. Never hardcode/parse phones elsewhere.
- **Provider boundary:** Twilio line-type *business logic* lives in `src/shared/services/providers/twilio/lib/`; routers orchestrate and call it. No new shared `phoneRouter`.
- **ZIP gate is local** (no API). The existing `zippopotam` resolve stays, but only to display the in-area city badge.
- **Code style:** named exports only (no `export default`); one React component per file; imports sorted (`perfectionist/sort-imports`, alphabetical, external before internal); `antfu/if-newline` (always braces + newline); no file-level consts/utils in component files.
- **Git:** user works directly on `main`; commit per task with explicit pathspec; **do not push**.

---

# PART A — Phone line-type validation

### Task 1: Free plausibility pre-filter (`isPlausibleUsPhone`)

**Files:**
- Modify: `src/shared/lib/phone.ts` (add one exported function after `toDialString`, before the `// ── Zod ──` section)

**Interfaces:**
- Consumes: existing `toNationalDigits(input)` in the same file.
- Produces: `isPlausibleUsPhone(input: string | null | undefined): boolean` — used by Task 3.

- [ ] **Step 1: Add the function**

```ts
/**
 * Cheap, FREE plausibility gate — runs BEFORE any paid line-type lookup so
 * obvious junk never costs money. Rejects non-US-10-digit input, all-same-digit,
 * trivial sequential runs, NANP-illegal area/exchange (must start 2-9), and the
 * reserved fictional 555-01xx range. `true` means "worth a paid lookup", NOT
 * "guaranteed real".
 */
export function isPlausibleUsPhone(input: string | null | undefined): boolean {
  const n = toNationalDigits(input)
  if (!n) {
    return false
  }
  if (/^(\d)\1{9}$/.test(n)) {
    return false
  }
  if (n === '1234567890' || n === '0123456789' || n === '9876543210') {
    return false
  }
  const area = n.slice(0, 3)
  const exchange = n.slice(3, 6)
  const subscriber = n.slice(6)
  if (area[0] === '0' || area[0] === '1' || exchange[0] === '0' || exchange[0] === '1') {
    return false
  }
  if (exchange === '555' && subscriber.startsWith('01')) {
    return false
  }
  return true
}
```

- [ ] **Step 2: Sanity-check the pure function**

Run:
```bash
pnpm tsx -e "import('./src/shared/lib/phone.ts').then(m => console.log([m.isPlausibleUsPhone('8186511445'), m.isPlausibleUsPhone('9999999999'), m.isPlausibleUsPhone('1234567890'), m.isPlausibleUsPhone('0186511445'), m.isPlausibleUsPhone('8185550123'), m.isPlausibleUsPhone('818')].join(',')))"
```
Expected: `true,false,false,false,false,false`

- [ ] **Step 3: Verify + commit**

```bash
pnpm tsc && pnpm lint src/shared/lib/phone.ts
git add src/shared/lib/phone.ts
git commit -m "feat(phone): add isPlausibleUsPhone free pre-filter"
```

---

### Task 2: Pure policy gate (`evaluatePhoneLineGate`) in the Twilio provider

**Files:**
- Create: `src/shared/services/providers/twilio/lib/phone-line-gate.ts`

**Interfaces:**
- Consumes: `PhoneLookupResult` (exported from `src/shared/services/providers/twilio/client.ts` — `{ valid: boolean; lineType: string | null; carrierName: string | null; errorCode: number | null }`).
- Produces: `type LinePolicy = 'mobile-only' | 'mobile-or-landline'`; `interface PhoneLineVerdict`; `evaluatePhoneLineGate(lookup: PhoneLookupResult | null, policy: LinePolicy): PhoneLineVerdict`. Used by Tasks 3.

- [ ] **Step 1: Write the gate**

```ts
import type { PhoneLookupResult } from '@/shared/services/providers/twilio/client'

export type LinePolicy = 'mobile-only' | 'mobile-or-landline'

export interface PhoneLineVerdict {
  ok: boolean
  status: 'verified-mobile' | 'verified-landline' | 'unverified-line'
  lineType: string | null
  carrierName: string | null
  blockedReason?: 'invalid' | 'non-mobile' | 'line-type'
}

const ALLOWED: Record<LinePolicy, ReadonlySet<string>> = {
  'mobile-only': new Set(['mobile']),
  'mobile-or-landline': new Set(['mobile', 'landline']),
}

/**
 * Interprets a Twilio line-type lookup against a surface's policy. Fail-open on
 * uncertainty (null lookup / errorCode / null|'unknown' lineType) → ok:true,
 * status 'unverified-line'. Definitive non-allowed line type → ok:false.
 */
export function evaluatePhoneLineGate(lookup: PhoneLookupResult | null, policy: LinePolicy): PhoneLineVerdict {
  if (lookup === null || lookup.errorCode != null || lookup.lineType == null || lookup.lineType === 'unknown') {
    return { ok: true, status: 'unverified-line', lineType: lookup?.lineType ?? null, carrierName: lookup?.carrierName ?? null }
  }
  if (!lookup.valid) {
    return { ok: false, status: 'unverified-line', lineType: lookup.lineType, carrierName: lookup.carrierName, blockedReason: 'invalid' }
  }
  if (ALLOWED[policy].has(lookup.lineType)) {
    return {
      ok: true,
      status: lookup.lineType === 'mobile' ? 'verified-mobile' : 'verified-landline',
      lineType: lookup.lineType,
      carrierName: lookup.carrierName,
    }
  }
  return {
    ok: false,
    status: 'unverified-line',
    lineType: lookup.lineType,
    carrierName: lookup.carrierName,
    blockedReason: policy === 'mobile-only' ? 'non-mobile' : 'line-type',
  }
}
```

- [ ] **Step 2: Sanity-check**

Run:
```bash
pnpm tsx -e "import('./src/shared/services/providers/twilio/lib/phone-line-gate.ts').then(m => { const g=m.evaluatePhoneLineGate; console.log([g({valid:true,lineType:'mobile',carrierName:'x',errorCode:null},'mobile-only').ok, g({valid:true,lineType:'landline',carrierName:'x',errorCode:null},'mobile-only').ok, g({valid:true,lineType:'landline',carrierName:'x',errorCode:null},'mobile-or-landline').ok, g({valid:true,lineType:'nonFixedVoip',carrierName:'x',errorCode:null},'mobile-or-landline').ok, g(null,'mobile-only').ok].join(',')) })"
```
Expected: `true,false,true,false,true`  (mobile✓ / landline✗ in mobile-only / landline✓ in mobile-or-landline / VoIP✗ / null fails-open✓)

- [ ] **Step 3: Verify + commit**

```bash
pnpm tsc && pnpm lint src/shared/services/providers/twilio/lib/phone-line-gate.ts
git add src/shared/services/providers/twilio/lib/phone-line-gate.ts
git commit -m "feat(twilio): add evaluatePhoneLineGate policy gate"
```

---

### Task 3: `validatePhoneLine` orchestrator (pre-filter → ceiling → lookup → gate)

**Files:**
- Create: `src/shared/services/providers/twilio/lib/validate-phone-line.ts`

**Interfaces:**
- Consumes: `isPlausibleUsPhone`, `toE164` (Task 1 / `src/shared/lib/phone.ts`); `evaluatePhoneLineGate`, `LinePolicy`, `PhoneLineVerdict` (Task 2); `twilioClient.lookupPhoneNumber(e164)` (client.ts); `env` (`src/shared/config/server-env`).
- Produces: `validatePhoneLine(rawPhone: string, policy: LinePolicy): Promise<PhoneLineVerdict>` — the ONE entry point used by Tasks 4, 6, 7. Carries the global cost ceiling.

- [ ] **Step 1: Write the orchestrator**

```ts
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import env from '@/shared/config/server-env'
import { isPlausibleUsPhone, toE164 } from '@/shared/lib/phone'
import { twilioClient } from '@/shared/services/providers/twilio/client'
import type { LinePolicy, PhoneLineVerdict } from './phone-line-gate'
import { evaluatePhoneLineGate } from './phone-line-gate'

const redis = new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })

// Global paid-lookup ceiling — caps Twilio spend across ALL surfaces. Fail-open
// on exceed (skip the paid call → null → gate fails open → lead never dropped).
const lookupCeiling = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(300, '1 h'),
  prefix: 'phone:lookup-ceiling',
  ephemeralCache: new Map(),
})

const LOOKUP_TIMEOUT_MS = 5000

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error('phone lookup timed out')), ms)
    }),
  ])
}

/**
 * The single phone line-type validation entry point for every surface. Cheap
 * free pre-filter (no paid call on junk) → global ceiling → Twilio lookup (5s
 * timeout) → policy gate. Any error/timeout/ceiling/indeterminate fails open
 * (unverified-line, ok:true). Accepts raw or E.164 input.
 */
export async function validatePhoneLine(rawPhone: string, policy: LinePolicy): Promise<PhoneLineVerdict> {
  const e164 = toE164(rawPhone)
  if (!e164 || !isPlausibleUsPhone(rawPhone)) {
    return { ok: false, status: 'unverified-line', lineType: null, carrierName: null, blockedReason: 'invalid' }
  }

  let lookup = null
  const ceiling = await lookupCeiling.limit('global')
  if (ceiling.success) {
    try {
      lookup = await withTimeout(twilioClient.lookupPhoneNumber(e164), LOOKUP_TIMEOUT_MS)
    }
    catch {
      lookup = null
    }
  }
  return evaluatePhoneLineGate(lookup, policy)
}
```

- [ ] **Step 2: Verify + commit** (no live sanity-check — it hits paid Twilio; covered by manual smoke in Tasks 5/6/7)

```bash
pnpm tsc && pnpm lint src/shared/services/providers/twilio/lib/validate-phone-line.ts
git add src/shared/services/providers/twilio/lib/validate-phone-line.ts
git commit -m "feat(twilio): add validatePhoneLine orchestrator with global ceiling"
```

---

### Task 4: Rewire the funnel router (`phoneLookup` returns verdict, `submitLead` gates mobile-only)

**Files:**
- Modify: `src/trpc/routers/funnels.router.ts` (imports; `phoneLookup` query; `submitLead` gate + persistence; remove now-dead ceiling/timeout helpers)

**Interfaces:**
- Consumes: `validatePhoneLine` (Task 3).
- Produces: `funnelsRouter.phoneLookup` now returns `PhoneLineVerdict` (Task 5 consumes); `submitLead` unchanged signature.

- [ ] **Step 1: Swap the import** — replace
  `import { evaluatePhoneGate } from '@/shared/domains/funnels/lib/evaluate-phone-gate'`
  with
  `import { validatePhoneLine } from '@/shared/services/providers/twilio/lib/validate-phone-line'`

- [ ] **Step 2: Delete the now-unused lookup plumbing in this file** — remove the `lookupCeiling` Ratelimit block, the `LOOKUP_TIMEOUT_MS` const, and the `withTimeout` function (all move into `validate-phone-line.ts`). Also remove the `twilioClient`/`RestException` import **only if** no longer referenced elsewhere in the file (grep first: `grep -n "twilioClient\|RestException" src/trpc/routers/funnels.router.ts` — keep the import if other procedures use it).

- [ ] **Step 3: Replace the `phoneLookup` query body** with:

```ts
  phoneLookup: baseProcedure
    .input(z.object({ phone: e164 }))
    .query(async ({ input, ctx }) => {
      const ip = clientIp((ctx as { req?: Request }).req)
      const { success } = await phoneLookupRatelimit.limit(ip)
      if (!success) {
        throw new TRPCError({ code: 'TOO_MANY_REQUESTS', message: 'Too many submissions. Please try again later.' })
      }
      return validatePhoneLine(input.phone, 'mobile-only')
    }),
```

- [ ] **Step 4: Replace the `submitLead` gate block** (the `let lookup = null … const verdict = evaluatePhoneGate(lookup)` section through the `if (!verdict.ok)` throw) with:

```ts
      // Authoritative mobile-only gate. Fail-open inside validatePhoneLine — a
      // Twilio outage / ceiling / timeout never drops a lead.
      const verdict = await validatePhoneLine(input.phone, 'mobile-only')
      if (!verdict.ok) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: verdict.blockedReason === 'non-mobile'
            ? 'Please use a mobile number only.'
            : 'That phone number doesn\'t look valid — please double-check it.',
        })
      }
```

- [ ] **Step 5: Update the persisted verification** — in the `ingestLead` call's `leadMeta.phoneVerification`, map the granular verdict status to the existing `'verified' | 'unverified'` shape (avoids a `leadMetaSchema` change):

```ts
          phoneVerification: {
            status: verdict.status === 'unverified-line' ? 'unverified' : 'verified',
            lineType: verdict.lineType,
            carrierName: verdict.carrierName,
          },
```

- [ ] **Step 6: Verify + commit**

```bash
pnpm tsc && pnpm lint src/trpc/routers/funnels.router.ts
git add src/trpc/routers/funnels.router.ts
git commit -m "feat(funnel): mobile-only phone gate via validatePhoneLine"
```

---

### Task 5: Wire the funnel PII step to the verdict

**Files:**
- Modify: `src/shared/domains/funnels/ui/steps/pii-form-step.tsx` (the `validatePhone` validator; remove the `evaluatePhoneGate` usage)

**Interfaces:**
- Consumes: `funnelsRouter.phoneLookup` now returns `PhoneLineVerdict` (Task 4).

- [ ] **Step 1: Remove the gate import** — delete the line
  `import { evaluatePhoneGate } from '@/shared/domains/funnels/lib/evaluate-phone-gate'`
  (and `evaluate-phone-gate` will be deleted in Task 8).

- [ ] **Step 2: Replace the `validatePhone` body** — the lookup query now returns the verdict directly:

```ts
  const validatePhone = useDebouncedAsyncValidator<string>(async (raw, signal) => {
    if (!isValidPhoneNumber(raw, 'US')) {
      return 'Please enter a valid US phone number'
    }
    const parsed = parsePhoneNumber(raw, 'US')
    const e164 = parsed?.number
    if (!e164) {
      return 'Please enter a valid US phone number'
    }
    const verdict = await queryClient.fetchQuery({
      ...lookupPhone.queryOptions({ phone: e164 }),
      staleTime: 5 * 60 * 1000,
    })
    if (signal.aborted) {
      return true
    }
    if (verdict.ok) {
      return true
    }
    return verdict.blockedReason === 'non-mobile'
      ? 'Please use a mobile number only.'
      : 'That phone number doesn\'t look valid — please double-check it.'
  })
```

- [ ] **Step 3: Verify + manual smoke**

```bash
pnpm tsc && pnpm lint src/shared/domains/funnels/ui/steps/pii-form-step.tsx
```
Manual smoke (`pnpm dev`, funnel PII step): a known mobile passes; a known landline on blur shows exactly "Please use a mobile number only." and submit is blocked.

- [ ] **Step 4: Commit**

```bash
git add src/shared/domains/funnels/ui/steps/pii-form-step.tsx
git commit -m "feat(funnel): PII step surfaces mobile-only verdict"
```

---

### Task 6: Intake form gate (mobile-or-landline, hard-block)

**Files:**
- Modify: `src/trpc/routers/customers.router/business.router.ts` (`createFromIntake` mutation — add gate after the rate-limit check ~line 176, persist verdict into `leadMeta`)

**Interfaces:**
- Consumes: `validatePhoneLine` (Task 3).

- [ ] **Step 1: Add the import** (sorted position)

```ts
import { validatePhoneLine } from '@/shared/services/providers/twilio/lib/validate-phone-line'
```

- [ ] **Step 2: Add the gate** immediately after the `intakeRatelimit` `if (!success)` block (before the `mode === 'customer_and_meeting'` check):

```ts
        // Mobile-or-landline gate (hard-block; VoIP/virtual rejected). Fail-open
        // inside validatePhoneLine never drops a real lead on a Twilio outage.
        const phoneVerdict = await validatePhoneLine(customerData.phone, 'mobile-or-landline')
        if (!phoneVerdict.ok) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: phoneVerdict.blockedReason === 'invalid'
              ? 'Enter a valid US phone number.'
              : 'Enter a mobile or landline number — VoIP/virtual numbers aren\'t accepted.',
          })
        }
```

- [ ] **Step 3: Persist the verdict** — extend the `leadMeta` built at ~line 194 so the verification rides along. Replace the `const leadMeta = …` assignment with:

```ts
        const phoneVerification = {
          status: phoneVerdict.status === 'unverified-line' ? 'unverified' : 'verified',
          lineType: phoneVerdict.lineType,
          carrierName: phoneVerdict.carrierName,
        }
        const leadMeta = {
          ...(customerData.leadMetaJSON ?? {}),
          ...(interestedTradesRaw ? { interestedTradesRaw } : {}),
          phoneVerification,
        }
```

- [ ] **Step 4: Verify + manual smoke**

```bash
pnpm tsc && pnpm lint src/trpc/routers/customers.router/business.router.ts
```
Manual smoke (dashboard intake): a landline now passes (mobile-or-landline); a VoIP/virtual number is rejected with the message; a real mobile passes.

- [ ] **Step 5: Commit**

```bash
git add src/trpc/routers/customers.router/business.router.ts
git commit -m "feat(intake): mobile-or-landline phone gate"
```

---

### Task 7: General-inquiry form gate (mobile-or-landline, hard-block)

**Files:**
- Modify: `src/trpc/routers/landing.router/index.tsx` (`generalInquiry` mutation — add gate at the top of the handler)

**Interfaces:**
- Consumes: `validatePhoneLine` (Task 3); `generalInquiryFormSchema` already requires `phone` (`requiredPhoneSchema`).

- [ ] **Step 1: Add the imports** (sorted) — `validatePhoneLine`, and `TRPCError` from `@trpc/server` if not already imported (grep first: `grep -n "TRPCError" src/trpc/routers/landing.router/index.tsx`).

```ts
import { validatePhoneLine } from '@/shared/services/providers/twilio/lib/validate-phone-line'
```

- [ ] **Step 2: Add the gate** as the first statement inside the `generalInquiry` mutation handler (before the email sends):

```ts
      const phoneVerdict = await validatePhoneLine(input.phone, 'mobile-or-landline')
      if (!phoneVerdict.ok) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: phoneVerdict.blockedReason === 'invalid'
            ? 'Enter a valid US phone number.'
            : 'Enter a mobile or landline number — VoIP/virtual numbers aren\'t accepted.',
        })
      }
```

- [ ] **Step 3: Verify + manual smoke**

```bash
pnpm tsc && pnpm lint src/trpc/routers/landing.router/index.tsx
```
Manual smoke (public contact / general-inquiry form): mobile + landline pass; VoIP rejected with the message.

- [ ] **Step 4: Commit**

```bash
git add src/trpc/routers/landing.router/index.tsx
git commit -m "feat(landing): mobile-or-landline gate on general inquiry"
```

---

### Task 8: Delete the superseded funnel gate

**Files:**
- Delete: `src/shared/domains/funnels/lib/evaluate-phone-gate.ts`

**Interfaces:** none (Tasks 4 + 5 removed its last importers).

- [ ] **Step 1: Confirm no importers remain**

```bash
grep -rn "evaluate-phone-gate\|evaluatePhoneGate" src
```
Expected: no matches.

- [ ] **Step 2: Delete + verify + commit**

```bash
git rm src/shared/domains/funnels/lib/evaluate-phone-gate.ts
pnpm tsc && pnpm lint
git commit -m "refactor(funnel): remove superseded evaluate-phone-gate (moved to twilio/lib)"
```

---

# PART B — Funnel ZIP service-area validation

### Task 9: Generate the served-ZIP dataset

**Files:**
- Create: `scripts/generate-service-area-zips.ts` (one-time generator, committed for reproducibility)
- Create (generated, committed): `src/shared/constants/company/service-area-zips.ts`
- Input data (NOT committed): a ZIP→county CSV at `scripts/data/uszips.csv`

**Interfaces:**
- Produces: `export const SERVICE_AREA_ZIPS: ReadonlySet<string>` — consumed by Task 10.

- [ ] **Step 1: Obtain the dataset.** Download the free SimpleMaps "US Zip Codes" CSV (`uszips.csv`, columns include `zip`, `state_id`, `county_name`) from https://simplemaps.com/data/us-zips and save it to `scripts/data/uszips.csv`. Add `scripts/data/` to `.gitignore` (the CSV is build input, not runtime data).

- [ ] **Step 2: Write the generator**

```ts
import './lib/load-env'
import { readFileSync, writeFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'

// Whole-county inclusions (Ventura's western edge IS the city of Ventura, so the
// whole county qualifies — far-north rural ZIPs are trimmed via EXCLUDE below).
const WHOLE_COUNTIES = new Set(['Los Angeles', 'San Bernardino', 'Riverside', 'Ventura', 'Orange'])

// Curated edge trims (boundary cities the user defined).
//  - Orange County south of Laguna Beach: San Clemente, Dana Point, San Juan Capistrano.
//  - Ventura County far-north/rural beyond the city of Ventura: Ojai, Santa Paula, Fillmore, Piru.
const EXCLUDE = new Set([
  '92672', '92673', '92674', // San Clemente
  '92624', '92629', // Dana Point
  '92675', '92690', '92693', // San Juan Capistrano
  '93023', '93024', // Ojai
  '93060', '93061', // Santa Paula
  '93015', '93016', // Fillmore
  '93040', // Piru
])

// Explicit extra inclusions outside the whole counties.
const EXTRA = new Set(['93560']) // Rosamond (Kern) — north sliver

const rows = parse(readFileSync('scripts/data/uszips.csv'), { columns: true, skip_empty_lines: true }) as Array<{ zip: string, state_id: string, county_name: string }>

const zips = new Set<string>()
for (const r of rows) {
  const zip = r.zip.padStart(5, '0')
  if (r.state_id === 'CA' && WHOLE_COUNTIES.has(r.county_name) && !EXCLUDE.has(zip)) {
    zips.add(zip)
  }
}
for (const z of EXTRA) {
  zips.add(z)
}

const sorted = [...zips].sort()
const body = `// GENERATED by scripts/generate-service-area-zips.ts — do not edit by hand.\n`
  + `// Tri Pros service area: LA/SB/Riverside/Ventura/Orange counties (whole), minus\n`
  + `// south-of-Laguna OC + far-north Ventura, plus Rosamond (93560). ${sorted.length} ZIPs.\n`
  + `export const SERVICE_AREA_ZIPS: ReadonlySet<string> = new Set([\n`
  + sorted.map(z => `  '${z}',`).join('\n')
  + `\n])\n`

writeFileSync('src/shared/constants/company/service-area-zips.ts', body)
console.log(`Wrote ${sorted.length} ZIPs to service-area-zips.ts`)
```

> Note: `csv-parse` ships with the repo's toolchain; if `pnpm tsx` reports it missing, `pnpm add -D csv-parse`. `./lib/load-env` matches the repo's script env convention (see other files in `scripts/`).

- [ ] **Step 3: Run the generator + sanity-check**

```bash
pnpm tsx scripts/generate-service-area-zips.ts
pnpm tsx -e "import('./src/shared/constants/company/service-area-zips.ts').then(m => console.log([m.SERVICE_AREA_ZIPS.has('91316'), m.SERVICE_AREA_ZIPS.has('92651'), m.SERVICE_AREA_ZIPS.has('93560'), m.SERVICE_AREA_ZIPS.has('92672'), m.SERVICE_AREA_ZIPS.has('93023'), m.SERVICE_AREA_ZIPS.has('94016'), m.SERVICE_AREA_ZIPS.size > 600].join(',')))"
```
Expected: `true,true,true,false,false,false,true` (Encino in / Laguna Beach in / Rosamond in / San Clemente out / Ojai out / SF out / non-trivial size)

- [ ] **Step 4: Verify + commit**

```bash
pnpm tsc && pnpm lint scripts/generate-service-area-zips.ts src/shared/constants/company/service-area-zips.ts
git add scripts/generate-service-area-zips.ts src/shared/constants/company/service-area-zips.ts .gitignore
git commit -m "feat(zip): generate service-area ZIP set"
```

---

### Task 10: Service-area helper

**Files:**
- Create: `src/shared/constants/company/service-area.ts`

**Interfaces:**
- Consumes: `SERVICE_AREA_ZIPS` (Task 9).
- Produces: `isInServiceArea(zip: string): boolean` — consumed by Task 11.

- [ ] **Step 1: Write the helper**

```ts
import { SERVICE_AREA_ZIPS } from './service-area-zips'

/**
 * True when a 5-digit US ZIP is inside the Tri Pros service area (LA / San
 * Bernardino / Riverside / Ventura counties whole, Orange County north of Laguna
 * Beach, plus Rosamond). Pure, O(1), no network — the canonical service-area
 * gate. Membership data is generated (see service-area-zips.ts).
 */
export function isInServiceArea(zip: string): boolean {
  return SERVICE_AREA_ZIPS.has(zip)
}
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm tsc && pnpm lint src/shared/constants/company/service-area.ts
git add src/shared/constants/company/service-area.ts
git commit -m "feat(zip): add isInServiceArea helper"
```

---

### Task 11: Wire the real gate into `classifyZip`

**Files:**
- Modify: `src/shared/domains/funnels/lib/resolve-zip.ts` (`classifyZip` + its imports; remove the `SOCAL_ZIP` regex)

**Interfaces:**
- Consumes: `isInServiceArea` (Task 10).
- Produces: `classifyZip(zip)` now returns real `'in-area' | 'out-of-area' | 'invalid-format'` (the ZIP step view in `zip-step.tsx` already consumes it via `useLiveZipResolve`).

- [ ] **Step 1: Add the import** (sorted — `@/shared/constants/...` sorts before `@/shared/domains/...`)

```ts
import { isInServiceArea } from '@/shared/constants/company/service-area'
```

- [ ] **Step 2: Replace `classifyZip` and delete the `SOCAL_ZIP` const**

```ts
/**
 * Territory gate for the funnel ZIP step:
 * - 'invalid-format' → not a 5-digit ZIP (a typo); neutral, no message.
 * - 'in-area'        → inside the Tri Pros service area (resolve city for badge).
 * - 'out-of-area'    → a real-looking ZIP we don't serve; the step shows the
 *                      out-of-area message and keeps the advance button disabled.
 * Local + synchronous — no API call to decide service area.
 */
export function classifyZip(zip: string): 'in-area' | 'out-of-area' | 'invalid-format' {
  if (!/^\d{5}$/.test(zip)) {
    return 'invalid-format'
  }
  return isInServiceArea(zip) ? 'in-area' : 'out-of-area'
}
```

- [ ] **Step 3: Verify + commit**

```bash
pnpm tsc && pnpm lint src/shared/domains/funnels/lib/resolve-zip.ts
git add src/shared/domains/funnels/lib/resolve-zip.ts
git commit -m "feat(zip): gate classifyZip on real service area"
```

---

### Task 12: Out-of-area copy + funnel smoke

**Files:**
- Modify: `src/shared/domains/funnels/ui/steps/zip-step.tsx` (only the `ZIP_STEP.content.outOfAreaLabel` string — no logic change; the out-of-area UX is already wired). NOTE: this file was formerly `location-step.tsx` — the view export is still `LocationStepView`.

**Interfaces:** none.

- [ ] **Step 1: Set the copy** — in `ZIP_STEP.content`, set:

```ts
    outOfAreaLabel: 'We don\'t serve your area yet — try a different ZIP.',
```

- [ ] **Step 2: Verify + manual smoke**

```bash
pnpm tsc && pnpm lint src/shared/domains/funnels/ui/steps/zip-step.tsx
```
Manual smoke (`pnpm dev`, funnel ZIP step):
- In-area ZIP (e.g. `91316` Encino) → city badge resolves, advance button enables.
- Out-of-area ZIP (e.g. `90001` South LA is IN; use `93561` Tehachapi or `94016` SF) → "We don't serve your area yet — try a different ZIP." shows, button stays disabled.
- Delete a digit then type an in-area ZIP → recovers and enables (edit-and-retry).

- [ ] **Step 3: Commit**

```bash
git add src/shared/domains/funnels/ui/steps/zip-step.tsx
git commit -m "feat(zip): out-of-area copy on the funnel ZIP step"
```

---

## Self-Review

**Spec coverage — Phone:** R1 (funnel mobile-only message) → Tasks 4/5; R2 (intake/general-inquiry mobile-or-landline) → Tasks 6/7; R3 (cheap-before-paid) → Tasks 1+3; R4 (fail-open + flag) → Task 2 + Task 3; R5 (on-blur + re-edit) → existing validator (Task 5); R6 (server-authoritative) → Tasks 4/6/7; R7 (B1) → Task 1; R8 (B3 dedupe) → existing client `staleTime` (Task 5); R9 (one ceilinged path) → Task 3; R10 (`validatePhoneLine` + pure gate in `twilio/lib`) → Tasks 2/3; R11 (persist verdict) → Tasks 4/6 (`leadMeta.phoneVerification`); R12 (observability) → **partial** — verdict persisted on the lead; explicit block-rate logging is NOT separately built (acceptable: persisted verdict + Twilio dashboard cover it; flag if dedicated metrics are wanted).

**Spec coverage — ZIP:** Z1 (out-of-area hard reject + retry) → Tasks 11/12 (reuses existing UX); Z2 (in-area city badge) → unchanged `resolveZip`; Z3 (`classifyZip` real) → Task 11; Z4 (service-area definition) → Task 9; Z5 (local, no API) → Tasks 9/10; Z6 (real-but-unserved blocks like not-found) → Task 11 (both → out-of-area). Open-item edge cuts (south OC, far-north Ventura) → Task 9 `EXCLUDE`.

**Placeholder scan:** no TBD/“handle errors”/bare “similar to”. The one external dependency (the `uszips.csv` dataset) is called out explicitly with a source URL and a verifiable post-generation sanity check.

**Type consistency:** `PhoneLineVerdict` shape (`ok`/`status`/`lineType`/`carrierName`/`blockedReason`) is identical across Tasks 2→3→4→5→6→7. `LinePolicy` literals (`'mobile-only'`, `'mobile-or-landline'`) consistent. Persisted `phoneVerification.status` is mapped to the existing `'verified'|'unverified'` enum in Tasks 4 + 6 (no `leadMetaSchema` change). `isInServiceArea`/`SERVICE_AREA_ZIPS`/`classifyZip` names consistent across Tasks 9→10→11.

**Note for the implementer:** verify `leadMetaSchema.phoneVerification` already accepts `{ status, lineType, carrierName }` (the funnel writes it today, so it should) — if it's narrowly typed, that's a one-line schema widening, not a blocker.
