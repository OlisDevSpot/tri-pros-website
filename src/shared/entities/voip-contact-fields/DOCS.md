# voip-contact-fields

Dialer custom-field bridge: maps our stable `app_key`
(`lead_source | primary_trade | trades_interested | lead_created_at`) to the
provider-assigned (JustCall) custom-field id used in the enroll
`custom_fields:[{id,value}]` payload. Built-in `name` uses the provider's
first-class contact field and is NOT mirrored here.

> Renamed from `voip-contact-attributes` in the CloudTalk → JustCall migration
> (2026-08-19). Field ids are global to the account (one set for all campaigns),
> whereas campaign ids are per-campaign — two concerns, two tables (this +
> `voip_campaigns`). See [migration spec](../../../../docs/superpowers/specs/2026-08-19-justcall-dialer-migration-design.md).

## Invariants

### app_key is the stable key (`#app-key-stable`)

`upsertContactFieldByAppKey` upserts on the unique `app_key`. `campaign-sync` maps
each dialer custom-field definition's label → an `app_key` (skipping unknown
labels) and upserts. If the provider renames or re-creates a field, the bridge
refreshes its `provider_field_id`/`provider_field_label` while keeping the same
app_key.

### Admin-only visibility (`#admin-only-visibility`)

No per-agent ownership. Visibility predicate is `FALSE` — only super-admin (omni
path) reads via scoped CRUD; the Resync admin UI reads through the tRPC router
under admin gating.

## Related

- `services/voip/campaigns/campaign-sync.service.ts` — populates this table
- `services/voip/campaigns/enrollment.service.ts` — reads app_key → provider_field_id
