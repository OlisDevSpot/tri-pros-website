'use client'

/**
 * Project tooltip standard.
 *
 *   Pointer-only surfaces (desktop hover/focus, no mobile tap path needed):
 *     → import `Tooltip`/`TooltipTrigger`/`TooltipContent` from this file.
 *
 *   Hybrid surfaces (must also work on touch — phones, tablets):
 *     → import `HybridPopoverTooltip` from
 *       `@/shared/components/hybridPopoverTooltip`. It detects coarse
 *       pointers and falls back to a real Popover. On pointer it delegates
 *       to this Tooltip so both paths share the same frosted-glass surface.
 *
 * Surface treatment matches `PopoverContent`: frosted-glass background via
 * the `--popover-glass*` tokens, `text-popover-foreground`, no arrow. Never
 * use the shadcn default `bg-primary text-primary-foreground` for tooltip
 * content — primary colour belongs to actions, not to passive labels.
 */

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

import { cn } from '@/shared/lib/utils'

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 6,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
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

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
