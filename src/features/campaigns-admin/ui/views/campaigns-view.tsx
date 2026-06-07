'use client'

import { useQuery } from '@tanstack/react-query'
import { MegaphoneIcon } from 'lucide-react'
import { parseAsString, useQueryState } from 'nuqs'

import { CampaignSourceList } from '@/features/campaigns-admin/ui/components/campaign-source-list'
import { CloudtalkSyncCard } from '@/features/campaigns-admin/ui/components/cloudtalk-sync-card'
import { SourceEnrollmentPanel } from '@/features/campaigns-admin/ui/components/source-enrollment-panel'
import { useTRPC } from '@/trpc/helpers'

/**
 * Campaigns Control Center (super-admin). CloudTalk sync + binding on top; a
 * source master-detail below for per-source enrollment + disqualify. Standalone
 * from lead-sources (user decision 2026-06-04).
 */
export function CampaignsView() {
  const trpc = useTRPC()
  const [selectedSlug, setSelectedSlug] = useQueryState('source', parseAsString)

  const summariesQuery = useQuery(trpc.voipCampaignsRouter.getSourceCampaignSummaries.queryOptions())
  const summaries = summariesQuery.data ?? []
  const selectedSummary = summaries.find(s => s.sourceSlug === selectedSlug) ?? null

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <header className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold text-foreground">Campaigns</h1>
        <p className="text-xs text-muted-foreground">
          CloudTalk lead-conversion campaigns — sync, bind to lead sources, and manage enrollment.
        </p>
      </header>

      <CloudtalkSyncCard />

      <div className="flex min-h-0 flex-1 gap-4 lg:gap-6">
        <aside
          aria-label="Lead sources"
          className="min-w-0 flex-1 overflow-y-auto sm:max-w-xs lg:max-w-sm lg:border-r lg:border-border/40 lg:pr-3"
        >
          <CampaignSourceList
            selectedSlug={selectedSlug}
            onSelect={slug => setSelectedSlug(slug, { history: 'push' })}
          />
        </aside>

        <main className="min-h-0 min-w-0 flex-3 overflow-y-auto">
          {selectedSummary
            ? <SourceEnrollmentPanel summary={selectedSummary} />
            : (
                <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                  <MegaphoneIcon aria-hidden="true" className="size-10 text-muted-foreground/40" />
                  <p className="max-w-sm text-sm text-muted-foreground">
                    Select a lead source to manage its campaign enrollment.
                  </p>
                </div>
              )}
        </main>
      </div>
    </div>
  )
}
