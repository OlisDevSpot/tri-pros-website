'use client'

import type { CustomerProfileMeeting } from '@/shared/entities/customers/types'
import { CalendarIcon, CalendarPlusIcon } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/shared/components/ui/button'
import { DropdownMenuItem, DropdownMenuLabel } from '@/shared/components/ui/dropdown-menu'
import { ROOTS } from '@/shared/config/roots'
import { formatMeetingDate, formatMeetingType } from '@/shared/entities/customers/lib/format-profile-meeting'

interface Props {
  meetings: CustomerProfileMeeting[]
  onAddMeeting: () => void
  // `menu` renders inside a DropdownMenuContent (rail); `list` renders inside the phone New sheet,
  // whose own header already names the step.
  presentation: 'menu' | 'list'
}

// A proposal always attaches to a meeting, so the picker makes that choice explicit and routes an
// empty list straight to booking one. Navigating away closes the profile (GlobalDialogs).
export function CustomerProposalPicker({ meetings, onAddMeeting, presentation }: Props) {
  const isMenu = presentation === 'menu'

  const rows = meetings.map((m) => {
    const content = (
      <>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{formatMeetingType(m.meetingType)}</span>
          <span className="truncate text-xs text-muted-foreground">
            {formatMeetingDate(m.scheduledFor)}
            {m.meetingOutcome ? ` · ${m.meetingOutcome.replace(/_/g, ' ')}` : ''}
          </span>
        </span>
      </>
    )
    return isMenu
      ? (
          <DropdownMenuItem asChild key={m.id}>
            <Link className="flex cursor-pointer items-center gap-2" href={ROOTS.dashboard.proposals.newForMeeting(m.id)}>
              {content}
            </Link>
          </DropdownMenuItem>
        )
      : (
          <li key={m.id}>
            <Link
              className="flex min-h-12 w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted motion-reduce:transition-none"
              href={ROOTS.dashboard.proposals.newForMeeting(m.id)}
            >
              {content}
            </Link>
          </li>
        )
  })

  const empty = (
    <div className="px-2 py-3 text-center">
      <CalendarIcon className="mx-auto mb-1.5 size-5 text-muted-foreground" />
      <p className="text-sm font-medium">No meetings yet</p>
      <p className="mb-2.5 text-xs text-muted-foreground">A proposal is built against a meeting.</p>
      {isMenu
        ? (
            <DropdownMenuItem className="cursor-pointer justify-center bg-secondary font-medium" onSelect={onAddMeeting}>
              <CalendarPlusIcon className="size-4" />
              Add a meeting first
            </DropdownMenuItem>
          )
        : (
            <Button className="h-11 w-full" onClick={onAddMeeting} variant="outline">
              <CalendarPlusIcon className="size-4" />
              Add a meeting first
            </Button>
          )}
    </div>
  )

  if (!isMenu) {
    return meetings.length === 0 ? empty : <ul className="flex flex-col gap-1">{rows}</ul>
  }

  return (
    <>
      <DropdownMenuLabel className="flex flex-col gap-0.5">
        <span>New proposal</span>
        <span className="text-xs font-normal text-muted-foreground">Attach it to a meeting</span>
      </DropdownMenuLabel>
      {meetings.length === 0 ? empty : rows}
    </>
  )
}
