import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion'

/** Dock glide length; the watermark Sequence must start at dockFrame + DOCK_FRAMES. */
export const DOCK_FRAMES = 15

/**
 * Opening brand moment: the lockup springs in centered over the cold-open
 * shot, holds, then glides in ONE continuous motion into the watermark slot
 * (top 14% / right 6% / watermarkWidth) where the persistent watermark takes
 * over on the landing frame — one logo exists at all times, no pop.
 */
export function LogoIntro({
  src,
  enterFrame,
  dockFrame,
  watermarkWidth,
}: {
  src: string
  enterFrame: number
  dockFrame: number
  watermarkWidth: number
}) {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()

  const enter = spring({ frame: frame - enterFrame, fps, config: { damping: 200, stiffness: 120 } })
  const dock = interpolate(frame, [dockFrame, dockFrame + DOCK_FRAMES], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  })

  const centerWidth = 460
  const startX = (width - centerWidth) / 2
  const startY = height * 0.3
  const endX = width - width * 0.06 - watermarkWidth
  const endY = height * 0.14

  const w = interpolate(dock, [0, 1], [centerWidth, watermarkWidth])
  const x = interpolate(dock, [0, 1], [startX, endX])
  const y = interpolate(dock, [0, 1], [startY, endY])
  const opacity = enter * interpolate(dock, [0, 1], [1, 0.85])
  // Shadow lifts the lockup off bright footage centered, fades to the flat watermark look.
  const shadow = 1 - dock

  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        opacity,
        transform: `scale(${0.9 + enter * 0.1})`,
        transformOrigin: 'center',
        filter: `drop-shadow(0 ${8 * shadow}px ${32 * shadow}px rgba(0,0,0,${0.45 * shadow}))`,
      }}
    >
      <Img src={staticFile(src)} style={{ width: '100%' }} />
    </div>
  )
}
