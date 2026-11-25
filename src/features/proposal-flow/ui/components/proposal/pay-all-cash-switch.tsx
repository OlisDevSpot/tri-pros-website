'use client'

import { Label } from '@/shared/components/ui/label'
import { Switch } from '@/shared/components/ui/switch'

interface Props {
  checked: boolean
  disabled: boolean
  onCheckedChange: (on: boolean) => void
}

export function PayAllCashSwitch({ checked, disabled, onCheckedChange }: Props) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="font-sans text-lg font-medium">How you’ll pay</p>
      {/* The label wraps the switch, so the whole 44px row toggles it and names it. */}
      <Label className="min-h-11 cursor-pointer gap-2.5 text-base font-bold has-disabled:cursor-not-allowed has-disabled:opacity-55">
        Pay all cash
        <Switch checked={checked} disabled={disabled} onCheckedChange={onCheckedChange} className="h-6.5 w-11 disabled:opacity-100" thumbClassName="size-5.5" />
      </Label>
    </div>
  )
}
