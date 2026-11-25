# Trade scene ground depth

**Status:** draft, PAUSED 2026-11-15 while the lab merges into the foundation branch and ships (release 3). Builder check done; one owner question open: do edges, contact shadow and parallax also go on the prod route's fixed `Lot`, or only the lab's grid lot until it replaces it? Then approval. **Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md` R320 (on `feat/trade-scenes-foundation`). **Follows:** `docs/superpowers/specs/2026-11-10-trade-scene-material-textures-design.md` (R286), built on this branch.
**Built on:** `feat/scene-layout-lab`.
**Test pages (throwaway, gitignored):** `.superpowers/brainstorm/2293666-1794612693/content/ground-depth-v2.html` and `bed-edges.html` on this worktree. They show what the owner approved; their shader code is a reference, not a source to copy.

## 1. Intent

The R286 textures are on, and the ground still reads as "a cheap veneer rather than surface/texture" (owner, 2026-11-11), close up and from the whole-home view. Sod, artificial turf, gravel and mulch are the ones that matter. The homeowner should see a lawn and a gravel bed, not pictures of them laid on a board, and the iPad must stay smooth.

The flat look has three causes, found in the code: the scene's fill light (hemisphere, bounce, lightformer environment) washes out normal-map relief; nothing darkens the gaps between stones, chips and blades under direct light; and every drawn region is a lifted sheet with no sides and no border, so it sits on the lawn like a sticker.

## 2. Goals, non-goals, anti-goals

**Goals**
1. **Relief and gap shadow** (owner's "option 1") on sod (healthy and worn), artificial turf, gravel and mulch.
2. **Edges** (owner's "option 6"): redwood bender board where a loose bed meets lawn or turf, beds with a little body, hard surfaces showing their slab edge, and soft contact shadow where things meet.
3. **Stones and chips that stand up** (owner's "option 2", parallax occlusion) on gravel and mulch, on top of goal 1.

**Non-goals**
- Grass with real height. **Stacked-shell grass was tried and vetoed** (owner, 2026-11-13: "too much artifacts"); never propose it again. Blade geometry and edge tufts stay on file in R320 for later.
- Relief, gap shadow or parallax on concrete, asphalt, pavers, shingles or stucco. They can take the same treatment later as a data change.
- Moving the sun or reworking the lighting. The approved light (R285) stays.
- Real displacement, scattered pebble meshes, a screen-space AO pass (R320 options 3, 5, 7).

**Anti-goals: the build has failed if**
- Anything shimmers, crawls or swims when the camera moves. This is what killed the shells.
- Anything R286 protects breaks: taps and pins, fades and Look inside, Thermal, the blueprint load, live colour picks, Today ⇄ Build, wear levels, appearance per drawn region.
- The iPad drops frames with a large gravel or mulch bed filling the screen, or the opening download or GPU texture budget goes over (§4.4).

## 3. The owner's decisions

| Decision | Ruling |
|---|---|
| Which materials | Sod, turf, gravel, mulch ("mainly") |
| Option 1 | On all four ("Settle on 1"; "Looks good for now") |
| Grass height | Shells vetoed; option 1 only for now |
| Option 6 | Yes ("Looks right") |
| Where bender board goes | Wherever a loose bed (gravel, mulch, decomposed granite, river rock) meets lawn or turf. None against concrete, pavers, asphalt or the house; none where turf meets sod ("Correct") |
| Board material | Redwood, over brown composite |
| Board on the Today side | Every existing bed shows a whole board, whatever its condition |
| Option 2 | On gravel and mulch ("looks better") |

## 4. How it behaves

### 4.1 Relief and gap shadow (sod, turf, gravel, mulch)

- **Stronger relief.** Each set gets its own normal strength instead of the fixed 1. Starting points from the test page: gravel 2.6, mulch 2.2, sod 2. Turf and worn sod are tuned by eye. The map's ease-in (`useTweened` in `TexturedMaterial`) still runs from 0 to the set's strength.
- **Gap shadow under direct light.** The crevice map darkens the colour itself, so gaps stay dark in sun and not only in shade. It is **baked into the colour maps** (`c`, and `g` where the set has a grey map) at bake time. That means no new texture, no runtime cost and no budget change, and tints keep working because the grey map carries it too. Test-page strengths: gravel 0.85, mulch 0.8, sod 0.75 (fraction of the AO's darkening applied).
- **Where the crevice maps come from.** The bake archive holds only colour, normal and roughness, so the AO and height sources are fetched (the test page folder already has gravel, mulch and sod AO and the gravel and mulch heights). Gravel: ambientCG `Gravel023` AO. Healthy sod: ambientCG `Grass004` AO. Worn sod: Poly Haven `grass_ground` AO. Mulch (`generated/mulch-chips`) and turf (`generated/turf-lush`) were generated, so theirs are derived from the image: a height proxy from blurred luminance, then the height minus its wide blur. The test page did this for mulch in a few lines. All sources are CC0; record them in `public/scenes/LICENSES.md`.
- **Normal map size stays as baked** (Claude's call after the builder check). `FINE_NORMAL_SETS` keeps sod, gravel and turf at 512: the opening download has 0.41 MiB of headroom (9.59 of 10 MiB measured 2026-11-14), which a 1024 sod normal (~0.9 MB) would break, and a 1024 gravel normal puts the sizing case over 35 MiB once gravel is counted (§4.4). Relief comes from the stronger normal strength and the gap shadow instead.

### 4.2 Edges

**Bender board**
- **Where:** along every boundary between a cell of a loose material (`gravel`, `mulch`, `dg`, `river-rock`) and a cell of `sod` or `turf`. This includes the base lawn around drawn regions, which is sod. Board placement is derived from the drawn grid; the rep never places it.
- **Not drawn:** loose against `concrete`, `pavers`, `asphalt`, `pool`, `dirt`, the house, a lot wall or fence, or the lot's own paving (driveway, walks); loose against loose of a different kind; turf against sod.
- **Look:** redwood, about 1.2 cm thick, standing about 3.5 cm above the lawn. Woodgrain runs along its length. It casts and receives the sun's shadow.
- **Layers:** on both Today and Build, **always whole**. Wear never breaks or hides it. A Build that keeps a Today bed keeps its board. A Build that replaces lawn with gravel gains one.
- It follows the grade, as the strips do (`heightAt`).

**Beds with body**
- Loose beds sit just under the board's top. Gravel lies near flat. Mulch mounds slightly toward the middle of each region, a couple of centimetres at most, never taller than the board at its edge.
- The current lift values in `GROUND_MATERIALS[...].look.raise` remain the base. Where a bed has no board (against concrete, say), its edge must not show a gap or a floating lip.

**Slab edges**
- Drawn hard surfaces (`concrete`, `pavers`, `asphalt`) show a vertical side face from the lawn up to their top wherever they stand above a lower neighbour, so they no longer float as sheets. The lot's own concrete (`Lot` → `MergedBoxes`) already has thickness and needs nothing.

**Contact shadow**
- A soft darkening, a few centimetres wide, on the lower surface along every board, every slab edge and the base of the house wall. On the test page: up to 38% darker, fading out over 9 cm. It is drawn, not lit, so it shows in any weather. Thermal does not show it.

### 4.3 Stones and chips that stand up (gravel, mulch)

- Parallax occlusion from a height map, on top of 4.1, on drawn gravel and mulch regions, in every colour and appearance they come in. Test-page values: gravel 2.5 cm of relief, mulch 2 cm, 32 steps.
- **Height maps:** gravel uses ambientCG `Gravel023` displacement. Mulch uses the luminance-derived height from 4.1. One new single-channel map per set (`h`), at 512, baked, compressed and budgeted like the others.
- **Only where it shows.** Full parallax up close and at mid-distance, easing back to plain 4.1 with distance or as the screen footprint shrinks. At the whole-home view a bed costs what it costs today. If the iPad still drops frames in the worst case, tighten the distance before cutting steps, and cut steps before dropping the effect.
- **Nothing swims.** The ease-back must not pop or shimmer as the camera moves (anti-goal). Grazing angles clamp the offset, as the test page does (`max(ts.z, 0.2)`).
- **Worn looks keep working.** Worn and failing gravel and mulch keep today's wear colour shift. Loose ground has no wear-marks overlay (`groundDraw` gives `marks` only to lawn and paving), so nothing else needs to follow the offset.

### 4.4 Budget

- The existing gates in `scripts/check-scene-assets.ts` hold: **10 MiB before the opening view, 35 MiB of GPU texture in the sizing case**, counted at ETC2/ASTC.
- **Measured 2026-11-14:** opening 9.59 of 10 MiB; sizing case 31.80 of 35 MiB.
- New maps: one `h` (512) per gravel and mulch. **Mulch is an opening set** (the default lot has mulch beds), so the mulch `h` loads with the opening and the check script counts it there. It is small enough to fit the 0.41 MiB headroom; if a stair-stepping fix needs a heavier format than fits, the builder brings it back to the owner rather than raising the gate.
- **The sizing case gains a drawn gravel bed** (Claude's call): a gravel yard is the case this work exists for. With gravel's normal at 512 and its `h` at 512, the builder's estimate lands near 34 MiB, under the gate.
- Bender boards, slab sides and bed body add geometry. Boards merge into one mesh per layer, so they add no more than one draw call per layer, and the triangle gate stays as recorded.
- The gravel `h` loads only when gravel is on the lot, as the gravel maps do today.
- There is no triangle gate in `check-scene-assets.ts`; geometry is held to the headless draw and triangle numbers recorded in the epic tracker.

## 5. Where it lands in the code

| Piece | Today | Change |
|---|---|---|
| Bake | `scripts/bake-material-textures.ts`: `c`, `g`, `n`, `r` per set; `FINE_NORMAL_SETS` | AO baked into `c`/`g` for the four sets; new `h` for gravel and mulch; normal size per set; mulch and turf AO and height derived |
| Texture table | `constants/material-textures.ts` `TEXTURE_SETS` (`tileMetres`, `maps`, `macro`) | Per-set normal strength; which sets have `h`; parallax depth |
| Loading | `hooks/use-texture-maps.ts`, `ui/lib/texture-store-for.ts` | Load `h` when the set has one |
| Material | `ui/components/home-kit/textured-material.tsx`, `ui/lib/patch-textured-material.ts` (`patchTexturedShader`, `TEXTURED_PROGRAM_KEY`) | Normal strength from the set; parallax as a define in the same patch, so covering wear (which builds on `patchTexturedShader`) keeps working; cache key gains the define |
| Regions | `ui/components/layout-kit/layout-regions.tsx`, `ui/lib/region-strip-geometry.ts` (`pushGradeQuad`) | Bed body (mulch mound) and slab sides; contact shadow |
| Boards | new, beside the regions | Boundary walk over the lot grid, `shownGround` per layer, merged boxes |
| Budget | `scripts/check-scene-assets.ts` | Counts `h` maps and changed normal sizes |
| Thermal | `ui/lib/thermal-paint-set.ts` | Boards paint like the ground they stand in; no contact shadow in Thermal |

**Rules that carry over from R286:** share textures, never materials (`applyGhost` writes opacity per material). `SOLID_MAP_KEY` stays on every textured material, so Thermal never reads a textured surface as a decal. Three.js stays in `ui/lib` and components; `constants/` and `lib/` stay pure. Textures go through the store and the blueprint load, so the first frame never waits.

## 6. Order

1. **Relief and gap shadow** (bake, table, material). Visible at once on the whole lot, cheapest, no geometry.
2. **Edges** (boards, bed body, slab sides, contact shadow).
3. **Stones that stand up** (height maps, parallax, distance ease-back), then the iPad pass on the worst case.

Each step ships on its own and gets the owner's look before the next.

## 7. Left to the builder

Exact strengths and depths by eye under the scene's real light. How the gap shadow is derived for mulch and turf. Whether contact shadow is computed in the shader or baked into a per-lot mask. How mulch mounds over a multi-row region. The board's woodgrain (generated or a CC0 wood texture). How the parallax distance fade is measured. File and component names; a new domain word (for example for the board) goes in `CONTEXT.md` with the owner's agreement.

## 8. Claude's calls, for the owner to check

- The gap shadow is baked into the colour maps rather than shipped as a separate map: zero runtime cost, at the price of fixed strength per set.
- The sun stays where it is.
- Contact shadow is drawn, not lit, so it shows in every weather, even overcast.
- Parallax fades out with distance, to protect the iPad.
- Order: relief → edges → parallax, each with its own look.
