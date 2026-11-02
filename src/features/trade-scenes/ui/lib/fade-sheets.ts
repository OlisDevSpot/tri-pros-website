import type { Object3D, Side } from 'three'

import { Group, InstancedMesh, Mesh, MeshBasicMaterial, SkinnedMesh } from 'three'

import { FADE_SHEET_ORDER } from '@/features/trade-scenes/constants/home-fades'

export interface FadeSheets {
  // Holds the depth twins outside the house, so the ghost, the thermal paint and the scans never reach them.
  layer: Group
  // What this frame's walks found mid-fade, and whether each writes depth.
  marked: Map<Mesh, boolean>
  // Every mesh drawn as a sheet now, with its depth twin when it writes depth.
  drawn: Map<Mesh, Mesh | null>
}

const depthMaterials = new Map<Side, MeshBasicMaterial>()

// Pushed back a hair, so the colour pass's own nearest surface always passes even where a painted shader projects it with
// different rounding; the layers behind it sit far deeper than the offset.
function depthMaterialFor(side: Side): MeshBasicMaterial {
  let material = depthMaterials.get(side)
  if (!material) {
    material = new MeshBasicMaterial({ side, colorWrite: false, transparent: true, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, forceSinglePass: true })
    depthMaterials.set(side, material)
  }
  return material
}

function shownInScene(object: Object3D): boolean {
  let node: Object3D | null = object
  let top: Object3D = object
  while (node) {
    if (!node.visible) {
      return false
    }
    top = node
    node = node.parent
  }
  return (top as { isScene?: boolean }).isScene === true
}

function addTwin(sheets: FadeSheets, mesh: Mesh): Mesh {
  const twin = mesh instanceof InstancedMesh ? new InstancedMesh(mesh.geometry, undefined, 0) : new Mesh(mesh.geometry)
  twin.matrixAutoUpdate = false
  twin.matrixWorldAutoUpdate = false
  twin.frustumCulled = false
  twin.renderOrder = FADE_SHEET_ORDER.depth
  twin.raycast = () => {}
  // Read at draw time, after the scene's matrices are updated, so the twin sits exactly where the rising part is this frame.
  twin.onBeforeRender = () => {
    twin.matrixWorld.copy(mesh.matrixWorld)
  }
  sheets.layer.add(twin)
  return twin
}

function syncTwin(twin: Mesh, mesh: Mesh): void {
  twin.geometry = mesh.geometry
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  twin.material = depthMaterialFor(material.side)
  if (twin instanceof InstancedMesh && mesh instanceof InstancedMesh) {
    twin.instanceMatrix = mesh.instanceMatrix
    twin.count = mesh.count
  }
  twin.visible = mesh.visible && shownInScene(mesh)
}

function dropTwin(sheets: FadeSheets, mesh: Mesh): void {
  const twin = sheets.drawn.get(mesh)
  if (twin) {
    sheets.layer.remove(twin)
  }
}

export function createFadeSheets(): FadeSheets {
  return { layer: new Group(), marked: new Map(), drawn: new Map() }
}

// A skinned figure's twin would hold its bind pose, not the pose it is drawn in; it fades on its own.
export function markFadeSheet(sheets: FadeSheets, mesh: Mesh, writesDepth: boolean): void {
  if (!(mesh instanceof SkinnedMesh)) {
    sheets.marked.set(mesh, writesDepth)
  }
}

// Draws what the walks marked as sheets (every depth twin, then every sheet's colour, after the rest of the scene) and
// puts back what has left the fade. Run once a frame after every walk.
export function settleFadeSheets(sheets: FadeSheets): void {
  for (const [mesh, writesDepth] of sheets.marked) {
    let twin = sheets.drawn.get(mesh)
    if (twin === undefined) {
      mesh.userData.sheetBaseOrder = mesh.renderOrder
      // A part's own order rides on top, so a stain still draws after the wall it lies on while both fade.
      mesh.renderOrder = FADE_SHEET_ORDER.color + mesh.renderOrder
      twin = null
    }
    // The thermal camera can turn see-through glass solid mid-fade, and back.
    if (writesDepth && twin === null) {
      twin = addTwin(sheets, mesh)
    }
    else if (!writesDepth && twin !== null) {
      dropTwin(sheets, mesh)
      twin = null
    }
    sheets.drawn.set(mesh, twin)
    if (twin) {
      syncTwin(twin, mesh)
    }
  }
  for (const mesh of sheets.drawn.keys()) {
    if (!sheets.marked.has(mesh)) {
      mesh.renderOrder = mesh.userData.sheetBaseOrder as number
      delete mesh.userData.sheetBaseOrder
      dropTwin(sheets, mesh)
      sheets.drawn.delete(mesh)
    }
  }
  sheets.marked.clear()
}
