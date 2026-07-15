# JSONB Decomposition — Deprecation & Dead-Code Ledger

> **Standing document — epic #256.** Every wave ADDS rows when it deprecates a path; every
> release that deletes something CHECKS its row off (with the commit hash). Any session touching
> decomposition leftovers MUST consult this ledger first — an unchecked row is intentionally-alive
> scaffolding with a scheduled death, NOT cruft to "clean up" early, and NOT living code to build on.
> A checked row must be GONE from the codebase; if you find it alive, that's a bug — ping Oliver.

**Status legend**: `[ ]` scheduled · `[x] deleted (commit)` · each row names its kill trigger.

## Explicitly ALIVE — do not "clean up" (common false positives)

| Item | Why it looks dead but isn't |
|---|---|
| `leadMetaSchema` / `LeadMeta` type (`entities/customers/schemas`) | Survives Wave 2 as the capture/transport shape (funnel submit, intake form, Bina ingest) AND the `customer_lead_attribution.capture_json` payload type |
| `enrichmentRecordSchema` / `EnrichmentRecord` | Transport shape for `enrichFunnelLead` input + `splitLeadMeta` |
| `computeFinalTcp` / `computeTotalDiscounts` / `computeTotalSectionIncentives` | Stage-1 (draft) live form-state math per Addendum A — never deleted, only the persisted-SQL mirror died |
| `fundingJSON.data.incentives` in the ZOD shape | Form/transport format until W3; only the DB blob's array is dead (writers store `[]`, `getFullView` re-hydrates from rows) |
| `painSchema` / `Pain` | Alive — `customer_profiles.additional_pain_points` payload type |

## Wave 1 leftovers — kill trigger: the W2 prod push (runbook decision gate) or the release after

| | Item | Where | Why dead |
|---|---|---|---|
| [ ] | `customerProfileJSONDeprecated` property + `customer_profile_json` column | `src/shared/db/schema/customers.ts:30` (+ `.omit()` entry :101) | W1 froze; data lives in `customer_profiles` |
| [ ] | `propertyProfileJSONDeprecated` + `property_profile_json` | `customers.ts:35` (+ :102) | same |
| [ ] | `financialProfileJSONDeprecated` + `financial_profile_json` | `customers.ts:40` (+ :103) | same |
| [ ] | `agentProfileJSONDeprecated` + `agent_profile_json` | `src/shared/db/schema/auth.ts:33` | W1 froze; data lives in `user` columns |
| [ ] | `voipConfigJSONDeprecated` + `voip_config_json` | `src/shared/db/schema/lead-sources.ts:20` (+ `.omit()` :54) | W1 froze; data lives in `lead_sources` columns |
| [ ] | `customerProfileSchema` / `propertyProfileSchema` / `financialProfileSchema` + `CustomerProfile`/`PropertyProfile`/`FinancialProfile` types | `entities/customers/schemas/index.ts:31-65` (+ type imports `customers.ts:1`) | Only consumers: the deprecated columns' `$type<>` + backfill-wave1 script. Spec §4.6: dropped-blob schemas deleted, not orphaned |
| [ ] | `agentProfileSchema` (users) + `voipConfigSchema` (lead-sources) blob schemas | users / lead-sources entity schemas | same — die with their frozen columns |
| [ ] | `scripts/backfill-wave1-columns.ts` (incl. `LEGACY_ENUM_MAP`, `normalizeLegacyKeys`) | `scripts/` | Sole remaining reader of the 5 frozen columns; delete in the same commit that drops them |

## Wave 2 — deleted DURING implementation (verify all gone at plan Task 11)

| | Item | Where (pre-deletion) | Killed by |
|---|---|---|---|
| [x] deleted (`215790be`) | `mergeFunnelEnrichment` (bespoke `jsonb_set`) | `entities/customers/dal/server/mutations.ts:61-81` | Task 5 → `upsertFunnelEnrichment` rows |
| [x] deleted (`3da808ed`) | `buildUpdateSet` (the `\|\|` merge) + doc block | `src/shared/dal/server/lib/create-crud-dal.ts:95-165` | Task 8 |
| [x] deleted (`215790be` registration, `3da808ed` mechanism) | `spec.update.jsonbMergeColumns` option | `src/shared/dal/server/types.ts:87` + registration `entities/customers/lib/server-spec.ts:51-55` | Tasks 5 + 8 |
| [x] deleted (`e54052e2`) | `finalTcpExpr` SQL mirror | `entities/proposals/dal/server/queries.ts:159-172` (+3 call sites) | Task 7 → `final_tcp_cents` |
| [x] deleted (`215790be`) | `FunnelIntakePanel` `toRows()` + legacy-flat tolerance + its `LEGACY_ENRICHMENT_LABELS` import | `entities/customers/components/profile/funnel-intake-panel.tsx` | Task 5 (backfill normalizes legacy shapes into rows) |
| [x] deleted (`6b205945`, fix `349e203c`) | Stale merge-mechanism comments/doc sections (`jsonbMergeColumns` mentions in `src/trpc/DOCS.md`, `customers.router/index.ts`, `proposals/DOCS.md`, `proposal-flow/DOCS.md`, `meetings/DOCS.md`, `voip-campaigns.router.ts`, `upsert-one-to-one.ts`, `use-enrich-lead.ts` + `use-progressive-enrichment.ts` jsonb_set headers) | per Task 9 sweep list | Task 9 — note: these files now carry INTENTIONAL tombstone prose explaining the deletion (`grep jsonbMergeColumns` still hits them by design; verified at Task 11 as sanctioned, not stale) |
| [x] deleted (this task's commit — see ledger-reconciliation commit in `git log`) | `scripts/verify-final-tcp-parity.ts` (orphaned Wave-0 SQL-mirror script; its `finalTcpExpr` counterpart is gone, nothing imports it) | `scripts/` | Task 11 — found during ledger reconciliation, not foreseen by the original plan; zero live references confirmed (`grep -rn "verify-final-tcp-parity" src/ docs/ package.json` → only historical mentions in dated plan docs, e.g. `docs/superpowers/specs/2026-07-14-proposal-financials-facade-design.md:242` which proposes reusing it — flagged for that future author since the script is now gone) |
| [x] deleted (final-review fix pass, this task's commit) | `scripts/migrate-proposal-kind.ts` (+ its two `package.json` scripts `migrate:proposal-kind` / `migrate:proposal-kind:dev`) | `scripts/` | Completed one-off; cast `::proposal_kind` against the enum type this wave's `DROP TYPE proposal_kind` removes (`kind` is now `text`) — the script would fail at runtime. Found by final review, not the original plan. Zero live references confirmed (`grep -rn "migrate-proposal-kind" src/ docs/ package.json scripts/` → only the two package.json entries, now also removed). `scripts/verify-proposal-kind.ts` was checked as a sibling but is cast-free (queries the `kind` column and index names only, no `::proposal_kind`) — left alive, still runs correctly against the text column |

## Wave 2 — frozen/scaffolding — kill trigger: the release AFTER the W2 prod push

Reconciled at Task 11: all four rows confirmed still present exactly as described (not
yet due — kill trigger is the release after prod cutover, which hasn't happened).

| | Item | Where | Notes |
|---|---|---|---|
| [ ] | `leadMetaJSONDeprecated` property + `lead_meta_json` column | `customers.ts:50` | Frozen at Task 5; one-release rollback window, then drop column + property + `.omit()` entry |
| [ ] | `scripts/backfill-wave2-children.ts` | `scripts/` | ⚠️ **Cutover-window-only tool.** Its proposals section reads blob incentives — once writers flip, a full re-run would overwrite live rows with stale blob data (post-deploy verify uses `--skip-proposals`). Delete in the same commit that drops `lead_meta_json` |
| [ ] | `LEGACY_ENRICHMENT_LABELS` (`entities/customers/constants/funnel-intake-fields.ts`) | last consumer = backfill-wave2 script | dies with the script (verify no other importer first) |
| [ ] | Legacy one-off scripts still referencing the frozen blob: `scripts/seed-bina-contacts.ts`, `scripts/backfill-interested-trades-raw.ts` | `scripts/` | Superseded by attribution child; delete with the column drop (they only compile against the deprecated property) |

## Wave 2 — bridges that die in W3 (do NOT delete before the SOW wave)

Reconciled at Task 11 against what actually shipped (commits `75ed52fb`, `e54052e2`) —
all five foreseen bridges shipped as planned; no additional bridge was introduced beyond
these (customers-side attribution/enrichment is a permanent nested composed read, not a
temporary legacy-shape bridge — see `entities/customers/dal/server/queries.ts:CustomerFullView`).

| | Item | Where | W3 replacement |
|---|---|---|---|
| [ ] | `getFullView` incentive hydration bridge (rows → `fundingJSON.data.incentives`) | `entities/proposals/dal/server/queries.ts` (confirmed: `listProposalIncentives` + `incentiveRowsToDomain` rehydrate into `fundingJSON.data.incentives` at read time) | dies with `fundingJSON` itself |
| [ ] | Recompute jsonb residues: `startingTcp` base + section-incentives term inside `recomputeProposalFinancials` | `entities/proposals/dal/server/mutations.ts` (confirmed present, comment cites "W3") | `starting_tcp_cents` column + `proposal_incentives(sow_item_id)` rows. **W3 ordering constraint (final review, this task)**: the SQL must add `sow_item_id IS NULL` to the existing global-discount subquery THE SAME MOMENT section rows land in `proposal_incentives` — if section rows are inserted before that predicate is added, the discount SUM would double-count them alongside the still-present `projectJSON.data.sow[].financials.incentives[]` jsonb term |
| [ ] | `incentives: []` blank-write in `buildMutationData` (edit + create views) | `features/proposal-flow/ui/views/edit-proposal-view.tsx` + `create-new-proposal-view.tsx` (confirmed both) | dies with fundingJSON decomposition |
| [ ] | Freeze-gate gap: only `replaceProposalIncentives` + `applyEnvelopeContext` are gated; blob-wide financial freeze | proposals DAL (confirmed: no other write path is freeze-gated yet) | W3 write refactor extends the gate (Addendum A.1.2) |
| [ ] | `proposal-doc-definition.ts` / AI-summary / Zoho-context reading blob-shaped `funding`/`sow` | via getFullView bridge (confirmed: `pdf.service.ts` + proposal-flow query/view consumers all read through `getFullView`, none read `proposal_incentives` directly) | W3 flips them to rows |

## Superseded design docs — kill trigger: plan Task 11 (this wave)

| | Item | Why confusing if left |
|---|---|---|
| [x] deleted (this task's commit) | `docs/plans/2026-06-27-jsonb-deep-merge-handoff.md` | Describes BUILDING the deep-merge machinery Wave 2 deletes — direct contradiction of current architecture. Inbound refs checked: only historical mentions inside other dated plan/spec docs (`2026-07-09-jsonb-research-findings-and-relational-decomposition.md`, `2026-06-27-funnel-data-capture-unified-design.md`, `2026-07-03-jsonb-restructure-design.md`, `2026-07-03-ws5-lead-meta-table.md`) — left as-is per convention (point-in-time design records); no live/evergreen doc (DOCS.md, codebase-conventions, CLAUDE.md) pointed at it |
| [x] deleted (this task's commit) | `docs/plans/2026-06-27-jsonb-deep-merge-implementation-plan.md` | same — same inbound-ref sweep result |
| [x] deleted (this task's commit) | `docs/superpowers/plans/2026-07-03-ws2-jsonb-deep-merge.md` | same ("WS-2" deep-merge workstream, superseded by the decomposition program) — same inbound-ref sweep result |
| [x] memory truth-pass complete (Task 9 + Task 11) | Memory: `memory/project-funnel-capture-and-jsonb-merge.md` (jsonb-merge rule reframed HISTORICAL, points at this ledger), `memory/project-jsonb-strategy-research.md` (already current as of Task 9 — Wave 2 IMPLEMENTED status, verified not stale), `memory/feedback-runtime-db-env.md` (flagged as possibly-stale by the T11 controller re: pre-env-axes-refactor NODE_ENV/script-db.ts pattern; verified against current code — a parallel session already rewrote it to the current DRIZZLE_TARGET truth alongside landing `0803126a` on main, so no change was needed here), `memory/MEMORY.md` hook lines for all three verified current | Recalled memories asserting the merge mechanism exists would mislead future sessions |

## Wave 3 (pre-registered, expand when W3 is planned)

- `proposals.projectJSON` + `proposals.fundingJSON` columns (frozen then dropped after SOW decomposition)
- `projectSectionSchema`/`fundingSectionSchema` as DB-blob schemas (survive only as form shapes if W3 keeps them)
- `snapSowFromMeeting` blob-shape logic, `sowToPlaintext` blob reader, positional `->0->'trade'` SQL in customer-pipelines/agent-dashboard
- `getFullView` hydration bridge + recompute jsonb residues (rows above)
