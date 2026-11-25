'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext, useFormState, useWatch } from 'react-hook-form'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'

export function PricingModeSettings() {
  const form = useFormContext<ProposalFormSchema>()
  const pricingMode = useWatch({ control: form.control, name: 'priceDisplayMode' })
  const { disabled } = useFormState({ control: form.control })

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">General</p>
        <div className="flex items-center justify-between">
          <Label htmlFor="pricing-mode" className="text-sm font-normal">
            Breakdown Pricing
          </Label>
          <Switch
            id="pricing-mode"
            checked={pricingMode === 'breakdown'}
            disabled={disabled}
            onCheckedChange={checked =>
              form.setValue('priceDisplayMode', checked ? 'breakdown' : 'total', { shouldDirty: true })}
          />
        </div>
      </div>
    </div>
  )
}
