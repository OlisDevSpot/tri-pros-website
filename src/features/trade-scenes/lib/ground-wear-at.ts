import type { Wear } from '@/shared/modules/construction/core/constants/enums'
import { wears } from '@/shared/modules/construction/core/constants/enums'

export function groundWearAt(value: number): Wear | null {
  return wears[value - 1] ?? null
}
