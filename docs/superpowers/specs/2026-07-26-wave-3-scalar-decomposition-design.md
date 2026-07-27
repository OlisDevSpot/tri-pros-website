# Wave 3 — Funding/Meta Scalar Decomposition + the Drop Ceremony — Design Spec

> **Status**: Approved design, 2026-07-26. Implementation plan: `docs/superpowers/plans/2026-07-26-wave-3-scalar-decomposition.md`.
> **Amendment (2026-07-26, first-principles audit — Oliver's ruling)**: the form layer is REWRITTEN,
> not renamed in place. New form shape: `{ priceDisplayMode, project, funding: FundingData }` — no
> `meta` section, no funding `{data, meta}` envelope, `envelopeDocumentIds` out of form state.
> `FundingData` derives from `fundingDataSchema` (canonical); the blob envelope schemas survive only
> as `@deprecated` frozen legacy-parse schemas (Drizzle `$type` + backfill — their stored keys, e.g.
> `pricingMode`, are NEVER renamed), dying W4. Every old-shape survivor carries `@deprecated` + a
> ledger row. Sections below marked ⟨amended⟩ where the original wording is superseded.
> **Program**: epic [#256](https://github.com/OlisDevSpot/tri-pros-website/issues/256) — JSONB decomposition. Program spec:
> `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` (§4 migration protocol, Addenda A–C).
> **Wave split (Oliver, 2026-07-24/26)**: the original Wave 3 was split in two. THIS wave =
> fundingJSON/formMetaJSON scalars → columns + the batched drop ceremony. **Wave 4** = SOW
> normalization (`proposal_sow_items` + `proposal_cost_lines` + section incentives + write refactor)
> — design handoff at `docs/plans/2026-07-26-wave-4-design-handoff.md`.
> **Ledger**: `docs/plans/jsonb-decomposition-deprecation-ledger.md` — "Waves 3 & 4" section
> pre-registers everything this spec freezes/drops. The drop protocol (ratified 2026-07-18) binds §5.

## 0. Scope in one paragraph

`fundingJSON`'s four scalars and `formMetaJSON`'s two fields become plain columns on `proposals`;
both blobs freeze at cutover (their only other content — the incentives array — has been row-backed
since W2, and the `meta.enabled` wrapper is written-always-true / read-never dead weight). The
financial recompute drops its `startingTcp` jsonb residue. `getFullView` returns an assembled
`funding` view-model so the façade and all renderers keep one shape. Riding this wave's prod push:
all six frozen W1/W2 blob-column drops, the `signing_request_id` → `contract_envelope_id` rename,
and the deletion of the dead backfill/legacy scripts. No new tables. No SOW changes.

## 1. Schema (additive push — zero new tables)

New columns on `proposals` (Addendum C: no pgEnums; all writes Zod-gated at the boundary):

| Column | Drizzle property | Type | Source blob field |
|---|---|---|---|
| `starting_tcp_cents` | `startingTcpCents` | `bigint({ mode: 'number' })`, nullable | `fundingJSON.data.startingTcp` |
| `deposit_amount_cents` | `depositAmountCents` | `bigint`, nullable | `fundingJSON.data.depositAmount` |
| `cash_in_deal_cents` | `cashInDealCents` | `bigint`, nullable | `fundingJSON.data.cashInDeal` |
| `misc_price_cents` | `miscPriceCents` | `bigint`, nullable | `fundingJSON.data.miscPrice` |
| `price_display_mode` | `priceDisplayMode` | `text({ enum: ['total','breakdown'] })` notNull default `'total'` | `formMetaJSON.pricingMode` |
| `envelope_document_ids` | `envelopeDocumentIds` | `text[]`, nullable | `formMetaJSON.envelopeDocumentIds` |

Decisions inside the table:

- **Money is integer cents** (`*_cents`, house rule; `Math.round(dollars * 100)`, division on read).
  Nullable like `final_tcp_cents` — Zod requires the values on write; nullability exists for the
  additive window and legacy tolerance, not as a domain state.
- **`price_display_mode`, not `pricing_mode`** (Oliver, 2026-07-26): the column is minted with the
  vocabulary the 2026-07-24 pricing-editor ruling ratified (`pricingMode` → `priceDisplayMode`),
  avoiding a second rename. *Interim caveat, documented deliberately*: post-Wave-0 the mode has
  zero effect on computation (`computeFinalTcp` is mode-agnostic), but until the pricing editor
  lands it still gates authoring behavior — the breakdown-mode positive-`sectionPrice` validation
  and the client-side `startingTcp = Σ sectionPrice + miscPrice` sync. The name describes the
  ratified end-state; the residual authoring coupling dies with the editor (post-waves). ⟨amended⟩
  The RHF form gets a NEW top-level `priceDisplayMode` field (the `meta` section dies); the frozen
  legacy `formMetaSectionSchema` keeps its stored `pricingMode` key so the backfill can parse
  historical blobs.
- **`misc_price_cents` is carried, not killed**: the pricing-editor ruling declares miscPrice dead
  post-waves; W3 only relocates live data. (Referenced ruling, not folded in.)
- **`envelope_document_ids` is `text[]`**, Zod-validated against the envelope-doc id enum at the
  write boundary (supersedes the program spec's pre-Addendum-C "pgEnum array" wording).
- **`meta.enabled` gets no column** — grep-verified written-always-`true`, read-nowhere. Dies with
  the blobs.

**At cutover** (same release that flips reads+writes): `fundingJSON` → `fundingJSONDeprecated` and
`formMetaJSON` → `formMetaJSONDeprecated` (drizzle property renames; physical columns keep their
names), both dropped from NOT NULL (new inserts no longer write them), both `.omit()`-fenced in
insert/update schemas. They drop on the **Wave 4** prod push (≥ one-release window — ledger row).

## 2. Write paths

Every current writer of the two blobs, and what it becomes:

| Writer | Today | After W3 |
|---|---|---|
| `edit-proposal-view.tsx` `buildMutationData` | sends whole `formMetaJSON` + `fundingJSON` (incentives `[]`) | sends `priceDisplayMode` + the four cents scalars (via mapper); no blob keys |
| `create-new-proposal-view.tsx` `buildMutationData` | same, at insert | same |
| `create-proposal-popover.tsx` (pipelines) | minimal blobs | `priceDisplayMode: 'total'` + zero/absent scalars; still sends `projectJSON` (blob until W4) |
| `setCashInDeal` (`dal/server/mutations.ts`) | reads raw `fundingJSON`, rewrites `data.cashInDeal`, re-scrubs | plain `cash_in_deal_cents` column update (pre-registered in its own code comment) |
| `applyEnvelopeContext` (`contracts.router.ts`) | writes `formMetaJSON.envelopeDocumentIds` | writes the `envelope_document_ids` column |
| `scrubBlobIncentives` + server-spec `create.before`/`update.before` scrub hooks | forces `fundingJSON.data.incentives = []`, tripwire-warns | **deleted** — with `fundingJSON` unwritable there is nothing to scrub. Runbook step: check logs for tripwire firings before deletion (a firing = unknown writer, escalate) |

Mechanics:

- **`envelope_document_ids` leaves the form payload entirely** — today the edit save re-sends it
  inside the whole `formMetaJSON` blob, quietly violating `#agreement-context-as-coherent-unit`
  ("`applyEnvelopeContext` is the only writer"). Post-W3 the column has exactly one writer, as
  documented. Deliberate tightening, not an accidental behavior change.
- **Dollars→cents mapper pair** in `entities/proposals/lib/` (the `incentive-rows.ts` pattern):
  `fundingDomainToColumns` / `fundingColumnsToDomain`. ⟨amended⟩ The RHF form is rewritten
  first-principles: `{ priceDisplayMode, project, funding: fundingDataSchema }` — flat dollars, no
  `meta` section, no funding envelope, dead `meta.enabled` not fabricated anywhere;
  `buildMutationData` converts at the payload edge. The `project` envelope survives only because
  `projectJSON` is blob-backed (tallied, dies W4). The untallied dual-shape branch in
  `get-proposal-aggregates.ts` and the dead `formValuesToProposal` helper die in the same commit.
- **Recompute trigger set** (`server-spec.ts` `update.after`): `'fundingJSON' in input` becomes
  `'startingTcpCents' in input`; `'projectJSON' in input` keeps triggering (section incentives
  still live there until W4).
- **`frozenProposalLockedFields`** (`lib/proposal-lock.ts`): `'formMetaJSON'`/`'fundingJSON'`
  replaced by the six new column names. Ladder mechanics, lifecycle-field carve-outs, and the
  share-token gating are untouched.
- **Meeting flow** ⟨amended⟩: the form shape now changes, so `buildProposalDefaults` gets a
  minimal mechanical reshape to the new form shape — nothing more (flow is broken/unused by
  ruling; stub, don't repair). `snapSowFromMeeting` touches only `projectJSON` (W4).
- **AI client untouched**: it raw-writes `projectJSON`, which still exists this wave. (Paused
  feature; ledgered escape hatch — do not touch per standing ruling.)

## 3. Read paths

- **`getFullView` returns `funding: FundingData`** — a flat dollars view-model assembled from the
  four cents columns + `proposal_incentives` rows (`incentiveRowsToDomain`). This ABSORBS the W2
  incentive-hydration bridge (its ledger row is satisfied by this wave, not W4 — the bridge's home
  blob dies here). `priceDisplayMode` / `envelopeDocumentIds` need no wrapper: they are plain row
  columns on the returned proposal. `fundingJSON` / `formMetaJSON` disappear from
  `ProposalWithCustomer`; **tsc drives the consumer sweep** (~15 files: funding UI, pricing
  breakdown + internal calc block, project overview, heading, PDF doc-definition, summary route,
  Zoho `proposal-context`/`registry`/`assemble-envelope`, `converters.ts`, edit-view hydration).
- **Façade untouched**: `buildPricingBreakdown` / `computeFinalTcp` / `computeProposalFinancials`
  keep their nested-dollars inputs — fed `proposal.funding` server-side and live RHF state
  client-side. One shape, no second input path.
- **Recompute SQL** (`recomputeProposalFinancials`): the `startingTcp` jsonb term becomes
  `COALESCE(${proposals.startingTcpCents}, 0)`. The section-incentives jsonb term **stays** —
  documented residue #2, dies in W4 (so this wave has zero double-count exposure; section rows
  don't exist yet). `scripts/recompute-final-tcp.ts` updates its duplicated SQL **in the same
  commit** (keep-in-sync contract). The third SQL copy lives in `backfill-wave2-children.ts`,
  which this wave deletes (§5).
- **`calc_version` stays 1.** Formula semantics and rounding are unchanged — the backfill rounds
  `ROUND(x*100)` exactly as the current SQL does, so a stored column read reproduces the jsonb
  read bit-for-bit. The bump to 2 (+ the decision on chokepoint stamping) belongs to W4, where
  per-item cents rounding genuinely changes policy. DOCS.md changelog gains a v1 note recording
  the input-source change as non-versioning.
- **`listProposals`** untouched (reads `final_tcp_cents`).

**Tightening-tally registration (Oliver's rider, 2026-07-26)**: the assembled `funding` view-model
(flat `FundingData`, dollars) gets a seam-register row in the ledger — re-examine post-waves
(pricing-editor re-derivation) whether the assembled view-model remains the right shape or should
go row-native. This is a deliberate "revisit" marker, not a bridge with a scheduled death.
⟨amended⟩ `FundingData` is canonical (`z.infer<typeof fundingDataSchema>`); it is NOT derived from
the blob envelope — the envelope derives from it.

## 4. Backfill + cutover (spec §4 protocol instantiated)

1. **Additive push**: the six columns land beside the blobs (`pnpm db:push:dev` → worktree/dev;
   prod additive push at ceremony start).
2. **`scripts/backfill-wave3-scalars.ts`** — W2 harness shape: app `@/shared/db` singleton
   (`DRIZZLE_TARGET=prod` is THE prod lever), `describeTargetDb` banner, `--dry-run`, idempotent
   (pure re-derivation from blobs; re-run = converge), per-row Zod parse of both blobs
   (`fundingSectionSchema`/`formMetaSectionSchema`), cents via `Math.round(x*100)`, **read-back
   parity** (field-level diff of columns vs blob per row) + a `final_tcp_cents` invariance check
   (recompute before/after must be identical — proves the source swap is value-neutral), non-zero
   exit on any mismatch. Cutover-window-only for the same reason as W2's (post-cutover blobs go
   stale); registered in the ledger with its death rider (dies with the frozen blobs on the W4
   push).
3. **Neon branch rehearsal**: fresh branch of prod → additive push → backfill → parity → the §5
   DDL (drops + rename) → `pnpm tsc` against the post-drop schema. Only a clean rehearsal
   authorizes prod.
4. **Prod cutover**: backfill prod, ship the release that flips reads+writes (blobs frozen, §1).
   Post-deploy: parity re-run in verify mode + `scripts/recompute-final-tcp.ts --dry-run` (zero
   drift expected).
5. **Rollback story**: frozen blob columns hold the pre-cutover truth for one release; Neon PITR
   backstop.

All prod-mutating commands are Oliver's to run — the implementation plan delivers a paste-ready
runbook.

## 5. The drop ceremony (rides this wave's prod push)

Per the ratified column-drop protocol — **each column individually**: reader/writer grep sweep
(snake_case + camelCase + schema/type names; every hit must be a registered ledger row), prod
data-parity spot-check, Neon rehearsal of the exact DDL, PITR window noted in the runbook.

**DDL (manual, paste-ready in the runbook — not left to drizzle push):**

- `DROP COLUMN` × 6: `customers.customer_profile_json`, `customers.property_profile_json`,
  `customers.financial_profile_json`, `customers.lead_meta_json`, `user.agent_profile_json`,
  `lead_sources.voip_config_json`.
- `ALTER TABLE proposals RENAME COLUMN signing_request_id TO contract_envelope_id` — **manual by
  design**: drizzle-kit push may diff a literal change as DROP+ADD (data loss). The schema string
  literal (`text('signing_request_id')` → `text('contract_envelope_id')`) changes in the same
  release; the drizzle property is already `contractEnvelopeId`, so no TS call sites move.

**Same-commit code deletions** (drop protocol: scripts/schemas die with their columns):

- Scripts: `backfill-wave1-columns.ts`, `backfill-wave2-children.ts`, `seed-bina-contacts.ts`,
  `backfill-interested-trades-raw.ts` + their four package.json entries (`backfill:trades`,
  `backfill:trades:dev`, `seed:bina-contacts`, `seed:bina-contacts:dev`).
- `LEGACY_ENRICHMENT_LABELS` (`entities/customers/constants/funnel-intake-fields.ts`) — sole
  importer is backfill-wave2 (re-verify no new importer at execution time).
- Orphaned blob Zod schemas + types: `customerProfileSchema`/`propertyProfileSchema`/
  `financialProfileSchema` (+ types) from customers, `agentProfileSchema` (+ type) from users,
  `voipConfigSchema` (+ type) from lead-sources; the `$type<>` imports they anchor.
- `scripts/snapshot-prod-to-dev.ts` `skipColumns` entry for `agentProfileJSONDeprecated`.
- `scripts/verify-long-path.ts` + `verify-short-path.ts`: raw-SQL `signing_request_id` literals
  updated to `contract_envelope_id` (they are live smoke tools, not dead code — updated, not
  deleted).
- Ledger: check off every W1/W2 drop row with the commit hash.

## 6. Docs & convention riders (in the wave's PRs)

1. **`incentiveTypes` consolidation** (audit finding 2026-07-24): canonical = the 2-value array in
   `entities/proposals/schemas/index.ts` (drives the DB column + Zod). ⟨amended⟩ The 5-value copy
   in `src/shared/constants/enums/proposals.ts` is DELETED, not aliased (its only consumer,
   `funding-fields.tsx`, imports the canonical and drops its filter — the canonical array IS the
   2 real values).
2. Stale-comment fix: `entities/proposals/schemas/index.ts:81-84` still states the superseded
   blanket "never persist derived values" doctrine — rewrite against the three-stage standard.
3. Path fix: `jsonb-columns.md` cites `docs/domain/ubiquitous-language.md`; actual is
   `docs/ubiquitous-language.md` (3 cites).
4. `proposals/DOCS.md`: `#final-tcp-derived` residue list shrinks to one (section incentives);
   `#jsonb-merge-on-update` + `#agreement-context-as-coherent-unit` updated for the column moves
   (`formMetaJSON.envelopeDocumentIds` → column); calc_version v1 note (§3).
5. Ledger bookkeeping: new rows for the W3 backfill script, the frozen `fundingJSON`/
   `formMetaJSON` columns + `fundingSectionSchema`/`formMetaSectionSchema` ⟨amended⟩ as
   `@deprecated` frozen legacy-parse schemas (importers: Drizzle `$type` + backfill ONLY — they do
   NOT survive as form shapes; kill trigger W4), the project-envelope/`sectionMetaSchema`/
   `meta.enabled` form-shape tally (dies W4), and the funding view-model revisit marker (§3).
6. Memory: `project-jsonb-strategy-research.md` status line; MEMORY.md hooks.

## 7. Explicitly out of scope

- **Everything SOW** — `proposal_sow_items`, `proposal_cost_lines`, section incentives, the write
  refactor, freeze-gate extension to child tables, `projectJSON` freeze, positional-SQL fixes,
  calc_version 2: **Wave 4** (`docs/plans/2026-07-26-wave-4-design-handoff.md`).
- **Unified pricing editor** (POST-WAVES ruling stands): no editor UX, no miscPrice removal, no
  display-mode behavior change — this wave only mints the `price_display_mode` name.
- Server-side enforcement of the breakdown-mode `startingTcp = Σ sectionPrice + miscPrice`
  invariant (client-side sync stays as-is; the invariant becomes moot in the pricing-editor era).
- AI-summary path (paused; untouched, still compiles — writes `projectJSON`).
- Meeting flow (untouched this wave).
- `replaceProposalIncentives` cents-at-the-edge tightening (ledger row: W4's form refactor).

## 8. Verification

- `pnpm tsc` + `pnpm lint` gate every PR (never `pnpm build`).
- Backfill parity + `final_tcp_cents` invariance check (§4.2) = the data acceptance test; Neon
  rehearsal = the staging run; rehearsal output pasted into the PR.
- Post-cutover smoke drive (before the W4 blob drops): create proposal from meeting → edit + save
  (both display modes) → PDF renders → summary route → Zoho envelope assembly (deposit +
  envelope-doc fields) → share-token homeowner view → `setCashInDeal` → lock a proposal
  (draft envelope) and verify the six new columns reject edits.
- `tsx scripts/verify-financials-facade.ts` + `verify-assemble-envelope.ts` after the sweep.

## 9. Risks

| Risk | Mitigation |
|---|---|
| Blob rows predating current Zod shapes fail the backfill parse | Per-row failure report, non-zero exit, human decides (fix data / amend schema); rehearsal runs on a full prod copy |
| Rename executed via push → DROP+ADD data loss | Rename is a manual `ALTER TABLE` runbook step; rehearsed on the Neon branch; push diff reviewed |
| A missed `fundingJSON`/`formMetaJSON` consumer survives the sweep | tsc fails on the removed properties — the sweep is compiler-driven; verify scripts + smoke drive cover runtime |
| Drop ceremony removes a column something still reads | 4-step protocol per column; the 2026-07-24 audit already swept all six (only registered readers remain) |
| Tripwire was firing (unknown blob-incentive writer exists) | Runbook checks logs before deleting the scrub; a firing escalates per the ledger's scrub row |
