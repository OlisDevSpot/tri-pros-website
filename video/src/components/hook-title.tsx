import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { DISPLAY_FONT } from '../lib/fonts'
import { BRAND } from '../lib/tokens'

/** Word-by-word kinetic headline — the 0–3s scroll-stopper. */
export function HookTitle({ text }: { text: string }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.28em',
        justifyContent: 'center',
        alignContent: 'center',
        height: '100%',
        fontFamily: DISPLAY_FONT,
        fontWeight: 800,
        fontSize: 92,
        lineHeight: 1.12,
        textAlign: 'center',
        color: '#ffffff',
        textShadow: '0 4px 32px rgba(0,0,0,0.55)',
      }}
    >
      {words.map((word, i) => {
        const progress = spring({
          frame: frame - i * 3,
          fps,
          config: { damping: 200, stiffness: 140 },
        })
        return (
          <span
            key={`${word}-${i}`}
            style={{
              opacity: progress,
              transform: `translateY(${interpolate(progress, [0, 1], [36, 0])}px)`,
              display: 'inline-block',
            }}
          >
            {word}
          </span>
        )
      })}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            height: 8,
            width: interpolate(
              spring({ frame: frame - words.length * 3, fps, config: { damping: 200 } }),
              [0, 1],
              [0, 320],
            ),
            borderRadius: 4,
            background: BRAND.blue,
          }}
        />
      </div>
    </div>
  )
}
