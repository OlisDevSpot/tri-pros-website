import type { ReactNode } from 'react'

import { Slot } from '@radix-ui/react-slot'

import { cn } from '@/shared/lib/utils'

interface BlockMediaProps {
  side?: 'left' | 'right'
  overlay?: ReactNode
  asChild?: boolean
  className?: string
  children?: ReactNode
}

/**
 * The photo layer for a media block. Mobile: an in-flow banner at the top of
 * the stack (`order-first`, `aspect-video`). Desktop: absolutely positioned,
 * full-height, flush to its side edge — it sits BEHIND the floating content
 * card (which the media variant styles via the block-content slot), so the
 * card overlaps the photo's inner edge. `overlay` (a `<Decor placement="cover">`)
 * rides on top of the photo, clipped to this wrapper. `asChild` lets a consumer
 * pass a fully-styled element instead of an `<Image fill>` (no overlay).
 */
export function BlockMedia({ side = 'right', overlay, asChild, className, children }: BlockMediaProps) {
  const wrapperCls = cn(
    'relative order-first w-full overflow-hidden aspect-video',
    'md:absolute md:inset-y-0 md:order-none md:aspect-auto md:h-auto md:w-[58%]',
    side === 'right' ? 'md:right-0' : 'md:left-0',
    className,
  )

  if (asChild) {
    return <Slot data-slot="block-media" className={wrapperCls}>{children}</Slot>
  }

  return (
    <div data-slot="block-media" className={wrapperCls}>
      {children}
      {overlay
        ? <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">{overlay}</div>
        : null}
    </div>
  )
}
