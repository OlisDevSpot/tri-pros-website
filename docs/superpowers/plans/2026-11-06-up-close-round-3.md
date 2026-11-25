# TS3b.4b round 3: inside out, and the window comes apart, Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold the owner's third look at Up close into the branch before it merges:
- every system's list reads inside out;
- the window separates instead of peeling, and its flashing sits behind the frame;
- the attic gets its ceiling joists and the dust over its gaps;
- the wall lists Stucco, Eaves & trim and Paint, each one pickable;
- fascia rot can be set, and repaired from a switch;
- the old felt looks brittle;
- the deck's wood replacement is fewer, larger, staggered sheets that fade with the deck.

| Part | Spec | Tasks |
|---|---|---|
| Inside-out lists; ceiling joists | §12.1, §12.2, §12.4 | 1 |
| Dust over the attic's gaps | §12.4 | 2 |
| The window comes apart | §12.2 Windows, §12.3 | 3 |
| The wall's three parts | §12.5 | 4 |
| Fascia rot | §12.6 | 5 |
| Fascia repair | §12.6, §12.9 | 6 |
| The deck's sheets and stains | §12.7 | 7 |
| The old felt | §12.7 | 8 |
| By-eye pass and hand-over | all | 9 |

**Architecture:**
- **One list, read two ways.** `SYSTEM_PARTS` holds each system's parts inside out: the card, the pins and the window's spread read it as it stands. The stepped cutaway (`stepOrder`, so `stepStarts` and `stepBottom`) reads it **reversed**, so the outermost part is still cut back furthest. `PART_PIECES` keeps list order. Heating & cooling's entries don't move, so its duct pieces step exactly as now.
- **The window spreads with group offsets, not rebuilt boxes.** A pure `windowSpread(shown, pull)` gives each shown window part an offset vector along the wall's outward normal. The flashing gets zero, and each later part in list order gets one `WINDOW_SPREAD.step` more. Frame, seals and panes draw their resting boxes inside a `<group position={offset}>`. Lanes and pins add the same offset. The windows leave `STEP_DEPTHS`, and the slider asks `peels()`, which now also answers for the pulled-apart systems.
- **New parts are pieces on existing construction parts:**
  - `ceiling-joists` on `ceiling`;
  - `stucco` on `finish`;
  - `eaves-trim` on `paint`.
  - No construction part is added, split or retagged, so no figure moves.
- **Fascia rot is drawing data.** It's a fourth paint-damage kind, defaulting to `none`, and it survives a repaint. The repair is one scope id named in the construction core outside `SCOPE_INSTALLS`. `SceneTargets.fasciaReplaced` carries it, and its switch writes through `applySceneChange`, like every other control.
- **Marks belong to their part.** The deck's rot stains and new sheets move from the flows (outside the ghost) into the house group under the deck's tag. The fascia's rot and new boards sit under the `eaves-trim` tag, and the dust under the `ceiling` tag.

**Tech Stack:** Next.js 15, React 19.2, `@react-three/fiber` 9.8.2, three 0.180, the zustand scene store, Tailwind v4, shadcn `Button`. Checks are the repo's `tsx` verify scripts (`node:assert/strict`) and local Playwright screenshots.

**Spec:** `docs/superpowers/specs/2026-10-30-up-close-on-a-system-design.md` §12 (round 3, owner-approved 2026-11-06), with §12.10's planning calls. Read it beside §11 and §11.9, which are built. Where §12 differs, it supersedes §3.3 Steps, §11.2, §11.5's order and §11.9 Walls.

## Global Constraints

- **Binding rules** (every task):
  - commit by explicit path only, once the task's verify step passes, through `SDD/commit-own.sh` (copy round 2's helper into this round's workspace);
  - `git commit` with a 300000 ms timeout, never `--no-verify`;
  - never `git add -A`/`.`, stash, reset, `checkout --`, restore, amend, merge, rebase or push;
  - after any scripted edit, run `git diff --shortstat`;
  - no DB writes of any kind; `pnpm tsc` and eslint only, never `pnpm build`;
  - never start, stop or restart the dev server.
- **Also binding:** `.superpowers/sdd/2026-11-05-up-close-round-2/rules.md`. Read it with these substitutions:
  - this spec section is §12, not §11;
  - this round's workspace is `SDD/` = `.superpowers/sdd/2026-11-06-up-close-round-3/`;
  - the `CORE/` exception covers Tasks 5 and 6, not Task 4;
  - the claim string is `TS3b.4b-r3 Task N <ISO time>`.
- **Another session is building colour picks on this branch** (`.superpowers/sdd/2026-11-06-trade-scene-colour-picking/`, from `4e2f594ed` through at least `4d9367625`). It has changed, or may still change, these files this plan edits:
  - `F/types.ts`; `scripts/verify-trade-scene.ts`; `F/lib/resolve-scene.ts`; `F/lib/apply-scene-change.ts`;
  - `F/ui/components/home-kit/house-roof.tsx`, `home-kit.tsx`, `house-shell.tsx`, `roof-slope.tsx`, `low-slope-roof.tsx`, `garage.tsx`;
  - `F/ui/lib/paint-look.ts`; `F/lib/window-boxes.ts`; `F/constants/home-palette.ts`, `home-scene-copy.ts`;
  - `F/ui/components/controls/system-card-body.tsx`, `proposed-chip.tsx`.

  Before each task, check `.superpowers/claims/` and `git log -3`, re-read every listed file the task edits (the plan's line references predate those commits), and write a claim for each. A foreign claim is advisory: edit through the foreign-hunk recipe and name it in the report. Never edit a file while its other session has an uncommitted hunk you would have to stage around without the recipe.
- **Baselines** (the controller, before Task 1, once the colour session's last task has landed, at the head of that moment):
  - copy round 2's `baseline-savings.ts` into `SDD/`, run it, and keep `SDD/baseline-savings.json`;
  - take the frame cost (draw calls, triangles) of:
    - the whole home;
    - the roof's Look inside at peel 1;
    - the window's Look inside at full pull, to be taken after Task 3 as its own baseline.

  "Savings unchanged" means the script's JSON diffs clean. No builder checks out an old commit.
- **Kept from §1–§11:**
  - a pick never flips the scene; only Today ⇄ Build does;
  - a tap away exits Systems;
  - Escape steps back one layer at a time;
  - the `live` gate holds pins and shortcuts;
  - no new DOM id, `data-` hook or three.js `userData` key carries the word "system" (the key is `scenePart`; older hooks such as `data-system-row` stay as they are);
  - the attic stands fully open, with no slider (`FULLY_OPEN_SYSTEMS`);
  - the wall has no pins;
  - heating & cooling is untouched.
- **Savings never move.**
  - No construction part's `group` is retagged, and no construction part is added or split.
  - `ceiling-joists`, `stucco` and `eaves-trim` are system parts on existing construction parts.
  - Fascia rot, its repair, the felt's look and the sheets change drawing and copy only.
- **Copy:**
  - screen copy lives in `F/constants/home-scene-copy.ts`;
  - never "your", never solar;
  - each task's strings are exact and verbatim.
- **Vocabulary:**
  - system part, Look inside, existing/proposed;
  - never "layer", "zoom" or "today" in code or test messages;
  - wood replacement: `woodReplaced*`, never `repair*` in code (yearly upkeep owns `repairs`; `CONTEXT.md` Wood replacement), though customer copy may say "repair";
  - the fascia scope's code names are `FASCIA_REPLACEMENT_SCOPE_ID`, `fasciaReplaced`, `fasciaBoards`, the slot id `'replace:fascia'`, the change kind `'fascia-replacement'`, `keepFasciaReplacement` and the copy key `fasciaReplacement`. No code name says "repair"; only the chip's words do.
- **Working numbers:** every hand-tuned figure gets one comment on its constant marking it a working number set by screenshot.
- **Test fixtures:**
  - the names in a task's test code (`leaking`, `dry`, `unsealedGable`, `flatScene`, `singleScene`, `stuccoHome`, `repaintedScene`, `unpaintedHome`, and the like) are local consts inside the task's own section block, built with the script's own `at({ property: profile({...}), view, proposedScopeIds, weather })` and `withMaterials`, never new shared helpers. `flatRoof` and `repainted` are already top-level `applyAll` states (`verify-trade-scene.ts:2777`, `:2802`), so a scene never takes those names;
  - reuse a section's existing fixture where it already has one (the stepped-roof section's leak home, the windows section's `newWindow`, `oldDouble`, `sixtiesSingle`);
  - `NO_RUN` and `at` are top-level; `near`, `shownOf` and `stepsOf` are block-local in their sections. Task 1 moves `shownOf` to the top level, widened to every `HomeSystemId`: `(system, scene) => systemLit(system, systemPartRows(system, scene), null).shown`.
- **Checks:** run `pnpm tsc` and eslint under `flock .superpowers/heavy.lock` (round 2's `rules.md`). `verify-scope-installs.ts` reads the live catalog through `catalogSource`. It is a read-only network read that needs `.env.local`, and nothing else in the round touches a service.

## Review Focus

1. **A home saved before round 3** has no `'fascia-rot'` key in `paintWear`. The panel, `paintWearInForce` and every drawing read it as None, with no crash and no write. (Task 5 test.)
2. **The repair pick outliving its rot.** Set fascia rot and turn on Replace rotted fascia. Then either set the rot back to None, send the paint back to its era guess (which clears the recorded levels), or rate the paint New. The pick goes, and nothing hidden stays in `proposedScopeIds`. A paint option change keeps the recorded levels (`verify-trade-scene-layout.ts`: "a paint option change keeps the levels"), so it keeps the pick. (Task 6 test.)
3. **The window at pull 0, and leaving mid-pull.** Every part stands exactly where the house draws it. A single-pane window spreads three steps, not seven. Leaving eases the parts home with the ghost. (Task 3 tests, and a leave-mid-pull shot.)
4. **A flat roof's attic.** There's no Ceiling joists row and no joists pin. The joists still draw, tagged `rafters`, as the roof's rafters. (Task 1 test.)
5. **The roof's pin numbers.** With rain getting in, pin 1 is the Ceiling; without it, pin 1 is Rafters. The step a pick lights is the same part as the number tapped. (Task 1 test.)

---

### Task 1: Every list inside out; the ceiling joists become their own part (spec §12.1, §12.2 Roof/Attic, §12.4)

**Files:**
- Modify: `F/constants/system-parts.ts` (roof and attic order, `ceiling-joists`); `F/lib/step-cut-back.ts` (`stepOrder`); `F/lib/system-parts-shown.ts` (`SystemStory.form`, `roofForms`); `F/types.ts` (`SystemPart.roofForms`); `F/constants/look-inside.ts` (`UNSTEPPED_SYSTEM_PARTS`, `PART_PAINT_FACES`); `F/constants/home-scene-copy.ts` (label); `F/ui/components/home-kit/attic-floor.tsx`; `F/lib/system-part-focus.ts` (pin point)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `SystemPart.roofForms?: readonly RoofForm[]`: shown only on these roof forms;
  - `systemStory(targets)` returns `{ leak, airGaps, form: RoofForm }`, with the form from `homeRoofForm(targets.assemblies['roof-attic']?.form)`. An unset roof draws as a gable, so it reads `'pitched'` and keeps its joists row;
  - `stepOrder(shown)` returns the shown stepping parts **outermost first** (list order reversed);
  - system part id `'ceiling-joists'`.

- [ ] **Step 1: Write the failing tests** in the stepped-roof section (beside "the steps run in the order the card lists them"):

```ts
assert.ok(leaking.leak.reachesInside > 0 && dry.leak.reachesInside === 0)
assert.deepEqual(listedRows(systemPartRows('roof', leaking)).map(row => row.id), ['ceiling', 'rafters', 'deck', 'drip-edge', 'ice-and-water', 'underlayment', 'covering', 'ridge-vent', 'gutter'].filter(id => systemPartRows('roof', leaking).some(row => row.id === id)), 'the roof lists inside out, the ceiling first while rain gets in')
assert.equal(listedRows(systemPartRows('roof', dry))[0]!.id, 'rafters', 'with no rain inside, the rafters are pin 1')
assert.deepEqual(stepOrder(['ceiling', 'rafters', 'deck', 'drip-edge', 'ice-and-water', 'underlayment', 'covering', 'ridge-vent', 'gutter']), ['covering', 'underlayment', 'ice-and-water', 'deck', 'rafters', 'ceiling'], 'the cut still opens outside in')
assert.deepEqual(stepOrder(['ceiling', 'ceiling-joists', 'attic-insulation', 'radiant-barrier', 'attic-fan']), ['attic-insulation', 'ceiling'], 'the open attic steps its blanket over its ceiling')
assert.deepEqual(stepOrder(['air-sealing', 'ceiling-joists', 'attic-insulation', 'radiant-barrier', 'attic-fan']), ['attic-insulation', 'air-sealing'], 'the sealed attic steps its blanket over its air sealing')
assert.deepEqual(listedRows(systemPartRows('attic', unsealedGable)).map(row => row.id), ['ceiling', 'ceiling-joists', 'attic-insulation', 'radiant-barrier', 'attic-fan'].filter(id => systemPartRows('attic', unsealedGable).some(row => row.id === id)), 'the attic lists inside out')
assert.equal(systemPartRows('attic', unsealedGable).find(row => row.id === 'ceiling-joists')!.label, 'Ceiling joists')
assert.ok(!systemPartRows('attic', flatScene).some(row => row.id === 'ceiling-joists'), 'a flat roof\'s joists are its rafters, with no row of their own')
assert.ok(systemPartFocus('attic', 'pitched', 'ceiling-joists', 1, shownOf('attic', unsealedGable), NO_RUN) !== null, 'the joists have a pin')
```

Rewrite the parts list's invariant `a piece belongs to its whole part's system` (`verify-trade-scene.ts:3222`, an exact match today) to a subset check: every system of a piece is one of its whole part's systems. The joists sit on the shared ceiling but list only in the attic. Message: `'a piece belongs to one of its whole part\'s systems'`.

Rewrite the existing check `the steps run in the order the card lists them` to: `assert.deepEqual([...starts.keys()], [...shown].filter(id => starts.has(id)).reverse(), \`${label}: the steps run against the card's order, the outermost cut back furthest\`)`. Add an `UNSTEPPED` expectation so that `ceiling-joists` is `NEVER_STEPS`. Every stepStarts value at peel 1 must equal what it was before this task: assert covering, underlayment, ice-and-water, deck and rafters at `HOUSE.cutX + k * STEP_DEPTHS.roof` for k = 5, 4, 3, 2, 1 with rain inside.

- [ ] **Step 2: Run, and see it fail:** `pnpm tsx scripts/verify-trade-scene.ts`, which fails on the new orders.
- [ ] **Step 3: Implement.**
  - **New list order:**
    - one `ceiling` entry first, as now, shared;
    - then the roof: `rafters, deck, drip-edge, ice-and-water, underlayment, covering, ridge-vent, gutter`;
    - then the attic: `air-sealing, ceiling-joists, attic-insulation, radiant-barrier, attic-fan`;
    - every other system's entries are untouched in this task.
  - **The joists' entry:** `{ id: 'ceiling-joists', assembly: 'roof-attic', part: 'ceiling', systems: ['attic'], roofForms: ['pitched'] }`.
  - **`systemPartsShown`** drops an entry whose `roofForms` doesn't include `story.form`.
  - **The test helper:** move `shownOf` to the script's top level, widened to every system (Global Constraints, Test fixtures), and point the windows and walls sections at it.
  - **`stepOrder`:** `[...shown].filter(steps).reverse()`. Keep its "top first" comment true.
  - **Other constants:**
    - `UNSTEPPED_SYSTEM_PARTS` gains `'ceiling-joists'`;
    - `PART_PAINT_FACES['ceiling-joists'] = { inner: 'attic', outer: 'attic' }`;
    - `SYSTEM_PART_LABELS['ceiling-joists'] = 'Ceiling joists'`, with no detail.
  - **`AtticFloor`:** `const joists = lowSlope ? 'rafters' : 'ceiling-joists'`.
  - **The joists' pin:** `ROOF_POINTS.pitched['ceiling-joists']` sits on the top of the joist (from `atticJoistBoxes(false).open`) nearest `BY_THE_CUT`, on the kept span (z ≤ `HOUSE.atticFrontZ - 0.3`), clear of the air sealing's and the ceiling's pins (a working number, set by a dark shot).
- [ ] **Step 4: Verify.**
  - `pnpm tsx scripts/verify-trade-scene.ts` prints `verify-trade-scene: ok`;
  - tsc and eslint (rules' Checks) exit 0;
  - the savings JSON diffs clean.
  - **Shots** (1194×834 dark):
    - the roof's Look inside in Rain at peel 1, with pins 1–9 inside out (Ceiling = 1) and the steps unchanged;
    - the attic's Look inside, existing, with the Ceiling joists pin and the pick lighting only the joists.
- [ ] **Step 5: Commit:** `feat(trade-scenes): every system part list reads inside out, the cut still opens outside in, and the ceiling joists are their own part`.

### Task 2: Dust over the attic's gaps (spec §12.4, §12.10)

**Files:**
- Create: `F/lib/attic-dust-patches.ts`; `F/ui/components/home-kit/attic-dust.tsx`
- Modify: `F/ui/components/home-kit/attic-floor.tsx` (mount it); `F/ui/components/home-kit/house-roof.tsx` (where `AtticFloor` mounts; it passes `dusty` and `ducted` through); `F/ui/components/home-kit/home-kit.tsx` (works out `dusty`); `F/ui/components/home-kit/cutaway-rot-stains.tsx` (a `color` prop, defaulting to `CUTAWAY_FLOW_COLORS.rot`, which it hard-codes today); `F/constants/home-palette.ts` (`atticDust`); `F/constants/look-inside.ts` (`ATTIC_DUST`)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: the ceiling openings for this home (`F/lib/ceiling-openings.ts`, which leaves out the duct boot unless the home is ducted), `laidInsulationDepth(material, lowSlope)`, `stepStarts`, `useStepPeel`.
- Produces:
  - `atticDustPatches(material: string | null, lowSlope: boolean, ducted: boolean, from: number | null): BoxSpec[]`: one flat patch per ceiling opening the home has, centred over it on the blanket's top;
  - it drops every patch at x < `from` (the blanket's step start; `null` keeps all);
  - empty when `material` is null.
  - `CutawayRotStains` takes `color?: string`.

- [ ] **Step 1: Write the failing test:**
  - for `'blown-r30'`, pitched, ducted, `from` null: one patch per opening, centred at its `at`, at `y = WALL_TOP_Y + laidInsulationDepth('blown-r30', false) + ATTIC_DUST.lift`, `size[1] <= 0.005`;
  - not ducted: no patch over the boot (`'no boot, no dust over one'`);
  - with `from` set to the attic's `stepStarts(...).get('attic-insulation')` at peel 1, no patch lies at x < `from`, and every opening at x ≥ `from` keeps its patch (`'the bare strip shows its gaps, the blanket its dirt'`);
  - `atticDustPatches(null, false, true, null)` gives `[]`.
  - Messages: `'the dust lies on the blanket over each gap'`, `'no blanket, no dust on it'`.
- [ ] **Step 2: Run, and see it fail.**
- [ ] **Step 3: Implement.**
  - **`AtticDust({ lowSlope, material, ducted, lit })`:**
    - draws `atticDustPatches(...)` through `CutawayRotStains` with `color={HOME_PALETTE.atticDust}`, the deck stains' soft lobed look;
    - sits under `systemPartTag('ceiling')`;
    - while the attic is up close, passes `from = stepStarts(lit.system, lit.shown, peel).get('attic-insulation') ?? null`, so the openings in the bare strip show their gaps, not floating dirt;
    - draws only while nothing is up close or the attic is. In the roof's Look inside in Rain the ceiling is lit and the blanket ghosts, so dust tagged as the ceiling would float there.
  - **Mounting:** `AtticFloor` mounts it only when `dusty` (home-kit: `partState(parts, 'air-sealing')` condition `absent`), for the material the blanket is drawn in (the laid one), with the `ducted` flag the openings already use.
  - **Constants:** `ATTIC_DUST = { size, lift, alpha }` and the colour are working numbers.
- [ ] **Step 4: Verify.**
  - The verify script, tsc and eslint pass, and the savings are unchanged.
  - **Shots** (1194×834, dark and light), the attic's Look inside:
    - existing, unsealed: dirty patches on the blanket over the openings it covers, and the bare strip's openings clean;
    - existing, Ceiling pick: the dust stays lit while the blanket fades;
    - build with air sealing: no dust.
- [ ] **Step 5: Commit:** `feat(trade-scenes): an unsealed attic shows dust on the blanket over every gap it covers`.

### Task 3: The window comes apart (spec §12.2 Windows, §12.3, §12.9 camera, §12.10)

**Files:**
- Create: `F/lib/window-spread.ts`; `F/lib/window-flashing-boxes.ts`; `F/ui/components/home-kit/framed-window-frame.tsx`
- Delete: `F/lib/draws-its-parts.ts`. It answers `system in STEP_DEPTHS`, so once the windows leave `STEP_DEPTHS` their rows could no longer be picked; `LookInsideBody` always passes `onEmphasize` from this task on.
- Modify:
  - list and constants: `F/constants/system-parts.ts` (window order); `F/constants/look-inside.ts` (`STEP_DEPTHS` loses `windows`; `WINDOW_SPREAD`, `PULLED_APART_SYSTEM_IDS`, `WINDOW_LANE_ALONG`);
  - types and checks: `F/types.ts` (`SteppedSystemId`, `PeeledSystemId`); `F/lib/peels.ts`;
  - geometry and drawing: `F/lib/window-piece-boxes.ts`; `F/ui/components/home-kit/window-panes.tsx`; `window-seals.tsx`; `house-shell.tsx` (frame split);
  - lanes and pins: `F/lib/cutaway-face-heat-lanes.ts`; `F/lib/system-part-focus.ts`;
  - slider: `F/ui/components/panel/peel-control.tsx`; `F/ui/components/controls/look-inside-body.tsx`; `F/constants/home-scene-copy.ts`;
  - camera: `F/constants/system-camera-views.ts`; `F/ui/components/home-kit/home-camera-rig.tsx` (the lean).
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `windowSpread(shown: ReadonlySet<SystemPartId>, pull: number): ReadonlyMap<SystemPartId, Vec3>`: every shown, listed window part's offset along `LOOK_INSIDE_WINDOW.wall`'s outward normal. In list order it's index × `WINDOW_SPREAD.step` × clamp(pull, 0, 1), so the flashing is `[0,0,0]`. The unlisted `glazing` maps to `[0,0,0]` (spot pins focus it).
  - `windowPieceBoxes(frame, shown): { id: WindowPieceId, boxes: BoxSpec[] }[]`: the glazing pieces at rest, inside out, with no pull and no `to`.
  - `peels(system)` is true for `'roof'`, `'heating-cooling'` and `'windows'`.
  - `PeeledSystemId = Exclude<SteppedSystemId, fully open> | (typeof PULLED_APART_SYSTEM_IDS)[number]`.
  - `PeelControl({ system: PeeledSystemId })`.

- [ ] **Step 1: Write the failing tests.** They replace the window tests that assert cut-back strips (`stepCutBack(... STEP_DEPTHS.windows)`, `stripOf`, `to`) and every `drawsItsParts` assert (its walls ones become "a wall row can be picked", which Task 4 adds), keeping the fixtures `newWindow`, `oldDouble` and the single pane:

```ts
assert.deepEqual(listedRows(systemPartRows('windows', newWindow)).map(row => row.id), ['flashing', 'frame', 'seals', 'inner-pane', 'argon', 'low-e', 'outer-pane', 'screen'], 'the new window lists inside out, the screen last')
assert.deepEqual(listedRows(systemPartRows('windows', at({ property: sixtiesSingle }))).map(row => row.id), ['flashing', 'frame', 'seals', 'pane'], 'the single pane')
assert.deepEqual(listedRows(systemPartRows('windows', oldDouble)).map(row => row.id), ['flashing', 'frame', 'seals', 'inner-pane', 'air-gap', 'outer-pane'], 'the old double pane')
assert.deepEqual(PART_PIECES, { 'glazing': ['pane', 'inner-pane', 'argon', 'air-gap', 'low-e', 'outer-pane', 'screen'], 'frame': ['flashing', 'seals'], 'duct-runs': ['jacket', 'blanket', 'core'] }, 'each part\'s pieces in list order; the duct run\'s as before')
const out = (v: Vec3) => (LOOK_INSIDE_WINDOW.wall.run === 'z' ? v[0] : v[2]) * LOOK_INSIDE_WINDOW.wall.outward
const singleScene = at({ property: sixtiesSingle })
for (const [label, scene] of [['new', newWindow], ['single', singleScene], ['old double', oldDouble]] as const) {
  const shown = shownOf('windows', scene)
  const ids = listedRows(systemPartRows('windows', scene)).map(row => row.id)
  ids.forEach((id, index) => {
    near(out(windowSpread(shown, 1).get(id)!), index * WINDOW_SPREAD.step, 1e-12, `${label} ${id}: one step further out than the part inside it`)
    near(out(windowSpread(shown, 0).get(id)!), 0, 1e-12, `${label} ${id}: whole at rest`)
    assert.deepEqual(windowSpread(shown, 1.5).get(id), windowSpread(shown, 1).get(id), `${label} ${id}: the pull stops at 1`)
  })
}
assert.equal(out(windowSpread(shownOf('windows', singleScene), 1).get('pane')!), 3 * WINDOW_SPREAD.step, 'a single pane spreads less')
assert.deepEqual(windowSpread(shownOf('windows', newWindow), 1).get('glazing'), [0, 0, 0], 'the whole glass stays where the house draws it')
assert.equal(peels('windows'), true); assert.ok(!('windows' in STEP_DEPTHS), 'the window no longer steps')
assert.equal(PART_COPY.pull, 'Pull it apart'); assert.equal(PART_COPY.together, 'Put it back together')
```

The flashing hides behind the frame. Every box of the window's flashing (export `flashingBoxes(frame)` from `window-seals.tsx`'s logic into `F/lib/window-flashing-boxes.ts`):
- lies across the wall no further out than the frame's outer face: `out(position) + size/2 <= frame.depth / 2`;
- in the opening's plane, overlaps only the frame's bars, never the glass between them.

Message: `'whole, the frame hides the flashing'`.

**Lanes:** for the new window at pull 0, 0.5 and 1:
- the glazing crossings' outer points are each the resting face plus the piece's spread;
- their outward distances strictly fall from the yard inward;
- every crossing shares one `along` (`WINDOW_LANE_ALONG`);
- the summer bounce starts at the Low-E's outer face plus its spread;
- the single pane has no bounce;
- lane counts equal those before this task (the existing `heatLaneFlows` comparison).

**Pins:** `systemPartFocus('windows', form, id, pull, shown, NO_RUN)` equals the resting point plus `windowSpread(shown, pull).get(id)` for every listed id, including `frame` and `flashing`.

- [ ] **Step 2: Run, and see it fail.**
- [ ] **Step 3: Implement.**
  - **Window order:** `flashing, frame, seals, pane, inner-pane, argon, air-gap, low-e, outer-pane, screen, glazing` (`glazing` keeps `listed: false`).
  - **Constants** (working numbers):
    - `WINDOW_SPREAD = { step: 0.08 }`;
    - `PULLED_APART_SYSTEM_IDS = ['windows'] as const`;
    - `WINDOW_LANE_ALONG`: one point along the opening in the glass, clear of the frame's bars and any mullion.
  - **`STEP_DEPTHS`:**
    - drops `windows`;
    - its `satisfies` becomes `Record<'roof' | 'attic' | 'heating-cooling', number>`;
    - never put a key back to quiet tsc.
  - **`peels`:** `PULLED_APART_SYSTEM_IDS.includes(system) || (system in STEP_DEPTHS && !FULLY_OPEN_SYSTEMS.has(system))`.
  - **`house-shell.tsx`:**
    - while the window is up close, `frames`, `outside` and `inside` all leave out the framed window's frame (as `unframedGlass` leaves out its glass). A new vinyl window with a white inside draws from `outside`/`inside`, not `frames` (`frameLook`, `window-frame-look.ts`);
    - `FramedWindowFrame({ frame, frameLook, lit })` draws those boxes, sill ledge included, one merge or two when two-tone, in `<group position={spread.get('frame')}>` under the existing `frame` tag;
    - it reads the pull with `useStepPeel(lit)`.
  - **Panes and seals:**
    - `WindowPanes` and `WindowSeals` draw their resting boxes once (memo on `frame` and `shown`, never on the pull);
    - each piece sits in a group positioned at its spread;
    - the flashing never moves;
    - the flashing boxes come from `flashingBoxes(frame)`: a band lining the opening just behind the frame's outer face, under its bars.
  - **Lanes:** `windowLegs(parts, shown, pull)` crosses each glazing piece at its spread position, at `WINDOW_LANE_ALONG`, outermost first, keeping the "never turn back toward the yard" pass.
  - **Pins:**
    - window ids take the resting point plus their spread;
    - remove the windows branch from `pieceFocus`, whose duct-run branch is unchanged;
    - remove every reference to `STEP_DEPTHS.windows`.
  - **Slider:**
    - `PeelControl` takes `system`;
    - the windows' label is `PART_COPY.pull` and its close button `PART_COPY.together`;
    - the roof and HVAC keep `peel`/`close`;
    - the open button stays `PART_COPY.open` everywhere (§12.10).
  - **Camera:**
    - `SYSTEM_CAMERA_VIEWS.windows` is reframed so that, at pull 1 on a new window, the flashing and the screen are both in view at 1194×834 and 390×844;
    - it never moves with the pull. The rig leans toward a picked part's point at the pull (`home-camera-rig.tsx`, `systemPartFocus(..., peel, ...)`), so for a pulled-apart system it leans to the resting point (pull 0) instead. Test: `systemPartFocus('windows', form, 'low-e', 0, shown, NO_RUN)` is what the rig's lean reads at every pull (export the rig's point choice as a pure `leanPoint` beside it if needed to test).
- [ ] **Step 4: Verify.**
  - The verify script, tsc and eslint pass, and the savings are unchanged.
  - **Shots** (1194×834 dark and light, plus 390×844 dark):
    - the new window at pull 0, with no flashing showing over the vinyl frame (the owner's bug);
    - pull 1, with eight parts apart, flashing at the wall and screen furthest out;
    - pull 1 with Low-E picked: only the film is lit, and its pin rides with it;
    - pull 1, Thermal, summer: the lanes pass through the gaps and bounce off the Low-E;
    - the single pane at pull 1.
  - **One leave-mid-pull shot sequence** (Review Focus 3).
  - **Frame cost** of the window at pull 1: record it as the window baseline; at most one draw call more than the whole home's count for the frame split, two with a two-tone frame.
  - **One more shot:** a build with the black-outside, white-inside frame at pull 1, so the whole frame moves out and none is left in the wall.
- [ ] **Step 5: Commit:** `feat(trade-scenes): the window pulls apart along the wall's normal instead of peeling, and its flashing sits behind the frame`.

### Task 4: The wall's three parts, each one pickable (spec §12.5, §12.10)

**Files:**
- Modify:
  - list and copy: `F/constants/system-parts.ts` (walls); `F/constants/home-scene-copy.ts` (labels); `F/ui/components/controls/look-inside-body.tsx`;
  - house drawing: `F/ui/components/home-kit/house-shell.tsx`; `home-kit.tsx` (`patchedCracks`, the garage's ghost root);
  - roof trim: `roof-slope.tsx` and `low-slope-roof.tsx` (the trim's tag);
  - the garage: `F/ui/components/home-kit/garage.tsx` (tags);
  - lighting over the front: `F/types.ts` (`SystemPartTagData.overFront`); `F/lib/system-part-tag.ts`; `F/lib/system-part-opacity.ts`;
  - looks: `F/constants/wear-looks.ts` (`WEAR_LOOKS.paint.patch`).
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - system part ids `'stucco'` (on `finish`, `drawnFor` stucco-finish) and `'eaves-trim'` (on `paint`); `siding` is kept;
  - the tag `systemPartTag('eaves-trim')` on every piece of the house's trim (`CONTEXT.md` Body / trim, owner 2026-11-06):
    - every fascia and rake slab and its marks;
    - the low-slope coping and front fascia;
    - the front door's frame and its peeling;
    - the garage's trim and fascia.
    - Tasks 5 and 6 draw inside these groups.
  - `systemPartTag(id, { overFront: true })` returns a frozen `{ scenePart, overFront: true }`. `systemPartOpacity` lets such a piece take its lit opacity even under `HOME_FADE_TAGS.complete` (owner, 2026-11-06: the door frame lights with Eaves & trim although the front face ghosts). Only the door frame's group uses it.
  - `HouseShell` prop `patchedCracks: PaintWearLevel`.

- [ ] **Step 1: Write the failing tests.** They replace the walls block's order and coat asserts (Task 3 already replaced its `drawsItsParts` asserts):

```ts
assert.deepEqual(listedRows(systemPartRows('walls', stuccoHome)).map(row => row.id), ['stucco', 'eaves-trim', 'paint'], 'the wall lists its stucco, its eaves and trim, its paint')
assert.deepEqual(listedRows(systemPartRows('walls', sidingHome)).map(row => row.id), ['siding', 'eaves-trim', 'paint'], 'a siding home lists its siding first')
assert.deepEqual(systemPartRows('walls', stuccoHome).map(row => row.label), ['Stucco', 'Eaves & trim', paintLabel], 'each reads its own name')
assert.deepEqual(listedRows(systemPartRows('walls', unpaintedHome)).map(row => row.id), ['stucco'], 'an unpainted wall lists only its stucco')
assert.equal(systemLit('walls', systemPartRows('walls', stuccoHome), 'eaves-trim').emphasized, 'eaves-trim', 'a wall row can be picked')
assert.equal(systemPartRows('walls', repaintedScene).find(row => row.id === 'eaves-trim')!.condition, 'installed', 'the trim is repainted with the wall')
const walled = systemLit('walls', systemPartRows('walls', stuccoHome), 'eaves-trim')
assert.equal(systemPartOpacity(systemPartTag('eaves-trim', { overFront: true }), true, walled, LOOK_INSIDE.ghostOpacity), 1, 'the door frame lights over the faded front')
assert.equal(systemPartOpacity(systemPartTag('eaves-trim'), true, walled, LOOK_INSIDE.ghostOpacity), LOOK_INSIDE.ghostOpacity, 'any other piece only the Complete house draws still ghosts')
```

Keep "no pin up close" for each of the three ids. Keep the walls' lanes tests and the parts list's invariants (`verify-trade-scene.ts:3212-3224`) unchanged: they stay true because the wall's construction parts keep their entries, unlisted.

- [ ] **Step 2: Run, and see it fail.**
- [ ] **Step 3: Implement.**
  - **The walls' entries:**
    - the listed rows are `stucco`, `siding`, `eaves-trim`, `paint`;
    - `finish`, `brown-coat`, `scratch-coat`, `lath`, `weather-barrier`, `sheathing`, `cavity-insulation`, `studs` and `drywall` stay as whole entries with `listed: false`, as `glazing` is. The invariant "every construction part is exactly one whole system part" holds, the wall's lanes still see them, and the card never lists them;
    - `stucco` is a new piece on `finish` and takes `finish`'s `drawnFor` (`part.material === 'stucco-finish'`); `siding` is already such a piece and stays as it is.
  - **Labels:** `'stucco': 'Stucco'`, `'eaves-trim': 'Eaves & trim'`. The nine unlisted ids keep their labels, since lanes and readings may name them.
  - **`HouseShell`** (with `emphasized = lit?.system === 'walls' ? lit.emphasized : null` and `finishRow` = the shown `stucco` or `siding` id):
    - **the wall's skin:** while `emphasized === finishRow`, its colour is `WEAR_LOOKS.paint.peeling.bareStucco` and its group's tag is `finishRow`; otherwise the paint's colour and the `paint` tag, as now;
    - **the marks:** cracks, sill dirt, peeling and stains (sides and front) sit in a group tagged `finishRow`;
    - **the front door's frame** and its peeling marks (split out of `marks.front`) sit under `eaves-trim`;
    - **patched cracks:** while `emphasized === finishRow` and `patchedCracks !== 'none'`, `stuccoCracks` draws at `PAINT_WEAR_SHARE[patchedCracks]` with the same seeds, as patches: each box widened to `WEAR_LOOKS.paint.patch.width`, in `WEAR_LOOKS.paint.patch.color` (working numbers).
  - **`home-kit.tsx`:**
    - pulls `const repainted = wallParts.find(part => part.id === 'paint')?.condition === 'installed'` out of the `paintHexes(...)` call (`home-kit.tsx:248`) once; Task 6 reads it too;
    - passes `patchedCracks = repainted ? paintWearInForce(...).cracks : 'none'`.
  - **Roof trim:** in `roof-slope.tsx`, the fascia slab with its `TintedMarks` and each rake slab, and in `low-slope-roof.tsx` the front fascia and the coping (`COPING`, `COMPLETE_COPING`), sit under `systemPartTag('eaves-trim')`. The roof's Look inside still ghosts them, since `eaves-trim` is not a roof part.
  - **The door frame:** its group (the frame boxes and its peeling marks) takes `systemPartTag('eaves-trim', { overFront: true })`. `systemPartOpacity(tag, completeOnly, lit, ghost)` skips the `completeOnly` ghost when `tag.overFront` is set; the Complete fade level still applies on top, as it does to every piece.
  - **The garage:**
    - it's drawn outside every ghost root (`garage.tsx`'s comment), and stays so in every other view;
    - while the walls are up close, home-kit runs `applyGhost` on a ref wrapping `<Garage>`, as it does for `groundLevel`;
    - inside, `boxes.trim` and `boxes.fascia` sit under `systemPartTag('eaves-trim')`, `boxes.body` and the gable end under `systemPartTag('paint')`, and the door, its mouldings and the roof take the ghost.
    - Leaving the walls eases the garage back to solid with the ghost. Update the garage's comment to say why it joins only then.
- [ ] **Step 4: Verify.**
  - The verify script, tsc and eslint pass, and the savings are unchanged.
  - **Shots** (1194×834 dark and light, plus 390×844 dark), the walls' Look inside:
    - existing, no pick;
    - Stucco pick: bare base coat, marks lit, the rest dimmed;
    - Eaves & trim pick: the fascia, rakes, door frame and garage trim lit, the garage's body and door dimmed;
    - a flat roof's Eaves & trim pick: the coping and front fascia lit;
    - the roof's Look inside, with the garage solid as before;
    - Paint pick;
    - build with Cool Life, Stucco pick: patched cracks.
- [ ] **Step 5: Commit:** `feat(trade-scenes): the wall lists stucco, eaves and trim, and paint, and each one lights on its own`.

### Task 5: Fascia rot, set by the rep (spec §12.6)

**Files:**
- Create: `F/lib/fascia-rot-spots.ts`
- Modify:
  - core: `CORE/constants/enums.ts` (`paintWearKinds`);
  - constants: `F/constants/paint-wear.ts` (`PAINT_WEAR_START`, `FASCIA_ROT`); `F/constants/wear-looks.ts` (rot colour); `F/constants/home-scene-copy.ts` (`PAINT_WEAR_LABELS`, `EAVES_TRIM_DETAILS`);
  - looks and drawing: `F/ui/lib/paint-look.ts`; `F/ui/components/home-kit/roof-slope.tsx`; `low-slope-roof.tsx`; `garage.tsx`; `house-roof.tsx` (pass the runs, if needed);
  - card: `look-inside-body.tsx`;
  - the panel: `F/ui/components/panel/paint-wear-fields.tsx` iterates `paintWearKinds` and needs no edit; list it so the claim covers it.
- Create also: `F/lib/eaves-trim-detail.ts`.
- Test: `scripts/verify-trade-scene-layout.ts`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces:
  - `PaintWearKind` gains `'fascia-rot'`;
  - `fasciaRotSpots(level: PaintWearLevel, runs: readonly FasciaRun[]): FasciaRotSpot[]`, with `FasciaRun = { face: 'front' | 'back' | 'garage', from: number, to: number }` and `FasciaRotSpot = { face, along: readonly [number, number], bottom: boolean }` (new types at the end of the `F/types.ts` end block). Each face measures `along` in its own fascia's frame, the way `fasciaPeeling` does (`F/lib/paint-peeling.ts`);
  - `eavesTrimDetail(rot: PaintWearLevel, replaced: boolean): string`.

- [ ] **Step 1: Write the failing tests.**
  - **Layout verify:**
    - the `none` literal and the `fair` expectation gain `'fascia-rot': 'none'`;
    - add `for (const wear of wears) assert.equal(PAINT_WEAR_START[wear]['fascia-rot'], 'none', \`${wear} paint starts with no fascia rot\`)`;
    - `assert.equal(paintWearInForce(paint({ property: sixties, materials: fair, year: YEAR }), { stains: 'heavy' })['fascia-rot'], 'none', 'a home saved before fascia rot reads None')`;
    - `assert.equal(paintWearInForce(…worn…, { 'fascia-rot': 'moderate' })['fascia-rot'], 'moderate')`.
  - **Scene verify:**
    - the existing check at `verify-trade-scene.ts:1787` ("new or installed paint shows no paint wear, whatever was recorded") becomes: given `{ cracks: 'heavy', stains: 'heavy', peeling: 'heavy', 'fascia-rot': 'none' }` at wear 0, `paintWear` deep-equals `PAINT_WEAR_START.new`. Without the fourth key its literal fails tsc;
    - `paintLook({ material: 'standard', wear: 0 }, { ...PAINT_WEAR_START.worn, 'fascia-rot': 'heavy' }, hexes).paintWear['fascia-rot'] === 'heavy'` (`'a repaint leaves the rot'`), with every other kind `'none'`. `paintLook` keeps its three arguments `(paint, paintWear, hexes)`;
    - for a two-eave run set, `fasciaRotSpots('none', runs)` is `[]`;
    - light gives one end spot; moderate gives 2 when the set has fewer than 6 ends, 3 otherwise; heavy gives `Math.ceil(0.75 * ends)` end spots plus one `bottom` spot on each board with a rotted end;
    - every spot lies inside its run;
    - the same call gives the same spots;
    - splitting a run in two parts and filtering by each part's range gives the same spots: `'the rot stays put whichever part draws it'`;
    - `eavesTrimDetail('none', false) === ''`;
    - `eavesTrimDetail('light', false) === EAVES_TRIM_DETAILS.rot`.
- [ ] **Step 2: Run both scripts, and see them fail.**
- [ ] **Step 3: Implement.**
  - **The kind:**
    - `paintWearKinds = ['cracks', 'stains', 'peeling', 'fascia-rot']`;
    - every `PAINT_WEAR_START` row gains `'fascia-rot': 'none'`;
    - `PAINT_WEAR_LABELS['fascia-rot'] = 'Fascia rot'`;
    - the panel's `PaintWearFields` picks it up unchanged.
  - **`paintLook`:** `paintWear: paint.wear === 0 ? { ...PAINT_WEAR_START.new, 'fascia-rot': paintWear['fascia-rot'] } : paintWear`. Update its comment: a repaint clears the paint's own wear, never the rot under it.
  - **New paint:** `PaintWearFields` hides on New paint and `paintWearInForce` reads every kind as None there (`paint-wear-in-force.ts:10`). That stays: a home rated New shows no fascia rot (Claude's call, spec §12.10).
  - **The board ends:**
    - each run's two ends, plus a joint every `FASCIA_ROT.boardLength` from `from`;
    - the chosen ends come from a Fisher–Yates shuffle inside `fasciaRotSpots`, driven by `seededRandom(FASCIA_ROT.seed)` (`F/lib/seeded-random.ts`), over the whole home's set;
    - the runs are each eave's full fascia run on a gable, the front fascia on a flat roof, and the garage's eave fascia on a gable (owner, 2026-11-06: rot reaches the garage too). A flat garage has no fascia, and the coping never rots.
  - **Drawing:**
    - each `RoofSlope` part, the flat roof's front fascia and the garage's fascia draw the spots on their face that fall within their own range;
    - the end spots are `FASCIA_ROT.endWidth` wide and run up from the bottom edge, and the bottom spots are `FASCIA_ROT.bottomHeight` tall;
    - they use the deck stains' soft lobed texture in `WEAR_LOOKS.fascia.rot`, on the fascia's outer face, inside the `eaves-trim` group from Task 4;
    - every figure is a working number.
  - **The card:** `EAVES_TRIM_DETAILS = { rot: 'Rotted fascia ends. Water gets behind the paint and softens the wood.', replaced: 'Rotted fascia cut out and replaced with new boards.' }`. `LookInsideBody` sets the `eaves-trim` row's detail to `eavesTrimDetail(rotInForce, false)`.
- [ ] **Step 4: Verify.**
  - Both verify scripts, tsc and eslint pass, and the savings are unchanged.
  - **Shots** (1194×834 dark): the whole home and the walls' Eaves & trim pick, at light and at heavy fascia rot (the rot at board ends, the garage's included, the bottom edge at heavy), plus the panel with the Fascia rot row.
- [ ] **Step 5: Commit:** `feat(trade-scenes): fascia rot is a fourth paint damage, set by the rep, drawn at the board ends`.

### Task 6: Fascia replacement from a Walls switch (spec §12.6 owner answer, §12.9)

**Files:**
- Create: `CORE/constants/fascia-replacement.ts`; `F/lib/keep-fascia-replacement.ts`; `F/lib/fascia-replaced-boxes.ts`; `F/ui/lib/fascia-boards-color.ts`
- Modify:
  - core: `CORE/constants/scope-not-drawn.ts`;
  - checks: `scripts/verify-scope-installs.ts`;
  - types and resolving: `F/types.ts` (`SceneTargets.fasciaReplaced`, the `SceneChange` kind, `SceneChangeSlotId`); `F/lib/resolve-scene.ts`; `F/lib/apply-scene-change.ts`;
  - the switch: `F/lib/scene-change-slots.ts`; `F/constants/scene-change-words.ts`; `F/ui/components/controls/system-card-body.tsx`; `F/constants/home-scene-copy.ts`;
  - drawing: `home-kit.tsx`; `roof-slope.tsx`; `low-slope-roof.tsx`; `garage.tsx`; `F/constants/home-palette.ts` (`primer`);
  - card: `look-inside-body.tsx`.
- Test: `scripts/verify-trade-scene.ts`, `scripts/verify-scope-installs.ts` (a read-only catalog read; Global Constraints, Checks)

**Interfaces:**
- Consumes: `fasciaRotSpots` and `eavesTrimDetail` (Task 5); the `eaves-trim` groups and home-kit's `repainted` (Task 4).
- Produces:
  - `FASCIA_REPLACEMENT_SCOPE_ID = '8860ca1b-548b-83c5-adb1-01edfc5be0fc'`;
  - `SceneTargets.fasciaReplaced: boolean`;
  - `SceneChange { kind: 'fascia-replacement', on: boolean }`;
  - the slot id `'replace:fascia'`, in `SceneChangeSlotId` and `SCENE_CHANGE_WORDS`;
  - `keepFasciaReplacement(state: TradeSceneInputs, year: number): string[]`, the build's scope ids without the fascia id while the rot in force is None;
  - `fasciaBoardsColor(fasciaReplaced: boolean, repainted: boolean, trim: string): string | null`, in `F/ui/lib/fascia-boards-color.ts`: `null` without the replacement, else `repainted ? trim : HOME_PALETTE.primer`. `trim` is the picked trim colour, `hexes.trim`. `paintLook` keeps its three arguments;
  - `fasciaReplacedBoxes(spots: readonly FasciaRotSpot[], runs: readonly FasciaRun[], color: string): [seams: TintedBoxes, boards: TintedBoxes]`, in `F/lib/fascia-replaced-boxes.ts`, in the fascia's own frame. It's the same seam-under-a-new-piece shape as `woodReplacedBoxes`, whose flat, slope-tilted boxes don't fit an upright board; it reuses `HOME_PALETTE.woodSeam`.

- [ ] **Step 1: Write the failing tests.**
  - **The scope:**
    - `NOT_DRAWN[FASCIA_REPLACEMENT_SCOPE_ID] === undefined`;
    - `SCOPE_INSTALLS[FASCIA_REPLACEMENT_SCOPE_ID] === undefined` (`'the fascia repair moves no part and no figure'`).
  - **Resolving:**
    - `resolveScene` with the scope in `proposedScopeIds`, view proposed, gives `fasciaReplaced === true`;
    - view existing gives `false`;
    - `sceneSavings` with and without the scope are deep-equal (`'the repair saves nothing'`);
    - `upgradeRows(...)` with and without it are deep-equal (no new row).
  - **The slot:**
    - with fascia rot `light` in force, `sceneChangeSlots(...)` has `'replace:fascia'` in group `'proposed'`, with the on/off options, `current` `'off'` and `unavailable` null;
    - with the rot at None, it has no options, `current` null, and `unavailable === PANEL_COPY.fasciaReplacementHint` (`'Set fascia rot to offer this.'`);
    - `applySceneChange(state, slot.change('on'), YEAR).proposedScopeIds` includes the id, and `slot.change('off')` removes it.
  - **The pick follows its rot** (Review Focus 2):
    - after `{ kind: 'fact', patch: { paintWear: { ...recorded, 'fascia-rot': 'none' } } }` it's gone (`'the replacement goes with its rot'`);
    - after `{ kind: 'era-guess', id: 'exterior-paint' }` (which clears the recorded levels) it's gone;
    - after the paint is rated New it's gone;
    - after a paint option change (regular to Cool Life on the Today side) it stays, since the recorded rot stays (`'a paint option change keeps the replacement'`);
    - after the build's paint pick is removed it stays, and `fasciaBoardsColor(true, false, trim)` gives the primer.
  - **`fasciaBoardsColor`:**
    - `(true, false, '#474848') === HOME_PALETTE.primer`;
    - `(true, true, '#474848') === '#474848'` (`'the new boards take the picked trim'`);
    - `(false, true, '#474848') === null`.
  - **`fasciaReplacedBoxes(spots, runs, color)`** gives, for each end spot, one new length of `FASCIA_ROT.newLength` (clamped to its run), full fascia height, and one seam box; no box for a bottom spot. The lengths cover each board's bottom rot. A garage spot gets its boards on the garage's face.
  - **The card:** `eavesTrimDetail('moderate', true) === EAVES_TRIM_DETAILS.replaced`.
  - **Nothing on the proposal side:** `SCOPE_INSTALLS` has no entry for the id (above), and `upgradeRows` is deep-equal with and without it. The proposal's Scope chapter is built from the proposal's own scope rows, never from the scene's picks.
  - **verify-scope-installs:** counts the id as accounted for, and checks it's a live scope.
- [ ] **Step 2: Run, and see it fail.**
- [ ] **Step 3: Implement.**
  - **Core:**
    - the constant's comment says why it lives apart: the scope installs no construction part, so `SCOPE_INSTALLS` (Upgrades rows, savings) must never hold it;
    - remove its `NOT_DRAWN` line;
    - `verify-scope-installs.ts` treats it as a third accounted-for bucket.
  - **Resolving:** `resolveScene` sets `fasciaReplaced = view === 'proposed' && proposedScopeIds.includes(FASCIA_REPLACEMENT_SCOPE_ID)`.
  - **The change:**
    - `changePatch` handles `'fascia-replacement'` by adding the id to, or filtering it out of, `proposedScopeIds`;
    - `applySceneChange` runs `keepFasciaReplacement({ ...next, ...keepPickOptions(next, year) }, year)` after every change. It drops the id while `paintWearInForce(resolveHomeMaterials(facts)['exterior-paint'], next.homeMaterials.paintWear)['fascia-rot'] === 'none'`;
    - `applySceneChange` always writes `proposedScopeIds: unchangedAsBefore(state.proposedScopeIds, kept)`, not only when the patch carries `proposedScopeIds`. A `fact` change that sets the rot to None patches no scope ids, yet has to drop the pick;
    - a change that leaves the ids alone still returns the state's own array, so draw-only changes don't re-resolve.
  - **The switch, built like batts** (owner, 2026-11-06: same as the other switches, so Modify lists it too):
    - `SceneChangeSlotId` gains `'replace:fascia'`, and `SCENE_CHANGE_WORDS['replace:fascia']` gets its search words (`'fascia rot replace boards trim'`);
    - `sceneChangeSlots` emits `slot({ id: 'replace:fascia', group: 'proposed', name: CONTROLS_COPY.systems.fasciaReplacement, options: rot ? toggleOptions : [], current: rot ? (on ? 'on' : 'off') : null, unavailable: rot ? null : PANEL_COPY.fasciaReplacementHint, change: value => ({ kind: 'fascia-replacement', on: value === 'on' }) })`, where `rot` = rot in force is not None;
    - `SystemCardBody`, for `system === 'walls'`, renders it once from `slotOf('replace:fascia')` as `<ProposedChip key="replace:fascia" id="replace:fascia" kind="toggle" ... />`, only while its `unavailable` is null. It goes in the chip list straight after the `build:paint` chip, inside `proposed` and before `panels`, so the paint's colour panel keeps its own last line. It follows the `batts()` closure's shape and must not repeat per row;
    - `CONTROLS_COPY.systems.fasciaReplacement = 'Replace rotted fascia'`; `PANEL_COPY.fasciaReplacementHint = 'Set fascia rot to offer this.'`.
  - **Drawing:**
    - `home-kit.tsx` works out `const fasciaBoards = fasciaBoardsColor(targets.fasciaReplaced, repainted, paint.trim)` once and passes it to the roof parts and the garage;
    - wherever `fasciaBoards !== null`, `roof-slope.tsx`, `low-slope-roof.tsx` and `garage.tsx` draw `fasciaReplacedBoxes` in that colour under `eaves-trim`, and skip the rot spots the new lengths cover;
    - `HOME_PALETTE.primer`, and `FASCIA_ROT.newLength` and `FASCIA_ROT.seam` (added here), are working numbers.
  - **The card:** `LookInsideBody` passes `targets.fasciaReplaced` to `eavesTrimDetail`.
- [ ] **Step 4: Verify.**
  - The scene script prints ok;
  - `pnpm tsx scripts/verify-scope-installs.ts` passes (a read-only catalog read);
  - tsc and eslint pass, and the savings JSON diffs clean.
  - **Shots** (1194×834 dark, plus 390×844 dark for the card):
    - the Walls card's Build row with the switch beside the paint chip (rot set) and without it (rot None), with the paint's colour panel still on its own last line;
    - Modify's search for "fascia" finding the switch;
    - a build with Cool Life, a dark picked trim and the replacement: new lengths in that trim colour with their seams, on the house and the garage;
    - the replacement with no paint job: primed white;
    - the Eaves & trim row's line.
- [ ] **Step 5: Commit:** `feat(trade-scenes): Replace rotted fascia on the Walls card sets new board lengths where the rot was`.

### Task 7: The deck's sheets: fewer, larger, staggered, and the deck's own (spec §12.7, §12.10)

**Files:**
- Create: `F/ui/components/home-kit/cutaway-rot-marks.tsx`; `F/lib/rot-mark-groups.ts`
- Modify: `F/constants/look-inside.ts` (`CUTAWAY_ROT.deck`); `F/lib/deck-rot-spots.ts`; `F/ui/components/home-kit/cutaway-flows.tsx` (drop the stains and sheets); `home-kit.tsx` (mount the marks inside the house group)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces: `CUTAWAY_ROT.deck.sheets: readonly { across: readonly [number, number], up: readonly [number, number] }[]`. `across` is a fraction of the deck's strip, and may pass 1 to run under the next step; `up` is a fraction of the run. `deckRotSpots` returns one spot per sheet, sized from it.

- [ ] **Step 1: Write the failing tests.** They replace the five-spot and `share` checks:
  - there are 3 sheets;
  - each sheet's length up the slope is 0.8–1.2 m on the gable run;
  - no two share a width, a length or a start, compared with a 1 cm tolerance on the gable run, not exact equality (`'the sheets are staggered, none the same'`);
  - at least one has `across[1] > 1` and one has `across[1] - across[0] < 0.8`;
  - the old deck's stains and the build's sheets sit in the same 3 places;
  - the build with an installed deck has none (kept);
  - the marks belong to their parts: export the grouping `CutawayRotMarks` draws as a pure `rotMarkGroups(spots): { partId: SystemPartId, spots: CutawayRotSpot[] }[]` (`F/lib/rot-mark-groups.ts`), and assert that every deck stain and every new sheet lands in the `deck` group, and that `systemPartOpacity(systemPartTag('deck'), false, systemLit('roof', rows, 'rafters'), ghost) === LOOK_INSIDE.dimmedOpacity` (`'a Rafters pick fades the sheets with the deck'`).
- [ ] **Step 2: Run, and see it fail.**
- [ ] **Step 3: Implement.**
  - **The sheets** (working numbers): `CUTAWAY_ROT.deck.sheets = [{ across: [0.06, 0.72], up: [0.2, 0.39] }, { across: [0.28, 1.3], up: [0.45, 0.68] }, { across: [0.12, 0.9], up: [0.74, 0.9] }]`. The heights are 0.19, 0.23 and 0.16 of the run, so no two match. Drop `spots`, `size` and `share`.
  - **`CutawayRotMarks`:**
    - mounted inside the house group (so the ghost and the picks reach it) while the roof is up close;
    - takes the same inputs `CutawayFlows` used;
    - draws the deck's own stains and its `woodReplacedBoxes` under `systemPartTag('deck')`;
    - draws the rain's soak stains (`cutawayRotSpots`), each under its own `partId`'s tag;
    - the marks keep hiding under Thermal.
  - **`CutawayFlows`** keeps the rain ribbon, the drip, the lanes and the readings only.
- [ ] **Step 4: Verify.**
  - The verify script, tsc and eslint pass, and the savings are unchanged.
  - **Shots** (1194×834 dark):
    - the existing roof at peel 1, with 3 stains;
    - the tear-off build, with 3 staggered sheets;
    - the same with Rafters picked, the sheets fading with the deck (the owner's bug);
    - Deck picked, the sheets lit.
  - The roof's frame cost at peel 1 is within one draw call of the baseline.
- [ ] **Step 5: Commit:** `fix(trade-scenes): the deck's wood replacement is three staggered sheets that light and fade with the deck`.

### Task 8: The old felt is brittle (spec §12.7)

**Files:**
- Create: `F/lib/felt-wear-marks.ts`
- Modify: `F/constants/home-palette.ts` (`feltAged`); `F/constants/wear-looks.ts` (`FELT_WEAR`); `F/ui/components/home-kit/roof-slope.tsx`; `low-slope-roof.tsx`; `cutaway-rot-marks.tsx` (the rain's hole)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces: `feltWearMarks(area: { up: readonly [number, number], along: readonly [number, number] }, seed: number): { kind: 'crack' | 'tear' | 'hole', up: readonly [number, number], along: readonly [number, number] }[]`. These are flat rectangles in the underlayment's own plane, which each roof maps onto its underlayment's top.

- [ ] **Step 1: Write the failing tests:**
  - the marks are deterministic (drawn from `seededRandom(seed)`, `F/lib/seeded-random.ts`) and lie inside the area;
  - there are tears along every lap line (every `FELT_WEAR.course` up the slope);
  - there are `FELT_WEAR.holes` holes;
  - there are cracks.
  - **In Rain, on a felt home, up close on the roof:**
    - one hole patch is centred on `cutawayCrossings(form, parts, steps, 'rain').find(c => c.partId === 'underlayment')!.tread`;
    - there's none on synthetic, or in any other weather.
- [ ] **Step 2: Run, and see it fail.**
- [ ] **Step 3: Implement.**
  - **The look:** a felt underlayment whose condition is not `installed` draws in `HOME_PALETTE.feltAged` (grey-brown), with its marks:
    - cracks: thin and dark;
    - tears: ragged strips at the laps, lighter;
    - holes: in the deck's own colour.
  - **Where:**
    - the marks sit just over the underlayment's top, clipped to its step's start;
    - the gable slope draws them in its frame, the flat roof on its underlayment boxes;
    - the rain's hole is drawn by `CutawayRotMarks` under the `underlayment` tag;
    - every figure is a working number.
  - **What stays clean:**
    - synthetic underlayment;
    - the low-slope covering's patches, which keep `HOME_PALETTE.felt`.
- [ ] **Step 4: Verify.**
  - The verify script, tsc and eslint pass, and the savings are unchanged.
  - **Shots** (1194×834 dark and light):
    - the existing gable at peel 1: the felt reads cracked, torn and holed;
    - the same in Rain: the water goes through the hole;
    - the tear-off build: the synthetic is clean;
    - a flat roof with felt.
- [ ] **Step 5: Commit:** `feat(trade-scenes): the old felt reads dried out, cracked and torn, and the rain gets through its hole`.

### Task 9: By-eye pass and hand-over

- [ ] **Step 1:** Run the full checks once:
  - the three verify scripts, plus `verify-trade-scene-layout.ts` and `verify-scope-installs.ts`;
  - tsc;
  - eslint on every file the round touched;
  - the savings JSON diff;
  - the frame cost against the baselines.
- [ ] **Step 2:** Take one tight pass at 1194×834 dark and light and 390×844 dark: each Look inside, existing and build, with one pick each. Read every PNG and fix only what the spec names. Every working number is settled here or left with its comment.
- [ ] **Step 3:** Write the hand-over into the ledger:
  - the calls of §12.9 and §12.10 to check;
  - the glossary proposals, which are not applied:
    - "Look inside": the window separates, the wall picks its three parts. `CONTEXT.md:168` also still leaves the walls out of its list, though `LOOK_INSIDE_SYSTEM_IDS` has them;
    - "Fascia rot";
    - "Eaves & trim": the Walls row that lights every trim piece (Body / trim), the garage's included;
  - the tracker's §6 log line, to be added by the controller only when the owner asks.

  Then run `superpowers:finishing-a-development-branch`. Never push or merge.
