'use client'

import type { TimeRangeKey } from '@/features/lead-sources-admin/constants/time-ranges'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon, RadioTowerIcon } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'
import { useMemo, useState } from 'react'

import { ALL_PSEUDO_ID } from '@/features/lead-sources-admin/constants/pseudo-ids'
import { BASE_TIME_RANGE_CHIPS, DEFAULT_RANGE_KEY } from '@/features/lead-sources-admin/constants/time-ranges'
import { buildChipsWithYears, resolveTimeRange } from '@/features/lead-sources-admin/lib/resolve-time-range'
import { AddCustomerSheet } from '@/features/lead-sources-admin/ui/components/add-customer-sheet'
import { AllDetail } from '@/features/lead-sources-admin/ui/components/all-detail'
import { LeadSourceList } from '@/features/lead-sources-admin/ui/components/lead-source-list'
import { NewLeadSourceSheet } from '@/features/lead-sources-admin/ui/components/new-lead-source-sheet'
import { SourceDetail } from '@/features/lead-sources-admin/ui/components/source-detail'
import { TimeRangeChips } from '@/features/lead-sources-admin/ui/components/time-range-chips'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'

interface AddSheetState {
  slug?: string
  name?: string
}

export function LeadSourcesView() {
  const trpc = useTRPC()
  const [selectedId, setSelectedId] = useQueryState(
    'id',
    parseAsString.withDefault(ALL_PSEUDO_ID),
  )
  const [rangeKey, setRangeKey] = useQueryState(
    'range',
    parseAsString.withDefault(DEFAULT_RANGE_KEY),
  )
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const [addSheetState, setAddSheetState] = useState<AddSheetState | null>(null)

  // Global time range — one source of truth. Every pane + the left-col
  // stats consume the same `activeChip`. `resolveTimeRange` is memoised on
  // `activeChip.key` so rolling windows don't reshuffle timestamps each
  // render (see PR #127 for the infinite-refetch fix).
  const yearsQuery = useQuery(
    trpc.leadSourcesRouter.getYearsWithActivity.queryOptions(),
  )
  const chips = useMemo(
    () => buildChipsWithYears(BASE_TIME_RANGE_CHIPS, yearsQuery.data ?? []),
    [yearsQuery.data],
  )
  const activeChip = chips.find(c => c.key === rangeKey) ?? chips[0]!
  const range = useMemo(() => resolveTimeRange(activeChip), [activeChip.key])

  const { data: sources, isLoading } = useQuery(
    trpc.leadSourcesRouter.list.queryOptions({
      from: range.from,
      to: range.to,
    }),
  )

  const hasSources = (sources?.length ?? 0) > 0
  const isAllSelected = selectedId === ALL_PSEUDO_ID

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-col gap-1 border-b border-border/40 px-6 py-4">
        <h1 className="text-xl font-semibold text-foreground">Lead Sources</h1>
        <p className="text-xs text-muted-foreground">
          Performance tracking and intake configuration for every lead channel.
        </p>
      </header>

      <div className="flex items-center justify-between gap-4 border-b border-border/40 px-6 py-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Time range
        </span>
        <TimeRangeChips
          chips={chips}
          value={activeChip.key}
          onChange={k => setRangeKey(k as TimeRangeKey, { history: 'replace' })}
        />
      </div>

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Lead source list"
          className="flex w-full min-w-0 flex-1 flex-col border-r border-border/40 sm:max-w-xs lg:max-w-sm"
        >
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <LeadSourceList
              sources={sources}
              isLoading={isLoading}
              selectedId={selectedId}
              onSelect={id => setSelectedId(id, { history: 'push' })}
              rangeLabel={activeChip.label}
            />
          </div>
          <div className="shrink-0 border-t border-border/40 p-3">
            <Button
              variant="outline"
              onClick={() => setNewSheetOpen(true)}
              className="w-full justify-start gap-2 border-dashed text-muted-foreground motion-safe:transition-colors hover:border-solid hover:bg-muted/60 hover:text-foreground"
            >
              <PlusIcon className="size-4" />
              New lead source
            </Button>
          </div>
        </aside>

        <main className="flex min-w-0 flex-3 flex-col overflow-y-auto">
          {!isLoading && !hasSources
            ? <EmptyState onCreate={() => setNewSheetOpen(true)} />
            : isAllSelected
              ? (
                  <AllDetail
                    sourceCount={sources?.length ?? 0}
                    activeChip={activeChip}
                    range={range}
                    onAddCustomer={() => setAddSheetState({})}
                  />
                )
              : (
                  <SourceDetail
                    leadSourceId={selectedId}
                    activeChip={activeChip}
                    range={range}
                    onAddCustomer={src => setAddSheetState(src)}
                  />
                )}
        </main>
      </div>

      <NewLeadSourceSheet
        open={newSheetOpen}
        onOpenChange={setNewSheetOpen}
        onCreated={id => setSelectedId(id, { history: 'push' })}
      />

      <AddCustomerSheet
        open={addSheetState !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAddSheetState(null)
          }
        }}
        leadSourceSlug={addSheetState?.slug}
        leadSourceName={addSheetState?.name}
      />
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <RadioTowerIcon aria-hidden="true" className="size-10 text-muted-foreground/40" />
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">No lead sources yet</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Create your first lead source to get an intake URL you can share with a partner or campaign.
        </p>
      </div>
      <Button onClick={onCreate} className="gap-1.5">
        <PlusIcon className="size-4" />
        New lead source
      </Button>
    </div>
  )
}
