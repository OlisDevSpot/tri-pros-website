export const THERMAL_STYLES = ['ironbow', 'arctic', 'ember'] as const
export type ThermalStyle = typeof THERMAL_STYLES[number]

export type ThermalSeason = 'summer' | 'winter'

// Cold → hot, five stops each. Winter reads the same temperatures on a cooler ramp so the season change is
// visible at a glance even where a part's temperature barely moves.
export const THERMAL_PALETTES = {
  ironbow: {
    summer: ['#0b0630', '#4b0f6b', '#b3204d', '#f2711c', '#fff3a8'],
    winter: ['#06142e', '#123f73', '#2f86b8', '#c9a75b', '#fff1c4'],
  },
  arctic: {
    summer: ['#0a1a3a', '#1f5fa8', '#e6e6e6', '#f2994a', '#d7263d'],
    winter: ['#041026', '#0d4a8c', '#59b7e8', '#e9f4ff', '#ffd27a'],
  },
  ember: {
    summer: ['#141414', '#3a2a1f', '#8a3b12', '#e0661a', '#ffd166'],
    winter: ['#0e1726', '#233a5c', '#4f7fae', '#d9a066', '#ffe2a8'],
  },
} as const satisfies Record<ThermalStyle, Record<ThermalSeason, readonly [string, string, string, string, string]>>
