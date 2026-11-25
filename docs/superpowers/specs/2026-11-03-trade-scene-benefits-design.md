# Trade scene: the Benefits interior

Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md`, row Benefits; rulings R118, R127, R128, R155, R157, R166, R172, R184, R185, R188, R189, R215–R227.
Visual floor: `docs/plans/assets/2026-11-03-trade-scene-benefits/studies.html` (artifact https://claude.ai/artifact/9cbMADtH2fnM8URjqNd4EU, Version 7, round 7, approved 2026-11-03). Build to match it as closely as possible: sizes, spacing, motion, copy and behaviour (the owner's standing rule for the Controls build). Where this spec and the page disagree, the spec wins and the difference is listed in §10.

## 1. Goal

The rep opens Benefits after setting Today against the Tri Pros build. It is the payoff of the page (R185): one window where the homeowner sees everything the build brings, and the rep opens any part of it without the whole disappearing. Two things carry it:

- **Two futures** (R218–R222): what the home's costs would be without the build and could be with it, now and in a picked year, with the saving between them. The costs are the electric and gas bills plus each material's repairs, all editable in one place.
- **The matrix** (R157, R216): systems down, seven kinds of benefit across, a dot per benefit. A dot, a system or a kind opens its benefits in a rail beside the matrix (R223).

Homeowner-facing: no layout shift, calm transitions (R222).

## 2. Decisions already made

| # | Decision | Source |
|---|---|---|
| D1 | Benefits only ever shows the build; on Today it flips first (built). | R166 |
| D2 | The window is the Controls window, Benefits' fixed large placement (built); head: icon tile, "Benefits", the "Tri Pros build" tag, the x; no Done. | R172, R185 |
| D3 | Seven kinds, in this order: Savings, Easier on HVAC, Protection, Lasts longer, Warranty, Looks & use, Planet (coming soon). | R216 |
| D4 | Systems are the scene's six (`HOME_SYSTEM_IDS`, `HOME_SYSTEM_LABELS`). | R127 |
| D5 | The registry's first slice: one entry per upgrade (scope) in `src/shared/modules/construction/`, holding that upgrade's benefit statements; no documents, no manufacturer switch yet. | R128, R215 |
| D6 | Lifespan-type benefits are statements only, no figures. | R127 |
| D7 | Future savings follow the ROI calculator: year t's figure = today's × (1 + rate)^(t−1), electric 7.57 %/yr, gas 9.1 %/yr; repairs rise with construction prices, 5 %/yr, over the whole span (the scene knows wear, not install age). | R218, `project-remodel-roi.ts:129` |
| D8 | The look-ahead is a calendar: year 1 = the coming 12 months = "Now"; year N is labelled by the calendar year it ends in, `currentYear() + N` ("By 2031" for year 5 from 2026). Default 5 years, up to 10. | R218, R219 |
| D9 | The comparison is two futures: Without the build vs With the build, each now and in the picked year; the saving is their difference. Shown as D3 "Year by year": a pair of columns per year, the picked year lit, its gap bracketed. | R221, R222 |
| D10 | Few numbers on screen: the picked year's without / with / saves, today's as one quiet line; everything else in the "?". | R222 |
| D11 | Today's costs = electric + gas + each repairs-carrying material's repairs; defaults from the climate and the Today materials' wear; every one editable; collapsed by default to one line in the head row, opened over the window. | R220, R221, R223 |
| D12 | Coastal or inland shows in the costs editor only while it is missing; once set it is the summary's first word and is changed in Home facts → Area. | R184, R223 |
| D13 | No footer: the bills leave Benefits' footer (`BillsFooter` goes). | R219, R223 |
| D14 | The matrix takes the full width at rest; selecting a dot, a system or a kind narrows it and reveals the rail; deselecting widens it back. No rest summary. On the phone the rail is a sheet over the matrix area. | R223 |
| D15 | The kinds' head row is sticky; only the systems rows scroll; the window never scrolls. | R223 |
| D16 | Escape steps back: the "?" → the costs editor → the selection → the window. | R219 |
| D17 | Every benefit statement is a claim: the owner approves the wording. §3.3 and §3.4 are approved (2026-11-03); any later change goes back to the owner. | R215, R226 |
| D18 | Copy never says "your", never mentions solar; savings percentages only through the claim helper (`formatRowClaim`, "about N%"). | standing rules, `bill-cut-claims.ts` |
| D19 | A material's upkeep ends only when the build replaces the part that is the material: for the roof, the covering (tear-off, overlay, torch down, tile reset). Gutters, a redeck, drip edge or underlayment alone leave the roof's upkeep running. The rule lives in the shared savings rule, so Bills and Benefits agree. | R225 |
| D20 | In the costs editor a typed $0 is a real $0 (an all-electric home has no gas bill, and no gas saving is claimed); clearing a field goes back to its default; negatives are refused. Repairs fields work the same way. | R225 |
| D21 | Insulation savings are claims under the FTC R-value Rule: "Savings vary." closes every Savings group in the rail and the "?"; the R-value line replaces it when insulation is picked. Both stay marked pending verification; release is blocked on the sign-off. | R227, tracker line 72 |
| D22 | The phone and portrait iPad are secondary: they must work, and slight UI breaks there are acceptable. The phone's year radios (about 33×30) and the 375 px matrix cells (37 px) stay below the 40 px floor; portrait iPad uses the phone layout with the rail as a sheet; the rail's far column moves about 54 px a frame. | R232 |

## 3. Content

### 3.1 Head row (iPad and wider: one row)

`[tile] Benefits [Tri Pros build]` · `Today's costs  {area} · ${electric} electric · ${gas} gas · ${repairs} repairs  $${total}/mo` · `[✎ Edit costs]` · `[?]` · `[x]`

- `{area}` is `CLIMATE_LABELS[climate]`, or "Area missing" in the attention tone while `climate` is null.
- Phone (370 px window): a deliberate two-row head. Row 1 is the title row as built; row 2 is "Today's costs $469/mo", Edit costs, "?". The parts breakdown is hidden on the phone.
- Edit costs is the shadcn `Button` `variant="outline" size="sm"` with a pencil icon, `aria-expanded`, pressed while the editor is open. "?" is `variant="ghost" size="icon"`.

### 3.2 Two futures band

- **Readout** (fixed height, figures in tabular nums at a fixed width): a year chip ("By 2031", or "Now"), then "Without the build $615/mo", "With the build $212/mo", "Saves $403/mo"; on the right one quiet line "Today $469 → $155, saves $314 a month".
- **Chart** (D3): one pair of columns per year from Now to `currentYear() + 10`; Without in `--chart-5` (the categorical slate grey, set in both schemes; the mock's `--m-without` is not a real token; Claude's call), With in the build's primary; the picked year's pair lit and its gap bracketed; the y axis starts at $0. Tapping or dragging anywhere on the chart or its year labels picks the nearest year; the arrow keys step one year when it has focus.
- **Years**: iPad, every year labelled; phone, only Now, `+2`, `+5`, `+10` and the picked year are labelled, the rest are ticks.
- **"?" breakdown** (a panel inside the window, not a browser dialog), built like the calculator's info sheet (`chapter-info-sheet.tsx`): a question title ("What are future savings?"), the answer sentence for the picked year, "What it uses" (each row with a Working number / Typed / Calculated tag), "How it's worked out" (one paragraph), "The math" (rows: without / with / saves, now and for the picked year, per bill and for repairs).

### 3.3 Benefit statements (owner-approved 2026-11-03, R226)

Savings and Planet are derived, not written (§4.4). The rest are registry statements, shown only for picked upgrades; `onlyWith` / `onlyWithout` means the statement shows only with / without that efficiency upgrade on. The owner edited and approved every row in the review page (https://claude.ai/artifact/R72Gatc8cE4Bn4QeHaFW1f), then approved a wording tidy (the one "your" removed, grammar, American spelling). The table is the build's source; the page is the record of the review.

`{material}` and `{rValue}` are filled from the upgrade's installed material (its assembly material's copy label and `thermal.rValue`, after any efficiency swap), so the insulation statements follow the planned R-30 / R-38 and blown-in / batts split (R122, R126) without new statements. Today both insulation scopes install `blown-r38`, so they read "New R-38 blown-in insulation keeps…" and "Insulation topped up to R-38 keeps…".

| Upgrade (scope) | Kind | Title | Detail |
|---|---|---|---|
| Roof tear-off | Easier on HVAC (onlyWith cool-roof) | The attic starts cooler | Less heat comes down through the ceiling, so the AC runs less. |
| Roof tear-off | Protection | No more roof leaks | New underlayment, an ice-and-water membrane and a metal drip edge go under the new shingles and seal the roof tight. |
| Roof tear-off | Lasts longer (onlyWith cool-roof) | Shingles that age slower | A roof that stays cooler suffers less heat decay, so the shingles keep their oils longer. |
| Roof tear-off | Warranty (onlyWith cool-roof) | Owens Corning Duration COOL | The maker's warranty, plus the Tri Pros workmanship warranty. |
| Roof tear-off | Warranty (onlyWithout cool-roof) | New shingles | The Tri Pros workmanship warranty. |
| Roof tear-off | Looks & use | One new roof, edge to edge | New shingles, vents, flashing and drip edge in colors that complement one another. |
| Roof overlay | Easier on HVAC (onlyWith cool-roof) | The attic starts cooler | Less heat comes down through the ceiling, so the AC runs less. |
| Roof overlay | Protection | The roof sealed again | A new layer of shingles closes the old roof against rain. |
| Roof overlay | Lasts longer (onlyWith cool-roof) | Shingles that age slower | A roof that stays cooler suffers less heat decay, so the shingles keep their oils longer. |
| Roof overlay | Warranty (onlyWith cool-roof) | Owens Corning Duration COOL | The maker's warranty, plus the Tri Pros workmanship warranty. |
| Roof overlay | Warranty (onlyWithout cool-roof) | New shingles | The Tri Pros workmanship warranty. |
| Roof overlay | Looks & use | One new roof, edge to edge | New shingles, vents, flashing and drip edge in colors that complement one another. |
| Torch down | Easier on HVAC (onlyWith cool-roof) | The roof stays cooler | A bright membrane turns back most of the sun, so less heat comes down and the AC runs less. |
| Torch down | Protection | A sealed flat roof | A new torch-down membrane, fused at every seam, keeps the rain out. |
| Torch down | Lasts longer (onlyWith cool-roof) | A membrane that ages slower | A roof that stays cooler suffers less heat decay, so the membrane's asphalt keeps its oils longer. |
| Torch down | Warranty | A new torch-down roof | The Tri Pros workmanship warranty. (No membrane maker is on record, so no maker's warranty is claimed.) |
| Tile reset | Protection | No more roof leaks | Two new layers of underlayment, an ice-and-water membrane and a metal drip edge go under the reset tile. |
| Tile reset | Looks & use | The house keeps its tile look | The same tile goes back on over the new layers, which saves the cost of new tile. |
| Redeck | Protection | A solid deck under the roof | Soft or rotted plywood is replaced to code before the new roof goes on. |
| Redeck | Lasts longer | The roof holds its nails | New plywood keeps the roof fastened for its whole life. |
| Gutters | Protection | Rain kept off the walls | New aluminum gutters carry the water away from the wood, the walls and the foundation, protecting the home from water damage. |
| Gutters | Looks & use | Straight, clean gutter lines | New gutters along every eave, in a choice of styles and colors. |
| Attic insulation (replacement) | Easier on HVAC | Rooms hold their temperature | New {material} keeps the heat above the ceiling in summer and in the rooms in winter. The HVAC runs less and lasts longer. |
| Attic insulation (top-off) | Easier on HVAC | Rooms hold their temperature | Insulation topped up to {rValue} keeps the heat above the ceiling in summer and in the rooms in winter. The HVAC runs less and lasts longer. |
| Radiant barrier | Easier on HVAC | The roof's heat turned back | A foil barrier under the rafters reflects the heat before it reaches the insulation. |
| Air sealing | Easier on HVAC | No attic air through the ceiling | Every gap around the lights, the vents and the hatch is sealed. |
| Air sealing | Protection | Attic dust stays in the attic | Sealed gaps stop the attic's air and dust coming down into the rooms, so the air in the home stays cleaner. |
| Attic fan | Easier on HVAC | Hot attic air pushed out | On hot days a thermostat fan pulls the heat out through the gable, cooling the attic. |
| Window replacement | Easier on HVAC | Less heat through the glass | Dual-pane Low-E3 glass with argon gas slows the heat both ways, summer and winter. |
| Window replacement | Protection | Drafts and rain kept out | New vinyl frames close tight and are sealed against the wall. |
| Window replacement | Warranty | The window maker's warranty | Whatever the brand: the maker's warranty, plus the Tri Pros workmanship warranty. |
| Window replacement | Looks & use | Windows that open easily | A screen on every window, plus security features. |
| Cool Life repaint | Easier on HVAC | Walls that stay cooler | Less of the sun's heat soaks through the walls into the rooms. |
| Cool Life repaint | Protection | Cracks, stains and peeling fixed | The walls are repaired, patched and sealed before the new paint goes on. |
| Cool Life repaint | Protection | Walls kept from heat decay | Reflecting the sun keeps the stucco and the framing behind it cooler, so they last much longer. |
| Cool Life repaint | Lasts longer | Paint that lasts longer in the sun | A cool paint holds its color and its seal much longer, and it flexes with heat and cold, which helps prevent new cracks. |
| Cool Life repaint | Warranty | Cool Life paint | The maker's lifetime warranty, plus the Tri Pros workmanship warranty. |
| Cool Life repaint | Looks & use | A fresh color on every wall | One even coat, house and garage alike. |
| Water-based repaint | Protection | Cracks, stains and peeling fixed | The walls are repaired, patched and sealed before the new paint goes on. |
| Water-based repaint | Warranty | New paint | The Tri Pros workmanship warranty. |
| Water-based repaint | Looks & use | A fresh color on every wall | One even coat, house and garage alike. |
| Split system replacement | Warranty | Goodman system | The maker's warranty, plus the Tri Pros workmanship warranty. |
| Split system replacement | Looks & use | Even heating and cooling | A new high-efficiency system, quieter in every room, that uses less and lowers the gas and electric bills. |
| Split system replacement | Lasts longer | High-quality materials | Built to last, with plenty of parts available, so future repairs cost less. |
| Package unit replacement | Warranty | Goodman package unit | The maker's warranty, plus the Tri Pros workmanship warranty. |
| Package unit replacement | Looks & use | Even heating and cooling | A new high-efficiency system, quieter in every room, that uses less and lowers the gas and electric bills. |
| Package unit replacement | Lasts longer | High-quality materials | Built to last, with plenty of parts available, so future repairs cost less. |
| Air ducts replacement | Easier on HVAC (onlyWithout r8-ducts) | Air arrives at the rooms cool | New insulated ducts lose less air on the way, so the system runs more efficiently. |
| Air ducts replacement | Easier on HVAC (onlyWith r8-ducts) | Air arrives at the rooms cool | Having the right size of ducts makes all the difference. |
| Crawl space insulation | Easier on HVAC | Warmer floors in winter | R-19 batts under the floor hold the house's heat, so the floors feel much nicer for the family. |

Withdrawn from the mock: "Runs less, lasts longer" on the HVAC row, which depended on other systems' picks; a statement belongs to its own upgrade (Claude's call, so the registry stays one entry per upgrade).

### 3.4 Derived benefits

- **Savings, per system:** one statement per system whose picks earn a cut, titled from the cut sources that land in that system: "Electric about 8% lower", "Electric about 15%, gas about 17% lower" (`formatRowClaim` on the system's combined percent per bill), detail "About $46 a month off $200 electric and $100 gas, on the team's working numbers." and the figure $/mo. The mock's lead sentence on how each system saves ("A cool roof reflects the sun…") is dropped: the Easier on HVAC statements already say it (Claude's call).
- **Upkeep, per material whose repairs the build ends:** titled from a per-material noun in `BENEFITS_COPY` (`HOME_MATERIAL_LABELS` reads "Roof & gutters", too long for a title): "Roof upkeep ends", "Window upkeep ends", "Paint upkeep ends", "Heating & cooling upkeep ends"; the detail says "the old roof / windows / paint / system". Detail follows the material's actual wear (`WEAR_LABELS`): "Keeping up the old roof costs about $600 a year (Failing). The new one starts that at zero."; with no wear set the parenthesis is left out; with a typed figure it reads "costs $600 a year (typed)". A material at New wear has no repairs, so no statement. Figure: the repairs ÷ 12, $/mo. (Wording owner-approved 2026-11-03, R226.)
- **Planet:** one "coming soon" dot in every system with a picked upgrade that saves energy; its statement: "CO₂ saved and trees equivalent. Figures come soon after launch."
- **Kind heads' summaries:** Savings shows the build's saving now ($/mo, the compound total, never the sum of systems); Planet "soon"; the other kinds their count.

### 3.5 Costs editor

Opens over the window under Edit costs. A three-column grid (label · field · source tag):
- "The bills, a month": Area (only while missing: Coastal | Inland, hint "Until it is set the bills use the inland defaults."; once set: "Area: Inland. From Home facts → Area; change it there."), Electric, Gas (money fields, the climate default as placeholder).
- "Repairs, a year": one row per `repairsRows(property, home)` row (label + "option · condition" note), a $/yr field with the working figure as placeholder, tag Working number / Typed.
- Footnote: "Working numbers are the team's, not yet sourced; a typed figure wins. A material's condition is set in Systems."

### 3.6 Rail

- Header: what is selected in plain words ("Roof & gutters · 7 benefits · $66/mo in savings", "Protection across the home · 5 benefits", "Roof & gutters · Protection · 1 benefit") and "All benefits" to go back.
- Body: the benefits under small kind (for a system) or system (for a kind) subheads; each benefit: title, the figure right-aligned only where one exists, the detail on up to two lines, the upgrade it comes from as a small line.

### 3.7 Empty build

No picks: the matrix shows every system as "No change" with no dots, the rail never opens, and a centred note over the matrix area: "Nothing picked for the build yet" / "Pick upgrades in Modify or Systems, and every benefit they bring appears here." with an **Open Modify** button (`openSection('modify')`). The two-futures band shows only the without column pairs and "Saves $0".

## 4. Architecture

### 4.1 The upgrade registry (construction core)

`src/shared/modules/construction/core/constants/benefit-kinds.ts`
```ts
export const BENEFIT_KINDS = ['savings', 'easier-on-hvac', 'protection', 'lasts-longer', 'warranty', 'looks-and-use', 'planet'] as const
export type BenefitKind = typeof BENEFIT_KINDS[number]
// Savings and Planet are worked out from the picks; the rest are written per upgrade.
export type WrittenBenefitKind = Exclude<BenefitKind, 'savings' | 'planet'>
```
`src/shared/modules/construction/core/constants/upgrade-registry.ts`
```ts
export interface UpgradeBenefit {
  kind: WrittenBenefitKind
  title: string
  detail: string
  onlyWith?: EfficiencyUpgradeId
  onlyWithout?: EfficiencyUpgradeId
}
// `detail` may hold {material} / {rValue}, filled from the upgrade's installed material by `fillBenefitText`.
export interface UpgradeEntry { name: string, benefits: readonly UpgradeBenefit[] }
export const UPGRADE_REGISTRY = { [SCOPE_IDS.roofTearOff]: { benefits: [...] }, ... } as const satisfies Partial<Record<ScopeId, UpgradeEntry>>
```
`src/shared/modules/construction/core/lib/fill-benefit-text.ts`: `fillBenefitText(text, material)` swaps `{material}` for the material's copy label (first letter lowered unless it starts with "R-") and `{rValue}` for `R-${thermal.rValue}`; a placeholder with nothing to fill throws in the verify script, never at runtime (the registry is checked against `SCOPE_INSTALLS` by `scripts/verify-trade-scene.ts`). Keyed on `ScopeId` (the classifier the scene picks by). The statements are domain content the proposal and service pages will read later (R128), so they live in the registry, not in the scene's copy file. Product data (`OWENS_CORNING_SHINGLES`) is not moved in this slice; it joins with the manufacturer switch.

### 4.2 Shared projection (construction core)

One shared source for growth over the years, in construction core (R227), with the names and interface of the energy-impact plan (`docs/superpowers/plans/2026-10-21-proposal-energy-impact-foundation.md`), so both plans build on one implementation:
- `core/constants/bill-growth-rates.ts`: `BILL_GROWTH_RATES_PERCENT = { electric: 7.57, water: 8.9, gas: 9.1, gardening: 5, misc: 0 }` ("The team's estimate from thousands of customer bills analysed over the years; editable in the calculator.").
- `core/constants/construction-growth-rate.ts`: `CONSTRUCTION_GROWTH_RATE_PERCENT = 5` ("The team's working estimate until a sourced construction-cost index replaces it.").
- `core/lib/project-bill-years.ts`: `projectBillYears(bills, growthPercent, years)` → `BillYear[]` for `t = 0..years`, each value `× (1 + g/100)^(t−1)` from `t = 1`.
- `REMODEL_ROI_CONFIG_DEFAULTS.defaultRatesPercent` / `.defaultConstructionPercent` read the two constants, and the calculator's year loop reads its bills from `projectBillYears` (output unchanged, pinned by the verify script). The two futures run on the same helper, with upkeep as a third series at the construction rate.

### 4.3 Scene state

- New scene change `{ kind: 'repairs', trade: TradeSlug, perYear: number | null }` in `SceneChange`, applied by `applySceneChange` to `repairsOverrides[trade]` (null clears to the working figure). Every control writes through `useApplySceneChange` (R153).
- `SceneControlsValue` loses `billsOpen` / `toggleBills`; gains `benefits: { selection: BenefitSelection | null, lookAhead: number, costsOpen: boolean, whyOpen: boolean }` and setters. `BenefitSelection = { type: 'dot', system: HomeSystemId, kind: BenefitKind } | { type: 'system', system } | { type: 'kind', kind }`. `lookAhead` defaults to 5, range 1–10 (1 = Now). All of it resets when Benefits closes; `lookAhead` survives a close within the session (Claude's call: the rep's chosen year stays while presenting).
- Escape: through `ControlsModal`'s per-section `onEscapeKeyDown` (preventing the event keeps the window open, the hook Modify already uses): while Benefits is open, `whyOpen` → `costsOpen` → `selection` → the window closes, one step per press. The shortcut sheet's "Step back" line (`SHORTCUT_COPY.lines.wholeHome`) gains "a Benefits detail". The "?" key stays the shortcut sheet; the future-savings "?" is a button only.

### 4.4 Derivations (feature `lib/`, pure)

- `lib/picked-upgrades.ts`: `pickedUpgrades(facts, picks, efficiencyUpgrades)` → per `HomeSystemId`, the picked scopes, from `upgradeRows` + `upgradeRowState` (the Systems rail's rule), so the order is the Upgrades list's.
- `lib/build-benefits.ts`: `buildBenefits({ facts, picks, savings, repairs, efficiencyUpgrades })` → `BenefitLine[]` (`{ system, kind, title, detail, from, figure, soon }`, CONTEXT "Benefit line"; `Benefit` is the catalog table's type): registry statements filtered by `onlyWith` / `onlyWithout`; Savings, Upkeep and Planet from §3.4. A bill of $0 earns no Savings claim (D20); Planet follows the existing saves-energy classifier (`HomeSystemRow.kinds`).
- `lib/system-cuts.ts`: the per-system combined cut from `SceneSavings.cuts[category].parts` (each part's `source` is a trade or an add-on; `TRADE_SYSTEM` and `ADD_ON_SYSTEM` maps in `constants/benefit-systems.ts`), compounded with `combineCuts`' rule. The build's figure is always the compound total from `scene.savings`, never a sum of systems.
- `lib/today-costs.ts`: `todayCosts({ bills, climate, repairsRows, repairsOverrides })` → electric, gas, repairs by trade (override or working), total. `afterCosts(...)` → bills after the cut (`scene.savings.cuts[*].after`) + the repairs of materials the build does not end (`scene.savings.repairsByTrade` are the ended ones).
- `lib/future-year.ts`: `futureYear(today, after, year)` → `{ without, with, saves }` per category and total for one year via `projectBillYears`. Year 1's `saves` is the build's one saving figure: the readout, the Savings kind head and the rail all read it (each side's bills rounded on its own, the calculator's rule); `savings-figures.ts` (no screen reader, a gate wrong for Benefits) is deleted.
- `lib/year-label.ts`: `yearLabel(year, now = currentYear())` → "Now" for 1, else `String(now + year)`.

### 4.5 Components (`src/features/trade-scenes/ui/components/benefits/`, one per file)

| Component | Role |
|---|---|
| `benefits-head.tsx` (moves from `controls/`, extended) | title, tag, `TodayCostsLine`, Edit costs, "?" |
| `today-costs-line.tsx` | the head's summary line (phone: total only) |
| `costs-editor.tsx` | the panel over the window (§3.5); its rows `costs-bill-row.tsx`, `costs-repairs-row.tsx` |
| `two-futures-band.tsx` | readout + chart |
| `two-futures-readout.tsx` | fixed-width figures |
| `two-futures-chart.tsx` | recharts `BarChart` in the shared `ChartContainer` with a static `ChartConfig`; the picked year as the active index; pointer and keyboard picking |
| `future-why-panel.tsx` | the "?" breakdown (§3.2) |
| `benefits-matrix.tsx` | sticky kinds head + scrolling systems rows |
| `matrix-kind-head.tsx`, `matrix-system-head.tsx`, `matrix-cell.tsx` | buttons with `aria-pressed` / labels as in the mock |
| `benefits-rail.tsx` | the rail (§3.6); phone: the same content as a sheet over the matrix area |
| `rail-benefit.tsx` | one benefit line |
| `benefits-empty.tsx` | §3.7 |
| `benefits-body.tsx` (replaces the coming-soon one) | composes band + matrix + rail with the width transition |

Kind icons (lucide): `CircleDollarSign`, `Wind`, `ShieldCheck`, `Hourglass`, `Award`, `Eye`, `Leaf`, in `constants/benefit-kind-icons.ts`. Kind labels and every scene-side string (head, readout, editor, rail headers, empty state, "?" copy) in `constants/home-scene-copy.ts` (`BENEFITS_COPY`). Classes in `constants/controls-classes.ts` where shared with the Controls.

### 4.6 Layout, motion, reduced motion

- Body: a column of the two-futures band (fixed height) and the matrix area (fills the rest). The matrix area is a row: the matrix (`layout`) and the rail (`AnimatePresence`, an animated-width wrapper); at rest the rail is absent and the matrix fills it.
- Width change: 280 ms `cubic-bezier(0.4, 0, 0.2, 1)` (the expo-out front-loaded 37 % of the travel into one frame in the studies); every other transition expo-out 160–280 ms. Rows have fixed heights so the grid reflows without snapping.
- The costs editor and the "?" panel open over the window (no reflow); readout figures count to their new value at a fixed width (tabular nums, reserved width).
- Teleport: the chart's columns animate to the new active index; the readout counts (520 ms in the studies; keep).
- Reduced motion: every change instant.
- Measured targets (Playwright, per animation frame): 0 px unintended shift for the head, the band, the kinds row on every transition; the width change moves a cell one way only, ≤ 40 px in any frame, 0 px vertically.

### 4.7 Responsive

iPad landscape (the bar) and wider: one-row head, every year labelled, rail beside the matrix, all six systems visible without scrolling at 1180×820. Portrait iPad: as landscape with the rail narrower (min 300 px). Phone (< 640 px stage, the scene's existing `data-shape` portrait rules): two-row head, sparse year labels, the rail as a sheet over the matrix area, the matrix's first three systems visible at rest.

### 4.8 Accessibility

Matrix cells, system heads and kind heads are buttons with descriptive labels ("Roof & gutters, Protection: 1 benefit"); disabled when empty. The chart has a text alternative: the readout is an `aria-live="polite"` region; the year picker is focusable with arrow keys. Touch targets ≥ 40 px (the Controls' `floorFailures` check applies).

## 5. Data access

- **Reads, as they are:** the scene store (`useSceneInputs`: `bills`, `climate`, `repairsOverrides`, `proposedScopeIds`, `efficiencyUpgrades`, `property`), `useSceneTargets().savings` (`SceneSavings`), `repairsRows`, `upgradeRows`.
- **Writes, as they are:** `{ kind: 'bill' }`, `{ kind: 'climate' }` through `useApplySceneChange`.
- **New, UI-side only:** the `{ kind: 'repairs' }` scene change (feature types + `apply-scene-change.ts`).
- **Required server changes:** none. No DAL, tRPC, schema or seed change. Nothing is saved to the meeting yet (R153 / TS4).

## 6. Error handling and edge cases

- Climate null: inland defaults, "Area missing" in the line and the editor.
- A bill or repairs field cleared: back to its default (`null`). Typed 0: a real $0, kept (D20). Negative: refused by the field.
- A like-for-like build (only water-based repaint, say): no bill cut, upkeep may still end; Savings shows upkeep only; Planet has no dot.
- Wall-mounted or portable HVAC (no offer): Heating & cooling stays "No change".
- Flat roof: no attic upgrades are offered (built rule); their rows stay empty.
- The view flips to Today while Benefits is open: it closes (built).
- A selection whose benefits vanish can't happen while the window is open (picks change in Modify or Systems, which close Benefits); the selection resets on close.
- Today's wear defaults to Failing for an era home (see §10 follow-up); the figures follow the code as it is.

## 7. Verification

- `pnpm tsc` and eslint under `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock`; never `pnpm build`.
- `scripts/verify-trade-scene.ts` gains pure checks: registry statements for a pick set (onlyWith / onlyWithout); per-system cuts compound to the build's cut; `futureYear` year 1 equals today, year 5 equals the calculator's year-5 figure for the same bills and rates; `yearLabel`; `todayCosts` with and without overrides; the repairs scene change.
- `scripts/verify-bill-cut-claims.ts` stays green (no literal percentages in copy).
- Playwright against the owner's dev server on :3002 (never started or stopped by the build), sign-in through `/api/dev/playwright-session?secret=…&as=info%40triprosremodeling.com`, route `/dashboard/trade-scene`; viewports 1180×820, 820×1180, 1440×900 (sidebar), 390×844, 375×667; light and dark:
  1. Benefits on Today flips to the build; the head reads as §3.1; no footer.
  2. All six systems visible at 1180×820; kinds row sticky when the matrix is forced short.
  3. Select a dot, a system, a kind: the rail opens with the right header; cell motion per frame as §4.6; Escape order.
  4. Costs editor: missing climate shows the switch; set climate hides it; typing a repairs figure changes Today's costs and the saving.
  5. Teleport to 2035: the readout and chart follow; 0 px shift elsewhere.
  6. Empty build: the note and Open Modify.
  7. Touch-target floor; no console errors.
- The owner checks on the iPad.

## 8. Files

**Create**
- `src/shared/modules/construction/core/constants/benefit-kinds.ts`
- `src/shared/modules/construction/core/constants/upgrade-registry.ts`
- `src/shared/modules/construction/core/constants/bill-growth-rates.ts`, `construction-growth-rate.ts`
- `src/shared/modules/construction/core/lib/project-bill-years.ts`, `installed-material.ts`
- `src/shared/modules/construction/core/lib/fill-benefit-text.ts`
- `src/features/trade-scenes/constants/benefit-systems.ts`, `constants/benefit-kind-icons.ts`
- `src/features/trade-scenes/lib/picked-upgrades.ts`, `build-benefits.ts`, `system-cuts.ts`, `today-costs.ts`, `future-year.ts`, `year-label.ts`, `rail-groups.ts`, `benefits-step-back.ts`; `contexts/benefits-context.tsx`, `contexts/benefits-figures-context.tsx` and their hooks
- `src/features/trade-scenes/ui/components/benefits/*` (§4.5)

**Modify**
- `src/features/trade-scenes/types.ts` (`SceneChange` repairs kind, `BenefitSelection`, `Benefit`)
- `src/features/trade-scenes/lib/apply-scene-change.ts`
- `src/features/trade-scenes/contexts/scene-controls-context.tsx` (benefits state; billsOpen goes)
- `src/features/trade-scenes/constants/home-scene-copy.ts` (`BENEFITS_COPY`; `CONTROLS_COPY.benefits` coming-soon strings go; `SHORTCUT_COPY.lines.wholeHome`)
- `src/features/trade-scenes/constants/controls-classes.ts`
- `src/features/trade-scenes/ui/components/controls/controls-window.tsx` (mounts the new head and body, no footer)
- `src/features/calculators/remodel-roi-calculator/constants/config-defaults.ts` and `lib/project-remodel-roi.ts` (read the shared growth source)
- Owner-approved beyond the first list (R227): `scripts/verify-bill-cut-claims.ts` (scans the registry and the scene copy), `core/lib/resolve-assembly.ts` and `features/trade-scenes/lib/upgrade-rows.ts` (one swap helper, `installedMaterialId`), `core/lib/combine-cuts.ts` (exports `compoundCut`), `ui/components/controls/controls-toast.tsx`, `.superpowers/sdd/2026-11-01-trade-scene-controls/controls-check.mjs`; `lib/savings-figures.ts` deleted
- `scripts/verify-trade-scene.ts`
- `src/shared/modules/construction/core/types.ts` (`HomeMaterialDefinition` gains the parts whose replacement ends its repairs, D19)
- `src/shared/modules/construction/core/constants/home-materials.ts` (each repairs-carrying material names those parts: roof → `covering`; windows, paint and heating & cooling keep their current parts)
- `src/features/trade-scenes/lib/scene-savings.ts` (`landed()` credits repairs from that list, not from `parts`, which `part-offers.ts` still uses to map a part to its material)

**Delete**
- `src/features/trade-scenes/ui/components/controls/bills-footer.tsx`
- `src/features/trade-scenes/ui/components/controls/benefits-body.tsx`, `benefits-head.tsx` (moved and replaced under `benefits/`)

**Off limits:** `package.json`, eslint and tsconfig, `src/shared/components/scene/**`, `globals.css`, any DAL, `src/trpc/**`, schema, seeds.

## 9. Out of scope

Manufacturer documents and the manufacturer switch (R115, R128); colours and their savings (R116, R117); Planet's figures; saving to the meeting (R153, TS4); the proposal and service pages reading the registry; repairs figures as Modify search slots (bills keep theirs, `bill:electric` / `bill:gas`; repairs are edited only in the costs editor this round, Claude's call).

## 10. Follow-ups and open notes

- **Workmanship warranty term:** no term exists in `src/shared/constants/company/`; statements name the warranty without one. Add the term there, then the warranty statements can say it.
- **Today's wear defaults to Failing:** `homeAge` dates a 1950–1978 home to 1964 and `wearForAge` puts every original material past its last band, so an unrecorded era home's repairs run at ×1.5. A condition-rules question, separate from Benefits.
- **R-30 vs R-38:** the owner has already planned the split (R122, R126: top off to R-30 with R-38 as the efficiency step up; replace at R-30 or R-38, blown-in or batts), and the 3D scene will show it. The insulation statements read the installed material through `{material}` / `{rValue}`, so they follow that build with no change here. The system card's chip ("R-30 insulation", `buildChips['attic-insulation'].short`) is fixed in that build, not this one.
- **Scope data behind the owner's wording:** the owner's statements name work the scope installs don't list: vents and flashing on the tear-off and the overlay, drip edge on the overlay, two underlayment layers on the tile reset. The statements stand (the owner's operating rules are the truth); `SCOPE_INSTALLS` catches up when the scene draws those parts.
- The air-sealing statement says the air "stays cleaner", not "healthier": a health claim was left out in the tidy (owner approved).
- ⚠️ **R189 stale cell:** the tracker says the parked savings components "stay in the code, unmounted"; commit `e21caa6f1` deleted them on 2026-11-02. Proposed cell fix: "deleted 2026-11-02 (e21caa6f1); the Benefits build recovers what it needs from git" (this build needs none of them).
- The calculator's source-tag vocabulary (`STORY_COPY.tags`, `SOURCE_TAG_CLASSES`) stays in the calculator; the "?" panel has its own feature-local tags until a second consumer justifies promoting them.
- Differences from the studies page: the "Runs less, lasts longer" statement is withdrawn (§3.3); the page's "Draft" markers do not ship (the statements are approved with this spec).
