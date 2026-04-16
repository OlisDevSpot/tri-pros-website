'use client'

import type { ActivityEntityType, ActivityType } from '@/shared/constants/enums'

import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { Textarea } from '@/shared/components/ui/textarea'
import { activityEntityTypes, activityTypes } from '@/shared/constants/enums'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { capitalize } from '@/shared/lib/formatters'
import { useTRPC } from '@/trpc/helpers'

interface ActivityFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ActivityForm({ open, onOpenChange }: ActivityFormProps) {
  const trpc = useTRPC()
  const { invalidateActivities } = useInvalidation()

  const [type, setType] = useState<ActivityType>('task')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [scheduledFor, setScheduledFor] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [entityType, setEntityType] = useState<ActivityEntityType | ''>('')
  const [entityId, setEntityId] = useState('')

  const resetForm = useCallback(() => {
    setType('task')
    setTitle('')
    setDescription('')
    setScheduledFor('')
    setDueAt('')
    setEntityType('')
    setEntityId('')
  }, [])

  const createActivity = useMutation(
    trpc.scheduleRouter.activities.create.mutationOptions({
      onSuccess: () => {
        toast.success('Activity created')
        invalidateActivities()
        resetForm()
        onOpenChange(false)
      },
      onError: () => toast.error('Failed to create activity'),
    }),
  )

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      return
    }

    createActivity.mutate({
      type,
      title: title.trim(),
      description: description.trim() || undefined,
      scheduledFor: scheduledFor || undefined,
      dueAt: dueAt || undefined,
      entityType: entityType || undefined,
      entityId: entityId.trim() || undefined,
    })
  }, [type, title, description, scheduledFor, dueAt, entityType, entityId, createActivity])

  const showScheduledFor = type === 'event' || type === 'reminder'
  const showDueAt = type === 'task'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Activity</DialogTitle>
          <DialogDescription>Create a new activity to track on your schedule.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-type">Type</Label>
            <Select value={type} onValueChange={v => setType(v as ActivityType)}>
              <SelectTrigger id="activity-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {activityTypes.map(t => (
                  <SelectItem key={t} value={t}>
                    {capitalize(t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-title">Title</Label>
            <Input
              id="activity-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Enter activity title..."
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-description">Description</Label>
            <Textarea
              id="activity-description"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>

          {showScheduledFor && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-scheduled-for">Scheduled For</Label>
              <Input
                id="activity-scheduled-for"
                type="datetime-local"
                value={scheduledFor}
                onChange={e => setScheduledFor(e.target.value)}
              />
            </div>
          )}

          {showDueAt && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-due-at">Due Date</Label>
              <Input
                id="activity-due-at"
                type="datetime-local"
                value={dueAt}
                onChange={e => setDueAt(e.target.value)}
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="activity-entity-type">Link to Entity (optional)</Label>
            <Select value={entityType} onValueChange={v => setEntityType(v as ActivityEntityType)}>
              <SelectTrigger id="activity-entity-type">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                {activityEntityTypes.map(e => (
                  <SelectItem key={e} value={e}>
                    {capitalize(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {entityType && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="activity-entity-id">Entity ID</Label>
              <Input
                id="activity-entity-id"
                value={entityId}
                onChange={e => setEntityId(e.target.value)}
                placeholder="Enter entity UUID..."
              />
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim() || createActivity.isPending}>
              {createActivity.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
