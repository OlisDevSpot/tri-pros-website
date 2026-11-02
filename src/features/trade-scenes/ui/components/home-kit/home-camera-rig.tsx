'use client'

import type { TradeSceneInputs } from '@/features/trade-scenes/types'
import type { CameraFraming, VisibleArea } from '@/shared/components/scene/types'

import { HOME_ANCHORS } from '@/features/trade-scenes/constants/home-anchors'
import { HOME_ORBIT, HOME_PAN } from '@/features/trade-scenes/constants/home-geometry'
import { SYSTEM_CAMERA_VIEWS } from '@/features/trade-scenes/constants/system-camera-views'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { framingTowardPart } from '@/features/trade-scenes/lib/framing-toward-part'
import { homeFramingFor } from '@/features/trade-scenes/lib/home-framing-for'
import { homeLift } from '@/features/trade-scenes/lib/home-lift'
import { homePanBox } from '@/features/trade-scenes/lib/home-pan-box'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { liftedFraming } from '@/features/trade-scenes/lib/lifted-framing'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { CameraRig } from '@/shared/components/scene/ui/camera-rig'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

interface HomeCameraRigProps {
  // The anchor's framing while zoomed; null shows the home.
  zoomFraming: CameraFraming | null
  // Where the zoomed kit's emphasised part sits at a peel, as an offset from the anchor; null keeps the anchor's framing.
  partFocus: ((partId: string, peel: number) => readonly [number, number, number] | null) | null
}

// The framing is picked from the stage's shape, not the canvas's: the canvas also spans the strip under the dashboard sidebar,
// and the framing a rep sees must not change with it. The stage is measured before the canvas mounts, so the scene opens framed.
// The canvas changes shape only with the window: a fold, of the card or the sidebar, shifts the view and keeps the user's orbit
// and pan, except the fold that ends the crawl view, which changes the framing.
// It reads the emphasis itself, so a tap on a part moves the camera without redrawing the house.
export function HomeCameraRig({ zoomFraming, partFocus }: HomeCameraRigProps) {
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
  // The camera follows an emphasised part as it peels; with nothing emphasised a peel drag never re-renders the rig.
  const peel = useSceneInputs((state: TradeSceneInputs) => (state.emphasizedPart === null ? 0 : state.peel))
  const focus = zoomFraming && partFocus && emphasizedPart !== null ? partFocus(emphasizedPart, peel) : null
  const framing = zoomFraming && focus ? framingTowardPart(zoomFraming, focus) : zoomFraming
  const foundationType = useSceneInputs((state: TradeSceneInputs) => state.property.foundationType)
  const cameraFocus = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus)
  const partlyOpen = useSceneInputs((state: TradeSceneInputs) => state.homeView === 'partly-open')
  // The form the house is drawn with, read off the roof type as the resolve reads it, so a system's view lands where its pin
  // sits and a resolve that keeps the form never re-renders the rig.
  const form = useSceneInputs((state: TradeSceneInputs) => homeRoofForm(roofFormOf(state.property.roofType)))
  const lift = homeLift(foundationType)
  // Only where the open front shows the crawl does the foundation look into it: a slab home or a closed house has none.
  const looksUnderFloor = cameraFocus === 'foundation' && partlyOpen && foundationType === 'raised'
  const focusFraming = cameraFocus === null
    ? null
    : looksUnderFloor
      ? liftedFraming(HOME_ANCHORS.pitched['under-floor'].framing, lift)
      : SYSTEM_CAMERA_VIEWS[cameraFocus](form, shape, lift)
  // Up close a tap already leans toward a part, so a double-tap looks at a spot only on the whole home, the crawl view included.
  const pan = { box: homePanBox(lift), doubleTapDistance: zoomFraming === null ? HOME_PAN.doubleTapDistance : null }
  return <CameraRig framing={framing ?? focusFraming ?? homeFramingFor(aspect)} orbit={HOME_ORBIT} visibleArea={visibleArea} pan={pan} />
}
