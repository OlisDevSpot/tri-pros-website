'use client'

import type { MouseEvent } from 'react'
import type { ProposalContextTab } from '@/features/proposal-flow/types'

import { format } from 'date-fns'
import { CalendarIcon, ChevronDownIcon } from 'lucide-react'
import { useRef, useState } from 'react'

import { PROPOSAL_CUSTOMER_OVERRIDES } from '@/features/proposal-flow/lib/customer-action-overrides'
import { Avatar, AvatarFallback } from '@/shared/components/ui/avatar'
import { Drawer, DrawerContent, DrawerTitle } from '@/shared/components/ui/drawer'
import { Popover, PopoverAnchor, PopoverContent } from '@/shared/components/ui/popover'
import { getInitials } from '@/shared/entities/users/lib/get-initials'
import { useIsMobile } from '@/shared/hooks/use-mobile'
import { cn } from '@/shared/lib/utils'
import { CustomerActionsHost } from '@/shared/modules/customers/core/components/customer-actions-host'
import { MeetingActionsHost } from '@/shared/modules/meetings/core/components/meeting-actions-host'
import { ProposalActionsHost } from '@/shared/modules/proposals/core/components/proposal-actions-host'
import { ProposalContextPanel } from './proposal-context-panel'

interface Props {
  customer: { id: string, name: string }
  meetingId: string | null
  meetingScheduledFor: string | null
}

export function ProposalContextTrigger({ customer, meetingId, meetingScheduledFor }: Props) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<ProposalContextTab>('customer')
  const pillRef = useRef<HTMLDivElement>(null)
  const lastHalfRef = useRef<HTMLButtonElement | null>(null)
  const visitDate = meetingScheduledFor ? format(meetingScheduledFor, 'MMM d') : null

  function onHalfClick(next: ProposalContextTab, event: MouseEvent<HTMLButtonElement>) {
    lastHalfRef.current = event.currentTarget
    if (open && tab === next) {
      setOpen(false)
      return
    }
    setTab(next)
    setOpen(true)
  }

  // A close that moved focus somewhere on purpose (a dialog an action opened, a field clicked) keeps it there.
  function returnFocus(event: Event) {
    event.preventDefault()
    const active = document.activeElement
    const panel = event.target instanceof Node ? event.target : null
    if (active === null || active === document.body || panel?.contains(active)) {
      lastHalfRef.current?.focus()
    }
  }

  const halfClassName = 'flex h-full min-w-0 items-center outline-none hover:bg-control-hover pressed:bg-press focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset'

  const pill = (
    <div ref={pillRef} className="inline-flex h-9 w-full max-w-full min-w-0 items-center overflow-hidden rounded-lg border border-control-border bg-control text-sm md:w-auto">
      <button
        type="button"
        aria-label={`Customer: ${customer.name}`}
        aria-haspopup="dialog"
        aria-expanded={open && tab === 'customer'}
        onClick={event => onHalfClick('customer', event)}
        className={cn(halfClassName, 'flex-1 gap-2 pr-3 pl-1.5 md:flex-initial')}
      >
        <Avatar className="size-6">
          <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">{getInitials(customer.name)}</AvatarFallback>
        </Avatar>
        <span className="truncate font-semibold">{customer.name}</span>
      </button>
      {meetingId && (
        <button
          type="button"
          aria-label={visitDate ? `In-home visit: ${visitDate}` : 'In-home visit'}
          aria-haspopup="dialog"
          aria-expanded={open && tab === 'visit'}
          onClick={event => onHalfClick('visit', event)}
          className={cn(halfClassName, 'shrink-0 gap-1.5 border-l border-control-border px-2.5')}
        >
          <CalendarIcon className="size-4 text-muted-foreground" />
          {visitDate && <span className="whitespace-nowrap">{visitDate}</span>}
          <ChevronDownIcon className={cn('size-4 text-muted-foreground transition-transform motion-reduce:transition-none', open && 'rotate-180')} />
        </button>
      )}
    </div>
  )

  const panel = <ProposalContextPanel customerId={customer.id} meetingId={meetingId} tab={tab} onTabChange={setTab} />

  // The hosts sit outside the panel: the dialogs they own (reschedule, outcome, participants) must outlive the panel closing under them.
  // The proposal host serves the visit card's proposal rows.
  return (
    <ProposalActionsHost>
      <MeetingActionsHost>
        <CustomerActionsHost overrides={PROPOSAL_CUSTOMER_OVERRIDES}>
          {isMobile
            ? (
                <>
                  {pill}
                  <Drawer open={open} onOpenChange={setOpen} autoFocus>
                    {/* A fixed height keeps the actions row high on the screen, so their menus have room to open downward. */}
                    <DrawerContent aria-describedby={undefined} onCloseAutoFocus={returnFocus} className="h-[80dvh]">
                      <DrawerTitle className="sr-only">{tab === 'customer' ? 'Customer' : 'In-home visit'}</DrawerTitle>
                      <div className="min-h-0 flex-1 overflow-y-auto p-4">{panel}</div>
                    </DrawerContent>
                  </Drawer>
                </>
              )
            : (
                <Popover open={open} onOpenChange={setOpen}>
                  <PopoverAnchor asChild>{pill}</PopoverAnchor>
                  <PopoverContent
                    align="center"
                    className="max-h-(--radix-popover-content-available-height) w-100 overflow-y-auto p-4"
                    onCloseAutoFocus={returnFocus}
                    // The pill is the anchor, not a trigger: a press on it is a half's click, which toggles or switches tabs.
                    onInteractOutside={(event) => {
                      if (event.target instanceof Node && pillRef.current?.contains(event.target)) {
                        event.preventDefault()
                      }
                    }}
                  >
                    {panel}
                  </PopoverContent>
                </Popover>
              )}
        </CustomerActionsHost>
      </MeetingActionsHost>
    </ProposalActionsHost>
  )
}
