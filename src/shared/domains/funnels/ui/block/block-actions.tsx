import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

/** CTA area. Spacing from --block-gap (it is a Content child). Alignment follows the block's align. */
export function BlockActions({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="block-actions" className={cn('flex items-center gap-3', className)} {...props} />
}
