# Proposal energy impact: design

Date: 2026-10-20 · Status: draft, owner review pending · Visual design: handed to `/ui-exploration` after this is approved (EI4).
**Tracker:** `docs/plans/2026-10-21-proposal-energy-impact-epic.md` holds the owner rulings, the open questions, the research (rates, factors, qualifying scopes) and each requirement's status.

## 1. Intent

The homeowner reaches Funding and sees the price. That is the "wow, it's expensive" moment. The very next chapter answers it: **here is what these upgrades take off your bills every month, and what that adds up to over the years, in dollars, in energy, and in what it means for the air.**

The rep presents it at the kitchen table. The homeowner can open the same proposal that evening, see the bills the rep set, and move the sliders themselves. It must feel natural to play with: a slider moves and every figure follows at once.

The maths is the Remodel ROI calculator's bill-savings maths, not a second model. The calculator and the proposal read one shared set of numbers and logic in `src/shared/modules/construction/`, so a rep never sees two answers for the same house.

## 2. Goals, non-goals, anti-goals

**Goals**
- G1. A new proposal chapter, right after Funding, that projects the bill savings from the proposal's energy upgrades.
- G2. Monthly bill sliders for electric, gas and water, plus a utility pick for electric (LADWP or SCE). Gas is always SoCalGas.
- G3. Savings shown in dollars and in physical units (kWh, therms, gallons), then turned into environmental equivalents people can picture (CO₂, trees, gallons of gasoline, pounds of coal, and so on).
- G4. Bills and utility saved on the customer, editable by the rep and by the homeowner through the share link.
- G5. The energy logic and the charts both surfaces use live in `modules/construction`, imported by the calculators feature and the proposal-flow feature.

**Non-goals (this pass)**
- Published or sourced savings research. The team's working percentages are the model (owner, 2026-10-20).
- Per-house adjustment of the savings from the house's recorded condition (the age of the current AC, single or dual pane, insulation level). The model assumes bad, old, inefficient material is replaced with good, efficient material, exactly as the calculator does.
- Utilities other than LADWP and SCE for electric, and gas providers other than SoCalGas.
- Tiered or time-of-use rate modelling. One average rate per utility.
- Solar. Tri Pros no longer sells it; it never appears in any figure, copy or example.

**Anti-goals (a failure even if it works)**
- The calculator and the proposal disagree for the same trades and bills.
- A homeowner can't tell in a few seconds what moved when they dragged a slider.
- The working numbers read as if they were measured or guaranteed. They stay estimates, and the page says so plainly.
- The chapter shows on a proposal with no energy upgrade, or shows a zero-savings story.
- A homeowner's share link can change anything on their record other than these bill fields.

## 3. Owner decisions

| # | Decision |
|---|---|
| EI-D1 | The chapter sits **right after Funding**, before Next steps. This amends the proposal rework spec's P1 (`2026-10-16-proposal-page-rework-design.md`), which fixes six chapters. |
| EI-D2 | **Sliders** for the monthly electric, gas and water bills. Monthly amounts. |
| EI-D3 | Electric utility is **LADWP or SCE**, and the model uses that utility's average $/kWh. Gas is **always SoCalGas** and uses SoCalGas's average $/therm. |
| EI-D4 | Dollars saved convert to kWh (electric) and therms (gas). Both feed the environmental figures. Landscape work (dryscaping) shows water saved. |
| EI-D5 | The savings model is the calculator's: pick the upgrades, each cuts its bills by the team's percentage, assuming old inefficient material is replaced with efficient material. No published research this pass. |
| EI-D6 | Bills and utility are **stored on the customer** (like `age`), not on the proposal. |
| EI-D7 | The homeowner **sees the saved bills** when they open the link and **can move the sliders**, which saves them, through the token, the way they set their own age. |
| EI-D8 | Shared energy logic and charts **live in `modules/construction` for now**, because they are real-world construction data and derivations. |
| EI-D9 | Layout, charts and interaction are mapped out with **`/ui-exploration`** before the chapter is built. |

## 4. What already exists (verified 2026-10-20)

- **Calculator engine:** `src/features/calculators/remodel-roi-calculator/`. Pure `lib/project-remodel-roi.ts` (20-year loop, rates compound yearly), `lib/combine-cuts.ts`, `constants/config-defaults.ts` (cuts, rates electric 7.57 / gas 9.1 / water 8.9 %/yr), recharts charts under `ui/components/charts/`. Dollars only: no kWh, no utility, no environmental figures anywhere in the repo.
- **The construction move is already done on an unmerged branch.** `feat/trade-scenes-foundation` (active today) has commits `0feaf9ff8` (generated `TradeSlug` snapshot, `core/constants/trade-slugs.ts`), `a259011a3` (bill cuts, cut modes and repairs move from the calculator to `modules/construction/core`) and `7a0aeb9b4` (cool roof is an add-on on Roof & gutters, the only path to roof energy savings). There, `TRADE_BILL_CUTS` is keyed by catalog trade slug, with add-ons `ducts` (on `hvac`) and `cool-roof` (on `roof-and-gutters`), plus `combineCuts`, `cutFor` and `resolveTradeBillCuts` (the one config seam). This is the 3D scenes spec's D5 and the calculators tracker's D9 ruling.
- **Proposal page:** chapters are the `proposalSteps` array in `src/features/proposal-flow/constants/proposal-steps.ts`. Rail, tabs and numbering derive from it. Chapters read `useProposalDocument()`. The data is `proposals.business.getFullView` (`proposalShareableProcedure`: staff by session, homeowner by token). The trades come from `projectJSON.data.sow[].trade.id` and `.scopes[].id` (catalog ids), and are resolved through `useConstructionCatalog()` (public reads). Funding already has a homeowner-writable slider (`cash-down-control.tsx` → `useFundingChoice` → `setCashInDeal`).
- **Customer:** `customers.age` is a plain column because homeowners write it through the share token (`applyEnvelopeContext` in `src/trpc/routers/proposals.router/contracts.router.ts`, keyed off the proposal's customer, never a client-sent id). `getFullView` selects only name, contact, address and age from the customer. `electricProviders` (`src/shared/constants/enums/customers.ts:4`) exists and is unused.

## 5. Requirements

Stable ids. Plans and PRs cite them.

### 5.1 Model (`modules/construction/core`, pure, no React)

- **M1. One source of cuts.** Bill cuts per trade and add-on come from the construction module's `TRADE_BILL_CUTS` through `resolveTradeBillCuts()`. The calculator and the proposal both call it. No surface keeps its own copy.
- **M2. Energy trades from a proposal.** A pure function turns a proposal's SOW (trade ids and scope ids) plus the catalog into `{ trades: TradeSlug[], addOns: BillCutAddOnId[] }`. **Only complete replacements count** (EI-D10). A trade earns its cut only when the proposal includes a qualifying scope under it, and the list of qualifying scope ids lives in the construction module (tracker §3.2). Ducts are always on when HVAC qualifies ("assume ducts included"). Cool roof is always on when a roof scope qualifies, overlay included. An HVAC partial earns only its own bill: A/C alone cuts electric, and furnace alone cuts gas, with ducts following the same split. Radiant barrier is a new add-on on attic-and-basement and earns electric +5 and gas +2 even without insulation (tracker EI-D13–D18).
- **M3. Bills after.** For each of electric, gas and water: `after = now × (1 − combined)`, with `combined` from `combineCuts` (each cut takes its share of what the earlier ones left).
- **M4. Utility rates.** Working numbers, visible and editable like the calculator's rates: an average $/kWh for LADWP, an average $/kWh for SCE, an average $/therm for SoCalGas, and an average $/gallon for water. They are served through one resolver, like `resolveTradeBillCuts`, so admin settings can replace them later. The researched values and their sources are in tracker §3.3.
- **M5. Physical units.** Monthly kWh saved = electric $ saved ÷ utility $/kWh. Monthly therms saved = gas $ saved ÷ SoCalGas $/therm. Monthly gallons saved = water $ saved ÷ $/gallon. These use **today's** rate and stay flat across the years, because prices rise but usage does not.
- **M6. Dollars over time.** Yearly dollars saved escalate with the calculator's bill rates (the same constants, moved into the shared module or read from where the calculator keeps them, never duplicated). Cumulative savings over the look-ahead use the same compounding as `project-remodel-roi.ts`.
- **M7. Emissions and equivalents.** CO₂ = kWh × CO₂ per kWh + therms × CO₂ per therm. Equivalents come from CO₂: tree seedlings grown for 10 years, gallons of gasoline, pounds of coal, miles driven, and others the UI exploration picks. Factors are copied from the EPA Greenhouse Gas Equivalencies Calculator, with its URL in a comment (an external constant, so the comment is warranted). Electricity uses the California (CAMX) marginal rate from that page, not the national one (tracker §3.3). Gas savings count toward CO₂ (owner, 2026-10-20).
- **M8. One projection function.** `projectEnergyImpact({ bills, provider, picks, config, years })` returns the per-category before and after, monthly and yearly dollars, kWh, therms and gallons, CO₂, the equivalents, and a per-year series for charts. Inputs are plain values. It never reads storage.
- **M9. Goldens.** Verify scripts or tests pin a few cases: full HVAC; A/C only; furnace only; windows plus attic; radiant barrier alone; roof overlay without HVAC; dryscaping (water only); a proposal with only non-qualifying scopes, where the chapter is hidden; and every trade at once. For the same trades and bills, the calculator's after-bills and the proposal's must match.

### 5.2 Storage and access

- **S1. Customer columns** (ADR-0005: written by the homeowner through the token and read on every proposal open; same reason `age` is a column): electric provider (text, constrained to `electricProviders`), and monthly electric, gas and water bills (whole dollars, nullable). Names are checked against `CONTEXT.md` and `docs/ubiquitous-language.md`, and new terms are agreed with the owner. Only `pnpm db:push:dev`; prod is pushed by the owner.
- **S2. Read.** `getFullView` returns the four fields with the customer, so the chapter has them for staff and for the homeowner view.
- **S3. Write.** One proposal-shareable mutation sets any subset of the four fields. It resolves the customer from the proposal the caller reached, never from a client-sent customer id (the `applyEnvelopeContext` pattern), and it can write nothing else. Values are validated (non-negative, capped to the slider range).
- **S4. Not locked by signing.** Bills are the customer's data and the chapter is a projection, so a frozen proposal does not block the write. *(Claude's call)*
- **S5. Shared across proposals.** Every proposal of that customer shows the same bills. Moving a slider on one moves it for all of them. *(follows from EI-D6)*
- **S6. Saving cadence.** The slider updates the figures live, every frame, client side, and saves when the drag is released (`onValueCommit`), not on every tick. If a save fails, the figures stay where the hand left them, and the failure is surfaced the way the funding slider surfaces one.

### 5.3 Proposal chapter

- **P1. Placement.** A new `proposalSteps` entry between `funding` and `next-steps`. The working accessor is `energy` (label to be agreed with the owner). This amends the rework spec's P1 and band order (P40 alternation).
- **P2. Only when it applies.** The chapter renders, and appears in the rail, tabs and numbering, only when M2 finds at least one energy trade that cuts a bill. Otherwise the proposal keeps its six chapters, with no gap in the numbering.
- **P3. Live interaction.** Electric, gas and water sliders, and the electric utility pick. Moving any of them updates every figure and chart at once. Only the bills the proposal's trades actually cut need a slider. A dryscaping-only proposal needs only water, and an HVAC-only one needs electric and gas. *(Claude's call: hide the sliders that cannot move anything)*
- **P4. Empty start.** When the customer has no saved bills, the sliders start at typical SoCal monthly amounts, clearly marked as an example ("slide to your bill"). Nothing is saved until someone moves a slider. When the provider is unknown, SCE is preselected and visible. *(Claude's call)*
- **P5. Same view for both.** Rep and homeowner see the same chapter (rework spec P2, no view mode). Both can move the sliders.
- **P6. Honest framing.** The chapter says, in plain words, that the figures are estimates from the team's working numbers and average utility rates. The calculator's "show the work" spirit applies, at a depth the UI exploration decides.
- **P7. Reveal and motion** follow the page's existing patterns: `RevealGroup`, reduced motion honoured, recharts through shadcn `ChartContainer`, touch tooltips through `usePinnedChartTooltip`.
- **P8. Tokens.** Colours, surfaces and states follow `DESIGN.md` and `docs/design-system/theme-conventions.md`. Any new token is a stop-and-ask.

### 5.4 Shared UI and the calculator

- **C1. Shared charts home.** Any chart or stat component used by both the calculator and the proposal lives in `src/shared/modules/construction/core/components/`, and both features import it. Charts only one surface uses stay in that feature.
- **C2. Calculator keeps behaving the same** after it moves onto the shared model. Same numbers, checked against M9. Adding kWh, therms and environmental figures to the calculator is a follow-up (EI6), not this build. *(Claude's call)*

## 6. Calls Claude made (owner to check)

- Environmental factors come from the EPA equivalencies calculator (fixed conversion constants, not savings research). Electricity uses EPA's California (CAMX) marginal rate, because the national factor would overstate CO₂ for a California home.
- Dryscaping qualifies for every scope except sod, because natural grass needs water.
- Water converts at one average $/gallon (water providers vary too much to model now).
- Gardening, a dollar saving the calculator shows for dryscaping, is **not** in the chapter, because the owner named electric, gas and water. This is easy to add as a fourth slider if wanted.
- Sliders the proposal's trades can't move are hidden (P3). The empty start uses typical amounts and preselects SCE (P4).
- Bills stay editable after signing (S4).
- The calculator's behaviour is unchanged by this build, and its energy and environment panel comes later (C2).
- **Providers.** The column takes the existing `electricProviders` values. The chapter offers only LADWP and SCE (`edison`). If a customer holds any other value (set elsewhere later), the chapter uses the SCE rate and names the assumption.
- **What's adjustable on the proposal.** Only the four customer fields (bills and provider). Utility rates and yearly escalation are fixed to the working numbers on the proposal; they stay editable in the calculator only. If the UI exploration shows a look-ahead picker, it is session-only and is not saved. M4's "editable" applies to the calculator.

## 7. Roadmap

| Phase | What | Depends on |
|---|---|---|
| **EI0** | Land the construction foundation from `feat/trade-scenes-foundation` on main: `trade-slugs.ts`, bill cuts keyed by slug, add-ons, `combineCuts`, `cutFor` and `resolveTradeBillCuts`, with the calculator already rewired. This is one commit built from file contents (tracker §3.1), and the scenes branch rebases afterwards. | none (EI-D11) |
| **EI1** | Energy model in `modules/construction/core`: rates resolver, unit conversion, emissions and equivalents, `projectEnergyImpact`, M2 SOW-to-picks, goldens (M1–M9). | EI0 |
| **EI2** | Customer columns, `getFullView` read, shareable write mutation (S1–S6). Dev DB push only. | none (can run beside EI1) |
| **EI3** | Move any chart both surfaces need into `construction/core/components`, with the calculator importing it and unchanged (C1–C2). | EI0; which charts are shared comes from EI4 |
| **EI4** | `/ui-exploration` of the chapter: baseline, three directions, studies page, owner pick. | EI1 (real numbers to show) |
| **EI5** | Build the chapter (P1–P8) to the picked direction; Playwright check in both schemes and at phone width. | EI1, EI2, EI4 |
| **EI6** | Follow-up: the calculator gains the utility pick, kWh, therms and environmental figures from the same model. | EI5 |

`pnpm tsc` and `pnpm lint` gate every phase.

## 8. Open questions

Q1–Q3 were answered 2026-10-21 (tracker EI-D10–EI-D12). The questions still open, about windows, HVAC partials, attic add-ons and rates, are kept in tracker §2. The original wording is below for the record.

- **Q1. Which scopes earn a trade's cut, and how do cool roof and ducts show up on a proposal?** A proposal records trades and scopes only, no materials or variables. Cool roof is a material swap on the roof scopes (`scope-installs.ts` on the branch), and ducts is a calculator variable, so neither is a scope. Counting every scope would let a roof tune-up, an HVAC repair, a single front door or water-based paint claim the full cut. The builder needs a scope-id allowlist per trade (the branch already keys `SCOPE_INSTALLS` and `NOT_DRAWN` by scope id), plus a rule for cool roof and ducts.
- **Q2. How does EI0 land?** The three cited commits depend on others on the branch: `5be5bcf5e` (`resolve-overridable`), `438a0ec84` (calculator keyed on slugs), and the assembly-registry commits that `7a0aeb9b4` edits. The branch is 69 commits ahead of main. The options are: cherry-pick a wider slice, merge the whole branch, or build the energy work on top of the branch.
- **Q3. The rate numbers.** LADWP $/kWh, SCE $/kWh, SoCalGas $/therm, water $/gallon. Either the owner supplies them, or the builder takes current published averages (a lookup, not savings research) and the owner confirms them.

## 9. Left to the builder

- File names and splits inside `construction/core` (follow the module's existing `constants/`, `lib/`, `schemas/` layout and the owner's one-thing-per-file rules).
- Which router holds the write mutation (the proposals router family owns the token).
- How the Q1 allowlist is stored: keyed by catalog scope id with a name comment, like `SCOPE_INSTALLS`, until scope slugs exist (calculators tracker C1). Name matching is not acceptable.
- Slider ranges and steps, which the UI exploration proposes and the owner confirms.
