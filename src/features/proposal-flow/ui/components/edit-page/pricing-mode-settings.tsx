'use client'

import type { ProposalFormSchema } from '@/features/proposal-flow/schemas/form-schema'
import { useFormContext, useWatch } from 'react-hook-form'
import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'

export function PricingModeSettings() {
  const form = useFormContext<ProposalFormSchema>()
  const pricingMode = useWatch({ control: form.control, name: 'priceDisplayMode' })

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
            onCheckedChange={checked =>
              form.setValue('priceDisplayMode', checked ? 'breakdown' : 'total')}
          />
        </div>
      </div>
    </div>
  )
}
