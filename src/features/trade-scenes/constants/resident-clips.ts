import type { Comfort, GestureSpec, ResidentAct, ResidentFigure, ResidentGesture, ResidentPose } from '@/features/trade-scenes/types'

const AT_EASE: ResidentAct = { gesture: null, blanket: false }

// The pack's figures have idle and sitting clips only, so strain and the leak show as code-built gestures layered over them.
// Fair comfort reads as at ease: only a strain the readings call out should change what the residents do.
export const RESIDENT_CLIPS = {
  normal: { strained: { gesture: 'fan', blanket: false }, fair: AT_EASE, comfortable: AT_EASE },
  summer: { strained: { gesture: 'fan', blanket: false }, fair: AT_EASE, comfortable: AT_EASE },
  winter: { strained: { gesture: 'shiver', blanket: true }, fair: AT_EASE, comfortable: AT_EASE },
  rain: { leaking: { gesture: 'look-up', blanket: false }, dry: AT_EASE },
} as const satisfies { normal: Record<Comfort, ResidentAct>, summer: Record<Comfort, ResidentAct>, winter: Record<Comfort, ResidentAct>, rain: Record<'leaking' | 'dry', ResidentAct> }

// Sitting opens with the move from standing onto the seat, so a seated resident's clip starts once the seat is taken.
export const RESIDENT_BASE_CLIPS = {
  seated: { clip: 'Sitting', from: 1 },
  standing: { clip: 'Idle', from: 0 },
} as const satisfies Record<ResidentPose, { clip: string, from: number }>

export const RESIDENT_FIGURES = {
  man: { url: '/scenes/home/resident-adult.glb', clipPrefix: 'HumanArmature|Man_' },
  woman: { url: '/scenes/home/resident-adult-2.glb', clipPrefix: 'HumanArmature|Female_' },
} as const satisfies Record<ResidentFigure, { url: string, clipPrefix: string }>

// On the pack's skeleton a spine bone's x bends it forward and the right upper arm's z lifts it to the front. Found by
// posing the figures, not from the pack's notes: re-check them if the figures are swapped.
export const RESIDENT_GESTURES = {
  // A hand fanning the face, the body slumped a little in the heat.
  'fan': {
    seconds: 0.4,
    hold: { UpperArmR: [30, 0, 60], LowerArmR: [0, 0, 120], Abdomen: [9, 0, 0], Neck: [6, 0, 0] },
    swings: [
      { bone: 'PalmR', axis: 0, degrees: 38, cycles: 1 },
      { bone: 'LowerArmR', axis: 1, degrees: 9, cycles: 1 },
    ],
  },
  // Hunched against the cold, with a fine shiver through the trunk.
  'shiver': {
    seconds: 1,
    hold: { Abdomen: [14, 0, 0], Torso: [6, 0, 0], Neck: [8, 0, 0] },
    swings: [
      { bone: 'Torso', axis: 1, degrees: 2.4, cycles: 8 },
      { bone: 'Abdomen', axis: 2, degrees: 1.4, cycles: 7 },
    ],
  },
  // Looking up at the stain, the head following the drips.
  'look-up': {
    seconds: 3,
    hold: { Neck: [-16, 0, 0], Head: [-22, 0, 0] },
    swings: [{ bone: 'Head', axis: 1, degrees: 9, cycles: 1 }],
  },
} as const satisfies Record<ResidentGesture, GestureSpec>
