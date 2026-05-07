'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'

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
 * Frosted-glass tooltip content that matches the PopoverContent treatment.
 * Uses the same `--popover-glass*` tokens so desktop hover and mobile
 * tap produce visually identical surfaces.
 */
function GlassTooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'z-50 w-fit max-w-xs origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-2 text-sm text-popover-foreground',
          'animate-in fade-in-0 zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95',
          'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        style={{
          backgroundColor: 'var(--popover-glass)',
          backgroundImage: 'var(--popover-glass-overlay)',
          backdropFilter: 'blur(32px) saturate(180%)',
          WebkitBackdropFilter: 'blur(32px) saturate(180%)',
          boxShadow: 'var(--popover-glass-shadow)',
        }}
        {...props}
      >
        {children}
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

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
    <TooltipPrimitive.Provider delayDuration={0}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
        <GlassTooltipContent side={side}>
          {content}
        </GlassTooltipContent>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  )
}
