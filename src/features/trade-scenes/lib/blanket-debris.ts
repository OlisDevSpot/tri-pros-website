import type { BoxSpec } from '@/features/trade-scenes/types'

import { INSULATION_DEBRIS } from '@/features/trade-scenes/constants/wear-looks'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

function topOf(box: BoxSpec): number {
  return box.position[1] + box.size[1] / 2
}

function covers(box: BoxSpec, x: number, z: number): boolean {
  return Math.abs(box.position[0] - x) <= box.size[0] / 2 && Math.abs(box.position[2] - z) <= box.size[2] / 2
}

// Specks of dirt on the blanket, more of them the more worn it is. Every box draws the same sequence whatever the share, and
// the share only decides how many of it are kept, so less wear shows a subset of the specks, never a reshuffle. A speck whose
// spot a higher box covers is dropped: batts carry a sheet over the bays, and dirt inside it would be hidden.
export function blanketDebris(boxes: readonly BoxSpec[], share: number, seed: number): BoxSpec[] {
  const { perSquareMetre, size, thickness, lift } = INSULATION_DEBRIS
  return boxes.flatMap((box, index) => {
    const random = seededRandom(seed * 1000 + index + 1)
    const count = Math.round(box.size[0] * box.size[2] * perSquareMetre * share)
    const top = topOf(box)
    const specks: BoxSpec[] = []
    for (let n = 0; n < count; n++) {
      const side = size.min + random() * (size.max - size.min)
      const x = box.position[0] + (random() - 0.5) * Math.max(0, box.size[0] - side)
      const z = box.position[2] + (random() - 0.5) * Math.max(0, box.size[2] - side)
      if (boxes.some(other => other !== box && topOf(other) > top && covers(other, x, z))) {
        continue
      }
      specks.push({ size: [side, thickness, side], position: [x, top + lift, z] })
    }
    return specks
  })
}
