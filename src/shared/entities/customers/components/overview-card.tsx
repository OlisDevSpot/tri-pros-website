'use client'

import type { ReactNode } from 'react'

import type { CustomerProfileData } from '@/shared/entities/customers/types'
import type { LeadSourceOverviewCardSource } from '@/shared/entities/lead-sources/components/overview-card'

import { createContext, use, useMemo } from 'react'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { CustomerProfileKeyInsights } from '@/shared/entities/customers/components/profile/customer-profile-key-insights'
import { ProfileCard } from '@/shared/entities/customers/components/profile/profile-card'
import { CUSTOMER_OVERVIEW_PROFILE_FIELDS } from '@/shared/entities/customers/constants/customer-overview-profile-fields'
import { LeadSourceOverviewCard } from '@/shared/entities/lead-sources/components/overview-card'
import { cn } from '@/shared/lib/utils'

export type CustomerOverviewCardData = CustomerProfileData['customer']

interface ContextValue {
  customer: CustomerOverviewCardData
  leadSource: LeadSourceOverviewCardSource | null
}

const Ctx = createContext<ContextValue | null>(null)

function useCard(): ContextValue {
  const value = use(Ctx)
  if (!value) {
    throw new Error('CustomerOverviewCard subcomponent used outside of root')
  }
  return value
}

interface RootProps {
  customer: CustomerOverviewCardData
  /** Supplied by the caller: the profile read carries the lead source id, not its name. */
  leadSource?: LeadSourceOverviewCardSource | null
  className?: string
  children: ReactNode
}

function Root({ customer, leadSource = null, className, children }: RootProps) {
  const value = useMemo<ContextValue>(() => ({ customer, leadSource }), [customer, leadSource])
  return (
    <Ctx value={value}>
      <div className={cn('flex flex-col gap-3', className)}>{children}</div>
    </Ctx>
  )
}

function ContactActions({ className }: { className?: string }) {
  const { customer } = useCard()
  const cityLine = [customer.city, customer.state, customer.zip].filter(Boolean).join(', ')
  const address = [customer.address, cityLine].filter(Boolean).join(', ')
  // A gated phone arrives as null and renders nothing, so agents get no hint a number exists.
  if (!customer.phone && !customer.email && !address) {
    return null
  }
  return (
    <div className={cn('flex flex-col gap-1 text-sm text-muted-foreground', className)}>
      {customer.phone && <PhoneAction phone={customer.phone} />}
      {customer.email && <EmailAction email={customer.email} />}
      {address && <AddressAction address={address} />}
    </div>
  )
}

function LeadSource({ className }: { className?: string }) {
  const { leadSource } = useCard()
  if (!leadSource) {
    return null
  }
  return (
    <LeadSourceOverviewCard
      source={leadSource}
      className={cn('min-h-0 w-auto gap-2 rounded-none p-0 hover:bg-transparent focus-visible:bg-transparent sm:min-h-0', className)}
    >
      <LeadSourceOverviewCard.Name className="font-normal" />
    </LeadSourceOverviewCard>
  )
}

function Insights() {
  const { customer } = useCard()
  return <CustomerProfileKeyInsights customer={customer} />
}

function ProfileFields() {
  const { customer } = useCard()
  return <ProfileCard variant="inline" title="Profile" fields={CUSTOMER_OVERVIEW_PROFILE_FIELDS} data={customer} />
}

export const CustomerOverviewCard = Object.assign(Root, {
  ContactActions,
  LeadSource,
  Insights,
  ProfileFields,
})
