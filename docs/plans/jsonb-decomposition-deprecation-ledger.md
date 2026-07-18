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

## Column-drop protocol (RATIFIED 2026-07-18 — binds every DROP below)

Oliver's ruling: the frozen columns DO drop (codebase cleanup post-waves), **batched with the
Wave-3 prod push** (one ceremony, per the W2-cutover WAIT decision) — but ONLY after a thorough
per-column investigation. Before ANY `DROP COLUMN` of a data-filled column:

1. **Reader/writer sweep** — grep ALL of `src/ scripts/ docs/` for the column name (snake_case
   AND camelCase property) plus its Zod schema/type names; every hit must be a registered ledger
   row or the drop is blocked.
2. **Data-parity proof** — SQL against PROD: count non-null blob rows, spot-diff a sample against
   the promoted columns / child rows they were decomposed into. Any row where the blob holds data
   the new shape doesn't = investigation finding, not a shrug.
3. **Neon branch rehearsal** of the exact drop DDL + the app's `pnpm tsc` against the
   post-drop schema.
4. **PITR awareness** — note the restore window in the runbook step; the drop commit deletes the
   corresponding backfill script + schemas in the SAME commit (rows below).

## Wave 1 leftovers — kill trigger: the Wave-3 prod push (WAIT ruling 2026-07-17; drop protocol above)

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

## Wave 2 — frozen/scaffolding — kill trigger: the Wave-3 prod push (batched with the W1 drops; drop protocol above)

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
| [ ] | `incentives: []` blank-write in `buildMutationData` (edit + create views) + third blank-writer found by 2026-07-15 seam audit: `features/customer-pipelines/ui/components/create-proposal-popover.tsx:69-77` | `features/proposal-flow/ui/views/edit-proposal-view.tsx` + `create-new-proposal-view.tsx` (confirmed both) + the pipelines popover | dies with fundingJSON decomposition |
| [ ] | Freeze-gate gap: only `replaceProposalIncentives` + `applyEnvelopeContext` are gated; blob-wide financial freeze | proposals DAL (confirmed: no other write path is freeze-gated yet) | W3 write refactor extends the gate (Addendum A.1.2) |
| [ ] | Incentive scrub-with-tripwire (**built `295c20b1`**): `scrubBlobIncentives` in `entities/proposals/lib/scrub-blob-incentives.ts`, wired into `server-spec.ts` `create.before`/`update.before` + `setCashInDeal` (forces `fundingJSON.data.incentives = []`, warns loudly on non-empty scrub) | `entities/proposals/lib/scrub-blob-incentives.ts` + `lib/server-spec.ts` hooks + `dal/server/mutations.ts:setCashInDeal` | Sanctioned bridge per `ubiquitous-language.md` — exists ONLY because the blob incentives array survives until W3; dies in the same commit that decomposes `fundingJSON`. If found alive after W3 ships, that's a bug. If the tripwire warning fires before W3, escalate scrub→reject |
| [ ] | `proposal-doc-definition.ts` / AI-summary / Zoho-context reading blob-shaped `funding`/`sow` | via getFullView bridge (confirmed: `pdf.service.ts` + proposal-flow query/view consumers all read through `getFullView`, none read `proposal_incentives` directly) | W3 flips them to rows |

## Superseded design docs — kill trigger: plan Task 11 (this wave)

| | Item | Why confusing if left |
|---|---|---|
| [x] deleted (this task's commit) | `docs/plans/2026-06-27-jsonb-deep-merge-handoff.md` | Describes BUILDING the deep-merge machinery Wave 2 deletes — direct contradiction of current architecture. Inbound refs checked: only historical mentions inside other dated plan/spec docs (`2026-07-09-jsonb-research-findings-and-relational-decomposition.md`, `2026-06-27-funnel-data-capture-unified-design.md`, `2026-07-03-jsonb-restructure-design.md`, `2026-07-03-ws5-lead-meta-table.md`) — left as-is per convention (point-in-time design records); no live/evergreen doc (DOCS.md, codebase-conventions, CLAUDE.md) pointed at it |
| [x] deleted (this task's commit) | `docs/plans/2026-06-27-jsonb-deep-merge-implementation-plan.md` | same — same inbound-ref sweep result |
| [x] deleted (this task's commit) | `docs/superpowers/plans/2026-07-03-ws2-jsonb-deep-merge.md` | same ("WS-2" deep-merge workstream, superseded by the decomposition program) — same inbound-ref sweep result |
| [x] memory truth-pass complete (Task 9 + Task 11) | Memory: `memory/project-funnel-capture-and-jsonb-merge.md` (jsonb-merge rule reframed HISTORICAL, points at this ledger), `memory/project-jsonb-strategy-research.md` (already current as of Task 9 — Wave 2 IMPLEMENTED status, verified not stale), `memory/feedback-runtime-db-env.md` (flagged as possibly-stale by the T11 controller re: pre-env-axes-refactor NODE_ENV/script-db.ts pattern; verified against current code — a parallel session already rewrote it to the current DRIZZLE_TARGET truth alongside landing `0803126a` on main, so no change was needed here), `memory/MEMORY.md` hook lines for all three verified current | Recalled memories asserting the merge mechanism exists would mislead future sessions |

## Wave 3 (pre-registered, expand when W3 is planned)

- **Column rename `signing_request_id` → `contract_envelope_id`** rides the W3 prod push
  (naming ratified 2026-07-18: `contractEnvelope` is canonical; code-side rename shipped in the
  tightening pass — drizzle property already `contractEnvelopeId` mapping the old column name)
- **The batched drop manifest** (per the WAIT ruling + drop protocol above): 5 W1 frozen blob
  columns, `customers.lead_meta_json`, their backfill scripts + orphaned blob Zod schemas +
  legacy one-off scripts (all registered in the W1/W2 sections above)
- `proposals.projectJSON` + `proposals.fundingJSON` columns (frozen at W3 cutover, dropped the
  release AFTER — the one-release rollback window applies to W3's own blobs, not to the
  already-frozen W1/W2 columns above)
- `projectSectionSchema`/`fundingSectionSchema` as DB-blob schemas (survive only as form shapes if W3 keeps them)
- `snapSowFromMeeting` blob-shape logic, `sowToPlaintext` blob reader, positional `->0->'trade'` SQL in customer-pipelines/agent-dashboard
- `getFullView` hydration bridge + recompute jsonb residues (rows above)

## Seam-tightening register — permissive seams / escape hatches (audit 2026-07-15)

> **Standing per-wave section (Oliver's ruling 2026-07-15).** This is the program's **tightening
> tally** per `docs/ubiquitous-language.md#migration--contract-change-vocabulary`: every
> additive-because-of-the-transition site, recorded so the API surface gets re-tightened to the
> NEW contract only. Audited by 4 parallel subagents over Waves 1–2 (branch
> `feat/262-wave-2-child-tables`). Same discipline as above: `[ ]` open · `[x] tightened (commit)`
> · `[x] KEEP` = vocabulary-pass verdict that the wide surface is REQUIRED business logic (fails
> the tally entry test — it would exist if written fresh today), not transition debt.
> Re-run this audit at the end of EVERY wave and append findings here.
>
> **Vocabulary-pass verdicts (2026-07-16):** each row below re-tested against the entry test.
> Escape hatches and dual-shape tolerance → close. Sanctioned bridges (named kill trigger) →
> untouched until their trigger. Wide-but-required single-function surfaces → marked KEEP so
> future audits don't re-litigate them into dead-code-generating "tightenings."
>
> **Freeze gate reworked into the lock ladder (2026-07-18, #264):** every gate reference in
> this register now means `isProposalFrozen` / `getProposalLockState` from the canonical
> `entities/proposals/lib/proposal-lock.ts` (four tiers: unlocked → draft-locked →
> inflight-locked → terminal-locked). The W2 smoke-drive misfire's root cause was the
> auto-draft stage in "Send Proposal" (retired in #264) — envelopes are now always manual, so
> envelope-exists is a meaningful lock signal again. Whole-proposal field-scoped `update.before`
> gate covers content writes incl. the share-token path. Canonical:
> `proposals/DOCS.md#proposal-lock-ladder` + ADR-0004 amendment 2026-07-18. The W3 blob-wide
> freeze rows below inherit the ladder predicate.

### Critical — old shape can still be WRITTEN (close before/with W3, ideally sooner)

| | Seam | Where | Problem | Tightening direction |
|---|---|---|---|---|
| [x] tightened (`295c20b1`) | Update/create Zod accepts + persists non-empty blob incentives | `entities/proposals/schemas/index.ts:88` (`fundingDataSchema.incentives`) → `insertProposalSchema` → `updateProposalSchema.partial()` → generic `updateImpl` whole-column `.set()` | Any authed caller (incl. share-token path) can write `fundingJSON.data.incentives` verbatim into the blob — bypassing `replaceProposalIncentives`, its freeze gate, and row creation. Ghost blob data is shadowed by the getFullView bridge today but resurfaces the instant the bridge dies (W3). The ledger's "writers store `[]`" claim is caller discipline, not a schema/DAL guarantee | **RATIFIED 2026-07-16 (Oliver): scrub-with-tripwire.** `create.before`/`update.before` hooks in the proposals server-spec force `fundingJSON.data.incentives = []` whenever `fundingJSON` is present; when the scrub removes NON-EMPTY incentives, log a loud warning (proposal id + input source) so unknown writers surface. Chosen over a persisted/form schema split (same W3 expiry, heavy type ripple, collides with façade plan Task 9) and over hard-reject (bets the writer enumeration is complete). Escalation: flip scrub→reject if the warning never fires. Ships in the post-merge tightening pass — bridge pre-registered in the W3 section below |
| [x] tightened (`295c20b1`) | `funding.tsx` cash-in-deal Save re-populates the blob from hydrated rows | `features/proposal-flow/ui/components/proposal/funding.tsx:135-146` | Spreads `getFullView`-hydrated (row-derived, potentially non-empty) incentives back into a `fundingJSON` blob write. Actively violates the blank-writer invariant. (Since #264, the whole-proposal `update.before` gate blocks this write once the contract is SENT — but the pre-send window still writes hydrated incentives into the blob) | **RATIFIED 2026-07-16: PERMANENT fix, not scaffolding** — narrow the Save to send only `{ cashInDeal }`; reconstructing the whole blob at the write edge is the bug, and narrow intentional writes carry straight into the row world. Ships in the post-merge tightening pass |

### Important — old shape travels deeper than the capture edge / unvalidated writes

| | Seam | Where | Problem | Tightening direction |
|---|---|---|---|---|
| [x] KEEP (vocabulary pass 2026-07-16) | `upsertLeadAttribution({ customerId, leadMeta })` accepts the whole LeadMeta blob | `entities/customers/dal/server/mutations.ts:83-109` | Fails the tally entry test: `LeadMeta` IS the sanctioned capture wire format (Explicitly ALIVE above) and this function IS the capture-persistence operation — written fresh today it would still take the wire shape and split internally. One deep function (small interface, split + two-table upsert behind it) beats hoisting the split to the service and shallowing the DAL. NOT transition debt. The real defects on this path are the two validation rows below | none — keep the interface; close the two parse gaps below |
| [x] tightened (`3b84fac2`) | `upsertLeadAttribution` writes via `upsertOneToOne` with NO Zod parse | same, `:87-93` → `shared/dal/server/lib/upsert-one-to-one.ts:21` | `upsertOneToOne` takes `Record<string, unknown>`, no schema parse (sibling `upsertCustomerProfile` DOES parse). Violates `jsonb-columns.md#zod-parse-at-write-boundary` — unvalidated LeadMeta lands in `capture_json` | Parse through `insertCustomerLeadAttributionSchema` before the upsert (mirror `upsertCustomerProfile`), or give `upsertOneToOne` a schema param |
| [x] tightened (`3b84fac2`) | `captureJSON` un-validated in its insert schema | `db/schema/customer-lead-attribution.ts:35` | drizzle-zod types the `$type<LeadMeta>` jsonb loosely — even a parse wouldn't check the snapshot's internal shape | Override `captureJSON: leadMetaSchema` in the insert-schema builder |
| [x] tightened (`3b84fac2`) | `buildFunnelLeadNote` dual-shape tolerance (legacy flat branch) | `shared/domains/funnels/lib/build-funnel-lead-note.ts:24-32` | Accepts BOTH new `{label,value,order}` entries AND legacy flat `Record<string,string>`; the legacy branch is dead on the only live path. Its sibling (`FunnelIntakePanel` `toRows()`) was already deleted for exactly this (`215790be`) — this one was missed by that sweep | Delete the `typeof raw === 'string'` branch; type param against `enrichmentRecordSchema` |
| [ ] **DEFERRED** | AI-summary write bypasses the financial chokepoint (found 2026-07-17, derived-values research) | `entities/proposals/ai/client.ts:106-114` | Direct `db.update(proposals).set({ projectJSON })` skips the entity-server `update.after` hook, so `recomputeProposalFinancials` never runs — the ONLY financial-adjacent write path outside the `final_tcp_cents` chokepoint. Latent today (AI output schema is `{summary, energyBenefits}`, non-financial) but violates Rule 19 (DAL-first) and breaks the cache-column discipline the moment that schema grows a financial field | Route through the proposals update DAL (hooks fire), or at minimum call `recomputeProposalFinancials` after the write. **Oliver 2026-07-18: the AI-summary feature is PAUSED — do not touch this path until that feature work resumes; fix it as part of that work** |

### Wave-1 strays — frozen shapes still reachable outside the sanctioned backfill

| | Seam | Where | Problem | Tightening direction |
|---|---|---|---|---|
| [x] tightened (`3b84fac2`) | Raw-SQL read of frozen `customer_profile_json` | `scripts/verify-short-path.ts:39` (`AND c.customer_profile_json ? 'age'`) | Undocumented second reader of a frozen W1 blob — falsifies the "read only by backfill-wave1" invariant this ledger and the column JSDoc assert; reads stale/absent data since `age` was promoted | Change predicate to `AND c.age IS NOT NULL` |
| [x] tightened (`3b84fac2`) | Dead `isSourceEnabled` imports frozen `VoipCampaignsPolicy` | `shared/services/voip/campaigns/lib/eligibility.ts:11,27` | Zero callers; the sole live-code importer of the frozen blob type. Will break unexpectedly when `voipConfigSchema` is deleted per the W1 rows above; a revival would re-admit the nested blob shape | Delete the function + import (enrollment already reads the flat `voipCampaignsEnabled` column) |
| [ ] | `snapshot-prod-to-dev.ts:105` names `agentProfileJSONDeprecated` in `skipColumns` | `scripts/snapshot-prod-to-dev.ts:105` | Benign operational exclusion; dangles when the column drops | Remove the entry in the same commit that drops `agent_profile_json` |

### Contract-narrowing — over-broad inputs / blob-typed params (opportunistic)

| | Seam | Where | Problem | Tightening direction |
|---|---|---|---|---|
| [x] tightened (`3b84fac2`) | `createFromIntake` admits the full `leadMetaSchema` source union | `trpc/routers/customers.router/business.router.ts:167` | Intake form only ever sends operational fields + `requestedTrades`, but the schema admits full `bina\|generic\|funnel` source payloads the channel should never originate | Channel-specific narrowed input (`leadMetaSchema.pick({...})`) |
| [x] KEEP (vocabulary pass 2026-07-16) | `buildLeadNote(leadMeta: LeadMeta \| null)` takes the whole blob type | `entities/customers/lib/build-lead-note.ts:22` | Fails the tally entry test: its actual input IS `attribution.captureJSON`, which is permanently `LeadMeta`-typed (the immutable snapshot). Narrowing the param would add a mapping layer at every call site for zero leverage — dead-code-shaped "tightening" | none — the snapshot's designed consumer |
| [ ] | `replaceProposalIncentives` accepts blob-dollars `Incentive[]`, converts inside the DAL | `entities/proposals/dal/server/mutations.ts:74-102` | Correct seam (IS the row write path + freeze gate) but transports the old dollars shape one layer deeper than needed | W3 form refactor: row-cents input at the router edge; dollar hop dies |
| [x] SKIP (vocabulary pass 2026-07-16) | Generic CRUD factory has no frozen-column backstop | `shared/dal/server/lib/create-crud-dal.ts:76,125` | Enforcement is 100% per-entity `.omit()` — audit confirmed all live frozen columns ARE omitted. A `spec.frozenColumns` deny-list would be machinery built for columns scheduled to DROP in the next release — it would be born dead code. If a future wave freezes new columns long-term, revisit | none — deliberately not built |

### Doc/prose staleness found by the audit (fix as docs pass)

| | Item | Where | Problem |
|---|---|---|---|
| [x] fixed (`3b84fac2`) | `enrichFunnelLead` comment describes the deleted `jsonb_set` merge | `shared/services/customer-intake.service.ts:150-155` | NOT on the Task-9 sanctioned-tombstone list — genuinely stale description of a mechanism deleted in `215790be`; rewrite to describe the row upsert |
| [ ] | W1 ledger rows cite stale line numbers | this file, W1 section (`customers.ts:30/:101` → actual `:29/:104-106` etc.) | Cosmetic drift after W2 edits to `customers.ts`; refresh when the W1 rows get checked off |

### Audit-confirmed CLEAN (no action — recorded so future audits don't re-litigate)

- All 5 W1 frozen columns fenced on EVERY write surface: `.omit()` inherited into `.partial()` update schemas, double-parsed (tRPC edge + DAL), Zod default key-stripping, field-CASL; `agentProfileJSONDeprecated` has no write surface at all. No `.passthrough()`/`z.any` anywhere in `src/trpc/` or `src/shared/dal/`.
- No dual-shape `?? blob` fallback reads anywhere in live `src/`. No live reader/writer of `leadMetaJSONDeprecated` (scripts only, all registered above).
- `deep-merge-jsonb.ts` gone; no surviving generic merge utility.
- Generic `duplicateImpl` cannot re-animate frozen blobs (insert-parse strips them); proposals duplicate override copies rows + recomputes.
- `listProposals` price filter/sort read `final_tcp_cents` (column, not jsonb). No financial mutation path skips recompute (given the two Critical rows above get closed).
- Agent-settings + campaigns-policy forms are flat-column round-trips; `customer_lead_attribution` has no update handler; `setFunnelLeadAddress` gates on the attribution row.
