# Customers — Business Rules

A **Customer** is a household we may sell to. Customer (1) → Meeting (many) → Proposal (many) → Project (created on approval). Customers exist independent of meetings; a customer with no meeting is a **lead**.

This directory holds: schemas (`schemas/`), types (`types/`), constants and column registries (`constants/`), business helpers + server spec + SQL helpers (`lib/`), CRUD + business DAL (`dal/server/`), action-config hooks (`hooks/`), and components grouped by surface (`components/profile/`, `components/lists/`, `components/timeline/`).

## Relationships

```
Lead Source ──► Customer ──► Meeting ──► Proposal ──► Project
                  ▲                                       │
                  └───────── (customer is signed when ────┘
                              they have ≥1 project)
```

## Rules

### visibility-via-meeting-participation

A non-omni agent sees a customer only if they participate in **any** meeting tied to that customer (any role). Customers have no direct owner column; meeting participation is the bridge. Super-admins (`ability.can('manage', 'all')`) bypass scoping.

**Why**: the meeting is where the customer relationship is owned. Customer-level access derives from there.
**Reference impl**: `dal/server/visibility.ts:userCanSeeCustomer` (raw SQL); `lib/visibility.ts:customerVisibility` (entity-spec adapter)
**Enforced by**: `scopeMiddleware(customerServerSpec)` on every entity procedure

### phone-visibility-threshold

Agents see a customer's phone number only when the customer has a proposal at status `sent` or `approved`. Omni + leads-pool (dispatcher) + trusted server/token callers see it ungated. Phone is **null-gated at the DAL layer** (via `gatedPhoneSql`), not by hiding in the UI — so leaked queries can't expose it.

UI surfaces also receive `hasSentProposal: boolean` so they can distinguish "phone null because gated" (show unlock CTA) from "phone null because the customer genuinely has no phone" (super-admin sees, agent shouldn't be told).

**Why**: protects against agents shopping leads pre-commitment. Threshold (not equality) matters — phone stays unlocked through approval and project stages because forward progression only deepens the relationship.
**Reference impl**: `lib/phone-gating-sql.ts` (`gatedPhoneSql`, `canSeeUngatedPhone`, `hasSentProposalSql`); `lib/can-see-phone.ts` (client-side render helper)
**Enforced by**: DAL-level SQL null-coalesce on every agent-facing query that exposes `customers.phone`
**Related ping**: see `memory/feedback-phone-visibility-threshold.md` for the threshold-vs-equality history and the recent (2026-05-19) fix.

### derived-5-bucket-pipeline

UI surfaces classify customers against a 5-bucket pipeline (`projects | fresh | leads | rehash | dead`). The underlying column `customers.pipeline` is 3-bucket (`active | rehash | dead`); `derivedPipelineSql()` explodes `active` based on downstream records:

```
rehash | dead     → passthrough (stored on customers.pipeline)
active + project  → 'projects'   (signed customer)
active + meeting  → 'fresh'      (meeting-stage)
active otherwise  → 'leads'      (pre-meeting)
```

**Why**: `rehash` and `dead` need to live on the customer (a dead customer may have no meetings; the dead state outlives the meeting). `active` is too coarse for the UI — the 5-bucket view distinguishes leads / fresh / signed by what records the customer has.

**Reference impl**: `lib/derived-pipeline-sql.ts` (`derivedPipelineSql`, `derivedPipelineWhere`)
**Enforced by**: convention — every list query that surfaces `pipeline` to a customer-table consumer must use this helper, not raw `customers.pipeline`.

**⚠️ Stale comment on schema**: `customers.pipeline` is marked `@deprecated` in `src/shared/db/schema/customers.ts` ("will be removed after backfill migration"), but it's still the source of truth for `rehash` and `dead`. The deprecation comment is misleading and should be removed or rephrased — those values can't move to `meetings.pipeline` (a dead customer may have no meetings).

### signed-customer-eq-has-project

A customer is "signed" when they have at least one project. Projects are the business symbol of a converted customer — this rule is the single definition; every router, job, and aggregate counts signed customers the same way.

**Why**: a project = signed contract = revenue commitment. `proposal.status = 'approved'` is the trigger that creates the project (see `../proposals/DOCS.md#conversion-trigger`); after that, "signed" means "has the project."
**Reference impl**: `lib/signed-customer-sql.ts:isSignedCustomerSql`
**Enforced by**: convention (single helper; all consumers go through it)

### pipeline-stage-only-for-leads

`customers.pipelineStage` (text column, default `new`) is only meaningful when the customer is in the `leads` derived pipeline (has no meetings yet). Once a meeting exists, stage tracking moves to `meetings.pipeline` + meeting-stage enums.

**Why**: leads pre-meeting are tracked on the customer (lead funnel: `new → contacted → qualified → meeting_scheduled`). Once they have a meeting, the meeting's pipeline/stage takes over.
**Reference impl**: `pipelineStage` column; `leadsPipelineStages` enum in `src/shared/constants/enums/pipelines.ts`
**Enforced by**: convention

### senior-age-thresholds-two-paths

A "senior" customer has two distinct definitions depending on the data path:

- **From customer profile (bucket)**: `ageGroup ∈ {'65-75', '75-or-older'}` → `isSenior(ageGroup)` returns boolean (or null when ageGroup unset).
- **From numeric age (precise)**: `age ≥ 65` → `isSeniorByAge(age)` returns boolean. Used by the contract flow where the agent enters a precise age for CSLB compliance.

**Why**: the customer profile collects bucketed age for sales psychology; the contract flow needs the precise numeric for CSLB 5-day rescission window legal compliance (see `../proposals/DOCS.md#cslb-start-date`).
**Reference impl**: `lib/customer-predicates.ts`
**Enforced by**: tsc + convention (two distinct functions; pick the right one for the data path)

### three-jsonb-profiles

**Decomposed to a 1:1 child table (Addendum B, 2026-07-14 — supersedes the Wave-1
wide-column build).** The three profile blobs (`customerProfileJSON`,
`propertyProfileJSON`, `financialProfileJSON`) are frozen — `*Deprecated` columns
with zero writers, read only by the one-time backfill script, dropped next release.
Every field they used to hold (except `age`) now lives on `customer_profiles`, a
1:1 child table keyed `customer_id` PK-as-FK (`ON DELETE CASCADE`, house precedent
`voip_campaign_contacts`). `age` stays a plain column on `customers` — it's
identity-adjacent (written by anonymous homeowners via the contracts share-token
flow, read by legal envelope rules), not sales-discovery data. The child columns
are grouped by three key-registries in `schemas/index.ts`:

| Registry | Purpose |
|---|---|
| `CUSTOMER_PROFILE_COLUMN_KEYS` | Sales psychology — trigger event, pains, decision timeline, etc. (no `age` — see above) |
| `PROPERTY_PROFILE_COLUMN_KEYS` | Property facts — year built, roof type, HVAC, foundation, etc. |
| `FINANCIAL_PROFILE_COLUMN_KEYS` | Credit score range, # quotes received |

`PROFILE_COLUMN_KEYS` is the flat union of all three (23 keys), used where the
write/permission boundary doesn't care which sub-registry a field belongs to. Two
shape changes from the old blobs: `mainPainPoint: { accessor, urgencyRating }`
split into two scalar columns (`mainPainAccessor` / `mainPainUrgency`) since a
nested object can't be a column; `additionalPainPoints` stays an **array** and
lives on as its own JSONB array column (`additional_pain_points`, now on the child
table) rather than exploding into N columns — order-independent collections still
belong in JSONB per `jsonb-columns.md#arrays-of-objects-vs-keyed-objects`.

Fields are still filled progressively — row-exists on `customer_profiles` IS the
"has discovery data been collected" signal (lazy upsert; ~18% of customers have a
row). Writes go through `upsertCustomerProfile` (`dal/server/mutations.ts`, wraps
the generic `upsertOneToOne` helper) via the `customersRouter.profile.upsert`
tRPC procedure — a single-statement `INSERT … ON CONFLICT (customer_id) DO UPDATE`,
not a `customerCrud.update` patch. Each column is individually nullable so
`undefined` (omitted) vs explicit `null` (clear) behaves exactly like the old
partial-blob semantics. Reads use a **flattened-spread leftJoin** (`profileCols()`
helper in `lib/profile-select.ts`) at the three sites that need the full composed
row (`CustomerWithProfile`, exported from `dal/server/queries.ts`): customers'
`getCustomer`, the customer-pipelines `getCustomerProfile` feature query, and
meetings' `getByIdWithJoins`. UI still uses field registries
(`constants/customer-profile-fields.ts`, `property-profile-fields.ts`,
`financial-profile-fields.ts`) to drive the edit form per group.

**Why**: the original Wave-1 verdict put these fields as nullable columns
directly on `customers`. Addendum B's Sub-Entity Standard (6-agent research
program, 2026-07-14) reclassified them: they're a **named domain concept**
(a sales-discovery snapshot) with a real permission boundary (own CASL subject)
and row-existence semantics ("has discovery data been collected" is meaningful) —
the `*_COLUMN_KEYS` constants needed to re-group the table's own columns was
itself the smell that the group wanted to be a table.
**Reference impl**: `src/shared/db/schema/customer-profiles.ts` (table + patch
schema); `schemas/index.ts` (`CUSTOMER_PROFILE_COLUMN_KEYS` / `PROPERTY_PROFILE_COLUMN_KEYS` / `FINANCIAL_PROFILE_COLUMN_KEYS` / `PROFILE_COLUMN_KEYS` / `ProfileKey`); `dal/server/mutations.ts` (`upsertCustomerProfile`); `dal/server/queries.ts` (`CustomerWithProfile`); `lib/profile-select.ts` (`profileCols`)
**Enforced by**: Zod validation on `customerProfilePatchSchema` (child-table patch); CASL gates the whole child table as one subject — `can('read'/'update', 'CustomerProfile')` in `src/shared/domains/permissions/abilities.ts` (separate from `can('update', 'Customer', ['age'])`)
see `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` §10 (Addendum B)

### lead-attribution-fields

A customer's lead origin is captured by three fields:

- `leadSourceId` (FK to `lead_sources`) — which campaign/channel attributed the lead
- `leadType` (enum) — broad classification (`facebook_ad`, `referral`, etc.)
- `leadMetaJSON` (Zod-validated) — source-specific metadata (mp3 recording key, scheduled-for date, requested trades)

**Why**: separates "which campaign" (FK) from "what kind" (enum) from "campaign-specific payload" (JSONB). Each gets to evolve independently.
**Reference impl**: schema lines `leadSourceId / leadType / leadMetaJSON`; `schemas/index.ts:leadMetaSchema`
**Enforced by**: Zod on insert/update

### geocoding-stored-on-customer

Customers carry `latitude`, `longitude`, `geocodedAt`. Address-edit flows trigger a geocode and write these alongside the address. Map surfaces (project showroom, customer pipeline map view) read directly from the columns.

**Why**: geocoding is rate-limited and slow at the Google Maps boundary; caching on the customer row makes the map view a single query without extra API calls.
**Reference impl**: `customerServerSpec.hooks.update.before` at `src/shared/entities/customers/lib/server-spec.ts` — nullifies cached coords whenever the update payload contains any of `address`/`city`/`state`/`zip` AND no explicit `latitude`/`longitude` (the geocode write-back path).
**Enforced by**: spec hook — fires for every `customerCrud.update` caller (routers, services, jobs). Previously enforced by convention in `business.updateCustomerContact`, which is now deleted; the hook is now the only enforcement point.

## Anti-patterns

- **Reading `customers.pipeline` raw in a UI query.** Use `derivedPipelineSql()` for the 5-bucket classification.
- **Exposing `customers.phone` in an agent-facing query without `gatedPhoneSql`.** The phone leaks. Always swap for the helper at the SQL boundary.
- **Hardcoding `status === 'sent'` for phone-unlock UI logic.** Use `hasSentProposal` (the boolean computed by `hasSentProposalSql`) — it already encodes the threshold.
- **Storing computed `isSigned` on the customer row.** Always derive via `isSignedCustomerSql` (or check projects directly).
- **Setting `pipelineStage` on a customer that has meetings.** It's meaningless for non-leads.
- **Writing to `customerProfileJSONDeprecated` / `propertyProfileJSONDeprecated` / `financialProfileJSONDeprecated`.** Frozen Wave-1 blobs, zero writers, dropped next release. Patch the real columns via `upsertCustomerProfile` (`age` via `customerCrud.update`) — see `#three-jsonb-profiles`.
- **Reading `customer.triggerEvent` (or any profile-trio field) straight off a bare `Customer` row.** Those fields live on the `customer_profiles` child table now — use the composed `CustomerWithProfile` type (flattened-spread joined) or `CustomerProfileRow | null`, never a `Partial` spread off `Customer` that would compile even when the join is missing.
- **Bypassing the senior-age path mismatch.** Customer profile = bucket; contract flow = precise number. Pick the right helper.

## See also

- [`../proposals/DOCS.md`](../proposals/DOCS.md) — proposal lifecycle, phone-gating trigger (`sent` status), CSLB senior threshold
- [`../meetings/DOCS.md`](../meetings/DOCS.md) (when written) — meeting participation is the visibility bridge
- [`../projects/DOCS.md`](../projects/DOCS.md) (when written) — projects = signed customer
- [`../lead-sources/DOCS.md`](../lead-sources/DOCS.md) (when written) — attribution + segment classification (shares `customers.pipeline` semantics)
- `memory/feedback-phone-visibility-threshold.md` — recent threshold-vs-equality fix
- `docs/codebase-conventions/dal-conventions.md` — DAL conventions
- `docs/codebase-conventions/jsonb-columns.md#never-shallow-merge-nested` — JSONB merge-safety mechanics; `leadMetaJSON` is the sole remaining registration (the profile trio at `#three-jsonb-profiles` decomposed to a child table in Addendum B and never merged)
- ADR-0005 — JSONB vs column vs child table (superseded for the profile trio by Addendum B §10 of the decomposition-program design doc; `age` and lead-attribution fields still apply)
