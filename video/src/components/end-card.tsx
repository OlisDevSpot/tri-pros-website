import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'
import { BODY_FONT, DISPLAY_FONT } from '../lib/fonts'
import { BRAND } from '../lib/tokens'

export interface EndCardContent {
  headline: string
  sub: string
  cta: string
}

/** Branded closing card: dark ground, Playfair headline, brand-blue CTA pill. */
export function EndCard({ content }: { content: EndCardContent }) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()
  const enter = spring({ frame, fps, config: { damping: 200, stiffness: 110 } })
  const ctaEnter = spring({ frame: frame - 14, fps, config: { damping: 16, stiffness: 160 } })
  const pulse = 1 + Math.sin(frame / 12) * 0.02

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: BRAND.darkBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 44,
        padding: '0 8%',
      }}
    >
      <Img
        src={staticFile('brand/logo-dark-right.svg')}
        style={{ width: 560, opacity: enter }}
      />
      <div
        style={{
          fontFamily: DISPLAY_FONT,
          fontWeight: 800,
          fontSize: 88,
          lineHeight: 1.14,
          textAlign: 'center',
          color: '#ffffff',
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`,
        }}
      >
        {content.headline}
      </div>
      <div
        style={{
          fontFamily: BODY_FONT,
          fontWeight: 600,
          fontSize: 44,
          lineHeight: 1.4,
          textAlign: 'center',
          color: BRAND.cream,
          opacity: enter,
        }}
      >
        {content.sub}
      </div>
      <div
        style={{
          marginTop: 20,
          fontFamily: BODY_FONT,
          fontWeight: 800,
          fontSize: 48,
          color: '#ffffff',
          background: BRAND.blue,
          borderRadius: 999,
          padding: '26px 72px',
          opacity: ctaEnter,
          transform: `scale(${ctaEnter * pulse})`,
          boxShadow: '0 12px 60px rgba(3,175,237,0.45)',
        }}
      >
        {content.cta}
      </div>
    </div>
  )
}
