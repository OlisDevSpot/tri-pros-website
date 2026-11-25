# Handoff: real-world models for the heating & cooling components

**Written:** 2026-11-15, at `699e7fbdf` (heating & cooling plan Tasks 0–11 built; an owner-correction task and the heat pump still in flight).
**For:** a fresh session, in parallel with the heating & cooling build.
**Your job:** make the blower, furnace, evaporator coil, plenum and condenser (and the heat pump outdoor unit once it exists) read as the real equipment an installer shows a homeowner, and show each component well in Look inside.
**Worktree and branch:** `.worktrees/trade-scenes`, `feat/trade-scenes-foundation`, shared with the heating & cooling build session. No new branch.

## 0. Gates

1. **Phase A (now, in parallel): new files only.** The heating & cooling build is still editing `indoor-unit.tsx`, `hvac-closet.tsx`, `attic-ducts.tsx`, `home-equipment.tsx`, `home-kit.tsx`, `condenser-unit.tsx` (heat pump look), the placements and the checks. Until its ledger says the final review is done, never edit an existing file under `src/` or `scripts/`. Work in new files only (e.g. `src/features/trade-scenes/ui/components/home-kit/hvac-models/`) and preview them in a standalone way that adds no edit to an existing file. If a preview needs an existing file touched (a lab route, a registry), stop and ask the owner.
2. **Phase B (wiring): only after** `.superpowers/sdd/2026-11-13-heating-and-cooling-system/progress.md` records the final whole-branch review as clean and `git status --short -- src scripts` shows none of that build's files. Then swap the models into the existing components.
3. **Direction first.** Nothing has been decided about the look. Start with the owner: the UI methodology in memory (`feedback-ui-work-methodology.md`; `/ui-warmup` when no direction is picked) — show options before building. The owner must say "build", "execute" or "run" before any plan executes.

## 1. What the owner asked (2026-11-15, verbatim intent)

- "The models for blower/furnace/coil/plenum should be heavily worked on … presenting more real-world models for these important components, and generally be able to showcase the components better. This also includes the condenser."
- The same day the owner ruled, and the build session is implementing: the horizontal attic unit reads as the air's path — a big return grille in the ceiling, a return duct into the cabinet's return end, then blower → furnace → coil → plenum as one tube the air passes through (furnace working in heat, coil in cool); the HVAC closet stands central in the house with its plenum at the same attic spot as the attic unit's plenum; a central system is never A/C-only. Your models must fit that, not the earlier layout.

## 2. What the models must fit (read the code; it is the source of truth)

- **Sections and sizes:** `src/features/trade-scenes/constants/indoor-unit-placements.ts` (`IndoorUnitPlacement`: `upright`, `base`, `toward`, `section [width, depth]`, `lengths` per `blower | furnace | coil | plenum`) and `lib/indoor-unit-boxes.ts` (`indoorUnitBoxes`: contiguous boxes, a missing furnace or coil closes up — a heat pump has no furnace). A model takes its section's box as props; it never moves the line.
- **Tags:** each section is tagged `systemPartTag('<id>')` so Look inside can emphasise/fade it; keep one tag per section, on the model's group.
- **Running cues (keep them working):** the furnace takes the heat glow (`useHeatGlow`, a material ref) in winter; the coil reads the cooling side in summer; the condenser's fan spins on a burst (`condenser-fan.tsx`); thermal tags come from the nearest ancestor's `thermalZone` (`ui/lib/thermal-paint-set.ts`). Who runs when: `lib/hvac-running.ts`.
- **Condenser / heat pump:** `ui/components/home-kit/condenser-unit.tsx`; the heat pump outdoor unit (built after this handoff) is "the condenser's look with a difference the rep can see" — coordinate rather than duplicate.
- **Look inside:** views in `constants/system-camera-views.ts` (`indoor-attic`, `indoor-closet`, the condenser part look); pins in `lib/system-part-focus.ts`. Showcasing a component better may need a part look per component: propose it to the owner, don't assume.
- **Budget:** draw calls are recorded against the TS3b.6 budget (record, don't stop). Baseline 141 for the default home; the indoor unit adds about 7–10 today. Geometry and materials are built once (module level or memoized), never per render; merged boxes where a model is many small parts.
- **Never sweep the scene in a software-rendered browser:** one case per probe run (a multi-case sweep crashed the machine). The heating & cooling probe is `node <scratchpad of the build session>/hvac/probe.mjs --case <name> --out <dir>`; write your own for Phase A previews. Only Oliver starts the dev server (port 3002).

## 3. Rules that bind every change

- Comments say why, never what; never cite a plan, spec, task or ruling in code.
- Stage by explicit path; no `git stash`, `checkout` or `reset`; a file holding someone else's hunks: stop and report.
- Pre-commit hook takes about 110 s: commit once per task, 300000 ms timeout. Messages end with the Co-Authored-By line.
- Checks: `pnpm tsc`, ESLint on the paths you touch, `pnpm tsx scripts/verify-heating-cooling.ts`, `verify-trade-scene.ts`, `verify-trade-scene-layout.ts`, `verify-trade-scene-lot.ts`.
- Domain words: CONTEXT.md (Indoor unit, HVAC closet, Wall furnace, Wall unit, Mini-split head, New-cut, Heat pump).
