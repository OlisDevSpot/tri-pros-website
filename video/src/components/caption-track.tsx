import type { Caption } from '../lib/schema'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT } from '../lib/fonts'
import { BRAND } from '../lib/tokens'

/** Renders caption text with `*word*` emphasis (brand blue, slightly larger). */
function EmphasisText({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*[^*]+\*)/).map((part, i) =>
        part.startsWith('*') && part.endsWith('*')
          ? (
              <span key={`${part}-${i}`} style={{ color: BRAND.blue, fontSize: '1.15em' }}>
                {part.slice(1, -1)}
              </span>
            )
          : part,
      )}
    </>
  )
}

/**
 * Burned-in captions mirroring the voiceover — most feed viewers watch muted.
 * `vertical` = where the caption centerline sits within the safe zone
 * (0 = top, 1 = bottom); ~0.55–0.62 is the high-retention Reels placement.
 */
export function CaptionTrack({ captions, vertical }: { captions: Caption[], vertical: number }) {
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
        top: `${vertical * 100}%`,
        left: 0,
        right: 0,
        transform: 'translateY(-50%)',
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
        <EmphasisText text={active.text} />
      </div>
    </div>
  )
}
