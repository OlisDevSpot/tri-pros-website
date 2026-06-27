# Implementation plan: app-side atomic deep-merge for entity JSONB columns

> Supersedes the offload prompt in `2026-06-27-jsonb-deep-merge-handoff.md` — this is
> the in-session design after grilling. Companion: `2026-06-27-funnel-data-capture-unified-design.md`.

## Goal / hard rule

**An update to a JSONB merge column must never delete data that wasn't in the payload.**
It may only upsert the portions the payload carries, recursively at every depth.
Today the generic CRUD merge is a **shallow** top-level `||` (`create-crud-dal.ts:148`),
so a partial *nested* payload silently drops sibling sub-keys. We make the seam a true
**deep merge**, computed **app-side**, kept **atomic** under a row lock.

This *fulfills* the documented intent — ADR-0002 (`:29`, `:75-82`) and
`proposals/DOCS.md:90-96` both already call this column behavior "deep-merge." The
implementation never matched the decision. No ADR is reopened; two docs get corrected.

## Decisions locked (from grilling)

1. **Merge semantics:** recurse into **objects**; **replace arrays and scalars wholesale**.
   No element-wise array merge (every list-editing surface already sends the full list).
   The `enrichment` Record is an object-map, so it merges per-stepId — exactly what funnel
   progressive enrichment needs.
2. **Reconciliation = (A):** deep-merge everywhere; full-document writers (proposal edit)
   keep working because they submit complete objects via RHF. Audit confirms; add a
   per-write `replace` escape hatch **only** if the audit finds a writer that clears a
   field by omission. Residual: an `.optional()`-but-not-`.nullable()` field can no longer
   be cleared by omission — clears need an explicit `null` on a `.nullable()` field.
3. **Implementation site = (b1):** the merge is a **pure TypeScript function**, run inside
   a `SELECT … FOR UPDATE` transaction in `updateImpl`. All logic app-side and unit-testable;
   the row lock removes the lost-update race (the property `mergeFunnelEnrichment` was built
   to get). No stored Postgres function. Driver confirmed: `node-postgres` + `pg.Pool`
   (`db/index.ts`) supports interactive transactions + `FOR UPDATE`; `db.transaction` is
   already used in the codebase (voip-dids, push-subscriptions, projects/media).

## Design

### 1. Pure merge function — the test surface

New file `src/shared/dal/server/lib/deep-merge-jsonb.ts` (no `db` import):

```
deepMergeJsonb(current: unknown, patch: Record<string, unknown>): Record<string, unknown>
```

Rules (per key in `patch`):
- both `current[k]` and `patch[k]` are plain objects (not array, not null) → **recurse**
- otherwise → take `patch[k]` (replaces: arrays, scalars, `null`, or when current isn't an object)
- keys present in `current` but absent from `patch` → **preserved** (this is the hard rule)
- `patch[k] === undefined` → skip (defensive; validation already strips these)

`null` at depth = set leaf to null (a scalar replace). Top-level column `null` = clear the
whole column, handled *before* the merge (unchanged from today).

### 2. `buildUpdateSet` → `buildMergedUpdateData`

Today `buildUpdateSet` emits `sql\`COALESCE(col,'{}') || …\`` fragments. It becomes a pure
function that, given the **locked current row**, returns a plain `.set()` object:
- non-merge keys pass through unchanged
- merge-column key, value `undefined` → skip
- merge-column key, value `null` → `null` (clear column)
- merge-column key, non-null **object** → `deepMergeJsonb(currentRow[k] ?? {}, value)`
- merge-column key, **array/primitive** → throw `precondition-failed` (guard preserved)

No `sql` fragments — the full merged value is computed in JS from the locked snapshot.

### 3. `updateImpl` — two paths

- **Fast path (no merge-column key in the validated payload):** unchanged — single
  `UPDATE … RETURNING`, optional unlocked `previousRow` read for the after-hook. This keeps
  all scalar updates and the 9 voip entities on the cheap single-statement path.
- **Merge path (≥1 merge-column key present):** wrap in `db.transaction`:
  1. `SELECT … WHERE pk = id AND <scope> FOR UPDATE LIMIT 1` → `currentRow`
     (zero rows → throw `not-found`, tx aborts, no write)
  2. `buildMergedUpdateData(spec, validated, currentRow)`
  3. `UPDATE … SET(merged) WHERE pk = id RETURNING` → `row`
  4. after-hook(`row`, `{ previousRow: currentRow, input }`)
     — the locked read **doubles as** `previousRow`, so the after-hook no longer needs a
     separate unlocked SELECT (consolidation).

`dalDbOperation` still wraps the whole thing; a thrown `ThrowableDalError` rolls the tx back
and maps to `DalReturn`. Scope predicate identical to today.

## Phasing

**Phase 1 — make the seam deep + atomic (this work).** No behavior is retired.
`mergeFunnelEnrichment` stays (still correct). Outcome: every existing and future partial
nested write through generic CRUD is safe; the latent meeting-flow `customerProfileJSON`
hazard is closed; docs match code.

**Phase 2 — collapse the workaround (separate, gated on the hook decision #3).**
Once Phase 1 lands, `mergeFunnelEnrichment` is a special case of the general merge. Route
`enrichFunnelLead` through `customerCrud.update`. **Blocker:** that fires customer
`update.after` (GCal `propagateCustomerChangeJob`) per enrichment dimension. Resolve first:
either (a) a typed `skipSideEffects`/`silent` option on CRUD update for metadata-only
patches, or (b) make the customer after-hook self-gate on whether a GCal-relevant field
changed (meetings `update.after` already does exactly this). Recommendation: (b). Tracked in
the unified-design doc §4 / candidate #3. Do **not** retire `mergeFunnelEnrichment` in Phase 1.

## Call-site audit (Decision 2A verification)

Confirm each registered-merge-column writer is either additive-partial (wants merge) or a
complete-object full-document write:

| Site | Column(s) | Expectation |
|---|---|---|
| `meeting-flow.router.ts:34` updateCustomerProfile | customerProfile/property/financial | additive-partial → deep merge fixes it. Verify whether it ever sends a partial `mainPainPoint` (proves active vs latent). |
| `proposals.router/contracts.router.ts:229` age write-back | customerProfileJSON | currently spreads whole; after Phase 1 can send `{ age }` only (drop the read-spread). |
| `proposals.router/contracts.router.ts:260` envelope docs | formMetaJSON | flat column; spreads whole — safe either way. |
| `proposal-flow/edit-proposal-view.tsx:86` full edit | formMeta/project/funding | full-document. **Audit:** confirm RHF submits explicit empties for cleared optionals, not omits. If any `.optional()`-non-`.nullable()` field is cleared-by-omission → that's the trigger for the Decision-2 escape hatch (B), scoped to that column only. |

## Docs to fix (staleness — part of this work)

- `docs/adr/0002-entity-server-system.md` — keep "deep-merge" wording; it's now true (add a
  one-line note that the merge is app-side atomic, not `||`).
- `src/shared/entities/proposals/DOCS.md:96` — replace the `COALESCE(col,'{}') || $value`
  description with the real mechanism (app-side recursive merge under row lock).
- `create-crud-dal.ts:96-114` docstring + the `proposals/DOCS.md#jsonb-merge-on-update`
  cross-ref.
- New rule in `docs/codebase-conventions/dal-conventions.md`: "JSONB merge columns
  deep-merge; partial nested payloads never delete siblings; arrays/scalars replace; clears
  use explicit `null` on a nullable field."

## OPEN — test strategy (need your call)

There is **no test runner** in the repo (no vitest/jest, no `test` script, no `*.test.ts`).
The pure `deepMergeJsonb` function is the natural regression guard. Options:

- **(i) Add minimal vitest** — one dev dep + tiny config; `deep-merge-jsonb.test.ts` unit-tests
  the merge rules (no DB). Durable, CI-friendly, the handoff's "can't silently regress" guard.
- **(ii) `tsx` assertion script** — zero new deps, matches existing `scripts/*.ts` pattern;
  asserts the cases and exits nonzero on failure. No DB needed for the pure function.
- **(iii) none** — verify by hand. Not recommended for a shared-DAL guarantee.

Recommendation: **(i)** for the pure function (it's the durable guarantee), plus a manual
DB smoke for the atomic/concurrent path (two overlapping partial updates both survive).

## Verification

- `pnpm tsc` + `pnpm lint` (never `pnpm build`). Schema/DB via `pnpm db:push:dev` only —
  but note **this change needs no schema migration** (no DB-side function, no column change).
- Funnel smoke: a funnel lead still accumulates enrichment across steps and
  `leadMetaJSON.source.{meta,utm}` survive every write (do-not-regress Meta loop).
- Concurrency smoke: two near-simultaneous partial updates to different sub-keys of the same
  column on the same row — both survive (proves the lock).

## Risks

- **Behavior flip (Decision 2):** omitted keys now survive. Mitigated by the audit; the only
  exposed surface is full-document forms, which submit complete objects.
- **Lock contention:** only on the merge path, only on the same row; write volumes are
  human-paced. Negligible.
- **Transaction wrapping** changes the after-hook's `previousRow` source to the locked read —
  strictly more consistent, but verify no hook relied on the old unlocked snapshot timing.
