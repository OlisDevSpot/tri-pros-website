import type { ReactNode } from 'react'

interface PointLayoutProps {
  /** In-flow media (documents, cards, frames); `null` when the media is a full-bleed backdrop. */
  media: ReactNode
  /** Heading, line and proof, anchored to the bottom of the stage. */
  children: ReactNode
}

/**
 * The stage of a point beat: a media row that takes whatever height the copy leaves,
 * then the copy. One grid instead of independently positioned zones, so media and
 * copy cannot overlap at any stage aspect ratio.
 */
export function PointLayout({ media, children }: PointLayoutProps) {
  return (
    <div className="absolute inset-0 grid grid-rows-[minmax(0,1fr)_auto] gap-[3cqh] px-[6cqw] pt-[5cqh] pb-[max(6cqh,var(--stage-inset-b))]">
      <div className="relative min-h-0">{media}</div>
      <div className="grid gap-[1.2cqh]">{children}</div>
    </div>
  )
}
