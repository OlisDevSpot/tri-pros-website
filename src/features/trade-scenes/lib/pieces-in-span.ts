import type { PieceLayout } from '@/shared/components/scene/types'

// The pieces of a covering laid over a longer run that fall in one span of it. A piece stretched to its width is cut at
// the span's ends, so two spans side by side meet in one joint; a moulded one (a tile) goes whole to the span holding its
// centre, so it is never drawn twice.
export function piecesInSpan(pieces: readonly PieceLayout[], zFrom: number, zTo: number, stretched: boolean): PieceLayout[] {
  if (!stretched) {
    return pieces.filter(piece => piece.z >= zFrom && piece.z < zTo)
  }
  return pieces.flatMap((piece) => {
    const z0 = Math.max(piece.z - piece.width / 2, zFrom)
    const z1 = Math.min(piece.z + piece.width / 2, zTo)
    return z1 > z0 ? [{ ...piece, z: (z0 + z1) / 2, width: z1 - z0 }] : []
  })
}
