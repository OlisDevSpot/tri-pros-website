import type { ReactNode } from 'react'

import { cn } from '@/shared/lib/utils'

interface BlockDecorProps {
  className?: string
  children: ReactNode
}

/**
 * Self-clipping layer for corner/atmosphere decor inside a `<Block>`. The Block
 * Root is a pure frame (shadow, NO overflow) so it can't clip the decor that
 * deliberately bleeds past the box — this layer does it instead: pinned to the
 * Root bounds, `overflow-hidden` + `rounded-[inherit]` to clip decor to the
 * frame's corners. This is the clip half of the frame/clip split.
 * See docs/codebase-conventions/frontend-stack.md#never-co-locate-shadow-and-overflow.
 *
 * Sits at z-0 within the Root's `isolate`; lift content above it with `relative z-1`.
 */
export function BlockDecor({ className, children }: BlockDecorProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-[inherit]', className)}
    >
      {children}
    </div>
  )
}
