'use client'

import type { useCustomerEditForm } from '@/features/customer-pipelines/hooks/use-customer-edit-form'

import { PencilIcon } from 'lucide-react'

import {
  CUSTOMER_PROFILE_ENUM_OPTIONS,
  FINANCIAL_PROFILE_ENUM_OPTIONS,
  PROPERTY_PROFILE_ENUM_OPTIONS,
} from '@/features/customer-pipelines/constants/profile-field-enums'
import {
  customerProfileLabels,
  financialProfileLabels,
  propertyProfileLabels,
} from '@/features/customer-pipelines/constants/profile-field-labels'
import { ProfileCard } from '@/features/customer-pipelines/ui/components/profile-card'
import { Button } from '@/shared/components/ui/button'

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
  const {
    form,
    isEditing,
    canEdit,
    canEditProfiles,
    isPending,
    startEditing,
    handleCancel,
    handleSave,
  } = editForm

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex items-center justify-between">
          {!isEditing
            ? (
                <Button variant="ghost" size="sm" onClick={() => startEditing()}>
                  <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                  Edit Profile
                </Button>
              )
            : (
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={handleSave} disabled={isPending}>
                    {isPending ? 'Saving...' : 'Save'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleCancel} disabled={isPending}>
                    Cancel
                  </Button>
                </div>
              )}
        </div>
      )}

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
