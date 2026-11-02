import type { StartingHomeHeat, WeatherHeatEffects } from '@/features/trade-scenes/types'
import type { Climate } from '@/shared/modules/construction/core/constants/climate-presets'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'
import type { HeatWeather } from '@/shared/modules/construction/core/types'

// Working numbers, tuned at the owner's review: every figure in this file is hand-set, not computed.
export const STARTING_HOME_HEAT: Record<Climate, Record<HeatWeather, StartingHomeHeat>> = {
  coastal: {
    normal: {
      readings: { 'roof': 103.9, 'attic': 92.9, 'ceiling': 78.5, 'exterior-wall': 85, 'window': 80 },
      flows: { roofSource: 0.35, roofPasses: [0.85, 0.6], wall: 0.17, window: 0.26 },
      load: 0.16,
    },
    summer: {
      readings: { 'roof': 148.3, 'attic': 123.4, 'ceiling': 83.2, 'exterior-wall': 106, 'window': 86 },
      flows: { roofSource: 0.85, roofPasses: [0.85, 0.6], wall: 0.4, window: 0.65 },
      load: 0.42,
    },
    winter: {
      readings: { 'roof': 40.7, 'attic': 43.7, 'ceiling': 65.8, 'exterior-wall': 46, 'window': 55 },
      flows: { roofSource: 0.7, roofPasses: [0.6, 0.9], wall: 0.4, window: 0.65 },
      load: 0.55,
    },
  },
  inland: {
    normal: {
      readings: { 'roof': 107.9, 'attic': 96.7, 'ceiling': 79.3, 'exterior-wall': 89, 'window': 81 },
      flows: { roofSource: 0.4, roofPasses: [0.85, 0.6], wall: 0.2, window: 0.3 },
      load: 0.19,
    },
    summer: {
      readings: { 'roof': 166.1, 'attic': 140.2, 'ceiling': 86, 'exterior-wall': 124, 'window': 92 },
      flows: { roofSource: 1, roofPasses: [0.85, 0.6], wall: 0.5, window: 0.8 },
      load: 0.55,
    },
    winter: {
      readings: { 'roof': 33.8, 'attic': 37.2, 'ceiling': 65, 'exterior-wall': 40, 'window': 50 },
      flows: { roofSource: 0.85, roofPasses: [0.6, 0.9], wall: 0.5, window: 0.8 },
      load: 0.61,
    },
  },
}

// A part id maps to its material, or 'absent' for a part drawn with no material, then to what that does in each weather.
export const PART_HEAT_EFFECTS: Readonly<Record<string, Readonly<Record<string, WeatherHeatEffects>>>> = {
  // Insulation lies under the attic's air, so on a mild or hot day it leaves the attic as hot as it was and holds the heat
  // off the ceiling; only on a winter night, by keeping the rooms' heat out, does it cool the attic.
  'attic-insulation': {
    'absent': {
      normal: { readings: { ceiling: 3.1 }, flows: { roofPasses: [1, 1.4] }, load: 1.3 },
      summer: { readings: { ceiling: 6.9 }, flows: { roofPasses: [1, 1.4] }, load: 1.3 },
      winter: { readings: { roof: 1.2, attic: 3, ceiling: -4.2 }, flows: { roofSource: 1.15, roofPasses: [1.4, 1] }, load: 1.25 },
    },
    'batts-r19': {
      normal: { readings: { ceiling: -1.2 }, flows: { roofPasses: [1, 0.8] }, load: 0.8 },
      summer: { readings: { ceiling: -2.8 }, flows: { roofPasses: [1, 0.8] }, load: 0.8 },
      winter: { readings: { roof: -0.8, attic: -2, ceiling: 1.4 }, flows: { roofSource: 0.85, roofPasses: [0.8, 1] }, load: 0.8 },
    },
    'batts-r30': {
      normal: { readings: { ceiling: -1.9 }, flows: { roofPasses: [1, 0.65] }, load: 0.63 },
      summer: { readings: { ceiling: -4.2 }, flows: { roofPasses: [1, 0.65] }, load: 0.63 },
      winter: { readings: { roof: -1.4, attic: -3.5, ceiling: 2.2 }, flows: { roofSource: 0.75, roofPasses: [0.65, 1] }, load: 0.63 },
    },
    'blown-r38': {
      normal: { readings: { ceiling: -2.5 }, flows: { roofPasses: [1, 0.5] }, load: 0.55 },
      summer: { readings: { ceiling: -5.6 }, flows: { roofPasses: [1, 0.5] }, load: 0.55 },
      winter: { readings: { roof: -2, attic: -5, ceiling: 2.8 }, flows: { roofSource: 0.6, roofPasses: [0.5, 1] }, load: 0.55 },
    },
  },
  'radiant-barrier': {
    foil: {
      normal: { readings: { attic: -6, ceiling: -0.6 }, bounce: { barrier: 0.35 }, flows: { roofPasses: [0.85, 1] }, load: 0.4 },
      summer: { readings: { attic: -13, ceiling: -1.4 }, bounce: { barrier: 0.5 }, flows: { roofPasses: [0.9, 1] }, load: 0.4 },
      winter: { flows: { roofPasses: [1, 0.85] }, load: 0.85 },
    },
  },
  'covering': {
    'cool-shingle': {
      normal: { readings: { roof: -6, attic: -2.7, ceiling: -0.4 }, bounce: { covering: 0.25 }, load: 0.78 },
      summer: { readings: { roof: -13, attic: -6, ceiling: -0.8 }, bounce: { covering: 0.3 }, load: 0.78 },
    },
    'tile': {
      normal: { readings: { roof: -5.3, attic: -1 }, flows: { roofSource: 0.85 }, load: 0.85 },
      summer: { readings: { roof: -11.7, attic: -1.8, ceiling: -0.3 }, flows: { roofSource: 0.85 }, load: 0.85 },
      winter: { readings: { attic: -0.7 } },
    },
    'wood-shake': {
      normal: { readings: { roof: 2.8, attic: 5.4, ceiling: 0.8 }, flows: { roofSource: 1.1 }, load: 1.12 },
      summer: { readings: { roof: 6.4, attic: 12.3, ceiling: 1.9 }, flows: { roofSource: 1.1 }, load: 1.12 },
      winter: { readings: { attic: -1 } },
    },
    'membrane': {
      normal: { readings: { attic: 0.8 } },
      summer: { readings: { attic: 2, ceiling: 0.3 } },
      winter: { readings: { attic: -0.2 } },
    },
    'cool-membrane': {
      normal: { readings: { roof: -21.7, attic: -13.4, ceiling: -2.2 }, bounce: { covering: 0.5 }, load: 0.3 },
      summer: { readings: { roof: -48, attic: -29.5, ceiling: -4.7 }, bounce: { covering: 0.6 }, load: 0.3 },
    },
  },
  // Double pane's and Cool Life's summer bounce is set so the coast's weaker sun still turns back one whole arrow.
  'glazing': {
    'double-pane': {
      normal: { readings: { window: -4 }, flows: { windowPasses: 0.45 }, load: 0.95 },
      summer: { readings: { window: -10 }, flows: { windowPasses: 0.65 }, bounce: { window: 0.31 }, load: 0.93 },
      winter: { readings: { window: 12 }, flows: { windowPasses: 0.45 }, load: 0.93 },
    },
  },
  'paint': {
    cool: {
      normal: { readings: { 'exterior-wall': -6 }, bounce: { wall: 0.25 }, load: 0.97 },
      summer: { readings: { 'exterior-wall': -14 }, bounce: { wall: 0.5 }, load: 0.95 },
    },
  },
  // New ducts lower the load the heating and cooling lane carries.
  'duct-runs': {
    'r6-silver-flex': {
      normal: { load: 0.95 },
      summer: { load: 0.93 },
      winter: { load: 0.93 },
    },
    'r8-flex': {
      normal: { load: 0.94 },
      summer: { load: 0.91 },
      winter: { load: 0.91 },
    },
  },
  'air-sealing': {
    sealed: {
      normal: { readings: { ceiling: -0.3 }, flows: { roofPasses: [1, 0.92] }, load: 0.95 },
      summer: { readings: { ceiling: -0.6 }, flows: { roofPasses: [1, 0.92] }, load: 0.95 },
      winter: { readings: { attic: -0.5, ceiling: 0.8 }, flows: { roofSource: 0.9 }, load: 0.9 },
    },
  },
}

// The fan's thermostat reads the attic before the fan's own effect, so the fan can't switch itself off by cooling the attic.
export const ATTIC_FAN_ON_ABOVE = 100

// Kept out of PART_HEAT_EFFECTS because it applies only while Running, after every part's effect has set the attic's reading.
export const ATTIC_FAN_HEAT_EFFECTS: WeatherHeatEffects = {
  normal: { readings: { attic: -6, ceiling: -0.4 }, load: 0.96 },
  summer: { readings: { attic: -20, ceiling: -1.5 }, load: 0.9 },
}

// The starting home is a vented attic. A flat roof's joist space is shallow and barely vented, so the deck's heat has
// little air to spread into and nowhere to leave by: the space runs hotter and the ceiling under it far hotter, and on a
// winter night the thin space holds back less of the cold.
export const ROOF_FORM_HEAT_EFFECTS: Partial<Record<RoofForm, WeatherHeatEffects>> = {
  'low-slope': {
    normal: { readings: { attic: 7, ceiling: 6 }, flows: { roofPasses: [1.1, 1.35] }, load: 1.3 },
    summer: { readings: { attic: 16, ceiling: 14 }, flows: { roofPasses: [1.1, 1.35] }, load: 1.35 },
    winter: { readings: { attic: -3, ceiling: -4 }, flows: { roofPasses: [1.2, 1.1] }, load: 1.15 },
  },
}

export const METER_LEVEL: Record<HeatWeather, number> = { normal: 0.4, summer: 1, winter: 0.5 }

// Below this a lane carries nothing worth an arrow.
export const HEAT_FLOW_STOPPED = 0.02

// Arrows per lane at flow 1, and metres per second along the lane.
export const HEAT_ARROW_SCALE = { arrowsAtFull: 5, speedAtFull: 1.2, speedAtLeast: 0.35 }

export const BOUNCE_MAX = 0.9
