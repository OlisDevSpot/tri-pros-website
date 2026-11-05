import type { LookDevOptions } from '@/features/trade-scenes/types'
import type { RibbonStyle } from '@/shared/components/scene/constants/ribbon-styles'
import type { ThermalSeason, ThermalStyle } from '@/shared/components/scene/constants/thermal-palettes'
import type { SceneRenderer } from '@/shared/components/scene/types'

export const MATERIAL_TREATMENTS = ['clay', 'textured', 'studio'] as const
export type MaterialTreatment = typeof MATERIAL_TREATMENTS[number]
export const MATERIAL_TREATMENT_LABELS = { clay: 'Clay model', textured: 'True materials', studio: 'Studio' } as const satisfies Record<MaterialTreatment, string>

export const LOOK_DEV_VIEWS = ['existing', 'proposed'] as const
export type LookDevView = typeof LOOK_DEV_VIEWS[number]
export const LOOK_DEV_VIEW_LABELS = { existing: 'Today', proposed: 'Tri Pros build' } as const satisfies Record<LookDevView, string>

export const HEAT_STATES = ['off', 'on'] as const
export type HeatState = typeof HEAT_STATES[number]
export const HEAT_STATE_LABELS = { off: 'Off', on: 'On' } as const satisfies Record<HeatState, string>

export const LOOK_DEV_SEASONS = ['summer', 'winter'] as const satisfies readonly ThermalSeason[]
export const LOOK_DEV_RENDERERS = ['webgl', 'webgpu'] as const satisfies readonly SceneRenderer[]

export const THERMAL_STYLE_LABELS = { ironbow: 'Ironbow', arctic: 'Arctic', ember: 'Ember' } as const satisfies Record<ThermalStyle, string>
export const RIBBON_STYLE_LABELS = { stream: 'Stream', dashes: 'Dashes', glow: 'Glow' } as const satisfies Record<RibbonStyle, string>
export const RENDERER_LABELS = { webgl: 'WebGL', webgpu: 'WebGPU' } as const satisfies Record<SceneRenderer, string>
export const SEASON_LABELS = { summer: 'Summer', winter: 'Winter' } as const satisfies Record<ThermalSeason, string>

export const LOOK_DEV_DEFAULTS = {
  treatment: 'textured',
  thermalStyle: 'ironbow',
  ribbonStyle: 'stream',
  renderer: 'webgl',
  season: 'summer',
  view: 'existing',
  heat: false,
  emphasized: null,
} as const satisfies LookDevOptions
