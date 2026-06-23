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
 * Full-bleed media column. Requires a padded surface (card|muted) on the Block:
 * the negative margins cancel --block-pad so the image meets the panel edge with
 * no gutter. Desktop: bleeds to the side; mobile: a top banner (aspect-video).
 * `overlay` (a <Decor placement="cover">) rides on top, clipped by the wrapper.
 * `asChild` is for consumer-styled media (no fill wrapper, no overlay).
 */
export function BlockMedia({ side = 'right', overlay, asChild, className, children }: BlockMediaProps) {
  const wrapperCls = cn(
    'relative overflow-hidden',
    // mobile: top banner, bleed top + both sides
    '-mx-[var(--block-pad)] -mt-[var(--block-pad)] aspect-video',
    // desktop: column, reset mobile bleed, fill height, min-h
    'sm:mx-0 sm:mt-0 sm:aspect-auto sm:h-full sm:min-h-[var(--block-media-min-h)]',
    side === 'right'
      ? 'sm:-my-[var(--block-pad)] sm:-mr-[var(--block-pad)]'
      : 'sm:-my-[var(--block-pad)] sm:-ml-[var(--block-pad)]',
    // order: media on top on mobile; on desktop right→source order, left→first
    'order-first',
    side === 'right' ? 'md:order-none' : 'md:order-first',
    className,
  )

  if (asChild) {
    return <Slot data-slot="block-media" className={wrapperCls}>{children}</Slot>
  }

  return (
    <div data-slot="block-media" className={wrapperCls}>
      {children}
      {overlay
        ? <div aria-hidden className="pointer-events-none absolute inset-0 z-10 overflow-hidden">{overlay}</div>
        : null}
    </div>
  )
}
