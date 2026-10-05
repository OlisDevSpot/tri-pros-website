# Email Deliverability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Tri Pros transactional/notification email from landing in spam (and protect the corporate domain's sending reputation) by moving off the root mailbox domain, closing hygiene gaps, and adding a dev-send safety guard + basic observability.

**Architecture:** All email funnels through one module — `src/shared/services/email.service.ts` (6 Resend send sites). We keep that chokepoint and (a) flip the sender identity to a dedicated verified subdomain while keeping the *receiving* inbox on `info@`, (b) fix per-message hygiene (subjects, `List-Unsubscribe`, `reply-to`), and (c) route every send through one internal `dispatch()` helper that applies a dev-recipient guard, tags, id-logging, and idempotency.

**Tech Stack:** Next.js 15, tRPC, Resend (`resend` SDK, sends via Amazon SES), React Email templates, Drizzle/Postgres. DNS currently: Google Workspace MX; SPF `include:_spf.google.com include:amazonses.com`; DKIM `resend._domainkey`; return-path `send.triprosremodeling.com`; DMARC `p=none`.

## Global Constraints

- **Verification bar:** this repo has **no unit-test runner**. Verify every code task with `pnpm tsc` and `pnpm lint` (never `pnpm build`). Behavioral proof uses `dig`, Gmail → "Show original" header inspection, or a one-off `pnpm tsx scripts/tmp-*.ts` diagnostic (delete tmp scripts after).
- **Company data comes from constants** — never hardcode addresses in call-sites. Sender/inbox live in `src/shared/services/providers/resend/constants.ts`; system inbox in `src/shared/constants/system-users.ts`.
- **Prod safety gates key on `VERCEL_ENV === 'production'`, NOT `NODE_ENV`** (see `server-env.ts:183-202`). Any dev-only email override MUST fail the production boot if set, mirroring `VOIP_DEV_OVERRIDE_NUMBER`.
- **Sender ≠ receiver:** the FROM identity moves to the sending subdomain; `RESEND_LEAD_INBOX` / `SYSTEM_OWNER_EMAIL` (where internal leads are *received* and where move-forward is copied) MUST remain the real monitored mailbox `info@triprosremodeling.com`.
- **Commit after each task.** Branch off `main` first: `chore/email-deliverability-hardening`. Do not push or open a PR unless asked.
- **DNS + Resend-dashboard steps are human actions** — the plan marks them 🔧 MANUAL. Do not fabricate completion; paste the real `dig`/dashboard output into the checkbox.

---

## Priority map

- **P0 — Task 1, 2:** dedicated sending subdomain (the fix for the observed spam + reputation isolation).
- **P1 — Task 3, 4, 5, 6:** per-message hygiene + DMARC enforcement.
- **P2 — Task 7, 8, 9, 10:** central dispatch seam → dev guard, observability, idempotency.

Tasks are ordered for safe sequential execution. Task 7 (refactor to a single `dispatch()`) must land before 8–10.

---

## Task 1: Provision dedicated sending subdomain in Resend + DNS 🔧 MANUAL

**Files:** none (Resend dashboard + DNS registrar). Code cutover is Task 2.

**Why:** Sending `From: @triprosremodeling.com` from an external ESP to your own Google mailboxes trips Gmail's domain-spoofing heuristic → spam, even though DMARC passes. A dedicated subdomain (not your mailbox domain) removes that heuristic and isolates reputation.

**Decision to lock before starting:** sending subdomain + mailbox. Recommended: **`mail.triprosremodeling.com`**, default sender **`notifications@mail.triprosremodeling.com`**, display name stays **"Tri Pros Remodeling"**. (Do NOT reuse `send.triprosremodeling.com` — that subdomain is already the Resend return-path for the root domain.)

- [ ] **Step 1: Add the domain in Resend.** Resend Dashboard → Domains → Add Domain → `mail.triprosremodeling.com`. Region: keep `us-east-1` (matches existing `feedback-smtp.us-east-1.amazonses.com` return-path). Resend generates a DKIM TXT/CNAME, an SPF TXT, and a return-path MX for the subdomain.

- [ ] **Step 2: Add the generated records to DNS.** In the DNS registrar/Cloudflare zone for `triprosremodeling.com`, add exactly the records Resend shows for `mail.` (DKIM, SPF `include:amazonses.com`, return-path MX). Do NOT touch the existing root-domain records — the root Resend setup stays and is harmless.

- [ ] **Step 3: Verify in Resend.** Wait for Resend to show the domain **Verified** (all records green).

- [ ] **Step 4: Confirm via dig.** Run and paste output:

```bash
D=mail.triprosremodeling.com
echo "== DKIM =="; dig +short TXT resend._domainkey.$D; dig +short CNAME resend._domainkey.$D
echo "== SPF =="; dig +short TXT $D | grep -i spf
echo "== return-path MX =="; dig +short MX send.$D 2>/dev/null; dig +short MX $D
```
Expected: a `v=DKIM1` key present, SPF with `include:amazonses.com`, and an amazonses return-path MX. Paste real output here: `____`

**Deliverable:** `mail.triprosremodeling.com` verified in Resend and resolvable in DNS. No code yet — Task 2 flips the app to it.

---

## Task 2: Point the sender FROM at the subdomain (keep receiving inbox on info@)

**Files:**
- Modify: `src/shared/services/providers/resend/constants.ts:1-9`

**Interfaces:**
- Produces: `RESEND_SENDER_MAILBOX` (new subdomain address), `RESEND_FROM.default` (rebuilt), `RESEND_LEAD_INBOX` (unchanged value `info@triprosremodeling.com`, now decoupled from sender). `buildSenderFrom()` already reads `RESEND_SENDER_MAILBOX`, so per-rep display names follow automatically.

**Gotcha (do not skip):** today `RESEND_LEAD_INBOX = RESEND_SENDER_MAILBOX`. If you change the sender without decoupling, internal lead emails would be *delivered* to `notifications@mail...` instead of the monitored `info@` inbox. Decouple them.

- [ ] **Step 1: Edit the constants.** Replace `src/shared/services/providers/resend/constants.ts` body with:

```ts
export const RESEND_BRAND_NAME = 'Tri Pros Remodeling'

/** FROM identity — a DEDICATED sending subdomain, NOT the Google Workspace
 *  mailbox domain. Keeps external-ESP mail from tripping Gmail's own-domain
 *  spoofing heuristic and isolates sending reputation. see the deliverability plan. */
export const RESEND_SENDER_MAILBOX = 'notifications@mail.triprosremodeling.com'

export const RESEND_FROM = {
  /** Single canonical sender — one (display name, mailbox) pair preserves subdomain reputation. */
  default: `${RESEND_BRAND_NAME} <${RESEND_SENDER_MAILBOX}>`,
} as const

/** Where internal leads are RECEIVED / where notifications are copied — the real
 *  monitored Google mailbox. Deliberately DECOUPLED from the sender identity. */
export const RESEND_LEAD_INBOX = 'info@triprosremodeling.com'
```

- [ ] **Step 2: Confirm the system inbox constant is unchanged.** `src/shared/constants/system-users.ts` must still export `SYSTEM_OWNER_EMAIL = 'info@triprosremodeling.com'` (the move-forward copy target). No edit expected — just verify.

- [ ] **Step 3: Type + lint.**

```bash
pnpm tsc && pnpm lint
```
Expected: clean (no new errors in `email.service.ts` / `notification.service.ts` / `constants.ts`).

- [ ] **Step 4: Behavioral proof — send a real test to an internal mailbox and inspect headers.** Trigger the move-forward flow (or run the existing app path) so an email is sent to `oliver@triprosremodeling.com`. In Gmail open the message → ⋮ → **Show original**. Confirm: `SPF: PASS`, `DKIM: 'PASS' with domain mail.triprosremodeling.com`, `DMARC: PASS`, and that it landed in **Inbox, not Spam**. Paste the auth-results summary here: `____`

- [ ] **Step 5: Commit.**

```bash
git add src/shared/services/providers/resend/constants.ts
git commit -m "feat(email): send from dedicated mail.triprosremodeling.com subdomain; decouple receiving inbox"
```

**Deliverable:** all mail sent from `notifications@mail.triprosremodeling.com`; internal leads still received at `info@`; internal recipients get Inbox placement.

---

## Task 3: Remove emoji from subject lines

**Files:**
- Modify: `src/shared/services/email.service.ts:71` (proposal `🏠`), `:101` (move-forward `🚀`)

**Why:** the rocket in particular is a classic spam-scored token; leading emoji also render inconsistently and read as promotional.

- [ ] **Step 1: Edit both subjects.**

```ts
// email.service.ts ~:71
subject: `${firstName}, your Tri Pros proposal is ready`,
// email.service.ts ~:101
subject: `${params.customerName} is ready to move forward`,
```

- [ ] **Step 2: Grep to confirm no emoji remain in any subject.**

```bash
grep -nE "subject:.*[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}]" src/shared/services/email.service.ts || echo "no emoji subjects ✓"
```
Expected: `no emoji subjects ✓`

- [ ] **Step 3: Type + lint.** `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 4: Commit.**

```bash
git add src/shared/services/email.service.ts
git commit -m "fix(email): drop emoji from subject lines (spam-score hygiene)"
```

**Deliverable:** plain, professional subject lines.

---

## Task 4: Add `List-Unsubscribe` to customer-facing emails

**Files:**
- Modify: `src/shared/services/email.service.ts` — the two customer-facing sends: `sendProposalEmail` (`:67`) and `sendInquiryConfirmationEmail` (`:163`).

**Why:** Gmail/Yahoo increasingly expect `List-Unsubscribe` even on automated mail; its absence raises spam score. A `mailto:` list-unsubscribe is the minimum compliant form and needs no new endpoint.

**Scope note:** internal notifications (move-forward, new-lead, lead-inbox) do NOT need this — they go to `info@`/reps. One-click `List-Unsubscribe-Post` (RFC 8058) requires a GET/POST endpoint and is a **follow-up** (see plan tail), not this task.

- [ ] **Step 1: Add the header to the proposal send.** In `sendProposalEmail`'s `resendClient.emails.send({ ... })` object, add:

```ts
headers: {
  'List-Unsubscribe': '<mailto:unsubscribe@triprosremodeling.com?subject=unsubscribe>',
},
```

- [ ] **Step 2: Add the same header to `sendInquiryConfirmationEmail`'s send object.**

- [ ] **Step 3: Verify the `unsubscribe@` mailbox exists** (Google Workspace) or is a routable alias to `info@`. 🔧 MANUAL — paste confirmation: `____`

- [ ] **Step 4: Type + lint.** `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 5: Behavioral proof.** Send a proposal test; in Gmail "Show original" confirm a `List-Unsubscribe` header is present. Paste: `____`

- [ ] **Step 6: Commit.**

```bash
git add src/shared/services/email.service.ts
git commit -m "feat(email): add List-Unsubscribe header to customer-facing mail"
```

**Deliverable:** customer-facing mail carries a compliant unsubscribe header.

---

## Task 5: Add `reply-to` to the move-forward notification

**Files:**
- Modify: `src/shared/services/notification.service.ts` (`notifyHomeownerMoveForwardRequest`, ~`:160-180`) and `src/shared/services/email.service.ts` (`sendMoveForwardRequestEmail`, `:92-114`).

**Why:** "customer wants to proceed" is a signal a rep may want to reply to; today replies default to the From. Route replies to the monitored inbox.

- [ ] **Step 1: Thread a `replyTo` param into the email fn.** In `sendMoveForwardRequestEmail`'s params add `replyTo?: string`, and add `replyTo: params.replyTo` to the `.send()` object.

- [ ] **Step 2: Pass it from the notification service.** In the `emailService.sendMoveForwardRequestEmail({ ... })` call, add `replyTo: RESEND_LEAD_INBOX`. Import `RESEND_LEAD_INBOX` from `@/shared/services/providers/resend/constants` if not already imported.

- [ ] **Step 3: Type + lint.** `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 4: Commit.**

```bash
git add src/shared/services/notification.service.ts src/shared/services/email.service.ts
git commit -m "feat(email): reply-to on move-forward notification routes to info@"
```

**Deliverable:** replies to the move-forward email reach `info@`.

---

## Task 6: Advance DMARC `p=none` → `p=quarantine` 🔧 MANUAL (gated)

**Files:** none (DNS `_dmarc.triprosremodeling.com` TXT).

**Why:** enforcement signals legitimacy to Gmail and helps inbox placement. **Gate:** only after Tasks 1–2 are live AND you've reviewed ~1–2 weeks of `rua` reports (already collected at `dmarc-reports@triprosremodeling.com`) showing all legitimate mail (Google + `mail.triprosremodeling.com` via SES) passes alignment. Do not enforce blind.

- [ ] **Step 1: Confirm reports are clean.** Review aggregate reports; verify no legitimate source is failing DMARC. Paste a one-line summary: `____`

- [ ] **Step 2: Update the DMARC record** to quarantine, ramping via `pct` if desired:

```
v=DMARC1; p=quarantine; pct=25; rua=mailto:dmarc-reports@triprosremodeling.com; ruf=mailto:dmarc-reports@triprosremodeling.com; fo=1; aspf=r; adkim=r
```
Ramp `pct` 25 → 50 → 100 over subsequent days, then optionally `p=reject`.

- [ ] **Step 3: Verify.** `dig +short TXT _dmarc.triprosremodeling.com` shows the new policy. Paste: `____`

**Deliverable:** DMARC enforcing; reputation signal improved. Roll back to `p=none` immediately if legitimate mail starts failing.

---

## Task 7: Route all sends through one internal `dispatch()` helper (refactor)

**Files:**
- Create: `src/shared/services/providers/resend/lib/guard-recipients.ts`
- Modify: `src/shared/services/email.service.ts` — add a private `dispatch()` and route all 6 sends through it.

**Interfaces:**
- Produces: `guardRecipients(to: string | string[]): string | string[]`; and a module-private `dispatch({ kind, payload, idempotencyKey? })` that wraps `resendClient.emails.send`, applies the recipient guard, attaches a `type` tag, logs the returned id, throws on error. Later tasks (8–10) hang behavior off this one seam.

**Why:** centralizing removes six copies of the `{ data, error } = send(...); if (error) throw` boilerplate and gives Tasks 8–10 a single place to add the dev guard, tags, id-logging, and idempotency.

- [ ] **Step 1: Create the recipient guard (pass-through for now; Task 8 wires the override).**

```ts
// src/shared/services/providers/resend/lib/guard-recipients.ts
import env from '@/shared/config/server-env'

/**
 * Non-production safety valve: when EMAIL_DEV_OVERRIDE is set (dev/preview),
 * reroute EVERY recipient to that single test inbox so we never mail real
 * customers — and never leak localhost image/link URLs to them. Mirrors
 * VOIP_DEV_OVERRIDE_NUMBER. Production always passes through unchanged.
 */
export function guardRecipients(to: string | string[]): string | string[] {
  const override = env.EMAIL_DEV_OVERRIDE
  if (env.VERCEL_ENV === 'production' || !override) return to
  return override
}
```
> Note: `env.EMAIL_DEV_OVERRIDE` does not exist yet — Task 8 adds it to the schema. This file will not type-check until Task 8 Step 1; do Steps here, then Task 8, then run `tsc`. (Alternatively land Task 8 Step 1 first — the two are tightly coupled.)

- [ ] **Step 2: Add `dispatch()` inside `createEmailService()`** (top of the returned object's closure, above the send methods):

```ts
async function dispatch(args: {
  kind: string
  payload: Parameters<typeof resendClient.emails.send>[0]
  idempotencyKey?: string
}) {
  const to = guardRecipients(args.payload.to as string | string[])
  const { data, error } = await resendClient.emails.send(
    { ...args.payload, to, tags: [{ name: 'type', value: args.kind }] },
    args.idempotencyKey ? { idempotencyKey: args.idempotencyKey } : undefined,
  )
  if (error) {
    throw new Error(`Failed to send ${args.kind} email: ${JSON.stringify(error)}`)
  }
  // eslint-disable-next-line no-console
  console.info(`[email] sent kind=${args.kind} id=${data?.id ?? 'unknown'}`)
  return { data }
}
```
Import `guardRecipients` at the top of `email.service.ts`.

- [ ] **Step 3: Convert all 6 sends to `dispatch()`.** For each existing `const { data, error } = await resendClient.emails.send({ ...OBJ }); if (error) throw ...; return { data }`, replace with `return dispatch({ kind: '<slug>', payload: { ...OBJ } })`. Use these `kind` slugs (tag values must match `^[a-zA-Z0-9_-]+$`): `proposal`, `move-forward`, `schedule-consultation`, `general-inquiry`, `inquiry-confirmation`, `new-lead`.

- [ ] **Step 4: Type + lint** (after Task 8 Step 1 lands the env var). `pnpm tsc && pnpm lint` → clean. Confirm no `resendClient.emails.send` calls remain outside `dispatch`:

```bash
grep -n "resendClient.emails.send" src/shared/services/email.service.ts
```
Expected: exactly ONE match (inside `dispatch`).

- [ ] **Step 5: Commit.**

```bash
git add src/shared/services/email.service.ts src/shared/services/providers/resend/lib/guard-recipients.ts
git commit -m "refactor(email): route all sends through one dispatch() seam (guard/tags/logging)"
```

**Deliverable:** single send chokepoint; every message tagged and its Resend id logged.

---

## Task 8: Dev recipient guard — `EMAIL_DEV_OVERRIDE` env var + prod gate

**Files:**
- Modify: `src/shared/config/server-env.ts` — add `EMAIL_DEV_OVERRIDE` to the env schema (next to `VOIP_DEV_OVERRIDE_NUMBER`) and a production gate (mirror `:193-195`).
- (`.env.local` per developer — set the override; gitignored.)

**Why:** today the live Resend key + live domain are used in dev with **no recipient restriction** — `next dev` sends real mail, and email links use `publicUrl()` = `NGROK_URL ?? NEXT_PUBLIC_BASE_URL`, so dev emails embed `http://localhost:3000` links (broken images + reputation harm). This closes it, matching the VoIP/Meta dev-guard pattern.

- [ ] **Step 1: Add the schema field.** Find `VOIP_DEV_OVERRIDE_NUMBER` in the `server-env.ts` zod schema and add alongside it:

```ts
EMAIL_DEV_OVERRIDE: z.string().email().optional(),
```

- [ ] **Step 2: Add the production gate.** Next to the existing gates (`server-env.ts:193-202`) add:

```ts
// EMAIL_DEV_OVERRIDE reroutes ALL outbound email to a single test inbox —
// invaluable in dev/preview, catastrophic in production (would black-hole
// every customer email). Fail boot if it ever leaks into prod config.
if (env.VERCEL_ENV === 'production' && env.EMAIL_DEV_OVERRIDE) {
  throw new Error('EMAIL_DEV_OVERRIDE must NOT be set in production')
}
```

- [ ] **Step 3: Set it locally.** Add to your `.env.local` (gitignored): `EMAIL_DEV_OVERRIDE=your-personal@triprosremodeling.com`.

- [ ] **Step 4: Type + lint.** `pnpm tsc && pnpm lint` → clean (this also unblocks Task 7 Step 1's `env.EMAIL_DEV_OVERRIDE` reference).

- [ ] **Step 5: Behavioral proof.** With `EMAIL_DEV_OVERRIDE` set locally, trigger any email flow; confirm it arrives at the override inbox and NOT at the nominal recipient. Then temporarily unset and confirm pass-through. Paste result: `____`

- [ ] **Step 6: Commit.**

```bash
git add src/shared/config/server-env.ts
git commit -m "feat(email): EMAIL_DEV_OVERRIDE reroutes all non-prod email to a test inbox"
```

**Deliverable:** dev/preview can no longer mail real customers; prod boot fails if the override is ever set there.

---

## Task 9: Observability — persist tags + log recipient set

**Files:**
- Modify: `src/shared/services/email.service.ts` (`dispatch()` from Task 7).

**Why:** diagnosing "oliver@ went to spam" required a DB query because the Resend `id` and recipients were never recorded. Tags (Task 7) already let you filter in the Resend dashboard; add the recipient list to the log line so a send is fully traceable from app logs → Resend dashboard.

- [ ] **Step 1: Enrich the `dispatch` log line** to include recipients (post-guard):

```ts
const toList = Array.isArray(to) ? to.join(',') : to
// eslint-disable-next-line no-console
console.info(`[email] sent kind=${args.kind} id=${data?.id ?? 'unknown'} to=${toList}`)
```

- [ ] **Step 2: Type + lint.** `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 3: Behavioral proof.** Trigger a send; confirm the server log shows `kind=`, `id=`, `to=`, and that the id is findable in the Resend dashboard (Emails, filtered by the `type` tag). Paste the log line: `____`

- [ ] **Step 4: Commit.**

```bash
git add src/shared/services/email.service.ts
git commit -m "feat(email): log Resend id + recipients per send for traceability"
```

**Deliverable:** every send is traceable app-logs → Resend dashboard without a DB query.

> **Stretch (separate future task, not in scope):** a `email_sends` audit table (id, kind, recipients, resend_id, status, created_at) written from `dispatch`, for durable history + webhook-driven delivery/bounce status. Note it as a follow-up issue; do not build here.

---

## Task 10: Idempotency keys on duplicate-unsafe sends

**Files:**
- Modify: `src/shared/services/notification.service.ts` (move-forward, new-lead call-sites) to pass a stable key; `email.service.ts` `dispatch` already forwards `idempotencyKey` (Task 7).

**Why:** no idempotency today → a retried mutation double-sends. Apply keys only where a duplicate is ALWAYS wrong (notifications), NOT where a resend is a legitimate feature (proposal resend). Resend's idempotency window is ~24h.

- [ ] **Step 1: Move-forward.** In `sendMoveForwardRequestEmail`, accept an `idempotencyKey?: string` param and forward it into `dispatch({ kind: 'move-forward', payload, idempotencyKey })`. From `notifyHomeownerMoveForwardRequest`, pass `idempotencyKey: \`move-forward/${params.proposalId}\`` (dedupes repeat clicks/retries within 24h).

- [ ] **Step 2: New-lead.** Same pattern for `sendNewLeadNotificationEmail` with a key derived from the lead's stable id (e.g. `new-lead/${leadId}` — use whatever unique id the caller has; if none, skip this send rather than invent one).

- [ ] **Step 3: Type + lint.** `pnpm tsc && pnpm lint` → clean.

- [ ] **Step 4: Behavioral proof.** Trigger the move-forward flow twice within a minute for the same proposal; confirm only ONE email is delivered (Resend dashboard shows one send / deduped). Paste: `____`

- [ ] **Step 5: Commit.**

```bash
git add src/shared/services/notification.service.ts src/shared/services/email.service.ts
git commit -m "feat(email): idempotency keys on notification sends prevent double-send on retry"
```

**Deliverable:** notification sends are retry-safe.

---

## Follow-ups (explicitly out of scope — file as issues)

- **One-click unsubscribe** (`List-Unsubscribe-Post: List-Unsubscribe=One-Click` + a GET/POST endpoint) — needed if/when true bulk/marketing/drip email is added.
- **Curated plaintext** on the image-heavy proposal template (`proposal-email.tsx`) — Resend auto-generates text; a hand-tuned `text` improves text-to-image ratio.
- **`email_sends` audit table** + Resend delivery/bounce webhooks — durable send history and automated spam/bounce visibility.
- **Remove the now-unused root-domain Resend sending config** once the subdomain has baked in (optional cleanup; harmless if left).

---

## Self-review checklist (run before executing)

- **Coverage:** P0 (T1–2), P1 (T3–6), P2 (T7–10) map 1:1 to the audit findings ①–⑨. ✓
- **Sequencing hazard:** Task 7's `guardRecipients` references `env.EMAIL_DEV_OVERRIDE` which Task 8 Step 1 creates — noted inline; land Task 8 Step 1 before running `tsc` for Task 7 (or execute 8-Step-1 first). ✓
- **Sender/receiver split:** Task 2 decouples `RESEND_LEAD_INBOX` from `RESEND_SENDER_MAILBOX` — the one correctness trap. ✓
- **No fabricated tests:** repo has no test runner; every code task verifies via `tsc`+`lint`+behavioral proof. ✓
