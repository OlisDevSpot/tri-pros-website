import type { WornStep } from '@/features/trade-scenes/types'

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'

import { GROUND_WEAR_LOOKS } from '@/features/trade-scenes/constants/ground-wear-looks'
import { LOT_PALETTE } from '@/features/trade-scenes/constants/home-lot'
import { seededRandom } from '@/features/trade-scenes/lib/seeded-random'

type MarkedLook = 'lawn' | 'paving'

const SIZE = 512
// The wear looks count cracks per 4 m square, so the canvas covers one.
const TILE_METRES = 4
const STAIN_SHARE = 0.12
const STEP_SEEDS: Record<WornStep, number> = { fair: 11, worn: 23, failing: 37 }

// A mark drawn across the canvas's edge is drawn again on the far side, so the square tiles without a seam.
function wrapped(draw: (dx: number, dy: number) => void) {
  for (const dx of [-SIZE, 0, SIZE]) {
    for (const dy of [-SIZE, 0, SIZE]) {
      draw(dx, dy)
    }
  }
}

function patches(context: CanvasRenderingContext2D, random: () => number, share: number, colour: string, radius: [number, number]) {
  let covered = 0
  context.fillStyle = colour
  while (covered < share * SIZE * SIZE) {
    const x = random() * SIZE
    const y = random() * SIZE
    const rx = radius[0] + random() * (radius[1] - radius[0])
    const ry = rx * (0.5 + random() * 0.5)
    const turn = random() * Math.PI
    wrapped((dx, dy) => {
      context.beginPath()
      context.ellipse(x + dx, y + dy, rx, ry, turn, 0, Math.PI * 2)
      context.fill()
    })
    covered += Math.PI * rx * ry
  }
}

function crack(context: CanvasRenderingContext2D, random: () => number) {
  const points: [number, number][] = [[random() * SIZE, random() * SIZE]]
  let heading = random() * Math.PI * 2
  const segments = 4 + Math.floor(random() * 5)
  for (let s = 0; s < segments; s++) {
    heading += (random() - 0.5) * 1.2
    const length = 14 + random() * 26
    const [x, y] = points[points.length - 1]
    points.push([x + Math.cos(heading) * length, y + Math.sin(heading) * length])
  }
  wrapped((dx, dy) => {
    context.beginPath()
    points.forEach(([x, y], p) => (p === 0 ? context.moveTo(x + dx, y + dy) : context.lineTo(x + dx, y + dy)))
    context.stroke()
  })
}

function drawLawn(context: CanvasRenderingContext2D, random: () => number, step: WornStep) {
  context.globalAlpha = 0.85
  patches(context, random, GROUND_WEAR_LOOKS.lawn[step].marks, LOT_PALETTE.bareSoil, [14, 40])
}

function drawPaving(context: CanvasRenderingContext2D, random: () => number, step: WornStep) {
  const { tint, mix, marks, breaks } = GROUND_WEAR_LOOKS.paving[step]
  // The stains cover a fixed share; how much they show is the step's mix.
  context.globalAlpha = mix
  patches(context, random, STAIN_SHARE, LOT_PALETTE[tint], [24, 70])
  context.globalAlpha = 0.6
  patches(context, random, breaks, LOT_PALETTE.crack, [16, 36])
  context.globalAlpha = 0.9
  context.strokeStyle = LOT_PALETTE.crack
  context.lineWidth = 2
  context.lineJoin = 'round'
  for (let i = 0; i < marks; i++) {
    crack(context, random)
  }
}

function drawsNothing(look: MarkedLook, step: WornStep): boolean {
  const { mix, marks, breaks } = GROUND_WEAR_LOOKS[look][step]
  return look === 'lawn' ? marks <= 0 : mix <= 0 && marks <= 0 && breaks <= 0
}

// Flat marks on a clear canvas, laid over the texture, seeded so a step looks the same on every render. A step with no
// marks makes no overlay, so it costs no extra draw.
export function createWearMarksTexture(look: MarkedLook, wear: WornStep): CanvasTexture | null {
  if (drawsNothing(look, wear)) {
    return null
  }
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const context = canvas.getContext('2d')!
  const random = seededRandom(STEP_SEEDS[wear])
  if (look === 'lawn') {
    drawLawn(context, random, wear)
  }
  else {
    drawPaving(context, random, wear)
  }
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  texture.wrapS = RepeatWrapping
  texture.wrapT = RepeatWrapping
  // A region strip's UVs are in metres.
  texture.repeat.set(1 / TILE_METRES, 1 / TILE_METRES)
  texture.anisotropy = 8
  return texture
}
