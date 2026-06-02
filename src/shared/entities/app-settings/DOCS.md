# app-settings

Generic per-feature config storage. Each feature owns a row keyed by a string
slug (e.g., `'voip-in-house'`, `'voip-campaigns'`, `'compliance'`) and a Zod
schema in its own entity dir that validates `configJson` at write time.

## Invariants

### Natural PK: `feature`

Unlike other entities, the primary key is `feature: text`, not `id: uuid`.
`EntityServerSpec.primaryKey = 'feature'` overrides the default. TId stays
`string` — Postgres just enforces a different column.

This deliberately deviates from the rest of the schema to keep the API ergonomic
(`getById({ id: 'voip-in-house' })` instead of having to look up by slug).

### Admin-only visibility

`appSettingVisibility` returns `sql\`FALSE\``. Agents never see app-settings via
scoped queries. Super-admin bypasses scoping via the omni path
(`can('manage', 'all')` in CASL).

### Per-feature config schema lives elsewhere

The `configJson` JSONB column is typed as `unknown` here on purpose — the
authoritative Zod schema for each `feature` value lives in that feature's own
entity dir (e.g., voip-in-house's kill-switch + calling-hours validates inside
`entities/voip-calls/schemas/` or similar). Writes go through the owning
service, which `.parse()`s the payload first.

Keeping the validation distributed (rather than a giant tagged-union schema
here) means new features don't have to touch this entity to land.

## Use cases at Phase 1

| `feature` | Owner | Shape of `configJson` |
|---|---|---|
| `'voip-in-house'` | voip-in-house | `{ globalKillSwitch: boolean, callingHours: {...} }` |
| `'voip-campaigns'` | voip-campaigns | parallel pivot's call |
| `'compliance'` | compliance.service | `{ ftcLastSyncedAt?: string, scrubCronEnabled: boolean }` |

## Forward references

- Seed script (Task 35) — initial rows for the 3 features above
- Admin UI (Phase 2+) — surfaces config edits via super-admin-gated routes
