import type { PartRole, ResolvedPart, WaterFlow } from '@/shared/modules/construction/core/types'
import { RAIN_WORN_SOAK } from '@/shared/modules/construction/core/constants/flow-model'

// Wood, batts and drywall take on water whatever their age, so a new deck under a worn covering still soaks and
// a partial build can never let more rain inside than the home has today. Membranes, flashing, vents, barriers
// and sealant shed or pass it.
const ABSORBENT_ROLES: ReadonlySet<PartRole> = new Set(['structure', 'insulate'])

// Irrigation enters only where something is watered: the demand of the surface, and only while irrigation exists
// to supply it. Rain enters everywhere at full strength and is stopped by the first sound covering. Parts are
// stored inside → out, so both walks start from the end. Drawing only.
export function relativeWaterFlow(parts: ResolvedPart[], source: 'irrigation' | 'rain'): WaterFlow {
  const fromOutside = [...parts].reverse()
  const irrigated = parts.some(part => part.role === 'irrigate' && part.condition !== 'absent')
  const demand = source === 'rain' ? 1 : irrigated ? Math.max(0, ...parts.map(part => part.water?.demand ?? 0)) : 0

  const boundaries = [demand]
  const levels: WaterFlow['parts'] = {}
  const soaked: WaterFlow['soaked'] = {}
  let shed = 0
  let flow = demand
  for (const part of fromOutside) {
    let next = flow
    if (source === 'irrigation') {
      next = part.condition === 'absent' ? flow : flow * (part.water?.passThrough ?? 1)
    }
    else if (!part.edge) {
      const covering = part.role === 'surface' || part.role === 'shed-water'
      if (covering && (part.condition === 'retained' || part.condition === 'installed')) {
        shed += flow
        next = 0
      }
      else if (!covering && part.condition !== 'absent' && ABSORBENT_ROLES.has(part.role)) {
        // Only a worn part rots from what it soaks.
        if (part.condition === 'worn') {
          soaked[part.id] = flow * RAIN_WORN_SOAK
        }
        next = flow * (1 - RAIN_WORN_SOAK)
      }
    }
    levels[part.id] = { outer: flow, inner: next }
    flow = next
    boundaries.push(flow)
  }
  return { boundaries, parts: levels, reflected: 0, shed, soaked, reachesInside: flow }
}
