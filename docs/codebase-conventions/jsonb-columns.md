# JSONB Column Conventions

When to reach for JSONB, how to shape the document, how to validate it at the write
boundary, how to merge it safely, and how to evolve it. **The *why* (the three-way
placement rule + promotion ladder) is ADR-0005** — this file is the operational rules.

JSONB columns in this codebase carry typed domain blobs (`contextJSON`, `flowStateJSON`,
`formMetaJSON`, `projectJSON`, `fundingJSON`, `formConfigJSON`, …). Their
Zod schemas live in `src/shared/entities/<domain>/schemas/index.ts`. (The customer profile
trio — `customerProfileJSON` / `propertyProfileJSON` / `financialProfileJSON` — was
decomposed to plain columns in Wave 1 of epic #256; see
`src/shared/entities/customers/DOCS.md#three-jsonb-profiles`. `leadMetaJSON` was frozen and
split into the `customer_lead_attribution` 1:1 child + `customer_enrichment` dynamic-key rows
in Wave 2; see `src/shared/entities/customers/DOCS.md#lead-attribution-child`.)

## Rules

### placement-rule-column-vs-jsonb-vs-child

Before adding a field to any JSONB column, run the three-way test from ADR-0005:
**column** if you filter/sort/join/GROUP BY/range on it, or it gates a
FK/UNIQUE/CHECK/ENUM/NOT NULL invariant, or it's dense (≥ ~1/80 rows); **JSONB** if
sparse, heterogeneous, fetched-whole, or searched by containment; **child table** if it's
a collection with its own lifecycle or you aggregate across rows.

**Hard line**: anything in `ORDER BY`, a range predicate, or `GROUP BY` must not live
**only** in JSONB. This is what forced `final_tcp` back out into a SQL-derived value.

**Why**: JSONB was drifting into a dumping ground for hot fields it can't index or
constrain (ADR-0005 context).
**Reference impl**: `#final-tcp-derived` in `src/shared/entities/proposals/DOCS.md`.
**Enforced by**: the pre-change checklist below + PR review.

### sub-entity-decision-tree

For a **cohesive one-to-one field cluster** being pulled off a table, the three-way
test above isn't specific enough — it only distinguishes column/JSONB/child-table
for collections. Run this checklist (Addendum B, spec §10; ADR-0005 amended
2026-07-14) before defaulting a 1:1 cluster to "nullable columns on the parent":

1. **Is it a named domain concept?** A noun in `docs/domain/ubiquitous-language.md`
   — not just "fields we happened to collect at the same intake step." If no →
   columns on the parent, stop here.
2. **Does it differ from the parent in ≥1 structural way?**
   - **Optionality** — row-exists carries business meaning ("has this data been
     collected")
   - **Permission boundary** — different actors write it than write the parent
     (wants its own CASL subject)
   - **Lifecycle** — written by a different actor OR at a different trigger/time
     than the parent (a differently-named setter with the same actor+trigger does
     NOT count)
   - **Growth trajectory** — documented pressure to collect more data per item
   - **Future references** — other entities will plausibly FK to it

   None apply → columns on parent (DDD embedded value / tiny same-actor cluster).
   ≥1 applies → own table.
3. **Pick the shape by cardinality**:
   - **1:1** → child table, PK-as-FK (`parent_id uuid PRIMARY KEY REFERENCES …
     ON DELETE CASCADE`). Reads: flattened-spread leftJoin, composed type
     exported. Writes: lazy upsert (`upsertOneToOne`, see
     `dal-conventions.md#one-to-one-child-tables`) when row-existence is
     semantic, eager (parent-create transaction) when every parent must have
     one. Own CASL subject.
   - **1:many / summed / filtered** → child table, own PK + FK (+ `position`
     when ordered). Reads: batch-fetch (`inArray`). NO CASL subject or router
     unless it has its own verbs.
   - **Dynamic-key map** → child table, `UNIQUE(parent_id, key)`.

**The smell test**: if the cluster needs a TypeScript constant to re-group a
table's own columns (a `*_COLUMN_KEYS` array driving permissions or patch
schemas), that's domain structure being hand-maintained in a second place — it
wanted to be a table. (Display/form section metadata, e.g. `*_PROFILE_FIELDS`,
is fine — sections within one concept are a UI concern, not a structural
difference.)

**Sanctioned JSONB categories** (unaffected by this rule — these were never 1:1
clusters headed for column promotion): whole-document flow state; immutable
capture snapshots; per-feature config; identity-free value arrays replaced whole
and never SQL-queried, each with a documented promotion trigger
(`additionalPainPoints` — promotes the day pain points need identity, FKs, or
per-item updates).

**Why**: the customer profile trio was promoted to nullable columns on
`customers` in the original Wave-1 verdict; review of that build surfaced that
the `*_COLUMN_KEYS` constants needed to re-group those columns were themselves
the smell — the trio is a named domain concept with real optionality and
permission-boundary differences from `customers`. Reworked into
`customer_profiles`, a 1:1 child table.
**Reference impl**: `src/shared/db/schema/customer-profiles.ts`;
`src/shared/entities/customers/DOCS.md#three-jsonb-profiles`.
**Enforced by**: convention + PR review; mechanism detailed at
`dal-conventions.md#one-to-one-child-tables`.

**See also**: ADR-0005 (amended 2026-07-14) for the *why*;
`docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` §10
(Addendum B) for the full rationale and research trail.

### flat-over-nested

Prefer a flat document over deep nesting. One or two levels max. Deep nesting makes
partial updates fragile (`#never-shallow-merge-nested`), path indexes verbose, and Zod
schemas hard to read.

### keep-docs-small

Keep a JSONB document under ~2 KB. Past Postgres's TOAST threshold the value is compressed
and stored out-of-line, adding a fetch on every read of the parent row. Large, growing
collections are the signal you wanted a **child table**, not a fatter blob.

### arrays-of-objects-vs-keyed-objects

- **Array of objects** when order matters or items have no stable natural key
  (`beforeAfterPairsJSON`, `sow[]`).
- **Keyed object** (`{ [id]: {...} }`) when you address items by a stable key and want
  O(1) partial updates. Keyed objects deep-merge cleanly per-key (this is how funnel
  `source.enrichment` works); arrays replace wholesale.
- If you query *into* the array in SQL, aggregate it, or give elements their own lifecycle
  → **child table**.

### mandatory-schema-version

Every **persistent domain blob** carries a `_v` (schema version) integer, starting at `1`,
incremented on every breaking shape change. It lives in the Zod schema and is written on
every persist.

**Why**: without a version stamp, expand-and-contract migrations (`#evolution-playbook`)
can't tell old-shape rows from new-shape rows. (Existing blobs predate this rule — add
`_v` the next time each schema is touched.)
**Enforced by**: Zod schema (`_v: z.number().int()`) + review.

### one-canonical-key-per-concept

A concept has exactly one key name across all JSONB blobs. Don't spell the same thing
`phone` here and `phoneNumber` there. Reuse the term from `docs/domain/ubiquitous-language.md`.

### zod-parse-at-write-boundary

`.$type<T>()` on a Drizzle JSONB column is **compile-time only — a no-op at runtime.** It
casts the TypeScript type and provides **zero** runtime validation; malformed data reaches
Postgres unchecked. Therefore: **every JSONB write MUST be Zod-parsed at the write
boundary.** No exceptions. For entities on `createCrudDal`, this is structural (the spec's
insert/update schema parse). For bespoke `db.insert/update` paths, add an explicit
`.parse()`. Where cheap, back a discriminator/shape with a Postgres `CHECK` as a
second line the DB enforces regardless of write path.

**Reference impl**: JSONB Zod schemas in `src/shared/entities/<domain>/schemas/index.ts`.
**Enforced by**: DAL/service write path (Zod parse) + optional Postgres CHECK.

### never-shallow-merge-nested

**Mechanism deleted (Wave 2, epic #256).** `spec.update.jsonbMergeColumns`, the
`create-crud-dal.ts:buildUpdateSet` merge branch, and the scoped `jsonb_set` reference
impl (`mergeFunnelEnrichment`) no longer exist in this codebase. This section stays as
the tombstone for the hazard it used to guard against — the hazard itself is still real
Postgres behavior, it just no longer has app-level plumbing wrapped around it.

**The underlying fact doesn't go away with the mechanism**: Postgres `||` is a **shallow,
top-level-only** merge. `COALESCE(col, '{}'::jsonb) || value::jsonb` replaces any key
present in `value` wholesale; if that key's value is itself an object, its
siblings-of-siblings inside are gone, not merged. There is no row lock and no re-parse of
the merged whole — it's a single SQL expression. If you ever hand-write a `||` merge
against a JSONB column, this still applies to you.

**Replacement pattern for nested/dynamic-key data**: a child table with
`UNIQUE(parent_id, key)`, written by a plain `INSERT … ON CONFLICT (parent_id, key) DO
UPDATE` per key — there's no blob to merge into, so the shallow-merge hazard can't occur.
Reference impl: `customer_enrichment` (`UNIQUE(customer_id, step_id)`), written by
`upsertFunnelEnrichment` and `upsertLeadAttribution`
(`src/shared/entities/customers/dal/server/mutations.ts`) — this retired the former
bespoke `jsonb_set(lead_meta_json, '{source,enrichment}', ...)` entirely. See
`#sub-entity-decision-tree` for when a dynamic-key map earns a child table over a JSONB
keyed object.

**Sanctioned fallback for a future genuine key-level blob patch** (documented here, NOT
built — spec §5.1): if a column is legitimately whole-document AND a future need requires
patching one nested key atomically without a full read-modify-write, the house answer is a
single-statement `jsonb_recursive_merge(col, patch)` SQL function — a recursive
`jsonb_each`/`jsonb_typeof` walk that merges object keys and lets the patch win on
scalar/array conflicts, invoked as one SQL expression (no row lock, no app-side loop). Do
not reintroduce `jsonbMergeColumns`-style declarative config for this — write the scoped
merge SQL for that one column when the need is real.

**Reference impl**: `src/shared/entities/customers/dal/server/mutations.ts`
(`upsertFunnelEnrichment`, `upsertLeadAttribution`) — the decomposition that replaced this
mechanism; `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` §3
(Wave 2 deletion) and §5 (standardization deliverables, sanctioned fallback).
**Enforced by**: tsc (no surviving reference to the deleted config compiles); PR review for
any new hand-written `||` merge against a JSONB column.

### evolution-playbook

Change JSONB shape with **expand-and-contract**, never a big-bang rewrite:

1. **Expand** — add the new key/shape to the Zod schema as optional; bump `_v`.
2. **Dual-write** — write both old and new shapes; readers prefer new, fall back to old.
3. **Backfill** — migrate existing rows in **batches**, stamping the new `_v`.
4. **Contract** — once all rows are `_v >= N`, drop the old key + the fallback
   (**version-gated**: only after a query confirms no rows remain at the old version).

For a field being **promoted out of JSONB to a column** (ADR-0005 ladder), a **generated
`STORED` column** is the low-risk intermediate: it indexes/constrains the value while it
still physically lives in JSONB.

## Before you add or change a JSONB column — checklist

1. **Does this field belong in JSONB at all?** (`#placement-rule-column-vs-jsonb-vs-child`.)
   Filter/sort/join/GROUP BY/range → column. Gates FK/UNIQUE/CHECK/ENUM/NOT NULL → column.
   Dense (≥ ~1/80) → column. In `ORDER BY`/range/`GROUP BY` → column, hard stop.
   Collection with own lifecycle / aggregated across rows → child table. Only if none →
   JSONB.
2. **Flat and < ~2 KB?** (`#flat-over-nested`, `#keep-docs-small`.)
3. **Array-of-objects or keyed-object** per `#arrays-of-objects-vs-keyed-objects`?
4. **Has `_v`?** (`#mandatory-schema-version`.)
5. **One canonical key per concept**, matching ubiquitous-language?
6. **Zod schema exists AND is parsed at the write boundary?** `.$type<>()` alone is a
   no-op. (`#zod-parse-at-write-boundary`.)
7. **If the data has nested or dynamic-key partial updates, does it need a child table**
   (`UNIQUE(parent_id, key)` + `INSERT … ON CONFLICT`) instead of a JSONB blob? Never
   hand-write a `||` merge against a nested JSONB column. (`#never-shallow-merge-nested`.)
8. **Making an existing JSONB field hot?** Climb the promotion ladder (ADR-0005).
9. **Changing an existing shape?** Expand-and-contract with a `_v` bump.

## Anti-patterns

- Reaching for JSONB because it avoids a migration.
- Storing a sortable/filterable/groupable value only in JSONB (`#final-tcp-derived`).
- Trusting `.$type<>()` as validation (compile-time cast, runtime no-op).
- `||`-merging a nested JSONB column (shallow — deletes siblings).
- Hand-copying a hot JSONB field into a column and syncing it in app code (use a generated
  STORED column).
- A persistent domain blob with no `_v`.
- Deeply nested JSONB.

## See also

- ADR-0005 — JSONB vs Column vs Child Table (the *why*)
- `docs/codebase-conventions/database-schema.md` — column/pgEnum/timestamp conventions
- `docs/domain/ubiquitous-language.md` — canonical key names
- `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` — the full restructure
