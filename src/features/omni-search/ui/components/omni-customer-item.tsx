'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { OMNI_RECORD_ICONS } from '@/features/omni-search/constants/omni-search'
import { CommandItem } from '@/shared/components/ui/command'
import { PIPELINE_LABELS } from '@/shared/domains/pipelines/constants/pipeline-registry'

type OmniCustomer = AppRouterOutputs['searchRouter']['omni']['customers'][number]

function matchExcerpt(customer: OmniCustomer): string | null {
  switch (customer.matchedOn) {
    case 'phone': return customer.phone ? `···${customer.phone.slice(-4)}` : null
    case 'address': return customer.address ?? customer.zip
    case 'email': return customer.email
    case 'name': return null
  }
}

interface Props {
  customer: OmniCustomer
  onSelect: (item: RecentOmniItem) => void
}

export function OmniCustomerItem({ customer, onSelect }: Props) {
  const Icon = OMNI_RECORD_ICONS.customer
  const excerpt = matchExcerpt(customer)
  return (
    <CommandItem
      value={`customer:${customer.id}`}
      onSelect={() => onSelect({ key: `customer:${customer.id}`, kind: 'customer', label: customer.name, sublabel: customer.city, target: customer.target })}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-foreground">{customer.name}</span>
        <span className="text-muted-foreground">{` · ${customer.city}`}</span>
      </span>
      {excerpt && <span className="shrink-0 rounded border border-border px-1.5 text-xs text-muted-foreground">{excerpt}</span>}
      <span className="shrink-0 text-xs text-muted-foreground">{PIPELINE_LABELS[customer.pipeline]}</span>
    </CommandItem>
  )
}
