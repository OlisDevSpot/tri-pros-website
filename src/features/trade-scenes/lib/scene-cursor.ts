import { SPIN_CURSOR } from '@/features/trade-scenes/constants/scene-cursors'

interface SceneCursorState {
  overPart: boolean
  shift: boolean
  dragging: 'pan' | 'spin' | null
}

// Shift is read before a part: a Shift press starts a spin wherever it lands.
export function sceneCursor({ overPart, shift, dragging }: SceneCursorState): string {
  if (dragging === 'spin' || (dragging === null && shift)) {
    return SPIN_CURSOR
  }
  if (dragging === 'pan') {
    return 'grabbing'
  }
  return overPart ? 'pointer' : 'move'
}
