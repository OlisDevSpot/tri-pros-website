import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

// Turf that varies: blade strokes in several greens, dry flecks and the odd tired patch, drawn in code so no image is
// downloaded. Seeded, so every visit draws the same lawn.
export function createLawnTexture(): CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  context.fillStyle = '#6b8a3c'
  context.fillRect(0, 0, size, size)
  const random = seededRandom(7)
  for (let i = 0; i < 9; i++) {
    context.fillStyle = `rgba(${150 + random() * 40}, ${150 + random() * 30}, 70, 0.10)`
    context.beginPath()
    context.ellipse(random() * size, random() * size, 30 + random() * 70, 20 + random() * 50, random() * 3, 0, Math.PI * 2)
    context.fill()
  }
  const greens = ['#5a7a32', '#7a9a48', '#668a3a', '#86a352', '#4f6e2c', '#93ad5c']
  for (let i = 0; i < 14000; i++) {
    context.strokeStyle = greens[Math.floor(random() * greens.length)]
    context.globalAlpha = 0.55
    const x = random() * size
    const y = random() * size
    context.beginPath()
    context.moveTo(x, y)
    context.lineTo(x + (random() - 0.5) * 3, y - 2 - random() * 4)
    context.stroke()
  }
  context.globalAlpha = 0.7
  for (let i = 0; i < 260; i++) {
    context.fillStyle = random() > 0.5 ? '#b9b071' : '#a29a5e'
    context.fillRect(random() * size, random() * size, 1.5, 1.5)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  // The ground's UVs already count its tiles, so the texture repeats once per tile.
  texture.repeat.set(1, 1)
  texture.anisotropy = 8
  return texture
}
