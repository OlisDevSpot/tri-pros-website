'use client'

import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'
import { PlusIcon } from 'lucide-react'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'

interface Props {
  label: string
  onClick: () => void
  surface: ContactActionSurface
}

export function CustomerContactAddTrigger({ label, onClick, surface }: Props) {
  return (
    <ContactActionTrigger
      className={surface === 'card' ? 'text-muted-foreground' : 'text-white/70'}
      icon={PlusIcon}
      label={label}
      onClick={onClick}
      surface={surface}
    />
  )
}
