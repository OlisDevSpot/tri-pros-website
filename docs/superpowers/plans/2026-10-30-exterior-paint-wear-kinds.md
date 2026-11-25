# Exterior paint wear kinds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Worn exterior paint shows Cracks, Stains and Peeling, each at its own level, with starting levels that follow the paint's Condition, and the raised foundation wall wears the wall's paint.

**Architecture:** The rep's levels are recorded beside the wear in `HomeMaterialFacts.paintWear`. A pure `paintWearInForce` folds them over the Condition's starting levels. HomeKit puts them on the one `PaintLook` it already passes to the walls, gables, parapets and now the foundation. Marks are placed by pure, seeded functions in `F/lib/` (like `stuccoCracks`). Each fade group draws at most two mark meshes: one opaque **marks** mesh with a colour per box (cracks, sill dirt, peeling; it replaces that group's crack mesh), and one see-through **stains** mesh whose colour and strength ride in the vertex colours over one shared white atlas texture. Both are built on the vertex-tint helpers lot-and-light already uses (`F/ui/lib/vertex-tinted-geometry.ts`). `PaintMarks` and `PaintStains` each own their group: hidden while the Thermal lens is on, left out of the blueprint drawing, and passing taps through.

**Tech Stack:** Next.js 15, React 19.2, `@react-three/fiber` 9.8.2, three 0.180. Checks are the repo's `tsx` verify scripts and local Playwright screenshots.

**Spec:** `docs/superpowers/specs/2026-10-30-exterior-paint-wear-kinds-design.md` (approved 2026-10-30, `4206462ab`; stress-test rulings in §6.2, §6.6, §7, §10.4–10.5; second stress test 2026-11-01, rulings §10.6–10.9). Read the section each task cites; §4 is the field reference for every look.

`F/` = `src/features/trade-scenes/`, `CORE/` = `src/shared/modules/construction/core/`.

## Global Constraints

- **Binding rules:** `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/standing-rules.md` binds every task in full (explicit-path commits, no stash/reset/checkout, the CRLF `git diff --shortstat` check, the 300 s commit timeout and trailer, no subagents, foreign hunks). Two exceptions: the binding spec is the one above, and records go in `.superpowers/sdd/2026-10-30-exterior-paint-wear-kinds/` (gitignored); the visual floor (`SDD/studies/`) stays at its old path. Its foreign-hunks note says `scene-burst-key.ts` was deleted; it was not (`F/lib/scene-burst-key.ts` is live), so leave it alone.
- **Heavy checks** run under the lock, exactly: `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc` and `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock env CI=1 pnpm eslint <every file you created or modified>`. "tsc" and "eslint" below mean these. The `pnpm tsx scripts/…` verify scripts run without the lock.
- **Builds now, before the trade scene controls build** (owner, 2026-11-01, spec §10.8). Only Task 2 touches the panel, and it builds on today's `material-choices.tsx`; the controls build moves its rows later (Task 2, "When the controls build lands"). Before Task 1, re-read every file this plan names. Lot-and-light (6-A) and the attic moved several line numbers (one example: the paint look's checks were at `verify-trade-scene.ts:1510`, then `:1771`). Locate each spot by the block or symbol the plan names; the line numbers are a starting point only. The TS3b.4a fixes, the attic and 6-A are built. The blueprint load is in flight (Task 3 of 7, with uncommitted hunks in `scene-load.ts`, `blueprint-paper.tsx`, `home-scene-canvas.tsx`, `scene-stage.tsx` and `trade-scene-view.tsx`). None is in this plan; read its ledger (`.superpowers/sdd/2026-11-01-trade-scene-blueprint-load/progress.md`) before each dispatch.
- Before each task, run `git log --oneline -5 -- <file>` and `git diff <file>` on every file you'll touch; build on what is there and stage only your hunks.
- **Screenshots and probes** start from the blueprint load's helpers (`.superpowers/sdd/2026-11-01-trade-scene-blueprint-load/lib.mjs`: `signIn`, `recordPhases`, `waitPhase(page, 'live')`), never a fixed wait: the stage takes no input until load phase `live`, and the paper can hold for up to 6 s.
- **The garage stays colour only** (spec §6.3): it takes `paint.color` and no marks until 6-B. Placement functions take a `HouseWall`, so 6-B can hand them the garage's faces. Marks that fall on the house's right wall behind the garage stay as placed (hidden); don't special-case them.
- **Off limits:** `src/shared/components/scene/**`, `src/app/(frontend)/globals.css`, `package.json`, `eslint.config.*`.
- **Server and database:** never `pnpm build`, never start or stop a dev server (:3002 is the owner's), no database writes. Sign in with `as=`, never `role=`. Nothing here is persisted: the facts live in the lab's in-memory store, so there is no schema or `db:push`.
- **Working numbers:** every new hand-tuned figure (colours, sizes, counts, alphas, the light share) is marked as a working number in one comment on its constant.
- **Inside counts:** no heat figure, reading, load or bill cut changes. `verify-trade-scene`'s heat and bill checks must pass untouched.
- **Draw calls (owner, spec §7, §10.6):** paint wear counts against TS3b.6's budget (at most 177; 160 used after 6-A on the flat roof's default view; 17 left for 6-B). Measure and record what 6-B has left; don't stop. Count with a copy of `.superpowers/sdd/2026-11-01-ts3b6a-lot-and-light/perf.mjs` in this build's `shots/`: it counts at the WebGL draw functions, because `renderer.info` cannot be reached from the probe. Add the `waitPhase(page, 'live')` wait. Before Task 1 changes anything, count four homes (raised and slab, pitched and flat) at Failing, every kind Heavy, Complete, at rest, plus 6-A's own reference case (flat roof, default view). Write them in the ledger as the base. Count again at the end of Tasks 4 and 5.
  - **Expected extra calls:**
    - one stains mesh per fade group that holds a painted wall;
    - one more on a slab home for the front wall's splash band (Task 4);
    - two marks meshes on the raised foundation wall (it has no crack mesh to replace);
    - one marks mesh per pitched fascia (three; a flat roof's fascia never peels, spec §10.9).
  - That comes to about +9 on the raised pitched home. Any call beyond those is a merging bug: fix it. Marks never cast shadows (a shadow caster draws again in the shadow pass).
- **Vocabulary (GLOSSARY.md):** **paint wear** for the three kinds (`cracks | stains | peeling`), **paint wear level** for `none | light | moderate | heavy`; **wear** in code, "Condition" on screen. Never "damage", "defects", "severity", or "amount" for a level. Use "peeling", not "peel" (the peel slider owns `peel`). A level's number is a **share** of the Worn look.
- **Copy (exact):** kind labels `Cracks`, `Stains`, `Peeling`; level labels `None`, `Light`, `Moderate`, `Heavy`. No other new screen copy.
- **Starting levels (spec §5, exact):**

  | Wear | cracks | stains | peeling |
  |---|---|---|---|
  | new | none | none | none |
  | good | none | light | none |
  | fair | light | light | none |
  | worn | moderate | moderate | light |
  | failing | heavy | heavy | moderate |

- **Level shares (a share of the Worn look, the scale `wornShare` returns):** `none 0`, `light 0.5` (working number), `moderate 1`, `heavy WEAR_AMOUNT.failing / WEAR_AMOUNT.worn` (4/3). Moderate cracks are exactly today's Worn cracks, heavy exactly today's Failing cracks. Never pass a `WEAR_AMOUNT` value where a share is asked for.

## Review Focus

1. **Heavy overrides on new paint.** The rep set Stains to Heavy, then the build installs paint (or the rep sets Condition to New). Nothing is drawn, and the record survives: stepping Condition back to Worn brings Heavy back. Tests in Task 1 (levels) and Task 3 (`paintLook`).
2. **Condition not set.** With no recorded wear the levels are the era guess's (Failing's on a 1950–1978 home), and with no era guess either (the paint was replaced at some point) they are Worn's, because `wearInForce` reads that as Worn. The panel shows them selected. Tests in Task 1.
3. **A level change shows at once and holds.** Light → Heavy strengthens the stains on the next frame, and toggling Partly open and back keeps Heavy's strength (the view fades rewrite material opacity, so strength never rides on it). Screenshot in Task 4.
4. **Thermal, view and load changes.** Under the Thermal lens no mark shows, gables, parapets and fascias included; the blueprint load draws no mark; Partly open takes the front wall's and front foundation wall's marks with them; the raised ↔ slab switch crossfades the splash bands, never both at rest, never on the slab edge. Screenshots in Tasks 4 and 5.
5. **Marks stay off the openings, front door included, and stay put.** No mark overlaps a window or the front door, and every mark at Moderate is still there at Heavy, in the same place. Pure checks in Tasks 3, 4 and 5.

---

### Task 1: Paint wear facts, starting levels and writes (spec §3, §5, §6.5, §6.9)

**Files:**
- Modify: `CORE/constants/enums.ts` (after `exteriorPaints`)
- Modify: `CORE/types.ts:171-179` (`HomeMaterialFacts`)
- Modify: `CORE/constants/home-materials.ts:67` (`HOME_MATERIAL_FACTS_UNSET`)
- Create: `F/constants/paint-wear.ts`
- Create: `F/lib/paint-wear-in-force.ts`
- Modify: `F/types.ts` (`SceneResolveInputs.homeMaterials` and `SceneResolveSelection` `Omit`s, at `:85` and `:464` on 2026-11-01; the `'fact'` member of `HomeMaterialChange`, `:487`; new exports in one block at the end)
- Modify: `F/lib/home-material-patch.ts` (`homeMaterialPatch`)
- Modify: `F/lib/scene-resolve-inputs.ts` (the comment at `:3-4` names the paint wear among the drawing-only facts)
- Modify: `F/lib/resolve-scene.ts:91` (facts literal gains `paintWear: {}`)
- Modify: `scripts/verify-construction-model.ts:565` (the literal becomes `{ ...HOME_MATERIAL_FACTS_UNSET, ...materials }` or gains `paintWear: {}`)
- Test: `scripts/verify-trade-scene-layout.ts`, `scripts/verify-trade-scene.ts` (the `drawingOnly` check, `:466` on 2026-11-01)

**Interfaces:**
- Produces: `paintWearKinds = ['cracks', 'stains', 'peeling'] as const`, `type PaintWearKind`, `paintWearLevels = ['none', 'light', 'moderate', 'heavy'] as const`, `type PaintWearLevel` (CORE enums, the const-plus-type pair like `wears`).
- Produces: `HomeMaterialFacts.paintWear: Partial<Record<PaintWearKind, PaintWearLevel>>` (only kinds the rep set).
- Produces: `type PaintWear = Record<PaintWearKind, PaintWearLevel>` (F types).
- Produces: `PAINT_WEAR_START` (`satisfies Record<Wear, PaintWear>`), `PAINT_WEAR_SHARE` (`satisfies Record<PaintWearLevel, number>`) in `F/constants/paint-wear.ts`, values from Global Constraints.
- Produces: `paintWearInForce(material: ResolvedHomeMaterial | undefined, recorded: HomeMaterialFacts['paintWear']): PaintWear`.
- Produces: `paintWear` joins the `'fact'` change's `Pick` (`'gutters' | 'acTons' | 'shingleColor' | 'paintWear'`). No new change kind: the panel writes `{ kind: 'fact', patch: { paintWear: { ...materials.paintWear, [kind]: level } } }`, the same way gutters, AC size and shingle colour are written.

- [ ] **Step 1: Write the failing checks** in `scripts/verify-trade-scene-layout.ts`, after the existing `homeMaterialPatch` checks (they end at `:246` on 2026-11-01; `sixties` is defined at `:235`). `paint(facts)` below is `resolveHomeMaterials(facts)['exterior-paint']`.

```ts
const none = { cracks: 'none', stains: 'none', peeling: 'none' }
assert.deepEqual(paintWearInForce(paint(unset(sixties)), {}), PAINT_WEAR_START.failing, 'an unset 1950-1978 paint takes its era guess')
const replaced = { ...HOME_MATERIAL_FACTS_UNSET, exteriorPaint: 'cool' } as const
assert.deepEqual(paintWearInForce(paint({ property: sixties, materials: replaced, year: YEAR }), {}), PAINT_WEAR_START.worn, 'no wear and no era guess reads as Worn')
const fair = { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'exterior-paint': 'fair' } } as const
assert.deepEqual(paintWearInForce(paint({ property: sixties, materials: fair, year: YEAR }), { stains: 'heavy' }), { cracks: 'light', stains: 'heavy', peeling: 'none' })
const fresh = { ...HOME_MATERIAL_FACTS_UNSET, wear: { 'exterior-paint': 'new' } } as const
assert.deepEqual(paintWearInForce(paint({ property: sixties, materials: fresh, year: YEAR }), { stains: 'heavy' }), none, 'new paint draws nothing')
assert.deepEqual(paintWearInForce(undefined, { stains: 'heavy' }), none, 'no paint, no marks')
for (const kind of paintWearKinds) {
  const steps = wears.map(wear => paintWearLevels.indexOf(PAINT_WEAR_START[wear][kind]))
  assert.ok(steps.every((step, index) => index === 0 || step >= steps[index - 1]), `${kind} never gets better as the paint wears`)
}
```

Then the write rules, on `sixties` with `wear: { 'exterior-paint': 'worn' }`:
  - `{ kind: 'fact', patch: { paintWear: { stains: 'heavy' } } }` records `paintWear: { stains: 'heavy' }` and leaves `wear` untouched; a second write of `{ stains: 'heavy', cracks: 'light' }` keeps both.
  - After that, `{ kind: 'wear', id: 'exterior-paint', wear: 'failing' }`, then `wear: 'new'`, then `wear: 'worn'`: `paintWear` is still `{ stains: 'heavy' }` after each.
  - `{ kind: 'option', field: 'exteriorPaint', value: 'cool' }` keeps `paintWear`.
  - `propertyPatch(..., { yearBuilt: '1978-1998' }, YEAR)` keeps `paintWear`.
  - `{ kind: 'era-guess', id: 'exterior-paint' }` gives `paintWear: {}`; `{ kind: 'era-guess', id: 'roof' }` keeps it.

And in `scripts/verify-trade-scene.ts`, `drawingOnly` checks `'acTons' | 'shingleColor' | 'paintWear'`.

- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene-layout.ts`. Expected: fails to compile on the missing names.

- [ ] **Step 3: Implement.**
  - The enums, the facts field and `HOME_MATERIAL_FACTS_UNSET.paintWear = {}`; `paintWear` joins `acTons | shingleColor` in both `Omit`s (it only draws, so it never wakes the resolver; `selectResolveInputs` names its fields, so it needs no code change).
  - `paintWearInForce`: absent material or `wearInForce(material) === 'new'` gives all `none`; otherwise `{ ...PAINT_WEAR_START[wearInForce(material)], ...recorded }`.
  - `homeMaterialPatch`: the `'fact'` case already spreads the patch over the facts through `settled`, so a level write needs no new case. The `'era-guess'` case clears `paintWear` before it dispatches when `change.id === 'exterior-paint'` (exterior paint only ever takes the `writeOption` branch). Every other case already spreads `...state.homeMaterials`, so it keeps `paintWear` with no new code.
- [ ] **Step 4: Run** `pnpm tsx scripts/verify-trade-scene-layout.ts`, `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-construction-model.ts`, tsc. Expected: all exit 0.
- [ ] **Step 5: Commit** — `feat(trade-scenes): paint records the rep's Cracks, Stains and Peeling levels, starting from its Condition`

---

### Task 2: The three level rows on the Exterior paint row (spec §6.1, §6.2, §10.8)

Built on today's panel (owner, 2026-11-01). The controls build will move these rows; see "When the controls build lands" below.

**Files:**
- Create: `F/ui/components/panel/paint-wear-fields.tsx`
- Modify: `F/ui/components/panel/material-choices.tsx`:
  - render the rows right after the `exterior-paint` `slimPair` (`:106` on 2026-11-01);
  - the "back to era guess" button (`:131`) also shows when `id === 'exterior-paint'` and `materials.paintWear` has a key.
- Modify: `F/constants/home-scene-copy.ts` (new block at the end: `PAINT_WEAR_LABELS` and `PAINT_WEAR_LEVEL_LABELS`, each `{ … } as const satisfies Record<…, string>` like the tables there)
- Create: `.superpowers/sdd/2026-10-30-exterior-paint-wear-kinds/shots/t2.mjs` (on the blueprint load's `lib.mjs`: `signIn`, `recordPhases`, `waitPhase(page, 'live')`)

**Interfaces:**
- Consumes: `paintWearInForce`, `paintWearKinds`, `paintWearLevels`, `paintWear` in the `'fact'` change (Task 1); `wearInForce` (`CORE/lib/resolve-home-materials.ts`); `useSceneTargets().home['exterior-paint']`; `useSetHomeMaterial` (`F/hooks/use-set-home-material.ts:12`); `ScaleField` (`F/ui/components/fields/scale-field.tsx`).
- Produces: `PaintWearFields()` (no props). It reads its own state and writes through one hook, so the controls build can move it as a whole.

- [ ] **Step 1: Implement `PaintWearFields`.** One `ScaleField` per kind, in `paintWearKinds` order (owner ruling, spec §6.2; the same control as Insulation level at `material-choices.tsx:102`):
  - `label`: `PAINT_WEAR_LABELS[kind]`.
  - `options`: `paintWearLevels`, with no unknown option, so no "Not sure".
  - `labels`: `PAINT_WEAR_LEVEL_LABELS`.
  - `value`: the level in force, `paintWearInForce(material, materials.paintWear)[kind]`, so an untouched row shows its starting level.
  - `onChange`: dispatches `{ kind: 'fact', patch: { paintWear: { ...materials.paintWear, [kind]: level } } }` through `useSetHomeMaterial`, as gutters and AC size are written.
  - It renders nothing when the material is absent or its wear in force is `'new'`.
- [ ] **Step 2: Check** tsc and eslint on the three source files. Expected: exit 0.
- [ ] **Step 3: Screenshots** with `t2.mjs`: Home → Current materials → Exterior paint at 1366×1024 and 390×844, both schemes, on the default home (its era guess, Failing) and at New; then Condition → Worn, Stains → Heavy, Condition → Failing, and shoot again. Read every PNG:
  - At New the rows are gone.
  - The three tracks fit the card at 390 with their level names in the label rows.
  - Stains still reads Heavy after each Condition change.
  - "Back to era guess" shows. Tapped, the rows return to the era guess's levels (Failing's on the default home), and Stains is no longer Heavy.
- [ ] **Step 4: Commit** — `feat(trade-scenes): the rep sets Cracks, Stains and Peeling on the exterior paint`

**When the controls build lands** (its spec, `docs/superpowers/specs/2026-11-01-trade-scene-controls-design.md`, deletes `material-choices.tsx` and `use-set-home-material.ts`):
- `PaintWearFields` is a surviving caller of `useSetHomeMaterial`. By that spec's own rule it moves to `useApplySceneChange` in the same task.
- It renders in the value menu (`value-menu.tsx`) for `exterior-paint`, right under the Condition dots.
- Its write stays the `'fact'` change, wrapped as a `homeMaterial` `SceneChange`.
- The era-guess (or **Use code**) reset still clears the levels.
- Whether the levels also join Modify's search slots is the owner's call then.

---

### Task 3: The levels reach the paint look; cracks, the front door and the raised foundation follow them (spec §3.6, §5, §6.3, §6.6, §7)

- [ ] **Step 0: Before any change**, run `shots/t3.mjs`'s Worn shot (raised home, Worn, 1366×1024, both schemes) and keep it as `t3-before-*.png`. Step 5 compares against it.

**Files:**
- Modify: `F/types.ts` (`PaintLook` gains `paintWear: PaintWear`; new export `TintedBoxes`)
- Modify: `F/ui/lib/paint-look.ts` (`paintLook(paint: PartState, paintWear: PaintWear): PaintLook`)
- Modify: `F/ui/components/home-kit/home-kit.tsx` (the `paintLook` call, `:197` on 2026-11-01, becomes `paintLook(partState(wallParts, 'paint'), paintWearInForce(targets.home['exterior-paint'], homeMaterials.paintWear))`; pass `paint` and `thermal` to `<Foundation>`, `thermal` to `<HouseShell>` and to `<HouseRoof>`. `<Garage>` keeps `wallColor={paint.color}`, with no marks: spec §6.3)
- Modify: `F/ui/components/home-kit/house-roof.tsx` (gains `thermal: boolean`, passed to `GableRoof` and `LowSlopeRoof`)
- Modify: `F/constants/home-geometry.ts` (export `FRONT_OPENINGS = [...FRONT_WALL.openings, FRONT_DOOR]`, moved from `house-shell.tsx`, `:64` on 2026-11-01)
- Modify: `F/lib/stucco-cracks.ts` (`wear` → `share: number`, count `Math.round(perWall * share)`, none at 0, the `wornShare` gate goes; new `openings = wall.openings` field, the same default as `wallBoxes`)
- Modify: `F/lib/roof-cracks.ts` (`gableCracks(share: number)`, `parapetCracks(share: number)`)
- Modify: `F/ui/lib/vertex-tinted-geometry.ts` (add `mergeTintedBoxes`; see Interfaces)
- Create: `F/ui/components/home-kit/paint-marks.tsx`
- Modify: `F/ui/components/home-kit/house-shell.tsx`, `gable-roof.tsx`, `low-slope-roof.tsx`:
  - crack callers pass `PAINT_WEAR_SHARE[paint.paintWear.cracks]`;
  - front-wall cracks pass `FRONT_OPENINGS`;
  - every crack mesh becomes a `PaintMarks`: the walls', the gables' and the parapets';
  - `gable-roof.tsx` and `low-slope-roof.tsx` gain `thermal: boolean` for it.
- Modify: `F/ui/components/home-kit/foundation.tsx` (props gain `paint: PaintLook`, `thermal: boolean`; the `MergedBoxes color` at `:65` and `:71` becomes `paint.color`; skirt cracks)
- Modify: `F/constants/home-palette.ts` (delete `crawlSkirt`; its only user is `foundation.tsx`)
- Test: `scripts/verify-trade-scene.ts`. At 2026-11-01:
  - the "One paint look" block is at `:1743`, the one-argument `paintLook` calls at `:1771-1772` and `parapetCracks(0.3)` at `:1770`;
  - the gable vent's crack check `gableCracks(WEAR_AMOUNT.failing)` is at `:1948`;
  - `FRONT_OPENINGS` is built by hand at `:1008`, `:1521` and `:1781`.

**Interfaces:**
- Consumes: Task 1's names.
- Produces: `PaintLook = { color: string, wear: number, paintWear: PaintWear }`; `stuccoCracks({ ..., share, openings? })`; `gableCracks(share)`, `parapetCracks(share)`; `FRONT_OPENINGS`; `Foundation({ ground, floorInsulation, paint, thermal })`; `HouseShell({ ..., thermal })`.
- Produces: `interface TintedBoxes { boxes: readonly BoxSpec[], color: string }` (F types).
- Produces: `mergeTintedBoxes(lists: readonly TintedBoxes[]): BufferGeometry | null` in `vertex-tinted-geometry.ts`, built on the helpers there:
  ```ts
  const parts = lists.filter(list => list.boxes.length > 0).map(list => tintVertices(mergeBoxes(list.boxes), list.color))
  return parts.length > 0 ? mergeTinted(parts) : null
  ```
  `mergeTinted([])` throws (`mergeGeometries` reads its first part), so empty lists never reach it. Marks keep radius 0: `mergeTinted` recomputes normals, which come out flat and exact on unindexed square boxes but would facet a rounded one.
- Produces: `PaintMarks({ lists: readonly TintedBoxes[], thermal: boolean })`: one matte mesh, `vertexColors`, geometry through `useOwnedGeometry`, nothing drawn when every list is empty. Tasks 4 and 5 add their opaque marks to the same `lists`.
- Produces: the hide rule, owned by `PaintMarks` (and by `PaintStains` in Task 4), so no call site repeats it. The component wraps its mesh in `<group visible={!thermal} userData={BLUEPRINT_OMIT_TAG}>` and gives the mesh `raycast={ignoreRaycast}`:
  - `visible` is a group flag, because `applyGhost` overwrites each mesh's own `visible`.
  - `BLUEPRINT_OMIT_TAG` (`F/constants/scene-load.ts`) keeps the marks out of the blueprint drawing (spec §6.6, §10.7). The blueprint load's own work may still hold hunks in `scene-load.ts`: import from it, never edit it.
  - Taps pass through to the wall, as the gable vent's overlays do (`gable-vent.tsx`).

- [ ] **Step 1: Update the checks.**
  - The seed check passes `share: 4 / 3` (today's `wear: 1`) and keeps its exact count `21` and first box.
  - `gableCracks(4 / 3)` and `parapetCracks(4 / 3)` replace the `(1)` calls; `parapetCracks(0)` totals 0 (replaces the `0.3` "new paint" check).
  - The gable vent's check becomes `gableCracks(PAINT_WEAR_SHARE.heavy)`. Left as `WEAR_AMOUNT.failing` it still compiles, but it would test Moderate.
  - The three hand-built `FRONT_OPENINGS` in the script import the new export.
  - New: `stuccoCracks({ ...spec, share: 0.5 })` is non-empty and every one of its boxes appears in `stuccoCracks({ ...spec, share: 4 / 3 })`.
  - New, the door: the front wall's cracks at seed 5 never reach the door, so a check on them alone cannot fail.
    - Find a seed (or a `perWall`) whose cracks without the door do cross the door's rectangle, widened by the opening margin.
    - Assert that with `openings: FRONT_OPENINGS` none do.
    - Assert that the seed's other cracks are unchanged.
    - Assert that `house-shell.tsx` passes `FRONT_OPENINGS` for its front cracks. A source-text check is enough.
  - `paintLook({ material: 'standard', wear: 0 }, { cracks: 'heavy', stains: 'heavy', peeling: 'heavy' }).paintWear` is all `none`; `paintLook({ material: 'standard', wear: 0.75 }, PAINT_WEAR_START.worn).paintWear` equals `PAINT_WEAR_START.worn`; the two existing one-argument calls gain `PAINT_WEAR_START.worn`.
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: fails to compile.
- [ ] **Step 3: Implement** as listed. The crack loop already keeps its first cracks as the count grows (each crack's draws depend only on the cracks before it); keep it that way. `paintLook` gives all `none` when `paint.wear === 0` (installed or new paint).
  - Skirt cracks: `stuccoCracks` on `HOUSE_WALLS` with `face: T / 2`, `band: [0, UNDER_FLOOR]` (the `SKIRT` boxes, `foundation.tsx:30-35`, run on those wall lines) and `openings` the crawl vents on that line, in the ground group's frame so they fade and move with it. The vents hang outside the ground group, at fixed depths under the floor (`foundation.tsx`, `VENT_Y`). So convert each vent's rectangle into the ground frame at the raised floor once, as a module constant in `foundation.tsx` built from `CRAWL_VENTS_X`, `CRAWL_VENTS_Z` and `FOUNDATION.vent`.
  - **The ground group stretches** (`apply-home-floor.ts`: `scale.y` is about 1.71 on a raised home). Name the raised stretch once, `RAISED_GROUND_STRETCH = (HOME_FLOOR_Y.raised - HOUSE.floorThickness) / (HOUSE.floorY - HOUSE.floorThickness)`, and divide every foundation mark's height by it, so it reads at its real size. Crack segments tilt, so their heights shear slightly; check them by eye in Step 5.
  - The front skirt: `FRONT_WALL` with `openings` the door and the front crawl vents, the face less `FRONT_WALL_PROUD`, in its `complete` group.
- [ ] **Step 4: Run** `verify-trade-scene`, `verify-trade-scene-layout`, tsc, and eslint on every touched file. Expected: exit 0.
- [ ] **Step 5: Screenshots** (`shots/t3.mjs`, waiting for load phase `live`): a raised home at Worn and at Failing, 1366×1024, both schemes; then Cracks → None at Failing; then Failing under the Thermal lens, on a pitched and a flat home; then one shot during the blueprint load (phase `drawing`). Read them:
  - The foundation wall is the wall's colour and fades with it.
  - At Worn the cracks match Step 0's shot.
  - No crack crosses a crawl vent.
  - Cracks → None leaves no crack anywhere, gables and parapets included.
  - Under Thermal no crack shows, gables and parapets included.
  - The blueprint draws no crack lines.
- [ ] **Step 6: Commit** — `feat(trade-scenes): cracks follow the paint's Cracks level and keep off the front door, and the raised foundation wall wears the wall's paint`

---

### Task 4: Stains and the Condition's blotches (spec §4.1, §6.3, §6.6, §6.7)

**Files:**
- Create: `F/lib/stain-boxes.ts`
- Create: `F/ui/lib/create-stain-atlas.ts`
- Modify: `F/ui/lib/vertex-tinted-geometry.ts` (`tintVertices` gains an optional `alpha`; add `mergeStainBoxes`)
- Create: `F/ui/components/home-kit/paint-stains.tsx`
- Modify: `F/lib/window-boxes.ts` (export `sillLedgeBox(wall, opening, floorY, wallThickness): BoxSpec`, lifted from `:27`; `windowBoxes` uses it)
- Modify: `F/constants/wear-looks.ts` (`WEAR_LOOKS.paint` gains the stain colours, sizes, alphas and the atlas's gradient stops; working numbers)
- Modify: `F/types.ts` (new exports `StainCell`, `StainBoxes`)
- Modify: `F/ui/components/home-kit/house-shell.tsx`, `F/ui/components/home-kit/foundation.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `PaintLook.paintWear`, `PAINT_WEAR_SHARE`, `FRONT_OPENINGS`, `TintedBoxes`, `PaintMarks`, the hide rule (Tasks 1, 3); `HouseWall`, `wallBox`, `seededRandom`, `wornShare`, `createRadialTexture`, `mergeBoxes`, `useOwnedGeometry`.
- Produces: `type StainCell = 'splash' | 'streak' | 'blotch'`; `interface StainBoxes { cell: StainCell, boxes: BoxSpec[], color: string, alpha: number }`. A stain is a zero-thickness `wallBox` a hair proud of its face, so it needs no plane type and no rotation code.
- Produces, all pure and seeded in `F/lib/stain-boxes.ts`, each list at a share a prefix of the same call at a higher share, every function taking `openings = wall.openings`:
  - `splashBand(wall: HouseWall, base: number, share: number, openings?): BoxSpec[]` — the band along the wall's foot from `base` (grade on the foundation wall, the stucco's foot on a slab), split at door openings.
  - `runoffStreaks(wall: HouseWall, floorY: number, top: number, share: number, seed: number, openings?): BoxSpec[]` — one or two streaks under each window sill, fainter ones under the eave line.
  - `sillDirt(wall: HouseWall, floorY: number, wallThickness: number, share: number): BoxSpec[]` — a thin layer on each `sillLedgeBox`'s top.
  - `fadeBlotches(wall: HouseWall, floorY: number, top: number, share: number, seed: number, sunlit: boolean, openings?): BoxSpec[]` — soft cloud-shaped patches; `share` is the Condition's (`wornShare(paint.wear)`), not a level; sunlit walls get more of them (spec §4.1, palest on the sun side).
- Produces: `createStainAtlas(): CanvasTexture` — one white texture with alpha only, three cells side by side: the splash (darkest at grade, fading upward with no line, a few fully opaque rows at the bottom for the thin grime line), the streak (feathered at both ends), the blotch (radial, drawn like `createRadialTexture`). The factory returns a new texture each call, like the other `create-*-texture.ts` files. The "made once on first use" cache lives in `paint-stains.tsx`, as `heat-arrows.tsx`'s `cometTexture()` does (`let atlas: CanvasTexture | null = null; atlas ??= createStainAtlas()`), and every stain mesh shares it.
- Produces: `tintVertices(geometry, hex, jitter = 0, seed = 1, alpha?: number)`. When `alpha` is given it writes a four-channel `color` (item size 4; three 0.180 turns on vertex alpha for it). Plants and neighbours never pass it and are unchanged.
- Produces: `mergeStainBoxes(lists: readonly StainBoxes[]): BufferGeometry | null` in `vertex-tinted-geometry.ts`: non-empty lists only, each `mergeBoxes(list.boxes)` with its UVs squeezed into its atlas cell, then `tintVertices(…, list.color, 0, 1, list.alpha)`, then `mergeTinted`. The UV squeeze is the only new code.
- Produces: `PaintStains({ lists: readonly StainBoxes[], thermal: boolean })` — under the same self-owned hide group as `PaintMarks` (Task 3). One mesh per fade group: `transparent`, `depthWrite={false}`, `polygonOffset`, matte, `vertexColors`, `map` the shared atlas, material `color` white and `opacity` 1, like `leak-stain.tsx`. Strength rides in the vertex alpha, never in the material's opacity, because the view fades rewrite that from its first value on every scan (`apply-ghost.ts:16-24`).

- [ ] **Step 1: Write the failing checks** in `verify-trade-scene.ts`:
  - For every wall in `Object.values(HOUSE_WALLS)`, and `FRONT_WALL` with `FRONT_OPENINGS`, and the foundation walls with their crawl vents (Task 3), at shares `0.5`, `1`, `4/3`, no box from `splashBand`, `runoffStreaks` or `fadeBlotches` overlaps an opening's rectangle (`along ± width/2`, `floorY + sill … floorY + head`). The door is included.
  - Every streak's top is at or below its sill.
  - Each function returns `[]` at share 0, and its list at `1` is a prefix of its list at `4/3` (deep-equal on the shared items).
  - Every box has positive width and height, zero thickness, and its centre on its own wall's face (within 0.01 of `face`).
  - `sillDirt` gives one box per window, each on top of that window's `sillLedgeBox`.
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: fails to compile.
- [ ] **Step 3: Implement the pure tier** in `F/lib/stain-boxes.ts`, with every size from `WEAR_LOOKS.paint`. Field figures to start from (spec §4.1): the splash band 15–60 cm tall, darkest at grade; streaks 10–30 cm wide. On the raised foundation wall, divide heights by `RAISED_GROUND_STRETCH` (Task 3), so the band reads at its real height once the ground group stretches it.
- [ ] **Step 4: Draw them.**
  - One `PaintStains` per fade group; the hide group comes with it.
  - **House shell groups:**
    - The side and back walls.
    - The front wall inside its `complete` group.
    - The wall splash band, which only shows on a slab home, in a `HOME_FADE_TAGS.slab` group. The front wall's share of it sits in a `slab` group nested inside the front's `complete` group, the way `FRONT_SKIRT` nests `complete` inside `raised` (`foundation.tsx`), so it leaves with Partly open and with the raised switch. That is one more stains mesh on a slab home (Global Constraints).
  - **Foundation groups:** the foundation wall's splash band and blotches in the raised group, the front's in its `complete` group.
  - **Strength:** a list's `alpha` is `WEAR_LOOKS.paint.<stain>Alpha × PAINT_WEAR_SHARE[paintWear.stains]`, capped at 1; the blotches' is `blotchAlpha × wornShare(paint.wear)`.
  - **Sill dirt** joins that group's `PaintMarks` lists in the dirt colour (paint owns the sill, spec §6.7); it never touches the window `frames` mesh.
  - **Draw order:** set `renderOrder` on each stains mesh above the stucco's, so mid-fade the stucco never blends over them. three sorts see-through meshes by `renderOrder`, then depth; mount order only breaks ties.
  - **Mounted when empty:** keep each `PaintStains` mounted, drawing nothing, while its lists are empty. That way the load compiles its shader once (`compile-scene`), not on a rep's New → Worn tap. UNVERIFIED that an empty mesh compiles; check it in the Step 7 probe's console, and if it doesn't, note it in `progress.md` rather than add a dummy box.
  - **Memoising:** placement in `useMemo` keyed on the levels and the wear.
- [ ] **Step 5: Run** the pure set, tsc and eslint on every touched file. Expected: exit 0.
- [ ] **Step 6: Draw calls.** At Failing, every kind Heavy, Complete, count calls with `shots/perf.mjs` on a raised and a slab pitched home, against the base commit. Write both pairs in `progress.md`, with what is left of TS3b.6's budget of 177 for 6-B. A call beyond the expected meshes is a merging bug (Global Constraints).
- [ ] **Step 7: Screenshots** (`shots/t4.mjs`, waiting for load phase `live`), at the opening view (it now fits the house and the garage, so marks read smaller than before 6-A). Shoot in both schemes at 1366×1024, plus 1024×768 with the nav open:
  - a slab and a raised home at Fair with defaults;
  - Worn with Stains → Heavy;
  - Failing with Stains → None;
  - Worn with Stains Light → Heavy, then Partly open and back to Complete;
  - each in Complete, Partly open, and under the Thermal lens.

  Read every PNG against spec §4. The look to match:
  - The splash band reads as a warm, muddy skirt from the default camera, with a thin dark line at grade.
  - Streaks hang under the sills; sill tops read dusty.
  - The sunlit walls read blotchier than the shaded ones.
  - Nothing reads as a ruin at Heavy.
  - Heavy's strength shows at once and survives the Partly open round trip.
  - Under Thermal no stain shows.
  - Partly open leaves no mark in the air.
  - The raised ↔ slab switch crossfades the bands.

  Tune the working numbers until it does, and log each change in `.superpowers/sdd/2026-10-30-exterior-paint-wear-kinds/progress.md`.
- [ ] **Step 8: Commit** — `feat(trade-scenes): worn paint stains at the foot of the walls, under the sills and on their tops, and blotches as it fades`

---

### Task 5: Peeling and chipping on the stucco, the door frame and the pitched fascia (spec §4.1, §4.2, §6.3, §6.4, §10.9)

**Files:**
- Create: `F/lib/paint-peeling.ts`
- Create: `F/lib/front-door-boxes.ts` (`FRONT_DOOR_BOXES = { frame, leaf }`, the door frame and leaf boxes moved out of `house-shell.tsx`, `:76-83` on 2026-11-01. They are built with `wallBox`, so they go with the other derived box lists in `F/lib/*-boxes.ts`, like `garage-boxes.ts` and `low-slope-roof-boxes.ts`. `house-shell.tsx` imports them.)
- Modify: `F/constants/wear-looks.ts` (peeling colours and sizes: bare stucco base coat, bare grey-brown wood, the lifted flake; working numbers)
- Modify: `F/types.ts` (new export `PeelingBoxes`)
- Modify:
  - `house-shell.tsx`: the walls and the door frame.
  - `foundation.tsx`: the foundation wall.
  - `gable-roof.tsx`: passes `paint` and `thermal` to its three `RoofSlope`s, at `:102`, `:103` and `:116` on 2026-11-01.
  - `roof-slope.tsx`: gains `paint: PaintLook` and `thermal: boolean`, for its fascia `Slab` at `:124`.
  - Not `low-slope-roof.tsx`: a flat roof's front fascia (`low-slope-roof-boxes.ts`) hides 1 mm inside the Complete front parapet and never peels (spec §10.9).
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `PaintLook.paintWear`, `PAINT_WEAR_SHARE`, `FRONT_OPENINGS`, `TintedBoxes`, `PaintMarks`, the hide rule; `wallBox`, `seededRandom`.
- Produces: `interface PeelingBoxes { bare: BoxSpec[], lifted: BoxSpec[] }` (the same two-list shape as `parapetCracks`). Bare patches lie flush a hair proud of the face; lifted flakes sit on their rims, a little prouder and slightly tilted.
- Produces, pure, seeded, prefix-stable, in `F/lib/paint-peeling.ts`:
  - `wallPeeling(wall: HouseWall, floorY: number, bottom: number, share: number, seed: number, openings = wall.openings): PeelingBoxes` — small clusters at the wall's foot, just under each window sill, and at the wall's outside corners. Never whole sheets. The foundation wall calls it with its own `bottom` (grade) on the same wall lines as its cracks, with the crawl vents as openings and heights divided by `RAISED_GROUND_STRETCH` (Task 3).
  - `doorFramePeeling(share: number, seed: number): PeelingBoxes` — the lowest 30–40 cm of both jambs, plus thin chips along the frame's outside edges, on `FRONT_DOOR_BOXES.frame`.
  - `fasciaPeeling(run: readonly [number, number], share: number, seed: number): PeelingBoxes` — patches along one fascia's run, in that fascia's own frame. Each `RoofSlope` peels its own run, so the front slope's Complete piece (`gable-roof.tsx:116` on 2026-11-01) leaves with its group.

- [ ] **Step 1: Write the failing checks:**
  - `[]` lists at share 0.
  - Prefix stability from `1` to `4/3`.
  - No wall peeling overlaps an opening, the front door included.
  - Every wall peeling box lies within 0.6 m of the wall's foot, of a sill underside or of a wall end.
  - Every door-frame box lies on a `FRONT_DOOR_BOXES.frame` box.
  - The total bare area at `4/3` stays under a working-number share of the wall's area (start at 2%), so heavy never reads as whole sheets.
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-trade-scene.ts`. Expected: fails to compile.
- [ ] **Step 3: Implement the pure tier.**
- [ ] **Step 4: Draw them.**
  - Each surface's `bare` and `lifted` lists join the `PaintMarks` of the fade group they sit in, so peeling adds no mesh where cracks already draw one.
  - The door frame's lists join the front wall's group when they share its fade group.
  - Each `RoofSlope` draws one `PaintMarks` for its fascia, passing `thermal`; the hide group comes with it.
  - Window frames never peel.
  - The share is `PAINT_WEAR_SHARE[paintWear.peeling]`.
- [ ] **Step 5: Run** the pure set, tsc and eslint. Expected: exit 0.
- [ ] **Step 6: Draw calls**, as Task 4 Step 6, on pitched and flat homes. A flat home gains no fascia mesh.
- [ ] **Step 7: Screenshots** (`shots/t5.mjs`, waiting for load phase `live`): the same set as Task 4, plus one shot during the blueprint load (no flake lines), with Peeling → Heavy and → None, plus a 2× zoom crop of the door. Read them against spec §4. From the default camera, peeling shows as small dark patches at the foot of the door and the walls; up close the flakes read lifted. Tune and log as in Task 4.
- [ ] **Step 8: Commit** — `feat(trade-scenes): worn paint peels and chips at the walls' feet, under the sills, at the corners, on the door frame and the fascia`

---

### Task 6: Whole look, frame cost and the owner's set (spec §2, §7, §9)

**Files:**
- Create: `.superpowers/sdd/2026-10-30-exterior-paint-wear-kinds/shots/final.mjs`, `.../shots/final/report.md`
- Modify: `docs/plans/2026-10-16-trade-scenes-epic.md` (the R121 Status cell: built, with the commit range; never staged: `docs/**` is never staged, and other sessions' rows share the file)

- [ ] **Step 1: The owner's set.**
  - Shoot every Condition at its defaults, then each kind alone at Heavy with the others at None.
  - Use a slab and a raised home, pitched and flat, at 1366×1024, 1024×768 (nav open) and 390×844, in both schemes.
  - Also shoot the Tri Pros build with paint installed over Failing + all Heavy; it must be clean.
  - Read every PNG and write what each shows in `report.md`.
- [ ] **Step 2: Frame cost.** In `report.md`, record the final draw-call counts (`shots/perf.mjs`, at load phase `live`) for the four homes at the gate's worst case, beside the base commit's, with each home's percentage. Also record 6-A's reference case (flat roof, default view) and what it leaves of TS3b.6's budget of 177 for 6-B (spec §10.6). Note, don't fix: the frame-time check on iPad is still owed from TS3b.3.
- [ ] **Step 3: Checks.** Run the pure set, tsc, and eslint on every file the build touched. Expected: exit 0.
- [ ] **Step 4: Commit** any tuning made in this task by explicit path, with the same message style. Update the tracker's R121 cell but don't stage it (other sessions hold hunks in the tracker).
