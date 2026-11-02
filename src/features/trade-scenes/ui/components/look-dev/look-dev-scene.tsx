'use client'

import type { LookDevOptions } from '@/features/trade-scenes/types'

import { ContactShadows, OrbitControls } from '@react-three/drei'

import { LOOK_DEV_CAMERA, LOOK_DEV_ORBIT_TARGET } from '@/features/trade-scenes/constants/look-dev-section'
import { HeatRibbons } from '@/features/trade-scenes/ui/components/look-dev/heat-ribbons'
import { SectionSample } from '@/features/trade-scenes/ui/components/look-dev/section-sample'
import { SceneShell } from '@/shared/components/scene/ui/scene-shell'

interface LookDevSceneProps {
  options: LookDevOptions
  onEmphasize: (id: string | null) => void
}

export function LookDevScene({ options, onEmphasize }: LookDevSceneProps) {
  const showRibbons = options.heat && options.renderer === 'webgl'
  // ContactShadows draws with a depth material and blur shaders the WebGPU renderer cannot run.
  const showContactShadow = options.treatment === 'studio' && options.renderer === 'webgl'
  return (
    <SceneShell
      key={options.renderer}
      label="A section through a roof and attic, for choosing how the cutaway looks"
      renderer={options.renderer}
      camera={LOOK_DEV_CAMERA}
      bloom={showRibbons}
      fallback={<p className="p-6 text-sm text-muted-foreground">This device cannot draw 3D.</p>}
    >
      <group onPointerMissed={() => onEmphasize(null)}>
        <SectionSample options={options} onEmphasize={onEmphasize} />
      </group>
      {showRibbons && <HeatRibbons options={options} />}
      {showContactShadow && <ContactShadows position={[0, -0.62, 0]} opacity={0.5} blur={2.4} scale={8} far={3} frames={1} />}
      <OrbitControls makeDefault target={LOOK_DEV_ORBIT_TARGET} enablePan={false} enableDamping minDistance={6} maxDistance={22} />
    </SceneShell>
  )
}
