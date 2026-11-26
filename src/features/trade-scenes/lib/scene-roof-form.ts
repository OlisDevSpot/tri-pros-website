import type { SceneTargets } from '@/features/trade-scenes/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOME_PRIMARY_ASSEMBLY } from '@/features/trade-scenes/constants/scene-controls'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'

// The form the house is drawn with, off the resolved roof. The spots' context and the camera rig read it off the roof type
// instead, from the inputs alone, and give the same form.
export function sceneRoofForm(targets: Pick<SceneTargets, 'assemblies'>): RoofForm {
  return homeRoofForm(targets.assemblies[HOME_PRIMARY_ASSEMBLY]?.form)
}
