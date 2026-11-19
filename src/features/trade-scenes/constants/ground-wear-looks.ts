import type { LOT_PALETTE } from '@/features/trade-scenes/constants/home-lot'

interface GroundWearStep {
  tint: keyof typeof LOT_PALETTE
  mix: number
  marks: number
  breaks: number
}

// New and Good draw the material's own look, so only the three steps past Good are here. A lawn's marks are bare-soil
// patches as a share of its area; paving's marks are cracks per 4 m square and its breaks the broken share. Working
// numbers, tuned by eye.
export const GROUND_WEAR_LOOKS = {
  lawn: {
    fair: { tint: 'dryGrass', mix: 0.15, marks: 0, breaks: 0 },
    worn: { tint: 'dryGrass', mix: 0.4, marks: 0.1, breaks: 0 },
    failing: { tint: 'dryGrass', mix: 0.7, marks: 0.3, breaks: 0 },
  },
  paving: {
    fair: { tint: 'stain', mix: 0.15, marks: 0, breaks: 0 },
    worn: { tint: 'stain', mix: 0.3, marks: 6, breaks: 0 },
    failing: { tint: 'stain', mix: 0.45, marks: 14, breaks: 0.1 },
  },
  loose: {
    fair: { tint: 'fade', mix: 0.15, marks: 0, breaks: 0 },
    worn: { tint: 'fade', mix: 0.3, marks: 0, breaks: 0 },
    failing: { tint: 'fade', mix: 0.5, marks: 0, breaks: 0 },
  },
} as const satisfies Record<'lawn' | 'paving' | 'loose', Record<'fair' | 'worn' | 'failing', GroundWearStep>>

// A worn lawn lies on the ground strip, which is the lawn itself, so it sits just clear of it.
export const WORN_LAWN_RAISE = 0.005
