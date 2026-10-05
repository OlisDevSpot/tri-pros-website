import type { Control } from 'react-hook-form'
import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { useMemo } from 'react'
import { useWatch } from 'react-hook-form'

import { priceQuote } from '@/features/calculators/scope-pricing-calculator/lib/price-quote'
import { solveMultiplier } from '@/features/calculators/scope-pricing-calculator/lib/solve-multiplier'

export function useScopePricingQuote(control: Control<ScopePricingFormValues>, config: ScopePricingConfig) {
  const [context, lines, agent] = useWatch({ control, name: ['context', 'lines', 'agent'] })

  return useMemo(() => {
    const input = { lines, context, config }
    const solved = agent.targetPrice == null ? null : solveMultiplier(agent.targetPrice, input)
    const multiplier = solved != null && solved.status !== 'no-cost' ? solved.multiplier : agent.multiplier
    return { quote: priceQuote({ ...input, overrides: { multiplier } }), solved }
  }, [context, lines, agent, config])
}
