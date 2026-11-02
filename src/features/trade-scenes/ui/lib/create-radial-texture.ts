import { CanvasTexture, SRGBColorSpace } from 'three'

const SIZE = 128

// A soft disc drawn in code (a haze, a water stain), so no image is downloaded. Stops run from the centre (0) to the rim (1).
export function createRadialTexture(stops: readonly (readonly [number, string])[]): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')!
  const gradient = context.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 2)
  for (const [offset, colour] of stops) {
    gradient.addColorStop(offset, colour)
  }
  context.fillStyle = gradient
  context.fillRect(0, 0, SIZE, SIZE)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
