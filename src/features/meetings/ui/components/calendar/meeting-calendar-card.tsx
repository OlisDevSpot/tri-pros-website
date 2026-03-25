'use client'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { MeetingOutcome } from '@/shared/types/enums'

import { format } from 'date-fns'
import { CalendarIcon, CopyIcon, MoreHorizontalIcon, PencilIcon, PlayIcon, TrashIcon } from 'lucide-react'

import { programAccentMap } from '@/features/meetings/constants/program-accent-map'
import { MEETING_PROGRAMS } from '@/features/meetings/constants/programs'
import { useSession } from '@/shared/auth/client'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'
import { cn } from '@/shared/lib/utils'

const STATUS_DOT_COLORS: Record<MeetingOutcome, string> = {
  in_progress: 'bg-blue-500',
  proposal_created: 'bg-emerald-500',
  follow_up_needed: 'bg-amber-500',
  not_interested: 'bg-red-500',
  no_show: 'bg-zinc-500',
}

const STATUS_BG_TINTS: Record<MeetingOutcome, string> = {
  in_progress: 'bg-blue-500/5 border-blue-500/20',
  proposal_created: 'bg-emerald-500/5 border-emerald-500/20',
  follow_up_needed: 'bg-amber-500/5 border-amber-500/20',
  not_interested: 'bg-red-500/5 border-red-500/20',
  no_show: 'bg-zinc-500/5 border-zinc-500/20',
}

interface MeetingCalendarCardProps {
  event: MeetingCalendarEvent
  onNavigate: (meetingId: string) => void
  onEdit: (meetingId: string) => void
  onStart: (meetingId: string) => void
  onDuplicate: (meetingId: string) => void
  onDelete: (meetingId: string) => void
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
}

export function MeetingCalendarCard({
  event,
  onNavigate,
  onEdit,
  onStart,
  onDuplicate,
  onDelete,
  onUpdateScheduledFor,
}: MeetingCalendarCardProps) {
  const { data: session } = useSession()
  const userRole = session?.user?.role

  const program = MEETING_PROGRAMS.find(p => p.accessor === event.selectedProgram)

  const addressLine1 = event.customerAddress ?? ''
  const addressLine2 = [event.customerCity, event.customerState, event.customerZip]
    .filter(Boolean)
    .join(', ')
  const fullAddress = [addressLine1, addressLine2].filter(Boolean).join(', ')

  return (
    <div
      className={cn(
        'group relative flex h-full flex-col gap-1.5 overflow-hidden rounded-md border p-2.5 text-xs cursor-pointer transition-colors hover:border-foreground/20',
        STATUS_BG_TINTS[event.meetingOutcome],
      )}
      onClick={() => onNavigate(event.meetingId)}
    >
      {/* Row 1: Status dot + customer name + actions */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            STATUS_DOT_COLORS[event.meetingOutcome],
          )}
        />
        <span className="font-medium truncate flex-1 leading-tight">
          {event.customerName ?? 'Unknown'}
        </span>
        <div
          className={cn(
            'shrink-0 opacity-0 transition-opacity',
            'group-hover:opacity-100',
          )}
          onClick={e => e.stopPropagation()}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5">
                <MoreHorizontalIcon className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onEdit(event.meetingId)}>
                <PencilIcon className="h-3.5 w-3.5" />
                Edit Setup
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onStart(event.meetingId)}>
                <PlayIcon className="h-3.5 w-3.5" />
                Start Meeting
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(event.meetingId)}>
                <CopyIcon className="h-3.5 w-3.5" />
                Duplicate
              </DropdownMenuItem>
              {userRole === 'super-admin' && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => onDelete(event.meetingId)}
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Row 2: Scheduled time (editable) */}
      <div className="min-w-0" onClick={e => e.stopPropagation()}>
        <DateTimePicker
          value={new Date(event.startAt)}
          onChange={(date) => {
            if (date) {
              onUpdateScheduledFor(event.meetingId, date)
            }
          }}
          className="h-auto px-1 py-0 text-[11px] text-muted-foreground hover:text-foreground"
        >
          <CalendarIcon className="h-3 w-3 shrink-0" />
          <span>{format(new Date(event.startAt), 'h:mm a')}</span>
        </DateTimePicker>
      </div>

      {/* Row 3: Program badge */}
      {program && (
        <Badge
          className={cn(
            'w-fit text-[10px] px-1.5 py-0 leading-4 truncate',
            programAccentMap[program.accentColor].badge,
          )}
        >
          {program.name}
        </Badge>
      )}

      {/* Row 3: Phone */}
      {event.customerPhone && (
        <div
          className="min-w-0 text-muted-foreground"
          onClick={e => e.stopPropagation()}
        >
          <PhoneAction phone={event.customerPhone} className="text-[11px]" />
        </div>
      )}

      {/* Row 4: Address (2 lines) */}
      {fullAddress && (
        <div
          className="min-w-0 text-muted-foreground"
          onClick={e => e.stopPropagation()}
        >
          <AddressAction address={fullAddress} className="text-[11px]">
            <div className="flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer min-w-0">
              <span className="min-w-0">
                {addressLine1 && <span className="block truncate">{addressLine1}</span>}
                {addressLine2 && <span className="block truncate text-[10px] opacity-70">{addressLine2}</span>}
              </span>
            </div>
          </AddressAction>
        </div>
      )}
    </div>
  )
}
