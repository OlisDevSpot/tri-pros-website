'use client'

import type { TradeSelection } from '@/shared/entities/meetings/schemas'
import type { MeetingType } from '@/shared/types/enums/meetings'

import { useMutation, useQuery } from '@tanstack/react-query'
import { FolderOpenIcon } from 'lucide-react'
import { useState } from 'react'

import { MeetingScopesPicker } from '@/features/meetings/ui/components/meeting-scopes-picker'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Button } from '@/shared/components/ui/button'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { creatableMeetingTypes } from '@/shared/constants/enums/meetings'
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
    projectId?: string
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
  const [projectId, setProjectId] = useState<string>(initialValues?.projectId ?? '')

  const isProjectType = meetingType === 'Project'

  // Fetch customer's projects when Project type is selected
  const profileQuery = useQuery({
    ...trpc.customerPipelinesRouter.getCustomerProfile.queryOptions({ customerId }),
    enabled: isProjectType,
  })

  const customerProjects = profileQuery.data?.projects ?? []

  const createMutation = useMutation(
    trpc.meetingsRouter.create.mutationOptions({
      onSuccess: () => {
        setMeetingType('Fresh')
        setScheduledFor(undefined)
        setTradeSelections([])
        setProjectId('')
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
  const canSubmit = meetingType && (!isProjectType || projectId) && !isPending

  function handleSubmit() {
    if (!canSubmit) {
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
        ...(isProjectType && projectId ? { projectId } : {}),
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
          {creatableMeetingTypes.map(t => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setMeetingType(t)
                if (t !== 'Project') {
                  setProjectId('')
                }
              }}
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

      {/* Project Selection — only when type is Project */}
      {isProjectType && (
        <div className="space-y-2">
          <Label>
            Project
            {' '}
            <span className="text-destructive">*</span>
          </Label>
          {customerProjects.length > 0
            ? (
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {customerProjects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          <FolderOpenIcon size={14} className="text-green-600 dark:text-green-400" />
                          {p.title}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )
            : profileQuery.isLoading
              ? <p className="text-muted-foreground text-xs">Loading projects...</p>
              : (
                  <p className="text-muted-foreground text-xs">
                    No projects found for this customer. Create a project first by approving a proposal.
                  </p>
                )}
        </div>
      )}

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
          disabled={!canSubmit}
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
