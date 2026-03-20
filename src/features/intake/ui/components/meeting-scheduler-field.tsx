'use client'

import { useQuery } from '@tanstack/react-query'
import { CalendarIcon } from 'lucide-react'
import { DateTimePicker } from '@/shared/components/date-time-picker'
import { Label } from '@/shared/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select'
import { useTRPC } from '@/trpc/helpers'

interface MeetingSchedulerFieldProps {
  scheduledFor: string
  closedById: string
  onDateChange: (iso: string) => void
  onAgentChange: (id: string) => void
  required?: boolean
}

export function MeetingSchedulerField({
  scheduledFor,
  closedById,
  onDateChange,
  onAgentChange,
  required = false,
}: MeetingSchedulerFieldProps) {
  const trpc = useTRPC()

  const agentsQuery = useQuery(
    trpc.intakeRouter.getInternalUsers.queryOptions(),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">
          Appointment Date & Time
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <DateTimePicker
          value={scheduledFor ? new Date(scheduledFor) : undefined}
          onChange={d => onDateChange(d?.toISOString() ?? '')}
          placeholder="Select date & time"
          className="w-full justify-start border border-input bg-background px-3 py-2 h-9 text-sm"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label className="text-sm font-medium">
          Closed By
          {required && <span className="ml-1 text-destructive">*</span>}
        </Label>
        <Select value={closedById} onValueChange={onAgentChange}>
          <SelectTrigger>
            <SelectValue placeholder="Select agent…">
              <CalendarIcon className="mr-2 size-3.5 text-muted-foreground" />
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {agentsQuery.data?.map(agent => (
              <SelectItem key={agent.id} value={agent.id}>
                {agent.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
