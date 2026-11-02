import type { NeighbourHouse } from '@/features/trade-scenes/types'

import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from 'three'

import { NEIGHBOUR_LOOK as LOOK } from '@/features/trade-scenes/constants/neighbourhood'
import { mergeTinted, placeGeometry, tintVertices } from '@/features/trade-scenes/ui/lib/vertex-tinted-geometry'

function hipRoof(width: number, depth: number, rise: number, hex: string, seed: number): BufferGeometry {
  const long = Math.max(width, depth)
  const half = Math.min(width, depth) / 2
  const ridge = long / 2 - half
  const [a, b, c, d] = [[-long / 2, 0, -half], [long / 2, 0, -half], [long / 2, 0, half], [-long / 2, 0, half]] as const
  const r1 = [-ridge, rise, 0] as const
  const r2 = [ridge, rise, 0] as const
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute([d, c, r2, d, r2, r1, b, a, r1, b, r1, r2, a, d, r1, c, b, r2].flat(), 3))
  if (width < depth) {
    geometry.rotateY(Math.PI / 2)
  }
  return tintVertices(geometry, hex, 0.12, seed)
}

// Every neighbour in three draw calls, one per material: the walls (and chimneys), the roofs, and the glass with the
// garage doors.
export function neighbourGeometry(houses: readonly NeighbourHouse[]): { walls: BufferGeometry, roofs: BufferGeometry, windows: BufferGeometry } {
  const walls: BufferGeometry[] = []
  const roofs: BufferGeometry[] = []
  const windows: BufferGeometry[] = []
  const { wallHeight: height, windowY: y } = LOOK
  houses.forEach(({ position: [x, z], size: [w, d], facing, stucco, roof, chimney }, i) => {
    walls.push(tintVertices(placeGeometry(new BoxGeometry(w, height, d), [x, height / 2, z]), stucco, 0.04, 90 + i))
    roofs.push(placeGeometry(hipRoof(w + 2 * LOOK.eave, d + 2 * LOOK.eave, LOOK.roofRise, roof, 100 + i), [x, height, z]))
    if (chimney) {
      walls.push(tintVertices(placeGeometry(new BoxGeometry(0.7, 2.4, 0.7), [x - w / 3, height + 0.8, z - d / 5]), stucco, 0.05, 120 + i))
    }
    for (const across of [-0.32, 0, 0.32]) {
      windows.push(tintVertices(placeGeometry(new BoxGeometry(1.2, 1.1, 0.08), [x + across * w, y, z + facing * (d / 2 + 0.02)]), LOOK.window, 0.1, 130 + i))
    }
    for (const along of [-0.25, 0.25]) {
      windows.push(tintVertices(placeGeometry(new BoxGeometry(0.08, 1.1, 1.1), [x - w / 2 - 0.02, y, z + along * d]), LOOK.window, 0.1, 140 + i))
      windows.push(tintVertices(placeGeometry(new BoxGeometry(0.08, 1.1, 1.1), [x + w / 2 + 0.02, y, z + along * d]), LOOK.window, 0.1, 150 + i))
    }
    // Merged into the window mesh, so a neighbour's door costs no draw call of its own.
    windows.push(tintVertices(placeGeometry(new BoxGeometry(4.9, 2.13, 0.08), [x + facing * w * 0.22, 1.07, z + facing * (d / 2 + 0.03)]), LOOK.garageDoor, 0.05, 160 + i))
  })
  return { walls: mergeTinted(walls), roofs: mergeTinted(roofs), windows: mergeTinted(windows) }
}
