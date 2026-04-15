'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'

import {
  CUSTOMER_PROFILE_ENUM_OPTIONS,
  FINANCIAL_PROFILE_ENUM_OPTIONS,
  PROPERTY_PROFILE_ENUM_OPTIONS,
} from '@/shared/entities/customers/constants/profile-field-enums'
import {
  customerProfileLabels,
  financialProfileLabels,
  propertyProfileLabels,
} from '@/shared/entities/customers/constants/profile-field-labels'
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
        data={customerProfileJSON}
        labels={customerProfileLabels}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        formPrefix="customerProfileJSON"
        control={form.control}
        enumOptions={CUSTOMER_PROFILE_ENUM_OPTIONS}
      />
      <ProfileCard
        title="Property Profile"
        data={propertyProfileJSON}
        labels={propertyProfileLabels}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        formPrefix="propertyProfileJSON"
        control={form.control}
        enumOptions={PROPERTY_PROFILE_ENUM_OPTIONS}
      />
      <ProfileCard
        title="Financial Profile"
        data={financialProfileJSON}
        labels={financialProfileLabels}
        editMode={isEditing}
        canEditField={() => canEditProfiles}
        formPrefix="financialProfileJSON"
        control={form.control}
        enumOptions={FINANCIAL_PROFILE_ENUM_OPTIONS}
      />
    </div>
  )
}
