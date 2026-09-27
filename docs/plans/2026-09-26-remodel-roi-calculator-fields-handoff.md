# Remodel ROI Calculator: fields and data handoff

> **Status:** open, 2026-09-26. Owner handoff to a new session.
> **The job:** define the structure of this calculator's fields and data (inputs, outputs, defaults, tiers and the "show the work" breakdown), with the owner, before any more UI work on it.
> **Delete this file** once that work lands in a spec, and move its decisions into the tracker.
> **Live index:** `docs/plans/2026-09-26-sales-calculators-epic.md`. Read §1 (rulings R9, R12, R13), §3.2 (requirements SP-*) and §5 (list of interim code). This file doesn't repeat them.

## 1. The name

**Remodel ROI Calculator** is the canonical name, in UI copy, code, docs and conversation (tracker R12, owner, 2026-09-26). It replaces "Savings Projection" (D1) and "Net-worth Projection" (R11).

- It is the **first and default tab** at `/dashboard/calculators`. Scope Pricing is second.
- The tab label is **Remodel ROI**, to sit beside "Scope Pricing".
- Code:
  - folder `src/features/calculators/remodel-roi-calculator/`
  - tab value `remodel-roi`
  - verify script `scripts/verify-remodel-roi.ts`
  - identifiers `RemodelRoi*`
- Words for individual figures ("savings", "net worth") stay as they are.
- The owner calls the result cards "after snapshots". "Snapshot" is a reserved house term (D1), so code and copy say "with the project".

## 2. The owner's idea (verbatim, 2026-09-26)

> "we're estimating the return on the money you plan to invest in this remodeling project, since much of the upgrades are energy efficient and will save you on your utilities, there are MANY more avenues that will affect your final net worth if we project 10 years in the future. If we save you percentages off the utilities, as the utility rates hike our energy efficient upgrade saves you more and more money per year. This, plus the house appreciation and loan paydown you're talking about $100k+ sometimes difference in homeowner's net worth. AND you get to live in a house worth living in."

**The goal (owner, second pass):**

> "These should be quick, effective calculators that make the homeowner seeing them think to themselves 'wow this is absolutely worth it financially, especially if I stay in the home longer term'."

## 3. Decided (owner, 2026-09-26, tracker R13)

| # | Decision |
|---|---|
| R13.1 | **Default horizon is 10 years.** It is the System default; Admin-configured from C2. |
| R13.2 | **After-bills are entered either as a % reduction or as an absolute $/mo. The default is %.** |
| R13.3 | **Show the work.** The with-project results must show how each number was reached: the assumptions used, and the path from the data entered so far to the result. |
| R13.4 | **Project price is manual.** A hint points the rep to the Scope Pricing tab to work out a price, but no value is carried over, even when Scope Pricing was used. The two calculators stay independent in C0. |
| R13.5 | **Design goal:** quick and effective. The homeowner should come away thinking "this is absolutely worth it financially, especially if I stay long-term". |

## 4. What the current math says (run 2026-09-26, before this session)

These runs use the C0 engine unchanged:
- a home worth $800k;
- bills of $350 electric, $90 gas, $140 water and $120 gardening per month;
- the source's unsourced escalation rates (electric 9.4%, gas 13.1%, water 10.3%, gardening 5%, home 4%);
- $1,200 incentives, $0 down, 8.99% APR over 180 months.

"Net benefit" is bill savings plus the change in net worth, **with the project compared to without it**.

| Scenario | 10 yrs | 15 yrs | 20 yrs | 30 yrs | Break-even | Monthly now | Savings pass the loan payment |
|---|---|---|---|---|---|---|---|
| Energy package, $45k: electric −40%, gas −30% | −$42,658 | −$15,812 | $36,522 | $263,751 | year 17 | $700 → $977 | year 11 |
| Same, plus $20k added home value | −$13,054 | $20,207 | $80,345 | $328,619 | year 13 | $700 → $977 | year 11 |
| Solar, $38k: electric −85% | −$7,453 | $41,026 | $123,903 | $457,295 | year 12 | $700 → $776 | year 3 |
| Solar + dryscaping, $60k: electric −85%, water −50%, gardening −60% | −$20,511 | $46,861 | $162,111 | $620,823 | year 12 | $700 → $857 | year 4 |

**What this means for the design:**

1. **At the new 10-year default, typical financed projects show a loss.**
   - Break-even comes in years 12–17, and the $100k+ outcomes appear at 20–30 years.
   - The owner's "especially if I stay long-term" is exactly what the numbers support. The design should make the long view visible (see §6), not hide the early years.
2. **Two things in the owner's idea happen with or without the project:**
   - **Whole-home appreciation.** It raises the homeowner's net worth either way, so it can't be counted as the remodel's return.
   - **Loan paydown.** Paying off the project loan only turns cash into less debt, and without the project there is no loan. In the comparison, only the interest counts, as a cost.

   The engine already compares with the project against without it. So home value and existing mortgages cancel out of every difference: the mortgage run gave identical differences. They matter only to the **absolute** net-worth figures ("your home in 10 years is worth $1.18M"). Those are true and can be shown, as long as they aren't presented as the remodel's gain.
3. **The honest levers are:**
   - bill savings that compound as rates rise;
   - value the remodel adds to the home (uplift);
   - incentives;
   - costs the homeowner avoids. The calculator doesn't model this yet: the "without" side assumes the old roof or HVAC never needs replacing or repair.
4. **The early monthly picture is worse, then flips.**
   - The loan payment is fixed, but bills rise, so the monthly cost first goes up ($700 → $977) and then crosses back (year 3 for solar, year 11 for the energy package).
   - After the loan ends (year 15), the full saving is the homeowner's: $710 to $1,599 a month in these runs.
   - This is an honest, strong story, and the engine doesn't output it yet.
5. **Long horizons lean hard on the escalation rates, which are unsourced (D4).**
   - At 30 years, 13.1%/yr gas escalation compounds about 40×.
   - The "show the work" feature will put these rates in front of the homeowner, which is right, and makes sourced defaults urgent.

## 5. What exists today (C0 Tasks 1–8, commits `f1fbf856..5e7b8f86`, renamed since)

**Inputs:** `schemas/form.ts`. Every number is `null` when empty.

| Group | Fields | Bounds | Tier (R9) |
|---|---|---|---|
| Home & loans | `homeValue`; `liabilities[]` `{label, balance, monthlyPayment, aprPercent}` | amounts ≥ 0; APR 0–40; label ≤ 60 chars | On-screen |
| Bills now | `billsNow` `{electric, gas, water, gardening, misc}` (monthly $) | ≥ 0 | On-screen |
| Bills after | `billsAfter`, same five categories, **absolute $ only today** (R13.2 changes this) | ≥ 0 | On-screen |
| The project | `project` `{price, incentives, downPayment, aprPercent, termMonths, uplift {mode: amount \| percentOfPrice, value}}` | term 0–480 months | On-screen |
| Assumptions | `assumptions` `{horizonYears, ratesPercent {homeAppreciation, electric, gas, water, gardening, misc}}` | horizon 1–30; rates −20 to 50 | On-screen, defaulted from Admin-configured |

**Defaults:**
- `constants/config-defaults.ts`: horizon **5** (R13.1 changes it to 10); rates `homeAppreciation 4, electric 9.4, gas 13.1, water 10.3, gardening 5, misc 0`. These are unsourced (I4). Remodel-x's education pages quote 13.2–14.2% for electric and cite California utility-commission (CPUC) rate notices.
- They're served through `lib/resolve-config.ts`, which moves to `app_settings` at C2 (I3).

**Engine:** `lib/project-remodel-roi.ts` exports `projectRemodelRoi(input, config)`. It is pure, and the full math is in spec §6.2 (`docs/superpowers/specs/2026-09-26-sales-calculators-c0-port-design.md`). Its outputs, from `types/index.ts`:
- `years[]` for t = 0…N: `homeValueBefore/After`, `cumulativeCostBefore/After`, `netWorthBefore/After`, `netBenefit`
- `summary`: `monthlyBefore/After/Difference`, `cumulativeSavings`, `valueGained`, `netBenefit`, `breakEvenYear`, `projectMonthlyPayment`, `horizonYears`, `heldFlatLiabilities`

It outputs **totals only**: no per-category or per-component values that "show the work" (R13.3) could render. `scripts/verify-remodel-roi.ts` holds the golden values.

**UI:** `ui/views/remodel-roi-calculator.tsx`.
- The input steps run home & loans → bills now → bills after → the project → assumptions.
- The results are a headline, four comparison cards (now / in N years × without / with), and a "total paid" chart.

## 6. Recommendations to test with the owner

1. **Show the work as data from the engine, not math in the UI.**
   - The engine returns a breakdown for each figure. Each line records: a label, a value, a unit, and whether it came from an input, an assumption or a computation, plus the lines it was built from.
   - The UI only renders the breakdown, so the explanation can't drift from the math.
   - An example path the homeowner would read: "Electric today **$350/mo** → your upgrade cuts it **40%** → **$210/mo**. Rates rise **9.4%/yr** (assumption), so in year 10 that's **$786 without** versus **$472 with**; **$X saved** over 10 years."

   The same pattern covers the loan (payment, paid to date, still owed) and home value (today, appreciation, added value).
2. **The long view is one tap.** Offer horizon chips (10 · 15 · 20 · 30) beside the headline, and a chart whose "with" line crosses the "without" line. The break-even year and "the longer you stay, the more it pays" become visible instead of asserted.
3. **Add the two honest monthly milestones** to the engine output:
   - "your monthly cost drops below today's in year N";
   - "after the loan is paid off (year N), you keep $X/mo".
4. **Keep quick input quick.**
   - Home value and existing loans don't change the return (§4.2). Show them as optional ("add your mortgage to see your total net worth") rather than as step one.
   - The minimum to a first result is bills now, % cut per bill, price, financing and incentives.
5. **The % / $ switch is per bill category.**
   - Solar cuts electric but not gas, so each category needs its own switch.
   - Switching keeps the meaning: 40% of $350 ⇄ $210.
   - The resulting $/mo shows beside every %.
6. **Label the absolute net worth honestly.** "Your net worth in 10 years" can include appreciation; "what the remodel adds" must not.

## 7. Questions for the owner in that session

1. **Headline:** "what the remodel adds" (net benefit) at the chosen horizon, the break-even year, or both? And how should the screen present a negative figure at 10 years (§4.1)?
2. **Default % per bill:** is there a sourced default per category (or per upgrade), or does it start blank for the rep to fill? The only figure in the codebase is Energy Saver+'s "30-55% reduction in heating and cooling costs" (`features/meeting-flow/constants/programs.ts`), which cites no source.
3. **Avoided costs:** should the "without" side include the replacement or repair the homeowner would face anyway (for example, a 20-year-old HVAC)? This is the largest honest lever that isn't modeled yet (§4.3).
4. **Added home value (uplift):** keep $ or % of price, with a default of 0? Is there a sourced default per trade (e.g. a cost-vs-value report)?
5. **Incentives:**
   - Should tax credits count in year 1 instead of reducing the loan principal?
   - ⚠️ Check that the federal credits the app cites still apply. `programs.ts` cites the IRA 25C $1,200 credit. My understanding is that the July 2025 federal budget law ended 25C (energy-efficient home improvements) and 25D (residential solar) for work after 2025. That needs verifying before any credit becomes a default.
6. **Existing loans:** optional (§6.4), or dropped from C0? This also settles the "no APR, held flat" question (D7, I7).
7. **Bill categories:** keep electric, gas, water, gardening and misc? Should water and gardening cuts tie to dryscaping-type scopes?
8. **Escalation rates:** who supplies the sourced defaults (D4), and are they the same for 10 years and for 30?
9. **Copy:** where the idea in §2 appears (an intro above the form, the headline caption, or beside the results), and its final wording. Homeowner-facing copy follows `PRODUCT.md` and `DESIGN.md`. Any dollar figure is computed for this home, never asserted (O8).

## 8. Effect on the C0 build in flight

- **Visual direction (C0 Task 9):**
  - The layout warm-up (options A/B/C) is at https://claude.ai/artifact/MLp6sq5Dr7vLMvKTCe8W5k. It still shows the old name and tab order.
  - Scope Pricing's layout pick can go ahead now.
  - This calculator's layout follows the decisions above, because R13.3 adds a whole results surface.
- **The build log** is `.superpowers/sdd/2026-09-26-sales-calculators-c0-port/progress.md` (gitignored). Tasks 1–8 are complete; Tasks 9–11 remain.
- **The glossary row** for Remodel ROI Calculator is written in C0 plan Task 11 (`docs/superpowers/plans/2026-09-26-sales-calculators-c0-port.md`). Update its wording if this session changes the concept.
- **Shared tree:**
  - Another session commits to `main` at the same time.
  - Commit by explicit path with `git commit --only -- <paths>`, so other sessions' staged files are never swept in.
  - Never use stash, checkout or reset.
  - Run `pnpm tsc`, `pnpm lint` and both `scripts/verify-*.ts` before each commit.
