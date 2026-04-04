'use client'

import type { MeetingCalendarEvent } from '@/features/meetings/types'
import type { EntityActionConfig } from '@/shared/components/entity-actions/types'
import type { MeetingOutcome } from '@/shared/types/enums'

import { format } from 'date-fns'
import { CalendarIcon, ChevronDownIcon, MapPinIcon } from 'lucide-react'

import { MEETING_OUTCOME_DOT_COLORS } from '@/features/meetings/constants/status-colors'
import { AddressAction } from '@/shared/components/contact-actions/ui/address-action'
import { PhoneAction } from '@/shared/components/contact-actions/ui/phone-action'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { isSelectAction } from '@/shared/components/entity-actions/types'
import { EntityActionMenu } from '@/shared/components/entity-actions/ui/entity-action-menu'
import { Badge } from '@/shared/components/ui/badge'
import { cn } from '@/shared/lib/utils'

const STATUS_BG_TINTS: Partial<Record<MeetingOutcome, string>> = {
  not_set: 'bg-zinc-500/5 border-zinc-500/20',
  converted_to_project: 'bg-emerald-500/5 border-emerald-500/20',
  proposal_sent: 'bg-lime-500/5 border-lime-500/20',
  proposal_created: 'bg-amber-500/5 border-amber-500/20',
  follow_up_needed: 'bg-purple-500/5 border-purple-500/20',
  not_good: 'bg-red-500/5 border-red-500/20',
  pns: 'bg-red-500/5 border-red-500/20',
  npns: 'bg-red-500/5 border-red-500/20',
  ftd: 'bg-red-500/5 border-red-500/20',
  no_show: 'bg-red-500/5 border-red-500/20',
  lost_to_competitor: 'bg-red-500/5 border-red-500/20',
  not_interested: 'bg-red-500/5 border-red-500/20',
}

interface MeetingCalendarCardProps {
  event: MeetingCalendarEvent
  actions: EntityActionConfig<MeetingCalendarEvent>[]
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
}

export function MeetingCalendarCard({
  event,
  actions,
  onUpdateScheduledFor,
}: MeetingCalendarCardProps) {
  const viewAction = actions.find(a => a.action.primary && !isSelectAction(a))

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
      onClick={() => viewAction && !isSelectAction(viewAction) && viewAction.onAction(event)}
    >
      {/* Row 1: Status dot + customer name + actions */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            'h-2 w-2 shrink-0 rounded-full',
            MEETING_OUTCOME_DOT_COLORS[event.meetingOutcome],
          )}
        />
        <span className="font-medium truncate flex-1 leading-tight">
          {event.customerName ?? 'Unknown'}
        </span>
        <EntityActionMenu
          entity={event}
          actions={actions}
          mode="compact"
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        />
      </div>

      {/* Row 2: Scheduled time (editable badge) */}
      <div className="min-w-0" onClick={e => e.stopPropagation()}>
        <DateTimePicker
          value={new Date(event.startAt)}
          onChange={(date) => {
            if (date) {
              onUpdateScheduledFor(event.meetingId, date)
            }
          }}
          className="h-auto p-0 text-[11px]"
        >
          <Badge variant="secondary" className="gap-1 px-1.5 py-0.5 text-[11px] font-normal hover:bg-secondary/80">
            <CalendarIcon className="h-3 w-3 shrink-0" />
            <span>{format(new Date(event.startAt), 'h:mm a')}</span>
          </Badge>
        </DateTimePicker>
      </div>

      {/* Row 3: Phone */}
      {event.customerPhone && (
        <div
          className="min-w-0 text-muted-foreground"
          onClick={e => e.stopPropagation()}
        >
          <PhoneAction phone={event.customerPhone} className="text-[11px]" />
        </div>
      )}

      {/* Row 4: Address */}
      {fullAddress && (
        <div
          className="min-w-0 text-muted-foreground"
          onClick={e => e.stopPropagation()}
        >
          <AddressAction address={fullAddress} className="text-[11px]">
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-w-0"
              onClick={e => e.stopPropagation()}
            >
              <MapPinIcon size={14} className="shrink-0" />
              <span className="min-w-0">
                {addressLine1 && <span className="block truncate text-left">{addressLine1}</span>}
                {addressLine2 && <span className="block truncate text-left text-[10px] opacity-70">{addressLine2}</span>}
              </span>
              <ChevronDownIcon size={12} className="shrink-0" />
            </button>
          </AddressAction>
        </div>
      )}
    </div>
  )
}
