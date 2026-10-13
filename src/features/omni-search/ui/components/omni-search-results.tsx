'use client'

import type { OmniEntry, OmniMode, OmniPickedCustomer, RecentOmniItem } from '@/features/omni-search/types'

import { useMemo, useState } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { useOmniActions } from '@/features/omni-search/hooks/use-omni-actions'
import { useOmniSearchQuery } from '@/features/omni-search/hooks/use-omni-search-query'
import { useOpenOmniTarget } from '@/features/omni-search/hooks/use-open-omni-target'
import { buildOmniRegistry } from '@/features/omni-search/lib/build-omni-registry'
import { rankOmniEntries } from '@/features/omni-search/lib/rank-omni-entries'
import { pushRecentOmniItem, readRecentOmniItems } from '@/features/omni-search/lib/recent-omni-items'
import { OmniCustomerItem } from '@/features/omni-search/ui/components/omni-customer-item'
import { OmniEntryGroups } from '@/features/omni-search/ui/components/omni-entry-groups'
import { OmniRecentGroup } from '@/features/omni-search/ui/components/omni-recent-group'
import { OmniRecordGroups } from '@/features/omni-search/ui/components/omni-record-groups'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'
import { toOmniTerm } from '@/shared/domains/omni-search/schemas'
import { useAbility } from '@/shared/domains/permissions/client'

interface Props {
  search: string
  mode: OmniMode
  onDone: () => void
  onEnterMode: (mode: OmniMode) => void
  onPickCustomer: (customer: OmniPickedCustomer) => void
}

export function OmniSearchResults({ search, mode, onDone, onEnterMode, onPickCustomer }: Props) {
  const ability = useAbility()
  const registry = useMemo(() => buildOmniRegistry(ability), [ability])
  const [recent] = useState(readRecentOmniItems)
  const query = useOmniSearchQuery(search)
  const openTarget = useOpenOmniTarget()
  const runAction = useOmniActions()

  // The instant term, not the debounced one, decides visibility, so clearing the input hides stale records at once.
  const term = toOmniTerm(search)
  const data = term ? query.data : undefined
  const isEmpty = !!data && data.customers.length + data.meetings.length + data.proposals.length + data.projects.length === 0
  const progress = term && query.isFetching && <div aria-hidden className="h-0.5 w-full animate-pulse bg-primary/60" />
  const failed = term && query.isError && !data && (
    <CommandGroup>
      <CommandItem value="search:unavailable" disabled>{OMNI_COPY.unavailable}</CommandItem>
    </CommandGroup>
  )

  if (mode === 'schedule-meeting') {
    return (
      <>
        {progress}
        {failed}
        <CommandGroup heading={OMNI_COPY.scheduleMeetingHeading}>
          {(data?.customers ?? []).map(customer => (
            <OmniCustomerItem key={customer.id} customer={customer} onSelect={() => onPickCustomer({ id: customer.id, name: customer.name })} />
          ))}
        </CommandGroup>
      </>
    )
  }

  function selectRecord(item: RecentOmniItem) {
    pushRecentOmniItem(item)
    onDone()
    openTarget(item.target)
  }

  function selectEntry(entry: OmniEntry) {
    if ('href' in entry) {
      onDone()
      openTarget({ kind: 'route', href: entry.href })
      return
    }
    if (entry.action === 'schedule-meeting') {
      onEnterMode('schedule-meeting')
      return
    }
    onDone()
    runAction(entry.action)
  }

  function seeAll(href: string) {
    onDone()
    openTarget({ kind: 'route', href })
  }

  const ranked = rankOmniEntries(registry, search)
  const entries = <OmniEntryGroups ranked={ranked} onSelect={selectEntry} />
  const records = data && <OmniRecordGroups data={data} onSelectRecord={selectRecord} onSeeAll={seeAll} />
  const entriesFirst = (ranked[0]?.score ?? 0) > (data?.customers[0]?.score ?? 0)

  return (
    <>
      {progress}
      {!search.trim() && <OmniRecentGroup items={recent} onSelect={selectRecord} />}
      {failed}
      {isEmpty && !query.isFetching && term && <p className="px-3 py-2 text-sm text-muted-foreground">{OMNI_COPY.noRecords(term)}</p>}
      {entriesFirst
        ? (
            <>
              {entries}
              {records}
            </>
          )
        : (
            <>
              {records}
              {entries}
            </>
          )}
    </>
  )
}
