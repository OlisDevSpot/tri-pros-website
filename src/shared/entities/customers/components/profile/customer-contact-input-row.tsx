'use client'

import type { LucideIcon } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import { contactActionTriggerVariants } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import { Input } from '@/shared/components/ui/input'
import { cn } from '@/shared/lib/utils'

interface Props {
  icon: LucideIcon
  inputProps: UseFormRegisterReturn
  label: string
  surface: ContactActionSurface
  type?: 'email' | 'tel' | 'text'
}

// Edit mode swaps a contact row for its input on the same 40px line, so the layout holds still.
export function CustomerContactInputRow({ icon: Icon, inputProps, label, surface, type = 'text' }: Props) {
  return (
    <label className={cn(contactActionTriggerVariants({ shape: 'row', surface }), 'cursor-default hover:bg-transparent')}>
      <Icon />
      <Input
        {...inputProps}
        aria-label={label}
        className={cn('h-9 text-sm', surface === 'image' && 'border-white/20 bg-white/10 text-white placeholder:text-white/50')}
        placeholder={label}
        type={type}
      />
    </label>
  )
}
