import type { ComponentProps } from 'react'

import { cn } from '@/shared/lib/utils'

/**
 * Non-media column. flex-col; inter-child rhythm = --block-gap. align-items set
 * by Root's align. The eyebrow is a kicker: when a headline directly follows it,
 * the gap is pulled tight to --block-gap-kicker so the label hugs its headline.
 */
export function BlockContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="block-content" className={cn('flex flex-col gap-(--block-gap) [&>[data-slot=block-eyebrow]+[data-slot=block-headline]]:mt-[calc(var(--block-gap-kicker)_-_var(--block-gap))]', className)} {...props} />
}
