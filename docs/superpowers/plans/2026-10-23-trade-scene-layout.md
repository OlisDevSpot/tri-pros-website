# Trade Scene Layout (Glass HUD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the trade scene's side panel into a presentation console. The 3D canvas fills the stage. The panel becomes a floating card driven by a top build switch. Scene controls are one-tap dock tiles with shortcut keys. Folding the card never resizes the canvas or moves the rep's camera.

**Architecture:** One phase (D26).
- **Pure pieces first.** The construction-core roof rule comes first, then the feature `lib/` mappers and writes, all checked by assertion scripts. The field primitives and the tab bodies follow, built unmounted.
- **Then the shell.** The canvas goes full size. The card, the knob and the build switch float over it, laid out by the stage's measured shape, and the old panel shell is deleted.
- **After the epic session's yes** (its TS3b.3 whole-branch review is done), the tasks that touch its files run. The shared `CameraRig` frames the **scene visible area** with `setViewOffset`, the overlays follow that area, the dock becomes the strip, and the framings are retuned by screenshot.

**Tech Stack:** Next.js 15, React 19, React Three Fiber 9 (`frameloop="demand"`), three.js `PerspectiveCamera.setViewOffset`, drei `OrbitControls`, `motion/react`, Tailwind v4, shadcn/Radix (`radio-group`, `accordion`, `toggle-group`, `input-group`, `dialog`), the shared `MoneyField` (react-number-format, from main).

**Spec:** `docs/superpowers/specs/2026-10-23-trade-scene-layout-design.md`. Read it with this plan; the decision IDs (D1–D28, C1–C11) and section numbers below are the spec's. Tracker: `docs/plans/2026-10-16-trade-scenes-epic.md` (R78–R83). Studies page (the visual floor, D28): https://claude.ai/artifact/SdisF1HyuQxzVModw4N2oP (Study B round 2, bar A).

**Paths:** `F/` = `src/features/trade-scenes/`, `CORE/` = `src/shared/modules/construction/core/`, `SDD/` = `.superpowers/sdd/2026-10-23-trade-scene-layout/` (gitignored). Every path is relative to the worktree `/home/olis-solutions/olis-v3/nextjs/tri-pros-website/.worktrees/trade-scenes`.

## Global Constraints

- **Sessions and branch.** Branch `feat/trade-scenes-foundation`, worktree above. **Another session (the epic session) works in the same tree.** Never revert, reformat or stage its edits. Resolve a conflict by reading its change.
- **Commits.**
  - Commit by explicit pathspec only, after `git diff --cached --name-only` shows exactly your files.
  - Run `git commit` with a 300 s timeout. No `git stash`, `reset`, `checkout --`, `--amend` or `push`.
  - Messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **The pre-commit hook checks the main checkout, not this worktree** (`.claude/settings.json:454` runs `cd` into the main repo before `tsc`, `lint` and `theme:check`).
  - Each task's own `pnpm tsc` and `pnpm lint`, run in the worktree, are the real gate.
  - If the hook blocks a commit, the error is in main's tree. Report it to the controller; never edit main's files from here.
- **Shared files: `git diff <file>` before staging.** If any hunk is not yours, stop and wait; never stage a file holding the other session's uncommitted hunks. The files:
  - `F/constants/home-scene-copy.ts`, `F/types.ts`;
  - every other `F/constants/*.ts` (the epic session's tuning may touch any of them);
  - `CONTEXT.md`, the tracker, `scripts/verify-trade-scene.ts`.

  In `home-scene-copy.ts` and `types.ts`, add new exports in one block at the end, and edit existing objects only where a task names the key.
- **Until the epic session's yes (before Task 14), never touch:**
  - `F/ui/components/dock/*` (existing files), `F/ui/components/home-kit/*`;
  - `F/ui/components/home-scene-canvas.tsx`, `F/ui/components/callout-pin.tsx`;
  - `F/constants/home-geometry.ts`, `F/constants/home-anchors.ts`;
  - `src/shared/components/scene/**`.
- **Off limits:** DAL, `src/trpc/`, `src/shared/db/`, seeds, entity services, and the construction module except the files Task 1 names.
- **Verifying.** Use `pnpm tsc` and `pnpm lint` only; never run `pnpm build`. Run the scripts as `pnpm tsx scripts/<name>.ts`.
- **Dev server and data.**
  - No DB writes. Playwright logs in through `/api/dev/playwright-session?secret=…&as=…`, never `role=`. Never print that URL.
  - The dev server is the owner's, on the worktree's `PORT=3002`. Ask before restarting it, clearing `.next` or running `pnpm install` under it.
- **Copy.** Every string goes in `F/constants/home-scene-copy.ts`; other constants files hold keys and measurements only. Copy never says "your" (except the recorded-basis title) and never mentions solar. Copy functions take string arguments only: the copy gate in `scripts/verify-trade-scene.ts` calls each one with plain-string samples.
- **Vocabulary (CONTEXT.md, D23, D27):**
  - use **build switch** (`BuildSwitch`), **Dock** (`SceneDock`), **knob** (`PanelKnob`), **scene visible area** (`SceneVisibleArea`) and **scopes and addons** (`ScopesAndAddons`, `ScopeOrAddonRow`);
  - in code, say **part** (never "layer"), **repairs** (never "upkeep") and **existing** (never "today");
  - never write "story", "story bar", "chapter", "lens strip", "receipt" or "inset" in a name. The one exception is the CSS `clip-path: inset()` function.
- **Tokens (C10).**
  - Colours come from tokens only. A picked tile is `bg-control-selected`; a picked pill keeps the segmented on state (`bg-tab-active`).
  - The check uses `toneClasses('success').text`; focus rings use `--ring`; the accent is `--presentation-accent`.
  - The card's inner clip sits on the stage's card rung (`bg-card`, a 1 px `border`; C8 as amended 2026-10-24).
- **Motion.** Animate only `transform`, `opacity` and `clip-path`. DOM motion uses `SCENE_MOTION.transition` through `motion/react`.
- **Code style.** Comments say why, never what. Follow the file's comment density, one component per file, named exports, no barrels. A context's consumer hook lives in the context file (as `scene-inputs-context.tsx` does).
- **Visual floor (D28).**
  - Playwright scripts and screenshots live in `SDD/`. The lab page is `/dashboard/labs/trade-scene`.
  - Every UI screenshot step also opens the matching reference shot in `SDD/studies/` (Task 0). A shot that reads less crisp than the study counts as a finding to fix before the task is done: spacing, type, edges, shadows or alignment.

## Review Focus

1. **The roof material changes after picks.** A shingle roof with Tear-off and Redeck picked is switched to Metal, to "Not sure" or to Wood shake. The picks the new roof cannot take must leave `proposedScopeIds` in the same write; a part the new roof still offers work on reads "No change", and a Metal or unset roof's parts show their blocked reasons instead (spec §6, amended 2026-10-24). Pinned in Task 3 (`propertyPatch`) and Task 11 (Playwright).
2. **The R3F aspect trap.** With the card open, the window is resized or the app nav folds. R3F resets `camera.aspect`, so the house must stay centred in the visible area, not in the canvas. Pinned in Task 14 (resize and nav-fold samples).
3. **Keys while typing or held.** Typing "1" in a bill field must not switch the weather. Holding `T` must toggle Thermal once. Pressing `\` after folding from the card's own button must still unfold. Pinned in Task 13.
4. **A narrow landscape stage.** An iPad at 1024 with the nav open leaves 768 px. The card must be 320 px with compact ends, and the card, build switch, dock and knob boxes must not overlap. The same check runs at 390×844. Pinned in Tasks 10, 11 and 18.
5. **The first tap after a fold or a close-up.** A tap on a tab while folded unfolds the card on that tab. A tap while up close leaves the close-up with the full reset `{ zoom: null, peel: 0, emphasizedPart: null }`. A tap on the open tab folds the card. Pinned in Task 10 (`pressPanelTab` table) and Task 11 (Playwright).

---

### Task 0: Merge main, and capture the studies reference (controller, not a subagent)

D24 needs the shared `MoneyField` and `react-number-format` from main. `CONTEXT.md` was committed (2eb52636a), so no file that is dirty in the tree is also changed on main. `git merge-tree --write-tree HEAD main` was clean on 2026-10-23.

- [ ] **Step 1:** Ask the owner to confirm with the epic session that a merge now is fine, and whether to run `pnpm install` under the live dev server or restart it afterwards. Do not merge without that yes.
- [ ] **Step 2:** Run `git status --short`, then `comm -12 <(git status --short | awk '{print $2}' | sort) <(git diff --name-only HEAD...main | sort)`. Expected: empty. Otherwise stop and ask.
- [ ] **Step 3:** `git merge main --no-edit` (300 s timeout). Expected: a merge commit, no conflicts.
- [ ] **Step 4:** Run `pnpm install --frozen-lockfile` (as the owner said), `pnpm tsc`, `pnpm lint`, `pnpm tsx scripts/verify-trade-scene.ts` and `pnpm tsx scripts/verify-construction-model.ts`. Expected: all pass, and `src/shared/components/ui/money-field.tsx` exists.
- [ ] **Step 5: The studies reference (D28).**
  - Read the studies artifact with the Artifact tool (`action: "read"`) and save its HTML to `SDD/studies/studies.html`.
  - With Playwright, open that file and capture Study B round 2, bar A at 1440×900, 1024×768, 820×1180 and 390×844, as `SDD/studies/ref-<w>x<h>.png`.
  - Extract its measurements (card radius, padding, type sizes and weights, edge and shadow, row gaps, the build switch's height and radius) into `SDD/studies/measurements.md`. Builders copy these numbers instead of guessing.

### Task 1: Which work each existing roof can take (construction core; the spec's "task 0")

**Files:**
- Create: `CORE/constants/scope-ids.ts`, `CORE/constants/scopes-by-existing-roof.ts`, `CORE/constants/roof-forms.ts`, `CORE/lib/redeck-allowed.ts`, `CORE/lib/roof-form-of.ts`
- Modify:
  - `CORE/constants/scope-installs.ts` (keyed by `[SCOPE_IDS.x]`, with no UUID literals left);
  - `CORE/types.ts` (`ExistingConditions.form: RoofForm | null`);
  - `CORE/lib/assemblies/roof-attic/infer-existing-conditions.ts:22` (uses `roofFormOf`).
- Test: `scripts/verify-construction-model.ts`. Add a new block before the final `console.log`. Its bare UUIDs at :148, :209–211, :397–400 and :454 become `SCOPE_IDS.*`.

**Interfaces:**
- Produces:
  - `SCOPE_IDS = { roofOverlay, roofTorchDown, roofTearOff, roofRedeck, roofTileReset, gutters, airSealing, atticInsulationReplacement, atticInsulationTopOff, radiantBarrier } as const`, with the UUIDs from today's `scope-installs.ts:20-29`, and `type ScopeId = typeof SCOPE_IDS[keyof typeof SCOPE_IDS]`. `SCOPE_INSTALLS` is rewritten with `[SCOPE_IDS.roofOverlay]: …` keys. The keys name the scopes, so the per-line name comments go.
  - `ROOF_FORMS = ['pitched', 'low-slope'] as const` and `type RoofForm`. This is the same union as the feature's `HOME_ROOF_FORMS`; Task 17 moves the feature onto it.
  - `roofFormOf(roofType: RoofType): RoofForm` and `roofFormOf(roofType: RoofType | null): RoofForm | null`, an overload pair: `flat` → `'low-slope'`, `null` → `null`, anything else → `'pitched'`.
  - `SCOPES_BY_EXISTING_ROOF: Record<RoofType, readonly ScopeId[]>`, covering and deck scopes only (C5):
    - `shingle`: overlay, tear-off, redeck;
    - `flat`: torch down, redeck;
    - `tile`: tile reset, redeck;
    - `woodshake`: tear-off, redeck;
    - `metal`: none.
  - `ROOF_OFF_SCOPE_IDS: readonly ScopeId[]` (tear-off, torch down, tile reset), exported beside that map.
  - `redeckAllowed(scopeIds: readonly string[]): boolean`: true when any of `ROOF_OFF_SCOPE_IDS` is among the picks (D18).

- [ ] **Step 1: Write the failing checks** in `verify-construction-model.ts`:

```ts
assert.deepEqual(Object.values(SCOPE_IDS).sort(), Object.keys(SCOPE_INSTALLS).sort(), 'every installed scope has a name, and every name an install')
const roofWork = Object.keys(SCOPE_INSTALLS).filter(id => SCOPE_INSTALLS[id]!.installs.some(install => install.part === 'covering' || install.part === 'deck'))
assert.deepEqual([...new Set(Object.values(SCOPES_BY_EXISTING_ROOF).flat())].sort(), roofWork.sort(), 'R81 lists exactly the covering and deck work')
assert.deepEqual(SCOPES_BY_EXISTING_ROOF, {
  shingle: [SCOPE_IDS.roofOverlay, SCOPE_IDS.roofTearOff, SCOPE_IDS.roofRedeck],
  flat: [SCOPE_IDS.roofTorchDown, SCOPE_IDS.roofRedeck],
  tile: [SCOPE_IDS.roofTileReset, SCOPE_IDS.roofRedeck],
  woodshake: [SCOPE_IDS.roofTearOff, SCOPE_IDS.roofRedeck],
  metal: [],
}, 'R81')
for (const [picks, allowed] of [[[], false], [[SCOPE_IDS.roofOverlay], false], [[SCOPE_IDS.roofTearOff], true], [[SCOPE_IDS.roofTorchDown], true], [[SCOPE_IDS.roofTileReset], true], [[SCOPE_IDS.gutters], false]] as const) {
  assert.equal(redeckAllowed(picks), allowed, `redeck with ${picks.join(',') || 'nothing'}`)
}
assert.equal(roofFormOf(null), null)
for (const roofType of roofTypes) {
  assert.equal(roofFormOf(roofType), roofType === 'flat' ? 'low-slope' : 'pitched', `${roofType}: form`)
  assert.equal(inferRoofAtticExistingConditions(profile({ roofType })).form, roofFormOf(roofType), `${roofType}: the inference uses roofFormOf`)
}
```

(`profile` is the script's existing helper at :103.)

- [ ] **Step 2:** `pnpm tsx scripts/verify-construction-model.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the five files, the `scope-installs.ts` rekey, the `types.ts` narrowing and the inference's `form:` line. Swap the script's bare UUID constants for `SCOPE_IDS.*`.
- [ ] **Step 4:** Run the script, `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsc` and `pnpm lint`. Expected: `✓ construction model`, the trade-scene script unchanged, and no errors.
- [ ] **Step 5: Commit**: `feat(construction): which roof work each existing roof can take, and when a redeck can go on`.
- [ ] **Step 6: Report** to the controller that `SCOPES_BY_EXISTING_ROOF`, `redeckAllowed`, `roofFormOf`, `RoofForm`, `ScopeId` and `SCOPE_IDS` exist (D19). The controller tells the owner to pass this to the epic session and to the energy-impact EI0 plan, whose `bill-cutting-scopes.ts` repeats bare scope UUIDs.

### Task 2: The rows and parts the tabs read

**Files:**
- Create:
  - `F/lib/repairs-figure.ts`, `F/lib/repairs-rows.ts`, `F/lib/part-offers.ts`;
  - `F/constants/repairs-row-labels.ts`, `F/constants/scope-verbs.ts`;
  - `scripts/verify-trade-scene-layout.ts`.
- Modify: `F/lib/scene-savings.ts:67-76` (uses `repairsFigure`), `F/constants/home-scene-copy.ts` (appends `REPAIRS_COPY`, `SCOPES_AND_ADDONS_COPY`, `PART_LABELS`)

**Why a new verify script:** `scripts/verify-trade-scene.ts` is shared with the epic session, and a file of this build's own keeps both sessions from staging the same file. The `SCOPE_VERBS` completeness check lives here rather than in `verify-construction-model.ts` (§5), because construction core must not import the feature.

**Interfaces:**
- Consumes: `SCOPE_IDS`, `ScopeId`, `SCOPES_BY_EXISTING_ROOF`, `redeckAllowed` (Task 1); `resolveAssembly` (`CORE/lib/resolve-assembly.ts:46`); `INFER_EXISTING_CONDITIONS` (`F/constants/existing-conditions.ts`).
- Produces:
  - `repairsFigure(trades: readonly TradeSlug[], overrides: TradeSceneInputs['repairsOverrides']): { byTrade: Partial<Record<TradeSlug, Resolved>>, monthly: number }`.
    - Each trade is `resolveOverridable(overrides[trade] ?? null, REPAIRS_PER_YEAR[trade] ?? 0)`, and `monthly = Math.round(sum / 12)`.
    - `sceneSavings` uses it for `repairsByTrade` and `repairsMonthly`, with output unchanged.
  - `REPAIRS_ROW_LABELS`, in row order:
    ```ts
    { 'roof-and-gutters': { label: 'roof', fact: 'roofType' },
      'windows-and-doors': { label: 'windows', fact: 'windowsType' },
      'exterior-paint-stucco-and-siding': { label: 'paint', fact: null },
      'hvac': { label: 'hvac', fact: 'hvacType' } }
    ```
    typed `satisfies Partial<Record<TradeSlug, { label: keyof typeof REPAIRS_COPY.rows, fact: 'roofType' | 'windowsType' | 'hvacType' | null }>>`.
  - `interface RepairsRow { trade: TradeSlug, working: number, label: string, note: string | null }` and `repairsRows(property: PropertyProfile): RepairsRow[]`.
    - The rows are the label map's trades whose `REPAIRS_PER_YEAR` figure is above 0.
    - `note` is the fact's label (`ROOF_TYPE_LABELS`, `WINDOWS_TYPE_LABELS` or `HVAC_TYPE_LABELS`). It is `REPAIRS_COPY.notSet` when the fact is null, and `null` when the trade has no fact (C4).
  - `interface PartOffer { partId: string, scopeIds: ScopeId[], dependsOnRoof: boolean }` and `partOffers(assemblyId: AssemblyId): PartOffer[]`.
    - Scopes are grouped by `SCOPE_INSTALLS[id].installs[0].part`.
    - Parts follow the assembly's own part order reversed, with `edge` parts moved to the end (C6). Parts with no scope are left out.
    - `dependsOnRoof` is true when any of the part's scopes appears in `SCOPES_BY_EXISTING_ROOF`. This replaces `scopeGroupsForAssembly`, which Task 8 deletes.
  - `existingParts(assemblyId: AssemblyId, property: PropertyProfile): ResolvedPart[]` = `resolveAssembly(ASSEMBLIES[id], { existing: INFER_EXISTING_CONDITIONS[id]!(property), proposedScopeIds: [], view: 'existing' }).parts`. This is the existing build's parts, which `useSceneTargets()` cannot give inside the build.
  - `type OfferBlockedReason = 'roof-not-set' | 'nothing-on-roof' | 'needs-tear-off' | 'base-included'`.
  - `offeredScopes(offer: PartOffer, ctx: { roofType: RoofType | null, picks: readonly string[], existing: readonly ResolvedPart[], assemblyId: AssemblyId }): { scopeIds: ScopeId[], blocked: OfferBlockedReason | null }`, decided in this order:
    1. A part with `dependsOnRoof` false offers all its scopes.
    2. `roofType` null → `roof-not-set`.
    3. The scopes ∩ `SCOPES_BY_EXISTING_ROOF[roofType]`; if empty → `nothing-on-roof`.
    4. The part is the `needsBase.part` of a picked covering's installed material, and the existing part's material is in `needsBase.replaces` → `base-included`.
    5. The part is `deck` and `!redeckAllowed(picks)` → `needs-tear-off`.
  - `baseIncludedLabel(assemblyId, picks): string | null`: the `needsBase.copy.label` that rule 4 found ("New solid decking, needed for the new roof", `CORE/constants/assemblies/roof-attic.ts:7`). It is read from the data, never hard-coded.
  - `keepOffered(picks: readonly string[], ctx: { roofType, existing, assemblyId }): string[]`. It drops every pick of a roof-dependent part that `offeredScopes`, given the picks as they stand, no longer offers. It repeats until nothing changes, so dropping a covering also drops a redeck.
  - `alsoNewLabels(assemblyId: AssemblyId, property: PropertyProfile, scopeId: ScopeId): string[]`.
    - It takes the labels of the parts whose condition is `installed` in `resolveAssembly(ASSEMBLIES[id], { existing: INFER_EXISTING_CONDITIONS[id]!(property), proposedScopeIds: [scopeId], view: 'proposed' })`.
    - It leaves out every part that has its own row in `partOffers(assemblyId)`, so the deck's base never repeats under the covering.
  - `SCOPE_VERBS: Record<ScopeId, keyof typeof SCOPES_AND_ADDONS_COPY.verbs>`:
    - overlay → `overlay`, torch down → `torchDown`, tear-off → `tearOff`, tile reset → `tileReset`, redeck → `redeck`;
    - gutters → `new`, air sealing → `seal`, insulation replacement → `replace`, top-off → `topOff`, radiant barrier → `add`.

    A missing verb is a `tsc` error.
  - Copy appended to `home-scene-copy.ts`. These are placeholders until the owner's copy pass (§10):
    ```ts
    export const REPAIRS_COPY = {
      rows: { roof: 'Roof', windows: 'Windows', paint: 'Exterior paint', hvac: 'Heating & cooling' },
      notSet: 'not set',
      perYear: '/yr',
      total: 'Running and keeping up this home today',
      perMonth: 'a month*',
      lead: 'The build\'s savings start from these.',
    } as const
    export const PART_LABELS: Record<string, string> = {
      'covering': 'Roof covering', 'deck': 'Deck', 'radiant-barrier': 'Radiant barrier',
      'attic-insulation': 'Attic insulation', 'air-sealing': 'Air sealing', 'gutter': 'Gutters',
    }
    export const SCOPES_AND_ADDONS_COPY = {
      noChange: 'No change',
      verbs: { overlay: 'Overlay', torchDown: 'Torch down', tearOff: 'Tear-off', tileReset: 'Tile reset', redeck: 'Redeck', add: 'Add', topOff: 'Top off', replace: 'Replace', seal: 'Seal', new: 'New' },
      coolRoof: '(cool roof)',
      alsoNew: (list: string) => `Also new: ${list}`,
      blocked: { 'roof-not-set': 'Set the roof material under Today › Home', 'nothing-on-roof': 'Nothing offered on a metal roof yet', 'needs-tear-off': 'Needs a tear-off: an overlay keeps the old roof on' },
      notSet: 'Not set',
    } as const
    ```
    `alsoNew` takes the already-joined list, because the copy gate calls every copy function with plain strings.

- [ ] **Step 1: Write the failing checks** in `scripts/verify-trade-scene-layout.ts`. Add a `profile(patch)` helper, `{ ...HOME_SCENE_DEFAULTS.property, roofType: null, …, ...patch }` (as `verify-trade-scene.ts:107` builds one), plus one assertion per line below:
  - **Part order.** `partOffers('roof-attic').map(p => p.partId)` deep-equals `['covering', 'deck', 'radiant-barrier', 'attic-insulation', 'air-sealing', 'gutter']`. Only covering and deck have `dependsOnRoof`. Every part id has a `PART_LABELS` entry.
  - **Each roof type with no picks.** For each `roofType` in `PROFILE_ROOF_TYPES`:
    - the covering offers exactly the R81 covering scope(s), and blocks with `nothing-on-roof` on metal;
    - the deck offers nothing and blocks with `needs-tear-off` (`nothing-on-roof` on metal).
  - **No roof type.** With `roofType: null`, the covering and the deck block with `roof-not-set`. The attic insulation still offers replacement and top-off (C5), on metal as well.
  - **The deck follows the covering.** On shingle with picks `[tearOff]`, the deck offers `[redeck]`; with `[overlay]` it blocks with `needs-tear-off`.
  - **The deck's base.** On wood shake with picks `[tearOff]`, the deck blocks with `base-included`, and `baseIncludedLabel` equals the roof-attic covering's `needsBase.copy.label`.
  - **`keepOffered`.**
    - `keepOffered([tearOff, redeck, gutters], shingle)` returns all three.
    - `keepOffered([overlay, redeck], shingle)` returns `[overlay]`.
    - After a switch to metal, `keepOffered([tearOff, redeck, radiantBarrier])` returns `[radiantBarrier]`. With `roofType: null` it also returns `[radiantBarrier]`.
  - **`alsoNewLabels`.** A tear-off on shingle lists the underlayment and lists neither the covering nor the deck.
  - **Verbs.** Every key of `SCOPE_INSTALLS` has a `SCOPE_VERBS` entry.
  - **`repairsRows`.**
    - `repairsRows(profile({}))` gives trades `['roof-and-gutters', 'windows-and-doors', 'exterior-paint-stucco-and-siding', 'hvac']`, with working figures `[400, 200, 150, 600]`. The hvac note is `'not set'`; the paint note is `null`.
    - Every trade with `REPAIRS_PER_YEAR > 0` has a `REPAIRS_ROW_LABELS` entry, so a new working number cannot drop out silently.
  - **`repairsFigure`.** `repairsFigure(['roof-and-gutters'], { 'roof-and-gutters': 600 }).monthly === 50`, and `monthly` equals `sceneSavings`'s `repairsMonthly` for the same trades and overrides.
  - The script ends with `console.log('✓ trade scene layout')`.
- [ ] **Step 2:** `pnpm tsx scripts/verify-trade-scene-layout.ts`. Expected: FAIL (module not found).
- [ ] **Step 3: Implement** the files, then the `scene-savings.ts` swap.
- [ ] **Step 4:** Run both trade-scene scripts, `pnpm tsc` and `pnpm lint`. Expected: both scripts pass; the copy gate walks the new objects.
- [ ] **Step 5: Commit** (shared-file rule): `feat(trade-scenes): the rows and parts the new tabs read, from the home's profile and the roof it has`.

### Task 3: The two writes the tabs make

**Files:**
- Create: `F/lib/property-patch.ts`, `F/lib/scope-pick.ts`
- Modify: `scripts/verify-trade-scene-layout.ts`

**Interfaces:**
- Consumes: Task 2's `keepOffered`, `existingParts`, `offeredScopes`, `PartOffer`; `scopePreviewPatch` (`F/lib/scope-preview-patch.ts`); `offersCoolRoof` (`F/lib/scope-chip-options.ts`); `HOME_PRIMARY_ASSEMBLY`.
- Produces:
  - `propertyPatch(state: Pick<TradeSceneInputs, 'property' | 'proposedScopeIds'>, patch: Partial<PropertyProfile>): Pick<TradeSceneInputs, 'property'> & Partial<Pick<TradeSceneInputs, 'proposedScopeIds'>>`.
    - It merges the patch into `property`.
    - When `roofType` is in the patch, it also returns `proposedScopeIds: keepOffered(state.proposedScopeIds, { roofType, existing: existingParts(HOME_PRIMARY_ASSEMBLY, nextProperty), assemblyId: HOME_PRIMARY_ASSEMBLY })`, built from the **next** property (Review Focus 1).
  - `scopePick(state: TradeSceneInputs, offer: PartOffer, picked: ScopeId | null): Partial<TradeSceneInputs>`, one write for a row's single choice:
    - The group is all roof-dependent parts' scopes when `offer.dependsOnRoof`, else the offer's own scopes.
    - Within the group, take the current picks, remove this part's scopes, add `picked`, then apply `keepOffered`. Pass the result to `scopePreviewPatch(state, group, next, state.coolRoofSettled)`, with `settlesCoolRoof` folded in exactly as `scope-chips.tsx:32-36` does.
    - So Overlay drops a picked redeck in the same patch (D18), and "No change" (`picked: null`) on the covering drops the redeck too.

- [ ] **Step 1: Write the failing checks:**
  - **`propertyPatch`, from shingle with picks `[tearOff, redeck, radiantBarrier]`:**
    - to metal → `[radiantBarrier]`;
    - to `null` → `[radiantBarrier]`;
    - to woodshake → `[tearOff, radiantBarrier]` (the deck becomes `base-included`, so the redeck goes);
    - a patch with no `roofType` returns no `proposedScopeIds`.
  - **`propertyPatch`, flat → pitched:** from flat with `[torchDown, redeck]`, a patch to shingle → `[]`.
  - **`scopePick`, on shingle:**
    - Tear-off, then Redeck, then Overlay leaves `proposedScopeIds` holding overlay alone;
    - `picked: null` on the covering after Tear-off + Redeck → `[]`;
    - the first covering pick sets `coolRoofSettled` and adds the cool-roof add-on as today's chips do (D22);
    - picking Top off after Replace on the attic insulation keeps only Top off.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3: Implement.** **Step 4:** Run the script, then `pnpm tsc` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(trade-scenes): one write for a roof change and one for a pick, each dropping the work the roof can no longer take`.

### Task 4: One key guard for the meeting flow and the scene

**Files:**
- Create:
  - `src/shared/constants/typing-target-selector.ts`, moved from `src/features/meeting-flow/constants/keyboard-hints.ts:22-44`. Its comment is reworded so it no longer names the flow map.
  - `src/shared/lib/is-unclaimed-key.ts`.
- Modify: `src/features/meeting-flow/constants/keyboard-hints.ts` (selector removed), `src/features/meeting-flow/hooks/use-meeting-flow-keys.ts:44-64` (calls the guard)

**Interfaces:**
- Produces: `isUnclaimedKey(event: KeyboardEvent, root: Element | null): boolean`. It is false when any of these holds:
  - `defaultPrevented`;
  - `isComposing`, or `keyCode === 229`;
  - Meta, Ctrl or Alt is held;
  - `root` is null, or the target is not an `Element`;
  - the target is outside `root` and is not `document.body`;
  - the target matches `TYPING_TARGET_SELECTOR`, or is `isContentEditable`.

  `event.repeat` and Escape stay with each caller, because the meeting flow repeats some keys on purpose. Callers listen on `window` in the bubble phase, so `defaultPrevented` means React or Radix already used the key. The query toolbar's own `isTypingTarget` stays as it is (outside the spec, §10).

- [ ] **Step 1:** `grep -rn "TYPING_TARGET_SELECTOR" src`. Expected: only the two meeting-flow files.
- [ ] **Step 2: Implement** the move and the guard. The meeting-flow hook replaces its five guards with `if (!isUnclaimedKey(event, rootRef.current)) return`, and its behaviour is unchanged.
- [ ] **Step 3:** `pnpm tsc`, `pnpm lint`. Then rerun the grep. Expected: no hit under `src/features/meeting-flow/constants/`.
- [ ] **Step 4: Commit** the four files: `refactor(keys): the meeting flow's key guard moves to shared, for the trade scene to reuse`.

### Task 5: The field primitives (D8, D9)

**Files:**
- Create:
  - `F/ui/components/fields/scale-field.tsx`, `tray-group.tsx`, `tray-field.tsx`, `not-sure-link.tsx`, `field-label-row.tsx`;
  - `F/ui/components/fields/glyphs/roof-glyph.tsx`, `hvac-glyph.tsx`, `household-glyph.tsx`;
  - `F/contexts/tray-group-context.tsx`, `F/constants/field-glyphs.ts` (SVG path data).
- Modify:
  - `F/ui/components/panel/segmented-field.tsx` (gains a slim size and a label action, and uses `FieldLabelRow`);
  - `F/types.ts` (appends `ChoiceFieldProps`);
  - `F/constants/home-scene-copy.ts` (`PROFILE_COPY.unknown` becomes `'Not sure'`; its only reader is `home-profile-choices.ts`).

**Interfaces:**
- Consumes: `ProfileChoices<T>`, `UNKNOWN_CHOICE` (`F/lib/profile-choice.ts`, `F/constants/scene-controls.ts:16`), `HOME_PROFILE_CHOICES`; the measurements in `SDD/studies/measurements.md`.
- Produces, with one shared prop shape so `{...HOME_PROFILE_CHOICES.x}` spreads straight in:
  ```ts
  interface ChoiceFieldProps<T extends string> {
    label: string
    value: T                      // T includes UNKNOWN_CHOICE when the field offers "Not sure"
    options: readonly T[]
    labels: Record<T, string>
    onChange: (next: T) => void
  }
  ```
  - `ScaleField<T>(props: ChoiceFieldProps<T>)`, built on `ui/radio-group` so arrow keys rove:
    - the track has one stop per option except `UNKNOWN_CHOICE`;
    - the end labels under it are the first and last options' labels;
    - the chosen stop is large, the track fills to it, and the value reads at the top right;
    - with `UNKNOWN_CHOICE` chosen, the track draws dashed;
    - stops are 34 px, each with a 44 px hit area.
  - `TrayGroup({ children })`:
    - an `Accordion type="single" collapsible`, so one tray is open at a time across a section;
    - it owns the open item (`useState('')`) and gives its trays `closeTray()` through `TrayGroupContext` and `useTrayGroup()` in `F/contexts/tray-group-context.tsx`.
  - `TrayField<T>(props: ChoiceFieldProps<T> & { id: string, glyph?: (option: T) => ReactNode })`:
    - an `AccordionItem` whose trigger row reads label · glyph + value · chevron;
    - the tray holds picture tiles, and `UNKNOWN_CHOICE` is the last tile;
    - a picked tile is `bg-control-selected`; a pick calls `onChange`, then `closeTray()`.
  - `SegmentedField<T>`: its props become `ChoiceFieldProps<T> & { icons?, columns?, size?: 'default' | 'slim', labelAction?: ReactNode }`.
    - `slim` is a 36 px pill holding every option except `UNKNOWN_CHOICE`.
    - `labelAction` sits at the right of the label row; the slim pairs pass a `NotSureLink` there.
    - The on state stays the segmented `bg-tab-active`. The look drawer is unchanged.
  - `FieldLabelRow({ id, label, action? })`: the shared label row, carrying the studies' label type.
  - `NotSureLink({ pressed: boolean, onPress: () => void })`: a quiet text button (`PROFILE_COPY.unknown`, `aria-pressed`), never styled as a button.
  - `RoofGlyph({ type: RoofType })`, `HvacGlyph({ type: HVACType | HVACComponent })`, `HouseholdGlyph({ type: HouseholdType })`: inline 24×24 SVGs drawn with `currentColor`, with path data from `FIELD_GLYPHS`.

- [ ] **Step 1: Implement** the files. They are not mounted yet; Task 11 mounts them through the tabs and runs their Playwright checks.
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`, both trade-scene scripts. Expected: clean. The look drawer still renders its segmented fields; check it on the lab page once.
- [ ] **Step 3: Commit**: `feat(trade-scenes): lighter fields for the panel, a stepped scale, a tray of tiles and a slim pair`.

### Task 6: Living situation — Household, and Upkeep & Bills (D10, D16, D24, C4)

**Files:**
- Create: `F/ui/components/panel/living-tab.tsx`, `household-section.tsx`, `repairs-section.tsx`, `repairs-row-field.tsx`
- Modify:
  - `F/ui/components/panel/money-field.tsx` is renamed to `unit-number-field.tsx` (`UnitNumberField`, prefix dropped), so the percent cut keeps it;
  - `cut-override.tsx`: the amount uses the shared `MoneyField`; the percent uses `UnitNumberField`;
  - `bill-field.tsx` uses the shared `MoneyField` until Task 9 deletes it.

**Interfaces:**
- Consumes: `repairsRows`, `repairsFigure`, `REPAIRS_COPY` (Task 2); `TrayGroup`, `TrayField`, `ScaleField`, `HouseholdGlyph` (Task 5); `MoneyField` from `@/shared/components/ui/money-field` (props `value`, `onChange`, `cents`, plus `Input` props such as `placeholder`, `aria-label`, `aria-describedby`, `className`); `InputGroup`, `InputGroupAddon`, `InputGroupText`.
- Produces:
  - **The money pattern**, as main's `FormMoneyField` does: an `InputGroup` holding `MoneyField` (`data-slot="input-group-control"`) and an `InputGroupAddon align="inline-end"` with the unit, so `$` and the unit show while the field is empty.
    - Bills pass `cents` and the unit `SAVINGS_COPY.billSuffix`; repairs pass `REPAIRS_COPY.perYear`.
    - Widths are `ch`-based (`w-[9ch]` bills, `w-[8ch]` repairs), with the unit tight to the digits (D9).
  - `LivingTab({ subTab: 'household' | 'repairs' })` renders one section.
  - `HouseholdSection()`: a household `TrayField` and an age-group `ScaleField`; it writes `household`.
  - `RepairsSection()`:
    - electric and gas money fields, writing `bills[c].now`, with `SAVINGS_COPY.billHint` under them;
    - one `RepairsRowField({ row: RepairsRow })` per `repairsRows(property)`, writing `repairsOverrides[trade]`; the placeholder is the working number, and the `SourceTag` stays;
    - the total: `bills.electric.now + bills.gas.now` (null counts as 0), plus `repairsFigure(rows.map(r => r.trade), overrides).monthly`, shown as `CountedDollars` with `REPAIRS_COPY.total`, `.perMonth` and `.lead`.

- [ ] **Step 1: Implement** the sections and the row, then the rename and the two field moves. `repairs-line.tsx` stays for the old Savings tab until Task 9.
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`, both trade-scene scripts. Expected: clean. The old panel still renders, with its bill and cut fields on the new fields.
- [ ] **Step 3:** Playwright smoke at 1440×900 (log in with `as=`). On the old Savings tab, with the bill empty, expected: `$` and `/mo` both show. Type `240`; expected: it reads `$240` `/mo` with the unit tight. Type `185.40`; expected: it keeps the cents. Save `SDD/shots/t6-bill.png`.
- [ ] **Step 4: Commit**: `feat(trade-scenes): the household and its running costs, on the app's one money field`.

### Task 7: Home — Structure and Current materials (D11, §4.8)

**Files:**
- Create: `F/ui/components/panel/structure-section.tsx`, `materials-section.tsx`, `home-sections.tsx`, `F/hooks/use-set-property.ts`
- Modify: `F/constants/home-scene-copy.ts` (appends `STRUCTURE_COPY = { roofForm: 'Roof', roofMaterial: 'Roof material', flatRoof: 'Torch down' }` and `ROOF_FORM_LABELS = { 'pitched': 'Pitched', 'low-slope': 'Flat' } satisfies Record<RoofForm, string>`)

`home-tab.tsx` and `home-facts.tsx` stay mounted in the old shell. Task 11 changes `HomeTab`'s signature and deletes `home-facts.tsx` when it swaps the shell, so `tsc` holds between tasks.

**Interfaces:**
- Consumes: `roofFormOf`, `ROOF_FORMS` (Task 1); `propertyPatch` (Task 3); `SegmentedField` (slim), `ScaleField`, `TrayGroup`, `TrayField`, `NotSureLink`, `RoofGlyph`, `HvacGlyph` (Task 5).
- Produces:
  - `useSetProperty(): (patch: Partial<PropertyProfile>) => void`: one `setState(state => propertyPatch(state, patch))`.
  - `StructureSection()`: Climate (slim `SegmentedField`, writes `climate`), Built (`ScaleField`), Foundation (slim), and Roof form (slim, over `ROOF_FORMS`, with `NotSureLink`; its value is `roofFormOf(property.roofType) ?? UNKNOWN_CHOICE`). The roof-form writes:
    - Flat → `roofType: 'flat'`;
    - Pitched on a flat or unset roof → `roofType: 'shingle'`; on a pitched roof, nothing changes;
    - "Not sure" → `roofType: null`.
  - `MaterialsSection()`:
    - Roof material: a `TrayField` over `PROFILE_ROOF_TYPES.filter(t => roofFormOf(t) === form)`, plus `UNKNOWN_CHOICE`. On a flat roof it is a fixed read-out (`STRUCTURE_COPY.flatRoof`), not a tray. With the form unset, it offers every type.
    - Windows (slim), Insulation (`ScaleField`), Heating & cooling and Equipment (`TrayField`).
  - `HomeSections({ subTab: 'structure' | 'materials' })`, in `home-sections.tsx`, renders one section. Task 11 renames it into `home-tab.tsx`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`. Expected: clean. The roof-change rule is already pinned by Task 3's checks. These sections mount in Task 11, which runs their Playwright checks.
- [ ] **Step 3: Commit**: `feat(trade-scenes): the home splits into its structure and its current materials, and the roof's form decides its material`.

### Task 8: Scopes and addons (D12, D13, D18, D22, C5, C6)

**Files:**
- Create: `F/ui/components/panel/scopes-and-addons.tsx`, `scope-or-addon-row.tsx`
- Modify:
  - `F/ui/components/panel/cool-roof-chip.tsx` (restyled for the row, with its own class instead of `SCOPE_CHIP_CLASS`);
  - `F/lib/scope-chip-options.ts` (`scopeGroupsForAssembly` and `ScopeChipGroup` removed; `offersCoolRoof`, `scopeFallbackLabel` and `tradeFallbackLabel` stay);
  - `F/constants/scene-controls.ts` (`SCOPE_CHIP_CLASS` removed);
  - `F/ui/components/panel/panel-tabs.tsx` and `panel-rail.tsx` (repointed at `ScopesAndAddons` until Task 11 deletes them).
- Delete: `F/ui/components/panel/upgrades-tab.tsx`, `scope-chips.tsx`, `scope-chip-group.tsx`

**Interfaces:**
- Consumes: `partOffers`, `offeredScopes`, `baseIncludedLabel`, `existingParts`, `alsoNewLabels`, `SCOPE_VERBS`, `SCOPES_AND_ADDONS_COPY`, `PART_LABELS` (Task 2); `scopePick` (Task 3); `useConstructionCatalog`; `scopeFallbackLabel`; `offersCoolRoof`; `PART_COPY.condition`.
- Produces: `ScopesAndAddons()` for `HOME_PRIMARY_ASSEMBLY`, with one `ScopeOrAddonRow` per `partOffers(...)`.
  - **Row:**
    - `PART_LABELS[partId]`;
    - the existing state: the existing part's `label` · `PART_COPY.condition[condition]`. For the covering on a metal or unset roof it reads `ROOF_TYPE_LABELS.metal` or `SCOPES_AND_ADDONS_COPY.notSet` instead, because the inference draws shingles for both;
    - the picked scope's verb;
    - a check (`CheckIcon`, `toneClasses('success').text`) when picked.
  - **Options:** single choice. A `ToggleGroup type="single"` holds "No change" plus each offered scope, labelled with the catalog's full name (`scopesById.get(id)?.name ?? scopeFallbackLabel(id)`). A pick writes `scopePick(state, offer, picked)` in one `setState`.
  - **Blocked rows:** show `SCOPES_AND_ADDONS_COPY.blocked[reason]` and no options. `base-included` shows `baseIncludedLabel` with a check instead.
  - **Covering row:** the cool-roof toggle sits in it (D22) and is enabled when `offersCoolRoof(proposedScopeIds)`. `PANEL_COPY.coolRoofHint` is kept as its description. While the toggle is ticked **and** `offersCoolRoof` holds, the verb gains `SCOPES_AND_ADDONS_COPY.coolRoof`, so a tile reset never shows it.
  - **Also new:** under a picked row, `SCOPES_AND_ADDONS_COPY.alsoNew(alsoNewLabels(…).join(', '))` when the list is not empty.

- [ ] **Step 1:** `grep -rn "scopeGroupsForAssembly\|SCOPE_CHIP_CLASS\|ScopeChips\|UpgradesTab" src scripts`. Note every consumer.
- [ ] **Step 2: Implement**, repoint the old shell's imports at `ScopesAndAddons`, then delete the three files.
- [ ] **Step 3:** `pnpm tsc`, `pnpm lint`, both trade-scene scripts. Rerun the grep. Expected: no hits.
- [ ] **Step 4: Playwright** at 1440×900 on the old shell's Upgrades tab, with the roof set to Shingle:
  - pick Tear-off, then Redeck, then Overlay;
  - expected: the deck row reads the needs-tear-off reason and shows no check. The store write itself is pinned by Task 3's `scopePick` checks;
  - the first covering pick ticks cool roof;
  - on wood shake, a Tear-off shows the deck's base label with a check.

  Pair each shot with `SDD/studies/ref-1440x900.png`. Save `SDD/shots/t8-*.png`.
- [ ] **Step 5: Commit**: `feat(trade-scenes): the build's scopes and addons, one pick per part, offered by the roof the home has`.

### Task 9: Savings, total first (D14, C3)

**Files:**
- Create: `F/ui/components/panel/savings-bars.tsx`, `savings-bar.tsx`, `savings-read-amounts.tsx`
- Modify: `F/ui/components/panel/savings-tab.tsx`; `F/constants/home-scene-copy.ts` (`SAVINGS_COPY` gains `repairsBar: 'Roof upkeep'` and `readAmounts: 'Change these in Today › Living situation'`)
- Delete: `F/ui/components/panel/savings-on-build.tsx`, `bill-savings.tsx`, `bill-field.tsx`, `repairs-line.tsx` (each after `grep -rn`)

**Interfaces:**
- Consumes: `targets.savings` and `savingsFigures` exactly as `savings-tab.tsx:20-31` reads them today; `CutOverride`; `EstimateDisclosure`; `SavingsFigure`.
- Produces: `SavingsTab()`, top to bottom:
  - the total (`SavingsFigure total`, or `SAVINGS_COPY.nothingLanded` when nothing landed);
  - one `SavingsBar` per source (electric, gas, repairs). The bar's width is `transform: scaleX(monthly / max)` with `origin-left`. An empty source shows "—" and no bar. Under each bar sit that source's `CutOverride`, the `noCut` note and the `EstimateDisclosure` (`disclosure.repairsSource` and `.vary` for repairs), as today (C3);
  - read-only chips for the amounts it read: both bills, plus each repairs figure from `repairsFigure` with its trade label, under `SAVINGS_COPY.readAmounts`.

  Savings exists only in the build, so the view check and `SavingsOnBuild` go.

- [ ] **Step 1: Implement.** Delete the four files after the grep.
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`, both trade-scene scripts.
- [ ] **Step 3: Playwright** at 1440×900. Type the bills, pick Tear-off with cool roof in Summer, then open Savings. Expected:
  - the total reads before the bars;
  - with a typed cut ($ mode), the electric bar changes;
  - with an empty gas bill, gas shows "—";
  - the repairs chips show the working numbers.

  Pair with the study. Shots: `SDD/shots/t9-*.png`.
- [ ] **Step 4: Commit**: `feat(trade-scenes): savings lead with one total, a bar per source and the amounts they read`.

### Task 10: The panel's state and the stage's shape (pure)

**Files:**
- Create: `F/lib/panel-tab-press.ts`, `F/lib/stage-shape-of.ts`, `F/lib/scene-visible-area-for.ts`, `F/constants/scene-layout.ts`, `F/constants/build-switch.ts` (`BUILD_SWITCH = { setSlidePx: 56 }`)
- Modify:
  - `F/constants/panel-tabs.ts`:
    ```ts
    PANEL_TABS = ['living', 'home', 'upgrades', 'savings']
    BUILD_TABS = { existing: ['living', 'home'], proposed: ['upgrades', 'savings'] }
    SUB_TABS = { living: ['household', 'repairs'], home: ['structure', 'materials'] }
    OPENING_PANEL_TABS = { lastTab: { existing: 'living', proposed: 'upgrades' }, lastSubTab: { living: 'household', home: 'structure' } }
    ```
  - `F/types.ts`: appends `PanelSubTab`, `PanelTabsState`, `StageShape`, `SceneVisibleArea`. The build is `TradeSceneInputs['view']`; no new view type.
  - `F/constants/scene-control-icons.ts` (`PANEL_TAB_ICONS.living`);
  - `F/constants/home-scene-copy.ts`: `PANEL_TAB_LABELS.living = 'Living situation'`, plus appended `SUB_TAB_LABELS = { household: 'Household', repairs: 'Upkeep & Bills', structure: 'Structure', materials: 'Current materials' }` and `BUILD_SWITCH_COPY = { label: 'Today or the Tri Pros build', compact: { existing: 'Today', proposed: 'Build' } }`;
  - `scripts/verify-trade-scene-layout.ts`.

  The old shell keeps compiling: `PanelTabs` and `PanelRail` render `living` through a temporary `LivingTab subTab="household"` entry, until Task 11 deletes them.

**Interfaces:**
- Produces:
  - `pressPanelTab(tabs: PanelTabsState, ctx: { view: TradeSceneInputs['view'], zoomed: boolean, collapsed: boolean }, tab: PanelTab): { tabs: PanelTabsState, view: TradeSceneInputs['view'], leaveCloseUp: boolean, collapsed: boolean }`, decided in this order:
    1. The tab's build becomes the view, and `lastTab[build]` becomes the tab.
    2. If zoomed: `leaveCloseUp`, and unfold.
    3. Else if folded: unfold.
    4. Else if the tab is already the open one in the open view: fold.
  - `pressSubTab(tabs, sub: PanelSubTab): PanelTabsState`.
  - A press on a build end only writes `view`: it stays up close (C2) and stays folded.
  - `SCENE_LAYOUT`. The numbers are the spec's; Task 0's `measurements.md` may refine the card's padding and radius, but not these:
    ```ts
    {
      portraitBelowWidth: 600, narrowBelowWidth: 800,
      card: { gap: 16, width: 372, narrowWidth: 320 },
      bottomCard: { gap: 12, share: 0.46 },
      dock: { width: 64, gap: 16 },
      knob: { long: 88, short: 22, hit: 44 },
      calloutNarrowBelow: 1024,
    }
    ```
  - `type StageShape = 'landscape' | 'narrow' | 'portrait'` and `stageShapeOf(width: number, height: number): StageShape`: portrait when `height > width` or `width < 600`; narrow when `width < 800`; else landscape.
  - `interface SceneVisibleArea { left: number, right: number, bottom: number }`: CSS px from each canvas edge to where the uncovered area starts.
  - `sceneVisibleAreaFor({ shape, collapsed, width, height }): SceneVisibleArea`:
    - landscape: `left = collapsed ? 0 : 16 + 372`, `right = 64 + 16`, `bottom = 0`;
    - narrow: the same with `320`;
    - portrait: `left = 0`, `right = 0`, `bottom = collapsed ? 0 : Math.round(height * 0.46) + 12`.
  - The build switch is compact when the shape is `narrow`, or when the stage is under `SCENE_LAYOUT.portraitBelowWidth` wide.

- [ ] **Step 1: Write the failing checks.** One `assert.deepEqual` per row, starting from `OPENING_PANEL_TABS`:

| ctx (view, zoomed, collapsed) | press | expected view | lastTab | leaveCloseUp | collapsed |
|---|---|---|---|---|---|
| existing, no, no | `home` | existing | existing: home | false | false |
| existing, no, no | `living` (open) | existing | unchanged | false | **true** |
| existing, no, yes | `living` | existing | unchanged | false | false |
| existing, no, yes | `savings` | **proposed** | proposed: savings | false | false |
| existing, no, no | `savings` | **proposed** | proposed: savings | false | false |
| proposed, yes, no | `upgrades` | proposed | proposed: upgrades | **true** | false |
| proposed, yes, yes | `upgrades` | proposed | proposed: upgrades | **true** | false |
| proposed, yes, no | `home` | existing | existing: home | true | false |

  Also assert:
  - `pressSubTab(OPENING_PANEL_TABS, 'materials').lastSubTab.home === 'materials'`, with `living` unchanged.
  - Every `BUILD_TABS` entry is in `PANEL_TABS`, and every `PANEL_TABS` entry is in exactly one build.
  - `stageShapeOf`: 1440×900 → landscape; 768×700 → narrow; 820×1180 → portrait; 764×1000 → portrait; 390×844 → portrait; 599×300 → portrait.
  - `sceneVisibleAreaFor`, open and folded, for each shape: the numbers above, with `bottom` at 1180 equal to `Math.round(1180 * 0.46) + 12 = 555`.
- [ ] **Step 2:** Run. Expected: FAIL. **Step 3: Implement.** **Step 4:** Run, then `pnpm tsc` and `pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit**: `feat(trade-scenes): which tab a press opens, and the stage's shape and visible area, as pure rules`.

### Task 11: The stage, the card, the knob and the build switch (D1, D3–D7, D21, D25, C2, C7, C9, C11)

**Files:**
- Create:
  - `F/contexts/panel-tabs-context.tsx` (`PanelTabsProvider`, `usePanelTabs`);
  - `F/contexts/scene-visible-area-context.tsx` (`SceneVisibleAreaProvider`, `useSceneVisibleArea`);
  - `F/hooks/use-stage-size.ts`;
  - `F/ui/components/build-switch/build-switch.tsx`, `build-switch-end.tsx`, `build-switch-tabs.tsx`;
  - `F/ui/components/panel/scene-card.tsx`, `panel-knob.tsx`, `panel-sub-tabs.tsx`.
- Modify:
  - `F/ui/views/trade-scene-view.tsx`: the canvas is `absolute inset-0`; the card, knob, build switch and dock region are placed by shape; the `47rem` and `64rem` classes go;
  - `F/ui/components/scene-stage.tsx`: measures the stage, and exposes `data-shape`, `data-visible-narrow` and `--scene-visible-left/right/bottom`;
  - `F/ui/components/panel/scene-panel.tsx` (renders the card's contents);
  - `F/ui/components/panel/panel-header.tsx` (`compact` prop: the eyebrow and title only, with the lead under a fold);
  - `F/ui/components/panel/home-tab.tsx` (becomes `HomeTab({ subTab })`, absorbing Task 7's `home-sections.tsx`);
  - `F/constants/scene-popouts.ts` (`RAIL_POPOUT_CLASS` removed);
  - `F/constants/scene-control-icons.ts` (`PANEL_COLLAPSE_ICONS` kept, for the fold button and the knob).
- Delete:
  - `F/ui/components/panel/view-toggle.tsx`, `panel-rail.tsx`, `rail-popover.tsx`, `panel-tabs.tsx`, `panel-collapse-button.tsx`;
  - `home-facts.tsx`, `home-sections.tsx`.

**Interfaces:**
- Consumes: Tasks 6–10's `LivingTab`, `HomeSections`, `ScopesAndAddons`, `SavingsTab`, `pressPanelTab`, `pressSubTab`, `stageShapeOf`, `sceneVisibleAreaFor`, `SCENE_LAYOUT`; the existing `AssemblyScreen`, `PanelHeader` and `usePanelCollapsed`; `SDD/studies/measurements.md`.
- Produces:
  - `PanelTabsProvider({ children })` holds `useState(OPENING_PANEL_TABS)` and applies a press as one store write: `view`, plus `{ zoom: null, peel: 0, emphasizedPart: null }` when `leaveCloseUp`; then `setCollapsed`.
  - `usePanelTabs(): { tab: PanelTab, subTab: PanelSubTab | null, pressTab(tab), pressBuild(view), pressSubTab(sub) }`. `tab` is `lastTab[view]`.
  - `useStageSize(ref): { width: number, height: number }`: a `ResizeObserver`, first read in a layout effect, so the first frame is never 0×0.
  - `SceneVisibleAreaProvider({ value: { area: SceneVisibleArea, shape: StageShape, stage: { width, height } }, children })` and `useSceneVisibleArea()`. The stage sets `data-visible-narrow` when `stage.width − area.left − area.right < SCENE_LAYOUT.calloutNarrowBelow`.
  - `BuildSwitch({ compact: boolean })`, laid out as described in §4.3:
    - its ends are `aria-pressed` buttons with `SCENE_VIEW_LABELS` (or `BUILD_SWITCH_COPY.compact`);
    - the middle is a `role="tablist"` holding the open build's two tabs, with arrow keys moving between them; no tab is selected while `zoom !== null` (C2);
    - the spotlight and the lozenge are absolutely positioned; this task places them statically, and Task 12 adds the motion;
    - it is centred over the visible area by `translateX((area.left − area.right) / 2)` on `SCENE_MOTION.transition`.
  - `SceneCard()`:
    - two elements: an outer frame (shadow, the studies' radius) and an inner clip (`bg-card`, overflow, a 1 px `border`; C8 as amended);
    - its contents: `PanelHeader compact` with the fold button, `PanelSubTabs` (underline tabs, for `living` and `home` only), then one scroll column (`PANEL_SCROLL_CLASS`); up close it shows `AssemblyScreen` instead;
    - landscape: 16 px off three edges, 372 or 320 wide; portrait: the bottom card, 12 px off three edges and 46% of the stage tall;
    - it slides out by `motion` `x` (landscape) or `y` (portrait) on `SCENE_MOTION.transition`; folded, it is `inert` and nothing in it unmounts.
  - `PanelKnob()`: a button labelled `PANEL_COPY.expand`, with a 44 px hit area, on the left edge (landscape and narrow) or the bottom edge (portrait).
  - **Focus (§4.4):** the card's fold button calls `setCollapsed(true)`, then focuses the knob. The knob unfolds, then focuses the build switch's open tab.
  - **The camera:** it still frames the full canvas until Task 14, so the house sits at the canvas centre with the card over its left side.

- [ ] **Step 1: Implement.** Mount everything, then delete the old shell's files after `grep -rn` shows no consumer, and remove `RAIL_POPOUT_CLASS` the same way.
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`, both trade-scene scripts. Expected: clean.
- [ ] **Step 3: Playwright** at 1440×900, 1024×768 with the nav open (768 px stage) and folded, 820×1180, and 390×844. Use the default scheme, plus one light-scheme shot. Pair each shot with the study's.
  - **Layout:**
    - the canvas box equals the stage box, and stays unchanged through a fold and an unfold, sampled each frame (D7);
    - the card is 372 px, 320 px or the bottom card, as the shape says;
    - the card, build switch, dock and knob boxes do not intersect.
  - **Opening and memory:**
    - Today opens on Living situation › Household (C9);
    - open Home › Current materials, switch to the Tri Pros build, switch back: Home › Current materials is open again (D4, D5).
  - **Fold:** tap the open tab, and the card folds while the knob shows. Tap the knob: the card unfolds, and the build switch's open tab has focus.
  - **Up close:** zoom in through a pin, then tap Savings; zoom, peel and emphasis are cleared and Savings is open. Zoom in again and tap a build end: still up close.
  - **Fields (Task 5):**
    - arrow keys move the Built scale;
    - opening a second tray closes the first;
    - "Not sure" writes `null` and dashes the track;
    - every control's hit box is at least 44 px.
  - **Roof:**
    - on Home › Structure, tap Pitched on a flat roof: the pill stays on Pitched, and the material reads Shingle;
    - set the roof material to Metal after picking Tear-off and Redeck: both picks are gone, and the rows show Metal's blocked reason (Review Focus 1).
  - **Reduced motion** (`emulateMedia({ reducedMotion: 'reduce' })`): the card and the knob reach their end state in the first frame.

  Save the shots as `SDD/shots/t11-*.png` and read each one.
- [ ] **Step 4: Commit**: `feat(trade-scenes): the scene fills the stage, and the panel becomes one floating card picked from a build switch, folding to a knob`.

### Task 12: The build switch moves as one (D3 motion, §4.3, §4.9)

**Files:**
- Modify: `F/ui/components/build-switch/*`

**Interfaces:**
- Produces, with no prop changes:
  - **Measuring.** Both tab sets are measured once in a layout effect, and again on `document.fonts.ready`. The middle is laid out at the wider set's width.
  - **The middle's visible width** eases by `clip-path: inset(0 Rpx 0 Lpx round …)` or by a transform of the bar's contents; pick one. `width` never changes after mount.
  - **The spotlight and the lozenge** move with `translateX` + `scaleX` (or `clip-path`) through `motion/react` on `SCENE_MOTION.transition`.
  - **The set swap:** the outgoing set fades and slides `BUILD_SWITCH.setSlidePx` toward its own end, and the incoming set slides in from its own end.
  - **Reduced motion** (`useReducedMotion`): every change jumps.

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`.
- [ ] **Step 3: Playwright** at 1440×900, sampling every animation frame through a build switch:
  - the bar's `getBoundingClientRect().width` never changes;
  - no animated element's computed `left` or `width` changes;
  - at rest, the middle's visible width equals the open set's measured width ±1 px in both builds, including after `document.fonts.ready`;
  - the spotlight covers the open end and its tabs.

  Repeat with `emulateMedia({ reducedMotion: 'reduce' })`: the end state arrives in the first frame. Record the numbers in `SDD/shots/t12-motion.md`.
- [ ] **Step 4: Commit**: `feat(trade-scenes): the build switch slides its tabs and spotlight across without resizing`.

### Task 13: Shortcut keys and the shortcut-keys dialog (D15, §4.6)

**Files:**
- Create: `F/hooks/use-scene-shortcuts.ts`, `F/hooks/use-keys-in-use.ts`, `F/constants/scene-shortcuts.ts`, `F/ui/components/shortcut-keys-dialog.tsx`, `F/ui/components/keycap.tsx`
- Modify:
  - `F/ui/components/scene-stage.tsx` (mounts the hook and the dialog);
  - `F/ui/components/build-switch/build-switch-end.tsx` and `F/ui/components/panel/panel-knob.tsx` (keycaps `B` and `\`, plus `aria-keyshortcuts`);
  - `F/constants/home-scene-copy.ts` (appends `SHORTCUT_COPY = { title: 'Shortcut keys', lines: { weather: 'Weather: Normal, Summer, Winter, Rain', homeView: 'Complete or Partly open', thermal: 'Thermal on or off', build: 'Today or the Tri Pros build', panel: 'Hide or show the panel', sheet: 'These keys' } }`).

**Interfaces:**
- Consumes: `isUnclaimedKey` (Task 4), `usePanelTabs` (Task 11), `usePanelCollapsed`.
- Produces:
  - `SCENE_SHORTCUTS = { '1': 'normal', '2': 'summer', '3': 'winter', '4': 'rain', 'v': 'homeView', 't': 'thermal', 'b': 'build', '\\': 'panel', '?': 'sheet' } as const`, matched on `event.key.toLowerCase()`.
  - `useKeysInUse(): [inUse: boolean, markInUse: () => void]`: a module store following `use-panel-collapsed.ts` (subscribe + `useSyncExternalStore`, server snapshot `false`), held in memory for the page's life.
  - `useSceneShortcuts(stageRef: RefObject<HTMLElement | null>, openSheet: () => void): void`. It is a `keydown` listener on `window` (bubble phase), as the meeting flow's is:
    - it returns unless `isUnclaimedKey(event, stageRef.current)` and `!event.repeat`;
    - a matched key calls `preventDefault`, writes the same input its control writes, and marks keys in use;
    - `b` calls `pressBuild`, toggling `existing` and `proposed`; `v` toggles `homeView`; `t` toggles `thermalCamera`; `\` toggles the fold.

    A tap on the canvas leaves focus on `body`, which the guard accepts, so the stage needs no `tabIndex`.
  - `Keycap({ keyLabel: string })`: a `<kbd aria-hidden>` rendered only while keys are in use. Every control with a key also carries `aria-keyshortcuts`.
  - `ShortcutKeysDialog({ open, onOpenChange })`: a `Dialog` whose content carries the `dark` class, because it portals out of the stage (as `look-drawer.tsx:29` explains). It lists every key, and Escape closes it.

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`.
- [ ] **Step 3: Playwright** at 1440×900:
  - click the scene, then press each key once; expected: each input changes (read from the visible controls), and `\` folds the card;
  - fold from the card's own button, then press `\`; expected: it unfolds;
  - type `1` into the electric bill; expected: the weather is unchanged and the field reads `$1`;
  - hold `t` (`keyboard.down`, wait 600 ms, `keyboard.up`); expected: Thermal toggled once;
  - before any key press, there is no `kbd` on the page;
  - `?` opens the dialog, and Escape closes it.

  Shots: `SDD/shots/t13-*.png`.
- [ ] **Step 4: Commit**: `feat(trade-scenes): one key for each scene control, a dialog that lists them, and keycaps once keys are in use`.

---

## The epic session's yes

- [ ] Confirm before Task 14: the epic session (or the owner) says its TS3b.3 whole-branch review is done. A commit on the branch is not enough. From here on, Tasks 14–18 may touch the files the Global Constraints held back. Keep checking `git status` for the other session's dirty files before each commit.

### Task 14: The camera frames the scene visible area (§4.1, C1)

**Files:**
- Modify: `src/shared/components/scene/ui/camera-rig.tsx`, `src/shared/components/scene/types.ts` (appends `VisibleArea`), `F/ui/components/home-kit/home-camera-rig.tsx`

**Interfaces:**
- Produces:
  - `interface VisibleArea { left: number, right: number, bottom: number }`: fractions of the canvas, 0..1, from each edge to where the uncovered area starts.
  - `CameraRig({ framing, orbit, visibleArea? }: { …, visibleArea?: VisibleArea })`. With no `visibleArea` it behaves exactly as today. With one:
    - it tweens `[left, right, bottom]` with `useTweened` on `SCENE_MOTION.transition`, the card's own curve and clock (fractions, not pixels: §4.1; amended 2026-10-24, it was `useEased`);
    - in `apply` it reads `size` from `useThree.getState()` and calls the spec's formula verbatim, `camera.setViewOffset(visibleW, visibleH, −left·W, 0, W, H)` with `visibleW = W·(1 − left − right)` and `visibleH = H·(1 − bottom)`; at all-zero it calls `camera.clearViewOffset()`;
    - it keeps the last applied fractions in a ref and re-applies them in a `useLayoutEffect` on `size`, so no frame draws at the bare canvas aspect after a resize (the R3F aspect trap, Review Focus 2);
    - the fov is `widenFovForAspect(easedFramingFov, visibleAspectOfTheTweenedArea)`, worked out in the same step as the offset, so the lens widens in step with the slide.
  - `HomeCameraRig` reads `useSceneVisibleArea()` and passes `visibleArea` as fractions of `size`. `homeFramingFor` keeps reading the **canvas** aspect, which is now the stage's (C1: a fold never swaps the framing).

- [ ] **Step 1: Implement.**
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`, `pnpm tsx scripts/verify-scene-primitives.ts`, and both trade-scene scripts.
- [ ] **Step 3: Playwright jitter check** at 1440×900 and 1024×768, following the traps in memory `reference-measuring-ui-jitter.md`.
  - Each animation frame, sample the canvas box and the house's framed centre: the orbit target projected through the camera, read from the R3F store reached through a pin anchor, so no probe enters the code. The roof anchor pin's DOM box is sampled beside it as a second probe (amended 2026-10-24: the pin sits on the house's cut end, so it was a proxy that hid a miss).
  - Expected:
    - the canvas box never changes;
    - the framed centre moves monotonically, with no frame jumping more than 2% of the stage width;
    - at rest, card open or folded, the framed centre is within ±2% of the visible area's centre (folded, the stage less the dock).
  - Repeat after a window resize and after an app-nav fold with the card open.
  - Then **C1**: orbit by a drag, fold, unfold. The camera position is unchanged to 3 decimals.

  Record the numbers in `SDD/shots/t14-jitter.md`.
- [ ] **Step 4: Commit**: `feat(trade-scenes): the camera frames the part of the scene the card leaves open, and a fold keeps the rep's view`.

### Task 15: Overlays in the visible area (§4.1 last bullet)

**Files:**
- Modify:
  - `F/ui/components/panel/thermal-legend.tsx`: it moves with `translate` by `--scene-visible-left` and `--scene-visible-bottom`, on `SCENE_MOTION.transition` through `motion`;
  - `F/ui/components/home-scene-fallback.tsx`: the still and its caption sit in the visible area;
  - `F/ui/components/callout-pin.tsx`: `@max-[64rem]/scene-canvas:*` becomes `group-data-visible-narrow/stage:*`;
  - `F/ui/components/home-scene-canvas.tsx`: drops `@container/scene-canvas` if nothing else reads it (`grep -rn "scene-canvas" src`).

- [ ] **Step 1: Implement.** **Step 2:** `pnpm tsc`, `pnpm lint`.
- [ ] **Step 3: Playwright** at 1440×900 and 1024×768 with Thermal on:
  - the legend's box sits inside the visible area, open and folded;
  - at 1024 with the card open, the callouts use the narrow leaders; folded at 1440, the wide ones;
  - the "Inside the roof" pin is no longer covered by the dock at 1024.

  Then launch Chromium with `--disable-3d-apis`. Expected: the fallback still and its caption sit in the visible area, and the card, build switch and dock work. Shots: `SDD/shots/t15-*.png`.
- [ ] **Step 4: Commit**: `fix(trade-scenes): the thermal key, the callouts and the still follow the open part of the scene`.

### Task 16: The dock becomes the strip (§4.5, C7, D23)

**Files:**
- Create: `F/ui/components/dock/weather-tile.tsx`, `dock-weather.tsx`, `dock-home-view.tsx`, `dock-thermal.tsx`
- Modify: `F/ui/components/dock/scene-dock.tsx` (rebuilt in place as the strip; it keeps the name `SceneDock`)
- Delete: `F/ui/components/dock/view-picker.tsx`, `weather-picker.tsx`, `dock-button.tsx`, `F/ui/components/scene-popout-content.tsx`, and `SCENE_POPOUT_COLLISION_PADDING` (each after `grep -rn`). `SCENE_POPOUT_SURFACE` stays if anything still reads it.

**Interfaces:**
- Consumes: `Keycap`, `SCENE_SHORTCUTS`, `ShortcutKeysDialog` (Task 13); `HOME_SCENE_STILLS`; `HOME_VIEW_ICONS`; `HOME_THERMAL_PALETTE` (`F/constants/home-temperatures.ts`); `LookDrawer` (unchanged); `useSceneVisibleArea().shape`.
- Produces: `SceneDock()`, a vertical strip at the right edge, from the top:
  - **Home view:** two buttons with `aria-pressed`, `HOME_VIEW_LABELS`.
  - **Thermal:** one toggle, with a ramp swatch from `HOME_THERMAL_PALETTE` beside its label and `DOCK_COPY.thermalHint` as its description.
  - **Weather:** four `WeatherTile`s, each showing the thumbnail of `HOME_SCENE_STILLS[weather]` with its label. On a portrait stage these always fold into one `DockWeather` button that opens the four tiles as a tray; any stage too short for the strip folds them by measured room, then the home view, then drops the keys button (C7 as amended 2026-10-24).
  - **The shortcut-keys button** (keyboard glyph). On portrait it shows only under the `pointer-fine:` variant or once keys are in use.
  - **`LookDrawer`** at the foot.

  Buttons are 64 × 58 px, with a 44 px minimum hit area. Each control shows its `Keycap` in its corner and carries `aria-keyshortcuts`.

- [ ] **Step 1: Implement**, then the deletes after the greps.
- [ ] **Step 2:** `pnpm tsc`, `pnpm lint`, both trade-scene scripts.
- [ ] **Step 3: Playwright** at 1440×900, 820×1180 and 390×844, paired with the study:
  - each tile writes its input in one tap;
  - keycaps appear only after a key;
  - on portrait, the weather tray opens and closes;
  - nothing overlaps the bottom card or the build switch.

  Shots: `SDD/shots/t16-*.png`.
- [ ] **Step 4: Commit**: `feat(trade-scenes): the dock shows every choice, one tap each, with no pop-outs`.

### Task 17: Copy, the dead Today branch, and one roof-form type (§3, §4.8, §8 Delete)

**Files:**
- Modify:
  - `F/constants/home-scene-copy.ts`:
    - `ROOF_TYPE_LABELS.flat = 'Torch down'`; then delete `STRUCTURE_COPY.flatRoof` and read the label instead;
    - remove `PANEL_COPY.workHint`, `.viewGroup`, `.railLabel` and `.closeUp`, and `SAVINGS_COPY.showBuild` and `.savingsOnBuild`;
    - remove `DOCK_COPY.view` and `.weather` if Task 16 left them unread.
  - `F/lib/scope-preview-patch.ts`: the "a pick on Today moves to the build" branch goes, and so does the `view` field.
  - `scripts/verify-trade-scene.ts`:
    - its `scopePreviewPatch` block (find it by the symbol, not by line) loses the Today assertions, and every `view:` field passed to `scopePreviewPatch` there goes;
    - its bare scope UUIDs (today :87-93) become `SCOPE_IDS.*`.
  - **One roof-form type:** every `HOME_ROOF_FORMS` and `HomeRoofForm` reader moves to core's `ROOF_FORMS` and `RoofForm` (`grep -rln "HomeRoofForm\|HOME_ROOF_FORMS" src`; 19 files on 2026-10-23). Then they are deleted from `F/constants/home-anchors.ts`. `homeRoofForm()` (`F/lib/home-roof-form.ts`) stays as the drawing rule, retyped to `RoofForm`, with no alias left behind.

- [ ] **Step 1:** For each key and type, `grep -rn "<name>" src scripts`. Remove only names with no reader left.
- [ ] **Step 2: Implement.**
- [ ] **Step 3:** `pnpm tsc`, `pnpm lint`, both trade-scene scripts. Add one assertion to `verify-trade-scene-layout.ts`: `scopePreviewPatch` never writes `view`. Expected: all pass, and the copy gate still passes.
- [ ] **Step 4: Commit** (shared-file rule): `chore(trade-scenes): flat roofs read "Torch down", the old panel's copy and code go, and the roof form has one type`.

### Task 18: Retune by screenshot, polish against the study, and the full verification round (§7)

**Files:**
- Modify:
  - `F/constants/home-geometry.ts` (`HOME_FRAMINGS`, `TALL_BELOW_ASPECT`) and `F/constants/home-anchors.ts` (callout offsets), only as the shots demand;
  - `CONTEXT.md`: rewrite the Scene panel and Dock entries for the card and the strip, and remove the Rail entry (`PanelRail` is gone);
  - `docs/plans/2026-10-16-trade-scenes-epic.md`.

  The last two follow the shared-file rule.

- [ ] **Step 1: One screenshot round, as a subagent**, briefed like the TS3b.3 screenshot briefs in `.superpowers/sdd/2026-10-23-home-views-and-thermal-lens/`.
  - **Viewports:** 1440×900; 1024×768 with the nav open and folded; 820×1180; 390×844.
  - **Schemes:** both app colour schemes (the stage is always `dark`).
  - **Weathers and states:** Normal and Summer, each with the card open and folded, Complete and Partly open, and Thermal on.
  - **Checks:**
    - framing in the visible area: the house whole, the roof not clipped, the callouts clear of the card;
    - the card's text contrast ≥ 4.5:1 over the brightest sky, sampled from pixels, muted text included (C8);
    - every §7 bullet not already recorded in Tasks 6–17;
    - each shot side by side with the matching `SDD/studies/ref-*.png` (D28).
- [ ] **Step 2: Tune** `HOME_FRAMINGS`, `TALL_BELOW_ASPECT` and the callout offsets in one batch, then confirm with at most one more round. If the card needs glass, add `--scene-glass` through `docs/design-system/theme-conventions.md` §11 and run `pnpm theme:check`. Otherwise it stays solid.
- [ ] **Step 3: `/impeccable` polish pass** on the card, build switch, knob, dock and fields, judged against the study in both schemes (D28). Fix every finding that reads less crisp than the study. Record what changed in `SDD/shots/t18-polish.md`.
- [ ] **Step 4:** `pnpm tsc`, `pnpm lint`, `pnpm tsx scripts/verify-trade-scene.ts`, `pnpm tsx scripts/verify-trade-scene-layout.ts`, `pnpm tsx scripts/verify-construction-model.ts`. Expected: all pass.
- [ ] **Step 5: Tracker and glossary.**
  - Tracker: add a row for this layout ("built, awaiting the owner's review") with the commit range, and a change-log line naming R79, R81 and R82 as built here and R78 and R80 as left open.
  - `CONTEXT.md`: the Scene panel and Dock rewrites, and the Rail removal.
- [ ] **Step 6: Commit**: `fix(trade-scenes): framings and callouts retuned for the open part of the scene, polished against the studies`.

---

## Spec coverage

| Spec item | Task |
|---|---|
| D1 glass HUD, D7 canvas never resized | 11, 14 |
| D3 build switch, D23 names | 10, 11, 12 |
| D4, D5, C9 tabs and memory | 10, 11 |
| D6 collapse, knob, `\`, tap the open tab | 10, 11, 13 |
| D8 lighter fields, D9 amounts tight | 5, 6 |
| D10, C4 Upkeep & Bills | 2, 6 |
| D11 Structure and Current materials, roof form | 1, 3, 7 |
| D12, D13, D18, D22, C5, C6 scopes and addons | 1, 2, 3, 8 |
| D14, C3 Savings | 9 |
| D15 keys | 4, 13, 16 |
| D16, D17 nothing new about habits or condition | (no task: nothing built) |
| D19 task 0 | 1 |
| D20, D26 sequencing, one phase | Global Constraints, the epic session's yes |
| D21 phone, D25 narrow landscape, §4.2 shape, C11 | 10, 11, 16, 18 |
| D24 shared MoneyField | 0, 6 |
| D27 names | Global Constraints, 8, 10, 11, 13 |
| D28 visual floor | 0, every UI task, 18 |
| C1 camera survives a fold | 14 |
| C2 up close | 10, 11 |
| C7 portrait dock | 16 |
| C8 surface and contrast | 11, 18 |
| C10 tokens | Global Constraints, 5, 8 |
| §4.1 overlays | 15 |
| §4.9 motion, reduced motion | 11, 12, 14 |
| §4.10 accessibility | 5, 11, 13, 16 |
| §6 edge cases | 2, 3 (checks), 8, 9, 15 |
| §7 verification | 2, 3, 6, 8–18 |
| §8 deletes | 6, 8, 9, 11, 16, 17 |
