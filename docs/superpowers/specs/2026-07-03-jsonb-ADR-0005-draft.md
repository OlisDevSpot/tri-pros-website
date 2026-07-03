# ADR-0005: JSONB vs Column vs Child Table — the storage-shape decision

> DRAFT — companion to `2026-07-03-jsonb-restructure-design.md` (WS-1). On approval,
> install to `docs/adr/0005-jsonb-vs-column-vs-child-table.md`.

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

## See also

- `docs/codebase-conventions/jsonb-columns.md` — operational rules + dev checklist
- `docs/codebase-conventions/database-schema.md` — column / pgEnum / timestamp conventions
- ADR-0002 — Entity Server System (the DAL/spec that applies `jsonbMergeColumns`)
- `docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` — the full restructure
