'use client'

import type { IntakeFormData } from '@/features/intake/schemas/intake-form-schema'
import { useFormContext } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

interface ClosedByFieldProps {
  options: string[]
}

export function ClosedByField({ options }: ClosedByFieldProps) {
  const form = useFormContext<IntakeFormData>()

  return (
    <FormField
      control={form.control}
      name="closedBy"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Closed By</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select agent…" />
            </SelectTrigger>
            <SelectContent>
              {options.map(name => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
