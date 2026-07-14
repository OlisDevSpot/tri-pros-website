import type { ReactNode } from 'react'
import type { KenBurns } from '../lib/schema'
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT } from '../lib/fonts'
import { BRAND } from '../lib/tokens'
import { ClipMedia } from './clip-media'
import { SafeZone } from './safe-zone'

/**
 * Editorial card layout for landscape clips: dark brand ground, rounded card
 * at native aspect (no crop), label chip or custom content above.
 */
export function FramedClip({
  src,
  kind,
  durationInFrames,
  aspect,
  label,
  above,
  kenBurns = 'in',
  cardStyle = 'native',
  secondarySrc = null,
}: {
  src: string
  kind: 'video' | 'image'
  durationInFrames: number
  aspect: number
  label: string | null
  above?: ReactNode
  kenBurns?: KenBurns
  cardStyle?: 'native' | 'polaroid' | 'split' | 'letterbox' | 'offset'
  secondarySrc?: string | null
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 130 } })
  const media = <ClipMedia src={src} kind={kind} durationInFrames={durationInFrames} kenBurns={kenBurns} />
  const enterTransform = `scale(${0.96 + enter * 0.04})`

  const card
    = cardStyle === 'polaroid'
      ? (
          // Instant-photo frame: white mat, deep chin, slight tilt.
          <div
            style={{
              width: '88%',
              alignSelf: 'center',
              background: '#ffffff',
              padding: '18px 18px 96px',
              borderRadius: 10,
              boxShadow: '0 24px 90px rgba(0,0,0,0.6)',
              opacity: enter,
              transform: `${enterTransform} rotate(-1.6deg)`,
            }}
          >
            <div style={{ aspectRatio: `${aspect}`, overflow: 'hidden', borderRadius: 4 }}>{media}</div>
          </div>
        )
      : cardStyle === 'split' && secondarySrc
        ? (
            // Before | after halves with a brand divider — the remodeling-native card.
            <div
              style={{
                width: '100%',
                aspectRatio: `${aspect}`,
                borderRadius: 28,
                overflow: 'hidden',
                display: 'flex',
                boxShadow: '0 24px 90px rgba(0,0,0,0.6)',
                opacity: enter,
                transform: enterTransform,
              }}
            >
              <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                {media}
                <SplitTag text="BEFORE" />
              </div>
              <div style={{ width: 4, background: BRAND.blue }} />
              <div style={{ position: 'relative', flex: 1, overflow: 'hidden' }}>
                <ClipMedia src={secondarySrc} kind="image" durationInFrames={durationInFrames} kenBurns={kenBurns} />
                <SplitTag text="AFTER" />
              </div>
            </div>
          )
        : cardStyle === 'letterbox'
          ? (
              // Cinematic bleed: edge-to-edge (escapes the SafeZone padding), hairline rules.
              <div
                style={{
                  width: '113%',
                  alignSelf: 'center',
                  aspectRatio: `${aspect}`,
                  borderTop: `2px solid ${BRAND.blue}`,
                  borderBottom: `2px solid ${BRAND.blue}`,
                  overflow: 'hidden',
                  opacity: enter,
                  transform: enterTransform,
                }}
              >
                {media}
              </div>
            )
          : cardStyle === 'offset'
            ? (
                // Editorial asymmetry: card hugs the left, vertical rule fills the right gap.
                <div style={{ width: '100%', display: 'flex', alignItems: 'stretch', gap: 24, opacity: enter, transform: enterTransform }}>
                  <div style={{ width: '84%', aspectRatio: `${aspect}`, borderRadius: 28, overflow: 'hidden', boxShadow: '0 24px 90px rgba(0,0,0,0.6)' }}>
                    {media}
                  </div>
                  <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
                    <div style={{ width: 4, borderRadius: 2, background: BRAND.blue }} />
                  </div>
                </div>
              )
            : (
                // native — the house v5 card, unchanged.
                <div
                  style={{
                    width: '100%',
                    aspectRatio: `${aspect}`,
                    borderRadius: 28,
                    overflow: 'hidden',
                    boxShadow: '0 24px 90px rgba(0,0,0,0.6)',
                    opacity: enter,
                    transform: enterTransform,
                  }}
                >
                  {media}
                </div>
              )

  return (
    <AbsoluteFill style={{ background: BRAND.darkBg }}>
      <SafeZone>
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 36 }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {above
              ?? (label && (
                <div
                  style={{
                    fontFamily: BODY_FONT,
                    fontWeight: 800,
                    fontSize: 30,
                    letterSpacing: '0.24em',
                    textTransform: 'uppercase',
                    color: BRAND.cream,
                    border: `2px solid ${BRAND.blue}`,
                    borderRadius: 999,
                    padding: '14px 34px',
                    opacity: enter,
                  }}
                >
                  {label}
                </div>
              ))}
          </div>
          {card}
          <div style={{ flex: 1 }} />
        </div>
      </SafeZone>
    </AbsoluteFill>
  )
}

function SplitTag({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: 14,
        left: 14,
        fontFamily: BODY_FONT,
        fontWeight: 800,
        fontSize: 20,
        letterSpacing: '0.18em',
        color: '#ffffff',
        background: 'rgba(0,0,0,0.55)',
        borderRadius: 6,
        padding: '6px 12px',
      }}
    >
      {text}
    </div>
  )
}
