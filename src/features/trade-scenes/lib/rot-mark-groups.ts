import type { CutawayRotSpot, SystemPartId } from '@/features/trade-scenes/types'

interface RotMarkGroup {
  partId: SystemPartId
  spots: CutawayRotSpot[]
}

// The rot marks split by the system part each belongs to, so each draws under its own part's tag and lights, fades and hides
// with it. Groups come in the order their part first appears.
export function rotMarkGroups(spots: readonly CutawayRotSpot[]): RotMarkGroup[] {
  const groups = new Map<SystemPartId, CutawayRotSpot[]>()
  for (const spot of spots) {
    const group = groups.get(spot.partId)
    if (group) {
      group.push(spot)
    }
    else {
      groups.set(spot.partId, [spot])
    }
  }
  return [...groups].map(([partId, grouped]) => ({ partId, spots: grouped }))
}
