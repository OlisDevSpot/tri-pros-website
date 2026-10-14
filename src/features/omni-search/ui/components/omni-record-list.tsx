'use client'

import type { OmniRecordsProps } from '@/features/omni-search/types'

import { memo } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { listRecordsByKind } from '@/features/omni-search/lib/list-records-by-kind'
import { OmniCustomerItem } from '@/features/omni-search/ui/components/omni-customer-item'
import { OmniMeetingItem } from '@/features/omni-search/ui/components/omni-meeting-item'
import { OmniProjectItem } from '@/features/omni-search/ui/components/omni-project-item'
import { OmniProposalItem } from '@/features/omni-search/ui/components/omni-proposal-item'
import { OmniSeeAllItem } from '@/features/omni-search/ui/components/omni-see-all-item'
import { CommandGroup } from '@/shared/components/ui/command'
import { OMNI_LIMITS } from '@/shared/domains/omni-search/schemas'

// Memoized with stable callbacks, so a keystroke re-renders the input and entries, not the list.
function OmniRecordListImpl({ data, term, onSelectRecord, onSeeAll, onHighlight, stale }: OmniRecordsProps) {
  const { meetings, proposals, projects } = listRecordsByKind(data)
  return (
    <>
      {data.customers.length > 0 && (
        <CommandGroup heading={OMNI_COPY.customers}>
          {data.customers.map(customer => <OmniCustomerItem key={customer.id} customer={customer} layout="line" term={term} onSelect={onSelectRecord} onHighlight={onHighlight} disabled={stale} />)}
          {data.customers.length >= OMNI_LIMITS.customers && <OmniSeeAllItem href={data.seeAllHref} onSeeAll={onSeeAll} disabled={stale} />}
        </CommandGroup>
      )}
      {meetings.length > 0 && (
        <CommandGroup heading={OMNI_COPY.meetings}>
          {meetings.map(meeting => <OmniMeetingItem key={meeting.id} meeting={meeting} layout="line" onSelect={onSelectRecord} disabled={stale} />)}
        </CommandGroup>
      )}
      {proposals.length > 0 && (
        <CommandGroup heading={OMNI_COPY.proposals}>
          {proposals.map(proposal => <OmniProposalItem key={proposal.id} proposal={proposal} layout="line" onSelect={onSelectRecord} disabled={stale} />)}
        </CommandGroup>
      )}
      {projects.length > 0 && (
        <CommandGroup heading={OMNI_COPY.projects}>
          {projects.map(project => <OmniProjectItem key={project.id} project={project} layout="line" onSelect={onSelectRecord} disabled={stale} />)}
        </CommandGroup>
      )}
    </>
  )
}

export const OmniRecordList = memo(OmniRecordListImpl)
