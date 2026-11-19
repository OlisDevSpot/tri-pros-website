import type { GroundMaterialId } from '@/features/trade-scenes/types'
import { GROUND_MATERIAL_IDS } from '@/features/trade-scenes/constants/ground-materials'

export function groundMaterialAt(value: number): GroundMaterialId | null {
  return GROUND_MATERIAL_IDS[value - 1] ?? null
}
