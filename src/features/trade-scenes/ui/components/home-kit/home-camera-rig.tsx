'use client'

import type { SystemLit, TradeSceneInputs } from '@/features/trade-scenes/types'
import type { CameraFraming, VisibleArea } from '@/shared/components/scene/types'

import { useLayoutEffect, useState } from 'react'

import { CRAWL_FRAMING } from '@/features/trade-scenes/constants/home-anchors'
import { AC_SCALE } from '@/features/trade-scenes/constants/home-equipment-sizes'
import { HOME_ORBIT, HOME_PAN } from '@/features/trade-scenes/constants/home-geometry'
import { lookInsideView, partLookInsideView, SYSTEM_CAMERA_VIEWS } from '@/features/trade-scenes/constants/system-camera-views'
import { useSceneVisibleArea } from '@/features/trade-scenes/contexts/scene-visible-area-context'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { openedDuctRun } from '@/features/trade-scenes/lib/duct-run-points'
import { framingTowardPart, partOffset } from '@/features/trade-scenes/lib/framing-toward-part'
import { homeFramingFor } from '@/features/trade-scenes/lib/home-framing-for'
import { homeLift } from '@/features/trade-scenes/lib/home-lift'
import { homePanBox } from '@/features/trade-scenes/lib/home-pan-box'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { houseOpen } from '@/features/trade-scenes/lib/house-open'
import { leanPoint } from '@/features/trade-scenes/lib/lean-point'
import { liftedFraming } from '@/features/trade-scenes/lib/lifted-framing'
import { openPeel } from '@/features/trade-scenes/lib/open-peel'
import { partState } from '@/features/trade-scenes/lib/part-state'
import { restingFraming } from '@/features/trade-scenes/lib/resting-framing'
import { useSceneCamera, useSceneCameraApi } from '@/shared/components/scene/contexts/scene-camera-context'
import { useSceneInputs } from '@/shared/components/scene/contexts/scene-inputs-context'
import { cameraFramingKey } from '@/shared/components/scene/lib/camera-goal'
import { CameraRig } from '@/shared/components/scene/ui/camera-rig'
import { roofFormOf } from '@/shared/modules/construction/core/lib/roof-form-of'

interface HomeCameraRigProps {
  // The system up close, with an emphasis only while its part is shown, so the lean never aims at a part that is not drawn.
  lit: SystemLit | null
}

// The framing is picked from the stage's shape, not the canvas's: the canvas also spans the strip under the dashboard sidebar,
// and the framing a rep sees must not change with it. The stage is measured before the canvas mounts, so the scene opens framed.
// The canvas changes shape only with the window: a fold, of the card or the sidebar, shifts the view and keeps the user's orbit
// and pan, except the fold that ends the crawl view, which changes the framing.
export function HomeCameraRig({ lit }: HomeCameraRigProps) {
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
  const foundationType = useSceneInputs((state: TradeSceneInputs) => state.property.foundationType)
  const cameraFocus = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus)
  const partlyOpen = useSceneInputs(houseOpen)
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
  const up = lit !== null
  const upClose = up ? lookInsideView(lit.system, form, shape, lift, hvac) : null
  const crawl = looksUnderFloor ? liftedFraming(CRAWL_FRAMING, lift) : null
  // Only the system's own view is held once focus is let go: the up-close view, the lean and the crawl view are layered over
  // it below, so a card closing from any of them settles on the system's view rather than keeping their pose.
  const systemView = cameraFocus === null ? null : SYSTEM_CAMERA_VIEWS[cameraFocus](form, shape, lift, hvac)
  const recenters = useSceneCamera(state => state.recenters)
  const cameraStore = useSceneCameraApi()
  const [rest, setRest] = useState<{ held: CameraFraming | null, recenters: number }>({ held: null, recenters })
  const resting = restingFraming({ focus: systemView, held: rest.held, home: homeFramingFor(aspect), recentered: recenters !== rest.recenters })
  // Compared by key: the system's view is rebuilt every render, so comparing it by identity would never settle.
  const heldChanged = (resting.held === null ? null : cameraFramingKey(resting.held)) !== (rest.held === null ? null : cameraFramingKey(rest.held))
  if (heldChanged || recenters !== rest.recenters) {
    setRest({ held: resting.held, recenters })
  }
  // The shared rig clears `moved` in its own layout effect on a reframe, which runs before this one, so a held pose keeps
  // Recenter showing.
  useLayoutEffect(() => {
    if (resting.away && !cameraStore.getState().moved) {
      cameraStore.setState({ moved: true })
    }
  })
  // An emphasised part that steps open is framed where its step shows, so the lean follows the peel and the parts above it;
  // one that pulls apart is framed where it stands at rest.
  const emphasized = lit === null ? null : lit.emphasized
  const peel = useSceneInputs((state: TradeSceneInputs) => lit !== null && emphasized !== null ? openPeel(lit.system, state.peel) : 0)
  const targets = useSceneTargets()
  const point = lit !== null && emphasized !== null
    ? leanPoint(lit.system, form, emphasized, peel, lit.shown, openedDuctRun(partState(targets.assemblies['hvac-attic']?.parts ?? [], 'duct-runs'), form))
    : null
  // A part off the system's own run has a look of its own instead of the lean.
  const partFraming = lit !== null && emphasized !== null ? partLookInsideView(lit.system, emphasized, form, shape, lift, hvac) : null
  const leaned = upClose && point ? framingTowardPart(upClose, partOffset(upClose, point, lift)) : upClose
  const framing = partFraming ?? leaned ?? crawl ?? resting.framing
  // Up close a tap already leans toward a part, so a double-tap looks at a spot only outside it, the crawl view included.
  const pan = { box: homePanBox(lift), doubleTapDistance: up ? null : HOME_PAN.doubleTapDistance }
  return <CameraRig framing={framing} orbit={HOME_ORBIT} visibleArea={visibleArea} pan={pan} gestures="pan-first" />
}
