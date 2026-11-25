# Trade scene gutters (none by default, a colour and a condition of their own) and black that reads black — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A rep can show "dirty off-white gutters, sagging and overflowing in the rain" and then "brand new black gutters". A home shows gutters only when the rep says it has them, and black (window frames, gutters, Night Sky and Midnight roofs) reads black, not brown.

| Part | Source | Tasks |
|---|---|---|
| The frame-cost baseline, before any change | Spec Constraints | 0 |
| Black reads brown; cool roof colours true to Owens Corning. **Then the owner looks.** | R285 | 1 |
| No gutters by default; a gutter condition of its own, which also decides the Gutters offer | Spec Q6, Q7 | 2 |
| Gutter colour, before and after; downspouts take it | Spec Q8 | 3 |
| Where they are picked (the Gutters chip, + Gutters details, Modify) | Spec Q9 | 4 |
| The condition's looks on the gable | Spec Q7 | 5 |
| Rain: a dripping seam, an overflowing gutter | Spec Q7 | 6 |
| Frame cost, shots, every verify script | Spec Constraints | 7 |

**Architecture:**
- **R285's root cause is the light, measured 2026-11-09.** Under Normal, a black frame (`#2b2b2c`) renders rgb(76, 58, 46). With only the lights set to white it renders rgb(79, 79, 81). The warm weathers' orange sun, warm bounce and brown ground fill tint every surface, and a dark neutral reads brown. Task 1 white-balances those lights: their colours move most of the way to neutral, and their intensities drop to keep the same brightness. The sky dome keeps its warm horizon, so the golden afternoon stays.
  - The Owens Corning hexes are already within 1 to 4 levels of OC's own swatch images. Night Sky and Midnight are neutral greys at the source. Task 1 still moves all 17 hexes to the linear-light mean, the method a flat-shaded roof needs, and names that method in the comment.
- **Owner ruling, 2026-11-10 (at the stress test), departing from the spec's first Constraints draft: the gutter condition `gutterWear` is a resolver input.** The card's part list ("Old gutters") and the up-close rain path both read the resolved gutter part, and the Gutters offer reads its wear.
  - It still moves no savings. The gutter is an edge part, which the water walk skips (`CORE/lib/relative-water-flow.ts:27`). Savings count materials, never a gutter's wear. Task 2 pins both with checks that run on a proposed home.
  - The colours (`existingGutterColor`, `proposedGutterColor`) are drawing-only, like the paint colours.
- **Owner ruling, 2026-11-10: the gutters' own condition decides whether + Gutters is offered.** Today `offeredScopes` blocks on the roof's wear. A Failing gutter on a new roof can be sold; a gutter set to New is not offered, even on a worn roof.
- **Owner ruling, 2026-11-10: a gutter at Good reads "Gutters" on the card,** since it draws clean. Only Fair and worse read "Old gutters". Good is `retained`, for the gutter alone.
- **One function decides the drawn gutter's wear: `drawnGutterWear(parts)`.** It returns `null` (no gutter), `'new'` (installed) or the kept part's wear. The roof drawing, the rain and the cutaway rain path all read it.
- **The looks live on the front run kept in every view** (`cutX` to the rake), so a partly-open home still shows them. The Complete front run gets streaks only. The wall's overflow stain joins the front wall's own stain list, so it fades with the wall. The flat roof takes the colour and the tone only (spec non-goal).
- **Draw cost, in draw calls:**
  - Each gutter group is its merged boxes, plus one `TintedMarks` mesh for all its streaks (Fair and worse). The kept group adds one `PaintStains` mesh for the fascia's overflow stain (Failing). The wall's stain costs nothing: it joins a list that already has a mesh.
  - At most +3 draws on a Failing gable. +0 at New and Good. A home with no gutters draws 2 fewer than the baseline. `PaintStains` stays mounted and hidden when empty, so count draws, never meshes in the tree.

**Tech Stack:** Next.js 15, React 19.2, `@react-three/fiber` 9.8.2, three 0.180, the zustand scene store, Radix RadioGroup through the shared shadcn wrappers, and Tailwind v4. Checks are the repo's `tsx` verify scripts (`node:assert/strict`), the Playwright probe against the owner's dev server, and screenshots.

**Spec:** `docs/superpowers/specs/2026-11-07-trade-scene-gutters-design.md` (owner, 2026-11-07, R284). R285 (owner, 2026-11-09) is in the tracker `docs/plans/2026-10-16-trade-scenes-epic.md`. The Owens Corning source table, with its URLs, is `.superpowers/sdd/2026-11-09-trade-scene-gutters/oc-swatches-report.md`.

## Global Constraints

- **Committing:**
  - Commit per task, only through `.superpowers/sdd/2026-11-06-trade-scene-colour-picking/commit-own.sh <message-file> <path>... [patch:<file>]`, by explicit paths.
  - For a file holding another session's hunks, snapshot your own hunks to a patch under `.superpowers/sdd/2026-11-09-trade-scene-gutters/foreign/` and pass `patch:<file>`.
  - `git show --stat HEAD` after each commit. The commit gets a 300000 ms timeout, and never `--no-verify`.
  - All the files this plan edits are LF. After any scripted edit, check `git diff --shortstat` still shows only your lines.
- **Forbidden git:** never `git add -A` or `.`, stash, reset, `checkout --`, restore, amend, merge, rebase or push. Never push `feat/trade-scenes-foundation`.
- **Never stage** `docs/**` or `CONTEXT.md`.
- **Never:** DB writes of any kind, or `pnpm build`.
- **Dev server:** never start, stop or restart it. :3002 is the owner's and serves this worktree only. Never `rm -rf .next`. If it doesn't answer (`ss -ltnp`), stop and ask.
- **The probes render in software (SwiftShader), and a multi-case sweep has crashed the owner's machine.** One scene case per process (`--only <case>`), each run under `flock .../.superpowers/heavy.lock`, never two at once. What a task's list leaves out, the owner checks on the device.
- **Signing in:** only via `/api/dev/playwright-session?…&as=info%40triprosremodeling.com`, never `role=`. Never print the secret.
- **Never add** a hook, `window` global or `data-` attribute to the app to reach the store: the probe reaches it through the React devtools hook.
- **Commands:**
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock env CI=1 pnpm eslint <files>`
  - `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-construction-model.ts`, `pnpm tsx scripts/verify-bill-cut-claims.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts`
- **Paths:** `F/` = `src/features/trade-scenes/` and `CORE/` = `src/shared/modules/construction/core/`. Build records go in `.superpowers/sdd/2026-11-09-trade-scene-gutters/` (gitignored).
- **Base:** `feat/trade-scenes-foundation` at `afeb0ae11` or later.
  - Another session may have uncommitted edits in this worktree (`F/constants/home-palette.ts` holds one in `feltAged`, clear of the lines Task 3 deletes). Never commit its hunks. Before Task 0, list `git status --short -- src scripts` in the ledger.
- **Code rules:**
  - Comments say why, never what, and never cite a plan, spec, task or Review Focus line.
  - One component per file, named exports. Constants go in `constants/`, pure helpers in `lib/`, three.js helpers in `ui/lib/`, and product data in `CORE/constants/`.
  - No defensive code for states the types rule out.
  - Callers pass memoized or module-level `BoxSpec` arrays to `MergedBoxes`, `TintedMarks` and `PaintStains`.
  - In code a gutter's condition is always `wear`, never `step` (the cutaway owns that word) or `condition` (the part's `retained | worn | absent | installed`).
- **Copy:**
  - Screen copy lives in `F/constants/home-scene-copy.ts`. The gutter colour names live in the CORE data.
  - Never "your", never solar, never "today" in code or test messages. Say existing and proposed.
  - British "colour" in copy, as the controls already write it.
  - The exact strings below are used verbatim.
- **Working numbers:** every hex and size this plan gives is a working number, settled by screenshot. Each one gets its constant's comment "A working number, set by shot." (or the file's existing equivalent).

## Review Focus

1. **A rep sets the gutter condition, then changes the roof's.** The gutter keeps its own condition (anti-goal), and + Gutters follows the gutter, not the roof. Test: Task 2.
2. **Gutters set to No gutters while a colour and a condition are still held.** Nothing draws, the chip shows "No gutters", the menu holds neither colours nor condition, and Modify lists no gutters condition. Test: Task 2 (resolve) and Task 4 (slots and the chip's text).
3. **The Gutters build with nothing picked on the proposed side, but an existing colour picked.** The new gutter draws the existing colour, never White. Test: Task 3.
4. **A Failing gutter on a partly-open home.** The pulled section, the sag and the fascia's stain sit on the kept run (every box at x ≥ `HOUSE.cutX`), so they never fade out with the Complete house. The wall's stain fades with the wall, because it is drawn with it. Test: Task 5.
5. **A flat roof with a Failing gutter.** It takes the colour and the tone only. Its downspouts still run in Rain, and it gets no sag, pulled section, streaks or stains. Test: Task 6 (`gutterFlow`) and Task 5 (no low-slope looks).

---

### Task 0: The frame-cost baseline

**Files:** none in `src/`. Records go in the workspace.

- [ ] **Step 1:** On the owner's server at the current head, before Task 1 touches anything, record the probe's `info()` plus the gutter mesh count for each home, one case per run:
  - gable, gutters not set (draws gutters at this commit);
  - gable, gutters `'present'`;
  - flat, gutters `'present'`.
- [ ] **Step 2:** Ledger: the head SHA and the three rows. Task 7 compares against these.

### Task 1: Black reads black; the cool roof colours are true to Owens Corning (R285)

**Files:**
- Modify: `F/constants/weather-skies.ts` (Normal and Summer: `sun`, `fill.ground`, `bounce`)
- Modify: `CORE/constants/owens-corning-shingles.ts`, `CORE/constants/standard-shingles.ts`
- Probe (gitignored, exists): `.superpowers/sdd/2026-11-06-trade-scene-colour-picking/shots/black-probe.mjs`

**Interfaces:** Produces nothing other tasks call.

- [ ] **Step 1: Record the before.** Run once per case, with the owner's server answering on :3002:
  `node .superpowers/sdd/2026-11-06-trade-scene-colour-picking/shots/black-probe.mjs --set black --size 1194x834 --scheme dark --tag r285-before --only <case>`, for `night-sky-normal`, `night-sky-summer` and `midnight-normal`.
  The `scene` row for `frame` under `night-sky-normal` should be about rgb(76, 58, 46). Copy the JSON's frame and covering rows to the ledger.
- [ ] **Step 2: Set the lights.** The sky dome, fog, ground and environment colours stay.

  | Weather | `sun.color` / `intensity` | `fill.ground` | `bounce.color` / `intensity` |
  |---|---|---|---|
  | normal | `'#ffe7ce'` / `3.3` | `'#9c8d80'` | `'#fdefde'` / `0.5` |
  | summer | `'#fff1dc'` / `5.5` | `'#cbbdaa'` | `'#ffe9d1'` / `1.7` |

  The intensities keep each light's luminance (its linear Y × intensity) where it was. Rewrite the file's head comment: the light is white-balanced, so a black part reads black and the warmth comes from the sky and the low sun.
- [ ] **Step 3: Measure.** Rerun the three cases with `--tag r285-after`. It passes when:
  - under all three, `frame` and `covering` have R − B ≤ 8 and B − R ≤ 4;
  - `frame`'s luminance (0.2126 R + 0.7152 G + 0.0722 B) is within 52–70 under Normal, and within 15% of its Step 1 value under Summer.

  Otherwise adjust the colours in Step 2's direction and record each try in the ledger.
- [ ] **Step 4: Re-source the shingle hexes.** Set each to OC's linear-light mean:
  - amber `#A9998C`, forest-brown `#6A5548`, mojave `#8F745B`, mountainside `#5E5F5D`, night-sky `#4B474A`, oyster-shell `#ACA7A1`, sand-castle `#90806E`, shasta-white `#B1B2AE`, sierra-gray `#999B98`, summerwood `#69635A`;
  - cliffside-gray `#818076`, copper-trail `#755E52`, golden-meadow `#A78C6C`, midnight `#605B5D`, mystic-gray `#777E7F`, prairie-wood `#856D58`, rolling-stone `#696362`.

  The comment becomes: `// Hex values are the linear-light mean of Owens Corning's own swatch images (what the eye sees from the street), so screen approximations only.`

  Each standard shingle keeps its cool twin's hex: dark-brown `#6A5548`, grey-brown `#69635A`, light-brown `#90806E`.

  Diff the 17 against `oc-swatches-report.md` with a one-off script in the workspace. Expected: no difference. Record it in the ledger.
- [ ] **Step 5: Check and commit.** Run the four verify scripts, `tsc`, and eslint on the touched files. Take a whole-home screenshot of the Existing 1998 home and of a Night Sky tear-off with black frames, under Normal and Summer, one per run, into the workspace's `shots/` for the owner.
  Commit: `fix(trade-scenes): the warm weathers' light is white-balanced, so black reads black; the Owens Corning colours are their swatches' linear-light mean`.
- [ ] **Step 6: OWNER GATE. Stop here (owner, 2026-11-10).** This light changes the look of every Normal and Summer scene. List the shots' paths for the owner and wait. Task 2 starts only once the owner has looked; any retune lands first.

### Task 2: No gutters by default, and a gutter condition of its own

**Files:**
- Modify: `CORE/types.ts` (`HomeMaterialFacts`), `CORE/constants/home-materials.ts` (`HOME_MATERIAL_FACTS_UNSET`)
- Modify: `CORE/lib/assemblies/roof-attic/infer-existing-conditions.ts:41`
- Modify: `F/types.ts` (`DrawingOnlyMaterialFact`, the `fact` change's patch keys at `:547`), `F/lib/scene-resolve-inputs.ts`
- Modify: `F/lib/part-offers.ts` (`partWear` and its call at `:176`), `F/lib/upgrade-rows.ts:57`
- Create: `CORE/constants/gutter-colors.ts`
- Test: `scripts/verify-trade-scene.ts`, `scripts/verify-trade-scene-layout.ts`, plus whichever verify fixtures assumed gutters by default (the scripts name them)

**Interfaces:**
- Produces:
  - `HomeMaterialFacts.gutterWear: Wear | null` (a resolver input; `null` follows the roof);
  - `HomeMaterialFacts.existingGutterColor: GutterColorId | null` and `HomeMaterialFacts.proposedGutterColor: GutterColorId | null` (both drawing-only);
  - `GUTTER_COLORS: readonly { id, name, hex }[]` (`as const`, the shape `ColorSwatches` takes and the shingle and paint lists use), and `GutterColorId` derived from it;
  - `{ kind: 'fact', patch }` accepts `gutterWear`;
  - `partWear(assemblyId, partId, home, existing: readonly ResolvedPart[]): Wear | null`.

- [ ] **Step 1: Write the failing checks** in `verify-trade-scene.ts`, beside the existing drawing-only block. Use the `at(...)` helper, a gable home, and `gutters` / `gutterWear` set through `homeMaterials: { ...HOME_MATERIAL_FACTS_UNSET, … }`. Let `gutterOf = scene => scene.assemblies['roof-attic']!.parts.find(part => part.id === 'gutter')!`.
  - `gutters: null` gives `condition === 'absent'` and `material === null` — "a home with gutters not set has none".
  - `gutters: null` and `gutters: 'none'` give deep-equal `savings` and deep-equal roof parts — "not set reads as no gutters".
  - `gutters: 'present'` with `wear: { roof: 'fair' }` gives `gutterOf(scene).wear === 'fair'` — "unset, the gutter follows the roof".
  - `gutters: 'present'`, `gutterWear: 'failing'`, `wear: { roof: 'good' }` gives `wear === 'failing'`, and still `'failing'` after the roof goes to `'new'` — "a set gutter keeps its condition when the roof's changes".
  - `gutterWear: 'new'` and `gutterWear: 'good'` each give `condition === 'retained'`; `gutterWear: 'fair'` gives `'worn'`. `gutterWear: null` with `wear: { roof: 'good' }` also gives `'retained'` — "a Good gutter reads as Gutters, whichever way it got there".
  - **On a proposed home in Rain** (`view: 'proposed'`, `weather: 'rain'`, `proposedScopeIds: [SCOPE_IDS.roofTearOff]`, `gutters: 'present'`): for every `w` in `wears`, `savings` and `leak` deep-equal those of `gutterWear: null`. The same with `cameraFocus: 'roof', lookInside: true` for `assemblies['roof-attic'].water` — "the gutter's condition moves no saving and no water".
  - With `[SCOPE_IDS.roofTearOff, SCOPE_IDS.gutters]`: `savings` deep-equal across `gutters: null` and `gutters: 'present'` at each wear. If they differ, stop and report: never weaken this one.
  - Proposed, `gutters: null`, `proposedScopeIds: [SCOPE_IDS.roofTearOff]` leaves the gutter absent — "a tear-off adds no gutters". With `[SCOPE_IDS.gutters]` its condition is `'installed'`.
  - Extend `DrawingOnlyKey` and the `drawingOnly` map (`:567`) with `existingGutterColor` and `proposedGutterColor`. Add a compile check that `'gutterWear' extends keyof SceneResolveInputs['homeMaterials']`.
  - Beside `WINDOW_FRAME_COLORS` in the core copy walk (`:1714`), push each `GUTTER_COLORS` name.

  In `verify-trade-scene-layout.ts`, beside `gutterRow` (`:295-297`):
  - `gutters: 'present'`, `gutterWear: 'failing'`, `wear: { roof: 'new' }`: the gutter row is not blocked, and `keepOffered` keeps a picked `SCOPE_IDS.gutters` — "failing gutters on a new roof can be sold".
  - `gutters: 'present'`, `gutterWear: 'new'`, `wear: { roof: 'worn' }`: blocked `'already-new'`.
  - `gutters: 'present'`, `gutterWear: null`, `wear: { roof: 'new' }`: blocked `'already-new'`, unchanged.
- [ ] **Step 2:** Run both scripts. Expected: FAIL at the first gutter check, or on compile.
- [ ] **Step 3: Implement.**
  - The inference, as a private `gutterPart(materials, home)` in the same file:
    - anything but `'present'` is absent;
    - otherwise take `drawnPart('aluminum', home, 'roof')`; if that is absent, return it;
    - the wear is `gutterWear ??` the drawn part's wear;
    - return `{ material: 'aluminum', condition: wear === 'new' || wear === 'good' ? 'retained' : 'worn', wear }`. Its comment says why Good is kept: a Good gutter draws clean, so the card must not call it old.
  - `GUTTER_COLORS`, with the comment that the hexes are screen approximations of the usual aluminum gutter colours, with no supplier chart yet:
    - `{ id: 'white', name: 'White', hex: '#f2f1ec' }`
    - `{ id: 'almond', name: 'Almond', hex: '#ece4d4' }`
    - `{ id: 'clay', name: 'Clay', hex: '#b5a68c' }`
    - `{ id: 'musket-brown', name: 'Musket Brown', hex: '#6e5d48' }`
    - `{ id: 'royal-brown', name: 'Royal Brown', hex: '#4b3527' }`
    - `{ id: 'dark-bronze', name: 'Dark Bronze', hex: '#3b332b' }`
    - `{ id: 'black', name: 'Black', hex: '#262728' }`
  - `partWear` takes the assembly's resolved parts. For the gutter it returns that part's own wear (`null` when absent), with the comment that the gutters carry a condition of their own, so the build is offered on it and not on the roof's. Every other part reads as it does now. Both callers pass the parts they already hold.
  - `HOME_MATERIAL_FACTS_UNSET` gains `gutterWear: null, existingGutterColor: null, proposedGutterColor: null`.
  - `selectResolveInputs` and `resolveInputsOf` carry `gutterWear`. Their comment still holds: only the drawing-only facts stay out.
- [ ] **Step 4:** Run all four verify scripts.
  - Where a fixture assumed gutters by default, set `gutters: 'present'` on it. Never weaken an assertion; record each fixture you change in the report.
  - Expected: four `ok` lines, plus `tsc` and eslint clean.
- [ ] **Step 5: Commit.** `feat(trade-scenes): a home has no gutters until the rep says it does, and its gutters take a condition of their own, which decides the Gutters offer`.

### Task 3: The gutter colour, existing and proposed; downspouts take it

**Files:**
- Create: `F/lib/gutter-hex.ts`, `F/ui/lib/gutter-look.ts`
- Modify: `F/lib/part-state.ts`, `F/constants/wear-looks.ts`, `F/types.ts`, `F/ui/components/home-kit/home-kit.tsx` (`:374`), `F/ui/components/home-kit/house-roof.tsx`, `F/ui/components/home-kit/gable-roof.tsx`, `F/ui/components/home-kit/low-slope-roof.tsx`, `F/constants/home-palette.ts` (delete `gutter` and `gutterWorn`, which have no other readers)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- Consumes: the Task 2 facts and `GUTTER_COLORS`.
- Produces:
  - `drawnGutterWear(parts: readonly ResolvedPart[]): Wear | null` in `F/lib/part-state.ts`: absent gives `null`, installed gives `'new'`, kept gives `part.wear ?? 'worn'`. It shares one `kept` predicate with `partState`;
  - `gutterHex(materials: Pick<HomeMaterialFacts, 'existingGutterColor' | 'proposedGutterColor'>, installed: boolean): string`;
  - `gutterLook(hex: string, wear: Wear): { color: string, roughness: number }`;
  - `type DrawnGutter = { wear: Wear, hex: string }` in `F/types.ts`. `GableRoof` and `LowSlopeRoof` take `gutter: DrawnGutter | null` in place of `gutter: PartState`;
  - `HouseRoof` takes `gutterHex: string`.

- [ ] **Step 1: Write the failing checks.**
  - **`drawnGutterWear`:**
    - absent part gives `null`;
    - installed gives `'new'`;
    - kept `'fair'` gives `'fair'`.
  - **`gutterHex`:**
    - existing side, nothing picked: the almond hex — "the existing gutter is Almond by default";
    - installed, nothing picked: the white hex;
    - installed, `existingGutterColor: 'clay'`, proposed `null`: the clay hex — "a build keeps the existing colour unless the rep picks one";
    - installed, proposed `'black'`: the black hex;
    - existing side with proposed `'black'` and existing `'clay'`: the clay hex.
  - **`gutterLook`:**
    - `gutterLook(<almond hex>, 'worn').color` is within 2 levels per channel of `#b9b1a3`, the worn gutter this replaces — "an unset worn gutter looks as it did";
    - `'new'` and `'good'` return the hex unchanged;
    - roughness rises from New to Failing.
- [ ] **Step 2:** Run the script. Expected: FAIL on the imports.
- [ ] **Step 3: Implement.**
  - **`WEAR_LOOKS.gutter`** in `F/constants/wear-looks.ts`. For now it holds `grime: '#6f675b'`, `grimeShare: 0.52` and `roughness: { new: 0.45, worn: 0.75 }`. Task 5 adds to it.
  - **`gutterLook`**, with `amount` being `0` at Good and `WEAR_AMOUNT[wear]` otherwise, so Good draws exactly as New:
    - colour: `wornColor(hex, grime, amount * grimeShare)`, the condenser's way of going toward a dirt colour by a share (`condenser-unit.tsx:53`);
    - roughness: `wornValue(roughness.new, roughness.worn, amount)`.
  - **`home-kit`** computes `gutterHex(homeMaterials, gutter part condition === 'installed')` and passes it to `HouseRoof`.
  - **`HouseRoof`** reads `drawnGutterWear(parts)` and passes `gutter={wear === null ? null : { wear, hex: gutterHex }}`.
  - **The gutter meshes** (gable runs, downspouts, the flat roof's `DRAINS`) draw `gutterLook`'s colour and roughness.
- [ ] **Step 4:** Run the verify scripts, `tsc` and eslint. Expected: all `ok`.
- [ ] **Step 5: Commit.** `feat(trade-scenes): gutters take a colour on the existing home and on the build, and the downspouts take it too`.

### Task 4: The pickers: the Gutters chip, + Gutters details, Modify

**Files:**
- Create: `F/ui/components/panel/wear-scale.tsx`, `F/ui/components/panel/gutter-wear-dots.tsx`, `F/ui/components/panel/gutter-colors.tsx`
- Modify: `F/ui/components/panel/wear-dots.tsx`, `F/ui/components/controls/existing-chip.tsx`, `F/ui/components/controls/system-card-body.tsx:52,70,158`, `F/lib/scene-change-slots.ts`, `F/types.ts` (`SceneChangeSlotId`), `F/constants/scene-change-words.ts`, `F/lib/work-details-kind.ts`, `F/ui/components/controls/work-details.tsx`, `F/constants/home-scene-copy.ts`
- Test: `scripts/verify-trade-scene.ts`, plus screenshots

**Interfaces:**
- `WearScale({ value, name, label, onPick, disabled = false, guessed = false }: { value: Wear | null, name: string, label: (wear: Wear) => string, onPick: (wear: Wear) => void, disabled?: boolean, guessed?: boolean })`.
  - Take it unchanged from `git show feat/scene-layout-lab:src/features/trade-scenes/ui/components/panel/wear-scale.tsx`, the same name, path and API, so the lab's merge finds it already there. `WearDots({ material, label })` becomes the same adapter over it that the lab's is.
  - The ring's dashed state stays `picked && guessed`, inside `WearScale`.
- `GutterWearDots({ slot }: { slot: SceneChangeSlot })`, the gutters' adapter over `WearScale`.
  - Value: `slot.current`. `guessed` is true while `gutterWear` is null. The bands are the roof's. `name` is `HOME_MATERIALS_COPY.gutters`.
  - `onPick` is `applyChange(slot.change(wear))`.
- `GutterColors({ side }: { side: 'existing' | 'proposed' })`: a caps label `${GUTTER_COLOR_COPY.label}${valueJoin}${name or GUTTER_COLOR_COPY.notPicked}` over `ColorSwatches` with `GUTTER_COLORS`, as `PaintColorList` does, because a swatch's `title` never shows on an iPad.
  - Existing: value `existingGutterColor`, writes it.
  - Proposed: value `proposedGutterColor ?? existingGutterColor`, writes `proposedGutterColor`.
- **A `'gutter-wear'` slot (owner, 2026-11-10), so the condition is findable in Modify.** `SceneChangeSlotId` gains `'gutter-wear'`. In `materialSlots`' roof case, right after `'gutters'`, and only while `homeMaterials.gutters === 'present'`: `existingSlot('gutter-wear', CONTROLS_COPY.modify.wearName(HOME_MATERIALS_COPY.gutters), optionsOf(wears, WEAR_LABELS), homeMaterials.gutterWear ?? wearInForce(material), value => ({ kind: 'fact', patch: { gutterWear: value as Wear } }))`. `SCENE_CHANGE_WORDS['gutter-wear']` is `'gutter gutters condition wear roof'`.
- **`ExistingChip` extended, no new chip.** The gutters slot is already its own, and this is the only way to keep its header, tone, dots wrapper and `data-existing-chip` in step.
  - `const gutterCondition = slot.id === 'gutters' ? riding('gutter-wear') : null`, the pattern `equipment` and `acTons` use. `const wear = rated?.wear ?? (gutterCondition?.current as Wear | null | undefined) ?? null` feeds the text, the tone and the Condition header.
  - Text: not set reads `GUTTER_LABELS.none` (`currentLabel`'s fallback, for this slot only), so the chip says "No gutters" while Modify keeps its "Missing" (owner, 2026-11-10). `'present'` reads `Gutters · <condition label>`.
  - Groups, only while `gutterCondition` exists: `{ id: 'colors', header: GUTTER_COLOR_COPY.header, body: <GutterColors side="existing" /> }`, then the condition group, whose wrapper already sets the `@container` and `mb-0` the dots need, holding `<GutterWearDots slot={gutterCondition} />`.
  - `staysOpenOn={value => slot.id === 'gutters' && value === 'present'}`, so picking Gutters shows the colours at once.
  - The `material` prop's comment becomes: null for gutters, whose Condition rides on a slot of its own.
- `WorkDetailsKind` gains `'gutter'` (install `part === 'gutter'`). `WorkDetails` renders `<div className={CONTROLS_CLASSES.detailsPiece}><GutterColors side="proposed" /></div>` for it, so the Build row panel and Modify both show it.
- `system-card-body`:
  - `details()` (`:52`) passes `upgrade={null}` for `'gutter'` as it does for `'vinyl-frame'`;
  - the panels' key (`:70`, and its twin at `:158`) becomes `` `details:${system}:${row.part}` ``, since a flat or wood shake roof now holds two panels. The part is stable, so Cool Life's scope swap still doesn't remount.
- Copy: `GUTTER_COLOR_COPY = { label: 'Gutter colour', header: 'Colour', notPicked: 'Not picked' } as const`. The condition header is `ExistingChip`'s own.

- [ ] **Step 1: Write the failing checks,** with `slotsOf` (`:2796`).
  - `workDetailsKind(SCOPE_IDS.gutters) === 'gutter'`.
  - `workDetailsKind(SCOPE_IDS.roofTearOff) === 'shingle'`, unchanged.
  - Gutters not set: no `'gutter-wear'` slot.
  - `gutters: 'none'` with `gutterWear: 'failing'` and a colour held: no `'gutter-wear'` slot.
  - `gutters: 'present'`, unset, roof `'fair'`: its `current` is `'fair'`.
  - `gutters: 'present'`, `gutterWear: 'failing'`, roof `'new'`: its `current` is `'failing'`, and `change('worn')` is `{ kind: 'fact', patch: { gutterWear: 'worn' } }`.
- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Check by screenshot and assertion.** Use a local Playwright script in the workspace's `shots/` (the colour-picking plan's `t5-walk.mjs` is the pattern), one run per viewport and scheme: 1194x834 dark, 1194x834 light, 390x844 dark, 390x844 light. The script throws on a mismatch, so a wrong chip fails the run:
  - gutters not set: `[data-existing-chip="gutters"]` reads "No gutters", and its menu has no colours group;
  - pick Gutters: the menu stays open with the colours, then the condition dots, dashed while following the roof;
  - pick Failing, then set the roof to New: the chip reads "Gutters · Failing", and + Gutters is still offered;
  - pick No gutters while Failing and a colour are held: the chip reads "No gutters", and the menu holds neither;
  - "+ Gutters" on: the details panel with the swatches and the picked name, last in the Build row;
  - a flat roof with Torch down and + Gutters both on: both panels show, with no duplicate-key warning in the console;
  - Modify, searching "gutters": the same swatches under the result, the condition row while present, "Missing" while not set.
- [ ] **Step 5:** Verify scripts, `tsc`, eslint. **Commit:** `feat(trade-scenes): the Gutters chip picks the gutters' colour and condition, Modify finds the condition, and a gutters build takes its new colour`.

### Task 5: The condition's looks on the gable

**Files:**
- Create: `F/lib/gable-gutter-boxes.ts`, `F/lib/gutter-marks.ts`
- Modify: `F/constants/wear-looks.ts`, `F/constants/home-geometry.ts` (`GUTTER_OUT`), `F/lib/cutaway-rain-path.ts` (its local `GUTTER_OUT` goes), `F/ui/components/home-kit/gable-roof.tsx`, `F/ui/components/home-kit/house-shell.tsx`, `F/ui/components/home-kit/home-kit.tsx`
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- `export const GUTTER_OUT = HOUSE.halfDepth + GUTTER_BACK + ROOF_TRIM.gutter.size / 2` in `home-geometry.ts`, replacing the formula in `gable-roof.tsx` (its `GUTTER` constant goes; height is `GUTTER_Y`, size `ROOF_TRIM.gutter.size`) and in `cutaway-rain-path.ts`.
- `gableGutterBoxes(wear: Wear): { kept: BoxSpec[], complete: BoxSpec[] }`.
  - `kept`: the back run, the front run from `HOUSE.cutX` to `ROOF_HALF_LENGTH`, and `downspoutBoxes('pitched')`.
  - `complete`: the front run from `-ROOF_HALF_LENGTH` to `HOUSE.cutX`.
- `gutterMarks(wear: Wear): { kept: TintedBoxes[], complete: TintedBoxes[], stains: StainBoxes[] }`. `stains` holds the fascia's overflow stain only.
- `gutterWallStains(wear: Wear): StainBoxes[]`, in the same file: the wall's overflow stain, built with `wallBox(FRONT_STAIN_WALL, …)` (`F/lib/wall-boxes.ts:15`) and clamped to the wall's run.
- `HouseShell` takes `gutterWallStains: readonly StainBoxes[]`, a memoized list from `home-kit` (empty on a flat roof or with no gutters), appended to `stains.front`. It sits under `skin.finish` inside `HOME_FADE_TAGS.complete`, where the wall's other stains are, because the front wall exists only in that group.
- `WEAR_LOOKS.gutter` gains:
  - `streaks: { color: '#4d463d', count: { new: 0, good: 0, fair: 3, worn: 8, failing: 12 }, width: 0.012 }`: thin boxes on each front run's outer face, full gutter height. Positions come from `seededRandom` (`F/lib/seeded-random.ts`) with one list of 12 sliced by count, so each step keeps the lighter step's streaks. Each streak takes its height and depth from the segment it lands on, so it stays on a sagged or pulled face;
  - `sag: { worn: 0.04, failing: 0.07 }`: the kept front run splits into three segments, the middle one lowered this far and the outer two tilted to meet it;
  - `pulled: { length: 1.2, drop: 0.18, out: 0.06, tilt: 0.2 }`: at Failing, the rake end of the kept front run hangs away from the fascia;
  - `overflow: { alpha: 0.6, width: 0.9 }`: `'streak'`-cell stains under the pulled section, one on the fascia's face and one on the wall's face, running down to the floor.

- [ ] **Step 1: Write the failing checks.**
  - New and Good give deep-equal boxes and marks; Good draws exactly as New.
  - New gives `kept.length === 2 + downspoutBoxes('pitched').length`, with `complete.length === 1`.
  - Worn's kept front run is 3 segments, and the middle one's `position[1]` is `GUTTER_Y - 0.04`.
  - Failing has a box whose top is at least `pulled.drop` below `GUTTER_Y`, and whose z is at least `pulled.out` past `GUTTER_OUT`.
  - Every sag and pulled box has `position[0] - size[0] / 2 >= HOUSE.cutX - 1e-6`.
  - Streak counts per step match `count`. At every step, each streak lies within the x range of a front-run segment and on that segment's outer face.
  - `stains` is empty below Failing and holds one list with 1 box at Failing. `gutterWallStains` likewise, and its box ends at or before the wall's end.
- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - `GableRoof` memoizes `gableGutterBoxes(gutter.wear)` and `gutterMarks(gutter.wear)` on `gutter?.wear`, with a null gutter drawing nothing.
  - The kept group draws `MergedBoxes` + `TintedMarks` (marks.kept) + `PaintStains` (marks.stains). The Complete group draws `MergedBoxes` + `TintedMarks` (marks.complete). Each sits inside its existing tags.
  - `LowSlopeRoof` gets none of this.
- [ ] **Step 4: Check by screenshot,** one case per run: the close-up front of the kept run at Worn and Failing in Almond under Normal, Failing in Black under Rain, and Failing on Partly open (the wall's stain gone with the wall, the fascia's still there). The rest are the owner's to check on the device. Record the draw calls per case.
- [ ] **Step 5:** Verify scripts, `tsc`, eslint. **Commit:** `feat(trade-scenes): an old gutter streaks, sags at Worn and pulls away from the fascia at Failing, staining the wall under it`.

### Task 6: Rain: a dripping seam, an overflowing gutter

**Files:**
- Create: `F/lib/gutter-flow.ts`
- Modify: `F/types.ts`, `F/ui/components/home-kit/home-rain.tsx`, `F/ui/components/home-kit/home-kit.tsx:349`, `F/lib/cutaway-rain-path.ts`, `F/constants/home-life.ts` (`HOME_RAIN`)
- Test: `scripts/verify-trade-scene.ts`

**Interfaces:**
- `type GutterFlow = 'none' | 'draining' | 'dripping' | 'overflowing'`, exported from `F/types.ts`.
- `gutterFlow(wear: Wear | null, lowSlope: boolean): GutterFlow`:
  - `null` gives `'none'`;
  - a flat roof gives `'draining'`;
  - Failing gives `'overflowing'`;
  - Worn gives `'dripping'`;
  - otherwise `'draining'`.
- `HomeRain` takes `flow: GutterFlow` in place of `gutters: boolean`, and `gutterTop: number` (`GUTTER_Y + homeLift(foundationType)`, because the rain sits outside the lifted house group):
  - `'draining'` and `'dripping'`: the downspouts run;
  - `'dripping'`: also a narrow field at the sag's middle, from `gutterTop` to the ground;
  - `'overflowing'`: no downspouts, and a field the width of the pulled section from `gutterTop` to the ground, at the gutter's front.
- `HOME_RAIN` gains `drip: { width: 0.06, intensity: 0.35 }` and `overflow: { intensity: 0.8 }`, beside `spout`.
- `cutawayRainPath`, pitched: with a gutter it goes into the gutter. It stops there unless `gutterFlow(drawnGutterWear(parts), false) === 'overflowing'`; then it falls through to the existing spill from the gutter point.

- [ ] **Step 1: Write the failing checks.**
  - `gutterFlow` over each case above: `null`, a flat roof at `'failing'`, `'failing'`, `'worn'`, `'good'`.
  - A Failing gutter's cutaway path ends past the gutter point by `CUTAWAY_FLOW.spill`. A Worn one ends at `[x, GUTTER_Y, GUTTER_OUT]`.
- [ ] **Step 2:** Run the script. Expected: FAIL.
- [ ] **Step 3: Implement** the interfaces.
- [ ] **Step 4: Check by screenshot** in Rain, one case per run: Worn (the seam drip), Failing (water over the front, no downspout stream, the field's top at the gutter on a raised home), then the up-close roof cutaway at Failing.
- [ ] **Step 5:** Verify scripts, `tsc`, eslint. **Commit:** `feat(trade-scenes): in the rain a worn gutter drips at its seam and a failing one spills over the front`.

### Task 7: Frame cost, the owner's shots, every check

**Files:** none in `src/` unless a check fails. Records go in the workspace.

- [ ] **Step 1: Frame cost.** On the owner's server at HEAD, one case per run, using the probe's `info()` plus a gutter mesh count, for these homes:
  - gable, gutters not set;
  - gable, gutters present at Good and at Failing;
  - flat, gutters present.

  Compare with Task 0's rows. Passes when not set draws fewer calls than the baseline's default, and Failing adds at most 3 draw calls over Good. Record both in the ledger.
- [ ] **Step 2: The owner's shots,** whole home and the close-up, at 1194x834, one per run. Skip any the machine can't take and say which:
  - existing Almond at Failing in Rain against the Gutters build in Black;
  - a Night Sky tear-off with black frames, under Normal;
  - the Existing and Build pickers.

  List the paths for the owner.
- [ ] **Step 3:** Run all four verify scripts, `tsc` and eslint on every file the plan touched. Then grep the diff's added lines for "your", "solar", "today", and for comments that cite a plan, task, spec or Review Focus. Expected: clean.
- [ ] **Step 4:** Ledger: `Task 7: complete`, the commit range, and the working numbers the owner still owes a look at (lights, gutter hexes, looks).
