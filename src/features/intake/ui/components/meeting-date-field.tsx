'use client'

import type { IntakeFormData } from '@/features/intake/schemas/intake-form-schema'
import { useFormContext } from 'react-hook-form'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'

export function MeetingDateField() {
  const form = useFormContext<IntakeFormData>()

  return (
    <FormField
      control={form.control}
      name="scheduledFor"
      render={({ field }) => (
        <FormItem>
          <FormLabel>
            {'Appointment Date & Time '}
            <span className="text-destructive">*</span>
          </FormLabel>
          <DateTimePicker
            value={field.value ? new Date(field.value) : undefined}
            onChange={d => field.onChange(d?.toISOString() ?? '')}
            placeholder="Select date & time"
            className="w-full justify-start border border-input bg-background px-3 py-2 h-9 text-sm"
          />
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
