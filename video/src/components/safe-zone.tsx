import type { ReactNode } from 'react'
import { AbsoluteFill } from 'remotion'

/**
 * Meta unified 9:16 safe area (March 2026 spec: top 14% / bottom 35% / sides
 * 6%) — platform UI overlays outside these paddings on Reels/Stories. All
 * text/graphics must render inside this wrapper; validate with Ads Manager's
 * Safe Zone Guardrail before shipping.
 */
export function SafeZone({ children }: { children: ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        paddingTop: '14%',
        paddingBottom: '35%',
        paddingLeft: '6%',
        paddingRight: '6%',
      }}
    >
      {children}
    </AbsoluteFill>
  )
}
