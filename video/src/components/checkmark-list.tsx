import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT } from '../lib/fonts'
import { BRAND } from '../lib/tokens'

/** Staggered ✓ benefit rows — the checkmark-list variant of the ad copy, animated. */
export function CheckmarkList({ items }: { items: string[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 30,
        justifyContent: 'center',
        height: '100%',
      }}
    >
      {items.map((item, i) => {
        const progress = spring({
          frame: frame - i * 9,
          fps,
          config: { damping: 200, stiffness: 120 },
        })
        return (
          <div
            key={item}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 26,
              opacity: progress,
              transform: `translateX(${interpolate(progress, [0, 1], [-60, 0])}px)`,
            }}
          >
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: BRAND.blue,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                fontSize: 42,
                fontWeight: 800,
                color: '#ffffff',
              }}
            >
              ✓
            </div>
            <div
              style={{
                fontFamily: BODY_FONT,
                fontWeight: 800,
                fontSize: 54,
                color: '#ffffff',
                textShadow: '0 3px 24px rgba(0,0,0,0.6)',
              }}
            >
              {item}
            </div>
          </div>
        )
      })}
    </div>
  )
}
