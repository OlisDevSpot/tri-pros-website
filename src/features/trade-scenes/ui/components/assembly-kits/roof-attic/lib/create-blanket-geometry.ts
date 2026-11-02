import { BoxGeometry } from 'three'

import { KIT_BLANKET_SEGMENTS } from '@/features/trade-scenes/constants/roof-attic-kit'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

interface BlanketSpec {
  width: number
  depth: number
  height: number
  seed: number
  /** 0..1 share of the height the top may rise and fall by. */
  lumpiness: number
  /** The highest the blanket may reach at x: under a roof it thins toward the eaves. */
  ceilingAt: (x: number) => number
}

// Blown fill: one box whose top is lumpy, its base on y = 0.
export function createBlanketGeometry({ width, depth, height, seed, lumpiness, ceilingAt }: BlanketSpec): BoxGeometry {
  const blanket = new BoxGeometry(width, height, depth, KIT_BLANKET_SEGMENTS.x, 1, KIT_BLANKET_SEGMENTS.z)
  const random = seededRandom(seed)
  const phase = [random() * 6, random() * 6, random() * 6]
  const position = blanket.attributes.position
  for (let index = 0; index < position.count; index++) {
    if (position.getY(index) <= 0) {
      continue
    }
    const x = position.getX(index)
    const z = position.getZ(index)
    const lump = Math.sin(x * 8.2 + phase[0]) * Math.sin(z * 6.6 + phase[1]) * 0.6 + Math.sin(x * 19 + z * 14 + phase[2]) * 0.4
    const top = Math.max(0.02, Math.min(height + lump * height * lumpiness, ceilingAt(x)))
    position.setY(index, top - height / 2)
  }
  blanket.computeVertexNormals()
  blanket.translate(0, height / 2, 0)
  return blanket
}
