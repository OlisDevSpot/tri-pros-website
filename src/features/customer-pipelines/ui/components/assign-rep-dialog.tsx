'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckIcon, SearchIcon } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { RepProfileSnapshot } from '@/shared/components/rep-profile-snapshot'
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
import { cn } from '@/shared/lib/utils'
import { useTRPC } from '@/trpc/helpers'

interface AssignRepDialogProps {
  meetingIds: string[]
  currentRepId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function AssignRepDialog({ meetingIds, currentRepId, open, onOpenChange, onSuccess }: AssignRepDialogProps) {
  const trpc = useTRPC()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)

  const usersQuery = useQuery({
    ...trpc.meetingsRouter.getInternalUsers.queryOptions(),
    enabled: open,
  })

  const assignMutation = useMutation(
    trpc.meetingsRouter.assignOwner.mutationOptions({
      onSuccess: () => {
        void queryClient.invalidateQueries(trpc.meetingsRouter.getAll.queryFilter())
        void queryClient.invalidateQueries(trpc.customerPipelinesRouter.getCustomerPipelineItems.queryFilter())
        toast.success(meetingIds.length > 1 ? 'Reps assigned successfully' : 'Rep assigned successfully')
        onOpenChange(false)
        setSelectedUserId(null)
        setSearch('')
        onSuccess?.()
      },
      onError: () => {
        toast.error('Failed to assign rep')
      },
    }),
  )

  function handleAssign() {
    if (!selectedUserId) {
      return
    }
    // For now, assign one at a time. Bulk will be a batched mutation later.
    for (const meetingId of meetingIds) {
      assignMutation.mutate({ meetingId, newOwnerId: selectedUserId })
    }
  }

  const filteredUsers = (usersQuery.data ?? []).filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
    || u.email.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {meetingIds.length > 1 ? `Assign Rep to ${meetingIds.length} Meetings` : 'Assign Rep'}
          </DialogTitle>
          <DialogDescription>
            Select a team member to assign as the meeting rep.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-64 overflow-y-auto -mx-1 space-y-0.5">
          {usersQuery.isLoading && (
            <p className="text-sm text-muted-foreground text-center py-4">Loading team members...</p>
          )}
          {filteredUsers.map(u => (
            <button
              key={u.id}
              type="button"
              className={cn(
                'flex items-center gap-2 w-full rounded-md px-3 py-2 text-left transition-colors cursor-pointer',
                'hover:bg-muted',
                selectedUserId === u.id && 'bg-primary/10',
                currentRepId === u.id && 'opacity-60',
              )}
              onClick={() => setSelectedUserId(u.id)}
            >
              <RepProfileSnapshot
                name={u.name}
                image={u.image}
                subtitle={u.email}
                className="flex-1"
              />
              {selectedUserId === u.id && (
                <CheckIcon size={16} className="shrink-0 text-primary" />
              )}
              {currentRepId === u.id && selectedUserId !== u.id && (
                <span className="text-[11px] text-muted-foreground shrink-0">Current</span>
              )}
            </button>
          ))}
          {!usersQuery.isLoading && filteredUsers.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">No team members found</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAssign}
            disabled={!selectedUserId || selectedUserId === currentRepId || assignMutation.isPending}
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
