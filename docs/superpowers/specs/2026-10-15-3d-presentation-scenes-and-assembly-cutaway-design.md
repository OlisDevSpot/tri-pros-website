# 3D trade scenes + the assembly cutaway

Status: design approved in conversation 2026-10-15; stress-tested 2026-10-15 (four lenses, 31 findings) and amended with the owner's rulings (D16–D21). Foundation (phases 0–2 and look-dev) built 2026-10-16; what it settled and what stays open is in §12.
Replaces the 2026-10-11 scoping spec (`meeting-wow-cutaway-and-sun-energy`), which was never committed to main; its still-open ideas are in §11.
Prototype: branch `feat/meeting-cutaway-prototype` (`63ccc3f6a`), a roof + attic cutaway on a labs route. Phase 0 brings it into main as-is behind a super-admin gate (D19); phase 3 rebuilds it on the tiers below and deletes it.

## 1. Intent

**What it is for.** In the living room, the agent opens a 3D cutaway of a trade's work and uses it to **justify the scope and the price**: every part we install is visible, named, and tied to the scope that installs it, and the heat (or water) it stops is visible too. The homeowner sees why our proposal includes what a cheaper bid skips.

**The broader goal.** This is the first **trade scene** on shared **scene primitives**. The concept those primitives serve: typed inputs drive the scene, and the scene and its panel morph smoothly whenever an input changes. Later 3D work (more assemblies, Sun & Energy, a configurator) reuses the primitives, never forks them.

**Who drives it.** The agent, on an iPad Pro (M-series), in front of the homeowner. The homeowner watches; nothing here is homeowner-operated.

## 2. Decisions (owner, 2026-10-14 → 15)

| # | Decision |
|---|---|
| D1 | The cutaway's job is to justify scope and price. Parts map to the scopes that install them. |
| D2 | Five trades must be expressible by the model: `roof-and-gutters`, `attic-and-basement` (attic and crawl space), `exterior-paint-stucco-and-siding`, `dryscaping`, `hvac` (incl. ducts). The crawl space also belongs to `foundation-and-crawl-space` (D17). Only roof + attic get a scene kit now. |
| D3 | Energy is the story: heat crossing the assembly, with a **Summer / Winter** toggle. Dryscaping tells a **water** story instead. |
| D4 | Savings are shown as **estimates in dollars**, anchored to a bill the agent **types in the cutaway** (not saved). |
| D5 | Figures come from the **Remodel ROI calculator's** single estimated %, moved to the construction module ("core constants, for now") and imported by both. Where meeting copy disagrees, the copy changes. Recorded as the sales-calculators tracker's D9 ruling for the savings figures. |
| D6 | A fourth cost, **repairs and upkeep** (sprinkler heads, touch-ups, handyman, refrigerant top-ups, leak repairs), joins electric / gas / water. One source with the ROI calculator's repairs (§4.2). |
| D7 | **Every number is overridable** with sensible defaults, the ROI calculator's way. |
| D8 | Disclaimers are small: an asterisk that opens a popover on tap. |
| D9 | Opened from the trade on step 2 Specialties; full screen; returns to the same spot. No new meeting step. |
| D10 | Scope chips in the cutaway are **preview only**; the meeting's trade selection changes only on Specialties. |
| D11 | Heat look = **thermal-camera paint + heat-flow narrowing**, the flow drawn as glowing 3D ribbons, never flat arrows. |
| D12 | Model look = **premium architectural model** (true materials, soft studio light, restrained colour, emphasized part in full colour). |
| D13 | Renderer = **WebGL**; the look-dev page carries one **WebGPU** option for comparison. |
| D14 | Architecture = **registry + part kits** on shared scene primitives (§4). |
| D15 | `TradeSlug` comes from construction P2 plan 1 Task 3, landed first as ruled in D16 (no interim string keys). |
| D16 | P2 Task 3 (ruled 2026-10-15): one generator writes `core/constants/trade-slugs.ts`; **no** `verify-catalog-keys.ts`. Scope ids cannot be type-checked, so this work owns its own live check, `scripts/verify-scope-installs.ts`. |
| D17 | The `crawl-space` assembly belongs to **both** `attic-and-basement` (floor insulation) and `foundation-and-crawl-space` (vapor barrier, vents, encapsulation), and applies only when `foundationType` is `raised`. |
| D18 | The `roof-attic` kit draws **shingle, tile and flat** roofs in v1. A recorded `metal` or `woodshake` roof draws as the nearest covering and never says "your". |
| D19 | Phase 0 imports the prototype **as-is** under a super-admin-only labs route; phase 3 deletes every prototype file. |
| D20 | Offline = **survives a Wi-Fi drop once loaded** (in-memory prefetch). No service-worker change; an offline relaunch is out of scope. |
| D21 | Naming: the feature folder is **`features/trade-scenes/`**, named for construction modeling; the unit is a **Trade scene** (replaces "Experience"). |

## 3. Vocabulary

Added to `CONTEXT.md` (section *Trade scene terms*) when this spec was amended:

- **Scene**: a 3D presentation surface driven by scene inputs. _Avoid_: canvas (that word means slide content), stage, visualization.
- **Scene inputs**: the typed values that controls change and the scene reads. One store per open scene, discarded on close.
- **Scene targets**: what `resolveScene(inputs)` returns; objects and panel figures ease toward them.
- **Trade scene**: one inputs schema + one `resolveScene` + one scene kit + its panel, modeling an assembly for the trades that build it. The assembly cutaway is the first. _Avoid_: experience (the public site's `/experience` page), visualization.
- **Cutaway overlay**: the fixed full-screen surface a trade scene opens in during a meeting. _Avoid_: modal, dialog, layer (Modal layers own that word).
- **Assembly**: a section of the house's construction that one or more trades build, e.g. `roof-attic`. Registry entry in the construction module.
- **Part**: a layer or component of an assembly (deck, brown coat, duct run, condenser). On screen it is a "layer"; in code it is always a part.
- **Part material**: what a part is made of (`deck: spaced-boards | plywood`). The in-code twin of the catalog's **Material**; links to it once Materials are read at runtime (P5).
- **Part condition**: `retained | worn | absent | installed`, shown as Kept / Original / Missing / New.
- **Existing conditions**: the parts as they most likely stand in the house today, inferred from the property profile. The drawing-set term for the as-is sheet.
- **Proposed build**: the existing conditions with the previewed scopes installed. The drawing-set term for the proposed sheet; it is what the proposal sells.
- **Basis**: `recorded` when every input came from the customer's profile and drew exactly, `era-typical` when any fell back to the home's era or a nearest drawing, `typical` when there is no year built either. Drives "your" / "homes built …" / "a typical home" wording. In disclaimer copy the figures' origin is the **estimate source**, never "basis".

"Variant" is not used for any of this (`CONTEXT.md`: a variant is a resized image). Code names carry the ROI calculator's words where the code moves from there (`cut`, `repairsPerYear`); the panel says "savings" and "repairs & upkeep".

## 4. Architecture: three tiers

```
Controls (DOM) ──► Scene inputs (per-open zustand store)
                        │
                        ▼  pure, memoized
             resolveScene(inputs) → Scene targets
                ┌───────┴────────┐
                ▼                ▼
       3D objects ease      DOM panel animates
       toward targets       (motion, same SCENE_MOTION tokens)
```

The tiers are **scene primitives** (app-wide, no construction), the **construction model** (facts about the work, no three.js), and **trade scenes** (compose both).

Rules:

- **One direction.** Control → input → resolve → animate. No scene object owns state; no input lives in component state.
- **Scene primitives know nothing about construction. The construction model imports no three.js.** Enforced by an ESLint `no-restricted-imports` rule beside the existing ones (`eslint.config.js`): `three`, `@react-three/*` only under `src/shared/components/scene/` and `src/features/trade-scenes/`; `src/shared/components/scene/` may not import `@/shared/modules/construction`.
- **Every trade scene ships a DOM twin** (layer list + callouts) of what its scene shows; it is the accessible path, the loading state and the no-WebGL path.
- **Code placement follows the repo's rules**: one component per file, file-level constants in `constants/`, hooks in `hooks/`, contexts in `contexts/`, named exports. `next/dynamic` imports use `.then(m => m.X)` as everywhere else; no default exports.
- **Imports go one way**: `meeting-flow` → `trade-scenes` → shared. A trade scene takes plain props typed from shared code and never imports meeting-flow.

### 4.1 Scene primitives

`src/shared/components/scene/`, with `constants/`, `contexts/`, `hooks/`, `lib/` sub-folders (precedent: `shared/components/data-view/table/`). A sibling of the slide engine in `presentation/`, not inside it.

| Primitive | Job |
|---|---|
| `createSceneInputs<T>(defaults)` + `SceneInputsProvider` | Typed zustand `createStore` factory, **instantiated per open** and held in a context, so nothing typed in one meeting reaches the next. Every overridable value is stored as entered-or-null and read through `resolveOverridable` (`src/shared/lib/`, below). Controls and scene subscribe through selectors. |
| `SceneShell` | R3F `<Canvas>` wrapper: `frameloop="demand"`, `dpr={[1, 2]}`, ACES tone mapping, an environment built from light panels in code (no HDR download), `renderer: 'webgl' \| 'webgpu'` (webgpu for look-dev only), a `fallback` slot, reduced-motion wiring, and a `webglcontextlost` listener that hands over to the fallback. |
| `useEased(target)` / `<Eased>` | Damped values (scalar, vector, colour) that call `invalidate()` until settled and stop asking once settled. Reduced motion snaps. Generalizes the prototype's `damp` + invalidate pattern (`cutaway-motion.tsx`). |
| `<Enter>` / `<Presence>` | Build-in on mount with a delay; exit-before-unmount so a part swapping material or condition morphs out and in instead of popping. |
| `EmphasisProvider` | One emphasized object id; everything else fades to a ghost opacity without hiding what is behind it (depth-write rule from the prototype); a tap on a ghost falls through. |
| `CameraRig` | Framing that adapts to the canvas aspect (portrait and landscape), bounded orbit, eased focus targets per emphasized object. |
| `SceneAnchor` + `ScenePins` | 3D anchors projected to DOM pins every rendered frame by writing a transform; no React re-render on pan (prototype's `pin-anchors`). |
| `InstancedPieces`, `useOwnedGeometry`, `Slab` | Lifted from the prototype: instanced repeated pieces (shingles, tiles, joists) with seeded jitter, geometry disposal on unmount, a sized box primitive. |
| `ThermalMaterial` | Wraps a standard material; a `temperature` (0..1) uniform maps to an infrared palette with a gradient through the part's thickness; a `palette` prop flips for winter. |
| `FlowRibbon` | Instanced tapered tube along a path, scrolling emissive texture, additive blending, selective bloom (`@react-three/postprocessing`). Width follows a profile along the path; a branch can peel off at a given point. Used for heat (warm palette) and water (blue). |
| `SCENE_MOTION` | Timing and damping tokens built from `BRAND_EASE` (`shared/constants/motion.ts`), consumed by `useEased` **and** by the DOM's `motion` transitions, so a figure counting down and a ribbon narrowing read as one gesture. |

`src/shared/lib/resolve-overridable.ts` moves the ROI calculator's private `resolve()` (`project-remodel-roi.ts:17`) and its `Resolved` / `ValueSource` types out unchanged: `{ value, source: 'input' | 'working' }`, labelled on screen by the ROI's existing tags ("You told us" / "Working number"). Both the ROI calculator and the scene inputs import it.

### 4.2 Construction model

`src/shared/modules/construction/core/`. Facts about the work, true however they are drawn. Types in `core/types.ts` (precedent `modules/projects/core/types.ts`); ids as `as const` lists with their types beside them (`ASSEMBLY_IDS`); the registry in `core/constants/assemblies/index.ts`.

```ts
// core/types.ts — the narrow property input; every field nullable, typed from core/constants/enums.ts
interface PropertyProfile {
  yearBuilt: YearBuiltRange | null      // a range such as '1950-1978', never a year
  roofType: RoofType | null             // shingle | metal | flat | woodshake | tile
  foundationType: FoundationType | null // raised | slab
  hvacType: HVACType | null
  insulationLevel: InsulationLevel | null
  // … the property-profile keys the inference reads, nothing else
}
```

The meeting maps `CustomerWithProfile` to it at the call site; the construction model never imports a customers entity.

```ts
// core/constants/assemblies/<assembly-id>.ts, one file per assembly
interface Assembly {
  id: AssemblyId                      // 'roof-attic' | 'crawl-space' | 'exterior-wall' | 'yard-ground' | 'hvac-attic'
  trades: readonly TradeSlug[]
  energyMode: 'thermal' | 'water'
  appliesTo?: (property: PropertyProfile) => boolean   // crawl-space: foundationType === 'raised'
  forms?: readonly string[]           // roof-attic: 'pitched' | 'low-slope'; the kit draws the form's geometry
  parts: readonly PartDefinition[]    // inside → out; drives list order, pins, explode order, build-in
}

interface PartDefinition {
  id: PartId
  group: string                       // 'roof' | 'attic' | 'wall' | 'ground' | 'ducts' | 'equipment'…
  role: 'structure' | 'shed-water' | 'reflect' | 'insulate' | 'seal' | 'ventilate' | 'surface' | 'irrigate' | 'equipment'
  forms?: readonly string[]           // the forms this part exists in (ridge-vent: pitched only); absent = all
  materials: Record<PartMaterialId, {
    thermal?: { rValue?: number, reflectance?: number }      // inputs to the heat drawing only
    copy: { label: string, detail: string }                  // presentationCopy register (P2 D4)
  }>
  absentCopy?: { label: string, detail: string }             // when the part's absence is the point
}
```

```ts
// core/constants/scope-installs.ts
// Keyed by Notion scope id, scope name in a trailing comment (the id-keyed pattern P2 plan 2 adopts for scope maps;
// today's SCOPE_PHOTOS is still keyed by name).
SCOPE_INSTALLS: Partial<Record<ScopeId, {
  assembly: AssemblyId
  installs: { part: PartId, material: PartMaterialId }[]
  addOn?: BillCutAddOnId              // e.g. 'ducts': a duct scope switches on the HVAC ducts cut
}>>
```

```ts
// core/lib/assemblies/<assembly-id>/infer-existing-conditions.ts, one per assembly
inferExistingConditions(property: PropertyProfile): ExistingConditions
// → { form?: string, parts: Record<PartId, { material: PartMaterialId, condition: PartCondition }>, basis: Basis }
// roof-attic: shingle and tile draw as recorded; flat → form 'low-slope' with a membrane covering;
// metal and woodshake → nearest covering with basis 'era-typical'; no yearBuilt → basis 'typical'.

// core/lib/resolve-assembly.ts, one for every assembly
resolveAssembly(assembly, { existing, proposedScopeIds, view: 'existing' | 'proposed' }): ResolvedPart[]
// ResolvedPart = { id, group, role, material, condition, label, detail, thermal }

// core/lib/relative-heat-flow.ts
relativeHeatFlow(parts: ResolvedPart[], season: 'summer' | 'winter'): FlowProfile
// Series resistance: reflectance removes the radiant share, then R-values divide what remains.
// Returns relative flow at each part boundary and a 0..1 temperature per part. Drives the drawing only; never displayed as a number.

// core/lib/relative-water-flow.ts (data + function in phase 2; drawn when the yard-ground kit lands)
relativeWaterFlow(parts: ResolvedPart[]): FlowProfile
// Irrigation into the ground; turf and pavers remove the demand.
```

**Savings and repairs move here from the ROI calculator**, keeping the ROI's names so nothing is renamed twice. Values are percents (25 means 25 %), as today.

```ts
// core/constants/bill-categories.ts   (moved; same order)
BILL_CATEGORIES = ['electric', 'water', 'gas', 'gardening', 'misc'] as const
// core/constants/trade-bill-cuts.ts   (moved from config-defaults `trades[*].cutsPercent` + `hvac.ductsCutsPercent`)
TRADE_BILL_CUTS: Partial<Record<TradeSlug, {
  base: Partial<Record<BillCategory, number>>
  addOns?: Partial<Record<BillCutAddOnId, Partial<Record<BillCategory, number>>>>   // hvac: { ducts: { electric: 5, gas: 5 } }
}>>
// core/constants/repairs-per-year.ts  (moved from config-defaults `current.repairsPerYear`, extended to every trade; $0 where none is known)
REPAIRS_PER_YEAR: Partial<Record<TradeSlug, number>>
// core/lib/resolve-bill-cuts.ts       parses TRADE_BILL_CUTS through the existing share-percent bounds; the one seam
//                                     the admin-set defaults (`app_settings`, sales-calculators I3) replace later
// core/lib/combine-cuts.ts            (moved; same multiplicative rule; an add-on counts only when its trade and the add-on are both on)
// core/lib/cut-for.ts                 (moved from project-remodel-roi.ts: applies CUT_MODES 'trades' | 'percent' | 'amount' to a bill)
// core/constants/cut-modes.ts         (moved from form-options.ts)
```

- The ROI calculator switches to `TradeSlug` outright (its state is never saved, so no key map): `TRADE_KEYS`, `AGING_TRADE_KEYS`, `TRADE_LABELS` and its config schema key on the six slugs from `trade-slugs.ts` (hvac, roof, windows and doors, attic and basement, exterior paint, dryscaping; exact strings from the generated file). Its `current.repairsPerYear` defaults read from `REPAIRS_PER_YEAR`. Its own copies are deleted in the same change (non-defensive migration), and `scripts/verify-remodel-roi.ts` moves to the new paths and passes unchanged before and after.
- `ScopeId` is the normalized Notion scope id the meeting already stores in `tradeSelections[].selectedScopes[].id`.
- `scripts/verify-scope-installs.ts` (read-only against the live catalog) checks every `SCOPE_INSTALLS` key is a live scope of a trade in its assembly, and every `installs` entry names a real part and material.

### 4.3 Trade scenes

`src/features/trade-scenes/`.

The assembly cutaway:

- **Props** (from the caller, never imported): `assemblyId`, `property: PropertyProfile`, `selectedScopeIds` (every selected scope of every trade in the assembly), `catalog` (for scope names and scope → trade).
- **Inputs** (`createSceneInputs`, seeded once on open from the props): `assemblyId`, `property`, `proposedScopeIds`, `view`, `peel` (0..1), `emphasizedPart`, `season`, `flowView` (on/off), `bills` (typed amounts), `overrides` (cut mode and value per category, repairs per trade).
- **`resolveScene(inputs)`** composes the construction model: existing conditions → resolved parts → flow profile → savings estimate, and returns the scene targets (per part: material, condition, offset along its peel axis, opacity, temperature; ribbon width profile; camera focus; panel figures).
- **Scene kits**: `scene-kits/<assembly-id>/`, one renderer component per part, each taking `{ material, condition, thickness, form }`. Procedural by default (dimensions bind to data, e.g. insulation depth is a height); a renderer may load a GLB instead (HVAC condenser and air handler later).
- **Panel**: view toggle, scope chips, peel control, layer list (the DOM twin), flow + season toggle, bill fields, assumptions panel, savings figures with asterisk popovers. Its colours are fixed on `--presentation-ground` like the Showcase, not scheme-dependent.

## 5. The experience (assembly cutaway, v1 = roof + attic)

### 5.1 Opening and closing

- Specialties showcase shows **"See inside"** for a trade whose slug belongs to an assembly that has a scene kit and `appliesTo` the property (v1: `roof-and-gutters`, `attic-and-basement`; both open `roof-attic`).
- A trade in more than one such assembly (later: `attic-and-basement` in `roof-attic` and `crawl-space`) shows one "See inside" per assembly, labeled by assembly ("Attic", "Crawl space"), ordered by which assembly its selected scopes install into (`SCOPE_INSTALLS`), then registry order.
- Opening sets `?assembly=roof-attic` through a `parseAsStringLiteral(ASSEMBLY_IDS)` parser in `meeting-flow/constants/query-parsers.ts`, with **`history: 'push'`**, so the iPad back gesture closes the overlay instead of leaving the meeting. Escape and the close button call `router.back()` when the overlay pushed the entry, else clear the param with replace (a reload that lands with `?assembly` set). `step` and `trade` are untouched, so closing lands on the same trade; any step change clears `assembly`.
- The **cutaway overlay** is a fixed full-screen surface rendered as a **sibling of `StageFrame`** in the meeting view, not a Radix dialog (a Radix modal open restyles the whole document, ~180 ms here). The stage beneath is `inert`; focus moves into the overlay and returns to the trigger on close (the meeting splash's precedent, `meeting-flow.tsx`). `useMeetingFlowKeys` stands down while `assembly` is set. Full height uses `inset-0`, never a height (iOS PWA viewport rule).
- The meeting passes the props: the property mapped from `flowContext.customer`, the selected scopes from `useTradeSelections()` (the live local copy, not the 800 ms-debounced `flowState`), and the catalog. They are read once on open; a realtime update mid-cutaway does not reset what the agent is showing.

### 5.2 What the homeowner sees

1. **Existing conditions build in**, ceiling first then the roof from the rafters out, the order a crew builds it. The heading follows the basis: "What is above your ceiling" (`recorded`), "What homes built 1950–1978 usually hide" (`era-typical`), "What is above a typical ceiling" (`typical`). Nothing says "your" when it is a guess. A flat roof draws the low-slope form.
2. **Peel apart**: a slider for the slow reveal and one tap to fully open or close. Parts separate along their own axes; the roof lifts so the attic shows.
3. **Emphasize a part**: tap it in 3D, its numbered pin, or its row in the layer list. Other parts fade, the camera eases toward it, and a callout shows what it is and why it matters, with lifespan and warranty once the field team supplies them.
4. **The Tri Pros build**: the view toggle rebuilds the assembly part by part into the proposed build; worn parts morph out, installed parts drop in. With no scope previewed, the proposed view equals the existing one and says so.
5. **Scope chips** (preview only, D10): one chip per scope of the assembly's trades that installs at least one part here (scopes absent from `SCOPE_INSTALLS` change nothing in the drawing and get no chip). They start from the meeting's selection across **all** the assembly's trades, so opening from Roof still counts a selected attic scope. Tapping one adds or removes it from the preview; the parts it installs light up and drop in; heat and savings update. The meeting's selection is untouched.
6. **Heat view**: thermal paint on every part plus heat ribbons. Summer pours in from the sun-baked roof; the cool roof peels part of the flow back to the sky; insulation narrows the rest to a trickle with a soft glow where it is absorbed. Winter flips palette and direction: heat leaks up and out of the living space.
7. **Savings** (proposed view only, once a bill is typed): "about $X a month less*" per cost, plus the combined total.

Dryscaping (later kit) swaps the heat view for a **water view**: irrigation flow into lawn soil that turf and pavers remove.

### 5.3 Savings (D4–D8)

| Cost | Default | Agent may override |
|---|---|---|
| Electric (summer), gas (winter), water (water view) | `cutFor(typed bill, combineCuts(trades with ≥1 previewed scope installing here, add-ons on, category))` | the bill; the cut as From trades / % / $ (`CUT_MODES`) |
| Repairs & upkeep | Σ `REPAIRS_PER_YEAR[trade]` ÷ 12 for trades in the proposed build | each trade's $/yr |

- Whole dollars. A trade with no % for that category contributes nothing (roof in winter shows no gas figure, not $0).
- The **assumptions panel** lists every number with the ROI's "You told us" / "Working number" tag and edits it in place. Nothing is persisted.
- **Disclaimers**: an asterisk on each figure opens a small popover: the estimate source ("Tri Pros customer bills"), "Savings vary", and for insulation the FTC R-value Rule wording (16 CFR 460.19, wording quoted from memory, so verified before release, §9).
- **R-values on insulation parts** are product facts and show as labels. The R-38 proposed value is a placeholder until the field team confirms it.
- **Every homeowner-facing savings claim that disagrees with the ROI figures is rewritten in phase 2**, in place (P2 plan 2 moves these files later and carries the new text):
  - `meeting-flow/constants/trade-outcomes.ts`: `attic-and-basement` "20–40%", `hvac` "nearly in half"
  - `meeting-flow/constants/programs.ts:134,137` and `meeting-flow/lib/profile-benefits.ts:76`: "30-55%"
  - `meeting-flow/constants/persona-profile-maps.ts:101`: HVAC "30-50%"; `:137`: dryscaping water "50-75%" (ROI: 40%)
  - the sales playbook table that `trade-outcomes.ts` cites
  - The landing and pain-point lines (`landing/constants/trade-outcome-statements.ts:5`, `trade-benefits.ts:29`, `pillar-config.ts:40`, `src/pain-points.ts:355,1035`) are logged for the copy owner, not changed here.

### 5.4 Look (D11–D13)

- **Premium architectural model**: real material detail at small cost (shingle grit, OSB grain, fluffy fill, stucco aggregate) from procedural or 1K textures, soft studio light, contact shadows and ambient occlusion, gentle depth of field, restrained colour on `--presentation-ground`, the emphasized part in full colour.
- **Thermal paint** via `ThermalMaterial`; **heat flow** via `FlowRibbon`. No flat arrows, chevrons or clip-art.
- The look is **decided on live 3D**, not mockups: phase 1's look-dev page shows two or three options each of material treatment, thermal paint and ribbon style, plus one WebGPU renderer option, using hand-set flow profiles and a simple single-part emphasis (the real ones arrive in phases 2 and 3). The owner picks on the iPad Pro; later phases build to the pick.

### 5.5 Graceful paths

- **Loading**: while the 3D chunk downloads, the panel and layer list render at once and the scene area shows the ground colour; the scene fades in when ready.
- **No WebGL** (context fails, or is lost mid-meeting): the panel, layer list, callouts and savings carry the story; one generic still of the assembly replaces the scene.
- **Reduced motion**: state changes apply instantly; ribbons hold still and show the flow by width alone.
- **Offline (D20)**: opening a meeting prefetches the cutaway chunk (`import()`) and fetches and decodes its textures in memory, so a Wi-Fi drop mid-meeting changes nothing. No service-worker change.

## 6. All five assemblies as data (the generalization test)

Phase 2 writes all five registry entries, even though only `roof-attic` gets a kit. The model passes if each is expressible with no special case in the resolver. Part lists below are the starting draft; the field team's list replaces them (§9).

| Assembly | Trades | Mode | Parts (inside → out) |
|---|---|---|---|
| `roof-attic` | `roof-and-gutters`, `attic-and-basement` | thermal | ceiling, air-sealing, attic insulation (batts · blown-fiberglass · cellulose), rafters, radiant-barrier, deck (spaced-boards · plywood), ice-and-water, underlayment (felt · synthetic), drip-edge, covering (shingle · cool-shingle · tile · membrane · cool-membrane), ridge-vent (pitched only), gutter. Forms: pitched, low-slope. |
| `crawl-space` | `attic-and-basement`, `foundation-and-crawl-space`; `appliesTo` raised foundations | thermal | subfloor, floor insulation, floor joists, foundation vents, vapor-barrier, soil |
| `exterior-wall` | `exterior-paint-stucco-and-siding` | thermal | drywall, studs, cavity insulation, sheathing, weather-resistive barrier, lath, scratch coat, brown coat, finish coat or siding, paint (standard · cool, reflectance) |
| `yard-ground` | `dryscaping` | water | native soil, irrigation line + heads, lawn (existing) → compacted base, sand bed or weed barrier, surface (pavers · artificial turf + infill · concrete) |
| `hvac-attic` | `hvac` | thermal | supply and return duct runs (leaky flex · sealed insulated; the duct scope carries `addOn: 'ducts'`), air handler or furnace (equipment), refrigerant lines, condenser (equipment), set in the `roof-attic` attic shell |

`hvac-attic` is the stress case: components, not layers. If the resolver needs a branch for it, the model is wrong and gets fixed in phase 2, before any kit is built on it.

## 7. Success criteria

Each criterion names how it is measured.

1. First open on an iPad Pro shows the scene in **under 1.5 s** after the meeting has loaded (a `performance.mark` from tap to the first rendered frame, on the device over the tunnel), and keeps working with Wi-Fi off once loaded (Playwright `context.setOffline(true)` after load).
2. **60 fps** orbit, peel, rebuild and season change on an iPad Pro (per-frame sampling on the device); **zero frames rendered while idle** (`gl.info.render.frame` unchanged over 2 s at rest, in Playwright).
3. Every **bill** figure **equals the ROI calculator's** for the same bill, trades, add-ons and overrides (the phase 2 assertion script runs both); `scripts/verify-remodel-roi.ts` passes unchanged before and after the phase 2 move.
4. Every part has homeowner wording; no "your" on an `era-typical` or `typical` basis (assertion over every `roof-type` × `yearBuilt` combination).
5. No-WebGL and reduced-motion paths tell the full story (Chromium `--disable-3d-apis`, and `WEBGL_lose_context` mid-scene, with screenshots).
6. All five assemblies exist as registry data with no resolver special case: the assertion script runs all 5 × both views through `resolveAssembly` and the flow functions, and the resolver contains no assembly id.
7. Changing any input (scope chip, view, season, bill, override) moves the scene and the panel together, eased with shared `SCENE_MOTION` timing; nothing pops (per-frame sampling of a part's opacity and a panel figure across a change).
8. Scene primitives have no construction import and the construction model has no three.js import (the ESLint rule, §4).

## 8. Phases and gates

| # | Phase | Gate |
|---|---|---|
| 0 | Add `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`, `@types/three` with `pnpm add` (never the prototype's lockfile). Import the prototype as-is under `/dashboard/labs/roof-cutaway`, super-admin only (the `lead-sources` page guard). Land P2 plan 1 Task 3 as ruled in D16. Record the D5 and D16 rulings in their trackers. | `pnpm tsc` + `pnpm lint` clean; the labs route redirects an agent |
| 1 | **Scene primitives skeleton + look-dev** at `/dashboard/labs/cutaway-look` (super-admin): `SceneShell`, `useEased`, `ThermalMaterial`, `FlowRibbon`, `SCENE_MOTION` in options on the roof + attic, plus one WebGPU option; the ESLint import rule. | **Owner picks the look on the iPad Pro** |
| 2 | **Construction model**: `PropertyProfile`; all five assemblies as data; `roof-attic` existing conditions (shingle, tile, flat, nearest-covering fallback); `SCOPE_INSTALLS` for the live roof and attic scopes (ids read from the live catalog) + `verify-scope-installs.ts`; resolver; heat and water flow; the savings and repairs move (§4.2); `resolveOverridable` to `shared/lib`; ROI calculator migrated to `TradeSlug`; every disagreeing claim rewritten (§5.3). | Assertion script passes (criteria 3, 4, 6); `verify-remodel-roi.ts` green before and after; `verify-scope-installs.ts` passes |
| 3 | **Scene primitives complete + the cutaway + `roof-attic` kit** (pitched and low-slope forms), rebuilt from the prototype to the repo's file rules, at `/dashboard/labs/cutaway` (super-admin, with prototype-style "Home profile" controls). Delete every prototype file and `/dashboard/labs/roof-cutaway`. | Screenshots in both orientations, every view, season and roof type; idle frame count (criterion 2); per-frame sampling across an input change (criterion 7) |
| 4 | **Meeting integration**: "See inside", `?assembly` with push history, the cutaway overlay beside `StageFrame`, key-hook stand-down, prefetch on meeting open, no-WebGL and loading paths. | Criteria 1 and 5 measured; field test in a real meeting |
| – | **Release gates** (not build blockers): field team's part list and copy, the R-38 target, business sign-off on disclosure wording and the estimate source. | Before prod |

**Standing rules for every task** (the plan carries them as Global Constraints): verification is `pnpm tsc` and `CI=1 pnpm lint`, never `pnpm build`; pure logic is proved by a throwaway `tsx` assertion script (no test runner; adding one is out of scope); UI by Playwright screenshots in our own browser; commits by explicit path, never `git add -A`, stash, reset or amend (the tree is shared); check `git diff --shortstat` after scripted edits (CRLF); no DB writes, not even for screenshots (a meeting fixture is the owner's to make); live Notion reads are read-only.

## 9. Owner and field-team inputs

1. The real part list and products per assembly (brand names, R-values, warranty terms), starting with roof + attic, including what a flat roof's membrane and insulation are.
2. The proposed attic R-value (placeholder R-38) per climate zone, if it varies.
3. Repairs defaults for the trades the ROI never had (`dryscaping`, `attic-and-basement`, `foundation-and-crawl-space`; $0 until given).
4. Who signs off the savings figures and the disclosure wording, including the exact FTC R-value Rule text.
5. Confirmation that the live Notion roof scopes include tear-off and redeck (seed data has both; the live catalog is unverified).

## 10. Risks

- **Savings are claims.** Mitigated by one source of truth, visible overrides, the disclosure popover, and the sign-off gate.
- **Scope ids are Notion ids.** A renamed or recreated scope silently drops out of `SCOPE_INSTALLS`; `verify-scope-installs.ts` catches it.
- **drei / postprocessing on WebGPU** may lack parity; that is why WebGPU is a look-dev option, not the base.
- **iPad memory**: instancing, demand rendering, 1K textures, and disposal of owned geometry (`useOwnedGeometry`) keep it bounded.
- **The prototype on main** (phases 0–3) carries names the new vocabulary replaces (`LayerId`, `BuildState 'today' | 'tri-pros'`, `DeckKind`); it is super-admin-only and phase 3 deletes it.

## 11. Out of scope (backlog kept in view)

- Scene kits for `crawl-space`, `exterior-wall`, `yard-ground`, `hvac-attic` (their data ships in phase 2).
- Drawing `metal` and `woodshake` coverings as their own materials (v1 draws the nearest).
- An offline relaunch (a service-worker cache of its own for the cutaway).
- **Sun & Energy on their lot** (old spec idea 4): sun arc for their latitude/longitude, Google Solar API roof segments and flux layer, climate-zone lookup. A future scene on the shared primitives.
- **Your home, reimagined** (idea 1) and the **3D upgrade configurator** (idea 2).
- Second-screen mirror over Ably `meeting:{id}`.
- Saving bills or overrides to the meeting or the customer.
- "During" project photos in part callouts.
- Changing the meeting's trade selection from inside the cutaway.

## 12. Amendments from the foundation build (2026-10-16)

The foundation build (phases 0–2 and the look-dev page) settled these. Where this section and the sections above disagree, this section wins.

### 12.1 Decisions now in code

**Scene primitives**

- **Eases start from rest.** The first frame after a target change, or after the scene settled, steps a nominal 1/60 s, so an ease never jumps after an idle gap; mid-ease frames keep the 0.1 s clamp. A settled value lands exactly on its target.
- **Uniforms go in through constructor args.** `ThermalMaterial` and `FlowRibbon` take their uniforms as material constructor args (three keeps them by reference), because R3F copies a `uniforms` prop and later writes never reach the GPU.
- **Thermal paint is not tone-mapped**, so the palette renders as authored under `SceneShell`'s ACES. Its transparency and depth write follow the eased opacity, so a fade-in never pops opaque.
- **Ribbon widths ease in place.** The tube is built once per path at unit radius; widths are one value per ring, eased with `useEased` and written into the existing vertices. Narrowing morphs; it never rebuilds.
- **`SceneShell` falls back on renderer errors too.** An error boundary around the canvas shows the same fallback when the renderer cannot be created, not only when there is no `<canvas>`.
- **Thermal paint, heat flow, glow and the contact shadow are WebGL only.** `ThermalMaterial` is GLSL and `WebGPURenderer` cannot draw it, so the WebGPU option draws materials only and says so on the page. WebGPU beyond look-dev needs a TSL port first.
- **Look-dev section layers ease.** Insulation thickness and the stacked roof layers are unit boxes scaled and moved through `useEased`, so Today → Tri Pros build morphs instead of snapping.

**Construction model**

- **Spaced boards only under wood shakes.** Every other roof type draws a plywood deck at every era, so no recorded roof sits on an impossible deck.
- **Covering materials carry their forms** (shingle, cool shingle, tile: pitched; membrane, cool membrane: low-slope). An installed material the home's form cannot hold is **skipped**, like a part the form lacks; the existing part stays as it is (a torch-down section on a pitched home must not crash the cutaway). An install naming an unknown part or material throws.
- **Scopes left out of the drawing are listed.** `core/constants/scope-not-drawn.ts` (`NOT_DRAWN`, keyed by scope id, name and reason in a trailing comment) holds the live roof and attic scopes deliberately not drawn. The live check requires every live scope of a mapped trade to be in exactly one of `SCOPE_INSTALLS` and `NOT_DRAWN`, and every `NOT_DRAWN` key to be live. The offline assertion script checks every `SCOPE_INSTALLS` entry names a real part and material and that one form of its assembly holds all of it.
- **Ribbon widths use a drawing reference resistance.** Width at a boundary = the share still kept ÷ (1 + crossed R ÷ `DRAWING_REFERENCE_R_VALUE`), with the reference at 20, so Today stays readable. Roof-attic final widths: summer Today (1950–1978 shingle, R-11) 0.55, R-38 0.30, + radiant barrier 0.12, + cool roof 0.09; winter 0.61, 0.34, 0.27, 0.27 (the radiant barrier turns some heat back in winter too). Face temperatures come from the °F readings walk.
- **Reflectance applies per part, where the walk crosses it.** `reflected` (sent back to the sky) is the outermost surface's share only: the first present part that carries thermal data, so a gutter or ridge vent never counts. A radiant barrier narrows what comes after it and leaves the ribbon at the shingles alone.
- **Every thermal assembly lists its parts inside → out**, the crawl space included (subfloor … soil); the assertion script pins each one's living-space face.
- **Irrigation carries no water demand.** The surface sets demand; irrigation only gates supply, so turf or pavers lower the drawn demand.
- **Static part labels never say "your"** ("Ceiling", not "Your ceiling"); the basis owns "your".

**Savings copy**

- The two homeowner lines the meeting already hid (`TRADE_BENEFIT_EXCLUSIONS`, exact-string match) stay hidden under their reworded text. Unhiding them is an owner call.

### 12.2 Open for plan 2 and owner calls

**Plan 2 (cutaway and kit)**

- **Form conversions.** A cross-form install (a flat → pitched re-roof, torch-down on a pitched home) is skipped today. Decide whether to draw the conversion instead, and label a skipped install "not drawn on this roof" in the kit.
- **Radiant barrier and the paint.** The barrier narrows the ribbon but does not cool the thermal paint (temperatures use only the outer surface's reflectance and the R-values). D11 pairs paint with ribbon, so they should agree.
- **Ghost fade with the heat view off snaps** (the plain material swaps by key); the thermal path already fades.

**Design calls**

- One pair of end temperatures serves every assembly, which paints crawl-space soil hottest in summer. The crawl space needs its own ends, or a ground-side rule.

**Phase 3 (primitives complete)**

- Thermal instanced pieces shade with unrotated normals (the vertex shader does not apply the instance matrix to normals).
- Settled ribbons re-apply their widths every frame while mounted. Fix in `useEased` with a settled flag.
- `useOwnedGeometry` has no consumers (`FlowRibbon` inlines its own). The phase 3 port uses it or deletes it.

**Phase 4 (meeting integration)**

- `SceneShell`'s error and context-lost fallback has no reset; once shown it stays until the scene remounts.

**Owner calls**

- **"Low" insulation as recorded.** A recorded insulation level of "low" draws as "R-11 insulation" under a `recorded` basis. Does a coarse level count as drawn exactly?
- **"Your" over guessed parts.** The recorded basis covers only year built, roof type and insulation level; every other roof-attic part (deck, underlayment, eave membrane, drip edge, radiant barrier, air sealing, ridge vent) is an era guess under a heading that says "your". Options: "your" only on recorded parts; a basis per part; neutral wording for inferred parts.
- **Savings wording.** The rewritten copy mixes two bases, "off the bill" and "off cooling / heating costs". Confirm the wording.
- **Old figures for the copy owner**, outside this work: `landing/constants/trade-outcome-statements.ts` (20–40%), `landing/constants/trade-benefits.ts` (20–40%; 30–50% on water heating), `landing/constants/pillar-config.ts` (30–55%), `src/pain-points.ts` ("nearly in half", 30–50% gas, 20–40%); `meeting-flow/lib/profile-benefits.ts` "The project pays for itself"; `meeting-flow/constants/programs.ts` "between $100 and $250 every month"; the sales playbook's Solar row and the Solar line in `trade-benefit-exclusions.ts` (no solar).
- **The look pick on the iPad Pro** is still open. Look-dev was verified headless only (SwiftShader); the proposed insulation top nearly meets the roof's lower edge at rest, for the owner to judge.

**Gates and checks**

- The live scope check (`scripts/verify-scope-installs.ts`) runs by hand. Consider adding it to `/pre-ship`.
- Criterion 3's "the assertion script runs both" waits for plan 2's savings panel. Today `verify-remodel-roi.ts` passes and every ROI figure is byte-identical across the move.
