'use client'

import { RATE_KEYS, RATE_LABELS } from '@/features/calculators/savings-projection-calculator/constants/rates'
import { ProjectionNumberField } from '@/features/calculators/savings-projection-calculator/ui/components/projection-number-field'
import { StepSection } from '@/features/calculators/savings-projection-calculator/ui/components/step-section'

export function AssumptionsStep() {
  return (
    <StepSection step={5} title="Assumptions">
      <ProjectionNumberField label="Years to project" max={30} min={1} name="assumptions.horizonYears" step={1} />
      <div className="grid gap-3 sm:grid-cols-2">
        {RATE_KEYS.map(key => (
          <ProjectionNumberField
            key={key}
            label={RATE_LABELS[key]}
            max={50}
            min={-20}
            name={`assumptions.ratesPercent.${key}`}
            step={0.1}
            suffix="%/yr"
          />
        ))}
      </div>
    </StepSection>
  )
}
