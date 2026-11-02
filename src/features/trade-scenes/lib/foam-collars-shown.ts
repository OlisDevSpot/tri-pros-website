import type { RoofForm } from '@/shared/modules/construction/core/constants/roof-forms'

// Foam closes the gaps before any insulation goes down, and every blanket buries it; a flat roof has no attic to seal.
export function foamCollarsShown(form: RoofForm, sealing: string | null, insulation: string | null): boolean {
  return form === 'pitched' && sealing !== null && insulation === null
}
