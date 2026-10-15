'use client'

import type { OmniEntry, OmniMode, OmniPickedCustomer, OmniQueryState, OmniView, RecentOmniItem } from '@/features/omni-search/types'

import { RotateCwIcon } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'

import { OMNI_COPY } from '@/features/omni-search/constants/copy'
import { OMNI_ROW_CLASSES } from '@/features/omni-search/constants/omni-search'
import { useOmniActions } from '@/features/omni-search/hooks/use-omni-actions'
import { useOpenOmniTarget } from '@/features/omni-search/hooks/use-open-omni-target'
import { buildOmniRegistry } from '@/features/omni-search/lib/build-omni-registry'
import { firstOmniValue } from '@/features/omni-search/lib/first-omni-value'
import { omniEntriesFirst } from '@/features/omni-search/lib/omni-entries-first'
import { rankOmniEntries } from '@/features/omni-search/lib/rank-omni-entries'
import { pushRecentOmniItem, readRecentOmniItems } from '@/features/omni-search/lib/recent-omni-items'
import { OmniCustomerItem } from '@/features/omni-search/ui/components/omni-customer-item'
import { OmniEntryGroups } from '@/features/omni-search/ui/components/omni-entry-groups'
import { OmniRecentGroup } from '@/features/omni-search/ui/components/omni-recent-group'
import { OmniRecordGroups } from '@/features/omni-search/ui/components/omni-record-groups'
import { OmniRecordList } from '@/features/omni-search/ui/components/omni-record-list'
import { OmniRecordSkeleton } from '@/features/omni-search/ui/components/omni-record-skeleton'
import { CommandGroup, CommandItem } from '@/shared/components/ui/command'
import { useSession } from '@/shared/domains/auth/client'
import { useAbility } from '@/shared/domains/permissions/client'
import { useStableCallbacks } from '@/shared/hooks/use-stable-callbacks'

interface Props {
  state: OmniQueryState
  view: OmniView
  /** Moves the cmdk highlight; the dialog owns the value because cmdk never re-selects when rows flip from disabled to enabled. */
  onHighlight: (value: string) => void
  onDone: () => void
  onEnterMode: (mode: OmniMode) => void
  onPickCustomer: (customer: OmniPickedCustomer) => void
}

export function OmniSearchResults({ state, view, onHighlight, onDone, onEnterMode, onPickCustomer }: Props) {
  const ability = useAbility()
  const registry = useMemo(() => buildOmniRegistry(ability), [ability])
  const userId = useSession().data?.user.id
  const recent = useMemo(() => (userId ? readRecentOmniItems(userId) : []), [userId])
  const openTarget = useOpenOmniTarget()
  const runAction = useOmniActions()
  const { search, term, data, pending, busy, failed, answeredTerm } = state
  // Stable identities, so the memoized record composers skip the renders a keystroke causes.
  const { selectRecord, seeAll } = useStableCallbacks({
    selectRecord: (item: RecentOmniItem) => {
      if (userId) {
        pushRecentOmniItem(userId, item)
      }
      onDone()
      openTarget(item.target)
    },
    seeAll: (href: string) => {
      onDone()
      openTarget({ kind: 'route', href })
    },
  })

  const isEmpty = !!data && data.customers.length + data.meetings.length + data.proposals.length + data.projects.length === 0
  const ranked = rankOmniEntries(registry, search)
  const liveEntriesFirst = omniEntriesFirst(ranked, data, pending)
  const [entriesFirst, setEntriesFirst] = useState(liveEntriesFirst)
  // While stale rows are on screen they keep the order they were placed in: flipping it mid-typing would move every row.
  if (!(pending && data) && entriesFirst !== liveEntriesFirst) {
    setEntriesFirst(liveEntriesFirst)
  }
  const first = view === 'pick'
    ? (data?.customers[0] && `customer:${data.customers[0].id}`)
    : firstOmniValue(ranked, data, entriesFirst)
  // Keyed on the settled term (and the mounted view) only, so refetches and arrow keys don't pull the highlight back to the top.
  const settledTerm = pending || (term && !data && !failed) ? null : term
  useEffect(() => {
    if (settledTerm && first) {
      onHighlight(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `first` and `onHighlight` are read at the moment the term settles
  }, [settledTerm, view])

  const note = (title: string, body: string) => (
    <div className="px-4 py-6 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{body}</p>
    </div>
  )
  const failedRows = failed && (
    <CommandGroup>
      <p className="px-2 py-2 text-sm text-muted-foreground">{OMNI_COPY.unavailable}</p>
      <CommandItem aria-label={OMNI_COPY.retry} value="search:retry" onSelect={state.retry} className={OMNI_ROW_CLASSES.compact}>
        <RotateCwIcon aria-hidden className="text-muted-foreground" />
        <span className="text-foreground">{OMNI_COPY.retry}</span>
      </CommandItem>
    </CommandGroup>
  )
  const noMatch = isEmpty && !pending && term && note(OMNI_COPY.noMatch.title(term), OMNI_COPY.noMatch.body)
  const skeleton = busy && !data && !failed && <OmniRecordSkeleton layout={view === 'stacks' ? 'nested' : 'line'} />

  if (view === 'pick') {
    return (
      <>
        {!term && note(OMNI_COPY.pickPrompt.title, OMNI_COPY.pickPrompt.body)}
        {failedRows}
        {noMatch}
        {skeleton}
        {data && data.customers.length > 0 && (
          <CommandGroup heading={OMNI_COPY.customers}>
            {data.customers.map(customer => (
              <OmniCustomerItem
                key={customer.id}
                customer={customer}
                layout="line"
                term={answeredTerm}
                withContact={false}
                disabled={pending}
                onSelect={() => onPickCustomer({ id: customer.id, name: customer.name })}
              />
            ))}
          </CommandGroup>
        )}
      </>
    )
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

  const Records = view === 'stacks' ? OmniRecordGroups : OmniRecordList
  // No match sits in the records' place, so it never stands above Go to rows that do match.
  const records = data
    ? (isEmpty ? noMatch : <Records data={data} term={answeredTerm} onSelectRecord={selectRecord} onSeeAll={seeAll} onHighlight={onHighlight} stale={pending} />)
    : skeleton
  // Keyed, so a change of order moves the two blocks instead of remounting every row in them.
  const recordsBlock = <Fragment key="records">{records}</Fragment>
  const entriesBlock = <Fragment key="entries"><OmniEntryGroups ranked={ranked} onSelect={selectEntry} /></Fragment>

  return (
    <>
      {!search.trim() && <OmniRecentGroup items={recent} onSelect={selectRecord} />}
      {failedRows}
      {entriesFirst ? [entriesBlock, recordsBlock] : [recordsBlock, entriesBlock]}
    </>
  )
}
