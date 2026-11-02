export const RIBBON_STYLES = ['stream', 'dashes', 'glow'] as const
export type RibbonStyle = typeof RIBBON_STYLES[number]

export const RIBBON_STYLE_UNIFORMS = {
  stream: { stripes: 6, sharpness: 0, amplitude: 0.45 },
  dashes: { stripes: 14, sharpness: 1, amplitude: 0.8 },
  glow: { stripes: 2, sharpness: 0, amplitude: 0.15 },
} as const satisfies Record<RibbonStyle, { stripes: number, sharpness: number, amplitude: number }>
