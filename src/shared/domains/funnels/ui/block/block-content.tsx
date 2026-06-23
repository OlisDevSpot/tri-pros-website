import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

/**
 * Non-media column. flex-col; inter-child rhythm = --block-gap. align-items set
 * by Root's align. The eyebrow is a kicker, so when a headline directly follows
 * it the gap is pulled tight (-1rem → ~8px) — the label hugs its headline
 * instead of floating a full --block-gap above it.
 */
export function BlockContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="block-content" className={cn('flex flex-col gap-[var(--block-gap)] [&>[data-slot=block-eyebrow]+[data-slot=block-headline]]:-mt-4', className)} {...props} />
}
