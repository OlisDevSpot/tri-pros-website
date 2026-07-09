import type { Caption } from '../lib/schema'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT } from '../lib/fonts'

/** Burned-in captions mirroring the voiceover — most feed viewers watch muted. */
export function CaptionTrack({ captions }: { captions: Caption[] }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const active = captions.find(c => frame >= c.startFrame && frame < c.endFrame)
  if (!active)
    return null

  const enter = spring({
    frame: frame - active.startFrame,
    fps,
    config: { damping: 200, stiffness: 180 },
  })

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontFamily: BODY_FONT,
          fontWeight: 800,
          fontSize: 52,
          lineHeight: 1.25,
          textAlign: 'center',
          color: '#ffffff',
          background: 'rgba(0,0,0,0.55)',
          borderRadius: 18,
          padding: '18px 34px',
          maxWidth: '92%',
          opacity: enter,
          transform: `scale(${0.94 + enter * 0.06})`,
        }}
      >
        {active.text}
      </div>
    </div>
  )
}
