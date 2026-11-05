import { CanvasTexture, SRGBColorSpace } from 'three'

import { THERMOSTAT_DISPLAY } from '@/features/trade-scenes/constants/home-life'

// The setpoint drawn in code onto the thermostat's face, so the scene loads no font file.
export function createThermostatTexture(setpoint: number): CanvasTexture {
  const [width, height] = THERMOSTAT_DISPLAY.pixels
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  context.fillStyle = THERMOSTAT_DISPLAY.text
  context.font = `600 ${Math.round(height * 0.62)}px system-ui, sans-serif`
  context.textAlign = 'center'
  context.textBaseline = 'middle'
  context.fillText(`${setpoint}°`, width * 0.46, height * 0.54)
  const texture = new CanvasTexture(canvas)
  texture.colorSpace = SRGBColorSpace
  return texture
}
