import type { PartMaterialDefinition } from '@/shared/modules/construction/core/types'

export function fillBenefitText(text: string, material: PartMaterialDefinition): string {
  const { label } = material.copy
  const noun = label.startsWith('R-') ? label : label.charAt(0).toLowerCase() + label.slice(1)
  return text.replaceAll('{material}', noun).replaceAll('{rValue}', `R-${material.thermal?.rValue}`)
}
