'use client'

import type { Ref } from 'react'
import type { ColorRepresentation, MeshStandardMaterial } from 'three'
import type { TextureMapChoice, TextureSetId } from '@/features/trade-scenes/types'
import type { TexturedUniforms } from '@/features/trade-scenes/ui/lib/patch-textured-material'

import { useThree } from '@react-three/fiber'
import { useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { Color } from 'three'

import { GREY_MAP_LIFT, ROUGHNESS_MAP_MEAN, SOLID_MAP_KEY, TEXTURE_SETS } from '@/features/trade-scenes/constants/material-textures'
import { useTextureMaps } from '@/features/trade-scenes/hooks/use-texture-maps'
import { patchTexturedMaterial, TEXTURED_PROGRAM_KEY } from '@/features/trade-scenes/ui/lib/patch-textured-material'
import { SCENE_MOTION } from '@/shared/components/scene/constants/scene-motion'
import { useTweened } from '@/shared/components/scene/hooks/use-tweened'

interface TexturedMaterialProps {
  set: TextureSetId
  map: TextureMapChoice
  // Today's flat colour: what shows until the map arrives, and what a grey map is tinted by.
  color: ColorRepresentation
  mapTint?: ColorRepresentation
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
  opacity?: number
  depthWrite?: boolean
  transparent?: boolean
  polygonOffset?: boolean
  polygonOffsetFactor?: number
  polygonOffsetUnits?: number
  // Off until the surface is first seen (a system first opened); once on, the maps stay.
  loadWhen?: boolean
  ref?: Ref<MeshStandardMaterial>
}

// three compiles a material's `defines` into its program, but types them on ShaderMaterial alone.
interface WithDefines {
  defines?: Record<string, string>
}

const MAP_EASE = { duration: 0.25, ease: SCENE_MOTION.transition.ease }

const texturedProgramCacheKey = () => TEXTURED_PROGRAM_KEY

// One material per mesh, as R3F makes it; only the textures are shared. Until its maps arrive it draws exactly today's
// flat colour, then eases to the map.
export function TexturedMaterial({ set, map, color, mapTint, roughness = 0.9, metalness = 0, emissive, emissiveIntensity = 0, opacity = 1, depthWrite, transparent, polygonOffset = false, polygonOffsetFactor = 0, polygonOffsetUnits = 0, loadWhen = true, ref }: TexturedMaterialProps) {
  const maps = useTextureMaps(set, map, loadWhen)
  const invalidate = useThree(state => state.invalidate)
  const material = useRef<MeshStandardMaterial>(null)
  useImperativeHandle(ref, () => material.current as MeshStandardMaterial)

  // Made once and never replaced: applyGhost records the material's own opacity in it, and a new object mid-ghost loses it.
  const [userData] = useState(() => ({
    [SOLID_MAP_KEY]: true,
    textured: { uMapIn: { value: maps.ready ? 1 : 0 }, uMapTint: { value: new Color() } } satisfies TexturedUniforms,
  }))
  const [macro] = useState(() => TEXTURE_SETS[set].macro)
  const { textured } = userData

  // Before the first compile, and only then: a define compiles into the program, so changing it later recompiles. Merged,
  // because three's own STANDARD define lives on the same object.
  useLayoutEffect(() => {
    const own = material.current as WithDefines | null
    if (own && macro) {
      own.defines = { ...own.defines, TEXTURE_MACRO: '' }
    }
  }, [macro])

  useTweened(maps.ready ? 1 : 0, (value) => {
    textured.uMapIn.value = value
    material.current?.normalScale.set(value, value)
  }, MAP_EASE)

  const grey = map === 'grey'
  useLayoutEffect(() => {
    if (grey) {
      textured.uMapTint.value.set(mapTint ?? color).multiplyScalar(GREY_MAP_LIFT)
    }
    else {
      textured.uMapTint.value.set(mapTint ?? '#ffffff')
    }
    invalidate()
  }, [grey, mapTint, color, textured, invalidate])

  // R3F disposes every texture a material holds when it disposes the material, and these are shared, so the material is
  // kept from R3F's disposal and disposed here alone.
  useEffect(() => {
    const own = material.current
    return () => own?.dispose()
  }, [])

  return (
    <meshStandardMaterial
      ref={material}
      dispose={null}
      color={color}
      map={maps.map}
      normalMap={maps.normalMap}
      roughnessMap={maps.roughnessMap}
      roughness={maps.ready ? roughness / ROUGHNESS_MAP_MEAN : roughness}
      metalness={metalness}
      emissive={emissive ?? '#000000'}
      emissiveIntensity={emissiveIntensity}
      transparent={transparent ?? opacity < 1}
      opacity={opacity}
      depthWrite={depthWrite ?? opacity >= 1}
      polygonOffset={polygonOffset}
      polygonOffsetFactor={polygonOffsetFactor}
      polygonOffsetUnits={polygonOffsetUnits}
      userData={userData}
      onBeforeCompile={patchTexturedMaterial}
      customProgramCacheKey={texturedProgramCacheKey}
    />
  )
}
