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
}: {
  src: string
  kind: 'video' | 'image'
  durationInFrames: number
  aspect: number
  label: string | null
  above?: ReactNode
  kenBurns?: KenBurns
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 130 } })

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
          <div
            style={{
              width: '100%',
              aspectRatio: `${aspect}`,
              borderRadius: 28,
              overflow: 'hidden',
              boxShadow: '0 24px 90px rgba(0,0,0,0.6)',
              opacity: enter,
              transform: `scale(${0.96 + enter * 0.04})`,
            }}
          >
            <ClipMedia src={src} kind={kind} durationInFrames={durationInFrames} kenBurns={kenBurns} />
          </div>
          <div style={{ flex: 1 }} />
        </div>
      </SafeZone>
    </AbsoluteFill>
  )
}
