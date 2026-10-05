'use client'

import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import type { ContactActionTriggerVariants } from './contact-action-trigger-variants'
import { cn } from '@/shared/lib/utils'
import { contactActionTriggerVariants } from './contact-action-trigger-variants'

type ContactActionTriggerProps = Omit<ComponentProps<'button'>, 'children'> & ContactActionTriggerVariants & {
  icon: LucideIcon
  // Visible text for a row; the accessible name for a round disc, which shows no text.
  label: string
}

// Presentational only: it forwards every prop and its ref, so it can be the asChild child of
// PhoneAction, EmailAction or AddressAction (their DropdownMenuTrigger supplies the handlers).
export function ContactActionTrigger({ className, icon: Icon, label, shape, surface, type = 'button', ...props }: ContactActionTriggerProps) {
  const isRound = shape === 'round'
  return (
    <button
      aria-label={isRound ? label : undefined}
      className={cn(contactActionTriggerVariants({ shape, surface }), className)}
      title={isRound ? undefined : label}
      type={type}
      {...props}
    >
      <Icon />
      {!isRound && <span className="truncate">{label}</span>}
    </button>
  )
}
