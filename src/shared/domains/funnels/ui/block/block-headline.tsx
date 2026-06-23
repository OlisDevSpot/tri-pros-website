import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

/** Section headline. font-sans = Syne (display). Type from funnel tokens. */
export function BlockHeadline({ className, ...props }: ComponentProps<'h2'>) {
  return (
    <h2
      data-slot="block-headline"
      className={cn('text-foreground font-sans text-balance font-bold text-(length:--fs-headline) leading-(--lh-headline) tracking-(--tracking-headline)', className)}
      {...props}
    />
  )
}
