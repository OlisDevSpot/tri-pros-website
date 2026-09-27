'use client'

import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'
import type { RemodelRoiProjection } from '@/features/calculators/remodel-roi-calculator/types'

import { useFieldArray, useFormContext } from 'react-hook-form'

import { createOtherLiability } from '@/features/calculators/remodel-roi-calculator/constants/form-defaults'
import { LiabilityRow } from '@/features/calculators/remodel-roi-calculator/ui/components/inputs-panel/liability-row'
import { FormNumberField } from '@/shared/components/inputs/form-number-field'
import { Button } from '@/shared/components/ui/button'

interface Props {
  projection: RemodelRoiProjection
}

export function HomeAndLoansSection({ projection }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'liabilities' })
  return (
    <>
      <p className="text-[12.5px] leading-snug text-muted-foreground">Home value and loans are the same on both paths, so they don't change the comparison. They add total net worth to the story.</p>
      <FormNumberField control={control} label="Home value today" name="homeValue" prefix="$" />
      {fields.map((field, index) => (
        <LiabilityRow
          heldFlat={projection.liabilities.find(liability => liability.index === index)?.heldFlat ?? false}
          index={index}
          isMortgage={field.kind === 'mortgage'}
          key={field.id}
          onRemove={() => remove(index)}
        />
      ))}
      <Button className="min-h-11 justify-self-start" onClick={() => append(createOtherLiability())} type="button" variant="outline">+ Add a loan</Button>
    </>
  )
}
