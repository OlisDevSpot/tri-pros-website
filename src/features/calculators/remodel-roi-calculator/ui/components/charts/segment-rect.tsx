'use client'

import type { BarShapeProps } from 'recharts'

import { useIsTooltipActive } from 'recharts'

import { cn } from '@/shared/lib/utils'

type Props = BarShapeProps & {
  fill: string
}

// Passed as a <Bar> shape function; recharts hands each segment its geometry and whether it is the active one.
// recharts has no gap prop between stacked segments, so each segment insets itself by 1px top and bottom.
export function SegmentRect({ fill, x, y, width, height, isActive }: Props) {
  const anyActive = useIsTooltipActive()
  const inset = height > 3 ? 1 : 0
  return (
    <rect
      className={cn('transition-opacity', anyActive && !isActive && 'opacity-40')}
      height={Math.max(0, height - inset * 2)}
      style={{ fill }}
      width={width}
      x={x}
      y={y + inset}
    />
  )
}
