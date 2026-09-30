'use client'

import type { BarShapeProps } from 'recharts'

import { useActiveTooltipCoordinate, useIsTooltipActive } from 'recharts'

import { cn } from '@/shared/lib/utils'

interface Props extends BarShapeProps {
  fill: string
}

// Passed as a <Bar> shape function; recharts hands each segment its geometry and whether it is the active one.
// recharts has no gap prop between stacked segments, so each segment insets itself by 1px top and bottom.
export function SegmentRect({ fill, x, y, width, height, isActive, tooltipPosition }: Props) {
  const anyActive = useIsTooltipActive()
  const activeAt = useActiveTooltipCoordinate()
  // recharts redraws a newly active bar as a fresh node in its own layer and flags it active a frame later, so it
  // would start dimmed and fade back in; the tooltip already points at this segment's centre from the first frame.
  const isMine = isActive || (activeAt?.x === tooltipPosition.x && activeAt?.y === tooltipPosition.y)
  const inset = height > 3 ? 1 : 0
  return (
    <rect
      className={cn('transition-opacity', anyActive && !isMine && 'opacity-40')}
      height={Math.max(0, height - inset * 2)}
      style={{ fill }}
      width={width}
      x={x}
      y={y + inset}
    />
  )
}
