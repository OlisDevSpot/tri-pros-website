'use client'

import type { RemodelRoiFormValues } from '@/features/calculators/remodel-roi-calculator/schemas/form'

import { XIcon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

import { FormNumberField } from '@/shared/components/inputs/form-number-field'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'

interface Props {
  index: number
  isMortgage: boolean
  heldFlat: boolean
  onRemove: () => void
}

export function LiabilityRow({ index, isMortgage, heldFlat, onRemove }: Props) {
  const { control } = useFormContext<RemodelRoiFormValues>()
  return (
    <div className="grid gap-2.5 rounded-lg bg-muted/60 p-3">
      <div className="flex items-end gap-1.5">
        {isMortgage
          ? <b className="flex-1 text-sm font-semibold">Mortgage</b>
          : (
              <FormField
                control={control}
                name={`liabilities.${index}.label`}
                render={({ field }) => (
                  <FormItem className="flex-1">
                    <FormLabel className="sr-only">Loan name</FormLabel>
                    <FormControl><Input className="h-11" maxLength={60} placeholder="Car loan, credit card…" {...field} /></FormControl>
                  </FormItem>
                )}
              />
            )}
        {!isMortgage && <Button aria-label="Remove loan" className="size-11" onClick={onRemove} size="icon" type="button" variant="ghost"><XIcon /></Button>}
      </div>
      <div className="grid grid-cols-[1.2fr_1fr_0.8fr] gap-2">
        <FormNumberField control={control} label="Balance" name={`liabilities.${index}.balance`} prefix="$" />
        <FormNumberField control={control} label="Payment" name={`liabilities.${index}.monthlyPayment`} prefix="$" suffix="/mo" />
        <FormNumberField control={control} label="APR" max={40} name={`liabilities.${index}.aprPercent`} step={0.01} suffix="%" />
      </div>
      {heldFlat && <p className="text-xs text-muted-foreground">Held at today's balance in the projection.</p>}
    </div>
  )
}
