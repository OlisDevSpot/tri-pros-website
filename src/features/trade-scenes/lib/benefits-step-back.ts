import type { BenefitsState } from '@/features/trade-scenes/types'

// Closes the innermost open layer; null when none is left, so Escape falls through to closing the window.
export function benefitsStepBack(state: BenefitsState): BenefitsState | null {
  if (state.whyOpen) {
    return { ...state, whyOpen: false }
  }
  if (state.costsOpen) {
    return { ...state, costsOpen: false }
  }
  if (state.selection !== null) {
    return { ...state, selection: null }
  }
  return null
}
