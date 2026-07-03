# JSONB Column Conventions

When to reach for JSONB, how to shape the document, how to validate it at the write
boundary, how to merge it safely, and how to evolve it. **The *why* (the three-way
placement rule + promotion ladder) is ADR-0005** — this file is the operational rules.

JSONB columns in this codebase carry typed domain blobs (`customerProfileJSON`,
`contextJSON`, `flowStateJSON`, `formMetaJSON`, `projectJSON`, `fundingJSON`,
`leadMetaJSON`, `formConfigJSON`, …). Their Zod schemas live in
`src/shared/entities/<domain>/schemas/index.ts`.

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

Never `||` a nested JSONB column on update — Postgres `||` is a **shallow** merge and
silently deletes sibling keys of any nested object you touch. The house pattern is
**app-side recursive deep-merge under a row lock + Zod re-parse of the merged whole**,
opted-in per column via `spec.update.jsonbMergeColumns`.

**Additive-partial vs whole-document (load-bearing distinction):** a column joins
`jsonbMergeColumns` **only when its writers are additive-partial** (progressive fill — e.g.
customer profiles, funnel `source.enrichment`). **Whole-document writers must stay
full-replace** (e.g. the meeting flow's `contextJSON`/`flowStateJSON`): for them, deep-merge
would *resurrect keys the user deliberately removed*.

**Reference impl**: `#jsonb-merge-on-update` in `src/shared/entities/proposals/DOCS.md`;
`docs/superpowers/specs/2026-07-03-jsonb-restructure-design.md` §4.
**Enforced by**: `createCrudDal` merge path reading `spec.update.jsonbMergeColumns`.

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
7. **If updated with partial data, is it in `spec.update.jsonbMergeColumns`** — and is it
   an additive-partial writer (not whole-document)? Never `||`. (`#never-shallow-merge-nested`.)
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
