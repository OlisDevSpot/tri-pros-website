# Covering wear and the tile reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every old roof covering shows its own kinds of wear at amounts the rep sets, and a tile reset draws the same roof, clean and straight, with its cracked and broken tiles replaced.

**Architecture:** Covering wear copies paint wear: levels on `HomeMaterialFacts`, a starting table by Condition, and one in-force function. A `CoveringLook` (a `PartState` plus the levels and a `reset` flag) replaces `PartState` on the roof components. The layouts turn levels into piece positions. One shader injection on the covering's own material draws dirt, cracks and broken corners, so a covering stays at one instanced draw per course type.

**Tech Stack:** react-three-fiber, three.js (`MeshStandardMaterial.onBeforeCompile`, WebGL only, which is what the home scene uses), TypeScript, assertion scripts run with `pnpm tsx`.

**Spec:** `docs/superpowers/specs/2026-11-10-covering-wear-and-tile-reset-design.md`

**Order (owner, 2026-11-11):** this builds after the Gutters plan (`docs/superpowers/plans/2026-11-09-trade-scene-gutters.md`) has shipped. Gutters edits `HomeMaterialFacts`, `HOME_MATERIAL_FACTS_UNSET`, `DrawingOnlyMaterialFact`, the `kept` rule in `part-state.ts`, the roof props, `existing-chip.tsx`, `home-palette.ts` and both scene checks. Before Task 0, re-derive every line reference in this plan against the tree, and keep the `kept` rule's gutter use working when Task 2 extends it.

## Global Constraints

- Only Oliver starts a dev server. Never run `pnpm build`. Verify with the `pnpm tsx scripts/…` checks, then `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` and `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock env CI=1 pnpm lint`.
- Never open the 3D scene in a software-rendered browser. It crashed the machine. The owner judges the look on the running page.
- The worktree is shared with other sessions that keep uncommitted work in it. Never `git stash`, `git checkout -- <path>`, `git restore`, `git reset`, `git add -A`/`git add .`, `git commit --amend` or `git commit -- <path>` (that last one commits the whole file, other sessions' hunks included). Commit with `.superpowers/sdd/2026-11-06-trade-scene-colour-picking/commit-own.sh <message-file> <path>…`, using `patch:<file>` for a file that also holds another session's hunks. Give the commit a 300000 ms timeout (the pre-commit hook is slow), then check `git show --stat HEAD`.
- After any scripted edit, run `git diff --shortstat` on the file. No DB writes, for testing or otherwise.
- Comments say why, never what, and never cite plans, specs or tasks.
- One component per file, named exports, `constants/` and `lib/` placement as the feature already does it.
- Covering wear is drawing only. `scene-savings.ts`, `part-offers.ts`, `part-list.tsx` and `relative-water-flow.ts` do not change.
- A covering stays one instanced draw per course type. No draw call per tile, no specks as objects.
- Shingle Missing at Moderate is 5% of tabs, as it is today.
- Every number that shapes the look is a working number, marked so the way `WEAR_LOOKS` marks them.
- The named failure: dirt that looks like a grey film painted over the roof.
- Out of scope: `meeting-visualizations`, the garage roof, flat-roof Blisters and Open seams, leaves, streaks, lichen, bloom.

## Review Focus

1. A tile reset left on a home whose covering is not tile. It draws new tile with no `reused`, never a weathered version of a roof that was not there. Test in Task 2.
2. The rep sets levels on one roof type, then changes it. Only the new roof's kinds count, nothing throws, and a metal roof (drawn as shingle) offers no controls and draws shingle's starting amounts, never a level set on another roof. Tests in Task 1.
3. The rep moves one level. Only that kind changes: no other tile, tab or shake moves, re-shades or appears. Tests in Tasks 3 and 4.
4. A redeck on its own keeps the old covering's wear and dirt, and a tear-off on a tile home shows none. Tests in Tasks 2 and 3.
5. The near slope drawn in two spans while it peels open. Each tile's crack and broken values stay with that tile, not with its index in the whole layout. Test in Task 5.

---

### Task 0: A wood shake roof is never better than Worn

Owner, 2026-11-11: "wood shakes can never be in fair or better condition. They start in 'worn' and are often 'failing' (wood shakes have been against code for a few decades so no new ones exist)." An unrated wood shake roof guesses Failing whatever the home's age (owner's pick).

**Files:**
- Create: `src/shared/modules/construction/core/constants/roof-wear-limits.ts`
- Create: `src/shared/modules/construction/core/lib/wear-choices.ts`
- Modify: `src/shared/modules/construction/core/lib/resolve-home-materials.ts:66-81` (`resolveOne`)
- Modify: `src/shared/modules/construction/core/constants/home-materials.ts:12` (drop the `woodshake` bands)
- Modify: `src/features/trade-scenes/ui/components/panel/wear-dots.tsx`
- Modify: `src/features/trade-scenes/lib/scene-change-slots.ts:84`
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts:178`
- Test: `scripts/verify-construction-model.ts`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `ROOF_WEAR_LIMITS: Partial<Record<RoofType, { choices: readonly Wear[], guess: Wear }>> = { woodshake: { choices: ['worn', 'failing'], guess: 'failing' } }`, with a why comment (no wood shake has gone on in decades, so none is newer than Worn).
  - `wearChoices(id: HomeMaterialId, property: PropertyProfile): readonly Wear[]`: the limit's `choices` for the roof of a limited roof type, else `wears`.
  - `HOME_MATERIALS_COPY.dotLabelNoAge(material: string, wear: string): string`, `${material}: ${wear}`.

- [ ] **Step 1: Write the failing tests.** In `scripts/verify-construction-model.ts`, beside the band checks at :613:

```ts
const shake = (yearBuilt: YearBuiltRange, wear?: Wear) => resolveHomeMaterials({ property: profile({ roofType: 'woodshake', yearBuilt }), materials: { ...HOME_MATERIAL_FACTS_UNSET, wear: wear ? { roof: wear } : {} }, year: 2026 }).roof
assert.equal(shake('Post-2014')?.wear, 'failing', 'an unrated wood shake roof guesses Failing, however young the home')
assert.equal(shake('Post-2014')?.wearBasis, 'era-typical')
assert.equal(shake('1950-1978', 'worn')?.wear, 'worn', 'the rep can lower it to Worn')
assert.equal(shake('1950-1978', 'good')?.wear, 'worn', 'a better level set on another roof type is raised to Worn')
assert.deepEqual(wearChoices('roof', profile({ roofType: 'woodshake' })), ['worn', 'failing'])
assert.deepEqual(wearChoices('roof', profile({ roofType: 'tile' })), wears)
assert.deepEqual(wearChoices('windows', profile({ roofType: 'woodshake' })), wears, 'only the roof is limited')
```

In `scripts/verify-trade-scene.ts`, beside `shakeFacts` at :2941: the `wear:roof` slot of `sceneChangeSlots` on a wood shake home lists exactly the values `['worn', 'failing']`, and on a shingle home all five.

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-construction-model.ts`. Expected: FAIL, `wearChoices` does not exist.

- [ ] **Step 3: Implement.** In `resolveOne`, a roof with a limit takes `limit.guess` as its `eraWear` without reading bands, and a recorded wear outside `limit.choices` becomes `limit.choices[0]` (basis stays `recorded`). Remove `woodshake` from the roof's `bands`; nothing reads it once the limit is in. `WearDots` renders `wearChoices(material.id, property)` (grid columns follow the count, arrow keys cycle within them) and, for a limited roof, labels each dot with `dotLabelNoAge`, since its level no longer follows age. The Modify slot at `scene-change-slots.ts:84` lists `wearChoices` too.

- [ ] **Step 4: Run** `pnpm tsx scripts/verify-construction-model.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts`, then tsc and lint. Expected: all pass.

- [ ] **Step 5: Commit** by explicit path: `feat(construction): a wood shake roof is Worn or Failing, and guesses Failing`.

### Task 1: The rep can set covering wear

**Files:**
- Modify: `src/shared/modules/construction/core/constants/enums.ts:60-64`
- Modify: `src/shared/modules/construction/core/types.ts:8,257`
- Modify: `src/shared/modules/construction/core/constants/home-materials.ts:74`
- Modify: `src/features/trade-scenes/types.ts:537,817`
- Create: `src/features/trade-scenes/constants/covering-wear.ts`
- Create: `src/features/trade-scenes/lib/covering-wear-in-force.ts`
- Modify: `src/features/trade-scenes/lib/home-material-patch.ts:53-61`
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts:207`
- Create: `src/features/trade-scenes/ui/components/panel/covering-wear-fields.tsx`
- Modify: `src/features/trade-scenes/ui/components/controls/existing-chip.tsx:62`
- Modify: `scripts/verify-trade-scene.ts:563,565,567,3198`
- Create: `scripts/verify-covering-wear.ts`

**Interfaces:**
- Produces:
  - `coveringWearKinds = ['dirt', 'cracked', 'misaligned', 'broken', 'missing', 'curling', 'split'] as const`, `type CoveringWearKind` (enums.ts).
  - `HomeMaterialFacts.coveringWear: Partial<Record<CoveringWearKind, PaintWearLevel>>`.
  - `type CoveringWear = Record<CoveringWearKind, PaintWearLevel>` (features `types.ts`).
  - `COVERING_WEAR_START: Record<Wear, CoveringWear>` and `COVERING_WEAR_KINDS_BY_ROOF: Record<RoofType, readonly CoveringWearKind[]>` (`constants/covering-wear.ts`).
  - `coveringWearInForce(material: ResolvedHomeMaterial | undefined, recorded: Partial<CoveringWear>, roofType: RoofType): CoveringWear`. A recorded level counts only for a kind in `COVERING_WEAR_KINDS_BY_ROOF[roofType]`; every other kind takes the start. So a metal roof, drawn as shingle (`COVERING_BY_ROOF`), draws shingle's starting amounts and never a level the rep set on another roof.
- The levels are the paint ones, reused as they are: `paintWearLevels`, `PaintWearLevel`, `PAINT_WEAR_SHARE`, `PAINT_WEAR_LEVEL_LABELS`, `ScaleField`. No rename.
- The levels are one flat map across coverings. A kind the current covering does not have is ignored, and comes back if the roof type does.
- Every caller passes `property.roofType ?? 'shingle'`, the fallback `bandsOf` and the roof inference already use.

- [ ] **Step 1: Write the failing test** in `scripts/verify-covering-wear.ts`, using `import assert from 'node:assert/strict'` and `@/` imports as `scripts/verify-trade-scene-layout.ts` does. Later tasks use a `near` helper: copy it from `scripts/verify-trade-scene.ts:629`.

```ts
const YEAR = 2026
const tileProperty = { ...HOME_SCENE_DEFAULTS.property, roofType: 'tile' as const }
const roofAt = (wear: Wear) => resolveHomeMaterials({ property: tileProperty, materials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: wear } }, year: YEAR }).roof

assert.deepEqual(COVERING_WEAR_START.new, { dirt: 'none', cracked: 'none', misaligned: 'none', broken: 'none', missing: 'none', curling: 'none', split: 'none' })
assert.deepEqual(COVERING_WEAR_START.good, { dirt: 'light', cracked: 'none', misaligned: 'none', broken: 'none', missing: 'none', curling: 'none', split: 'none' })
assert.deepEqual(COVERING_WEAR_START.fair, { dirt: 'light', cracked: 'light', misaligned: 'light', broken: 'none', missing: 'none', curling: 'light', split: 'light' })
assert.deepEqual(COVERING_WEAR_START.worn, { dirt: 'moderate', cracked: 'moderate', misaligned: 'moderate', broken: 'light', missing: 'moderate', curling: 'moderate', split: 'moderate' })
assert.deepEqual(COVERING_WEAR_START.failing, { dirt: 'heavy', cracked: 'heavy', misaligned: 'heavy', broken: 'moderate', missing: 'heavy', curling: 'heavy', split: 'heavy' })

assert.deepEqual(COVERING_WEAR_KINDS_BY_ROOF, {
  tile: ['dirt', 'cracked', 'misaligned', 'broken'],
  shingle: ['dirt', 'missing', 'curling'],
  woodshake: ['dirt', 'split', 'curling'],
  flat: ['dirt'],
  metal: [],
})

assert.deepEqual(coveringWearInForce(roofAt('fair'), {}, 'tile'), COVERING_WEAR_START.fair, 'the wear sets the start')
assert.equal(coveringWearInForce(roofAt('worn'), { dirt: 'heavy' }, 'tile').dirt, 'heavy', 'a level the rep set wins')
assert.equal(coveringWearInForce(roofAt('worn'), { dirt: 'heavy' }, 'tile').cracked, 'moderate', 'and leaves the others at the start')
assert.deepEqual(coveringWearInForce(roofAt('new'), { dirt: 'heavy' }, 'tile'), COVERING_WEAR_START.new, 'a new covering shows none')
assert.deepEqual(coveringWearInForce(undefined, { dirt: 'heavy' }, 'tile'), COVERING_WEAR_START.new, 'no roof, no wear')

const patchState = (coveringWear: HomeMaterialFacts['coveringWear']) => ({ property: tileProperty, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, coveringWear, paintWear: { stains: 'heavy' as const }, wear: { 'roof': 'worn' as const, 'exterior-paint': 'worn' as const } }, proposedScopeIds: [], efficiencyUpgrades: [] })
assert.deepEqual(homeMaterialPatch(patchState({ dirt: 'heavy' }), { kind: 'wear', id: 'roof', wear: 'good' }, YEAR).homeMaterials?.coveringWear, { dirt: 'heavy' }, 'a wear change keeps the rep\'s levels')
const roofBack = homeMaterialPatch(patchState({ dirt: 'heavy' }), { kind: 'era-guess', id: 'roof' }, YEAR)
assert.deepEqual(roofBack.homeMaterials?.coveringWear, {}, 'back to the era guess clears them')
assert.equal(roofBack.homeMaterials?.wear.roof, undefined, 'with the wear')
assert.deepEqual(roofBack.homeMaterials?.paintWear, { stains: 'heavy' }, 'and leaves the paint\'s alone')
assert.deepEqual(homeMaterialPatch(patchState({ dirt: 'heavy' }), { kind: 'era-guess', id: 'exterior-paint' }, YEAR).homeMaterials?.coveringWear, { dirt: 'heavy' }, 'the paint\'s era guess leaves the roof\'s alone')

const recordedOnTile = { cracked: 'heavy', missing: 'heavy' } as const
assert.equal(coveringWearInForce(roofAt('worn'), recordedOnTile, 'tile').cracked, 'heavy')
assert.equal(coveringWearInForce(roofAt('worn'), recordedOnTile, 'tile').missing, 'moderate', 'a shingle kind recorded under tile does not count on tile')
assert.equal(coveringWearInForce(roofAt('worn'), recordedOnTile, 'shingle').missing, 'heavy', 'and comes back when the roof is shingle')
assert.equal(coveringWearInForce(roofAt('worn'), recordedOnTile, 'shingle').cracked, 'moderate', 'where the tile kind stops counting')
assert.deepEqual(coveringWearInForce(roofAt('worn'), recordedOnTile, 'metal'), COVERING_WEAR_START.worn, 'metal draws shingle\'s starting amounts, never a recorded level')
```

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-covering-wear.ts`. Expected: FAIL, the new modules do not exist.

- [ ] **Step 3: Add the kinds, the fact and the table.** Add `coveringWear: {}` to `HOME_MATERIAL_FACTS_UNSET`. Add `'coveringWear'` to `DrawingOnlyMaterialFact`. Write `coveringWearInForce` the way `paintWearInForce` is written.

- [ ] **Step 4: Clear the levels with the era guess.** In `homeMaterialPatch`, replace the `cleared` line with a lookup `{ 'exterior-paint': { paintWear: {} }, 'roof': { coveringWear: {} } }` keyed by `change.id`, and use `cleared` in both branches. The roof has `replaceable: null`, so today's `field === null` branch never sees `cleared`. Keep the existing comment's reason.

- [ ] **Step 5: Add the controls.** `COVERING_WEAR_LABELS` in `home-scene-copy.ts`: Dirt, Cracked, Misaligned, Broken, Missing, Curling, Split. `CoveringWearFields` follows `PaintWearFields` exactly, reading `state.homeMaterials.coveringWear`, `useSceneTargets().home.roof`, and `COVERING_WEAR_KINDS_BY_ROOF[state.property.roofType ?? 'shingle']` (the same fallback the roof inference uses). In `existing-chip.tsx`, render `{rated.id === 'roof' && <CoveringWearFields />}` beside the paint line.

- [ ] **Step 6: Extend the drawing-only checks** in `scripts/verify-trade-scene.ts`: add `coveringWear: { dirt: 'heavy' }` to the `select` call at line 563, the key to `DrawingOnlyKey` and `drawingOnly` at 565-567, and a `{ kind: 'fact', patch: { coveringWear: { dirt: 'heavy' } } }` change to the list at 3198.

- [ ] **Step 7: Run** `pnpm tsx scripts/verify-covering-wear.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts`, then tsc and lint. Expected: all pass.

- [ ] **Step 8: Commit** every file above by explicit path: `feat(trade-scenes): the rep sets each roof covering's kinds of wear, the way paint wear works`.

### Task 2: A tile reset keeps its tiles

**Files:**
- Modify: `src/shared/modules/construction/core/types.ts:116-146`
- Modify: `src/shared/modules/construction/core/constants/scope-installs.ts:13-19`
- Modify: `src/shared/modules/construction/core/lib/resolve-assembly.ts:66-131`
- Modify: `src/features/trade-scenes/lib/part-state.ts:25`
- Modify: `scripts/verify-construction-model.ts:753`, `scripts/verify-trade-scene.ts:1642` (labels the reset makes false)
- Test: `scripts/verify-covering-wear.ts`

**Interfaces:**
- Produces: `ScopeInstall.installs[].reuses?: true`, `ResolvedPart.reused?: true` (the pair follows `replacesWood` ↔ `woodReplaced`). A reused part has `condition: 'installed'`, the existing part's `wear`, and `reused: true`.
- Code says `reused`, never `reset`: the not-drawn "Tile roof reset (repair)" scope (`scope-not-drawn.ts:5`) is a different job that leaves the covering in place.

- [ ] **Step 1: Write the failing test** in `scripts/verify-covering-wear.ts`. Import `ASSEMBLIES` and `SCOPE_IDS` the way `resolve-scene.ts` and `scripts/verify-trade-scene.ts` do.

```ts
const factsFor = (roofType: RoofType) => ({ property: { ...HOME_SCENE_DEFAULTS.property, roofType }, materials: { ...HOME_MATERIAL_FACTS_UNSET, wear: { roof: 'worn' as const } }, year: YEAR })
const roofParts = (roofType: RoofType, scopes: string[], view: 'existing' | 'proposed' = 'proposed') => {
  const facts = factsFor(roofType)
  return resolveAssembly(ASSEMBLIES['roof-attic'], { existing: inferRoofAtticExistingConditions(facts, resolveHomeMaterials(facts)), proposedScopeIds: scopes, view })
}
const coveringOf = (parts: readonly ResolvedPart[]) => parts.find(part => part.id === 'covering')!

const reset = roofParts('tile', [SCOPE_IDS.roofTileReset])
assert.equal(coveringOf(reset).condition, 'installed', 'the part list and savings still read an install')
assert.equal(coveringOf(reset).reused, true)
assert.equal(coveringOf(reset).wear, 'worn', 'it keeps the old tile\'s wear')
assert.equal(partState(reset, 'covering').wear, WEAR_AMOUNT.worn, 'so it draws in the weathered colour')
assert.equal(reset.find(part => part.id === 'underlayment')!.reused, undefined, 'the waterproofing under it is new')
assert.equal(partState(reset, 'underlayment').wear, 0)

assert.equal(coveringOf(roofParts('tile', [SCOPE_IDS.roofTileReset], 'existing')).reused, undefined, 'the existing view reuses nothing')

const onShingle = roofParts('shingle', [SCOPE_IDS.roofTileReset])
assert.equal(coveringOf(onShingle).material, 'tile')
assert.equal(coveringOf(onShingle).reused, undefined, 'there were no tiles to reuse')
assert.equal(partState(onShingle, 'covering').wear, 0, 'so it draws new')

const tearOff = roofParts('tile', [SCOPE_IDS.roofTearOff])
assert.equal(coveringOf(tearOff).reused, undefined, 'a tear-off lays a new covering')
assert.equal(partState(tearOff, 'covering').wear, 0)

const redeck = roofParts('tile', [SCOPE_IDS.roofRedeck])
assert.equal(partState(redeck, 'covering').wear, WEAR_AMOUNT.worn, 'a redeck alone leaves the covering as it was')
```

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-covering-wear.ts`. Expected: FAIL at `reused` being undefined.

- [ ] **Step 3: Implement.** In `TILE_ROOF`, the covering line becomes `{ part: 'covering', material: 'tile', reuses: true }`. In `resolveAssembly`, track a `reusing` set the way `addedTo` is tracked. A part is reused only when it is in `reusing` and `installedMaterial === existing.parts[part.id]?.material`. For a reused part, keep `existing.parts[part.id]?.wear` and add `...(reused ? { reused: true as const } : {})`, the way `woodReplaced` is spread at `resolve-assembly.ts:121`. In `partState`, `kept` also covers `part.reused === true`; Gutters' `drawnGutterWear` shares that rule, so check its tests still pass. Why comments on both new fields in `types.ts`, as their siblings at :139-145 carry: `reuses` puts the home's own pieces back over new work, and a reused part keeps its wear because it is the same material.
  - Relabel `verify-construction-model.ts:753` ("an installed part has no wear") and `verify-trade-scene.ts:1642` ("the build always draws new") to name the exception, and add a reused assert beside each.

- [ ] **Step 4: Run** `pnpm tsx scripts/verify-covering-wear.ts`, `pnpm tsx scripts/verify-construction-model.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, then tsc and lint. Expected: all pass.

- [ ] **Step 5: Commit** by explicit path: `feat(construction): a tile reset keeps the old tiles and their wear`.

### Task 3: Shingles and shakes draw from covering wear

**Files:**
- Create: `src/features/trade-scenes/lib/covering-look.ts`
- Modify: `src/features/trade-scenes/types.ts:191` (`CourseArea`, `CoveringShares`)
- Modify: `src/features/trade-scenes/lib/shingle-layout.ts:12,26,34`
- Modify: `src/features/trade-scenes/lib/shake-layout.ts:11-12,31`
- Modify: `src/features/trade-scenes/lib/home-roof-layout.ts:6`
- Modify: `src/features/trade-scenes/ui/components/home-kit/home-kit.tsx:280,374`
- Modify: `src/features/trade-scenes/ui/components/home-kit/house-roof.tsx:32,49,51`
- Modify the `covering` prop type in `gable-roof.tsx:35`, `roof-steps.tsx:15`, `roof-slope.tsx:39`, `low-slope-roof.tsx:36`
- Modify: `src/features/trade-scenes/ui/components/home-kit/roof-covering.tsx`
- Modify: `src/features/trade-scenes/constants/home-palette.ts` (commit the owner-approved `feltAged` already in the tree)
- Modify: `scripts/verify-trade-scene.ts:1480,1649-1653`
- Test: `scripts/verify-covering-wear.ts`

**Interfaces:**
- Consumes: Task 1's `CoveringWear`, `COVERING_WEAR_START`, `coveringWearInForce`; Task 2's `ResolvedPart.reused`.
- Produces, in `lib/covering-look.ts`:
  - `interface CoveringLook extends PartState { levels: CoveringWear, reused: boolean }`
  - `coveringLook(parts: readonly ResolvedPart[], levels: CoveringWear): CoveringLook`. Levels apply to a retained, worn or reused covering. Any other gets `COVERING_WEAR_START.new`.
  - `coveringShares(levels: CoveringWear): CoveringShares`, each level through `PAINT_WEAR_SHARE`.
  - `coveringDirtShare(look: CoveringLook): number`, which is 0 on a reused covering.
- Produces: `type CoveringShares = Record<CoveringWearKind, number>`; `CourseArea` gains `shares: CoveringShares` and `reused: boolean`.
- `RoofCovering` takes `look: CoveringLook` in place of `material` and `wear`.

- [ ] **Step 1: Write the failing test** in `scripts/verify-covering-wear.ts`.

```ts
const levels = (patch: Partial<CoveringWear>): CoveringWear => ({ ...COVERING_WEAR_START.new, ...patch })
const part = (condition: ResolvedPart['condition'], extra: Partial<ResolvedPart> = {}): ResolvedPart[] => [{ id: 'covering', group: 'roof', role: 'surface', material: 'tile', condition, wear: 'worn', label: '', detail: '', thermal: null, water: null, ...extra }]
const heavy = levels({ dirt: 'heavy', cracked: 'heavy' })

assert.deepEqual(coveringLook(part('retained'), heavy).levels, heavy, 'an old covering shows its wear')
assert.deepEqual(coveringLook(part('installed'), heavy).levels, COVERING_WEAR_START.new, 'a new one shows none')
assert.deepEqual(coveringLook([], heavy).levels, COVERING_WEAR_START.new, 'no covering, none')
assert.deepEqual(coveringLook(part('installed', { reused: true }), heavy).levels, heavy, 'a reused covering still knows what the existing roof showed')
assert.equal(coveringLook(part('installed', { reused: true }), heavy).reused, true)

near(coveringDirtShare(coveringLook(part('retained'), heavy)), PAINT_WEAR_SHARE.heavy, 1e-9, 'an old roof carries its dirt')
assert.equal(coveringDirtShare(coveringLook(part('installed', { reused: true }), heavy)), 0, 'the reset cleans it off')
assert.equal(coveringDirtShare(coveringLook(part('installed'), heavy)), 0, 'a new roof has none')

const courseArea = (patch: Partial<CoveringWear>) => ({ seed: 7, wear: WEAR_AMOUNT.worn, xFrom: 0, xTo: 12, zFrom: -5, zTo: 5, base: 0.1, shares: coveringShares(levels(patch)), reused: false })
const allTabs = layoutShingles(courseArea({}), SHINGLE).length
const moderateMissing = 1 - layoutShingles(courseArea({ missing: 'moderate' }), SHINGLE).length / allTabs
assert.ok(moderateMissing > 0.02 && moderateMissing < 0.08, `moderate Missing is about 5% of tabs, got ${moderateMissing}`)
assert.equal(layoutShingles(courseArea({ curling: 'heavy' }), SHINGLE).length, allTabs, 'Curling removes no tab')
assert.ok(layoutShingles(courseArea({ curling: 'moderate' }), SHINGLE).some(piece => piece.tilt < -0.2), 'Curling lifts tabs')
assert.ok(layoutShingles(courseArea({ missing: 'heavy' }), SHINGLE).length < layoutShingles(courseArea({ missing: 'light' }), SHINGLE).length, 'more goes missing as the level climbs')

// Each control moves only its own kind: a tab is keyed by where it sits, and every tab still there keeps its tilt and shade.
const tabKey = (piece: PieceLayout) => `${piece.x.toFixed(4)}:${piece.z.toFixed(4)}`
const curledNoGaps = new Map(layoutShingles(courseArea({ curling: 'moderate' }), SHINGLE).map(piece => [tabKey(piece), piece]))
const curledGaps = layoutShingles(courseArea({ curling: 'moderate', missing: 'heavy' }), SHINGLE)
assert.ok(curledGaps.every(piece => curledNoGaps.get(tabKey(piece))?.tilt === piece.tilt && curledNoGaps.get(tabKey(piece))?.shade === piece.shade), 'Missing leaves every other tab as it was')
const gapsFlat = layoutShingles(courseArea({ missing: 'moderate' }), SHINGLE)
assert.deepEqual(layoutShingles(courseArea({ missing: 'moderate', curling: 'heavy' }), SHINGLE).map(tabKey), gapsFlat.map(tabKey), 'Curling leaves the gaps where they were')

const flatShakes = layoutShakes(courseArea({}), SHAKE)
assert.ok(flatShakes.every(piece => piece.tilt > -0.2), 'no Curling, no curled shake')
assert.ok(layoutShakes(courseArea({ curling: 'moderate' }), SHAKE).some(piece => piece.tilt < -0.2), 'Curling curls them')
assert.deepEqual(layoutShakes(courseArea({ curling: 'heavy' }), SHAKE).map(piece => [piece.x, piece.z, piece.width, piece.shade]), flatShakes.map(piece => [piece.x, piece.z, piece.width, piece.shade]), 'Curling moves, splits and re-shades no shake')
assert.ok(layoutShakes(courseArea({ split: 'moderate' }), SHAKE).length > flatShakes.length, 'Split draws a shake as two halves')
assert.ok(layoutShakes(courseArea({ split: 'heavy' }), SHAKE).length > layoutShakes(courseArea({ split: 'light' }), SHAKE).length, 'more split as the level climbs')
```

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-covering-wear.ts`. Expected: FAIL.

- [ ] **Step 3: Implement the layouts.** Every tab and shake draws the same fixed run of `random()` calls whatever the levels, as Task 4 does for tiles. Today a missing tab skips its shade roll and a curled shake skips its tilt roll, so one level would move every later piece. Draw a missing tab's rolls before it is skipped, and a shake's tilt roll whether or not it curls.
  - `layoutShingles`: `shares.missing` drives the skip and `shares.curling` the lift, each from its own roll. Moderate Missing stays 5% of tabs, though the gaps fall in different tabs than they do today (told to the owner).
  - `layoutShakes`: `shares.split` scales `splitShare` and `shares.curling` scales the curl. No course sets `splitShare` today, so the home's shakes have never split. Add `splitShare: 0.1, splitGap: 0.012` to `SHAKE` in `lib/home-roof-layout.ts`, as working numbers.
  - Rewrite the comments at `shake-layout.ts:7-8` and `shingle-layout.ts:7-8`, which still reason from the wear. Leave `layoutTiles` alone for now.

- [ ] **Step 4: Thread the look.** `home-kit.tsx`: `const coveringWear = useMemo(() => coveringWearInForce(targets.home.roof, homeMaterials.coveringWear, property.roofType ?? 'shingle'), [targets.home.roof, homeMaterials.coveringWear, property.roofType])`, passed to `HouseRoof` as a new `coveringWear` prop. `house-roof.tsx`: `const covering = useMemo(() => coveringLook(parts, coveringWear), [parts, coveringWear])`. `RoofSlope` passes `look={covering}` to `RoofCovering`.

- [ ] **Step 5: Keep the layout memo on primitives.** In `RoofCovering`, destructure the seven levels from `look.levels` and list them in the `laid` memo's dependencies with `look.material`, `look.wear` and `look.reused`. Build `shares` inside the memo. A new `levels` object on a render must not lay the roof again.

- [ ] **Step 6: Update the old checks.** In `scripts/verify-trade-scene.ts`, `slopeArea` gains `shares: coveringShares(COVERING_WEAR_START.worn), reused: false`. Lines 1649-1653 stop varying `wear` and vary the Missing and Curling levels through `shares`, with the same three claims (more tabs go missing as the level climbs, no lifted tab at None, more lift as the level climbs).

- [ ] **Step 7: Run** `pnpm tsx scripts/verify-covering-wear.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, then tsc and lint. Expected: all pass.

- [ ] **Step 8: Commit.** Run `git diff src/features/trade-scenes/constants/home-palette.ts` first. Expected: only the `feltAged` change. Commit by explicit path, including that file: `feat(trade-scenes): shingles and shakes draw the wear the rep sets; missing shingles show against darker felt`.

### Task 4: Tiles go crooked, crack and break, and a reset straightens them

**Files:**
- Modify: `src/shared/components/scene/types.ts` (`PieceLayout`)
- Modify: `src/shared/components/scene/ui/instanced-pieces.tsx`
- Modify: `src/features/trade-scenes/lib/pieces-in-span.ts`
- Modify: `src/features/trade-scenes/lib/tile-layout.ts`
- Modify: `src/features/trade-scenes/constants/covering-wear.ts`
- Modify: `src/features/trade-scenes/types.ts` (`CoveringPiece`)
- Modify: `src/features/trade-scenes/ui/components/home-kit/roof-covering.tsx`
- Test: `scripts/verify-covering-wear.ts`

**Interfaces:**
- Consumes: Task 3's `CourseArea.shares` and `.reused`, `coveringShares`.
- Produces:
  - `PieceLayout` gains `yaw?: number` (a turn about the roof normal) and `tint?: string` (a piece's own colour in place of the mesh's `color`, still multiplied by `shade`). Rafters and deck boards share `PieceLayout`, so nothing roof-specific goes on it. `InstancedPieces` adds `tint` handling to the layout effect at `instanced-pieces.tsx:48`; a changed tint arrives as new `pieces`, so it re-tints.
  - `interface CoveringPiece extends PieceLayout { crack?: number, broken?: number, replacement?: true }`. `crack` and `broken` are each in (0, 1], the value that places that tile's own crack or broken corner. Never "fresh": in this feature `fresh` already means zero wear (`worn-color.ts:11`).
  - `layoutTiles(area: CourseArea, course: TileCourse): { pans: CoveringPiece[], caps: CoveringPiece[] }`, same name and shape as today.
  - `piecesInSpan<T extends PieceLayout>(pieces: readonly T[], zFrom: number, zTo: number, stretched: boolean): T[]`.
  - `TILE_WEAR` in `constants/covering-wear.ts`, starting numbers: `crackedRate: 0.1`, `brokenRate: 0.035`, `jitter: { x: 0.012, z: 0.014, yaw: 0.03, tilt: 0.025 }`, `slippedRate: 0.1`, `slipped: { x: [0.03, 0.08], z: 0.03, yaw: 0.14, tilt: -0.16 }`, `replacementFreshness: 0.55`.

- [ ] **Step 1: Write the failing test** in `scripts/verify-covering-wear.ts`.

```ts
const tilesAt = (patch: Partial<CoveringWear>, reused = false) => {
  const { pans, caps } = layoutTiles({ ...courseArea(patch), reused }, TILE)
  return [...pans, ...caps]
}
const clean = tilesAt({})
const gridOf = new Map(clean.map((tile, index) => [index, tile]))
const offGrid = (tile: CoveringPiece, index: number) => Math.abs(tile.x - gridOf.get(index)!.x) + Math.abs(tile.z - gridOf.get(index)!.z)
const meanOffGrid = (tiles: readonly CoveringPiece[]) => tiles.reduce((sum, tile, index) => sum + offGrid(tile, index), 0) / tiles.length

assert.ok(clean.every(tile => tile.tilt === -0.05 && !tile.yaw && !tile.crack && !tile.broken && !tile.replacement), 'no wear, every tile straight and whole')
assert.equal(tilesAt({ broken: 'heavy', cracked: 'heavy', misaligned: 'heavy' }).length, clean.length, 'no tile is ever missing')

const crooked = tilesAt({ misaligned: 'moderate' })
assert.ok(crooked.filter((tile, index) => offGrid(tile, index) > 0).length > clean.length * 0.8, 'misalignment runs across the whole roof')
assert.ok(meanOffGrid(tilesAt({ misaligned: 'heavy' })) > meanOffGrid(crooked), 'and scales with the amount')
assert.ok(meanOffGrid(crooked) > meanOffGrid(tilesAt({ misaligned: 'light' })))
assert.ok(crooked.some(tile => tile.tilt <= -0.16), 'some have slipped out of place')
assert.ok(tilesAt({ misaligned: 'heavy' }).every((tile, index) => Math.abs(tile.x - gridOf.get(index)!.x) < TILE.length - TILE.exposure), 'a slipped tile still laps the one below')

const cracked = tilesAt({ cracked: 'moderate' })
assert.ok(cracked.filter(tile => tile.crack).length > clean.length * 0.05, 'cracked tiles are there at Moderate')
assert.ok(tilesAt({ cracked: 'heavy' }).filter(tile => tile.crack).length > cracked.filter(tile => tile.crack).length)
assert.ok(tilesAt({ broken: 'heavy' }).filter(tile => tile.broken).length < clean.length * 0.1, 'broken tiles stay occasional')
assert.ok(tilesAt({ broken: 'light' }).some(tile => tile.broken))
assert.ok(cracked.every(tile => !tile.broken), 'one level never places another kind')

// A cracked or broken tile lies straight, so only those may move when Cracked or Broken climbs.
const whole = tilesAt({ misaligned: 'moderate' })
const marked = tilesAt({ misaligned: 'moderate', cracked: 'heavy', broken: 'heavy' })
assert.ok(marked.every((tile, index) => tile.crack || tile.broken || (tile.x === whole[index].x && tile.z === whole[index].z && tile.tilt === whole[index].tilt && tile.yaw === whole[index].yaw && tile.shade === whole[index].shade)), 'Cracked and Broken move no other tile')
assert.deepEqual(tilesAt({ misaligned: 'moderate', cracked: 'heavy' }).map(tile => tile.shade), whole.map(tile => tile.shade), 'and re-shade none')

const existing = tilesAt({ cracked: 'moderate', broken: 'moderate', misaligned: 'heavy' })
const afterReset = tilesAt({ cracked: 'moderate', broken: 'moderate', misaligned: 'heavy' }, true)
assert.equal(afterReset.length, existing.length, 'the same tiles')
assert.deepEqual(afterReset.map(tile => tile.shade), existing.map(tile => tile.shade), 'each keeps its own shade')
assert.ok(afterReset.every((tile, index) => tile.x === gridOf.get(index)!.x && tile.z === gridOf.get(index)!.z && tile.tilt === -0.05 && !tile.yaw), 'straight and lined up')
assert.ok(afterReset.every(tile => !tile.crack && !tile.broken), 'nothing cracked or broken is left')
assert.deepEqual(afterReset.map(tile => tile.replacement === true), existing.map(tile => Boolean(tile.crack || tile.broken)), 'exactly the cracked and broken tiles are replaced')

const noneToReplace = tilesAt({ cracked: 'none', broken: 'none', misaligned: 'heavy' }, true)
assert.ok(noneToReplace.every(tile => !tile.replacement), 'with nothing cracked or broken, no tile is replaced')
assert.ok(noneToReplace.every((tile, index) => tile.tilt === -0.05 && tile.x === gridOf.get(index)!.x), 'and the roof is still straightened')
```

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-covering-wear.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `layoutTiles`.** Every tile draws the same fixed run of `random()` calls whatever the levels, so a level never moves another tile, and a reset matches Today tile for tile. The tiles start on the grid they use today, with no skips.
  - `place < crackedRate * shares.cracked` is cracked. `place > 1 - brokenRate * shares.broken` is broken.
  - A cracked or broken tile lies straight. The rest take the `jitter` scaled by `shares.misaligned`, and those whose slip roll falls under `slippedRate * shares.misaligned` take the `slipped` values.
  - `crack` and `broken` carry a value in (0, 1] from the tile's own rolls.
  - With `area.reused`, no tile is offset, none carries `crack` or `broken`, and the tiles that would have been cracked or broken get `replacement: true`.

- [ ] **Step 4: Draw them.** `InstancedPieces` sets the rotation to `(0, piece.yaw ?? 0, piece.tilt)` and colours a piece with `piece.tint ?? color`, multiplied by `shade`. `RoofCovering`, on a tile roof only, gives each `replacement` piece `tint: wornColor(colours.new, colours.worn, wear * TILE_WEAR.replacementFreshness)` in the memo that lays the pieces.

- [ ] **Step 5: Run** `pnpm tsx scripts/verify-covering-wear.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, then tsc and lint. Expected: all pass. Run `grep -n "wornShare" src/features/trade-scenes/lib/tile-layout.ts`. Expected: no hits.

- [ ] **Step 6: Commit** by explicit path: `feat(trade-scenes): old tiles go crooked, crack and break; a reset straightens the same tiles and replaces the bad ones`.

### Task 5: Dirt, cracks and broken corners in the covering's own drawing

> **Owner, 2026-11-11: the material textures go first** (`feat/scene-layout-lab`, plan `docs/superpowers/plans/2026-11-10-trade-scene-material-textures.md`, Tasks 5 and 7). By the time this task runs, the shingle course already draws a `TexturedMaterial` as `InstancedPieces`' child, with real grit from a baked map. `CoveringMaterial` then replaces that child on every course, and on the shingle course it carries the texture: its `onBeforeCompile` calls `patchTexturedShader(shader, uniforms)` first, then adds the dirt, and its cache key extends `TEXTURED_PROGRAM_KEY`. The procedural `createNoiseTexture('grit')` stays only for tile and shake. Re-read this task against the lab's code before building it.

**Files:**
- Create: `src/features/trade-scenes/lib/covering-piece-marks.ts`
- Create: `src/features/trade-scenes/ui/lib/covering-course-geometry.ts`
- Create: `src/features/trade-scenes/constants/covering-wear-shader.ts` (the GLSL chunks as strings, where `heat-arrow-shader.ts` and `blueprint-edge-shader.ts` keep theirs)
- Create: `src/features/trade-scenes/ui/lib/inject-covering-wear.ts` (the injector)
- Create: `src/features/trade-scenes/ui/components/home-kit/covering-material.tsx`
- Create: `src/features/trade-scenes/ui/components/home-kit/covering-course.tsx`
- Modify: `src/features/trade-scenes/constants/covering-wear.ts`
- Modify: `src/features/trade-scenes/ui/components/home-kit/roof-covering.tsx`
- Test: `scripts/verify-covering-wear.ts`

**Interfaces:**
- Consumes: Task 3's `coveringDirtShare`; Task 4's `CoveringPiece`.
- Produces:
  - `dirtPatch(x: number, z: number, seed: number): number`, from 0.35 to 1.5, a sum of a few seeded long sine waves across the slope.
  - `writePieceMarks(target: Float32Array, pieces: readonly CoveringPiece[], seed: number): void`, three values per piece: `dirtPatch`, `crack ?? 0`, `broken ?? 0`.
  - `type CoveringCourseKind = 'shingle' | 'shake' | 'pan' | 'cap'`: the local `type Course` at `roof-covering.tsx:31`, moved and exported, not a twin.
  - `coveringCourseGeometry(course: CoveringCourseKind, capacity: number): BufferGeometry`, the geometry `RoofCovering` builds today plus an `InstancedBufferAttribute` named `pieceMark` (item size 3, `capacity` long).
  - `injectCoveringWear(shader: { vertexShader: string, fragmentShader: string, uniforms: Record<string, { value: unknown }> }, uniforms: CoveringWearUniforms): void`.
  - `COVERING_DIRT` working numbers in `constants/covering-wear.ts`, starting with `color: '#b8a382'`, the settled-dust tan from the chosen study, and `maxCover: 0.82`.

Facts the shader rests on, all in the piece's own frame: local **−x is the eave end** on the half-pipes (the `rotateZ` sends the cylinder's top there) and on the boxes. The exposed part of a piece runs from `-length / 2` to `-length / 2 + exposure`. A pan's channel is at local `z = 0`.

- [ ] **Step 1: Write the failing test** in `scripts/verify-covering-wear.ts`. `ShaderLib` is three's own, so a three upgrade that moves a chunk fails here rather than on the iPad.

```ts
const spots = Array.from({ length: 40 }, (_, index) => dirtPatch(index * 0.4, index * 0.3, 7))
assert.ok(spots.every(value => value >= 0.35 && value <= 1.5), 'the patch stays in range')
assert.ok(Math.max(...spots) - Math.min(...spots) > 0.5, 'parts of the roof carry more than others')
assert.ok(Math.abs(dirtPatch(2, 2, 7) - dirtPatch(2.12, 2, 7)) < 0.15, 'neighbouring tiles are close, so the patches are soft')
assert.notEqual(dirtPatch(2, 2, 7), dirtPatch(2, 2, 19), 'the two slopes differ')

const whole = [...layoutTiles({ ...courseArea({ cracked: 'heavy', broken: 'heavy' }) }, TILE).pans]
const span = piecesInSpan(whole, 0, 5, false)
assert.ok(span.length < whole.length && span.some(piece => piece.crack || piece.broken))
const marks = new Float32Array(whole.length * 3).fill(-1)
writePieceMarks(marks, span, 7)
span.forEach((piece, index) => {
  near(marks[index * 3 + 1], piece.crack ?? 0, 1e-6, 'a crack stays with its tile')
  near(marks[index * 3 + 2], piece.broken ?? 0, 1e-6, 'and a broken corner')
})

const geometry = coveringCourseGeometry('pan', 12)
const pieceMark = geometry.getAttribute('pieceMark')
assert.ok(pieceMark instanceof InstancedBufferAttribute && pieceMark.count === 12 && pieceMark.itemSize === 3)
assert.ok(coveringCourseGeometry('shingle', 3).getAttribute('pieceMark') instanceof InstancedBufferAttribute, 'every course carries it, so there is one shader path')

const shader = { vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader, uniforms: {} }
injectCoveringWear(shader, { uDirt: { value: 1 }, uShape: { value: 0 } } as never)
assert.ok(shader.vertexShader.includes('attribute vec3 pieceMark'), 'the vertex chunk was found')
assert.ok(shader.fragmentShader.includes('uDirt') && shader.fragmentShader.includes('uShape'), 'the fragment chunk was found')
assert.ok(shader.fragmentShader.includes('discard'), 'a broken corner is really gone')
for (const anchor of ['#include <begin_vertex>', '#include <color_fragment>']) {
  const text = anchor.includes('vertex') ? shader.vertexShader : shader.fragmentShader
  assert.equal(text.split(anchor).length - 1, 1, `${anchor} is still there once, with the wear after it`)
}
const varyings = [...shader.vertexShader.matchAll(/varying\s+\w+\s+(\w+)/g)].map(match => match[1]).filter(name => name.startsWith('vCovering'))
assert.ok(varyings.length > 0 && varyings.every(name => new RegExp(`varying\\s+\\w+\\s+${name}\\b`).test(shader.fragmentShader)), 'every varying the wear passes is declared on both sides')
```

The varyings are named with a `vCovering` prefix so the check above finds them.

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-covering-wear.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `dirtPatch`, `writePieceMarks` and `coveringCourseGeometry`.** Move `halfPipe` and the box geometries out of `roof-covering.tsx` into `coveringCourseGeometry`.

- [ ] **Step 4: Implement `injectCoveringWear`.** After `#include <begin_vertex>`, pass the object-space `position`, the instance's slope-frame position (`(instanceMatrix * vec4(position, 1.)).xz`) and `pieceMark` as varyings. After `#include <color_fragment>`, do the following.
  - Dirt covers by `uDirt * shape * patch`. Blend `diffuseColor.rgb` toward the tan by that cover, capped at `maxCover`, broken up by the grit texture so it is grain rather than a film.
  - `shape` for a pan: strongest in the channel, falling off toward its edges, and strongest at the eave end of the exposed part. For a cap: a faint trace on its +z side. For a shingle or shake: along the eave end of the exposed part, weighted toward the eave end of the slope (the instance's x over `SLOPE_LENGTH`).
  - Cracked (`pieceMark.y > 0`): a thin jagged dark line across the exposed part at an x set by `pieceMark.y`, with a width of at least about one pixel from `fwidth`.
  - Broken (`pieceMark.z > 0`): `discard` a jagged corner at the eave end, on the side `pieceMark.z` picks.

- [ ] **Step 5: Add the components.** `CoveringMaterial` is a `meshStandardMaterial` taking `dirt`, `shape`, `roughness` and `doubleSided`. It holds its uniforms in a `useMemo`, passes a stable `onBeforeCompile` and a constant `customProgramCacheKey`. Because the key is constant, every course shares one program, so the course kind reaches the shader as the int uniform `uShape`, never as text spliced into the GLSL (three would reuse the first course's shape for all of them). It writes `uDirt` and `uShape` in an effect, then `invalidate()`, so a level change never compiles a new program.
  - The grit is `createNoiseTexture('grit', '#808080', 11)`, created once at module level on first use, as `PaintStains` does its atlas. Set its `colorSpace` to `NoColorSpace`: `createNoiseTexture` tags it sRGB, which would sample `#808080` at about 0.22, not 0.5. Pass it only as a uniform, never as `map`: Thermal turns a see-through material with a `map` into a decal (`thermal-paint-set.ts:136-138`), and a ghosted covering is see-through. The load's upload (`upload-scene-textures.ts:14-18`) does not visit `onBeforeCompile` uniforms, so call `gl.initTexture` on the grit when the material mounts.

`CoveringCourse` owns one course. `const geometry = useOwnedGeometry(() => coveringCourseGeometry(course, capacity), [course, capacity])`, with `capacity` the whole layout's piece count. A `useLayoutEffect` on `[geometry, pieces, seed]` calls `writePieceMarks` on the attribute's array and sets `needsUpdate`. It renders `InstancedPieces` with `CoveringMaterial` as its child. Geometry does not rebuild while a peel drag changes the span. `RoofCovering` maps its courses to `CoveringCourse`, passing `dirt={coveringDirtShare(look)}`.
  - How the lenses and fades meet the marks, from the code: Thermal swaps the mesh's material (`thermal-paint-set.ts:279`), so under Thermal there is no dirt or crack, and a broken tile draws whole. The ghost and the view fades write `opacity`, `transparent` and `depthWrite` onto the covering's own material (`apply-ghost.ts:55-71`), so the dirt and cracks fade with the tile. The first `transparent` flip recompiles the program once. The Complete front slope's sheet fade draws a depth twin with a plain `MeshBasicMaterial` (`fade-sheets.ts:20-28`), which ignores `discard`, so for the length of that fade a broken corner writes depth. The covering carries `BLUEPRINT_OMIT_TAG` and casts no shadow, so the blueprint load and the shadow map are untouched. All four go on the owner's look list in Task 7.

- [ ] **Step 6: Run** `pnpm tsx scripts/verify-covering-wear.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, then tsc and lint. Expected: all pass. Run `git diff --stat -- src/features/meeting-visualizations src/features/trade-scenes/lib/scene-savings.ts`. Expected: empty.

- [ ] **Step 7: Commit** by explicit path: `feat(trade-scenes): settled dirt, cracks and broken corners drawn in the covering's own material`.

### Task 6: Dirt on a flat roof

**Files:**
- Create: `src/features/trade-scenes/lib/flat-roof-dirt.ts`
- Modify: `src/features/trade-scenes/constants/covering-wear.ts`
- Modify: `src/features/trade-scenes/ui/components/home-kit/low-slope-roof.tsx`
- Test: `scripts/verify-covering-wear.ts`

**Interfaces:**
- Consumes: Task 3's `coveringDirtShare`; `StainBoxes`, `PaintStains`.
- Produces: `flatRoofDirtLists(membrane: readonly BoxSpec[], top: number, share: number, seed: number): StainBoxes[]`, using the `'blotch'` cell and `COVERING_DIRT.color`, with a `FLAT_DIRT` block of working numbers (spots per square metre, size range, alpha) in `constants/covering-wear.ts`, beside `TILE_WEAR` and `COVERING_DIRT`.

- [ ] **Step 1: Write the failing test** in `scripts/verify-covering-wear.ts`.

```ts
const deckBox: BoxSpec = { size: [8, 0.02, 6], position: [0, 3, 0] }
const spotsAt = (share: number) => flatRoofDirtLists([deckBox], 3.01, share, 23).flatMap(list => list.boxes)
assert.equal(spotsAt(0).length, 0, 'no dirt, no stains')
assert.ok(spotsAt(PAINT_WEAR_SHARE.heavy).length >= spotsAt(PAINT_WEAR_SHARE.light).length && spotsAt(PAINT_WEAR_SHARE.light).length > 0)
assert.ok(spotsAt(1).every(({ size, position }) => Math.abs(position[0]) + size[0] / 2 <= 4 + 1e-9 && Math.abs(position[2]) + size[2] / 2 <= 3 + 1e-9), 'every stain stays on the membrane')
assert.ok(spotsAt(1).every(({ position }) => position[1] >= 3.01), 'and lies on top of it')
```

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-covering-wear.ts`. Expected: FAIL.

- [ ] **Step 3: Implement `flatRoofDirtLists`** with `seededRandom`. Boxes are thin, flat and laid in the membrane's plane.

- [ ] **Step 4: Draw it.** In `LowSlopeRoof`, memoize lists for `MEMBRANE_BOXES` and `COMPLETE_MEMBRANE` on the numeric share `coveringDirtShare(covering)`. Each goes in a `PaintStains`, passed `thermal` so the Thermal lens hides it (`paint-stains.tsx:41`), inside `COVERING_TAG` and `systemPartTag('covering')`. The complete region's sit inside the existing `HOME_FADE_TAGS.complete` group. The dark patches stay on the wear, unchanged.
  - Up close the membrane steps open, and its dirt steps with it, as a pitched roof's dirt does inside the tiles. Never hide the stains while `feltBared` (that is exactly when the rep looks at the roof). Filter them the way `AtticSteps` filters its boxes (`attic-steps.tsx:33-37`): `useStepPeel(lit)` and `stepStarts(lit.system, lit.shown, peel).get('covering')`, keeping the stains whose centre lies where the membrane still draws: behind the cut (`HOUSE.cutX`) or at or past the step start. A drag must not re-lay the stains, only re-filter them.

- [ ] **Step 5: Run** `pnpm tsx scripts/verify-covering-wear.ts`, then tsc and lint. Expected: all pass.

- [ ] **Step 6: Commit** by explicit path: `feat(trade-scenes): a flat roof collects dirt in soft patches`.

### Task 7: The owner's look, then the record

**Files:**
- Modify: `src/features/trade-scenes/constants/covering-wear.ts` (working numbers only)
- Modify, left uncommitted: `CONTEXT.md`, `docs/plans/2026-10-16-trade-scenes-epic.md`. Other sessions have uncommitted edits in both.

- [ ] **Step 1: Run the whole check set:** `pnpm tsx scripts/verify-covering-wear.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts`, `pnpm tsx scripts/verify-construction-model.ts`, then tsc and lint. Expected: all pass. Run `grep -rn "Plan\|Task [0-9]\|Review focus" ` on every file this plan created or changed under `src/`. Expected: no comment cites the plan.

- [ ] **Step 2: Hand the owner this list for the running page.** Confirm the port answers with `ss -ltnp`. If it does not, ask Oliver to start the server. Do not open the scene yourself.
  - Tile roof at Worn, whole-home view and up close: does the dirt read as settled grit, not a film?
  - Each existing-roof control moves only its own kind.
  - Flip to Build with a tile reset: same roof, clean, straight, in its weathered colour, with replacements that do not read as patchwork, and not a new roof. The new drip edge and the garage roof follow the weathered tile tone, as they follow the roof's colour today (Claude's call).
  - Shingle at Worn shows its gaps, 5% as before, though in different tabs. At Good and Fair a shingle roof now shows no gaps (it showed about 2% and 3%), as the spec's table says.
  - Wood shake: Condition offers only Worn and Failing, and an unrated roof shows Failing. Its curl looks as it did, and its new splits read as cracks in the wood.
  - A flat roof's dirt, whole and stepped open up close, and a metal roof with no controls.
  - Thermal lens (no dirt or cracks, broken tiles draw whole), ghosting up close (dirt fades with the tile), the peel on a tile roof, a broken corner while the Complete front slope fades, and the blueprint load.
  - Frame rate on the iPad.

- [ ] **Step 3: Tune the working numbers** to the owner's rulings. Commit each round by explicit path: `fix(trade-scenes): settle the covering wear's working numbers by eye`.

- [ ] **Step 4: Record it, uncommitted.** In `CONTEXT.md`:
  - Fix **Paint wear** first: it lists three kinds (`CONTEXT.md:129`), the code has four, `fascia-rot` included (`enums.ts:60`).
  - Add **Covering wear** and its kinds beside it, written the same way, with `Avoid: damage, defects, condition`. Note that its Dirt is settled grit on a roof, not the Ground material "dirt".
  - Widen the **Paint wear level** entry to say covering wear and fascia rot use the same levels.
  - Add **Tile reset**: the home's own tiles lifted, sorted and laid back over new waterproofing. The part counts as installed but keeps its wear (`reused` in code). Not the "Tile roof reset (repair)" scope, which leaves the covering in place.
  - Mark R293–R296 and the Covering wear row in the tracker with what was built and the owner's verdict.
