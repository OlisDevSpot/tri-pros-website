import { SCENE_LAYOUT } from '@/features/trade-scenes/constants/scene-layout'

interface SpotChipMarkProps {
  // Both ends relative to the point, which is the origin.
  line: { from: { x: number, y: number }, to: { x: number, y: number } } | null
}

export function SpotChipMark({ line }: SpotChipMarkProps) {
  const { markRadius } = SCENE_LAYOUT.spotChip
  return (
    <>
      <span
        aria-hidden
        className="pointer-events-none absolute rounded-full border-2 border-(--presentation-accent)"
        style={{ left: -markRadius, top: -markRadius, width: markRadius * 2, height: markRadius * 2 }}
      />
      {line && (
        <svg aria-hidden className="pointer-events-none absolute top-0 left-0 size-px overflow-visible">
          <line x1={line.from.x} y1={line.from.y} x2={line.to.x} y2={line.to.y} stroke="var(--presentation-accent)" strokeOpacity={0.7} strokeWidth={2} />
        </svg>
      )}
    </>
  )
}
