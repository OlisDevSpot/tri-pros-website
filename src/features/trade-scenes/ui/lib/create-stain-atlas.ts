import type { StainCell } from '@/features/trade-scenes/types'

import { CanvasTexture } from 'three'

import { WEAR_LOOKS } from '@/features/trade-scenes/constants/wear-looks'

type Stops = readonly (readonly [number, number])[]

const CELL = 128
const CELLS: readonly StainCell[] = ['splash', 'streak', 'blotch']
// Blank columns between the cells, so a far mip level never bleeds one stain's edge into its neighbour's.
const GUTTER = 8
const WIDTH = CELL * CELLS.length

// Each cell's span across the atlas, inside its gutters, for the UVs of the stains drawn from it.
export const STAIN_CELL_U = Object.fromEntries(CELLS.map((cell, index) => [cell, [(index * CELL + GUTTER) / WIDTH, ((index + 1) * CELL - GUTTER) / WIDTH] as const])) as Record<StainCell, readonly [number, number]>

function grey(strength: number): string {
  const value = Math.round(strength * 255)
  return `rgb(${value}, ${value}, ${value})`
}

function fill(gradient: CanvasGradient, stops: Stops): CanvasGradient {
  for (const [offset, strength] of stops) {
    gradient.addColorStop(offset, grey(strength))
  }
  return gradient
}

// The stains' soft shapes drawn in code, side by side: the splash darkest at grade and fading up with no line, the streak
// feathered across and at both ends, the blotch a soft disc. Each is a strength in grey for the material's alphaMap: a canvas
// keeps no colour under a fully clear pixel, so a white-on-clear map would darken every stain's edge as it mips down.
export function createStainAtlas(): CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = CELL
  const context = canvas.getContext('2d')!
  context.fillStyle = grey(0)
  context.fillRect(0, 0, WIDTH, CELL)
  const { splash, streakAcross, streakDown, blotch } = WEAR_LOOKS.paint.stainAtlas
  const [splashX, streakX, blotchX] = CELLS.map((_, index) => index * CELL + GUTTER)
  const inner = CELL - GUTTER * 2

  // The canvas runs top down and the texture bottom up, so each strength from the foot is drawn from the canvas's bottom.
  context.fillStyle = fill(context.createLinearGradient(0, CELL, 0, 0), splash)
  context.fillRect(splashX, 0, inner, CELL)

  context.fillStyle = fill(context.createLinearGradient(streakX, 0, streakX + inner, 0), streakAcross)
  context.fillRect(streakX, 0, inner, CELL)
  context.globalCompositeOperation = 'multiply'
  context.fillStyle = fill(context.createLinearGradient(0, CELL, 0, 0), streakDown)
  context.fillRect(streakX, 0, inner, CELL)
  context.globalCompositeOperation = 'source-over'

  const centre = blotchX + inner / 2
  context.fillStyle = fill(context.createRadialGradient(centre, CELL / 2, 0, centre, CELL / 2, inner / 2), blotch)
  context.fillRect(blotchX, 0, inner, CELL)

  // Its grey is a strength, not a colour, so it stays out of sRGB.
  return new CanvasTexture(canvas)
}
