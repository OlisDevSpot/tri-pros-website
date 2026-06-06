'use client'

import type { EnrolledLeadRow as EnrolledLead } from '@/shared/entities/voip-campaign-contacts/dal/server/queries'

import { format } from 'date-fns'

import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'

interface EnrolledLeadRowProps {
  lead: EnrolledLead
  selected: boolean
  busy: boolean
  onToggleSelect: (customerId: string, checked: boolean) => void
  onDisqualify: (customerId: string) => void
  onRemove: (customerId: string) => void
}

export function EnrolledLeadRow({ lead, selected, busy, onToggleSelect, onDisqualify, onRemove }: EnrolledLeadRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-border/40 px-3 py-2">
      <Checkbox
        checked={selected}
        disabled={busy}
        onCheckedChange={checked => onToggleSelect(lead.customerId, checked === true)}
        aria-label={`Select ${lead.name}`}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{lead.name}</span>
        <span className="truncate text-xs text-muted-foreground">
          {lead.campaignName ?? 'Unknown campaign'}
          {lead.enrolledAt ? ` · enrolled ${format(new Date(lead.enrolledAt), 'MMM d')}` : ''}
        </span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs"
        disabled={busy}
        onClick={() => onRemove(lead.customerId)}
      >
        Remove
      </Button>
      <Button
        size="sm"
        variant="ghost"
        className="h-7 text-xs text-destructive hover:text-destructive"
        disabled={busy}
        onClick={() => onDisqualify(lead.customerId)}
      >
        Disqualify
      </Button>
    </div>
  )
}
