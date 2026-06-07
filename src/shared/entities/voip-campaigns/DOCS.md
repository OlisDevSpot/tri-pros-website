# voip-campaigns

CT-identity bridge: mirrors each CloudTalk Campaign's id + membership tag +
cadence config into our DB so enrollment can resolve "which tag puts a contact
into which campaign" without hardcoding CT-assigned ids as env vars.

> Perfect separation (2026-06-04): CloudTalk owns lead lifecycle, including its
> own pipeline tags. This table holds ONLY CT identity + the membership tag we
> push on enroll. No lifecycle status. See
> [EPIC.md](../../../../docs/plans/voip-campaigns/EPIC.md) decisions log 2026-06-04.

## Invariants

### Source binding is admin-set, never inferred (`#admin-binding`)

`source_slug` is **nullable + not unique**. `campaign-sync.resyncFromCloudtalk`
upserts campaigns with `source_slug = NULL` (unbound). An admin binds each
campaign to a lead source via the Resync UI. A single lead source owns MANY
campaigns. We do NOT parse CT campaign names to infer the source — too fragile
to rely on for enrollment correctness. An unbound campaign is not eligible for
enrollment routing.

### Resync never clobbers a binding (`#resync-preserves-binding`)

`upsertCampaignByCtId` upserts on the unique `ct_campaign_id` and the conflict
branch intentionally omits `source_slug`. Re-running Resync refreshes name / tag
/ status / cadence but preserves the admin's source binding.

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

## Related

- `services/voip/campaigns/campaign-sync.service.ts` — populates this table
- `services/voip/campaigns/enrollment.service.ts` — reads the membership tag
- `voip_campaign_contacts.voip_campaign_id` — the per-customer FK into this table
