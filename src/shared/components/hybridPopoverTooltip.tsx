'use client'

import * as React from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/shared/components/ui/tooltip'

function useCoarsePointer() {
  const [coarse, setCoarse] = React.useState(false)

  React.useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    const update = () => setCoarse(mq.matches)
    update()

    mq.addEventListener('change', update)

    return () => {
      mq.removeEventListener('change', update)
    }
  }, [])

  return coarse
}

interface Props {
  children: React.ReactNode
  content: React.ReactNode
  side?: 'top' | 'right' | 'bottom' | 'left'
}

/**
 * Tooltip on pointer devices, real Popover on touch — same frosted-glass
 * surface either way. Use this whenever the trigger needs to surface
 * information on phones/tablets, not only on hover. For desktop-only
 * tooltips, use the base `Tooltip` from `@/shared/components/ui/tooltip`
 * directly — it shares the same surface treatment.
 */
export function HybridPopoverTooltip({ children, content, side = 'top' }: Props) {
  const isTouch = useCoarsePointer()

  if (isTouch) {
    return (
      <Popover>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent side={side} className="max-w-xs w-fit text-sm">
          {content}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>
        {content}
      </TooltipContent>
    </Tooltip>
  )
}
