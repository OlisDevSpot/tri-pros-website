# CloudTalk Reintegration — Design Spec

**Date:** 2026-09-06
**Goal:** Run **CloudTalk** as the live auto-dialer again, behind the neutral
`DialerProvider` seam the JustCall migration built — as a clean second
implementation, not a revert — and re-link our customers to their CloudTalk
contacts. Keep JustCall's code dormant and make swapping back a one-line change.

**Companion docs:** [assessment](../../plans/voip-campaigns/cloudtalk-reintegration-assessment.md)
(state of epic, 4-agent research, prod audit) · [JustCall migration spec](./2026-08-19-justcall-dialer-migration-design.md)
· pristine CloudTalk code at git `0c235beb`.

**Verification:** `pnpm tsc` + `pnpm lint` only. No test suite. Never `pnpm build`.
Dev DB via `pnpm db:push:dev`; prod push explicit + user-gated.

## Locked decisions (from this conversation)

1. **SWAP now, DUAL-ready schema.** CloudTalk becomes the sole bound provider;
   JustCall code stays. But land the dual-provider schema now (a `provider`
   discriminator + a neutral `membership_tag` column) so a future swap back to
   JustCall is a one-line binding flip, not a migration.
2. **Capabilities:** restore **bulk upsert** (cross-provider; the customer-
   migration mechanism) and **contact-context push** (CloudTalk Notes / JustCall
   fields). **Drop** campaign pause/resume.
3. **Re-linkage match key: phone-primary + name tiebreaker.** Phone coverage is
   ~100% (709/710); name-primary would silently mis-link ~39. Placeholder/test
   numbers and dirty phones are **excluded**, never auto-linked.

## Non-goals

- No JustCall go-live (dormant). No JustCall `bulk_import` client method yet
  (declared in the interface; implemented when the JustCall migration is revived).
- No campaign pause/resume. No mid-call routing. No shadow call/SMS rows
  (CloudTalk remains source of truth for call/SMS history).
- No CRM test-lead purge (the user handles that separately).

## Architecture

The seam is unchanged in spirit: `services/voip/dialer/{types,index}.ts` defines
the contract and binds ONE provider. Reintegration adds a `providers/cloudtalk/`
tree implementing that contract, a `/api/webhooks/cloudtalk` route, and flips the
binding. Everything above the seam (3 services, tRPC router, campaigns dashboard,
jobs) is already provider-neutral and does not change except UI copy.

Two edits define "which provider is live": the outbound binding
(`dialer/index.ts`) and the inbound webhook route. The new `provider` column makes
persisted rows self-describing so the two can never silently disagree.

## 1. Schema changes (`db:push:dev` first; prod cutover later)

**`src/shared/constants/enums/voip.ts`** — add:
- `dialerProviders = ['cloudtalk','justcall'] as const`
- `contactMatchMethods = ['phone_exact','name_fallback','created','manual','excluded'] as const`

**`voip_campaigns`** (`src/shared/db/schema/voip-campaigns.ts`):
- ADD `provider: text('provider', { enum: dialerProviders }).notNull().default('cloudtalk')`
- ADD `membership_tag: text('membership_tag')` (nullable — CloudTalk's per-campaign
  enrollment tag; null for JustCall). This restores the dropped `ct_membership_tag`
  under a provider-neutral name.
- CHANGE the unique on `provider_campaign_id` → **composite unique
  `(provider, provider_campaign_id)`** (the current single `.unique()` is
  provider-blind and would falsely collide CloudTalk vs JustCall ids).
- `provider_campaign_id` now holds CloudTalk's `ct_campaign_id` (dashboard/sync
  id); the tag lives in `membership_tag`. CloudTalk's two identifiers both have a
  home; JustCall uses only `provider_campaign_id`.

**`voip_campaign_contacts`** (`src/shared/db/schema/voip-campaign-contacts.ts`):
- ADD `provider: text('provider', { enum: dialerProviders }).notNull().default('cloudtalk')`
- ADD linkage-audit columns: `matched_name: text` (name snapshot at link time),
  `match_method: text('match_method', { enum: contactMatchMethods })`,
  `last_linked_at: timestamp(mode:'string', withTimezone:true)`.
- CHANGE the unique on `provider_contact_id` → **composite unique
  `(provider, provider_contact_id)`**.

**`voip_contact_fields`** — unchanged (already provider-neutral: `app_key` →
`provider_field_id` / `provider_field_label`). CloudTalk's attribute id fits
`provider_field_id` as-is.

## 2. Neutral interface extension (`services/voip/dialer/types.ts`)

Keep the 6 core methods. Add:
- **`resolveContact(input: { phoneE164: string, name: string }): Promise<{ providerContactId: string, matchMethod: ContactMatchMethod }>`**
  — find-or-create a provider contact WITHOUT enrolling; returns the id + how it
  matched. This is what the backfill uses to re-establish linkage. CloudTalk =
  `findContactByPhone` → `upsertContact`; JustCall = its phone-upsert.
- **`pushContactNote?(input: { providerContactId: string, note: string }): Promise<void>`**
  — optional. CloudTalk implements (`notes/add`, pre-flattened text); JustCall
  omits it (the same context already rides as custom fields).
- **`bulkUpsert?(inputs: EnrollInput[]): Promise<Array<{ phoneE164: string, providerContactId: string }>>`**
  — optional; the mass-migration primitive. CloudTalk maps to `/bulk/contacts.json`
  (≤10/req, chunked); JustCall to its ≤250 bulk import (implemented when JustCall
  revives). NOT used by the CloudTalk re-linkage backfill (per-contact is fine at
  ~709) — it exists for future JustCall customer migration.

Also **promote the app-key type** (`JustcallContactFieldAppKey`) out of
`providers/justcall/constants` into the neutral `dialer/` layer (e.g.
`ContactFieldAppKey`) — today a "neutral" service lib imports a JustCall type
(seam leak). Both providers reference the neutral type.

Services feature-detect optional methods (`if (dialerProvider.pushContactNote)`).

## 3. CloudTalk provider (`src/shared/services/providers/cloudtalk/`)

Recover from git `0c235beb` and re-shape to the seam:
- `client.ts`, `constants/index.ts`, `lib/config.ts`, `schemas/*`, `types.ts` —
  recover largely as-was (Basic auth, `responseData` unwrap, 429/`X-CloudTalkAPI-*`
  retry, tag add/remove, `notes/add`, `/bulk/contacts.json`, `sms/send.json`,
  `campaigns/index.json`, `contacts/attributes.json`).
- **NEW `dialer-provider.ts`** — `cloudtalkDialerProvider: DialerProvider`, the
  tag→neutral translation:
  - `enroll` → `upsertContact(phone,name,fields)` then `addTags([campaign.membershipTag])`;
    returns the CloudTalk **contact id** as `providerContactId`.
  - `unenroll({providerCampaignId, providerContactId})` → look up the campaign's
    `membership_tag`, `removeTags([tag])`.
  - `switchCampaign` → remove old tag + add new tag on the same contact; return same id.
  - `sendSms` → `sms/send.json`.
  - `listCampaigns` → `campaigns/index.json` → `NeutralCampaign` incl.
    `membershipTag` (from `ContactsTag[0].name`) + `providerCampaignId` (campaign id).
  - `listContactFields` → `contacts/attributes.json` → `NeutralField[]`.
  - `resolveContact` → `findContactByPhone` → `upsertContact`.
  - `pushContactNote` → `notes/add` (flatten newlines, strip emoji).
  - `bulkUpsert` → chunked `/bulk/contacts.json`.
- **NEW `webhooks/events.ts` + `webhooks/adapter.ts`** — CloudTalk's webhooks are
  **flat body + `?secret=` query param (NO HMAC)**. `adapter.verify(req, rawBody)`
  → `verifyWebhookSecret(req.url)` (constant-time `?secret=` compare).
  `adapter.parse(rawBody)` → normalize `call.ended` / `call.disposition_set`
  (from CT `Call.Modified` + disposition) / `sms.received` to `CanonicalDialerEvent`.
  Note field mapping: `internal_number_e164` → `fromNumberE164`, `call_uuid` →
  `callUuid`, CT disposition strings → `cloudtalkDispositionToUnenrollReason`.

## 4. Webhook route + binding + config

- **NEW `src/app/api/webhooks/cloudtalk/route.ts`** — near-clone of the JustCall
  route: `verify` → `parse` → switch canonical events → compose the same services
  (`complianceService`, `campaignEnrollmentService.unenroll`,
  `smsCadenceService.handleCallEnded`). Same failure policy (401 bad secret /
  400 bad body / 200 otherwise). Imports `cloudtalkWebhookAdapter` +
  `cloudtalkDispositionToUnenrollReason`.
- **Binding** — `dialer/index.ts` → `export const dialerProvider = cloudtalkDialerProvider`.
- **Config** — add `cloudtalkEnvFragment` to `server-env.ts` (import + spread +
  register meta): `CLOUDTALK_ACCESS_KEY_ID`, `CLOUDTALK_ACCESS_KEY_SECRET`,
  `CLOUDTALK_WEBHOOK_SECRET` (≥32 chars). Confirm these are still provisioned.
- **UI copy** — the 4 "JustCall" strings in campaigns-admin → "the dialer" /
  "CloudTalk".

## 5. Re-linkage backfill (one-time, phone-primary)

A one-time admin-triggered job (or `scripts/` one-off) that re-establishes
`voip_campaign_contacts.provider_contact_id` for CloudTalk:

- **Scope:** enrollable customers (clean 10-digit phone + lead source + not DNC),
  **minus excluded test leads** — exclusion rule: skip phones with **>3 distinct
  names on one number** (catches the `818-651-1445` / `818-445-3241` buckets
  without touching real 2-person households or true-duplicate groups) plus the
  1 dirty phone. Write those as `match_method='excluded'`, no provider call.
- **Per customer:** `dialerProvider.resolveContact({ phoneE164, name })` →
  - single phone hit → `match_method='phone_exact'`;
  - no hit → created → `match_method='created'`;
  - multiple phone hits (household) → disambiguate by name among those rows →
    `name_fallback`; if still ambiguous → **flag (leave unlinked), don't guess**.
- **Persist:** `upsertEnrolled`-style write keyed by `customerId` — set
  `provider`, `provider_contact_id`, `matched_name`, `match_method`, `last_linked_at`.
- **Idempotent + re-runnable:** PK = `customerId`, `onConflictDoUpdate`; a second
  run is a no-op for resolved rows, and can be scoped to only low-confidence /
  unlinked rows.
- **Scale:** ~709, Bina-heavy. Per-contact `findContactByPhone` + conditional
  create, rate-limited at CloudTalk's 60/min → ~12–15 min. **Bulk not needed here.**
- **Note:** the ~700 existing CloudTalk contacts were created BY our old
  enrollment via phone-upsert, so phone match re-finds exactly those records.

## 6. Resync provider-awareness

`campaignSyncService.resyncDialer` already calls the neutral
`dialerProvider.listCampaigns()` / `listContactFields()`. CloudTalk's impl returns
`membershipTag` on each `NeutralCampaign`; `upsertCampaignByProviderId` persists it
into the new `membership_tag` column (+ `provider='cloudtalk'`). The Setup tab's
resync then works unchanged for CloudTalk.

## 7. Prod cutover ceremony (user-gated)

1. `db:push:dev`, verify, tsc+lint green.
2. Provision `CLOUDTALK_*` env in Vercel + local.
3. Explicit `db:push:prod` (adds the columns; prod voip tables are empty so no
   backfill risk) — user go-ahead required.
4. Run the re-linkage backfill against prod (read/writes `voip_campaign_contacts`
   + creates/links CloudTalk contacts) — user go-ahead required.
5. Resync campaigns/fields; bind sources; enable Bina first; live smoke.

## Open sub-decisions for review

1. **Interface-extension shape** — optional methods on `DialerProvider`
   (recommended, above) vs a typed `capabilities` sub-object. Confirm optional
   methods.
2. **Exclusion rule threshold** — ">3 distinct names on one phone" for test-lead
   exclusion (vs an explicit denylist of the two known numbers, vs both). Confirm.
3. **Backfill trigger** — admin-UI button vs a `scripts/` one-off. (Recommend a
   `scripts/` one-off for the one-time historical re-link; keep per-lead
   resolve-on-enroll for ongoing.)
4. **Env** — confirm the old `CLOUDTALK_*` credentials + webhook secret are still
   valid/available.

## Risks

- CloudTalk `/contacts/add.json` does not dedupe → the backfill MUST resolve
  (find) before create; enforced via `resolveContact`.
- Household/shared phones → name tiebreaker, else flag; never blind first-row.
- Webhook has no HMAC (secret-in-query only) → keep `CLOUDTALK_WEBHOOK_SECRET`
  ≥32 chars and rotate periodically.
- Prod schema is currently JustCall-shaped (0 rows); the cutover adds columns
  cleanly since tables are empty.
