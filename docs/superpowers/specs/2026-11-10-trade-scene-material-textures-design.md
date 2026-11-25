# Trade scene material textures

**Status:** approved by the owner, 2026-11-10; plan at `docs/superpowers/plans/2026-11-10-trade-scene-material-textures.md`. **Tracker:** `docs/plans/2026-10-16-trade-scenes-epic.md` R286–R292 (this is TS3b.6-C with the owner's material list).
**Picks page (private artifact):** https://claude.ai/artifact/TDv8sxXqzviNrEceSnFHET, picks in its database collection `picks`.
**Built on:** `feat/scene-layout-lab` (owner, 2026-11-10: it has the developed layout work).

## 1. Intent

The trade scene is the in-home sales presentation. Today most surfaces are flat colour. The owner wants the materials Tri Pros sells to look like themselves, so a homeowner recognises their stucco, shingles, lawn or driveway, and can see the product they are buying in the colours on offer.

Success: on the iPad, each material below reads as the real thing at the distance the rep shows it, up close included, and everything the scene does today still works.

## 2. Goals, non-goals, anti-goals

**Goals**
- Real textures on the ten materials in §3, in the owner's picks.
- Colour options on gravel, mulch, concrete, asphalt and pavers, picked where the rep already picks the material, per drawn region.
- Courtyard Stone as the main paver, in its ten blends; every other paver pattern available too.
- Batts drawn one panel per bay with the joist lines showing, at every R-value.
- Worn looks that say "this needs replacing" on the Today side.

**Non-goals (first build)**
- Before-and-after stills for proposals (R291).
- Wood fence, block wall, windows, tile and shake roofs, flat-roof membrane. They were in the original ask but no texture was chosen. They take the same path later.
- Instanced grass blades, ambient occlusion passes, a lighting rework, WebGPU/TSL, Gaussian splats, path tracing.
- Blender for the house. The house is drawn from data and stays that way.

**Anti-goals: the build has failed if any of these happen**
- Any of these change or break: taps and pins, fades and Look inside, Thermal, the blueprint load, the live colour picks, the Today ⇄ Build toggle, wear levels.
- An iPad loses its graphics context mid-meeting because of texture memory, which drops the meeting to stills.
- The first load on cellular gets noticeably longer, or the scene waits on a texture to appear.
- A surface visibly repeats like wallpaper from the opening view.

## 3. The owner's picks

Tile size is the real-world width one image covers. Library sizes for ambientCG are estimates, tuned by eye in the build; Poly Haven's are published.

| Material | Pick | Source (CC0 unless noted) | Tile | Tints? |
|---|---|---|---|---|
| Shingles | Grey asphalt grit | ambientCG `Asphalt031` | 1.2 m | Existing shingle colours |
| Stucco | Cloudy plaster | ambientCG `Plaster004` | 2 m | Existing paint colours |
| Sod, worn | Tired, thin lawn | Poly Haven `grass_ground` | 2 m | No |
| Sod, healthy | Dense garden lawn (Claude's call, owner sees it at the first look) | ambientCG `Grass004` | 2 m | No |
| Artificial turf | Bright turf with thatch | Generated in code | 1 m | No |
| Gravel | White gravel | ambientCG `Gravel023` | 2 m | Yes |
| Mulch | Dark brown bark | Poly Haven `wood_chips` | 2 m | Yes |
| Concrete | Broom finish | ambientCG `Concrete048` | 2 m | Yes |
| Asphalt, healthy | Dark, lightly worn | ambientCG `Road012A` | 2 m | Yes |
| Asphalt, worn | Long open cracks | Poly Haven `asphalt_02` | 3 m | No, its own colours |
| Pavers | Courtyard Stone, then every other pattern on the page | Generated in code; others ambientCG `PavingStones071/081/077/108/099`, Poly Haven `concrete_pavers_02` | 2.44 m / 1–2 m | Courtyard: 10 blends. Others: plain tints |
| Fiberglass, blown | Blown-in, off-white | Generated in code | 1 m | Existing wear tint |
| Fiberglass, batts | Pink batts | Generated in code | 0.9 m | Existing wear tint |

The generators, download lists and page source are kept in `~/claude-archive/2026-11-10-trade-scene-materials/`. Whatever is generated ends up as baked image files in the repo, credited in `public/scenes/LICENSES.md`.

**Colour lists.** Each tintable material has a "Natural" option showing the texture's own colour, plus tints:
- Gravel: White, Light grey, Tan, Buff, Charcoal.
- Mulch: Black and Red (the catalog's two), Dark brown, Cedar.
- Concrete: Light, Standard grey, Sandstone, Tan, Terracotta, Charcoal.
- Asphalt: Fresh black, Sealed, Weathered grey, Faded.
- Other pavers: Light grey, Sand, Tan, Terracotta, Charcoal.
- Courtyard Stone, by the manufacturer's names: Dark Gray–Pewter–Charcoal (default, the owner's reference photo), Gray–Charcoal, Dark Gray–Copper–Charcoal, Gray–Moss–Charcoal, Adobe–Copper–Mocha, Sand–Stone–Mocha, Sand–Copper–Stone, Cream–Brown–Charcoal, Cream–Terracotta–Brown, Tuscan. Charcoal and Mocha solids are left out: they are not sold in the four-stone pattern.

The owner said any list is fine for now, so all but the Courtyard names and the two catalog mulches are placeholders the owner can replace.

**Courtyard Stone is a drawing, not the manufacturer's photo.** It is random ashlar on a 3 in grid in 6×6, 6×9, 9×9 and 9×12 in stones (dealer-listed sizes; the manufacturer's page does not state them), with tones sampled from the manufacturer's colour chart. The manufacturer's photos are not used as textures.

## 4. How it behaves

**Tint rule.** A tintable surface uses a grey, detail-only map multiplied by the colour. A live colour pick stays a colour change with no new download. "Natural" and worn looks use the texture's own colours. Courtyard blends are separate colour maps, because their stones vary in colour stone by stone.

**Wear.** Wear levels (`new | good | fair | worn | failing`) keep their meaning.
- Asphalt and sod: `worn` and `failing` use the worn texture; `new` and `good` the healthy one. `fair` sits between, by eye. `failing` stays visibly worse than `worn`: the lab's existing marks (more cracks and broken patches on paving, more bare soil on lawn) move out of the opaque canvas map into an overlay on top of the texture.
- Ground a Build does not replace stays as worn as it is on Today (owner). Sod and asphalt are not in the catalog, so a worn lawn or driveway only changes when turf, pavers or concrete replace it. Their healthy textures show on homes rated in good condition.
- Everything else keeps its current wear colour shift on top of the texture. Existing stains, cracks, peeling and other wear marks stay and draw over it.

**Loading.** The opening view must not wait on textures. Surfaces draw in their current flat colour and take the map when it arrives, without a visible pop or a shader hitch. There is one set of maps per material, at about 1K, with no separate close-up tier. Only the maps the opening view shows load up front. Maps for anything off-screen, insulation included, load when that system is opened. Failed loads stay flat colour silently and load again on their own when the connection comes back (models only forget the failure and reload when next asked; a surface on screen should not wait for that). Switching Today ⇄ Build never reloads a map: the lot holds both layers' maps while it is shown.

**Budget.** Proposed: under about 10 MB before the opening view and about 35 MB of GPU texture in the worst case, both confirmed on the owner's iPad. Sizing case: a lot showing four different patterns and two Courtyard blends at once. Tints cost no extra memory. Each Courtyard blend must cost little, so blends share one set of stone shapes. Textures add no draw calls, with two exceptions: each new appearance on a lot adds one strip, and each worn strip adds one overlay for its wear marks. The recorded counts remain the gate for geometry. GPU memory is counted at the iPad's formats (ETC2 and ASTC); a desktop that would take BC7 is held to ETC2 too.

**Repetition.** Ground surfaces carry a large-scale colour variation so tiling does not show from the street view.

**R-38 and other deep batts (R289).** Any batt deeper than the joists draws as one thick panel per bay, standing above the joists, with the joist tops visible as lines between panels. There is no sheet over the joists. Under a pitched roof the panel still steps down at the eaves. Blown insulation stays one blanket. Reports of the blanket's top height keep working for leaks and water.

**Appearance follows the drawn region (owner).** A material's **appearance** is the texture and colour it is drawn in (owner's word, 2026-11-11, chosen because it covers stucco, shingles and later materials, not only ground). For ground, the appearance is a pattern and a colour. The lab already gives each drawn region in a front, back or side yard its own material and wear. Appearance works the same way: a patio can be Courtyard Stone in Tuscan and the walkway herringbone in grey, and each yard's base has its own too. Today and Build each hold their own.

The picker shows the same way shingle colours do: inside the material's menu, the moment the material is picked (the rule from the colour-picking design), on the lab's current yard chips. Ground a Build leaves untouched keeps its Today material and appearance; only what the Build lays takes Build choices. So asphalt and sod, which the catalog does not sell, have no Build picker.

## 5. Where it lands in the code

| Surface | Drawn by | Mapping today | Needs |
|---|---|---|---|
| Shingles | `RoofCovering` → `InstancedPieces` | 0–1 per stretched tab | Grit at real scale, varied tab to tab |
| Walls | `WallSkin` (`ExtrudeGeometry`) | Already metres | Map only |
| Gables, parapets, corners, foundation skirt, garage | Mostly `MergedBoxes` and gable geometry | 0–1 per box | Metre mapping |
| Concrete, asphalt on the lot | `Lot` → `MergedBoxes` | 0–1 per box | Metre mapping |
| Lawn | `LotGround`, ground strips | Counts 4 m tiles | Tile size set to the texture's; replaces the canvas lawn |
| Drawn ground regions | `LayoutRegions` (`stripLook`), `LotLayout`, `shownGround`, `layout-codec` | Tile counts | Maps and worn looks; a pattern-and-colour value per tile and per yard base, on each side, beside material and wear, in the layout and its link format; strips split on it |
| Attic insulation | `AtticFloor` → `AtticSteps` → `MergedBoxes` | 0–1 per box | Metre mapping, and R289 in `atticInsulationBoxes` |
| Crawl batts | `CrawlInsulation` → `MergedBoxes` | 0–1 per box | Metre mapping |

**Rules the build must keep**
- Share textures between meshes, never materials: `applyGhost` writes opacity per material.
- Thermal's decal rule (`original.transparent && map` in `thermal-paint-set.ts`) must key off an explicit tag, or a ghosted textured wall paints as a decal.
- Three.js stays in `ui/lib` and components; `constants/` and `lib/` stay pure.
- Texture work goes through `uploadSceneTextures` and the blueprint load so the first frame doesn't stall.
- The check script today budgets GLBs only; add the textures to a budget it enforces.

## 6. Order

All of it is built on `feat/scene-layout-lab`.

1. **Sync first:** merge `feat/trade-scenes-foundation` into the lab, always in that direction. A trial merge shows conflicts in the verify script and the controls files, so this is real work. The owner confirms no one else is mid-edit on either branch.
2. **Groundwork, no visual change:** metre mapping for box-built surfaces, the surface texture table, the texture pipeline with compression, the Thermal tag, budgets.
3. **House:** stucco, shingles, insulation, R-38 batts.
4. **Ground:** the lot's lawn, concrete and asphalt, then drawn gravel, mulch, turf and pavers with Courtyard Stone.
5. **Appearance per drawn region,** including the link format change and the picker.

Claude's call: this no longer waits on Layout L3, because textures attach at the material and mapping level, which L3 reuses. The picker is small enough to build on today's yard chips.

## 7. Dependencies and checks

- R285 (warm light tinting neutrals brown) affects how grey Courtyard blends and charcoal shingles read in Normal and Summer. The fix landed on `feat/trade-scenes-foundation` (`e0deb98da`) and reaches the lab in step 1, so the owner's first looks are under the corrected light.
- `pnpm tsc`, `pnpm lint` and the scene verify scripts. Never a multi-case browser sweep in software rendering: it crashed the machine. At most one case at a time, and the owner's iPad look is the real check.
- The dev server is the owner's to start.

## 8. Left to the builder

File and component names beyond those above (new domain words go in `CONTEXT.md` with the owner's agreement); compression settings per map; how `fair` blends; exact tile sizes by eye; how grit varies from tab to tab; whether the batt panel's soft top is geometry or a rounded box.

## 9. Claude's calls, for the owner to check

- `Grass004` as the healthy lawn.
- Ground a Build leaves untouched keeps its Today material and appearance.
- Each worn strip draws its wear marks as one overlay over the texture, one extra draw per worn strip.
- The garage roof stays one plain colour unless the owner asks for the grit at the first look.

**Owner rulings from the plan's stress test, 2026-11-11:** the word is **Appearance**. Textures go before covering wear on the roof: covering wear's roof material later builds on the textured one instead of stacking a second material.
- The budget's sizing case of four patterns and two Courtyard blends.
- One texture set per material, no sharper close-up tier.
- Worn asphalt keeps its own colours; `failing` differs from `worn` through overlaid marks.
- Wood fence, windows and tile/shake roofs wait for a later round.
- Not waiting on Layout L3.
- Residents stay simple while surfaces go real (R9 superseded for surfaces only).
- The budget figures in §4.
