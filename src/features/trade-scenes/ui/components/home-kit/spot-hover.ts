import type { ThreeEvent } from '@react-three/fiber'

// What a group that takes a spot tap also takes, so the cursor says it is tappable.
export interface SpotHover {
  onPointerOver: (event: ThreeEvent<PointerEvent>) => void
  onPointerOut: (event: ThreeEvent<PointerEvent>) => void
}
