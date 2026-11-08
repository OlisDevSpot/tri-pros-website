import type { Material, Object3D, Side, Texture } from 'three'
import type { HomePaintKey, HomeThermalZone } from '@/features/trade-scenes/constants/home-thermal-zones'
import type { ThermalTagData } from '@/features/trade-scenes/lib/thermal-tag'
import type { HomeFade, PartPaint, SystemPartId, SystemPartTagData } from '@/features/trade-scenes/types'
import type { PartRamp } from '@/features/trade-scenes/ui/lib/part-paint'

import { Color, Mesh, MeshBasicMaterial, ShaderMaterial, Vector3 } from 'three'

import { HOME_FADES } from '@/features/trade-scenes/constants/home-fades'
import { HOME_THERMAL_PALETTE } from '@/features/trade-scenes/constants/home-temperatures'
import { HOME_PAINT_KEYS, OWN_PAINT } from '@/features/trade-scenes/constants/home-thermal-zones'
import { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'
import { fitRamp, tintRamps } from '@/features/trade-scenes/ui/lib/part-paint'
import { thermalPaintColor } from '@/features/trade-scenes/ui/lib/thermal-paint-color'
import { THERMAL_FRAGMENT_SHADER, THERMAL_VERTEX_SHADER } from '@/shared/components/scene/constants/thermal-shader'

type PaintValues = Readonly<Record<HomePaintKey, number>>

interface ResolvedTag {
  zone: HomeThermalZone | typeof OWN_PAINT | null
  part: string | null
  /** The nearest system part tag above the mesh, or none. */
  partTag: SystemPartTagData
  /** One bit per fade-tagged group above the mesh, in `HOME_FADES` order, one more for a root the ghost fades, and one for the garage. */
  fades: number
}

interface Decal {
  key: HomePaintKey
  material: MeshBasicMaterial
}

type PartValues = Readonly<Partial<Record<SystemPartId, PartPaint>>>

// Everything the thermal camera put on the home: the materials it made, and what each mesh wore before. The lit system parts
// up close are painted through their depth rather than by zone, from the same set, so one record of originals hands every
// mesh back whichever way it was painted.
export interface ThermalPaintSet {
  values: PaintValues
  parts: PartValues
  surfaces: Map<number, { key: HomePaintKey, material: ShaderMaterial }>
  decals: Map<Material, Decal>
  ramps: Map<Mesh, PartRamp>
  owned: Set<Material>
  originals: Map<Mesh, Mesh['material']>
}

const UP = new Vector3(0, 1, 0)
const KEY_INDEX = new Map<HomePaintKey, number>(HOME_PAINT_KEYS.map((key, index) => [key, index]))
const FADE_BIT = new Map<HomeFade, number>(HOME_FADES.map((fade, index) => [fade, 1 << index]))
const GHOST_BIT = 1 << HOME_FADES.length
const GARAGE_BIT = GHOST_BIT << 1
const EVERY_FADE = (GARAGE_BIT << 1) - 1
const PART_INDEX = new Map<SystemPartId, number>([...new Set(SYSTEM_PARTS.map(entry => entry.id))].map((id, index) => [id, index]))
const NO_PART: SystemPartTagData = {}
// One record every mesh's tag is read into, so a scan allocates nothing per mesh.
const TAG: ResolvedTag = { zone: null, part: null, partTag: NO_PART, fades: 0 }

export function createThermalPaintSet(values: PaintValues, parts: PartValues = {}): ThermalPaintSet {
  return { values, parts, surfaces: new Map(), decals: new Map(), ramps: new Map(), owned: new Set(), originals: new Map() }
}

// Read fresh each pass rather than cached: a group's tag can change under a mesh (a unit starting or stopping).
function tagOf(object: Object3D, root: Object3D): ResolvedTag {
  TAG.zone = null
  TAG.part = null
  TAG.partTag = NO_PART
  TAG.fades = 0
  for (let node: Object3D | null = object; node && (TAG.zone === null || TAG.part === null || TAG.partTag === NO_PART || TAG.fades !== EVERY_FADE); node = node === root ? null : node.parent) {
    const data = node.userData as ThermalTagData & SystemPartTagData
    TAG.zone ??= data.thermalZone ?? null
    TAG.part ??= data.thermalPart ?? null
    if (TAG.partTag === NO_PART && data.scenePart !== undefined) {
      TAG.partTag = data
    }
    const fade = node.userData.homeFade as HomeFade | undefined
    if (fade !== undefined) {
      TAG.fades |= FADE_BIT.get(fade)!
    }
    if (node.userData.homeGhost === true) {
      TAG.fades |= GHOST_BIT
    }
    if (node.userData.homeGarage === true) {
      TAG.fades |= GARAGE_BIT
    }
  }
  return TAG
}

// The thermal camera's paint on the home's palette and scale, ramping from `inner` to `outer` up the geometry's local y. Whatever
// fades the mesh (the home's ghost, a home view's fade) writes the material's opacity; the shader reads it from there.
function createThermalShader(side: Side, inner: number, outer: number): ShaderMaterial {
  const uniforms = {
    uStops: { value: HOME_THERMAL_PALETTE.map(hex => new Color(hex)) },
    uInner: { value: inner },
    uOuter: { value: outer },
    uAxis: { value: UP.clone() },
    uHalfThickness: { value: 1 },
    uCentre: { value: 0 },
    uOpacity: { value: 1 },
  }
  const material = new ShaderMaterial({ uniforms, vertexShader: THERMAL_VERTEX_SHADER, fragmentShader: THERMAL_FRAGMENT_SHADER, side, toneMapped: false })
  Object.defineProperty(uniforms.uOpacity, 'value', { get: () => material.opacity })
  return material
}

// No depth gradient on the home: every face of a surface reads its one temperature, with the shader's form shading.
function createSurface(set: ThermalPaintSet, key: HomePaintKey, side: Side): ShaderMaterial {
  const t = set.values[key]
  return createThermalShader(side, t, t)
}

// The ghost writes each mesh's opacity onto its material, so whatever sets two meshes' opacities apart must set their surfaces
// apart too, or the last mesh walked decides for both: the fades (fading a home view's front wall would otherwise dim every
// wall of the same zone, and ghosting the house would dim the yard) and the system part tag (up close a lit part beside a
// ghosted piece, a picked part beside a dimmed one). A number rather than a built string, so finding a surface allocates
// nothing; three's sides run 0 to 2.
export function thermalSurfaceId(key: HomePaintKey, fades: number, side: Side, tag: SystemPartTagData): number {
  const part = tag.scenePart === undefined ? 0 : PART_INDEX.get(tag.scenePart)! * 2 + (tag.overFront === true ? 2 : 1)
  return ((part * (EVERY_FADE + 1) + fades) * HOME_PAINT_KEYS.length + KEY_INDEX.get(key)!) * 3 + side
}

function surfaceFor(set: ThermalPaintSet, key: HomePaintKey, fades: number, side: Side, tag: SystemPartTagData): ShaderMaterial {
  const id = thermalSurfaceId(key, fades, side, tag)
  const found = set.surfaces.get(id)
  if (found) {
    return found.material
  }
  const material = createSurface(set, key, side)
  set.surfaces.set(id, { key, material })
  set.owned.add(material)
  return material
}

// A see-through texture (a water stain, a thermostat face) keeps its shape: painted as a solid it would read as a square.
function decalFor(set: ThermalPaintSet, key: HomePaintKey, original: Material, map: Texture): MeshBasicMaterial {
  const found = set.decals.get(original)
  if (found) {
    if (found.key !== key) {
      found.key = key
      thermalPaintColor(set.values[key], found.material.color)
    }
    return found.material
  }
  const material = new MeshBasicMaterial({
    map,
    color: thermalPaintColor(set.values[key]),
    transparent: true,
    depthWrite: original.depthWrite,
    side: original.side,
    polygonOffset: original.polygonOffset,
    polygonOffsetFactor: original.polygonOffsetFactor,
    toneMapped: false,
  })
  set.decals.set(original, { key, material })
  set.owned.add(material)
  return material
}

function paintFor(set: ThermalPaintSet, key: HomePaintKey, fades: number, tag: SystemPartTagData, original: Material): Material {
  const map = 'map' in original ? (original.map as Texture | null) : null
  return original.transparent && map ? decalFor(set, key, original, map) : surfaceFor(set, key, fades, original.side, tag)
}

function materialCount(material: Mesh['material']): number {
  return Array.isArray(material) ? material.length : 1
}

function materialAt(material: Mesh['material'], index: number): Material {
  return Array.isArray(material) ? material[index] : material
}

function isOwned(set: ThermalPaintSet, material: Mesh['material']): boolean {
  for (let index = 0; index < materialCount(material); index++) {
    if (!set.owned.has(materialAt(material, index))) {
      return false
    }
  }
  return true
}

function wears(current: Mesh['material'], paint: readonly Material[]): boolean {
  if (materialCount(current) !== paint.length) {
    return false
  }
  for (let index = 0; index < paint.length; index++) {
    if (materialAt(current, index) !== paint[index]) {
      return false
    }
  }
  return true
}

function dropRamp(set: ThermalPaintSet, mesh: Mesh): void {
  const ramp = set.ramps.get(mesh)
  if (ramp === undefined) {
    return
  }
  for (const material of ramp.paint) {
    set.owned.delete(material)
    material.dispose()
  }
  set.ramps.delete(mesh)
}

// A lit part's mesh wears its own ramp, made once for what it wore and remade only if that changes.
function paintRamp(set: ThermalPaintSet, mesh: Mesh, part: SystemPartId, original: Mesh['material'], paint: PartPaint): boolean {
  let ramp = set.ramps.get(mesh)
  if (ramp !== undefined && (ramp.original !== original || ramp.part !== part)) {
    dropRamp(set, mesh)
    ramp = undefined
  }
  if (ramp === undefined) {
    const made = Array.from({ length: materialCount(original) }, (_, index) => {
      const material = createThermalShader(materialAt(original, index).side, paint.inner, paint.outer)
      fitRamp(material, mesh, paint)
      set.owned.add(material)
      return material
    })
    ramp = { part, original, paint: made }
    set.ramps.set(mesh, ramp)
  }
  if (wears(mesh.material, ramp.paint)) {
    return false
  }
  mesh.material = Array.isArray(original) ? ramp.paint : ramp.paint[0]
  return true
}

function wearsPaint(set: ThermalPaintSet, key: HomePaintKey, fades: number, tag: SystemPartTagData, current: Mesh['material'], original: Mesh['material']): boolean {
  if (materialCount(current) !== materialCount(original)) {
    return false
  }
  for (let index = 0; index < materialCount(original); index++) {
    if (paintFor(set, key, fades, tag, materialAt(original, index)) !== materialAt(current, index)) {
      return false
    }
  }
  return true
}

// Paints every tagged mesh under the root that is not already wearing the right paint, and returns whether anything changed.
// Run again whenever the tree or the inputs may have changed, so a part that mounts while the camera is on (a new covering,
// a model finishing its load) is caught.
export function paintThermal(root: Object3D, set: ThermalPaintSet, soakedParts: ReadonlySet<string>): boolean {
  let changed = false
  root.traverse((object) => {
    if (!(object instanceof Mesh)) {
      return
    }
    const tag = tagOf(object, root)
    if (tag.zone === null || tag.zone === OWN_PAINT) {
      return
    }
    // Anything not ours is what the home drew there, possibly a material R3F rebuilt since the last pass.
    if (!isOwned(set, object.material)) {
      set.originals.set(object, object.material)
    }
    const original = set.originals.get(object)
    if (original === undefined) {
      return
    }
    const { partTag } = tag
    const { scenePart } = partTag
    const painted = scenePart === undefined ? undefined : set.parts[scenePart]
    if (scenePart !== undefined && painted !== undefined) {
      changed = paintRamp(set, object, scenePart, original, painted) || changed
      return
    }
    const key: HomePaintKey = tag.part !== null && soakedParts.has(tag.part) ? 'soaked' : tag.zone
    const fades = tag.fades
    if (!wearsPaint(set, key, fades, partTag, object.material, original)) {
      object.material = Array.isArray(original) ? original.map(material => paintFor(set, key, fades, partTag, material)) : paintFor(set, key, fades, partTag, original)
      changed = true
    }
    // A part no longer lit lets its ramp go once it wears its zone's paint again.
    dropRamp(set, object)
  })
  return changed
}

export function tintThermalPaint(set: ThermalPaintSet, values: PaintValues, parts: PartValues): void {
  set.values = values
  set.parts = parts
  tintRamps(set.ramps, parts)
  for (const { key, material } of set.surfaces.values()) {
    material.uniforms.uInner.value = values[key]
    material.uniforms.uOuter.value = values[key]
  }
  for (const { key, material } of set.decals.values()) {
    thermalPaintColor(values[key], material.color)
  }
}

// Puts back exactly what each mesh wore and disposes only what the camera made; the home's own materials stay theirs.
export function restoreThermalPaint(set: ThermalPaintSet): void {
  for (const [mesh, original] of set.originals) {
    if (isOwned(set, mesh.material)) {
      mesh.material = original
    }
  }
  for (const material of set.owned) {
    material.dispose()
  }
  set.originals.clear()
  set.surfaces.clear()
  set.decals.clear()
  set.ramps.clear()
  set.owned.clear()
}
