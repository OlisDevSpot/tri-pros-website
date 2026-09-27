'use client'

import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { PlusIcon } from 'lucide-react'
import { useFieldArray, useFormContext } from 'react-hook-form'

import { EMPTY_LIABILITY } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { LiabilityRow } from '@/features/calculators/remodel-roi-calculator/ui/components/liability-row'
import { ProjectionNumberField } from '@/features/calculators/remodel-roi-calculator/ui/components/projection-number-field'
import { StepSection } from '@/features/calculators/remodel-roi-calculator/ui/components/step-section'
import { Button } from '@/shared/components/ui/button'

interface Props {
  heldFlatLiabilities: number[]
}

export function HomeAndLoansStep({ heldFlatLiabilities }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()
  const liabilities = useFieldArray({ control, name: 'liabilities' })

  return (
    <StepSection step={1} title="Home & loans">
      <ProjectionNumberField label="Home value today" name="homeValue" />
      {liabilities.fields.map((field, index) => (
        <LiabilityRow heldFlat={heldFlatLiabilities.includes(index)} index={index} key={field.id} onRemove={() => liabilities.remove(index)} />
      ))}
      <Button className="h-11 self-start" onClick={() => liabilities.append({ ...EMPTY_LIABILITY })} type="button" variant="outline">
        <PlusIcon />
        Add a loan
      </Button>
    </StepSection>
  )
}
