'use client'

import type { RecentOmniItem } from '@/features/omni-search/types'
import type { AppRouterOutputs } from '@/trpc/routers/app'

import { ArrowRightIcon } from 'lucide-react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OmniCustomerItem } from '@/features/omni-search/ui/components/omni-customer-item'
import { OmniMeetingItem } from '@/features/omni-search/ui/components/omni-meeting-item'
import { OmniProjectItem } from '@/features/omni-search/ui/components/omni-project-item'
import { OmniProposalItem } from '@/features/omni-search/ui/components/omni-proposal-item'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'
import { OMNI_LIMITS } from '@/shared/domains/omni-search/schemas'

interface Props {
  data: AppRouterOutputs['searchRouter']['omni']
  onSelectRecord: (item: RecentOmniItem) => void
  onSeeAll: (href: string) => void
  /** Records of an earlier term: shown dimmed and skipped by the keyboard until the current term answers. */
  stale: boolean
}

export function OmniRecordGroups({ data, onSelectRecord, onSeeAll, stale }: Props) {
  return (
    <>
      {data.customers.length > 0 && (
        <CommandGroup heading={OMNI_COPY.customers}>
          {data.customers.map(customer => <OmniCustomerItem key={customer.id} customer={customer} onSelect={onSelectRecord} disabled={stale} />)}
          {data.customers.length >= OMNI_LIMITS.customers && (
            <CommandItem value="customers:see-all" disabled={stale} onSelect={() => onSeeAll(data.seeAllHref)}>
              <ArrowRightIcon aria-hidden className="text-muted-foreground" />
              <span className="text-muted-foreground">{OMNI_COPY.seeAllCustomers}</span>
            </CommandItem>
          )}
        </CommandGroup>
      )}
      {data.meetings.length > 0 && (
        <CommandGroup heading={OMNI_COPY.meetings}>
          {data.meetings.map(meeting => <OmniMeetingItem key={meeting.id} meeting={meeting} onSelect={onSelectRecord} disabled={stale} />)}
        </CommandGroup>
      )}
      {data.proposals.length > 0 && (
        <CommandGroup heading={OMNI_COPY.proposals}>
          {data.proposals.map(proposal => <OmniProposalItem key={proposal.id} proposal={proposal} onSelect={onSelectRecord} disabled={stale} />)}
        </CommandGroup>
      )}
      {data.projects.length > 0 && (
        <CommandGroup heading={OMNI_COPY.projects}>
          {data.projects.map(project => <OmniProjectItem key={project.id} project={project} onSelect={onSelectRecord} disabled={stale} />)}
        </CommandGroup>
      )}
    </>
  )
}
