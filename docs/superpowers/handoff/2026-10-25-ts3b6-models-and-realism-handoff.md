# Handoff: TS3b.6, better models and a more lifelike scene

**Written:** 2026-10-25, for a fresh session that starts the TS3b.6 brainstorm.
**Your job in that session:** run the design stage only: brainstorm, spec, builder check, then the plan. **Build nothing** until the owner approves the spec and then says "build" or "execute". "Go ahead" does not count as permission to build.
**Branch and worktree:** `feat/trade-scenes-foundation` in `.worktrees/trade-scenes`. Run every command from there. Head at writing: `71cd39fa4`.

---

## 1. What the owner wants

Improve the scene's models, their look and their realism, so the home feels lifelike: better people, real-looking equipment, a house, lot and surroundings that read as a real Southern California home. The homeowner should look at it and see *a home like theirs*, not a toy.

## 2. Which part of the tracker this is

Tracker `docs/plans/2026-10-16-trade-scenes-epic.md`:

- **§2, row TS3b.6 "Better people and props"** (R34, the rest). The row says sourcing can run alongside the other projects, and some downloads are the owner's to do by hand.
- **R34** (§3b, Models): the people don't look good; the rafters clip through the roof (built in TS3b.3, confirm on screen); the HVAC condenser should look like a real condenser.
- **R69**, last sentence: "a richer, more detailed Southern California home, lot and surroundings is wanted too, but in its own modeling plan later." No §2 row exists for it yet. **Settle with the owner whether it joins TS3b.6 or gets its own row** (for example TS3b.6a people and props, TS3b.6b home, lot and surroundings).
- **§2a, Look pick**: seated residents read as standing from the front; the asset pick sheet (child, wall unit, window unit, bucket, blanket and hand fan are code-built stand-ins; Quaternius packs could replace them, downloaded by hand from itch.io); the home reading as a flat purple box under the thermal camera; the peeled ridge vent floating.
- Related, not in scope unless the owner pulls them in: **R80 / T15** (stories, garage, two-story homes), **T16** (a commissioned asset set replacing the CC0 packs), **T1** (metal roof).

## 3. Is anything blocking the brainstorm?

The brainstorm can start. Nothing in the code blocks a design session. These must be settled in it, or before the build:

1. **R9 conflicts with the ask. Raise it first.** R9 (agreed 2026-10-16) set the style as *warm stylized*: soft, rounded, matte, game-like, faceless residents. *Near-realistic* was an option the owner did not take. "Realism" and "lifelike" reopen it. Ask the owner where the bar sits, and show it, don't describe it (see §6). Any change goes into the register first with a §6 change-log line (R22), then into the spec.
2. **The order (settled 2026-10-25).** The owner agreed this design runs now, alongside TS3b.4a, out of the one-at-a-time order; it is documented in the tracker's TS3b.6 row and §6. The build follows TS3b.4a or splits by file (point 3).
3. **The build overlaps TS3b.4a's files.** Plan `docs/superpowers/plans/2026-10-24-upgrades-that-follow-the-home.md`, Tasks 9 and 10, edit `house-shell.tsx` (window frame, glass, paint), `condenser-unit.tsx`, `attic-ducts.tsx`, `constants/home-palette.ts`, the roof covering layouts, and create `package-unit.tsx`, `constants/wear-looks.ts` and `lib/worn-color.ts`. A model pass touches the same files. Plan the build after TS3b.4a lands, or split it by file (residents, furniture, yard, sky and lighting first). **Design against TS3b.4a's wear API** (`WEAR_AMOUNT`, `wornColor`, `PartState.wear`): every new model and material must still show the five wears, and the build's new part must still read as new.
4. **No performance budget yet.** TS3b.3's frame time on the Complete home with Thermal was 39% above the TS3b.2 baseline in software rendering; draw calls are down to 63 after the fix, but the iPad check is still owed (memory `project-3d-trade-scenes`). Realism costs GPU. Get a real-iPad baseline, or agree a budget with the owner (triangles, textures, draw calls, frame time), before choosing assets. R23 stands: the iPad stays cool through a 1 to 2 hour meeting; the canvas runs `frameloop="demand"`, `dpr={[1, 2]}`.
5. **Assets.** R18 says free CC0 packs, recoloured to our palette, with the house itself built in code. Some downloads (itch.io) are the owner's to do by hand. Every third-party file is recorded in `public/scenes/LICENSES.md`. AI-generated GLBs and a commissioned artist were options not taken (R18, T16); the Higgsfield image-to-3D skill exists if the owner reopens that.

Not blocking: TS3b.1, TS3b.2, TS3b.3 and the glass-HUD layout are built, unmerged and awaiting the owner's review. Design on the branch head.

## 4. Read first, in this order

1. **The tracker**: §2 (order), §3 R9, R18, R20, R23, R34, R69, R80, §2a (look pick), §5 (T15, T16), §6 (change log).
2. **Memory** `project-3d-trade-scenes.md` (loads automatically): the epic's state and rulings.
3. **`CONTEXT.md`**: the trade-scene terms (home view, Complete, Partly open, lens, wear, home stress…). Use them as written; agree any new term with the owner first.
4. **The TS3b.3 spec** `docs/superpowers/specs/2026-10-23-home-views-and-thermal-lens-design.md`: the Complete house, the part fades, floor heights.
5. **The TS3b.4a spec and plan** (`docs/superpowers/specs/2026-10-24-upgrades-that-follow-the-home-design.md`, plan above): §7 is how parts will look their wear and how the build swaps parts.
6. **The code** (source of truth), in `src/features/trade-scenes/`:
   - `ui/components/home-kit/`: the house, roof, rooms, residents, equipment, yard and sky, almost all built in code;
   - `constants/home-furnishings.ts`, `constants/resident-clips.ts`, `constants/home-palette.ts`;
   - `src/shared/components/scene/`: `scene-shell.tsx`, `scene-lights.tsx`, `thermal-material.tsx`, `animated-figure.tsx`, `loaded-figure.tsx`, `hooks/use-gltf-asset.ts`;
   - `public/scenes/home/*.glb` and `public/scenes/LICENSES.md`.

## 5. What exists today

- **Loaded models (CC0):** a man and a woman (Quaternius, rigged and animated), the condenser (Quaternius "Air Conditioner"), and Kenney furniture (sofa, bed, stove, fridge, TV, ceiling fan). Resized and meshopt-compressed with gltf-transform.
- **Code-built:** the whole house (shell, roof slopes and coverings, foundation, rooms, attic floor and ducts), the yard, sky and weather, and the stand-ins: child, wall unit, window unit, bucket, blanket, hand fan.
- **Constraints any new look must keep:**
  - **The thermal lens repaints everything** in ironbow (`home-thermal-paint.tsx`, `thermal-material.tsx`). A new material or texture must take that paint, and its readings and arrows must still land.
  - **TS3b.3's part fades** (tags `complete`, `partly-open`, `raised`, `slab`) open and close the house; new parts need their tags.
  - **The house stays built in code** (R18): we cut it, paint it thermally and swap its parts. Models dress it; they don't replace it.
  - **Models load without throwing** (`useGltfAsset` returns null → stand-in). Keep the stand-ins.
  - **WebGL only.** WebGPU was dropped (R20, T11).
  - **The inside shows through the windows** on the Complete home, so rooms and residents are seen from outside too.
  - **Bursts of life, then rest** (R23); heat arrows are the one exception.

## 6. How to run the brainstorm

- Use `superpowers:brainstorming`. One question at a time, a recommendation with each.
- **Show looks concretely before asking for a pick.** The owner judges visual work by eye. For the R9 question, build a small studies page (artifact) with two or three directions, for example *polished stylized* (R9 kept, better models and lighting), *stylized-real* (real proportions and materials, soft light), and *near-real*, with real screenshots of today's lab page beside them. The glass-HUD studies page was the owner's quality bar for the UI; hold the 3D to the same standard.
- Capture today's baseline with your own browser (the lab page is `/dashboard/labs/trade-scene`) at 1280×800 and an iPad size, Complete and Partly open, with and without Thermal, before proposing anything.
- Likely topics, each with a recommendation:
  - the style bar (R9) and what "lifelike" means here: proportions, materials, light, shadows, ambient occlusion, an environment map, post effects;
  - people: models, faces or faceless, the seated pose, the child, how residents are cast (R15);
  - equipment and props: the condenser (TS3b.4a already scales it to 3/4/5 tons and dusts it), wall and window units, the package unit's look;
  - the house, lot and surroundings (R69): a SoCal stucco home, roof detail, garage (R80), landscaping, neighbours, street;
  - sourcing: CC0 packs, the owner's hand downloads, AI-generated models, a commissioned set (T16);
  - the performance budget and how it's checked on the iPad;
  - the order against TS3b.4a and how the plan splits by file.

## 7. Rules for the session

- **Requirements change in the tracker first**: a register row or a status change, plus a §6 change-log line, then the spec.
- **Other sessions work in this worktree.** Uncommitted files belong to them (the tracker, `CONTEXT.md`, the TS3b.3 spec, the TS3b.4a spec and plan, the TS3b.4 handoff). Never revert or commit them unless the owner asks. Commit only your own files, by explicit path.
- **The dev server on :3002 is the owner's.** Check `ss -ltnp` before starting one; use another port.
- **Stale refs to flag to the owner, not fix silently:** the tracker's status line (line 3) still says "TS3b.3 next" though §2 marks TS3b.3 and the glass-HUD layout built; R34's status is "open" though the rafters fix shipped in TS3b.3.
- Check the code before quoting any rule from this file, the tracker or memory.
