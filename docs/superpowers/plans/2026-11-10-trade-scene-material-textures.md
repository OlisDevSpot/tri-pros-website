# Trade scene material textures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The materials Tri Pros sells (stucco, shingles, lawn, turf, gravel, mulch, concrete, asphalt, pavers, fiberglass) draw with real textures on the iPad, each ground region in its own appearance, and everything the scene does today keeps working.

**Architecture:** A baked KTX2 set per material under `public/scenes/textures/`. One material component, `TexturedMaterial`, binds shared textures and eases from today's flat colour to the map when the map arrives, so every existing `color` prop stays what it is and is also the fallback. A ground region's appearance (pattern and colour) is one packed byte per tile per layer, stored and encoded beside material and wear.

**Tech Stack:** three r180 `WebGLRenderer`, R3F 9, `KTX2Loader` (Basis transcoder from three's own `examples/jsm/libs/basis`), `toktx` and sharp for the bake, tsx assert scripts as tests.

**Spec:** `docs/superpowers/specs/2026-11-10-trade-scene-material-textures-design.md`

## Global Constraints

- All work is on `feat/scene-layout-lab`. Sync direction is `feat/trade-scenes-foundation` into the lab, never the reverse, never a rebase, never `origin/main` straight in.
- Nothing is built until the owner says build or execute. Commit by explicit path. No stash, checkout or reset in a shared tree. Before each dispatch, `git diff --cached` is empty. No DB writes. No file in scope has CRLF endings today; after any scripted edit, `git diff --shortstat` shows only the lines meant.
- Only the owner starts a dev server. Never `pnpm build`. Never a multi-case browser sweep in software rendering (at most one case at a time). The owner's iPad is the real visual check.
- No new npm dependency. `toktx` is a machine tool used only by the bake.
- Three.js stays in `ui/lib`, components and hooks. `constants/` and `lib/` stay pure, and lint does not enforce it for this feature (`eslint.config.js` exempts it), so every task ends with `grep -rlE "from 'three|/ui/" src/features/trade-scenes/constants src/features/trade-scenes/lib` printing nothing.
- Share textures between meshes, never materials: `applyGhost` writes opacity per material.
- Budget: under about 10 MB before the opening view, about 35 MB of GPU texture in the sizing case (a lot showing four patterns and two Courtyard blends).
- The opening view never waits on a texture. A failed load stays flat colour silently and retries when back online.
- Textures are CC0 or generated, credited in `public/scenes/LICENSES.md`. The manufacturer's photos are never used as textures or committed.
- Vocabulary (owner, 2026-11-11): **Appearance** is the texture and colour a material is drawn in. A ground region's appearance is its pattern and colour. Say region, yard base and layer, never "section" or "side". Do not say "style", "finish" or "surface" for it. Code identifiers spell `color`; on-screen copy spells "Colour".
- Comments say why, never what, and never cite plans, specs or tasks.
- Tests are `pnpm exec tsx scripts/<name>.ts` assert scripts in the existing style: flat top-level `assert` calls whose message is the case name below, each script ending `console.log('<name>: ok')`. `pnpm tsc` and `env CI=1 pnpm eslint src/features/trade-scenes` are clean at the end of every task.

## Review Focus

1. A rep flips quickly through Courtyard blends: the last pick shows, the shown maps stay bound until the new ones arrive, late arrivals are thrown away, and released maps leave GPU memory (Task 5).
2. An old link (`_v` 2 or 3), or a link whose colour index no longer exists after the owner edits a list, opens with its wear intact and the default appearance, rather than refusing or drawing nothing (Task 11).
3. Offline or a 404 on a map: that surface looks exactly as it does today and takes the map after reconnecting (Task 5).
4. A region changes material: its old colour index never carries to the new material, and Undo brings the old material and appearance back together (Task 11).
5. Today ⇄ Build, including after a long pause: ground the Build keeps shows its Today appearance, a Build pick never changes Today, and neither layer flashes flat on the toggle (Tasks 10, 11).

## File map

| Path | Job |
|---|---|
| `constants/material-textures.ts` (new) | Table of texture sets, tile sizes, opening sets, `SOLID_MAP_KEY`, `STUCCO_TEXTURE` |
| `constants/ground-appearances.ts`, `lib/ground-appearance.ts` (new) | Pattern and colour lists; pack and read an appearance byte |
| `lib/texture-map-urls.ts`, `lib/ground-draw.ts`, `lib/texture-binding.ts` (new) | Which files a set needs; what a tile draws; when a new binding replaces the shown one |
| `ui/lib/texture-store.ts`, `ui/lib/texture-store-for.ts` (new) | Shared cache, ref counts, retry; the KTX2 binding |
| `ui/lib/texture-placeholders.ts`, `ui/lib/patch-textured-material.ts` (new) | 1×1 stand-ins; shader patch, composable by other materials |
| `ui/lib/create-wear-marks-texture.ts` (new, replaces `create-wear-texture.ts`) | Transparent wear marks laid over a texture |
| `hooks/use-texture-maps.ts`, `hooks/use-system-opened.ts` (new) | Bind maps to a material, hold sets without binding; sticky "system was opened" |
| `ui/components/home-kit/textured-material.tsx` (new) | The one textured material element |
| `ui/components/panel/ground-appearance-picks.tsx` (new) | Pattern and colour picker inside a material's menu |
| `scripts/bake-material-textures.ts`, `scripts/verify-material-textures.ts` (new) | Bake; tests |
| `public/scenes/textures/**`, `public/scenes/basis/**` (new) | Baked sets; transcoder |

All feature paths are under `src/features/trade-scenes/`.

---

### Task 1: Sync the foundation into the lab

**Files:** the merge, with conflicts in `scripts/verify-trade-scene.ts`, `constants/controls-classes.ts`, `ui/components/controls/{existing-chip,system-card-body,value-menu}.tsx`, `ui/components/home-kit/home-kit.tsx`.

**Interfaces:** Produces the tree every later task reads. After this, `wallSkinLook`, `ATTIC_DUST`, `UpgradeSwitch` and `WorkDetails` exist on the lab, and the warm-light fix (`e0deb98da`) is in, so colours are judged under the corrected light.

- [ ] **Step 1:** Ask the owner to confirm no session is mid-edit on either branch. Stop until they do.
- [ ] **Step 2:** `git merge --no-commit feat/trade-scenes-foundation`. If git refuses because an untracked doc would be overwritten, compare it with the incoming file and report to the owner before moving it. `CONTEXT.md` stays dirty through the merge: the foundation does not touch it. If a resolution below cannot be applied, `git merge --abort` and report; never improvise a resolution.
- [ ] **Step 3: Resolve each conflict as follows.**
  - `controls-classes.ts`: keep HEAD's comment.
  - `existing-chip.tsx`: keep HEAD's two `rider` lines, then add the paint colours group in the lab's shape: `slot.id === 'exterior-paint' ? { id: 'colors', body: <><div data-menu-header className={CONTROLS_CLASSES.menuHeader}>{PAINT_COLOR_COPY.colors}</div><PaintColors side="existing" /></> } : null`.
  - `system-card-body.tsx`: import both sides' names, then `env CI=1 pnpm eslint --fix` on the file removes any unused. Keep `SystemCardRow`, with the foundation's contents: `existing`, and `[...proposed, ...panels]`. `sideRow` has no definition left. `ShingleColors` going unused here is expected: the foundation moved it into `WorkDetails`.
  - `value-menu.tsx`: keep HEAD's `Fragment` with its group headers, and take the foundation's `staysOpenOn` close rule inside it.
  - `home-kit.tsx`: `{lotSlot ? lotSlot(sky.ground) : <Lot ground={sky.ground} />}`, then the foundation's `<group ref={garage} …>` block unchanged.
  - `verify-trade-scene.ts`: keep the `DEFAULT_LAYOUT` import and take the foundation's two longer import lines.
- [ ] **Step 4:** Run `pnpm tsc`, `env CI=1 pnpm eslint src/features/trade-scenes scripts/verify-trade-scene.ts`, and `pnpm exec tsx` on `verify-trade-scene`, `verify-trade-scene-layout`, `verify-trade-scene-lot`, `verify-property-layout`, `verify-layout-kit`, `verify-scene-primitives`. Expected: all clean and `ok`.
- [ ] **Step 5:** Commit the merge with exactly the files git staged: `git commit -m "merge: foundation into the layout lab before the material textures"`.

---

### Task 2: Metre mapping for box-built surfaces

**Files:** Modify `ui/lib/merge-boxes.ts`. Test: `scripts/verify-material-textures.ts` (new).

**Interfaces:** Produces `mergeBoxes(boxes: readonly BoxSpec[], radius?: number, uvs?: 'per-box' | 'metres'): BufferGeometry`. Default `'per-box'` leaves every current caller as it is (the rot stains and tinted marks keep their UVs).

- [ ] **Step 1: Write the failing tests.**

```ts
const uvOf = (g: BufferGeometry, keep: (nx: number, ny: number, nz: number) => boolean) => { /* collect [u, v] of vertices whose normal passes keep */ }
// a_box_face_maps_in_metres
const flat = mergeBoxes([{ size: [3, 0.1, 2], position: [10, 0, 5] }], 0, 'metres')
// top face: u spans 8.5..11.5, v spans 4..6; a +x face: u is world z, v is world y
// a_tilted_slab_keeps_its_size
const tilted = mergeBoxes([{ size: [2, 0.04, 4], position: [0, 0, 0], rotation: [0.1, 0, 0] }], 0, 'metres')
// its top face's u range is 2 and v range is 4
// a_rounded_box_stays_within_its_size: radius 0.03 on [1, 0.5, 1], top-face u range <= 1
// the_default_is_unchanged: mergeBoxes(flat list) top face spans 0..1
```

- [ ] **Step 2:** Run `pnpm exec tsx scripts/verify-material-textures.ts`. Expected: fails on the `'metres'` argument.
- [ ] **Step 3:** In `merge-boxes.ts`, before `applyMatrix4`, when `uvs === 'metres'`, rewrite each triangle's UVs from its local positions plus the box's unrotated `position`, picking the projection from the triangle's face normal: dominant y gives `(x, z)`, dominant x gives `(z, y)`, dominant z gives `(x, y)`. By triangle rather than by vertex, so a rounded corner never tears.
- [ ] **Step 4:** Run the script: `ok`. Run `verify-trade-scene` and `verify-scene-primitives`: `ok`.
- [ ] **Step 5:** Commit `ui/lib/merge-boxes.ts` and the script: `feat(trade-scenes): box-built surfaces can map in metres`.

---

### Task 3: Thermal keys its decals off an explicit key

**Files:** Modify `ui/lib/thermal-paint-set.ts`; create `constants/material-textures.ts` with the key only. Test: `scripts/verify-material-textures.ts`.

**Interfaces:** Produces `SOLID_MAP_KEY = 'solidMap'` in `constants/material-textures.ts`. A material with `userData[SOLID_MAP_KEY] === true` is painted solid even while ghosted. A key, not a frozen tag object like `HOME_GHOST_TAG`: `applyGhost` writes into the same material `userData`, so it cannot be frozen.

- [ ] **Step 1: Write the failing tests.** Build a `Group` with `userData.thermalZone` set to a real `HomePaintKey`, holding a `Mesh`, and run `paintThermal` with an empty soaked set.
  - `a_ghosted_textured_wall_paints_solid`: `MeshStandardMaterial({ transparent: true, map: new Texture() })` with the key becomes a `ShaderMaterial`.
  - `a_real_decal_keeps_its_shape`: the same material without the key becomes a `MeshBasicMaterial`.
- [ ] **Step 2:** Run. Expected: the first fails.
- [ ] **Step 3:** In `paintFor`: `original.transparent && map && original.userData[SOLID_MAP_KEY] !== true ? decalFor(...) : surfaceFor(...)`.
- [ ] **Step 4:** Run the script and `verify-trade-scene`: `ok`.
- [ ] **Step 5:** Commit: `fix(trade-scenes): thermal tells a textured wall from a see-through decal`.

---

### Task 4: Texture table, bake and budget

**Files:** Extend `constants/material-textures.ts`; modify `types.ts`, `scripts/check-scene-assets.ts`, `public/scenes/LICENSES.md`. Create `lib/texture-map-urls.ts`, `scripts/bake-material-textures.ts`, `public/scenes/textures/**`, `public/scenes/basis/{basis_transcoder.js,basis_transcoder.wasm}`.

**Interfaces:** Produces:

```ts
// types.ts
export type TextureSetId = typeof TEXTURE_SET_IDS[number]
export type TextureMapChoice = 'own' | 'grey' | { blend: string }
// constants/material-textures.ts
export const TEXTURE_SET_IDS, TEXTURE_SETS: Record<TextureSetId, { tileMetres: number, maps: readonly ('own' | 'grey')[], blends?: readonly string[], macro: boolean }>
export const GREY_MAP_LIFT = 1.6
export const ROUGHNESS_MAP_MEAN = 0.85
export const OPENING_TEXTURE_SETS: readonly { set: TextureSetId, map: TextureMapChoice }[]
// lib/texture-map-urls.ts
export function textureMapUrls(set: TextureSetId, map: TextureMapChoice): { color: string, normal: string, roughness: string, sibling: string | null }
```

Files are `/scenes/textures/<set>/{c,g,n,r}.ktx2`, and `c-<slug>.ktx2` for blends. `sibling` is the other of `c` and `g` when a set has both, so a live colour pick needs no download.

| Set id | Source (in `~/claude-archive/2026-11-10-trade-scene-materials/`) | `tileMetres` | `maps` | `macro` |
|---|---|---|---|---|
| `shingle` | `sources/Asphalt031` | 1.2 | grey | no |
| `stucco` | `sources/Plaster004` | 2 | grey | no |
| `sod-healthy` | `sources/Grass004` | 2 | own | yes |
| `sod-worn` | `sources/grass_ground` | 2 | own | yes |
| `turf` | `generated/turf-even` | 1 | own | yes |
| `gravel` | `sources/Gravel023` | 2 | own, grey | yes |
| `mulch` | `sources/wood_chips` | 2 | own, grey | yes |
| `concrete` | `sources/Concrete048` | 2 | own, grey | yes |
| `asphalt` | `sources/Road012A` | 2 | own, grey | yes |
| `asphalt-worn` | `sources/asphalt_02` | 3 | own | yes |
| `pavers-courtyard` | `sources/courtyard` (Step 2) | 2.44 | blends | yes |
| `pavers-wave` | `sources/PavingStones071` | 1 | own, grey | yes |
| `pavers-herringbone` | `sources/PavingStones081` | 1 | own, grey | yes |
| `pavers-ashlar` | `sources/PavingStones077` | 1.6 | own, grey | yes |
| `pavers-small-herringbone` | `sources/PavingStones108` | 1.6 | own, grey | yes |
| `pavers-interlocking` | `sources/PavingStones099` | 1.6 | own, grey | yes |
| `pavers-tumbled` | `sources/concrete_pavers_02` | 2 | own, grey | yes |
| `fiber-blown` | `generated/fiber-blown` | 1 | own | no |
| `fiber-batt` | `generated/fiber-pink` | 0.9 | own | no |

`OPENING_TEXTURE_SETS`: `shingle` grey, `stucco` grey, `sod-healthy` own, `concrete` own, `asphalt` own, `mulch` own.

- [ ] **Step 1: Write the failing test.** `textureMapUrls('gravel', 'own')` has color `/scenes/textures/gravel/c.ktx2` and sibling `/scenes/textures/gravel/g.ktx2`; `('pavers-courtyard', { blend: 'tuscan' })` has color `/scenes/textures/pavers-courtyard/c-tuscan.ktx2`, sibling `null`, and normal `/scenes/textures/pavers-courtyard/n.ktx2`; `('stucco', 'grey')` has sibling `null`.
- [ ] **Step 2:** Install `toktx` without sudo: take the Linux x86_64 `.deb` from the latest KhronosGroup/KTX-Software release, `dpkg -x` it to `~/.local/ktx`, and check `~/.local/ktx/usr/bin/toktx --version` runs (set `LD_LIBRARY_PATH` to its `lib` if asked). Regenerate Courtyard from the archive: `node tools/courtyard.cjs sources/angelus/img generated/courtyard-site generated/courtyard-site/blends.json`, then copy `generated/courtyard-site/tex/courtyard/{n,r,c-*}.webp` to `sources/courtyard/`. The archive tools `require` sharp by an absolute path into the trade-scenes worktree; if that path has moved, point it at this worktree's `node_modules/sharp`.
- [ ] **Step 3:** Implement `textureMapUrls` and the table. Implement `scripts/bake-material-textures.ts --from <archive> --toktx <path>`, reading each source's colour, normal and roughness as `.jpg` or `.webp` (Courtyard is `.webp`). For each set, sharp to a 1024 PNG, then:
  - Own and blend colour: `--t2 --encode etc1s --qlevel 200 --genmipmap --wmode wrap --assign_oetf srgb --target_type RGB`.
  - Grey: the recipe from `tools/process4.cjs` (`grey()`: mean to 0.8 with gamma at least 0.5, then gain), with the same flags as colour.
  - Normal: `--t2 --encode uastc --uastc_quality 2 --zcmp 18 --genmipmap --wmode wrap --assign_oetf linear --target_type RGB`. Plain RGB: three's shader does not read `--normal_mode`'s alpha.
  - Roughness: greyscale, scaled so its mean is `ROUGHNESS_MAP_MEAN`, then the colour flags with `--assign_oetf linear`.
- [ ] **Step 4:** Run the bake. Copy `node_modules/three/examples/jsm/libs/basis/basis_transcoder.{js,wasm}` to `public/scenes/basis/`. Add one `LICENSES.md` row per set, with Courtyard, turf and fiberglass as generated by Tri Pros. No `.gitattributes` change: git already treats these files as binary, and the repo sets no `text=auto`.
- [ ] **Step 5:** Extend `check-scene-assets.ts`, keeping its Node-only style. Read each `.ktx2` header (`pixelWidth` at byte 20, `pixelHeight` at 24, `supercompressionScheme` at 44: 1 is ETC1S, 2 is UASTC). GPU bytes use the iPad's targets: ETC1S lands in ETC2 RGB at 0.5 B/px, UASTC in ASTC 4×4 at 1 B/px, times 4/3 for mips. Siblings are never on the GPU (Task 5 prefetches their bytes only), so they count toward bytes, not GPU. Fail when:
  - A file the table names is missing.
  - Opening bytes plus the transcoder exceed 10 MiB.
  - Sizing-case GPU bytes exceed 35 MiB. The case is the opening sets, the `fiber-batt` set, `pavers-courtyard` normal, roughness and two blends, the three largest other paver sets, plus 2.8 MiB for two 512 px wear overlays.

  Print both totals, and beside the GPU total print, as information only, the figure if every map landed at 1 B/px (a desktop that takes BC7).
- [ ] **Step 6:** Run `pnpm exec tsx scripts/check-scene-assets.ts`. Expected: exits 0 and prints totals under both limits. **If it fails, drop normals to 512 px on the sets where grain is finest (`sod-*`, `gravel`, `turf`), re-bake and re-run.** Run the verify script: `ok`.
- [ ] **Step 7:** Commit the table, URL helper, scripts, `LICENSES.md`, `public/scenes/textures`, `public/scenes/basis`: `feat(trade-scenes): baked texture sets with a budget the asset check enforces`.

---

### Task 5: The texture store and `TexturedMaterial`

**Files:** Create the `ui/lib`, hook and `lib/texture-binding.ts` files in the file map and `textured-material.tsx`. Modify `ui/components/home-kit/merged-boxes.tsx`, `ui/components/home-kit/wall-skin.tsx`, `ui/components/home-kit/attic-steps.tsx`. Test: `scripts/verify-material-textures.ts`.

**Interfaces:** Produces:

```ts
// ui/lib/texture-store.ts
export interface TextureRequest { url: string, tileMetres: number }
export interface TextureStore {
  acquire: (request: TextureRequest, onChange: () => void) => () => void // returns release
  get: (url: string) => Texture | null
}
export function createTextureStore(load: (request: TextureRequest) => Promise<Texture>, options: { lingerMs: number, whenOnline: (retry: () => void) => void }): TextureStore
// ui/lib/texture-store-for.ts
export function textureStoreFor(gl: WebGLRenderer): TextureStore
// lib/texture-binding.ts
export interface TextureBinding { shown: string | null, wanted: string }
export function nextTextureBinding(state: TextureBinding, wanted: string, wantedReady: boolean): { state: TextureBinding, release: string | null }
// ui/lib/patch-textured-material.ts
export interface TexturedUniforms { uMapIn: { value: number }, uMapTint: { value: Color } }
export function patchTexturedShader(shader: WebGLProgramParametersWithUniforms, uniforms: TexturedUniforms): void
export function patchTexturedMaterial(this: Material, shader: WebGLProgramParametersWithUniforms): void // reads this.userData.textured
export const TEXTURED_PROGRAM_KEY: string
// hooks/use-texture-maps.ts
export function useTextureMaps(set: TextureSetId, map: TextureMapChoice, enabled: boolean): { map: Texture, normalMap: Texture, roughnessMap: Texture, ready: boolean }
export function useTextureHold(requests: readonly { set: TextureSetId, map: TextureMapChoice }[]): void
// textured-material.tsx
interface TexturedMaterialProps { set: TextureSetId, map: TextureMapChoice, color: ColorRepresentation, mapTint?: ColorRepresentation, roughness?: number, metalness?: number, emissive?: string, emissiveIntensity?: number, opacity?: number, depthWrite?: boolean, transparent?: boolean, polygonOffset?: boolean, polygonOffsetFactor?: number, polygonOffsetUnits?: number, loadWhen?: boolean, ref?: Ref<MeshStandardMaterial> }
export interface SurfaceTexture { set: TextureSetId, map: TextureMapChoice, mapTint?: ColorRepresentation, loadWhen?: boolean }
```

`MergedBoxes`, `WallSkin` and `AtticSteps` gain `texture?: SurfaceTexture`. On `MergedBoxes` it selects `'metres'` UVs and renders `TexturedMaterial`.

`color` is always today's flat colour. A `'grey'` map shows `(mapTint ?? color) × GREY_MAP_LIFT × map`. `'own'` and blends show `(mapTint ?? white) × map`.

`patchTexturedShader` is exported so a material with a patch of its own (covering wear's roof dirt, built later) calls it first inside its own `onBeforeCompile` and extends `TEXTURED_PROGRAM_KEY` in its cache key, instead of stacking a second material on the same mesh.

- [ ] **Step 1: Write the failing tests**, on a fake `load` that resolves on command and `lingerMs: 0`:
  - `one_load_per_url`: two acquires, one `load` call; both listeners fire on arrival.
  - `released_maps_leave_memory`: release, wait a tick: `dispose` was called and `get` returns null.
  - `reacquired_within_linger_is_kept`: with `lingerMs: 50`, release then acquire: no `dispose`.
  - `a_late_arrival_is_thrown_away`: acquire, release, linger passes, the load resolves: that texture is disposed and no listener fires.
  - `a_failure_retries_on_reconnect`: `load` rejects, `get` stays null, no throw; the `whenOnline` callback runs, `load` is called again, the map arrives.
  - `a_failure_with_no_holders_does_not_retry`.
  - `the_shown_maps_stay_until_the_new_ones_are_ready`: `nextTextureBinding({ shown: 'a', wanted: 'a' }, 'b', false)` keeps `shown: 'a'` and releases nothing; then with `wantedReady` true, `shown: 'b'` and `release: 'a'`.
  - `a_pick_back_before_arrival_releases_nothing_shown`: shown `a`, wanted `b` not ready, then wanted `a` again: `shown: 'a'`, `release: null`.
  - `the_patch_declares_and_shares_its_uniforms`: run `patchTexturedShader` over a `ShaderLib.standard` clone with fresh uniforms: the fragment contains `uniform float uMapIn;` and `uniform vec3 uMapTint;` and no `#include <map_fragment>`; `shader.uniforms.uMapIn` is the very object passed in; the vertex still contains `#include <uv_vertex>`, followed by a `USE_INSTANCING` block that writes `vMapUv`, `vNormalMapUv` and `vRoughnessMapUv`.
- [ ] **Step 2:** Run. Expected: fails on the missing modules.
- [ ] **Step 3:** Implement `texture-store.ts` and `texture-binding.ts` to those tests.
- [ ] **Step 4:** Implement `texture-store-for.ts`: a `WeakMap<WebGLRenderer, TextureStore>`; `KTX2Loader` with `setTranscoderPath('/scenes/basis/')`, `setWorkerLimit(2)`, `detectSupport(gl)`, then, when `workerConfig.etc2Supported` or `workerConfig.astcSupported` is true, set `workerConfig.bptcSupported = false` before the first load, so ETC1S lands in ETC2 at half BC7's memory and the budget holds. On load, `RepeatWrapping` both ways, `repeat.set(1 / tileMetres, 1 / tileMetres)`, anisotropy `min(8, gl.capabilities.getMaxAnisotropy())`. `lingerMs` 5000. `whenOnline` listens to `window` `online`. `texture-placeholders.ts`: three shared 1×1 `DataTexture`s: white sRGB map, `(128,128,255)` normal, white roughness.
- [ ] **Step 5:** Implement `patch-textured-material.ts`. `patchTexturedMaterial` reads `this.userData.textured` and calls `patchTexturedShader`. The algorithm:

```glsl
// fragment: declarations prepended; this replaces #include <map_fragment>
#ifdef USE_MAP
  vec4 sampled = texture2D( map, vMapUv );
  #ifdef TEXTURE_MACRO
    float wide = dot( texture2D( map, vMapUv * 0.083, 3.0 ).rgb, vec3( 0.333 ) );
    float mean = max( dot( textureLod( map, vMapUv, 12.0 ).rgb, vec3( 0.333 ) ), 0.01 );
    sampled.rgb *= clamp( wide / mean, 0.8, 1.2 );
  #endif
  diffuseColor.rgb = mix( diffuseColor.rgb, sampled.rgb * uMapTint, uMapIn );
#endif
// vertex: appended after #include <uv_vertex>, which stays
#ifdef USE_INSTANCING
  vec3 laid = ( instanceMatrix * vec4( position, 1.0 ) ).xyz;
  vec2 metres = abs( normal.y ) > 0.5 ? laid.xz : ( abs( normal.x ) > 0.5 ? laid.zy : laid.xy );
  metres += fract( instanceMatrix[ 3 ].xz * 7.13 ) * 3.7;
  vMapUv = ( mapTransform * vec3( metres, 1.0 ) ).xy;
  vNormalMapUv = ( normalMapTransform * vec3( metres, 1.0 ) ).xy;
  vRoughnessMapUv = ( roughnessMapTransform * vec3( metres, 1.0 ) ).xy;
#endif
```

  The mix runs before `<color_fragment>`, so an instance's own colour still multiplies it.
- [ ] **Step 6:** Implement `use-texture-maps.ts`. `useTextureMaps` acquires the three maps while `enabled` (sticky once true) and drives `nextTextureBinding`, so the shown maps stay bound until the wanted ones have all arrived and only then are released; a blend change never flashes flat. Once the primaries have arrived, prefetch `sibling` with a low-priority `fetch` so its bytes sit in the HTTP cache; a sibling is never transcoded or uploaded until it is bound. Call `gl.initTexture` on each map when it becomes the bound one, so a late arrival cannot stall a frame. Maps that arrive before the blueprint load's upload step are caught by `uploadSceneTextures` unchanged. Until ready, return placeholders. `useTextureHold` acquires each request's three maps while mounted and binds nothing.
- [ ] **Step 7:** Implement `textured-material.tsx`. Create `userData` once with `useState` (never recomputed: `applyGhost` writes `ghostBase` into it, and a new object mid-ghost loses the recorded opacity): `{ [SOLID_MAP_KEY]: true, textured: { uMapIn: { value }, uMapTint: { value: Color } } }`. Pass `onBeforeCompile={patchTexturedMaterial}` and `customProgramCacheKey` returning `TEXTURED_PROGRAM_KEY`; `defines` carries `TEXTURE_MACRO` from the table, set once at mount; do not pass `normalScale`. Ease `uMapIn` and `normalScale` with the shared `useTweened` (`src/shared/components/scene/hooks/use-tweened.ts`), target `ready ? 1 : 0`, 250 ms, which asks for frames only while running, opens on its target at mount, and honours reduced motion. `roughness` is divided by `ROUGHNESS_MAP_MEAN` once ready. `uMapTint` is recomputed in a `useLayoutEffect` on prop change, which then calls `invalidate()`.
- [ ] **Step 8:** Wire `MergedBoxes`, `WallSkin` and `AtticSteps`. In `MergedBoxes`, derive `uvs = texture ? 'metres' : 'per-box'` and put `uvs`, never the `texture` object, in `useOwnedGeometry`'s dependencies, so an inline `texture={{…}}` never rebuilds the geometry. Without `texture`, each renders exactly what it renders now.
- [ ] **Step 9:** Run the script, `pnpm tsc`, eslint and the purity grep: clean, `ok`. Commit: `feat(trade-scenes): a shared texture store and a material that eases from flat colour to its map`.

---

### Task 6: Stucco

**Files:** Modify `constants/material-textures.ts`, `constants/system-parts.ts`, `ui/lib/wall-skin-look.ts`, and in `ui/components/home-kit/`: `home-kit.tsx`, `house-shell.tsx`, `gable-roof.tsx`, `foundation.tsx`, `low-slope-roof.tsx`, `garage.tsx`, `garage-gable-end.tsx`. Test: `scripts/verify-material-textures.ts`.

**Interfaces:** Produces `STUCCO_TEXTURE: SurfaceTexture = { set: 'stucco', map: 'grey' }`; `isStuccoFinish(material: string | null): boolean` exported from `constants/system-parts.ts`, where today's private `stuccoFinish` predicate becomes a call to it; `wallSkinLook(lit, paintColor, stucco: boolean)` returning `texture: SurfaceTexture | undefined` beside `color`. `PaintLook` and `paintLook` do not change.

- [ ] **Step 1: Write the failing tests.**
  - `a_stucco_home_takes_the_plaster`: `isStuccoFinish('stucco-finish')` is true; `isStuccoFinish('siding')` and `isStuccoFinish(null)` are false.
  - `the_skin_carries_the_texture`: `wallSkinLook(null, '#ffffff', true).texture` equals `STUCCO_TEXTURE`; with `false` it is `undefined`. A siding home keeps flat paint.
  - `every_body_site_passes_the_skin_texture`: read each of `house-shell.tsx`, `gable-roof.tsx`, `foundation.tsx`, `low-slope-roof.tsx`, `garage.tsx`, `garage-gable-end.tsx` as text (the style `verify-trade-scene.ts` already uses for source checks) and assert the count of `skin.texture` (or `texture={texture}` in `garage-gable-end`) matches the sites in Step 4, and that no trim, fascia or door line carries a `texture`.
- [ ] **Step 2:** Run. Expected: fails.
- [ ] **Step 3:** `home-kit.tsx` computes `stucco = isStuccoFinish(partState(wallParts, 'finish').material)` and passes `stucco` to `HouseShell`, `GableRoof`, `Foundation`, `LowSlopeRoof` and `Garage`, each of which passes it to `wallSkinLook`. `Garage` gains a `stucco: boolean` prop and `GarageGableEnd` a `texture?: SurfaceTexture` prop.
- [ ] **Step 4:** Pass `texture={skin.texture}` at every body site, keeping `color={skin.color}` so paint picks, chalk and the bare base coat work unchanged: `WallSkin` ×3 and corner `MergedBoxes` ×2 in `house-shell`; `CRAWL_SKIRT_BOXES` and `FRONT_CRAWL_SKIRT_BOXES` in `foundation`; `PARAPETS`, `COMPLETE_PARAPETS`, `PARAPET_CORNERS` in `low-slope-roof`; `boxes.body` and `GarageGableEnd` in `garage`. Swap the raw `meshStandardMaterial` for `TexturedMaterial` (when `skin.texture` is set) on the two gable meshes in `gable-roof` and in `garage-gable-end`. Trim, fascia and doors stay flat.
- [ ] **Step 5:** Run the script, `verify-trade-scene`, `tsc`, eslint. Commit: `feat(trade-scenes): stucco walls, gables, parapets, skirt and garage take the plaster texture`.

---

### Task 7: Shingles

**Files:** Modify `ui/components/home-kit/roof-covering.tsx`. Test: `scripts/verify-material-textures.ts`.

**Interfaces:** Consumes `InstancedPieces`' existing `children` slot, so the shared component does not change. Covering wear (owner, 2026-11-11: textures go first) later replaces this child with its own material, which calls `patchTexturedShader` first.

- [ ] **Step 1: Write the failing test.** `shingles_take_the_grit`: read `roof-covering.tsx` as text; the `shingle` course passes `TexturedMaterial` with `set="shingle"`, and the tile and shake courses do not. The instancing UVs are covered by Task 5's patch test.
- [ ] **Step 2:** Run. Expected: fails.
- [ ] **Step 3:** In the `course === 'shingle'` case only, pass `<TexturedMaterial set="shingle" map="grey" color="#ffffff" roughness={wornValue(0.8, 0.95, wear)} />` as children. White flat colour times the instance colour is exactly today's look. Tile and shake stay as they are.
- [ ] **Step 4:** Run the script, `verify-trade-scene`, `tsc`, eslint. Commit: `feat(trade-scenes): shingle tabs take real grit, at real scale and varied tab to tab`.

---

### Task 8: Insulation and deep batts

**Files:** Modify `lib/attic-insulation-boxes.ts`, `ui/components/home-kit/attic-floor.tsx`, `ui/components/home-kit/crawl-insulation.tsx`; create `hooks/use-system-opened.ts`. Test: `scripts/verify-material-textures.ts`.

**Interfaces:** Produces `useSystemOpened(system: HomeSystemId): boolean`, true and sticky once `state.cameraFocus === system || houseOpen(state)`. Produces `insulationTextureSet(material: string): 'fiber-blown' | 'fiber-batt'` in `attic-insulation-boxes.ts`.

- [ ] **Step 1: Write the failing tests** on `atticInsulationBoxes('batts-r38', false, ATTIC_SPANS.open)`:
  - `deep_batts_are_one_panel_per_bay`: every box's x extent sits inside one gap of `ATTIC_JOIST_XS`, so no box crosses a joist.
  - `deep_batts_stand_above_the_joists`: the tallest panel's top is `WALL_TOP_Y + 0.31`.
  - `deep_batts_step_down_at_the_eaves`: panels nearer the wall have lower tops, none rises past the roof underside.
  - `the_top_height_still_reports`: `atticInsulationTop('batts-r38', false, z)` equals the top of the panel at that z, at the ridge and at the eave.
  - `shallow_batts_are_unchanged`: `batts-r11` gives one box per bay; `blown-r38` still gives sheets across the joists.
- [ ] **Step 2:** Run. Expected: the first fails.
- [ ] **Step 3:** In `atticInsulationBoxes`, when the batt is deeper than the joists (any band `overJoists`), return one box per bay per band, each from 0 to `band.top`, at the band's z, as wide as the bay. The sheet over the joists is gone for batts. Shallower batts keep their code path. Leave `atticInsulationTop` as it is unless a test says otherwise.
- [ ] **Step 4:** Pass textures. In `attic-floor.tsx`, `loadWhen = useSystemOpened('attic')`; laid blankets use `insulationTextureSet(material)`, `map: 'own'`, `mapTint: wornColor('#ffffff', HOME_PALETTE.insulationWorn, insulation.wear)`; the old blanket uses `insulationTextureSet(over)` with `mapTint: HOME_PALETTE.insulationWorn`. In `crawl-insulation.tsx`, `fiber-batt` with `useSystemOpened('foundation')`. Existing `color` props stay.
- [ ] **Step 5:** Run the script and `verify-trade-scene` (its leak checks must still pass), `tsc`, eslint. Commit: `feat(trade-scenes): fiberglass takes its texture, and deep batts stand one panel per bay with the joists showing`.
- [ ] **Step 6: Owner look.** Ask the owner to start the dev server and open the house on the iPad: stucco, shingles, attic with R-38 batts and blown fill. Also check Look inside, ghosting, Thermal, paint and shingle picks, and the blueprint load. Ask whether the garage roof, which stays one plain colour, should take the shingle grit too. Stop for their word before Task 9.

---

### Task 9: The lot's lawn, paving and beds

**Files:** Modify `constants/ground-materials.ts`, `ui/lib/ground-strip-geometry.ts`, `ui/components/home-kit/lot-ground.tsx`, `ui/components/home-kit/lot.tsx`, `ui/components/layout-kit/layout-ground.tsx`, `ui/components/layout-kit/layout-lot.tsx`. Delete `ui/lib/create-lawn-texture.ts`. Test: `scripts/verify-material-textures.ts`.

**Interfaces:** Consumes `TexturedMaterial` and `MergedBoxes.texture`. Produces `GROUND_MATERIALS[id].look.texture?: TextureSetId`, the set a material draws when healthy, replacing today's `texture?: 'lawn'`: `sod` `sod-healthy`, `turf` `turf`, `gravel`, `mulch`, `concrete`, `asphalt` their own ids, `pavers` `pavers-courtyard`. `dg`, `river-rock`, `dirt` and `pool` have none.

- [ ] **Step 1: Write the failing tests.**
  - `the_lawn_maps_in_metres`: `groundStripGeometry(rows, w, 1)` gives each vertex the UV `(x, z)`, the same orientation as region strips, so a sod region lies on the lawn without a mirrored seam.
  - `joints_and_fences_stay_flat`: read `lot.tsx` and `layout-lot.tsx` as text; the lines drawing concrete joints, walls and fences carry no `texture`.
  - `every_textured_material_names_a_set`: each `look.texture` is a key of `TEXTURE_SETS`.
- [ ] **Step 2:** Run. Expected: fails.
- [ ] **Step 3:** In `ground-strip-geometry.ts`, the UV is `(x / tile, z / tile)`. In both ground components, drop the local `TILE_METRES` and call `groundStripGeometry(rows, HALF_WIDTH, 1)`, so UVs are metres. Render `<TexturedMaterial set="sod-healthy" map="own" color={flat} mapTint={ground.color} roughness={ground.roughness} />`, where `flat` is `GROUND_MATERIALS.sod.look.color` multiplied by `ground.color`, memoized.
- [ ] **Step 4:** In `lot.tsx` and `layout-lot.tsx` give the asphalt boxes `{ set: 'asphalt', map: 'own' }` and the concrete boxes `{ set: 'concrete', map: 'own' }`. In `lot.tsx` give mulch `{ set: 'mulch', map: 'own' }`. Colours stay.
- [ ] **Step 5:** Delete `create-lawn-texture.ts`. `git grep -n createLawnTexture`: no hits. Run the script, `verify-layout-kit`, `verify-trade-scene-lot`, `tsc`, eslint. Commit: `feat(trade-scenes): the lawn, driveway and beds take their real textures`.

---

### Task 10: Drawn ground and worn looks

**Files:** Create `constants/ground-appearances.ts`, `lib/ground-appearance.ts`, `lib/ground-draw.ts`, `ui/lib/create-wear-marks-texture.ts`. Modify `types.ts` (export `WornStep`), `ui/components/layout-kit/layout-regions.tsx`, `ui/components/layout-kit/layout-lot.tsx`. Delete `ui/lib/create-wear-texture.ts`. Test: `scripts/verify-material-textures.ts`.

**Interfaces:** Produces:

```ts
// constants/ground-appearances.ts
export interface GroundColor { id: string, name: string, hex: string, mapTint: string | null, blend?: string }
export interface GroundPattern { id: string, name: string, set: TextureSetId, colors: readonly GroundColor[] }
export const GROUND_APPEARANCES = { … } as const satisfies Partial<Record<GroundMaterialId, readonly GroundPattern[]>>
// lib/ground-appearance.ts
export const packAppearance: (pattern: number, color: number) => number   // pattern << 4 | color, 0 is the default
export function readAppearance(material: GroundMaterialId, appearance: number): { pattern: GroundPattern, color: GroundColor } | null  // out-of-range index reads as 0; null for a material with no appearances
export function appearanceOptions(material: GroundMaterialId, wear: Wear | null): readonly GroundPattern[] | null // null when worn asphalt or no appearances
// lib/ground-draw.ts
export interface GroundDraw { set: TextureSetId, map: TextureMapChoice, mapTint: string | null, shade: { tint: keyof typeof LOT_PALETTE, amount: number } | null, marks: 'lawn' | 'paving' | null }
export function groundDraw(material: GroundMaterialId, wear: Wear | null, appearance: number): GroundDraw | null
export function lotTextureRequests(lot: LotLayout): readonly { set: TextureSetId, map: TextureMapChoice }[] // every set either layer draws, once each
// ui/lib/create-wear-marks-texture.ts
export function createWearMarksTexture(look: 'lawn' | 'paving', wear: WornStep): CanvasTexture | null
```

`GROUND_APPEARANCES`, with `mapTint: null` being Natural (first in every list, `hex` the material's `look.color`). `ColorSwatches` takes each pattern's `colors` as they are:
- `gravel`: White `#ece8df`, Light grey `#b3afa8`, Tan `#c0a47b`, Buff `#d2bd96`, Charcoal `#5b5853`.
- `mulch`: Black `#2a2623`, Red `#7b3a29`, Dark brown `#4f3928`, Cedar `#a47748`.
- `concrete`: Light `#ddd5c7`, Standard grey `#bdb4a5`, Sandstone `#c9b69a`, Tan `#b49f82`, Terracotta `#a66b4d`, Charcoal `#5c5956`.
- `asphalt`: Fresh black `#2e2e30`, Sealed `#3d3d40`, Weathered grey `#74726f`, Faded `#918e89`.
- `pavers`, in this order: Courtyard Stone (`pavers-courtyard`), Interlocking wave, Herringbone, Ashlar mixed sizes, Small herringbone, Clean interlocking, Tumbled squares. The six non-Courtyard patterns share Natural plus Light grey `#b9b5ad`, Sand `#c9b693`, Tan `#b39a7d`, Terracotta `#a36048`, Charcoal `#57544f`.
- Courtyard colors (no Natural; `mapTint: null`, `blend` the slug from `blends.json`, `hex` that blend's first tone), default first: Dark Gray – Pewter – Charcoal `#9a999a`, Gray – Charcoal `#7d7b7f`, Dark Gray – Copper – Charcoal `#9b928d`, Gray – Moss – Charcoal `#a19883`, Adobe – Copper – Mocha `#ab8d75`, Sand – Stone – Mocha `#a98c6e`, Sand – Copper – Stone `#b29674`, Cream – Brown – Charcoal `#a78f83`, Cream – Terracotta – Brown `#b68a73`, Tuscan `#9d8573`.

- [ ] **Step 1: Write the failing tests** on `groundDraw`:
  - `sod`: good → `sod-healthy` own, `marks` null; worn → `sod-worn` own, `marks: 'lawn'`; failing → `sod-worn`, `marks: 'lawn'`.
  - `asphalt`: good, appearance 0 → `asphalt` own; good, Sealed → `asphalt` grey with `mapTint` `#3d3d40`; worn with any appearance → `asphalt-worn` own, `mapTint` null.
  - `concrete`: failing keeps `concrete`, `marks: 'paving'`.
  - `gravel`: worn keeps `gravel`, `shade` non-null, `marks` null.
  - `pavers`: appearance 0 → `pavers-courtyard`, `map: { blend: 'dark-gray-pewter-charcoal' }`; Herringbone with Terracotta → `pavers-herringbone` grey with `mapTint` `#a36048`.
  - `dg`, `river-rock`, `dirt`, `pool` → `null`.
  - `readAppearance('gravel', packAppearance(0, 15))` reads Natural.
  - `failing_is_worse_than_worn`: in `GROUND_WEAR_LOOKS`, lawn `failing` marks exceed `worn` marks; paving `failing` marks and breaks each exceed `worn`'s.
  - `both_layers_are_held`: a lot with gravel on Today and Courtyard pavers on Build gives `lotTextureRequests` containing both sets.
- [ ] **Step 2:** Run. Expected: fails.
- [ ] **Step 3:** Implement. The healthy set comes from `GROUND_MATERIALS[material].look.texture`. `turf` draws the `turf` set, own colours, with no appearances. `fair` on sod and asphalt uses the healthy set with `shade` from `GROUND_WEAR_LOOKS[...].fair`. `loose` steps give `shade = { tint, amount: mix * WEAR_AMOUNT.worn }`. Colour maths stay in `layout-regions.tsx`, so `lib/` stays pure.
- [ ] **Step 4:** Create `create-wear-marks-texture.ts` from `create-wear-texture.ts`: a transparent canvas, no base fill and no blades, keeping the bare-soil patches, stains, breaks and cracks and their seeds. Return null when a step draws nothing (lawn `fair`). Delete `create-wear-texture.ts`; `git grep -n createWearTexture`: no hits.
- [ ] **Step 5:** In `layout-regions.tsx`, each strip with a `groundDraw` renders `TexturedMaterial`, passing appearance 0 until Task 11 gives strips an appearance. `stripLook` gains the draw and resolves `shade` with `wornColor`. Its `color` is the flat fallback: a tinted region's `mapTint`; else `look.color`, a `loose` step's existing worn colour, or on sod `look.color` multiplied by `ground.color`, never a bare white. `mapTint` is the draw's `mapTint` for a grey map; otherwise the resolved shade, and on sod `ground.color` multiplied by it when there is one. A strip with marks adds a second mesh on the same geometry: `transparent`, `depthWrite={false}`, `polygonOffset` factor and units -1, `ignoreRaycast`, `receiveShadow`. That is one extra draw per worn strip, which the spec accepts. Overlay textures are keyed by `look/wear` and disposed as today's canvases are. `groundDraw` is null: today's material exactly. In `layout-lot.tsx`, call `useTextureHold(lotTextureRequests(lot))` (memoized on the lot), so maps of the layer not on screen stay in memory and Today ⇄ Build never reloads them.
- [ ] **Step 6:** Run the script, `verify-layout-kit`, `verify-property-layout`, `tsc`, eslint, the purity grep and `check-scene-assets`. Commit: `feat(trade-scenes): drawn ground takes real textures, and worn marks lie over them`.
- [ ] **Step 7: Owner look.** Ask the owner to open the lab on the iPad with a worn lawn, failing asphalt, gravel, mulch, turf and pavers. Check repetition from the street, the Today ⇄ Build toggle after a minute's pause, and taps on regions. Stop for their word before Task 11.

---

### Task 11: Appearance in the layout and its link

**Files:** Modify `types.ts`, `schemas/property-layout.ts`, `lib/layout-codec.ts`, `lib/default-layout.ts`, `lib/retile-property-layout.ts`, `lib/shown-ground.ts`, `lib/lot-regions.ts`, `lib/create-layout-editor.ts`, `lib/yard-picks.ts`, `lib/ground-draw.ts`, `ui/components/layout-kit/layout-regions.tsx`, `ui/components/controls/yard-card-body.tsx`, `scripts/verify-layout-kit.ts`. Test: `scripts/verify-property-layout.ts`.

**Interfaces:** Produces:

```ts
export interface YardBase { material: GroundMaterialId, wear: Wear | null, appearance: number }
export interface LotLayout { /* … */ appearance: { existing: Uint8Array, proposed: Uint8Array } }
export interface LotRegion { /* … */ appearanceExisting: number, appearanceProposed: number }
export interface GroundStripKey { material: GroundMaterialId, wear: Wear | null, appearance: number }
export interface GroundBrush { /* … */ appearanceExisting?: number, appearanceProposed?: number }
export function shownGround(lot, layer, i): { material: number, wear: number, appearance: number }
export function drawnAppearance(id: GroundMaterialId, appearance: number): number
export function yardGroundToday(...): { material, wear, appearance: number | Mixed } | null
export function yardGroundBuild(...): { material: GroundMaterialId | Mixed, appearance: number | Mixed } | null
export function setYardGround(layout, yard, system, patch: { material?, wear?, appearance? }): PropertyLayout
export function setYardBase(layout, yard, patch: { material?, wear?, appearance? }): PropertyLayout
export function setYardBuild(layout, yard, system, patch: { material?: GroundMaterialId | typeof PROPOSED_KEEP, appearance?: number }): PropertyLayout
```

Wire: `_v: 4`; `lot.appearance: { existing, proposed }` as runs, optional in the schema; a base's `a` optional beside `m` and `w`.

- [ ] **Step 1: Write the failing tests** in `verify-property-layout.ts`:
  - `an_appearance_round_trips`: paint a region's existing and proposed appearance, encode, decode: both arrays, a base's appearance **and every tile's wear** equal. `_v` is 4.
  - `old_links_read_default`: a `_v: 3` and a `_v: 2` wire decode with their wear as before, zeroed appearance arrays and base appearance 0.
  - `an_appearance_past_the_list_still_opens`: a tile with `packAppearance(0, 15)` on gravel decodes non-null and `groundDraw` gives Natural.
  - `retile_keeps_appearance`: `retilePropertyLayout` to half the tile keeps appearance at the matching tiles.
  - `strips_split_on_appearance`: two gravel regions, same wear, different colors give two strip keys; the same appearance on dirt-only tiles adds none.
  - `kept_ground_shows_today`: `shownGround(lot, 'proposed', i)` on a `PROPOSED_KEEP` tile returns `appearance.existing[i]`; on a built tile, `appearance.proposed[i]`.
  - `a_build_pick_leaves_today_alone`: `appearanceProposed` changes `appearance.proposed` only.
  - `changing_material_clears_its_color`: repaint to another material with no appearance: `appearance.existing` is 0. Repaint the same material: kept.
  - `undo_restores_material_and_appearance`: `commitLayout` then `undoLayout` returns the earlier material and appearance together.
  - `regions_split_on_appearance`: two touching gravel regions of different color are two `lotRegions`.
  - `a_base_keeps_its_appearance`: `setYardBase` with an appearance writes the base and only tiles matching the old base; `removeRegion` restores the base's appearance.
  - `the_link_stays_short`: the default layout with two regions given appearances encodes under `LAYOUT_URL_MAX`.
  - Update the existing `setYardBuild` and `yardGroundBuild` asserts to the patch argument and the `{ material, appearance }` result.
- [ ] **Step 2:** Run. Expected: fails.
- [ ] **Step 3:** Implement the types and thread them.
  - Schema: `_v` accepts 2, 3 and 4. Codec: the two `_v === 3` checks in `decodePropertyLayout` (wear runs, and whether to fill default wear) become `_v >= 3`; without that, every `_v: 4` link loses its wear.
  - `defaultLayout` zero-fills both arrays and sets base appearance 0. `retilePropertyLayout` resamples both arrays as it does `wear`.
  - `sameRegion` and `base` compare appearance.
  - `drawnAppearance` sits beside `drawnWear` in `shown-ground.ts` and is 0 for a material without appearances, so a stale byte never splits a strip. `groundStripKeys` packs `material * WEAR_SLOTS * 256 + wear * 256 + drawnAppearance`.
  - `applyStroke`: when a tile's material changes on a layer, its appearance on that layer becomes the brush's or 0; `GROUND_BASE` writes `base.appearance`; `appearanceExisting` or `appearanceProposed` alone writes where the tile has that layer's material. `appearanceProposed` skips `PROPOSED_KEEP` tiles. Same-layout return when nothing changes.
  - `withBase` compares appearance. `setYardBase` filters on the old appearance too.
  - `decodePropertyLayout` fills zeros for missing appearance; a value past a list is **not** a reject.
  - `yard-card-body.tsx` moves to the new `setYardBuild` patch and `yardGroundBuild` result.
- [ ] **Step 4:** `layout-regions.tsx` passes each strip's appearance to `groundDraw` and keys strips `${material}:${wear}:${appearance}`. `picks` compares `drawnAppearance` too.
- [ ] **Step 5:** Run `verify-property-layout`, `verify-layout-kit`, `verify-trade-scene-lot`, `tsc`, eslint, the purity grep. Commit: `feat(trade-scenes): each drawn region holds its own appearance, on each layer, in the link`.

---

### Task 12: The picker

**Files:** Create `ui/components/panel/ground-appearance-picks.tsx`. Modify `ui/components/controls/yard-card-body.tsx`, `ui/components/controls/yard-focus-body.tsx`, `constants/home-scene-copy.ts`.

**Interfaces:**

```ts
interface GroundAppearancePicksProps { material: GroundMaterialId, wear: Wear | null, value: number | Mixed, onPick: (appearance: number) => void }
```

Consumes `appearanceOptions`, `packAppearance`, `ColorSwatches`, `ChoicePill`.

- [ ] **Step 1:** Implement. Returns null when `appearanceOptions` is null. With more than one pattern, a `ChoicePill` picks the pattern (a new pattern starts at color 0, or keeps the color index if the new pattern has it and both are plain tints). `ColorSwatches` picks the color from the pattern's `colors`. When the value is `mixed`, the pill shows no pattern selected and the swatches stay hidden until a pattern is picked. Follow the padding of the wrapper `system-card-body.tsx` puts around `ShingleColors`.
- [ ] **Step 2:** Pass it as `LotPickChip`'s `extra`, only when the chip's material is one value (not `mixed`, not null).
  - Yard card Today: `setYardGround(current, yard, system, { appearance })`.
  - Yard card Build: `setYardBuild(current, yard, system, { appearance })`, with `value` from `yardGroundBuild(...).appearance`.
  - Focus card Today: `paint({ existing: null, proposed: null, appearanceExisting: appearance })`.
  - Focus card Build: `paint({ existing: null, proposed: null, appearanceProposed: appearance })`.

  Asphalt and sod have no Build chip, so no Build picker appears. Worn asphalt returns null on Today.
- [ ] **Step 3:** Add `GROUND_APPEARANCE_COPY` (`pattern: 'Pattern'`, `color: 'Colour'`) to `home-scene-copy.ts`.
- [ ] **Step 4:** Run `tsc`, eslint, `verify-layout-kit`. If a dev server is already running, check one case with Playwright: open a pavers region's menu, pick Tuscan, confirm the menu lists the colours and the URL's `_v` is 4. Otherwise say this was not run.
- [ ] **Step 5:** Commit: `feat(trade-scenes): pattern and colour pick inside the material's menu, per region`.

---

### Task 13: Close-out

**Files:** The tracker `docs/plans/2026-10-16-trade-scenes-epic.md` on the foundation worktree, and the lab's `CONTEXT.md` (the Appearance entry and the Region line were added when the owner chose the word, 2026-11-11).

- [ ] **Step 1:** Run everything once more: `pnpm tsc`, `env CI=1 pnpm eslint src/features/trade-scenes`, the purity grep, all six verify scripts, `verify-material-textures`, `check-scene-assets`. Report the actual output and the printed budget totals.
- [ ] **Step 2: Owner look, final.** Ask the owner for an iPad pass on cellular and wifi: first load, per-region colours, flipping Courtyard blends, an offline reload (flat, then textured on reconnect), Today ⇄ Build after a pause, and a long session with no context loss. Log the transcoder's chosen format (`workerConfig`) once on the iPad, and record the real memory and download numbers against the budget.
- [ ] **Step 3:** Update R286–R292 and the R285 row (fixed in `e0deb98da`) in the tracker.
- [ ] **Step 4:** Both the lab's `CONTEXT.md` and the foundation's tracker carry other sessions' uncommitted lines, which an explicit-path commit would sweep in. Show the owner `git diff` of each and commit only on their word: `docs(trade-scenes): the material textures are built and judged on the iPad`. Leave the merge and ship to the owner.
