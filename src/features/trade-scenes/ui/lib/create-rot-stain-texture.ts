import { CanvasTexture } from 'three'

import { CUTAWAY_ROT } from '@/features/trade-scenes/constants/look-inside'

const SIZE = 128

function grey(strength: number): string {
  const value = Math.round(strength * 255)
  return `rgb(${value}, ${value}, ${value})`
}

// A water stain's soft, uneven shape: each lobe a gradient fading out from its centre, the strongest of them kept at every pixel,
// so the overlap reads as one blot with a wandering edge. A strength in grey for the material's alphaMap, as the paint stains
// keep theirs: a canvas keeps no colour under a fully clear pixel, so a white-on-clear map would darken the edge as it mips down.
export function createRotStainTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')!
  context.fillStyle = grey(0)
  context.fillRect(0, 0, SIZE, SIZE)
  context.globalCompositeOperation = 'lighten'
  for (const [x, y, radius, strength] of CUTAWAY_ROT.stain.lobes) {
    const gradient = context.createRadialGradient(x * SIZE, y * SIZE, 0, x * SIZE, y * SIZE, radius * SIZE)
    for (const [offset, stop] of CUTAWAY_ROT.stain.stops) {
      gradient.addColorStop(offset, grey(stop * strength))
    }
    context.fillStyle = gradient
    context.fillRect(0, 0, SIZE, SIZE)
  }
  // Its grey is a strength, not a colour, so it stays out of sRGB.
  return new CanvasTexture(canvas)
}
