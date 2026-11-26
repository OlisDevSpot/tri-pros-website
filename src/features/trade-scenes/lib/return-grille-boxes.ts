import type { IndoorUnitPlacement } from '@/features/trade-scenes/lib/indoor-unit-placement'
import type { BoxSpec } from '@/features/trade-scenes/types'

// Working numbers, set by screenshot: how many bars cross the face, how much of the face they fill, and how far they stand
// proud of the frame into the room.
const BARS = { count: 6, fill: 0.45, reach: 0.86, proud: 0.014 } as const

// The grille's frame and its bars, laid along the face's longer side on the room side of the frame, so it reads as a return
// on a ceiling or on a wall alike.
export function returnGrilleBoxes({ grille, facing }: IndoorUnitPlacement['returnAir']): { frame: BoxSpec[], bars: BoxSpec[] } {
  const across = facing.findIndex(value => value !== 0)
  const [long, short] = [0, 1, 2].filter(axis => axis !== across).sort((a, b) => grille.size[b]! - grille.size[a]!) as [number, number]
  const pitch = grille.size[short]! / BARS.count
  const bars = Array.from({ length: BARS.count }, (_, index): BoxSpec => {
    const size: [number, number, number] = [0, 0, 0]
    size[long] = grille.size[long]! * BARS.reach
    size[short] = pitch * BARS.fill
    size[across] = BARS.proud
    const position: [number, number, number] = [...grille.position]
    position[short] = grille.position[short]! - grille.size[short]! / 2 + pitch * (index + 0.5)
    position[across] = grille.position[across]! + facing[across]! * (grille.size[across]! + BARS.proud) / 2
    return { size, position }
  })
  return { frame: [grille], bars }
}
