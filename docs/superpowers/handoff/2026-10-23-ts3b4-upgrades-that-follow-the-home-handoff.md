# Handoff: TS3b.4, upgrades that follow the home

**Written:** 2026-10-23, for a fresh session that starts TS3b.4.
**Your job in that session:** run the design stage only: brainstorm, spec, builder check, then the plan. **Build nothing** until the owner approves the spec and then says "build" or "execute". Saying "go ahead" does not count as permission to build.
**Branch and worktree:** `feat/trade-scenes-foundation` in `.worktrees/trade-scenes`. Run every command from there.

---

## 1. What TS3b.4 is

In the meeting, the homeowner should see *their* home's parts as they are today: old, worn, single pane, water-based paint, crushed ducts, an aging 4-ton condenser. Then they watch the Tri Pros build swap in the better version, so the upgrade reads as an upgrade.

The other half is input. The rep sets the home up fast. The build era fills in a starting guess for each upgradeable part, and the rep corrects it. None of this may make the inputs clunky (R67).

The tracker row (`docs/plans/2026-10-16-trade-scenes-epic.md` §2, TS3b.4) lists:
- single → double pane windows;
- cool paint;
- R-6 silver flex ducts;
- the shingle colour;
- 3, 4 and 5 ton condensers;
- worn existing parts, so the upgrade reads as one;
- the build era pre-filling the upgrades' current state, kept apart from the home's characteristics;
- an optional "done in the last…".

## 2. Read first, in this order

1. **Tracker** `docs/plans/2026-10-16-trade-scenes-epic.md`:
   - §2, the order of projects;
   - §3b, the requirements register;
   - §2a, the owner's open items;
   - §6, the change log.

   Everything below cites its R numbers. A requirement changes there first, with a change-log line, then in the spec.
2. **Memory** `project-3d-trade-scenes.md`, which loads automatically. It holds the epic's state and the owner's rulings.
3. **`CONTEXT.md`**, the trade-scene terms. Use them as written, and get the owner's agreement before adding any new term (see §6).
4. **The layout spec** `docs/superpowers/specs/2026-10-23-trade-scene-layout-design.md`. It is a draft from a parallel session, uncommitted, with decisions D1–D26. **It overlaps TS3b.4 heavily; read §4 below before designing any input.**
5. **The TS3b.3 spec** `docs/superpowers/specs/2026-10-23-home-views-and-thermal-lens-design.md`. It describes the house TS3b.4 draws on: the Complete home, front windows and door, floor heights, the Thermal lens.

## 3. The requirements in scope

These come from the tracker register. **Bold** marks what is already agreed. The rest is open, or is Claude's reading and needs the owner to confirm it.

| ID | What | Status and what to settle |
|---|---|---|
| R35 | The condenser swaps between 3, 4 and 5 ton | Open. No tonnage exists in the property profile or the model. **Ask where the size comes from:** a new home fact, inferred from the home's size, or a presentation-only pick. |
| R36 | Existing parts show wear, so an upgrade feels like one. First case: old gutters look the same as new | Open. Claude read it as applying to every part with a worn state. A `gutterWorn` colour already exists (`constants/home-palette.ts:21`), so check what still reads as new before designing. |
| R37 | Original ducts vs new **R-6** silver reflective flex ducts | Open. The data says R-8 today (`construction/core/constants/assemblies/hvac-attic.ts:15`); the owner's figure is R-6. |
| R46 | Windows single → double pane, an upgrade like the others | Open. The heat figures already exist (§5). |
| R47 | Cool Life reflective paint vs regular water-based paint | Open. The data and the heat figures already exist (§5). |
| R50 | The upgrades offered follow the home's current state; a double-pane home is never offered double pane | Open |
| R51 | The shingle colour can be picked | Open. Ask for the list of colours. |
| R60 | Insulation: replace vs top off are two upgrades, compared up close | Open. R81 already rules "top off or replace, not both". |
| R61 | The owner's paint copy: water-based "cracks and fades within 8 years"; Cool Life "reflective, great energy reduction, lifetime warranty" | Open. **The claims must be checked against the Cool Life product terms before release.** |
| R63 | New home facts: roof age and paint condition | Open. May fold into R78. |
| R64 | **The build era pre-fills the upgradeable parts' current state** (before 1950 = the worst of each); it never sets a characteristic | Open. Ask whether picking an era again overwrites what the rep already set. |
| R65 | **Upgrades** (each with a worse and a better state) are kept apart from **characteristics** (foundation, roof type, exterior…) | Open. Refined by R79. |
| R66 | An optional "done in the last…" on an upgrade: Original, 1, 5, 10, 15, 20 or 25 years | Open. Claude read it as dating a part that is already in its better state; it may be absorbed by R78. |
| R67 | **R64–R66 must not make the inputs clunky: mockups and the owner's pick before any build** | Open. This is a hard gate. |
| R77 | Crawl-space thermal paint (summer ≈72/68 °F inland/coastal, winter ≈50/53 °F), **built with the crawl-space insulation upgrade** | Agreed for TS3b.4. Ask whether crawl-space insulation joins TS3b.4's upgrade list (R75 named it as future). |
| R79 | The home's inputs split into *structure* (rigid) and *materials* (swappable); the structure decides which materials are possible | Open (TS3b.4). The layout spec already designs the tabs for it (D11). |
| R81 | **Roof work follows the existing roof, one pick per layer** (shingle → overlay or tear-off; flat → torch down; tile → tile reset; shake → tear-off; metal → nothing yet; redeck on all but metal; insulation top off *or* replace) | Agreed. It is a construction rule that lives with the scope installs (`construction/core/constants/scope-installs.ts`), not in the UI. Check whether the layout build already lands it. |
| R78 | A condition for every material, tied to its age | Open, its own brainstorm, **phase not set**. It may absorb R63 and R66. Don't design it inside TS3b.4 unless the owner pulls it in; ask early, because it changes R63 and R66. |

## 4. The boundary with the layout spec (settle this first)

A parallel session wrote the "glass HUD" layout spec from the owner's studies (private artifact "Trade Scene Layout Studies"). It logged R78–R83 in the tracker. **Its plan is not written yet.** It already decides where TS3b.4's inputs will live:

- **Today** has the *Living situation* and *Home* tabs. *Home* splits into **Structure** and **Current materials** (D4, D5, D11, R79). Exterior paint joins Current materials "when TS3b.4 lands" (D11, D17, §10).
- **Tri Pros build** has the *Upgrades* and *Savings* tabs. **Upgrades is a receipt**: one row per layer from roof to ceiling, today's state on the left, and a picked layer shows a green check and a short verb (D12, D13).
- **Upkeep & Bills** rows cover the roof, windows, exterior paint and heating & cooling, from `REPAIRS_PER_YEAR` (`construction/core/constants/repairs-per-year.ts:5`). Each row's note names today's material (D10, C4, R82).
- **Lighter controls**: stepped scales, picture-tile trays, slim pairs, and "Not sure" as a quiet link (D8).
- The layout spec deliberately defers the condition per material (R78), stories and garage (R80), and paint as a home fact (TS3b.4).

**What this means for TS3b.4:**
- Design TS3b.4's inputs *into* those slots: the Current materials tab, the Upgrades receipt rows and the Upkeep notes. Do not design them into today's `UpgradesTab` or `HomeFacts`; the layout spec deletes `upgrades-tab.tsx`, `scope-chips.tsx` and the rest (its §11).
- TS3b.4 owns:
  - the data and model: new materials, states, figures, era templates, offered-upgrade rules;
  - the drawing: worn and new looks, condenser sizes, ducts, shingle colour, windows, paint;
  - which rows and choices appear.

  The layout spec owns the panel's shell and its controls.
- **Ask the owner which builds first**, the layout or TS3b.4. If the layout is first, TS3b.4's plan builds on its components. If TS3b.4 is first, its inputs must go somewhere temporary, and that work gets thrown away. Claude recommends the layout first.
- The R67 mockups should extend the layout studies artifact, in the same visual language, rather than start a new study.

## 5. What the code already has (checked 2026-10-23)

Paths are under `src/features/trade-scenes/` unless they start with `construction/` (= `src/shared/modules/construction/core/`).

- **Windows:**
  - The profile records `windowsType` (single/double), and the house draws its frames from it (`ui/components/home-kit/house-shell.tsx:75`).
  - The heat figures exist: `WINDOW_HEAT_EFFECTS.double` in `constants/home-heat-figures.ts:111`, applied in `lib/home-heat.ts:46`.
  - **But `resolve-scene.ts:84` passes the profile's windows to both builds**, so no upgrade swaps them in the Tri Pros build yet.
- **Paint:**
  - The `ExteriorPaint` type is `'regular' | 'cool'` (`types.ts:327`).
  - The heat figures exist: `PAINT_HEAT_EFFECTS.cool` in `constants/home-heat-figures.ts:119`, applied in `lib/home-heat.ts:47`.
  - **But `resolve-scene.ts:85` hard-codes `paint: 'regular'`**: no input sets it and no upgrade swaps it.
  - The `exterior-wall` assembly has standard and cool paint, with a worn state (`construction/constants/assemblies/exterior-wall.ts:21-22`).
- **Ducts and condenser** live in the `hvac-attic` assembly: `leaky-flex` R-4 → `sealed-insulated` R-8 (line 14-15), and `standard-seer` → `high-seer`, with worn copy (line 19-20).
  - The house draws the condenser in `ui/components/home-kit/condenser-unit.tsx` and `home-equipment.tsx`.
  - There is no size anywhere.
  - Only `roof-attic` has an up-close kit (`constants/assembly-kits.ts:17-19`). A throwaway `hvac-attic` kit drew fine in TS3 (tracker §6, 2026-10-17), so the kit contract holds.
- **Era defaults:** only insulation follows the era (`INSULATION_BY_ERA`, `construction/constants/era-defaults.ts:7`).
- **Worn state:**
  - The roof's existing parts are inferred worn at every era (`construction/lib/assemblies/roof-attic/infer-existing-conditions.ts:30-36`, gutters included). This is an owner claim-risk item in tracker §2a: every home leaks in Rain.
  - The shingle palette has worn and new tones (`constants/home-palette.ts:45-46`).
- **The scene's work inputs** are `proposedScopeIds` and `addOns` (`types.ts:63-64`). `SceneResolveInputs` (`types.ts:77`) is what `resolveScene` reads. A new upgrade either becomes a scope (with installs and a bill cut) or an add-on; decide which per upgrade, in the spec.
- **Architecture rules** (memory, foundation spec):
  - One pure `resolveScene` feeds the home kit, the assembly kits and the panel.
  - three.js code lives only in `ui/`; `scripts/verify-trade-scene.ts` guards that.
  - A new assembly kit registers in `ASSEMBLY_KITS`, `ASSEMBLY_KIT_COMPONENTS`, the existing-conditions inferrer, `ASSEMBLY_HEADINGS` and `ANCHOR_PIN_LABELS`; the script asserts all five.
  - Figures are hand-tuned examples, not physics (R43), and all live in one table, `constants/home-heat-figures.ts`.

## 6. Owner rules for every trade-scene session

- **Parallel sessions:** others edit trade-scene files in parallel, both the TS3b.3 build and UI/layout work. Never revert their edits.
- **Committing:**
  - Commit by explicit path only. Never use `git add -A`, stash, reset, `checkout --`, `--amend`, or push.
  - Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - The pre-commit hook takes about 110 s, so use a 300 s timeout.
- **Uncommitted docs that are not yours:** right now `CONTEXT.md`, the tracker, the TS3b.3 spec and plan, and the layout spec are all uncommitted and belong to other sessions. Don't stage them unless the owner asks. If you need to edit the tracker, edit it in the working tree and say so.
- **Never:**
  - run `pnpm build`;
  - start, stop or restart dev servers (:3002 is the owner's);
  - edit `eslint.config.js` or `package.json`;
  - write to any database.
- **Don't touch:**
  - `src/features/meeting-visualizations/`;
  - `/dashboard/labs/roof-cutaway`;
  - the cutaway look-dev files;
  - `src/shared/components/scene/` without asking.
- **Scope is the spec.** A shared file the spec doesn't name needs the owner's OK first.
- **Words:**
  - Never mention solar; Tri Pros no longer sells it.
  - New domain terms (for example "material condition", "era template") need the owner's agreement and go into `CONTEXT.md`.
  - Existing terms to reuse: home view, lens, home stress, build switch, dock, scene panel.
- **Code comments** say why, never what.
- **Screenshot rounds** run as subagents. `.superpowers/sdd/2026-10-21-heat-through-the-whole-home/shots-callout2-brief.md` is a brief pattern worth copying.
- **Talking to the owner:** plain language, one question per message, and the recommended option first when giving choices.

## 7. Questions to raise early (most decisive first)

1. **Order against the layout build:** does TS3b.4 land after the glass-HUD layout is built? (Recommended: yes.)
2. **R78 (condition per material):** in TS3b.4 or later? This decides R63 (roof age, paint condition) and R66 ("done in the last…").
3. **Condenser size (R35):** where does 3, 4 or 5 tons come from?
4. **Up close for the new upgrades:** do windows, paint, ducts and the condenser each get an up-close kit (like `roof-attic`), or only a swap on the house for now? Kits are much bigger work.
5. **Re-picking the era (R64):** does it overwrite what the rep already corrected?
6. **Crawl-space insulation (R75, R77):** in TS3b.4's upgrade list?
7. **Shingle colours (R51):** which colours, and does a cool shingle limit the choice?
8. **Ducts:** confirm the R-8 → R-6 change in the `hvac-attic` data. It also moves any duct bill cut or reading that reads the R-value.

## 8. How to run the session

1. Invoke `superpowers:brainstorming`. Lead with §7's question 1 (or the owner's own description of what they want); one question per message.
2. For the inputs (R64–R67), run mockups through the layout studies artifact, or `/ui-warmup` then `/impeccable`. The owner picks before the spec is final.
3. Write the spec to `docs/superpowers/specs/2026-10-2X-upgrades-that-follow-the-home-design.md`. Log every owner ruling in the tracker register and change log first.
4. Run the builder check, then bring back the questions only the owner can answer, then get approval.
5. Run `superpowers:writing-plans`. Offer the owner `/stress-test-plan` before execution.
6. When done, update the TS3b.4 row in tracker §2 and the memory file `project-3d-trade-scenes.md`.

## 9. State of the branch at handoff

- **TS3b.3 (the home views and the Thermal lens)** is being built by another session, subagent-driven.
  - Tasks 1–7 are committed, from `913ac94f3` to `947184d95`.
  - Task 8 (the screenshot round and tuning) is in progress; its ledger is `.superpowers/sdd/2026-10-23-home-views-and-thermal-lens/progress.md`.
  - TS3b.4's build must start after TS3b.3 is finished, since both touch `home-kit/`, `resolve-scene.ts` and the heat figures.
- **TS3b.1 and TS3b.2** are built and waiting for the owner's review.
- **The layout spec** (glass HUD) is a draft, stress-tested and amended. Its plan is not written yet.
- Nothing is merged or pushed. The owner has not chosen merge or PR; never choose for them.
