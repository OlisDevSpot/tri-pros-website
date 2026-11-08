'use client'

import type { ReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { HomeKitInputs, HomeSpotId, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useMemo, useState } from 'react'
import { AgXToneMapping } from 'three'
import { useShallow } from 'zustand/react/shallow'

import { CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'
import { INSIDE_READING_IDS, READING_CALLOUTS } from '@/features/trade-scenes/constants/home-anchors'
import { HOME_CAMERA_FAR } from '@/features/trade-scenes/constants/home-geometry'
import { READING_COPY, SCENE_COPY, SYSTEM_PIN_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_PRIMARY_ASSEMBLY } from '@/features/trade-scenes/constants/scene-controls'
import { useControlsOpen } from '@/features/trade-scenes/contexts/scene-controls-context'
import { useSceneLoad, useSceneLoadApi } from '@/features/trade-scenes/contexts/scene-load-context'
import { useSceneTapAway } from '@/features/trade-scenes/hooks/use-scene-tap-away'
import { useSceneTapClaim } from '@/features/trade-scenes/hooks/use-scene-tap-claim'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { advanceSceneLoad } from '@/features/trade-scenes/lib/create-scene-load'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { houseOpen } from '@/features/trade-scenes/lib/house-open'
import { isCutawaySystem } from '@/features/trade-scenes/lib/is-cutaway-system'
import { listedRows } from '@/features/trade-scenes/lib/listed-rows'
import { readingFromPinId } from '@/features/trade-scenes/lib/reading-pin-id'
import { sceneBurstKey } from '@/features/trade-scenes/lib/scene-burst-key'
import { spotFromPinId } from '@/features/trade-scenes/lib/spot-pin-id'
import { systemLit } from '@/features/trade-scenes/lib/system-lit'
import { systemPartRows } from '@/features/trade-scenes/lib/system-parts-shown'
import { BlueprintPass } from '@/features/trade-scenes/ui/components/blueprint/blueprint-pass'
import { SceneReadySignal } from '@/features/trade-scenes/ui/components/blueprint/scene-ready-signal'
import { CalloutPin } from '@/features/trade-scenes/ui/components/callout-pin'
import { HomeCameraRig } from '@/features/trade-scenes/ui/components/home-kit/home-camera-rig'
import { HomeKit } from '@/features/trade-scenes/ui/components/home-kit/home-kit'
import { HomeSceneFallback } from '@/features/trade-scenes/ui/components/home-scene-fallback'
import { PartPins } from '@/features/trade-scenes/ui/components/panel/part-pins'
import { ThermalLegend } from '@/features/trade-scenes/ui/components/panel/thermal-legend'
import { ReadingPin } from '@/features/trade-scenes/ui/components/reading-pin'
import { SpotPin } from '@/features/trade-scenes/ui/components/spot-pin'
import { SCENE_DEFAULT_CAMERA } from '@/shared/components/scene/constants/scene-camera'
import { useSceneInputs, useSceneInputsApi } from '@/shared/components/scene/contexts/scene-inputs-context'
import { ScenePinsContext } from '@/shared/components/scene/contexts/scene-pins-context'
import { useScenePinRegistry } from '@/shared/components/scene/hooks/use-scene-pin-registry'
import { ScenePins } from '@/shared/components/scene/ui/scene-pins'
import { ScenePinsProjector } from '@/shared/components/scene/ui/scene-pins-projector'
import { SceneShell } from '@/shared/components/scene/ui/scene-shell'
import { TapRing } from '@/shared/components/scene/ui/tap-ring'

// AgX rolls a bright sky and a hot afternoon off like film, where ACES pushes the highlights orange. A working number, by eye.
const HOME_TONE_MAPPING = { mapping: AgXToneMapping, exposure: 1.1 }

// Only what the house draws from; a peel drag must not redraw it. The thermal camera is its own one-off prop.
function selectHomeKitInputs(state: TradeSceneInputs): HomeKitInputs {
  return { property: state.property, weather: state.weather, climate: state.climate ?? CLIMATE_FALLBACK, homeMaterials: state.homeMaterials, homeView: state.homeView }
}

export function HomeSceneCanvas() {
  const registry = useScenePinRegistry()
  const targets = useSceneTargets()
  const inputs = useSceneInputs(useShallow(selectHomeKitInputs))
  const lookInside = useSceneInputs((state: TradeSceneInputs) => state.lookInside)
  const cameraFocus = useSceneInputs((state: TradeSceneInputs) => state.cameraFocus)
  const emphasizedPart = useSceneInputs((state: TradeSceneInputs) => state.emphasizedPart)
  const thermal = useSceneInputs((state: TradeSceneInputs) => state.thermalCamera)
  const inputKey = useSceneInputs(sceneBurstKey)
  const load = useSceneLoadApi()
  const live = useSceneLoad(state => state.phase === 'live')
  const store = useSceneInputsApi<TradeSceneInputs>()
  const controlsOpen = useControlsOpen()
  const { claimTap } = useSceneTapClaim()
  // With nothing open, a tap on the scene lets the pins at a spot go; with Systems open, its own tap-away answers the tap.
  // A write with no pins showing changes nothing.
  useSceneTapAway(controlsOpen === null, () => store.setState({ tappedSpot: null }))
  // A touch or a wheel stream on the canvas wakes a home that went still, so a rep who reaches for it mid-story, or pans it
  // on a trackpad, sees it live again.
  const [touches, setTouches] = useState(0)
  const wake = () => setTouches(count => count + 1)
  const burstKey = `${inputKey}|${touches}|${live}`

  const form = homeRoofForm(targets.assemblies[HOME_PRIMARY_ASSEMBLY]?.form)
  const open = houseOpen({ homeView: inputs.homeView, cameraFocus })
  // Looking inside always has a system in focus.
  const system = lookInside ? cameraFocus : null
  const rows = useMemo(() => system === null ? [] : systemPartRows(system, targets), [system, targets])
  // The one place the emphasis meets the rows: the house, the camera and the pins all take it from here.
  const lit = useMemo(() => system === null ? null : systemLit(system, rows, emphasizedPart), [system, rows, emphasizedPart])

  // The tap that shows a spot's pins must not also let them go; with Systems open it is still the tap that puts Systems away.
  const tapSpot = (spot: HomeSpotId) => {
    store.setState({ tappedSpot: spot })
    if (controlsOpen === null) {
      claimTap()
    }
  }

  // One reading pin wherever it is taken: the same label, value and disclosure.
  const renderReading = (reading: ReadingId) => {
    const value = targets.heat?.readings[reading]
    // Readings exist only in a heat weather, the cases the disclosure covers.
    if (value === undefined || inputs.weather === 'rain') {
      return null
    }
    const pin = <ReadingPin label={READING_COPY.labels[form][reading]} value={value} disclosure={READING_COPY.disclosure(inputs.climate, inputs.weather)} />
    // Up close on the roof or the attic the readings sit on the steps; only the whole home stands them off the house.
    if (lit !== null && isCutawaySystem(lit.system)) {
      return pin
    }
    const callout = READING_CALLOUTS[reading]
    const hollow = !open && (INSIDE_READING_IDS as readonly string[]).includes(reading)
    return <CalloutPin offset={callout.offset} narrowOffset={callout.narrowOffset} hollow={hollow}>{pin}</CalloutPin>
  }

  return (
    <ScenePinsContext value={registry}>
      <SceneShell
        label={SCENE_COPY.label}
        fallback={<HomeSceneFallback weather={inputs.weather} renderReading={renderReading} />}
        camera={{ ...SCENE_DEFAULT_CAMERA, far: HOME_CAMERA_FAR }}
        lights={null}
        shadows
        toneMapping={HOME_TONE_MAPPING}
        onPointerDown={wake}
        onWheelStream={wake}
        onFallback={() => advanceSceneLoad(load, 'live')}
        overlay={(
          <>
            {thermal && <ThermalLegend />}
            <TapRing />
          </>
        )}
      >
        <HomeCameraRig lit={lit} />
        {/* Up close leaves the home view as the homeowner picked it: the system's own fade shows what is inside. */}
        <HomeKit targets={targets} inputs={inputs} burstKey={burstKey} lit={lit} open={open} thermal={thermal} onSpotTap={tapSpot} />
        <ScenePinsProjector />
        {/* Last, and the pass before the signal: equal-priority frames run in mount order, so the copy is taken before a
            real frame draws over it in the same frame. The pass stays through the handover, so a resize or a sidebar fold
            that lands as the scene turns ready still redraws the lines over the house. At live both go and R3F draws on its
            own again. */}
        {!live && <BlueprintPass />}
        {!live && <SceneReadySignal />}
      </SceneShell>

      {/* One overlay at a time owns the shared registry's pin elements: the home's readings and a tapped spot's systems, or the
          system's parts with the readings. */}
      {live && lit !== null && <PartPins system={lit.system} parts={listedRows(rows)} emphasized={lit.emphasized} renderReading={renderReading} />}
      {live && lit === null && (
        <ScenePins
          visible={id => readingFromPinId(id) !== null || spotFromPinId(id) !== null}
          render={(id) => {
            const reading = readingFromPinId(id)
            if (reading) {
              return renderReading(reading)
            }
            const system = spotFromPinId(id)
            return system && <SpotPin system={system} label={SYSTEM_PIN_LABELS[system]} />
          }}
        />
      )}
    </ScenePinsContext>
  )
}
