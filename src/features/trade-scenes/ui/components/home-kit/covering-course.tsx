'use client'

import type { InstancedBufferAttribute } from 'three'
import type { CoveringCourseKind, CoveringPiece } from '@/features/trade-scenes/types'

import { useThree } from '@react-three/fiber'
import { useLayoutEffect } from 'react'

import { writePieceMarks } from '@/features/trade-scenes/lib/covering-piece-marks'
import { CoveringMaterial } from '@/features/trade-scenes/ui/components/home-kit/covering-material'
import { coveringCourseGeometry } from '@/features/trade-scenes/ui/lib/covering-course-geometry'
import { useOwnedGeometry } from '@/shared/components/scene/hooks/use-owned-geometry'
import { InstancedPieces } from '@/shared/components/scene/ui/instanced-pieces'

interface CoveringCourseProps {
  course: CoveringCourseKind
  pieces: CoveringPiece[]
  // The whole layout's piece count, which every span of it fits in.
  capacity: number
  color: string
  stretchToWidth: boolean
  roughness: number
  doubleSided: boolean
}

// One kind of piece in one instanced draw. The geometry is sized for the whole layout, so a peel that shows another span keeps the
// geometry and its marks attribute.
export function CoveringCourse({ course, pieces, capacity, color, stretchToWidth, roughness, doubleSided }: CoveringCourseProps) {
  const invalidate = useThree(state => state.invalidate)
  const geometry = useOwnedGeometry(() => coveringCourseGeometry(course, capacity), [course, capacity])

  useLayoutEffect(() => {
    const marks = geometry.getAttribute('pieceMark') as InstancedBufferAttribute | undefined
    if (marks) {
      writePieceMarks(marks.array as Float32Array, pieces)
      marks.needsUpdate = true
      invalidate()
    }
  }, [geometry, pieces, invalidate])

  return (
    <InstancedPieces geometry={geometry} pieces={pieces} color={color} stretchToWidth={stretchToWidth}>
      <CoveringMaterial shape={course} roughness={roughness} doubleSided={doubleSided} />
    </InstancedPieces>
  )
}
