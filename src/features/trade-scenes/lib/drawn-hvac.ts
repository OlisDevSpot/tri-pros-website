import type { PartState } from '@/features/trade-scenes/lib/part-state'
import type { DrawnHvac, HvacDuties } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { HomeMaterialFacts, PropertyProfile, ResolvedPart } from '@/shared/modules/construction/core/types'

import { hasDucts } from '@/features/trade-scenes/lib/has-ducts'
import { indoorLocation } from '@/features/trade-scenes/lib/indoor-location'
import { miniSplitHeadCount } from '@/features/trade-scenes/lib/mini-split-head-count'
import { partState } from '@/features/trade-scenes/lib/part-state'
import { isCentralSystem } from '@/shared/modules/construction/core/lib/hvac-system'

// A part counts when it holds a material: absent, or taken out by the build, it is not drawn.
function countedPart(parts: readonly ResolvedPart[], id: string): PartState | null {
  const part = parts.find(entry => entry.id === id)
  return part !== undefined && part.material !== null ? partState(parts, id) : null
}

function union(...duties: HvacDuties[]): HvacDuties {
  return { cools: duties.some(duty => duty.cools), heats: duties.some(duty => duty.heats) }
}

const NONE: HvacDuties = { cools: false, heats: false }
const BOTH: HvacDuties = { cools: true, heats: true }

// What is drawn follows the side on show's resolved parts, so a build draws what it installs beside what it leaves. A wall or
// window unit is no part of the assembly, so it is drawn from the home and stands idle once a central system takes over.
export function drawnHvac(parts: readonly ResolvedPart[], property: PropertyProfile, materials: HomeMaterialFacts, view: 'existing' | 'proposed', form: RoofForm, picks: readonly string[]): DrawnHvac {
  const components = property.hvacComponents
  const blower = countedPart(parts, 'blower')
  const furnace = countedPart(parts, 'furnace')
  const coil = countedPart(parts, 'coil')
  const condenser = countedPart(parts, 'condenser')
  const heatPump = condenser?.material === 'heat-pump'
  const packageUnit = countedPart(parts, 'package-unit')
  const heads = countedPart(parts, 'mini-split-heads')
  const takenOver = blower !== null

  const central = isCentralSystem(property.hvacType)
  const indoor = blower === null ? null : { location: indoorLocation(materials, form, view, picks, central), blower, furnace, coil }
  const standing = indoorLocation(materials, form, 'existing', picks, central)
  const vacated = central && indoor !== null && indoor.location !== standing ? standing : null

  const wallUnit = property.hvacType === 'wall-mounted' ? { kind: components === 'furnace' ? 'wall-furnace' as const : 'wall-unit' as const, idle: takenOver } : null
  const windowUnit = property.hvacType === 'portable' ? { idle: takenOver } : null

  // Heads the build installs run whatever else stands; the home's own fall idle under a new central system.
  const headsInstalled = parts.some(part => part.id === 'mini-split-heads' && part.condition === 'installed')
  const miniSplit = heads !== null
    ? { heads: Number(miniSplitHeadCount(materials, headsInstalled ? 'proposed' : 'existing')), idle: takenOver && !headsInstalled, wear: heads.wear }
    : null

  const wallOrWindowDuties = wallUnit !== null
    ? { cools: wallUnit.kind === 'wall-unit', heats: components !== 'ac' }
    : windowUnit !== null ? { cools: components !== 'furnace', heats: components !== 'ac' } : NONE
  const wallOrWindowIdle = (wallUnit ?? windowUnit)?.idle ?? true

  const duties = union(
    // A heat pump heats through the coil, run the other way.
    blower === null ? NONE : { cools: coil !== null && condenser !== null, heats: furnace !== null || (heatPump && coil !== null) },
    packageUnit === null ? NONE : BOTH,
    wallOrWindowIdle ? NONE : wallOrWindowDuties,
    miniSplit === null || miniSplit.idle ? NONE : BOTH,
  )

  return {
    indoor,
    vacated,
    outdoor: condenser === null ? null : { ...condenser, kind: heatPump ? 'heat-pump' : 'condenser' },
    lineSet: countedPart(parts, 'refrigerant-lines') !== null,
    packageUnit,
    ducts: hasDucts(parts) ? partState(parts, 'duct-runs') : null,
    registers: countedPart(parts, 'registers') !== null,
    wallUnit,
    windowUnit,
    miniSplit,
    wallOrWindowDuties,
    duties,
  }
}
