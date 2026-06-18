'use client'

import type { CampaignLeadRow } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { MoreHorizontalIcon } from 'lucide-react'

import { useCampaignMutations } from '@/features/campaigns-admin/hooks/use-campaign-mutations'
import { Button } from '@/shared/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu'

interface LeadRowActionsProps {
  onEnroll: (customerId: string) => void
  onOpenProfile: (customerId: string) => void
  row: CampaignLeadRow
}

export function LeadRowActions({ onEnroll, onOpenProfile, row }: LeadRowActionsProps) {
  const { markDnc, removeDnc, removeFromCampaign } = useCampaignMutations()
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button aria-label="Lead actions" size="icon" variant="ghost" onClick={e => e.stopPropagation()}>
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
        <DropdownMenuItem onSelect={() => onOpenProfile(row.customerId)}>Open full profile</DropdownMenuItem>
        {row.status === 'eligible' && (
          <DropdownMenuItem onSelect={() => onEnroll(row.customerId)}>Enroll</DropdownMenuItem>
        )}
        {row.status === 'enrolled' && (
          <DropdownMenuItem onSelect={() => removeFromCampaign.mutate({ customerId: row.customerId })}>Remove</DropdownMenuItem>
        )}
        {row.status !== 'dnc' && (
          <DropdownMenuItem className="text-destructive" onSelect={() => markDnc.mutate({ customerIds: [row.customerId] })}>Mark DNC</DropdownMenuItem>
        )}
        {row.status === 'dnc' && (
          <DropdownMenuItem onSelect={() => removeDnc.mutate({ customerId: row.customerId })}>Clear DNC</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
