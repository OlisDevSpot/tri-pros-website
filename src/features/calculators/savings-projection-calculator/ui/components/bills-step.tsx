'use client'

import { BILL_CATEGORIES, BILL_CATEGORY_LABELS } from '@/features/calculators/savings-projection-calculator/constants/bill-categories'
import { ProjectionNumberField } from '@/features/calculators/savings-projection-calculator/ui/components/projection-number-field'
import { StepSection } from '@/features/calculators/savings-projection-calculator/ui/components/step-section'

interface Props {
  group: 'billsNow' | 'billsAfter'
  step: number
  title: string
}

export function BillsStep({ group, step, title }: Props) {
  return (
    <StepSection step={step} title={title}>
      <div className="grid gap-3 sm:grid-cols-2">
        {BILL_CATEGORIES.map(category => (
          <ProjectionNumberField key={category} label={BILL_CATEGORY_LABELS[category]} name={`${group}.${category}`} suffix="/mo" />
        ))}
      </div>
    </StepSection>
  )
}
