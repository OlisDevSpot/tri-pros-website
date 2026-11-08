import type { WINDOW_FRAMES } from '@/features/trade-scenes/constants/home-geometry'
import type { BoxSpec, SystemPartId, WindowPieceId } from '@/features/trade-scenes/types'

import { HOUSE } from '@/features/trade-scenes/constants/home-geometry'
import { LOOK_INSIDE_WINDOW, PART_PIECES } from '@/features/trade-scenes/constants/look-inside'
import { PANE_LOOKS, SCREEN_STANDOFF } from '@/features/trade-scenes/constants/system-part-looks'
import { windowBoxes } from '@/features/trade-scenes/lib/window-boxes'

const { wall, opening } = LOOK_INSIDE_WINDOW
// The axis across the wall, which the window's pieces stack on.
const ACROSS = wall.run === 'z' ? 0 : 2

// The framed window's shown glazing pieces, inside out, each whole where it stands in the window at rest: the panes where
// the house draws its glass, the gas between them, the coating on the outer pane's inside face and the screen off its outside.
export function windowPieceBoxes(frame: (typeof WINDOW_FRAMES)[keyof typeof WINDOW_FRAMES], shown: ReadonlySet<SystemPartId>): { id: WindowPieceId, boxes: BoxSpec[] }[] {
  // Inner first, outer second, as the house stacks a double window's panes; a single window has the one.
  const glass = windowBoxes(wall, opening, frame, HOUSE.floorY, HOUSE.wallThickness).glass
  const inner = glass[0].position[ACROSS]
  const outer = glass.at(-1)!.position[ACROSS]
  const toward = Math.sign(inner - outer)
  const paneThickness = PANE_LOOKS['outer-pane'].thickness
  const across: Record<WindowPieceId, number> = {
    'pane': inner,
    'screen': outer - toward * (paneThickness + PANE_LOOKS.screen.thickness) / 2 - toward * SCREEN_STANDOFF,
    'outer-pane': outer,
    'inner-pane': inner,
    'low-e': outer + toward * (paneThickness + PANE_LOOKS['low-e'].thickness) / 2,
    'argon': (inner + outer) / 2,
    'air-gap': (inner + outer) / 2,
  }
  return (PART_PIECES.glazing.filter(id => shown.has(id)) as WindowPieceId[]).map((id) => {
    const size = [...glass[0].size] as [number, number, number]
    const position = [...glass[0].position] as [number, number, number]
    size[ACROSS] = PANE_LOOKS[id].thickness
    position[ACROSS] = across[id]
    return { id, boxes: [{ size, position }] }
  })
}
