'use client'

import type { LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import type { ContactActionTriggerVariants } from './contact-action-trigger-variants'
import { cn } from '@/shared/lib/utils'
import { contactActionTriggerVariants } from './contact-action-trigger-variants'

type ContactActionTriggerProps = Omit<ComponentProps<'button'>, 'children'> & ContactActionTriggerVariants & {
  icon: LucideIcon
  // Visible text for a row; the accessible name for a disc or an icon button, which show no text.
  label: string
}

// Presentational only: it forwards every prop and its ref, so it can be the asChild child of
// PhoneAction, EmailAction or AddressAction (their DropdownMenuTrigger supplies the handlers).
export function ContactActionTrigger({ className, icon: Icon, label, shape, surface, type = 'button', ...props }: ContactActionTriggerProps) {
  const iconOnly = shape === 'round' || shape === 'icon'
  return (
    <button
      aria-label={iconOnly ? label : undefined}
      className={cn(contactActionTriggerVariants({ shape, surface }), className)}
      title={iconOnly ? undefined : label}
      type={type}
      {...props}
    >
      <Icon />
      {!iconOnly && <span className="truncate">{label}</span>}
    </button>
  )
}
