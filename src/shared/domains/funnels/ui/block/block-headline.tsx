import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

/** Section headline. font-sans = Syne (display). */
export function BlockHeadline({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="block-headline"
      className={cn('text-foreground font-sans text-2xl leading-[1.15] font-bold tracking-[-0.01em] sm:text-[28px]', className)}
      {...props}
    />
  )
}
