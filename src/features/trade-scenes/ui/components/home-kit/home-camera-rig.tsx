'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { VisibleArea } from '@/shared/components/scene/types'

import { HOME_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { AC_SCALE } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { HOME_ORBIT, HOME_PAN } from '@/features/trade-scenes/constants/home-geometry'
import { lookInsideView, SYSTEM_CAMERA_VIEWS } from '@/features/trade-scenes/constants/system-camera-views'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { framingTowardPart, partOffset } from '@/features/trade-scenes/lib/framing-toward-part'
import { homeFramingFor } from '@/features/trade-scenes/lib/home-framing-for'
import { homeLift } from '@/features/trade-scenes/lib/home-lift'
import { homePanBox } from '@/features/trade-scenes/lib/home-pan-box'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { liftedFraming } from '@/features/trade-scenes/lib/lifted-framing'
import { systemPartFocus } from '@/features/trade-scenes/lib/system-part-focus'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { CameraRig } from '@/shared/components/scene/ui/camera-rig'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

// The framing is picked from the stage's shape, not the canvas's: the canvas also spans the strip under the dashboard sidebar,
// and the framing a rep sees must not change with it. The stage is measured before the canvas mounts, so the scene opens framed.
// The canvas changes shape only with the window: a fold, of the card or the sidebar, shifts the view and keeps the user's orbit
// and pan, except the fold that ends the crawl view, which changes the framing.
// It reads the emphasis itself, so a tap on a part moves the camera without redrawing the house.
export function HomeCameraRig() {
  // Shares of the canvas's width as the stage's own measure gives it, the one the card is placed by: a canvas still catching
  // up with a resize then gets the shares it is about to have, and nothing re-eases when it lands. The strip under the
  // sidebar is one more cover on the left.
  const { area, stage, shape, canvasOverhang } = useSceneVisibleArea()
  const canvasWidth = Math.max(stage.width + canvasOverhang, 1)
  const visibleArea: VisibleArea = {
    left: (canvasOverhang + area.left) / canvasWidth,
    right: area.right / canvasWidth,
    bottom: area.bottom / Math.max(stage.height, 1),
    top: area.top / Math.max(stage.height, 1),
  }
  const aspect = stage.width / Math.max(stage.height, 1)
  const emphasizedPart = useSceneInputs((state: TradeSceneInputs) => state.emphasizedPart)
  const lookInside = useSceneInputs((state: TradeSceneInputs) => state.lookInside)
  const foundationType = useSceneInputs((state: TradeSceneInputs) => state.property.foundationType)
  const cameraFocus = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus)
  const partlyOpen = useSceneInputs((state: TradeSceneInputs) => state.homeView === 'partly-open')
  // The form the house is drawn with, read off the roof type as the resolve reads it, so a system's view lands where its pin
  // sits and a resolve that keeps the form never re-renders the rig.
  const form = useSceneInputs((state: TradeSceneInputs) => homeRoofForm(roofFormOf(state.property.roofType)))
  const lift = homeLift(foundationType)
  // Heating & cooling finds a package unit on the roof, where it stands by its size.
  const hvacType = useSceneInputs((state: TradeSceneInputs) => state.property.hvacType)
  const acTons = useSceneInputs((state: TradeSceneInputs) => state.homeMaterials.acTons)
  const hvac = { type: hvacType, scale: acTons === null ? 1 : AC_SCALE[acTons] }
  // Only where the open front shows the crawl does the foundation look into it: a slab home or a closed house has none.
  const looksUnderFloor = cameraFocus === 'foundation' && partlyOpen && foundationType === 'raised'
  // Up close comes straight in along the system's own view, and leans toward a part the rep emphasises.
  const up = lookInside && cameraFocus !== null
  const focusFraming = cameraFocus === null
    ? null
    : up
      ? lookInsideView(cameraFocus, form, shape, lift, hvac)
      : looksUnderFloor
        ? liftedFraming(HOME_ANCHORS.pitched['under-floor'].framing, lift)
        : SYSTEM_CAMERA_VIEWS[cameraFocus](form, shape, lift, hvac)
  const point = up && emphasizedPart !== null ? systemPartFocus(cameraFocus, form, emphasizedPart) : null
  const framing = focusFraming && point
    ? framingTowardPart(focusFraming, partOffset(focusFraming, point, lift))
    : focusFraming
  // Up close a tap already leans toward a part, so a double-tap looks at a spot only outside it, the crawl view included.
  const pan = { box: homePanBox(lift), doubleTapDistance: up ? null : HOME_PAN.doubleTapDistance }
  return <CameraRig framing={framing ?? homeFramingFor(aspect)} orbit={HOME_ORBIT} visibleArea={visibleArea} pan={pan} />
}
