'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'

import { CUSTOMER_PROFILE_FIELDS } from '@/shared/entities/customers/constants/customer-profile-fields'
import { FINANCIAL_PROFILE_FIELDS } from '@/shared/entities/customers/constants/financial-profile-fields'
import { PROPERTY_PROFILE_FIELDS } from '@/shared/entities/customers/constants/property-profile-fields'
import { ProfileCard } from './profile-card'

interface Props {
  editForm: ReturnType<typeof useCustomerEditForm>
  customerProfileJSON: Record<string, unknown> | null
  propertyProfileJSON: Record<string, unknown> | null
  financialProfileJSON: Record<string, unknown> | null
}

export function CustomerProfileDetails({
  editForm,
  customerProfileJSON,
  propertyProfileJSON,
  financialProfileJSON,
}: Props) {
  const { form, isEditing, canEditProfiles } = editForm

  return (
    <div className="space-y-4">
      <ProfileCard
        title="Customer Profile"
        fields={CUSTOMER_PROFILE_FIELDS}
        data={customerProfileJSON}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        formPrefix="customerProfileJSON"
        control={form.control}
      />
      <ProfileCard
        title="Property Profile"
        fields={PROPERTY_PROFILE_FIELDS}
        data={propertyProfileJSON}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        formPrefix="propertyProfileJSON"
        control={form.control}
      />
      <ProfileCard
        title="Financial Profile"
        fields={FINANCIAL_PROFILE_FIELDS}
        data={financialProfileJSON}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        formPrefix="financialProfileJSON"
        control={form.control}
      />
    </div>
  )
}
