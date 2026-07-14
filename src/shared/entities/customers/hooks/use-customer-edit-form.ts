'use client'

import type { CustomerWithProfile } from '@/shared/entities/customers/dal/server/queries'
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

export function useCustomerEditForm(customer: CustomerWithProfile) {
  const [isEditing, setIsEditing] = useState(false)
  const ability = useAbility()
  const trpc = useTRPC()
  const { invalidateCustomer } = useInvalidation()

  const canEditContact = ability.can('update', 'Customer', 'name')
  // `age` is a field-restricted Customer grant, separate from the
  // CustomerProfile subject (Addendum B, 2026-07-14) — only agents hold it,
  // not dispatchers.
  const canEditAge = ability.can('update', 'Customer', 'age')
  // Profile-trio columns (customer_profiles child table) are gated as one
  // CASL subject — all-or-nothing, unlike Customer's field-restricted grants.
  const canEditProfiles = ability.can('update', 'CustomerProfile')
  const canEdit = canEditContact || canEditProfiles || canEditAge

  const form = useForm<CustomerFormValues>({
    defaultValues: buildCustomerFormDefaults(customer),
  })

  const profileMutation = useMutation(
    trpc.customersRouter.profile.upsert.mutationOptions({
      onSuccess: () => invalidateCustomer(),
    }),
  )

  const ageMutation = useMutation(
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

    // Flat column patch — only send the profile-trio keys RHF marked dirty
    // (changed from the row-seeded defaults), so untouched fields stay
    // omitted (undefined) rather than overwriting with defaults. An explicit
    // clear surfaces as a dirty field whose value is `undefined` (empty
    // input) — normalize that to `null` so it's an explicit clear, not a
    // no-op. Routes through the customer_profiles child-table upsert
    // (Addendum B) — a separate mutation from the Customer row itself.
    if (canEditProfiles) {
      const dirtyProfileKeys = PROFILE_COLUMN_KEYS.filter(k => form.formState.dirtyFields[k])
      if (dirtyProfileKeys.length > 0) {
        const patch = Object.fromEntries(
          dirtyProfileKeys.map(k => [k, values[k] ?? null]),
        )
        promises.push(
          profileMutation.mutateAsync({
            id: customer.id,
            data: patch,
          }),
        )
      }
    }

    // `age` stays a plain Customer column (Addendum B.2) — separate mutation
    // from the profile-trio child-table upsert above; both may fire together.
    if (canEditAge && form.formState.dirtyFields.age) {
      promises.push(
        ageMutation.mutateAsync({
          id: customer.id,
          data: { age: values.age ?? null },
        }),
      )
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
    isPending: profileMutation.isPending || ageMutation.isPending || contactMutation.isPending,
    handleCancel,
    handleSave: form.handleSubmit(handleSave),
    startEditing,
  }
}
