# Visit Messages Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay everything a visit message needs before one can be sent: the data model, the meetings module with its verbs, the VoIP service's SMS helpers and the business-time helpers, the rules that decide what goes out and when, and dev-safety rails for email.

**Architecture:** Pure rules first (rendering, validation, the visit message plan, the confirmation track), each pinned by a `node:assert` script with no database or env. Then the schema in one push, the meetings CRUD rules that every row obeys, and a new `src/shared/modules/meetings/` whose root service spreads the existing meetings CRUD and holds the verbs in a `business` child. Nothing in this plan sends a text or renders a page; plan 2 (sending and replies) builds on these names.

**Tech Stack:** Next.js 15, TypeScript, tRPC, Drizzle (Postgres on Neon), Zod 4, CASL, Resend, `tsx` for the verify script.

**Spec:** `docs/superpowers/specs/2026-09-29-home-visit-page-and-visit-messages-design.md` (approved 2026-10-05; this plan is §12a step 1, plus D26). Read §3a, §5, §6, §7.2, §7.5 and §18 before starting.

## Global Constraints

- Package manager is **pnpm**. Verify with `pnpm tsc` and `pnpm lint`. **Never** run `pnpm build`.
- Work on local `main`, in the shared tree. No branch, no worktree, no `git stash`, `git checkout` or `git reset`. Stage by explicit path (`git add <path> …`), never `git add -A` or `git add .`: another session has uncommitted files in this tree.
- A commit hook runs `pnpm tsc`, `pnpm lint` and `pnpm theme:check`. Every commit must pass all three on its own.
- **Never run `pnpm db:push:dev` or `pnpm db:push:prod`.** The push is interactive and owner-only (Task 9 stops for it). Never accept a truncate prompt.
- **No database writes for testing**, dev included. The owner prepares test data by hand; runtime checks that need a write are listed as owner checks.
- Comments say why, never what. No file banners, no citations of plans, specs, tasks or docs from code, no new `DOCS.md`.
- A service is one object literal per file that spreads its CRUD and reaches itself and peers by exported name. No `this`, no factory, no `core` namespace. Raw `db` calls live in a DAL file, never in a service or router.
- Option sets are a `readonly` const array with its type derived beside it; a stored one is a `text` column with `{ enum }`. No new `pgEnum`.
- All SMS copy is **GSM-7 only**: no emoji, curly quotes or em dashes.
- Company data comes from `src/shared/constants/company/`; never hardcode the company name, phone or address.
- A move is non-defensive: consumers switch and the old file is deleted in the same change. No re-export shims.
- Code lives where its module will be (spec D28). SMS and texting primitives belong to VoIP: until a `modules/voip/` exists they go in `src/shared/services/voip/lib/` and move with the rest of VoIP later. New meeting-core rules go in `src/shared/modules/meetings/core/lib/`, the address `entities/meetings/**` migrates to; existing meetings files are edited where they are. Nothing new goes in naked `src/shared/lib/` unless the whole app uses it (business time does).
- `scripts/verify-visit-messages.ts` stays pure: it may not import anything that reaches `@/shared/config/server-env`, `@/shared/db` (the client, not types) or `@/shared/config/public-url`. Type-only imports are fine.
- No static import of the `resend` or `twilio` REST SDKs (lint rule `lazy-only/imports`).
- Approved vocabulary (spec §3a): home visit page, main line, visit message, visit summary, day-before reminder, rep confirmation, confirmation reply, visit cancellation, homeowner reply, confirmation track, homeowner confirmed, rep, reschedule chain, Visit messages page, sequence, visit message template, skip, paused, visit message plan. Do not coin other terms; "stage" is reserved for pipelines.
- Visit-message surfaces are super-admin only for now (D25). Do not grant `VisitMessages` to any role. Dispatchers get it later, with #285; agents are not in line for it (owner, 2026-10-05), so build no agent-on-own-meeting path.
- The records setter work (`setBy`: `b14be068` and `6069a226`, 2026-10-05/06, plus a change still uncommitted in another session on 2026-10-07) shares `db/schema/meetings.ts`, `meetingCrud` and `business.router.ts` with Tasks 9, 10 and 11. Its lines stay exactly as the file has them when you get there, and Task 10's diff check runs before Tasks 9 and 11 as well.

## Review Focus

Inputs the spec implies and a person would trip over. Each has a test in the task named.

1. **A formatted time carries a narrow no-break space.** Node prints `10:00 AM`. In a text that one character switches the message to UCS-2 and roughly triples its cost. Expected: every rendered default is GSM-7. (Tasks 3 and 7)
2. **A retried run arrives after midnight.** QStash retries a failed delivery; a 6 PM run redelivered at 12:05 AM must not act as the next day's run and send tomorrow's reminders 18 hours early. Expected: the run does nothing. (Task 8)
3. **The same instant in two spellings.** Postgres returns `2026-10-09 17:00:00+00`; code builds `2026-10-09T17:00:00.000Z`. Every "for this time" lookup must compare instants, or a sent text looks unsent and goes out twice. (Tasks 3, 8 and 10)
4. **A meeting booked after a run's time.** Booked at 9:15 AM for 2 PM today, the 8:30 run has passed. Expected: no "Good morning" text hours late, and the plan says why. (Task 8)
5. **A homeowner with no name, one name, or a name outside GSM-7.** Expected: "Hi there" when the name is missing, the first word otherwise, and "Zoë" still sends correctly spelled. (Task 7)

## File map

| File | Responsibility |
|---|---|
| `src/shared/services/providers/resend/lib/dev-recipients.ts` (new) | Decide who an email really goes to outside production |
| `src/shared/services/voip/lib/sms-merge-template.ts` (new) | The `{{token}}` pattern, rendering, the `MergeToken` type |
| `src/shared/services/voip/lib/sms-segments.ts` (new, replaces `features/campaigns-admin/lib/sms-segments.ts`) | Encoding-aware segment count |
| `src/shared/lib/business-time.ts` | Day, clock and day-time text; a wall-clock time on a business day as an instant |
| `src/shared/modules/meetings/core/lib/arrival-window.ts` (new) | The arrival window as text |
| `src/shared/modules/meetings/messages/lib/build-ics.ts` (new) | Build one iCalendar event for a visit |
| `src/shared/modules/meetings/messages/constants/{kinds,schedule,templates,keywords}.ts` (new) | The unit's option sets, send times, default wording, tokens, confirm keywords |
| `src/shared/modules/meetings/messages/types.ts` (new) | The shapes the rules read and return |
| `src/shared/modules/meetings/messages/lib/*.ts` (new) | Render, validate, match a reply, eligibility, confirmation track, plan, run time, cancellation rule |
| `src/shared/db/schema/{meetings,meeting-messages,visit-message-templates,visit-message-pauses,voip-dids,meta,index}.ts` | The data model |
| `src/shared/modules/meetings/core/lib/confirmation-reset.ts` (new) | Which confirmations a moved time clears |
| `src/shared/entities/meetings/dal/server/{crud,queries,mutations,google-calendar}.ts` | Rules true of every meeting row; the reschedule chain read; the token handoff |
| `src/shared/modules/meetings/service.ts`, `business/service.ts` (new) | `meetingService` and its verbs |
| `src/shared/modules/meetings/messages/{server-spec,service}.ts`, `dal/server/crud.ts`, `lib/constants.ts` (new) | `meeting_messages` as a child of meetings |
| `src/trpc/routers/meetings.router/{business.router,crud.router,procedures}.ts` | Thin adapters; client schemas; the visit-messages procedure |
| `scripts/verify-visit-messages.ts` (new) | The rules, asserted |

---

### Task 1: Every email outside production goes to one address

**Files:**
- Create: `src/shared/services/providers/resend/lib/dev-recipients.ts`
- Create: `scripts/verify-visit-messages.ts`
- Modify: `src/shared/services/providers/resend/lib/config.ts`
- Modify: `src/shared/services/providers/resend/client.ts`
- Modify: `src/shared/config/server-env.ts:186-190` (add a gate after the `VOIP_DEV_OVERRIDE_NUMBER` one)

**Interfaces:**
- Produces: `applyDevRecipientOverride<T extends { to: string | string[], cc?: string | string[], bcc?: string | string[], subject: string }>(payload: T, env: { isProduction: boolean, override: string | undefined }): T`
- Produces: env `EMAIL_DEV_OVERRIDE` (optional, an email address); `getResendConfig().devRecipientOverride: string | undefined`

`resendClient.emails.send` is the only place email leaves the app (six calls, all in `src/shared/services/email.service.ts`), so the guard sits there and no send can skip it.

- [ ] **Step 1: Write the failing test**

Create `scripts/verify-visit-messages.ts`:

```ts
import assert from 'node:assert/strict'

import { applyDevRecipientOverride } from '@/shared/services/providers/resend/lib/dev-recipients'

{
  const payload = {
    to: ['maria@example.com', 'sam@example.com'],
    cc: 'office@example.com',
    bcc: ['audit@example.com'],
    subject: 'Your proposal is ready',
    html: '<p>hi</p>',
  }
  assert.deepEqual(applyDevRecipientOverride(payload, { isProduction: true, override: undefined }), payload, 'production sends exactly what it was given')

  const guarded = applyDevRecipientOverride(payload, { isProduction: false, override: 'owner@example.com' })
  assert.equal(guarded.to, 'owner@example.com', 'outside production the only recipient is the override')
  assert.equal(guarded.cc, undefined, 'cc is dropped: a copy would still reach a real inbox')
  assert.equal(guarded.bcc, undefined, 'bcc is dropped too')
  assert.equal(guarded.subject, '[to maria@example.com, sam@example.com] Your proposal is ready', 'the subject names who it was for')
  assert.equal(guarded.html, '<p>hi</p>', 'the body is untouched')

  assert.throws(
    () => applyDevRecipientOverride(payload, { isProduction: false, override: undefined }),
    /EMAIL_DEV_OVERRIDE/,
    'no override outside production means no send',
  )
}
console.log('1. Dev email recipients ✓')

console.log('✅ verify-visit-messages passed')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL, `Cannot find module '@/shared/services/providers/resend/lib/dev-recipients'`.

- [ ] **Step 3: Write the guard**

Create `src/shared/services/providers/resend/lib/dev-recipients.ts`:

```ts
interface GuardedEmail {
  to: string | string[]
  cc?: string | string[]
  bcc?: string | string[]
  subject: string
}

/**
 * The dev database is a copy of production with real customer addresses, so outside production an
 * email goes to one configured inbox or does not go. The subject keeps the intended recipients visible.
 */
export function applyDevRecipientOverride<T extends GuardedEmail>(
  payload: T,
  env: { isProduction: boolean, override: string | undefined },
): T {
  if (env.isProduction) {
    return payload
  }
  if (!env.override) {
    throw new Error('EMAIL_DEV_OVERRIDE is not set. Outside production every email goes to that address, so nothing was sent.')
  }
  const intended = [payload.to].flat().join(', ')
  return {
    ...payload,
    to: env.override,
    cc: undefined,
    bcc: undefined,
    subject: `[to ${intended}] ${payload.subject}`,
  }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: `1. Dev email recipients ✓` then `✅ verify-visit-messages passed`.

- [ ] **Step 5: Declare the env var and reject it in production**

In `src/shared/services/providers/resend/lib/config.ts`, replace the fragment, the config interface and `toConfig`:

```ts
export const resendEnvFragment = z.object({
  RESEND_API_KEY: z.string().optional(),
  // Outside production every email is rerouted to this inbox. server-env refuses it in production.
  EMAIL_DEV_OVERRIDE: z.email().optional(),
})

export type ParsedResendEnv = z.infer<typeof resendEnvFragment>

export interface ResendRuntimeConfig {
  apiKey: string
  devRecipientOverride: string | undefined
}

const helpers = createProviderConfig({
  provider: 'resend',
  fragment: resendEnvFragment,
  requiredKeys: ['RESEND_API_KEY'],
  toConfig: (parsed): ResendRuntimeConfig => ({
    apiKey: parsed.RESEND_API_KEY!,
    devRecipientOverride: parsed.EMAIL_DEV_OVERRIDE,
  }),
})
```

In `src/shared/config/server-env.ts`, directly after the `VOIP_DEV_OVERRIDE_NUMBER` gate (`:188-190`), add:

```ts
// EMAIL_DEV_OVERRIDE reroutes every outbound email to one inbox. In production it would
// black-hole every customer email.
if (env.VERCEL_ENV === 'production' && env.EMAIL_DEV_OVERRIDE) {
  throw new Error('EMAIL_DEV_OVERRIDE must NOT be set in production')
}
```

- [ ] **Step 6: Apply the guard in the client**

In `src/shared/services/providers/resend/client.ts`, add the two imports and replace the `send` method:

```ts
import env from '@/shared/config/server-env'

import { applyDevRecipientOverride } from './lib/dev-recipients'
```

```ts
    emails: {
      async send(...args: Parameters<Resend['emails']['send']>) {
        const [payload, options] = args
        const guarded = applyDevRecipientOverride(payload, {
          isProduction: env.VERCEL_ENV === 'production',
          override: getResendConfig().devRecipientOverride,
        })
        return (await sdk()).emails.send(guarded, options)
      },
    },
```

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: both clean. If `tsc` rejects `applyDevRecipientOverride(payload, …)` because Resend's payload type does not satisfy `GuardedEmail`, stop and report the exact error; do not cast.

- [ ] **Step 8: Commit**

```bash
git add scripts/verify-visit-messages.ts src/shared/services/providers/resend/lib/dev-recipients.ts src/shared/services/providers/resend/lib/config.ts src/shared/services/providers/resend/client.ts src/shared/config/server-env.ts
git commit -m "feat(email): every email outside production goes to EMAIL_DEV_OVERRIDE, or is not sent"
```

- [ ] **Step 9: Owner check (not an agent step)**

The owner adds `EMAIL_DEV_OVERRIDE=<their inbox>` to `.env` and to the Vercel **Preview** environment. Until then local dev and preview deploys send no email. With it set, send any proposal email in dev: it arrives at the override inbox with `[to <customer>]` in the subject.

---

### Task 2: SMS authoring helpers in the VoIP service

**Files:**
- Create: `src/shared/services/voip/lib/sms-merge-template.ts`
- Create: `src/shared/services/voip/lib/sms-segments.ts`
- Delete: `src/features/campaigns-admin/lib/sms-segments.ts`
- Modify: `src/shared/entities/voip-campaigns/lib/sms-merge-tokens.ts`
- Modify: `src/shared/services/voip/campaigns/lib/render-sms-template.ts`
- Modify: `src/features/campaigns-admin/ui/components/setup/cadence-message-row.tsx:8`
- Modify: `scripts/verify-visit-messages.ts`

**Interfaces:**
- Produces: `interface MergeToken<TVars> { token: string, label: string, sample: string, resolve: (vars: TVars) => string }`
- Produces: `renderMergeTemplate<TVars>(body: string, tokens: readonly MergeToken<TVars>[], vars: TVars): string`
- Produces: `renderMergeSample<TVars>(body: string, tokens: readonly MergeToken<TVars>[]): string`
- Produces: `listMergeTokens(body: string): string[]`
- Produces: `countSmsSegments(body: string): { chars: number, segments: number, encoding: 'gsm7' | 'ucs2' }`, `findNonGsm7(body: string): string[]`, `type SmsEncoding`

- [ ] **Step 1: Write the failing test**

In `scripts/verify-visit-messages.ts`, add to the imports:

```ts
import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'

import { listMergeTokens, renderMergeSample, renderMergeTemplate } from '@/shared/services/voip/lib/sms-merge-template'
import { countSmsSegments, findNonGsm7 } from '@/shared/services/voip/lib/sms-segments'
```

Add this block above the final `console.log('✅ …')` line:

```ts
{
  const tokens: MergeToken<{ name: string }>[] = [
    { token: 'first_name', label: 'First name', sample: 'Maria', resolve: vars => vars.name },
  ]
  assert.equal(renderMergeTemplate('Hi {{first_name}}, {{ first_name }}!', tokens, { name: 'Sam' }), 'Hi Sam, Sam!', 'spaces inside the braces are allowed')
  assert.equal(renderMergeTemplate('Hi {{nope}}', tokens, { name: 'Sam' }), 'Hi {{nope}}', 'an unknown token stays as typed')
  assert.equal(renderMergeSample('Hi {{first_name}}', tokens), 'Hi Maria', 'samples stand in for values')
  assert.deepEqual(listMergeTokens('{{a}} {{b}} {{a}}'), ['a', 'b'], 'token names, in order, once each')

  assert.deepEqual(countSmsSegments(''), { chars: 0, segments: 0, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('a'.repeat(160)), { chars: 160, segments: 1, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('a'.repeat(161)), { chars: 161, segments: 2, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('a'.repeat(306)), { chars: 306, segments: 2, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('a'.repeat(307)), { chars: 307, segments: 3, encoding: 'gsm7' })
  assert.deepEqual(countSmsSegments('[ok]'), { chars: 6, segments: 1, encoding: 'gsm7' }, 'extension characters count twice')
  assert.deepEqual(countSmsSegments('’'.repeat(70)), { chars: 70, segments: 1, encoding: 'ucs2' }, 'a curly apostrophe switches the whole text to UCS-2')
  assert.deepEqual(countSmsSegments('’'.repeat(71)), { chars: 71, segments: 2, encoding: 'ucs2' })
  assert.equal(countSmsSegments('10:00 AM').encoding, 'ucs2', 'the narrow no-break space Intl prints before AM is not GSM-7')
  assert.deepEqual(findNonGsm7('Hi “Maria” — ok \u{1F600}'), ['“', '”', '—', '\u{1F600}'], 'each offending character, once, in order')
}
console.log('2. SMS templates and segments ✓')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL, `Cannot find module '@/shared/services/voip/lib/sms-merge-template'`.

- [ ] **Step 3: Write `sms-merge-template.ts`**

```ts
export interface MergeToken<TVars> {
  /** The token as typed in a body, without braces: "first_name". */
  token: string
  label: string
  /** Stands in for the value in previews and length counts. */
  sample: string
  resolve: (vars: TVars) => string
}

const MERGE_TOKEN_PATTERN = /\{\{\s*(\w+)\s*\}\}/g

/** An unknown token stays as typed, so a typo shows in the text instead of vanishing. */
export function renderMergeTemplate<TVars>(body: string, tokens: readonly MergeToken<TVars>[], vars: TVars): string {
  return body.replace(MERGE_TOKEN_PATTERN, (match, name: string) => {
    const token = tokens.find(candidate => candidate.token === name)
    return token ? token.resolve(vars) : match
  })
}

export function renderMergeSample<TVars>(body: string, tokens: readonly MergeToken<TVars>[]): string {
  return body.replace(MERGE_TOKEN_PATTERN, (match, name: string) => {
    const token = tokens.find(candidate => candidate.token === name)
    return token ? token.sample : match
  })
}

/** Token names in a body, in order, once each. */
export function listMergeTokens(body: string): string[] {
  return [...new Set([...body.matchAll(MERGE_TOKEN_PATTERN)].map(match => match[1]))]
}
```

- [ ] **Step 4: Write `sms-segments.ts`**

```ts
const GSM7_BASIC = new Set('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà')
// Sent as an escape plus a character, so each costs two.
const GSM7_EXTENDED = new Set('^{}\\[~]|€\f')

export type SmsEncoding = 'gsm7' | 'ucs2'

/** The characters that push a text out of GSM-7, once each, in order. */
export function findNonGsm7(body: string): string[] {
  return [...new Set([...body].filter(char => !GSM7_BASIC.has(char) && !GSM7_EXTENDED.has(char)))]
}

/** One character outside GSM-7 switches the whole text to UCS-2 (70 per text, 67 per part), roughly tripling its cost. */
export function countSmsSegments(body: string): { chars: number, segments: number, encoding: SmsEncoding } {
  if (body.length === 0) {
    return { chars: 0, segments: 0, encoding: 'gsm7' }
  }
  if (findNonGsm7(body).length > 0) {
    const chars = body.length
    return { chars, segments: chars <= 70 ? 1 : Math.ceil(chars / 67), encoding: 'ucs2' }
  }
  const chars = [...body].reduce((total, char) => total + (GSM7_EXTENDED.has(char) ? 2 : 1), 0)
  return { chars, segments: chars <= 160 ? 1 : Math.ceil(chars / 153), encoding: 'gsm7' }
}
```

- [ ] **Step 5: Move the campaign consumers onto the VoIP helpers**

`src/shared/entities/voip-campaigns/lib/sms-merge-tokens.ts`: delete the `SmsMergeToken` interface (`:16-24`), add the type import, and retype the list. The file's first lines become:

```ts
import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'

import { pickPrimaryTrade } from '@/shared/services/voip/campaigns/lib/pick-primary-trade'
```

and the list declaration becomes:

```ts
export const SMS_MERGE_TOKENS: readonly MergeToken<SmsMergeVars>[] = [
```

`src/shared/services/voip/campaigns/lib/render-sms-template.ts` becomes:

```ts
import type { SmsMergeVars } from '@/shared/entities/voip-campaigns/lib/sms-merge-tokens'

import { SMS_MERGE_TOKENS } from '@/shared/entities/voip-campaigns/lib/sms-merge-tokens'
import { renderMergeTemplate } from '@/shared/services/voip/lib/sms-merge-template'

// The dialer's SMS send takes a literal body (no contact merge), so campaign bodies render in-app.
export function renderSmsTemplate(body: string, vars: SmsMergeVars): string {
  return renderMergeTemplate(body, SMS_MERGE_TOKENS, vars)
}
```

`src/features/campaigns-admin/ui/components/setup/cadence-message-row.tsx:8`: change the import to

```ts
import { countSmsSegments } from '@/shared/services/voip/lib/sms-segments'
```

Delete the old file: `git rm src/features/campaigns-admin/lib/sms-segments.ts`

- [ ] **Step 6: Confirm nothing still imports the old paths**

Run: `grep -rn "campaigns-admin/lib/sms-segments\|SmsMergeToken\b" src scripts`
Expected: no output.

- [ ] **Step 7: Run the script, type-check, lint**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: sections 1 and 2 print `✓`; `tsc` and `lint` clean.

- [ ] **Step 8: Commit**

```bash
git add scripts/verify-visit-messages.ts src/shared/services/voip/lib/sms-merge-template.ts src/shared/services/voip/lib/sms-segments.ts src/shared/entities/voip-campaigns/lib/sms-merge-tokens.ts src/shared/services/voip/campaigns/lib/render-sms-template.ts src/features/campaigns-admin/ui/components/setup/cadence-message-row.tsx src/features/campaigns-admin/lib/sms-segments.ts
git commit -m "refactor(voip): one merge-token renderer and an encoding-aware segment count, shared by campaigns and visit messages"
```

---

### Task 3: Pacific day, clock and arrival-window text

**Files:**
- Modify: `src/shared/lib/business-time.ts` (add after `formatBusinessTime`, `:75`)
- Modify: `src/shared/entities/meetings/constants/scheduling.ts`
- Create: `src/shared/modules/meetings/core/lib/arrival-window.ts`
- Modify: `src/shared/services/notification.service.ts:23-34,149,173,213,216`
- Modify: `scripts/verify-visit-messages.ts`

**Interfaces:**
- Produces: `formatBusinessDay(date: Date | string): string` → `"Wed, Oct 7"`
- Produces: `formatBusinessClock(date: Date | string): string` → `"10:00 AM"`
- Produces: `formatBusinessDayTime(date: Date | string): string` → `"Wed, Oct 7, 10:00 AM"`
- Produces: `businessDateTime(calendarDay: string, hour: number, minute: number): Date`
- Produces: `MEETING_ARRIVAL_WINDOW_MS`, `formatArrivalWindow(scheduledFor: string): string` → `"10:00 and 10:30 AM"`

- [ ] **Step 1: Write the failing test**

Add to the imports of `scripts/verify-visit-messages.ts`:

```ts
import { businessDateTime, formatBusinessClock, formatBusinessDay, formatBusinessDayTime } from '@/shared/lib/business-time'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'
```

Add above the final line:

```ts
{
  assert.equal(formatBusinessDay('2026-10-07T17:00:00.000Z'), 'Wed, Oct 7')
  assert.equal(formatBusinessClock('2026-10-07T17:00:00.000Z'), '10:00 AM')
  assert.equal(formatBusinessDayTime('2026-10-07T17:00:00.000Z'), 'Wed, Oct 7, 10:00 AM')
  assert.equal(formatBusinessClock('2026-10-07 17:00:00+00'), '10:00 AM', 'the spelling Postgres hands back is the same instant')
  assert.equal(countSmsSegments(formatBusinessDayTime('2026-10-07T17:00:00.000Z')).encoding, 'gsm7', 'no narrow no-break space survives')

  // 10:00 AM local on the days around both 2026 clock changes (Mar 8, Nov 1).
  assert.equal(formatBusinessClock('2026-03-07T18:00:00.000Z'), '10:00 AM')
  assert.equal(formatBusinessClock('2026-03-08T17:00:00.000Z'), '10:00 AM')
  assert.equal(formatBusinessClock('2026-10-31T17:00:00.000Z'), '10:00 AM')
  assert.equal(formatBusinessClock('2026-11-01T18:00:00.000Z'), '10:00 AM')

  assert.equal(businessDateTime('2026-10-08', 18, 0).toISOString(), '2026-10-09T01:00:00.000Z')
  assert.equal(businessDateTime('2026-10-09', 0, 0).toISOString(), '2026-10-09T07:00:00.000Z')
  assert.equal(businessDateTime('2026-03-08', 8, 30).toISOString(), '2026-03-08T15:30:00.000Z', '8:30 AM on the spring-forward day')
  assert.equal(businessDateTime('2026-03-08', 18, 0).toISOString(), '2026-03-09T01:00:00.000Z', '6 PM on the spring-forward day')
  assert.equal(businessDateTime('2026-11-01', 8, 30).toISOString(), '2026-11-01T16:30:00.000Z', '8:30 AM on the fall-back day')
  assert.equal(businessDateTime('2026-11-01', 18, 0).toISOString(), '2026-11-02T02:00:00.000Z', '6 PM on the fall-back day')

  assert.equal(formatArrivalWindow('2026-10-07T17:00:00.000Z'), '10:00 and 10:30 AM')
  assert.equal(formatArrivalWindow('2026-10-07T18:45:00.000Z'), '11:45 AM and 12:15 PM', 'a window that crosses noon names both halves')
}
console.log('3. Pacific time text ✓')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL, `Cannot find module '@/shared/modules/meetings/core/lib/arrival-window'`.

- [ ] **Step 3: Add the formatters to `business-time.ts`**

Insert after `formatBusinessTime` (after `:75`):

```ts
// Intl prints a narrow no-break space before AM/PM. One of those in a text message switches it out of GSM-7.
function plainSpaces(text: string): string {
  return text.replace(/[  ]/g, ' ')
}

/** "Wed, Oct 7" */
export function formatBusinessDay(date: Date | string): string {
  return plainSpaces(formatBusinessTime(date, { weekday: 'short', month: 'short', day: 'numeric' }))
}

/** "10:00 AM" */
export function formatBusinessClock(date: Date | string): string {
  return plainSpaces(formatBusinessTime(date, { hour: 'numeric', minute: '2-digit' }))
}

/** "Wed, Oct 7, 10:00 AM" */
export function formatBusinessDayTime(date: Date | string): string {
  return plainSpaces(formatBusinessTime(date, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))
}

/** The instant of `hour:minute` wall-clock time on a business day. Two-pass offset, like `startOfDayInTimeZone`. */
export function businessDateTime(calendarDay: string, hour: number, minute: number): Date {
  const [year, month, day] = calendarDay.split('-').map(Number)
  const target = Date.UTC(year, month - 1, day, hour, minute, 0)

  let instantMs = target - utcOffsetMs(new Date(target), BUSINESS_TIMEZONE)
  instantMs = target - utcOffsetMs(new Date(instantMs), BUSINESS_TIMEZONE)

  return new Date(instantMs)
}
```

- [ ] **Step 4: Add the arrival window**

Append to `src/shared/entities/meetings/constants/scheduling.ts`:

```ts
/** The rep arrives between the booked time and this long after it. */
export const MEETING_ARRIVAL_WINDOW_MS = 30 * 60 * 1000
```

Create `src/shared/modules/meetings/core/lib/arrival-window.ts`:

```ts
import { MEETING_ARRIVAL_WINDOW_MS } from '@/shared/entities/meetings/constants/scheduling'
import { formatBusinessClock } from '@/shared/lib/business-time'

/** Reads after "between": "10:00 and 10:30 AM", or "11:45 AM and 12:15 PM" across noon. */
export function formatArrivalWindow(scheduledFor: string): string {
  const from = formatBusinessClock(scheduledFor)
  const to = formatBusinessClock(new Date(new Date(scheduledFor).getTime() + MEETING_ARRIVAL_WINDOW_MS))
  const [fromClock, fromPeriod] = from.split(' ')
  const [, toPeriod] = to.split(' ')
  return fromPeriod === toPeriod ? `${fromClock} and ${to}` : `${from} and ${to}`
}
```

- [ ] **Step 5: Replace the private formatter in the notification service**

In `src/shared/services/notification.service.ts`: delete `PT_DATE_FMT` and `formatScheduledTime` (`:23-34`), add `import { formatBusinessDayTime } from '@/shared/lib/business-time'` with the other `@/shared/lib` imports, and replace every `formatScheduledTime(` call with `formatBusinessDayTime(` (five calls, on `:149`, `:173`, `:213` and `:216`).

Run: `grep -n "formatScheduledTime\|PT_DATE_FMT" src/shared/services/notification.service.ts`
Expected: no output.

- [ ] **Step 6: Run the script, type-check, lint**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: sections 1–3 print `✓`; `tsc` and `lint` clean.

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-visit-messages.ts src/shared/lib/business-time.ts src/shared/entities/meetings/constants/scheduling.ts src/shared/modules/meetings/core/lib/arrival-window.ts src/shared/services/notification.service.ts
git commit -m "feat(time): Pacific day, clock and arrival-window text; a wall-clock time on a business day as an instant"
```

---

### Task 4: The calendar invite builder

**Files:**
- Create: `src/shared/modules/meetings/messages/lib/build-ics.ts`
- Modify: `scripts/verify-visit-messages.ts`

**Interfaces:**
- Produces: `buildIcs(input: IcsEventInput): string`, where

```ts
interface IcsParty { name: string, email: string }
interface IcsEventInput {
  method: 'REQUEST' | 'CANCEL'
  prodId: string
  uid: string
  sequence: number
  start: Date | string
  durationMs: number
  summary: string
  description?: string
  location?: string
  url?: string
  organizer: IcsParty
  attendee: IcsParty
  now: Date
}
```

The caller (plan 2) supplies `prodId`, the organizer and the UID from company constants and the reschedule chain; this file knows nothing about meetings.

- [ ] **Step 1: Write the failing test**

Add to the imports:

```ts
import { buildIcs } from '@/shared/modules/meetings/messages/lib/build-ics'
```

Add above the final line:

```ts
{
  const event = {
    prodId: '-//Example Co//Home Visit//EN',
    uid: 'meeting-1@example.com',
    start: '2026-10-07T17:00:00.000Z',
    durationMs: 2 * 60 * 60 * 1000,
    summary: 'Home visit with Oliver; bring questions',
    description: 'Line one\nLine two',
    location: '123 Main St, Pasadena, CA 91101',
    url: 'https://example.com/home-visits/meeting-1?token=abc',
    organizer: { name: 'Example Co', email: 'info@example.com' },
    attendee: { name: 'Lopez, Maria', email: 'maria@example.com' },
    now: new Date('2026-10-05T16:00:00.000Z'),
  }
  const invite = buildIcs({ ...event, method: 'REQUEST', sequence: 0 })
  assert.ok(invite.endsWith('\r\n'), 'lines end in CRLF')
  assert.ok(invite.split('\r\n').every(line => new TextEncoder().encode(line).length <= 75), 'no line is longer than 75 octets')

  const lines = invite.replace(/\r\n /g, '').split('\r\n')
  assert.equal(lines[0], 'BEGIN:VCALENDAR')
  assert.ok(lines.includes('METHOD:REQUEST'))
  assert.ok(lines.includes('UID:meeting-1@example.com'))
  assert.ok(lines.includes('SEQUENCE:0'))
  assert.ok(lines.includes('DTSTAMP:20261005T160000Z'))
  assert.ok(lines.includes('DTSTART:20261007T170000Z'))
  assert.ok(lines.includes('DTEND:20261007T190000Z'))
  assert.ok(lines.includes('SUMMARY:Home visit with Oliver\\; bring questions'), 'semicolons are escaped')
  assert.ok(lines.includes('DESCRIPTION:Line one\\nLine two'), 'newlines are escaped')
  assert.ok(lines.includes('LOCATION:123 Main St\\, Pasadena\\, CA 91101'), 'commas are escaped')
  assert.ok(lines.includes('ORGANIZER;CN=Example Co:mailto:info@example.com'))
  assert.ok(lines.includes('ATTENDEE;CN="Lopez, Maria";ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:maria@example.com'), 'a name with a comma is quoted')
  assert.ok(lines.includes('STATUS:CONFIRMED'))

  const cancellation = buildIcs({ ...event, method: 'CANCEL', sequence: 3 }).replace(/\r\n /g, '').split('\r\n')
  assert.ok(cancellation.includes('METHOD:CANCEL'))
  assert.ok(cancellation.includes('UID:meeting-1@example.com'), 'a cancellation names the same event')
  assert.ok(cancellation.includes('SEQUENCE:3'))
  assert.ok(cancellation.includes('STATUS:CANCELLED'))
}
console.log('4. Calendar invite ✓')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL, `Cannot find module '@/shared/modules/meetings/messages/lib/build-ics'`.

- [ ] **Step 3: Write `src/shared/modules/meetings/messages/lib/build-ics.ts`**

```ts
export interface IcsParty {
  name: string
  email: string
}

export interface IcsEventInput {
  method: 'REQUEST' | 'CANCEL'
  prodId: string
  /** Stable for the life of the event: a resend with the same UID updates the entry instead of adding one. */
  uid: string
  /** Calendars ignore an update whose SEQUENCE is not higher than the one they hold. */
  sequence: number
  start: Date | string
  durationMs: number
  summary: string
  description?: string
  location?: string
  url?: string
  organizer: IcsParty
  attendee: IcsParty
  /** DTSTAMP. Passed in so the output is the same for the same input. */
  now: Date
}

const MAX_LINE_OCTETS = 75
const encoder = new TextEncoder()

function utcStamp(date: Date | string): string {
  return new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function paramValue(value: string): string {
  const clean = value.replace(/"/g, '')
  return /[,;:]/.test(clean) ? `"${clean}"` : clean
}

// RFC 5545 caps a line at 75 octets; a continuation starts with one space, which counts.
function fold(line: string): string {
  const parts: string[] = []
  let current = ''
  let octets = 0
  for (const char of line) {
    const size = encoder.encode(char).length
    if (octets + size > MAX_LINE_OCTETS) {
      parts.push(current)
      current = ' '
      octets = 1
    }
    current += char
    octets += size
  }
  parts.push(current)
  return parts.join('\r\n')
}

export function buildIcs(input: IcsEventInput): string {
  const start = new Date(input.start)
  const end = new Date(start.getTime() + input.durationMs)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${input.prodId}`,
    'CALSCALE:GREGORIAN',
    `METHOD:${input.method}`,
    'BEGIN:VEVENT',
    `UID:${input.uid}`,
    `SEQUENCE:${input.sequence}`,
    `DTSTAMP:${utcStamp(input.now)}`,
    `DTSTART:${utcStamp(start)}`,
    `DTEND:${utcStamp(end)}`,
    `SUMMARY:${escapeText(input.summary)}`,
    ...(input.description ? [`DESCRIPTION:${escapeText(input.description)}`] : []),
    ...(input.location ? [`LOCATION:${escapeText(input.location)}`] : []),
    ...(input.url ? [`URL:${input.url}`] : []),
    `ORGANIZER;CN=${paramValue(input.organizer.name)}:mailto:${input.organizer.email}`,
    `ATTENDEE;CN=${paramValue(input.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${input.attendee.email}`,
    `STATUS:${input.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return `${lines.map(fold).join('\r\n')}\r\n`
}
```

- [ ] **Step 4: Run the script, type-check, lint**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: sections 1–4 print `✓`; `tsc` and `lint` clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-visit-messages.ts src/shared/modules/meetings/messages/lib/build-ics.ts
git commit -m "feat(calendar): build one iCalendar event, as an invite or a cancellation"
```

---

### Task 5: The home visit path

**Files:**
- Modify: `src/shared/config/roots.ts:108-113`
- Modify: `eslint.config.js:7-8`
- Modify: `scripts/verify-visit-messages.ts`

**Interfaces:**
- Produces: `ROOTS.public.homeVisits(): '/home-visits'`, `ROOTS.public.homeVisit(meetingId: string, token?: string): string`

The route itself is built in the page plan. The builder lands now because the message wording links to it.

- [ ] **Step 1: Write the failing test**

Add to the imports:

```ts
import { ROOTS } from '@/shared/config/roots'
```

Add above the final line:

```ts
{
  assert.equal(ROOTS.public.homeVisit('m-1', 'tok'), '/home-visits/m-1?token=tok')
  assert.equal(ROOTS.public.homeVisit('m-1'), '/home-visits/m-1', 'staff open it signed in, with no token')
}
console.log('5. Home visit path ✓')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL, `ROOTS.public.homeVisit is not a function`.

- [ ] **Step 3: Add the builders**

In `src/shared/config/roots.ts`, inside `public` after `proposalReview`:

```ts
    homeVisits: () => '/home-visits',
    homeVisit: (meetingId: string, token?: string) =>
      `${APP_ROOTS.public.homeVisits()}/${meetingId}${token ? `?token=${token}` : ''}`,
```

In `eslint.config.js:8`, add `home-visits` to the prefix group:

```js
  = '/^\\/(dashboard|portfolio|services|proposal-flow|home-visits|funnels|intake|about|contact|blog|community|experience)(\\/|$)/'
```

- [ ] **Step 4: Run the script, type-check, lint**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: sections 1–5 print `✓`; `tsc` and `lint` clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/verify-visit-messages.ts src/shared/config/roots.ts eslint.config.js
git commit -m "feat(routes): the home visit path builder, guarded like the other app paths"
```

---

### Task 6: The messages unit's vocabulary

**Files:**
- Modify: `src/shared/constants/enums/meetings.ts` (append)
- Create: `src/shared/modules/meetings/messages/constants/kinds.ts`
- Create: `src/shared/modules/meetings/messages/constants/schedule.ts`
- Create: `src/shared/modules/meetings/messages/constants/keywords.ts`
- Create: `src/shared/modules/meetings/messages/constants/templates.ts`
- Create: `src/shared/modules/meetings/messages/types.ts`

**Interfaces:**
- Consumes: `MergeToken` (Task 2), `ROOTS.public.homeVisit` (Task 5)
- Produces (names later tasks and plans rely on): `homeownerConfirmationOptions` / `HomeownerConfirmation`; `meetingMessageKinds` / `MeetingMessageKind`; `meetingMessageChannels` / `MeetingMessageChannel`; `meetingMessageStatuses` / `MeetingMessageStatus`; `VISIT_MESSAGE_SEQUENCE` / `VisitMessageSequenceKind`; `pausableVisitMessageKinds` / `PausableVisitMessageKind`; `visitMessageSkipReasons` / `VisitMessageSkipReason`; `visitMessageTemplateKeys` / `VisitMessageTemplateKey` (all of these in `constants/kinds.ts`); `VISIT_MESSAGE_SCHEDULE`, `VISIT_MESSAGE_LATE_AFTER_MS`, `VISIT_MESSAGE_PENDING_STALE_MS`, `VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS`; `CONFIRM_KEYWORDS`; `VISIT_MESSAGE_TEMPLATE_DEFAULTS`; `VISIT_MESSAGE_TOKENS`; `VISIT_MESSAGE_REQUIRED_TOKENS`; `VISIT_MESSAGE_SUMMARY_ONLY_TOKENS`; `VISIT_MESSAGE_STOP_LINE`; `REP_NAME_FALLBACK`; types `VisitMessageVars`, `VisitMessageFact`, `VisitMessageStep`, `VisitMessageStepState`, `VisitMessagePlanInput`, `ConfirmationTrack`

No test of its own: Task 7 asserts every default against the validator. This task must type-check.

- [ ] **Step 1: Add the homeowner-confirmation option set**

Append to `src/shared/constants/enums/meetings.ts`:

```ts
/** Every way a homeowner can confirm a visit themselves. The office's own confirmation is `confirmedAt`. */
export const homeownerConfirmationOptions = ['sms_reply', 'in_app'] as const
export type HomeownerConfirmation = (typeof homeownerConfirmationOptions)[number]
```

`src/shared/constants/enums/index.ts` re-exports `./meetings` with `export *` (`:10`), so the new names need no index change.

- [ ] **Step 2: Create `constants/kinds.ts`**

```ts
export const meetingMessageKinds = [
  'visit_summary',
  'day_before_reminder',
  'rep_confirmation',
  'confirmation_reply',
  'visit_cancellation',
  'homeowner_reply',
] as const
export type MeetingMessageKind = (typeof meetingMessageKinds)[number]

export const meetingMessageChannels = ['sms', 'email'] as const
export type MeetingMessageChannel = (typeof meetingMessageChannels)[number]

/** `received` is a homeowner reply; the rest describe something Tri Pros sent or chose not to. */
export const meetingMessageStatuses = ['pending', 'sent', 'failed', 'skipped', 'received'] as const
export type MeetingMessageStatus = (typeof meetingMessageStatuses)[number]

/** The order a meeting's texts go in. The confirmation reply and the visit cancellation are reactions, not steps. */
export const VISIT_MESSAGE_SEQUENCE = ['visit_summary', 'day_before_reminder', 'rep_confirmation'] as const satisfies readonly MeetingMessageKind[]
export type VisitMessageSequenceKind = (typeof VISIT_MESSAGE_SEQUENCE)[number]

/** The automatic kinds. Only these can be paused or skipped. */
export const pausableVisitMessageKinds = ['day_before_reminder', 'rep_confirmation'] as const satisfies readonly MeetingMessageKind[]
export type PausableVisitMessageKind = (typeof pausableVisitMessageKinds)[number]

export const visitMessageSkipReasons = ['booked_after_noon', 'paused', 'no_phone', 'dnc', 'manual'] as const
export type VisitMessageSkipReason = (typeof visitMessageSkipReasons)[number]

/** One per wording a super-admin can edit. The day-before reminder has two, by whether the homeowner confirmed. */
export const visitMessageTemplateKeys = [
  'visit_summary',
  'day_before_reminder_unconfirmed',
  'day_before_reminder_confirmed',
  'rep_confirmation',
  'confirmation_reply',
] as const
export type VisitMessageTemplateKey = (typeof visitMessageTemplateKeys)[number]
```

This file imports nothing: `src/shared/db/schema/` reads its arrays (Task 9), and drizzle-kit loads schema files on its own.

- [ ] **Step 3: Create `constants/schedule.ts`**

```ts
import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

/** Pacific wall-clock send times. The cron expressions are built from this, so what a screen shows is what runs. */
export const VISIT_MESSAGE_SCHEDULE = {
  // A summary sent after `summaryCutoffHour` the day before makes the 6 PM reminder a repeat.
  day_before_reminder: { hour: 18, minute: 0, daysBefore: 1, summaryCutoffHour: 12 },
  // A "good morning" text 30 minutes before the visit is noise, so earlier visits get none.
  rep_confirmation: { hour: 8, minute: 30, daysBefore: 0, earliestVisitHour: 9 },
} as const satisfies Record<PausableVisitMessageKind, { hour: number, minute: number, daysBefore: number }>

export const VISIT_MESSAGE_LATE_AFTER_MS = 15 * 60 * 1000
export const VISIT_MESSAGE_PENDING_STALE_MS = 10 * 60 * 1000
/** QStash can deliver a moment early; anything earlier than this is not today's run. */
export const VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS = 5 * 60 * 1000
```

- [ ] **Step 4: Create `constants/keywords.ts`**

```ts
/** The whole reply must be one of these. "Yes but…" is a message for a person, not a confirmation. */
export const CONFIRM_KEYWORDS = ['yes', 'y', 'confirm', 'confirmed'] as const
```

- [ ] **Step 5: Create `types.ts`**

```ts
import type { HomeownerConfirmation, MeetingOutcome, MeetingType } from '@/shared/constants/enums/meetings'
import type {
  MeetingMessageChannel,
  MeetingMessageKind,
  MeetingMessageStatus,
  PausableVisitMessageKind,
  VisitMessageSequenceKind,
  VisitMessageSkipReason,
} from '@/shared/modules/meetings/messages/constants/kinds'

/** The part of a visit message the rules read. A `meeting_messages` row satisfies it. */
export interface VisitMessageFact {
  kind: MeetingMessageKind
  channel: MeetingMessageChannel
  status: MeetingMessageStatus
  reason: string | null
  forScheduledFor: string
  createdAt: string
}

export interface VisitMessageVars {
  firstName: string
  /** null when the meeting has no rep yet. */
  repName: string | null
  visitDate: string
  visitTime: string
  arrivalWindow: string
  visitLink: string
  officeNote: string
}

export type VisitMessageStepState
  = | 'sent'
    | 'failed'
    | 'sending'
    | 'skipped'
    | 'not_applicable'
    | 'scheduled'
    | 'due'
    | 'not_sent'

export interface VisitMessageStep {
  kind: VisitMessageSequenceKind
  /** ISO instant; null for the visit summary, which a person sends. */
  plannedFor: string | null
  state: VisitMessageStepState
  reason: string | null
  /** Set on a scheduled or due step when the run will record a skip instead of sending. */
  skipReason: VisitMessageSkipReason | null
  late: boolean
  variant: 'confirmed' | 'unconfirmed' | null
  row: VisitMessageFact | null
}

export interface VisitMessagePlanInput {
  meeting: {
    scheduledFor: string
    createdAt: string
    meetingType: MeetingType
    meetingOutcome: MeetingOutcome
    confirmedAt: string | null
    homeownerConfirmedAt: string | null
    /** False when the owner is the system account. */
    hasRep: boolean
  }
  /** Every visit message in the meeting's reschedule chain. */
  messages: readonly VisitMessageFact[]
  contact: { hasPhone: boolean, doNotContact: boolean }
  pausedKinds: readonly PausableVisitMessageKind[]
  now: Date
}

export interface ConfirmationTrack {
  office: { done: boolean, nudge: 'summary_not_sent' | 'time_changed' | null }
  homeowner: { done: boolean, via: HomeownerConfirmation | 'office' | null }
  rep: { done: boolean }
}
```

- [ ] **Step 6: Create `constants/templates.ts`**

```ts
import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'
import type { MergeToken } from '@/shared/services/voip/lib/sms-merge-template'

import { APP_HOSTS, ROOTS } from '@/shared/config/roots'
import { companyInfo } from '@/shared/constants/company'

/** Appended by the renderer on the first text of a thread, so an edit cannot remove it. */
export const VISIT_MESSAGE_STOP_LINE = 'Reply STOP to opt out.'

/** A booking can land before a rep is assigned. */
export const REP_NAME_FALLBACK = 'your rep'

// The length of a real link, so a preview counts the segments a homeowner's text will use.
const VISIT_LINK_SAMPLE = `https://${APP_HOSTS.prod[0]}${ROOTS.public.homeVisit('00000000-0000-4000-8000-000000000000', '0'.repeat(32))}`

export const VISIT_MESSAGE_TOKENS = [
  { token: 'first_name', label: 'First name', sample: 'Maria', resolve: vars => vars.firstName },
  { token: 'rep_name', label: 'Rep name', sample: 'Oliver', resolve: vars => vars.repName ?? REP_NAME_FALLBACK },
  { token: 'visit_date', label: 'Visit date', sample: 'Wed, Oct 7', resolve: vars => vars.visitDate },
  { token: 'visit_time', label: 'Visit time', sample: '10:00 AM', resolve: vars => vars.visitTime },
  { token: 'arrival_window', label: 'Arrival window', sample: '10:00 and 10:30 AM', resolve: vars => vars.arrivalWindow },
  { token: 'visit_link', label: 'Visit link', sample: VISIT_LINK_SAMPLE, resolve: vars => vars.visitLink },
  { token: 'office_note', label: 'Office note', sample: '', resolve: vars => vars.officeNote },
] as const satisfies readonly MergeToken<VisitMessageVars>[]

/** Typed into the send dialog, so only the summary has one. */
export const VISIT_MESSAGE_SUMMARY_ONLY_TOKENS: readonly string[] = ['office_note']

export const VISIT_MESSAGE_REQUIRED_TOKENS: Record<VisitMessageTemplateKey, readonly string[]> = {
  visit_summary: ['visit_link', 'visit_date', 'visit_time'],
  day_before_reminder_unconfirmed: ['visit_link', 'visit_time'],
  day_before_reminder_confirmed: ['visit_link', 'visit_time'],
  rep_confirmation: ['rep_name', 'arrival_window', 'visit_link'],
  confirmation_reply: ['visit_date', 'visit_time'],
}

export const VISIT_MESSAGE_TEMPLATE_DEFAULTS: Record<VisitMessageTemplateKey, string> = {
  visit_summary: `Hi {{first_name}}, this is ${companyInfo.name}. Your home visit is booked for {{visit_date}} at {{visit_time}} with {{rep_name}}. {{office_note}} Meet {{rep_name}} and see your visit details: {{visit_link}} Reply YES to confirm.`,
  day_before_reminder_unconfirmed: `Hi {{first_name}}, a reminder that {{rep_name}} from ${companyInfo.name} will see you tomorrow, {{visit_date}} at {{visit_time}}. Reply YES to confirm, or request a new time here: {{visit_link}}`,
  day_before_reminder_confirmed: `Hi {{first_name}}, see you tomorrow at {{visit_time}}! {{rep_name}} is looking forward to meeting you. Your visit: {{visit_link}} - ${companyInfo.name}`,
  rep_confirmation: `Good morning {{first_name}}! {{rep_name}} just confirmed your home visit and is scheduled to arrive between {{arrival_window}}. Your visit page: {{visit_link}} - ${companyInfo.name}`,
  confirmation_reply: `Thank you, {{first_name}}, you're confirmed for {{visit_date}} at {{visit_time}}. See you then! - ${companyInfo.name}`,
}
```

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add src/shared/constants/enums/meetings.ts src/shared/constants/enums/index.ts src/shared/modules/meetings/messages/constants src/shared/modules/meetings/messages/types.ts
git commit -m "feat(visit-messages): the unit's kinds, send schedule, default wording and tokens"
```

(If `enums/index.ts` did not change, leave it out of `git add`.)

---

### Task 7: Render a text, validate a template, read a reply

**Files:**
- Create: `src/shared/modules/meetings/messages/lib/render-visit-message.ts`
- Create: `src/shared/modules/meetings/messages/lib/validate-visit-message-template.ts`
- Create: `src/shared/modules/meetings/messages/lib/match-reply-keyword.ts`
- Modify: `scripts/verify-visit-messages.ts`

**Interfaces:**
- Consumes: Task 2, Task 3 and Task 6 names
- Produces: `buildVisitMessageVars(input: { customerName: string | null, repName: string | null, scheduledFor: string, visitLink: string, officeNote?: string | null }): VisitMessageVars`
- Produces: `renderVisitMessage(body: string, vars: VisitMessageVars, options: { stopLine: boolean }): string`
- Produces: `validateVisitMessageTemplate(key: VisitMessageTemplateKey, body: string): { errors: TemplateIssue[], warnings: TemplateIssue[] }` with `interface TemplateIssue { code: string, message: string }`. Error codes: `empty`, `not_gsm7`, `unknown_token`, `token_not_allowed`, `missing_token`, `contains_stop`. Warning codes: `too_long`, `pronoun`, `no_yes_ask`.
- Produces: `matchReplyKeyword(body: string): 'confirm' | null`

The link is a variable, never built here: this code runs in the pure script and in the browser editor, where `publicUrl` is unavailable.

- [ ] **Step 1: Write the failing test**

Add to the imports:

```ts
import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import { companyInfo } from '@/shared/constants/company'
import { visitMessageTemplateKeys } from '@/shared/modules/meetings/messages/constants/kinds'
import { VISIT_MESSAGE_TEMPLATE_DEFAULTS } from '@/shared/modules/meetings/messages/constants/templates'
import { matchReplyKeyword } from '@/shared/modules/meetings/messages/lib/match-reply-keyword'
import { buildVisitMessageVars, renderVisitMessage } from '@/shared/modules/meetings/messages/lib/render-visit-message'
import { validateVisitMessageTemplate } from '@/shared/modules/meetings/messages/lib/validate-visit-message-template'
```

Add above the final line:

```ts
{
  for (const key of visitMessageTemplateKeys) {
    assert.deepEqual(validateVisitMessageTemplate(key, VISIT_MESSAGE_TEMPLATE_DEFAULTS[key]), { errors: [], warnings: [] }, `the default for ${key} is clean`)
  }

  const errors = (key: VisitMessageTemplateKey, body: string) => validateVisitMessageTemplate(key, body).errors.map(issue => issue.code)
  assert.deepEqual(errors('confirmation_reply', '   '), ['empty'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} — thanks'), ['not_gsm7'], 'an em dash is rejected')
  assert.match(validateVisitMessageTemplate('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} — \u{1F600}').errors[0].message, /—.*\u{1F600}/u, 'the message lists each offending character')
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{nope}}'), ['unknown_token'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}} {{office_note}}'), ['token_not_allowed'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}}'), ['missing_token'])
  assert.deepEqual(errors('confirmation_reply', 'See you {{visit_date}} at {{visit_time}}. Reply stop to opt out.'), ['contains_stop'], 'the renderer adds the STOP line; a second copy would repeat it')

  const warnings = (key: VisitMessageTemplateKey, body: string) => validateVisitMessageTemplate(key, body).warnings.map(issue => issue.code)
  assert.deepEqual(warnings('rep_confirmation', `${VISIT_MESSAGE_TEMPLATE_DEFAULTS.rep_confirmation} ${'x'.repeat(200)}`), ['too_long'])
  assert.deepEqual(warnings('visit_summary', `${VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary} ${'x'.repeat(400)}`), [], 'the summary goes as MMS, so its length is not flagged')
  assert.deepEqual(warnings('rep_confirmation', '{{rep_name}} confirmed. He arrives between {{arrival_window}}. {{visit_link}}'), ['pronoun'])
  assert.deepEqual(warnings('rep_confirmation', '{{rep_name}} is here between {{arrival_window}}, this morning: {{visit_link}}'), [], '"here" and "this" are not pronouns')
  assert.deepEqual(warnings('day_before_reminder_unconfirmed', 'See you tomorrow at {{visit_time}}: {{visit_link}}'), ['no_yes_ask'])

  const vars = buildVisitMessageVars({ customerName: 'Maria Lopez', repName: 'Oliver', scheduledFor: '2026-10-07T17:00:00.000Z', visitLink: 'https://example.com/v' })
  assert.deepEqual(vars, {
    firstName: 'Maria',
    repName: 'Oliver',
    visitDate: 'Wed, Oct 7',
    visitTime: '10:00 AM',
    arrivalWindow: '10:00 and 10:30 AM',
    visitLink: 'https://example.com/v',
    officeNote: '',
  })
  assert.equal(
    renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, vars, { stopLine: true }),
    `Hi Maria, this is ${companyInfo.name}. Your home visit is booked for Wed, Oct 7 at 10:00 AM with Oliver. Meet Oliver and see your visit details: https://example.com/v Reply YES to confirm. Reply STOP to opt out.`,
    'an empty note leaves no double space, and the STOP line is appended',
  )
  assert.ok(
    renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, { ...vars, officeNote: 'Gate code 1234.' }, { stopLine: false })
      .includes('with Oliver. Gate code 1234. Meet Oliver'),
    'the office note sits where the token is',
  )
  assert.ok(
    renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.visit_summary, { ...vars, repName: null }, { stopLine: false })
      .includes('with your rep. Meet your rep and see'),
    'a meeting with no rep yet says "your rep"',
  )
  assert.ok(!renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.rep_confirmation, vars, { stopLine: false }).includes('STOP'))

  for (const key of visitMessageTemplateKeys) {
    assert.equal(countSmsSegments(renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS[key], vars, { stopLine: true })).encoding, 'gsm7', `${key} renders as GSM-7 with real formatted times`)
  }

  const visit = { repName: 'Oliver', scheduledFor: '2026-10-07T17:00:00.000Z', visitLink: 'https://example.com/v' }
  assert.equal(buildVisitMessageVars({ ...visit, customerName: null }).firstName, 'there', 'no name on file reads "Hi there"')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: '   ' }).firstName, 'there')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: 'Cher' }).firstName, 'Cher')
  assert.equal(buildVisitMessageVars({ ...visit, customerName: '  Zoë  Kim ' }).firstName, 'Zoë')
  assert.equal(
    countSmsSegments(renderVisitMessage(VISIT_MESSAGE_TEMPLATE_DEFAULTS.confirmation_reply, buildVisitMessageVars({ ...visit, customerName: 'Zoë Kim' }), { stopLine: false })).encoding,
    'ucs2',
    'a name outside GSM-7 still sends, spelled right',
  )
  assert.equal(buildVisitMessageVars({ ...visit, customerName: 'Maria', officeNote: '  Gate\ncode   1234. ' }).officeNote, 'Gate code 1234.', 'a note is one line')

  for (const reply of ['YES', 'yes', ' Yes! ', 'y', 'Confirm.', 'confirmed']) {
    assert.equal(matchReplyKeyword(reply), 'confirm', reply)
  }
  for (const reply of ['', 'yes please', 'Yes but my husband can\'t make it', 'no', 'Cancel, can we do Thursday?', 'yess']) {
    assert.equal(matchReplyKeyword(reply), null, reply)
  }
}
console.log('6. Wording: render, validate, replies ✓')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL, `Cannot find module '@/shared/modules/meetings/messages/lib/match-reply-keyword'`.

- [ ] **Step 3: Write `lib/render-visit-message.ts`**

```ts
import type { VisitMessageVars } from '@/shared/modules/meetings/messages/types'

import { formatBusinessClock, formatBusinessDay } from '@/shared/lib/business-time'
import { formatArrivalWindow } from '@/shared/modules/meetings/core/lib/arrival-window'
import { VISIT_MESSAGE_STOP_LINE, VISIT_MESSAGE_TOKENS } from '@/shared/modules/meetings/messages/constants/templates'
import { renderMergeTemplate } from '@/shared/services/voip/lib/sms-merge-template'

export function buildVisitMessageVars(input: {
  customerName: string | null
  repName: string | null
  scheduledFor: string
  visitLink: string
  officeNote?: string | null
}): VisitMessageVars {
  return {
    firstName: input.customerName?.trim().split(/\s+/)[0] || 'there',
    repName: input.repName,
    visitDate: formatBusinessDay(input.scheduledFor),
    visitTime: formatBusinessClock(input.scheduledFor),
    arrivalWindow: formatArrivalWindow(input.scheduledFor),
    visitLink: input.visitLink,
    officeNote: (input.officeNote ?? '').replace(/\s+/g, ' ').trim(),
  }
}

export function renderVisitMessage(body: string, vars: VisitMessageVars, options: { stopLine: boolean }): string {
  // An empty office note leaves two spaces where the token was.
  const rendered = renderMergeTemplate(body, VISIT_MESSAGE_TOKENS, vars).replace(/ {2,}/g, ' ').trim()
  return options.stopLine ? `${rendered} ${VISIT_MESSAGE_STOP_LINE}` : rendered
}
```

- [ ] **Step 4: Write `lib/validate-visit-message-template.ts`**

```ts
import type { VisitMessageTemplateKey } from '@/shared/modules/meetings/messages/constants/kinds'

import {
  VISIT_MESSAGE_REQUIRED_TOKENS,
  VISIT_MESSAGE_SUMMARY_ONLY_TOKENS,
  VISIT_MESSAGE_TOKENS,
} from '@/shared/modules/meetings/messages/constants/templates'
import { listMergeTokens, renderMergeSample } from '@/shared/services/voip/lib/sms-merge-template'
import { countSmsSegments, findNonGsm7 } from '@/shared/services/voip/lib/sms-segments'

export interface TemplateIssue {
  code: string
  message: string
}

const KNOWN_TOKENS: readonly string[] = VISIT_MESSAGE_TOKENS.map(token => token.token)
const MAX_SEGMENTS = 2
const ASKS_FOR_YES: readonly VisitMessageTemplateKey[] = ['visit_summary', 'day_before_reminder_unconfirmed']

/** Errors block a save; warnings do not. The editor runs this live and the save runs it again as the authority. */
export function validateVisitMessageTemplate(
  key: VisitMessageTemplateKey,
  body: string,
): { errors: TemplateIssue[], warnings: TemplateIssue[] } {
  const errors: TemplateIssue[] = []
  const warnings: TemplateIssue[] = []

  if (body.trim().length === 0) {
    return { errors: [{ code: 'empty', message: 'The text is empty.' }], warnings }
  }

  const nonGsm7 = findNonGsm7(body)
  if (nonGsm7.length > 0) {
    errors.push({ code: 'not_gsm7', message: `These characters make the text cost about three times as much: ${nonGsm7.join(' ')}. Use plain quotes and hyphens, and no emoji.` })
  }

  const used = listMergeTokens(body)
  const unknown = used.filter(token => !KNOWN_TOKENS.includes(token))
  if (unknown.length > 0) {
    errors.push({ code: 'unknown_token', message: `Unknown: ${unknown.map(token => `{{${token}}}`).join(', ')}.` })
  }

  const notAllowed = key === 'visit_summary' ? [] : used.filter(token => VISIT_MESSAGE_SUMMARY_ONLY_TOKENS.includes(token))
  if (notAllowed.length > 0) {
    errors.push({ code: 'token_not_allowed', message: `${notAllowed.map(token => `{{${token}}}`).join(', ')} only works in the visit summary.` })
  }

  const missing = VISIT_MESSAGE_REQUIRED_TOKENS[key].filter(token => !used.includes(token))
  if (missing.length > 0) {
    errors.push({ code: 'missing_token', message: `This text needs ${missing.map(token => `{{${token}}}`).join(', ')}.` })
  }

  if (/\bstop\b/i.test(body)) {
    errors.push({ code: 'contains_stop', message: 'Leave out the STOP line. It is added to the first text automatically.' })
  }

  if (key !== 'visit_summary' && countSmsSegments(renderMergeSample(body, VISIT_MESSAGE_TOKENS)).segments > MAX_SEGMENTS) {
    warnings.push({ code: 'too_long', message: `With a real link this is more than ${MAX_SEGMENTS} text segments.` })
  }

  if (/\b(?:he|she|him|his|her)\b/i.test(body)) {
    warnings.push({ code: 'pronoun', message: 'Name the rep with {{rep_name}} instead of a pronoun.' })
  }

  if (ASKS_FOR_YES.includes(key) && !/\byes\b/i.test(body)) {
    warnings.push({ code: 'no_yes_ask', message: 'This text no longer asks the homeowner to reply YES.' })
  }

  return { errors, warnings }
}
```

- [ ] **Step 5: Write `lib/match-reply-keyword.ts`**

```ts
import { CONFIRM_KEYWORDS } from '@/shared/modules/meetings/messages/constants/keywords'

/** Twilio's own rule for keywords: the whole message, not its first word. */
export function matchReplyKeyword(body: string): 'confirm' | null {
  const normalized = body.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, '').trim().replace(/\s+/g, ' ')
  return (CONFIRM_KEYWORDS as readonly string[]).includes(normalized) ? 'confirm' : null
}
```

- [ ] **Step 6: Run the script, type-check, lint**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: sections 1–6 print `✓`; `tsc` and `lint` clean. If a default fails `the default for … is clean`, fix the validator, not the default wording: the wording is the spec's (§7.2).

- [ ] **Step 7: Commit**

```bash
git add scripts/verify-visit-messages.ts src/shared/modules/meetings/messages/lib/render-visit-message.ts src/shared/modules/meetings/messages/lib/validate-visit-message-template.ts src/shared/modules/meetings/messages/lib/match-reply-keyword.ts
git commit -m "feat(visit-messages): render a text, validate a template's wording, read a YES reply"
```

---

### Task 8: Who gets which text, and when

**Files:**
- Create: `src/shared/modules/meetings/messages/lib/is-visit-message-eligible.ts`
- Create: `src/shared/modules/meetings/messages/lib/derive-confirmation-track.ts`
- Create: `src/shared/modules/meetings/messages/lib/plan-visit-messages.ts`
- Create: `src/shared/modules/meetings/messages/lib/resolve-run-instant.ts`
- Create: `src/shared/modules/meetings/messages/lib/should-send-visit-cancellation.ts`
- Modify: `scripts/verify-visit-messages.ts`

**Interfaces:**
- Consumes: `businessDateTime` (Task 3), Task 6 names
- Produces: `isVisitMessageEligible(meeting: { meetingType: MeetingType, meetingOutcome: MeetingOutcome, scheduledFor: string }, now: Date): boolean`
- Produces: `deriveConfirmationTrack(meeting: { scheduledFor: string, confirmedAt: string | null, homeownerConfirmedAt: string | null, homeownerConfirmedVia: HomeownerConfirmation | null }, chainMessages: readonly VisitMessageFact[]): ConfirmationTrack`
- Produces: `planVisitMessages(input: VisitMessagePlanInput): VisitMessageStep[]` (one step per `VISIT_MESSAGE_SEQUENCE` kind, in order). Step reasons: `project_meeting`, `outcome_decided`, `no_rep`, `before_9am`, `never_sent`, `time_changed`, `booked_after_run`, `no_record`, `send_interrupted`, or the row's own reason.
- Produces: `resolveRunInstant(kind: PausableVisitMessageKind, now: Date): Date | null`
- Produces: `shouldSendVisitCancellation(input: { chainMessages: readonly VisitMessageFact[], hasSuccessor: boolean }): boolean`

Every "for this time" comparison is by instant (`Date.getTime()`), never by string.

- [ ] **Step 1: Write the failing test**

Add to the imports:

```ts
import type { VisitMessageSequenceKind } from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageFact, VisitMessagePlanInput } from '@/shared/modules/meetings/messages/types'

import { deriveConfirmationTrack } from '@/shared/modules/meetings/messages/lib/derive-confirmation-track'
import { isVisitMessageEligible } from '@/shared/modules/meetings/messages/lib/is-visit-message-eligible'
import { planVisitMessages } from '@/shared/modules/meetings/messages/lib/plan-visit-messages'
import { resolveRunInstant } from '@/shared/modules/meetings/messages/lib/resolve-run-instant'
import { shouldSendVisitCancellation } from '@/shared/modules/meetings/messages/lib/should-send-visit-cancellation'
```

(Let `pnpm lint --fix` settle the import order.)

Add above the final line:

```ts
// Fri Oct 9 2026, 10:00 AM Pacific. Day before: reminder 6 PM = 2026-10-09T01:00Z, noon = 2026-10-08T19:00Z.
// Visit day: midnight = 2026-10-09T07:00Z, rep confirmation 8:30 AM = 2026-10-09T15:30Z.
const VISIT = '2026-10-09T17:00:00.000Z'
const VISIT_AS_POSTGRES = '2026-10-09 17:00:00+00'
const OLD_VISIT = '2026-10-08T17:00:00.000Z'

function fact(kind: VisitMessageFact['kind'], over: Partial<VisitMessageFact> = {}): VisitMessageFact {
  return { kind, channel: 'sms', status: 'sent', reason: null, forScheduledFor: VISIT, createdAt: '2026-10-07T18:00:00.000Z', ...over }
}
function planInput(over: Partial<VisitMessagePlanInput> = {}, meeting: Partial<VisitMessagePlanInput['meeting']> = {}): VisitMessagePlanInput {
  return {
    meeting: {
      scheduledFor: VISIT,
      createdAt: '2026-10-07T17:00:00.000Z',
      meetingType: 'Fresh',
      meetingOutcome: 'not_set',
      confirmedAt: null,
      homeownerConfirmedAt: null,
      hasRep: true,
      ...meeting,
    },
    messages: [],
    contact: { hasPhone: true, doNotContact: false },
    pausedKinds: [],
    now: new Date('2026-10-07T20:00:00.000Z'),
    ...over,
  }
}
function step(input: VisitMessagePlanInput, kind: VisitMessageSequenceKind) {
  const found = planVisitMessages(input).find(candidate => candidate.kind === kind)
  assert.ok(found, `the plan has a ${kind} step`)
  return found
}

{
  const now = new Date('2026-10-07T20:00:00.000Z')
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'not_set', scheduledFor: VISIT }, now), true)
  assert.equal(isVisitMessageEligible({ meetingType: 'Project', meetingOutcome: 'not_set', scheduledFor: VISIT }, now), false, 'a project meeting serves an existing project')
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'cancelled', scheduledFor: VISIT }, now), false)
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'reschedule_needed', scheduledFor: VISIT }, now), false, 'a homeowner who asked for a new time gets no more texts for this one')
  assert.equal(isVisitMessageEligible({ meetingType: 'Fresh', meetingOutcome: 'not_set', scheduledFor: VISIT }, new Date('2026-10-09T17:00:01.000Z')), false, 'past')
}
console.log('7. Eligibility ✓')

{
  const meeting = { scheduledFor: VISIT, confirmedAt: null, homeownerConfirmedAt: null, homeownerConfirmedVia: null }
  assert.deepEqual(deriveConfirmationTrack(meeting, []), {
    office: { done: false, nudge: 'summary_not_sent' },
    homeowner: { done: false, via: null },
    rep: { done: false },
  })
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('day_before_reminder')]).office, { done: true, nudge: 'summary_not_sent' }, 'a homeowner reached only by the reminder still sees Booked done')
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('visit_summary', { forScheduledFor: VISIT_AS_POSTGRES })]).office, { done: true, nudge: null }, 'the same instant in Postgres spelling')
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('visit_summary', { forScheduledFor: OLD_VISIT })]).office, { done: true, nudge: 'time_changed' }, 'a reschedule keeps the history and asks for a resend')
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('visit_summary', { status: 'failed' })]).office, { done: false, nudge: 'summary_not_sent' }, 'a failed send reached nobody')
  assert.deepEqual(deriveConfirmationTrack(meeting, [fact('homeowner_reply', { status: 'received' })]).office.done, false, 'a reply is not something the office sent')

  assert.deepEqual(deriveConfirmationTrack({ ...meeting, homeownerConfirmedAt: '2026-10-08T01:00:00.000Z', homeownerConfirmedVia: 'in_app' }, []).homeowner, { done: true, via: 'in_app' })
  assert.deepEqual(deriveConfirmationTrack({ ...meeting, confirmedAt: '2026-10-08T01:00:00.000Z' }, []).homeowner, { done: true, via: 'office' }, 'a phone confirmation the office recorded')

  assert.equal(deriveConfirmationTrack(meeting, [fact('rep_confirmation')]).rep.done, true)
  assert.equal(deriveConfirmationTrack(meeting, [fact('rep_confirmation', { forScheduledFor: OLD_VISIT })]).rep.done, false, 'a moved meeting needs the rep confirmation again')
}
console.log('8. Confirmation track ✓')

{
  const base = planInput()
  assert.deepEqual(planVisitMessages(base).map(candidate => candidate.kind), ['visit_summary', 'day_before_reminder', 'rep_confirmation'])
  assert.deepEqual(step(base, 'visit_summary'), { kind: 'visit_summary', plannedFor: null, state: 'not_sent', reason: 'never_sent', skipReason: null, late: false, variant: null, row: null })
  assert.deepEqual(step(base, 'day_before_reminder'), { kind: 'day_before_reminder', plannedFor: '2026-10-09T01:00:00.000Z', state: 'scheduled', reason: null, skipReason: null, late: false, variant: 'unconfirmed', row: null })
  assert.deepEqual(step(base, 'rep_confirmation'), { kind: 'rep_confirmation', plannedFor: '2026-10-09T15:30:00.000Z', state: 'scheduled', reason: null, skipReason: null, late: false, variant: null, row: null })

  // The noon rule: a summary after noon the day before makes the 6 PM reminder a repeat.
  const afterNoon = planInput({ messages: [fact('visit_summary', { createdAt: '2026-10-08T21:00:00.000Z' })] })
  assert.equal(step(afterNoon, 'visit_summary').state, 'sent')
  assert.equal(step(afterNoon, 'day_before_reminder').skipReason, 'booked_after_noon')
  assert.equal(step(afterNoon, 'rep_confirmation').skipReason, null, 'the morning text still goes')
  const beforeNoon = planInput({ messages: [fact('visit_summary', { createdAt: '2026-10-08T18:00:00.000Z' })] })
  assert.equal(step(beforeNoon, 'day_before_reminder').skipReason, null)
  const failedSummary = planInput({ messages: [fact('visit_summary', { status: 'failed', reason: 'twilio:30006', createdAt: '2026-10-08T21:00:00.000Z' })] })
  assert.equal(step(failedSummary, 'day_before_reminder').skipReason, null, 'a summary that never arrived does not replace the reminder')

  assert.equal(step(planInput({ pausedKinds: ['day_before_reminder'] }), 'day_before_reminder').skipReason, 'paused')
  assert.equal(step(planInput({ pausedKinds: ['day_before_reminder'] }), 'rep_confirmation').skipReason, null)
  assert.equal(step(planInput({ contact: { hasPhone: false, doNotContact: false } }), 'rep_confirmation').skipReason, 'no_phone')
  assert.equal(step(planInput({ contact: { hasPhone: true, doNotContact: true } }), 'rep_confirmation').skipReason, 'dnc')

  // Due: the planned time has come, the window is open, nothing is recorded.
  const atRun = planInput({ now: new Date('2026-10-09T01:00:00.000Z') })
  assert.equal(step(atRun, 'day_before_reminder').state, 'due')
  assert.equal(step(atRun, 'day_before_reminder').late, false)
  assert.equal(step(planInput({ now: new Date('2026-10-09T01:16:00.000Z') }), 'day_before_reminder').late, true, 'after 15 minutes the run is late')
  assert.equal(step(planInput({ now: new Date('2026-10-09T01:00:00.000Z'), pausedKinds: ['day_before_reminder'] }), 'day_before_reminder').state, 'due', 'a paused step is still due: the run records the skip')

  // Recorded rows win.
  const manualSkip = planInput({ messages: [fact('day_before_reminder', { status: 'skipped', reason: 'manual' })] })
  assert.equal(step(manualSkip, 'day_before_reminder').state, 'skipped')
  assert.equal(step(manualSkip, 'day_before_reminder').reason, 'manual')
  const sentThenDecided = planInput({ messages: [fact('visit_summary')] }, { meetingOutcome: 'cancelled' })
  assert.equal(step(sentThenDecided, 'visit_summary').state, 'sent', 'a recorded text stays visible after the meeting is decided')
  assert.equal(step(sentThenDecided, 'day_before_reminder').state, 'not_applicable')
  assert.equal(step(sentThenDecided, 'day_before_reminder').reason, 'outcome_decided')
  assert.equal(step(planInput({ messages: [fact('rep_confirmation', { forScheduledFor: VISIT_AS_POSTGRES })] }), 'rep_confirmation').state, 'sent', 'Postgres spelling of the visit time')

  const sending = planInput({ now: new Date('2026-10-09T01:05:00.000Z'), messages: [fact('day_before_reminder', { status: 'pending', createdAt: '2026-10-09T01:00:05.000Z' })] })
  assert.equal(step(sending, 'day_before_reminder').state, 'sending')
  const stale = planInput({ now: new Date('2026-10-09T01:20:00.000Z'), messages: [fact('day_before_reminder', { status: 'pending', createdAt: '2026-10-09T01:00:05.000Z' })] })
  assert.equal(step(stale, 'day_before_reminder').state, 'failed')
  assert.equal(step(stale, 'day_before_reminder').reason, 'send_interrupted', 'a claim older than 10 minutes never sent')

  // A moved time re-arms both automatic steps; the old texts stay in the chain.
  const moved = planInput({ messages: [fact('visit_summary', { forScheduledFor: OLD_VISIT }), fact('day_before_reminder', { forScheduledFor: OLD_VISIT }), fact('rep_confirmation', { forScheduledFor: OLD_VISIT, status: 'skipped', reason: 'manual' })] })
  assert.equal(step(moved, 'visit_summary').reason, 'time_changed')
  assert.equal(step(moved, 'day_before_reminder').state, 'scheduled')
  assert.equal(step(moved, 'rep_confirmation').state, 'scheduled', 'a skip covered the old time only')

  // Nothing recorded and nothing will send.
  const bookedAfterRun = planInput({ now: new Date('2026-10-09T02:30:00.000Z') }, { createdAt: '2026-10-09T02:00:00.000Z' })
  assert.equal(step(bookedAfterRun, 'day_before_reminder').state, 'not_sent')
  assert.equal(step(bookedAfterRun, 'day_before_reminder').reason, 'booked_after_run', 'booked at 7 PM the day before: the 6 PM run had gone')
  const sameDay = planInput({ now: new Date('2026-10-09T16:20:00.000Z') }, { createdAt: '2026-10-09T16:15:00.000Z' })
  assert.equal(step(sameDay, 'rep_confirmation').state, 'not_sent')
  assert.equal(step(sameDay, 'rep_confirmation').reason, 'booked_after_run', 'booked at 9:15 AM for 10 AM: no "good morning" text an hour late')
  const missed = planInput({ now: new Date('2026-10-09T07:30:00.000Z') })
  assert.equal(step(missed, 'day_before_reminder').state, 'not_sent')
  assert.equal(step(missed, 'day_before_reminder').reason, 'no_record', 'the window closed at midnight with nothing recorded')

  // Not applicable.
  assert.deepEqual(planVisitMessages(planInput({}, { meetingType: 'Project' })).map(candidate => [candidate.state, candidate.reason]), [['not_applicable', 'project_meeting'], ['not_applicable', 'project_meeting'], ['not_applicable', 'project_meeting']])
  assert.equal(step(planInput({}, { hasRep: false }), 'rep_confirmation').reason, 'no_rep')
  assert.equal(step(planInput({}, { hasRep: false }), 'day_before_reminder').state, 'scheduled', 'the reminder goes without a rep, as "your rep"')
  const early = planInput({}, { scheduledFor: '2026-10-09T15:00:00.000Z' })
  assert.equal(step(early, 'rep_confirmation').state, 'not_applicable')
  assert.equal(step(early, 'rep_confirmation').reason, 'before_9am', 'an 8 AM visit gets no 8:30 text')

  assert.equal(step(planInput({}, { homeownerConfirmedAt: '2026-10-08T01:00:00.000Z' }), 'day_before_reminder').variant, 'confirmed')
  assert.equal(step(planInput({}, { confirmedAt: '2026-10-08T01:00:00.000Z' }), 'day_before_reminder').variant, 'confirmed', 'the office recording a phone confirmation counts')
}
console.log('9. Visit message plan ✓')

{
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T00:59:58.000Z'))?.toISOString(), '2026-10-09T01:00:00.000Z', 'a delivery two seconds early is still tonight\'s run, evaluated at 6 PM')
  assert.equal(step(planInput({ now: new Date('2026-10-09T01:00:00.000Z') }), 'day_before_reminder').state, 'due')
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T01:03:00.000Z'))?.toISOString(), '2026-10-09T01:03:00.000Z', 'a late delivery runs at the time it arrived')
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T00:50:00.000Z')), null, 'ten minutes early is not this run')
  assert.equal(resolveRunInstant('day_before_reminder', new Date('2026-10-09T07:05:00.000Z')), null, 'a retry at 12:05 AM is not the next day\'s 6 PM run')
  assert.equal(resolveRunInstant('rep_confirmation', new Date('2026-10-09T15:30:00.000Z'))?.toISOString(), '2026-10-09T15:30:00.000Z')
  assert.equal(resolveRunInstant('rep_confirmation', new Date('2026-11-01T16:30:00.000Z'))?.toISOString(), '2026-11-01T16:30:00.000Z', '8:30 AM on the fall-back day')
}
console.log('10. Run time ✓')

{
  const invite = fact('visit_summary', { channel: 'email' })
  assert.equal(shouldSendVisitCancellation({ chainMessages: [invite], hasSuccessor: false }), true)
  assert.equal(shouldSendVisitCancellation({ chainMessages: [invite], hasSuccessor: true }), false, 'a reschedule\'s original has a successor: the next summary updates the same calendar entry')
  assert.equal(shouldSendVisitCancellation({ chainMessages: [fact('visit_summary')], hasSuccessor: false }), false, 'a text-only summary put nothing on a calendar')
  assert.equal(shouldSendVisitCancellation({ chainMessages: [fact('visit_summary', { channel: 'email', status: 'failed' })], hasSuccessor: false }), false)
  assert.equal(shouldSendVisitCancellation({ chainMessages: [fact('visit_summary', { channel: 'email', forScheduledFor: OLD_VISIT })], hasSuccessor: false }), true, 'an invite sent before a reschedule is still on their calendar')
}
console.log('11. Cancellation rule ✓')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL, `Cannot find module '@/shared/modules/meetings/messages/lib/derive-confirmation-track'`.

- [ ] **Step 3: Write `lib/is-visit-message-eligible.ts`**

```ts
import type { MeetingOutcome, MeetingType } from '@/shared/constants/enums/meetings'

import { isProjectMeeting } from '@/shared/constants/enums/meetings'

/** A decided outcome ends the texts: cancelled, no-show, and a homeowner's own request for a new time. */
export function isVisitMessageEligible(
  meeting: { meetingType: MeetingType, meetingOutcome: MeetingOutcome, scheduledFor: string },
  now: Date,
): boolean {
  return !isProjectMeeting(meeting)
    && meeting.meetingOutcome === 'not_set'
    && new Date(meeting.scheduledFor).getTime() > now.getTime()
}
```

- [ ] **Step 4: Write `lib/derive-confirmation-track.ts`**

```ts
import type { HomeownerConfirmation } from '@/shared/constants/enums/meetings'
import type { ConfirmationTrack, VisitMessageFact } from '@/shared/modules/meetings/messages/types'

function isFor(message: VisitMessageFact, scheduledFor: string): boolean {
  return new Date(message.forScheduledFor).getTime() === new Date(scheduledFor).getTime()
}

export function deriveConfirmationTrack(
  meeting: {
    scheduledFor: string
    confirmedAt: string | null
    homeownerConfirmedAt: string | null
    homeownerConfirmedVia: HomeownerConfirmation | null
  },
  chainMessages: readonly VisitMessageFact[],
): ConfirmationTrack {
  const sent = chainMessages.filter(message => message.status === 'sent')
  const summaries = sent.filter(message => message.kind === 'visit_summary')

  const nudge = summaries.length === 0
    ? 'summary_not_sent'
    : summaries.some(message => isFor(message, meeting.scheduledFor)) ? null : 'time_changed'

  const via = meeting.homeownerConfirmedAt
    ? (meeting.homeownerConfirmedVia ?? 'in_app')
    : meeting.confirmedAt ? 'office' : null

  return {
    office: { done: sent.length > 0, nudge },
    homeowner: { done: via != null, via },
    rep: { done: sent.some(message => message.kind === 'rep_confirmation' && isFor(message, meeting.scheduledFor)) },
  }
}
```

- [ ] **Step 5: Write `lib/plan-visit-messages.ts`**

```ts
import type {
  MeetingMessageStatus,
  PausableVisitMessageKind,
  VisitMessageSequenceKind,
  VisitMessageSkipReason,
} from '@/shared/modules/meetings/messages/constants/kinds'
import type { VisitMessageFact, VisitMessagePlanInput, VisitMessageStep } from '@/shared/modules/meetings/messages/types'

import { isProjectMeeting } from '@/shared/constants/enums/meetings'
import { addCalendarDays, businessDateTime, businessDayKey, businessHour } from '@/shared/lib/business-time'
import {
  VISIT_MESSAGE_LATE_AFTER_MS,
  VISIT_MESSAGE_PENDING_STALE_MS,
  VISIT_MESSAGE_SCHEDULE,
} from '@/shared/modules/meetings/messages/constants/schedule'

// A sent leg outranks a failed one: a summary whose text went and whose email bounced was sent.
const STATUS_RANK: Record<MeetingMessageStatus, number> = { sent: 0, pending: 1, failed: 2, skipped: 3, received: 4 }

function emptyStep(kind: VisitMessageSequenceKind, plannedFor: Date | null): VisitMessageStep {
  return {
    kind,
    plannedFor: plannedFor ? plannedFor.toISOString() : null,
    state: 'not_sent',
    reason: null,
    skipReason: null,
    late: false,
    variant: null,
    row: null,
  }
}

function recorded(kind: VisitMessageSequenceKind, rows: readonly VisitMessageFact[], now: Date): Pick<VisitMessageStep, 'state' | 'reason' | 'row'> | null {
  const [row] = rows
    .filter(candidate => candidate.kind === kind && candidate.status !== 'received')
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || Date.parse(b.createdAt) - Date.parse(a.createdAt))
  if (!row) {
    return null
  }
  if (row.status === 'pending') {
    const stale = now.getTime() - new Date(row.createdAt).getTime() > VISIT_MESSAGE_PENDING_STALE_MS
    return stale ? { state: 'failed', reason: 'send_interrupted', row } : { state: 'sending', reason: null, row }
  }
  return { state: row.status === 'sent' ? 'sent' : row.status === 'failed' ? 'failed' : 'skipped', reason: row.reason, row }
}

/**
 * Each sequence step's state for one meeting time. The scheduled runs act on exactly the steps this marks `due`,
 * and every screen shows this result, so what staff read is what will happen.
 */
export function planVisitMessages(input: VisitMessagePlanInput): VisitMessageStep[] {
  const { meeting, now } = input
  const visitAt = new Date(meeting.scheduledFor)
  const visitDay = businessDayKey(visitAt)
  const dayBefore = addCalendarDays(visitDay, -1)
  const reminder = VISIT_MESSAGE_SCHEDULE.day_before_reminder
  const rep = VISIT_MESSAGE_SCHEDULE.rep_confirmation

  const forThisTime = input.messages.filter(message => new Date(message.forScheduledFor).getTime() === visitAt.getTime())
  const notApplicable = isProjectMeeting(meeting) ? 'project_meeting' : meeting.meetingOutcome !== 'not_set' ? 'outcome_decided' : null

  const summaryCutoff = businessDateTime(dayBefore, reminder.summaryCutoffHour, 0)
  const summaryAfterCutoff = forThisTime.some(message =>
    message.kind === 'visit_summary'
    && message.status === 'sent'
    && new Date(message.createdAt).getTime() > summaryCutoff.getTime())

  function skipReasonFor(kind: PausableVisitMessageKind): VisitMessageSkipReason | null {
    if (input.pausedKinds.includes(kind)) {
      return 'paused'
    }
    if (!input.contact.hasPhone) {
      return 'no_phone'
    }
    if (input.contact.doNotContact) {
      return 'dnc'
    }
    return kind === 'day_before_reminder' && summaryAfterCutoff ? 'booked_after_noon' : null
  }

  function automatic(kind: PausableVisitMessageKind, plannedFor: Date, closes: Date, ownNotApplicable: string | null): VisitMessageStep {
    const step = emptyStep(kind, plannedFor)
    if (kind === 'day_before_reminder') {
      step.variant = meeting.homeownerConfirmedAt || meeting.confirmedAt ? 'confirmed' : 'unconfirmed'
    }

    const row = recorded(kind, forThisTime, now)
    if (row) {
      return { ...step, ...row }
    }
    if (notApplicable ?? ownNotApplicable) {
      return { ...step, state: 'not_applicable', reason: notApplicable ?? ownNotApplicable }
    }
    // The run for this step had already gone when the meeting was booked, so no run will ever pick it up.
    if (new Date(meeting.createdAt).getTime() > plannedFor.getTime()) {
      return { ...step, reason: 'booked_after_run' }
    }
    if (now.getTime() >= closes.getTime()) {
      return { ...step, reason: 'no_record' }
    }
    if (now.getTime() < plannedFor.getTime()) {
      return { ...step, state: 'scheduled', skipReason: skipReasonFor(kind) }
    }
    return {
      ...step,
      state: 'due',
      skipReason: skipReasonFor(kind),
      late: now.getTime() - plannedFor.getTime() > VISIT_MESSAGE_LATE_AFTER_MS,
    }
  }

  const summary = emptyStep('visit_summary', null)
  const summaryRow = recorded('visit_summary', forThisTime, now)
  const sentForAnotherTime = input.messages.some(message => message.kind === 'visit_summary' && message.status === 'sent')

  return [
    summaryRow
      ? { ...summary, ...summaryRow }
      : notApplicable
        ? { ...summary, state: 'not_applicable', reason: notApplicable }
        : { ...summary, reason: sentForAnotherTime ? 'time_changed' : 'never_sent' },
    automatic(
      'day_before_reminder',
      businessDateTime(dayBefore, reminder.hour, reminder.minute),
      businessDateTime(visitDay, 0, 0),
      null,
    ),
    automatic(
      'rep_confirmation',
      businessDateTime(visitDay, rep.hour, rep.minute),
      visitAt,
      !meeting.hasRep ? 'no_rep' : businessHour(visitAt) < rep.earliestVisitHour ? 'before_9am' : null,
    ),
  ]
}
```

- [ ] **Step 6: Write `lib/resolve-run-instant.ts`**

```ts
import type { PausableVisitMessageKind } from '@/shared/modules/meetings/messages/constants/kinds'

import { businessDateTime, businessDayKey } from '@/shared/lib/business-time'
import { VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS, VISIT_MESSAGE_SCHEDULE } from '@/shared/modules/meetings/messages/constants/schedule'

/**
 * The instant a run evaluates the plan at, or null when this delivery is not today's run.
 * A delivery a moment early still counts as the scheduled time, so a due step is not seen as scheduled and missed.
 * A retry that lands after midnight is hours before the new day's run and gets null, so it cannot send a day early.
 */
export function resolveRunInstant(kind: PausableVisitMessageKind, now: Date): Date | null {
  const { hour, minute } = VISIT_MESSAGE_SCHEDULE[kind]
  const scheduled = businessDateTime(businessDayKey(now), hour, minute)
  if (now.getTime() < scheduled.getTime() - VISIT_MESSAGE_RUN_EARLY_TOLERANCE_MS) {
    return null
  }
  return new Date(Math.max(now.getTime(), scheduled.getTime()))
}
```

- [ ] **Step 7: Write `lib/should-send-visit-cancellation.ts`**

```ts
import type { VisitMessageFact } from '@/shared/modules/meetings/messages/types'

/**
 * A cancellation email removes a calendar entry, so it needs an invite that arrived.
 * A reschedule's original has a successor, whose next summary updates that same entry.
 */
export function shouldSendVisitCancellation(input: { chainMessages: readonly VisitMessageFact[], hasSuccessor: boolean }): boolean {
  return !input.hasSuccessor
    && input.chainMessages.some(message => message.kind === 'visit_summary' && message.channel === 'email' && message.status === 'sent')
}
```

- [ ] **Step 8: Run the script, type-check, lint**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm lint --fix && pnpm tsc && pnpm lint`
Expected: sections 1–11 print `✓`, then `✅ verify-visit-messages passed`; `tsc` and `lint` clean.

- [ ] **Step 9: Commit**

```bash
git add scripts/verify-visit-messages.ts src/shared/modules/meetings/messages/lib/is-visit-message-eligible.ts src/shared/modules/meetings/messages/lib/derive-confirmation-track.ts src/shared/modules/meetings/messages/lib/plan-visit-messages.ts src/shared/modules/meetings/messages/lib/resolve-run-instant.ts src/shared/modules/meetings/messages/lib/should-send-visit-cancellation.ts
git commit -m "feat(visit-messages): the visit message plan, the confirmation track and the run-time and cancellation rules"
```

---

### Task 9: The data model

**Files:**
- Modify: `src/shared/db/schema/meetings.ts`
- Modify: `src/shared/db/schema/meta.ts:6-9,37-43`
- Modify: `src/shared/db/schema/voip-dids.ts:26-34`
- Create: `src/shared/db/schema/meeting-messages.ts`
- Create: `src/shared/db/schema/visit-message-templates.ts`
- Create: `src/shared/db/schema/visit-message-pauses.ts`
- Modify: `src/shared/db/schema/index.ts`

**Interfaces:**
- Consumes: Task 6 const arrays
- Produces: `meetings.shareToken`, `.homeownerConfirmedAt`, `.homeownerConfirmedVia`, `.newTimeRequestedAt`, `.rescheduledFromId` (all on the `Meeting` type); `meetingMessages` with `MeetingMessage` / `InsertMeetingMessage` / `insertMeetingMessageSchema` / `selectMeetingMessageSchema`; `visitMessageTemplates` with `VisitMessageTemplate`; `visitMessagePauses` with `VisitMessagePause`; `voipDids.isMainLine`

This task changes the schema files only. The owner applies it (Step 7). Until the push runs, the dev server fails on every meeting read, so this task and its gate happen back to back.

- [ ] **Step 1: Rewrite the `meetings` table**

In `src/shared/db/schema/meetings.ts`, replace the imports block's Drizzle and enum lines and the table definition. The top of the file becomes:

```ts
import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import type {
  MeetingContext,
  MeetingFlowState,
} from '@/shared/entities/meetings/schemas'

import { relations, sql } from 'drizzle-orm'
import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import z from 'zod'

import { homeownerConfirmationOptions, meetingOutcomes, meetingPipelines, meetingTypes } from '@/shared/constants/enums'
import {
  meetingContextSchema,
  meetingFlowStateSchema,
} from '@/shared/entities/meetings/schemas'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { customers } from './customers'
import { projects } from './projects'

export const meetings = pgTable('meetings', {
  id,
  ownerId: text('owner_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  // Who booked the meeting, often a dispatcher. Not ownerId: a dispatcher's booking goes to the system owner.
  setBy: text('set_by').references(() => user.id, { onDelete: 'set null' }),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  meetingType: text('meeting_type', { enum: meetingTypes }).notNull().default('Fresh'),
  meetingOutcome: text('meeting_outcome', { enum: meetingOutcomes }).notNull().default('not_set'),
  pipeline: text('pipeline', { enum: meetingPipelines }).notNull().default('fresh'),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }).notNull(),
  // Soft, day-of: the homeowner said they'll be home. Cleared whenever scheduledFor moves.
  confirmedAt: timestamp('confirmed_at', { mode: 'string', withTimezone: true }),
  // The homeowner's own "I'll be there" for this time. Never moves the pipeline; the office still sets confirmedAt.
  homeownerConfirmedAt: timestamp('homeowner_confirmed_at', { mode: 'string', withTimezone: true }),
  homeownerConfirmedVia: text('homeowner_confirmed_via', { enum: homeownerConfirmationOptions }),
  // When the homeowner asked for a new time. Kept after the time moves: it records what they did.
  newTimeRequestedAt: timestamp('new_time_requested_at', { mode: 'string', withTimezone: true }),
  // Belongs to the visit, not the row: a reschedule hands it to the replacement.
  // The database default exists only so adding the column fills existing rows; create.before supplies generateToken().
  shareToken: text('share_token').notNull().default(sql`replace(gen_random_uuid()::text, '-', '')`),
  rescheduledFromId: uuid('rescheduled_from_id').references((): AnyPgColumn => meetings.id, { onDelete: 'set null' }),
  contextJSON: jsonb('context_json').$type<MeetingContext>(),
  flowStateJSON: jsonb('flow_state_json').$type<MeetingFlowState>(),
  agentNotes: text('agent_notes'),
  // Google Calendar sync
  gcalEventId: text('gcal_event_id'),
  gcalEtag: text('gcal_etag'),
  gcalSyncedAt: timestamp('gcal_synced_at', { mode: 'string', withTimezone: true }),
  createdAt,
  updatedAt,
}, table => ({
  uniqShareToken: uniqueIndex('meetings_share_token_uniq').on(table.shareToken),
  rescheduledFromIdx: index('meetings_rescheduled_from_idx').on(table.rescheduledFromId),
}))
```

Leave `meetingsRelations`, `selectMeetingSchema`, `insertMeetingSchema` and their types as they are.

- [ ] **Step 2: Remove the three meeting pgEnums from `meta.ts`**

Delete these three lines (`:38`, `:40`, `:43`) and the `// PIPELINES` comment above the last one:

```ts
export const meetingOutcomeEnum = pgEnum('meeting_outcome', meetingOutcomes)
export const meetingTypeEnum = pgEnum('meeting_type', meetingTypes)
export const meetingPipelineEnum = pgEnum('meeting_pipeline', meetingPipelines)
```

Remove `meetingOutcomes`, `meetingPipelines` and `meetingTypes` from the import at `:2-17`. Keep `meetingParticipantRoleEnum` and its import.

Run: `grep -rn "meetingOutcomeEnum\|meetingTypeEnum\|meetingPipelineEnum" src scripts`
Expected: no output.

- [ ] **Step 3: Add the main-line flag to `voip_dids`**

In `src/shared/db/schema/voip-dids.ts`, add the column after `isPrimary` and the index beside the existing one:

```ts
  // The one company number that sends visit messages and receives their replies.
  isMainLine: boolean('is_main_line').notNull().default(false),
```

```ts
}, table => ({
  uniqPrimaryPerUser: uniqueIndex('voip_dids_assigned_user_primary_uniq')
    .on(table.assignedUserId)
    .where(sql`${table.isPrimary} = TRUE`),
  uniqMainLine: uniqueIndex('voip_dids_main_line_uniq')
    .on(table.isMainLine)
    .where(sql`${table.isMainLine} = TRUE`),
}))
```

- [ ] **Step 4: Create the three new tables**

`src/shared/db/schema/meeting-messages.ts`:

```ts
import type z from 'zod'
import { relations, sql } from 'drizzle-orm'
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createInsertSchema, createSelectSchema } from 'drizzle-zod'
import { meetingMessageChannels, meetingMessageKinds, meetingMessageStatuses } from '@/shared/modules/meetings/messages/constants/kinds'
import { createdAt, id, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'
import { meetings } from './meetings'
import { voipMessages } from './voip-messages'

export const meetingMessages = pgTable('meeting_messages', {
  id,
  meetingId: uuid('meeting_id').notNull().references(() => meetings.id, { onDelete: 'cascade' }),
  kind: text('kind', { enum: meetingMessageKinds }).notNull(),
  channel: text('channel', { enum: meetingMessageChannels }).notNull(),
  // The meeting time this message described. A moved meeting re-arms its automatic texts because lookups key on it.
  forScheduledFor: timestamp('for_scheduled_for', { mode: 'string', withTimezone: true }).notNull(),
  status: text('status', { enum: meetingMessageStatuses }).notNull(),
  // Why a row is failed or skipped: twilio:<code>, send_error, dnc, no_phone, no_email, booked_after_noon, paused, manual.
  reason: text('reason'),
  voipMessageId: uuid('voip_message_id').references(() => voipMessages.id, { onDelete: 'set null' }),
  emailProviderId: text('email_provider_id'),
  // Who sent a summary or skipped a step. Null means automatic.
  actorUserId: text('actor_user_id').references(() => user.id, { onDelete: 'set null' }),
  note: text('note'),
  createdAt,
  updatedAt,
}, table => ({
  meetingIdx: index('meeting_messages_meeting_idx').on(table.meetingId),
  // QStash delivers at least once, so this index is the only thing that stops a double send.
  // A manual skip is a row under it too, which is how a skip stops the run.
  uniqAutomatic: uniqueIndex('meeting_messages_automatic_uniq')
    .on(table.meetingId, table.kind, table.channel, table.forScheduledFor)
    .where(sql`${table.kind} IN ('day_before_reminder', 'rep_confirmation', 'visit_cancellation')`),
}))

export const meetingMessagesRelations = relations(meetingMessages, ({ one }) => ({
  meeting: one(meetings, {
    fields: [meetingMessages.meetingId],
    references: [meetings.id],
  }),
}))

export const selectMeetingMessageSchema = createSelectSchema(meetingMessages)
export type MeetingMessage = z.infer<typeof selectMeetingMessageSchema>

export const insertMeetingMessageSchema = createInsertSchema(meetingMessages).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
})
export type InsertMeetingMessage = z.infer<typeof insertMeetingMessageSchema>
```

`src/shared/db/schema/visit-message-templates.ts`:

```ts
import type z from 'zod'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { visitMessageTemplateKeys } from '@/shared/modules/meetings/messages/constants/kinds'
import { createdAt, updatedAt } from '../lib/schema-helpers'
import { user } from './auth'

// A row exists only for wording a super-admin edited. The defaults live in code, and resetting deletes the row.
export const visitMessageTemplates = pgTable('visit_message_templates', {
  key: text('key', { enum: visitMessageTemplateKeys }).primaryKey(),
  body: text('body').notNull(),
  updatedByUserId: text('updated_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
  updatedAt,
})

export const selectVisitMessageTemplateSchema = createSelectSchema(visitMessageTemplates)
export type VisitMessageTemplate = z.infer<typeof selectVisitMessageTemplateSchema>
```

`src/shared/db/schema/visit-message-pauses.ts`:

```ts
import type z from 'zod'
import { pgTable, text } from 'drizzle-orm/pg-core'
import { createSelectSchema } from 'drizzle-zod'
import { pausableVisitMessageKinds } from '@/shared/modules/meetings/messages/constants/kinds'
import { createdAt } from '../lib/schema-helpers'
import { user } from './auth'

// A row means that automatic kind is paused for every meeting. Resuming deletes it.
export const visitMessagePauses = pgTable('visit_message_pauses', {
  kind: text('kind', { enum: pausableVisitMessageKinds }).primaryKey(),
  pausedByUserId: text('paused_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  createdAt,
})

export const selectVisitMessagePauseSchema = createSelectSchema(visitMessagePauses)
export type VisitMessagePause = z.infer<typeof selectVisitMessagePauseSchema>
```

In `src/shared/db/schema/index.ts`, add after the `'./app-settings'` line:

```ts

// visit messages
export * from './meeting-messages'
export * from './visit-message-templates'
export * from './visit-message-pauses'
```

- [ ] **Step 5: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: both clean. `Meeting` gained five fields, all nullable or defaulted, so no caller has to change. If `tsc` reports a place that builds a whole `Meeting` object by hand, add the five fields there with `null` (and any string for `shareToken`) and say so in the commit body.

- [ ] **Step 6: Commit**

```bash
git add src/shared/db/schema/meetings.ts src/shared/db/schema/meta.ts src/shared/db/schema/voip-dids.ts src/shared/db/schema/meeting-messages.ts src/shared/db/schema/visit-message-templates.ts src/shared/db/schema/visit-message-pauses.ts src/shared/db/schema/index.ts
git commit -m "feat(schema): visit messages, their templates and pauses; the meeting's share token, homeowner confirmation and reschedule link; a main-line DID; meeting enums as text"
```

- [ ] **Step 7: OWNER GATE. Stop here.**

Report to the owner and wait. Do not start Task 10's runtime checks until the owner confirms the push.

The owner runs `pnpm db:push:dev` and reads the statements before accepting. Expected, and nothing else:
- `meetings`: `meeting_type`, `meeting_outcome`, `pipeline` change to `text` (defaults kept); five columns added (`share_token` `NOT NULL` with a default, so existing rows fill); a unique index on `share_token`; an index on `rescheduled_from_id`; a self-referencing foreign key.
- Types `meeting_type`, `meeting_outcome`, `meeting_pipeline` dropped.
- Tables `meeting_messages`, `visit_message_templates`, `visit_message_pauses` created.
- `voip_dids`: `is_main_line` added with a partial unique index.
- Nothing on `set_by`. A statement that drops or alters it means Step 1 lost the setter column: abort and fix Step 1.

If drizzle-kit offers to **truncate** any table, or to drop or rename a column not listed above, the owner answers no and aborts. Production (`pnpm db:push:prod`) is the owner's call, and must run before any code from Task 9 onward is deployed: every staff meeting read selects all columns.

---

### Task 10: Rules true of every meeting row

**Files:**
- Create: `src/shared/modules/meetings/core/lib/confirmation-reset.ts`
- Modify: `src/shared/entities/meetings/dal/server/crud.ts:43-51,95-102,167-179` (at `a044525a`; the setter work still moves these lines, so each step names its anchor)
- Modify: `src/shared/entities/meetings/dal/server/queries.ts:252-260`
- Modify: `src/shared/entities/meetings/dal/server/google-calendar.ts:122-133`
- Modify: `src/shared/entities/meetings/lib/server-spec.ts`
- Modify: `src/trpc/routers/meetings.router/crud.router.ts`
- Modify: `scripts/verify-visit-messages.ts`

**Interfaces:**
- Consumes: Task 9 columns
- Produces: `confirmationsClearedByMove(current, patch)` returning the fields to null
- Produces: `getMeetingSchedule(id)` now also returns `homeownerConfirmedAt`
- Produces: `meetingClientSchemas` (the wire schemas, without the five server-owned columns)
- Behavior: every created meeting gets a fresh `shareToken`; a moved time clears both confirmations; Duplicate copies none of the five new columns; a client cannot write them.

Before Step 1, run `git diff -- src/shared/entities/meetings/dal/server/crud.ts src/trpc/routers/meetings.router/business.router.ts`. The records setter work edits both files: it landed in `b14be068` and `6069a226` (2026-10-05/06), and on 2026-10-07 a further change was live and uncommitted in another session (`SET_BY_REQUIRED`: a null setter is refused, an unpicked one defaults to the session user or the office account; a duplicate and a reschedule pass `source.setBy ?? undefined`). If the diff shows anything you did not write, stop and tell the owner: staging the file by path would commit that work with yours. The steps below name their anchors because the setter work keeps moving the lines.

- [ ] **Step 1: Write the failing test**

Add to the imports:

```ts
import { confirmationsClearedByMove } from '@/shared/modules/meetings/core/lib/confirmation-reset'
```

Add above the final line:

```ts
{
  const confirmed = { scheduledFor: VISIT_AS_POSTGRES, confirmedAt: '2026-10-08T01:00:00.000Z', homeownerConfirmedAt: '2026-10-08T02:00:00.000Z' }
  assert.deepEqual(confirmationsClearedByMove(confirmed, { scheduledFor: OLD_VISIT }), { confirmedAt: null, homeownerConfirmedAt: null, homeownerConfirmedVia: null }, 'a moved time clears both confirmations')
  assert.deepEqual(confirmationsClearedByMove(confirmed, { scheduledFor: VISIT }), {}, 'a same-time re-save in another spelling keeps them')
  assert.deepEqual(confirmationsClearedByMove(confirmed, {}), {}, 'a patch that does not touch the time clears nothing')
  assert.deepEqual(confirmationsClearedByMove({ ...confirmed, confirmedAt: null }, { scheduledFor: OLD_VISIT }), { homeownerConfirmedAt: null, homeownerConfirmedVia: null }, 'only what was set')
  assert.deepEqual(confirmationsClearedByMove({ ...confirmed, homeownerConfirmedAt: null }, { scheduledFor: OLD_VISIT }), { confirmedAt: null })
  assert.deepEqual(confirmationsClearedByMove(confirmed, { scheduledFor: OLD_VISIT, confirmedAt: '2026-10-08T03:00:00.000Z' }), { homeownerConfirmedAt: null, homeownerConfirmedVia: null }, 'a patch that moves the time and confirms it keeps its own confirmation')
}
console.log('12. Confirmations hold for one time ✓')
```

- [ ] **Step 2: Run it to see it fail**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: FAIL, `Cannot find module '@/shared/modules/meetings/core/lib/confirmation-reset'`.

- [ ] **Step 3: Write `lib/confirmation-reset.ts`**

```ts
import type { Meeting } from '@/shared/db/schema'

type CurrentConfirmations = Pick<Meeting, 'scheduledFor' | 'confirmedAt' | 'homeownerConfirmedAt'>
type ConfirmationPatch = Partial<Pick<Meeting, 'scheduledFor' | 'confirmedAt' | 'homeownerConfirmedAt' | 'homeownerConfirmedVia'>>

/**
 * A confirmation holds for one appointment time, the office's and the homeowner's alike.
 * Times compare as instants, so a same-time re-save (a calendar sync) keeps both.
 */
export function confirmationsClearedByMove(current: CurrentConfirmations, patch: ConfirmationPatch): ConfirmationPatch {
  if (!patch.scheduledFor || new Date(current.scheduledFor).getTime() === new Date(patch.scheduledFor).getTime()) {
    return {}
  }
  return {
    ...(current.confirmedAt && !('confirmedAt' in patch) ? { confirmedAt: null } : {}),
    ...(current.homeownerConfirmedAt && !('homeownerConfirmedAt' in patch)
      ? { homeownerConfirmedAt: null, homeownerConfirmedVia: null }
      : {}),
  }
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `pnpm tsx scripts/verify-visit-messages.ts`
Expected: section 12 prints `✓`.

- [ ] **Step 5: Use the rule in the update hook, and give every new meeting a token**

In `src/shared/entities/meetings/dal/server/queries.ts`, widen `getMeetingSchedule` (`:252-260`):

```ts
/** Unscoped — only for entity hooks that already run behind a scope-checked write. */
export async function getMeetingSchedule(id: string): Promise<Pick<Meeting, 'scheduledFor' | 'confirmedAt' | 'homeownerConfirmedAt'> | undefined> {
  const [row] = await db
    .select({
      scheduledFor: meetings.scheduledFor,
      confirmedAt: meetings.confirmedAt,
      homeownerConfirmedAt: meetings.homeownerConfirmedAt,
    })
    .from(meetings)
    .where(eq(meetings.id, id))
    .limit(1)
  return row
}
```

In `src/shared/entities/meetings/dal/server/crud.ts`, add two imports:

```ts
import { confirmationsClearedByMove } from '@/shared/modules/meetings/core/lib/confirmation-reset'
import { generateToken } from '@/shared/lib/generate-token'
```

In `create.before` (`:43-51`), the setter lines at the top of the hook stay exactly as they are. Replace its two returns

```ts
        if (!ctx.session) {
          return { ...input, setBy }
        }
        return { ...input, setBy, ownerId: await resolveMeetingOwnerId(ctx) }
```

with

```ts
        // The token is generated above the session check: intake and reschedule create with no session.
        const withToken = { ...input, setBy, shareToken: generateToken() }
        if (!ctx.session) {
          return withToken
        }
        return { ...withToken, ownerId: await resolveMeetingOwnerId(ctx) }
```

Replace the confirmation block inside `update.before` (`:95-102`: the two comment lines and the `if (data.scheduledFor && !('confirmedAt' in data))` block; `confirmationsClearedByMove` carries that guard) with:

```ts
        if (data.scheduledFor) {
          const current = await getMeetingSchedule(id)
          if (current) {
            next = { ...next, ...confirmationsClearedByMove(current, data) }
          }
        }
```

Replace the `exclude` array of `duplicate` (`:167-179`; the comment above `duplicate` and the `overrides` block that carries the setter stay):

```ts
    exclude: [
      'createdAt',
      'updatedAt',
      'meetingOutcome',
      'confirmedAt',
      'homeownerConfirmedAt',
      'homeownerConfirmedVia',
      'newTimeRequestedAt',
      'shareToken',
      'rescheduledFromId',
      'pipeline',
      'flowStateJSON',
      'agentNotes',
      'projectId',
      'gcalEventId',
      'gcalEtag',
      'gcalSyncedAt',
    ],
```

- [ ] **Step 6: Mirror the rule in the calendar sync's raw update**

In `src/shared/entities/meetings/dal/server/google-calendar.ts`, `updateMeetingScheduledFor` (`:122-133`) bypasses the hooks. Its `.set({...})` becomes:

```ts
    .set({
      scheduledFor,
      // Mirrors meetingCrud's update hook: a moved meeting must be confirmed again; a same-time re-sync keeps it.
      confirmedAt: sql`CASE WHEN ${meetings.scheduledFor} = ${scheduledFor}::timestamptz THEN ${meetings.confirmedAt} ELSE NULL END`,
      homeownerConfirmedAt: sql`CASE WHEN ${meetings.scheduledFor} = ${scheduledFor}::timestamptz THEN ${meetings.homeownerConfirmedAt} ELSE NULL END`,
      homeownerConfirmedVia: sql`CASE WHEN ${meetings.scheduledFor} = ${scheduledFor}::timestamptz THEN ${meetings.homeownerConfirmedVia} ELSE NULL END`,
    })
```

- [ ] **Step 7: Keep the server-owned columns off the wire**

In `src/shared/entities/meetings/lib/server-spec.ts`, add below `meetingSchemas`:

```ts
const SERVER_OWNED_COLUMNS = {
  shareToken: true,
  homeownerConfirmedAt: true,
  homeownerConfirmedVia: true,
  newTimeRequestedAt: true,
  rescheduledFromId: true,
} as const

/**
 * The crud router's schemas. Only server code writes these columns, and Zod strips an unknown key,
 * so a client that sends one writes nothing. The DAL keeps the full schemas: it parses after the hooks run.
 */
export const meetingClientSchemas = {
  insert: insertMeetingSchema.omit(SERVER_OWNED_COLUMNS),
  update: updateMeetingSchema.omit(SERVER_OWNED_COLUMNS),
}
```

In `src/trpc/routers/meetings.router/crud.router.ts`, import `meetingClientSchemas` instead of `meetingSchemas` and use it:

```ts
import { meetingClientSchemas, meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
```

```ts
  schemas: { ...meetingClientSchemas, id: z.string().uuid() },
```

Run: `grep -rn "meetingSchemas" src`
Expected: only its definition in `server-spec.ts`. Delete that export (and its doc comment) if nothing else imports it.

- [ ] **Step 8: Run the script, type-check, lint**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: all sections `✓`; `tsc` and `lint` clean. If `tsc` rejects `crud: meetingCrud` against the narrower router schemas, stop and report the error text. Do not cast and do not widen the router schemas back.

- [ ] **Step 9: Commit**

```bash
git add scripts/verify-visit-messages.ts src/shared/modules/meetings/core/lib/confirmation-reset.ts src/shared/entities/meetings/dal/server/crud.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/entities/meetings/dal/server/google-calendar.ts src/shared/entities/meetings/lib/server-spec.ts src/trpc/routers/meetings.router/crud.router.ts
git commit -m "feat(meetings): every meeting gets a share token; a moved time clears both confirmations; clients cannot write the server-owned columns"
```

---

### Task 11: The meetings module and its verbs

**Files:**
- Create: `src/shared/modules/meetings/service.ts`
- Create: `src/shared/modules/meetings/business/service.ts`
- Modify: `src/shared/entities/meetings/dal/server/queries.ts` (add `getRescheduleChain`)
- Modify: `src/shared/entities/meetings/dal/server/mutations.ts` (add `handOffShareToken`)
- Modify: `src/trpc/routers/meetings.router/business.router.ts` (whole file)
- Modify: `src/shared/entities/meetings/DOCS.md:162-172`
- Modify: `docs/codebase-conventions/service-architecture.md:68,75`
- Modify: `docs/superpowers/specs/2026-09-29-customers-module-design.md:289`

**Interfaces:**
- Consumes: Task 9 columns, Task 10 hooks
- Produces: `meetingService` (the five CRUD slots, `queries.getRescheduleChain`, `get business()`)
- Produces: `meetingService.business.reschedule(ctx: ScopedContext, input: { meetingId: string, newScheduledFor: string, reason: string }): Promise<DalReturn<Meeting>>`
- Produces: `meetingService.business.setOutcomeWithReason(ctx: ScopedContext, input: { meetingId: string, outcome: MeetingOutcome, reason: string }): Promise<DalReturn<Meeting>>`
- Produces: `getRescheduleChain(ctx: ScopedContext, input: { meetingId: string }): Promise<DalReturn<string[]>>`, ids oldest first, ending with `meetingId`; empty when the meeting is not visible to `ctx`
- Produces: `handOffShareToken(input: { fromMeetingId: string, toMeetingId: string }): Promise<DalReturn<void>>`

The router keeps its procedure names and inputs, so no client changes. A business guard that used to throw `BAD_REQUEST` now arrives as `PRECONDITION_FAILED` with the same message; no client reads the code (`grep -n "BAD_REQUEST" src/shared/entities/meetings/hooks/` is empty).

The reschedule is **not** one transaction: `meetingCrud`'s after-hooks dispatch jobs and write participants outside a threaded transaction (the comment at `crud.ts:36-38`). It keeps today's order (create, copy participants, cancel) and adds the token handoff as the last write before the note, so an earlier failure leaves the original's token where it was.

- [ ] **Step 1: Add the chain read**

In `src/shared/entities/meetings/dal/server/queries.ts`, make sure `and`, `eq` and `sql` are imported from `drizzle-orm` and `DalReturn`, `ScopedContext` from `@/shared/dal/server/types`, then append:

```ts
/**
 * A meeting and the meetings it replaced, oldest first. `ctx.scope` gates the meeting asked for;
 * the ones it replaced come with it, because they are the same visit.
 */
export async function getRescheduleChain(
  ctx: ScopedContext,
  input: { meetingId: string },
): Promise<DalReturn<string[]>> {
  return dalDbOperation(async () => {
    const rows = (await db.execute(sql`
      WITH RECURSIVE chain AS (
        SELECT ${meetings.id} AS id, ${meetings.rescheduledFromId} AS rescheduled_from_id, 0 AS depth
        FROM ${meetings}
        WHERE ${and(eq(meetings.id, input.meetingId), ctx.scope ?? undefined)}
        UNION ALL
        SELECT prior.id, prior.rescheduled_from_id, chain.depth + 1
        FROM meetings prior
        JOIN chain ON prior.id = chain.rescheduled_from_id
        WHERE chain.depth < 50
      )
      SELECT id FROM chain ORDER BY depth DESC
    `)).rows as { id: string }[]
    return rows.map(row => row.id)
  })
}
```

(`dalDbOperation` is already imported in this file; if not, import it from `@/shared/dal/server/lib/helpers`.)

- [ ] **Step 2: Add the token handoff**

In `src/shared/entities/meetings/dal/server/mutations.ts`, add `ThrowableDalError` to the imports from `@/shared/dal/server/types`, add `import { generateToken } from '@/shared/lib/generate-token'`, and append:

```ts
/**
 * The token belongs to the visit: after a reschedule the link a homeowner already holds opens the replacement.
 * One transaction and raw updates, so no meeting hook fires and the unique index never sees two rows with one token.
 */
export async function handOffShareToken(input: { fromMeetingId: string, toMeetingId: string }): Promise<DalReturn<void>> {
  return dalDbOperation(async () => {
    await db.transaction(async (tx) => {
      const [from] = await tx
        .select({ shareToken: meetings.shareToken })
        .from(meetings)
        .where(eq(meetings.id, input.fromMeetingId))
        .for('update')
      if (!from) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      await tx.update(meetings).set({ shareToken: generateToken() }).where(eq(meetings.id, input.fromMeetingId))
      await tx.update(meetings).set({ shareToken: from.shareToken }).where(eq(meetings.id, input.toMeetingId))
    })
  })
}
```

- [ ] **Step 3: Write the business child**

Create `src/shared/modules/meetings/business/service.ts`:

```ts
import type { MeetingOutcome } from '@/shared/constants/enums/meetings'
import type { DalReturn, ScopedContext } from '@/shared/dal/server/types'
import type { Meeting } from '@/shared/db/schema'

import { canRescheduleFromOutcome, outcomeRequiresReason } from '@/shared/constants/enums/meetings'
import { dalDbOperation, dalVerifySuccess } from '@/shared/dal/server/lib/helpers'
import { SYSTEM_CONTEXT, ThrowableDalError } from '@/shared/dal/server/types'
import { customerNoteCrud } from '@/shared/entities/customer-notes/dal/server/crud'
import { MEETING_OUTCOME_LABELS } from '@/shared/entities/meetings/constants/status-colors'
import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { handOffShareToken } from '@/shared/entities/meetings/dal/server/mutations'
import { addParticipant, getParticipantsForMeeting } from '@/shared/entities/meetings/dal/server/participants'
import { buildRescheduleNote, formatMeetingDateShort } from '@/shared/entities/meetings/lib/notes'

export const meetingBusinessService = {
  /**
   * Sets an outcome that needs a documented reason and writes the reason as a customer note.
   * Positive, unset and neutral outcomes go through the plain update instead.
   */
  async setOutcomeWithReason(
    ctx: ScopedContext,
    input: { meetingId: string, outcome: MeetingOutcome, reason: string },
  ): Promise<DalReturn<Meeting>> {
    return dalDbOperation(async () => {
      if (!outcomeRequiresReason(input.outcome)) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `Outcome "${input.outcome}" does not require a reason; use crud.update.`,
        })
      }

      const updated = dalVerifySuccess(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { meetingOutcome: input.outcome },
      }))

      if (updated.customerId) {
        dalVerifySuccess(await customerNoteCrud.create(ctx, {
          customerId: updated.customerId,
          content: `${formatMeetingDateShort(updated.scheduledFor)} meeting results:\nOutcome set to ${MEETING_OUTCOME_LABELS[input.outcome]}\n${input.reason}`,
        }))
      }

      return updated
    })
  },

  /**
   * Keeps the original (set to cancelled) and books a new meeting at the new time, carrying the owner,
   * participants, customer, project, type, setter and flow state: the same sit in a new slot.
   * Not one transaction: meetingCrud's after-hooks dispatch jobs and write participants outside one.
   * The replacement is created first, so a failure never leaves a cancelled meeting with nothing after it.
   */
  async reschedule(
    ctx: ScopedContext,
    input: { meetingId: string, newScheduledFor: string, reason: string },
  ): Promise<DalReturn<Meeting>> {
    return dalDbOperation(async () => {
      if (new Date(input.newScheduledFor).getTime() <= Date.now()) {
        throw new ThrowableDalError({ type: 'precondition-failed', reason: 'The new meeting time must be in the future.' })
      }

      const original = dalVerifySuccess(await meetingCrud.getById(ctx, { id: input.meetingId }))
      if (!original) {
        throw new ThrowableDalError({ type: 'not-found' })
      }
      if (!canRescheduleFromOutcome(original.meetingOutcome)) {
        throw new ThrowableDalError({
          type: 'precondition-failed',
          reason: `A meeting with outcome "${original.meetingOutcome}" already happened and can't be rescheduled — book a new meeting instead.`,
        })
      }

      // Visibility follows participants, so the replacement's owner is the original's owner participant.
      const participants = await getParticipantsForMeeting(input.meetingId)
      const ownerParticipant = participants.find(participant => participant.role === 'owner')

      // SYSTEM_CONTEXT so create.before keeps this ownerId; an authed create would hand the meeting to the office user.
      const replacement = dalVerifySuccess(await meetingCrud.create(SYSTEM_CONTEXT, {
        ownerId: ownerParticipant?.userId ?? original.ownerId,
        customerId: original.customerId,
        projectId: original.projectId,
        meetingType: original.meetingType,
        // A pre-setter original has none: undefined lets the hook default it, where a null would be refused.
        setBy: original.setBy ?? undefined,
        scheduledFor: input.newScheduledFor,
        rescheduledFromId: original.id,
        // The insert schema takes undefined, not null.
        flowStateJSON: original.flowStateJSON ?? undefined,
      }))

      for (const participant of participants) {
        if (participant.role !== 'owner') {
          await addParticipant(replacement.id, participant.userId, participant.role)
        }
      }

      dalVerifySuccess(await meetingCrud.update(ctx, {
        id: input.meetingId,
        data: { meetingOutcome: 'cancelled' },
      }))

      dalVerifySuccess(await handOffShareToken({ fromMeetingId: original.id, toMeetingId: replacement.id }))

      if (original.customerId) {
        dalVerifySuccess(await customerNoteCrud.create(ctx, {
          customerId: original.customerId,
          content: buildRescheduleNote(original.scheduledFor, input.newScheduledFor, input.reason),
        }))
      }

      return { ...replacement, shareToken: original.shareToken }
    })
  },
} as const
```

The `setBy` line mirrors the router's reschedule as the setter work left it (`setBy: original.setBy` at `a044525a`, `?? undefined` in the 2026-10-07 change). Carry whichever the router passes when you get here.

- [ ] **Step 4: Write the root service**

Create `src/shared/modules/meetings/service.ts`:

```ts
// @migration(modules-consolidation): the meetings core (crud, schemas, components, hooks) still lives in
// src/shared/entities/meetings. It moves to ./core when entities/ folds into modules/; this file and its
// children stay where they are, and only the import paths below change.

import type { SpecCrudHandlers } from '@/shared/dal/server/types'
import type { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'

import { meetingCrud } from '@/shared/entities/meetings/dal/server/crud'
import { getRescheduleChain } from '@/shared/entities/meetings/dal/server/queries'

import { meetingBusinessService } from './business/service'

export const meetingService = {
  ...meetingCrud,

  queries: {
    getRescheduleChain,
  },

  // A getter, not a property: a child that reaches a peer service would otherwise be read while this literal is still being built.
  get business() {
    return meetingBusinessService
  },
} satisfies SpecCrudHandlers<typeof meetingServerSpec>

export type MeetingService = typeof meetingService
```

- [ ] **Step 5: Make the router a thin adapter**

Replace the whole of `src/trpc/routers/meetings.router/business.router.ts`:

```ts
import z from 'zod'

import { meetingOutcomes } from '@/shared/constants/enums/meetings'
import { meetingService } from '@/shared/modules/meetings/service'
import { dalToTrpc } from '@/trpc/lib/dal-to-trpc'

import { createTRPCRouter } from '../../init'
import { meetingProcedure } from './procedures'

export const businessRouter = createTRPCRouter({
  setOutcomeWithReason: meetingProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      outcome: z.enum(meetingOutcomes),
      reason: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => dalToTrpc(await meetingService.business.setOutcomeWithReason(ctx, input))),

  rescheduleMeeting: meetingProcedure
    .input(z.object({
      meetingId: z.string().uuid(),
      newScheduledFor: z.string().datetime(),
      reason: z.string().trim().min(1).max(2000),
    }))
    .mutation(async ({ input, ctx }) => dalToTrpc(await meetingService.business.reschedule(ctx, input))),
})
```

- [ ] **Step 6: Bring the docs that describe this in line**

`src/shared/entities/meetings/DOCS.md`, section `### reschedule-cancels-and-rebooks` (`:162-172`):
- In the first sentence replace `(`meetingsRouter.business.rescheduleMeeting`)` with `(`meetingService.business.reschedule`, reached through `meetingsRouter.business.rescheduleMeeting`)`.
- After the paragraph that ends "…can never have its disposition clobbered." add:

```md
The replacement records the meeting it replaced in `rescheduledFromId`, and takes the original's `shareToken` (the original gets a fresh one), so a link the homeowner already holds opens the replacement. `getRescheduleChain` reads a meeting with the meetings it replaced.
```

- Replace the `**Reference impl**` line with `**Reference impl**: `src/shared/modules/meetings/business/service.ts``.

In the same file, section `### duplicate-copies-setup-only`: add `shareToken`, `homeownerConfirmedAt`, `homeownerConfirmedVia`, `newTimeRequestedAt` and `rescheduledFromId` to the list of columns a duplicate does not copy, in that section's own wording.

`docs/codebase-conventions/service-architecture.md`:
- `:68`: the bullet's example `— e.g. `meetings.business.setOutcomeWithReason` / `rescheduleMeeting`` is no longer true. Remove that example clause, leaving the sentence ending at "orchestrate in the **tRPC router** instead."
- `:75`: replace `(meetings today)` with `(for example activities)`.

`docs/superpowers/specs/2026-09-29-customers-module-design.md:289` (the meetings row of §7's table): replace `reschedule and set-outcome (`meetings.router/business.router.ts:31,86`);` with `reschedule and set-outcome already live in `meetingService.business` (`modules/meetings/`, started ahead of this move for visit messages, with a `messages` unit); what remains is moving the core from `entities/meetings` to `modules/meetings/core`;`.

- [ ] **Step 7: Type-check and lint**

Run: `pnpm tsc && pnpm lint`
Expected: both clean. `rescheduledFromId` is accepted by `meetingCrud.create` because the DAL keeps the full insert schema (Task 10 narrowed only the router's).

- [ ] **Step 8: Commit**

```bash
git add src/shared/modules/meetings/service.ts src/shared/modules/meetings/business/service.ts src/shared/entities/meetings/dal/server/queries.ts src/shared/entities/meetings/dal/server/mutations.ts src/trpc/routers/meetings.router/business.router.ts src/shared/entities/meetings/DOCS.md docs/codebase-conventions/service-architecture.md docs/superpowers/specs/2026-09-29-customers-module-design.md
git commit -m "refactor(meetings): meetingService with a business child; reschedule and set-outcome move out of the router, and a reschedule links the chain and hands the share token on"
```

- [ ] **Step 9: Owner check (needs the Task 9 push; writes dev data, so the owner does it)**

In the dev app, on a meeting the owner prepared:
1. Set an outcome that needs a reason (for example No show). Expected: the outcome saves and the customer gets the note, as before.
2. Reschedule a not-set meeting. Expected: a new meeting at the new time with the same rep, setter, participants and trade selections; the original is cancelled; one customer note.
3. In the database: the new row's `rescheduled_from_id` is the original's id, the new row's `share_token` is the token the original had, and the original has a different one.
4. Duplicate a meeting. Expected: the copy has its own `share_token` and null `rescheduled_from_id`.
5. Edit a confirmed meeting's time. Expected: `confirmed_at` clears, as before.

---

### Task 12: Visit messages as a child of meetings, behind one gate

**Files:**
- Create: `src/shared/modules/meetings/messages/lib/constants.ts`
- Create: `src/shared/modules/meetings/messages/server-spec.ts`
- Create: `src/shared/modules/meetings/messages/dal/server/crud.ts`
- Create: `src/shared/modules/meetings/messages/service.ts`
- Modify: `src/shared/modules/meetings/service.ts`
- Modify: `src/shared/domains/permissions/abilities.ts:15,35`
- Modify: `src/shared/domains/permissions/types.ts:25-39`
- Modify: `src/trpc/routers/meetings.router/procedures.ts`
- Modify: `CONTEXT.md:27-29` and a new section

**Interfaces:**
- Consumes: `meetingMessages` and its schemas (Task 9), `meetingServerSpec`
- Produces: `MEETING_MESSAGE = 'MeetingMessage'`; `meetingMessageServerSpec`; `meetingMessageCrud`; `meetingMessageService` (the five CRUD slots; plan 2 adds its verbs and reads); `meetingService.messages`
- Produces: CASL subject `'VisitMessages'`; `visitMessagesProcedure` (session, dashboard access, `read VisitMessages`, `ctx.scope` = the meeting scope)

A visit message has no ownership of its own: it follows its meeting, the way `proposal_views` follows its proposal. No role is granted `VisitMessages`, so today only a super-admin passes (through `manage all`). Widening later, to dispatchers, is a grant in `abilities.ts`, nothing else. Agents are not in line for it.

- [ ] **Step 1: Name the entity**

Create `src/shared/modules/meetings/messages/lib/constants.ts`:

```ts
// A child of Meeting: its caslSubject is the parent's, and no grant is defined against this name.
// The distinct entityName exists for error messages.
export const MEETING_MESSAGE = 'MeetingMessage' as const
```

In `src/shared/domains/permissions/abilities.ts`, add the import beside the other module imports:

```ts
import { MEETING_MESSAGE } from '@/shared/modules/meetings/messages/lib/constants'
```

and add `MEETING_MESSAGE,` to `ENTITY_NAMES` directly after `MEETING,`.

- [ ] **Step 2: Add the gate subject**

In `src/shared/domains/permissions/types.ts`, add a line to the comment list (after the `'LeadsPool'` line):

```ts
//   - 'VisitMessages'    feature gate (see and send a meeting's visit messages)
```

and add `| 'VisitMessages'` to `AppSubject` after `| 'User'`:

```ts
export type AppSubject
  = EntityName
    | 'all'
    | 'Calendar'
    | 'CustomerPipeline'
    | 'Dashboard'
    | 'LeadsPool'
    | 'User'
    | 'VisitMessages'
```

Do not add a `can(…, 'VisitMessages')` line for any role.

- [ ] **Step 3: Write the server spec, CRUD and unit service**

`src/shared/modules/meetings/messages/server-spec.ts`:

```ts
import type { EntityServerSpec } from '@/shared/dal/server/types'

import {
  insertMeetingMessageSchema,
  meetingMessages,
  selectMeetingMessageSchema,
} from '@/shared/db/schema/meeting-messages'
import { meetingServerSpec } from '@/shared/entities/meetings/lib/server-spec'
import { MEETING_MESSAGE } from '@/shared/modules/meetings/messages/lib/constants'

const updateMeetingMessageSchema = insertMeetingMessageSchema.partial()

/**
 * No visibility of its own: whoever can see the meeting sees its visit messages.
 * Who reaches the visit-message surfaces at all is the VisitMessages gate on the procedure.
 */
export const meetingMessageServerSpec = {
  entityName: MEETING_MESSAGE,
  caslSubject: meetingServerSpec.caslSubject,
  parent: { spec: meetingServerSpec, fk: meetingMessages.meetingId },
  table: meetingMessages,
  schemas: {
    insert: insertMeetingMessageSchema,
    update: updateMeetingMessageSchema,
    select: selectMeetingMessageSchema,
  },
} satisfies EntityServerSpec<typeof meetingMessages>
```

`src/shared/modules/meetings/messages/dal/server/crud.ts`:

```ts
import { createCrudDal } from '@/shared/dal/server/lib/create-crud-dal'
import { meetingMessageServerSpec } from '@/shared/modules/meetings/messages/server-spec'

export const meetingMessageCrud = createCrudDal(meetingMessageServerSpec)
```

`src/shared/modules/meetings/messages/service.ts`:

```ts
import { meetingMessageCrud } from '@/shared/modules/meetings/messages/dal/server/crud'

export const meetingMessageService = {
  ...meetingMessageCrud,
} as const

export type MeetingMessageService = typeof meetingMessageService
```

- [ ] **Step 4: Attach the unit to the root**

In `src/shared/modules/meetings/service.ts`, add the import and the getter:

```ts
import { meetingMessageService } from './messages/service'
```

```ts
  get messages() {
    return meetingMessageService
  },
```

(placed after the `business` getter).

- [ ] **Step 5: Add the visit-messages procedure**

In `src/trpc/routers/meetings.router/procedures.ts`, add `import { TRPCError } from '@trpc/server'` at the top and append:

```ts
/**
 * The visit-message surfaces. No role is granted `VisitMessages`, so only a super-admin passes today.
 * `ctx.scope` stays the meeting scope: a visit message follows its meeting.
 */
export const visitMessagesProcedure = meetingProcedure.use(async ({ ctx, next }) => {
  if (ctx.ability.cannot('read', 'VisitMessages')) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'You do not have permission to see visit messages.' })
  }
  return next({ ctx })
})
```

- [ ] **Step 6: Record the vocabulary**

In `CONTEXT.md`, replace the DID entry (`:28`):

```md
- **DID** — A phone number provisioned on Twilio. A DID is assigned to a user (sticky to that person), or is the one **main line** (`voip_dids.is_main_line`).
```

On `:27` and `:29` replace `CloudTalk` with `JustCall` (the bound dialer is `src/shared/services/voip/dialer/index.ts`; CloudTalk was retired 2026-08-19).

Add a new section after the VoIP terms section:

```md
## Visit messages

- **Main line** — The one company DID that sends visit messages and receives their replies. Never "company line".
- **Visit message** — A text or email Tri Pros sends about a meeting, or a homeowner's reply to one (`meeting_messages`). The kinds: **visit summary** (sent by a person), **day-before reminder** and **rep confirmation** (automatic), **confirmation reply** (the thank-you after a YES), **visit cancellation** (the email that removes a calendar entry), **homeowner reply** (inbound).
- **Sequence** — The ordered visit messages a meeting can get: visit summary → day-before reminder → rep confirmation. The confirmation reply and the visit cancellation are reactions, not steps.
- **Visit message plan** — Each sequence step's state for one meeting, computed from its visit messages, the rules, pauses and the current time (`planVisitMessages`). The scheduled runs send exactly the steps it marks due.
- **Visit message template** — The wording of one visit text, with `{{tokens}}`. **Default** is the wording in code; **edited** is a super-admin's saved wording.
- **Skip** — A person stops one automatic text for one meeting time. **Unskip** undoes it before the text's time.
- **Paused** — A super-admin stopped one automatic kind for every meeting until it is resumed.
- **Confirmation track** — The three confirmations of one visit: the office's (a visit message went out), the homeowner's, and the rep's (a rep confirmation went out for this time). Never "stage", which is a pipeline word.
- **Homeowner confirmed** — The homeowner said they will be there for this time, by replying YES or on their home visit page (`meetings.homeownerConfirmedAt`, `homeownerConfirmedVia`). Shown to the office; never moves the pipeline. The office still sets **Confirmed**.
- **Reschedule chain** — A meeting and the meetings it replaced, linked by `meetings.rescheduledFromId` (`getRescheduleChain`). Visit messages are read across it.
```

(**Home visit page** and **Visit messages page** join this section in the plans that build them.)

- [ ] **Step 7: Run the script, type-check, lint**

Run: `pnpm tsx scripts/verify-visit-messages.ts && pnpm tsc && pnpm lint`
Expected: all twelve sections `✓`, `✅ verify-visit-messages passed`; `tsc` and `lint` clean.

- [ ] **Step 8: Commit**

```bash
git add src/shared/modules/meetings/messages/lib/constants.ts src/shared/modules/meetings/messages/server-spec.ts src/shared/modules/meetings/messages/dal/server/crud.ts src/shared/modules/meetings/messages/service.ts src/shared/modules/meetings/service.ts src/shared/domains/permissions/abilities.ts src/shared/domains/permissions/types.ts src/trpc/routers/meetings.router/procedures.ts CONTEXT.md
git commit -m "feat(visit-messages): meeting_messages as a child of meetings, behind a VisitMessages gate only a super-admin passes today"
```

---

## When this plan is done

- `pnpm tsx scripts/verify-visit-messages.ts` passes twelve sections.
- The dev database has the new columns and tables (owner push, Task 9), and the owner checks in Task 1 and Task 11 pass.
- Nothing is sent and nothing new is visible. Plan 2 (spec §12a steps 2–4) builds the send core, the main line, the Twilio routes, the summary, the two runs, replies and the staff entry points on these names.

Deliberately left to the plan that first uses them: the templates and pauses DAL, the visit-message reads, `getMainLineDid`, `insertAtCursor` and `SmsBodyEditor`, the `.ics` UID for a reschedule chain, `resetShareLink`, and the texts' own dev-override floor in the send core.
