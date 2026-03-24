'use client'

import type { MeetingScopes } from '@/shared/entities/meetings/schemas'
import type { MeetingType } from '@/shared/types/enums/meetings'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import { meetingTypes } from '@/shared/constants/enums'
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'
import { MeetingScopesPicker } from './meeting-scopes-picker'

interface CreateMeetingFormProps {
  customerId: string
  customerName: string
  onSuccess?: () => void
  onCancel?: () => void
}

export function CreateMeetingForm({
  customerId,
  onCancel,
  onSuccess,
}: CreateMeetingFormProps) {
  const trpc = useTRPC()

  const [type, setType] = useState<MeetingType>('Fresh')
  const [scheduledFor, setScheduledFor] = useState<Date | undefined>(undefined)
  const [scopes, setScopes] = useState<MeetingScopes>([])

  const createMutation = useMutation(
    trpc.meetingsRouter.create.mutationOptions({
      onSuccess: () => {
        setType('Fresh')
        setScheduledFor(undefined)
        setScopes([])
        onSuccess?.()
      },
    }),
  )

  function handleSubmit() {
    if (!type) {
      return
    }

    createMutation.mutate({
      customerId,
      type,
      scheduledFor: scheduledFor?.toISOString(),
      meetingScopesJSON: scopes.length > 0 ? scopes : undefined,
    })
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
              onClick={() => setType(t)}
              className={cn(
                'px-4 py-1.5 rounded-full text-sm font-medium border transition-colors',
                type === t
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

      {/* Trades & Scopes */}
      <div className="space-y-2">
        <Label>
          Trades & scopes
          {' '}
          <span className="text-muted-foreground text-xs font-normal">(optional)</span>
        </Label>
        <MeetingScopesPicker value={scopes} onChange={setScopes} />
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
          disabled={!type || createMutation.isPending}
          onClick={handleSubmit}
        >
          {createMutation.isPending ? 'Creating...' : 'Create meeting'}
        </Button>
      </div>
    </div>
  )
}
