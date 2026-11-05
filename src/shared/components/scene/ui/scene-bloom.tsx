'use client'

import { Bloom, EffectComposer } from '@react-three/postprocessing'

// Only colours pushed past 1.0 (glowing ribbons, toneMapped off) cross the threshold, so the bloom is selective.
export function SceneBloom() {
  return (
    <EffectComposer>
      <Bloom mipmapBlur luminanceThreshold={1} intensity={0.9} />
    </EffectComposer>
  )
}
