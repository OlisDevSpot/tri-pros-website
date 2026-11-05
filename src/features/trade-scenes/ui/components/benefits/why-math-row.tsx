import type { ReactNode } from 'react'

import { toneClasses } from '@/shared/constants/status-tones'
import { cn } from '@/shared/lib/utils'

interface WhyMathRowProps {
  // Which line of the math this is: without, with or saves.
  name: string
  op?: string
  label: string
  note: ReactNode
  value: string
  // The result line: a solid rule and the saving's tone.
  strong?: boolean
}

// The calculator's receipt row, its source tag left out: every figure in the math is worked out from the rows above.
export function WhyMathRow({ name, op, label, note, value, strong = false }: WhyMathRowProps) {
  return (
    <div data-why-math-row={name} className={cn('grid grid-cols-[1.1rem_minmax(0,1fr)_auto] items-baseline gap-2.5 border-b border-dashed border-border py-1.75 text-sm', strong && 'border-solid font-bold')}>
      <span className="text-center text-muted-foreground">{op}</span>
      <span>
        {label}
        {/* The note takes the row's weight: the result's reads bold, as the saving it explains does. */}
        {note && <small className="block text-xs text-muted-foreground">{note}</small>}
      </span>
      <b data-why-value className={cn('text-right whitespace-nowrap tabular-nums', strong && toneClasses('success').text)}>{value}</b>
    </div>
  )
}
