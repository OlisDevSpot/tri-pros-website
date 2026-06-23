// Satori render tree — <img> elements are Satori nodes, not DOM; next/image does not apply here
interface FunnelOgCardProps {
  background: string | null
  logo: string | null
  headline: string
  trustLine: string
}

/**
 * Satori render tree for the funnel OG image. Inline styles only — Satori does
 * not read Tailwind. Every container with >1 child sets `display: flex`.
 */
export function FunnelOgCard({ background, logo, headline, trustLine }: FunnelOgCardProps) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        width: '100%',
        height: '100%',
        position: 'relative',
        background: background ? '#0b1220' : 'linear-gradient(135deg, #03AFED 0%, #0b1220 100%)',
        fontFamily: 'Playfair Display',
      }}
    >
      {background
        ? (
            <img
              src={background}
              width={1200}
              height={630}
              style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, objectFit: 'cover' }}
            />
          )
        : null}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1200,
          height: 630,
          display: 'flex',
          background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.82) 100%)',
        }}
      />
      {logo
        ? (
            <img
              src={logo}
              width={190}
              height={56}
              style={{ position: 'absolute', top: 56, left: 64, objectFit: 'contain' }}
            />
          )
        : null}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          padding: '0 64px 72px',
          position: 'relative',
          color: 'white',
        }}
      >
        <div style={{ display: 'flex', fontSize: 62, fontWeight: 700, lineHeight: 1.05, maxWidth: 1000 }}>
          {headline}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', fontSize: 30 }}>
          <span style={{ color: '#ffd54a' }}>★★★★★</span>
          <span style={{ color: 'white', marginLeft: 14 }}>{trustLine}</span>
        </div>
      </div>
    </div>
  )
}
