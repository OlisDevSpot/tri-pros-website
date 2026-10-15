'use client'

import type { OmniCustomer, OmniItemLayout, RecentOmniItem } from '@/features/omni-search/types'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_CONTACT_ROW_CLASS, OMNI_ICON_TILE_CLASS, OMNI_RECORD_ICONS, OMNI_ROW_CLASSES } from '@/features/omni-search/constants/omni-search'
import { customerContact } from '@/features/omni-search/lib/customer-contact'
import { customerExcerpt } from '@/features/omni-search/lib/customer-excerpt'
import { focusOmniInput } from '@/features/omni-search/lib/omni-focus'
import { omniRowLabel } from '@/features/omni-search/lib/omni-row-label'
import { OmniMatchText } from '@/features/omni-search/ui/components/omni-match-text'
import { CommandItem } from '@/shared/components/ui/command'
import { CustomerContactButtons } from '@/shared/entities/customers/components/customer-contact-buttons'
import { getInitials } from '@/shared/entities/users/lib/get-initials'
import { cn } from '@/shared/lib/utils'

interface Props {
  customer: OmniCustomer
  layout: OmniItemLayout
  term: string
  onSelect: (item: RecentOmniItem) => void
  disabled?: boolean
  /** Off when picking a customer: the row is a choice, not a contact card. */
  withContact?: boolean
  /** Keeps the highlight on this row while the pointer is on its capsule, which sits outside the option. */
  onHighlight?: (value: string) => void
}

export function OmniCustomerItem({ customer, layout, term, onSelect, disabled, withContact = true, onHighlight }: Props) {
  const Icon = OMNI_RECORD_ICONS.customer
  const excerpt = customerExcerpt(customer)
  const contact = customerContact(customer)
  const hasCapsule = withContact && !!(contact.phone || contact.email || contact.address)
  const value = `customer:${customer.id}`
  const select = () => onSelect({ key: value, kind: 'customer', label: customer.name, sublabel: customer.city, target: customer.target })
  const excerptText = excerpt && <OmniMatchText text={excerpt.text} term={term} mode={excerpt.mode} />
  const itemProps = {
    'aria-label': omniRowLabel(customer.name, customer.city, excerpt?.text),
    disabled,
    value,
    'onSelect': select,
  }
  // Beside a capsule the row shares its wrapper, which paints the highlight across both.
  const besideCapsule = hasCapsule && 'min-w-0 flex-1 data-[selected=true]:bg-transparent dark:data-[selected=true]:bg-transparent'

  let item
  if (layout === 'nested') {
    item = (
      <CommandItem {...itemProps} className={cn(OMNI_ROW_CLASSES.line, besideCapsule)}>
        <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted font-sans text-sm font-semibold text-foreground">
          {getInitials(customer.name)}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <OmniMatchText className="truncate font-sans text-base font-semibold text-foreground" text={customer.name} term={term} />
          <span className="truncate text-xs text-muted-foreground">
            {customer.city}
            {excerptText && (
              <>
                {' · '}
                {excerptText}
              </>
            )}
          </span>
        </span>
      </CommandItem>
    )
  }
  else if (layout === 'compact') {
    item = (
      <CommandItem {...itemProps} className={cn(OMNI_ROW_CLASSES.compact, besideCapsule)}>
        <Icon aria-hidden className="text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate">
          <OmniMatchText className="font-medium text-foreground" text={customer.name} term={term} />
          {/* The excerpt tells apart two customers with the same name in the same city. */}
          <span className="text-muted-foreground">
            {` · ${customer.city}`}
            {excerptText && (
              <>
                {' · '}
                {excerptText}
              </>
            )}
          </span>
        </span>
      </CommandItem>
    )
  }
  else {
    item = (
      <CommandItem {...itemProps} className={cn(OMNI_ROW_CLASSES.line, besideCapsule)}>
        <span aria-hidden className={OMNI_ICON_TILE_CLASS}><Icon /></span>
        <span className="flex min-w-0 flex-1 flex-col">
          <OmniMatchText className="truncate font-medium text-foreground" text={customer.name} term={term} />
          {/* Excerpt first: a phone's narrow line would otherwise truncate away what explains the match. */}
          <span className="truncate text-xs text-muted-foreground">
            {excerptText && (
              <>
                {excerptText}
                {' · '}
              </>
            )}
            {customer.city}
          </span>
        </span>
      </CommandItem>
    )
  }

  if (!hasCapsule) {
    return item
  }
  // The capsule is the option's sibling, not its child: inside role="option" its buttons would be presentational
  // and read into every row's name.
  return (
    <div data-omni-contact-row="" className={cn(OMNI_CONTACT_ROW_CLASS, layout === 'compact' ? 'rounded-md' : 'rounded-lg')}>
      {item}
      <div
        className={cn('shrink-0 pr-2', disabled && 'pointer-events-none opacity-50')}
        onPointerMove={disabled ? undefined : () => onHighlight?.(value)}
      >
        <CustomerContactButtons contact={contact} label={OMNI_COPY.contactLabel(customer.name)} variant="capsule" onLeave={focusOmniInput} />
      </div>
    </div>
  )
}
