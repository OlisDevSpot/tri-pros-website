# Handoff: TS3b.7, the home over time

**Written:** 2026-11-03, for a fresh session that starts the TS3b.7 brainstorm.
**Your job in that session:** the design stage only: brainstorm (superpowers:brainstorming), the spec, the builder check, then the plan (superpowers:writing-plans) and `/stress-test-plan`. **Build nothing** until the owner approves the spec and then says "build" or "execute". "Go ahead" does not count as permission to build.
**Branch and worktree:** `feat/trade-scenes-foundation` in `.worktrees/trade-scenes`. Run every command from there.

---

## 1. What the owner wants

Today the scene sells energy: heat through the roof, walls and windows, and the bills. TS3b.7 makes it sell **home health** too. A home under stress gets worse over the years, the upgrades stop that, and that is a better financial position, not only a lower bill. In the owner's words it is **home stress**: the stress a home takes over time, given its condition (the term is agreed and in `CONTEXT.md`; the good side is *home health*).

The owner's examples, all logged in the tracker:

- **A storm weather (R70)**, harder than Rain, so an old roof visibly takes more stress. It follows the roof's condition, which is now the roof's wear (R84 absorbed R63's roof age).
- **Mold where a roof leaks (R71).** The scene already leaks: in Rain a worn roof drips through the ceiling into a bucket and leaves a stain. Mold is what that leak becomes over time.
- **Earthquake strain on a raised foundation (R71).** Small quakes, year after year.
- **Cracks opening in the exterior walls over time (R71).** Paint wear already draws cracks, stains and peeling, at a level the rep sets (R121). Don't build a second crack system. Design the "over time" on top of the one that exists.
- **Attic dust drifting into the rooms (R104)** through every unsealed ceiling gap (register boots, recessed lights, pipes), as faint specks falling in every view, not only Thermal. Air sealing stops it.
- **A wear timelapse (R97)**, logged separately but the same idea: a slider ages a material forward, and the efficient product wears more slowly. Decide with the owner whether it joins this row.

The tracker row says TS3b.7 is **big enough to become its own epic stage after TS4**. Settle its size and split with the owner first.

## 2. Which part of the tracker this is

Tracker `docs/plans/2026-10-16-trade-scenes-epic.md`:

- **§2 row TS3b.7** ("proposed, place in the order with the owner"): R70, R71, R104. Add R97 if the owner agrees.
- **§3:**
  - R70, R71, R97, R104;
  - R84–R88: wear, its age bands, upkeep by wear;
  - R121 and R203–R205: paint wear;
  - R107: the ceiling's openings;
  - R109: air sealing's foam rings;
  - R131 / T19: a typical day with a time-of-day slider, a different time axis from "over the years";
  - R136: shared system parts. The ceiling is lit in the attic system for its air gaps and "mold later, a home stress, TS3b.7";
  - R216: Benefits' kinds, including **Protection** and **Lasts longer**;
  - R218–R222: Benefits' future savings and its calendar look-ahead.
- **§6, the change log** from 2026-10-22 (where R70 and R71 were logged) on.

## 3. Calls the brainstorm must settle

1. **One project or several.** The storm (a fifth weather) is a scene feature. Mold, the foundation strain, the cracks and the dust are "over time" stories. The dust is an every-view effect. Propose a split, for example 7a the storm and 7b home stress over time, and let the owner pick the order.
2. **What "over time" is on screen.** Options:
   - a years-ahead slider on the whole home;
   - a home-stress lens beside Thermal: lenses are a defined term (R72); Thermal is the only one built, and X-ray is deferred;
   - per-system stories up close.

   **Benefits already has a time axis:** the calendar look-ahead that "teleports into the future" for future savings (R219, R220, being built now). Ask whether home stress rides that same timeline, so one picked year shows both the bills and the home's health. A second, unrelated time control would be a bad sign.
3. **Today's wear vs what happens next.** Wear (Condition) is today's state, picked by the rep. Stress is how it progresses. Decide whether stress moves wear forward along the age bands (R85) or stays a separate overlay, and what the Today ⇄ Build toggle shows: the build ages slower, or not at all.
4. **The storm, concretely.** A fifth entry in `SCENE_WEATHERS` (`constants/scene-controls.ts`) touches:
   - the dock tiles: Controls' residual is that on short wide stages the rail already overlaps the Rain tile;
   - the shortcut keys `1`–`4` (`constants/scene-shortcuts.ts`);
   - the sky (`constants/weather-skies.ts`, the self-hosted 512×256 sky);
   - the rain and leak kit (`home-rain.tsx`, `ceiling-leak.tsx`, `leak-*.tsx`);
   - `RAIN_PRESET_WEATHER` in `constants/home-temperatures.ts`.

   Decide whether a storm is water mode only, like Rain.
5. **What can't be drawn yet.**
   - Earthquake strain needs the foundation modeled. The crawl space has no system view yet (TS3b.4b left it out), and its kit is tally item T7.
   - Mold on the ceiling depends on how TS3b.4b lights the ceiling (R136).
   - Say plainly which examples wait for which work, rather than designing around missing models.
6. **Claims.** "Your roof will grow mold" is a claim, like every Benefits statement (R215, R226: Claude drafts, the owner approves each one).
   - Ask the owner how hard the scene should press. Tri Pros sells on human psychology, not fear, so confirm the tone before drawing anything scary.
   - Tie each stress to a Benefits Protection or Lasts longer statement so the picture and the words agree.
7. **Budget.** Draws and triangles are tight.
   - Measured on the head after paint wear: raised pitched 198, slab flat 164 draws, against a ceiling of about 177 on the default view.
   - 6-B still needs its share. 6-A's figures are in the TS3b.6 row.
   - Falling dust and storm rain are particles: price them in draws and triangles, and plan reduced motion (they hold still, like the ribbons).

## 4. What is building around you (2026-11-03)

- **Benefits** is being built in this worktree by subagent-driven development, at Task 8 of 12 at writing. It changes `controls-window.tsx`, the Benefits context and the upgrade registry in `src/shared/modules/construction/`. Don't edit those files.
- **Layout L1+L2** (the lot as data) is built in `.worktrees/scene-layout-lab`. L3 redraws the house from masses, so a stress drawn on house walls must survive that.
- **TS3b.4b** (up close on a system) is re-planned after Benefits lands. Its system parts and lighting are where mold and the ceiling story live.
- **Order:** TS3b.7's build follows TS3b.4b, since both touch the heat, weather and ceiling files. Design now.

## 5. Read first, in this order

1. The tracker: the status line at the top, the §2 rows (TS3b.7, TS3b.4b, Attic, Paint wear, Benefits, Layout), then the §3 rows listed in §2 above.
2. Memory `project-3d-trade-scenes.md` (loads automatically). Its top block is the current state.
3. `CONTEXT.md`, the trade-scene terms: wear, paint wear, weather, home stress, lens, home view, existing conditions, proposed build, system card. Use them as written. A new term goes in only after the owner agrees it.
4. The paint wear spec (`docs/superpowers/specs/2026-10-30-exterior-paint-wear-kinds-design.md`) and its follow-ups spec: the model a "cracks over time" story extends.
5. The Benefits spec (`docs/superpowers/specs/2026-11-03-trade-scene-benefits-design.md`): the kinds, the statements and the calendar look-ahead.
6. The code, which is the source of truth:
   - `src/features/trade-scenes/`:
     - constants: `wear-looks.ts`, `wear-tones.ts`, `paint-wear.ts`, `home-temperatures.ts`, `scene-controls.ts`, `weather-skies.ts`;
     - lib: `paint-wear-in-force.ts`, `stucco-cracks.ts`, `roof-cracks.ts`, `painted-surface-stains.ts`, `paint-peeling.ts`;
     - home-kit: `home-rain.tsx`, `ceiling-leak.tsx`, `leak-bucket.tsx`, `leak-drip.tsx`, `leak-stain.tsx`, `paint-marks.tsx`, `paint-stains.tsx`.
   - `lib/resolve-scene.ts` is the one resolver every surface reads; a new stress figure belongs there or below it, never in a component.

## 6. Standing rules

- Never run `pnpm build`. Checks run under the lock:
  - `flock /home/olis-solutions/olis-v3/nextjs/tri-pros-website/.superpowers/heavy.lock pnpm tsc`
  - `flock … env CI=1 pnpm eslint <files>`
- No DB writes of any kind, not even for screenshots.
- Shots use the owner's dev server on :3002.
  - Never start a dev server, and never `rm -rf .next`.
  - Sign in with `/api/dev/playwright-session?…&as=info%40triprosremodeling.com`, never `role=`.
- Commit by explicit path, or with `git apply --cached` for your own hunks in a file another session also edits; the tracker and `CONTEXT.md` usually are.
  - Never `git add -A`, `git stash`, `git reset` or `git checkout -- <file>`.
  - Use a 300000 ms timeout on commits.
- Before quoting a doc or memory, check the code. If they disagree, write `⚠️ Stale ref — <doc>:<line> says X, but code at <path> does Y`, and favour the code.
- Comments in code say why, never what, and never cite a plan or spec.
