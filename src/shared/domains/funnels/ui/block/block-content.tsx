import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

/** Non-media column. flex-col; inter-child rhythm = --block-gap. align-items set by Root's align. */
export function BlockContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="block-content" className={cn('flex flex-col gap-[var(--block-gap)]', className)} {...props} />
}
