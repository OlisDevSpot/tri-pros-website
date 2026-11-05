import type { RoofType } from '@/shared/modules/construction/core/constants/enums'
import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

export function roofFormOf(roofType: RoofType): RoofForm
export function roofFormOf(roofType: RoofType | null): RoofForm | null
export function roofFormOf(roofType: RoofType | null): RoofForm | null {
  if (roofType === null) {
    return null
  }
  return roofType === 'flat' ? 'low-slope' : 'pitched'
}
