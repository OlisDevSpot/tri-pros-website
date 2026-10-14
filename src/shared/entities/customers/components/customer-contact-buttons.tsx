'use client'

import type { PointerEvent, ReactElement } from 'react'
import type { ContactMenuControl } from '@/shared/components/contact-actions/types'
import type { ContactActionSurface } from '@/shared/components/contact-actions/ui/contact-action-trigger-variants'

import { MailIcon, MapPinIcon, PhoneIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { ContactActionTrigger } from '@/shared/components/contact-actions/ui/contact-action-trigger'
import { EmailAction } from '@/shared/components/contact-actions/ui/email-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { stopReactPropagationOnly } from '@/shared/components/ui/dialog'
import { capsuleButtons, capsuleKeyTarget } from '@/shared/entities/customers/lib/contact-capsule-keys'
import { formatPhone } from '@/shared/lib/phone'
import { cn } from '@/shared/lib/utils'

interface CustomerContact {
  phone: string | null
  email: string | null
  /** One line, ready for Maps. */
  address?: string | null
}

interface Props {
  contact: CustomerContact
  surface?: ContactActionSurface
  /** `discs`: round thumb targets (the phone hero). `capsule`: one slim toolbar of icon buttons, for dense rows. */
  variant?: 'discs' | 'capsule'
  /** Capsule only: the toolbar's accessible name, e.g. "Contact Dexter Smith". */
  label?: string
  /** Capsule only: hands focus back to whatever the capsule sits in (← on the first button, ↑, or closing a menu opened by pointer). */
  onLeave?: (group: HTMLElement) => void
  className?: string
}

type ContactKind = 'phone' | 'email' | 'address'
type Trigger = (rovingStop: boolean) => ReactElement

export function CustomerContactButtons({ contact, surface = 'card', variant = 'discs', label, onLeave, className }: Props) {
  const [stop, setStop] = useState(0)
  const [openKind, setOpenKind] = useState<ContactKind | null>(null)
  const lastInput = useRef<'touch' | 'pointer' | 'keyboard'>('keyboard')
  const groupRef = useRef<HTMLDivElement>(null)
  const { phone, email, address } = contact
  const capsule = variant === 'capsule'
  const shape = capsule ? 'icon' : 'round'

  // Capsule only: the menu opens on a tap's click, not on touch-down, so a scroll that starts on a button never opens one.
  const menuControl = (kind: ContactKind): ContactMenuControl => capsule
    ? {
        open: openKind === kind,
        onOpenChange: open => setOpenKind(open ? kind : null),
        onCloseAutoFocus: (event) => {
          // A pointer user goes back to typing; a keyboard user stays on the button, as Radix does.
          if (lastInput.current !== 'keyboard' && onLeave && groupRef.current) {
            event.preventDefault()
            onLeave(groupRef.current)
          }
        },
      }
    : {}
  const triggerProps = (kind: ContactKind, rovingStop: boolean) => capsule
    ? {
        // Every button stays out of the Tab order: the capsule is entered from its row (→ in the omni palette).
        'tabIndex': -1,
        'data-roving-stop': rovingStop ? '' : undefined,
        'onPointerDown': (event: PointerEvent<HTMLButtonElement>) => {
          lastInput.current = event.pointerType === 'touch' ? 'touch' : 'pointer'
          if (event.pointerType === 'touch') {
            event.preventDefault()
          }
        },
        'onClick': () => {
          if (lastInput.current === 'touch') {
            setOpenKind(kind)
          }
        },
      }
    : {}

  const triggers = [
    phone && ((rovingStop: boolean) => (
      <PhoneAction key="phone" phone={phone} {...menuControl('phone')}>
        <ContactActionTrigger icon={PhoneIcon} label={`Call or text ${formatPhone(phone)}`} shape={shape} surface={surface} {...triggerProps('phone', rovingStop)} />
      </PhoneAction>
    )),
    email && ((rovingStop: boolean) => (
      <EmailAction key="email" email={email} {...menuControl('email')}>
        <ContactActionTrigger icon={MailIcon} label={`Email ${email}`} shape={shape} surface={surface} {...triggerProps('email', rovingStop)} />
      </EmailAction>
    )),
    address && ((rovingStop: boolean) => (
      <AddressAction key="address" address={address} {...menuControl('address')}>
        <ContactActionTrigger icon={MapPinIcon} label={`Address: ${address}`} shape={shape} surface={surface} {...triggerProps('address', rovingStop)} />
      </AddressAction>
    )),
  ].filter((trigger): trigger is Trigger => !!trigger)

  if (triggers.length === 0) {
    return null
  }

  if (!capsule) {
    return <div className={cn('flex shrink-0 items-center gap-2', className)}>{triggers.map(trigger => trigger(false))}</div>
  }

  const active = Math.min(stop, triggers.length - 1)

  return (
    <div
      ref={groupRef}
      aria-label={label}
      className={cn('flex shrink-0 items-center rounded-lg border border-control-border bg-card p-px', className)}
      data-contact-actions=""
      data-slot="control-group"
      role="toolbar"
      // Contains the click so a clickable row behind the capsule doesn't fire, without stopping the native click Radix's touch tap-away needs.
      onClick={stopReactPropagationOnly}
      onFocus={(event) => {
        // React's focus target is typed as the div; a focused button is the element that contains it.
        const index = capsuleButtons(event.currentTarget).findIndex(button => button.contains(event.target))
        if (index >= 0) {
          setStop(index)
        }
      }}
      onKeyDown={(event) => {
        // Tab belongs to the dialog's focus trap. Every other key would reach a list behind the capsule
        // (cmdk moves or opens its highlighted row on arrows, Enter and Ctrl+N/P), even from an open menu,
        // which is portaled but still bubbles here through React.
        if (event.key === 'Tab') {
          return
        }
        event.stopPropagation()
        const group = event.currentTarget
        const buttons = capsuleButtons(group)
        const index = buttons.findIndex(button => button === event.target)
        if (index === -1) {
          return
        }
        // A key on a button (not inside its menu) marks a keyboard user, whose menu closes back onto its button.
        lastInput.current = 'keyboard'
        const target = capsuleKeyTarget(event.key, index, buttons.length)
        if (target === null) {
          return
        }
        event.preventDefault()
        if (target === 'leave') {
          onLeave?.(group)
          return
        }
        buttons[target]?.focus()
      }}
    >
      {triggers.map((trigger, index) => trigger(index === active))}
    </div>
  )
}
