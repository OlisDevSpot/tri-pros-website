# JSONB Restructure — Unified Design Spec

> Status: **design + proposal (no code written)**. Date: 2026-07-03.
> Method: parallel-agent research (4 external + 1 internal audit) → parallel-agent
> per-workstream design (7 agents total), each grounded in code and adversarially
> reconciled. Every "documented fact" below was verified against code this session.
> Scope: all JSONB columns across the CRM, the generic CRUD merge seam, and the
> `lead_meta` extraction — reconciled with the existing
> `2026-06-27-funnel-data-capture-unified-design.md`.

---

## 0. TL;DR

The starting worry ("all our JSONB columns are misconfigured") is **mostly false**.
~23 JSONB columns exist; the majority are correctly-shaped sparse blobs that are
fetched whole and never queried — exactly what JSONB is for. The real problems are
**concentrated and independent**:

1. **Write-integrity** — the generic CRUD merge is a shallow `||` that silently
   deletes sibling keys on partial nested updates. App-wide hazard. (WS-2)
2. **A few genuinely-queryable fields buried in JSONB** with no indexes. (WS-3)
3. **Validation gaps** — `.$type<>()` is compile-time only; several columns have no
   runtime Zod at the write boundary. (WS-4)
4. **Incoherent lead-metadata home** — attribution split across `customers` columns
   *and* `leadMetaJSON`; the fat `source` union is a merge-hazard magnet. (WS-5)
5. **No governance rule** — columns grew sequentially with no "column vs JSONB vs
   child table" decision rule, so drift was inevitable. (WS-1)

The single decision rule everything collapses to: **normalized columns are the
default; JSONB is an extension point.** Anything you filter / sort / join / GROUP BY
/ range on, or that gates an invariant, gets promoted (ideally to a generated STORED
column). JSONB keeps the sparse, heterogeneous, fetched-whole, search-by-containment
long tail.

This spec covers **WS-1 through WS-5** in implementable detail. The
`2026-06-27` funnel-capture unification (`funnelSync` + FIELD_MAP + phone-dedup) is
reconciled here as a **downstream implementation** of these primitives (§8), with its
own follow-on epic — not absorbed into this spec.

---

## 1. Context & method

JSONB columns were "built sequentially instead of thought through once." Each new
flow reached for JSONB because it avoided a migration; shapes drifted. `final_tcp`
already had to be pulled out of `fundingDataSchema` and re-derived in SQL because a
sortable value had leaked into a blob (`proposals/DOCS.md#final-tcp-derived`) — the
canonical symptom.

Research (external, current sources — EDB/Ringer, Heap, AWS, Crunchy, richyen,
pganalyze) + an internal audit established the decision rule and the promotion ladder.
Per-workstream design agents then grounded each fix in code. This document is the
synthesis.

### 1.1 The decision rule (full statement in ADR-0005)

- **Column** if you filter/sort/join/GROUP BY/range on it, OR it gates a
  FK/UNIQUE/CHECK/ENUM/NOT NULL invariant, OR it's dense (present on ≥ ~1/80 rows —
  Heap's density heuristic). **Hard line:** anything in `ORDER BY`, a range predicate,
  or `GROUP BY` must not live *only* in JSONB.
- **JSONB** if sparse, heterogeneous (shape varies by row), fetched-whole, or searched
  by containment (`@>`, key-exists).
- **Child table** if it's a collection with its own lifecycle, or you aggregate across
  rows.

### 1.2 The promotion ladder (climb the cheapest rung that satisfies the need)

1. **Expression / GIN index** on the JSONB path — zero schema change. GIN only for
   ad-hoc containment / key-exists (`jsonb_path_ops` when paths are stable and
   key-exists isn't needed; smaller, containment-only).
2. **Generated `STORED` column** derived from the JSONB path — the default first move
   for a *known* hot derived field. Real, indexable, planner-statistics-bearing column
   that stays auto-synced with the JSONB source. Beats GIN for known fields
   (richyen: ~0.11ms vs 0.19ms equality; GIN 6–10× larger, ~2× slower writes).
3. **Full first-class column** — when the field must be *written* independently of the
   blob or carry a constraint a generated column can't (UNIQUE/FK). Reached via
   expand-and-contract, using the generated column as the low-risk intermediate.

---

## 2. Ground-truth audit (verified 2026-07-03)

~23 JSONB columns. Classification against the rule:

| Category | Columns | Verdict |
|---|---|---|
| **Correctly JSONB** (sparse, fetched-whole, never queried) | `customerProfileJSON`, `propertyProfileJSON`, `financialProfileJSON`, `flowStateJSON`, `contextJSON`, `formMetaJSON` | Leave shape; add governance (versioning, Zod-at-boundary, CHECK) |
| **Promotion candidates** (queried in SQL, no indexes) | `fundingJSON.data.startingTcp`, `flowStateJSON.dealStructure.mode` | WS-3 generated columns |
| **Write-integrity hazard** (app-wide) | shallow `||` in `create-crud-dal.ts:148` | WS-2 |
| **Validation gaps** (`.$type` only, no runtime Zod) | `projects.hoRequirements`/`beforeAfterPairsJSON`, `scopes.homeArea`, `media_files.tags`/`optimizationVariants`, `variables.options`, `activities.metaJSON`, `x_project_scopes.variablesData` | WS-4 |
| **Incoherent lead home** | `leadMetaJSON` + `customers.leadSourceId` + `customers.originCampaign`-in-blob | WS-5 (`lead_meta` table) |

### 2.1 Bugs & stale refs discovered (fix as part of this work)

1. **🐛 Live bug** — `get-action-queue.ts:125` reads `projectJSON->'data'->'trade'->>'label'`;
   `projectDataSchema` has **no** top-level `data.trade` (only `sow[].trade`). Every
   `ActionItem.trade` in the agent action queue has been silently **NULL**. (WS-3 fixes.)
2. **⚠️ Stale docs** — `create-crud-dal.ts:96-114` docstring, `proposals/DOCS.md:96`,
   `src/trpc/DOCS.md:260` describe the merge as shallow `COALESCE || ` (or as deep when
   the code is shallow). Correct as part of WS-2.
3. **⚠️ Stale MEMORY.md + handoff** — meeting JSONB columns are `contextJSON` /
   `flowStateJSON`, NOT `situationProfileJSON` / `programDataJSON` (which exist nowhere).
   Fix `memory/MEMORY.md` and `2026-06-27-jsonb-deep-merge-handoff.md:69`.
4. **⚠️ Rule violation** — `manage-project.ts:35` sets `updatedAt` manually
   (`schema-helpers` already has `.$onUpdate()`). Drop it (WS-4 touches this file).
5. **Dead column** — `x_project_scopes.variablesData` has zero writers. Drop it (WS-4).
6. **Authored-but-unwired** — `activities.metaJSON` has an `activityMetaSchemas` union
   defined but the write path validates only `z.record(z.string(), z.unknown())`. Wire it (WS-4).
7. **Semantic** — `leadMetaJSON.source.kind` is a payload-shape discriminant
   (bina/funnel/generic), NOT lead-source identity. True lead-source rollups use the
   `leadSourceId` FK (moving into `lead_meta` in WS-5).

---

## 3. WS-1 — Governance (ADR-0005 + jsonb-columns.md)

**Risk: none (docs). Sequence: first. Companion drafts: `ADR-0005` and
`docs/codebase-conventions/jsonb-columns.md` (attached as separate files).**

Per the `codebase-conventions/README.md` decision tree: the *why* (decision rule +
promotion ladder, with alternatives) is an **ADR**; the *what-to-do* (internal shape,
validation mandate, merge rule, migration playbook, pre-change checklist) is a **new
conventions doc**. Standard why/what split (mirrors ADR-0003 ↔ service-architecture.md).

Deliverables:
- **`docs/adr/0005-jsonb-vs-column-vs-child-table.md`** — decision rule + promotion
  ladder + considered alternatives.
- **`docs/codebase-conventions/jsonb-columns.md`** — 8 slug-anchored rules
  (`placement-rule-column-vs-jsonb-vs-child`, `flat-over-nested`, `keep-docs-small`,
  `arrays-of-objects-vs-keyed-objects`, `mandatory-schema-version`,
  `one-canonical-key-per-concept`, `zod-parse-at-write-boundary`,
  `never-shallow-merge-nested`, `evolution-playbook`) + a 9-step pre-change checklist +
  anti-patterns.
- Cross-links into 8 existing DOCS.md files (proposals, customers, meetings, projects
  DOCS.md; database-schema.md, dal-conventions.md, src/trpc/DOCS.md; thin the
  MEMORY.md merge entry to reflection+link).
- **`_v` (schema version) is net-new** — no blob carries it today. Rule: "add `_v`
  the next time each schema is touched," not a big-bang add.

The merge-safety rule codifies the WS-2 nuance: **deep-merge only for
additive-partial writers; full-replace for whole-document writers** (see §4.5).

---

## 4. WS-2 — Write-integrity: app-side atomic deep-merge

**Risk: medium (shared DAL). Sequence: early — the SHARED KEYSTONE both this
restructure and the funnel-capture unification depend on. Reconciles with and
supersedes-by-building-on `2026-06-27-jsonb-deep-merge-implementation-plan.md`
(agrees; adds merged-whole validation). No schema migration.**

### 4.1 Hard rule

An update to a JSONB merge column must **never delete data that wasn't in the
payload**. It may only upsert the portions the payload carries, recursively at every
depth. Today `create-crud-dal.ts:148` emits shallow `COALESCE(col,'{}') || value`, so a
partial *nested* payload silently drops siblings.

### 4.2 Pure merge function (the test surface)

New `src/shared/dal/server/lib/deep-merge-jsonb.ts` (no `db` import, unit-testable):

```ts
export function deepMergeJsonb(
  current: unknown,
  patch: Record<string, unknown>,
): Record<string, unknown>
```

Semantics per key `k` in `patch`:
- both `current[k]` and `patch[k]` plain objects (not array, not null) → **recurse**
- otherwise → take `patch[k]` (replaces arrays, scalars, `null`, or type-mismatch)
- keys in `current` absent from `patch` → **preserved** (the hard rule)
- `patch[k] === undefined` → skip (never write undefined)

Non-mutating (fresh object per level) so the locked snapshot isn't aliased (it doubles
as the after-hook's `previousRow`).

### 4.3 Array decision — replace wholesale (justified)

Every array in a merge-column schema is a **full-list-submitting UI field** (`sow[]`,
`additionalPainPoints[]`, `requestedTrades[]`) — dropping an item and resubmitting must
delete it, not merge it back. The **one additive case** (`source.enrichment`) is an
**object-map keyed by dimension, not an array**, so recursion gives per-key upsert for
free. This is why array-replace is safe.

### 4.4 CRUD integration (`create-crud-dal.ts`)

- `buildUpdateSet` → **`buildMergedUpdateData`**: no `sql` fragments; given the locked
  current row, returns a plain `.set()` object. Non-merge keys pass through (so scalar
  columns and merged JSONB write in **one statement**). Merge-column object value →
  `deepMergeJsonb(currentRow[k] ?? {}, value)` then **re-validate the merged whole**.
- **Merged-whole Zod validation** (strengthening over the prior plan): after merge,
  parse each merged column with `spec.schemas.update.shape[key]` (the update schema is
  `insert.partial()`, so `shape[key]` is that column's own schema). Closes the gap where
  a merge produces a discriminated-union shape the patch-level parse never saw. The
  object written to Postgres is always schema-valid.
- `updateImpl` — two paths:
  - **Fast path** (no merge-column key present): unchanged single `UPDATE … RETURNING`.
    All scalar updates + the 9 voip entities stay cheap.
  - **Merge path** (≥1 merge-column key): `db.transaction` →
    `SELECT … WHERE pk=id AND <scope> FOR UPDATE` → `buildMergedUpdateData` →
    `UPDATE … RETURNING` → after-hook with `previousRow = currentRow`. The locked read
    **doubles as** `previousRow`, so the merge path adds **net-zero** round-trips for
    entities that already read previousRow for an after-hook (e.g. customers).

### 4.5 `jsonbMergeColumns` config stays; meetings stay full-replace

The opt-in list (`spec.update.jsonbMergeColumns`) is **kept** — its meaning changes from
"shallow `||`" to "deep-merge." It's the deep-merge-vs-full-replace switch, and
full-replace is a legitimate mode we must preserve.

**Meetings (`contextJSON`/`flowStateJSON`) deliberately stay OUT of the list.** They're
written as *whole documents* by the flow UI; for a whole-document writer, deep-merge
would **resurrect keys the user deliberately removed** (deselecting a scope, clearing a
program branch) — a correctness bug worse than the current behavior. Governance rule
(WS-1): **a column joins `jsonbMergeColumns` only when its writers are
additive-partial.**

### 4.6 Funnel bypass (Phase 2, gated)

`mergeFunnelEnrichment` (bespoke `jsonb_set` at `{source,enrichment}`) exists only to
dodge the shallow `||`. After WS-2 the `{source,enrichment}` nesting is safe on the
generic path. **Phase 1: leave `mergeFunnelEnrichment` in place** (still correct).
**Phase 2** (gated on the side-effect decision): route `enrichFunnelLead` through
generic CRUD and delete the bypass — blocker is the customer `update.after` GCal hook
firing per enrichment step; resolve by **self-gating the after-hook** on whether a
GCal-relevant field changed (meetings' after-hook already does this). *Note: WS-5 makes
this partly moot — enrichment moves to `lead_meta.source_data`, which has no GCal hook.*

### 4.7 Test strategy

Repo has **no test runner**. The pure `deepMergeJsonb` is the durable regression guard.
**Decision: add minimal vitest** (one dev-dep, tiny config) for `deep-merge-jsonb.test.ts`
+ a manual DB smoke for the atomic/concurrent path. Cases: siblings survive; deep
nesting survives (funnel `source` case); arrays replace; explicit `null` clears; type
mismatch replaces; concurrency (two partial updates to different sub-keys of the same
row both survive — fails before `FOR UPDATE`, passes after).

### 4.8 Docs to correct (part of WS-2)

`create-crud-dal.ts:96-114` docstring; `proposals/DOCS.md:96`; `src/trpc/DOCS.md:260`;
`docs/adr/0002` (one-line: merge is app-side atomic, not `||`); new rule in
`dal-conventions.md`; fix meeting column names in MEMORY.md + the handoff doc.

---

## 5. WS-3 — Promotion (generated STORED columns)

**Risk: low (additive columns; small tables; Neon dev branches; `pnpm db:push:dev`).
Sequence: independent, after WS-1.**

### 5.1 `primary_trade` is DROPPED (modeling correction)

A proposal does **not** have a primary trade. `projectJSON.data.sow` is
`z.array(sowSchema).min(1)` — one SOW section per selected trade, produced by the
meeting flow. Trades-per-proposal are **one-to-many by design**. A scalar generated
column would encode a false 1:1; an array-of-trades generated column is **impossible**
(needs set-returning `jsonb_array_elements` + aggregate — not IMMUTABLE). The correct
one-to-many representation **already exists**: `sowSummary` + the `Trades` compound
component. Promote to a `proposal_trades(proposal_id, trade_id, trade_label)` **child
table only when a real "proposals by trade" analytics consumer lands** (YAGNI).

### 5.2 Trade query-site fixes (correctness sub-task, do regardless)

- **`get-action-queue.ts:125`** (the NULL bug): fix the path. Preferred — aggregate all
  section trades: `string_agg(DISTINCT elem->'trade'->>'label', ', ')` over
  `jsonb_array_elements(projectJSON->'data'->'sow')`. Minimal — mirror the correct deep
  path `->'data'->'sow'->0->'trade'->>'label'` and label it "first scope's trade."
- **`get-customer-profile.ts:71`** (`sow[0].trade`): functional but lossy; migrate UI
  that shows "the trades" to `sowSummary`/`Trades`; demote the scalar to an explicit
  "primary/first scope" only where a single chip is required.

### 5.3 Generated columns to add

```ts
// src/shared/db/schema/proposals.ts
startingTcp: numeric('starting_tcp', { mode: 'number' })
  .generatedAlwaysAs((): SQL => sql`(${proposals.fundingJSON}->'data'->>'startingTcp')::numeric`),
// index('proposals_starting_tcp_idx').on(table.startingTcp)

// src/shared/db/schema/meetings.ts
dealMode: text('deal_mode')
  .generatedAlwaysAs((): SQL => sql`${meetings.flowStateJSON} #>> '{dealStructure,mode}'`),
// index('meetings_deal_mode_idx').on(table.dealMode)
```

- **`starting_tcp`** — queried at `proposals/dal/server/queries.ts:159` (WHERE + ORDER
  BY, no index today). Rewrite `finalTcpExpr`'s `(fundingJSON->'data'->>'startingTcp')::numeric`
  → `COALESCE(proposals.startingTcp, 0)`. IMMUTABLE ✓.
- **`deal_mode`** — `'finance'|'cash'`, for deal-mix analytics. Not queried today;
  enables `GROUP BY deal_mode`. IMMUTABLE ✓.
- **Discount-sum** (`fundingJSON.data.incentives` where type=discount, `queries.ts:162`)
  — **CANNOT** be a generated column (set-returning + aggregate). Leave as the existing
  correlated subquery (cheap on small tables); promote to a computed-at-write real
  column only if analytics needs `GROUP BY` on it at scale. `finalTcp` itself stays a
  runtime SQL expression (depends on the array sum) — matches the "never persist derived"
  convention.
- **`lead_source_kind`** — deferred to WS-5, where `capture_channel` becomes a real
  `lead_meta` column (better than a generated column off the blob).

Migration: `ADD COLUMN … GENERATED … STORED` rewrites the table under ACCESS EXCLUSIVE;
trivial at this scale. `pnpm db:push:dev` only. Generated columns are read-only (omitted
from insert schemas automatically).

---

## 6. WS-4 — Validation gaps (Zod at the write boundary)

**Risk: low. Sequence: independent, after WS-1.**

**Cross-cutting fact:** none of these tables use `createCrudDal` — all writes are
bespoke `db.insert/update`, none Zod-parse today. "Wire the parse" = add explicit
`schema.parse()` at each bespoke boundary, not flip a spec flag.

| Column | Verdict | Action |
|---|---|---|
| `projects.beforeAfterPairsJSON` | STRICT (schema exists, unwired) | wire `beforeAfterPairsSchema.parse()` in `manage-project.ts` |
| `projects.hoRequirements` | STRICT | author `z.array(z.string())`; parse in `manage-project.ts` (also drop the manual `updatedAt` at :35) |
| `activities.metaJSON` | STRICT (union exists, unwired) | wire `activityMetaSchemas[type].parse()` at `activities.router.ts` + `google-calendar.ts:68` |
| `scopes.homeArea` | STRICT, seed-only | `z.array(z.enum(homeAreas))`; parse in seed mapper (low urgency) |
| `media_files.tags` | STRICT, seed-only | `z.array(z.enum(tags))`; parse in seed (low urgency) |
| `variables.options` | STRICT, seed-only | `z.union([z.array(z.string()), z.array(z.number())])`; parse in seed |
| `media_files.optimizationVariants` | LOOSE-OK | machine-generated by our optimize job; document "internally produced, trusted" |
| `bina_webhook_logs.payload`/`matchedTrades` | LOOSE-OK (keep loose) | raw external audit log — strict Zod would defeat forensics/replay |
| `x_project_scopes.variablesData` | DROP | dead column, zero writers |

Schemas co-locate at `entities/<domain>/schemas/index.ts` (or beside the seed for
tables without an entity home — `scopes`/`variables`; revisit when a runtime mutation
appears, YAGNI).

---

## 7. WS-5 — `lead_meta` table (the coherent lead-metadata home)

**Risk: medium (~39 references, mostly mechanical field-path swaps; a non-lossy
CAPI-field backfill that MUST be verified in a live browser before dropping the blob).
Sequence: depends on WS-2 (for `source_data.enrichment` deep-merge). This is the new
physical schema that the funnel-capture unification (§8) writes into.**

### 7.1 Decision: hybrid table, 1:many-capable

- **Real columns** for everything queried/joined/analytics/CAPI-critical.
- **Residual `source_data` JSONB** for only the genuinely heterogeneous per-source tail.
- **1:many** cardinality (`customer_id` plain FK, no unique). Today writes one row per
  lead; supports multiple rows per customer once phone-dedup lands (the funnel-capture
  plan's RESOLVED Decision 1). This **resolves that plan's open follow-on** ("two funnels
  → source collision") — each funnel touch is its own row.

### 7.2 Schema

```ts
export const leadMeta = pgTable('lead_meta', {
  id,
  customerId: uuid('customer_id').notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),   // no unique → 1:many-capable

  // ── ATTRIBUTION (real columns — the single coherent home) ──
  leadSourceId: uuid('lead_source_id').references(() => leadSourcesTable.id, { onDelete: 'set null' }),
  captureChannel: leadCaptureChannelEnum('capture_channel').notNull(), // = source.kind
  originCampaign: text('origin_campaign'),
  funnelSlug: text('funnel_slug'),
  offer: text('offer'),

  // ── UTM + META (real columns — CAPI dedup + analytics) ──
  utmSource, utmMedium, utmCampaign, utmContent, utmTerm,          // text, nullable
  fbclid: text('fbclid'), gclid: text('gclid'),
  fbp: text('fbp'), fbc: text('fbc'),                             // CAPI-critical

  // ── OPERATIONAL (real columns) ──
  mp3RecordingKey: text('mp3_recording_key'),
  closedByUserId: text('closed_by_user_id').references(() => user.id, { onDelete: 'set null' }),
  scheduledFor: timestamp('scheduled_for', { mode: 'string', withTimezone: true }),
  phoneVerificationStatus, phoneLineType, phoneCarrierName,        // text, nullable

  // ── ENVELOPE (source-agnostic; typed JSONB arrays, no merge risk) ──
  interestedTradesRaw: jsonb('interested_trades_raw').$type<string[]>(),
  requestedTrades: jsonb('requested_trades').$type<RequestedTrade[]>(),

  // ── CONSENT (real columns — audit/legal) ──
  consentAgreed: boolean('consent_agreed').default(false),
  consentAt: timestamp('consent_at', { mode: 'string', withTimezone: true }),

  // ── RESIDUAL: heterogeneous per-source tail ONLY ──
  // funnel.enrichment (progressive object-map) + bina.{budgetSolution, rebateAmount,
  // bathroom/kitchen age/size/scope}. Keyed writes via deep-merge (WS-2).
  sourceData: jsonb('source_data').$type<LeadSourceTail>(),

  createdAt, updatedAt,
})
```

`leadSourceId` and `originCampaign` **move off `customers`** into `lead_meta` — this is
what actually kills the attribution split.

### 7.3 Blast radius (verified)

~39 references / 30+ files. Writes: 3 validated create-flows (business/funnels/bina) all
through `customerCrud.create`, + 2 backfill scripts — all validated, none bespoke-unsafe.
Only ONE SQL-level touch (`mergeFunnelEnrichment`). 13 read sites; critical cluster =
VoIP/SMS (`interestedTradesRaw` → CloudTalk enrollment, SMS cadence, contact attributes)
+ Meta CAPI (`source.meta.fbp/fbc`, `source.utm`). 8 type imports, 4 schema imports.
Refactor is mechanical field-path swaps (`customer.leadMetaJSON.source.utm.campaign` →
`leadMeta.utmCampaign`).

### 7.4 CAPI safety

`fbp`, `fbc`, `fbclid`, `utm*` become **first-class columns** → strictly safer than
today (immune to the merge hazard; `derive-fbc.ts` reads a column). **Guardrail:** verify
the CAPI-field backfill non-lossy in a real browser Events-Manager test **before**
dropping the blob (`feedback-meta-pixel-verify-real-browser` — never headless).

### 7.5 Migration (expand-and-contract)

1. Create `lead_meta` + `leadCaptureChannelEnum`; add a `lead-meta` entity home + DAL +
   tRPC spec. `pnpm db:push:dev`.
2. Backfill: one SQL pass flattening `customers.leadMetaJSON` (+ `leadSourceId`) into
   `lead_meta` rows (map `source.kind`→`captureChannel`, `source.utm.*`→columns,
   `source.meta.*`→`fbp/fbc`, `source.enrichment`+bina tail→`source_data`). Clone the
   idempotent `scripts/backfill-interested-trades-raw.ts` pattern (dry-run default,
   `NODE_ENV`-targeted).
3. Rewrite the ~39 read sites (mechanical).
4. Retarget `mergeFunnelEnrichment` → `lead_meta.source_data` (`{enrichment}` path).
5. Parity-check CAPI fields in a live browser; then drop `customers.leadMetaJSON` +
   `customers.leadSourceId` last. ~2 PRs at this scale (add+dual-write+backfill; then
   flip+contract). No queue ceremony.

---

## 8. Reconciliation with the funnel-capture unification (§ downstream implementation)

The `2026-06-27-funnel-data-capture-unified-design.md` and this spec are **one
architecture viewed from two altitudes**. This spec delivers the general primitives;
the funnel plan is a **specific implementation** of them. Explicit mapping:

| Funnel-plan concept | Is an implementation of (this spec) |
|---|---|
| Decision 2 — "fix the toolkit with true recursive deep-merge" | **WS-2** (the exact `2026-06-27-jsonb-deep-merge-implementation-plan.md`, now the shared keystone) |
| Decision 1 — phone-dedup, resolve-or-create, one person = one customer | The product direction that makes **WS-5's 1:many** correct |
| Decision 1 open follow-on — "two funnels → `source` collision, needs enrichment keyed by funnel" | **Resolved by WS-5**: each funnel touch is its own `lead_meta` row |
| `FIELD_MAP` (per datum: destination column-or-JSONB-path + merge + side-effects) | Its **destination targets are WS-5's `lead_meta` columns / `source_data` paths** |
| `applyFunnelPatch` (atomic path-aware merge) | A caller of the **WS-2 deep-merge** on `lead_meta.source_data` |
| Decision 6 — sessionId storage (column vs JSONB) | Answered: a `lead_meta` column (idempotency handle per funnel touch) |
| R8 — "`source` never shallow-replaced; attribution survives every write" | Structurally guaranteed once `fbp/fbc/utm` are **WS-5 columns** |

**What this spec commits to (so the funnel epic can build on it):**
- WS-2 deep-merge lands first — the funnel plan's Decision 2 is satisfied generally.
- WS-5 `lead_meta` is designed **as the FIELD_MAP destination**: attribution/CAPI/
  operational as columns; `source_data` as the only path-aware-merge target.
- The `lead_meta` row identity (per funnel touch) is the upsert handle
  `applyFunnelPatch`/`funnelSync` will key on.

**What remains a downstream epic (NOT in this spec):** `funnelSync` + FIELD_MAP +
phone-dedup identity + collapsing the four write paths (WP1–WP4) + side-effect policy
(the plan's open Decisions 3/4/5). That epic gets its own plan, now sitting on a concrete
`lead_meta` + deep-merge foundation. **Task:** add a header note to
`2026-06-27-funnel-data-capture-unified-design.md` pointing at this spec as its schema
foundation, and mark its Decision 2 as implemented-by-WS-2.

---

## 9. Sequencing & PR breakdown

```
FOUNDATION
  WS-1 Governance docs ....................... 1 PR (docs, zero risk) — first
  WS-2 Deep-merge toolkit (KEYSTONE) ......... 1 PR + vitest for deep-merge-jsonb
        │  (fixes the app-wide hazard; unblocks funnel Decision 2)
SCHEMA RESTRUCTURE (parallel after WS-1; WS-5 also needs WS-2)
  WS-3 Promotion + trade-query fixes ......... 1 PR
  WS-4 Validation gaps + drops ............... 1 PR
  WS-5 lead_meta table ....................... 2 PRs (add+dual-write+backfill; flip+contract)
DOWNSTREAM (own epic, depends on WS-2 + WS-5)
  WS-6 funnel-capture unification ............ separate plan
```

`_v` schema-version fields get added to each blob as WS-2/WS-4/WS-5 touch its schema.
Rough total for this spec: **~6 PRs**.

---

## 10. Open items & locked defaults

Locked this session: merge = JS read-modify-write + Zod (WS-2); promotion = analytics-
forward (WS-3); leadMeta → **full `lead_meta` table, 1:many-capable** (WS-5, escalated
from the earlier "extract 4 fields"); reconcile funnel plan = **foundation-here +
downstream epic**; test runner = **minimal vitest**.

Defaults baked in (override at spec review):
- Discount-sum → defer (keep subquery). `originCampaign` → real `lead_meta` column.
- `scheduledFor` → `timestamptz` (normalize Bina's raw string to ISO-or-null).
- Funnel after-hook side-effect (WS-2 Phase 2 / funnel Decision 3) → **self-gate the
  hook** (both plans agree). Formally a funnel-epic decision; noted here.
- `proposal_trades` child table → not now (YAGNI; when an analytics consumer lands).

---

## 11. Deliverables checklist

- [ ] `docs/adr/0005-jsonb-vs-column-vs-child-table.md` (WS-1)
- [ ] `docs/codebase-conventions/jsonb-columns.md` + README row + 8 cross-links (WS-1)
- [ ] `src/shared/dal/server/lib/deep-merge-jsonb.ts` + vitest (WS-2)
- [ ] `create-crud-dal.ts` merge-path rewrite + doc corrections (WS-2)
- [ ] `proposals.starting_tcp`, `meetings.deal_mode` generated columns + indexes (WS-3)
- [ ] `get-action-queue.ts:125` NULL-bug fix + UI standardize on `sowSummary`/`Trades` (WS-3)
- [ ] Zod wiring for 6 columns; drop `variablesData`; drop manual `updatedAt` (WS-4)
- [ ] `lead_meta` table + entity home + DAL + backfill + ~39-site rewrite + blob drop (WS-5)
- [ ] Header note into the 2026-06-27 funnel plan pointing here (WS-5/§8)
- [ ] MEMORY.md fixes (meeting column names; thin the merge entry) (WS-1/WS-2)
