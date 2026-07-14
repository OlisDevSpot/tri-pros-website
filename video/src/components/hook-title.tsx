import type { ReactNode } from 'react'
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { DISPLAY_FONT } from '../lib/fonts'
import { BRAND } from '../lib/tokens'

export type HookTitleStyle = 'wordStagger' | 'punch' | 'freeze' | 'typewriter'

/** Word-by-word kinetic headline — the 0–3s scroll-stopper. Also carries the
 * punch / freeze / typewriter alternate text treatments (variation-axis 1). */
export function HookTitle({ text, style = 'wordStagger' }: { text: string, style?: HookTitleStyle }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const words = text.split(' ')
  const chars = text.split('')

  // The underline spring starts only once the text treatment above it has
  // finished animating in — timing differs per variant.
  const underlineDelay = style === 'typewriter'
    ? chars.length * 1.5
    : style === 'wordStagger'
      ? words.length * 3
      : 10

  let content: ReactNode

  if (style === 'punch') {
    const progress = spring({ frame, fps, config: { damping: 12, stiffness: 200 } })
    content = (
      <span
        style={{
          opacity: Math.min(1, frame / 3),
          transform: `scale(${0.85 + progress * 0.15})`,
          display: 'inline-block',
        }}
      >
        {text}
      </span>
    )
  }
  else if (style === 'freeze') {
    content = (
      <span style={{ opacity: Math.min(1, frame / 2), display: 'inline-block' }}>
        {text}
      </span>
    )
  }
  else if (style === 'typewriter') {
    const visible = Math.floor(frame / 1.5)
    content = (
      <div style={{ whiteSpace: 'pre-wrap', width: '100%' }}>
        {chars.slice(0, visible).join('')}
        {visible < chars.length && <span style={{ color: BRAND.blue }}>▍</span>}
      </div>
    )
  }
  else {
    content = words.map((word, i) => {
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
    })
  }

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
        transform: style === 'freeze'
          ? `scale(${interpolate(frame, [0, 75], [1, 1.06])})`
          : undefined,
      }}
    >
      {content}
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
              spring({ frame: frame - underlineDelay, fps, config: { damping: 200 } }),
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
