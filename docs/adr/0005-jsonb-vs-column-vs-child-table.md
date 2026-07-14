# ADR-0005: JSONB vs Column vs Child Table — the storage-shape decision

## Status

Accepted (draft) — 2026-07-03. Supersedes ad-hoc practice; no prior ADR governed JSONB shape.

## Context

Our JSONB columns (`customerProfileJSON`, `contextJSON`, `flowStateJSON`, `formMetaJSON`,
`projectJSON`, `fundingJSON`, `leadMetaJSON`, `formConfigJSON`, …) were built
sequentially, one flow at a time, instead of designed once. Each new flow reached for
JSONB because it was the path of least resistance — no migration, no schema review — and
the shapes drifted: same concept keyed differently across blobs, hot fields buried in
JSONB where they can't be indexed or constrained, and values that appear in `ORDER BY` /
`GROUP BY` / range filters living only inside a document. `final_tcp` had to be removed
from `fundingDataSchema` and re-derived in SQL (`proposals/DOCS.md#final-tcp-derived`)
precisely because a filterable/sortable value had leaked into JSONB.

The failure mode is structural, not incidental: **there was no decision rule for where a
field belongs.** Postgres gives three homes for a piece of data — a first-class column, a
key inside a JSONB document, or a row in a child table — and each has different guarantees
for indexing, constraints, aggregation, and evolution. Without a rule, the default (JSONB)
wins by inertia and we pay for it later in un-indexable queries, missing invariants, and
shallow-merge data loss.

## Decision

Every persisted field is placed by an explicit three-way rule, and hot JSONB fields climb
a promotion ladder rather than being copied out by hand.

### The placement rule — column vs JSONB vs child table

**Promote to a first-class COLUMN if ANY of these is true:**
- You **filter, sort, join, GROUP BY, or range-scan** on it. Corollary (non-negotiable):
  *anything that appears in `ORDER BY`, a range predicate, or `GROUP BY` must not live
  only in JSONB.*
- It **gates an invariant** the database should enforce: FK, `UNIQUE`, `CHECK`, `ENUM`,
  `NOT NULL`.
- It is dense — **present on roughly ≥ 1 in 80 rows** (Heap's density heuristic). Below
  that density the column is mostly NULL and JSONB's sparseness wins; above it, a column
  pays for itself in query planning and storage.

**Keep in JSONB when the field is:**
- **Sparse** (present on a small, unpredictable subset of rows),
- **Heterogeneous** (shape varies by row — different form kinds, different lead sources),
- **Fetched whole** (you read the entire blob with its parent row and never query *into*
  it in SQL), or
- **Searched by containment** on a long tail (`@>`, key-exists) rather than by
  equality/range on a known column.

**Split into a CHILD TABLE when the data is:**
- A **collection with its own lifecycle** (rows created/updated/deleted independently of
  the parent — e.g. participants, line items, events), or
- Something you **aggregate across rows** (`SUM`, `COUNT`, per-row `GROUP BY`). Arrays of
  objects in JSONB cannot be indexed or aggregated per-element without unnesting on every
  query.

### The promotion ladder

When a field currently in JSONB becomes hot, climb the cheapest rung that satisfies the
need — don't jump straight to a full column migration:

1. **Expression / GIN index on the JSONB path** — zero schema change. Use a **GIN index
   only for ad-hoc containment / key-exists** queries over unknown paths. Use
   `jsonb_path_ops` when the query paths are **stable and you never need key-exists**
   (smaller, faster, containment-only). For a *known, single* hot field, skip GIN — a
   btree expression index or the next rung beats it.
2. **Generated `STORED` column** derived from the JSONB path — the **default first move
   for a known hot derived field.** A real, indexable, constrainable column that stays
   automatically in sync with the JSONB source, with no application write path to change
   and no backfill. Beats a GIN index for known fields.
3. **Full first-class column** — when the field also needs to be *written* independently
   of the blob, or carry a DB constraint the generated column can't (e.g. `UNIQUE`, FK).
   Reached via expand-and-contract (see `jsonb-columns.md#evolution-playbook`), using the
   generated column from rung 2 as the low-risk intermediate.

## Considered alternatives

- **Keep the "reach for JSONB by default" status quo.** Rejected: it produced the exact
  drift this ADR exists to stop — un-indexable hot fields, leaked sortable values
  (`final_tcp`), inconsistent keys.
- **Ban JSONB; everything is a column or child table.** Rejected: sparse, heterogeneous,
  fetched-whole profiling data (`customerProfileJSON` etc.) is genuinely document-shaped.
  Forcing it into wide, mostly-NULL column sets or over-normalized satellite tables is
  worse — that's what JSONB is for.
- **Copy hot fields out of JSONB into columns by hand and keep both in sync in
  application code.** Rejected: dual-write drift. The generated `STORED` column (ladder
  rung 2) gives the same indexability with the database maintaining sync — no app code, no
  drift.
- **Always GIN-index the whole JSONB column "just in case."** Rejected: GIN is for ad-hoc
  containment over unknown paths; for a single known hot field it's larger and slower than
  an expression index or generated column, and it doesn't give you constraints or
  sort-friendliness.

## Consequences

- New fields get placed by rule, in review, at design time — not discovered as
  un-indexable six flows later.
- Hot JSONB fields have a graduated, low-risk escape path (index → generated column → full
  column) instead of a risky hand-migration.
- JSONB is reserved for what it's good at (sparse, heterogeneous, whole-blob), which keeps
  documents small and merge-safe.
- The operational rules (JSONB internal shape, runtime validation, merge safety, migration
  steps, and the pre-change checklist) live in
  `docs/codebase-conventions/jsonb-columns.md`; this ADR is the *why*.

## Amended 2026-07-14 (Wave 1, epic #256) — The Sub-Entity Standard

Ratified by Oliver after a 6-agent research program (requirements extraction, app-wide
sub-entity inventory, industry research, in-stack DX prototype, 2 adversarial critics),
triggered by his review of the Wave-1 wide-table build (PR #260): "the `*_COLUMN_KEYS`
constants re-encode a boundary that should be structural."

**Supersedes this ADR's prior one-to-one default.** The placement rule above only ever
gave two answers for a field cluster — COLUMN or CHILD TABLE-for-collections — so a
cohesive **one-to-one** cluster always fell through to "promote to columns on the
parent" by omission. That default is wrong when the cluster is a named domain concept
with its own structural shape. This amendment adds the missing third answer.

**The rule**: a cohesive field cluster becomes its own table when it is a **named
domain concept** (a noun in the ubiquitous language) AND differs from its parent in
≥1 structural way:

1. **Optionality** — row-exists carries business meaning ("discovery data has been
   collected")
2. **Permission boundary** — different actors write it than write the parent (own
   CASL subject)
3. **Lifecycle** — written by a **different actor or at a different trigger/time**
   than the parent (a differently-named setter with the same actor+trigger does NOT
   count)
4. **Growth trajectory** — documented pressure to collect more data per item
5. **Future references** — other entities will plausibly point at it

Shape by cardinality:

- **1:1 cluster** → child table, **PK-as-FK** (`parent_id uuid PRIMARY KEY
  REFERENCES … ON DELETE CASCADE` — house precedent `voip_campaign_contacts`).
  Reads: **flattened-spread leftJoin** in the owning DAL, composed type exported.
  Writes: single-statement lazy upsert (`INSERT … ON CONFLICT (parent_id) DO
  UPDATE`) when row-existence is semantic, eager (parent-create transaction) when
  every parent must have one. Own CASL subject.
- **1:many repeating group / anything SUMmed or filtered** → child table, own PK +
  FK (+ `position` when ordered). Reads: batch-fetch idiom (`inArray`), NO CASL
  subject or router unless it has its own verbs.
- **Dynamic-key map** → child table with `UNIQUE(parent_id, key)`.

Stays as columns on the parent: clusters sharing ALL structural characteristics with
the parent (DDD embedded value), tiny clusters (~≤4 fields) with the same
actor+trigger, and any field whose writers/readers are structurally parent-coupled.

Stays JSONB (sanctioned, unchanged by this amendment): true whole-document flow
state; immutable capture snapshots; per-feature config; **identity-free value
arrays replaced whole and never SQL-queried** — each such array carries a
documented promotion trigger for the day it needs identity, FKs, or per-item
updates (e.g. `additionalPainPoints`, promotes the day pain points need identity).
Typed financial line items are never JSONB.

**The smell test (codified)**: if a table needs a TypeScript constant to re-group
its own columns (a `*_COLUMN_KEYS` array driving permissions or patch schemas), the
group is domain structure being hand-maintained in a second place — it wanted to be
a table. (Display/form section metadata, e.g. `*_PROFILE_FIELDS`, is fine — sections
within one concept are a UI concern, not a permission or lifecycle boundary.)

**Reference impl**: `customer_profiles` (Wave 1 rework, epic #259) —
`src/shared/db/schema/customer-profiles.ts`. The 23 sales-discovery/property/
financial fields decomposed off `customers` into a 1:1 child table; `age` stays a
plain column on `customers` — it fails all five criteria (same actor, same
trigger, identity-adjacent, read by legal envelope rules structurally coupled to
the parent row).

Full rule text, cardinality shapes, and the write/read mechanism (`upsertOneToOne`
helper + hand-written business-DAL mutation per child) live in
`docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` §10
(Addendum B). Operational checklist:
`docs/codebase-conventions/jsonb-columns.md#sub-entity-decision-tree`. DAL
mechanism: `docs/codebase-conventions/dal-conventions.md#one-to-one-child-tables`.

## See also

- `docs/codebase-conventions/jsonb-columns.md` — operational rules + dev checklist
- `docs/codebase-conventions/database-schema.md` — column / pgEnum / timestamp conventions
- ADR-0002 — Entity Server System (the DAL/spec that applies `jsonbMergeColumns`)
- `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` — the full restructure
