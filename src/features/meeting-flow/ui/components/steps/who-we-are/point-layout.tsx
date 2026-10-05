import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

interface PointLayoutProps {
  /** In-flow media (documents, cards, frames); `null` when the slide's background is the media. */
  media: ReactNode
  /**
   * `fill` (default): the media row takes whatever height the copy leaves. `own`: the media keeps
   * its own height, shrinking only when the screen is short, and media and copy centre together
   * as one group, so a wide photo never floats in a row taller than itself.
   */
  mediaHeight?: 'fill' | 'own'
  /** Figures and lists, anchored to the bottom of the slide. */
  children: ReactNode
}

/**
 * The content of a column slide: a media row, then the copy. One grid instead of independently
 * positioned zones, so media and copy cannot overlap at any aspect ratio. Copy ends
 * `--presentation-clear-b` above the bottom edge, clear of the floating capsule the shell hands
 * the engine through `clearBottom` (U6).
 */
export function PointLayout({ media, mediaHeight = 'fill', children }: PointLayoutProps) {
  return (
    <div
      className={cn(
        'absolute inset-0 grid gap-presentation-zone px-[6cqw] pt-presentation-zone pb-[max(6cqh,var(--presentation-clear-b,0px))]',
        mediaHeight === 'fill' ? 'grid-rows-[minmax(0,1fr)_auto]' : 'grid-rows-[minmax(0,auto)_auto] content-center',
      )}
    >
      <div className="relative min-h-0">{media}</div>
      <div className="grid gap-presentation-group">{children}</div>
    </div>
  )
}
