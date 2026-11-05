# Handoff: TS3b.4b, the up-close screens

**Written:** 2026-10-30, for a fresh session that starts the TS3b.4b brainstorm.
**Your job in that session:** the design stage only: brainstorm, spec, builder check, then the plan. **Build nothing** until the owner approves the spec and then says "build" or "execute". "Go ahead" does not count as permission to build.
**Branch and worktree:** `feat/trade-scenes-foundation` in `.worktrees/trade-scenes`. Run every command from there.

---

## 1. What the owner wants

Today the scene has one up-close screen: **roof & attic**. The rep taps *Inside the roof* and the camera glides into a cut slice of the roof, where the layers peel back and the heat flows. TS3b.4b turns that one screen into four **systems** the rep can go up close on during a sale:

- **Roof system:** the covering down to the deck and rafters, plus drip edge, ridge vent and gutters. No ceiling or insulation.
- **Attic system:** ceiling, air sealing, insulation, radiant barrier, and the attic fan on its gable end (R106). Today's roof & attic screen splits in two to make the roof and attic systems.
- **Window system:** new. Frame, glass, the gap between the panes, seals, flashing.
- **Crawl space system.**

On the attic screen, the rep must be able to **compare replacing the insulation with topping it off** (R60).

Heating & cooling and paint up close come later, if at all.

## 2. Which part of the tracker this is

Tracker `docs/plans/2026-10-16-trade-scenes-epic.md`:

- **§2, row TS3b.4b "Up-close screens"**, R60 and R92. Its parent row is TS3b.4, which the owner split in two on 2026-10-24. TS3b.4a (conditions and upgrades on the house) is built.
- **R92** (§3b) is the scope above, word for word. **R60** is replace vs top off: both picks were built in TS3b.4a (R81: insulation is top off *or* replace, never both), and comparing them up close is 4b's job.
- **The TS3b.4a spec, §10** (`docs/superpowers/specs/2026-10-24-upgrades-that-follow-the-home-design.md`) recorded the owner's 4b decisions before this brainstorm. One of them is a Claude call to confirm: rafters stay with the roof system. The foundation system is out of scope (§5 below).
- **Neighbouring rows to design around:**
  - **Attic** (R105–R111): gable vents, the attic fan, ceiling openings, hung ducts, foam collars. Spec `docs/superpowers/specs/2026-10-30-attic-ventilated-and-sealed-design.md`, stress-tested 2026-10-30, no plan yet.
  - **Camera** (R103): the slide works up close too. Plan `docs/superpowers/plans/2026-10-28-scene-camera-slide.md`, being built now by another session.
  - **TS3b.5** (R52, R55): tap a part to pick its upgrade; jump into any section.
  - **TS3b.6:** better models, in design.

## 3. Is anything blocking the brainstorm?

No. Nothing in the code or the tracker stops a design session. Settle these in it:

1. **The attic work lands first, and its spec already designs part of your attic screen.**
   - The attic spec builds "before TS3b.4b".
   - It puts the attic fan and a gable-end stub into **today's single roof & attic slice**, and says the fan and its gable end move to the attic screen when 4b splits that screen.
   - Read it in full. Design the attic system on top of it, not beside it, and keep its rulings: foam collars show only with no insulation; leaks show as heat arrows in Thermal; the fan only runs over about 100 °F attic air; R111 hides attic-only upgrades on a flat roof.
2. **What a screen is in code.** Today, up close is keyed by **assembly**:
   - `TradeSceneInputs.zoom: AssemblyId | null` (`src/features/trade-scenes/types.ts`);
   - `ASSEMBLY_KITS`, `ASSEMBLY_SCREENS` and `ASSEMBLY_HEADINGS` are all keyed by `AssemblyId`.
   - Roof and attic are **one** assembly, `roof-attic`, whose parts carry `group: 'roof' | 'attic'` (`src/shared/modules/construction/core/constants/assemblies/roof-attic.ts`).

   To split it, either:
   - **(a)** give the screen its own id: a system that names an assembly plus a part group;
   - **(b)** split the assembly itself. That reaches the shared construction core, the scope installs, the bill cuts and the ROI calculator that reads them.

   This is a design decision to make with evidence: read the readers before you recommend. (a) looks smaller.
3. **"System" already means something on screen.** TS3b.4a groups the Upgrades rows by system: Roof & gutters, Attic, Windows, Walls, Heating & cooling, Foundation. Foundation replaced Crawl space there (owner, 2026-10-25). R92 says "crawl space system".
   - Settle whether the up-close systems are the same list, with the same names, as the Upgrades groups.
   - Record any new term in `CONTEXT.md`, but only after the owner agrees it.
4. **Two of the four have no kit yet, and the sizes vary by home.**
   - **Windows:** the assembly exists as data only, with parts `frame` and `glazing` (`single-pane`, `double-pane`). The 4a spec says 4b adds `gap`, `seals` and `flashing`, plus the up-close kit.
   - **Crawl space:** the assembly exists. There's a whole-home crawl framing in `home-camera-rig.tsx`, and an `under-floor` anchor in `constants/home-anchors.ts`. A slab home has no crawl space.
   - **There is no window anchor.** Today's anchors are `roof`, `attic`, `exterior-wall`, `yard` and `under-floor`.
   - **The flat (low-slope) roof** has no attic (R111). Decide what the attic system shows there, or whether it shows at all.
5. **How the rep gets to each screen.** Today the only way in is the *Inside the roof* pin. TS3b.5 (tap a part, jump into sections) is a separate row, and its double-tap rule matters here: the first tap of a double-tap also arrives as a tap. Keep 4b's entry points simple and don't build TS3b.5. Do make sure the design doesn't block it.
6. **Shared files with sessions running now.** At writing, the camera-movement session is building its plan. Its Tasks 6–8 edit `home-camera-rig.tsx`, `verify-trade-scene.ts` and `home-geometry.ts`. The attic build will edit the roof & attic kit, its flows and `attic-ducts.tsx`. Plan 4b's build after both, or split it by file, and say which in the plan.
7. **TS3b.4a still awaits the owner's look.** It's built and reviewed, but the owner hasn't signed off, and a few product calls are open (in its ledger, `.superpowers/sdd/2026-10-24-upgrades-that-follow-the-home/progress.md`). 4b sits on 4a's wear and upgrade rows. If the owner changes 4a, revisit 4b's spec.

## 4. Read first, in this order

1. **The tracker:**
   - §2 rows TS3b.4, TS3b.4a, TS3b.4b, Attic, Camera, TS3b.5;
   - §3 rows R8, R52, R55, R60, R73, R77, R81, R84–R95, R92, R103, R105–R111;
   - §6, the change log from 2026-10-24 on.
2. **Memory** `project-3d-trade-scenes.md` and `project-trade-scene-layout-exploration.md` (both load automatically).
3. **`CONTEXT.md`:** the trade-scene terms (home view, Complete, Partly open, lens, wear, home stress, system…). Use them as written.
4. **The TS3b.4a spec**, mainly §4 (the assemblies resolved, the build's swaps), §7 (wear looks) and §10 (4b).
5. **The attic spec**, in full.
6. **The camera spec and plan**, for the up-close slide and what going up close or back out does to it.
7. **The code** (the source of truth):
   - `src/features/trade-scenes/ui/components/assembly-kits/`: `assembly-kit-host.tsx`, `kit-part.tsx`, and `roof-attic/` (the one kit today: its parts, its coverings per material, `slope-frame.tsx`, `kit-walls.tsx`, `roof-attic-flows.tsx`, `part-thermal-paint.tsx`, rain and leaks);
   - `src/features/trade-scenes/constants/`: `assembly-kits.ts` (the kit registry, part focus, emphasis framing), `assembly-screens.ts` (a screen's blocks: peel, then parts), `roof-attic-kit.ts`, `roof-attic-flows.ts`, `home-anchors.ts`, `wear-looks.ts`, `home-scene-copy.ts` (`ASSEMBLY_HEADINGS`);
   - `src/features/trade-scenes/ui/components/panel/assembly-screen.tsx` and `assembly-screen-block.tsx`: the card's up-close view;
   - `src/features/trade-scenes/lib/resolve-scene.ts`: the one resolver every surface reads. Since 4a, every assembly that applies to the home is resolved, whether or not it has a kit, so adding kits does not change the savings.
   - `src/shared/modules/construction/core/constants/assemblies/`: `roof-attic.ts`, `windows.ts`, `crawl-space.ts`.

## 5. Out of scope unless the owner pulls it in

- **Heating & cooling and paint up close** (R92: later, if at all).
- **The foundation system** (owner, 2026-10-25): the vapor barrier on the crawl floor, foundation work and the basement as a third foundation type. 4a ships crawl space insulation up to R-19 only.
- **Tap a part, jump into sections** (TS3b.5).
- **Better models and realism** (TS3b.6).
- **Attic dust** (R104, TS3b.7).

## 6. How to run the brainstorm

- **Use `superpowers:brainstorming`.** Ask one question at a time, with a recommendation each time.
- **Capture today's baseline first**, with your own browser: a local playwright script against `/dashboard/labs/trade-scene` on the owner's dev server at :3002. Get screenshots up close at an iPad landscape size (1194×834) and at 1280×800, on a pitched and a flat roof, in Normal, Summer, Winter, Rain and Thermal, at several peel depths.
- **Show screens concretely before asking for a pick.** The owner judges visual work by eye. Where the look of a new screen (window, crawl space) or the R60 comparison is open, build a studies page (`/ui-exploration` or `/ui-warmup`) with two or three directions beside the real screenshots.
- **Likely topics**, each with a recommendation:
  - the screen id vs splitting the assembly (§3, point 2);
  - the four systems' names, and how they match the Upgrades groups;
  - how replace vs top off compares: side by side, a before/after on one slice, or a toggle;
  - each screen's parts, peel order, heat and water flows, thermal paint and readings;
  - how wear shows up close (the five wears, the build's new part reading as new);
  - what each screen shows on a flat roof and on a slab;
  - the camera framing and the visible area beside the card on iPad;
  - the heading copy per system;
  - the build order against the attic and camera work, and how the plan splits by file.
- **After the plan:** run `/stress-test-plan` before asking the owner to build.

## 7. Rules for the session

- **Requirements change in the tracker first:** a register row or a status change, plus a §6 change-log line, then the spec.
- **Other sessions work in this worktree at the same time.**
  - Uncommitted files and hunks are theirs: parts of the tracker, `CONTEXT.md`, several untracked specs, plans and handoffs. Never revert them, stash, checkout or reset.
  - Commit only your own files, by explicit path. For a shared file like the tracker, stage only your own lines.
- **The dev server on :3002 is the owner's.** Never start, stop or restart it, and never `rm -rf .next`.
- **Playwright sign-in:**
  - use `/api/dev/playwright-session` with `as=` only, never `role=` (that is a database write);
  - read the secret into an environment variable from `.env.local` and never print it;
  - make no database writes for testing.
- **Checks:** run `pnpm lint` and `pnpm tsc` only, never `pnpm build`.
- **Stale ref to flag to the owner, not fix silently:** the tracker's status line (line 3) still says "TS3b.1 and TS3b.2 built, TS3b.3 next", but §2 marks TS3b.3, the glass-HUD layout, TS3b.4a and the iPad pass as built.
