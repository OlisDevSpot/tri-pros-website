'use client'

import type { Customer } from '@/shared/db/schema'
import type { CustomerFormValues } from '@/shared/entities/customers/types'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { buildCustomerFormDefaults } from '@/shared/entities/customers/lib/build-customer-form-defaults'
import { useTRPC } from '@/trpc/helpers'

export function useCustomerEditForm(customer: Customer) {
  const [isEditing, setIsEditing] = useState(false)
  const ability = useAbility()
  const trpc = useTRPC()
  const { invalidateCustomer } = useInvalidation()

  const canEditContact = ability.can('update', 'Customer', 'name')
  const canEditProfiles = ability.can('update', 'Customer', 'customerProfileJSON')
  const canEdit = canEditContact || canEditProfiles

  const form = useForm<CustomerFormValues>({
    defaultValues: buildCustomerFormDefaults(customer),
  })

  const profileMutation = useMutation(
    trpc.customersRouter.updateProfile.mutationOptions({
      onSuccess: () => invalidateCustomer(),
    }),
  )

  const contactMutation = useMutation(
    trpc.customersRouter.updateCustomerContact.mutationOptions({
      onSuccess: () => invalidateCustomer(),
    }),
  )

  async function handleSave(values: CustomerFormValues) {
    const promises: Promise<unknown>[] = []

    if (canEditProfiles) {
      promises.push(
        profileMutation.mutateAsync({
          customerId: customer.id,
          customerProfileJSON: values.customerProfileJSON,
          financialProfileJSON: values.financialProfileJSON,
          propertyProfileJSON: values.propertyProfileJSON,
        }),
      )
    }

    if (canEditContact) {
      promises.push(
        contactMutation.mutateAsync({
          customerId: customer.id,
          name: values.name || undefined,
          phone: values.phone || undefined,
          email: values.email || undefined,
          address: values.address || undefined,
          city: values.city || undefined,
          state: values.state || undefined,
          zip: values.zip || undefined,
        }),
      )
    }

    try {
      await Promise.all(promises)
      setIsEditing(false)
      toast.success('Customer profile updated')
    }
    catch {
      toast.error('Failed to update profile')
    }
  }

  function handleCancel() {
    form.reset(buildCustomerFormDefaults(customer))
    setIsEditing(false)
  }

  function startEditing(field?: string) {
    setIsEditing(true)
    if (field) {
      setTimeout(() => {
        form.setFocus(field as keyof CustomerFormValues)
      }, 100)
    }
  }

  return {
    form,
    isEditing,
    canEdit,
    canEditContact,
    canEditProfiles,
    isPending: profileMutation.isPending || contactMutation.isPending,
    handleCancel,
    handleSave: form.handleSubmit(handleSave),
    startEditing,
  }
}
