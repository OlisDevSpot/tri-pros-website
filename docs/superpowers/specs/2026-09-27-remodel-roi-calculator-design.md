# Remodel ROI Calculator: v1 model and guided presentation

> **Status:** approved by the owner 2026-09-27, with the colors amended to the app's own palette (§4.5). **Amended 2026-09-27 by R17** (plan critique): look-ahead up to 20, house vocabulary (Trades), new-install lives, truthful provenance, sustained milestones, shared components first. Where this spec and R17 differ, R17 wins; every amended section says so.
> **Replaces:** the C0 Remodel ROI UI (`ui/views/remodel-roi-calculator.tsx` and its steps) and the C0 engine's "with / never" model.
> **Inputs:** handoff `docs/plans/2026-09-26-remodel-roi-calculator-fields-handoff.md` (§5 model), tracker `docs/plans/2026-09-26-sales-calculators-epic.md` (R12–R16, D11, D12).
> **The design the owner last saw:** studies page https://claude.ai/artifact/AF7d7GL2fzL3nSocyvYx4u, version 2 (Option A, corrections applied).
> **Technique research:** `docs/plans/2026-09-27-remodel-roi-charts-research.md`.

## 1. Goal

A rep sits with a homeowner in the living room, on a tablet or laptop. The homeowner should walk away thinking "this is absolutely worth it financially, especially if I stay long-term" (R13.5), and should be able to see where every number comes from (R13.3).

The calculator compares two paths for the homeowner's own home:
- **Upgrade now:** the project, done today.
- **Wait and replace:** keep things as they are, repair the aging ones until they give out, then replace them with the same kind at that year's price.

It tells that comparison as a guided story on the main canvas, in a fixed order the homeowner can follow. The inputs sit in a side panel the rep controls.

## 2. Decisions already made

| # | Decision | Source |
|---|---|---|
| 1 | Inputs in a **collapsible side panel**; the canvas holds charts, the math behind them, and guiding copy. | R16.1 |
| 2 | **Direction A, guided scroll:** one scrolling story in the spine's order (§3.1), with a sticky top bar and a chapter rail. | R16, 2026-09-27 |
| 3 | The **comprehension spine** (§3.1) is the standard order; "works for now". | Owner, 2026-09-27 |
| 4 | Paths are named **"Upgrade now"** and **"Wait and replace"**. | R16.4 |
| 5 | Scene: **a mix.** Landscape tablet and laptop weigh the same; portrait tablet is the fallback. | R16.3 |
| 6 | Every bar is broken into its parts, and each part shows its amount on hover or tap. | Owner correction 1 |
| 7 | Working numbers live in an **Assumptions sheet**, not in the panel. | Owner correction 2 |
| 8 | **No present mode.** | Owner correction 3 |
| 9 | Home value and loans are inputs. They add net worth and are where consolidation (D12) will attach later. | Owner correction 5 |
| 10 | Bills are **electric, water, gas, gardening, misc**. | Owner correction 6 |
| 11 | The trades whose **current one** can age out are **HVAC, Roof, Windows & Doors, Exterior Paint & Siding**. | Owner correction 7, R17 |
| 12 | Each chapter has an **info icon** that opens "How this section works". | Owner, 2026-09-27 |
| 13 | The **look-ahead years** (10 · 15 · 20) live only in the top bar. The engine projects 20 years. | Owner, 2026-09-27; R17.1 |
| 14 | Default look-ahead 10 years; value added 80% of price; project price entered by hand with a Scope Pricing hint; no solar. | R13.1, R15.1, R13.4, R14.1 |
| 15 | Bill cuts default to a % derived from the picked trades; the rep can type a % or a $ amount per bill instead. | R13.2 |
| 16 | Headline = pays-for-itself year · costs-less-monthly year · amount ahead at the look-ahead year. | R15.2 |
| 17 | v1 numbers are interim working values, visible and marked (§6.4). | R14.6 |
| 18 | Homeowner profile seeds (D11) and debt consolidation (D12) are **out of v1**. | Owner, 2026-09-27 |
| 19 | **House vocabulary:** the rep picks the project's **Trades** in one list, keyed by the house trade accessors (`hvac`, `roof`, `windowsAndDoors`, `atticBasement`, `exteriorPaintSiding`, `dryscapingHardscaping`). No separate "upgrades" or "aging systems" lists. Ducts are an HVAC option. | R17.2 |
| 20 | **New installs outlast the look-ahead:** 25 years for cool-life paint, cool shingles, HVAC, windows & doors, turf; attic insulation for the life of the home. Wait and replace renews like-for-like at today's standard lives. | R17.3 |
| 21 | Value added: 80% of the price, growing with home value, on both paths. On the wait path each trade carries the value of its **latest** install. | R17.4 |
| 22 | An empty field means "use the working number"; the engine reports each value's **source**, and the tags follow it. | R17.5 |
| 23 | The story needs at least one trade, a price and a bill. | R17.6 |
| 24 | Pays for itself / costs less monthly = the first year from which it **stays** true through year 20. | R17.7 |
| 25 | The projection reads only valid form values; while a field is invalid the last valid projection stays on screen. | R17.8 |
| 26 | Shared components and chart atoms are built in `src/shared` first (§4.4a); the meeting flow moves onto them in the follow-up. | R17.9 |
| 27 | Chapter eyebrows reuse `BlockEyebrow`. | R17.10 |

## 3. Content

### 3.1 The comprehension spine

The chapters run from what the homeowner already knows is true to what is projected, so trust builds before the projections arrive.

| # | Chapter | The homeowner's question | Shows | Built from |
|---|---|---|---|---|
| 01 | Two ways forward | What are we comparing? | Both paths, one sentence each. No numbers. | `story.intro` |
| 02 | The answer | Is it worth it? | Three figures: pays for itself in year N · costs less every month from year M · ahead by $X at the look-ahead year. Each links to its chapter. | `milestones` |
| 03 | Today | What do I pay now? | Bills by type today, in year 5 and at the look-ahead year; other loan payments, if entered. | `years[t].billsByCategory` |
| 04 | Monthly (hero) | Will my monthly cost go up? | Monthly cost of each path by year. Two views: **Trend** (two lines, marked flip year, replacement and loan payoff) and **What makes it up** (paired stacked bars per year). | `years[t].monthly*` |
| 05 | Waiting | What if I just wait? | Each trade whose current one is aging: today's like-for-like price next to its price when it gives out, plus repairs until then, and any renewal inside the look-ahead. | `replacements[]` |
| 06 | Home value | Is my home worth more? | Value added on each path by year. | `years[t].valueAdded*` |
| 07 | Adding up | So what's it all worth? | The pay-for-itself curve, the "where the return comes from" breakdown, and net worth on both paths if home value was entered. | `years[t].benefit`, `returnParts`, `years[t].netWorth*` |
| 08 | Based on | What is this based on? | Every working number, tagged. Closes with "And you get to live in a house worth living in." | config + form |

### 3.2 Chapter anatomy (identical in every chapter)

1. An eyebrow with the chapter number and the homeowner's question, plus an **info icon** at the top right.
2. A one-sentence answer that carries the key number. Numbers in it are colored by path.
3. One visual: at most two series, labeled directly, annotated at the moment that matters.
4. Any chapter-specific note (loans in 03; net worth in 07).
5. One guiding line in the rep's voice.
6. **The math:** a one-line equation that is always visible, with a "Show the math" toggle that opens the full receipt in place.

**The info sheet** has three blocks:
- **What it uses:** each input or working number, with its value, its tag and an Edit link. The link opens the panel section, or the Assumptions sheet for a working number.
- **How it's worked out:** the method in plain words.
- **The math:** the full receipt.

Every receipt line and every "What it uses" row carries one of three tags: **You told us** (a form input), **Working number** (config or assumptions) or **Calculated**.

### 3.3 Copy rules

- Plain words. Use "pays for itself", never "break-even"; "rates rise", never "escalation"; "what you own minus what you owe" when net worth needs defining.
- Round numbers in sentences: to the nearest $1,000 at $10,000 and above, to the nearest $100 at $1,000 and above, otherwise to the dollar. Exact figures appear in the math.
- Cash and net worth are always labeled apart: "cash out of pocket" vs "counting home value and loans". When the pays-for-itself year comes before the costs-less-monthly year, chapter 02 says why in one sentence.
- The early extra monthly cost is named, never hidden.
- Every dollar figure is computed for this home, never asserted (O8). A chapter with nothing to say says so plainly: no trade with an aging current one gives "Nothing in this project is about to give out, so waiting has no replacement bill attached."
- System names keep acronyms ("HVAC", never "hvac").
- Copy is built by pure functions in `lib/story/`. Fixed strings live in `constants/`.

### 3.4 Copy sources

The chapter copy is the studies page's copy, v2: function `facts()` in the artifact's published `mocks.js`. Fetch it with the Artifact tool, `action: read` and `path: "mocks.js"`, on https://claude.ai/artifact/AF7d7GL2fzL3nSocyvYx4u. It moves into `lib/story/build-*.ts`. It is not repeated here; the plan copies it verbatim, one builder per chapter. No company facts appear anywhere in this calculator.

## 4. Architecture

### 4.1 Layout

- **Tab content:** a two-column grid at `lg` (≥1024px) and above: panel, then canvas. The panel and the canvas scroll independently. The tab's `TabsContent` stops being the scroller for this tab, so the panel stays put while the story scrolls.
- **Panel widths:** 360px at ≥1400px, 340px from 1024px, and a 76px rail when collapsed. Collapse is a button at the panel's top right. The rail shows one button per section, with a done mark and a short name; pressing one expands the panel with that section open.
- **Below 1024px:** the panel renders inside `ResponsiveSheet` (a bottom Drawer), opened by an **Inputs** button in the top bar.
- **Canvas:** the story column is at most 760px wide and centered, with a sticky **top bar** and a right-edge **chapter rail** (dots; labels on hover or focus).
- **Top bar**, left to right:
  - the three headline facts;
  - an **Assumptions** button;
  - the **Look ahead** segmented control (10 · 15 · 20). It is view state, not a form field (§4.2).

  When the canvas is narrower than about 940px (a container query), the button and the control drop their text labels. Below about 700px, the facts wrap.
- **Overlays:** the Assumptions sheet and the chapter info sheet use the shared `ResponsiveSheet`: a right Sheet at `lg` and up, a bottom Drawer below. It already handles focus return, Escape and scroll lock. Only one is open at a time.

### 4.2 Engine (pure, `lib/`) — amended by R17

`projectRemodelRoi(input, config)` is rewritten to the v1 model. It stays pure (O5): no React, I/O or `next/*`, and the UI never redoes its math. It knows nothing about the look-ahead.

**Inputs.** Only **valid** form values reach it: `useRemodelRoi` parses the form with its schema and, while a field is invalid, keeps the last valid projection. Every nullable field resolves to the working number when empty; the engine returns each resolved value with its **source** (`'input'` or `'working'`), so the story never guesses.

**Per bill category c:**
- `after_c` = `now_c × (1 − cut_c)`. The cut comes from the picked trades, `1 − Π(1 − r_k,c)` over picked trades k (HVAC adds its ducts cut when ducts are on), or is overridden by a typed % or $ (clamped to the bill).
- In year t (t ≥ 1), both paths grow at the category's rate: `bill × (1 + g_c)^(t−1)`.

**Project:**
- `netPrice = price − incentives`.
- Financed: principal = `netPrice − downPayment`, paid with `amortizedMonthlyPayment` over `termYears × 12` months.
- Cash: `upfront = netPrice`.
- **Upgrade now renews nothing** inside the projection: every trade's new-install life is at least `PROJECTION_YEARS`, and the config schema enforces it. It also has no repairs.

**Wait and replace, per picked trade with a current age** (only trades whose config has a `current` block: HVAC, Roof, Windows & Doors, Exterior Paint & Siding):
- `firstFail = max(1, round(standardLife − age))`.
- Install years: `firstFail`, `firstFail + standardLife`, `firstFail + 2 × standardLife`, … while ≤ `PROJECTION_YEARS`.
- The install in year y costs `likeForLike × (1 + construction)^y`. It happens at the end of year y and is financed on the project's terms from year y + 1, or paid in cash in year y when the project is cash. Each install is its own loan.
- Repairs in years 1…`firstFail`: `repairs × (1 + construction)^(t−1)`. A like-for-like install needs none within its life.

**Monthly cost in year t:**
- `monthlyNow = billsAfter + projectPayment` (while the loan runs).
- `monthlyWait = billsNow + repairs/12 + Σ replacement payments`.

**Value added** (R17.4):
- `valueNow(t) = valueAdded% × price × (1 + appreciation)^t`.
- `valueWait(t) = Σ over trades` of the trade's **latest** install at or before t: `valueAdded% × installCost × (1 + appreciation)^(t − installYear)`. A renewal replaces the value of the install before it.

**Benefit:**
- `benefit(t) = (cumWait − cumNow) + (valueNow − valueWait) − (debtNow − debtWait)`.
- `cum*` is cumulative cash, including upfront payments and cash installs; `debt*` is the remaining balance on each path's own loans.

**Net worth** (only when home value is entered):
- `homeValue × (1 + appreciation)^t + value* − Σ liabilitiesLeft(t) − debt*`.
- Liabilities amortize by their payment and APR. Without an APR, or with a payment that doesn't cover the interest, a balance is held at today's value (I7, unchanged).

**Output:**
- `years[0…20]`. Each year has bills by category on both paths; repairs, project payment and replacement payments; `monthlyNow`, `monthlyWait`; `cumNow`, `cumWait`, `debtNow`, `debtWait`, `valueNow`, `valueWait`, `benefit`; `returnParts` (bills saved, repairs skipped, replacements skipped, interest skipped, value gain, project price (negative), project interest (negative)), which **sums exactly to `benefit` every year**; and net worth, when home value is entered.
- `milestones` (R17.7):
  - `paysForItselfYear`: the first t ≥ 1 from which `benefit ≥ 0` holds for every year through 20;
  - `costsLessMonthlyYear`: the first t ≥ 1 from which `monthlyNow < monthlyWait` holds for every year through 20;
  - `payoffYear`.
- `replacements[]`: per trade, its installs (year, price), `repairsUntil` and `extra` (what waiting adds over installing like-for-like today).
- `cuts` per category: parts (per trade), combined, after, and whether the cut was typed.
- `liabilities[]`, **aligned to the form's rows by index**, each with `heldFlat`.
- `resolved`: every working-number-backed value with its source.
- `ready`: at least one picked trade, a price and at least one bill (R17.6).

**The look-ahead** is view state (10 · 15 · 20, default 10), held beside the form, never in it. The story builders take it as an input and read `years[lookAhead]`. Changing it never re-runs the engine.

**Explanation lines:**
- Each receipt line is `{ op?, label, value, tag, note?, strong? }`; `tag` comes from the value's source.
- Receipts are built by `lib/story/` from the projection, not by the engine.

The studies page's `roi-engine.js` is the reference for the parts R17 left unchanged (cuts, loans, benefit, net worth). It no longer matches as a whole, so §7 pins new goldens; the key intermediate values are checked by hand.

### 4.3 Form and config — amended by R17

**Form (`schemas/form.ts`, rewritten; numbers are `null` when empty; `null` on a working-number field means "use the working number"):**
- `trades`: an object with one key per trade; `null` means not picked, so each trade is picked at most once by construction.
  - `hvac`: `{ ducts: boolean, current: Current }`
  - `roof`, `windowsAndDoors`, `exteriorPaintSiding`: `{ current: Current }`
  - `atticBasement`, `dryscapingHardscaping`: `{}`
  - `Current` = `{ ageYears, likeForLikePrice, repairsPerYear }`, all nullable. A blank age means the current one isn't on the wait path; blank price and repairs use the working numbers.
- `bills: Record<BillCategory, { now, cut: { mode: 'trades' | 'percent' | 'amount', value } }>`
- `project: { price, incentives, downPayment, paymentMode: 'financed' | 'cash', aprPercent, termYears: 10 | 15 | 20 | 25 }` (`aprPercent` null → working number)
- `homeValue`
- `liabilities: { label, balance, monthlyPayment, aprPercent, kind: 'mortgage' | 'other' }[]`
- `assumptions: { ratesPercent: Record<BillCategory, number | null>, constructionPercent, homeAppreciationPercent, valueAddedPercent }` (all null → working numbers)

**Config (`schemas/config.ts` + `constants/config-defaults.ts`; tier: System default now, Admin-configured at C2):**
- `defaultLookAheadYears: 10`
- default rates: electric 9.4, water 10.3, gas 13.1, gardening 5, misc 0; home appreciation 4; construction 5
- `valueAddedPercent: 80`
- default financing: 8.99% APR over 15 years
- `trades`, keyed by trade (keys typed against the house `TradeAccessor`), each with:
  - `cutsPercent`: per bill category;
  - `newLifeYears`: 25 for HVAC, Roof (cool shingles; owner range 25–40), Windows & Doors, Exterior Paint & Siding (cool-life), Dryscaping & Hardscaping (turf); `null` for Attic & Basement (the life of the home). The schema rejects any value below `PROJECTION_YEARS`;
  - `current` (HVAC, Roof, Windows & Doors, Exterior Paint & Siding only): standard life, like-for-like price today, repairs per year.
- `hvacDuctsCutsPercent`: electric 5, gas 5.

**Tiers (R9):**
- **On-screen:** all form fields, including the Assumptions sheet's rates, construction, appreciation and value added. Working numbers show as placeholders in their empty fields.
- **Read-only in v1:** per-trade cuts, new lives and standard lives, shown in the Assumptions sheet.
- **Retired:** the $ / % uplift mode (`constants/uplift-modes.ts`). Value added is a % of the price.

### 4.4a Shared components, built first — R17.9

Built in `src/shared` before the calculator uses them, each generic (no calculator types), one component per file. The meeting flow moves onto them in the follow-up (`docs/plans/2026-09-27-remodel-roi-clarity-follow-ups.md` Part 2), which then deletes its inline copies.

- `src/shared/components/collapsible-section.tsx`: `{ title, summary?, status: 'done' | 'pending', open, onOpenChange, children }`, on Radix `Collapsible` + `AnimatedCollapsibleContent`. Source pattern: `features/meeting-flow/ui/components/context-panel-section.tsx`.
- `src/shared/components/step-marker.tsx`: `{ number?, state: 'active' | 'done' | 'pending' }`, the numbered or checked roundel. Source pattern: `features/meeting-flow/ui/components/shell/step-tabs.tsx`.
- `src/shared/components/stat-tile.tsx`: `{ label, value, sub?, onClick? }`. Source pattern: `steps/program-presentation.tsx`, `steps/deal-structure-fields.tsx`.
- `src/shared/components/inputs/form-number-field.tsx`: react-hook-form `FormField` + `NumberField` inside `InputGroup`, with optional `prefix` / `suffix` addons, `hint`, `placeholder` and a visually hidden label option; generic over the form's values. Replaces the calculator's `projection-number-field.tsx`.
- `src/shared/components/charts/legend-swatches.tsx`, `chart-tooltip-rows.tsx` (rows only, no surface, so it sits inside `HybridPopoverTooltip` without a double frame) and `chart-tooltip-card.tsx` (the rows on the same frosted surface as `TooltipContent`, for recharts `content`).
- `monthsToPayOff` moves into `src/shared/lib/loan-calculations.ts` beside the other amortization math.
- `src/shared/constants/glass-surface.ts`: the frosted-surface style that `ui/tooltip.tsx` and `ui/popover.tsx` write inline today; both, and `chart-tooltip-card.tsx`, use the one constant.

### 4.4 Components (feature-local; one per file; no module-level constants in component files)

- **View:** `ui/views/remodel-roi-calculator.tsx` mounts the provider and the workspace. The workspace owns the form (react-hook-form + zod, `mode: 'onChange'`) and the look-ahead state, runs `useRemodelRoi`, and renders the panel and the canvas.
- **Panel** (`ui/components/inputs-panel/`), sections built on `CollapsibleSection`, one open at a time; rail mode when collapsed:
  - `index.tsx`, `panel-rail.tsx`
  - `project-section.tsx`: price with the Scope Pricing hint (switches the tab), financed or cash, APR, down payment, term chips with the live payment, incentives.
  - `trades-section.tsx` + `trade-row.tsx`: trade chips; each picked trade opens a row. HVAC shows a ducts toggle. HVAC, Roof, Windows & Doors and Exterior Paint & Siding show "How old is the current one?" plus like-for-like price and repairs, whose placeholders are the working numbers.
  - `bills-section.tsx` + `bill-row.tsx`: each bill shows today's amount → its cut mode (From trades / % / $) → the amount after, with a category color dot.
  - `home-and-loans-section.tsx` + an updated `liability-row.tsx`: the mortgage row is fixed; other rows can be added and removed.
- **Canvas** (`ui/components/story/`): `story-canvas.tsx`, `top-bar.tsx`, `chapter-rail.tsx`, `story-chapter.tsx` (anatomy wrapper; eyebrow is `BlockEyebrow`, number is `StepMarker`), `chapter-body.tsx`, `chapter-math.tsx`, `receipt.tsx`, `source-tag.tsx`, `uses-list.tsx`, `chapter-info-sheet.tsx`, `assumptions-sheet.tsx`, `headline-stats.tsx` (on `StatTile`), `paths-intro.tsx`, `loans-note.tsx`, `net-worth-summary.tsx`, `missing-inputs.tsx`.
- **Charts** (`ui/components/charts/`), recharts 2.15.4, with legends and tooltips from `src/shared/components/charts/`:
  - `bills-by-category-chart.tsx`: stacked columns; each segment shows its own amount.
  - `monthly-cost-chart.tsx`: a Trend / What-makes-it-up switch (its view is local state). The trend view has the flip, replacement and payoff marks and a shaded early band. The breakdown view has paired stacked bars, a hatched repairs segment, and a tooltip on the bills segment that lists each bill.
  - `cost-of-waiting-chart.tsx`: horizontal, hoverable segments.
  - `home-value-chart.tsx`
  - `pay-for-itself-chart.tsx`: `--primary` fill above zero, `--warning` below, and the pays-for-itself mark.
  - `return-breakdown.tsx`: a floating-bar breakdown with a hoverable total row.
- **Hooks:** `hooks/use-remodel-roi.ts` (parses, projects, keeps the last valid projection). Chapter tracking reuses `useActiveSection(chapterIds, { rootEl })`.
- **Context:** `contexts/story-ui-context.tsx` holds only the open sheet, the open panel section and the collapsed flag, plus `scrollToChapter`, implemented in the provider from a scroller ref (no function stored in state). Read with React 19 `use(StoryUiContext)`; its `useStoryUi` hook lives in the context file, as `proposal-flow/contexts/scroll-context.tsx` does. Its types live in `types/`.

### 4.5 Visual system

- **World:** Command Desk tokens from `globals.css`: Syne for display figures, Nunito for text. Eyebrows reuse `BlockEyebrow` (Nunito, never mono; R17.10), and `DESIGN.md` / `docs/design-system/DESIGN.md` are corrected to match it.
- **Colors: the app's own, no new tokens** (owner, 2026-09-27: "adhere to the colors in our app and not introduce new colors unless absolutely necessary"). Every pairing below was checked with the dataviz validator in light and dark.
  - **Upgrade now** = `--primary` (Cobalt Command); **Wait and replace** = `--warning`. The two are reserved for the paths. In dark mode `--warning` sits lighter than the validator's band, but color-blind separation passes, so it stays: it is the app's token.
  - **Bills**, stacked in this order, use Tailwind hues the codebase already uses, applied through class maps in `constants/bill-colors.ts` (`fill-*` / `bg-*`):

    | Bill | Class |
    |---|---|
    | Electric | `yellow-600` |
    | Water | `sky-600` |
    | Gas | `violet-600` |
    | Gardening | `emerald-600` |
    | Misc | `--muted-foreground` |

    This order passes color-blind separation in both themes. Some steps fall below 3:1 contrast, which the in-segment labels, the tooltips and the legend already cover. Electric and `--warning` are both warm, but they never share a chart: bills show as one neutral segment wherever the paths appear.
  - **Other chart colors:** bills in the breakdown view use `--muted-foreground` at reduced opacity; repairs use a `--warning` hatch; ahead / behind fills use `--primary` / `--warning`; the return breakdown's gains use `--primary`, its costs `--muted-foreground` and its total `--foreground`.
  - **No `globals.css` change.** If a later need can't be met from these tokens, it comes back to the owner first.
- **Motion:** chapter content keeps a visible resting state (nothing starts at opacity 0). Rail scrolling is smooth, and instant under `prefers-reduced-motion`. Chart animation is off under reduced motion.

### 4.6 Accessibility

- Every control is at least 44px on touch.
- The panel accordion uses `aria-expanded`. Segmented controls use `aria-pressed`.
- Charts carry `role="img"` and a sentence `aria-label`. Tooltip content is reachable by keyboard focus on segments, or duplicated in the receipt.
- Sheets trap focus, and Escape closes them.
- The rail buttons are labeled with chapter names.

### 4.7 Technique rules

From `docs/plans/2026-09-27-remodel-roi-charts-research.md`. Checked against recharts 2.15.4 and tailwindcss 4.1.18.

- **Segment hover:** use `<Tooltip shared={false}>`, which puts the chart in item mode with a one-item payload. `activeBar` doesn't highlight in item mode, so the hovered segment is component state: per-`<Bar>` `onMouseEnter` plus `<Cell fillOpacity>` dims the others. On touch, use this own-state path, not `trigger="click"`.
- **Paired stacks:** use `stackId="now"` and `stackId="wait"`, spaced with `barGap` / `barCategoryGap`. For the 2px gap between segments, a custom `shape` insets each `Rectangle`.
- **Hatch:** write a literal `<defs><pattern>` directly inside the chart. A wrapper component is silently dropped. The pattern id comes from `useId()`.
- **Annotations:** use `ReferenceDot` / `ReferenceLine` / `ReferenceArea` with `label` and `ifOverflow`. The trend view uses the shared (axis) tooltip with custom breakdown `content`.
- **Ahead / behind fill:** use the gradient-offset trick (`off = max / (max − min)`, two stops at the same offset) on one `Area`. Don't use two clipped Areas.
- **Colors:** pass existing tokens into SVG props as `var(--primary)` / `var(--warning)` / `var(--muted-foreground)`, as the existing charts do with `--chart-1`. Bill segments take Tailwind `fill-*` classes from `constants/bill-colors.ts`. `--chart-1…5` are one blue hue, so they don't carry categories here (§4.5).
- **Container queries:** put `@container/story` on the canvas. The top bar uses `@max-[58rem]/story:` and `@max-[44rem]/story:` variants.
- **Scroll:** the canvas is its own scroller. Chapter tracking reuses the shared `useActiveSection` (an IntersectionObserver rooted on `rootEl`, picking the most-visible section), fed the chapter ids and the canvas element.
  - The global `* { scroll-margin-top: 80px; scroll-behavior: smooth }` (`globals.css:594`) is overridden locally: `scroll-pt-(--bar-h)` on the scroller and `scroll-mt-0` on chapters.
  - Rail clicks pass `behavior` from `matchMedia('(prefers-reduced-motion: reduce)')`.
- **Panel:** a toggled CSS grid column, with `inert` on the hidden full panel. Below 1024px it moves into `ResponsiveSheet` (`src/shared/components/dialogs/sheets/responsive-sheet.tsx`), which is a bottom Drawer there. Not the app `sidebar` primitive, which owns a cookie and a global Cmd/Ctrl+B. `ResponsiveContainer` gets `debounce` so charts don't re-measure every frame while the panel animates.
- **Unverified:** item-mode tooltips on iPad touch; Safari animating `grid-template-columns`. The plan's Playwright pass covers WebKit (Docker repro, memory `project-tailwind-content-detection-gap`), and the owner checks on a real iPad.

## 5. Data access

**None.** The calculator reads and writes nothing (O4, I8):
- no DAL, tRPC, schema, seed or entity changes;
- no user gate;
- all state lives in react-hook-form, the look-ahead state and the story UI context.

## 6. Error handling and edge cases

### 6.1 Missing inputs

Until there is at least one trade, a price and at least one bill, the canvas shows chapter 01 and a checklist (the trades in the project · today's bills · the price), never $0 or a loss. The top bar reads "Your numbers appear here as you fill in the inputs". While a field is invalid, the last valid story stays on screen and the field shows its error.

### 6.2 Degenerate paths

| Case | What the calculator does |
|---|---|
| No trade with an aging current one | Chapter 05 says so; the "wait" value line and replacement marks are omitted. |
| Paid in cash | No loan lines or payoff mark; each wait-path install is paid in cash in its year. |
| Upgrading never stays cheaper monthly within 20 years | The monthly answer says so and points to home value. |
| Never stays ahead within 20 years | Said plainly. |
| Cheaper from year 1 and stays so | "costs less from the very first month". |
| A current one already past its standard life | Treated as giving out in year 1. |
| A standard life short enough to renew inside 20 years (paint) | Each renewal is its own install, loan and value; chapter 05 lists them. |
| An override cut above 100%, or $ above the bill | Clamped to the bill. |
| A trade with no cut on any entered bill | Its chip still counts toward `ready`; the bill rows say no picked trade cuts that bill. |

### 6.3 Engine safety

No NaN, Infinity or negative bill for any valid input. §7 sweeps boundary values.

### 6.4 Interim working values

Each gets a why-comment in code and an I-row in the tracker (I11–I16):

| I-row | Value | Default | Status |
|---|---|---|---|
| I11 | Per-trade cuts (% per bill) | HVAC electric 25 / gas 20 (ducts +5 / +5); Attic & Basement 10 / 15; Windows & Doors 10 / 8; Roof (cool) electric 8; Exterior Paint & Siding (cool-life) electric 4; Dryscaping & Hardscaping water 40 / gardening 50 | owner question 2 |
| I12 | Current one: standard life, like-for-like price today, repairs per year | HVAC 18 yrs · $16,000 · $600; Roof (asphalt) 25 · $28,000 · $400; Windows & Doors 25 · $15,000 · $200; Exterior Paint 10 · $8,000 · $150 | owner question 2 |
| I13 | Construction inflation | 5%/yr | owner question 2 |
| I14 | Default financing | 8.99% APR, 15 years | owner question 2 |
| I15 | Wait-path rules | Like-for-like, renewed at its standard life, financed on the project's terms | owner question 1 |
| I16 | New-install life | 25 yrs for HVAC, Roof (cool shingles, owner range 25–40), Windows & Doors, Exterior Paint (cool-life), Dryscaping (turf); Attic & Basement for the life of the home | owner, R17.3 |

## 7. Verification

### 7.1 `scripts/verify-remodel-roi.ts`, rewritten

**Sample jobs:** bills of $380 electric and $90 gas; 8.99% over 15 years; value added 80%; rates 9.4 / 13.1; construction 5%; appreciation 4%.
- A: HVAC with ducts + Attic & Basement, $32,000, current HVAC aged 15.
- B: Roof + HVAC + Attic & Basement, $65,000, current roof aged 23, current HVAC aged 14.
- C: Windows & Doors + Attic & Basement, $30,000, no current ones aging.
- D: Exterior Paint & Siding, $12,000, current paint aged 8 (renews inside 20 years).

**Hand-checked values** (independent of the engine): job A's payment $324.37; A's year-1 monthly $626.19 upgrading vs $520 waiting; A's first HVAC install in year 3 at $18,522 with $1,891.50 of repairs until then; D's installs in years 2 and 12. **Pinned values:** the plan pins each job's milestones and benefit at 10 and 20 years, computed with the amended engine; a change to them is a model change and needs the owner.

**Also checked:**
- the `returnParts` identity every year for all four jobs, financed and cash;
- sustained milestones: a case that is cheaper in year 1 but dearer in year 3 does not report year 1;
- `ready` is false with no trade picked, no price, or no bill;
- provenance: an empty field resolves to the working number with source `working`, a typed one to `input`;
- the config schema rejects a new-install life under 20;
- override cuts (% and $, clamped); a current one past its standard life;
- net worth with an amortizing loan and a held-flat loan, and `heldFlat` aligned to the form's row index;
- a boundary sweep for NaN or Infinity.

The existing loan-helper checks stay, plus `monthsToPayOff`.

### 7.2 Gates

`pnpm tsc` and `pnpm lint` pass. Never `pnpm build`.

### 7.3 Playwright on `/dashboard/calculators?tab=remodel-roi`

Auth: `/api/dev/playwright-session`.

**Sizes and themes:** 1440×900, 1180×820, 1024×768 and 820×1180, in light and dark.

**Checks:**
- the panel docks at ≥1024px and is a sheet below;
- collapse and expand work;
- the top bar never wraps onto a second row at 1180 with the panel open;
- the chapter rail tracks the scroll;
- hovering a bills segment shows "Electric · $380/mo" for sample job A;
- the info sheet and the Assumptions sheet open and close with Escape;
- changing the look-ahead (10 · 15 · 20) updates the top bar and chapter 07, and leaves the milestones unchanged;
- the missing-inputs state appears on first load;
- no "Cost", "Multiplier" or "Margin" text (V6).

Clear `.next` before judging rendered CSS on a long-running dev server.

## 8. Files

The plan owns the exact file list. In outline:

**Create in `src/shared`:** the §4.4a components and `constants/glass-surface.ts`; `monthsToPayOff` in `lib/loan-calculations.ts`. **Modify in `src/shared`:** `components/ui/tooltip.tsx` and `components/ui/popover.tsx` (use the glass-surface constant).

**Create** (under `src/features/calculators/remodel-roi-calculator/`): `constants/trades.ts` (keys typed against the house `TradeAccessor`, labels), `constants/bill-colors.ts`, `constants/look-ahead.ts`, `constants/chapters.ts`, `constants/story-copy.ts`, `constants/panel-sections.ts`, `constants/story-classes.ts`, `lib/combine-cuts.ts`, `lib/format-money.ts`, `lib/join-words.ts`, `lib/panel-summaries.ts`, `lib/story/*`, `contexts/story-ui-context.tsx`, the components in §4.4.

**Modify:** `schemas/form.ts`, `schemas/config.ts`, `constants/config-defaults.ts`, `constants/form-defaults.ts`, `constants/bill-categories.ts` (reorder: electric, water, gas, gardening, misc), `constants/rates.ts`, `lib/project-remodel-roi.ts`, `lib/resolve-config.ts`, `types/index.ts` (projection and story types together), `hooks/use-remodel-roi.ts`, `ui/views/remodel-roi-calculator.tsx`, `ui/components/liability-row.tsx`, `src/features/calculators/ui/views/calculators-view.tsx` (this tab manages its own scroll), `scripts/verify-remodel-roi.ts`, `DESIGN.md` and `docs/design-system/DESIGN.md` (eyebrow font).

**Delete:** `ui/components/{savings-headline,comparison-card,total-paid-chart,step-section,bills-step,home-and-loans-step,project-step,assumptions-step,projection-number-field}.tsx`, `constants/uplift-modes.ts`.

**Files off limits:** `src/trpc/**`, `src/shared/db/**` (a type import of `TradeAccessor` is allowed), `src/shared/dal/**`, `src/shared/entities/**`, `src/shared/modules/**`, `src/features/meeting-flow/**`, and everything under `scope-pricing-calculator/`.

## 9. Out of scope and follow-ups

**Out of scope:**
- **D11, homeowner profile seeds.** v1 ships no preset loader. The studies page's four sample homes are a starting list.
- **D12, debt consolidation through home equity.** The liabilities list and net worth are its hook; no consolidation copy or math ships in v1, not even a placeholder.
- The **summer-vs-winter chart** and summer/mild-month electric bills (handoff §6.4), and a **climate preset** (§6.5).
- **Admin-configured storage** for any working number (C2), and **persistence** against a meeting or proposal (C3).

**Follow-ups:**
- **Clarity improvements and shared components** (owner, 2026-09-27): a follow-up to this spec and its plan, in `docs/plans/2026-09-27-remodel-roi-clarity-follow-ups.md`. (1) Brainstorm the clarity and comprehension improvements with the owner chapter by chapter. (2) Move the meeting flow onto the shared components this build creates (§4.4a), and weigh the Part 2.2 adapters. v1 ships as specified here; the follow-up amends it.
- **Glossary.** Add "Upgrade now / Wait and replace" to the Remodel ROI Calculator row (C0 plan Task 11). No new noun for "the current one": copy says "your current HVAC", code says `current`.
- **Handoff doc.** Delete `docs/plans/2026-09-26-remodel-roi-calculator-fields-handoff.md` once this spec is approved; its decisions are in the tracker (R13–R16) and here.
- **Incentives** stay one number with no tax-credit copy; the 25C note in the handoff is unverified.
