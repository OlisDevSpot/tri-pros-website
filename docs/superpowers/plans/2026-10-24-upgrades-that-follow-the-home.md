# Upgrades That Follow the Home (TS3b.4a) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every material the home has today gets a condition (wear) with age bands and an era guess. The Tri Pros build offers a replacement for anything below New, marks each pick Saves energy or Like for like, credits upkeep by wear, and draws each existing part at its wear and each new part in its place. The new parts: windows, Cool Life paint, R-6/R-8 ducts, the package unit and AC size, Owens Corning shingle colours, and crawl space insulation with its thermal paint and a low camera.

**Architecture:**
- **Pure core first.** Wear, age bands, era build years, `HOME_MATERIALS` and `resolveHomeMaterials` live in construction core. So do the new assembly data (windows, the HVAC forms and package unit, duct materials, energy ranks and cut sources on materials) and one inferrer per assembly.
- **Then the scene's pure layer.** `resolveScene` resolves every assembly that applies. Savings and repairs are counted per installed part and per material. Offers span every assembly, and one write helper handles every material change. All of it is pinned by the verify scripts.
- **Then the panel, then the drawing.** Current materials becomes one list with wear dots, and Upgrades is grouped by system. Then come the worn looks, the swaps, and the crawl space paint and camera, tuned by screenshot.

**Tech Stack:** Next.js 15, React 19, React Three Fiber 9 (`frameloop="demand"`), three.js, zustand scene inputs (`useSceneInputs` / `useShallow`), `motion/react`, Tailwind v4, shadcn/Radix (`radio-group`, `toggle-group`), lucide-react.

**Spec:** `docs/superpowers/specs/2026-10-24-upgrades-that-follow-the-home-design.md` (approved 2026-10-24, §11 decided). Read it with this plan; § numbers below are the spec's. Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md` (R84–R95). Studies page (the visual floor): https://claude.ai/artifact/SdisF1HyuQxzVModw4N2oP, round 3, "Your pick" card.

**Stress test (2026-10-25):** amended with the owner's rulings, spec §11.5–§11.8. The cool roof is an efficiency upgrade option, on by default; its cut folds into the roof's own (EI-D25, Task 1b). One "count what's installed" bill-cut rule serves the scene and the proposal. The existing roof is never cool. Crawl insulation is the foundation system's. The findings each task now carries are marked *(ST)*.

**Paths:** `F/` = `src/features/trade-scenes/`, `CORE/` = `src/shared/modules/construction/core/`, `SDD/` = `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/` (gitignored). Every path is relative to the worktree `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`.

## Global Constraints

- **Branch and other sessions.** Branch `feat/trade-scenes-foundation`, the worktree above. Other sessions may edit trade-scene files in the same tree. Never revert, reformat or stage their edits.
- **Commits.**
  - Commit by explicit pathspec only, after `git diff --cached --name-only` shows exactly your files.
  - Run `git commit` with a 300 s timeout.
  - Never use `git add -A`, `stash`, `reset`, `checkout --`, `--amend` or `push`.
  - Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - After any scripted edit, `git diff --shortstat <file>` must show only your lines (a CRLF file rewritten whole shows every line).
- **Every task's commit passes `pnpm tsc` on its own** *(ST)*. A task that renames, deletes or re-signs an export repoints every caller in the same task, even when a later task rewrites that caller; each task's file list names them.
- **The pre-commit hook checks the main checkout, not this worktree.** Each task's own `pnpm tsc` and `pnpm lint`, run in the worktree, are the real gate. If the hook blocks a commit, report the error to the controller; never edit main's files from here.
- **Shared files: run `git diff <file>` before staging.** If a hunk is not yours, stop and wait. This applies to `F/constants/home-scene-copy.ts`, `F/types.ts`, every `F/constants/*.ts`, `CONTEXT.md`, the tracker, and both trade-scene verify scripts. In `home-scene-copy.ts` and `types.ts`, add new exports in one block at the end, and edit existing objects only where a task names the key.
- **Never touch without the owner's yes:**
  - `src/shared/components/scene/**`;
  - `src/features/meeting-visualizations/**`;
  - `/dashboard/labs/roof-cutaway` and the cutaway look-dev files;
  - `eslint.config.js` and `package.json`;
  - any shared file the spec does not name.

  Off limits entirely: DAL, `src/trpc/`, `src/shared/db/` (the `hvacTypes` enum reaches the schema's text column by import, with no migration and no `db:push`), seeds, entity services.
- **Verifying.**
  - Use `pnpm tsc`, `pnpm lint` and `pnpm tsx scripts/<name>.ts`.
  - Never run `pnpm build`.
  - `scripts/verify-scope-installs.ts` reads the live catalog and is read only. It may be run; nothing may write to any database.
- **Dev server and data.**
  - The dev server is the owner's, on `PORT=3002`. Never start, stop or restart it; ask before clearing `.next`.
  - Playwright logs in through `/api/dev/playwright-session?secret=…&as=…`, never `role=`. Never print that URL.
  - The lab page is `/dashboard/labs/trade-scene`.
- **Copy.**
  - Every string goes in `F/constants/home-scene-copy.ts`. Copy functions take string arguments only, because the copy gate calls each with plain strings.
  - Never "your" (except the recorded-basis title), never solar.
  - On screen it is **Condition**; in code it is **wear**. The paint claims of R61 are not used (§7.5).
- **Vocabulary in code** (`CONTEXT.md`):
  - **wear** (never "condition" for the new concept, copy keys included: `setWear`, `wearNotSet`), **home material**, **age bands**, **era guess**;
  - **system** for the Upgrades groups (`HOME_SYSTEMS`, `HomeSystemId`), never "group"; **efficiency upgrade option** (owner, 2026-10-25) for a material the rep switches on a pick, the cool roof and R-8 (`efficiencyUpgrades`, `EfficiencyUpgradeId`), never "swap" or "add-on" (a catalog add-on only);
  - code names stay `repairs…` as today (`REPAIRS_PER_YEAR`, `repairsRows`); the screen says Upkeep. **existing** (never "today"), **part** (never "layer");
  - offer kinds are `OfferKind = 'saves-energy' | 'like-for-like'`, one type in `CORE/types.ts`; `installKind` returns it.
- **Tokens and motion.**
  - Colours come from tokens only (`docs/design-system/theme-conventions.md`).
  - Success tint via `toneClasses('success')`; the picked tile is `bg-control-selected`.
  - Animate only `transform`, `opacity` and `clip-path`; DOM motion goes through `motion/react` with the existing reveal transitions.
- **Code style.**
  - Comments say why, never what.
  - One component per file, named exports, no barrels.
  - Pure code in `lib/`, `constants/` and `types.ts` never imports three.js; the verify script asserts it.
- **Hand-tuned figures (R43).** New heat effects, paint °F and look strengths are working numbers, tuned by screenshot. The constants file says so in one comment.
- **Visual floor.**
  - Screenshots and Playwright scripts live in `SDD/`.
  - Every UI screenshot step opens the matching `SDD/studies/` reference. A shot less crisp than the study counts as a finding: spacing, type, edges or alignment.

## Review Focus

1. **The era changes after the rep has set things.** A 1965 home: the rep sets Windows to Double and its wear to Good, then picks Post-2014. Expected:
   - windows stay Double at Good;
   - unset attic insulation, ducts and paint follow the new era;
   - the roof's wear moves to the new era's age.

   Pinned in Task 1 (`resolveHomeMaterials`) and Task 6 (`homeMaterialPatch`).
2. **A material set to New while one of its scopes is picked.** The pick leaves `proposedScopeIds` in the same write, the row reads "Already new", and the bill cut and repairs credit drop. Pinned in Task 6.
3. **The system changes under picks.** With a split replacement and ducts picked, the rep switches to Wall unit. Expected:
   - both picks drop in the same write;
   - the Ducts material and its rows disappear;
   - Heating & cooling reads "Nothing offered for a wall unit yet";
   - the repairs row for heating & cooling stays.

   Switching Central → Package unit swaps the System row for the Package unit row. Pinned in Task 6.
4. **A like-for-like-only build with a typed bill cut.** Double over double plus a gutters pick: no bill moves, even with a typed cut, while repairs are credited at the existing wear. Pinned in Task 5.
5. **The cool roof switched off.** A shingle tear-off with the cool roof off:
   - it installs a regular shingle, Like for like, so no bill moves;
   - its repairs are still credited;
   - the colour grid hides, and a picked colour never paints a regular shingle, a tile or a membrane;
   - switching it back on brings the electric 8 back.

   The existing roof is never cool, at any roof type. Pinned in Task 1b, Task 3 and Task 5.

---

### Task 0: Prepare (controller, not a subagent)

- [ ] **Step 0: Build on the other session's round-1 fixes** *(ST)*. On 2026-10-25 the working tree held another session's uncommitted edits to `CORE/constants/enums.ts` (`insulationLevels` gains `'none'`), `assemblies/roof-attic.ts`, `roof-attic-inference.ts`, the roof-attic inferrer, `F/lib/part-offers.ts` (`'needs-an-attic'`, `keepOffered` over every offer), `F/lib/resolve-scene.ts`, `F/lib/home-heat.ts`, `F/constants/home-heat-figures.ts`, `F/types.ts` (`HomeShell.form`, read by `ROOF_FORM_HEAT_EFFECTS`), `F/constants/home-scene-copy.ts`, both trade-scene verify scripts and two `meeting-visualizations` files. They landed on 2026-10-25 as `dba388663` ("owner round 1: … no-insulation homes, and flat roofs that run hotter and take no attic work") and `71cd39fa4`. Build on that head or later. Run `git status --short` first; if anything in this plan's file map is uncommitted again, stop and ask the owner. Re-read each of those files, and note in `SDD/ledger.md` every signature below that they changed. Two are known:
  - `HomeShell` keeps `form` (Task 4);
  - a recorded insulation level `'none'` resolves as absent (Task 1).
- [ ] **Step 1:** `mkdir -p SDD/studies SDD/shots`. Read the studies artifact with the Artifact tool (`action: "read"`) and save its HTML to `SDD/studies/studies.html`. With Playwright, open it and capture the round 3 "Your pick" card at 1440×900, 1024×768, 820×1180 and 390×844 as `SDD/studies/ref-<w>x<h>.png`. Save the `SCOPE_ICONS` object's SVG paths to `SDD/studies/scope-icons.txt` for Task 8.
- [ ] **Step 2: The crawl space insulation scope id (§4.4).** Run `pnpm tsx scripts/verify-scope-installs.ts`. Its "unmapped" lines list every live scope by assembly and trade. Note:
  - the id of "Install crawl-space insulation" and the trade the catalog files it under. The seed files it under Attic & basement. By the owner's business rule (spec §11.8) its trade in code is `foundation-and-crawl-space` whatever the catalog says, so a mismatch is not a stop. Record it for Task 2's catalog-lag entry, and note it for the owner as a Notion refile;
  - every other unmapped scope of `windows-and-doors`, `exterior-paint-stucco-and-siding`, `hvac` and `foundation-and-crawl-space`. Task 2 classifies them.

  Save the output to `SDD/unmapped-scopes.txt`.
- [ ] **Step 3:** `pnpm tsc`, `pnpm lint`, and `pnpm tsx scripts/verify-trade-scene.ts`, `verify-trade-scene-layout.ts`, `verify-construction-model.ts`, `verify-remodel-roi.ts`. Expected: all pass on the head after Step 0 (record it in the ledger). Otherwise stop.

### Task 1: Wear, age bands, the era guess and `HOME_MATERIALS` (construction core)

**Files:**
- Create:
  - `CORE/constants/home-material-ids.ts` (`HOME_MATERIAL_IDS` as const and `HomeMaterialId` derived from it, as `assembly-ids.ts` does) *(ST)*;
  - `CORE/constants/home-materials.ts`;
  - `CORE/constants/assemblies/windows.ts` (moved here from Task 2, because `HOME_MATERIALS` names it) *(ST)*;
  - `CORE/lib/wear-for-age.ts`, `CORE/lib/age-band-of.ts`, `CORE/lib/home-age.ts`, `CORE/lib/resolve-home-materials.ts`.
- Modify:
  - `CORE/constants/assembly-ids.ts` (`'windows'` after `'exterior-wall'`), `CORE/constants/assemblies/index.ts`, and `CORE/constants/assemblies/hvac-attic.ts` (its `appliesTo` only);
  - `CORE/constants/enums.ts`;
  - `CORE/constants/era-defaults.ts`;
  - `CORE/types.ts`;
  - `F/constants/home-scene-copy.ts` (`HVAC_TYPE_LABELS['package-unit'] = 'Package unit'`);
  - `F/constants/field-glyphs.ts` (an `hvac['package-unit']` glyph: a low box with a fan circle on top, same stroke);
  - `F/types.ts` (`ExteriorPaint` moves to core; repoint its imports).
- Test: `scripts/verify-construction-model.ts` (a new block before the final `console.log`; `livingSpaceFacePart` gains `windows: 'glazing'`, since the check at `:89-92` requires every assembly that is thermal in summer to pin its living-space face) *(ST)*.

**Interfaces:**
- **The `WINDOWS` assembly** (data only; Task 2 adds its ranks and installs):
  ```ts
  { id: 'windows', trades: ['windows-and-doors'], modes: { normal: 'thermal', summer: 'thermal', winter: 'thermal' }, parts: [
    glazing: single-pane (rValue 1, worn copy) | double-pane (rValue 2),   // first: it faces the living space
    frame: original-frame | vinyl-frame,
  ] }
  ```
  No kit.
- Produces, in `CORE/constants/enums.ts`, each as a `const` array plus its type:
  - `wears = ['new', 'good', 'fair', 'worn', 'failing']` → `Wear`;
  - `gutterOptions = ['present', 'none']` → `GutterOption`;
  - `exteriorPaints = ['regular', 'cool']` → `ExteriorPaint`;
  - `ductMaterials = ['original-flex', 'r6-silver-flex', 'r8-flex']` → `DuctMaterial` (Task 2 types the `duct-runs` materials `satisfies Record<DuctMaterial, …>`, so the two lists cannot drift);
  - `crawlInsulations = ['none', 'insulated']` → `CrawlInsulation`;
  - `acTonnages = ['3', '4', '5']` → `AcTons`, strings because `withUnknown`, `toChoice` and the field primitives take `T extends string` (`F/lib/profile-choice.ts:5-18`) *(ST)*;
  - `hvacTypes` gains `'package-unit'`.
  - There is no roof surface: the existing roof is never cool (spec §11.5).
- `CORE/constants/era-defaults.ts`: `ERA_BUILD_YEAR = { 'Pre-1950': 1945, '1950-1978': 1964, '1978-1998': 1988, '1998-2014': 2006, 'Post-2014': 2019 } satisfies Record<YearBuiltRange, number>`.
- `CORE/types.ts`:
  - `type AgeBands = readonly [good: number, fair: number, worn: number, failing: number]`, the first year of each step after New;
  - `HOME_MATERIAL_IDS = ['roof', 'attic-insulation', 'windows', 'exterior-paint', 'heating-cooling', 'ducts', 'crawl-insulation'] as const` and `HomeMaterialId`, in `home-material-ids.ts`;
  - `type ReplaceableField = 'insulationLevel' | 'windowsType' | 'exteriorPaint' | 'ducts' | 'crawlInsulation'`;
  - `type OfferKind = 'saves-energy' | 'like-for-like'` (Task 2's `installKind` returns it) *(ST)*;
  - `HomeMaterialFacts`, the shape TS4 saves:
    ```ts
    {
      wear: Partial<Record<HomeMaterialId, Wear>>
      gutters: GutterOption | null
      exteriorPaint: ExteriorPaint | null
      ducts: DuctMaterial | null
      crawlInsulation: CrawlInsulation | null
      acTons: AcTons | null
      shingleColor: OwensCorningColorId | null
    }
    ```
    `OwensCorningColorId` is a `string` alias until Task 2 narrows it;
  - `HomeFacts { property: PropertyProfile, materials: HomeMaterialFacts, year: number }`;
  - `HomeMaterialDefinition`:
    ```ts
    {
      trade: TradeSlug
      repairs: boolean
      parts: readonly { assembly: AssemblyId, part: string }[]
      bands: Readonly<Record<string, AgeBands>>
      replaceable: ReplaceableField | null
      eraGuess: Readonly<Record<YearBuiltRange, string>> | null
      appliesTo?: (property: PropertyProfile) => boolean
    }
    ```
    `bands` is keyed `'all'`, or by `RoofType` for the roof. Without `appliesTo`, a material applies when every assembly its parts draw applies (that assembly's own `appliesTo`), so ducts and crawl insulation never restate the HVAC or crawl space rule *(ST)*. Heating & cooling sets `appliesTo: () => true`, since a wall unit still has a row;
  - `ResolvedHomeMaterial`:
    ```ts
    {
      id: HomeMaterialId
      option: string | null
      optionBasis: Exclude<Basis, 'typical'> | null
      wear: Wear | null
      wearBasis: Exclude<Basis, 'typical'> | null
      eraWear: Wear | null
      absent: boolean
    }
    ```
    and `ResolvedHomeMaterials = Partial<Record<HomeMaterialId, ResolvedHomeMaterial>>`, holding only the materials that apply.
- `wearForAge(bands: AgeBands, years: number): Wear`: the first step whose start is above `years`; at or past `failing`, Failing.
- `ageBandOf(bands: AgeBands, wear: Wear): readonly [from: number, to: number | null]`.
- `homeAge(yearBuilt: YearBuiltRange | null, year: number): number`: `max(0, year − ERA_BUILD_YEAR[yearBuilt ?? ERA_FALLBACK])`.
- `bandsOf(id: HomeMaterialId, property: PropertyProfile): AgeBands`: `bands.all`, or for the roof `bands[property.roofType ?? 'shingle']`. It lives in `resolve-home-materials.ts`.
- `resolveHomeMaterials(facts: HomeFacts): ResolvedHomeMaterials`. Per material that applies:
  - **option:** the replaceable field's value. `insulationLevel` and `windowsType` come from `property`, the rest from `materials`. Unset (`null`) falls back to `eraGuess[yearBuilt ?? ERA_FALLBACK]` with basis `era-typical`.
  - **Attic insulation on a low-slope roof** with no recorded level has no option, and `absent: true`. That rule moves here from `roof-attic/infer-existing-conditions.ts`, and Task 3's inferrer reads it rather than copying it. A recorded level of `'none'` is also `absent: true` *(ST)*.
  - **The roof** has no replaceable field and no era guess: its option is the roof type, basis `recorded` when set, and its wear follows the home's age unless the rep set one.
  - **Crawl insulation** `'none'` is `absent: true`.
  - **eraWear:** `wearForAge(bandsOf, homeAge)`, unless a recorded option differs from the era guess; then `null`.
  - **wear:** the rep's `materials.wear[id]` (basis `recorded`), else `eraWear` (basis `era-typical`, or `null` when `eraWear` is null).
  - An absent material has `wear: null` and `eraWear: null`.
- `wearInForce(material: ResolvedHomeMaterial): Wear` (`wear ?? 'worn'`), exported beside it, because unset counts as Worn everywhere (§4.3).
- `HOME_MATERIALS: Record<HomeMaterialId, HomeMaterialDefinition>`, from spec §4.1 and §4.2:

  | id | trade | repairs | parts | bands | replaceable | era guess | applies |
  |---|---|---|---|---|---|---|---|
  | `roof` | `roof-and-gutters` | ✓ | roof-attic: covering, deck, gutter, drip-edge, underlayment | shingle `[5,10,15,20]`, tile `[10,20,28,35]`, woodshake `[5,12,18,25]`, flat `[4,8,12,18]`, metal `[10,25,40,50]` | — | — | always |
  | `attic-insulation` | `attic-and-basement` | — | roof-attic: attic-insulation | `[5,15,25,35]` | `insulationLevel` | `INSULATION_BY_ERA` | always |
  | `windows` | `windows-and-doors` | ✓ | windows: frame, glazing | `[5,12,20,30]` | `windowsType` | single before 1998, double from `1998-2014` | always |
  | `exterior-paint` | `exterior-paint-stucco-and-siding` | ✓ | exterior-wall: paint | `[3,6,10,15]` | `exteriorPaint` | all `regular` | always |
  | `heating-cooling` | `hvac` | ✓ | hvac-attic: air-handler, refrigerant-lines, condenser, package-unit | `[3,8,12,15]` | — | — | always (`appliesTo`) |
  | `ducts` | `hvac` | — | hvac-attic: duct-runs | `[5,10,15,20]` | `ducts` | `original-flex`, `r6-silver-flex` for Post-2014 | from hvac-attic, whose `appliesTo` this task adds: `p => p.hvacType === null \|\| p.hvacType === 'central' \|\| p.hvacType === 'package-unit'` (`assemblies/hvac-attic.ts` has none today) |
  | `crawl-insulation` | `foundation-and-crawl-space` (spec §11.8) | — | crawl-space: floor-insulation | `[5,10,15,25]` | `crawlInsulation` | `none`, `insulated` for Post-2014 | from crawl-space (raised) |

- [ ] **Step 1: Write the failing checks.** `facts(property, materials?, year = 2026)` builds `HomeFacts` with every material fact `null` and `wear: {}`.

```ts
for (const id of HOME_MATERIAL_IDS) {
  for (const bands of Object.values(HOME_MATERIALS[id].bands)) {
    assert.ok(bands.every((start, i) => i === 0 || start > bands[i - 1]), `${id}: bands rise`)
    for (const wear of wears) {
      const [from, to] = ageBandOf(bands, wear)
      assert.equal(wearForAge(bands, from), wear, `${id} ${wear}: its first year`)
      if (to !== null) assert.notEqual(wearForAge(bands, to), wear, `${id} ${wear}: ends before ${to}`)
    }
  }
  assert.ok(HOME_MATERIALS[id].parts.length > 0, `${id} draws at least one part`)
}
assert.equal(wearForAge(HOME_MATERIALS['exterior-paint'].bands.all, 10), 'worn', 'paint at 10 is Worn')
assert.equal(wearForAge(HOME_MATERIALS.roof.bands.shingle, 20), 'failing', 'shingle at 20 is Failing')
assert.equal(homeAge('1950-1978', 2026), 62)
assert.equal(homeAge(null, 2026), 62, 'no era: the fallback era')

const sixties = resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978', windowsType: null, insulationLevel: null })))
assert.equal(sixties.windows?.option, 'single')
assert.equal(sixties.windows?.optionBasis, 'era-typical')
assert.equal(sixties.windows?.wear, 'failing', 'era-age windows: 62 years is Failing')
assert.equal(sixties.windows?.wearBasis, 'era-typical')
const confirmed = resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978', windowsType: 'single' })))
assert.equal(confirmed.windows?.wear, sixties.windows?.wear, 'confirming the era guess keeps the era wear')
const replaced = resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978', windowsType: 'double' })))
assert.equal(replaced.windows?.wear, null, 'a material other than the guess: set its condition')
assert.equal(wearInForce(replaced.windows!), 'worn', 'unset counts as Worn')
const rated = resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978', windowsType: 'double' }), { wear: { windows: 'good' } }))
assert.equal(rated.windows?.wear, 'good')
assert.equal(rated.windows?.wearBasis, 'recorded')
const moved = resolveHomeMaterials(facts(profile({ yearBuilt: 'Post-2014', windowsType: 'double', insulationLevel: null }), { wear: { windows: 'good' } }))
assert.equal(moved.windows?.wear, 'good', 'an era change leaves what the rep set')
assert.equal(moved['attic-insulation']?.option, 'high', 'and refills what the rep left')
for (const roofType of [null, 'shingle'] as const) {
  const recent = resolveHomeMaterials(facts(profile({ yearBuilt: 'Post-2014', roofType })))
  assert.ok(['new', 'good'].includes(recent.roof!.wear!), `Post-2014 roof (${roofType}): New or Good, so no leak`)
}
assert.equal(resolveHomeMaterials(facts(profile({ roofType: 'shingle' }))).roof?.wear, resolveHomeMaterials(facts(profile({ roofType: null }))).roof?.wear, 'setting the roof type never unsets its wear')
assert.equal(resolveHomeMaterials(facts(profile({ roofType: 'flat', insulationLevel: null })))['attic-insulation']?.absent, true, 'no era insulation under a flat roof')
assert.equal(resolveHomeMaterials(facts(profile({ foundationType: 'slab' })))['crawl-insulation'], undefined, 'no crawl space on a slab')
assert.equal(resolveHomeMaterials(facts(profile({ hvacType: 'wall-mounted' }))).ducts, undefined, 'no ducts with a wall unit')
assert.equal(resolveHomeMaterials(facts(profile({ foundationType: 'raised' })))['crawl-insulation']?.absent, true, 'an older raised home: no crawl insulation, nothing to rate')
assert.equal(resolveHomeMaterials(facts(profile({ insulationLevel: 'none' })))['attic-insulation']?.absent, true, 'a recorded none: nothing to rate')
for (const yearBuilt of [...yearBuiltRanges, null]) {
  const unknown = resolveHomeMaterials(facts(profile({ yearBuilt, windowsType: null, insulationLevel: null, roofType: null, hvacType: null })))
  assert.ok(HOME_MATERIAL_IDS.filter(id => id !== 'crawl-insulation').every(id => unknown[id]), `${yearBuilt}: an all-unknown home resolves every material`)
}
const notSure = facts(profile({ yearBuilt: '1950-1978' }), { exteriorPaint: null, ducts: null })
assert.deepEqual(resolveHomeMaterials(notSure)['exterior-paint'], resolveHomeMaterials(facts(profile({ yearBuilt: '1950-1978' })))['exterior-paint'], '"Not sure" is the era guess')
```

- [ ] **Step 2:** `pnpm tsx scripts/verify-construction-model.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the files above. Then grep every `Record<HVACType` and `satisfies Record<HVACType` and give `'package-unit'` its entry in each. For the customer profile surfaces (`property-profile-fields.ts`, `customer-profile-details.tsx`, `meeting-flow/ui/components/context-panel.tsx`), check how `'wall-mounted'` is shown. If they print raw values, `'package-unit'` needs no change; if they use a label map, add `'Package unit'` to it. Report which.
- [ ] **Step 4:** Run the script, `pnpm tsc`, `pnpm lint`, and both trade-scene scripts. Expected: `✓ construction model`, the others unchanged.
- [ ] **Step 5: Commit**: `feat(construction): a wear for every home material, its age bands, and the era's first guess`.

### Task 1b: The cool roof becomes an efficiency upgrade option, on by default, and its cut folds into the roof's own *(ST; spec §11.6, EI-D25)*

**Files:**
- Create: `CORE/constants/efficiency-upgrades.ts` (`EFFICIENCY_UPGRADE_IDS = ['cool-roof'] as const`, `EfficiencyUpgradeId`; Task 2 appends `'r8-ducts'`).
- Modify:
  - core: `CORE/constants/bill-cut-add-ons.ts` (`'cool-roof'` leaves `BILL_CUT_ADD_ON_IDS` and its label), `CORE/constants/trade-bill-cuts.ts` (`'roof-and-gutters': { base: { electric: 8 } }`, its comment now saying why: Tri Pros sells cool roofs, so the roof's own cut is the cool covering's), `CORE/types.ts` (`ScopeInstall.installs[].swapsWith: Partial<Record<EfficiencyUpgradeId, string>>`), `CORE/lib/resolve-assembly.ts` (`addOns` → `efficiencyUpgrades?: readonly EfficiencyUpgradeId[]`);
  - the ROI calculator's cool-roof switch goes: `remodel-roi-calculator/schemas/form.ts`, `constants/form-defaults.ts`, `types/index.ts`, `lib/project-remodel-roi.ts`, `lib/story/build-basis.ts`, `ui/components/inputs-panel/trade-row.tsx`, `ui/components/story/assumptions-sheet.tsx`. A roof pick now always carries the roof's electric 8;
  - the scene: `F/types.ts` (`TradeSceneInputs.addOns` → `efficiencyUpgrades: EfficiencyUpgradeId[]`; `coolRoofSettled` goes), `F/constants/home-scene-defaults.ts` (`efficiencyUpgrades: ['cool-roof']`, so every roof pick starts cool), `F/lib/resolve-scene.ts:37` (passes `efficiencyUpgrades`), `F/lib/scene-savings.ts` (the roof trade lands only when its installed covering is a cool one; Task 5 generalises this per part), `F/lib/scope-preview-patch.ts` and `F/lib/scope-pick.ts` (the seeding goes), `F/lib/scope-chip-options.ts` (`offersCoolRoof(ids)` → `offersEfficiencyUpgrade(ids, upgrade: EfficiencyUpgradeId)`), `F/contexts/scene-targets-context.tsx` and `F/lib/scene-burst-key.ts` (read `efficiencyUpgrades`), `F/ui/components/panel/cool-roof-chip.tsx` → `efficiency-upgrade-chip.tsx` (`EfficiencyUpgradeChip({ label, pressed, disabled, describedBy, onPressedChange })`), `scope-or-addon-row.tsx` and `scopes-and-addons.tsx` (write and read `efficiencyUpgrades`), `F/constants/home-scene-copy.ts` (`EFFICIENCY_UPGRADE_LABELS = { 'cool-roof': 'Cool roof' } satisfies Partial<Record<EfficiencyUpgradeId, string>>`; Task 2 adds R-8);
  - the scripts: `verify-remodel-roi.ts` (the switch cases go; the default case keeps its figures, since the default was on), `verify-trade-scene.ts` (`ADD_ON_PICKS` → efficiency-upgrade picks, the cool-roof part becomes the roof's base part `'roof-and-gutters'`, and the scene-vs-ROI parity cases keep cool on), `verify-trade-scene-layout.ts:184-185` (the seeding checks become: the defaults start cool, and the chip's patch turns it off and on), `verify-construction-model.ts` (any `swapsWith` check).
- Test: all four pure scripts.

**Interfaces:**
- `efficiencyUpgradePatch(state: Pick<TradeSceneInputs, 'efficiencyUpgrades'>, upgrade: EfficiencyUpgradeId, on: boolean): Pick<TradeSceneInputs, 'efficiencyUpgrades'>` in `F/lib/efficiency-upgrade-patch.ts`. The chip writes through it, and Task 8's R-8 toggle reuses it.
- The chip shows on any covering pick whose install has a `cool-roof` upgrade option: shingle overlay, shingle tear-off and torch down. A regular pick (cool off) is Like for like (Task 5).

- [ ] **Step 1: Write the failing checks:**

```ts
const at = (patch: Partial<TradeSceneInputs>) => resolveScene(inputs(patch), cuts)
assert.deepEqual(HOME_SCENE_DEFAULTS.efficiencyUpgrades, ['cool-roof'], 'every roof pick starts cool')
assert.deepEqual(TRADE_BILL_CUTS['roof-and-gutters'], { base: { electric: 8 } }, 'the cool roof is the roof\'s own cut')
assert.ok(!(BILL_CUT_ADD_ON_IDS as readonly string[]).includes('cool-roof'), 'cool roof is not an add-on')
const coolOn = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TEAR_OFF], bills: BILLS })
assert.deepEqual(coolOn.savings.cuts.electric.parts, [{ source: 'roof-and-gutters', percent: 8 }])
const coolOff = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [TEAR_OFF], efficiencyUpgrades: [], bills: BILLS })
assert.equal(coolOff.savings.cuts.electric.combined, 0, 'a regular shingle moves no bill')
assert.deepEqual(efficiencyUpgradePatch({ efficiencyUpgrades: ['cool-roof'] }, 'cool-roof', false).efficiencyUpgrades, [])
assert.ok(offersEfficiencyUpgrade([TORCH_DOWN], 'cool-roof') && offersEfficiencyUpgrade([TEAR_OFF], 'cool-roof') && offersEfficiencyUpgrade([SCOPE_IDS.roofOverlay], 'cool-roof'), 'the chip shows on shingle and torch down')
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Grep `addOns`, `coolRoofSettled`, `'cool-roof'`, `coolRoof` and `offersCoolRoof` across `src/` and `scripts/`; nothing may still read them except `BILL_CUT_ADD_ON_LABELS` users of `'ducts'`.
- [ ] **Step 4:** All four pure scripts, `pnpm tsc`, `pnpm lint`. Expected: pass; `verify-remodel-roi.ts`'s default-case figures unchanged.
- [ ] **Step 5: Commit**: `feat(construction): the cool roof is the roof's own cut, and in the scene an efficiency upgrade option the rep can switch off`.

### Task 2: The assembly data the new materials draw (construction core)

**Files:**
- Create:
  - `CORE/constants/owens-corning-shingles.ts`;
  - `CORE/lib/install-kind.ts`.
- Modify:
  - `CORE/constants/efficiency-upgrades.ts` (appends `'r8-ducts'`);
  - `CORE/constants/assemblies/{windows,hvac-attic,roof-attic,exterior-wall,crawl-space}.ts`;
  - `CORE/constants/bill-cut-add-ons.ts` (`'radiant-barrier'`, label 'Radiant barrier') *(ST, spec §11.7)*;
  - `CORE/types.ts`;
  - `CORE/constants/scope-ids.ts`, `scope-installs.ts`, `scope-not-drawn.ts`;
  - `CORE/constants/trade-bill-cuts.ts`;
  - `CORE/constants/repairs-per-year.ts`;
  - `CORE/lib/combine-cuts.ts`;
  - `F/constants/scope-verbs.ts`;
  - `F/constants/home-scene-copy.ts` `EFFICIENCY_UPGRADE_LABELS['r8-ducts'] = 'Step up to R-8'`;
  - `scripts/verify-scope-installs.ts` (a `CATALOG_TRADE_LAG` map, below);
  - `F/constants/home-scene-copy.ts` (`SCOPES_AND_ADDONS_COPY.verbs.repaint = 'Repaint'`; `PART_LABELS` for `glazing`, `frame`, `paint`, `air-handler`, `package-unit`, `duct-runs`, `floor-insulation`).
- Test: `scripts/verify-construction-model.ts`, `scripts/verify-scope-installs.ts` (run, read only), `scripts/verify-remodel-roi.ts`.

**Interfaces:**
- `PartMaterialDefinition` gains two fields:
  - `energyRank?: number`: higher saves more energy; a material without one never saves;
  - `cut?: BillCutAddOnId`: a saving install of this material earns that add-on of its scope's trade instead of the trade's base.
- **Ranks and cuts** (count what's installed, spec §11.7):
  - roof-attic `covering`: shingle 0, cool-shingle 1, membrane 0, cool-membrane 1, with no `cut`: a cool covering earns the roof's own base cut (Task 1b). Tile and wood-shake have no rank;
  - `attic-insulation`: batts-r11 0, batts-r19 1, batts-r30 2, blown-r38 3;
  - `radiant-barrier` foil 0 with `cut: 'radiant-barrier'`, so adding it over nothing earns its own add-on, not the insulation's base;
  - `air-sealing` has no rank: air-leak sealing moves no bill (energy-impact epic §3.2);
  - windows `glazing`: single-pane 0, double-pane 1;
  - exterior-wall `paint`: standard 0, cool 1;
  - hvac-attic `duct-runs`: original-flex 0, r6-silver-flex 1, r8-flex 2, the last two with `cut: 'ducts'`;
  - `air-handler`: furnace-coil 0, high-efficiency 1;
  - `condenser`: standard-seer 0, high-seer 1;
  - `package-unit`: standard-package 0, high-efficiency-package 1;
  - crawl-space `floor-insulation`: batts-r19 0.
- **`HVAC_ATTIC`:**
  - `forms: ['split', 'package']` (its `appliesTo` is Task 1's);
  - `air-handler`, `refrigerant-lines` and `condenser` carry `forms: ['split']`;
  - a new `package-unit` part (`group: 'equipment'`, `role: 'equipment'`, `forms: ['package']`) with `standard-package` (worn copy) and `high-efficiency-package`;
  - `duct-runs` materials become `original-flex` (rValue 4, the old `leaky-flex` copy), `r6-silver-flex` (rValue 6) and `r8-flex` (rValue 8), typed `satisfies Record<DuctMaterial, …>`. `leaky-flex` and `sealed-insulated` go; grep and move every consumer.
- **`EFFICIENCY_UPGRADE_IDS`** gains `'r8-ducts'`.
- **`OWENS_CORNING_SHINGLES`:** the 17 rows of spec §7.6 verbatim, `as const satisfies readonly ShingleColor[]` with `ShingleColor = { id: string, line: 'cool' | 'cool-plus', name: string, hex: string, agedSri: number }`, ids kebab-case of the name (`'oyster-shell'`). `OwensCorningColorId` is derived from the array's ids *(ST)*. Beside it, `LA_MIN_AGED_SRI = 20` (Owens Corning's statement of the City of LA rule, spec §7.6).
- **`installKind(part: PartDefinition, existing: string | null, installed: string): OfferKind`:** saves when the installed material has an `energyRank` and the existing is null, has no rank, or ranks lower.
- **`combineCuts`'s `Picks`** gains `addOnTrades?: readonly T[]`: the trades whose add-ons count, defaulting to `trades`. The base loop reads `trades`; the add-on loop reads `addOnTrades ?? trades`. The ROI calculator never passes it. This is the one "count what's installed" rule for the scene and the proposal (spec §11.7); the energy-impact plan's `addOnsOnly` and "ducts always on" give way to it when that work lifts the slice. Task 12 records this in the energy-impact tracker for its session.
- **`TRADE_BILL_CUTS['attic-and-basement']`** gains `addOns: { 'radiant-barrier': { electric: 5, gas: 2 } }` (the epic's EI-D16/EI-D18 figure).
- **`SCOPE_IDS`** gains:
  - `windowReplacement: '3e40ca1b-548b-824d-b0db-81cc10787e73'`;
  - `coolLifeRepaint: '9d60ca1b-548b-824a-8aef-81f1e29b9b34'`;
  - `splitSystemReplacement: '6450ca1b-548b-830a-ac5e-018e7fd3064a'`;
  - `packageUnitReplacement: '9460ca1b-548b-8375-8d63-814dddf36b71'`;
  - `airDuctsReplacement: 'bc50ca1b-548b-8366-9ef9-811c2f36877f'`;
  - `crawlSpaceInsulation` (Task 0's id).
- **`SCOPE_INSTALLS`:**
  - window replacement → windows: glazing `double-pane` first, then frame `vinyl-frame`. `partOffers` files a scope under its first install's part (`F/lib/part-offers.ts:34`), and the Windows system's row is glazing *(ST)*;
  - Cool Life repaint → exterior-wall: paint `cool`;
  - split system → hvac-attic: air-handler `high-efficiency`, condenser `high-seer`, refrigerant-lines `copper` (a full system, so a furnace-only home gains a condenser) *(Claude's call)*;
  - package unit → hvac-attic: package-unit `high-efficiency-package`;
  - air ducts → hvac-attic: duct-runs `r6-silver-flex` with `swapsWith: { 'r8-ducts': 'r8-flex' }`;
  - crawl → crawl-space: floor-insulation `batts-r19`, trade `foundation-and-crawl-space` (spec §11.8);
  - overlay, tear-off and torch down keep their `cool-roof` upgrade option, which the scene's default `efficiencyUpgrades` turns on (Task 1b).
- **`CATALOG_TRADE_LAG`** in `scripts/verify-scope-installs.ts`: `{ [SCOPE_IDS.crawlSpaceInsulation]: '<the catalog's trade from Task 0>' }`. For a scope listed there, the script prints `catalog behind: <name> is filed under <catalog trade>; the code says <trade>` instead of the trade error at `:36-37`, and it still errors on any other mismatch.
- **Every unmapped scope** of the trades Task 0 listed goes into `NOT_DRAWN` with a one-line reason comment, as the existing entries do (doors, repairs, services, etc.).
- `TRADE_BILL_CUTS['foundation-and-crawl-space'] = { base: { electric: 2, gas: 5 } }`, under the existing working-numbers comment.
- `REPAIRS_SHARE_BY_WEAR = { new: 0, good: 0.4, fair: 0.7, worn: 1, failing: 1.5 } satisfies Record<Wear, number>`, in `repairs-per-year.ts`.
- `SCOPE_VERBS`: window `replace`, Cool Life `repaint`, split `replace`, package `replace`, ducts `replace`, crawl `add`.

- [ ] **Step 1: Write the failing checks** in `verify-construction-model.ts`:

```ts
const glazing = ASSEMBLIES.windows.parts.find(part => part.id === 'glazing')!
assert.equal(installKind(glazing, 'single-pane', 'double-pane'), 'saves-energy')
assert.equal(installKind(glazing, 'double-pane', 'double-pane'), 'like-for-like', 'double over double')
const ducts = ASSEMBLIES['hvac-attic'].parts.find(part => part.id === 'duct-runs')!
assert.equal(installKind(ducts, 'original-flex', 'r6-silver-flex'), 'saves-energy')
assert.equal(installKind(ducts, 'r6-silver-flex', 'r8-flex'), 'saves-energy', 'R-6 → R-8 still saves')
assert.equal(installKind(ducts, 'r8-flex', 'r6-silver-flex'), 'like-for-like')
const insulation = ASSEMBLIES['roof-attic'].parts.find(part => part.id === 'attic-insulation')!
assert.equal(installKind(insulation, 'batts-r30', 'blown-r38'), 'saves-energy', 'high (R-30) → R-38 saves a little')
const gutter = ASSEMBLIES['roof-attic'].parts.find(part => part.id === 'gutter')!
assert.equal(installKind(gutter, null, 'aluminum'), 'like-for-like', 'gutters carry no energy rank')
const radiantBarrier = ASSEMBLIES['roof-attic'].parts.find(part => part.id === 'radiant-barrier')!
assert.equal(installKind(radiantBarrier, null, 'foil'), 'saves-energy')
const airSealing = ASSEMBLIES['roof-attic'].parts.find(part => part.id === 'air-sealing')!
assert.equal(installKind(airSealing, null, 'sealed'), 'like-for-like', 'air sealing moves no bill')
assert.deepEqual(combineCuts({ trades: [], addOns: ['radiant-barrier'], addOnTrades: ['attic-and-basement'] }, 'electric', TRADE_BILL_CUTS).parts, [{ source: 'radiant-barrier', percent: 5 }], 'radiant barrier alone: its own add-on')
assert.equal(SCOPE_INSTALLS[SCOPE_IDS.crawlSpaceInsulation]!.trade, 'foundation-and-crawl-space', 'the foundation system owns crawl insulation')
const ductsOnly = combineCuts({ trades: [], addOns: ['ducts'], addOnTrades: ['hvac'] }, 'electric', TRADE_BILL_CUTS)
assert.deepEqual(ductsOnly.parts, [{ source: 'ducts', percent: 5 }], 'ducts alone earn only their +5')
assert.deepEqual(combineCuts({ trades: ['hvac'], addOns: ['ducts'] }, 'gas', TRADE_BILL_CUTS).parts.map(part => part.percent), [20, 5], 'the calculator\'s call is unchanged')
assert.deepEqual(TRADE_BILL_CUTS['foundation-and-crawl-space'], { base: { electric: 2, gas: 5 } })
assert.equal(OWENS_CORNING_SHINGLES.length, 17)
assert.ok(OWENS_CORNING_SHINGLES.every(color => color.agedSri >= 16), 'every colour meets Title 24')
assert.deepEqual(OWENS_CORNING_SHINGLES.filter(color => color.line === 'cool' && color.agedSri >= 20).map(color => color.name).sort(), ['Amber', 'Oyster Shell', 'Shasta White', 'Sierra Gray'])
for (const [scopeId, entry] of Object.entries(SCOPE_INSTALLS)) {
  assert.ok((ASSEMBLIES[entry!.assembly].trades as readonly string[]).includes(entry!.trade), `${scopeId}: its trade belongs to ${entry!.assembly}`)
}
```

- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement.** The existing checks in `verify-construction-model.ts` and `verify-trade-scene.ts` that name `leaky-flex` or `sealed-insulated` move to the new names. Never delete a check without its replacement. `F/lib/scene-savings.ts` and the scene files that read duct materials are repointed here, so `pnpm tsc` passes at this commit.
- [ ] **Step 4:** Run `verify-construction-model.ts`, `verify-remodel-roi.ts` (expected unchanged), `verify-scope-installs.ts` (expected: no errors, one `catalog behind` line for crawl insulation, and no unmapped line for the four trades), `verify-trade-scene.ts`, `pnpm tsc` and `pnpm lint`. Expected: all pass.
- [ ] **Step 5: Commit**: `feat(construction): windows, the package unit, R-6 and R-8 ducts, crawl insulation, and which installs save energy`.

### Task 3: Every assembly infers its existing parts from the home materials

**Files:**
- Create: `CORE/lib/assemblies/{windows,exterior-wall,hvac-attic,crawl-space}/infer-existing-conditions.ts`.
- Modify:
  - `CORE/lib/assemblies/roof-attic/infer-existing-conditions.ts`;
  - `CORE/types.ts` (`ExistingPart.wear?: Wear`, `ResolvedPart.wear?: Wear`);
  - `CORE/lib/resolve-assembly.ts` (passes `wear` through on parts that are not installed);
  - `F/constants/existing-conditions.ts`;
  - every caller of the inferrers *(ST)*: `F/lib/part-offers.ts`, `F/lib/resolve-scene.ts`, the ~23 direct calls of `inferRoofAtticExistingConditions(property)` in `scripts/verify-construction-model.ts` and the 3 in `scripts/verify-trade-scene.ts` (grep again after Task 0 Step 0).
- Test: `scripts/verify-construction-model.ts`.

**Interfaces:**
- **Every inferrer:** `(facts: HomeFacts, home: ResolvedHomeMaterials) => ExistingConditions`. `INFER_EXISTING_CONDITIONS` becomes `Record<Exclude<AssemblyId, 'yard-ground'>, InferExisting>`.
- **A part a material draws:**
  - condition `retained` when `wearInForce` is `new`, else `worn`, and `wear: wearInForce(material)`;
  - a material that is `absent` gives `{ material: null, condition: 'absent' }`.
- **roof-attic:**
  - as today, except covering, deck, underlayment, drip edge and gutter follow the roof material, and attic-insulation follows its own;
  - the covering is always the regular material of the roof type (`shingle`, `membrane`, …): the existing roof is never cool (spec §11.5);
  - attic-insulation reads `home['attic-insulation']` (option and `absent`), so the low-slope rule lives only in `resolveHomeMaterials`;
  - `materials.gutters === 'none'` makes the gutter absent;
  - ceiling and rafters stay `retained`; ice-and-water, ridge-vent, radiant-barrier and air-sealing stay absent.
- **windows:**
  - glazing `single-pane` or `double-pane` from the option, following the windows wear;
  - frame `original-frame`, following it too.
- **exterior-wall:**
  - form `'stucco'`;
  - paint `standard` (regular) or `cool`, following the paint wear;
  - cavity-insulation and sheathing absent; everything else `retained`.
- **hvac-attic:**
  - form `'package'` for a package unit, else `'split'`;
  - air-handler `furnace-coil`, refrigerant-lines `copper` and package-unit `standard-package` follow the heating-cooling wear;
  - condenser `standard-seer` likewise, but absent when `hvacComponents === 'furnace'`;
  - duct-runs from the ducts option, following the ducts wear.
- **crawl-space:**
  - floor-insulation `batts-r19` when insulated (following its wear), else absent;
  - vapor-barrier absent; the rest `retained`.
- **Basis:** each new inferrer's basis is `'typical'` with no year built. Otherwise it is built from the `optionBasis` of the materials it reads (`home[*].optionBasis`): `'recorded'` when every one is recorded, `'era-typical'` if not. roof-attic keeps its rule.

- [ ] **Step 1: Write the failing checks** (with `home = resolveHomeMaterials(f)`):

```ts
const roofParts = (f: HomeFacts) => inferRoofAtticExistingConditions(f, resolveHomeMaterials(f)).parts
const newRoof = roofParts(facts(profile({}), { wear: { roof: 'new' } }))
assert.equal(newRoof.covering.condition, 'retained', 'wear New: kept')
assert.equal(newRoof.covering.wear, 'new')
assert.equal(roofParts(facts(profile({}), { wear: { roof: 'fair' } })).covering.condition, 'worn', 'any other wear: worn')
assert.equal(roofParts(facts(profile({}))).ceiling.condition, 'retained', 'the ceiling never follows the roof')
assert.equal(roofParts(facts(profile({}), { gutters: 'none' })).gutter.condition, 'absent')
for (const roofType of roofTypes) {
  assert.ok(!roofParts(facts(profile({ roofType }))).covering.material?.startsWith('cool-'), `${roofType}: the existing roof is never cool`)
}
const hvacFor = (patch: Partial<PropertyProfile>) => inferHvacAtticExistingConditions(facts(profile(patch)), resolveHomeMaterials(facts(profile(patch))))
assert.equal(hvacFor({ hvacType: 'package-unit' }).form, 'package')
assert.equal(hvacFor({ hvacComponents: 'furnace' }).parts.condenser.condition, 'absent', 'a furnace alone has no condenser')
assert.equal(hvacFor({ yearBuilt: '1950-1978' }).parts['duct-runs'].material, 'original-flex')
const crawl = (f: HomeFacts) => inferCrawlSpaceExistingConditions(f, resolveHomeMaterials(f)).parts['floor-insulation']
assert.equal(crawl(facts(profile({ foundationType: 'raised' }))).condition, 'absent')
assert.equal(crawl(facts(profile({ foundationType: 'raised' }), { crawlInsulation: 'insulated', wear: { 'crawl-insulation': 'good' } })).material, 'batts-r19')
const resolved = resolveAssembly(ASSEMBLIES['roof-attic'], { existing: inferRoofAtticExistingConditions(facts(profile({})), resolveHomeMaterials(facts(profile({})))), proposedScopeIds: [], view: 'existing' })
assert.ok(resolved.find(part => part.id === 'covering')?.wear, 'wear rides through the resolver')
```

- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement.** Repoint every `INFER_EXISTING_CONDITIONS[...]` caller (`part-offers.ts`, `resolve-scene.ts`, the verify scripts) to pass `(facts, resolveHomeMaterials(facts))`. Where a caller only has a property, the scene's facts come from `TradeSceneInputs` in Task 4; until then, pass `HOME_MATERIAL_FACTS_UNSET` (all null, `wear: {}`), exported from `CORE/constants/home-materials.ts`, and the current year.
- [ ] **Step 4:** Run `verify-construction-model.ts`, `pnpm tsc` and `pnpm lint`. Expected: pass. `verify-trade-scene.ts` may fail only on the rules Task 4 moves; list them.
- [ ] **Step 5: Commit**: `feat(construction): every assembly infers its existing parts from the home's materials and their wear`.

### Task 4: The scene resolves every assembly that applies, from the home materials

**Files:**
- Modify:
  - `F/types.ts`;
  - `F/constants/home-scene-defaults.ts`;
  - `F/lib/resolve-scene.ts`;
  - `F/lib/home-heat.ts`;
  - `F/constants/home-heat-figures.ts`;
  - `F/contexts/scene-targets-context.tsx` (imports the selector from `lib/`);
  - `F/lib/scene-burst-key.ts`;
  - every reader of `HomeShell.windows` or `.paint` (grep).
- Create: `F/lib/current-year.ts`, `F/lib/scene-resolve-inputs.ts` (`selectResolveInputs` and `resolveInputsOf`, moved out of the context file so a script can test them) *(ST)*.
- Test: `scripts/verify-trade-scene.ts`.

**Interfaces:**
- **`TradeSceneInputs`:**
  - gains `homeMaterials: HomeMaterialFacts` (default `HOME_MATERIAL_FACTS_UNSET`) and `cameraFocus: 'under-floor' | null` (default `null`, drawing only);
  - `efficiencyUpgrades` is Task 1b's.
- **`SceneResolveInputs`:** its `homeMaterials` is `Omit<HomeMaterialFacts, 'acTons' | 'shingleColor'>`.
  - `selectResolveInputs` spreads `wear`, `gutters`, `exteriorPaint`, `ducts` and `crawlInsulation` flat into the selected object, so `useShallow` sees each one.
  - `resolveInputsOf(selection)` rebuilds the nested slot. Writing `acTons` or `shingleColor` must not re-resolve.
- `HomeKitInputs` adds `'homeMaterials'` and `'homeView'`; `sceneBurstKey` adds the whole `homeMaterials` slot, since a wear change can switch the leak and the residents on or off *(ST)*.
- **`HomeShell` becomes `{ parts: readonly ResolvedPart[], form: RoofForm }`**: every resolved assembly's parts flattened, and the `form` the other session added (Task 0 Step 0) stays for `ROOF_FORM_HEAT_EFFECTS`.
  - `WINDOW_HEAT_EFFECTS` and `PAINT_HEAT_EFFECTS` move, figures unchanged, into `PART_HEAT_EFFECTS` as `glazing['double-pane']` and `paint.cool`.
  - Added under the R43 comment: `'duct-runs': { 'r6-silver-flex': { normal: { load: 0.95 }, summer: { load: 0.93 }, winter: { load: 0.93 } }, 'r8-flex': { normal: { load: 0.94 }, summer: { load: 0.91 }, winter: { load: 0.91 } } }`. New ducts lower the load the HVAC lane carries.
- **`resolveScene(inputs, cuts, kits = ASSEMBLY_KITS, year = currentYear())`:**
  - builds `facts`, then `home = resolveHomeMaterials(facts)`;
  - resolves every `ASSEMBLY_IDS` entry except `yard-ground` whose `appliesTo` holds, with its inferrer and `efficiencyUpgrades`;
  - a kit still decides only `targets.mode`, `targets.water` and the heading;
  - `SceneTargets` gains `home: ResolvedHomeMaterials`.
- **The leak and the water flow** *(ST)*: rain gets in only when the roof's `wearInForce` is `worn` or `failing` (§4.3). The gate sits where the rain walk reads the parts: with a New, Good or Fair roof, the roof's worn parts count as retained for `relativeWaterFlow`, so both `leak` (`{ reachesInside: 0, soakedPartIds: [] }`) and the up-close `targets.water` keep the rain out. Gating only `leak` would still show the up-close ribbon reaching the ceiling.
- `currentYear(): number` is `Number(businessToday().slice(0, 4))` (`src/shared/lib/business-time.ts:56`), so the year turns in Pacific time, and tests pass a year instead *(ST)*.

- [ ] **Step 1: Write the failing checks** in `verify-trade-scene.ts`:

```ts
const YEAR = 2026
// replaces Task 1b's `at`, now with the year:
const at = (patch: Partial<TradeSceneInputs>) => resolveScene(inputs(patch), cuts, ASSEMBLY_KITS, YEAR)
const allHome = at({ property: profile({ foundationType: 'raised', hvacType: 'central' }) })
assert.deepEqual(Object.keys(allHome.assemblies).sort(), ['crawl-space', 'exterior-wall', 'hvac-attic', 'roof-attic', 'windows'], 'every assembly that applies, never the yard')
assert.equal(at({ property: profile({ hvacType: 'wall-mounted', foundationType: 'slab' }) }).assemblies['hvac-attic'], undefined)
const recentRain = at({ property: profile({ yearBuilt: 'Post-2014' }), weather: 'rain' })
assert.equal(recentRain.leak.reachesInside, 0, 'a Post-2014 roof no longer leaks (§2a)')
assert.ok(at({ property: profile({ yearBuilt: '1950-1978' }), weather: 'rain' }).leak.reachesInside > 0, 'an era-worn roof still does')
assert.equal(at({ property: profile({ yearBuilt: '1950-1978' }), homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'fair' } }, weather: 'rain' }).leak.reachesInside, 0, 'a Fair roof keeps the rain out')
const fairRainUpClose = at({ property: profile({ yearBuilt: '1950-1978' }), homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'fair' } }, weather: 'rain', zoom: 'roof-attic' })
assert.equal(fairRainUpClose.assemblies['roof-attic']?.water?.reachesInside ?? 0, 0, 'up close, a Fair roof keeps the rain out too')
const shallowEqual = (a: object, b: object) => Object.keys(a).length === Object.keys(b).length && Object.entries(a).every(([key, value]) => Object.is(value, (b as Record<string, unknown>)[key]))
const select = (patch: Partial<HomeMaterialFacts>) => selectResolveInputs({ ...HOME_SCENE_DEFAULTS, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, ...patch } })
assert.ok(shallowEqual(select({ acTons: '3' }), select({ acTons: '5', shingleColor: 'oyster-shell' })), 'the AC size and the shingle colour never re-resolve')
assert.ok(!shallowEqual(select({ wear: { roof: 'good' } }), select({ wear: { roof: 'worn' } })), 'a wear change does')
const drawingOnly: 'acTons' | 'shingleColor' extends keyof SceneResolveInputs['homeMaterials'] ? never : true = true
assert.ok(drawingOnly)
const cameraFocusIsDrawingOnly: 'cameraFocus' extends keyof SceneResolveInputs ? never : true = true
assert.ok(cameraFocusIsDrawingOnly)
const heatAt = (wear: Wear) => at({ homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'roof': wear, 'attic-insulation': wear, 'windows': wear, 'exterior-paint': wear, 'ducts': wear } } }).heat
for (const wear of wears) {
  assert.deepEqual(heatAt(wear), heatAt('worn'), `${wear}: wear never changes a heat figure`)
}
```

Extend the existing worn-versus-installed heat assertion (`verify-trade-scene.ts:529-534`) to glazing, paint and duct-runs.

- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement**, then update the existing assertions this change makes stale, each to the new rule:
  - unknown windows now follow the era's guess;
  - only Worn or Failing roofs leak, up close too;
  - `HomeShell` holds parts and `form`.

  The `homeViewIsDrawingOnly` check stays.
- [ ] **Step 4:** Run both trade-scene scripts, `verify-scene-inputs.ts`, `pnpm tsc` and `pnpm lint`. Expected: pass. Take one Playwright shot of the lab page at 1440×900, Today and Tri Pros build, to `SDD/shots/t4-*.png`: the scene draws as before apart from the era's windows.
- [ ] **Step 5: Commit**: `feat(trade-scenes): the scene resolves every assembly the home has, from its materials and their wear, and only a worn roof leaks`.

### Task 5: Savings and repairs counted per installed part and per material

**Files:**
- Modify: `F/lib/scene-savings.ts`, `F/lib/repairs-figure.ts`, `F/lib/repairs-rows.ts`, `F/ui/components/panel/repairs-section.tsx`, `F/constants/home-scene-copy.ts` (`REPAIRS_COPY.wearNotSet = 'Condition not set'`, `WEAR_LABELS`, `HOME_MATERIAL_LABELS` (moved here from Task 7, replacing `REPAIRS_COPY.rows`), the option label maps below).
- Modify, the deleted file's other readers *(ST)*: `F/ui/components/panel/savings-read-amounts.tsx:10,17` (its top-level `ROW_LABELS` also moves to `F/constants/`), `scripts/verify-trade-scene-layout.ts:11,119` (and its `repairsRows(profile({}))` call at `:113`).
- Delete: `F/constants/repairs-row-labels.ts` (the materials table replaces it).
- Test: `scripts/verify-trade-scene.ts`.

**Interfaces:**
- **`SceneSavingsInput.resolved` entries** gain `existing: ExistingConditions`. `addOns` leaves the input; it gains `home: ResolvedHomeMaterials`.
- **`landed(...)`.** For each part with condition `installed` whose scope (the first proposed scope in that assembly that installs the part) is found:
  - `installKind(partDefinition, existing.parts[id]?.material ?? null, part.material)`;
  - **saves energy:** earns `material.cut` (an add-on, keyed to the scope's trade) or else the scope trade's base;
  - **any kind:** a part that a `repairs: true` material draws credits that material once.
  - It returns `{ baseTrades: TradeSlug[], addOns: BillCutAddOnId[], addOnTrades: TradeSlug[], repairs: { trade: TradeSlug, wear: Wear | null }[] }`.
- **Cuts:** `combineCuts({ trades: baseTrades, addOns, addOnTrades }, …)`. With nothing earned, the bills stay whole, even with a typed cut.
- **`repairsFigure(entries: readonly { trade: TradeSlug, wear: Wear | null }[], overrides)`:** working = `Math.round(REPAIRS_PER_YEAR[trade] * REPAIRS_SHARE_BY_WEAR[wear ?? 'worn'])`. A typed override still wins.
- **`repairsRows(property: PropertyProfile, home: ResolvedHomeMaterials): RepairsRow[]`:**
  - one row per `repairs: true` material that applies, in `HOME_MATERIAL_IDS` order, with a working figure above 0;
  - `RepairsRow` gains `material: HomeMaterialId` and `wear: Wear | null`;
  - its note reads `"<option or type label> · <WEAR_LABELS[wear]>"`, or `· REPAIRS_COPY.wearNotSet` when unset. Examples: "Shingle · Worn", "Single pane · Good", "Water-based paint · Fair", "Central · Good".
- **Copy:**
  - `WEAR_LABELS = { new: 'New', good: 'Good', fair: 'Fair', worn: 'Worn', failing: 'Failing' }`;
  - `HOME_MATERIAL_LABELS = { roof: 'Roof & gutters', 'attic-insulation': 'Attic insulation', windows: 'Windows', 'exterior-paint': 'Exterior paint', 'heating-cooling': 'Heating & cooling', ducts: 'Ducts', 'crawl-insulation': 'Crawl space insulation' }`, which the rows' names read;
  - `EXTERIOR_PAINT_LABELS = { regular: 'Water-based paint', cool: 'Cool Life reflective paint' }`;
  - `GUTTER_LABELS = { present: 'Gutters', none: 'No gutters' }`;
  - `DUCT_LABELS = { 'original-flex': 'Original', 'r6-silver-flex': 'R-6 silver flex', 'r8-flex': 'R-8 flex' }`;
  - `CRAWL_INSULATION_LABELS = { none: 'None', insulated: 'Insulated' }`;
  - `AC_TON_LABELS = { '3': '3 ton', '4': '4 ton', '5': '5 ton' }`;
  - each `satisfies Record<…, string>`, and each choice-backed one registered through `withUnknown` in `HOME_PROFILE_CHOICES` (`F/constants/home-profile-choices.ts`), as `windowsType` is *(ST)*.
- `RepairsSection` reads `targets.home` (via `useSceneTargets`) for its rows, and sums with the wear.

- [ ] **Step 1: Write the failing checks:**

```ts
const sixtiesSingle = profile({ yearBuilt: '1950-1978', windowsType: 'single', roofType: 'shingle' })
const doubleOverSingle = at({ property: sixtiesSingle, view: 'proposed', proposedScopeIds: [SCOPE_IDS.windowReplacement], bills: BILLS })
assert.ok(doubleOverSingle.savings.cuts.electric.combined > 0, 'double over single saves energy')
const doubleOverDouble = at({ property: { ...sixtiesSingle, windowsType: 'double' }, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { windows: 'fair' } }, view: 'proposed', proposedScopeIds: [SCOPE_IDS.windowReplacement, SCOPE_IDS.gutters], bills: { ...BILLS, electric: { now: 200, cut: { mode: 'percent', value: 30 } } } })
assert.equal(doubleOverDouble.savings.cuts.electric.combined, 0, 'like for like moves no bill, even with a typed cut')
assert.equal(doubleOverDouble.savings.repairsByTrade['windows-and-doors']?.value, Math.round(200 * 0.7), 'like for like credits repairs at the existing wear')
const failingRoof = at({ property: sixtiesSingle, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'failing' } }, view: 'proposed', proposedScopeIds: [SCOPE_IDS.roofTearOff], bills: BILLS })
assert.equal(failingRoof.savings.repairsByTrade['roof-and-gutters']?.value, 600, 'a Failing roof: 1.5 × 400')
const ductsOnlyScene = at({ property: profile({ yearBuilt: '1950-1978', hvacType: 'central' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.airDuctsReplacement], bills: BILLS })
assert.deepEqual(ductsOnlyScene.savings.cuts.electric.parts, [{ source: 'ducts', percent: 5 }], 'ducts alone: +5 only')
assert.equal(ductsOnlyScene.savings.repairsByTrade.hvac, undefined, 'ducts carry no repairs')
const systemAndDucts = at({ property: profile({ yearBuilt: '1950-1978', hvacType: 'central' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.splitSystemReplacement, SCOPE_IDS.airDuctsReplacement], bills: BILLS })
assert.deepEqual(systemAndDucts.savings.cuts.gas.parts.map(part => part.percent), [20, 5], 'the system and the ducts: 25 / 20 and +5 / +5')
const regularTearOff = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.roofTearOff], efficiencyUpgrades: [], bills: BILLS })
assert.equal(regularTearOff.savings.cuts.electric.combined, 0, 'cool off: a regular shingle over the existing roof is like for like')
assert.ok((regularTearOff.savings.repairsByTrade['roof-and-gutters']?.value ?? 0) > 0, 'and its repairs are still credited')
const barrierOnly = at({ property: profile({ roofType: 'shingle' }), view: 'proposed', proposedScopeIds: [SCOPE_IDS.radiantBarrier], bills: BILLS })
assert.deepEqual(barrierOnly.savings.cuts.electric.parts, [{ source: 'radiant-barrier', percent: 5 }], 'radiant barrier alone: its add-on, not the insulation base')
const rows = repairsRows(sixtiesSingle, resolveHomeMaterials({ property: sixtiesSingle, materials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'worn' } }, year: YEAR }))
assert.equal(rows.find(row => row.material === 'roof')?.note, 'Shingle · Worn')
assert.equal(rows.find(row => row.material === 'exterior-paint')?.note?.startsWith('Water-based paint · '), true, 'paint has a note now')
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Update the existing savings assertions to the per-part rule.
- [ ] **Step 4:** Both trade-scene scripts, `verify-remodel-roi.ts`, `pnpm tsc`, `pnpm lint`. Expected: pass.
- [ ] **Step 5: Commit**: `feat(trade-scenes): only a pick that saves energy moves a bill, and repairs follow each material's wear`.

### Task 6: Offers and writes across every assembly

**Files:**
- Create: `F/lib/home-material-patch.ts`, `F/constants/home-systems.ts`, `F/lib/upgrade-rows.ts`, `F/hooks/use-set-home-material.ts` (one hook per file) *(ST)*.
- Modify: `F/lib/part-offers.ts`, `F/lib/scope-pick.ts`, `F/lib/scope-preview-patch.ts`, `F/lib/property-patch.ts`, `F/types.ts` (`HomeSystemRows`), `F/constants/home-scene-copy.ts`.
- Modify, the callers of the re-signed offers *(ST)*: `F/ui/components/panel/scopes-and-addons.tsx:24` and `scope-or-addon-row.tsx:50,54` pass `facts` (a minimal repoint; Task 8 rebuilds them).
- Test: `scripts/verify-trade-scene-layout.ts`.

**Interfaces:**
- **Offers:**
  - `PartOffer` gains `assemblyId: AssemblyId`, and `partOffers(assemblyId)` sets it;
  - `OfferBlockedReason` gains `'already-new' | 'no-offer-for-unit'`;
  - `offeredScopes(offer, ctx)`'s ctx gains `wear: Wear | null | undefined`, the wear of the material that draws the part. `'new'` gives `{ scopeIds: [], blocked: 'already-new' }`, checked before every other rule, but only for a part the home has: an absent part (gutters on a no-gutters roof) is still offered under a New roof *(ST)*. Unset offers as Worn.
  - A package unit ignores `hvacComponents`: the Equipment choice is hidden for it, so a leftover `'furnace'` must not drop its cooling (`indoorSide`, `F/lib/indoor-side.ts:6`, and the hvac-attic inferrer) *(ST)*.
- **`existingParts`, `alsoNewLabels` and `keepOffered`** all read the whole home:
  - `existingParts(assemblyId, facts: HomeFacts): ResolvedPart[]`;
  - `alsoNewLabels(assemblyId, facts, scopeId)`;
  - `keepOffered(picks, facts): string[]`: every pick, of every assembly, that its row no longer offers leaves, repeated until stable as today.
- **Systems** (the owner's word, spec §6.3): `HOME_SYSTEMS: readonly { id: HomeSystemId, rows: readonly { assembly: AssemblyId, part: string }[] }[]`:
  - `roof`: covering, deck, gutter;
  - `attic`: radiant-barrier, attic-insulation, air-sealing;
  - `windows`: glazing;
  - `walls`: paint;
  - `heating-cooling`: air-handler, package-unit, duct-runs;
  - `foundation`: floor-insulation (spec §11.8).
- **`upgradeRows(facts: HomeFacts, picks: readonly string[], efficiencyUpgrades: readonly EfficiencyUpgradeId[]): HomeSystemRows[]`** gives each system's rows; `HomeSystemRows = { id: HomeSystemId, rows: { offer, existing: ResolvedPart, material: HomeMaterialId | null, scopeIds, blocked, kinds: Record<ScopeId, OfferKind> }[] }` in `F/types.ts`.
  - A row's `material` is looked up from `HOME_MATERIALS[*].parts`, never set by hand *(ST)*.
  - A row whose part the home does not have (its assembly does not apply, or the form drops it) is left out, and a system with no rows is left out.
  - With `hvacType` `wall-mounted` or `portable`, the heating-cooling system holds one blocked row (`'no-offer-for-unit'`, `material: 'heating-cooling'`).
  - `kinds[scopeId]` is `'saves-energy'` when any of the scope's installs saves on that home (`installKind` against the existing part, `efficiencyUpgrades` applied, so a shingle pick with the cool roof off is Like for like).
- **`homeMaterialPatch(state: Pick<TradeSceneInputs, 'property' | 'homeMaterials' | 'proposedScopeIds'>, change: HomeMaterialChange, year: number): Partial<TradeSceneInputs>`.** The changes:
  - `{ kind: 'wear', id, wear: Wear }` sets it;
  - `{ kind: 'option', field: ReplaceableField, value: string | null }`: writes `homeMaterials`, or, for `insulationLevel` and `windowsType`, goes through `propertyPatch` so pruning lives in one place *(ST)*. When the material's resolved option changes, it deletes `wear[id]` (§4.3);
  - `{ kind: 'era-guess', id }`: clears `wear[id]` and the replaceable field, if the material has one. It never touches `roofType`, `hvacType`, `hvacComponents` or `gutters`;
  - `{ kind: 'fact', patch: Partial<Pick<HomeMaterialFacts, 'gutters' | 'acTons' | 'shingleColor'>> }`.

  Every change ends with `proposedScopeIds: keepOffered(...)` in the same write.
- **Shared rules for the other writes:**
  - `propertyPatch(state: Pick<TradeSceneInputs, 'property' | 'homeMaterials' | 'proposedScopeIds'>, patch, year)` prunes picks on every property write, not only the roof type;
  - `scopePick` uses `offer.assemblyId`, and its roof group stays roof-attic's roof-dependent offers;
  - `scopePreviewPatch` reads and writes `efficiencyUpgrades`;
  - `scopePick` drops `'r8-ducts'` from `efficiencyUpgrades` when the ducts scope leaves the picks, so a later ducts pick starts at R-6 *(ST)*. `'cool-roof'` is never dropped: it is the default.
- `useSetHomeMaterial(): (change: HomeMaterialChange) => void`, in its own file, one `setState`.
- **Copy:**
  - `SCOPES_AND_ADDONS_COPY.blocked['already-new'] = 'Already new'`;
  - `SCOPES_AND_ADDONS_COPY.unitBlocked = { 'wall-mounted': 'Nothing offered for a wall unit yet', 'portable': 'Nothing offered for a portable unit yet' }`;
  - `OFFER_KIND_LABELS = { 'saves-energy': 'Saves energy', 'like-for-like': 'Like for like' }`;
  - `HOME_SYSTEM_LABELS = { roof: 'Roof & gutters', attic: 'Attic', windows: 'Windows', walls: 'Walls', 'heating-cooling': 'Heating & cooling', foundation: 'Foundation' }`;
  - the R-8 label is `EFFICIENCY_UPGRADE_LABELS['r8-ducts']` (Task 2).

- [ ] **Step 1: Write the failing checks** in `verify-trade-scene-layout.ts`:

```ts
const state = (patch: Partial<TradeSceneInputs>) => ({ ...HOME_SCENE_DEFAULTS, ...patch })
const sixties = profile({ yearBuilt: '1950-1978', roofType: 'shingle', hvacType: 'central', windowsType: 'single' })
const picked = state({ property: sixties, proposedScopeIds: [SCOPE_IDS.windowReplacement] })
const newWindows = homeMaterialPatch(picked, { kind: 'wear', id: 'windows', wear: 'new' }, YEAR)
assert.deepEqual(newWindows.proposedScopeIds, [], 'New drops its pick in the same write')
const facts = (s: TradeSceneInputs) => ({ property: s.property, materials: s.homeMaterials, year: YEAR })
const windowsRow = (s: TradeSceneInputs) => upgradeRows(facts(s), s.proposedScopeIds, s.efficiencyUpgrades).find(system => system.id === 'windows')!.rows[0]
assert.equal(windowsRow(state({ ...picked, ...newWindows })).blocked, 'already-new')
const rated = state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { windows: 'good' } } })
assert.equal(homeMaterialPatch(rated, { kind: 'option', field: 'windowsType', value: 'double' }, YEAR).homeMaterials?.wear.windows, undefined, 'a new material clears its wear')
const same = homeMaterialPatch(rated, { kind: 'option', field: 'windowsType', value: 'single' }, YEAR)
assert.equal((same.homeMaterials ?? rated.homeMaterials).wear.windows, 'good', 'the same value keeps it')
const eraBack = homeMaterialPatch(state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, gutters: 'none', wear: { roof: 'good' } } }), { kind: 'era-guess', id: 'roof' }, YEAR)
assert.equal({ ...sixties, ...eraBack.property }.roofType, 'shingle', 'back to the era guess never clears the roof type')
assert.equal(eraBack.homeMaterials?.gutters, 'none', 'nor the gutters')
assert.equal(eraBack.homeMaterials?.wear.roof, undefined, 'it clears the wear')
const newRoofNoGutters = state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, gutters: 'none', wear: { roof: 'new' } } })
const gutterRow = upgradeRows(facts(newRoofNoGutters), [], newRoofNoGutters.efficiencyUpgrades).find(system => system.id === 'roof')!.rows.find(row => row.offer.partId === 'gutter')!
assert.notEqual(gutterRow.blocked, 'already-new', 'a New roof with no gutters can still be offered gutters')
const ductsOffer = partOffers('hvac-attic').find(offer => offer.partId === 'duct-runs')!
const ductsDropped = scopePick(state({ property: sixties, proposedScopeIds: [SCOPE_IDS.airDuctsReplacement], efficiencyUpgrades: ['cool-roof', 'r8-ducts'] }), ductsOffer, null)
assert.deepEqual(ductsDropped.efficiencyUpgrades, ['cool-roof'], 'dropping the ducts drops R-8, never the cool roof')
const offered = new Map<string, number>()
for (const system of HOME_SYSTEMS) for (const row of system.rows) offered.set(`${row.assembly}:${row.part}`, (offered.get(`${row.assembly}:${row.part}`) ?? 0) + 1)
for (const assemblyId of ASSEMBLY_IDS) {
  for (const offer of partOffers(assemblyId)) assert.equal(offered.get(`${assemblyId}:${offer.partId}`), 1, `${assemblyId} ${offer.partId}: in exactly one system row`)
}
const wallUnit = propertyPatch(state({ property: sixties, proposedScopeIds: [SCOPE_IDS.splitSystemReplacement, SCOPE_IDS.airDuctsReplacement] }), { hvacType: 'wall-mounted' }, YEAR)
assert.deepEqual(wallUnit.proposedScopeIds, [], 'a wall unit drops the system and duct picks')
const unitGroup = upgradeRows({ property: { ...sixties, hvacType: 'wall-mounted' }, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }, [], []).find(system => system.id === 'heating-cooling')!
assert.deepEqual(unitGroup.rows.map(row => row.blocked), ['no-offer-for-unit'])
const packageGroup = upgradeRows({ property: { ...sixties, hvacType: 'package-unit', hvacComponents: 'furnace' }, materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }, [], []).find(system => system.id === 'heating-cooling')!
assert.deepEqual(packageGroup.rows.map(row => row.offer.partId), ['package-unit', 'duct-runs'], 'a package unit: its own row, no split system')
for (const roofType of roofTypes) {
  const covering = upgradeRows({ property: profile({ roofType }), materials: HOME_MATERIAL_FACTS_UNSET, year: YEAR }, [], []).find(system => system.id === 'roof')?.rows.find(row => row.offer.partId === 'covering')
  assert.deepEqual(covering?.scopeIds ?? [], SCOPES_BY_EXISTING_ROOF[roofType].filter(id => SCOPE_INSTALLS[id]!.installs[0]!.part === 'covering'), `R81 holds for ${roofType}`)
}
assert.equal(windowsRow(state({ property: sixties })).kinds[SCOPE_IDS.windowReplacement], 'saves-energy')
assert.equal(windowsRow(state({ property: { ...sixties, windowsType: 'double' } })).kinds[SCOPE_IDS.windowReplacement], 'like-for-like')
const roofRow = (efficiencyUpgrades: EfficiencyUpgradeId[]) => upgradeRows(facts(state({ property: sixties })), [], efficiencyUpgrades).find(system => system.id === 'roof')!.rows.find(row => row.offer.partId === 'covering')!
assert.equal(roofRow(['cool-roof']).kinds[SCOPE_IDS.roofTearOff], 'saves-energy')
assert.equal(roofRow([]).kinds[SCOPE_IDS.roofTearOff], 'like-for-like', 'cool off: like for like')
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.** Update the existing `partOffers`, `keepOffered`, `scopePick` and `scopePreviewPatch` assertions to the new signatures. The R81 assertions keep their expected sets.
- [ ] **Step 4:** Both trade-scene scripts, `pnpm tsc`, `pnpm lint`. Expected: pass.
- [ ] **Step 5: Commit**: `feat(trade-scenes): offers follow every material the home has and its wear, and one write keeps the picks in step`.

### Task 7: Home › Current materials, one list with wear dots (§6.1)

**Files:**
- Create in `F/ui/components/panel/`: `wear-header.tsx`, `wear-dots.tsx`, `material-row.tsx`, `material-choices.tsx`.
- Create: `F/constants/wear-tones.ts` (`WEAR_TONES = { new: 'success', good: 'success', fair: 'attention', worn: 'danger', failing: 'danger' } satisfies Record<Wear, StatusTone>`; the tones are `src/shared/constants/status-tones.ts:1`'s) *(ST)*; `F/hooks/use-crawl-camera-focus.ts` (`useCrawlCameraFocus(open: boolean)`: writes `cameraFocus: 'under-floor'` while open, and `null` on close and on unmount, so a tab switch or a folded card never leaves the camera low) *(ST)*.
- Modify: `F/ui/components/panel/materials-section.tsx`, `F/constants/home-scene-copy.ts`, `scripts/verify-trade-scene.ts` (`SAMPLE_ARGS` gains a three-string sample, because the copy walk at `:568-589` only calls functions it has samples for, and `band` and `dotLabel` take three) *(ST)*.

**Interfaces:**
- Consumes: `targets.home` (`useSceneTargets`), `HOME_MATERIALS`, `bandsOf`, `ageBandOf`, `useSetHomeMaterial`, `useSetProperty`, the field primitives, `WEAR_LABELS`, and the option label maps.
- **`MaterialsSection()`:**
  - one `WearHeader`, then one `MaterialRow` per material in `targets.home`, in `HOME_MATERIAL_IDS` order;
  - one row open at a time, held in local state as `ScopesAndAddons` holds its open row;
  - the `crawl-insulation` row calls `useCrawlCameraFocus(open)`; Task 8's Foundation row does too.
- **`WearHeader()`:** `sticky top-0`, on `bg-(--card)` (a sticky strip inside the card must not climb a rung, `docs/design-system/theme-conventions.md`). Five columns aligned to the dots; New, Fair and Failing carry `WEAR_LABELS`, and Good and Worn a small tick.
- **`WearDots({ material, label })`:** a Radix `RadioGroup` (`orientation="horizontal"`, arrow keys) of five 36 px targets.
  - Each dot is coloured by its step through `toneClasses(WEAR_TONES[wear])`.
  - The picked dot is filled; the `eraWear` dot gets a dashed ring when no wear is recorded.
  - Each `aria-label` is `HOME_MATERIALS_COPY.dotLabel(name, wear, years)`, for example "Roof & gutters: Good, 5–10 years".
  - It is disabled when the material is `absent`.
- **`MaterialRow`:**
  - line 1: the name and a chevron, as a button with `aria-expanded`;
  - line 2: what it is, the option label (plus " · gutters" / " · no gutters" on the roof, " · 4 ton" on heating & cooling);
  - line 3: `"<Wear> · <from>–<to> yrs"` (`<from>+ yrs` for Failing), or `setWear`, or `nothingToRate`;
  - the dots sit on the right.
- **`MaterialChoices({ id })`** is the open row:
  - **roof:** the existing roof material tray (or the flat read-out) and a slim Gutters pair; no surface, since the existing roof is never cool;
  - **attic insulation:** the `ScaleField`;
  - **windows, exterior paint, ducts, crawl insulation:** a slim pair or tray of their options with "Not sure" (writes `null`);
  - **heating & cooling:** the system tray (now with Package unit), an Equipment tray (central only), and an AC size slim triple (`'3' | '4' | '5'`) when the system has an AC (`hasOutdoorUnit`, or a package unit).

  Under the choices, `backToEraGuess` is shown only when the material has a recorded wear or a recorded replaceable option.
- **Copy:**
  ```ts
  // HOME_MATERIAL_LABELS is Task 5's
  HOME_MATERIALS_COPY = {
    setWear: 'Set its condition',
    nothingToRate: 'Nothing to rate',
    backToEraGuess: 'Back to the era guess',
    gutters: 'Gutters',
    acSize: 'AC size',
    band: (wear: string, from: string, to: string) => `${wear} · ${from}–${to} yrs`,
    bandFrom: (wear: string, from: string) => `${wear} · ${from}+ yrs`,
    dotLabel: (material: string, wear: string, years: string) => `${material}: ${wear}, ${years}`,
  }
  ```

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`, both scripts.
- [ ] **Step 3: Playwright** at 1440×900, 1024×768, 820×1180 and 390×844 (a 372 px card) on Home › Current materials, light and dark. Each check gets a shot `SDD/shots/t7-*.png`, paired with its study reference:
  - **no row wraps:** the name column is at least 150 px and the dots 5 × 36 px;
  - **the header stays put** while the list scrolls;
  - **arrow keys** move a dot group;
  - **the era refill:** pick 1950–1978, set Windows to Double; the windows line reads "Set its condition". Then set it Good and switch the era to Post-2014: windows stay Good and the ducts' dashed dot moves;
  - **the roof's era guess:** "Back to the era guess" on the roof leaves the roof material tray's value.
- [ ] **Step 4: Commit**: `feat(trade-scenes): current materials is one list, each material rated on five dots under a header that stays put`.

### Task 8: Upgrades grouped by system; Upkeep & Bills notes (§6.2, §6.3, §7.6)

**Files:**
- Create:
  - `F/ui/components/fields/glyphs/part-glyph.tsx`, drawn like `HvacGlyph` with `FIELD_GLYPH_STROKE` *(ST)*;
  - `F/ui/components/panel/offer-kind-mark.tsx`;
  - `F/ui/components/panel/shingle-colors.tsx`.
- Modify: `F/constants/field-glyphs.ts` (a `part` key: the paths from `SDD/studies/scope-icons.txt`, keyed `covering | deck | gutter | radiant-barrier | attic-insulation | air-sealing | glazing | paint | duct-runs | floor-insulation`; the heating & cooling row reuses `FIELD_GLYPHS.hvac.central`; a lucide icon where one fits, spec §6.3) *(ST)*, `scopes-and-addons.tsx`, `scope-or-addon-row.tsx`, `repairs-row-field.tsx` (if the note needs room), `F/constants/home-scene-copy.ts`.

**Interfaces:**
- **`ScopesAndAddons()`:**
  - renders `upgradeRows(facts, picks, efficiencyUpgrades)`, one titled system per `HOME_SYSTEM_LABELS`;
  - one row open across all systems;
  - `package-unit` and `air-handler` use `FIELD_GLYPHS.hvac.central`;
  - the Foundation row calls `useCrawlCameraFocus(open)` (Task 7).
- **`ScopeOrAddonRow`** takes a row from `upgradeRows` instead of computing offers:
  - **the glyph** sits in a soft 32 px tile, which turns success-tinted once a pick is made;
  - **the existing-state line** reads `"<part label> · <WEAR_LABELS[wear in force]>"` when the part has a material, or the part's label and Part condition as today. The covering row keeps its special case for a metal roof and an unset roof type (`scope-or-addon-row.tsx:57-60`) *(ST)*;
  - **a picked row** shows its verb and an `OfferKindMark` (success tint for Saves energy, muted for Like for like);
  - **each option** in the open row shows its own mark;
  - **the cool roof chip** (`EfficiencyUpgradeChip`, Task 1b) shows on every shingle and torch down pick, on by default (spec §11.6);
  - **the ducts row** shows a second `EfficiencyUpgradeChip` labelled `EFFICIENCY_UPGRADE_LABELS['r8-ducts']` under its options, writing through `efficiencyUpgradePatch(state, 'r8-ducts', on)`. It is enabled once the ducts scope is picked;
  - **shingles:** when the picked covering scope installs `cool-shingle` (a shingle pick with the cool roof on), the open row adds `ShingleColors`; with it off, the grid hides.
- **`ShingleColors()`:**
  - a slim pair of `SHINGLE_LINE_LABELS = { cool: 'Duration COOL', 'cool-plus': 'Duration COOL Plus' }`;
  - a grid of 28 px swatches from `OWENS_CORNING_SHINGLES` for that line, a radio group writing `homeMaterials.shingleColor` through `{ kind: 'fact' }`;
  - under it, the picked colour's name and one of two copy functions, each taking the SRI as a string: `SHINGLE_COPY.sriMeetsLa(sri)` = `Aged SRI ${sri}: meets Title 24 and the City of LA's 20`, and `SHINGLE_COPY.sriMeetsTitle24(sri)` = `Aged SRI ${sri}: meets Title 24`. The component picks one with `agedSri >= LA_MIN_AGED_SRI` (Task 2), so the rule is not in the copy *(ST)*.

  Swatch fills are the data's hex values, the one place a colour is not a token, and the file says why.
- **Upkeep & Bills:** `RepairsRowField` shows the note from Task 5. Nothing else changes.

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`, both scripts.
- [ ] **Step 3: Playwright** at 1440×900, 1024×768, 820×1180 and 390×844, light and dark, each shot paired with its reference (`SDD/shots/t8-*.png`):
  - the groups and their glyphs;
  - a windows pick on single pane reads Saves energy; on double, Like for like;
  - a New material reads "Already new";
  - a wall unit reads its line;
  - the shingle colour grid under a tear-off, and gone with the cool roof off;
  - the cool roof chip on both a shingle and a torch down pick, on by default;
  - the R-8 chip under a ducts pick;
  - Upkeep & Bills notes read "Shingle · Worn".
- [ ] **Step 4: Commit**: `feat(trade-scenes): the build's upgrades are grouped by system, each pick marked as saving energy or like for like`.

### Task 9: Every existing part looks its wear (§7.1)

**Files:**
- Modify:
  - `F/lib/part-state.ts`;
  - `F/constants/home-palette.ts`;
  - `F/lib/shingle-layout.ts` (and `shake-layout.ts`, `tile-layout.ts` if they read `worn`);
  - `F/types.ts` (`CourseArea.worn: boolean` → `wear: number`);
  - the home-kit parts that read `worn`: covering, deck, gutter and insulation (grep `.worn`);
  - `house-shell.tsx` (window frame and glass, paint);
  - `condenser-unit.tsx`;
  - `attic-ducts.tsx`.
- Create: `F/constants/wear-looks.ts`, `F/ui/lib/worn-color.ts` (it uses three's `Color`, which pure `lib/` may not import; `F/ui/lib/thermal-paint-color.ts` is the precedent) *(ST)*.
- Test: `scripts/verify-trade-scene.ts`.

**Interfaces:**
- `WEAR_AMOUNT = { new: 0, good: 0.25, fair: 0.5, worn: 0.75, failing: 1 } satisfies Record<Wear, number>`, in `wear-looks.ts`.
- `PartState` becomes `{ material: string | null, wear: number }`:
  - installed or absent is 0;
  - retained or worn is `WEAR_AMOUNT[part.wear ?? 'worn']`.
- `wornColor(fresh: string, worn: string, wear: number): string` is `new Color(fresh).lerp(new Color(worn), wear / WEAR_AMOUNT.worn)`, not clamped. The palette's existing `…Worn` tones are the Worn look, and Failing goes a third past them (t ≈ 1.33). If a channel leaves 0–1, clamp that channel only *(ST)*.
- **Shingle layout:** the missing-tab share (0.05) and the lifted-tab share scale by `wear / 0.75`, and the shade spread by `wear`.
- **New worn looks** (strength is the builder's, tuned by screenshot):
  - windows: frame tone and glass roughness;
  - paint: fade, chalk and hairline cracks from Worn;
  - condenser and package unit: a dusty case;
  - ducts: dull grey with sag for `original-flex`;
  - crawl batts: sag (Task 11 draws them).
- The Tri Pros build draws installed parts at 0.

- [ ] **Step 1: Write the failing check:**

```ts
const part = (condition: PartCondition, wear?: Wear): ResolvedPart[] => [{ id: 'covering', group: 'roof', role: 'surface', material: 'shingle', condition, label: '', detail: '', thermal: null, water: null, ...(wear ? { wear } : {}) }]
assert.equal(partState(part('installed', 'failing'), 'covering').wear, 0, 'the build always draws new')
assert.equal(partState(part('worn'), 'covering').wear, 0.75, 'unset reads as Worn')
assert.equal(partState(part('retained', 'new'), 'covering').wear, 0)
assert.equal(partState(part('worn', 'failing'), 'covering').wear, 1)
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Scripts, `pnpm tsc`, `pnpm lint`. Then a screenshot round at 1280×800 and 390×844: Complete and Partly open, the roof and windows at each of the five wears, Today and the Tri Pros build (`SDD/shots/t9-*.png`). Report the strengths you settled on.
- [ ] **Step 5: Commit**: `feat(trade-scenes): every existing part looks its wear, so the build's new part reads as new`.

### Task 10: The build's efficiencyUpgrades on the house (§7.2)

**Files:**
- Create:
  - `F/ui/components/home-kit/package-unit.tsx` (a code-built stand-in);
  - `F/constants/home-equipment-sizes.ts` (`AC_SCALE = { 3: …, 4: …, 5: … }`, `PACKAGE_UNIT` size and roof placements).
- Modify:
  - `home-kit.tsx`, `house-shell.tsx`, `home-equipment.tsx`, `condenser-unit.tsx`, `attic-ducts.tsx`;
  - `F/lib/has-outdoor-unit.ts` (it already returns false for `'package-unit'`; only its comment changes to say why) *(ST)*;
  - `F/constants/home-palette.ts` (`ductSilver`, `paintCool`);
  - `F/lib/home-roof-layout.ts` or the covering colour reader (the shingle colour).

**Interfaces:**
- **Windows:** `HouseShell` takes `windowsType` from the resolved windows assembly's glazing (`double-pane` → `'double'`), never the profile.
- **Paint:** the walls take the resolved `exterior-wall` paint. Cool reads as a slightly brighter, cleaner stucco (`HOME_PALETTE.paintCool`, tuned by eye).
- **Ducts:** `AtticDucts({ material })`:
  - `original-flex` is dull and slack;
  - `r6-silver-flex` is bright silver (`ductSilver`, metalness up);
  - `r8-flex` is the same silver at 1.25× the radius.

  `HomeEquipment` draws the ducts for central and package unit.
- **Condenser:** `CondenserUnit` scales its model by `AC_SCALE[acTons]`; an unset size is today's scale.
- **Package unit:** drawn for `hvacType === 'package-unit'` and sized by `AC_SCALE`. No ground condenser and no attic air handler.
  - On a low-slope roof it sits on the flat roof.
  - On a gable it sits on the slope facing the default camera, on a small level curb.
  - Its look follows the heating-cooling wear (Task 9's dusty case).
- **Shingle colour:** an installed `cool-shingle` covering in the Tri Pros build takes the picked Owens Corning colour's hex as its new tone. With none picked, or a regular `shingle` installed (cool off), it keeps today's new tone. The existing roof keeps its worn tone.

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`, scripts. Then screenshots at 1280×800, Today and the build (`SDD/shots/t10-*.png`):
  - windows swap;
  - paint swap;
  - original → R-6 → R-8 ducts in Partly open;
  - 3 / 4 / 5 ton side by side;
  - package unit on gable and flat;
  - three shingle colours, and a tear-off with the cool roof off;
  - a package unit at 390×844.
- [ ] **Step 3: Commit**: `feat(trade-scenes): the build swaps windows, paint, ducts and the system on the house, sized and coloured as picked`.

### Task 11: The crawl space: batts, thermal paint and a low camera (§7.3)

**Files:**
- Create: `F/ui/components/home-kit/crawl-insulation.tsx`.
- Modify:
  - `F/ui/components/home-kit/foundation.tsx`;
  - `F/constants/home-temperatures.ts` (`CRAWL_AIR`);
  - `F/constants/home-thermal-zones.ts` (zones `crawl` and `crawl-floor`);
  - `F/lib/home-paint-temperatures.ts`;
  - `F/ui/components/home-kit/home-camera-rig.tsx`;
  - `F/constants/home-anchors.ts` (only if the `under-floor` framing needs retuning).
- Test: `scripts/verify-trade-scene.ts`.

**Interfaces:**
- **`CrawlInsulation({ wear })`** draws batts between the floor joists on a raised home, shown in Partly open, sagging by `wear`.
- **`CRAWL_AIR`** (R77, R43): `{ inland: { summer: 72, winter: 50 }, coastal: { summer: 68, winter: 53 } }`; Normal is the mean of the two.
- **`homePaintTemperatures` paints:**
  - `crawl` at `CRAWL_AIR`;
  - the foundation wall's outside face as outside air;
  - `crawl-floor` (the floor's underside): within 1 °F of the crawl air when insulated; without insulation, between the crawl air and the room's setpoint (in winter it reads warmer, as heat leaks down).

  Insulation never changes the crawl air.
- **`HomeCameraRig`:** with `cameraFocus === 'under-floor'` (written only by `useCrawlCameraFocus`, Task 7), a raised foundation and `homeView === 'partly-open'`, the framing is `HOME_ANCHORS['under-floor'].framing`; otherwise as today.
  - The target's y stays above 0, so the existing polar clamp keeps the camera above ground. No change to `src/shared/components/scene/`.
  - Closing the row (`cameraFocus: null`) eases back.

- [ ] **Step 1: Write the failing checks:**

```ts
for (const climate of ['inland', 'coastal'] as const) {
  const summer = homePaintTemperatures({ readings: STARTING_HOME_HEAT[climate].summer.readings, equipmentLoad: 0, weather: 'summer', climate })
  assert.equal(summer.crawl, CRAWL_AIR[climate].summer, `${climate}: the crawl reads its ground air`)
  assert.ok(summer.crawl < CLIMATE_PRESETS[climate].summer.setpoint, 'the coolest spot on a summer afternoon')
}
// Already true today (home-anchors.ts:37); it guards a retune, it is not this task's red step.
assert.ok(HOME_ANCHORS['under-floor'].framing.target[1] > 0, 'the crawl framing never looks from below ground')
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4:** Scripts, `pnpm tsc`, `pnpm lint`. Screenshots on a raised 1950–1978 home in Partly open, at 1280×800 and 820×1180, to `SDD/shots/t11-*.png`:
  - the crawl row opened, with the camera eased to the crawl;
  - insulated and not;
  - Thermal in summer and winter;
  - orbit at its lowest, the camera still above ground;
  - switch tab with the crawl row open, then fold the card: the camera eases back each time;
  - 390×844 with the crawl row open.
- [ ] **Step 5: Commit**: `feat(trade-scenes): crawl space insulation between the joists, its own thermal paint, and a camera low enough to show it`.

### Task 12: Glossary, verify sweep and the full screenshot round

**Files:**
- Modify: `scripts/verify-trade-scene.ts` (registry checks), the tracker (working tree only), the memory file `project-3d-trade-scenes.md`, `CONTEXT.md` (the entries the build made stale, Step 4).

- [ ] **Step 1: Registry checks:**

```ts
for (const id of HOME_MATERIAL_IDS) {
  assert.ok(HOME_SCENE_COPY.HOME_MATERIAL_LABELS[id], `${id} has a label`)
  for (const { assembly, part } of HOME_MATERIALS[id].parts) {
    assert.ok(ASSEMBLIES[assembly].parts.some(candidate => candidate.id === part), `${id}: ${assembly} has ${part}`)
  }
}
for (const scopeId of Object.values(SCOPE_IDS)) {
  assert.ok(SCOPE_INSTALLS[scopeId], `${scopeId} installs something`)
  assert.ok(SCOPE_VERBS[scopeId], `${scopeId} has a verb`)
}
assert.ok(HOME_SYSTEMS.flatMap(system => system.rows).every(row => ASSEMBLIES[row.assembly].parts.some(part => part.id === row.part)), 'every system row is a real part')
```

  Also run the "your" / no-solar test over the copy that lives in core, not in the copy file *(ST)*: every part's and part material's copy strings in `ASSEMBLIES` (walk `parts[*]` and `parts[*].materials[*]` copy fields only; the assembly's `appliesTo` is a predicate, not copy) and every `OWENS_CORNING_SHINGLES` name.

  The existing no-three.js check covers the new `lib/` and `constants/` files.
- [ ] **Step 2:** All five scripts (`verify-trade-scene`, `-layout`, `verify-construction-model`, `verify-remodel-roi`, `verify-scope-installs`), `pnpm tsc` and `pnpm lint`. Expected: all pass.
- [ ] **Step 3: The full screenshot round (§8):**
  - the worn looks, Today and the build;
  - Complete and Partly open, raised and slab;
  - the crawl camera;
  - the panel's three changed sections;
  - at 1024×768, 1280×800 and 820×1180.

  Pair each with its study reference, and fix what reads less crisp.
- [ ] **Step 4:** The controller:
  - marks TS3b.4a built in tracker §2 and updates the memory file;
  - updates the `CONTEXT.md` entries the build made stale: **Assembly** gains `windows`; **Existing conditions** are inferred from the property profile and the home materials; **Scopes and addons** rows are grouped by System, and the scene input is `efficiencyUpgrades`, so the naming-clash note goes;
  - adds a note for the energy-impact session in the main checkout's `docs/plans/2026-10-21-proposal-energy-impact-epic.md`, asking the owner before writing it there. The fold (EI-D25) landed in Task 1b at `<commit>`; the "count what's installed" rule (spec §11.7) replaces that plan's `addOnsOnly` and "ducts always on"; §3.1 must be re-run at the new tip.
- [ ] **Step 5: Commit** the script change: `test(trade-scenes): every home material, scope and upgrade row is registered`.

## Spec coverage

| Spec | Task |
|---|---|
| §3 words, `CONTEXT.md` | done at approval; Task 12 checks |
| §4.1 `HOME_MATERIALS` | 1 |
| §4.2 bands, `wearForAge`, `ageBandOf`, era build years | 1 |
| §4.3 era guess, replaceable vs identified, clearing, Back to the era guess | 1, 6 |
| §4.3 existing conditions from wear; Rain at Worn or Failing | 3, 4 |
| §4.4 windows assembly, package form, ducts, crawl, scopes, resolve every assembly | 2, 4 |
| §4.5 `homeMaterials` slot; drawing-only `acTons` and `shingleColor`; package unit on `hvacTypes` | 1, 4 |
| §5.1 offers: Already new, unset as Worn, wall unit | 6 |
| §5.2 Saves energy / Like for like (`installKind`, per part; energy ranks on materials) | 2, 6 |
| §5.3 cuts per part and material, crawl cut, repairs by wear, ducts carry none | 2, 5 |
| §5.3 / §11.6 cool roof folds into the roof's cut; the calculator switch goes | 1b |
| §5.3 / §11.7 count what's installed, radiant barrier's add-on, the energy-impact note | 2, 5, 12 |
| §11.5 the existing roof is never cool | 1, 3 |
| §11.8 the foundation system owns crawl insulation; catalog lag | 0, 2, 6 |
| §6.1 Current materials | 7 |
| §6.2 Upkeep & Bills notes | 5, 8 |
| §6.3 Upgrades grouped, glyphs, marks | 8 |
| §7.1 worn looks | 9 |
| §7.2 efficiencyUpgrades, condenser size, package unit, shingle colour | 10 |
| §7.3 crawl batts, paint, camera | 11 |
| §7.5 copy (no R61 claims) | 5–8 |
| §7.6 Owens Corning data, cool roof on by default, colour picker | 1b, 2, 8, 10 |
| §8 verification | each task; 12 |

Two shapes differ from the spec's sketch, with the same behaviour:
- **Saves energy is decided per installed part.** `installKind`, with an `energyRank` on each material, replaces the spec's `offerKind(material, …)`; both return `OfferKind`. Radiant barrier, which belongs to no home material, is judged the same way (air sealing has no rank, so it never saves), and R-6 → R-8 can still save.
- **`addOns` becomes `efficiencyUpgrades`** (Task 1b). Bill cuts now come from what the build installs, so the input only says which efficiency upgrade options are on: the cool roof (on by default) and R-8.
