'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { LeadMeta } from '@/shared/entities/customers/schemas'

import { CUSTOMER_PROFILE_FIELDS } from '@/shared/entities/customers/constants/customer-profile-fields'
import { FINANCIAL_PROFILE_FIELDS } from '@/shared/entities/customers/constants/financial-profile-fields'
import { PROPERTY_PROFILE_FIELDS } from '@/shared/entities/customers/constants/property-profile-fields'
import { pickProfileColumns } from '@/shared/entities/customers/lib/pick-profile-columns'
import { CUSTOMER_PROFILE_COLUMN_KEYS, FINANCIAL_PROFILE_COLUMN_KEYS, PROPERTY_PROFILE_COLUMN_KEYS } from '@/shared/entities/customers/schemas'
import { FunnelIntakePanel } from './funnel-intake-panel'
import { ProfileCard } from './profile-card'

interface Props {
  editForm: ReturnType<typeof useCustomerEditForm>
  customer: CustomerWithProfile
  leadMetaJSON: LeadMeta | null | undefined
}

export function CustomerProfileDetails({ editForm, customer, leadMetaJSON }: Props) {
  const { form, isEditing, canEditProfiles } = editForm

  return (
    <div className="space-y-4">
      <ProfileCard
        title="Customer Profile"
        fields={CUSTOMER_PROFILE_FIELDS}
        data={pickProfileColumns(customer, CUSTOMER_PROFILE_COLUMN_KEYS)}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        control={form.control}
      />
      <ProfileCard
        title="Property Profile"
        fields={PROPERTY_PROFILE_FIELDS}
        data={pickProfileColumns(customer, PROPERTY_PROFILE_COLUMN_KEYS)}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        control={form.control}
      />
      <ProfileCard
        title="Financial Profile"
        fields={FINANCIAL_PROFILE_FIELDS}
        data={pickProfileColumns(customer, FINANCIAL_PROFILE_COLUMN_KEYS)}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        control={form.control}
      />
      <FunnelIntakePanel leadMetaJSON={leadMetaJSON} />
    </div>
  )
}
