import type { DecorShape } from '@/shared/components/decor/constants/decor-config'
import { DECOR_ORIGIN, DECOR_RING_COUNT } from '@/shared/components/decor/constants/decor-config'

export type RingDescriptor
  = | { kind: 'circle', cx: number, cy: number, r: number, strokeWidth: number, opacity: number }
    | { kind: 'rect', x: number, y: number, size: number, strokeWidth: number, opacity: number }
    | { kind: 'path', d: string, strokeWidth: number, opacity: number }

// Linear interpolate across the ring index so stroke + opacity fall off from
// the corner outward — the tokenized "subtle but noticeable" ramp.
function lerp(from: number, to: number, t: number) {
  return from + (to - from) * t
}

export function buildDecorGeometry(shape: DecorShape, count = DECOR_RING_COUNT): RingDescriptor[] {
  const { x, y } = DECOR_ORIGIN
  const base = 52
  const step = 44
  return Array.from({ length: count }, (_, i) => {
    const t = i / (count - 1)
    const strokeWidth = lerp(2.8, 1.5, t)
    const opacity = lerp(0.82, 0.1, t)
    const size = base + i * step
    if (shape === 'square') {
      return { kind: 'rect', x: x - size, y, size, strokeWidth, opacity }
    }
    if (shape === 'triangle') {
      const d = `M ${x} ${y} L ${x - size} ${y} L ${x} ${y + size} Z`
      return { kind: 'path', d, strokeWidth, opacity }
    }
    return { kind: 'circle', cx: x, cy: y, r: size, strokeWidth, opacity }
  })
}
