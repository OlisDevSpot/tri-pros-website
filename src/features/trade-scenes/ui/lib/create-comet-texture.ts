import { CanvasTexture, SRGBColorSpace } from 'three'

import { HEAT_ARROW_LOOK } from '@/features/trade-scenes/constants/heat-arrow-look'

const WIDTH = 256
const HEIGHT = 96
// The comet's own units run from its tail at -24 to its tip at 7; a 40-unit canvas centred on that span leaves room on
// both ends for the glow.
const PIXELS_PER_UNIT = WIDTH / 40
const MIDDLE = -8.5
// A canvas shadowBlur is twice the blur's deviation, and the picked mockup's glow deviates 1.4 units.
const GLOW_BLUR = 2 * 1.4 * PIXELS_PER_UNIT

function withAlpha(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16)
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`
}

// The tail and the notched head, in the comet's own units.
function drawComet(context: CanvasRenderingContext2D) {
  const { head, tip, tail } = HEAT_ARROW_LOOK.colors
  const tailFill = context.createLinearGradient(-24, 0, -3, 0)
  tailFill.addColorStop(0, withAlpha(tail, 0))
  tailFill.addColorStop(1, withAlpha(tip, 0.95))
  context.fillStyle = tailFill
  context.beginPath()
  context.moveTo(-24, 0)
  context.lineTo(-3, -2.4)
  context.lineTo(-3, 2.4)
  context.closePath()
  context.fill()

  const headFill = context.createLinearGradient(-5, 0, 7, 0)
  headFill.addColorStop(0, head)
  headFill.addColorStop(1, tip)
  context.fillStyle = headFill
  context.strokeStyle = tip
  context.lineWidth = 0.6
  context.lineJoin = 'round'
  context.beginPath()
  context.moveTo(7, 0)
  context.lineTo(-5, -6)
  context.lineTo(-2, 0)
  context.lineTo(-5, 6)
  context.closePath()
  context.fill()
  context.stroke()
}

// The comet arrow, pointing along +x, drawn in code once so no image is downloaded. The quad that shows it must keep the
// canvas's aspect, `HEIGHT / WIDTH`.
export function createCometTexture(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const context = canvas.getContext('2d')!
  context.translate(WIDTH / 2 - MIDDLE * PIXELS_PER_UNIT, HEIGHT / 2)
  context.scale(PIXELS_PER_UNIT, PIXELS_PER_UNIT)
  // A canvas shadow is the one blur every tablet browser draws, so it lays the glow. A shadow lands over whatever was drawn
  // before it, the stroke's over the head's own fill, so the glow goes down in a pass of its own and the shapes are drawn
  // again, crisp, on top.
  context.shadowColor = HEAT_ARROW_LOOK.colors.tail
  context.shadowBlur = GLOW_BLUR
  drawComet(context)
  context.shadowBlur = 0
  drawComet(context)

  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
