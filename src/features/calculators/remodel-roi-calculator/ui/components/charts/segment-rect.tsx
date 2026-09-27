import { cn } from '@/shared/lib/utils'

interface Props {
  className: string
  activeIndex: number | null
  anyActive: boolean
  fill?: string
  x?: number
  y?: number
  width?: number
  height?: number
  index?: number
}

// Passed to a <Bar> as an element; recharts clones it with each segment's x, y, width, height and index.
// recharts has no gap prop between stacked segments, so each segment insets itself by 1px top and bottom.
export function SegmentRect({ className, activeIndex, anyActive, fill, x = 0, y = 0, width = 0, height = 0, index }: Props) {
  const inset = height > 3 ? 1 : 0
  return (
    <rect
      className={cn(className, 'transition-opacity', anyActive && index !== activeIndex && 'opacity-40')}
      height={Math.max(0, height - inset * 2)}
      style={fill ? { fill } : undefined}
      width={width}
      x={x}
      y={y + inset}
    />
  )
}
