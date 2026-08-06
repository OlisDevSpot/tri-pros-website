'use client'

import type { CustomerFullView } from '@/shared/entities/customers/dal/server/queries'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'

import { HouseIcon, UserRoundIcon, WalletIcon } from 'lucide-react'

import { CUSTOMER_PROFILE_FIELDS } from '@/shared/entities/customers/constants/customer-profile-fields'
import { FINANCIAL_PROFILE_FIELDS } from '@/shared/entities/customers/constants/financial-profile-fields'
import { PROPERTY_PROFILE_FIELDS } from '@/shared/entities/customers/constants/property-profile-fields'
import { pickProfileColumns } from '@/shared/entities/customers/lib/pick-profile-columns'
import { CUSTOMER_PROFILE_COLUMN_KEYS, FINANCIAL_PROFILE_COLUMN_KEYS, PROPERTY_PROFILE_COLUMN_KEYS } from '@/shared/entities/customers/schemas'
import { FunnelIntakePanel } from './funnel-intake-panel'
import { ProfileCard } from './profile-card'

interface Props {
  editForm: ReturnType<typeof useCustomerEditForm>
  customer: CustomerFullView
}

export function CustomerProfileDetails({ editForm, customer }: Props) {
  const { form, isEditing, canEditProfiles } = editForm

  // Reading order follows the customer's own timeline: funnel intake first
  // (the earliest data we captured, when present), then qualification — who
  // they are + their financials — then property specs as reference. Every
  // section collapses and opens by default only when it holds data.
  return (
    <div className="space-y-4">
      <FunnelIntakePanel attribution={customer.attribution} enrichment={customer.enrichment} />
      <ProfileCard
        title="Customer Profile"
        icon={UserRoundIcon}
        fields={CUSTOMER_PROFILE_FIELDS}
        data={pickProfileColumns(customer, CUSTOMER_PROFILE_COLUMN_KEYS)}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        control={form.control}
      />
      <ProfileCard
        title="Financial Profile"
        icon={WalletIcon}
        fields={FINANCIAL_PROFILE_FIELDS}
        data={pickProfileColumns(customer, FINANCIAL_PROFILE_COLUMN_KEYS)}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        control={form.control}
      />
      <ProfileCard
        title="Property Profile"
        icon={HouseIcon}
        fields={PROPERTY_PROFILE_FIELDS}
        data={pickProfileColumns(customer, PROPERTY_PROFILE_COLUMN_KEYS)}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        control={form.control}
      />
    </div>
  )
}
