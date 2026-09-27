'use client'

import type { UpliftMode } from '@/features/calculators/savings-projection-calculator/constants/uplift-modes'
import type { SavingsProjectionFormValues } from '@/features/calculators/savings-projection-calculator/schemas/form'

import { useFormContext, useWatch } from 'react-hook-form'

import { UPLIFT_MODE_LABELS, UPLIFT_MODES } from '@/features/calculators/savings-projection-calculator/constants/uplift-modes'
import { ProjectionNumberField } from '@/features/calculators/savings-projection-calculator/ui/components/projection-number-field'
import { StepSection } from '@/features/calculators/savings-projection-calculator/ui/components/step-section'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'

export function ProjectStep() {
  const { control } = useFormContext<SavingsProjectionFormValues>()
  const upliftMode = useWatch({ control, name: 'project.uplift.mode' })

  return (
    <StepSection step={4} title="The project">
      <div className="grid gap-3 sm:grid-cols-3">
        <ProjectionNumberField label="Project price" name="project.price" />
        <ProjectionNumberField label="Incentives" name="project.incentives" />
        <ProjectionNumberField label="Down payment" name="project.downPayment" />
        <ProjectionNumberField label="Loan APR" max={40} name="project.aprPercent" step={0.01} suffix="%/yr" />
        <ProjectionNumberField label="Loan term (0 = cash)" max={480} name="project.termMonths" step={1} suffix="months" />
      </div>
      <div className="flex items-end gap-3">
        <FormField
          control={control}
          name="project.uplift.mode"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Home value added</FormLabel>
              <FormControl>
                <ToggleGroup
                  onValueChange={(value) => {
                    if (value) {
                      field.onChange(value as UpliftMode)
                    }
                  }}
                  type="single"
                  value={field.value}
                  variant="outline"
                >
                  {UPLIFT_MODES.map(mode => (
                    <ToggleGroupItem className="h-11 px-3" key={mode} value={mode}>{UPLIFT_MODE_LABELS[mode]}</ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </FormControl>
            </FormItem>
          )}
        />
        <div className="flex-1">
          <ProjectionNumberField
            label={upliftMode === 'amount' ? 'Amount' : 'Percent of project price'}
            name="project.uplift.value"
            suffix={upliftMode === 'amount' ? undefined : '%'}
          />
        </div>
      </div>
    </StepSection>
  )
}
