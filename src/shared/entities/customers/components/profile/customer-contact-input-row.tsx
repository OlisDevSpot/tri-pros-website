'use client'

import type { LucideIcon } from 'lucide-react'
import type { Control } from 'react-hook-form'
import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import type { CustomerFormValues } from '@/shared/entities/customers/types'
import { Controller } from 'react-hook-form'
import { contactActionTriggerVariants } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import { Input } from '@/shared/components/ui/input'
import { PhoneField } from '@/shared/components/ui/phone-field'
import { cn } from '@/shared/lib/utils'

interface Props {
  control: Control<CustomerFormValues>
  icon: LucideIcon
  label: string
  name: 'email' | 'phone'
  surface: ContactActionSurface
}

// Edit mode swaps a contact row for its input on the same line; the vertical padding keeps stacked
// inputs from touching, since the row's own height is shorter than a field.
export function CustomerContactInputRow({ control, icon: Icon, label, name, surface }: Props) {
  const className = cn('h-9 text-sm', surface === 'image' && 'border-white/20 bg-white/10 text-white placeholder:text-white/50')

  return (
    <label className={cn(contactActionTriggerVariants({ shape: 'row', surface }), 'cursor-default py-0.5 hover:bg-transparent')}>
      <Icon />
      <Controller
        control={control}
        name={name}
        render={({ field }) => name === 'phone'
          ? <PhoneField {...field} aria-label={label} className={className} />
          : <Input {...field} aria-label={label} className={className} placeholder={label} type="email" />}
      />
    </label>
  )
}
