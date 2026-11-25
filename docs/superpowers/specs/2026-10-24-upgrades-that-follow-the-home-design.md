# Upgrades that follow the home (TS3b.4a): design

**Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md`, §2 rows TS3b.4, TS3b.4a and TS3b.4b; requirements R35–R37, R46, R47, R50, R51, R61, R63–R67, R77, R78, R84–R95 (R60 and R92 belong to TS3b.4b).
**Branch:** `feat/trade-scenes-foundation` (worktree `.worktrees/trade-scenes`). Lab page `/dashboard/labs/trade-scene`.
**Builds after:** the glass-HUD layout (`docs/superpowers/specs/2026-10-23-trade-scene-layout-design.md`, plan `docs/superpowers/plans/2026-10-23-trade-scene-layout.md`) *(owner)*, finished on 2026-10-24 at `150d5aedb`, and TS3b.3, which is built.
**Inputs picked on:** the "Trade Scene Layout Studies" page, round 3 (private artifact `https://claude.ai/artifact/SdisF1HyuQxzVModw4N2oP`). That page sets the minimum visual standard for the inputs.
**Status:** approved by the owner on 2026-10-24, with the four §11 recommendations taken. Stress-tested on 2026-10-25; the owner's rulings from it are §11.5–§11.8, and they supersede §11.4.

Marks used below: *(owner)* is the owner's decision; *(Claude's call)* is a decision made while writing, for the owner to check. Anything unmarked follows directly from the code or from an owner ruling already in the tracker.

---

## 1. Intent

In the meeting, the homeowner should see *their* home as it is today: the roof as old as it really is, single-pane windows, faded water-based paint, crushed ducts, a tired condenser. Then they watch the Tri Pros build put the better part in its place. The upgrade reads as an upgrade because today's part visibly looks its age *(owner, R36)*.

The rep gets there fast. The build era fills in a first guess for every material, and the rep corrects only what the homeowner knows ("the roof was redone about eight years ago"). The rep enters **condition**, not age, because that is what comes up in conversation. Each material has its own age bands, so the condition also tells how old the part is *(owner, R84, R85)*.

The Tri Pros build then offers a replacement for any part that is not New. It also says whether that replacement **saves energy** (an inefficient material becomes an efficient one) or is **like for like** (the same material, new, which only ends upkeep) *(owner, R87)*. Monthly upkeep follows each material's condition, so a failing roof costs more to keep up than a good one *(owner, R88)*.

The owner asked for this to be built cleanly and to scale: **one table describes every material**, and adding a material later means adding one entry, not new wiring *(owner, R86)*.

## 2. Goals, non-goals, anti-goals

**Goals**

1. A **condition** for every material the home has today, on five steps: New, Good, Fair, Worn, Failing. The rep picks it. The age follows from that material's bands (§4.2) *(owner, R84, R85)*.
2. The **build era's first guess** for each material and its condition. Picking another era refills only what the rep has not set *(owner, R86)*.
3. **Offers that follow the home.** Any part below New can be replaced; energy savings come only from an inefficient → efficient change; a like-for-like replacement saves upkeep only *(owner, R87)*.
4. **Upkeep by condition** in Upkeep & Bills and in Savings *(owner, R88)*.
5. New things the Tri Pros build can swap on the house:
   - single → double pane windows (R46);
   - water-based → Cool Life paint (R47);
   - original → R-6 silver flex ducts, with R-8 as a step up (R90);
   - a high-efficiency system replacing the split system or the package unit, with the AC at its size (R89);
   - crawl space insulation between the floor joists, with its thermal paint (R77, R93);
   - Owens Corning shingle colours on a new shingle roof (R91).
6. **Every existing part looks its condition** on the house, so the Tri Pros build visibly replaces it (R36).
7. **The inputs the owner picked** (§6, R94): one list of materials in Current materials, each with five condition dots; the Upgrades list grouped by system, with icons and a Saves energy / Like for like mark.
8. **A camera low enough** to present the crawl space section on a raised home in Partly open (R93).

**Non-goals**

- **The up-close screens** (roof system, attic system, window system, crawl space system). They are TS3b.4b (§10).
- **Saving the new inputs** to a customer or a meeting. They live in the scene for now and are saved with TS4 *(owner, R95)*. They are shaped so saving them later needs no renaming (§4.5).
- **Follow-ups the owner logged:** gamifying the walkthrough (R96), a wear timelapse (R97), AC size from the home's size (R98).
- **Condition changing a heat figure.** Heat follows the material only. A failing single pane and a good single pane let the same heat through *(owner, R87)*. `scripts/verify-trade-scene.ts:529-534` already asserts that worn and installed parts give the same heat, and it stays.
- **Stories and a garage** (R80): their own modeling phase.

**Anti-goals** (failure even if it technically works)

- **Clunky inputs** (R67): a row of segmented buttons per material, a second control per row for age, or labels piling up. The owner's pick (§6) is the bar: one row per material and five dots.
- **Offering energy savings for like for like.** A new double pane over an old double pane must never move the electric or gas bars.
- **Era guesses overwriting what the rep set with the homeowner.**
- **A savings or warranty claim the product terms do not back.** The Cool Life copy (R61) and the Owens Corning facts (§7.6) are checked before release.

## 3. Words

**Condition** is the word the owner and the reps use, and the word on screen. In `CONTEXT.md` it is already taken: **Part condition** (`retained | worn | absent | installed`, shown Kept / Original / Missing / New, `CONTEXT.md:123`) owns it, and two other entries say to avoid the word because Part condition owns it.

*(owner, 2026-10-24)*: on screen the new concept is **Condition**; in code and in the glossary it is **Wear**, with the steps `new | good | fair | worn | failing`. This follows the existing pattern where the screen says "layer" and the code says "part" (`CONTEXT.md:121`). Part condition stays as it is. A part with wear `new` is Part condition `retained`; any other wear is `worn` (§4.3).

Other new terms, agreed with the spec and entered in `CONTEXT.md`:
- **Age bands:** the years each wear step covers for one material.
- **Era guess:** what the build era assumes for a material the rep has not set. The code already has `Basis = 'era-typical'` for this (`CORE/types.ts:39`), and the glossary entry for Basis covers it.
- **Saves energy / Like for like:** the two kinds of offer (R87).

Path prefixes used below: `F/` = `src/features/trade-scenes/`, `CORE/` = `src/shared/modules/construction/core/`.

## 4. The model

### 4.1 One table of home materials

A new construction-core constant, **`HOME_MATERIALS`** (`CORE/constants/home-materials.ts`), describes every material the home has today. Its key is `HomeMaterialId`:

| Id | On screen | Trade (for upkeep and bill cuts) | Assembly and parts it draws | Shown when |
|---|---|---|---|---|
| `roof` | Roof & gutters | `roof-and-gutters` | `roof-attic`: covering, deck, gutter, drip edge, underlayment | always |
| `attic-insulation` | Attic insulation | `attic-and-basement` | `roof-attic`: attic-insulation | always |
| `windows` | Windows | `windows-and-doors` | `windows` (new, §4.4) | always |
| `exterior-paint` | Exterior paint | `exterior-paint-stucco-and-siding` | `exterior-wall`: paint | always |
| `heating-cooling` | Heating & cooling | `hvac` | `hvac-attic`: air handler, condenser, package unit | always |
| `ducts` | Ducts | `hvac` | `hvac-attic`: duct runs | the system is central or a package unit |
| `crawl-insulation` | Crawl space insulation | `foundation-and-crawl-space` | `crawl-space`: floor insulation | the foundation is raised |

*(owner, R94)*: the roof and the gutters are **one material** with one condition. Gutters or none is a choice inside it.

**The existing roof is never cool** *(owner, 2026-10-25)*: cool roofing is newer technology, so a home's roof today is always the regular covering of its type. The roof has no surface option; its type is identified, and only its condition is rated.

**Crawl space insulation belongs to the foundation system** *(owner, 2026-10-25, a business rule)*. A foundation is slab, raised (a crawl space) or, later, a basement. The crawl space is the coldest space in the home, and insulating it is a real efficiency upgrade. Its trade is `foundation-and-crawl-space` even where the Notion catalog still files the scope under Attic & basement; the catalog follows later.

Each entry holds:
- **its options** (for example the window's single / double, the paint's regular / cool), and for each option whether it is the **efficient** one (R87);
- **its age bands** per option, as four boundaries in years (§4.2);
- **its era guess** per `YearBuiltRange`, where the material has one (§4.3);
- **its upkeep trade**, which `REPAIRS_PER_YEAR` and the bill cuts are keyed by;
- **the parts whose look follows its wear**;
- **when it applies** (a raised foundation, a ducted system);
- **its copy keys**, which point into `F/constants/home-scene-copy.ts` (UI strings stay in the copy file).

Readers of the table:
- the Current materials list (§6.1);
- the existing-conditions inferrers (§4.3);
- the Upgrades offers (§5);
- the upkeep figure (§5.3);
- the verify script.

Nothing else may list materials by hand. The table holds data only; the logic that reads it lives in pure functions under `CORE/lib/` or `F/lib/` *(Claude's call)*. The table lives in construction core because the bands and the era guesses are rules about real homes, which a proposal or a customer profile can later use without the scene *(Claude's call)*.

### 4.2 Wear, age bands and age

`Wear = 'new' | 'good' | 'fair' | 'worn' | 'failing'` (`CORE/constants/enums.ts`, or wherever `roofTypes` lives).

Age bands *(owner, R85; the owner set paint and asphalt shingle, approved the rest)*. Each band starts at the first year and runs up to, but not including, the next:

| Material (option) | New | Good | Fair | Worn | Failing |
|---|---|---|---|---|---|
| Exterior paint | 0–3 | 3–6 | 6–10 | 10–15 | 15+ |
| Asphalt shingle (regular or cool) | 0–5 | 5–10 | 10–15 | 15–20 | 20+ |
| Tile (the underlayment is what wears) | 0–10 | 10–20 | 20–28 | 28–35 | 35+ |
| Wood shake | 0–5 | 5–12 | 12–18 | 18–25 | 25+ |
| Torch down | 0–4 | 4–8 | 8–12 | 12–18 | 18+ |
| Metal | 0–10 | 10–25 | 25–40 | 40–50 | 50+ |
| Windows | 0–5 | 5–12 | 12–20 | 20–30 | 30+ |
| Heating & cooling | 0–3 | 3–8 | 8–12 | 12–15 | 15+ |
| Ducts | 0–5 | 5–10 | 10–15 | 15–20 | 20+ |
| Attic insulation | 0–5 | 5–15 | 15–25 | 25–35 | 35+ |
| Crawl space insulation | 0–5 | 5–10 | 10–15 | 15–25 | 25+ |

The roof's bands follow its covering type, and the gutters share the roof's wear *(owner, R94)*. The gutter bands from the brainstorm (0–5, 5–10, 10–18, 18–25, 25+) are not used while the gutters share the roof's condition.

Two pure functions:
- `wearForAge(bands, years)`;
- `ageBandOf(bands, wear)` → `[from, to | null]`, for the "Good · 5–10 yrs" text.

A home's age comes from its era. Each `YearBuiltRange` gets a typical build year: Pre-1950 → 1945, 1950-1978 → 1964, 1978-1998 → 1988, 1998-2014 → 2006, Post-2014 → 2019. The age is the current year minus that year, so the guess ages with the calendar *(Claude's call)*. An unknown era uses `ERA_FALLBACK` (`CORE/constants/era-defaults.ts:5`), as the inferrer does today.

### 4.3 The era guess, and what the rep sets

**No stored "touched" flag** *(Claude's call, the API the owner asked to be clean)*. The scene stores only what the rep set. Everything else is derived from the era, the same way the existing inferrer turns an unknown `insulationLevel` into the era's level with `basis: 'era-typical'`:

- **A material's option:**
  - set by the rep → used, basis `recorded`;
  - not set (`null`, which is also what "Not sure" sets) → the era's guess, basis `era-typical`.
  - Era guesses *(Claude's calls, approved on the studies page)*:
    - windows: single pane before 1998, double from 1998;
    - attic insulation: `INSULATION_BY_ERA` as it is (`CORE/constants/era-defaults.ts:7`). The levels are whatever `insulationLevels` holds; high is today's `batts-r30` (`roof-attic-inference.ts`, `BATTS_BY_LEVEL`), and no R-38 level is added. The mockup's "High (R-38)" label was wrong *(Claude's call, from the builder check)*. A recorded `'none'` (added in the working tree by another session, 2026-10-25) means the material is absent;
    - exterior paint: always water-based;
    - ducts: original flex before 2014, R-6 silver flex after;
    - crawl space insulation: none before 2014, insulated after.
  - The roof type, the heating & cooling type and its equipment have no era guess. Unknown stays unknown, as today. The roof has no surface to guess: the existing roof is never cool (§4.1).
- **A material's wear:**
  - set by the rep → used;
  - not set → the wear for the home's age (the material is Original), **unless** the material's *replaceable* option resolves to something other than its era guess. In that case the wear is **unset**, shown as "Set its condition": a different material means the part was replaced at some point, so the home's age no longer applies *(owner-reviewed on the studies page)*.
  - **Replaceable options** are the ones with an era guess: windows, attic insulation level, exterior paint, ducts and crawl space insulation. The roof type and the heating & cooling type and equipment are *identified*, not replaced. Setting them, including the `roofType: 'shingle'` that Structure writes for a pitched roof, never makes the wear unset *(Claude's call, from the builder check)*.
  - The test compares *values*, not whether a field was written. A rep who confirms single pane on a 1965 home keeps the era's wear. TS4 facts carried over from the customer profile behave the same way.
  - When the rep changes a replaceable option to a different value, any wear they set for that material is cleared too, since it described the old part *(Claude's call)*.
  - An unset wear counts as Worn everywhere it is read: offers, upkeep, the look and Rain *(Claude's call)*.

So picking another era refills every guess and leaves everything the rep set alone, with no extra code *(owner, R86)*.

"Back to the era guess" clears the wear the rep set and the material's **replaceable** options. It never clears an identified option (the roof type, the system type), so it cannot unset the roof's pitch or block the roof offers *(Claude's call)*. Setting only the wear leaves the option as the era's guess, so a later era change can still change that option. The studies page modelled one combined guess per row; this rule behaves the same in the cases the owner tried.

**Existing conditions:** each assembly's inferrer reads the material's resolved option and wear.
- Wear `new` → Part condition `retained`.
- Any other wear → `worn`.
- A material that is not there (no crawl space insulation, no gutters) → `absent`.

This replaces today's rule that every roof part is worn at every era (`CORE/lib/assemblies/roof-attic/infer-existing-conditions.ts:25-37`). That rule is the claim-risk item in tracker §2a: every home leaks in Rain. Only the roof parts that belong to a material follow it. Ceiling and rafters stay `retained`, and the parts that are absent today stay absent.

*(Claude's call)*: in Rain, the roof leaks only when its wear is Worn or Failing. That holds for the whole scene, so the up-close water flow (`targets.water`) also keeps a New, Good or Fair roof dry, not only the `leak` figure (stress test, 2026-10-25).

### 4.4 Data the assemblies need

New and changed construction data. Parts and materials need names, copy keys and `SCOPE_INSTALLS` entries. Heat figures are unchanged apart from the ducts (§7.2) and the crawl space (§7.3).

- **A new `windows` assembly**, data only, with parts `frame` and `glazing` (`single-pane`, `double-pane`). TS3b.4b adds `gap`, `seals` and `flashing` and gives it its up-close kit. It has no kit in TS3b.4a, so the verify script's kit registration check does not apply to it yet *(Claude's call)*.
- **`exterior-wall` paint:** the existing `standard` and `cool` materials (`exterior-wall.ts:21-23`) are the two options.
- **`hvac-attic`:**
  - a **package unit** form: an outdoor unit on the roof that heats and cools, with no attic air handler, and duct runs in the attic as before. *(Claude's call)*: modelled with the `forms` mechanism that roof parts already use (`forms: ['pitched']`), with forms `split | package`.
  - **Duct runs** materials become `original-flex` (Original, R-4), `r6-silver-flex` (code, R-6) and `r8-flex` (a step up, R-8) *(owner, R90)*. They replace `leaky-flex` and `sealed-insulated`. Every consumer of the old ids moves in the same change (no shims).
- **`crawl-space` floor insulation:** `batts-r19` exists (`crawl-space.ts:10`). It is the insulated option, and "none" is absent.
- **Scopes** that need `SCOPE_IDS` and `SCOPE_INSTALLS` entries. The ids are in the energy-impact epic (`docs/plans/2026-10-21-proposal-energy-impact-epic.md:108-116`):
  - window replacement `3e40ca1b-548b-824d-b0db-81cc10787e73` → glazing `double-pane`;
  - repaint with Cool Life `9d60ca1b-548b-824a-8aef-81f1e29b9b34` → paint `cool`;
  - split system replacement `6450ca1b-548b-830a-ac5e-018e7fd3064a` → high-efficiency air handler and condenser;
  - package unit replacement `9460ca1b-548b-8375-8d63-814dddf36b71` → high-efficiency package unit;
  - air ducts replacement `bc50ca1b-548b-8366-9ef9-811c2f36877f` → duct runs `r6-silver-flex`, with the R-8 step up as an efficiency upgrade option that efficiencyUpgrades the material (the cool roof's `swapsWith` mechanism, `CORE/lib/resolve-assembly.ts:48-70`) *(Claude's call)*;
  - crawl space insulation → floor insulation. **The id is not in code.** The seed has only the accessor `installCrawlSpaceInsulation` (`src/shared/db/seeds/data/scopes.ts:81-82`). The builder reads the id from the scope catalog (Notion or the dev database), read only.

**Every assembly that applies to the home is resolved** *(Claude's call, from the builder check)*.
- Today `resolveScene` resolves only assemblies with a registered up-close kit (`F/lib/resolve-scene.ts:76-79`), and that means `roof-attic` alone. The savings count only trades from resolved assemblies.
- TS3b.4a resolves every assembly that applies: windows, exterior wall, HVAC, crawl space on a raised home, and roof-attic. Each feeds the savings, the swaps in the build and the worn looks.
- The kit stays only for up close.
- The heading still comes from the zoomed assembly, or `roof-attic` when not zoomed.
- `yard-ground` is not resolved: no material in `HOME_MATERIALS` points at it.

### 4.5 Scene inputs

`TradeSceneInputs` (`F/types.ts`) gains *(Claude's call: one slot, shaped like a future customer-profile record so TS4 can save it without renaming)*:

```ts
homeMaterials: {
  wear: Partial<Record<HomeMaterialId, Wear>>         // only what the rep set
  gutters: 'present' | 'none' | null
  exteriorPaint: 'regular' | 'cool' | null
  ducts: 'original-flex' | 'r6-silver-flex' | 'r8-flex' | null
  crawlInsulation: 'none' | 'insulated' | null
  acTons: '3' | '4' | '5' | null                      // strings, as every choice primitive takes
  shingleColor: OwensCorningColorId | null            // the colour of a new shingle roof, §7.6
}
```

The scene's efficiency upgrade options (`efficiencyUpgrades`, replacing `addOns`) start with the cool roof on (§7.6).

The facts already on the customer profile stay on `PropertyProfile`: the roof type, windows, insulation, heating & cooling type and equipment. They are not copied into the new slot, so each fact has one source *(Claude's call)*.

`homeMaterials` joins `SceneResolveInputs` (`F/types.ts:77`) because wear changes what the scene resolves (Part condition, upkeep, offers). `shingleColor` and `acTons` change only the drawing; they still ride in the slot, but they must not re-resolve the scene. They join the drawing-only inputs in the same way `homeView` did (`verify-trade-scene.ts:641-647`).

**The package unit on the shared list** *(owner, 2026-10-24)*: adding `package-unit` to `hvacTypes` (`CORE/constants/enums.ts:34`) puts it on the customer profile everywhere. That covers:
- the text-enum column, which needs no migration (`src/shared/db/schema/customer-profiles.ts:57`);
- `PROPERTY_PROFILE_FIELDS`;
- the meeting-flow context panel;
- the customer profile details.

Each of those gets the new value's label; the plan lists every reader of `hvacTypes`.

## 5. What the Tri Pros build offers

### 5.1 The rule

For each material, the Upgrades list offers the scopes that install its parts. Today's `partOffers` in `F/lib/part-offers.ts` already does this, and it extends to the new assemblies and scopes. The R81 roof rule stays as built: the scopes follow the existing roof type (`SCOPES_BY_EXISTING_ROOF`).

The new rule *(owner, R87)*:
- **Wear New** → nothing is offered. The row reads "Already new", a new `OfferBlockedReason`.
- **Wear unset** → offered as if Worn *(Claude's call)*.
- **Any other wear** → offered.
- **Heating & cooling:** a wall unit or a portable gets nothing yet ("Nothing offered for a wall unit yet") *(Claude's call)*.

### 5.2 Saves energy or like for like

Each pick is marked **Saves energy** when it changes the existing material from an option `HOME_MATERIALS` marks inefficient to one it marks efficient. Otherwise it is **Like for like** *(owner, R87)*. The rule lives in one pure function, `offerKind(material, existingOption, installedOption)`.

| Material | Inefficient → efficient |
|---|---|
| Roof | regular → cool. The existing roof is never cool (§4.1), so a cool install always saves energy; a regular install (cool switched off, §7.6) is like for like |
| Attic insulation | anything below R-38 → R-38 (high is R-30, so high → R-38 still saves a little); a home can't be recorded with R-38 today, so the top-off and replacement always save energy *(Claude's call)* |
| Windows | single → double |
| Paint | regular → Cool Life |
| Ducts | original → R-6 or R-8, and R-6 → R-8 |
| Heating & cooling | standard → high efficiency. Today's system is always taken as standard (there is no existing-efficiency input), so a system replacement always saves energy *(Claude's call)* |
| Crawl space insulation | none → insulated |

Radiant barrier is absent today, so adding it always saves energy, through its own add-on cut (§5.3). Air sealing moves no bill: the energy-impact epic lists air-leak sealing as not bill-cutting.

### 5.3 Savings and upkeep

`sceneSavings` (`F/lib/scene-savings.ts:52-68`) changes in two ways:

1. **A trade's bill cut counts only when one of its landed scopes saves energy.**
   - Today it counts whenever the trade lands. That is wrong once a like-for-like pick can land.
   - The cut figures stay in `TRADE_BILL_CUTS`.
   - Windows, paint and heating & cooling can save from now on, because their scopes now install parts.
2. **Upkeep follows wear** *(owner, R88)*:
   - `REPAIRS_PER_YEAR` is the Worn figure;
   - Good is 40% of it, Fair 70%, Failing 150%, New 0;
   - unset counts as Worn *(Claude's call)*.

   A landed trade's upkeep is credited at the existing material's wear. `repairsFigure` (`F/lib/repairs-figure.ts`) takes the wear per trade. A typed amount still wins, as today.

**Cuts and upkeep per material, not per trade** *(Claude's calls, from the builder check)*. The system and the ducts share the `hvac` trade, so the trade alone can't say what a pick saves:

- **Bill cut by material.**
  - The heating & cooling system's replacement counts `TRADE_BILL_CUTS.hvac`'s base, 25% electric and 20% gas.
  - The ducts count the existing `ducts` add-on, +5 / +5 (`CORE/constants/trade-bill-cuts.ts:5`), and only that.
  - A ducts-only pick moves the bills by 5 / 5; the system and the ducts together move them by 30 / 25.
  - The other materials map one to one onto their trade's cut.
  - **Crawl space insulation** gets a working number of its own, 2% electric and 5% gas, as `TRADE_BILL_CUTS['foundation-and-crawl-space']` *(owner, 2026-10-24)*. It carries no upkeep. The ROI calculator reads the same table, so it shows the same figure for that trade; `scripts/verify-remodel-roi.ts` must still pass.
  - `combineCuts` is fed per material.
- **Upkeep by material.**
  - The $600 `REPAIRS_PER_YEAR.hvac` figure belongs to the heating & cooling system and follows the system's wear.
  - Ducts carry no upkeep, so a ducts-only pick credits none.
  - The "Heating & cooling" row in Upkeep & Bills reads the system's condition.
- **One rule for the scene and the proposal: count what's installed** *(owner, 2026-10-25)*. Construction core holds the rule, and the energy-impact epic adopts it when it lifts the slice, in place of its own `addOnsOnly` and "ducts always on" rules:
  - a system alone cuts 25% electric / 20% gas;
  - ducts alone +5 / +5, and both together 30 / 25;
  - radiant barrier alone its own add-on cut, electric 5 / gas 2 (the epic's figure, EI-D16, EI-D18), so `radiant-barrier` joins `BILL_CUT_ADD_ON_IDS`;
  - a redeck alone nothing (it only goes with a tear-off, torch down or tile reset, layout D18, and the covering carries the cut).
- **The cool roof folds into the roof's own cut** *(owner, EI-D25, 2026-10-22; confirmed 2026-10-25)*. `TRADE_BILL_CUTS['roof-and-gutters']` becomes `{ base: { electric: 8 } }`, `cool-roof` leaves `BILL_CUT_ADD_ON_IDS`, and the ROI calculator's cool-roof switch goes. In the scene the cool roof is an efficiency upgrade option, not a bill-cut add-on: a cool covering earns the roof's base cut because it saves energy over the existing roof.
- The energy-impact tracker (main checkout, `docs/plans/2026-10-21-proposal-energy-impact-epic.md`) is told of both rulings; the worktree's copy of that file predates EI-D25.

## 6. The inputs (owner's pick, R94)

The layout build's components are the base. TS3b.4a changes what they hold, not the panel's shell. The studies page, round 3, is the visual floor.

### 6.1 Home › Current materials

`MaterialsSection` (`F/ui/components/panel/materials-section.tsx`) becomes **one list, one row per material** in `HOME_MATERIALS` order that applies to this home.

- **A sticky header** above the list carries the five condition columns. Only **New, Fair and Failing** are labelled; Good and Worn are small marks, so every dot lines up under its step *(owner)*.
- **Each row:**
  - **left, the name:**
    - line 1: the material's name with a chevron;
    - line 2: what it is ("Shingle, regular · gutters", "Central · 4 ton");
    - line 3: the condition and its band ("Good · 5–10 yrs"). It reads "Set its condition" when the wear is unset and "Nothing to rate" when the part is absent.
  - **right, five dots**, one per wear step, a radio group:
    - each dot is coloured by its step;
    - the picked dot is filled;
    - a dashed dot is the era's guess;
    - there is **no "era guess" text** *(owner)*.
  - **Tapping the name** opens the row in place, as the layout's tray rows do, showing the material's choices:
    - **roof:** the roof material tray and a Gutters pair (no surface: the existing roof is never cool);
    - **heating & cooling:** system tray with Package unit, an Equipment pair (central only), and an AC size pair 3 / 4 / 5 ton (when there is an AC or a package unit);
    - the others: their option pair or tray.

    Under the choices sits a quiet "Back to the era guess" link, shown only when the rep set something.
- **Keys:** each dot group is a radio group with arrow keys. Each dot's label names the material, the step and its years ("Roof & gutters: Good, 5–10 years").
- The layout's field primitives (`F/ui/components/fields/`) draw the choices. The dots, the header and the row are new components *(Claude's call: `WearDots`, `WearHeader`, `MaterialRow`; the builder may rename)*.

Phone and iPad portrait follow the layout spec's card. The list must fit a 372 px card without wrapping a row: name column at least about 150 px, dots 5 × 36 px.

### 6.2 Living situation › Upkeep & Bills

The rows built by `repairsRows` (`F/lib/repairs-rows.ts`):
- add the material's condition to their note ("Shingle · Worn");
- take their faded working number from the wear (§5.3);
- give exterior paint a note.

The total follows.

### 6.3 Tri Pros build › Upgrades

`ScopesAndAddons` (the layout's renamed receipt):
- **groups its rows by system:** Roof & gutters, Attic, Windows, Walls, Heating & cooling, Foundation *(Claude's call, approved on the studies page; Foundation replaces Crawl space, owner 2026-10-25)*. **System** is the owner's word for these groups (the roof system, the HVAC system, the window system, the foundation system), the same systems TS3b.4b gives up-close screens;
- each row gets **an icon** in a soft tile that turns success-green once a pick is made *(owner)*. The icon set, one per row, is drawn in the studies page: roof covering, deck, gutters, radiant barrier, insulation, air sealing, windows, paint roller, a fan for heating & cooling, ducts, crawl space joists. The builder draws them as lucide-style 24 px stroke icons. Use lucide where a fitting icon exists *(Claude's call)*;
- a picked row shows the verb and a **Saves energy** (success tint) or **Like for like** (muted) mark, and each option in the open row shows its own mark;
- a New part shows "Already new";
- today's state on each row reads the material and its condition ("Single pane · Failing").

## 7. The drawing

### 7.1 Every part looks its wear (R36)

- **A continuous worn amount.** Wear becomes an amount from 0 to 1: New 0, Good 0.25, Fair 0.5, Worn 0.75, Failing 1. It drives the look that today switches on `worn: boolean` (`F/lib/part-state.ts:11-14`).
- **Parts that already have worn tones** blend by the amount: covering, deck, gutter, insulation (`F/constants/home-palette.ts:13-21, 44-52`). The shingle layout's missing and lifted tabs scale with it (`F/lib/shingle-layout.ts:24-33`).
- **Parts that gain a worn look:**
  - windows: a weathered frame and duller glass;
  - exterior paint: faded and chalky, with hairline cracks from Worn;
  - condenser or package unit: a faded, dusty case;
  - ducts: dull grey, sagging, crushed in places, against the new runs' bright silver;
  - crawl space insulation: sagging batts.
- **How each look is achieved, and how strong it is, is the builder's call.** Tune it by screenshot with the owner. The Tri Pros build always draws the new part at amount 0.

### 7.2 Swaps in the Tri Pros build

- **Windows:** `resolve-scene.ts:84` passes the profile's windows to both builds. It reads the `windows` assembly's resolved glazing instead, so the build swaps them. `HouseShell` (`F/ui/components/home-kit/house-shell.tsx:73`, prop `windowsType`) gets the same resolved value, not the profile.
- **Paint:** `resolve-scene.ts:85` hard-codes `paint: 'regular'`. It reads the resolved `exterior-wall` paint instead. Existing paint comes from `homeMaterials.exteriorPaint` or the era guess. The walls draw Cool Life as a slightly brighter, cleaner stucco *(Claude's call; the colour is the builder's, tuned by eye)*.
- **Ducts:** original runs are dull and slack. New R-6 and R-8 runs are bright silver reflective flex. R-8 reads thicker than R-6.
  - The heat table gets a duct entry so new ducts lower the attic-side heat on the HVAC lane *(Claude's call)*.
  - If the table has no natural place for it, ducts change the look and the bill cut only. The builder reports which.
- **Condenser size (R89):** the GLB's scale follows `acTons`. 3, 4 and 5 ton read as visibly different sizes; the factors are tuned by eye. An unset size draws today's size.
- **Package unit (R89):** a low rectangular unit on the roof, sized like the condenser by `acTons`, with no ground condenser and no attic air handler. On a low-slope roof it sits on the flat roof; on a gable it sits on the near or far slope where the camera reads it. A code-built stand-in is fine, as with other props (TS3 asset rule).
- **Shingle colour (R91):** a new cool shingle covering in the Tri Pros build draws in the picked Owens Corning colour. With none picked, or with the cool roof switched off, it keeps today's new-shingle tone. Today's roof keeps its worn tone.

### 7.3 The crawl space (R77, R93)

- **Insulation:** batts between the floor joists, visible in Partly open on a raised home.
- **Thermal paint** (R77, hand-tuned, R43):
  - summer afternoon: about 72 °F inland and 68 °F coastal;
  - winter night: about 50 °F inland and 53 °F coastal;
  - Normal sits between.
  - The foundation wall's outside face reads as outside air.
  - Paint only, no reading pin.
  - Insulation changes the floor-side colours, not the crawl air *(Claude's call)*.
- **The camera** *(owner, R93)*: on a raised home in Partly open, the orbit may go low enough to look into the open crawl section.
  - *(Claude's call)*: the camera never goes below the ground plane. Its target may drop to the crawl space's height.
  - Opening the Crawl space insulation row (in Current materials or Upgrades) eases the camera to a crawl framing, the existing `under-floor` anchor (`F/constants/home-anchors.ts:35-38`) or a new one. Closing the row eases it back.
  - This touches the layout build's camera inset (layout spec §4.1). Read that code before changing the rig.

### 7.4 What stays

Heat figures, readings and lanes follow the material, not the wear (§2). Rain follows §4.3.

### 7.5 Copy

New strings go in `F/constants/home-scene-copy.ts`. The paint claims (R61: water-based "cracks and fades within 8 years"; Cool Life "reflective, great energy reduction, lifetime warranty") **are not used** until they are checked against the Cool Life product terms. Until then the copy stays factual ("Cool Life reflective paint", "Water-based paint") *(Claude's call)*.

### 7.6 Owens Corning shingles (R91)

Research, 2026-10-24:
- colours offered at a Reseda, CA ZIP;
- CRRC 3-year aged SRI;
- hex values are the mean of Owens Corning's swatch photos, so screen approximations only;
- the full notes, with sources, initial and aged reflectance and emittance, CRRC ids, specs and warranty, are in `/home/olis-solutions/.claude/projects/-home-olis-solutions-olis-v3-nextjs-tri-pros-website/73594fcd-6f93-4bac-ac66-ecb83bf4d084/owens-corning-duration-cool-research.md` (outside the repo; to move into `docs/` if the owner wants it kept). The builder copies the table below into a construction-core constant `OWENS_CORNING_SHINGLES` with name, hex, aged SRI and line.

| Line | Colour | Approx hex | Aged SRI |
|---|---|---|---|
| Duration COOL | Amber | #A79789 | 24 |
| | Forest Brown | #685347 | 17 |
| | Mojave | #8D7159 | 18 |
| | Mountainside | #5E5F5D | 19 |
| | Night Sky | #4A474A | 16 |
| | Oyster Shell | #ABA6A0 | 24 |
| | Sand Castle | #8D7D6B | 17 |
| | Shasta White | #B1B1AE | 29 |
| | Sierra Gray | #959794 | 20 |
| | Summerwood | #686359 | 17 |
| Duration COOL Plus | Cliffside Gray | #807E72 | 21 |
| | Copper Trail | #745E52 | 22 |
| | Golden Meadow | #A68B6A | 22 |
| | Midnight | #5E5A5B | 20 |
| | Mystic Gray | #757D7D | 23 |
| | Prairie Wood | #836C59 | 21 |
| | Rolling Stone | #676161 | 22 |

**What the research found:**
- every colour meets the Title 24 steep-slope cool-roof minimum (aged SRI 16);
- all COOL Plus colours and four COOL colours (Amber, Oyster Shell, Shasta White, Sierra Gray) reach SRI 20, which Owens Corning's June 2025 bulletin says the City of LA and unincorporated LA County require;
- specs and warranty are the same for both lines;
- neither line lists algae resistance.

**Before anything customer-facing:**
- the climate zones for the reroof rule disagree between Owens Corning's bulletin (10–15) and CRRC's chart of the 2025 code (4 and 8–15);
- the SRI 20 LA rule is Owens Corning's statement, not checked against the LA code.

**The cool roof is an upgrade, on by default** *(owner, 2026-10-25; supersedes the 2026-10-24 "a shingle install is always cool" and §11.4)*:
- every shingle and torch down pick starts cool, because the scene's `efficiencyUpgrades` start with `cool-roof`; the `coolRoofSettled` seeding goes;
- the rep can switch it off on either, to show the inefficient material; a regular roof over the existing regular roof is like for like and moves no bill;
- the chip (`F/ui/components/panel/cool-roof-chip.tsx`, generalised into one efficiency upgrade chip that the R-8 step up also uses) shows on shingle and torch down picks, as layout D22 had it.

**In the covering row:** when a pick installs shingles (overlay, or tear-off) with the cool roof on, the open row shows:
- a slim pair, Duration COOL / Duration COOL Plus;
- a grid of swatches;
- under the grid, the picked colour's name and "Aged SRI 24: meets Title 24 and the City of LA's 20".

With the cool roof off, the colour grid is hidden: every Owens Corning colour here is a cool shingle *(Claude's call)*.

## 8. Verification

The builder adds these to `scripts/verify-trade-scene.ts`, or to the layout's `scripts/verify-trade-scene-layout.ts` where it fits.

- **Bands:**
  - every material has five ordered bands;
  - `wearForAge` and `ageBandOf` agree at every boundary;
  - paint at 10 years is Worn;
  - shingle at 20 is Failing.
- **Era guess:**
  - an all-unknown home of each era resolves;
  - changing the era changes every unset material and no set one;
  - "Not sure" equals the era guess;
  - changing an option clears the wear to unset.
- **Part condition:**
  - wear New gives `retained`;
  - other wear gives `worn`;
  - a Post-2014 home with no roof wear set is Good or New, with the roof type set or not, so it no longer leaks in Rain (the §2a claim-risk item);
  - setting the roof type, or Structure's pitched → shingle write, never makes the roof's wear unset;
  - "Back to the era guess" on the roof leaves `roofType` alone.
- **Offers:**
  - a New material offers nothing ("Already new");
  - each R81 roof still offers exactly its set;
  - a wall unit offers no system.
- **Saves energy:**
  - double over single saves energy;
  - double over double is like for like and moves no bill;
  - like for like credits upkeep at the existing wear;
  - a Failing roof's upkeep is 1.5 × its working number.
- **Heat:** wear never changes a heat figure (the existing assertion, extended to the new parts).
- **Inputs:** `homeMaterials` joins the resolve inputs, and `shingleColor` and `acTons` do not re-resolve.
- **Registry:**
  - every `HomeMaterialId` has copy keys, a trade and at least one part;
  - every new scope id has a `SCOPE_INSTALLS` entry;
  - no three.js in `lib/`, `constants/` or `types.ts` (exists).
- **Screens:** a screenshot round over the worn looks, both builds, Complete and Partly open, raised and slab, and the crawl camera, at 1024, 1280 and iPad portrait.

## 9. Files (expected; the plan settles them)

**Create**
- `CORE/constants/home-materials.ts`
- `CORE/constants/owens-corning-shingles.ts`
- `CORE/constants/assemblies/windows.ts`
- `CORE/lib/wear-for-age.ts` and `CORE/lib/age-band-of.ts`
- `F/lib/offer-kind.ts`
- the condition list components (§6.1)
- the scope icons
- the worn-look helpers for the new parts
- the package unit prop

**Change**
- `CORE/constants/enums.ts` (`Wear`; `package-unit` on `hvacTypes`)
- `CORE/types.ts`
- `CORE/constants/assemblies/{hvac-attic,crawl-space,index}.ts`
- `CORE/constants/scope-ids.ts` and `scope-installs.ts`
- `CORE/constants/trade-bill-cuts.ts`
- the roof-attic inferrer, plus new inferrers per assembly
- `F/types.ts`
- `F/constants/home-scene-defaults.ts`
- `F/constants/home-scene-copy.ts`
- `F/lib/resolve-scene.ts`
- `F/lib/scene-savings.ts`
- `F/lib/repairs-figure.ts` and `F/lib/repairs-rows.ts`
- `F/lib/part-offers.ts`
- `F/lib/part-state.ts`
- `F/constants/home-palette.ts`
- `F/constants/home-heat-figures.ts` (ducts, crawl space)
- the home kit files for the shell, roof, equipment, condenser, ducts and foundation
- the camera rig
- the materials section and the scopes-and-addons components
- `scripts/verify-trade-scene.ts`
- `CONTEXT.md`, after the owner agrees the terms

**Shared files outside the feature, which the owner OKs in the spec approval:**
- `CORE/` construction core;
- `src/shared/modules/construction/core/constants/enums.ts` (`hvacTypes`), and the readers of `hvacTypes` outside the feature: `PROPERTY_PROFILE_FIELDS`, the meeting-flow context panel and the customer profile details;
- `CORE/constants/trade-bill-cuts.ts`, which the ROI calculator also reads (§5.3).
- `CORE/constants/bill-cut-add-ons.ts` and the ROI calculator's cool-roof switch (its form schema, defaults, trade row, projection, story basis, assumptions sheet and types), plus `scripts/verify-remodel-roi.ts`: the cool-roof fold the owner ruled in EI-D25 (§5.3, §11.6).

## 10. TS3b.4b, recorded for its own brainstorm (R92)

Decided by the owner on 2026-10-24, not designed here:
- Four up-close screens:
  - **roof system:** the covering down to the deck and rafters, plus drip edge, ridge vent and gutters, with no ceiling or insulation;
  - **attic system:** ceiling, air sealing, insulation, radiant barrier. Today's single roof & attic screen splits in two along the parts' existing `group: 'roof' | 'attic'` tags, and the radiant barrier moves to attic. *(Claude's call: rafters stay with the roof system.)*
  - **window system:** new; frame, glass, the gap between the panes, seals, flashing;
  - **crawl space system.**
- Replace versus top off of the attic insulation is compared up close (R60).
- Heating & cooling and paint up close come later, if at all.
- **The foundation system** *(owner, 2026-10-25)*: the vapor barrier on the crawl space floor, work on the foundation itself, and the basement as a third foundation type come later, each with its catalog scope, its look and its bill cut. TS3b.4a ships only crawl space insulation up to R-19.

## 11. Decided by the owner

Raised after the builder check and decided on 2026-10-24, each as recommended:

1. **The word:** "Condition" on screen; **Wear** (`new | good | fair | worn | failing`) in code and in `CONTEXT.md` (§3).
2. **Package unit:** on the shared `hvacTypes` list, so the customer profile holds it (§4.5).
3. **Crawl space insulation's bill cut:** a working number of 2% electric and 5% gas until the team has a figure (§5.3).
4. ~~**Cool roof toggle:** none on shingle installs, which are always cool; it stays for torch down.~~ Superseded by 6.

Decided in the plan's stress test, 2026-10-25:

5. **The existing roof is never cool:** cool roofing is newer technology, so the home's roof today is always regular (§4.1).
6. **The cool roof is an upgrade, on by default,** on shingle and torch down picks; the rep can switch it off to show the inefficient material (§7.6). Its bill cut is the roof's own base cut, electric 8, as EI-D25 ruled (§5.3).
7. **Count what's installed:** one bill-cut rule in construction core for the scene and the proposal (§5.3).
8. **The foundation system:** crawl space insulation's trade is `foundation-and-crawl-space`, whatever the catalog says today; TS3b.4a ships crawl insulation only, and the vapor barrier, foundation work and basement come later (§4.1, §10).
