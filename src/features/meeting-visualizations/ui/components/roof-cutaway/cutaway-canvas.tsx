'use client'

import type { LayerId, PinRegistry, RoofAssembly } from '@/features/meeting-visualizations/types'
import { Environment, Grid, Lightformer, OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
import { useCallback, useLayoutEffect } from 'react'
import { Vector3 } from 'three'
import { MATERIAL_COLORS, SCENE } from '@/features/meeting-visualizations/constants/roof-cutaway-scene'
import { AtticFloor, RidgeVent, WallStubs } from '@/features/meeting-visualizations/ui/components/roof-cutaway/attic-floor'
import { CutawayMotionProvider, ExplodeLift } from '@/features/meeting-visualizations/ui/components/roof-cutaway/cutaway-motion'
import { PinAnchor, PinProjector, PinRegistryProvider } from '@/features/meeting-visualizations/ui/components/roof-cutaway/pin-anchors'
import { RoofSlope } from '@/features/meeting-visualizations/ui/components/roof-cutaway/roof-slope'

interface CutawayCanvasProps {
  assembly: RoofAssembly
  explode: number
  selected: LayerId | null
  reducedMotion: boolean
  pins: PinRegistry
  onSelect: (id: LayerId) => void
}

/** Ceiling first, then the roof from the rafters outward: the order a crew builds it. */
const ENTRY_ORDER: LayerId[] = ['ceiling', 'insulation', 'rafters', 'deck', 'ice-water', 'underlayment', 'drip-edge', 'covering', 'ridge-vent']
const ENTRY_STEP_SECONDS = 0.13

const SCENE_DROP = -1.1
const FLOOR_Y = SCENE_DROP - SCENE.wallHeight - 0.04
const CAMERA_TARGET = new Vector3(0, 0.9, 0)
const CAMERA_DIRECTION = new Vector3(-0.62, 0.36, 0.7).normalize()
/** Far enough that the fully opened roof fits a canvas this wide relative to its height. */
const FRAMING_DISTANCE = 14.5
const FRAMING_ASPECT = 1.6

function renderPin(id: LayerId, position: [number, number, number]) {
  return <PinAnchor id={id} position={position} />
}

/** Backs the camera off on narrow canvases (a portrait iPad, the split layout) so nothing is cropped. */
function CameraRig() {
  const camera = useThree(state => state.camera)
  const aspect = useThree(state => state.size.width / state.size.height)
  const invalidate = useThree(state => state.invalidate)

  useLayoutEffect(() => {
    const distance = FRAMING_DISTANCE * Math.max(1, FRAMING_ASPECT / aspect) ** 0.7
    camera.position.copy(CAMERA_TARGET).addScaledVector(CAMERA_DIRECTION, distance)
    camera.lookAt(CAMERA_TARGET)
    invalidate()
  }, [aspect, camera, invalidate])

  return null
}

/** Default export so the step can lazy-load three.js only when the cutaway is on screen. */
export default function CutawayCanvas({ assembly, explode, selected, reducedMotion, pins, onSelect }: CutawayCanvasProps) {
  const entryDelay = useCallback((id: LayerId) => ENTRY_ORDER.indexOf(id) * ENTRY_STEP_SECONDS, [])

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ fov: 30, near: 0.1, far: 120 }}
      fallback={<p className="p-6 text-sm text-white/70">This device cannot draw 3D. The layer list still walks through every layer.</p>}
      aria-label="A cutaway of a roof and attic that peels apart layer by layer"
      role="img"
    >
      <PinRegistryProvider value={pins}>
        <CutawayMotionProvider explodeTarget={explode} selected={selected} reducedMotion={reducedMotion} onSelect={onSelect}>
          <CameraRig />
          <hemisphereLight args={['#dce8f5', '#3a2c1c', 0.7]} />
          <directionalLight position={[-6, 9, 7]} intensity={2.3} color="#fff2df" />
          <directionalLight position={[7, 4, -5]} intensity={0.7} color="#9ccaff" />
          {/* Built from light panels in code, so the scene never fetches an HDR file over a homeowner's Wi-Fi. */}
          <Environment resolution={64} frames={1}>
            <Lightformer form="rect" intensity={2.2} position={[0, 6, 6]} scale={[12, 4, 1]} />
            <Lightformer form="rect" intensity={0.8} color="#7fb8ff" position={[-8, 2, -4]} scale={[6, 6, 1]} />
          </Environment>

          <group position={[0, SCENE_DROP, 0]}>
            <WallStubs />
            <AtticFloor assembly={assembly} entryDelay={entryDelay} renderPin={renderPin} />
            <ExplodeLift amount={SCENE.roofLift}>
              <RoofSlope assembly={assembly} face="front" entryDelay={entryDelay} renderPin={renderPin} />
              <RoofSlope assembly={assembly} face="back" entryDelay={entryDelay} />
              {assembly.hasRidgeVent && <RidgeVent entryDelay={entryDelay} renderPin={renderPin} />}
            </ExplodeLift>
          </group>

          <Grid
            position={[0, FLOOR_Y, 0]}
            args={[40, 40]}
            cellSize={0.5}
            cellThickness={0.6}
            cellColor={MATERIAL_COLORS.gridCell}
            sectionSize={2}
            sectionThickness={1}
            sectionColor={MATERIAL_COLORS.gridSection}
            fadeDistance={34}
            fadeStrength={1.6}
            infiniteGrid
          />

          <OrbitControls
            makeDefault
            target={CAMERA_TARGET}
            enablePan={false}
            enableDamping
            minDistance={10}
            maxDistance={34}
            minPolarAngle={0.55}
            maxPolarAngle={1.45}
            minAzimuthAngle={-1.3}
            maxAzimuthAngle={0.4}
          />
          <PinProjector />
        </CutawayMotionProvider>
      </PinRegistryProvider>
    </Canvas>
  )
}
