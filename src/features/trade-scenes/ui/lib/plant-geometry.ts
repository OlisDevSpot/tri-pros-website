import type { BufferGeometry, Matrix4 } from 'three'
import type { PlantPlacement } from '@/features/trade-scenes/constants/lot-plants'
import type { PlantSpecies } from '@/features/trade-scenes/types'

import { ConeGeometry, CylinderGeometry, Euler, IcosahedronGeometry, PlaneGeometry, Quaternion, Vector3 } from 'three'

import { PLANT_PALETTE as C } from '@/features/trade-scenes/constants/lot-plants'
import { lotHeightAt } from '@/features/trade-scenes/lib/lot-height-at'
import { mergeTinted, placeGeometry, tintVertices } from '@/features/trade-scenes/ui/lib/vertex-tinted-geometry'

// A frond: a strip built flat along x, then drooped along its length and tapered to a point. Drawn double-sided, so it
// needs no cut-out leaf texture, which the thermal paint would draw as a solid card.
function frond(length: number, width: number, droop: number, hex: string, seed: number): BufferGeometry {
  const plane = new PlaneGeometry(length, width, 6, 1)
  plane.rotateX(-Math.PI / 2)
  plane.translate(length / 2, 0, 0)
  const position = plane.getAttribute('position')
  for (let i = 0; i < position.count; i++) {
    const t = position.getX(i) / length
    position.setY(i, -droop * t * t)
    position.setZ(i, position.getZ(i) * (1 - t * 0.85))
  }
  return tintVertices(plane, hex, 0.18, seed)
}

// Fronds round a trunk's top at height `y`, each lifted by `lift` and leaning a little either side of it, so the crown is
// never a perfect ring.
function crown(count: number, length: number, width: number, droop: number, lift: number, hex: string, y: number, seed: number): BufferGeometry[] {
  return Array.from({ length: count }, (_, i) => {
    const turn = (i / count) * Math.PI * 2 + (i % 2) * 0.2
    const tilt = lift + ((i * 37) % 10) / 10 * 0.3 - 0.15
    return placeGeometry(frond(length, width, droop, hex, seed + i), [0, y, 0], [0, turn, tilt])
  })
}

// The street's tall palms and trees are built a metre high and scaled up where they stand.
function fanPalm(): BufferGeometry {
  return mergeTinted([
    tintVertices(placeGeometry(new CylinderGeometry(0.018, 0.026, 1, 6), [0, 0.5, 0]), C.fanTrunk, 0.1),
    // The skirt of dead fronds a Mexican fan palm keeps under its crown.
    tintVertices(placeGeometry(new CylinderGeometry(0.05, 0.035, 0.09, 7), [0, 0.96, 0]), C.fanSkirt, 0.25, 3),
    ...crown(16, 0.11, 0.06, 0.03, 0.25, C.fanFrond, 1, 11),
  ])
}

function queenPalm(): BufferGeometry {
  return mergeTinted([
    tintVertices(placeGeometry(new CylinderGeometry(0.022, 0.03, 1, 7), [0, 0.5, 0]), C.queenTrunk, 0.1),
    ...crown(11, 0.32, 0.07, 0.2, 0.55, C.queenFrond, 1, 21),
  ])
}

function eucalyptus(): BufferGeometry {
  // A tall, open, grey-green canopy over pale trunks; the blobs leave gaps so the sky shows through.
  const blobs: readonly (readonly [number, number, number, number])[] = [[0, 0.78, 0, 0.2], [0.17, 0.66, 0.05, 0.16], [-0.16, 0.7, -0.06, 0.17], [0.05, 0.92, 0.08, 0.14], [-0.08, 0.55, 0.12, 0.13], [0.2, 0.84, -0.1, 0.12]]
  return mergeTinted([
    tintVertices(placeGeometry(new CylinderGeometry(0.02, 0.035, 0.75, 6), [0, 0.375, 0], [0.05, 0, 0.08]), C.eucalyptusBark, 0.1),
    tintVertices(placeGeometry(new CylinderGeometry(0.015, 0.025, 0.5, 6), [0.06, 0.45, 0], [0, 0, -0.35]), C.eucalyptusBranch, 0.1),
    ...blobs.map(([x, y, z, r], i) => tintVertices(placeGeometry(new IcosahedronGeometry(r, 1), [x, y, z], [0, i, 0], [1, 0.8, 1]), C.eucalyptusLeaf, 0.25, 71 + i)),
  ])
}

function cypress(): BufferGeometry {
  return mergeTinted([tintVertices(placeGeometry(new ConeGeometry(0.12, 1, 8), [0, 0.5, 0]), C.cypress, 0.2, 81)])
}

// The bed plants are built at their own size.
function pygmyPalm(): BufferGeometry {
  return mergeTinted([
    tintVertices(placeGeometry(new CylinderGeometry(0.06, 0.08, 0.5, 7), [0, 0.25, 0]), C.pygmyTrunk, 0.15),
    ...crown(14, 0.55, 0.12, 0.28, 0.5, C.pygmyFrond, 0.5, 31),
  ])
}

function sago(): BufferGeometry {
  return mergeTinted(crown(14, 0.55, 0.14, 0.25, 0.75, C.sagoFrond, 0.06, 41))
}

function agave(): BufferGeometry {
  // Three rings of thick blades, the outer ring longest and leaning furthest out.
  const rings = [{ count: 8, tilt: 1.05, length: 0.75 }, { count: 6, tilt: 0.7, length: 0.65 }, { count: 4, tilt: 0.35, length: 0.5 }]
  let seed = 51
  return mergeTinted(rings.flatMap(({ count, tilt, length }, ring) => Array.from({ length: count }, (_, i) => {
    const leaf = new ConeGeometry(0.07, length, 4)
    leaf.translate(0, length / 2, 0)
    leaf.scale(1, 1, 0.35)
    return tintVertices(placeGeometry(leaf, [0, 0.04, 0], [0, (i / count) * Math.PI * 2 + ring * 0.4, tilt]), C.agaveLeaf, 0.2, seed++)
  })))
}

function shrub(): BufferGeometry {
  return mergeTinted([
    tintVertices(placeGeometry(new IcosahedronGeometry(0.5, 1), [0, 0.35, 0], [0, 0, 0], [1, 0.75, 1]), C.shrubLeaf, 0.3, 61),
    tintVertices(placeGeometry(new IcosahedronGeometry(0.35, 1), [0.35, 0.3, 0.1], [0, 0, 0], [1, 0.8, 1]), C.shrubLeafLight, 0.3, 62),
  ])
}

const BUILDERS: Record<PlantSpecies, () => BufferGeometry> = {
  'fan-palm': fanPalm,
  'queen-palm': queenPalm,
  'pygmy-palm': pygmyPalm,
  'sago': sago,
  'agave': agave,
  'shrub': shrub,
  'eucalyptus': eucalyptus,
  'cypress': cypress,
}

export function plantGeometry(species: PlantSpecies): BufferGeometry {
  return BUILDERS[species]()
}

const UPRIGHT = new Euler()
const TURN = new Quaternion()
const AT = new Vector3()
const SIZE = new Vector3()

// Standing on the grade where it is planted, turned about its trunk and scaled evenly: the instance matrix the plants draw
// with, and the one the lot check measures them by.
export function plantMatrix([x, z, scale, turn]: PlantPlacement, target: Matrix4): Matrix4 {
  return target.compose(AT.set(x, lotHeightAt(z), z), TURN.setFromEuler(UPRIGHT.set(0, turn, 0)), SIZE.setScalar(scale))
}
