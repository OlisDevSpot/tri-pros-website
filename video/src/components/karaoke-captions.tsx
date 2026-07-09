import type { WordInput } from '../lib/paginate-captions'
import { useMemo } from 'react'
import { spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT } from '../lib/fonts'
import { paginateCaptions } from '../lib/paginate-captions'
import { BRAND } from '../lib/tokens'

/**
 * CapCut-style karaoke captions: 3-word single-line pages, the currently
 * spoken word highlighted in brand blue with a scale pop. Page visibility is
 * gapless (paginate-captions.ts); the highlight flips on each word's true
 * whisper timing, so neither the page nor the highlight can lag the voice.
 */
export function KaraokeCaptions({
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
          const active = token.fromMs <= audioMs && token.toMs > audioMs
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
                {token.text}
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
