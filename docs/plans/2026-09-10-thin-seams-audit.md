# Thin-seams audit — single-use and unused exports

**Date:** 2026-09-10 · **Scope:** every `export` under `src/` and `scripts/` (3691 exports across the scanned tree) · **Explorer:** [interactive table](https://claude.ai/code/artifact/af4daa8e-61f7-4178-82bc-258ec8501184)

## How this was measured

A TypeScript-compiler-API script parsed every `.ts/.tsx/.js/.mjs` file (excluding `node_modules`, `.next`, `video/`, `.worktrees/`), collected each exported symbol, and resolved every import (`@/` alias, relative, `import type`, `import * as ns` with per-property tracing, dynamic `import()`, `export … from` and `export *` chains through barrels). A **consumer** is a distinct file that imports the symbol, directly or through any number of barrels; barrels themselves are not counted as consumers. Next.js special-file exports (`default`, `metadata`, route handlers…) are excluded. Vocabulary follows the deep-module glossary: a *seam* is where an interface lives; one adapter at a seam is a hypothetical seam; the *deletion test* asks whether removing the module concentrates complexity (earning its keep) or just moves it.

Known blind spots: symbols referenced only by string (none found for source files), JSDoc `@type` references, and the Remotion `video/` package.

## Headline numbers

| | Count |
|---|---|
| Exports scanned (excluding framework-consumed) | 3567 |
| **Used by exactly one other file** | **1495** |
| — of which convention says *keep* (by design) | 1170 |
| — of which *act* (consolidate) | 59 |
| — of which *review* (judgment call) | 266 |
| **Used by no other file** | **830** |
| — only used inside its own file (drop `export`) | 323 |
| — no use anywhere (dead-code candidates) | 238 |
| — dead re-export lines (barrels, shims, entity homes) | 69 |
| Rows touching files in your uncommitted diff (⚠, left alone) | 206 |

Counts above are **post-consolidation** (the tree after this pass).

## Consolidated in this pass

All changes type-check (`tsc --noEmit` clean) and lint clean on the touched files. Nothing in your uncommitted diff was touched; nothing was committed.

**Pass-through shims deleted (10 files)** — deletion test: complexity vanished, importers now point at the source.
- `src/features/customer-pipelines/constants/pipeline-config.ts` → `customer-pipeline-view.tsx` imports `pipelineConfigs` from `@/shared/domains/pipelines/constants/pipeline-registry`
- `src/features/customer-pipelines/constants/pipeline-labels.ts` (no importers)
- `src/features/customer-pipelines/lib/compute-customer-stage.ts` → `get-customer-pipeline-items.ts` calls `computeFreshStage` from the shared pipelines domain directly
- `src/features/landing/schemas/general-inquiry-form.ts` and `schedule-consultation-form.ts` → `landing.router` imports both schemas from `@/shared/entities/landing/schemas`; the now-empty `landing/schemas/` directory is gone
- `src/features/landing/data/footer.ts` (no importers)
- `src/features/meeting-flow/constants/today-view-buckets.ts` (back-compat shim, no importers)
- `src/features/landing/ui/components/contact/general-inquiry-form.tsx` and `schedule-consultation-form.tsx` (1-line shims) → `contact-hero.tsx` imports the forms from `ui/components/forms/`
- `src/shared/components/contract-status-panel/types.ts` → its only content, `ContractStatusPanelProps`, now lives in the component (Rule 5)

**Trimmed to their one live line (3 files)** — `active-`, `dead-`, `rehash-pipeline-stages.ts` in `customer-pipelines/constants/` keep only the type re-export that `types/index.ts` still imports. That file is in your uncommitted diff, so the final step (import the stage types from `@/shared/domains/pipelines/constants/*` and delete the three shims) waits for it.

**Dead barrel lines removed (5)** — `participant-picker/index.ts` (`ParticipantPickerContent`, `InitialParticipantSummary`), `project-management/ui/views/index.ts` (`PortfolioGridView`, `ProjectStoryView`; both pages import the view files directly), `inputs/address-autocomplete.tsx` (`AddressFields` type re-export).

**Types co-located with their sole consumer (6)** — each was exported from a types file, used by exactly one file, and not even referenced in its own file:
- `MeetingStepConfig` → `meeting-flow/constants/step-config.ts`
- `ContractStatusPanelProps` → `contract-status-panel/ui/contract-status-panel.tsx`
- `DataTableProps` → `data-table/ui/data-table.tsx`
- `EntityActionButtonProps` (was marked "legacy, kept for backward compat") → `entity-actions/entity-view-button.tsx`
- `KanbanColumnFilterConfig` → `kanban/hooks/use-kanban-column-filter.ts`
- `MediaManagerProps` → `media/media-manager.tsx`

**Function moved out of a types file (1)** — `classifyFileKind` → `file-optimization/optimize-file.ts` (still exported; `FileKind` and `FileOptimizationResult` stay in `types.ts` because the module DOCS names them as the contract).

**Deliberately not consolidated, with reasons**
- `*Visibility` helpers in every entity `lib/visibility.ts` (13 single-use seams) — owned by #285 CASL Phase A; touching them now would collide.
- Provider `lib/config.ts` getters and `constants/` (41) — the ADR-0003 provider layout documented in `docs/codebase-conventions/service-architecture.md`; the single consumer is `client.ts` by design.
- `access-token-cache.ts` in zoho-sign and quickbooks — named in the same doc as the sanctioned example of a provider `lib/` file.
- `buy-triggers.ts` (3 date helpers → `programs.ts`) — listed in `docs/programs/README.md` as a named module.
- `ProposalStep` in `proposal-flow/types/index.ts` — the conventions doc uses it as the canonical example of a feature domain type, and proposal-flow is mid-W4.
- `src/shared/constants/company/index.ts` — 2 dead lines + 4 single-consumer lines, but it is the company-data barrel every consumer is supposed to go through; leaving the catalog complete.
- `src/shared/domains/analytics/index.ts` — a designed public surface with **zero importers today**; the framework is consumed nowhere yet (see findings).

## Findings worth a decision

1. **⚠️ Stale ref (fixed)** — `memory/coding-conventions.md` Rule 10 listed `src/features/landing/data/company/index.ts` as a sanctioned barrel; that path no longer exists. The barrel is `src/shared/constants/company/index.ts`. Memory updated.
2. **Rule 19 drift** — `src/shared/services/providers/quickbooks/lib/access-token-cache.ts` imports `db` directly, as do `providers/upstash/jobs/create-qb-records.ts` and `providers/ai/client.ts`. None are in the Rule 19 "known violations" list. Not changed here.
3. **Entity homes bypassed** — 35 re-export lines in `shared/entities/voip-*/types.ts`, `voip-*/schemas/index.ts` and `app-settings/*` have no importer. The table below says, per line, whether the underlying symbol is used directly from `db/schema` (consumers bypass the entity home) or unused everywhere. Pick a direction: route consumers through the home (Rule 13) or drop the lines.
4. **`src/trpc/types.ts`** re-exports 7 DAL symbols (`DalReturn`, `ScopedContext`, `SYSTEM_CONTEXT`, …) that nobody imports from there, plus 3 that only `create-crud-router.ts` uses. The file is in your uncommitted diff, so it was left alone.
5. **Un-export codemod** — 308 exported symbols (clean files) are only used inside their own file. Dropping `export` is mechanical and tsc-verified; I did not run it because it touches ~150 files and would swamp your in-flight diff. Say the word and I'll run it as a separate, single-purpose change.
6. **Dead-code candidates** — 238 exports have no consumer and no local use (e.g. `DashboardActionQueue`, `AdminSection`, `StatCard`, whole `scripts/meta` types). Some are planned work (dashboard Plan 2/3); triage by hand.

## Where single-use exports cluster

Modules ranked by total exports; the ratio tells you where interfaces are widest relative to their use.

| Module | Exports | Single-use | Zero-use | Single-use % |
|---|---|---|---|---|
| `src/shared/components` | 511 | 175 | 151 | 34% |
| `src/shared/services/providers` | 392 | 164 | 131 | 42% |
| `src/shared/domains` | 374 | 174 | 114 | 47% |
| `src/shared/db` | 348 | 29 | 14 | 8% |
| `src/shared/constants` | 190 | 59 | 49 | 31% |
| `src/shared/entities/customers` | 142 | 70 | 21 | 49% |
| `src/shared/modules` | 134 | 50 | 31 | 37% |
| `scripts` | 122 | 58 | 33 | 48% |
| `src/features/landing` | 113 | 65 | 21 | 58% |
| `src/trpc` | 102 | 65 | 12 | 64% |
| `src/shared/entities/meetings` | 93 | 44 | 16 | 47% |
| `src/features/meeting-flow` | 84 | 62 | 13 | 74% |
| `src/features/proposal-flow` | 78 | 47 | 13 | 60% |
| `src/shared/dal` | 74 | 17 | 15 | 23% |
| `src/shared/lib` | 70 | 23 | 15 | 33% |
| `src/features/agent-dashboard` | 59 | 35 | 3 | 59% |
| `src/features/campaigns-admin` | 50 | 38 | 4 | 76% |
| `src/features/project-management` | 44 | 34 | 4 | 77% |
| `src/features/lead-sources-admin` | 42 | 32 | 1 | 76% |
| `src/shared/services/voip` | 42 | 14 | 20 | 33% |
| `src/shared/entities/projects` | 40 | 12 | 9 | 30% |
| `src/features/schedule-management` | 36 | 27 | 3 | 75% |
| `src/features/customer-pipelines` | 35 | 26 | 4 | 74% |
| `src/shared/entities/voip-campaign-contacts` | 35 | 20 | 12 | 57% |
| `src/shared/entities/lead-sources` | 24 | 13 | 5 | 54% |
| `src/shared/entities/activities` | 23 | 13 | 10 | 57% |
| `src/shared/entities/voip-campaigns` | 23 | 6 | 10 | 26% |
| `src/shared/entities/media-files` | 21 | 13 | 5 | 62% |
| `src/shared/hooks` | 20 | 5 | 5 | 25% |
| `src/features/agent-settings` | 18 | 16 | 1 | 89% |
| `src/shared/entities/applications` | 16 | 10 | 2 | 63% |
| `src/shared/entities/voip-dids` | 16 | 8 | 5 | 50% |
| `src/shared/entities/users` | 15 | 5 | 6 | 33% |
| `src/shared/config` | 13 | 3 | 3 | 23% |
| `src/shared/entities/voip-messages` | 12 | 6 | 5 | 50% |
| `src/shared/types` | 12 | 4 | 4 | 33% |
| `src` | 11 | 0 | 11 | 0% |
| `src/shared/entities/customer-notes` | 11 | 5 | 0 | 45% |
| `src/shared/entities/voip-calls` | 11 | 5 | 5 | 45% |
| `src/shared/entities/voip-contact-fields` | 11 | 3 | 6 | 27% |

## Single-use exports — act (remaining after this pass)

These are the seams the conventions let you fold. ⚠ marks rows touching your uncommitted diff.

### Delete shim — 5

A file that only re-exports another file, with exactly one importer. **Action:** Point the importer at the source; delete the shim.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| ⚠ `src/features/proposal-flow/schemas/form-schema.ts:1` | `proposalFormShape` | reexport | 1 | `src/trpc/routers/ai.router/index.ts` · cross-module | pure pass-through file; deletion test: complexity vanishes → point consumer at source ⇐ `src/shared/modules/proposals/core/schemas/index.ts` |
| `src/shared/constants/company/index.ts:1` | `awards` | reexport | 1 | `src/shared/domains/funnels/ui/footer/funnel-footer-trust.tsx` · cross-module | pure pass-through file; deletion test: complexity vanishes → point consumer at source ⇐ `src/shared/constants/company/awards.ts` |
| `src/shared/constants/company/index.ts:5` | `credentials` | reexport | 1 | `src/features/landing/ui/components/about/credentials.tsx` · cross-module | pure pass-through file; deletion test: complexity vanishes → point consumer at source ⇐ `src/shared/constants/company/credentials.ts` |
| `src/shared/constants/company/index.ts:8` | `services` | reexport | 1 | `src/features/landing/ui/components/home/services-preview.tsx` · cross-module | pure pass-through file; deletion test: complexity vanishes → point consumer at source ⇐ `src/shared/constants/company/services.ts` |
| `src/shared/constants/company/index.ts:12` | `teamMembers` | reexport | 1 | `src/features/landing/ui/components/about/team.tsx` · cross-module | pure pass-through file; deletion test: complexity vanishes → point consumer at source ⇐ `src/shared/constants/company/team-members.ts` |

### Barrel bypass — 12

Same-feature code importing through a barrel or shim (Rule 10 says internal code imports the file directly). **Action:** Import the source file directly; drop the barrel line.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| ⚠ `src/features/customer-pipelines/constants/active-pipeline-stages.ts:1` | `CustomerPipelineStage` | reexport | 1 | `src/features/customer-pipelines/types/index.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (file is a pure shim) ⇐ `src/shared/domains/pipelines/constants/fresh-pipeline.ts` |
| ⚠ `src/features/customer-pipelines/constants/dead-pipeline-stages.ts:1` | `DeadPipelineStage` | reexport | 1 | `src/features/customer-pipelines/types/index.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (file is a pure shim) ⇐ `src/shared/domains/pipelines/constants/dead-pipeline.ts` |
| ⚠ `src/features/customer-pipelines/constants/rehash-pipeline-stages.ts:1` | `RehashPipelineStage` | reexport | 1 | `src/features/customer-pipelines/types/index.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (file is a pure shim) ⇐ `src/shared/domains/pipelines/constants/rehash-pipeline.ts` |
| ⚠ `src/features/customer-pipelines/types/index.ts:9` | `CustomerProfileData` | reexport | 1 | `src/features/customer-pipelines/dal/server/get-customer-profile.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (barrel) ⇐ `src/shared/entities/customers/types.ts` |
| ⚠ `src/features/customer-pipelines/types/index.ts:9` | `CustomerProfileMeeting` | reexport | 1 | `src/features/customer-pipelines/dal/server/get-customer-profile.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (barrel) ⇐ `src/shared/entities/customers/types.ts` |
| ⚠ `src/features/customer-pipelines/types/index.ts:9` | `CustomerProfileProject` | reexport | 1 | `src/features/customer-pipelines/dal/server/get-customer-profile.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (barrel) ⇐ `src/shared/entities/customers/types.ts` |
| ⚠ `src/features/customer-pipelines/types/index.ts:9` | `CustomerProfileProposalView` | reexport | 1 | `src/features/customer-pipelines/dal/server/get-customer-profile.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (barrel) ⇐ `src/shared/entities/customers/types.ts` |
| `src/shared/entities/meetings/components/participant-picker/index.ts:1` | `ParticipantPicker` | reexport | 1 | `src/shared/entities/meetings/lib/columns-registry.tsx` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (file is a pure shim) ⇐ `src/shared/entities/meetings/components/participant-picker/participant-picker.tsx` |
| `src/shared/entities/meetings/components/participant-picker/index.ts:2` | `ReadOnlyParticipantSummary` | reexport | 1 | `src/shared/entities/meetings/lib/columns-registry.tsx` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (file is a pure shim) ⇐ `src/shared/entities/meetings/components/participant-picker/read-only-participant-summary.tsx` |
| ⚠ `src/trpc/types.ts:18` | `CrudHandlers` | reexport | 1 | `src/trpc/lib/create-crud-router.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (barrel) ⇐ `src/shared/dal/server/types.ts` |
| ⚠ `src/trpc/types.ts:18` | `EntityServerSpec` | reexport | 1 | `src/trpc/lib/create-crud-router.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (barrel) ⇐ `src/shared/dal/server/types.ts` |
| ⚠ `src/trpc/types.ts:18` | `SlotName` | reexport | 1 | `src/trpc/lib/create-crud-router.ts` · same-module | Rule 10: internal consumer must import the source directly; drop this barrel line (barrel) ⇐ `src/shared/dal/server/types.ts` |

### Co-locate type — 7

A type/interface defined in a types file but used by exactly one file in the same module and nowhere else, not even its own file. **Action:** Move it into the consumer (Rule 5 for props).

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| ⚠ `src/features/customer-pipelines/types/index.ts:80` | `CustomerPipelineRawData` | interface | 19 | `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` · same-module | defined here but only used in the consumer → move it there (Rule 5 spirit) |
| `src/features/meeting-flow/types/index.ts:67` | `MeetingStepId` | type | 8 | `src/features/meeting-flow/constants/step-config.ts` · same-module | defined here but only used in the consumer → move it there (Rule 5 spirit) |
| ⚠ `src/features/proposal-flow/constants/project-overview-display.tsx:58` | `FieldWithValues` | type | 4 | `src/features/proposal-flow/ui/components/proposal/project-overview.tsx` · same-module | defined here but only used in the consumer → move it there (Rule 5 spirit) |
| `src/features/proposal-flow/types/index.ts:4` | `ProposalStep` | interface | 7 | `src/features/proposal-flow/constants/proposal-steps.ts` · same-module | defined here but only used in the consumer → move it there (Rule 5 spirit) |
| ⚠ `src/shared/dal/server/types.ts:136` | `CrudConfigFactory` | type | 2 | `src/shared/dal/server/lib/create-crud-dal.ts` · same-module | defined here but only used in the consumer → move it there (Rule 5 spirit) |
| `src/shared/lib/file-optimization/types.ts:12` | `FileOptimizationResult` | interface | 17 | `src/shared/lib/file-optimization/optimize-file.ts` · sibling | defined here but only used in the consumer → move it there (Rule 5 spirit) |
| `src/shared/services/voip/campaigns/lib/eligibility.ts:16` | `EnrollmentRejectReason` | type | 8 | `src/shared/services/voip/campaigns/enrollment.service.ts` · same-module | defined here but only used in the consumer → move it there (Rule 5 spirit) |

### Single-use client hook (Rule 15) — 4

A dal/client hook with one consumer; Rule 15 says create these only when reused in 2+ places. **Action:** Call tRPC directly in the consumer; delete the hook.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| ⚠ `src/features/proposal-flow/dal/client/mutations/use-create-proposal.ts:6` | `useCreateProposal` | hook | 10 | `src/features/proposal-flow/ui/views/create-new-proposal-view.tsx` · same-module | Rule 15: client DAL hook only when reused in 2+ places; sole consumer should call tRPC directly |
| `src/features/proposal-flow/dal/client/mutations/use-proposal-media.ts:6` | `useProposalMedia` | hook | 16 | `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` · same-module | Rule 15: client DAL hook only when reused in 2+ places; sole consumer should call tRPC directly |
| ⚠ `src/features/proposal-flow/dal/client/mutations/use-set-cash-in-deal.ts:6` | `useSetCashInDeal` | hook | 10 | `src/features/proposal-flow/ui/components/proposal/funding.tsx` · same-module | Rule 15: client DAL hook only when reused in 2+ places; sole consumer should call tRPC directly |
| ⚠ `src/features/proposal-flow/dal/client/queries/use-get-finance-options.ts:4` | `useGetFinanceOptions` | hook | 4 | `src/features/proposal-flow/ui/components/proposal/funding.tsx` · same-module | Rule 15: client DAL hook only when reused in 2+ places; sole consumer should call tRPC directly |

### Inline thin helper — 19

A helper ≤15 lines with one non-UI consumer in the same module; the seam has one adapter. **Action:** Inline or make private — case by case (several are documented modules; see notes).

Most of these are named modules with docs or active epics (funnels #265, VoIP campaigns, query toolkit); the analysis flags them, the notes above explain why they were left.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| `src/features/meeting-flow/constants/energy-trades.ts:3` | `isEnergyEfficientTrade` | function | 3 | `src/features/meeting-flow/constants/programs.ts` · sibling | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/dal/lib/query/url-state.ts:31` | `assertNoReservedFilterIds` | function | 13 | `src/shared/dal/client/hooks/use-paginated-query.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/domains/funnels/constants/storage-keys.ts:26` | `funnelStateKey` | function | 3 | `src/shared/domains/funnels/hooks/use-funnel-engine.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/domains/funnels/constants/storage-keys.ts:31` | `funnelUtmKey` | function | 3 | `src/shared/domains/funnels/hooks/use-funnel-utm.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/domains/funnels/lib/build-lead-enrichment.ts:35` | `enrichmentSignature` | function | 6 | `src/shared/domains/funnels/hooks/use-progressive-enrichment.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/domains/funnels/lib/funnel-flow.ts:8` | `defaultLinearNext` | function | 4 | `src/shared/domains/funnels/hooks/use-funnel-engine.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/domains/funnels/lib/og/og-assets.ts:27` | `readPublicBuffer` | function | 3 | `src/shared/domains/funnels/lib/og/load-og-fonts.ts` · sibling | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/domains/funnels/lib/scroll-funnel-to-top.ts:10` | `scrollFunnelToTop` | function | 6 | `src/shared/domains/funnels/hooks/use-funnel-engine.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/domains/multi-step-flow/lib/linear-next.ts:4` | `linearNext` | function | 7 | `src/shared/domains/multi-step-flow/hooks/use-step-engine.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/lib/file-optimization/strategies/pdf.ts:13` | `readPdfPageCount` | function | 10 | `src/shared/lib/file-optimization/optimize-file.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| ⚠ `src/shared/modules/proposals/incentives/lib/incentive-rows.ts:31` | `domainIncentivesToRows` | function | 13 | `src/shared/modules/proposals/incentives/service.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/services/media/optimization-target.ts:24` | `getOptimizationTarget` | function | 3 | `src/shared/services/media/optimize-media.ts` · sibling | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/services/providers/justcall/mappers/resolve-field-ids.ts:6` | `resolveFieldIds` | function | 10 | `src/shared/services/providers/justcall/dialer-provider.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/services/providers/quickbooks/lib/access-token-cache.ts:4` | `getStoredTokens` | function | 4 | `src/shared/services/providers/quickbooks/lib/get-access-token.ts` · sibling | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/services/providers/quickbooks/lib/get-access-token.ts:56` | `getQBAccessToken` | function | 11 | `src/shared/services/providers/quickbooks/client.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/services/providers/zoho-sign/lib/access-token-cache.ts:6` | `getCachedAccessToken` | function | 7 | `src/shared/services/providers/zoho-sign/lib/get-access-token.ts` · sibling | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/services/providers/zoho-sign/lib/access-token-cache.ts:14` | `setCachedAccessToken` | function | 6 | `src/shared/services/providers/zoho-sign/lib/get-access-token.ts` · sibling | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/services/voip/campaigns/lib/field-label-map.ts:19` | `mapFieldLabelToAppKey` | function | 3 | `src/shared/services/voip/campaigns/campaign-sync.service.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |
| `src/shared/services/voip/campaigns/lib/render-sms-template.ts:11` | `renderSmsTemplate` | function | 6 | `src/shared/services/voip/campaigns/sms-cadence.service.ts` · same-module | thin helper, one non-UI consumer in same module → inline / make private |

### Inline small constant — 12

A small constant with one non-UI consumer in the same module. **Action:** Usually keep (constants/ is a sanctioned home); inline only when the constants file is otherwise empty.

Constants files are a sanctioned home (Rule 6); these are listed for completeness, not as a to-do.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| `src/features/meeting-flow/constants/scheduling.ts:2` | `MEETING_ESTIMATED_DURATION_MS` | const | 1 | `src/features/meeting-flow/lib/meeting-row-class.ts` · same-module | small constant, one non-UI consumer in same module |
| `src/features/schedule-management/constants/activity-filter-config.tsx:48` | `ACTIVITY_PAGE_SIZE_OPTIONS` | const-data | 1 | `src/features/schedule-management/constants/activities-table-query-config.ts` · sibling | small constant, one non-UI consumer in same module |
| `src/features/schedule-management/constants/query-parsers.ts:3` | `highlightMeetingParser` | const-call | 1 | `src/features/schedule-management/hooks/use-schedule-highlight.ts` · same-module | small constant, one non-UI consumer in same module |
| `src/features/schedule-management/constants/query-parsers.ts:4` | `highlightDateParser` | const-call | 1 | `src/features/schedule-management/hooks/use-schedule-highlight.ts` · same-module | small constant, one non-UI consumer in same module |
| `src/shared/constants/nav-items/tpr-internal.ts:5` | `tprInternalNavItems` | const-data | 7 | `src/shared/constants/nav-items/index.ts` · sibling | small constant, one non-UI consumer in same module |
| `src/shared/dal/client/lib/constants.ts:9` | `DEFAULT_DEBOUNCE_MS` | const-literal | 1 | `src/shared/dal/client/hooks/use-paginated-query.ts` · same-module | small constant, one non-UI consumer in same module |
| `src/shared/dal/lib/query/constants.ts:5` | `MAX_PAGE` | const-literal | 1 | `src/shared/dal/lib/query/derive-paginated-query-state.ts` · sibling | small constant, one non-UI consumer in same module |
| `src/shared/domains/funnels/lib/tracking/convention-map.ts:13` | `STEP_KIND_BROWSER_EVENT` | const-data | 3 | `src/shared/domains/funnels/lib/tracking/use-funnel-tracking.ts` · sibling | small constant, one non-UI consumer in same module |
| `src/shared/entities/activities/constants/index.ts:20` | `ACTIVITY_ACTIONS` | const-data | 6 | `src/shared/entities/activities/hooks/use-activity-action-configs.ts` · same-module | small constant, one non-UI consumer in same module |
| `src/shared/entities/applications/lib/constants.ts:11` | `TRADES_QUESTION_KEY` | const-literal | 1 | `src/shared/entities/applications/dal/server/mutations.ts` · same-module | small constant, one non-UI consumer in same module |
| `src/shared/entities/meetings/constants/outcome-options.ts:6` | `MEETING_OUTCOME_OPTIONS` | const-call | 5 | `src/shared/entities/meetings/hooks/use-meeting-action-configs.tsx` · same-module | small constant, one non-UI consumer in same module |
| `src/shared/services/providers/justcall/client.ts:241` | `justcallClient` | const-call | 1 | `src/shared/services/providers/justcall/dialer-provider.ts` · sibling | small constant, one non-UI consumer in same module |


## Single-use exports — review (judgment calls)

### Relocate shared component — 13

A shared/components/ component consumed by exactly one feature. **Action:** Decide: move into that feature (locality) or keep as designed-reusable.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| `src/shared/components/calendar/ui/calendar-header.tsx:21` | `CalendarHeader` | component | 66 | `src/features/schedule-management/ui/components/schedule-calendar.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/calendar/ui/calendar-month-view.tsx:21` | `CalendarMonthView` | component | 77 | `src/features/schedule-management/ui/components/schedule-calendar.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/contract-status-panel/ui/contract-status-panel.tsx:29` | `ContractStatusPanel` | component | 46 | `src/features/proposal-flow/constants/proposal-steps.ts` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/dialogs/modals/templates-modal.tsx:14` | `TemplatesModal` | component | 48 | `src/features/proposal-flow/ui/components/form/sow-field.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/entity-actions/entity-view-button.tsx:18` | `EntityViewButton` | component | 40 | `src/features/project-management/ui/views/edit-project-view.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/image-slider.tsx:14` | `CustomImageSlider` | component | 44 | `src/features/proposal-flow/ui/components/proposal/related-projects.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/kanban/ui/kanban-board.tsx:36` | `KanbanBoard` | component | 90 | `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/kanban/ui/kanban-column-filter.tsx:21` | `KanbanColumnFilter` | component | 67 | `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/media/media-manager.tsx:38` | `MediaManager` | component | 92 | `src/features/proposal-flow/ui/components/form/proposal-media-manager.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/reviews/review-card.tsx:33` | `ReviewCard` | component | 25 | `src/shared/domains/funnels/ui/blocks/reviews-block.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/stat-bar/ui/stat-bar.tsx:19` | `StatBar` | component | 83 | `src/features/customer-pipelines/ui/components/customer-pipeline-metrics-bar.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/tiptap/tiptap.tsx:30` | `Tiptap` | component | 119 | `src/features/proposal-flow/ui/components/form/sow-field.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |
| `src/shared/components/trust/credential-strip.tsx:9` | `CredentialStrip` | component | 13 | `src/shared/domains/funnels/ui/blocks/callout-block.tsx` · cross-module | shared component with one feature consumer → move into that feature (locality) |

### Owned by #285 — 18

Legacy visibility seam scheduled for removal by the permissions work. **Action:** Do not touch here.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| `src/shared/entities/app-settings/lib/visibility.ts:13` | `appSettingVisibility` | function | 3 | `src/shared/entities/app-settings/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/applications/lib/visibility.ts:9` | `applicationVisibility` | function | 3 | `src/shared/entities/applications/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/customer-notes/lib/assert-note-author.ts:7` | `assertNoteAuthorOrAdmin` | function | 10 | `src/shared/entities/customer-notes/dal/server/crud.ts` · same-module | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/customer-notes/lib/visibility.ts:16` | `customerNoteVisibility` | function | 3 | `src/shared/entities/customer-notes/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/customers/dal/server/visibility.ts:22` | `leadsPoolVisibility` | function | 6 | `src/shared/entities/customers/lib/visibility.ts` · same-module | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/customers/lib/visibility.ts:8` | `customerVisibility` | function | 8 | `src/shared/entities/customers/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/lead-sources/lib/visibility.ts:15` | `leadSourceVisibility` | function | 3 | `src/shared/entities/lead-sources/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/meetings/lib/visibility.ts:9` | `meetingVisibility` | function | 3 | `src/shared/entities/meetings/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/projects/lib/visibility.ts:31` | `projectVisibility` | function | 3 | `src/shared/entities/projects/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/projects/lib/visibility.ts:44` | `hasAssociatedMeeting` | function | 8 | `src/shared/entities/projects/dal/server/queries.ts` · same-module | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/voip-calls/lib/visibility.ts:14` | `voipCallVisibility` | function | 3 | `src/shared/entities/voip-calls/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/voip-campaign-contacts/lib/visibility.ts:18` | `voipCampaignContactVisibility` | function | 3 | `src/shared/entities/voip-campaign-contacts/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/voip-campaigns/lib/visibility.ts:14` | `voipCampaignVisibility` | function | 3 | `src/shared/entities/voip-campaigns/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/voip-contact-fields/lib/visibility.ts:14` | `voipContactFieldVisibility` | function | 3 | `src/shared/entities/voip-contact-fields/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/voip-dids/lib/visibility.ts:15` | `voipDidVisibility` | function | 3 | `src/shared/entities/voip-dids/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/voip-link-tokens/lib/visibility.ts:17` | `voipLinkTokenVisibility` | function | 3 | `src/shared/entities/voip-link-tokens/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/entities/voip-messages/lib/visibility.ts:17` | `voipMessageVisibility` | function | 3 | `src/shared/entities/voip-messages/lib/server-spec.ts` · sibling | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |
| `src/shared/modules/proposals/core/lib/visibility.ts:9` | `proposalVisibility` | function | 3 | `src/shared/modules/proposals/core/server-spec.ts` · same-module | legacy visibility seam; #285 CASL Phase A owns its removal — do not touch |

### Sizeable helper with one caller — 11

A >15-line function with one same-module caller. **Action:** Consider merging into the caller file as a private function.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| `src/features/landing/lib/get-trade-images.ts:15` | `getTradeImages` | function | 52 | `src/features/landing/lib/notion-trade-helpers.ts` · sibling | sizeable helper with one consumer; could move into consumer file as private |
| `src/features/project-management/lib/filter-projects.ts:10` | `filterPortfolioProjects` | function | 39 | `src/features/project-management/hooks/use-portfolio-filters.ts` · same-module | sizeable helper with one consumer; could move into consumer file as private |
| `src/shared/domains/pipelines/lib/on-pipeline-change.ts:17` | `onPipelineChange` | function | 26 | `src/shared/domains/pipelines/hooks/use-pipeline-change.ts` · same-module | sizeable helper with one consumer; could move into consumer file as private |
| ⚠ `src/shared/modules/proposals/incentives/dal/server/mutations.ts:21` | `replaceGlobalIncentiveRows` | function | 17 | `src/shared/modules/proposals/incentives/service.ts` · same-module | sizeable helper with one consumer; could move into consumer file as private |
| `src/shared/modules/proposals/incentives/lib/incentive-rows.ts:9` | `incentiveRowsToDomain` | function | 20 | `src/shared/modules/proposals/core/lib/funding-columns.ts` · same-module | sizeable helper with one consumer; could move into consumer file as private |
| `src/shared/services/providers/justcall/webhooks/events.ts:73` | `verifyJustcallSignature` | function | 21 | `src/shared/services/providers/justcall/webhooks/adapter.ts` · sibling | sizeable helper with one consumer; could move into consumer file as private |
| `src/shared/services/providers/notion/lib/blocks-to-tiptap-json.ts:39` | `notionBlocksToTiptapDoc` | function | 47 | `src/shared/services/providers/notion/lib/page-to-tiptap-json.ts` · sibling | sizeable helper with one consumer; could move into consumer file as private |
| `src/shared/services/providers/notion/lib/property-filter.ts:3` | `buildPropertyFilter` | function | 25 | `src/shared/services/providers/notion/dal/query-notion-database.ts` · same-module | sizeable helper with one consumer; could move into consumer file as private |
| `src/shared/services/providers/web-push/lib/build-payload.ts:43` | `buildPushPayload` | function | 34 | `src/shared/services/providers/web-push/client.ts` · same-module | sizeable helper with one consumer; could move into consumer file as private |
| `src/shared/services/voip/campaigns/lib/build-neutral-fields.ts:61` | `buildNeutralFields` | function | 30 | `src/shared/services/voip/campaigns/enrollment.service.ts` · same-module | sizeable helper with one consumer; could move into consumer file as private |
| `src/shared/services/voip/campaigns/lib/decide-cadence-sms.ts:27` | `decideCadenceSms` | function | 21 | `src/shared/services/voip/campaigns/sms-cadence.service.ts` · same-module | sizeable helper with one consumer; could move into consumer file as private |

### Cross-module single-use type — 4

Type used by exactly one file in another module. **Action:** Move or keep as public type.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| ⚠ `src/shared/dal/server/types.ts:218` | `SlotName` | type | 1 | `src/trpc/lib/create-crud-router.ts` (via `src/trpc/types.ts`) · cross-module | cross-module single consumer type; move or keep as public type |
| ⚠ `src/shared/modules/proposals/core/types.ts:6` | `FormMetaSection` | interface | 1 | `src/shared/db/schema/proposals.ts` · cross-module | cross-module single consumer type; move or keep as public type |
| ⚠ `src/shared/modules/proposals/core/types.ts:8` | `FundingSection` | interface | 1 | `src/shared/db/schema/proposals.ts` · cross-module | cross-module single consumer type; move or keep as public type |
| `src/shared/services/voip/dialer/types.ts:68` | `DialerProvider` | interface | 8 | `src/shared/services/providers/justcall/dialer-provider.ts` · cross-module | cross-module single consumer type; move or keep as public type |

### Unsanctioned re-export — 2

Re-export outside the sanctioned barrel list with one cross-module consumer. **Action:** Review.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| `src/shared/constants/nav-items/marketing.ts:82` | `ServiceSlugs` | reexport | 1 | `src/features/landing/constants/experience-service-icons.ts` · cross-module | unsanctioned re-export with one cross-module consumer ⇐ `src/shared/constants/company/services.ts` |
| `src/trpc/init.ts:9` | `createHTTPTRPCContext` | reexport | 1 | `src/app/api/trpc/[trpc]/route.ts` · cross-module | unsanctioned re-export with one cross-module consumer ⇐ `src/trpc/lib/create-http-context.ts` |

### JSONB ledger — 2

Decomposition leftover. **Action:** Consult the deprecation ledger first.

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| `src/features/meeting-flow/lib/get-jsonb-section.ts:9` | `getJsonbSection` | function | 10 | `src/features/meeting-flow/lib/step-completion.ts` · sibling | JSONB decomposition leftover — consult docs/plans/jsonb-decomposition-deprecation-ledger.md before touching |
| `src/shared/types/jsonb.ts:7` | `JsonbSectionMap` | interface | 4 | `src/features/meeting-flow/lib/get-jsonb-section.ts` · cross-module | JSONB decomposition leftover — consult docs/plans/jsonb-decomposition-deprecation-ledger.md before touching |

### Cross-module single consumer — 211

Defined in one module, used by exactly one file in a different module. **Action:** Check whether it belongs next to its consumer.

Largest bucket: a symbol defined in one module and consumed by exactly one file in another. Many are legitimately shared infrastructure that happens to have one caller today; the ones to look at are components/helpers in `shared/` whose only caller is one feature.

<details><summary>211 rows</summary>

| Defined at | Export | Kind | Lines | Sole consumer | Note |
|---|---|---|---|---|---|
| `src/features/agent-dashboard/dal/server/get-action-queue.ts:118` | `getActionQueue` | function | 108 | `src/trpc/routers/dashboard.router.ts` · cross-module | cross-module helper with one consumer |
| `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts:20` | `getCustomerPipelineItems` | function | 17 | `src/trpc/routers/customer-pipelines.router.ts` · cross-module | cross-module helper with one consumer |
| `src/features/customer-pipelines/dal/server/get-customer-profile.ts:35` | `getCustomerProfile` | function | 218 | `src/trpc/routers/customer-pipelines.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/features/customer-pipelines/dal/server/move-customer-pipeline-item.ts:32` | `moveCustomerPipelineItem` | function | 138 | `src/trpc/routers/customer-pipelines.router.ts` · cross-module | cross-module helper with one consumer |
| `src/features/customer-pipelines/dal/server/move-customer-to-pipeline.ts:22` | `moveCustomerToPipeline` | function | 16 | `src/trpc/routers/customer-pipelines.router.ts` · cross-module | cross-module helper with one consumer |
| `src/features/customer-pipelines/ui/components/assign-project-dialog.tsx:29` | `AssignProjectDialog` | component | 161 | `src/features/meeting-flow/ui/components/table/index.tsx` · cross-module | cross-module single consumer |
| ⚠ `src/features/customer-pipelines/ui/components/create-project-modal.tsx:19` | `CreateProjectModal` | component | 32 | `src/features/proposal-flow/ui/components/table/index.tsx` · cross-module | cross-module single consumer |
| `src/features/landing/dal/server/projects.ts:34` | `getProjectByAccessor` | function | 29 | `src/trpc/routers/landing.router/projects.router.ts` · cross-module | cross-module helper with one consumer |
| `src/features/meeting-flow/lib/build-persona-profile.ts:365` | `buildPersonaProfile` | function | 20 | `src/trpc/routers/meeting-flow.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/features/meeting-flow/lib/build-proposal-defaults.ts:9` | `buildProposalDefaults` | function | 77 | `src/features/proposal-flow/ui/views/create-new-proposal-view.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/features/meeting-flow/lib/get-cached-pain-points.ts:5` | `getCachedPainPoints` | const-call | 8 | `src/trpc/routers/meeting-flow.router.ts` · cross-module | cross-module constant with one consumer |
| `src/features/meeting-flow/lib/to-calendar-event.ts:8` | `toCalendarEvent` | function | 24 | `src/features/schedule-management/ui/components/schedule-calendar.tsx` (via `src/features/meeting-flow/lib/index.ts`) · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/components/calendar/lib/calendar-helpers.ts:60` | `getDateRange` | function | 13 | `src/features/schedule-management/ui/components/schedule-calendar.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/components/calendar/lib/calendar-helpers.ts:107` | `getWeekDays` | function | 5 | `src/features/schedule-management/ui/components/schedule-week-view.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/config/subdomains.ts:13` | `SUBDOMAIN_ROUTES` | const-call | 3 | `src/middleware.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/config/subdomains.ts:22` | `SUBDOMAIN_LABELS` | const-call | 1 | `src/shared/lib/main-site-url.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/constants/company/service-area-cities.ts:12` | `SERVICE_AREA_CITIES` | const-data | 86 | `src/shared/domains/funnels/lib/resolve-zip.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/constants/company/service-area.ts:9` | `isInServiceArea` | function | 3 | `src/shared/domains/funnels/lib/resolve-zip.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/constants/css-breakpoints.ts:1` | `BREAKPOINTS` | const-data | 7 | `src/shared/hooks/use-match-media.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/constants/enums/customer-pipelines.ts:1` | `customerPipelines` | const-data | 1 | `src/shared/db/schema/customers.ts` (via `src/shared/constants/enums/index.ts`) · cross-module | cross-module constant with one consumer |
| `src/shared/constants/enums/meetings.ts:102` | `isNegativeOutcome` | function | 3 | `src/features/meeting-flow/constants/meetings-stat-config.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/constants/enums/pipelines.ts:116` | `stagesForBuckets` | function | 3 | `src/shared/entities/projects/dal/server/queries.ts` (via `src/shared/constants/enums/index.ts`) · cross-module | cross-module helper with one consumer |
| `src/shared/constants/gcal-colors.ts:2` | `GCAL_MEETING_COLORS` | const-data | 5 | `src/shared/services/providers/google-calendar/lib/map-to-gcal.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/constants/gcal-colors.ts:8` | `GCAL_ACTIVITY_COLORS` | const-data | 5 | `src/shared/services/providers/google-calendar/lib/map-to-gcal.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/constants/nav-items/index.ts:26` | `generateNavItemsGroups` | function | 15 | `src/shared/components/navigation/site-navbar.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/constants/storage-keys.ts:2` | `STORAGE_KEY_PREFIX` | const-literal | 1 | `src/shared/domains/funnels/constants/storage-keys.ts` · cross-module | cross-module constant with one consumer |
| ⚠ `src/shared/dal/server/lib/scope.ts:67` | `isVisible` | function | 15 | `src/shared/modules/proposals/media/service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/dal/server/lib/scope.ts:90` | `isInScope` | function | 8 | `src/shared/modules/proposals/views/dal/server/queries.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/dal/server/lib/upsert-one-to-one.ts:21` | `upsertOneToOne` | function | 39 | `src/shared/entities/customers/dal/server/mutations.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/dal/server/webhook-logs.ts:7` | `insertBinaWebhookLog` | function | 16 | `src/shared/services/webhook.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/domains/funnels/lib/build-funnel-lead-note.ts:9` | `buildFunnelLeadNote` | function | 18 | `src/shared/services/customer-intake.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/domains/funnels/lib/og/load-og-fonts.ts:13` | `loadOgFonts` | function | 4 | `src/app/(frontend)/funnels/[trade]/opengraph-image.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/domains/funnels/lib/og/og-assets.ts:32` | `readPublicDataUri` | function | 5 | `src/app/(frontend)/funnels/[trade]/opengraph-image.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/domains/pipelines/hooks/pipeline-context.tsx:56` | `getStoredPipeline` | function | 12 | `src/features/agent-dashboard/ui/components/app-sidebar.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/domains/pipelines/lib/compute-fresh-stage.ts:15` | `computeFreshStage` | function | 52 | `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/domains/pipelines/lib/compute-pipeline-value.ts:30` | `computeProjectValue` | function | 9 | `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/domains/pipelines/lib/compute-pipeline-value.ts:40` | `computePipelineValue` | function | 36 | `src/features/customer-pipelines/dal/server/get-customer-pipeline-items.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/domains/pipelines/lib/outcome-pipeline-map.ts:3` | `OUTCOME_PIPELINE_MAP` | const-data | 17 | `src/shared/entities/meetings/dal/server/crud.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/entities/accounts/dal/server/google-calendar.ts:17` | `getAccountByChannelId` | function | 5 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/accounts/dal/server/google-calendar.ts:23` | `getAccountsWithGCalEnabled` | function | 6 | `src/shared/services/providers/upstash/jobs/sync-calendars.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/accounts/dal/server/google-calendar.ts:33` | `updateAccountTokens` | function | 6 | `src/shared/services/providers/google-drive/token.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/accounts/dal/server/google-calendar.ts:40` | `updateAccountGCalFields` | function | 8 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/accounts/dal/server/google-calendar.ts:49` | `clearAccountGCalFields` | function | 10 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/activities/dal/server/google-calendar.ts:8` | `getSyncableActivitiesForUser` | function | 5 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/activities/dal/server/google-calendar.ts:14` | `getActivityById` | function | 5 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/activities/dal/server/google-calendar.ts:20` | `getActivityByGCalEventId` | function | 12 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/activities/dal/server/google-calendar.ts:35` | `updateActivityGCalFields` | function | 8 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/activities/dal/server/google-calendar.ts:44` | `clearActivityGCalFields` | function | 5 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/activities/dal/server/google-calendar.ts:50` | `clearAllActivityGCalFieldsForUser` | function | 5 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/activities/dal/server/google-calendar.ts:56` | `updateActivityFromGCal` | function | 8 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/activities/dal/server/google-calendar.ts:65` | `createActivityFromGCalEvent` | function | 5 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/activities/dal/server/google-calendar.ts:71` | `deleteActivity` | function | 3 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/entities/activities/lib/constants.ts:3` | `ACTIVITY` | const-literal | 1 | `src/shared/domains/permissions/abilities.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/entities/applications/dal/server/mutations.ts:26` | `saveDraft` | function | 26 | `src/trpc/routers/applications.router/draft.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/applications/dal/server/mutations.ts:62` | `submitApplication` | function | 86 | `src/trpc/routers/applications.router/draft.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/applications/dal/server/mutations.ts:155` | `withdraw` | function | 25 | `src/trpc/routers/applications.router/draft.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/applications/dal/server/queries.ts:25` | `listApplications` | function | 17 | `src/trpc/routers/applications.router/business.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/applications/dal/server/queries.ts:50` | `getApplicationWithAnswers` | function | 24 | `src/trpc/routers/applications.router/business.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/applications/lib/server-spec.ts:16` | `applicationSchemas` | const-data | 4 | `src/trpc/routers/applications.router/crud.router.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/entities/customer-notes/lib/server-spec.ts:23` | `customerNoteSchemas` | const-data | 4 | `src/trpc/routers/customer-notes.router/index.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/entities/customers/dal/server/ad-performance.ts:63` | `leadsByAdKey` | function | 14 | `src/shared/domains/analytics/sources/local/leads-per-adkey.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/ad-performance.ts:79` | `appointmentsByAdKey` | function | 15 | `src/shared/domains/analytics/sources/local/appointments-per-adkey.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/ad-performance.ts:96` | `signedByAdKey` | function | 14 | `src/shared/domains/analytics/sources/local/signed-per-adkey.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/measurement.ts:10` | `getCustomerForMeasurement` | function | 25 | `src/shared/services/measurement.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/measurement.ts:36` | `markMetaScheduleSent` | function | 3 | `src/shared/services/measurement.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/mutations.ts:59` | `upsertLeadAttribution` | function | 37 | `src/shared/services/customer-intake.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/mutations.ts:105` | `upsertFunnelEnrichment` | function | 22 | `src/shared/services/customer-intake.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/queries.ts:107` | `getCustomerAttribution` | function | 11 | `src/shared/services/customer-intake.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/queries.ts:125` | `findCustomerByPhone` | function | 16 | `src/shared/services/voip/campaigns/lib/resolve-customer.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/queries.ts:146` | `isCustomerInLeads` | function | 10 | `src/shared/services/voip/campaigns/enrollment.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/dal/server/queries.ts:163` | `listEnrollableLeadsBySource` | function | 15 | `src/shared/services/providers/upstash/jobs/enroll-source-batch.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/customers/lib/customer-predicates.ts:33` | `hasCustomerProfileData` | function | 8 | `src/features/meeting-flow/ui/views/meeting-flow.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| ⚠ `src/shared/entities/customers/lib/get-meeting-time-label.ts:8` | `getMeetingTimeLabel` | function | 20 | `src/features/customer-pipelines/ui/components/customer-kanban-card.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/entities/customers/lib/server-spec.ts:22` | `customerSchemas` | const-data | 4 | `src/trpc/routers/customers.router/crud.router.ts` · cross-module | cross-module constant with one consumer |
| ⚠ `src/shared/entities/finance-options/dal/server/queries.ts:5` | `getFinanceOptions` | function | 8 | `src/trpc/routers/proposals.router/business.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/lead-sources/constants/customer-segments.ts:1` | `customerSegments` | const-data | 1 | `src/trpc/routers/lead-sources.router.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/entities/lead-sources/dal/server/mutations.ts:28` | `setVoipCampaignsPolicy` | function | 23 | `src/trpc/routers/voip-campaigns.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/lead-sources/dal/server/queries.ts:14` | `getLeadSourceById` | function | 10 | `src/shared/services/voip/campaigns/enrollment.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/lead-sources/dal/server/queries.ts:29` | `listLeadSources` | function | 8 | `src/trpc/routers/voip-campaigns.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/media-files/dal/server/media-ops.ts:24` | `listMediaByOwner` | function | 14 | `src/shared/services/media/media.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/media-files/dal/server/media-ops.ts:44` | `reorderMedia` | function | 16 | `src/shared/services/media/media.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/entities/media-files/dal/server/mutations.ts:15` | `moveMediaPhase` | function | 16 | `src/trpc/routers/projects.router/media.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/entities/media-files/dal/server/mutations.ts:37` | `setHeroImage` | function | 21 | `src/trpc/routers/projects.router/media.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/media-files/dal/server/optimization.ts:16` | `setMediaOptimizationProcessing` | function | 3 | `src/shared/services/media/optimize-media.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/media-files/dal/server/optimization.ts:20` | `setMediaOptimizationComplete` | function | 18 | `src/shared/services/media/optimize-media.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/media-files/dal/server/optimization.ts:39` | `setMediaOptimizationFailed` | function | 3 | `src/shared/services/media/optimize-media.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/media-files/dal/server/optimization.ts:43` | `resetMediaOptimizationStatus` | function | 3 | `src/shared/services/media/media.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/components/create-meeting-modal.tsx:25` | `CreateMeetingModal` | component | 36 | `src/features/customer-pipelines/ui/views/customer-pipeline-view.tsx` · cross-module | cross-module single consumer |
| `src/shared/entities/meetings/dal/server/google-calendar.ts:11` | `getMeetingForGCal` | function | 50 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/google-calendar.ts:62` | `getAllMeetingsWithSchedule` | function | 6 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/google-calendar.ts:74` | `getMeetingsForCustomerWithGCalEvent` | function | 11 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/google-calendar.ts:86` | `getMeetingByGCalEventId` | function | 12 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/google-calendar.ts:116` | `clearAllMeetingGCalFields` | function | 5 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/google-calendar.ts:122` | `updateMeetingScheduledFor` | function | 8 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/entities/meetings/dal/server/mutations.ts:26` | `deriveOutcomeOnProposalSent` | function | 22 | `src/trpc/routers/proposals.router/delivery.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/entities/meetings/dal/server/mutations.ts:57` | `deriveOutcomeOnAdditionalWorkApproved` | function | 21 | `src/shared/services/contracts.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/participants.ts:23` | `isParticipant` | function | 12 | `src/trpc/routers/meetings.router/participants.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/participants.ts:61` | `getParticipantByRole` | function | 8 | `src/trpc/routers/meetings.router/participants.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/participants.ts:70` | `countParticipantsByRole` | function | 11 | `src/trpc/routers/meetings.router/participants.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/participants.ts:177` | `removeParticipant` | function | 8 | `src/trpc/routers/meetings.router/participants.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/participants.ts:186` | `updateParticipantRole` | function | 12 | `src/trpc/routers/meetings.router/participants.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/dal/server/queries.ts:115` | `listMeetings` | function | 138 | `src/trpc/routers/meetings.router/reads.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/meetings/lib/server-spec.ts:14` | `meetingSchemas` | const-data | 4 | `src/trpc/routers/meetings.router/crud.router.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/entities/projects/dal/server/crud.ts:46` | `createProjectWithScopes` | function | 12 | `src/trpc/routers/projects.router/crud.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/projects/dal/server/queries.ts:114` | `getProjectForEdit` | function | 28 | `src/trpc/routers/projects.router/crud.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/projects/dal/server/queries.ts:147` | `getAllProjects` | function | 29 | `src/trpc/routers/projects.router/crud.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/projects/dal/server/queries.ts:197` | `listProjects` | function | 93 | `src/trpc/routers/projects.router/crud.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/projects/dal/server/queries.ts:297` | `getProjectScopeCountsByScopeIds` | function | 23 | `src/features/landing/lib/get-trade-images.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/push-subscriptions/dal/server/queries.ts:26` | `upsertPushSubscription` | function | 35 | `src/trpc/routers/push.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/push-subscriptions/dal/server/queries.ts:63` | `deletePushSubscriptionForUser` | function | 5 | `src/trpc/routers/push.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/push-subscriptions/dal/server/queries.ts:69` | `getPushSubscriptionsByUser` | function | 6 | `src/shared/services/providers/web-push/client.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/push-subscriptions/dal/server/queries.ts:76` | `getPushSubscriptionsByUsers` | function | 9 | `src/shared/services/providers/web-push/client.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/push-subscriptions/dal/server/queries.ts:88` | `deletePushSubscriptionsByEndpoint` | function | 6 | `src/shared/services/providers/web-push/client.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/push-subscriptions/dal/server/queries.ts:97` | `markPushSuccess` | function | 9 | `src/shared/services/providers/web-push/client.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/push-subscriptions/dal/server/queries.ts:110` | `markPushFailure` | function | 9 | `src/shared/services/providers/web-push/client.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/users/dal/server/mutations.ts:36` | `updateUserProfile` | function | 13 | `src/trpc/routers/agent-settings.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/entities/users/dal/server/queries.ts:16` | `getUserIdsByEmails` | function | 9 | `src/shared/services/notification.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-calls/dal/server/mutations.ts:35` | `upsertInboundCall` | function | 27 | `src/shared/services/voip/voip-calls.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-calls/dal/server/mutations.ts:90` | `patchCallStatusByProviderId` | function | 20 | `src/shared/services/voip/voip-calls.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts:39` | `upsertEnrolled` | function | 38 | `src/shared/services/voip/campaigns/enrollment.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts:84` | `markUnenrolled` | function | 18 | `src/shared/services/voip/campaigns/enrollment.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts:112` | `repointCampaign` | function | 13 | `src/shared/services/voip/campaigns/enrollment.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts:153` | `claimAndIncrementDialAttempt` | function | 20 | `src/shared/services/voip/campaigns/sms-cadence.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/mutations.ts:178` | `recordAutoSmsSent` | function | 11 | `src/shared/services/voip/campaigns/sms-cadence.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:36` | `findActiveEnrollment` | function | 22 | `src/shared/services/voip/campaigns/enrollment.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:64` | `findCustomerIdByProviderContactId` | function | 13 | `src/shared/services/voip/campaigns/lib/resolve-customer.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:100` | `findSmsCadenceContextByProviderContactId` | function | 45 | `src/shared/services/voip/campaigns/sms-cadence.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:151` | `listActiveCustomerIdsBySource` | function | 13 | `src/trpc/routers/voip-campaigns.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:178` | `listEnrolledLeadsBySource` | function | 20 | `src/trpc/routers/voip-campaigns.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:211` | `countLeadsByStatusPerSource` | function | 20 | `src/trpc/routers/voip-campaigns.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:274` | `listLeadsPaginated` | function | 88 | `src/trpc/routers/voip-campaigns.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaigns/dal/server/mutations.ts:35` | `upsertCampaignByProviderId` | function | 33 | `src/shared/services/voip/campaigns/campaign-sync.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-campaigns/dal/server/queries.ts:15` | `listVoipCampaigns` | function | 8 | `src/trpc/routers/voip-campaigns.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-contact-fields/dal/server/mutations.ts:32` | `upsertContactFieldByAppKey` | function | 26 | `src/shared/services/voip/campaigns/campaign-sync.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-dids/dal/server/mutations.ts:28` | `assignToUser` | function | 30 | `src/shared/services/voip/voip-dids.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-dids/dal/server/mutations.ts:69` | `promoteToPrimary` | function | 40 | `src/shared/services/voip/voip-dids.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-dids/dal/server/mutations.ts:119` | `unassign` | function | 14 | `src/shared/services/voip/voip-dids.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-dids/dal/server/mutations.ts:161` | `reconcileWithProvider` | function | 58 | `src/shared/services/voip/voip-dids.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-dids/dal/server/queries.ts:60` | `getDidByProviderId` | function | 11 | `src/shared/services/voip/voip-dids.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-link-tokens/dal/server/queries.ts:18` | `getTokenByValue` | function | 18 | `src/shared/services/voip/voip-link-tokens.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-link-tokens/dal/server/queries.ts:42` | `markTokenUsed` | function | 14 | `src/shared/services/voip/voip-link-tokens.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-messages/dal/server/mutations.ts:30` | `upsertInboundMessage` | function | 27 | `src/shared/services/voip/voip-messages.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-messages/dal/server/mutations.ts:73` | `patchMessageStatusByProviderId` | function | 18 | `src/shared/services/voip/voip-messages.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/entities/voip-messages/dal/server/queries.ts:27` | `fetchThread` | function | 21 | `src/shared/services/voip/voip-messages.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/lib/file-optimization/optimize-file.ts:33` | `optimizeFile` | function | 24 | `src/shared/services/media/optimize-media.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/lib/formatters.ts:38` | `formatCustomerAddress` | function | 15 | `src/shared/entities/customers/components/profile/customer-hero-header.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| ⚠ `src/shared/lib/formatters.ts:123` | `formatMeetingShortStamp` | function | 15 | `src/shared/entities/meetings/components/overview-card.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/lib/get-optimized-urls.ts:73` | `getOptimizedSrcSet` | function | 34 | `src/shared/components/optimized-image.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/lib/google-maps-helpers.ts:57` | `parseAddressComponents` | function | 21 | `src/shared/components/inputs/address-autocomplete.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/lib/hydration-drift.ts:23` | `recordHydratedKeys` | function | 8 | `src/trpc/components/hydration-key-recorder.tsx` · cross-module | cross-module helper with one consumer |
| `src/shared/lib/loan-calculations.ts:6` | `amortizedMonthlyPayment` | function | 14 | `src/shared/entities/meetings/lib/compute-deal-derived.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/lib/loan-calculations.ts:26` | `getLoanValues` | function | 11 | `src/features/proposal-flow/ui/components/proposal/funding.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/lib/pagination-format.ts:8` | `formatPageOf` | function | 7 | `src/shared/components/data-table/ui/data-table-pagination.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| ⚠ `src/shared/lib/pdf/proposal-doc-definition.ts:26` | `buildProposalDocDefinition` | function | 58 | `src/shared/services/pdf.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/lib/pdf/render-pdf.ts:33` | `renderPdf` | function | 5 | `src/shared/services/pdf.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/lib/phone.ts:78` | `formatPhoneAsYouType` | function | 13 | `src/shared/domains/funnels/ui/steps/phone-input.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/lib/phone.ts:108` | `isPlausibleUsPhone` | function | 22 | `src/shared/services/providers/twilio/lib/validate-phone-line.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/lib/push.ts:13` | `urlBase64ToUint8Array` | function | 10 | `src/shared/hooks/use-push-subscription.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/lib/pwa.ts:57` | `openExternalUrl` | function | 10 | `src/shared/components/contact-actions/ui/address-action.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/lib/sanitize-html.ts:4` | `sanitizeUserHtml` | function | 54 | `src/features/proposal-flow/ui/components/proposal/scope-of-work.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/lib/slugify-trade-name.ts:1` | `slugifyTradeName` | function | 9 | `src/shared/services/providers/notion/lib/trades/adapter.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/lib/slugify.ts:5` | `slugify` | function | 9 | `src/shared/entities/lead-sources/dal/server/crud.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/modules/proposals/core/dal/server/mutations.ts:55` | `setCashInDeal` | function | 29 | `src/trpc/routers/proposals.router/funding.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/modules/proposals/core/dal/server/queries.ts:164` | `listProposals` | function | 115 | `src/trpc/routers/proposals.router/business.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/modules/proposals/core/dal/server/queries.ts:311` | `getProposalsByIds` | function | 14 | `src/shared/services/accounting.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/modules/proposals/core/dal/server/queries.ts:327` | `getProposalsByMeetingId` | function | 11 | `src/trpc/routers/projects.router/business.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/modules/proposals/core/dal/server/queries.ts:340` | `getProposalsByInvoiceIds` | function | 14 | `src/shared/services/accounting.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/modules/proposals/core/dal/server/queries.ts:356` | `getProposalByInvoiceId` | function | 13 | `src/shared/services/accounting.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/modules/proposals/core/dal/server/queries.ts:374` | `getByContractEnvelopeId` | function | 16 | `src/shared/services/contracts.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/modules/proposals/core/lib/proposal-lock.ts:35` | `getProposalLockState` | function | 12 | `src/features/proposal-flow/ui/views/edit-proposal-view.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| ⚠ `src/shared/modules/proposals/core/server-spec.ts:15` | `proposalSchemas` | const-data | 4 | `src/trpc/routers/proposals.router/crud.router.ts` · cross-module | cross-module constant with one consumer |
| ⚠ `src/shared/modules/proposals/media/dal/server/queries.ts:70` | `listImportableProjectMedia` | function | 26 | `src/trpc/routers/projects.router/media.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/ai.service.ts:29` | `aiService` | const-call | 1 | `src/shared/services/providers/upstash/jobs/generate-ai-summary.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/services/meta-insights-sync.service.ts:95` | `metaInsightsSyncService` | const-call | 1 | `src/shared/domains/analytics/sources/remote/meta-insights.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/services/meta-sync.service.ts:167` | `metaSyncService` | const-call | 1 | `src/shared/services/measurement.service.ts` · sibling | cross-module constant with one consumer |
| ⚠ `src/shared/services/providers/ai/client.ts:124` | `aiClient` | const-call | 1 | `src/shared/services/ai.service.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts:38` | `normalizeBinaLead` | function | 45 | `src/app/api/webhooks/bina/route.ts` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/services/providers/google-calendar/client.ts:188` | `googleCalendarClient` | const-call | 1 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/services/providers/google-calendar/lib/conflict.ts:7` | `resolveConflict` | function | 9 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/google-calendar/lib/conflict.ts:21` | `hasRemoteChanged` | function | 3 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/google-calendar/lib/map-from-gcal.ts:3` | `gcalEventToLocal` | function | 21 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/google-calendar/lib/map-to-gcal.ts:97` | `meetingToGCalEvent` | function | 26 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/google-calendar/lib/map-to-gcal.ts:124` | `activityToGCalEvent` | function | 33 | `src/shared/services/scheduling.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/google-drive/token.service.ts:25` | `googleDriveTokenService` | const-data | 20 | `src/trpc/routers/projects.router/google-drive.router.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/services/providers/justcall/dialer-provider.ts:21` | `justcallDialerProvider` | const-data | 58 | `src/shared/services/voip/dialer/index.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/services/providers/notion/lib/page-to-tiptap-json.ts:27` | `pageToTiptapJson` | function | 11 | `src/shared/services/construction-data.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/notion/lib/pain-points/adapter.ts:7` | `pageToPainPoint` | function | 26 | `src/features/meeting-flow/lib/get-cached-pain-points.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/notion/lib/scopes/adapter.ts:21` | `pageToScope` | function | 20 | `src/shared/services/construction-data.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/notion/lib/sows/adapter.ts:7` | `pageToSOW` | function | 16 | `src/shared/services/construction-data.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/notion/lib/trades/adapter.ts:27` | `pageToTrade` | function | 39 | `src/shared/services/construction-data.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/quickbooks/client.ts:4` | `qbRequest` | function | 25 | `src/shared/services/accounting.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/resend/client.ts:15` | `resendClient` | const | 1 | `src/shared/services/email.service.ts` · cross-module | cross-module constant with one consumer |
| ⚠ `src/shared/services/providers/resend/lib/build-sender-from.ts:11` | `buildSenderFrom` | function | 8 | `src/shared/services/email.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/resend/lib/render-emails.tsx:11` | `renderProposalEmail` | function | 13 | `src/shared/services/email.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/resend/lib/render-emails.tsx:25` | `renderScheduleConsultationEmail` | function | 3 | `src/shared/services/email.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/resend/lib/render-emails.tsx:29` | `renderGeneralInquiryEmail` | function | 3 | `src/shared/services/email.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/resend/lib/render-emails.tsx:33` | `renderCustomerConfirmationEmail` | function | 3 | `src/shared/services/email.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/resend/lib/render-emails.tsx:37` | `renderMoveForwardRequestEmail` | function | 13 | `src/shared/services/email.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/resend/lib/render-emails.tsx:69` | `renderNewLeadEmail` | function | 19 | `src/shared/services/email.service.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/zoho-sign/lib/dedupe-signer-statuses.ts:17` | `dedupeSignerStatuses` | function | 11 | `src/shared/services/zoho-sync.service.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/zoho-sign/lib/documents/evaluate.ts:131` | `reconcileEnvelopeSelection` | function | 16 | `src/trpc/routers/proposals.router/contracts.router.ts` · cross-module | cross-module helper with one consumer |
| ⚠ `src/shared/services/providers/zoho-sign/lib/documents/evaluate.ts:154` | `projectAgreementDocs` | function | 11 | `src/trpc/routers/proposals.router/contracts.router.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/zoho-sign/lib/pack-sow-text.ts:14` | `packSowText` | function | 24 | `scripts/verify-pack-sow-text.ts` · cross-module | cross-module helper with one consumer |
| `src/shared/services/providers/zoho-sign/lib/verify-webhook-signature.ts:10` | `verifyWebhookSignature` | function | 21 | `src/app/api/webhooks/zoho-sign/route.ts` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/services/voip/campaigns/campaign-sync.service.ts:125` | `campaignSyncService` | const-call | 1 | `src/trpc/routers/voip-campaigns.router.ts` · cross-module | cross-module constant with one consumer |
| `src/shared/services/voip/campaigns/lib/is-stop-keyword.ts:20` | `isStopKeyword` | function | 12 | `src/app/api/webhooks/justcall/route.ts` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/shared/services/voip/campaigns/lib/resolve-customer.ts:28` | `resolveCustomerByProviderContactId` | function | 12 | `src/app/api/webhooks/justcall/route.ts` · cross-module | cross-module helper with one UI consumer → move next to it |
| ⚠ `src/shared/services/zoho-sync.service.ts:80` | `zohoSyncService` | const-call | 1 | `src/shared/services/contracts.service.ts` · sibling | cross-module constant with one consumer |
| ⚠ `src/shared/types/index.ts:8` | `isTruthy` | function | 3 | `src/features/proposal-flow/ui/components/proposal/project-overview.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/trpc/helpers.tsx:12` | `getQueryClient` | function | 13 | `src/shared/components/providers/trpc-provider.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |
| `src/trpc/helpers.tsx:26` | `getUrl` | function | 9 | `src/shared/components/providers/trpc-provider.tsx` · cross-module | cross-module helper with one UI consumer → move next to it |

</details>


## Single-use exports — keep (by design)

| Verdict | Count | Why it stays |
|---|---|---|
| Keep (Rule 1) | 317 | One component per file; a single-use component is by design. |
| Structural | 149 | Router, table, spec, page→view: single-mount by design. |
| Keep (Rule 2) | 136 | Constant consumed by a component; constants stay out of component files. |
| Keep constant | 95 | constants/ is its sanctioned home. |
| Companion type | 64 | Type also used in its own file (param/return of a sibling export). |
| Provider layout | 59 | ADR-0003 per-provider lib/config.ts, constants/, types.ts. |
| Ops scripts | 58 | scripts/ tooling. |
| Vendored (shadcn) | 43 | shadcn primitives keep their full library surface. |
| Keep (Rule 7) | 40 | Helper consumed by a component; helpers stay out of component files. |
| Keep canonical | 37 | Canonical entity/domain types home. |
| Toolkit entry | 33 | One function of a cohesive helper toolkit; one caller per entry is normal. |
| Derived type | 33 | `typeof …` type next to its const (Rule 26). |
| Keep schema | 31 | Zod composition (Rule 11). |
| Keep hook | 30 | Rule 8 permits thin wrapper hooks. |
| Keep (Rule 25) | 25 | Entity business rule in entity lib; one caller today is fine. |
| Reference code | 8 | example/ directories. |
| Public entrypoint | 7 | Sanctioned cross-feature barrel entry. |
| Registry entry | 5 | Per-item config aggregated by a registry. |

The full rows are in the interactive explorer (filter Group = Keep).

## Zero-consumer exports

### Dead re-export lines in entity homes — 35

A canonical entity types.ts / schemas re-export nobody imports from there. **Action:** Either route consumers through the entity home or drop the line.

| Defined at | Export | Kind | Lines | Local uses | Note |
|---|---|---|---|---|---|
| `src/shared/entities/app-settings/schemas/index.ts:1` | `insertAppSettingSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/app-settings.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/app-settings/schemas/index.ts:1` | `selectAppSettingSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/app-settings.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/app-settings/types.ts:1` | `AppSetting` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/app-settings.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/app-settings/types.ts:1` | `InsertAppSettingSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/app-settings.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/voip-calls/schemas/index.ts:1` | `insertVoipCallSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-calls.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-calls/schemas/index.ts:1` | `selectVoipCallSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-calls.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-calls/types.ts:1` | `InsertVoipCallSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-calls.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/voip-calls/types.ts:1` | `VoipCall` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-calls.ts` — source used directly by 10 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaign-contacts/schemas/index.ts:1` | `insertVoipCampaignContactSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-campaign-contacts.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaign-contacts/schemas/index.ts:1` | `selectVoipCampaignContactSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-campaign-contacts.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaign-contacts/types.ts:1` | `InsertVoipCampaignContact` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-campaign-contacts.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaign-contacts/types.ts:1` | `VoipCampaignContact` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-campaign-contacts.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaigns/schemas/index.ts:1` | `SmsCadence` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/entities/voip-campaigns/schemas/sms-cadence.ts` — source used directly by 4 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaigns/schemas/index.ts:1` | `SmsCadenceMessage` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/entities/voip-campaigns/schemas/sms-cadence.ts` — source used directly by 3 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaigns/schemas/index.ts:1` | `smsCadenceMessageSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/entities/voip-campaigns/schemas/sms-cadence.ts` — source unused everywhere |
| `src/shared/entities/voip-campaigns/schemas/index.ts:1` | `smsCadenceSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/entities/voip-campaigns/schemas/sms-cadence.ts` — source used directly by 2 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaigns/schemas/index.ts:7` | `insertVoipCampaignSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-campaigns.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaigns/schemas/index.ts:7` | `selectVoipCampaignSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-campaigns.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-campaigns/types.ts:1` | `InsertVoipCampaign` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-campaigns.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/voip-contact-fields/schemas/index.ts:1` | `insertVoipContactFieldSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-contact-fields.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-contact-fields/schemas/index.ts:1` | `selectVoipContactFieldSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-contact-fields.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-contact-fields/types.ts:1` | `InsertVoipContactField` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-contact-fields.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/voip-contact-fields/types.ts:1` | `VoipContactField` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-contact-fields.ts` — source used directly by 10 file(s) (bypasses this home) |
| `src/shared/entities/voip-dids/schemas/index.ts:1` | `insertVoipDidSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-dids.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-dids/schemas/index.ts:1` | `selectVoipDidSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-dids.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-dids/types.ts:1` | `InsertVoipDidSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-dids.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/voip-dids/types.ts:1` | `VoipDid` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-dids.ts` — source used directly by 11 file(s) (bypasses this home) |
| `src/shared/entities/voip-link-tokens/schemas/index.ts:1` | `insertVoipLinkTokenSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-link-tokens.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-link-tokens/schemas/index.ts:1` | `selectVoipLinkTokenSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-link-tokens.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-link-tokens/types.ts:1` | `InsertVoipLinkTokenSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-link-tokens.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/voip-link-tokens/types.ts:1` | `VoipLinkToken` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-link-tokens.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/voip-messages/schemas/index.ts:1` | `insertVoipMessageSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-messages.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-messages/schemas/index.ts:1` | `selectVoipMessageSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-messages.ts` — source used directly by 9 file(s) (bypasses this home) |
| `src/shared/entities/voip-messages/types.ts:1` | `InsertVoipMessageSchema` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-messages.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/shared/entities/voip-messages/types.ts:1` | `VoipMessage` | reexport | 1 | 0 | canonical entity home re-exports a db-schema type nobody imports from here (consumers bypass the entity home, or the type is unused) ⇐ `src/shared/db/schema/voip-messages.ts` — source used directly by 11 file(s) (bypasses this home) |

### Dead shim lines — 17

A re-export line in a pass-through file that nobody imports. **Action:** Delete the line (or the file when every line is dead).

| Defined at | Export | Kind | Lines | Local uses | Note |
|---|---|---|---|---|---|
| `src/shared/domains/analytics/index.ts:27` | `resolve` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/resolver.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:28` | `MetricResult` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/resolver.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:30` | `bucket` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:30` | `metric` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:30` | `source` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source used directly by 4 file(s) (bypasses this home) |
| `src/shared/domains/analytics/index.ts:31` | `AnalyticsFilters` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:31` | `AnyMetric` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source used directly by 1 file(s) (bypasses this home) |
| `src/shared/domains/analytics/index.ts:31` | `AnySource` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source used directly by 1 file(s) (bypasses this home) |
| `src/shared/domains/analytics/index.ts:31` | `Bucket` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source used directly by 1 file(s) (bypasses this home) |
| `src/shared/domains/analytics/index.ts:31` | `BucketSection` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:31` | `DateRange` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:31` | `MergedRow` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:31` | `Metric` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:31` | `MetricFormat` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source used directly by 1 file(s) (bypasses this home) |
| `src/shared/domains/analytics/index.ts:31` | `Source` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source unused everywhere |
| `src/shared/domains/analytics/index.ts:31` | `SourceContext` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source used directly by 1 file(s) (bypasses this home) |
| `src/shared/domains/analytics/index.ts:31` | `SourceRow` | reexport | 1 | 0 | pure pass-through file with no consumers at all ⇐ `src/shared/domains/analytics/types.ts` — source used directly by 1 file(s) (bypasses this home) |

### Dead barrel lines — 12

A barrel/index re-export that nobody imports through the barrel. **Action:** Delete the line.

| Defined at | Export | Kind | Lines | Local uses | Note |
|---|---|---|---|---|---|
| ⚠ `src/features/customer-pipelines/types/index.ts:9` | `CustomerFormValues` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/entities/customers/types.ts` — source used directly by 3 file(s) (bypasses this home) |
| ⚠ `src/features/customer-pipelines/types/index.ts:18` | `SowTradeScope` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/modules/proposals/core/types.ts` — source used directly by 3 file(s) (bypasses this home) |
| `src/shared/constants/company/index.ts:2` | `certifications` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/constants/company/certifications.ts` — source used directly by 3 file(s) (bypasses this home) |
| `src/shared/constants/company/index.ts:11` | `teamInfo` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/constants/company/team-info.ts` — source used directly by 2 file(s) (bypasses this home) |
| `src/shared/services/providers/web-push/client.ts:34` | `PushPayloadInput` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/services/providers/web-push/lib/build-payload.ts` — source unused everywhere |
| `src/trpc/types.ts:18` | `DalError` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/dal/server/types.ts` — source unused everywhere |
| `src/trpc/types.ts:18` | `DalReturn` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/dal/server/types.ts` — source used directly by 50 file(s) (bypasses this home) |
| `src/trpc/types.ts:18` | `ScopedContext` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/dal/server/types.ts` — source used directly by 37 file(s) (bypasses this home) |
| `src/trpc/types.ts:27` | `dalError` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/dal/server/types.ts` — source used directly by 8 file(s) (bypasses this home) |
| `src/trpc/types.ts:27` | `dalSuccess` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/dal/server/types.ts` — source used directly by 10 file(s) (bypasses this home) |
| `src/trpc/types.ts:27` | `SYSTEM_CONTEXT` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/dal/server/types.ts` — source used directly by 35 file(s) (bypasses this home) |
| `src/trpc/types.ts:27` | `ThrowableDalError` | reexport | 1 | 0 | nobody imports this re-export line ⇐ `src/shared/dal/server/types.ts` — source used directly by 17 file(s) (bypasses this home) |

### Unused provider type re-exports — 5

SDK type re-exported at the provider seam with no importer. **Action:** Drop when the provider is stable.

| Defined at | Export | Kind | Lines | Local uses | Note |
|---|---|---|---|---|---|
| `src/shared/services/providers/meta/types.ts:1` | `MetaEventName` | reexport | 1 | 0 | unused SDK type re-export at the provider seam ⇐ `src/shared/services/providers/meta/constants/index.ts` — source unused everywhere |
| `src/shared/services/providers/meta/types.ts:2` | `MetaCustomData` | reexport | 1 | 0 | unused SDK type re-export at the provider seam ⇐ `src/shared/services/providers/meta/schemas/server-event.ts` — source unused everywhere |
| `src/shared/services/providers/meta/types.ts:2` | `MetaServerEvent` | reexport | 1 | 0 | unused SDK type re-export at the provider seam ⇐ `src/shared/services/providers/meta/schemas/server-event.ts` — source used directly by 2 file(s) (bypasses this home) |
| `src/shared/services/providers/meta/types.ts:2` | `MetaUserData` | reexport | 1 | 0 | unused SDK type re-export at the provider seam ⇐ `src/shared/services/providers/meta/schemas/server-event.ts` — source used directly by 2 file(s) (bypasses this home) |
| `src/shared/services/providers/twilio/types.ts:12` | `IncomingPhoneNumberListInstanceOptions` | reexport | 1 | 0 | unused SDK type re-export at the provider seam |

### Un-export (used only in its own file) — 323

Exported but only used inside its own file. **Action:** Drop the `export` keyword (codemod-able).

<details><summary>323 rows</summary>

| Defined at | Export | Kind | Lines | Local uses | Note |
|---|---|---|---|---|---|
| `src/app/(frontend)/dashboard/template.tsx:5` | `DashboardTemplate` | component | 14 | 1 | only used inside its own file → drop `export` |
| `src/features/agent-dashboard/lib/get-sidebar-nav.ts:24` | `SidebarNavSubItem` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/features/agent-dashboard/lib/get-sidebar-nav.ts:38` | `SidebarNavConfig` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/features/campaigns-admin/constants/lead-status.ts:3` | `LeadStatusMeta` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/features/campaigns-admin/constants/query-parsers.ts:3` | `CAMPAIGN_TABS` | const-data | 1 | 2 | only used inside its own file → drop `export` |
| `src/features/campaigns-admin/lib/format-lead-location.ts:8` | `FormattedLeadLocation` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/features/campaigns-admin/lib/partition-source-summaries.ts:5` | `PartitionedSummaries` | interface | 4 | 1 | only used inside its own file → drop `export` |
| ⚠ `src/features/customer-pipelines/types/index.ts:43` | `PipelineItemProject` | interface | 10 | 1 | only used inside its own file → drop `export` |
| `src/features/intake/schemas/intake-form-schema.ts:4` | `tradeRowSchema` | schema | 4 | 2 | only used inside its own file → drop `export` |
| `src/features/landing/constants/experience-motion.ts:3` | `EXPERIENCE_TRANSITION` | const-data | 4 | 2 | only used inside its own file → drop `export` |
| `src/features/landing/lib/experience-parse-stat.ts:1` | `ParsedStat` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/features/landing/lib/notion-trade-helpers.ts:20` | `getCachedTrades` | const-call | 7 | 1 | only used inside its own file → drop `export` |
| `src/features/landing/lib/notion-trade-helpers.ts:28` | `getCachedScopes` | const-call | 7 | 1 | only used inside its own file → drop `export` |
| `src/features/landing/ui/components/blog/blogpost-card.tsx:21` | `useBlogpostCardContext` | hook | 7 | 4 | only used inside its own file → drop `export` |
| `src/features/landing/ui/components/blog/blogpost-card.tsx:34` | `BlogpostCardProvider` | component | 8 | 2 | only used inside its own file → drop `export` |
| `src/features/landing/ui/components/blog/blogpost-card.tsx:67` | `BlogpostCardFrame` | component | 30 | 1 | only used inside its own file → drop `export` |
| `src/features/landing/ui/components/blog/blogpost-card.tsx:102` | `BlogpostCardHeader` | component | 13 | 1 | only used inside its own file → drop `export` |
| `src/features/landing/ui/components/blog/blogpost-card.tsx:118` | `BlogpostCardTitle` | component | 8 | 1 | only used inside its own file → drop `export` |
| `src/features/landing/ui/components/blog/blogpost-card.tsx:127` | `BlogpostCardSnippet` | component | 6 | 1 | only used inside its own file → drop `export` |
| `src/features/landing/ui/components/blog/blogpost-card.tsx:138` | `BlogpostCardDate` | component | 8 | 1 | only used inside its own file → drop `export` |
| `src/features/landing/ui/components/blog/blogpost-card.tsx:152` | `BlogpostCardImage` | component | 15 | 1 | only used inside its own file → drop `export` |
| `src/features/lead-sources-admin/lib/compute-funnel-rates.ts:8` | `FunnelRates` | interface | 8 | 1 | only used inside its own file → drop `export` |
| `src/features/meeting-flow/constants/step-config.ts:3` | `MeetingStepConfig` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/features/meeting-flow/constants/trade-categories.ts:7` | `TradeCategory` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/features/meeting-flow/lib/build-persona-profile.ts:26` | `PersonaProfileCustomer` | type | 1 | 5 | only used inside its own file → drop `export` |
| `src/features/meeting-flow/lib/build-persona-profile.ts:28` | `BuildPersonaProfileInput` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/features/meeting-flow/lib/buy-triggers.ts:1` | `getDaysLeftInMonth` | function | 5 | 1 | only used inside its own file → drop `export` |
| `src/features/meeting-flow/lib/profile-benefits.ts:4` | `ProfileBenefit` | interface | 5 | 2 | only used inside its own file → drop `export` |
| `src/features/meeting-flow/types/index.ts:24` | `ProgramIncentive` | interface | 8 | 1 | only used inside its own file → drop `export` |
| `src/features/meeting-flow/types/index.ts:33` | `ProgramPresentation` | interface | 7 | 1 | only used inside its own file → drop `export` |
| ⚠ `src/features/proposal-flow/constants/project-overview-display.tsx:18` | `Display` | type | 1 | 4 | only used inside its own file → drop `export` |
| ⚠ `src/features/proposal-flow/constants/project-overview-display.tsx:34` | `BaseField` | interface | 5 | 4 | only used inside its own file → drop `export` |
| `src/features/proposal-flow/constants/proposal-steps.ts:10` | `proposalSteps` | const-data | 44 | 2 | only used inside its own file → drop `export` |
| `src/features/proposal-flow/constants/proposal-steps.ts:62` | `ProposalAccessor` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/features/proposal-flow/hooks/use-proposal-flow-store.ts:11` | `ProposalFlowStore` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/features/proposal-flow/hooks/use-view-mode.ts:7` | `ViewMode` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/features/proposal-flow/lib/search-params.ts:3` | `proposalSearchParams` | const-data | 3 | 1 | only used inside its own file → drop `export` |
| `src/features/schedule-management/types/index.ts:4` | `ScheduleMeetingParticipant` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/pain-points.ts:17` | `programAccessors` | const-data | 5 | 1 | only used inside its own file → drop `export` |
| `src/pain-points.ts:23` | `ProgramAccessor` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/pain-points.ts:31` | `painPointCategories` | const-data | 10 | 1 | only used inside its own file → drop `export` |
| `src/pain-points.ts:42` | `PainPointCategory` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/pain-points.ts:56` | `EmotionalDriver` | type | 6 | 2 | only used inside its own file → drop `export` |
| `src/pain-points.ts:71` | `UrgencyMultiplier` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/pain-points.ts:77` | `HouseholdResonance` | type | 6 | 1 | only used inside its own file → drop `export` |
| `src/pain-points.ts:84` | `PainPoint` | interface | 41 | 12 | only used inside its own file → drop `export` |
| `src/pain-points.ts:128` | `painPoints` | const-data | 1169 | 1 | only used inside its own file → drop `export` |
| `src/pain-points.ts:1304` | `allPainPoints` | const-call | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockActions` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockBody` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockContent` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockDecor` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockDivider` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockEyebrow` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockHeadline` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockMedia` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockRoot` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/block/block.tsx:29` | `BlockTrust` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/calendar/lib/calendar-helpers.ts:23` | `CalendarCell` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/contract-status-panel/lib/derive-timeline-state.ts:4` | `StepState` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/contract-status-panel/ui/contract-status-panel.tsx:8` | `ContractStatusPanelProps` | interface | 20 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/data-table/hooks/use-pull-to-refresh.ts:8` | `PULL_TO_REFRESH_THRESHOLD` | const-literal | 1 | 2 | only used inside its own file → drop `export` |
| `src/shared/components/data-table/lib/use-column-visibility.ts:9` | `ToggleableColumn` | interface | 6 | 3 | only used inside its own file → drop `export` |
| `src/shared/components/data-table/lib/use-entity-columns.tsx:16` | `ColumnFormat` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/data-table/lib/use-entity-columns.tsx:18` | `ColumnSpec` | interface | 33 | 3 | only used inside its own file → drop `export` |
| `src/shared/components/data-table/types.ts:3` | `DateRange` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/data-table/types.ts:22` | `DataTableSearchFilter` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/data-table/ui/data-table.tsx:28` | `DataTableProps` | interface | 37 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/data-view-type-toggle.tsx:8` | `DataViewType` | type | 1 | 5 | only used inside its own file → drop `export` |
| `src/shared/components/decor/lib/build-decor-geometry.ts:4` | `RingDescriptor` | type | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/entity-actions/entity-view-button.tsx:10` | `EntityActionButtonProps` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/image-slider.tsx:59` | `ImageSliderControls` | component | 17 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/kanban/hooks/use-kanban-column-filter.ts:7` | `KanbanColumnFilterConfig` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/media/media-manager.tsx:10` | `MediaManagerProps` | interface | 21 | 1 | only used inside its own file → drop `export` |
| `src/shared/components/trust/lib/build-credentials.ts:3` | `Credential` | interface | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/config/create-provider-config.ts:47` | `ConfigMeta` | interface | 5 | 2 | only used inside its own file → drop `export` |
| `src/shared/config/create-provider-config.ts:64` | `ProviderConfigHelpers` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/config/server-env.ts:160` | `env` | type | 1 | 8 | only used inside its own file → drop `export` |
| `src/shared/constants/nav-items/index.ts:6` | `tprInternalNavItems` | unknown | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/constants/nav-items/index.ts:11` | `baseNavItems` | const-data | 10 | 2 | only used inside its own file → drop `export` |
| `src/shared/constants/tags.ts:1` | `tags` | const-data | 22 | 1 | only used inside its own file → drop `export` |
| `src/shared/dal/client/hooks/use-paginated-query.ts:33` | `PaginatedQueryInput` | unknown | 1 | 3 | only used inside its own file → drop `export` |
| `src/shared/dal/client/lib/types.ts:8` | `TimePreset` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/dal/client/lib/types.ts:17` | `FilterOption` | interface | 4 | 2 | only used inside its own file → drop `export` |
| `src/shared/dal/lib/query/derive-paginated-query-state.ts:33` | `PaginatedQueryState` | interface | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/dal/server/lib/query/filters.ts:9` | `FilterPredicateBuilder` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/dal/server/lib/query/schemas.ts:12` | `paginationFieldsSchema` | schema | 4 | 2 | only used inside its own file → drop `export` |
| `src/shared/dal/server/lib/query/schemas.ts:23` | `sortFieldsSchema` | schema | 4 | 2 | only used inside its own file → drop `export` |
| ⚠ `src/shared/dal/server/types.ts:61` | `MaybePromise` | type | 1 | 6 | only used inside its own file → drop `export` |
| ⚠ `src/shared/dal/server/types.ts:80` | `CrudSlotHookMap` | interface | 14 | 3 | only used inside its own file → drop `export` |
| ⚠ `src/shared/dal/server/types.ts:96` | `CrudMutationSlot` | type | 1 | 2 | only used inside its own file → drop `export` |
| ⚠ `src/shared/dal/server/types.ts:99` | `CrudHooks` | type | 3 | 1 | only used inside its own file → drop `export` |
| ⚠ `src/shared/dal/server/types.ts:246` | `DalError` | type | 8 | 4 | only used inside its own file → drop `export` |
| `src/shared/domains/analytics/resolver.ts:14` | `MetricResult` | interface | 9 | 3 | only used inside its own file → drop `export` |
| `src/shared/domains/analytics/types.ts:4` | `DateRange` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/analytics/types.ts:9` | `AnalyticsFilters` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/analytics/types.ts:28` | `Source` | interface | 4 | 4 | only used inside its own file → drop `export` |
| `src/shared/domains/analytics/types.ts:49` | `MergedRow` | type | 3 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/analytics/types.ts:61` | `Metric` | interface | 10 | 3 | only used inside its own file → drop `export` |
| `src/shared/domains/analytics/types.ts:78` | `BucketSection` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/auth/client.ts:5` | `signUp` | const-call | 20 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/auth/client.ts:5` | `updateUser` | const-call | 20 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/auth/client.ts:5` | `oauth2` | const-call | 20 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/auth/client.ts:5` | `getAccessToken` | const-call | 20 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/auth/client.ts:5` | `unlinkAccount` | const-call | 20 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/auth/schemas/index.ts:8` | `signupFormSchema` | schema | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/auth/server.ts:113` | `Auth` | type | 1 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/construction/constants/enums.ts:31` | `roofLocations` | const-data | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/constants/portfolio-fallback-images.ts:1` | `FallbackImage` | interface | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/constants/trade-facts.ts:19` | `TRADE_FACTS` | const-data | 32 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/lib/build-zip-check-sequence.ts:11` | `ZipCheckTick` | interface | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/lib/card-options.ts:23` | `OptionScope` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/lib/og/load-og-fonts.ts:5` | `OgFont` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/lib/resolve-zip.ts:22` | `ResolveZipResult` | type | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:17` | `AnswerByKind` | interface | 7 | 3 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:24` | `AnswerOf` | type | 1 | 3 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:36` | `OptionAsset` | type | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:45` | `HeroMedia` | interface | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:60` | `ZipContent` | interface | 16 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:77` | `PiiFieldLabels` | interface | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:78` | `PiiContent` | interface | 6 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:85` | `AddressContent` | interface | 1 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:87` | `ConfirmationContent` | interface | 7 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:96` | `ContentByKind` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:103` | `ContentOf` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:120` | `FunnelTheme` | interface | 1 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:155` | `StepComponentFor` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:220` | `MarketingBlockComponentFor` | type | 2 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:231` | `TradeMeta` | interface | 13 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:261` | `FunnelPixel` | interface | 1 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:264` | `EnrichmentDimension` | interface | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/types.ts:266` | `EnrichmentEntry` | interface | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/funnels/ui/blocks/before-after-showcase.tsx:15` | `BeforeAfterPair` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/multi-step-flow/ui/step-shell.tsx:13` | `StepShellProps` | interface | 17 | 1 | only used inside its own file → drop `export` |
| ⚠ `src/shared/domains/permissions/abilities.ts:49` | `ENTITY_NAMES` | const-data | 26 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/permissions/lib/protect-dashboard-page.ts:22` | `DashboardAuthState` | type | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/dead-pipeline.ts:5` | `deadPipelineStages` | const-data | 4 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/dead-pipeline.ts:12` | `deadStageConfig` | const-data | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/dead-pipeline.ts:17` | `DEAD_ALLOWED_DRAG_TRANSITIONS` | const-data | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/dead-pipeline.ts:22` | `DEAD_BLOCKED_MESSAGES` | const-data | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/fresh-pipeline.ts:17` | `freshPipelineStages` | const-data | 1 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/fresh-pipeline.ts:21` | `freshStageConfig` | const-data | 12 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/fresh-pipeline.ts:47` | `FRESH_BLOCKED_MESSAGES` | const-data | 10 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/leads-pipeline.ts:14` | `leadsStageConfig` | const-data | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/leads-pipeline.ts:23` | `LEADS_ALLOWED_DRAG_TRANSITIONS` | const-call | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/leads-pipeline.ts:27` | `LEADS_BLOCKED_MESSAGES` | const-data | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/projects-pipeline.ts:21` | `projectsStageConfig` | const-data | 13 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/projects-pipeline.ts:37` | `PROJECTS_ALLOWED_DRAG_TRANSITIONS` | const-call | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/projects-pipeline.ts:41` | `PROJECTS_BLOCKED_MESSAGES` | const-data | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/rehash-pipeline.ts:5` | `rehashPipelineStages` | const-data | 5 | 2 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/rehash-pipeline.ts:13` | `rehashStageConfig` | const-data | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/rehash-pipeline.ts:19` | `REHASH_ALLOWED_DRAG_TRANSITIONS` | const-data | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/constants/rehash-pipeline.ts:25` | `REHASH_BLOCKED_MESSAGES` | const-data | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/domains/pipelines/ui/pipeline-scope-toggle.tsx:10` | `PipelineScope` | type | 1 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/activities/schemas/index.ts:7` | `noteMetaSchema` | schema | 3 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/activities/schemas/index.ts:12` | `reminderMetaSchema` | schema | 3 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/activities/schemas/index.ts:17` | `taskMetaSchema` | schema | 3 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/activities/schemas/index.ts:22` | `eventMetaSchema` | schema | 4 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/applications/dal/server/queries.ts:23` | `ApplicationListInput` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/applications/dal/server/queries.ts:43` | `ApplicationWithAnswers` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/dal/server/ad-performance.ts:20` | `AdKeyLeads` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/dal/server/ad-performance.ts:25` | `AdKeyAppointments` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/dal/server/ad-performance.ts:30` | `AdKeySigned` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/dal/server/ad-performance.ts:42` | `brandedMetaPaidScope` | const | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/dal/server/queries.ts:21` | `Customer` | unknown | 1 | 4 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/dal/server/queries.ts:23` | `CustomerWithPhoneGate` | type | 1 | 3 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/lib/bucket-timeline-events.ts:5` | `TimelineDateGroup` | interface | 4 | 3 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/lib/get-meeting-time-label.ts:3` | `MeetingTimeLabel` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/schemas/index.ts:58` | `enrichmentRecordSchema` | schema | 4 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/schemas/persona-profile-schema.ts:3` | `personaFearSchema` | schema | 6 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/schemas/persona-profile-schema.ts:10` | `personaBenefitSchema` | schema | 6 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/schemas/persona-profile-schema.ts:17` | `personaDecisionDriverSchema` | schema | 5 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/schemas/persona-profile-schema.ts:23` | `personaEmotionalLeverSchema` | schema | 5 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/schemas/persona-profile-schema.ts:29` | `personaHouseholdResonanceSchema` | schema | 4 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/schemas/persona-profile-schema.ts:34` | `personaRiskFactorSchema` | schema | 5 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/customers/schemas/persona-profile-schema.ts:40` | `customerPersonaProfileSchema` | schema | 8 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/landing/schemas.ts:8` | `PROJECT_INQUIRY_TYPES` | const-data | 1 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/lead-sources/components/overview-card.tsx:11` | `LeadSourceOverviewCardSource` | interface | 8 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/lead-sources/schemas.ts:33` | `voipCampaignsPolicySchema` | schema | 11 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/lead-sources/schemas.ts:48` | `voipInHousePolicySchema` | schema | 11 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/media-files/lib/image-variants.ts:9` | `VariantOption` | interface | 8 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/media-files/lib/image-variants.ts:29` | `VariantSuffix` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/media-files/lib/process-image-variants.ts:12` | `ProcessImageResult` | interface | 8 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/media-files/lib/process-image-variants.ts:21` | `VariantDecision` | interface | 6 | 2 | only used inside its own file → drop `export` |
| ⚠ `src/shared/entities/meetings/components/overview-card.tsx:65` | `MeetingFieldConfig` | type | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/components/participants-slot.tsx:31` | `ParticipantLite` | interface | 6 | 3 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/dal/server/participants.ts:82` | `OwnerCoOwnerRow` | interface | 9 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/dal/server/participants.ts:134` | `MeetingParticipantRow` | interface | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/dal/server/queries.ts:34` | `MeetingListParticipant` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/dal/server/queries.ts:42` | `MeetingListOwnerSlot` | interface | 8 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/dal/server/queries.ts:71` | `meetingListFiltersSchema` | const-data | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/dal/server/queries.ts:83` | `MeetingWithCustomer` | type | 8 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/dal/server/queries.ts:98` | `MeetingCustomer` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/schemas/index.ts:25` | `tradeSelectionSchema` | schema | 7 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/schemas/index.ts:35` | `dealStructureIncentiveSchema` | schema | 5 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/schemas/index.ts:47` | `dealStructureSchema` | schema | 10 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/meetings/schemas/index.ts:60` | `closingAdjustmentsSchema` | schema | 4 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/projects/dal/server/queries.ts:108` | `ProjectForEdit` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/projects/dal/server/queries.ts:178` | `ProjectListInput` | interface | 12 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/projects/lib/visibility.ts:11` | `projectParticipationScope` | function | 12 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/projects/schemas/index.ts:5` | `beforeAfterPairSchema` | schema | 6 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/projects/schemas/index.ts:12` | `beforeAfterPairsSchema` | schema | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/push-subscriptions/dal/server/queries.ts:8` | `UpsertPushSubscriptionInput` | interface | 14 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/users/components/overview-card.tsx:35` | `UserOverviewCardMeta` | interface | 5 | 3 | only used inside its own file → drop `export` |
| `src/shared/entities/users/components/overview-card.tsx:41` | `UserAvatarSize` | type | 1 | 5 | only used inside its own file → drop `export` |
| `src/shared/entities/users/dal/server/mutations.ts:13` | `UpdateUserProfilePatch` | type | 15 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/users/lib/get-user-color.ts:9` | `UserColorToken` | interface | 8 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/users/schemas.ts:3` | `cropDataSchema` | schema | 6 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:21` | `ActiveEnrollment` | interface | 8 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:78` | `SmsCadenceContext` | interface | 16 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:165` | `EnrolledLeadRow` | interface | 6 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:199` | `LeadStatusCounts` | interface | 6 | 3 | only used inside its own file → drop `export` |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:234` | `LeadStatus` | type | 1 | 2 | only used inside its own file → drop `export` |
| `src/shared/entities/voip-campaign-contacts/dal/server/queries.ts:253` | `ListLeadsArgs` | interface | 8 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/voip-campaigns/lib/sms-merge-tokens.ts:17` | `SmsMergeToken` | interface | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/entities/voip-campaigns/schemas/sms-cadence.ts:9` | `smsCadenceMessageSchema` | schema | 8 | 2 | only used inside its own file → drop `export` |
| `src/shared/hooks/use-match-media.ts:7` | `getInitialState` | function | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/hooks/use-push-subscription.ts:14` | `PushSubscriptionStatus` | type | 8 | 2 | only used inside its own file → drop `export` |
| `src/shared/hooks/use-push-subscription.ts:23` | `UsePushSubscriptionOptions` | interface | 12 | 1 | only used inside its own file → drop `export` |
| `src/shared/hooks/use-push-subscription.ts:36` | `UsePushSubscriptionResult` | interface | 8 | 1 | only used inside its own file → drop `export` |
| `src/shared/hooks/use-reschedule.tsx:19` | `RescheduleResult` | interface | 5 | 3 | only used inside its own file → drop `export` |
| `src/shared/lib/create-modal-store.ts:3` | `ModalDescriptor` | interface | 5 | 2 | only used inside its own file → drop `export` |
| `src/shared/lib/create-modal-store.ts:20` | `ModalStore` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/lib/file-optimization/optimize-file.ts:8` | `classifyFileKind` | function | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/lib/formatters.ts:15` | `AddressParts` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/lib/formatters.ts:22` | `FormattedAddress` | interface | 10 | 1 | only used inside its own file → drop `export` |
| `src/shared/lib/google-maps-helpers.ts:43` | `LatLng` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/components/overview-card.tsx:37` | `ProposalFieldConfig` | type | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/components/overview-card.tsx:55` | `useProposalOverviewCard` | hook | 7 | 11 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/dal/server/queries.ts:36` | `ProposalCustomer` | interface | 11 | 2 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/dal/server/queries.ts:67` | `proposalListFiltersSchema` | const-data | 12 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/financials/compute-breakdown.ts:6` | `BreakdownSectionLine` | interface | 10 | 2 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/financials/compute-breakdown.ts:17` | `BreakdownGlobalLine` | interface | 11 | 4 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/financials/compute-breakdown.ts:48` | `PricingBreakdownInput` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/financials/compute-price-side.ts:29` | `FinalTcpInputs` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/financials/compute-section.ts:5` | `SectionFinancialsInput` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/financials/compute-totals.ts:12` | `ProposalFinancialsInput` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/financials/compute-totals.ts:18` | `ProposalFinancials` | interface | 25 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/funding-columns.ts:14` | `FundingColumns` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/proposal-lock.ts:16` | `ProposalLockState` | type | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/lib/proposal-lock.ts:59` | `frozenProposalLockedFields` | const-data | 12 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/schemas/index.ts:8` | `constructionItemSchema` | schema | 4 | 2 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/schemas/index.ts:13` | `costLineSchema` | schema | 7 | 2 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/schemas/index.ts:22` | `sectionIncentiveSchema` | schema | 6 | 2 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/schemas/index.ts:30` | `sowFinancialsSchema` | schema | 5 | 2 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/core/schemas/index.ts:99` | `fundingDataSchema` | schema | 7 | 3 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/media/dal/server/queries.ts:51` | `ImportableProjectMediaRow` | interface | 12 | 1 | only used inside its own file → drop `export` |
| `src/shared/modules/proposals/views/dal/server/queries.ts:16` | `ProposalViewStats` | interface | 7 | 1 | only used inside its own file → drop `export` |
| ⚠ `src/shared/modules/proposals/views/service.ts:42` | `RecordProposalViewInput` | type | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/media/optimization-target.ts:8` | `OptimizationTarget` | interface | 4 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/meta-insights-sync.service.ts:10` | `AdInsightRow` | interface | 13 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/meta-sync.service.ts:28` | `ScheduleEventArgs` | interface | 18 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/gohighlevel/client.ts:15` | `BinaParseResult` | type | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/gohighlevel/constants.ts:7` | `ghlContactEventTypes` | const-data | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/gohighlevel/constants.ts:37` | `ghlTaskEventTypes` | const-data | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/gohighlevel/constants.ts:43` | `ghlInvoiceEventTypes` | const-data | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/gohighlevel/constants.ts:53` | `ghlOtherEventTypes` | const-data | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts:13` | `ghlString` | function | 6 | 18 | only used inside its own file → drop `export` |
| `src/shared/services/providers/gohighlevel/lib/normalize-bina-lead.ts:32` | `NormalizedBinaLead` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/gohighlevel/types.ts:25` | `GhlWebhookPayload` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/google-calendar/types.ts:15` | `GCalDateTime` | interface | 5 | 4 | only used inside its own file → drop `export` |
| `src/shared/services/providers/justcall/client.ts:33` | `JustcallApiError` | class | 10 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/justcall/client.ts:44` | `JustcallResponseValidationError` | class | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/justcall/constants/index.ts:15` | `justcallContactFieldAppKeys` | const-data | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/justcall/lib/config.ts:25` | `JustcallRuntimeConfig` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/justcall/webhooks/events.ts:34` | `jcCallCompletedSchema` | schema | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/justcall/webhooks/events.ts:40` | `jcCallUpdatedSchema` | schema | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/justcall/webhooks/events.ts:46` | `jcSmsReceivedSchema` | schema | 11 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/meta/constants/index.ts:10` | `META_GRAPH_VERSION` | const-literal | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/meta/lib/config.ts:34` | `MetaRuntimeConfig` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/meta/lib/config.ts:59` | `MetaInsightsConfig` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/meta/schemas/insights.ts:11` | `metaAdInsightRowSchema` | const-call | 18 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/providers/meta/schemas/server-event.ts:12` | `metaUserDataSchema` | schema | 15 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/providers/meta/schemas/server-event.ts:28` | `metaCustomDataSchema` | schema | 6 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/providers/meta/schemas/server-event.ts:35` | `metaServerEventSchema` | schema | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/notion/lib/config.ts:16` | `NotionRuntimeConfig` | interface | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/notion/types.ts:14` | `NotionColumnType` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/quickbooks/lib/config.ts:25` | `QuickbooksRuntimeConfig` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/r2/lib/config.ts:23` | `R2RuntimeConfig` | interface | 6 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/resend/lib/config.ts:16` | `ResendRuntimeConfig` | interface | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/lib/config.ts:33` | `TwilioRuntimeConfig` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/schemas/access-token.ts:7` | `mintVoiceAccessTokenInputSchema` | schema | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/schemas/primitives.ts:23` | `isoDateTimeSchema` | schema | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/webhooks/messaging.ts:13` | `messagingStatusSchema` | schema | 12 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/webhooks/messaging.ts:29` | `messagingInboundWebhookSchema` | schema | 12 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/webhooks/messaging.ts:45` | `messagingStatusCallbackSchema` | schema | 10 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/webhooks/voice.ts:16` | `voiceCallStatusSchema` | schema | 10 | 4 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/webhooks/voice.ts:31` | `voiceInboundWebhookSchema` | schema | 8 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/webhooks/voice.ts:43` | `voiceStatusCallbackSchema` | schema | 17 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/twilio/webhooks/voice.ts:65` | `voiceDialActionSchema` | schema | 10 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/upstash/jobs/meta-capi-event.ts:15` | `MetaCapiEventPayload` | type | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/upstash/lib/config.ts:29` | `QstashRuntimeConfig` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/upstash/lib/config.ts:68` | `AblyRuntimeConfig` | interface | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/web-push/client.ts:36` | `PushSendOptions` | interface | 6 | 4 | only used inside its own file → drop `export` |
| `src/shared/services/providers/web-push/client.ts:43` | `PushSendResult` | interface | 8 | 5 | only used inside its own file → drop `export` |
| `src/shared/services/providers/web-push/lib/build-payload.ts:4` | `PushPayloadInput` | interface | 20 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/web-push/lib/build-payload.ts:29` | `DeclarativeWebPushPayload` | interface | 13 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/providers/zoho-sign/client.ts:15` | `DocumentOrder` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/zoho-sign/client.ts:27` | `ZohoMergeSendResponse` | interface | 8 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/providers/zoho-sign/client.ts:36` | `ZohoGetResponse` | interface | 9 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/providers/zoho-sign/lib/documents/evaluate.ts:5` | `AgreementDocStatus` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/zoho-sign/lib/documents/evaluate.ts:7` | `AgreementDocProjection` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/zoho-sign/lib/documents/evaluate.ts:13` | `DocumentEvaluation` | interface | 8 | 3 | only used inside its own file → drop `export` |
| ⚠ `src/shared/services/providers/zoho-sign/lib/documents/types.ts:45` | `DocumentRule` | type | 5 | 1 | only used inside its own file → drop `export` |
| ⚠ `src/shared/services/providers/zoho-sign/lib/documents/types.ts:56` | `DocumentSource` | type | 3 | 1 | only used inside its own file → drop `export` |
| ⚠ `src/shared/services/providers/zoho-sign/lib/documents/types.ts:66` | `TemplateSignerActions` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/providers/zoho-sign/types.ts:3` | `zohoRequestStatuses` | const-data | 8 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/campaigns/campaign-sync.service.ts:32` | `SkippedCampaignReason` | type | 1 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/campaigns/campaign-sync.service.ts:34` | `SkippedCampaign` | interface | 5 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/voip/campaigns/campaign-sync.service.ts:40` | `ResyncResult` | interface | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/campaigns/lib/build-neutral-fields.ts:56` | `BuiltNeutralFields` | interface | 4 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/campaigns/lib/decide-cadence-sms.ts:11` | `DecideCadenceSmsInput` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/campaigns/lib/decide-cadence-sms.ts:19` | `DecideCadenceSmsResult` | type | 2 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/campaigns/lib/resolve-customer.ts:10` | `ResolvedCustomer` | interface | 3 | 2 | only used inside its own file → drop `export` |
| `src/shared/services/voip/compliance.service.ts:14` | `DncReason` | type | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/compliance.service.ts:20` | `AddToDncInput` | interface | 5 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/compliance.service.ts:26` | `RemoveFromDncInput` | interface | 3 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/dialer/types.ts:50` | `EnrollInput` | interface | 7 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/dialer/types.ts:58` | `SwitchCampaignInput` | interface | 9 | 1 | only used inside its own file → drop `export` |
| `src/shared/services/voip/voip-link-tokens.service.ts:50` | `ParsedLinkPayload` | type | 2 | 2 | only used inside its own file → drop `export` |
| `src/shared/types/index.ts:16` | `DeepPartial` | type | 3 | 1 | only used inside its own file → drop `export` |
| ⚠ `src/trpc/lib/create-crud-router.ts:36` | `CreateCrudRouterConfig` | interface | 31 | 1 | only used inside its own file → drop `export` |
| `src/trpc/types.ts:43` | `BaseTRPCContext` | interface | 5 | 2 | only used inside its own file → drop `export` |

</details>

### Dead exports (no use anywhere) — 238

No importer and no use in its own file. **Action:** Delete after a human check (planned work? string-referenced?).

<details><summary>238 rows</summary>

| Defined at | Export | Kind | Lines | Local uses | Note |
|---|---|---|---|---|---|
| `src/features/agent-dashboard/ui/components/dashboard-action-queue.tsx:28` | `DashboardActionQueue` | component | 58 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/agent-settings/ui/components/admin-section.tsx:11` | `AdminSection` | component | 22 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/customer-pipelines/ui/components/stat-card.tsx:11` | `StatCard` | component | 13 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/intake/schemas/intake-form-schema.ts:9` | `TradeRow` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/landing/ui/components/portfolio/portfolio-hero.tsx:6` | `PortfolioHero` | component | 30 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/landing/ui/components/portfolio/project/before-after-gallery.tsx:13` | `BeforeAfterGallery` | component | 55 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/landing/ui/components/portfolio/project/progress-gallery.tsx:15` | `ProgressGallery` | component | 73 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/landing/ui/components/portfolio/project/project-backstory.tsx:14` | `ProjectBackstory` | component | 56 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/landing/ui/components/portfolio/project/project-hero.tsx:16` | `ProjectHero` | component | 52 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/landing/ui/components/portfolio/project/project-videos-gallery.tsx:11` | `ProjectVideosGallery` | component | 45 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/landing/ui/components/portfolio/projects-grid.tsx:11` | `ProjectsGrid` | component | 93 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/landing/ui/components/services/scope-card.tsx:17` | `ScopeCard` | component | 14 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/landing/ui/views/portfolio-projects-view.tsx:5` | `PortfolioProjectsView` | component | 18 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/meeting-flow/constants/meetings-stat-config.ts:11` | `meetingsStatConfig` | const-data | 36 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/meeting-flow/lib/profile-benefits.ts:184` | `getCategoryLabel` | function | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/meeting-flow/lib/step-completion.ts:10` | `stepCompletionCount` | function | 8 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/meeting-flow/types/index.ts:9` | `CollectionField` | interface | 12 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/meeting-flow/types/index.ts:89` | `MeetingCalendarEvent` | interface | 16 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/project-management/constants/journey-steps.ts:8` | `JourneyStep` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/project-management/ui/components/story-journey.tsx:13` | `StoryJourney` | component | 80 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/project-management/ui/components/story-scopes-bar.tsx:15` | `StoryScopesBar` | component | 27 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/project-management/ui/components/story-transformation.tsx:18` | `StoryTransformation` | component | 79 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/proposal-flow/hooks/use-proposal-flow-store.ts:13` | `useProposalFlowStore` | const-call | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/features/proposal-flow/lib/converters.ts:10` | `proposalToFormValues` | function | 7 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/proposal-flow/ui/components/proposal-view-badge.tsx:13` | `ProposalViewBadge` | component | 31 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/proposal-flow/ui/components/proposal/send-proposal-link.tsx:11` | `SendProposalLink` | component | 48 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/proposal-flow/ui/components/sidebar.tsx:12` | `ProposalSidebar` | component | 48 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/proposal-flow/ui/views/proposal-view.tsx:3` | `ProposalView` | component | 7 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/schedule-management/constants/activity-table-columns.tsx:10` | `ACTIVITY_DEFAULT_SORT` | const-data | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/features/schedule-management/ui/components/activities-table.tsx:18` | `ActivitiesTable` | component | 38 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/pain-points.ts:1311` | `painPointByAccessor` | const-call | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/contract-status-panel/constants/contract-statuses.ts:14` | `REQUEST_STATUS_CONFIG` | const-data | 8 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/contract-status-panel/constants/contract-statuses.ts:23` | `ACTION_STATUS_CONFIG` | const-data | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/contract-status-panel/constants/contract-statuses.ts:30` | `ACTION_TOOLTIPS` | const-data | 5 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/customer-search.tsx:17` | `CustomerSearch` | component | 90 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/data-table/hooks/use-table-url-filters.ts:26` | `useTableUrlFilters` | hook | 41 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/data-table/ui/customer-name-cell.tsx:9` | `CustomerNameCell` | component | 22 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/data-view-type-toggle.tsx:23` | `DataViewTypeToggle` | component | 30 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/inputs/search-input.tsx:13` | `SearchInput` | component | 37 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/navigation/app-sidebar/app-sidebar.tsx:44` | `AppSidebar` | component | 74 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/navigation/app-sidebar/sidebar-user-button.tsx:30` | `SidebarUserButton` | component | 79 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/portfolio/sortable-media-manager.tsx:56` | `SortableMediaManager` | component | 514 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/push-subscription-manager.tsx:16` | `PushSubscriptionManager` | component | 107 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/reviews/platform-badge.tsx:12` | `PlatformBadge` | component | 24 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/splash-screen/pwa-splash-screen.tsx:7` | `PwaSplashScreen` | component | 10 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/components/stat-bar/types.ts:12` | `StatBarProps` | interface | 5 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/dal/server/lib/helpers.ts:77` | `withTx` | function | 8 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/dal/server/lib/query/schemas.ts:95` | `PaginatedQueryInputBase` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/dal/server/lib/query/schemas.ts:102` | `RESERVED_QUERY_INPUT_KEYS` | const-data | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/analytics/resolver.ts:24` | `resolve` | function | 26 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/analytics/sources/local/appointments-per-adkey.ts:7` | `appointmentsPerAdKey` | const-call | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/analytics/sources/local/leads-per-adkey.ts:7` | `leadsPerAdKey` | const-call | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/analytics/sources/local/signed-per-adkey.ts:7` | `signedPerAdKey` | const-call | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/analytics/sources/remote/meta-insights.ts:6` | `adStats` | const-call | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/analytics/types.ts:72` | `metric` | function | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/analytics/types.ts:88` | `bucket` | function | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/auth/forms/sign-in-form-complex.tsx:21` | `SignInFormComplex` | component | 123 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/auth/hooks/queries/use-get-accounts.ts:8` | `useGetAccounts` | hook | 11 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/auth/lib/utils.ts:3` | `requireAuth` | function | 11 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/auth/lib/utils.ts:15` | `requireUnauth` | function | 9 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/auth/schemas/index.ts:18` | `SignupFormSchema` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:2` | `TradeLocation` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:5` | `ConstructionType` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:8` | `VariableDataType` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:29` | `RoofType` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:32` | `RoofLocation` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:35` | `HVACType` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:38` | `HVACComponent` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:41` | `WindowsType` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:44` | `InsulationLevel` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/construction/constants/enums.ts:47` | `FoundationType` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/funnels/constants/funnel-motion.ts:103` | `HERO_SCRIM_OPACITY_IN` | const-data | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/funnels/constants/funnel-motion.ts:104` | `HERO_SCRIM_OPACITY_OUT` | const-data | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/funnels/types.ts:292` | `AnswersOf` | type | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/funnels/ui/funnel-atmosphere.tsx:9` | `FunnelAtmosphere` | component | 10 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/multi-step-flow/constants/layout.ts:8` | `CARD_SELECT_SINGLE_COLUMN_THRESHOLD` | const-literal | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/multi-step-flow/constants/step-motion.ts:14` | `CARD_STAGGER_CONTAINER` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/multi-step-flow/constants/step-motion.ts:27` | `CTA_PRESS_SPRING` | const-data | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/multi-step-flow/lib/card-options.ts:10` | `icon` | function | 7 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/multi-step-flow/lib/card-options.ts:19` | `img` | function | 7 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/permissions/lib/validate-share-token.ts:28` | `validateShareToken` | function | 23 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/pipelines/hooks/use-pipeline-param.ts:5` | `usePipelineParam` | hook | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/pipelines/lib/derive-customer-pipelines.ts:8` | `deriveCustomerPipelines` | function | 18 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/pipelines/lib/derive-meeting-pipeline.ts:8` | `deriveMeetingPipeline` | function | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/domains/pipelines/ui/pipeline-scope-toggle.tsx:19` | `PipelineScopeToggle` | component | 23 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/accounts/lib/constants.ts:4` | `ACCOUNT` | const-literal | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/activities/hooks/use-activity-action-configs.ts:27` | `useActivityActionConfigs` | hook | 37 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/activities/schemas/index.ts:10` | `NoteMeta` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/activities/schemas/index.ts:15` | `ReminderMeta` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/activities/schemas/index.ts:20` | `TaskMeta` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/activities/schemas/index.ts:26` | `EventMeta` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/activities/schemas/index.ts:29` | `activityMetaSchemas` | const-data | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/app-settings/lib/server-spec.ts:8` | `appSettingSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/app-settings/lib/server-spec.ts:13` | `appSettingServerSpec` | const-data | 14 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/entities/customers/components/lists/proposal-row.tsx:18` | `ProposalRow` | component | 51 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/customers/dal/server/queries.ts:180` | `listCustomers` | function | 11 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/customers/dal/server/queries.ts:207` | `findOrCreateCustomerFromHomeowner` | function | 30 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/customers/lib/customer-predicates.ts:9` | `isSenior` | function | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/customers/schemas/index.ts:68` | `LeadSourceKind` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/finance-options/lib/constants.ts:3` | `FINANCE_OPTION` | const-literal | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/landing/schemas.ts:10` | `ProjectInquiryType` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/lead-sources/lib/server-spec.ts:16` | `leadSourceSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/lead-sources/schemas.ts:44` | `VoipCampaignsPolicy` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/media-files/lib/server-spec.ts:16` | `mediaFileSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/meetings/dal/server/participants.ts:97` | `getOwnerCoOwnerForMeetings` | function | 36 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/meetings/schemas/index.ts:41` | `DealStructureIncentive` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/meetings/schemas/index.ts:65` | `ClosingAdjustments` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/projects/lib/portfolio.ts:16` | `isPurePortfolioProject` | function | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/projects/lib/server-spec.ts:19` | `projectSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/projects/schemas/index.ts:16` | `BeforeAfterPair` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/projects/schemas/index.ts:60` | `CreateProjectFormData` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/push-subscriptions/lib/constants.ts:4` | `PUSH_SUBSCRIPTION` | const-literal | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/users/lib/constants.ts:4` | `USER` | const-literal | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/voip-calls/lib/server-spec.ts:9` | `voipCallSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/voip-campaign-contacts/dal/server/crud.ts:5` | `voipCampaignContactCrud` | dal-spec | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/voip-campaign-contacts/lib/server-spec.ts:9` | `voipCampaignContactSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/voip-campaigns/lib/server-spec.ts:9` | `voipCampaignSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/voip-contact-fields/dal/server/crud.ts:5` | `voipContactFieldCrud` | dal-spec | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/voip-contact-fields/lib/server-spec.ts:9` | `voipContactFieldSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/voip-dids/lib/server-spec.ts:8` | `voipDidSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/voip-link-tokens/lib/server-spec.ts:8` | `voipLinkTokenSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/entities/voip-messages/lib/server-spec.ts:8` | `voipMessageSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/lib/formatters.ts:70` | `numberToUSD` | function | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/lib/formatters.ts:96` | `formatAsPercent` | function | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/lib/formatters.ts:100` | `convertToNumber` | function | 8 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/lib/formatters.ts:109` | `convertUTCToPST` | function | 5 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/lib/google-maps-helpers.ts:1` | `extractPart` | function | 21 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/lib/requests.ts:3` | `getCookiesFromHeaders` | function | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/lib/requests.ts:16` | `appendSetCookieHeader` | function | 9 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/lib/url-parsers.ts:3` | `editMeetingIdParser` | const-call | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/lib/url-parsers.ts:5` | `proposalIdParser` | const-call | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/modules/proposals/core/schemas/index.ts:20` | `CostLine` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/modules/proposals/core/schemas/index.ts:28` | `SectionIncentive` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/modules/proposals/incentives/server-spec.ts:14` | `proposalIncentiveSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/modules/proposals/incentives/service.ts:94` | `ProposalIncentivesService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/modules/proposals/media/server-spec.ts:16` | `proposalMediaSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/modules/proposals/media/service.ts:99` | `ProposalMediaService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/modules/proposals/service.ts:85` | `ProposalService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/modules/proposals/views/server-spec.ts:17` | `proposalViewSchemas` | const-data | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/modules/proposals/views/service.ts:96` | `ProposalViewsService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/services/accounting.service.ts:247` | `AccountingService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/services/ai.service.ts:28` | `AIService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/analytics.service.ts:18` | `AnalyticsService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/analytics.service.ts:19` | `analyticsService` | const-call | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/construction-data.service.ts:77` | `ConstructionDataService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/services/contracts.service.ts:218` | `ContractService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/services/email.service.ts:232` | `EmailService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/measurement.service.ts:77` | `MeasurementService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/meta-insights-sync.service.ts:96` | `MetaInsightsSyncService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/meta-sync.service.ts:166` | `MetaSyncService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/services/notification.service.ts:323` | `NotificationService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/services/pdf.service.ts:51` | `PDFService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/services/providers/ai/client.ts:123` | `AiClient` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/gohighlevel/types.ts:16` | `BinaAdditionalData` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/gohighlevel/types.ts:20` | `GhlContactPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/gohighlevel/types.ts:21` | `GhlAppointmentPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/gohighlevel/types.ts:22` | `GhlOpportunityPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/gohighlevel/types.ts:23` | `GhlNotePayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/gohighlevel/types.ts:24` | `GhlGenericPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/gohighlevel/types.ts:26` | `GhlEnvelope` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/gohighlevel/types.ts:28` | `GhlEventType` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/google-calendar/client.ts:187` | `GoogleCalendarClient` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/google-drive/client.ts:62` | `GoogleDriveClient` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/google-maps/client.ts:64` | `GoogleMapsClient` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/justcall/client.ts:235` | `JustcallClient` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/justcall/constants/index.ts:12` | `JUSTCALL_BULK_MAX_CONTACTS` | const-literal | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/justcall/lib/config.ts:23` | `ParsedJustcallEnv` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/justcall/lib/config.ts:40` | `buildJustcallConfig` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/justcall/lib/config.ts:42` | `isJustcallConfigured` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/justcall/webhooks/events.ts:63` | `JcWebhookEvent` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/meta/client.ts:138` | `MetaClient` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/meta/constants/index.ts:27` | `MetaEventName` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/meta/lib/config.ts:32` | `ParsedMetaEnv` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/meta/lib/config.ts:54` | `buildMetaConfig` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/meta/schemas/insights.ts:42` | `MetaAdInsightsResponse` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/meta/schemas/server-event.ts:47` | `MetaCustomData` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/dal/trades/hooks/queries/use-get-trades.ts:4` | `useGetTrades` | hook | 4 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/lib/blocks-to-html.ts:9` | `blocksToHtml` | function | 30 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/lib/config.ts:14` | `ParsedNotionEnv` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/lib/config.ts:29` | `buildNotionConfig` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/lib/config.ts:31` | `isNotionConfigured` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/lib/extractors.ts:27` | `email` | function | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/lib/extractors.ts:34` | `phone` | function | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/lib/extractors.ts:48` | `dateISO` | function | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/lib/extractors.ts:55` | `peopleIds` | function | 6 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/lib/page-to-html.ts:5` | `pageToHTML` | function | 10 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/types.ts:16` | `NotionDatabaseProperties` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/types.ts:20` | `getDatabaseMeta` | function | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/notion/types.ts:24` | `QueryNotionTradesOptions` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/quickbooks/lib/config.ts:23` | `ParsedQuickbooksEnv` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/r2/lib/config.ts:21` | `ParsedR2Env` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/r2/lib/config.ts:45` | `buildR2Config` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/r2/lib/config.ts:47` | `isR2Configured` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/resend/lib/config.ts:14` | `ParsedResendEnv` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/resend/lib/render-emails.tsx:51` | `renderProposalViewedEmail` | function | 17 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/client.ts:327` | `TwilioClient` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/lib/config.ts:31` | `ParsedTwilioEnv` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/lib/config.ts:60` | `buildTwilioConfig` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/lib/config.ts:62` | `isTwilioConfigured` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/schemas/primitives.ts:12` | `E164` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/schemas/primitives.ts:19` | `TwilioSid` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/schemas/primitives.ts:24` | `IsoDateTime` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/webhooks/messaging.ts:25` | `MessagingStatus` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/webhooks/messaging.ts:41` | `MessagingInboundWebhookPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/webhooks/messaging.ts:55` | `MessagingStatusCallbackPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/webhooks/voice.ts:26` | `VoiceCallStatus` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/webhooks/voice.ts:39` | `VoiceInboundWebhookPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/webhooks/voice.ts:60` | `VoiceStatusCallbackPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/twilio/webhooks/voice.ts:75` | `VoiceDialActionPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/upstash/lib/config.ts:27` | `ParsedQstashEnv` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/upstash/lib/config.ts:46` | `buildQstashConfig` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/upstash/lib/config.ts:66` | `ParsedAblyEnv` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/upstash/lib/config.ts:81` | `buildAblyConfig` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/upstash/lib/config.ts:83` | `isAblyConfigured` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/web-push/client.ts:187` | `WebPushClient` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/web-push/lib/config.ts:29` | `ParsedWebPushEnv` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/web-push/lib/config.ts:41` | `isWebPushConfigured` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/zoho-sign/client.ts:222` | `ZohoSignClient` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/zoho-sign/constants/index.ts:5` | `ZOHO_SIGN_SCOPES` | const-literal | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/zoho-sign/lib/documents/labels.ts:9` | `ENVELOPE_DOCUMENT_LABELS` | const-data | 12 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| ⚠ `src/shared/services/providers/zoho-sign/lib/documents/registry.ts:250` | `computeFinalTcp` | unknown | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/providers/zoho-sign/types.ts:56` | `WebhookPayload` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/scheduling.service.ts:582` | `SchedulingService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/voip/dialer/types.ts:78` | `VoipUnenrollReason` | unknown | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/voip/voip-calls.service.ts:236` | `voipCallsService` | const-call | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/voip/voip-dids.service.ts:144` | `voipDidsService` | const-call | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/voip/voip-link-tokens.service.ts:200` | `voipLinkTokensService` | const-call | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/voip/voip-messages.service.ts:32` | `isOptOutKeyword` | function | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/voip/voip-messages.service.ts:256` | `voipMessagesService` | const-call | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/voip/voip-routing.service.ts:247` | `voipRoutingService` | const-call | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/webhook.service.ts:20` | `WebhookService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/services/zoho-sync.service.ts:79` | `ZohoSyncService` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/types/index.ts:1` | `Prettify` | type | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/types/index.ts:6` | `KeysOfUnion` | type | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/shared/types/index.ts:12` | `getTypedKeys` | function | 3 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/trpc/init.ts:27` | `createCallerFactory` | const | 1 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/trpc/lib/middleware/scope-middleware.ts:31` | `scopeMiddleware` | function | 12 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |
| `src/trpc/types.ts:50` | `AuthedContext` | type | 5 | 0 | no consumer and no local use → delete candidate (verify: string refs, framework, tests) |

</details>


## Suggested next passes, in order

1. When `customer-pipelines/types/index.ts` lands: repoint its three stage-type imports to `@/shared/domains/pipelines/constants/*` and delete the three 1-line shims; drop the 10 dead lines in `src/trpc/types.ts`.
2. Run the un-export codemod (finding 5) as its own commit.
3. Decide the entity-home direction (finding 3) and apply it to the 35 voip/app-settings lines.
4. Rule 15 hooks in `proposal-flow/dal/client/` (4) once W4 settles.
5. Relocate list (13 shared components with one feature consumer): a per-component call.
6. Dead-code triage (finding 6).

---
Generated by a TypeScript-compiler-API analyzer (`analyze-exports.cjs` + `classify.cjs`, ~350 lines, re-runs in ~10s). The scripts live in the session scratchpad (`/tmp/claude-1000/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/f9d7f668-d799-4d44-9d10-c7d5a21f4718/scratchpad`); ask to have them added under `scripts/` if you want to re-run this audit later. Last updated 2026-09-10.
