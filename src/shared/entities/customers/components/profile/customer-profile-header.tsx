'use client'

import type { UseFormRegister } from 'react-hook-form'
import type { CustomerFormValues, CustomerProfileData } from '@/shared/entities/customers/types'

import { MailIcon, MapPinIcon, PhoneIcon, PlusIcon } from 'lucide-react'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { canAgentSeePhone } from '@/shared/entities/customers/lib/can-see-phone'
import { useIsMobile } from '@/shared/hooks/use-mobile'

interface Props {
  customer: CustomerProfileData['customer']
  isEditing?: boolean
  register?: UseFormRegister<CustomerFormValues>
  onEditField?: (field: string) => void
}

export function CustomerProfileHeader({ customer, isEditing = false, register, onEditField }: Props) {
  const ability = useAbility()
  const isMobile = useIsMobile()
  const canEditContact = ability.can('update', 'Customer', 'name')
  const showInputs = isEditing && canEditContact && register
  const phoneUnlocked = canAgentSeePhone(ability, customer)

  const addressLine1 = customer.address ?? ''
  const addressLine2 = [customer.city, customer.zip].filter(Boolean).join(', ')
  const addressLine2WithState = [addressLine2, customer.state].filter(Boolean).join(' ')
  const address = [customer.address, customer.city, customer.state, customer.zip]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="flex flex-col items-start gap-2 text-sm text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
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
              // Null phone: only show "Add phone" to users who can edit AND
              // are entitled to see the real phone. Gated agents get nothing —
              // no UI hint that a phone might exist behind a gate.
              phoneUnlocked && canEditContact && (
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
              >
                {isMobile
                  ? (
                      <button
                        type="button"
                        className="flex items-start gap-1.5 text-left hover:text-foreground transition-colors cursor-pointer"
                        onClick={e => e.stopPropagation()}
                      >
                        <MapPinIcon size={14} className="mt-0.5 shrink-0" />
                        <span className="flex flex-col leading-tight">
                          <span>{addressLine1}</span>
                          <span>{addressLine2WithState}</span>
                        </span>
                      </button>
                    )
                  : undefined}
              </AddressAction>
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
