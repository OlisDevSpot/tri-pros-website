'use client'

import type { CSSProperties, ReactNode } from 'react'
import type { CalloutOffset } from '@/features/trade-scenes/constants/home-anchors'

import { cn } from '@/shared/lib/utils'

interface CalloutPinProps {
  /** Where the line ends and the label stands, in px from the dot. */
  offset: CalloutOffset
  /** The same where the scene's visible area is narrow, where the house leaves no room beside it for the label. */
  narrowOffset?: CalloutOffset
  /** A ring with a clear centre, for a reading taken inside the house while the house is Complete. */
  hollow?: boolean
  children: ReactNode
}

function leader(name: 'wide' | 'narrow', [dx, dy]: CalloutOffset) {
  return {
    [`--${name}-dx`]: `${dx}px`,
    [`--${name}-dy`]: `${dy}px`,
    [`--${name}-length`]: `${Math.hypot(dx, dy)}px`,
    [`--${name}-angle`]: `${Math.atan2(dy, dx)}rad`,
    // A line running left hangs the label to its left, so the shelf carries on the way the line goes.
    [`--${name}-shift`]: dx < 0 ? '-100%' : '0%',
  }
}

// The box has no size, so the projector's centring leaves its origin on the spot the reading marks. The label stands a few
// pixels off it on screen rather than at a point in the scene, so it stays close to the house at any canvas size or angle.
export function CalloutPin({ offset, narrowOffset = offset, hollow = false, children }: CalloutPinProps) {
  const style = { ...leader('wide', offset), ...leader('narrow', narrowOffset) } as CSSProperties
  return (
    <div className="relative size-0" style={style}>
      <span className="absolute top-0 left-0 h-px w-(--wide-length) origin-left rotate-(--wide-angle) bg-on-media/80 group-data-visible-narrow/stage:w-(--narrow-length) group-data-visible-narrow/stage:rotate-(--narrow-angle)" />
      {/* The dot fills and empties over the house's opening ease, so it keeps pace with the walls. */}
      <span className={cn('absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-scrim/80 inset-ring-2 inset-ring-on-media transition-colors duration-1000 motion-reduce:transition-none', hollow ? 'bg-transparent' : 'bg-on-media')} />
      <div className="absolute top-(--wide-dy) left-(--wide-dx) translate-x-(--wide-shift) -translate-y-full border-b border-on-media/80 px-3 pb-1 group-data-visible-narrow/stage:top-(--narrow-dy) group-data-visible-narrow/stage:left-(--narrow-dx) group-data-visible-narrow/stage:translate-x-(--narrow-shift)">
        {children}
      </div>
    </div>
  )
}
