import type { FenceKindId, GroundLayer, GroundMaterialId, GroundSystemId } from '@/features/trade-scenes/types'
import { FENCE_KINDS } from '@/features/trade-scenes/constants/fence-kinds'
import { GROUND_MATERIALS, GROUND_MATERIALS_BY_LAYER } from '@/features/trade-scenes/constants/ground-materials'
import { YARD_SYSTEM_LABELS } from '@/features/trade-scenes/constants/home-scene-copy'
import { GROUND_SYSTEM_IDS } from '@/features/trade-scenes/constants/yards'

export interface LotOption<T extends string> { value: T, label: string, group?: string }

export function groundLabel(id: GroundMaterialId): string {
  return GROUND_MATERIALS[id].label
}

export function fenceLabel(id: FenceKindId): string {
  return FENCE_KINDS[id].label
}

export function groundOptions(ids: readonly GroundMaterialId[], group?: string): readonly LotOption<GroundMaterialId>[] {
  return ids.map(id => ({ value: id, label: groundLabel(id), group }))
}

export function fenceOptions(ids: readonly FenceKindId[]): readonly LotOption<FenceKindId>[] {
  return ids.map(id => ({ value: id, label: fenceLabel(id) }))
}

export function systemMaterials(system: GroundSystemId, layer: GroundLayer): readonly GroundMaterialId[] {
  return GROUND_MATERIALS_BY_LAYER[layer].filter(id => GROUND_MATERIALS[id].system === system)
}

// Built system by system, so a menu opens each system's heading once. Pool belongs to no system: it is a place, not a
// base a yard starts from, so it drops out.
export function yardBaseOptions(): readonly LotOption<GroundMaterialId>[] {
  return GROUND_SYSTEM_IDS.flatMap(system => groundOptions(systemMaterials(system, 'existing'), YARD_SYSTEM_LABELS[system]))
}
