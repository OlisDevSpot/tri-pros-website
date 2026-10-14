'use client'

import { ArrowRightIcon } from 'lucide-react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_ROW_CLASSES } from '@/features/omni-search/constants/omni-search'
import { CommandItem } from '@/shared/components/ui/command'

interface Props {
  href: string
  onSeeAll: (href: string) => void
  disabled?: boolean
}

export function OmniSeeAllItem({ href, onSeeAll, disabled }: Props) {
  return (
    <CommandItem aria-label={OMNI_COPY.seeAllCustomers} value="customers:see-all" disabled={disabled} onSelect={() => onSeeAll(href)} className={OMNI_ROW_CLASSES.compact}>
      <ArrowRightIcon aria-hidden className="text-muted-foreground" />
      <span className="text-muted-foreground">{OMNI_COPY.seeAllCustomers}</span>
    </CommandItem>
  )
}
