'use client'

import type { VariantProps } from 'class-variance-authority'
import * as ToggleGroupPrimitive from '@radix-ui/react-toggle-group'
import * as React from 'react'

import { toggleVariants } from '@/shared/components/ui/toggle'
import { cn } from '@/shared/lib/utils'

const ToggleGroupContext = React.createContext<
  VariantProps<typeof toggleVariants>
>({
  size: 'default',
  variant: 'default',
})

function ToggleGroup({
  className,
  variant,
  size,
  children,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Root>
  & VariantProps<typeof toggleVariants>) {
  const contextValue = React.useMemo(() => ({ variant, size }), [variant, size])

  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        'group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs',
        // Plain classes rather than data-variant ones, so a caller's own width or height still merges over them. The
        // track is a control, so it takes a button's edge, not a field's.
        variant === 'segmented' && 'gap-0.5 rounded-lg border border-control-border bg-tab-track p-0.5',
        // Inside a control group the group's own edge and padding already frame the options; a second track would draw
        // a second edge.
        variant === 'segmented' && 'in-data-[slot=control-group]:border-0 in-data-[slot=control-group]:bg-transparent in-data-[slot=control-group]:p-0',
        className,
      )}
      {...props}
    >
      <ToggleGroupContext value={contextValue}>
        {children}
      </ToggleGroupContext>
    </ToggleGroupPrimitive.Root>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof ToggleGroupPrimitive.Item>
  & VariantProps<typeof toggleVariants>) {
  const context = React.use(ToggleGroupContext)

  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      data-variant={context.variant || variant}
      data-size={context.size || size}
      className={cn(
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        'min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l',
        (context.variant || variant) === 'segmented' && 'flex-none rounded-md first:rounded-md last:rounded-md data-[state=on]:shadow-xs',
        className,
      )}
      {...props}
    >
      {children}
    </ToggleGroupPrimitive.Item>
  )
}

export { ToggleGroup, ToggleGroupItem }
