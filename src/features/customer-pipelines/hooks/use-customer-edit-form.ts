'use client'

import type { CustomerFormValues } from '@/features/customer-pipelines/types'
import type { Customer } from '@/shared/db/schema'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { buildCustomerFormDefaults } from '@/features/customer-pipelines/lib/build-customer-form-defaults'
import { useAbility } from '@/shared/permissions/hooks'
import { useTRPC } from '@/trpc/helpers'

export function useCustomerEditForm(customer: Customer) {
  const [isEditing, setIsEditing] = useState(false)
  const ability = useAbility()
  const trpc = useTRPC()
  const queryClient = useQueryClient()

  const canEditContact = ability.can('update', 'Customer', 'name')
  const canEditProfiles = ability.can('update', 'Customer', 'customerProfileJSON')
  const canEdit = canEditContact || canEditProfiles

  const form = useForm<CustomerFormValues>({
    defaultValues: buildCustomerFormDefaults(customer),
  })

  const profileMutation = useMutation(
    trpc.customersRouter.updateProfile.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.customerPipelinesRouter.getCustomerProfile.queryFilter())
      },
    }),
  )

  const contactMutation = useMutation(
    trpc.customersRouter.updateCustomerContact.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.customerPipelinesRouter.getCustomerProfile.queryFilter())
      },
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
