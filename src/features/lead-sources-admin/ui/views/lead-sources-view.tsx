'use client'

import { useQuery } from '@tanstack/react-query'
import { PlusIcon, RadioTowerIcon } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'
import { useEffect, useState } from 'react'

import { LeadSourceDetail } from '@/features/lead-sources-admin/ui/components/lead-source-detail'
import { LeadSourceList } from '@/features/lead-sources-admin/ui/components/lead-source-list'
import { NewLeadSourceSheet } from '@/features/lead-sources-admin/ui/components/new-lead-source-sheet'
import { Button } from '@/shared/components/ui/button'
import { useTRPC } from '@/trpc/helpers'

export function LeadSourcesView() {
  const trpc = useTRPC()
  const [selectedId, setSelectedId] = useQueryState('id', parseAsString.withDefault(''))
  const [newSheetOpen, setNewSheetOpen] = useState(false)

  const { data: sources, isLoading } = useQuery(
    trpc.leadSourcesRouter.list.queryOptions(),
  )

  // Auto-select the first source when nothing selected and the list arrives.
  useEffect(() => {
    if (!selectedId && sources && sources.length > 0) {
      setSelectedId(sources[0]!.id, { history: 'replace' })
    }
  }, [selectedId, sources, setSelectedId])

  const hasSources = (sources?.length ?? 0) > 0

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
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

      {/* Split pane */}
      <div className="flex min-h-0 flex-1">
        <aside
          aria-label="Lead source list"
          className="flex w-full min-w-0 flex-1 flex-col overflow-y-auto border-r border-border/40 px-4 py-4 sm:max-w-xs lg:max-w-sm"
        >
          <LeadSourceList
            sources={sources}
            isLoading={isLoading}
            selectedId={selectedId || null}
            onSelect={id => setSelectedId(id, { history: 'push' })}
          />
        </aside>

        <main className="flex min-w-0 flex-[3] flex-col overflow-y-auto">
          {!isLoading && !hasSources
            ? <EmptyState onCreate={() => setNewSheetOpen(true)} />
            : selectedId && hasSources
              ? <LeadSourceDetail leadSourceId={selectedId} />
              : (
                  <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                    Select a lead source on the left.
                  </div>
                )}
        </main>
      </div>

      <NewLeadSourceSheet
        open={newSheetOpen}
        onOpenChange={setNewSheetOpen}
        onCreated={id => setSelectedId(id, { history: 'push' })}
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
