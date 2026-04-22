'use client'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon, RadioTowerIcon } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'
import { useState } from 'react'

import { ALL_PSEUDO_ID } from '@/features/lead-sources-admin/constants/pseudo-ids'
import { AddCustomerSheet } from '@/features/lead-sources-admin/ui/components/add-customer-sheet'
import { AllDetail } from '@/features/lead-sources-admin/ui/components/all-detail'
import { LeadSourceList } from '@/features/lead-sources-admin/ui/components/lead-source-list'
import { NewLeadSourceSheet } from '@/features/lead-sources-admin/ui/components/new-lead-source-sheet'
import { SourceDetail } from '@/features/lead-sources-admin/ui/components/source-detail'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'

interface AddSheetState {
  /** Lead source slug to attribute the new customer to; undefined → `manual`. */
  slug?: string
  name?: string
}

export function LeadSourcesView() {
  const trpc = useTRPC()
  const [selectedId, setSelectedId] = useQueryState(
    'id',
    parseAsString.withDefault(ALL_PSEUDO_ID),
  )
  const [newSheetOpen, setNewSheetOpen] = useState(false)
  const [addSheetState, setAddSheetState] = useState<AddSheetState | null>(null)

  const { data: sources, isLoading } = useQuery(
    trpc.leadSourcesRouter.list.queryOptions(),
  )

  const hasSources = (sources?.length ?? 0) > 0
  const isAllSelected = selectedId === ALL_PSEUDO_ID

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-4 border-b border-border/40 px-6 py-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold text-foreground">Lead Sources</h1>
          <p className="text-xs text-muted-foreground">
            Performance tracking and intake configuration for every lead channel.
          </p>
        </div>
        <Button onClick={() => setNewSheetOpen(true)} className="gap-1.5">
          <PlusIcon className="size-4" />
          New lead source
        </Button>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Lead source list"
          className="flex w-full min-w-0 flex-1 flex-col overflow-y-auto border-r border-border/40 px-4 py-4 sm:max-w-xs lg:max-w-sm"
        >
          <LeadSourceList
            sources={sources}
            isLoading={isLoading}
            selectedId={selectedId}
            onSelect={id => setSelectedId(id, { history: 'push' })}
          />
        </aside>

        <main className="flex min-w-0 flex-3 flex-col overflow-y-auto">
          {!isLoading && !hasSources
            ? <EmptyState onCreate={() => setNewSheetOpen(true)} />
            : isAllSelected
              ? (
                  <AllDetail
                    sourceCount={sources?.length ?? 0}
                    onAddCustomer={() => setAddSheetState({})}
                  />
                )
              : (
                  <SourceDetail
                    leadSourceId={selectedId}
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
