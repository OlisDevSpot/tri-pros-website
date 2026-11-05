'use client'

import type { ReactNode } from 'react'
import type { BufferGeometry, InstancedMesh } from 'three'
import type { PieceLayout } from '@/shared/components/scene/types'

import { useThree } from '@react-three/fiber'
import { useLayoutEffect, useRef } from 'react'
import { Color, DoubleSide, Object3D } from 'three'

interface InstancedPiecesProps {
  geometry: BufferGeometry
  pieces: PieceLayout[]
  color: string
  stretchToWidth?: boolean
  roughness?: number
  doubleSided?: boolean
  children?: ReactNode
}

// Hundreds of shingles or tiles in one draw call is what keeps an iPad at full frame rate.
export function InstancedPieces({ geometry, pieces, color, stretchToWidth = false, roughness = 0.85, doubleSided = false, children }: InstancedPiecesProps) {
  const mesh = useRef<InstancedMesh>(null)
  const invalidate = useThree(state => state.invalidate)

  useLayoutEffect(() => {
    const node = mesh.current
    if (!node) {
      return
    }
    const dummy = new Object3D()
    const base = new Color(color)
    const tint = new Color()
    pieces.forEach((piece, index) => {
      dummy.position.set(piece.x, piece.y, piece.z)
      dummy.rotation.set(0, 0, piece.tilt)
      dummy.scale.set(1, 1, stretchToWidth ? piece.width : 1)
      dummy.updateMatrix()
      node.setMatrixAt(index, dummy.matrix)
      node.setColorAt(index, tint.copy(base).multiplyScalar(piece.shade))
    })
    node.instanceMatrix.needsUpdate = true
    if (node.instanceColor) {
      node.instanceColor.needsUpdate = true
    }
    node.computeBoundingSphere()
    invalidate()
  }, [geometry, pieces, color, stretchToWidth, invalidate])

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, pieces.length]} key={pieces.length}>
      {children ?? <meshStandardMaterial roughness={roughness} side={doubleSided ? DoubleSide : undefined} />}
    </instancedMesh>
  )
}
