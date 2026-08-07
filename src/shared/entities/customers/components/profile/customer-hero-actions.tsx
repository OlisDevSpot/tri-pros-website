'use client'

import type { CustomerProfileData, CustomerProfileMeeting } from '@/shared/entities/customers/types'

import {
  CalendarIcon,
  CalendarPlusIcon,
  FileTextIcon,
  MoreHorizontalIcon,
  StickyNoteIcon,
} from 'lucide-react'
import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { ROOTS } from '@/shared/config/roots'
import { useAbility } from '@/shared/domains/permissions/hooks'
import { CreateMeetingForm } from '@/shared/entities/meetings/components/create-meeting-form'
import { cn } from '@/shared/lib/utils'
import { QuickNoteInput } from '../timeline/quick-note-input'

type Customer = CustomerProfileData['customer']

interface Props {
  customer: Customer
  meetings: CustomerProfileMeeting[]
  onMutationSuccess: () => void
  // `desktop` renders the icon-button cluster (sits beside the view toggle in
  // the header row); `mobile` renders the single collapsed ⋯ trigger (placed
  // top-left of the hero). Split so each can live in a different part of the
  // modal; both share the same state + nested dialogs.
  variant: 'desktop' | 'mobile'
}

// Cluster shell + button styling mirror <HeroViewToggle> so the two read as one
// control family in the modal's dark header row.
const CLUSTER = 'inline-flex items-center gap-0.5 rounded-full border border-white/15 bg-black/40 p-0.5 backdrop-blur-md'
const ACTION_BTN = 'flex size-7 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-40'

function formatMeetingType(t: string | null): string {
  if (!t) {
    return 'Meeting'
  }
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function formatMeetingDate(d: CustomerProfileMeeting['scheduledFor']): string {
  if (!d) {
    return 'Unscheduled'
  }
  const date = new Date(d)
  return Number.isNaN(date.getTime())
    ? 'Unscheduled'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * Common-action cluster for the customer profile modal — owns the deal-advancing
 * verbs (Add meeting / New proposal / Add note). Call/Text/Email deliberately
 * live only in the contact badges below the name, not here, to avoid duplicate
 * action homes. Every dropdown is `modal={false}` — the surrounding Dialog
 * already owns focus + scroll containment, and a nested modal dropdown would
 * double-lock the body and freeze the page.
 */
export function CustomerHeroActions({ customer, meetings, onMutationSuccess, variant }: Props) {
  const ability = useAbility()
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)

  const canAddMeeting = ability.can('create', 'Meeting')
  const canAddProposal = ability.can('create', 'Proposal')

  const newProposalHref = (meetingId: string) => `${ROOTS.dashboard.proposals.new()}?meetingId=${meetingId}`

  const dialogs = (
    <>
      <Dialog onOpenChange={setMeetingOpen} open={meetingOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add meeting</DialogTitle>
          </DialogHeader>
          <CreateMeetingForm
            customerId={customer.id}
            customerName={customer.name}
            onCancel={() => setMeetingOpen(false)}
            onSuccess={() => {
              setMeetingOpen(false)
              onMutationSuccess()
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog onOpenChange={setNoteOpen} open={noteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add note</DialogTitle>
          </DialogHeader>
          <QuickNoteInput
            customerId={customer.id}
            onSuccess={() => {
              setNoteOpen(false)
              onMutationSuccess()
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )

  // ── Mobile: single collapsed Actions menu (placed top-left of the hero) ──
  if (variant === 'mobile') {
    return (
      <>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button aria-label="Customer actions" className={cn(CLUSTER, 'size-7 justify-center text-white/85 hover:bg-white/10 hover:text-white')} type="button">
              <MoreHorizontalIcon className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            {canAddMeeting && (
              <DropdownMenuItem onSelect={() => setMeetingOpen(true)}>
                <CalendarIcon className="size-4" />
                Add meeting
              </DropdownMenuItem>
            )}
            {canAddProposal && (
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <FileTextIcon className="size-4" />
                  New proposal
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-64">
                  <ProposalPickerBody href={newProposalHref} meetings={meetings} onAddMeeting={() => setMeetingOpen(true)} />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            )}
            <DropdownMenuItem onSelect={() => setNoteOpen(true)}>
              <StickyNoteIcon className="size-4" />
              Add note
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {dialogs}
      </>
    )
  }

  // ── Desktop: verb icon buttons (base glyph + plus badge) ──
  return (
    <>
      <div className={cn(CLUSTER, 'hidden sm:inline-flex')}>
        {canAddMeeting && (
          <button aria-label="Add meeting" className={ACTION_BTN} onClick={() => setMeetingOpen(true)} title="Add meeting" type="button">
            <CalendarIcon className="size-3.5" />
          </button>
        )}
        {canAddProposal && (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button aria-label="New proposal" className={ACTION_BTN} title="New proposal" type="button">
                <FileTextIcon className="size-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <ProposalPickerBody href={newProposalHref} meetings={meetings} onAddMeeting={() => setMeetingOpen(true)} />
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <button aria-label="Add note" className={ACTION_BTN} onClick={() => setNoteOpen(true)} title="Add note" type="button">
          <StickyNoteIcon className="size-3.5" />
        </button>
      </div>
      {dialogs}
    </>
  )
}

// Proposal target picker — a proposal always attaches to a meeting, so this
// makes the choice explicit and legible: a titled header, one readable row per
// meeting (type · date, outcome as context), and an empty state that routes
// straight to scheduling one. Shared by the desktop dropdown and mobile submenu.
function ProposalPickerBody({ meetings, href, onAddMeeting }: {
  meetings: CustomerProfileMeeting[]
  href: (meetingId: string) => string
  onAddMeeting: () => void
}) {
  return (
    <>
      <DropdownMenuLabel className="flex flex-col gap-0.5">
        <span>New proposal</span>
        <span className="text-xs font-normal text-muted-foreground">
          Attach it to a meeting
        </span>
      </DropdownMenuLabel>

      {meetings.length === 0
        ? (
            <div className="px-2 py-3 text-center">
              <CalendarIcon className="mx-auto mb-1.5 size-5 text-muted-foreground" />
              <p className="text-sm font-medium">No meetings yet</p>
              <p className="mb-2.5 text-xs text-muted-foreground">
                A proposal is built against a meeting.
              </p>
              <DropdownMenuItem
                className="cursor-pointer justify-center bg-secondary font-medium"
                onSelect={onAddMeeting}
              >
                <CalendarPlusIcon className="size-4" />
                Add a meeting first
              </DropdownMenuItem>
            </div>
          )
        : (
            meetings.map(m => (
              <DropdownMenuItem asChild key={m.id}>
                <a className="flex cursor-pointer items-center gap-2" href={href(m.id)}>
                  <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">
                      {formatMeetingType(m.meetingType)}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {formatMeetingDate(m.scheduledFor)}
                      {m.meetingOutcome ? ` · ${m.meetingOutcome.replace(/_/g, ' ')}` : ''}
                    </span>
                  </span>
                </a>
              </DropdownMenuItem>
            ))
          )}
    </>
  )
}
