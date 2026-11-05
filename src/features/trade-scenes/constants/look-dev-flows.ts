import type { HandSetFlow } from '@/features/trade-scenes/types'
import type { ThermalSeason } from '@/shared/components/scene/constants/thermal-palettes'

// Hand-set until relativeHeatFlow drives the widths: summer pours in through the roof and narrows in the
// insulation; winter leaks up and out of the living space.
export const LOOK_DEV_FLOWS = {
  summer: { points: [[-0.9, 3.4, 0], [-0.5, 1.9, 0], [-0.2, 0.6, 0], [0, -0.5, 0]], widths: { existing: [0.34, 0.3, 0.24, 0.18], proposed: [0.34, 0.2, 0.08, 0.02] } },
  winter: { points: [[0, -0.5, 0], [0.2, 0.6, 0], [0.5, 1.9, 0], [0.9, 3.4, 0]], widths: { existing: [0.3, 0.26, 0.22, 0.2], proposed: [0.3, 0.1, 0.04, 0.02] } },
} as const satisfies Record<ThermalSeason, HandSetFlow>

// The cool roof sends part of the summer flow back to the sky.
export const LOOK_DEV_REFLECTED_FLOW = { points: [[-0.5, 1.9, 0], [-0.1, 2.8, 0], [0.6, 3.6, 0]], widths: [0.12, 0.08, 0.03] } as const satisfies Omit<HandSetFlow, 'widths'> & { widths: readonly number[] }

export const FLOW_COLORS = { summer: '#ff7a2f', winter: '#5cc6f2' } as const satisfies Record<ThermalSeason, string>
