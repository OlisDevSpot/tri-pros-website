import { CanvasTexture, SRGBColorSpace } from 'three'

// A vertical gradient for the sky dome, drawn in code so no image is downloaded. The lower half holds the horizon colour,
// which is also the fog colour, so the far yard melts into the sky.
export function createSkyTexture(top: string, horizon: string): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 2
  canvas.height = 256
  const context = canvas.getContext('2d')!
  const gradient = context.createLinearGradient(0, 0, 0, canvas.height)
  // The dome's equator sits halfway down: the top colour holds to about 25° above the horizon so a low camera still sees sky.
  gradient.addColorStop(0, top)
  gradient.addColorStop(0.36, top)
  gradient.addColorStop(0.5, horizon)
  gradient.addColorStop(1, horizon)
  context.fillStyle = gradient
  context.fillRect(0, 0, canvas.width, canvas.height)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
