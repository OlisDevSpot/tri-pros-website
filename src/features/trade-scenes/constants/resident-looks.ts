import type { BoxSpec, ResidentAge, ResidentPose } from '@/features/trade-scenes/types'

// Matte, in the home's restrained warm palette; picked by cast order so two residents never dress alike.
export const RESIDENT_OUTFITS = [
  { top: '#6f8ea6', accent: '#d9cbb4', bottom: '#4a4e57', shoes: '#3b3835' },
  { top: '#b8735a', accent: '#e8dcc8', bottom: '#5a4c42', shoes: '#433a34' },
  { top: '#8a9a6c', accent: '#d8cfb8', bottom: '#57524a', shoes: '#3b3835' },
  { top: '#c9a35e', accent: '#efe6d4', bottom: '#4f5763', shoes: '#463d36' },
  { top: '#8f7aa0', accent: '#e3d9cb', bottom: '#4a4e57', shoes: '#3b3835' },
] as const

export const RESIDENT_SKIN = ['#c99a78', '#9c6b4f', '#e2bc98', '#b5845f', '#7e5139'] as const

// How old the adults look is carried by the hair.
export const RESIDENT_HAIR = {
  young: '#3a2a20',
  middle: '#6a5646',
  senior: '#d8d2c8',
} as const satisfies Record<ResidentAge, string>

export const RESIDENT_EYES = '#2b2623'

export const BLANKET_COLORS = ['#b5654a', '#8e9e6e', '#c9a25a', '#7f93a8', '#a7716f'] as const

// In adult metres, figure-local (+z is where the resident faces): one soft bundle from the shoulders to the lap when seated
// (two pieces read as a chair), a wrap round the shoulders standing. A child's is scaled with the child.
export const BLANKET_BOXES = {
  seated: [
    { size: [0.5, 0.56, 0.44], position: [0, 0.72, -0.1] },
  ],
  standing: [
    { size: [0.46, 0.44, 0.3], position: [0, 1.22, 0.01] },
  ],
} as const satisfies Record<ResidentPose, readonly BoxSpec[]>
