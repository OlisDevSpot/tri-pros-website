export function metresOf(tiles: number, tile: number): number {
  return tiles * tile
}

export function tilesOf(metres: number, tile: number): number {
  return Math.round(metres / tile)
}
