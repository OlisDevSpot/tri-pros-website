# Wave 4 Design Session — Handoff (2026-07-26)

**For:** a fresh Claude session starting the Wave 4 (SOW normalization) design for epic
[#256](https://github.com/OlisDevSpot/tri-pros-website/issues/256).
**From:** the 2026-07-26 Wave-3 design session (which split the original W3 in two — Oliver's
ruling 2026-07-24 — and ran 6 research agents whose findings are distilled below; do NOT re-run
that research, spot-verify instead).
**Process:** DESIGN session — `superpowers:brainstorming` → spec (`docs/superpowers/specs/`) →
`superpowers:writing-plans` → subagent-driven execution.
**Precondition:** Wave 3 (scalar decomposition + drop ceremony,
`docs/superpowers/specs/2026-07-26-wave-3-scalar-decomposition-design.md`) has SHIPPED and its
cutover is verified. If it hasn't, stop — this handoff assumes its end-state.

## Wave 4 scope (per the renumbered epic #256 body)

- `proposal_sow_items` + `proposal_cost_lines` child tables (Sub-Entity Standard, Addendum B:
  1:many → own PK + FK + `position`; grandchild cascades through its parent).
- Write-side refactor: proposal form save → child-row writes (the program's one substantial
  refactor; write-model choice is OPEN — see question 1).
- `getFullView` assembles the SOW view-model from rows (W2/W3 hydration precedent — display
  consumers untouched); direct blob readers flipped (inventory below).
- Section incentives → `proposal_incentives(sow_item_id)` rows, with the `sow_item_id IS NULL`
  predicate added to the recompute's global-discount subquery **in the same deploy** (double-count
  guard — ledger W2-bridges row).
- Freeze gate (lock ladder) extended to the new child tables.
- `projectJSON` non-SOW scalars → columns (never explicitly assigned during the split — it is
  W4's, see question 5).
- Recompute → pure SUM over rows (residue #2 dies); `calc_version` → 2.
- `projectJSON` frozen at cutover; **W3's frozen `fundingJSONDeprecated`/`formMetaJSONDeprecated`
  columns + `scripts/backfill-wave3-scalars.ts` drop on THIS wave's push** (ledger rows).

## Post-W3 state you inherit (don't re-derive)

- `proposals` columns: `starting_tcp_cents`, `deposit_amount_cents`, `cash_in_deal_cents`,
  `misc_price_cents`, `price_display_mode` (text-enum, renamed per pricing-editor vocabulary),
  `envelope_document_ids text[]`, plus `final_tcp_cents`, `calc_version` (still 1),
  `contract_envelope_id` (renamed at the W3 ceremony — grep for stragglers, expect none).
- `getFullView` returns `funding: FundingData` (flat dollars view-model from columns + incentive
  rows); `fundingJSON`/`formMetaJSON` no longer exist on `ProposalWithCustomer`. The W2
  incentive-hydration bridge is GONE (absorbed). `scrubBlobIncentives` is deleted.
- Recompute (`recomputeProposalFinancials`) = `GREATEST(0, COALESCE(starting_tcp_cents,0) − SUM
  discount rows − <jsonb section-incentives term>)` — ONE residue left, duplicated in
  `scripts/recompute-final-tcp.ts` (keep-in-sync contract; update both in the same commit).
- All W1/W2 frozen columns + their scripts/schemas are GONE (W3 drop ceremony).
- Ledger `Waves 3 & 4` section = the authoritative kill-trigger register for everything above.

## Grounded current-state facts (from the 2026-07-24/26 research agents)

**The blob** (`projectJSON`, Zod in `entities/proposals/schemas/index.ts`):
`data` = `{ label, summary?, type, timeAllocated, validThroughTimeframe, energyBenefits?,
projectObjectives: string[], homeAreasUpgrades: homeArea[], agreementNotes?, sow: sowSchema[] }`.
`sowSchema` = `{ contentJSON (stringified Tiptap), html, scopes: {id,label}[], title,
trade: {id,label}, financials: { sectionPrice: number|null, costLines: CostLine[],
incentives: SectionIncentive[] } }`. `CostLine` = `{ id: uuid, label, amount, relatedScopeId,
notes? }` (relatedScopeId must match a selected scope — `proposalFormSchema.superRefine`).
`SectionIncentive` = `{ id: uuid, label, amount, notes? }` — **NO `type` field** (see question 3).
**SOW sections have NO ids in the blob** — positional only (see question 1).

**Writers of `projectJSON`**: edit/create `buildMutationData` (whole-document), pipelines
`create-proposal-popover.tsx` (empty section via `createEmptySowSection`), `snapSowFromMeeting`
(server create hook; untyped `Record<string,unknown>` casts, duplicated narrow MeetingFlowState
interface), `scripts/backfill-sow-financials.ts` (legacy one-off), and the PAUSED AI client
(`src/shared/services/providers/ai/client.ts:105-115` raw `db.update` merging
`{summary, energyBenefits}` — see question 5).

**Direct blob READERS that must flip** (everything else reads the `getFullView` assembled shape):
`projects.router/business.router.ts:~82` (untyped `sow[].scopes[].id` walk → `x_project_scopes`
linking — the ONLY projects↔proposal coupling), positional `->0->'trade'->>'label'` SQL in
`customer-pipelines/dal/server/get-customer-profile.ts:~93-95` (+ a `sowRaw` JS parse) and
`agent-dashboard/dal/server/get-action-queue.ts:~125`, Zoho leaks through the context object
(`registry.ts` `validThroughTimeframe` reads, `assemble-envelope.ts:~250` `buildEnvelopeName`
reading `sow[0].trade.label`/`scopes[0].label`), and verify scripts
(`verify-sow-pdf-structure.ts`, `dump-failed-sow.ts`). `sowToPlaintext` takes `SOW[]` — fine if
the view-model keeps shape. `contracts.service.ts` itself is fully insulated behind
`buildProposalContext`.

**Form structure** (`features/proposal-flow/ui/components/form/`): `useFieldArray` on
`project.data.sow` (project-fields.tsx), nested arrays `financials.costLines` +
`financials.incentives` (sow-financials-fields.tsx); Tiptap writes `contentJSON`+`html` via
setValue; scope removal cascades to orphan cost lines; duplicate-section regenerates
costLine/incentive UUIDs. ~12-14 form-shape files, ~10-12 display-shape files, cleanly separated.

**Freeze gate today**: whole-proposal field-scoped `update.before` gate on
`frozenProposalLockedFields` + per-mutation gates (`replaceProposalIncentives`, `setCashInDeal`,
`applyEnvelopeContext`) — all via `isProposalFrozen`/`getProposalLockState`
(`lib/proposal-lock.ts`, four tiers). Child tables are structurally OUTSIDE
`touchesFrozenLockedFields` → every new child mutation must carry the gate itself (or W4
centralizes it — design choice).

**Duplicate**: `duplicateProposalWithIncentives` (router-level override) copies GLOBAL incentive
rows + recomputes. W4 must extend it (same file — it sits above crud/mutations in the import
graph deliberately) to clone sow_items + cost_lines + section incentives with remapped FKs.

**No test harness** — safety net = `pnpm tsc`, `verify-financials-facade.ts`,
`verify-assemble-envelope.ts`, SOW/PDF verify scripts, Neon rehearsal, and the backfill parity
check. Proposal editing is the **highest-traffic sales tool** (program spec risk register :267).

## Open design questions (analyzed but NOT ruled — put to Oliver)

1. **Write model: replace-all vs keyed diff.** Blob sections have no ids; replace-all
   (delete+reinsert sow_items/cost_lines/section-incentive rows in one tx, W2
   `replaceProposalIncentives` precedent) is radically simpler but churns sow_item ids every save;
   keyed diff (server-minted ids round-tripped through RHF) preserves identity at the cost of the
   refactor growing substantially (ids through form defaults/converters/duplicate-section/
   snapSowFromMeeting + diff edge cases). Nothing external holds sow_item ids today except
   section-incentive rows (rewritten in the same save). The 2026-07-26 session leaned replace-all
   + documented promotion trigger; Oliver deferred the ruling — ASK FIRST, it shapes everything.
2. **sow_items column shape**: `trade_id`/`trade_label` prefixed columns (embedded value);
   `scopes` as a jsonb array on the row (identity-free snapshot, replaced whole — sanctioned per
   Addendum B, with a documented promotion trigger) vs a grandchild table; `content_json`/`html`
   text columns; `section_price_cents`; `position`. Note `relatedScopeId` cross-validation stays
   Zod-level (scopes are a snapshot, not an FK target) unless scopes get a table.
3. **Section-incentive row mapping**: blob shape has no `type`. Options: store as
   `type='discount'` (fits the existing CHECK: amount_cents NOT NULL; recompute's discount
   subquery then REQUIRES the `sow_item_id IS NULL` predicate — the double-count guard) vs mint a
   third type value `'section'`. Either way `label` becomes meaningful (notNull for section rows)
   and position is per-section. The same-deploy predicate constraint is non-negotiable (ledger).
4. **Cost-line exposure on the shareable path**: today cost lines ride the blob into the
   token-path `getFullView` payload (UI hides them; PDF never reads them). W4 is the moment to
   exclude them from the homeowner payload structurally — separate agent-gated fetch or
   CASL-gated inclusion. (`features/proposal-flow/DOCS.md` anti-leak rule; convention-audit R25.)
5. **`projectJSON` non-SOW scalars** → columns on `proposals` (label collision: proposal already
   has a `label` column — reconcile), `projectObjectives`/`homeAreasUpgrades` as `text[]` vs
   jsonb; **AI-client retarget**: the paused escape hatch writes `{summary, energyBenefits}` into
   the blob — when `projectJSON` freezes it breaks at tsc; minimal mechanical retarget to the new
   columns (still an escape hatch, still non-financial, still paused — "stub minimally, nothing
   more" per the standing meeting-flow-style ruling).
6. **getFullView SOW view-model**: same assembled-shape pattern as W3's `funding` (consumers
   untouched, tally marker for post-waves) — presumably uncontroversial after W3's precedent, but
   confirm; decide whether `sow[].financials` assembly includes cost lines (interacts with q4).
7. **`calc_version` → 2 + stamping**: rounding policy genuinely changes (per-item cents at write
   vs ROUND(SUM(dollars)*100)). Decide manual bump vs a `CURRENT_CALC_VERSION` const written by
   the recompute chokepoint (tiny machinery; the 2026-07-24 handoff left this open).
8. **Freeze-gate mechanics for children**: repeat the gate per child mutation (house precedent)
   vs centralize (e.g. a shared guard helper all proposal child mutations call). Also enumerate
   which new parent columns join `frozenProposalLockedFields`.
9. **Meeting flow**: broken/unused by ruling — do not repair; `snapSowFromMeeting` gets rewritten
   to insert rows (it's a create-hook enricher), `buildProposalDefaults` only touches form shape.

## Reading list (in order)

1. `docs/superpowers/specs/2026-07-26-wave-3-scalar-decomposition-design.md` — the state you build on.
2. `docs/superpowers/specs/2026-07-09-jsonb-decomposition-program-design.md` — §2 proposals verdicts,
   §4 protocol, Addendum A (esp. A.2 three-stage lifecycle, A.3 W3→W4 sequencing), Addendum B, C.
3. `docs/plans/jsonb-decomposition-deprecation-ledger.md` — "Waves 3 & 4" section + the W2-bridges
   rows that die here (recompute residue #2, `replaceProposalIncentives` dollars hop) + drop protocol.
4. `src/shared/entities/proposals/DOCS.md` — `#final-tcp-derived`, `#proposal-lock-ladder`,
   `#price-side-vs-cost-side`, `#duplicate-resets-and-redrives`.
5. `src/features/proposal-flow/DOCS.md` — view-mode gate, cost-line anti-leak, funding modes.
6. `docs/codebase-conventions/jsonb-columns.md` + `dal-conventions.md` (child-table DAL pattern) +
   ADR-0005.
7. Memory: `project-jsonb-strategy-research.md`, `reference-neon-branching.md`,
   `feedback-runtime-db-env.md`.

## Out of scope (standing rulings — do not fold in)

- **Unified pricing editor: POST-WAVES.** Epic's final step, re-derived post-decomposition.
  Reference its rulings only where W4 inherently forces a decision (e.g. q5 field fates).
- Meeting-flow repair; AI-summary feature work (q5's retarget is mechanical compile-keeping only).
- Row-native consumer reads beyond `getFullView` (pricing-editor era).
- Post-waves cleanup wave: `projectJSON` drop (release after W4), conventions sweep, tally sweep.
