# Heating & Cooling System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Heating & cooling draws the homeowner's own system as an installer builds it (indoor unit by component, in the attic or an HVAC closet), every HVAC scope in the catalog draws what it installs, the bills move only where the honest change is a cut, and the rep can walk the system in the sales order.

**Architecture:** The construction core gains the indoor unit's components as parts of `hvac-attic` (blower, furnace, coil, plenum, registers, thermostat, mini-split heads and outdoor unit) and four small, general mechanisms: a scope filed under a row other than its first install's part (`filedUnder`), a scope offered only where the home has or lacks given parts (`onlyWhere`), a material whose base cut lands on named bills only (`bills`), and a part whose new install where the home had none earns no cut (`noCutWhereNone`). The scene then stops reading `property.hvacType` to draw: one pure function, `drawnHvac`, turns the side on show's resolved parts into what is drawn, what runs in each season and where the camera looks, and every drawing, pin and camera reads it. The heat pump comes last.

**Tech Stack:** Next.js, React Three Fiber, three.js, TypeScript, Zod. Checks are plain `node:assert` scripts run with `pnpm tsx`, plus `pnpm tsc` and ESLint.

**Spec:** `docs/superpowers/specs/2026-11-11-heating-and-cooling-system-design.md` (approved 2026-11-13). Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md`, R297–R310, R312–R315, R318, R319, R323, R324. Stress-tested 2026-11-13; the amendments are folded in below.

## Global Constraints

- **Only Oliver starts a dev server.** Before any screenshot, check `ss -ltnp | grep :3002` (the worktree's `PORT`). If nothing listens, stop and ask Oliver to start it. Never run `pnpm dev`, `next dev` or `pnpm build`.
- **Never sweep the scene in a software-rendered browser.** One page, one case per probe run (a multi-case sweep crashed the machine). The screenshot probe is written once, in Task 0, at `<scratchpad>/hvac/probe.mjs` (Playwright through the repo's own `playwright` package, signed in via `/api/dev/playwright-session`, memory `reference-playwright-auth.md`, never printing the URL). Later tasks reuse it.
- **"All checks"** means every one of these exits 0: `pnpm tsc`; `CI=1 pnpm eslint scripts/verify-heating-cooling.ts scripts/verify-trade-scene.ts scripts/verify-trade-scene-layout.ts src/features/trade-scenes src/shared/modules/construction src/features/meeting-flow/constants src/features/landing/constants src/pain-points.ts`; `pnpm tsx scripts/verify-heating-cooling.ts`; `pnpm tsx scripts/verify-trade-scene.ts` (prints `verify-trade-scene: ok`); `pnpm tsx scripts/verify-trade-scene-layout.ts`; `pnpm tsx scripts/verify-construction-model.ts`; `pnpm tsx scripts/verify-bill-cut-claims.ts`; `pnpm tsx scripts/verify-remodel-roi.ts`. Tasks 3 and 12 also run `pnpm tsx scripts/verify-scope-installs.ts`, which reads the Notion catalog read-only.
- **New checks go in a new file**, `scripts/verify-heating-cooling.ts`, created in Task 1, one section per task, with the same shape as `scripts/verify-covering-wear.ts` (top-level `assert`s, `console.log('verify-heating-cooling: ok')` last). An existing assertion elsewhere that encodes a rule this plan changes is rewritten to the new rule, never deleted to pass. Each task names the ones it expects. Any other failure is a bug.
- **Shared worktree.** Other sessions commit on `feat/trade-scenes-foundation` (the gutters work did on 2026-11-13). Tasks 2, 3 and 9 must commit `scripts/verify-trade-scene.ts`, which on 2026-11-13 held another session's uncommitted edits (18 added and 7 deleted lines: the `PIN_CLEARANCE` assert and the gutter-stain checks). Owner ruling: that session commits them before the build starts; Task 0 checks the file is clean and stops if it is not. Before every commit, run `git status --short -- src scripts` and `git diff -- <each file you will stage>`. If a file you must stage has hunks you did not write, stop and report; never stage part of a file. Stage by explicit path only. Never `git stash`, `checkout` or `reset`. Never touch the tracker, `CONTEXT.md` or another plan except in Task 13.
- Find existing code and checks by symbol or assertion message, not line number. Line numbers below are as of `e4327b99f` and shift.
- Comments say why, never what. Never cite a plan, spec, task or ruling number in code, and that includes the section headers of `verify-heating-cooling.ts` (name the behaviour, not "Task N").
- After any scripted edit, run `git diff --shortstat` on the file. A whole-file diff means its line endings changed (no target file is CRLF today); undo with the Edit tool, never with checkout.
- No DB writes. `hvacTypes` gains a value, but the `customer_profiles.hvac_type` column is `text({ enum })`, so no migration and no `db:push` are needed.
- Commit after each task. Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
- **Copy (exact strings).** These are placeholders until the owner reads them at the look.
  - Today's system menu: `'Central'`, `'Package unit'`, `'Wall furnace'`, `'Wall unit'`, `'Window / portable'`, `'Mini-splits'`.
  - Location menu: name `'Indoor unit location'`, options `'Attic'`, `'HVAC closet'`, `'Garage'`.
  - Mini-split count: name `'Mini-split heads'`, options `'1 head'`, `'2 heads'`, `'3 heads'`.
  - Build switch: `'Move to the attic'`.
  - Build rows: the central row is named `'Central system'` (`PART_LABELS.blower`); the mini-split row `'Mini-splits'`.
  - Build-row options, one name per job so no row lists two alike: split replacement `'Whole system'`, A/C replacement `'A/C only'`, furnace replacement `'Furnace only'`, new-cut `'New system'`, both heat pump entries `'Heat pump'` (only one is ever offered on a home), Mini-split installation `'Installed'`, Kit: mini-split `'Kit'`.
  - Part-row words: a part the build adds where the home had none, on every system (R324): `'Added'`. A part the build takes out: `'Taken out'`.
  - Part copy is in Tasks 2, 3 and 12.

## Review Focus

1. **A home whose HVAC type is not set (null).** It must resolve, draw, save and offer exactly as central furnace + A/C does today: same parts, same 25% / 20% cuts, same picks. This is the most common home in a meeting. Tests: Tasks 2, 4 and 5.
2. **Today changed under a standing pick.** Central → Wall furnace with Split replacement and Air ducts picked drops both picks, and the build row then offers New-cut. Wall unit → Central drops a New-cut pick. Tests: Task 3.
3. **A furnace-only home gets Split replacement.** Build draws a coil, line set and condenser it never had, each listed `'Added'`. The gas cut is 20% and the electric cut is 0, never negative. With new ducts too, gas is 24% and electric stays 0 (R323). Tests: Tasks 2, 4 and 5.
4. **A flat roof.** A central home's indoor unit is guessed `closet` and never drawn in an attic, even with a redeck. `'Move to the attic'` is never offered. The roof spot never offers heating & cooling. Tests: Tasks 5, 8 and 9.
5. **A package-unit home.** It has no blower row and no new-cut or heat pump offer. It is offered Package replacement, ducts and mini-splits. Its cuts and look are unchanged. Tests: Tasks 3, 4 and 12.

---

### Task 0: A clean shared file and the baseline shots

Nothing in the scene changes yet, so this is the only point where a screenshot shows today's drawing.

**Files:**
- Create: `<scratchpad>/hvac/probe.mjs` (not committed), `<scratchpad>/hvac/shots/baseline/`

- [ ] **Step 1: Check the shared files.** Run `git status --short -- src scripts`. If it lists `scripts/verify-trade-scene.ts` or any file this plan modifies (on 2026-11-13 another session also had `src/features/trade-scenes/types.ts` and several home-kit files open), stop and tell Oliver: the owner ruled that the other session commits its edits before this build starts.
- [ ] **Step 2: Check the dev server** with `ss -ltnp | grep :3002`. If nothing listens, stop and ask Oliver to start it.
- [ ] **Step 3: Write the probe.** One case per run, through a URL-free state setter if the page has one; otherwise drive the system card. Each run saves Today and Build, Complete and Partly open, in summer.
- [ ] **Step 4: Shoot the baseline,** one case per run, into `<scratchpad>/hvac/shots/baseline/`:
  - null home;
  - central furnace with split replacement (Build);
  - wall-mounted, Partly open (its attic shows no duct boots, collars or ceiling leaks);
  - portable;
  - package-unit pitched;
  - package-unit flat.

  Record the draw calls of the null home's Build with split and ducts.
- [ ] **Step 5:** Run all checks. Expected: all pass at HEAD. Nothing to commit.

### Task 1: Core mechanisms for filing, fitting and bill sides

**Files:**
- Modify: `src/shared/modules/construction/core/types.ts`, `src/shared/modules/construction/core/lib/install-kind.ts`, `src/shared/modules/construction/core/lib/resolve-assembly.ts`, `src/features/trade-scenes/lib/part-offers.ts`
- Create: `src/shared/modules/construction/core/lib/scope-fits-home.ts`, `scripts/verify-heating-cooling.ts`

**Interfaces:**
- Produces, in `types.ts`:
  - `PartMaterialFields.bills?: readonly BillCategory[]`: the bills this material runs on. On an installed material it is where its base cut lands; on today's material it is a bill the home pays that side on (Task 4). Absent means every bill its trade cuts.
  - `PartDefinition.noCutWhereNone?: true`: a new one where the home had none brings comfort it never had, which can only raise a bill, so it earns no cut.
  - `ResolvedPart.added?: true`: installed where today has none. It is set on every assembly, not only `hvac-attic` (owner ruling R324): a radiant barrier, an attic fan or gutters on a home with none are `added` too. Only Task 8 shows it.
  - `ScopeInstall.filedUnder?: string`: the part the scope is sold on, when it is not the first install's. Core says nothing of build rows; the scene files the scope's offer under it.
  - `ScopeInstall.onlyWhere?: { has?: readonly string[], lacks?: readonly string[] }`: a replacement needs what it replaces, and a first install needs the home to have none.
- Produces `scopeFitsHome(entry: ScopeInstall, existing: readonly ResolvedPart[]): boolean`. Every `has` part is resolved and not `absent`. Every `lacks` part is unresolved or `absent`. "Resolved and not absent" is the test `homeHasPart` in `part-offers.ts` already makes. Export one `hasPart(existing, id)` from `scope-fits-home.ts` and have `part-offers.ts` use it, so the rule has one home.

- [ ] **Step 1: Write the failing checks** in a new `scripts/verify-heating-cooling.ts`. Use a fixture assembly built in the script: `{ id: 'hvac-attic', trades: ['hvac'], modes: {}, parts: [{ id: 'a', group: 'g', role: 'equipment', noCutWhereNone: true, materials: { old: { copy, energyRank: 0 }, new: { copy, energyRank: 1, bills: ['electric'] } } }, { id: 'b', group: 'g', role: 'equipment', materials: { old: { copy, energyRank: 0 }, new: { copy, energyRank: 1 } } }] }`. Pass a fixture installs record as `resolveAssembly`'s third argument.
  - `installKind(partA, null, 'new') === 'like-for-like'` with the message `'a part the home never had earns no cut'`.
  - `installKind(partA, 'old', 'new') === 'saves-energy'`.
  - `installKind(partB, null, 'new') === 'saves-energy'`, because without the flag today's rule stands.
  - On a home where `a` is absent and `b` is `old`, a scope installing both in `view: 'proposed'` resolves `a` with `added: true` and `b` with no `added`.
  - `scopeFitsHome({ ..., onlyWhere: { has: ['b'] } }, resolvedParts)` is true when `b` is retained and false when `b` is absent.
  - `scopeFitsHome({ ..., onlyWhere: { lacks: ['a'] } }, resolvedParts)` is true when `a` is absent.
  - An entry with no `onlyWhere` is true.
  - On the real assemblies: Radiant barrier on the default pitched home (which has none) resolves `radiant-barrier` with `added: true`, and a tear-off's `covering` has no `added`.
- [ ] **Step 2: Run** `pnpm tsx scripts/verify-heating-cooling.ts`. Expected: it fails to compile or assert (fields missing).
- [ ] **Step 3: Implement.** Add the fields to `types.ts`, with the comments above as their why. In `installKind`, after the installed rank check: `if (existing === null && part.noCutWhereNone) return 'like-for-like'`. In `resolveAssembly`, mark `added: true` when the part is installed and `existing.parts[part.id]` is missing or `absent`. Write `scopeFitsHome`. In `partOffers`, file each scope under `entry.filedUnder ?? entry.installs[0]?.part`. In `offeredScopes`, drop every scope whose `SCOPE_INSTALLS` entry fails `scopeFitsHome(entry, ctx.existing)`, before the existing rules. No current scope sets either field, so no offer changes.
- [ ] **Step 4: Run all checks.** Expected: all pass. The one allowed rewrite: an existing check that compares a whole resolved part (`deepEqual`) for a part installed where the home had none now expects `added: true`. Any offer, cut or drawing change is a bug.
- [ ] **Step 5: Commit** `types.ts`, `install-kind.ts`, `resolve-assembly.ts`, `scope-fits-home.ts`, `part-offers.ts`, `scripts/verify-heating-cooling.ts`: `feat(construction): scopes filed under a row, offered where they fit, and cuts that land on named bills`.

### Task 2: The indoor unit becomes its components

**Files:**
- Modify (core): `constants/enums.ts`, `constants/assemblies/hvac-attic.ts`, `lib/assemblies/hvac-attic/infer-existing-conditions.ts`, `constants/home-materials.ts`, `constants/scope-installs.ts` (Split replacement only), `types.ts` (`HomeMaterialFacts`)
- Create (core): `lib/hvac-system.ts`
- Modify (scene): `types.ts` (`DrawingOnlyMaterialFact`), `constants/home-systems.ts`, `constants/system-parts.ts`, `constants/home-scene-copy.ts` (`PART_LABELS`, `buildChips`, `HVAC_TYPE_LABELS`), `constants/scene-change-words.ts`, `lib/system-part-focus.ts` (resting points), `lib/systems-at-spot.ts` (it calls `HVAC_ATTIC.appliesTo`, which this task removes), `ui/components/home-kit/attic-ducts.tsx` (tag only), `ui/components/home-kit/home-kit.tsx` (`ducted` only)
- Create (scene): `lib/has-ducts.ts`
- Test: `scripts/verify-heating-cooling.ts`, `scripts/verify-trade-scene.ts`, `scripts/verify-construction-model.ts`

**Interfaces:**
- Produces, in `enums.ts`:
  - `hvacTypes = ['central', 'wall-mounted', 'portable', 'package-unit', 'mini-split']`.
  - `hvacIndoorLocations = ['attic', 'closet', 'garage'] as const` and `type HvacIndoorLocation`.
  - `miniSplitHeadCounts = ['1', '2', '3'] as const` and `type MiniSplitHeadCount`. These are strings, as `acTonnages` are. (Not `MiniSplitHeads`: that name is Task 11's drawing.)
- Produces, in `hvac-system.ts`:
  - `isCentralSystem(type: HVACType | null): boolean` is true for null and `central`.
  - `isDuctedSystem(type: HVACType | null): boolean` is central plus `package-unit`.
- Produces `HomeMaterialFacts` fields, each `| null` and unset in `HOME_MATERIAL_FACTS_UNSET`: `hvacIndoorLocation: HvacIndoorLocation`, `proposedHvacIndoorLocation: HvacIndoorLocation`, `miniSplitHeads: MiniSplitHeadCount`, `proposedMiniSplitHeads: MiniSplitHeadCount`. All four join `DrawingOnlyMaterialFact`.
- Produces `scene/lib/has-ducts.ts`: `hasDucts(parts: readonly ResolvedPart[]): boolean`, true when `duct-runs` resolved with a material and is not `absent`. `home-kit.tsx`'s `ducted` reads it on the side on show in place of "the assembly resolved", because from this task every home resolves `hvac-attic`. `ducted` feeds the ceiling openings, leaks, boots and dust, so without this a wall, window or mini-split home would grow duct boots it does not have.
- Produces `hvac-attic` parts, in this order. The first part is the one facing the living space (`verify-construction-model.ts` pins it, today `'air-handler'`), so `registers` comes first; the rest follow as listed. `SYSTEM_PARTS` sets the card's list order.

  | id | group | forms | flag | materials |
  |---|---|---|---|---|
  | `registers` | ducts | any | | `grille` |
  | `blower` | equipment | split | | `standard-blower` (no rank), `new-blower` (no rank) |
  | `furnace` | equipment | split | `noCutWhereNone` | `standard-furnace` (0, `bills: ['gas']`), `high-efficiency-furnace` (1, `bills: ['gas']`) |
  | `coil` | equipment | split | `noCutWhereNone` | `standard-coil` (0, `bills: ['electric']`), `high-efficiency-coil` (1, `bills: ['electric']`) |
  | `plenum` | equipment | split | | `sheet-metal` |
  | `duct-runs` | ducts | any | `noCutWhereNone` | as today |
  | `thermostat` | equipment | any | | `thermostat` |
  | `refrigerant-lines` | equipment | split | | `copper` |
  | `condenser` | equipment | split | `noCutWhereNone` | `standard-seer` (0, `bills: ['electric']`), `high-seer` (1, `bills: ['electric']`) |
  | `package-unit` | equipment | package | | as today (no `bills`) |
  | `mini-split-heads` | equipment | any | | `wall-head` |
  | `mini-split-outdoor` | equipment | any | | `mini-split-condenser` |

  `appliesTo` is removed: every home has heating & cooling. `form` stays `package` for a package unit and `split` otherwise.
- Copy, as `copy` / `conditionCopy.worn`:
  - `standard-blower`: `'Blower'` / `'The fan that pushes the air through the furnace, the coil and the ducts.'`; worn `'Aging blower'` / `'An older blower moves less air for the same electricity.'`
  - `new-blower`: `'New blower'` / `'Pushes the air through the furnace, the coil and the ducts.'`
  - `standard-furnace`: `'Furnace'` / `'Burns gas to heat the air in winter.'`; worn `'Aging furnace'` / `'An older furnace burns more gas for the same heat.'`
  - `high-efficiency-furnace`: `'High-efficiency furnace'` / `'Heats the air on less gas.'`
  - `standard-coil`: `'Evaporator coil'` / `'Cools the air in summer, working with the condenser outside.'`; worn `'Aging coil'` / `'An older coil cools less for the same electricity.'`
  - `high-efficiency-coil`: `'High-efficiency coil'` / `'Matched to the new condenser to cool on less electricity.'`
  - `sheet-metal`: `'Plenum'` / `'The box the ducts leave from, carrying the air to every room.'`
  - `grille`: `'Registers'` / `'Where the air comes into each room.'`
  - `thermostat`: `'Thermostat'` / `'Tells the system when to heat and when to cool.'`
  - `wall-head`: `'Mini-split heads'` / `'A unit high on the wall that heats and cools its room on its own.'`
  - `mini-split-condenser`: `'Mini-split outdoor unit'` / `'One outdoor unit serves every head.'`
  - `r6-silver-flex` and `r8-flex` each gain `conditionCopy.installed`, with their own label and their detail followed by `' Hung from the rafters on straps, clear of the insulation: no run crushed or kinked, so air reaches every room, and supported the way code requires.'` An existing R-6 home is not hung, so the sentence is only on the build.
- Produces Today's parts, from `inferHvacAtticExistingConditions`. Here `central = isCentralSystem(type)` and `comps = hvacComponents ?? 'both'`.
  - `blower`, `plenum`: present when central.
  - `furnace`: present when central and comps is not `ac`.
  - `coil`, `refrigerant-lines`, `condenser`: present when central and comps is not `furnace`.
  - `duct-runs`: as today, through the `ducts` material.
  - `registers`: present when `isDuctedSystem(type)`.
  - `thermostat`: always present.
  - `package-unit`: as today.
  - `mini-split-heads`, `mini-split-outdoor`: present when type is `mini-split`.
  - Parts that age use `drawnPart(<material>, home, 'heating-cooling')`. `plenum`, `registers` and `thermostat` are `{ material, condition: 'retained' }`.
- `HOME_MATERIALS['heating-cooling'].parts` lists every part above except `duct-runs` and `registers`. Its `repairsEndWith` lists `blower`, `furnace`, `coil`, `refrigerant-lines`, `condenser` and `package-unit`. `HOME_MATERIALS.ducts.appliesTo` becomes `property => isDuctedSystem(property.hvacType)`.
- Split replacement installs `blower` `new-blower`, `furnace` `high-efficiency-furnace`, `coil` `high-efficiency-coil`, `refrigerant-lines` `copper` and `condenser` `high-seer`, with `onlyWhere: { has: ['blower'] }`.
- Scene, in `home-systems.ts`:
  - `BUILD_ROW_PART_IDS` swaps `air-handler` for `blower` and adds `mini-split-heads` after `duct-runs`.
  - The `heating-cooling` rows are `blower`, `package-unit`, `duct-runs`, `mini-split-heads`.
- Scene, in `system-parts.ts`: the `heating-cooling` entries run in the sales order. They are `package-unit`, `blower`, `furnace`, `coil`, `plenum`, `duct-runs`, `jacket`, `blanket`, `core`, `registers`, `thermostat`, `refrigerant-lines`, `condenser`, `mini-split-heads`, `mini-split-outdoor`. `air-handler` is gone.

- [ ] **Step 1: Write the failing checks.** Add a helper `scene(property, { scopes?, view?, weather?, materials? })`. It builds `TradeSceneInputs` from `HOME_SCENE_DEFAULTS` and calls `resolveScene(resolveInputsOf(selectResolveInputs(state)), resolveTradeBillCuts(), 2026)`.
  - **Today's parts.** Check the present ids of `hvac-attic` (`condition !== 'absent'`) for null, central furnace, central ac, central both, wall-mounted, portable, package-unit and mini-split. Each must match the inference rule above. Null equals central both.
  - **Parity of cuts.** Split replacement on null, and on central both: `savings.cuts.electric.combined` is `0.25` and `gas.combined` is `0.2`. Adding Air ducts: `0.2875` and `0.24`. Package replacement on package-unit: `0.25` and `0.2`.
  - **Added.** Split replacement on central furnace resolves `coil`, `refrigerant-lines` and `condenser` with `added: true`. `furnace` and `blower` have no `added`.
  - **Ducts.** `home.ducts` is undefined for wall-mounted, portable and mini-split. `hasDucts` of the resolved `hvac-attic` parts is false for those three and true for null, central and package-unit, in Today. In Build with Task 3's new-cut it turns true; until Task 3, check Build with split replacement on null (true).
  - **Hung copy.** The installed R-6 run's detail ends with `'supported the way code requires.'`. The existing R-6 run's detail does not.
- [ ] **Step 2: Run** the new check. Expected: FAIL.
- [ ] **Step 3: Implement** the core, then the scene, until `pnpm tsc` is clean.
  - The scene needs `PART_LABELS` entries for `blower` (`'Central system'`: the row also sells A/C only and new-cut, and "Indoor unit" is the glossary's word for the cabinet) and `mini-split-heads` (`'Mini-splits'`).
  - `HVAC_TYPE_LABELS` (in `home-scene-copy.ts`, `satisfies Record<HVACType, string>`, so `tsc` fails without it) gains `'mini-split': 'Mini-splits'`, and `portable` reads `'Window / portable'`.
  - `systems-at-spot.ts`'s equipment case becomes `isDuctedSystem(ctx.hvacType) ? ['heating-cooling'] : []`, exactly today's answer, and its `HOME_SCENE_DEFAULTS` import goes. Task 9 writes the new rule.
  - `buildChips.blower` is `{ add: 'New system', short: (label: string) => label }`, so a pick reads its own option name (Task 3 gives each job its own). `buildChips['mini-split-heads']` is `{ add: 'Mini-splits', short: () => 'Mini-splits' }`.
  - Add a `SCENE_CHANGE_WORDS` entry for every new slot id, with search words.
  - In `attic-ducts.tsx`, the central plenum box is tagged `systemPartTag('blower')` until Task 7 draws the components.
  - Task 7 adds registers and the thermostat tag. Until then, their rows are listed but drawn with no tag.
  - Every new heating & cooling id gets a resting point in `system-part-focus.ts` now, so no listed row is left without a pin:
    - `blower`, `furnace`, `coil` and `plenum` at `EQUIPMENT.plenum.position`;
    - `registers` at the living room's boot;
    - `thermostat` at `EQUIPMENT.thermostat.position`;
    - the two mini-split ids at the condenser's point.

    Tasks 9 and 11 move them.
- [ ] **Step 4: Run all checks.** Expected failures to rewrite in `verify-trade-scene.ts`:
  - Wall-mounted `assemblies['hvac-attic']` is no longer undefined. The new check: its `duct-runs` resolves `absent`.
  - The `ducted` loop (`${hvacType}: ducts`) reads `duct-runs` absent or not, in place of the assembly's presence.
  - `BUILD_SLOT_IDS` swaps `'build:air-handler'` for `'build:blower'`. No scope offers the mini-split row until Task 3, so it has no slot yet.
  - The `DrawingOnlyKey` list in `verify-trade-scene.ts` gains the four new facts.
  - In `verify-construction-model.ts`, `livingSpaceFacePart['hvac-attic']` becomes `'registers'`.
  - Then run `grep -rn "air-handler\|furnace-coil\|'high-efficiency'" src scripts`. Expected: no hits.
  - Then shoot wall-mounted, Partly open, against Task 0's baseline: no boots, collars or leaks appear.
- [ ] **Step 5: Commit** each touched file by path: `feat(construction): the indoor unit is its blower, furnace, coil and plenum, and every home has heating & cooling`.

### Task 3: Every HVAC build in the catalog, offered where it fits

**Files:**
- Modify: `core/constants/scope-ids.ts`, `scope-installs.ts`, `scope-not-drawn.ts`, `upgrade-registry.ts`; scene `constants/scope-verbs.ts`, `lib/upgrade-rows.ts`, `lib/upgrade-row-state.ts`, `lib/part-offers.ts` (`OfferBlockedReason`), `lib/keep-efficiency-upgrades.ts`, `constants/home-scene-copy.ts` (`verbs` gains the job names, `unitBlocked` removed)
- Test: `scripts/verify-heating-cooling.ts`, `scripts/verify-trade-scene-layout.ts`

**Interfaces:**
- `SCOPE_IDS` gains these keys:
  - `acReplacement: 'e450ca1b-548b-8269-adc7-019776a6acf7'`
  - `furnaceReplacement: '88d0ca1b-548b-82b2-bb26-017081659f61'`
  - `splitSystemNewCut: '8aa0ca1b-548b-82dd-9148-81d0b51076bf'`
  - `miniSplitInstallation: 'dcb0ca1b-548b-8303-9f65-01730423e685'`
  - `miniSplitKit: '3190ca1b-548b-805f-8d87-f51275832424'`

  All five leave `NOT_DRAWN`.
- `SCOPE_INSTALLS`, every entry `{ assembly: 'hvac-attic', trade: 'hvac' }`:
  - A/C replacement: `coil` high-efficiency-coil, `refrigerant-lines` copper, `condenser` high-seer. `filedUnder: 'blower'`, `onlyWhere: { has: ['coil'] }`.
  - Furnace replacement: `blower` new-blower, `furnace` high-efficiency-furnace. `onlyWhere: { has: ['furnace'] }`. On a home with A/C only it would add a part the home never had, so it is not offered there.
  - New-cut: `blower`, `furnace`, `coil` (all new), `plenum` sheet-metal, `duct-runs` r6-silver-flex with `swapsWith: { 'r8-ducts': 'r8-flex' }`, `registers` grille, `thermostat` thermostat, `refrigerant-lines` copper, `condenser` high-seer. `onlyWhere: { lacks: ['blower'] }`.
  - Mini-split installation and Kit: `mini-split-heads` wall-head, `mini-split-outdoor` mini-split-condenser. Both are drawn the same.
  - Air ducts replacement gains `onlyWhere: { has: ['duct-runs'] }`.
- `UPGRADE_REGISTRY` entries, each with `{ kind: 'warranty', ..., detail: 'The maker\'s warranty, plus the Tri Pros workmanship warranty.' }` and the split's `lasts-longer` entry:
  - **A/C replacement:** warranty `'Goodman condenser and coil'`; looks-and-use `'Steadier, quieter cooling'` / `'A new condenser and coil, matched to each other, cool the home on less electricity.'`
  - **Furnace replacement:** warranty `'Goodman furnace'`; looks-and-use `'Even, quiet heat'` / `'A new furnace and blower heat the home on less gas.'`
  - **Split system new-cut installation:** warranty `'Goodman system'`; looks-and-use `'Heating and cooling in every room'` / `'A whole new system, with its ducts, registers and thermostat, so every room gets heated and cooled air, not only the room with the old unit.'`
  - **Mini-split installation** and **Kit: mini-split**: warranty `'Mini-split system'`; looks-and-use `'Room by room comfort'` / `'A quiet unit high on the wall in each room, set to its own temperature, with no ducts.'`
  - **Split system replacement:** its looks-and-use detail becomes `'A new high-efficiency system, quieter in every room.'` It no longer claims both bills, since a furnace-only home's electric cut is 0. Savings speaks from the figures.
- Build-row options are labelled `SCOPES_AND_ADDONS_COPY.verbs[SCOPE_VERBS[id]]` (`scene-change-slots.ts`), so the central row would read Replace / Replace / Replace. `verbs` gains `wholeSystem: 'Whole system'`, `acOnly: 'A/C only'`, `furnaceOnly: 'Furnace only'`, `newSystem: 'New system'`, `installed: 'Installed'` and `kit: 'Kit'` (Task 12 adds `heatPump: 'Heat pump'`). `SCOPE_VERBS`: split replacement `wholeSystem`, A/C replacement `acOnly`, furnace replacement `furnaceOnly`, new-cut `newSystem`, Mini-split installation `installed`, Kit: mini-split `kit`.
- `upgradeRows` narrows each row to what fits this home, once: `offer: { ...offer, scopeIds: offer.scopeIds.filter(id => scopeFitsHome(SCOPE_INSTALLS[id]!, existingAssembly)) }`. Then `holdsR8`, `kinds` and `scopePick` see only this home's jobs: without it, new-cut (which swaps in R-8) is filed under `blower` on every home, so a central home's blower row would show a second R-8 switch and `heldBy` would take it. A row whose narrowed offer is empty and not blocked is dropped: that is the job `appliesTo` did for a wall home's duct row, which now resolves `absent` with nothing to offer.
- `keepEfficiencyUpgrades` keeps `r8-ducts` while any pick's installs `swapsWith` it (today only Air ducts), so New-cut's R-8 survives the next pick or a Today edit.
- `OfferBlockedReason` loses `'no-offer-for-unit'`. `upgradeRows` loses its `unitless` branch. `upgradeRowBlockedLine` loses its case, and the copy loses `unitBlocked`.

- [ ] **Step 1: Write the failing checks.** An offers table: for each home, the `heating-cooling` rows from `upgradeRows(facts, [], [])` as `{ part, scopeIds }`. The scope id names are as in `SCOPE_IDS`.
  - Central both: blower offers split, A/C and furnace replacement; duct-runs offers ducts; mini-split-heads offers both mini-split entries.
  - Central furnace: blower offers split and furnace replacement. Central ac: split and A/C replacement.
  - Null: as central both.
  - Wall-mounted, portable, mini-split: blower offers new-cut. No duct-runs row. Mini-splits are offered.
  - Package-unit: package-unit, duct-runs and mini-split-heads rows. No blower row.
  - Exclusion: `scopePick` of A/C replacement over a standing split replacement leaves only A/C replacement.
  - Today changed: `propertyPatch` to `{ hvacType: 'wall-mounted', hvacComponents: 'furnace' }` with split replacement and ducts picked drops both picks. The reverse, wall-mounted with new-cut picked → central, drops new-cut.
  - R-8: the wall home's blower row holds `r8-ducts` (`upgradeRowState(...).holdsR8`); central both's blower row does not, and its duct row does. New-cut with `efficiencyUpgrades: ['r8-ducts']` installs `r8-flex`.
  - R-8 kept: on a wall home, pick new-cut through `scopePick`, turn R-8 on, then pick Mini-split installation through `scopePick`, then change `hvacComponents` through `propertyPatch`. `efficiencyUpgrades` still holds `r8-ducts` after each. Unpicking new-cut drops it.
  - Labels: for every home in the offers table, no `build:*` slot from `sceneChangeSlots` lists two options with the same label.
  - Rows: no home has a row with empty `scopeIds` and `blocked === null`.
  - New-cut on a wall-mounted home in Build resolves `blower`, `furnace`, `coil`, `plenum`, `duct-runs`, `registers`, `refrigerant-lines` and `condenser` as installed and `added`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the data and the row changes.
- [ ] **Step 4: Run all checks, plus `pnpm tsx scripts/verify-scope-installs.ts`.**
  - Expected rewrite in `verify-trade-scene-layout.ts`: the `unitGroup` check now expects the wall home's rows to be `['blower', 'mini-split-heads']`, with no blocked row.
  - The `packageGroup` rows become `['package-unit', 'duct-runs', 'mini-split-heads']`.
  - `BUILD_SLOT_IDS` in `verify-trade-scene.ts` adds `'build:mini-split-heads'`, now that a scope offers it.
  - `verify-scope-installs` still reports the two heat pump scopes as in neither table. That is expected until Task 12: say so in your report, and never put them in `NOT_DRAWN`.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): A/C, furnace, new-cut and mini-split builds draw what they install and are offered where they fit`.

### Task 4: Cooling earns on the electric bill, heating on gas, and no bill rises

**Files:**
- Create: `src/shared/modules/construction/core/lib/bills-paid.ts`
- Modify: `src/features/trade-scenes/lib/scene-savings.ts`, `src/features/meeting-flow/constants/trade-outcomes.ts`, `src/features/landing/constants/trade-outcome-statements.ts`, `src/pain-points.ts`
- Test: `scripts/verify-heating-cooling.ts`

**Interfaces:**
- Consumes `PartMaterialFields.bills` (Task 1) and Task 2's `bills` on today's furnace, coil and condenser materials.
- Produces, in core beside `combineCuts` (spec §9 puts the rule in the shared model): `billsPaid(existing: readonly ResolvedPart[], assembly: Assembly): ReadonlySet<BillCategory> | null`. It is the union of `bills` over today's parts that are not `absent` and whose material declares `bills`; `null` when none declares any (every bill, as a package unit or another trade's assembly).
- `landed()` records, per category:
  - a base trade lands on `category` when the installed material's `bills` is unset or includes it;
  - an add-on (the ducts' 5%) lands on `category` when `billsPaid(existing, assembly)` is null or includes it (owner ruling R323: new ducts save only on a bill the home already pays that side on).
  
  `cutOf(category)` passes `combineCuts` only what landed on that category. "Earned" is per category, so a gas-only build leaves the electric figure whole, as the existing view does. `TRADE_BILL_CUTS` does not change.

- [ ] **Step 1: Write the failing checks.** A cuts table `[electric, gas]` from `savings.cuts.*.combined`:

  | Home | Build | Expected |
  |---|---|---|
  | central both | split replacement | 0.25, 0.2 |
  | central both | A/C replacement | 0.25, 0 |
  | central both | furnace replacement | 0, 0.2 |
  | central furnace | split replacement | 0, 0.2 |
  | central ac | split replacement | 0.25, 0 |
  | central both | split + ducts | 0.2875, 0.24 |
  | central furnace | split + ducts | 0, 0.24 |
  | central ac | split + ducts | 0.2875, 0 |
  | central both | A/C replacement + ducts | 0.2875, 0.05 |
  | central both | ducts alone | 0.05, 0.05 (as today) |
  | central furnace | ducts alone | 0, 0.05 |
  | wall-mounted | new-cut | 0, 0 |
  | wall-mounted | new-cut with `r8-ducts` | 0, 0 |
  | central both | mini-split installation | 0, 0 |
  | package-unit | package replacement | 0.25, 0.2 |
  | package-unit | package replacement + ducts | 0.2875, 0.24 |

  Plus these checks.
  - `billsPaid`: central both is `{electric, gas}`, central furnace `{gas}`, central ac `{electric}`, package-unit `null`.
  - Every `after` is at most its `bill` in every row: no bill shown going up.
  - The calculator's HVAC is a full system on a home with both sides. Run `projectRemodelRoi` itself for HVAC with ducts, with the inputs `verify-remodel-roi.ts` already uses, and check its electric and gas cuts equal the scene's central both split + ducts row. Calling `combineCuts` directly would not fail if the calculator's path drifted.
  - `TRADE_OUTCOMES.hvac` contains `'off the electric bill'` and not `'off cooling'`.
  - The HVAC entry's new `outcomeStatement` in `pain-points.ts` has no typed percent: it matches no `/\d+\s*%/` once the two helper calls are taken out of its source. (`verify-bill-cut-claims` does not read `pain-points.ts`, so its pass proves nothing there.)
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the savings change and the copy.
  - `trade-outcomes.ts` (`TRADE_OUTCOMES.hvac`): `` `Your system will be efficient, and our estimate from customer bills is ${formatRowClaim(tradeCutPercent('hvac', 'electric'))} off the electric bill and ${tradeCutPercent('hvac', 'gas')}% off gas.` ``
  - `trade-outcome-statements.ts` `hvac`: `` `A new high-efficiency system heats and cools the home more quietly, and our estimate from customer bills is ${formatRowClaim(tradeCutPercent('hvac', 'electric'))} off the electric bill and ${tradeCutPercent('hvac', 'gas')}% off gas.` ``
  - `pain-points.ts`, the HVAC entry's `outcomeStatement` (it holds `'40–60% more efficient'`): `` `A new high-efficiency system uses far less than one from 15 or 20 years ago. Our estimate from customer bills is ${formatRowClaim(tradeCutPercent('hvac', 'electric'))} off the electric bill and ${tradeCutPercent('hvac', 'gas')}% off gas, and the comfort difference shows right away.` `` Import the two helpers. Do not touch its `closeTrigger` (see Task 13).
- [ ] **Step 4: Run all checks.** Expected: `verify-bill-cut-claims` and `verify-remodel-roi` pass unchanged.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): cooling earns on the electric bill and heating on gas; comfort a home never had shows no saving`.

### Task 5: What the scene draws, from the resolved parts

**Files:**
- Create: `src/features/trade-scenes/lib/drawn-hvac.ts`, `src/features/trade-scenes/lib/indoor-location.ts`, `src/features/trade-scenes/constants/movable-indoor-unit-scopes.ts`, `src/features/trade-scenes/hooks/use-drawn-hvac.ts`
- Modify: `src/features/trade-scenes/lib/indoor-side.ts`, `lib/material-option-choices.ts`, `lib/has-ducts.ts` (Task 2's; `drawnHvac.ducts` reads it)
- Delete: `src/features/trade-scenes/lib/has-outdoor-unit.ts`. Its readers are `material-option-choices.ts` and `home-kit.tsx`. In `material-option-choices.ts`, `hasAcUnit` becomes `(isCentralSystem(t) && c !== 'furnace') || t === 'package-unit'` (its checks in `verify-trade-scene.ts` keep their expected values) and `showsEquipment` becomes `isCentralSystem(p.hvacType)`. `home-kit.tsx` reads `drawnHvac`.
- Test: `scripts/verify-heating-cooling.ts`

**Interfaces:**
- Produces `constants/movable-indoor-unit-scopes.ts`: `MOVABLE_INDOOR_UNIT_SCOPES: readonly ScopeId[] = [SCOPE_IDS.splitSystemReplacement]`, the shape of `R_VALUE_SCOPES`. Task 8 reads it and Task 12 adds the heat pump's.
- Produces, in `indoor-location.ts`, `atticHoldsUnit(form: RoofForm): boolean` (`form !== 'low-slope'`, redeck or not: a flat roof's joist space holds no indoor unit). Today's guess, the new-cut default, `moveToAtticOffered` and the location options all use it. Not `atticReachable`, which is true for a flat roof with a redeck.
- Produces `indoorLocation(materials: HomeMaterialFacts, form: RoofForm, view: 'existing' | 'proposed', picks: readonly string[], existingCentral: boolean): HvacIndoorLocation`.
  - Today: `materials.hvacIndoorLocation`, or `'attic'` where `atticHoldsUnit(form)` and `'closet'` otherwise. `'attic'` on a form that cannot hold it reads `'closet'`.
  - Build, when a movable replacement is picked and `proposedHvacIndoorLocation` is set: that location.
  - Build, when Today has no central and a scope that installs `blower` is picked: `'attic'` where `atticHoldsUnit(form)`, else `'closet'`.
  - A location with no placement (`garage` before 6-B) reads `'closet'`. The placements are Task 7's, so until then the placeable set is `['attic', 'closet']` in this file, and Task 7 swaps it for `INDOOR_UNIT_PLACEMENTS`' keys.
- Produces `interface HvacDuties { cools: boolean, heats: boolean }`. ("Sides" is the glossary's word for Today and Build.)
- Produces `interface DrawnHvac`:
  - `indoor: { location: HvacIndoorLocation, blower: PartState, furnace: PartState | null, coil: PartState | null } | null`
  - `vacated: HvacIndoorLocation | null`: in Build, where the unit stood before "Move to the attic" moved it. Task 7 draws that closet empty (spec §6.1).
  - `outdoor: (PartState & { kind: 'condenser' | 'heat-pump' }) | null`
  - `lineSet: boolean`
  - `packageUnit: PartState | null`
  - `ducts: PartState | null`
  - `registers: boolean`
  - `wallUnit: { kind: 'wall-furnace' | 'wall-unit', idle: boolean } | null`
  - `windowUnit: { idle: boolean } | null`
  - `miniSplit: { heads: number, idle: boolean, wear: number } | null`
  - `duties: HvacDuties`
- Produces `drawnHvac(parts: readonly ResolvedPart[], property: PropertyProfile, materials: HomeMaterialFacts, view: 'existing' | 'proposed', form: RoofForm, picks: readonly string[]): DrawnHvac`.
  - A part counts when it resolved with a non-null material.
  - Today's own non-central system (wall, window or mini-splits) is drawn from `property`, and is idle once the side on show has a blower.
  - The mini-split head count is `proposedMiniSplitHeads` when a mini-split scope is installed in Build, else `miniSplitHeads`, else 1.
  - `wallUnit.kind` is `'wall-furnace'` when components are `furnace`, and `'wall-unit'` otherwise.
  - `ducts` is set when `hasDucts(parts)`.
- `duties` is the union over running systems:
  - central: cools when coil and outdoor are drawn, heats when the furnace is drawn;
  - package: both;
  - wall furnace: heats;
  - wall unit: cools, and heats unless components are `ac`;
  - window: as today's `indoorSide` read it (components `furnace` → heats only, `ac` → cools only, else both);
  - mini-splits: both.
- `indoorSide(weather: Weather, duties: HvacDuties): 'heating' | 'cooling' | null` replaces the type-and-components signature. Move every caller.
- Produces `hooks/use-drawn-hvac.ts`: `useDrawnHvac(): DrawnHvac` for the side on show, from the scene targets and the store's `homeMaterials`, `view` and picks. The location and head counts are drawing-only facts that never reach the targets, so `home-kit.tsx` (Task 6) and the camera rig (Task 9) share this one hook rather than each computing it.

- [ ] **Step 1: Write the failing checks.** A table over resolved scenes, Today and Build:
  - Null: indoor attic with blower, furnace and coil; outdoor condenser; heats and cools.
  - Central furnace: no coil, no outdoor, heats only. With split replacement in Build: coil and condenser drawn, heats and cools.
  - Central ac: no furnace, cools only.
  - Wall-mounted furnace: wall furnace, not idle, heats only. With new-cut in Build: the wall furnace idle, indoor attic, heats and cools.
  - Wall-mounted furnace on a flat roof with new-cut: indoor closet.
  - Portable: window unit.
  - Mini-split with `miniSplitHeads: '3'`: three heads, heats and cools.
  - Central with a mini-split pick and `proposedMiniSplitHeads: '2'` in Build: indoor and two heads, neither idle.
  - Package: `packageUnit` set, `indoor` null.
  - Location: Today on a flat roof with `hvacIndoorLocation: 'attic'` → closet. `garage` → closet. `proposedHvacIndoorLocation: 'attic'` with split replacement picked on a closet home → attic in Build with `vacated: 'closet'`, and closet Today with `vacated: null`. The same with no pick → closet in Build, `vacated: null`.
  - `ducts`: null for wall-mounted, portable and mini-split Today; set in Build with new-cut.
  - `indoorSide` parity: for every old `(type, components)` pair and weather, the new `indoorSide(weather, drawnHvac(...).duties)` equals what today's `indoorSide(weather, type, components)` returned. No script checks `indoorSide` today, so write today's values into the table by running the old function before changing it.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** both libs, the constant and the hook, and move the `indoorSide` callers. `HomeEquipment` and `home-kit.tsx` keep drawing as today in this task. They only compute `side` from `drawnHvac`.
- [ ] **Step 4: Run all checks.** Expected: pass with no rewrites.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): one reading of what heating & cooling draws and runs, from the side on show`.

### Task 6: The house draws from `drawnHvac`, at parity

**Files:**
- Modify: `ui/components/home-kit/home-kit.tsx`, `home-equipment.tsx`, `attic-ducts.tsx`, `condenser-unit.tsx` (props only if needed)

**Interfaces:**
- Consumes `useDrawnHvac()` (Task 5), called once in `home-kit.tsx`. Its `ducts !== null` replaces Task 2's `ducted`.
- `HomeEquipment` props become `{ hvac: DrawnHvac, lowSlope, weather, load, meterSpeed, setpoint, burst, ducts, acScale, lit }`. `hvacType`, `hvacComponents`, `ductRuns`, `packageUnit` and `ducted` go. `AtticDucts` takes `ducts: PartState` and `indoor: boolean` in place of `material`, `wear` and `airHandler`.
- The condenser draws when `hvac.outdoor !== null`, with `hvac.outdoor.wear`. The wall and window units draw from `hvac.wallUnit` and `hvac.windowUnit`. A wall furnace draws with the wall unit's mesh until Task 10. Idle draws exactly as today; Task 10 makes it idle.

- [ ] **Step 1: Implement.** Rewire the components as above.
- [ ] **Step 2: Shoot Task 0's cases** with Task 0's probe. Expected: every shot matches its Task 0 baseline (taken before any task changed the drawing) except central furnace with split replacement in Build, which now shows the condenser (the old code drew none). Draw calls are within one of the baseline.
- [ ] **Step 3: Run all checks.** Commit the four component files by path: `refactor(trade-scenes): heating & cooling draws what the side on show resolves, so a build's new condenser shows`.

### Task 7: The indoor unit by component, in the attic or an HVAC closet

**Files:**
- Modify: `constants/home-geometry.ts` (`EQUIPMENT`), `ui/components/home-kit/attic-ducts.tsx`, `home-equipment.tsx`, `thermostat.tsx` (tag), `lib/indoor-location.ts`
- Create: `constants/indoor-unit-placements.ts` (the numbers), `lib/indoor-unit-placement.ts`, `lib/indoor-unit-boxes.ts`, `ui/components/home-kit/indoor-unit.tsx`, `ui/components/home-kit/hvac-closet.tsx`, `ui/components/home-kit/registers.tsx`
- Test: `scripts/verify-heating-cooling.ts`

**Interfaces:**
- A placement depends on the roof form as well as the location: today's plenum already moves with it (`attic-ducts.tsx`), and a flat roof's closet trunk joins the low-slope run start. So the numbers live in `constants/indoor-unit-placements.ts` as `INDOOR_UNIT_PLACEMENTS: Partial<Record<HvacIndoorLocation, Record<RoofForm, IndoorUnitPlacement>>>`, and `lib/indoor-unit-placement.ts` exports `indoorUnitPlacement(location: HvacIndoorLocation, form: RoofForm): IndoorUnitPlacement | null`, the shape of `packageUnitPlacement(lowSlope, scale)`. The attic entry holds no `low-slope` placement anyone reads (`atticHoldsUnit`); give it the pitched numbers.
- Produces:

```ts
export interface IndoorUnitPlacement {
  upright: boolean
  // The return end of the cabinet line: on the attic floor for a flat unit, on the closet floor for an upright one.
  base: Vec3
  // Unit vector from the return toward the plenum.
  toward: Vec3
  section: readonly [width: number, depth: number]
  lengths: Readonly<Record<'blower' | 'furnace' | 'coil' | 'plenum', number>>
  // From the coil's side to the condenser's pad.
  lineSet: readonly Vec3[]
  // The closet's walls and door; none in the attic.
  closet: readonly BoxSpec[]
  // Where the plenum's air meets today's duct runs, so the runs, boots and their checks do not move.
  trunk: readonly Vec3[]
}
export function indoorUnitBoxes(placement: IndoorUnitPlacement, has: { furnace: boolean, coil: boolean }): { id: 'blower' | 'furnace' | 'coil' | 'plenum', box: BoxSpec }[]
```

- Each location has one placement (`attic`, `closet`). 6-B adds `garage` and nothing else. The location menu (Task 8) offers this record's keys.
- A missing furnace or coil closes up, so the line stays return → blower → [furnace] → [coil] → plenum with no gap. The attic plenum stands where today's `EQUIPMENT.plenum` box stands. A closet's plenum rises through the ceiling, and a short trunk carries its air to today's plenum spot.
- `IndoorUnit` draws each section with seams between them, tagged `systemPartTag(<id>)`. The furnace takes today's heat glow (`useHeatGlow`), which leaves the plenum. `Registers` draws a grille on the room side of the ceiling under each boot, tagged `registers`. `Thermostat` is tagged `thermostat`. The line set is tagged `refrigerant-lines`.
- When `drawnHvac.vacated` is `'closet'`, `HvacCloset` draws the closet with no unit in it (spec §6.1: "the old location empty").

- [ ] **Step 1: Write the failing checks.**
  - The boxes for `{ furnace: true, coil: true }` are four, contiguous along `toward` (each box's far face is the next one's near face, within 1e-6).
  - `{ furnace: false, coil: true }` gives three boxes, and its plenum is nearer the base by `lengths.furnace`.
  - The attic plenum box's centre equals `EQUIPMENT.plenum.position` within 0.05.
  - The closet's walls stand inside the house footprint (`HOUSE`), against `BACK_INNER`, and overlap no `HOME_FURNITURE` footprint, no `FURNISHING_BOXES` box and not `EQUIPMENT.thermostat`.
  - `INDOOR_UNIT_PLACEMENTS.garage` is undefined.
  - `indoorUnitPlacement('closet', 'low-slope').trunk` ends at today's low-slope run start, and the pitched one at `EQUIPMENT.plenum.position`, each within 0.05.
  - `indoorLocation` now reads the placement keys.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** the placements (working numbers, comments say so) and the components.
  - On a flat roof, the closet's plenum enters the joist space, and the trunk joins today's low-slope run start.
  - The closet's spot is the back wall at the living/kitchen partition (`PARTITIONS_X[1]`). Its size and the cabinet proportions are set by screenshot.
- [ ] **Step 4: Shoot,** one case per run: null pitched (attic, Partly open and Complete); central with `hvacIndoorLocation: 'closet'` (Partly open: the closet and its upright unit read the way the rooms do); a flat roof central; central ac (blower and coil only); wall-mounted with new-cut in Build; a closet home with split replacement and "Move to the attic" on in Build (the closet empty); one raised and one slab home. Record the draw calls of the worst case against Task 0's baseline (record, do not stop).
- [ ] **Step 5: Run all checks.** Commit by path: `feat(trade-scenes): the indoor unit shows its blower, furnace, coil and plenum, flat in the attic or upright in an HVAC closet`.

### Task 8: Today's system, its location and the build's choices

**Files:**
- Create: `src/features/trade-scenes/lib/hvac-system-choice.ts`, `ui/components/controls/mini-split-head-count-choice.tsx`
- Modify: `lib/scene-change-slots.ts`, `constants/home-scene-copy.ts`, `constants/home-systems.ts` (`HVAC_SYSTEM_CHOICES`), `constants/home-profile-choices.ts`, `constants/scene-change-words.ts`, `types.ts` (`SceneChangeSlotId`), `lib/repairs-rows.ts`, `lib/indoor-location.ts`, `ui/components/controls/existing-chip.tsx`, `lib/work-details-kind.ts`, `ui/components/controls/work-details.tsx`, `ui/components/controls/system-card-body.tsx`, `ui/components/panel/part-list.tsx`
- Test: `scripts/verify-heating-cooling.ts`

**Interfaces:**
- Produces `HVAC_SYSTEM_CHOICES = ['central', 'package-unit', 'wall-furnace', 'wall-unit', 'portable', 'mini-split'] as const` and `type HvacSystemChoice`, the shape of the scene's other option sets. `home-scene-copy.ts` gains `HVAC_SYSTEM_CHOICE_LABELS` (`'Central'`, `'Package unit'`, `'Wall furnace'`, `'Wall unit'`, `'Window / portable'`, `'Mini-splits'`), `HVAC_INDOOR_LOCATION_LABELS` (`'Attic'`, `'HVAC closet'`, `'Garage'`) and `MINI_SPLIT_HEAD_COUNT_LABELS` (`'1 head'`, `'2 heads'`, `'3 heads'`), each `satisfies Record<…, string>`.
- `hvacSystemChoice(property): HvacSystemChoice | null`. Wall-mounted reads `'wall-furnace'` when components are `furnace`, else `'wall-unit'`. Null type reads null.
- `hvacSystemPatch(choice, property): Partial<PropertyProfile>`:
  - `wall-furnace` → `{ hvacType: 'wall-mounted', hvacComponents: 'furnace' }`
  - `wall-unit` → `{ hvacType: 'wall-mounted', hvacComponents: 'both' }`
  - `central` → `{ hvacType: 'central' }`, keeping today's components, so a home already set to furnace only stays furnace only
  - every other choice → `{ hvacType: <choice>, hvacComponents: null }`
- The `heating-cooling` existing slot uses these options. `repairs-rows.ts` labels the system with `HVAC_SYSTEM_CHOICE_LABELS[hvacSystemChoice(property)]`, so Repairs and the Today chip both say "Wall furnace".
- `HOME_PROFILE_CHOICES`' `hvacType` and `hvacComponents` entries have no readers (only `foundationType`, `householdType`, `ageGroup` and `yearBuilt` are read): delete them.
- New slots ride in the heating & cooling chip, as `ac-tons` does:
  - `'hvac-location'`: name `'Indoor unit location'`. Shown when `isCentralSystem`. Options are the keys of `INDOOR_UNIT_PLACEMENTS` that `atticHoldsUnit` allows. Its current value is `indoorLocation(...)` for Today. It writes `{ kind: 'fact', patch: { hvacIndoorLocation } }`.
  - `'mini-split-heads'`: name `'Mini-split heads'`. Shown when the type is `mini-split`. It writes `miniSplitHeads`.
  - `'move:indoor-unit'`: name `'Move to the attic'`, a two-way switch like `replace:fascia`. Unavailable unless a `MOVABLE_INDOOR_UNIT_SCOPES` scope is picked and `moveToAtticOffered`. On writes `{ kind: 'fact', patch: { proposedHvacIndoorLocation: 'attic' } }`, off writes null. It gets a `SCENE_CHANGE_WORDS` entry so Modify finds it.
- `moveToAtticOffered(materials: HomeMaterialFacts, form: RoofForm): boolean`, in `indoor-location.ts`: true when Today's location is not `attic` and `atticHoldsUnit(form)`.
- `WorkDetailsKind` gains `'indoor-unit'` (a picked scope in `MOVABLE_INDOOR_UNIT_SCOPES`) and `'mini-split'` (a pick that installs `mini-split-heads`). Picks go in the chip menu (owner ruling, memory `feedback-build-picks-inside-chip-menu.md`):
  - `'indoor-unit'` renders the `move:indoor-unit` slot as `<ProposedChip kind="toggle">`, as `system-card-body.tsx` renders `replace:fascia`. (`BuildToggle` is the Today ⇄ Build button and takes no props.) While the slot is unavailable the details render nothing, so an attic home's menu shows no empty section.
  - `'mini-split'` renders `MiniSplitHeadCountChoice`, a `ChoicePill` writing `proposedMiniSplitHeads` with a `fact` change, as `GutterColors` (`ui/components/panel/gutter-colors.tsx`) reads the store and applies one.
- `part-list.tsx` shows `'Added'` (`PART_COPY.added`) in place of the condition word when `part.added`, on every system (R324).

- [ ] **Step 1: Write the failing checks.**
  - `hvacSystemChoice` and `hvacSystemPatch` round-trip for all six choices. `hvacSystemPatch('central', { hvacType: null, hvacComponents: 'furnace', … })` keeps `'furnace'`.
  - `repairsRows` labels a wall furnace home's system `'Wall furnace'`.
  - The slots: a flat-roof central home's `hvac-location` options are `['closet']`. A pitched one's are `['attic', 'closet']`. A wall home has no `hvac-location` slot. A mini-split home has `mini-split-heads`.
  - `moveToAtticOffered`: a pitched closet home is true. A pitched attic home is false. A flat closet home is false, even with the roof redeck picked.
  - `move:indoor-unit` is unavailable with no pick, available on a pitched closet home with split replacement picked, and writes `proposedHvacIndoorLocation: 'attic'` when switched on.
  - `workDetailsKind(SCOPE_IDS.splitSystemReplacement) === 'indoor-unit'`, `workDetailsKind(SCOPE_IDS.miniSplitKit) === 'mini-split'`, `workDetailsKind(SCOPE_IDS.acReplacement) === null`.
  - `systemPartRows('heating-cooling', ...)` for a furnace-only home with split replacement has `added` on `coil`, `refrigerant-lines` and `condenser`. `systemPartRows('attic', ...)` with Radiant barrier on the default home has `added` on `radiant-barrier`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Shoot,** at the iPad size and at 390 px wide:
  - the heating & cooling card's Today chip menu (system, Indoor unit location, Equipment, AC size);
  - Build with split replacement and its menu open, showing the move switch;
  - Build with a mini-split pick and its heads;
  - the attic card's part list with Radiant barrier picked, reading "Added".

  Then run all checks.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): the rep sets today's system and where its indoor unit stands; a build can move it to the attic and set its mini-split heads`.

### Task 9: The camera, the spots and Look inside walk the system

**Files:**
- Modify: `constants/system-camera-views.ts`, `lib/systems-at-spot.ts`, `lib/spot-pin-point.ts`, `lib/keep-look-inside.ts`, `types.ts` (`HomeSpotContext`), `lib/system-part-focus.ts`, `lib/system-part-opacity.ts`, `constants/look-inside.ts`, `ui/components/home-kit/home-camera-rig.tsx`, `ui/components/home-kit/spot-pins-layer.tsx`
- Also modify: `lib/system-lit.ts`. Note where things live: `LookInsideView`, `LOOK_INSIDE_VIEWS`, `PART_LOOK_INSIDE_VIEWS` and `viewOf` are private to `constants/system-camera-views.ts`, and are edited there; only `PAIRED_EMPHASIS` goes in `constants/look-inside.ts`.
- Create: `lib/hvac-focus-of.ts` (`HvacFocus`, `hvacFocusOf`, named as `roof-form-of.ts` is), `lib/emphasized-parts.ts`
- Test: `scripts/verify-heating-cooling.ts`, `scripts/verify-trade-scene.ts`

**Interfaces:**
- Produces `type HvacFocus = { kind: 'indoor', location: HvacIndoorLocation } | { kind: 'package' } | { kind: 'mini-split-head' } | { kind: 'wall-unit' } | { kind: 'window-unit' }`.
- Produces `hvacFocusOf(drawn: DrawnHvac): HvacFocus`. The first match wins: a running indoor unit, a package unit, running mini-splits, a wall unit, a window unit.
- `HomeHvac` becomes `{ focus: HvacFocus, scale: number }`.
  - `SYSTEM_CAMERA_VIEWS['heating-cooling']` looks at the indoor unit's centre (`indoorUnitBoxes` of its placement) for `indoor`, with the lift for a closet (it rises with the house) and none for the attic's own target, which already sits on the house. Package is as today.
  - `mini-split-head` looks at the living-room head (Task 11's `MINI_SPLIT_HEADS[0]`; until Task 11, the living room's back wall at head height). `wall-unit` looks at `EQUIPMENT.wallUnit`, `window-unit` at `EQUIPMENT.windowUnit`.
- `LOOK_INSIDE_VIEWS` gains `'indoor-attic'` and `'indoor-closet'`, working numbers set by screenshot. `lookInsideView` picks by focus. `'condenser-pad'` survives only as the part look below.
- `LookInsideView.base?: 'condenser'`: the look is taken from the condenser's own system view (`viewOf(EQUIPMENT.condenser.position, shape, 0)`). `PART_LOOK_INSIDE_VIEWS` gains `condenser` and `refrigerant-lines`, built from today's `condenser-pad` numbers with `base: 'condenser'`.
- `HomeSpotContext` gains `hvacComponents: HVACComponent | null`.
  - `systemsAtSpot('roof', ctx)` returns `['roof', 'attic', 'heating-cooling']` when the form is `pitched` and the system is ducted (`isDuctedSystem(ctx.hvacType)`) or a pick installs `plenum`.
  - `'equipment'` returns `['heating-cooling']` when Today or a pick draws an outdoor unit: a package unit, mini-splits, central with components other than `furnace`, or a pick that installs `condenser` or `mini-split-outdoor`.
  - `canLookInside` asks every spot (`HOME_SPOT_IDS`), not only `SPOT_OF`'s.
- `spotPinPoint(system, form, hvacType, spot: HomeSpotId = 'equipment')`: at the roof spot, heating & cooling's pin stands over today's plenum spot (`EQUIPMENT.plenum.position`). Every home the roof spot offers it on sends its air into the attic there: an attic unit's plenum, a closet's trunk (Task 7) or a package unit's trunk. Not "over the attic indoor unit", which a closet home and a package-unit home do not have.
- `PAIRED_EMPHASIS = { coil: ['refrigerant-lines', 'condenser'] } as const satisfies Partial<Record<SystemPartId, readonly SystemPartId[]>>` in `look-inside.ts`. `emphasizedParts(emphasized: SystemPartId | null): ReadonlySet<SystemPartId>` returns the part plus its pairs. `systemLit` works the set out once per emphasis, and `systemPartOpacity` dims a part only when it is not in that set (not a new `Set` per tagged mesh).
- `systemPartFocus(..., location: HvacIndoorLocation = 'attic')`: `blower`, `furnace`, `coil` and `plenum` rest at their box centres for that location. `registers` rests at the living room's grille, `thermostat` at `EQUIPMENT.thermostat`.

- [ ] **Step 1: Write the failing checks.**
  - The `heating-cooling` view's target for null pitched is within 0.1 of the attic indoor unit's centre. For a closet home it is the closet unit's. For package-unit it is as today. For a wall home it is the wall unit.
  - `lookInsideView` for null pitched is not the old condenser-pad framing.
  - `partLookInsideView('heating-cooling', 'condenser', ...)` equals today's condenser-pad Look inside framing for that form (compute today's before the change and pin it).
  - Spots:
    - `systemsAtSpot('roof', { form: 'pitched', picks: [], hvacType: null, hvacComponents: null })` is `['roof', 'attic', 'heating-cooling']`.
    - Flat: `['roof']`.
    - Wall-mounted with no picks: `['roof', 'attic']`. With new-cut picked: the three.
    - `systemsAtSpot('equipment', ...)` for central furnace: `[]`. With split replacement picked: `['heating-cooling']`.
  - The roof pin of a closet home and of a pitched package-unit home stands over `EQUIPMENT.plenum.position`.
  - `emphasizedParts('coil')` has `coil`, `refrigerant-lines` and `condenser`.
  - The listed `heating-cooling` rows for null with split and ducts, in order: `blower`, `furnace`, `coil`, `plenum`, `duct-runs`, `registers`, `thermostat`, `refrigerant-lines`, `condenser` (pieces unlisted as today).
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** Move every `SYSTEM_CAMERA_VIEWS`, `lookInsideView` and `spotPinPoint` caller to the new `HomeHvac`. The camera rig reads `useDrawnHvac()` (Task 5): the location and head counts never reach its targets.
- [ ] **Step 4: Run all checks.** Expected rewrites in `verify-trade-scene.ts`:
  - `a pitched roof opens the attic` (`systemsAtSpot('roof', { form: 'pitched', … hvacType: null })`) now expects `['roof', 'attic', 'heating-cooling']`.
  - Every `HomeSpotContext` literal in the spot checks gains `hvacComponents: null`.
  - `heating & cooling looks at the condenser's pad`: it now looks at the attic indoor unit for central and unknown homes.
  - The camera loops that build `{ type, scale: 1 }` now build `{ focus: hvacFocusOf(...), scale: 1 }`.
  - The `stands over the condenser` pin check is kept for the equipment spot.
  - `canLookInside('heating-cooling', wall-mounted)` stays false with no picks.
  - Shoot: the system view and Look inside for null pitched, a closet home and a package unit. Tap the coil: the line set and condenser stay lit. Pick the condenser: the camera swings to its pad.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): heating & cooling opens on the indoor unit and walks it in the sales order; the roof spot offers it`.

### Task 10: Each component runs in its season, and an old unit stays idle

**Files:**
- Create: `src/features/trade-scenes/lib/hvac-running.ts`, `ui/components/home-kit/wall-furnace.tsx`
- Modify: `constants/home-geometry.ts` (`EQUIPMENT.wallFurnace`), `home-equipment.tsx`, `indoor-unit.tsx`, `wall-unit.tsx`, `window-unit.tsx`, `home-kit.tsx` (condenser load), `thermostat.tsx` (running state)
- Test: `scripts/verify-heating-cooling.ts`

**Interfaces:**
- The wall furnace gets its own place and look (spec §4, R308). Until now it borrowed the wall unit's mesh, which goes through the exterior back wall with a box outside (`EQUIPMENT.wallUnit.outside`). A wall furnace is heat-only, on an interior wall, with nothing outside. `EQUIPMENT.wallFurnace: { position: Vec3, size: Vec3 }` sets it flat against a room partition (`PARTITIONS_X`), low on the wall. `WallFurnace` draws a slim cabinet with a front grille, tagged as the wall unit is today. The furnace glow (`useHeatGlow`) shows on its grille when it runs. Working numbers by screenshot. `HvacFocus` gains `{ kind: 'wall-furnace' }`, and `SYSTEM_CAMERA_VIEWS['heating-cooling']` looks at `EQUIPMENT.wallFurnace` for it (Task 9 pointed every wall home at `EQUIPMENT.wallUnit`); add `constants/system-camera-views.ts` and `lib/hvac-focus-of.ts` to this task's edits.
- Produces `hvacRunning(drawn: DrawnHvac, weather: Weather): ReadonlySet<'blower' | 'furnace' | 'coil' | 'outdoor' | 'package' | 'wall-unit' | 'window-unit' | 'mini-split'>`. It follows the spec's table:
  - summer runs blower, coil and outdoor;
  - winter runs blower and furnace;
  - normal and rain run nothing;
  - an idle unit never runs;
  - a package unit, a wall unit or wall furnace, a window unit and mini-splits run in any season their duties allow.

  `outdoor` in winter is added by Task 12 for a heat pump.
- A running component takes the cooling or heating thermal tag and its cue: the furnace glows, the condenser spins on a burst, the thermostat shows running. A component not running takes the attic's or room's tag. An idle wall or window unit draws at load 0, with no glow, in Build.

- [ ] **Step 1: Write the failing checks.**
  - Null home: summer is `{blower, coil, outdoor}`, winter `{blower, furnace}`, normal `{}`.
  - Central furnace, summer: `{}`.
  - Wall furnace with new-cut in Build, winter: `{blower, furnace}`, with no `wall-unit`.
  - `EQUIPMENT.wallFurnace` stands inside the house, against a `PARTITIONS_X` plane within 0.05, and overlaps no `HOME_FURNITURE` footprint or `FURNISHING_BOXES` box.
  - The `heating-cooling` view of a wall furnace home looks at `EQUIPMENT.wallFurnace`; a wall unit home's still looks at `EQUIPMENT.wallUnit`.
  - Mini-split home, summer: `{mini-split}`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** and wire the cues.
- [ ] **Step 4: Shoot,** thermal on: null pitched in summer and in winter, and a wall furnace with new-cut in winter (Build: the old wall furnace on its interior wall, cold; the new furnace warm); a wall furnace home Today in winter (its grille warm). Then run all checks.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): each heating & cooling component runs in its own season; an old wall unit left after a new system stays off`.

### Task 11: Mini-splits drawn

**Files:**
- Modify: `constants/home-geometry.ts`, `lib/system-part-focus.ts`, `constants/system-camera-views.ts` (the head view's target)
- Create: `ui/components/home-kit/mini-split-heads.tsx`, `ui/components/home-kit/mini-split-outdoor.tsx`
- Test: `scripts/verify-heating-cooling.ts`

**Interfaces:**
- Produces `MINI_SPLIT_HEADS: readonly { room: keyof typeof ROOMS, position: Vec3, outward: 1 | -1 }[]`, ordered `living`, `bedroom`, `kitchen`. Each head is high on that room's exterior wall.
- Produces `MINI_SPLIT_OUTDOOR: { position: Vec3, size: Vec3 }`, on the ground in the left side yard, near the condenser's pad but clear of it.
- Produces, in `lib/mini-split-line-set.ts` (add it to Create), `miniSplitLineSet(heads: number): Vec3[][]`, one run from the outdoor unit along the outside wall to each head. Heads are tagged `mini-split-heads` and the outdoor unit and runs `mini-split-outdoor`. Their resting points are the first head and the outdoor unit.

- [ ] **Step 1: Write the failing checks.** Each head sits within 0.05 of its room's exterior wall plane and inside its room's `from`/`to` range. The outdoor box does not overlap the condenser's pad (`EQUIPMENT.condenser`) or the house. `miniSplitLineSet(2).length === 2`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** `HomeEquipment` draws `hvac.miniSplit`. The head look and the line path are set by screenshot.
- [ ] **Step 4: Shoot** a mini-split home with three heads (Today), and a central home with two added in Build, with the thermal lens on in summer. Record the draw calls. Then run all checks.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): mini-split heads in each room and one outdoor unit that serves them`.

### Task 12: The heat pump

**Files:**
- Modify: `core/types.ts` (`removes`), `core/lib/resolve-assembly.ts`, `core/constants/assemblies/hvac-attic.ts`, `scope-ids.ts`, `scope-installs.ts`, `upgrade-registry.ts`; scene `constants/scope-verbs.ts`, `lib/indoor-location.ts` (`MOVABLE_INDOOR_UNIT_SCOPES`), `lib/drawn-hvac.ts`, `lib/hvac-running.ts`, `ui/components/home-kit/condenser-unit.tsx` (heat pump look), `indoor-unit.tsx` (warm coil in winter)
- Test: `scripts/verify-heating-cooling.ts`

**Interfaces:**
- `PartMaterialFields.removes?: true`: the build takes the part out. `resolveAssembly` resolves such an install as `material: null, condition: 'installed'`, with the material's copy, and marks it `ResolvedPart.removed?: true`. `part-list.tsx` shows `'Taken out'` (`PART_COPY.removed`) in place of the condition word when `part.removed`, so the row never reads "Furnace taken out · New". Add `ui/components/panel/part-list.tsx` and `constants/home-scene-copy.ts` to this task's edits. Over a part the home does not have, the install is skipped, so the part stays absent and is never `added`.
- Materials:
  - `furnace` gains `removed`: `removes: true`, `'Furnace taken out'` / `'The heat pump heats the home, so the gas furnace, its flue and its gas line come out.'`.
  - `condenser` gains `heat-pump`: energy rank 1, `bills: ['electric']`, `'Heat pump outdoor unit'` / `'Heats and cools: the same refrigerant loop as air conditioning, run either way.'`.
- `SCOPE_IDS` gains `heatPumpReplacement: '4160ca1b-548b-819e-a910-ea397cc25800'` and `heatPumpNewCut: '4160ca1b-548b-81f1-84f9-d141be573ad1'`.
  - Heat pump replacement installs `blower` new-blower, `coil` high-efficiency-coil, `furnace` removed, `refrigerant-lines` copper, `condenser` heat-pump and `thermostat` thermostat, with `onlyWhere: { has: ['blower'] }`.
  - Heat pump new-cut installs as new-cut does, but with no furnace and with `condenser` heat-pump, and `onlyWhere: { lacks: ['blower'] }`.
  - `SCOPES_AND_ADDONS_COPY.verbs` gains `heatPump: 'Heat pump'`, and both entries use it in `SCOPE_VERBS` (`onlyWhere` never offers both on one home). Heat pump replacement joins `MOVABLE_INDOOR_UNIT_SCOPES`. Heat pump new-cut carries new-cut's `swapsWith` R-8, which Task 3's `keepEfficiencyUpgrades` rule already keeps.
- `UPGRADE_REGISTRY`, both entries (facts only: no savings, credit, rebate or code claim):
  - looks-and-use `'One outdoor unit heats and cools'` / `'The same refrigerant loop as air conditioning, run either way, so one unit warms the home in winter and cools it in summer, on electricity.'`
  - protection `'No flame in the house'` / `'No gas burner, flue or gas line at the indoor unit.'`
  - looks-and-use `'A rate plan for heat pump homes'` / `'With SCE, a home heated by a heat pump can move to TOU-D-PRIME, the rate plan made for it.'`
  - warranty `'Goodman heat pump'` / the shared warranty detail
- `drawnHvac`: `outdoor.kind` is `'heat-pump'` for that material, and a heat pump heats (`duties`). `hvacRunning`: winter runs blower, coil and outdoor for a heat pump. The coil reads warm in winter.

- [ ] **Step 1: Write the failing checks.**
  - Offers: central both's blower row adds heat pump replacement; a wall home's adds heat pump new-cut; package-unit has neither.
  - Exclusion: `scopePick` of heat pump replacement over split replacement leaves only the heat pump.
  - Build, central both + heat pump replacement: `furnace` resolves `material: null, condition: 'installed'`, label `'Furnace taken out'`, `removed: true`, no `added`; its part-list row reads `'Taken out'`.
  - Labels: no `build:*` slot on central both, wall-mounted or package-unit lists two options with the same label.
  - Central ac + heat pump replacement: `furnace` stays absent.
  - Cuts: central both + heat pump replacement is `[0.25, 0]`; central furnace + heat pump replacement is `[0, 0]`; wall + heat pump new-cut is `[0, 0]`.
  - `hvacRunning` in winter for the heat pump: `{blower, coil, outdoor}`.
  - No heat pump registry string matches `/tax credit|rebate|required|%/i`.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement.** The outdoor unit's look is the condenser's, with a difference the rep can see (set by screenshot).
- [ ] **Step 4: Run all checks, plus `pnpm tsx scripts/verify-scope-installs.ts`.** Expected: clean, with both heat pump scopes accounted for. Shoot heat pump replacement on a central home, Build, in summer and in winter, thermal on.
- [ ] **Step 5: Commit** by path: `feat(trade-scenes): a heat pump replaces the system or installs new, heats and cools from one outdoor unit, and claims no bill saving for its heating`.

### Task 13: Record and hand over

**Files:**
- Modify: `docs/plans/2026-10-16-trade-scenes-epic.md` (§2 "Heating & cooling" status and a §6 change-log line; edit with the Edit tool, other sessions' hunks untouched), `docs/superpowers/plans/2026-11-01-ts3b6b-garage-joins-the-house.md` (its R299 note, uncommitted, does not yet name them: edit it to say 6-B adds an `INDOOR_UNIT_PLACEMENTS.garage` entry per roof form, which the `hvac-location` options then offer, and nothing else)

- [ ] **Step 1:** Run all checks and `verify-scope-installs` one last time. Read `git log --oneline` for this plan's commits.
- [ ] **Step 2:** Update the tracker row's status to built, with the commit range, the draw-call record against the TS3b.6 budget, and "awaits the owner's look". Do not commit the tracker; leave it unstaged for the owner's session, as the other trackers are.
- [ ] **Step 3: Report to the owner,** with a table of clickable file links and these items for the look:
  - The working numbers set by eye: the closet's spot and size, the cabinet proportions, the wall furnace's spot and look, the line set path, the head look, and the camera looks.
  - The draft benefit copy, and the placeholder words: the build-row option names (Whole system, A/C only, Furnace only, New system, Heat pump, Installed, Kit), "Central system", "Indoor unit location" and "Taken out". Once the owner agrees "Taken out", record it in `CONTEXT.md` beside "Added" under Part condition.
  - "Added" now shows on every system (R324): point the owner at the roof and attic lists.
  - Confirm: a heat pump's cooling earns the A/C's 25% (spec §11).
  - My calls in this plan:
    - New-cut earns no cut on either bill, including its ducts: a whole-home system where one room had a unit is comfort, not a saving.
    - An old window unit and old mini-splits stay drawn and idle after a central install, as a wall unit does.
    - Heat pump replacement can move to the attic, as split replacement can.
    - The plenum stays at today's spot, with a trunk from a closet.
    - The SCE line names SCE, since homes on other utilities cannot use TOU-D-PRIME.
  - Flag once, unchanged:
    - `pain-points.ts`' HVAC `closeTrigger` still sells "the rebates active right now", but the research found the state money used up.
    - `BENEFIT_TEMPLATES['Financial Leak'].byTrade.HVAC` still says "cooling costs" for a whole-bill figure.
    - The customer profile's system field (`property-profile-fields.ts`) shows the new `mini-split` value as raw text, as it already does `wall-mounted`; the Property facts plan retires that field.
