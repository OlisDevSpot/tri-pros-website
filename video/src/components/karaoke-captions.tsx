import type { Caption } from '@remotion/captions'
import { createTikTokStyleCaptions } from '@remotion/captions'
import { useMemo } from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT } from '../lib/fonts'
import { BRAND } from '../lib/tokens'

/**
 * CapCut-style karaoke captions: short pages of 3–5 words, the currently
 * spoken word highlighted in brand blue with a scale pop. Timing is absolute
 * audio ms from whisper — the highlight flips at word START and cannot drift.
 * Rendered inside SafeZone; `vertical` positions the caption centerline.
 */
export function KaraokeCaptions({
  wordCaptions,
  voStartFrame,
  hideBeforeFrame,
  vertical,
}: {
  wordCaptions: Caption[]
  voStartFrame: number
  /** Suppress pages while the hook title owns the screen (no double text). */
  hideBeforeFrame: number
  vertical: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const { pages } = useMemo(
    () => createTikTokStyleCaptions({ captions: wordCaptions, combineTokensWithinMilliseconds: 1200 }),
    [wordCaptions],
  )

  if (frame < hideBeforeFrame)
    return null

  const audioMs = ((frame - voStartFrame) / fps) * 1000
  const page = pages.find(p => audioMs >= p.startMs && audioMs < p.startMs + p.durationMs)
  if (!page)
    return null

  const pageStartFrame = voStartFrame + Math.round((page.startMs / 1000) * fps)
  const enter = spring({
    frame: frame - Math.max(pageStartFrame, hideBeforeFrame),
    fps,
    config: { damping: 200, stiffness: 240 },
  })

  return (
    <div
      style={{
        position: 'absolute',
        top: `${vertical * 100}%`,
        left: 0,
        right: 0,
        transform: `translateY(-50%) scale(${0.92 + enter * 0.08})`,
        display: 'flex',
        justifyContent: 'center',
        opacity: enter,
      }}
    >
      <div
        style={{
          fontFamily: BODY_FONT,
          fontWeight: 800,
          fontSize: 58,
          lineHeight: 1.3,
          textAlign: 'center',
          textTransform: 'uppercase',
          maxWidth: '94%',
          color: '#ffffff',
          WebkitTextStroke: '10px rgba(0,0,0,0.9)',
          paintOrder: 'stroke',
          // The stroke expands each glyph ~5px per side and visually swallows
          // the natural word space — compensate or words read as jammed.
          wordSpacing: 14,
          textShadow: '0 4px 24px rgba(0,0,0,0.5)',
        }}
      >
        {page.tokens.map((token, i) => {
          const active = token.fromMs <= audioMs && token.toMs > audioMs
          // Explicit separator spaces — createTikTokStyleCaptions normalizes
          // token whitespace inconsistently, so never rely on it for layout.
          const word = token.text.trim()
          if (!word)
            return null
          return (
            <span key={`${token.fromMs}-${i}`} style={{ whiteSpace: 'pre' }}>
              {i > 0 ? ' ' : ''}
              <span
                style={{
                  color: active ? BRAND.blue : '#ffffff',
                  display: 'inline-block',
                  transform: active ? 'scale(1.1)' : 'scale(1)',
                }}
              >
                {word}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
