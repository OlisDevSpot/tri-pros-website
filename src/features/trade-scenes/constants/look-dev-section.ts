import type { SectionLayer } from '@/features/trade-scenes/types'

export const SECTION_WIDTH = 3
export const SECTION_DEPTH = 2
export const SECTION_PITCH = Math.atan(6 / 12)
export const ROOF_RISE = 1.4

// Inside → out within each group. Thicknesses are exaggerated past true scale so thin membranes stay visible.
export const SECTION_LAYERS: readonly SectionLayer[] = [
  { id: 'drywall', label: 'Ceiling drywall', group: 'attic', thickness: 0.05, color: '#e9e4da', texture: 'smooth', temperature: { summer: { existing: [0.45, 0.55], proposed: [0.2, 0.25] }, winter: { existing: [0.8, 0.7], proposed: [0.82, 0.8] } } },
  { id: 'insulation', label: 'Attic insulation', group: 'attic', thickness: 0.3, color: '#c7a27c', texture: 'fiber', temperature: { summer: { existing: [0.55, 0.85], proposed: [0.25, 0.8] }, winter: { existing: [0.7, 0.2], proposed: [0.8, 0.1] } } },
  { id: 'rafters', label: 'Rafters', group: 'roof', thickness: 0.2, color: '#c39a63', texture: 'grain', temperature: { summer: { existing: [0.85, 0.9], proposed: [0.7, 0.72] }, winter: { existing: [0.2, 0.15], proposed: [0.12, 0.1] } } },
  { id: 'deck', label: 'Roof deck', group: 'roof', thickness: 0.06, color: '#d4b07a', texture: 'grain', temperature: { summer: { existing: [0.9, 0.93], proposed: [0.72, 0.75] }, winter: { existing: [0.15, 0.12], proposed: [0.1, 0.08] } } },
  { id: 'underlayment', label: 'Underlayment', group: 'roof', thickness: 0.02, color: '#2f2b28', texture: 'smooth', temperature: { summer: { existing: [0.93, 0.95], proposed: [0.75, 0.76] }, winter: { existing: [0.12, 0.1], proposed: [0.08, 0.07] } } },
  { id: 'shingles', label: 'Shingles', group: 'roof', thickness: 0.04, color: '#3b4048', texture: 'grit', temperature: { summer: { existing: [0.95, 1], proposed: [0.76, 0.78] }, winter: { existing: [0.1, 0.05], proposed: [0.07, 0.05] } } },
]

export const PROPOSED_INSULATION_THICKNESS = 0.55

// Faces the cut so every layer reads as a band and the flow shows where it crosses the open attic; from the
// default three-quarter view the roof's top face hides the attic.
export const LOOK_DEV_CAMERA = { fov: 30, position: [-3.5, 1.6, 11.5] as [number, number, number] }
export const LOOK_DEV_ORBIT_TARGET: [number, number, number] = [0, 1, 0]
