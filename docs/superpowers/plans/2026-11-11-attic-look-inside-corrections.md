# Attic Look Inside Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Attic Look inside tells the air sealing story on a ceiling that never disappears, shows dust where it really gathers, and opens at the left end, over the bay that holds a light can, a duct boot and a vent pipe, so most of the attic shows insulated.

**Architecture:** A new home fact (`airSealing`) feeds the roof-attic resolver, so Today can be sealed. The attic's separate `air-sealing` system part folds into its `ceiling` row, and the foam draws as part of the ceiling. The dust moves from the blanket onto the ceiling round each opening, and the blanket gains wear-scaled debris drawn through the existing `AtticSteps` split. Each stepped system gets its own cut line (`STEP_CUTS`, beside `STEP_DEPTHS`): the roof keeps `HOUSE.cutX`, the attic opens over its left-end bay, and the left vent pipe moves into that bay. The camera follows the strip.

**Tech Stack:** Next.js, React Three Fiber, three.js, TypeScript. Checks run in `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-layout.ts` and `scripts/verify-construction-model.ts` (plain `node:assert` scripts), plus `pnpm tsc` and ESLint.

**Spec:** The design Oliver approved in chat on 2026-11-11, with his stress-test rulings the same day, is copied under **Design** below. It is recorded as R297 in `docs/plans/2026-10-16-trade-scenes-epic.md` (Task 0).

## Design (approved 2026-11-11)

- **Today:** the attic card gets a second chip, "Not air sealed" (default) or "Air sealed", built like the Gutters chip on the Roof card. It shows on every home with an attic to seal (any roof but flat, including a roof not yet set, which the resolver reads as shingle). A home sealed today is no longer offered Air sealing in the build, and it takes the sealed heat figures the build already uses.
- **Ceiling:** the ceiling never disappears in attic Look inside. One row: "Ceiling leakage" unsealed, "Ceiling air sealed" sealed. The separate "Air sealing" row folds into it, and its pin points at an opening in the bare strip. Unsealed shows the leak arrows. Sealed shows foam round every opening and no arrows.
- **Dust round the openings:** on an unsealed home, dust sits on the ceiling round each light can, pipe and duct boot. Insulation covers it, so it shows only where the blanket is cut back. A sealed opening shows foam and no dust.
- **Debris on the insulation:** New is clean, Good has a light scatter, and it builds through Fair and Worn to heavy on Failing, sealed or not. On a top off, the new layer covers the old layer's debris.
- **Cutaway and camera:** the attic's opened strip moves from the kitchen wall to the left end, over the left room's joist bay (joists at −4.595 and −3.995), where its light can (−4.4, −2.2) and the end of its duct run (boot at −4.23, −0.5) already stand. **Owner ruling (stress test, 2026-11-11):** the left vent pipe (the bath stack, now at −3.15, −2.7) moves next to them, into the same joist bay or the one beside it, so the strip stays one step deep (0.8 m). The blanket runs solid from there to the right end. The camera stands at the left end and looks along the attic. Pins and heat arrows move with the strip. The exact cut line, pipe spot and angle are set by screenshot.
- **Unchanged:** roof Look inside still opens at the kitchen wall (`HOUSE.cutX`). Heating & cooling Look inside is untouched.
- **Order (owner, 2026-11-11):** this plan builds before `docs/superpowers/plans/2026-11-10-covering-wear-and-tile-reset.md`, which edits the same home facts line, chip files and verify script and must refresh its line references after.

## Global Constraints

- Only Oliver starts a dev server. Before any screenshot, check `ss -ltnp | grep :3002`. If nothing listens there, stop and ask Oliver to start it.
- Never sweep the scene in a software-rendered browser. Load one page and one case at a time (a multi-case sweep crashed the machine).
- Never run `pnpm build`. The checks are `pnpm tsc`, `CI=1 pnpm eslint scripts/verify-trade-scene.ts scripts/verify-trade-scene-layout.ts src/features/trade-scenes src/shared/modules/construction`, `pnpm tsx scripts/verify-trade-scene.ts` (prints `verify-trade-scene: ok`), `pnpm tsx scripts/verify-trade-scene-layout.ts` and `pnpm tsx scripts/verify-construction-model.ts`. "All checks" below means all five.
- The worktree is shared with other sessions (the gutters work committed `aa4c59e38` minutes before this plan was amended and may resume). Before every commit, run `git status --short -- src scripts`. It must list only your own files plus `src/features/trade-scenes/constants/home-palette.ts`, which holds another session's edit: never touch or stage it. If any file you are about to stage shows hunks you did not write (`git diff -- <file>`), stop and report; do not try to stage part of a file. Stage by explicit path only. Never `git stash`, `checkout` or `reset`.
- Find existing checks in the verify scripts by their assertion message or a named helper, not by line number. Line numbers below are as of `aa4c59e38` and shift as tasks insert code.
- Comments say why, never what. Never cite a plan, spec, task or requirement number in code.
- Copy (exact strings): `'Not air sealed'`, `'Air sealed'`, `'Ceiling leakage'`, `'Ceiling air sealed'`, `'Air sealing'` (chip name), `'Already air sealed'` (blocked build row).
- No DB writes for testing (none are needed here). No touched file is CRLF.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit after each task. Never push.
- The screenshot probe from the earlier session is gone. Task 2 Step 5 writes a new one in the session scratchpad, signing in through `/api/dev/playwright-session` (memory `reference-playwright-auth.md`); later tasks reuse it.

## Review Focus

1. **Today flipped to "Air sealed" while the build holds an Air sealing pick.** Expected: the pick drops out (`keepOffered`) and the attic's build row reads "Already air sealed". Test in Task 1.
2. **A roof not yet set, and a flat roof.** Expected: unset shows the chip and the "Ceiling leakage" row (the resolver reads it as shingle); flat shows no chip, no ceiling row in attic Look inside and no opening dust, and Today's `airSealing: 'sealed'` changes nothing. Tests in Tasks 1 to 3.
3. **A top off over Failing insulation.** Expected: no debris specks (the new layer is New), and none at the old layer's depth. Test in Task 4.
4. **Batts.** Expected: debris lies only on tops nothing covers, never inside the sheet laid over the joists. Test in Task 4.
5. **Roof Look inside with rain getting in.** Expected: its ceiling row still reads "Ceiling" (the attic's labels never leak into the roof), its steps still start at `HOUSE.cutX`, and the moved vent pipe still leaves through the back slope between two rafters. Tests in Tasks 3 and 5.

---

### Task 0: Record the requirement

**Files:**
- Modify: `docs/plans/2026-10-16-trade-scenes-epic.md` (§2 order table, register §3, change log §6)
- Modify: `CONTEXT.md` (Ceiling opening / System part lines, Foam collar line)

- [ ] **Step 1: Add R297 to the register, after R296.** Status `approved 2026-11-11; planned (docs/superpowers/plans/2026-11-11-attic-look-inside-corrections.md)`, source `owner, 2026-11-11 (brainstorm + stress test)`. The body is the **Design** section above, in the register's sentence style, including the pipe ruling. Quote the owner where you can: "air sealing doesn't replace the ceiling, it 'seals' the ceiling's openings", "Good should have mild dust/debris (amount grows with wear)" and "Move the plumbing pipe closer to the boot/can light (either same in-between joist space or one next to it)".
- [ ] **Step 2: Add a §2 order row:** attic Look inside corrections (R297) build before the covering wear and tile reset plan, which refreshes its line references after.
- [ ] **Step 3: Add a change-log row** dated 2026-11-11: attic Look inside brainstorm and stress test (R297), plus the item 1 fix already committed (`6260ccd71`, a stale frame-loop write cleared `held`, so the system's own parts took the ghost).
- [ ] **Step 4: CONTEXT.md.**
  - The line near 127 that says the attic lights the ceiling "for the gaps that leak air" becomes: the attic lights it wherever the attic can be sealed, leaking or sealed.
  - The Foam collar entry (near 199) names `KIT_PENETRATIONS.collar`, which no longer exists; it becomes `CEILING_OPENING_LOOK.collar`, and "seen only with no insulation over it" becomes "seen where the blanket is cut back".
- [ ] **Step 5: Do not commit.** The tracker and CONTEXT.md already carry other sessions' uncommitted edits. Tell Oliver both are edited and left unstaged.

### Task 1: Today can be air sealed

**Files:**
- Modify: `src/shared/modules/construction/core/constants/enums.ts` (after `gutterOptions`)
- Modify: `src/shared/modules/construction/core/types.ts` (`HomeMaterialFacts`, about 250-266)
- Modify: `src/shared/modules/construction/core/constants/home-materials.ts` (`HOME_MATERIAL_FACTS_UNSET`, about 74)
- Modify: `src/shared/modules/construction/core/lib/assemblies/roof-attic/infer-existing-conditions.ts` (the `'air-sealing'` entry, about 42; a new helper beside `gutterPart`)
- Modify: `src/features/trade-scenes/lib/scene-resolve-inputs.ts`
- Modify: `src/features/trade-scenes/lib/part-offers.ts` (`OfferBlockedReason`, `offeredScopes`)
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts` (`SCOPES_AND_ADDONS_COPY.blocked`)
- Test: `scripts/verify-trade-scene.ts` (beside the gutter checks: `gutterHome`, `gutterScene`, and the `gutterWearIsAnInput` resolver check)
- Test: `scripts/verify-trade-scene-layout.ts` (beside `gutterRowOf`)

**Interfaces:**
- Produces: `airSealingOptions = ['none', 'sealed'] as const`, `type AirSealingOption`, and `HomeMaterialFacts.airSealing: AirSealingOption | null` (null reads as none). `OfferBlockedReason` gains `'already-sealed'`.

- [ ] **Step 1: Write the failing checks.**

In `verify-trade-scene.ts`, beside the gutter checks (Today's savings are always zero, so compare parts and heat, not savings):

```ts
// Air sealing is a fact the rep sets: unset reads as not sealed; sealed today takes the sealed figures.
const sealedHome = (airSealing: HomeMaterialFacts['airSealing']) => ({ ...HOME_MATERIAL_FACTS_UNSET, airSealing })
const sealedScene = (airSealing: HomeMaterialFacts['airSealing'], patch: Partial<TradeSceneInputs> = {}) => at({ property: sixtiesSingle, homeMaterials: sealedHome(airSealing), ...patch })
const sealingOf = (scene: ReturnType<typeof at>) => scene.assemblies['roof-attic']!.parts.find(part => part.id === 'air-sealing')
assert.deepEqual(sealedScene(null).assemblies['roof-attic']!.parts, sealedScene('none').assemblies['roof-attic']!.parts, 'not set reads as not sealed')
assert.equal(sealingOf(sealedScene('none'))!.condition, 'absent')
assert.deepEqual([sealingOf(sealedScene('sealed'))!.material, sealingOf(sealedScene('sealed'))!.condition], ['sealed', 'retained'], 'sealed today is kept')
assert.ok(sealedScene('sealed', { weather: 'summer' }).heat!.readings.ceiling < sealedScene('none', { weather: 'summer' }).heat!.readings.ceiling, 'sealed today takes the sealed heat figures')
const flatSealed = at({ property: profile({ roofType: 'flat', hvacType: 'package-unit' }), homeMaterials: sealedHome('sealed') })
assert.equal(sealingOf(flatSealed), undefined, 'a flat roof has no attic to seal')
const airSealingIsAnInput: 'airSealing' extends keyof SceneResolveInputs['homeMaterials'] ? true : never = true
assert.ok(airSealingIsAnInput)
assert.ok(!shallowEqual(select({ airSealing: 'none' }), select({ airSealing: 'sealed' })), 'an air sealing change re-resolves the scene')
```

In `verify-trade-scene-layout.ts`, beside `gutterRowOf`:

```ts
const sealedToday = state({ property: sixties, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, airSealing: 'sealed' } })
const sealingRow = upgradeRows(facts(sealedToday), [], sealedToday.efficiencyUpgrades).flatMap(system => system.rows).find(row => row.offer.partId === 'air-sealing')!
assert.equal(sealingRow.blocked, 'already-sealed', 'a home sealed today is not offered air sealing')
assert.deepEqual(keepOffered([SCOPE_IDS.airSealing], facts(sealedToday), []), [], 'a home sealed today drops an air sealing pick')
```

Use the helper names each script already has (`weather` values, `select`, `state`, `facts`, `sixties`); keep the assertions.

- [ ] **Step 2: Run** `pnpm tsc`. Expected: FAIL on `airSealing` and `'already-sealed'`.
- [ ] **Step 3: Implement.**
  - Add the enum and type, the `HomeMaterialFacts` field, and `airSealing: null` in `HOME_MATERIAL_FACTS_UNSET`.
  - In the inference, add `airSealingPart(materials)` beside `gutterPart`, with a why-comment (the rep says whether the openings are sealed; unset reads as open, the common case), and use it for `'air-sealing'`: `sealed` → `{ material: 'sealed', condition: 'retained' }`, otherwise `{ material: null, condition: 'absent' }`.
  - Add `airSealing` to both functions in `scene-resolve-inputs.ts`, beside `gutterWear`. It is a resolver input, not a drawing-only fact.
  - In `offeredScopes`, after the `already-new` check, add `if (offer.partId === 'air-sealing' && homeHasPart) return { scopeIds: [], blocked: 'already-sealed' }`. Comment why: sealing never wears, so a home that has it is offered nothing on it.
  - Copy: `'already-sealed': 'Already air sealed'`.
- [ ] **Step 4: Run all checks.** Expected: clean, `verify-trade-scene: ok`.
- [ ] **Step 5: Commit** the seven files and both scripts: `feat(trade-scenes): Today can be air sealed; a sealed home takes the sealed figures and is not offered air sealing again`.

### Task 2: The attic card's air-sealing chip

**Files:**
- Modify: `src/features/trade-scenes/types.ts` (`SceneChangeSlotId` gains `'air-sealing'`, about 664-667; the `'fact'` `SceneChange` patch `Pick` gains `'airSealing'`, about 550)
- Modify: `src/features/trade-scenes/lib/scene-change-slots.ts` (`case 'attic-insulation'`, about 60-62)
- Modify: `src/features/trade-scenes/constants/scene-change-words.ts` (`SCENE_CHANGE_WORDS`, beside `'gutters'`)
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts` (`AIR_SEALING_LABELS` beside `GUTTER_LABELS`, `HOME_MATERIALS_COPY.airSealing`)
- Modify: `src/features/trade-scenes/ui/components/controls/existing-chip.tsx` (`currentLabel`, about 31-37, and its comment at about 27 that names only gutters)
- Modify: `src/features/trade-scenes/ui/components/controls/system-card-body.tsx` (about 45-49)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: `airSealingOptions`, `AirSealingOption`, `HomeMaterialFacts.airSealing` (Task 1).
- Produces: slot `'air-sealing'` in group `'existing'`, whose change is `{ kind: 'fact', patch: { airSealing } }`. Copy `AIR_SEALING_LABELS = { none: 'Not air sealed', sealed: 'Air sealed' } as const satisfies Record<AirSealingOption, string>`.

- [ ] **Step 1: Write the failing checks,** after the gutter-wear block (the one whose comment begins "The gutters' condition is its own Modify row"), which already has `base`, `slotsOf` and `applyAll`:

```ts
// Air sealing is a Today row beside the attic's insulation, on every home with an attic to seal.
{
  const sealSlot = (state: TradeSceneInputs) => slotsOf(state).find(s => s.id === 'air-sealing')
  const slot = sealSlot(base)
  assert.ok(slot, 'a roof not yet set reads as shingle, so it has an attic to seal')
  assert.deepEqual(slot.options.map(option => option.label), ['Not air sealed', 'Air sealed'])
  assert.equal(slot.current, null)
  assert.deepEqual(slot.change('sealed'), { kind: 'fact', patch: { airSealing: 'sealed' } })
  assert.equal(sealSlot(applyAll(base, [slot.change('sealed')]))?.current, 'sealed', 'the pick sticks')
  assert.equal(sealSlot(applyAll(base, [{ kind: 'roof-form', form: 'low-slope' }])), undefined, 'a flat roof has no attic to seal, so no row')
}
```

- [ ] **Step 2: Run** `pnpm tsc`. Expected: FAIL (`'air-sealing'` is not a `SceneChangeSlotId`).
- [ ] **Step 3: Implement.**
  - In `case 'attic-insulation'`, after the insulation slot, push `existingSlot('air-sealing', HOME_MATERIALS_COPY.airSealing, optionsOf(airSealingOptions, AIR_SEALING_LABELS), homeMaterials.airSealing, value => ({ kind: 'fact', patch: { airSealing: value as AirSealingOption } }))` when `roofFormOf(property.roofType) !== 'low-slope'`. Comment why: an unset roof reads as shingle in the resolver, so it has an attic to seal.
  - In `currentLabel`, map `slot.id === 'air-sealing' && slot.current === null` to `AIR_SEALING_LABELS.none`, and widen the comment above it to cover both facts.
  - In `system-card-body.tsx`, add `...id === 'attic-insulation' && slotOf('air-sealing') ? [<ExistingChip key="air-sealing" slot={slotOf('air-sealing')!} slots={slots} material={null} />] : []`, and change the comment to "Gutters rides with the roof, air sealing with the attic's insulation."
  - Words: `'air-sealing': 'air sealing sealed seal leakage leaks gaps attic ceiling'`.
- [ ] **Step 4: Run all checks.** Expected: clean, `verify-trade-scene: ok`.
- [ ] **Step 5: Screenshot.** Check the port. Write the probe at `<scratchpad>/attic/probe.mjs` (Playwright, sign in through `/api/dev/playwright-session`, open `/dashboard/trade-scene`, one case per run). Load the attic card on a shingle home: the chip reads "Not air sealed". Pick "Air sealed": the chip updates and the build row reads "Already air sealed".
- [ ] **Step 6: Commit** by path: `feat(trade-scenes): the attic card's Today row sets the air sealing, beside the insulation`.

### Task 3: The ceiling row tells the air sealing

**Files:**
- Modify: `src/features/trade-scenes/constants/system-parts.ts` (ceiling story; remove the `air-sealing` entry)
- Modify: `src/features/trade-scenes/types.ts` (`SystemPartStory`: `'leak' | 'sealing'`)
- Modify: `src/features/trade-scenes/lib/system-parts-shown.ts` (`systemStory`, `STORY_KEY`, `systemPartRows`)
- Modify: `src/features/trade-scenes/constants/home-scene-copy.ts` (`ATTIC_CEILING_LABELS`)
- Modify: `src/features/trade-scenes/lib/ceiling-opening-part.ts` (and its comment at about 3-5)
- Delete: `src/features/trade-scenes/lib/foam-collars-shown.ts`
- Modify: `src/features/trade-scenes/ui/components/home-kit/house-roof.tsx` (the `foamCollarsShown` call, about 63)
- Modify: `src/features/trade-scenes/ui/components/home-kit/attic-openings.tsx`
- Modify: `src/features/trade-scenes/lib/system-part-focus.ts` (the `'air-sealing'` point, `SEALED_CAN`, `CEILING_POINTS`, the comment at about 121)
- Modify: `src/features/trade-scenes/constants/look-inside.ts` (drop `'air-sealing'` from `PART_PAINT_FACES`)
- Modify: `src/features/trade-scenes/lib/step-cut-back.ts` (the `stepBottom` comment, "the gaps round the openings")
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces: `SystemStory` becomes `{ leak: boolean, sealable: boolean, form: RoofForm }`, where `sealable` is true when the roof-attic `air-sealing` part resolves (pitched only). `ceilingOpeningPart(lit)` returns `'ceiling' | null`. `ATTIC_CEILING_LABELS = { leaking: 'Ceiling leakage', sealed: 'Ceiling air sealed' } as const`.

- [ ] **Step 1: Rewrite the checks the fold changes.** Find each by its message:
  - Delete "the ceiling's gaps and the air sealing that closes them never show together", the `stepOrder([...'air-sealing'...])` check ("the seal…"), and the sweep's sealed-strip block with its `stepped.sealedStrips`/`sealedBoots` counters and their share of the sweep's final `assert.ok(stepped.ceiling.roof > 0 …)`. Task 5 adds the bare-floor check that replaces them.
  - Delete the sweep's `shown.includes('air-sealing')` branch (about 4553) and its comment ("The attic lights its ceiling for the gaps air sealing would close").
  - "air sealing in the build closes the gaps" becomes `assert.ok(shownIds('attic', sealed).includes('ceiling'), 'the build's air sealing keeps the ceiling up close')`. The `systemStory(...).airGaps` deep-equal beside it becomes `[systemStory(rainFailing).leak, systemStory(rainFailing).sealable, systemStory(sealed).sealable]` = `[true, true, true]`, plus `systemStory(flat).sealable === false`.
  - Drop `'air-sealing'` from the flat roof's `['radiant-barrier', 'air-sealing', 'attic-fan']` loop; add `assert.ok(!flatShown.includes('ceiling'), 'a flat roof shows no attic ceiling')` only for the attic list.
  - The `ceilingOpeningPart` checks: `(litOf('attic', ['attic-insulation', 'ceiling'])) === 'ceiling'`, `(litOf('attic', ['attic-insulation'])) === null`, the roof and whole-home lines stay. Delete the `'air-sealing'` line.
  - Delete the `foamCollarsShown` checks (about 2807-2809) with the function.
  - Add:

```ts
for (const [airSealing, label] of [['none', 'Ceiling leakage'], ['sealed', 'Ceiling air sealed']] as const) {
  const rows = systemPartRows('attic', at({ property: sixtiesSingle, homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, airSealing } }))
  const ceiling = rows.find(row => row.id === 'ceiling')!
  assert.deepEqual([ceiling.label, ceiling.condition], [label, 'retained'], `${airSealing}: the attic's ceiling row`)
  assert.equal(rows.filter(row => row.id === 'ceiling').length, 1, 'air sealing has no row of its own')
}
const sealedBuild = at({ property: sixtiesSingle, view: 'proposed', proposedScopeIds: [SCOPE_IDS.airSealing] })
const builtCeiling = systemPartRows('attic', sealedBuild).find(row => row.id === 'ceiling')!
assert.deepEqual([builtCeiling.label, builtCeiling.condition], ['Ceiling air sealed', 'installed'], 'the build seals the ceiling: the row reads New')
assert.equal(systemPartRows('roof', at({ property: sixtiesSingle, weather: 'rain' })).find(row => row.id === 'ceiling')!.label, 'Ceiling', 'the roof keeps its own ceiling label')
assert.ok(!systemPartRows('attic', at({ property: profile({ roofType: 'flat', hvacType: 'package-unit' }) })).some(row => row.id === 'ceiling'), 'a flat roof shows no attic ceiling')
```

- [ ] **Step 2: Run** `pnpm tsc`. Expected: FAIL wherever `'air-sealing'` is still named as a system part.
- [ ] **Step 3: Implement.**
  - **System parts:** the `ceiling` entry gets `story: { roof: 'leak', attic: 'sealing' }`, with the comment "the attic shows it wherever the attic can be sealed, leaking or sealed". Delete the `air-sealing` entry.
  - **`systemStory`:** `sealable: <the air-sealing part resolves>`; `STORY_KEY` maps `'sealing'` to `sealable`.
  - **`systemPartRows`:** for `system === 'attic' && entry.id === 'ceiling'`, take the roof-attic `air-sealing` part as `sealing`. Leaking (`sealing.condition === 'absent'`) gives `{ ...ceilingResolved, id: 'ceiling', label: ATTIC_CEILING_LABELS.leaking, detail: sealing.detail }`. Sealed gives `{ ...sealing, id: 'ceiling', label: ATTIC_CEILING_LABELS.sealed }`, so the build's seal reads New.
  - **`ceilingOpeningPart`:** `lit?.system === 'attic' && lit.shown.has('ceiling') ? 'ceiling' : null`. Its comment: the fixtures and their foam light with the ceiling they pierce.
  - **Foam:** delete `foam-collars-shown.ts`. A flat roof never resolves an `air-sealing` part (its `forms` list drops it), so `house-roof.tsx` passes `collars={partState(parts, 'air-sealing').material === 'sealed'}`, with the why-comment from the old file reworded: foam closes the openings before insulation goes down; the cutaway shows it where the blanket is cut back.
  - **`AtticOpenings`:** drop the step logic (`starts`, `from`, `bottom`, `to`, `lower`, `shownKey`, `restOpenings`). When `collars` is true, draw every opening's collar in the same group as the cans and pipes, tagged with `ceilingOpeningPart(lit)`. The `collars` prop comment becomes "Whether the ceiling is sealed: the foam round every opening".
  - **`systemPartFocus`:** delete the `'air-sealing'` point. Rename `SEALED_CAN` to `STRIP_OPENING`, picked from `ceilingOpenings(false)` (every home has them; a boot is only drawn with ducts) as the one nearest the middle of the attic's bare strip. `CEILING_POINTS.attic` becomes `[STRIP_OPENING.at[0], WALL_TOP_Y + CEILING_OPENING_LOOK.collar.height + ATTIC_PIN.sealRise, STRIP_OPENING.at[1]]`, so one pin shows the foam or the dust. `ATTIC_PIN.ceilingBack`/`ceilingAside` go if nothing else reads them. Reword the comment at about 121 ("the gaps above it").
  - Remove `'air-sealing'` from `PART_PAINT_FACES`.
  - `stepBottom`'s comment: the story it is lit for is a leak through the ceiling or the openings the air sealing closes.
- [ ] **Step 4: Run all checks.** Expected: clean, `verify-trade-scene: ok`.
- [ ] **Step 5: Screenshots,** one at a time: attic Look inside unsealed, sealed today and sealed in the build. The ceiling row stays in all three. The foam shows only when sealed. The leak arrows show only when unsealed (Thermal on).
- [ ] **Step 6: Commit** by path, including the deleted file: `feat(trade-scenes): the attic's ceiling stays up close and reads as leaking or air sealed; its foam is drawn with it`.

### Task 4: Dust round the openings, debris on the blanket

**Files:**
- Delete: `src/features/trade-scenes/lib/attic-dust-patches.ts`
- Create: `src/features/trade-scenes/lib/ceiling-opening-dust.ts`
- Create: `src/features/trade-scenes/lib/blanket-debris.ts`
- Modify: `src/features/trade-scenes/constants/look-inside.ts` (the `ATTIC_DUST` comment, about 197-199)
- Modify: `src/features/trade-scenes/constants/wear-looks.ts` (add `INSULATION_DEBRIS` beside `FELT_WEAR`)
- Modify: `src/features/trade-scenes/ui/components/home-kit/attic-dust.tsx`
- Modify: `src/features/trade-scenes/ui/components/home-kit/attic-floor.tsx`
- Modify: `src/features/trade-scenes/ui/components/home-kit/house-roof.tsx` (the comment at about 45, "the blanket over each gap is dusty")
- Modify: `src/features/trade-scenes/constants/home-geometry.ts` (the comment on the `(4.1, -1.9)` can, about 271: say only why it stands where it does now)
- Test: `scripts/verify-trade-scene.ts` (the dust block that calls `atticDustPatches`)

**Interfaces:**
- Produces: `ceilingOpeningDust(ducted: boolean): BoxSpec[]`, a flat patch on the ceiling at `WALL_TOP_Y + ATTIC_DUST.lift` over each `ceilingOpenings(ducted)` entry. `blanketDebris(boxes: readonly BoxSpec[], share: number, seed: number): BoxSpec[]`, where `share` is `wornShare(wear)` (0 New, 1 Worn, 4/3 Failing). `INSULATION_DEBRIS = { perSquareMetre: 7, size: { min: 0.05, max: 0.16 }, thickness: 0.003, lift: 0.004 } as const`: the density is what Worn draws, as every other wear look's strength is; all working numbers set by screenshot.

- [ ] **Step 1: Replace the dust checks with:**

```ts
const dust = ceilingOpeningDust(true)
assert.equal(dust.length, ceilingOpenings(true).length, 'dust gathers round every opening')
ceilingOpenings(true).forEach((opening, index) => {
  assert.deepEqual([dust[index]!.position[0], dust[index]!.position[2]], [...opening.at], 'round the opening itself')
  assert.ok(Math.abs(dust[index]!.position[1] - (WALL_TOP_Y + ATTIC_DUST.lift)) < 1e-9, 'on the ceiling, under any blanket')
})
assert.equal(ceilingOpeningDust(false).length, ceilingOpenings(false).length, 'no boot, no dust round one')
const debrisOf = (boxes: readonly BoxSpec[], wear: number) => blanketDebris(boxes, wornShare(wear), 1)
for (const material of ['blown-r30', 'batts-r30'] as const) {
  const blanket = atticInsulationBoxes(material, false, ATTIC_SPANS.open)
  assert.deepEqual(debrisOf(blanket, WEAR_AMOUNT.new), [], `${material}: a new blanket is clean`)
  const [good, worn, failing] = [WEAR_AMOUNT.good, WEAR_AMOUNT.worn, WEAR_AMOUNT.failing].map(wear => debrisOf(blanket, wear))
  assert.ok(good.length > 0 && good.length < worn.length && worn.length < failing.length, `${material}: debris grows with wear`)
  assert.deepEqual(good, failing.filter(speck => good.some(kept => isDeepStrictEqual(kept, speck))), `${material}: less wear keeps a subset of the specks, never a reshuffle`)
  const topAt = (x: number, z: number) => Math.max(...blanket.filter(box => Math.abs(box.position[0] - x) <= box.size[0] / 2 && Math.abs(box.position[2] - z) <= box.size[2] / 2).map(box => box.position[1] + box.size[1] / 2))
  for (const speck of failing) {
    assert.ok(Math.abs(speck.position[1] - (topAt(speck.position[0], speck.position[2]) + INSULATION_DEBRIS.lift)) < 1e-9, `${material}: every speck lies on the blanket's uppermost top, never inside a sheet over it`)
  }
}
```

Use the batts material id the script already uses for R-30 batts if it differs. Then the top off: using the scene the script already builds for `'top off and air sealing'` over Failing insulation, assert `partState(parts, 'attic-insulation').wear === 0`, so `AtticFloor`'s debris (Step 3) is `[]`.

- [ ] **Step 2: Run** `pnpm tsc`. Expected: FAIL (`ceilingOpeningDust`, `blanketDebris` and `INSULATION_DEBRIS` are not defined).
- [ ] **Step 3: Implement.**
  - **`ceilingOpeningDust`:** no material or `from` parameter. Its comment says the dust gathers where the leaking air comes through, under whatever blanket lies over it.
  - **`blanketDebris`:** for each box (index `i`), take `seededRandom(seed * 1000 + i + 1)` and generate its first `Math.round(box.size[0] * box.size[2] * INSULATION_DEBRIS.perSquareMetre * share)` specks. Each speck is a square of side `min + r * (max - min)` and `thickness`, at a seeded spot on the box's top face (inset by half its side), at `top + lift`. Drop a speck when another box covers its spot with a higher top (batts' sheet over the bays). Each box always draws the same sequence and the drop test is per speck, so less wear is a subset.
  - **`AtticDust`:** it takes only `ducted`, `thermal` and `lit`, uses `ceilingOpeningDust(ducted)`, and is tagged with `ceilingOpeningPart(lit)` like the fixtures, keeping the other-system guard. Its comment: the dust lies on the ceiling round each opening, the blanket covers it, and the cut-back shows it.
  - **`AtticFloor`:** compute `debris` from `open.laid`/`complete.laid` with `wornShare(insulation.wear)`, memoized on `[open, complete, insulation.wear]`. Draw it with `<AtticSteps part="attic-insulation" lit={lit} thermal={INSULATION_TAG} boxes={…} color={HOME_PALETTE.atticDust} roughness={1} />`, the open span's beside the open blanket and the complete span's inside the `HOME_FADE_TAGS.complete` group, so the specks step and ghost with the blanket. Change the `dusty` prop comment to "Whether the ceiling still leaks air, which leaves dust round each opening". `<AtticDust>` loses `material` and `lowSlope`.
  - Do not touch `home-palette.ts`.
- [ ] **Step 4: Run all checks.** Expected: clean, `verify-trade-scene: ok`. Note the draw calls on the worst attic case (Failing batts, both spans) against the attic plan's baseline of 126; each debris `AtticSteps` adds one merged mesh, two when split.
- [ ] **Step 5: Screenshots,** one at a time, attic Look inside: no insulation unsealed (rings on the bare ceiling); R-30 Good (light scatter); R-30 Failing (heavy); R-30 batts Worn (specks on the sheet, none inside it); a top off over Failing (clean top); sealed (foam, no rings). Tune `ATTIC_DUST.size` and `INSULATION_DEBRIS` by eye if the rings or specks read wrong, in both the light and dark scene.
- [ ] **Step 6: Commit** by path, including the deleted file: `feat(trade-scenes): dust gathers on the ceiling round each leaking opening, under the blanket; the blanket carries debris that grows with its wear`.

### Task 5: The attic opens at its left end

**Files:**
- Modify: `src/features/trade-scenes/constants/look-inside.ts` (add `STEP_CUTS` beside `STEP_DEPTHS`; rewrite the `STEP_DEPTHS` comment at about 15-18)
- Modify: `src/features/trade-scenes/lib/step-cut-back.ts` (`stepStarts` reads `STEP_CUTS`; its comment at about 34-35)
- Modify: `src/features/trade-scenes/ui/components/home-kit/attic-steps.tsx` (the rest clip, about 35)
- Modify: `src/features/trade-scenes/lib/system-part-focus.ts` (`BY_THE_CUT`, `ON_THE_BLANKET`, and comments that say "by the cut")
- Modify: `src/features/trade-scenes/lib/cutaway-rain-path.ts` (the two `?? HOUSE.cutX` fallbacks, about 80 and 87)
- Modify: `src/features/trade-scenes/constants/system-camera-views.ts` (the Look inside comment at about 70-78 and `LOOK_INSIDE_VIEWS.attic` at about 89; `SYSTEM_CAMERA_VIEWS.attic` at 61-69 is the system view and stays)
- Modify: `src/features/trade-scenes/constants/home-geometry.ts` (`CEILING_OPENINGS`: the left vent pipe's spot and the comment at about 257-262)
- Test: `scripts/verify-trade-scene.ts` (the sweep's cut-line checks, the attic camera's sight check "stands between the camera and the heat", the sight-line check "seen straight in along its system's bearing")

**Interfaces:**
- Produces: `STEP_CUTS = { roof: HOUSE.cutX, attic: -4.65 } as const satisfies Record<CutawaySystemId, number>`, the attic's a working number set by screenshot. `stepStarts` reads `STEP_CUTS[system]` behind `isCutawaySystem`. Every attic consumer of the cut reads `STEP_CUTS.attic`.

- [ ] **Step 1: Update the checks to the attic's own cut.**
  - In the sweep, replace `HOUSE.cutX` with `STEP_CUTS[system]` in the cut-line checks, and the attic's `[from, to]` fallback with `STEP_CUTS.attic`.
  - Add:

```ts
assert.equal(STEP_CUTS.roof, HOUSE.cutX, 'the roof still opens at the kitchen wall')
const unsealed = shownOf('attic', at({ property: profile({ roofType: 'shingle', hvacType: 'central' }) }))
const blanketFrom = stepStarts('attic', unsealed, 1).get('attic-insulation')!
const reach = 2 * CEILING_OPENING_LOOK.collar.reach
// The bare strip shows a can, a pipe and, with ducts, a boot, each with its foam clear of both edges: what the air sealing story is told round.
for (const ducted of [true, false]) {
  const inStrip = (kind: CeilingOpening['kind']) => ceilingOpenings(ducted).some(opening => opening.kind === kind && opening.at[1] < HOUSE.atticFrontZ && opening.at[0] - opening.radius - reach >= STEP_CUTS.attic && opening.at[0] + opening.radius + reach <= blanketFrom)
  assert.ok(inStrip('can') && inStrip('pipe') && (inStrip('boot') || !ducted), `ducted ${ducted}: the bare strip holds the openings`)
}
const bathStack = CEILING_OPENINGS.find(opening => opening.kind === 'pipe' && opening.at[0] < 0)!
assert.ok(ATTIC_JOIST_XS.every(x => Math.abs(x - bathStack.at[0]) >= bathStack.radius + reach + HOUSE.joistWidth / 2), 'the moved vent pipe stands in a joist bay, clear of its foam')
assert.ok(rafterXs.every(x => Math.abs(x - bathStack.at[0]) >= bathStack.radius + rafterWidth / 2 + 0.05), 'and leaves through the back slope between two rafters')
assert.ok(HOUSE.halfLength - HOUSE.wallThickness - blanketFrom > 3 * (HOUSE.halfLength - HOUSE.wallThickness - (HOUSE.cutX + STEP_DEPTHS.attic)), 'the blanket shows over more than three times the run it did')
```

  `rafterXs`/`rafterWidth`: the same `framingGrid(-HOUSE.halfLength + rafterWidth, HOUSE.halfLength - rafterWidth, HOUSE.framingSpacing)` grid `roof-slope.tsx:101` builds, from the same `rafterWidth` source it reads.
  - The attic camera's sight check ("…stands between the camera and the heat…") must still pass with the openings now at the left end, in front of a camera standing there. If it trips, move the camera or the heat marks clear of the openings; never weaken the check.
  - The sight-line check ("seen straight in along its system's bearing") must still pass for the new attic view. If its straight-in line no longer crosses the near slope, keep its intent and take the bearing from the new target.
- [ ] **Step 2: Run** `pnpm tsc` and `pnpm tsx scripts/verify-trade-scene.ts`. Expected: FAIL (`STEP_CUTS` is not defined).
- [ ] **Step 3: Implement.**
  - **Pipe:** move the left vent pipe (the bath stack) from `[-3.15, -2.7]` to about `[-4.45, -2.7]`: in the left room's bay between the joists at −4.595 and −3.995 with its can and boot, between the rafters at about −4.755 and −4.155, still behind the cut line. The bay beside it is the fallback if the shot crowds. Rewrite the `CEILING_OPENINGS` comment: the left room's can, boot and bath stack share the bay at the attic's left end, where its strip shows them.
  - `STEP_CUTS` in `look-inside.ts`; its comment and the `STEP_DEPTHS` comment say the attic's strip is one joist bay at the left end, holding the can, the boot and the vent pipe, each with its foam clear of the step.
  - `stepStarts` uses `isCutawaySystem(system)` and `STEP_CUTS[system]`; its comment says it runs from the system's own cut.
  - In `AtticSteps`, the rest clip uses `STEP_CUTS[lit.system]` behind `isCutawaySystem`, no cast.
  - In `system-part-focus.ts`, `BY_THE_CUT = stepCentre('attic', STEP_CUTS.attic, 1)` and `ON_THE_BLANKET = stepCentre('attic', STEP_CUTS.attic + STEP_DEPTHS.attic, 1)`.
  - In `cutaway-rain-path.ts`, both fallbacks become `?? STEP_CUTS[steps.system]` (already a `CutawaySystemId`).
  - Camera: the attic Look inside target becomes `[STEP_CUTS.attic + 0.4, WALL_TOP_Y, HOUSE.atticFrontZ - 1.4]`. Set `turn`, `elevation` and `distance` by screenshot so the camera stands at the left end and sees the can, the boot and the pipe in front, with the blanket running to the right gable. Rewrite the comment at about 70-78 to match.
- [ ] **Step 4: Run all checks.** Expected: clean, `verify-trade-scene: ok`.
- [ ] **Step 5: Screenshots,** one at a time: a pitched home in landscape, narrow and portrait, Thermal on and off; the back slope from outside (the moved pipe stub between two rafters, on shingle and on tile); roof Look inside (unchanged, still at the kitchen wall); a flat roof home in landscape; and the attic fan pick (its own view must still face its gable). If on the flat roof the roof's own faded deck covers the moved strip, stop and show Oliver before going on. The flat roof's cut is not settled.
- [ ] **Step 6: Commit** by path: `feat(trade-scenes): attic Look inside opens over its left-end bay, where the bath vent now stands by the can and boot, and looks along the attic`.

### Task 6: Whole-branch check and hand-off

- [ ] **Step 1: Run all checks.** Expected: all clean, `verify-trade-scene: ok`.
- [ ] **Step 2: Run** `grep -rn "air-gaps\|airGaps\|SEALED_CAN\|atticDustPatches\|attic-dust-patches\|foamCollarsShown\|foam-collars-shown" src scripts`, and `grep -rn "'air-sealing'" src/features/trade-scenes/constants/system-parts.ts`. Expected: no hits.
- [ ] **Step 3: Final shots for Oliver,** one at a time: Today unsealed, Today sealed, build sealed, and Good against Failing insulation. Use the attic Look inside in landscape and portrait.
- [ ] **Step 4: Report** what is built, the working numbers set by eye (`STEP_CUTS.attic`, the pipe's spot, the camera, `ATTIC_DUST`, `INSULATION_DEBRIS`), the worst-case draw calls, and that the tracker and CONTEXT.md edits are left unstaged. Do not push.
