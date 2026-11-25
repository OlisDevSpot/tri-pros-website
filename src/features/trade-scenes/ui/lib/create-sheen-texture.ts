import { CanvasTexture, RepeatWrapping } from 'three'

import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

const SIZE = 128
// How many streaks one tile holds, each `width` pixels wide and `length` long, fading to `tail` of its strength at its uphill
// end, over a faint `film` of water across the whole tile. A streak a pixel wide mips away to nothing from the street, so each
// is two or three. A working number, set by shot.
const STREAKS = 70
const WIDTH = [2, 3] as const
const LENGTH = [12, 48] as const
const TAIL = 0.2
const FILM = 0.12

function grey(strength: number): string {
  const value = Math.round(strength * 255)
  return `rgb(${value}, ${value}, ${value})`
}

// Water running down a roof in thin streaks of varied length, brightest at the front of each. A strength in grey for the
// material's alphaMap, as the rot stain keeps its own: a canvas keeps no colour under a fully clear pixel, so a white-on-clear
// map would darken each streak's edge as it mips down.
export function createSheenTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')!
  context.fillStyle = grey(FILM)
  context.fillRect(0, 0, SIZE, SIZE)
  context.globalCompositeOperation = 'lighten'
  const random = seededRandom(23)
  for (let index = 0; index < STREAKS; index++) {
    const width = WIDTH[0] + Math.round(random() * (WIDTH[1] - WIDTH[0]))
    const x = 1 + Math.floor(random() * (SIZE - 1 - width))
    const tail = random() * SIZE
    const length = LENGTH[0] + random() * (LENGTH[1] - LENGTH[0])
    // The texture is flipped onto the roof, so the canvas's top is downhill: each streak's front is its top end. Drawn again
    // a tile above and below, so a streak across the edge carries on into the next tile.
    for (const shift of [-SIZE, 0, SIZE]) {
      const from = tail + shift
      const gradient = context.createLinearGradient(0, from, 0, from - length)
      gradient.addColorStop(0, grey(TAIL))
      gradient.addColorStop(1, grey(1))
      context.fillStyle = gradient
      context.fillRect(x, from - length, width, length)
    }
  }
  const texture = new CanvasTexture(canvas)
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  // From the street the slope is seen at a glancing angle, and a plain mipmap blurs the streaks across as it shrinks them
  // down the slope; three clamps this to what the device offers. A working number, set by shot.
  texture.anisotropy = 8
  // Its grey is a strength, not a colour, so it stays out of sRGB.
  return texture
}
