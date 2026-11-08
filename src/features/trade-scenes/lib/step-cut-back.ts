import type { BoxSpec, HomeSystemId, SystemPart, SystemPartId } from '@/features/trade-scenes/types'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { STEP_DEPTHS, UNSTEPPED_SYSTEM_PARTS } from '@/features/trade-scenes/constants/look-inside'
import { SYSTEM_PARTS } from '@/features/trade-scenes/constants/system-parts'
import { ASSEMBLIES } from '@/shared/modules/construction/core/constants/assemblies'

const ENTRIES = new Map((SYSTEM_PARTS as readonly SystemPart<string>[]).map(entry => [entry.id as SystemPartId, entry]))
const UNSTEPPED: ReadonlySet<SystemPartId> = new Set(UNSTEPPED_SYSTEM_PARTS)

// How far a system part is cut back past the cut: the top one furthest, the bottom one never.
export function stepCutBack(index: number, count: number, peel: number, step: number): number {
  return (count - 1 - index) * step * Math.min(Math.max(peel, 0), 1)
}

// The edge parts run along an edge of the roof rather than down the stepped run, so they stay whole.
function steps(id: SystemPartId): boolean {
  const entry = ENTRIES.get(id)!
  const part = ASSEMBLIES[entry.assembly].parts.find(candidate => candidate.id === entry.part)!
  return part.edge !== true && !UNSTEPPED.has(id)
}

// The shown system parts a stepped cutaway opens, top first: the lists run inside out, so the outermost is the last entry.
export function stepOrder(shown: Iterable<SystemPartId>): SystemPartId[] {
  return [...shown].filter(steps).reverse()
}

// The bottom step never moves, so nothing above it is cut back to show it: it stays whole on both sides of the cut, where
// the story it is lit for (a leak through the ceiling, the gaps round the openings) lies.
export function stepBottom(shown: Iterable<SystemPartId>): SystemPartId | undefined {
  return stepOrder(shown).at(-1)
}

// Where each stepped part starts along the house, from the near slope's cut toward its kept end. Only the roof and the attic
// step open on the house itself.
export function stepStarts(system: HomeSystemId, shown: Iterable<SystemPartId>, peel: number): ReadonlyMap<SystemPartId, number> {
  if (system !== 'roof' && system !== 'attic') {
    return new Map()
  }
  const order = stepOrder(shown)
  return new Map(order.map((id, index) => [id, HOUSE.cutX + stepCutBack(index, order.length, peel, STEP_DEPTHS[system])]))
}

// The middle of the strip a stepped part shows before the part above it starts.
export function stepCentre(system: 'roof' | 'attic', start: number, peel: number): number {
  return start + (STEP_DEPTHS[system] * Math.min(Math.max(peel, 0), 1)) / 2
}

// The boxes cut to `from..to` on one axis, any box left with nothing dropped.
export function clipBoxes(boxes: readonly BoxSpec[], axis: 0 | 1 | 2, from: number, to: number): BoxSpec[] {
  return boxes.flatMap((box) => {
    const low = Math.max(box.position[axis] - box.size[axis] / 2, from)
    const high = Math.min(box.position[axis] + box.size[axis] / 2, to)
    if (high - low < 0.001) {
      return []
    }
    const size = [...box.size] as [number, number, number]
    const position = [...box.position] as [number, number, number]
    size[axis] = high - low
    position[axis] = (low + high) / 2
    return [{ ...box, size, position }]
  })
}
