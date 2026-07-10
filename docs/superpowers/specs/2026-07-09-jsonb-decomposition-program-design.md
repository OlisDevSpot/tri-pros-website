# JSONB Decomposition Program — Design Spec

> **Status**: Approved design, 2026-07-09. Implementation plan to follow (writing-plans).
> **Research base** (read for all rationale, evidence, file:line refs, and sources):
> `docs/plans/2026-07-09-jsonb-research-findings-and-relational-decomposition.md`
> **Goal**: standardize the database structure on proven relational patterns, decompose the JSONB
> blobs that are relational data in disguise, delete the deep-merge machinery, and codify the
> decision framework so future schema choices are rule-driven, not ad-hoc.

## 1. Locked decisions

| Decision | Choice |
|---|---|
| Scope | Full program, three waves; each wave ships independently and the program halts safely after any wave |
| Migration safety | Branch-rehearsed cutover per blob (additive schema → parity-checked backfill → Neon-branch rehearsal → prod cutover → frozen `*_deprecated` column for one release → drop) |
| Merge machinery | Delete entirely after Wave 2 (`jsonbMergeColumns`, the three helpers, `deepMergeJsonb`, the locked-transaction branch). Sanctioned fallback for a future genuine need: single-statement `jsonb_recursive_merge` SQL, documented in conventions, not built |
| Amendment (Oliver) | `costLines[]` and `leadMeta.source` promotion are IN scope — both central to live ops (proposal financials; ads attribution reporting) |

## 2. Per-blob verdicts

Each blob was run through the decision tree (findings doc §8.2). Verdicts:

### customers

| Data | Verdict |
|---|---|
| `customerProfileJSON` (~13 flat fields) | Nullable columns on `customers`. `mainPainPoint` → prefixed columns `main_pain_accessor`, `main_pain_urgency` (Embedded Value) |
| `customerProfileJSON.additionalPainPoints[]` | Stays a JSONB array column (identity-free value objects, replaced whole, never queried). **Promotion trigger**: gets its own table the day pain points need identity, FKs, or per-item updates |
| `propertyProfileJSON` (~8 flat fields) | Nullable columns on `customers` |
| `financialProfileJSON` (2 fields) | Nullable columns on `customers` |
| `leadMetaJSON.source.enrichment` (dynamic map) | Child table `customer_enrichment(id, customer_id FK, step_id, label, value, order, UNIQUE(customer_id, step_id))`. Retires `mergeFunnelEnrichment`'s bespoke `jsonb_set` → plain `INSERT ... ON CONFLICT (customer_id, step_id) DO UPDATE`. Hook-bypass requirement (no geocode/GCal side effects) preserved for free: child-table writes never enter the customers CRUD path |
| `leadMetaJSON.source` hot fields (**in scope per amendment**) | Promote to columns on `customers`: `lead_source_kind` (pgEnum: bina/generic/funnel), `funnel_slug`, `offer`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term` — the fields ads reporting filters/groups by. STI-hybrid: discriminator + hot fields as columns, residue as payload |
| `leadMetaJSON` residue | Stays JSONB (immutable-after-capture attribution payload: fbclid-class fields, `consent`, `phoneVerification`, provider raw data, `interestedTradesRaw`, `requestedTrades`). Single-writer at capture, replaced-whole — textbook document |

### user

| Data | Verdict |
|---|---|
| `agentProfileJSON` (~7 flat fields) | Nullable columns on `user`. All writes routed through the DAL (deletes the raw `db.update` in `agent-settings.router.ts`) — kills the headshot-vs-profile race |
| `agentProfileJSON.headshotCropData` | Stays a small JSONB column (single-writer, replaced-whole, two fixed sub-objects) |

### lead_sources

| Data | Verdict |
|---|---|
| `voipConfigJSON.campaigns` (5 flat policy fields) | Columns on `lead_sources`; `default_campaign_id` becomes a **real FK** to `voip_campaigns`. Kills the unlocked read-modify-write race in `setVoipCampaignsPolicy` |
| `voipConfigJSON.inHouse` | Own column `voip_inhouse_config_json` (contains `Record<string,string>` template maps — dynamic keys, correctly JSONB). Separating the two writers' columns alone removes the shared-blob contention |

### proposals

| Data | Verdict |
|---|---|
| `formMetaJSON` (~6 flat fields) | Columns on `proposals` (`envelopeDocumentIds` → pgEnum array column). Resolves its missing-runtime-validation hole for free |
| `fundingJSON.data.incentives[]` | Child table `proposal_incentives(id, proposal_id FK, type discriminator, position, + per-variant fields with CHECK constraints)`. Deletes the hand-written `finalTcpExpr` SQL mirror — final TCP becomes a plain `SUM` over a join |
| `fundingJSON` remainder (`data.*` scalars, `meta`) | Columns on `proposals` where flat; evaluated in Wave 3 detail design (small) |
| `projectJSON.data.sow[]` | Child table `proposal_sow_items(id, proposal_id FK, position, trade fields, content/html columns, section-level financial scalars)` |
| `sow[].financials.costLines[]` (**in scope per amendment**) | Child table `proposal_cost_lines(id, sow_item_id FK, position, label, amount, ...)` — grandchild of proposals |
| `sow[].financials.incentives[]` (per-section) | Stays JSONB-on-row in `proposal_sow_items` initially; promotion trigger documented (same shape as proposal_incentives if ever aggregated) |

### Explicitly stays JSONB (sanctioned, documented)

`meetings.contextJSON` / `flowStateJSON` (whole-document flow state by design), `voip_campaigns.smsCadence`,
`bina_webhook_logs.payload` / `matched_trades`, `voip_link_tokens.payloadJson`, `activities.metaJSON`,
`app_settings.configJson`, display/config arrays (`hoRequirements`, `beforeAfterPairsJSON`,
`media_files.*`, `scopes.homeAreas`, `variables.options`, `lead_sources.formConfigJSON`),
`x_project_scopes.variablesData` (dynamic keys).

**Table-count projection**: 42 → ~46 (`customer_enrichment`, `proposal_incentives`,
`proposal_sow_items`, `proposal_cost_lines`).

## 3. Wave structure

All new child tables follow the codified cheap tier (`docs/how-to/add-an-entity.md` — entity-internal
relations): schema + `relations()` + DAL functions on the parent entity + procedures on the parent's
router. **No new entity folders, CASL subjects, routers, or server-specs.** Reads follow the house
batch-fetch idiom (`inArray` batch, not LEFT JOIN — `meetings/dal/server/participants.ts` precedent).

### Wave 1 — zero-table wins + stop the bleeding

1. `customers` profile trio → columns (backfill + cutover of all writers: meeting-flow, edit form,
   contracts router age-patch; callers stop reload-and-spreading — they patch columns).
2. `user.agentProfileJSON` → columns; all writes through DAL; delete raw `db.update` in
   `agent-settings.router.ts`.
3. `lead_sources.voipConfigJSON` split → campaign-policy columns (+ FK) + `voip_inhouse_config_json`;
   `setVoipCampaignsPolicy` becomes plain column updates.
4. **Deregister proposals** from `jsonbMergeColumns` (one line; their writers are whole-document and
   registration currently prevents field-clearing).
5. Fix the stale docs (findings doc §9): `jsonb-columns.md` re-parse claim, `dal-conventions.md`
   "any depth" promise, `proposals/DOCS.md#jsonb-merge-on-update` rationale, `customers/schemas`
   leadMeta comment.

**Outcome**: both unprotected races dead; 6 of 7 merge registrations gone (3 profile columns
decomposed + 3 proposals deregistered — only `leadMetaJSON` remains, handled in W2); zero new tables.

### Wave 2 — child tables, leadMeta split, machinery deletion

1. `customer_enrichment` child table; retire `mergeFunnelEnrichment` → `INSERT ON CONFLICT`;
   funnel-intake-panel + lead-note builder read rows natively.
2. `leadMeta.source` promotion (per amendment): `lead_source_kind` pgEnum + `funnel_slug`, `offer`,
   `utm_*` columns on `customers`; backfill from existing blobs; residue stays in a slimmed
   `leadMetaJSON`. Pipeline/reporting queries move to real columns.
3. `proposal_incentives` child table; delete `finalTcpExpr` SQL mirror (final TCP = SUM over join);
   funding form mutation splits incentives into child-row upserts (small slice of the W3 refactor,
   accepted consciously).
4. **Delete the merge machinery**: `jsonbMergeColumns` config, `resolveMergeKeys`,
   `updateTouchesMergeColumn`, `buildMergedUpdateData`, `deepMergeJsonb`, and the locked-transaction
   branch. `updateImpl` collapses to one path. In the same pass, fix the fast-path silent-hook-skip:
   if the `previousRow` prefetch fails and an after-hook exists, **fail the update loudly** instead
   of committing and skipping the hook.
5. Update ADR-0005 + rewrite `jsonb-columns.md` around the decision framework (see §5).

**Outcome**: zero merge registrations, machinery gone, live-ops attribution queryable in SQL.

### Wave 3 — the SOW

1. `proposal_sow_items` + `proposal_cost_lines` child tables.
2. Write side: proposal edit form keeps its in-memory RHF field arrays (`sow-field.tsx`); the save
   mutation diffs the array into child-row upserts (insert/update/delete + reposition). This is the
   program's one substantial refactor.
3. Read side: proposal-flow UI, Zoho envelope plaintext (`sowToPlaintext`), PDF service, and
   `get-proposal-aggregates` consume ordered rows (`ORDER BY position`); the positional
   `->0->'trade'->>'label'` SQL hacks in customer-pipelines and agent-dashboard become joins.
4. `formMetaJSON` + `fundingJSON` remainder → columns on `proposals`; `projectJSON`/`fundingJSON`
   columns dropped after the frozen release.

**Outcome**: proposals fully relational; aggregates computable in SQL with real statistics.

## 4. Migration protocol (the reusable standard — identical per blob)

1. **Additive schema push**: new columns/tables land alongside the JSONB (push-based workflow;
   `pnpm db:push:dev` for dev, prod push at cutover; Neon-branch rules per
   `memory/reference-neon-branching.md`).
2. **Backfill script** in `scripts/` (house rules: `import './lib/load-env'`, runtime DB env via
   `NODE_ENV`). Every script has a **built-in parity check**: decode every source blob, write
   targets, then read back and field-level-diff against the source. Non-zero diff = non-zero exit,
   no partial success reporting. `--dry-run` flag mandatory.
3. **Neon branch rehearsal**: run schema push + backfill + parity on a fresh branch of prod; only a
   clean rehearsal authorizes the prod run.
4. **Prod cutover**: backfill, then ship the release that flips reads AND writes to the new shape.
5. **Rollback story**: old JSONB column renamed `*_deprecated` and frozen (no writers) for one
   release; Neon PITR as the backstop; column dropped the following release.
6. Zod schemas move with the data: column values validated by the same (now column-level) schemas;
   dropped-blob schemas deleted, not orphaned.

## 5. Standardization deliverables (the "once and for all" layer)

1. **Rewrite `docs/codebase-conventions/jsonb-columns.md`** as the canonical decision standard:
   the per-structure decision tree (repetition → child table; external reference → table/column;
   SQL-queried → columns; concurrent writers → table/columns; constraints → columns; else JSONB is
   correct), the one-to-one default (columns on parent, not tables), the STI-hybrid recipe for
   discriminated unions, the draft–commit split for form/wizard data, documented promotion triggers,
   and the sanctioned fallback for key-level blob patching (single-statement
   `jsonb_recursive_merge` — documented, not built).
2. **Update ADR-0005** (jsonb-vs-column-vs-child-table): record the decomposition decision and
   supersede the `jsonbMergeColumns` mechanism.
3. **Update `dal-conventions.md`**: remove the jsonb-merge-columns section after W2; document the
   child-table DAL pattern (batch-fetch assembly, upsert-diff writes).
4. **Per-entity DOCS.md updates** (customers, proposals, lead-sources, users) as each wave lands.
5. Memory updates per wave (`project-jsonb-strategy-research.md` status line).

## 6. Verification & error handling

- **Per house rules**: `pnpm tsc` + `pnpm lint` gate every PR; no `pnpm build`.
- **Data verification**: the parity check inside each backfill script is the acceptance test; the
  Neon-branch rehearsal is the staging run. Rehearsal evidence (parity output) pasted into the PR.
- **Runtime verification**: after each wave's cutover, drive the affected flows (funnel intake →
  enrichment rows; proposal edit → SOW rows; profile edit → columns) before dropping frozen columns.
- **Failure modes designed for**: backfill crash mid-run → scripts are idempotent (upsert semantics,
  re-runnable); blob rows failing Zod during backfill → script reports them per-row and exits
  non-zero (human decides: fix data or amend schema — never silently skip); concurrent writes during
  cutover window → cutover release flips reads+writes atomically per deploy, frozen column catches
  stragglers via the parity re-run post-deploy.

## 7. Out of scope

- Tables for `additionalPainPoints` and per-section SOW `incentives[]` (documented promotion triggers).
- Any change to the sanctioned-JSONB list (§2 last block).
- Drizzle relational-query (`with:`) adoption — house batch-fetch idiom stays.
- Testing-framework bootstrap (tracked separately: `docs/plans/2026-07-07-testing-bootstrap-handoff.md`);
  parity checks + tsc/lint are this program's verification layer.
- `_v` schema-version backfill for the sanctioned-JSONB survivors (revisit after W3).

## 8. Risks

| Risk | Mitigation |
|---|---|
| SOW write-diff refactor breaks proposal editing (highest-traffic sales tool) | W3 is last; rehearsed on Neon branch; frozen `projectJSON` column allows one-release rollback; drive the full proposal flow before dropping |
| Backfill misses blob shape variants (old rows predating current Zod schemas) | Parity check + per-row Zod failure reporting surfaces every variant before prod; rehearsal runs on a full prod copy |
| `customers` table grows wide (~23 + 8 promoted columns) | Postgres columns are cheap (TOAST); list views select explicit columns already; acceptable by design |
| W2 funding-form slice creates a half-refactored proposal form | Scoped consciously: only the incentives field-array path changes in W2; the rest of the form untouched until W3 |
| Losing merge machinery before all callers are migrated | Deletion is sequenced LAST in W2, after every registered column is decomposed or deregistered; tsc catches any survivor referencing `jsonbMergeColumns` |
