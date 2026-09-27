# Remodel ROI Calculator: fields and data handoff

> **Status:** open, 2026-09-26. Owner handoff to a new session.
> **The job:** define the structure of this calculator's fields and data (inputs, outputs, defaults and tiers), with the owner, before any more UI work on it.
> **Delete this file** once that work lands in a spec, and move its decisions into the tracker.
> **Live index:** `docs/plans/2026-09-26-sales-calculators-epic.md`. Read §1 (rulings R9 and R12), §3.2 (requirements SP-*) and §5 (list of interim code). This file doesn't repeat them.

## 1. The name

**Remodel ROI Calculator** is the canonical name, in UI copy, code, docs and conversation (tracker R12, owner, 2026-09-26). It replaces "Savings Projection" (D1) and "Net-worth Projection" (R11).

- It is the **first and default tab** at `/dashboard/calculators`. Scope Pricing is second.
- The tab label is **Remodel ROI**, to sit beside "Scope Pricing".
- Code:
  - folder `src/features/calculators/remodel-roi-calculator/`
  - tab value `remodel-roi`
  - verify script `scripts/verify-remodel-roi.ts`
  - identifiers `RemodelRoi*`, following the house camel-case for acronyms (`Tcp`, `Sow`)
- Words for individual figures ("savings", "net worth", "home value") stay as they are. They name figures, not the calculator.

## 2. The owner's idea (verbatim, 2026-09-26)

> "we're estimating the return on the money you plan to invest in this remodeling project, since much of the upgrades are energy efficient and will save you on your utilities, there are MANY more avenues that will affect your final net worth if we project 10 years in the future. If we save you percentages off the utilities, as the utility rates hike our energy efficient upgrade saves you more and more money per year. This, plus the house appreciation and loan paydown you're talking about $100k+ sometimes difference in homeowner's net worth. AND you get to live in a house worth living in."

The owner wants the form's copy to carry this idea. As a model, the idea breaks into these parts:

| Part of the idea | What it means for the data | Today in code |
|---|---|---|
| Return on the money invested | The headline is a return on the project price over a horizon | Headline is cumulative bill savings plus break-even year (`ui/components/savings-headline.tsx`). Net benefit (`summary.netBenefit`) exists but isn't the lead. |
| "save you percentages off the utilities" | Savings entered as a **% off each bill**, not a typed after-bill | After-bills are typed in dollars per category (D8, ruled "manual for now"; % reductions deferred to C2/C3 pending sourced data) |
| "as the utility rates hike … more and more money per year" | Bill escalation per category; a % saving grows in dollars every year | Built: `bill × (1+g)^t` per category (SP-M2/M3) |
| House appreciation | Home value compounding, plus any value the remodel adds | Built: appreciation rate plus an uplift in $ or % of price, default 0 (SP-I8) |
| Loan paydown | The project loan and existing loans amortize, which raises net worth | Built: `remainingBalance`; loans without an APR are held flat (D7, I7) |
| "10 years in the future" | Default horizon | Default is **5** (D4, from the source); the input allows 1–30 |
| "$100k+ … difference in net worth" | A **computed** result for this home, never a static claim (O8) | Net worth before and after is computed each year (SP-M6) |
| "a house worth living in" | Copy only; it isn't a number | None |

## 3. What exists today (C0 Tasks 1–8, commits `f1fbf856..5e7b8f86`, renamed since)

**Inputs:** `schemas/form.ts`. Every number is `null` when empty.

| Group | Fields | Bounds | Tier (R9) |
|---|---|---|---|
| Home & loans | `homeValue`; `liabilities[]` `{label, balance, monthlyPayment, aprPercent}` | amounts ≥ 0; APR 0–40; label ≤ 60 chars | On-screen |
| Bills now | `billsNow` `{electric, gas, water, gardening, misc}` (monthly $) | ≥ 0 | On-screen |
| Bills after | `billsAfter`, same five categories | ≥ 0 | On-screen |
| The project | `project` `{price, incentives, downPayment, aprPercent, termMonths, uplift {mode: amount \| percentOfPrice, value}}` | term 0–480 months | On-screen |
| Assumptions | `assumptions` `{horizonYears, ratesPercent {homeAppreciation, electric, gas, water, gardening, misc}}` | horizon 1–30; rates −20 to 50 | On-screen, defaulted from Admin-configured |

**Defaults:**
- `constants/config-defaults.ts`: horizon 5; rates `homeAppreciation 4, electric 9.4, gas 13.1, water 10.3, gardening 5, misc 0`. These are unsourced (I4). Remodel-x's own education pages quote 13.2–14.2% for electric and cite California utility-commission (CPUC) rate notices.
- They're served through `lib/resolve-config.ts`, which moves to `app_settings` at C2 (I3).

**Engine:** `lib/project-remodel-roi.ts` exports `projectRemodelRoi(input, config)`. It is pure, and the full math is in spec §6.2 (`docs/superpowers/specs/2026-09-26-sales-calculators-c0-port-design.md`). Its outputs, from `types/index.ts`:
- `years[]` for t = 0…N: `homeValueBefore/After`, `cumulativeCostBefore/After`, `netWorthBefore/After`, `netBenefit`
- `summary`: `monthlyBefore/After/Difference`, `cumulativeSavings`, `valueGained`, `netBenefit`, `breakEvenYear`, `projectMonthlyPayment`, `horizonYears`, `heldFlatLiabilities`

`scripts/verify-remodel-roi.ts` holds the golden values.

**UI:** `ui/views/remodel-roi-calculator.tsx`.
- The input steps run home & loans → bills now → bills after → the project → assumptions.
- The results are a headline, four comparison cards (now / in N years × without / with), and a "total paid" chart.

## 4. Constraints that stand

- **Homeowner-facing (R1):** no Cost, multiplier or margin anywhere on this screen.
- **Every assumption stays visible and editable on screen (SP-O4).** Rates are labelled "%/yr" and bills "/mo".
- **No unsourced marketing claims in the copy (O8).** "$100k+" appears only when this home's numbers produce it. Rates and % reductions need a source before they become defaults (D4).
- **C0 saves nothing (I8).** Saving results against a meeting or proposal, and prefill from `customer_profiles`, are C3.
- **The engine stays pure TypeScript (O5),** so C2–C4 can move it without a rewrite.

## 5. Questions for the owner in that session

1. **Headline number:** return on the investment as net benefit (bill savings + change in net worth), the change in net worth alone, or bill savings? And is break-even still shown?
2. **Horizon default:** 10 years, as the owner's copy says, instead of 5?
3. **Utility savings as a % off each bill (reopens D8):** is the % per bill category, or per upgrade, rolled up into categories? Who sets it: the rep on screen, or an admin default per upgrade? Where do sourced %s come from? Is the typed after-bill kept as an override?
4. **Bill categories:** keep electric, gas, water, gardening and misc? Should gardening and water tie to dryscaping-type scopes?
5. **Incentives:** one number today. Should tax credits (e.g. the 25C credit Energy Saver+ uses) arrive in year 1 rather than reduce the loan principal?
6. **Added home value (uplift):** keep $ or % of price, with a default of 0? Is there a sourced default per trade?
7. **Loans without an APR:** keep holding them flat (D7, I7), or require an APR?
8. **Link to Scope Pricing:** C0 keeps the two calculators independent. Should the project price come from a Scope Pricing quote, or from the meeting's deal structure (`dealStructureSchema`: `startingTcp`, `apr`, `financeTermMonths`, `depositAmount`)? This touches C3; see tracker §3.7 S3.
9. **Copy:** where the idea in §2 appears (an intro above the form, the headline caption, or beside the results), and its final wording. Homeowner-facing copy follows `PRODUCT.md` and `DESIGN.md`.

## 6. Effect on the C0 build in flight

- **Visual direction (C0 Task 9):**
  - The layout warm-up (options A/B/C) is at https://claude.ai/artifact/MLp6sq5Dr7vLMvKTCe8W5k. It still shows the old name and tab order.
  - Scope Pricing's layout pick can go ahead now.
  - This calculator's layout should follow the field decisions above, because the layout depends on them.
- **The build log** is `.superpowers/sdd/2026-09-26-sales-calculators-c0-port/progress.md` (gitignored). Tasks 1–8 are complete; Tasks 9–11 remain.
- **The glossary row** for Remodel ROI Calculator is written in C0 plan Task 11 (`docs/superpowers/plans/2026-09-26-sales-calculators-c0-port.md`). Update its wording if this session changes the concept.
- **Shared tree:**
  - Another session commits to `main` at the same time.
  - Commit by explicit path with `git commit --only -- <paths>`, so other sessions' staged files are never swept in.
  - Never use stash, checkout or reset.
  - Run `pnpm tsc`, `pnpm lint` and both `scripts/verify-*.ts` before each commit.
