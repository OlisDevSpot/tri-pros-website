'use client'

import type { MouseEvent } from 'react'

import { UserRoundIcon } from 'lucide-react'

import { CustomerProfileModal } from '@/shared/entities/customers/components/profile/customer-profile-modal'
import { useModalStore } from '@/shared/hooks/use-modal-store'
import { cn } from '@/shared/lib/utils'

interface DashboardProposalCustomerLinkProps {
  customerId: string | null
  customerName: string | null
  /** The meeting the proposal belongs to — highlighted in the modal's meetings tab. */
  meetingId: string | null
  className?: string
}

/**
 * The proposal's customer, rendered as the clickable anchor of the card's meta
 * row. Opens the shared `CustomerProfileModal` on the meetings tab with the
 * proposal's own meeting highlighted — the same `useModalStore` entrypoint the
 * dashboard meeting card uses, so both rosters open the identical modal. Stops
 * propagation so the click never also triggers the card root's "open proposal
 * review" handler. Renders nothing when the row has no joined customer.
 */
export function DashboardProposalCustomerLink({ customerId, customerName, meetingId, className }: DashboardProposalCustomerLinkProps) {
  const { open: openModal, setModal } = useModalStore()

  if (!customerId || !customerName) {
    return null
  }

  function handleClick(e: MouseEvent) {
    e.stopPropagation()
    setModal({
      accessor: 'CustomerProfile',
      Component: CustomerProfileModal,
      props: { customerId: customerId as string, defaultTab: 'meetings' as const, highlightMeetingId: meetingId ?? undefined },
    })
    openModal()
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'inline-flex min-w-0 items-center gap-1 rounded text-xs font-medium text-foreground/85 underline-offset-2 transition-colors duration-200 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        className,
      )}
    >
      <UserRoundIcon className="size-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="truncate">{customerName}</span>
    </button>
  )
}
