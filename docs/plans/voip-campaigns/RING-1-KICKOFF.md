# voip-campaigns Ring 1 — Kickoff prompt (new session)

> **Goal of ring 1:** a semi-working product — leads get pushed into CloudTalk and CT auto-dials + auto-texts them; converts and STOPs drop out. Bulk "enroll all per source" is the headline feature.
>
> Design was finalized in a `grill-with-docs` session 2026-06-04. **The canonical record is the voip-campaigns `EPIC.md` decisions log entry `2026-06-04` (decisions #1–#19).** Read it first.

---

## Paste this into the new session

```
Start voip-campaigns Ring 1. Design is FINAL (grill 2026-06-04). Build it.

Read in order before writing code:
1. docs/plans/voip-campaigns/EPIC.md → Decisions log "2026-06-04" (#1–#19) — the canonical, finalized design.
2. docs/plans/voip-campaigns/phase-1-implementation.md → W2 (schema), W3 (webhook, REWRITTEN), W4 (enrollment, REWRITTEN), W8 ring-1 UI banner. Ignore W5 (removed), W6/W7/W9 (deferred banners).
3. docs/plans/voip-campaigns/HANDOFF-2026-06-04.md → current code state + corrections.
4. docs/codebase-conventions/service-architecture.md → client-is-the-superset-entry-point, provider-directory-shape, background-side-effects-via-qstash-jobs.
5. docs/how-to/add-an-entity.md → the entity scaffold workflow (the 3 new tables need full scaffolds).
6. src/shared/entities/voip-calls/ → the voip-in-house Slug A scaffold to MIRROR for the 3 new entities.
7. src/shared/services/voip/voip-calls.service.ts → an as-built orchestrator service to match the shape of.

THE PERFECT-SEPARATION MODEL (non-negotiable):
- CloudTalk is the SOLE source of truth for lead lifecycle, including its own pipeline tags. We persist NO campaign status. No voipCampaignStatus anything (deleted).
- voip-campaigns persists ONLY: voip_campaigns + voip_contact_attributes (CT identity bridges), voip_campaign_contacts (per-customer participation), and shared DNC fields on customers. customers gets NO voipCampaign* fields.
- The ONLY tag we push is the campaign MEMBERSHIP tag on enroll. CT owns lifecycle tags.
- SMS is CloudTalk-native (campaign cadence); we do NOT call sendSms for campaign comms.

KEY MODEL RULES:
- A lead source owns MANY campaigns; a customer is enrolled in exactly ONE (voip_campaign_contacts.voip_campaign_id). source_slug is nullable + non-unique; admin binds campaign→source in the UI (NOT inferred from CT names).
- "Enrolled now" = voip_campaign_contacts row with unenrolled_at IS NULL. Unenroll = removeTags + set unenrolled_at + unenroll_reason (row + CT contact persist for re-enroll).
- THREE exit paths, ONE idempotent unenroll(customerId, reason): graduated (meeting booked) | opted_out (STOP) | disqualified (manual "bad lead, no meeting"). Each reachable from BOTH the UI and a CT webhook disposition (meeting_booked→graduated; opt_out→opted_out+DNC; not_interested/wrong_number→disqualified). Manual disqualify also has an admin/agent UI button (single + bulk).
- Origin campaign (attribution) = customers.leadMetaJSON.originCampaign (string). Distinct from enrolled campaign. Never drives routing.
- Enrollment routing: auto-enroll → source.voipConfigJSON.campaigns.defaultCampaignId; bulk "enroll all" → admin-picked campaign via UI.

ARCHITECTURE CONSTRAINTS:
- Services are ORCHESTRATORS: compose cloudtalkClient + entity DAL mutations + sibling services + QStash dispatch. ZERO raw db.* in services — every write through entities/<x>/dal/server/mutations.ts.
- Business rules = small pure functions in lib/ (eligibility gates, isStopKeyword, unenroll-decision). Don't over-extract for ring 1, but structure so adding a rule = another function call.
- Side effects = QStash jobs (createJob + dispatch/dispatchOrThrow), NEVER after().
- Webhook: secret via cloudtalkClient.verifyWebhookSecret; parse via webhooks/events.ts. No lib/<resource>.ts action files; no webhooks/verify.ts.
- pnpm tsc + pnpm lint to verify; NEVER pnpm build. pnpm db:push:dev ONLY (NEVER db:push) — and DO NOT push until the user confirms their dev DB cleanup is done; surface the schema diff and ask.

BUILD SEQUENCE (dependency-ordered):
1. Barrel-export the 3 schemas in src/shared/db/schema/index.ts (voip-campaigns, voip-contact-attributes, voip-campaign-contacts).
2. Full entity scaffolds for all 3 (mirror entities/voip-calls/): dal/server/{crud,queries,mutations}, schemas/, lib/{constants,server-spec,visibility}, DOCS.md, types + register CASL subject.
3. lib/resolve-customer.ts (resolveCustomerByPhone, resolveCustomerByCtContactId via voip_campaign_contacts.cloudtalk_contact_id) + lib/is-stop-keyword.ts + lib/ eligibility gates.
4. campaign-sync.service.ts (resyncFromCloudtalk: upsert voip_campaigns unbound + voip_contact_attributes).
5. enrollment.service.ts (enroll + unenroll, orchestrator + gate chain) + enroll-source-batch QStash job.
6. graduate-from-campaign QStash job dispatched on meeting create (dispatchOrThrow) → enrollment.unenroll.
7. notify-last-interacting-agent QStash job (cosmetic, dispatch+void).
8. Rewrite src/app/api/webhooks/cloudtalk/route.ts (W3): sms.received STOP → DNC + unenroll('opted_out'); call.disposition_set → ctDispositionToUnenrollReason (meeting_booked→graduated, opt_out→opted_out+DNC, not_interested/wrong_number→disqualified, else null=keep dialing) → unenroll(reason). Defer attempt-counter/voicemail.
9. tRPC voip-campaigns router: resyncFromCloudtalk, bindCampaignToSource, setDefaultCampaign, enrollAll, unenroll/disqualify (single + bulk), unenrollAll (admin-gated).
10. Ring-1 admin UI (W8 banner): Resync + campaign-binding screen, "enroll all per source" panel w/ campaign picker, enrolled-count badges, AND a "disqualify / stop calling" action (single + bulk) on enrolled leads.
11. pnpm tsc + pnpm lint checkpoint. Surface schema diff; ask user before db:push:dev.

DEFERRED (ring 2, do NOT build): attempt counter / cadence_exhausted (call.ended), voicemail, reconciliation cron (W6), holiday-pause cron (W9), rehash re-dialing (mark // @migration:), richer enroll-progress UI, lifecycle-status display.

First step: confirm with the user whether their dev DB cleanup is done (gates db:push:dev). Then start at build step 1.
```

---

## Current code state (verified 2026-06-04, tsc clean / lint exit 0)

**Schema files written (NOT barrel-exported, NOT pushed):**
- `src/shared/db/schema/voip-campaigns.ts` — `source_slug` nullable + non-unique; `ct_campaign_id` is the natural key.
- `src/shared/db/schema/voip-contact-attributes.ts`
- `src/shared/db/schema/voip-campaign-contacts.ts` — `voip_campaign_id` FK + `enrolled_at`/`unenrolled_at` + `unenroll_reason` (graduated|opted_out|disqualified) + `dial_attempts` + `attribute_hash` + sync.
- `customers.ts` — origin campaign lives in `leadMetaJSON.originCampaign`; NO voipCampaign* columns.
- `lead-sources` `voipConfigJSON.campaigns` — `enabled`, `autoEnroll`, `defaultCampaignId`, `dailyDialVolumeCap`, `messageTemplateOverrides`.

**Deleted (perfect separation):** `voipCampaignStatuses` const, `voipCampaignStatusEnum` pgEnum, `lifecycle-mapper.ts`.

**Provider (committed-adjacent, in working tree):** `src/shared/services/providers/cloudtalk/` — `cloudtalkClient` singleton (`upsertContact`, `addTags`, `removeTags`, `listCampaigns`, `listContactAttributes`, `verifyWebhookSecret`, `bulkContacts`, `sendSms`, …), `webhooks/events.ts`, `schemas/`, `constants/`, `DOCS.md`.

**Webhook route exists but is a stale Phase-0 scaffold** (`src/app/api/webhooks/cloudtalk/route.ts`, committed `776e3cef`) — rewrite per W3.

**Still to build:** the 3 entity scaffolds, `services/voip/campaigns/{enrollment,campaign-sync}.service.ts` + `lib/*`, the QStash jobs, the tRPC router, the admin UI.

## Outstanding user-side (parallel)
- 🔴 Dev DB cleanup — gates `pnpm db:push:dev` for the new schemas. Confirm before pushing.
- 🟡 CloudTalk dashboard: campaigns configured + SMS templates + the webhook URL registered; V1 merge-field verification (per-lead-source-content.md).
- 🟢 A2P 10DLC — PASSED (SMS deliverable).
