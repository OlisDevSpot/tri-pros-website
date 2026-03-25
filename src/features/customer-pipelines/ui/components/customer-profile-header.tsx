'use client'

import type { UseFormRegister } from 'react-hook-form'
import type { CustomerFormValues, CustomerProfileData } from '@/features/customer-pipelines/types'

import { MailIcon, MapPinIcon, PhoneIcon, PlusIcon } from 'lucide-react'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useAbility } from '@/shared/permissions/hooks'

interface Props {
  customer: CustomerProfileData['customer']
  isEditing?: boolean
  register?: UseFormRegister<CustomerFormValues>
  onEditField?: (field: string) => void
}

export function CustomerProfileHeader({ customer, isEditing = false, register, onEditField }: Props) {
  const ability = useAbility()
  const canEditContact = ability.can('update', 'Customer', 'name')
  const showInputs = isEditing && canEditContact && register

  const address = [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
      {/* Phone */}
      {showInputs
        ? (
            <span className="flex items-center gap-1.5">
              <PhoneIcon size={14} className="shrink-0" />
              <Input
                {...register('phone')}
                placeholder="Phone number"
                className="h-6 w-36 text-xs"
              />
            </span>
          )
        : customer.phone
          ? (
              <PhoneAction
                phone={customer.phone}
                canEdit={canEditContact}
                onEdit={() => onEditField?.('phone')}
              />
            )
          : (
              canEditContact && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 border-dashed px-2 text-xs text-muted-foreground"
                  onClick={() => onEditField?.('phone')}
                >
                  <PlusIcon size={12} />
                  <PhoneIcon size={12} />
                  Add phone
                </Button>
              )
            )}

      {/* Email */}
      {showInputs
        ? (
            <span className="flex items-center gap-1.5">
              <MailIcon size={14} className="shrink-0" />
              <Input
                {...register('email')}
                placeholder="Email address"
                type="email"
                className="h-6 w-44 text-xs"
              />
            </span>
          )
        : customer.email
          ? (
              <EmailAction
                email={customer.email}
                canEdit={canEditContact}
                onEdit={() => onEditField?.('email')}
              />
            )
          : (
              canEditContact && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 border-dashed px-2 text-xs text-muted-foreground"
                  onClick={() => onEditField?.('email')}
                >
                  <PlusIcon size={12} />
                  <MailIcon size={12} />
                  Add email
                </Button>
              )
            )}

      {/* Address */}
      {showInputs
        ? (
            <span className="flex items-center gap-1.5">
              <MapPinIcon size={14} className="shrink-0" />
              <Input
                {...register('address')}
                placeholder="Street address"
                className="h-6 w-44 text-xs"
              />
            </span>
          )
        : address
          ? (
              <AddressAction
                address={address}
                canEdit={canEditContact}
                onEdit={() => onEditField?.('address')}
              />
            )
          : (
              canEditContact && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 gap-1 border-dashed px-2 text-xs text-muted-foreground"
                  onClick={() => onEditField?.('address')}
                >
                  <PlusIcon size={12} />
                  <MapPinIcon size={12} />
                  Add address
                </Button>
              )
            )}
    </div>
  )
}
