'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { useFormContext } from 'react-hook-form'

import { CURRENT_ROOF_TYPE_LABELS, CURRENT_ROOF_TYPES, NUM_STORIES_OPTIONS } from '@/features/calculators/scope-pricing-calculator/constants/project-context'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'

export function ProjectContextFields() {
  const { control } = useFormContext<ScopePricingFormValues>()

  return (
    <fieldset className="grid flex-1 grid-cols-2 gap-3">
      <legend className="sr-only">About the home</legend>
      <FormField
        control={control}
        name="context.numStories"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Number of stories</FormLabel>
            <Select onValueChange={value => field.onChange(Number(value))} value={String(field.value)}>
              <FormControl>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {NUM_STORIES_OPTIONS.map(option => <SelectItem key={option} value={String(option)}>{option}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name="context.currentRoofType"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Starting roof type</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="h-11 w-full"><SelectValue /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {CURRENT_ROOF_TYPES.map(option => <SelectItem key={option} value={option}>{CURRENT_ROOF_TYPE_LABELS[option]}</SelectItem>)}
              </SelectContent>
            </Select>
          </FormItem>
        )}
      />
    </fieldset>
  )
}
