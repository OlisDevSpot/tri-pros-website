import type { VariantProps } from 'class-variance-authority'
import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'

import * as React from 'react'
import { cn } from '@/shared/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium cursor-pointer press-motion disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-xs hover:bg-primary-hover pressed:brightness-85',
        destructive:
          'bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive-hover pressed:brightness-85 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40',
        outline:
          'border border-control-border bg-control text-foreground shadow-xs hover:bg-control-hover pressed:bg-press backdrop-blur-sm',
        secondary:
          'bg-secondary text-secondary-foreground shadow-xs hover:bg-secondary-hover pressed:brightness-90',
        ghost:
          'hover:bg-hover pressed:bg-press',
        link: 'text-foreground underline-offset-4 hover:underline hover:text-link pressed:opacity-60 [--press-scale:1]',
        cta: 'bg-primary text-primary-foreground hover:bg-primary-hover pressed:brightness-85',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4 text-base',
        xl: 'h-12 rounded-md px-8 has-[>svg]:px-6 text-lg',
        xll: 'h-14 rounded-md px-10 has-[>svg]:px-8 text-xl',
        icon: 'size-9 [--press-scale:0.9]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<'button'>
  & VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }), '')}
      {...props}
    />
  )
}

export { Button, buttonVariants }
