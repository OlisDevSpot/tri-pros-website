# Lead Sources — Business Rules

A **Lead Source** is a campaign/channel that brings leads into the funnel: a Facebook ad, a referral program, a telemarketing list, a partner intake form. Each lead source has its own token-authenticated public intake URL and a configurable form. Customers attribute back via `customers.leadSourceId`.

This directory holds: schemas (`schemas.ts`), constants (action configs, customer-segment enum), business helpers (`lib/`: segment SQL + intake URL builder), action-config hooks (`hooks/`), and reusable components (`components/`).

## Relationships

```
LeadSource ──► [public intake form] ──► Customer (via leadSourceId)
                                            │
                                            ├─ leadType (enum)
                                            └─ leadMetaJSON (source-specific payload)
```

## Rules

### token-plus-slug-pair-for-intake

Each lead source has BOTH a public `slug` (human-readable, in the URL path) and a `token` (unguessable secret, in the URL query). The intake URL takes the shape:

```
<origin>/intake?source=<slug>&token=<token>
```

Both must validate at the public route — guessing a slug alone is insufficient. Tokens **never auto-rotate** — only the manual "Rotate" admin action regenerates them, so URLs shared with partners stay stable.

**Why**: slug is the marketing handle (we want it shareable + recognizable); token is the access control (we don't want random visitors creating leads). Manual rotation is the breakglass for compromised tokens.
**Reference impl**: `lib/intake-url.ts:getIntakeUrl`; public intake route at `src/app/(frontend)/intake/`
**Enforced by**: DB unique constraint on `slug` + `token`; intake route validates both

### form-config-modes-customer-only-vs-meeting

`formConfigJSON.mode` switches the intake form between two behaviors:

| Mode | Behavior |
|---|---|
| `customer_only` | Captures customer details + optional notes; creates a Customer row only. No meeting scheduling. |
| `meeting` | Captures customer + schedules a meeting (date/time picker, optional mp3 upload, optional `closedBy` selector). Creates Customer + Meeting in one transaction. |

The `meeting`-mode-specific fields (`showMeetingScheduler`, `requireMeetingScheduler`, `showMp3Upload`, `closedByOptions`) are **ignored** in `customer_only` mode — the schema marks them optional and the form respects them per-mode.

**Why**: a Facebook ad funnel and a telemarketing intake serve different downstream workflows. Facebook → "give us your details, we'll call you" (customer_only); telemarketing → "schedule the meeting now while I have you on the phone" (meeting). One source-config shape doesn't fit both naturally; mode is the discriminator.
**Reference impl**: `schemas.ts:leadSourceFormConfigSchema`; consumed by the intake form at `src/app/(frontend)/intake/`
**Enforced by**: Zod schema (`.optional()` on the meeting-mode fields)

### customer-segmentation-partition

The lead-source detail panel segments a source's customers into 4 buckets:

| Segment | Predicate |
|---|---|
| `all` | no constraint |
| `signed` | has at least one project (`isSignedCustomerSql`) |
| `dead` | `pipeline = 'dead'` AND **not signed** |
| `active` | `pipeline IN ('active', 'rehash')` AND **not signed** |

**Invariant**: `active + signed + dead === all` — these partition the customer set with no double-count, no orphans. A customer who signs and then goes `dead` stays in `signed` (the `notSigned` predicate excludes them from `dead`).

**Why**: the panel surfaces conversion rates by segment; double-counting (a signed-then-dead customer appearing in both buckets) would silently inflate or deflate numbers depending on UI choices. The partition invariant makes the math trustworthy.
**Reference impl**: `lib/segment-sql.ts:buildSegmentWhere`
**Enforced by**: convention + the `notSigned` predicate; the consumer relies on this for KPI accuracy

### lead-source-cant-delete-soft-archive

Lead sources don't delete — they archive (`isActive = false` + `archivedAt` timestamp). The intake URL keeps working for in-flight links but new traffic should be redirected by the admin.

**Why**: customers retain `leadSourceId` FK references; hard-deleting would orphan attribution history. Archiving preserves the historical link while excluding the source from active campaign lists.
**Reference impl**: `isActive` boolean + `archivedAt` timestamp on the schema
**Enforced by**: convention (admin UI offers "Archive" not "Delete"); FK `onDelete: 'set null'` on `customers.leadSourceId` provides defense-in-depth

### customers-attribute-by-foreign-key-not-snapshot

A customer's lead source is tracked as `customers.leadSourceId` (FK with `onDelete: 'set null'`). When a lead source is archived or its `slug`/`name` changes, the customer's attribution updates automatically (because it's a FK, not a denormalized snapshot).

`customers.leadType` (enum) is a coarser classification that's set at intake and frozen.

**Why**: lead source records evolve (rename "FB-Bathroom-Q1" → "FB-Bathroom-2026"); customers should reflect the current name in reports. `leadType` is for the *kind* of source (paid ad vs. referral vs. partner), which doesn't change.
**Reference impl**: schema FK + `leadType` column
**Enforced by**: Postgres FK; tsc on `leadType` enum

## Anti-patterns

- **Sharing only the slug.** Both slug AND token are required. Sharing slug alone produces a 404/403 at the intake route.
- **Auto-rotating tokens on schedule.** Manual rotation only — auto-rotate breaks partner-shared URLs without warning.
- **Treating a soft-archived source as deleted.** It's still attributed; archive is a campaign-management state, not a delete.
- **Reading `customers.pipeline` directly to bucket lead-source customers.** Use `buildSegmentWhere` — it composes the partition invariant with `notSigned`.
- **Denormalizing the lead-source name onto the customer.** Use the FK; reports should join.

## See also

- `../customers/DOCS.md#lead-attribution-fields` — customer-side of attribution (leadSourceId / leadType / leadMetaJSON)
- `../customers/DOCS.md#derived-5-bucket-pipeline` — the `customers.pipeline` column that segments build on
- `../customers/DOCS.md#signed-customer-eq-has-project` — shared definition of "signed"
- `docs/plans/notion-crm-migration-design.md` — historical context (lead sources replaced Notion intake)
- `docs/codebase-conventions/dal-conventions.md` — DAL conventions
