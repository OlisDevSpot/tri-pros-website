import type { HomeSystemId, StageShape } from '@/features/trade-scenes/types'
import type { CameraFraming } from '@/shared/components/scene/types'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

import { HOME_ANCHORS, READING_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { EQUIPMENT, HOME_FRAMINGS } from '@/features/trade-scenes/constants/home-geometry'
import { liftedFraming } from '@/features/trade-scenes/lib/lifted-framing'

// Every system is looked at from the home's own direction, nearer by the zoom, so a glide between two systems slides
// along the house instead of swinging around it. The zoom brings a system about twice as close as the whole home, as the
// rep sees it: on a wide stage the card beside the system narrows the view and the lens widens to fit it, so the camera
// comes nearer there to make up for it. Working numbers, tuned by eye.
const SYSTEM_VIEW_ZOOM = { landscape: 3.3, narrow: 3.3, portrait: 2.4 } as const satisfies Record<StageShape, number>
const SYSTEM_VIEW_FOV = 34
const [homeX, homeY, homeZ] = HOME_FRAMINGS.wide.position
const [aimX, aimY, aimZ] = HOME_FRAMINGS.wide.target

function viewOf(target: readonly [number, number, number], shape: StageShape, lift: number): CameraFraming {
  const [x, y, z] = target
  const zoom = SYSTEM_VIEW_ZOOM[shape]
  return liftedFraming({ position: [x + (homeX - aimX) / zoom, y + (homeY - aimY) / zoom, z + (homeZ - aimZ) / zoom], target: [x, y, z], fov: SYSTEM_VIEW_FOV }, lift)
}

// Heating & cooling aims at the condenser's pad whatever the system is; a package or wall unit has no pad there yet. The pad
// stands on the ground, so it takes no lift from the foundation.
export const SYSTEM_CAMERA_VIEWS: Record<HomeSystemId, (form: RoofForm, shape: StageShape, lift: number) => CameraFraming> = {
  'roof': (form, shape, lift) => viewOf(HOME_ANCHORS[form].roof.position, shape, lift),
  'attic': (form, shape, lift) => viewOf(HOME_ANCHORS[form].attic.position, shape, lift),
  'windows': (form, shape, lift) => viewOf(READING_ANCHORS[form].window, shape, lift),
  'walls': (form, shape, lift) => viewOf(READING_ANCHORS[form]['exterior-wall'], shape, lift),
  'heating-cooling': (_form, shape) => viewOf(EQUIPMENT.condenser.position, shape, 0),
  'foundation': (form, shape, lift) => viewOf(HOME_ANCHORS[form]['under-floor'].position, shape, lift),
}
