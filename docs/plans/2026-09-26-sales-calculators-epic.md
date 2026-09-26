# Sales Calculators: Epic Tracker

> **Status:** requirements approved 2026-09-26 ("looks ok for now"). D1–D8 and D10 are ruled. **The C0 spec is written** (`docs/superpowers/specs/2026-09-26-sales-calculators-c0-port-design.md`) and awaits owner review, then writing-plans. Nothing is built yet.
> **This file is the live index.** It holds decisions, requirements, success metrics, the register of interim choices, and phase status. Update it as decisions land and items ship. IDs are stable; cite them in specs, plans and commits.
> **Goal in one line:** port remodel-x's per-scope pricing formulas and its "now vs future" savings idea into tri-pros as homeowner-facing sales calculators, built so the pricing engine can later become the way a proposal's SOW sections get their price.
> **Source:** the `olissolutions.com` monorepo at `/home/olis-solutions/olis-v3/monorepo/turborepos-repos/olissolutions.com`, whose newest commit is `bd6ddbc` (2025-11-29). Its working tree has uncommitted edits, including a broken scope form. Port from the committed logic described in §6 and §7, not from that working tree.
> **Baseline:** `main` at `b6396b0f`.

**Adjacent work, owned elsewhere (do not duplicate):**
- **Proposal single pricing mode:** `docs/plans/2026-09-26-proposal-single-pricing-mode-follow-up.md`. Section prices become the only source of a proposal's price, and the rep controls a display-only flag. This amends Wave 4 and gates **C4**.
- **Wave 4 SOW normalization:** `docs/superpowers/specs/2026-09-24-wave-4-sow-normalization-design.md`. §3.6 G8 already reserves "per-item variable values (`variables_json` or child rows), template provenance, materials per scope". C4 fills that reservation, and W4 does not add it.
- **Construction data standardization:** `docs/plans/2026-09-15-construction-data-standardization-epic.md`. P2 gave trades a stored `Slug`, a generated `TradeSlug` type, and a `pricingUnits` enum (A5). C1 extends the same pattern to scopes. P5 (#195) moves the catalog to Postgres, including the seeded-only `variables` / `x_scope_variables` tables.
- **Multi-proposal meeting flow:** `docs/plans/2026-09-20-multi-proposal-meeting-flow-epic.md`. That epic owns the meeting steps, and C3 hooks into them.

Legend: `[ ]` open · `[x]` done · `[~]` in progress · ⚠️ blocked on a §2 decision.

---

## 0. Epic structure

Each phase gets its own spec, then plan, then build. A phase closes when every requirement ID it owns is `[x]`.

| Phase | Scope | Owns | Blocked by | Spec | Status |
|---|---|---|---|---|---|
| **C0** | **Port.** Build both calculators in a new, temporary `src/features/calculators/`, standalone at `/dashboard/calculators`, homeowner-facing, with nothing persisted. Remodel-x logic ports faithfully; only the defects §6 marks as fixed are fixed. Every interim choice carries a why-comment and an I-row. | O1–O8 · SP* · PR* · UI* · V* · CF1–CF5 · I1–I10 | — | [spec](../superpowers/specs/2026-09-26-sales-calculators-c0-port-design.md), written 2026-09-26, owner review pending | [ ] |
| **C1** | **Scope identity.** A stored `Slug` on Notion scopes and a generated `ScopeSlug` type. The mapping from remodel-x pricing keys to Notion scopes is confirmed by the owner row by row. Formulas are keyed by `ScopeSlug`. | K1–K4 | C0; construction P2 plan 1 (the trade `Slug` pattern) | not written | [ ] |
| **C2** | **Permanent engine home and pricing configuration.** The engines move out of the feature. Admin-configured values move from code to `app_settings` plus an admin UI (R9). | E1–E3 · CF6 | C1, D9 | not written | [ ] |
| **C3** | **Customer- and proposal-specific calculators.** Inputs prefill from the customer (`customer_profiles`: roof type, HVAC type, windows, insulation, year built), and results are kept against a meeting or proposal. | S1–S3 | C2 | not written | [ ] |
| **C4** | **Proposal pricing.** A SOW item stores its Variable values (W4 G8), and its `section_price_cents` comes from the scope's formula. Manual price remains the fallback. | P1–P4 | the single-pricing-mode follow-up; the W4 build; C1; C2 | not written | [ ] |

**Order:** C0 → C1 → C2 → C3 / C4. C3 and C4 may run in either order once C2 lands. `pnpm tsc` and `pnpm lint` gate every phase (V1).

---

## 1. Decided (owner)

| ID | Decision | Date |
|---|---|---|
| **R1** | **Homeowner-facing.** The rep turns the tablet around, so the default screen shows **Price** only. Cost, multiplier, margin and unit costs are never visible to the homeowner. | 2026-09-25 |
| **R2** | **Standalone first.** `/dashboard/calculators`, with nothing saved. This must later become customer- and proposal-specific (C3). | 2026-09-25 |
| **R3** | **Price = Cost × Multiplier, plus an agent-only live control.** The rep can adjust the multiplier in the moment, for example to hit a target price. "The more functionality the agent can have the better." | 2026-09-25 |
| **R4** | **Tax is part of the calculation.** The rule itself is D2. | 2026-09-25 |
| **R5** | **The formulas are meant to become the proposal's pricing engine** (C4). They combine the useful structure from remodel-x with what tri-pros already has (proposal financials, SOW sections). | 2026-09-25 |
| **R6** | **Reconcile the two catalogs.** Remodel-x keys formulas by Neon scope accessors, while the tri-pros runtime catalog is Notion (C1). | 2026-09-25 |
| **R7** | **Decomposition:** this epic covers the engines and the calculators (C0–C3). Proposal integration (C4) is its own spec, and it amends Wave 4. | 2026-09-25 |
| **R8** | **Port first, and mark what is not final.** Porting is the key deliverable. When the port knowingly keeps a non-final approach, the code says so in a why-comment (house rule: no plan or spec citations in code), and §5 records it. | 2026-09-26 |
| **R9** | **Four configuration tiers.** Every calculator value belongs to exactly one tier. Refer to the tiers by these names in specs, plans, code and conversation. §3.6 places each value and holds the requirements. **On-screen:** the rep edits it live, and the homeowner sees it. **Agent-only:** the rep edits or reads it live, inside the agent panel. **Admin-configured:** a super-admin sets it occasionally in an admin UI. **System default:** it lives in code and changes only through a deploy. Values resolve as *System default → overridden by Admin-configured → overridden by On-screen / Agent-only for the session*, which follows the house "defaults with override" reflex. Owner confirmations: the multiplier has an Admin-configured **floor** the rep cannot go below. Tax rate is Admin-configured and not editable by the rep. Savings assumptions are On-screen. The rep sees Unit Costs read-only in the agent panel. | 2026-09-26 |
| **D1** | **Names.** "Snapshot" is a reserved house term: a fact frozen at an event and never recomputed (`docs/ubiquitous-language.md:254,283`). Proposed new terms: **Savings Projection** (the now-vs-future calculator), **Scope Pricing** (the per-scope calculator), **Formula** (per-scope code that turns Variables into Cost), **Unit Cost** (a Cost constant such as $/BSQ). Existing terms are reused as they are: Scope, Trade, Variable, Cost, Price, Multiplier, TCP. **Ruled:** Accept all four. | 2026-09-26 |
| **D2** | **Tax rule.** Remodel-x keeps the tax inside the price: `tax = round(price × 7.5%)`, and it shows "Base" as `price − tax`. Alternatives: tax added on top of the price, or tax computed on the materials portion of Cost only. The rate is also open: 7.5% in the source, while California's base rate plus local district rates vary by city. **Ruled:** **Port the source rule (tax inside the price, 7.5%) as interim I5** and show the tax as a breakdown line only in the agent panel. Confirm the rule with your accountant before C4. | 2026-09-26 |
| **D3** | **Multiplier default.** One global default (source ×2.8, which is "healthy" under `getMultiplierTier`) or one default per trade? **Ruled:** **One global default of 2.8** that the rep can override live (R3), bounded by the Admin-configured floor (R9, CF4). Per-trade defaults wait for C2. | 2026-09-26 |
| **D4** | **Savings default rates.** The source defaults have no citation: electric 9.4, water 10.3, gas 13.1, home appreciation 4, gardening 5 (%/yr), with a 5-year horizon. The education pages in the same source say 13.2–14.2% for electric and cite CPUC rate-change alerts. **Ruled:** **Port the defaults verbatim as interim I4.** Every rate stays visible and editable on screen (SP-O4). The owner supplies sourced defaults before C3. | 2026-09-26 |
| **D5** | **Roof types beyond shingle and tile.** The tear-off formula prices anything that isn't `shingle` at the tile rate ($750/BSQ), so metal, flat and woodshake are mispriced. **Ruled:** **Limit the tear-off roof-type Variable to `shingle` or `tile`** until the owner supplies rates for the other types (interim I9). | 2026-09-26 |
| **D6** | **Unused or conflicting constants.** `mainPanelTrade` ($2,800) is seeded but the formula hardcodes $3,200 or $4,000. `permitFee_roof` and `permitFee_hvac` ($250 each) are seeded but never added. **Ruled:** **Port what the formulas actually do:** MPU at $3,200 / $4,000 as named Unit Costs, and drop `mainPanelTrade`. Carry the permit fees as named constants that are off until the owner says to add them. | 2026-09-26 |
| **D7** | **Liabilities over the horizon.** The source records balance and payment but no interest rate, so it cannot pay debt down over time. **Ruled:** **Add an optional APR per liability.** With an APR, amortize. Without one, carry the balance unchanged and label the projection that way (interim I7). | 2026-09-26 |
| **D8** | **How the after-upgrade bills are entered.** The source schema had `afterPayment` per category (never wired up). The alternative is a percentage reduction per upgrade. **Ruled:** **Manual after-bill per category** (the source shape). Percentage reductions per upgrade wait for C2/C3, because they need sourced reduction data. | 2026-09-26 |
| **D10** | **Unit Cost refresh.** The costs date from Nov 2025. **Ruled:** the §7.2 values ship in C0 exactly as ported. The owner re-checks them before C2 makes them Admin-configured. | 2026-09-26 |

## 2. Open decisions

"Needed by" marks what each decision blocks. D1–D8 and D10 were ruled on 2026-09-26 and now sit in §1 (the owner accepted the recommendations "for now").

| ID | Question | Needed by | Recommendation |
|---|---|---|---|
| **D9** | **Permanent engine home.** Options: `modules/construction/pricing/`, a new `modules/pricing/`, or `modules/proposals`. The savings engine may belong elsewhere. | C2 | Decide at C2, once C1 has settled scope identity. |

---

## 3. Requirements

### 3.1 Owner constraints (from §1)

- [ ] **O1** The homeowner-visible render shows no Cost, Unit Cost, multiplier, margin or formula internals (R1).
- [ ] **O2** An agent-only panel is **closed by default** and opens from an unobtrusive control. It holds the Agent-only tier (§3.6): Cost, Multiplier, Margin, multiplier tier (via `formatMultiplier` / `getMultiplierTier` in `src/shared/modules/proposals/core/lib/financials/tiers.ts`, reused, not copied) and tax, Unit Costs read-only, and the live multiplier control and target price, bounded by the floor (R3, CF4).
- [ ] **O3** Tax is included per D2 (R4).
- [ ] **O4** Nothing is persisted in C0: no DB, no tRPC mutation, no localStorage. Form values live in memory (R2).
- [ ] **O5** Both engines are pure TypeScript with no React, tRPC, DB or `next/*` imports, so they can run on the server or the client. This keeps C2–C4 a move, not a rewrite (R5).
- [ ] **O6** Every interim choice has a why-comment at the code site and an I-row in §5 (R8).
- [ ] **O7** House vocabulary per D1. UI copy distinguishes Price from Cost (`docs/ubiquitous-language.md:263`).
- [ ] **O8** No uncited marketing claims appear in homeowner copy (for example the source's "30–50% bill reduction", "5–15% value increase", "$1.20–$1.50 per $1"). A number shown to the homeowner is either a visible, editable assumption or computed from the inputs.

### 3.2 Savings Projection (SP)

**Inputs.** Rows marked *port* come from `project-roi-calculator/schemas/index.ts`. Rows marked *new* fill gaps the source left.
- [ ] **SP-I1** *port* Current home value (USD).
- [ ] **SP-I2** *port* Liabilities list: label, balance, monthly payment. *new:* optional APR (D7).
- [ ] **SP-I3** *port* Monthly utilities now: electric, gas, water.
- [ ] **SP-I4** *port* Monthly maintenance now: gardening, misc.
- [ ] **SP-I5** *port + fix* Monthly utilities and maintenance **after** the upgrade, as separate fields (D8). The source bound every card to the current bills (B-S1).
- [ ] **SP-I6** *port + fix* Assumptions, as annual percentages: home appreciation, and escalation for electric, gas, water and gardening. Also the horizon in years, **which gets an input** (the source had none, B-S4). Defaults per D4. Every assumption is visible and editable.
- [ ] **SP-I7** *new* The project: project price, incentives, down payment. *port:* APR and term in months (the source's never-wired `financialOption`).
- [ ] **SP-I8** *new* Home-value uplift from the upgrade, entered by the rep in $ or %, default **0**. It is never hardcoded (O8).

**Math.** Pure functions in the engine. Rates are stored as whole percents and converted with `/100` in one place (B-S7).
- [ ] **SP-M1** *port* Appreciation: `V × (1 + a)^t`, the source's `calcAppreciation`, which is correct.
- [ ] **SP-M2** Bill in year t per category: `bill₀ × (1 + g)^t`.
- [ ] **SP-M3** Cumulative cost over N years per category: `12 × bill₀ × ((1+g)^N − 1) / g`, or `12 × bill₀ × N` when g = 0.
- [ ] **SP-M4** Project loan payment via `amortizedMonthlyPayment(principal, aprPercent, months)` (`src/shared/lib/loan-calculations.ts`, the single app-wide implementation), where principal = price − incentives − down payment.
- [ ] **SP-M5** Remaining balance after k months, for liabilities with an APR and for the project loan: the standard amortization identity. Without an APR, per D7.
- [ ] **SP-M6** Net worth at t = home value − remaining liabilities − remaining project loan, computed before and after the upgrade.
- [ ] **SP-M7** Monthly cash flow now: before vs after (bills plus loan payments).
- [ ] **SP-M8** Cumulative savings over N years, break-even year (or "none within horizon"), and net benefit.
- [ ] **SP-M9** No NaN, Infinity or undefined for any valid input. Empty inputs are treated as absent, never as `""` (B-S6).

**Outputs**
- [ ] **SP-O1** *port* The source's 2×2 layout: now/before, now/after, in N years/before, in N years/after. Cards show computed values and never rebind inputs (B-S2, B-S3).
- [ ] **SP-O2** Summary: monthly difference now, cumulative savings, value gained, break-even, net benefit.
- [ ] **SP-O3** A chart of cumulative cost before vs after by year, using recharts 2.15.4 (already a dependency; precedent `src/features/lead-sources-admin/ui/components/lead-source-trend-chart.tsx`).
- [ ] **SP-O4** Assumptions are shown on the homeowner screen, because the homeowner should see what the projection rests on.

### 3.3 Scope Pricing (PR)

**Model.** This ports remodel-x's split into three parts: what the rep measures, what the contractor configures, and code.
- [ ] **PR1** **Variables** are the inputs a rep measures. Each has a key, label, type (`number | select | boolean`), unit (sqft, BSQ, count, tons, W, kWh), options for selects, min/max, and a default. A Zod schema is derived from them. They are defined `as const`, and types derive from the definitions (the source's best idea, kept).
- [ ] **PR2** **Unit Costs** are named Cost constants per trade, with values ported verbatim (§7.2, D10). Literals the source hid inside formulas become named Unit Costs: $800 per extra HVAC ton, MPU $3,200 / $4,000 (D6).
- [ ] **PR3** **Formulas** are one pure function per pricing scope, `(variables, context, unitCosts) → Cost`. They port verbatim for the 24 scopes in §7.1.
- [ ] **PR4** *fix* **Each Formula declares the Variables it reads.** That declaration is the single source for both the form and the formula's argument type. This fixes B-P3 through B-P5 at the root: in the source, formula inputs came from the trade while the form came from a separate link table, and the two drifted.
- [ ] **PR5** *port* Compile-time exhaustiveness: every pricing key has exactly one Formula (the source's `build<Record<ScopeAccessorOfTrade, …>>`). In C0 the key is the remodel-x accessor (I2). In C1 it becomes `ScopeSlug`.
- [ ] **PR6** *port + fix* **Project context** is number of stories and current roof type, entered by the rep in C0 (the source read them from the job site). The tear-off roof type follows D5.
- [ ] **PR7** *fix* Inputs that don't affect price are **not** collected in C0: `desiredRoofType`, `percentFreeDeckReplacement`, `inverterType`, and `systemTonnage` for mini-splits. They are recorded for C4, where they may matter to the SOW text (I10).
- [ ] **PR8** Price math: `price = round(cost × multiplier)`, with the multiplier defaulting per D3 and adjusted live by the rep. Tax per D2.
- [ ] **PR9** A **quote with several lines**: the rep adds several scopes, including the same scope twice, and sees each line's Price plus the total Price and tax.
- [ ] **PR10** A **manual price line** for any scope without a Formula (the source crashed, B-P2). It covers the source's stubs (§7.1, not ported) and every Notion scope in C1+.
- [ ] **PR11** **Target price:** the rep enters a target total and the engine solves for the multiplier (R3), showing the resulting tier in the agent panel.
- [ ] **PR12** No NaN, negative or undefined for any valid input. Checked exhaustively over select options and boundary numbers (V3).

### 3.4 UI

- [ ] **UI1** Thin page at `src/app/(frontend)/dashboard/calculators/page.tsx`: `protectDashboardPage()` and then the feature view (template `dashboard/analytics/page.tsx`). Add `APP_ROOTS.dashboard.calculators` in `src/shared/config/roots.ts`, plus a sidebar entry in `src/features/agent-dashboard/lib/get-sidebar-nav.ts`, gated on `access Dashboard`.
- [ ] **UI2** Two calculators on one page as tabs. The active tab (`scope-pricing` / `savings-projection`) lives in the URL via nuqs, with the parser in `features/calculators/constants/query-parsers.ts`. Each calculator is its own sub-feature, `features/calculators/{scope-pricing-calculator,savings-projection-calculator}/`, and they never import from each other (owner, 2026-09-26). The two are fully independent in C0: no handoff between them. Values stay out of the URL, so the multiplier never appears there.
- [ ] **UI3** Tablet-first and good enough to show a homeowner. Follow the house UI order (flow first, then ui-ux-pro-max, then web-design-guidelines, then impeccable). Use `/ui-warmup` if the layout direction is open when the C0 spec is written.
- [ ] **UI4** Numeric inputs use `src/shared/components/ui/number-field.tsx` (null-clear contract). Never use `convertToNumber` for currency: the tri-pros copy in `src/shared/lib/formatters.ts:100` has the same bug as the source and drops the decimal point, so "$250.50" becomes 25050 (B-S5).
- [ ] **UI5** *port* Scope Pricing fields render from each Formula's Variable declaration, one generic field per type (the source's `DynamicField` idea).
- [ ] **UI6** react-hook-form with `zodResolver`. Computed values are derived (`useWatch` / `useMemo`) and never written back into form fields (B-S2).
- [ ] **UI7** Every non-submit button inside a form has `type="button"` (B-S8).

### 3.5 Conventions and verification (V)

- [ ] **V1** `pnpm tsc` and `pnpm lint` pass. Never `pnpm build`.
- [ ] **V2** `scripts/verify-scope-pricing.ts` (`node:assert/strict`, run with `npx tsx`, following the `scripts/verify-*.ts` pattern) holds golden values reproduced from the source: for example, 20 panels × 400 W × $3.50/W gives Cost $28,000, then ×2.8 gives Price $78,400, and 7.5% inside that gives tax $5,880. It covers one case per ported formula, plus the §6 fixes.
- [ ] **V3** The same script checks exhaustively over every select option and boundary number that no output is NaN, negative or undefined.
- [ ] **V4** `scripts/verify-savings-projection.ts` holds golden values: $1,000,000 at 4% for 5 years gives $1,216,653. It also covers escalation at g = 0 and g > 0, parity with `amortizedMonthlyPayment`, remaining balance at k = 0 and k = n, and break-even.
- [ ] **V5** Folder layout follows `features/proposal-flow` and `features/meeting-flow`: `constants/ · lib/ · schemas/ · hooks/ · types/ · ui/components/ · ui/views/`. One component per file, named exports, `lib/` pure, `schemas/` a sibling of `lib/`, hooks only in `hooks/`, and no module-level constants inside components (`memory/coding-conventions.md`).
- [ ] **V6** A Playwright check (auth via `/api/dev/playwright-session`) that the default render of each calculator contains none of: Cost, Multiplier, Margin, or any Unit Cost figure.

### 3.6 Configuration tiers (R9)

**Placement.** Each value belongs to exactly one tier. "Default from X" means the value starts from X and the named tier can override it for the session.

| Value | Tier | Notes |
|---|---|---|
| Measurements (BSQ, panels, tonnage, window counts, sqft…) and choices (paint type, battery size) | **On-screen** | |
| Project context (stories, current roof type) | **On-screen** | Prefilled from the customer in C3 (I6) |
| Bills now and after, home value, liabilities, project price, incentives, down payment, APR, term | **On-screen** | |
| Savings assumptions (escalation %, appreciation %, horizon) | **On-screen**, default from **Admin-configured** | Visible on purpose (SP-O4) |
| Home-value uplift | **On-screen**, default 0 as a **System default** | Never a built-in promise (O8) |
| Manual price line (scope without a Formula) | **On-screen**: the rep types the **Price** | No Cost, so the agent panel flags "no cost data" and leaves the line out of margin, matching the proposals Margin rule in `docs/ubiquitous-language.md:99` |
| Multiplier override and target price | **Agent-only** | Bounded below by the multiplier floor |
| Cost, margin and multiplier-tier readouts; Unit Costs (read-only) | **Agent-only** | |
| Unit Costs, including the per-ton HVAC step and MPU prices | **Admin-configured** | Seeded from §7.2 |
| Default multiplier and **multiplier floor** | **Admin-configured** | Default 2.8 (D3). The floor defaults to 2.0, the existing "danger" boundary |
| Tax rate | **Admin-configured** | Not editable by the rep. The rule's mechanics are a System default (D2) |
| Exterior-paint size thresholds (1,500 / 3,000 sqft) | **Admin-configured** | Pricing tiers, not formula structure |
| Permit fees and whether each is on | **Admin-configured** | Off by default (D6) |
| Default savings rates and horizon | **Admin-configured** | Seeded from D4 |
| Formulas; Variable definitions (types, units, options, bounds); allowed roof types; rounding; how tax is applied; BSQ = 100 sqft | **System default** | |
| Multiplier tier thresholds (under 2.0 danger, 3.0 and up excellent) | **System default** | Already in `tiers.ts`; reused, not a second copy |

**Requirements**
- [ ] **CF1** Every configurable value is declared in **one typed config schema per calculator** (Zod) together with its System default (amended 2026-09-26: each calculator is its own sub-feature). Admin-configured values are validated by that schema. A value with no tier assignment is a spec error.
- [ ] **CF2** The engines receive **resolved config as a plain argument** and never read storage. In C0, each calculator's one resolver returns its System defaults (I3). In C2, only those resolvers change, each reading its own `app_settings` row.
- [ ] **CF3** Session overrides (On-screen, Agent-only) live in form state and are never persisted in C0 (O4).
- [ ] **CF4** The rep cannot set a multiplier below the floor, whether directly or through target price (PR11). A target that would require going below the floor shows the floor price and says the target cannot be reached.
- [ ] **CF5** Agent-only values render only inside the agent panel (O1, O2, V6).
- [ ] **CF6** *(C2)* An admin UI edits the Admin-configured values, visible to super-admins only. Before that, `app_settings` needs an agent-safe read path: today it has no router or UI, and its visibility is `FALSE` for everyone except super-admin (`src/shared/entities/app-settings/lib/visibility.ts`).

### 3.7 Later phases (placeholders, refined at their spec)

- **K1–K4 (C1):** K1 a stored `Slug` on Notion scopes, backfilled, then required. K2 a generated `ScopeSlug` type. K3 the owner-confirmed map from remodel-x key to Notion scope (1 → 1..N). K4 Formulas keyed as `Partial<Record<ScopeSlug, Formula>>`, where a missing entry means a manual price.
- **E1–E3 (C2):** E1 the engine's permanent home (D9). E2 the Admin-configured storage shape in `app_settings` and its admin UI (settled by R9; C2 designs the mechanics, see CF6). E3 the home for Variables (the seeded-only `variables` / `x_scope_variables` tables in `src/shared/db/schema/` versus code), decided together with construction P5.
- **S1–S3 (C3):** S1 prefill from `customer_profiles`. S2 results persisted against a meeting or proposal. S3 an entry point from the meeting flow (a step, an inspector panel, or inside deal-structure; slots are listed in the 2026-09-25 research).
- **P1–P4 (C4):** P1 SOW item Variable values (W4 G8). P2 `section_price_cents` taken from the formula, with a manual override. P3 the proposal-side Cost lines taken from formula Cost, so the proposal's multiplier KPI and the calculator agree. P4 the single pricing mode (follow-up doc).

---

## 4. Success metrics

| ID | Metric | Target | How measured |
|---|---|---|---|
| **M1** | Faithful port | 100% of the 24 ported formulas reproduce the source's Cost for the golden inputs, except the documented §6 fixes | V2 |
| **M2** | Robust math | 0 NaN, negative or undefined outputs across the exhaustive input sweep | V3, V4 |
| **M3** | No homeowner leak | 0 Cost, multiplier, margin or Unit Cost strings in either calculator's default render | V6 |
| **M4** | Rep speed | A rep prices a roof tear-off + solar + windows quote in **under 2 minutes** on a tablet, including one multiplier adjustment | owner-run smoke |
| **M5** | Transparency | Every Savings Projection output traces to inputs and assumptions visible on screen | spec review and smoke |
| **M6** | Interim debt visible | Every interim choice has a code why-comment and an I-row. Each phase closes its own I-rows | §5 audit per phase |
| **M7** | Clean gates | `pnpm tsc` and `pnpm lint` green on every C0 commit | V1 |
| **M8** (C1) | Catalog coverage | 100% of ported Formulas map to live Notion scopes | K3 map, verify script |
| **M9** (C4) | One price path | Formula Price equals the proposal section price for every formula-priced section | C4 parity script |

---

## 5. Interim register (what C0 knowingly does that is not final)

Each row has a why-comment at its code site. The comment gives the reason, never a citation (house rule).

| ID | Interim choice in C0 | Final shape | Closes in |
|---|---|---|---|
| **I1** | Engines live in `src/features/calculators/{scope-pricing-calculator,savings-projection-calculator}/lib/` | A module home (D9) | C2 |
| **I2** | Pricing keys are the remodel-x accessors (`tearOff`, `installPanels`, …) | `ScopeSlug` from the Notion catalog | C1 |
| **I3** | Admin-configured values (Unit Costs, multiplier default and floor, tax rate, paint thresholds, permit fees, default savings rates) are served from System defaults by the one config resolver | The resolver reads `app_settings`, and an admin UI edits the values (CF2, CF6) | C2 |
| **I4** | Savings default rates are the unsourced source values | Sourced defaults (D4) | C2/C3 |
| **I5** | Tax is inside the price at 7.5% | The rule confirmed in D2 | C2 |
| **I6** | Project context (stories, roof type) is entered by the rep | Prefilled from the customer | C3 |
| **I7** | Liabilities without an APR are held flat across the horizon | Owner-confirmed treatment (D7) | C3 |
| **I8** | Nothing is persisted | Kept against a meeting or proposal | C3 |
| **I9** | The tear-off roof type is limited to shingle or tile | Rates for every roof type (D5) | C2 |
| **I10** | SOW-only inputs (desired roof type, free deck %, inverter type) are not collected | Collected as SOW Variables | C4 |

---

## 6. Source defects: not ported, and fixed where the port touches them

**Savings (`project-roi-calculator`):**
- **B-S1:** Every card bound to `currentPayment.*`, so after-bills could not be entered. Fixed by SP-I5.
- **B-S2:** The projected home-value input overwrote the base value. Fixed by SP-O1 and UI6.
- **B-S3:** The projection cards re-edited today's loans through a second `useFieldArray` on the same path. Fixed by SP-O1.
- **B-S4:** `years` had no input, and the card titles used a non-reactive `getValues`. Fixed by SP-I6.
- **B-S5:** Currency parsing dropped the cents. Fixed by UI4.
- **B-S6:** The schema was never enforced, and cleared inputs wrote `null` against `.optional()`. Fixed by UI6 and SP-M9.
- **B-S7:** Units were ambiguous: payments not labelled as monthly, and rates not labelled as annual %. Fixed by SP-I* labels and SP-M.
- **B-S8:** The Save and Settings buttons submitted the form. Fixed by UI7.
- **B-S9:** Submit only called `alert`. Not ported.

**Pricing (`project-creator`):**
- **B-P1:** Empty-string defaults reached the math. An unselected tonnage priced at $6,100, an unselected layer count went negative, and a missing paint type gave NaN. Fixed by PR1 and PR12.
- **B-P2:** 21 scopes without a formula threw `costFormula is not a function`. Fixed by PR10.
- **B-P3:** `installDg` had no Variable link, so it returned NaN. Fixed by PR4.
- **B-P4:** `replaceFrenchDoors` had no link, so it always returned $0. Fixed by PR4.
- **B-P5:** `installBattery` never collected `kWhPerBattery`, so every battery was priced at 5 kWh. Fixed by PR4.
- **B-P6:** Non-shingle roofs were priced at the tile rate. Fixed by D5 and I9.
- **B-P7:** Hardcoded literals were hidden inside formulas. Fixed by PR2.
- **B-P8:** The markup and tax were hardcoded, with no agent control. Fixed by PR8, PR11 and O2.
- **B-P9:** A dead projectId-keyed TTL cache, empty or duplicate Hono routers, and a public `findAllPricing`. Not ported.
- **B-P10:** Results existed only in client memory. Kept deliberately in C0 (I8).

---

## 7. Port inventory

### 7.1 Formulas: 24 ported, 8 not ported

Source: `apps/remodel-x/src/features/project-creator/lib/cost-formulas/*.ts`. BSQ = 100 sqft; S = number of stories; L = number of layers.

| Trade | Pricing key | Variables (after PR4) | Cost formula (verbatim logic) |
|---|---|---|---|
| Roof | `overlay` | numFlatBSQ, numPitchedBSQ | flat·BSQOverlayFlat + pitched·BSQOverlayPitched + (S−1)·dollarPerAdditionalStory·(flat+pitched) |
| Roof | `tearOff` | numFlatBSQ, numPitchedBSQ, numLayers | pitched·(roofType=shingle ? BSQTearOffShingles : BSQTearOffTile) + flat·BSQTearOffFlat + (L−1)·dollarPerAdditionalLayer·pitched + (S−1)·dollarPerAdditionalStory·(flat+pitched) |
| Roof | `redeck` | numFlatBSQ, numPitchedBSQ, numLayers | flat·BSQRedeckFlat + pitched·BSQRedeckPitched + layers and stories as for tearOff |
| Roof | `tileReset` | numPitchedBSQ | pitched·(BSQTileReset + (S−1)·dollarPerAdditionalStory) |
| Solar | `installPanels` | numPanels, wattsPerPanel | panels·watts·dollarPerWatt |
| Solar | `rnrPanels` | numPanels | panels·dollarPerPanelRnr |
| Solar | `installBattery` | numBatteries, kWhPerBattery | n·(kWh=5 ? battery5kWh : battery10kWh) |
| HVAC | `replaceSplitSystem` | systemTonnage | threeTonRnr + (tons−3)·perTonStep |
| HVAC | `replaceFurnace` | systemTonnage | furnace36kBTURnr + (tons−3)·perTonStep |
| HVAC | `installMiniSplit` | numMiniSplits | miniSplits·n |
| Windows | `replaceWindows` | numSmallWindows, numLargeWindows | s·windowSmall + l·windowLarge |
| Windows | `replaceSlidingDoor` | numStandardSliders, numSpecialSliders | a·slidingDoorStandard + b·slidingDoorSpecial |
| Windows | `replaceFrenchDoors` | numFrenchDoors | n·frenchDoor |
| Insulation | `rnrAttic` / `topOffAttic` / `installCrawlSpaceInsulation` | sqft | sqft·($/sqft for that scope) |
| Hardscape | `installArtificial` / `installGravel` / `installMulch` / `installConcrete` / `installPavers` / `installDg` | installSqFt | sqft·($/sqft for that material) |
| Electrical | `mpu` | relocationRequired | relocation ? mpuWithRelocation : mpuBase |
| Exterior paint | `installExteriorPaint` | paintType, homeSqFt, garageSqFt | tier price by total sqft: < 1500 small, > 3000 large, otherwise average; per paint type |

**Not ported** (stubs that return 0 or a hardcoded value; priced as manual lines per PR10): `replacePackageUnit` (0), `replaceAC` (0), `rewire` (0), `recessLights` (0), `replaceSiding` (0), `partialInteriorPaint` / `fullInteriorPaint` (0, and no seeded scope), `foundationRepair` (hardcoded 555).

### 7.2 Unit Costs (verbatim from `packages/db/src/seeds/remodel-x/data/pricing.ts`; owner review is D10)

| Trade | Key | $ |
|---|---|---|
| Solar | dollarPerWatt | 3.5 |
| Solar | dollarPerPanelRnr | 225 |
| Solar | battery5kWh | 6,000 |
| Solar | battery10kWh | 11,000 |
| Roof | BSQTearOffFlat | 530 |
| Roof | BSQTearOffShingles | 480 |
| Roof | BSQTearOffTile | 750 |
| Roof | BSQRedeckFlat | 650 |
| Roof | BSQRedeckPitched | 700 |
| Roof | BSQTileReset | 580 |
| Roof | BSQOverlayPitched | 420 |
| Roof | BSQOverlayFlat | 420 |
| Roof | dollarPerAdditionalStory | 25 |
| Roof | dollarPerAdditionalLayer | 25 |
| Roof | permitFee_roof | 250 (unused, D6) |
| Windows | windowSmall | 550 |
| Windows | windowLarge | 650 |
| Windows | slidingDoorStandard | 2,500 |
| Windows | slidingDoorSpecial | 3,000 |
| Windows | frenchDoor | 5,000 |
| Insulation | dollarPerSqFtTopOff | 1.3 |
| Insulation | dollarPerSqFtRnr | 2.5 |
| Insulation | dollarPerSqFtCrawlSpace | 2.3 |
| Hardscape | dollarPerSqFt — Artificial | 7 |
| Hardscape | dollarPerSqFt — Gravel | 6 |
| Hardscape | dollarPerSqFt — Mulch | 5 |
| Hardscape | dollarPerSqFt — Concrete | 11 |
| Hardscape | dollarPerSqFt — Pavers | 11 |
| Hardscape | dollarPerSqFt — Dg | 5 |
| HVAC | threeTonRnr | 8,500 |
| HVAC | furnace36kBTURnr | 7,000 |
| HVAC | miniSplits | 3,000 |
| HVAC | perTonStep | 800 (a literal in the source) |
| HVAC | permitFee_hvac | 250 (unused, D6) |
| Electrical | MPU base | 3,200 (a literal in the source) |
| Electrical | MPU with relocation | 4,000 (a literal in the source) |
| Electrical | mainPanelTrade | 2,800 (seeded but unused, D6) |
| Exterior paint | coolLifePaint Sm / Avg / Large | 6,000 / 7,000 / 8,500 |
| Exterior paint | waterPaint Sm / Avg / Large | 4,000 / 5,000 / 6,500 |

Price rule in the source: `price = round(cost × 2.8)`, `tax = round(price × 0.075)`, `base = price − tax`.

### 7.3 Variables (from `packages/db/src/seeds/remodel-x/data/variables.ts`)

The same definitions already sit, unread, in tri-pros `src/shared/db/seeds/data/variables.ts`.
- **Roof:** numFlatBSQ, numPitchedBSQ (number, BSQ), numLayers (1 | 2 | 3). Also currentRoofType and desiredRoofType, and percentFreeDeckReplacement (15 | 20 | 25), which are I10.
- **Solar:** numPanels (number), wattsPerPanel (number, W), numBatteries (0–3), kWhPerBattery (5 | 10). inverterType (microinverter | solar-edge) is I10.
- **HVAC:** systemTonnage (1–5 in steps of 0.5), numMiniSplits (1–8). replaceDucts (boolean) is unused.
- **Windows:** numLargeWindows, numSmallWindows, numStandardSliders, numSpecialSliders, numFrenchDoors (all counts).
- **Insulation:** sqft. existing/desiredInsulationType are unused.
- **Hardscape:** installSqFt. demoSqFt is unused.
- **Electrical:** relocationRequired (boolean).
- **Exterior paint:** paintType (coolLife | water), homeSqFt, garageSqFt.

### 7.4 Savings source fields

`beforeProjectNetWorth` and `afterProjectNetWorth`, each `{ homeValue, otherLoans[{label, balance, payment}] }` · `currentPayment` and `afterPayment` `{ electricPayment, gasPayment, waterPayment, gardeningPayment, misc (current only) }` · `financialOption { financialOptionInterestRate, downPayment, loanTermMonths }` · `futureAssumptions { years 5, homeAppreciationRate 4, electricIncreaseRate 9.4, gasIncreaseRate 13.1, waterIncreaseRate 10.3, gardeningIncreaseRate 5 }`. Git history (`15fd624`) shows an earlier `jobCost` field that was later dropped; SP-I7 restores it as the project price.

---

## 8. Pointers

- **Source (monorepo root above):**
  - Savings: `apps/remodel-x/src/app/dashboard/project-roi-calculator/page.tsx` and `apps/remodel-x/src/features/project-roi-calculator/**`.
  - Pricing: `apps/remodel-x/src/features/project-creator/{cost-calculation-types.ts,lib/calculate.ts,lib/cost-formulas/*}`, `apps/remodel-x/src/features/project-creator/ui/components/forms/**/dynamic-field.tsx`, and `packages/db/src/{seeds/remodel-x/data/*,types/{pricing,variables,scopes}.ts}`.
  - Education copy (claims excluded by O8): `apps/remodel-x/src/features/education/`.
- **Tri-pros reuse:**
  - `src/shared/lib/loan-calculations.ts` (`amortizedMonthlyPayment`)
  - `src/shared/modules/proposals/core/lib/financials/tiers.ts` (`getMultiplierTier`, `formatMultiplier`)
  - `src/shared/lib/formatters.ts` (`formatAsDollars`)
  - `src/shared/components/ui/number-field.tsx`
  - `src/shared/modules/construction/` (catalog, C1)
  - `src/shared/db/schema/customer-profiles.ts` (C3 prefill)
  - `src/shared/db/schema/{variables,x-scope-variables}.ts` (seeded only, E3)
- **Stale references found during research (fix separately, not in this epic):**
  - `docs/ubiquitous-language.md:80` cites `construction-data.service.ts`, but the code has `src/shared/modules/construction/service.ts`.
  - `docs/ubiquitous-language.md:99` cites `computeSectionMargin` / `computeProposalCostTotals`, but the code has `computeSectionFinancials` / `computeProposalFinancials`.
  - The DMs-Present row cites `meetings.situationProfileJSON`, but the code has `meetings.contextJSON`.
