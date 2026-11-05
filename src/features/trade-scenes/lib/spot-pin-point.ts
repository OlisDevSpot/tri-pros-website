import type { HomeSystemId, Vec3 } from '@/features/trade-scenes/types'
import type { HVACType } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOME_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { PACKAGE_UNIT } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { systemPartFocus } from '@/features/trade-scenes/lib/system-part-focus'

// Over the unit's top, clear of its fan: the condenser's from the point its parts' pins take, the package unit's from its
// base on the curb. Working numbers, set by eye.
const OVER_THE_CONDENSER = 0.75
const OVER_THE_PACKAGE_UNIT = PACKAGE_UNIT.size[1] + 0.35

// Where a system's pin stands when its spot is tapped, before the foundation lifts it: where its camera view looks, so the
// pin and the pick that follows it land on the same thing. Only the systems a spot opens have one.
export function spotPinPoint(system: HomeSystemId, form: RoofForm, hvacType: HVACType | null): Vec3 {
  switch (system) {
    case 'roof':
    case 'attic':
      return HOME_ANCHORS[form][system].position
    case 'windows':
      return systemPartFocus(system, form, 'glazing')!
    case 'heating-cooling': {
      if (hvacType === 'package-unit') {
        const [x, y, z] = systemPartFocus(system, form, 'package-unit')!
        return [x, y + OVER_THE_PACKAGE_UNIT, z]
      }
      const [x, y, z] = systemPartFocus(system, form, 'condenser')!
      return [x, y + OVER_THE_CONDENSER, z]
    }
    case 'walls':
    case 'foundation':
      throw new Error(`no spot opens ${system}`)
  }
}
