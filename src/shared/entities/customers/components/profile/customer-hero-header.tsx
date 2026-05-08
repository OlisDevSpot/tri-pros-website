'use client'

import type { useCustomerEditForm } from '@/shared/entities/customers/hooks/use-customer-edit-form'
import type { CustomerProfileData } from '@/shared/entities/customers/types'
import { CheckIcon, MailIcon, MapPinIcon, PhoneIcon, PlusIcon, XIcon } from 'lucide-react'
import { useState } from 'react'
import { InlineEditButton } from '@/shared/components/buttons/inline-edit-button'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { canAgentSeePhone } from '@/shared/entities/customers/lib/can-see-phone'
import { getInitials } from '@/shared/entities/users/lib/get-initials'
import { formatAsPhoneNumber, formatCustomerAddress } from '@/shared/lib/formatters'
import { cn } from '@/shared/lib/utils'
import { AddressEditDialog } from './address-edit-dialog'

type Customer = CustomerProfileData['customer']

interface Props {
  customer: Customer
  editForm: ReturnType<typeof useCustomerEditForm>
}

// Shared glass-chip styles used across all contact badges.
const BADGE_BASE = 'group inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-xs font-medium text-white/90 backdrop-blur-sm transition-colors hover:bg-white/15 cursor-pointer'

export function CustomerHeroHeader({ customer, editForm }: Props) {
  const ability = useAbility()
  const initials = getInitials(customer.name)
  const phoneUnlocked = canAgentSeePhone(ability, customer)
  const canEditContact = editForm.canEditContact
  const address = formatCustomerAddress({
    address: customer.address,
    city: customer.city,
    state: customer.state,
    zip: customer.zip,
  })
  const [addressDialogOpen, setAddressDialogOpen] = useState(false)

  return (
    <div className="flex items-center gap-3.5">
      {/* Avatar — desktop only. `self-stretch aspect-square` forces the tile
          to match the sibling content's height and stay perfectly square. */}
      <div
        aria-hidden
        className="relative hidden aspect-square shrink-0 self-stretch place-items-center rounded-2xl bg-linear-to-br from-white/25 via-white/10 to-white/5 text-white shadow-lg ring-1 ring-white/25 backdrop-blur-sm before:absolute before:inset-0 before:rounded-2xl before:ring-1 before:ring-inset before:ring-white/10 sm:grid"
      >
        <span className="relative font-semibold leading-none tracking-tight text-xl">
          {initials || '—'}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        {/* Name row */}
        <div className="flex items-center gap-1.5">
          {editForm.isEditing && canEditContact
            ? (
                // Bounded width keeps the save/cancel buttons visually anchored
                // close to where the pencil sat — the input never fills the
                // whole row, so there is minimal layout shift between display
                // and edit modes. Width is stable regardless of typed content.
                <Input
                  {...editForm.form.register('name')}
                  className="h-8 w-full max-w-64 bg-white/10 text-lg font-semibold tracking-tight text-white placeholder:text-white/50 sm:max-w-80 sm:text-xl"
                  placeholder="Customer name"
                />
              )
            : (
                <h2 className="truncate text-2xl font-semibold leading-tight tracking-tight text-white sm:text-[1.7rem]">
                  {customer.name}
                </h2>
              )}
          <EditToggle editForm={editForm} />
        </div>

        {/* Contact badges — stacked (one-per-row) on mobile, inline on desktop. */}
        <div className="mt-2 flex flex-col items-start gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
          <AddressBadge
            address={address}
            canEdit={canEditContact}
            onEdit={() => setAddressDialogOpen(true)}
          />
          <PhoneBadge
            canEdit={canEditContact}
            customer={customer}
            editForm={editForm}
            phoneUnlocked={phoneUnlocked}
          />
          <EmailBadge
            canEdit={canEditContact}
            customer={customer}
            editForm={editForm}
          />
        </div>
      </div>

      <AddressEditDialog
        customerId={customer.id}
        defaultAddress={address.singleLine}
        isOpen={addressDialogOpen}
        onClose={() => setAddressDialogOpen(false)}
      />
    </div>
  )
}

// ─── Edit toggle (pencil / save-cancel) ──────────────────────────────────────

function EditToggle({ editForm }: { editForm: ReturnType<typeof useCustomerEditForm> }) {
  if (!editForm.canEdit) {
    return null
  }

  if (editForm.isEditing) {
    return (
      <div className="flex items-center gap-0.5">
        <Button
          aria-label="Save changes"
          className="size-7 shrink-0 rounded-full text-emerald-400 backdrop-blur-sm hover:bg-emerald-500/15 hover:text-emerald-300"
          disabled={editForm.isPending}
          onClick={editForm.handleSave}
          size="icon"
          variant="ghost"
        >
          <CheckIcon className="size-3.5" />
        </Button>
        <Button
          aria-label="Cancel editing"
          className="size-7 shrink-0 rounded-full text-foreground/60 backdrop-blur-sm hover:bg-foreground/10 hover:text-foreground"
          disabled={editForm.isPending}
          onClick={editForm.handleCancel}
          size="icon"
          variant="ghost"
        >
          <XIcon className="size-3.5" />
        </Button>
      </div>
    )
  }

  return (
    <InlineEditButton
      ariaLabel="Edit customer"
      onClick={() => editForm.startEditing('name')}
      size="sm"
    />
  )
}

// ─── Address badge ───────────────────────────────────────────────────────────

interface AddressBadgeProps {
  address: ReturnType<typeof formatCustomerAddress>
  canEdit: boolean
  onEdit: () => void
}

function AddressBadge({ address, canEdit, onEdit }: AddressBadgeProps) {
  if (!address.hasAddress) {
    if (!canEdit) {
      return null
    }
    return (
      <AddPlaceholder icon={<MapPinIcon className="size-3" />} label="Add address" onClick={onEdit} />
    )
  }

  return (
    <AddressAction address={address.singleLine} canEdit={canEdit} onEdit={onEdit}>
      <button type="button" className={BADGE_BASE} onClick={e => e.stopPropagation()}>
        <MapPinIcon className="size-3.5 shrink-0 text-white/80" />
        {/* Single-line across all breakpoints — truncation keeps the badge
            shape consistent with phone/email. On mobile the column stacks
            badges, so a narrower cap prevents the row from blowing out. */}
        <span className="max-w-52 truncate sm:max-w-95">{address.singleLine}</span>
      </button>
    </AddressAction>
  )
}

// ─── Phone badge ─────────────────────────────────────────────────────────────

interface PhoneBadgeProps {
  customer: Customer
  canEdit: boolean
  editForm: ReturnType<typeof useCustomerEditForm>
  phoneUnlocked: boolean
}

function PhoneBadge({ customer, canEdit, editForm, phoneUnlocked }: PhoneBadgeProps) {
  // Editing mode: render a compact inline input via the shared edit form.
  if (editForm.isEditing && canEdit) {
    return (
      <span className={cn(BADGE_BASE, 'px-2 py-0.5 cursor-default hover:bg-white/10')}>
        <PhoneIcon className="size-3.5 shrink-0 text-white/80" />
        <Input
          {...editForm.form.register('phone')}
          className="h-6 w-36 border-transparent bg-transparent px-0 text-xs text-white placeholder:text-white/50 focus-visible:ring-0"
          placeholder="Phone"
        />
      </span>
    )
  }

  if (customer.phone) {
    return (
      <PhoneAction
        canEdit={canEdit}
        onEdit={() => editForm.startEditing('phone')}
        phone={customer.phone}
      >
        <button type="button" className={BADGE_BASE} onClick={e => e.stopPropagation()}>
          <PhoneIcon className="size-3.5 shrink-0 text-white/80" />
          <span>{formatAsPhoneNumber(customer.phone)}</span>
        </button>
      </PhoneAction>
    )
  }

  // No phone on file. Only show "Add phone" when the viewer is entitled to see
  // the phone AND can edit — gated agents get nothing (no UI hint).
  if (phoneUnlocked && canEdit) {
    return (
      <AddPlaceholder
        icon={<PhoneIcon className="size-3" />}
        label="Add phone"
        onClick={() => editForm.startEditing('phone')}
      />
    )
  }

  return null
}

// ─── Email badge ─────────────────────────────────────────────────────────────

interface EmailBadgeProps {
  customer: Customer
  canEdit: boolean
  editForm: ReturnType<typeof useCustomerEditForm>
}

function EmailBadge({ customer, canEdit, editForm }: EmailBadgeProps) {
  if (editForm.isEditing && canEdit) {
    return (
      <span className={cn(BADGE_BASE, 'px-2 py-0.5 cursor-default hover:bg-white/10')}>
        <MailIcon className="size-3.5 shrink-0 text-white/80" />
        <Input
          {...editForm.form.register('email')}
          className="h-6 w-44 border-transparent bg-transparent px-0 text-xs text-white placeholder:text-white/50 focus-visible:ring-0"
          placeholder="Email"
          type="email"
        />
      </span>
    )
  }

  if (customer.email) {
    return (
      <EmailAction
        canEdit={canEdit}
        email={customer.email}
        onEdit={() => editForm.startEditing('email')}
      >
        <button type="button" className={BADGE_BASE} onClick={e => e.stopPropagation()}>
          <MailIcon className="size-3.5 shrink-0 text-white/80" />
          <span className="max-w-60 truncate">{customer.email}</span>
        </button>
      </EmailAction>
    )
  }

  if (canEdit) {
    return (
      <AddPlaceholder
        icon={<MailIcon className="size-3" />}
        label="Add email"
        onClick={() => editForm.startEditing('email')}
      />
    )
  }

  return null
}

// ─── "Add …" placeholder badge ────────────────────────────────────────────────

function AddPlaceholder({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/25 bg-transparent px-2.5 py-1 text-xs font-medium text-white/70 transition-colors hover:border-white/40 hover:bg-white/5 hover:text-white"
      onClick={onClick}
    >
      <PlusIcon className="size-3" />
      {icon}
      {label}
    </button>
  )
}
