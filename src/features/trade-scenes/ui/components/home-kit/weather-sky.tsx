'use client'

import type { DirectionalLight } from 'three'

import type { Weather } from '@/shared/modules/construction/core/types'
import { Environment } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { BackSide, Object3D } from 'three'

import { LOT_SHADOW_BOX } from '@/features/trade-scenes/constants/home-lot'
import { BOUNCE_POSITION, SKY_IMAGE, SKY_RIG, WEATHER_SKIES } from '@/features/trade-scenes/constants/weather-skies'
import { sunShadowFrustum } from '@/features/trade-scenes/lib/sun-shadow-frustum'
import { thermalTag } from '@/features/trade-scenes/lib/thermal-tag'
import { weatherSunDirection } from '@/features/trade-scenes/lib/weather-sun-direction'
import { LightformerEnvironment } from '@/features/trade-scenes/ui/components/home-kit/lightformer-environment'
import { createSkyTexture } from '@/features/trade-scenes/ui/lib/create-sky-texture'
import { ignoreRaycast } from '@/shared/components/scene/lib/ignore-raycast'
import { AssetBoundary } from '@/shared/components/scene/ui/asset-boundary'

interface WeatherSkyProps {
  weather: Weather
  thermal: boolean
}

const { domeRadius: DOME_RADIUS, shadowMapSize: SHADOW_MAP, sunDistance: SUN_DISTANCE } = SKY_RIG

export function WeatherSky({ weather, thermal }: WeatherSkyProps) {
  const sky = WEATHER_SKIES[weather]
  const texture = useMemo(() => createSkyTexture(sky.sky.top, sky.sky.horizon), [sky.sky.top, sky.sky.horizon])
  useEffect(() => () => texture.dispose(), [texture])

  // The thermal camera's paint takes no light, so the sun's shadow is never seen under it; redrawing the shadow map each
  // frame would cost the tablet a whole extra pass. Held rather than switched off at the light, which would rebuild every
  // lit material's shader on the way out and back.
  const shadowMap = useThree(state => state.gl.shadowMap)
  const invalidate = useThree(state => state.invalidate)
  useEffect(() => {
    shadowMap.autoUpdate = !thermal
    shadowMap.needsUpdate = !thermal
    invalidate()
    return () => {
      shadowMap.autoUpdate = true
    }
  }, [shadowMap, thermal, invalidate])

  // three builds a shadow camera's projection once, when the shadow map is first made, and R3F's prop writes never rebuild
  // it, so each weather's frustum is applied by hand.
  const frustum = useMemo(() => sunShadowFrustum(weatherSunDirection(weather), LOT_SHADOW_BOX, SUN_DISTANCE), [weather])
  const sunTarget = useMemo(() => new Object3D(), [])
  const sunRef = useRef<DirectionalLight>(null)
  useLayoutEffect(() => {
    sunRef.current?.shadow.camera.updateProjectionMatrix()
    shadowMap.needsUpdate = !thermal
    invalidate()
  }, [frustum, shadowMap, thermal, invalidate])

  const lightformers = <LightformerEnvironment color={sky.environment.color} intensity={sky.environment.intensity} horizon={sky.sky.horizon} weather={weather} />

  return (
    <>
      {/* A group of its own carries the tag: the fog beside it must attach to the scene, so nothing here wraps the whole sky. */}
      <group userData={thermalTag('sky')}>
        <mesh raycast={ignoreRaycast}>
          <sphereGeometry args={[DOME_RADIUS, 32, 16]} />
          <meshBasicMaterial map={texture} side={BackSide} fog={false} depthWrite={false} toneMapped={false} />
        </mesh>
      </group>
      <fog attach="fog" args={[sky.sky.horizon, sky.fog.near, sky.fog.far]} color={sky.sky.horizon} near={sky.fog.near} far={sky.fog.far} />

      <hemisphereLight color={sky.fill.sky} groundColor={sky.fill.ground} intensity={sky.fill.intensity} />
      <directionalLight position={[...BOUNCE_POSITION]} color={sky.bounce.color} intensity={sky.bounce.intensity} />
      <primitive object={sunTarget} position={[...frustum.target]} />
      <directionalLight
        ref={sunRef}
        position={[...frustum.position]}
        target={sunTarget}
        color={sky.sun.color}
        intensity={sky.sun.intensity}
        castShadow
        shadow-mapSize={[SHADOW_MAP, SHADOW_MAP]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={frustum.left}
        shadow-camera-right={frustum.right}
        shadow-camera-top={frustum.top}
        shadow-camera-bottom={frustum.bottom}
        shadow-camera-near={frustum.near}
        shadow-camera-far={frustum.far}
      />
      {/* The clear days' sky image is served from this site, so the scene never downloads one from another host, and a slow or
          dropped connection draws the Lightformer light instead of the stills. Never keyed by weather: drei disposes the image
          on unmount, so a key would upload it and rebuild its lighting maps on every switch between the two clear days. */}
      {sky.environment.image
        ? (
            <AssetBoundary fallback={lightformers}>
              <Environment files={SKY_IMAGE} environmentIntensity={sky.environment.intensity} />
            </AssetBoundary>
          )
        : lightformers}
    </>
  )
}
