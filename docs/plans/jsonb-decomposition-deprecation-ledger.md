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
| [ ] | `mergeFunnelEnrichment` (bespoke `jsonb_set`) | `entities/customers/dal/server/mutations.ts:61-81` | Task 5 → `upsertFunnelEnrichment` rows |
| [ ] | `buildUpdateSet` (the `\|\|` merge) + doc block | `src/shared/dal/server/lib/create-crud-dal.ts:95-165` | Task 8 |
| [ ] | `spec.update.jsonbMergeColumns` option | `src/shared/dal/server/types.ts:87` + registration `entities/customers/lib/server-spec.ts:51-55` | Tasks 5 + 8 |
| [ ] | `finalTcpExpr` SQL mirror | `entities/proposals/dal/server/queries.ts:159-172` (+3 call sites) | Task 7 → `final_tcp_cents` |
| [ ] | `FunnelIntakePanel` `toRows()` + legacy-flat tolerance + its `LEGACY_ENRICHMENT_LABELS` import | `entities/customers/components/profile/funnel-intake-panel.tsx` | Task 5 (backfill normalizes legacy shapes into rows) |
| [ ] | Stale merge-mechanism comments/doc sections (`jsonbMergeColumns` mentions in `src/trpc/DOCS.md`, `customers.router/index.ts`, `proposals/DOCS.md`, `proposal-flow/DOCS.md`, `meetings/DOCS.md`, `voip-campaigns.router.ts`, `upsert-one-to-one.ts`, `use-enrich-lead.ts` + `use-progressive-enrichment.ts` jsonb_set headers) | per Task 9 sweep list | Task 9 |

## Wave 2 — frozen/scaffolding — kill trigger: the release AFTER the W2 prod push

| | Item | Where | Notes |
|---|---|---|---|
| [ ] | `leadMetaJSONDeprecated` property + `lead_meta_json` column | `customers.ts:50` | Frozen at Task 5; one-release rollback window, then drop column + property + `.omit()` entry |
| [ ] | `scripts/backfill-wave2-children.ts` | `scripts/` | ⚠️ **Cutover-window-only tool.** Its proposals section reads blob incentives — once writers flip, a full re-run would overwrite live rows with stale blob data (post-deploy verify uses `--skip-proposals`). Delete in the same commit that drops `lead_meta_json` |
| [ ] | `LEGACY_ENRICHMENT_LABELS` (`entities/customers/constants/funnel-intake-fields.ts`) | last consumer = backfill-wave2 script | dies with the script (verify no other importer first) |
| [ ] | Legacy one-off scripts still referencing the frozen blob: `scripts/seed-bina-contacts.ts`, `scripts/backfill-interested-trades-raw.ts` | `scripts/` | Superseded by attribution child; delete with the column drop (they only compile against the deprecated property) |

## Wave 2 — bridges that die in W3 (do NOT delete before the SOW wave)

| | Item | Where | W3 replacement |
|---|---|---|---|
| [ ] | `getFullView` incentive hydration bridge (rows → `fundingJSON.data.incentives`) | `entities/proposals/dal/server/queries.ts` | dies with `fundingJSON` itself |
| [ ] | Recompute jsonb residues: `startingTcp` base + section-incentives term inside `recomputeProposalFinancials` | `entities/proposals/dal/server/mutations.ts` | `starting_tcp_cents` column + `proposal_incentives(sow_item_id)` rows |
| [ ] | `incentives: []` blank-write in `buildMutationData` (edit + create views) | `features/proposal-flow/ui/views/` | dies with fundingJSON decomposition |
| [ ] | Freeze-gate gap: only `replaceProposalIncentives` + `applyEnvelopeContext` are gated; blob-wide financial freeze | proposals DAL | W3 write refactor extends the gate (Addendum A.1.2) |
| [ ] | `proposal-doc-definition.ts` / AI-summary / Zoho-context reading blob-shaped `funding`/`sow` | via getFullView bridge | W3 flips them to rows |

## Superseded design docs — kill trigger: plan Task 11 (this wave)

| | Item | Why confusing if left |
|---|---|---|
| [ ] | `docs/plans/2026-06-27-jsonb-deep-merge-handoff.md` | Describes BUILDING the deep-merge machinery Wave 2 deletes — direct contradiction of current architecture |
| [ ] | `docs/plans/2026-06-27-jsonb-deep-merge-implementation-plan.md` | same |
| [ ] | `docs/superpowers/plans/2026-07-03-ws2-jsonb-deep-merge.md` | same ("WS-2" deep-merge workstream, superseded by the decomposition program) |
| [ ] | Memory truth-pass: `memory/project-funnel-capture-and-jsonb-merge.md` (jsonb-merge rule now historical), `memory/project-jsonb-strategy-research.md` (status → W2 shipped, W3 next) | Recalled memories asserting the merge mechanism exists would mislead future sessions |

## Wave 3 (pre-registered, expand when W3 is planned)

- `proposals.projectJSON` + `proposals.fundingJSON` columns (frozen then dropped after SOW decomposition)
- `projectSectionSchema`/`fundingSectionSchema` as DB-blob schemas (survive only as form shapes if W3 keeps them)
- `snapSowFromMeeting` blob-shape logic, `sowToPlaintext` blob reader, positional `->0->'trade'` SQL in customer-pipelines/agent-dashboard
- `getFullView` hydration bridge + recompute jsonb residues (rows above)
