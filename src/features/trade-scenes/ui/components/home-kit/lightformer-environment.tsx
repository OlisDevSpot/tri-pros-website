'use client'

import type { Weather } from '@/shared/modules/construction/core/types'

import { Environment, Lightformer } from '@react-three/drei'

import { LIGHTFORMER_RESOLUTION } from '@/features/trade-scenes/constants/weather-skies'

interface LightformerEnvironmentProps {
  color: string
  intensity: number
  horizon: string
  weather: Weather
}

export function LightformerEnvironment({ color, intensity, horizon, weather }: LightformerEnvironmentProps) {
  return (
    // Built in code, so it needs no download and stands in while the sky image loads; keyed so each weather bakes its own.
    <Environment key={weather} resolution={LIGHTFORMER_RESOLUTION} frames={1} environmentIntensity={intensity}>
      <Lightformer form="rect" intensity={2} color={color} position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      <Lightformer form="rect" intensity={1} color={horizon} position={[0, 3, 14]} scale={[30, 6, 1]} />
    </Environment>
  )
}
