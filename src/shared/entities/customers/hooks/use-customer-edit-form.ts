'use client'

import type { Customer } from '@/shared/db/schema'
import type { CustomerFormValues } from '@/shared/entities/customers/types'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { useInvalidation } from '@/shared/dal/client/hooks/use-invalidation'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { buildCustomerFormDefaults } from '@/shared/entities/customers/lib/build-customer-form-defaults'
import { PROFILE_COLUMN_KEYS } from '@/shared/entities/customers/schemas'
import { useTRPC } from '@/trpc/helpers'

export function useCustomerEditForm(customer: Customer) {
  const [isEditing, setIsEditing] = useState(false)
  const ability = useAbility()
  const trpc = useTRPC()
  const { invalidateCustomer } = useInvalidation()

  const canEditContact = ability.can('update', 'Customer', 'name')
  // `triggerEvent` is a representative probe field — CASL grants the whole
  // PROFILE_COLUMN_KEYS group together (abilities.ts), so any one member is
  // equivalent to "can edit the profile-trio columns" (epic #256/#259).
  const canEditProfiles = ability.can('update', 'Customer', 'triggerEvent')
  const canEdit = canEditContact || canEditProfiles

  const form = useForm<CustomerFormValues>({
    defaultValues: buildCustomerFormDefaults(customer),
  })

  const profileMutation = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => invalidateCustomer(),
    }),
  )

  const contactMutation = useMutation(
    trpc.customersRouter.crud.update.mutationOptions({
      onSuccess: () => invalidateCustomer(),
    }),
  )

  async function handleSave(values: CustomerFormValues) {
    const promises: Promise<unknown>[] = []

    // Flat column patch (epic #256/#259) — only send the profile-trio keys
    // RHF marked dirty (changed from the row-seeded defaults), so untouched
    // fields stay omitted (undefined) rather than overwriting with defaults.
    // An explicit clear surfaces as a dirty field whose value is `undefined`
    // (empty input) — normalize that to `null` so it's an explicit clear,
    // not a no-op.
    if (canEditProfiles) {
      const dirtyProfileKeys = PROFILE_COLUMN_KEYS.filter(k => form.formState.dirtyFields[k])
      if (dirtyProfileKeys.length > 0) {
        const patch = Object.fromEntries(
          dirtyProfileKeys.map(k => [k, values[k] ?? null]),
        ) as Partial<Pick<Customer, (typeof PROFILE_COLUMN_KEYS)[number]>>
        promises.push(
          profileMutation.mutateAsync({
            id: customer.id,
            data: patch,
          }),
        )
      }
    }

    if (canEditContact) {
      promises.push(
        contactMutation.mutateAsync({
          id: customer.id,
          data: {
            name: values.name || undefined,
            phone: values.phone || undefined,
            email: values.email || undefined,
            address: values.address || undefined,
            city: values.city || undefined,
            state: values.state || undefined,
            zip: values.zip || undefined,
          },
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
