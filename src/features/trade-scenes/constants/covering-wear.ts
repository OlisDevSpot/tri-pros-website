import type { CoveringWear } from '@/features/trade-scenes/types'
import type { CoveringWearKind, RoofType, Wear } from '@/shared/modules/construction/core/constants/enums'

export const COVERING_WEAR_START = {
  new: { cracked: 'none', misaligned: 'none', broken: 'none', missing: 'none', curling: 'none', split: 'none' },
  good: { cracked: 'none', misaligned: 'none', broken: 'none', missing: 'none', curling: 'none', split: 'none' },
  fair: { cracked: 'light', misaligned: 'light', broken: 'none', missing: 'none', curling: 'light', split: 'light' },
  worn: { cracked: 'moderate', misaligned: 'moderate', broken: 'light', missing: 'moderate', curling: 'moderate', split: 'moderate' },
  failing: { cracked: 'heavy', misaligned: 'heavy', broken: 'moderate', missing: 'heavy', curling: 'heavy', split: 'heavy' },
} satisfies Record<Wear, CoveringWear>

// A roof can list no kinds: metal is drawn as shingle but its rep sets nothing, and a flat roof's membrane has no wear a rep can set.
export const COVERING_WEAR_KINDS_BY_ROOF = {
  tile: ['cracked', 'misaligned', 'broken'],
  shingle: ['missing', 'curling'],
  woodshake: ['split', 'curling'],
  flat: [],
  metal: [],
} as const satisfies Record<RoofType, readonly CoveringWearKind[]>

// How an old tile roof goes wrong. Working numbers, set by eye against the scene; the rates are the share of tiles and the
// jitter every tile's own scatter (metres, radians) at Moderate, the Worn look; each level multiplies them by its paint-wear
// share, so Heavy runs a third higher. `slipped` replaces the scatter for the few tiles that have slid down.
export const TILE_WEAR = {
  crackedRate: 0.1,
  brokenRate: 0.035,
  jitter: { x: 0.012, z: 0.014, yaw: 0.03, tilt: 0.025 },
  slippedRate: 0.1,
  slipped: { x: [0.03, 0.08], z: 0.03, yaw: 0.14, tilt: -0.16 },
  // How much of the roof's wear a replacement tile has taken on.
  replacementFreshness: 0.55,
} as const

// A cracked tile's dark line and a broken tile's missing corner. Working numbers, set by eye against the scene: the crack's
// half width and wander are metres, its place a share of the exposed part; the corner's reach is how far into the exposed
// part and across it the break runs, as a share of each.
export const TILE_MARKS = {
  crackHalfWidth: 0.0012,
  crackDarkness: 0.72,
  crackWander: 0.006,
  crackAt: [0.3, 0.8],
  breakReach: [0.45, 0.85],
  breakJag: 0.05,
  // The crack's wander and the break's jag are sums of sines: each row is [frequency, amplitude, phase per piece mark]. The
  // rows' frequencies are deliberately unrelated, so the line never repeats along itself.
  crackWaves: [[9, 1, 50], [23, 0.6, 90], [61, 0.4, 0]],
  breakWaves: [[31, 1, 40], [73, 0.5, 17]],
} as const
