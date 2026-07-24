# Wave 3 Design Session — Handoff (2026-07-24)

**For:** a fresh Claude session starting the Wave 3 (SOW normalization) design for epic [#256](https://github.com/OlisDevSpot/tri-pros-website/issues/256).
**From:** the 2026-07-24 session — pricing-editor deferral ruling + 3-agent wave-readiness audit.
**Process:** this is a DESIGN session — use `superpowers:brainstorming` → spec (`docs/superpowers/specs/`) → `superpowers:writing-plans` → subagent-driven execution, the same pipeline Waves 1–2 and the façade used.

## Readiness verdict (3-agent audit, 2026-07-24)

**GO.** Waves 0–2 plus all follow-ups are complete, verified in code, and closed on GitHub:

- **Spec-vs-reality auditor:** every W1/W2 deliverable (as amended by Addenda B/C) exists in code — `customer_profiles`, `customer_lead_attribution`, `customer_enrichment`, `proposal_incentives` child tables; `final_tcp_cents` + `calc_version`; `recomputeProposalFinancials` chokepoint; merge machinery + `finalTcpExpr` fully deleted. No runbook step unexecuted. Six frozen `*Deprecated` blob columns physically remain by design (rollback window) — their drop is W3's job.
- **Ledger auditor:** `docs/plans/jsonb-decomposition-deprecation-ledger.md` is trustworthy — zero overdue rows, every `[x]` claim matches code, both Critical seams already tightened (`295c20b1`), drop manifest intact. One stale citation fixed 2026-07-24 (AI-client path).
- **GitHub auditor:** no open PRs; wave sub-issues #258/#259/#262/#264/#257 all closed; main in sync with origin. Epic #256 body reconciled 2026-07-24 (W1/W2 checked off, post-waves step added). Façade review follow-ups now tracked as [#279](https://github.com/OlisDevSpot/tri-pros-website/issues/279) (non-blocking).

## Reading list (in order, before designing)

1. `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` — §3 Wave 3 scope, §4 migration protocol, **Addendum A.3** (calculation standard, W3 recompute), **Addendum B** (Sub-Entity Standard — the house rule for child tables), Addendum C (enum policy).
2. `docs/plans/jsonb-decomposition-deprecation-ledger.md` — the drop manifest (W1 + W2 frozen columns), the "bridges that die in W3" section, the W3 pre-registration section, and the **column-drop protocol** (ratified 2026-07-18; binds every drop).
3. `src/shared/entities/proposals/DOCS.md` — `#proposal-lock-ladder`, `#final-tcp-derived`, `#price-side-vs-cost-side`.
4. `docs/codebase-conventions/jsonb-columns.md` + `docs/adr/0005-*` — sub-entity decision tree, `_v` rule, zod-parse-at-write-boundary.
5. `src/trpc/DOCS.md` — Entity Server System rules (scope middleware, hooks).
6. Memory: `project-jsonb-strategy-research.md` (program history), `reference-jsonb-deprecation-ledger.md`, `reference-neon-branching.md` (worktree DB isolation), `feedback-runtime-db-env.md` (`DRIZZLE_TARGET=prod` is THE prod lever).

## Wave 3 scope (per epic #256)

- `proposal_sow_items` + `proposal_cost_lines` child tables (SOW decomposition — the biggest blob).
- RHF write-side diff refactor (form → row diffs instead of whole-blob writes).
- Read-path migration: UI / Zoho / PDF / aggregates flip from `getFullView` blob shapes to rows.
- Section incentives → `proposal_incentives(sow_item_id)` rows (`sow_item_id` column already exists, present-but-unused).
- Freeze gate extended to the new child tables (Addendum A.1.2).
- **Riding the W3 prod push** (per the ledger's drop protocol): all W1+W2 frozen-column drops · `signing_request_id` → `contract_envelope_id` rename · deletion of `scripts/backfill-wave1-columns.ts` / `scripts/backfill-wave2-children.ts` + their satellite legacy scripts.

## Load-bearing constraints & known state

1. **Double-count hazard (ledger, final-review finding):** the recompute SQL must add `sow_item_id IS NULL` to the existing global-discount subquery **the same moment** section-incentive rows land in `proposal_incentives` — inserting section rows before that predicate exists double-counts them against the still-present jsonb term.
2. **Recompute residues:** `recomputeProposalFinancials` (`entities/proposals/dal/server/mutations.ts:47-66`) still carries two documented jsonb terms (`startingTcp` base from `fundingJSON`, section incentives from `projectJSON`) — removing them IS the W3 seam. The SQL expression is hand-duplicated in `scripts/recompute-final-tcp.ts`; keep them in lockstep or delete the duplicate.
3. **`calc_version` is inert by design** (manual changelog stamp, never written programmatically). W3 changes the formula's *inputs* — bump it to 2 manually as part of the cutover and decide whether W3 builds any stamping machinery or keeps it manual.
4. **AI-summary escape hatch:** `src/shared/services/providers/ai/client.ts:105-115` raw-writes `projectJSON` and bypasses the chokepoint. Feature is PAUSED by Oliver's ruling — do NOT touch it; treat it as a known, acknowledged escape hatch when extending the freeze gate (it will not route through).
5. **`scripts/backfill-wave2-children.ts` is cutover-window-only** — never full-run it post-deploy (`--skip-proposals` for verification only). It dies with the W3 drops.
6. **Cutover ceremony:** spec §4 protocol (additive → parity backfill → Neon-branch rehearsal → prod cutover → freeze one release → drop). Cutover is human-executed from a runbook; hand Oliver paste-ready commands — prod-mutating commands are his to run. `pnpm db:push:dev` only; prod is explicit `db:push:prod` when he asks.
7. **`fundingJSON`/`projectJSON` fate:** ledger pre-registers both columns as frozen-at-W3-cutover, dropped the release AFTER (the one-release window applies to W3's own blobs too). `projectSectionSchema`/`fundingSectionSchema` may survive as form shapes only.

## Explicitly OUT of Wave 3 scope (rulings)

- **Unified proposal pricing editor (Tracks 1+2) — POST-WAVES (Oliver, 2026-07-24).** Rulings live in `docs/superpowers/specs/2026-07-24-unified-proposal-pricing-editor-design.md` (DEFERRED header); shelved plan at `docs/superpowers/plans/2026-07-24-...-track1.md` — **do not execute, do not fold into the W3 design.** It is epic #256's FINAL step, after the post-W3 drop/tally sweep, re-derived against the post-decomposition codebase. Where W3's decomposition inherently forces a decision the rulings cover (e.g. `fundingJSON` field fates like `startingTcp`/`miscPrice`, recompute source), the W3 design may *reference* the rulings — but no editor/UX work.
- **Meeting flow** — broken and unused by ruling; do not repair. If a W3 field deletion breaks its seeding (`build-proposal-defaults.ts` reads `startingTcp`), stub minimally, nothing more.
- **AI-summary path** — paused (see constraint 4).

## Coordination notes (non-blocking)

- **#194** (Proposal entity-server migration) is stale-open — the work merged in PR #207 (2026-05-19); residual punch-list: `docs/plans/entity-server-migration-punch-list.md`. Recommend Oliver skims + closes before W3 so it doesn't read as a sequencing conflict.
- **#279** — façade follow-ups (display polish + toolbar CASL guard), filed 2026-07-24, none block W3.
- `scripts/tmp-scan-r2-urls.ts` (untracked, read-only diagnostic) belongs to the R2 domain-swap epic (#160, prod backfill pending) — unrelated; leave it.
- Oliver's façade browser smoke (PDF + summary in both pricing modes, modal gating) was never formally confirmed — worth a 5-minute check before W3 rewrites those read paths, so regressions aren't blamed on W3.

## Paste-ready prompt for the new thread

> Start the **Wave 3 design session** for epic #256 — SOW normalization (`proposal_sow_items` + `proposal_cost_lines`, section incentives → `proposal_incentives(sow_item_id)`, read/write path migration, freeze-gate extension, and the frozen-column drops + `contract_envelope_id` rename riding its prod push). Read `docs/plans/2026-07-24-wave-3-design-handoff.md` FIRST and follow its reading list — it carries the readiness audit, scope, load-bearing constraints (double-count hazard, calc_version bump, AI escape hatch), and the out-of-scope rulings (unified pricing editor is POST-WAVES — do not fold it in). Use the brainstorming skill to drive the design, dispatch parallel research agents for current-state grounding, and end with a committed spec in `docs/superpowers/specs/` ready for writing-plans.
