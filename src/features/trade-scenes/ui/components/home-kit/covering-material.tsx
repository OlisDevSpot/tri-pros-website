'use client'

import type { CoveringCourseKind } from '@/features/trade-scenes/types'

import { DoubleSide, FrontSide } from 'three'

import { COVERING_WEAR_PROGRAM_KEY } from '@/features/trade-scenes/constants/covering-wear-shader'
import { courseCarriesMarks } from '@/features/trade-scenes/lib/course-carries-marks'
import { TexturedMaterial } from '@/features/trade-scenes/ui/components/home-kit/textured-material'
import { injectCoveringWear } from '@/features/trade-scenes/ui/lib/inject-covering-wear'

interface CoveringMaterialProps {
  shape: CoveringCourseKind
  roughness: number
  doubleSided: boolean
}

const coveringProgramCacheKey = () => COVERING_WEAR_PROGRAM_KEY

// Cracks and broken corners are drawn in the tile's own material, so they add no draw call. Only a tile course carries them: a
// shingle or shake wears by which pieces are missing, curled or split, which the layout already moves.
export function CoveringMaterial({ shape, roughness, doubleSided }: CoveringMaterialProps) {
  if (shape === 'shingle') {
    return <TexturedMaterial set="shingle" map="grey" color="#ffffff" roughness={roughness} />
  }
  const marked = courseCarriesMarks(shape)
  return (
    <meshStandardMaterial
      roughness={roughness}
      side={doubleSided ? DoubleSide : FrontSide}
      onBeforeCompile={marked ? injectCoveringWear : undefined}
      customProgramCacheKey={marked ? coveringProgramCacheKey : undefined}
    />
  )
}
