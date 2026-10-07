'use client'

import type { VariantProps } from 'class-variance-authority'
import * as TogglePrimitive from '@radix-ui/react-toggle'
import { cva } from 'class-variance-authority'
import * as React from 'react'

import { cn } from '@/shared/lib/utils'

const toggleVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium data-[state=off]:hover:bg-hover data-[state=off]:pressed:bg-press disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg:not([class*=\'size-\'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap',
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        // Filled like an outline Button. The on-state takes the selection tint: a lighter neutral rung all but
        // vanishes against the fill on nested light surfaces.
        outline:
          'border border-control-border bg-control shadow-xs data-[state=off]:hover:bg-control-hover data-[state=on]:bg-control-selected data-[state=on]:text-foreground',
        // Off items stay unfilled so the sunken track dims them; the active one is the lifted tab. Not bg-accent:
        // dark --accent is solid cobalt.
        segmented:
          'rounded-md bg-transparent px-2.5 text-muted-foreground data-[state=off]:hover:text-foreground data-[state=on]:bg-tab-active data-[state=on]:text-foreground data-[state=on]:shadow-xs',
      },
      size: {
        default: 'h-9 px-2 min-w-9',
        sm: 'h-8 px-1.5 min-w-8',
        lg: 'h-10 px-2.5 min-w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Toggle({
  className,
  variant,
  size,
  ...props
}: React.ComponentProps<typeof TogglePrimitive.Root>
  & VariantProps<typeof toggleVariants>) {
  return (
    <TogglePrimitive.Root
      data-slot="toggle"
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Toggle, toggleVariants }
