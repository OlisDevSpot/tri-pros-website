'use client'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { MeetingOutcome } from '@/shared/types/enums'

import { format } from 'date-fns'
import { CopyIcon, EyeIcon, PencilIcon, PlayIcon, TrashIcon } from 'lucide-react'

import { MEETING_OUTCOME_COLORS } from '@/features/meetings/constants/status-colors'
import { useSession } from '@/shared/auth/client'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Badge } from '@/shared/components/ui/badge'
import { Button } from '@/shared/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/shared/components/ui/popover'
import { cn } from '@/shared/lib/utils'

const STATUS_DOT_COLORS: Record<MeetingOutcome, string> = {
  not_set: 'bg-blue-500',
  proposal_created: 'bg-emerald-500',
  follow_up_needed: 'bg-amber-500',
  not_interested: 'bg-red-500',
  no_show: 'bg-zinc-500',
}

const STATUS_LABELS: Record<MeetingOutcome, string> = {
  not_set: 'In Progress',
  proposal_created: 'Proposal Created',
  follow_up_needed: 'Follow-up Needed',
  not_interested: 'Not Interested',
  no_show: 'No Show',
}

interface MeetingCalendarDotProps {
  event: MeetingCalendarEvent
  onNavigate: (customerId: string, meetingId: string) => void
  onEdit: (meetingId: string) => void
  onStart: (meetingId: string) => void
  onDuplicate: (meetingId: string) => void
  onDelete: (meetingId: string) => void
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
}

export function MeetingCalendarDot({
  event,
  onNavigate,
  onEdit,
  onStart,
  onDuplicate,
  onDelete,
  onUpdateScheduledFor,
}: MeetingCalendarDotProps) {
  const { data: session } = useSession()
  const userRole = session?.user?.role

  const formattedTime = format(new Date(event.startAt), 'h:mm a')
  const formattedDateTime = format(new Date(event.startAt), 'MMM d, h:mm a')

  const formattedAddress = [event.customerAddress, event.customerCity]
    .filter(Boolean)
    .join(', ')

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-accent transition-colors text-left min-w-0"
        >
          <span
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              STATUS_DOT_COLORS[event.meetingOutcome],
            )}
          />
          <span className="text-muted-foreground shrink-0">{formattedTime}</span>
          <span className="truncate">{event.customerName ?? 'No customer'}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3 p-3">
        {/* Customer name */}
        <p className="font-semibold text-sm leading-tight truncate">
          {event.customerName ?? 'No customer'}
        </p>

        {/* Time + date (editable) */}
        <div onClick={e => e.stopPropagation()}>
          <DateTimePicker
            value={new Date(event.startAt)}
            onChange={(date) => {
              if (date) {
                onUpdateScheduledFor(event.meetingId, date)
              }
            }}
            className="h-auto px-1 py-0 text-xs text-muted-foreground hover:text-foreground"
          >
            <span>{formattedDateTime}</span>
          </DateTimePicker>
        </div>

        {/* Status badge */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge className={cn('text-[10px] px-1.5 py-0 leading-4', MEETING_OUTCOME_COLORS[event.meetingOutcome])}>
            {STATUS_LABELS[event.meetingOutcome]}
          </Badge>
        </div>

        {/* Contact actions */}
        {event.customerPhone && (
          <div className="text-muted-foreground" onClick={e => e.stopPropagation()}>
            <PhoneAction phone={event.customerPhone} className="text-xs" />
          </div>
        )}
        {formattedAddress && (
          <div className="text-muted-foreground" onClick={e => e.stopPropagation()}>
            <AddressAction address={formattedAddress} className="text-xs" />
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-1 border-t pt-2">
          <Button
            variant="ghost"
            size="sm"
            className="justify-start h-7 text-xs"
            onClick={() => event.customerId && onNavigate(event.customerId, event.meetingId)}
          >
            <EyeIcon className="h-3.5 w-3.5" />
            View Meeting
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start h-7 text-xs"
            onClick={() => onEdit(event.meetingId)}
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Edit Setup
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start h-7 text-xs"
            onClick={() => onStart(event.meetingId)}
          >
            <PlayIcon className="h-3.5 w-3.5" />
            Start Flow
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="justify-start h-7 text-xs"
            onClick={() => onDuplicate(event.meetingId)}
          >
            <CopyIcon className="h-3.5 w-3.5" />
            Duplicate
          </Button>
          {userRole === 'super-admin' && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-start h-7 text-xs text-destructive hover:text-destructive"
              onClick={() => onDelete(event.meetingId)}
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Delete
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
