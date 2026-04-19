'use client'

import type { UserOverviewCardUser } from '@/shared/entities/users/components/overview-card'

import { useEffect, useState } from 'react'

import { Button } from '@/shared/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select'
import { UserOverviewCard } from '@/shared/entities/users/components/overview-card'

interface AddParticipantRowProps {
  user: UserOverviewCardUser
  coOwnerSlotFilled: boolean
  /**
   * Disable the Add button regardless of per-row pending state. Used by the
   * parent to lock ALL rows whenever any add-mutation is in flight, preventing
   * two near-simultaneous clicks on different rows from racing past slot guards.
   */
  disabled?: boolean
  isPending: boolean
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
  user,
  coOwnerSlotFilled,
  disabled = false,
  isPending,
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
    <UserOverviewCard
      user={user}
      className="flex items-center gap-2 rounded-md border border-border p-2"
    >
      <UserOverviewCard.Avatar size="sm" className="size-7" />
      <div className="min-w-0 flex-1 overflow-hidden">
        <UserOverviewCard.Name className="text-sm font-medium" />
        <UserOverviewCard.Email className="text-xs text-muted-foreground" />
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
    </UserOverviewCard>
  )
}
