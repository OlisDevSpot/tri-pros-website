import type { ReactNode } from 'react'

interface PointLayoutProps {
  /** In-flow media (documents, cards, frames); `null` when the slide's background is the media. */
  media: ReactNode
  /** Figures and lists, anchored to the bottom of the slide. */
  children: ReactNode
}

/**
 * The content of a column slide: a media row that takes whatever height the copy leaves, then
 * the copy. One grid instead of independently positioned zones, so media and copy cannot
 * overlap at any aspect ratio. Copy ends `--presentation-clear-b` above the bottom edge,
 * clear of the floating capsule the shell hands the engine through `clearBottom` (U6).
 */
export function PointLayout({ media, children }: PointLayoutProps) {
  return (
    <div className="absolute inset-0 grid grid-rows-[minmax(0,1fr)_auto] gap-presentation-zone px-[6cqw] pt-presentation-zone pb-[max(6cqh,var(--presentation-clear-b,0px))]">
      <div className="relative min-h-0">{media}</div>
      <div className="grid gap-presentation-group">{children}</div>
    </div>
  )
}
