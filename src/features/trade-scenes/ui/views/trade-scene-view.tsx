'use client'

import dynamic from 'next/dynamic'
import { useId, useRef, useState } from 'react'
import { preload } from 'react-dom'
import { useStore } from 'zustand'

import { SCENE_COPY } from '@/features/trade-scenes/constants/home-scene-copy'
import { HOME_SCENE_DEFAULTS } from '@/features/trade-scenes/constants/home-scene-defaults'
import { SCENE_LOAD } from '@/features/trade-scenes/constants/scene-load'
import { SKY_IMAGE } from '@/features/trade-scenes/constants/weather-skies'
import { SceneControlsProvider } from '@/features/trade-scenes/contexts/scene-controls-context'
import { SceneLoadProvider } from '@/features/trade-scenes/contexts/scene-load-context'
import { SceneTargetsProvider } from '@/features/trade-scenes/contexts/scene-targets-context'
import { SystemCardBottomProvider } from '@/features/trade-scenes/contexts/system-card-bottom-context'
import { advanceSceneLoad, createSceneLoad } from '@/features/trade-scenes/lib/create-scene-load'
import { dockRegionFor } from '@/features/trade-scenes/lib/dock-layout-for'
import { BlueprintFade } from '@/features/trade-scenes/ui/components/blueprint/blueprint-fade'
import { BlueprintLines } from '@/features/trade-scenes/ui/components/blueprint/blueprint-lines'
import { BlueprintPaper } from '@/features/trade-scenes/ui/components/blueprint/blueprint-paper'
import { SceneColourIn } from '@/features/trade-scenes/ui/components/blueprint/scene-colour-in'
import { ControlsWindow } from '@/features/trade-scenes/ui/components/controls/controls-window'
import { SceneControls } from '@/features/trade-scenes/ui/components/controls/scene-controls'
import { SystemsSection } from '@/features/trade-scenes/ui/components/controls/systems-section'
import { SceneDock } from '@/features/trade-scenes/ui/components/dock/scene-dock'
import { CloseUpCard } from '@/features/trade-scenes/ui/components/panel/close-up-card'
import { SceneKeysButton } from '@/features/trade-scenes/ui/components/scene-keys-button'
import { SceneStage } from '@/features/trade-scenes/ui/components/scene-stage'
import { SceneCameraProvider } from '@/shared/components/scene/contexts/scene-camera-context'
import { SceneInputsProvider } from '@/shared/components/scene/contexts/scene-inputs-context'
import { createSceneCamera } from '@/shared/components/scene/lib/create-scene-camera'
import { createSceneInputs } from '@/shared/components/scene/lib/create-scene-inputs'

// three.js loads only when this page is open. The blueprint paper under the canvas is the loading state.
const HomeSceneCanvas = dynamic(() => import('@/features/trade-scenes/ui/components/home-scene-canvas').then(m => m.HomeSceneCanvas), {
  ssr: false,
  loading: () => null,
})

const { paperFadeMs, linesFadeMs, linesDelayMs } = SCENE_LOAD

export function TradeSceneView() {
  // In flight before the 3D chunk has downloaded. three's FileLoader fetches it in cors mode with same-origin credentials,
  // which `crossOrigin: 'anonymous'` matches, so the browser hands the loader this response. Not drei's preload, which would
  // pull three.js into this bundle.
  preload(SKY_IMAGE, { as: 'fetch', crossOrigin: 'anonymous' })
  // One store per open scene: seeded once, discarded when the page closes.
  const [store] = useState(() => createSceneInputs(HOME_SCENE_DEFAULTS))
  // Apart from the inputs, so a camera move never touches what the scene draws from; outside the stage, so its shortcuts reach it.
  const [camera] = useState(() => createSceneCamera())
  // Outside the stage, which reads the phase; the layers below live here, outside the canvas's dynamic subtree, so a child
  // that suspends there cannot take them down with it.
  const [load] = useState(createSceneLoad)
  const lines = useRef<HTMLCanvasElement>(null)
  const loading = useStore(load, state => state.phase !== 'live')
  const windowId = useId()
  const railId = useId()

  return (
    <SceneInputsProvider store={store}>
      <SceneTargetsProvider>
        <SceneControlsProvider>
          <SystemCardBottomProvider>
            <SceneCameraProvider store={camera}>
              <SceneLoadProvider store={load} lines={lines}>
                {/* `inert` takes the stage out of the accessibility tree, so the status sits beside it. */}
                {loading && <p role="status" className="sr-only">{SCENE_COPY.loading}</p>}
                <SceneStage>
                  {({ shape, stage, zoomed, canvasOverhang, area }) => (
                    <>
                      {loading && (
                        <BlueprintFade durationMs={paperFadeMs}>
                          <BlueprintPaper area={stage.width > 0 ? area : undefined} />
                        </BlueprintFade>
                      )}
                      {/* Full size whatever the cards over it do, and reaching under the dashboard sidebar to the window's
                        left edge, so neither a close-up nor the sidebar's slide resizes it: a resized canvas redraws
                        stretched and then reframes. The stage clips the strip under the sidebar. Its own stacking context
                        keeps the pins under the cards. */}
                      <div
                        data-scene-canvas
                        className={stage.width > 0 ? 'absolute inset-y-0 right-0 isolate' : 'absolute inset-0 isolate'}
                        style={stage.width > 0 ? { width: stage.width + canvasOverhang } : undefined}
                      >
                        <SceneColourIn>
                          <HomeSceneCanvas />
                        </SceneColourIn>
                        {/* Over the canvas pixel for pixel, but outside the colour-in, so its filter never reaches the lines.
                          Its fade ends last, so it is the one that ends the load. */}
                        {loading && (
                          <BlueprintFade durationMs={linesFadeMs} delayMs={linesDelayMs} onFaded={() => advanceSceneLoad(load, 'live')}>
                            <BlueprintLines />
                          </BlueprintFade>
                        )}
                      </div>

                      {/* Placed by the measured shape, which the server cannot know, so nothing is laid out until the stage
                        has its size. */}
                      {stage.width > 0 && (
                        <>
                          {/* The dock is centred on the stage's right edge, above the band the bottom group stands in, or
                            above a portrait close-up card. The region passes taps through to the canvas everywhere but on
                            the dock. */}
                          <div
                            data-dock-region
                            className="pointer-events-none absolute right-0 z-10 w-24 *:pointer-events-auto"
                            style={dockRegionFor(shape, stage, zoomed)}
                          >
                            <SceneDock />
                          </div>
                          <CloseUpCard />
                          <SceneKeysButton />
                          <SceneControls windowId={windowId} railId={railId} />
                          <SystemsSection railId={railId} />
                          <ControlsWindow id={windowId} />
                        </>
                      )}
                    </>
                  )}
                </SceneStage>
              </SceneLoadProvider>
            </SceneCameraProvider>
          </SystemCardBottomProvider>
        </SceneControlsProvider>
      </SceneTargetsProvider>
    </SceneInputsProvider>
  )
}
