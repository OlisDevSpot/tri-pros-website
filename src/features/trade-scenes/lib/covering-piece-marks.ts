import type { CoveringPiece } from '@/features/trade-scenes/types'

// Written in the order the pieces are drawn, so a span of a longer layout keeps each piece's marks with that piece.
export function writePieceMarks(target: Float32Array, pieces: readonly CoveringPiece[]): void {
  pieces.forEach((piece, index) => {
    target[index * 2] = piece.crack ?? 0
    target[index * 2 + 1] = piece.broken ?? 0
  })
}
