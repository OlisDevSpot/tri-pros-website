import type { LayerId } from '@/features/meeting-visualizations/types'

// Scene units: one unit is roughly 3.5 ft, so the 8-unit span reads as a modest SoCal ranch.
// Roof-layer thicknesses are exaggerated past true scale; a 1/4 in shingle would be invisible.
export const SCENE = {
  halfSpan: 4,
  pitch: Math.atan(6 / 12),
  depth: 4.2,
  overhang: 0.55,
  wallHeight: 1.3,
  rafterDepth: 0.2,
  rafterWidth: 0.07,
  framingSpacing: 0.6,
  deckThickness: 0.05,
  membraneThickness: 0.014,
  shingleThickness: 0.03,
  tileRadius: 0.11,
  iceWaterReach: 0.9,
  /** Insulation and joists are drawn to true scale against each other, because "below the joist tops" is the tell. */
  unitsPerInch: 0.035,
  explodeGap: 0.38,
  roofLift: 0.55,
  entryLift: 1.6,
} as const

export const JOIST_DEPTH = 5.5 * SCENE.unitsPerInch
export const SLOPE_LENGTH = SCENE.halfSpan / Math.cos(SCENE.pitch)
export const RIDGE_HEIGHT = SCENE.halfSpan * Math.tan(SCENE.pitch)

/** Explode order outward from the rafters; the attic pair moves on its own axis. */
export const EXPLODE_INDEX: Record<LayerId, number> = {
  'rafters': 0,
  'deck': 1,
  'ice-water': 2,
  'underlayment': 3,
  'drip-edge': 4,
  'covering': 5,
  'ridge-vent': 6,
  'insulation': 1,
  'ceiling': 1,
}

/** Where each layer's numbered pin sits along the slope, spread so pins never stack. */
export const PIN_ALONG_SLOPE: Partial<Record<LayerId, number>> = {
  'rafters': 3.6,
  'deck': 3.0,
  'ice-water': 0.35,
  'underlayment': 2.3,
  'drip-edge': -0.5,
  'covering': 1.4,
}

// Material colours live here rather than in theme tokens: they describe physical materials under
// scene lighting, and the canvas does not read CSS.
export const MATERIAL_COLORS = {
  lumber: '#c39a63',
  lumberAged: '#8f6f47',
  plywood: '#d4b07a',
  plywoodAged: '#9c7d55',
  felt: '#2f2b28',
  synthetic: '#9fb4c8',
  iceWater: '#1f2a36',
  dripEdge: '#d5dde4',
  shingleNew: '#3b4048',
  shingleWorn: '#6e655b',
  tileNew: '#b8572f',
  tileWorn: '#8d5a43',
  ridgeVent: '#2d3238',
  insulationNew: '#efe8d8',
  insulationAged: '#c7a27c',
  drywall: '#e9e4da',
  wall: '#d8d1c4',
  gridCell: '#1f3b5c',
  gridSection: '#5cc6f2',
} as const
