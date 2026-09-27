'use client'

import type { ScopePricingConfig } from '@/features/calculators/scope-pricing-calculator/schemas/config'
import type { ScopePricingFormValues } from '@/features/calculators/scope-pricing-calculator/schemas/form'

import { MinusIcon, PlusIcon } from 'lucide-react'
import { useFormContext } from 'react-hook-form'

import { MULTIPLIER_STEP } from '@/features/calculators/scope-pricing-calculator/constants/agent-panel'
import { stepMultiplier } from '@/features/calculators/scope-pricing-calculator/lib/step-multiplier'
import { Button } from '@/shared/components/ui/button'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/shared/components/ui/form'
import { NumberField } from '@/shared/components/ui/number-field'
import { formatMultiplier } from '@/shared/modules/proposals/core/lib/financials/tiers'

interface Props {
  config: ScopePricingConfig
  appliedMultiplier: number
  targetActive: boolean
}

export function MultiplierControl({ config, appliedMultiplier, targetActive }: Props) {
  const { control } = useFormContext<ScopePricingFormValues>()
  const { floor } = config.multiplier

  return (
    <FormField
      control={control}
      name="agent.multiplier"
      render={({ field }) => {
        const current = field.value ?? config.multiplier.default
        return (
          <FormItem>
            <FormLabel>Multiplier</FormLabel>
            <div className="flex items-center gap-2">
              <Button
                aria-label="Lower the multiplier"
                className="size-11"
                disabled={targetActive || current <= floor}
                onClick={() => field.onChange(stepMultiplier(current, -MULTIPLIER_STEP, floor))}
                size="icon"
                type="button"
                variant="outline"
              >
                <MinusIcon />
              </Button>
              <FormControl>
                <NumberField
                  {...field}
                  className="h-11 text-center"
                  disabled={targetActive}
                  inputMode="decimal"
                  min={floor}
                  placeholder={String(config.multiplier.default)}
                  step={MULTIPLIER_STEP}
                />
              </FormControl>
              <Button
                aria-label="Raise the multiplier"
                className="size-11"
                disabled={targetActive}
                onClick={() => field.onChange(stepMultiplier(current, MULTIPLIER_STEP, floor))}
                size="icon"
                type="button"
                variant="outline"
              >
                <PlusIcon />
              </Button>
            </div>
            <FormDescription>
              {targetActive
                ? `Set by the target price: ${formatMultiplier(appliedMultiplier)}`
                : `Floor ${formatMultiplier(floor)} · default ${formatMultiplier(config.multiplier.default)}`}
            </FormDescription>
            <FormMessage />
            {field.value != null && !targetActive && (
              <Button className="self-start px-0" onClick={() => field.onChange(null)} type="button" variant="link">
                Back to the default
              </Button>
            )}
          </FormItem>
        )
      }}
    />
  )
}
