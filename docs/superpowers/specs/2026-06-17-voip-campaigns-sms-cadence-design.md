# VoIP Campaigns — App-Orchestrated SMS Cadence (Design)

> **Date:** 2026-06-17
> **Status:** Design — pending implementation plan
> **Parent EPIC:** [../../plans/voip-campaigns/EPIC.md](../../plans/voip-campaigns/EPIC.md)
> **Related:** [../../plans/voip-campaigns/per-lead-source-content.md](../../plans/voip-campaigns/per-lead-source-content.md) (SMS copy library), [../../plans/voip-campaigns/cloudtalk-api-research.md](../../plans/voip-campaigns/cloudtalk-api-research.md)

---

## 1. Problem

CloudTalk auto-dials campaign leads (AI VoiceAgent). We want automated follow-up **SMS** sent across the dial cadence — an opener after the first attempt, nudges as attempts accumulate, a breakup at exhaustion — with two governance rules:

- **≤ 5 auto-SMS per lead** (per-campaign configurable ceiling).
- **≤ 1 auto-SMS per lead per day** — skip if any auto-SMS already went out that day.

The trigger model is **dial-attempt count only** for v1. Dispositions are explicitly **out of scope** for the first cut (added later as the cadence is tightened).

## 2. Key decision: the app is the orchestrator, CloudTalk is delivery

We evaluated doing this entirely inside CloudTalk's **Workflow Automations** (no app code). It does not work, for a decisive reason:

- CloudTalk Workflow Automations are **stateless** — a WA fires on a single `Call Ended` event and evaluates conditions on *that event only*. It has no memory of "how many texts has this lead had" or "did we text them today."
- CloudTalk has **no native per-contact frequency cap / throttle** (only a 60 req/min API rate limit). Multi-step capped SMS cadences exist only via CRM integrations (Salesforce Engagement, Salesloft) — which we are not on.
- Conditions are **AND-only**, with no `not equal to` operator, no delay/wait, and no branching.

Our frequency rules are **stateful**, and the state already lives in our DB (`voip_campaign_contacts`). Therefore:

> **The app owns all SMS cadence logic** (attempt thresholds + frequency caps + message selection + merge-field rendering). **CloudTalk is reduced to delivery** — it dials, emits `Call.Ended` webhooks, and exposes `POST /sms/send.json` (already wrapped as `cloudtalkClient.sendSms`).

This also lands the work back on the existing Ring-2 plan: the app was already going to consume `call.ended` to count attempts and emit `cadence_exhausted`. The SMS cadence rides on the same handler.

## 3. The cadence model

**Two axes, but v1 uses only one.** Dial-attempt count arms each message; the calendar day paces delivery (the ≤1/day gate). Dispositions are deferred.

- Each campaign defines an ordered ladder of **≤ 5 messages**, each armed by a **dial-attempt threshold** (`afterAttempts`).
- The cadence is driven entirely by **`call.ended` webhook events** (which increment `dialAttempts`). No enrollment hook, no scheduler/cron — the dialer's own call activity is the clock.
- The **opener is armed at `afterAttempts: 1`** (after the first dial), not at enrollment. This guarantees a real DID exists to send the SMS *from* (see §5), and removes the need for an enrollment-time send path.

### Example config (Bina / Meta Ads)

```jsonc
{
  "enabled": true,
  "maxMessages": 5,
  "oneSmsPerDay": true,
  "messages": [
    { "afterAttempts": 1,  "body": "Hi {{first_name}}, this is Oliver with the {{city}} {{primary_trade}} Residential Assistance Program. We received your inquiry — I'll be reaching out shortly. Feel free to call/text back at this number." },
    { "afterAttempts": 3,  "body": "Hi {{first_name}}, just following up on your {{primary_trade}} inquiry from the {{city}} Residential Assistance Program. Best time to chat?" },
    { "afterAttempts": 6,  "body": "…" },
    { "afterAttempts": 9,  "body": "…" },
    { "afterAttempts": 10, "body": "Hi {{first_name}}, last note from the {{city}} {{primary_trade}} Residential Assistance Program — reach back out anytime if you'd still like to discuss your project. Thanks!" }
  ]
}
```

`afterAttempts: 10` aligns with `voip_campaigns.attempts_per_contact` (default 10) — the breakup arms exactly when dialing exhausts.

## 4. Data model

### 4.1 Config — `voip_campaigns.sms_cadence` (new JSONB column)

Per-campaign because each campaign is a distinct SMS sequence. It belongs on `voip_campaigns` (not `lead_sources.voipConfigJSON`, which is *source*-level policy with only a `defaultCampaignId` pointer and no per-campaign container).

**Resync-safe (verified):** `upsertCampaignByCtId` ([entities/voip-campaigns/dal/server/mutations.ts:52-64](../../../src/shared/entities/voip-campaigns/dal/server/mutations.ts)) only writes CT-mirrored columns in its `onConflictDoUpdate.set` clause. An app-authored `sms_cadence` column is never touched by resync (the same way admin `source_slug` binding is already preserved).

Typed via a Zod schema `smsCadenceSchema` in [entities/voip-campaigns/schemas/](../../../src/shared/entities/voip-campaigns/schemas/) (NEVER `Record<string, unknown>` — codebase convention for typed JSONB):

```ts
const smsCadenceMessageSchema = z.object({
  afterAttempts: z.number().int().min(1),
  body: z.string().min(1),
})

const smsCadenceSchema = z.object({
  enabled: z.boolean().default(false),
  maxMessages: z.number().int().positive().default(5),
  oneSmsPerDay: z.boolean().default(true),
  messages: z.array(smsCadenceMessageSchema).max(5).default([]),
})
```

UI editing the config (admin campaign settings) is in scope conceptually but its UI build is a fast-follow; the column + schema land first.

### 4.2 Per-lead state — `voip_campaign_contacts` (new columns)

Already holds `dialAttempts`. Add:

- `auto_sms_sent_count` `integer NOT NULL DEFAULT 0` — also the next message index (strict ladder ⇒ count == index). Resets to 0 on re-enrollment (same as `dialAttempts`).
- `last_auto_sms_at` `timestamp` (string, tz) — drives the ≤1/day gate.
- `last_call_uuid` `text` — the `call_uuid` of the most recent counted `call.ended`. Powers the exactly-once attempt-dedup (§8.1). Resets to null on re-enrollment.

### 4.3 SMS `from` number — derived, not stored

The `from` DID is a CloudTalk concern. We use the DID CloudTalk actually dialed *from* (`internal_number`), so the follow-up text comes from the same number the lead has been seeing on calls. We read it off the `call.ended` event at send time — **never hardcoded in config.** (Opener at `afterAttempts: 1` guarantees a `call.ended` has fired, so this number is always available when a message sends.)

## 5. CloudTalk-side configuration

### 5.1 `Call + Ended` Workflow Automation

Edit the **existing** WA (Phase 0 created it) — do not create a new one.

- **Trigger:** object `Call` → action `Ended`.
- **Condition (AND):** `direction` `is equal to` `outgoing`. Scopes to outbound campaign dials; the app additionally gates on "contact actively enrolled," so this is noise-reduction, not the security boundary.
- **Destination:** unchanged — `https://voip.triprosremodeling.com/api/webhooks/cloudtalk?secret=…`.
- **Body (FLAT JSON — hardcode `event_type`, template the rest):**

```json
{
  "event_type": "call.ended",
  "call_uuid": "{{ event.properties.call_uuid }}",
  "ended_at": "{{ event.properties.ended_at }}",
  "direction": "{{ event.properties.direction }}",
  "internal_number_e164": "{{ event.properties.internal_number }}",
  "contact_id": "{{ event.properties.contacts[0].id }}",
  "contact_name": "{{ event.properties.contacts[0].name }}",
  "is_voicemail": "{{ event.properties.is_voicemail }}",
  "duration_sec": "{{ event.properties.talking_time }}",
  "recording_url": "{{ event.properties.recording_url }}"
}
```

**Load-bearing for v1 (must be reliable):** `event_type`, `call_uuid`, `internal_number_e164`, `contact_id`, `direction`. The rest are forward-compat (deferred voicemail/recording/duration handling).

**Template-path confidence:** `internal_number`, `direction`, `contacts[0].id`, `contacts[0].name` are already proven paths (used by `call.started`). `call_uuid`, `ended_at`, `talking_time`, `is_voicemail`, `recording_url` must be **verified against the "Useful Data for your Workflows" sidebar** in the CT dashboard. `is_voicemail` is the least certain — CloudTalk may not expose a clean boolean.

### 5.2 Other WAs

Unchanged. The `sms.received` (STOP→DNC) and `call.disposition_set` (terminal disposition→unenroll) WAs and handlers stay as-is. This design only touches `Call + Ended`.

## 6. App-side changes

1. **`events.ts`** — add `internal_number_e164` (optional e164) to `cloudtalkCallEndedSchema`. Relax `is_voicemail` / `duration_sec` / `recording_url` to **optional** (unused by v1; keeps the WA body lean and parsing robust — a missing `is_voicemail` must not 400 the event). Rename `call.started`'s `did_e164` → `internal_number_e164` for one unified name across the codebase.

2. **Schema** — `sms_cadence` JSONB on `voip_campaigns` + `smsCadenceSchema`; `auto_sms_sent_count` + `last_auto_sms_at` on `voip_campaign_contacts`. `pnpm db:push:dev` (never prod).

3. **Route handler** ([src/app/api/webhooks/cloudtalk/route.ts](../../../src/app/api/webhooks/cloudtalk/route.ts)) — wire the `call.ended` case (today a `default:` no-op): resolve customer via `contact_id` → if actively enrolled, increment `dialAttempts`, then invoke the cadence orchestrator.

4. **Orchestrator** — a `services/voip/campaigns/` service composing a **pure decision function** in `lib/` (args → result, no I/O — codebase convention). Decision logic:

   ```
   given (campaign.sms_cadence, contact.dialAttempts, contact.auto_sms_sent_count,
          contact.last_auto_sms_at, now):
     if !enabled → none
     if auto_sms_sent_count >= maxMessages → none
     if auto_sms_sent_count >= messages.length → none
     if oneSmsPerDay && sameLocalDay(last_auto_sms_at, now) → none
     msg = messages[auto_sms_sent_count]
     if dialAttempts < msg.afterAttempts → none
     else → SEND msg
   ```

   On SEND: render merge fields from the customer row (`{{first_name}}` / `{{city}}` / `{{primary_trade}}` — CloudTalk's `/sms/send` takes a literal body to a number; **the app renders, not CloudTalk**), then `cloudtalkClient.sendSms({ from: internal_number_e164, to: customer.phone, body })`, then bump `auto_sms_sent_count` + stamp `last_auto_sms_at`.

5. **Delivery** — `cloudtalkClient.sendSms` already exists ([client.ts:608](../../../src/shared/services/providers/cloudtalk/client.ts)). Dependency it already flags: **A2P 10DLC registration** gates SMS deliverability.

## 7. Decisions deferred / out of scope (v1)

- **Dispositions** — no meeting/callback/opt-out reactive SMS in v1; attempts-only. (User retracted the disposition matrix; revisit when tightening.) Note: `opt_out` / STOP still flow through the existing `sms.received` + `call.disposition_set` handlers (DNC + unenroll) — a DNC'd / unenrolled contact is no longer "actively enrolled," so the cadence naturally stops texting them.
- **Voicemail / recording / duration** handling — schema carries the fields (optional) but nothing consumes them yet.
- **Enrollment-time opener** (true `afterAttempts: 0`) — deferred; opener is `afterAttempts: 1`.
- **Per-lead timezone for "today"** — v1 may use a single SoCal tz (`America/Los_Angeles`, all leads are SoCal) rather than per-zip tz derivation. Implementation plan to decide.
- **Admin UI** for editing `sms_cadence` — column + schema first; UI is a fast-follow.

## 8. Open questions for the implementation plan

1. **`call.ended` idempotency — RESOLVED (Option A).** Webhooks are at-least-once; redeliveries carry the same `call_uuid`. Attempt counting is made exactly-once by folding the dedup into the increment as a single atomic conditional UPDATE keyed on `last_call_uuid`:

   ```sql
   UPDATE voip_campaign_contacts
   SET dial_attempts = dial_attempts + 1, last_call_uuid = :callUuid
   WHERE customer_id = :customerId
     AND last_call_uuid IS DISTINCT FROM :callUuid
   RETURNING dial_attempts;
   ```

   `rowsAffected = 1` → first sighting → run the orchestrator with the returned `dial_attempts`. `rowsAffected = 0` → redelivery → skip. Postgres row-locks the contact, so concurrent same-uuid deliveries serialize (no race), and claim+increment are one statement (no partial-claim window). Single-slot memory is sufficient because per-contact campaign dialing is strictly sequential (a contact never has two live calls; retries arrive within seconds). Upgrade to a dedicated `call_uuid`-UNIQUE ledger table only if parallel/concurrent dialing of one contact is ever introduced.

   **SMS-send idempotency is separate:** `auto_sms_sent_count` advances only on a successful send, and the ≤1/day gate caps re-sends, so a failed send is retried by the next (non-deduped) `call.ended` without ever doubling up. The `call_uuid` dedup deliberately does not retry the SMS.
2. **Exact CT template paths** for `call_uuid` / `ended_at` / `talking_time` / `is_voicemail` / `recording_url` — verify in the dashboard "Useful Data" sidebar.
3. **`sameLocalDay` source of truth** — single SoCal tz (simple) vs per-zip tz (correct). Lean simple for v1.
