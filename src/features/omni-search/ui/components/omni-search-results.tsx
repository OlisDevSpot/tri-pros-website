'use client'

import type { OmniEntry, OmniMode, OmniPickedCustomer, RecentOmniItem } from '@/features/omni-search/types'

import { useEffect, useMemo } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { useOmniActions } from '@/features/omni-search/hooks/use-omni-actions'
import { useOmniSearchQuery } from '@/features/omni-search/hooks/use-omni-search-query'
import { useOpenOmniTarget } from '@/features/omni-search/hooks/use-open-omni-target'
import { buildOmniRegistry } from '@/features/omni-search/lib/build-omni-registry'
import { firstOmniValue } from '@/features/omni-search/lib/first-omni-value'
import { rankOmniEntries } from '@/features/omni-search/lib/rank-omni-entries'
import { pushRecentOmniItem, readRecentOmniItems } from '@/features/omni-search/lib/recent-omni-items'
import { OmniCustomerItem } from '@/features/omni-search/ui/components/omni-customer-item'
import { OmniEntryGroups } from '@/features/omni-search/ui/components/omni-entry-groups'
import { OmniRecentGroup } from '@/features/omni-search/ui/components/omni-recent-group'
import { OmniRecordGroups } from '@/features/omni-search/ui/components/omni-record-groups'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'
import { useSession } from '@/shared/domains/auth/client'
import { toOmniTerm } from '@/shared/domains/omni-search/schemas'
import { useAbility } from '@/shared/domains/permissions/client'

interface Props {
  search: string
  mode: OmniMode
  /** Moves the cmdk highlight; the dialog owns the value because cmdk never re-selects when rows flip from disabled to enabled. */
  onHighlight: (value: string) => void
  onDone: () => void
  onEnterMode: (mode: OmniMode) => void
  onPickCustomer: (customer: OmniPickedCustomer) => void
}

export function OmniSearchResults({ search, mode, onHighlight, onDone, onEnterMode, onPickCustomer }: Props) {
  const ability = useAbility()
  const registry = useMemo(() => buildOmniRegistry(ability), [ability])
  const userId = useSession().data?.user.id
  const recent = useMemo(() => (userId ? readRecentOmniItems(userId) : []), [userId])
  const query = useOmniSearchQuery(search)
  const openTarget = useOpenOmniTarget()
  const runAction = useOmniActions()

  // The instant term, not the debounced one, decides visibility, so clearing the input hides stale records at once.
  const term = toOmniTerm(search)
  const data = term ? query.data : undefined
  const isEmpty = !!data && data.customers.length + data.meetings.length + data.proposals.length + data.projects.length === 0
  // The query follows the debounced term, so until it catches up (or while it serves the previous term's placeholder) its rows describe an earlier term.
  const pending = !!term && (term !== query.term || query.isPlaceholderData)
  const busy = pending || query.isFetching
  const progress = term && busy && <div aria-hidden className="h-0.5 w-full animate-pulse bg-primary/60" />
  const failed = term && query.isError && !data && (
    <CommandGroup>
      <CommandItem value="search:unavailable" disabled>{OMNI_COPY.unavailable}</CommandItem>
    </CommandGroup>
  )

  const ranked = rankOmniEntries(registry, search)
  const entriesFirst = (ranked[0]?.score ?? 0) > (pending ? 0 : Math.min(data?.customers[0]?.score ?? 0, 1))
  const first = mode === 'schedule-meeting'
    ? (data?.customers[0] && `customer:${data.customers[0].id}`)
    : firstOmniValue(ranked, data, entriesFirst)
  // Keyed on the settled term only, so refetches and arrow-key navigation don't pull the highlight back to the top.
  const settledTerm = pending || (term && !data && !query.isError) ? null : term
  useEffect(() => {
    if (settledTerm && first) {
      onHighlight(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `first` and `onHighlight` are read at the moment the term settles
  }, [settledTerm, mode])

  if (mode === 'schedule-meeting') {
    return (
      <>
        {progress}
        {failed}
        <CommandGroup heading={OMNI_COPY.scheduleMeetingChip}>
          {(data?.customers ?? []).map(customer => (
            <OmniCustomerItem key={customer.id} customer={customer} layout="line" term={term ?? ''} withContact={false} disabled={pending} onSelect={() => onPickCustomer({ id: customer.id, name: customer.name })} />
          ))}
        </CommandGroup>
      </>
    )
  }

  function selectRecord(item: RecentOmniItem) {
    if (userId) {
      pushRecentOmniItem(userId, item)
    }
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

  const entries = <OmniEntryGroups ranked={ranked} onSelect={selectEntry} />
  const records = data && <OmniRecordGroups data={data} onSelectRecord={selectRecord} onSeeAll={seeAll} stale={pending} term={term ?? ''} />

  return (
    <>
      {progress}
      {!search.trim() && <OmniRecentGroup items={recent} onSelect={selectRecord} />}
      {failed}
      {isEmpty && !busy && term && <p className="px-3 py-2 text-sm text-muted-foreground">{OMNI_COPY.noMatch.title(term)}</p>}
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
