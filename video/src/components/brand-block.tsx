import { Img, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT } from '../lib/fonts'
import { BRAND } from '../lib/tokens'

/**
 * Branded info block for the dead space UNDER a framed card: lockup + rule +
 * two info lines, entering as a stagger (logo → rule → lines) so the section
 * reads composed, not stamped. Rendered inside the framed clip's Sequence,
 * so local frame 0 = the card's first frame.
 */
export function BrandBlock({
  logoSrc,
  line1,
  line2,
}: {
  logoSrc: string
  line1: string
  line2: string
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const stagger = (delay: number) =>
    spring({ frame: frame - delay, fps, config: { damping: 200, stiffness: 130 } })
  const logo = stagger(8)
  const rule = stagger(16)
  const lines = stagger(24)

  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: '9%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 18,
      }}
    >
      <Img
        src={staticFile(logoSrc)}
        style={{
          width: 340,
          opacity: logo,
          transform: `translateY(${(1 - logo) * 24}px)`,
        }}
      />
      <div
        style={{
          height: 2,
          width: 240 * rule,
          background: `linear-gradient(90deg, transparent, ${BRAND.blue}, transparent)`,
          opacity: rule,
        }}
      />
      <div
        style={{
          fontFamily: BODY_FONT,
          textAlign: 'center',
          opacity: lines,
          transform: `translateY(${(1 - lines) * 16}px)`,
        }}
      >
        <div style={{ fontSize: 30, fontWeight: 700, color: '#ffffff', letterSpacing: 1 }}>
          {line1}
        </div>
        <div style={{ fontSize: 25, fontWeight: 500, color: 'rgba(255,255,255,0.72)', marginTop: 6, letterSpacing: 2, textTransform: 'uppercase' }}>
          {line2}
        </div>
      </div>
    </div>
  )
}
