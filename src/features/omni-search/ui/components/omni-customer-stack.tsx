'use client'

import type { OmniStack, RecentOmniItem } from '@/features/omni-search/types'

import { memo } from 'react'

import { OmniCustomerItem } from '@/features/omni-search/ui/components/omni-customer-item'
import { OmniMeetingItem } from '@/features/omni-search/ui/components/omni-meeting-item'
import { OmniProjectItem } from '@/features/omni-search/ui/components/omni-project-item'
import { OmniProposalItem } from '@/features/omni-search/ui/components/omni-proposal-item'
import { CommandGroup } from '@/shared/components/ui/command'

interface Props {
  stack: OmniStack
  term: string
  onSelect: (item: RecentOmniItem) => void
  onHighlight: (value: string) => void
  stale: boolean
}

function OmniCustomerStackImpl({ stack, term, onSelect, onHighlight, stale }: Props) {
  return (
    // The customer's name labels the group for screen readers; the head row already shows it, so it stays hidden.
    <CommandGroup heading={stack.customer.name} className="mx-2 mb-2 rounded-xl border border-border bg-band p-1 [&_[cmdk-group-heading]]:sr-only">
      <OmniCustomerItem customer={stack.customer} layout="nested" term={term} onSelect={onSelect} onHighlight={onHighlight} disabled={stale} />
      {stack.records.length > 0 && (
        // The tree rule hangs from under the initials tile, so each record reads as the customer's own.
        <div className="ml-7 border-l border-border pl-2">
          {stack.records.map(record => record.kind === 'meeting'
            ? <OmniMeetingItem key={`meeting:${record.row.id}`} meeting={record.row} layout="nested" onSelect={onSelect} disabled={stale} />
            : record.kind === 'proposal'
              ? <OmniProposalItem key={`proposal:${record.row.id}`} proposal={record.row} layout="nested" onSelect={onSelect} disabled={stale} />
              : <OmniProjectItem key={`project:${record.row.id}`} project={record.row} layout="nested" onSelect={onSelect} disabled={stale} />)}
        </div>
      )}
    </CommandGroup>
  )
}

export const OmniCustomerStack = memo(OmniCustomerStackImpl)
