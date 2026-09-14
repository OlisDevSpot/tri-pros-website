# CloudTalk Reintegration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run CloudTalk as the live auto-dialer again behind the neutral `DialerProvider` seam (a clean second implementation, not a revert), re-link our customers to their existing CloudTalk contacts, and keep JustCall dormant + one-line swappable.

**Architecture:** The seam (`services/voip/dialer/{types,index}.ts`) is unchanged in spirit. Add a `providers/cloudtalk/` implementation (recovered from git `0c235beb` + a new tag-translating `dialer-provider.ts` and a flat-body/`?secret=` `webhooks/adapter.ts`), a `/api/webhooks/cloudtalk` route, dual-provider schema columns, three optional interface capabilities (`resolveContact`, `pushContactNote`, `bulkUpsert`), and a one-time phone-primary re-linkage backfill. Everything above the seam (3 services, tRPC router, campaigns dashboard, jobs) is already provider-neutral.

**Tech Stack:** Next.js 15, tRPC, Drizzle (Postgres/Neon), Zod, QStash (Upstash), TypeScript, pnpm. Path alias `@/` → `src/`.

**Spec:** `docs/superpowers/specs/2026-09-06-cloudtalk-reintegration-design.md` (+ assessment `docs/plans/voip-campaigns/cloudtalk-reintegration-assessment.md`; pristine CloudTalk code at git `0c235beb`).

## Global Constraints

Every task implicitly includes these.

- **Verification:** `pnpm tsc` + `pnpm lint` ONLY. **No test suite exists — do not add tests.** **NEVER `pnpm build`.** (memory: no-build, verification-workflow)
- **Backend layering (ADR-0003):** tRPC → Service → DAL → DB. Services orchestrate, hold zero raw `db.*`; every write via `entities/<x>/dal/server/mutations.ts`. Providers are leaves: primitives in/out, no app-domain types.
- **Provider neutrality:** `services/voip/campaigns/*` reaches the dialer ONLY via the `dialerProvider` binding. CloudTalk shapes never cross the `DialerProvider` line.
- **Truthful naming:** columns/types name what they hold. `provider`-prefixed and `membership_tag` are provider-neutral names (no `ct_` prefix).
- **No manual `updatedAt`** (`.$onUpdate()` handles it); **no raw `sql NOW()`** for event timestamps (use `new Date().toISOString()` on `mode:'string'`). (memory)
- **Phone:** all conversion via `@/shared/lib/phone` (`toE164`/`toNationalDigits`); store bare 10-digit; E.164 only at the provider boundary. (memory: phone-numbers)
- **Named exports only; one primary unit per file; `schemas/` sibling of `lib/`.** (memory: coding-conventions)
- **DB:** `pnpm db:push:dev` for dev; prod push explicit `db:push:prod` only when asked. Worktree push needs `.env.local`; verify target after. (memory)
- **Scripts:** import `'./lib/load-env'`; target prod DB ONLY via `DRIZZLE_TARGET=prod`. (memory: scripts-load-env, runtime-db-env)
- **Git:** work on `main`, stage explicitly by path — never `git add -A`. Branch `feat/cloudtalk-reintegration`. Commit only the paths a task names. (memory: work-on-main)
- **Untouched:** the Twilio in-house EPIC (`voip-calls/messages/dids/link_tokens`, `providers/twilio/*`) is separate — do not modify.
- **CloudTalk env (confirmed present):** `CLOUDTALK_ACCESS_KEY_ID`, `CLOUDTALK_ACCESS_KEY_SECRET`, `CLOUDTALK_WEBHOOK_SECRET`.
- **JustCall stays dormant** — its code compiles but is unbound; do not delete it.

## File Structure

**New:**
- `src/shared/services/providers/cloudtalk/{client.ts,constants/index.ts,lib/config.ts,types.ts,schemas/*.ts}` — recovered from `0c235beb`.
- `src/shared/services/providers/cloudtalk/dialer-provider.ts` — NEW: `cloudtalkDialerProvider: DialerProvider` (tag translation).
- `src/shared/services/providers/cloudtalk/mappers/resolve-attribute-ids.ts` — NEW: neutral fields → CloudTalk `ContactAttribute[]`.
- `src/shared/services/providers/cloudtalk/webhooks/{events.ts,adapter.ts}` — NEW: flat-body schemas + `?secret=` verify + canonical normalize.
- `src/shared/services/providers/cloudtalk/DOCS.md` — NEW.
- `src/app/api/webhooks/cloudtalk/route.ts` — NEW.
- `scripts/backfill-cloudtalk-contact-links.ts` — NEW: one-time re-linkage.

**Modified:**
- `src/shared/constants/enums/voip.ts` — add `dialerProviders`, `contactMatchMethods`.
- `src/shared/db/schema/{voip-campaigns.ts,voip-campaign-contacts.ts}` — dual-provider columns + composite uniques.
- `src/shared/services/voip/dialer/types.ts` — neutral app-key type; `NeutralCampaign.membershipTag`; optional `resolveContact`/`pushContactNote`/`bulkUpsert`.
- `src/shared/services/voip/dialer/index.ts` — flip binding to `cloudtalkDialerProvider`.
- `src/shared/services/voip/campaigns/{build-neutral-fields.ts,lib/field-label-map.ts}` — import the neutral app-key type.
- `src/shared/services/voip/campaigns/campaign-sync.service.ts` + `src/shared/entities/voip-campaigns/dal/server/mutations.ts` — persist `membership_tag` + `provider` on resync.
- `src/shared/config/server-env.ts` — add `cloudtalkEnvFragment` + meta.
- 4 campaigns-admin UI files — "JustCall" copy → "the dialer".

---

## Task 1: Dual-provider schema + enums

**Files:**
- Modify: `src/shared/constants/enums/voip.ts`
- Modify: `src/shared/db/schema/voip-campaigns.ts`
- Modify: `src/shared/db/schema/voip-campaign-contacts.ts`

**Interfaces:**
- Produces: `dialerProviders` (`['cloudtalk','justcall']`), `contactMatchMethods`; `voip_campaigns.{provider,membership_tag}`; `voip_campaign_contacts.{provider,matched_name,match_method,last_linked_at}`; composite uniques `(provider, provider_campaign_id)` and `(provider, provider_contact_id)`.

- [ ] **Step 1: Add the enums.** In `enums/voip.ts` add:
```ts
export const dialerProviders = ['cloudtalk', 'justcall'] as const
export type DialerProviderKey = (typeof dialerProviders)[number]
export const contactMatchMethods = ['phone_exact', 'name_fallback', 'created', 'manual', 'excluded'] as const
export type ContactMatchMethod = (typeof contactMatchMethods)[number]
```

- [ ] **Step 2: `voip_campaigns` columns.** Add `provider` + `membership_tag`; replace the single `.unique()` on `provider_campaign_id` with a composite unique in the table's extra-config callback:
```ts
provider: text('provider', { enum: dialerProviders }).notNull().default('cloudtalk'),
membershipTag: text('membership_tag'), // CloudTalk per-campaign enrollment tag; null for JustCall
// ...and in the table config: unique().on(t.provider, t.providerCampaignId) (drop the column-level .unique())
```

- [ ] **Step 3: `voip_campaign_contacts` columns.** Add `provider`, `matched_name`, `match_method`, `last_linked_at`; swap the `provider_contact_id` unique for a composite `(provider, provider_contact_id)`:
```ts
provider: text('provider', { enum: dialerProviders }).notNull().default('cloudtalk'),
matchedName: text('matched_name'),
matchMethod: text('match_method', { enum: contactMatchMethods }),
lastLinkedAt: timestamp('last_linked_at', { mode: 'string', withTimezone: true }),
```

- [ ] **Step 4: Push to dev.** Run `pnpm db:push:dev`. Expected: adds columns + swaps uniques cleanly (dev voip tables are empty). Verify target DB is dev.

- [ ] **Step 5: Verify.** `pnpm tsc` (0 errors) + `pnpm lint` (0 errors).

- [ ] **Step 6: Commit.**
```bash
git add src/shared/constants/enums/voip.ts src/shared/db/schema/voip-campaigns.ts src/shared/db/schema/voip-campaign-contacts.ts
git commit -m "feat(voip): dual-provider schema — provider discriminator, membership_tag, linkage-audit cols"
```

---

## Task 2: Neutral interface extension + app-key type promotion

**Files:**
- Modify: `src/shared/services/voip/dialer/types.ts`
- Modify: `src/shared/services/voip/campaigns/build-neutral-fields.ts`
- Modify: `src/shared/services/voip/campaigns/lib/field-label-map.ts`

**Interfaces:**
- Consumes: none (JustCall provider needs NO change — it simply doesn't implement the new optional methods).
- Produces: neutral `ContactFieldAppKey`; `NeutralCampaign.membershipTag?`; optional `DialerProvider.resolveContact`/`pushContactNote`/`bulkUpsert`.

- [ ] **Step 1: Promote the app-key type.** In `dialer/types.ts` define the neutral type (values identical to the current JustCall one):
```ts
export const contactFieldAppKeys = ['lead_source', 'primary_trade', 'trades_interested', 'lead_created_at'] as const
export type ContactFieldAppKey = (typeof contactFieldAppKeys)[number]
```

- [ ] **Step 2: Rewire the two neutral libs** (`build-neutral-fields.ts`, `lib/field-label-map.ts`) to import `ContactFieldAppKey` from `@/shared/services/voip/dialer` instead of `providers/justcall/constants`. (JustCall's own `justcallContactFieldAppKeys` can re-export or alias the neutral one — keep JustCall compiling.)

- [ ] **Step 3: Add `membershipTag` to `NeutralCampaign`:**
```ts
export interface NeutralCampaign {
  providerCampaignId: string
  name: string
  dialerMode: DialerMode
  status: 'active' | 'inactive'
  membershipTag?: string // CloudTalk enrollment tag; undefined for JustCall
}
```

- [ ] **Step 4: Add optional capabilities to `DialerProvider`:**
```ts
resolveContact?: (input: { phoneE164: string, name: string }) => Promise<{ providerContactId: string, matchMethod: ContactMatchMethod }>
pushContactNote?: (input: { providerContactId: string, note: string }) => Promise<void>
bulkUpsert?: (inputs: EnrollInput[]) => Promise<Array<{ phoneE164: string, providerContactId: string }>>
```
Import `ContactMatchMethod` from `@/shared/constants/enums/voip`.

- [ ] **Step 5: Verify.** `pnpm tsc` + `pnpm lint`. JustCall provider must still compile untouched (it satisfies the interface without the optionals). Fix the JustCall `listCampaigns` map only if `NeutralCampaign` now requires `membershipTag` — it must stay OPTIONAL so JustCall omits it.

- [ ] **Step 6: Commit.**
```bash
git add src/shared/services/voip/dialer/types.ts src/shared/services/voip/campaigns/build-neutral-fields.ts src/shared/services/voip/campaigns/lib/field-label-map.ts
git commit -m "feat(voip/dialer): neutral app-key type + optional resolveContact/pushContactNote/bulkUpsert + NeutralCampaign.membershipTag"
```

---

## Task 3: Recover CloudTalk provider base (client/config/constants/schemas/types)

**Files:**
- Create (from `0c235beb`): `providers/cloudtalk/{client.ts,constants/index.ts,lib/config.ts,types.ts}` + `schemas/{bulk,call,campaign,contact,primitives,sms}.ts`
- Modify: `src/shared/config/server-env.ts`

**Interfaces:**
- Produces: `cloudtalkClient` (+ `CloudtalkApiError`, `CloudtalkResponseValidationError`); `cloudtalkEnvFragment`/`getCloudtalkConfig`/`isCloudtalkConfigured`/`cloudtalkConfigMeta`; `cloudtalkDispositions`, disposition→reason map.

- [ ] **Step 1: Recover the files.** For each path, restore verbatim then let tsc guide fixes:
```bash
for f in client.ts constants/index.ts lib/config.ts types.ts schemas/bulk.ts schemas/call.ts schemas/campaign.ts schemas/contact.ts schemas/primitives.ts schemas/sms.ts; do
  mkdir -p "src/shared/services/providers/cloudtalk/$(dirname "$f")"
  git show "0c235beb:src/shared/services/providers/cloudtalk/$f" > "src/shared/services/providers/cloudtalk/$f"
done
```

- [ ] **Step 2: Add the disposition→unenroll-reason map** to `constants/index.ts` (mirror the JustCall shape; use CloudTalk's `cloudtalkDispositions` values):
```ts
export function cloudtalkDispositionToUnenrollReason(d: string): VoipUnenrollReason | null { /* meeting_booked→graduated, opt_out→opted_out, not_interested/wrong_number→disqualified, else null */ }
```

- [ ] **Step 3: Wire config into `server-env.ts`** — import `cloudtalkConfigMeta` + `cloudtalkEnvFragment`, spread `...cloudtalkEnvFragment.shape` into `envSchema`, append `cloudtalkConfigMeta` to `PROVIDER_METAS`.

- [ ] **Step 4: Verify.** `pnpm tsc` + `pnpm lint`. The client is a leaf; resolve any import drift (e.g. `createProviderConfig` path) against the current tree. Do NOT wire it to services yet.

- [ ] **Step 5: Commit.**
```bash
git add src/shared/services/providers/cloudtalk/client.ts src/shared/services/providers/cloudtalk/constants src/shared/services/providers/cloudtalk/lib src/shared/services/providers/cloudtalk/types.ts src/shared/services/providers/cloudtalk/schemas src/shared/config/server-env.ts
git commit -m "feat(cloudtalk): recover client/config/constants/schemas base + server-env config"
```

---

## Task 4: `cloudtalkDialerProvider` (tag translation) + mappers

**Files:**
- Create: `providers/cloudtalk/dialer-provider.ts`
- Create: `providers/cloudtalk/mappers/resolve-attribute-ids.ts`

**Interfaces:**
- Consumes: `cloudtalkClient`, `DialerProvider`, `NeutralField`/`NeutralCampaign`, `ContactMatchMethod`.
- Produces: `cloudtalkDialerProvider: DialerProvider`.

- [ ] **Step 1: The attribute-id mapper** — neutral `NeutralField[]` → CloudTalk `{ attributeId, value }[]`, dropping unresolved (mirror JustCall's `resolve-field-ids.ts`).

- [ ] **Step 2: Implement `cloudtalkDialerProvider`** satisfying every method + the 3 optionals:
  - `enroll` → `cloudtalkClient.upsertContact({phoneE164,name,attributes})` then `addTags({contactId, tags:[input.membershipTag]})`; return `{ providerContactId: contactId }`. (Enroll input needs the tag — see Step 3.)
  - `unenroll` → resolve tag from the campaign (passed via `providerCampaignId`→tag lookup; see note) → `removeTags`.
  - `switchCampaign` → `removeTags(oldTag)` + `addTags(newTag)`; return same contactId.
  - `sendSms` → `cloudtalkClient.sendSms`.
  - `listCampaigns` → `cloudtalkClient.listCampaigns()` → `NeutralCampaign[]` incl. `membershipTag`.
  - `listContactFields` → `cloudtalkClient.listContactAttributes()` → `NeutralField[]`.
  - `resolveContact` → `findContactByPhone` → hit = `{id, matchMethod:'phone_exact'}`; miss = `upsertContact` create = `{id, matchMethod:'created'}`.
  - `pushContactNote` → `cloudtalkClient.addContactNote` (flatten newlines, strip emoji).
  - `bulkUpsert` → chunk ≤10 → `cloudtalkClient.bulkContacts`.

- [ ] **Step 3: Resolve the tag-passing seam.** CloudTalk `enroll`/`unenroll` need the membership tag. The neutral `EnrollInput` carries `providerCampaignId` (the CT campaign id), not the tag. Decide + document in-file: the enrollment service already loads the campaign row (which now has `membership_tag`) — thread the tag through by having the CloudTalk provider look it up is NOT allowed (provider is a leaf, no DB). So: **carry the tag on the enroll/unenroll input.** Add `membershipTag?: string` to `EnrollInput` + the unenroll input in `dialer/types.ts` (JustCall ignores it), and have `enrollment.service.ts` pass `campaign.membershipTag`. (Small addition to Task 2's types — implement here and back-fill the type.)

- [ ] **Step 4: Verify.** `pnpm tsc` + `pnpm lint`.

- [ ] **Step 5: Commit.**
```bash
git add src/shared/services/providers/cloudtalk/dialer-provider.ts src/shared/services/providers/cloudtalk/mappers src/shared/services/voip/dialer/types.ts src/shared/services/voip/campaigns/enrollment.service.ts
git commit -m "feat(cloudtalk): cloudtalkDialerProvider tag-translation + attribute mapper + tag threading"
```

---

## Task 5: CloudTalk webhooks (events + adapter)

**Files:**
- Create: `providers/cloudtalk/webhooks/events.ts`
- Create: `providers/cloudtalk/webhooks/adapter.ts`

**Interfaces:**
- Consumes: `getCloudtalkConfig`, `CanonicalDialerEvent`.
- Produces: `cloudtalkWebhookAdapter` (`verify(req, rawBody)`, `parse(rawBody)`), `verifyCloudtalkWebhookSecret`.

- [ ] **Step 1: `events.ts`** — recover CloudTalk's flat-body Zod union from `0c235beb:.../cloudtalk/webhooks/events.ts` (`call.answered`/`call.ended`/`call.disposition_set`/`sms.received`, coercion helpers) + a `verifyCloudtalkWebhookSecret(url: string): boolean` that constant-time-compares the `?secret=` query param against `getCloudtalkConfig().webhookSecret`.

- [ ] **Step 2: `adapter.ts`** — `verify(req, _rawBody)` → `verifyCloudtalkWebhookSecret(req.url)`; `parse(rawBody)` → parse the flat body, map to `CanonicalDialerEvent`: `call.ended`→`{type:'call.ended', callUuid:call_uuid, providerContactId:contact_id, direction, fromNumberE164:internal_number_e164}`; `call.disposition_set`→`{type:'call.disposition_set', callUuid, providerContactId, disposition}`; `sms.received`→`{type:'sms.received', fromE164:from_e164, toE164:to_e164, text, providerContactId:contact_id}`; `call.answered`→`null` (not actionable).

- [ ] **Step 3: Verify.** `pnpm tsc` + `pnpm lint`.

- [ ] **Step 4: Commit.**
```bash
git add src/shared/services/providers/cloudtalk/webhooks
git commit -m "feat(cloudtalk): webhook events + adapter (flat body, ?secret= verify → canonical events)"
```

---

## Task 6: Resync provider-awareness (persist membership_tag + provider)

**Files:**
- Modify: `src/shared/services/voip/campaigns/campaign-sync.service.ts`
- Modify: `src/shared/entities/voip-campaigns/dal/server/mutations.ts`

**Interfaces:**
- Consumes: `NeutralCampaign.membershipTag`.
- Produces: `upsertCampaignByProviderId` persists `provider` + `membership_tag`.

- [ ] **Step 1: Extend `upsertCampaignByProviderId`** to accept + write `provider` and `membershipTag` (upsert on the composite `(provider, provider_campaign_id)`).

- [ ] **Step 2: Pass them from `campaignSyncService.resyncDialer`** — set `provider: 'cloudtalk'` (or derive from a small `activeDialerProvider` constant) and `membershipTag: c.membershipTag`.

- [ ] **Step 3: Verify.** `pnpm tsc` + `pnpm lint`.

- [ ] **Step 4: Commit.**
```bash
git add src/shared/services/voip/campaigns/campaign-sync.service.ts src/shared/entities/voip-campaigns/dal/server/mutations.ts
git commit -m "feat(voip): resync persists provider + membership_tag"
```

---

## Task 7: Webhook route + flip binding + UI copy

**Files:**
- Create: `src/app/api/webhooks/cloudtalk/route.ts`
- Modify: `src/shared/services/voip/dialer/index.ts`
- Modify: 4 campaigns-admin UI files (setup card + mutations hook copy)

**Interfaces:**
- Consumes: `cloudtalkWebhookAdapter`, `cloudtalkDispositionToUnenrollReason`, `cloudtalkDialerProvider`.

- [ ] **Step 1: The route** — clone `app/api/webhooks/justcall/route.ts`, swap the two provider imports for the CloudTalk adapter + disposition map; keep the switch/compose logic and 401/400/200 failure policy identical.

- [ ] **Step 2: Flip the binding** — `dialer/index.ts`:
```ts
import { cloudtalkDialerProvider } from '@/shared/services/providers/cloudtalk/dialer-provider'
export const dialerProvider: DialerProvider = cloudtalkDialerProvider
```

- [ ] **Step 3: UI copy** — replace the 4 "JustCall" strings (synced-campaigns-card, use-campaign-mutations) with "the dialer" / "CloudTalk".

- [ ] **Step 4: Verify.** `pnpm tsc` + `pnpm lint`.

- [ ] **Step 5: Commit.**
```bash
git add src/app/api/webhooks/cloudtalk/route.ts src/shared/services/voip/dialer/index.ts src/features/campaigns-admin
git commit -m "feat(cloudtalk): webhook route + bind cloudtalkDialerProvider + de-JustCall UI copy"
```

---

## Task 8: One-time re-linkage backfill script

**Files:**
- Create: `scripts/backfill-cloudtalk-contact-links.ts`

**Interfaces:**
- Consumes: `dialerProvider.resolveContact`, customers DAL, `voip_campaign_contacts` mutation, `@/shared/lib/phone`.

- [ ] **Step 1: Write the script** (imports `'./lib/load-env'`; `--dry-run` default, `--commit` to write; supports `DRIZZLE_TARGET=prod`). Flow:
  1. Select enrollable customers (clean 10-digit phone + lead_source + not DNC).
  2. Compute the **exclusion set**: phones with **>3 distinct names on one number** + non-10-digit → mark `match_method='excluded'`, skip provider calls.
  3. For each remaining customer: `toE164(phone)` → `dialerProvider.resolveContact({phoneE164,name})`. Persist `{ provider:'cloudtalk', providerContactId, matchedName:name, matchMethod, lastLinkedAt: now }` via the `upsertEnrolled`-style mutation (PK `customerId`, `onConflictDoUpdate`).
  4. Household ambiguity (resolveContact can't disambiguate) → leave unlinked, log for review.
  5. Print a summary table: linked / created / excluded / flagged, and per-lead-source counts.

- [ ] **Step 2: Dry-run against dev** — `pnpm tsx scripts/backfill-cloudtalk-contact-links.ts` (no `--commit`). Confirm counts look sane (~709 enrollable minus exclusions).

- [ ] **Step 3: Verify.** `pnpm tsc` + `pnpm lint`.

- [ ] **Step 4: Commit.**
```bash
git add scripts/backfill-cloudtalk-contact-links.ts
git commit -m "feat(cloudtalk): one-time phone-primary contact re-linkage backfill script"
```

---

## Task 9: Docs

**Files:**
- Create: `src/shared/services/providers/cloudtalk/DOCS.md`
- Modify: `docs/plans/voip-campaigns/cloudtalk-reintegration-assessment.md` (mark implemented), `docs/plans/voip-campaigns/EPIC.md` (banner: provider = CloudTalk again via seam), provider `justcall/DOCS.md` (note: dormant, seam-swappable).

- [ ] **Step 1: Write `cloudtalk/DOCS.md`** — provider overview, the neutral-seam note, tag-enrollment model, webhook `?secret=` verification, what-lives-where.
- [ ] **Step 2: Update the banners.**
- [ ] **Step 3: Verify + commit** (`pnpm lint` for markdown-adjacent only; no tsc needed).
```bash
git add src/shared/services/providers/cloudtalk/DOCS.md docs/plans/voip-campaigns docs/superpowers/plans/2026-09-06-cloudtalk-reintegration.md
git commit -m "docs(cloudtalk): provider DOCS + reintegration banners"
```

---

## Execution — user-gated steps (NOT code)

After the code tasks are green and reviewed:
1. **Prod schema push** — `pnpm db:push:prod` (adds columns; prod voip tables empty). **Explicit user go-ahead.**
2. **Env** — confirm `CLOUDTALK_*` set in Vercel (already present locally).
3. **Backfill against prod** — `DRIZZLE_TARGET=prod pnpm tsx scripts/backfill-cloudtalk-contact-links.ts --commit`. **Explicit user go-ahead**; review the dry-run summary first.
4. **Resync + bind + smoke** — Resync (persists campaigns + membership_tag + fields), bind sources, enable Bina first, live smoke via `pnpm dev:mobile` (tunnel for QStash + the `/api/webhooks/cloudtalk` receiver).

## Self-review

- **Spec coverage:** schema (T1), interface + type promotion (T2), provider base (T3), tag translation (T4), webhooks (T5), resync-awareness (T6), route+binding+copy (T7), backfill (T8), docs (T9). All spec sections mapped. ✅
- **No tests:** every task verifies via `pnpm tsc` + `pnpm lint` only. ✅
- **Type consistency:** `membershipTag` threading is introduced in T2 (types) and consumed in T4 (provider) + passed in enrollment.service (T4 Step 3) — flagged as a cross-task addition. `provider`/`ContactMatchMethod` from T1 used in T2/T8. ✅
- **Open sub-decisions (confirmed 2026-09-06):** optional-methods interface shape; ">3 distinct names" exclusion rule; `scripts/` one-off backfill; env present. ✅
