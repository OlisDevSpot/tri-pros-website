import type { ReactNode } from 'react'
import { AbsoluteFill } from 'remotion'

/**
 * Meta unified 9:16 safe area — platform UI (username, CTA, reactions) overlays
 * outside these paddings on Reels/Stories placements. All text/graphics must
 * render inside this wrapper.
 */
export function SafeZone({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        paddingTop: '14%',
        paddingBottom: '22%',
        paddingLeft: '6%',
        paddingRight: '6%',
      }}
    >
      {children}
    </AbsoluteFill>
  )
}
