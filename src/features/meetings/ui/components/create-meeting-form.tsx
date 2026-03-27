'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { MeetingType } from '@/shared/types/enums/meetings'

import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'

import { MeetingScopesPicker } from '@/features/meetings/ui/components/meeting-scopes-picker'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { meetingTypes } from '@/shared/constants/enums'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface CreateMeetingFormProps {
  customerId: string
  customerName: string
  /** Pass to enable edit mode — pre-fills form and uses update mutation */
  editMeetingId?: string
  initialValues?: {
    meetingType?: MeetingType
    scheduledFor?: Date
    tradeSelections?: TradeSelection[]
  }
  onSuccess?: () => void
  onCancel?: () => void
}

export function CreateMeetingForm({
  customerId,
  editMeetingId,
  initialValues,
  onCancel,
  onSuccess,
}: CreateMeetingFormProps) {
  const trpc = useTRPC()
  const isEditMode = !!editMeetingId

  const [meetingType, setMeetingType] = useState<MeetingType>(initialValues?.meetingType ?? 'Fresh')
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(initialValues?.scheduledFor)
  const [tradeSelections, setTradeSelections] = useState<TradeSelection[]>(initialValues?.tradeSelections ?? [])

  const createMutation = useMutation(
    trpc.meetingsRouter.create.mutationOptions({
      onSuccess: () => {
        setMeetingType('Fresh')
        setScheduledFor(undefined)
        setTradeSelections([])
        onSuccess?.()
      },
    }),
  )

  const updateMutation = useMutation(
    trpc.meetingsRouter.update.mutationOptions({
      onSuccess: () => {
        onSuccess?.()
      },
    }),
  )

  const isPending = createMutation.isPending || updateMutation.isPending

  function handleSubmit() {
    if (!meetingType) {
      return
    }

    if (isEditMode) {
      updateMutation.mutate({
        id: editMeetingId,
        meetingType,
        scheduledFor: scheduledFor?.toISOString(),
        flowStateJSON: tradeSelections.length > 0
          ? { tradeSelections }
          : undefined,
      })
    }
    else {
      createMutation.mutate({
        customerId,
        meetingType,
        scheduledFor: scheduledFor?.toISOString(),
        flowStateJSON: tradeSelections.length > 0
          ? { tradeSelections }
          : undefined,
      })
    }
  }

  return (
    <div className="w-full space-y-5">
      {/* Meeting Type */}
      <div className="space-y-2">
        <Label>
          Meeting type
          {' '}
          <span className="text-destructive">*</span>
        </Label>
        <div className="flex flex-wrap gap-2">
          {meetingTypes.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setMeetingType(t)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                meetingType === t
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background text-muted-foreground border-input hover:bg-accent',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Date & Time */}
      <div className="space-y-2">
        <Label>
          Date & time
          {' '}
          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </Label>
        <DateTimePicker
          value={scheduledFor}
          onChange={setScheduledFor}
          placeholder="Pick date & time"
        />
      </div>

      {/* Trade & Scope Selection */}
      <div className="space-y-2">
        <Label>
          Trades & scopes
          {' '}
          <span className="text-muted-foreground text-xs font-normal">(optional — can be added during meeting)</span>
        </Label>
        <MeetingScopesPicker
          value={tradeSelections}
          onChange={setTradeSelections}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
        <Button
          className="flex-1"
          disabled={!meetingType || isPending}
          onClick={handleSubmit}
        >
          {isPending
            ? (isEditMode ? 'Saving...' : 'Creating...')
            : (isEditMode ? 'Save changes' : 'Create meeting')}
        </Button>
      </div>
    </div>
  )
}
