import type { FormPartId } from '@/features/proposal-flow/constants/form-parts'
import { parseAsStringLiteral, useQueryState } from 'nuqs'
import { FORM_PART_IDS } from '@/features/proposal-flow/constants/form-parts'

export function useFormPart() {
  const [part, setPart] = useQueryState('formTab', parseAsStringLiteral(FORM_PART_IDS))
  const activePart: FormPartId = part ?? 'general'

  return { part, activePart, setPart }
}
