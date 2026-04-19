'use client'

import { useEffect, useState } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from '@/shared/components/ui/avatar'
import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { getInitials } from '@/shared/entities/users/lib/get-initials'

interface AddParticipantRowProps {
  coOwnerSlotFilled: boolean
  /**
   * Disable the Add button regardless of per-row pending state. Used by the
   * parent to lock ALL rows whenever any add-mutation is in flight, preventing
   * two near-simultaneous clicks on different rows from racing past slot guards.
   */
  disabled?: boolean
  email: string | null
  image: string | null
  isPending: boolean
  name: string
  /** Disable role options that have already been filled. */
  ownerSlotFilled: boolean
  onAdd: (role: 'co_owner' | 'helper' | 'owner') => void
}

function getDefaultRole(ownerFilled: boolean, coOwnerFilled: boolean): 'co_owner' | 'helper' | 'owner' {
  if (!ownerFilled) {
    return 'owner'
  }
  if (!coOwnerFilled) {
    return 'co_owner'
  }
  return 'helper'
}

export function AddParticipantRow({
  coOwnerSlotFilled,
  disabled = false,
  email,
  image,
  isPending,
  name,
  ownerSlotFilled,
  onAdd,
}: AddParticipantRowProps) {
  const [selectedRole, setSelectedRole] = useState<'co_owner' | 'helper' | 'owner'>(
    () => getDefaultRole(ownerSlotFilled, coOwnerSlotFilled),
  )

  useEffect(() => {
    if (selectedRole === 'owner' && ownerSlotFilled) {
      setSelectedRole(getDefaultRole(ownerSlotFilled, coOwnerSlotFilled))
    }
    if (selectedRole === 'co_owner' && coOwnerSlotFilled) {
      setSelectedRole(getDefaultRole(ownerSlotFilled, coOwnerSlotFilled))
    }
  }, [selectedRole, ownerSlotFilled, coOwnerSlotFilled])

  return (
    <div className="flex items-center gap-2 rounded-md border border-border p-2">
      <Avatar className="size-7 shrink-0">
        <AvatarImage alt="" src={image ?? undefined} />
        <AvatarFallback className="text-[10px]">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{email}</div>
      </div>
      <Select
        value={selectedRole}
        onValueChange={v => setSelectedRole(v as typeof selectedRole)}
      >
        <SelectTrigger className="h-8 w-32 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem disabled={ownerSlotFilled} value="owner">
            Owner
          </SelectItem>
          <SelectItem disabled={coOwnerSlotFilled} value="co_owner">
            Co-owner
          </SelectItem>
          <SelectItem value="helper">Helper</SelectItem>
        </SelectContent>
      </Select>
      <Button
        disabled={isPending || disabled}
        size="sm"
        type="button"
        onClick={() => onAdd(selectedRole)}
      >
        Add
      </Button>
    </div>
  )
}
