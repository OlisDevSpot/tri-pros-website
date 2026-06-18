# voip-campaigns

CT-identity bridge: mirrors each CloudTalk Campaign's id + membership tag +
cadence config into our DB so enrollment can resolve "which tag puts a contact
into which campaign" without hardcoding CT-assigned ids as env vars.

> Perfect separation (2026-06-04): CloudTalk owns lead lifecycle, including its
> own pipeline tags. This table holds ONLY CT identity + the membership tag we
> push on enroll. No lifecycle status. See
> [EPIC.md](../../../../docs/plans/voip-campaigns/EPIC.md) decisions log 2026-06-04.

## Invariants

### Campaigns are pools, not source-owned (`#admin-binding`)

A campaign is a **pool** any customer (from any lead source) can be enrolled
into — membership is per-customer (`voip_campaign_contacts`), never per-source.
The old `source_slug` "ownership binding" column was **removed 2026-06-11**
(per-customer membership redesign). A campaign is dialable iff it is CT-active
(`isCampaignDialable` → `ct_status === 'active'`); there is NO source-binding
requirement. The catch-all ("General Reaching Out") deliberately belongs to no
source.

A lead source's **default** campaign — used to pre-select the campaign in
"Enroll all" and to auto-enroll new leads on ingest (when the source's policy
sets `enabled && autoEnroll`) — lives on
`lead_sources.voipConfigJSON.campaigns.defaultCampaignId`, set via the Setup tab.
Auto-enroll is dispatched best-effort by `enrollLeadJob` from
`customerIntakeService.ingestLead`; see
`docs/superpowers/specs/2026-06-17-source-anchored-setup-auto-enroll-design.md`.
That is a *default*, not ownership: one campaign can be the default for zero, one,
or many sources.

### Resync only refreshes CT identity (`#resync-preserves-binding`)

`upsertCampaignByCtId` upserts on the unique `ct_campaign_id`; re-running Resync
refreshes name / tag / status / cadence. There is no source binding to preserve
(removed 2026-06-11).

### Membership tag is the enrollment mechanism (`#membership-tag`)

`ct_membership_tag` (e.g. `Campaign-MetaAds`) is the ONE tag we write. CloudTalk
auto-includes any contact carrying it in the matching campaign. Enrollment =
`cloudtalkClient.addTags([ct_membership_tag])`; unenroll = `removeTags(...)`. The
tag to add/remove for a given customer is read from the campaign row linked on
`voip_campaign_contacts.voip_campaign_id`.

### Admin-only visibility (`#admin-only-visibility`)

No per-agent ownership. The visibility predicate is `FALSE` — only super-admin
(omni path) reads via scoped CRUD. The Resync/binding admin UI reads through the
tRPC router under admin gating.

## SMS Cadence Config (`#sms-cadence`)

Each campaign defines an **ordered ladder of ≤ 5 SMS messages**, each armed by a
dial-attempt threshold, configurable per-campaign in the `sms_cadence` JSONB
column. The app orchestrates the cadence decision; CloudTalk delivers via its
`POST /sms/send.json` endpoint.

**Resync-safe:** `upsertCampaignByCtId` never touches this column (it lives
outside CT's purview; only app-side mutations write it).

### Shape

Typed via `smsCadenceSchema` (in `entities/voip-campaigns/schemas/`):

```ts
{
  enabled: boolean                  // default: false
  maxMessages: number               // default: 5, max: 5 messages per campaign
  oneSmsPerDay: boolean             // default: true, ≤1 SMS per contact per calendar day
  messages: [
    {
      afterAttempts: number         // ≥1, arms message when dial attempts reach this count
      body: string                  // SMS body, supports merge fields: {{first_name}}, {{city}}, {{primary_trade}}
    },
    …
  ]
}
```

### Orchestration

The `call.ended` webhook handler increments `voip_campaign_contacts.dial_attempts`
and invokes the cadence decision engine (`services/voip/campaigns/`). The engine:

1. Checks if cadence is `enabled` on the campaign.
2. Checks `auto_sms_sent_count >= maxMessages` (cap at 5 per lead).
3. Checks `auto_sms_sent_count >= messages.length` (all messages sent).
4. If `oneSmsPerDay`, checks if an SMS was sent on the same LA-local calendar day
   (skip if `sameLocalDay(last_auto_sms_at, now)`).
5. Selects the next message (`messages[auto_sms_sent_count]`).
6. Checks if `dialAttempts >= message.afterAttempts` (message is armed).
7. If all gates pass, renders merge fields and sends via `cloudtalkClient.sendSms`.
8. On successful send, increments `auto_sms_sent_count` and stamps `last_auto_sms_at`.

The SMS `from` number is the CloudTalk DID the contact has been seeing
(`internal_number_e164` from the `call.ended` event) — never hardcoded.

### Design reference

[docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md](../../../../docs/superpowers/specs/2026-06-17-voip-campaigns-sms-cadence-design.md)

## Related

- `services/voip/campaigns/campaign-sync.service.ts` — populates this table
- `services/voip/campaigns/enrollment.service.ts` — reads the membership tag
- `voip_campaign_contacts.voip_campaign_id` — the per-customer FK into this table
