import type { GROUND_WEAR_LOOKS } from '@/features/trade-scenes/constants/ground-wear-looks'
import type { GroundLayer, GroundMaterialId, GroundSystemId, TextureSetId } from '@/features/trade-scenes/types'
import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import { LOT_PALETTE } from '@/features/trade-scenes/constants/home-lot'
import { HOME_PALETTE } from '@/features/trade-scenes/constants/home-palette'
import { wears } from '@/shared/modules/construction/core/constants/enums'

export const GROUND_MATERIAL_IDS = ['sod', 'dirt', 'concrete', 'asphalt', 'pavers', 'gravel', 'mulch', 'turf', 'pool', 'dg', 'river-rock'] as const

interface GroundMaterial {
  label: string
  sets: readonly GroundLayer[]
  system: GroundSystemId | null
  wears: boolean
  wearLook: keyof typeof GROUND_WEAR_LOOKS | null
  look: { color: string, roughness: number, raise: number, texture?: TextureSetId }
  catalog?: { scopeAccessor: string, materialAccessor: string }
}

// Colours other than the three taken from the scene's palettes are working numbers, tuned by eye.
export const GROUND_MATERIALS: Record<GroundMaterialId, GroundMaterial> = {
  'sod': { label: 'Sod lawn', sets: ['existing'], system: 'landscaping', wears: true, wearLook: 'lawn', look: { color: '#5f8a3c', roughness: 1, raise: 0, texture: 'sod-healthy' } },
  'dirt': { label: 'Bare dirt', sets: ['existing'], system: 'landscaping', wears: false, wearLook: null, look: { color: '#7a5f43', roughness: 1, raise: 0.02 } },
  'concrete': { label: 'Concrete', sets: ['existing', 'proposed'], system: 'hardscaping', wears: true, wearLook: 'paving', look: { color: HOME_PALETTE.path, roughness: 0.95, raise: 0.04, texture: 'concrete' }, catalog: { scopeAccessor: 'installConcrete', materialAccessor: 'concrete' } },
  'asphalt': { label: 'Asphalt', sets: ['existing'], system: 'hardscaping', wears: true, wearLook: 'paving', look: { color: LOT_PALETTE.asphalt, roughness: 1, raise: 0.04, texture: 'asphalt' } },
  'pavers': { label: 'Pavers', sets: ['existing', 'proposed'], system: 'hardscaping', wears: true, wearLook: 'paving', look: { color: '#a98f78', roughness: 0.9, raise: 0.04, texture: 'pavers-courtyard' }, catalog: { scopeAccessor: 'installPavers', materialAccessor: 'pavers' } },
  'gravel': { label: 'Gravel', sets: ['existing', 'proposed'], system: 'landscaping', wears: true, wearLook: 'loose', look: { color: '#b3aa9b', roughness: 1, raise: 0.02, texture: 'gravel' }, catalog: { scopeAccessor: 'installGravel', materialAccessor: 'gravel' } },
  'mulch': { label: 'Mulch', sets: ['existing', 'proposed'], system: 'landscaping', wears: true, wearLook: 'loose', look: { color: LOT_PALETTE.mulch, roughness: 1, raise: 0.03, texture: 'mulch' }, catalog: { scopeAccessor: 'installMulch', materialAccessor: 'redMulch' } },
  'turf': { label: 'Artificial turf', sets: ['existing', 'proposed'], system: 'landscaping', wears: true, wearLook: 'loose', look: { color: '#315c29', roughness: 0.95, raise: 0.015, texture: 'turf' }, catalog: { scopeAccessor: 'installArtificial', materialAccessor: 'artificialTurf' } },
  // A flat strip: one sunk under the opaque lawn would never show.
  'pool': { label: 'Pool', sets: ['existing'], system: null, wears: false, wearLook: null, look: { color: '#3d8fb5', roughness: 0.2, raise: 0.005 } },
  'dg': { label: 'Decomposed granite', sets: ['proposed'], system: 'landscaping', wears: true, wearLook: 'loose', look: { color: '#b89c6e', roughness: 1, raise: 0.02 }, catalog: { scopeAccessor: 'installDg', materialAccessor: 'decomposedGranite' } },
  // The seed has no scope of its own for river rock; it is installed as gravel.
  'river-rock': { label: 'River rock', sets: ['proposed'], system: 'landscaping', wears: true, wearLook: 'loose', look: { color: '#8c8a85', roughness: 1, raise: 0.02 }, catalog: { scopeAccessor: 'installGravel', materialAccessor: 'riverRocks' } },
}

export const GROUND_MATERIALS_BY_LAYER = {
  existing: GROUND_MATERIAL_IDS.filter(id => GROUND_MATERIALS[id].sets.includes('existing')),
  proposed: GROUND_MATERIAL_IDS.filter(id => GROUND_MATERIALS[id].sets.includes('proposed')),
} as const satisfies Record<GroundLayer, readonly GroundMaterialId[]>

export const GROUND_MATERIAL_INDEX = Object.fromEntries(
  GROUND_MATERIAL_IDS.map((id, i) => [id, i + 1]),
) as Record<GroundMaterialId, number>

export const PROPOSED_KEEP = 0

export const GROUND_WEAR_NONE = 0
export const DEFAULT_GROUND_WEAR: Wear = 'good'
export const GROUND_BASE = 'base'

export const GROUND_WEAR_INDEX = Object.fromEntries(
  wears.map((wear, i) => [wear, i + 1]),
) as Record<Wear, number>
