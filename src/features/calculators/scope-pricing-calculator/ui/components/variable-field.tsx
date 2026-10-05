'use client'

import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'
import type { VariableDef, VariableKey } from '@/features/calculators/scope-pricing-calculator/types'

import { useFormContext } from 'react-hook-form'

import { VARIABLES } from '@/features/calculators/scope-pricing-calculator/constants/variables'
import { describeVariableIssue } from '@/features/calculators/scope-pricing-calculator/lib/describe-variable-issue'
import { formatVariableOption } from '@/features/calculators/scope-pricing-calculator/lib/format-variable-option'
import { FormControl, FormField, FormItem, FormLabel } from '@/shared/components/ui/form'
import { NumberField } from '@/shared/components/ui/number-field'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { Switch } from '@/shared/components/ui/switch'

interface Props {
  lineIndex: number
  variableKey: VariableKey
  flagged: boolean
}

export function VariableField({ lineIndex, variableKey, flagged }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()
  const def: VariableDef = VARIABLES[variableKey]

  return (
    <FormField
      control={control}
      name={`lines.${lineIndex}.variables.${variableKey}`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{def.label}</FormLabel>
          {def.kind === 'number' && (
            <FormControl>
              <NumberField
                className="h-11"
                inputMode="decimal"
                max={def.max}
                min={def.min}
                name={field.name}
                onBlur={field.onBlur}
                onChange={field.onChange}
                ref={field.ref}
                value={typeof field.value === 'number' ? field.value : null}
              />
            </FormControl>
          )}
          {def.kind === 'select' && (
            <Select
              onValueChange={next => field.onChange(def.options.find(option => String(option) === next) ?? null)}
              value={field.value == null ? '' : String(field.value)}
            >
              <FormControl>
                <SelectTrigger className="h-11 w-full"><SelectValue placeholder="Choose" /></SelectTrigger>
              </FormControl>
              <SelectContent>
                {def.options.map(option => (
                  <SelectItem key={String(option)} value={String(option)}>{formatVariableOption(def, option)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {def.kind === 'boolean' && (
            <div className="flex h-11 items-center">
              <FormControl>
                <Switch checked={field.value === true} onCheckedChange={field.onChange} />
              </FormControl>
            </div>
          )}
          {flagged && <p className="text-sm text-destructive">{describeVariableIssue(def, field.value)}</p>}
        </FormItem>
      )}
    />
  )
}
