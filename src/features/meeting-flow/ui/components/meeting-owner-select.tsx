'use client'

import { useMutation, useQuery } from '@tanstack/react-query'
import { UserIcon } from 'lucide-react'
import { toast } from 'sonner'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { useInvalidation } from '@/shared/dal/client/use-invalidation'
import { useTRPC } from '@/trpc/helpers'

interface MeetingOwnerSelectProps {
  meetingId: string
  currentOwnerId: string
  currentOwnerName: string | null
  currentOwnerImage: string | null
}

export function MeetingOwnerSelect({
  meetingId,
  currentOwnerId,
  currentOwnerName,
  currentOwnerImage,
}: MeetingOwnerSelectProps) {
  const trpc = useTRPC()
  const { invalidateMeeting } = useInvalidation()

  const internalUsersQuery = useQuery(
    trpc.meetingsRouter.getInternalUsers.queryOptions(),
  )

  const assignOwnerMutation = useMutation(
    trpc.meetingsRouter.assignOwner.mutationOptions({
      onSuccess: () => {
        toast.success('Owner assigned')
        invalidateMeeting()
      },
      onError: () => {
        toast.error('Failed to assign owner')
      },
    }),
  )

  function handleOwnerChange(newOwnerId: string) {
    if (newOwnerId === currentOwnerId) {
      return
    }
    assignOwnerMutation.mutate({ meetingId, newOwnerId })
  }

  const initials = currentOwnerName
    ? currentOwnerName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-6">
        <AvatarImage src={currentOwnerImage ?? undefined} alt={currentOwnerName ?? 'Owner'} />
        <AvatarFallback className="text-[10px]">{initials}</AvatarFallback>
      </Avatar>
      <Select
        value={currentOwnerId}
        onValueChange={handleOwnerChange}
        disabled={assignOwnerMutation.isPending || internalUsersQuery.isLoading}
      >
        <SelectTrigger className="h-7 w-auto min-w-30 gap-1.5 border-border/40 bg-transparent px-2 text-xs">
          <UserIcon className="size-3 shrink-0 text-muted-foreground" />
          <SelectValue placeholder="Assign owner" />
        </SelectTrigger>
        <SelectContent>
          {internalUsersQuery.data?.map(u => (
            <SelectItem key={u.id} value={u.id}>
              {u.name ?? u.email}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
