'use client'

import type { HomeAnchorId, ReadingId } from '@/features/trade-scenes/constants/home-anchors'
import type { HomeKitInputs, TradeSceneInputs } from '@/features/trade-scenes/types'

import { useState } from 'react'
import { AgXToneMapping } from 'three'
import { useShallow } from 'zustand/react/shallow'

import { ASSEMBLY_KITS } from '@/features/trade-scenes/constants/assembly-kits'
import { CLIMATE_FALLBACK } from '@/features/trade-scenes/constants/climate-bills'
import { HOME_ANCHORS, INSIDE_READING_IDS, READING_CALLOUTS } from '@/features/trade-scenes/constants/home-anchors'
import { HOME_CAMERA_FAR } from '@/features/trade-scenes/constants/home-geometry'
import { ANCHOR_PIN_LABELS, READING_COPY, SCENE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_PRIMARY_ASSEMBLY } from '@/features/trade-scenes/constants/scene-controls'
import { useSceneLoad, useSceneLoadApi } from '@/features/trade-scenes/contexts/scene-load-context'
import { useSceneTargets } from '@/features/trade-scenes/hooks/use-scene-targets'
import { anchorFromPinId } from '@/features/trade-scenes/lib/anchor-pin-id'
import { assemblyAtAnchor } from '@/features/trade-scenes/lib/assembly-at-anchor'
import { advanceSceneLoad } from '@/features/trade-scenes/lib/create-scene-load'
import { homeLift } from '@/features/trade-scenes/lib/home-lift'
import { homeRoofForm } from '@/features/trade-scenes/lib/home-roof-form'
import { liftedFraming } from '@/features/trade-scenes/lib/lifted-framing'
import { readingFromPinId } from '@/features/trade-scenes/lib/reading-pin-id'
import { sceneBurstKey } from '@/features/trade-scenes/lib/scene-burst-key'
import { AnchorPin } from '@/features/trade-scenes/ui/components/anchor-pin'
import { AssemblyKitHost } from '@/features/trade-scenes/ui/components/assembly-kits/assembly-kit-host'
import { BlueprintPass } from '@/features/trade-scenes/ui/components/blueprint/blueprint-pass'
import { SceneReadySignal } from '@/features/trade-scenes/ui/components/blueprint/scene-ready-signal'
import { CalloutPin } from '@/features/trade-scenes/ui/components/callout-pin'
import { HomeCameraRig } from '@/features/trade-scenes/ui/components/home-kit/home-camera-rig'
import { HomeKit } from '@/features/trade-scenes/ui/components/home-kit/home-kit'
import { HomeSceneFallback } from '@/features/trade-scenes/ui/components/home-scene-fallback'
import { PartPins } from '@/features/trade-scenes/ui/components/panel/part-pins'
import { ThermalLegend } from '@/features/trade-scenes/ui/components/panel/thermal-legend'
import { ReadingPin } from '@/features/trade-scenes/ui/components/reading-pin'
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
  const zoom = useSceneInputs((state: TradeSceneInputs) => state.zoom)
  const thermal = useSceneInputs((state: TradeSceneInputs) => state.thermalCamera)
  const inputKey = useSceneInputs(sceneBurstKey)
  const load = useSceneLoadApi()
  const live = useSceneLoad(state => state.phase === 'live')
  // A touch or a wheel stream on the canvas wakes a home that went still, so a rep who reaches for it mid-story, or pans it
  // on a trackpad, sees it live again.
  const [touches, setTouches] = useState(0)
  const wake = () => setTouches(count => count + 1)
  const burstKey = `${inputKey}|${touches}|${live}`
  const store = useSceneInputsApi<TradeSceneInputs>()

  const kit = zoom !== null ? ASSEMBLY_KITS[zoom] : undefined
  const form = homeRoofForm(targets.assemblies[HOME_PRIMARY_ASSEMBLY]?.form)
  // The glide aims where the pin sits, so a flat roof's zoom lands on the membrane, not on a gable that is not there, and
  // at the height the foundation lifts the house to.
  const anchors = HOME_ANCHORS[form]
  const zoomFraming = kit ? liftedFraming(anchors[kit.anchor].framing, homeLift(inputs.property.foundationType)) : null
  const kitTargets = zoom !== null ? targets.assemblies[zoom] : undefined
  const kitParts = kitTargets?.parts ?? []
  const partFocus = kit?.partFocus && kitTargets
    ? (partId: string, peel: number) => {
        const part = kitTargets.parts.find(candidate => candidate.id === partId && candidate.material !== null)
        return part && kit.partFocus ? kit.partFocus(kitTargets.form, part, peel) : null
      }
    : null

  const open = inputs.homeView === 'partly-open' || zoom !== null

  // One reading pin for the home and the zoomed kit alike: the same label, value and disclosure wherever it is taken.
  const renderReading = (reading: ReadingId) => {
    const value = targets.heat?.readings[reading]
    // Readings exist only in a heat weather, the cases the disclosure covers.
    if (value === undefined || inputs.weather === 'rain') {
      return null
    }
    const pin = <ReadingPin label={READING_COPY.labels[form][reading]} value={value} disclosure={READING_COPY.disclosure(inputs.climate, inputs.weather)} />
    // Up close the section's readings sit on their parts; only the whole home stands them off the house.
    if (zoom !== null) {
      return pin
    }
    const callout = READING_CALLOUTS[reading]
    const hollow = !open && (INSIDE_READING_IDS as readonly string[]).includes(reading)
    return <CalloutPin offset={callout.offset} narrowOffset={callout.narrowOffset} hollow={hollow}>{pin}</CalloutPin>
  }

  const zoomInto = (anchor: HomeAnchorId) => {
    const assembly = assemblyAtAnchor(anchor)
    if (assembly !== null) {
      store.setState({ zoom: assembly })
    }
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
        <HomeCameraRig zoomFraming={zoomFraming} partFocus={partFocus} />
        {/* Up close always opens the house, and leaves the home view as the homeowner picked it. */}
        <HomeKit targets={targets} inputs={inputs} burstKey={burstKey} ghosted={zoom !== null} open={open} thermal={thermal} onAnchorTap={zoomInto}>
          {/* It rides the house's lift, so it sits on its anchor at either floor height, but outside the ghosted, painted
              house group, so the home's ghost and thermal paint leave it alone. */}
          <AssemblyKitHost zoom={zoom} targets={targets} form={form} burstKey={burstKey} />
        </HomeKit>
        <ScenePinsProjector />
        {/* Last, and the pass before the signal: equal-priority frames run in mount order, so the copy is taken before a
            real frame draws over it in the same frame. The pass stays through the handover, so a resize or a sidebar fold
            that lands as the scene turns ready still redraws the lines over the house. At live both go and R3F draws on its
            own again. */}
        {!live && <BlueprintPass />}
        {!live && <SceneReadySignal />}
      </SceneShell>

      {/* One overlay at a time owns the shared registry's pin elements: the home's, or the zoomed kit's parts. */}
      {live && zoom !== null && <PartPins parts={kitParts} renderReading={renderReading} />}
      {live && zoom === null && (
        <ScenePins
          visible={id => anchorFromPinId(id) !== null || readingFromPinId(id) !== null}
          render={(id) => {
            const reading = readingFromPinId(id)
            if (reading) {
              return renderReading(reading)
            }
            const anchor = anchorFromPinId(id)
            const label = anchor && ANCHOR_PIN_LABELS[anchor]
            return anchor && label ? <AnchorPin anchor={anchor} label={label} onSelect={() => zoomInto(anchor)} /> : null
          }}
        />
      )}
    </ScenePinsContext>
  )
}
