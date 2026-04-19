'use client'

import type { ScheduleCalendarEvent, ScheduleMeetingEvent } from '@/features/schedule-management/types'
import type { MeetingType } from '@/shared/constants/enums'
import type { MeetingOverviewCardData } from '@/shared/entities/meetings/components/overview-card'

import { ChevronDownIcon, MapPinIcon } from 'lucide-react'
import { motion } from 'motion/react'

import { STATUS_BG_TINTS } from '@/features/schedule-management/constants/schedule-calendar-config'
import { MeetingOverviewCard } from '@/shared/entities/meetings/components/overview-card'
import { ParticipantsSlot } from '@/shared/entities/meetings/components/participants-slot'
import { cn } from '@/shared/lib/utils'

interface MeetingCardProps {
  event: ScheduleMeetingEvent
  onAssignOwner?: (event: ScheduleCalendarEvent) => void
  onUpdateScheduledFor: (meetingId: string, date: Date) => void
  isHighlighted?: boolean
  highlightRef?: React.RefCallback<HTMLDivElement>
}

export function MeetingCard({ event, onAssignOwner, onUpdateScheduledFor, isHighlighted, highlightRef }: MeetingCardProps) {
  const meetingData: MeetingOverviewCardData = {
    id: event.meetingId,
    meetingOutcome: event.meetingOutcome,
    meetingType: event.meetingType as MeetingType,
    scheduledFor: event.startAt,
    customerId: event.customerId,
    ownerId: event.ownerId,
    createdAt: event.createdAt,
    ownerName: event.ownerName,
    ownerImage: event.ownerImage,
    customerName: event.customerName,
    customerPhone: event.customerPhone,
    customerHasSentProposal: event.customerHasSentProposal,
    customerAddress: event.customerAddress,
    customerCity: event.customerCity,
    customerState: event.customerState,
    customerZip: event.customerZip,
  }

  const handleAssignOwner = onAssignOwner
    ? () => onAssignOwner(event)
    : undefined

  const cardContent = (
    <MeetingOverviewCard
      meeting={meetingData}
      customerId={event.customerId ?? ''}
      onAssignOwner={handleAssignOwner}
      className={cn(
        'group relative flex h-full flex-col gap-1 overflow-hidden rounded-md border p-2.5 text-xs cursor-pointer transition-colors hover:border-foreground/20',
        STATUS_BG_TINTS[event.meetingOutcome],
      )}
    >
      {/* Row 1: Status dot + customer name + actions */}
      <MeetingOverviewCard.Header className="gap-1.5 min-w-0">
        <MeetingOverviewCard.Fields fields={[{ field: 'outcome', variant: 'dot' }]} className="flex-none" />
        <MeetingOverviewCard.CustomerName className="font-medium truncate flex-1 min-w-0 leading-tight" />
        <MeetingOverviewCard.Actions
          mode="compact"
          className="shrink-0 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        />
      </MeetingOverviewCard.Header>

      {/* Row 2: Scheduled time (editable badge) */}
      <MeetingOverviewCard.Fields fields={[{
        field: 'scheduledDate',
        format: 'time-only',
        onChange: (date: Date) => onUpdateScheduledFor(event.meetingId, date),
      }]}
      />

      {/* Row 3: Participants — overlapping avatars with stable per-rep color +
          first names separated by `/`. Click opens a popover with full detail.
          Thumbnail is seeded from event.participants so this row doesn't fire
          a per-card getParticipants fetch at list render — the detail query
          runs lazily when the popover opens. */}
      <ParticipantsSlot
        meetingId={event.meetingId}
        variant="compact"
        initialParticipants={event.participants.map(p => ({
          id: p.id,
          name: p.name,
          image: p.image,
          role: p.role,
        }))}
      />

      {/* Row 4: Phone */}
      <MeetingOverviewCard.Phone />

      {/* Row 5: Address */}
      <MeetingOverviewCard.Address>
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer min-w-0"
          onClick={e => e.stopPropagation()}
        >
          <MapPinIcon size={14} className="shrink-0" />
          <span className="min-w-0">
            {event.customerAddress && <span className="block truncate text-left">{event.customerAddress}</span>}
            {[event.customerCity, event.customerState, event.customerZip].filter(Boolean).join(', ') && (
              <span className="block truncate text-left text-[10px] opacity-70">
                {[event.customerCity, event.customerState, event.customerZip].filter(Boolean).join(', ')}
              </span>
            )}
          </span>
          <ChevronDownIcon size={12} className="shrink-0" />
        </button>
      </MeetingOverviewCard.Address>
    </MeetingOverviewCard>
  )

  if (isHighlighted) {
    return (
      <div ref={highlightRef} className="relative rounded-md">
        {/* Glow overlay — uses opacity for smooth decay */}
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-md outline-2 outline-primary -outline-offset-2 shadow-[0_0_14px_3px_color-mix(in_oklch,var(--primary)_45%,transparent)]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 5, ease: 'easeIn', delay: 4 }}
        />
        {cardContent}
      </div>
    )
  }

  return cardContent
}
