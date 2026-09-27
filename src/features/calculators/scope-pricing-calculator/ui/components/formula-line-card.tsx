'use client'

import type { PricingKey } from '@/features/calculators/scope-pricing-calculator/constants/pricing-keys'
import type { QuoteLineResult } from '@/features/calculators/scope-pricing-calculator/types'

import { FORMULAS } from '@/features/calculators/scope-pricing-calculator/lib/formula-registry'
import { LineActions } from '@/features/calculators/scope-pricing-calculator/ui/components/line-actions'
import { LinePrice } from '@/features/calculators/scope-pricing-calculator/ui/components/line-price'
import { VariableField } from '@/features/calculators/scope-pricing-calculator/ui/components/variable-field'
import { Card } from '@/shared/components/ui/card'

interface Props {
  index: number
  pricingKey: PricingKey
  result: QuoteLineResult | undefined
  onDuplicate: () => void
  onRemove: () => void
}

export function FormulaLineCard({ index, pricingKey, result, onDuplicate, onRemove }: Props) {
  const formula = FORMULAS[pricingKey]
  const needs = result?.status === 'incomplete' ? result.needs : []

  return (
    <Card className="gap-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">{formula.label}</h3>
          <p className="text-sm text-muted-foreground">{formula.outcome}</p>
        </div>
        <LinePrice result={result} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {formula.variables.map(key => (
          <VariableField flagged={needs.includes(key)} key={key} lineIndex={index} variableKey={key} />
        ))}
      </div>
      <LineActions onDuplicate={onDuplicate} onRemove={onRemove} />
    </Card>
  )
}
