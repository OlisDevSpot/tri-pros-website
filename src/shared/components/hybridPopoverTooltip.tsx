import * as React from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
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

export function HybridPopoverTooltip({ children, content, side = 'top' }: Props) {
  const isTouch = useCoarsePointer()

  if (isTouch) {
    return (
      <Popover>
        <PopoverTrigger>{children}</PopoverTrigger>
        <PopoverContent side={side} className="max-w-xs text-sm">
          {content}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>{children}</TooltipTrigger>
        <TooltipContent side={side} className="max-w-xs text-sm">
          {content}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
