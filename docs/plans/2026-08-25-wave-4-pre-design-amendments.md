# Wave 4 — Pre-Design Amendments (2026-08-25)

> **For:** the Wave 4 (SOW normalization) design session for epic #256.
> **Why this exists:** the program spec (2026-07-09) and the W4 handoff (2026-07-26)
> predate the backend refactor that landed on main in August (tRPC S1–S8,
> CRUD-DAL config-factory + tx threading + D-series adoption, projects
> standardization, CASL abilities). W3's prod cutover completed 2026-08-24/25.
> Four read-only investigators re-read the codebase at `22974394` against those
> docs. This file is the reconciled delta — **read it after the handoff, before
> brainstorming.** Full reports: session scratchpad `w4-*.md` (ephemeral); the
> load-bearing findings are reproduced here with file:line.
>
> Verdict: **W4's scope holds; its mechanics target a deleted architecture.**
> **See §R (2026-09-09 rulings) — it overrules A1/A2/B2/B3 details below.**
> Waves 1–3 artifacts are NOT legacy-shaped (child tables + business-DAL
> mutations are still what `dal-conventions.md` prescribes) — but three gaps
> they left would be inherited by W4 unless fixed first.

## A. Amend BEFORE W4 (small, de-risking; ship as a prep PR)

| # | Amendment | Evidence | Why first |
|---|---|---|---|
| A1 | **Make the recompute chokepoint tx-aware and version-stamping.** `recomputeProposalFinancials(proposalId)` hard-imports `db`, takes no `ctx`, cannot join a threaded tx; `calc_version` is `default(1)` and **never written anywhere** — the ledger's "calc_version → 2" has no mechanism. Add `CURRENT_CALC_VERSION` const, stamp it in the chokepoint AND `scripts/recompute-final-tcp.ts` (keep-in-sync pair), take `exec = ctx.tx ?? db`. | `src/shared/entities/proposals/dal/server/mutations.ts:36-38` (jsonb residue term), `scripts/recompute-final-tcp.ts:32-40` (duplicate SQL), `proposals/DOCS.md:175-183` (protocol with no code) | W4's "pure SUM over rows" replaces this statement; do the plumbing on the known formula, not the new one |
| A2 | **`replaceProposalIncentives` → `withTx` including the recompute.** Today: local `db.transaction` with the recompute OUTSIDE it; `ctx.tx` (sub-plan B) has **zero** business-DAL callers. | `proposal-incentives/dal/server/mutations.ts` (~:62), `src/shared/dal/server/lib/helpers.ts` withTx | It is the direct precedent W4's `replaceProposalSow` will copy — copy a correct one |
| A3 | **AI-summary escape hatch → `proposalCrud.update`.** It is LIVE (not "paused" as W3 docs say), reachable via `ai.router` → QStash job, bypasses lock/recompute/CRUD, and spreads `{summary, energyBenefits}` at `projectJSON` top level (bug). | `src/shared/services/providers/ai/client.ts:106-114` | Every `projectJSON` writer must be enumerated and CRUD-routed before its columns move |
| A4 | **Truth-pass the stale hook/path references** so the design session isn't misled: `proposals/DOCS.md:31,47,55,225,368` cite `lib/server-spec.ts:hooks.*` (moved to `dal/server/crud.ts`, D-a2); `DOCS.md:226` + ledger `:234` cite the old incentives path; `duplicate.ts:3-9`, `crud.router.ts:9` comments; `lead-sources/DOCS.md:86` still says CloudTalk; ledger `:216` / `DOCS.md:221` describe an AI `db.update` bypass that isn't at HEAD (the real one is A3); `subEntitySpec` is referenced in comments but does not exist. | as listed | Cheap; prevents re-deriving |
| A5 | **Move enum arrays to `constants/enums/`** per `enum-standardization.md`: `incentiveTypes` (proposals `schemas/`), `leadSourceKinds`. | `src/shared/entities/proposals/schemas/*`, `lead-sources/schemas.ts` | W4 mints more closed vocabularies (cost-line kinds, section trade fields); land them in the right home from day one |
| A6 | **Index + FK `proposal_incentives.sow_item_id`** — currently no FK, no index; CHECKs cover discount/offer only. Decide the FK now (it will point at `proposal_sow_items` — so this is W4's first DDL, but the decision belongs to the prep). | `src/shared/db/schema/proposal-incentives.ts` | Section-incentive migration depends on it |

## B. Amend the W4 spec/handoff itself (design-session inputs)

| # | Amendment | What the 2026-07 docs assumed → what holds now |
|---|---|---|
| B1 | **Retire spec §3's "cheap tier" rule and write Addendum D.** | Spec: "schema + relations() + DAL fns on parent + procedures on parent's router; NO new entity folders, CASL subjects, routers, server-specs" and `add-an-entity.md` still teach `createEntityRouter`/`spec.hooks`/`spec.duplicate` — **all deleted** (S7 `d348fd3d`, sub-plan D `43f7dec9`). Today a child entity = own `entities/<child>/` folder, `EntityServerSpec` with `parent: {spec, fk}` (no own `visibility`), own `createCrudDal` (config factory, hooks in config), child-scoped procedure in the parent's `procedures.ts`, leaf router, parent's `caslSubject` reused — reference `proposal-media-files`. **But**: `proposal_incentives` is the deliberate no-spec exception (plain DAL functions), and #285 Phase 6 plans no spec for it either. → Rule for W4: `proposal_sow_items`/`proposal_cost_lines` get **no spec / no CASL subject** — a single DAL abstraction with parent point-probe (CRUD-DAL §5.10), same as incentives. Record this as Addendum D so #285 has nothing to redo. |
| B2 | **The SOW save must be ONE DAL abstraction + ONE tRPC leaf.** Today the form fires 2 HTTP mutations (proposal update + incentives replace) non-atomically. W4: `replaceProposalSow(ctx, …)` owning `withTx` → `proposalCrud.update` (scalars) → sow-item/cost-line/incentive row replace → recompute, `dalVerifySuccess`-unwrapped; called AFTER (never inside a tx with) the hooked `proposalCrud.update` if hooks have side-effects — proposals' hooks are DB-only, so sub-plan C (`afterCommit`) is **not** a prerequisite; write that rationale down. | handoff q1/q2 assumed hooks on the spec + no tx helper |
| B3 | **q1 (replace-all vs keyed diff) has new inputs.** SOW sections have **no ids today** (form arrays are positional); #285 will thread `action`/field-CASL through child paths (per-row crud gets it free, replace-all doesn't); `ScopedContext` gains `actor` on #285 (merge surface). Recommendation to evaluate: replace-all for cost lines (value objects), keyed rows for sections (they'll carry media/incentive FKs). | handoff §104-115 |
| B4 | **q4 (token-path cost-line exclusion) is the only real #285 coupling.** Cost lines have NO homeowner-facing reader (only the agent Internal Financials modal), so structural exclusion is cheap: router-decided `getFullView({ includeCostLines })`, don't attach rows when `ctx.ability == null`; #285's `tokenActor` flips it in one line post-merge. Also confirm the pre-existing hole: `crud.update` on the shareable procedure skips CASL when `ability == null`. | `views.router.ts`, `shareable-middleware.ts` |
| B5 | **q6 read shape is already ruled** (W3 Amendment 2 / Option 3): rows hydrated on `getFullView`, JIT `toSowInputs()` helper mirroring `toFundingInputs`; `getFullView` does NOT return `funding` anymore (stale handoff fact). `listProposals` ships the full blob to the dashboard today → needs a `firstTrade`/`sowSummary` projection; the positional `->0->'trade'->>'label'` hacks live in `get-customer-profile.ts:99-101` and `get-action-queue.ts:126` (#285 Grill-B names them as financial-leak sites) → route both through one proposals DAL read. |
| B6 | **`snapSowFromMeeting` moves `create.before` → post-create row insert** (needs `row.id`); it is effectively dead on the UI path (form always sends sow) — decide keep/kill; duplicate path must clone section rows explicitly (`duplicateProposalWithIncentives` precedent) and skip the snapshot. |
| B7 | **Freeze gate:** `frozenProposalLockedFields` still lists `projectJSON` and `update.after` keys the recompute on `projectJSON` — both move to the new columns; gate is re-probed inline in 3 places (incentives replace, `setCashInDeal`, `applyEnvelopeContext`) → centralize once at the abstraction top or via config-factory hooks (the only sanctioned hook home). `project_JSON` is NOT NULL — the freeze step must relax it (W3 §3a-fix precedent). |
| B8 | **Column design facts:** trade/scopes are **Notion string ids** (never FK `trades.id`; precedent `x_project_scopes.scopeId` text) + `trade_label` snapshot; Tiptap is stored as BOTH `contentJSON` (canonical — PDF/Zoho/copy parse it) and `html` (homeowner page + AI summary) → both columns; money → `*_cents bigint` (dollars floats today); `data.label` already mirrored to `proposals.label`; `meta.enabled` has zero readers (drop). Indexes: `(proposal_id, position)`, `(trade_id)`, `cost_lines(sow_item_id)`, `incentives(proposal_id, sow_item_id)`. |
| B9 | **Cutover rules learned at W3** (walkthrough addendum): deploy-first ordering; **never approve a plan containing `truncate … cascade`** — pre-empty with DELETE after unhooking FKs; check the FK closure via `pg_constraint`; fresh Neon snapshot (plan = 1 slot, PITR 6 h); every prod push needs its own explicit go (roadmap Decision 1 superseded); run `db:push:prod` from a tree whose `src/shared/db/schema` is exactly the deployed commit. Opportunistic: pgEnum→text on `proposals` per enum-standardization. |
| B10 | **Consumers unchanged since 07-26**: Zoho/PDF SOW readers untouched (only `fb41da12`); analytics spec has no per-trade metrics yet — W4 should make per-trade revenue / section-price stats / cost-line margins cheap by design (B8 indexes). |

## R. Oliver's rulings (2026-09-09) — these overrule anything above that conflicts

1. **No transactions in the W4 save.** The tx approach was deferred in the CRUD
   refactor epic; `withTx()` exists as a helper if ever needed, but the SOW save
   is **sequential writes, no tx threading** — same naked+sequential stance as
   the CRUD engine. Consequences: A1 keeps ONLY its calc_version-stamping half
   (drop "tx-aware"); A2 is dropped (leave `replaceProposalIncentives` as-is);
   B2's `withTx` wrapper is out — the one-abstraction rule stands, its body is
   sequential.
2. **Hooks NEVER on the spec — anywhere, including docs.** The hook site is the
   `createCrudDal` config factory (`dal/server/crud.ts`); handlers consumed as
   `<entity>Crud.<handler>`. Living docs purged of `spec.hooks` 2026-09-09
   (add-an-entity Step 5, service-architecture, proposals/meetings DOCS.md,
   ADR-0002 amendment). Dated plans/specs keep their historical text.
3. **SOW save = ONE DAL abstraction + ONE tRPC leaf** — confirmed (B2 minus tx).
4. **Nothing permissions-related in W4.** No `actor`, no visibility work, no
   CASL changes — all of it is #285's (see the 2026-09-07 CASL re-grounding).
   B3's "#285 actor" consideration and B4's token-path CASL confirmation are
   design *inputs to be aware of*, not W4 work items; q4's exclusion mechanism
   should be the dumbest thing that works (`getFullView({ includeCostLines })`
   router-decided) and #285 rewires it later.
5. **Semantics are critical**: names for new functions/constants/tables get
   Oliver's sign-off before use. **Locked 2026-09-09:**
   - DAL abstraction: `replaceProposalSow` (mirrors `replaceProposalIncentives`)
   - tRPC leaf: `sow.replace` (small `sow` leaf router on proposals.router →
     client calls `proposals.sow.replace`)
   - JIT read helper: `toSowInputs` (mirrors `toFundingInputs`)
   - Version constant: `CURRENT_CALC_VERSION` (stamped by the recompute
     chokepoint; 1→2 on W4)
   - Tables stay per spec: `proposal_sow_items`, `proposal_cost_lines`.

## C. Sequencing (no blockers found)

JustCall is committed + pushed (`26c54190`, `22974394`; zero W4 overlap). #285 is 61 ahead / 35 behind main; it touches 10 proposal files W4 will also touch but every hunk is a one-liner (`requireResolvedScope`, scope-source swap) — mechanical merge only.

1. Prep PR (section A) on main, dev DDL only for A6.
2. W4 design session (brainstorm → spec → plan) with sections B as inputs; extend the handoff's 9 questions with B3/B4/B6.
3. W4 code on main, dev DDL. Whoever lands second (W4 vs #285 merge) does the textual merge; add W4's new DAL fns to #285's Phase-9 `requireResolvedScope` audit.
4. W4 prod push on its own explicit go, W3-style ceremony (walkthrough as template; B9 rules).
5. Downstream: roadmap ④ Financials Consolidation (drops `startingTcp`) and #285 Phase 7 — do NOT pre-empt in W4.

## D. Stale docs to fix in the W4 PR (not before)
`docs/how-to/add-an-entity.md` (teaches deleted factory), `docs/codebase-conventions/trpc-procedures.md#entity-procedures-from-factory`, `dal-conventions.md` (no child-bridge / tx rules yet), `src/trpc/DOCS.md` migration table, dead `#entity-router-via-factory` anchors, handoff `business.router.ts:~82` → `entities/projects/lib/derive-scope-ids.ts:6`, `SYSTEM_CONTEXT` → `systemContext(reason)` on #285. No ADR has been written since 2026-07-26 — the child/hook/tx models live only in `src/trpc/DOCS.md`, epic docs and code; consider an ADR for the child-entity standard (B1) as part of W4.

> **Update 2026-09-14 (stale-ref sweep, done early at owner request):** fixed — `trpc-procedures.md` factory section (now `#entity-procedures-defined-once`), dead `#entity-router-via-factory` anchors in the applications/customers/meetings/proposals routers, `src/trpc/DOCS.md` migration table + `createCrudRouter` signature. Still open for W4: `dal-conventions.md` child-bridge / tx rules, the `business.router.ts` handoff pointer, `SYSTEM_CONTEXT` on #285, the child-entity ADR.

## E. Leave alone
Users carve-out (no DOCS), inline `db.select` reads in `agent-settings`/`lead-sources` routers, `user.role` pgEnum, inline `ability.cannot` in child leaves (pending S5), W1–W3 declarations (conformant), `setVoipCampaignsPolicy` (owned by the VOIP epic).
