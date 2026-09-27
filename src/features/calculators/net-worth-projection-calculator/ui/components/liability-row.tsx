'use client'

import type { NetWorthProjectionFormValues } from '@/features/calculators/net-worth-projection-calculator/schemas/form'

import { Trash2Icon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

import { ProjectionNumberField } from '@/features/calculators/net-worth-projection-calculator/ui/components/projection-number-field'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { Input } from '@/shared/components/ui/input'

interface Props {
  index: number
  heldFlat: boolean
  onRemove: () => void
}

export function LiabilityRow({ index, heldFlat, onRemove }: Props) {
  const { control } = useFormContext<NetWorthProjectionFormValues>()

  return (
    <div className="flex flex-col gap-2 rounded-lg bg-muted/40 p-3">
      <div className="flex items-end gap-2">
        <FormField
          control={control}
          name={`liabilities.${index}.label`}
          render={({ field }) => (
            <FormItem className="flex-1">
              <FormLabel>Loan</FormLabel>
              <FormControl>
                <Input className="h-11" maxLength={60} placeholder="e.g. Car loan" {...field} />
              </FormControl>
            </FormItem>
          )}
        />
        <Button aria-label="Remove loan" className="size-11" onClick={onRemove} size="icon" type="button" variant="ghost">
          <Trash2Icon />
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <ProjectionNumberField label="Balance" name={`liabilities.${index}.balance`} />
        <ProjectionNumberField label="Payment" name={`liabilities.${index}.monthlyPayment`} suffix="/mo" />
        <ProjectionNumberField label="APR, if known" max={40} name={`liabilities.${index}.aprPercent`} step={0.01} suffix="%/yr" />
      </div>
      {heldFlat && <p className="text-xs text-muted-foreground">Held at today&apos;s balance in the projection.</p>}
    </div>
  )
}
