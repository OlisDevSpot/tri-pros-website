# Unified Proposal Pricing Editor — Design

**Date:** 2026-07-24
**Status:** ⏸️ **DEFERRED — POST-WAVES (Oliver's ruling, 2026-07-24).** The business rulings below remain approved and canonical, but BOTH tracks are parked until the wave program completes (Wave 3 + the post-W3 frozen-column-drop / dead-code tally sweep). Do **NOT** fold this into the Wave 3 design and do **NOT** execute the shelved Track 1 plan (`docs/superpowers/plans/2026-07-24-unified-proposal-pricing-editor-track1.md`). After the waves, re-examine the rulings and re-derive the implementation against the post-decomposition codebase (sow rows, not blobs) — the bridge/prefill machinery in Track 1 exists only for a pre-W3 world and most of it becomes unnecessary. Where a ruling overlaps what W3's decomposition inherently decides (fundingJSON field fates, recompute source), the W3 design may *reference* the rulings, but the editor/UX work stays post-waves.
**Epic context:** JSONB decomposition program (#256), sequenced as the epic's final step, after the post-W3 drop/tally sweep. (Original framing — Track 1 as a pre-Wave-3 precursor — is superseded by this ruling.)

## Business rulings (canonical)

1. **There is only one way to price a proposal.** The final contract price (final TCP) is always derived from SOW sections: Σ `sectionPrice` − Σ section incentives − Σ global discounts (the façade's `computeFinalTcp`). It is never manually entered, anywhere.
2. **`miscPrice` is dead as a concept.** Miscellaneous work is just another SOW section, labeled by the agent. No specialized field.
3. **The breakdown toggle survives as a homeowner display preference only**: whether the homeowner sees per-section price lines or a single total. Zero effect on computation. (The current key `pricingMode` is renamed at Wave 3 — see Track 2.)
4. **Create and edit unify into one draft-first experience.** Creating a proposal creates a `draft` row immediately and lands in the editor. The separate create screen is eliminated.
5. **Out of scope by ruling:** meeting-flow Deal Structure (broken/unused — do not touch); `depositAmount` stays manual; `cashInDeal` unchanged (already derived/clamped).

## Why this is a two-track change

The math is already mode-agnostic (`computeFinalTcp` never branches on `pricingMode`). What's broken is the editing experience and the trust chain: in `total` mode the section-price inputs are disabled and `startingTcp` is hand-typed; the server rollup (`recomputeProposalFinancials`) trusts the blob's `startingTcp` rather than deriving from sections; the client-side sync (`funding-fields.tsx`) only runs in `breakdown` mode.

Per the convention audit (2026-07-23): schema deletion, recompute-SQL changes, and the data migration must ride Wave 3 — doing them now would mint a third jsonb residue in the exact SQL statement Wave 3 rewrites against `proposal_sow_items`, and would migrate `projectJSON.data.sow[]` data twice. Track 1 therefore touches **no schema, no SQL, no server recompute**.

---

## Track 1 — Precursor (ships now)

### T1.1 Section prices always editable and the sole price source

- `sectionPrice` input is enabled in every mode (`sow-financials-fields.tsx` — the "Disabled in total pricing mode" gate dies, including its tooltip).
- The section-price badge in `sow-collapsible-header.tsx` shows whenever `sectionPrice > 0`, regardless of mode.
- `getProposalAggregates` computes Σ sectionPrice unconditionally (drop the `pricingMode === 'breakdown'` gate).

### T1.2 Total Contract Price becomes read-only, always derived

- The `startingTcp` form input in `funding-fields.tsx` is replaced by a read-only computed display: `computeFinalTcp({ funding, sow })` from the façade, live via `useWatch` (RHF-derived state, never `useState`). Show the pre-incentive subtotal (Σ sectionPrice) and the final TCP.
- The existing sync effect runs **unconditionally** (all modes) and syncs `funding.data.startingTcp = Σ sectionPrice` (no `miscPrice` term). The blob field keeps being written so the untouched server recompute stays correct.
- **Registered bridge (ledger):** "form-derived `startingTcp` still persisted to blob" — kill trigger: Wave 3 (field deleted, recompute derives from sow rows).

### T1.3 `miscPrice` UI removal

- The "Misc Pricing" input and its contribution to the sync effect are removed from `funding-fields.tsx`.
- Display surfaces (React breakdown "Misc" row, PDF "Additional items" row, summary-route "Misc" line) keep rendering `PricingBreakdownModel.miscPrice` **for now** — old blobs still carry values and hiding them would silently understate what the homeowner was shown. The model field + renderers die at Wave 3 when the migration converts `miscPrice` into a "Miscellaneous" SOW section.
- **Tally entry:** miscPrice display-only rendering = dual-shape tolerance, kill trigger: Wave 3 migration.

### T1.4 Display toggle semantics

- The Settings-popover Switch ("Breakdown Pricing") is relabeled to make its meaning explicit (e.g., "Show per-section pricing to homeowner"). It writes `meta.pricingMode` exactly as today (key rename rides Wave 3).
- Renderer branches (React breakdown, PDF, summary route) are already display-only and survive unchanged.
- With draft-first unification (T1.6), the toggle is available from the first second of a proposal's life — the "edit-mode only" limitation dissolves with the create screen.

### T1.5 Validation changes

- `proposalFormSchema.superRefine`: "every section's `sectionPrice` must be a positive number" becomes **unconditional** (mode-independent).
- Strict validation gates only **Save & Preview / submit**. Incremental draft saves are lenient (see T1.6).

### T1.6 Draft-first create/edit unification

- **New-proposal flow:** the `/dashboard/proposals/new` route (and any "New proposal" entry point) creates a `draft` row via `crud.create` with minimal defaults (DB `status` already defaults to `'draft'`) and redirects to `/dashboard/proposals/[proposalId]`. `CreateNewProposalView` is deleted.
- The pipeline `CreateProposalPopover` keeps its quick-create but navigates to the editor on success.
- **Draft-save semantics (approved Nuance 1):** while `status === 'draft'`, saves are lenient — persist whatever exists; the computed TCP is simply Σ of the sections present (possibly 0). Full schema validation (T1.5) is enforced only on Save & Preview / any action that exposes the proposal to the homeowner.
- One toolbar, one settings popover; the create-only "Save & Preview" and edit-only toolbar merge into a single editor chrome keyed off draft/lock state.
- Lock-ladder interaction is unchanged: fresh drafts are `unlocked`; frozen proposals keep the existing "Discard draft to edit" banner path.

### T1.7 Interim behavior for legacy `startingTcp`-only proposals (approved Nuance 2)

- Opening a legacy proposal (sections exist but all `sectionPrice` null, `startingTcp > 0`) for edit pre-fills section prices with an **equal split** of `startingTcp` across sections (45,000 / 3 → 15,000 each), marked dirty so the agent reviews before saving. Same rule the Wave 3 migration uses — no surprise value changes.
- Same treatment for legacy `miscPrice > 0`: on edit open, prefill a new "Miscellaneous" SOW section with `sectionPrice = miscPrice` and zero the form's misc value, marked dirty. Without this, the T1.2 sync (which excludes misc) would silently drop the misc amount from the price on the next save. Mirrors the Wave 3 migration rule exactly.
- **Tally entry (Oliver's explicit ruling):** both prefill helpers (equal split + misc→section) are registered in the deprecation ledger with kill trigger = Wave 3 data migration; they are deleted in the same sweep. They must not survive as dead code.

### Not in Track 1

Server recompute changes, Zod field removals, blob rewrites, `pricingMode` rename, any data migration, meeting flow, `.superRefine` on drafts.

### Testing / verification

- `pnpm tsc` + `pnpm lint` (never build).
- `scripts/verify-financials-facade.ts` still passes (façade untouched in Track 1).
- Manual smoke: legacy total-mode proposal opens with equal-split prefill; new draft flow end-to-end; homeowner surfaces (React/PDF/summary) unchanged for both display modes; frozen-proposal banners intact.

---

## Track 2 — Wave 3 design inputs (recorded here so nothing is lost; final design in the W3 spec)

1. **Recompute from rows:** `recomputeProposalFinancials` derives final TCP from Σ `sectionPrice` over `proposal_sow_items` (+ `proposal_incentives`), not from blob `startingTcp`. The pre-registered `starting_tcp_cents` column may be obsolete — decide in W3 design.
2. **Field deletions:** `startingTcp` and `miscPrice` removed from `fundingDataSchema` + blobs (expand-and-contract; add `_v` per jsonb-columns rule when the schemas are touched).
3. **`calc_version` v2:** formula change → bump + full recompute; the version machinery (stamping + targeted rebuild) must actually be built — it is inert today.
4. **Rename:** `pricingMode` → `priceDisplayMode` (or similar); UL doc entry; one-canonical-key-per-concept.
5. **Data migration:** legacy `startingTcp`-only proposals → equal split across SOW sections; `pricingMode` forced to `'total'` so homeowners never see the synthetic split; **explicit migrated-flag** so internal UI can badge them for later true-up (no inference from suspiciously-even splits). `miscPrice > 0` blobs → converted to a "Miscellaneous" SOW section in the same pass. Locked/signed proposals: **skip + report** (envelope numbers are immutable legal snapshots); partition by `getProposalLockState`, never ad-hoc field checks.
6. **Bridge kills:** T1.2 form-derived-startingTcp bridge, T1.3 miscPrice display tolerance, T1.7 equal-split prefill — all die in the W3 sweep; ledger rows carry the triggers.
7. **Meeting-flow seeding** (`build-proposal-defaults.ts` startingTcp seed) breaks when the field dies — meeting flow is deferred by ruling, so W3 must at minimum stub/remove the seed without repairing the flow.

## Ledger obligations

On Track 1 merge, add rows to `docs/plans/jsonb-decomposition-deprecation-ledger.md`: (a) form-derived `startingTcp` bridge, (b) miscPrice display-only tolerance, (c) equal-split prefill helper — each with kill trigger = Wave 3. Track 2 items append to the ledger's W3 pre-registration section.
