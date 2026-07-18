# Derived Values — Snapshot / Cache / Just-in-Time

Any value that is a pure function of other stored data is a **derived value**. The default is: don't store it — compute it just-in-time from a single canonical helper. Persisting one is a deliberate exception with exactly two sanctioned forms (**snapshot** and **cache column**), each with its own discipline. Ratified 2026-07-17 (during the Wave-2 cutover); supersedes the old blanket "never persist derived values" rule. The proposal-specific canonical case is `src/shared/entities/proposals/DOCS.md#final-tcp-derived`; schema-level placement rationale is [ADR-0005](../adr/0005-jsonb-vs-column-vs-child-table.md).

## Rules

### persist-vs-derive-decision

For any candidate value, ask in order — the first "yes" decides:

1. **Is it a business fact frozen at an event** (contract total at signing, `kind` at insert, intake payload at capture)? → Persist as a **snapshot** (see `#snapshot-discipline`). It stops being "derived" the moment it's agreed or captured — recomputing it later would be a bug, not freshness.
2. **Does SQL itself need it** — sort / filter / paginate / aggregate across many rows, where hydrating every row to compute is incoherent? → Persist as a **cache column** (see `#cache-column-discipline`).
3. **Everything else** → derive just-in-time via a pure helper in `src/shared/entities/<domain>/lib/`. Detail pages, PDFs, AI summaries, external-payload builders that already hold hydrated inputs get the helper, never a stored copy.

Postgres can't rescue you from #2: generated columns are immutable + same-row-only (no cross-table rollups), and materialized views are stale between refreshes — a fresh-on-write cross-table rollup must be an application-maintained column.

**Why**: a persisted derived value IS a cache; the question is never "is it derivable" but "who invalidates it, and can SQL live without it."
**Reference impl**: `proposals.final_tcp_cents` (criterion 2; becomes a snapshot at signature via the freeze gate) vs `computeFinalTcp` JIT consumers (PDF, Zoho context, AI summary).
**Enforced by**: convention + review

### snapshot-discipline

A snapshot is named for the **event**, not the derivation (`approvedAmount`, `captureJSON` — never `calculatedTotal`), is written by a single event handler at the moment the fact becomes true, and is never recomputed. Later changes to its inputs must NOT propagate.

**Why**: a contract total must reproduce March's math after April's rate change; tracking inputs would silently rewrite an agreed number.
**Reference impl**: `customer_lead_attribution.capture_json` (immutable intake snapshot), `proposals.kind` (frozen from the meeting at insert).
**Enforced by**: convention (freeze gates where the snapshot transitions from a cache, e.g. `proposal_frozen` via `isProposalFrozen`)

### cache-column-discipline

A cache column requires all four legs, or it doesn't ship:

1. **Single-writer chokepoint** — one function recomputes and writes it; every mutation path routes through it (entity-server hooks / DAL). Raw `db.update` bypasses are forbidden (see `dal-conventions.md`).
2. **One pure function** — the math exists once, in the entity's `lib/` helper; the column is a materialization of that function, never a second implementation of the formula.
3. **Rebuildable** — a maintenance script can recompute the column for all rows from source data, so drift is detectable and repairable, never silent.
4. **Versioned** — a `calc_version`-style stamp records which formula wrote the value, enabling targeted rebuilds after formula changes.

**Why**: the known failure mode of denormalized rollups is a write path that skips the recompute — the four legs make that impossible to miss (1), impossible to fork (2), cheap to repair (3), and safe to evolve (4).
**Reference impl**: `recomputeProposalFinancials` (`src/shared/entities/proposals/dal/server/mutations.ts`) + `computeFinalTcp` + `scripts/recompute-final-tcp.ts` (leg 3 — drift detect via `--dry-run`, repair only through the chokepoint) + `proposals.calc_version`.
**Enforced by**: convention + review (naming smell: verb-past-tense columns like `calculatedTotal` signal a cache missing its discipline)
