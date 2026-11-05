import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

export type NoiseKind = 'grain' | 'grit' | 'fiber'

// Seeded so a texture looks the same on every open; procedural so no image is downloaded.
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

export function createNoiseTexture(kind: NoiseKind, base: string, seed = 7, size = 256): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  context.fillStyle = base
  context.fillRect(0, 0, size, size)
  const random = seeded(seed)
  if (kind === 'grain') {
    for (let line = 0; line < 70; line++) {
      context.strokeStyle = `rgba(60, 35, 10, ${0.05 + random() * 0.12})`
      context.lineWidth = 0.5 + random() * 1.5
      const y = random() * size
      context.beginPath()
      context.moveTo(0, y)
      context.bezierCurveTo(size * 0.3, y + random() * 8 - 4, size * 0.7, y + random() * 8 - 4, size, y + random() * 6 - 3)
      context.stroke()
    }
  }
  else {
    const count = kind === 'grit' ? 9000 : 2500
    for (let dot = 0; dot < count; dot++) {
      const light = random() > 0.5
      context.fillStyle = light ? `rgba(255, 255, 255, ${random() * 0.18})` : `rgba(0, 0, 0, ${random() * 0.25})`
      const radius = kind === 'grit' ? 0.6 + random() : 1 + random() * 3
      context.fillRect(random() * size, random() * size, radius, kind === 'fiber' ? radius * 4 : radius)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  texture.colorSpace = SRGBColorSpace
  return texture
}
