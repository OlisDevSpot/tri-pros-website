import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

// Deterministic per-photo layout (no Math.random — renders must be reproducible).
const SCATTER = [
  { left: '6%', top: '12%', rotate: -6 },
  { left: '30%', top: '30%', rotate: 4 },
  { left: '10%', top: '46%', rotate: -3 },
  { left: '34%', top: '10%', rotate: 7 },
]
const GRID = [
  { left: '2%', top: '16%' },
  { left: '51%', top: '16%' },
  { left: '2%', top: '50%' },
  { left: '51%', top: '50%' },
]

/**
 * Camera-snap montage: each photo enters full-bleed on its frame like a
 * photograph being taken — quick scale settle from 108%, tiny rotation
 * easing to level, opacity pop — then drifts on a slow Ken Burns push so it
 * never sits static. Pair every entrance frame with a shutter SFX cue in
 * props.sfx; the audio IS the event, this is its visual.
 *
 * `style` selects the treatment: `fullbleed` (default, house v5 camera-snap
 * above), `polaroid-scatter` (white-matted prints accumulating at scattered
 * positions/rotations), or `grid` (photos landing in a 2×2 cell grid with
 * the underlying clip visible in the gutters). Scatter/grid entrance is the
 * same settle spring — one motion per moment, no added drift or rotation.
 */
export function PhotoBurst({
  photos,
  style = 'fullbleed',
}: {
  photos: { src: string, frame: number }[]
  style?: 'fullbleed' | 'polaroid-scatter' | 'grid'
}) {
  const frame = useCurrentFrame()
  const { fps } = useVideoConfig()

  return (
    <>
      {photos.map((photo, i) => {
        const local = frame - photo.frame
        if (local < 0)
          return null
        const settle = spring({ frame: local, fps, config: { damping: 16, stiffness: 190, mass: 0.6 } })

        if (style === 'polaroid-scatter') {
          const pos = SCATTER[i % SCATTER.length]!
          return (
            <div
              key={photo.src}
              style={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                width: '58%',
                background: '#ffffff',
                padding: '12px 12px 56px',
                borderRadius: 8,
                boxShadow: '0 18px 60px rgba(0,0,0,0.55)',
                opacity: Math.min(1, local / 2),
                transform: `scale(${1.08 - settle * 0.08}) rotate(${pos.rotate}deg)`,
              }}
            >
              <Img src={staticFile(photo.src)} style={{ width: '100%', aspectRatio: '4 / 5', objectFit: 'cover', borderRadius: 3 }} />
            </div>
          )
        }

        if (style === 'grid') {
          const pos = GRID[i % GRID.length]!
          return (
            <div
              key={photo.src}
              style={{
                position: 'absolute',
                left: pos.left,
                top: pos.top,
                width: '47%',
                height: '32%',
                opacity: Math.min(1, local / 2),
                transform: `scale(${1.08 - settle * 0.08})`,
                borderRadius: 20,
                overflow: 'hidden',
              }}
            >
              <Img src={staticFile(photo.src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
          )
        }

        const scale = 1.08 - settle * 0.08
        const rotate = (1 - settle) * (i % 2 === 0 ? -1.4 : 1.4)
        const drift = interpolate(local, [12, 170], [1, 1.05], {
          extrapolateLeft: 'clamp',
          extrapolateRight: 'clamp',
        })
        return (
          <div
            key={photo.src}
            style={{
              position: 'absolute',
              inset: 0,
              opacity: Math.min(1, local / 2),
              transform: `scale(${scale * drift}) rotate(${rotate}deg)`,
            }}
          >
            <Img
              src={staticFile(photo.src)}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )
      })}
    </>
  )
}
