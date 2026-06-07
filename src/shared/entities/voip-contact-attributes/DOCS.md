# voip-contact-attributes

CT attribute-id bridge: maps our stable `app_key`
(`lead_source | primary_trade | trades_interested`) to the CloudTalk-assigned
`ContactAttribute` id used in contact + bulk write payloads. Built-in `name` +
`city` use CT's first-class Contact fields and are NOT mirrored here.

> Attribute ids are global to the CT account (one set for all campaigns),
> whereas campaign ids are per-Campaign — two concerns, two tables (this +
> `voip_campaigns`). See [EPIC.md](../../../../docs/plans/voip-campaigns/EPIC.md)
> decisions log 2026-05-31.

## Invariants

### app_key is the stable key (`#app-key-stable`)

`upsertAttributeByAppKey` upserts on the unique `app_key`. `campaign-sync` maps
each CT attribute definition's title → an `app_key` (skipping unknown titles)
and upserts. If CT renames or re-creates an attribute, the bridge refreshes its
`ct_attribute_id`/`ct_title` while keeping the same app_key.

### Admin-only visibility (`#admin-only-visibility`)

No per-agent ownership. Visibility predicate is `FALSE` — only super-admin (omni
path) reads via scoped CRUD; the Resync admin UI reads through the tRPC router
under admin gating.

## Related

- `services/voip/campaigns/campaign-sync.service.ts` — populates this table
- `services/voip/campaigns/enrollment.service.ts` — reads app_key → ct_attribute_id
