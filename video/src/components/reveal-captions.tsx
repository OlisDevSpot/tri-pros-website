import type { WordInput } from '../lib/paginate-captions'
import { useMemo } from 'react'
import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT, EMPHASIS_FONT } from '../lib/fonts'
import { paginateCaptions } from '../lib/paginate-captions'
import { BRAND } from '../lib/tokens'

/**
 * Build-as-spoken captions: the page's words are invisible until each word's
 * own whisper timestamp, then fade/rise in over 3 frames — the line assembles
 * exactly under the narrator. Page visibility stays gapless
 * (paginate-captions.ts), so the text block never blinks between sentences.
 * Emphasis words (marked `*word*` in the VO script) break the uppercase wall:
 * luxe serif italic, brand blue, 1.15×.
 */
export function RevealCaptions({
  wordCaptions,
  voStartFrame,
  hideBeforeFrame,
  vertical,
}: {
  wordCaptions: WordInput[]
  voStartFrame: number
  /** Suppress pages while the hook title owns the screen (no double text). */
  hideBeforeFrame: number
  vertical: number
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const pages = useMemo(() => paginateCaptions(wordCaptions), [wordCaptions])

  if (frame < hideBeforeFrame)
    return null

  const audioMs = ((frame - voStartFrame) / fps) * 1000
  const page = pages.find(p => audioMs >= p.startMs && audioMs < p.endMs)
  if (!page)
    return null

  const REVEAL_FRAMES = 3
  const msPerFrame = 1000 / fps

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
          fontSize: 56,
          lineHeight: 1.3,
          textAlign: 'center',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
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
          // Word reveals at its own timestamp; already-spoken words on a
          // fresh page show instantly (the page itself just appeared).
          const framesSinceSpoken = (audioMs - token.fromMs) / msPerFrame
          const reveal = interpolate(framesSinceSpoken, [0, REVEAL_FRAMES], [0, 1], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
          const emphasized = token.emphasis === true
          return (
            <span key={`${token.fromMs}-${i}`} style={{ whiteSpace: 'pre' }}>
              {i > 0 ? ' ' : ''}
              <span
                style={{
                  display: 'inline-block',
                  opacity: reveal,
                  transform: `translateY(${(1 - reveal) * 14}px)${emphasized ? ' scale(1.15)' : ''}`,
                  ...(emphasized
                    ? {
                        fontFamily: EMPHASIS_FONT,
                        fontStyle: 'italic',
                        textTransform: 'none',
                        color: BRAND.blue,
                      }
                    : {}),
                }}
              >
                {token.text}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
