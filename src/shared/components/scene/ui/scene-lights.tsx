'use client'

import { Environment, Lightformer } from '@react-three/drei'

export function SceneLights() {
  return (
    <>
      <hemisphereLight args={['#dce8f5', '#3a2c1c', 0.7]} />
      <directionalLight position={[-6, 9, 7]} intensity={2.3} color="#fff2df" />
      <directionalLight position={[7, 4, -5]} intensity={0.7} color="#9ccaff" />
      {/* Built from light panels in code, so a scene never downloads an HDR file over a homeowner's Wi-Fi. */}
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2.2} position={[0, 6, 6]} scale={[12, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#7fb8ff" position={[-8, 2, -4]} scale={[6, 6, 1]} />
      </Environment>
    </>
  )
}
