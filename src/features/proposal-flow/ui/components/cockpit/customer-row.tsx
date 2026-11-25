'use client'

import { useQuery } from '@tanstack/react-query'
import { PhoneIcon, UserIcon } from 'lucide-react'

import { COCKPIT_CUSTOMER_HIDDEN } from '@/features/proposal-flow/constants/cockpit-actions'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { getVisibleActions } from '@/shared/components/entities/entity-actions/lib/visible-actions'
import { isClickAction } from '@/shared/components/entities/entity-actions/types'
import { Button } from '@/shared/components/ui/button'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useAbility } from '@/shared/domains/permissions/client'
import { CustomerOverviewCard } from '@/shared/entities/customers/components/overview-card'
import { CUSTOMER_ACTIONS } from '@/shared/entities/customers/constants/actions'
import { formatPhone } from '@/shared/lib/phone'
import { useCustomerActionsHost } from '@/shared/modules/customers/core/components/customer-actions-host'
import { useTRPC } from '@/trpc/helpers'

export function CustomerRow({ customerId }: { customerId: string }) {
  const trpc = useTRPC()
  const ability = useAbility()
  const { actions } = useCustomerActionsHost('CustomerRow')
  const profile = useQuery(trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }))

  if (profile.isPending) {
    return <Skeleton className="h-16 rounded-xl" />
  }
  if (profile.isError) {
    const unreachable = profile.error.data?.code === 'NOT_FOUND' || profile.error.data?.code === 'FORBIDDEN'
    return (
      <p className="text-sm text-muted-foreground">
        {unreachable ? 'This customer’s profile isn’t available to you.' : 'Couldn’t load the customer. Try again.'}
      </p>
    )
  }

  const { customer } = profile.data
  const view = getVisibleActions(actions, ability, customer).find(config => config.action.id === CUSTOMER_ACTIONS.view.id)
  const line = [customer.city, customer.phone && formatPhone(customer.phone)].filter(Boolean).join(' · ')

  return (
    <CustomerOverviewCard customer={customer} className="flex-row items-center gap-2.5 rounded-xl border border-border bg-card px-3.5 py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate font-sans text-base font-semibold">{customer.name}</p>
        {line && <p className="truncate text-sm text-muted-foreground">{line}</p>}
      </div>
      {customer.phone && (
        <PhoneAction phone={customer.phone}>
          <Button variant="outline" size="icon" aria-label={`Call or text ${customer.name}`} className="size-10 pointer-coarse:size-11">
            <PhoneIcon className="size-4" />
          </Button>
        </PhoneAction>
      )}
      {view && isClickAction(view) && (
        <Button variant="outline" size="icon" aria-label="Open customer profile" className="size-10 pointer-coarse:size-11" onClick={() => view.onAction(customer)}>
          <UserIcon className="size-4" />
        </Button>
      )}
      <CustomerOverviewCard.Actions mode="compact" hide={COCKPIT_CUSTOMER_HIDDEN} className="size-10 border border-control-border bg-control pointer-coarse:size-11" />
    </CustomerOverviewCard>
  )
}
