'use client'

import type { BufferGeometry, InstancedMesh } from 'three'
import type { PieceLayout } from '@/features/meeting-visualizations/lib/roof-geometry'
import { useLayoutEffect, useRef } from 'react'
import { Color, DoubleSide, Object3D } from 'three'

interface InstancedPiecesProps {
  geometry: BufferGeometry
  pieces: PieceLayout[]
  color: string
  /** Stretch each piece along z to its clipped width (shingle tabs); tiles keep their shape. */
  stretchToWidth?: boolean
  roughness?: number
  doubleSided?: boolean
}

/** Hundreds of shingles or tiles in one draw call, which is what keeps an iPad at full frame rate. */
export function InstancedPieces({ geometry, pieces, color, stretchToWidth = false, roughness = 0.85, doubleSided = false }: InstancedPiecesProps) {
  const mesh = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const node = mesh.current
    if (!node)
      return
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
    if (node.instanceColor)
      node.instanceColor.needsUpdate = true
    node.computeBoundingSphere()
  }, [pieces, color, stretchToWidth])

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, pieces.length]} key={pieces.length}>
      <meshStandardMaterial roughness={roughness} side={doubleSided ? DoubleSide : undefined} />
    </instancedMesh>
  )
}
