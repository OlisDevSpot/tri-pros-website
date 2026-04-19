'use client'

import { Loader2, X } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { PARTICIPANT_ROLE_SORT_ORDER } from '@/shared/entities/meetings/constants/participants'
import { getInitials } from '@/shared/entities/users/lib/get-initials'

interface ParticipantRow {
  email: string | null
  image: string | null
  name: string
  role: 'co_owner' | 'helper' | 'owner'
  userId: string
}

interface ParticipantsListProps {
  isLastOwner: (userId: string) => boolean
  pendingUserId: string | null
  rows: ParticipantRow[]
  onRemove: (userId: string) => void
  onRoleChange: (userId: string, newRole: 'co_owner' | 'helper' | 'owner') => void
}

export function ParticipantsList({
  isLastOwner,
  pendingUserId,
  rows,
  onRemove,
  onRoleChange,
}: ParticipantsListProps) {
  const sorted = [...rows].sort((a, b) => PARTICIPANT_ROLE_SORT_ORDER[a.role] - PARTICIPANT_ROLE_SORT_ORDER[b.role])

  if (sorted.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">No participants yet.</p>
    )
  }

  return (
    <div className="space-y-2">
      {sorted.map((p) => {
        const cannotRemove = isLastOwner(p.userId)
        const isPending = pendingUserId === p.userId

        return (
          <div key={p.userId} className="flex items-center gap-2 rounded-md border border-border p-2">
            <Avatar className="size-7 shrink-0">
              <AvatarImage alt="" src={p.image ?? undefined} />
              <AvatarFallback className="text-[10px]">{getInitials(p.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">{p.email}</div>
            </div>
            <Select
              disabled={isPending}
              value={p.role}
              onValueChange={v => onRoleChange(p.userId, v as ParticipantRow['role'])}
            >
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="owner">Owner</SelectItem>
                <SelectItem value="co_owner">Co-owner</SelectItem>
                <SelectItem value="helper">Helper</SelectItem>
              </SelectContent>
            </Select>
            <Button
              aria-label={
                cannotRemove
                  ? `Cannot remove ${p.name} — meeting needs at least one owner`
                  : `Remove ${p.name}`
              }
              className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              disabled={isPending || cannotRemove}
              size="icon"
              type="button"
              variant="ghost"
              onClick={() => onRemove(p.userId)}
            >
              {isPending
                ? <Loader2 className="size-4 animate-spin" />
                : <X className="size-4" />}
            </Button>
          </div>
        )
      })}
    </div>
  )
}
