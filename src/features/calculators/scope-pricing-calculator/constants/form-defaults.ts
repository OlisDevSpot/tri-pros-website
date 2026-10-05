import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

export const SCOPE_PRICING_FORM_DEFAULTS: ScopePricingFormValues = {
  context: { numStories: 1, currentRoofType: 'shingle' },
  lines: [],
  agent: { multiplier: null, targetPrice: null },
}
