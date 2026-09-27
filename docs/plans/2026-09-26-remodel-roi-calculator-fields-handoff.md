# Remodel ROI Calculator: fields and data handoff

> **Status:** open, 2026-09-26. Owner handoff to a new session.
> **The job:** turn the v1 model in §5 into a spec with the owner (fields, data, engine outputs, the "show the work" breakdown and the charts), then plan and build it.
> **Delete this file** once that work lands in a spec, and move its decisions into the tracker.
> **Live index:** `docs/plans/2026-09-26-sales-calculators-epic.md`. Read §1 (rulings R9, R12–R14), §3.2 (requirements SP-*) and §5 (list of interim code). This file doesn't repeat them.
> **No solar.** Tri Pros no longer sells solar (owner, 2026-09-26). Solar is not an upgrade, scenario or example anywhere in this calculator.

## 1. The name

**Remodel ROI Calculator** is the canonical name, in UI copy, code, docs and conversation (tracker R12). It replaces "Savings Projection" (D1) and "Net-worth Projection" (R11).

- It is the **first and default tab** at `/dashboard/calculators`. Scope Pricing is second.
- The tab label is **Remodel ROI**.
- Code:
  - folder `src/features/calculators/remodel-roi-calculator/`
  - tab value `remodel-roi`
  - verify script `scripts/verify-remodel-roi.ts`
  - identifiers `RemodelRoi*`
- The owner calls the result cards "after snapshots". "Snapshot" is a reserved house term (D1), so code and copy use other words (§5.1 names the scenarios).

## 2. The owner's idea (verbatim, 2026-09-26)

> "we're estimating the return on the money you plan to invest in this remodeling project, since much of the upgrades are energy efficient and will save you on your utilities, there are MANY more avenues that will affect your final net worth if we project 10 years in the future. If we save you percentages off the utilities, as the utility rates hike our energy efficient upgrade saves you more and more money per year. This, plus the house appreciation and loan paydown you're talking about $100k+ sometimes difference in homeowner's net worth. AND you get to live in a house worth living in."

> "These should be quick, effective calculators that make the homeowner seeing them think to themselves 'wow this is absolutely worth it financially, especially if I stay in the home longer term'."

> "The idea is this remodel pays for itself, even if thats 'eventually'. Property value alone should decrease this break even point substantially, as the cost of construction KEEPS INCREASING AS WELL (10 years from now replacing the roof is much more expensive. So is the HVAC)."

> "This calculator will also include many more convincing charts and data models to reflect the true benefit of energy efficient remodel in Southern California's extreme temperatures."

## 3. Decided (owner, 2026-09-26)

| # | Decision |
|---|---|
| R13.1 | **Default horizon is 10 years.** |
| R13.2 | **After-bills are entered as a % reduction or an absolute $/mo. The default is %.** |
| R13.3 | **Show the work.** Each result shows its assumptions and the path from the data entered. |
| R13.4 | **Project price is manual.** A hint points the rep to the Scope Pricing tab, but no value is carried over, even when Scope Pricing was used. |
| R13.5 | **Goal:** quick and effective; the homeowner thinks "absolutely worth it, especially long-term". |
| R14.1 | **No solar.** Tri Pros no longer sells it. |
| R14.2 | **The monthly story is the showcase:** the loan payment is fixed, but utility bills keep rising, so the homeowner comes out ahead every month from some year on. |
| R14.3 | **Avoided costs are crucial:** systems that fail anyway get replaced later at a higher price, because construction costs keep rising. |
| R14.4 | **Property value counts,** and should pull break-even in substantially. |
| R14.5 | **The thesis is "the remodel pays for itself, even if eventually".** |
| R14.6 | **v1 needs no sources.** Defaults are the team's working numbers, marked as interim in code (why-comment plus a tracker I-row) and visible on screen. |
| R14.7 | **More charts and data models** will show the benefit in Southern California's extreme heat (§5.4). |

## 4. Why the model has to change (engine runs, 2026-09-26)

### 4.1 The C0 model (bills only)

The C0 model compares **with the project** against **never doing it**.

**The runs:** bills of $380 electric and $90 gas a month; the source's unsourced escalation rates (electric 9.4%/yr, gas 13.1%/yr); financing at 8.99% over 180 months.

**The results:**
- A $32k HVAC, attic and duct job is −$25k at 10 years and breaks even in year 15.
- A $65k roof, HVAC and attic job breaks even in year 20.

At a 10-year horizon that reads as a loss, which contradicts R14.5.

**It is also the wrong comparison.** An aging roof or HVAC isn't optional. "Never" isn't a real alternative; "wait until it breaks" is.

### 4.2 What each lever does

This is the prototype in §5. The "wait" side replaces each aging system when it fails, like-for-like, at the future price.

Assumptions: construction costs rise 5%/yr, the value added is 50% of the price, and 15-year financing at 8.99%.

| Job | Bills only | + value added | + avoided replacement & repairs | All three (wait pays cash) | All three (wait finances the same way) |
|---|---|---|---|---|---|
| A. HVAC + attic + ducts, $32k; HVAC fails in ~3 yrs ($16k like-for-like today, $600/yr repairs) | break-even yr 15 | yr 11 | yr 12 | yr 8 | **yr 6**; **+$17k** at 10 yrs, +$102k at 20 |
| B. Cool roof + HVAC + attic, $65k; roof fails in ~2 yrs ($28k), HVAC in ~4 ($16k) | yr 20 | yr 15 | yr 15 | yr 13 | **yr 7**; **+$19k** at 10 yrs, +$118k at 20 |
| C. Windows + attic, $30k; nothing failing | yr 19 | yr 14 | yr 19 | yr 14 | yr 14 |
| D. Dryscaping + irrigation, $25k; nothing failing | yr 18 | yr 13 | yr 18 | yr 13 | yr 13 |

**The monthly story (R14.2), job A, where the wait side finances its forced replacement:**

| Year | 1 | 3 | 5 | 10 | 15 | 16 (the "now" loan is paid off) | 20 |
|---|---|---|---|---|---|---|---|
| Wait, $/mo | 520 | 625 | 879 | 1,313 | 2,029 | 2,220 | 3,028 |
| Do it now, $/mo | 639 | 706 | 789 | 1,083 | 1,571 | 1,378 | 2,062 |

"Do it now" costs about $100/mo more for the first ~3 years, then costs less every month after that. The gap widens every year and jumps when the loan ends.

**What this shows:**
- The honest "wait" comparison, plus value added and construction inflation, delivers R14.5 for any job that replaces an aging system.
- Pure-efficiency jobs (C and D) still pay for themselves, only later. There the long-horizon view and value added carry the case.

The prototype scripts are scratch files from this session and aren't in the repo. The spec should specify the math afresh and pin it in `scripts/verify-remodel-roi.ts`.

## 5. The v1 model (proposed, for the owner to confirm in the session)

### 5.1 Two scenarios: "Do it now" vs "Wait until it breaks"

These names replace "with / without the project" in copy and code. The final wording is the owner's call.

**Do it now:**
- the project price, financed on the rep's terms (or paid partly in cash);
- utility bills cut from year 0;
- value added from year 0, appreciating with the home.

**Wait until it breaks:**
- today's bills keep escalating;
- each **aging system** costs yearly repairs (rising with construction inflation) until it fails;
- at failure it's replaced **like-for-like** (no efficiency gain) at `today's cost × (1 + construction inflation)^years`, **financed on the same terms**;
- from then on, that replacement adds value in proportion to its cost.

Systems that aren't failing (windows, insulation, dryscaping) are never done on the wait side.

Every one of these assumptions appears in "show the work", including "like-for-like" and "financed the same way". The homeowner can see exactly what is compared.

### 5.2 Inputs (quick first, detail on demand)

| Group | Fields | v1 default (unsourced, interim) | Why it's there |
|---|---|---|---|
| **Upgrades in this project** | Chips: HVAC, attic insulation, ducts, windows & doors, cool roof, cool exterior paint, dryscaping, … | none selected | Each chip carries a default % cut per bill category. Selected chips combine as `1 − Π(1 − r)`, so the total never passes 100%. This is how the rep gets quickly to R13.2's % default. |
| **Bills now** ($/mo) | electric, gas, water (plus gardening / misc if kept) | blank | The baseline |
| **Bill cut** per category | % (default mode) or $/mo, switchable per category; switching keeps the meaning (40% of $380 ⇄ $152) | from the chips | R13.2 |
| **Aging systems** (the wait side) | rows of `{system, age or years until it fails, today's like-for-like replacement cost, repairs $/yr}` | lifespan per system (e.g. HVAC 18 yrs, asphalt roof 25), so years left = lifespan − age; repairs e.g. $600/yr for HVAC | R14.3, the largest lever |
| **The project** | price (manual, with a "Price it in Scope Pricing" hint that switches tabs), incentives, down payment, APR, term | none; default financing terms are the owner's call | R13.4 |
| **Value added** | % of price (or $) | e.g. 50% of price | R14.4 |
| **Assumptions** (on screen, editable) | horizon (chips 10 · 15 · 20 · 30), utility escalation per category, **construction inflation** (new), home appreciation | 10 yrs; source rates 9.4 / 13.1 / 10.3; construction 5%/yr; home 4%/yr | R13.1, R14.3 |
| **Home value and existing loans** | optional, collapsed ("add these to see your total net worth") | — | They cancel out of every now-vs-wait difference (checked: a mortgage changed no difference). They only change the absolute net worth. |

### 5.3 Engine outputs (data the UI renders, never math the UI redoes)

- **A yearly series for each scenario:**
  - monthly cost (bills + loan + repairs);
  - cumulative cost;
  - home value;
  - debt still owed;
  - net worth;
  - the running now-vs-wait benefit.
- **Milestones:**
  - **break-even year**;
  - **the year monthly cost flips** (now < wait);
  - loan payoff year and the monthly gap after it;
  - for each aging system: **cost of waiting** (today's price vs the price at failure, plus repairs until then).
- **Where the return comes from** at the chosen horizon:
  - bill savings;
  - repairs avoided;
  - the replacement price avoided (the inflation premium plus the wait-side interest);
  - value added;
  - minus the interest paid.
- **Show the work (R13.3):** every figure above has an explanation made of lines. Each line has a label, a value, a unit, where it came from (the rep's input, an assumption, or a computation), and the lines it was built from.

  For example, electric: "$380/mo today → HVAC −25% and attic −10% → −32.5% → $256/mo; rates rise 9.4%/yr (assumption), so year 10 is $857 without vs $578 with."

### 5.4 Charts (the case in Southern California heat)

1. **Monthly cost, year by year** (the hero; R14.2): two lines, with the flip year marked and the step down at loan payoff.
2. **The pay-for-itself curve:** cumulative benefit crossing zero at break-even, driven by the horizon chips.
3. **Cost of waiting:** for each aging system, today's price next to the price at failure, plus repairs until then.
4. **Where the return comes from:** a waterfall at the horizon.
5. **Summer vs winter:** a 12-month bill profile before and after. Inland heat makes air conditioning the bulk of summer electric, and that's where efficiency cuts the most. This needs **summer and mild-month electric bills** as inputs, instead of one average. That's an owner question (§6).
6. **Where rates are heading:** today's summer bill at 5, 10 and 20 years.
7. **Home value:** now vs wait.

## 6. Questions for the owner in the session

1. **Scenario names and framing:** "Do it now" vs "Wait until it breaks"?
   - Is the wait side financed the same way (recommended, and realistic for an emergency replacement)?
   - Is it replaced like-for-like?
2. **v1 default numbers** (unsourced, interim, per R14.6):
   - the % cut per upgrade chip and per bill category;
   - lifespan and repairs per system;
   - construction inflation 5%/yr?
   - value added 50% of price, or per trade?
   - default financing terms.
3. **Headline:** the break-even year ("pays for itself in year 6"), the benefit at the chosen horizon, the monthly flip year, or a combination?
4. **Electric bills:** one average, or summer and mild-month bills (needed for the seasonal chart, §5.4 #5)?
5. **A climate preset** (coastal, inland, desert) that tunes the default cuts and the seasonal profile?
6. **Bill categories:** keep gardening and misc, or electric, gas and water only?
7. **Incentives:** keep one number? ⚠️ `features/meeting-flow/constants/programs.ts` cites the IRA 25C $1,200 credit. My understanding is that the July 2025 federal budget law ended 25C for work after 2025. Verify before using it anywhere.
8. **Copy:** where the thesis (§2) and "pays for itself, even if eventually" appear, and their wording. Homeowner-facing copy follows `PRODUCT.md` and `DESIGN.md`. Any dollar figure is computed for this home, never asserted (O8).
9. **Scope of v1:** everything in §5 in one build, or the monthly-story chart and aging systems first, with the seasonal chart and climate preset after?

## 7. What exists today (C0 Tasks 1–8, commits `f1fbf856..5e7b8f86`, renamed since)

- **Inputs (`schemas/form.ts`, numbers `null` when empty):**
  - `homeValue`
  - `liabilities[]` `{label, balance, monthlyPayment, aprPercent}`
  - `billsNow` and `billsAfter` `{electric, gas, water, gardening, misc}`, absolute $ only
  - `project` `{price, incentives, downPayment, aprPercent, termMonths, uplift {mode, value}}`
  - `assumptions` `{horizonYears 1–30, ratesPercent {homeAppreciation, electric, gas, water, gardening, misc}}`
- **Defaults (`constants/config-defaults.ts`):**
  - horizon **5** (R13.1 → 10);
  - rates 4 / 9.4 / 13.1 / 10.3 / 5 / 0;
  - served by `lib/resolve-config.ts` (Admin-configured from C2, I3).
- **Engine:** `lib/project-remodel-roi.ts` `projectRemodelRoi(input, config)`. It is pure; the math is in spec §6.2 (`docs/superpowers/specs/2026-09-26-sales-calculators-c0-port-design.md`).
  - It compares with the project against never doing it: no aging systems, no construction inflation, no monthly-flip or payoff milestones, and totals only (no explanation lines).
  - The golden values are in `scripts/verify-remodel-roi.ts`.
- **UI:** `ui/views/remodel-roi-calculator.tsx`.
  - Input steps run home & loans → bills now → bills after → the project → assumptions.
  - Results are a headline, four comparison cards and a "total paid" chart.
- **Keep:**
  - the pure-engine boundary (O5);
  - the one config resolver;
  - On-screen assumptions (SP-O4);
  - the homeowner-facing rule (R1: no Cost, multiplier or margin);
  - `remainingBalance` / `amortizedMonthlyPayment` in `src/shared/lib/loan-calculations.ts`.

## 8. Effect on the C0 build in flight

- **Visual direction (C0 Task 9):**
  - The layout warm-up is at https://claude.ai/artifact/MLp6sq5Dr7vLMvKTCe8W5k. It still shows the old name.
  - Scope Pricing's layout pick can go ahead now.
  - This calculator's layout follows the spec from this session, because §5 adds whole input groups and a chart-led results surface.
- **Scope Pricing still carries the ported solar Formulas.** It's an owner call whether to remove them: tracker §7.1, and `src/features/calculators/scope-pricing-calculator/lib/formulas/solar.ts` with its Pricing Keys.
- **The build log** is `.superpowers/sdd/2026-09-26-sales-calculators-c0-port/progress.md` (gitignored). Tasks 1–8 are complete; Tasks 9–11 remain.
- **The glossary row** for Remodel ROI Calculator is in C0 plan Task 11. Update its wording to the now-vs-wait framing if the owner confirms it.
- **Shared tree:**
  - Another session commits to `main` at the same time.
  - Commit by explicit path with `git commit --only -- <paths>`.
  - Never use stash, checkout or reset.
  - Run `pnpm tsc`, `pnpm lint` and both `scripts/verify-*.ts` before each commit.
