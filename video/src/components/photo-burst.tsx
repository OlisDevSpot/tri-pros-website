import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

/**
 * Camera-snap montage: each photo enters full-bleed on its frame like a
 * photograph being taken — quick scale settle from 108%, tiny rotation
 * easing to level, opacity pop — then drifts on a slow Ken Burns push so it
 * never sits static. Pair every entrance frame with a shutter SFX cue in
 * props.sfx; the audio IS the event, this is its visual.
 */
export function PhotoBurst({
  photos,
}: {
  photos: { src: string, frame: number }[]
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
