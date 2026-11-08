import type { SystemPartId } from '@/features/trade-scenes/types'
import type { DuctMaterial } from '@/shared/modules/construction/core/constants/enums'

import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { WINDOW_FRAME_COLORS } from '@/shared/modules/construction/core/constants/window-frame-colors'

interface PaneLook {
  // Metres across the wall.
  thickness: number
}

interface TintLook extends PaneLook {
  color: string
  opacity: number
}

type PaneId = Extract<SystemPartId, 'pane' | 'outer-pane' | 'inner-pane'>
type TintId = Extract<SystemPartId, 'screen' | 'low-e' | 'argon' | 'air-gap'>

// The glazing's system parts up close. The panes take their colour, opacity and gloss from the window's glass look, each of a
// pair a little clearer (PAIRED_PANE_OPACITY) so two of them still read as glass; the screen a fine dark mesh over the outer
// pane; the Low-E coating is a faint tinted film on the outer pane's inner face; argon a faint tint filling the gap between
// the panes, where the home's own double-pane holds only clear air. A gap's thickness stays short of the gap, clear of the
// film, so no two faces meet. Working numbers, set by eye.
export const PANE_LOOKS = {
  'pane': { thickness: 0.008 },
  'outer-pane': { thickness: 0.008 },
  'screen': { thickness: 0.004, color: '#1d1f20', opacity: 0.42 },
  'low-e': { thickness: 0.002, color: '#86b59c', opacity: 0.45 },
  'argon': { thickness: 0.036, color: '#a9a4ef', opacity: 0.16 },
  'air-gap': { thickness: 0.036, color: '#e6e3da', opacity: 0.06 },
  'inner-pane': { thickness: 0.008 },
} as const satisfies Record<PaneId, PaneLook> & Record<TintId, TintLook>

// The share of the window's glass opacity each pane of a pair keeps. A working number.
export const PAIRED_PANE_OPACITY = 0.8

// How far the screen stands off the outer pane, outward, in metres. A working number.
export const SCREEN_STANDOFF = 0.03

// What the seals and the flashing are drawn as round the window up close, with their colour new and at the Worn look: each
// seal bead's width on the wall and its thickness off the frame's face; the flashing's `thickness` is its lining band's width
// inside the opening. Working numbers, set by eye.
export const WINDOW_SEAL_LOOKS = {
  seals: { width: 0.02, thickness: 0.01, color: '#8f8d87', worn: '#5f564a' },
  flashing: { thickness: 0.003, color: '#2f3134', worn: '#4b453d' },
} as const satisfies Record<Extract<SystemPartId, 'seals' | 'flashing'>, { thickness: number, color: string, worn: string }> & { seals: { width: number } }

// A duct's make-up as shares of the run's drawn radius, inside out: the core on its coil, the insulation blanket round it,
// the jacket outside, adding up to the whole radius so the jacket stands where the house draws the run. The rating is the
// blanket, so R-8's is the thickest. `crush` is the share of its height an original run has sagged flat under years in the
// attic. Working numbers, set by eye.
export const DUCT_WRAP_LOOKS = {
  'original-flex': { core: 0.72, blanket: 0.2, jacket: 0.08, crush: 0.22 },
  'r6-silver-flex': { core: 0.55, blanket: 0.38, jacket: 0.07, crush: 0 },
  'r8-flex': { core: 0.46, blanket: 0.48, jacket: 0.06, crush: 0 },
} as const satisfies Record<DuctMaterial, { core: number, blanket: number, jacket: number, crush: number }>

// The core's plastic liner, the wire coil it is wound on (the wire's radius and the coil's pitch, in metres), and the
// fiberglass blanket new and at the Worn look. Working numbers, set by eye.
export const DUCT_PIECE_LOOKS = {
  core: { color: '#3c3e41', roughness: 0.55 },
  coil: { color: '#9a9ea1', radius: 0.0035, pitch: 0.035, roughness: 0.4, metalness: 0.6 },
  blanket: { color: '#e8cf72', worn: '#a8956f', roughness: 0.95 },
} as const

type FrameLookId = 'aluminum' | 'vinyl'

// The one original frame draws by the glass it holds: aluminum round single-pane, the common old window, and vinyl round
// double-pane.
export const ORIGINAL_FRAME_LOOK = { 'single-pane': 'aluminum', 'double-pane': 'vinyl' } as const satisfies Record<string, FrameLookId>

// A working number apiece for the sheen: aluminum a dull metal, vinyl a matte plastic.
export const FRAME_LOOKS = {
  aluminum: { color: HOME_PALETTE.aluminum, roughness: 0.45, metalness: 0.45 },
  vinyl: { color: WINDOW_FRAME_COLORS.white.outside, roughness: 0.7, metalness: 0 },
} as const satisfies Record<FrameLookId, { color: string, roughness: number, metalness: number }>
