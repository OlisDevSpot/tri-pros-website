import type { Material, Object3D } from 'three'
import type { HomeFade, HomeFadeLevels, SystemLit, SystemPartTagData } from '@/features/trade-scenes/types'
import type { FadeSheets } from '@/features/trade-scenes/ui/lib/fade-sheets'

import { Mesh } from 'three'

import { HOME_FADES_SHOWN, SHEET_FADES } from '@/features/trade-scenes/constants/home-fades'
import { systemPartOpacity } from '@/features/trade-scenes/lib/system-part-opacity'
import { markFadeSheet } from '@/features/trade-scenes/ui/lib/fade-sheets'

interface GhostBase {
  opacity: number
  transparent: boolean
  depthWrite: boolean
}

interface GhostPass {
  levels: HomeFadeLevels
  sheets: FadeSheets | undefined
  lit: SystemLit | null
  ghost: number
}

const NO_PART: SystemPartTagData = {}

function baseOf(material: Material): GhostBase {
  const recorded = material.userData.ghostBase as GhostBase | undefined
  if (recorded) {
    return recorded
  }
  const base = { opacity: material.opacity, transparent: material.transparent, depthWrite: material.depthWrite }
  material.userData.ghostBase = base
  return base
}

function fadeOf(node: Object3D, levels: HomeFadeLevels): number {
  const fade = node.userData.homeFade as HomeFade | undefined
  return fade === undefined ? 1 : levels[fade]
}

function sheetFadeOf(node: Object3D, levels: HomeFadeLevels): number {
  const fade = node.userData.homeFade as HomeFade | undefined
  return fade !== undefined && SHEET_FADES.has(fade) ? levels[fade] : 1
}

// Returns whether every material of the mesh writes depth when shown in full.
function ghostMesh(mesh: Mesh, opacity: number): boolean {
  // A ghost casting a full shadow would darken the yard around the zoomed kit; the shadow goes with the depth.
  const castsShadow = (mesh.userData.ghostCastShadow ??= mesh.castShadow) as boolean
  mesh.castShadow = castsShadow && opacity > 0.5
  const visible = (mesh.userData.ghostVisible ??= mesh.visible) as boolean
  mesh.visible = visible && opacity > 0
  const ghosted = opacity < 1
  const materials: Material[] = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  let writesDepth = true
  for (const material of materials) {
    const base = baseOf(material)
    writesDepth &&= base.depthWrite
    const transparent = ghosted || base.transparent
    if (material.transparent !== transparent) {
      material.transparent = transparent
      material.needsUpdate = true
    }
    material.opacity = base.opacity * opacity
    // Depth holds through the first half of the fade, so rooms do not draw through each other mid-glide.
    material.depthWrite = base.depthWrite && opacity > 0.5
  }
  return writesDepth
}

function partOf(node: Object3D, inherited: SystemPartTagData): SystemPartTagData {
  return (node.userData as SystemPartTagData).scenePart === undefined ? inherited : node.userData as SystemPartTagData
}

// The products ride down the walk rather than each mesh climbing its own ancestors: this runs on every ease frame. `opacity`
// carries the ghost with the fades, as it always has; `fade` the fades alone, which a lit system part takes without the ghost.
function walk(object: Object3D, pass: GhostPass, opacity: number, fade: number, sheet: number, part: SystemPartTagData, completeOnly: boolean): void {
  const level = fadeOf(object, pass.levels)
  const own = opacity * level
  const ownFade = fade * level
  const ownSheet = sheet * sheetFadeOf(object, pass.levels)
  const ownPart = partOf(object, part)
  const ownComplete = completeOnly || object.userData.homeFade === 'complete'
  if (object instanceof Mesh) {
    const shown = pass.lit === null ? own : systemPartOpacity(ownPart, ownComplete, pass.lit, pass.ghost) * ownFade
    const writesDepth = ghostMesh(object, shown)
    if (pass.sheets && ownSheet > 0 && ownSheet < 1) {
      markFadeSheet(pass.sheets, object, writesDepth)
    }
  }
  const children = object.children
  for (let index = 0, count = children.length; index < count; index++) {
    walk(children[index], pass, own, ownFade, ownSheet, ownPart, ownComplete)
  }
}

// Fades everything under the root at once, so the zoomed assembly reads through the house, and each fade-tagged group's
// parts by its level on top; glass keeps its own see-through share. With `lit`, the system's own parts stay solid and only
// the rest takes the ghost. Tags are read up to the scene, so a subtree that mounts late still takes the fades and the
// system part above it. three compiles `transparent` into the program, so flipping it needs a recompile, done only on the
// flip. With `sheets`, it marks the parts a home view is fading mid-way for `settleFadeSheets`.
export function applyGhost(root: Object3D, opacity: number, levels: HomeFadeLevels = HOME_FADES_SHOWN, sheets?: FadeSheets, lit: SystemLit | null = null): void {
  let start = opacity
  let fade = 1
  let sheet = 1
  let part = NO_PART
  let completeOnly = false
  for (let node = root.parent; node !== null; node = node.parent) {
    const level = fadeOf(node, levels)
    start *= level
    fade *= level
    sheet *= sheetFadeOf(node, levels)
    // Climbing, the nearest tag is the first one met.
    part = part === NO_PART ? partOf(node, NO_PART) : part
    completeOnly ||= node.userData.homeFade === 'complete'
  }
  walk(root, { levels, sheets, lit, ghost: opacity }, start, fade, sheet, part, completeOnly)
}
